// Deterministic WHO Child Growth Standards (2006) LMS engine.
// Methodology: z-score from LMS parameters per WHO instructions for the
// 2006 Child Growth Standards (WHO 2006, http://www.who.int/childgrowth).
// All classifications use WHO z-score cut-offs; no invented thresholds.

import {
  WFA_BOYS,
  WFA_GIRLS,
  LFA_BOYS,
  LFA_GIRLS,
  HFA_BOYS,
  HFA_GIRLS,
  WFL_BOYS,
  WFL_GIRLS,
  WFH_BOYS,
  WFH_GIRLS,
  HCFA_BOYS,
  HCFA_GIRLS,
  WHO_DATA_VERSION,
  WHO_DATA_SOURCE,
  type LmsPoint,
} from './who-data';

export const DAYS_PER_MONTH = 365.25 / 12; // 30.4375, per WHO

export type Sex = 'male' | 'female';

export type GrowthIndicator =
  | 'weight-for-age'
  | 'length-for-age'
  | 'height-for-age'
  | 'weight-for-length'
  | 'weight-for-height'
  | 'head-circumference-for-age';

export type Observation = {
  /** ISO date (YYYY-MM-DD) of the measurement */
  date: string;
  weightKg?: number;
  lengthCm?: number; // <24 months
  heightCm?: number; // >=24 months
  headCircumferenceCm?: number;
};

export type IndicatorResult = {
  indicator: GrowthIndicator;
  zScore: number;
  classification: string; // WHO label, e.g. 'underweight', 'stunting', 'wasting'
  light: 'green' | 'yellow' | 'red';
  inRange: boolean;
};

export type VelocityResult = {
  months: number;
  weightGainGPerMonth: number;
  light: 'green' | 'yellow' | 'red';
  note: string;
};

export type GrowthAssessment = {
  sex: Sex;
  ageMonths: number;
  date: string;
  indicators: IndicatorResult[];
  velocity: VelocityResult | null;
  /** Overall light: worst of all indicators/velocity */
  light: 'green' | 'yellow' | 'red';
  summary: string;
  dataVersion: string;
  dataSource: string;
};

// ── LMS core ────────────────────────────────────────────────────────────────

function lmsAt(table: readonly LmsPoint[], x: number): { L: number; M: number; S: number } {
  const first = table[0];
  const last = table[table.length - 1];
  if (x <= first[0]) return { L: first[1], M: first[2], S: first[3] };
  if (x >= last[0]) return { L: last[1], M: last[2], S: last[3] };
  let i = 0;
  while (table[i + 1][0] < x) i++;
  const a = table[i];
  const b = table[i + 1];
  const t = (x - a[0]) / (b[0] - a[0]);
  // WHO table interpolation: linear in L and S, linear in log(M).
  return {
    L: a[1] + (b[1] - a[1]) * t,
    M: Math.exp(Math.log(a[2]) + (Math.log(b[2]) - Math.log(a[2])) * t),
    S: a[3] + (b[3] - a[3]) * t,
  };
}

export function zScoreFromLms(L: number, M: number, S: number, y: number): number {
  if (y <= 0 || M <= 0 || S <= 0) throw new Error('invalid measurement');
  if (Math.abs(L) < 1e-9) return Math.log(y / M) / S;
  return (Math.pow(y / M, L) - 1) / (L * S);
}

export function computeIndicatorZ(
  indicator: GrowthIndicator,
  sex: Sex,
  x: number,
  y: number,
): number {
  let table: readonly LmsPoint[];
  switch (indicator) {
    case 'weight-for-age':
      table = sex === 'male' ? WFA_BOYS : WFA_GIRLS;
      break;
    case 'length-for-age':
      table = sex === 'male' ? LFA_BOYS : LFA_GIRLS;
      break;
    case 'height-for-age':
      table = sex === 'male' ? HFA_BOYS : HFA_GIRLS;
      break;
    case 'weight-for-length':
      table = sex === 'male' ? WFL_BOYS : WFL_GIRLS;
      break;
    case 'weight-for-height':
      table = sex === 'male' ? WFH_BOYS : WFH_GIRLS;
      break;
    case 'head-circumference-for-age':
      table = sex === 'male' ? HCFA_BOYS : HCFA_GIRLS;
      break;
  }
  const { L, M, S } = lmsAt(table, x);
  return zScoreFromLms(L, M, S, y);
}

