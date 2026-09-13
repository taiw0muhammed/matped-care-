import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { getAuthorizedChild, logAudit, requireRole } from "@/lib/guards";
import { apiError } from "@/lib/api";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** List guardians linked to a child. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{  id: string  }> },
) {
  const {id} = await params;
  try {
    await requireRole("NURSE", "ADMIN");
    const child = await getAuthorizedChild(id, await requireRole("NURSE", "ADMIN"));
    if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const guardians = await prisma.guardian.findMany({
      where: { childId: child.id },
      include: { user: { select: { id: true, fullName: true, email: true, phone: true, role: true } } },
    });
    return NextResponse.json({ guardians });
  } catch (e) {
    return apiError(e);
  }
}

const linkSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(20).optional(),
  relation: z.string().max(40).optional().or(z.literal("")),
});

/**
 * Link a parent/guardian account to a child. Finds an existing PARENT user by
 * email or phone; if none exists and a name is provided, creates one with an
 * initial password so the parent can log in later (password reset via nurse).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{  id: string  }> },
) {
  const {id} = await params;
  try {
    const user = await requireRole("NURSE", "ADMIN");
    const child = await getAuthorizedChild(id, user);
    if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await req.json().catch(() => null);
    const parsed = linkSchema.safeParse(body ?? {});
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const { email, phone, name, relation } = parsed.data;

    if (!email && !phone) {
      return NextResponse.json({ error: "Provide an email or phone number" }, { status: 400 });
    }

    let parent = null;
    if (email) {
      parent = await prisma.user.findFirst({ where: { email: email.toLowerCase(), role: "PARENT" } });
    }
    if (!parent && phone) {
      parent = await prisma.user.findFirst({ where: { phone, role: "PARENT" } });
    }

    let created = false;
    if (!parent) {
      if (!email) return NextResponse.json({ error: "No parent found with that phone — an email is required to create a new account" }, { status: 400 });
      if (!name) return NextResponse.json({ error: "Name required to create a new parent account" }, { status: 400 });
      parent = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash: await hashPassword(`MatPed${Date.now().toString(36)}`),
          fullName: name,
          phone: phone || null,
          role: "PARENT",
        },
      });
      created = true;
    }

    const existing = await prisma.guardian.findUnique({
      where: { childId_userId: { childId: child.id, userId: parent.id } },
    });
    if (!existing) {
      await prisma.guardian.create({
        data: { childId: child.id, userId: parent.id, relation: relation || null },
      });
    } else if (relation && !existing.relation) {
      await prisma.guardian.update({
        where: { id: existing.id },
        data: { relation },
      });
    }

    await logAudit(user.id, child.id, "GUARDIAN_LINK", {
      guardian: parent.id,
      created,
      email: parent.email,
    });
    return NextResponse.json({ ok: true, created, guardian: { id: parent.id, fullName: parent.fullName } });
  } catch (e) {
    return apiError(e);
  }
}