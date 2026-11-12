/**
 * Predictor League — the ONE place to tune the game.
 *
 * Points are purely virtual bragging rights between friends. They have no cash value,
 * cannot be bought, sold, exchanged or redeemed, and this app must never add deposits,
 * wagers, odds, prizes-for-money or bookmaker links. See README → "For fun only".
 */

export type Outcome = "home" | "draw" | "away";
export type Score = { home: number; away: number };

/** A pluggable bonus rule. Return true when the pick earns the bonus for this result. */
export type BonusRule = {
  id: string;
  label: string;
  points: number;
  /** Only evaluated when the base reason matches one of these (default: any). */
  onlyWhen?: Array<"exact" | "outcome" | "miss">;
  applies: (pick: Score, result: Score) => boolean;
};

export type ScoringRules = {
  /** Bump this whenever the numbers change so ledger rows record which rules produced them. */
  version: string;
  exact: number;
  outcome: number;
  miss: number;
  bonuses: BonusRule[];
};

export const SCORING_RULES: ScoringRules = {
  version: "predictor-v1",
  exact: 3,
  outcome: 1,
  miss: 0,
  // Add tiebreaker/bonus rules here later. Example (disabled):
  // { id: "clean-sheet-call", label: "Called a clean sheet", points: 1, onlyWhen: ["outcome"],
  //   applies: (p, r) => (p.home === 0 && r.home === 0) || (p.away === 0 && r.away === 0) },
  bonuses: [],
};

export const LEAGUE_LIMITS = {
  /** Highest score a player may predict or an admin may enter for one side. */
  maxGoals: 20,
  /** Picks lock this many minutes before kick-off unless the admin sets a custom deadline. */
  lockMinutesBeforeKickoff: 0,
  minPasswordLength: 8,
  maxNameLength: 24,
  maxTeamNameLength: 40,
  maxRoundNameLength: 40,
  maxFixturesPerRound: 20,
  sessionDays: 30,
};

/** Simple fixed-window limits, per key (user id or IP). */
export const RATE_LIMITS = {
  login: { max: 10, windowMs: 10 * 60_000 },
  signup: { max: 6, windowMs: 60 * 60_000 },
  picks: { max: 40, windowMs: 60_000 },
  admin: { max: 120, windowMs: 60_000 },
};

/** Emoji avatars a player can choose from. Validated server-side. */
export const AVATARS = [
  "🦊", "🐙", "🦁", "🐝", "🦖", "🚀", "🌶️", "🐼", "🦄", "🐸", "🦉", "🐯",
  "🐧", "🦈", "🍕", "🎸", "👑", "🔥", "⚡", "🌈", "🍩", "🎯", "🧠", "🥨",
] as const;

export const SESSION_COOKIE = "league_session";
