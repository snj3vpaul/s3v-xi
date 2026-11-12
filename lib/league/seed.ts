import { randomUUID } from "node:crypto";
import { newInviteCode } from "./crypto";
import type { Db } from "./db";
import { createUser, setResult, submitPicks, type LeagueUser } from "./service";

/** Shared password for every demo account (demo mode only — shown on the sign-in page). */
export const DEMO_PASSWORD = "demo-league";
export const DEMO_ADMIN_EMAIL = "commish@demo.league";

export function demoSeedEnabled(): boolean {
  if (process.env.LEAGUE_DEMO_SEED) return process.env.LEAGUE_DEMO_SEED === "1";
  return !process.env.DATABASE_URL; // local SQLite: look alive on first launch
}

/** Create the league row on first boot and, when enabled, fill it with demo data. */
export async function ensureLeague(db: Db): Promise<void> {
  const existing = await db.get("SELECT id FROM league_settings WHERE id = 'main'");
  if (existing) return;
  const demo = demoSeedEnabled();
  await db.run("INSERT INTO league_settings (id, name, invite_code, demo, created_at) VALUES ('main', ?, ?, ?, ?)",
    [process.env.LEAGUE_NAME?.slice(0, 40) || "The Sunday Pundits", newInviteCode(), demo ? 1 : 0, new Date().toISOString()]);
  const users = await db.get("SELECT id FROM league_users LIMIT 1");
  if (demo && !users) await seedDemo(db);
}

const PLAYERS = [
  { name: "The Commish", avatar: "👑", email: DEMO_ADMIN_EMAIL, admin: true, style: "steady" },
  { name: "Priya", avatar: "🦊", email: "priya@demo.league", style: "sharp" },
  { name: "Marcus", avatar: "🐙", email: "marcus@demo.league", style: "steady" },
  { name: "Aisha", avatar: "🌶️", email: "aisha@demo.league", style: "sharp" },
  { name: "Big Tom", avatar: "🦖", email: "tom@demo.league", style: "bold" },
  { name: "Leo", avatar: "🦁", email: "leo@demo.league", style: "draws" },
  { name: "Nadia", avatar: "🐝", email: "nadia@demo.league", style: "steady" },
  { name: "Raj", avatar: "🚀", email: "raj@demo.league", style: "bold" },
] as const;

type Fx = [home: string, away: string, dayOffset: number, hour: number, result?: [number, number]];
const ROUNDS: Array<{ name: string; fixtures: Fx[] }> = [
  { name: "Matchweek 1", fixtures: [
    ["Riverside Rovers", "Kanata Kestrels", -16, 18, [2, 1]],
    ["Orleans Owls", "Barrhaven Bulls", -16, 20, [1, 1]],
    ["Nepean Navigators", "Glebe Giants", -15, 15, [0, 2]],
    ["Westboro Wolves", "Vanier Vipers", -15, 19, [3, 1]],
  ] },
  { name: "Matchweek 2", fixtures: [
    ["Kanata Kestrels", "Orleans Owls", -9, 18, [1, 0]],
    ["Barrhaven Bulls", "Westboro Wolves", -9, 20, [2, 2]],
    ["Glebe Giants", "Riverside Rovers", -8, 15, [1, 3]],
    ["Vanier Vipers", "Nepean Navigators", -8, 19, [0, 0]],
  ] },
  { name: "Matchweek 3", fixtures: [
    ["Riverside Rovers", "Orleans Owls", 0, -2],          // kicked off 2h ago: locked, awaiting result
    ["Westboro Wolves", "Glebe Giants", 1, 19],
    ["Nepean Navigators", "Kanata Kestrels", 2, 15],
    ["Barrhaven Bulls", "Vanier Vipers", 3, 18],
  ] },
];

/** Small deterministic PRNG so the demo looks the same on every machine. */
function mulberry32(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function predict(style: string, actual: [number, number] | undefined, rand: () => number): [number, number] {
  const g = (max: number) => Math.floor(rand() * (max + 1));
  const hitChance = style === "sharp" ? 0.4 : style === "steady" ? 0.22 : 0.12;
  if (actual && rand() < hitChance) return actual;
  if (style === "bold") return rand() < 0.6 ? [3 + g(2), g(2)] : [g(1), 3 + g(2)];
  if (style === "draws" && rand() < 0.55) { const n = g(2); return [n, n]; }
  if (actual && style !== "bold" && rand() < 0.45) { // right outcome, different score
    const [h, a] = actual;
    if (h > a) return [h + 1, a]; if (h < a) return [h, a + 1]; return [h + 1, a + 1];
  }
  return [g(3), g(2)];
}

export async function seedDemo(db: Db): Promise<void> {
  const rand = mulberry32(20261112);
  const day = 86_400_000;
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const users: Array<LeagueUser & { style: string }> = [];
  for (const [i, p] of PLAYERS.entries()) {
    const u = await createUser(db, { name: p.name, email: p.email, password: DEMO_PASSWORD, avatar: p.avatar, inviteCode: "" },
      { skipInvite: true, role: "admin" in p && p.admin ? "admin" : "player", joinedAt: new Date(today.getTime() - (21 - i) * day).toISOString() });
    users.push({ ...u, style: p.style });
  }

  for (const [ri, round] of ROUNDS.entries()) {
    const roundId = randomUUID();
    await db.run("INSERT INTO league_rounds (id, name, status, created_at) VALUES (?, ?, 'open', ?)", [roundId, round.name, new Date(today.getTime() - (20 - ri * 7) * day).toISOString()]);
    const results: Array<[string, [number, number]]> = [];
    for (const [home, away, offset, hour, result] of round.fixtures) {
      const kickoff = offset === 0 ? new Date(Date.now() + hour * 3_600_000) : new Date(today.getTime() + offset * day + hour * 3_600_000);
      const fixtureId = randomUUID();
      // Insert directly with an earlier created_at; picks are written with the same server logic.
      const realDeadline = kickoff.toISOString();
      await db.run("INSERT INTO league_fixtures (id, round_id, home_team, away_team, kickoff_at, deadline_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [fixtureId, roundId, home, away, kickoff.toISOString(), realDeadline, new Date().toISOString()]);
      const pickTime = new Date(kickoff.getTime() - day).toISOString();
      for (const u of users) {
        // Leave a few upcoming picks empty so demo accounts have something to do.
        if (offset > 0 && (u.style === "steady" || rand() < 0.35)) continue;
        const [h, a] = predict(u.style, result, rand);
        await submitPicks(db, u, [{ fixtureId, home: h, away: a }], pickTime);
      }
      if (result) results.push([fixtureId, result]);
    }
    // Results go in after every fixture and pick of the round exists, like a real matchweek.
    for (const [fixtureId, [home, away]] of results) await setResult(db, fixtureId, { home, away });
  }
}
