import {
  WFA_BOYS,
  WFA_GIRLS,
  LHFA_BOYS,
  LHFA_GIRLS,
  BFA_BOYS,
  BFA_GIRLS,
  HCFA_BOYS,
  HCFA_GIRLS,
  WFL_BOYS,
  WFL_GIRLS,
  WFH_BOYS,
  WFH_GIRLS,
} from "./data";
import { lookupLms, lmsToZScore, zScoreToPercentile, zScoreToValue } from "./lms";
import type { LmsTable } from "./types";

export type Sex = "male" | "female";

export type GrowthStatus = "GREEN" | "YELLOW" | "RED";

export interface IndicatorResult {
  key: string;
  label: string;
  zScore: number;
  percentile: number;
  median: number;
  clamped: boolean;
  band: "severe" | "moderate" | "normal" | "high" | "very_high";
}

export interface AssessmentInput {
  sex: Sex;
  /** age in days */
  ageDays: number;
  weightKg?: number | null;
  lengthCm?: number | null;
  headCircCm?: number | null;
  /** previous weight (kg) and its age, for velocity flags */
  prevWeightKg?: number | null;
  prevWeightAgeDays?: number | null;
}

export interface Assessment {
  indicators: IndicatorResult[];
  status: GrowthStatus;
  flags: string[];
  summary: string;
}

function sexTable(sex: Sex, boys: LmsTable, girls: LmsTable): LmsTable {
  return sex === "male" ? boys : girls;
}

