/**
 * Independently verify a published draw.
 *   npm run verify-draw -- <match-day-id> [path/to/export.json]
 * Reads an admin JSON export (or the local .data file) and re-runs the seed.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { isDropIn, playerName } from "../config/club";
import { verifyDraw } from "../lib/draw/draw";
import type { LeagueState } from "../lib/league/types";

const [id, file = path.join(process.cwd(), ".data", "rsfc-league.json")] = process.argv.slice(2);
const state = JSON.parse(readFileSync(file, "utf8")) as LeagueState;
const targets = id ? state.matchDays.filter((m) => m.id === id) : state.matchDays.filter((m) => m.draw);
if (!targets.length) {
  console.error(id ? `No match day ${id}` : "No draws found.");
  process.exit(1);
}
let bad = 0;
for (const m of targets) {
  if (!m.draw) continue;
  const r = verifyDraw(m.draw, isDropIn);
  if (!r.ok) bad++;
  console.log(`${r.ok ? "✓" : "✗"} ${m.date}  seed ${m.draw.seed.slice(0, 12)}…  attempt ${m.draw.attempt}  ${r.ok ? "" : r.reason}`);
  if (id) {
    console.log("  Chalk:", m.draw.teamA.map(playerName).join(", "));
    console.log("  Kit:  ", m.draw.teamB.map(playerName).join(", "));
    if (m.draw.floater) console.log("  Floater:", playerName(m.draw.floater));
  }
}
process.exit(bad ? 1 : 0);
