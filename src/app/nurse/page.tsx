"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { NewChildModal } from "@/components/ChildForms";
import { statusChip } from "@/components/badges";

async function fetchChildren(q: string, status: string) {
  const res = await fetch(
    `/api/children?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to load");
  const data = await res.json();
  return data.children as any[];
}

export default function NurseDashboard() {
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async (qq: string, ss: string) => {
    setLoading(true);
    setError("");
    try {
      setChildren(await fetchChildren(qq, ss));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q, status), 250);
    return () => clearTimeout(t);
  }, [q, status, load]);

  const stats = useMemo(() => {
    const total = children.length;
    const active = children.filter((c) => c.status === "ACTIVE").length;
    let overdue = 0,
      dueToday = 0;
    for (const c of children) {
      overdue += c.overdueCount ?? 0;
      dueToday += c.dueTodayCount ?? 0;
    }
    return { total, active, overdue, dueToday };
  }, [children]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Nurse Dashboard</h1>
          <p className="text-sm text-slate-500">Immunizations, growth and follow-ups at a glance</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
        >
          + Register child
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Children", value: stats.total, icon: "👶", tone: "bg-teal-50 text-teal-700" },
          { label: "Active", value: stats.active, icon: "✅", tone: "bg-emerald-50 text-emerald-700" },
          { label: "Overdue doses", value: stats.overdue, icon: "🚨", tone: "bg-red-50 text-red-700" },
          { label: "Due today", value: stats.dueToday, icon: "⏰", tone: "bg-amber-50 text-amber-700" },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl p-4 ${s.tone}`}>
            <div className="text-2xl">{s.icon}</div>
            <div className="mt-1 text-2xl font-bold">{loading ? "–" : s.value}</div>
            <div className="text-xs font-medium opacity-80">{s.label}</div>
          </div>
        ))}
      </div>

      <section id="children" className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold text-slate-900">Your children</h2>
          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or record ID…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none sm:w-56"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-2 text-sm focus:outline-none"
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="DECEASED">Deceased</option>
              <option value="TRANSFERRED">Transferred</option>
            </select>
          </div>
        </div>

        {loading && <p className="py-8 text-center text-sm text-slate-400">Loading children…</p>}
        {!loading && error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}
        {!loading && !error && children.length === 0 && (
          <div className="py-10 text-center">
            <div className="text-4xl">🍼</div>
            <p className="mt-2 text-sm text-slate-500">
              {q || status ? "No children match your search." : "No children registered yet."}
            </p>
            {!q && !status && (
              <button
                onClick={() => setModalOpen(true)}
                className="mt-3 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Register your first child
              </button>
            )}
          </div>
        )}

        <ul className="divide-y divide-slate-100">
          {children.map((c) => (
            <li key={c.id}>
              <Link
                href={`/nurse/children/${c.id}`}
                className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-slate-900">
                      {c.firstName} {c.lastName}
                    </span>
                    {statusChip(c.status)}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {c.recordId} · {c.sex} · born {new Date(c.dateOfBirth).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                  {(c.overdueCount ?? 0) > 0 && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                      {c.overdueCount} overdue
                    </span>
                  )}
                  {(c.dueTodayCount ?? 0) > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                      {c.dueTodayCount} due today
                    </span>
                  )}
                  {c.nextDue && (
                    <span className="text-[11px] text-slate-400">
                      Next: {c.nextDue.name} {new Date(c.nextDue.scheduledDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <NewChildModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={() => load(q, status)} />
    </main>
  );
}