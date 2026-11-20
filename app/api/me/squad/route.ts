import { clearSquad, setSquad } from "@/lib/league/ledger";
import { HttpError, body, handle } from "@/lib/server/http";
import { currentUser } from "@/lib/server/session";
import { ctx, mutate } from "@/lib/server/store";

/** Save (create or edit) the standing seven. Validation and the 0-point start are in the ledger. */
export const PUT = handle(async (req) => {
  const me = await currentUser();
  if (!me) throw new HttpError(401, "Log in to pick your seven.");
  const { picks, captain, viceCaptain, bench } = await body<{
    picks?: string[];
    captain?: string | null;
    viceCaptain?: string | null;
    bench?: string | null;
  }>(req);
  const seven = Array.isArray(picks) ? picks : [];
  if (typeof captain !== "string" || !seven.includes(captain)) throw new HttpError(400, "Choose a captain from your seven.");
  const opt = (v: unknown) => (v === undefined ? undefined : typeof v === "string" && v ? v : null);
  await mutate((s) => setSquad(s, me.id, seven, ctx(), captain, { viceCaptain: opt(viceCaptain), bench: opt(bench) }));
});

/** Remove the standing seven: back to "no pick" from the next unlocked match day. */
export const DELETE = handle(async () => {
  const me = await currentUser();
  if (!me) throw new HttpError(401, "Log in first.");
  await mutate((s) => clearSquad(s, me.id, ctx()));
});
