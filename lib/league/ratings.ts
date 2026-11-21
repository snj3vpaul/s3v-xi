/**
 * FIFA-style player ratings: a 29-skill matrix per player, six face stats and an OVR.
 *
 * Purely cosmetic: nothing here touches scoring or Pick 7 stars.
 *
 * Every number is generated from the player id with a seeded PRNG, so a player's card
 * never changes between renders or deploys, and new roster players get a card
 * automatically. Change RATINGS_SEED to re-roll the whole squad.
 *
 * PROFILES carries what the club knows about a player (level, style, strengths, traits); the
 * dice only fill in the detail around it. To pin a single skill, use a profile's `skills`.
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
  "Outside foot shot", "Engine", "Whipped cross", "Box to box", "Clinical finisher", "Ball winner",
] as const;

const SIGNATURE_TRAITS: readonly string[] = ["Box to box", "Clinical finisher", "Ball winner"];

const SKILL_MOVES_MEAN: Record<Position, number> = { DEF: 2, CM: 2.6, CAM: 3.4, ATT: 3.1 };
const WORK = ["Low", "Med", "High"] as const;

export interface Profile {
  /** Overall level the skills are drawn around (the random default is about 66 ± 5). */
  base?: number;
  /** Exact OVR to land on: every skill shifts together until the card shows it. Set from SCOUTING. */
  ovr?: number;
  /** Rate the card as this position instead of the Pick 7 one (the card shows it). */
  role?: Position;
  /** 0–1: how much the position's weaknesses apply. 0 = complete all-rounder. Default 1. */
  specialism?: number;
  style?: Style;
  /** Extra lean per face stat, on top of position and style. */
  tilt?: Partial<Record<FaceStat, number>>;
  /** Pinned skills (applied last, before face stats and OVR). */
  skills?: Partial<Record<Skill, number>>;
  /** Always-on traits (random ones fill the rest, up to 3). */
  traits?: string[];
  workRate?: { att: (typeof WORK)[number]; def: (typeof WORK)[number] };
  /** Weak foot, 1–5. Only profiles can give 1 or 5; the dice stay between 2 and 4. */
  weakFoot?: number;
}

const BOX_TO_BOX: Profile = {
  style: "Engine",
  tilt: { PHY: 3, DEF: 6, SHO: 3 },
  skills: { Stamina: 90 },
  traits: ["Box to box"],
  workRate: { att: "High", def: "High" },
};
const DEFENSIVE_MONSTER: Profile = {
  base: 67,
  style: "Wall",
  tilt: { DEF: 8, PHY: 3 },
  traits: ["Ball winner", "Dives into tackles"],
  workRate: { att: "Low", def: "High" },
};
const OLD_GUN: Profile = {
  base: 72,
  style: "Sniper",
  tilt: { PAC: -10, SHO: 6, PAS: 5, PHY: -3 },
  skills: { "Long shots": 88, "Shot power": 86, Volleys: 84, Curve: 84, Vision: 82, Composure: 86, Stamina: 58 },
  traits: ["Long shot taker", "Outside foot shot"],
  workRate: { att: "High", def: "Low" },
};
const ATTACKING_THREAT: Profile = {
  base: 72,
  tilt: { SHO: 5, DRI: 5, PAC: 3 },
  traits: ["Flair", "Speed dribbler"],
  workRate: { att: "High", def: "Med" },
};
const ALL_ROUNDER = (base: number, extra: Profile = {}): Profile => ({
  base,
  specialism: 0.15,
  style: "Technician",
  tilt: { DEF: 4 },
  traits: ["Team player", "Leadership"],
  workRate: { att: "High", def: "High" },
  ...extra,
});

/**
 * The club's scouting order, best first. Each group starts below the one above it with
 * a two-point gap; within a group each place is one point lower. Players left out
 * (no scouting report yet) are rated by their profile or at random.
 */
