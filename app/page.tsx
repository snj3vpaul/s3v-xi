import Link from "next/link";
import { CLUB, MEMBERS, DROPINS } from "@/config/club";
import { POINTS } from "@/lib/scoring/rules";
import { deriveSeason, fmtDate, upcoming } from "@/lib/league/derive";
import { getState } from "@/lib/server/store";
import { Kicker, Name } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  const state = await getState();
  const { played, standings } = deriveSeason(state);
  const next = upcoming(state);
  const goals = standings.reduce((s, r) => s + r.goals, 0);
  const top3 = standings.filter((r) => r.played > 0).slice(0, 3);

  return (
    <main className="wrap stack-lg">
      <section className="hero pitchlines">
        <div className="eyebrow rise">Free to play · Grassroots soccer · {CLUB.name}</div>
        <h1 className="rise rise-2">
          Your club. <em>Your seven.</em>
        </h1>
        <p className="lede rise rise-3">
          {CLUB.strapline} Every match day the hat splits whoever turns up into two teams. The scoresheet
          does the rest — goals, assists, and the odd own goal. Before kick-off, pick the seven teammates you
          reckon will deliver.
        </p>
        <div className="row rise rise-3">
          <Link className="btn btn-primary" href="/draw">This week&apos;s draw</Link>
          <Link className="btn" href="/pick">Pick your 7</Link>
          <Link className="btn" href="/rules">How scoring works</Link>
        </div>
      </section>

      <section className="grid grid-3">
        <div className="panel stat-tile">
          <div className="v num">{played.length}</div>
          <div className="l">Match days played</div>
        </div>
        <div className="panel stat-tile">
          <div className="v num">{goals}</div>
          <div className="l">Goals on the scoresheet</div>
        </div>
        <div className="panel stat-tile">
          <div className="v">{next ? fmtDate(next.date) : "TBC"}</div>
          <div className="l">
            Next match day{next ? ` · ${next.status === "open" ? "picks open" : "teams drawn"}` : ""}
          </div>
        </div>
      </section>

      <section className="stack">
        <Kicker label="The idea" no="001" />
        <div className="grid grid-3">
          <article className="panel feature">
            <div className="no">01</div>
            <h3>The Draw</h3>
            <p>
              Nobody picks their mates. A seeded, crypto-random draw splits the {MEMBERS.length} members and{" "}
              {DROPINS.length} drop-ins who turn up into two even sides — and anyone can re-run the seed to check it.
            </p>
          </article>
          <article className="panel feature">
            <div className="no">02</div>
            <h3>The Scoresheet</h3>
            <p>
              Points come from one place only: the match scorecard. Goal +{POINTS.goal}. Assist +{POINTS.assist}. Own goal{" "}
              {POINTS.ownGoal}. That&apos;s it. No ratings, no opinions, no arguments (well, fewer).
            </p>
          </article>
          <article className="panel feature">
            <div className="no">03</div>
            <h3>Your Seven</h3>
            <p>
              Before the draw, pick {CLUB.picksPerSelector} players you back to get on the scoresheet. Whatever side they
              land on, their points become yours. Prediction, not drafting.
            </p>
          </article>
        </div>
      </section>

      <section className="stack">
        <Kicker label="The table" no="002" />
        {top3.length ? (
          <div className="panel">
            <ol className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {top3.map((r) => (
                <li key={r.playerId} className="row spread">
                  <span className="row">
                    <span className="rank">{r.rank}</span>
                    <Name id={r.playerId} />
                  </span>
                  <span className="pts num">{r.points}</span>
                </li>
              ))}
            </ol>
            <div className="row" style={{ marginTop: "1rem" }}>
              <Link className="btn btn-sm" href="/table">Full table</Link>
              <Link className="btn btn-sm" href="/stats">Season charts</Link>
            </div>
          </div>
        ) : (
          <div className="panel muted">
            The table fills up after the first scorecard. Until then, everyone&apos;s level on zero — enjoy it.
          </div>
        )}
      </section>
    </main>
  );
}
