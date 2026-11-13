import type { Metadata } from "next";
import Link from "next/link";
import { CLUB, playerName } from "@/config/club";
import { fmtDate, upcoming } from "@/lib/league/derive";
import { rulesFrom } from "@/lib/league/ledger";
import { playedMatches, scoreSelection } from "@/lib/scoring/rules";
import { getState } from "@/lib/server/store";
import { PickForm } from "@/components/PickForm";
import { Empty, Kicker, Name, Points } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pick 7" };

export default async function PickPage() {
  const state = await getState();
  const m = upcoming(state);
  const last = playedMatches(state.matchDays).at(-1);
  const rules = rulesFrom(state.settings);
  const lastResults = last
    ? last.selections.map((s) => scoreSelection(s, last, rules)).sort((a, b) => b.points - a.points || b.hits - a.hits)
    : [];

  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <Kicker label="Prediction game" no="Pick 7" />
        <h1>
          Back your <em>seven.</em>
        </h1>
        <p className="lede">
          Before the draw, pick {CLUB.picksPerSelector} players you reckon will get on the scoresheet. Whatever team they
          land on, you bank exactly the points they earn — goals, assists and (ouch) own goals.
        </p>
      </header>

      {!m ? (
        <Empty>No upcoming match day yet — picks open as soon as one is scheduled.</Empty>
      ) : m.status === "open" ? (
        <section className="grid grid-2" style={{ alignItems: "start" }}>
          <div className="panel">
            <div className="panel-head">
              <h2>{m.label || fmtDate(m.date)}</h2>
              <span className="badge badge-kit">Open until the draw</span>
            </div>
            <PickForm matchId={m.id} existing={Object.fromEntries(m.selections.map((s) => [s.selectorId, s.picks]))} />
          </div>
          <div className="panel stack">
            <h3>Picks in ({m.selections.length})</h3>
            {m.selections.length ? (
              <ul className="stack small" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {[...m.selections]
                  .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
                  .map((s) => (
                    <li key={s.selectorId} className="row spread">
                      <Name id={s.selectorId} />
                      <span className="muted">🔒 hidden until the draw</span>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="muted">Nobody yet. Be first.</p>
            )}
          </div>
        </section>
      ) : (
        <section className="panel stack">
          <div className="panel-head">
            <h2>{m.label || fmtDate(m.date)} — picks revealed</h2>
            <Link href="/draw">See the teams</Link>
          </div>
          {m.selections.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Selector</th><th>Their seven</th></tr>
                </thead>
                <tbody>
                  {m.selections.map((s) => (
                    <tr key={s.selectorId}>
                      <td><Name id={s.selectorId} /></td>
                      <td className="small">{s.picks.map(playerName).join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">No picks were made for this match day.</p>
          )}
        </section>
      )}

      {last && (
        <section className="panel stack">
          <div className="panel-head">
            <h2>Last round · {fmtDate(last.date)}</h2>
            <Link href={`/matches/${last.id}`}>Match report</Link>
          </div>
          {lastResults.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Selector</th><th className="r">Hits</th><th className="hide-sm">Picks (points)</th><th className="r">Pts</th></tr>
                </thead>
                <tbody>
                  {lastResults.map((r) => (
                    <tr key={r.selectorId}>
                      <td><Name id={r.selectorId} /></td>
                      <td className="r">{r.hits}/{r.picks.length}</td>
                      <td className="small hide-sm">
                        {r.perPick.map((p, i) => (
                          <span key={p.playerId} className={p.played ? "" : "muted"}>
                            {i > 0 && ", "}
                            {playerName(p.playerId)} {p.played ? <Points v={p.points} /> : "(DNP)"}
                          </span>
                        ))}
                      </td>
                      <td className="r pts">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">No picks were made for that match day.</p>
          )}
        </section>
      )}
    </main>
  );
}
