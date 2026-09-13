"use client";
import { useState } from "react";
import { Button, Field, Input, Select, TextArea, Modal } from "./ui";

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const stamp = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

function useAsync() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await fn();
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, done, run };
}

function FormFooter({ a, onSave, label = "Save" }: { a: ReturnType<typeof useAsync>; onSave: () => void; label?: string }) {
  return (
    <div className="space-y-2">
      {a.error && <p className="text-sm text-rose-600">{a.error}</p>}
      {a.done && <p className="text-sm text-emerald-600">Saved ✓</p>}
      <Button type="submit" busy={a.busy} className="w-full" label={label} />
    </div>
  );
}

export function ChildForm({ onSaved }: { onSaved: (id: string) => void }) {
  const [f, setF] = useState({
    firstName: "", lastName: "", sex: "MALE", dateOfBirth: "",
    birthWeight: "", bloodGroup: "", address: "",
    guardianName: "", guardianPhone: "", guardianEmail: "",
  });
  const a = useAsync();
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  return (
    <form className="space-y-3" onSubmit={(e: React.FormEvent) => {
      e.preventDefault();
      a.run(async () => {
        const body: Record<string, unknown> = {
          firstName: f.firstName.trim(),
          lastName: f.lastName.trim(),
          sex: f.sex,
          dateOfBirth: f.dateOfBirth,
          birthWeight: f.birthWeight || "",
          bloodGroup: f.bloodGroup || "",
          address: f.address || "",
        };
        if (!body.firstName || !body.lastName || !f.dateOfBirth) throw new Error("First name, last name and date of birth are required");
        const data = await post("/api/children", body);
        const id = data.child?.id;
        if (f.guardianEmail || f.guardianPhone) {
          await post(`/api/children/${id}/guardians`, {
            name: f.guardianName || "Guardian",
            phone: f.guardianPhone,
            email: f.guardianEmail,
          }).catch(() => null);
        }
        onSaved(id);
      });
    }}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name *"><Input value={f.firstName} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("firstName", e.target.value)} required /></Field>
        <Field label="Last name *"><Input value={f.lastName} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("lastName", e.target.value)} required /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sex *"><Select value={f.sex} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("sex", e.target.value)}><option value="MALE">Male</option><option value="FEMALE">Female</option></Select></Field>
        <Field label="Date of birth *"><Input type="date" value={f.dateOfBirth} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("dateOfBirth", e.target.value)} required /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Birth weight (kg)"><Input type="number" step="0.1" value={f.birthWeight} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("birthWeight", e.target.value)} placeholder="e.g. 3.2" /></Field>
        <Field label="Blood group"><Input value={f.bloodGroup} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("bloodGroup", e.target.value)} placeholder="e.g. O+" /></Field>
      </div>
      <Field label="Address"><Input value={f.address} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("address", e.target.value)} /></Field>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Parent / guardian (optional)</p>
        <div className="space-y-2">
          <Field label="Name"><Input value={f.guardianName} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("guardianName", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Phone"><Input value={f.guardianPhone} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("guardianPhone", e.target.value)} placeholder="+234…" /></Field>
            <Field label="Email"><Input type="email" value={f.guardianEmail} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("guardianEmail", e.target.value)} /></Field>
          </div>
        </div>
      </div>
      <FormFooter a={a} onSave={() => {}} label="Register child" />
    </form>
  );
}

export function MeasurementForm({ childId, onSaved }: { childId: string; onSaved?: () => void }) {
  const [f, setF] = useState({ measuredAt: stamp(), weightKg: "", lengthCm: "", headCircCm: "", notes: "" });
  const a = useAsync();
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  return (
    <form className="space-y-3" onSubmit={(e: React.FormEvent) => {
      e.preventDefault();
      a.run(async () => {
        if (!f.measuredAt) throw new Error("Measurement date is required");
        const w = parseFloat(f.weightKg);
        if (!w || w <= 0) throw new Error("Enter a valid weight in kg");
        await post(`/api/children/${childId}/growth`, {
          measuredAt: f.measuredAt,
          weightKg: w,
          lengthCm: f.lengthCm ? parseFloat(f.lengthCm) : null,
          headCircCm: f.headCircCm ? parseFloat(f.headCircCm) : null,
          notes: f.notes,
        });
        onSaved?.();
      });
    }}>
      <Field label="Date & time *"><Input type="datetime-local" value={f.measuredAt} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("measuredAt", e.target.value)} /></Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Weight (kg) *"><Input type="number" step="0.01" value={f.weightKg} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("weightKg", e.target.value)} /></Field>
        <Field label="Length (cm)"><Input type="number" step="0.1" value={f.lengthCm} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("lengthCm", e.target.value)} /></Field>
        <Field label="Head (cm)"><Input type="number" step="0.1" value={f.headCircCm} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("headCircCm", e.target.value)} /></Field>
      </div>
      <Field label="Notes"><TextArea rows={2} value={f.notes} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("notes", e.target.value)} /></Field>
      <FormFooter a={a} onSave={() => {}} label="Record measurement" />
    </form>
  );
}

