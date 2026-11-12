import { getLeaderboard } from "@/lib/league/service";
import { handler, json } from "@/lib/league/session";

export const GET = handler({}, async ({ db }) => json(await getLeaderboard(db)));
