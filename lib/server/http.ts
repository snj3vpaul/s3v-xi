import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { LedgerError } from "@/lib/league/ledger";
import { ConflictError } from "./store";
import { isAdmin } from "./auth";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Reject cross-site writes: the Origin (when sent) must match this host. */
function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new HttpError(401, "Admin passcode required.");
}

export function handle<P>(fn: (req: NextRequest, params: P) => Promise<unknown>) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    try {
      if (req.method !== "GET" && !sameOrigin(req)) throw new HttpError(403, "Cross-site request blocked.");
      const out = await fn(req, await context.params);
      return out instanceof NextResponse ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof LedgerError) return NextResponse.json({ error: e.message, details: e.details }, { status: 400 });
      if (e instanceof ConflictError) return NextResponse.json({ error: e.message }, { status: 409 });
      console.error(e);
      return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
    }
  };
}

export async function body<T>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }
}
