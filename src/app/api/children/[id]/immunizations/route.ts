import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedChild, logAudit, requireRole } from "@/lib/guards";
import { apiError } from "@/lib/api";
import { z } from "zod";
import { computeDosePlan, doseLabel } from "@/lib/immunization/logic";
import { buildAlerts, dispatchAlerts } from "@/lib/notifications/dispatch";

export const dynamic = "force-dynamic";

const giveSchema = z.object({
  vaccine: z.string().min(2).max(40),
  dose: z.coerce.number().int().min(0).max(10),
  givenAt: z.string().min(8),
  batchNo: z.string().max(80).optional().or(z.literal("")),
  site: z.string().max(80).optional().or(z.literal("")),
  route: z.string().max(80).optional().or(z.literal("")),
  reason: z.string().max(500).optional().or(z.literal("")),
  visitId: z.string().min(1).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{  id: string  }> },
) {
  const {id} = await params;
  try {
    const user = await requireRole("NURSE", "ADMIN");
    const child = await getAuthorizedChild(id, user);
    if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const immunizations = await prisma.immunization.findMany({
      where: { childId: child.id },
      orderBy: { scheduled: "asc" },
    });
    return NextResponse.json({ immunizations });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * Record a vaccine dose as given (also used for catch-up/missed workflow:
 * giveAt may be any past date). After saving, recompute alerts and dispatch.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{  id: string  }> },
) {
  const {id} = await params;
  try {
    const user = await requireRole("NURSE", "ADMIN");
    const child = await getAuthorizedChild(id, user);
    if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const parsed = giveSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    const d = parsed.data;
    const givenAt = new Date(d.givenAt);

    const existing = await prisma.immunization.findFirst({
      where: { childId: child.id, vaccine: d.vaccine, dose: d.dose },
    });

    let row: any;
    if (existing) {
      row = await prisma.immunization.update({
        where: { id: existing.id },
        data: {
          givenAt,
          status: "GIVEN",
          batchNo: d.batchNo || existing.batchNo,
          site: d.site || existing.site,
          reason: d.reason || null,
          nurseId: user.id,
          visitId: d.visitId || existing.visitId,
        },
      });
    } else {
      row = await prisma.immunization.create({
        data: {
          childId: child.id,
          visitId: d.visitId || null,
          vaccine: d.vaccine,
          dose: d.dose,
          scheduled: givenAt,
          givenAt,
          batchNo: d.batchNo || null,
          site: d.site || null,
          status: "GIVEN",
          reason: d.reason || null,
          nurseId: user.id,
        },
      });
    }
    await logAudit(user.id, child.id, "IMMUNIZATION_GIVE", {
      vaccine: d.vaccine,
      dose: d.dose,
      id: row.id,
    });

    // Recompute alerts and notify guardians (best effort).
    try {
      const all = await prisma.immunization.findMany({ where: { childId: child.id } });
      const givenDoses = all
        .filter((i) => i.givenAt)
        .map((i) => ({ vaccine: i.vaccine, dose: i.dose, givenAt: i.givenAt as Date }));
      const growthRows = await prisma.growthMeasurement.findMany({
        where: { childId: child.id },
        orderBy: { measuredAt: "desc" },
      });
      const alerts = buildAlerts(child, givenDoses, new Date(), growthRows[0]?.status ?? null);
      if (alerts.length > 0) {
        const guardians = await prisma.guardian.findMany({
          where: { childId: child.id },
          include: { user: true },
        });
        await dispatchAlerts(child.id, alerts, guardians.map((g) => g.user));
      }
    } catch {
      /* notification failure must not fail the dose record */
    }

    return NextResponse.json({ immunization: row }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}