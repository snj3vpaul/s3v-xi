import Link from "next/link";
import type { LeagueUser } from "@/lib/league/service";
import { SignOutButton } from "./SignOutButton";
import { ThemeToggle } from "./ThemeToggle";

type Props = { user: LeagueUser | null; leagueName: string; demo: boolean; active?: "home" | "leaderboard" | "rules" | "admin" | "round"; children?: React.ReactNode };

export function LeagueHeader({ user, leagueName, demo, active, children }: Props) {
  const link = (href: string, key: Props["active"], label: string) => (
    <Link href={href} aria-current={active === key ? "page" : undefined}>{label}</Link>
  );
  return (
    <>
      {demo && <div className="lg-demo-banner">Demo league with sample players. Data resets if the server&apos;s storage is wiped.</div>}
      <header className="lg-head">
        <div className="lg-wrap">
          <div className="lg-head-top">
            <Link href="/league" className="lg-brand">
              <span className="lg-brand-ball" aria-hidden="true">⚽</span>
              <span style={{ minWidth: 0 }}><b>{leagueName}</b><small>Predictor league, just for fun</small></span>
            </Link>
            <div className="lg-head-actions">
              <ThemeToggle />
              {user && <span className="lg-iconbtn lg-me" title={user.name}><span aria-hidden="true">{user.avatar}</span><span className="lg-me-name">{user.name}</span></span>}
              {user && <SignOutButton />}
            </div>
          </div>
          {user && (
            <nav className="lg-nav" aria-label="League">
              {link("/league", "home", "🏠 Home")}
              {link("/league/leaderboard", "leaderboard", "🏆 Leaderboard")}
              {link("/league/rules", "rules", "📜 How scoring works")}
              {user.role === "admin" && link("/league/admin", "admin", "🛠️ Admin")}
            </nav>
          )}
          <div className="lg-hero">{children}</div>
        </div>
      </header>
    </>
  );
}

export function LeagueFooter() {
  return (
    <footer className="lg-footer">
      Points are bragging rights only. No money, no betting, no prizes, just friends and football opinions.{" "}
      <Link href="/league/rules">How scoring works</Link>. <Link href="/">Back to S3V XI</Link>.
    </footer>
  );
}
