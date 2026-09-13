/**
 * Immunization schedule types and pure helpers.
 *
 * Mirrors the `public.immunization_schedule` table so the same shape can come
 * from the database (configurable) or from the bundled Nigeria reference data.
 */

/** Doses that only apply to one sex are filtered out for the other sex. */
export type ScheduleSex = 'any' | 'male' | 'female';

export type ScheduleItem = {
  id?: string;
  schedule_version: string;
  vaccine_code: string;
  vaccine_name: string;
  dose_label: string;
  /** 1-based position inside the vaccine series. */
  dose_order: number;
  /** Recommended age at administration, in days of life. */
  target_age_days: number;
  /** Grace window after the target age before a dose is called overdue. */
  due_window_days: number;
  /** Minimum interval (days) after the previous dose in the same series. */
  min_interval_days: number | null;
  applies_to: ScheduleSex;
  catch_up_note: string | null;
  /** True when catch-up timing needs a healthcare worker's judgement. */
  requires_review: boolean;
  source_name: string;
  source_url: string | null;
  effective_date: string;
  is_active: boolean;
};

export type DoseStatus =
  | 'completed'
  | 'due_today'
  | 'due_soon'
  | 'overdue'
  | 'upcoming'
  | 'review_required';

export type RecordedDose = {
  vaccine_code: string;
  dose_label: string;
  administered_on: string; // ISO date
  status: 'completed' | 'deferred' | 'contraindicated';
  given_by?: string | null;
  facility_id?: string | null;
  notes?: string | null;
};

export type TimelineItem = {
  vaccineCode: string;
  vaccineName: string;
  doseLabel: string;
  doseOrder: number;
  targetAgeDays: number;
  /** Calendar date this dose is expected. */
  dueOn: string;
  status: DoseStatus;
  /** Days until due (negative = overdue by N days). */
  daysUntilDue: number;
  administeredOn: string | null;
  /** Set when the due date was pushed by a minimum-interval rule. */
  intervalAdjusted: boolean;
  /** Catch-up/deferred doses that must be interpreted by a clinician. */
  requiresReview: boolean;
  reviewNote: string | null;
  isNext: boolean;
};

export const MS_PER_DAY = 86_400_000;

/** Parse `YYYY-MM-DD` as a *calendar* date (UTC-anchored, no TZ drift). */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return toIso(new Date(parseDate(iso).getTime() + days * MS_PER_DAY));
}

/** Whole days from `a` to `b` (b - a); negative when b is in the past. */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / MS_PER_DAY);
}

/** Age in completed days for a date of birth, on a given reference date. */
export function ageInDays(dateOfBirth: string, on: string): number {
  return daysBetween(dateOfBirth, on);
}

/** Convert an age code to days of life: 'B' = 0, 'W6' = 6 weeks, 'M5' = 5 months, 'Y9' = 9 years. A number means weeks. */
export function days(code: string | number): number {
  if (typeof code === 'number') return code * 7;
  const m = /^([A-Z]+)(\d+)$/.exec(code.trim());
  if (!m) return 0;
  const unit = m[1];
  const n = parseInt(m[2], 10);
  switch (unit) {
    case 'B':
      return 0;
    case 'W':
      return n * 7;
    case 'M':
      return Math.round(n * 30.4375);
    case 'Y':
      return Math.round(n * 365.25);
    default:
      return n;
  }
}

/** Human age string, e.g. `6 weeks`, `9 months`, `2 years 3 months`. */
export function formatAge(totalDays: number): string {
  if (totalDays < 0) return 'not yet born';
  if (totalDays < 14) return `${totalDays} day${totalDays === 1 ? '' : 's'}`;
  const days = Math.floor(totalDays / 7);
  if (days < 24) return `${days} week${days === 1 ? '' : 's'}`;
  const months = Math.floor(totalDays / 30.4375);
  if (months < 24) return `${months} month${months === 1 ? '' : 's'}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem === 0 ? `${years} year${years === 1 ? '' : 's'}` : `${years}y ${rem}m`;
}

/** Sort key so timelines read chronologically, then by series order. */
export function scheduleSort(a: ScheduleItem, b: ScheduleItem): number {
  return (
    a.target_age_days - b.target_age_days ||
    a.vaccine_code.localeCompare(b.vaccine_code) ||
    a.dose_order - b.dose_order
  );
}

export function sortSchedule(items: ScheduleItem[]): ScheduleItem[] {
  return [...items].sort(scheduleSort);
}

/** Only the items that apply to a child (sex-specific vaccines, active rows). */
export function applicableItems(items: ScheduleItem[], sex: 'male' | 'female'): ScheduleItem[] {
  return sortSchedule(
    items.filter((i) => i.is_active && (i.applies_to === 'any' || i.applies_to === sex)),
  );
}
