/** Pick 7 v2 (formation + star budget + ownership re-rating) and v2 scoring (MOTM, fair play). */
import { describe, expect, it } from "vitest";
import { FORMATION, PICK7, PICKABLE, ROSTER } from "@/config/club";
import { POINTS_V1, POINTS_V2, rulesVersionOf, scoreMatch, scoreSelection } from "@/lib/scoring/rules";
import {
  DEFAULT_CONSTRAINTS,
  LedgerError,
  createMatchDay,
  initialState,
  recordDraw,
  saveScorecard,
  setSquad,
  signUp,
  type Ctx,
} from "./ledger";
import { baseStars, checkTeam, currentStars, fitToFormation, isFormationValid, ownership } from "./pick7";
import { planReminders } from "./reminders";
import type { LeagueState, User } from "./types";

let n = 0;
const at = (iso: string): Ctx => ({ now: new Date(iso), newId: () => `p7-${++n}` });
const SEED = "a".repeat(64);
const SEVEN = ["archit", "danial", "navneet", "raunak", "ghous", "vikram", "karminder"];
const ALT = ["vineet", "jaskaran", "sanjeev", "jedi", "danish", "harpreet", "nakul"];
const ATTEND = [...SEVEN, ...ALT, "gurnaam", "tadas"];

function withUsers(count: number, s: LeagueState = initialState()) {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const r = signUp(s, { email: `u${i}@x.co`, name: `U${i}`, passwordHash: "h" }, at("2026-11-12T00:00:00Z"));
    s = r.state;
    ids.push(r.user.id);
  }
  return { s, ids };
}

describe("formation", () => {
  it("P01 the formation adds up to 7, and the 20 named players are pickable (Gurinder isn't)", () => {
    expect(Object.values(FORMATION).reduce((a, b) => a + b, 0)).toBe(7);
    expect(PICKABLE).toHaveLength(20);
    expect(PICKABLE.some((p) => p.id === "gurinder")).toBe(false);
    expect(ROSTER.find((p) => p.id === "gurinder")?.position).toBeNull();
    const per = (pos: string) => PICKABLE.filter((p) => p.position === pos).length;
    expect([per("DEF"), per("CM"), per("CAM"), per("ATT")]).toEqual([5, 6, 4, 5]);
  });

  it("P02 exactly 2 DEF · 2 CM · 1 CAM · 2 ATT, no duplicates, no unpositioned players", () => {
    expect(isFormationValid(SEVEN)).toBe(true);
    expect(isFormationValid(["vikram", "karminder", "harpreet", "nakul", "inder", "ghous", "robin"])).toBe(false); // 5 attackers
    expect(isFormationValid([...SEVEN.slice(0, 6), "gurinder"])).toBe(false);
    expect(isFormationValid([...SEVEN.slice(0, 6), "archit"])).toBe(false);
    const c = checkTeam(["archit", "danial", "vineet", "raunak", "ghous", "vikram", "karminder"], baseStars());
    expect(c.valid).toBe(false);
    expect(c.errors).toContain("Defenders: 3/2");
    expect(c.errors).toContain("CMs: 1/2");
  });

  it("P03 an old seven is trimmed to the players who still fit", () => {
    const old = ["navneet", "archit", "vikram", "ghous", "danish", "danial", "karminder"];
    expect(fitToFormation(old)).toEqual(["navneet", "archit", "vikram", "ghous", "danial", "karminder"]);
  });
});

