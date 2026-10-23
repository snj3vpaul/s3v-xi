import { EMPTY_FIGURES, NUMBER_FIELDS, type MatchFigures } from "./scoring";

export const MATCH_URL = "https://cricheroes.com/scorecard/24540875/t20-division-2026/canterbury-t20-vs-kanata-t20/summary";
export const STORAGE_KEY = "s3v-xi:match:24540875:v2";
export type EntryOrigin = "manual" | "csv" | "illustrative";
export interface MatchEntry { figures: MatchFigures; origin: EntryOrigin }
export interface MatchWorkspace { entries: MatchEntry[]; lastSaved: string | null }

export function parseMatchCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i+1] === '"') { field += '"'; i++; }
      else if (char === '"') inQuotes = false;
      else field += char;
    } else if (char === '"') inQuotes = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (char !== "\r") field += char;
  }
  if (inQuotes) throw new Error("CSV has an unclosed quoted field.");
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [headers, ...values] = rows.filter(row => row.some(v => v.trim()));
  if (!headers) throw new Error("The CSV is empty.");
  const keys = headers.map(h => h.trim().replace(/^\uFEFF/, ""));
  const expected = ["player_id", ...NUMBER_FIELDS, "dismissed", "played"];
  const missing = expected.filter(key=>!keys.includes(key));
  if (missing.length) throw new Error(`The CSV is missing columns: ${missing.join(", ")}. Download the provided match template.`);
  if (new Set(keys).size !== keys.length) throw new Error("Duplicate CSV headers are not allowed.");
  return values.map((row, i) => {
    if (row.length !== keys.length) throw new Error(`CSV row ${i + 2} has the wrong number of columns.`);
    return Object.fromEntries(keys.map((key, j) => [key, row[j].trim()]));
  });
}

export function csvRowsToEntries(rows: Array<Record<string, string>>, eligiblePlayerIds: Set<string>): MatchEntry[] {
  const found = new Set<string>();
  return rows.map((row, index) => {
    const id = row.player_id;
    if (!eligiblePlayerIds.has(id)) throw new Error(`Row ${index+2}: player_id ${id || "(blank)"} is not in the selected teams' 2026 roster.`);
    if (found.has(id)) throw new Error(`Row ${index+2}: duplicate player_id ${id}.`);
    found.add(id);
    const figures: MatchFigures = {...EMPTY_FIGURES, playerId: id};
    for (const key of NUMBER_FIELDS) {
      const value = row[key] ?? "0";
      if (!/^\d+$/.test(value)) throw new Error(`Row ${index+2}: ${key} must be a non-negative whole number.`);
      figures[key] = Number(value);
    }
    const dismissed = (row.dismissed || "false").toLowerCase();
    const played = (row.played || "true").toLowerCase();
    if (!["true", "false", "1", "0"].includes(dismissed) || !["true", "false", "1", "0"].includes(played)) throw new Error(`Row ${index+2}: dismissed and played must be true or false.`);
    figures.dismissed = dismissed === "true" || dismissed === "1";
    figures.played = played === "true" || played === "1";
    return {figures, origin: "csv"};
  });
}

export function downloadMatchCsv(entries: MatchEntry[]): string {
  const headers = ["player_id", ...NUMBER_FIELDS, "dismissed", "played"];
  const rows = entries.map(({figures}) => headers.map(key => String(key === "player_id" ? figures.playerId : figures[key as keyof MatchFigures])).join(","));
  return [headers.join(","), ...rows].join("\r\n") + "\r\n";
}
