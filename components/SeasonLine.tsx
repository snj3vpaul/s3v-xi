"use client";
import Link from "next/link";
import { useState } from "react";
import type { Moment } from "@/lib/league/moments";
import { Mascot } from "./Mascot";
import { shortDate } from "@/lib/format";

const VW = 1000;
const VH = 300;
const PAD_T = 70;
const PAD_B = 30;


/** Catmull-Rom through the points, as cubic Béziers. */
function smooth(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/**
 * Goals this season as one line across the fixtures, over a dotted pitch.
 * Each played Thursday is a marker; pick one (on the line or with the arrows)
 * to read that night's moment in the card below.
 */
export function SeasonLine({ moments, fixtures, example = false }: { moments: Moment[]; fixtures: number; example?: boolean }) {
  const [sel, setSel] = useState(moments.length - 1);
  // Show the played weeks plus a few to come, so early in the season the line isn't squashed into a corner.
  const span = Math.min(fixtures, Math.max(moments.length + 4, 8));
  const maxY = Math.max(10, Math.ceil((moments.at(-1)?.total ?? 0) * 1.15));
  const x = (week: number) => (week / span) * VW;
  const y = (v: number) => VH - PAD_B - (v / maxY) * (VH - PAD_T - PAD_B);
  const pts: [number, number][] = [[0, y(0)], ...moments.map((m, i) => [x(i + 1), y(m.total)] as [number, number])];
  const last = pts.at(-1)!;
  const m = moments[sel];

  return (
    <section className={`sline${moments.length > 10 ? " is-dense" : ""}`} aria-label="Goals this season">
      <div className="sline-head">
        <h2>Goals this season</h2>
        <p>
          {moments.at(-1)?.total ?? 0} in {moments.length} Thursday{moments.length === 1 ? "" : "s"}, week {moments.length} of {fixtures}.
          {example ? " Example season." : ""}
        </p>
      </div>
      <div className="sline-plot">
        <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" aria-hidden="true">
          <path d={smooth(pts)} className="sline-path" vectorEffect="non-scaling-stroke" />
          <path d={`M${last[0]} ${last[1]} H${VW}`} className="sline-future" vectorEffect="non-scaling-stroke" />
        </svg>
        {moments.map((mo, i) => {
          const px = (x(i + 1) / VW) * 100;
          const py = (y(mo.total) / VH) * 100;
          const on = i === sel;
          return (
            <button
              key={mo.matchId}
              type="button"
              className={`sline-mark${on ? " is-on" : ""}${px > 80 ? " flip" : ""}`}
              style={{ left: `${px}%`, top: `${py}%` }}
              aria-pressed={on}
              aria-label={`${shortDate(mo.date)}: ${mo.goals} goals, ${mo.total} for the season. ${mo.headline}.`}
              onClick={() => setSel(i)}
            >
              <span className="sline-label">
                <span className="sline-what">{mo.headline}</span>
                <span className="sline-num num">{mo.total} goals</span>
              </span>
              <i aria-hidden="true" />
            </button>
          );
        })}
        <span className="sline-axis">
          <span>Season start</span>
          <span>{span < fixtures ? `Week ${span}` : "Final week"}</span>
        </span>
      </div>

      {m && (
        <div className="sline-moments">
          <button type="button" className="deck-btn" onClick={() => setSel(Math.max(0, sel - 1))} disabled={sel === 0} aria-label="Previous Thursday">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" /></svg>
          </button>
          <article className="moment" aria-live="polite">
            <div className="moment-body">
              <p className="moment-story">{m.story}</p>
              <p className="moment-meta">
                {shortDate(m.date)}, {m.goals} goal{m.goals === 1 ? "" : "s"} on the night.{" "}
                {!example && <Link href={`/matches/${m.matchId}`}>Match report</Link>}
              </p>
            </div>
            {m.heroId && (
              <span className="moment-hero">
                <Mascot id={m.heroId} size={84} />
              </span>
            )}
          </article>
          <button type="button" className="deck-btn" onClick={() => setSel(Math.min(moments.length - 1, sel + 1))} disabled={sel === moments.length - 1} aria-label="Next Thursday">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
          </button>
        </div>
      )}
    </section>
  );
}
