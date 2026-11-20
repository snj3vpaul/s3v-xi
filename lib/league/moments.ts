/**
 * The season as a line: cumulative goals after each played match day, with
 * one headline moment per night picked from the scorecard. Pure.
 */
import { playerName } from "@/config/club";
import { TEAM_NAMES } from "@/config/schedule";
import { playedMatches, scoreMatch, scoreline, type ScoringRules } from "@/lib/scoring/rules";
import type { MatchDay } from "./types";

export interface Moment {
  matchId: string;
  date: string;
  /** Goals scored that night. */
  goals: number;
  /** Goals scored this season up to and including that night. */
  total: number;
  /** Short label on the line, e.g. "Inder hat-trick". */
  headline: string;
  /** One or two plain sentences for the card. */
  story: string;
  /** The player the night was about (for the mascot). */
  heroId: string | null;
}

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const count = (n: number) => WORDS[n] ?? String(n);

export function seasonMoments(matchDays: MatchDay[], rules: ScoringRules): Moment[] {
  let total = 0;
  return playedMatches(matchDays).map((m) => {
    const s = scoreline(m.events);
    const lines = [...scoreMatch(m, rules).values()];
    total += m.events.length;
    const byGoals = [...lines].sort((a, b) => b.goals - a.goals || b.points - a.points);
    const byPoints = [...lines].sort((a, b) => b.points - a.points || b.goals - a.goals);
    const topScorer = byGoals[0]?.goals ? byGoals[0] : null;
    const star = byPoints[0] ?? null;
    const result = m.noResult
      ? `${TEAM_NAMES.A} ${s.A}–${s.B} ${TEAM_NAMES.B} (no result)`
      : s.A === s.B
        ? `${TEAM_NAMES.A} and ${TEAM_NAMES.B} drew ${s.A}–${s.B}`
        : `${s.A > s.B ? TEAM_NAMES.A : TEAM_NAMES.B} won ${Math.max(s.A, s.B)}–${Math.min(s.A, s.B)}`;
    const motm = [m.motm?.A && `${playerName(m.motm.A)} (${TEAM_NAMES.A})`, m.motm?.B && `${playerName(m.motm.B)} (${TEAM_NAMES.B})`].filter(Boolean);

    let headline: string;
    let lead: string;
    let heroId: string | null;
    if (topScorer && topScorer.goals >= 3) {
      headline = `${playerName(topScorer.playerId)} hat-trick`;
      lead = `${playerName(topScorer.playerId)} scored ${count(topScorer.goals)} as ${result}.`;
      heroId = topScorer.playerId;
    } else if (m.events.length === 0) {
      headline = "Goalless";
      lead = `Nobody found the net: ${TEAM_NAMES.A} and ${TEAM_NAMES.B} drew 0–0.`;
      heroId = star?.playerId ?? null;
    } else if (star) {
      headline = `${playerName(star.playerId)} +${star.points}`;
      const did = [star.goals && `${count(star.goals)} goal${star.goals > 1 ? "s" : ""}`, star.assists && `${count(star.assists)} assist${star.assists > 1 ? "s" : ""}`].filter(Boolean).join(" and ");
      lead = `${playerName(star.playerId)} top-scored the night on ${star.points} points${did ? ` with ${did}` : ""} as ${result}.`;
      heroId = star.playerId;
    } else {
      headline = result;
      lead = `${result}.`;
      heroId = null;
    }
    const story = motm.length ? `${lead} Man of the Match: ${motm.join(" and ")}.` : lead;
    return { matchId: m.id, date: m.date, goals: m.events.length, total, headline, story, heroId };
  });
}
