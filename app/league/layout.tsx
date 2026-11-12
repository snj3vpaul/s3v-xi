import type { Metadata } from "next";
import { themeScript } from "@/components/league/ThemeToggle";
import "./league.css";

export const metadata: Metadata = {
  title: "Predictor League | S3V XI",
  description: "A private, just-for-fun scoreline prediction league for friends. No money, no betting.",
  robots: { index: false, follow: false },
};

export default function LeagueLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      <div className="lg">{children}</div>
    </>
  );
}
