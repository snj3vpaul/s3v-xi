import { describe, expect, it } from "vitest";
import { SCORING_RULES, type ScoringRules } from "./config";
import { buildStandings, computeAchievements, isValidGoals, longestHitStreak, outcomeOf, rankUsers, scorePick, type LedgerEntry, type ScoredPick } from "./scoring";

const s = (home: number, away: number) => ({ home, away });

describe("scorePick", () => {
  it("awards 3 for an exact scoreline", () => expect(scorePick(s(2, 1), s(2, 1))).toEqual({ points: 3, reason: "exact", bonuses: [] }));
  it("awards 1 for the right outcome with the wrong score", () => {
    expect(scorePick(s(3, 0), s(1, 0)).reason).toBe("outcome");
    expect(scorePick(s(0, 2), s(1, 4)).points).toBe(1);
    expect(scorePick(s(1, 1), s(2, 2))).toMatchObject({ points: 1, reason: "outcome" });
  });
  it("awards 0 for the wrong outcome", () => {
    expect(scorePick(s(1, 0), s(0, 1))).toMatchObject({ points: 0, reason: "miss" });
    expect(scorePick(s(1, 1), s(1, 0))).toMatchObject({ points: 0, reason: "miss" });
  });
  it("exact 0-0 is exact, not just a draw", () => expect(scorePick(s(0, 0), s(0, 0)).points).toBe(3));
  it("uses configurable rules and bonuses", () => {
    const rules: ScoringRules = {
      ...SCORING_RULES, exact: 5, outcome: 2,
      bonuses: [{ id: "clean", label: "Clean sheet", points: 1, onlyWhen: ["outcome", "exact"], applies: (p, r) => p.away === 0 && r.away === 0 }],
    };
    expect(scorePick(s(2, 0), s(2, 0), rules)).toEqual({ points: 6, reason: "exact", bonuses: ["clean"] });
    expect(scorePick(s(3, 0), s(1, 0), rules)).toEqual({ points: 3, reason: "outcome", bonuses: ["clean"] });
    expect(scorePick(s(0, 0), s(1, 0), rules).points).toBe(0);
  });
  it("outcomeOf", () => { expect(outcomeOf(s(2, 1))).toBe("home"); expect(outcomeOf(s(0, 3))).toBe("away"); expect(outcomeOf(s(2, 2))).toBe("draw"); });
  it("validates goal inputs", () => {
    expect(isValidGoals(0, 20)).toBe(true);
    expect(isValidGoals(21, 20)).toBe(false);
    expect(isValidGoals(-1, 20)).toBe(false);
    expect(isValidGoals(1.5, 20)).toBe(false);
    expect(isValidGoals("2", 20)).toBe(false);
  });
});

const users = [
  { id: "a", name: "Ana", avatar: "🦊" }, { id: "b", name: "Ben", avatar: "🐙" },
  { id: "c", name: "Cy", avatar: "🦁" }, { id: "d", name: "Di", avatar: "🐝" },
];
const e = (userId: string, roundId: string, reason: "exact" | "outcome" | "miss", fixtureId = `${roundId}-${userId}-${Math.random()}`): LedgerEntry =>
  ({ userId, roundId, fixtureId, reason, points: SCORING_RULES[reason] });

describe("standings", () => {
  it("shares rank on equal points (1-2-2-4)", () => {
    const ledger = [e("a", "r1", "exact"), e("b", "r1", "outcome"), e("c", "r1", "outcome")];
    const ranked = rankUsers(users, ledger);
    expect(ranked.map((r) => [r.id, r.rank])).toEqual([["a", 1], ["b", 2], ["c", 2], ["d", 4]]);
    expect(ranked.find((r) => r.id === "b")!.tied).toBe(true);
    expect(ranked.find((r) => r.id === "a")!.tied).toBe(false);
  });
  it("orders ties by exact hits but keeps the shared rank", () => {
    const ledger = [e("a", "r1", "exact"), e("b", "r1", "outcome"), e("b", "r1", "outcome"), e("b", "r1", "outcome")];
    const ranked = rankUsers(users, ledger);
    expect(ranked[0].id).toBe("a"); expect(ranked[0].rank).toBe(1); expect(ranked[1].rank).toBe(1);
  });
  it("computes movement since the previous scored round and per-round breakdown", () => {
    const rounds = [{ id: "r1", name: "MW1" }, { id: "r2", name: "MW2" }, { id: "r3", name: "MW3" }];
    const ledger = [e("a", "r1", "exact"), e("b", "r1", "miss"), e("b", "r2", "exact"), e("b", "r2", "exact")];
    const rows = buildStandings(users, rounds, ledger);
    const b = rows.find((r) => r.id === "b")!, a = rows.find((r) => r.id === "a")!;
    expect(b.rank).toBe(1); expect(b.previousRank).toBe(2); expect(b.movement).toBe(1);
    expect(a.movement).toBe(-1);
    expect(b.perRound).toEqual({ r1: 0, r2: 6 });
    expect(b.played).toBe(3);
  });
  it("has no movement with only one scored round", () => {
    const rows = buildStandings(users, [{ id: "r1", name: "MW1" }], [e("a", "r1", "exact")]);
    expect(rows.every((r) => r.movement === null)).toBe(true);
  });
  it("ignores ledger rows for users not in the list (removed members)", () => {
    const rows = rankUsers(users, [e("zzz", "r1", "exact")]);
    expect(rows.every((r) => r.total === 0 && r.rank === 1)).toBe(true);
  });
});

describe("achievements", () => {
  const p = (userId: string, i: number, pick: [number, number], result: [number, number], reason: ScoredPick["reason"]): ScoredPick =>
    ({ userId, fixtureId: `f${i}`, kickoffAt: `2026-01-${String(i).padStart(2, "0")}T12:00:00Z`, pick: s(...pick), result: s(...result), reason });
  it("streaks reset on a miss", () => {
    expect(longestHitStreak([p("a", 1, [1, 0], [1, 0], "exact"), p("a", 2, [1, 0], [2, 0], "outcome"), p("a", 3, [1, 0], [0, 1], "miss"), p("a", 4, [1, 1], [0, 0], "outcome")])).toBe(2);
  });
  it("awards titles to leaders, including ties", () => {
    const picks = [
      p("a", 1, [2, 1], [2, 1], "exact"), p("b", 1, [1, 0], [1, 0], "exact"),
      p("c", 1, [5, 1], [0, 1], "miss"),
      p("d", 1, [1, 1], [1, 1], "exact"), p("d", 2, [0, 0], [2, 2], "outcome"), p("d", 3, [2, 0], [1, 0], "outcome"),
    ];
    const got = computeAchievements(["a", "b", "c", "d"], picks);
    expect(got.a.map((x) => x.id)).toContain("oracle");
    expect(got.b.map((x) => x.id)).toContain("oracle");
    expect(got.c.map((x) => x.id)).toEqual(["optimist"]);
    expect(got.d.map((x) => x.id)).toEqual(expect.arrayContaining(["oracle", "consistent", "draw-whisperer"]));
  });
  it("withholds a title when more than three players share it", () => {
    const picks = ["a", "b", "c", "d"].map((u) => p(u, 1, [1, 0], [1, 0], "exact"));
    const got = computeAchievements(["a", "b", "c", "d"], picks);
    expect(Object.values(got).flat().map((x) => x.id)).not.toContain("oracle");
  });
  it("gives nothing when nobody qualifies", () => {
    expect(computeAchievements(["a"], [])).toEqual({ a: [] });
  });
});
