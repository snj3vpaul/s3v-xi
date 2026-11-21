import { describe, expect, it } from "vitest";
import { ROSTER } from "@/config/club";
import { ALL_SKILLS, FACE_STATS, SQUAD_RATINGS, rate, ratingFor, tier } from "./ratings";

describe("player ratings", () => {
  it("R01 gives every roster player a card", () => {
    expect(SQUAD_RATINGS).toHaveLength(ROSTER.length);
    for (const p of ROSTER) expect(ratingFor(p.id)?.name).toBe(p.name);
  });

  it("R02 is deterministic per player and seed", () => {
    const p = ROSTER[0];
    expect(rate(p)).toEqual(rate(p));
    expect(rate(p, "other-seed")).not.toEqual(rate(p));
  });

  it("R03 keeps every number in range", () => {
    for (const r of SQUAD_RATINGS) {
      expect(Object.keys(r.skills)).toHaveLength(29);
      for (const s of ALL_SKILLS) expect(r.skills[s]).toBeGreaterThanOrEqual(25), expect(r.skills[s]).toBeLessThanOrEqual(94);
      for (const g of FACE_STATS) expect(r.face[g]).toBeGreaterThanOrEqual(25), expect(r.face[g]).toBeLessThanOrEqual(94);
      expect(r.ovr).toBeGreaterThanOrEqual(40);
      expect(r.ovr).toBeLessThanOrEqual(94);
      expect(r.skillMoves).toBeGreaterThanOrEqual(1);
      expect(r.weakFoot).toBeLessThanOrEqual(5);
      expect(r.traits.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("R04 leans by position: defenders out-defend attackers on average", () => {
    const avg = (pos: string, g: "DEF" | "SHO") => {
      const rs = SQUAD_RATINGS.filter((r) => r.position === pos);
      return rs.reduce((s, r) => s + r.face[g], 0) / rs.length;
    };
    expect(avg("DEF", "DEF")).toBeGreaterThan(avg("ATT", "DEF") + 15);
    expect(avg("ATT", "SHO")).toBeGreaterThan(avg("DEF", "SHO") + 10);
  });

  it("R05 is sorted best first and tiers cards", () => {
    for (let i = 1; i < SQUAD_RATINGS.length; i++) expect(SQUAD_RATINGS[i - 1].ovr).toBeGreaterThanOrEqual(SQUAD_RATINGS[i].ovr);
    expect([tier(80), tier(76), tier(70)]).toEqual(["gold", "silver", "bronze"]);
  });

  it("R06 reflects what the club knows about players", () => {
    const r = (id: string) => ratingFor(id)!;
    // Savi, Tadas and Navneet are the best three all-rounders, with no weak face stat.
    expect(SQUAD_RATINGS.slice(0, 3).map((x) => x.id).sort()).toEqual(["navneet", "savi", "tadas"]);
    for (const id of ["savi", "tadas", "navneet"]) expect(Math.min(...FACE_STATS.map((g) => r(id).face[g]))).toBeGreaterThanOrEqual(75);
    // Inder is the top striker; Nakul has the finesse.
    const atts = SQUAD_RATINGS.filter((x) => x.position === "ATT");
    expect(atts.toSorted((a, b) => b.face.SHO - a.face.SHO)[0].id).toBe("inder");
    expect(r("nakul").traits).toContain("Finesse shot");
    // Defensive monsters and Abrar defend at 85+; Jaskaran stays up there.
    for (const id of ["archit", "danial", "vineet", "abrar"]) expect(r(id).face.DEF).toBeGreaterThanOrEqual(85);
    expect(r("jaskaran").ovr).toBeGreaterThanOrEqual(78);
    // Box to box runners.
    for (const id of ["ghous", "sanjeev", "jedi", "raunak"]) {
      expect(r(id).traits).toContain("Box to box");
      expect(r(id).skills.Stamina).toBeGreaterThanOrEqual(88);
    }
    // Old guns: long-range shooting, legs a bit slower than their finishing.
    for (const id of ["vikram", "karminder"]) {
      expect(r(id).skills["Long shots"]).toBeGreaterThanOrEqual(85);
      expect(r(id).face.SHO).toBeGreaterThan(r(id).face.PAC + 10);
    }
  });
});
