"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { applyOptimistic, type Pick7Row, type Pick7Status } from "@/lib/league/pick7Table";
import { onPick7 } from "./pick7Live";

const POLL_MS = 15_000;

const STATUS: Record<Pick7Status, { label: string; cls: string }> = {
  picked: { label: "Picked", cls: "p7-picked" },
  needs_fix: { label: "Fix needed", cls: "p7-fix" },
  no_pick: { label: "No pick yet", cls: "p7-none" },
};

/**
 * The live Pick 7 table. Starts from server-rendered rows, then:
 *  - applies the signed-in user's change optimistically the moment they save or remove,
 *  - refetches when the server confirms (or rolls back if it refused),
 *  - polls every 15 s while the tab is visible, and refetches on focus,
 *  - refetches when another tab of this browser saves.
 */
export function Pick7Table({ initial, meId }: { initial: Pick7Row[]; meId: string | null }) {
  const [rows, setRows] = useState(initial);
  const [overlay, setOverlay] = useState<Pick7Status | null>(null);
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const [flash, setFlash] = useState(false);
  const inflight = useRef<AbortController | null>(null);

  const refetch = useCallback(async () => {
    inflight.current?.abort();
    const ac = new AbortController();
    inflight.current = ac;
    try {
      const res = await fetch("/api/pick7/table", { cache: "no-store", signal: ac.signal });
      if (!res.ok) return false;
      const data = (await res.json()) as { rows: Pick7Row[] };
      setRows(data.rows);
      setUpdatedAt(Date.now());
      return true;
    } catch {
      return false;
    }
  }, []);

  // Keep in sync with a server re-render (router.refresh) too.
  useEffect(() => setRows(initial), [initial]);

  useEffect(() => {
    const tick = () => document.visibilityState === "visible" && refetch();
    const t = setInterval(tick, POLL_MS);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    const off = onPick7(
      async (s) => {
        if (s.kind === "optimistic") {
          setOverlay(s.status);
          setFlash(true);
        } else if (s.ok) {
          await refetch();
          setOverlay(null);
        } else {
          setOverlay(null); // roll back
        }
      },
      () => void refetch(),
    );
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
      off();
      inflight.current?.abort();
    };
  }, [refetch]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(false), 1600);
    return () => clearTimeout(t);
  }, [flash]);

  const shown = overlay && meId ? applyOptimistic(rows, meId, overlay, new Date().toISOString()) : rows;
  const ranked = shown.filter((r) => r.rank !== null);
  const waiting = shown.filter((r) => r.rank === null);

  if (!shown.length) return <p className="muted">No accounts yet. The first person to join and pick starts the table.</p>;

  return (
    <div className="stack">
      <div className="table-wrap">
        <table className="p7-table">
          <thead>
            <tr>
              <th>#</th><th>Selector</th><th>Status</th>
              <th className="r hide-sm">Rounds</th><th className="r hide-sm">Hits</th><th className="r">Pts</th>
            </tr>
          </thead>
          <tbody>
            {[...ranked, ...waiting].map((r) => {
              const mine = r.id === meId;
              const pending = mine && overlay !== null;
              const st = STATUS[r.status];
              const onTable = r.rank !== null;
              return (
                <tr key={r.id} className={`${mine ? "p7-me" : ""}${mine && flash ? " p7-flash" : ""}${onTable ? "" : " p7-waiting"}`}>
                  <td className="rank">{onTable ? `${r.rank}${r.sharedRank ? "=" : ""}` : "–"}</td>
                  <td>
                    {r.name}
                    {mine && <span className="badge badge-kit" style={{ marginLeft: "0.4rem" }}>You</span>}
                  </td>
                  <td>
                    <span className={`p7-status ${pending ? "p7-saving" : st.cls}`}>{pending ? "Saving…" : st.label}</span>
                  </td>
                  <td className="r hide-sm">{onTable ? r.rounds : "–"}</td>
                  <td className="r hide-sm">{onTable ? `${r.hits}/${r.totalPicks}` : "–"}</td>
                  <td className="r pts">{onTable ? r.points : <span className="muted">–</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ margin: 0 }} aria-live="off">
        <span className="p7-live-dot" aria-hidden="true" /> Live · updated <Ago at={updatedAt} />. Everyone starts on 0 the moment they pick; points
        arrive when a match they picked for is played. Which players people picked stays hidden until the week locks.
      </p>
    </div>
  );
}

function Ago({ at }: { at: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.round((now - at) / 1000));
  return <span suppressHydrationWarning>{s < 5 ? "just now" : s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`}</span>;
}
