export type ImportKind = "teams" | "players" | "fixtures";
export const FIELDS: Record<ImportKind, { key: string; label: string; required: boolean }[]> = {
  teams: [{ key: "name", label: "Cricket Team", required: true }],
  players: [
    { key: "external_id", label: "Player ID", required: false },
    { key: "name", label: "Player Name", required: true },
    { key: "team", label: "Cricket Team", required: true },
    { key: "role", label: "Role", required: true },
    { key: "available", label: "Available (true/false)", required: false },
  ],
  fixtures: [
    { key: "match_id", label: "Match ID", required: true },
    { key: "match_date", label: "Match Date (YYYY-MM-DD)", required: true },
    { key: "match_time", label: "Match Time (HH:mm)", required: true },
    { key: "team_a", label: "Team A", required: true },
    { key: "team_b", label: "Team B", required: true },
    { key: "venue", label: "Venue", required: false },
    { key: "round", label: "Round", required: false },
    { key: "status", label: "Status", required: false },
  ],
};
export type ImportRow = Record<string, string>;

export function importErrors(kind: ImportKind, rows: ImportRow[], teamNames: string[] = []): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();
  const teams = new Set(teamNames.map((name) => name.toLowerCase().trim()));
  if (rows.length > 2000) issues.push("Import at most 2,000 rows at a time.");
  if (!rows.length) issues.push("File contains no data rows.");
  rows.forEach((row, index) => {
    const line = index + 2;
    for (const field of FIELDS[kind]) if (field.required && !row[field.key]?.trim()) issues.push(`Row ${line}: missing ${field.label}.`);
    const identity = kind === "teams" ? row.name?.toLowerCase().trim()
      : kind === "fixtures" ? row.match_id?.trim().toLowerCase()
      : row.external_id?.trim() ? `id:${row.external_id.trim()}` : `name:${row.name?.toLowerCase().trim()}`;
    if (identity && seen.has(identity)) issues.push(`Row ${line}: duplicate ${identity}.`);
    if (identity) seen.add(identity);
    if (kind === "players") {
      if (!['WK','BAT','AR','BOWL'].includes((row.role ?? '').toUpperCase().trim())) issues.push(`Row ${line}: role must be WK, BAT, AR, or BOWL.`);
      if (row.team && !teams.has(row.team.toLowerCase().trim())) issues.push(`Row ${line}: ${row.team} is not a registered cricket team.`);
      if (row.available && !['true','false','yes','no','1','0'].includes(row.available.toLowerCase().trim())) issues.push(`Row ${line}: availability must be true or false.`);
    }
    if (kind === "fixtures") {
      if (row.team_a && !teams.has(row.team_a.toLowerCase().trim())) issues.push(`Row ${line}: unknown Team A (${row.team_a}).`);
      if (row.team_b && !teams.has(row.team_b.toLowerCase().trim())) issues.push(`Row ${line}: unknown Team B (${row.team_b}).`);
      if (row.team_a && row.team_a.toLowerCase().trim() === row.team_b?.toLowerCase().trim()) issues.push(`Row ${line}: teams must differ.`);
      if (row.match_date && (!/^\d{4}-\d{2}-\d{2}$/.test(row.match_date) || Number.isNaN(Date.parse(`${row.match_date}T12:00:00Z`)))) issues.push(`Row ${line}: use YYYY-MM-DD date.`);
      if (row.match_time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.match_time)) issues.push(`Row ${line}: use 24-hour HH:mm time.`);
      if (row.status && !['scheduled','live','completed','postponed','cancelled','abandoned'].includes(row.status.toLowerCase())) issues.push(`Row ${line}: invalid match status.`);
    }
  });
  return issues;
}

export function canonicalRows(kind: ImportKind, rows: ImportRow[]): ImportRow[] {
  return rows.map(row => {
    const normalized: ImportRow = {};
    for (const field of FIELDS[kind]) normalized[field.key] = (row[field.key] ?? '').trim();
    if (kind === 'players') {
      normalized.role = normalized.role.toUpperCase();
      normalized.available = ['false','no','0'].includes(normalized.available.toLowerCase()) ? 'false' : 'true';
    }
    if (kind === 'fixtures') normalized.status = normalized.status.toLowerCase() || 'scheduled';
    return normalized;
  });
}

export function csvTemplate(kind: ImportKind): string {
  const values: Record<ImportKind, string[]> = {
    teams: ['Canterbury T20'],
    players: ['24540875,Aarav Example,Canterbury T20,BAT,true'],
    fixtures: ['24540875,2027-05-01,13:00,Canterbury T20,Kanata T20,Ottawa Ground,Round 1,scheduled'],
  };
  return FIELDS[kind].map((f) => f.key).join(',') + '\n' + values[kind][0] + '\n';
}
