import { RATE_LIMITS } from "@/lib/league/config";
import { createSession, createUser } from "@/lib/league/service";
import { handler, json, readJson, setSessionCookie } from "@/lib/league/session";

export const POST = handler({ auth: "none", limit: { key: "signup", ...RATE_LIMITS.signup } }, async ({ db, req }) => {
  const body = await readJson(req);
  const user = await createUser(db, {
    name: body.name, email: body.email, password: body.password, avatar: body.avatar, inviteCode: body.inviteCode,
  }, { adminEmail: process.env.LEAGUE_ADMIN_EMAIL });
  const { token } = await createSession(db, user.id);
  const res = json({ user: { id: user.id, name: user.name, avatar: user.avatar, role: user.role } }, 201);
  setSessionCookie(res, token);
  return res;
});
