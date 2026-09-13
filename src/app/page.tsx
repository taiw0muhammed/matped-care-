import { formatAge } from '@/lib/immunization/schedule';
import {
  NIGERIA_CHILD_SCHEDULE,
  SCHEDULE_SOURCE,
  SCHEDULE_VERSION
} from '@/lib/immunization/nigeria';

export default function HomePage() {
  const doses = [...NIGERIA_CHILD_SCHEDULE].sort(
    (a, b) => a.target_age_days - b.target_age_days
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <section className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
          MatPed Care
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          Child immunization scheduling &amp; WHO growth monitoring
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Built for healthcare workers and parents/guardians in Nigeria:
          evidence-based vaccine timelines with catch-up rules, and
          weight/length/head-circumference z-scores against the WHO Child
          Growth Standards.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700 ring-1 ring-brand-200">
            Schedule {SCHEDULE_VERSION}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 ring-1 ring-slate-200">
            {doses.length} scheduled doses
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 ring-1 ring-slate-200">
            WHO growth standards
          </span>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900">
          Nigeria child immunization schedule
        </h2>
        <p className="mt-1 text-sm text-slate-500">Source: {SCHEDULE_SOURCE}</p>
        <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-slate-200">
          <table className="w-full bg-white text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Vaccine</th>
                <th className="px-4 py-3">Dose</th>
                <th className="px-4 py-3">Target age</th>
                <th className="px-4 py-3">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {doses.map((d) => (
                <tr key={`${d.vaccine_code}-${d.dose_order}`}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {d.vaccine_name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{d.dose_label}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatAge(d.target_age_days)}
                  </td>
                  <td className="px-4 py-3">
                    {d.requires_review ? (
                      <span className="rounded-full bg-status-yellow-bg px-2 py-0.5 text-xs font-medium text-status-yellow-text ring-1 ring-status-yellow-border">
                        HW review
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
