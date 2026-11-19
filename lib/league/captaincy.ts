import { getPlayer, playerName } from "@/config/club";
import type { LeagueState } from "./types";

/**
 * The player captained most often.
 *
 * Counts the captain of every locked seven in played match days. Before any
 * match is played, it counts the captains of everyone's current seven instead.
 * Ties go to the player who reached that count first in time, then by name.
 */
export function mostCaptained(state: LeagueState): string | null {
  const counts = new Map<string, number>();
  const firstAt = new Map<string, string>();
  const add = (id: string | null | undefined, at: string) => {
    if (!id || !getPlayer(id)) return;
    counts.set(id, (counts.get(id) ?? 0) + 1);
    if (!firstAt.has(id) || at < firstAt.get(id)!) firstAt.set(id, at);
  };

  for (const m of state.matchDays) {
    if (m.status !== "played") continue;
    for (const s of m.selections) add(s.captain, m.kickoffAt);
  }
  if (counts.size === 0) {
    for (const u of state.users) {
      const last = u.squadHistory.at(-1);
      if (last?.picks.length) add(last.captain, last.at);
    }
  }
  if (counts.size === 0) return null;
  return [...counts.entries()].sort(
    ([a, x], [b, y]) => y - x || firstAt.get(a)!.localeCompare(firstAt.get(b)!) || playerName(a).localeCompare(playerName(b)),
  )[0][0];
}
