import { prisma } from "./prisma";
import type { Child, User, Visit, GrowthMeasurement, Immunization, Appointment } from "@prisma/client";
import { assessGrowth, referenceCurves, type Assessment } from "./growth/engine";
import { computeDosePlan, type DosePlan } from "./immunization/logic";
import { ageInDays } from "./dates";

export interface ChildRecord {
  child: Child & { nurse: { id: string; fullName: string; facilityName: string | null } | null };
  guardians: Array<{ id: string; relation: string | null; user: { id: string; fullName: string; email: string; phone: string | null } }>;
  visits: Array<Visit & { nurse?: { id: string; fullName: string } | null }>;
  immunizations: Immunization[];
  appointments: Appointment[];
  growth: {
    measurements: GrowthMeasurement[];
    assessment: Assessment;
    plan: DosePlan;
    curves: {
      wfa?: Record<string, number[]>;
      lha?: Record<string, number[]>;
    };
  };
}

const userInclude = { nurse: { select: { id: true, fullName: true, facilityName: true } } };

export async function buildChildRecord(childId: string): Promise<ChildRecord | null> {
  const child = await prisma.child.findUnique({
    where: { id: childId },
    include: userInclude,
  });
  if (!child) return null;

  const [guardians, visits, growth, immunizations, appointments] = await Promise.all([
    prisma.guardian.findMany({
      where: { childId },
      include: { user: { select: { id: true, fullName: true, email: true, phone: true } } },
    }),
    prisma.visit.findMany({ where: { childId }, include: { nurse: { select: { id: true, fullName: true } } }, orderBy: { visitDate: "asc" } }),
    prisma.growthMeasurement.findMany({ where: { childId }, orderBy: { measuredAt: "asc" } }),
    prisma.immunization.findMany({ where: { childId }, orderBy: { scheduled: "asc" } }),
    prisma.appointment.findMany({ where: { childId }, orderBy: { scheduledAt: "desc" } }),
  ]);

  const days = ageInDays(child.dateOfBirth, new Date());
  const sorted = [...growth].sort((a, b) => b.measuredAt.getTime() - a.measuredAt.getTime());
  const latest = sorted[0];
  const prev = sorted.find((m, i) => i > 0 && m.weightKg != null && latest?.weightKg != null);

  const assessment = assessGrowth({
    sex: child.sex === "MALE" ? "male" : child.sex === "FEMALE" ? "female" : "male",
    ageDays: days,
    weightKg: latest?.weightKg ?? null,
    lengthCm: latest?.lengthCm ?? null,
    headCircCm: latest?.headCircCm ?? null,
    prevWeightKg: prev?.weightKg ?? null,
    prevWeightAgeDays: prev ? Math.max(0, Math.round((latest?.measuredAt.getTime() - prev.measuredAt.getTime()) / 86400000)) : undefined,
  });

  const givenDoses = immunizations
    .filter((i) => i.givenAt)
    .map((i) => ({ vaccine: i.vaccine, dose: i.dose, givenAt: i.givenAt as Date }));

  const plan = computeDosePlan(child.dateOfBirth, givenDoses, new Date());

  const curves: ChildRecord["growth"]["curves"] = {};
  if (latest?.weightKg != null) curves.wfa = referenceCurves("wfa", child.sex === "MALE" ? "male" : "female", 0, Math.max(days, 180));
  if (latest?.lengthCm != null) curves.lha = referenceCurves("lha", child.sex === "MALE" ? "male" : "female", 0, Math.max(days, 180));

  return {
    child,
    guardians,
    visits,
    immunizations,
    appointments,
    growth: { measurements: growth, assessment, plan, curves },
  };
}