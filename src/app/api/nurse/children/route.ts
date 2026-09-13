import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";
import { getAuthorizedChild, requireRole } from "@/lib/guards";
import { computeDosePlan } from "@/lib/immunization/logic";
import { assessGrowth } from "@/lib/growth/engine";
import { ageInDays } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Lightweight list of a nurse's managed children with live status summaries. */
export async function GET(req: Request) {
  try {
    const user = await requireRole("NURSE", "ADMIN");
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim().toLowerCase() || "";

    const where = {
      ...(user.role === "ADMIN" ? {} : { nurseId: user.id }),
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" as const } },
              { lastName: { contains: q, mode: "insensitive" as const } },
              { recordId: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const children = await prisma.child.findMany({
      where,
      include: {
        nurse: { select: { id: true, fullName: true, facilityName: true } },
        guardians: {
          include: { user: { select: { id: true, fullName: true, email: true, phone: true } } },
        },
        _count: { select: { visits: true, immunizations: true, growth: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    const rows = await Promise.all(
      children.map(async (c) => {
        const [latest, immunizations] = await Promise.all([
          prisma.growthMeasurement.findFirst({
            where: { childId: c.id },
            orderBy: { measuredAt: "desc" },
          }),
          prisma.immunization.findMany({ where: { childId: c.id } }),
        ]);
        const given = immunizations
          .filter((i) => i.givenAt)
          .map((i) => ({ vaccine: i.vaccine, dose: i.dose, givenAt: i.givenAt as Date }));
        const plan = computeDosePlan(c.dateOfBirth, given, now);
        const days = ageInDays(c.dateOfBirth, now);
        const assessment = latest?.weightKg != null
          ? assessGrowth({
              sex: c.sex === "MALE" ? "male" : "female",
              ageDays: days,
              weightKg: latest?.weightKg ?? null,
              lengthCm: latest?.lengthCm ?? null,
              headCircCm: latest?.headCircCm ?? null,
            })
          : null;
        return {
          id: c.id,
          recordId: c.recordId,
          firstName: c.firstName,
          lastName: c.lastName,
          sex: c.sex,
          dateOfBirth: c.dateOfBirth,
          status: c.status,
          nurse: c.nurse,
          guardianCount: c.guardians.length,
          counts: c._count,
          latestMeasurement: latest,
          growthStatus: assessment?.status ?? null,
          nextDue: plan.nextDue,
          overdueCount: plan.overdue.length,
          dueTodayCount: plan.dueToday.length,
          dueSoonCount: plan.dueSoon.length,
          coverage: plan.coverage,
          progress: plan.progress,
        };
      }),
    );

    return NextResponse.json({ children: rows });
  } catch (e) {
    return apiError(e);
  }
}