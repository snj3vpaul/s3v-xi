"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {MATCH_POOL_BY_ID} from "@/lib/tournament";
import {STORAGE_KEY,type MatchEntry} from "@/lib/match-store";
import {scoreMatchFigures,validateFigures} from "@/lib/scoring";
export function PlayerPointsLeaderboard(){
 const [entries,setEntries]=useState<MatchEntry[]>([]),[ready,setReady]=useState(false),[team,setTeam]=useState("all");
 useEffect(()=>{
  try{const raw=localStorage.getItem(STORAGE_KEY);if(raw){const parsed=JSON.parse(raw) as {entries?:MatchEntry[]};setEntries((parsed.entries||[]).filter(e=>e&&e.figures&&MATCH_POOL_BY_ID.has(e.figures.playerId)&&!validateFigures(e.figures).length));}}
  catch{setEntries([])}
  setReady(true);
 },[]);
 const rows=useMemo(()=>entries.map(e=>{const player=MATCH_POOL_BY_ID.get(e.figures.playerId)!;return {entry:e,player,score:scoreMatchFigures(e.figures,player.role)}}).filter(x=>team==="all"||x.player.team===team).sort((a,b)=>b.score.total-a.score.total),[entries,team]);
 return <><div className="source-warning"><strong>LOCAL PLAYER RANKINGS — NOT A GLOBAL FANTASY LEAGUE</strong><span>These are base points for players entered in your browser's Canterbury–Kanata match workspace. No other users' fantasy XI selections are included.</span></div><div className="leader-tools"><div className="calc-control"><label htmlFor="leader-team">Team</label><select id="leader-team" value={team} onChange={e=>setTeam(e.target.value)}><option value="all">Both teams</option><option>Canterbury T20</option><option>Kanata T20</option></select></div><Link href="/match-centre" className="outline-btn">EDIT MATCH SCORES ↗</Link></div>
 {!ready?<div className="empty-match">Loading saved match scores…</div>:rows.length===0?<div className="empty-match"><strong>NO ENTRIES TO RANK.</strong><p>Open the Match Centre and enter a player's score or load the clearly labelled illustrative example first.</p><Link href="/match-centre" className="primary action-save">OPEN MATCH CENTRE ↗</Link></div>:<div className="leaderboard-list">{rows.map(({player,score,entry},i)=><Link key={entry.figures.playerId} href={`/match-centre?player=${encodeURIComponent(player.playerId)}`} className="leaderboard-item"><span className="leader-position">{String(i+1).padStart(2,"0")}</span><span className="leader-identity"><strong>{player.name}</strong><small>{player.team} · {entry.origin==="illustrative"?"ILLUSTRATIVE DATA":"UNVERIFIED INPUT"}</small></span><span className="leader-splits">{score.batting} BAT · {score.bowling} BOWL · {score.fielding} FIELD</span><span className="leader-points">{score.total}<small>PTS</small></span><span className="detail-chevron">↗</span></Link>)}</div>}
 </>;
}
