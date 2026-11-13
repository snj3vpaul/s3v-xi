import Link from "next/link";
import type { Metadata } from "next";
import { playerName } from "@/config/club";
import { formatLabel } from "@/lib/draw/draw";
import { SERIES, TEAM_NAMES } from "@/config/schedule";
import { fmtKickoff } from "@/lib/league/schedule";
import { fmtDate, upcoming } from "@/lib/league/derive";
import { currentSquad } from "@/lib/league/ledger";
import { isAdmin } from "@/lib/server/auth";
import { getState } from "@/lib/server/store";
import { AttendanceEditor } from "@/components/AttendanceEditor";
import { DrawControls } from "@/components/DrawControls";
import { ResetDraw, VerifyDraw } from "@/components/DrawActions";
import { TeamsView } from "@/components/TeamsView";
import { Empty, Kicker, Name } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Match-day draw" };

export default async function DrawPage() {
  const [state, admin] = await Promise.all([getState(), isAdmin()]);
  const m = upcoming(state);
  const withTeam = state.users.filter((u) => currentSquad(u)).length;

  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <Kicker label="Match day" no="Draw" />
        <h1>
          The hat <em>decides.</em>
        </h1>
        <p className="lede">
          Two sides, drawn at random from whoever turns up. Seeded, recorded and re-runnable — no picking mates, no stitch-ups.
        </p>
      </header>

      {!m ? (
        <Empty>
          No match day scheduled yet.{" "}
          {admin ? <Link href="/admin">Create one in Admin.</Link> : "An admin will set one up before kick-off."}
        </Empty>
      ) : (
        <section className="stack">
          <div className="panel-head">
            <h2>{m.label || `${TEAM_NAMES.A} vs ${TEAM_NAMES.B}`}</h2>
            <span className="muted">{fmtKickoff(m.kickoffAt, SERIES.timeZone)}</span>
            <span className="badge badge-kit">{m.status === "open" ? "Picks open · not drawn" : "Teams drawn"}</span>
          </div>

          {m.status === "open" && (
            <div className="grid grid-2">
              <div className="panel stack">
                {admin ? (
                  <AttendanceEditor matchId={m.id} initial={m.attendees} />
                ) : (
                  <>
                    <h3>Who&apos;s here ({m.attendees.length})</h3>
                    <div className="chips">
                      {m.attendees.length ? m.attendees.map((id) => <span key={id} className="chip"><Name id={id} /></span>) : <span className="muted">Attendance not taken yet.</span>}
                    </div>
                  </>
                )}
                <p className="small muted">
                  {withTeam} account{withTeam === 1 ? " has" : "s have"} a Pick 7 team set. <Link href="/team">Check yours</Link> — it locks at
                  kick-off or when the teams are drawn.
                </p>
              </div>
              <div className="panel">
                {admin ? (
                  <DrawControls matchId={m.id} defaults={state.settings.defaultConstraints} attendees={m.attendees} />
                ) : (
                  <div className="stack">
                    <h3>Waiting for the draw</h3>
                    <p className="muted">An admin draws the teams once everyone&apos;s arrived. Refresh after kick-off time.</p>
                    <Link href="/admin" className="btn btn-sm">Admin login</Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {m.draw && (
            <div className="stack">
              <div className="panel stack">
                <div className="row spread">
                  <span className="display" style={{ fontSize: "1.6rem" }}>{formatLabel(m.draw)}</span>
                  <span className="small muted">Drawn {new Date(m.draw.drawnAt).toLocaleString("en-CA", { timeZone: "America/Toronto" })}</span>
                </div>
                <TeamsView draw={m.draw} />
                {m.draw.floater && (
                  <p className="small muted">
                    Odd numbers: {playerName(m.draw.floater)} is the floater — first half for Team{" "}
                    {m.draw.floaterFirstHalf === "A" ? "White" : "Red"}, then swaps. Floater duty goes to whoever has floated least.
                  </p>
                )}
                {m.draw.rollingSubs > 0 && (
                  <p className="small muted">
                    {m.draw.perSide} on the pitch per side; each team rolls its {m.draw.rollingSubs} extra player
                    {m.draw.rollingSubs > 1 ? "s" : ""} on and off.
                  </p>
                )}
              </div>
              <div className="panel stack">
                <h3>Audit trail</h3>
                <dl className="small" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.3rem 1rem", margin: 0 }}>
                  <dt className="muted">Seed</dt>
                  <dd style={{ margin: 0, wordBreak: "break-all", fontFamily: "ui-monospace, monospace" }}>{m.draw.seed}</dd>
                  <dt className="muted">Attempt</dt>
                  <dd style={{ margin: 0 }}>{m.draw.attempt} (re-shuffles from the same seed until every rule holds)</dd>
                  <dt className="muted">Rules</dt>
                  <dd style={{ margin: 0 }}>
                    {[
                      m.draw.constraints.splitDropIns && "split drop-ins",
                      m.draw.constraints.avoidRepeat && "no repeat of last teams",
                      ...m.draw.constraints.keepTogether.map(([a, b]) => `${playerName(a)} with ${playerName(b)}`),
                      ...m.draw.constraints.keepApart.map(([a, b]) => `${playerName(a)} apart from ${playerName(b)}`),
                    ]
                      .filter(Boolean)
                      .join(" · ") || "none"}
                  </dd>
                  <dt className="muted">Algorithm</dt>
                  <dd style={{ margin: 0 }}>{m.draw.algorithm}</dd>
                </dl>
                <div className="row">
                  <VerifyDraw matchId={m.id} />
                  {admin && <Link className="btn btn-sm btn-primary" href={`/admin/match/${m.id}`}>Enter scorecard</Link>}
                  {admin && <ResetDraw matchId={m.id} />}
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
