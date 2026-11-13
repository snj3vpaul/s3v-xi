import { headers } from "next/headers";

/** Subscribe / download links for /calendar.ics (absolute URL from the request host). */
export async function CalendarLinks() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const https = `${proto}://${host}/calendar.ics`;
  const webcal = `webcal://${host}/calendar.ics`;
  return (
    <div className="row">
      <a className="btn btn-sm btn-primary" href={webcal}>Subscribe (Apple / Outlook)</a>
      <a className="btn btn-sm" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noreferrer">Add to Google Calendar</a>
      <a className="btn btn-sm" href={https} download="rsfc-league.ics">Download .ics</a>
    </div>
  );
}
