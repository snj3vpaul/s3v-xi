import { createMatchDay } from "@/lib/league/ledger";
import { body, handle, requireAdmin } from "@/lib/server/http";
import { ctx, mutate } from "@/lib/server/store";

export const POST = handle(async (req) => {
  await requireAdmin();
  const input = await body<{ date: string; label?: string; attendees?: string[] }>(req);
  let id = "";
  await mutate((s) => {
    const r = createMatchDay(s, input, ctx());
    id = r.match.id;
    return r.state;
  });
  return { ok: true, id };
});
