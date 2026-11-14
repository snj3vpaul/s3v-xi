import { setTeamSheet } from "@/lib/league/ledger";
import { body, handle, requireAdmin } from "@/lib/server/http";
import { ctx, mutate } from "@/lib/server/store";

type P = { id: string };

/** Admin: set this week's team sheet (who played for White and who for Red). */
export const PUT = handle<P>(async (req, { id }) => {
  await requireAdmin();
  const { teamA, teamB } = await body<{ teamA?: string[]; teamB?: string[] }>(req);
  await mutate((s) => setTeamSheet(s, id, { teamA: Array.isArray(teamA) ? teamA : [], teamB: Array.isArray(teamB) ? teamB : [] }, ctx()));
});
