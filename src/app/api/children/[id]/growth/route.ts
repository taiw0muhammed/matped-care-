import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedChild, logAudit, requireRole } from "@/lib/guards";
import { apiError } from "@/lib/api";
import { z } from "zod";
import { ageInDays, daysBetween } from "@/lib/dates";
import { assessGrowth } from "@/lib/growth/engine";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  measuredAt: z.string().min(8),
  weightKg: z.coerce.number().min(0.1).max(30).optional().or(z.literal("")),
  lengthCm: z.coerce.number().min(20).max(150).optional().or(z.literal("")),
  headCircCm: z.coerce.number().min(20).max(70).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
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
    const growth = await prisma.growthMeasurement.findMany({
      where: { childId: child.id },
      orderBy: { measuredAt: "asc" },
    });
    return NextResponse.json({ growth });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{  id: string  }> },
) {
  const {id} = await params;
  try {
    const user = await requireRole("NURSE", "ADMIN");
    const child = await getAuthorizedChild(id, user);
    if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    const d = parsed.data;
    if (d.weightKg == null && d.lengthCm == null && d.headCircCm == null) {
      return NextResponse.json({ error: "Provide at least one measurement" }, { status: 400 });
    }

    const measuredAt = new Date(d.measuredAt);
    // Find previous measurement with weight, before this one, for trend input.
    const prev = await prisma.growthMeasurement.findFirst({
      where: { childId: child.id, weightKg: { not: null }, measuredAt: { lt: measuredAt } },
      orderBy: { measuredAt: "desc" },
      select: { weightKg: true, measuredAt: true },
    });

    const assessment = assessGrowth({
      sex: child.sex === "FEMALE" ? "female" : "male",
      ageDays: Math.max(0, ageInDays(child.dateOfBirth, measuredAt)),
      weightKg: d.weightKg === "" ? null : d.weightKg ?? null,
      lengthCm: d.lengthCm === "" ? null : d.lengthCm ?? null,
      headCircCm: d.headCircCm === "" ? null : d.headCircCm ?? null,
      prevWeightKg: prev?.weightKg ?? null,
      prevWeightAgeDays: prev ? Math.max(0, daysBetween(prev.measuredAt, measuredAt)) : undefined,
    });

    const row = await prisma.growthMeasurement.create({
      data: {
        childId: child.id,
        nurseId: user.id,
        measuredAt,
        weightKg: d.weightKg === "" ? null : d.weightKg ?? null,
        lengthCm: d.lengthCm === "" ? null : d.lengthCm ?? null,
        headCircCm: d.headCircCm === "" ? null : d.headCircCm ?? null,
        status: assessment.status,
        notes: d.notes || null,
      },
    });
    await logAudit(user.id, child.id, "GROWTH_CREATE", {
      growthId: row.id,
      status: assessment.status,
    });
    return NextResponse.json({ growth: row, assessment }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}