"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { PlayerChips } from "./PlayerChips";

export function NewMatchDay({ defaultDate }: { defaultDate: string }) {
  const router = useRouter();
  const [date, setDate] = useState(defaultDate);
  const [label, setLabel] = useState("");
  const [time, setTime] = useState("22:00");
  const [att, setAtt] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          await api("/api/matchdays", "POST", { date, time, label, attendees: att });
          router.push("/draw");
          router.refresh();
        } catch (e) {
          setErr((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid grid-2">
        <div className="field">
          <label htmlFor="md-date">Match date</label>
          <input id="md-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="md-time">Kick-off (Toronto time)</label>
          <input id="md-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="md-label">Label (optional)</label>
          <input id="md-label" type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Season opener" />
        </div>
      </div>
      <div>
        <label>Attendance — tick now, or leave empty and take it at the pitch ({att.length} selected)</label>
        <PlayerChips selected={att} onToggle={(id) => setAtt((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))} />
      </div>
      <div className="row">
        <button className="btn btn-primary" disabled={busy}>Create extra match day</button>
        {err && <span className="small neg">{err}</span>}
      </div>
    </form>
  );
}

export function DeleteMatchDay({ id }: { id: string }) {
  const router = useRouter();
  const [sure, setSure] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="row">
      <button
        className="btn btn-sm btn-danger"
        onClick={async () => {
          if (!sure) return setSure(true);
          try {
            await api(`/api/matchdays/${id}`, "DELETE");
            router.refresh();
          } catch (e) {
            setErr((e as Error).message);
          }
        }}
        onBlur={() => setSure(false)}
      >
        {sure ? "Tap again to delete" : "Delete"}
      </button>
      {err && <span className="small neg">{err}</span>}
    </span>
  );
}
