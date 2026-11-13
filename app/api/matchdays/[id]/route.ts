import { deleteMatchDay, setAttendance } from "@/lib/league/ledger";
import { body, handle, requireAdmin } from "@/lib/server/http";
import { ctx, mutate } from "@/lib/server/store";

type P = { id: string };

export const PATCH = handle<P>(async (req, { id }) => {
  await requireAdmin();
  const { attendees } = await body<{ attendees: string[] }>(req);
  await mutate((s) => setAttendance(s, id, attendees ?? [], ctx()));
});

export const DELETE = handle<P>(async (_req, { id }) => {
  await requireAdmin();
  await mutate((s) => deleteMatchDay(s, id, ctx()));
});
