"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";

export function AccountForm({
  initial,
  players,
}: {
  initial: { name: string; playerId: string | null; emailReminders: boolean; email: string };
  players: { id: string; name: string; dropin: boolean }[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [playerId, setPlayerId] = useState(initial.playerId ?? "");
  const [rem, setRem] = useState(initial.emailReminders);
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(body: Record<string, unknown>, ok: string) {
    setMsg(null);
    try {
      await api("/api/me", "PUT", body);
      setMsg({ ok: true, text: ok });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  return (
    <div className="stack">
      <form className="panel stack" onSubmit={(e) => { e.preventDefault(); save({ name, playerId: playerId || null, emailReminders: rem }, "Saved."); }}>
        <h3>Profile</h3>
        <p className="small muted" style={{ margin: 0 }}>Signed in as {initial.email}</p>
        <div className="field">
          <label htmlFor="ac-name">Display name</label>
          <input id="ac-name" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
        </div>
        <div className="field">
          <label htmlFor="ac-player">Linked RSFC player</label>
          <select id="ac-player" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
            <option value="">None</option>
            {players.map((p) => <option key={p.id} value={p.id}>{p.name}{p.dropin ? " (drop-in)" : ""}</option>)}
          </select>
        </div>
        <label className="check">
          <input type="checkbox" checked={rem} onChange={(e) => setRem(e.target.checked)} />
          <span>Email me before each Thursday deadline (Wednesday evening and Thursday midday)</span>
        </label>
        <div><button className="btn btn-primary">Save</button></div>
      </form>

      <form className="panel stack" onSubmit={(e) => { e.preventDefault(); save({ currentPassword: cur, newPassword: nw }, "Password changed. Other devices have been logged out."); setCur(""); setNw(""); }}>
        <h3>Change password</h3>
        <div className="field">
          <label htmlFor="ac-cur">Current password</label>
          <input id="ac-cur" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="ac-new">New password (8+ characters)</label>
          <input id="ac-new" type="password" autoComplete="new-password" minLength={8} value={nw} onChange={(e) => setNw(e.target.value)} required />
        </div>
        <div><button className="btn">Change password</button></div>
      </form>
      {msg && <div className={`alert ${msg.ok ? "alert-ok" : "alert-error"}`} role="status">{msg.text}</div>}
    </div>
  );
}
