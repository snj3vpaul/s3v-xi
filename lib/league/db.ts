import { mkdirSync } from "node:fs";
import path from "node:path";
import { SCHEMA, POSTGRES_ONLY } from "./schema";

/**
 * A deliberately tiny SQL adapter so the league runs with zero setup (SQLite, built into
 * Node 22) and in production on Postgres (e.g. Supabase) by setting DATABASE_URL.
 *
 * All SQL is written once with `?` placeholders and parameters are always passed
 * separately — never interpolated — so queries are injection-safe on both engines.
 */
export type Row = Record<string, unknown>;
export type Param = string | number | null;
export interface Db {
  dialect: "sqlite" | "postgres";
  all<T = Row>(sql: string, params?: Param[]): Promise<T[]>;
  get<T = Row>(sql: string, params?: Param[]): Promise<T | undefined>;
  run(sql: string, params?: Param[]): Promise<void>;
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  close?(): Promise<void>;
}

type Holder = { db?: Promise<Db>; ready?: Promise<Db> };
const globalHolder = globalThis as unknown as { __leagueDb?: Holder };
const holder: Holder = (globalHolder.__leagueDb ??= {});

export function storageMode(): { engine: "sqlite" | "postgres"; persistent: boolean } {
  if (process.env.DATABASE_URL) return { engine: "postgres", persistent: true };
  return { engine: "sqlite", persistent: !process.env.VERCEL };
}

function toPg(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export async function openPostgres(url: string): Promise<Db> {
  const { default: postgres } = await import("postgres");
  // prepare:false keeps us compatible with Supabase's transaction pooler (port 6543).
  const sql = postgres(url, { max: 5, prepare: false, idle_timeout: 20, onnotice: () => {} });
  type Runner = { unsafe: (query: string, params?: never[]) => PromiseLike<unknown> };
  const wrap = (q: Runner, root: typeof sql | null): Db => {
    const all = async <T,>(text: string, params: Param[] = []) => (await q.unsafe(toPg(text), params as never[])) as T[];
    return {
      dialect: "postgres",
      all,
      get: async <T,>(text: string, params: Param[] = []) => (await all<T>(text, params))[0],
      run: async (text, params = []) => { await q.unsafe(toPg(text), params as never[]); },
      tx: async <T,>(fn: (db: Db) => Promise<T>): Promise<T> => {
        if (!root) return fn(wrap(q, null)); // already inside a transaction
        return (await root.begin((t) => fn(wrap(t as unknown as Runner, null)))) as T;
      },
    };
  };
  return { ...wrap(sql as unknown as Runner, sql), close: () => sql.end({ timeout: 2 }) };
}

export async function openSqlite(fileOverride?: string): Promise<Db> {
  const { DatabaseSync } = await import("node:sqlite");
  const file = fileOverride ?? process.env.LEAGUE_SQLITE_PATH
    ?? (process.env.VERCEL ? "/tmp/league.sqlite" : path.join(process.cwd(), ".data", "league.sqlite"));
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const conn = new DatabaseSync(file);
  conn.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;");
  const plain = (r: unknown) => ({ ...(r as Row) });
  let lock: Promise<unknown> = Promise.resolve();
  const base = {
    dialect: "sqlite" as const,
    all: async <T,>(text: string, params: Param[] = []) => conn.prepare(text).all(...params).map(plain) as T[],
    get: async <T,>(text: string, params: Param[] = []) => { const r = conn.prepare(text).get(...params); return (r ? plain(r) : undefined) as T | undefined; },
    run: async (text: string, params: Param[] = []) => { conn.prepare(text).run(...params); },
  };
  const inner: Db = { ...base, tx: (fn) => fn(inner) };
  return {
    ...base,
    close: async () => conn.close(),
    // Serialise transactions on the single connection so concurrent requests can't interleave.
    tx: <T,>(fn: (db: Db) => Promise<T>) => {
      const next = lock.then(async () => {
        conn.exec("BEGIN IMMEDIATE");
        try { const out = await fn(inner); conn.exec("COMMIT"); return out; }
        catch (err) { conn.exec("ROLLBACK"); throw err; }
      });
      lock = next.catch(() => undefined);
      return next;
    },
  };
}

export async function migrate(db: Db) {
  for (const statement of SCHEMA) await db.run(statement);
  if (db.dialect === "postgres") for (const statement of POSTGRES_ONLY) await db.run(statement);
}

/** Get the ready-to-use database (schema migrated, demo data seeded when appropriate). */
export function getDb(): Promise<Db> {
  if (!holder.ready) {
    holder.ready = (async () => {
      holder.db ??= process.env.DATABASE_URL ? openPostgres(process.env.DATABASE_URL) : openSqlite();
      const db = await holder.db;
      await migrate(db);
      const { ensureLeague } = await import("./seed");
      await ensureLeague(db);
      return db;
    })().catch((err) => { holder.ready = undefined; throw err; });
  }
  return holder.ready;
}
