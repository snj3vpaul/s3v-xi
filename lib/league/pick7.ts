/**
 * Pick 7 v2 — balanced picking. Pure: no I/O, no clock.
 *
 *   1. Formation: exactly FORMATION[pos] picks per position (2 DEF · 2 CM · 1 CAM · 2 ATT).
 *   2. Star budget: the seven's stars may total at most PICK7.starBudget.
 *      A team pushed over budget by a re-rating stays legal; changes to it may
 *      only bring the total down until it fits again.
 *   3. Ownership re-rating: after each draw (from RULES_V2_FROM), a player in
 *      more than 60% of locked sevens gains a star and one in fewer than 10%
 *      loses one, within 1–3. Ratings are derived from history, never stored.
 */
import { FORMATION, PICK7, POSITIONS, POSITION_LABEL, ROSTER, getPlayer, type Position, type Stars } from "@/config/club";
import { RULES_V2_FROM } from "@/lib/scoring/rules";
import type { MatchDay } from "./types";

export type StarMap = Record<string, Stars>;

const clamp = (n: number): Stars => Math.max(1, Math.min(3, n)) as Stars;

export function baseStars(): StarMap {
  const out: StarMap = {};
  for (const p of ROSTER) out[p.id] = p.stars;
  return out;
}

/** Share of locked sevens (0..1) that included each player, for one drawn match. */
export function ownership(m: Pick<MatchDay, "selections">): Record<string, number> {
  const n = m.selections.length;
  const out: Record<string, number> = {};
  if (!n) return out;
  for (const s of m.selections) for (const id of new Set(s.picks)) out[id] = (out[id] ?? 0) + 1;
  for (const id of Object.keys(out)) out[id] /= n;
  return out;
}

/** Drawn v2 match days in kick-off order — the ones whose ownership re-rates players. */
function ratingMatches(matchDays: readonly MatchDay[], beforeIso?: string): MatchDay[] {
  return matchDays
    .filter((m) => m.draw && m.date >= RULES_V2_FROM && (!beforeIso || m.kickoffAt < beforeIso))
    .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt) || a.createdAt.localeCompare(b.createdAt));
}

/**
 * Star ratings as they stand now (or just before `beforeIso`): base stars,
 * nudged by ownership after every drawn match.
 */
export function currentStars(matchDays: readonly MatchDay[], beforeIso?: string): StarMap {
  const stars = baseStars();
  for (const m of ratingMatches(matchDays, beforeIso)) {
    if (m.selections.length < PICK7.minTeamsToRerate) continue;
    const own = ownership(m);
    for (const p of ROSTER) {
      if (!p.position) continue;
      const share = own[p.id] ?? 0;
      if (share > PICK7.riseAbove) stars[p.id] = clamp(stars[p.id] + 1);
      else if (share < PICK7.fallBelow) stars[p.id] = clamp(stars[p.id] - 1);
    }
  }
  return stars;
}

/** Ownership in the most recent drawn match (for the "62% own" hint). */
export function lastOwnership(matchDays: readonly MatchDay[]): Record<string, number> {
  const last = ratingMatches(matchDays).filter((m) => m.selections.length).at(-1);
  return last ? ownership(last) : {};
}

export const starsTotal = (picks: readonly string[], stars: StarMap) => picks.reduce((s, id) => s + (stars[id] ?? 0), 0);

export function positionCounts(picks: readonly string[]): Record<Position, number> {
  const c: Record<Position, number> = { DEF: 0, CM: 0, CAM: 0, ATT: 0 };
  for (const id of picks) {
    const pos = getPlayer(id)?.position;
    if (pos) c[pos] += 1;
  }
  return c;
}

/** True when the picks are seven different pickable players in the exact formation. */
export function isFormationValid(picks: readonly string[]): boolean {
  const unique = new Set(picks);
  if (unique.size !== picks.length) return false;
  if (picks.some((id) => !getPlayer(id)?.position)) return false;
  const c = positionCounts(picks);
  return POSITIONS.every((p) => c[p] === FORMATION[p]);
}

export interface TeamCheck {
  valid: boolean;
  errors: string[];
  starsTotal: number;
  counts: Record<Position, number>;
  /** Over budget, but allowed because it's no worse than the team it replaces. */
  grandfathered: boolean;
}

/**
 * Full validation of a seven. Used by the picker (live) and by the server
 * (authoritative). `previous` is the user's current saved seven, if any.
 */
export function checkTeam(picks: readonly string[], stars: StarMap, previous?: readonly string[] | null): TeamCheck {
  const errors: string[] = [];
  const counts = positionCounts(picks);
  if (new Set(picks).size !== picks.length) errors.push("Each player can only be picked once.");
  for (const id of picks) {
    const p = getPlayer(id);
    if (!p) errors.push(`Unknown player "${id}".`);
    else if (!p.position) errors.push(`${p.name} isn't available in Pick 7.`);
  }
  for (const pos of POSITIONS) {
    if (counts[pos] !== FORMATION[pos]) errors.push(`${POSITION_LABEL[pos].many}: ${counts[pos]}/${FORMATION[pos]}`);
  }
  const total = starsTotal(picks, stars);
  let grandfathered = false;
  if (total > PICK7.starBudget) {
    const prevTotal = previous && isFormationValid(previous) ? starsTotal(previous, stars) : null;
    if (prevTotal !== null && total <= prevTotal) grandfathered = true;
    else errors.push(`Over budget by ${total - PICK7.starBudget}★`);
  }
  return { valid: errors.length === 0, errors, starsTotal: total, counts, grandfathered };
}

/** Keep the players from an old (pre-formation) seven that still fit, in order. */
export function fitToFormation(picks: readonly string[]): string[] {
  const left: Record<Position, number> = { ...FORMATION };
  const out: string[] = [];
  for (const id of new Set(picks)) {
    const pos = getPlayer(id)?.position;
    if (pos && left[pos] > 0) {
      left[pos] -= 1;
      out.push(id);
    }
  }
  return out;
}
