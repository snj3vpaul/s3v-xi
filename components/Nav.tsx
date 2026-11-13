"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/draw", "Draw"],
  ["/pick", "Pick 7"],
  ["/matches", "Matches"],
  ["/table", "Table"],
  ["/stats", "Stats"],
  ["/rules", "Rules"],
  ["/admin", "Admin"],
] as const;

export function Nav() {
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
      </div>
    </header>
  );
}
