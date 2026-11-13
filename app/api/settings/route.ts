import { updateSettings } from "@/lib/league/ledger";
import type { LeagueSettings } from "@/lib/league/types";
import { body, handle, requireAdmin } from "@/lib/server/http";
import { ctx, mutate } from "@/lib/server/store";

export const PUT = handle(async (req) => {
  await requireAdmin();
  const patch = await body<Partial<LeagueSettings>>(req);
  await mutate((s) => updateSettings(s, patch, ctx()));
});