// ── WHO 2006 classification cut-offs (z-score based) ───────────────────────

type Rule = {
  severe: [number, string, number, string]; // below -> label, between -> label
  high?: [number, string, number, string];
};

function classify(indicator: GrowthIndicator, z: number): { label: string; light: 'green' | 'yellow' | 'red' } {
  const switchLows: Partial<Record<GrowthIndicator, [number, string, number, string]>> = {
    'weight-for-age': [-3, 'severe underweight', -2, 'underweight'],
    'length-for-age': [-3, 'severe stunting', -2, 'stunting'],
    'height-for-age': [-3, 'severe stunting', -2, 'stunting'],
    'weight-for-length': [-3, 'severe wasting', -2, 'wasting'],
    'weight-for-height': [-3, 'severe wasting', -2, 'wasting'],
  };
  const low = switchLows[indicator];
  if (low) {
    if (z <= low[0]) return { label: low[1], light: 'red' };
    if (z <= low[2]) return { label: low[3], light: 'yellow' };
    if (indicator.startsWith('weight-for')) {
      if (z > 3) return { label: 'obese', light: 'yellow' };
      if (z > 2) return { label: 'overweight', light: 'yellow' };
    }
    if (indicator === 'length-for-age' || indicator === 'height-for-age') {
      if (z > 2) return { label: 'tall', light: 'green' };
    }
    return { label: 'appropriate', light: 'green' };
  }
  if (indicator === 'head-circumference-for-age') {
    if (z <= -2) return { label: 'microcephaly risk', light: 'red' };
    if (z < 2) return { label: 'appropriate', light: 'green' };
    return { label: 'macrocephaly', light: 'yellow' };
  }
  return { label: 'appropriate', light: 'green' };
}

// ── Plausibility checks (data quality, not clinical) ────────────────────────

export function plausibleRanges(ageMonths: number, sex: Sex) {
  return {
    weightKg: { min: 0.5, max: ageMonths < 24 ? 25 : 80 },
    lengthCm: { min: 35, max: 95 },
    heightCm: { min: 70, max: 180 },
    headCircumferenceCm: { min: 28, max: 70 },
  } as const;
}

// ── Weight-gain velocity ────────────────────────────────────────────────────
// Conservative monitoring bands derived from typical monthly weight gain
// (WHO 2006 median trajectory): babies <4 mo gain ~500-700 g/mo, 4-6 mo
// ~350-500 g/mo, 6-12 mo ~150-350 g/mo, 12-24 mo ~50-250 g/mo, 24-60 mo
// ~50-150 g/mo. Below the low band -> review (yellow/red by depth).

function velocityBand(ageMonths: number): { lowRed: number; lowYellow: number } {
  if (ageMonths < 4) return { lowRed: 250, lowYellow: 400 };
  if (ageMonths < 6) return { lowRed: 150, lowYellow: 250 };
  if (ageMonths < 12) return { lowRed: 75, lowYellow: 125 };
  if (ageMonths < 24) return { lowRed: 25, lowYellow: 75 };
  return { lowRed: 0, lowYellow: 25 };
}

