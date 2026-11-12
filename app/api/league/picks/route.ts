import { RATE_LIMITS } from "@/lib/league/config";
import { LeagueError, submitPicks, type PickInput } from "@/lib/league/service";
import { handler, json, readJson } from "@/lib/league/session";

/** Body: { picks: [{ fixtureId, home, away }] }. Deadlines are checked here, on the server. */
export const POST = handler({ limit: { key: "picks", ...RATE_LIMITS.picks } }, async ({ db, user, req }) => {
  const body = await readJson(req);
  if (!Array.isArray(body.picks)) throw new LeagueError(400, "Send picks as a list.");
  const result = await submitPicks(db, user!, body.picks as PickInput[]);
  return json(result, result.saved.length ? 200 : 409);
});
