import type { Metadata } from "next";
import Link from "next/link";
import { playerName } from "@/config/club";
import { SERIES, TEAM_NAMES } from "@/config/schedule";
import { matchSummary } from "@/lib/league/derive";
import { fmtDate } from "@/lib/format";
import { fmtKickoff } from "@/lib/league/schedule";
import { getState } from "@/lib/server/store";
import type { LeagueState, MatchDay } from "@/lib/league/types";
import { MatchPitch, type PitchGoal } from "@/components/MatchPitch";
import { Empty, Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Matches" };

/** "Inder 3, Harpreet 2, Gurnaam" */
function scorerList(m: MatchDay, state: LeagueState): string {
  const { lines } = matchSummary(m, state);
  return [...lines.values()]
    .filter((l) => l.goals > 0)
    .sort((a, b) => b.goals - a.goals || playerName(a.playerId).localeCompare(playerName(b.playerId)))
    .map((l) => `${playerName(l.playerId)}${l.goals > 1 ? ` ${l.goals}` : ""}`)
    .join(", ");
}

function Cell({ m, state }: { m: MatchDay; state: LeagueState }) {
  const played = m.status === "played";
  const { score, format } = matchSummary(m, state);
  const goals: PitchGoal[] = m.events.map((e, i) => ({
    side: e.side,
    ownGoal: e.kind === "own_goal",
    title: `Goal ${i + 1}: ${playerName(e.scorerId)}${e.kind === "own_goal" ? " (own goal)" : ""}${e.minute ? `, ${e.minute}'` : ""}`,
  }));
  const out = m.unavailable?.length ?? 0;
  const scorers = played ? scorerList(m, state) : "";
  const result = played
    ? m.noResult
      ? "No result"
      : score.A === score.B
        ? "Draw"
        : `${score.A > score.B ? TEAM_NAMES.A : TEAM_NAMES.B} win`
    : m.draw
      ? "Teams posted"
      : "Upcoming";
  return (
    <Link href={`/matches/${m.id}`} className={`mcell${played ? "" : " is-upcoming"}`}>
      <div className="mcell-art">
        <MatchPitch goals={goals} score={played ? score : undefined} upcoming={!played} centre={played ? undefined : m.draw ? `${m.draw.teamA.length} v ${m.draw.teamB.length}` : "10 pm"} />
      </div>
      <div className="mcell-cap">
        <h3>
          <i className={`mcell-mark${played ? "" : " is-open"}`} aria-hidden="true" />
          {m.label || fmtDate(m.date)}
          <span className="mcell-status">{result}</span>
        </h3>
        {played ? (
          <p>
            {TEAM_NAMES.A} {score.A}–{score.B} {TEAM_NAMES.B}
            {format ? `, ${format}` : ""}. {scorers ? `Scorers: ${scorers}.` : "No goals."}
          </p>
        ) : (
          <p>
            Kick-off {fmtKickoff(m.kickoffAt, SERIES.timeZone).replace(/\.$/, "")}.{" "}
            {m.draw ? `${m.draw.teamA.length + m.draw.teamB.length} on the team sheet.` : "Team sheet not posted yet."}
            {out ? ` ${out} flagged out.` : ""}
          </p>
        )}
      </div>
    </Link>
  );
}

export default async function MatchesPage() {
  const state = await getState();
  const now = Date.now();
  const next = state.matchDays
    .filter((m) => m.status !== "played" && new Date(m.kickoffAt).getTime() > now - 6 * 3_600_000)
    .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))
    .slice(0, 3);
  const played = state.matchDays.filter((m) => m.status === "played").sort((a, b) => b.kickoffAt.localeCompare(a.kickoffAt));
  const goals = played.reduce((t, m) => t + m.events.length, 0);
  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <Kicker label="Results" no="Matches" />
        <h1>Every <em>match day.</em></h1>
        <p className="lede">
          {played.length
            ? `${played.length} played, ${goals} goals so far. Each pitch shows who scored at which end: ${TEAM_NAMES.A} attack the right-hand goal, ${TEAM_NAMES.B} the left.`
            : "Results appear here after each Thursday's scorecard is in."}
        </p>
      </header>
      {next.length === 0 && played.length === 0 ? (
        <Empty>No match days yet.</Empty>
      ) : (
        <>
          {next.length > 0 && (
            <section className="stack">
              <h2 className="mgrid-title">Coming up</h2>
              <div className="mgrid">{next.map((m) => <Cell key={m.id} m={m} state={state} />)}</div>
            </section>
          )}
          {played.length > 0 && (
            <section className="stack">
              <h2 className="mgrid-title">Played</h2>
              <div className="mgrid">{played.map((m) => <Cell key={m.id} m={m} state={state} />)}</div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
