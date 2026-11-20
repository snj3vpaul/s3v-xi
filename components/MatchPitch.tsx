/**
 * A line-drawn pitch for one match day. Each goal is a ball in the box it went
 * into (White attack the right-hand goal, Red the left). It's a diagram of who
 * scored at which end, not of where on the pitch: the scorecard doesn't record that.
 */
export interface PitchGoal {
  /** The team credited with the goal. */
  side: "A" | "B";
  ownGoal: boolean;
  /** Short label, e.g. "Inder 12'". Used as the ball's accessible title. */
  title: string;
}

const W = 400;
const H = 260;

export function MatchPitch({ goals, score, upcoming, centre }: { goals: PitchGoal[]; score?: { A: number; B: number }; upcoming?: boolean; centre?: string }) {
  const balls = (side: "A" | "B") => goals.filter((g) => g.side === side);
  // Lay balls out in neat rows inside the penalty box being attacked.
  const place = (list: PitchGoal[], right: boolean) =>
    list.map((g, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = right ? 364 - col * 16 : 36 + col * 16;
      const y = 102 + row * 18;
      return { g, x, y };
    });
  const p = (d: string, cls = "pl") => <path d={d} className={cls} pathLength={1} />;
  return (
    <svg className={`pitch-ln${upcoming ? " is-upcoming" : ""}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={upcoming ? "Pitch: not played yet" : `Pitch diagram: White ${score?.A ?? 0}, Red ${score?.B ?? 0}`}>
      {/* mowing stripes, very faint */}
      {Array.from({ length: 8 }, (_, i) => (i % 2 ? <rect key={i} x={20 + i * 45} y={20} width={45} height={220} className="pl-stripe" /> : null))}
      {p("M20 20h360v220H20z")}
      {p("M200 20v220")}
      <circle cx={200} cy={130} r={34} className="pl" pathLength={1} />
      {score || centre ? <circle cx={200} cy={130} r={24} className="pl-hole" /> : <circle cx={200} cy={130} r={2.5} className="pl-spot" />}
      {p("M20 74h58v112H20")}
      {p("M380 74h-58v112h58")}
      {p("M20 104h22v52H20")}
      {p("M380 104h-22v52h22")}
      {p("M78 108a28 28 0 0 1 0 44", "pl thin")}
      {p("M322 108a28 28 0 0 0 0 44", "pl thin")}
      {p("M20 114h-10v32h10")}
      {p("M380 114h10v32h-10")}
      {[...place(balls("B"), false), ...place(balls("A"), true)].map(({ g, x, y }, i) => (
        <g key={i} className={`pl-ball${g.ownGoal ? " is-og" : ""}${g.side === "B" ? " is-red" : ""}`}>
          <title>{g.title}</title>
          <circle cx={x} cy={y} r={6.5} />
          {!g.ownGoal && <path d={`M${x} ${y - 3}l2.8 2-1 3.2h-3.6l-1-3.2z`} />}
        </g>
      ))}
      {score && !upcoming && (
        <text x={200} y={142} textAnchor="middle" className="pl-score">
          {score.A}–{score.B}
        </text>
      )}
      {centre && (
        <text x={200} y={138} textAnchor="middle" className="pl-centre">
          {centre}
        </text>
      )}
    </svg>
  );
}
