import type { Metadata } from 'next';
import {
  NIGERIA_CHILD_SCHEDULE,
  SCHEDULE_SOURCE,
  SCHEDULE_VERSION
} from '@/lib/immunization/nigeria';
import { formatAge } from '@/lib/immunization/schedule';

export const metadata: Metadata = { title: 'Immunization schedule — MatPed Care' };

const SEX_LABEL: Record<string, string> = {
  any: 'All',
  male: 'Boys',
  female: 'Girls'
};

export default function SchedulePage() {
  const items = NIGERIA_CHILD_SCHEDULE.filter((i) => i.is_active).sort(
    (a, b) => a.target_age_days - b.target_age_days || a.dose_order - b.dose_order
  );

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Nigeria EPI immunization schedule
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Version {SCHEDULE_VERSION} · {items.length} active items · Source:{' '}
          {SCHEDULE_SOURCE}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Vaccine</th>
              <th className="px-4 py-3">Dose</th>
              <th className="px-4 py-3">Target age</th>
              <th className="px-4 py-3">Min interval</th>
              <th className="px-4 py-3">Applies to</th>
              <th className="px-4 py-3">Review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((i) => (
              <tr key={`${i.vaccine_code}:${i.dose_order}`}>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {i.vaccine_name}
                </td>
                <td className="px-4 py-3">{i.dose_label}</td>
                <td className="px-4 py-3">{formatAge(i.target_age_days)}</td>
                <td className="px-4 py-3">
                  {i.min_interval_days ? formatAge(i.min_interval_days) : '—'}
                </td>
                <td className="px-4 py-3">{SEX_LABEL[i.applies_to] ?? i.applies_to}</td>
                <td className="px-4 py-3">
                  {i.requires_review ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                      Catch-up check
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
