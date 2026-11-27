/** Goal / assist style tags: stored on the event, cleaned, and never change points. */
import { describe, expect, it } from "vitest";
import { createMatchDay, initialState, saveScorecard, setTeamSheet, type Ctx } from "./ledger";
import { cleanStyles, scoreEvent, scoreMatch } from "@/lib/scoring/rules";
import { describeEvent } from "@/components/EventLine";
import type { GoalEvent, LeagueState } from "./types";

let n = 0;
const at = (iso: string): Ctx => ({ now: new Date(iso), newId: () => `gs-${++n}` });
const WHITE = ["vikram", "robin", "archit", "tadas", "danial", "jedi", "ghous"];
const RED = ["nakul", "harpreet", "vineet", "sanjeev", "navneet", "danish", "jaskaran"];

function played(events: GoalEvent[]) {
  let s: LeagueState = initialState();
  const c = createMatchDay(s, { date: "2026-11-19" }, at("2026-11-12T00:00:00Z"));
  s = setTeamSheet(c.state, c.match.id, { teamA: WHITE, teamB: RED }, at("2026-11-19T20:00:00Z"));
  s = saveScorecard(s, c.match.id, events, { motm: { A: "vikram", B: "nakul" }, rotationChecked: true }, at("2026-11-20T04:05:00Z"));
  return s.matchDays.find((m) => m.id === c.match.id)!;
}

const plain: GoalEvent = { id: "e1", side: "A", kind: "open_play", scorerId: "archit", assistId: "robin" };
const tagged: GoalEvent = { ...plain, style: "outside_d", assistStyle: "through_ball" };

describe("goal styles", () => {
  it("GS01 tags never change points", () => {
    expect(scoreEvent(tagged, undefined, 2)).toEqual(scoreEvent(plain, undefined, 2));
    const a = played([plain]);
    const b = played([tagged]);
    expect(scoreMatch(b)).toEqual(scoreMatch(a));
  });

  it("GS02 tags are stored on the saved scorecard", () => {
    const m = played([tagged]);
    expect(m.events[0].style).toBe("outside_d");
    expect(m.events[0].assistStyle).toBe("through_ball");
  });

  it("GS03 unknown or inapplicable tags are dropped", () => {
    expect(cleanStyles({ ...plain, style: "rocket" as never }).style).toBeUndefined();
    expect(cleanStyles({ ...plain, kind: "own_goal", assistId: null, style: "tap_in", assistStyle: "cross" })).not.toHaveProperty("style");
    expect(cleanStyles({ ...plain, kind: "penalty", style: "tap_in" })).not.toHaveProperty("style");
    expect(cleanStyles({ ...plain, assistId: null, assistStyle: "cross" })).not.toHaveProperty("assistStyle");
    const m = played([{ ...plain, kind: "own_goal", assistId: null, style: "chip" }]);
    expect(m.events[0]).not.toHaveProperty("style");
  });

  it("GS04 match report line shows the tags", () => {
    expect(describeEvent(tagged, { secondAssistEnabled: false, deflectionDefault: "own_goal" }, 2)).toMatch(/\(outside the d\) · assist .+ \(through ball\)/);
  });
});

describe("tagging played matches", () => {
  it("GS05 tags a played match after the correction window, without touching points or version", async () => {
    const { setGoalStyles } = await import("./ledger");
    let s: LeagueState = initialState();
    const c = createMatchDay(s, { date: "2026-11-19" }, at("2026-11-12T00:00:00Z"));
    s = setTeamSheet(c.state, c.match.id, { teamA: WHITE, teamB: RED }, at("2026-11-19T20:00:00Z"));
    s = saveScorecard(s, c.match.id, [plain], { motm: { A: "vikram", B: "nakul" }, rotationChecked: true }, at("2026-11-20T04:05:00Z"));
    const before = s.matchDays[0];
    // A month later: corrections are closed, tags still allowed.
    const t = setGoalStyles(s, c.match.id, [{ id: "e1", style: "tap_in", assistStyle: "cutback" }], at("2026-12-25T00:00:00Z"));
    const after = t.matchDays[0];
    expect(after.events[0]).toMatchObject({ style: "tap_in", assistStyle: "cutback", scorerId: "archit", assistId: "robin" });
    expect(after.scorecardVersion).toBe(before.scorecardVersion);
    expect(scoreMatch(after)).toEqual(scoreMatch(before));
    expect(t.audit.at(-1)?.action).toBe("scorecard.tags");
    // Clearing works; unknown goals and unpublished matches are refused.
    expect(setGoalStyles(t, c.match.id, [{ id: "e1", style: null, assistStyle: null }], at("2026-12-26T00:00:00Z")).matchDays[0].events[0]).not.toHaveProperty("style");
    expect(() => setGoalStyles(t, c.match.id, [{ id: "nope", style: "chip" }], at("2026-12-26T00:00:00Z"))).toThrow(/weren't found/);
    const d = createMatchDay(t, { date: "2026-11-26" }, at("2026-11-12T00:00:00Z"));
    expect(() => setGoalStyles(d.state, d.match.id, [], at("2026-12-26T00:00:00Z"))).toThrow(/Publish/);
  });
});