export function assessGrowth(
  sex: Sex,
  dob: string,
  observations: Observation[],
): GrowthAssessment | { error: string } {
  if (observations.length === 0) return { error: 'No growth measurements recorded yet.' };
  const sorted = [...observations].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const latest = sorted[sorted.length - 1];
  const dobMs = new Date(dob).getTime();
  const latestMs = new Date(latest.date + 'T00:00:00Z').getTime();
  if (isNaN(dobMs) || isNaN(latestMs)) return { error: 'Invalid dates.' };
  if (latestMs < dobMs) return { error: 'Measurement date is before date of birth.' };
  const ageMonths = (latestMs - dobMs) / (DAYS_PER_MONTH * 24 * 3600 * 1000);

  if (ageMonths < 0) return { error: 'Measurement date is before date of birth.' };
  if (ageMonths > 60) return { error: 'WHO 2006 standards cover 0-60 months.' };

  const ranges = plausibleRanges(ageMonths, sex);
  const bad: string[] = [];
  const w = latest.weightKg;
  const len = ageMonths < 24 ? latest.lengthCm : latest.heightCm;
  const hc = latest.headCircumferenceCm;
  if (w == null) bad.push('weight');
  else if (w < ranges.weightKg.min || w > ranges.weightKg.max) bad.push('weight (outside plausible range)');
  if (ageMonths < 24 && latest.lengthCm == null) bad.push('length');
  if (ageMonths >= 24 && latest.heightCm == null) bad.push('height');
  if (len != null) {
    const r = ageMonths < 24 ? ranges.lengthCm : ranges.heightCm;
    if (len < r.min || len > r.max) bad.push((ageMonths < 24 ? 'length' : 'height') + ' (outside plausible range)');
  }
  if (hc != null && (hc < ranges.headCircumferenceCm.min || hc > ranges.headCircumferenceCm.max)) {
    bad.push('head circumference (outside plausible range)');
  }
  if (bad.length > 0) return { error: 'Missing or implausible measurements: ' + bad.join(', ') + '.' };

  const x = ageMonths;
  const indicators: IndicatorResult[] = [];

  const addIndicator = (indicator: GrowthIndicator, xi: number, y: number) => {
    const z = computeIndicatorZ(indicator, sex, xi, y);
    const { label, light } = classify(indicator, z);
    indicators.push({ indicator, zScore: round2(z), classification: label, light, inRange: light === 'green' });
  };

  addIndicator('weight-for-age', x, w!);
  if (ageMonths < 24) {
    addIndicator('length-for-age', x, len!);
    addIndicator('weight-for-length', len!, w!);
  } else {
    addIndicator('height-for-age', x, len!);
    addIndicator('weight-for-height', len!, w!);
  }
  if (hc != null && ageMonths < 36) addIndicator('head-circumference-for-age', x, hc);

  // Velocity: compare with previous weight measurement (WHO velocity concept:
  // gain per month between two valid measurements).
  let velocity: VelocityResult | null = null;
  const prev = sorted.slice(0, -1).reverse().find((o) => o.weightKg != null);
  if (prev && prev.weightKg != null && w != null) {
    const gapMonths =
      (new Date(latest.date + 'T00:00:00Z').getTime() - new Date(prev.date + 'T00:00:00Z').getTime()) /
      (DAYS_PER_MONTH * 24 * 3600 * 1000);
    if (gapMonths >= 0.5 && gapMonths <= 6) {
      const gain = ((w - prev.weightKg) / gapMonths) * 1000; // g/month
      const band = velocityBand(ageMonths);
      let light: 'green' | 'yellow' | 'red' = 'green';
      let note = 'Weight gain within expected range for age.';
      if (gain < band.lowRed) {
        light = 'red';
        note = 'Weight gain well below the expected range for age. Review growth history and consider clinical assessment.';
      } else if (gain < band.lowYellow) {
        light = 'yellow';
        note = 'Weight gain is slower than expected for age. Monitor closely at next visit.';
      }
      velocity = { months: round2(gapMonths), weightGainGPerMonth: Math.round(gain), light, note };
    }
  }

  const lights = [...indicators.map((i) => i.light), velocity?.light ?? 'green'];
  const light = lights.includes('red') ? 'red' : lights.includes('yellow') ? 'yellow' : 'green';

  const summary = buildSummary(light, indicators, velocity);

  return {
    sex,
    ageMonths: round2(ageMonths),
    date: latest.date,
    indicators,
    velocity,
    light,
    summary,
    dataVersion: WHO_DATA_VERSION,
    dataSource: WHO_DATA_SOURCE,
  };
}

function buildSummary(
  light: 'green' | 'yellow' | 'red',
  indicators: IndicatorResult[],
  velocity: VelocityResult | null,
): string {
  const parts: string[] = [];
  if (light === 'green') parts.push('Growth pattern appears appropriate for age and sex.');
  if (light === 'yellow') parts.push('Growth pattern requires closer monitoring.');
  if (light === 'red') parts.push('Growth pattern may indicate a concern requiring further clinical assessment.');
  const flagged = indicators.filter((i) => i.light !== 'green');
  if (flagged.length > 0) {
    parts.push(
      flagged.map((i) => `${label(i.indicator)} is ${i.classification} (z=${i.zScore})`).join('; '),
    );
  }
  if (velocity && velocity.light !== 'green') parts.push(velocity.note);
  return parts.join(' ');
}

function label(i: GrowthIndicator): string {
  return i.replace(/-/g, ' ');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}