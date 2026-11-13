import { saveScorecard } from "@/lib/league/ledger";
import type { FairPlayLoss, GoalEvent, Side } from "@/lib/league/types";
import { body, handle, requireAdmin } from "@/lib/server/http";
import { ctx, mutate } from "@/lib/server/store";

export const PUT = handle<{ id: string }>(async (req, { id }) => {
  await requireAdmin();
  const { events, reason, motm, fairPlayLost } = await body<{
    events: GoalEvent[];
    reason?: string;
    motm?: Partial<Record<Side, string | null>>;
    fairPlayLost?: FairPlayLoss[];
  }>(req);
  await mutate((s) =>
    saveScorecard(
      s,
      id,
      Array.isArray(events) ? events : [],
      { reason, motm: motm ?? null, fairPlayLost: Array.isArray(fairPlayLost) ? fairPlayLost : [] },
      ctx(),
    ),
  );
});
