import { NextResponse } from "next/server";
import { rulesFrom } from "@/lib/league/ledger";
import { selectorBreakdown } from "@/lib/league/pick7Table";
import { handle } from "@/lib/server/http";
import { getState } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/** A selector's played rounds, itemised. Only locked-and-played picks, which are public anyway. */
export const GET = handle<{ id: string }>(async (_req, { id }) => {
  const state = await getState();
  return NextResponse.json(selectorBreakdown(state, rulesFrom(state.settings), id), { headers: { "Cache-Control": "no-store" } });
});
