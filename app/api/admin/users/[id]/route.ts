import { deleteUser, updateAccount } from "@/lib/league/ledger";
import { body, handle, requireAdmin } from "@/lib/server/http";
import { hashPassword, tempPassword } from "@/lib/server/password";
import { ctx, mutate } from "@/lib/server/store";

type P = { id: string };

/** Admin: reset a forgotten password. Returns a one-time temporary password to pass on. */
export const POST = handle<P>(async (req, { id }) => {
  await requireAdmin();
  const { action, playerId } = await body<{ action: "reset" | "unclaim"; playerId?: string | null }>(req);
  if (action === "unclaim") {
    await mutate((s) => updateAccount(s, id, { playerId: playerId ?? null }, ctx(), "admin"));
    return { ok: true };
  }
  const temp = tempPassword();
  const passwordHash = await hashPassword(temp);
  await mutate((s) => updateAccount(s, id, { passwordHash }, ctx(), "admin"));
  return { ok: true, tempPassword: temp };
});

export const DELETE = handle<P>(async (_req, { id }) => {
  await requireAdmin();
  await mutate((s) => deleteUser(s, id, ctx()));
});
