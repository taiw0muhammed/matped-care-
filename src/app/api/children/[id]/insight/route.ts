import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedChild, logAudit, requireRole } from "@/lib/guards";
import { apiError } from "@/lib/api";
import { assessGrowth, referenceCurves } from "@/lib/growth/engine";
import { generateGrowthInsight } from "@/lib/growth/insight";
import { ageInDays } from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * AI Growth Insight — Gemini explains the trend in plain language.
 * Guardrailed: the response is labelled as supportive, never diagnostic.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{  id: string  }> },
) {
  const {id} = await params;
  try {
    const user = await requireRole("NURSE", "ADMIN");
    const child = await getAuthorizedChild(id, user);
    if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const measurements = await prisma.growthMeasurement.findMany({
      where: { childId: child.id },
      orderBy: { measuredAt: "asc" },
    });
    if (measurements.length === 0) {
      return NextResponse.json(
        { error: "No growth measurements yet — record a measurement first." },
        { status: 400 },
      );
    }
    const latest = measurements[measurements.length - 1];
    const prev = measurements.length > 1 ? measurements[measurements.length - 2] : null;

    const now = new Date();
    const days = ageInDays(child.dateOfBirth, now);
    const assessment = assessGrowth({
      sex: child.sex === "MALE" ? "male" : "female",
      ageDays: days,
      weightKg: latest.weightKg ?? null,
      lengthCm: latest.lengthCm ?? null,
      headCircCm: latest.headCircCm ?? null,
      prevWeightKg: prev?.weightKg ?? null,
      prevWeightAgeDays:
        prev && latest.measuredAt > prev.measuredAt
          ? Math.max(0, Math.round((latest.measuredAt.getTime() - prev.measuredAt.getTime()) / 86400000))
          : undefined,
    });

    const insight = await generateGrowthInsight({
      sex: child.sex === "MALE" ? "male" : "female",
      ageDays: days,
      weightKg: latest.weightKg ?? 0,
      lengthCm: latest.lengthCm ?? 0,
      headCircCm: latest.headCircCm ?? 0,
      assessment,
      prevWeightKg: prev?.weightKg ?? null,
      prevWeightAgeDays:
        prev && latest.measuredAt > prev.measuredAt
          ? Math.max(0, Math.round((latest.measuredAt.getTime() - prev.measuredAt.getTime()) / 86400000))
          : null,
    });

    await logAudit(user.id, child.id, "INSIGHT_GENERATED", { status: assessment.status, provider: insight.provider });
    return NextResponse.json({
      insight,
      assessment,
      curves: {
        wfa: referenceCurves("wfa", child.sex === "MALE" ? "male" : "female", 0, Math.max(days, 30)),
        lha: referenceCurves("lha", child.sex === "MALE" ? "male" : "female", 0, Math.max(days, 30)),
      },
    });
  } catch (e) {
    return apiError(e);
  }
}