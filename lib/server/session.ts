/**
 * Player accounts: a signed HttpOnly cookie `rsfc_user` = userId.sessionVersion.expiry.signature.
 * No session table — bumping a user's sessionVersion (password change/reset) signs them out everywhere.
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { User } from "@/lib/league/types";
import { getState } from "./store";

export const USER_COOKIE = "rsfc_user";
const MAX_AGE_S = 60 * 60 * 24 * 90; // 90 days — stay logged in on your phone

function secret() {
  const s = process.env.SESSION_SECRET || process.env.ADMIN_PASSCODE;
  if (!s) {
    if (process.env.NODE_ENV === "production") throw new Error("Set SESSION_SECRET to enable accounts.");
    return "rsfc-dev-secret";
  }
  return `user:${s}`;
}
const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("base64url");

export function userToken(user: Pick<User, "id" | "sessionVersion">, now = Date.now()) {
  const body = `${user.id}.${user.sessionVersion}.${now + MAX_AGE_S * 1000}`;
  return `${body}.${sign(body)}`;
}

export function parseUserToken(token: string | undefined, now = Date.now()): { id: string; version: number } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [id, version, exp, sig] = parts;
  const want = sign(`${id}.${version}.${exp}`);
  if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  if (Number(exp) <= now) return null;
  return { id, version: Number(version) };
}

export const userCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_S,
};

/** The logged-in user, or null. */
export async function currentUser(): Promise<User | null> {
  let token: string | undefined;
  try {
    token = (await cookies()).get(USER_COOKIE)?.value;
  } catch {
    return null;
  }
  const t = parseUserToken(token);
  if (!t) return null;
  const u = (await getState()).users.find((x) => x.id === t.id);
  return u && u.sessionVersion === t.version ? u : null;
}

/** Simple per-key throttle for login/sign-up (in-memory; fine for a club-sized app). */
const hits = new Map<string, { n: number; until: number }>();
export function throttle(key: string, max = 10, windowMs = 10 * 60_000): boolean {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.until < now) {
    hits.set(key, { n: 1, until: now + windowMs });
    return true;
  }
  h.n += 1;
  return h.n <= max;
}
