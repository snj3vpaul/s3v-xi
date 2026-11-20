/**
 * Everything the Table page's interactive board needs, per player. Pure.
 * Built from the same buildStandings()/matchItems() as every other page, so
 * the board always agrees with the rest of the site.
 */
import { ROSTER, isDropIn, playerName } from "@/config/club";
import { buildStandings, matchItems, playedMatches, type ContributionKind, type ScoringRules, type StandingRow } from "@/lib/scoring/rules";
import type { MatchDay } from "./types";

export interface BoardRow {
  id: string;
  name: string;
  dropin: boolean;
  rank: number;
  shared: boolean;
  /** Rank before the latest match day (null: hadn't played yet, or this is the first week). */
  prevRank: number | null;
  played: number;
  goals: number;
  assists: number;
  motm: number;
  points: number;
  /** Last five match days played, oldest first. */
  form: number[];
  /** Season points by source. */
  byKind: Partial<Record<ContributionKind, number>>;
  /** Every match day they played, newest first. */
  nights: { matchId: string; date: string; points: number }[];
}

/** `now` may be passed in when the caller already has the roster standings. */
export function buildBoard(matchDays: MatchDay[], rules: ScoringRules, now?: StandingRow[]): BoardRow[] {
  const ids = ROSTER.map((p) => p.id);
  const played = playedMatches(matchDays);
  now ??= buildStandings(matchDays, ids, rules);
  const latest = played.at(-1);
  const before = played.length > 1 && latest ? buildStandings(matchDays.filter((m) => m.id !== latest.id), ids, rules) : null;
  const prev = new Map(before?.filter((r) => r.played > 0).map((r) => [r.playerId, r.rank]));

  const byKind = new Map<string, Partial<Record<ContributionKind, number>>>();
  for (const m of played)
    for (const [id, items] of matchItems(m, rules)) {
      const k = byKind.get(id) ?? {};
      for (const it of items) k[it.kind] = (k[it.kind] ?? 0) + it.points;
      byKind.set(id, k);
    }

  return now.map((r) => ({
    id: r.playerId,
    name: playerName(r.playerId),
    dropin: isDropIn(r.playerId),
    rank: r.rank,
    shared: r.sharedRank,
    prevRank: prev.get(r.playerId) ?? null,
    played: r.played,
    goals: r.goals,
    assists: r.assists,
    motm: r.motm,
    points: r.points,
    form: r.form,
    byKind: byKind.get(r.playerId) ?? {},
    nights: played.flatMap((m) => (m.id in r.perMatch ? [{ matchId: m.id, date: m.date, points: r.perMatch[m.id] }] : [])).reverse(),
  }));
}
