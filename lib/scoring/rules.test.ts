/**
 * Scoring rule tests. Every test name starts with its rule id; docs/SCORING.md
 * maps each rule in the brief to these ids.
 */
import { describe, expect, it } from "vitest";
import type { GoalEvent, MatchDay } from "@/lib/league/types";
import {
  DEFAULT_RULES,
  POINTS,
  buildSelectorStandings,
  buildStandings,
  computeAwards,
  rankStandings,
  scoreEvent,
  scoreMatch,
  scoreSelection,
  scoreline,
  validateScorecard,
  type ScoringRules,
  type StandingRow,
} from "./rules";

let n = 0;
const ev = (e: Partial<GoalEvent> & Pick<GoalEvent, "kind" | "scorerId">): GoalEvent => ({
  id: `e${++n}`,
  side: "A",
  ...e,
});
const match = (id: string, date: string, attendees: string[], events: GoalEvent[], extra: Partial<MatchDay> = {}): MatchDay => ({
  id,
  date,
  status: "played",
  attendees,
  draw: null,
  events,
  selections: [],
  kickoffAt: `${date}T22:00:00.000Z`,
  createdAt: `${date}T10:00:00.000Z`,
  scorecardAt: `${date}T12:00:00.000Z`,
  scorecardVersion: 1,
  ...extra,
});
const pts = (e: GoalEvent, rules: ScoringRules = DEFAULT_RULES) =>
  Object.fromEntries(
    scoreEvent(e, rules).contributions.reduce((m, c) => m.set(c.playerId, (m.get(c.playerId) ?? 0) + c.points), new Map<string, number>()),
  );
const ON: ScoringRules = { ...DEFAULT_RULES, secondAssistEnabled: true };

describe("point values", () => {
  it("R00 point table matches the brief", () => {
    expect(POINTS).toEqual({ goal: 5, assist: 3, ownGoal: -2, secondAssist: 1 });
    expect(DEFAULT_RULES).toEqual({ secondAssistEnabled: false, deflectionDefault: "own_goal" });
  });
});

