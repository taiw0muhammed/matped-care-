import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedChild, requireUser } from "@/lib/guards";
import { apiError } from "@/lib/api";
import { ageInDays, daysBetween } from "@/lib/dates";
import { assessGrowth } from "@/lib/growth/engine";
import { computeDosePlan } from "@/lib/immunization/logic";
import { buildAlerts } from "@/lib/notifications/dispatch";

export const dynamic = "force-dynamic";

/**
 * Full child record bundle for the profile/child page:
 * child, guardians, visits, growth, immunizations, appointments,
 * WHO growth assessment, Nigerian schedule dose plan, and active alerts.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{  id: string  }> },
) {
  const {id} = await params;
  try {
    const user = await requireUser();
    const child = await getAuthorizedChild(id, user);
    if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [guardians, visits, growth, immunizations, appointments] = await Promise.all([
      prisma.guardian.findMany({
        where: { childId: child.id },
        include: { user: { select: { id: true, fullName: true, email: true, phone: true } } },
      }),
      prisma.visit.findMany({
        where: { childId: child.id },
        include: { nurse: { select: { id: true, fullName: true } } },
        orderBy: { visitDate: "desc" },
      }),
      prisma.growthMeasurement.findMany({ where: { childId: child.id }, orderBy: { measuredAt: "asc" } }),
      prisma.immunization.findMany({ where: { childId: child.id }, orderBy: { scheduled: "asc" } }),
      prisma.appointment.findMany({
        where: { childId: child.id },
        include: { nurse: { select: { id: true, fullName: true } } },
        orderBy: { scheduledAt: "desc" },
      }),
    ]);

    const now = new Date();
    const sortedDesc = [...growth].reverse();
    const latest = sortedDesc.find((g) => g.weightKg != null) ?? null;
    const prev = sortedDesc.find((g, i) => i > 0 && g.weightKg != null && latest?.weightKg != null) ?? null;

    const assessment = assessGrowth({
      sex: child.sex === "FEMALE" ? "female" : "male",
      ageDays: Math.max(0, ageInDays(child.dateOfBirth, now)),
      weightKg: latest?.weightKg ?? null,
      lengthCm: latest?.lengthCm ?? null,
      headCircCm: latest?.headCircCm ?? null,
      prevWeightKg: prev?.weightKg ?? null,
      prevWeightAgeDays: prev ? Math.max(0, daysBetween(prev.measuredAt, latest?.measuredAt ?? now)) : undefined,
    });

    const givenDoses = immunizations
      .filter((i) => i.givenAt)
      .map((i) => ({ vaccine: i.vaccine, dose: i.dose, givenAt: i.givenAt as Date }));
    const dosePlan = computeDosePlan(child.dateOfBirth, givenDoses, now);
    const alerts = buildAlerts(child, givenDoses, now, assessment.status, dosePlan);

    return NextResponse.json({
      child,
      guardians,
      visits,
      growth,
      immunizations,
      appointments,
      assessment,
      dosePlan,
      alerts,
    });
  } catch (e) {
    return apiError(e);
  }
}