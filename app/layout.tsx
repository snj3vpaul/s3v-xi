import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "S3V XI",
  title: "S3V XI | Your League. Your Eleven.",
  description: "A free, cricket-first fantasy experience for community cricket leagues. Explore the fictional demo, build a squad and play strategy cards.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0C1925",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
