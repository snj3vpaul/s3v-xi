/**
 * iCalendar feed for the weekly fixture. One recurring event (RRULE, so
 * calendars show "Weekly on Thursday"), EXDATEs for any weeks an admin has
 * removed, reminders (VALARM) for the Pick 7 deadline, plus any one-off
 * match days as their own events.
 */
import { SERIES, TEAM_NAMES } from "@/config/schedule";
import { weeklyDates, zonedToUtc } from "./schedule";
import type { MatchDay } from "./types";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const local = (date: string, time: string) => `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;

/** RFC 5545: lines longer than 75 octets are folded with CRLF + space. */
function fold(line: string): string {
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch, "utf8") > 74) {
      out.push(cur);
      cur = " " + ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n");
}

const TORONTO_VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:America/Toronto",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0400",
  "TZNAME:EDT",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0400",
  "TZOFFSETTO:-0500",
  "TZNAME:EST",
  "DTSTART:19701101T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

export function buildCalendar(matchDays: MatchDay[], opts: { baseUrl: string; now: Date; series?: typeof SERIES }): string {
  const series = opts.series ?? SERIES;
  const tz = series.timeZone;
  const dates = weeklyDates(series.start, series.end, series.weekday);
  const endTime = (() => {
    const [h, m] = series.time.split(":").map(Number);
    const t = h * 60 + m + series.durationMinutes;
    return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  })();
  const present = new Set(matchDays.filter((m) => m.seriesId === series.id).map((m) => m.date));
  const firstGenerated = dates.find((d) => present.has(d));
  // Weeks that were generated then deleted (or never generated because they'd passed) are excluded.
  const removed = dates.filter((d) => !present.has(d) && (!firstGenerated || d > firstGenerated));
  const startDate = firstGenerated ?? dates[0];
  const lastKick = zonedToUtc(dates.at(-1)!, series.time, tz);
  const desc = `${TEAM_NAMES.A} vs ${TEAM_NAMES.B} — teams drawn at random on the night.\nPick 7 deadline is kick-off: set or change your seven at ${opts.baseUrl}/team`;
  const stamp = utc(opts.now);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RSFC//RSFC League//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:RSFC League",
    `X-WR-TIMEZONE:${tz}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    ...TORONTO_VTIMEZONE,
    "BEGIN:VEVENT",
    `UID:${series.id}@rsfc-league`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${tz}:${local(startDate, series.time)}`,
    `DTEND;TZID=${tz}:${local(startDate, endTime)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=TH;UNTIL=${utc(lastKick)}`,
    ...(removed.length ? [`EXDATE;TZID=${tz}:${removed.map((d) => local(d, series.time)).join(",")}`] : []),
    `SUMMARY:${esc(series.title)}`,
    `DESCRIPTION:${esc(desc)}`,
    ...(series.location ? [`LOCATION:${esc(series.location)}`] : []),
    `URL:${opts.baseUrl}/team`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:-P1D",
    `DESCRIPTION:${esc("RSFC tomorrow 10pm — any changes to your Pick 7?")}`,
    "END:VALARM",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:-PT3H",
    `DESCRIPTION:${esc("RSFC tonight 10pm — last chance to change your Pick 7")}`,
    "END:VALARM",
    "END:VEVENT",
  ];
  for (const m of matchDays.filter((x) => !x.seriesId)) {
    const start = new Date(m.kickoffAt);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${m.id}@rsfc-league`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${utc(start)}`,
      `DTEND:${utc(new Date(start.getTime() + series.durationMinutes * 60_000))}`,
      `SUMMARY:${esc(m.label ? `RSFC League: ${m.label}` : series.title)}`,
      `URL:${opts.baseUrl}/matches/${m.id}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
