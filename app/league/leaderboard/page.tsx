import { redirect } from "next/navigation";
import { LeaderboardView } from "@/components/league/LeaderboardView";
import { LeagueFooter, LeagueHeader } from "@/components/league/LeagueHeader";
import { getDb } from "@/lib/league/db";
import { getLeaderboard, getSettings } from "@/lib/league/service";
import { currentUser } from "@/lib/league/session";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const user = await currentUser();
  if (!user) redirect("/league/login");
  const db = await getDb();
  const [settings, board] = await Promise.all([getSettings(db), getLeaderboard(db)]);
  return (
    <>
      <LeagueHeader user={user} leagueName={settings.name} demo={settings.demo} active="leaderboard">
        <h1>The table never lies</h1>
        <p>{board.latestRound ? `Updated after ${board.latestRound.name}. Arrows show movement since the round before.` : "Standings appear once the first results are in."}</p>
      </LeagueHeader>
      <main className="lg-main lg-wrap">
        <LeaderboardView board={board} meId={user.id} />
        <p className="lg-small lg-muted" style={{ marginTop: 16 }}>Players level on points share a rank (shown as =2). Within a tie, more exact scores are listed first. Hover a title to see how it was earned.</p>
      </main>
      <LeagueFooter />
    </>
  );
}
