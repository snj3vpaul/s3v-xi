"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AdminFixture, Member, RoundSummary } from "@/lib/league/service";
import { leagueApi } from "./api";
import { LocalTime } from "./LocalTime";

type Props = { rounds: RoundSummary[]; fixtures: AdminFixture[]; members: Member[]; inviteCode: string; leagueName: string; meId: string };
type Flash = { kind: "ok" | "err"; text: string } | null;

/** datetime-local value (viewer's timezone) → ISO UTC instant. */
function localToIso(v: string): string | null { if (!v) return null; const d = new Date(v); return Number.isFinite(d.getTime()) ? d.toISOString() : null; }
function isoToLocal(iso: string): string { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }

/** Two-tap confirm instead of a blocking browser dialog. */
function ConfirmButton({ label, confirmLabel, onConfirm, className = "lg-btn small danger" }: { label: string; confirmLabel: string; onConfirm: () => void; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
  return <button type="button" className={className} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>{armed ? confirmLabel : label}</button>;
}

export function AdminPanel({ rounds, fixtures, members, inviteCode, leagueName, meId }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"rounds" | "members" | "league">("rounds");
  const [flash, setFlash] = useState<Flash>(null);
  const [busy, setBusy] = useState(false);

  async function call(path: string, method: string, body: unknown, success: string) {
    setBusy(true); setFlash(null);
    const r = await leagueApi(path, method, body);
    setBusy(false);
    if (!r.ok) { setFlash({ kind: "err", text: r.data.error ?? "That didn't work." }); return false; }
    setFlash({ kind: "ok", text: success });
    router.refresh();
    return true;
  }

  return (
    <>
      <div className="lg-admin-tabs" role="group" aria-label="Admin sections">
        <button type="button" aria-pressed={tab === "rounds"} onClick={() => setTab("rounds")}>🗓️ Rounds &amp; results</button>
        <button type="button" aria-pressed={tab === "members"} onClick={() => setTab("members")}>👥 Members ({members.filter((m) => m.status === "active").length})</button>
        <button type="button" aria-pressed={tab === "league"} onClick={() => setTab("league")}>🎟️ Invite &amp; settings</button>
      </div>
      {flash && <p className={`lg-msg ${flash.kind}`} role="status" style={{ marginBottom: 14 }}>{flash.text}</p>}

      {tab === "rounds" && <RoundsAdmin rounds={rounds} fixtures={fixtures} call={call} busy={busy} />}
      {tab === "members" && <MembersAdmin members={members} meId={meId} call={call} />}
      {tab === "league" && <LeagueAdmin inviteCode={inviteCode} leagueName={leagueName} call={call} busy={busy} />}
    </>
  );
}

type Call = (path: string, method: string, body: unknown, success: string) => Promise<boolean>;

function RoundsAdmin({ rounds, fixtures, call, busy }: { rounds: RoundSummary[]; fixtures: AdminFixture[]; call: Call; busy: boolean }) {
  const [name, setName] = useState(`Matchweek ${rounds.length + 1}`);
  const ordered = [...rounds].reverse();
  return (
    <div className="lg-stack">
      <form className="lg-card lg-row" onSubmit={async (e) => { e.preventDefault(); if (await call("/admin/rounds", "POST", { name }, `“${name}” created. Add some fixtures below.`)) setName(`Matchweek ${rounds.length + 2}`); }}>
        <label className="lg-field" style={{ flex: "1 1 220px" }}>New round name<input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></label>
        <button className="lg-btn" disabled={busy || name.trim().length < 2} style={{ alignSelf: "end" }}>Create round</button>
      </form>
      {ordered.length === 0 && <div className="lg-card lg-empty"><div className="big">📋</div><h3>No rounds yet</h3><p className="lg-muted">Create your first round above, then add its fixtures.</p></div>}
      {ordered.map((r) => (
        <section key={r.id} className="lg-card lg-admin-round" aria-label={r.name}>
          <header>
            <div>
              <h3>{r.name}</h3>
              <p className="lg-small lg-muted">{r.fixtureCount} fixtures, {r.resultsIn} results in</p>
            </div>
            <div className="lg-row">
              <span className={`lg-pill ${r.status}`}>{r.status === "open" ? "Open for picks" : r.status === "locked" ? "Locked" : "Scored"}</span>
              {r.status === "open" && <button type="button" className="lg-btn small secondary" onClick={() => call(`/admin/rounds/${r.id}`, "PATCH", { status: "locked" }, `${r.name} locked. Picks are now visible to everyone.`)}>🔒 Lock picks now</button>}
              {r.status === "locked" && <button type="button" className="lg-btn small secondary" onClick={() => call(`/admin/rounds/${r.id}`, "PATCH", { status: "open" }, `${r.name} reopened. Fixtures before their deadline accept picks again.`)}>Reopen</button>}
              <ConfirmButton label="Delete round" confirmLabel="Tap again to delete" onConfirm={() => call(`/admin/rounds/${r.id}`, "DELETE", undefined, `${r.name} deleted.`)} />
            </div>
          </header>
          {fixtures.filter((f) => f.roundId === r.id).map((f) => <FixtureAdmin key={f.id} f={f} call={call} />)}
          <AddFixture roundId={r.id} call={call} busy={busy} />
        </section>
      ))}
    </div>
  );
}

function FixtureAdmin({ f, call }: { f: AdminFixture; call: Call }) {
  const [home, setHome] = useState(f.result ? String(f.result.home) : "");
  const [away, setAway] = useState(f.result ? String(f.result.away) : "");
  const [editing, setEditing] = useState(false);
  useEffect(() => { setHome(f.result ? String(f.result.home) : ""); setAway(f.result ? String(f.result.away) : ""); }, [f.result]);
  const kicked = Date.parse(f.kickoffAt) <= Date.now();
  const valid = /^\d{1,2}$/.test(home) && /^\d{1,2}$/.test(away);
  if (editing) return <EditFixture f={f} call={call} done={() => setEditing(false)} />;
  return (
    <div className="lg-afx">
      <div>
        <strong>{f.homeTeam} vs {f.awayTeam}</strong>
        <p className="lg-small lg-muted">Kick-off <LocalTime iso={f.kickoffAt} />. {f.pickCount} picks. {f.deadlineAt !== f.kickoffAt && <>Picks lock <LocalTime iso={f.deadlineAt} />.</>}</p>
        <div className="lg-row" style={{ marginTop: 6 }}>
          <button type="button" className="lg-btn small secondary" onClick={() => setEditing(true)}>Edit</button>
          <ConfirmButton label="Delete" confirmLabel="Tap again" onConfirm={() => call(`/admin/fixtures/${f.id}`, "DELETE", undefined, "Fixture deleted.")} />
        </div>
      </div>
      <form className="lg-result-form" onSubmit={(e) => { e.preventDefault(); call(`/admin/fixtures/${f.id}/result`, "PUT", { home: Number(home), away: Number(away) }, `Result saved: ${f.homeTeam} ${home}–${away} ${f.awayTeam}. Points updated for everyone.`); }}>
        <input aria-label={`${f.homeTeam} goals`} inputMode="numeric" maxLength={2} value={home} onChange={(e) => setHome(e.target.value.replace(/\D/g, ""))} disabled={!kicked} placeholder="–" />
        <span className="lg-dash">–</span>
        <input aria-label={`${f.awayTeam} goals`} inputMode="numeric" maxLength={2} value={away} onChange={(e) => setAway(e.target.value.replace(/\D/g, ""))} disabled={!kicked} placeholder="–" />
        <button className="lg-btn small" disabled={!kicked || !valid || (f.result?.home === Number(home) && f.result?.away === Number(away))} title={kicked ? undefined : "Available after kick-off"}>
          {f.result ? "Update" : "Save result"}
        </button>
        {f.result && <button type="button" className="lg-btn small secondary" onClick={() => call(`/admin/fixtures/${f.id}/result`, "PUT", { clear: true }, "Result cleared and points removed.")}>Clear</button>}
      </form>
    </div>
  );
}

function EditFixture({ f, call, done }: { f: AdminFixture; call: Call; done: () => void }) {
  const [form, setForm] = useState({ homeTeam: f.homeTeam, awayTeam: f.awayTeam, kickoff: isoToLocal(f.kickoffAt), deadline: f.deadlineAt === f.kickoffAt ? "" : isoToLocal(f.deadlineAt) });
  return (
    <form className="lg-afx" style={{ gridTemplateColumns: "1fr" }} onSubmit={async (e) => {
      e.preventDefault();
      if (await call(`/admin/fixtures/${f.id}`, "PATCH", { homeTeam: form.homeTeam, awayTeam: form.awayTeam, kickoffAt: localToIso(form.kickoff), deadlineAt: localToIso(form.deadline) }, "Fixture updated.")) done();
    }}>
      <FixtureFields form={form} setForm={setForm} />
      <div className="lg-row"><button className="lg-btn small">Save changes</button><button type="button" className="lg-btn small secondary" onClick={done}>Cancel</button></div>
    </form>
  );
}

type FxForm = { homeTeam: string; awayTeam: string; kickoff: string; deadline: string };
function FixtureFields({ form, setForm }: { form: FxForm; setForm: (f: FxForm) => void }) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <div className="lg-form-grid">
      <label className="lg-field">Home team<input value={form.homeTeam} maxLength={40} onChange={(e) => setForm({ ...form, homeTeam: e.target.value })} required /></label>
      <label className="lg-field">Away team<input value={form.awayTeam} maxLength={40} onChange={(e) => setForm({ ...form, awayTeam: e.target.value })} required /></label>
      <label className="lg-field">Kick-off<input type="datetime-local" value={form.kickoff} onChange={(e) => setForm({ ...form, kickoff: e.target.value })} required /><small>Your time ({tz}). Saved in UTC; everyone sees their own local time.</small></label>
      <label className="lg-field">Picks lock (optional)<input type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /><small>Leave blank to lock at kick-off.</small></label>
    </div>
  );
}