describe("single events", () => {
  it("R01 goal scored by a field player: +5", () => {
    expect(pts(ev({ kind: "open_play", scorerId: "vikram" }))).toEqual({ vikram: 5 });
  });

  it("R02 assisted goal: scorer +5 AND assister +3", () => {
    expect(pts(ev({ kind: "open_play", scorerId: "vikram", assistId: "archit" }))).toEqual({ vikram: 5, archit: 3 });
  });

  it("R03 own goal: −2 to the player, not a goal for anyone, counts on the scoreboard for the other side", () => {
    const og = ev({ kind: "own_goal", scorerId: "ghous", side: "B" });
    expect(pts(og)).toEqual({ ghous: -2 });
    const line = scoreMatch({ attendees: ["ghous"], events: [og] }).get("ghous")!;
    expect(line).toMatchObject({ goals: 0, ownGoals: 1, points: -2 });
    expect(scoreline([og])).toEqual({ A: 0, B: 1 });
  });

  it("R04 assists (and second assists) recorded on an own goal earn nothing", () => {
    const r = scoreEvent(ev({ kind: "own_goal", scorerId: "ghous", assistId: "danish", secondAssistId: "danial" }), ON);
    expect(r.contributions).toEqual([expect.objectContaining({ playerId: "ghous", points: -2 })]);
    expect(r.ignored.join(" ")).toMatch(/own goal earn nothing/);
  });

  it("R05 deflection with no recorded ruling uses the default (own goal): deflector −2, shooter and assister 0", () => {
    const e = ev({ kind: "deflection", scorerId: "raunak", deflectedById: "tadas", assistId: "jedi" });
    expect(pts(e)).toEqual({ tadas: -2 });
  });

  it("R06 deflection ruled a goal: shooter +5, assister +3, deflector 0", () => {
    const e = ev({ kind: "deflection", scorerId: "raunak", deflectedById: "tadas", assistId: "jedi", deflectionRuling: "goal" });
    expect(pts(e)).toEqual({ raunak: 5, jedi: 3 });
  });

  it("R07 deflection: the admin-configurable default applies only when no ruling is recorded", () => {
    const goalDefault: ScoringRules = { ...DEFAULT_RULES, deflectionDefault: "goal" };
    const unruled = ev({ kind: "deflection", scorerId: "raunak", deflectedById: "tadas" });
    expect(pts(unruled, goalDefault)).toEqual({ raunak: 5 });
    const ruledOg = { ...unruled, deflectionRuling: "own_goal" as const };
    expect(pts(ruledOg, goalDefault)).toEqual({ tadas: -2 });
  });

  it("R08 second assist is OFF by default: recorded but earns nothing", () => {
    const r = scoreEvent(ev({ kind: "open_play", scorerId: "a", assistId: "b", secondAssistId: "c" }));
    expect(r.contributions.map((c) => c.playerId)).toEqual(["a", "b"]);
    expect(r.ignored).toContain("Second-assist rule is off.");
  });

  it("R09 second assist ON: +1, but never to the scorer/assister and never without an assist", () => {
    expect(pts(ev({ kind: "open_play", scorerId: "a", assistId: "b", secondAssistId: "c" }), ON)).toEqual({ a: 5, b: 3, c: 1 });
    expect(pts(ev({ kind: "open_play", scorerId: "a", assistId: "b", secondAssistId: "a" }), ON)).toEqual({ a: 5, b: 3 });
    expect(pts(ev({ kind: "open_play", scorerId: "a", secondAssistId: "c" }), ON)).toEqual({ a: 5 });
  });

  it("R10 solo goal: scorer +5, nobody gets assist points", () => {
    const r = scoreEvent(ev({ kind: "open_play", scorerId: "jaskaran" }));
    expect(r.contributions).toHaveLength(1);
    expect(pts(ev({ kind: "open_play", scorerId: "jaskaran", assistId: null }))).toEqual({ jaskaran: 5 });
  });

  it("R11 penalty: +5, no assist by default; an assist counts only when the admin records one", () => {
    expect(pts(ev({ kind: "penalty", scorerId: "robin" }))).toEqual({ robin: 5 });
    expect(pts(ev({ kind: "penalty", scorerId: "robin", assistId: "nakul" }))).toEqual({ robin: 5, nakul: 3 });
  });

  it("R12 direct free kick: +5, assists are never credited even if recorded", () => {
    const r = scoreEvent(ev({ kind: "free_kick", scorerId: "harpreet", assistId: "gurnaam" }), ON);
    expect(pts(ev({ kind: "free_kick", scorerId: "harpreet", assistId: "gurnaam" }))).toEqual({ harpreet: 5 });
    expect(r.ignored.join(" ")).toMatch(/free kicks have no assist/);
  });

  it("R13 header from a cross: ordinary goal + assist", () => {
    expect(pts(ev({ kind: "header", scorerId: "karminder", assistId: "vineet" }))).toEqual({ karminder: 5, vineet: 3 });
  });

  it("R13b a player cannot assist their own goal (scorer keeps +5 only)", () => {
    expect(pts(ev({ kind: "open_play", scorerId: "a", assistId: "a" }))).toEqual({ a: 5 });
  });
});

describe("match & season aggregation", () => {
  it("R14 a player who scores and assists in one match accumulates both", () => {
    const lines = scoreMatch({
      attendees: ["a", "b"],
      events: [ev({ kind: "open_play", scorerId: "a", assistId: "b" }), ev({ kind: "header", scorerId: "b", assistId: "a" })],
    });
    expect(lines.get("a")).toMatchObject({ goals: 1, assists: 1, points: 8 });
    expect(lines.get("b")).toMatchObject({ goals: 1, assists: 1, points: 8 });
  });

  it("R15 drop-ins score identical point values", () => {
    const lines = scoreMatch({
      attendees: ["savi", "navneet"],
      events: [ev({ kind: "open_play", scorerId: "savi", assistId: "navneet" }), ev({ kind: "open_play", scorerId: "navneet", assistId: "savi" })],
    });
    expect(lines.get("savi")!.points).toBe(lines.get("navneet")!.points);
  });

  it("R16 negative totals are allowed — nothing floors at zero", () => {
    const s = buildStandings(
      [match("m1", "2026-01-01", ["x"], [ev({ kind: "own_goal", scorerId: "x", side: "B" }), ev({ kind: "own_goal", scorerId: "x", side: "B" })])],
      ["x"],
    );
    expect(s[0]).toMatchObject({ playerId: "x", points: -4, ownGoals: 2 });
  });

  it("R16b attendees who don't score get a 0 line (played, not DNP); non-attendees don't", () => {
    const s = buildStandings([match("m1", "2026-01-01", ["a", "b"], [ev({ kind: "open_play", scorerId: "a" })])], ["a", "b", "c"]);
    const by = Object.fromEntries(s.map((r) => [r.playerId, r]));
    expect(by.b).toMatchObject({ played: 1, points: 0, perMatch: { m1: 0 } });
    expect(by.c).toMatchObject({ played: 0, perMatch: {} });
  });

  it("R29 only matches with status 'played' count", () => {
    const s = buildStandings(
      [
        match("m1", "2026-01-01", ["a"], [ev({ kind: "open_play", scorerId: "a" })]),
        match("m2", "2026-01-08", ["a"], [ev({ kind: "open_play", scorerId: "a" })], { status: "drawn" }),
      ],
      ["a"],
    );
    expect(s[0].points).toBe(5);
  });

  it("R30 form = last 5 played matches, oldest → newest", () => {
    const ms = [1, 2, 3, 4, 5, 6].map((i) =>
      match(`m${i}`, `2026-01-0${i}`, ["a"], Array.from({ length: i }, () => ev({ kind: "open_play", scorerId: "a" }))),
    );
    expect(buildStandings(ms, ["a"])[0].form).toEqual([10, 15, 20, 25, 30]);
  });
});

