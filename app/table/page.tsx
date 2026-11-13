import type { Metadata } from "next";
import { isDropIn, playerName } from "@/config/club";
import { deriveSeason, selectorName, shortDate } from "@/lib/league/derive";
import { getState } from "@/lib/server/store";
import { Sparkline } from "@/components/charts/Sparkline";
import { Empty, Kicker, Name } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Table" };

export default async function TablePage() {
  const state = await getState();
  const { played, standings, selectors, awards } = deriveSeason(state);
  const dateOf = Object.fromEntries(played.map((m) => [m.id, shortDate(m.date)]));

  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <Kicker label="Season standings" no={`${played.length} match day${played.length === 1 ? "" : "s"}`} />
        <h1>The <em>table.</em></h1>
        <p className="lede">Goal +5 · Assist +3 · Own goal −2. Ties split by goals, then assists, then head-to-head, then shared.</p>
      </header>

      {played.length === 0 ? (
        <Empty>No scorecards yet. Everyone&apos;s joint top on zero.</Empty>
      ) : (
        <>
          <section className="grid grid-3">
            {awards.map((a) => (
              <div key={a.key} className="panel stat-tile">
                <div className="l" style={{ marginTop: 0, color: "var(--gold)" }}>{a.title}</div>
                <div className="v" style={{ fontSize: "1.7rem", marginTop: "0.35rem" }}>
                  {a.winners.length ? a.winners.map((w) => (a.key === "oracle" ? selectorName(state, w) : playerName(w))).join(" & ") : "—"}
                </div>
                <div className="l">{a.winners.length ? `${a.value} ${a.unit}` : "Nobody qualifies yet"}</div>
              </div>
            ))}
          </section>
          {state.settings.excludeDropInsFromAwards && (
            <p className="small muted">Drop-ins are excluded from season awards this season (they still appear in the table).</p>
          )}

          <section className="panel">
            <div className="panel-head">
              <h2>Players</h2>
              <span className="small muted">Form = points in last 5 match days played</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Player</th><th className="r">P</th><th className="r">G</th><th className="r">A</th>
                    {state.settings.secondAssistEnabled && <th className="r hide-sm">2A</th>}
                    <th className="r hide-sm">OG</th><th className="hide-sm">Form</th><th className="r">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((r) => (
                    <tr key={r.playerId} id={r.playerId} style={r.played === 0 ? { opacity: 0.5 } : undefined}>
                      <td className="rank">{r.rank}{r.sharedRank ? "=" : ""}</td>
                      <td><Name id={r.playerId} /></td>
                      <td className="r">{r.played}</td>
                      <td className="r">{r.goals}</td>
                      <td className="r">{r.assists}</td>
                      {state.settings.secondAssistEnabled && <td className="r hide-sm">{r.secondAssists}</td>}
                      <td className="r hide-sm">{r.ownGoals}</td>
                      <td className="hide-sm">
                        <Sparkline values={r.form} labels={played.filter((m) => m.id in r.perMatch).slice(-5).map((m) => dateOf[m.id])} />
                      </td>
                      <td className={`r pts ${r.points < 0 ? "neg" : ""}`}>{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small muted" style={{ marginTop: "0.75rem" }}>
              “=” marks a shared rank. Head-to-head compares points earned in the match days both players played.
              {standings.some((r) => isDropIn(r.playerId)) && " Drop-ins are badged."}
            </p>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Pick 7 selectors</h2>
              <span className="small muted">Hit = a pick who scored or assisted</span>
            </div>
            {selectors.length ? (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>#</th><th>Selector</th><th className="r">Rounds</th><th className="r">Hits</th><th className="r hide-sm">Hit rate</th><th className="r">Pts</th></tr></thead>
                  <tbody>
                    {selectors.map((s) => (
                      <tr key={s.selectorId}>
                        <td className="rank">{s.rank}{s.sharedRank ? "=" : ""}</td>
                        <td>{selectorName(state, s.selectorId)}</td>
                        <td className="r">{s.rounds}</td>
                        <td className="r">{s.hits}/{s.totalPicks}</td>
                        <td className="r hide-sm">{Math.round(s.hitRate * 100)}%</td>
                        <td className="r pts">{s.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">No pick-7 entries on played match days yet.</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
