/**
 * Pure state transitions for the league document.
 *
 * Every write goes through one of these functions: (state, input, ctx) → new
 * state. They never mutate their input, never touch storage, and append an
 * audit entry for every change. Prior values are kept in the audit entry's
 * `before`, so a correction never silently overwrites anything.
 */

import { CHIPS, CLUB, ROSTER, getPlayer, isDropIn, playerName } from "@/config/club";
import { SERIES } from "@/config/schedule";
import { weeklyDates, zonedToUtc } from "./schedule";
import { drawTeams, generateSeed } from "@/lib/draw/draw";
import { DEFAULT_RULES, playedMatches, rulesVersionOf, validateAwards, validateScorecard, type ScoringRules } from "@/lib/scoring/rules";
import { checkTeam, currentStars, isFormationValid } from "./pick7";
import type {
  AuditEntry,
  Chip,
  ChipPlay,
  SquadEntry,
  DrawConstraints,
  DrawResult,
  FairPlayLoss,
  GoalEvent,
  RotationMiss,
  LeagueSettings,
  LeagueState,
  MatchDay,
  Selection,
  Side,
  User,
} from "./types";

export class LedgerError extends Error {
  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export interface Ctx {
  now: Date;
  newId: () => string;
}

export const DEFAULT_CONSTRAINTS: DrawConstraints = {
  splitDropIns: true,
  avoidRepeat: true,
  keepTogether: [],
  keepApart: [],
  maxPerSide: CLUB.defaultMaxPerSide,
};

export const DEFAULT_SETTINGS: LeagueSettings = {
  deflectionDefault: DEFAULT_RULES.deflectionDefault,
  secondAssistEnabled: DEFAULT_RULES.secondAssistEnabled,
  excludeDropInsFromAwards: false,
  correctionWindowDays: 7,
  defaultConstraints: DEFAULT_CONSTRAINTS,
};

export function initialState(): LeagueState {
  return { schemaVersion: 2, version: 0, settings: DEFAULT_SETTINGS, matchDays: [], audit: [], users: [], seriesCreated: [] };
}

/** Upgrade any stored document to the current schema (v1 → v2 adds accounts & kick-off times). */
export function migrate(raw: unknown): LeagueState {
  const s = (raw ?? initialState()) as Partial<LeagueState> & { schemaVersion?: number };
  return {
    ...initialState(),
    ...s,
    schemaVersion: 2,
    users: s.users ?? [],
    seriesCreated: s.seriesCreated ?? [],
    settings: { ...DEFAULT_SETTINGS, ...(s.settings ?? {}) },
    matchDays: (s.matchDays ?? []).map((m) => ({
      ...m,
      kickoffAt: m.kickoffAt ?? zonedToUtc(m.date, SERIES.time, SERIES.timeZone).toISOString(),
    })),
  } as LeagueState;
}

export function rulesFrom(settings: LeagueSettings): ScoringRules {
  return { secondAssistEnabled: settings.secondAssistEnabled, deflectionDefault: settings.deflectionDefault };
}

const ROSTER_IDS = new Set(ROSTER.map((p) => p.id));

function audit(ctx: Ctx, e: Omit<AuditEntry, "id" | "at">): AuditEntry {
  return { id: ctx.newId(), at: ctx.now.toISOString(), ...e };
}

function findMatch(state: LeagueState, id: string): MatchDay {
  const m = state.matchDays.find((x) => x.id === id);
  if (!m) throw new LedgerError("Match day not found.");
  return m;
}

function replaceMatch(state: LeagueState, m: MatchDay, entry: AuditEntry): LeagueState {
  return {
    ...state,
    matchDays: state.matchDays.map((x) => (x.id === m.id ? m : x)),
    audit: [...state.audit, entry],
  };
}

function checkRoster(ids: readonly string[], what: string) {
  const bad = ids.filter((id) => !ROSTER_IDS.has(id));
  if (bad.length) throw new LedgerError(`${what}: unknown player(s) ${bad.join(", ")}.`);
}

// ---------------------------------------------------------------------------
// Match days
// ---------------------------------------------------------------------------

export function createMatchDay(
  state: LeagueState,
  input: { date: string; time?: string; label?: string; attendees?: string[]; seriesId?: string },
  ctx: Ctx,
): { state: LeagueState; match: MatchDay } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new LedgerError("Date must be YYYY-MM-DD.");
  const time = input.time ?? SERIES.time;
  if (!/^\d{2}:\d{2}$/.test(time)) throw new LedgerError("Kick-off time must be HH:MM.");
  const attendees = [...new Set(input.attendees ?? [])];
  checkRoster(attendees, "Attendance");
  const match: MatchDay = {
    id: ctx.newId(),
    date: input.date,
    kickoffAt: zonedToUtc(input.date, time, SERIES.timeZone).toISOString(),
    ...(input.seriesId ? { seriesId: input.seriesId } : {}),
    label: input.label?.trim() || undefined,
    status: "open",
    attendees,
    draw: null,
    events: [],
    selections: [],
    createdAt: ctx.now.toISOString(),
    scorecardAt: null,
    scorecardVersion: 0,
    rulesVersion: rulesVersionOf({ date: input.date }),
  };
  return {
    match,
    state: {
      ...state,
      matchDays: [...state.matchDays, match],
      audit: [...state.audit, audit(ctx, { actor: "admin", action: "matchday.create", matchId: match.id, after: { date: match.date, attendees } })],
    },
  };
}

