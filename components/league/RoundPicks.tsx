"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LEAGUE_LIMITS } from "@/lib/league/config";
import type { FixtureView } from "@/lib/league/service";
import { leagueApi } from "./api";
import { LocalTime } from "./LocalTime";

type Draft = Record<string, { home: number | null; away: number | null }>;
const REASON_LABEL = { exact: "Exact score", outcome: "Right result", miss: "Not this time" } as const;

function Tile({ value, kind }: { value: number | null; kind?: "result" }) {
  const [bump, setBump] = useState(false);
  useEffect(() => { setBump(true); const t = setTimeout(() => setBump(false), 230); return () => clearTimeout(t); }, [value]);
  return <span className={`lg-tile${value === null ? " empty" : ""}${kind ? ` ${kind}` : ""}${bump ? " bump" : ""}`}>{value ?? "?"}</span>;
}

function Stepper({ value, onChange, label, disabled }: { value: number | null; onChange: (v: number | null) => void; label: string; disabled?: boolean }) {
  return (
    <div className="lg-stepper" role="group" aria-label={label}>
      <button type="button" disabled={disabled || (value ?? 0) >= LEAGUE_LIMITS.maxGoals} aria-label={`${label}: one more`}
        onClick={() => onChange(value === null ? 0 : value + 1)}>+</button>
      <span aria-live="polite"><Tile value={value} /></span>
      <button type="button" disabled={disabled || value === null || value === 0} aria-label={`${label}: one fewer`}
        onClick={() => onChange(Math.max(0, (value ?? 0) - 1))}>−</button>
    </div>
  );
}

