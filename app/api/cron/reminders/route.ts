import { NextResponse } from "next/server";
import { recordReminders } from "@/lib/league/ledger";
import { planReminders, reminderEmail } from "@/lib/league/reminders";
import { emailConfigured, sendEmail } from "@/lib/server/email";
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
  const sent: { userId: string; slot: string }[] = [];
  const failed: string[] = [];
  for (const r of plan) {
    try {
      if (await sendEmail(r.email, reminderEmail(r, base))) sent.push({ userId: r.userId, slot });
    } catch (e) {
      console.error(e);
      failed.push(r.userId);
    }
  }
  if (sent.length) await mutate((s) => recordReminders(s, plan[0].matchId, sent, ctx()));
  return NextResponse.json({ ok: true, slot, planned: plan.length, sent: sent.length, failed: failed.length });
}
