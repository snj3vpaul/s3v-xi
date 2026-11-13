/** Team sheet (captains pick sides; admin enters them) and Pick 7 locking at kick-off. */
import { describe, expect, it } from "vitest";
import {
  LedgerError,
  createMatchDay,
  initialState,
  lockedSelections,
  nextDeadlineMatch,
  saveScorecard,
  setSquad,
  setTeamSheet,
  signUp,
  type Ctx,
} from "./ledger";
import { parseTeamSheet } from "./teamSheet";
import type { LeagueState } from "./types";

let n = 0;
const at = (iso: string): Ctx => ({ now: new Date(iso), newId: () => `ts-${++n}` });
const WHITE = ["vikram", "robin", "archit", "tadas", "danial", "jedi", "ghous"];
const RED = ["nakul", "harpreet", "vineet", "sanjeev", "navneet", "danish", "jaskaran"];
const SEVEN = ["archit", "danial", "navneet", "raunak", "ghous", "vikram", "karminder"];
const ALT = ["vineet", "jaskaran", "sanjeev", "jedi", "danish", "harpreet", "nakul"];
// 2026-11-19 22:00 Toronto = 2026-11-20T03:00Z
const KICKOFF = "2026-11-20T03:00:00.000Z";

function setup() {
  let s: LeagueState = initialState();
  const r = signUp(s, { email: "a@x.co", name: "Ana", passwordHash: "h" }, at("2026-11-12T00:00:00Z"));
  s = setSquad(r.state, r.user.id, SEVEN, at("2026-11-13T00:00:00Z"));
  const c = createMatchDay(s, { date: "2026-11-19" }, at("2026-11-12T00:00:00Z"));
  return { s: c.state, uid: r.user.id, id: c.match.id };
}

describe("team sheet", () => {
  it("TS01 sets both teams and attendance; validates sides", () => {
    const { s, id } = setup();
    expect(() => setTeamSheet(s, id, { teamA: WHITE, teamB: [] }, at("2026-11-19T20:00:00Z"))).toThrow(/each team/);
    expect(() => setTeamSheet(s, id, { teamA: WHITE, teamB: ["vikram"] }, at("2026-11-19T20:00:00Z"))).toThrow(/both teams/);
    expect(() => setTeamSheet(s, id, { teamA: WHITE, teamB: ["nobody"] }, at("2026-11-19T20:00:00Z"))).toThrow(LedgerError);
    const t = setTeamSheet(s, id, { teamA: WHITE, teamB: RED }, at("2026-11-19T20:00:00Z"));
    const m = t.matchDays[0];
    expect(m).toMatchObject({ status: "drawn", attendees: [...WHITE, ...RED] });
    expect(m.draw).toMatchObject({ algorithm: "manual", teamA: WHITE, teamB: RED, floater: null });
    expect(t.audit.at(-1)).toMatchObject({ action: "teams.set", after: { teamA: WHITE, teamB: RED } });
  });

  it("TS02 posting teams early doesn't close Pick 7: picks stay open until kick-off", () => {
    const { s, id, uid } = setup();
    let t = setTeamSheet(s, id, { teamA: WHITE, teamB: RED }, at("2026-11-19T20:00:00Z"));
    expect(nextDeadlineMatch(t, new Date("2026-11-19T21:00:00Z"))?.id).toBe(id);
    expect(lockedSelections(t, t.matchDays[0], new Date("2026-11-19T21:00:00Z"))).toEqual([]);
    // A change after the teams are posted but before kick-off still counts.
    t = setSquad(t, uid, ALT, at("2026-11-19T23:00:00Z"));
    // After kick-off: locked as at kick-off; a later change doesn't count.
    t = setSquad(t, uid, SEVEN, at("2026-11-20T03:30:00Z"));
    expect(nextDeadlineMatch(t, new Date("2026-11-20T03:30:00Z"))?.id).not.toBe(id);
    expect(lockedSelections(t, t.matchDays[0], new Date("2026-11-20T03:30:00Z"))[0].picks).toEqual(ALT);
    t = saveScorecard(t, id, [], { motm: { A: "vikram", B: "nakul" }, rotationChecked: true }, at("2026-11-20T04:05:00Z"));
    expect(t.matchDays[0].selections[0]).toMatchObject({ selectorId: uid, picks: ALT });
    expect(t.matchDays[0].selections[0].submittedAt <= KICKOFF).toBe(true);
  });

  it("TS03 teams can be changed until the scorecard is in, then they're final", () => {
    const { s, id } = setup();
    let t = setTeamSheet(s, id, { teamA: WHITE, teamB: RED }, at("2026-11-19T20:00:00Z"));
    t = setTeamSheet(t, id, { teamA: [...WHITE, "karminder"], teamB: RED }, at("2026-11-19T21:00:00Z"));
    expect(t.matchDays[0].attendees).toContain("karminder");
    t = saveScorecard(t, id, [], { motm: { A: "vikram", B: "nakul" }, rotationChecked: true }, at("2026-11-20T04:05:00Z"));
    expect(() => setTeamSheet(t, id, { teamA: WHITE, teamB: RED }, at("2026-11-20T04:10:00Z"))).toThrow(/final/);
  });

  it("TS04 the scorecard needs a team sheet first", () => {
    const { s, id } = setup();
    expect(() => saveScorecard(s, id, [], { motm: { A: "vikram", B: "nakul" }, rotationChecked: true }, at("2026-11-20T04:05:00Z"))).toThrow(/team sheet/);
  });
});

