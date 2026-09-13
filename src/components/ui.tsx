import Link from "next/link";

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-teal-700 border-t-transparent" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card border-l-4 border-l-rose-500">
      <p className="text-sm font-semibold text-rose-700">Something went wrong</p>
      <p className="mt-1 text-sm text-slate-600">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-ghost mt-3 px-3 py-1.5 text-sm">
          Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-2xl">📋</div>
      <p className="mt-3 text-sm font-semibold text-slate-700">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-sm text-slate-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function DoseStatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    completed: { label: "Given", cls: "bg-emerald-100 text-emerald-800" },
    due_today: { label: "Due today", cls: "bg-amber-100 text-amber-800" },
    due_soon: { label: "Due soon", cls: "bg-sky-100 text-sky-800" },
    overdue: { label: "Overdue", cls: "bg-rose-100 text-rose-800" },
    upcoming: { label: "Upcoming", cls: "bg-slate-100 text-slate-600" },
  };
  const m = map[status] ?? { label: status, cls: "bg-slate-100 text-slate-600" };
  return <span className={`chip ${m.cls}`}>{m.label}</span>;
}

export function GrowthBadge({ status, label }: { status: string; label?: string }) {
  const map: Record<string, { cls: string; text: string }> = {
    GREEN: { cls: "bg-emerald-100 text-emerald-800 ring-emerald-300", text: "Growth on track" },
    YELLOW: { cls: "bg-amber-100 text-amber-800 ring-amber-300", text: "Needs monitoring" },
    RED: { cls: "bg-rose-100 text-rose-800 ring-rose-300", text: "Needs clinical review" },
  };
  const m = map[status] ?? { cls: "bg-slate-100 text-slate-600 ring-slate-300", text: label ?? "No data" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ${m.cls}`}>
      <span className="h-2 w-2 rounded-full bg-current" />
      {label ?? m.text}
    </span>
  );
}

export function Age({ dob }: { dob: string | Date }) {
  const d = new Date(dob);
  const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  if (days < 60) return <span>{days} days</span>;
  if (days < 730) return <span>{Math.floor(days / 30.44)} months</span>;
  const y = Math.floor(days / 365.25);
  const m = Math.floor((days - y * 365.25) / 30.44);
  return <span>{y}y {m}m</span>;
}

export function RecordLink({ id }: { id: string }) {
  return (
    <span className="font-mono text-[11px] tracking-tight text-slate-400" title={id}>
      {id.slice(0, 14)}
    </span>
  );
}

export function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="post">
      <button type="submit" className="btn-ghost px-3 py-1.5 text-xs" title="Sign out">
        Sign out
      </button>
    </form>
  );
}

export function PageHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-slate-500">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export { Link };
export function Button({
  type = "button",
  busy = false,
  className = "",
  label,
  children,
  onClick,
  disabled,
}: {
  type?: "button" | "submit" | "reset";
  busy?: boolean;
  className?: string;
  label?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {busy && <Spinner />}
      {label ?? children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:max-w-lg sm:rounded-2xl sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
