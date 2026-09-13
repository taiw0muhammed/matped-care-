"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ErrorBox, PageHead, Spinner } from "@/components/ui";
import { Empty, DoseStatusChip, GrowthBadge } from "@/components/ui";
import { ChildStatusChip } from "@/components/badges";

type Child = {
  id: string;
  recordId: string;
  firstName: string;
  lastName: string;
  sex: string;
  dateOfBirth: string;
  status: string;
  relation: string;
  nurse: { fullName: string; facilityName?: string | null } | null;
  latestMeasurement: { weightKg: number | null; lengthCm: number | null; headCircCm: number | null; measuredAt: string } | null;
  growthStatus: string | null;
  nextDue: { name: string; scheduledDate: string; status: string } | null;
  overdueCount: number;
  dueTodayCount: number;
  nextAppointment: { scheduledAt: string; status: string } | null;
  progress: { given: number; total: number };
};

export default function ParentHome() {
  const [children, setChildren] = useState<Child[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetch("/api/parent/children", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed to load your children");
        setChildren(j.children);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <div className="p-4"><ErrorBox message={error} onRetry={load} /></div>;
  if (!children) return <div className="p-10"><Spinner label="Loading your family…" /></div>;

  const overdueTotal = children.reduce((s, c) => s + c.overdueCount, 0);
  const dueTodayTotal = children.reduce((s, c) => s + c.dueTodayCount, 0);

  return (
    <div className="mx-auto max-w-2xl p-4 pb-24">
      <PageHead title="My Children" sub="Your family's immunization and growth at a glance" />

      {(overdueTotal > 0 || dueTodayTotal > 0) && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {overdueTotal > 0 && <p>🔴 {overdueTotal} vaccine{overdueTotal > 1 ? "s" : ""} overdue</p>}
          {dueTodayTotal > 0 && <p>🟡 {dueTodayTotal} due today</p>}
        </div>
      )}

      {children.length === 0 ? (
        <Empty
          title="No children linked to your account yet"
          hint="Ask your nurse to register your child and link your phone number — you'll get reminders automatically."
        />
      ) : (
        <ul className="space-y-3">
          {children.map((c) => (
            <li key={c.id}>
              <Link
                href={`/parent/children/${c.id}`}
                className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-teal-400 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold text-slate-900">{c.firstName} {c.lastName}</span>
                      <ChildStatusChip status={c.status} />
                      {c.growthStatus && <GrowthBadge status={c.growthStatus} />}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(c.dateOfBirth).toLocaleDateString("en-NG")} · {c.relation}
                      {c.nurse ? ` · ${c.nurse.fullName}${c.nurse.facilityName ? `, ${c.nurse.facilityName}` : ""}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right font-mono text-[11px] text-slate-400">{c.recordId}</div>
                </div>

                {c.latestMeasurement?.weightKg != null && (
                  <p className="mt-2 text-xs text-slate-600">
                    Latest: {c.latestMeasurement.weightKg} kg
                    {c.latestMeasurement.lengthCm != null ? ` · ${c.latestMeasurement.lengthCm} cm` : ""}
                    {" · "}{new Date(c.latestMeasurement.measuredAt).toLocaleDateString("en-NG")}
                  </p>
                )}

                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                    💉 {c.progress.given}/{c.progress.total} doses
                  </span>
                  {c.nextDue ? (
                    <span className="flex items-center gap-1.5">
                      <DoseStatusChip status={c.nextDue.status} />
                      <span className="text-slate-600">{c.nextDue.name} · {new Date(c.nextDue.scheduledDate).toLocaleDateString("en-NG")}</span>
                    </span>
                  ) : (
                    <span className="text-slate-400">All scheduled doses complete 🎉</span>
                  )}
                  {c.nextAppointment && (
                    <span className="text-slate-500">📅 {new Date(c.nextAppointment.scheduledAt).toLocaleDateString("en-NG")}</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}