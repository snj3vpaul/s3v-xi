import { randomUUID } from "node:crypto";
import { AVATARS, LEAGUE_LIMITS, SCORING_RULES, type Score } from "./config";
import { hashPassword, newInviteCode, newSessionToken, sameInviteCode, sha256, verifyPassword } from "./crypto";
import type { Db } from "./db";
import { buildStandings, computeAchievements, scorePick, type Achievement, type LedgerEntry, type Reason, type ScoredPick, type StandingRow } from "./scoring";

export class LeagueError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const nowIso = () => new Date().toISOString();

// ---------------------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------------------

/** Trim, collapse whitespace and strip control characters. Rendering is escaped by React. */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}
export function cleanEmail(value: unknown): string {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(email) ? email : "";
}
export function parseInstant(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 40) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}
function goals(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > LEAGUE_LIMITS.maxGoals)
    throw new LeagueError(400, `${label} must be a whole number from 0 to ${LEAGUE_LIMITS.maxGoals}.`);
  return value;
}

// ---------------------------------------------------------------------------------------
// Settings & invite
// ---------------------------------------------------------------------------------------

export type LeagueSettings = { name: string; inviteCode: string; demo: boolean };

export async function getSettings(db: Db): Promise<LeagueSettings> {
  const row = await db.get<{ name: string; invite_code: string; demo: number }>("SELECT name, invite_code, demo FROM league_settings WHERE id = 'main'");
  if (!row) throw new LeagueError(500, "League is not initialised.");
  return { name: row.name, inviteCode: row.invite_code, demo: Boolean(row.demo) };
}

export async function regenerateInvite(db: Db): Promise<string> {
  const code = newInviteCode();
  await db.run("UPDATE league_settings SET invite_code = ? WHERE id = 'main'", [code]);
  return code;
}

export async function renameLeague(db: Db, name: unknown): Promise<void> {
  const clean = cleanText(name, 40);
  if (clean.length < 2) throw new LeagueError(400, "League name needs at least 2 characters.");
  await db.run("UPDATE league_settings SET name = ? WHERE id = 'main'", [clean]);
}

// ---------------------------------------------------------------------------------------
// Users & sessions
// ---------------------------------------------------------------------------------------

export type LeagueUser = { id: string; name: string; email: string; avatar: string; role: "admin" | "player"; status: "active" | "removed"; joinedAt: string; lastSeenAt: string | null };
type UserRow = { id: string; name: string; email: string; avatar: string; role: "admin" | "player"; status: "active" | "removed"; password_hash: string; joined_at: string; last_seen_at: string | null };
const toUser = (r: UserRow): LeagueUser => ({ id: r.id, name: r.name, email: r.email, avatar: r.avatar, role: r.role, status: r.status, joinedAt: r.joined_at, lastSeenAt: r.last_seen_at });

export type SignupInput = { name: unknown; email: unknown; password: unknown; avatar: unknown; inviteCode: unknown };

