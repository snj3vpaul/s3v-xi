/**
 * The site-wide announcement strip. Change `id` for a new announcement (so
 * people who dismissed the old one see it), and `until` to stop showing it.
 */
export const ANNOUNCEMENT = {
  id: "scoring-2026-11-26",
  /** Shown until the end of this club-local date. */
  until: "2026-12-03",
  title: "New scoring from Thu 26 Nov",
  href: "/rules",
  linkText: "See the new rules",
} as const;
