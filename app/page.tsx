import { Fragment } from "react";
import Link from "next/link";
import { CLUB, PICKABLE, ROSTER } from "@/config/club";
import { POINTS } from "@/lib/scoring/rules";
import { deriveSeason, upcoming } from "@/lib/league/derive";
import { SERIES, TEAM_NAMES } from "@/config/schedule";
import { fmtKickoff } from "@/lib/league/schedule";
import { CalendarLinks } from "@/components/CalendarLinks";
import { getState } from "@/lib/server/store";
import { Name } from "@/components/ui";
import { Mascot } from "@/components/Mascot";
import { OrbitStage, type OrbChapter } from "@/components/home/orbit/OrbitStage";

export const dynamic = "force-dynamic";

/** Headline words, each in its own mask so the line can rise in word by word (pure CSS, no JS needed). */
function Words({ text, from = 0 }: { text: string; from?: number }) {
  return text.split(" ").map((w, i) => (
    <Fragment key={i}>
      {i > 0 && " "}
      <span className="w">
        <span style={{ ["--i" as string]: from + i }}>{w}</span>
      </span>
    </Fragment>
  ));
}

const CHAPTERS: OrbChapter[] = [
  { no: "01", name: "The draw", tag: "White vs Red, at random", href: "/draw", kind: "draw" },
  { no: "02", name: "The scoresheet", tag: "Where every point comes from", href: "/rules", kind: "scoresheet" },
  { no: "03", name: "Your seven", tag: "Pick 7, FPL-style", href: "/team", kind: "seven" },
  { no: "04", name: "Thursday, 10\u00a0pm", tag: "Fixtures & results", href: "/matches", kind: "thursday" },
];

