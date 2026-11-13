"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  player: string | null;
  hasTeam: boolean;
  reminders: boolean;
  createdAt: string;
}

export function UsersAdmin({ users }: { users: AdminUserRow[] }) {
  const router = useRouter();
  const [temp, setTemp] = useState<{ name: string; pw: string } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (!users.length) return <p className="muted">No accounts yet. Share the /join link in the group chat.</p>;
  return (
    <div className="stack">
      {temp && (
        <div className="alert alert-ok" role="status">
          Temporary password for <b>{temp.name}</b>: <code style={{ fontSize: "1rem" }}>{temp.pw}</code> — pass it on privately; they can change it under Account.
        </div>
      )}
      {err && <div className="alert alert-error">{err}</div>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th className="hide-sm">Email</th><th className="hide-sm">Player</th><th>Team</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td className="hide-sm small muted">{u.email}</td>
                <td className="hide-sm">{u.player ?? "—"}</td>
                <td>{u.hasTeam ? "✓" : <span className="muted">none</span>}</td>
                <td>
                  <span className="row" style={{ justifyContent: "flex-end", gap: "0.3rem" }}>
                    <button
                      className="btn btn-sm"
                      onClick={async () => {
                        setErr(null);
                        try {
                          const r = await api<{ tempPassword: string }>(`/api/admin/users/${u.id}`, "POST", { action: "reset" });
                          setTemp({ name: u.name, pw: r.tempPassword });
                        } catch (e) {
                          setErr((e as Error).message);
                        }
                      }}
                    >
                      Reset password
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onBlur={() => setConfirm(null)}
                      onClick={async () => {
                        if (confirm !== u.id) return setConfirm(u.id);
                        try {
                          await api(`/api/admin/users/${u.id}`, "DELETE");
                          router.refresh();
                        } catch (e) {
                          setErr((e as Error).message);
                        }
                      }}
                    >
                      {confirm === u.id ? "Tap to confirm" : "Delete"}
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