export async function createUser(db: Db, input: SignupInput, opts: { adminEmail?: string; skipInvite?: boolean; role?: "admin" | "player"; joinedAt?: string } = {}): Promise<LeagueUser> {
  const name = cleanText(input.name, LEAGUE_LIMITS.maxNameLength);
  const email = cleanEmail(input.email);
  const password = typeof input.password === "string" ? input.password : "";
  const avatar = typeof input.avatar === "string" && (AVATARS as readonly string[]).includes(input.avatar) ? input.avatar : AVATARS[0];
  if (name.length < 2) throw new LeagueError(400, "Pick a display name with at least 2 characters.");
  if (!email) throw new LeagueError(400, "That email address doesn't look right.");
  if (password.length < LEAGUE_LIMITS.minPasswordLength || password.length > 200) throw new LeagueError(400, `Passwords need at least ${LEAGUE_LIMITS.minPasswordLength} characters.`);

  const isAdminEmail = Boolean(opts.adminEmail && opts.adminEmail.trim().toLowerCase() === email);
  if (!opts.skipInvite && !isAdminEmail) {
    const { inviteCode } = await getSettings(db);
    if (typeof input.inviteCode !== "string" || !sameInviteCode(input.inviteCode, inviteCode))
      throw new LeagueError(403, "That invite code isn't valid. Ask the league admin for a fresh link.");
  }
  if (await db.get("SELECT id FROM league_users WHERE email = ?", [email])) throw new LeagueError(409, "There's already an account with that email — try signing in.");
  const user: UserRow = {
    id: randomUUID(), name, email, avatar, role: opts.role ?? (isAdminEmail ? "admin" : "player"), status: "active",
    password_hash: await hashPassword(password), joined_at: opts.joinedAt ?? nowIso(), last_seen_at: null,
  };
  await db.run("INSERT INTO league_users (id, name, email, avatar, role, status, password_hash, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [user.id, user.name, user.email, user.avatar, user.role, user.status, user.password_hash, user.joined_at]);
  return toUser(user);
}

export async function authenticate(db: Db, emailInput: unknown, password: unknown): Promise<LeagueUser> {
  const email = cleanEmail(emailInput);
  const row = email ? await db.get<UserRow>("SELECT * FROM league_users WHERE email = ?", [email]) : undefined;
  // Always run a hash so response time doesn't reveal whether the email exists.
  const ok = await verifyPassword(typeof password === "string" ? password : "", row?.password_hash ?? "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAA");
  if (!row || !ok) throw new LeagueError(401, "Email or password didn't match. Give it another go.");
  if (row.status !== "active") throw new LeagueError(403, "Your spot in this league has been paused by the admin. Give them a shout to rejoin.");
  return toUser(row);
}

export async function createSession(db: Db, userId: string): Promise<{ token: string; expiresAt: string }> {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + LEAGUE_LIMITS.sessionDays * 86_400_000).toISOString();
  await db.run("DELETE FROM league_sessions WHERE expires_at < ?", [nowIso()]);
  await db.run("INSERT INTO league_sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)", [sha256(token), userId, nowIso(), expiresAt]);
  return { token, expiresAt };
}

export async function userForSession(db: Db, token: string | undefined): Promise<LeagueUser | null> {
  if (!token || token.length > 100) return null;
  const row = await db.get<UserRow & { expires_at: string }>(
    "SELECT u.*, s.expires_at FROM league_sessions s JOIN league_users u ON u.id = s.user_id WHERE s.token_hash = ?", [sha256(token)]);
  if (!row || row.expires_at < nowIso() || row.status !== "active") return null;
  if (!row.last_seen_at || Date.now() - Date.parse(row.last_seen_at) > 5 * 60_000)
    await db.run("UPDATE league_users SET last_seen_at = ? WHERE id = ?", [nowIso(), row.id]);
  return toUser(row);
}

export async function deleteSession(db: Db, token: string | undefined) {
  if (token) await db.run("DELETE FROM league_sessions WHERE token_hash = ?", [sha256(token)]);
}

export async function updateProfile(db: Db, userId: string, input: { name?: unknown; avatar?: unknown }): Promise<void> {
  if (input.name !== undefined) {
    const name = cleanText(input.name, LEAGUE_LIMITS.maxNameLength);
    if (name.length < 2) throw new LeagueError(400, "Pick a display name with at least 2 characters.");
    await db.run("UPDATE league_users SET name = ? WHERE id = ?", [name, userId]);
  }
  if (input.avatar !== undefined) {
    if (typeof input.avatar !== "string" || !(AVATARS as readonly string[]).includes(input.avatar)) throw new LeagueError(400, "Pick an avatar from the list.");
    await db.run("UPDATE league_users SET avatar = ? WHERE id = ?", [input.avatar, userId]);
  }
}

// ---------------------------------------------------------------------------------------
// Rounds & fixtures
// ---------------------------------------------------------------------------------------