describe("star budget and ownership re-rating", () => {
  it("P04 a seven over the star budget is rejected", () => {
    const stars = { ...baseStars(), vikram: 3, karminder: 3, ghous: 3 } as const;
    const c = checkTeam(SEVEN, stars);
    expect(c.starsTotal).toBe(17);
    expect(c.valid).toBe(false);
    expect(c.errors).toContain(`Over budget by ${17 - PICK7.starBudget}★`);
  });

  it("P05 after a draw, players in >60% of teams gain a star and those in <10% lose one", () => {
    let { s, ids } = withUsers(4);
    const c = createMatchDay(s, { date: "2026-11-19", attendees: ATTEND }, at("2026-11-12T00:00:00Z"));
    s = c.state;
    for (const id of ids.slice(0, 3)) s = setSquad(s, id, SEVEN, at("2026-11-13T00:00:00Z"));
    s = setSquad(s, ids[3], ALT, at("2026-11-13T00:00:00Z"));
    s = recordDraw(s, c.match.id, DEFAULT_CONSTRAINTS, at("2026-11-19T20:00:00Z"), SEED);
    const own = ownership(s.matchDays[0]);
    expect(own.vikram).toBe(0.75);
    expect(own.vineet).toBe(0.25);
    const stars = currentStars(s.matchDays);
    expect(stars.vikram).toBe(3); // 75% > 60%
    expect(stars.vineet).toBe(2); // 25%: unchanged
    expect(stars.inder).toBe(1); // 0% < 10%
    expect(stars.gurinder).toBe(2); // not pickable: never re-rated
    // Ratings that apply before that draw are unaffected.
    expect(currentStars(s.matchDays, s.matchDays[0].kickoffAt).vikram).toBe(2);
  });

  it("P06 with fewer teams than the minimum, nobody is re-rated", () => {
    let { s, ids } = withUsers(PICK7.minTeamsToRerate - 1);
    const c = createMatchDay(s, { date: "2026-11-19", attendees: ATTEND }, at("2026-11-12T00:00:00Z"));
    s = c.state;
    for (const id of ids) s = setSquad(s, id, SEVEN, at("2026-11-13T00:00:00Z"));
    s = recordDraw(s, c.match.id, DEFAULT_CONSTRAINTS, at("2026-11-19T20:00:00Z"), SEED);
    expect(currentStars(s.matchDays)).toEqual(baseStars());
  });

  it("P07 a team pushed over budget by a re-rating stays legal; changes may only bring the total down", () => {
    let { s, ids } = withUsers(4);
    const c = createMatchDay(s, { date: "2026-11-19", attendees: ATTEND }, at("2026-11-12T00:00:00Z"));
    s = c.state;
    for (const id of ids) s = setSquad(s, id, SEVEN, at("2026-11-13T00:00:00Z"));
    s = recordDraw(s, c.match.id, DEFAULT_CONSTRAINTS, at("2026-11-19T20:00:00Z"), SEED);
    // Everyone owned SEVEN → all seven are now 3★ (21★, over the 14★ budget).
    const stars = currentStars(s.matchDays);
    expect(SEVEN.every((id) => stars[id] === 3)).toBe(true);
    const u0 = s.users.find((u) => u.id === ids[0])!;
    expect(checkTeam(SEVEN, stars, SEVEN).grandfathered).toBe(true);
    // Swapping a 3★ for a 1★ lowers the total: allowed.
    const cheaper = SEVEN.map((x) => (x === "vikram" ? "inder" : x));
    s = setSquad(s, u0.id, cheaper, at("2026-11-21T00:00:00Z"));
    // A brand-new account can't pick the over-budget seven.
    const fresh = signUp(s, { email: "new@x.co", name: "New", passwordHash: "h" }, at("2026-11-21T00:00:00Z"));
    expect(() => setSquad(fresh.state, fresh.user.id, SEVEN, at("2026-11-21T00:00:00Z"))).toThrow(/Over budget/);
  });

  it("P08 an old pre-formation seven isn't entered at the draw, and gets a fix-your-team reminder", () => {
    let { s, ids } = withUsers(2);
    const legacy = ["navneet", "archit", "vikram", "ghous", "danish", "danial", "karminder"];
    // Saved before the formation rule existed: written straight into history.
    s = {
      ...s,
      users: s.users.map((u): User => (u.id === ids[0] ? { ...u, squadHistory: [{ picks: legacy, at: "2026-11-01T00:00:00.000Z" }] } : u)),
    };
    s = setSquad(s, ids[1], SEVEN, at("2026-11-13T00:00:00Z"));
    const c = createMatchDay(s, { date: "2026-11-19", attendees: ATTEND }, at("2026-11-12T00:00:00Z"));
    s = c.state;
    const plan = planReminders(s, new Date("2026-11-19T12:00:00Z"), "thu");
    expect(plan.find((r) => r.userId === ids[0])?.kind).toBe("fix_team");
    expect(plan.find((r) => r.userId === ids[1])?.kind).toBe("carry_over");
    s = recordDraw(s, c.match.id, DEFAULT_CONSTRAINTS, at("2026-11-19T20:00:00Z"), SEED);
    expect(s.matchDays[0].selections.map((x) => x.selectorId)).toEqual([ids[1]]);
  });
});

