"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";

/** "I can't make it": a linked player flags themselves out (or back in) for the next match day. */
export function AvailabilityToggle({ playerName, out, note: savedNote, nextLabel }: { playerName: string; out: boolean; note?: string; nextLabel: string }) {
  const router = useRouter();
  const [note, setNote] = useState(savedNote ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const send = async (next: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      await api("/api/me/availability", "PUT", { out: next, note: next ? note : undefined });
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack" style={{ gap: "0.5rem" }}>
      {out ? (
        <p style={{ margin: 0 }}>
          <span className="out-flag">⚑ Out</span> You&apos;re flagged out for {nextLabel}
          {savedNote ? ` (${savedNote})` : ""}. Everyone picking sees the flag.
        </p>
      ) : (
        <p className="small muted" style={{ margin: 0 }}>
          Can&apos;t make {nextLabel}? Flag yourself out so people don&apos;t pick you. It only shows a flag; it doesn&apos;t change any points.
        </p>
      )}
      <div className="row">
        {!out && (
          <input
            type="text"
            style={{ maxWidth: "16rem" }}
            maxLength={80}
            placeholder="Optional note, e.g. away, injured"
            aria-label="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        )}
        <button type="button" className={`btn btn-sm${out ? "" : " btn-primary"}`} disabled={busy} onClick={() => send(!out)}>
          {busy ? "Saving…" : out ? `I can make it after all` : `${playerName} can't make it`}
        </button>
      </div>
      {err && <span className="small neg" role="status">{err}</span>}
    </div>
  );
}
