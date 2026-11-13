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
import { getPlayer } from "@/config/club";
import { buildSelectorStandings, type ScoringRules } from "@/lib/scoring/rules";
import { isFormationValid } from "./pick7";
import type { LeagueState } from "./types";

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
  const out = ranked.map((r, i) => {
    const first = ranked.findIndex((x) => x.points === r.points && x.hits === r.hits);
    const shared = ranked.filter((x) => x.points === r.points && x.hits === r.hits).length > 1;
    return { ...r, rank: (first === -1 ? i : first) + 1, sharedRank: shared };
  });
  return [...out, ...rest.map((r) => ({ ...r, rank: null, sharedRank: false }))];
}

export function buildPick7Table(state: LeagueState, rules: ScoringRules): Pick7Row[] {
  const season = new Map(buildSelectorStandings(state.matchDays, rules).map((s) => [s.selectorId, s]));
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
