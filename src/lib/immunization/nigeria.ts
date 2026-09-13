import { days, type ScheduleItem } from './schedule';

/**
 * Nigeria routine immunization schedule for children.
 * Transcribed from the WHO WIISE country profile "Nigeria - Vaccination
 * schedule" (2025 extraction). Age codes: B = at birth, W6 = 6 weeks,
 * M5 = 5 months, Y9 = 9 years.
 */
export const SCHEDULE_VERSION = 'NGA-2025.1';
export const SCHEDULE_SOURCE =
  'WHO WIISE / Nigeria National Programme on Immunization (NPHCDA)';
export const SCHEDULE_URL =
  'https://immunizationdata.who.int/global/wiise-detail-page/vaccination-schedule-for-country_name?ISO_3_CODE=NGA';
export const EFFECTIVE_DATE = '2025-01-01';

/** Stated spacing between doses of the same series in the source schedule. */
const FOUR_WEEKS = days(4);

const CATCH_UP_REVIEW =
  'Catch-up scheduling requires healthcare-worker review against current national guidance.';

function item(
  vaccineCode: string,
  vaccineName: string,
  doseLabel: string,
  doseOrder: number,
  targetAgeDays: number,
  opts: {
    dueWindowDays?: number;
    minIntervalDays?: number | null;
    catchUpNote?: string;
    requiresReview?: boolean;
    femaleOnly?: boolean;
  } = {},
): ScheduleItem {
  return {
    id: `${vaccineCode}#${doseOrder}`,
    schedule_version: SCHEDULE_VERSION,
    vaccine_code: vaccineCode,
    vaccine_name: vaccineName,
    dose_label: doseLabel,
    dose_order: doseOrder,
    target_age_days: targetAgeDays,
    due_window_days: opts.dueWindowDays ?? 14,
    min_interval_days: opts.minIntervalDays ?? null,
    applies_to: opts.femaleOnly ? 'female' : 'any',
    catch_up_note: opts.catchUpNote ?? null,
    requires_review: opts.requiresReview ?? false,
    source_name: SCHEDULE_SOURCE,
    source_url: SCHEDULE_URL,
    effective_date: EFFECTIVE_DATE,
    is_active: true,
  };
}

const PENTA = 'DTwP-Hib-HepB (pentavalent)';
const RV = 'Rotavirus';
const MALARIA = 'Malaria (RTS,S)';

/** Every routine child dose in the configured schedule. */
export const NIGERIA_CHILD_SCHEDULE: ScheduleItem[] = [
  item('BCG', 'BCG (tuberculosis)', 'Birth', 1, days('B')),
  item('HEPB_BIRTH', 'Hepatitis B', 'Birth', 1, days('B')),
  item('OPV', 'Oral polio vaccine (OPV)', 'Birth (OPV 0)', 1, days('B')),
  item('OPV', 'Oral polio vaccine (OPV)', '6 weeks', 2, days('W6'), { minIntervalDays: 28 }),
  item('OPV', 'Oral polio vaccine (OPV)', '10 weeks', 3, days('W10'), { minIntervalDays: 28 }),
  item('OPV', 'Oral polio vaccine (OPV)', '14 weeks', 4, days('W14'), { minIntervalDays: 28 }),
  item('DTWPHIBHEPB', PENTA, '6 weeks', 1, days('W6')),
  item('DTWPHIBHEPB', PENTA, '10 weeks', 2, days('W10'), { minIntervalDays: 28 }),
  item('DTWPHIBHEPB', PENTA, '14 weeks', 3, days('W14'), { minIntervalDays: 28 }),
  item('IPV', 'Inactivated polio vaccine (IPV)', '6 weeks', 1, days('W6')),
  item('IPV', 'Inactivated polio vaccine (IPV)', '14 weeks', 2, days('W14'), { minIntervalDays: 28 }),
  item('PCV10', 'Pneumococcal conjugate (PCV10)', '6 weeks', 1, days('W6')),
  item('PCV10', 'Pneumococcal conjugate (PCV10)', '10 weeks', 2, days('W10'), { minIntervalDays: 28 }),
  item('PCV10', 'Pneumococcal conjugate (PCV10)', '14 weeks', 3, days('W14'), { minIntervalDays: 28 }),
  item('ROTAVIRUS', RV, '6 weeks', 1, days('W6'), { requiresReview: true, catchUpNote: `${RV} has upper age limits for starting and completing the series. ${CATCH_UP_REVIEW}` }),
  item('ROTAVIRUS', RV, '10 weeks', 2, days('W10'), { minIntervalDays: 28, requiresReview: true, catchUpNote: `${RV} has upper age limits for starting and completing the series. ${CATCH_UP_REVIEW}` }),
  item('ROTAVIRUS', RV, '14 weeks', 3, days('W14'), { minIntervalDays: 28, requiresReview: true, catchUpNote: `${RV} has upper age limits for starting and completing the series. ${CATCH_UP_REVIEW}` }),
  item('MALARIA', MALARIA, '5 months', 1, days('M5')),
  item('MALARIA', MALARIA, '6 months', 2, days('M6'), { minIntervalDays: 28 }),
  item('MALARIA', MALARIA, '7 months', 3, days('M7'), { minIntervalDays: 28 }),
  item('MALARIA', MALARIA, '15 months', 4, days('M15'), { minIntervalDays: 28 }),
  item('VITAMINA', 'Vitamin A supplementation', '6 months', 1, days('M6')),
  item('VITAMINA', 'Vitamin A supplementation', '12 months', 2, days('M12')),
  item('MEASLES', 'Measles', '9 months', 1, days('M9')),
  item('MEASLES', 'Measles', '15 months', 2, days('M15')),
  item('MR', 'Measles-Rubella (MR)', '9 months', 1, days('M9')),
  item('MR', 'Measles-Rubella (MR)', '15 months', 2, days('M15')),
  item('MEN_A_CONJ', 'Meningococcal A conjugate', '9 months', 1, days('M9')),
  item('YF', 'Yellow fever', '9 months', 1, days('M9')),
  item('HPV', 'HPV', '9 years', 1, days('Y9'), { femaleOnly: true, requiresReview: true, catchUpNote: `Older-child catch-up dosing for HPV ${CATCH_UP_REVIEW}` }),
];
