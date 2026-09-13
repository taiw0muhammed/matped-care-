import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createSession, publicUser } from "@/lib/session";
import { logAudit } from "@/lib/guards";

const schema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  phone: z.string().min(7).max(20).optional().or(z.literal("")),
  role: z.enum(["NURSE", "PARENT"]).default("PARENT"),
  facilityName: z.string().max(120).optional().or(z.literal("")),
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
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
    await logAudit(user.id, null, "SIGNUP", { role });
    await createSession(user.id);
    return NextResponse.json({ user: publicUser(user) }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}