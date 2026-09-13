"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Empty, ErrorBox, PageHead, Spinner } from "@/components/ui";

type Appt = {
  id: string;
  childId: string;
  childName: string;
  recordId: string;
  scheduledAt: string;
  reason: string | null;
  status: string;
  nurse: { id: string; fullName: string } | null;
};

function fmtDT(iso: string) {
  return new Date(iso).toLocaleString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_STYLE: Record<string, string> = {
  SCHEDULED: "bg-sky-100 text-sky-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-100 text-slate-500",
  NO_SHOW: "bg-amber-100 text-amber-800",
};

export default function NurseAppointmentsPage() {
  const router = useRouter();
  const [appts, setAppts] = useState<Appt[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetch("/api/nurse/appointments")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed to load appointments");
        setAppts(j.appointments);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (a: Appt, status: string) => {
    const r = await fetch(`/api/children/${a.childId}/appointments/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (r.ok) load();
    else {
      const j = await r.json().catch(() => ({}));
      alert(j.error || "Failed to update appointment");
    }
  };

  if (error) return <div className="mx-auto max-w-2xl p-4"><ErrorBox message={error} onRetry={load} /></div>;
  if (!appts) return <div className="p-10"><Spinner label="Loading appointments…" /></div>;

  return (
    <div className="mx-auto max-w-2xl p-4 pb-24">
      <PageHead title="Appointments" sub="Upcoming and recent appointments" />
      {appts.length === 0 ? (
        <Empty
          title="No appointments yet"
          hint="Book a follow-up from any child's profile page."
          action={<Link href="/nurse" className="mt-2 inline-block rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white">Go to dashboard</Link>}
        />
      ) : (
        <ul className="space-y-2.5">
          {appts.map((a) => (
            <li key={a.id} className="rounded-xl border border-slate-200 bg-white p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/nurse/children/${a.childId}`} className="font-semibold text-slate-800 hover:text-teal-700">
                    {a.childName || "Unnamed child"}
                  </Link>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {fmtDT(a.scheduledAt)} · <span className="font-mono">{a.recordId}</span>
                    {a.nurse ? ` · ${a.nurse.fullName}` : ""}
                  </div>
                  {a.reason && <div className="mt-1 text-sm text-slate-600">{a.reason}</div>}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[a.status] ?? "bg-slate-100 text-slate-600"}`}>
                  {a.status.replace("_", " ")}
                </span>
              </div>
              {a.status === "SCHEDULED" && (
                <div className="mt-2.5 flex gap-2">
                  <button
                    onClick={() => setStatus(a, "COMPLETED")}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    Mark completed
                  </button>
                  <button
                    onClick={() => setStatus(a, "NO_SHOW")}
                    className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-200"
                  >
                    No-show
                  </button>
                  <button
                    onClick={() => setStatus(a, "CANCELLED")}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}