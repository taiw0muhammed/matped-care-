import { randomBytes } from "node:crypto";

/**
 * Human-readable, unique record IDs, e.g. MP-2026-4F7Q2K.
 * Stable format documented in the digital record PDF.
 */
export function newRecordId(year = new Date().getFullYear()): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[randomBytes(1)[0] % alphabet.length];
  }
  return `MP-${year}-${suffix}`;
}

/** Opaque share/link token. */
export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}