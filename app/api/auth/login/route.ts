import { NextResponse } from "next/server";
import { HttpError, body, handle } from "@/lib/server/http";
import { verifyPassword } from "@/lib/server/password";
import { USER_COOKIE, throttle, userCookieOptions, userToken } from "@/lib/server/session";
import { getState } from "@/lib/server/store";

export const POST = handle(async (req) => {
  const { email, password } = await body<{ email?: string; password?: string }>(req);
  const key = (email ?? "").trim().toLowerCase();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!throttle(`login:${ip}`, 20) || !throttle(`login:${key}`, 10)) throw new HttpError(429, "Too many attempts. Try again in a few minutes.");
  const user = (await getState()).users.find((u) => u.email === key);
  if (!user || !password || !(await verifyPassword(password, user.passwordHash))) throw new HttpError(401, "Email or password is wrong.");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(USER_COOKIE, userToken(user), userCookieOptions);
  return res;
});

export const DELETE = handle(async () => {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(USER_COOKIE, "", { ...userCookieOptions, maxAge: 0 });
  return res;
});
