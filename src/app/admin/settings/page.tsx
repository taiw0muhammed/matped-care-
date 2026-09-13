"use client";

import { useCallback, useEffect, useState } from "react";
import { ErrorBox, PageHead, Spinner } from "@/components/ui";

const inputCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

const DESC: Record<string, string> = {
  platformName: "Name shown on records and receipts.",
  orgName: "Organization / facility name.",
  defaultLocale: "Default language code for messages.",
  smsEnabled: "Toggle SMS reminder dispatch (on/off).",
  emailEnabled: "Toggle email reminder dispatch (on/off).",
  pushEnabled: "Toggle push notification dispatch (on/off).",
  whatsappEnabled: "Toggle WhatsApp reminder dispatch (on/off).",
  geminiModel: "Gemini model used for AI growth insights.",
  dueSoonDays: "How many days ahead a dose counts as 'due soon'.",
  overdueGraceDays: "Grace period before a missed dose is flagged overdue.",
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  const load = useCallback(() => {
    setError(null);
    fetch("/api/admin/settings", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Failed to load settings");
        const s: Record<string, string> = {};
        for (const [k, v] of Object.entries(j.settings ?? {})) s[k] = String(v ?? "");
        setSettings(s);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const save = async () => {
    if (!settings) return;
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      const r = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Failed to save settings");
      setOk(true);
      setTimeout(() => setOk(false), 2500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="mx-auto max-w-xl p-4"><ErrorBox message={error} onRetry={load} /></div>;
  if (!settings) return <div className="p-10"><Spinner label="Loading settings…" /></div>;

  const keys = Object.keys(settings);

  return (
    <div className="mx-auto max-w-xl p-4 pb-16">
      <PageHead title="Platform settings" sub="Notification channels, growth rules and branding" />
      <div className="mt-4 space-y-3">
        {keys.map((k) => (
          <label key={k} className="block rounded-xl border border-slate-200 bg-white p-3.5 text-sm">
            <span className="mb-1 block font-semibold text-slate-800">
              {k} <span className="font-mono text-[11px] font-normal text-slate-400">({k})</span>
            </span>
            {DESC[k] && <span className="mb-1.5 block text-xs text-slate-400">{DESC[k]}</span>}
            {settings[k] === "true" || settings[k] === "false" ? (
              <select
                className={inputCls}
                value={settings[k]}
                onChange={(e) => setSettings((s) => ({ ...s!, [k]: e.target.value }))}
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input
                className={inputCls}
                value={settings[k]}
                onChange={(e) => setSettings((s) => ({ ...s!, [k]: e.target.value }))}
              />
            )}
          </label>
        ))}
        {keys.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
            No settings configured yet.
          </div>
        )}
      </div>
      {ok && <div className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">✓ Settings saved</div>}
      <button
        onClick={save}
        disabled={busy}
        className="mt-4 w-full rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}