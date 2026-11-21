import { NextResponse } from "next/server";
import { recordReminders } from "@/lib/league/ledger";
import { planReminders, reminderEmail } from "@/lib/league/reminders";
import { emailConfigured, sendEmail, sendPaced } from "@/lib/server/email";
import { ctx, getState, mutate } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/**
 * Called by Vercel Cron (see vercel.json) — Wednesday evening and Thursday
 * midday. Vercel sends `Authorization: Bearer $CRON_SECRET`. Safe to re-run:
 * each user gets at most one email per slot per match day.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const slot = url.searchParams.get("slot") || "manual";
  const base = process.env.PUBLIC_BASE_URL || url.origin;
  if (!emailConfigured()) return NextResponse.json({ ok: true, skipped: "RESEND_API_KEY not set" });

  const plan = planReminders(await getState(), new Date(), slot);
  const { sent, failed } = await sendPaced(plan, (r) => sendEmail(r.email, reminderEmail(r, base)));
  if (sent.length)
    await mutate((s) => recordReminders(s, plan[0].matchId, sent.map((r) => ({ userId: r.userId, slot })), ctx()));
  if (failed.length) {
    // One line per run, grouped by status, instead of a stack trace per recipient.
    const byStatus = new Map<number, number>();
    for (const f of failed) byStatus.set(f.status, (byStatus.get(f.status) ?? 0) + 1);
    const hint = byStatus.has(403) ? " (403: Resend only delivers to the account owner until a domain is verified)" : "";
    console.error(
      `[reminders] slot ${slot}: sent ${sent.length}/${plan.length}, failed ${failed.length} [${[...byStatus].map(([k, v]) => `${k}×${v}`).join(", ")}]${hint}. First: ${failed[0].message.slice(0, 200)}`,
    );
  }
  return NextResponse.json({ ok: true, slot, planned: plan.length, sent: sent.length, failed: failed.length });
}
