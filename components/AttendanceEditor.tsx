"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CLUB } from "@/config/club";
import { api } from "./api";
import { PlayerChips } from "./PlayerChips";

export function AttendanceEditor({ matchId, initial }: { matchId: string; initial: string[] }) {
  const router = useRouter();
  const [sel, setSel] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = sel.length !== initial.length || sel.some((x) => !initial.includes(x));
  const n = sel.length;
  const per = Math.min(CLUB.defaultMaxPerSide, Math.floor(n / 2));

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await api(`/api/matchdays/${matchId}`, "PATCH", { attendees: sel });
      setMsg({ ok: true, text: "Attendance saved." });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="row spread">
        <h3>Who&apos;s here?</h3>
        <span className="muted small num">
          {n} in{n >= CLUB.minPerSide * 2 ? ` → ${per}v${per}${n % 2 ? " + floater" : ""}` : ` · need ${CLUB.minPerSide * 2}+`}
        </span>
      </div>
      <PlayerChips selected={sel} onToggle={(id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))} />
      <div className="row">
        <button className="btn btn-sm" onClick={save} disabled={busy || !dirty}>
          Save attendance
        </button>
        {msg && <span className={msg.ok ? "small" : "small neg"}>{msg.text}</span>}
      </div>
    </div>
  );
}
