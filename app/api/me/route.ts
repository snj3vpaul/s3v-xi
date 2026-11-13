import { NextResponse } from "next/server";
import { updateAccount } from "@/lib/league/ledger";
import { HttpError, body, handle } from "@/lib/server/http";
import { MIN_PASSWORD, hashPassword, verifyPassword } from "@/lib/server/password";
import { USER_COOKIE, currentUser, userCookieOptions, userToken } from "@/lib/server/session";
import { ctx, mutate } from "@/lib/server/store";

export const PUT = handle(async (req) => {
  const me = await currentUser();
  if (!me) throw new HttpError(401, "Log in first.");
  const input = await body<{ name?: string; playerId?: string | null; emailReminders?: boolean; currentPassword?: string; newPassword?: string }>(req);
  let passwordHash: string | undefined;
  if (input.newPassword) {
    if (input.newPassword.length < MIN_PASSWORD) throw new HttpError(400, `New password must be at least ${MIN_PASSWORD} characters.`);
    if (!input.currentPassword || !(await verifyPassword(input.currentPassword, me.passwordHash))) throw new HttpError(401, "Current password is wrong.");
    passwordHash = await hashPassword(input.newPassword);
  }
  const s = await mutate((x) =>
    updateAccount(x, me.id, { name: input.name, playerId: input.playerId, emailReminders: input.emailReminders, passwordHash }, ctx()),
  );
  const res = NextResponse.json({ ok: true });
  if (passwordHash) res.cookies.set(USER_COOKIE, userToken(s.users.find((u) => u.id === me.id)!), userCookieOptions); // stay logged in here
  return res;
});
