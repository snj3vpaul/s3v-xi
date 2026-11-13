/** Everything the pages show, derived from the league document in one place. */
import { ROSTER, isDropIn } from "@/config/club";
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

/** Next match day still to be played (open or drawn), earliest first. */
export function upcoming(state: LeagueState): MatchDay | null {
  return (
    [...state.matchDays]
      .filter((m) => m.status !== "played")
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))[0] ?? null
  );
}

export const fmtDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
export const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
