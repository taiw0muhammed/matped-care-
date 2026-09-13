import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { apiError } from "@/lib/api";

/** All upcoming/recent appointments across the nurse's children. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const appointments = await prisma.appointment.findMany({
      orderBy: { scheduledAt: "desc" },
      take: 100,
      include: {
        child: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            recordId: true,
            nurseId: true,
          },
        },
        nurse: { select: { id: true, fullName: true } },
      },
    });

    const rows = appointments
      .filter((a) => user.role === "ADMIN" || a.child.nurseId === user.id)
      .map((a) => ({
        id: a.id,
        childId: a.childId,
        childName: `${a.child.firstName} ${a.child.lastName}`,
        recordId: a.child.recordId,
        scheduledAt: a.scheduledAt,
        reason: a.notes,
        status: a.status,
        nurse: a.nurse,
      }));

    return NextResponse.json({ appointments: rows });
  } catch (e) {
    return apiError(e);
  }
}