describe("tie-breaks", () => {
  const row = (playerId: string, points: number, goals: number, assists: number, perMatch: Record<string, number> = {}): StandingRow => ({
    playerId, points, goals, assists, perMatch, secondAssists: 0, ownGoals: 0, played: 0, form: [], rank: 0, sharedRank: false,
  });

  it("R17 level on points → more goals ranks higher", () => {
    const r = rankStandings([row("a", 10, 1, 2), row("b", 10, 2, 0)]);
    expect(r.map((x) => [x.playerId, x.rank])).toEqual([["b", 1], ["a", 2]]);
  });

  it("R18 level on points and goals → more assists ranks higher", () => {
    // Equal points & goals can happen via own goals / second assists.
    const r = rankStandings([row("a", 13, 2, 1), row("b", 13, 2, 2)]);
    expect(r.map((x) => [x.playerId, x.rank])).toEqual([["b", 1], ["a", 2]]);
  });

  it("R19 still level → head-to-head (points in matches both played)", () => {
    const a = row("a", 8, 1, 1, { m1: 8, m2: 0 });
    const b = row("b", 8, 1, 1, { m1: 0, m2: 3, m3: 5 });
    // Shared matches m1+m2: a 8, b 3 → a wins H2H.
    const r = rankStandings([b, a]);
    expect(r.map((x) => [x.playerId, x.rank, x.sharedRank])).toEqual([["a", 1, false], ["b", 2, false]]);
  });

  it("R20 head-to-head can't separate (cycle or never met) → shared rank, competition numbering 1,2,2,4", () => {
    const top = row("top", 20, 4, 0);
    const x = row("x", 8, 1, 1, { m1: 8 });
    const y = row("y", 8, 1, 1, { m2: 8 }); // never played together with x
    const last = row("last", 1, 0, 0);
    const r = rankStandings([last, y, x, top]);
    expect(r.map((q) => [q.playerId, q.rank, q.sharedRank])).toEqual([
      ["top", 1, false],
      ["x", 2, true],
      ["y", 2, true],
      ["last", 4, false],
    ]);
  });

  it("R20b three-way rock-paper-scissors H2H → all three share", () => {
    const a = row("a", 6, 0, 2, { ab: 3, ca: 0 });
    const b = row("b", 6, 0, 2, { ab: 0, bc: 3 });
    const c = row("c", 6, 0, 2, { bc: 0, ca: 3 });
    const r = rankStandings([a, b, c]);
    expect(r.every((q) => q.rank === 1 && q.sharedRank)).toBe(true);
  });
});

