import { saveScorecard } from "@/lib/league/ledger";
import type { GoalEvent } from "@/lib/league/types";
import { body, handle, requireAdmin } from "@/lib/server/http";
import { ctx, mutate } from "@/lib/server/store";

export const PUT = handle<{ id: string }>(async (req, { id }) => {
  await requireAdmin();
  const { events, reason } = await body<{ events: GoalEvent[]; reason?: string }>(req);
  await mutate((s) => saveScorecard(s, id, Array.isArray(events) ? events : [], { reason }, ctx()));
});
