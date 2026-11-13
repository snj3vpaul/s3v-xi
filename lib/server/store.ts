/**
 * Storage for the single league document.
 *
 *  - Upstash Redis / Vercel KV (REST) when KV_REST_API_URL + KV_REST_API_TOKEN
 *    (or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN) are set. Writes use
 *    a tiny Lua compare-and-set on a version key, so two people saving at once
 *    can't overwrite each other — the loser retries against fresh state.
 *  - Otherwise a JSON file at .data/rsfc-league.json (local dev).
 *  - On Vercel without KV the filesystem is read-only, so it falls back to
 *    process memory and the UI shows a "storage not configured" banner.
 */
import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ensureSeries, migrate, type Ctx } from "@/lib/league/ledger";
import { SERIES } from "@/config/schedule";
import type { LeagueState } from "@/lib/league/types";

const KEY = process.env.RSFC_STORAGE_KEY || "rsfc:league";
const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const FILE = path.join(process.cwd(), ".data", "rsfc-league.json");

export type StorageMode = "redis" | "file" | "memory";
export const storageMode: StorageMode = REST_URL && REST_TOKEN ? "redis" : process.env.VERCEL ? "memory" : "file";

export class ConflictError extends Error {}

// ---- Redis (Upstash REST) -------------------------------------------------

async function redis(command: (string | number)[]): Promise<unknown> {
  const res = await fetch(REST_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${REST_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const body = (await res.json()) as { result?: unknown; error?: string };
  if (!res.ok || body.error) throw new Error(`Storage error: ${body.error ?? res.status}`);
  return body.result;
}

const CAS = `
local cur = redis.call('GET', KEYS[2])
if (cur or '0') ~= ARGV[2] then return 0 end
redis.call('SET', KEYS[1], ARGV[1])
redis.call('SET', KEYS[2], ARGV[3])
return 1`;

// ---- File / memory --------------------------------------------------------

let memory: LeagueState | null = null;
let fileLock: Promise<unknown> = Promise.resolve();

async function readFile(): Promise<LeagueState | null> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as LeagueState;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

async function writeFile(state: LeagueState) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state, null, 2));
  await fs.rename(tmp, FILE);
}

// ---- Public API -----------------------------------------------------------

async function readRaw(): Promise<LeagueState> {
  if (storageMode === "redis") {
    const raw = (await redis(["GET", KEY])) as string | null;
    return migrate(raw ? JSON.parse(raw) : null);
  }
  if (storageMode === "memory") return migrate(memory);
  return migrate(await readFile());
}

/**
 * Read the league. The first read after a new weekly series is configured
 * generates its fixtures (a one-off write).
 */
export async function getState(): Promise<LeagueState> {
  const s = await readRaw();
  if (!s.seriesCreated.includes(SERIES.id)) return mutate((x) => ensureSeries(x, ctx()));
  return s;
}

export function ctx(): Ctx {
  return { now: new Date(), newId: () => randomUUID() };
}

/**
 * Apply a pure transition and persist it. `fn` may run more than once (on a
 * concurrent-write conflict) so it must be pure — which every ledger function is.
 */
export async function mutate(fn: (s: LeagueState) => LeagueState): Promise<LeagueState> {
  if (storageMode === "redis") {
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await readRaw();
      const next = { ...fn(current), version: current.version + 1 };
      const ok = await redis(["EVAL", CAS, 2, KEY, `${KEY}:version`, JSON.stringify(next), String(current.version), String(next.version)]);
      if (ok === 1) return next;
    }
    throw new ConflictError("The league was being updated by someone else. Please try again.");
  }
  const run = async () => {
    const current = storageMode === "memory" ? migrate(memory) : migrate(await readFile());
    const next = { ...fn(current), version: current.version + 1 };
    if (storageMode === "memory") memory = next;
    else await writeFile(next);
    return next;
  };
  const p = fileLock.then(run, run);
  fileLock = p.catch(() => undefined);
  return p;
}
