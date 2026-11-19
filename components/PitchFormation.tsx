"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { getPlayer, playerName, type Position } from "@/config/club";
import type { Side } from "@/lib/league/types";
import { Mascot } from "@/components/Mascot";

/**
 * A team from the team sheet laid out on a pitch in a tactical shape.
 *
 * Only seven are on the field at once (keeper + six). Anyone beyond seven waits
 * on the touchline. On every page load a fresh shape is drawn and, moments
 * later, a sub comes on and someone else goes off. Whoever went off is
 * remembered (per match and team) and goes to the back of the queue, so each
 * refresh takes the next player off until everyone has had a turn.
 */

export const ON_FIELD = 7;

type Role = "GK" | Position;
/** x: 0 = own goal line, 100 = opponent's. y: 0 = top touchline, 100 = bottom. */
interface Slot { x: number; y: number; role: Role }
type Line = [x: number, role: Role, n: number];

/** Tactical shapes by number of outfield players (field minus the keeper). */
const SHAPES: Record<number, { name: string; lines: Line[] }[]> = {
  6: [
    { name: "2-3-1", lines: [[27, "DEF", 2], [55, "CM", 3], [83, "ATT", 1]] },
    { name: "3-2-1", lines: [[26, "DEF", 3], [53, "CM", 2], [83, "ATT", 1]] },
    { name: "2-1-2-1", lines: [[25, "DEF", 2], [44, "CM", 1], [63, "CAM", 2], [85, "ATT", 1]] },
    { name: "3-1-2", lines: [[26, "DEF", 3], [51, "CM", 1], [78, "ATT", 2]] },
    { name: "2-2-2", lines: [[27, "DEF", 2], [53, "CM", 2], [80, "ATT", 2]] },
    { name: "1-3-2", lines: [[25, "DEF", 1], [50, "CM", 3], [78, "ATT", 2]] },
  ],
  5: [
    { name: "2-2-1", lines: [[27, "DEF", 2], [55, "CM", 2], [83, "ATT", 1]] },
    { name: "2-1-2", lines: [[27, "DEF", 2], [50, "CM", 1], [78, "ATT", 2]] },
    { name: "1-2-1-1", lines: [[25, "DEF", 1], [46, "CM", 2], [66, "CAM", 1], [85, "ATT", 1]] },
  ],
  4: [
    { name: "2-1-1", lines: [[28, "DEF", 2], [55, "CM", 1], [82, "ATT", 1]] },
    { name: "1-2-1", lines: [[28, "DEF", 1], [54, "CM", 2], [82, "ATT", 1]] },
  ],
  3: [{ name: "1-1-1", lines: [[30, "DEF", 1], [55, "CM", 1], [80, "ATT", 1]] }],
  2: [{ name: "1-1", lines: [[35, "DEF", 1], [70, "ATT", 1]] }],
  1: [{ name: "1", lines: [[55, "CM", 1]] }],
};

/** Which positions suit a slot, best first. */
const SUITS: Record<Role, (Position | null)[]> = {
  GK: [],
  DEF: ["DEF", "CM"],
  CM: ["CM", "CAM", "DEF"],
  CAM: ["CAM", "CM", "ATT"],
  ATT: ["ATT", "CAM"],
};

const BENCH_Y = 116; // touchline strip under the pitch
const SWAP_AFTER_MS = 1300;

