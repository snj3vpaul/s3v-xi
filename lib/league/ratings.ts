/**
 * FIFA-style player ratings: a 29-skill matrix per player, six face stats and an OVR.
 *
 * Purely cosmetic: nothing here touches scoring or Pick 7 stars.
 *
 * Every number is generated from the player id with a seeded PRNG, so a player's card
 * never changes between renders or deploys, and new roster players get a card
 * automatically. Change RATINGS_SEED to re-roll the whole squad. To pin a value by hand,
 * add it to OVERRIDES (it replaces the generated skill before face stats and OVR are worked out).
 */
import { ROSTER, type Player, type Position } from "@/config/club";
import { mulberry32 } from "@/lib/random";

export const RATINGS_SEED = "rsfc-2026";

export type FaceStat = "PAC" | "SHO" | "PAS" | "DRI" | "DEF" | "PHY";
export const FACE_STATS: readonly FaceStat[] = ["PAC", "SHO", "PAS", "DRI", "DEF", "PHY"];

export const FACE_LABEL: Record<FaceStat, string> = {
  PAC: "Pace",
  SHO: "Shooting",
  PAS: "Passing",
  DRI: "Dribbling",
  DEF: "Defending",
  PHY: "Physical",
};

/** The 29 outfield skills, grouped under the face stat they feed. */
export const SKILLS = {
  PAC: ["Acceleration", "Sprint speed"],
  SHO: ["Positioning", "Finishing", "Shot power", "Long shots", "Volleys", "Penalties"],
  PAS: ["Vision", "Crossing", "Free kicks", "Short passing", "Long passing", "Curve"],
  DRI: ["Agility", "Balance", "Reactions", "Ball control", "Dribbling", "Composure"],
  DEF: ["Interceptions", "Heading", "Awareness", "Standing tackle", "Sliding tackle"],
  PHY: ["Jumping", "Stamina", "Strength", "Aggression"],
} as const satisfies Record<FaceStat, readonly string[]>;

export type Skill = (typeof SKILLS)[FaceStat][number];
export const ALL_SKILLS: readonly Skill[] = FACE_STATS.flatMap((g) => SKILLS[g]);

type Weights = Partial<Record<Skill, number>>;

/** Face-stat weights, close to EA's published formulas. */
const FACE_WEIGHTS: Record<FaceStat, Weights> = {
  PAC: { Acceleration: 0.45, "Sprint speed": 0.55 },
  SHO: { Positioning: 0.05, Finishing: 0.45, "Shot power": 0.2, "Long shots": 0.2, Volleys: 0.05, Penalties: 0.05 },
  PAS: { Vision: 0.2, Crossing: 0.2, "Free kicks": 0.05, "Short passing": 0.35, "Long passing": 0.15, Curve: 0.05 },
  DRI: { Agility: 0.1, Balance: 0.05, Reactions: 0.05, "Ball control": 0.35, Dribbling: 0.4, Composure: 0.05 },
  DEF: { Interceptions: 0.2, Heading: 0.1, Awareness: 0.3, "Standing tackle": 0.3, "Sliding tackle": 0.1 },
  PHY: { Jumping: 0.05, Stamina: 0.25, Strength: 0.5, Aggression: 0.2 },
};

/** OVR weights by position (CB / CM / CAM / ST templates). */
const OVR_WEIGHTS: Record<Position, Weights> = {
  DEF: {
    Awareness: 0.17, "Standing tackle": 0.17, "Sliding tackle": 0.13, Interceptions: 0.13, Heading: 0.1,
    Strength: 0.1, Aggression: 0.07, "Short passing": 0.05, Reactions: 0.05, "Ball control": 0.03,
  },
  CM: {
    "Short passing": 0.17, "Long passing": 0.13, Vision: 0.13, "Ball control": 0.14, Reactions: 0.08, Dribbling: 0.07,
    Interceptions: 0.05, Stamina: 0.06, "Long shots": 0.04, "Standing tackle": 0.05, Awareness: 0.05, Composure: 0.03,
  },
  CAM: {
    "Short passing": 0.16, Vision: 0.14, "Ball control": 0.15, Dribbling: 0.13, Reactions: 0.07, Agility: 0.03,
    Finishing: 0.07, "Long shots": 0.05, Positioning: 0.09, Acceleration: 0.04, "Shot power": 0.04, Composure: 0.03,
  },
  ATT: {
    Finishing: 0.18, Positioning: 0.13, Heading: 0.1, "Ball control": 0.1, "Shot power": 0.1, Reactions: 0.08,
    Dribbling: 0.07, "Sprint speed": 0.05, Acceleration: 0.04, Strength: 0.05, Volleys: 0.02, "Long shots": 0.03, Composure: 0.05,
  },
};

/** How each position leans, group by group, from the player's base level. */
const POSITION_TILT: Record<Position, Record<FaceStat, number>> = {
  DEF: { PAC: -2, SHO: -14, PAS: -5, DRI: -6, DEF: 8, PHY: 5 },
  CM: { PAC: -1, SHO: -5, PAS: 6, DRI: 2, DEF: -2, PHY: 2 },
  CAM: { PAC: 2, SHO: 2, PAS: 6, DRI: 7, DEF: -18, PHY: -5 },
  ATT: { PAC: 5, SHO: 7, PAS: -3, DRI: 4, DEF: -24, PHY: 1 },
};

