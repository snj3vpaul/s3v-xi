import type { Metadata } from "next";
import Link from "next/link";
import { CLUB, FORMATION, PICK7, POSITIONS, POSITION_LABEL, PICKABLE } from "@/config/club";
import { FAIR_PLAY_BREACHES, FAIR_PLAY_LABEL, POINTS, POINTS_V1, RULES_V2_FROM } from "@/lib/scoring/rules";
import { SERIES, TEAM_NAMES } from "@/config/schedule";
import { fmtDate } from "@/lib/league/derive";
import { getState } from "@/lib/server/store";
import { Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rules" };

export default async function RulesPage() {
  const { settings } = await getState();
  const rows: [string, string, string][] = [
    ["Goal", `+${POINTS.goal}`, "Primary scorer only. Penalties and free kicks count the same."],
    ["Assist", `+${POINTS.assist}`, "The last pass before the goal. One per goal at most, and none on penalties or direct free kicks."],
    ["Own goal", `${POINTS.ownGoal}`, "To the player who put it in. If in doubt, it's the attacker's goal. There are no deflection rulings."],
    ["Man of the Match", `+${POINTS.motm}`, `Exactly one per team: one for ${TEAM_NAMES.A}, one for ${TEAM_NAMES.B}.`],
    [
      "Winning team",
      `+${POINTS.win}`,
      `Every player on the side that wins, subs included. The floater (odd numbers) gets +${POINTS.floaterWin} whenever there's a winner. A draw or an abandoned match: no bonus.`,
    ],
    ["Fair play", `+${POINTS.fairPlay}`, "Everyone who plays starts with it, and keeps it unless the scorekeeper records one of the breaches below."],
    ["Missed rotation", `${POINTS.rotationMiss}`, "Everyone takes a turn in goal and on the bench. Skip your goalkeeper or sub stint and you lose 2, and so does everyone who picked you."],
  ];
  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <Kicker label="The rulebook" no="Rules" />
        <h1>Seven numbers. <em>No black boxes.</em></h1>
        <p className="lede">
          Goals, assists, own goals, one Man of the Match per team, the winning side, fair play and rotation. Tap any score on the Pick 7 table to
          see exactly where it came from.
        </p>
        <div className="row">
          <Link className="btn btn-primary" href="/simulate">See a sample Thursday, scored</Link>
          <Link className="btn" href="/stats?example=demo">See an example season</Link>
        </div>
      </header>

      <section className="panel">
        <h2>Points</h2>
        <div className="table-wrap" style={{ marginTop: "0.75rem" }}>
          <table>
            <tbody>
              {rows.map(([k, pts, v]) => (
                <tr key={k}>
                  <td style={{ fontWeight: 600, width: "28%" }}>{k}</td>
                  <td className="num" style={{ width: "4rem" }}>{pts}</td>
                  <td className="muted">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 style={{ marginTop: "1.25rem" }}>Losing the fair-play point</h3>
        <p className="muted" style={{ margin: "0.25rem 0 0.5rem" }}>You keep it if none of these happened to you:</p>
        <ol style={{ margin: 0, paddingLeft: "1.2rem" }}>
          {FAIR_PLAY_BREACHES.map((b) => <li key={b}>{FAIR_PLAY_LABEL[b].long}.</li>)}
        </ol>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Drop-ins score the same.{settings.excludeDropInsFromAwards ? " They're excluded from season awards this season." : ""} Totals can go negative.
          Match days before {fmtDate(RULES_V2_FROM)} keep the original rules (goal +{POINTS_V1.goal}, assist +{POINTS_V1.assist}, own goal {POINTS_V1.ownGoal}),
          so old results don&apos;t change.
        </p>
      </section>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <section className="panel stack">
          <h2>Ties</h2>
          <ol style={{ margin: 0, paddingLeft: "1.2rem" }}>
            <li>More points</li>
            <li>More goals</li>
            <li>More assists</li>
            <li>Head-to-head: points earned in the match days both players played (for three or more, most head-to-head wins)</li>
            <li>Still level → shared rank (shown as “2=”, and the next rank is skipped)</li>
          </ol>
          <h2 style={{ marginTop: "1.5rem" }}>Corrections</h2>
          <p className="muted">
            Admins can correct a scorecard for {settings.correctionWindowDays} days after it&apos;s first published. Every correction needs
            a reason, keeps the previous version in the audit log, and recalculates the table, form, charts and pick-7 results.
          </p>
        </section>

        <section className="panel stack">
          <h2>The draw</h2>
          <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
            <li>Everyone who turns up plays. Sides are split as evenly as possible.</li>
            <li>
              Format = up to {settings.defaultConstraints.maxPerSide} a side on the pitch (16 → 8v8, 14 → 7v7, 12 → 6v6). Extra players are rolling subs for their team.
            </li>
            <li>Fewer than {CLUB.minPerSide * 2}? No draw — have a kickabout.</li>
            <li>
              <b>Odd numbers:</b> one floater plays the first half for one side and swaps at half-time. Floater duty goes to whoever
              has floated the fewest times this season (ties settled by the seeded shuffle), so it rotates fairly.
            </li>
            <li>Optional rules: split drop-ins evenly, never repeat last match day&apos;s exact teams, keep pairs together or apart.</li>
            <li>The draw uses a 256-bit crypto-random seed, published with the teams. Anyone can re-run it with “Verify draw”.</li>
          </ul>
          <h2 style={{ marginTop: "1.5rem" }}>Pick 7</h2>
          <ul className="muted" style={{ margin: 0, paddingLeft: "1.2rem" }}>
            <li>
              <b>Formation:</b> exactly {POSITIONS.map((p) => `${FORMATION[p]} ${FORMATION[p] === 1 ? POSITION_LABEL[p].one : POSITION_LABEL[p].many}`).join(", ")}, from the {PICKABLE.length} in the squad.
            </li>
            <li>
              <b>Star budget:</b> every player is rated 1–3★, and your seven can total at most {PICK7.starBudget}★. After each draw, anyone in
              more than {Math.round(PICK7.riseAbove * 100)}% of teams goes up a star and anyone in fewer than {Math.round(PICK7.fallBelow * 100)}% goes down one
              (once at least {PICK7.minTeamsToRerate} teams are in). If a re-rating puts your saved seven over budget, it stays legal; changes can only
              bring it down until it fits.
            </li>
            <li>
              <b>Deadline:</b> kick-off, Thursday 10 pm — or the moment the teams are drawn, if that&apos;s earlier. Your seven as it stood at
              the deadline is what counts. A seven that doesn&apos;t fit the formation isn&apos;t entered that week.
            </li>
            <li><b>Carry-over:</b> your seven rolls into every following week until you change it. Unlimited free changes before each deadline.</li>
            <li>You score exactly the points your seven earn that night, whichever team they&apos;re drawn on. A pick who doesn&apos;t play scores 0.</li>
            <li>A “hit” is a pick who scores or assists — that&apos;s your accuracy.</li>
          </ul>
          <h2 style={{ marginTop: "1.5rem" }}>Fixtures</h2>
          <p className="muted">
            Every Thursday at 10 pm (Toronto time), {TEAM_NAMES.A} vs {TEAM_NAMES.B}, until {fmtDate(SERIES.end)}. Bibs are drawn at random each week.
          </p>
        </section>
      </div>
    </main>
  );
}
