import "server-only";

export class EmailError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Resend ${status}: ${body}`);
  }
}

/** Resend allows 10 requests a second; keep well under it. */
export const SEND_GAP_MS = 120;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Send via Resend's REST API (no SDK). Returns false when email isn't configured.
 * A 429 (rate limit) is retried once after the wait Resend asks for.
 */
export async function sendEmail(to: string, msg: { subject: string; text: string; html: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.REMINDER_FROM || "RSFC League <onboarding@resend.dev>";
  const body = JSON.stringify({ from, to: [to], subject: msg.subject, text: msg.text, html: msg.html });
  for (let attempt = 0; ; attempt++) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body,
    });
    if (res.ok) return true;
    if (res.status === 429 && attempt === 0) {
      await sleep(Math.min(5000, 1000 * (Number(res.headers.get("retry-after")) || 1)));
      continue;
    }
    throw new EmailError(res.status, await res.text());
  }
}

export const emailConfigured = () => !!process.env.RESEND_API_KEY;

/** Send one message after another, spaced under Resend's rate limit. Never throws. */
export async function sendPaced<T>(
  items: readonly T[],
  send: (item: T) => Promise<boolean>,
): Promise<{ sent: T[]; failed: { item: T; status: number; message: string }[] }> {
  const sent: T[] = [];
  const failed: { item: T; status: number; message: string }[] = [];
  for (let i = 0; i < items.length; i++) {
    if (i > 0) await sleep(SEND_GAP_MS);
    try {
      if (await send(items[i])) sent.push(items[i]);
    } catch (e) {
      failed.push({ item: items[i], status: e instanceof EmailError ? e.status : 0, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return { sent, failed };
}
