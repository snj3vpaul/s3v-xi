/** The example generator must always produce valid, fully-scored v2 Thursdays. */
import { describe, expect, it } from "vitest";
import { rulesFrom } from "./ledger";
import { buildPick7Table, selectorBreakdown } from "./pick7Table";
import { simulateSeason } from "./simulate";

describe("simulation", () => {
  it("SIM01 any seed gives played v2 weeks with MOTM, conduct confirmed, and breakdowns that add up", () => {
    for (const seed of ["a", "b", "zz9", "rsfc", "demo", "x1y2z3"]) {
      const { state, selectors } = simulateSeason(seed, 4);
      expect(state.matchDays).toHaveLength(4);
      for (const m of state.matchDays) {
        expect(m.status).toBe("played");
        expect(m.rulesVersion).toBe(2);
        expect(m.motm?.A && m.motm?.B).toBeTruthy();
        expect(m.rotationChecked).toBe(true);
      }
      const rules = rulesFrom(state.settings);
      const table = buildPick7Table(state, rules);
      for (const id of selectors) expect(selectorBreakdown(state, rules, id).total).toBe(table.find((r) => r.id === id)!.points);
    }
  });

  it("SIM03 a showcase night always has an own goal, a penalty, an assist, a fair-play loss and a missed rotation", () => {
    for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]) {
      const m = simulateSeason(seed, 1, { showcase: true }).state.matchDays[0];
      expect(m.events.some((e) => e.kind === "own_goal")).toBe(true);
      expect(m.events.some((e) => e.kind === "penalty")).toBe(true);
      expect(m.events.some((e) => e.assistId)).toBe(true);
      expect(m.draw?.algorithm).toBe("manual");
      expect(m.fairPlayLost).toHaveLength(1);
      expect(m.rotationMissed).toHaveLength(1);
    }
  });

  it("SIM02 the same seed always gives the same night", () => {
    const a = simulateSeason("same", 1).state.matchDays[0];
    const b = simulateSeason("same", 1).state.matchDays[0];
    expect(b.events).toEqual(a.events);
    expect(b.draw?.teamA).toEqual(a.draw?.teamA);
  });
});
