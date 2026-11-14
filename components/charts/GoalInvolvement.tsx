"use client";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface InvolvementRow {
  id: string;
  name: string;
  goals: number;
  assists: number;
  dropin: boolean;
}

function Tip({ active, payload }: { active?: boolean; payload?: { payload: InvolvementRow }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="tooltip">
      <b>{r.name}</b> {r.dropin && <span className="badge badge-dropin">Drop-in</span>}
      <div>{r.goals} goal{r.goals === 1 ? "" : "s"} · {r.assists} assist{r.assists === 1 ? "" : "s"}</div>
      <div className="muted">{r.goals + r.assists} goal involvements</div>
    </div>
  );
}

function NameTick({ x, y, payload, rows }: { x?: number | string; y?: number | string; payload?: { value: string }; rows: InvolvementRow[] }) {
  const r = rows.find((q) => q.id === payload?.value);
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill="var(--text-2)" fontSize={12}>
      {r?.name}
      {r?.dropin && <tspan fill="var(--ochre)" fontSize={10} fontWeight={700}> · D</tspan>}
    </text>
  );
}

export function GoalInvolvement({ rows }: { rows: InvolvementRow[] }) {
  const data = rows.filter((r) => r.goals + r.assists > 0).sort((a, b) => b.goals + b.assists - (a.goals + a.assists) || b.goals - a.goals);
  if (!data.length) return <p className="muted">No goals or assists yet.</p>;
  return (
    <div style={{ width: "100%", height: data.length * 30 + 40 }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }} barCategoryGap={6}>
          <defs>
            <pattern id="hatch-goal" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" fill="var(--s1)" opacity="0.35" />
              <line x1="0" y1="0" x2="0" y2="5" stroke="var(--s1)" strokeWidth="3" />
            </pattern>
            <pattern id="hatch-assist" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" fill="var(--s2)" opacity="0.35" />
              <line x1="0" y1="0" x2="0" y2="5" stroke="var(--s2)" strokeWidth="3" />
            </pattern>
          </defs>
          <CartesianGrid horizontal={false} stroke="var(--line-soft)" />
          <XAxis type="number" allowDecimals={false} stroke="var(--muted)" tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="id" width={96} tickLine={false} axisLine={false} tick={(p) => <NameTick {...p} rows={data} />} interval={0} />
          <Tooltip content={<Tip />} cursor={{ fill: "rgba(43,33,24,0.05)" }} />
          <Bar dataKey="goals" stackId="gi" name="Goals" stroke="var(--surface)" strokeWidth={2} isAnimationActive={false}>
            {data.map((r) => <Cell key={r.id} fill={r.dropin ? "url(#hatch-goal)" : "var(--s1)"} />)}
          </Bar>
          <Bar dataKey="assists" stackId="gi" name="Assists" stroke="var(--surface)" strokeWidth={2} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {data.map((r) => <Cell key={r.id} fill={r.dropin ? "url(#hatch-assist)" : "var(--s2)"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
