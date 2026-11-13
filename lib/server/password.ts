import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number }) => Promise<Buffer>;
const PARAMS = { N: 16384, r: 8, p: 1 };

export const MIN_PASSWORD = 8;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64, PARAMS);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, saltHex, hashHex] = stored.split("$");
  if (alg !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const got = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length, PARAMS);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/** Readable temporary password for admin resets, e.g. "kick-7Q4m-goal". */
export function tempPassword(): string {
  const words = ["kick", "goal", "post", "net", "volley", "header", "cross", "pitch", "boot", "bar"];
  const pick = () => words[randomBytes(1)[0] % words.length];
  return `${pick()}-${randomBytes(3).toString("base64url")}-${pick()}`;
}