export function ImmunizationForm({ childId, onSaved }: { childId: string; onSaved?: () => void }) {
  const vaccines = [
    ["BCG", "BCG (Tuberculosis)"], ["OPV", "OPV (Polio)"], ["PENT", "Pentavalent (DTaP-HepB-Hib)"],
    ["PCV", "PCV (Pneumococcal)"], ["MR", "MR (Measles-Rubella)"], ["HIB", "Hib"],
  ] as const;
  const [f, setF] = useState({ vaccine: "BCG", dose: "1", givenAt: stamp(), batchNo: "", site: "", route: "", reason: "" });
  const a = useAsync();
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  return (
    <form className="space-y-3" onSubmit={(e: React.FormEvent) => {
      e.preventDefault();
      a.run(async () => {
        if (!f.givenAt) throw new Error("Date given is required");
        await post(`/api/children/${childId}/immunizations`, {
          vaccine: f.vaccine,
          dose: parseInt(f.dose, 10),
          givenAt: f.givenAt,
          batchNo: f.batchNo,
          site: f.site,
          route: f.route,
          reason: f.reason,
        });
        onSaved?.();
      });
    }}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Vaccine *"><Select value={f.vaccine} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("vaccine", e.target.value)}>{vaccines.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</Select></Field>
        <Field label="Dose # *"><Select value={f.dose} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("dose", String(e.target.value))}>{[0,1,2,3,4].map((d) => <option key={d} value={d}>Dose {d}</option>)}</Select></Field>
      </div>
      <Field label="Date given *"><Input type="datetime-local" value={f.givenAt} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("givenAt", e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Batch no."><Input value={f.batchNo} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("batchNo", e.target.value)} /></Field>
        <Field label="Site"><Input value={f.site} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("site", e.target.value)} placeholder="Left upper arm" /></Field>
      </div>
      <Field label="Route"><Input value={f.route} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("route", e.target.value)} placeholder="IM / ID / Oral" /></Field>
      <Field label="Reason / note"><TextArea rows={2} value={f.reason} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("reason", e.target.value)} /></Field>
      <FormFooter a={a} onSave={() => {}} label="Record vaccine" />
    </form>
  );
}

export function VisitForm({ childId, onSaved }: { childId: string; onSaved?: () => void }) {
  const [f, setF] = useState({ visitDate: stamp(), visitType: "Routine", diagnoses: "", notes: "" });
  const a = useAsync();
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  return (
    <form className="space-y-3" onSubmit={(e: React.FormEvent) => {
      e.preventDefault();
      a.run(async () => {
        if (!f.visitDate) throw new Error("Visit date is required");
        await post(`/api/children/${childId}/visits`, {
          visitDate: f.visitDate,
          visitType: f.visitType,
          diagnoses: f.diagnoses,
          notes: f.notes,
        });
        onSaved?.();
      });
    }}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date *"><Input type="datetime-local" value={f.visitDate} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("visitDate", e.target.value)} /></Field>
        <Field label="Type"><Select value={f.visitType} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("visitType", e.target.value)}><option>Routine</option><option>Follow-up</option><option>Urgent</option><option>Immunization</option></Select></Field>
      </div>
      <Field label="Diagnoses"><TextArea rows={2} value={f.diagnoses} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("diagnoses", e.target.value)} /></Field>
      <Field label="Notes"><TextArea rows={2} value={f.notes} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("notes", e.target.value)} /></Field>
      <FormFooter a={a} onSave={() => {}} label="Save visit" />
    </form>
  );
}

export function AppointmentForm({ childId, onSaved }: { childId: string; onSaved?: () => void }) {
  const [f, setF] = useState({ scheduledAt: stamp(), reason: "Follow-up visit", status: "SCHEDULED" });
  const a = useAsync();
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  return (
    <form className="space-y-3" onSubmit={(e: React.FormEvent) => {
      e.preventDefault();
      a.run(async () => {
        if (!f.scheduledAt) throw new Error("Date is required");
        await post(`/api/children/${childId}/appointments`, {
          scheduledAt: f.scheduledAt,
          reason: f.reason,
          status: f.status,
        });
        onSaved?.();
      });
    }}>
      <Field label="Date & time *"><Input type="datetime-local" value={f.scheduledAt} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("scheduledAt", e.target.value)} /></Field>
      <Field label="Reason *"><Input value={f.reason} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("reason", e.target.value)} /></Field>
      <Field label="Status"><Select value={f.status} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("status", e.target.value)}><option value="SCHEDULED">Scheduled</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option><option value="NO_SHOW">No show</option></Select></Field>
      <FormFooter a={a} onSave={() => {}} label="Book appointment" />
    </form>
  );
}

export function LinkParentForm({ childId, onSaved }: { childId: string; onSaved?: () => void }) {
  const [f, setF] = useState({ name: "", phone: "", email: "", relation: "Mother" });
  const a = useAsync();
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  return (
    <form className="space-y-3" onSubmit={(e: React.FormEvent) => {
      e.preventDefault();
      a.run(async () => {
        if (!f.email && !f.phone) throw new Error("Email or phone is required");
        await post(`/api/children/${childId}/guardians`, {
          name: f.name, phone: f.phone, email: f.email, relation: f.relation,
        });
        onSaved?.();
      });
    }}>
      <Field label="Guardian name"><Input value={f.name} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("name", e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Phone"><Input value={f.phone} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("phone", e.target.value)} placeholder="+234…" /></Field>
        <Field label="Email *"><Input type="email" value={f.email} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("email", e.target.value)} /></Field>
      </div>
      <Field label="Relation"><Select value={f.relation} onChange={(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => set("relation", e.target.value)}><option>Mother</option><option>Father</option><option>Guardian</option></Select></Field>
      <FormFooter a={a} onSave={() => {}} label="Link parent" />
    </form>
  );
}

export function NewChildModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (id: string) => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Register new child">
      <ChildForm onSaved={onSaved} />
    </Modal>
  );
}