import type { Metadata } from "next";
import Link from "next/link";
import { playerName } from "@/config/club";
import { rulesFrom } from "@/lib/league/ledger";
import { selectorBreakdown } from "@/lib/league/pick7Table";
import { EXAMPLE_SELECTORS, randomSimSeed, simulateSeason } from "@/lib/league/simulate";
import {
  FAIR_PLAY_LABEL,
  POINTS,
  POINT_KIND_LABEL,
  ROTATION_LABEL,
  matchItems,
  scoreMatch,
  scoreline,
  winnerOf,
} from "@/lib/scoring/rules";
import { EventLine } from "@/components/EventLine";
import { PointsBreakdown } from "@/components/PointsBreakdown";
import { TeamsView } from "@/components/TeamsView";
import { Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sample Thursday" };

const TEAM = { A: "White", B: "Red" } as const;
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/**
 * A made-up Thursday, run through the real team sheet, scorecard and scoring code,
 * so the club can see exactly how points work before the first real match.
 */
export default async function SimulatePage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const seed = (s ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 12) || randomSimSeed();
  const { state, selectors } = simulateSeason(seed, 1, { showcase: true });
  const rules = rulesFrom(state.settings);
  const m = state.matchDays[0];
  const d = m.draw!;
  const score = scoreline(m.events);
  const win = winnerOf(m);
  const items = matchItems(m, rules);
  const lines = [...scoreMatch(m, rules).values()].sort(
    (a, b) => b.points - a.points || playerName(a.playerId).localeCompare(playerName(b.playerId)),
  );
  const winners = win ? (win === "A" ? d.teamA : d.teamB) : [];

  // Two example Pick 7 entries: tonight's best and worst.
  const entries = selectors
    .map((id, i) => ({ name: EXAMPLE_SELECTORS[i], b: selectorBreakdown(state, rules, id) }))
    .filter((x) => x.b.rounds.length)
    .sort((a, b) => b.b.total - a.b.total);
  const shown = entries.length > 1 ? [entries[0], entries[entries.length - 1]] : entries;

  const og = m.events.filter((e) => e.kind === "own_goal");
  const pens = m.events.filter((e) => e.kind === "penalty" || e.kind === "free_kick");

  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <Kicker label="Simulation" no={`#${seed}`} />
        <h1>A sample <em>Thursday.</em></h1>
        <p className="lede">
          A made-up White vs Red, run through the real scoring. Nothing here is saved or counts. It just shows how a night turns into points.
        </p>
        <div className="row">
          <Link className="btn btn-primary" href={`/simulate?s=${randomSimSeed()}`}>Simulate another Thursday</Link>
          <Link className="btn" href={`/stats?example=${seed}`}>See an example season</Link>
          <Link href="/rules">Full rules</Link>
        </div>
      </header>

      <section className="stack">
        <h2>1 · The team sheet</h2>
        <p className="muted" style={{ margin: 0 }}>
          {m.attendees.length} turned up: {d.teamA.length} for White, {d.teamB.length} for Red. (In real life the captains pick the sides on
          WhatsApp; here they&apos;re split at random.)
        </p>
        <TeamsView draw={d} score={score} />
      </section>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <section className="panel stack">
          <h2>2 · The scoresheet</h2>
          {m.events.length ? (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {m.events.map((e) => <EventLine key={e.id} e={e} rules={rules} version={2} />)}
            </ul>
          ) : (
            <p className="muted">0–0.</p>
          )}
          <p className="small" style={{ margin: 0 }}>
            <b>Man of the Match:</b> {playerName(m.motm!.A!)} (White) · {playerName(m.motm!.B!)} (Red)
          </p>
          {(m.fairPlayLost?.length ?? 0) > 0 && (
            <p className="small muted" style={{ margin: 0 }}>
              <b>Lost fair play:</b> {m.fairPlayLost!.map((f) => `${playerName(f.playerId)} (${FAIR_PLAY_LABEL[f.reason].short.toLowerCase()})`).join(", ")}
            </p>
          )}
          {(m.rotationMissed?.length ?? 0) > 0 && (
            <p className="small muted" style={{ margin: 0 }}>
              <b>Missed rotation:</b> {m.rotationMissed!.map((r) => `${playerName(r.playerId)} (${ROTATION_LABEL[r.reason].toLowerCase()})`).join(", ")}
            </p>
          )}
        </section>

        <section className="panel stack">
          <h2>3 · What each rule did tonight</h2>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }} className="sim-rules">
            <li>
              <b>Result:</b>{" "}
              {win
                ? `${TEAM[win]} won ${Math.max(score.A, score.B)}–${Math.min(score.A, score.B)}, so all ${winners.length} ${TEAM[win]} players get 🏆 +${POINTS.win}.`
                : "A draw, so nobody gets the win bonus."}
            </li>
            <li>
              <b>Goals and assists:</b> every goal is ⚽ +{POINTS.goal} for the scorer and 🅰️ +{POINTS.assist} for the assister, if there was one.
            </li>
            {pens.length > 0 && (
              <li>
                <b>Penalties and free kicks</b> ({pens.map((e) => playerName(e.scorerId)).join(", ")}): the goal counts, but there&apos;s never an assist.
              </li>
            )}
            {og.length > 0 && (
              <li>
                <b>Own goal{og.length > 1 ? "s" : ""}</b> ({og.map((e) => playerName(e.scorerId)).join(", ")}): 🙈 {POINTS.ownGoal} to the player, and the goal
                still counts for the other team.
              </li>
            )}
            <li>
              <b>Man of the Match:</b> ⭐ +{POINTS.motm} to {playerName(m.motm!.A!)} and {playerName(m.motm!.B!)}, one per team.
            </li>
            <li>
              <b>Fair play:</b> 🤝 +{POINTS.fairPlay} to everyone who played
              {(m.fairPlayLost?.length ?? 0) > 0 ? `, except ${m.fairPlayLost!.map((f) => playerName(f.playerId)).join(" and ")}` : ""}.
            </li>
            <li>
              <b>Rotation:</b>{" "}
              {(m.rotationMissed?.length ?? 0) > 0
                ? `🔄 ${POINTS.rotationMiss} to ${m.rotationMissed!.map((r) => playerName(r.playerId)).join(" and ")}, and to everyone who picked them.`
                : "everyone did their goalkeeper and sub turns, so no penalties."}
            </li>
          </ul>
        </section>
      </div>

      <section className="panel stack">
        <h2>4 · Every player&apos;s points</h2>
        <p className="small muted" style={{ margin: 0 }}>Each chip is one reason. Hover or long-press for the detail.</p>
        <ul className="breakdown-list">
          {lines.map((l) => (
            <li key={l.playerId}>
              <span className="bd-name">{playerName(l.playerId)}</span>
              <span className="bd-items">
                {(items.get(l.playerId) ?? []).map((it, k) => (
                  <span key={k} className={`bd-chip${it.points < 0 ? " neg" : ""}`} title={it.detail}>
                    {POINT_KIND_LABEL[it.kind].icon} {signed(it.points)}
                    <span className="sr-only"> {it.detail}</span>
                  </span>
                ))}
              </span>
              <b className={`bd-total num${l.points < 0 ? " neg" : ""}`}>{l.points}</b>
            </li>
          ))}
        </ul>
      </section>

      <section className="stack">
        <h2>5 · What it means for Pick 7</h2>
        <p className="muted" style={{ margin: 0 }}>
          Each Pick 7 player banks exactly what their seven scored, with their captain (C) counting double. Here are tonight&apos;s best and
          worst of {entries.length} example teams.
          (Alex, Sam and the rest are made-up names.)
        </p>
        <div className="grid grid-2" style={{ alignItems: "start" }}>
          {shown.map((x, i) => (
            <div key={x.name} className="panel stack">
              <div className="row spread">
                <h3>{x.name}&apos;s seven</h3>
                <span className={`badge ${i === 0 ? "badge-kit" : "badge-muted"}`}>{i === 0 ? "Top score" : "Lowest score"}</span>
              </div>
              <PointsBreakdown data={x.b} example />
            </div>
          ))}
        </div>
      </section>

      <div className="row">
        <Link className="btn btn-primary" href={`/simulate?s=${randomSimSeed()}`}>Simulate another Thursday</Link>
        <Link className="btn" href={`/stats?example=${seed}`}>See an example season</Link>
      </div>
    </main>
  );
}
