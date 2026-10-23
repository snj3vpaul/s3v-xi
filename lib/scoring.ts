import { S3V_T20_RULES } from "./scoring-rules";
export interface MatchFigures {
  playerId: string;
  runs: number;
  fours: number;
  sixes: number;
  wickets: number;
  maidens: number;
  catches: number;
  stumpings: number;
  directRunOuts: number;
  assistedRunOuts: number;
  dismissed: boolean;
  played: boolean;
}
export type PlayerRole = "WK" | "BAT" | "AR" | "BOWL" | null;
export type ScoringCategory = "Batting" | "Bowling" | "Fielding";
export interface BreakdownLine { key: string; category: ScoringCategory; description: string; count: number; rate: number; points: number }
export interface ScoreResult { total: number; batting: number; bowling: number; fielding: number; lines: BreakdownLine[] }
export const EMPTY_FIGURES: Omit<MatchFigures, "playerId"> = {
  runs: 0, fours: 0, sixes: 0, wickets: 0, maidens: 0, catches: 0, stumpings: 0,
  directRunOuts: 0, assistedRunOuts: 0, dismissed: false, played: true
};
export const NUMBER_FIELDS: Array<keyof Pick<MatchFigures, "runs"|"fours"|"sixes"|"wickets"|"maidens"|"catches"|"stumpings"|"directRunOuts"|"assistedRunOuts">> =
  ["runs", "fours", "sixes", "wickets", "maidens", "catches", "stumpings", "directRunOuts", "assistedRunOuts"];
export const FIELD_LABELS: Record<(typeof NUMBER_FIELDS)[number], string> = {
  runs: "Runs", fours: "Fours", sixes: "Sixes", wickets: "Bowling wickets", maidens: "Maiden overs", catches: "Catches (all types)", stumpings: "Stumpings", directRunOuts: "Direct run-outs", assistedRunOuts: "Assisted run-outs"
};

export function validateFigures(data: MatchFigures): string[] {
  const issues: string[] = [];
  if (typeof data.playerId !== "string" || !data.playerId.trim()) issues.push("A player is required.");
  if (typeof data.played !== "boolean" || typeof data.dismissed !== "boolean") issues.push("Played and dismissed must be true or false.");
  for (const field of NUMBER_FIELDS) if (!Number.isSafeInteger(data[field]) || data[field] < 0) issues.push(`${FIELD_LABELS[field]} must be a non-negative whole number.`);
  if (Number.isSafeInteger(data.runs) && Number.isSafeInteger(data.fours) && Number.isSafeInteger(data.sixes) && data.fours * 4 + data.sixes * 6 > data.runs)
    issues.push("Four and six runs cannot exceed the player's batting runs.");
  if (data.played === false && (NUMBER_FIELDS.some(field => data[field] > 0) || data.dismissed)) issues.push("A player with recorded statistics must be marked as having played.");
  return issues;
}

export function scoreMatchFigures(data: MatchFigures, role: PlayerRole): ScoreResult {
  const issues = validateFigures(data);
  if (issues.length) throw new Error(issues.join(" "));
  const lines: BreakdownLine[] = [];
  function add(key: string, category: ScoringCategory, description: string, count: number, rate: number) {
    if (count) lines.push({key, category, description, count, rate, points: count * rate});
  }
  if (data.played) {
    add("runs", "Batting", "Runs", data.runs, S3V_T20_RULES.runs);
    add("fours", "Batting", "Boundary fours bonus", data.fours, S3V_T20_RULES.fours);
    add("sixes", "Batting", "Boundary sixes bonus", data.sixes, S3V_T20_RULES.sixes);
    const milestone = data.runs >= 100 ? S3V_T20_RULES.milestone100 : data.runs >= 50 ? S3V_T20_RULES.milestone50 : data.runs >= 30 ? S3V_T20_RULES.milestone30 : 0;
    if (milestone) add("milestone", "Batting", `Highest run milestone (${data.runs >= 100 ? "100" : data.runs >= 50 ? "50" : "30"}+)`, 1, milestone);
    if (data.runs === 0 && data.dismissed && (role === "BAT" || role === "AR")) add("duck", "Batting", "Dismissed for a duck (confirmed batter / all-rounder)", 1, S3V_T20_RULES.duckPenalty);
    add("wickets", "Bowling", "Bowling wickets (not run-outs)", data.wickets, S3V_T20_RULES.wicket);
    add("maidens", "Bowling", "Maiden overs", data.maidens, S3V_T20_RULES.maiden);
    add("catches", "Fielding", "Catches (including caught behind / caught-and-bowled)", data.catches, S3V_T20_RULES.catch);
    add("stumpings", "Fielding", "Stumpings", data.stumpings, S3V_T20_RULES.stumping);
    add("directRunOuts", "Fielding", "Direct run-outs", data.directRunOuts, S3V_T20_RULES.directRunOut);
    add("assistedRunOuts", "Fielding", "Assisted run-outs", data.assistedRunOuts, S3V_T20_RULES.assistedRunOut);
  }
  const sum = (category: ScoringCategory) => lines.filter(item => item.category === category).reduce((n, item) => n + item.points, 0);
  const batting = sum("Batting"), bowling = sum("Bowling"), fielding = sum("Fielding");
  return {total: batting + bowling + fielding, batting, bowling, fielding, lines};
}

export function boostedPoints(base: number, position: "C" | "VC" | "STARTER" | "BENCH", chip: "none" | "skipper-x3" | "full-squad" = "none"): number {
  if (position === "BENCH") return chip === "full-squad" ? base : 0;
  const multiplier = position === "C" ? (chip === "skipper-x3" ? S3V_T20_RULES.tripleCaptain : S3V_T20_RULES.captain) : position === "VC" ? S3V_T20_RULES.viceCaptain : 1;
  return Math.round(base * multiplier * 10) / 10;
}
