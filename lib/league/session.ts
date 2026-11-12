import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { LEAGUE_LIMITS, SESSION_COOKIE } from "./config";
import { getDb, type Db } from "./db";
import { rateLimit } from "./rate-limit";
import { LeagueError, userForSession, type LeagueUser } from "./service";

/** For server components: the signed-in, active member (or null). */
export async function currentUser(): Promise<LeagueUser | null> {
  const jar = await cookies();
  const db = await getDb();
  return userForSession(db, jar.get(SESSION_COOKIE)?.value);
}

export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/",
    maxAge: LEAGUE_LIMITS.sessionDays * 86_400,
  });
}
export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
export function fail(status: number, message: string, extra: Record<string, unknown> = {}) {
  return json({ error: message, ...extra }, status);
}

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

/** CSRF defence for cookie-authenticated writes: the Origin must match this host. */
function sameOrigin(req: NextRequest): boolean {
  if (req.method === "GET" || req.method === "HEAD") return true;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try { return new URL(origin).host === host; } catch { return false; }
}

export async function readJson(req: NextRequest): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > 50_000) throw new LeagueError(413, "That request is too large.");
  try {
    const value: unknown = text ? JSON.parse(text) : {};
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch { /* fall through */ }
  throw new LeagueError(400, "Couldn't read that request.");
}

type Ctx = { db: Db; user: LeagueUser | null; req: NextRequest; params: Record<string, string> };
type Options = { auth?: "user" | "admin" | "none"; limit?: { key: string; max: number; windowMs: number } };

/**
 * Wraps a route handler with: origin check, DB access, auth/role check, rate limiting and
 * uniform error handling. Every league API route goes through this.
 */
export function handler(opts: Options, fn: (ctx: Ctx) => Promise<NextResponse>) {
  return async (req: NextRequest, route: { params: Promise<Record<string, string>> }) => {
    try {
      if (!sameOrigin(req)) return fail(403, "Request blocked (cross-site).");
      const db = await getDb();
      const user = await userForSession(db, req.cookies.get(SESSION_COOKIE)?.value);
      const need = opts.auth ?? "user";
      if (need !== "none" && !user) return fail(401, "Sign in to keep playing.");
      if (need === "admin" && user?.role !== "admin") return fail(403, "That's an admin-only move.");
      if (opts.limit) {
        const key = `${opts.limit.key}:${user?.id ?? clientIp(req)}`;
        const r = rateLimit(key, opts.limit);
        if (!r.ok) return NextResponse.json({ error: `Easy, tiger — too many tries. Wait ${r.retryAfterSec}s.` }, { status: 429, headers: { "Retry-After": String(r.retryAfterSec), "Cache-Control": "no-store" } });
      }
      const params = (await route?.params) ?? {};
      return await fn({ db, user, req, params });
    } catch (err) {
      if (err instanceof LeagueError) return fail(err.status, err.message);
      console.error("[league] unexpected error", err);
      return fail(500, "Something went sideways on our end. Try again in a moment.");
    }
  };
}
