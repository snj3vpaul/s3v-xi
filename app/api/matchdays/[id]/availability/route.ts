import { setAvailability } from "@/lib/league/ledger";
import { HttpError, body, handle, requireAdmin } from "@/lib/server/http";
import { ctx, mutate } from "@/lib/server/store";

type P = { id: string };

/** Admin: flag any player out (or back in) for this match day. */
export const PUT = handle<P>(async (req, { id }) => {
  await requireAdmin();
  const { playerId, out, note } = await body<{ playerId?: string; out?: boolean; note?: string }>(req);
  if (!playerId) throw new HttpError(400, "Choose a player.");
  await mutate((s) => setAvailability(s, { matchId: id, playerId, out: !!out, note, by: "admin" }, ctx()));
});
