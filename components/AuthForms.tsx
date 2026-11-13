"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "./api";

export function SignupForm({ players, codeRequired }: { players: { id: string; name: string; dropin: boolean }[]; codeRequired: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({ name: "", email: "", password: "", playerId: "", code: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form
      className="panel stack"
      style={{ maxWidth: 460 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          await api("/api/auth/signup", "POST", { ...f, playerId: f.playerId || null });
          router.push("/team");
          router.refresh();
        } catch (e) {
          setErr((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="field">
        <label htmlFor="su-player">I am… (optional — links your account to your player)</label>
        <select
          id="su-player"
          value={f.playerId}
          onChange={(e) => {
            const p = players.find((x) => x.id === e.target.value);
            setF({ ...f, playerId: e.target.value, name: f.name || p?.name || "" });
          }}
        >
          <option value="">Not an RSFC player / prefer not to say</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>{p.name}{p.dropin ? " (drop-in)" : ""}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="su-name">Display name</label>
        <input id="su-name" type="text" autoComplete="nickname" value={f.name} onChange={set("name")} required maxLength={40} />
      </div>
      <div className="field">
        <label htmlFor="su-email">Email</label>
        <input id="su-email" type="email" autoComplete="email" inputMode="email" value={f.email} onChange={set("email")} required />
      </div>
      <div className="field">
        <label htmlFor="su-pass">Password (8+ characters)</label>
        <input id="su-pass" type="password" autoComplete="new-password" minLength={8} value={f.password} onChange={set("password")} required />
      </div>
      {codeRequired && (
        <div className="field">
          <label htmlFor="su-code">Club code (from the RSFC group chat)</label>
          <input id="su-code" type="text" autoComplete="off" value={f.code} onChange={set("code")} required />
        </div>
      )}
      <button className="btn btn-primary" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
      {err && <div className="alert alert-error">{err}</div>}
      <p className="small muted">Already have one? <Link href="/login">Log in</Link></p>
    </form>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="panel stack"
      style={{ maxWidth: 420 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          await api("/api/auth/login", "POST", { email, password });
          router.push("/team");
          router.refresh();
        } catch (e) {
          setErr((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="field">
        <label htmlFor="li-email">Email</label>
        <input id="li-email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="li-pass">Password</label>
        <input id="li-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <button className="btn btn-primary" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
      {err && <div className="alert alert-error">{err}</div>}
      <p className="small muted">
        New here? <Link href="/join">Create an account</Link>. Forgot your password? Ask an RSFC admin for a reset.
      </p>
    </form>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="btn btn-sm"
      onClick={async () => {
        await api("/api/auth/login", "DELETE");
        router.push("/");
        router.refresh();
      }}
    >
      Log out
    </button>
  );
}
