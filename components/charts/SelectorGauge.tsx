
/** Half-donut gauge of a selector's hit rate (share of picks who scored or assisted). */
export function SelectorGauge({ name, hitRate, hits, picks, points }: { name: string; hitRate: number; hits: number; picks: number; points: number }) {
  const r = 42;
  const cx = 56;
  const cy = 52;
  const arc = (t: number) => {
    const a = Math.PI * (1 - t);
    return `${cx + r * Math.cos(a)},${cy - r * Math.sin(a)}`;
  };
  const t = Math.max(0, Math.min(1, hitRate));
  const pct = Math.round(t * 100);
  return (
    <div className="panel" style={{ padding: "0.8rem", textAlign: "center", background: "var(--bg)" }}>
      <svg viewBox="0 0 112 62" width="100%" style={{ maxWidth: 150 }} role="img" aria-label={`Hit rate ${pct}%`}>
        <path d={`M${arc(0)} A${r},${r} 0 0 1 ${arc(1)}`} fill="none" stroke="var(--line-soft)" strokeWidth={10} strokeLinecap="round" />
        {t > 0 && (
          <path d={`M${arc(0)} A${r},${r} 0 0 1 ${arc(t)}`} fill="none" stroke="var(--s1)" strokeWidth={10} strokeLinecap="round">
            <title>{`${hits} of ${picks} picks hit`}</title>
          </path>
        )}
        <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--text)" fontFamily="var(--display)" fontWeight={400} fontSize={22}>
          {pct}%
        </text>
      </svg>
      <div style={{ marginTop: "0.25rem" }}>{name}</div>
      <div className="small muted num">{hits}/{picks} hits · {points} pts</div>
    </div>
  );
}
