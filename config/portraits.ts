/**
 * Anime-style squad portraits: hand-built vector characters, drawn from each
 * player's real features (face shape, hair, beard, skin tone, smile) so they're
 * recognisable without putting photos of members on a public site.
 *
 * Players listed here get a portrait on their squad card; everyone else keeps
 * their mascot. To add a player, copy an entry and adjust it.
 */
export type PortraitHair = "swept" | "curls" | "wavyBack" | "shaved";
export type PortraitBeard = "none" | "stubble" | "full" | "trimmed" | "goatee";
export type PortraitMouth = "grin" | "smile" | "calm";

export interface PortraitLook {
  skin: string;
  /** Shadow tone for cel shading (a darker skin). */
  shade: string;
  hair: PortraitHair;
  hairColor: string;
  beard: PortraitBeard;
  beardColor: string;
  /** Face width at the jaw, 0 (narrow) to 1 (broad). */
  jaw: number;
  /** Face length, 0 (short) to 1 (long). */
  length: number;
  mouth: PortraitMouth;
  iris: string;
  /** Shirt as worn in the photo. */
  kit: string;
  kitTrim: string;
  extras?: ("medal" | "chain")[];
}

export const PORTRAITS: Partial<Record<string, PortraitLook>> = {
  tadas: {
    skin: "#f2cfb4",
    shade: "#dba98b",
    hair: "swept",
    hairColor: "#3b2a20",
    beard: "stubble",
    beardColor: "#6b5244",
    jaw: 0.35,
    length: 0.8,
    mouth: "grin",
    iris: "#5b7d8f",
    kit: "#f5f2ea",
    kitTrim: "#d9a441",
    extras: ["medal"],
  },
  navneet: {
    skin: "#b8835e",
    shade: "#946342",
    hair: "curls",
    hairColor: "#17110d",
    beard: "full",
    beardColor: "#17110d",
    jaw: 0.7,
    length: 0.55,
    mouth: "grin",
    iris: "#3a2418",
    kit: "#1b1a1a",
    kitTrim: "#8fd3c7",
    extras: ["chain"],
  },
  ghous: {
    skin: "#c48e66",
    shade: "#a06f4b",
    hair: "wavyBack",
    hairColor: "#1d1510",
    beard: "trimmed",
    beardColor: "#1d1510",
    jaw: 0.5,
    length: 0.55,
    mouth: "grin",
    iris: "#3a2418",
    kit: "#c8322b",
    kitTrim: "#1b1a1a",
    extras: ["medal"],
  },
  archit: {
    skin: "#cf9a77",
    shade: "#ad7a58",
    hair: "shaved",
    hairColor: "#2a1f19",
    beard: "goatee",
    beardColor: "#211813",
    jaw: 0.5,
    length: 0.7,
    mouth: "smile",
    iris: "#3a2418",
    kit: "#9a9a96",
    kitTrim: "#2b2b2b",
  },
};

export const portraitFor = (id: string) => PORTRAITS[id];
