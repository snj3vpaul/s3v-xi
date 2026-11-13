import { submitSelection } from "@/lib/league/ledger";
import { body, handle } from "@/lib/server/http";
import { ctx, mutate } from "@/lib/server/store";

/** Open to every player (v1 has no player logins); every submission is audit-logged. */
export const POST = handle<{ id: string }>(async (req, { id }) => {
  const { selectorId, picks } = await body<{ selectorId: string; picks: string[] }>(req);
  await mutate((s) => submitSelection(s, id, selectorId, picks ?? [], ctx()));
});
