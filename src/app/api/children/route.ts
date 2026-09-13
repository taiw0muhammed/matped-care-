import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/guards";
import { newRecordId } from "@/lib/ids";
import { logAudit } from "@/lib/guards";

const createSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  sex: z.enum(["MALE", "FEMALE", "UNKNOWN"]),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  birthWeight: z.coerce.number().min(0.1).max(10).optional().or(z.literal("")),
  bloodGroup: z.string().max(10).optional().or(z.literal("")),
  address: z.string().max(300).optional().or(z.literal("")),
  guardianIds: z.array(z.string()).default([]),
  notes: z.string().max(500).optional().or(z.literal("")),
});

const childSelect = {
  nurse: { select: { id: true, fullName: true, facilityName: true } },
  guardians: { select: { id: true, relation: true, user: { select: { id: true, fullName: true, phone: true, email: true } } } },
} as const;

export async function GET(req: Request) {
  try {
    const user = await requireRole("NURSE", "ADMIN");
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const status = url.searchParams.get("status") ?? "";

    const children = await prisma.child.findMany({
      where: {
        ...(user.role === "NURSE" ? { nurseId: user.id } : {}),
        ...(status ? { status: status as any } : {}),
        ...(q
          ? {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { recordId: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: childSelect,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ children });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to load children" }, { status: e?.status ?? 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole("NURSE", "ADMIN");
    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    const d = parsed.data;

    // Only link guardians that actually belong to a PARENT user.
    const guardians =
      d.guardianIds.length > 0
        ? await prisma.guardian.findMany({
            where: { userId: { in: d.guardianIds } },
            include: { user: { select: { role: true } } },
          })
        : [];

    const child = await prisma.child.create({
      data: {
        recordId: newRecordId(),
        firstName: d.firstName.trim(),
        lastName: d.lastName.trim(),
        sex: d.sex,
        dateOfBirth: new Date(d.dateOfBirth),
        birthWeight: d.birthWeight || null,
        bloodGroup: d.bloodGroup || null,
        address: d.address || null,
        nurseId: user.id,
        guardians: {
          create: guardians.map((g) => ({
            userId: g.userId,
            relation: g.relation,
          })),
        },
      },
      include: childSelect,
    });
    await logAudit(user.id, child.id, "CHILD_CREATE", { recordId: child.recordId });
    return NextResponse.json({ child }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to create child" }, { status: e?.status ?? 500 });
  }
}