export function RoundPicks({ fixtures, userId }: { fixtures: FixtureView[]; userId: string }) {
  const router = useRouter();
  const initial = useMemo<Draft>(() => Object.fromEntries(fixtures.map((f) => [f.id, { home: f.myPick?.home ?? null, away: f.myPick?.away ?? null }])), [fixtures]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => setDraft(initial), [initial]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(t); }, []);

  const isOpen = (f: FixtureView) => !f.locked && Date.parse(f.deadlineAt) > now;
  const openFixtures = fixtures.filter(isOpen);
  const changed = openFixtures.filter((f) => {
    const d = draft[f.id];
    return d.home !== null && d.away !== null && (d.home !== f.myPick?.home || d.away !== f.myPick?.away);
  });
  const half = openFixtures.filter((f) => (draft[f.id].home === null) !== (draft[f.id].away === null));
  const picked = openFixtures.filter((f) => f.myPick).length;

  async function save() {
    setBusy(true); setMsg(null);
    const r = await leagueApi<{ saved: string[]; rejected: Array<{ fixtureId: string; reason: string }> }>("/picks", "POST", {
      picks: changed.map((f) => ({ fixtureId: f.id, home: draft[f.id].home, away: draft[f.id].away })),
    });
    setBusy(false);
    if (r.data.error) { setMsg({ kind: "err", text: r.data.error }); return; }
    const saved = r.data.saved?.length ?? 0, rejected = r.data.rejected ?? [];
    setMsg(rejected.length
      ? { kind: "err", text: `${saved} saved. ${rejected.length} couldn't be saved: ${rejected[0].reason}` }
      : { kind: "ok", text: saved === 1 ? "Pick locked in your notebook ✍️ You can change it until the deadline." : `${saved} picks saved ✍️ Change them any time before each deadline.` });
    router.refresh();
  }

  if (!fixtures.length) {
    return <div className="lg-card lg-empty"><div className="big">🗓️</div><h3>No fixtures yet</h3><p className="lg-muted">The admin is still drawing up the schedule. Check back soon.</p></div>;
  }

  return (
    <>
      <div className="lg-fixtures">
        {fixtures.map((f) => {
          const open = isOpen(f);
          const d = draft[f.id];
          const myReason = f.myPoints?.reason;
          return (
            <article key={f.id} className={`lg-card lg-fx${myReason === "exact" ? " exact" : ""}`} aria-label={`${f.homeTeam} versus ${f.awayTeam}`}>
              <div className="lg-fx-meta">
                <span>⏱ <LocalTime iso={f.kickoffAt} /></span>
                {f.result ? <span className="lg-pill scored">Full time</span>
                  : open ? <span className="lg-pill open">Locks <LocalTime iso={f.deadlineAt} mode="relative" /></span>
                  : <span className="lg-pill locked">🔒 Picks locked</span>}
              </div>
              <div className="lg-fx-body">
                <div className="lg-team home">{f.homeTeam}<small>Home</small></div>
                {open ? (
                  <div className="lg-scoreline">
                    <Stepper label={`${f.homeTeam} goals`} value={d.home} onChange={(v) => setDraft({ ...draft, [f.id]: { ...d, home: v } })} />
                    <span className="lg-dash">–</span>
                    <Stepper label={`${f.awayTeam} goals`} value={d.away} onChange={(v) => setDraft({ ...draft, [f.id]: { ...d, away: v } })} />
                  </div>
                ) : f.result ? (
                  <div className="lg-scoreline" aria-label={`Final score ${f.result.home} to ${f.result.away}`}>
                    <Tile value={f.result.home} kind="result" /><span className="lg-dash">–</span><Tile value={f.result.away} kind="result" />
                  </div>
                ) : (
                  <div className="lg-scoreline" aria-label="Your locked pick">
                    <Tile value={f.myPick?.home ?? null} /><span className="lg-dash">–</span><Tile value={f.myPick?.away ?? null} />
                  </div>
                )}
                <div className="lg-team">{f.awayTeam}<small>Away</small></div>
              </div>
              <div className="lg-fx-foot">
                <span className="lg-yourpick lg-muted">
                  {open
                    ? (f.myPick ? <>Saved pick <b>{f.myPick.home}–{f.myPick.away}</b></> : "No pick yet — channel your inner pundit 👀")
                    : f.result
                      ? (f.myPick ? <>You said <b>{f.myPick.home}–{f.myPick.away}</b></> : "You sat this one out 🪑")
                      : (f.myPick ? "Your pick is locked in. Awaiting the final whistle…" : "No pick this time. The suspense is all theirs 🍿")}
                </span>
                {f.myPoints && (
                  <span className={`lg-chip ${f.myPoints.reason}`}>+{f.myPoints.points} <small>{REASON_LABEL[f.myPoints.reason]}</small></span>
                )}
                {open && <span className="lg-small lg-muted">{f.pickCount} {f.pickCount === 1 ? "friend has" : "friends have"} picked. Picks stay secret until lock.</span>}
              </div>
              {f.picks && (
                <details className="lg-others" open={Boolean(f.result)}>
                  <summary>Everyone&apos;s picks ({f.picks.length})</summary>
                  {f.picks.length ? (
                    <ul>
                      {f.picks.map((p) => (
                        <li key={p.userId} className={p.userId === userId ? "me" : undefined}>
                          <span aria-hidden="true">{p.avatar}</span><span className="nm">{p.name}</span>
                          {p.reason && <span className={`pt ${p.reason}`}>+{p.points}</span>}
                          <b>{p.home}–{p.away}</b>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="lg-small lg-muted" style={{ marginTop: 8 }}>Nobody picked this one. Bold strategy.</p>}
                </details>
              )}
            </article>
          );
        })}
      </div>

      {openFixtures.length > 0 && (
        <div className="lg-savebar">
          <p>
            {half.length ? `Finish both scores for ${half.length} ${half.length === 1 ? "match" : "matches"}`
              : changed.length ? `${changed.length} unsaved ${changed.length === 1 ? "pick" : "picks"}`
              : `${picked} of ${openFixtures.length} open picks saved`}
          </p>
          <button type="button" className={`lg-btn${!changed.length && picked === openFixtures.length ? " saved" : ""}`} disabled={busy || !changed.length} onClick={save}>
            {busy ? "Saving…" : changed.length ? "Save picks" : picked === openFixtures.length ? "All saved ✓" : "Save picks"}
          </button>
        </div>
      )}
      {msg && <p className={`lg-msg ${msg.kind}`} role="status" style={{ marginTop: 12 }}>{msg.text}</p>}
    </>
  );
}
