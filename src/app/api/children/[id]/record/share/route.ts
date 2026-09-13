import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedChild, logAudit, requireUser } from "@/lib/guards";
import { apiError } from "@/lib/api";
import { newToken } from "@/lib/ids";

export const dynamic = "force-dynamic";

/**
 * Create a time-limited share token so parents (or anyone with the link)
 * can open the digital record without a login. Expires in 7 days by default.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{  id: string  }> },
) {
  const {id} = await params;
  try {
    const user = await requireUser();
    const child = await getAuthorizedChild(id, user);
    if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const token = newToken(32);
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await prisma.shareToken.create({ data: { childId: child.id, token, expiresAt } });
    await logAudit(user.id, child.id, "SHARE_CREATE", { recordId: child.recordId });

    const shareUrl = `${process.env.NEXT_PUBLIC_BASE_URL || ""}/share/${token}`;
    return NextResponse.json({ token, shareUrl, expiresAt }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}