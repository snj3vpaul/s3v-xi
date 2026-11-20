/** Bench player (auto-sub), vice-captain, Triple Captain, Bench Boost, availability flags, and the v3 defensive bonus. */
import { describe, expect, it } from "vitest";
import { CHIPS } from "@/config/club";
import { POINTS_V2, defenceBonus, matchItems, rulesVersionOf, scoreMatch, scoreSelection, type ScorableMatch } from "@/lib/scoring/rules";
import {
  LedgerError,
  cancelChip,
  chipsUsed,
  createMatchDay,
  currentBench,
  currentViceCaptain,
  deleteMatchDay,
  initialState,
  lockedSelections,
  playChip,
  rulesFrom,
  saveScorecard,
  setAvailability,
  setSquad,
  setTeamSheet,
  signUp,
  unavailableFor,
  type Ctx,
} from "./ledger";
import { buildPick7Table, selectorBreakdown } from "./pick7Table";
import type { GoalEvent, LeagueState } from "./types";

let n = 0;
const at = (iso: string): Ctx => ({ now: new Date(iso), newId: () => `bc-${++n}` });
// 2 DEF · 2 CM · 1 CAM · 2 ATT, all 2★ (budget 14).
const SEVEN = ["archit", "danial", "navneet", "raunak", "ghous", "vikram", "karminder"];
const goal = (side: "A" | "B", scorerId: string, assistId?: string): GoalEvent => ({ id: `g${++n}`, side, kind: "open_play", scorerId, assistId });

/** A v3 match: White = teamA, Red = teamB. */
function match(teamA: string[], teamB: string[], events: GoalEvent[], extra: Partial<ScorableMatch> = {}): ScorableMatch & { id: string } {
  return { id: "m1", attendees: [...teamA, ...teamB], rulesVersion: 3, draw: { teamA, teamB, floater: null }, motm: { A: null, B: null }, events, ...extra };
}

// ---------------------------------------------------------------------------
// Defensive bonus (v3) — positive only
// ---------------------------------------------------------------------------

describe("defensive bonus (v3, defenders and CMs, never negative)", () => {
  it("D01 bands: DEF 0→4, 1–2→2, 3–4→1, 5+→0; CM 0→2, 1–2→1, 3+→0; CAM and ATT none", () => {
    expect([0, 1, 2, 3, 4, 5, 9].map((c) => defenceBonus("DEF", c))).toEqual([4, 2, 2, 1, 1, 0, 0]);
    expect([0, 1, 2, 3, 9].map((c) => defenceBonus("CM", c))).toEqual([2, 1, 1, 0, 0]);
    expect(defenceBonus("CAM", 0)).toBe(0);
    expect(defenceBonus("ATT", 0)).toBe(0);
    expect(defenceBonus(null, 0)).toBe(0);
  });

  it("D02 by the goals the player's own side conceded; a heavy defeat gives 0, not a minus", () => {
    // White (archit DEF, navneet CM, vikram ATT) concede 1; Red (danial DEF, raunak CM) concede 6.
    const m = match(
      ["archit", "navneet", "vikram"],
      ["danial", "raunak", "nakul"],
      [goal("B", "nakul"), ...Array.from({ length: 6 }, () => goal("A", "vikram"))],
    );
    const items = matchItems(m);
    const def = (id: string) => (items.get(id) ?? []).filter((i) => i.kind === "defence").reduce((t, i) => t + i.points, 0);
    expect(def("archit")).toBe(2);
    expect(def("navneet")).toBe(1);
    expect(def("vikram")).toBe(0);
    expect(def("danial")).toBe(0);
    expect(def("raunak")).toBe(0);
    for (const list of items.values()) for (const it of list) if (it.kind === "defence") expect(it.points).toBeGreaterThan(0);
  });

  it("D03 clean sheet: defender +4, CM +2, with the reason in the breakdown", () => {
    const m = match(["archit", "navneet"], ["danial", "raunak"], [goal("A", "navneet")]);
    const archit = matchItems(m).get("archit")!.find((i) => i.kind === "defence")!;
    expect(archit).toMatchObject({ points: 4, detail: "Defender: clean sheet" });
    expect(scoreMatch(m).get("archit")!.points).toBe(4 + POINTS_V2.win + POINTS_V2.fairPlay);
  });

  it("D04 v2 match days (19 Nov) get no defensive bonus; v3 starts 26 Nov", () => {
    const m = match(["archit"], ["danial"], [], { rulesVersion: 2 });
    expect(matchItems(m).get("archit")!.some((i) => i.kind === "defence")).toBe(false);
    expect(rulesVersionOf({ date: "2026-11-19" })).toBe(2);
    expect(rulesVersionOf({ date: "2026-11-26" })).toBe(3);
  });

  it("D05 the floater is judged on the worse of the two sides", () => {
    const m = { ...match(["archit"], ["danial"], [goal("A", "archit"), goal("B", "danial"), goal("B", "danial")]), attendees: ["archit", "danial", "vineet"] };
    m.draw = { teamA: ["archit"], teamB: ["danial"], floater: "vineet" };
    expect(matchItems(m).get("vineet")!.find((i) => i.kind === "defence")!.points).toBe(2); // conceded max(1, 2) = 2
  });
});

