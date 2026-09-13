import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'MatPed Care — Immunization & Growth Monitoring',
  description:
    'Digital child immunization scheduling and WHO growth monitoring for healthcare workers and parents/guardians in Nigeria.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 font-bold text-white">
                M
              </span>
              <div>
                <p className="text-sm font-semibold leading-tight">MatPed Care</p>
                <p className="text-xs text-slate-500 leading-tight">Immunization &amp; growth monitoring</p>
              </div>
            </div>
            <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
              <Link className="hover:text-brand-700" href="/">Home</Link>
              <Link className="hover:text-brand-700" href="/schedule">Schedule</Link>
              <Link className="hover:text-brand-700" href="/growth">Growth</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-slate-500">
            MatPed Care — Nigeria EPI schedule (WHO WIISE 2025) &amp; WHO Child Growth Standards.
            Clinical decision support only; always confirm against national guidelines.
          </div>
        </footer>
      </body>
    </html>
  );
}