describe("WhatsApp paste", () => {
  it("TS05 reads 'White' / 'Red' headers and roster names, ignoring emoji, numbering and case", () => {
    const { sides, unmatched } = parseTeamSheet(`⚪ WHITE team
1. Vikram
2) robin 🔥
Archit (GK)

🔴 Reds:
- Nakul
- Tadas, Sanjeev
Some random line`);
    expect(sides).toEqual({ vikram: "A", robin: "A", archit: "A", nakul: "B", tadas: "B", sanjeev: "B" });
    expect(unmatched).toEqual(["Some random line"]);
  });
});

describe("captain", () => {
  it("CAP01 the captain must be one of the seven; it's kept on the locked week and doubles that player's points", async () => {
    const { scoreMatch, scoreSelection } = await import("@/lib/scoring/rules");
    const { currentCaptain } = await import("./ledger");
    let { s, id, uid } = setup();
    expect(() => setSquad(s, uid, SEVEN, at("2026-11-14T00:00:00Z"), "nakul")).toThrow(/one of your seven/);
    s = setSquad(s, uid, SEVEN, at("2026-11-14T00:00:00Z"), "vikram");
    expect(currentCaptain(s.users[0])).toBe("vikram");
    // Changing only the captain is a real change.
    s = setSquad(s, uid, SEVEN, at("2026-11-15T00:00:00Z"), "archit");
    expect(currentCaptain(s.users[0])).toBe("archit");
    s = setTeamSheet(s, id, { teamA: WHITE, teamB: RED }, at("2026-11-19T20:00:00Z"));
    const goal = { id: "g1", side: "A" as const, kind: "open_play" as const, scorerId: "archit", assistId: "vikram" };
    s = saveScorecard(s, id, [goal], { motm: { A: "archit", B: "nakul" }, rotationChecked: true, rotationMissed: [{ playerId: "vikram", reason: "gk" }] }, at("2026-11-20T04:05:00Z"));
    const m = s.matchDays[0];
    expect(m.selections[0].captain).toBe("archit");
    const lines = scoreMatch(m);
    const archit = lines.get("archit")!.points; // goal 3 + MOTM 4 + win 3 + fair play 1 = 11
    expect(archit).toBe(11);
    const r = scoreSelection(m.selections[0], m);
    expect(r.captain).toBe("archit");
    expect(r.perPick.find((p) => p.playerId === "archit")).toMatchObject({ points: 22, captain: true });
    // Everyone else counts once — including penalties (Vikram: assist 2 + win 3 + fair play 1 − rotation 2 = 4).
    expect(r.perPick.find((p) => p.playerId === "vikram")).toMatchObject({ points: 4, captain: false });
  });

  it("CAP02 the breakdown shows the doubling as a 'Captain ×2' line and still adds up to the table", async () => {
    const { buildPick7Table, selectorBreakdown } = await import("./pick7Table");
    const { rulesFrom } = await import("./ledger");
    let { s, id, uid } = setup();
    s = setSquad(s, uid, SEVEN, at("2026-11-14T00:00:00Z"), "archit");
    s = setTeamSheet(s, id, { teamA: WHITE, teamB: RED }, at("2026-11-19T20:00:00Z"));
    s = saveScorecard(s, id, [{ id: "g1", side: "A", kind: "open_play", scorerId: "archit" }], { motm: { A: "archit", B: "nakul" }, rotationChecked: true }, at("2026-11-20T04:05:00Z"));
    const rules = rulesFrom(s.settings);
    const b = selectorBreakdown(s, rules, uid);
    const archit = b.rounds[0].picks.find((p) => p.playerId === "archit")!;
    expect(archit.captain).toBe(true);
    expect(archit.items.at(-1)).toMatchObject({ kind: "captain", points: 11 });
    expect(archit.total).toBe(22);
    expect(b.total).toBe(buildPick7Table(s, rules).find((r) => r.id === uid)!.points);
  });

  it("CAP03 an older seven with no captain still plays, without doubling; editing keeps the captain if still picked", async () => {
    const { currentCaptain } = await import("./ledger");
    let { s, uid } = setup(); // SEVEN saved with no captain
    expect(currentCaptain(s.users[0])).toBeNull();
    s = setSquad(s, uid, SEVEN, at("2026-11-14T00:00:00Z"), "vikram");
    s = setSquad(s, uid, SEVEN.map((x) => (x === "archit" ? "vineet" : x)), at("2026-11-15T00:00:00Z"));
    expect(currentCaptain(s.users[0])).toBe("vikram");
    s = setSquad(s, uid, SEVEN.map((x) => (x === "vikram" ? "harpreet" : x)), at("2026-11-16T00:00:00Z"));
    expect(currentCaptain(s.users[0])).toBeNull();
  });
});
