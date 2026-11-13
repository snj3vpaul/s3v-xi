"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ROSTER, playerName } from "@/config/club";
import type { DrawResult, GoalEvent, GoalKind, LeagueSettings, Side } from "@/lib/league/types";
import { GOAL_KINDS, GOAL_KIND_LABEL, deflectionRulingOf, scoreMatch, scoreline, validateScorecard } from "@/lib/scoring/rules";
import { api } from "./api";

const KNOWN = new Set(ROSTER.map((p) => p.id));
const TEAM: Record<Side, string> = { A: "White", B: "Red" };
const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `g${Date.now()}${Math.random().toString(16).slice(2)}`);

function PlayerSelect({
  value,
  onChange,
  draw,
  label,
  optional = false,
  disabled = false,
  prefer,
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  draw: DrawResult;
  label: string;
  optional?: boolean;
  disabled?: boolean;
  /** Team listed first (the side this player is most likely on). */
  prefer: Side;
}) {
  const order: Side[] = prefer === "A" ? ["A", "B"] : ["B", "A"];
  const sorted = (ids: string[]) => [...ids].sort((a, b) => playerName(a).localeCompare(playerName(b)));
  return (
    <div>
      <label>{label}</label>
      <select value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value || null)} aria-label={label}>
        <option value="">{optional ? "— none —" : "Choose…"}</option>
        {order.map((s) => (
          <optgroup key={s} label={`Team ${TEAM[s]}`}>
            {sorted(s === "A" ? draw.teamA : draw.teamB).map((id) => (
              <option key={id} value={id}>{playerName(id)}</option>
            ))}
          </optgroup>
        ))}
        {draw.floater && (
          <optgroup label="Floater">
            <option value={draw.floater}>{playerName(draw.floater)}</option>
          </optgroup>
        )}
      </select>
    </div>
  );
}

