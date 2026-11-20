import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/fraunces/full-italic.css";
import "@fontsource-variable/manrope/index.css";
import "@fontsource-variable/jetbrains-mono/index.css";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { CHIPS, CLUB } from "@/config/club";
import { storageMode } from "@/lib/server/store";
import { currentUser } from "@/lib/server/session";
import { DeadlineBanner } from "@/components/DeadlineBanner";
import { Announcement } from "@/components/Announcement";
import { ANNOUNCEMENT } from "@/config/announcement";
import { SERIES } from "@/config/schedule";
import { DEFENCE_BONUS, GOAL_LABEL } from "@/lib/scoring/rules";
import { zonedToUtc } from "@/lib/league/schedule";
import { MotionRoot } from "@/components/motion/MotionRoot";
import Link from "next/link";
import { ClubLoader } from "@/components/loader/ClubLoader";
import { LOADER_KEY } from "@/lib/client/loaderGate";

export const metadata: Metadata = {
  title: { default: `${CLUB.leagueName} | ${CLUB.tagline}`, template: `%s · ${CLUB.leagueName}` },
  description: "RSFC's in-house league: White vs Red every Thursday, points from the scoresheet, and a Pick 7 fantasy game with a double-points captain.",
  applicationName: CLUB.leagueName,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#F5F0E6", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Repeat visit this session: hide the loader before first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(sessionStorage.getItem(${JSON.stringify(LOADER_KEY)})==="1")document.documentElement.classList.add("no-loader")}catch(e){}`,
          }}
        />
        <noscript><style>{`.club-loader{display:none!important}`}</style></noscript>
      </head>
      <body>
        <ClubLoader />
        <a className="skip-link" href="#content">Skip to content</a>
        {storageMode === "memory" && (
          <div className="banner">
            <div className="wrap">
              Storage isn&apos;t configured — changes will be lost on the next deploy. Connect Upstash Redis (see README).
            </div>
          </div>
        )}
        <Nav userName={user?.name ?? null} />
        {Date.now() < zonedToUtc(ANNOUNCEMENT.until, "23:59", SERIES.timeZone).getTime() && (
          <Announcement
            id={ANNOUNCEMENT.id}
            title={ANNOUNCEMENT.title}
            body={`goals now score by position (${GOAL_LABEL}), defenders and CMs get a defensive bonus (up to +${DEFENCE_BONUS.DEF![0][1]}, never a minus), and Pick 7 adds a vice-captain, a bench sub, ${CHIPS.triple_captain.label} and ${CHIPS.bench_boost.label}.`}
            href={ANNOUNCEMENT.href}
            linkText={ANNOUNCEMENT.linkText}
          />
        )}
        <DeadlineBanner user={user} />
        <div id="content" tabIndex={-1}>{children}</div>
        <MotionRoot />
        <footer className="site">
          <div className="wrap row spread">
            <span>
              {CLUB.leagueName} · free to play, for the club, by the club. Points are bragging rights only.
            </span>
            <span>
              Every figure comes from match-day scorecards entered by RSFC admins. <Link href="/admin">Admin</Link>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
