import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";
import { buildChildRecord } from "@/lib/record";

export const dynamic = "force-dynamic";

/**
 * Public (token-authenticated) access to the digital record.
 * No session required; token is a long random string and expires.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{  token: string  }> },
) {
  const {token} = await params;
  try {
    const share = await prisma.shareToken.findUnique({
      where: { token: token },
      include: { child: true },
    });
    if (!share || share.revoked || share.expiresAt < new Date()) {
      return NextResponse.json({ error: "Link is invalid or has expired" }, { status: 404 });
    }
    const record = await buildChildRecord(share.childId);
    if (!record) return NextResponse.json({ error: "Record not found" }, { status: 404 });
    return NextResponse.json({ record });
  } catch (e) {
    return apiError(e);
  }
}