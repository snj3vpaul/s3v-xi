import { RATE_LIMITS } from "@/lib/league/config";
import { recomputeAll } from "@/lib/league/service";
import { handler, json } from "@/lib/league/session";

/** Re-run the scoring engine over every result (after editing SCORING_RULES). */
export const POST = handler({ auth: "admin", limit: { key: "admin", ...RATE_LIMITS.admin } }, async ({ db }) => json({ fixtures: await recomputeAll(db) }));
