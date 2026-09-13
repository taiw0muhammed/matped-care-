import { NextResponse } from "next/server";
import { HttpError } from "./guards";

export function apiError(e: unknown): NextResponse {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error("[api]", e);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}