/**
 * Squad mascots: one original cartoon footballer per player.
 *
 * Every look is generated from the player's id, so each of the 21 is different
 * and stays the same everywhere. To make a mascot look more like the real
 * person, add an override below; anything you leave out stays generated.
 *
 *   sanjeev: { hair: "quiff", hairColor: "#1b1410", beard: true },
 */
export const HAIR_STYLES = ["buzz", "curly", "quiff", "spiky", "bald", "sidepart", "topknot", "mop"] as const;
export const EYE_STYLES = ["round", "dot", "happy"] as const;
export const MOUTHS = ["grin", "smile", "o", "smirk"] as const;

export type HairStyle = (typeof HAIR_STYLES)[number];
export type EyeStyle = (typeof EYE_STYLES)[number];
export type Mouth = (typeof MOUTHS)[number];

export interface MascotLook {
  skin: string;
  hair: HairStyle;
  hairColor: string;
  eyes: EyeStyle;
  mouth: Mouth;
  beard: boolean;
  boots: string;
  socks: string;
  /** Degrees; tilts the brows for a bit of attitude. */
  brow: number;
}

export const SKIN_TONES = ["#f1c7a3", "#e2a77f", "#c98a5e", "#a8693f", "#8a5232", "#6b3d24"];
export const HAIR_COLORS = ["#16110e", "#2b1d15", "#4a3020", "#7a4a2a", "#b98a4e", "#8f8f8f"];
export const BOOT_COLORS = ["#4c7d62", "#c9a85c", "#b5654a", "#6e8ca8", "#f5f0e6", "#d9a441", "#7b5a84", "#2b2118"];
export const SOCK_COLORS = ["#f5f0e6", "#2b2118", "#4c7d62"];

export const LOOK_OVERRIDES: Partial<Record<string, Partial<MascotLook>>> = {};
