import { addDays, daysBetween, type ScheduleItem } from './schedule';

/** Doses landing within this window from today are flagged `due_soon`. */
export const DEFAULT_DUE_SOON_WINDOW_DAYS = 14;

export type DoseStatus =
  | 'completed'
  | 'due_today'
  | 'due_soon'
  | 'overdue'
  | 'upcoming'
  | 'not_applicable';

export interface RecordedDose {
  vaccineCode: string;
  doseLabel: string;
  administeredOn: string;
  facilityId?: string | null;
  recordedBy?: string | null;
  notes?: string | null;
}

export interface TimelineEntry {
  key: string;
  item: ScheduleItem;
  status: DoseStatus;
  /** Date the dose is expected, adjusted for minimum interval after a late prior dose. */
  dueOn: string;
  /** Unadjusted date from the schedule, kept for auditability. */
  scheduledDueOn: string;
  administeredOn: string | null;
  daysUntilDue: number;
  daysOverdue: number;
  requiresReview: boolean;
  reviewNote: string | null;
}

export interface ImmunizationSummary {
  total: number;
  completed: number;
  overdue: number;
  dueToday: number;
  dueSoon: number;
  upcoming: number;
  requiresReview: number;
  nextDue: TimelineEntry | null;
  mostCritical: TimelineEntry | null;
}

export interface TimelineInput {
  dateOfBirth: string;
  sex: 'M' | 'F';
  doses: RecordedDose[];
  schedule: ScheduleItem[];
  /** yyyy-mm-dd, defaults handled by caller so the engine stays pure. */
  today: string;
  dueSoonWindowDays?: number;
}

export interface ImmunizationTimeline {
  entries: TimelineEntry[];
  summary: ImmunizationSummary;
}

const STATUS_LABELS: Record<DoseStatus, string> = {
  completed: 'Completed',
  due_today: 'Due today',
  due_soon: 'Due soon',
  overdue: 'Overdue',
  upcoming: 'Upcoming',
  not_applicable: 'Not applicable',
};

export function statusLabel(status: DoseStatus): string {
  return STATUS_LABELS[status];
}

/** Tailwind tone token so status never relies on colour alone. */
export function statusTone(status: DoseStatus): 'positive' | 'warning' | 'danger' | 'neutral' | 'info' {
  if (status === 'completed') return 'positive';
  if (status === 'overdue') return 'danger';
  if (status === 'due_today' || status === 'due_soon') return 'warning';
  if (status === 'upcoming') return 'info';
  return 'neutral';
}

export function isActionable(status: DoseStatus): boolean {
  return status === 'overdue' || status === 'due_today' || status === 'due_soon';
}

function applicableItems(schedule: ScheduleItem[], sex: 'M' | 'F'): ScheduleItem[] {
  return schedule
    .filter((i) => i.is_active)
    .filter((i) => i.applies_to === 'any' || (i.applies_to === 'female' ? sex === 'F' : sex === 'M'))
    .sort((a, b) => a.target_age_days - b.target_age_days || a.dose_order - b.dose_order);
}

/**
 * Deterministic immunization timeline for one child.
 * Due date = date of birth + recommended age, pushed forward when the previous
 * dose in the same series was given late (minimum interval from the schedule).
 */
export function computeImmunizationTimeline(input: TimelineInput): TimelineEntry[] {
  const today = input.today;
  const dob = input.dateOfBirth;
  const soonWindow = input.dueSoonWindowDays ?? DEFAULT_DUE_SOON_WINDOW_DAYS;
  const doses = input.doses ?? [];

  const administered = (code: string, label: string): RecordedDose | undefined =>
    doses
      .filter((d) => d.vaccineCode === code && d.administeredOn && d.doseLabel === label)
      .sort((a, b) => (a.administeredOn < b.administeredOn ? 1 : -1))[0];

  const previousInSeries = (code: string, order: number): RecordedDose | undefined => {
    const items = input.schedule.filter(
      (i) => i.vaccine_code === code && i.dose_order < order,
    );
    const prevItem = items.sort((a, b) => b.dose_order - a.dose_order)[0];
    return prevItem ? administered(code, prevItem.dose_label) : undefined;
  };

  return applicableItems(input.schedule, input.sex).map((item) => {
    const given = administered(item.vaccine_code, item.dose_label);
    const scheduledDueOn = addDays(dob, item.target_age_days);
    let dueOn = scheduledDueOn;
    const prev =
      item.dose_order > 1 ? previousInSeries(item.vaccine_code, item.dose_order) : undefined;
    if (item.min_interval_days && prev?.administeredOn) {
      const intervalDue = addDays(prev.administeredOn, item.min_interval_days);
      if (intervalDue > dueOn) dueOn = intervalDue;
    }

    const diff = daysBetween(today, dueOn);
    let status: DoseStatus;
    if (given) status = 'completed';
    else if (diff > 0) status = diff <= soonWindow ? 'due_soon' : 'upcoming';
    else if (diff === 0) status = 'due_today';
    else status = 'overdue';

    const needsReview = !given && status === 'overdue' && item.requires_review;
    return {
      key: `${item.vaccine_code}:${item.dose_label}`,
      item,
      status,
      dueOn,
      scheduledDueOn,
      administeredOn: given?.administeredOn ?? null,
      daysOverdue: status === 'overdue' ? Math.abs(diff) : 0,
      daysUntilDue: status === 'upcoming' || status === 'due_soon' ? diff : 0,
      requiresReview: needsReview,
      reviewNote: needsReview
        ? item.catch_up_note ??
          'Catch-up timing needs healthcare-worker review; no unsupported recommendation is given.'
        : null,
    };
  });
}
