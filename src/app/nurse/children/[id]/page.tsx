"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Empty, ErrorBox, GrowthBadge, PageHead, RecordLink, Spinner } from "@/components/ui";
import { ChildStatusChip } from "@/components/badges";
import { GrowthChart } from "@/components/GrowthChart";
import { ImmunizationTimeline } from "@/components/ImmunizationTimeline";
import {
  AppointmentForm,
  ImmunizationForm,
  LinkParentForm,
  MeasurementForm,
  VisitForm,
} from "@/components/ChildForms";
import { referenceCurves } from "@/lib/growth/engine";

function ageInDays(dob: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(dob).getTime()) / 86400000));
}

function fmtDT(iso: string | Date | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NurseChildPage() {
  const { id } = useParams<{ id: string }>();
  const [rec, setRec] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [insight, setInsight] = useState<any | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

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
    if (id) load();
  }, [id, load]);

  const askInsight = async () => {
    setInsightLoading(true);
    try {
      const r = await fetch(`/api/children/${id}/insight`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Insight unavailable");
      setInsight(j.insight);
    } catch (e: any) {
      setInsight({ text: `Insight unavailable: ${e.message}. Standard WHO growth guidance applies.` });
    } finally {
      setInsightLoading(false);
    }
  };

  if (error) return <div className="mx-auto max-w-3xl p-4"><ErrorBox message={error} onRetry={load} /></div>;
  if (!rec) return <div className="p-10"><Spinner label="Loading child record…" /></div>;

  const { child, guardians, visits, growth, immunizations, appointments, assessment, dosePlan, alerts } = rec;
  const name = `${child.firstName} ${child.lastName}`.trim() || "Unnamed child";
  const days = ageInDays(child.dateOfBirth);
  const maxAge = Math.max(days + 30, 365);
  const sex = child.sex === "FEMALE" ? "female" : "male";

  const points = (field: "weightKg" | "lengthCm" | "headCircCm") =>
    (growth as any[])
      .filter((g) => g[field] != null)
      .map((g) => ({
        t: Math.max(0, Math.floor((new Date(g.measuredAt).getTime() - new Date(child.dateOfBirth).getTime()) / 86400000)),
        v: Number(g[field]),
      }));

  const timelineItems = (dosePlan?.items ?? []).map((it: any) => ({
    vaccine: it.vaccine,
    dose: it.dose,
    name: it.name,
    route: it.route,
    site: it.site,
    notes: it.notes,
    scheduledDate: new Date(it.scheduledDate).toISOString(),
    status: it.status,
    givenAt: it.givenAt ? new Date(it.givenAt).toISOString() : null,
    daysUntilDue: it.daysUntilDue,
  }));

  return (
    <div className="mx-auto max-w-3xl p-4 pb-24">
      <div className="mb-3">
        <Link href="/nurse" className="text-sm text-teal-600 hover:underline">← Back to children</Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <PageHead
          title={name}
          sub={`${new Date(child.dateOfBirth).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })} · ${child.sex ?? "—"} · ${Math.floor(days / 30.44)} months`}
          right={<ChildStatusChip status={child.status} />}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <RecordLink id={child.recordId} />
          {child.birthWeightKg != null && <span>BW {child.birthWeightKg} kg</span>}
          {child.bloodGroup && <span>{child.bloodGroup}</span>}
          {child.allergies && <span className="text-rose-600">⚠ {child.allergies}</span>}
        </div>
        {assessment && (
          <div className="mt-3 flex items-center gap-2">
            <GrowthBadge status={assessment.status} />
            {assessment.summary && <span className="text-xs text-slate-600">{assessment.summary}</span>}
          </div>
        )}
        {(alerts?.length ?? 0) > 0 && (
          <div className="mt-3 space-y-1.5">
            {(alerts as any[]).map((a, i) => (
              <div key={i} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{a.message ?? a}</div>
            ))}
          </div>
        )}
      </div>

      <section className="mt-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Growth (WHO standards)</h3>
        {growth?.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <GrowthChart title="Weight-for-age" unit="wfa" color="#0d9488" points={points("weightKg")} curves={referenceCurves("wfa", sex, 0, maxAge, 24)} maxAgeDays={maxAge} />
            <GrowthChart title="Length/height-for-age" unit="lha" color="#6366f1" points={points("lengthCm")} curves={referenceCurves("lha", sex, 0, maxAge, 24)} maxAgeDays={maxAge} />
            <GrowthChart title="Head circumference-for-age" unit="hcfa" color="#f59e0b" points={points("headCircCm")} curves={referenceCurves("hcfa", sex, 0, maxAge, 24)} maxAgeDays={maxAge} />
            <div className="space-y-3">
              {(growth as any[]).slice(-6).reverse().map((g) => (
                <div key={g.id} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                  <div className="font-medium text-slate-700">{new Date(g.measuredAt).toLocaleDateString("en-NG")}</div>
                  <div className="mt-1 text-slate-500">
                    {g.weightKg != null ? `W ${g.weightKg} kg` : ""} {g.lengthCm != null ? `· L ${g.lengthCm} cm` : ""} {g.headCircCm != null ? `· HC ${g.headCircCm} cm` : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <Empty title="No growth measurements yet" hint="Add the first measurement below." />
        )}
        <div className="mt-3"><MeasurementForm childId={child.id} onSaved={load} /></div>

        {insight && (
          <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <div className="text-sm font-semibold text-indigo-800">🤖 AI Growth Insight</div>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-indigo-900">{insight?.text ?? JSON.stringify(insight)}</p>
            <p className="mt-2 text-[11px] text-indigo-500">Supportive guidance only — not a diagnosis. Clinical decisions follow WHO standards and professional judgement.</p>
          </div>
        )}
        <button onClick={askInsight} disabled={insightLoading} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          {insightLoading ? "Generating insight…" : "Get AI Growth Insight"}
        </button>
      </section>

      <section className="mt-5">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Immunization — Nigeria schedule</h3>
        <ImmunizationTimeline items={timelineItems} />
        {(dosePlan?.nextDue) && (
          <div className="mt-2 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">
            Next: <strong>{dosePlan.nextDue.name}</strong> — due {fmtDT(dosePlan.nextDue.scheduledDate)}
          </div>
        )}
        <div className="mt-3"><ImmunizationForm childId={child.id} onSaved={load} /></div>
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Visits</h3>
          {(visits as any[]).length ? (
            <ul className="space-y-2">
              {(visits as any[]).map((v) => (
                <li key={v.id} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                  <div className="font-medium text-slate-700">{v.visitType ?? "Visit"} · {fmtDT(v.visitDate)}</div>
                  <div className="mt-1 text-slate-500">{v.reason ?? v.notes ?? ""}</div>
                  {v.temperatureC != null && <div className="mt-1">Temp {v.temperatureC}°C</div>}
                  {v.notes && <div className="mt-1 text-slate-500">{v.notes}</div>}
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No visits recorded" />
          )}
          <div className="mt-2"><VisitForm childId={child.id} onSaved={load} /></div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Appointments</h3>
          {(appointments as any[]).length ? (
            <ul className="space-y-2">
              {(appointments as any[]).map((a) => (
                <li key={a.id} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                  <div className="font-medium text-slate-700">{fmtDT(a.scheduledAt)}</div>
                  <div className="mt-1 text-slate-500">{a.notes ?? ""} · {a.status}</div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No appointments" />
          )}
          <div className="mt-2"><AppointmentForm childId={child.id} onSaved={load} /></div>
        </div>
      </section>

      <section className="mt-5">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Guardians</h3>
        {(guardians as any[]).length ? (
          <ul className="space-y-2">
            {(guardians as any[]).map((g) => (
              <li key={g.id} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                <div className="font-medium text-slate-700">{g.user?.fullName} <span className="font-normal text-slate-400">({g.relation})</span></div>
                <div className="mt-1 text-slate-500">{g.user?.phone} {g.user?.email ? `· ${g.user.email}` : ""}</div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No guardians linked yet" />
        )}
        <div className="mt-2"><LinkParentForm childId={child.id} onSaved={load} /></div>
      </section>

      <div className="mt-6 flex gap-2">
        <a href={`/api/children/${child.id}/record/pdf`} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900">⬇ Download PDF</a>
        <button
          onClick={async () => {
            const r = await fetch(`/api/children/${child.id}/record/share`, { method: "POST" });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) return alert(j.error || "Failed to create share link");
            const url = `${window.location.origin}/share/${j.token}`;
            await navigator.clipboard.writeText(url).catch(() => {});
            alert(`Share link copied:\n${url}`);
          }}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
        >
          🔗 Copy share link
        </button>
      </div>
    </div>
  );
}