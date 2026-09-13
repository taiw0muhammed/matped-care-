"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorBox, PageHead, Spinner } from "@/components/ui";

const inputCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

export default function RegisterChildPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    sex: "FEMALE",
    dateOfBirth: "",
    birthWeight: "",
    bloodGroup: "",
    address: "",
    notes: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.firstName.trim() || !form.lastName.trim()) return setError("First and last name are required.");
    if (!form.dateOfBirth) return setError("Date of birth is required.");
    setBusy(true);
    try {
      const r = await fetch("/api/children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          sex: form.sex,
          dateOfBirth: form.dateOfBirth,
          birthWeight: form.birthWeight || "",
          bloodGroup: form.bloodGroup || "",
          address: form.address || "",
          notes: form.notes || "",
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Failed to register child");
      router.push(`/nurse/children/${j.child?.id ?? j.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl p-4 pb-16">
      <PageHead title="Register child" sub="Create a new digital immunization record" right={<a href="/nurse/children" className="text-sm font-medium text-teal-600">← Back</a>} />
      {error && <div className="mt-3"><ErrorBox message={error} /></div>}
      <form onSubmit={submit} className="mt-4 space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">First name *</span>
            <input className={inputCls} value={form.firstName} onChange={set("firstName")} required />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Last name *</span>
            <input className={inputCls} value={form.lastName} onChange={set("lastName")} required />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Sex *</span>
            <select className={inputCls} value={form.sex} onChange={set("sex")}>
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Date of birth *</span>
            <input type="date" className={inputCls} value={form.dateOfBirth} onChange={set("dateOfBirth")} required />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Birth weight (kg)</span>
            <input type="number" step="0.01" min="0.1" max="10" className={inputCls} value={form.birthWeight} onChange={set("birthWeight")} placeholder="3.2" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Blood group</span>
            <input className={inputCls} value={form.bloodGroup} onChange={set("bloodGroup")} placeholder="e.g. O+" />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Address</span>
          <input className={inputCls} value={form.address} onChange={set("address")} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Notes</span>
          <textarea className={inputCls} rows={2} value={form.notes} onChange={set("notes")} />
        </label>
        <p className="text-xs text-slate-400">
          Tip: after registering, open the child’s record to link a parent/guardian account and start recording visits, measurements and vaccines.
        </p>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
        >
          {busy ? <Spinner label="Registering…" /> : "Register child"}
        </button>
      </form>
    </div>
  );
}