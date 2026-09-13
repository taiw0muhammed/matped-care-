import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedChild, logAudit, requireRole } from "@/lib/guards";
import { apiError } from "@/lib/api";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  visitDate: z.string().min(8),
  visitType: z.enum(["ROUTINE", "FOLLOW_UP", "EMERGENCY", "OTHER"]).default("ROUTINE"),
  notes: z.string().max(2000).optional().or(z.literal("")),
  diagnoses: z.string().max(1000).optional().or(z.literal("")),
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
    const visits = await prisma.visit.findMany({
      where: { childId: child.id },
      include: { nurse: { select: { id: true, fullName: true } } },
      orderBy: { visitDate: "desc" },
    });
    return NextResponse.json({ visits });
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
    const visit = await prisma.visit.create({
      data: {
        childId: child.id,
        nurseId: user.id,
        visitDate: new Date(d.visitDate),
        visitType: d.visitType,
        notes: d.notes || null,
        diagnoses: d.diagnoses || null,
      },
    });
    await logAudit(user.id, child.id, "VISIT_CREATE", { visitId: visit.id });
    return NextResponse.json({ visit }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}