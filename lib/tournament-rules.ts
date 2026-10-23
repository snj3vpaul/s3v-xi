import type { Role } from "./fantasy";

export const DEFAULT_MAX_PER_TEAM = 3;
export const DEFAULT_ROLE_COUNTS: Record<Role, number> = { WK: 2, BAT: 5, AR: 3, BOWL: 5 };

export type EligiblePlayer = {
  id: string;
  teamId: string;
  name: string;
  role: Role;
  available: boolean;
};

export type SubmittedSquad = {
  playerIds: string[];
  benchIds: string[];
  captainId: string;
  viceCaptainId: string;
};

/** This is also independently enforced in Postgres by a BEFORE INSERT/UPDATE trigger. */
export function validateTournamentSquad(
  selection: SubmittedSquad,
  pool: EligiblePlayer[],
  options: { maxPerTeam?: number; squadSize?: number; roles?: Record<Role, number> } = {}
): string[] {
  const { playerIds, benchIds, captainId, viceCaptainId } = selection;
  const maxPerTeam = options.maxPerTeam ?? DEFAULT_MAX_PER_TEAM;
  const size = options.squadSize ?? 15;
  const roles = options.roles ?? DEFAULT_ROLE_COUNTS;
  const issues: string[] = [];
  if (playerIds.length !== size || new Set(playerIds).size !== size) issues.push(`Select exactly ${size} different players.`);
  const candidates = new Map(pool.map((p) => [p.id, p]));
  const teams = new Map<string, number>();
  const roleCounts: Record<Role, number> = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
  for (const id of playerIds) {
    const player = candidates.get(id);
    if (!player) { issues.push(`Player ${id} is not registered in this tournament.`); continue; }
    if (!player.available) issues.push(`${player.name} is unavailable.`);
    teams.set(player.teamId, (teams.get(player.teamId) ?? 0) + 1);
    roleCounts[player.role]++;
  }
  for (const [teamId, count] of teams) {
    if (count > maxPerTeam) {
      const team = pool.find((p) => p.teamId === teamId)?.teamId ?? teamId;
      issues.push(`You can select a maximum of ${maxPerTeam} players from team ${team} (${count} selected).`);
    }
  }
  for (const role of Object.keys(roles) as Role[]) {
    if (roleCounts[role] !== roles[role]) issues.push(`Choose exactly ${roles[role]} ${role} players.`);
  }
  const expectedBenchSize = size - 11;
  if (benchIds.length !== expectedBenchSize || new Set(benchIds).size !== expectedBenchSize || benchIds.some((id) => !playerIds.includes(id))) {
    issues.push(`Choose exactly ${expectedBenchSize} different reserve players.`);
  }
  const startingIds = playerIds.filter((id) => !benchIds.includes(id));
  if (!captainId || !startingIds.includes(captainId)) issues.push("Choose a captain from your starting XI.");
  if (!viceCaptainId || viceCaptainId === captainId || !startingIds.includes(viceCaptainId)) issues.push("Choose a different vice-captain from your starting XI.");
  return issues;
}

export function teamCounts(selected: string[], pool: EligiblePlayer[]): Map<string, number> {
  const lookup = new Map(pool.map((p) => [p.id, p.teamId]));
  const result = new Map<string, number>();
  selected.forEach((id) => { const team = lookup.get(id); if (team) result.set(team, (result.get(team) ?? 0) + 1); });
  return result;
}
