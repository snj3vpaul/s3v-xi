import { SESSION_COOKIE } from "@/lib/league/config";
import { deleteSession } from "@/lib/league/service";
import { clearSessionCookie, handler, json } from "@/lib/league/session";

export const POST = handler({ auth: "none" }, async ({ db, req }) => {
  await deleteSession(db, req.cookies.get(SESSION_COOKIE)?.value);
  const res = json({ ok: true });
  clearSessionCookie(res);
  return res;
});
