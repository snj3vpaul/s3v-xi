/**
 * Pure state transitions for the league document.
 *
 * Every write goes through one of these functions: (state, input, ctx) → new
 * state. They never mutate their input, never touch storage, and append an
 * audit entry for every change. Prior values are kept in the audit entry's
 * `before`, so a correction never silently overwrites anything.
 */

import { CLUB, ROSTER, getPlayer, isDropIn } from "@/config/club";
import { drawTeams, generateSeed } from "@/lib/draw/draw";
import { DEFAULT_RULES, playedMatches, validateScorecard, type ScoringRules } from "@/lib/scoring/rules";
import type {
  AuditEntry,
  DrawConstraints,
  GoalEvent,
  LeagueSettings,
  LeagueState,
  MatchDay,
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
  return { schemaVersion: 1, version: 0, settings: DEFAULT_SETTINGS, matchDays: [], audit: [] };
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
  input: { date: string; label?: string; attendees?: string[] },
  ctx: Ctx,
): { state: LeagueState; match: MatchDay } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new LedgerError("Date must be YYYY-MM-DD.");
  const attendees = [...new Set(input.attendees ?? [])];
  checkRoster(attendees, "Attendance");
  const match: MatchDay = {
    id: ctx.newId(),
    date: input.date,
    label: input.label?.trim() || undefined,
    status: "open",
    attendees,
    draw: null,
    events: [],
    selections: [],
    createdAt: ctx.now.toISOString(),
    scorecardAt: null,
    scorecardVersion: 0,
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
  return replaceMatch(
    state,
    { ...m, status: "drawn", draw },
    audit(ctx, { actor: "admin", action: "draw.create", matchId, after: draw }),
  );
}

export function resetDraw(state: LeagueState, matchId: string, reason: string, ctx: Ctx): LeagueState {
  const m = findMatch(state, matchId);
  if (!m.draw) throw new LedgerError("No draw to reset.");
  if (m.scorecardAt) throw new LedgerError("This match already has a scorecard; its teams are final.");
  if (!reason.trim()) throw new LedgerError("Give a reason for resetting the draw (it's shown in the audit log).");
  return replaceMatch(
    state,
    { ...m, status: "open", draw: null },
    audit(ctx, { actor: "admin", action: "draw.reset", matchId, reason, before: m.draw }),
  );
}

// ---------------------------------------------------------------------------
// Selections
// ---------------------------------------------------------------------------

export function submitSelection(
  state: LeagueState,
  matchId: string,
  selectorId: string,
  picks: string[],
  ctx: Ctx,
): LeagueState {
  const m = findMatch(state, matchId);
  if (m.status !== "open") throw new LedgerError("Selections closed — the teams have been drawn.");
  if (!getPlayer(selectorId)) throw new LedgerError("Unknown selector.");
  const unique = [...new Set(picks)];
  if (unique.length !== CLUB.picksPerSelector)
    throw new LedgerError(`Pick exactly ${CLUB.picksPerSelector} different players.`);
  checkRoster(unique, "Picks");
  const before = m.selections.find((s) => s.selectorId === selectorId) ?? null;
  const sel = { selectorId, picks: unique, submittedAt: ctx.now.toISOString() };
  return replaceMatch(
    state,
    { ...m, selections: [...m.selections.filter((s) => s.selectorId !== selectorId), sel] },
    audit(ctx, { actor: `player:${selectorId}`, action: "selection.submit", matchId, before, after: sel }),
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
  input: { reason?: string },
  ctx: Ctx,
): LeagueState {
  const m = findMatch(state, matchId);
  if (!m.draw) throw new LedgerError("Draw the teams before entering a scorecard.");
  const issues = validateScorecard(
    events,
    {
      knownPlayers: ROSTER_IDS,
      attendees: m.attendees,
      teamA: m.draw.teamA,
      teamB: m.draw.teamB,
      floater: m.draw.floater,
    },
    rulesFrom(state.settings),
  );
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
    scorecardAt: m.scorecardAt ?? ctx.now.toISOString(),
    scorecardVersion: m.scorecardVersion + 1,
  };
  return replaceMatch(
    state,
    next,
    audit(ctx, {
      actor: "admin",
      action: isCorrection ? "scorecard.correct" : "scorecard.create",
      matchId,
      reason: input.reason?.trim() || undefined,
      before: isCorrection ? { version: m.scorecardVersion, events: m.events } : undefined,
      after: { version: next.scorecardVersion, events: next.events },
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
