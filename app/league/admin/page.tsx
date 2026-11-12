import { redirect } from "next/navigation";
import { AdminPanel } from "@/components/league/AdminPanel";
import { LeagueFooter, LeagueHeader } from "@/components/league/LeagueHeader";
import { getDb } from "@/lib/league/db";
import { getSettings, listAdminFixtures, listMembers, listRounds } from "@/lib/league/service";
import { currentUser } from "@/lib/league/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/league/login");
  if (user.role !== "admin") redirect("/league");
  const db = await getDb();
  const [settings, rounds, fixtures, members] = await Promise.all([getSettings(db), listRounds(db), listAdminFixtures(db), listMembers(db)]);
  return (
    <>
      <LeagueHeader user={user} leagueName={settings.name} demo={settings.demo} active="admin">
        <h1>Commissioner&apos;s office</h1>
        <p>Set up rounds, enter results and keep the league tidy. Points recalculate the moment you save a score.</p>
      </LeagueHeader>
      <main className="lg-main lg-wrap">
        <AdminPanel rounds={rounds} fixtures={fixtures} members={members} inviteCode={settings.inviteCode} leagueName={settings.name} meId={user.id} />
      </main>
      <LeagueFooter />
    </>
  );
}
