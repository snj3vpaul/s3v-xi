import { describe, expect, it } from "vitest";
import { SeededRandom, formatLabel } from "./draw";

const SEED = "a".repeat(64);

describe("seeded random stream (simulation and demo seeder)", () => {
  it("D01 same seed and attempt → same stream; different seed → different", () => {
    const a = new SeededRandom(SEED, 0);
    const b = new SeededRandom(SEED, 0);
    const c = new SeededRandom("b".repeat(64), 0);
    const xs = Array.from({ length: 20 }, () => a.nextUint32());
    expect(Array.from({ length: 20 }, () => b.nextUint32())).toEqual(xs);
    expect(Array.from({ length: 20 }, () => c.nextUint32())).not.toEqual(xs);
  });

  it("D02 shuffle keeps every item and is reproducible", () => {
    const items = Array.from({ length: 16 }, (_, i) => `p${i}`);
    const s1 = new SeededRandom(SEED, 3).shuffle(items);
    expect([...s1].sort()).toEqual([...items].sort());
    expect(new SeededRandom(SEED, 3).shuffle(items)).toEqual(s1);
  });

  it("D03 seeded integers are unbiased (rough uniformity check)", () => {
    const rng = new SeededRandom(SEED, 0);
    const buckets = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 70_000; i++) buckets[rng.int(7)]++;
    for (const b of buckets) expect(Math.abs(b - 10_000)).toBeLessThan(500);
    expect(() => rng.int(0)).toThrow(RangeError);
  });
});

describe("team format label", () => {
  it("D04 team sheet: White v Red counts; old draws: per side, rolling subs and floater", () => {
    expect(formatLabel({ algorithm: "manual", teamA: ["a", "b", "c"], teamB: ["d", "e"], perSide: 0, rollingSubs: 0, floater: null })).toBe("3v2");
    expect(formatLabel({ perSide: 8, rollingSubs: 0, floater: null })).toBe("8v8");
    expect(formatLabel({ perSide: 6, rollingSubs: 0, floater: "x" })).toBe("6v6 · 1 floater");
    expect(formatLabel({ perSide: 8, rollingSubs: 1, floater: null })).toBe("8v8 · 1 rolling sub each");
    expect(formatLabel({ perSide: 8, rollingSubs: 2, floater: "x" })).toBe("8v8 · 2 rolling subs each · 1 floater");
  });
});
