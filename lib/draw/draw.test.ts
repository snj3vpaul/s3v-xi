import { describe, expect, it } from "vitest";
import type { DrawConstraints } from "@/lib/league/types";
import { DrawError, SeededRandom, drawTeams, formatLabel, generateSeed, isRepeatOf, verifyDraw } from "./draw";

const DROPS = new Set(["savi", "abrar", "inder"]);
const isDropIn = (id: string) => DROPS.has(id);
const people = (n: number) => Array.from({ length: n }, (_, i) => `p${String(i).padStart(2, "0")}`);
const C = (o: Partial<DrawConstraints> = {}): DrawConstraints => ({
  splitDropIns: true,
  avoidRepeat: true,
  keepTogether: [],
  keepApart: [],
  maxPerSide: 8,
  ...o,
});
const SEED = "a".repeat(64);

describe("draw engine", () => {
  it("D01 same seed + same inputs → identical teams (auditable)", () => {
    const a = drawTeams({ attendees: people(16), constraints: C(), seed: SEED, isDropIn });
    const b = drawTeams({ attendees: [...people(16)].reverse(), constraints: C(), seed: SEED, isDropIn });
    expect(b.teamA).toEqual(a.teamA);
    expect(b.teamB).toEqual(a.teamB);
  });

  it("D02 different seeds give different splits", () => {
    const splits = new Set(
      Array.from({ length: 20 }, () => drawTeams({ attendees: people(16), constraints: C(), seed: generateSeed(), isDropIn }).teamA.join()),
    );
    expect(splits.size).toBeGreaterThan(15);
  });

  it("D03 even headcount → equal teams, no floater; odd → equal teams + one floater", () => {
    const even = drawTeams({ attendees: people(16), constraints: C(), seed: SEED, isDropIn });
    expect([even.teamA.length, even.teamB.length, even.floater]).toEqual([8, 8, null]);
    const odd = drawTeams({ attendees: people(15), constraints: C(), seed: SEED, isDropIn });
    expect([odd.teamA.length, odd.teamB.length]).toEqual([7, 7]);
    expect(odd.floater).not.toBeNull();
    expect(["A", "B"]).toContain(odd.floaterFirstHalf);
    expect(new Set([...odd.teamA, ...odd.teamB, odd.floater!]).size).toBe(15);
  });

  it("D04 floater rotates to whoever has floated least", () => {
    const att = people(9);
    const counts = Object.fromEntries(att.map((id) => [id, 2]));
    counts.p04 = 0;
    const d = drawTeams({ attendees: att, constraints: C(), seed: SEED, isDropIn, floaterCounts: counts });
    expect(d.floater).toBe("p04");
  });

  it("D05 drop-ins split as evenly as possible", () => {
    for (let i = 0; i < 25; i++) {
      const d = drawTeams({ attendees: [...people(13), "savi", "abrar", "inder"], constraints: C(), seed: generateSeed(), isDropIn });
      const a = d.teamA.filter(isDropIn).length;
      const b = d.teamB.filter(isDropIn).length;
      expect(Math.abs(a - b)).toBe(1);
    }
    for (let i = 0; i < 25; i++) {
      const d = drawTeams({ attendees: [...people(14), "savi", "abrar"], constraints: C(), seed: generateSeed(), isDropIn });
      expect(d.teamA.filter(isDropIn).length).toBe(1);
    }
  });

  it("D06 avoid-repeat rejects the exact previous split (either orientation)", () => {
    const first = drawTeams({ attendees: people(8), constraints: C({ avoidRepeat: false }), seed: SEED, isDropIn });
    const prev = { A: first.teamB, B: first.teamA };
    const again = drawTeams({ attendees: people(8), constraints: C(), seed: SEED, isDropIn, previousTeams: prev });
    expect(isRepeatOf({ A: again.teamA, B: again.teamB }, prev)).toBe(false);
    expect(again.attempt).toBeGreaterThan(0);
    const off = drawTeams({ attendees: people(8), constraints: C({ avoidRepeat: false }), seed: SEED, isDropIn, previousTeams: prev });
    expect(isRepeatOf({ A: off.teamA, B: off.teamB }, prev)).toBe(true);
  });

  it("D07 keep-together and keep-apart pairs are honoured", () => {
    for (let i = 0; i < 25; i++) {
      const d = drawTeams({
        attendees: people(16),
        constraints: C({ keepTogether: [["p00", "p01"]], keepApart: [["p02", "p03"], ["p04", "p05"]] }),
        seed: generateSeed(),
        isDropIn,
      });
      const side = (id: string) => (d.teamA.includes(id) ? "A" : "B");
      expect(side("p00")).toBe(side("p01"));
      expect(side("p02")).not.toBe(side("p03"));
      expect(side("p04")).not.toBe(side("p05"));
    }
  });

  it("D08 headcount shrinks the format; extras become rolling subs; too few → no draw", () => {
    const f = (n: number, max = 8) => drawTeams({ attendees: people(n), constraints: C({ maxPerSide: max }), seed: SEED, isDropIn });
    expect(formatLabel(f(16))).toBe("8v8");
    expect(formatLabel(f(14))).toBe("7v7");
    expect(formatLabel(f(13))).toBe("6v6 · 1 floater");
    expect(formatLabel(f(18))).toBe("8v8 · 1 rolling sub each");
    expect(formatLabel(f(21))).toBe("8v8 · 2 rolling subs each · 1 floater");
    expect(formatLabel(f(18, 9))).toBe("9v9");
    expect(() => f(5)).toThrow(DrawError);
  });

  it("D09 verifyDraw re-runs the seed; any tampering fails verification", () => {
    const d = drawTeams({ attendees: [...people(14), "savi"], constraints: C(), seed: generateSeed(), isDropIn });
    expect(verifyDraw(d, isDropIn)).toEqual({ ok: true });
    const swapped = { ...d, teamA: [...d.teamA.slice(1), d.teamB[0]], teamB: [d.teamA[0], ...d.teamB.slice(1)] };
    expect(verifyDraw(swapped, isDropIn).ok).toBe(false);
  });

  it("D10 seeded integers are unbiased (rough uniformity check)", () => {
    const rng = new SeededRandom(SEED, 0);
    const buckets = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 70_000; i++) buckets[rng.int(7)]++;
    for (const b of buckets) expect(Math.abs(b - 10_000)).toBeLessThan(500);
  });

  it("D11 contradictory or impossible constraints fail loudly", () => {
    expect(() =>
      drawTeams({ attendees: people(8), constraints: C({ keepTogether: [["p00", "p01"]], keepApart: [["p01", "p00"]] }), seed: SEED, isDropIn }),
    ).toThrow(/both together and apart/);
    expect(() =>
      drawTeams({
        attendees: people(6),
        constraints: C({ keepApart: [["p00", "p01"], ["p01", "p02"], ["p00", "p02"]] }),
        seed: SEED,
        isDropIn,
      }),
    ).toThrow(/No split satisfies/);
  });
});
