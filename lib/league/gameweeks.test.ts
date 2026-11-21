/** Gameweek numbering and FPL-style team-selection history. */
import { describe, expect, it } from "vitest";
import { createMatchDay, initialState, rulesFrom, setSquad, signUp, type Ctx } from "./ledger";
import { diffTeams, gameweeks, managerHistory, openGwStatus, publicHistory } from "./gameweeks";
import { buildPick7Table } from "./pick7Table";
import type { LeagueState } from "./types";

let n = 0;
const at = (iso: string): Ctx => ({ now: new Date(iso), newId: () => `gw-${++n}` });
// 2 DEF · 2 CM · 1 CAM · 2 ATT
const SEVEN = ["archit", "danial", "navneet", "raunak", "ghous", "vikram", "karminder"];

/** Two accounts, GW1 (26 Nov) and GW2 (3 Dec); both pick before GW1. */
function league() {
  let s: LeagueState = initialState();
  const a = signUp(s, { email: "a@example.invalid", name: "Ana", passwordHash: "x" }, at("2026-11-20T12:00:00Z"));
  s = a.state;
  const b = signUp(s, { email: "b@example.invalid", name: "Ben", passwordHash: "x" }, at("2026-11-20T12:00:00Z"));
  s = b.state;
  s = createMatchDay(s, { date: "2026-11-26" }, at("2026-11-20T12:00:00Z")).state;
  s = createMatchDay(s, { date: "2026-12-03" }, at("2026-11-20T12:00:00Z")).state;
  return { s, ana: a.user.id, ben: b.user.id };
}

const pick = (s: LeagueState, uid: string, picks: string[], iso: string, captain: string) => setSquad(s, uid, picks, at(iso), captain);

describe("gameweeks", () => {
  it("W01 numbers fixtures from GW1 in kick-off order", () => {
    const { s } = league();
    expect(gameweeks(s.matchDays).map((g) => [g.n, g.match.date])).toEqual([
      [1, "2026-11-26"],
      [2, "2026-12-03"],
    ]);
  });

  it("W02 pairs swaps by position and spots armband changes", () => {
    const c = diffTeams(
      { picks: SEVEN, captain: "vikram", viceCaptain: null, bench: null, chip: null },
      { picks: ["archit", "harry", "navneet", "raunak", "ghous", "inder", "karminder"], captain: "inder", viceCaptain: null, bench: null, chip: null },
    );
    expect(c.in).toEqual(["harry", "inder"]);
    expect(c.out).toEqual(["danial", "vikram"]); // DEF for DEF, ATT for ATT
    expect(c.transfers).toBe(2);
    expect(c.captain).toEqual({ from: "vikram", to: "inder" });
  });

  it("W03 GW2 status: changes vs no changes vs no team, counts only in public", () => {
    let { s, ana, ben } = league();
    s = pick(s, ana, SEVEN, "2026-11-21T10:00:00Z", "vikram");
    s = pick(s, ben, SEVEN, "2026-11-21T11:00:00Z", "raunak");
    // After GW1 kicks off, Ana swaps Vikram for Inder and makes Inder captain; Ben does nothing.
    s = pick(s, ana, ["archit", "danial", "navneet", "raunak", "ghous", "inder", "karminder"], "2026-11-28T10:00:00Z", "inder");
    const now = new Date("2026-11-29T12:00:00Z");
    const rules = rulesFrom(s.settings);

    expect(openGwStatus(s, rules, ana, now)).toMatchObject({ n: 2, kind: "changes", transfers: 1, captainChanged: true });
    expect(openGwStatus(s, rules, ben, now)).toMatchObject({ n: 2, kind: "no_changes", transfers: 0 });
    // Changing only the vice-captain counts as a change, and says so.
    const s2 = setSquad(s, ben, SEVEN, at("2026-11-28T11:00:00Z"), "raunak", { viceCaptain: "navneet" });
    expect(openGwStatus(s2, rules, ben, now)).toMatchObject({ kind: "changes", transfers: 0, viceChanged: true });

    const hist = managerHistory(s, rules, ana, now);
    expect(hist.map((r) => [r.n, r.locked])).toEqual([
      [1, true],
      [2, false],
    ]);
    expect(hist[0].changes?.newTeam).toBe(true);
    expect(hist[1].changes).toMatchObject({ in: ["inder"], out: ["vikram"] });

    // Others see the count, not the names, until GW2 locks.
    const pub = publicHistory(hist);
    expect(pub[1].changes?.in).toEqual(["?"]);
    expect(pub[1].team).toBeNull();
    expect(pub[0].changes?.in).toContain("vikram");

    // The table carries the same status.
    const table = buildPick7Table(s, rules, undefined, now);
    expect(table.find((r) => r.id === ana)?.gw?.kind).toBe("changes");
    expect(table.find((r) => r.id === ben)?.gw?.kind).toBe("no_changes");
  });

  it("W04 before GW1 locks, a first team shows as new", () => {
    let { s, ana, ben } = league();
    s = pick(s, ana, SEVEN, "2026-11-21T10:00:00Z", "vikram");
    const now = new Date("2026-11-22T12:00:00Z");
    const rules = rulesFrom(s.settings);
    expect(openGwStatus(s, rules, ana, now)).toMatchObject({ n: 1, kind: "new" });
    expect(openGwStatus(s, rules, ben, now)).toMatchObject({ n: 1, kind: "none" });
  });
});
