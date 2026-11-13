import { buildCalendar } from "@/lib/league/ics";
import { getState } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/** Subscribe with webcal://<site>/calendar.ics — Google/Apple/Outlook keep it updated. */
export async function GET(req: Request) {
  const state = await getState();
  const base = new URL(req.url).origin;
  return new Response(buildCalendar(state.matchDays, { baseUrl: base, now: new Date() }), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="rsfc-league.ics"',
      "Cache-Control": "public, max-age=900",
    },
  });
}
