/** Accounts, weekly fixtures, FPL-style carry-over, calendar feed and reminders. */
import { describe, expect, it } from "vitest";
import { SERIES } from "@/config/schedule";
import { buildCalendar } from "./ics";
import {
  DEFAULT_CONSTRAINTS,
  LedgerError,
  deleteMatchDay,
  ensureSeries,
  initialState,
  migrate,
  nextDeadlineMatch,
  recordDraw,
  recordReminders,
  resetDraw,
  setSquad,
  signUp,
  squadAt,
  updateAccount,
  type Ctx,
} from "./ledger";
import { planReminders, reminderEmail } from "./reminders";
import { weeklyDates, zonedToUtc } from "./schedule";

let n = 0;
const at = (iso: string): Ctx => ({ now: new Date(iso), newId: () => `id${++n}` });
// Both fit the Pick 7 formation (2 DEF · 2 CM · 1 CAM · 2 ATT) and the star budget.
const SEVEN = ["archit", "danial", "navneet", "raunak", "ghous", "vikram", "karminder"];
const OTHER = ["vineet", "jaskaran", "sanjeev", "jedi", "danish", "harpreet", "nakul"];
const SQUAD16 = [...SEVEN, ...OTHER, "gurnaam", "tadas"];

describe("weekly fixtures (Thursday 10 pm, White vs Red, until summer)", () => {
  it("F01 every Thursday from 19 Nov 2026 to 17 Jun 2027", () => {
    const d = weeklyDates(SERIES.start, SERIES.end, SERIES.weekday);
    expect(d[0]).toBe("2026-11-19");
    expect(d.at(-1)).toBe("2027-06-17");
    expect(d).toHaveLength(31);
    expect(d.every((x) => new Date(`${x}T12:00:00Z`).getUTCDay() === 4)).toBe(true);
  });

  it("F02 10 pm Toronto is 03:00Z in winter (EST) and 02:00Z after the March DST change (EDT)", () => {
    expect(zonedToUtc("2026-11-19", "22:00", "America/Toronto").toISOString()).toBe("2026-11-20T03:00:00.000Z");
    expect(zonedToUtc("2027-03-11", "22:00", "America/Toronto").toISOString()).toBe("2027-03-12T03:00:00.000Z"); // DST starts 14 Mar 2027
    expect(zonedToUtc("2027-03-18", "22:00", "America/Toronto").toISOString()).toBe("2027-03-19T02:00:00.000Z");
  });

  it("F03 fixtures are generated once; past kick-offs skipped; deleted weeks stay deleted", () => {
    let s = ensureSeries(initialState(), at("2026-11-12T20:00:00Z"));
    expect(s.matchDays).toHaveLength(31);
    expect(s.matchDays.every((m) => m.seriesId === SERIES.id && m.status === "open")).toBe(true);
    expect(s.audit.filter((a) => a.action === "fixtures.create")).toHaveLength(1);
    const xmas = s.matchDays.find((m) => m.date === "2026-12-24")!;
    s = deleteMatchDay(s, xmas.id, at("2026-11-13T00:00:00Z"));
    s = ensureSeries(s, at("2026-11-13T00:00:00Z"));
    expect(s.matchDays.some((m) => m.date === "2026-12-24")).toBe(false);
    const late = ensureSeries(initialState(), at("2027-06-04T12:00:00Z"));
    expect(late.matchDays.map((m) => m.date)).toEqual(["2027-06-10", "2027-06-17"]);
  });

  it("F04 v1 documents migrate: accounts added, kick-off = 10 pm local", () => {
    const old = { schemaVersion: 1, version: 3, settings: {}, audit: [], matchDays: [{ id: "m", date: "2026-10-01", status: "played", attendees: [], draw: null, events: [], selections: [], createdAt: "", scorecardAt: null, scorecardVersion: 0 }] };
    const s = migrate(old);
    expect(s.schemaVersion).toBe(2);
    expect(s.users).toEqual([]);
    expect(s.matchDays[0].kickoffAt).toBe("2026-10-02T02:00:00.000Z");
  });
});

