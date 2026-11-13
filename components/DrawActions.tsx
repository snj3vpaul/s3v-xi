"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";

export function VerifyDraw({ matchId }: { matchId: string }) {
  const [res, setRes] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <span className="row">
      <button
        className="btn btn-sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            setRes(await api(`/api/matchdays/${matchId}/draw`, "GET"));
          } catch (e) {
            setRes({ ok: false, reason: (e as Error).message });
          } finally {
            setBusy(false);
          }
        }}
      >
        Verify draw
      </button>
      {res && (
        <span className={`small ${res.ok ? "" : "neg"}`} role="status">
          {res.ok ? "✓ Re-ran the seed: identical teams." : `✗ ${res.reason}`}
        </span>
      )}
    </span>
  );
}

export function ResetDraw({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  if (!open)
    return (
      <button className="btn btn-sm btn-danger" onClick={() => setOpen(true)}>
        Reset draw…
      </button>
    );
  return (
    <div className="stack" style={{ width: "100%" }}>
      <label htmlFor="reason">Why reset? (shown in the audit log)</label>
      <input id="reason" type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Jedi arrived late" />
      <div className="row">
        <button
          className="btn btn-sm btn-danger"
          disabled={!reason.trim()}
          onClick={async () => {
            try {
              await api(`/api/matchdays/${matchId}/draw`, "DELETE", { reason });
              router.refresh();
            } catch (e) {
              setErr((e as Error).message);
            }
          }}
        >
          Confirm reset
        </button>
        <button className="btn btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {err && <div className="alert alert-error">{err}</div>}
    </div>
  );
}