function evalIndicator(
  key: string,
  label: string,
  table: LmsTable,
  x: number,
  value: number,
  bandMode: "under" | "both" = "under",
): IndicatorResult {
  const { l, m, s, x: usedX, clamped } = lookupLms(table, x, { clamp: true });
  const z = lmsToZScore(value, l, m, s);
  const percentile = zScoreToPercentile(z);
  let band: IndicatorResult["band"];
  if (bandMode === "under") {
    if (z <= -3) band = "severe";
    else if (z < -2) band = "moderate";
    else band = "normal";
  } else {
    if (z < -3) band = "severe";
    else if (z < -2) band = "moderate";
    else if (z <= 2) band = "normal";
    else if (z <= 3) band = "high";
    else band = "very_high";
  }
  return { key, label, zScore: round1(z), percentile: Math.round(percentile), median: round2(m), clamped, band };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * WHO Child Growth Standards (2006) assessment of a single measurement set.
 *
 * Rules (validations from WHO standards, not raw trends):
 * - RED: any severe result (z <= -3) or BMI-for-age z >= +3 (obesity) —
 *   may require further clinical assessment.
 * - YELLOW: any moderate result (-3 < z < -2) or BMI z in (2, 3) (overweight)
 *   — growth pattern needs monitoring.
 * - GREEN: all indicators within normal range.
 */
export function assessGrowth(input: AssessmentInput): Assessment {
  const indicators: IndicatorResult[] = [];
  const flags: string[] = [];
  const days = Math.max(0, input.ageDays);
  const sex = input.sex;

  if (input.weightKg != null && input.weightKg > 0) {
    indicators.push(
      evalIndicator(
        "wfa",
        "Weight for age",
        sexTable(sex, WFA_BOYS, WFA_GIRLS),
        days,
        input.weightKg,
      ),
    );
  }

  if (input.lengthCm != null && input.lengthCm > 0) {
    indicators.push(
      evalIndicator(
        "lha",
        "Length/height for age",
        sexTable(sex, LHFA_BOYS, LHFA_GIRLS),
        days,
        input.lengthCm,
      ),
    );
    // Wasting indicator: weight-for-length under 2 years, weight-for-height at/over 2.
    if (input.weightKg != null && input.weightKg > 0) {
      const underTwo = days < 730;
      if (underTwo) {
        const t = sexTable(sex, WFL_BOYS, WFL_GIRLS);
        if (input.lengthCm >= t.start && input.lengthCm <= t.start + t.step * (t.lms.length - 1)) {
          indicators.push(
            evalIndicator(
              "wfl",
              "Weight for length",
              t,
              input.lengthCm,
              input.weightKg,
            ),
          );
        }
      } else {
        const t = sexTable(sex, WFH_BOYS, WFH_GIRLS);
        if (input.lengthCm >= t.start && input.lengthCm <= t.start + t.step * (t.lms.length - 1)) {
          indicators.push(
            evalIndicator(
              "wfh",
              "Weight for height",
              t,
              input.lengthCm,
              input.weightKg,
            ),
          );
        }
      }
    }
  }

  if (input.headCircCm != null && input.headCircCm > 0) {
    indicators.push(
      evalIndicator("hcfa", "Head circumference for age", sexTable(sex, HCFA_BOYS, HCFA_GIRLS), days, input.headCircCm),
    );
  }

  // BMI-for-age (needs both weight and length)
  if (input.weightKg != null && input.lengthCm != null && input.weightKg > 0 && input.lengthCm > 0) {
    const bmi = input.weightKg / Math.pow(input.lengthCm / 100, 2);
    if (bmi > 0 && bmi < 60) {
      indicators.push(
        evalIndicator(
          "bfa",
          "BMI for age",
          sexTable(sex, BFA_BOYS, BFA_GIRLS),
          days,
          bmi,
          "both",
        ),
      );
    }
  }

  // Weight velocity flag (supporting signal, not diagnostic by itself)
  if (
    input.prevWeightKg != null &&
    input.weightKg != null &&
    input.prevWeightKg > 0 &&
    input.prevWeightAgeDays != null &&
    days > input.prevWeightAgeDays
  ) {
    const dDays = days - input.prevWeightAgeDays;
    if (dDays >= 7) {
      const gPerWeek = ((input.weightKg - input.prevWeightKg) * 1000) / (dDays / 7);
      const expectedMid = days < 182 ? 140 : 50; // approx g/week medians 0-6mo vs 6-12mo
      if (gPerWeek < -30 && days < 365) {
        flags.push("Rapid weight loss since last measurement");
      } else if (gPerWeek < -expectedMid * 0.5 && dDays >= 28 && days < 730) {
        flags.push("Weight gain slower than expected for age");
      }
    }
  }

  let status: GrowthStatus = "GREEN";
  if (indicators.some((i) => i.band === "severe") || indicators.some((i) => i.key === "bfa" && i.band === "very_high")) {
    status = "RED";
  } else if (
    indicators.some((i) => i.band === "moderate") ||
    indicators.some((i) => i.key === "bfa" && i.band === "high")
  ) {
    status = "YELLOW";
  }

  const words: Record<GrowthStatus, string> = {
    GREEN: "Growth pattern appears appropriate",
    YELLOW: "Growth pattern needs monitoring",
    RED: "Growth pattern may require further clinical assessment",
  };
  const worst = indicators.reduce<IndicatorResult | null>((acc, i) => {
    if (!acc) return i;
    const rank: Record<string, number> = { severe: 0, very_high: 0, moderate: 1, high: 1, normal: 2 };
    return rank[i.band] < rank[acc.band] ? i : acc;
  }, null);

  const summary = worst
    ? `${words[status]}. Strongest signal: ${worst.label.toLowerCase()} at z=${worst.zScore} (≈${worst.percentile}th percentile).`
    : "No growth measurements yet.";

  return { indicators, status, flags, summary };
}

/** Build WHO reference curve values (z = -3, -2, -1, 0, 1, 2, 3) for charting. */
export function referenceCurves(
  indicator: "wfa" | "lha" | "hcfa" | "bfa",
  sex: Sex,
  ageDaysStart: number,
  ageDaysEnd: number,
  points = 24,
) {
  const table =
    indicator === "wfa"
      ? sexTable(sex, WFA_BOYS, WFA_GIRLS)
      : indicator === "lha"
        ? sexTable(sex, LHFA_BOYS, LHFA_GIRLS)
        : indicator === "hcfa"
          ? sexTable(sex, HCFA_BOYS, HCFA_GIRLS)
          : sexTable(sex, BFA_BOYS, BFA_GIRLS);
  const curves: Record<string, number[]> = { "-3": [], "-2": [], "-1": [], "0": [], "1": [], "2": [], "3": [] };
  for (let i = 0; i <= points; i++) {
    const x = ageDaysStart + ((ageDaysEnd - ageDaysStart) * i) / points;
    for (const z of ["-3", "-2", "-1", "0", "1", "2", "3"]) {
      const { l, m, s } = lookupLms(table, x, { clamp: true });
      curves[z].push(round2(zScoreToValue(Number(z), l, m, s)));
    }
  }
  return curves;
}