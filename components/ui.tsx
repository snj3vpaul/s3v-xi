import Link from "next/link";
import { isDropIn, playerName } from "@/config/club";

export function DropInBadge() {
  return (
    <span className="badge badge-dropin" title="Drop-in player">
      Drop-in
    </span>
  );
}

/** Player name with the drop-in badge where relevant. */
export function Name({ id, link = false }: { id: string; link?: boolean }) {
  const n = playerName(id);
  return (
    <span className="row" style={{ gap: "0.35rem", display: "inline-flex" }}>
      {link ? <Link href={`/table#${id}`}>{n}</Link> : n}
      {isDropIn(id) && <DropInBadge />}
    </span>
  );
}

export function Kicker({ label, no }: { label: string; no?: string }) {
  return (
    <div className="kicker">
      <b>{label}</b>
      {no && <span>/ {no}</span>}
    </div>
  );
}

export function Points({ v }: { v: number }) {
  return <span className={`num ${v < 0 ? "neg" : ""}`}>{v > 0 ? `+${v}` : v}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="panel muted" style={{ textAlign: "center", padding: "2rem 1rem" }}>{children}</div>;
}
