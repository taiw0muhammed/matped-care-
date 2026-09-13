import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";
import { requireRole } from "@/lib/guards";

export const dynamic = "force-dynamic";

/** Platform-wide counts for the admin dashboard. */
export async function GET(_req: Request) {
  try {
    await requireRole("ADMIN");
    const [users, nurses, parents, admins, children, activeChildren, immunizations, visits, appointments, notifications, recordsShared] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: "NURSE" } }),
        prisma.user.count({ where: { role: "PARENT" } }),
        prisma.user.count({ where: { role: "ADMIN" } }),
        prisma.child.count(),
        prisma.child.count({ where: { status: "ACTIVE" } }),
        prisma.immunization.count(),
        prisma.visit.count(),
        prisma.appointment.count({ where: { status: "SCHEDULED" } }),
        prisma.notification.count(),
        prisma.shareToken.count(),
      ]);
    const recentUsers = await prisma.user.findMany({
      select: { id: true, fullName: true, email: true, role: true, active: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    });
    const recentChildren = await prisma.child.findMany({
      select: { id: true, recordId: true, firstName: true, lastName: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    });
    return NextResponse.json({
      stats: {
        users,
        nurses,
        parents,
        admins,
        children,
        activeChildren,
        immunizations,
        visits,
        appointments,
        notifications,
        recordsShared,
      },
      recentUsers,
      recentChildren,
    });
  } catch (e) {
    return apiError(e);
  }
}