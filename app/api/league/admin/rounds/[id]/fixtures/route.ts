import { RATE_LIMITS } from "@/lib/league/config";
import { addFixture } from "@/lib/league/service";
import { handler, json, readJson } from "@/lib/league/session";

/** Body: { homeTeam, awayTeam, kickoffAt (ISO, UTC), deadlineAt? (ISO, UTC) } */
export const POST = handler({ auth: "admin", limit: { key: "admin", ...RATE_LIMITS.admin } }, async ({ db, req, params }) => {
  const body = await readJson(req);
  const id = await addFixture(db, params.id, { homeTeam: body.homeTeam, awayTeam: body.awayTeam, kickoffAt: body.kickoffAt, deadlineAt: body.deadlineAt });
  return json({ id }, 201);
});
