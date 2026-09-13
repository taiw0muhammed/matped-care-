import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/guards";

export const dynamic = "force-dynamic";

/** Notifications for the signed-in user (by child link or direct userId). */
export async function GET(_req: Request) {
  try {
    const user = await requireUser();
    const childIds =
      user.role === "PARENT"
        ? (await prisma.guardian.findMany({ where: { userId: user.id }, select: { childId: true } })).map(
            (g) => g.childId,
          )
        : null;

    const notifications = await prisma.notification.findMany({
      where: childIds
        ? { OR: [{ childId: { in: childIds } }, { userId: user.id }] }
        : { userId: user.id },
      include: { child: { select: { id: true, firstName: true, lastName: true, recordId: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ notifications });
  } catch (e) {
    return apiError(e);
  }
}

/** Mark all of the user's notifications as read. */
export async function POST(_req: Request) {
  try {
    const user = await requireUser();
    await prisma.notification.updateMany({
      where: {
        userId: user.id,
        status: "QUEUED",
      },
      data: { status: "SENT" },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}