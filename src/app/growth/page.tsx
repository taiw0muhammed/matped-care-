import {
  WFA_BOYS,
  WFA_GIRLS,
  LFA_BOYS,
  LFA_GIRLS,
  HFA_BOYS,
  HFA_GIRLS,
  WFL_BOYS,
  WFL_GIRLS,
  WFH_BOYS,
  WFH_GIRLS,
  HCFA_BOYS,
  HCFA_GIRLS,
  WHO_DATA_VERSION,
  WHO_DATA_SOURCE,
  type LmsPoint,
} from '@/lib/growth/who-data';

export const metadata = { title: 'Growth Monitoring — MatPed Care' };

const TABLES: { label: string; unit: string; boys: LmsPoint[]; girls: LmsPoint[] }[] = [
  { label: 'Weight-for-age', unit: 'kg', boys: WFA_BOYS, girls: WFA_GIRLS },
  { label: 'Length/Height-for-age', unit: 'cm', boys: LFA_BOYS.concat(HFA_BOYS), girls: LFA_GIRLS.concat(HFA_GIRLS) },
  { label: 'Weight-for-length/height', unit: 'kg', boys: WFL_BOYS, girls: WFL_GIRLS },
  { label: 'Weight-for-height', unit: 'kg', boys: WFH_BOYS, girls: WFH_GIRLS },
  { label: 'Head circumference-for-age', unit: 'cm', boys: HCFA_BOYS, girls: HCFA_GIRLS },
];

function ageRange(points: LmsPoint[]): string {
  if (points.length === 0) return '—';
  return `${points[0][0]}–${points[points.length - 1][0]}`;
}

export default function GrowthPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">WHO Child Growth Standards</h1>
        <p className="mt-1 text-sm text-slate-600">
          Reference LMS data version {WHO_DATA_VERSION}. {WHO_DATA_SOURCE}.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Indicator</th>
              <th className="px-4 py-3">Boys (points)</th>
              <th className="px-4 py-3">Girls (points)</th>
              <th className="px-4 py-3">X range</th>
              <th className="px-4 py-3">Unit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {TABLES.map((t) => (
              <tr key={t.label}>
                <td className="px-4 py-2 font-medium text-slate-800">{t.label}</td>
                <td className="px-4 py-2">{t.boys.length}</td>
                <td className="px-4 py-2">{t.girls.length}</td>
                <td className="px-4 py-2">{ageRange(t.boys)}</td>
                <td className="px-4 py-2">{t.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
