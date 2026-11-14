import { redirect } from "next/navigation";
import { getState } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/**
 * Bookmark this on your phone. It opens tonight's match:
 *  1. the latest match day that has kicked off (in the last 2 days) without a scorecard,
 *  2. otherwise the next one coming up (to post the team sheet),
 *  3. otherwise the most recent played one (to correct it).
 * The match page itself asks for the admin passcode.
 */
export default async function UpdateMatch() {
  const state = await getState();
  const now = Date.now();
  const byKickoff = [...state.matchDays].sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
  const t = (iso: string) => new Date(iso).getTime();
  const justPlayed = byKickoff.filter((m) => !m.scorecardAt && t(m.kickoffAt) <= now && now - t(m.kickoffAt) < 2 * 86_400_000).at(-1);
  const next = byKickoff.find((m) => !m.scorecardAt && t(m.kickoffAt) > now);
  const last = byKickoff.filter((m) => m.scorecardAt).at(-1);
  const target = justPlayed ?? next ?? last;
  redirect(target ? `/admin/match/${target.id}` : "/admin");
}
