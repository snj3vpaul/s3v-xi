/**
 * RSFC match-day draw — auditable, constraint-aware random team split.
 *
 * Fairness & audit:
 *   - The seed is 256 bits from `crypto.randomBytes` (CSPRNG), generated
 *     server-side at the moment of the draw and stored with the result.
 *   - Randomness is derived from the seed with SHA-256 in counter mode:
 *       block_k = SHA-256(`${seed}:${attempt}:${k}`) → eight uint32 values.
 *     Anyone holding the seed, the attendee list and the recorded inputs can
 *     re-run the draw and get the identical teams (`verifyDraw`, or
 *     `npm run verify-draw`).
 *   - Integers are drawn with rejection sampling (no modulo bias) and the
 *     shuffle is Fisher–Yates, so every ordering is equally likely.
 *   - Constraints are enforced by rejection: attempt 0, 1, 2 … each re-shuffles
 *     from the same seed until one satisfies every rule. The winning attempt
 *     number is recorded. Rejection keeps the result uniformly random among
 *     the valid splits.
 *
 * Headcount rules (documented on /rules):
 *   - Everyone who turns up plays. Teams are split as evenly as possible.
 *   - On-pitch format = min(maxPerSide, floor(n / 2)) per side, e.g. 16 → 8v8,
 *     14 → 7v7, 18 with max 8 → 8v8 + 1 rolling sub each side.
 *   - Fewer than 2 × minPerSide attendees → no draw (play it as a kickabout).
 *   - ODD headcount → one FLOATER: the attendee with the fewest previous
 *     floater stints (ties broken by the seeded shuffle). The floater plays the
 *     first half for one team (seeded coin flip) and swaps at half-time, so the
 *     job rotates fairly through the squad over a season. The floater's goals
 *     and assists score normally whichever team they were playing for.
 */

import { createHash, randomBytes } from "node:crypto";
import type { DrawConstraints, DrawResult, Side } from "@/lib/league/types";

export const DRAW_ALGORITHM = "sha256-ctr-fisher-yates-v1" as const;
export const MAX_ATTEMPTS = 2000;

export function generateSeed(): string {
  return randomBytes(32).toString("hex");
}

/** Deterministic random stream from (seed, attempt). */
export class SeededRandom {
  private block = 0;
  private buf: number[] = [];
  constructor(
    private readonly seed: string,
    private readonly attempt: number,
  ) {}

  nextUint32(): number {
    if (this.buf.length === 0) {
      const digest = createHash("sha256").update(`${this.seed}:${this.attempt}:${this.block++}`).digest();
      for (let i = 0; i < 32; i += 4) this.buf.push(digest.readUInt32BE(i));
    }
    return this.buf.shift()!;
  }

  /** Uniform integer in [0, n) via rejection sampling. */
  int(n: number): number {
    if (!Number.isInteger(n) || n <= 0) throw new RangeError("n must be a positive integer");
    const limit = Math.floor(0x1_0000_0000 / n) * n;
    for (;;) {
      const x = this.nextUint32();
      if (x < limit) return x % n;
    }
  }

