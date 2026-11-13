/** Win bonus, rotation penalty, required rotation check, and the points breakdown adding up. */
import { describe, expect, it } from "vitest";
import { POINTS_V2, matchItems, scoreMatch, scoreSelection, winnerOf } from "@/lib/scoring/rules";
import {
  DEFAULT_CONSTRAINTS,
  LedgerError,
  createMatchDay,
  initialState,
  recordDraw,
  rulesFrom,
  saveScorecard,
  setSquad,
  signUp,
  type Ctx,
} from "./ledger";
import { buildPick7Table, selectorBreakdown } from "./pick7Table";
import type { GoalEvent, LeagueState } from "./types";

let n = 0;
const at = (iso: string): Ctx => ({ now: new Date(iso), newId: () => `wr-${++n}` });
const SEED = "c".repeat(64);
const SEVEN = ["archit", "danial", "navneet", "raunak", "ghous", "vikram", "karminder"];
const ALT = ["vineet", "jaskaran", "sanjeev", "jedi", "danish", "harpreet", "nakul"];

const draw = { teamA: ["vikram", "robin", "archit"], teamB: ["tadas", "nakul", "jedi"], floater: "ghous" };
const base = { attendees: [...draw.teamA, ...draw.teamB, draw.floater], rulesVersion: 2 as const, draw, motm: { A: null, B: null } };
const goal = (side: "A" | "B", scorerId: string, assistId?: string): GoalEvent => ({ id: `g${++n}`, side, kind: "open_play", scorerId, assistId });

describe("winning team bonus", () => {
  it("W01 +3 to every player on the winning side (subs included), +2 to the floater, 0 to the losers", () => {
    const lines = scoreMatch({ ...base, events: [goal("A", "vikram"), goal("A", "robin"), goal("B", "nakul")] });
    for (const id of draw.teamA) expect(lines.get(id)!.wins).toBe(1);
    expect(lines.get("archit")!.points).toBe(POINTS_V2.win + POINTS_V2.fairPlay);
    expect(lines.get("tadas")!.points).toBe(POINTS_V2.fairPlay);
    expect(lines.get("ghous")!.points).toBe(POINTS_V2.floaterWin + POINTS_V2.fairPlay);
    expect(lines.get("ghous")!.wins).toBe(1);
  });

  it("W02 own goals decide the result like any goal", () => {
    expect(winnerOf({ events: [goal("A", "vikram"), { id: "og", side: "B", kind: "own_goal", scorerId: "robin" }, { id: "og2", side: "B", kind: "own_goal", scorerId: "archit" }] })).toBe("B");
  });

  it("W03 draw or no result: nobody gets the win bonus, everything else still counts", () => {
    const drawn = scoreMatch({ ...base, events: [goal("A", "vikram"), goal("B", "nakul")] });
    expect([...drawn.values()].every((l) => l.wins === 0)).toBe(true);
    const abandoned = scoreMatch({ ...base, noResult: true, events: [goal("A", "vikram")], motm: { A: "vikram", B: "tadas" } });
    expect(abandoned.get("vikram")).toMatchObject({ wins: 0, goals: 1, motm: 1, points: 3 + 4 + 1 });
  });

  it("W04 a player who didn't turn up gets nothing, even if their side won", () => {
    const lines = scoreMatch({ ...base, attendees: base.attendees.filter((x) => x !== "archit"), events: [goal("A", "vikram")] });
    expect(lines.has("archit")).toBe(false);
    expect(scoreSelection({ selectorId: "u", picks: ["archit"] }, { ...base, id: "m", attendees: base.attendees.filter((x) => x !== "archit"), events: [goal("A", "vikram")] }).points).toBe(0);
  });

  it("W05 v1 matches never get a win bonus", () => {
    const lines = scoreMatch({ ...base, rulesVersion: 1, events: [goal("A", "vikram")] });
    expect(lines.get("archit")!.points).toBe(0);
  });
});

