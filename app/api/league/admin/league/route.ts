import { RATE_LIMITS } from "@/lib/league/config";
import { regenerateInvite, renameLeague } from "@/lib/league/service";
import { handler, json, readJson } from "@/lib/league/session";

/** Body: { name?: string, regenerateInvite?: true } */
export const PATCH = handler({ auth: "admin", limit: { key: "admin", ...RATE_LIMITS.admin } }, async ({ db, req }) => {
  const body = await readJson(req);
  if (body.name !== undefined) await renameLeague(db, body.name);
  const inviteCode = body.regenerateInvite === true ? await regenerateInvite(db) : undefined;
  return json({ ok: true, inviteCode });
});
