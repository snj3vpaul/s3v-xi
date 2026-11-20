/**
 * The Pick 7 table — every account, in one of three states. Pure (no I/O); the
 * server builds it, and the browser re-ranks it after an optimistic change.
 *
 *   no_pick    no current seven (never picked, or removed it). Not ranked; shows "—".
 *   picked     a current seven in the formation. Ranked, from 0 points.
 *   needs_fix  an old seven that doesn't fit the formation. Ranked on season
 *              points (0 if none yet), but won't be entered until fixed.
 *
 * Points are never stored: they're the sum of played rounds (buildSelectorStandings),
 * so a fresh pick is 0 by definition, edits before the deadline can't change
 * points, and a removed seven keeps whatever it had already earned.
 */
import { CHIPS, getPlayer } from "@/config/club";
import {
  buildSelectorStandings,
  matchItems,
  playedMatches,
  scoreMatch,
  scoreSelection,
  scoreline,
  type ContributionKind,
  type PointItem,
  type ScoringRules,
  type SelectorRow,
} from "@/lib/scoring/rules";
import { isFormationValid } from "./pick7";
import type { Chip, LeagueState } from "./types";

export type Pick7Status = "no_pick" | "picked" | "needs_fix";

export interface Pick7Row {
  /** Account id (legacy rows may hold a roster player id). */
  id: string;
  name: string;
  status: Pick7Status;
  points: number;
  rounds: number;
  hits: number;
  totalPicks: number;
  /** First time this account saved a seven (ISO), for ordering ties. */
  firstPickedAt: string | null;
  /** null = not on the table yet (no pick and no rounds played). */
  rank: number | null;
  sharedRank: boolean;
}

/** Ranked rows have a pick or a played round. */
export const isRanked = (r: Pick<Pick7Row, "status" | "rounds">) => r.status !== "no_pick" || r.rounds > 0;

/**
 * Order: ranked rows by points DESC, then hits DESC (shared rank when both tie),
 * then — for display only — earliest first pick, then name. Unranked rows last.
 */
export function rankPick7(rows: Pick7Row[]): Pick7Row[] {
  const ranked = rows.filter(isRanked);
  const rest = rows.filter((r) => !isRanked(r)).sort((a, b) => a.name.localeCompare(b.name));
  ranked.sort(
    (a, b) =>
      b.points - a.points ||
      b.hits - a.hits ||
      (a.firstPickedAt ?? "￿").localeCompare(b.firstPickedAt ?? "￿") ||
      a.name.localeCompare(b.name),
  );
  // Rank = position of the first row level on points and hits; one pass, rows are sorted.
  const out: typeof ranked = [];
  for (let i = 0, start = 0; i < ranked.length; i++) {
    const r = ranked[i];
    const p = ranked[i - 1];
    if (!p || p.points !== r.points || p.hits !== r.hits) start = i;
    const n = ranked[i + 1];
    const shared = i > start || (!!n && n.points === r.points && n.hits === r.hits);
    out.push({ ...r, rank: start + 1, sharedRank: shared });
  }
  return [...out, ...rest.map((r) => ({ ...r, rank: null, sharedRank: false }))];
}

/** `selectors` may be passed in when the caller already has the selector standings. */
export function buildPick7Table(state: LeagueState, rules: ScoringRules, selectors?: SelectorRow[]): Pick7Row[] {
  const season = new Map((selectors ?? buildSelectorStandings(state.matchDays, rules)).map((s) => [s.selectorId, s]));
  const rows: Pick7Row[] = state.users.map((u) => {
    const current = u.squadHistory.at(-1)?.picks ?? [];
    const status: Pick7Status = current.length === 0 ? "no_pick" : isFormationValid(current) ? "picked" : "needs_fix";
    const s = season.get(u.id);
    season.delete(u.id);
    return {
      id: u.id,
      name: u.name,
      status,
      points: s?.points ?? 0,
      rounds: s?.rounds ?? 0,
      hits: s?.hits ?? 0,
      totalPicks: s?.totalPicks ?? 0,
      firstPickedAt: u.squadHistory.find((h) => h.picks.length > 0)?.at ?? null,
      rank: null,
      sharedRank: false,
    };
  });
  // Selectors whose account is gone (or legacy v1 roster-id selectors) keep their season line.
  for (const s of season.values()) {
    rows.push({
      id: s.selectorId,
      name: getPlayer(s.selectorId)?.name ?? "Former member",
      status: "no_pick",
      points: s.points,
      rounds: s.rounds,
      hits: s.hits,
      totalPicks: s.totalPicks,
      firstPickedAt: null,
      rank: null,
      sharedRank: false,
    });
  }
  return rankPick7(rows);
}

/**
 * What the table looks like the instant a save or removal is sent, before the
 * server answers. Points never change optimistically: they only come from played rounds.
 */
