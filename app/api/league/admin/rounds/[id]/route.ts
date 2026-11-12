import { RATE_LIMITS } from "@/lib/league/config";
import { deleteRound, updateRound } from "@/lib/league/service";
import { handler, json, readJson } from "@/lib/league/session";

const limit = { key: "admin", ...RATE_LIMITS.admin };
export const PATCH = handler({ auth: "admin", limit }, async ({ db, req, params }) => {
  const body = await readJson(req);
  await updateRound(db, params.id, { name: body.name, status: body.status });
  return json({ ok: true });
});
export const DELETE = handler({ auth: "admin", limit }, async ({ db, params }) => {
  await deleteRound(db, params.id);
  return json({ ok: true });
});
