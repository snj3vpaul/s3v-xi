import { playerName, isDropIn } from "@/config/club";

/** Sequential sand → forest ramp for positive days; brick for negative; sand for 0; dashed for did-not-play. */
function cellStyle(v: number | undefined, max: number): React.CSSProperties {
  if (v === undefined) return {};
  if (v < 0) return { background: "var(--s5)", color: "var(--bg)" };
  if (v === 0) return { background: "var(--surface-2)", color: "var(--muted)" };
  const t = Math.min(1, v / Math.max(max, 1));
  // interpolate #d9d3bd → #2f5a44 (pale sage-sand → forest on the bone surface)
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * (0.15 + 0.85 * t));
  const bg = `rgb(${lerp(0xd9, 0x2f)}, ${lerp(0xd3, 0x5a)}, ${lerp(0xbd, 0x44)})`;
  return { background: bg, color: t > 0.5 ? "var(--bg)" : "var(--text)" };
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
      <span><span className="swatch" style={{ background: "#b9bfa5" }} /> few pts</span>
      <span><span className="swatch" style={{ background: "#2f5a44" }} /> many pts</span>
      <span><span className="swatch" style={{ background: "var(--surface-2)" }} /> played, 0</span>
      <span><span className="swatch" style={{ background: "var(--s5)" }} /> negative</span>
      <span><span className="swatch" style={{ border: "1px dashed var(--line)" }} /> didn&apos;t play</span>
    </>
  );
}
