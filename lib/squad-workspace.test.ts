import { describe, expect, it } from "vitest";
import { PLAYERS, START_BENCH, START_SQUAD } from "./demo";
import { parseSquadWorkspace, swapBenchPlayer, isReady, type SquadWorkspace } from "./squad-workspace";

const initial: SquadWorkspace = { squadIds: START_SQUAD, benchIds: START_BENCH, captain: "p03", vice: "p08", chip: null };

describe("squad persistence and substitutions", () => {
  it("round trips a saved demo squad", () => expect(parseSquadWorkspace(JSON.stringify(initial), PLAYERS)).toEqual(initial));
  it("rejects invalid and tampered drafts", () => {
    expect(parseSquadWorkspace("{", PLAYERS)).toBeNull();
    expect(parseSquadWorkspace(JSON.stringify({ ...initial, squadIds: ["missing"] }), PLAYERS)).toBeNull();
    expect(parseSquadWorkspace(JSON.stringify({ ...initial, benchIds: ["p01", "p01"] }), PLAYERS)).toBeNull();
    expect(parseSquadWorkspace(JSON.stringify({ ...initial, captain: START_BENCH[0] }), PLAYERS)).toBeNull();
  });
  it("exchanges starter and reserve without changing 11/4 counts", () => {
    const next = swapBenchPlayer(initial, "p01", START_BENCH[0]);
    expect(next.benchIds).toContain("p01");
    expect(next.benchIds).not.toContain(START_BENCH[0]);
    expect(next.benchIds).toHaveLength(4);
    expect(isReady(next, PLAYERS)).toBe(true);
  });
  it("clears captaincy when the captain moves to the bench", () => {
    const next = swapBenchPlayer(initial, "p03", START_BENCH[0]);
    expect(next.captain).toBeNull();
    expect(isReady(next, PLAYERS)).toBe(false);
  });
  it("rejects swapping two reserves", () => expect(() => swapBenchPlayer(initial, START_BENCH[0], START_BENCH[1])).toThrow());
});