export type RoundStatus = "open" | "locked" | "scored";
type RoundRow = { id: string; name: string; status: RoundStatus; created_at: string };
type FixtureRow = {
  id: string; round_id: string; home_team: string; away_team: string; kickoff_at: string; deadline_at: string;
  actual_home_goals: number | null; actual_away_goals: number | null; result_entered_at: string | null; created_at: string;
};

export type RoundSummary = {
  id: string; name: string; status: RoundStatus; createdAt: string;
  fixtureCount: number; resultsIn: number; firstKickoff: string | null; lastKickoff: string | null;
  nextDeadline: string | null; picksOpen: number;
};

export function fixtureLocked(f: Pick<FixtureRow, "deadline_at" | "actual_home_goals">, roundStatus: RoundStatus, now = nowIso()): boolean {
  return roundStatus !== "open" || now >= f.deadline_at || f.actual_home_goals !== null;
}

function summarise(round: RoundRow, fixtures: FixtureRow[], now: string): RoundSummary {
  const kicks = fixtures.map((f) => f.kickoff_at).sort();
  const open = fixtures.filter((f) => !fixtureLocked(f, round.status, now));
  return {
    id: round.id, name: round.name, status: round.status, createdAt: round.created_at,
    fixtureCount: fixtures.length, resultsIn: fixtures.filter((f) => f.actual_home_goals !== null).length,
    firstKickoff: kicks[0] ?? null, lastKickoff: kicks[kicks.length - 1] ?? null,
    nextDeadline: open.map((f) => f.deadline_at).sort()[0] ?? null, picksOpen: open.length,
  };
}

/** Rounds in chronological order (by first kick-off; empty rounds last, by creation). */
export async function listRounds(db: Db): Promise<RoundSummary[]> {
  const [rounds, fixtures] = await Promise.all([
    db.all<RoundRow>("SELECT * FROM league_rounds"),
    db.all<FixtureRow>("SELECT * FROM league_fixtures"),
  ]);
  const now = nowIso();
  return rounds
    .map((r) => summarise(r, fixtures.filter((f) => f.round_id === r.id), now))
    .sort((a, b) => (a.firstKickoff ?? "9999").localeCompare(b.firstKickoff ?? "9999") || a.createdAt.localeCompare(b.createdAt));
}

export async function createRound(db: Db, name: unknown): Promise<string> {
  const clean = cleanText(name, LEAGUE_LIMITS.maxRoundNameLength);
  if (clean.length < 2) throw new LeagueError(400, "Give the round a name, e.g. “Matchweek 8”.");
  const id = randomUUID();
  await db.run("INSERT INTO league_rounds (id, name, status, created_at) VALUES (?, ?, 'open', ?)", [id, clean, nowIso()]);
  return id;
}

async function getRoundRow(db: Db, id: string): Promise<RoundRow> {
  const round = await db.get<RoundRow>("SELECT * FROM league_rounds WHERE id = ?", [id]);
  if (!round) throw new LeagueError(404, "That round doesn't exist (any more).");
  return round;
}

export async function updateRound(db: Db, id: string, input: { name?: unknown; status?: unknown }): Promise<void> {
  const round = await getRoundRow(db, id);
  if (input.name !== undefined) {
    const clean = cleanText(input.name, LEAGUE_LIMITS.maxRoundNameLength);
    if (clean.length < 2) throw new LeagueError(400, "Round names need at least 2 characters.");
    await db.run("UPDATE league_rounds SET name = ? WHERE id = ?", [clean, id]);
  }
  if (input.status !== undefined) {
    if (input.status !== "open" && input.status !== "locked") throw new LeagueError(400, "Rounds can be opened or locked; “scored” happens automatically when every result is in.");
    if (round.status === "scored") throw new LeagueError(409, "This round is fully scored. Clear a result first if you need to reopen it.");
    await db.run("UPDATE league_rounds SET status = ? WHERE id = ?", [input.status, id]);
    if (input.status === "locked") await db.run("UPDATE league_picks SET locked = 1 WHERE fixture_id IN (SELECT id FROM league_fixtures WHERE round_id = ?)", [id]);
  }
}

