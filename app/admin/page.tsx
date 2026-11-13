import type { Metadata } from "next";
import Link from "next/link";
import { playerName } from "@/config/club";
import { fmtDate } from "@/lib/league/derive";
import type { AuditEntry } from "@/lib/league/types";
import { isAdmin } from "@/lib/server/auth";
import { getState, storageMode } from "@/lib/server/store";
import { AdminLogin, AdminLogout } from "@/components/AdminLogin";
import { DeleteMatchDay, NewMatchDay } from "@/components/NewMatchDay";
import { SettingsForm } from "@/components/SettingsForm";
import { Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin" };

const ACTION: Record<AuditEntry["action"], string> = {
  "matchday.create": "Match day created",
  "matchday.delete": "Match day deleted",
  "matchday.attendance": "Attendance updated",
  "draw.create": "Teams drawn",
  "draw.reset": "Draw reset",
  "selection.submit": "Pick 7 submitted",
  "scorecard.create": "Scorecard published",
  "scorecard.correct": "Scorecard corrected",
  "settings.update": "Settings changed",
};

export default async function AdminPage() {
  const admin = await isAdmin();
  if (!admin)
    return (
      <main className="wrap stack-lg">
        <header className="stack">
          <Kicker label="Club admins" no="Admin" />
          <h1>Admin <em>mode.</em></h1>
          <p className="lede">Create match days, draw teams and enter scorecards. Ask the club for the passcode.</p>
        </header>
        <AdminLogin />
      </main>
    );

  const state = await getState();
  const matchDays = [...state.matchDays].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const dateOf = new Map(state.matchDays.map((m) => [m.id, m.date]));
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <Kicker label="Club admins" no="Admin" />
        <div className="row spread">
          <h1>Admin <em>mode.</em></h1>
          <span className="row">
            <a className="btn btn-sm" href="/api/export">Export JSON backup</a>
            <AdminLogout />
          </span>
        </div>
        <p className="small muted">
          Storage: {storageMode === "redis" ? "Upstash Redis (persistent)" : storageMode === "file" ? "local file .data/rsfc-league.json" : "memory only — not persistent!"}
          {state.demo && " · DEMO DATA loaded (npm run seed:demo). Delete .data/rsfc-league.json to start the real season."}
        </p>
      </header>

      <section className="panel">
        <h2>New match day</h2>
        <p className="muted small">Step 1 of 3. Then draw the teams on the Draw page, then enter the scorecard after full time.</p>
        <NewMatchDay defaultDate={today} />
      </section>

      <section className="panel">
        <h2>Match days</h2>
        {matchDays.length ? (
          <div className="table-wrap" style={{ marginTop: "0.5rem" }}>
            <table>
              <thead><tr><th>Date</th><th>Status</th><th className="r hide-sm">Players</th><th /></tr></thead>
              <tbody>
                {matchDays.map((m) => (
                  <tr key={m.id}>
                    <td><Link href={`/matches/${m.id}`}>{m.label || fmtDate(m.date)}</Link></td>
                    <td>
                      {m.status === "played" ? `Played${m.scorecardVersion > 1 ? ` · v${m.scorecardVersion}` : ""}` : m.status === "drawn" ? "Drawn" : "Open"}
                    </td>
                    <td className="r hide-sm">{m.attendees.length}</td>
                    <td>
                      <span className="row" style={{ justifyContent: "flex-end" }}>
                        {m.status === "open" && <Link className="btn btn-sm" href="/draw">Draw</Link>}
                        {m.draw && <Link className="btn btn-sm btn-primary" href={`/admin/match/${m.id}`}>{m.scorecardAt ? "Correct" : "Scorecard"}</Link>}
                        {!m.scorecardAt && <DeleteMatchDay id={m.id} />}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">None yet.</p>
        )}
      </section>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <section className="panel">
          <h2>Settings</h2>
          <div style={{ marginTop: "0.75rem" }}>
            <SettingsForm settings={state.settings} />
          </div>
        </section>
        <section className="panel">
          <h2>Audit log</h2>
          <p className="small muted">Every change, newest first. Corrections keep the previous version.</p>
          <ul className="small stack" style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0", maxHeight: 520, overflowY: "auto" }}>
            {[...state.audit].reverse().slice(0, 80).map((a) => (
              <li key={a.id} style={{ borderBottom: "1px solid var(--line-soft)", paddingBottom: "0.4rem" }}>
                <div className="row spread">
                  <b>{ACTION[a.action]}</b>
                  <span className="muted">{new Date(a.at).toLocaleString("en-CA", { timeZone: "America/Toronto", dateStyle: "short", timeStyle: "short" })}</span>
                </div>
                <div className="muted">
                  {a.actor === "admin" ? "Admin" : playerName(a.actor.replace("player:", ""))}
                  {a.matchId && dateOf.get(a.matchId) ? ` · ${fmtDate(dateOf.get(a.matchId)!)}` : ""}
                  {a.reason ? ` · “${a.reason}”` : ""}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
