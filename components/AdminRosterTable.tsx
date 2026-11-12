'use client';
import { useMemo, useState } from 'react';
import { pageOf, visibleRoster, type RosterListRow } from '@/lib/admin-list';

type Team = {id: string; name: string};
type Props = {
  registrations: RosterListRow[];
  teams: Team[];
  editable: boolean;
  onEdit: (registration: RosterListRow) => void;
};
export function AdminRosterTable({ registrations, teams, editable, onEdit }: Props) {
  const [search, setSearch] = useState('');
  const [team, setTeam] = useState('all');
  const [role, setRole] = useState('all');
  const [availability, setAvailability] = useState('all');
  const [page, setPage] = useState(1);
  const names = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams]);
  const filtered = useMemo(() => visibleRoster(registrations, {search, team, role, availability}, names),
    [registrations, search, team, role, availability, names]);
  const results = pageOf(filtered, page);
  const change = (action: () => void) => { action(); setPage(1); };
  return <div>
    <div className="admin-table-filters">
      <label>Find player <input type="search" value={search} placeholder="Name or CricHeroes ID" onChange={(e) => change(() => setSearch(e.target.value))}/></label>
      <label>Cricket team <select value={team} onChange={(e) => change(() => setTeam(e.target.value))}>
        <option value="all">All teams</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select></label>
      <label>Role <select value={role} onChange={(e) => change(() => setRole(e.target.value))}>
        <option value="all">All roles</option>{['WK', 'BAT', 'AR', 'BOWL'].map((r) => <option key={r}>{r}</option>)}
      </select></label>
      <label>Availability <select value={availability} onChange={(e) => change(() => setAvailability(e.target.value))}>
        <option value="all">All players</option><option value="available">Available</option><option value="unavailable">Unavailable</option>
      </select></label>
    </div>
    <p role="status" className="helper">Showing {filtered.length} of {registrations.length} registrations — page {results.page} of {results.pages}.</p>
    <div className="import-preview"><table>
      <thead><tr><th>Player</th><th>Cricket team</th><th>Role</th><th>Available</th>{editable&&<th>Manage</th>}</tr></thead>
      <tbody>{results.rows.map((p) => <tr key={p.id}>
        <td>{p.s3v_players?.full_name ?? p.player_id}</td><td>{names.get(p.team_id) ?? 'Unknown team'}</td>
        <td>{p.role}</td><td>{p.available ? 'Yes' : 'No'}</td>
        {editable&&<td><button type="button" className="edit-inline" onClick={() => onEdit(p)}>EDIT</button></td>}
      </tr>)}</tbody>
    </table></div>
    {filtered.length===0&&<p>No players match these filters. Try another name or team.</p>}
    {results.pages>1&&<nav aria-label="Player roster pages" className="admin-pagination">
      <button type="button" disabled={results.page<=1} onClick={() => setPage((p) => Math.max(1,p-1))}>← Previous</button>
      <span>Page {results.page} / {results.pages}</span>
      <button type="button" disabled={results.page>=results.pages} onClick={() => setPage((p) => Math.min(results.pages,p+1))}>Next →</button>
    </nav>}
  </div>;
}
