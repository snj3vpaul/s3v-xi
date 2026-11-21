import { describe, expect, it } from "vitest";
import { ROSTER } from "@/config/club";
import { PORTRAITS } from "@/config/portraits";

describe("squad portraits", () => {
  it("PT01 every portrait belongs to a roster player", () => {
    const ids = new Set(ROSTER.map((p) => p.id));
    for (const id of Object.keys(PORTRAITS)) expect(ids.has(id), id).toBe(true);
  });

  it("PT02 the dome four plus the group photo's fourteen are in", () => {
    expect(Object.keys(PORTRAITS).sort()).toEqual(
      [
        "archit", "ghous", "navneet", "tadas",
        "jedi", "sanjeev", "gurnaam", "vineet", "danial", "nakul", "danish", "vikram", "karminder", "harpreet", "savi", "jaskaran", "robin", "raunak",
      ].sort(),
    );
  });

  it("PT03 still to come: Inder, Abrar, Harry, Awais, Ganga keep their mascots", () => {
    for (const id of ["inder", "abrar", "harry", "awais", "ganga"]) expect(PORTRAITS[id]).toBeUndefined();
  });
});
