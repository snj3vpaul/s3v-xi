import { NextResponse } from "next/server";
import { ADMIN_COOKIE, checkPasscode, cookieOptions, makeToken } from "@/lib/server/auth";
import { HttpError, body, handle } from "@/lib/server/http";

// Tiny in-memory throttle: 10 wrong guesses per IP per 10 minutes.
const fails = new Map<string, { n: number; until: number }>();

export const POST = handle(async (req) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const f = fails.get(ip);
  if (f && f.n >= 10 && f.until > Date.now()) throw new HttpError(429, "Too many attempts. Try again in a few minutes.");
  const { passcode } = await body<{ passcode?: string }>(req);
  if (!passcode || !checkPasscode(passcode)) {
    fails.set(ip, { n: (f && f.until > Date.now() ? f.n : 0) + 1, until: Date.now() + 10 * 60_000 });
    throw new HttpError(401, "Wrong passcode.");
  }
  fails.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, makeToken(), cookieOptions);
  return res;
});

export const DELETE = handle(async () => {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return res;
});
