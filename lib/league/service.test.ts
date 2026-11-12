import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate, openPostgres, openSqlite, type Db } from "./db";
import { ensureLeague, seedDemo } from "./seed";
import {
  addFixture, authenticate, createRound, createSession, createUser, deleteFixture, getLeaderboard, getRoundView, getSettings,
  LeagueError, listRounds, recomputeAll, regenerateInvite, setMemberStatus, setResult, submitPicks, updateRound, userForSession, type LeagueUser,
} from "./service";

const engines: Array<[string, () => Promise<Db>]> = [["sqlite", () => openSqlite(":memory:")]];
if (process.env.TEST_DATABASE_URL) engines.push(["postgres", () => openPostgres(process.env.TEST_DATABASE_URL!)]);

const hours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

describe.each(engines)("league service on %s", (engine, open) => {
  let db: Db;
  let admin: LeagueUser, ana: LeagueUser, ben: LeagueUser;
  let invite: string;

  beforeAll(async () => {
    process.env.LEAGUE_DEMO_SEED = "0";
    db = await open();
    if (engine === "postgres") {
      for (const t of ["league_points_ledger", "league_picks", "league_fixtures", "league_rounds", "league_sessions", "league_users", "league_settings"])
        await db.run(`DROP TABLE IF EXISTS ${t} CASCADE`);
    }
    await migrate(db);
    await ensureLeague(db);
    invite = (await getSettings(db)).inviteCode;
  }, 30_000);
  afterAll(async () => { await db.close?.(); });

  it("signs up with invite only; admin email bypasses invite", async () => {
    await expect(createUser(db, { name: "Ana", email: "ana@x.test", password: "password1", avatar: "🦊", inviteCode: "WRONG" })).rejects.toMatchObject({ status: 403 });
    admin = await createUser(db, { name: "Boss", email: "boss@x.test", password: "password1", avatar: "👑", inviteCode: "" }, { adminEmail: "BOSS@x.test" });
    expect(admin.role).toBe("admin");
    ana = await createUser(db, { name: "  Ana  ", email: "ANA@x.test", password: "password1", avatar: "🦊", inviteCode: invite.toLowerCase() });
    expect(ana).toMatchObject({ name: "Ana", email: "ana@x.test", role: "player" });
    ben = await createUser(db, { name: "Ben", email: "ben@x.test", password: "password1", avatar: "not-an-emoji", inviteCode: invite });
    expect(ben.avatar).toBe("🦊");
    await expect(createUser(db, { name: "Ana2", email: "ana@x.test", password: "password1", avatar: "🦊", inviteCode: invite })).rejects.toMatchObject({ status: 409 });
    await expect(createUser(db, { name: "Short", email: "s@x.test", password: "short", avatar: "🦊", inviteCode: invite })).rejects.toMatchObject({ status: 400 });
  }, 30_000);

  it("authenticates and resolves sessions", async () => {
    await expect(authenticate(db, "ana@x.test", "nope-nope")).rejects.toBeInstanceOf(LeagueError);
    const u = await authenticate(db, "Ana@X.test", "password1");
    const { token } = await createSession(db, u.id);
    expect((await userForSession(db, token))?.id).toBe(ana.id);
    expect(await userForSession(db, "garbage")).toBeNull();
  }, 30_000);

  it("enforces deadlines server-side, hides picks until lock, and scores 3/1/0", async () => {
    const roundId = await createRound(db, "Matchweek 1");
    const past = await addFixture(db, roundId, { homeTeam: "Reds", awayTeam: "Blues", kickoffAt: hours(-1) });
    const f1 = await addFixture(db, roundId, { homeTeam: "Greens", awayTeam: "Golds", kickoffAt: hours(2) });
    const f2 = await addFixture(db, roundId, { homeTeam: "Owls", awayTeam: "Bulls", kickoffAt: hours(3) });
    await expect(addFixture(db, roundId, { homeTeam: "Owls", awayTeam: "owls", kickoffAt: hours(3) })).rejects.toMatchObject({ status: 400 });

    const late = await submitPicks(db, ana, [{ fixtureId: past, home: 1, away: 0 }]);
    expect(late.saved).toEqual([]);
    expect(late.rejected[0].reason).toMatch(/locked/);

    const bad = await submitPicks(db, ana, [{ fixtureId: f1, home: -1, away: 0 }, { fixtureId: f2, home: 1.5, away: 0 }]);
    expect(bad.saved).toEqual([]);

    const dup = await submitPicks(db, ana, [{ fixtureId: f1, home: 2, away: 1 }, { fixtureId: f1, home: 0, away: 0 }]);
    expect(dup.saved).toEqual([f1]); expect(dup.rejected).toHaveLength(1);
    await submitPicks(db, ana, [{ fixtureId: f1, home: 2, away: 1 }, { fixtureId: f2, home: 1, away: 1 }]);
    await submitPicks(db, ben, [{ fixtureId: f1, home: 3, away: 0 }, { fixtureId: f2, home: 0, away: 2 }]);
    await submitPicks(db, admin, [{ fixtureId: f1, home: 0, away: 1 }]);

    // Before lock: Ana sees only her own pick.
    let view = await getRoundView(db, roundId, ana);
    const v1 = view.fixtures.find((f) => f.id === f1)!;
    expect(v1.myPick).toMatchObject({ home: 2, away: 1 });
    expect(v1.picks).toBeNull();
    expect(v1.pickCount).toBe(3);

    // Results can't be entered before kick-off…
    await expect(setResult(db, f1, { home: 2, away: 1 })).rejects.toMatchObject({ status: 409 });
    // …simulate kick-off by moving times into the past, then enter results.
    await db.run("UPDATE league_fixtures SET kickoff_at = ?, deadline_at = ? WHERE id IN (?, ?)", [hours(-0.5), hours(-0.5), f1, f2]);
    expect((await submitPicks(db, ben, [{ fixtureId: f1, home: 2, away: 1 }])).saved).toEqual([]);
    await setResult(db, f1, { home: 2, away: 1 });
    await setResult(db, f2, { home: 1, away: 1 });
    await expect(setResult(db, past, { home: 99, away: 0 })).rejects.toMatchObject({ status: 400 });

    view = await getRoundView(db, roundId, ana);
    const after1 = view.fixtures.find((f) => f.id === f1)!;
    expect(after1.picks?.map((p) => [p.name, p.points])).toEqual([["Ana", 3], ["Ben", 1], ["Boss", 0]]);
    expect(view.myTotal).toBe(6); // 3 exact + 3 exact (1-1)
    expect(view.round.status).toBe("open"); // `past` fixture still lacks a result

    await setResult(db, past, { home: 0, away: 0 });
    expect((await listRounds(db)).find((r) => r.id === roundId)!.status).toBe("scored");

    const board = await getLeaderboard(db);
    expect(board.rows.map((r) => [r.name, r.total, r.rank])).toEqual([["Ana", 6, 1], ["Ben", 1, 2], ["Boss", 0, 3]]);
    expect(board.rows[0].achievements.map((a) => a.id)).toContain("oracle");

    // Correcting a result rescores immediately and is idempotent.
    await setResult(db, f1, { home: 3, away: 0 });
    await recomputeAll(db);
    const fixed = await getLeaderboard(db);
    expect(fixed.rows.map((r) => [r.name, r.total, r.rank])).toEqual([["Ana", 4, 1], ["Ben", 3, 2], ["Boss", 0, 3]]);

    // Clearing a result un-scores the round.
    await setResult(db, past, null);
    expect((await listRounds(db)).find((r) => r.id === roundId)!.status).toBe("locked");
    await deleteFixture(db, past);
    expect((await listRounds(db)).find((r) => r.id === roundId)!.status).toBe("scored");
  }, 30_000);

  it("locks a round manually and shows movement across rounds with shared ranks", async () => {
    const r2 = await createRound(db, "Matchweek 2");
    const f = await addFixture(db, r2, { homeTeam: "A", awayTeam: "B", kickoffAt: hours(5) });
    await submitPicks(db, ben, [{ fixtureId: f, home: 1, away: 0 }]);
    await submitPicks(db, admin, [{ fixtureId: f, home: 1, away: 0 }]);
    await updateRound(db, r2, { status: "locked" });
    expect((await submitPicks(db, ana, [{ fixtureId: f, home: 1, away: 0 }])).saved).toEqual([]);
    expect((await getRoundView(db, r2, ana)).fixtures[0].picks).toHaveLength(2); // visible once locked
    // Regression: adding a fixture to a fully scored round reopens it for picks.
    const r3 = await createRound(db, "Cup");
    const c1 = await addFixture(db, r3, { homeTeam: "C", awayTeam: "D", kickoffAt: hours(-2) });
    await setResult(db, c1, { home: 1, away: 1 });
    expect((await listRounds(db)).find((r) => r.id === r3)!.status).toBe("scored");
    const c2 = await addFixture(db, r3, { homeTeam: "E", awayTeam: "F", kickoffAt: hours(4) });
    expect((await submitPicks(db, ana, [{ fixtureId: c2, home: 0, away: 0 }])).saved).toEqual([c2]);
    await db.run("DELETE FROM league_rounds WHERE id = ?", [r3]);
    await setResult(db, f, { home: 1, away: 0 }, { allowBeforeKickoff: true });
    const board = await getLeaderboard(db);
    const ben2 = board.rows.find((r) => r.id === ben.id)!;
    expect(ben2.total).toBe(6); expect(ben2.rank).toBe(1); expect(ben2.movement).toBe(1);
    expect(board.rows.find((r) => r.id === ana.id)!.rank).toBe(2);
    expect(board.rounds.map((r) => r.name)).toEqual(["Matchweek 1", "Matchweek 2"]);
  }, 30_000);

  it("removes members gracefully and rotates invites", async () => {
    await expect(setMemberStatus(db, admin, admin.id, "removed")).rejects.toMatchObject({ status: 400 });
    await setMemberStatus(db, admin, ben.id, "removed");
    await expect(authenticate(db, "ben@x.test", "password1")).rejects.toMatchObject({ status: 403 });
    expect((await getLeaderboard(db)).rows.map((r) => r.id)).not.toContain(ben.id);
    await setMemberStatus(db, admin, ben.id, "active");
    const code = await regenerateInvite(db);
    expect(code).not.toBe(invite);
    await expect(createUser(db, { name: "Cy", email: "cy@x.test", password: "password1", avatar: "🦁", inviteCode: invite })).rejects.toMatchObject({ status: 403 });
  }, 30_000);
});

describe("demo seed", () => {
  it("creates 8 players, two scored rounds and a live round", async () => {
    const db = await openSqlite(":memory:");
    await migrate(db);
    process.env.LEAGUE_DEMO_SEED = "1";
    await ensureLeague(db);
    const rounds = await listRounds(db);
    expect(rounds.map((r) => [r.name, r.status])).toEqual([["Matchweek 1", "scored"], ["Matchweek 2", "scored"], ["Matchweek 3", "open"]]);
    const board = await getLeaderboard(db);
    expect(board.rows).toHaveLength(8);
    expect(board.rows.some((r) => r.movement !== null && r.movement !== 0)).toBe(true);
    expect(board.rows.some((r) => r.exact > 0)).toBe(true);
    expect(board.rows.every((r) => r.played === 8)).toBe(true); // everyone picked all 8 completed fixtures
    expect((await getSettings(db)).demo).toBe(true);
    void seedDemo;
    await db.close?.();
  }, 60_000);
});
