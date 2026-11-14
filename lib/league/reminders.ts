/**
 * Weekly "any team changes?" reminders — like FPL's deadline emails.
 * Pure planning: who should get which message for the next deadline.
 */
import { CLUB, playerName } from "@/config/club";
import { SERIES, TEAM_NAMES } from "@/config/schedule";
import { currentSquad, nextDeadlineMatch } from "./ledger";
import { isFormationValid } from "./pick7";
import { fmtKickoff } from "./schedule";
import type { LeagueState } from "./types";

export interface PlannedReminder {
  userId: string;
  email: string;
  name: string;
  matchId: string;
  kind: "no_team" | "carry_over" | "fix_team";
  picks: string[] | null;
  kickoffAt: string;
}

/** Remind within this window before the deadline. */
export const REMIND_WITHIN_MS = 48 * 3_600_000;

export function planReminders(state: LeagueState, now: Date, slot: string): PlannedReminder[] {
  const m = nextDeadlineMatch(state, now);
  if (!m) return [];
  const msLeft = new Date(m.kickoffAt).getTime() - now.getTime();
  if (msLeft <= 0 || msLeft > REMIND_WITHIN_MS) return [];
  const sent = new Set((m.reminders ?? []).filter((r) => r.slot === slot).map((r) => r.userId));
  return state.users
    .filter((u) => u.emailReminders && !sent.has(u.id))
    .map((u) => {
      const picks = currentSquad(u);
      const kind = !picks ? "no_team" : isFormationValid(picks) ? "carry_over" : "fix_team";
      return { userId: u.id, email: u.email, name: u.name, matchId: m.id, kind, picks, kickoffAt: m.kickoffAt };
    });
}

export function reminderEmail(r: PlannedReminder, baseUrl: string): { subject: string; text: string; html: string } {
  const when = fmtKickoff(r.kickoffAt, SERIES.timeZone);
  const first = r.name.split(" ")[0];
  const fixture = `${TEAM_NAMES.A} vs ${TEAM_NAMES.B}`;
  const subject =
    r.kind === "no_team"
      ? `RSFC: pick your ${CLUB.picksPerSelector} before ${when}`
      : r.kind === "fix_team"
        ? `RSFC: your ${CLUB.picksPerSelector} needs updating before ${when}`
        : `RSFC: any changes to your ${CLUB.picksPerSelector}? Deadline ${when}`;
  const list = r.picks?.map(playerName).join(", ");
  const body =
    r.kind === "no_team"
      ? `You haven't picked your ${CLUB.picksPerSelector} yet. Pick them before kick-off and you'll bank every point they score.`
      : r.kind === "fix_team"
        ? `Pick 7 now uses a formation: 2 defenders, 2 CMs, 1 CAM and 2 attackers, within a star budget. Your current ${CLUB.picksPerSelector} doesn't fit it, so it won't be entered until you update it.`
        : `Your ${CLUB.picksPerSelector} carries over unless you change it: ${list}.`;
  const link = `${baseUrl}/team`;
  const text = `Hi ${first},\n\n${fixture} kicks off ${when}. ${body}\n\nMake changes: ${link}\n\nTurn these emails off any time at ${baseUrl}/account`;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#0c1925">
<p>Hi ${first},</p>
<p><b>${fixture}</b> kicks off <b>${when}</b>. ${body}</p>
<p><a href="${link}" style="display:inline-block;background:#3fd38a;color:#0c1925;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700">${r.kind === "no_team" ? "Pick my 7" : r.kind === "fix_team" ? "Fix my 7" : "Make changes"}</a></p>
<p style="color:#6b7a8c;font-size:13px">RSFC League · <a href="${baseUrl}/account" style="color:#6b7a8c">turn off reminder emails</a></p></div>`;
  return { subject, text, html };
}