// ---------------------------------------------------------------------------
// Bench, vice-captain, chips — scoring
// ---------------------------------------------------------------------------

describe("bench, vice-captain and chips (scoring)", () => {
  // vikram scores twice for White; everyone else just plays.
  const everyone = match(["archit", "danial", "navneet", "raunak"], ["ghous", "vikram", "karminder", "harry"], [goal("B", "vikram"), goal("B", "vikram")], { rulesVersion: 2 });
  const lines = scoreMatch(everyone);
  const pts = (id: string) => lines.get(id)?.points ?? 0;
  const sel = (o: Partial<Parameters<typeof scoreSelection>[0]> = {}) => ({ selectorId: "u", picks: SEVEN, captain: "vikram", ...o });

  it("S01 bench player counts only when a starter didn't play (auto-sub)", () => {
    const all = scoreSelection(sel({ bench: "harry" }), everyone);
    expect(all.benchUsed).toBe(false);
    expect(all.points).toBe(SEVEN.reduce((t, id) => t + pts(id), 0) + pts("vikram")); // captain doubled, no bench
    const missing = { ...everyone, attendees: everyone.attendees.filter((x) => x !== "navneet") };
    const r = scoreSelection(sel({ bench: "harry" }), missing);
    expect(r.benchUsed).toBe(true);
    expect(r.perPick.find((p) => p.playerId === "harry")).toMatchObject({ role: "bench", counted: true, points: pts("harry") });
  });

  it("S02 a bench player who didn't play either adds nothing", () => {
    const m = { ...everyone, attendees: everyone.attendees.filter((x) => x !== "navneet" && x !== "harry") };
    const r = scoreSelection(sel({ bench: "harry" }), m);
    expect(r.benchUsed).toBe(false);
    expect(r.perPick.find((p) => p.playerId === "harry")!.points).toBe(0);
  });

  it("S03 one bench player covers at most one absence (no double counting)", () => {
    const m = { ...everyone, attendees: everyone.attendees.filter((x) => x !== "navneet" && x !== "raunak") };
    const r = scoreSelection(sel({ bench: "harry" }), m);
    expect(r.perPick.filter((p) => p.role === "bench")).toHaveLength(1);
    expect(r.points).toBe(SEVEN.reduce((t, id) => t + (m.attendees.includes(id) ? pts(id) : 0), 0) + pts("vikram") + pts("harry"));
  });

  it("V01 vice-captain takes the armband (×2) only if the captain didn't play", () => {
    const played = scoreSelection(sel({ viceCaptain: "archit" }), everyone);
    expect(played.armband).toBe("vikram");
    expect(played.perPick.find((p) => p.playerId === "archit")!.multiplier).toBe(1);
    const m = { ...everyone, attendees: everyone.attendees.filter((x) => x !== "vikram") };
    const r = scoreSelection(sel({ viceCaptain: "archit" }), m);
    expect(r.armband).toBe("archit");
    expect(r.perPick.find((p) => p.playerId === "archit")).toMatchObject({ captain: true, multiplier: 2, points: pts("archit") * 2 });
  });

  it("V02 captain and vice both missing: no doubling; the bench player never gets the armband", () => {
    const m = { ...everyone, attendees: everyone.attendees.filter((x) => x !== "vikram" && x !== "archit") };
    const r = scoreSelection(sel({ viceCaptain: "archit", bench: "harry" }), m);
    expect(r.armband).toBeNull();
    expect(r.perPick.every((p) => p.multiplier === 1)).toBe(true);
  });

  it("V03 a vice-captain equal to the captain, or outside the seven, is ignored", () => {
    expect(scoreSelection(sel({ viceCaptain: "vikram" }), everyone).viceCaptain).toBeNull();
    expect(scoreSelection(sel({ viceCaptain: "harry" }), everyone).viceCaptain).toBeNull();
  });

  it("C01 Triple Captain: the armband counts ×3 (and passes to the vice at ×3)", () => {
    const r = scoreSelection(sel({ chip: "triple_captain" }), everyone);
    expect(r.perPick.find((p) => p.playerId === "vikram")).toMatchObject({ multiplier: 3, points: pts("vikram") * 3 });
    const m = { ...everyone, attendees: everyone.attendees.filter((x) => x !== "vikram") };
    expect(scoreSelection(sel({ chip: "triple_captain", viceCaptain: "archit" }), m).perPick.find((p) => p.playerId === "archit")!.multiplier).toBe(3);
  });

  it("C02 Bench Boost: the bench player's points count even when all seven played", () => {
    const r = scoreSelection(sel({ bench: "harry", chip: "bench_boost" }), everyone);
    expect(r.benchUsed).toBe(true);
    expect(r.points).toBe(scoreSelection(sel({ bench: "harry" }), everyone).points + pts("harry"));
  });

  it("C03 old sevens (no vice, no bench, no chip) score exactly as before", () => {
    const r = scoreSelection({ selectorId: "u", picks: SEVEN, captain: "vikram" }, everyone);
    expect(r.points).toBe(SEVEN.reduce((t, id) => t + pts(id), 0) + pts("vikram"));
    expect(r.perPick).toHaveLength(7);
  });
});

