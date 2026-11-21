/**
 * Leftovers of the old random draw (replaced by the team sheet on 2026-11-13).
 *
 * - `SeededRandom`: a deterministic random stream (SHA-256 in counter mode,
 *   rejection-sampled integers, Fisher–Yates shuffle). The simulation and the
 *   demo seeder use it so their example seasons are reproducible.
 * - `formatLabel`: the "8v8 · 1 floater" label for a match day's teams. Old
 *   drawn match days still carry perSide/rollingSubs/floater, so it reads both.
 */

import { createHash } from "node:crypto";
import type { DrawResult } from "@/lib/league/types";

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

/** "8v8", "8v8 · 1 rolling sub each", "7v7 + floater". */
export function formatLabel(d: Pick<DrawResult, "perSide" | "rollingSubs" | "floater"> & Partial<Pick<DrawResult, "algorithm" | "teamA" | "teamB">>): string {
  if (d.algorithm === "manual" && d.teamA && d.teamB) return `${d.teamA.length}v${d.teamB.length}`;
  let s = `${d.perSide}v${d.perSide}`;
  if (d.rollingSubs > 0) s += ` · ${d.rollingSubs} rolling sub${d.rollingSubs > 1 ? "s" : ""} each`;
  if (d.floater) s += " · 1 floater";
  return s;
}
