/** Everything the pages show, derived from the league document in one place. */
import { ROSTER, getPlayer, isDropIn } from "@/config/club";
import { formatLabel } from "@/lib/draw/draw";
import {
  buildSelectorStandings,
  buildStandings,
  computeAwards,
  playedMatches,
  scoreMatch,
  scoreline,
} from "@/lib/scoring/rules";
import { rulesFrom } from "./ledger";
import type { LeagueState, MatchDay } from "./types";

export function deriveSeason(state: LeagueState) {
  const rules = rulesFrom(state.settings);
  const played = playedMatches(state.matchDays);
  const standings = buildStandings(state.matchDays, ROSTER.map((p) => p.id), rules);
  const selectors = buildSelectorStandings(state.matchDays, rules);
  const awards = computeAwards(standings, selectors, { excludeDropIns: state.settings.excludeDropInsFromAwards, isDropIn });
  return { rules, played, standings, selectors, awards };
}

export function matchSummary(m: MatchDay, state: LeagueState) {
  const rules = rulesFrom(state.settings);
  return {
    score: scoreline(m.events),
    lines: scoreMatch(m, rules),
    format: m.draw ? formatLabel(m.draw) : null,
  };
}

/**
 * The match day the Draw page should show: the earliest not-yet-played one
 * whose kick-off was less than 6 hours ago (so an unplayed past week doesn't
 * block the next one).
 */
export function upcoming(state: LeagueState, now = new Date()): MatchDay | null {
  const cutoff = now.getTime() - 6 * 3_600_000;
  return (
    [...state.matchDays]
      .filter((m) => m.status !== "played" && new Date(m.kickoffAt).getTime() > cutoff)
      .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt) || a.createdAt.localeCompare(b.createdAt))[0] ?? null
  );
}

/** Display name for a Pick 7 selector (an account; legacy data may hold a roster id). */
export function selectorName(state: LeagueState, id: string): string {
  return state.users.find((u) => u.id === id)?.name ?? getPlayer(id)?.name ?? "Former member";
}

export const fmtDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
export const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
