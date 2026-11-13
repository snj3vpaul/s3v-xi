import {
  BOOT_COLORS,
  EYE_STYLES,
  HAIR_COLORS,
  HAIR_STYLES,
  LOOK_OVERRIDES,
  MOUTHS,
  SKIN_TONES,
  SOCK_COLORS,
  type MascotLook,
} from "@/config/mascots";

/** FNV-1a 32-bit: a stable number for a string. */
function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Small seeded PRNG (mulberry32) so one id always produces the same mascot. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)];

/** The mascot look for a player id: generated, then any club overrides applied. */
export function mascotLook(id: string): MascotLook {
  const r = rng(fnv(id));
  const hair = pick(r, HAIR_STYLES);
  const generated: MascotLook = {
    skin: pick(r, SKIN_TONES),
    hair,
    hairColor: hair === "bald" ? "transparent" : pick(r, HAIR_COLORS),
    eyes: pick(r, EYE_STYLES),
    mouth: pick(r, MOUTHS),
    beard: r() < 0.35,
    boots: pick(r, BOOT_COLORS),
    socks: pick(r, SOCK_COLORS),
    brow: Math.round((r() - 0.5) * 24),
  };
  return { ...generated, ...LOOK_OVERRIDES[id] };
}

/** Deterministic 0..1 value per id, for desynchronising idle animations. */
export function mascotPhase(id: string): number {
  return (fnv(`${id}:phase`) % 1000) / 1000;
}
