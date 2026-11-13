/** Every chart gets a title, a units line, a source note and a table view. */
export function ChartFrame({
  title,
  units,
  source = "RSFC match-day scorecards entered by club admins.",
  table,
  children,
  legend,
}: {
  title: string;
  units: string;
  source?: string;
  table?: React.ReactNode;
  legend?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <figure className="panel rise" style={{ margin: 0 }}>
      <figcaption>
        <div className="chart-title">{title}</div>
        <div className="chart-sub">{units}</div>
      </figcaption>
      {legend && <div className="legend">{legend}</div>}
      <div className="chart-body">{children}</div>
      {table && (
        <details className="table-view">
          <summary>View as table</summary>
          <div className="table-wrap" style={{ marginTop: "0.5rem" }}>{table}</div>
        </details>
      )}
      <div className="chart-source">Source: {source}</div>
    </figure>
  );
}

export function Swatch({ color, hatch = false }: { color: string; hatch?: boolean }) {
  return (
    <span
      className="swatch"
      style={{
        background: hatch ? `repeating-linear-gradient(45deg, ${color} 0 2px, transparent 2px 5px)` : color,
        border: hatch ? `1px solid ${color}` : undefined,
      }}
    />
  );
}
