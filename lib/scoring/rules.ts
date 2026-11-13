/**
 * RSFC League — scoring rules.
 *
 * THIS IS THE ONLY PLACE POINTS ARE DECIDED. Everything here is pure: no I/O,
 * no clock, no randomness. Pages, charts, the API and the tests all call these
 * functions, so a rule changed here changes everywhere at once.
 *
 * Scoring comes ONLY from the match scorecard (goals and assists):
 *
 *   Goal (any type)                    +5 to the scorer
 *   Assist                             +3 to the assister
 *   Second assist (pre-assist)         +1 — only when the rule is enabled (default OFF)
 *   Own goal                           −2 to the player who put it in their own net
 *
 * Edge cases (each one has a named unit test — see docs/SCORING.md):
 *   - Assisted goal: scorer +5 AND assister +3.
 *   - Solo goal: scorer +5, nobody else scores.
 *   - Own goal: −2 to that player. It is NOT a goal in anyone's stats (it does
 *     count on the match scoreboard for the benefiting team). Assists recorded
 *     on an own goal earn nothing.
 *   - Deflection: the admin rules it an own goal (default) or the shooter's goal.
 *       ruled own_goal → deflecting player −2; shooter and assisters get nothing.
 *       ruled goal     → shooter +5, assister +3 as for any goal.
 *   - Penalty: +5. No assist by default; an assist counts only if the admin
 *     explicitly records one (e.g. the pass before the foul). "Won the penalty"
 *     is never an assist by itself.
 *   - Direct free kick: +5, assists are never credited.
 *   - Header from a cross: an ordinary goal + assist.
 *   - A player who scores and assists in one match: both accumulate.
 *   - Drop-ins: identical point values.
 *   - Totals may go negative; nothing floors at zero.
 *
 * Leaderboard tie-break (applied in order):
 *   1. more points  2. more goals  3. more assists
 *   4. head-to-head: among players still level, compare each pair's points
 *      earned in the matches they BOTH played; a player "wins" a pair by
 *      scoring more in those shared matches. Order by pairwise wins.
 *   5. anyone still level shares the rank (competition ranking: 1, 2, 2, 4).
 */

import type { DeflectionRuling, GoalEvent, GoalKind, MatchDay, Side } from "@/lib/league/types";

// ---------------------------------------------------------------------------
// Point values & rule switches
// ---------------------------------------------------------------------------

export const POINTS = {
  goal: 5,
  assist: 3,
  ownGoal: -2,
  secondAssist: 1,
} as const;

export interface ScoringRules {
  /** Pre-assist (+1). Default OFF. */
  secondAssistEnabled: boolean;
  /** Used only when a deflection event has no recorded ruling. Default own_goal. */
  deflectionDefault: DeflectionRuling;
}

export const DEFAULT_RULES: ScoringRules = {
  secondAssistEnabled: false,
  deflectionDefault: "own_goal",
};

export const GOAL_KINDS: readonly GoalKind[] = [
  "open_play",
  "header",
  "penalty",
  "free_kick",
  "own_goal",
  "deflection",
];

export const GOAL_KIND_LABEL: Record<GoalKind, string> = {
  open_play: "Open play",
  header: "Header",
  penalty: "Penalty",
  free_kick: "Direct free kick",
  own_goal: "Own goal",
  deflection: "Deflection",
};

// ---------------------------------------------------------------------------
// Single event → contributions
// ---------------------------------------------------------------------------

export type ContributionKind = "goal" | "assist" | "second_assist" | "own_goal";

export interface Contribution {
  playerId: string;
  kind: ContributionKind;
  points: number;
  eventId: string;
}

export interface EventScore {
  contributions: Contribution[];
  /** Human-readable notes about anything recorded but deliberately not scored. */
  ignored: string[];
}

/** Resolve the effective ruling for a deflection (recorded ruling wins over the default). */
export function deflectionRulingOf(e: GoalEvent, rules: ScoringRules): DeflectionRuling {
  return e.deflectionRuling ?? rules.deflectionDefault;
}

