import type { Metadata, Viewport } from "next";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/700-italic.css";
import "@fontsource/barlow-condensed/800.css";
import "@fontsource/barlow-condensed/800-italic.css";
import "@fontsource-variable/inter/index.css";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { CLUB } from "@/config/club";
import { storageMode } from "@/lib/server/store";
import { currentUser } from "@/lib/server/session";
import { DeadlineBanner } from "@/components/DeadlineBanner";

export const metadata: Metadata = {
  title: { default: `${CLUB.leagueName} | ${CLUB.tagline}`, template: `%s · ${CLUB.leagueName}` },
  description: "RSFC's in-house league: random teams every match day, points only from the scoresheet, and a pick-7 prediction game.",
  applicationName: CLUB.leagueName,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0C1925", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body>
        {storageMode === "memory" && (
          <div className="banner">
            <div className="wrap">
              Storage isn&apos;t configured — changes will be lost on the next deploy. Connect Upstash Redis (see README).
            </div>
          </div>
        )}
        <Nav userName={user?.name ?? null} />
        <DeadlineBanner user={user} />
        {children}
        <footer className="site">
          <div className="wrap row spread">
            <span>
              {CLUB.leagueName} · free to play, for the club, by the club. Points are bragging rights only.
            </span>
            <span>Every figure comes from match-day scorecards entered by RSFC admins.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
