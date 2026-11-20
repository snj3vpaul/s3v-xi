import { POINTS, GOAL_LABEL } from "@/lib/scoring/rules";
import type { Metadata } from "next";
import Link from "next/link";
import { playerName } from "@/config/club";
import { deriveSeason, selectorName } from "@/lib/league/derive";
import { shortDate } from "@/lib/format";
import { getState } from "@/lib/server/store";
import { currentUser } from "@/lib/server/session";
import { buildPick7Table } from "@/lib/league/pick7Table";
import { Pick7Table } from "@/components/Pick7Table";
import { Empty, Kicker } from "@/components/ui";
import { StandingsBoard } from "@/components/StandingsBoard";
import { buildBoard } from "@/lib/league/tableView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Table" };

export default async function TablePage() {
  const [state, me] = await Promise.all([getState(), currentUser()]);
  const { rules, played, standings, selectors, awards } = deriveSeason(state);
  const pick7 = buildPick7Table(state, rules, selectors);
  const board = buildBoard(state.matchDays, rules, standings);
  const through = played.length
    ? `Season standings after ${played.length} Thursday${played.length === 1 ? "" : "s"}, last played ${shortDate(played.at(-1)!.date)}`
    : "Season standings";

  return (
    <main className="wrap stack-lg">
      {played.length === 0 ? (
        <>
          <header className="stack">
            <Kicker label="Season standings" no="0 match days" />
            <h1>The <em>table.</em></h1>
            <p className="lede">Goal {GOAL_LABEL}, assist +{POINTS.assist}, Man of the Match +{POINTS.motm}, win +{POINTS.win}. <Link href="/rules">All the rules</Link>.</p>
          </header>
          <Empty>
            No scorecards yet. Everyone&apos;s joint top on zero. <Link href="/simulate">See how a Thursday gets scored</Link>
          </Empty>
        </>
      ) : (
        <>
          <StandingsBoard rows={board} played={played.length} through={through} />

          <section className="grid grid-3">
            {awards.map((a) => (
              <div key={a.key} className="panel stat-tile">
                <div className="l" style={{ marginTop: 0, color: "var(--ochre)" }}>{a.title}</div>
                <div className="v" style={{ fontSize: "1.7rem", marginTop: "0.35rem" }}>
                  {a.winners.length ? a.winners.map((w) => (a.key === "oracle" ? selectorName(state, w) : playerName(w))).join(" & ") : "—"}
                </div>
                <div className="l">{a.winners.length ? `${a.value} ${a.unit}` : "Nobody qualifies yet"}</div>
              </div>
            ))}
          </section>
          {state.settings.excludeDropInsFromAwards && (
            <p className="small muted">Drop-ins are excluded from season awards this season (they still appear in the table).</p>
          )}
        </>
      )}

      <section className="panel" id="pick7">
        <div className="panel-head">
          <h2>Pick 7 table</h2>
          <span className="small muted">Hit = a pick who scored or assisted</span>
        </div>
        <Pick7Table initial={pick7} meId={me?.id ?? null} />
      </section>
    </main>
  );
}
