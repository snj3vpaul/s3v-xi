import { describe, expect, it } from "vitest";
import type { MatchDay } from "./types";
import type { StandingRow } from "@/lib/scoring/rules";
import { FIXED_TOP, FORM, formMoves, formOvr, roundChange, squadWithForm } from "./ratingForm";
import { ratingFor } from "./ratings";
import { deriveSeason } from "./derive";
import { simulateSeason } from "./simulate";

const match = (id: string, day: number) => ({ id, kickoffAt: `2026-11-${String(day).padStart(2, "0")}T03:00:00.000Z` }) as MatchDay;
const row = (playerId: string, perMatch: Record<string, number>) => ({ playerId, perMatch }) as StandingRow;

describe("rating form", () => {
  it("F01 scores a round against the night's average", () => {
    expect([roundChange(15, 5), roundChange(8, 5), roundChange(6, 5), roundChange(2, 5), roundChange(-1, 5)]).toEqual([2, 1, 0, -1, -2]);
  });

  it("F02 adds up over rounds, ignores rounds not played, and caps the drift", () => {
    const ms = Array.from({ length: 6 }, (_, i) => match(`m${i}`, 19 + i));
    const per = (v: number) => Object.fromEntries(ms.map((m) => [m.id, v]));
    const moves = formMoves(ms, [row("inder", per(20)), row("vikram", per(0)), row("harry", {}), row("archit", per(5)), row("savi", per(-5))]);
    // Inder is scouted at the 85 ceiling: he can't rise, so every round shows 0.
    expect(moves.get("inder")!.total).toBe(0);
    const up = formMoves(ms, [row("archit", per(20)), row("vikram", per(0))]);
    expect(up.get("archit")!.total).toBe(FORM.maxDrift);
    expect(up.get("archit")!.rounds.at(-1)!.change).toBe(0);
    expect(moves.get("vikram")!.total).toBeLessThan(0);
    expect(moves.get("harry")!.total).toBe(0);
    expect(moves.get("savi")!.total).toBe(0);
  });

  it("F03 keeps the top three fixed and above everyone else", () => {
    expect(FIXED_TOP).toEqual(["savi", "navneet", "tadas"]);
    expect(formOvr(88, -4, true)).toBe(88);
    expect(formOvr(85, 5, false)).toBe(FORM.ceiling);
    expect(formOvr(66, -20, false)).toBe(FORM.floor);
    const { played, standings } = deriveSeason(simulateSeason("formtest", 8).state);
    const squad = squadWithForm(formMoves(played, standings));
    expect(squad.slice(0, 3).map((r) => r.id).sort()).toEqual([...FIXED_TOP].sort());
    for (const id of FIXED_TOP) expect(squad.find((r) => r.id === id)!.ovr).toBe(ratingFor(id)!.ovr);
    for (const r of squad.slice(3)) expect(r.ovr).toBeLessThanOrEqual(FORM.ceiling);
  });

  it("F04 a card that moves lands exactly on its new OVR and keeps its shape", () => {
    const moves = new Map([["inder", { total: -3, last: -1, rounds: [], fixed: false }]]);
    const inder = squadWithForm(moves).find((r) => r.id === "inder")!;
    expect(inder.ovr).toBe(ratingFor("inder")!.ovr - 3);
    expect(inder.traits).toEqual(ratingFor("inder")!.traits);
  });
});
