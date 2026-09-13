import Link from "next/link";

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-lg font-bold text-white">
            M
          </div>
          <span className="text-lg font-bold tracking-tight">MatPed Care</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost">
            Log in
          </Link>
          <Link href="/signup" className="btn-primary">
            Get started
          </Link>
        </nav>
      </header>

      <section className="py-14 text-center sm:py-20">
        <span className="chip bg-teal-100 text-teal-800">Nigeria • WHO-aligned</span>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
          Digital immunization records &amp; growth monitoring for every child
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          MatPed Care replaces paper immunization cards with secure digital records, tracks the
          Nigerian routine immunization schedule, flags missed doses, and monitors growth with
          WHO child growth standards.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/signup" className="btn-primary px-6 py-3 text-base">
            Create your account
          </Link>
          <Link href="/login" className="btn-ghost px-6 py-3 text-base">
            I already have access
          </Link>
        </div>
      </section>

      <section className="grid gap-4 pb-16 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Nurse workspace", "Register children, record visits, vaccines and measurements — mobile-first."],
          ["Parent app", "Your children’s full immunization history and growth charts, with PDF records."],
          ["Smart reminders", "Due, due-soon and overdue doses with SMS, email and push notifications."],
          ["WHO growth standards", "Z-scores, green/yellow/red status and AI growth insights — never a diagnosis."],
        ].map(([title, body]) => (
          <div key={title} className="card">
            <h3 className="font-bold">{title}</h3>
            <p className="mt-1.5 text-sm text-slate-600">{body}</p>
          </div>
        ))}
      </section>

      <footer className="mt-auto border-t border-slate-200 py-6 text-center text-sm text-slate-500">
        MatPed Care — built for Nigerian primary healthcare.
      </footer>
    </main>
  );
}