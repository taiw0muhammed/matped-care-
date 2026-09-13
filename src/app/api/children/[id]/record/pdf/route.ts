import { NextResponse } from "next/server";
import { getAuthorizedChild, requireUser } from "@/lib/guards";
import { apiError } from "@/lib/api";
import { buildChildRecord } from "@/lib/record";
import { generateChildRecordPdf } from "@/lib/pdf/child-record";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{  id: string  }> },
) {
  const {id} = await params;
  try {
    const user = await requireUser();
    const child = await getAuthorizedChild(id, user);
    if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const record = await buildChildRecord(child.id);
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const pdf = await generateChildRecordPdf(record);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="matped-record-${record.child.recordId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}