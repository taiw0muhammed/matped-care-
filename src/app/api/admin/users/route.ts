import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";
import { logAudit, requireRole } from "@/lib/guards";
import { hashPassword } from "@/lib/password";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** List all users (admin). */
export async function GET(_req: Request) {
  try {
    const user = await requireRole("ADMIN");
    const users = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        active: true,
        facilityName: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ users, self: user.id });
  } catch (e) {
    return apiError(e);
  }
}

const createSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  phone: z.string().min(7).max(20).optional().or(z.literal("")),
  role: z.enum(["NURSE", "PARENT", "ADMIN"]).default("NURSE"),
  facilityName: z.string().max(120).optional().or(z.literal("")),
});

/** Create a user (admin) — e.g. onboarding a new healthcare worker. */
export async function POST(req: Request) {
  try {
    const actor = await requireRole("ADMIN");
    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    const { fullName, email, password, phone, role, facilityName } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }
    const user = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        email: email.toLowerCase(),
        passwordHash: await hashPassword(password),
        phone: phone || null,
        role,
        facilityName: facilityName || null,
      },
    });
    await logAudit(actor.id, user.id, "USER_CREATE", { role, email: user.email });
    return NextResponse.json(
      { user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role } },
      { status: 201 },
    );
  } catch (e) {
    return apiError(e);
  }
}