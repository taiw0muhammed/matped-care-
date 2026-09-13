import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedChild, logAudit, requireRole } from "@/lib/guards";
import { apiError } from "@/lib/api";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{  id: string; aid: string  }> },
) {
  const {id, aid} = await params;
  try {
    const user = await requireRole("NURSE", "ADMIN");
    const child = await getAuthorizedChild(id, user);
    if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const parsed = updateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const appt = await prisma.appointment.updateMany({
      where: { id: aid, childId: child.id },
      data: { status: parsed.data.status },
    });
    if (appt.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await logAudit(user.id, child.id, "APPOINTMENT_UPDATE", { id: aid, status: parsed.data.status });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}