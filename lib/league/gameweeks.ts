/**
 * Gameweeks and team-selection history, FPL-style.
 *
 * Every fixture is a gameweek (GW1 = the first Thursday). For each account and each
 * gameweek we know the team that counts (as it stood at that week's deadline, or the
 * current one for the open week) and compare it with the previous gameweek's:
 * players in and out, captain, vice-captain, bench and chip.
 *
 * Privacy, as in FPL: for a week that hasn't locked yet, other people only see HOW MANY
 * changes someone made, never which players. Names appear once the week locks at kick-off
 * (and always to the account's owner).
 *
 * Pure: everything is derived from squadHistory, chips and the locked selections.
 */
import { getPlayer } from "@/config/club";
import type { Chip, LeagueState, MatchDay, SquadEntry, User } from "./types";
import { chipFor, nextDeadlineMatch } from "./ledger";
import { playedMatches, scoreSelection, type ScoringRules } from "@/lib/scoring/rules";

export interface Gameweek {
  n: number;
  match: MatchDay;
}

/** All fixtures in kick-off order, numbered from GW1. */
export function gameweeks(matchDays: readonly MatchDay[]): Gameweek[] {
  return [...matchDays]
    .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt) || a.createdAt.localeCompare(b.createdAt))
    .map((match, i) => ({ n: i + 1, match }));
}

export const gwOf = (matchDays: readonly MatchDay[], matchId: string) => gameweeks(matchDays).find((g) => g.match.id === matchId)?.n ?? null;

/** A team as it counts for one gameweek. */
export interface GwTeam {
  picks: string[];
  captain: string | null;
  viceCaptain: string | null;
  bench: string | null;
  chip: Chip | null;
}

function entryAt(user: Pick<User, "squadHistory">, iso: string): SquadEntry | null {
  let best: SquadEntry | null = null;
  for (const h of user.squadHistory) if (h.at <= iso) best = h;
  return best;
}

const fromEntry = (e: SquadEntry | null, chip: Chip | null): GwTeam | null =>
  e && e.picks.length
    ? { picks: [...e.picks], captain: e.captain ?? null, viceCaptain: e.viceCaptain ?? null, bench: e.bench ?? null, chip }
    : null;

/** The team that counts for this gameweek: locked snapshot, team at the deadline, or (open week) the current one. */
export function teamFor(user: User, m: MatchDay, now: Date): GwTeam | null {
  const locked = new Date(m.kickoffAt).getTime() <= now.getTime();
  if (locked) {
    const sel = m.selections.find((s) => s.selectorId === user.id);
    if (sel)
      return { picks: [...sel.picks], captain: sel.captain ?? null, viceCaptain: sel.viceCaptain ?? null, bench: sel.bench ?? null, chip: sel.chip ?? null };
    if (m.status === "played") return null; // not entered that week
    return fromEntry(entryAt(user, m.kickoffAt), chipFor(user, m.id)?.chip ?? null);
  }
  return fromEntry(user.squadHistory.at(-1) ?? null, chipFor(user, m.id)?.chip ?? null);
}

export interface GwChanges {
  /** First team ever (nothing to compare with). */
  newTeam: boolean;
  in: string[];
  out: string[];
  captain: { from: string | null; to: string | null } | null;
  vice: { from: string | null; to: string | null } | null;
  bench: { from: string | null; to: string | null } | null;
  /** Transfers = players in (FPL counts one per player swapped). */
  transfers: number;
  /** Anything at all changed: players, armbands or bench. */
  changed: boolean;
}

export function diffTeams(prev: GwTeam | null, next: GwTeam): GwChanges {
  if (!prev)
    return { newTeam: true, in: [...next.picks], out: [], captain: null, vice: null, bench: null, transfers: 0, changed: true };
  const was = new Set(prev.picks);
  const now = new Set(next.picks);
  const inn = next.picks.filter((p) => !was.has(p));
  // Pair each player in with one out in the same position where possible ("Harry for Vineet").
  const left = prev.picks.filter((p) => !now.has(p));
  const pos = (id: string) => getPlayer(id)?.position ?? null;
  const out: string[] = [];
  for (const p of inn) {
    const i = left.findIndex((o) => pos(o) === pos(p));
    if (i >= 0) out.push(left.splice(i, 1)[0]);
  }
  out.push(...left);
  const swap = (a: string | null, b: string | null) => (a === b ? null : { from: a, to: b });
  const captain = swap(prev.captain, next.captain);
  const vice = swap(prev.viceCaptain, next.viceCaptain);
  const bench = swap(prev.bench, next.bench);
  return { newTeam: false, in: inn, out, captain, vice, bench, transfers: inn.length, changed: inn.length > 0 || !!captain || !!vice || !!bench };
}

