import { RATE_LIMITS } from "@/lib/league/config";
import { authenticate, createSession } from "@/lib/league/service";
import { handler, json, readJson, setSessionCookie } from "@/lib/league/session";

export const POST = handler({ auth: "none", limit: { key: "login", ...RATE_LIMITS.login } }, async ({ db, req }) => {
  const body = await readJson(req);
  const user = await authenticate(db, body.email, body.password);
  const { token } = await createSession(db, user.id);
  const res = json({ user: { id: user.id, name: user.name, avatar: user.avatar, role: user.role } });
  setSessionCookie(res, token);
  return res;
});
