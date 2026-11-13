/**
 * Writes a DEMO season to .data/rsfc-league.json so you can preview the
 * tables and charts locally. Uses the real ledger functions, so every draw is
 * a genuine seeded draw and every scorecard passes validation.
 *
 *   npm run seed:demo          # refuses to overwrite real data
 *   npm run seed:demo -- --force
 *
 * Never run this against production storage. To start the real season, delete
 * .data/rsfc-league.json (or flush the Redis key).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { FORMATION, MEMBERS, DROPINS, PICKABLE, POSITIONS, ROSTER } from "../config/club";
import { SeededRandom } from "../lib/draw/draw";
import { DEFAULT_CONSTRAINTS, createMatchDay, initialState, recordDraw, saveScorecard, setSquad, signUp, type Ctx } from "../lib/league/ledger";
import { scryptSync, randomBytes } from "node:crypto";
import type { GoalEvent, GoalKind, LeagueState, Side } from "../lib/league/types";

const FILE = path.join(process.cwd(), ".data", "rsfc-league.json");
if (existsSync(FILE) && !process.argv.includes("--force")) {
  const cur = JSON.parse(readFileSync(FILE, "utf8")) as LeagueState;
  if (!cur.demo && cur.matchDays.length) {
    console.error("Refusing to overwrite real league data. Pass --force if you're sure.");
    process.exit(1);
  }
}

const rng = new SeededRandom("d".repeat(64), 7);
const pick = <T,>(a: readonly T[]) => a[rng.int(a.length)];
const ctxAt = (iso: string): Ctx => ({ now: new Date(iso), newId: () => randomUUID() });
// A few players are sharper finishers / creators, so the charts have shape.
const finishing: Record<string, number> = { vikram: 4, jaskaran: 3, savi: 3, raunak: 3, ghous: 2, harpreet: 2 };
const creating: Record<string, number> = { archit: 4, navneet: 3, tadas: 3, karminder: 2, sanjeev: 2 };
const weighted = (ids: string[], w: Record<string, number>) => {
  const bag = ids.flatMap((id) => Array(w[id] ?? 1).fill(id) as string[]);
  return pick(bag);
};

/** A random seven in the Pick 7 formation (2 DEF · 2 CM · 1 CAM · 2 ATT). */
const randomSeven = () => POSITIONS.flatMap((pos) => rng.shuffle(PICKABLE.filter((p) => p.position === pos).map((p) => p.id)).slice(0, FORMATION[pos]));

let state = initialState();
// Demo accounts: password "demo-league" for all. Same hash format as lib/server/password.ts.
const salt = randomBytes(16);
const demoHash = `scrypt$${salt.toString("hex")}$${scryptSync("demo-league", salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex")}`;
const userIds: string[] = [];
for (const p of rng.shuffle(MEMBERS.map((m) => m.id)).slice(0, 12)) {
  const name = ROSTER.find((r) => r.id === p)!.name;
  const r = signUp(state, { email: `${p}@demo.rsfc`, name, passwordHash: demoHash, playerId: p }, ctxAt("2026-09-01T12:00:00Z"));
  state = r.state;
  userIds.push(r.user.id);
}
const dates = ["2026-09-10", "2026-09-17", "2026-09-24", "2026-10-01", "2026-10-08", "2026-10-15", "2026-10-22", "2026-10-29", "2026-11-05"];

dates.forEach((date, di) => {
  const members = rng.shuffle(MEMBERS.map((p) => p.id)).slice(0, 13 + rng.int(5));
  const drops = rng.shuffle(DROPINS.map((p) => p.id)).slice(0, rng.int(3));
  const attendees = [...members, ...drops];
  const c = createMatchDay(state, { date, attendees, seriesId: "demo" }, ctxAt(`${date}T13:00:00Z`));
  state = c.state;
  // Some accounts tweak their seven each week; the rest carry over (FPL-style).
  for (const uid of userIds) {
    if (di === 0 || rng.int(3) === 0) state = setSquad(state, uid, randomSeven(), ctxAt(`${date}T15:00:00Z`));
  }
  state = recordDraw(state, c.match.id, DEFAULT_CONSTRAINTS, ctxAt(`${date}T22:00:00-04:00`));
  const d = state.matchDays.find((m) => m.id === c.match.id)!.draw!;
  const team = (s: Side) => [...(s === "A" ? d.teamA : d.teamB), ...(d.floater ? [d.floater] : [])];
  const events: GoalEvent[] = [];
  const goals = 3 + rng.int(7);
  for (let g = 0; g < goals; g++) {
    const side: Side = rng.int(2) ? "A" : "B";
    const other: Side = side === "A" ? "B" : "A";
    const roll = rng.int(100);
    const kind: GoalKind = roll < 4 ? "own_goal" : roll < 7 ? "deflection" : roll < 12 ? "penalty" : roll < 15 ? "free_kick" : roll < 30 ? "header" : "open_play";
    const minute = 2 + rng.int(78);
    if (kind === "own_goal") {
      events.push({ id: randomUUID(), side, kind, scorerId: pick(team(other)), minute });
      continue;
    }
    const scorerId = weighted(team(side), finishing);
    const mates = team(side).filter((x) => x !== scorerId);
    const assistId = kind === "free_kick" || (kind === "penalty" && rng.int(4)) || rng.int(10) < 3 ? null : weighted(mates, creating);
    const e: GoalEvent = { id: randomUUID(), side, kind, scorerId, assistId, minute };
    if (kind === "deflection") {
      e.deflectedById = pick(team(other));
      e.deflectionRuling = rng.int(2) ? "own_goal" : "goal";
    }
    events.push(e);
  }
  events.sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
  state = saveScorecard(state, c.match.id, events, {}, ctxAt(`${date}T23:30:00-04:00`));
  if (di === 2) {
    // One demo correction so the audit trail has something to show.
    const fixed = events.map((e, i) => (i === 0 && e.kind === "open_play" ? { ...e, assistId: null } : e));
    state = saveScorecard(state, c.match.id, fixed, { reason: "Demo: first goal was a solo run" }, ctxAt(`${date}T23:50:00-04:00`));
  }
});

// The real Thursday fixtures (19 Nov onwards) are generated automatically on first page load.
state = { ...state, demo: true, version: 1 };
mkdirSync(path.dirname(FILE), { recursive: true });
writeFileSync(FILE, JSON.stringify(state, null, 2));
console.log(`Demo season written to ${FILE}: ${dates.length} played Thursdays, ${userIds.length} demo accounts (e.g. ${ROSTER.find((r) => r.id === state.users[0].playerId)!.id}@demo.rsfc / demo-league).`);