export function setAttendance(state: LeagueState, matchId: string, attendees: string[], ctx: Ctx): LeagueState {
  const m = findMatch(state, matchId);
  if (m.status !== "open") throw new LedgerError("Attendance is locked once teams are drawn. Reset the draw first.");
  const next = [...new Set(attendees)];
  checkRoster(next, "Attendance");
  return replaceMatch(
    state,
    { ...m, attendees: next },
    audit(ctx, { actor: "admin", action: "matchday.attendance", matchId, before: m.attendees, after: next }),
  );
}

export function deleteMatchDay(state: LeagueState, matchId: string, ctx: Ctx): LeagueState {
  const m = findMatch(state, matchId);
  if (m.scorecardAt) throw new LedgerError("A match with a scorecard can't be deleted — correct it instead.");
  return {
    ...state,
    matchDays: state.matchDays.filter((x) => x.id !== matchId),
    audit: [...state.audit, audit(ctx, { actor: "admin", action: "matchday.delete", matchId, before: m })],
  };
}

// ---------------------------------------------------------------------------
// Draw
// ---------------------------------------------------------------------------

/** Matches that were drawn before `match` (by date, then creation). */
function earlierDrawn(state: LeagueState, match: MatchDay): MatchDay[] {
  return state.matchDays
    .filter((m) => m.id !== match.id && m.draw && (m.date < match.date || (m.date === match.date && m.createdAt < match.createdAt)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

export function floaterCounts(matches: MatchDay[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of matches) if (m.draw?.floater) out[m.draw.floater] = (out[m.draw.floater] ?? 0) + 1;
  return out;
}

/** @deprecated Legacy random draw (locked Pick 7 at the draw). Match days now use setTeamSheet. */
export function recordDraw(
  state: LeagueState,
  matchId: string,
  constraints: DrawConstraints,
  ctx: Ctx,
  seed: string = generateSeed(),
): LeagueState {
  const m = findMatch(state, matchId);
  if (m.status !== "open") throw new LedgerError("Teams are already drawn for this match day.");
  checkRoster(constraints.keepTogether.flat(), "Keep-together");
  checkRoster(constraints.keepApart.flat(), "Keep-apart");
  const history = earlierDrawn(state, m);
  const prev = history.at(-1)?.draw ?? null;
  let draw;
  try {
    draw = drawTeams({
      attendees: m.attendees,
      constraints,
      seed,
      isDropIn,
      previousTeams: prev ? { A: prev.teamA, B: prev.teamB } : null,
      floaterCounts: floaterCounts(history),
      minPerSide: CLUB.minPerSide,
      now: () => ctx.now,
    });
  } catch (e) {
    throw new LedgerError((e as Error).message);
  }
  // Pick 7 locks now: snapshot every user's seven as it stood at the deadline
  // (kick-off, or the moment of the draw if that came first).
  const deadline = new Date(Math.min(new Date(m.kickoffAt).getTime(), ctx.now.getTime())).toISOString();
  return replaceMatch(
    state,
    { ...m, status: "drawn", draw, selections: snapshotSelections(state.users, deadline, m.id) },
    audit(ctx, { actor: "admin", action: "draw.create", matchId, after: draw }),
  );
}

// ---------------------------------------------------------------------------
// Team sheet — captains pick sides over WhatsApp; the admin enters them here
// ---------------------------------------------------------------------------

/**
 * Set (or change) who played for White and Red. Also sets attendance. Can be
 * edited any time until the scorecard is in. Pick 7 isn't locked by this:
 * picks lock at kick-off.
 */
export function setTeamSheet(
  state: LeagueState,
  matchId: string,
  input: { teamA: string[]; teamB: string[] },
  ctx: Ctx,
): LeagueState {
  const m = findMatch(state, matchId);
  if (m.scorecardAt) throw new LedgerError("This match already has a scorecard, so its teams are final.");
  const teamA = [...new Set(input.teamA ?? [])];
  const teamB = [...new Set(input.teamB ?? [])];
  if (!teamA.length || !teamB.length) throw new LedgerError("Put at least one player on each team.");
  const both = teamA.filter((id) => teamB.includes(id));
  if (both.length) throw new LedgerError(`${both.map(playerName).join(", ")} can't be on both teams.`);
  checkRoster([...teamA, ...teamB], "Team sheet");
  const attendees = [...teamA, ...teamB];
  const draw: DrawResult = {
    algorithm: "manual",
    seed: "",
    attempt: 0,
    constraints: DEFAULT_CONSTRAINTS,
    attendees: [...attendees].sort(),
    floaterCounts: {},
    previousTeams: null,
    teamA,
    teamB,
    floater: null,
    floaterFirstHalf: null,
    perSide: Math.min(teamA.length, teamB.length),
    rollingSubs: 0,
    drawnAt: ctx.now.toISOString(),
  };
  return replaceMatch(
    state,
    { ...m, status: "drawn", attendees, draw },
    audit(ctx, {
      actor: "admin",
      action: "teams.set",
      matchId,
      before: m.draw ? { teamA: m.draw.teamA, teamB: m.draw.teamB } : null,
      after: { teamA, teamB },
    }),
  );
}

/**
 * The sevens locked for a match day: stored once the scorecard is in (or by a
 * legacy draw); before that, worked out from history as at kick-off once
 * kick-off has passed; none while picks are still open.
 */
export function lockedSelections(state: LeagueState, m: MatchDay, now: Date): Selection[] {
  if (m.scorecardAt || m.selections.length) return m.selections;
  if (now.getTime() < new Date(m.kickoffAt).getTime()) return [];
  return snapshotSelections(state.users, m.kickoffAt, m.id);
}

/** @deprecated Legacy random draw; match days now use setTeamSheet. Kept for old data and tests. */
export function resetDraw(state: LeagueState, matchId: string, reason: string, ctx: Ctx): LeagueState {
  const m = findMatch(state, matchId);
  if (!m.draw) throw new LedgerError("No draw to reset.");
  if (m.scorecardAt) throw new LedgerError("This match already has a scorecard; its teams are final.");
  if (!reason.trim()) throw new LedgerError("Give a reason for resetting the draw (it's shown in the audit log).");
  return replaceMatch(
    state,
    { ...m, status: "open", draw: null, selections: [] },
    audit(ctx, { actor: "admin", action: "draw.reset", matchId, reason, before: { draw: m.draw, selections: m.selections } }),
  );
}

// ---------------------------------------------------------------------------
// Pick 7 — standing team (FPL-style carry-over)
// ---------------------------------------------------------------------------

/** The user's seven as it stood at `atIso` (latest change at or before it), or null (none / removed). */
export function squadAt(user: Pick<User, "squadHistory">, atIso: string): string[] | null {
  let best: string[] | null = null;
  for (const h of user.squadHistory) if (h.at <= atIso) best = h.picks;
  return best?.length ? best : null;
}

/** The user's current seven, or null if they never picked or removed it. */
export function currentSquad(user: Pick<User, "squadHistory">): string[] | null {
  const last = user.squadHistory.at(-1)?.picks;
  return last?.length ? last : null;
}

/**
 * Lock every user's seven as it stood at the deadline. Only sevens in the
 * current formation are entered; an old pre-formation seven sits that week out
 * (the user is reminded and keeps it to fix). Stars aren't re-checked here: a
 * team saved within budget stays legal when ratings move.
 */
export function snapshotSelections(users: User[], deadlineIso: string, matchId?: string): Selection[] {
  const out: Selection[] = [];
  for (const u of users) {
    const picks = squadAt(u, deadlineIso);
    if (picks && isFormationValid(picks)) {
      const entry = [...u.squadHistory].reverse().find((h) => h.at <= deadlineIso)!;
      const captain = entry.captain && picks.includes(entry.captain) ? entry.captain : null;
      const viceCaptain = entry.viceCaptain && picks.includes(entry.viceCaptain) && entry.viceCaptain !== captain ? entry.viceCaptain : null;
      const bench = entry.bench && validBench(entry.bench, picks) ? entry.bench : null;
      // Only chips played before the deadline count (a chip can't be played after it anyway).
      const chip = matchId ? (u.chips ?? []).find((c) => c.matchId === matchId && c.at <= deadlineIso)?.chip ?? null : null;
      out.push({
        selectorId: u.id,
        picks: [...picks],
        captain,
        ...(viceCaptain ? { viceCaptain } : {}),
        ...(bench ? { bench } : {}),
        ...(chip ? { chip } : {}),
        submittedAt: entry.at,
      });
    }
  }
  return out;
}

/** A bench player must be a pickable player who isn't already in the seven. */
function validBench(id: string, picks: readonly string[]): boolean {
  return !!getPlayer(id)?.position && !picks.includes(id);
}

/** The user's latest saved squad entry, if they have a seven (null if none or removed). */
export function currentEntry(user: Pick<User, "squadHistory">): SquadEntry | null {
  const last = user.squadHistory.at(-1);
  return last?.picks.length ? last : null;
}

/** The user's current vice-captain (null if none). */
export function currentViceCaptain(user: Pick<User, "squadHistory">): string | null {
  const e = currentEntry(user);
  return e?.viceCaptain && e.picks.includes(e.viceCaptain) && e.viceCaptain !== e.captain ? e.viceCaptain : null;
}

/** The user's current bench player (null if none). */
export function currentBench(user: Pick<User, "squadHistory">): string | null {
  const e = currentEntry(user);
  return e?.bench && validBench(e.bench, e.picks) ? e.bench : null;
}

/** The user's current captain (null if none, or the seven was removed). */
export function currentCaptain(user: Pick<User, "squadHistory">): string | null {
  const last = user.squadHistory.at(-1);
  return last?.picks.length && last.captain && last.picks.includes(last.captain) ? last.captain : null;
}

/**
 * Save a new standing seven. It applies to every match day whose deadline is
 * still ahead. `captain` (one of the seven) scores double; the API requires it.
 * Left undefined, the previous captain is kept if they're still in the seven.
 */
export function setSquad(
  state: LeagueState,
  userId: string,
  picks: string[],
  ctx: Ctx,
  captain?: string | null,
  extra: { viceCaptain?: string | null; bench?: string | null } = {},
): LeagueState {
  const u = state.users.find((x) => x.id === userId);
  if (!u) throw new LedgerError("Account not found.");
  const unique = [...new Set(picks)];
  if (unique.length !== CLUB.picksPerSelector || picks.length !== CLUB.picksPerSelector)
    throw new LedgerError(`Pick exactly ${CLUB.picksPerSelector} different players.`);
  checkRoster(unique, "Picks");
  const prev = currentSquad(u);
  const check = checkTeam(unique, currentStars(state.matchDays), prev);
  if (!check.valid) throw new LedgerError(`That seven isn't valid: ${check.errors.join("; ")}.`, check.errors);
  const prevCaptain = currentCaptain(u);
  const cap = captain === undefined ? (prevCaptain && unique.includes(prevCaptain) ? prevCaptain : null) : captain;
  if (cap !== null && !unique.includes(cap)) throw new LedgerError("Your captain has to be one of your seven.");
  // Vice-captain and bench: left undefined, the previous ones are kept if they still fit.
  const prevVice = currentViceCaptain(u);
  const prevBench = currentBench(u);
  const vice =
    extra.viceCaptain === undefined ? (prevVice && unique.includes(prevVice) && prevVice !== cap ? prevVice : null) : extra.viceCaptain || null;
  if (vice !== null) {
    if (!unique.includes(vice)) throw new LedgerError("Your vice-captain has to be one of your seven.");
    if (vice === cap) throw new LedgerError("Your vice-captain can't also be your captain.");
  }
  const bench = extra.bench === undefined ? (prevBench && validBench(prevBench, unique) ? prevBench : null) : extra.bench || null;
  if (bench !== null) {
    checkRoster([bench], "Bench");
    if (!getPlayer(bench)?.position) throw new LedgerError(`${playerName(bench)} isn't available in Pick 7.`);
    if (unique.includes(bench)) throw new LedgerError("Your bench player can't also be in your seven.");
  }
  if (prev && prev.length === unique.length && prev.every((x) => unique.includes(x)) && cap === prevCaptain && vice === prevVice && bench === prevBench)
    return state; // no change
  const entry: SquadEntry = { picks: unique, at: ctx.now.toISOString(), captain: cap, viceCaptain: vice, bench };
  return {
    ...state,
    users: state.users.map((x) => (x.id === userId ? { ...x, squadHistory: [...x.squadHistory, entry] } : x)),
    audit: [
      ...state.audit,
      audit(ctx, { actor: `user:${userId}`, action: "squad.update",
        before: prev ? { picks: prev, captain: prevCaptain, viceCaptain: prevVice, bench: prevBench } : null,
        after: { picks: unique, captain: cap, viceCaptain: vice, bench },
      }),
    ],
  };
}

/**
 * Remove the standing seven: the user goes back to "no pick" for every match
 * day whose deadline is still ahead. Weeks already locked keep their snapshot,
 * and points already earned stay on the table.
 */
export function clearSquad(state: LeagueState, userId: string, ctx: Ctx): LeagueState {
  const u = state.users.find((x) => x.id === userId);
  if (!u) throw new LedgerError("Account not found.");
  const prev = currentSquad(u);
  if (!prev) return state; // nothing to remove
  return {
    ...state,
    users: state.users.map((x) => (x.id === userId ? { ...x, squadHistory: [...x.squadHistory, { picks: [], at: ctx.now.toISOString() }] } : x)),
    audit: [...state.audit, audit(ctx, { actor: `user:${userId}`, action: "squad.clear", before: prev })],
  };
}

// ---------------------------------------------------------------------------
// Pick 7 chips — Triple Captain and Bench Boost
// ---------------------------------------------------------------------------

export const CHIP_LIST: readonly Chip[] = ["triple_captain", "bench_boost"];

/** Chips a user has used: plays for match days that still exist (a deleted week gives the chip back). */
export function chipsUsed(state: LeagueState, user: Pick<User, "chips">): Record<Chip, number> {
  const live = new Set(state.matchDays.map((m) => m.id));
  const out: Record<Chip, number> = { triple_captain: 0, bench_boost: 0 };
  for (const c of user.chips ?? []) if (live.has(c.matchId)) out[c.chip] += 1;
  return out;
}

/** The chip a user has played for a match day, if any. */
export function chipFor(user: Pick<User, "chips">, matchId: string): ChipPlay | null {
  return (user.chips ?? []).find((c) => c.matchId === matchId) ?? null;
}

/**
 * Play a chip for the next match day (before its deadline). One chip per match
 * day; each chip has a season allowance (CHIPS[chip].perSeason).
 */
export function playChip(state: LeagueState, userId: string, chip: Chip, ctx: Ctx): LeagueState {
  const u = state.users.find((x) => x.id === userId);
  if (!u) throw new LedgerError("Account not found.");
  if (!CHIP_LIST.includes(chip)) throw new LedgerError("Unknown chip.");
  const m = nextDeadlineMatch(state, ctx.now);
  if (!m) throw new LedgerError("There's no upcoming match day to play a chip on.");
  const squad = currentSquad(u);
  if (!squad || !isFormationValid(squad)) throw new LedgerError("Save a seven before playing a chip.");
  if (chip === "triple_captain" && !currentCaptain(u)) throw new LedgerError("Choose a captain before playing Triple Captain.");
  if (chip === "bench_boost" && !currentBench(u)) throw new LedgerError("Pick a bench player before playing Bench Boost.");
  const existing = chipFor(u, m.id);
  if (existing?.chip === chip) return state;
  if (existing) throw new LedgerError(`You've already played ${CHIPS[existing.chip].label} this week. Cancel it first.`);
  if (chipsUsed(state, u)[chip] >= CHIPS[chip].perSeason)
    throw new LedgerError(`You've used all ${CHIPS[chip].perSeason} of your ${CHIPS[chip].label} chips this season.`);
  const play: ChipPlay = { chip, matchId: m.id, at: ctx.now.toISOString() };
  return {
    ...state,
    users: state.users.map((x) => (x.id === userId ? { ...x, chips: [...(x.chips ?? []), play] } : x)),
    audit: [...state.audit, audit(ctx, { actor: `user:${userId}`, action: "chip.play", matchId: m.id, after: play })],
  };
}

/** Cancel the chip played for the next match day (before its deadline). */
export function cancelChip(state: LeagueState, userId: string, ctx: Ctx): LeagueState {
  const u = state.users.find((x) => x.id === userId);
  if (!u) throw new LedgerError("Account not found.");
  const m = nextDeadlineMatch(state, ctx.now);
  const existing = m ? chipFor(u, m.id) : null;
  if (!m || !existing) return state;
  return {
    ...state,
    users: state.users.map((x) => (x.id === userId ? { ...x, chips: (x.chips ?? []).filter((c) => c !== existing && c.matchId !== m.id) } : x)),
    audit: [...state.audit, audit(ctx, { actor: `user:${userId}`, action: "chip.cancel", matchId: m.id, before: existing })],
  };
}

// ---------------------------------------------------------------------------
// Availability — "I can't make it this week"
// ---------------------------------------------------------------------------

/**
 * Flag a player as out (or back in) for one match day. A player's own linked
 * account can do it until kick-off; an admin can do it until the scorecard is
 * in. Informational only: it shows on the picker, it doesn't change scoring.
 */
export function setAvailability(
  state: LeagueState,
  input: { matchId: string; playerId: string; out: boolean; note?: string; by: "self" | "admin"; userId?: string },
  ctx: Ctx,
): LeagueState {
  const m = findMatch(state, input.matchId);
  checkRoster([input.playerId], "Availability");
  if (input.by === "self") {
    const u = state.users.find((x) => x.id === input.userId);
    if (!u || u.playerId !== input.playerId) throw new LedgerError("You can only change your own availability.");
    if (ctx.now.getTime() >= new Date(m.kickoffAt).getTime()) throw new LedgerError("This match day has kicked off. Ask an admin.");
  }
  if (m.scorecardAt) throw new LedgerError("This match already has a scorecard.");
  const list = m.unavailable ?? [];
  const was = list.find((x) => x.playerId === input.playerId) ?? null;
  if (!input.out && !was) return state;
  const note = input.note?.trim().slice(0, 80) || undefined;
  const next = input.out
    ? [...list.filter((x) => x.playerId !== input.playerId), { playerId: input.playerId, by: input.by, at: ctx.now.toISOString(), ...(note ? { note } : {}) }]
    : list.filter((x) => x.playerId !== input.playerId);
  return replaceMatch(
    state,
    { ...m, unavailable: next },
    audit(ctx, {
      actor: input.by === "admin" ? "admin" : `user:${input.userId}`,
      action: "availability.set",
      matchId: m.id,
      before: was,
      after: input.out ? { playerId: input.playerId, out: true, note } : { playerId: input.playerId, out: false },
    }),
  );
}

/** Players flagged out for a match day, by id (with the optional note). */
export function unavailableFor(m: Pick<MatchDay, "unavailable"> | null | undefined): Record<string, { by: "self" | "admin"; note?: string }> {
  const out: Record<string, { by: "self" | "admin"; note?: string }> = {};
  for (const x of m?.unavailable ?? []) out[x.playerId] = { by: x.by, ...(x.note ? { note: x.note } : {}) };
  return out;
}

/**
 * The next match day whose Pick 7 deadline (kick-off) hasn't passed. Posting
 * the team sheet early doesn't close picks; a legacy random draw did.
 */
export function nextDeadlineMatch(state: LeagueState, now: Date): MatchDay | null {
  return (
    [...state.matchDays]
      .filter(
        (m) =>
          m.status !== "played" &&
          (m.status === "open" || m.draw?.algorithm === "manual") &&
          new Date(m.kickoffAt).getTime() > now.getTime(),
      )
      .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))[0] ?? null
  );
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function checkClaim(state: LeagueState, playerId: string | null | undefined, exceptUserId?: string) {
  if (!playerId) return;
  if (!ROSTER_IDS.has(playerId)) throw new LedgerError("That player isn't on the RSFC roster.");
  const owner = state.users.find((u) => u.playerId === playerId && u.id !== exceptUserId);
  if (owner) throw new LedgerError("That player already has an account. Ask an admin if this is you.");
}

export function signUp(
  state: LeagueState,
  input: { email: string; name: string; passwordHash: string; playerId?: string | null },
  ctx: Ctx,
): { state: LeagueState; user: User } {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!EMAIL_RE.test(email) || email.length > 200) throw new LedgerError("Enter a valid email address.");
  if (state.users.some((u) => u.email === email)) throw new LedgerError("An account with that email already exists. Log in instead.");
  if (name.length < 1 || name.length > 40) throw new LedgerError("Name must be 1–40 characters.");
  checkClaim(state, input.playerId);
  const user: User = {
    id: ctx.newId(),
    email,
    name,
    passwordHash: input.passwordHash,
    playerId: input.playerId || null,
    emailReminders: true,
    sessionVersion: 1,
    createdAt: ctx.now.toISOString(),
    squadHistory: [],
  };
  return {
    user,
    state: {
      ...state,
      users: [...state.users, user],
      audit: [...state.audit, audit(ctx, { actor: `user:${user.id}`, action: "user.signup", after: { name, playerId: user.playerId } })],
    },
  };
}

export function updateAccount(
  state: LeagueState,
  userId: string,
  patch: { name?: string; playerId?: string | null; emailReminders?: boolean; passwordHash?: string },
  ctx: Ctx,
  actor: "admin" | `user:${string}` = `user:${userId}`,
): LeagueState {
  const u = state.users.find((x) => x.id === userId);
  if (!u) throw new LedgerError("Account not found.");
  const next: User = { ...u };
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (name.length < 1 || name.length > 40) throw new LedgerError("Name must be 1–40 characters.");
    next.name = name;
  }
  if (patch.playerId !== undefined) {
    checkClaim(state, patch.playerId, userId);
    next.playerId = patch.playerId || null;
  }
  if (patch.emailReminders !== undefined) next.emailReminders = !!patch.emailReminders;
  if (patch.passwordHash) {
    next.passwordHash = patch.passwordHash;
    next.sessionVersion = u.sessionVersion + 1;
  }
  const { passwordHash: _a, squadHistory: _b, ...pub } = next;
  return {
    ...state,
    users: state.users.map((x) => (x.id === userId ? next : x)),
    audit: [
      ...state.audit,
      audit(ctx, { actor, action: patch.passwordHash && actor === "admin" ? "user.reset" : "user.update", after: { ...pub, passwordChanged: !!patch.passwordHash } }),
    ],
  };
}

