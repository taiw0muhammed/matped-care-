import type { NotificationChannel } from "@prisma/client";

export interface NotificationPayload {
  to: string;
  title: string;
  body: string;
  channel: NotificationChannel;
}

export interface AdapterResult {
  ok: boolean;
  provider: string;
  detail?: string;
}

const isConfigured = (v?: string) => !!v && v.length > 0;

/**
 * SMS via a generic HTTP provider (Termii default, any endpoint-compatible
 * service works). When no credentials are set the adapter returns a dry-run
 * success so the notification pipeline stays testable end-to-end.
 */
export async function sendSMS(p: NotificationPayload): Promise<AdapterResult> {
  const apikey = process.env.SMS_API_KEY;
  const from = process.env.SMS_FROM;
  const endpoint = process.env.SMS_ENDPOINT || "https://api.termii.com/v1/messages";
  if (!isConfigured(apikey)) {
    return { ok: true, provider: "dry-run", detail: `SMS (no credentials): to=${p.to} :: ${p.title} ${p.body}` };
  }
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apikey}` },
      body: JSON.stringify({
        to: p.to,
        from: from || "MATPED",
        message: `${p.title}: ${p.body}`,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, provider: "termii", detail: `${res.status} ${text.slice(0, 300)}` };
    }
    return { ok: true, provider: "termii" };
  } catch (e: any) {
    return { ok: false, provider: "termii", detail: String(e?.message ?? e) };
  }
}

/** Email via Nodemailer (SMTP). Dry-runs without SMTP credentials. */
export async function sendEmail(p: NotificationPayload): Promise<AdapterResult> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  if (!isConfigured(host) || !isConfigured(user)) {
    return { ok: true, provider: "dry-run", detail: `EMAIL (no SMTP): to=${p.to} :: ${p.title}` };
  }
  try {
    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user, pass: process.env.SMTP_PASS || "" },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"MatPed Care" <no-reply@matped.care>`,
      to: p.to,
      subject: p.title,
      text: p.body,
    });
    return { ok: true, provider: "smtp" };
  } catch (e: any) {
    return { ok: false, provider: "smtp", detail: String(e?.message ?? e) };
  }
}

/**
 * Push via Web Push (VAPID). Requires a public web app; server push is
 * skipped (in-app only) when no VAPID keys are configured.
 */
export async function sendPush(p: NotificationPayload): Promise<AdapterResult> {
  const subJson = process.env.PUSH_LAST_SUBSCRIPTION;
  if (!isConfigured(p.to) || !isConfigured(subJson)) {
    return { ok: true, provider: "dry-run", detail: `PUSH (in-app only): ${p.title}` };
  }
  try {
    const webpush = require("web-push");
    const sub = JSON.parse(subJson!);
    webpush.setVapidDetails(
      process.env.PUSH_VAPID_SUBJECT || "mailto:admin@matped.care",
      process.env.PUSH_VAPID_PUBLIC_KEY || "",
      process.env.PUSH_VAPID_PRIVATE_KEY || "",
    );
    await webpush.sendNotification(sub, JSON.stringify({ title: p.title, body: p.body }));
    return { ok: true, provider: "web-push" };
  } catch (e: any) {
    return { ok: false, provider: "web-push", detail: String(e?.message ?? e) };
  }
}

/** WhatsApp via Meta Cloud API. Dry-runs without a token. */
export async function sendWhatsApp(p: NotificationPayload): Promise<AdapterResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!isConfigured(token) || !isConfigured(phoneId)) {
    return { ok: true, provider: "dry-run", detail: `WHATSAPP (no token): to=${p.to} :: ${p.title}` };
  }
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: p.to,
        type: "text",
        text: { body: `${p.title}\n${p.body}` },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, provider: "whatsapp", detail: `${res.status} ${text.slice(0, 300)}` };
    }
    return { ok: true, provider: "whatsapp" };
  } catch (e: any) {
    return { ok: false, provider: "whatsapp", detail: String(e?.message ?? e) };
  }
}

export const ADAPTERS: Record<NotificationChannel, (p: NotificationPayload) => Promise<AdapterResult>> = {
  SMS: sendSMS,
  EMAIL: sendEmail,
  PUSH: sendPush,
  WHATSAPP: sendWhatsApp,
};