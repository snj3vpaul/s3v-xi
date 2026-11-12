import { RATE_LIMITS } from "@/lib/league/config";
import { setResult } from "@/lib/league/service";
import { handler, json, readJson } from "@/lib/league/session";

/** Body: { home, away } to enter/correct a result, or { clear: true } to remove it. */
export const PUT = handler({ auth: "admin", limit: { key: "admin", ...RATE_LIMITS.admin } }, async ({ db, req, params }) => {
  const body = await readJson(req);
  await setResult(db, params.id, body.clear === true ? null : { home: body.home, away: body.away });
  return json({ ok: true });
});
