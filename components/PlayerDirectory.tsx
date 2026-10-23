"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { HISTORICAL_PLAYERS, TOURNAMENTS, formatRole, type HistoricalPlayer } from "@/lib/tournament";

type Sort = "runs" | "wickets" | "catches" | "matches";
const metrics: Array<{ key: Sort | "fours" | "sixes"; label: string }> = [
  { key: "matches", label: "Matches" }, { key: "runs", label: "Runs" }, { key: "fours", label: "Fours" },
  { key: "sixes", label: "Sixes" }, { key: "wickets", label: "Wickets" }, { key: "catches", label: "Catches" },
];

export function PlayerDirectory() {
  const [tournament, setTournament] = useState("1985886");
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("all");
  const [sort, setSort] = useState<Sort>("runs");
  const [limit, setLimit] = useState(60);
  const [comparison, setComparison] = useState<string[]>([]);
  const players = useMemo(() => HISTORICAL_PLAYERS.filter(p => p.tournamentId === tournament), [tournament]);
  const teams = useMemo(() => Array.from(new Set(players.map(p => p.team))).sort(), [players]);
  const shown = useMemo(() => players.filter(p => (team === "all" || p.team === team) && `${p.name} ${p.team} ${p.playerId}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b[sort] - a[sort] || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)), [players, team, query, sort]);
  const compared = comparison.map(id => players.find(p => p.id === id)).filter((p): p is HistoricalPlayer => !!p);

  function toggleCompare(id: string) {
    setComparison(prev => prev.includes(id) ? prev.filter(value => value !== id) : prev.length === 2 ? [prev[1], id] : [...prev, id]);
  }

  return <>
    <div className="directory-tools">
      <label className="calc-control"><span>Tournament</span><select value={tournament} onChange={e => {setTournament(e.target.value); setTeam("all"); setComparison([]); setLimit(60);}}>{TOURNAMENTS.map(t => <option value={t.id} key={t.id}>{t.name}</option>)}</select></label>
      <label className="calc-control"><span>Search name, club or ID</span><input value={query} onChange={e => {setQuery(e.target.value); setLimit(60);}} placeholder="Search the player pool"/></label>
      <label className="calc-control"><span>Cricket team</span><select value={team} onChange={e => {setTeam(e.target.value); setLimit(60);}}><option value="all">All clubs</option>{teams.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="calc-control"><span>Sort by</span><select value={sort} onChange={e => setSort(e.target.value as Sort)}><option value="runs">Most runs</option><option value="wickets">Most wickets</option><option value="catches">Most catches</option><option value="matches">Most matches</option></select></label>
    </div>
    <p className="directory-caption"><strong>{shown.length}</strong> player-team registration records · Historical tournament totals, not fantasy match points. <span>Roles marked "UNCONFIRMED" need admin verification. Compare two records from the same tournament using the controls below.</span></p>
    <section className="comparison-panel" aria-label="Player comparison">
      <div className="comparison-heading"><div><p className="kicker">SCOUTING DESK / SIDE BY SIDE</p><h3>COMPARE PLAYERS <small>{compared.length}/2</small></h3></div><button type="button" className="outline-btn" disabled={!comparison.length} onClick={() => setComparison([])}>CLEAR COMPARISON</button></div>
      {compared.length === 0 ? <p className="compare-empty">Open a player record and choose Compare. Select two to see their historical performance side by side.</p> :
        <div className="compare-grid">
          {compared.map(player => <div className="compare-player" key={player.id}><div><strong>{player.name}</strong><small>{player.team} · {formatRole(player.role)}</small></div><button type="button" aria-label={`Remove ${player.name} from comparison`} onClick={() => toggleCompare(player.id)}>×</button></div>)}
          {compared.length === 1 && <div className="compare-player compare-placeholder">Choose one more player to compare</div>}
          <div className="compare-metrics">{metrics.map(metric => <div className="compare-line" key={metric.key}><span>{metric.label}</span>{compared.map(player => <strong key={player.id}>{player[metric.key]}</strong>)}{compared.length === 1 && <strong>—</strong>}</div>)}</div>
        </div>}
      <p className="compare-footnote">Based on imported cumulative leaderboard figures only. No fantasy points, per-match form, or predictions are inferred.</p>
    </section>
    <div className="directory-table"><div className="directory-table-head"><span>PLAYER / TEAM</span><span>ROLE</span><span>MATCHES</span><span>RUNS</span><span>WICKETS</span><span>CATCHES</span><span>DETAIL</span></div>
      {shown.slice(0, limit).map(p => <details key={p.id} className="directory-record"><summary><span className="identity-block"><strong>{p.name}</strong><small>{p.team}</small></span><span className="directory-role">{formatRole(p.role)}</span><b>{p.matches}</b><b>{p.runs}</b><b>{p.wickets}</b><b>{p.catches}</b><span className="detail-chevron">＋</span></summary>
        <div className="directory-extra"><span>Player ID: {p.playerId}</span><span>SR: {p.strikeRate || "—"}</span><span>Economy: {p.economy || "—"}</span><span>4s: {p.fours}</span><span>6s: {p.sixes}</span>
          <button type="button" className="text-action" aria-pressed={comparison.includes(p.id)} onClick={() => toggleCompare(p.id)}>{comparison.includes(p.id) ? "✓ IN COMPARISON" : "＋ COMPARE"}</button>
          {tournament === "1985886" && ["Canterbury T20", "Kanata T20"].includes(p.team) && <Link href={`/match-centre?player=${encodeURIComponent(p.playerId)}`} className="text-action">ADD MATCH STATS ↗</Link>}
        </div>
      </details>)}
    </div>
    {shown.length > limit && <button type="button" className="outline-btn load-more" onClick={() => setLimit(value => value + 60)}>SHOW MORE PLAYERS ↓</button>}
    {shown.length === 0 && <p className="empty-message">No matching players. Try another club or search.</p>}
  </>;
}
