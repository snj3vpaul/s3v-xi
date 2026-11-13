/**
 * Last-5 form sparkline. Pure SVG so it renders on the server inside table rows.
 * Each point carries a <title> so hovering (or long-press) shows the value.
 */
export function Sparkline({ values, labels = [], width = 92, height = 26 }: { values: number[]; labels?: string[]; width?: number; height?: number }) {
  if (values.length === 0) return <span className="muted small">—</span>;
  const pad = 4;
  const lo = Math.min(0, ...values);
  const hi = Math.max(1, ...values);
  const x = (i: number) => (values.length === 1 ? width / 2 : pad + (i * (width - pad * 2)) / (values.length - 1));
  const y = (v: number) => pad + ((hi - v) * (height - pad * 2)) / (hi - lo || 1);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = values.length - 1;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Last ${values.length} match days: ${values.join(", ")} points`}>
      <line x1={pad} x2={width - pad} y1={y(0)} y2={y(0)} stroke="var(--line)" strokeWidth={1} strokeDasharray="2 3" />
      <path d={d} fill="none" stroke="var(--s1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={i === last ? 3.5 : 6} fill={i === last ? (v < 0 ? "var(--s5)" : "var(--s1)") : "transparent"} stroke={i === last ? "var(--navy-800)" : "none"} strokeWidth={i === last ? 1.5 : 0}>
          <title>{`${labels[i] ? labels[i] + ": " : ""}${v} pts`}</title>
        </circle>
      ))}
    </svg>
  );
}
