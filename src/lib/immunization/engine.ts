import { addDays, daysBetween, type ScheduleItem } from './schedule';

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
    .filter((i) => i.isActive)
    .filter((i) => !i.femaleOnly || sex === 'F')
    .sort((a, b) => a.targetAgeDays - b.targetAgeDays || a.doseOrder - b.doseOrder);
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
    const prior = doses
      .filter((d) => d.vaccineCode === code && d.doseOrder !== undefined)
      .filter((d) => (d.doseOrder as number) < order);
    if (prior.length > 0) {
      return prior.sort((a, b) => ((a.doseOrder as number) < (b.doseOrder as number) ? 1 : -1))[0];
    }
    const items = input.schedule.filter((i) => i.vaccineCode === code && i.doseOrder < order);
    const prevItem = items.sort((a, b) => b.doseOrder - a.doseOrder)[0];
    return prevItem ? administered(code, prevItem.doseLabel) : undefined;
  };

  return applicableItems(input.schedule, input.sex).map((item) => {
    const given = administered(item.vaccineCode, item.doseLabel);
    let dueOn = addDays(dob, item.targetAgeDays);
    const prev = item.doseOrder > 1 ? previousInSeries(item.vaccineCode, item.doseOrder) : undefined;
    if (item.minIntervalDays && prev?.administeredOn) {
      const intervalDue = addDays(prev.administeredOn, item.minIntervalDays);
      if (intervalDue > dueOn) dueOn = intervalDue;
    }

    const diff = daysBetween(today, dueOn);
    let status: DoseStatus;
    if (given) status = 'completed';
    else if (diff > 0) status = diff <= soonWindow ? 'due_soon' : 'upcoming';
    else if (diff === 0) status = 'due_today';
    else status = 'overdue';

    const needsReview = !given && status === 'overdue' && item.requiresReview;
    return {
      key: `${item.vaccineCode}:${item.doseLabel}`,
      item,
      status,
      dueOn,
      administeredOn: given?.administeredOn ?? null,
      daysOverdue: status === 'overdue' ? Math.abs(diff) : 0,
      daysUntilDue: status === 'upcoming' || status === 'due_soon' ? diff : 0,
      requiresReview: needsReview,
      reviewNote: needsReview
        ? item.catchUpNote ??
          'Catch-up timing needs healthcare-worker review; no unsupported recommendation is given.'
        : null,
    };
  });
}