/** Score one scorecard entry. Pure. */
export function scoreEvent(e: GoalEvent, rules: ScoringRules = DEFAULT_RULES): EventScore {
  const out: Contribution[] = [];
  const ignored: string[] = [];
  const add = (playerId: string, kind: ContributionKind, points: number) =>
    out.push({ playerId, kind, points, eventId: e.id });

  const hasAssist = !!e.assistId;
  const hasSecond = !!e.secondAssistId;

  // Own goal (or a deflection ruled as one): −2 to the unlucky player, nothing else.
  const isOwnGoal = e.kind === "own_goal" || (e.kind === "deflection" && deflectionRulingOf(e, rules) === "own_goal");
  if (isOwnGoal) {
    const ownGoalBy = e.kind === "own_goal" ? e.scorerId : (e.deflectedById ?? null);
    if (ownGoalBy) add(ownGoalBy, "own_goal", POINTS.ownGoal);
    else ignored.push("Deflection ruled an own goal but no deflecting player recorded — nobody scored.");
    if (hasAssist || hasSecond) ignored.push("Assists on an own goal earn nothing.");
    if (e.kind === "deflection") ignored.push("Shot ruled an own goal: the shooter gets no goal.");
    return { contributions: out, ignored };
  }

  // Every other kind is a real goal for the scorer.
  add(e.scorerId, "goal", POINTS.goal);

  if (e.kind === "free_kick") {
    if (hasAssist || hasSecond) ignored.push("Direct free kicks have no assist.");
    return { contributions: out, ignored };
  }

  // Penalties: no assist unless the admin explicitly recorded one — which is what
  // `hasAssist` means here — so the same code path as open play applies.
  if (hasAssist && e.assistId !== e.scorerId) {
    add(e.assistId!, "assist", POINTS.assist);
    if (hasSecond) {
      const valid = e.secondAssistId !== e.scorerId && e.secondAssistId !== e.assistId;
      if (!rules.secondAssistEnabled) ignored.push("Second-assist rule is off.");
      else if (!valid) ignored.push("Second assist must be a different player from the scorer and assister.");
      else add(e.secondAssistId!, "second_assist", POINTS.secondAssist);
    }
  } else {
    if (hasAssist) ignored.push("A player cannot assist their own goal.");
    if (hasSecond) ignored.push("A second assist needs an assist first.");
  }
  return { contributions: out, ignored };
}

// ---------------------------------------------------------------------------
// Match → per-player lines
// ---------------------------------------------------------------------------

export interface PlayerMatchLine {
  playerId: string;
  goals: number;
  assists: number;
  secondAssists: number;
  ownGoals: number;
  points: number;
}

export function emptyLine(playerId: string): PlayerMatchLine {
  return { playerId, goals: 0, assists: 0, secondAssists: 0, ownGoals: 0, points: 0 };
}

/**
 * Per-player lines for one match. Every attendee gets a line (0 if they didn't
 * score) so "played, no points" is distinguishable from "didn't play".
 */
export function scoreMatch(
  match: Pick<MatchDay, "events" | "attendees">,
  rules: ScoringRules = DEFAULT_RULES,
): Map<string, PlayerMatchLine> {
  const lines = new Map<string, PlayerMatchLine>();
  const line = (id: string) => {
    let l = lines.get(id);
    if (!l) lines.set(id, (l = emptyLine(id)));
    return l;
  };
  for (const id of match.attendees) line(id);
  for (const e of match.events) {
    for (const c of scoreEvent(e, rules).contributions) {
      const l = line(c.playerId);
      l.points += c.points;
      if (c.kind === "goal") l.goals += 1;
      else if (c.kind === "assist") l.assists += 1;
      else if (c.kind === "second_assist") l.secondAssists += 1;
      else if (c.kind === "own_goal") l.ownGoals += 1;
    }
  }
  return lines;
}

/** Scoreboard result. Own goals count for the benefiting side here (but never as a player's goal). */
export function scoreline(events: GoalEvent[]): Record<Side, number> {
  const s: Record<Side, number> = { A: 0, B: 0 };
  for (const e of events) s[e.side] += 1;
  return s;
}

// ---------------------------------------------------------------------------
// Season standings & tie-breaks
// ---------------------------------------------------------------------------

export interface StandingRow extends Omit<PlayerMatchLine, "playerId"> {
  playerId: string;
  played: number;
  /** Points per played match id. */
  perMatch: Record<string, number>;
  /** Points in the last up-to-5 played matches, oldest → newest. */
  form: number[];
  rank: number;
  /** True when this rank is shared after every tie-break. */
  sharedRank: boolean;
}

