"use client";
import { DROPINS, MEMBERS } from "@/config/club";

/** Toggleable player chips grouped as members / drop-ins. */
export function PlayerChips({
  selected,
  onToggle,
  max,
  only,
}: {
  selected: string[];
  onToggle: (id: string) => void;
  max?: number;
  only?: string[];
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
                className="chip"
                aria-pressed={on}
                disabled={!on && full}
                onClick={() => onToggle(p.id)}
              >
                {p.name}
                {p.kind === "dropin" && <span className="badge badge-dropin" style={{ color: on ? "inherit" : undefined }}>D</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  };
  return (
    <div>
      {group("Members", MEMBERS)}
      {group("Drop-ins", DROPINS)}
    </div>
  );
}