export interface GwHistoryRow {
  n: number;
  matchId: string;
  date: string;
  /** Deadline passed: the team is fixed and public. */
  locked: boolean;
  played: boolean;
  team: GwTeam | null;
  changes: GwChanges | null;
  /** Points scored that gameweek (played weeks only). */
  points: number | null;
}

/**
 * One account's history: every gameweek from their first team up to the open one,
 * oldest first. Weeks after the open one aren't included (nothing to show yet).
 */
export function managerHistory(state: LeagueState, rules: ScoringRules, userId: string, now: Date): GwHistoryRow[] {
  const user = state.users.find((u) => u.id === userId);
  if (!user) return [];
  const open = nextDeadlineMatch(state, now);
  const played = new Set(playedMatches(state.matchDays).map((m) => m.id));
  const rows: GwHistoryRow[] = [];
  let prev: GwTeam | null = null;
  for (const { n, match: m } of gameweeks(state.matchDays)) {
    const locked = new Date(m.kickoffAt).getTime() <= now.getTime();
    if (!locked && m.id !== open?.id) break;
    const team = teamFor(user, m, now);
    if (!team && rows.length === 0) continue; // before their first team
    const sel = m.selections.find((s) => s.selectorId === user.id);
    rows.push({
      n,
      matchId: m.id,
      date: m.date,
      locked,
      played: played.has(m.id),
      team,
      changes: team ? diffTeams(prev, team) : null,
      points: played.has(m.id) && sel ? scoreSelection(sel, m, rules).points : null,
    });
    if (team) prev = team;
    if (!locked) break;
  }
  return rows;
}

/** What the table shows about the open gameweek: counts only, never names. */
export interface GwStatus {
  n: number;
  /** "none" = no team; "new" = first team; "no_changes" = carries over; "changes" = edited. */
  kind: "none" | "new" | "no_changes" | "changes";
  transfers: number;
  captainChanged: boolean;
  viceChanged: boolean;
  benchChanged: boolean;
  chip: boolean;
}

/**
 * Open-week status for every account in one pass: the gameweek list is built once and
 * each account's open team is compared with their last team before it. No scoring.
 */
export function openGwStatuses(state: LeagueState, now: Date): Map<string, GwStatus> {
  const out = new Map<string, GwStatus>();
  const open = nextDeadlineMatch(state, now);
  if (!open) return out;
  const gws = gameweeks(state.matchDays);
  const i = gws.findIndex((g) => g.match.id === open.id);
  if (i < 0) return out;
  const n = gws[i].n;
  const earlier = gws.slice(0, i).reverse();
  for (const user of state.users) {
    const team = teamFor(user, open, now);
    if (!team) {
      out.set(user.id, { n, kind: "none", transfers: 0, captainChanged: false, viceChanged: false, benchChanged: false, chip: false });
      continue;
    }
    let prev: GwTeam | null = null;
    for (const g of earlier) if ((prev = teamFor(user, g.match, now))) break;
    const c = diffTeams(prev, team);
    out.set(user.id, {
      n,
      kind: c.newTeam ? "new" : c.changed ? "changes" : "no_changes",
      transfers: c.transfers,
      captainChanged: !!c.captain,
      viceChanged: !!c.vice,
      benchChanged: !!c.bench,
      chip: !!team.chip,
    });
  }
  return out;
}

/** Strip player names from weeks that haven't locked (for anyone but the owner). */
export function publicHistory(rows: GwHistoryRow[]): GwHistoryRow[] {
  return rows.map((r) =>
    r.locked
      ? r
      : {
          ...r,
          team: null,
          changes: r.changes && {
            ...r.changes,
            in: r.changes.in.map(() => "?"),
            out: r.changes.out.map(() => "?"),
            captain: r.changes.captain && { from: null, to: null },
            vice: r.changes.vice && { from: null, to: null },
            bench: r.changes.bench && { from: null, to: null },
          },
        },
  );
}
