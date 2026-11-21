import { NextResponse } from "next/server";
import { rulesFrom } from "@/lib/league/ledger";
import { selectorBreakdown } from "@/lib/league/pick7Table";
import { managerHistory, publicHistory } from "@/lib/league/gameweeks";
import { handle } from "@/lib/server/http";
import { currentUserIn } from "@/lib/server/session";
import { getState } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/**
 * A selector's played rounds, itemised, plus their team-selection history by gameweek.
 * Locked weeks are public anyway; for the open week only the owner sees which players
 * changed, everyone else sees counts.
 */
export const GET = handle<{ id: string }>(async (_req, { id }) => {
  const state = await getState();
  const me = await currentUserIn(state);
  const rules = rulesFrom(state.settings);
  const rows = managerHistory(state, rules, id, new Date());
  const history = me?.id === id ? rows : publicHistory(rows);
  return NextResponse.json({ ...selectorBreakdown(state, rules, id), history }, { headers: { "Cache-Control": "no-store" } });
});
