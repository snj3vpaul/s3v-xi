"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CLUB, playerName } from "@/config/club";
import type { DrawConstraints } from "@/lib/league/types";
import { api } from "./api";

function PairEditor({
  label,
  pairs,
  setPairs,
  pool,
}: {
  label: string;
  pairs: [string, string][];
  setPairs: (p: [string, string][]) => void;
  pool: string[];
}) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  return (
    <div className="field">
      <label>{label}</label>
      {pairs.length > 0 && (
        <div className="chips" style={{ marginBottom: "0.5rem" }}>
          {pairs.map(([x, y], i) => (
            <button key={i} type="button" className="chip" onClick={() => setPairs(pairs.filter((_, j) => j !== i))} title="Remove">
              {playerName(x)} + {playerName(y)} ✕
            </button>
          ))}
        </div>
      )}
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <select value={a} onChange={(e) => setA(e.target.value)} aria-label={`${label}: first player`}>
          <option value="">Player…</option>
          {pool.map((id) => <option key={id} value={id}>{playerName(id)}</option>)}
        </select>
        <select value={b} onChange={(e) => setB(e.target.value)} aria-label={`${label}: second player`}>
          <option value="">Player…</option>
          {pool.filter((id) => id !== a).map((id) => <option key={id} value={id}>{playerName(id)}</option>)}
        </select>
        <button
          type="button"
          className="btn btn-sm"
          disabled={!a || !b || a === b}
          onClick={() => {
            setPairs([...pairs, [a, b]]);
            setA("");
            setB("");
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function DrawControls({ matchId, defaults, attendees }: { matchId: string; defaults: DrawConstraints; attendees: string[] }) {
  const router = useRouter();
  const [c, setC] = useState<DrawConstraints>(defaults);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const enough = attendees.length >= CLUB.minPerSide * 2;

  async function draw() {
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/matchdays/${matchId}/draw`, "POST", { constraints: c });
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <h3>Draw rules</h3>
      <label className="check">
        <input type="checkbox" checked={c.splitDropIns} onChange={(e) => setC({ ...c, splitDropIns: e.target.checked })} />
        <span>Split drop-ins evenly between the teams</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={c.avoidRepeat} onChange={(e) => setC({ ...c, avoidRepeat: e.target.checked })} />
        <span>Never repeat last match day&apos;s exact teams</span>
      </label>
      <div className="field" style={{ maxWidth: 220 }}>
        <label htmlFor="mps">Max players on the pitch per side</label>
        <input
          id="mps"
          type="number"
          min={CLUB.minPerSide}
          max={11}
          value={c.maxPerSide}
          onChange={(e) => setC({ ...c, maxPerSide: Number(e.target.value) || CLUB.defaultMaxPerSide })}
        />
      </div>
      <PairEditor label="Keep together (optional)" pairs={c.keepTogether} setPairs={(p) => setC({ ...c, keepTogether: p })} pool={attendees} />
      <PairEditor label="Keep apart (optional)" pairs={c.keepApart} setPairs={(p) => setC({ ...c, keepApart: p })} pool={attendees} />
      <div className="row">
        <button className="btn btn-primary" onClick={draw} disabled={busy || !enough}>
          {busy ? "Drawing…" : "Draw the teams"}
        </button>
        {!enough && <span className="small muted">Mark at least {CLUB.minPerSide * 2} players as here.</span>}
      </div>
      {err && <div className="alert alert-error">{err}</div>}
      <p className="small muted">
        Drawing locks attendance and closes Pick 7 for this match day. The seed is published so anyone can verify it.
      </p>
    </div>
  );
}
