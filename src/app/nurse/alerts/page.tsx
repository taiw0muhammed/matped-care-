"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Alert = {
  id: string;
  childId: string;
  childName?: string;
  type: string;
  message: string;
  channel?: string;
  readAt: string | null;
  createdAt: string;
};

export default function NurseAlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      const data = await res.json();
      setAlerts((data.notifications ?? []).map((n: any) => ({
        id: n.id,
        childId: n.childId,
        childName: n.childName,
        type: n.type ?? "alert",
        message: n.message ?? "",
        channel: n.channel,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, readAt: new Date().toISOString() } : a)));
  };

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Alerts & Notifications</h1>
          <p className="text-sm text-slate-500">Growth and immunization alerts for your children</p>
        </div>
        <button
          onClick={load}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          ↻ Refresh
        </button>
      </div>

      {loading && <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-400 shadow-sm">Loading alerts…</p>}
      {!loading && error && <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 shadow-sm">{error}</p>}
      {!loading && !error && alerts.length === 0 && (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
          <div className="text-4xl">🔕</div>
          <p className="mt-2 text-sm text-slate-500">No alerts right now. You are all caught up.</p>
        </div>
      )}

      <ul className="space-y-2">
        {alerts.map((a) => (
          <li
            key={a.id}
            className={`flex items-start justify-between gap-3 rounded-2xl p-4 shadow-sm ${
              a.readAt ? "bg-white opacity-70" : "bg-white ring-1 ring-teal-200"
            }`}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-slate-600">
                  {a.type}
                </span>
                {a.channel && <span className="text-slate-400">via {a.channel}</span>}
                <span className="text-slate-400">{new Date(a.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-1.5 text-sm text-slate-800">{a.message}</p>
              {a.childId && (
                <Link href={`/nurse/children/${a.childId}`} className="mt-1 inline-block text-xs font-medium text-teal-600 hover:underline">
                  Open child record →
                </Link>
              )}
            </div>
            {!a.readAt && (
              <button
                onClick={() => markRead(a.id)}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-teal-600 hover:bg-teal-50"
              >
                Mark read
              </button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}