import { describe, expect, it } from "vitest";
import { ROSTER } from "@/config/club";
import { PORTRAITS } from "@/config/portraits";

describe("squad portraits", () => {
  it("PT01 every portrait belongs to a roster player", () => {
    const ids = new Set(ROSTER.map((p) => p.id));
    for (const id of Object.keys(PORTRAITS)) expect(ids.has(id), id).toBe(true);
  });

  it("PT02 the first four are in (Tadas, Navneet, Ghous, Archit)", () => {
    expect(Object.keys(PORTRAITS).sort()).toEqual(["archit", "ghous", "navneet", "tadas"]);
  });
});
