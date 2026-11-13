import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CLUB } from "@/config/club";
import { claimablePlayers } from "@/lib/league/players";
import { currentUser } from "@/lib/server/session";
import { getState } from "@/lib/server/store";
import { SignupForm } from "@/components/AuthForms";
import { Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Join" };

export default async function JoinPage() {
  if (await currentUser()) redirect("/team");
  const state = await getState();
  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <Kicker label="Accounts" no="Join" />
        <h1>Join the <em>league.</em></h1>
        <p className="lede">
          One account, one seven. Pick {CLUB.picksPerSelector} of the 21 before each Thursday deadline — it carries over every week until you change it.
        </p>
      </header>
      <SignupForm players={claimablePlayers(state)} codeRequired={!!process.env.SIGNUP_CODE} />
    </main>
  );
}