export function deleteUser(state: LeagueState, userId: string, ctx: Ctx): LeagueState {
  const u = state.users.find((x) => x.id === userId);
  if (!u) throw new LedgerError("Account not found.");
  return {
    ...state,
    users: state.users.filter((x) => x.id !== userId),
    audit: [...state.audit, audit(ctx, { actor: "admin", action: "user.delete", before: { name: u.name, email: u.email } })],
  };
}

// ---------------------------------------------------------------------------
// Weekly fixtures
// ---------------------------------------------------------------------------

/**
 * Create the weekly series' match days (once per series id). Kick-offs already
 * in the past are skipped, and so are dates that already have a match day.
 * Deleting a week later sticks: the series is never regenerated.
 */
export function ensureSeries(state: LeagueState, ctx: Ctx, series: typeof SERIES = SERIES): LeagueState {
  if (state.seriesCreated.includes(series.id)) return state;
  let next = state;
  const created: string[] = [];
  for (const date of weeklyDates(series.start, series.end, series.weekday)) {
    if (next.matchDays.some((m) => m.date === date)) continue;
    if (zonedToUtc(date, series.time, series.timeZone).getTime() <= ctx.now.getTime()) continue;
    next = createMatchDay(next, { date, time: series.time, seriesId: series.id }, ctx).state;
    created.push(date);
  }
  // Collapse the per-fixture audit entries into one.
  const audits = next.audit.slice(0, state.audit.length);
  return {
    ...next,
    seriesCreated: [...next.seriesCreated, series.id],
    audit: [
      ...audits,
      audit(ctx, { actor: "system", action: "fixtures.create", after: { series: series.id, count: created.length, first: created[0], last: created.at(-1) } }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

export function recordReminders(state: LeagueState, matchId: string, sent: { userId: string; slot: string }[], ctx: Ctx): LeagueState {
  if (!sent.length) return state;
  const m = findMatch(state, matchId);
  const log = sent.map((x) => ({ ...x, at: ctx.now.toISOString() }));
  return replaceMatch(
    state,
    { ...m, reminders: [...(m.reminders ?? []), ...log] },
    audit(ctx, { actor: "system", action: "reminders.sent", matchId, after: { count: sent.length, slot: sent[0].slot } }),
  );
}

// ---------------------------------------------------------------------------
// Scorecard & corrections
// ---------------------------------------------------------------------------

export function correctionDeadline(m: MatchDay, settings: LeagueSettings): Date | null {
  if (!m.scorecardAt) return null;
  return new Date(new Date(m.scorecardAt).getTime() + settings.correctionWindowDays * 86_400_000);
}

export function canCorrect(m: MatchDay, settings: LeagueSettings, now: Date): boolean {
  const d = correctionDeadline(m, settings);
  return d === null || now.getTime() <= d.getTime();
}

/**
 * Save the scorecard. The first save publishes the match; any later save is a
 * correction: it must happen inside the correction window, must give a reason,
 * and the full previous scorecard is kept in the audit entry. Standings are
 * derived from scorecards, so every dependent table recalculates on read.
 */
export function saveScorecard(
  state: LeagueState,
  matchId: string,
  events: GoalEvent[],
  input: {
    reason?: string;
    motm?: Partial<Record<Side, string | null>> | null;
    fairPlayLost?: FairPlayLoss[] | null;
    rotationMissed?: RotationMiss[] | null;
    rotationChecked?: boolean;
    noResult?: boolean;
  },
  ctx: Ctx,
): LeagueState {
  const m = findMatch(state, matchId);
  if (!m.draw) throw new LedgerError("Enter the team sheet before the scorecard.");
  const version = rulesVersionOf(m);
  const matchCtx = {
    knownPlayers: ROSTER_IDS,
    attendees: m.attendees,
    teamA: m.draw.teamA,
    teamB: m.draw.teamB,
    floater: m.draw.floater,
  };
  const issues = validateScorecard(events, matchCtx, rulesFrom(state.settings), version);
  if (version >= 2) issues.push(...validateAwards(input, matchCtx));
  const errors = issues.filter((i) => i.level === "error");
  if (errors.length) throw new LedgerError("The scorecard has errors.", errors);

  const isCorrection = m.scorecardAt !== null;
  if (isCorrection) {
    if (!canCorrect(m, state.settings, ctx.now))
      throw new LedgerError(
        `The ${state.settings.correctionWindowDays}-day correction window for this match closed on ${correctionDeadline(m, state.settings)!.toISOString().slice(0, 10)}.`,
      );
    if (!input.reason?.trim()) throw new LedgerError("Corrections need a reason for the audit log.");
  }
  const next: MatchDay = {
    ...m,
    status: "played",
    events: events.map((e) => ({ ...e })),
    // Pick 7 locks at kick-off: store the sevens as they stood then (or now, if
    // the scorecard somehow comes in before kick-off). Corrections keep them.
    selections: m.scorecardAt || m.selections.length ? m.selections : snapshotSelections(state.users, new Date(Math.min(new Date(m.kickoffAt).getTime(), ctx.now.getTime())).toISOString(), m.id),
    scorecardAt: m.scorecardAt ?? ctx.now.toISOString(),
    scorecardVersion: m.scorecardVersion + 1,
    rulesVersion: version,
    ...(version >= 2
      ? {
          motm: { A: input.motm?.A ?? null, B: input.motm?.B ?? null },
          fairPlayLost: (input.fairPlayLost ?? []).map((f) => ({ playerId: f.playerId, reason: f.reason })),
          rotationMissed: (input.rotationMissed ?? []).map((r) => ({ playerId: r.playerId, reason: r.reason })),
          rotationChecked: true,
          noResult: !!input.noResult,
        }
      : {}),
  };
  const snap = (x: MatchDay) => ({
    version: x.scorecardVersion,
    events: x.events,
    ...(version >= 2
      ? { motm: x.motm ?? null, fairPlayLost: x.fairPlayLost ?? [], rotationMissed: x.rotationMissed ?? [], noResult: !!x.noResult }
      : {}),
  });
  return replaceMatch(
    state,
    next,
    audit(ctx, {
      actor: "admin",
      action: isCorrection ? "scorecard.correct" : "scorecard.create",
      matchId,
      reason: input.reason?.trim() || undefined,
      before: isCorrection ? snap(m) : undefined,
      after: snap(next),
    }),
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function updateSettings(state: LeagueState, patch: Partial<LeagueSettings>, ctx: Ctx): LeagueState {
  const next: LeagueSettings = {
    ...state.settings,
    ...patch,
    defaultConstraints: { ...state.settings.defaultConstraints, ...(patch.defaultConstraints ?? {}) },
  };
  if (!["own_goal", "goal"].includes(next.deflectionDefault)) throw new LedgerError("Invalid deflection ruling.");
  if (!Number.isFinite(next.correctionWindowDays) || next.correctionWindowDays < 0 || next.correctionWindowDays > 365)
    throw new LedgerError("Correction window must be 0–365 days.");
  const mps = next.defaultConstraints.maxPerSide;
  if (!Number.isInteger(mps) || mps < CLUB.minPerSide || mps > 11) throw new LedgerError(`Max per side must be ${CLUB.minPerSide}–11.`);
  return {
    ...state,
    settings: next,
    audit: [...state.audit, audit(ctx, { actor: "admin", action: "settings.update", before: state.settings, after: next })],
  };
}

/** Convenience for pages: played matches in order. */
export const seasonMatches = (state: LeagueState) => playedMatches(state.matchDays);
