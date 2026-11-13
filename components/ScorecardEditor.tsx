"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ROSTER, playerName } from "@/config/club";
import type {
  DrawResult,
  FairPlayBreach,
  FairPlayLoss,
  GoalEvent,
  GoalKind,
  LeagueSettings,
  RotationLapse,
  RotationMiss,
  RulesVersion,
  Side,
} from "@/lib/league/types";
import {
  FAIR_PLAY_BREACHES,
  FAIR_PLAY_LABEL,
  GOAL_KINDS,
  GOAL_KINDS_V2,
  GOAL_KIND_LABEL,
  POINTS_V2,
  POINT_KIND_LABEL,
  ROTATION_LABEL,
  ROTATION_LAPSES,
  matchItems,
  winnerOf,
  deflectionRulingOf,
  scoreMatch,
  scoreline,
  validateAwards,
  validateScorecard,
} from "@/lib/scoring/rules";
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

/** v2 labels: "Open play" reads as just "Goal". */
const V2_KIND_LABEL: Partial<Record<GoalKind, string>> = { open_play: "Goal", penalty: "Penalty", free_kick: "Direct free kick", own_goal: "Own goal" };

export function ScorecardEditor({
  matchId,
  attendees,
  draw,
  initial,
  initialMotm,
  initialFairPlayLost,
  initialRotation,
  version,
  settings,
  isCorrection,
  windowOpen,
  deadline,
}: {
  matchId: string;
  attendees: string[];
  draw: DrawResult;
  initial: GoalEvent[];
  initialMotm: Record<Side, string | null> | null;
  initialFairPlayLost: FairPlayLoss[];
  initialRotation: { missed: RotationMiss[]; checked: boolean; noResult: boolean };
  version: RulesVersion;
  settings: LeagueSettings;
  isCorrection: boolean;
  windowOpen: boolean;
  deadline: string | null;
}) {
  const router = useRouter();
  const v2 = version === 2;
  const [events, setEvents] = useState<GoalEvent[]>(initial);
  const [motm, setMotm] = useState<Record<Side, string | null>>(initialMotm ?? { A: null, B: null });
  const [fairPlayLost, setFairPlayLost] = useState<FairPlayLoss[]>(initialFairPlayLost);
  const [rotationMissed, setRotationMissed] = useState<RotationMiss[]>(initialRotation.missed);
  const [rotationChecked, setRotationChecked] = useState(initialRotation.checked);
  const [noResult, setNoResult] = useState(initialRotation.noResult);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const rules = { secondAssistEnabled: settings.secondAssistEnabled, deflectionDefault: settings.deflectionDefault };

  const matchCtx = { knownPlayers: KNOWN, attendees, teamA: draw.teamA, teamB: draw.teamB, floater: draw.floater };
  const issues = useMemo(
    () => validateScorecard(events, matchCtx, rules, version),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, attendees, draw, settings, version],
  );
  const awardIssues = useMemo(
    () => (v2 ? validateAwards({ motm, fairPlayLost, rotationMissed, rotationChecked }, matchCtx) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [v2, motm, fairPlayLost, rotationMissed, rotationChecked, attendees, draw],
  );
  const errors = [...issues, ...awardIssues].filter((i) => i.level === "error");
  const score = scoreline(events);
  const scorable = { attendees, events, rulesVersion: version, motm, fairPlayLost, rotationMissed, noResult, draw };
  const items = matchItems(scorable, rules);
  const winner = winnerOf({ events, noResult });
  const lines = [...scoreMatch(scorable, rules).values()]
    .filter((l) => l.points !== 0 || l.goals || l.assists)
    .sort((a, b) => b.points - a.points || playerName(a.playerId).localeCompare(playerName(b.playerId)));
  const lostBy = new Map(fairPlayLost.map((f) => [f.playerId, f.reason]));
  const missedBy = new Map(rotationMissed.map((r) => [r.playerId, r.reason]));
  const setMiss = (id: string, reason: RotationLapse | null) =>
    setRotationMissed((xs) => [...xs.filter((x) => x.playerId !== id), ...(reason ? [{ playerId: id, reason }] : [])]);
  const setBreach = (id: string, reason: FairPlayBreach | null) =>
    setFairPlayLost((xs) => [...xs.filter((x) => x.playerId !== id), ...(reason ? [{ playerId: id, reason }] : [])]);
  const teamOf = (side: Side) => [...(side === "A" ? draw.teamA : draw.teamB), ...(draw.floater ? [draw.floater] : [])];
  const byName = (ids: string[]) => [...ids].sort((a, b) => playerName(a).localeCompare(playerName(b)));
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
        if (e.secondAssistId && !v2) out.secondAssistId = e.secondAssistId;
        if (v2 && (e.kind === "penalty" || e.kind === "free_kick" || e.kind === "own_goal")) delete out.assistId;
        if (e.kind === "deflection") {
          out.deflectedById = e.deflectedById ?? null;
          out.deflectionRuling = deflectionRulingOf(e, rules);
        }
        if (e.note) out.note = e.note;
        return out;
      });
      await api(`/api/matchdays/${matchId}/scorecard`, "PUT", {
        events: clean,
        reason: isCorrection ? reason : undefined,
        ...(v2 ? { motm, fairPlayLost, rotationMissed, rotationChecked, noResult } : {}),
      });
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
        <span className="score-wrap">
          <span className="score num">{score.A}–{score.B}</span>
          {v2 && (
            <span className="small muted">
              {noResult ? "No result" : winner ? `${TEAM[winner]} win · +${POINTS_V2.win} each` : "Draw · no win bonus"}
            </span>
          )}
        </span>
        <span className="row">Red <span className="bib bib-B" /></span>
      </div>
      {v2 && (
        <label className="row" style={{ gap: "0.5rem", textTransform: "none", letterSpacing: 0, fontFamily: "inherit", fontSize: "0.9rem", color: "var(--text)" }}>
          <input type="checkbox" checked={noResult} disabled={locked} onChange={(x) => setNoResult(x.target.checked)} />
          Match abandoned / no result (goals, MOTM and conduct still count; nobody gets the win bonus)
        </label>
      )}

      {locked && (
        <div className="alert alert-warn">The correction window closed on {deadline?.slice(0, 10)}. This scorecard is final (widen the window in Settings if you must).</div>
      )}

      <ol className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {events.map((e, i) => {
          const own = e.kind === "own_goal";
          const ruling = e.kind === "deflection" ? deflectionRulingOf(e, rules) : null;
          const noAssist = own || e.kind === "free_kick" || ruling === "own_goal" || (v2 && e.kind === "penalty");
          const myIssues = issues.filter((x) => x.eventId === e.id);
          const other: Side = e.side === "A" ? "B" : "A";
          return (
            <li key={e.id} className="panel stack" style={{ borderColor: myIssues.some((x) => x.level === "error") ? "var(--danger)" : undefined }}>
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
                    {(v2 ? GOAL_KINDS_V2 : GOAL_KINDS).map((k) => (
                      <option key={k} value={k}>{v2 ? V2_KIND_LABEL[k] : GOAL_KIND_LABEL[k]}</option>
                    ))}
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
                  label={!v2 && e.kind === "penalty" ? "Assist (only if you're crediting one)" : "Assist"}
                  value={noAssist ? null : e.assistId}
                  onChange={(v) => update(e.id, { assistId: v, secondAssistId: v ? e.secondAssistId : null })}
                  draw={draw}
                  prefer={e.side}
                  optional
                  disabled={locked || noAssist}
                />
                {!v2 && settings.secondAssistEnabled && !noAssist && (
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
              {noAssist && (
                <p className="small muted" style={{ margin: 0 }}>
                  {own || ruling === "own_goal" ? "Own goals carry no assist." : e.kind === "penalty" ? "Penalties carry no assist." : "Direct free kicks carry no assist."}
                </p>
              )}
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

      {v2 && (
        <>
          <div className="panel stack">
            <h3>Man of the Match <span className="muted small">+{POINTS_V2.motm} each</span></h3>
            <div className="award-grid">
              {(["A", "B"] as Side[]).map((side) => (
                <div key={side} className="stack" style={{ gap: "0.4rem" }}>
                  <label><span className={`bib bib-${side}`} /> {TEAM[side]}</label>
                  <div className="chips" role="radiogroup" aria-label={`${TEAM[side]} Man of the Match`}>
                    {byName(teamOf(side)).map((id) => (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        className="chip"
                        aria-checked={motm[side] === id}
                        aria-pressed={motm[side] === id}
                        disabled={locked}
                        onClick={() => setMotm((m) => ({ ...m, [side]: m[side] === id ? null : id }))}
                      >
                        {playerName(id)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel stack">
            <div className="row spread">
              <h3>Conduct</h3>
              <span className="small muted">
                {rotationMissed.length ? `${rotationMissed.length} missed rotation` : `All ${attendees.length} rotated`} ·{" "}
                {fairPlayLost.length ? `${fairPlayLost.length} lost fair play` : "all fair"}
              </span>
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              Everyone starts ticked. Untick <b>Fair play</b> (+{POINTS_V2.fairPlay}) for a foul conceded, card, dissent warning or dangerous
              challenge. Untick <b>Rotated</b> ({POINTS_V2.rotationMiss}) for anyone who skipped their goalkeeper or sub stint.
            </p>
            {(["A", "B"] as Side[]).map((side) => (
              <div key={side}>
                <div className="pos-head" style={{ margin: "0.5rem 0 0.2rem" }}>
                  <span><span className={`bib bib-${side}`} /> {TEAM[side]}</span>
                  {side === "A" && (
                    <button type="button" className="btn btn-sm" disabled={locked || !rotationMissed.length} onClick={() => setRotationMissed([])}>
                      Mark all rotated
                    </button>
                  )}
                </div>
                {byName(teamOf(side).filter((id) => attendees.includes(id) && (side === "A" || id !== draw.floater))).map((id) => {
                  const lost = lostBy.get(id);
                  const miss = missedBy.get(id);
                  return (
                    <div key={id} className="conduct-row">
                      <span className="conduct-name">
                        {playerName(id)}
                        {id === draw.floater && <span className="badge badge-muted" style={{ marginLeft: "0.35rem" }}>floater</span>}
                      </span>
                      <label className="conduct-toggle">
                        <input type="checkbox" checked={lost === undefined} disabled={locked} onChange={(x) => setBreach(id, x.target.checked ? null : "foul")} />
                        Fair play
                      </label>
                      <label className="conduct-toggle">
                        <input type="checkbox" checked={miss === undefined} disabled={locked} onChange={(x) => setMiss(id, x.target.checked ? null : "gk")} />
                        Rotated
                      </label>
                      {lost !== undefined && (
                        <div className="chips" role="radiogroup" aria-label={`Why ${playerName(id)} lost fair play`}>
                          {FAIR_PLAY_BREACHES.map((b) => (
                            <button key={b} type="button" role="radio" className="chip" aria-checked={lost === b} aria-pressed={lost === b} disabled={locked} title={FAIR_PLAY_LABEL[b].long} onClick={() => setBreach(id, b)}>
                              {FAIR_PLAY_LABEL[b].short}
                            </button>
                          ))}
                        </div>
                      )}
                      {miss !== undefined && (
                        <div className="chips" role="radiogroup" aria-label={`Which turn ${playerName(id)} skipped`}>
                          {ROTATION_LAPSES.map((r) => (
                            <button key={r} type="button" role="radio" className="chip" aria-checked={miss === r} aria-pressed={miss === r} disabled={locked} onClick={() => setMiss(id, r)}>
                              {ROTATION_LABEL[r]}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            <label className="confirm-row">
              <input type="checkbox" checked={rotationChecked} disabled={locked} onChange={(x) => setRotationChecked(x.target.checked)} />
              I&apos;ve checked who went in goal and who subbed.
            </label>
          </div>
        </>
      )}

      <div className="panel stack">
        <h3>Points preview</h3>
        {v2 ? (
          <ul className="breakdown-list">
            {lines.map((l) => (
              <li key={l.playerId}>
                <span className="bd-name">{playerName(l.playerId)}</span>
                <span className="bd-items">
                  {(items.get(l.playerId) ?? []).map((it, k) => (
                    <span key={k} className={`bd-chip${it.points < 0 ? " neg" : ""}`} title={it.detail}>
                      {POINT_KIND_LABEL[it.kind].icon} {it.points > 0 ? "+" : ""}{it.points}
                    </span>
                  ))}
                </span>
                <b className={`bd-total num${l.points < 0 ? " neg" : ""}`}>{l.points}</b>
              </li>
            ))}
          </ul>
        ) : lines.length ? (
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
        {awardIssues.map((x, k) => (
          <div key={k} className="alert alert-error">{x.message}</div>
        ))}
        {issues.some((i) => i.level === "error") && (
          <div className="alert alert-error">Fix the goal errors above before saving.</div>
        )}
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
