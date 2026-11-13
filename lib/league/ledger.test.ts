import { describe, expect, it } from "vitest";
import { verifyDraw } from "@/lib/draw/draw";
import { isDropIn } from "@/config/club";
import { buildStandings } from "@/lib/scoring/rules";
import {
  DEFAULT_CONSTRAINTS,
  LedgerError,
  createMatchDay,
  deleteMatchDay,
  initialState,
  recordDraw,
  rulesFrom,
  saveScorecard,
  setAttendance,
  setSquad,
  signUp,
  updateSettings,
  type Ctx,
} from "./ledger";
import type { GoalEvent, LeagueState } from "./types";

let idn = 0;
const at = (iso: string): Ctx => ({ now: new Date(iso), newId: () => `id${++idn}` });
const SQUAD = ["navneet", "archit", "vikram", "ghous", "danish", "danial", "karminder", "vineet", "gurinder", "raunak", "sanjeev", "jedi", "tadas", "jaskaran", "gurnaam", "savi"];
const SEED = "b".repeat(64);

function played(state: LeagueState, date: string, events: (teams: { A: string[]; B: string[] }) => GoalEvent[]) {
  const c = createMatchDay(state, { date, attendees: SQUAD }, at(`${date}T09:00:00Z`));
  let s = recordDraw(c.state, c.match.id, DEFAULT_CONSTRAINTS, at(`${date}T09:30:00Z`), SEED);
  const d = s.matchDays.find((m) => m.id === c.match.id)!.draw!;
  s = saveScorecard(s, c.match.id, events({ A: d.teamA, B: d.teamB }), {}, at(`${date}T12:00:00Z`));
  return { state: s, id: c.match.id, teams: { A: d.teamA, B: d.teamB } };
}
const goal = (id: string, scorerId: string, side: "A" | "B", assistId?: string): GoalEvent => ({ id, kind: "open_play", side, scorerId, assistId });

