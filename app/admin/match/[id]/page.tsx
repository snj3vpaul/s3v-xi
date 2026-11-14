import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fmtDate } from "@/lib/league/derive";
import { canCorrect, correctionDeadline } from "@/lib/league/ledger";
import { rulesVersionOf } from "@/lib/scoring/rules";
import { isAdmin } from "@/lib/server/auth";
import { getState } from "@/lib/server/store";
import { AdminLogin } from "@/components/AdminLogin";
import { ScorecardEditor } from "@/components/ScorecardEditor";
import { TeamSheetEditor } from "@/components/TeamSheetEditor";
import { Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Match day" };

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
  const version = rulesVersionOf(m);

  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <Kicker label={m.scorecardAt ? "Correction" : "Match day"} no={fmtDate(m.date)} />
        <h1>
          {m.scorecardAt ? <>Correct the <em>scoresheet.</em></> : !m.draw ? <>This week&apos;s <em>teams.</em></> : <>Full time. <em>Who scored?</em></>}
        </h1>
        <p className="muted">
          {!m.draw
            ? "Once the captains have picked sides on WhatsApp, enter the teams here. You can change them any time until the scorecard is in."
            : version === 2
              ? "Log each goal, pick a Man of the Match for each team, then check conduct: fair play and who did their goalkeeper and sub stints."
              : "One entry per goal, in order. Pick the type first — it decides who can get an assist."}{" "}
          <Link href={`/matches/${m.id}`}>Match report →</Link>
        </p>
      </header>

      <details className="panel" open={!m.draw}>
        <summary className="display" style={{ cursor: "pointer", fontSize: "1.2rem" }}>
          1 · Team sheet{m.draw ? ` (White ${m.draw.teamA.length} · Red ${m.draw.teamB.length})` : ""}
        </summary>
        <div style={{ marginTop: "0.75rem" }}>
          <TeamSheetEditor matchId={m.id} initialA={m.draw?.teamA ?? []} initialB={m.draw?.teamB ?? []} locked={!!m.scorecardAt} />
        </div>
      </details>

      {!m.draw ? (
        <div className="panel muted">2 · Scorecard: save the team sheet first.</div>
      ) : (
        <>
          <h2 className="display" style={{ margin: 0, fontSize: "1.2rem" }}>2 · Scorecard</h2>
          <ScorecardEditor
            matchId={m.id}
            attendees={m.attendees}
            draw={m.draw}
            initial={m.events}
            initialMotm={m.motm ?? null}
            initialFairPlayLost={m.fairPlayLost ?? []}
            initialRotation={{ missed: m.rotationMissed ?? [], checked: !!m.rotationChecked, noResult: !!m.noResult }}
            version={version}
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
