import { NextResponse } from "next/server";
import { rulesFrom } from "@/lib/league/ledger";
import { buildPick7Table } from "@/lib/league/pick7Table";
import { handle } from "@/lib/server/http";
import { getState } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/**
 * The live Pick 7 table: names, status, points. Never which players anyone
 * picked — those stay hidden until the week locks.
 */
export const GET = handle(async () => {
  const state = await getState();
  const rows = buildPick7Table(state, rulesFrom(state.settings));
  return NextResponse.json({ rows, at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
});
