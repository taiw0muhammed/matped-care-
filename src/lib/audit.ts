import { prisma } from "./prisma";

export async function logAudit(
  action: string,
  opts: { userId?: string | null; childId?: string | null; details?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: opts.userId ?? null,
        childId: opts.childId ?? null,
        action,
        details: (opts.details ?? {}) as object,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write", err);
  }
}