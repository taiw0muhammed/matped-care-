"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Empty, ErrorBox, GrowthBadge, PageHead, Spinner } from "@/components/ui";
import { GrowthChart } from "@/components/GrowthChart";
import { ImmunizationTimeline } from "@/components/ImmunizationTimeline";
import { referenceCurves } from "@/lib/growth/engine";

function fmtDT(iso: string | Date | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function pts(growth: any[], field: string, dobMs: number) {
  return growth
    .filter((g) => g[field] != null)
    .map((g) => ({
      t: Math.max(0, Math.round((new Date(g.measuredAt).getTime() - dobMs) / 86400000)),
      v: g[field],
    }));
}

export default function ParentChildPage() {
  const { id } = useParams<{ id: string }>();
  const [rec, setRec] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [insight, setInsight] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    fetch(`/api/children/${id}/record`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed to load record");
        setRec(j);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const askInsight = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/children/${id}/insight`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Insight unavailable right now");
      setInsight(j.insight);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="mx-auto max-w-2xl p-4"><ErrorBox message={error} onRetry={load} /></div>;
  if (!rec) return <div className="p-10"><Spinner label="Loading your child's record…" /></div>;

  const child = rec.child as any;
  const name = `${child.firstName} ${child.lastName}`.trim() || "Child";
  const sex = child.sex === "MALE" ? "male" : "female";
  const dobMs = new Date(child.dateOfBirth).getTime();
  const ageDays = Math.max(0, Math.floor((Date.now() - dobMs) / 86400000));
  const maxAge = Math.max(ageDays + 90, 180);
  const growth: any[] = rec.growth ?? [];
  const wfa = referenceCurves("wfa", sex, 0, maxAge);
  const lha = referenceCurves("lha", sex, 0, maxAge);
  const hcfa = referenceCurves("hcfa", sex, 0, maxAge);

  return (
    <div className="mx-auto max-w-2xl p-4 pb-16">
      <PageHead
        title={name}
        sub={`Record ${child.recordId} · Born ${new Date(child.dateOfBirth).toLocaleDateString("en-NG")}`}
        right={<Link href="/parent" className="text-sm font-semibold text-teal-600">← Back</Link>}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <GrowthBadge status={rec.assessment?.status} />
        <span className="text-xs text-slate-500">
          {child.sex === "FEMALE" ? "Girl" : child.sex === "MALE" ? "Boy" : "Child"}
        </span>
      </div>

      {rec.alerts?.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-800">Needs attention</p>
          <ul className="mt-1 list-inside list-disc text-sm text-amber-800">
            {rec.alerts.map((a: any, i: number) => (
              <li key={i}>{a.message ?? a}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="mt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Growth charts</h3>
          <button onClick={askInsight} disabled={busy} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
            {busy ? "Thinking…" : "✨ AI Growth Insight"}
          </button>
        </div>
        <div className="mt-2 space-y-3">
          <GrowthChart title="Weight for age" unit="kg" color="#0d9488" points={pts(growth, "weightKg", dobMs)} curves={wfa} maxAgeDays={maxAge} />
          <GrowthChart title="Length/height for age" unit="cm" color="#0284c7" points={pts(growth, "lengthCm", dobMs)} curves={lha} maxAgeDays={maxAge} />
          <GrowthChart title="Head circumference for age" unit="cm" color="#7c3aed" points={pts(growth, "headCircCm", dobMs)} curves={hcfa} maxAgeDays={maxAge} />
        </div>
        {insight && (
          <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">AI growth insight</p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700">{insight.text}</p>
            <p className="mt-2 text-[11px] text-slate-500">Supportive insight only — not a medical diagnosis. Always consult a clinician.</p>
          </div>
        )}
      </section>

      <section className="mt-6">
        <h3 className="text-sm font-semibold text-slate-800">Vaccination timeline</h3>
        <div className="mt-2">
          {rec.dosePlan?.items?.length ? (
            <ImmunizationTimeline items={rec.dosePlan.items} />
          ) : (
            <Empty title="No vaccination plan yet" hint="Your healthcare worker will build the schedule here." />
          )}
        </div>
      </section>

      <section className="mt-6">
        <h3 className="text-sm font-semibold text-slate-800">Appointments</h3>
        {rec.appointments?.length ? (
          <ul className="mt-2 space-y-2">
            {rec.appointments.map((a: any) => (
              <li key={a.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{a.reason || "Appointment"}</p>
                  <p className="text-xs text-slate-500">{fmtDT(a.scheduledAt)}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{a.status.replace("_", " ")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No appointments yet" />
        )}
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        <a href={`/api/children/${child.id}/record/pdf`} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900">
          ⬇ Download record (PDF)
        </a>
      </div>
    </div>
  );
}