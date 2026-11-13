"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";

export function AdminLogin() {
  const router = useRouter();
  const [code, setCode] = useState("");
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
          await api("/api/admin/session", "POST", { passcode: code });
          router.refresh();
        } catch (e) {
          setErr((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Admin passcode</h3>
      <input type="password" autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Admin passcode" required />
      <button className="btn btn-primary" disabled={busy || !code}>Unlock admin</button>
      {err && <div className="alert alert-error">{err}</div>}
    </form>
  );
}

export function AdminLogout() {
  const router = useRouter();
  return (
    <button
      className="btn btn-sm"
      onClick={async () => {
        await api("/api/admin/session", "DELETE");
        router.refresh();
      }}
    >
      Lock admin
    </button>
  );
}
