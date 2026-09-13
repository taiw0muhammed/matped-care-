"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const home = { NURSE: "/nurse", PARENT: "/parent", ADMIN: "/admin" } as Record<string, string>;

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    role: "NURSE",
    facilityName: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Signup failed");
      router.replace(home[data.user?.role] ?? "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-6 flex items-center gap-2 self-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-xl font-bold text-white">
          M
        </div>
        <span className="text-xl font-bold">MatPed Care</span>
      </Link>
      <div className="card">
        <h1 className="text-xl font-bold">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">Healthcare workers and parents can register here.</p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <span className="label">I am a</span>
            <div className="grid grid-cols-2 gap-2">
              {(["NURSE", "PARENT"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => set("role", r)}
                  className={
                    "rounded-xl border px-3 py-2.5 text-sm font-semibold transition " +
                    (form.role === r
                      ? "border-teal-700 bg-teal-50 text-teal-800"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50")
                  }
                >
                  {r === "NURSE" ? "Nurse / health worker" : "Parent / guardian"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Full name</label>
            <input className="input" required value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="e.g. Amina Bello" />
          </div>
          {form.role === "NURSE" && (
            <div>
              <label className="label">Facility</label>
              <input className="input" value={form.facilityName} onChange={(e) => set("facilityName", e.target.value)} placeholder="e.g. Kano Municipal PHC" />
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label className="label">Phone (for SMS reminders)</label>
            <input className="input" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="e.g. +234 803 000 0000" />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" required minLength={8} value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="At least 8 characters" />
          </div>
          {error && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>
          )}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>
      </div>
      <p className="mt-4 text-center text-sm text-slate-600">
        Already registered?{" "}
        <Link href="/login" className="font-semibold text-teal-700">
          Log in
        </Link>
      </p>
    </main>
  );
}