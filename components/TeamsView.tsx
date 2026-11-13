import type { DrawResult, Side } from "@/lib/league/types";
import { playerName } from "@/config/club";
import { Name } from "./ui";

export function TeamsView({ draw, score }: { draw: DrawResult; score?: Record<Side, number> }) {
  const team = (side: Side, ids: string[]) => (
    <div className="team">
      <h3>
        <span className={`bib bib-${side}`} aria-hidden /> Team {side === "A" ? "Chalk" : "Kit"}
        {score && <span className="score num" style={{ marginLeft: "auto" }}>{score[side]}</span>}
      </h3>
      <ul>
        {[...ids].sort((a, b) => playerName(a).localeCompare(playerName(b))).map((id) => (
          <li key={id}>
            <Name id={id} />
          </li>
        ))}
        {draw.floater && (
          <li className="muted small">
            + {playerName(draw.floater)} ({draw.floaterFirstHalf === side ? "1st" : "2nd"} half)
          </li>
        )}
      </ul>
    </div>
  );
  return (
    <div className="teams">
      {team("A", draw.teamA)}
      {team("B", draw.teamB)}
    </div>
  );
}

export const TEAM_NAME: Record<Side, string> = { A: "Chalk", B: "Kit" };
