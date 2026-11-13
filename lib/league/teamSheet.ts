/** Reading the captains' WhatsApp team lists into a team sheet. Pure. */
import { ROSTER } from "@/config/club";
import type { Side } from "./types";

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, " ");

/**
 * Read the captains' WhatsApp lists. A line mentioning "white" or "red"
 * switches team; every roster name found after it goes to that team.
 * Returns the sides found and any lines with no recognisable name.
 */
export function parseTeamSheet(text: string): { sides: Record<string, Side>; unmatched: string[] } {
  const sides: Record<string, Side> = {};
  const unmatched: string[] = [];
  let current: Side | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = norm(raw);
    if (!line.trim()) continue;
    const words = ` ${line.replace(/\s+/g, " ")} `;
    const header = /\b(white|whites|team a)\b/.test(line) ? "A" : /\b(red|reds|team b)\b/.test(line) ? "B" : null;
    const found = ROSTER.filter((p) => words.includes(` ${norm(p.name).trim()} `));
    if (header) current = header;
    if (found.length && current) for (const p of found) sides[p.id] = current;
    else if (!header) unmatched.push(raw.trim());
  }
  return { sides, unmatched };
}

