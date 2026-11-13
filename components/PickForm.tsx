"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CLUB, ROSTER } from "@/config/club";
import { api } from "./api";
import { PlayerChips } from "./PlayerChips";

export function PickForm({ matchId, existing }: { matchId: string; existing: Record<string, string[]> }) {
  const router = useRouter();
  const [who, setWho] = useState("");
  const [picks, setPicks] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const need = CLUB.picksPerSelector;

  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        try {
          await api(`/api/matchdays/${matchId}/selections`, "POST", { selectorId: who, picks });
          setMsg({ ok: true, text: "Locked in. You can change it any time until the draw." });
          router.refresh();
        } catch (err) {
          setMsg({ ok: false, text: (err as Error).message });
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="field" style={{ maxWidth: 320 }}>
        <label htmlFor="who">I am…</label>
        <select
          id="who"
          value={who}
          onChange={(e) => {
            setWho(e.target.value);
            setPicks(existing[e.target.value] ?? []);
            setMsg(null);
          }}
          required
        >
          <option value="">Choose your name</option>
          {ROSTER.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.kind === "dropin" ? " (drop-in)" : ""}
              {existing[p.id] ? " ✓" : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="row spread">
        <h3>Your seven</h3>
        <span className="num" aria-live="polite">
          {picks.length}/{need}
        </span>
      </div>
      <PlayerChips
        selected={picks}
        max={need}
        onToggle={(id) => setPicks((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
      />
      <div className="row">
        <button className="btn btn-primary" disabled={!who || picks.length !== need || busy}>
          {busy ? "Saving…" : existing[who] ? "Update my 7" : "Lock in my 7"}
        </button>
        {msg && <span className={`small ${msg.ok ? "" : "neg"}`}>{msg.text}</span>}
      </div>
      <p className="small muted">
        You can pick yourself. Picks stay hidden until the draw, then everyone&apos;s are revealed. No logins in v1 — play
        fair; every submission is logged with a timestamp.
      </p>
    </form>
  );
}
