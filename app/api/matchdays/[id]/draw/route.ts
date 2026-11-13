import { isDropIn } from "@/config/club";
import { verifyDraw } from "@/lib/draw/draw";
import { recordDraw, resetDraw } from "@/lib/league/ledger";
import type { DrawConstraints } from "@/lib/league/types";
import { HttpError, body, handle, requireAdmin } from "@/lib/server/http";
import { ctx, getState, mutate } from "@/lib/server/store";

type P = { id: string };

/** Public: re-run the recorded seed and confirm the published teams. */
export const GET = handle<P>(async (_req, { id }) => {
  const m = (await getState()).matchDays.find((x) => x.id === id);
  if (!m?.draw) throw new HttpError(404, "No draw for this match day.");
  return { ...verifyDraw(m.draw, isDropIn), seed: m.draw.seed, attempt: m.draw.attempt, algorithm: m.draw.algorithm };
});

export const POST = handle<P>(async (req, { id }) => {
  await requireAdmin();
  const { constraints } = await body<{ constraints?: Partial<DrawConstraints> }>(req);
  await mutate((s) => recordDraw(s, id, { ...s.settings.defaultConstraints, ...(constraints ?? {}) }, ctx()));
});

export const DELETE = handle<P>(async (req, { id }) => {
  await requireAdmin();
  const { reason } = await body<{ reason?: string }>(req);
  await mutate((s) => resetDraw(s, id, reason ?? "", ctx()));
});
