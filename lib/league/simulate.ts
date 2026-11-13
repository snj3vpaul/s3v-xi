/**
 * Example data for the "Sample Thursday" page and the example season on Stats.
 *
 * Everything runs through the REAL ledger (signUp, setSquad, recordDraw,
 * saveScorecard) on a throwaway in-memory league, so the points, breakdowns
 * and charts are exactly what the live site would show for the same night.
 * Nothing here is ever saved. Deterministic for a given seed.
 */
import { createHash } from "node:crypto";
import { FORMATION, PICKABLE, POSITIONS, ROSTER } from "@/config/club";
import { SERIES } from "@/config/schedule";
import { SeededRandom } from "@/lib/draw/draw";
import { DEFAULT_CONSTRAINTS, createMatchDay, initialState, recordDraw, saveScorecard, setSquad, signUp, type Ctx } from "./ledger";
import { zonedToUtc } from "./schedule";
import type { FairPlayBreach, FairPlayLoss, GoalEvent, GoalKind, LeagueState, RotationLapse, RotationMiss, Side } from "./types";

/** Made-up Pick 7 players, so example picks are never pinned on real club members. */
export const EXAMPLE_SELECTORS = ["Alex", "Sam", "Jordan", "Riley", "Casey", "Morgan", "Taylor", "Jamie"];

/** Turn any text into the 64-hex seed format the draw expects. */
export const toSeed = (s: string) => createHash("sha256").update(`rsfc-sim:${s}`).digest("hex");

/** A short, URL-friendly random seed for "simulate another". */
export const randomSimSeed = () => Math.random().toString(36).slice(2, 8);

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface Simulation {
  state: LeagueState;
  /** Example selector ids (account ids), in EXAMPLE_SELECTORS order. */
  selectors: string[];
}

/**
 * Simulate `weeks` Thursdays from the first fixture. Each week:
 * 14–17 players turn up, the real seeded draw splits them, 2–9 goals are
 * scored (open play, penalties, free kicks, own goals; most with an assist),
 * a Man of the Match is picked per team, and now and then someone loses
 * fair play or skips their goalkeeper / sub turn.
 */
