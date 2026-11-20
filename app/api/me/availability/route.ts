import { nextDeadlineMatch, setAvailability } from "@/lib/league/ledger";
import { HttpError, body, handle, requireUser } from "@/lib/server/http";
import { ctx, getState, mutate } from "@/lib/server/store";

/** "I can't make it": flag your own linked player out (or back in) for the next match day. */
export const PUT = handle(async (req) => {
  const me = await requireUser();
  if (!me.playerId) throw new HttpError(400, "Link your account to your player on the Account page first.");
  const { out, note, matchId } = await body<{ out?: boolean; note?: string; matchId?: string }>(req);
  const c = ctx();
  const target = matchId ?? nextDeadlineMatch(await getState(), c.now)?.id;
  if (!target) throw new HttpError(400, "There's no upcoming match day.");
  await mutate((s) => setAvailability(s, { matchId: target, playerId: me.playerId!, out: !!out, note, by: "self", userId: me.id }, c));
});
