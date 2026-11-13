/**
 * RSFC club roster — the single source of truth for who exists in the league.
 *
 * To add, remove or rename a player, edit this file only. Every page, chart,
 * form and API validates against `ROSTER`. Ids are stable slugs: once a player
 * has played a match, do not change their id (match history refers to it).
 */

export type PlayerKind = "member" | "dropin";

/** Pick 7 positions. Every pickable player has exactly one. */
export type Position = "DEF" | "CM" | "CAM" | "ATT";
export type Stars = 1 | 2 | 3;

export interface Player {
  id: string;
  name: string;
  kind: PlayerKind;
  /** Pick 7 position. `null` = on the roster (match history, draws) but not pickable in Pick 7. */
  position: Position | null;
  /** Base star rating (1–3) for the Pick 7 budget. Ownership nudges it week to week. */
  stars: Stars;
}

export const CLUB = {
  name: "RSFC",
  leagueName: "RSFC League",
  tagline: "Your Club. Your Seven.",
  strapline: "Turn up. Get drawn. Get on the scoresheet.",
  /** Default on-pitch format; shrinks automatically when fewer players turn up. */
  defaultMaxPerSide: 8,
  /** Fewest players per side the draw will produce (3 → needs at least 6 attendees). */
  minPerSide: 3,
  /** How many players each selector picks per match day. */
  picksPerSelector: 7,
} as const;

// ---------------------------------------------------------------------------
// Pick 7 balance rules
// ---------------------------------------------------------------------------

/** Positions in display order. */
export const POSITIONS: readonly Position[] = ["DEF", "CM", "CAM", "ATT"];

export const POSITION_LABEL: Record<Position, { one: string; many: string }> = {
  DEF: { one: "Defender", many: "Defenders" },
  CM: { one: "CM", many: "CMs" },
  CAM: { one: "CAM", many: "CAMs" },
  ATT: { one: "Attacker", many: "Attackers" },
};

/** Exactly this many picks per position (must add up to picksPerSelector). */
export const FORMATION: Record<Position, number> = { DEF: 2, CM: 2, CAM: 1, ATT: 2 };

export const PICK7 = {
  /** Most stars a seven may total. With everyone at 2★ (14) there is no squeeze until ownership moves ratings. */
  starBudget: 14,
  /** After each draw, a player in MORE than this share of teams goes up a star for following weeks… */
  riseAbove: 0.6,
  /** …and one in FEWER than this share goes down a star. */
  fallBelow: 0.1,
  /** Ownership only re-rates players once at least this many sevens were locked (avoids noise early on). */
  minTeamsToRerate: 4,
} as const;

/**
 * Position and base stars for every player.
 *
 * STARS: everyone starts at 2★. Set real ratings here when the club agrees them
 * (roughly the top quarter 3★, the bottom quarter 1★), and consider lowering
 * PICK7.starBudget to 13 once some players are 1★.
 *
 * A player missing from this map stays on the roster but can't be picked in Pick 7.
 */
const PICK7_META: Record<string, { position: Position; stars?: Stars }> = {
  vineet: { position: "DEF" },
  jaskaran: { position: "DEF" },
  gurnaam: { position: "DEF" },
  archit: { position: "DEF" },
  danial: { position: "DEF" },
  tadas: { position: "CM" },
  jedi: { position: "CM" },
  raunak: { position: "CM" },
  sanjeev: { position: "CM" },
  navneet: { position: "CM" },
  savi: { position: "CM" },
  robin: { position: "CAM" },
  danish: { position: "CAM" },
  ghous: { position: "CAM" },
  abrar: { position: "CAM" },
  vikram: { position: "ATT" },
  karminder: { position: "ATT" },
  harpreet: { position: "ATT" },
  nakul: { position: "ATT" },
  inder: { position: "ATT" },
};

const MEMBER_NAMES = [
  "Navneet",
  "Archit",
  "Vikram",
  "Ghous",
  "Danish",
  "Danial",
  "Karminder",
  "Vineet",
  "Gurinder",
  "Raunak",
  "Sanjeev",
  "Jedi",
  "Tadas",
  "Jaskaran",
  "Gurnaam",
  "Harpreet",
  "Robin",
  "Nakul",
] as const;

const DROPIN_NAMES = ["Savi", "Abrar", "Inder"] as const;

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

const make = (name: string, kind: PlayerKind): Player => {
  const id = slug(name);
  const meta = PICK7_META[id];
  return { id, name, kind, position: meta?.position ?? null, stars: meta?.stars ?? 2 };
};

export const MEMBERS: readonly Player[] = MEMBER_NAMES.map((name) => make(name, "member"));

export const DROPINS: readonly Player[] = DROPIN_NAMES.map((name) => make(name, "dropin"));

export const ROSTER: readonly Player[] = [...MEMBERS, ...DROPINS];

const BY_ID = new Map(ROSTER.map((p) => [p.id, p]));

export function getPlayer(id: string): Player | undefined {
  return BY_ID.get(id);
}

export function playerName(id: string): string {
  return BY_ID.get(id)?.name ?? id;
}

export function isDropIn(id: string): boolean {
  return BY_ID.get(id)?.kind === "dropin";
}

/** Players who can be picked in Pick 7 (they have a position). */
export const PICKABLE: readonly Player[] = ROSTER.filter((p) => p.position !== null);