function AddFixture({ roundId, call, busy }: { roundId: string; call: Call; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FxForm>({ homeTeam: "", awayTeam: "", kickoff: "", deadline: "" });
  if (!open) return <button type="button" className="lg-btn small secondary" style={{ justifySelf: "start" }} onClick={() => setOpen(true)}>+ Add fixture</button>;
  return (
    <form style={{ borderTop: "2px dashed var(--line)", paddingTop: 14, display: "grid", gap: 12 }} onSubmit={async (e) => {
      e.preventDefault();
      const kickoffAt = localToIso(form.kickoff);
      if (await call(`/admin/rounds/${roundId}/fixtures`, "POST", { homeTeam: form.homeTeam, awayTeam: form.awayTeam, kickoffAt, deadlineAt: localToIso(form.deadline) }, `${form.homeTeam} vs ${form.awayTeam} added.`))
        setForm({ homeTeam: "", awayTeam: "", kickoff: form.kickoff, deadline: "" });
    }}>
      <FixtureFields form={form} setForm={setForm} />
      <div className="lg-row"><button className="lg-btn small" disabled={busy || !form.homeTeam || !form.awayTeam || !form.kickoff}>Add fixture</button><button type="button" className="lg-btn small secondary" onClick={() => setOpen(false)}>Done</button></div>
    </form>
  );
}

function MembersAdmin({ members, meId, call }: { members: Member[]; meId: string; call: Call }) {
  return (
    <div className="lg-card">
      <p className="lg-small lg-muted" style={{ marginBottom: 6 }}>Removing someone signs them out, hides them from the table and stops new picks. Their history stays, and you can bring them back any time.</p>
      <div className="lg-members">
        {members.map((m) => (
          <div key={m.id} className={`lg-member${m.status === "removed" ? " removed" : ""}`}>
            <span className="ava" aria-hidden="true">{m.avatar}</span>
            <div style={{ minWidth: 0 }}>
              <strong>{m.name}</strong> {m.role === "admin" && <span className="lg-pill">Admin</span>} {m.status === "removed" && <span className="lg-pill locked">Removed</span>}
              <p className="lg-small lg-muted" style={{ overflowWrap: "anywhere" }}>{m.email}. Joined <LocalTime iso={m.joinedAt} mode="relative" />. {m.lastSeenAt ? <>Last seen <LocalTime iso={m.lastSeenAt} mode="relative" />.</> : "Not seen yet."} {m.pickCount} picks, {m.points} pts.</p>
            </div>
            {m.id === meId ? <span className="lg-small lg-muted">You</span>
              : m.status === "active"
                ? <ConfirmButton label="Remove" confirmLabel="Tap to confirm" onConfirm={() => call(`/admin/members/${m.id}`, "PATCH", { status: "removed" }, `${m.name} has been removed. You can restore them any time.`)} />
                : <button type="button" className="lg-btn small secondary" onClick={() => call(`/admin/members/${m.id}`, "PATCH", { status: "active" }, `Welcome back, ${m.name}!`)}>Restore</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

function LeagueAdmin({ inviteCode, leagueName, call, busy }: { inviteCode: string; leagueName: string; call: Call; busy: boolean }) {
  const [name, setName] = useState(leagueName);
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState(`/league/join?code=${inviteCode}`);
  useEffect(() => setLink(`${window.location.origin}/league/join?code=${inviteCode}`), [inviteCode]);
  return (
    <div className="lg-stack">
      <section className="lg-card lg-stack">
        <h3 style={{ fontSize: 26 }}>Invite friends</h3>
        <p className="lg-muted lg-small">Share this link in the group chat. Only people with the code can join.</p>
        <div className="lg-invite"><code>{inviteCode}</code>
          <button type="button" className="lg-btn small" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ } }}>{copied ? "Copied ✓" : "Copy invite link"}</button>
          <ConfirmButton className="lg-btn small secondary" label="New code" confirmLabel="Old link stops working. Tap again" onConfirm={() => call("/admin/league", "PATCH", { regenerateInvite: true }, "New invite code ready. The old link no longer works.")} />
        </div>
        <p className="lg-small lg-muted" style={{ overflowWrap: "anywhere" }}>{link}</p>
      </section>
      <form className="lg-card lg-stack" onSubmit={(e) => { e.preventDefault(); call("/admin/league", "PATCH", { name }, "League renamed."); }}>
        <label className="lg-field">League name<input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></label>
        <button className="lg-btn small" style={{ justifySelf: "start" }} disabled={busy || name.trim().length < 2 || name === leagueName}>Rename league</button>
      </form>
      <section className="lg-card lg-stack">
        <h3 style={{ fontSize: 26 }}>Scoring engine</h3>
        <p className="lg-small lg-muted">Points recalculate automatically whenever you save a result. If you change the scoring rules in <code>lib/league/config.ts</code>, recalculate everything here.</p>
        <button type="button" className="lg-btn small secondary" style={{ justifySelf: "start" }} disabled={busy} onClick={() => call("/admin/recompute", "POST", {}, "Every result has been rescored.")}>Recalculate all points</button>
      </section>
    </div>
  );
}