describe("accounts", () => {
  it("A01 email is unique (case-insensitive); a roster player can be claimed by one account only", () => {
    const a = signUp(initialState(), { email: "Sanj@Example.com", name: "Sanjeev", passwordHash: "h", playerId: "sanjeev" }, at("2026-11-12T00:00:00Z"));
    expect(a.user.email).toBe("sanj@example.com");
    expect(() => signUp(a.state, { email: "sanj@example.COM", name: "X", passwordHash: "h" }, at("2026-11-12T00:00:00Z"))).toThrow(/already exists/);
    expect(() => signUp(a.state, { email: "x@y.co", name: "X", passwordHash: "h", playerId: "sanjeev" }, at("2026-11-12T00:00:00Z"))).toThrow(/already has an account/);
    expect(() => signUp(a.state, { email: "not-an-email", name: "X", passwordHash: "h" }, at("2026-11-12T00:00:00Z"))).toThrow(LedgerError);
    expect(() => signUp(a.state, { email: "x@y.co", name: "X", passwordHash: "h", playerId: "messi" }, at("2026-11-12T00:00:00Z"))).toThrow(/roster/);
  });

  it("A02 a password change bumps sessionVersion (signs out other devices) and audit never stores the hash", () => {
    const a = signUp(initialState(), { email: "a@b.co", name: "A", passwordHash: "old" }, at("2026-11-12T00:00:00Z"));
    const s = updateAccount(a.state, a.user.id, { passwordHash: "new" }, at("2026-11-12T01:00:00Z"), "admin");
    expect(s.users[0].sessionVersion).toBe(2);
    expect(s.audit.at(-1)!.action).toBe("user.reset");
    expect(JSON.stringify(s.audit)).not.toContain('"new"');
    expect(JSON.stringify(s.audit)).not.toContain('"old"');
  });
});

describe("FPL-style carry-over", () => {
  const setup = () => {
    let s = ensureSeries(initialState(), at("2026-11-12T20:00:00Z"));
    const a = signUp(s, { email: "a@b.co", name: "A", passwordHash: "h" }, at("2026-11-12T20:00:00Z"));
    s = a.state;
    const [w1, w2] = [...s.matchDays].sort((x, y) => x.kickoffAt.localeCompare(y.kickoffAt));
    s = { ...s, matchDays: s.matchDays.map((m) => (m.id === w1.id || m.id === w2.id ? { ...m, attendees: SQUAD16 } : m)) };
    return { s, uid: a.user.id, w1, w2 };
  };

  it("C01 the seven saved before a deadline carries into every later week until changed", () => {
    let { s, uid, w1, w2 } = setup();
    s = setSquad(s, uid, SEVEN, at("2026-11-15T12:00:00Z"));
    s = recordDraw(s, w1.id, DEFAULT_CONSTRAINTS, at("2026-11-20T02:50:00Z"), "a".repeat(64));
    s = recordDraw(s, w2.id, DEFAULT_CONSTRAINTS, at("2026-11-27T02:50:00Z"), "b".repeat(64));
    expect(s.matchDays.find((m) => m.id === w1.id)!.selections[0].picks).toEqual(SEVEN);
    expect(s.matchDays.find((m) => m.id === w2.id)!.selections[0].picks).toEqual(SEVEN);
  });

  it("C02 a change after the deadline counts from the next week, even if the draw happens later", () => {
    let { s, uid, w1, w2 } = setup();
    s = setSquad(s, uid, SEVEN, at("2026-11-15T12:00:00Z"));
    s = setSquad(s, uid, OTHER, at("2026-11-20T03:05:00Z")); // 10:05 pm Thursday — past kick-off
    s = recordDraw(s, w1.id, DEFAULT_CONSTRAINTS, at("2026-11-20T03:10:00Z"), "a".repeat(64)); // late draw
    s = recordDraw(s, w2.id, DEFAULT_CONSTRAINTS, at("2026-11-27T02:55:00Z"), "b".repeat(64));
    expect(s.matchDays.find((m) => m.id === w1.id)!.selections[0].picks).toEqual(SEVEN);
    expect(s.matchDays.find((m) => m.id === w2.id)!.selections[0].picks).toEqual(OTHER);
  });

  it("C03 an early draw is the deadline; users with no team are simply not in that round", () => {
    let { s, uid, w1 } = setup();
    s = setSquad(s, uid, SEVEN, at("2026-11-20T02:58:00Z")); // 9:58 pm
    s = recordDraw(s, w1.id, DEFAULT_CONSTRAINTS, at("2026-11-20T02:55:00Z"), "a".repeat(64)); // drawn 9:55 pm
    expect(s.matchDays.find((m) => m.id === w1.id)!.selections).toEqual([]);
    expect(squadAt(s.users[0], "2026-11-20T03:00:00.000Z")).toEqual(SEVEN);
  });

  it("C04 resetting a draw clears the snapshot; re-drawing re-snapshots", () => {
    let { s, uid, w1 } = setup();
    s = setSquad(s, uid, SEVEN, at("2026-11-15T12:00:00Z"));
    s = recordDraw(s, w1.id, DEFAULT_CONSTRAINTS, at("2026-11-20T02:50:00Z"), "a".repeat(64));
    s = resetDraw(s, w1.id, "late arrival", at("2026-11-20T02:52:00Z"));
    expect(s.matchDays.find((m) => m.id === w1.id)!.selections).toEqual([]);
    s = recordDraw(s, w1.id, DEFAULT_CONSTRAINTS, at("2026-11-20T02:54:00Z"), "c".repeat(64));
    expect(s.matchDays.find((m) => m.id === w1.id)!.selections).toHaveLength(1);
  });

  it("C05 next deadline skips past kick-offs and drawn match days", () => {
    const { s, w1, w2 } = setup();
    expect(nextDeadlineMatch(s, new Date("2026-11-19T12:00:00Z"))!.id).toBe(w1.id);
    expect(nextDeadlineMatch(s, new Date("2026-11-20T03:00:01Z"))!.id).toBe(w2.id);
  });
});