export function applyOptimistic(rows: Pick7Row[], userId: string, status: Pick7Status, now: string): Pick7Row[] {
  if (!rows.some((r) => r.id === userId)) return rows;
  return rankPick7(
    rows.map((r) =>
      r.id === userId ? { ...r, status, firstPickedAt: r.firstPickedAt ?? (status === "no_pick" ? null : now) } : r,
    ),
  );
}

// ---------------------------------------------------------------------------
// Points breakdown — "where did my points come from?"
// ---------------------------------------------------------------------------

export interface PickBreakdown {
  playerId: string;
  name: string;
  played: boolean;
  /** Wore the armband that counted (shown as an extra "Captain" item). */
  captain: boolean;
  /** Picked as vice-captain (they get the armband only if the captain didn't play). */
  vice: boolean;
  role: "starter" | "bench";
  /** Bench only: did their points count (auto-sub or Bench Boost)? */
  counted: boolean;
  items: PointItem[];
  total: number;
}

export interface RoundBreakdown {
  matchId: string;
  date: string;
  /** e.g. "White 4–3 Red" */
  result: string;
  total: number;
  picks: PickBreakdown[];
  /** Chip played that week. */
  chip: Chip | null;
  /** One-line notes: "Vice-captain Tadas took the armband", "Bench: Harry came on". */
  notes: string[];
  /** Times this round's scorecard was corrected (shown as a note). */
  corrections: number;
}

export interface SelectorBreakdown {
  id: string;
  rounds: RoundBreakdown[];
  /** Season points by source, for the "where your points came from" bar. */
  byKind: Partial<Record<ContributionKind, number>>;
  total: number;
}

/**
 * Every played round a selector was entered in, newest first, with each pick's
 * points itemised. Totals come from scoreSelection() and items from the same
 * matchItems() the scores come from, so the breakdown always adds up to the table.
 */
export function selectorBreakdown(state: LeagueState, rules: ScoringRules, selectorId: string): SelectorBreakdown {
  const rounds: RoundBreakdown[] = [];
  const byKind: Partial<Record<ContributionKind, number>> = {};
  for (const m of playedMatches(state.matchDays)) {
    const sel = m.selections.find((s) => s.selectorId === selectorId);
    if (!sel) continue;
    const items = matchItems(m, rules);
    const result = scoreSelection(sel, m, rules, scoreMatch(m, rules));
    const score = scoreline(m.events);
    const name = (id: string) => getPlayer(id)?.name ?? id;
    const picks: PickBreakdown[] = result.perPick.map((p) => {
      const base = p.counted ? (items.get(p.playerId) ?? []) : [];
      // Armband: one extra line repeating their total ×(multiplier − 1), so the bonus is visible.
      const armDetail =
        p.multiplier === 3 ? "Triple Captain: points ×3" : p.playerId === result.captain ? "Captain: points doubled" : "Vice-captain took the armband: points doubled";
      const list: PointItem[] = p.captain && p.base !== 0 ? [...base, { kind: "captain", points: p.base * (p.multiplier - 1), detail: armDetail }] : base;
      for (const it of list) byKind[it.kind] = (byKind[it.kind] ?? 0) + it.points;
      return {
        playerId: p.playerId,
        name: name(p.playerId),
        played: p.played,
        captain: p.captain,
        vice: p.playerId === result.viceCaptain,
        role: p.role,
        counted: p.counted,
        items: list,
        total: p.points,
      };
    });
    const notes: string[] = [];
    if (result.chip) notes.push(`${CHIPS[result.chip].label} played`);
    if (result.captain && result.armband && result.armband !== result.captain)
      notes.push(`${name(result.captain)} didn't play, so vice-captain ${name(result.armband)} took the armband`);
    if (result.bench) {
      const missing = result.perPick.filter((p) => p.role === "starter" && !p.played).map((p) => name(p.playerId));
      if (result.chip === "bench_boost") notes.push(`Bench Boost: ${name(result.bench)}'s points counted`);
      else if (result.benchUsed) notes.push(`${name(result.bench)} came off the bench for ${missing.join(" / ")}`);
      else if (missing.length) notes.push(`${name(result.bench)} was on the bench but didn't play either`);
    }
    const starters = picks.filter((p) => p.role === "starter").sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    rounds.push({
      matchId: m.id,
      date: m.date,
      result: m.noResult ? `White ${score.A}–${score.B} Red (no result)` : `White ${score.A}–${score.B} Red`,
      total: result.points,
      picks: [...starters, ...picks.filter((p) => p.role === "bench")],
      chip: result.chip,
      notes,
      corrections: Math.max(0, m.scorecardVersion - 1),
    });
  }
  rounds.reverse();
  return { id: selectorId, rounds, byKind, total: rounds.reduce((t, r) => t + r.total, 0) };
}
