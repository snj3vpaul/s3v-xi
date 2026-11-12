import Link from "next/link";
import { redirect } from "next/navigation";
import { ExactCelebration } from "@/components/league/Confetti";
import { CountUp } from "@/components/league/CountUp";
import { LeaderboardView } from "@/components/league/LeaderboardView";
import { LeagueFooter, LeagueHeader } from "@/components/league/LeagueHeader";
import { LocalTime } from "@/components/league/LocalTime";
import { getDb } from "@/lib/league/db";
import { exactHitsFor, getLeaderboard, getRoundView, getSettings, listRounds } from "@/lib/league/service";
import { currentUser } from "@/lib/league/session";

export const dynamic = "force-dynamic";

function greeting() {
  const h = new Date().getUTCHours();
  return h < 10 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
}

export default async function LeagueHome({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/league/login");
  const db = await getDb();
  const [settings, rounds, board, hits, { welcome }] = await Promise.all([getSettings(db), listRounds(db), getLeaderboard(db), exactHitsFor(db, user.id), searchParams]);
  const me = board.rows.find((r) => r.id === user.id);
  const openRound = rounds.find((r) => r.picksOpen > 0);
  const openView = openRound ? await getRoundView(db, openRound.id, user) : null;
  const openFixtures = openView?.fixtures.filter((f) => !f.locked) ?? [];
  const myOpenPicks = openFixtures.filter((f) => f.myPick).length;
  const recent = [...rounds].reverse().filter((r) => r.fixtureCount > 0);

  return (
    <>
      <LeagueHeader user={user} leagueName={settings.name} demo={settings.demo} active="home">
        <h1>{welcome ? `Welcome aboard, ${user.name}!` : `${greeting()}, ${user.name}`}</h1>
        <p>{welcome ? "You're in. Make your first picks below and start climbing the table." : "Who's having a shocker this week? Make your calls and find out."}</p>
      </LeagueHeader>
      <main className="lg-main lg-wrap" style={{ paddingTop: 0 }}>
        <section className="lg-card lg-me-card" aria-label="Your season">
          <div className="lg-me-avatar" aria-hidden="true">{user.avatar}</div>
          <div style={{ minWidth: 0 }}>
            <h2>{user.name}</h2>
            {me && me.achievements.length > 0
              ? <div className="lg-badges" style={{ marginTop: 6 }}>{me.achievements.map((a) => <span key={a.id} className="lg-badge" title={a.detail}>{a.emoji} {a.title}</span>)}</div>
              : <p className="lg-small lg-muted" style={{ marginTop: 4 }}>No titles yet. Nail an exact score to become the Score Oracle 🔮</p>}
            <div style={{ marginTop: 10 }}><ExactCelebration hits={hits} userId={user.id} /></div>
          </div>
          <div className="lg-me-stats">
            <div className="lg-stat"><b className="num">{me?.played ? (me.tied ? `=${me.rank}` : me.rank) : "–"}</b><span>Rank</span></div>
            <div className="lg-stat"><b className="num"><CountUp value={me?.total ?? 0} /></b><span>Points</span></div>
            <div className="lg-stat"><b className="num">{me?.exact ?? 0}</b><span>Exact</span></div>
          </div>
        </section>

        <section className="lg-section" aria-labelledby="next-up">
          {openRound && openView ? (
            <div className="lg-card lg-next">
              <div>
                <span className="lg-pill open">Picks open</span>
                <h3 id="next-up">{openRound.name}</h3>
                <p className="lg-muted">
                  You&apos;ve picked {myOpenPicks} of {openFixtures.length} open {openFixtures.length === 1 ? "match" : "matches"}.
                  {openRound.nextDeadline && <> Next lock <LocalTime iso={openRound.nextDeadline} mode="relative" />.</>}
                </p>
                <div className="lg-progress" aria-hidden="true"><i style={{ width: `${openFixtures.length ? (myOpenPicks / openFixtures.length) * 100 : 0}%` }} /></div>
              </div>
              <Link href={`/league/rounds/${openRound.id}`} className="lg-btn">{myOpenPicks === openFixtures.length ? "Review my picks" : "Make my picks"}</Link>
            </div>
          ) : (
            <div className="lg-card lg-empty">
              <div className="big">😴</div>
              <h3 id="next-up">No picks open right now</h3>
              <p className="lg-muted">{user.role === "admin" ? "Set up the next round in Admin and the group chat will light up." : "The admin hasn't opened the next round yet. Time to rest that crystal ball."}</p>
              {user.role === "admin" && <Link href="/league/admin" className="lg-btn" style={{ marginTop: 14 }}>Set up a round</Link>}
            </div>
          )}
        </section>

        <div className="lg-grid2 lg-section" style={{ alignItems: "start" }}>
          <section aria-labelledby="top-table">
            <div className="lg-section-head"><h2 id="top-table">Top of the table</h2><Link href="/league/leaderboard">Full table</Link></div>
            <LeaderboardView board={board} meId={user.id} compact />
          </section>
          <section aria-labelledby="rounds">
            <div className="lg-section-head"><h2 id="rounds">Rounds</h2></div>
            {recent.length ? (
              <div className="lg-roundlist">
                {recent.map((r) => {
                  const pts = me?.perRound[r.id];
                  return (
                    <Link key={r.id} href={`/league/rounds/${r.id}`} className="lg-card lg-roundlink">
                      <div>
                        <h3>{r.name}</h3>
                        <p className="lg-small lg-muted">{r.firstKickoff && <LocalTime iso={r.firstKickoff} />}</p>
                      </div>
                      <span className={`lg-pill ${r.status} lg-hide-sm`}>{r.status === "open" ? "Open" : r.status === "locked" ? "Locked" : "Scored"}</span>
                      <span className={`lg-chip${pts ? " outcome" : ""}`}>{pts !== undefined ? `+${pts}` : r.status === "scored" ? "0" : "…"}</span>
                    </Link>
                  );
                })}
              </div>
            ) : <div className="lg-card lg-empty"><div className="big">🗓️</div><h3>No rounds yet</h3><p className="lg-muted">Fixtures will appear here once the admin adds them.</p></div>}
          </section>
        </div>
      </main>
      <LeagueFooter />
    </>
  );
}
