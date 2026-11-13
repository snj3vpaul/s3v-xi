import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { claimablePlayers } from "@/lib/league/players";
import { currentUser } from "@/lib/server/session";
import { getState } from "@/lib/server/store";
import { AccountForm } from "@/components/AccountForm";
import { LogoutButton } from "@/components/AuthForms";
import { CalendarLinks } from "@/components/CalendarLinks";
import { Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  const state = await getState();
  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <Kicker label="Accounts" no="Settings" />
        <div className="row spread">
          <h1>{me.name.split(" ")[0]}&apos;s <em>account.</em></h1>
          <LogoutButton />
        </div>
      </header>
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <AccountForm
          initial={{ name: me.name, playerId: me.playerId, emailReminders: me.emailReminders, email: me.email }}
          players={claimablePlayers(state, me.id)}
        />
        <section className="panel stack">
          <h3>Thursday fixtures in your calendar</h3>
          <p className="muted small" style={{ margin: 0 }}>
            Subscribe once and every White vs Red match day appears in your calendar, with reminders the day before and three hours before kick-off.
          </p>
          <CalendarLinks />
        </section>
      </div>
    </main>
  );
}
