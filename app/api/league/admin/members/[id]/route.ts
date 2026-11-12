import { RATE_LIMITS } from "@/lib/league/config";
import { setMemberStatus } from "@/lib/league/service";
import { handler, json, readJson } from "@/lib/league/session";

/** Body: { status: "active" | "removed" } — removal keeps history and can be undone. */
export const PATCH = handler({ auth: "admin", limit: { key: "admin", ...RATE_LIMITS.admin } }, async ({ db, user, req, params }) => {
  const body = await readJson(req);
  await setMemberStatus(db, user!, params.id, body.status);
  return json({ ok: true });
});
