"use client";

import { useCallback, useEffect, useState } from "react";
import { Empty, ErrorBox, PageHead, Spinner } from "@/components/ui";
import { ChildRow, statusChip } from "@/components/badges";

const FILTERS = ["", "ACTIVE", "INACTIVE", "TRANSFERRED", "DECEASED"];

export default function NurseChildrenPage() {
  const [children, setChildren] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(() => {
    setError(null);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    fetch(`/api/nurse/children?${params}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Failed to load children");
        setChildren(j.children ?? []);
      })
      .catch((e) => setError(e.message));
  }, [q, status]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  return (
    <div className="mx-auto max-w-2xl p-4 pb-16">
      <PageHead
        title="Children"
        sub={children ? `${children.length} in your care` : undefined}
        right={
          <a
            href="/nurse/children/new"
            className="rounded-lg bg-teal-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-teal-700"
          >
            + Register child
          </a>
        }
      />
      <div className="mt-4 space-y-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or record ID…"
          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        />
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatus(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                status === f
                  ? "bg-slate-800 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
              }`}
            >
              {f === "" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 space-y-2.5">
        {error ? (
          <ErrorBox message={error} onRetry={load} />
        ) : children === null ? (
          <Spinner label="Loading children…" />
        ) : children.length === 0 ? (
          <Empty
            title={q || status ? "No children match your search" : "No children registered yet"}
            hint={q || status ? "Try a different search or filter." : "Register your first child to start tracking growth and immunizations."}
          />
        ) : (
          children.map((c) => <ChildRow key={c.id} child={c} />)
        )}
      </div>
    </div>
  );
}