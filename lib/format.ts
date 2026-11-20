/** Display helpers shared by server pages and client components. Pure, no deps. */

// Match dates are stored as "YYYY-MM-DD"; noon UTC keeps the calendar day in every zone.
const day = (iso: string) => new Date(`${iso}T12:00:00Z`);
const LONG = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const SHORT = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });

/** "Thu, Nov 20" */
export const fmtDate = (iso: string) => LONG.format(day(iso));
/** "Nov 20" */
export const shortDate = (iso: string) => SHORT.format(day(iso));
