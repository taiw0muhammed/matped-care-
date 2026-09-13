import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createSession, publicUser } from "@/lib/session";
import { logAudit } from "@/lib/guards";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    if (!user.active) {
      return NextResponse.json({ error: "This account has been deactivated" }, { status: 403 });
    }

    await createSession(user.id);
    await logAudit(user.id, null, "LOGIN", {});
    return NextResponse.json({ user: publicUser(user) });
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}