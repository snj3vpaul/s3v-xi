/**
 * RSFC League data model.
 *
 * The whole league is one JSON document (`LeagueState`). That is deliberate:
 * a friends' league of ~21 players and one match a week produces a few hundred
 * KB over many seasons, so one document in a KV store is simpler and safer
 * than a database. Every standings figure is DERIVED from match scorecards at
 * read time — nothing computed is ever stored — so editing an old match
 * automatically recalculates everything downstream.
 */

/** Which drawn team a goal is credited to on the match scoreboard. */
export type Side = "A" | "B";

/**
 * How the goal happened. Drives point rules (see lib/scoring/rules.ts).
 *  - open_play   normal goal; assist optional
 *  - header      header (e.g. from a cross); same points as open_play
 *  - penalty     +5; NO assist unless the admin explicitly records one
 *  - free_kick   direct free kick; +5; assists are never credited
 *  - own_goal    −2 to the player who put it in their own net; no assists
 *  - deflection  shot deflected in off an opponent; admin rules it own_goal or goal
 */
export type GoalKind = "open_play" | "header" | "penalty" | "free_kick" | "own_goal" | "deflection";

export type DeflectionRuling = "own_goal" | "goal";

export interface GoalEvent {
  id: string;
  /** Team credited on the scoreboard (for own goals: the team that BENEFITS). */
  side: Side;
  kind: GoalKind;
  /**
   * open_play/header/penalty/free_kick: the goal scorer.
   * own_goal: the player who put the ball in their own net.
   * deflection: the player who took the shot.
   */
  scorerId: string;
  assistId?: string | null;
  /** Pre-assist (the pass before the assist). Only scores when the rule is enabled. */
  secondAssistId?: string | null;
  /** deflection only: the opponent the shot deflected off. */
  deflectedById?: string | null;
  /** deflection only: the admin's ruling. Stored on the event so later setting changes never rewrite history. */
  deflectionRuling?: DeflectionRuling;
  minute?: number | null;
  note?: string;
}

export interface DrawConstraints {
  /** Deal drop-ins alternately so they split as evenly as possible. */
  splitDropIns: boolean;
  /** Reject a draw identical to the previous match's teams (same attendees only). */
  avoidRepeat: boolean;
  /** Pairs that must land on the same team. */
  keepTogether: [string, string][];
  /** Pairs that must land on opposite teams. */
  keepApart: [string, string][];
  /** Cap on players on the pitch per side; extras become rolling subs. */
  maxPerSide: number;
}

export interface DrawResult {
  /** Algorithm id — lets a future change of algorithm keep old draws verifiable. */
  algorithm: "sha256-ctr-fisher-yates-v1";
  /** 256-bit hex seed from crypto.randomBytes. Publish it; anyone can re-run the draw. */
  seed: string;
  /** Which attempt (0-based) under this seed satisfied the constraints. */
  attempt: number;
  constraints: DrawConstraints;
  /** Attendee ids exactly as passed to the draw (sorted), so verification is reproducible. */
  attendees: string[];
  /** Previous-match floater counts used to pick the floater (recorded for audit). */
  floaterCounts: Record<string, number>;
  /** Previous match teams used for the avoid-repeat check (recorded for audit). */
  previousTeams: { A: string[]; B: string[] } | null;
  teamA: string[];
  teamB: string[];
  /** Odd headcount: this player swaps sides at half-time (plays first half for `floaterFirstHalf`). */
  floater: string | null;
  floaterFirstHalf: Side | null;
  /** On-pitch players per side, e.g. 8 for "8v8". */
  perSide: number;
  /** Rolling subs per side (players beyond perSide on each team). */
  rollingSubs: number;
  drawnAt: string;
}

export type MatchStatus = "open" | "drawn" | "played";

/** Scoring rule set. 1 = original (+5/+3, deflections, second assist). 2 = simplified (+3/+2, MOTM, fair play). */
export type RulesVersion = 1 | 2;

/** Why a player lost their fair-play point. Each is a yes/no thing someone saw happen. */
export type FairPlayBreach = "foul" | "card" | "dissent" | "dangerous";

export interface FairPlayLoss {
  playerId: string;
  reason: FairPlayBreach;
}

