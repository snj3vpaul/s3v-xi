/** The live Pick 7 table: no pick vs picked-on-0, edits, removal, ranking and optimistic updates. */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONSTRAINTS,
  clearSquad,
  createMatchDay,
  currentSquad,
  initialState,
  recordDraw,
  rulesFrom,
  saveScorecard,
  setSquad,
  signUp,
  type Ctx,
} from "./ledger";
import { applyOptimistic, buildPick7Table, rankPick7, type Pick7Row } from "./pick7Table";
import type { LeagueState, User } from "./types";

let n = 0;
const at = (iso: string): Ctx => ({ now: new Date(iso), newId: () => `t7-${++n}` });
const SEED = "b".repeat(64);
const SEVEN = ["archit", "danial", "navneet", "raunak", "ghous", "vikram", "karminder"];
const ALT = ["vineet", "jaskaran", "sanjeev", "jedi", "danish", "harpreet", "nakul"];
const ATTEND = [...SEVEN, ...ALT, "gurnaam", "tadas"];

function league(names: string[]) {
  let s: LeagueState = initialState();
  const ids: Record<string, string> = {};
  for (const name of names) {
    const r = signUp(s, { email: `${name.toLowerCase()}@x.co`, name, passwordHash: "h" }, at("2026-11-12T00:00:00Z"));
    s = r.state;
    ids[name] = r.user.id;
  }
  return { s, ids };
}
const table = (s: LeagueState) => buildPick7Table(s, rulesFrom(s.settings));
const row = (s: LeagueState, id: string) => table(s).find((r) => r.id === id)!;

