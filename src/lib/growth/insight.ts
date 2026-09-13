import type { Assessment } from "./engine";

export interface InsightInput {
  sex: "male" | "female";
  ageDays: number;
  weightKg: number;
  lengthCm: number;
  headCircCm: number;
  assessment: Assessment;
  prevWeightKg: number | null;
  prevWeightAgeDays: number | null;
}

export interface GrowthInsight {
  text: string;
  provider: "gemini" | "fallback";
  disclaimer: string;
}

const DISCLAIMER =
  "This is an automated, supportive insight for care workers and parents. It is not a medical diagnosis. Any RED or YELLOW status should be reviewed by a qualified clinician.";

/**
 * Generate a plain-language, non-diagnostic explanation of the child's
 * growth trend using the Gemini API. Falls back to a deterministic
 * template when the API is unavailable so the feature never blocks.
 */
export async function generateGrowthInsight(input: InsightInput): Promise<GrowthInsight> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const prompt = buildPrompt(input);
      const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
            safetySettings: [
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
            ],
          }),
          signal: AbortSignal.timeout(15000),
        },
      );
      if (res.ok) {
        const data: any = await res.json();
        const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim()) {
          return { text: text.trim(), provider: "gemini", disclaimer: DISCLAIMER };
        }
      }
    } catch {
      // fall through to deterministic fallback
    }
  }
  return { text: fallbackInsight(input), provider: "fallback", disclaimer: DISCLAIMER };
}

function buildPrompt(input: InsightInput): string {
  const a = input.assessment;
  return [
    "You are the AI Growth Insight assistant inside MatPed Care, a Nigerian child immunization and growth-monitoring platform.",
    "Explain the child's growth trend in 2-4 short, warm, plain-English paragraphs for a nurse or parent.",
    "Rules: do NOT diagnose any condition, do NOT prescribe treatment, do NOT use alarming language. Frame everything as patterns that support or need monitoring by a clinician.",
    "",
    `Child: ${input.sex}, ${Math.round(input.ageDays / 30.44)} months old.`,
    `Latest: weight ${input.weightKg.toFixed(2)} kg, length ${input.lengthCm.toFixed(1)} cm, head circumference ${input.headCircCm.toFixed(1)} cm.`,
    `Previous weight: ${input.prevWeightKg ? `${input.prevWeightKg.toFixed(2)} kg at ${Math.round((input.prevWeightAgeDays ?? 0) / 30.44)} months` : "none"}.`,
    `WHO assessment status: ${a.status} (GREEN = appropriate, YELLOW = monitor, RED = may need clinical review).`,
    `Indicator z-scores: ${a.indicators.map((i) => `${i.label} z=${i.zScore.toFixed(2)} (p${Math.round(i.percentile)})`).join(", ")}.`,
    `Flags: ${a.flags.join("; ") || "none"}.`,
    a.summary,
    "",
    "Respond with the insight text only, no preamble.",
  ].join("\n");
}

function fallbackInsight(input: InsightInput): string {
  const a = input.assessment;
  const months = Math.max(0, Math.round(input.ageDays / 30.44));
  const parts: string[] = [];

  if (a.status === "GREEN") {
    parts.push(`This child's growth pattern appears appropriate for their age and sex. Weight, length and head circumference are tracking within the WHO reference ranges at ${months} months.`);
  } else if (a.status === "YELLOW") {
    parts.push(`This child's growth pattern is worth monitoring. One or more measurements are approaching the reference limits, so the trend should be re-checked at the next visit.`);
  } else {
    parts.push(`This child's growth pattern may require further clinical assessment. One or more measurements fall beyond the WHO reference limits, so a clinician should review the child at the earliest opportunity.`);
  }

  if (input.prevWeightKg && input.prevWeightAgeDays != null) {
    const dDays = Math.max(0, input.ageDays - input.prevWeightAgeDays);
    const delta = input.weightKg - input.prevWeightKg;
    if (dDays > 0) {
      const rateKgMonth = (delta / dDays) * 30.44;
      if (delta > 0) {
        parts.push(`Weight has increased by ${delta.toFixed(2)} kg over the last ${Math.round(dDays)} days (about ${rateKgMonth.toFixed(2)} kg/month), a positive trend that supports continued routine follow-up.`);
      } else if (delta < 0) {
        parts.push(`Weight has decreased by ${Math.abs(delta).toFixed(2)} kg over the last ${Math.round(dDays)} days. A falling weight trend is a signal that needs prompt clinical review, particularly in young children.`);
      }
    }
  }

  if (a.flags.length > 0) {
    parts.push(`Clinical flags to note: ${a.flags.join("; ")}.`);
  }

  parts.push(`As with all MatPed Care insights, this is supportive context for the care team, not a diagnosis. ${DISCLAIMER}`);
  return parts.join(" ");
}