export async function deleteRound(db: Db, id: string): Promise<void> {
  await getRoundRow(db, id);
  await db.tx(async (t) => {
    await t.run("DELETE FROM league_points_ledger WHERE round_id = ?", [id]);
    await t.run("DELETE FROM league_picks WHERE fixture_id IN (SELECT id FROM league_fixtures WHERE round_id = ?)", [id]);
    await t.run("DELETE FROM league_fixtures WHERE round_id = ?", [id]);
    await t.run("DELETE FROM league_rounds WHERE id = ?", [id]);
  });
}

export type FixtureInput = { homeTeam: unknown; awayTeam: unknown; kickoffAt: unknown; deadlineAt?: unknown };

function validateFixture(input: FixtureInput) {
  const home = cleanText(input.homeTeam, LEAGUE_LIMITS.maxTeamNameLength);
  const away = cleanText(input.awayTeam, LEAGUE_LIMITS.maxTeamNameLength);
  const kickoff = parseInstant(input.kickoffAt);
  if (!home || !away) throw new LeagueError(400, "Both team names are needed.");
  if (home.toLowerCase() === away.toLowerCase()) throw new LeagueError(400, "A team can't play itself (however tempting).");
  if (!kickoff) throw new LeagueError(400, "Kick-off needs a valid date and time.");
  let deadline = new Date(Date.parse(kickoff) - LEAGUE_LIMITS.lockMinutesBeforeKickoff * 60_000).toISOString();
  if (input.deadlineAt !== undefined && input.deadlineAt !== null && input.deadlineAt !== "") {
    const custom = parseInstant(input.deadlineAt);
    if (!custom) throw new LeagueError(400, "Pick deadline needs a valid date and time.");
    if (custom > kickoff) throw new LeagueError(400, "The pick deadline can't be after kick-off.");
    deadline = custom;
  }
  return { home, away, kickoff, deadline };
}

