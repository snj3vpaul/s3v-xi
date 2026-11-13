import { NextResponse } from "next/server";
import { signUp } from "@/lib/league/ledger";
import type { User } from "@/lib/league/types";
import { HttpError, body, handle } from "@/lib/server/http";
import { MIN_PASSWORD, hashPassword } from "@/lib/server/password";
import { USER_COOKIE, throttle, userCookieOptions, userToken } from "@/lib/server/session";
import { ctx, mutate } from "@/lib/server/store";

export const POST = handle(async (req) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!throttle(`signup:${ip}`, 8)) throw new HttpError(429, "Too many sign-ups from here. Try again later.");
  const input = await body<{ email?: string; name?: string; password?: string; playerId?: string | null; code?: string }>(req);
  const required = process.env.SIGNUP_CODE;
  if (required && (input.code ?? "").trim().toLowerCase() !== required.trim().toLowerCase())
    throw new HttpError(403, "That club code isn't right. Ask in the RSFC group chat.");
  if (!input.password || input.password.length < MIN_PASSWORD) throw new HttpError(400, `Password must be at least ${MIN_PASSWORD} characters.`);
  const passwordHash = await hashPassword(input.password);
  let user: User | null = null;
  await mutate((s) => {
    const r = signUp(s, { email: input.email ?? "", name: input.name ?? "", passwordHash, playerId: input.playerId ?? null }, ctx());
    user = r.user;
    return r.state;
  });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(USER_COOKIE, userToken(user!), userCookieOptions);
  return res;
});