describe("v2 scoring", () => {
  const base = { attendees: ["vikram", "robin", "archit", "tadas"], rulesVersion: 2 as const };

  it("S01 match days from 19 Nov 2026 use v2; earlier ones keep v1", () => {
    expect(rulesVersionOf({ date: "2026-11-12" })).toBe(1);
    expect(rulesVersionOf({ date: "2026-11-19" })).toBe(2);
    expect(rulesVersionOf({ date: "2027-01-07", rulesVersion: 1 })).toBe(1);
    const events = [{ id: "g", side: "A" as const, kind: "open_play" as const, scorerId: "vikram", assistId: "robin" }];
    expect(scoreMatch({ attendees: [], events, date: "2026-11-12" }).get("vikram")!.points).toBe(POINTS_V1.goal);
    const v2 = scoreMatch({ attendees: [], events, date: "2026-11-19", motm: { A: null, B: null } });
    expect(v2.get("vikram")!.points).toBe(POINTS_V2.goal);
    expect(v2.get("robin")!.points).toBe(POINTS_V2.assist);
  });

  it("S02 goal +3, assist +2, own goal −2; no assist on penalties or free kicks; second assists ignored", () => {
    const lines = scoreMatch({
      ...base,
      motm: { A: null, B: null },
      fairPlayLost: base.attendees.map((playerId) => ({ playerId, reason: "foul" as const })),
      events: [
        { id: "1", side: "A", kind: "open_play", scorerId: "vikram", assistId: "robin", secondAssistId: "archit" },
        { id: "2", side: "A", kind: "penalty", scorerId: "vikram", assistId: "robin" },
        { id: "3", side: "A", kind: "free_kick", scorerId: "robin", assistId: "vikram" },
        { id: "4", side: "B", kind: "own_goal", scorerId: "archit" },
      ],
    });
    expect(lines.get("vikram")!.points).toBe(6);
    expect(lines.get("robin")!.points).toBe(5);
    expect(lines.get("archit")!.points).toBe(-2);
    expect(lines.get("archit")!.secondAssists).toBe(0);
  });

  it("S03 MOTM +4 for one player per team; fair play +1 for every attendee not flagged", () => {
    const lines = scoreMatch({
      ...base,
      events: [],
      motm: { A: "vikram", B: "tadas" },
      fairPlayLost: [{ playerId: "archit", reason: "dissent" }],
    });
    expect(lines.get("vikram")).toMatchObject({ motm: 1, fairPlay: 1, points: 5 });
    expect(lines.get("tadas")).toMatchObject({ motm: 1, fairPlay: 1, points: 5 });
    expect(lines.get("robin")).toMatchObject({ motm: 0, fairPlay: 1, points: 1 });
    expect(lines.get("archit")).toMatchObject({ fairPlay: 0, points: 0 });
  });

  it("S04 Pick 7 selectors bank MOTM and fair play too", () => {
    const m = { ...base, id: "m", events: [], motm: { A: "vikram", B: null }, fairPlayLost: [] };
    expect(scoreSelection({ selectorId: "u", picks: ["vikram", "robin"] }, m).points).toBe(4 + 1 + 1);
  });

  it("S05 saving a v2 scorecard needs MOTM for both teams, from that team; fair play is stored and audited", () => {
    let { s, ids } = withUsers(1);
    s = setSquad(s, ids[0], SEVEN, at("2026-11-13T00:00:00Z"));
    const c = createMatchDay(s, { date: "2026-11-19", attendees: ATTEND }, at("2026-11-12T00:00:00Z"));
    expect(c.match.rulesVersion).toBe(2);
    s = recordDraw(c.state, c.match.id, DEFAULT_CONSTRAINTS, at("2026-11-19T20:00:00Z"), SEED);
    const d = s.matchDays[0].draw!;
    const id = c.match.id;
    const save = (input: Parameters<typeof saveScorecard>[3]) => saveScorecard(s, id, [], input, at("2026-11-20T04:00:00Z"));
    expect(() => save({ motm: { A: d.teamA[0], B: null } })).toThrow(LedgerError);
    expect(() => save({ motm: { A: d.teamB[0], B: d.teamB[1] } })).toThrow(LedgerError);
    expect(() => save({ motm: { A: d.teamA[0], B: d.teamB[0] }, fairPlayLost: [{ playerId: "inder", reason: "foul" }], rotationChecked: true })).toThrow(LedgerError);
    s = save({ motm: { A: d.teamA[0], B: d.teamB[0] }, fairPlayLost: [{ playerId: d.teamA[1], reason: "card" }], rotationChecked: true });
    const m = s.matchDays[0];
    expect(m.status).toBe("played");
    expect(m.motm).toEqual({ A: d.teamA[0], B: d.teamB[0] });
    expect(m.fairPlayLost).toEqual([{ playerId: d.teamA[1], reason: "card" }]);
    expect(s.audit.at(-1)!.after).toMatchObject({ motm: m.motm, fairPlayLost: m.fairPlayLost });
    const lines = scoreMatch(m);
    expect(lines.get(d.teamA[0])!.points).toBe(POINTS_V2.motm + POINTS_V2.fairPlay);
    expect(lines.get(d.teamA[1])!.points).toBe(0);
  });

  it("S06 v1 match days still save without MOTM", () => {
    const c = createMatchDay(initialState(), { date: "2026-11-12", attendees: ATTEND }, at("2026-11-01T00:00:00Z"));
    expect(c.match.rulesVersion).toBe(1);
    let s = recordDraw(c.state, c.match.id, DEFAULT_CONSTRAINTS, at("2026-11-12T20:00:00Z"), SEED);
    s = saveScorecard(s, c.match.id, [], {}, at("2026-11-13T04:00:00Z"));
    expect(s.matchDays[0].motm).toBeUndefined();
    expect(scoreMatch(s.matchDays[0]).get("vikram")!.points).toBe(0);
  });
});
