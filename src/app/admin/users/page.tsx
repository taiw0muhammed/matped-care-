"use client";

import { useCallback, useEffect, useState } from "react";
import { ErrorBox, PageHead, Spinner } from "@/components/ui";
import { RoleChip } from "@/components/badges";

const inputCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[] | null>(null);
  const [selfId, setSelfId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string>("");
  const [form, setForm] = useState({ fullName: "", email: "", password: "", phone: "", facilityName: "", role: "NURSE" });
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetch("/api/admin/users", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Failed to load users");
        setUsers(j.users ?? []);
        setSelfId(j.self ?? "");
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);
    if (!form.fullName.trim() || !form.email.trim() || !form.password) {
      return setError("Full name, email and password are required.");
    }
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy(true);
    try {
      const r = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, fullName: form.fullName.trim(), email: form.email.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Failed to create user");
      setOk(`${j.user?.fullName ?? "User"} created successfully.`);
      setForm({ fullName: "", email: "", password: "", phone: "", facilityName: "", role: "NURSE" });
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const visible = (users ?? []).filter((u) => !role || u.role === role);

  return (
    <div className="mx-auto max-w-2xl p-4 pb-16">
      <PageHead title="Users" sub="Manage healthcare workers and parent accounts" />
      {error && <div className="mt-3"><ErrorBox message={error} onRetry={load} /></div>}
      {ok && <div className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">✓ {ok}</div>}

      <form onSubmit={create} className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-800">Create account</h3>
        <div className="grid grid-cols-2 gap-3">
          <input className={inputCls} placeholder="Full name" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
          <input className={inputCls} type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input className={inputCls} type="password" placeholder="Password (min 8 chars)" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          <input className={inputCls} placeholder="Phone (e.g. 0803…)" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select className={inputCls} value={form.role ?? "NURSE"} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
            <option value="NURSE">Nurse / Health worker</option>
            <option value="PARENT">Parent / Guardian</option>
            <option value="ADMIN">Admin</option>
          </select>
          <input className={inputCls} placeholder="Facility (for nurses)" value={form.facilityName} onChange={(e) => setForm((f) => ({ ...f, facilityName: e.target.value }))} />
        </div>
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
          {busy ? "Creating…" : "Create user"}
        </button>
      </form>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {["", "NURSE", "PARENT", "ADMIN"].map((r) => (
          <button key={r} onClick={() => setRole(r)} className={`rounded-full px-3 py-1 text-xs font-medium ${role === r ? "bg-slate-800 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>
            {r === "" ? "All" : r.charAt(0) + r.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        {users === null && !error ? <Spinner label="Loading users…" /> : (
          visible.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">No users in this role.</div> :
          visible.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-800">
                  {u.fullName} {u.id === selfId && <span className="text-xs font-normal text-slate-400">(you)</span>}
                </div>
                <div className="truncate text-xs text-slate-500">
                  {u.email}{u.phone ? ` · ${u.phone}` : ""}{u.facilityName ? ` · ${u.facilityName}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!u.active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">disabled</span>}
                <RoleChip role={u.role} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}