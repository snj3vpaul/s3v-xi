import { redirect } from "next/navigation";
import { JoinForm } from "@/components/league/AuthForm";
import { LeagueFooter, LeagueHeader } from "@/components/league/LeagueHeader";
import { getDb } from "@/lib/league/db";
import { getSettings } from "@/lib/league/service";
import { currentUser } from "@/lib/league/session";

export const dynamic = "force-dynamic";

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  if (await currentUser()) redirect("/league");
  const [{ code }, settings] = await Promise.all([searchParams, getDb().then(getSettings)]);
  return (
    <>
      <LeagueHeader user={null} leagueName={settings.name} demo={settings.demo}>
        <h1>You&apos;re invited</h1>
        <p>Predict real scorelines, earn points, collect bragging rights. Free, friendly, and absolutely no money involved.</p>
      </LeagueHeader>
      <main className="lg-main lg-wrap">
        <div className="lg-auth"><div className="lg-card">
          <JoinForm initialCode={typeof code === "string" ? code.slice(0, 20).toUpperCase() : ""} leagueName={settings.name} />
        </div></div>
      </main>
      <LeagueFooter />
    </>
  );
}