describe("rotation", () => {
  it("R01 a missed GK or sub stint is −2 to that player, and so to every selector who picked them", () => {
    const m = { ...base, id: "m", events: [], rotationMissed: [{ playerId: "vikram", reason: "gk" as const }] };
    const lines = scoreMatch(m);
    expect(lines.get("vikram")).toMatchObject({ rotationMissed: 1, points: POINTS_V2.fairPlay + POINTS_V2.rotationMiss });
    expect(scoreSelection({ selectorId: "u", picks: ["vikram", "robin"] }, m).points).toBe(-1 + 1);
    expect(matchItems(m).get("vikram")!.find((i) => i.kind === "rotation")!.detail).toBe("Skipped GK turn");
  });

  it("R02 a v2 scorecard can't be published until rotation is confirmed; misses are stored and audited", () => {
    let s: LeagueState = initialState();
    const c = createMatchDay(s, { date: "2026-11-19", attendees: [...SEVEN, ...ALT] }, at("2026-11-12T00:00:00Z"));
    s = recordDraw(c.state, c.match.id, DEFAULT_CONSTRAINTS, at("2026-11-19T20:00:00Z"), SEED);
    const d = s.matchDays[0].draw!;
    const motm = { A: d.teamA[0], B: d.teamB[0] };
    expect(() => saveScorecard(s, c.match.id, [], { motm }, at("2026-11-20T04:00:00Z"))).toThrow(LedgerError);
    expect(() =>
      saveScorecard(s, c.match.id, [], { motm, rotationChecked: true, rotationMissed: [{ playerId: "inder", reason: "gk" }] }, at("2026-11-20T04:00:00Z")),
    ).toThrow(LedgerError); // inder didn't attend
    s = saveScorecard(s, c.match.id, [], { motm, rotationChecked: true, rotationMissed: [{ playerId: d.teamA[1], reason: "sub" }] }, at("2026-11-20T04:00:00Z"));
    expect(s.matchDays[0]).toMatchObject({ rotationChecked: true, rotationMissed: [{ playerId: d.teamA[1], reason: "sub" }], noResult: false });
    expect(s.audit.at(-1)!.after).toMatchObject({ rotationMissed: [{ playerId: d.teamA[1], reason: "sub" }] });
  });
});

describe("points breakdown", () => {
  it("B01 every selector's breakdown adds up to their table points, round by round and by source", () => {
    let s: LeagueState = initialState();
    const ids: string[] = [];
    for (const [i, team] of [SEVEN, ALT].entries()) {
      const r = signUp(s, { email: `b${i}@x.co`, name: `B${i}`, passwordHash: "h" }, at("2026-11-12T00:00:00Z"));
      s = setSquad(r.state, r.user.id, team, at("2026-11-13T00:00:00Z"));
      ids.push(r.user.id);
    }
    const c = createMatchDay(s, { date: "2026-11-19", attendees: [...SEVEN, ...ALT] }, at("2026-11-12T00:00:00Z"));
    s = recordDraw(c.state, c.match.id, DEFAULT_CONSTRAINTS, at("2026-11-19T20:00:00Z"), SEED);
    const d = s.matchDays[0].draw!;
    const events: GoalEvent[] = [goal("A", d.teamA[0], d.teamA[1]), goal("A", d.teamA[2]), goal("B", d.teamB[0])];
    s = saveScorecard(
      s,
      c.match.id,
      events,
      { motm: { A: d.teamA[0], B: d.teamB[1] }, rotationChecked: true, rotationMissed: [{ playerId: d.teamB[2], reason: "gk" }], fairPlayLost: [{ playerId: d.teamA[3], reason: "foul" }] },
      at("2026-11-20T04:00:00Z"),
    );
    const rules = rulesFrom(s.settings);
    const table = buildPick7Table(s, rules);
    for (const id of ids) {
      const b = selectorBreakdown(s, rules, id);
      const row = table.find((r) => r.id === id)!;
      expect(b.total).toBe(row.points);
      expect(Object.values(b.byKind).reduce((a, x) => a + (x ?? 0), 0)).toBe(row.points);
      expect(b.rounds[0].picks.reduce((a, p) => a + p.total, 0)).toBe(b.rounds[0].total);
      expect(b.rounds[0].result).toBe("White 2–1 Red");
    }
    // White won: someone's breakdown shows a 🏆 line with the score.
    const all = ids.flatMap((id) => selectorBreakdown(s, rules, id).rounds[0].picks.flatMap((p) => p.items));
    expect(all.some((i) => i.kind === "win" && i.detail === "White won 2–1")).toBe(true);
  });
});
