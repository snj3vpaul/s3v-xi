import Link from "next/link";
import { CLUB } from "@/config/club";
import { SERIES } from "@/config/schedule";
import { currentSquad, nextDeadlineMatch } from "@/lib/league/ledger";
import { fmtKickoff } from "@/lib/league/schedule";
import type { User } from "@/lib/league/types";
import { getState } from "@/lib/server/store";

/** Site-wide nudge before each deadline (shown in the final 3 days). */
export async function DeadlineBanner({ user }: { user: User | null }) {
  const state = await getState();
  const now = new Date();
  const m = nextDeadlineMatch(state, now);
  if (!m) return null;
  const left = new Date(m.kickoffAt).getTime() - now.getTime();
  if (left > 3 * 86_400_000) return null;
  const when = fmtKickoff(m.kickoffAt, SERIES.timeZone);
  const squad = user ? currentSquad(user) : null;
  const warn = !user || !squad;
  return (
    <div className={`deadline-bar ${warn ? "warn" : ""}`} role="status">
      <div className="wrap">
        <span>
          <b>Pick 7 deadline: {when}.</b>{" "}
          {!user ? "Create an account to play." : !squad ? `You haven't picked your ${CLUB.picksPerSelector} yet.` : `Your ${CLUB.picksPerSelector} carries over — any changes?`}
        </span>
        <Link href={user ? "/team" : "/join"}>{!user ? "Join" : !squad ? "Pick now" : "Make changes"}</Link>
      </div>
    </div>
  );
}
