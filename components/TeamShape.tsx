"use client";

import { useState } from "react";
import type { Side } from "@/lib/league/types";
import { PitchFormation } from "@/components/PitchFormation";

const NAME: Record<Side, string> = { A: "White", B: "Red" };

/** White / Red switch over the selected team's shape on the pitch. */
export function TeamShape({ matchId, teams }: { matchId: string; teams: Record<Side, string[]> }) {
  const [side, setSide] = useState<Side>("A");
  return (
    <section className="team-shape" aria-labelledby="team-shape-title">
      <div className="row spread">
        <h3 id="team-shape-title">On the pitch</h3>
        <div className="team-tabs" role="tablist" aria-label="Team">
          {(["A", "B"] as const).map((s) => (
            <button key={s} type="button" role="tab" aria-selected={side === s} aria-controls={`shape-${s}`} onClick={() => setSide(s)}>
              <span className={`bib bib-${s}`} aria-hidden /> {NAME[s]}
            </button>
          ))}
        </div>
      </div>
      <div id={`shape-${side}`} role="tabpanel">
        <PitchFormation key={side} ids={teams[side]} side={side} matchId={matchId} label={`Team ${NAME[side]}`} />
      </div>
    </section>
  );
}
