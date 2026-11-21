import { describe, expect, it } from "vitest";
import { ROSTER } from "@/config/club";
import { ALL_SKILLS, FACE_STATS, SCOUTED_OVR, SCOUTING, SCOUTING_TOP, SQUAD_RATINGS, rate, ratingFor } from "./ratings";

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

  it("R05 is sorted best first", () => {
    for (let i = 1; i < SQUAD_RATINGS.length; i++) expect(SQUAD_RATINGS[i - 1].ovr).toBeGreaterThanOrEqual(SQUAD_RATINGS[i].ovr);
  });

  it("R06 follows the club's scouting order, keeping each player's strengths", () => {
    const r = (id: string) => ratingFor(id)!;
    const order = SCOUTING.flat();
    for (let i = 1; i < order.length; i++) expect(r(order[i - 1]).ovr).toBeGreaterThan(r(order[i]).ovr);
    for (const id of order) expect(r(id).ovr).toBe(SCOUTED_OVR[id]);
    expect(r("savi").ovr).toBe(SCOUTING_TOP);
    // A gap between scouting groups.
    expect(r(SCOUTING[0].at(-1)!).ovr - r(SCOUTING[1][0]).ovr).toBe(3);
    // Strengths survive the re-levelling.
    const atts = SQUAD_RATINGS.filter((x) => x.position === "ATT");
    expect(atts.toSorted((a, b) => b.face.SHO - a.face.SHO)[0].id).toBe("inder");
    expect(r("nakul").traits).toContain("Finesse shot");
    for (const id of ["ghous", "sanjeev", "jedi", "raunak"]) expect(r(id).traits).toContain("Box to box");
    for (const id of ["vikram", "karminder"]) expect(r(id).face.SHO).toBeGreaterThan(r(id).face.PAC + 10);
    for (const id of ["archit", "danial", "vineet"]) expect(r(id).face.DEF).toBeGreaterThan(r(id).face.SHO + 25);
  });

  it("R07 weak foot: Savi and Tadas best, Jaskaran and Awais weakest", () => {
    const wf = (id: string) => ratingFor(id)!.weakFoot;
    expect([wf("savi"), wf("tadas"), wf("jaskaran"), wf("awais")]).toEqual([5, 5, 1, 1]);
    for (const r of SQUAD_RATINGS) {
      if (["savi", "tadas", "jaskaran", "awais"].includes(r.id)) continue;
      expect(r.weakFoot).toBeGreaterThanOrEqual(2);
      expect(r.weakFoot).toBeLessThanOrEqual(4);
    }
  });
});
