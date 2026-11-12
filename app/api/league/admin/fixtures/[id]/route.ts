import { RATE_LIMITS } from "@/lib/league/config";
import { deleteFixture, updateFixture } from "@/lib/league/service";
import { handler, json, readJson } from "@/lib/league/session";

const limit = { key: "admin", ...RATE_LIMITS.admin };
export const PATCH = handler({ auth: "admin", limit }, async ({ db, req, params }) => {
  const body = await readJson(req);
  await updateFixture(db, params.id, { homeTeam: body.homeTeam, awayTeam: body.awayTeam, kickoffAt: body.kickoffAt, deadlineAt: body.deadlineAt });
  return json({ ok: true });
});
export const DELETE = handler({ auth: "admin", limit }, async ({ db, params }) => {
  await deleteFixture(db, params.id);
  return json({ ok: true });
});
