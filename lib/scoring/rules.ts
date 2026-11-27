/**
 * RSFC League — scoring rules.
 *
 * THIS IS THE ONLY PLACE POINTS ARE DECIDED. Everything here is pure: no I/O,
 * no clock, no randomness. Pages, charts, the API and the tests all call these
 * functions, so a rule changed here changes everywhere at once.
 *
 * There are three rule sets, chosen per match (see rulesVersionOf):
 *
 * v3 — v2 WITH FPL-STYLE GOALS AND A DEFENSIVE BONUS, every match day on/after RULES_V3_FROM.
 *   Goal by the scorer's Pick 7 position:  DEF +6 · CM +5 · CAM +5 · ATT +4
 *   (a player with no Pick 7 position scores as an attacker). Everything else as v2.
 *   Defensive bonus — positive only: conceding a lot never costs anything.
 *   Defender (DEF), by goals their side conceded:  0 → +4 · 1–2 → +2 · 3–4 → +1 · 5+ → 0
 *   CM, by goals their side conceded:              0 → +2 · 1–2 → +1 · 3+ → 0
 *   Position is the player's Pick 7 position (config/club.ts). CAMs and attackers get none.
 *
 * v2 — SIMPLIFIED, every match day on/after RULES_V2_FROM:
 *
 *   Goal (primary scorer)              +3
 *   Assist (last pass, max one)        +2   — never on penalties or direct free kicks
 *   Own goal                           −2
 *   Man of the Match                   +4   — exactly one per team
 *   Fair play                          +1   — everyone who played, unless the scorekeeper
 *                                             records a breach: a foul conceded, a card or
 *                                             sin-bin, a dissent warning, or a dangerous challenge
 *   No second assists, no deflection rulings.
 *
 * v1 — ORIGINAL, kept so matches played under it never change:
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

import { getPlayer, type Position } from "@/config/club";
import type {
  AssistStyle,
  Chip,
  DeflectionRuling,
  DrawResult,
  FairPlayBreach,
  FairPlayLoss,
  GoalEvent,
  GoalKind,
  GoalStyle,
  MatchDay,
  RotationLapse,
  RotationMiss,
  RulesVersion,
  Side,
} from "@/lib/league/types";

// ---------------------------------------------------------------------------
// Point values & rule switches
// ---------------------------------------------------------------------------

/** Original rules (matches before RULES_V2_FROM). */
export const POINTS_V1 = {
  goal: 5,
  assist: 3,
  ownGoal: -2,
  secondAssist: 1,
} as const;

/** Simplified rules (current). */
export const POINTS_V2 = {
  goal: 3,
  assist: 2,
  ownGoal: -2,
  motm: 4,
  fairPlay: 1,
  /** Each player on the winning side. */
  win: 3,
  /** The floater (half a game each side) when there's a winner. */
  floaterWin: 2,
  /** Skipped a goalkeeper or sub stint. */
  rotationMiss: -2,
} as const;

/** The current point values, for pages that show "the rules". */
export const POINTS = POINTS_V2;

/**
 * v3 defensive bonus by position: [most goals conceded, points] bands, checked in
 * order. Positive only — a side that concedes more than the last band gets 0, never less.
 */
export const DEFENCE_BONUS: Partial<Record<Position, readonly (readonly [number, number])[]>> = {
  DEF: [[0, 4], [2, 2], [4, 1]],
  CM: [[0, 2], [2, 1]],
};

/** v3 goal points by the scorer's Pick 7 position (FPL-style: DEF 6 · MID 5 · FWD 4). */
export const GOAL_BY_POSITION: Record<Position, number> = { DEF: 6, CM: 5, CAM: 5, ATT: 4 };

/** "DEF +6 · CM/CAM +5 · ATT +4", for pages that show the rules. */
export const GOAL_LABEL = `DEF +${GOAL_BY_POSITION.DEF} · CM/CAM +${GOAL_BY_POSITION.CM} · ATT +${GOAL_BY_POSITION.ATT}`;

/** Points for one goal by `playerId` under rule set `version`. */
export function goalPoints(playerId: string, version: RulesVersion): number {
  if (version >= 3) return GOAL_BY_POSITION[getPlayer(playerId)?.position ?? "ATT"];
  return version === 2 ? POINTS_V2.goal : POINTS_V1.goal;
}

/** Defensive bonus for a player of `position` whose side conceded `conceded`. Never negative. */
export function defenceBonus(position: Position | null | undefined, conceded: number): number {
  const bands = position ? DEFENCE_BONUS[position] : undefined;
  if (!bands) return 0;
  for (const [max, pts] of bands) if (conceded <= max) return pts;
  return 0;
}