export const SCOUTING: readonly (readonly string[])[] = [
  ["savi", "navneet", "tadas", "inder", "abrar", "jedi", "nakul", "raunak", "robin", "sanjeev", "ghous", "harpreet", "archit"],
  ["vikram", "vineet", "harry", "karminder", "danial", "gurnaam", "awais", "jaskaran"],
];
export const SCOUTING_TOP = 88;
const GROUP_GAP = 2;

/** OVR each scouted player's card lands on. */
export const SCOUTED_OVR: Readonly<Record<string, number>> = (() => {
  const out: Record<string, number> = {};
  let next = SCOUTING_TOP;
  SCOUTING.forEach((group, gi) => {
    if (gi > 0) next -= GROUP_GAP;
    for (const id of group) out[id] = next--;
  });
  return out;
})();

/** What the club knows about players, by id. Anyone missing is rated entirely at random. */
export const PROFILES: Record<string, Profile> = {
  // The most skilled all-round players.
  savi: ALL_ROUNDER(82, { weakFoot: 5 }),
  tadas: ALL_ROUNDER(81, { traits: ["Technical dribbler", "Long passer"], weakFoot: 5 }),
  navneet: ALL_ROUNDER(81, { style: "Playmaker", traits: ["Team player", "Long passer"] }),

  // Strikers.
  inder: {
    base: 76,
    style: "Sniper",
    tilt: { SHO: 8, DRI: 2 },
    skills: { Finishing: 91, Positioning: 90, Composure: 87, Penalties: 85 },
    traits: ["Clinical finisher", "Power header"],
    workRate: { att: "High", def: "Low" },
  },
  nakul: {
    base: 72,
    style: "Technician",
    tilt: { SHO: 4, DRI: 3 },
    skills: { Finishing: 84, Curve: 89, "Long shots": 82, Composure: 82 },
    traits: ["Finesse shot", "Chip shot"],
  },

  // Defender / CM.
  abrar: {
    base: 78,
    role: "CM",
    style: "Engine",
    tilt: { DEF: 12, PAS: 2 },
    skills: { Interceptions: 86, Awareness: 85, "Standing tackle": 85 },
    traits: ["Ball winner", "Long passer"],
    workRate: { att: "Med", def: "High" },
  },

  // Old head, still sharp: reads the game, the legs are the only thing that's gone.
  jaskaran: {
    base: 70,
    style: "Wall",
    tilt: { PAC: -8, DEF: 4 },
    skills: { Awareness: 85, Composure: 82, Heading: 80, "Sprint speed": 55, Acceleration: 56 },
    traits: ["Leadership", "Solid player"],
    workRate: { att: "Low", def: "Med" },
    weakFoot: 1,
  },

  // Weakest weak foot in the squad, with Jaskaran.
  awais: { weakFoot: 1 },

  // Box to box.
  ghous: { ...BOX_TO_BOX, base: 70 },
  sanjeev: { ...BOX_TO_BOX, base: 73 },
  jedi: { ...BOX_TO_BOX, base: 72 },
  raunak: { ...BOX_TO_BOX, base: 72 },

  // Defensive monsters.
  archit: DEFENSIVE_MONSTER,
  danial: DEFENSIVE_MONSTER,
  vineet: DEFENSIVE_MONSTER,

  // Attacking threats.
  harpreet: { ...ATTACKING_THREAT, skills: { Finishing: 84, Acceleration: 84 } },
  robin: { ...ATTACKING_THREAT, base: 70, tilt: { SHO: 6, DRI: 5, PAS: 3 }, skills: { Vision: 82, Finishing: 80 } },

  // The old guns: score and assist screamers.
  vikram: OLD_GUN,
  karminder: OLD_GUN,
};

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