/** Matches that count: status "played", ordered by date then creation. */
export function playedMatches<T extends Pick<MatchDay, "status" | "date" | "createdAt">>(matches: T[]): T[] {
  return matches
    .filter((m) => m.status === "played")
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

/**
 * Season standings for `playerIds` (normally the full roster, so every member
 * appears even before they've played). Anyone who scored but isn't listed is
 * added too, so nothing is silently dropped.
 */
export function buildStandings(
  matches: MatchDay[],
  playerIds: readonly string[],
  rules: ScoringRules = DEFAULT_RULES,
): StandingRow[] {
  const played = playedMatches(matches);
  const rows = new Map<string, StandingRow>();
  const row = (id: string) => {
    let r = rows.get(id);
    if (!r)
      rows.set(
        id,
        (r = {
          ...emptyLine(id),
          played: 0,
          perMatch: {},
          form: [],
          rank: 0,
          sharedRank: false,
        }),
      );
    return r;
  };
  for (const id of playerIds) row(id);

  for (const m of played) {
    for (const l of scoreMatch(m, rules).values()) {
      const r = row(l.playerId);
      r.goals += l.goals;
      r.assists += l.assists;
      r.secondAssists += l.secondAssists;
      r.ownGoals += l.ownGoals;
      r.points += l.points;
      r.perMatch[m.id] = l.points;
      if (m.attendees.includes(l.playerId)) r.played += 1;
    }
  }
  const order = played.map((m) => m.id);
  for (const r of rows.values()) {
    r.form = order.filter((id) => id in r.perMatch).slice(-5).map((id) => r.perMatch[id]);
  }
  return rankStandings([...rows.values()]);
}

/** Head-to-head: points each earned in matches both played. Returns +1 if a wins, −1 if b wins, 0 level. */
export function headToHead(a: Pick<StandingRow, "perMatch">, b: Pick<StandingRow, "perMatch">): number {
  let pa = 0;
  let pb = 0;
  for (const id of Object.keys(a.perMatch)) {
    if (id in b.perMatch) {
      pa += a.perMatch[id];
      pb += b.perMatch[id];
    }
  }
  return Math.sign(pa - pb);
}

/**
 * Sort and assign ranks per the documented tie-break. Generic so the tests can
 * feed minimal rows. Stable: fully-tied players are listed alphabetically by id.
 */
export function rankStandings<
  T extends { playerId: string; points: number; goals: number; assists: number; perMatch: Record<string, number>; rank: number; sharedRank: boolean },
>(rows: T[]): T[] {
  const primary = (a: T, b: T) => b.points - a.points || b.goals - a.goals || b.assists - a.assists;
  const sorted = [...rows].sort((a, b) => primary(a, b) || a.playerId.localeCompare(b.playerId));

  const result: T[] = [];
  let i = 0;
  while (i < sorted.length) {
    // Group of players level on points, goals and assists.
    let j = i + 1;
    while (j < sorted.length && primary(sorted[i], sorted[j]) === 0) j++;
    const group = sorted.slice(i, j);

    if (group.length === 1) {
      result.push({ ...group[0], rank: i + 1, sharedRank: false });
    } else {
      // Pairwise head-to-head wins inside the group.
      const wins = new Map(group.map((g) => [g.playerId, 0]));
      for (let x = 0; x < group.length; x++)
        for (let y = x + 1; y < group.length; y++) {
          const h = headToHead(group[x], group[y]);
          if (h > 0) wins.set(group[x].playerId, wins.get(group[x].playerId)! + 1);
          if (h < 0) wins.set(group[y].playerId, wins.get(group[y].playerId)! + 1);
        }
      const byWins = [...group].sort(
        (a, b) => wins.get(b.playerId)! - wins.get(a.playerId)! || a.playerId.localeCompare(b.playerId),
      );
      let k = 0;
      while (k < byWins.length) {
        let l = k + 1;
        while (l < byWins.length && wins.get(byWins[l].playerId) === wins.get(byWins[k].playerId)) l++;
        const shared = l - k > 1;
        for (let q = k; q < l; q++) result.push({ ...byWins[q], rank: i + k + 1, sharedRank: shared });
        k = l;
      }
    }
    i = j;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Selections ("pick 7")
// ---------------------------------------------------------------------------

/**
 * A selector picks 7 players before the draw. After the match, the selector
 * earns exactly the points those 7 players earned in that match — whichever
 * drawn team they landed on. A pick who didn't play earns 0. A "hit" is a pick
 * who recorded at least one goal or credited assist (own goals are not hits).
 */
export interface SelectionResult {
  selectorId: string;
  matchId: string;
  picks: string[];
  points: number;
  hits: number;
  /** Picks who actually played. */
  picksPlayed: number;
  perPick: { playerId: string; points: number; hit: boolean; played: boolean }[];
}

export function scoreSelection(
  selection: { selectorId: string; picks: string[] },
  match: Pick<MatchDay, "id" | "events" | "attendees">,
  rules: ScoringRules = DEFAULT_RULES,
  lines: Map<string, PlayerMatchLine> = scoreMatch(match, rules),
): SelectionResult {
  const picks = [...new Set(selection.picks)];
  const perPick = picks.map((id) => {
    const l = lines.get(id);
    const played = match.attendees.includes(id);
    const hit = !!l && l.goals + l.assists + l.secondAssists > 0;
    return { playerId: id, points: l?.points ?? 0, hit, played };
  });
  return {
    selectorId: selection.selectorId,
    matchId: match.id,
    picks,
    points: perPick.reduce((s, p) => s + p.points, 0),
    hits: perPick.filter((p) => p.hit).length,
    picksPlayed: perPick.filter((p) => p.played).length,
    perPick,
  };
}

export interface SelectorRow {
  selectorId: string;
  rounds: number;
  points: number;
  hits: number;
  totalPicks: number;
  /** hits ÷ picks, 0..1 (0 when no rounds). */
  hitRate: number;
  rank: number;
  sharedRank: boolean;
}

/** Season selector table. Ranked by points, then hits; otherwise shared. */
export function buildSelectorStandings(matches: MatchDay[], rules: ScoringRules = DEFAULT_RULES): SelectorRow[] {
  const rows = new Map<string, SelectorRow>();
  for (const m of playedMatches(matches)) {
    const lines = scoreMatch(m, rules);
    for (const s of m.selections) {
      const r = scoreSelection(s, m, rules, lines);
      const row =
        rows.get(s.selectorId) ??
        { selectorId: s.selectorId, rounds: 0, points: 0, hits: 0, totalPicks: 0, hitRate: 0, rank: 0, sharedRank: false };
      row.rounds += 1;
      row.points += r.points;
      row.hits += r.hits;
      row.totalPicks += r.picks.length;
      row.hitRate = row.totalPicks ? row.hits / row.totalPicks : 0;
      rows.set(s.selectorId, row);
    }
  }
  const sorted = [...rows.values()].sort(
    (a, b) => b.points - a.points || b.hits - a.hits || a.selectorId.localeCompare(b.selectorId),
  );
  return sorted.map((r) => {
    const first = sorted.findIndex((x) => x.points === r.points && x.hits === r.hits);
    const count = sorted.filter((x) => x.points === r.points && x.hits === r.hits).length;
    return { ...r, rank: first + 1, sharedRank: count > 1 };
  });
}

// ---------------------------------------------------------------------------
// Season awards
// ---------------------------------------------------------------------------

export interface Award {
  key: "mvp" | "golden_boot" | "playmaker" | "oracle";
  title: string;
  /** Co-winners when tied on the award's measure. Empty if nobody qualifies (> 0 needed). */
  winners: string[];
  value: number;
  unit: string;
}

export function computeAwards(
  standings: StandingRow[],
  selectors: SelectorRow[],
  opts: { excludeDropIns: boolean; isDropIn: (id: string) => boolean },
): Award[] {
  const eligible = (id: string) => !(opts.excludeDropIns && opts.isDropIn(id));
  const top = (
    key: Award["key"],
    title: string,
    unit: string,
    entries: { id: string; v: number }[],
  ): Award => {
    const pool = entries.filter((e) => eligible(e.id) && e.v > 0);
    const best = pool.length ? Math.max(...pool.map((e) => e.v)) : 0;
    return { key, title, unit, value: best, winners: pool.filter((e) => e.v === best).map((e) => e.id) };
  };
  // MVP honours the full tie-break: the eligible player(s) holding the best rank.
  const mvpPool = standings.filter((r) => eligible(r.playerId) && r.points > 0);
  const mvpRank = mvpPool.length ? Math.min(...mvpPool.map((r) => r.rank)) : 0;
  return [
    {
      key: "mvp",
      title: "Player of the Season",
      unit: "pts",
      value: mvpPool.find((r) => r.rank === mvpRank)?.points ?? 0,
      winners: mvpPool.filter((r) => r.rank === mvpRank).map((r) => r.playerId),
    },
    top("golden_boot", "Golden Boot", "goals", standings.map((r) => ({ id: r.playerId, v: r.goals }))),
    top("playmaker", "Playmaker", "assists", standings.map((r) => ({ id: r.playerId, v: r.assists }))),
    top("oracle", "The Oracle", "selector pts", selectors.map((r) => ({ id: r.selectorId, v: r.points }))),
  ];
}

// ---------------------------------------------------------------------------
// Scorecard validation
// ---------------------------------------------------------------------------

export interface ValidationIssue {
  level: "error" | "warning";
  eventId?: string;
  message: string;
}

export interface MatchContext {
  /** Every id the club knows (roster). */
  knownPlayers: ReadonlySet<string>;
  attendees: readonly string[];
  teamA?: readonly string[];
  teamB?: readonly string[];
  floater?: string | null;
}

/**
 * Errors block saving. Warnings are shown to the admin but allowed — e.g. a
 * player who swapped bibs at half-time scoring for the "wrong" team.
 */
export function validateScorecard(events: GoalEvent[], ctx: MatchContext, rules: ScoringRules = DEFAULT_RULES): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (eventId: string, message: string) => issues.push({ level: "error", eventId, message });
  const warn = (eventId: string, message: string) => issues.push({ level: "warning", eventId, message });
  const seen = new Set<string>();
  const attending = new Set(ctx.attendees);
  const teamOf = (id: string): Side | "floater" | null =>
    ctx.floater === id ? "floater" : ctx.teamA?.includes(id) ? "A" : ctx.teamB?.includes(id) ? "B" : null;
  const other = (s: Side): Side => (s === "A" ? "B" : "A");

  events.forEach((e, idx) => {
    const n = `Goal ${idx + 1}`;
    if (!e.id) err("", `${n}: missing id.`);
    if (seen.has(e.id)) err(e.id, `${n}: duplicate entry id.`);
    seen.add(e.id);
    if (e.side !== "A" && e.side !== "B") err(e.id, `${n}: team must be A or B.`);
    if (!GOAL_KINDS.includes(e.kind)) err(e.id, `${n}: unknown goal type "${e.kind}".`);

    const people: [string, string | null | undefined][] = [
      ["scorer", e.scorerId],
      ["assister", e.assistId],
      ["second assister", e.secondAssistId],
      ["deflecting player", e.deflectedById],
    ];
    for (const [role, id] of people) {
      if (!id) continue;
      if (!ctx.knownPlayers.has(id)) err(e.id, `${n}: ${role} "${id}" is not on the RSFC roster.`);
      else if (attending.size && !attending.has(id)) err(e.id, `${n}: ${role} did not attend this match day.`);
    }
    if (!e.scorerId) err(e.id, `${n}: choose the ${e.kind === "own_goal" ? "player who scored the own goal" : e.kind === "deflection" ? "shooter" : "scorer"}.`);
    if (e.assistId && e.assistId === e.scorerId) err(e.id, `${n}: a player cannot assist their own goal.`);
    if (e.secondAssistId && !e.assistId) err(e.id, `${n}: a second assist needs an assist.`);
    if (e.secondAssistId && (e.secondAssistId === e.scorerId || e.secondAssistId === e.assistId))
      err(e.id, `${n}: second assister must be a different player.`);

    const ruling = e.kind === "deflection" ? deflectionRulingOf(e, rules) : null;
    if (e.kind === "deflection") {
      if (ruling === "own_goal" && !e.deflectedById) err(e.id, `${n}: record who the shot deflected off.`);
      if (e.deflectedById && e.deflectedById === e.scorerId) err(e.id, `${n}: the shot can't deflect off the shooter.`);
    } else if (e.deflectedById) {
      warn(e.id, `${n}: "deflected off" is only used for deflections and will be ignored.`);
    }

    if ((e.kind === "own_goal" || ruling === "own_goal") && (e.assistId || e.secondAssistId))
      warn(e.id, `${n}: assists on an own goal earn nothing and will be ignored.`);
    if (e.kind === "free_kick" && (e.assistId || e.secondAssistId))
      warn(e.id, `${n}: direct free kicks have no assist; it will be ignored.`);
    if (e.secondAssistId && !rules.secondAssistEnabled)
      warn(e.id, `${n}: the second-assist rule is off, so this earns nothing.`);

    // Side sanity (warnings only).
    if (ctx.teamA && ctx.teamB && (e.side === "A" || e.side === "B")) {
      const own = e.kind === "own_goal";
      const t = e.scorerId ? teamOf(e.scorerId) : null;
      const expect = own ? other(e.side) : e.side;
      if (t && t !== "floater" && t !== expect)
        warn(e.id, `${n}: ${own ? "own-goal scorer" : "scorer"} was drawn on Team ${t}, but the goal is credited to Team ${e.side}${own ? " (an own goal should benefit the other team)" : ""}.`);
      if (e.assistId && !own) {
        const ta = teamOf(e.assistId);
        if (ta && ta !== "floater" && ta !== e.side) warn(e.id, `${n}: assister was drawn on the other team.`);
      }
      if (e.kind === "deflection" && e.deflectedById) {
        const td = teamOf(e.deflectedById);
        if (td && td !== "floater" && td === e.side) warn(e.id, `${n}: the deflecting player is on the scoring team.`);
      }
    }
  });
  return issues;
}
