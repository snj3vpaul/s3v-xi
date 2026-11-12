import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExactCelebration } from "@/components/league/Confetti";
import { LeagueFooter, LeagueHeader } from "@/components/league/LeagueHeader";
import { RoundPicks } from "@/components/league/RoundPicks";
import { getDb } from "@/lib/league/db";
import { getRoundView, getSettings, LeagueError } from "@/lib/league/service";
import { currentUser } from "@/lib/league/session";

export const dynamic = "force-dynamic";

const STATUS = { open: "Open for picks", locked: "Picks locked, awaiting results", scored: "Fully scored" } as const;

export default async function RoundPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/league/login");
  const { id } = await params;
  const db = await getDb();
  const settings = await getSettings(db);
  let view;
  try { view = await getRoundView(db, id, user); } catch (err) { if (err instanceof LeagueError && err.status === 404) notFound(); throw err; }
  const exactHits = view.fixtures.filter((f) => f.myPoints?.reason === "exact" && f.result)
    .map((f) => ({ fixtureId: f.id, label: `${f.homeTeam} ${f.result!.home}–${f.result!.away} ${f.awayTeam}` }));
  const status = view.round.status === "open" && view.round.picksOpen === 0 && view.round.fixtureCount > 0 ? "locked" : view.round.status;

  return (
    <>
      <LeagueHeader user={user} leagueName={settings.name} demo={settings.demo} active="round">
        <Link href="/league" className="lg-iconbtn" style={{ marginBottom: 14 }}>← All rounds</Link>
        <h1>{view.round.name}</h1>
        <p>
          {STATUS[status]}. {view.round.resultsIn > 0 ? <>You&apos;ve banked <strong>{view.myTotal} {view.myTotal === 1 ? "point" : "points"}</strong> here so far.</> : "Exact score earns 3, right result earns 1."}
        </p>
      </LeagueHeader>
      <main className="lg-main lg-wrap">
        {exactHits.length > 0 && <div style={{ marginBottom: 14 }}><ExactCelebration hits={exactHits} userId={user.id} /></div>}
        <RoundPicks fixtures={view.fixtures} userId={user.id} />
      </main>
      <LeagueFooter />
    </>
  );
}
