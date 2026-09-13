import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/guards";
import { computeDosePlan } from "@/lib/immunization/logic";
import { assessGrowth } from "@/lib/growth/engine";
import { ageInDays } from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * List of children linked to the signed-in parent (via guardian links),
 * each with a live growth/vaccination summary.
 */
export async function GET(_req: Request) {
  try {
    const user = await requireUser();
    const links = await prisma.guardian.findMany({
      where: { userId: user.id },
      include: {
        child: {
          include: {
            nurse: { select: { id: true, fullName: true, facilityName: true } },
          },
        },
      },
    });

    const now = new Date();
    const rows = await Promise.all(
      links.map(async (link) => {
        const c = link.child;
        const [latest, immunizations, appointments] = await Promise.all([
          prisma.growthMeasurement.findFirst({
            where: { childId: c.id },
            orderBy: { measuredAt: "desc" },
          }),
          prisma.immunization.findMany({ where: { childId: c.id } }),
          prisma.appointment.findMany({
            where: { childId: c.id, status: "SCHEDULED" },
            orderBy: { scheduledAt: "asc" },
          }),
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
          relation: link.relation,
          nurse: c.nurse,
          latestMeasurement: latest,
          growthStatus: assessment?.status ?? null,
          nextDue: plan.nextDue,
          overdueCount: plan.overdue.length,
          dueTodayCount: plan.dueToday.length,
          nextAppointment: appointments[0] ?? null,
          progress: plan.progress,
        };
      }),
    );

    return NextResponse.json({ children: rows });
  } catch (e) {
    return apiError(e);
  }
}