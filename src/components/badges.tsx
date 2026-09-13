import Link from "next/link";

const CHILD_STATUS_STYLES: Record<string, { chip: string; label: string }> = {
  ACTIVE: { chip: "bg-emerald-100 text-emerald-800", label: "Active" },
  INACTIVE: { chip: "bg-slate-100 text-slate-600", label: "Inactive" },
  DECEASED: { chip: "bg-slate-300 text-slate-700", label: "Deceased" },
  TRANSFERRED: { chip: "bg-amber-100 text-amber-800", label: "Transferred" },
};

export function ChildStatusChip({ status }: { status?: string | null }) {
  const s = CHILD_STATUS_STYLES[status ?? ""] ?? { chip: "bg-slate-100 text-slate-600", label: status || "—" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.chip}`}>
      {s.label}
    </span>
  );
}

/** Functional alias used by list pages: statusChip("ACTIVE") → chip. */
export function statusChip(status?: string | null) {
  return <ChildStatusChip status={status} />;
}

const ROLE_STYLES: Record<string, string> = {
  NURSE: "bg-sky-100 text-sky-800",
  PARENT: "bg-violet-100 text-violet-800",
  ADMIN: "bg-rose-100 text-rose-800",
};

export function RoleChip({ role }: { role?: string | null }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_STYLES[role ?? ""] ?? "bg-slate-100 text-slate-600"}`}>
      {role || "—"}
    </span>
  );
}

export function ChildRow({ child }: { child: any }) {
  const name = `${child.firstName} ${child.lastName}`.trim();
  const dob = new Date(child.dateOfBirth);
  const ageMonths = Math.floor((Date.now() - dob.getTime()) / (30.44 * 24 * 3600 * 1000));
  const guardian = child.guardians?.[0]?.user;
  return (
    <Link
      href={`/nurse/children/${child.id}`}
      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition hover:border-teal-400 hover:shadow-sm"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800 truncate">{name || "Unnamed child"}</span>
          <ChildStatusChip status={child.status} />
        </div>
        <div className="mt-0.5 text-xs text-slate-500">
          {dob.toLocaleDateString("en-NG")} · {ageMonths} mo · {child.sex === "FEMALE" ? "♀" : child.sex === "MALE" ? "♂" : "?"}
          {guardian?.phone ? ` · ${guardian.phone}` : ""}
        </div>
        {child.nurse && <div className="mt-0.5 text-xs text-slate-400">Nurse: {child.nurse.fullName}</div>}
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono text-[11px] text-slate-400">{child.recordId}</div>
        <div className="text-xs text-teal-600 font-medium">View →</div>
      </div>
    </Link>
  );
}