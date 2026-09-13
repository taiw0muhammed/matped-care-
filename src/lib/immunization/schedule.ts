/**
 * Nigerian routine immunization schedule (Federal Ministry of Health,
 * Expanded Programme on Immunization) aligned with WHO guidance.
 *
 * Doses are expressed at a target age in weeks from birth (9 months = 39
 * weeks, 15 months = 65 weeks, 18 months = 78 weeks). Catch-up is handled by
 * the engine, which re-bases a series on the last dose actually given.
 */

export interface DoseDefinition {
  vaccine: string;
  dose: number;
  targetWeeks: number;
  name: string;
  route: string;
  site: string;
  notes?: string;
}

export interface VaccineSeries {
  vaccine: string;
  fullName: string;
  doses: number[];
}

export const NIGERIA_SCHEDULE: DoseDefinition[] = [
  // At birth
  { vaccine: "BCG", dose: 1, targetWeeks: 0, name: "BCG (tuberculosis)", route: "Intradermal", site: "Left upper arm", notes: "Given at birth." },
  { vaccine: "OPV", dose: 0, targetWeeks: 0, name: "OPV-0 (polio birth dose)", route: "Oral", site: "Mouth" },

  // 6 weeks
  { vaccine: "OPV", dose: 1, targetWeeks: 6, name: "OPV-1 (polio)", route: "Oral", site: "Mouth" },
  { vaccine: "PENT", dose: 1, targetWeeks: 6, name: "Pentavalent-1 (diphtheria, tetanus, pertussis, Hep B, Hib)", route: "Intramuscular", site: "Left thigh" },
  { vaccine: "PCV", dose: 1, targetWeeks: 6, name: "PCV-1 (pneumococcal)", route: "Intramuscular", site: "Right thigh" },

  // 10 weeks
  { vaccine: "OPV", dose: 2, targetWeeks: 10, name: "OPV-2 (polio)", route: "Oral", site: "Mouth" },
  { vaccine: "PENT", dose: 2, targetWeeks: 10, name: "Pentavalent-2", route: "Intramuscular", site: "Left thigh" },
  { vaccine: "PCV", dose: 2, targetWeeks: 10, name: "PCV-2 (pneumococcal)", route: "Intramuscular", site: "Right thigh" },

  // 14 weeks
  { vaccine: "OPV", dose: 3, targetWeeks: 14, name: "OPV-3 (polio)", route: "Oral", site: "Mouth" },
  { vaccine: "PENT", dose: 3, targetWeeks: 14, name: "Pentavalent-3", route: "Intramuscular", site: "Left thigh" },
  { vaccine: "PCV", dose: 3, targetWeeks: 14, name: "PCV-3 (pneumococcal)", route: "Intramuscular", site: "Right thigh" },

  // 9 months
  { vaccine: "MR", dose: 1, targetWeeks: 39, name: "MR-1 (measles-rubella)", route: "Subcutaneous", site: "Upper arm" },

  // 15 months
  { vaccine: "OPV", dose: 4, targetWeeks: 65, name: "OPV booster (polio)", route: "Oral", site: "Mouth", notes: "Booster dose." },

  // 18 months
  { vaccine: "PENT", dose: 4, targetWeeks: 78, name: "Pentavalent booster", route: "Intramuscular", site: "Upper arm", notes: "Booster dose." },
  { vaccine: "PCV", dose: 4, targetWeeks: 78, name: "PCV booster (pneumococcal)", route: "Intramuscular", site: "Upper arm", notes: "Booster dose." },
  { vaccine: "MR", dose: 2, targetWeeks: 78, name: "MR-2 (measles-rubella) — during campaign/MEC", route: "Subcutaneous", site: "Upper arm", notes: "Often delivered during national measles campaigns." },
];

export const VACCINE_META: Record<string, VaccineSeries> = {
  BCG: { vaccine: "BCG", fullName: "Bacillus Calmette-Guérin (tuberculosis)", doses: [1] },
  OPV: { vaccine: "OPV", fullName: "Oral Poliovirus Vaccine", doses: [0, 1, 2, 3, 4] },
  PENT: { vaccine: "PENT", fullName: "Pentavalent (DTaP-HepB-Hib)", doses: [1, 2, 3, 4] },
  PCV: { vaccine: "PCV", fullName: "Pneumococcal Conjugate Vaccine", doses: [1, 2, 3, 4] },
  MR: { vaccine: "MR", fullName: "Measles-Rubella", doses: [1, 2] },
};

/**
 * Minimum safe interval (days) between consecutive doses of the same series.
 * Used by the catch-up logic; WHO allows doses as early as 4 weeks apart for
 * most inactivated series.
 */
export const MIN_INTERVAL_DAYS: Record<string, number> = {
  BCG: 0,
  OPV: 28,
  PENT: 28,
  PCV: 28,
  MR: 90,
};

export function dosesForVaccine(vaccine: string): DoseDefinition[] {
  return NIGERIA_SCHEDULE.filter((d) => d.vaccine === vaccine);
}