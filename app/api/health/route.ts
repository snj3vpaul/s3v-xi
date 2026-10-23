import { NextResponse } from "next/server";

// A public, intentionally low-information smoke-test endpoint.
export function GET() {
  return NextResponse.json(
    { status: "ok", app: "s3v-xi", mode: "fictional-demo" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
