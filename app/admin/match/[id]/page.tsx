import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fmtDate } from "@/lib/league/derive";
import { canCorrect, correctionDeadline } from "@/lib/league/ledger";
import { isAdmin } from "@/lib/server/auth";
import { getState } from "@/lib/server/store";
import { AdminLogin } from "@/components/AdminLogin";
import { ScorecardEditor } from "@/components/ScorecardEditor";
import { TeamsView } from "@/components/TeamsView";
import { Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Scorecard" };

export default async function ScorecardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await isAdmin()))
    return (
      <main className="wrap stack-lg">
        <h1>Admin <em>only.</em></h1>
        <AdminLogin />
      </main>
    );
  const state = await getState();
  const m = state.matchDays.find((x) => x.id === id);
  if (!m) notFound();
  const deadline = correctionDeadline(m, state.settings);

  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <Kicker label={m.scorecardAt ? "Correction" : "Scorecard entry"} no={fmtDate(m.date)} />
        <h1>{m.scorecardAt ? <>Correct the <em>scoresheet.</em></> : <>Full time. <em>Who scored?</em></>}</h1>
        <p className="muted">
          One entry per goal, in order. Pick the type first — it decides who can get an assist. <Link href={`/matches/${m.id}`}>Match report →</Link>
        </p>
      </header>
      {!m.draw ? (
        <div className="panel">
          Draw the teams first. <Link href="/draw">Go to the draw</Link>
        </div>
      ) : (
        <>
          <details className="panel">
            <summary className="display" style={{ cursor: "pointer", fontSize: "1.1rem" }}>Show the teams</summary>
            <div style={{ marginTop: "0.75rem" }}><TeamsView draw={m.draw} /></div>
          </details>
          <ScorecardEditor
            matchId={m.id}
            attendees={m.attendees}
            draw={m.draw}
            initial={m.events}
            settings={state.settings}
            isCorrection={m.scorecardAt !== null}
            windowOpen={canCorrect(m, state.settings, new Date())}
            deadline={deadline?.toISOString() ?? null}
          />
        </>
      )}
    </main>
  );
}
