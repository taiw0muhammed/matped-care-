"use client";

type DoseItem = {
  vaccine: string;
  dose: number;
  name: string;
  route?: string;
  site?: string;
  notes?: string;
  scheduledDate: string;
  status: string;
  givenAt: string | null;
  daysUntilDue: number;
};

const STATUS_STYLES: Record<string, { dot: string; chip: string; label: string }> = {
  completed: { dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-800", label: "Given" },
  due_today: { dot: "bg-amber-500", chip: "bg-amber-500 text-white", label: "Due today" },
  due_soon: { dot: "bg-amber-400", chip: "bg-amber-100 text-amber-800", label: "Due soon" },
  overdue: { dot: "bg-rose-600", chip: "bg-rose-100 text-rose-800", label: "Overdue" },
  upcoming: { dot: "bg-slate-300", chip: "bg-slate-100 text-slate-600", label: "Upcoming" },
};

function fmt(d: string | Date) {
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export function ImmunizationTimeline({ items }: { items: DoseItem[] }) {
  if (!items?.length) {
    return <p className="py-6 text-center text-sm text-slate-500">No vaccination plan yet.</p>;
  }
  return (
    <ol className="relative ml-2 space-y-3 border-l-2 border-slate-200 pl-5">
      {items.map((it, i) => {
        const s = STATUS_STYLES[it.status] ?? STATUS_STYLES.upcoming;
        return (
          <li key={`${it.vaccine}-${it.dose}-${i}`} className="relative">
            <span className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full ring-4 ring-white ${s.dot}`} />
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{it.name}</p>
                  <p className="text-xs text-slate-500">
                    {it.route} · {it.site}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.chip}`}>{s.label}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                <span>Due: {fmt(it.scheduledDate)}</span>
                {it.status === "completed" && it.givenAt ? (
                  <span className="font-medium text-emerald-700">Given: {fmt(it.givenAt)}</span>
                ) : it.status === "overdue" ? (
                  <span className="font-medium text-rose-700">{Math.abs(it.daysUntilDue)} days late</span>
                ) : it.status === "due_soon" || it.status === "due_today" ? (
                  <span className="font-medium text-amber-700">{it.daysUntilDue <= 0 ? "Today" : `in ${it.daysUntilDue} days`}</span>
                ) : null}
              </div>
              {it.notes && <p className="mt-1 text-[11px] text-slate-500">{it.notes}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
