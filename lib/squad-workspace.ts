import { TARGET, MAX_PLAYERS_PER_TEAM, type Chip, type Player, type Role, validateSquad } from "./fantasy";

export const SQUAD_STORAGE_KEY = "s3v-xi:squad-demo:v1";
export interface SquadWorkspace {
  squadIds: string[];
  benchIds: string[];
  captain: string | null;
  vice: string | null;
  chip: Chip;
}

/** Treat local browser data as untrusted. A saved draft can be incomplete, but never malformed. */
export function parseSquadWorkspace(raw: string, pool: Player[]): SquadWorkspace | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const data = parsed as Record<string, unknown>;
    if (!Array.isArray(data.squadIds) || !Array.isArray(data.benchIds)) return null;
    if (![...data.squadIds, ...data.benchIds].every(x => typeof x === "string")) return null;
    const squadIds = data.squadIds as string[];
    const benchIds = data.benchIds as string[];
    if (squadIds.length > 15 || benchIds.length > 4) return null;
    if (new Set(squadIds).size !== squadIds.length || new Set(benchIds).size !== benchIds.length) return null;
    const known = new Map(pool.map(p => [p.id, p]));
    if (squadIds.some(id => !known.has(id)) || benchIds.some(id => !squadIds.includes(id))) return null;
    for (const role of Object.keys(TARGET) as Role[]) {
      if (squadIds.filter(id => known.get(id)?.role === role).length > TARGET[role]) return null;
    }
    if (squadIds.length - benchIds.length > 11) return null;
    const teamCounts = new Map<string,number>();
    squadIds.forEach(id => { const team = known.get(id)!.team; teamCounts.set(team,(teamCounts.get(team) ?? 0) + 1); });
    if ([...teamCounts.values()].some(count => count > MAX_PLAYERS_PER_TEAM)) return null;
    const starters = squadIds.filter(id => !benchIds.includes(id));
    const captain = data.captain === null || typeof data.captain === "string" ? data.captain as string | null : null;
    const vice = data.vice === null || typeof data.vice === "string" ? data.vice as string | null : null;
    if (captain && !starters.includes(captain)) return null;
    if (vice && (!starters.includes(vice) || vice === captain)) return null;
    if (![null, "full-squad", "skipper-x3"].includes(data.chip as string | null)) return null;
    return { squadIds, benchIds, captain, vice, chip: data.chip as Chip };
  } catch {
    return null;
  }
}

/** Atomic bench substitution. Unlike two manual moves, never causes an invalid 10/12 lineup. */
export function swapBenchPlayer(state: SquadWorkspace, starterId: string, reserveId: string): SquadWorkspace {
  if (!state.squadIds.includes(starterId) || !state.squadIds.includes(reserveId)) throw new Error("Both players must belong to the squad.");
  if (state.benchIds.includes(starterId) || !state.benchIds.includes(reserveId)) throw new Error("Choose one starter and one reserve.");
  return {
    ...state,
    benchIds: state.benchIds.map(id => id === reserveId ? starterId : id),
    captain: state.captain === starterId ? null : state.captain,
    vice: state.vice === starterId ? null : state.vice,
  };
}

export function isReady(state: SquadWorkspace, pool: Player[]): boolean {
  const squad = pool.filter(p => state.squadIds.includes(p.id));
  return validateSquad(squad, state.benchIds, state.captain, state.vice).length === 0;
}
