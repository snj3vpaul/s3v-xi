"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CLUB } from "@/config/club";
import type { LeagueSettings } from "@/lib/league/types";
import { api } from "./api";

export function SettingsForm({ settings }: { settings: LeagueSettings }) {
  const router = useRouter();
  const [s, setS] = useState(settings);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof LeagueSettings>(k: K, v: LeagueSettings[K]) => setS((x) => ({ ...x, [k]: v }));
  const dc = s.defaultConstraints;
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api("/api/settings", "PUT", s);
          setMsg({ ok: true, text: "Saved. Every table recalculates with the new rules." });
          router.refresh();
        } catch (e) {
          setMsg({ ok: false, text: (e as Error).message });
        }
      }}
    >
      <h3>Scoring rulings</h3>
      <div className="field">
        <label htmlFor="defl">Default ruling for deflected shots</label>
        <select id="defl" value={s.deflectionDefault} onChange={(e) => set("deflectionDefault", e.target.value as LeagueSettings["deflectionDefault"])}>
          <option value="own_goal">Own goal (−2 to the deflecting player)</option>
          <option value="goal">Shooter&apos;s goal (+5, assist counts)</option>
        </select>
        <p className="small muted">Pre-fills new deflection entries; each goal keeps the ruling it was saved with.</p>
      </div>
      <label className="check">
        <input type="checkbox" checked={s.secondAssistEnabled} onChange={(e) => set("secondAssistEnabled", e.target.checked)} />
        <span>Second assist (pre-assist) earns +1 — applies to the whole season, past matches included</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={s.excludeDropInsFromAwards} onChange={(e) => set("excludeDropInsFromAwards", e.target.checked)} />
        <span>Exclude drop-ins from season awards (they stay on the leaderboard)</span>
      </label>
      <div className="field" style={{ maxWidth: 240 }}>
        <label htmlFor="cw">Correction window (days)</label>
        <input id="cw" type="number" min={0} max={365} value={s.correctionWindowDays} onChange={(e) => set("correctionWindowDays", Number(e.target.value))} />
      </div>
      <h3 style={{ marginTop: "1rem" }}>Draw defaults</h3>
      <label className="check">
        <input type="checkbox" checked={dc.splitDropIns} onChange={(e) => set("defaultConstraints", { ...dc, splitDropIns: e.target.checked })} />
        <span>Split drop-ins evenly</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={dc.avoidRepeat} onChange={(e) => set("defaultConstraints", { ...dc, avoidRepeat: e.target.checked })} />
        <span>Avoid repeating last match day&apos;s teams</span>
      </label>
      <div className="field" style={{ maxWidth: 240 }}>
        <label htmlFor="mps2">Max per side on the pitch</label>
        <input id="mps2" type="number" min={CLUB.minPerSide} max={11} value={dc.maxPerSide} onChange={(e) => set("defaultConstraints", { ...dc, maxPerSide: Number(e.target.value) })} />
      </div>
      <div className="row">
        <button className="btn btn-primary">Save settings</button>
        {msg && <span className={`small ${msg.ok ? "" : "neg"}`}>{msg.text}</span>}
      </div>
    </form>
  );
}
