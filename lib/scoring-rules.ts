/** Published S3V XI demo rules. Changes must produce a NEW version, not mutate historical results. */
export const SCORING_VERSION = "s3v-t20-v1";
export const S3V_T20_RULES = Object.freeze({
  version: SCORING_VERSION,
  runs: 1, fours: 1, sixes: 2,
  wicket: 25, maiden: 12, catch: 8, stumping: 12,
  directRunOut: 12, assistedRunOut: 6,
  milestone30: 4, milestone50: 8, milestone100: 16,
  duckPenalty: -2,
  captain: 2, viceCaptain: 1.5, tripleCaptain: 3,
  // These require delivery/over-level scorecard fidelity; disabled deliberately.
  economyBonusEnabled: false,
  strikeRateBonusEnabled: false,
  dotBallBonusEnabled: false,
});
