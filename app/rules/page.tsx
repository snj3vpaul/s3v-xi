import type { Metadata } from "next";
import { CLUB } from "@/config/club";
import { POINTS } from "@/lib/scoring/rules";
import { getState } from "@/lib/server/store";
import { Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rules" };

export default async function RulesPage() {
  const { settings } = await getState();
  const rows: [string, string][] = [
    ["Goal (open play, header, penalty, free kick)", `+${POINTS.goal} to the scorer`],
    ["Assist", `+${POINTS.assist} to the assister`],
    ["Assisted goal", `Scorer +${POINTS.goal} and assister +${POINTS.assist}`],
    ["Solo goal", `Scorer +${POINTS.goal}; nobody gets assist points`],
    ["Header from a cross", "Normal goal + assist"],
    ["Penalty", `+${POINTS.goal}. No assist unless an admin records one (a pass before the foul). Winning the penalty isn't an assist.`],
    ["Direct free kick", `+${POINTS.goal}, never an assist`],
    ["Own goal", `${POINTS.ownGoal} to the player who scored it. Not a goal in anyone's stats (it still counts on the scoreboard). Assists on own goals earn nothing.`],
    [
      "Deflected shot",
      `Admin rules it an own goal (${POINTS.ownGoal} to the deflecting player; the shooter gets nothing) or the shooter's goal (+${POINTS.goal}, plus any assist). Current default: ${settings.deflectionDefault === "own_goal" ? "own goal" : "shooter's goal"}.`,
    ],
    [
      "Second assist (pre-assist)",
      settings.secondAssistEnabled ? `ON this season: +${POINTS.secondAssist}` : `OFF this season (would be +${POINTS.secondAssist})`,
    ],
    ["Scored and assisted in one match", "Both count — points stack"],
    ["Drop-ins", `Identical points; shown with a drop-in badge.${settings.excludeDropInsFromAwards ? " Excluded from season awards this season." : ""}`],
    ["Negative totals", "Allowed. Nothing floors at zero."],
  ];
  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <Kicker label="The rulebook" no="Rules" />
        <h1>Only the <em>scoresheet</em> counts.</h1>
        <p className="lede">No ratings, no man-of-the-match votes. Points come from the match scorecard and nothing else.</p>
      </header>

      <section className="panel">
        <h2>Points</h2>
        <div className="table-wrap" style={{ marginTop: "0.75rem" }}>
          <table>
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <td style={{ fontWeight: 600, width: "38%" }}>{k}</td>
                  <td className="muted">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
          <p className="muted">
            Before the draw, pick {CLUB.picksPerSelector} different players (yourself included, drop-ins included). You score exactly the
            points they score that match day, whichever team they&apos;re drawn on. A pick who doesn&apos;t play scores 0. A
            “hit” is a pick who scores or assists — that&apos;s your accuracy.
          </p>
        </section>
      </div>
    </main>
  );
}
