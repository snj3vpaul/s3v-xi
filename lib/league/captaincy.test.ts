import { describe, expect, it } from "vitest";
import { captaincyNews, mostCaptained } from "./captaincy";
import type { LeagueState } from "./types";

const base = (over: Partial<LeagueState>): LeagueState =>
  ({ schemaVersion: 2, version: 1, settings: {} as LeagueState["settings"], matchDays: [], audit: [], users: [], seriesCreated: [], ...over }) as LeagueState;
const md = (id: string, at: string, caps: (string | null)[], status = "played") =>
  ({ id, kickoffAt: at, status, selections: caps.map((c, i) => ({ selectorId: `u${i}`, picks: [], captain: c, submittedAt: at })) }) as unknown as LeagueState["matchDays"][number];
const user = (captain: string | null, at = "2026-11-10T00:00:00Z", picks: string[] = ["vikram"]) =>
  ({ id: Math.random().toString(36), squadHistory: [{ picks, at, captain }] }) as unknown as LeagueState["users"][number];

describe("mostCaptained", () => {
  it("C01 counts captains across played match days", () => {
    const s = base({ matchDays: [md("m1", "2026-11-19T22:00:00Z", ["vikram", "inder", "vikram"]), md("m2", "2026-11-26T22:00:00Z", ["inder", "inder"])] });
    expect(mostCaptained(s)).toBe("inder");
  });
  it("C02 ignores fixtures not yet played", () => {
    const s = base({ matchDays: [md("m1", "2026-11-19T22:00:00Z", ["vikram"]), md("m2", "2026-11-26T22:00:00Z", ["inder", "inder"], "open")] });
    expect(mostCaptained(s)).toBe("vikram");
  });
  it("C03 falls back to current captains before any match is played", () => {
    const s = base({ users: [user("savi"), user("savi"), user("nakul"), user(null)] });
    expect(mostCaptained(s)).toBe("savi");
  });
  it("C04 a tie goes to whoever got there first", () => {
    const s = base({ matchDays: [md("m2", "2026-11-26T22:00:00Z", ["abrar"]), md("m1", "2026-11-19T22:00:00Z", ["robin"])] });
    expect(mostCaptained(s)).toBe("robin");
  });
  it("C05 nobody captained: null", () => {
    expect(mostCaptained(base({ users: [user(null)] }))).toBeNull();
  });
});

describe("captaincyNews", () => {
  it("N01 counts current sevens that pick and captain the most-captained player", () => {
    const s = base({
      matchDays: [md("m1", "2026-11-19T22:00:00Z", ["inder", "inder", "vikram"])],
      users: [
        user("inder", undefined, ["inder", "vikram"]),
        user("vikram", undefined, ["inder", "vikram"]),
        user("vikram", undefined, ["vikram"]),
        user(null, undefined, []),
      ],
    });
    expect(captaincyNews(s)).toEqual({ playerId: "inder", teams: 3, selectedBy: 2, captainedBy: 1, seasonArmbands: 2 });
  });
  it("N02 nobody captained: null", () => {
    expect(captaincyNews(base({ users: [user(null)] }))).toBeNull();
  });
});
