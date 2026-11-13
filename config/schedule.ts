/**
 * The weekly fixture: every Thursday, 10:00 pm Toronto time, White vs Red,
 * from the first Thursday after launch until summer (last Thursday before the
 * June solstice). Edit here to change the season; existing match days are kept.
 */
export const SERIES = {
  /** Change the id when you start a new series so fixtures are generated again. */
  id: "thursday-2026-27",
  title: "RSFC League: White vs Red",
  weekday: 4, // Thursday (0 = Sunday)
  time: "22:00",
  durationMinutes: 60,
  timeZone: "America/Toronto",
  /** First fixture (a Thursday). */
  start: "2026-11-19",
  /** Last fixture (a Thursday) — the last one before summer starts on 21 June 2027. */
  end: "2027-06-17",
  location: "",
} as const;

export const TEAM_NAMES = { A: "White", B: "Red" } as const;

/** Reminder sends (Vercel Cron, UTC). Wed ≈ 6 pm and Thu ≈ noon Toronto in winter. */
export const REMINDER_SLOTS = ["eve-before", "matchday"] as const;
export type ReminderSlot = (typeof REMINDER_SLOTS)[number];
