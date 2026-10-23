/** Format an ISO instant into YYYY-MM-DDTHH:mm in an IANA timezone. */
export function isoToLocalInput(instant: string, timezone: string): string {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid timestamp');
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const p: Record<string,string> = {};
  for (const part of parts) p[part.type] = part.value;
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Convert local tournament wall time into a UTC instant, rejecting nonexistent DST times. */
export function localTournamentTimeToIso(local: string, timezone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(local)) throw new Error('Use YYYY-MM-DDTHH:mm');
  const [y,m,d,h,min] = local.match(/\d+/g)!.map(Number);
  const target = Date.UTC(y,m-1,d,h,min);
  if (new Date(target).toISOString().slice(0,16)!==local) throw new Error('Invalid calendar date');
  let ms = target;
  for (let iteration=0; iteration<5; iteration++) {
    const seen=isoToLocalInput(new Date(ms).toISOString(),timezone);
    const [sy,sm,sd,sh,smin]=seen.match(/\d+/g)!.map(Number);
    const difference=target-Date.UTC(sy,sm-1,sd,sh,smin);
    if (!difference) return new Date(ms).toISOString();
    ms+=difference;
  }
  if (isoToLocalInput(new Date(ms).toISOString(),timezone)!==local) throw new Error('This local time does not exist due to daylight saving time.');
  return new Date(ms).toISOString();
}
