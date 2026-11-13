"use client";
import { DROPINS, MEMBERS } from "@/config/club";
import { Mascot } from "./Mascot";

/** Toggleable player chips grouped as members / drop-ins. */
export function PlayerChips({
  selected,
  onToggle,
  max,
  only,
  withFaces = false,
}: {
  selected: string[];
  onToggle: (id: string) => void;
  max?: number;
  only?: string[];
  /** Show each player's mascot head on their chip (Pick 7). */
  withFaces?: boolean;
}) {
  const full = max !== undefined && selected.length >= max;
  const group = (title: string, list: typeof MEMBERS) => {
    const items = only ? list.filter((p) => only.includes(p.id)) : list;
    if (!items.length) return null;
    return (
      <div className="stack" style={{ marginTop: "0.6rem" }}>
        <div className="small muted">{title}</div>
        <div className="chips">
          {items.map((p) => {
            const on = selected.includes(p.id);
            return (
              <button
                type="button"
                key={p.id}
                className={`chip${withFaces ? " chip-face" : ""}`}
                data-chip={p.id}
                aria-pressed={on}
                disabled={!on && full}
                onClick={() => onToggle(p.id)}
              >
                {withFaces && <Mascot id={p.id} variant="head" size={26} />}
                {p.name}
                {p.kind === "dropin" && (
                  <span className="badge badge-dropin" style={{ color: on ? "inherit" : undefined }}>
                    <span aria-hidden="true">D</span>
                    <span className="sr-only">drop-in</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };
  return (
    <div>
      {max !== undefined && (
        <p className="small muted" style={{ margin: "0.4rem 0 0" }}>
          {full ? `All ${max} picked. Remove one to swap someone in.` : "Tap a player to send them to your bench."}
        </p>
      )}
      {group("Members", MEMBERS)}
      {group("Drop-ins", DROPINS)}
    </div>
  );
}
