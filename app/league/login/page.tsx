import { redirect } from "next/navigation";
import { LoginForm } from "@/components/league/AuthForm";
import { LeagueFooter, LeagueHeader } from "@/components/league/LeagueHeader";
import { getDb } from "@/lib/league/db";
import { DEMO_ADMIN_EMAIL, DEMO_PASSWORD } from "@/lib/league/seed";
import { getSettings } from "@/lib/league/service";
import { currentUser } from "@/lib/league/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentUser()) redirect("/league");
  const settings = await getSettings(await getDb());
  return (
    <>
      <LeagueHeader user={null} leagueName={settings.name} demo={settings.demo}>
        <h1>Back for more?</h1>
        <p>Sign in to make your picks, check the table and remind everyone who called it.</p>
      </LeagueHeader>
      <main className="lg-main lg-wrap">
        <div className="lg-auth"><div className="lg-card">
          <LoginForm demo={settings.demo ? { email: DEMO_ADMIN_EMAIL, password: DEMO_PASSWORD, players: ["priya@demo.league", "tom@demo.league", "leo@demo.league"] } : null} />
        </div></div>
      </main>
      <LeagueFooter />
    </>
  );
}
