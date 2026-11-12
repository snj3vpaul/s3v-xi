import { RATE_LIMITS } from "@/lib/league/config";
import { createRound, listRounds } from "@/lib/league/service";
import { handler, json, readJson } from "@/lib/league/session";

const limit = { key: "admin", ...RATE_LIMITS.admin };
export const GET = handler({ auth: "admin" }, async ({ db }) => json({ rounds: await listRounds(db) }));
export const POST = handler({ auth: "admin", limit }, async ({ db, req }) => {
  const body = await readJson(req);
  return json({ id: await createRound(db, body.name) }, 201);
});
