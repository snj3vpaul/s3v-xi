import { Fragment } from "react";
import Link from "next/link";
import { CLUB, MEMBERS, DROPINS } from "@/config/club";
import { deriveSeason, upcoming } from "@/lib/league/derive";
import { SERIES, TEAM_NAMES } from "@/config/schedule";
import { fmtKickoff } from "@/lib/league/schedule";
import { CalendarLinks } from "@/components/CalendarLinks";
import { getState } from "@/lib/server/store";
import { Name } from "@/components/ui";
import { FloodlitPitch } from "@/components/home/FloodlitPitch";
import { PitchDiagram } from "@/components/home/PitchDiagram";

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

export default async function Home() {
  const state = await getState();
  const { played, standings } = deriveSeason(state);
  const next = upcoming(state);
  const goals = standings.reduce((s, r) => s + r.goals, 0);
  const top3 = standings.filter((r) => r.played > 0).slice(0, 3);
  const squad = MEMBERS.length + DROPINS.length;

  return (
    <main className="home">
      <section className="hero-stage" aria-labelledby="hero-title">
        <FloodlitPitch />
        <div className="wrap hero-inner">
          <p className="eyebrow hero-in" style={{ ["--i" as string]: 0 }}>
            Free to play · Grassroots soccer · {CLUB.name}
          </p>
          <h1 id="hero-title" className="hero-title">
            <Words text="Your club." from={1} /> <em><Words text="Your seven." from={3} /></em>
          </h1>
          <p className="lede hero-in" style={{ ["--i" as string]: 5 }}>
            {CLUB.strapline} The hat splits whoever turns up into two teams, and the scoresheet does the rest. Before kick-off, back
            the seven you reckon will deliver.
          </p>
          <div className="hero-actions hero-in" style={{ ["--i" as string]: 6 }}>
            <Link className="btn btn-primary btn-lg" href="/team">Pick your {CLUB.picksPerSelector}</Link>
            <Link className="text-link" href="/rules">How scoring works <span aria-hidden="true">→</span></Link>
          </div>
          <p className="next-fixture hero-in" style={{ ["--i" as string]: 7 }}>
            <span className="dot" aria-hidden="true" />
            {next ? (
              <>
                Next: <b>{TEAM_NAMES.A} vs {TEAM_NAMES.B}</b> · {fmtKickoff(next.kickoffAt, SERIES.timeZone)} ·{" "}
                {next.status === "open" ? "Pick 7 open" : "teams drawn"}
              </>
            ) : (
              <>Next fixture to be confirmed</>
            )}
          </p>
        </div>
      </section>

      <div className="wrap">
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
      </div>

      <PitchDiagram />

      <div className="wrap stack-lg home-tail">
        <section className="fixture-band" data-reveal aria-labelledby="every-thursday">
          <div>
            <p className="kicker"><b>Every Thursday</b></p>
            <h2 id="every-thursday">
              {TEAM_NAMES.A} <em>vs</em> {TEAM_NAMES.B} · 10 pm
            </h2>
            <p className="muted" style={{ margin: "0.5rem 0 0" }}>
              Weekly until summer. Pick 7 locks at kick-off; reminders go out Wednesday evening and Thursday midday.
            </p>
          </div>
          <CalendarLinks />
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
