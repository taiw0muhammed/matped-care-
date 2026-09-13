export const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function addMonthsClamped(d: Date, months: number): Date {
  const x = new Date(d);
  const day = x.getDate();
  x.setDate(1);
  x.setMonth(x.getMonth() + months);
  const lastDay = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(day, lastDay));
  return x;
}

/** Whole months between two dates (floors fractional months). */
export function monthsBetween(from: Date, to: Date): number {
  let m = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) m -= 1;
  return Math.max(0, m);
}

/** Age in whole months. */
export function ageInMonths(birth: Date, ref: Date = new Date()): number {
  return monthsBetween(birth, ref);
}

export function ageInDays(birth: Date, ref: Date = new Date()): number {
  return Math.floor((startOfDay(ref).getTime() - startOfDay(birth).getTime()) / DAY_MS);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const x = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(x.getTime())) return "—";
  return `${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`;
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const x = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(x.getTime())) return "—";
  const h = x.getHours().toString().padStart(2, "0");
  const m = x.getMinutes().toString().padStart(2, "0");
  return `${fmtDate(x)}, ${h}:${m}`;
}

/** "3 months 4 days" style age display. */
export function fmtAge(birth: Date, ref: Date = new Date()): string {
  const months = ageInMonths(birth, ref);
  const days = ageInDays(birth, ref) - months * 30;
  const parts: string[] = [];
  if (months >= 12) {
    const years = Math.floor(months / 12);
    parts.push(`${years} yr${years > 1 ? "s" : ""}`);
    const remM = months % 12;
    if (remM) parts.push(`${remM} mo`);
  } else if (months >= 1) {
    parts.push(`${months} mo`);
    if (days > 3) parts.push(`${days} d`);
  } else {
    parts.push(`${ageInDays(birth, ref)} d`);
  }
  return parts.join(" ") || "0 d";
}

export function toISODateInput(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  const mm = (x.getMonth() + 1).toString().padStart(2, "0");
  const dd = x.getDate().toString().padStart(2, "0");
  return `${x.getFullYear()}-${mm}-${dd}`;
}