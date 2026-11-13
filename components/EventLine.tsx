import { playerName } from "@/config/club";
import type { GoalEvent } from "@/lib/league/types";
import { GOAL_KIND_LABEL, deflectionRulingOf, scoreEvent, type ScoringRules } from "@/lib/scoring/rules";
import { Points } from "./ui";

export function describeEvent(e: GoalEvent, rules: ScoringRules): string {
  const s = playerName(e.scorerId);
  if (e.kind === "own_goal") return `Own goal — ${s}`;
  if (e.kind === "deflection") {
    const d = e.deflectedById ? playerName(e.deflectedById) : "?";
    return deflectionRulingOf(e, rules) === "own_goal"
      ? `${s}'s shot deflected in off ${d} — ruled own goal (${d})`
      : `${s} — deflected off ${d}, ruled ${s}'s goal${e.assistId ? ` · assist ${playerName(e.assistId)}` : ""}`;
  }
  const parts = [`${s}${e.kind !== "open_play" ? ` (${GOAL_KIND_LABEL[e.kind].toLowerCase()})` : ""}`];
  if (e.assistId && e.kind !== "free_kick") parts.push(`assist ${playerName(e.assistId)}`);
  if (e.secondAssistId && rules.secondAssistEnabled) parts.push(`pre-assist ${playerName(e.secondAssistId)}`);
  return parts.join(" · ");
}

export function EventLine({ e, rules }: { e: GoalEvent; rules: ScoringRules }) {
  const sc = scoreEvent(e, rules);
  return (
    <li className="row spread" style={{ padding: "0.45rem 0", borderBottom: "1px dashed var(--line-soft)" }}>
      <span className="row" style={{ gap: "0.5rem" }}>
        <span className={`bib bib-${e.side}`} aria-label={`Team ${e.side === "A" ? "Chalk" : "Kit"}`} />
        {e.minute != null && <span className="muted num small">{e.minute}&apos;</span>}
        <span>{describeEvent(e, rules)}</span>
      </span>
      <span className="small muted num">
        {sc.contributions.map((c, i) => (
          <span key={i}>
            {i > 0 && " · "}
            {playerName(c.playerId)} <Points v={c.points} />
          </span>
        ))}
      </span>
    </li>
  );
}
