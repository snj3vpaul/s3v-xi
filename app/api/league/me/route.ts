import { RATE_LIMITS } from "@/lib/league/config";
import { updateProfile } from "@/lib/league/service";
import { handler, json, readJson } from "@/lib/league/session";

export const GET = handler({}, async ({ user }) => json({ user }));
export const PATCH = handler({ limit: { key: "profile", ...RATE_LIMITS.picks } }, async ({ db, user, req }) => {
  const body = await readJson(req);
  await updateProfile(db, user!.id, { name: body.name, avatar: body.avatar });
  return json({ ok: true });
});
