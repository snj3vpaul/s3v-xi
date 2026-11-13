import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { playerName } from "@/config/club";
import { fmtDate, matchSummary, selectorName } from "@/lib/league/derive";
import { correctionDeadline, rulesFrom } from "@/lib/league/ledger";
import { FAIR_PLAY_LABEL, ROTATION_LABEL, rulesVersionOf, scoreSelection, winnerOf } from "@/lib/scoring/rules";
import { isAdmin } from "@/lib/server/auth";
import { getState } from "@/lib/server/store";
import { EventLine } from "@/components/EventLine";
import { TeamsView } from "@/components/TeamsView";
import { Kicker, Name, Points } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Match report" };

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [state, admin] = await Promise.all([getState(), isAdmin()]);
  const m = state.matchDays.find((x) => x.id === id);
  if (!m) notFound();
  const rules = rulesFrom(state.settings);
  const { score, lines, format } = matchSummary(m, state);
  const ranked = [...lines.values()].sort((a, b) => b.points - a.points || b.goals - a.goals || playerName(a.playerId).localeCompare(playerName(b.playerId)));
  const sels = m.status === "played" ? m.selections.map((s) => scoreSelection(s, m, rules, lines)).sort((a, b) => b.points - a.points) : [];
  const history = state.audit.filter((a) => a.matchId === m.id && a.action.startsWith("scorecard"));
  const deadline = correctionDeadline(m, state.settings);
  const v2 = rulesVersionOf(m) === 2;

  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <Kicker label="Match report" no={format ?? undefined} />
        <h1>{m.label || fmtDate(m.date)}</h1>
        <div className="row">
          <Link href="/matches">← All matches</Link>
          {admin && m.draw && <Link className="btn btn-sm" href={`/admin/match/${m.id}`}>{m.scorecardAt ? "Correct scorecard" : "Enter scorecard"}</Link>}
        </div>
      </header>

      {m.draw ? <TeamsView draw={m.draw} score={m.status === "played" ? score : undefined} /> : <p className="muted">Teams not drawn yet.</p>}

      {m.status === "played" && (
        <div className="grid grid-2" style={{ alignItems: "start" }}>
          <section className="panel">
            <h3>Scoresheet</h3>
            {m.events.length ? (
              <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0" }}>
                {m.events.map((e) => <EventLine key={e.id} e={e} rules={rules} version={rulesVersionOf(m)} />)}
              </ul>
            ) : (
              <p className="muted">0–0. The keepers had a day.</p>
            )}
            {v2 && (m.motm?.A || m.motm?.B) && (
              <p className="small" style={{ marginBottom: 0 }}>
                <b>Man of the Match:</b> {[m.motm?.A && `${playerName(m.motm.A)} (White)`, m.motm?.B && `${playerName(m.motm.B)} (Red)`].filter(Boolean).join(" · ")}
              </p>
            )}
            {v2 && (
              <p className="small" style={{ marginBottom: 0 }}>
                <b>Result:</b>{" "}
                {m.noResult ? "No result (abandoned), no win bonus" : (() => {
                  const w = winnerOf(m);
                  return w ? `${w === "A" ? "White" : "Red"} win, +3 to each of their players` : "Draw, no win bonus";
                })()}
              </p>
            )}
            {v2 && (m.rotationMissed?.length ?? 0) > 0 && (
              <p className="small muted" style={{ marginBottom: 0 }}>
                <b>Missed rotation:</b> {m.rotationMissed!.map((r) => `${playerName(r.playerId)} (${ROTATION_LABEL[r.reason].toLowerCase()})`).join(", ")}
              </p>
            )}
            {v2 && (m.fairPlayLost?.length ?? 0) > 0 && (
              <p className="small muted" style={{ marginBottom: 0 }}>
                <b>Lost fair play:</b> {m.fairPlayLost!.map((f) => `${playerName(f.playerId)} (${FAIR_PLAY_LABEL[f.reason].short.toLowerCase()})`).join(", ")}
              </p>
            )}
          </section>
          <section className="panel">
            <h3>Points on the day</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Player</th><th className="r">G</th><th className="r">A</th><th className="r">OG</th>
                    {v2 && (
                      <>
                        <th className="r" title="Winning team (+3)">Win</th>
                        <th className="r" title="Man of the Match (+4)">MOTM</th>
                        <th className="r" title="Fair play (+1)">FP</th>
                        <th className="r" title="Missed rotation (−2)">Rot</th>
                      </>
                    )}
                    <th className="r">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((l) => (
                    <tr key={l.playerId}>
                      <td><Name id={l.playerId} /></td>
                      <td className="r">{l.goals}</td>
                      <td className="r">{l.assists + (rules.secondAssistEnabled ? l.secondAssists : 0)}</td>
                      <td className="r">{l.ownGoals}</td>
                      {v2 && (
                        <>
                          <td className="r">{l.wins ? "🏆" : ""}</td>
                          <td className="r">{l.motm ? "★" : ""}</td>
                          <td className="r">{l.fairPlay ? "✓" : "–"}</td>
                          <td className="r">{l.rotationMissed ? <span className="neg">−2</span> : "✓"}</td>
                        </>
                      )}
                      <td className="r pts"><Points v={l.points} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {sels.length > 0 && (
        <section className="panel">
          <h3>Pick 7 results</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Selector</th><th className="r">Hits</th><th className="hide-sm">Their seven</th><th className="r">Pts</th></tr></thead>
              <tbody>
                {sels.map((r) => (
                  <tr key={r.selectorId}>
                    <td>{selectorName(state, r.selectorId)}</td>
                    <td className="r">{r.hits}/{r.picks.length}</td>
                    <td className="small hide-sm">{r.perPick.map((p) => `${playerName(p.playerId)}${p.played ? "" : " (DNP)"}`).join(", ")}</td>
                    <td className="r pts">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section className="panel stack">
          <h3>Scorecard history</h3>
          <ul className="small" style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {history.map((h) => (
              <li key={h.id}>
                {new Date(h.at).toLocaleString("en-CA", { timeZone: "America/Toronto" })} —{" "}
                {h.action === "scorecard.create" ? "scorecard published" : `corrected: “${h.reason}”`}
              </li>
            ))}
          </ul>
          {deadline && (
            <p className="small muted">
              Corrections {deadline.getTime() > Date.now() ? "allowed until" : "closed on"}{" "}
              {deadline.toLocaleDateString("en-CA", { timeZone: "America/Toronto" })}.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