// ---------------------------------------------------------------------------
// Ledger: saving, chips, availability, snapshot and breakdown
// ---------------------------------------------------------------------------

function league(): { s: LeagueState; uid: string; mid: string; kickoff: string } {
  let s = initialState();
  const r = signUp(s, { email: "d@example.invalid", name: "Danish", passwordHash: "x", playerId: "danish" }, at("2026-11-20T12:00:00Z"));
  s = r.state;
  const c = createMatchDay(s, { date: "2026-11-26" }, at("2026-11-20T12:00:00Z"));
  return { s: c.state, uid: r.user.id, mid: c.match.id, kickoff: c.match.kickoffAt };
}

describe("ledger: bench, vice-captain, chips, availability", () => {
  it("L01 saves bench and vice-captain; keeps them on a later save that leaves them out; validates", () => {
    let { s, uid } = league();
    s = setSquad(s, uid, SEVEN, at("2026-11-21T10:00:00Z"), "vikram", { viceCaptain: "archit", bench: "harry" });
    let u = s.users[0];
    expect(currentViceCaptain(u)).toBe("archit");
    expect(currentBench(u)).toBe("harry");
    s = setSquad(s, uid, SEVEN, at("2026-11-21T11:00:00Z"), "ghous");
    u = s.users[0];
    expect(currentViceCaptain(u)).toBe("archit");
    expect(currentBench(u)).toBe("harry");
    expect(() => setSquad(s, uid, SEVEN, at("2026-11-21T12:00:00Z"), "vikram", { viceCaptain: "vikram" })).toThrow(LedgerError);
    expect(() => setSquad(s, uid, SEVEN, at("2026-11-21T12:00:00Z"), "vikram", { viceCaptain: "harry" })).toThrow(LedgerError);
    expect(() => setSquad(s, uid, SEVEN, at("2026-11-21T12:00:00Z"), "vikram", { bench: "archit" })).toThrow(LedgerError);
    expect(() => setSquad(s, uid, SEVEN, at("2026-11-21T12:00:00Z"), "vikram", { bench: "gurinder" })).toThrow(LedgerError);
    // Changing only the bench is a real change (audited).
    const before = s.audit.length;
    s = setSquad(s, uid, SEVEN, at("2026-11-21T13:00:00Z"), "ghous", { bench: "jedi" });
    expect(s.audit.length).toBe(before + 1);
    expect(s.audit.at(-1)).toMatchObject({ action: "squad.update", after: { bench: "jedi", viceCaptain: "archit" } });
  });

  it("L02 the bench doesn't count toward the star budget", () => {
    let { s, uid } = league();
    // SEVEN is exactly 14★; an 8th 2★ player would be 16★.
    s = setSquad(s, uid, SEVEN, at("2026-11-21T10:00:00Z"), "vikram", { bench: "harry" });
    expect(currentBench(s.users[0])).toBe("harry");
  });

  it("K01 chips: one per match day, a season allowance, cancel gives it back; deleted week returns it", () => {
    let { s, uid, mid } = league();
    expect(() => playChip(s, uid, "triple_captain", at("2026-11-21T10:00:00Z"))).toThrow(/Save a seven/);
    s = setSquad(s, uid, SEVEN, at("2026-11-21T10:00:00Z"), "vikram");
    expect(() => playChip(s, uid, "bench_boost", at("2026-11-21T10:00:00Z"))).toThrow(/bench player/);
    s = playChip(s, uid, "triple_captain", at("2026-11-21T10:00:00Z"));
    expect(chipsUsed(s, s.users[0]).triple_captain).toBe(1);
    s = setSquad(s, uid, SEVEN, at("2026-11-21T10:30:00Z"), "vikram", { bench: "harry" });
    expect(() => playChip(s, uid, "bench_boost", at("2026-11-21T11:00:00Z"))).toThrow(/already played Triple Captain/);
    s = cancelChip(s, uid, at("2026-11-21T11:00:00Z"));
    expect(chipsUsed(s, s.users[0]).triple_captain).toBe(0);
    s = playChip(s, uid, "bench_boost", at("2026-11-21T11:00:00Z"));
    expect(s.audit.filter((a) => a.action.startsWith("chip."))).toHaveLength(3);
    s = deleteMatchDay(s, mid, at("2026-11-21T12:00:00Z"));
    expect(chipsUsed(s, s.users[0]).bench_boost).toBe(0);
  });

  it("K02 the season allowance is enforced", () => {
    let { s, uid } = league();
    s = setSquad(s, uid, SEVEN, at("2026-11-21T10:00:00Z"), "vikram");
    const limit = CHIPS.triple_captain.perSeason;
    for (let w = 0; w < limit; w++) {
      const date = new Date(Date.UTC(2026, 11, 3 + 7 * w)).toISOString().slice(0, 10);
      const c = createMatchDay(s, { date }, at("2026-11-21T10:00:00Z"));
      // Play it for whichever match is next, then push "now" past that kick-off.
      s = c.state;
    }
    let now = new Date("2026-11-21T10:00:00Z");
    for (let i = 0; i < limit; i++) {
      s = playChip(s, uid, "triple_captain", { now, newId: () => `k${++n}` });
      const next = [...s.matchDays].sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt)).find((m) => new Date(m.kickoffAt) > now)!;
      now = new Date(new Date(next.kickoffAt).getTime() + 60_000);
    }
    expect(() => playChip(s, uid, "triple_captain", { now, newId: () => `k${++n}` })).toThrow(/used all/);
  });

  it("K03 the locked snapshot carries the bench, vice-captain and chip; breakdown adds up to the table", () => {
    let { s, uid, mid, kickoff } = league();
    s = setSquad(s, uid, SEVEN, at("2026-11-21T10:00:00Z"), "vikram", { viceCaptain: "archit", bench: "harry" });
    s = playChip(s, uid, "triple_captain", at("2026-11-21T10:00:00Z"));
    // vikram doesn't turn up: archit takes the armband at ×3 and harry comes off the bench.
    const teamA = ["archit", "danial", "navneet", "harry"];
    const teamB = ["raunak", "ghous", "karminder", "jedi"];
    s = setTeamSheet(s, mid, { teamA, teamB }, at("2026-11-26T20:00:00Z"));
    const after = new Date(new Date(kickoff).getTime() + 3_600_000);
    const sel = lockedSelections(s, s.matchDays.find((m) => m.id === mid)!, after)[0];
    expect(sel).toMatchObject({ captain: "vikram", viceCaptain: "archit", bench: "harry", chip: "triple_captain" });
    s = saveScorecard(
      s,
      mid,
      [goal("A", "archit"), goal("A", "harry", "archit")],
      { motm: { A: "archit", B: "ghous" }, rotationChecked: true },
      { now: after, newId: () => `k${++n}` },
    );
    const m = s.matchDays.find((x) => x.id === mid)!;
    expect(m.rulesVersion).toBe(3);
    const rules = rulesFrom(s.settings);
    const bd = selectorBreakdown(s, rules, uid);
    const row = buildPick7Table(s, rules).find((r) => r.id === uid)!;
    expect(bd.total).toBe(row.points);
    expect(bd.rounds[0].notes.join(" ")).toMatch(/vice-captain Archit took the armband/);
    expect(bd.rounds[0].notes.join(" ")).toMatch(/Harry came off the bench/);
    const archit = bd.rounds[0].picks.find((p) => p.playerId === "archit")!;
    // goal 3 + assist 2 + MOTM 4 + win 3 + fair play 1 + clean sheet 4 = 17, ×3 = 51
    expect(archit.total).toBe(51);
    expect(archit.items.find((i) => i.kind === "captain")).toMatchObject({ points: 34, detail: "Triple Captain: points ×3" });
  });

  it("A01 a player can flag themselves out (own player, before kick-off); admins can flag anyone", () => {
    let { s, uid, mid, kickoff } = league();
    s = setAvailability(s, { matchId: mid, playerId: "danish", out: true, note: "Away", by: "self", userId: uid }, at("2026-11-21T10:00:00Z"));
    expect(unavailableFor(s.matchDays[0])).toEqual({ danish: { by: "self", note: "Away" } });
    expect(() => setAvailability(s, { matchId: mid, playerId: "vikram", out: true, by: "self", userId: uid }, at("2026-11-21T10:00:00Z"))).toThrow(/own availability/);
    expect(() =>
      setAvailability(s, { matchId: mid, playerId: "danish", out: false, by: "self", userId: uid }, { now: new Date(new Date(kickoff).getTime() + 1), newId: () => "x" }),
    ).toThrow(/kicked off/);
    s = setAvailability(s, { matchId: mid, playerId: "vikram", out: true, by: "admin" }, at("2026-11-21T10:00:00Z"));
    s = setAvailability(s, { matchId: mid, playerId: "danish", out: false, by: "self", userId: uid }, at("2026-11-21T11:00:00Z"));
    expect(Object.keys(unavailableFor(s.matchDays[0]))).toEqual(["vikram"]);
    expect(s.audit.filter((a) => a.action === "availability.set")).toHaveLength(3);
  });
});