export default async function Home() {
  const state = await getState();
  const { played, standings } = deriveSeason(state);
  const next = upcoming(state);
  const goals = standings.reduce((s, r) => s + r.goals, 0);
  const top3 = standings.filter((r) => r.played > 0).slice(0, 3);
  const squad = PICKABLE.length;
  const nextLabel = next ? fmtKickoff(next.kickoffAt, SERIES.timeZone) : null;
  // Chapter 03's line-up: the season's top seven so far, or seven from the squad before a ball is kicked.
  const ranked = standings.filter((r) => r.played > 0).map((r) => r.playerId);
  const lineup = [...ranked, ...ROSTER.map((p) => p.id).filter((id) => !ranked.includes(id))].slice(0, CLUB.picksPerSelector);

  return (
    <main className="home">
      <section className="orbit theme-night" data-orbit aria-label="How RSFC League works">
        <OrbitStage chapters={CHAPTERS} label={`The Thursday series · ${CLUB.name}`} />

        <div className="orbit-track">
          <article className="chapter chapter-hero" aria-labelledby="hero-title">
            <div className="wrap">
              <div className="chapter-copy">
                <p className="eyebrow hero-in" style={{ ["--i" as string]: 0 }}>
                  Free to play · Grassroots soccer · {CLUB.name}
                </p>
                <h1 id="hero-title" className="hero-title">
                  <Words text="Your club." from={1} /> <em><Words text="Your seven." from={3} /></em>
                </h1>
                <p className="lede hero-in" style={{ ["--i" as string]: 5 }}>
                  {CLUB.strapline} The hat splits whoever turns up into two teams, and the scoresheet does the rest. Before
                  kick-off, back the seven you reckon will deliver.
                </p>
                <div className="hero-actions hero-in" style={{ ["--i" as string]: 6 }}>
                  <Link className="btn btn-primary btn-lg" href="/team">Pick your {CLUB.picksPerSelector}</Link>
                  <Link className="text-link" href="/rules">How scoring works <span aria-hidden="true">→</span></Link>
                </div>
                <p className="next-fixture hero-in" style={{ ["--i" as string]: 7 }}>
                  <span className="dot" aria-hidden="true" />
                  {next ? (
                    <>
                      Next: <b>{TEAM_NAMES.A} vs {TEAM_NAMES.B}</b> · {nextLabel} · {next.status === "open" ? "Pick 7 open" : "teams drawn"}
                    </>
                  ) : (
                    <>Next fixture to be confirmed</>
                  )}
                </p>
              </div>
            </div>
          </article>

          <article className="chapter" id="ch-1" aria-labelledby="ch-1-title">
            <div className="wrap">
              <div className="chapter-copy" data-reveal>
                <p className="kicker"><b>Chapter / 01</b></p>
                <h2 id="ch-1-title" className="chapter-title">
                  The draw <Link href="/draw" className="chapter-go" aria-label="See this week's draw">↗</Link>
                </h2>
                <p className="chapter-tag">{TEAM_NAMES.A} vs {TEAM_NAMES.B}, at random</p>
                <p className="chapter-body">
                  Nobody picks their mates. A seeded, crypto-random draw splits whoever of the {squad} turns up into two even sides, and
                  anyone can re-run the seed to check it.
                </p>
              </div>
            </div>
          </article>

          <article className="chapter" id="ch-2" aria-labelledby="ch-2-title">
            <div className="wrap">
              <div className="chapter-copy" data-reveal>
                <p className="kicker"><b>Chapter / 02</b></p>
                <h2 id="ch-2-title" className="chapter-title">
                  The scoresheet <Link href="/rules" className="chapter-go" aria-label="Read the scoring rules">↗</Link>
                </h2>
                <p className="chapter-tag">Where every point comes from</p>
                <dl className="chapter-points">
                  <div><dt>Goal</dt><dd className="num">+{POINTS.goal}</dd></div>
                  <div><dt>Assist</dt><dd className="num">+{POINTS.assist}</dd></div>
                  <div><dt>Own goal</dt><dd className="num neg">{POINTS.ownGoal}</dd></div>
                  <div><dt>MOTM</dt><dd className="num">+{POINTS.motm}</dd></div>
                  <div><dt>Win</dt><dd className="num">+{POINTS.win}</dd></div>
                  <div><dt>Fair play</dt><dd className="num">+{POINTS.fairPlay}</dd></div>
                  <div><dt>Skip GK/sub</dt><dd className="num neg">{POINTS.rotationMiss}</dd></div>
                </dl>
                <p className="chapter-body">Seven numbers. Easy to keep, hard to argue with.</p>
              </div>
            </div>
          </article>

          <article className="chapter" id="ch-3" aria-labelledby="ch-3-title">
            <div className="wrap">
              <div className="chapter-copy" data-reveal>
                <p className="kicker"><b>Chapter / 03</b></p>
                <h2 id="ch-3-title" className="chapter-title">
                  Your seven <Link href="/team" className="chapter-go" aria-label="Pick your seven">↗</Link>
                </h2>
                <p className="chapter-tag">Pick {CLUB.picksPerSelector}, FPL-style</p>
                <p className="chapter-body">
                  Back {CLUB.picksPerSelector} of the {squad} before kick-off: 2 defenders, 2 CMs, a CAM and 2 attackers, within a
                  star budget. Whichever side they land on, their points are yours, and your seven carries over until you change it.
                </p>
                <ul className="chapter-lineup" aria-label={ranked.length ? "Top seven so far" : "Seven from the squad"}>
                  {lineup.map((id) => (
                    <li key={id}>
                      <Mascot id={id} size={74} />
                      <Name id={id} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>

          <article className="chapter" id="ch-4" aria-labelledby="ch-4-title">
            <div className="wrap">
              <div className="chapter-copy" data-reveal>
                <p className="kicker"><b>Chapter / 04</b></p>
                <h2 id="ch-4-title" className="chapter-title">
                  Thursday, 10&nbsp;pm <Link href="/matches" className="chapter-go" aria-label="Fixtures and results">↗</Link>
                </h2>
                <p className="chapter-tag">{next ? <>Next: {nextLabel}</> : "Weekly until summer"}</p>
                <p className="chapter-body">
                  {TEAM_NAMES.A} vs {TEAM_NAMES.B}, weekly until summer. Pick 7 locks at kick-off; reminders go out Wednesday evening and
                  Thursday midday.
                </p>
                <CalendarLinks />
              </div>
            </div>
          </article>
        </div>
      </section>

      <div className="wrap stack-lg home-tail">
        <section className="scoreline" aria-label="Season so far" data-reveal-group>
          <div className="score-cell">
            <div className="v num" data-count={played.length}>{played.length}</div>
            <div className="l">Match days played</div>
          </div>
          <div className="score-cell">
            <div className="v num" data-count={goals}>{goals}</div>
            <div className="l">Goals on the scoresheet</div>
          </div>
          <div className="score-cell">
            <div className="v num" data-count={squad}>{squad}</div>
            <div className="l">Players in the hat</div>
          </div>
        </section>

        <section className="stack" aria-labelledby="the-table">
          <div className="row spread">
            <h2 id="the-table">The table</h2>
            {top3.length > 0 && (
              <div className="row">
                <Link className="text-link" href="/table">Full table <span aria-hidden="true">→</span></Link>
                <Link className="text-link" href="/stats">Season charts <span aria-hidden="true">→</span></Link>
              </div>
            )}
          </div>
          {top3.length ? (
            <ol className="podium-list" data-reveal-group>
              {top3.map((r) => (
                <li key={r.playerId}>
                  <span className="rank">{r.rank}</span>
                  <Mascot id={r.playerId} variant="head" size={44} />
                  <span className="who"><Name id={r.playerId} /></span>
                  <span className="pts num">{r.points}<small> pts</small></span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="panel muted" data-reveal>
              The table fills up after the first scorecard. Until then, everyone&apos;s level on zero. Enjoy it.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
