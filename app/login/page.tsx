import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/session";
import { LoginForm } from "@/components/AuthForms";
import { Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  if (await currentUser()) redirect("/team");
  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <Kicker label="Accounts" no="Log in" />
        <h1>Welcome <em>back.</em></h1>
      </header>
      <LoginForm />
    </main>
  );
}