/** A random playing style on top of the position, so two CMs don't look alike. */
export const STYLES = {
  Speedster: { PAC: 8, PHY: -3 },
  Engine: { PHY: 5, DEF: 3 },
  Playmaker: { PAS: 6, DRI: 2 },
  Enforcer: { PHY: 7, DEF: 4, DRI: -4 },
  Technician: { DRI: 6, PAC: -2 },
  Sniper: { SHO: 7, PAS: -2 },
  Wall: { DEF: 6, PAC: -4 },
  Workhorse: { PHY: 4, PAS: 2 },
} as const satisfies Record<string, Partial<Record<FaceStat, number>>>;
export type Style = keyof typeof STYLES;

const TRAITS = [
  "Finesse shot", "Power header", "Long passer", "Flair", "Leadership", "Dives into tackles", "Early crosser",
  "Speed dribbler", "Long shot taker", "Team player", "Solid player", "Technical dribbler", "Chip shot",
  "Outside foot shot", "Engine", "Whipped cross",
] as const;

const SKILL_MOVES_MEAN: Record<Position, number> = { DEF: 2, CM: 2.6, CAM: 3.4, ATT: 3.1 };
const WORK = ["Low", "Med", "High"] as const;

/** Hand-set skills, by player id. e.g. `inder: { Finishing: 82 }` */
export const OVERRIDES: Record<string, Partial<Record<Skill, number>>> = {};

export interface PlayerRating {
  id: string;
  name: string;
  /** The position the card is built for (unpositioned players are rated as CMs). */
  position: Position;
  ovr: number;
  face: Record<FaceStat, number>;
  skills: Record<Skill, number>;
  style: Style;
  skillMoves: number;
  weakFoot: number;
  foot: "Right" | "Left";
  workRate: { att: (typeof WORK)[number]; def: (typeof WORK)[number] };
  traits: string[];
}

/** FNV-1a: a stable 32-bit seed from a string. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

const clampSkill = (x: number) => Math.max(25, Math.min(94, Math.round(x)));

function weighted(skills: Record<Skill, number>, w: Weights): number {
  let sum = 0;
  let total = 0;
  for (const [k, v] of Object.entries(w) as [Skill, number][]) {
    sum += skills[k] * v;
    total += v;
  }
  return Math.round(sum / total);
}

export function rate(player: Pick<Player, "id" | "name" | "position">, seed = RATINGS_SEED): PlayerRating {
  const rand = mulberry32(hash(`${seed}:${player.id}`));
  const gauss = (mean: number, sd: number) => {
    const u = 1 - rand();
    const v = rand();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];

  const position: Position = player.position ?? "CM";
  const base = gauss(66, 5); // local-league level, roughly 56–76
  const style = pick(Object.keys(STYLES) as Style[]);
  const skew: Partial<Record<FaceStat, number>> = STYLES[style];

  const skills = {} as Record<Skill, number>;
  for (const g of FACE_STATS) {
    const groupLevel = base + POSITION_TILT[position][g] + (skew[g] ?? 0) + gauss(0, 3);
    for (const s of SKILLS[g]) skills[s] = clampSkill(groupLevel + gauss(0, 4.5));
  }
  Object.assign(skills, OVERRIDES[player.id]);

  const face = Object.fromEntries(FACE_STATS.map((g) => [g, weighted(skills, FACE_WEIGHTS[g])])) as Record<FaceStat, number>;

  const wfRoll = rand();
  const traitPool = [...TRAITS];
  const traits: string[] = [];
  for (let n = 1 + Math.floor(rand() * 3); n > 0; n--) traits.push(traitPool.splice(Math.floor(rand() * traitPool.length), 1)[0]);

  return {
    id: player.id,
    name: player.name,
    position,
    ovr: weighted(skills, OVR_WEIGHTS[position]),
    face,
    skills,
    style,
    skillMoves: Math.max(1, Math.min(5, Math.round(gauss(SKILL_MOVES_MEAN[position], 0.8)))),
    weakFoot: wfRoll < 0.05 ? 1 : wfRoll < 0.3 ? 2 : wfRoll < 0.7 ? 3 : wfRoll < 0.92 ? 4 : 5,
    foot: rand() < 0.22 ? "Left" : "Right",
    workRate: { att: pick(WORK), def: pick(WORK) },
    traits,
  };
}

/** Card tier, FIFA-style: gold 75+, silver 65–74, bronze below. */
export function tier(ovr: number): "gold" | "silver" | "bronze" {
  return ovr >= 75 ? "gold" : ovr >= 65 ? "silver" : "bronze";
}

/** Every roster player's card, best first (ties by name). */
export const SQUAD_RATINGS: readonly PlayerRating[] = ROSTER.map((p) => rate(p)).sort(
  (a, b) => b.ovr - a.ovr || a.name.localeCompare(b.name),
);

const BY_ID = new Map(SQUAD_RATINGS.map((r) => [r.id, r]));
export const ratingFor = (id: string) => BY_ID.get(id);
