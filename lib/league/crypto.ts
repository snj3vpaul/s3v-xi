import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";

/** scrypt (memory-hard, built into Node) — N=2^15, r=8, p=1, 64-byte key, 16-byte salt. */
const N = 32768, R = 8, P = 1, KEYLEN = 64, MAXMEM = 96 * 1024 * 1024;

function derive(password: string, salt: Buffer, n = N, r = R, p = P): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEYLEN, { N: n, r, p, maxmem: MAXMEM }, (err, key) => (err ? reject(err) : resolve(key))));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, "base64url");
  const actual = await derive(password, Buffer.from(salt, "base64url"), Number(n), Number(r), Number(p));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function newSessionToken(): string { return randomBytes(32).toString("base64url"); }
export function sha256(value: string): string { return createHash("sha256").update(value).digest("hex"); }

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion
export function newInviteCode(length = 8): string {
  let out = "";
  for (let i = 0; i < length; i++) out += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
  return out;
}

export function sameInviteCode(a: string, b: string): boolean {
  const x = Buffer.from(a.trim().toUpperCase()), y = Buffer.from(b.trim().toUpperCase());
  return x.length === y.length && timingSafeEqual(x, y);
}
