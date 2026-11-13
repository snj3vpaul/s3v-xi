import type { Metadata } from "next";
import Link from "next/link";
import { CLUB, FORMATION, PICK7, PICKABLE, playerName } from "@/config/club";
import { SERIES, TEAM_NAMES } from "@/config/schedule";
import { fmtDate, selectorName, upcoming } from "@/lib/league/derive";
import { currentCaptain, currentSquad, lockedSelections, nextDeadlineMatch, rulesFrom } from "@/lib/league/ledger";
import { currentStars, fitToFormation, isFormationValid, lastOwnership } from "@/lib/league/pick7";
import { buildPick7Table, selectorBreakdown } from "@/lib/league/pick7Table";
import { PointsBreakdown } from "@/components/PointsBreakdown";
import { Pick7Table } from "@/components/Pick7Table";
import { fmtKickoff } from "@/lib/league/schedule";
import { playedMatches, scoreSelection } from "@/lib/scoring/rules";
import { currentUser } from "@/lib/server/session";
import { getState } from "@/lib/server/store";
import { CalendarLinks } from "@/components/CalendarLinks";
import { Countdown, TeamPicker } from "@/components/TeamPicker";
import { Kicker, Points } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My Team" };

export default async function TeamPage() {
  const [state, me] = await Promise.all([getState(), currentUser()]);
  const now = new Date();
  const next = nextDeadlineMatch(state, now);
  const live = upcoming(state, now);
  // Kick-off has passed but the scorecard isn't in yet: this week's sevens are locked and revealed.
  const lockedNow = live && now.getTime() >= new Date(live.kickoffAt).getTime() ? live : null;
  const lockedSels = lockedNow ? lockedSelections(state, lockedNow, now) : [];
  const rules = rulesFrom(state.settings);
  const pick7 = buildPick7Table(state, rules);
  const rankedCount = pick7.filter((r) => r.rank !== null).length;
  const played = playedMatches(state.matchDays);
  const last = played.at(-1);
  const lastResults = last
    ? last.selections.map((s) => scoreSelection(s, last, rules)).sort((a, b) => b.points - a.points || b.hits - a.hits)
    : [];
  const squad = me ? (currentSquad(me) ?? []) : [];
  const legacy = squad.length > 0 && !isFormationValid(squad);
  const stars = currentStars(state.matchDays);
  const ownership = lastOwnership(state.matchDays);
  const myRow = me ? pick7.find((r) => r.id === me.id && r.rank !== null) : undefined;
  const myBreakdown = me ? selectorBreakdown(state, rules, me.id) : null;
  const deadlineLabel = next ? fmtKickoff(next.kickoffAt, SERIES.timeZone) : null;
  const myLocked = me && lockedNow ? lockedSels.find((s) => s.selectorId === me.id) : undefined;

  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <Kicker label="Pick 7" no="My Team" />
        <h1>
          Back your <em>seven.</em>
        </h1>
        <p className="lede">
          Every Thursday at 10 pm it&apos;s {TEAM_NAMES.A} vs {TEAM_NAMES.B}. Pick {CLUB.picksPerSelector} of the {PICKABLE.length} before kick-off and
          bank every point they score — whichever side the hat puts them on. Your seven needs {FORMATION.DEF} defenders, {FORMATION.CM} CMs,{" "}
          {FORMATION.CAM} CAM and {FORMATION.ATT} attackers, worth at most {PICK7.starBudget}★ in total. It carries over each week; change it
          whenever you like before the deadline.
        </p>
      </header>

      {!me ? (
        <section className="panel stack" style={{ maxWidth: 640 }}>
          <h2>Play Pick 7</h2>
          <p className="muted" style={{ margin: 0 }}>Create a free account (email + password) to pick your seven and get a reminder before every deadline.</p>
          <div className="row">
            <Link className="btn btn-primary" href="/join">Create account</Link>
            <Link className="btn" href="/login">Log in</Link>
          </div>
        </section>
      ) : (
        <>
          {myLocked && lockedNow && (
            <section className="panel stack" style={{ borderColor: "var(--accent)" }}>
              <div className="row spread">
                <h3>Locked for {fmtDate(lockedNow.date)}</h3>
                <span className="badge badge-kit">Locked at kick-off</span>
              </div>
              <p style={{ margin: 0 }}>{myLocked.picks.map((id) => (id === myLocked.captain ? `${playerName(id)} (C)` : playerName(id))).join(", ")}</p>
            </section>
          )}

          <section className="panel stack">
            <div className="row spread" style={{ alignItems: "flex-start" }}>
              <div>
                <div className="kicker" style={{ marginBottom: "0.3rem" }}><b>Next deadline</b></div>
                <h2>{next ? `${TEAM_NAMES.A} vs ${TEAM_NAMES.B}` : "No fixture scheduled"}</h2>
                {next && <div className="muted">{deadlineLabel} · Pick 7 locks at kick-off</div>}
              </div>
              {next && (
                <div style={{ textAlign: "right" }}>
                  <div className="small muted">Time left</div>
                  <Countdown to={next.kickoffAt} />
                </div>
              )}
            </div>
            {!squad.length && <div className="alert alert-warn">You haven&apos;t picked a team yet — choose {CLUB.picksPerSelector} players below.</div>}
            {!legacy && squad.length > 0 && me && !currentCaptain(me) && (
              <div className="alert alert-warn">
                New: choose a captain. Tap <b>C</b> on one of your seven and save. Their points count double. Until you do, your seven still
                plays, just without a captain.
              </div>
            )}
            {legacy && (
              <div className="alert alert-warn">
                New formation: your old seven doesn&apos;t fit it. We&apos;ve kept the players who do; fill the empty seats and save before the
                deadline, or your team won&apos;t be entered this week.
              </div>
            )}
            <TeamPicker initial={legacy ? fitToFormation(squad) : squad} saved={squad} savedCaptain={me ? currentCaptain(me) : null} stars={stars} ownership={ownership} deadlineLabel={deadlineLabel} />
            {lockedNow && !next && <p className="small muted">This week is locked. Changes you make now count from next week.</p>}
          </section>

          <div className="grid grid-2" style={{ alignItems: "start" }}>
            <section className="panel stack">
              <h3>My season</h3>
              {myRow ? (
                <div className="grid grid-3" style={{ gap: "0.5rem" }}>
                  <div className="stat-tile"><div className="v num">{myRow.rank}{myRow.sharedRank ? "=" : ""}</div><div className="l">of {rankedCount} selectors</div></div>
                  <div className="stat-tile"><div className="v num">{myRow.points}</div><div className="l">points</div></div>
                  <div className="stat-tile"><div className="v num">{myRow.totalPicks ? Math.round((myRow.hits / myRow.totalPicks) * 100) : 0}%</div><div className="l">hit rate</div></div>
                </div>
              ) : (
                <p className="muted" style={{ margin: 0 }}>Pick your seven to join the table on 0 points.</p>
              )}
              {myBreakdown && myBreakdown.rounds.length > 0 && <PointsBreakdown data={myBreakdown} />}
            </section>
            <section className="panel stack">
              <h3>Never miss a Thursday</h3>
              <p className="small muted" style={{ margin: 0 }}>
                {me.emailReminders ? "You'll get a reminder email on Wednesday evening and Thursday midday." : "Reminder emails are off."}{" "}
                <Link href="/account">Change</Link>. Add the fixtures to your calendar too:
              </p>
              <CalendarLinks />
            </section>
          </div>
        </>
      )}

      <section className="panel stack" id="pick7-table">
        <div className="panel-head">
          <h2>Pick 7 table</h2>
          <Link href="/table#pick7">Full table</Link>
        </div>
        <Pick7Table initial={pick7} meId={me?.id ?? null} />
      </section>

      {lockedNow && lockedSels.length > 0 && (
        <section className="panel stack">
          <div className="panel-head">
            <h2>{fmtDate(lockedNow.date)} — picks revealed</h2>
            <Link href={`/matches/${lockedNow.id}`}>See the teams</Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Selector</th><th>Their seven</th></tr></thead>
              <tbody>
                {lockedSels.map((s) => (
                  <tr key={s.selectorId}>
                    <td>{selectorName(state, s.selectorId)}</td>
                    <td className="small">{s.picks.map((id) => (id === s.captain ? `${playerName(id)} (C)` : playerName(id))).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                <thead><tr><th>Selector</th><th className="r">Hits</th><th className="hide-sm">Picks (points)</th><th className="r">Pts</th></tr></thead>
                <tbody>
                  {lastResults.map((r) => (
                    <tr key={r.selectorId}>
                      <td>{selectorName(state, r.selectorId)}</td>
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
            <p className="muted">No picks were locked for that match day.</p>
          )}
        </section>
      )}
    </main>
  );
}
