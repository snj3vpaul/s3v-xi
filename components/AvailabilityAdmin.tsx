"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROSTER, playerName } from "@/config/club";
import { api } from "./api";

/** Admin: flag any player out (or back in) for this match day. Shown on the Pick 7 picker. */
export function AvailabilityAdmin({ matchId, flagged }: { matchId: string; flagged: { playerId: string; by: "self" | "admin"; note?: string }[] }) {
  const router = useRouter();
  const [playerId, setPlayerId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const send = async (id: string, out: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/matchdays/${matchId}/availability`, "PUT", { playerId: id, out, note: out ? note : undefined });
      setPlayerId("");
      setNote("");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const flaggedIds = new Set(flagged.map((f) => f.playerId));
  return (
    <div className="stack" style={{ gap: "0.6rem" }}>
      {flagged.length ? (
        <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
          {flagged.map((f) => (
            <li key={f.playerId} className="small">
              <span className="out-flag">⚑ Out</span> <b>{playerName(f.playerId)}</b>
              {f.note ? ` (${f.note})` : ""} <span className="muted">· {f.by === "self" ? "said so themselves" : "set by admin"}</span>{" "}
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => send(f.playerId, false)}>
                Back in
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="small muted" style={{ margin: 0 }}>Nobody is flagged out. Players can flag themselves from My Team if their account is linked.</p>
      )}
      <div className="row">
        <select aria-label="Player" value={playerId} onChange={(e) => setPlayerId(e.target.value)} style={{ maxWidth: "12rem" }}>
          <option value="">Choose a player…</option>
          {ROSTER.filter((p) => !flaggedIds.has(p.id)).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input type="text" aria-label="Note (optional)" placeholder="Note (optional)" maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} style={{ maxWidth: "14rem" }} />
        <button type="button" className="btn btn-sm btn-primary" disabled={busy || !playerId} onClick={() => send(playerId, true)}>
          Flag out
        </button>
      </div>
      {err && <span className="small neg" role="status">{err}</span>}
    </div>
  );
}
