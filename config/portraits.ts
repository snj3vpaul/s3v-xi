/**
 * Anime-style squad portraits: hand-built vector characters, drawn from each
 * player's real features (face shape, hair, beard, skin tone, smile) so they're
 * recognisable without putting photos of members on a public site.
 *
 * Players listed here get a portrait on their squad card; everyone else keeps
 * their mascot. To add a player, copy an entry and adjust it.
 */
export type PortraitHair =
  | "swept" // short, swept to one side
  | "curls" // big curly volume
  | "wavyBack" // swept up and back
  | "shaved" // shaved head
  | "crop" // very close crop
  | "short" // neat short
  | "spiked" // short, styled up at the front
  | "fluffy" // medium, soft and full
  | "receding" // short with a high hairline
  | "curlyShort"; // short, tight curls
export type PortraitBeard = "none" | "stubble" | "full" | "trimmed" | "goatee" | "moustache" | "long";
export type PortraitMouth = "grin" | "smile" | "calm";
export type PortraitKit = "tee" | "polo" | "hoodie" | "jacket" | "stripes";

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
  /** Cut of the top (default tee). Jacket and stripes use kitTrim as the second colour. */
  kitStyle?: PortraitKit;
  extras?: ("medal" | "chain")[];
  cap?: { color: string; brim?: string; logo?: string };
  glasses?: { shape: "round" | "rect"; frame: string; clear?: boolean };
  /** Smile lines for the older heads. */
  lines?: boolean;
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

// Group photo (2026-11-21). Positions and features as described by the club.
Object.assign(PORTRAITS, {
  jedi: { skin: "#6e4630", shade: "#53331f", hair: "crop", hairColor: "#120d0a", beard: "full", beardColor: "#120d0a", jaw: 0.6, length: 0.6, mouth: "grin", iris: "#2a1810", kit: "#4a2f26", kitTrim: "#3a241d", kitStyle: "polo" },
  sanjeev: { skin: "#c9946c", shade: "#a8754f", hair: "spiked", hairColor: "#16110d", beard: "trimmed", beardColor: "#1a130f", jaw: 0.45, length: 0.6, mouth: "grin", iris: "#2a1810", kit: "#4a1f22", kitTrim: "#2f1416", kitStyle: "polo", glasses: { shape: "round", frame: "#1a1412" } },
  gurnaam: { skin: "#c48e66", shade: "#a06f4b", hair: "short", hairColor: "#17110d", beard: "long", beardColor: "#17110d", jaw: 0.5, length: 0.6, mouth: "calm", iris: "#2a1810", kit: "#3f5a86", kitTrim: "#1e2a40", kitStyle: "stripes", cap: { color: "#efece4", brim: "#e2ded4", logo: "#2a2a2a" } },
  vineet: { skin: "#d2a17d", shade: "#b0805d", hair: "receding", hairColor: "#9a948c", beard: "none", beardColor: "#6b625a", jaw: 0.45, length: 0.7, mouth: "grin", iris: "#2a1810", kit: "#d9d2c0", kitTrim: "#a99f88", kitStyle: "polo", glasses: { shape: "rect", frame: "#8a8a8a" }, lines: true },
  danial: { skin: "#ddb08c", shade: "#bb8b68", hair: "fluffy", hairColor: "#1b1410", beard: "stubble", beardColor: "#3a2c24", jaw: 0.4, length: 0.6, mouth: "smile", iris: "#2a1810", kit: "#141414", kitTrim: "#2e2e2e", kitStyle: "tee" },
  nakul: { skin: "#cf9c76", shade: "#ad7b56", hair: "spiked", hairColor: "#17110d", beard: "trimmed", beardColor: "#1a130f", jaw: 0.45, length: 0.6, mouth: "grin", iris: "#2a1810", kit: "#9a9b9b", kitTrim: "#7d7e7e", kitStyle: "hoodie", glasses: { shape: "rect", frame: "#d8d8d4", clear: true } },
  danish: { skin: "#d6a882", shade: "#b4865f", hair: "short", hairColor: "#16110d", beard: "stubble", beardColor: "#2b211b", jaw: 0.5, length: 0.5, mouth: "smile", iris: "#2a1810", kit: "#141414", kitTrim: "#8a3328", kitStyle: "jacket", glasses: { shape: "round", frame: "#3a2a20" } },
  vikram: { skin: "#c48e66", shade: "#a06f4b", hair: "receding", hairColor: "#1a1411", beard: "stubble", beardColor: "#2b211b", jaw: 0.6, length: 0.65, mouth: "grin", iris: "#2a1810", kit: "#3e4a4a", kitTrim: "#2c3535", kitStyle: "tee", lines: true },
  karminder: { skin: "#bb855e", shade: "#986343", hair: "curlyShort", hairColor: "#2a2420", beard: "moustache", beardColor: "#221a15", jaw: 0.5, length: 0.7, mouth: "grin", iris: "#2a1810", kit: "#2b3a52", kitTrim: "#1e2a3c", kitStyle: "tee", lines: true },
  harpreet: { skin: "#c08a63", shade: "#9c6c48", hair: "short", hairColor: "#3a332e", beard: "full", beardColor: "#b9b2a8", jaw: 0.5, length: 0.65, mouth: "smile", iris: "#2a1810", kit: "#e8e0cf", kitTrim: "#a3342c", kitStyle: "polo", cap: { color: "#b8323a", brim: "#9a2830" }, glasses: { shape: "rect", frame: "#2a2420" }, lines: true },
  savi: { skin: "#cf9c76", shade: "#ad7b56", hair: "fluffy", hairColor: "#16110d", beard: "trimmed", beardColor: "#1a130f", jaw: 0.45, length: 0.6, mouth: "smile", iris: "#2a1810", kit: "#1a1a1a", kitTrim: "#3a3a3a", kitStyle: "tee" },
  jaskaran: { skin: "#c48e66", shade: "#a06f4b", hair: "receding", hairColor: "#4a4540", beard: "stubble", beardColor: "#3a3530", jaw: 0.5, length: 0.65, mouth: "smile", iris: "#2a1810", kit: "#181818", kitTrim: "#2e2e2e", kitStyle: "tee", glasses: { shape: "rect", frame: "#141414" }, lines: true },
  robin: { skin: "#c99470", shade: "#a6724f", hair: "short", hairColor: "#2a2420", beard: "full", beardColor: "#4a4440", jaw: 0.55, length: 0.6, mouth: "grin", iris: "#2a1810", kit: "#1c1c1c", kitTrim: "#333", kitStyle: "tee", cap: { color: "#8f8f8c", brim: "#7a7a77" }, lines: true },
  raunak: { skin: "#d4a47e", shade: "#b2825d", hair: "spiked", hairColor: "#16110d", beard: "none", beardColor: "#2b211b", jaw: 0.45, length: 0.7, mouth: "grin", iris: "#2a1810", kit: "#f1efe9", kitTrim: "#d8d4ca", kitStyle: "hoodie" },
} satisfies Record<string, PortraitLook>);

export const portraitFor = (id: string) => PORTRAITS[id];
