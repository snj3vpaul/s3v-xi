import type { Chip } from "@/lib/league/types";
import { cancelChip, playChip } from "@/lib/league/ledger";
import { HttpError, body, handle, requireUser } from "@/lib/server/http";
import { ctx, mutate } from "@/lib/server/store";

/** Play Triple Captain or Bench Boost for the next match day. */
export const POST = handle(async (req) => {
  const me = await requireUser();
  const { chip } = await body<{ chip?: Chip }>(req);
  if (chip !== "triple_captain" && chip !== "bench_boost") throw new HttpError(400, "Unknown chip.");
  await mutate((s) => playChip(s, me.id, chip, ctx()));
});

/** Cancel this week's chip (before the deadline). It goes back in the pile. */
export const DELETE = handle(async () => {
  const me = await requireUser();
  await mutate((s) => cancelChip(s, me.id, ctx()));
});
