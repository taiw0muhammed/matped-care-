"use client";

export type ChartPoint = { t: number; v: number };

type Curves = Record<string, number[]>;

function fmtAge(days: number) {
  if (days < 60) return `${Math.round(days)}d`;
  if (days < 365) return `${Math.round(days / 30)}m`;
  return `${(days / 365).toFixed(1)}y`;
}

export function GrowthChart({
  title,
  unit,
  color,
  points,
  curves,
  maxAgeDays,
}: {
  title: string;
  unit: string;
  color: string;
  points: ChartPoint[];
  curves?: Curves;
  maxAgeDays: number;
}) {
  const W = 340;
  const H = 210;
  const PL = 36;
  const PR = 10;
  const PT = 14;
  const PB = 26;
  const maxAge = Math.max(maxAgeDays, 30);

  const allVals: number[] = [];
  for (const p of points) allVals.push(p.v);
  for (const key of ["-3", "0", "3"]) for (const v of curves?.[key] ?? []) allVals.push(v);
  if (allVals.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
        {title}: no data yet.
      </div>
    );
  }
  let lo = Math.min(...allVals);
  let hi = Math.max(...allVals);
  const pad = (hi - lo) * 0.12 || 1;
  lo -= pad;
  hi += pad;

  const x = (t: number) => PL + (Math.min(t, maxAge) / maxAge) * (W - PL - PR);
  const y = (v: number) => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);

  const curvePath = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"}${x((i / (vals.length - 1)) * maxAge).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  const monthTicks: number[] = [];
  for (let m = 0; m * 30.44 <= maxAge + 15; m++) monthTicks.push(m * 30.44);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-1 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
        <span className="text-[11px] text-slate-500">WHO {unit}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const v = lo + f * (hi - lo);
          return (
            <g key={f}>
              <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeWidth={1} />
              <text x={PL - 4} y={y(v) + 3} textAnchor="end" fontSize={8} fill="#64748b">
                {v.toFixed(1)}
              </text>
            </g>
          );
        })}
        {monthTicks.map((t) => (
          <text key={t} x={x(t)} y={H - 8} textAnchor="middle" fontSize={8} fill="#64748b">
            {fmtAge(t)}
          </text>
        ))}
        {curves?.["-3"] && <path d={curvePath(curves["-3"])} fill="none" stroke="#fda4af" strokeWidth={1.2} strokeDasharray="3 3" />}
        {curves?.["-2"] && <path d={curvePath(curves["-2"])} fill="none" stroke="#fcd34d" strokeWidth={1} strokeDasharray="2 3" />}
        {curves?.["0"] && <path d={curvePath(curves["0"])} fill="none" stroke="#94a3b8" strokeWidth={1.6} />}
        {curves?.["2"] && <path d={curvePath(curves["2"])} fill="none" stroke="#fcd34d" strokeWidth={1} strokeDasharray="2 3" />}
        {curves?.["3"] && <path d={curvePath(curves["3"])} fill="none" stroke="#fda4af" strokeWidth={1.2} strokeDasharray="3 3" />}
        {points.length > 1 && (
          <polyline
            points={points.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ")}
            fill="none"
            stroke={color}
            strokeWidth={2}
          />
        )}
        {points.map((p, i) => (
          <circle key={i} cx={x(p.t)} cy={y(p.v)} r={3.2} fill={color} stroke="#fff" strokeWidth={1} />
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-slate-500">
        <span><i className="mr-1 inline-block h-0.5 w-4 bg-slate-400 align-middle" />median (z=0)</span>
        <span><i className="mr-1 inline-block h-0.5 w-4 border-t border-dashed border-amber-400 align-middle" />z ±2</span>
        <span><i className="mr-1 inline-block h-0.5 w-4 border-t border-dashed border-rose-300 align-middle" />z ±3</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: color }} />child</span>
      </div>
    </div>
  );
}
