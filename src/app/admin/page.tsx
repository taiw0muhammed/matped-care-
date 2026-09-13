"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ErrorBox, PageHead, Spinner } from "@/components/ui";
import { RoleChip } from "@/components/badges";

const CARDS: Array<[key: string, label: string, icon: string]> = [
  ["users", "Total users", "👥"],
  ["nurses", "Health workers", "🩺"],
  ["parents", "Parent accounts", "👨‍👩‍👧"],
  ["children", "Children", "🧒"],
  ["activeChildren", "Active children", "✅"],
  ["immunizations", "Vaccines given", "💉"],
  ["visits", "Visits recorded", "📋"],
  ["appointments", "Upcoming appointments", "📅"],
  ["notifications", "Notifications sent", "🔔"],
  ["recordsShared", "Records shared", "🔗"],
];

export default function AdminPage() {
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetch("/api/admin/stats", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Failed to load stats");
        setData(j);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  if (error) return <div className="mx-auto max-w-3xl p-4"><ErrorBox message={error} onRetry={load} /></div>;
  if (!data) return <div className="p-10"><Spinner label="Loading platform stats…" /></div>;

  const s = data.stats ?? {};
  return (
    <div className="mx-auto max-w-3xl p-4 pb-16">
      <PageHead title="Platform overview" sub="MatPed Care admin dashboard" />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CARDS.map(([key, label, icon]) => (
          <div key={key} className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="text-lg">{icon}</div>
            <div className="mt-1 text-2xl font-bold text-slate-800">{s[key] ?? 0}</div>
            <div className="text-xs text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-800">Newest users</h3>
          <ul className="mt-2 divide-y divide-slate-100">
            {(data.recentUsers ?? []).map((u: any) => (
              <li key={u.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-700">{u.fullName}</div>
                  <div className="truncate text-xs text-slate-400">{u.email}</div>
                </div>
                <RoleChip role={u.role} />
              </li>
            ))}
            {!(data.recentUsers ?? []).length && <li className="py-2 text-sm text-slate-400">No users yet.</li>}
          </ul>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-800">Newest children</h3>
          <ul className="mt-2 divide-y divide-slate-100">
            {(data.recentChildren ?? []).map((c: any) => (
              <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                <div className="text-sm font-medium text-slate-700 truncate">
                  {c.firstName} {c.lastName}
                </div>
                <span className="shrink-0 font-mono text-[11px] text-slate-400">{c.recordId}</span>
              </li>
            ))}
            {!(data.recentChildren ?? []).length && <li className="py-2 text-sm text-slate-400">No children yet.</li>}
          </ul>
        </section>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/admin/users" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900">Manage users →</Link>
        <Link href="/admin/settings" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400">Platform settings</Link>
      </div>
    </div>
  );
}