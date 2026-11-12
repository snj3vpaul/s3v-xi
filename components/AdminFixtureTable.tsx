'use client';
import { useMemo, useState } from 'react';
import { pageOf, visibleFixtures, type FixtureListRow } from '@/lib/admin-list';

type Team = { id: string; name: string };
type Props = { fixtures: FixtureListRow[]; teams: Team[]; timezone: string; editable: boolean; onEdit: (fixture: FixtureListRow) => void };
export function AdminFixtureTable({ fixtures, teams, timezone, editable, onEdit }: Props) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const names = useMemo(() => new Map(teams.map((team) => [team.id, team.name])), [teams]);
  const filtered = useMemo(() => visibleFixtures(fixtures, {search, status}, names), [fixtures, search, status, names]);
  const results = pageOf(filtered, page);
  return <div>
    <div className="admin-table-filters">
      <label>Find match <input type="search" value={search} placeholder="Match ID, ground, round, or team" onChange={(e) => {setSearch(e.target.value);setPage(1);}}/></label>
      <label>Match status <select value={status} onChange={(e) => {setStatus(e.target.value);setPage(1);}}>
        <option value="all">All statuses</option>{['scheduled','live','completed','postponed','cancelled','abandoned'].map((s) => <option key={s} value={s}>{s}</option>)}
      </select></label>
    </div>
    <p role="status" className="helper">Showing {filtered.length} of {fixtures.length} fixtures — page {results.page} of {results.pages}.</p>
    <div className="import-preview"><table>
      <thead><tr><th>Match</th><th>Scheduled ({timezone})</th><th>Teams</th><th>Venue</th><th>Status</th><th>Manage</th></tr></thead>
      <tbody>{results.rows.map((f) => <tr key={f.id}>
        <td>{f.match_id}</td><td>{new Date(f.starts_at).toLocaleString('en-CA', { timeZone:timezone })}</td>
        <td>{names.get(f.team_a_id) ?? '?'} vs {names.get(f.team_b_id) ?? '?'}</td>
        <td>{f.venue}</td><td>{f.status}</td>
        <td>{(editable || !['completed','cancelled','abandoned'].includes(f.status)) && <button type="button" className="edit-inline" onClick={() => onEdit(f)}>{editable?'EDIT':'STATUS'}</button>}</td>
      </tr>)}</tbody>
    </table></div>
    {filtered.length===0&&<p>No matches match these filters.</p>}
    {results.pages>1&&<nav aria-label="Fixture list pages" className="admin-pagination">
      <button type="button" disabled={results.page<=1} onClick={() => setPage((p) => Math.max(1,p-1))}>← Previous</button>
      <span>Page {results.page} / {results.pages}</span>
      <button type="button" disabled={results.page>=results.pages} onClick={() => setPage((p) => Math.min(results.pages,p+1))}>Next →</button>
    </nav>}
  </div>;
}
