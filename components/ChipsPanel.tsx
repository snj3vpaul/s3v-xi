"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CHIPS } from "@/config/club";
import type { Chip } from "@/lib/league/types";
import { api } from "./api";

const ORDER: Chip[] = ["triple_captain", "bench_boost"];

/**
 * Triple Captain and Bench Boost: play one for the next match day, or cancel it
 * before the deadline. One chip per week; each has a season allowance.
 */
export function ChipsPanel({
  used,
  active,
  nextLabel,
  hasSeven,
  hasCaptain,
  hasBench,
}: {
  used: Record<Chip, number>;
  active: Chip | null;
  nextLabel: string | null;
  hasSeven: boolean;
  hasCaptain: boolean;
  hasBench: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Chip | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async (chip: Chip, play: boolean) => {
    setBusy(chip);
    setMsg(null);
    try {
      if (play) await api("/api/me/chip", "POST", { chip });
      else await api("/api/me/chip", "DELETE");
      setMsg({ ok: true, text: play ? `${CHIPS[chip].label} is on for ${nextLabel ?? "the next match day"}.` : `${CHIPS[chip].label} cancelled. It's back in your pile.` });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="stack" style={{ gap: "0.6rem" }}>
      <div className="chip-cards">
        {ORDER.map((chip) => {
          const c = CHIPS[chip];
          const left = c.perSeason - used[chip] + (active === chip ? 1 : 0);
          const isOn = active === chip;
          const why = !nextLabel
            ? "No upcoming match day"
            : !hasSeven
              ? "Save a seven first"
              : chip === "triple_captain" && !hasCaptain
                ? "Choose a captain first"
                : chip === "bench_boost" && !hasBench
                  ? "Add a bench player first"
                  : active && !isOn
                    ? `${CHIPS[active].label} is already on this week`
                    : used[chip] >= c.perSeason && !isOn
                      ? "None left this season"
                      : null;
          return (
            <div key={chip} className={`chip-card${isOn ? " is-active" : ""}`}>
              <h4>
                <span>
                  {c.label}
                  {isOn && <span className="chip-badge">ON</span>}
                </span>
                <span className="chip-left">{isOn ? `${left - 1} more after this` : `${left} of ${c.perSeason} left`}</span>
              </h4>
              <p className="small muted" style={{ margin: 0 }}>{c.blurb}</p>
              {isOn ? (
                <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => run(chip, false)}>
                  {busy === chip ? "Cancelling…" : `Cancel (before ${nextLabel ?? "kick-off"})`}
                </button>
              ) : (
                <button type="button" className="btn btn-sm btn-primary" disabled={!!busy || !!why} title={why ?? undefined} onClick={() => run(chip, true)}>
                  {busy === chip ? "Playing…" : why ?? `Play for ${nextLabel}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {msg && (
        <span className={`small ${msg.ok ? "" : "neg"}`} role="status">
          {msg.text}
        </span>
      )}
    </div>
  );
}
