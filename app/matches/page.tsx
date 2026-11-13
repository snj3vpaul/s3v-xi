import type { Metadata } from "next";
import Link from "next/link";
import { playerName } from "@/config/club";
import { fmtDate, matchSummary } from "@/lib/league/derive";
import { getState } from "@/lib/server/store";
import { Empty, Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Matches" };

export default async function MatchesPage() {
  const state = await getState();
  const list = [...state.matchDays].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <Kicker label="Results" no="Matches" />
        <h1>Every <em>match day.</em></h1>
      </header>
      {list.length === 0 ? (
        <Empty>No match days yet.</Empty>
      ) : (
        <div className="grid grid-2">
          {list.map((m) => {
            const { score, format, lines } = matchSummary(m, state);
            const scorers = [...lines.values()].filter((l) => l.goals > 0).map((l) => `${playerName(l.playerId)}${l.goals > 1 ? ` ×${l.goals}` : ""}`);
            return (
              <Link key={m.id} href={`/matches/${m.id}`} className="panel stack" style={{ color: "inherit", textDecoration: "none" }}>
                <div className="row spread">
                  <h3>{m.label || fmtDate(m.date)}</h3>
                  <span className="badge badge-muted">{m.status === "played" ? "Full time" : m.status === "drawn" ? "Teams drawn" : "Upcoming"}</span>
                </div>
                {m.status === "played" ? (
                  <div className="row" style={{ gap: "1rem" }}>
                    <span className="row"><span className="bib bib-A" /> Chalk</span>
                    <span className="score num">{score.A}–{score.B}</span>
                    <span className="row">Kit <span className="bib bib-B" /></span>
                  </div>
                ) : null}
                <div className="small muted">
                  {format ?? `${m.attendees.length} attending`}
                  {scorers.length ? ` · ${scorers.join(", ")}` : ""}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
