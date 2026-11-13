import { saveScorecard } from "@/lib/league/ledger";
import type { FairPlayLoss, GoalEvent, RotationMiss, Side } from "@/lib/league/types";
import { body, handle, requireAdmin } from "@/lib/server/http";
import { ctx, mutate } from "@/lib/server/store";

export const PUT = handle<{ id: string }>(async (req, { id }) => {
  await requireAdmin();
  const { events, reason, motm, fairPlayLost, rotationMissed, rotationChecked, noResult } = await body<{
    events: GoalEvent[];
    reason?: string;
    motm?: Partial<Record<Side, string | null>>;
    fairPlayLost?: FairPlayLoss[];
    rotationMissed?: RotationMiss[];
    rotationChecked?: boolean;
    noResult?: boolean;
  }>(req);
  await mutate((s) =>
    saveScorecard(
      s,
      id,
      Array.isArray(events) ? events : [],
      {
        reason,
        motm: motm ?? null,
        fairPlayLost: Array.isArray(fairPlayLost) ? fairPlayLost : [],
        rotationMissed: Array.isArray(rotationMissed) ? rotationMissed : [],
        rotationChecked: rotationChecked === true,
        noResult: noResult === true,
      },
      ctx(),
    ),
  );
});