describe("match-day lifecycle", () => {
  it("L01 Pick 7 squads: exactly 7 different roster players; snapshotted into the match at the draw", () => {
    const c = createMatchDay(initialState(), { date: "2026-05-01", attendees: SQUAD }, at("2026-04-30T10:00:00Z"));
    const u = signUp(c.state, { email: "a@b.co", name: "Sanjeev", passwordHash: "x" }, at("2026-04-30T10:01:00Z"));
    const uid = u.user.id;
    expect(() => setSquad(u.state, uid, SQUAD.slice(0, 6), at("2026-04-30T11:00:00Z"))).toThrow(LedgerError);
    expect(() => setSquad(u.state, uid, [...SQUAD.slice(0, 6), "messi"], at("2026-04-30T11:00:00Z"))).toThrow(/unknown/);
    expect(() => setSquad(u.state, uid, [...SQUAD.slice(0, 6), SQUAD[0]], at("2026-04-30T11:00:00Z"))).toThrow(/different/);
    const A = ["archit", "danial", "navneet", "raunak", "ghous", "vikram", "karminder"];
    const B = ["archit", "vineet", "navneet", "raunak", "ghous", "vikram", "karminder"];
    expect(() => setSquad(u.state, uid, SQUAD.slice(0, 7), at("2026-04-30T11:00:00Z"))).toThrow(/isn't valid/);
    let s = setSquad(u.state, uid, A, at("2026-04-30T11:00:00Z"));
    s = setSquad(s, uid, B, at("2026-04-30T11:05:00Z"));
    expect(s.audit.filter((a) => a.action === "squad.update")).toHaveLength(2);
    s = recordDraw(s, c.match.id, DEFAULT_CONSTRAINTS, at("2026-05-01T09:00:00Z"), SEED);
    expect(s.matchDays[0].selections).toEqual([{ selectorId: uid, picks: B, submittedAt: "2026-04-30T11:05:00.000Z" }]);
  });

  it("L02 attendance locks at the draw; recorded draws verify", () => {
    const c = createMatchDay(initialState(), { date: "2026-05-01", attendees: SQUAD }, at("2026-04-30T10:00:00Z"));
    const s = recordDraw(c.state, c.match.id, DEFAULT_CONSTRAINTS, at("2026-05-01T09:00:00Z"));
    expect(() => setAttendance(s, c.match.id, SQUAD.slice(0, 10), at("2026-05-01T09:01:00Z"))).toThrow(/locked/);
    expect(verifyDraw(s.matchDays[0].draw!, isDropIn).ok).toBe(true);
  });

  it("L03 a match with a scorecard can't be deleted", () => {
    const p = played(initialState(), "2026-05-01", (t) => [goal("g1", t.A[0], "A")]);
    expect(() => deleteMatchDay(p.state, p.id, at("2026-05-02T00:00:00Z"))).toThrow(/correct it instead/);
  });

  it("L04 scorecard errors block saving", () => {
    const c = createMatchDay(initialState(), { date: "2026-05-01", attendees: SQUAD }, at("2026-04-30T10:00:00Z"));
    const s = recordDraw(c.state, c.match.id, DEFAULT_CONSTRAINTS, at("2026-05-01T09:00:00Z"), SEED);
    expect(() => saveScorecard(s, c.match.id, [goal("g1", "robin", "A")], {}, at("2026-05-01T12:00:00Z"))).toThrow(/errors/);
  });
});

describe("corrections", () => {
  it("R26 correcting a scorecard recalculates standings and keeps the old version in the audit log", () => {
    const p = played(initialState(), "2026-05-01", (t) => [goal("g1", t.A[0], "A", t.A[1])]);
    const [scorer, assister] = [p.teams.A[0], p.teams.A[1]];
    const before = buildStandings(p.state.matchDays, SQUAD, rulesFrom(p.state.settings));
    expect(before.find((r) => r.playerId === scorer)!.points).toBe(5);

    // Ruling changed: it was actually a solo goal by the "assister".
    const s2 = saveScorecard(p.state, p.id, [goal("g1", assister, "A")], { reason: "Video shows a solo run" }, at("2026-05-03T10:00:00Z"));
    const after = buildStandings(s2.matchDays, SQUAD, rulesFrom(s2.settings));
    expect(after.find((r) => r.playerId === scorer)!.points).toBe(0);
    expect(after.find((r) => r.playerId === assister)!.points).toBe(5);

    const entry = s2.audit.at(-1)!;
    expect(entry).toMatchObject({ action: "scorecard.correct", reason: "Video shows a solo run" });
    expect(entry.before).toEqual({ version: 1, events: [goal("g1", scorer, "A", assister)] });
    expect(s2.matchDays[0].scorecardVersion).toBe(2);
    expect(s2.matchDays[0].scorecardAt).toBe(p.state.matchDays[0].scorecardAt); // window doesn't restart
  });

  it("R27 corrections need a reason and must be inside the correction window", () => {
    const p = played(initialState(), "2026-05-01", (t) => [goal("g1", t.A[0], "A")]);
    expect(() => saveScorecard(p.state, p.id, [], {}, at("2026-05-02T00:00:00Z"))).toThrow(/reason/);
    expect(() => saveScorecard(p.state, p.id, [], { reason: "late" }, at("2026-05-09T12:00:01Z"))).toThrow(/window/);
    expect(() => saveScorecard(p.state, p.id, [], { reason: "on time" }, at("2026-05-08T12:00:00Z"))).not.toThrow();
    const wider = updateSettings(p.state, { correctionWindowDays: 30 }, at("2026-05-09T00:00:00Z"));
    expect(() => saveScorecard(wider, p.id, [], { reason: "ok now" }, at("2026-05-20T00:00:00Z"))).not.toThrow();
  });

  it("R28 editing an OLD match re-ranks the season and changes later form", () => {
    let p = played(initialState(), "2026-05-01", (t) => [goal("g1", t.A[0], "A")]);
    const early = { id: p.id, teams: p.teams };
    const p2 = played(p.state, "2026-05-08", (t) => [goal("g2", t.B[0], "B"), goal("g3", t.B[0], "B")]);
    const lead = p2.teams.B[0];
    let table = buildStandings(p2.state.matchDays, SQUAD);
    expect(table[0].playerId).toBe(lead);

    // Correct match 1 (inside its window): early.teams.A[0] actually scored 3.
    const fixed = saveScorecard(
      p2.state,
      early.id,
      [goal("g1", early.teams.A[0], "A"), goal("g1b", early.teams.A[0], "A"), goal("g1c", early.teams.A[0], "A")],
      { reason: "Missed two goals" },
      at("2026-05-08T11:30:00Z"),
    );
    table = buildStandings(fixed.matchDays, SQUAD);
    const top = table[0];
    expect(top.points).toBe(15 + (top.playerId === lead ? 10 : 0));
    expect(top.form[0]).toBe(15);
    p = { ...p, state: fixed };
    expect(p.state.audit.filter((a) => a.action.startsWith("scorecard"))).toHaveLength(3);
  });

  it("R31 settings changes recalculate everything (second assist toggle) and are audited", () => {
    const p = played(initialState(), "2026-05-01", (t) => [
      { id: "g1", kind: "open_play", side: "A", scorerId: t.A[0], assistId: t.A[1], secondAssistId: t.A[2] },
    ]);
    const third = p.teams.A[2];
    expect(buildStandings(p.state.matchDays, SQUAD, rulesFrom(p.state.settings)).find((r) => r.playerId === third)!.points).toBe(0);
    const on = updateSettings(p.state, { secondAssistEnabled: true }, at("2026-05-02T00:00:00Z"));
    expect(buildStandings(on.matchDays, SQUAD, rulesFrom(on.settings)).find((r) => r.playerId === third)!.points).toBe(1);
    expect(on.audit.at(-1)!.action).toBe("settings.update");
  });
});