/** `targetOvr` overrides the scouted OVR (used by form, see ratingForm.ts). */
export function rate(player: Pick<Player, "id" | "name" | "position">, seed = RATINGS_SEED, targetOvr?: number): PlayerRating {
  const rand = mulberry32(hash(`${seed}:${player.id}`));
  const gauss = (mean: number, sd: number) => {
    const u = 1 - rand();
    const v = rand();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];

  const prof: Profile = { ...PROFILES[player.id], ovr: targetOvr ?? SCOUTED_OVR[player.id] ?? PROFILES[player.id]?.ovr };
  const position: Position = prof.role ?? player.position ?? "CM";
  const rolledBase = gauss(66, 5); // local-league level, roughly 56–76
  const base = prof.base ?? rolledBase;
  const rolledStyle = pick(Object.keys(STYLES) as Style[]);
  const style = prof.style ?? rolledStyle;
  const specialism = prof.specialism ?? 1;
  const skew: Partial<Record<FaceStat, number>> = STYLES[style];

  const skills = {} as Record<Skill, number>;
  for (const g of FACE_STATS) {
    const posTilt = POSITION_TILT[position][g];
    const lean = (posTilt < 0 ? posTilt * specialism : posTilt) + (skew[g] ?? 0) + (prof.tilt?.[g] ?? 0);
    // Profiled players wobble less, so what the club knows about them shows through.
    const groupLevel = base + lean + gauss(0, prof.base ? 1.5 : 3);
    for (const s of SKILLS[g]) skills[s] = clampSkill(groupLevel + gauss(0, prof.base ? 3 : 4.5));
  }
  Object.assign(skills, prof.skills);


  const wfRoll = rand();
  const traits: string[] = [...(prof.traits ?? [])];
  // Signature traits only come from a profile, never from the dice.
  const traitPool = TRAITS.filter((t) => !traits.includes(t) && !SIGNATURE_TRAITS.includes(t));
  for (let n = Math.max(1, Math.floor(rand() * 3) + 1 - traits.length); n > 0 && traits.length < 3; n--)
    traits.push(traitPool.splice(Math.floor(rand() * traitPool.length), 1)[0]);

  // Land on the scouted OVR: shift every skill together (a few passes, since skills clamp at 25 and 94).
  let ovr = weighted(skills, OVR_WEIGHTS[position]);
  for (let pass = 0; prof.ovr !== undefined && ovr !== prof.ovr && pass < 6; pass++) {
    const delta = prof.ovr - ovr;
    for (const k of ALL_SKILLS) skills[k] = clampSkill(skills[k] + delta);
    ovr = weighted(skills, OVR_WEIGHTS[position]);
  }
  const face = Object.fromEntries(FACE_STATS.map((g) => [g, weighted(skills, FACE_WEIGHTS[g])])) as Record<FaceStat, number>;
  const rolledWork = { att: pick(WORK), def: pick(WORK) };

  return {
    id: player.id,
    name: player.name,
    position,
    ovr,
    face,
    skills,
    style,
    skillMoves: Math.max(1, Math.min(5, Math.round(gauss(SKILL_MOVES_MEAN[position], 0.8)))),
    // Club's view: Savi and Tadas have the best weak foot (5), Jaskaran and Awais the weakest (1).
    weakFoot: prof.weakFoot ?? (wfRoll < 0.3 ? 2 : wfRoll < 0.75 ? 3 : 4),
    foot: rand() < 0.22 ? "Left" : "Right",
    workRate: prof.workRate ?? rolledWork,
    traits,
  };
}

/** Card tier: gold 80+, silver 74–79, bronze below. */
export function tier(ovr: number): "gold" | "silver" | "bronze" {
  return ovr >= 80 ? "gold" : ovr >= 74 ? "silver" : "bronze";
}

/** Every roster player's card, best first (ties by name). */
export const SQUAD_RATINGS: readonly PlayerRating[] = ROSTER.map((p) => rate(p)).sort(
  (a, b) => b.ovr - a.ovr || a.name.localeCompare(b.name),
);

const BY_ID = new Map(SQUAD_RATINGS.map((r) => [r.id, r]));
export const ratingFor = (id: string) => BY_ID.get(id);
