import { setGoalStyles } from "@/lib/league/ledger";
import type { GoalEvent } from "@/lib/league/types";
import { body, handle, requireAdmin } from "@/lib/server/http";
import { ctx, mutate } from "@/lib/server/store";

/** Tag goal / assist types on a published scorecard. No points effect, no correction window. */
export const PUT = handle<{ id: string }>(async (req, { id }) => {
  await requireAdmin();
  const { tags } = await body<{ tags: Pick<GoalEvent, "id" | "style" | "assistStyle">[] }>(req);
  await mutate((s) =>
    setGoalStyles(
      s,
      id,
      (Array.isArray(tags) ? tags : []).filter((t) => t && typeof t.id === "string"),
      ctx(),
    ),
  );
});
