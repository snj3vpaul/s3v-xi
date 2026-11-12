import { LeagueFooter, LeagueHeader } from "@/components/league/LeagueHeader";
import { getDb } from "@/lib/league/db";
import { LEAGUE_LIMITS, SCORING_RULES } from "@/lib/league/config";
import { getSettings } from "@/lib/league/service";
import { currentUser } from "@/lib/league/session";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const user = await currentUser();
  const settings = await getSettings(await getDb());
  return (
    <>
      <LeagueHeader user={user} leagueName={settings.name} demo={settings.demo} active="rules">
        <h1>How scoring works</h1>
        <p>Predict the exact final score of every fixture before it locks. Simple to play, painful to get wrong.</p>
      </LeagueHeader>
      <main className="lg-main lg-wrap">
        <div className="lg-rules">
          <div className="lg-card lg-rule"><span className="lg-chip exact">+{SCORING_RULES.exact}</span><h3>Exact score</h3><p>You said 2–1, it finished 2–1. Cue the confetti.</p></div>
          <div className="lg-card lg-rule"><span className="lg-chip outcome">+{SCORING_RULES.outcome}</span><h3>Right result</h3><p>You called the winner (or the draw) but not the exact score. You said 3–0, it ended 1–0.</p></div>
          <div className="lg-card lg-rule"><span className="lg-chip miss">+{SCORING_RULES.miss}</span><h3>Wrong result</h3><p>You backed the home side, the away side won. It happens to the best pundits.</p></div>
        </div>

        <section className="lg-section lg-card lg-stack">
          <h2 style={{ fontSize: 30 }}>The fine print</h2>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.75 }}>
            <li>Picks lock at kick-off{LEAGUE_LIMITS.lockMinutesBeforeKickoff ? ` minus ${LEAGUE_LIMITS.lockMinutesBeforeKickoff} minutes` : ""}, unless the admin sets an earlier deadline. The server&apos;s clock decides, not your phone&apos;s.</li>
            <li>You can change a pick as often as you like before it locks. Nobody can see anyone else&apos;s picks until then.</li>
            <li>Once a match locks, everyone&apos;s picks are revealed so you can see who was brave and who was wrong.</li>
            <li>Points update the moment the admin enters a result. Corrections rescore automatically.</li>
            <li>Players level on points share a rank. Arrows show movement since the previous round.</li>
            <li>Kick-off times are shown in your own timezone.</li>
          </ul>
          <h3 style={{ fontSize: 24, marginTop: 8 }}>Titles you can earn</h3>
          <div className="lg-badges">
            <span className="lg-badge">🔮 Score Oracle: most exact scores</span>
            <span className="lg-badge">📈 Consistent: longest run of scoring picks (3+)</span>
            <span className="lg-badge">🤝 Draw Whisperer: most draws called (2+)</span>
            <span className="lg-badge">🌞 Optimist: most bold calls that didn&apos;t land</span>
          </div>
        </section>

        <section className="lg-section lg-card lg-fun">
          <h3>Just for fun, between friends</h3>
          <p>This league runs on opinions and banter, nothing else.</p>
          <ul>
            <li>No money, deposits, entry fees, wagers or stakes of any kind.</li>
            <li>No odds, no bookmakers, no betting links or ads. Ever.</li>
            <li>Points are virtual, can&apos;t be bought or exchanged, and are worth precisely nothing outside the group chat.</li>
          </ul>
        </section>
      </main>
      <LeagueFooter />
    </>
  );
}
