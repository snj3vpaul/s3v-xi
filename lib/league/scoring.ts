import { SCORING_RULES, type Outcome, type Score, type ScoringRules } from "./config";

export type Reason = "exact" | "outcome" | "miss";
export type PickScore = { points: number; reason: Reason; bonuses: string[] };

export function outcomeOf(score: Score): Outcome {
  if (score.home > score.away) return "home";
  if (score.home < score.away) return "away";
  return "draw";
}

/** Score one prediction against the real result using the configured rules. */
export function scorePick(pick: Score, result: Score, rules: ScoringRules = SCORING_RULES): PickScore {
  const reason: Reason =
    pick.home === result.home && pick.away === result.away ? "exact"
    : outcomeOf(pick) === outcomeOf(result) ? "outcome"
    : "miss";
  let points = rules[reason];
  const bonuses: string[] = [];
  for (const bonus of rules.bonuses) {
    if (bonus.onlyWhen && !bonus.onlyWhen.includes(reason)) continue;
    if (bonus.applies(pick, result)) { points += bonus.points; bonuses.push(bonus.id); }
  }
  return { points, reason, bonuses };
}

export function isValidGoals(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max;
}

// ---------------------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------------------

export type StandingUser = { id: string; name: string; avatar: string };
export type LedgerEntry = { userId: string; fixtureId: string; roundId: string; points: number; reason: Reason };
export type OrderedRound = { id: string; name: string };

export type StandingRow = StandingUser & {
  rank: number;
  tied: boolean;
  total: number;
  exact: number;
  outcome: number;
  miss: number;
  played: number;
  perRound: Record<string, number>;
  /** Rank before the most recent scored round, or null when there is no earlier round. */
  previousRank: number | null;
  /** Positive = climbed, negative = dropped, 0 = no change, null = no comparison yet. */
  movement: number | null;
};

type Tally = { total: number; exact: number; outcome: number; miss: number; played: number; perRound: Record<string, number> };

function tally(users: StandingUser[], ledger: LedgerEntry[]): Map<string, Tally> {
  const map = new Map<string, Tally>();
  for (const u of users) map.set(u.id, { total: 0, exact: 0, outcome: 0, miss: 0, played: 0, perRound: {} });
  for (const e of ledger) {
    const t = map.get(e.userId);
    if (!t) continue; // removed members are excluded from standings
    t.total += e.points;
    t[e.reason] += 1;
    t.played += 1;
    t.perRound[e.roundId] = (t.perRound[e.roundId] ?? 0) + e.points;
  }
  return map;
}

/**
 * Standard competition ranking ("1-2-2-4"): players level on points share a rank.
 * Display order inside a tie: more exact hits first, then name, so the list is stable.
 */
export function rankUsers(users: StandingUser[], ledger: LedgerEntry[]): Array<StandingUser & Tally & { rank: number; tied: boolean }> {
  const t = tally(users, ledger);
  const rows = users.map((u) => ({ ...u, ...t.get(u.id)! }));
  rows.sort((a, b) => b.total - a.total || b.exact - a.exact || a.name.localeCompare(b.name));
  const counts = new Map<number, number>();
  for (const r of rows) counts.set(r.total, (counts.get(r.total) ?? 0) + 1);
  let rank = 0;
  return rows.map((r, i) => {
    if (i === 0 || rows[i - 1].total !== r.total) rank = i + 1;
    return { ...r, rank, tied: (counts.get(r.total) ?? 0) > 1 };
  });
}

/**
 * Build the leaderboard. `rounds` must be in chronological order. Movement compares the
 * current table with the table as it stood before the latest round that has any points.
 */
export function buildStandings(users: StandingUser[], rounds: OrderedRound[], ledger: LedgerEntry[]): StandingRow[] {
  const current = rankUsers(users, ledger);
  const scoredRoundIds = new Set(ledger.map((e) => e.roundId));
  const scoredRounds = rounds.filter((r) => scoredRoundIds.has(r.id));
  let previous: Map<string, number> | null = null;
  if (scoredRounds.length >= 2) {
    const latest = scoredRounds[scoredRounds.length - 1].id;
    previous = new Map(rankUsers(users, ledger.filter((e) => e.roundId !== latest)).map((r) => [r.id, r.rank]));
  }
  return current.map((r) => {
    const previousRank = previous?.get(r.id) ?? null;
    return { ...r, previousRank, movement: previousRank === null ? null : previousRank - r.rank };
  });
}

// ---------------------------------------------------------------------------------------
// Achievements — playful titles, recomputed from history every time.
// ---------------------------------------------------------------------------------------

export type ScoredPick = {
  userId: string;
  fixtureId: string;
  kickoffAt: string;
  pick: Score;
  result: Score;
  reason: Reason;
};

export type Achievement = { id: string; emoji: string; title: string; detail: string };

/** A "bold" call: lots of goals or a big margin. */
export function isBoldPick(pick: Score): boolean {
  return pick.home + pick.away >= 5 || Math.abs(pick.home - pick.away) >= 3;
}

export function longestHitStreak(picks: ScoredPick[]): number {
  const ordered = [...picks].sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt) || a.fixtureId.localeCompare(b.fixtureId));
  let best = 0, run = 0;
  for (const p of ordered) { run = p.reason === "miss" ? 0 : run + 1; best = Math.max(best, run); }
  return best;
}

function leaders(values: Map<string, number>, minimum: number): string[] {
  let top = 0;
  for (const v of values.values()) top = Math.max(top, v);
  if (top < minimum) return [];
  const ids = [...values].filter(([, v]) => v === top).map(([id]) => id);
  return ids.length <= 3 ? ids : []; // a title shared by half the league isn't a title
}

export function computeAchievements(userIds: string[], picks: ScoredPick[]): Record<string, Achievement[]> {
  const byUser = new Map<string, ScoredPick[]>(userIds.map((id) => [id, []]));
  for (const p of picks) byUser.get(p.userId)?.push(p);

  const exacts = new Map<string, number>();
  const bold = new Map<string, number>();
  const streak = new Map<string, number>();
  const draws = new Map<string, number>();
  for (const [id, list] of byUser) {
    exacts.set(id, list.filter((p) => p.reason === "exact").length);
    bold.set(id, list.filter((p) => p.reason === "miss" && isBoldPick(p.pick)).length);
    streak.set(id, longestHitStreak(list));
    draws.set(id, list.filter((p) => p.reason !== "miss" && outcomeOf(p.result) === "draw").length);
  }

  const out: Record<string, Achievement[]> = Object.fromEntries(userIds.map((id) => [id, []]));
  for (const id of leaders(exacts, 1)) out[id].push({ id: "oracle", emoji: "🔮", title: "Score Oracle", detail: `Most exact scorelines (${exacts.get(id)})` });
  for (const id of leaders(streak, 3)) out[id].push({ id: "consistent", emoji: "📈", title: "Consistent", detail: `Longest scoring streak (${streak.get(id)} in a row)` });
  for (const id of leaders(draws, 2)) out[id].push({ id: "draw-whisperer", emoji: "🤝", title: "Draw Whisperer", detail: `Called the most draws (${draws.get(id)})` });
  for (const id of leaders(bold, 1)) out[id].push({ id: "optimist", emoji: "🌞", title: "Optimist", detail: `Most bold calls that didn't land (${bold.get(id)})` });
  return out;
}
