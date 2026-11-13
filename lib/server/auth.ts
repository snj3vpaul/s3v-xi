/**
 * v1 admin access: one shared passcode (ADMIN_PASSCODE). A correct passcode
 * sets an HttpOnly cookie holding an HMAC-signed expiry; nothing else to manage.
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "rsfc_admin";
const MAX_AGE_S = 60 * 60 * 24 * 14; // two weeks

function secret(): string {
  const s = process.env.SESSION_SECRET || process.env.ADMIN_PASSCODE;
  if (!s) {
    if (process.env.NODE_ENV === "production") throw new Error("Set ADMIN_PASSCODE (and SESSION_SECRET) to enable admin mode.");
    return "rsfc-dev-secret";
  }
  return s;
}

export function passcode(): string {
  const p = process.env.ADMIN_PASSCODE;
  if (p) return p;
  if (process.env.NODE_ENV === "production") throw new Error("ADMIN_PASSCODE is not set.");
  return "rsfc"; // local development only
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("hex");

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkPasscode(attempt: string): boolean {
  return safeEqual(sign(`pass:${attempt}`), sign(`pass:${passcode()}`));
}

export function makeToken(now = Date.now()): string {
  const exp = String(now + MAX_AGE_S * 1000);
  return `${exp}.${sign(exp)}`;
}

export function tokenValid(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !safeEqual(sig, sign(exp))) return false;
  return Number(exp) > now;
}

export async function isAdmin(): Promise<boolean> {
  try {
    return tokenValid((await cookies()).get(ADMIN_COOKIE)?.value);
  } catch {
    return false;
  }
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_S,
};
