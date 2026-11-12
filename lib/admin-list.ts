/** Pure filters shared by tournament admin tables and tests. No player identities are inferred. */
export type RosterListRow = {
  id: string;
  player_id: string;
  team_id: string;
  role: string;
  available: boolean;
  s3v_players: { full_name: string; cricheroes_id: string | null } | null;
};
export type FixtureListRow = {
  id: string;
  match_id: string;
  team_a_id: string;
  team_b_id: string;
  venue: string;
  round_name: string;
  status: string;
  starts_at: string;
};
export const ADMIN_PAGE_SIZE = 25;

export function visibleRoster(
  rows: RosterListRow[],
  opts: { search: string; team: string; role: string; availability: string },
  teamNames: ReadonlyMap<string, string>
): RosterListRow[] {
  const q = opts.search.trim().toLocaleLowerCase();
  return rows.filter((r) => {
    if (opts.team !== 'all' && r.team_id !== opts.team) return false;
    if (opts.role !== 'all' && r.role !== opts.role) return false;
    if (opts.availability === 'available' && !r.available) return false;
    if (opts.availability === 'unavailable' && r.available) return false;
    if (!q) return true;
    return [r.s3v_players?.full_name ?? '', r.s3v_players?.cricheroes_id ?? '', r.player_id, teamNames.get(r.team_id) ?? '']
      .some((s) => s.toLocaleLowerCase().includes(q));
  }).sort((a, b) => (a.s3v_players?.full_name ?? '').localeCompare(b.s3v_players?.full_name ?? ''));
}

export function visibleFixtures(
  rows: FixtureListRow[],
  opts: { search: string; status: string },
  teamNames: ReadonlyMap<string, string>
): FixtureListRow[] {
  const q = opts.search.trim().toLocaleLowerCase();
  return rows.filter((f) => (opts.status === 'all' || f.status === opts.status) && (!q ||
    [f.match_id, f.venue, f.round_name, teamNames.get(f.team_a_id) ?? '', teamNames.get(f.team_b_id) ?? '']
      .some((s) => s.toLocaleLowerCase().includes(q))));
}

export function pageOf<T>(rows: T[], page: number, size = ADMIN_PAGE_SIZE): { rows: T[]; pages: number; page: number } {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const safePage = Math.max(1, Math.min(Number.isFinite(page) ? Math.trunc(page) : 1, pages));
  return { rows: rows.slice((safePage - 1) * size, safePage * size), pages, page: safePage };
}
