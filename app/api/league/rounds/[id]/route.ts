import { getRoundView } from "@/lib/league/service";
import { handler, json } from "@/lib/league/session";

export const GET = handler({}, async ({ db, user, params }) => json(await getRoundView(db, params.id, user!)));