export function simulateSeason(seedText: string, weeks = 1, opts: { showcase?: boolean } = {}): Simulation {
  /** Showcase: every week includes each kind of event (for the "Sample Thursday" explainer). */
  const showcase = !!opts.showcase;
  const seed = toSeed(seedText);
  const rng = new SeededRandom(seed, 0);
  const pick = <T,>(a: readonly T[]) => a[rng.int(a.length)];
  let n = 0;
  const ctxAt = (iso: string): Ctx => ({ now: new Date(iso), newId: () => `sim-${++n}` });

  let state = initialState();
  const selectors: string[] = [];
  for (const name of EXAMPLE_SELECTORS) {
    const r = signUp(state, { email: `${name.toLowerCase()}@example.invalid`, name, passwordHash: "x" }, ctxAt("2026-11-12T12:00:00Z"));
    state = r.state;
    selectors.push(r.user.id);
  }
  // Some players are sharper finishers or creators, so a season has shape.
  const finish: Record<string, number> = { vikram: 4, karminder: 3, harpreet: 3, nakul: 2, inder: 2, ghous: 2, robin: 2, danish: 2 };
  const create: Record<string, number> = { robin: 3, ghous: 3, abrar: 2, tadas: 2, navneet: 2, raunak: 2, danish: 2 };
  const weighted = (ids: string[], w: Record<string, number>) => pick(ids.flatMap((id) => Array(w[id] ?? 1).fill(id) as string[]));
  const randomSeven = () => POSITIONS.flatMap((pos) => rng.shuffle(PICKABLE.filter((p) => p.position === pos).map((p) => p.id)).slice(0, FORMATION[pos]));

  for (let w = 0; w < weeks; w++) {
    const date = addDays(SERIES.start, 7 * w);
    const kickoff = zonedToUtc(date, SERIES.time, SERIES.timeZone);
    const before = new Date(kickoff.getTime() - 3 * 3_600_000).toISOString();

    // Pick 7: everyone picks in week 1; afterwards a few tweak their seven.
    for (const id of selectors) {
      if (w === 0 || rng.int(3) === 0) {
        try {
          state = setSquad(state, id, randomSeven(), ctxAt(before));
        } catch {
          /* over budget after a re-rating: they keep last week's seven */
        }
      }
    }

    // Showcase nights have an odd headcount, so the floater rule shows up too.
    const headcount = showcase ? 15 + 2 * rng.int(2) : 14 + rng.int(4);
    const attendees = rng.shuffle(ROSTER.map((p) => p.id)).slice(0, headcount);
    const c = createMatchDay(state, { date, attendees }, ctxAt(before));
    state = recordDraw(c.state, c.match.id, DEFAULT_CONSTRAINTS, ctxAt(new Date(kickoff.getTime() - 600_000).toISOString()), toSeed(`${seedText}:${w}`));
    const d = state.matchDays.find((m) => m.id === c.match.id)!.draw!;
    const team = (s: Side) => [...(s === "A" ? d.teamA : d.teamB), ...(d.floater ? [d.floater] : [])];

    const events: GoalEvent[] = [];
    const goals = showcase ? 5 + rng.int(4) : 2 + rng.int(8);
    // Showcase: guarantee an own goal, a penalty and an assisted goal, in random slots.
    const forced: (GoalKind | null)[] = Array(goals).fill(null);
    if (showcase) {
      const slots = rng.shuffle([...Array(goals).keys()]);
      forced[slots[0]] = "own_goal";
      forced[slots[1]] = "penalty";
      forced[slots[2]] = "open_play";
    }
    for (let g = 0; g < goals; g++) {
      const side: Side = rng.int(2) ? "A" : "B";
      const other: Side = side === "A" ? "B" : "A";
      const roll = rng.int(100);
      const kind: GoalKind = forced[g] ?? (roll < 7 ? "own_goal" : roll < 15 ? "penalty" : roll < 20 ? "free_kick" : "open_play");
      const minute = 2 + rng.int(58);
      if (kind === "own_goal") {
        events.push({ id: `sim-g${++n}`, side, kind, scorerId: pick(team(other)), minute });
        continue;
      }
      const scorerId = weighted(team(side), finish);
      const assisted = kind === "open_play" && (forced[g] === "open_play" || rng.int(10) < 7);
      const assistId = assisted ? weighted(team(side).filter((x) => x !== scorerId), create) : null;
      events.push({ id: `sim-g${++n}`, side, kind, scorerId, assistId, minute });
    }
    events.sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));

    // MOTM: usually the side's best performer on the night, sometimes a surprise.
    const involvement = (id: string) => events.filter((e) => e.kind !== "own_goal" && (e.scorerId === id || e.assistId === id)).length;
    const motmFor = (s: Side) => {
      const ids = s === "A" ? d.teamA : d.teamB;
      if (rng.int(4) === 0) return pick(ids);
      return [...ids].sort((a, b) => involvement(b) - involvement(a) || rng.int(3) - 1)[0];
    };

    const breaches: FairPlayBreach[] = ["foul", "card", "dissent", "dangerous"];
    const lapses: RotationLapse[] = ["gk", "sub"];
    const pool = rng.shuffle([...attendees]);
    const fairPlayLost: FairPlayLoss[] = pool.slice(0, showcase ? 1 : rng.int(3)).map((playerId) => ({ playerId, reason: pick(breaches) }));
    const rotationMissed: RotationMiss[] = pool.slice(5, 5 + (showcase ? 1 : rng.int(3))).map((playerId) => ({ playerId, reason: pick(lapses) }));

    state = saveScorecard(
      state,
      c.match.id,
      events,
      { motm: { A: motmFor("A"), B: motmFor("B") }, fairPlayLost, rotationMissed, rotationChecked: true },
      ctxAt(new Date(kickoff.getTime() + 2 * 3_600_000).toISOString()),
    );
  }
  return { state: { ...state, demo: true }, selectors };
}
