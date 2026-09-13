import { describe, expect, it } from 'vitest';
import {
  assessGrowth,
  computeIndicatorZ,
  plausibleRanges,
  zScoreFromLms,
  type GrowthAssessment,
  type Observation,
} from './engine';

const ok = (r: ReturnType<typeof assessGrowth>): GrowthAssessment => {
  if ('error' in r) throw new Error('unexpected error: ' + r.error);
  return r;
};

describe('zScoreFromLms', () => {
  it('returns 0 at the median (M)', () => {
    expect(zScoreFromLms(0.3487, 3.3464, 0.14602, 3.3464)).toBeCloseTo(0, 5);
  });

  it('matches the LMS formula for a known point', () => {
    // Boys weight-for-age at 6 months: L=0.1257 M=7.934 S=0.10958. 7.0 kg -> z ≈ -1.65
    const z = zScoreFromLms(0.1257, 7.934, 0.10958, 7.0);
    const expected = (Math.pow(7.0 / 7.934, 0.1257) - 1) / (0.1257 * 0.10958);
    expect(z).toBeCloseTo(expected, 10);
    expect(z).toBeLessThan(-1);
    expect(z).toBeGreaterThan(-1.3);
  });

  it('is deterministic', () => {
    const a = zScoreFromLms(0.1257, 7.934, 0.10958, 8.5);
    const b = zScoreFromLms(0.1257, 7.934, 0.10958, 8.5);
    expect(a).toBe(b);
  });

  it('rejects non-positive measurements', () => {
    expect(() => zScoreFromLms(1, 10, 0.1, 0)).toThrow(/invalid measurement/i);
  });
});

describe('computeIndicatorZ', () => {
  // ageX for age-indexed tables is completed months; for weight-for-length it is cm.
  it('boy at weight-for-age median has z ~ 0', () => {
    expect(Math.abs(computeIndicatorZ('weight-for-age', 'male', 6, 7.934))).toBeLessThan(0.05);
  });

  it('boy well below median has strongly negative z', () => {
    const z = computeIndicatorZ('weight-for-age', 'male', 6, 6.0);
    expect(z).toBeLessThan(-2.5);
  });

  it('girl differs from boy at same measurement', () => {
    const boy = computeIndicatorZ('weight-for-age', 'male', 6, 7.5);
    const girl = computeIndicatorZ('weight-for-age', 'female', 6, 7.5);
    expect(boy).not.toBe(girl);
  });

  it('length-for-age median ~ 0', () => {
    expect(Math.abs(computeIndicatorZ('length-for-age', 'male', 6, 67.6236))).toBeLessThan(0.05);
  });

  it('weight-for-length median ~ 0', () => {
    expect(Math.abs(computeIndicatorZ('weight-for-length', 'male', 67.5, 7.8526))).toBeLessThan(0.05);
  });

  it('head circumference median is ~0', () => {
    expect(Math.abs(computeIndicatorZ('head-circumference-for-age', 'male', 6, 43.3306))).toBeLessThan(0.05);
  });

  it('clamps out-of-range ages to the boundary row', () => {
    // lmsAt clamps: z at x=-5 must equal z at x=0
    expect(computeIndicatorZ('weight-for-age', 'male', -5, 3.3464)).toBeCloseTo(0, 5);
    expect(computeIndicatorZ('weight-for-age', 'male', 72, 18.295)).toBeLessThan(1);
  });

  it('throws for non-positive measurement', () => {
    expect(() => computeIndicatorZ('weight-for-length', 'male', 65, -1)).toThrow(/invalid measurement/i);
  });
});

describe('plausibleRanges', () => {
  it('rejects absurd values at known ages', () => {
    const r = plausibleRanges(6, 'male');
    expect(r.weightKg.min).toBeGreaterThan(0);
    expect(r.weightKg.min).toBeLessThan(6);
    expect(r.weightKg.max).toBeGreaterThan(10);
    expect(r.weightKg.max).toBeLessThan(30);
    expect(r.lengthCm.min).toBeGreaterThan(30);
    expect(r.lengthCm.max).toBeLessThan(120);
  });
});

describe('assessGrowth classification', () => {
  it('returns an error when there are no measurements', () => {
    const r = assessGrowth('male', '2024-01-01', []);
    expect('error' in r).toBe(true);
  });

  it('median infant at 6 months is green', () => {
    const a = ok(assessGrowth('male', '2024-01-01', [
      { date: '2024-07-01', weightKg: 7.9, lengthCm: 67.6 },
    ]));
    expect(a.light).toBe('green');
    expect(a.indicators.length).toBeGreaterThanOrEqual(3);
    expect(a.indicators.every((i) => i.inRange)).toBe(true);
  });

  it('flags a severely underweight infant as red', () => {
    const a = ok(assessGrowth('male', '2024-01-01', [
      { date: '2024-04-01', weightKg: 4.0, lengthCm: 55 },
    ]));
    expect(a.light).toBe('red');
    expect(a.indicators[0].classification).toMatch(/severe|stunt/i);
  });

  it('flags faltering growth (weight crossing centiles downward) as yellow or red', () => {
    const a = ok(assessGrowth('male', '2024-01-01', [
      { date: '2024-02-01', weightKg: 4.5, lengthCm: 54 },
      { date: '2024-05-01', weightKg: 5.0, lengthCm: 60 },
      { date: '2024-08-01', weightKg: 5.5, lengthCm: 64 },
    ]));
    expect(['yellow', 'red']).toContain(a.light);
  });

  it('computes weight velocity from two measurements', () => {
    const obs: Observation[] = [
      { date: '2024-02-01', weightKg: 3.6, lengthCm: 53 },
      { date: '2024-03-01', weightKg: 4.6, lengthCm: 55.6 },
    ];
    const a = ok(assessGrowth('male', '2024-01-01', obs));
    expect(a.velocity).toBeDefined();
    // ~1 kg over ~1 month ≈ 1000+ g/month
    expect(a.velocity!.weightGainGPerMonth).toBeGreaterThan(900);
    expect(a.velocity!.months).toBeCloseTo(0.95, 1);
    expect(a.velocity!.light).toBe('green');
  });

  it('rejects implausible weight', () => {
    const r = assessGrowth('male', '2024-01-01', [{ date: '2024-06-01', weightKg: 55, lengthCm: 65 }]);
    expect('error' in r && r.error).toMatch(/implausible/i);
  });

  it('rejects measurements before birth', () => {
    const r = assessGrowth('male', '2030-01-01', [{ date: '2024-06-01', weightKg: 9, lengthCm: 70 }]);
    expect('error' in r && r.error).toMatch(/before date of birth/i);
  });

  it('rejects ages beyond 60 months', () => {
    const r = assessGrowth('male', '2015-01-01', [{ date: '2024-06-01', weightKg: 20, heightCm: 110 }]);
    expect('error' in r && r.error).toMatch(/0-60 months/i);
  });

  it('handles missing length gracefully', () => {
    const r = assessGrowth('male', '2024-01-01', [{ date: '2024-06-01', weightKg: 8 }]);
    expect('error' in r && r.error).toMatch(/length/i);
  });

  it('is deterministic across runs', () => {
    const obs: Observation[] = [
      { date: '2024-02-01', weightKg: 4.4, lengthCm: 55 },
      { date: '2024-06-01', weightKg: 7.2, lengthCm: 64 },
    ];
    const a1 = assessGrowth('male', '2024-01-01', obs);
    const a2 = assessGrowth('male', '2024-01-01', obs);
    expect(JSON.stringify(a1)).toBe(JSON.stringify(a2));
  });
});
