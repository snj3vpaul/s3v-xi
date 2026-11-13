/**
 * RSFC club roster — the single source of truth for who exists in the league.
 *
 * To add, remove or rename a player, edit this file only. Every page, chart,
 * form and API validates against `ROSTER`. Ids are stable slugs: once a player
 * has played a match, do not change their id (match history refers to it).
 */

export type PlayerKind = "member" | "dropin";

export interface Player {
  id: string;
  name: string;
  kind: PlayerKind;
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

export const MEMBERS: readonly Player[] = MEMBER_NAMES.map((name) => ({
  id: slug(name),
  name,
  kind: "member" as const,
}));

export const DROPINS: readonly Player[] = DROPIN_NAMES.map((name) => ({
  id: slug(name),
  name,
  kind: "dropin" as const,
}));

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