export function ScorecardEditor({
  matchId,
  attendees,
  draw,
  initial,
  settings,
  isCorrection,
  windowOpen,
  deadline,
}: {
  matchId: string;
  attendees: string[];
  draw: DrawResult;
  initial: GoalEvent[];
  settings: LeagueSettings;
  isCorrection: boolean;
  windowOpen: boolean;
  deadline: string | null;
}) {
  const router = useRouter();
  const [events, setEvents] = useState<GoalEvent[]>(initial);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const rules = { secondAssistEnabled: settings.secondAssistEnabled, deflectionDefault: settings.deflectionDefault };

  const issues = useMemo(
    () => validateScorecard(events, { knownPlayers: KNOWN, attendees, teamA: draw.teamA, teamB: draw.teamB, floater: draw.floater }, rules),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, attendees, draw, settings],
  );
  const errors = issues.filter((i) => i.level === "error");
  const score = scoreline(events);
  const lines = [...scoreMatch({ attendees, events }, rules).values()].filter((l) => l.points !== 0 || l.goals || l.assists).sort((a, b) => b.points - a.points);
  const locked = isCorrection && !windowOpen;

  const update = (id: string, patch: Partial<GoalEvent>) => setEvents((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const add = (side: Side) =>
    setEvents((es) => [...es, { id: newId(), side, kind: "open_play", scorerId: "", assistId: null, minute: null }]);
  const move = (i: number, d: -1 | 1) =>
    setEvents((es) => {
      const a = [...es];
      const j = i + d;
      if (j < 0 || j >= a.length) return a;
      [a[i], a[j]] = [a[j], a[i]];
      return a;
    });

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const clean = events.map((e) => {
        const out: GoalEvent = { id: e.id, side: e.side, kind: e.kind, scorerId: e.scorerId };
        if (e.minute != null && !Number.isNaN(e.minute)) out.minute = e.minute;
        if (e.assistId) out.assistId = e.assistId;
        if (e.secondAssistId) out.secondAssistId = e.secondAssistId;
        if (e.kind === "deflection") {
          out.deflectedById = e.deflectedById ?? null;
          out.deflectionRuling = deflectionRulingOf(e, rules);
        }
        if (e.note) out.note = e.note;
        return out;
      });
      await api(`/api/matchdays/${matchId}/scorecard`, "PUT", { events: clean, reason: isCorrection ? reason : undefined });
      setMsg({ ok: true, text: isCorrection ? "Correction saved and logged. Standings recalculated." : "Scorecard published. The table is updated." });
      setReason("");
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="panel row spread sticky-score">
        <span className="row"><span className="bib bib-A" /> White</span>
        <span className="score num">{score.A}–{score.B}</span>
        <span className="row">Red <span className="bib bib-B" /></span>
      </div>

      {locked && (
        <div className="alert alert-warn">The correction window closed on {deadline?.slice(0, 10)}. This scorecard is final (widen the window in Settings if you must).</div>
      )}

      <ol className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {events.map((e, i) => {
          const own = e.kind === "own_goal";
          const ruling = e.kind === "deflection" ? deflectionRulingOf(e, rules) : null;
          const noAssist = own || e.kind === "free_kick" || ruling === "own_goal";
          const myIssues = issues.filter((x) => x.eventId === e.id);
          const other: Side = e.side === "A" ? "B" : "A";
          return (
            <li key={e.id} className="panel stack" style={{ borderColor: myIssues.some((x) => x.level === "error") ? "#6b3a32" : undefined }}>
              <div className="row spread">
                <span className="display" style={{ fontSize: "1.2rem" }}>
                  <span className={`bib bib-${e.side}`} /> Goal {i + 1} · Team {TEAM[e.side]}
                </span>
                <span className="row" style={{ gap: "0.3rem" }}>
                  <button type="button" className="btn btn-sm" onClick={() => move(i, -1)} disabled={locked || i === 0} aria-label="Move up">↑</button>
                  <button type="button" className="btn btn-sm" onClick={() => move(i, 1)} disabled={locked || i === events.length - 1} aria-label="Move down">↓</button>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => setEvents((es) => es.filter((x) => x.id !== e.id))} disabled={locked}>Remove</button>
                </span>
              </div>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.6rem" }}>
                <div>
                  <label>Credited to</label>
                  <select value={e.side} disabled={locked} onChange={(x) => update(e.id, { side: x.target.value as Side })}>
                    <option value="A">Team White</option>
                    <option value="B">Team Red</option>
                  </select>
                </div>
                <div>
                  <label>Type</label>
                  <select
                    value={e.kind}
                    disabled={locked}
                    onChange={(x) => {
                      const kind = x.target.value as GoalKind;
                      update(e.id, {
                        kind,
                        deflectionRuling: kind === "deflection" ? (e.deflectionRuling ?? settings.deflectionDefault) : undefined,
                        deflectedById: kind === "deflection" ? e.deflectedById : null,
                      });
                    }}
                  >
                    {GOAL_KINDS.map((k) => <option key={k} value={k}>{GOAL_KIND_LABEL[k]}</option>)}
                  </select>
                </div>
                <PlayerSelect
                  label={own ? "Own goal by" : e.kind === "deflection" ? "Shot by" : "Scorer"}
                  value={e.scorerId}
                  onChange={(v) => update(e.id, { scorerId: v ?? "" })}
                  draw={draw}
                  prefer={own ? other : e.side}
                  disabled={locked}
                />
                {e.kind === "deflection" && (
                  <>
                    <PlayerSelect label="Deflected off" value={e.deflectedById} onChange={(v) => update(e.id, { deflectedById: v })} draw={draw} prefer={other} disabled={locked} />
                    <div>
                      <label>Ruling</label>
                      <select value={ruling!} disabled={locked} onChange={(x) => update(e.id, { deflectionRuling: x.target.value as "own_goal" | "goal" })}>
                        <option value="own_goal">Own goal</option>
                        <option value="goal">Shooter&apos;s goal</option>
                      </select>
                    </div>
                  </>
                )}
                <PlayerSelect
                  label={e.kind === "penalty" ? "Assist (only if you're crediting one)" : "Assist"}
                  value={noAssist ? null : e.assistId}
                  onChange={(v) => update(e.id, { assistId: v, secondAssistId: v ? e.secondAssistId : null })}
                  draw={draw}
                  prefer={e.side}
                  optional
                  disabled={locked || noAssist}
                />
                {settings.secondAssistEnabled && !noAssist && (
                  <PlayerSelect label="Second assist (+1)" value={e.secondAssistId} onChange={(v) => update(e.id, { secondAssistId: v })} draw={draw} prefer={e.side} optional disabled={locked || !e.assistId} />
                )}
                <div>
                  <label>Minute (optional)</label>
                  <input
                    type="number"
                    min={0}
                    max={130}
                    inputMode="numeric"
                    value={e.minute ?? ""}
                    disabled={locked}
                    onChange={(x) => update(e.id, { minute: x.target.value === "" ? null : Number(x.target.value) })}
                  />
                </div>
              </div>
              {noAssist && <p className="small muted" style={{ margin: 0 }}>{own || ruling === "own_goal" ? "Own goals carry no assist." : "Direct free kicks carry no assist."}</p>}
              {myIssues.map((x, k) => (
                <div key={k} className={`alert ${x.level === "error" ? "alert-error" : "alert-warn"}`}>{x.message}</div>
              ))}
            </li>
          );
        })}
      </ol>

      {!locked && (
        <div className="row">
          <button type="button" className="btn" onClick={() => add("A")}>+ White goal</button>
          <button type="button" className="btn" onClick={() => add("B")}>+ Red goal</button>
        </div>
      )}

      <div className="panel stack">
        <h3>Points preview</h3>
        {lines.length ? (
          <div className="chips">
            {lines.map((l) => (
              <span key={l.playerId} className="chip">
                {playerName(l.playerId)} <b className={l.points < 0 ? "neg" : ""}>{l.points > 0 ? "+" : ""}{l.points}</b>
              </span>
            ))}
          </div>
        ) : (
          <p className="muted">{events.length ? "Choose scorers to see points." : "No goals yet — saving now records a 0–0."}</p>
        )}
        {isCorrection && !locked && (
          <div className="field">
            <label htmlFor="reason">Reason for this correction (required, shown in the match history)</label>
            <input id="reason" type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Assist was Vineet, not Vikram" />
          </div>
        )}
        {errors.length > 0 && <div className="alert alert-error">Fix {errors.length} error{errors.length > 1 ? "s" : ""} above before saving.</div>}
        <div className="row">
          <button className="btn btn-primary" onClick={save} disabled={busy || locked || errors.length > 0 || (isCorrection && !reason.trim())}>
            {busy ? "Saving…" : isCorrection ? "Save correction" : "Publish scorecard"}
          </button>
          {msg && <span className={`small ${msg.ok ? "" : "neg"}`} role="status">{msg.text}</span>}
        </div>
        {isCorrection && deadline && !locked && <p className="small muted">Corrections allowed until {new Date(deadline).toLocaleString("en-CA", { timeZone: "America/Toronto" })}.</p>}
      </div>
    </div>
  );
}
