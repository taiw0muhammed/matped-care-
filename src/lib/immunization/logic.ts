import { NIGERIA_SCHEDULE, MIN_INTERVAL_DAYS, VACCINE_META } from "./schedule";
import type { DoseDefinition } from "./schedule";
import { addDays, daysBetween } from "../dates";

export type DoseStatus =
  | "completed"
  | "due_today"
  | "due_soon"
  | "overdue"
  | "upcoming";

export interface GivenDose {
  vaccine: string;
  dose: number;
  givenAt: Date;
}

export interface DosePlanItem extends DoseDefinition {
  /** Date this dose is (or was) due, after catch-up re-basing. */
  scheduledDate: Date;
  status: DoseStatus;
  givenAt: Date | null;
  /** Days from `now` (negative when overdue). */
  daysUntilDue: number;
  /** True when a linked appointment exists for this dose. */
  appointmentId?: string;
}

export interface DosePlan {
  items: DosePlanItem[];
  nextDue: DosePlanItem | null;
  dueToday: DosePlanItem[];
  dueSoon: DosePlanItem[];
  overdue: DosePlanItem[];
  completedSeries: string[];
  /** Immunization coverage, 0..1. */
  coverage: number;
  progress: { given: number; total: number };
}

const DUE_SOON_WINDOW_DAYS = 14;

export function dateAtWeeks(dateOfBirth: Date, weeks: number): Date {
  return addDays(dateOfBirth, weeks * 7);
}

/**
 * Compute the full dose plan for a child against the Nigerian routine
 * schedule, applying WHO catch-up rules:
 *
 *  - Completed doses keep their recorded date.
 *  - The next dose of an incomplete series is re-based to
 *    `max(original schedule date, last given dose + minimum interval)`.
 *  - Doses due within DUE_SOON_WINDOW_DAYS are "due_soon"; anything past its
 *    date is "overdue"; everything later is "upcoming".
 */
export function computeDosePlan(
  dateOfBirth: Date,
  givenDoses: GivenDose[],
  now: Date = new Date(),
  appointments: { id: string; vaccine: string; dose: number }[] = [],
): DosePlan {
  const apptKey = (v: string, d: number) => `${v}:${d}`;
  const given = new Map<string, Date>();
  for (const g of givenDoses) {
    if (!g.givenAt) continue;
    given.set(apptKey(g.vaccine, g.dose), new Date(g.givenAt));
  }

  const items: DosePlanItem[] = [];
  const sorted = [...NIGERIA_SCHEDULE].sort(
    (a, b) => a.targetWeeks - b.targetWeeks || a.vaccine.localeCompare(b.vaccine) || a.dose - b.dose,
  );

  for (const def of sorted) {
    const key = apptKey(def.vaccine, def.dose);
    const givenAt = given.get(key) ?? null;
    let scheduledDate = dateAtWeeks(dateOfBirth, def.targetWeeks);

    if (!givenAt) {
      // Catch-up re-basing: find the previous dose in this series that was
      // actually given, and push this dose to at least min-interval after it.
      const series = NIGERIA_SCHEDULE.filter(
        (d) => d.vaccine === def.vaccine && d.dose < def.dose,
      );
      let lastGiven: Date | null = null;
      for (const prev of series) {
        const prevAt = given.get(apptKey(prev.vaccine, prev.dose));
        if (prevAt && (!lastGiven || prevAt > lastGiven)) lastGiven = prevAt;
      }
      if (lastGiven) {
        const earliest = addDays(lastGiven, MIN_INTERVAL_DAYS[def.vaccine] ?? 28);
        if (earliest > scheduledDate) scheduledDate = earliest;
      }
    }

    let status: DoseStatus;
    const delta = daysBetween(now, scheduledDate);
    if (givenAt) status = "completed";
    else if (delta < 0) status = "overdue";
    else if (delta === 0) status = "due_today";
    else if (delta <= DUE_SOON_WINDOW_DAYS) status = "due_soon";
    else status = "upcoming";

    const appt = appointments.find((a) => apptKey(a.vaccine, a.dose) === key);
    items.push({
      ...def,
      scheduledDate,
      status,
      givenAt,
      daysUntilDue: givenAt ? 0 : delta,
      ...(appt ? { appointmentId: appt.id } : {}),
    });
  }

  const pending = items.filter((i) => i.status !== "completed");
  const dueToday = pending.filter((i) => i.status === "due_today");
  const dueSoon = pending.filter((i) => i.status === "due_soon");
  const overdue = pending.filter((i) => i.status === "overdue");

  const nextDue =
    pending.length === 0
      ? null
      : pending.reduce((best, i) =>
          i.scheduledDate < best.scheduledDate ||
          (i.scheduledDate.getTime() === best.scheduledDate.getTime() && i.vaccine < best.vaccine)
            ? i
            : best,
        );

  const completedSeries = Object.values(VACCINE_META).filter(
    (s) => s.doses.every((d) => given.has(apptKey(s.vaccine, d))),
  ).map((s) => s.vaccine);

  const total = items.length;
  const done = items.filter((i) => i.status === "completed").length;

  return {
    items,
    nextDue,
    dueToday,
    dueSoon,
    overdue,
    completedSeries,
    coverage: total === 0 ? 0 : done / total,
    progress: { given: done, total },
  };
}

export function isSeriesComplete(plan: DosePlan, vaccine: string): boolean {
  return plan.completedSeries.includes(vaccine);
}

/** Human label for a dose, e.g. "Pentavalent-2". */
export function doseLabel(item: Pick<DosePlanItem, "name" | "vaccine" | "dose">): string {
  return item.name;
}

/** Types re-exported for convenience. */
export type { DoseDefinition };