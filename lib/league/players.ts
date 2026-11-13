import { ROSTER } from "@/config/club";
import type { LeagueState } from "./types";

/** Roster players not yet linked to another account (for the sign-up / account pickers). */
export function claimablePlayers(state: LeagueState, exceptUserId?: string) {
  const taken = new Set(state.users.filter((u) => u.id !== exceptUserId && u.playerId).map((u) => u.playerId));
  return ROSTER.filter((p) => !taken.has(p.id)).map((p) => ({ id: p.id, name: p.name, dropin: p.kind === "dropin" }));
}
