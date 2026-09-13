import PDFDocument from "pdfkit";
import type { ChildRecord } from "../record";
import { fmtDate, fmtAge } from "../dates";

/**
 * Render the full digital child record as a PDF (application/pdf bytes).
 * Replaces the paper immunization book — includes child info, guardian info,
 * immunization history, growth history and visit records.
 */
export async function generateChildRecordPdf(record: ChildRecord): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const GREEN = "#16a34a";
    const YELLOW = "#d97706";
    const RED = "#dc2626";
    const INK = "#111827";
    const MUTED = "#6b7280";
    const LINE = "#e5e7eb";

    // Header band
    doc.rect(0, 0, doc.page.width, 92).fill("#0f766e");
    doc.fill(INK).font("Helvetica-Bold").fontSize(18).text("MatPed Care", 40, 30);
    doc.font("Helvetica").fontSize(10).fillColor("#ccfbf1")
      .text("Digital Child Immunization & Growth Record", 40, 52);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#ffffff")
      .text(`Record ID: ${record.child.recordId}`, 40, 70);

    let y = 108;

    const section = (title: string) => {
      if (y > doc.page.height - 80) {
        doc.addPage();
        y = 50;
      }
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f766e").text(title.toUpperCase(), 40, y, { lineBreak: false });
      y += 16;
      doc.moveTo(40, y - 12).lineTo(doc.page.width - 40, y - 12).strokeColor(LINE).lineWidth(1).stroke();
    };

    const kv = (label: string, value: string | null | undefined) => {
      if (!value) return;
      if (y > doc.page.height - 40) {
        doc.addPage();
        y = 50;
      }
      doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text(label, 48, y, { lineBreak: false, width: 110 });
      doc.font("Helvetica").fillColor(INK).text(String(value), 162, y, { lineBreak: false, width: doc.page.width - 210 });
      y += 15;
    };

    // Child information
    section("Child Information");
    const c = record.child;
    kv("Full name", `${c.firstName} ${c.lastName}`);
    kv("Sex", c.sex === "UNKNOWN" ? "Not recorded" : c.sex.charAt(0) + c.sex.slice(1).toLowerCase());
    kv("Date of birth", `${fmtDate(c.dateOfBirth)} (${fmtAge(c.dateOfBirth)})`);
    if (c.birthWeight != null) kv("Birth weight", `${c.birthWeight.toFixed(1)} kg`);
    if (c.bloodGroup) kv("Blood group", c.bloodGroup);
    if (c.address) kv("Address", c.address);
    kv("Status", c.status.charAt(0) + c.status.slice(1).toLowerCase());
    if (c.nurse) kv("Assigned nurse", `${c.nurse.fullName}${c.nurse.facilityName ? ` — ${c.nurse.facilityName}` : ""}`);
    y += 4;

    // Guardian information
    section("Parent / Guardian");
    if (record.guardians.length === 0) kv("Guardian", "Not linked");
    for (const g of record.guardians) {
      kv(`Guardian${g.relation ? ` (${g.relation})` : ""}`, g.user.fullName);
      if (g.user.phone) kv("Phone", g.user.phone);
      if (g.user.email) kv("Email", g.user.email);
    }
    y += 4;

    // Growth status
    section("Growth Status (WHO standards)");
    const statusColor = record.growth.assessment.status === "GREEN" ? GREEN : record.growth.assessment.status === "YELLOW" ? YELLOW : RED;
    const statusText =
      record.growth.assessment.status === "GREEN" ? "Appropriate growth" :
      record.growth.assessment.status === "YELLOW" ? "Needs monitoring" : "May require clinical assessment";
    doc.font("Helvetica-Bold").fontSize(10).fillColor(statusColor).text(statusText, 48, y);
    y += 15;
    for (const ind of record.growth.assessment.indicators) {
      kv(ind.label, `z = ${ind.zScore.toFixed(2)}  (percentile ${ind.percentile.toFixed(0)}, ${ind.band.replace("_", " ")})`);
    }
    if (record.growth.assessment.flags.length) {
      kv("Flags", record.growth.assessment.flags.join("; "));
    }
    y += 4;

    // Immunization history
    section("Immunization History (Nigeria routine schedule)");
    let lastY = y;
    for (const dose of record.immunizations) {
      if (y > doc.page.height - 36) {
        doc.addPage();
        y = 50;
        lastY = y;
      }
      const when = dose.givenAt ? fmtDate(dose.givenAt) : "—";
      const status = dose.givenAt ? (dose.status === "SCHEDULED" ? "Given" : dose.status) : (dose.deferred ? "Deferred" : `Due ${fmtDate(dose.scheduled)}`);
      doc.font("Helvetica").fontSize(9).fillColor(INK).text(`${dose.vaccine} — Dose ${dose.dose}`, 48, y, { lineBreak: false, width: 170 });
      doc.fillColor(MUTED).text(`Given: ${when}`, 222, y, { lineBreak: false, width: 110 });
      doc.text(status, 340, y, { lineBreak: false, width: 150 });
      if (dose.batchNo) {
        doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(`Batch ${dose.batchNo}${dose.site ? ` • ${dose.site}` : ""}`, 340, y + 10, { lineBreak: false });
        y += 20;
      } else {
        y += 14;
      }
    }
    if (record.immunizations.length === 0) {
      doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text("No immunization doses recorded yet.", 48, y);
      y += 15;
    }
    y += 4;

    // Growth history
    section("Growth History");
    for (const m of record.growth.measurements.slice().reverse()) {
      if (y > doc.page.height - 36) {
        doc.addPage();
        y = 50;
      }
      const parts: string[] = [fmtDate(m.measuredAt)];
      if (m.weightKg != null) parts.push(`${m.weightKg.toFixed(2)} kg`);
      if (m.lengthCm != null) parts.push(`${m.lengthCm.toFixed(1)} cm`);
      if (m.headCircCm != null) parts.push(`HC ${m.headCircCm.toFixed(1)} cm`);
      if (m.status) parts.push(`[${m.status}]`);
      doc.font("Helvetica").fontSize(9).fillColor(INK).text(parts.join("   "), 48, y, { lineBreak: false });
      if (m.notes) {
        doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(m.notes, 56, y + 10);
        y += 21;
      } else {
        y += 14;
      }
    }
    if (record.growth.measurements.length === 0) {
      doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text("No growth measurements recorded yet.", 48, y);
      y += 15;
    }
    y += 4;

    // Visit records
    section("Visit Records");
    for (const v of record.visits.slice().reverse()) {
      if (y > doc.page.height - 40) {
        doc.addPage();
        y = 50;
      }
      const nurseName = v.nurse ? ` — ${v.nurse.fullName}` : "";
      doc.font("Helvetica").fontSize(9).fillColor(INK)
        .text(`${fmtDate(v.visitDate)} • ${v.visitType.charAt(0) + v.visitType.slice(1).toLowerCase()}${nurseName}`, 48, y, { lineBreak: false });
      y += 13;
      if (v.notes) {
        doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(v.notes, 48, y, { width: doc.page.width - 96 });
        y += doc.heightOfString(v.notes, { width: doc.page.width - 96 }) + 6;
      }
      if (v.diagnoses) {
        doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(`Diagnoses: ${v.diagnoses}`, 48, y, { width: doc.page.width - 96 });
        y += doc.heightOfString(`Diagnoses: ${v.diagnoses}`, { width: doc.page.width - 96 }) + 6;
      }
    }
    if (record.visits.length === 0) {
      doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text("No visits recorded yet.", 48, y);
      y += 15;
    }

    // Footer
    doc.font("Helvetica").fontSize(8).fillColor(MUTED)
      .text(
        `Generated by MatPed Care on ${fmtDate(new Date())}. This digital record replaces the paper immunization book. ` +
        `Growth assessment follows WHO Child Growth Standards; it supports — but does not replace — clinical judgement.`,
        40, doc.page.height - 46,
        { width: doc.page.width - 80, align: "center", lineBreak: true },
      );

    doc.end();
  });
}