describe("selections (pick 7)", () => {
  const m = match(
    "m1",
    "2026-02-01",
    ["a", "b", "c", "d", "e", "f", "g", "h"],
    [
      ev({ kind: "open_play", scorerId: "a", assistId: "b", side: "A" }),
      ev({ kind: "header", scorerId: "c", assistId: "d", side: "B" }),
      ev({ kind: "own_goal", scorerId: "e", side: "A" }),
    ],
  );

  it("R21 selector earns their picks' match points whichever team they were drawn on; DNP picks earn 0; own goals aren't hits", () => {
    const r = scoreSelection({ selectorId: "z", picks: ["a", "b", "c", "d", "e", "f", "zz"] }, m);
    expect(r.points).toBe(5 + 3 + 5 + 3 - 2 + 0 + 0);
    expect(r.hits).toBe(4);
    expect(r.picksPlayed).toBe(6);
    expect(r.perPick.find((p) => p.playerId === "zz")).toEqual({ playerId: "zz", points: 0, hit: false, played: false });
  });

  it("R22 selector season table: points, hits, hit rate; ties on points+hits share a rank", () => {
    const withSel = {
      ...m,
      selections: [
        { selectorId: "s1", picks: ["a", "b", "c", "d", "f", "g", "h"], submittedAt: "" },
        { selectorId: "s2", picks: ["a", "b", "c", "d", "g", "f", "h"], submittedAt: "" },
        { selectorId: "s3", picks: ["e", "f", "g", "h", "x1", "x2", "x3"], submittedAt: "" },
      ],
    };
    const t = buildSelectorStandings([withSel]);
    expect(t.map((r) => [r.selectorId, r.points, r.hits, r.rank, r.sharedRank])).toEqual([
      ["s1", 16, 4, 1, true],
      ["s2", 16, 4, 1, true],
      ["s3", -2, 0, 3, false],
    ]);
    expect(t[0].hitRate).toBeCloseTo(4 / 7);
  });
});

describe("awards", () => {
  it("R23 drop-ins can be excluded from season awards (they stay on the leaderboard); co-winners on ties", () => {
    const ms = [
      match("m1", "2026-03-01", ["savi", "a", "b"], [
        ev({ kind: "open_play", scorerId: "savi" }),
        ev({ kind: "open_play", scorerId: "savi" }),
        ev({ kind: "open_play", scorerId: "a", assistId: "b" }),
        ev({ kind: "open_play", scorerId: "b", assistId: "a" }),
      ]),
    ];
    const st = buildStandings(ms, ["savi", "a", "b"]);
    const isDropIn = (id: string) => id === "savi";
    const incl = computeAwards(st, [], { excludeDropIns: false, isDropIn });
    const excl = computeAwards(st, [], { excludeDropIns: true, isDropIn });
    expect(incl.find((a) => a.key === "golden_boot")!.winners).toEqual(["savi"]);
    expect(excl.find((a) => a.key === "golden_boot")!.winners.sort()).toEqual(["a", "b"]);
    expect(st.some((r) => r.playerId === "savi")).toBe(true);
    expect(incl.find((a) => a.key === "oracle")!.winners).toEqual([]);
  });
});

describe("scorecard validation", () => {
  const ctx = {
    knownPlayers: new Set(["a", "b", "c", "d", "e"]),
    attendees: ["a", "b", "c", "d"],
    teamA: ["a", "b"],
    teamB: ["c", "d"],
    floater: null,
  };
  const levels = (events: GoalEvent[]) => validateScorecard(events, ctx).map((i) => i.level);

  it("R24 errors block saving: self-assist, unknown player, non-attendee, second assist without assist, deflection without deflector, duplicate ids", () => {
    expect(levels([ev({ kind: "open_play", scorerId: "a", assistId: "a" })])).toContain("error");
    expect(levels([ev({ kind: "open_play", scorerId: "nobody" })])).toContain("error");
    expect(levels([ev({ kind: "open_play", scorerId: "e" })])).toContain("error"); // on roster, didn't attend
    expect(levels([ev({ kind: "open_play", scorerId: "a", secondAssistId: "b" })])).toContain("error");
    expect(levels([ev({ kind: "deflection", scorerId: "a" })])).toContain("error");
    const dup = ev({ kind: "open_play", scorerId: "a" });
    expect(levels([dup, { ...dup }])).toContain("error");
  });

  it("R25 warnings allow saving: assist on own goal / free kick, wrong side, second assist while rule off", () => {
    expect(levels([ev({ kind: "own_goal", scorerId: "c", side: "A", assistId: "d" })])).toEqual(["warning"]);
    expect(levels([ev({ kind: "free_kick", scorerId: "a", side: "A", assistId: "b" })])).toEqual(["warning"]);
    expect(levels([ev({ kind: "open_play", scorerId: "c", side: "A" })])).toEqual(["warning"]);
    expect(levels([ev({ kind: "own_goal", scorerId: "a", side: "A" })])).toEqual(["warning"]);
    expect(levels([ev({ kind: "open_play", scorerId: "a", assistId: "b", secondAssistId: "c", side: "A" })])).toContain("warning");
    expect(levels([ev({ kind: "open_play", scorerId: "a", assistId: "b", side: "A" })])).toEqual([]);
  });
});
