"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/team", "My Team"],
  ["/draw", "Draw"],
  ["/matches", "Matches"],
  ["/table", "Table"],
  ["/stats", "Stats"],
  ["/rules", "Rules"],
] as const;

export function Nav({ userName }: { userName: string | null }) {
  const path = usePathname();
  return (
    <header className="topbar">
      <div className="wrap">
        <Link href="/" className="brand" aria-label="RSFC League home">
          RSFC <span>League</span>
        </Link>
        <nav className="nav" aria-label="Main">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} aria-current={path.startsWith(href) ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        <Link href={userName ? "/account" : "/login"} className="nav-account" aria-current={path.startsWith("/account") || path.startsWith("/login") || path.startsWith("/join") ? "page" : undefined}>
          {userName ? userName.split(" ")[0] : "Log in"}
        </Link>
      </div>
    </header>
  );
}
