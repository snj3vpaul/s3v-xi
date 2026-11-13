import type { Metadata } from "next";
import { ROSTER, isDropIn, playerName } from "@/config/club";
import { deriveSeason, selectorName, shortDate } from "@/lib/league/derive";
import { getState } from "@/lib/server/store";
import { ChartFrame, Swatch } from "@/components/charts/ChartFrame";
import { ContributionMatrix, MatrixLegend } from "@/components/charts/ContributionMatrix";
import { GoalInvolvement } from "@/components/charts/GoalInvolvement";
import { SeasonRace } from "@/components/charts/SeasonRace";
import { SelectorGauge } from "@/components/charts/SelectorGauge";
import { Sparkline } from "@/components/charts/Sparkline";
import { Empty, Kicker, Name } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Season charts" };

export default async function StatsPage() {
  const state = await getState();
  const { played, standings, selectors } = deriveSeason(state);

  if (played.length === 0)
    return (
      <main className="wrap stack-lg">
        <header className="stack">
          <Kicker label="The numbers" no="Stats" />
          <h1>Season <em>charts.</em></h1>
        </header>
        <Empty>Charts appear after the first scorecard is in.</Empty>
      </main>
    );

  const labels = played.map((m) => shortDate(m.date));
  const active = standings.filter((r) => r.played > 0);
  const rosterOrder = new Map(ROSTER.map((p, i) => [p.id, i]));
  const race = active
    .map((r) => {
      let run = 0;
      return {
        id: r.playerId,
        name: playerName(r.playerId),
        dropin: isDropIn(r.playerId),
        cumulative: played.map((m) => (run += r.perMatch[m.id] ?? 0)),
      };
    })
    .sort((a, b) => (rosterOrder.get(a.id) ?? 99) - (rosterOrder.get(b.id) ?? 99));
  const involvement = active.map((r) => ({
    id: r.playerId,
    name: playerName(r.playerId),
    goals: r.goals,
    assists: r.assists,
    dropin: isDropIn(r.playerId),
  }));
  const through = `Season to date · ${played.length} match day${played.length === 1 ? "" : "s"} through ${labels.at(-1)}`;

  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <Kicker label="The numbers" no="Stats" />
        <h1>Season <em>charts.</em></h1>
        <p className="lede">{through}. Hover or tap any mark for exact values; every chart has a table view.</p>
      </header>

      <ChartFrame
        title="The season race"
        units="Cumulative points after each match day · highlight up to five players"
        table={
          <table>
            <thead><tr><th>Player</th>{labels.map((l, i) => <th key={i} className="r">{l}</th>)}</tr></thead>
            <tbody>{race.map((s) => <tr key={s.id}><td>{s.name}</td>{s.cumulative.map((v, i) => <td key={i} className="r">{v}</td>)}</tr>)}</tbody>
          </table>
        }
      >
        <SeasonRace labels={labels} series={race} initial={active.slice(0, 5).map((r) => r.playerId)} />
      </ChartFrame>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <ChartFrame
          title="Goal involvement"
          units="Goals + assists per player, season to date"
          legend={
            <>
              <span><Swatch color="var(--s1)" /> Goals</span>
              <span><Swatch color="var(--s2)" /> Assists</span>
              <span><Swatch color="var(--text-2)" hatch /> Hatched · <span style={{ color: "var(--ochre)" }}>D</span> = drop-in</span>
            </>
          }
          table={
            <table>
              <thead><tr><th>Player</th><th className="r">Goals</th><th className="r">Assists</th><th className="r">Total</th></tr></thead>
              <tbody>{involvement.filter((r) => r.goals + r.assists).sort((a, b) => b.goals + b.assists - a.goals - a.assists).map((r) => <tr key={r.id}><td><Name id={r.id} /></td><td className="r">{r.goals}</td><td className="r">{r.assists}</td><td className="r">{r.goals + r.assists}</td></tr>)}</tbody>
            </table>
          }
        >
          <GoalInvolvement rows={involvement} />
        </ChartFrame>

        <ChartFrame title="Form guide" units="Points in each player's last five match days played (oldest → newest)">
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "0.5rem" }}>
            {active.map((r) => (
              <div key={r.playerId} className="row spread" style={{ padding: "0.35rem 0.5rem", background: "var(--bg)", borderRadius: 8 }}>
                <span className="small" style={{ whiteSpace: "nowrap" }}><Name id={r.playerId} /></span>
                <Sparkline values={r.form} width={64} height={22} />
              </div>
            ))}
          </div>
        </ChartFrame>
      </div>

      <ChartFrame title="Contribution matrix" units="Points earned per player per match day · rows ordered by table position" legend={<MatrixLegend />}>
        <ContributionMatrix players={active.map((r) => ({ id: r.playerId, perMatch: r.perMatch }))} matches={played.map((m, i) => ({ id: m.id, label: labels[i] }))} />
      </ChartFrame>

      <ChartFrame
        title="Selector accuracy"
        units="Hit rate · share of each selector's picks who scored or assisted, all rounds"
        source="RSFC pick-7 entries scored against match-day scorecards."
        table={
          <table>
            <thead><tr><th>Selector</th><th className="r">Hits</th><th className="r">Picks</th><th className="r">Rate</th><th className="r">Pts</th></tr></thead>
            <tbody>{selectors.map((s) => <tr key={s.selectorId}><td>{selectorName(state, s.selectorId)}</td><td className="r">{s.hits}</td><td className="r">{s.totalPicks}</td><td className="r">{Math.round(s.hitRate * 100)}%</td><td className="r">{s.points}</td></tr>)}</tbody>
          </table>
        }
      >
        {selectors.length ? (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.6rem" }}>
            {[...selectors]
              .sort((a, b) => b.hitRate - a.hitRate || b.points - a.points)
              .map((s) => (
                <SelectorGauge key={s.selectorId} name={selectorName(state, s.selectorId)} hitRate={s.hitRate} hits={s.hits} picks={s.totalPicks} points={s.points} />
              ))}
          </div>
        ) : (
          <p className="muted">No pick-7 entries on played match days yet.</p>
        )}
      </ChartFrame>
    </main>
  );
}
