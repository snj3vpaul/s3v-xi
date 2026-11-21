/**
 * Form: card ratings move with results, round by round.
 *
 * After each played match, every player who played is compared with the average points
 * of the players in their position that night (or everyone, if they were the only one).
 * Well above → up. Well below → down, but only if their side lost: a win or a draw never
 * costs a rating point, because a lot of good football (the ball before the assist, the
 * dribble that made the chance) can't be recorded. Didn't play → no change. Moves add up over the season, within ±maxDrift of the
 * scouted level. Derived from match history every time, never stored, so a corrected
 * scorecard corrects the ratings too.
 *
 * The scouted top three are fixed: they never move, and nobody else can climb past them.
 */
import type { MatchDay } from "./types";
import { winnerOf, type StandingRow } from "@/lib/scoring/rules";
import type { Position } from "@/config/club";
import { ROSTER } from "@/config/club";
import { RATINGS_SEED, SCOUTING, rate, ratingFor, type PlayerRating } from "./ratings";

export const FORM = {
  /** Points above the night's average for +2 / +1, below for −1 / −2. */
  up2: 5,
  up1: 2,
  down1: -3,
  down2: -6,
  /** Most a card can move, either way, from its scouted level. */
  maxDrift: 6,
  /** Highest OVR anyone outside the fixed top three can reach (Tadas, third, is 86). */
  ceiling: 85,
  floor: 55,
} as const;

/** The scouted top three: their cards never move. */
export const FIXED_TOP: readonly string[] = SCOUTING[0].slice(0, 3);

export function roundChange(points: number, average: number): number {
  const d = points - average;
  if (d >= FORM.up2) return 2;
  if (d >= FORM.up1) return 1;
  if (d <= FORM.down2) return -2;
  if (d <= FORM.down1) return -1;
  return 0;
}

export type RoundResult = "won" | "drew" | "lost" | "floater";

export interface FormRound {
  matchId: string;
  date: string;
  points: number;
  /** Average the player was compared with. */
  average: number;
  /** Whose average: a position ("CM"), or "all" when they were the only one in it. */
  basis: Position | "all";
  result: RoundResult | null;
  /** Change actually applied (after the drift cap). */
  change: number;
}

export interface FormLine {
  /** Total change from the scouted level. */
  total: number;
  /** Change from the most recent round this player played. */
  last: number;
  rounds: FormRound[];
  fixed: boolean;
}

/** Each player's rating movement over the played matches (oldest first). */
export function formMoves(
  played: readonly MatchDay[],
  standings: readonly StandingRow[],
  baseOvr: (id: string) => number | undefined = (id) => ratingFor(id)?.ovr,
  positionOf: (id: string) => Position | undefined = (id) => ratingFor(id)?.position,
): Map<string, FormLine> {
  const out = new Map<string, FormLine>(
    standings.map((r) => [r.playerId, { total: 0, last: 0, rounds: [], fixed: FIXED_TOP.includes(r.playerId) }]),
  );
  const order = [...played].sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
  for (const m of order) {
    const lines = standings.filter((r) => m.id in r.perMatch);
    if (lines.length === 0) continue;
    const avgOf = (rs: readonly StandingRow[]) => rs.reduce((s, r) => s + r.perMatch[m.id], 0) / rs.length;
    const nightAvg = avgOf(lines);
    const winner = m.draw ? winnerOf(m) : null;
    const resultOf = (id: string): RoundResult | null => {
      if (!m.draw) return null;
      if (m.draw.floater === id) return "floater";
      const side = m.draw.teamA.includes(id) ? "A" : m.draw.teamB.includes(id) ? "B" : null;
      if (!side) return null;
      return winner === null ? "drew" : winner === side ? "won" : "lost";
    };
    for (const r of lines) {
      const f = out.get(r.playerId)!;
      const pos = positionOf(r.playerId);
      const peers = pos ? lines.filter((x) => positionOf(x.playerId) === pos) : [];
      const basis: Position | "all" = pos && peers.length >= 2 ? pos : "all";
      const average = basis === "all" ? nightAvg : avgOf(peers);
      const result = resultOf(r.playerId);
      let raw = f.fixed ? 0 : roundChange(r.perMatch[m.id], average);
      // Drops only for a losing side (unknown side counts as not losing).
      if (raw < 0 && result !== "lost") raw = 0;
      // Stay within the drift and between the floor and ceiling, so each round shows what really moved.
      const base = baseOvr(r.playerId) ?? FORM.ceiling;
      const lo = Math.max(-FORM.maxDrift, FORM.floor - base);
      const hi = Math.min(FORM.maxDrift, FORM.ceiling - base);
      const next = Math.max(Math.min(lo, f.total), Math.min(Math.max(hi, f.total), f.total + raw));
      const change = next - f.total;
      f.total = next;
      f.last = change;
      f.rounds.push({ matchId: m.id, date: m.date, points: r.perMatch[m.id], average: Math.round(average * 10) / 10, basis, result, change });
    }
  }
  return out;
}

/** Final OVR for a card: scouted/base level plus form, inside the floor and ceiling. Fixed cards don't move. */
export function formOvr(base: number, total: number, fixed: boolean): number {
  if (fixed || total === 0) return base;
  return Math.max(FORM.floor, Math.min(FORM.ceiling, base + total));
}

export interface FormRating extends PlayerRating {
  /** OVR before form (scouted level, or the random one for unscouted players). */
  baseOvr: number;
  form: FormLine;
}

const NO_FORM: FormLine = { total: 0, last: 0, rounds: [], fixed: false };

/** Every roster player's card with form applied, best first. */
export function squadWithForm(moves: ReadonlyMap<string, FormLine>): FormRating[] {
  return ROSTER.map((p) => {
    const base = ratingFor(p.id) ?? rate(p);
    const form = moves.get(p.id) ?? { ...NO_FORM, fixed: FIXED_TOP.includes(p.id) };
    const ovr = formOvr(base.ovr, form.total, form.fixed);
    const card = ovr === base.ovr ? base : rate(p, RATINGS_SEED, ovr);
    return { ...card, baseOvr: base.ovr, form };
  }).sort((a, b) => b.ovr - a.ovr || a.name.localeCompare(b.name));
}