describe("reminders", () => {
  it("R01 within 48h of the deadline: no-team and carry-over messages; opted-out users skipped; one per slot", () => {
    let s = ensureSeries(initialState(), at("2026-11-12T20:00:00Z"));
    const a = signUp(s, { email: "a@b.co", name: "Archit S", passwordHash: "h" }, at("2026-11-12T20:00:00Z"));
    const b = signUp(a.state, { email: "b@b.co", name: "Bea", passwordHash: "h" }, at("2026-11-12T20:00:00Z"));
    const c = signUp(b.state, { email: "c@b.co", name: "Cy", passwordHash: "h" }, at("2026-11-12T20:00:00Z"));
    s = setSquad(c.state, a.user.id, SEVEN, at("2026-11-13T00:00:00Z"));
    s = updateAccount(s, c.user.id, { emailReminders: false }, at("2026-11-13T00:00:00Z"));

    expect(planReminders(s, new Date("2026-11-16T12:00:00Z"), "eve-before")).toEqual([]); // too early
    const wed = new Date("2026-11-19T00:00:00Z"); // Wed 7 pm Toronto
    const plan = planReminders(s, wed, "eve-before");
    expect(plan.map((p) => [p.name, p.kind])).toEqual([["Archit S", "carry_over"], ["Bea", "no_team"]]);
    const mail = reminderEmail(plan[0], "https://rsfc.example");
    expect(mail.subject).toMatch(/any changes to your 7/);
    expect(mail.text).toContain("Archit, Danial, Navneet");
    expect(mail.text).toContain("https://rsfc.example/team");

    s = recordReminders(s, plan[0].matchId, plan.map((p) => ({ userId: p.userId, slot: "eve-before" })), at(wed.toISOString()));
    expect(planReminders(s, wed, "eve-before")).toEqual([]);
    expect(planReminders(s, new Date("2026-11-19T17:00:00Z"), "matchday")).toHaveLength(2);
  });
});

describe("calendar feed", () => {
  it("I01 one weekly RRULE event in Toronto time, EXDATE for cancelled weeks, deadline alarms, CRLF lines ≤ 75 octets", () => {
    let s = ensureSeries(initialState(), at("2026-11-12T20:00:00Z"));
    s = deleteMatchDay(s, s.matchDays.find((m) => m.date === "2026-12-24")!.id, at("2026-11-13T00:00:00Z"));
    const ics = buildCalendar(s.matchDays, { baseUrl: "https://rsfc.example", now: new Date("2026-11-13T00:00:00Z") });
    expect(ics).toContain("DTSTART;TZID=America/Toronto:20261119T220000");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=TH;UNTIL=20270618T020000Z");
    expect(ics).toContain("EXDATE;TZID=America/Toronto:20261224T220000");
    expect(ics).toContain("TRIGGER:-P1D");
    expect(ics).toContain("SUMMARY:RSFC League: White vs Red");
    const lines = ics.split("\r\n");
    expect(lines.every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
