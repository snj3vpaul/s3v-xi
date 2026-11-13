import { setSquad } from "@/lib/league/ledger";
import { HttpError, body, handle } from "@/lib/server/http";
import { currentUser } from "@/lib/server/session";
import { ctx, mutate } from "@/lib/server/store";

export const PUT = handle(async (req) => {
  const me = await currentUser();
  if (!me) throw new HttpError(401, "Log in to pick your seven.");
  const { picks } = await body<{ picks?: string[] }>(req);
  await mutate((s) => setSquad(s, me.id, Array.isArray(picks) ? picks : [], ctx()));
});