describe("Pick 7 table", () => {
  it("T01 no pick = not ranked, no points shown; a first pick = ranked on exactly 0", () => {
    let { s, ids } = league(["Ana", "Ben"]);
    expect(row(s, ids.Ana)).toMatchObject({ status: "no_pick", rank: null, points: 0, firstPickedAt: null });
    s = setSquad(s, ids.Ana, SEVEN, at("2026-11-13T10:00:00Z"));
    expect(row(s, ids.Ana)).toMatchObject({ status: "picked", rank: 1, points: 0, rounds: 0, firstPickedAt: "2026-11-13T10:00:00.000Z" });
    expect(row(s, ids.Ben).rank).toBeNull();
  });

  it("T02 ties on 0 are shared, listed by who picked first", () => {
    let { s, ids } = league(["Ana", "Ben", "Cal"]);
    s = setSquad(s, ids.Cal, SEVEN, at("2026-11-13T09:00:00Z"));
    s = setSquad(s, ids.Ana, ALT, at("2026-11-13T10:00:00Z"));
    const t = table(s);
    expect(t.map((r) => r.name)).toEqual(["Cal", "Ana", "Ben"]);
    expect(t.slice(0, 2).every((r) => r.rank === 1 && r.sharedRank)).toBe(true);
  });

  it("T03 edits before the deadline keep points at 0 and keep the original first-pick time", () => {
    let { s, ids } = league(["Ana"]);
    s = setSquad(s, ids.Ana, SEVEN, at("2026-11-13T10:00:00Z"));
    s = setSquad(s, ids.Ana, ALT, at("2026-11-15T10:00:00Z"));
    expect(row(s, ids.Ana)).toMatchObject({ status: "picked", points: 0, firstPickedAt: "2026-11-13T10:00:00.000Z" });
  });

  it("T04 points only arrive when a match they were locked into is played", () => {
    let { s, ids } = league(["Ana", "Ben"]);
    s = setSquad(s, ids.Ana, SEVEN, at("2026-11-13T10:00:00Z"));
    const c = createMatchDay(s, { date: "2026-11-19", attendees: ATTEND }, at("2026-11-12T00:00:00Z"));
    s = recordDraw(c.state, c.match.id, DEFAULT_CONSTRAINTS, at("2026-11-19T20:00:00Z"), SEED);
    expect(row(s, ids.Ana).points).toBe(0); // drawn, not played
    const d = s.matchDays[0].draw!;
    s = saveScorecard(s, c.match.id, [], { motm: { A: d.teamA[0], B: d.teamB[0] } }, at("2026-11-20T04:00:00Z"));
    // Everyone in SEVEN played (+1 fair play each), plus MOTM +4 for any of them.
    const motm = [d.teamA[0], d.teamB[0]].filter((x) => SEVEN.includes(x)).length;
    expect(row(s, ids.Ana)).toMatchObject({ rounds: 1, points: 7 + 4 * motm, rank: 1 });
    expect(row(s, ids.Ben).rank).toBeNull();
  });

  it("T05 removing a seven reverts to no pick; it isn't entered at the next draw; earned points stay", () => {
    let { s, ids } = league(["Ana"]);
    s = setSquad(s, ids.Ana, SEVEN, at("2026-11-13T10:00:00Z"));
    s = clearSquad(s, ids.Ana, at("2026-11-14T10:00:00Z"));
    const u = s.users[0];
    expect(currentSquad(u)).toBeNull();
    expect(row(s, ids.Ana)).toMatchObject({ status: "no_pick", rank: null });
    expect(s.audit.at(-1)).toMatchObject({ action: "squad.clear", before: SEVEN });
    expect(clearSquad(s, ids.Ana, at("2026-11-14T11:00:00Z"))).toBe(s); // nothing left to remove
    const c = createMatchDay(s, { date: "2026-11-19", attendees: ATTEND }, at("2026-11-12T00:00:00Z"));
    s = recordDraw(c.state, c.match.id, DEFAULT_CONSTRAINTS, at("2026-11-19T20:00:00Z"), SEED);
    expect(s.matchDays[0].selections).toEqual([]);
    // Picking again puts them straight back on 0.
    s = setSquad(s, ids.Ana, ALT, at("2026-11-20T10:00:00Z"));
    expect(row(s, ids.Ana)).toMatchObject({ status: "picked", points: 0, rank: 1 });
  });

  it("T06 a removed seven after a played round keeps its points and rank", () => {
    let { s, ids } = league(["Ana"]);
    s = setSquad(s, ids.Ana, SEVEN, at("2026-11-13T10:00:00Z"));
    const c = createMatchDay(s, { date: "2026-11-19", attendees: ATTEND }, at("2026-11-12T00:00:00Z"));
    s = recordDraw(c.state, c.match.id, DEFAULT_CONSTRAINTS, at("2026-11-19T20:00:00Z"), SEED);
    const d = s.matchDays[0].draw!;
    s = saveScorecard(s, c.match.id, [], { motm: { A: d.teamA[0], B: d.teamB[0] } }, at("2026-11-20T04:00:00Z"));
    const before = row(s, ids.Ana).points;
    s = clearSquad(s, ids.Ana, at("2026-11-21T10:00:00Z"));
    expect(row(s, ids.Ana)).toMatchObject({ status: "no_pick", points: before, rank: 1 });
  });

  it("T07 an old pre-formation seven shows as needs_fix but is still on the table", () => {
    let { s, ids } = league(["Ana"]);
    s = {
      ...s,
      users: s.users.map((u): User => ({ ...u, squadHistory: [{ picks: ["navneet", "archit", "vikram", "ghous", "danish", "danial", "karminder"], at: "2026-11-01T00:00:00.000Z" }] })),
    };
    expect(row(s, ids.Ana)).toMatchObject({ status: "needs_fix", rank: 1, points: 0 });
  });

  it("T08 optimistic: a save shows the user ranked on 0 instantly; a removal drops them; points never move", () => {
    const base: Pick7Row = { id: "", name: "", status: "no_pick", points: 0, rounds: 0, hits: 0, totalPicks: 0, firstPickedAt: null, rank: null, sharedRank: false };
    const rows = rankPick7([
      { ...base, id: "a", name: "Ana", status: "picked", points: 9, rounds: 1, firstPickedAt: "2026-11-01T00:00:00Z" },
      { ...base, id: "b", name: "Ben" },
    ]);
    const saved = applyOptimistic(rows, "b", "picked", "2026-11-13T10:00:00Z");
    expect(saved.find((r) => r.id === "b")).toMatchObject({ rank: 2, points: 0, status: "picked" });
    const removed = applyOptimistic(saved, "b", "no_pick", "2026-11-13T10:01:00Z");
    expect(removed.find((r) => r.id === "b")?.rank).toBeNull();
    expect(applyOptimistic(rows, "nobody", "picked", "x")).toBe(rows);
  });
});