/** First match day (club-local date) scored under v2. Earlier match days keep v1. */
export const RULES_V2_FROM = "2026-11-19";
/** First match day scored under v3 (v2 + defensive bonus). */
export const RULES_V3_FROM = "2026-11-26";

/** Which rule set a match uses: pinned on the match, otherwise by date. Undated (tests) → v1. */
export function rulesVersionOf(m: { date?: string; rulesVersion?: RulesVersion }): RulesVersion {
  if (m.rulesVersion) return m.rulesVersion;
  if (!m.date) return 1;
  return m.date >= RULES_V3_FROM ? 3 : m.date >= RULES_V2_FROM ? 2 : 1;
}

/** v2 and later share the simplified point values, MOTM, fair play, win and rotation. */
export const isV2Plus = (v: RulesVersion) => v >= 2;

export const FAIR_PLAY_BREACHES: readonly FairPlayBreach[] = ["foul", "card", "dissent", "dangerous"];

export const FAIR_PLAY_LABEL: Record<FairPlayBreach, { short: string; long: string }> = {
  foul: { short: "Foul", long: "Conceded a foul: play was stopped and a free kick or penalty given against them" },
  card: { short: "Card", long: "Shown a card or sent to the sin-bin" },
  dissent: { short: "Dissent", long: "Formally warned for arguing with the ref, scorekeeper or an opponent" },
  dangerous: { short: "Dangerous", long: "Called for a dangerous challenge: slide tackle, high foot, or contact from behind" },
};

export const ROTATION_LAPSES: readonly RotationLapse[] = ["gk", "sub"];
export const ROTATION_LABEL: Record<RotationLapse, string> = { gk: "Skipped GK turn", sub: "Skipped sub turn" };

/** Labels for every kind of point, in breakdown order. */
export const POINT_KIND_LABEL: Record<ContributionKind, { icon: string; label: string }> = {
  goal: { icon: "⚽", label: "Goals" },
  assist: { icon: "🅰️", label: "Assists" },
  second_assist: { icon: "🅰️", label: "Pre-assists" },
  own_goal: { icon: "🙈", label: "Own goals" },
  motm: { icon: "⭐", label: "Man of the Match" },
  win: { icon: "🏆", label: "Wins" },
  fair_play: { icon: "🤝", label: "Fair play" },
  rotation: { icon: "🔄", label: "Missed rotation" },
  defence: { icon: "🧱", label: "Defensive bonus" },
  captain: { icon: "©", label: "Captain bonus" },
};

/** Goal types the v2 scorecard offers (v1 also had header and deflection). */
export const GOAL_KINDS_V2: readonly GoalKind[] = ["open_play", "penalty", "free_kick", "own_goal"];

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
// Goal / assist style tags (descriptive only — they never change points)
// ---------------------------------------------------------------------------

export const GOAL_STYLE_LABEL: Record<GoalStyle, string> = {
  tap_in: "Tap-in",
  inside_box: "Inside the box",
  outside_d: "Outside the D",
  header: "Header",
  volley: "Volley",
  chip: "Chip / lob",
  solo: "Solo run",
  rebound: "Rebound",
  corner: "Straight from a corner",
  counter: "Counter-attack",
};
export const GOAL_STYLES = Object.keys(GOAL_STYLE_LABEL) as GoalStyle[];

export const ASSIST_STYLE_LABEL: Record<AssistStyle, string> = {
  through_ball: "Through ball",
  cross: "Cross",
  cutback: "Cut-back",
  short_pass: "Short pass",
  long_ball: "Long ball",
  header: "Headed on",
  corner: "Corner",
  throw_in: "Throw-in",
  backheel: "Backheel",
  rebound: "Shot saved / rebound",
};
export const ASSIST_STYLES = Object.keys(ASSIST_STYLE_LABEL) as AssistStyle[];

/** Can this event carry a goal style? (Own goals, penalties and free kicks already say how.) */
export function takesGoalStyle(kind: GoalKind): boolean {
  return kind === "open_play" || kind === "header" || kind === "deflection";
}

/**
 * Keep only known style tags, and drop ones that don't apply (no goal style on
 * own goals / set pieces, no assist style without an assist). Never touches scoring fields.
 */
