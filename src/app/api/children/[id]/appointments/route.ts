import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedChild, logAudit, requireRole } from "@/lib/guards";
import { apiError } from "@/lib/api";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  scheduledAt: z.string().min(8),
  reason: z.string().min(2).max(300),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"]).default("SCHEDULED"),
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
    const appointments = await prisma.appointment.findMany({
      where: { childId: child.id },
      include: { nurse: { select: { id: true, fullName: true } } },
      orderBy: { scheduledAt: "desc" },
    });
    return NextResponse.json({ appointments });
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
    const appt = await prisma.appointment.create({
      data: {
        childId: child.id,
        userId: user.id,
        nurseId: user.id,
        scheduledAt: new Date(parsed.data.scheduledAt),
        notes: parsed.data.reason,
        status: parsed.data.status,
      },
    });
    await logAudit(user.id, child.id, "APPOINTMENT_CREATE", { id: appt.id });
    return NextResponse.json({ appointment: appt }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}