/**
 * A selector's seven for one match day. Snapshotted from the user's standing
 * team (as it stood at the deadline) when the teams are drawn.
 * `selectorId` is a user id (legacy v1 data may hold a roster player id).
 */
export interface Selection {
  selectorId: string;
  picks: string[];
  submittedAt: string;
}

/** A league account. Anyone with an account can play Pick 7. */
export interface User {
  id: string;
  /** Lower-cased. */
  email: string;
  name: string;
  /** "scrypt$<salt hex>$<hash hex>" — never sent to the browser. */
  passwordHash: string;
  /** Roster player this account belongs to (optional; one account per player). */
  playerId: string | null;
  emailReminders: boolean;
  /** Bumped on password change/reset to sign out every existing session. */
  sessionVersion: number;
  createdAt: string;
  /**
   * Every change to the standing seven, oldest first. A match day uses the
   * latest entry saved before its deadline, so changes made after a deadline
   * count from the next week — exactly like FPL.
   */
  squadHistory: { picks: string[]; at: string }[];
}

export interface ReminderLog {
  userId: string;
  slot: string;
  at: string;
}

export interface MatchDay {
  id: string;
  /** ISO date (YYYY-MM-DD), in the club's time zone. */
  date: string;
  /** Kick-off instant (UTC ISO). Also the Pick 7 deadline. */
  kickoffAt: string;
  /** Set when generated from the weekly series in config/schedule.ts. */
  seriesId?: string;
  /** Reminder emails already sent for this match day (prevents duplicates). */
  reminders?: ReminderLog[];
  label?: string;
  status: MatchStatus;
  attendees: string[];
  draw: DrawResult | null;
  /** Goal-by-goal scorecard. Empty array + status "played" = a 0–0. */
  events: GoalEvent[];
  /** Snapshotted from users' standing teams when the teams are drawn. */
  selections: Selection[];
  createdAt: string;
  /** First time a scorecard was saved. Starts the correction window. */
  scorecardAt: string | null;
  /** Bumped on every scorecard correction. */
  scorecardVersion: number;
  /** Pins the scoring rules. Unset: v2 for match days on/after RULES_V2_FROM, else v1. */
  rulesVersion?: RulesVersion;
  /** v2: Man of the Match for each team (+4). */
  motm?: Record<Side, string | null>;
  /** v2: everyone who played keeps +1 fair play unless listed here. */
  fairPlayLost?: FairPlayLoss[];
}

export interface LeagueSettings {
  /** Default ruling pre-filled on new deflection entries. */
  deflectionDefault: DeflectionRuling;
  secondAssistEnabled: boolean;
  /** Hide drop-ins from season awards (they stay on leaderboards with a badge). */
  excludeDropInsFromAwards: boolean;
  /** Days after a scorecard is first saved during which it may be corrected. */
  correctionWindowDays: number;
  defaultConstraints: DrawConstraints;
}

export type AuditAction =
  | "matchday.create"
  | "matchday.delete"
  | "matchday.attendance"
  | "draw.create"
  | "draw.reset"
  | "selection.submit"
  | "squad.update"
  | "fixtures.create"
  | "user.signup"
  | "user.update"
  | "user.reset"
  | "user.delete"
  | "reminders.sent"
  | "scorecard.create"
  | "scorecard.correct"
  | "settings.update";

export interface AuditEntry {
  id: string;
  at: string;
  actor: "admin" | "system" | `player:${string}` | `user:${string}`;
  action: AuditAction;
  matchId?: string;
  /** Free-text reason; required for scorecard corrections. */
  reason?: string;
  /** Full prior value (never discarded) and the new value. */
  before?: unknown;
  after?: unknown;
}

export interface LeagueState {
  schemaVersion: 2;
  /** Optimistic-concurrency counter, bumped on every write. */
  version: number;
  settings: LeagueSettings;
  matchDays: MatchDay[];
  audit: AuditEntry[];
  users: User[];
  /** Series ids whose fixtures have been generated (so deleted weeks stay deleted). */
  seriesCreated: string[];
  /** True when this state was produced by `npm run seed:demo`. */
  demo?: boolean;
}
