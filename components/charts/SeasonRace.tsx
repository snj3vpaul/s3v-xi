"use client";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const SLOTS = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)", "var(--s5)"];
const MAX = SLOTS.length;
const HEIGHT = 340;

export interface RaceSeries {
  id: string;
  name: string;
  dropin: boolean;
  /** cumulative points after each match day (same length as `labels`) */
  cumulative: number[];
}

export function SeasonRace({ labels, series, initial }: { labels: string[]; series: RaceSeries[]; initial: string[] }) {
  const [focus, setFocus] = useState<string[]>(initial.slice(0, MAX));
  // Colour follows the player: assigned by roster order among the highlighted set, never by rank.
  const colorOf = useMemo(() => {
    const m = new Map<string, string>();
    series.filter((s) => focus.includes(s.id)).forEach((s, i) => m.set(s.id, SLOTS[i]));
    return m;
  }, [focus, series]);
  const data = labels.map((label, i) => Object.fromEntries([["label", label], ...series.map((s) => [s.id, s.cumulative[i]])]));
  const last = labels.length - 1;
  // Explicit y-domain so end labels can be de-collided in pixel space.
  const all = series.flatMap((s) => s.cumulative);
  const rawLo = Math.min(0, ...all);
  const rawHi = Math.max(5, ...all);
  const step = [5, 10, 20, 25, 50, 100].find((s) => (rawHi - rawLo) / s <= 6) ?? 100;
  const lo = Math.floor(rawLo / step) * step;
  const hi = Math.ceil(rawHi / step) * step;
  const ticks = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step);
  const PLOT_H = HEIGHT - 10 - 4 - 30; // margin top/bottom + x-axis
  const labelShift = useMemo(() => {
    const px = (v: number) => ((hi - v) / (hi - lo || 1)) * PLOT_H;
    const ends = series
      .filter((s) => focus.includes(s.id))
      .map((s) => ({ id: s.id, y: px(s.cumulative[last] ?? 0) }))
      .sort((a, b) => a.y - b.y);
    const out = new Map<string, number>();
    let prev = -Infinity;
    for (const e of ends) {
      const y = Math.max(e.y, prev + 13);
      out.set(e.id, y - e.y);
      prev = y;
    }
    return out;
  }, [series, focus, last, lo, hi, PLOT_H]);
  const nameOf = new Map(series.map((s) => [s.id, s.name]));

  return (
    <div className="stack">
      <div className="chips" role="group" aria-label="Highlight up to five players">
        {series.map((s) => {
          const on = focus.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              className="chip"
              aria-pressed={on}
              disabled={!on && focus.length >= MAX}
              onClick={() => setFocus((f) => (on ? f.filter((x) => x !== s.id) : [...f, s.id]))}
              style={on ? { background: "transparent", color: "var(--text)", borderColor: colorOf.get(s.id) } : undefined}
            >
              {on && <span className="swatch" style={{ background: colorOf.get(s.id) }} />}
              {s.name}
            </button>
          );
        })}
      </div>
      <div style={{ width: "100%", height: HEIGHT }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 70, bottom: 4, left: -8 }}>
            <CartesianGrid vertical={false} stroke="var(--line-soft)" />
            <XAxis dataKey="label" stroke="var(--muted)" tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
            <YAxis domain={[lo, hi]} ticks={ticks} allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} />
            <ReferenceLine y={0} stroke="var(--line)" />
            <Tooltip
              cursor={{ stroke: "var(--text-2)", strokeDasharray: "3 3" }}
              content={({ active, payload, label }) => {
                if (!active || !payload) return null;
                const rows = payload
                  .filter((p) => focus.includes(String(p.dataKey)))
                  .sort((a, b) => Number(b.value) - Number(a.value));
                return (
                  <div className="tooltip">
                    <b>{label}</b>
                    {rows.map((p) => (
                      <div key={String(p.dataKey)} className="row" style={{ gap: "0.4rem" }}>
                        <span className="swatch" style={{ background: colorOf.get(String(p.dataKey)) }} />
                        {nameOf.get(String(p.dataKey))} <span className="num" style={{ marginLeft: "auto" }}>{p.value as number} pts</span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            {series
              .filter((s) => !focus.includes(s.id))
              .map((s) => (
                <Line key={s.id} dataKey={s.id} stroke="var(--s-muted)" strokeWidth={1} dot={false} activeDot={false} isAnimationActive={false} />
              ))}
            {series
              .filter((s) => focus.includes(s.id))
              .map((s) => (
                <Line
                  key={s.id}
                  dataKey={s.id}
                  stroke={colorOf.get(s.id)}
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
                  isAnimationActive={false}
                  label={({ index, x, y }: { index?: number; x?: number | string; y?: number | string }) =>
                    index === last ? (
                      <text key={`l-${s.id}`} x={Number(x) + 6} y={Number(y) + (labelShift.get(s.id) ?? 0)} dy={4} fill="var(--text)" fontSize={11}>
                        {s.name}
                      </text>
                    ) : (
                      <g key={`l-${s.id}-${index}`} />
                    )
                  }
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
