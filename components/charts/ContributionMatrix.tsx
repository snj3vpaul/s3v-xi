import { playerName, isDropIn } from "@/config/club";

/** Sequential kit-green ramp for positive days; coral for negative; neutral for 0; dashed for did-not-play. */
function cellStyle(v: number | undefined, max: number): React.CSSProperties {
  if (v === undefined) return {};
  if (v < 0) return { background: "rgba(224, 96, 63, 0.75)", color: "var(--navy-900)" };
  if (v === 0) return { background: "#1d3047", color: "var(--muted)" };
  const t = Math.min(1, v / Math.max(max, 1));
  // interpolate #1e4a3e → #6be3a6 (dim → bright on the dark surface)
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * (0.15 + 0.85 * t));
  const bg = `rgb(${lerp(0x1e, 0x6b)}, ${lerp(0x4a, 0xe3)}, ${lerp(0x3e, 0xa6)})`;
  return { background: bg, color: t > 0.45 ? "var(--navy-900)" : "var(--chalk)" };
}

export function ContributionMatrix({
  players,
  matches,
}: {
  players: { id: string; perMatch: Record<string, number> }[];
  matches: { id: string; label: string }[];
}) {
  const max = Math.max(1, ...players.flatMap((p) => Object.values(p.perMatch)));
  const cols = `minmax(84px, 120px) repeat(${matches.length}, minmax(34px, 1fr))`;
  return (
    <div className="table-wrap">
      <div className="heat" style={{ gridTemplateColumns: cols, minWidth: 84 + matches.length * 36 }} role="table" aria-label="Points per player per match day">
        <div role="columnheader" />
        {matches.map((m) => (
          <div key={m.id} className="heat-head" role="columnheader">{m.label}</div>
        ))}
        {players.map((p) => (
          <div key={p.id} style={{ display: "contents" }} role="row">
            <div className="heat-name" role="rowheader">
              {playerName(p.id)}
              {isDropIn(p.id) && <span className="badge badge-dropin" style={{ fontSize: "0.55rem" }}>D</span>}
            </div>
            {matches.map((m) => {
              const v = p.perMatch[m.id];
              const tip = `${playerName(p.id)} · ${m.label}: ${v === undefined ? "did not play" : `${v} pts`}`;
              return (
                <div key={m.id} role="cell" tabIndex={0} className={`heat-cell num ${v === undefined ? "dnp" : ""}`} style={cellStyle(v, max)} data-tip={tip} aria-label={tip}>
                  {v === undefined ? "" : v}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MatrixLegend() {
  return (
    <>
      <span><span className="swatch" style={{ background: "#2a6a52" }} /> few pts</span>
      <span><span className="swatch" style={{ background: "#6be3a6" }} /> many pts</span>
      <span><span className="swatch" style={{ background: "#1d3047" }} /> played, 0</span>
      <span><span className="swatch" style={{ background: "rgba(224, 96, 63, 0.75)" }} /> negative</span>
      <span><span className="swatch" style={{ border: "1px dashed var(--line)" }} /> didn&apos;t play</span>
    </>
  );
}
