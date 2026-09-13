import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";
import { logAudit, requireRole } from "@/lib/guards";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** Read all platform settings (admin). */
export async function GET(_req: Request) {
  try {
    await requireRole("ADMIN");
    const settings = await prisma.appSetting.findMany();
    return NextResponse.json({ settings });
  } catch (e) {
    return apiError(e);
  }
}

const updateSchema = z.object({
  settings: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});

/** Upsert platform settings (admin). */
export async function PUT(req: Request) {
  try {
    const actor = await requireRole("ADMIN");
    const body = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 });
    }
    const entries = Object.entries(parsed.data.settings);
    await Promise.all(
      entries.map(([key, value]) =>
        prisma.appSetting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        }),
      ),
    );
    await logAudit(actor.id, null, "SETTINGS_UPDATE", { keys: entries.map(([k]) => k) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}