export function cleanStyles<E extends GoalEvent>(e: E): E {
  const out = { ...e };
  const style = e.style && (GOAL_STYLES as string[]).includes(e.style) && takesGoalStyle(e.kind) ? e.style : null;
  const assistStyle = e.assistStyle && (ASSIST_STYLES as string[]).includes(e.assistStyle) && e.assistId ? e.assistStyle : null;
  if (style) out.style = style; else delete out.style;
  if (assistStyle) out.assistStyle = assistStyle; else delete out.assistStyle;
  return out;
}

// ---------------------------------------------------------------------------
// Single event → contributions
// ---------------------------------------------------------------------------

export type ContributionKind =
  | "goal"
  | "assist"
  | "second_assist"
  | "own_goal"
  | "motm"
  | "fair_play"
  | "win"
  | "rotation"
  | "defence"
  | "captain";

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
export function scoreEvent(e: GoalEvent, rules: ScoringRules = DEFAULT_RULES, version: RulesVersion = 1): EventScore {
  if (version >= 2) return scoreEventV2(e, rules, version);
  const POINTS = POINTS_V1;
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

/** v2: goal +3, assist +2 (not on penalties / free kicks), own goal −2. v3: goal by position. */
function scoreEventV2(e: GoalEvent, rules: ScoringRules, version: RulesVersion): EventScore {
  const out: Contribution[] = [];
  const ignored: string[] = [];
  const add = (playerId: string, kind: ContributionKind, points: number) => out.push({ playerId, kind, points, eventId: e.id });
  if (e.secondAssistId) ignored.push("Second assists aren't scored any more.");

  // Legacy deflection entries still honour their ruling, at v2 values.
  const isOwnGoal = e.kind === "own_goal" || (e.kind === "deflection" && deflectionRulingOf(e, rules) === "own_goal");
  if (isOwnGoal) {
    const by = e.kind === "own_goal" ? e.scorerId : (e.deflectedById ?? null);
    if (by) add(by, "own_goal", POINTS_V2.ownGoal);
    if (e.assistId) ignored.push("Assists on an own goal earn nothing.");
    return { contributions: out, ignored };
  }
  add(e.scorerId, "goal", goalPoints(e.scorerId, version));
  if (!e.assistId) return { contributions: out, ignored };
  if (e.kind === "penalty" || e.kind === "free_kick") ignored.push("Penalties and direct free kicks have no assist.");
  else if (e.assistId === e.scorerId) ignored.push("A player cannot assist their own goal.");
  else add(e.assistId, "assist", POINTS_V2.assist);
  return { contributions: out, ignored };
}

// ---------------------------------------------------------------------------
// Match → per-player lines
// ---------------------------------------------------------------------------

/** What scoring needs from a match. `date`/`rulesVersion` pick the rule set; v2 also reads MOTM, conduct and the draw. */
export type ScorableMatch = Pick<MatchDay, "events" | "attendees"> &
  Partial<Pick<MatchDay, "date" | "rulesVersion" | "motm" | "fairPlayLost" | "rotationMissed" | "noResult">> & {
    /** Needed for the v2 win bonus (who was on which side). */
    draw?: Pick<DrawResult, "teamA" | "teamB" | "floater"> | null;
  };

export interface PlayerMatchLine {
  playerId: string;
  goals: number;
  assists: number;
  secondAssists: number;
  ownGoals: number;
  /** v2: Man of the Match awards (0/1 per match). */
  motm: number;
  /** v2: fair-play points kept (0/1 per match). */
  fairPlay: number;
  /** v2: on the winning side (0/1 per match). */
  wins: number;
  /** v2: rotation stints missed (0/1 per match). */
  rotationMissed: number;
  /** v3: defensive bonus points (defenders and CMs; never negative). */
  defence: number;
  points: number;
}

export function emptyLine(playerId: string): PlayerMatchLine {
  return { playerId, goals: 0, assists: 0, secondAssists: 0, ownGoals: 0, motm: 0, fairPlay: 0, wins: 0, rotationMissed: 0, defence: 0, points: 0 };
}

/** One line of a player's points breakdown — every point a player earns comes from exactly one of these. */
export interface PointItem {
  kind: ContributionKind;
  points: number;
  /** Short human explanation, e.g. "White won 4–3" or "Skipped GK turn". */
  detail: string;
  /** The scorecard entry it came from (goals, assists, own goals). */
  eventId?: string;
}

/** Which side won on the scoreboard, or null for a draw / no result. */
export function winnerOf(match: Pick<ScorableMatch, "events" | "noResult">): Side | null {
  if (match.noResult) return null;
  const s = scoreline(match.events);
  return s.A === s.B ? null : s.A > s.B ? "A" : "B";
}

const SIDE_NAME: Record<Side, string> = { A: "White", B: "Red" };

/**
 * Every point in one match, itemised per player. scoreMatch() totals these, so
 * the breakdown users see is, by construction, exactly what they were scored.
 * Every attendee gets an entry (possibly empty) so "played, 0" ≠ "didn't play".
 */
export function matchItems(match: ScorableMatch, rules: ScoringRules = DEFAULT_RULES): Map<string, PointItem[]> {
  const version = rulesVersionOf(match);
  const items = new Map<string, PointItem[]>();
  const push = (id: string, item: PointItem) => {
    const list = items.get(id);
    if (list) list.push(item);
    else items.set(id, [item]);
  };
  for (const id of match.attendees) items.set(id, []);

  match.events.forEach((e, i) => {
    const n = `Goal ${i + 1}`;
    for (const c of scoreEvent(e, rules, version).contributions) {
      const detail =
        c.kind === "goal" ? `${n}${e.kind === "penalty" ? " (pen)" : e.kind === "free_kick" ? " (free kick)" : ""}`
        : c.kind === "own_goal" ? `${n}, own goal`
        : c.kind === "assist" ? `${n}, assist`
        : `${n}, pre-assist`;
      push(c.playerId, { kind: c.kind, points: c.points, detail, eventId: e.id });
    }
  });
  if (!isV2Plus(version)) return items;

  for (const side of ["A", "B"] as Side[]) {
    const id = match.motm?.[side];
    if (id) push(id, { kind: "motm", points: POINTS_V2.motm, detail: `Man of the Match (${SIDE_NAME[side]})` });
  }

  const win = winnerOf(match);
  if (win && match.draw) {
    const s = scoreline(match.events);
    const score = `${SIDE_NAME[win]} won ${Math.max(s.A, s.B)}–${Math.min(s.A, s.B)}`;
    const team = win === "A" ? match.draw.teamA : match.draw.teamB;
    for (const id of match.attendees) {
      if (team.includes(id)) push(id, { kind: "win", points: POINTS_V2.win, detail: score });
      else if (match.draw.floater === id) push(id, { kind: "win", points: POINTS_V2.floaterWin, detail: `${score} (floater, half a game each side)` });
    }
  }

  const lostFair = new Map((match.fairPlayLost ?? []).map((f) => [f.playerId, f.reason]));
  const missed = new Map((match.rotationMissed ?? []).map((r) => [r.playerId, r.reason]));
  for (const id of match.attendees) {
    if (!lostFair.has(id)) push(id, { kind: "fair_play", points: POINTS_V2.fairPlay, detail: "Fair play" });
    const r = missed.get(id);
    if (r) push(id, { kind: "rotation", points: POINTS_V2.rotationMiss, detail: ROTATION_LABEL[r] });
  }

  // v3: defensive bonus for defenders and CMs, by goals their side conceded. Positive only.
  if (version >= 3 && match.draw) {
    const s = scoreline(match.events);
    for (const id of match.attendees) {
      const pos = getPlayer(id)?.position;
      // Floater (half a game each side): the worse of the two sides' records.
      const conceded = match.draw.teamA.includes(id) ? s.B : match.draw.teamB.includes(id) ? s.A : match.draw.floater === id ? Math.max(s.A, s.B) : null;
      if (conceded === null) continue;
      const pts = defenceBonus(pos, conceded);
      if (pts > 0)
        push(id, {
          kind: "defence",
          points: pts,
          detail: `${pos === "DEF" ? "Defender" : "CM"}: ${conceded === 0 ? "clean sheet" : `side conceded ${conceded}`}`,
        });
    }
  }
  return items;
}

/**
 * Per-player lines for one match: the totals of matchItems(). Every attendee
 * gets a line (0 if they didn't score) so "played, no points" is
 * distinguishable from "didn't play".
 */
export function scoreMatch(match: ScorableMatch, rules: ScoringRules = DEFAULT_RULES): Map<string, PlayerMatchLine> {
  const lines = new Map<string, PlayerMatchLine>();
  for (const [id, list] of matchItems(match, rules)) {
    const l = emptyLine(id);
    for (const it of list) {
      l.points += it.points;
      if (it.kind === "goal") l.goals += 1;
      else if (it.kind === "assist") l.assists += 1;
      else if (it.kind === "second_assist") l.secondAssists += 1;
      else if (it.kind === "own_goal") l.ownGoals += 1;
      else if (it.kind === "motm") l.motm += 1;
      else if (it.kind === "fair_play") l.fairPlay += 1;
      else if (it.kind === "win") l.wins += 1;
      else if (it.kind === "rotation") l.rotationMissed += 1;
      else if (it.kind === "defence") l.defence += it.points;
    }
    lines.set(id, l);
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
      r.motm += l.motm;
      r.fairPlay += l.fairPlay;
      r.wins += l.wins;
      r.rotationMissed += l.rotationMissed;
      r.defence += l.defence;
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
 * A selector picks 7 players (plus one bench player) before kick-off. After
 * the match, the selector earns exactly the points those players earned in
 * that match — whichever team they landed on. A pick who didn't play earns 0.
 * A "hit" is a counted pick who recorded at least one goal or credited assist
 * (own goals are not hits).
 *
 *   Captain        their whole match line counts ×2 (×3 with Triple Captain).
 *   Vice-captain   takes the armband (same multiplier) if the captain didn't play.
 *   Bench          one player outside the seven. Their points count if any
 *                  starter didn't play (auto-sub), or always with Bench Boost.
 *                  The bench player never takes the armband.
 */
export interface PickResult {
  playerId: string;
  /** What the selector banks from this pick (0 for an unused bench player). */
  points: number;
  /** The player's own match points before any armband multiplier. */
  base: number;
  hit: boolean;
  played: boolean;
  /** Wore the armband that counted (captain, or vice-captain standing in). */
  captain: boolean;
  /** 1, 2 (captain) or 3 (Triple Captain). */
  multiplier: number;
  role: "starter" | "bench";
  /** Bench only: did their points count? */
  counted: boolean;
}

export interface SelectionResult {
  selectorId: string;
  matchId: string;
  /** The seven starters. */
  picks: string[];
  points: number;
  hits: number;
  /** Starters who actually played. */
  picksPlayed: number;
  /** The captain as picked (null if none). */
  captain: string | null;
  viceCaptain: string | null;
  /** Who actually wore the armband (captain, vice if the captain didn't play, or null). */
  armband: string | null;
  bench: string | null;
  /** True when the bench player's points counted. */
  benchUsed: boolean;
  chip: Chip | null;
  /** Starters first, then the bench player (if any). */
  perPick: PickResult[];
}

/** Pick 7 captain: their match points count this many times. */
export const CAPTAIN_MULTIPLIER = 2;
/** Triple Captain chip: the armband's multiplier that week. */
export const TRIPLE_CAPTAIN_MULTIPLIER = 3;

export interface SelectionInput {
  selectorId: string;
  picks: string[];
  captain?: string | null;
  viceCaptain?: string | null;
  bench?: string | null;
  chip?: Chip | null;
}

export function scoreSelection(
  selection: SelectionInput,
  match: ScorableMatch & Pick<MatchDay, "id">,
  rules: ScoringRules = DEFAULT_RULES,
  lines: Map<string, PlayerMatchLine> = scoreMatch(match, rules),
): SelectionResult {
  const picks = [...new Set(selection.picks)];
  const played = (id: string) => match.attendees.includes(id);
  const chip = selection.chip ?? null;
  const captain = selection.captain && picks.includes(selection.captain) ? selection.captain : null;
  const vice = selection.viceCaptain && picks.includes(selection.viceCaptain) && selection.viceCaptain !== captain ? selection.viceCaptain : null;
  const bench = selection.bench && !picks.includes(selection.bench) ? selection.bench : null;
  // The armband: the captain if they played; otherwise the vice-captain if they played.
  const armband = captain && played(captain) ? captain : vice && played(vice) ? vice : null;
  const mult = chip === "triple_captain" ? TRIPLE_CAPTAIN_MULTIPLIER : CAPTAIN_MULTIPLIER;
  const anyMissing = picks.some((id) => !played(id));
  const benchUsed = !!bench && (chip === "bench_boost" || (anyMissing && played(bench)));

  const line = (id: string, role: "starter" | "bench"): PickResult => {
    const l = lines.get(id);
    const base = l?.points ?? 0;
    const counted = role === "starter" || benchUsed;
    const isArm = role === "starter" && id === armband;
    const multiplier = isArm ? mult : 1;
    return {
      playerId: id,
      base,
      points: counted ? base * multiplier : 0,
      hit: counted && !!l && l.goals + l.assists + l.secondAssists > 0,
      played: played(id),
      captain: isArm,
      multiplier,
      role,
      counted,
    };
  };
  const perPick = [...picks.map((id) => line(id, "starter")), ...(bench ? [line(bench, "bench")] : [])];
  return {
    selectorId: selection.selectorId,
    matchId: match.id,
    picks,
    captain,
    viceCaptain: vice,
    armband,
    bench,
    benchUsed,
    chip,
    points: perPick.reduce((s, p) => s + p.points, 0),
    hits: perPick.filter((p) => p.hit).length,
    picksPlayed: perPick.filter((p) => p.role === "starter" && p.played).length,
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
export function validateScorecard(
  events: GoalEvent[],
  ctx: MatchContext,
  rules: ScoringRules = DEFAULT_RULES,
  version: RulesVersion = 1,
): ValidationIssue[] {
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
    if (version >= 2) {
      if (e.kind === "deflection") err(e.id, `${n}: deflections aren't recorded any more. Pick goal or own goal.`);
      if (e.secondAssistId) warn(e.id, `${n}: second assists aren't scored any more; it will be ignored.`);
      if (e.kind === "penalty" && e.assistId) warn(e.id, `${n}: penalties have no assist; it will be ignored.`);
    }

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
    if (version === 1 && e.secondAssistId && !rules.secondAssistEnabled)
      warn(e.id, `${n}: the second-assist rule is off, so this earns nothing.`);

    // Side sanity (warnings only).
    if (ctx.teamA && ctx.teamB && (e.side === "A" || e.side === "B")) {
      const own = e.kind === "own_goal";
      const t = e.scorerId ? teamOf(e.scorerId) : null;
      const expect = own ? other(e.side) : e.side;
      if (t && t !== "floater" && t !== expect)
        warn(e.id, `${n}: ${own ? "own-goal scorer" : "scorer"} is on Team ${t}, but the goal is credited to Team ${e.side}${own ? " (an own goal should benefit the other team)" : ""}.`);
      if (e.assistId && !own) {
        const ta = teamOf(e.assistId);
        if (ta && ta !== "floater" && ta !== e.side) warn(e.id, `${n}: assister is on the other team.`);
      }
      if (e.kind === "deflection" && e.deflectedById) {
        const td = teamOf(e.deflectedById);
        if (td && td !== "floater" && td === e.side) warn(e.id, `${n}: the deflecting player is on the scoring team.`);
      }
    }
  });
  return issues;
}

/**
 * v2 Man of the Match and fair-play entries. MOTM is required for both teams
 * and must be someone drawn on that team (or the floater). Fair-play breaches
 * must name players who attended, once each, with a listed reason.
 */
export function validateAwards(
  input: {
    motm?: Partial<Record<Side, string | null>> | null;
    fairPlayLost?: FairPlayLoss[] | null;
    rotationMissed?: RotationMiss[] | null;
    rotationChecked?: boolean;
  },
  ctx: MatchContext,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (message: string) => issues.push({ level: "error", message });
  const names: Record<Side, string> = { A: "White", B: "Red" };
  for (const side of ["A", "B"] as Side[]) {
    const id = input.motm?.[side];
    if (!id) {
      err(`Choose Man of the Match for ${names[side]}.`);
      continue;
    }
    const team = side === "A" ? ctx.teamA : ctx.teamB;
    if (!ctx.knownPlayers.has(id)) err(`${names[side]} MOTM "${id}" is not on the RSFC roster.`);
    else if (team && !team.includes(id) && ctx.floater !== id) err(`${names[side]} MOTM must be someone who played for ${names[side]}.`);
  }
  const seen = new Set<string>();
  for (const f of input.fairPlayLost ?? []) {
    if (!FAIR_PLAY_BREACHES.includes(f.reason)) err(`Unknown fair-play reason "${f.reason}".`);
    if (!ctx.attendees.includes(f.playerId)) err(`Fair play: "${f.playerId}" didn't attend this match day.`);
    if (seen.has(f.playerId)) err("Fair play: list each player once.");
    seen.add(f.playerId);
  }
  const seenRot = new Set<string>();
  for (const r of input.rotationMissed ?? []) {
    if (!ROTATION_LAPSES.includes(r.reason)) err(`Unknown rotation reason "${r.reason}".`);
    if (!ctx.attendees.includes(r.playerId)) err(`Rotation: "${r.playerId}" didn't attend this match day.`);
    if (seenRot.has(r.playerId)) err("Rotation: list each player once.");
    seenRot.add(r.playerId);
  }
  if (!input.rotationChecked) err("Confirm you've checked who went in goal and who subbed.");
  return issues;
}
