import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getAuthorizedChild, logAudit, HttpError } from "@/lib/guards";
import { apiError } from "@/lib/api";
import { sendSMS, sendEmail } from "@/lib/notifications/adapters";
import type { NotificationPayload } from "@/lib/notifications/adapters";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{  id: string  }> },
) {
  const {id} = await params;
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const child = await getAuthorizedChild(id, user);
    if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [visits, growth, immunizations, appointments] = await Promise.all([
      prisma.visit.findMany({ where: { childId: child.id }, orderBy: { visitDate: "desc" }, include: { nurse: { select: { id: true, fullName: true } } } }),
      prisma.growthMeasurement.findMany({ where: { childId: child.id }, orderBy: { measuredAt: "asc" } }),
      prisma.immunization.findMany({ where: { childId: child.id }, orderBy: { scheduled: "asc" } }),
      prisma.appointment.findMany({ where: { childId: child.id }, orderBy: { scheduledAt: "desc" } }),
    ]);
    return NextResponse.json({ child, visits, growth, immunizations, appointments });
  } catch (e) {
    return apiError(e);
  }
}

const patchSchema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  sex: z.enum(["MALE", "FEMALE", "UNKNOWN"]).optional(),
  dateOfBirth: z.string().optional(),
  bloodGroup: z.string().max(10).optional().or(z.literal("")),
  address: z.string().max(300).optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE", "DECEASED", "TRANSFERRED"]).optional(),
  guardianEmail: z.string().email().optional().or(z.literal("")),
  guardianName: z.string().max(120).optional().or(z.literal("")),
  guardianPhone: z.string().max(20).optional().or(z.literal("")),
  guardianRelation: z.string().max(40).optional().or(z.literal("")),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{  id: string  }> },
) {
  const {id} = await params;
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const child = await getAuthorizedChild(id, user);
    if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.role === "PARENT") throw new HttpError(403, "Parents cannot edit child records");

    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const data = parsed.data;
    const upd = {
      firstName: data.firstName,
      lastName: data.lastName,
      sex: data.sex,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      bloodGroup: data.bloodGroup || null,
      address: data.address || null,
      status: data.status,
    } as Record<string, unknown>;

    const updated = await prisma.child.update({ where: { id: child.id }, data: upd });

    // Upsert primary guardian link (by email of an existing parent account, else create one)
    if (data.guardianEmail) {
      const email = data.guardianEmail.toLowerCase();
      let guardianUser = await prisma.user.findUnique({ where: { email } });
      if (!guardianUser) {
        // create a parent account with a random password; nurse can share record afterwards
        const { hashPassword } = await import("@/lib/password");
        const tmp = Math.random().toString(36).slice(2) + Date.now().toString(36);
        guardianUser = await prisma.user.create({
          data: {
            email,
            passwordHash: await hashPassword(tmp),
            fullName: data.guardianName || "Guardian",
            phone: data.guardianPhone || null,
            role: "PARENT",
          },
        });
      } else if (data.guardianPhone || data.guardianName) {
        guardianUser = await prisma.user.update({
          where: { id: guardianUser.id },
          data: {
            phone: data.guardianPhone || guardianUser.phone,
            fullName: data.guardianName || guardianUser.fullName,
          },
        });
      }
      await prisma.guardian.upsert({
        where: { childId_userId: { childId: child.id, userId: guardianUser.id } },
        update: { relation: data.guardianRelation || null },
        create: { childId: child.id, userId: guardianUser.id, relation: data.guardianRelation || null },
      });
      // send a share link
      const shareUrl = `${req.headers.get("x-forwarded-proto") || "https"}://${req.headers.get("host")}/share/${updated.recordId}`;
      if (guardianUser.phone) {
        await sendSMS({ to: guardianUser.phone, title: "MatPed Care record", body: `Your child's immunization record is ready: ${shareUrl}`, channel: "SMS" } as NotificationPayload).catch(() => {});
      }
      if (guardianUser.email) {
        await sendEmail({ to: guardianUser.email, title: "Your child's MatPed Care digital record", body: `Open your child's secure digital immunization record: ${shareUrl}`, channel: "EMAIL" } as NotificationPayload).catch(() => {});
      }
    }

    await logAudit(user.id, child.id, "CHILD_UPDATE", { fields: Object.keys(data) });
    return NextResponse.json({ child: updated });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{  id: string  }> },
) {
  const {id} = await params;
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role === "PARENT") throw new HttpError(403, "Not allowed");
    const child = await getAuthorizedChild(id, user);
    if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.role === "NURSE") throw new HttpError(403, "Only admins can delete records");
    await prisma.child.delete({ where: { id: child.id } });
    await logAudit(user.id, child.id, "CHILD_DELETE", {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}