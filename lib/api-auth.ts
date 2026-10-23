import { NextRequest, NextResponse } from "next/server";
import { requestSupabase } from "./supabase";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type AuthResult = { db: SupabaseClient; user: User };
export async function authenticate(req: NextRequest, admin = false): Promise<AuthResult | NextResponse> {
  const db = requestSupabase(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
  if (!db) return error(503, "Database not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!match) return error(401, "Sign in to continue.");
  const { data, error: authError } = await db.auth.getUser(match[1]);
  if (authError || !data.user) return error(401, "Session expired. Sign in again.");
  if (admin) {
    const role = await db.from("s3v_admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
    if (role.error || !role.data) return error(403, "Administrator access required.");
  }
  return { db, user: data.user };
}
export function error(status: number, message: string) { return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } }); }
export function isResponse(result: AuthResult | NextResponse): result is NextResponse { return result instanceof NextResponse; }
export async function getBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  try { const value: unknown = await req.json(); return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; } catch { return null; }
}
export function textField(value: unknown, max = 150): string { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
