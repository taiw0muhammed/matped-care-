import Link from "next/link";
import { LogoutButton } from "./ui";

const NAV: Record<string, { label: string; icon: string; href: string }[]> = {
  NURSE: [
    { label: "Dashboard", icon: "🏥", href: "/nurse" },
    { label: "Children", icon: "👶", href: "/nurse#children" },
    { label: "Alerts", icon: "🔔", href: "/nurse/alerts" },
    { label: "Appointments", icon: "📅", href: "/nurse/appointments" },
  ],
  PARENT: [
    { label: "Home", icon: "🏠", href: "/parent" },
    { label: "Children", icon: "👶", href: "/parent#children" },
  ],
  ADMIN: [
    { label: "Overview", icon: "📊", href: "/admin" },
    { label: "Users", icon: "👥", href: "/admin/users" },
    { label: "Settings", icon: "⚙️", href: "/admin/settings" },
  ],
};

export function Shell({
  role,
  name,
  children,
}: {
  role: string;
  name: string;
  children: React.ReactNode;
}) {
  const items = NAV[role] ?? NAV.NURSE;
  return (
    <div className="min-h-screen bg-slate-100 pb-20 md:pb-8">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-lg text-white">
              🩺
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-slate-900">MatPed Care</p>
              <p className="text-[11px] leading-tight text-slate-500">{name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="chip hidden bg-teal-50 text-teal-800 sm:inline-flex">{role}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:static md:mt-8 md:border-0 md:bg-transparent">
        <div className="mx-auto flex max-w-5xl items-center justify-around md:justify-start md:gap-6 md:px-4 md:pb-0">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="flex flex-col items-center gap-0.5 px-4 py-2.5 text-[11px] font-semibold text-slate-500 hover:text-teal-700 md:flex-row md:gap-2 md:py-0 md:text-sm"
            >
              <span className="text-lg leading-none md:text-base">{it.icon}</span>
              {it.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}