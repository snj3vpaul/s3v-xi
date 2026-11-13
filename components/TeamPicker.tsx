"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CLUB, playerName } from "@/config/club";
import { api } from "./api";
import { PlayerChips } from "./PlayerChips";

export function TeamPicker({ initial, deadlineLabel }: { initial: string[]; deadlineLabel: string | null }) {
  const router = useRouter();
  const [picks, setPicks] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [said, setSaid] = useState("");
  const need = CLUB.picksPerSelector;
  const dirty = picks.length !== initial.length || picks.some((p) => !initial.includes(p));

  return (
    <div className="stack">
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "0.5rem" }}>
        {Array.from({ length: need }, (_, i) => {
          const id = picks[i];
          return (
            <div key={i} className={`squad-slot ${id ? "" : "empty"}`}>
              <span className="no">{i + 1}</span>
              {id ? (
                <>
                  <span style={{ flex: 1 }}>{playerName(id)}</span>
                  <button type="button" className="btn btn-sm" style={{ minHeight: 28, padding: "0 0.5rem" }} aria-label={`Remove ${playerName(id)}`} onClick={() => {
                      const left = picks.filter((x) => x !== id);
                      setPicks(left);
                      setSaid(`Removed ${playerName(id)}. ${left.length} of ${need} picked.`);
                    }}>✕</button>
                </>
              ) : (
                <span>Empty</span>
              )}
            </div>
          );
        })}
      </div>
      <div>
        <div className="row spread">
          <h3>Choose from the squad</h3>
          <span className="num" aria-hidden="true">{picks.length}/{need}</span>
        </div>
        <p className="sr-only" aria-live="polite" aria-atomic="true">{said}</p>
        <PlayerChips
          selected={picks}
          max={need}
          onToggle={(id) => {
            const on = picks.includes(id);
            const nextPicks = on ? picks.filter((x) => x !== id) : [...picks, id];
            setPicks(nextPicks);
            setSaid(`${on ? "Removed" : "Added"} ${playerName(id)}. ${nextPicks.length} of ${need} picked.`);
          }}
        />
      </div>
      <div className="row">
        <button
          className="btn btn-primary"
          disabled={busy || picks.length !== need || !dirty}
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            try {
              await api("/api/me/squad", "PUT", { picks });
              setMsg({ ok: true, text: deadlineLabel ? `Saved. Locked in for ${deadlineLabel} — and every week after until you change it.` : "Saved." });
              router.refresh();
            } catch (e) {
              setMsg({ ok: false, text: (e as Error).message });
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving…" : initial.length ? "Save changes" : `Lock in my ${need}`}
        </button>
        {dirty && initial.length > 0 && <button className="btn btn-sm" onClick={() => setPicks(initial)}>Undo</button>}
        {msg && <span className={`small ${msg.ok ? "" : "neg"}`} role="status">{msg.text}</span>}
      </div>
    </div>
  );
}

export function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(() => Date.now());
  useStateTick(setNow);
  const ms = Math.max(0, new Date(to).getTime() - now);
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return <span className="countdown num" suppressHydrationWarning>{ms === 0 ? "Locked" : `${d ? `${d}d ` : ""}${h}h ${String(m).padStart(2, "0")}m`}</span>;
}

function useStateTick(set: (n: number) => void) {
  useEffect(() => {
    const t = setInterval(() => set(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [set]);
}
