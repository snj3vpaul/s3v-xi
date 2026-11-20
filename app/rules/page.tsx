import type { Metadata } from "next";
import Link from "next/link";
import { CHIPS, FORMATION, PICK7, POSITIONS, POSITION_LABEL, PICKABLE } from "@/config/club";
import {
  CAPTAIN_MULTIPLIER,
  DEFENCE_BONUS,
  GOAL_BY_POSITION,
  GOAL_LABEL,
  FAIR_PLAY_BREACHES,
  FAIR_PLAY_LABEL,
  POINTS,
  POINTS_V1,
  RULES_V2_FROM,
  RULES_V3_FROM,
  TRIPLE_CAPTAIN_MULTIPLIER,
} from "@/lib/scoring/rules";

/** "0 → +4 · 1–2 → +2 · 3–4 → +1 · 5+ → 0" */
function bandText(bands: readonly (readonly [number, number])[]): string {
  let from = 0;
  const parts = bands.map(([max, pts]) => {
    const t = `${from === max ? max : `${from}–${max}`} conceded +${pts}`;
    from = max + 1;
    return t;
  });
  return `${parts.join(" · ")} · ${from}+ conceded 0`;
}
import { SERIES, TEAM_NAMES } from "@/config/schedule";
import { fmtDate } from "@/lib/league/derive";
import { getState } from "@/lib/server/store";
import { Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rules" };

export default async function RulesPage() {
  const { settings } = await getState();
  const rows: [string, string, string][] = [
    [
      "Goal",
      `+${GOAL_BY_POSITION.ATT} to +${GOAL_BY_POSITION.DEF}`,
      `By the scorer's Pick 7 position, like FPL: ${GOAL_LABEL}. Primary scorer only. Penalties and free kicks count the same.`,
    ],
    ["Assist", `+${POINTS.assist}`, "The last pass before the goal. One per goal at most, and none on penalties or direct free kicks."],
    ["Own goal", `${POINTS.ownGoal}`, "To the player who put it in. If in doubt, it's the attacker's goal. There are no deflection rulings."],
    ["Man of the Match", `+${POINTS.motm}`, `Exactly one per team: one for ${TEAM_NAMES.A}, one for ${TEAM_NAMES.B}.`],
    [
      "Winning team",
      `+${POINTS.win}`,
      "Every player on the side that wins, subs included. A draw or an abandoned match: no bonus.",
    ],
    ["Fair play", `+${POINTS.fairPlay}`, "Everyone who plays starts with it, and keeps it unless the scorekeeper records one of the breaches below."],
    ["Missed rotation", `${POINTS.rotationMiss}`, "Everyone takes a turn in goal and on the bench. Skip your goalkeeper or sub stint and you lose 2, and so does everyone who picked you."],
    ["Defensive bonus: defenders", `up to +${DEFENCE_BONUS.DEF![0][1]}`, `By the goals your side concedes: ${bandText(DEFENCE_BONUS.DEF!)}. Never a minus.`],
    ["Defensive bonus: CMs", `up to +${DEFENCE_BONUS.CM![0][1]}`, `By the goals your side concedes: ${bandText(DEFENCE_BONUS.CM!)}. Never a minus. CAMs and attackers don't get it.`],
  ];
  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <Kicker label="The rulebook" no="Rules" />
        <h1>Simple numbers. <em>No black boxes.</em></h1>
        <p className="lede">
          Goals, assists, own goals, one Man of the Match per team, the winning side, fair play, rotation and a defensive bonus. Tap any score on the Pick 7 table to
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
          so old results don&apos;t change. Goals by position and the defensive bonus start on {fmtDate(RULES_V3_FROM)} ({fmtDate(RULES_V2_FROM)} kept +{POINTS.goal} for every goal). Positions are the Pick 7 positions, whoever
          ends up in goal.
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
          <h2>The teams</h2>
          <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
            <li>The two captains pick {TEAM_NAMES.A} and {TEAM_NAMES.B} on WhatsApp.</li>
            <li>An admin posts the team sheet on the site, usually before kick-off. It can be changed until the scorecard is in.</li>
            <li>Everyone on the team sheet counts as playing, subs included. Anyone not on it scores 0 that week.</li>
            <li>At full time the admin enters the score, scorers, assists, Man of the Match and conduct, and every table updates.</li>
          </ul>
          <h2 style={{ marginTop: "1.5rem" }}>Pick 7</h2>
          <ul className="muted" style={{ margin: 0, paddingLeft: "1.2rem" }}>
            <li>
              <b>Formation:</b> exactly {POSITIONS.map((p) => `${FORMATION[p]} ${FORMATION[p] === 1 ? POSITION_LABEL[p].one : POSITION_LABEL[p].many}`).join(", ")}, from the {PICKABLE.length} in the squad.
            </li>
            <li>
              <b>Star budget:</b> every player is rated 1–3★, and your seven can total at most {PICK7.starBudget}★. After each week locks, anyone in
              more than {Math.round(PICK7.riseAbove * 100)}% of teams goes up a star and anyone in fewer than {Math.round(PICK7.fallBelow * 100)}% goes down one
              (once at least {PICK7.minTeamsToRerate} teams are in). If a re-rating puts your saved seven over budget, it stays legal; changes can only
              bring it down until it fits.
            </li>
            <li>
              <b>Deadline:</b> kick-off, Thursday 10 pm, even if the teams are posted earlier. Your seven as it stood at
              the deadline is what counts. A seven that doesn&apos;t fit the formation isn&apos;t entered that week.
            </li>
            <li>
              <b>Captain:</b> choose one of your seven as captain. Their points for the night count double, bonuses and penalties alike (a
              captain&apos;s goal is +{GOAL_BY_POSITION.ATT * CAPTAIN_MULTIPLIER} for an attacker or +{GOAL_BY_POSITION.DEF * CAPTAIN_MULTIPLIER} for a defender; a captain who skips their goalkeeper turn costs you {POINTS.rotationMiss * CAPTAIN_MULTIPLIER}).
            </li>
            <li>
              <b>Vice-captain (optional):</b> if your captain doesn&apos;t play, your vice-captain gets the armband and their points count double
              instead. If neither plays, nobody&apos;s points are doubled.
            </li>
            <li>
              <b>Bench (optional):</b> one extra player, any position, who isn&apos;t in your seven. They don&apos;t count toward the star budget. If any of
              your seven doesn&apos;t play, your bench player&apos;s points count instead (one sub per week, and they never take the armband).
            </li>
            <li>
              <b>Chips:</b> {CHIPS.triple_captain.label} (your captain&apos;s points count ×{TRIPLE_CAPTAIN_MULTIPLIER} instead of ×{CAPTAIN_MULTIPLIER}) and{" "}
              {CHIPS.bench_boost.label} (your bench player&apos;s points count even if all seven play). {CHIPS.triple_captain.perSeason} of each per
              season, one chip per week. Play it on My Team before kick-off; cancel any time before kick-off to get it back.
            </li>
            <li>
              <b>Out this week:</b> players can flag themselves out on My Team (an admin can flag anyone). The flag shows on the picker. It doesn&apos;t
              change points, but it&apos;s a good reason to pick someone else or rely on your bench.
            </li>
            <li><b>Carry-over:</b> your seven, captain, vice-captain and bench roll into every following week until you change them. Unlimited free changes before each deadline. Chips don&apos;t carry over.</li>
            <li>You score exactly the points your seven earn that night, whichever team they&apos;re on. A pick who doesn&apos;t play scores 0.</li>
            <li>A “hit” is a pick who scores or assists — that&apos;s your accuracy.</li>
          </ul>
          <h2 style={{ marginTop: "1.5rem" }}>Fixtures</h2>
          <p className="muted">
            Every Thursday at 10 pm (Toronto time), {TEAM_NAMES.A} vs {TEAM_NAMES.B}, until {fmtDate(SERIES.end)}. The captains pick the sides each week.
          </p>
        </section>
      </div>
    </main>
  );
}