function shuffle<T>(list: readonly T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function read(key: string): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function write(key: string, v: string[]) {
  try { window.localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage blocked: fine */ }
}

interface Lineup {
  shape: string;
  slots: Slot[];
  /** Player per slot before the sub. */
  start: string[];
  /** Waiting on the touchline at load (one of them comes on). */
  bench: string[];
  /** Slot index of the player who goes off, or -1 when nobody is waiting. */
  offIndex: number;
}

function drawLineup(ids: string[], key: string): Lineup {
  const fieldN = Math.min(ON_FIELD, ids.length);
  const outfield = Math.max(0, fieldN - 1);
  const options = SHAPES[outfield] ?? [];
  const shape = options.length ? options[Math.floor(Math.random() * options.length)] : { name: "", lines: [] as Line[] };
  const slots: Slot[] = fieldN ? [{ x: 7, y: 50, role: "GK" }] : [];
  for (const [x, role, n] of shape.lines) for (let i = 0; i < n; i++) slots.push({ x, y: ((i + 1) * 100) / (n + 1), role });

  // Rotation queue: who's been off least recently goes off next. Anyone new joins the front.
  const offHistory = read(key).filter((id) => ids.includes(id)); // oldest → newest
  const neverOff = shuffle(ids.filter((id) => !offHistory.includes(id)));
  const queue = [...neverOff, ...offHistory]; // next to go off first

  const extra = ids.length - fieldN; // how many start on the touchline
  // The player going off must start on the field; the ones waiting are those who went off most recently.
  const goingOff = extra > 0 ? queue[0] : null;
  const bench = extra > 0 ? [...offHistory].reverse().filter((id) => id !== goingOff).slice(0, extra) : [];
  // Not enough history yet: fill the touchline from the back of the queue.
  for (const id of [...queue].reverse()) if (bench.length < extra && id !== goingOff && !bench.includes(id)) bench.push(id);

  // Place the starters by position; the keeper is whoever is left (everyone takes a turn in goal).
  const starters = shuffle(ids.filter((id) => !bench.includes(id)));
  const start = new Array<string>(slots.length);
  const used = new Set<string>();
  for (let pass = 0; pass < 3; pass++) {
    slots.forEach((s, i) => {
      if (s.role === "GK" || start[i]) return;
      const want = SUITS[s.role][pass];
      if (!want) return;
      const p = starters.find((id) => !used.has(id) && getPlayer(id)?.position === want);
      if (p) { start[i] = p; used.add(p); }
    });
  }
  slots.forEach((s, i) => {
    if (start[i]) return;
    const p = starters.find((id) => !used.has(id))!;
    start[i] = p;
    used.add(p);
  });

  let offIndex = -1;
  if (goingOff) {
    offIndex = start.indexOf(goingOff);
    if (slots[offIndex]?.role === "GK") {
      // Keepers don't get hooked mid-game here: swap them into an outfield spot first.
      const j = slots.findIndex((s) => s.role !== "GK");
      [start[offIndex], start[j]] = [start[j], start[offIndex]];
      offIndex = j;
    }
    write(key, [...offHistory.filter((id) => id !== goingOff), goingOff]);
  }
  return { shape: shape.name, slots, start, bench, offIndex };
}

export function PitchFormation({ ids, side, matchId, label }: { ids: string[]; side: Side; matchId: string; label: string }) {
  const [lineup, setLineup] = useState<Lineup | null>(null);
  const [swapped, setSwapped] = useState(false);
  const roster = ids.join(",");

  useEffect(() => {
    // Drawn on the client so every refresh is different (and server HTML never mismatches).
    setSwapped(false);
    setLineup(drawLineup(roster ? roster.split(",") : [], `rsfc:rotation:${matchId}:${side}`));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setSwapped(true); return; }
    const t = window.setTimeout(() => setSwapped(true), SWAP_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [roster, matchId, side]);

  const subOn = lineup && lineup.offIndex >= 0 ? lineup.bench[0] : null;
  const subOff = lineup && lineup.offIndex >= 0 ? lineup.start[lineup.offIndex] : null;

  // Touchline spots, spread along the strip under the pitch.
  const benchX = (i: number, n: number) => 50 + (i - (n - 1) / 2) * 13;

  type Person = { id: string; x: number; y: number; gk: boolean; benched: boolean };
  const people: Person[] = [];
  if (lineup) {
    const benchNow = swapped && subOn ? [subOff!, ...lineup.bench.filter((id) => id !== subOn)] : lineup.bench;
    lineup.start.forEach((id, i) => {
      if (swapped && i === lineup.offIndex) return;
      people.push({ id, x: lineup.slots[i].x, y: lineup.slots[i].y, gk: lineup.slots[i].role === "GK", benched: false });
    });
    if (swapped && subOn) {
      const s = lineup.slots[lineup.offIndex];
      people.push({ id: subOn, x: s.x, y: s.y, gk: false, benched: false });
    }
    benchNow.forEach((id, i) => people.push({ id, x: benchX(i, benchNow.length), y: BENCH_Y, gk: false, benched: true }));
  }

  const n = ids.length;
  return (
    <figure className={`pitch-card pitch-${side}`} aria-label={`${label}${lineup?.shape ? `, ${lineup.shape}` : ""}`}>
      <div className="pitch-head">
        <span>{n}-a-side{lineup?.shape ? ` · ${lineup.shape}` : ""}</span>
        <span className="pitch-count">{Math.min(ON_FIELD, n)} on{n > ON_FIELD ? ` · ${n - ON_FIELD} off` : ""}</span>
      </div>
      <div className="pitch-wrap">
        <div className="pitch" aria-hidden="true">
          <i className="pl-half" />
          <i className="pl-circle" />
          <i className="pl-box pl-box-l" />
          <i className="pl-box pl-box-r" />
        </div>
        {n > ON_FIELD && <div className="bench-line" aria-hidden="true"><span>Subs</span></div>}
        <ul className="pitch-players">
          {people.map((p, i) => (
            <li
              key={p.id}
              className={`pp${p.gk ? " pp-gk" : ""}${p.benched ? " pp-bench" : ""}`}
              style={{ left: `${p.x}%`, top: `${(p.y / 124) * 100}%`, ["--i" as string]: i } as CSSProperties}
            >
              <Mascot id={p.id} variant="head" size={38} />
              <span className="pp-name">{playerName(p.id)}{p.gk ? " (GK)" : ""}</span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="pitch-cap" aria-live="polite">
        {swapped && subOn && subOff ? (
          <>
            <span className="sub-in">▲ {playerName(subOn)}</span> on for <span className="sub-out">▼ {playerName(subOff)}</span>
          </>
        ) : n > ON_FIELD ? (
          <>Rolling subs: everyone takes a turn off.</>
        ) : (
          <>&nbsp;</>
        )}
      </figcaption>
    </figure>
  );
}
