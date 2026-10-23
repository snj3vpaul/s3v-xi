"use client";

import { useEffect, useMemo, useState } from "react";
import { PLAYERS, START_BENCH, START_SQUAD } from "@/lib/demo";
import { TARGET, MAX_PLAYERS_PER_TEAM, validateSquad, scoreDemo, type Role, type Player } from "@/lib/fantasy";
import { SQUAD_STORAGE_KEY, parseSquadWorkspace, swapBenchPlayer, type SquadWorkspace } from "@/lib/squad-workspace";

const roles: (Role | "ALL")[] = ["ALL", "WK", "BAT", "AR", "BOWL"];
const start: SquadWorkspace = { squadIds: START_SQUAD, benchIds: START_BENCH, captain: "p03", vice: "p08", chip: null };

export function SquadDemo() {
  const [workspace, setWorkspace] = useState<SquadWorkspace>(start);
  const [hydrated, setHydrated] = useState(false);
  const [filter, setFilter] = useState<Role | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [swapReserve, setSwapReserve] = useState<string | null>(null);
  const [notice, setNotice] = useState("Pick your players, captain and strategy card.");
  const { squadIds, benchIds, captain, vice, chip } = workspace;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SQUAD_STORAGE_KEY);
      if (saved) {
        const recovered = parseSquadWorkspace(saved, PLAYERS);
        if (recovered) {
          setWorkspace(recovered);
          setNotice("Restored your demo squad from this browser.");
        } else {
          setNotice("Saved squad data was invalid; the sample lineup was restored.");
        }
      }
    } catch {
      setNotice("Browser storage is unavailable; changes will last only until refresh.");
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(SQUAD_STORAGE_KEY, JSON.stringify(workspace)); }
    catch { /* Browser storage disabled. Keep the draft in memory. */ }
  }, [workspace, hydrated]);

  const squad = useMemo(() => PLAYERS.filter(p => squadIds.includes(p.id)), [squadIds]);
  const starters = squad.filter(p => !benchIds.includes(p.id));
  const reserves = squad.filter(p => benchIds.includes(p.id));
  const issues = validateSquad(squad, benchIds, captain, vice);
  const ready = issues.length === 0;
  const base = ready ? scoreDemo(squad, benchIds, captain!, vice!, null) : null;
  const actual = ready ? scoreDemo(squad, benchIds, captain!, vice!, chip) : null;
  const counts = new Map<string, number>();
  squad.forEach(p => counts.set(p.team, (counts.get(p.team) ?? 0) + 1));
  const filteredPlayers = PLAYERS.filter(p => (filter === "ALL" || filter === p.role) && `${p.name} ${p.team}`.toLowerCase().includes(search.toLowerCase()));

  function selectPlayer(player: Player) {
    if (squadIds.includes(player.id)) {
      setWorkspace(prev => ({...prev,
        squadIds: prev.squadIds.filter(id => id !== player.id),
        benchIds: prev.benchIds.filter(id => id !== player.id),
        captain: prev.captain === player.id ? null : prev.captain,
        vice: prev.vice === player.id ? null : prev.vice
      }));
      setSwapReserve(null);
      return;
    }
    if (squadIds.length >= 15 || squad.filter(p => p.role === player.role).length >= TARGET[player.role]) return;
    if ((counts.get(player.team) ?? 0) >= MAX_PLAYERS_PER_TEAM) { setNotice(`You can select a maximum of 3 players from ${player.team}. Remove an existing player to add another.`); return; }
    setWorkspace(prev => ({...prev,
      squadIds: [...prev.squadIds, player.id],
      benchIds: prev.squadIds.length - prev.benchIds.length >= 11 ? [...prev.benchIds, player.id] : prev.benchIds,
    }));
  }

  function benchStarter(id: string) {
    if (swapReserve) {
      setWorkspace(prev => swapBenchPlayer(prev, id, swapReserve));
      setNotice("Lineup swapped. Reconfirm captaincy if the former captain or vice-captain moved to the bench.");
      setSwapReserve(null);
      return;
    }
    if (benchIds.length === 4) {
      setNotice("Bench is full. Choose a reserve first, then select the starter to replace.");
      return;
    }
    setWorkspace(prev => ({...prev,
      benchIds: [...prev.benchIds, id],
      captain: prev.captain === id ? null : prev.captain,
      vice: prev.vice === id ? null : prev.vice
    }));
  }

  function startReserve(id: string) {
    if (starters.length >= 11) {
      setSwapReserve(current => current === id ? null : id);
      setNotice("Choose a starting player to swap with this reserve, or select the reserve again to cancel.");
      return;
    }
    setWorkspace(prev => ({...prev, benchIds: prev.benchIds.filter(benchId => benchId !== id)}));
  }

  function resetDemo() {
    if (!window.confirm("Reset your locally saved fantasy demo squad and chips?")) return;
    setWorkspace(start); setSwapReserve(null); setSearch(""); setFilter("ALL");
    setNotice("Restored the original fictional demo squad.");
  }

  return <section className="workshop section" id="builder">
    <div className="section-head workshop-head">
      <div><p className="kicker">THE SELECTION ROOM / INTERACTIVE DEMO</p><h2>MAKE YOUR<br/><em>ELEVEN COUNT.</em></h2></div>
      <p className="demo-warning">● FICTIONAL DATA · {hydrated ? "SAVED IN THIS BROWSER" : "LOADING DEMO"}</p>
    </div>
    <div className="scoreboard">
      <div className="scoretop"><span>DEMO ROUND 01</span><span>OTTAWA COMMUNITY SERIES · FICTIONAL</span></div>
      <div className="scoremetrics"><div><small>ROUND POINTS</small><b>{actual?.total ?? "—"}</b></div><div><small>SELECTED</small><b>{squad.length}<i>/15</i></b></div><div><small>STARTING</small><b>{starters.length}<i>/11</i></b></div><div><small>ACTIVE CHIP</small><b className="chipname">{chip === "full-squad" ? "FULL SQUAD" : chip === "skipper-x3" ? "SKIPPER x3" : "NONE"}</b></div></div>
      {actual && base && chip && <p className="gain">STRATEGY IMPACT: <strong>+{actual.total - base.total} fictional demo pts</strong> versus no chip.</p>}
    </div>
    <div className="workshop-save"><p role="status" aria-live="polite">{notice}</p><button type="button" className="outline-btn" onClick={resetDemo}>RESET DEMO ↺</button></div>
    <div className="grid">
      <div className="surface">
        <div className="paneltitle"><div><p className="kicker">01 / SQUAD BUILDER</p><h3>YOUR PLAYER POOL</h3></div><small>2 WK · 5 BAT · 3 AR · 5 BOWL</small></div>
        <label className="calc-control player-search"><span>Find a player or team</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search 20 demo players" /></label>
        <div className="filters" role="group" aria-label="Filter player roles">{roles.map(role => <button type="button" key={role} className={filter === role ? "current" : ""} aria-pressed={filter === role} onClick={() => setFilter(role)}>{role === "ALL" ? "ALL PLAYERS" : role}</button>)}</div>
        <div className="pool-head"><span>PLAYER / CLUB</span><span>ROLE</span><span>PTS</span><span>SELECTION</span></div>
        {filteredPlayers.map(player => {
          const selected = squadIds.includes(player.id);
          const atTeamLimit = (counts.get(player.team) ?? 0) >= MAX_PLAYERS_PER_TEAM;
          const disabled = !selected && (squadIds.length >= 15 || squad.filter(p => p.role === player.role).length >= TARGET[player.role] || atTeamLimit);
          return <div className="poolrow" key={player.id}>
            <div className="person"><div className="avatar">{player.name.split(" ").map(s => s[0]).join("")}</div><div><strong>{player.name}</strong><small>{player.team} · {counts.get(player.team) ?? 0}/3</small></div></div>
            <span className="role">{player.role}</span><b className="pts">{player.points}</b>
            <button type="button" className={selected ? "add selected" : "add"} disabled={disabled} title={atTeamLimit && !selected ? `Maximum 3 players from ${player.team}` : undefined} onClick={() => selectPlayer(player)} aria-label={`${selected ? "Remove" : "Add"} ${player.name}`}>{selected ? "✓ ADDED" : atTeamLimit ? "TEAM 3/3" : disabled ? "FULL" : "+ ADD"}</button>
          </div>;
        })}
        {!filteredPlayers.length && <p className="empty-small">No players match your search.</p>}
      </div>
      <aside className="surface">
        <div className="paneltitle"><div><p className="kicker">02 / YOUR SELECTION</p><h3>STARTING XI</h3></div><small>{starters.length}/11</small></div>
        <p className="helper">Pick C and VC. To swap when the XI and bench are full, tap <strong>SWAP ↑</strong> beside a reserve, then <strong>↔</strong> beside the starter to replace.</p>
        {swapReserve && <p className="swap-prompt" role="status">SWAP MODE: Choose a starter below. <button type="button" onClick={() => setSwapReserve(null)}>CANCEL</button></p>}
        {starters.map((player, index) => <div className="xirow" key={player.id}>
          <span className="index">{String(index + 1).padStart(2, "0")}</span><div className="xiname"><strong>{player.name}</strong><small>{player.role} · {player.points} demo pts</small></div>
          <button type="button" className={captain === player.id ? "leader active" : "leader"} aria-label={`Captain: ${player.name}`} aria-pressed={captain === player.id} disabled={vice === player.id} onClick={() => setWorkspace(prev => ({...prev, captain: player.id}))}>C</button>
          <button type="button" className={vice === player.id ? "leader active" : "leader"} aria-label={`Vice-captain: ${player.name}`} aria-pressed={vice === player.id} disabled={captain === player.id} onClick={() => setWorkspace(prev => ({...prev, vice: player.id}))}>VC</button>
          <button type="button" className="move" aria-label={swapReserve ? `Swap ${player.name} with reserved player` : `Bench ${player.name}`} onClick={() => benchStarter(player.id)}>{swapReserve ? "↔" : "↓"}</button>
        </div>)}
        <div className="bench-head">THE BENCH <span>{benchIds.length}/4</span></div>
        {reserves.map(player => <div className="xirow" key={player.id}><span className="index">B</span><div className="xiname"><strong>{player.name}</strong><small>{player.role} · {player.points} demo pts</small></div><button type="button" className={swapReserve === player.id ? "move swap-active" : "move"} aria-pressed={swapReserve === player.id} onClick={() => startReserve(player.id)}>{starters.length >= 11 ? "SWAP ↑" : "START ↑"}</button></div>)}
        <div className={ready ? "notice ready" : "notice"} aria-live="polite"><strong>{ready ? "✓ YOUR XI IS READY" : "COMPLETE YOUR SQUAD"}</strong><p>{ready ? "Valid demonstration lineup. Changes are saved on this device only—not submitted to a league." : issues[0]}</p></div>
      </aside>
    </div>
    <div id="chips" className="chips"><div className="section-head"><div><p className="kicker">03 / STRATEGY DECK</p><h2>PLAY YOUR<br/><em>BEST CARD.</em></h2></div><p>Two strategic boosts. One round. Choose wisely. Every card is free.</p></div>
      <div className="chipgrid">
        <button type="button" aria-pressed={chip === "full-squad"} className={chip === "full-squad" ? "chip selected" : "chip"} onClick={() => setWorkspace(p => ({...p, chip: p.chip === "full-squad" ? null : "full-squad"}))}><span className="chiptop">01 / ONE ROUND <span>↗</span></span><b className="chipart">15<small>/15</small></b><strong>FULL SQUAD</strong><p>Count all four bench players alongside your starting XI.</p><span className="chipbottom">{chip === "full-squad" ? "✓ SELECTED" : "SELECT CARD"} ↗</span></button>
        <button type="button" aria-pressed={chip === "skipper-x3"} className={chip === "skipper-x3" ? "chip second selected" : "chip second"} onClick={() => setWorkspace(p => ({...p, chip: p.chip === "skipper-x3" ? null : "skipper-x3"}))}><span className="chiptop">02 / ONE ROUND <span>✳</span></span><b className="chipart">3<small>×</small></b><strong>SKIPPER x3</strong><p>Your captain scores triple instead of double.</p><span className="chipbottom">{chip === "skipper-x3" ? "✓ SELECTED" : "SELECT CARD"} ↗</span></button>
      </div>
      <p className="disclaimer">DEMO ONLY — THESE CHIP CHOICES ARE LOCAL PREVIEWS, NOT REDEMPTIONS. THE SERVER-SIDE INVENTORY, DEADLINES AND TRANSFERS ARE NOT BUILT YET.</p>
    </div>
  </section>;
}