  shuffle<T>(items: readonly T[]): T[] {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

export class DrawError extends Error {}

export interface DrawInput {
  attendees: readonly string[];
  constraints: DrawConstraints;
  seed: string;
  isDropIn: (id: string) => boolean;
  /** Previous match day's teams (for avoid-repeat). */
  previousTeams?: { A: string[]; B: string[] } | null;
  /** How many times each player has been the floater before. */
  floaterCounts?: Record<string, number>;
  minPerSide?: number;
  now?: () => Date;
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

export function isRepeatOf(teams: { A: readonly string[]; B: readonly string[] }, prev: { A: readonly string[]; B: readonly string[] } | null | undefined) {
  if (!prev) return false;
  return (sameSet(teams.A, prev.A) && sameSet(teams.B, prev.B)) || (sameSet(teams.A, prev.B) && sameSet(teams.B, prev.A));
}

interface Attempt {
  teamA: string[];
  teamB: string[];
  floater: string | null;
  floaterFirstHalf: Side | null;
}

function oneAttempt(input: DrawInput, attendees: string[], attempt: number): Attempt {
  const rng = new SeededRandom(input.seed, attempt);
  const order = rng.shuffle(attendees);
  const counts = input.floaterCounts ?? {};

  let floater: string | null = null;
  let floaterFirstHalf: Side | null = null;
  if (order.length % 2 === 1) {
    // Fewest previous floater stints wins; seeded order breaks ties.
    floater = order.reduce((best, id) => ((counts[id] ?? 0) < (counts[best] ?? 0) ? id : best), order[0]);
    floaterFirstHalf = rng.int(2) === 0 ? "A" : "B";
  }
  const rest = order.filter((id) => id !== floater);
  const half = rest.length / 2;
  const A: string[] = [];
  const B: string[] = [];

  if (input.constraints.splitDropIns) {
    const drops = rest.filter(input.isDropIn);
    const members = rest.filter((id) => !input.isDropIn(id));
    const flip = rng.int(2);
    drops.forEach((id, i) => ((i + flip) % 2 === 0 ? A : B).push(id));
    for (const id of members) (A.length < half ? A : B).push(id);
  } else {
    A.push(...rest.slice(0, half));
    B.push(...rest.slice(half));
  }
  return { teamA: A.sort(), teamB: B.sort(), floater, floaterFirstHalf };
}

/** Returns the list of constraint violations for a candidate split (empty = valid). */
export function violations(c: Attempt, input: DrawInput): string[] {
  const out: string[] = [];
  const side = (id: string) => (c.teamA.includes(id) ? "A" : c.teamB.includes(id) ? "B" : null);
  for (const [x, y] of input.constraints.keepTogether) {
    const sx = side(x);
    const sy = side(y);
    if (sx && sy && sx !== sy) out.push(`keep-together ${x}+${y}`);
  }
  for (const [x, y] of input.constraints.keepApart) {
    const sx = side(x);
    const sy = side(y);
    if (sx && sy && sx === sy) out.push(`keep-apart ${x}/${y}`);
  }
  if (input.constraints.avoidRepeat && isRepeatOf({ A: c.teamA, B: c.teamB }, input.previousTeams))
    out.push("repeat of previous teams");
  return out;
}

export function drawTeams(input: DrawInput): DrawResult {
  const attendees = [...new Set(input.attendees)].sort();
  const minPerSide = input.minPerSide ?? 3;
  if (attendees.length < minPerSide * 2)
    throw new DrawError(`Need at least ${minPerSide * 2} players for a draw (have ${attendees.length}).`);
  if (!/^[0-9a-f]{16,}$/i.test(input.seed)) throw new DrawError("Seed must be a hex string.");

  const key = (p: [string, string]) => [...p].sort().join("|");
  const together = new Set(input.constraints.keepTogether.map(key));
  const clash = input.constraints.keepApart.find((p) => together.has(key(p)));
  if (clash) throw new DrawError(`${clash[0]} and ${clash[1]} are set to be both together and apart.`);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const c = oneAttempt(input, attendees, attempt);
    if (violations(c, input).length === 0) {
      const teamSize = c.teamA.length;
      const perSide = Math.min(input.constraints.maxPerSide, teamSize);
      return {
        algorithm: DRAW_ALGORITHM,
        seed: input.seed,
        attempt,
        constraints: input.constraints,
        attendees,
        floaterCounts: Object.fromEntries(attendees.map((id) => [id, input.floaterCounts?.[id] ?? 0])),
        previousTeams: input.previousTeams ?? null,
        teamA: c.teamA,
        teamB: c.teamB,
        floater: c.floater,
        floaterFirstHalf: c.floaterFirstHalf,
        perSide,
        rollingSubs: teamSize - perSide,
        drawnAt: (input.now?.() ?? new Date()).toISOString(),
      };
    }
  }
  throw new DrawError(
    `No split satisfies these rules after ${MAX_ATTEMPTS} tries. Remove a keep-together/keep-apart pair or turn off "avoid repeat".`,
  );
}

/** Re-run a recorded draw from its own inputs and confirm the teams match. */
export function verifyDraw(draw: DrawResult, isDropIn: (id: string) => boolean): { ok: boolean; reason?: string } {
  if (draw.algorithm !== DRAW_ALGORITHM) return { ok: false, reason: `Unknown algorithm ${draw.algorithm}` };
  try {
    const again = drawTeams({
      attendees: draw.attendees,
      constraints: draw.constraints,
      seed: draw.seed,
      isDropIn,
      previousTeams: draw.previousTeams,
      floaterCounts: draw.floaterCounts,
      minPerSide: 1,
    });
    const ok =
      again.attempt === draw.attempt &&
      sameSet(again.teamA, draw.teamA) &&
      sameSet(again.teamB, draw.teamB) &&
      again.floater === draw.floater &&
      again.floaterFirstHalf === draw.floaterFirstHalf;
    return ok ? { ok } : { ok, reason: "Re-running the seed produced different teams." };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

/** "8v8", "8v8 · 1 rolling sub each", "7v7 + floater". */
export function formatLabel(d: Pick<DrawResult, "perSide" | "rollingSubs" | "floater"> & Partial<Pick<DrawResult, "algorithm" | "teamA" | "teamB">>): string {
  if (d.algorithm === "manual" && d.teamA && d.teamB) return `${d.teamA.length}v${d.teamB.length}`;
  let s = `${d.perSide}v${d.perSide}`;
  if (d.rollingSubs > 0) s += ` · ${d.rollingSubs} rolling sub${d.rollingSubs > 1 ? "s" : ""} each`;
  if (d.floater) s += " · 1 floater";
  return s;
}