export async function addFixture(db: Db, roundId: string, input: FixtureInput): Promise<string> {
  const round = await getRoundRow(db, roundId);
  const { home, away, kickoff, deadline } = validateFixture(input);
  const count = await db.all("SELECT id FROM league_fixtures WHERE round_id = ?", [roundId]);
  if (count.length >= LEAGUE_LIMITS.maxFixturesPerRound) throw new LeagueError(400, `A round can hold up to ${LEAGUE_LIMITS.maxFixturesPerRound} fixtures.`);
  const id = randomUUID();
  await db.run("INSERT INTO league_fixtures (id, round_id, home_team, away_team, kickoff_at, deadline_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, roundId, home, away, kickoff, deadline, nowIso()]);
  // A fully scored round gets a new fixture to predict: reopen it so picks are accepted.
  if (round.status === "scored") await db.run("UPDATE league_rounds SET status = 'open' WHERE id = ?", [roundId]);
  return id;
}

async function getFixtureRow(db: Db, id: string): Promise<FixtureRow> {
  const f = await db.get<FixtureRow>("SELECT * FROM league_fixtures WHERE id = ?", [id]);
  if (!f) throw new LeagueError(404, "That fixture doesn't exist (any more).");
  return f;
}

export async function updateFixture(db: Db, id: string, input: FixtureInput): Promise<void> {
  await getFixtureRow(db, id);
  const { home, away, kickoff, deadline } = validateFixture(input);
  await db.run("UPDATE league_fixtures SET home_team = ?, away_team = ?, kickoff_at = ?, deadline_at = ? WHERE id = ?", [home, away, kickoff, deadline, id]);
}

export async function deleteFixture(db: Db, id: string): Promise<void> {
  const f = await getFixtureRow(db, id);
  await db.tx(async (t) => {
    await t.run("DELETE FROM league_points_ledger WHERE fixture_id = ?", [id]);
    await t.run("DELETE FROM league_picks WHERE fixture_id = ?", [id]);
    await t.run("DELETE FROM league_fixtures WHERE id = ?", [id]);
    await syncRoundStatus(t, f.round_id);
  });
}

/** Mark a round scored when every fixture has a result; step back to locked if one is cleared. */
async function syncRoundStatus(db: Db, roundId: string) {
  const round = await db.get<RoundRow>("SELECT * FROM league_rounds WHERE id = ?", [roundId]);
  if (!round) return;
  const fixtures = await db.all<FixtureRow>("SELECT * FROM league_fixtures WHERE round_id = ?", [roundId]);
  const complete = fixtures.length > 0 && fixtures.every((f) => f.actual_home_goals !== null);
  if (complete && round.status !== "scored") await db.run("UPDATE league_rounds SET status = 'scored' WHERE id = ?", [roundId]);
  if (!complete && round.status === "scored") await db.run("UPDATE league_rounds SET status = 'locked' WHERE id = ?", [roundId]);
}

/** Rebuild the ledger rows for one fixture from its picks and result. Idempotent. */
async function rescoreFixture(db: Db, f: FixtureRow) {
  await db.run("DELETE FROM league_points_ledger WHERE fixture_id = ?", [f.id]);
  if (f.actual_home_goals === null || f.actual_away_goals === null) return;
  const result = { home: f.actual_home_goals, away: f.actual_away_goals };
  const picks = await db.all<{ user_id: string; predicted_home_goals: number; predicted_away_goals: number }>(
    "SELECT user_id, predicted_home_goals, predicted_away_goals FROM league_picks WHERE fixture_id = ?", [f.id]);
  const at = nowIso();
  for (const p of picks) {
    const { points, reason } = scorePick({ home: p.predicted_home_goals, away: p.predicted_away_goals }, result);
    await db.run("INSERT INTO league_points_ledger (id, user_id, fixture_id, round_id, points_awarded, reason, rules_version, computed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [randomUUID(), p.user_id, f.id, f.round_id, points, reason, SCORING_RULES.version, at]);
  }
}

/** Admin enters (or clears with null) the real scoreline. Points recalculate immediately. */
export async function setResult(db: Db, fixtureId: string, result: { home: unknown; away: unknown } | null, opts: { allowBeforeKickoff?: boolean } = {}): Promise<void> {
  const f = await getFixtureRow(db, fixtureId);
  let home: number | null = null, away: number | null = null;
  if (result) {
    home = goals(result.home, "Home score");
    away = goals(result.away, "Away score");
    if (!opts.allowBeforeKickoff && nowIso() < f.kickoff_at) throw new LeagueError(409, "This one hasn't kicked off yet — no time travel allowed ⏳");
  }
  await db.tx(async (t) => {
    await t.run("UPDATE league_fixtures SET actual_home_goals = ?, actual_away_goals = ?, result_entered_at = ? WHERE id = ?", [home, away, result ? nowIso() : null, fixtureId]);
    if (result) await t.run("UPDATE league_picks SET locked = 1 WHERE fixture_id = ?", [fixtureId]);
    await rescoreFixture(t, { ...f, actual_home_goals: home, actual_away_goals: away });
    await syncRoundStatus(t, f.round_id);
  });
}

/** Recalculate every ledger row — use after changing SCORING_RULES. */
export async function recomputeAll(db: Db): Promise<number> {
  const fixtures = await db.all<FixtureRow>("SELECT * FROM league_fixtures");
  await db.tx(async (t) => { for (const f of fixtures) await rescoreFixture(t, f); });
  return fixtures.length;
}

// ---------------------------------------------------------------------------------------
// Picks
// ---------------------------------------------------------------------------------------

export type PickInput = { fixtureId: unknown; home: unknown; away: unknown };
export type PickResult = { saved: string[]; rejected: Array<{ fixtureId: string; reason: string }> };

/** Server-side source of truth for deadlines: the client clock is never trusted. */
export async function submitPicks(db: Db, user: LeagueUser, picks: PickInput[], now = nowIso()): Promise<PickResult> {
  if (!Array.isArray(picks) || picks.length === 0) throw new LeagueError(400, "No picks to save.");
  if (picks.length > LEAGUE_LIMITS.maxFixturesPerRound) throw new LeagueError(400, "Too many picks in one go.");
  const seen = new Set<string>();
  const out: PickResult = { saved: [], rejected: [] };
  await db.tx(async (t) => {
    for (const p of picks) {
      const fixtureId = typeof p.fixtureId === "string" ? p.fixtureId.slice(0, 64) : "";
      if (!fixtureId || seen.has(fixtureId)) { out.rejected.push({ fixtureId, reason: "Duplicate or missing fixture." }); continue; }
      seen.add(fixtureId);
      let home: number, away: number;
      try { home = goals(p.home, "Home score"); away = goals(p.away, "Away score"); }
      catch (err) { out.rejected.push({ fixtureId, reason: (err as Error).message }); continue; }
      const f = await t.get<FixtureRow & { status: RoundStatus }>(
        "SELECT f.*, r.status FROM league_fixtures f JOIN league_rounds r ON r.id = f.round_id WHERE f.id = ?", [fixtureId]);
      if (!f) { out.rejected.push({ fixtureId, reason: "Fixture not found." }); continue; }
      if (fixtureLocked(f, f.status, now)) { out.rejected.push({ fixtureId, reason: "Too late — picks for this match are locked 🔒" }); continue; }
      await t.run(
        `INSERT INTO league_picks (id, fixture_id, user_id, predicted_home_goals, predicted_away_goals, submitted_at, updated_at, locked)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT (fixture_id, user_id) DO UPDATE SET predicted_home_goals = excluded.predicted_home_goals,
           predicted_away_goals = excluded.predicted_away_goals, updated_at = excluded.updated_at
         WHERE league_picks.locked = 0`,
        [randomUUID(), fixtureId, user.id, home, away, now, now]);
      out.saved.push(fixtureId);
    }
  });
  return out;
}

// ---------------------------------------------------------------------------------------
// Round view (what a player sees)
// ---------------------------------------------------------------------------------------

export type PublicPick = { userId: string; name: string; avatar: string; home: number; away: number; points: number | null; reason: Reason | null };
export type FixtureView = {
  id: string; homeTeam: string; awayTeam: string; kickoffAt: string; deadlineAt: string; locked: boolean;
  result: Score | null; myPick: (Score & { submittedAt: string; updatedAt: string }) | null;
  myPoints: { points: number; reason: Reason } | null;
  /** Everyone's picks — only populated once the fixture is locked (pick secrecy). */
  picks: PublicPick[] | null; pickCount: number;
};
export type RoundView = { round: RoundSummary; fixtures: FixtureView[]; myTotal: number; memberCount: number };

export async function getRoundView(db: Db, roundId: string, viewer: LeagueUser): Promise<RoundView> {
  const round = await getRoundRow(db, roundId);
  const now = nowIso();
  const fixtures = await db.all<FixtureRow>("SELECT * FROM league_fixtures WHERE round_id = ? ORDER BY kickoff_at, home_team", [roundId]);
  const picks = await db.all<{ fixture_id: string; user_id: string; predicted_home_goals: number; predicted_away_goals: number; submitted_at: string; updated_at: string; locked: number; name: string; avatar: string; status: string }>(
    `SELECT p.fixture_id, p.user_id, p.predicted_home_goals, p.predicted_away_goals, p.submitted_at, p.updated_at, p.locked, u.name, u.avatar, u.status
     FROM league_picks p JOIN league_users u ON u.id = p.user_id JOIN league_fixtures f ON f.id = p.fixture_id WHERE f.round_id = ?`, [roundId]);
  const ledger = await db.all<{ fixture_id: string; user_id: string; points_awarded: number; reason: Reason }>(
    "SELECT fixture_id, user_id, points_awarded, reason FROM league_points_ledger WHERE round_id = ?", [roundId]);
  const members = await db.all("SELECT id FROM league_users WHERE status = 'active'");
  const pts = new Map(ledger.map((l) => [`${l.fixture_id}:${l.user_id}`, l]));

  // Persist the lock flag lazily once a deadline has passed (the check above is authoritative).
  const newlyLocked = fixtures.filter((f) => fixtureLocked(f, round.status, now) && picks.some((p) => p.fixture_id === f.id && !p.locked));
  for (const f of newlyLocked) await db.run("UPDATE league_picks SET locked = 1 WHERE fixture_id = ?", [f.id]);

  let myTotal = 0;
  const views: FixtureView[] = fixtures.map((f) => {
    const locked = fixtureLocked(f, round.status, now);
    const fp = picks.filter((p) => p.fixture_id === f.id);
    const mine = fp.find((p) => p.user_id === viewer.id);
    const myL = pts.get(`${f.id}:${viewer.id}`);
    if (myL) myTotal += myL.points_awarded;
    return {
      id: f.id, homeTeam: f.home_team, awayTeam: f.away_team, kickoffAt: f.kickoff_at, deadlineAt: f.deadline_at, locked,
      result: f.actual_home_goals === null || f.actual_away_goals === null ? null : { home: f.actual_home_goals, away: f.actual_away_goals },
      myPick: mine ? { home: mine.predicted_home_goals, away: mine.predicted_away_goals, submittedAt: mine.submitted_at, updatedAt: mine.updated_at } : null,
      myPoints: myL ? { points: myL.points_awarded, reason: myL.reason } : null,
      pickCount: fp.filter((p) => p.status === "active").length,
      picks: locked
        ? fp.filter((p) => p.status === "active").map((p) => {
            const l = pts.get(`${f.id}:${p.user_id}`);
            return { userId: p.user_id, name: p.name, avatar: p.avatar, home: p.predicted_home_goals, away: p.predicted_away_goals, points: l?.points_awarded ?? null, reason: l?.reason ?? null };
          }).sort((a, b) => (b.points ?? -1) - (a.points ?? -1) || a.name.localeCompare(b.name))
        : null,
    };
  });
  return { round: summarise(round, fixtures, now), fixtures: views, myTotal, memberCount: members.length };
}

// ---------------------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------------------

export type LeaderboardRow = StandingRow & { achievements: Achievement[] };
export type Leaderboard = { rows: LeaderboardRow[]; rounds: Array<{ id: string; name: string }>; latestRound: { id: string; name: string } | null };

export async function getLeaderboard(db: Db): Promise<Leaderboard> {
  const users = await db.all<{ id: string; name: string; avatar: string }>("SELECT id, name, avatar FROM league_users WHERE status = 'active'");
  const rounds = await listRounds(db);
  const ledgerRows = await db.all<{ user_id: string; fixture_id: string; round_id: string; points_awarded: number; reason: Reason }>(
    "SELECT user_id, fixture_id, round_id, points_awarded, reason FROM league_points_ledger");
  const ledger: LedgerEntry[] = ledgerRows.map((l) => ({ userId: l.user_id, fixtureId: l.fixture_id, roundId: l.round_id, points: l.points_awarded, reason: l.reason }));
  const standings = buildStandings(users, rounds, ledger);

  const scored = await db.all<{ user_id: string; fixture_id: string; kickoff_at: string; ph: number; pa: number; ah: number; aa: number; reason: Reason }>(
    `SELECT l.user_id, l.fixture_id, f.kickoff_at, p.predicted_home_goals AS ph, p.predicted_away_goals AS pa,
            f.actual_home_goals AS ah, f.actual_away_goals AS aa, l.reason
     FROM league_points_ledger l JOIN league_fixtures f ON f.id = l.fixture_id
     JOIN league_picks p ON p.fixture_id = l.fixture_id AND p.user_id = l.user_id`);
  const scoredPicks: ScoredPick[] = scored.map((r) => ({ userId: r.user_id, fixtureId: r.fixture_id, kickoffAt: r.kickoff_at, pick: { home: r.ph, away: r.pa }, result: { home: r.ah, away: r.aa }, reason: r.reason }));
  const achievements = computeAchievements(users.map((u) => u.id), scoredPicks);

  const scoredRoundIds = new Set(ledger.map((l) => l.roundId));
  const shownRounds = rounds.filter((r) => scoredRoundIds.has(r.id)).map((r) => ({ id: r.id, name: r.name }));
  return {
    rows: standings.map((s) => ({ ...s, achievements: achievements[s.id] ?? [] })),
    rounds: shownRounds,
    latestRound: shownRounds[shownRounds.length - 1] ?? null,
  };
}

/** Exact hits for one player — drives the confetti celebration. */
export async function exactHitsFor(db: Db, userId: string): Promise<Array<{ fixtureId: string; label: string }>> {
  const rows = await db.all<{ fixture_id: string; home_team: string; away_team: string; actual_home_goals: number; actual_away_goals: number }>(
    `SELECT l.fixture_id, f.home_team, f.away_team, f.actual_home_goals, f.actual_away_goals FROM league_points_ledger l
     JOIN league_fixtures f ON f.id = l.fixture_id WHERE l.user_id = ? AND l.reason = 'exact' ORDER BY f.kickoff_at DESC`, [userId]);
  return rows.map((r) => ({ fixtureId: r.fixture_id, label: `${r.home_team} ${r.actual_home_goals}–${r.actual_away_goals} ${r.away_team}` }));
}

// ---------------------------------------------------------------------------------------
// Members (admin)
// ---------------------------------------------------------------------------------------

export type Member = LeagueUser & { pickCount: number; points: number };

export async function listMembers(db: Db): Promise<Member[]> {
  const users = await db.all<UserRow>("SELECT * FROM league_users ORDER BY joined_at");
  const picks = await db.all<{ user_id: string }>("SELECT user_id FROM league_picks");
  const ledger = await db.all<{ user_id: string; points_awarded: number }>("SELECT user_id, points_awarded FROM league_points_ledger");
  return users.map((u) => ({
    ...toUser(u),
    pickCount: picks.filter((p) => p.user_id === u.id).length,
    points: ledger.filter((l) => l.user_id === u.id).reduce((a, l) => a + l.points_awarded, 0),
  }));
}

/** Removing is gentle: history is kept, they vanish from the table and can be restored. */
export async function setMemberStatus(db: Db, actor: LeagueUser, userId: string, status: unknown): Promise<void> {
  if (status !== "active" && status !== "removed") throw new LeagueError(400, "Unknown member status.");
  if (userId === actor.id) throw new LeagueError(400, "You can't bench yourself, Commish.");
  const target = await db.get<UserRow>("SELECT * FROM league_users WHERE id = ?", [userId]);
  if (!target) throw new LeagueError(404, "Member not found.");
  await db.run("UPDATE league_users SET status = ? WHERE id = ?", [status, userId]);
  if (status === "removed") await db.run("DELETE FROM league_sessions WHERE user_id = ?", [userId]);
}

export type AdminFixture = { id: string; roundId: string; homeTeam: string; awayTeam: string; kickoffAt: string; deadlineAt: string; result: Score | null; pickCount: number };

export async function listAdminFixtures(db: Db): Promise<AdminFixture[]> {
  const fixtures = await db.all<FixtureRow>("SELECT * FROM league_fixtures ORDER BY kickoff_at, home_team");
  const picks = await db.all<{ fixture_id: string }>("SELECT p.fixture_id FROM league_picks p JOIN league_users u ON u.id = p.user_id WHERE u.status = 'active'");
  return fixtures.map((f) => ({
    id: f.id, roundId: f.round_id, homeTeam: f.home_team, awayTeam: f.away_team, kickoffAt: f.kickoff_at, deadlineAt: f.deadline_at,
    result: f.actual_home_goals === null || f.actual_away_goals === null ? null : { home: f.actual_home_goals, away: f.actual_away_goals },
    pickCount: picks.filter((p) => p.fixture_id === f.id).length,
  }));
}
