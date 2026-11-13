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
export const BOOT_COLORS = ["#3fd38a", "#ff8a3d", "#ff5fa2", "#3ac8e8", "#f2efe6", "#e9b949", "#8f78e6"];
export const SOCK_COLORS = ["#f2efe6", "#0c1925", "#3fd38a"];

export const LOOK_OVERRIDES: Partial<Record<string, Partial<MascotLook>>> = {};
