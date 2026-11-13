import { NextResponse } from "next/server";
import { handle, requireAdmin } from "@/lib/server/http";
import { getState } from "@/lib/server/store";

/** Admin backup: the whole league document as JSON. */
export const GET = handle(async () => {
  await requireAdmin();
  const state = await getState();
  return new NextResponse(JSON.stringify(state, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="rsfc-league-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
});
