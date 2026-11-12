"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AVATARS } from "@/lib/league/config";
import { leagueApi } from "./api";

export function LoginForm({ demo }: { demo: { email: string; password: string; players: string[] } | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const r = await leagueApi("/auth/login", "POST", { email, password });
    setBusy(false);
    if (!r.ok) { setError(r.data.error ?? "Sign-in failed."); return; }
    router.push("/league"); router.refresh();
  }
  return (
    <form onSubmit={submit} noValidate>
      <label className="lg-field">Email<input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label className="lg-field">Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
      {error && <p className="lg-msg err" role="alert">{error}</p>}
      <button className="lg-btn block" disabled={busy || !email || !password}>{busy ? "Checking the team sheet…" : "Sign in"}</button>
      <p className="lg-small lg-muted">Got an invite link from a friend? Open it to join the league.</p>
      {demo && (
        <div className="lg-msg info lg-demo-creds">
          <strong>Demo league</strong>: every account uses the password <code>{demo.password}</code>.{" "}
          <button type="button" onClick={() => { setEmail(demo.email); setPassword(demo.password); }}>Fill in the admin</button>
          {" "}or try a player: {demo.players.map((p, i) => (
            <span key={p}>{i > 0 && ", "}<button type="button" onClick={() => { setEmail(p); setPassword(demo.password); }}>{p.split("@")[0]}</button></span>
          ))}.
        </div>
      )}
    </form>
  );
}

export function JoinForm({ initialCode, leagueName }: { initialCode: string; leagueName: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", inviteCode: initialCode, avatar: AVATARS[0] as string });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const r = await leagueApi("/auth/signup", "POST", form);
    setBusy(false);
    if (!r.ok) { setError(r.data.error ?? "Couldn't create your account."); return; }
    router.push("/league?welcome=1"); router.refresh();
  }
  return (
    <form onSubmit={submit} noValidate>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="lg-field" style={{ marginBottom: 8 }}>Pick your avatar</legend>
        <div className="lg-emoji-grid">
          {AVATARS.map((a) => (
            <button key={a} type="button" aria-pressed={form.avatar === a} aria-label={`Avatar ${a}`} onClick={() => setForm({ ...form, avatar: a })}>{a}</button>
          ))}
        </div>
      </fieldset>
      <label className="lg-field">Display name<input autoComplete="nickname" maxLength={24} value={form.name} onChange={set("name")} placeholder="What your mates call you" required /></label>
      <label className="lg-field">Email<input type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set("email")} required /></label>
      <label className="lg-field">Password<input type="password" autoComplete="new-password" minLength={8} value={form.password} onChange={set("password")} required /><small>At least 8 characters.</small></label>
      <label className="lg-field">Invite code<input autoCapitalize="characters" autoComplete="off" value={form.inviteCode} onChange={set("inviteCode")} required /><small>Only people with the code can join {leagueName}.</small></label>
      {error && <p className="lg-msg err" role="alert">{error}</p>}
      <button className="lg-btn block" disabled={busy}>{busy ? "Lacing up your boots…" : `Join ${leagueName}`}</button>
      <p className="lg-small lg-muted">Already in? <Link className="lg-textlink" href="/league/login">Sign in</Link></p>
    </form>
  );
}
