'use client';
import Link from 'next/link';
import { useCallback,useEffect,useMemo,useState } from 'react';
import { appFetch, clientAuth } from '@/lib/client-api';
import { teamCounts, validateTournamentSquad, type EligiblePlayer, type SubmittedSquad } from '@/lib/tournament-rules';
import type {Role} from '@/lib/fantasy';
type Team={id:string;name:string};
type Registration={id:string;player_id:string;team_id:string;role:Role;available:boolean;s3v_players:{id:string;full_name:string;cricheroes_id:string|null}|null};
type Fixture={id:string;match_id:string;starts_at:string;team_a_id:string;team_b_id:string;round_name:string;venue:string;status:string;scorecard_url:string|null};
type Tournament={id:string;name:string;season:number;description:string;format:string;status:string;timezone:string;registration_deadline:string|null;max_per_team:number;squad_size:number};
type Data={tournament:Tournament;teams:Team[];registrations:Registration[];fixtures:Fixture[]};
const roleCounts:Record<Role,number>={WK:2,BAT:5,AR:3,BOWL:5};
export function TournamentExperience({id}:{id:string}){
 const [data,setData]=useState<Data|null>(null);const [message,setMessage]=useState('Loading tournament…');const [search,setSearch]=useState('');const [filter,setFilter]=useState<Role|'ALL'>('ALL');
 const [squad,setSquad]=useState<SubmittedSquad>({playerIds:[],benchIds:[],captainId:'',viceCaptainId:''});
 const [signedIn,setSignedIn]=useState(false);const [saved,setSaved]=useState(false);const [busy,setBusy]=useState(false);const [swap,setSwap]=useState<string|null>(null);
 const load=useCallback(async()=>{
  try{
   const response=await appFetch(`/api/tournaments/${id}`) as Data;setData(response);setMessage('');
   const db=clientAuth();const auth=await db?.auth.getSession();const hasUser=!!auth?.data.session;setSignedIn(hasUser);
   if(hasUser){const state=await appFetch(`/api/tournaments/${id}/squad`) as {squad:{player_ids:string[];bench_ids:string[];captain_id:string;vice_captain_id:string}|null};
    if(state.squad){setSquad({playerIds:state.squad.player_ids,benchIds:state.squad.bench_ids,captainId:state.squad.captain_id,viceCaptainId:state.squad.vice_captain_id});setSaved(true);}
   }
  }catch(error){setMessage((error as Error).message);}
 },[id]);
 useEffect(()=>{void load();},[load]);
 const pool=useMemo<EligiblePlayer[]>(()=>data?.registrations.map(r=>({id:r.player_id,teamId:r.team_id,name:r.s3v_players?.full_name??r.player_id,role:r.role,available:r.available}))??[],[data]);
 const byId=new Map(pool.map(p=>[p.id,p]));const teams=new Map(data?.teams.map(t=>[t.id,t.name])??[]);
 const counts=teamCounts(squad.playerIds,pool);
 const issues=data?validateTournamentSquad(squad,pool,{maxPerTeam:data.tournament.max_per_team,squadSize:data.tournament.squad_size}):[];
 const starters=squad.playerIds.filter(id=>!squad.benchIds.includes(id));
 const max=data?.tournament.max_per_team??3;
 const locked=!data||!['upcoming','active'].includes(data.tournament.status)||(data.tournament.registration_deadline?Date.now()>=Date.parse(data.tournament.registration_deadline):false);
 function change(update:SubmittedSquad){setSquad(update);setSaved(false);}
 function togglePlayer(player:EligiblePlayer){
  const has=squad.playerIds.includes(player.id);
  if(has){change({...squad,playerIds:squad.playerIds.filter(id=>id!==player.id),benchIds:squad.benchIds.filter(id=>id!==player.id),captainId:squad.captainId===player.id?'':squad.captainId,viceCaptainId:squad.viceCaptainId===player.id?'':squad.viceCaptainId});return;}
  if(counts.get(player.teamId)===max){setMessage(`You can select a maximum of ${max} players from ${teams.get(player.teamId)}. Remove an existing player to add another.`);return;}
  if(squad.playerIds.length>=15||squad.playerIds.filter(id=>byId.get(id)?.role===player.role).length>=roleCounts[player.role]||!player.available)return;
  change({...squad,playerIds:[...squad.playerIds,player.id],benchIds:starters.length>=11?[...squad.benchIds,player.id]:squad.benchIds});setMessage('');
 }
 function swapIntoStarting(benchId:string){
  if(!starters.length)return;
  if(starters.length<11){change({...squad,benchIds:squad.benchIds.filter(id=>id!==benchId)});return;}
  setSwap(benchId===swap?null:benchId);setMessage('Choose a starting player to exchange with the highlighted reserve.');
 }
 function moveToBench(starterId:string){
  if(swap){change({...squad,benchIds:squad.benchIds.map(id=>id===swap?starterId:id),captainId:squad.captainId===starterId?'':squad.captainId,viceCaptainId:squad.viceCaptainId===starterId?'':squad.viceCaptainId});setSwap(null);setMessage('Swap completed. Reconfirm leadership if necessary.');return;}
  if(squad.benchIds.length>=4){setMessage('Your bench is full. Select a reserve to swap first.');return;}
  change({...squad,benchIds:[...squad.benchIds,starterId],captainId:squad.captainId===starterId?'':squad.captainId,viceCaptainId:squad.viceCaptainId===starterId?'':squad.viceCaptainId});
 }
 async function save(){setBusy(true);try{await appFetch(`/api/tournaments/${id}/squad`,{method:'PUT',body:JSON.stringify(squad)});setSaved(true);setMessage('Your fantasy squad was saved securely for this tournament.');}catch(error){setMessage((error as Error).message);}finally{setBusy(false);}}
 if(!data)return <main className="section modern-page"><p role="status">{message}</p></main>;
 const t=data.tournament;
 const filtered=pool.filter(p=>(filter==='ALL'||p.role===filter)&&`${p.name} ${teams.get(p.teamId)??''}`.toLowerCase().includes(search.toLowerCase()));
 return <main className="section modern-page"><p className="kicker"><Link href="/tournaments">TOURNAMENTS</Link> / {t.season} / {t.format}</p><h1 className="page-display">{t.name.toUpperCase()}<em> XI.</em></h1><p className="intro-copy">{t.description||'A free community fantasy cricket tournament.'}</p>
 <div className="toolbar"><span className="status-tag">{t.status.toUpperCase()}</span><span>{data.teams.length} clubs · {pool.length} players · {data.fixtures.length} fixtures · Max {max} per club</span><Link className="outline-btn" href="/login">{signedIn?'ACCOUNT':'SIGN IN TO SAVE'}</Link></div>
 <div className="admin-grid"><section className="surface"><h2 className="admin-title">PARTICIPATING TEAMS</h2><div className="team-admin-list">{data.teams.map(team=><p key={team.id}><strong>{team.name}</strong><span>{data.registrations.filter(r=>r.team_id===team.id).length} registered · {counts.get(team.id)??0}/{max} selected</span></p>)}</div><h2 className="admin-title">FIXTURES</h2>{data.fixtures.length?data.fixtures.map(f=><div className="fixture-row" key={f.id}><strong>{teams.get(f.team_a_id)} vs {teams.get(f.team_b_id)}</strong><span>{new Date(f.starts_at).toLocaleString('en-CA',{timeZone:t.timezone})} · {f.venue} · {f.status}</span>{f.scorecard_url&&<a href={f.scorecard_url} target="_blank" rel="noreferrer">Official scorecard ↗</a>}</div>):<p>Fixtures have not been published yet.</p>}</section>
 <section className="surface"><h2 className="admin-title">BUILD YOUR FANTASY SQUAD</h2><p>15 total: 2 WK, 5 BAT, 3 AR, 5 BOWL. Select no more than <strong>{max}</strong> players from any one cricket team. Exactly 11 starters, four reserves.</p>
 {t.registration_deadline&&<p><strong>Selection deadline:</strong> {new Date(t.registration_deadline).toLocaleString('en-CA',{timeZone:t.timezone})} ({t.timezone})</p>}
 {locked&&<p className="import-errors">Selections are currently locked for this tournament.</p>}
 <div className="toolbar"><input aria-label="Search players" placeholder="Search players or teams" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Player role" value={filter} onChange={e=>setFilter(e.target.value as Role|'ALL')}><option value="ALL">All roles</option>{Object.keys(roleCounts).map(role=><option key={role}>{role}</option>)}</select></div>
 <p className="kicker">SELECTED: {squad.playerIds.length}/15</p>
 <div className="player-choice-list">{filtered.map(player=>{const chosen=squad.playerIds.includes(player.id);const teamFull=(counts.get(player.teamId)??0)>=max;const roleFull=squad.playerIds.filter(id=>byId.get(id)?.role===player.role).length>=roleCounts[player.role];const disabled=locked||!player.available||(!chosen&&(squad.playerIds.length>=15||teamFull||roleFull));return <div className="player-choice" key={player.id}><div><strong>{player.name}</strong><span>{teams.get(player.teamId)} · {player.role} · {counts.get(player.teamId)??0}/{max} selected</span></div><button type="button" className="outline-btn" disabled={disabled} title={!chosen&&teamFull?`Maximum ${max} from ${teams.get(player.teamId)}`:undefined} onClick={()=>togglePlayer(player)}>{chosen?'REMOVE':teamFull?'TEAM FULL':'+ ADD'}</button></div>})}</div>
 </section></div>
 <section className="surface lineup-edit"><h2 className="admin-title">STARTING XI & BENCH</h2><div className="admin-grid"><div><h3>STARTING XI ({starters.length}/11)</h3>{starters.map(id=>{const p=byId.get(id)!;return <div className="xirow" key={id}><div className="xiname"><strong>{p.name}</strong><small>{teams.get(p.teamId)} · {p.role}</small></div><button type="button" className={squad.captainId===id?'leader active':'leader'} disabled={locked||squad.viceCaptainId===id} onClick={()=>change({...squad,captainId:id})}>C</button><button type="button" className={squad.viceCaptainId===id?'leader active':'leader'} disabled={locked||squad.captainId===id} onClick={()=>change({...squad,viceCaptainId:id})}>VC</button><button className="move" disabled={locked} onClick={()=>moveToBench(id)}>{swap?'↔':'↓'}</button></div>})}</div><div><h3>RESERVES ({squad.benchIds.length}/4)</h3>{squad.benchIds.map(id=>{const p=byId.get(id)!;return <div className="xirow" key={id}><div className="xiname"><strong>{p.name}</strong><small>{teams.get(p.teamId)} · {p.role}</small></div><button disabled={locked} className="outline-btn" onClick={()=>swapIntoStarting(id)}>{swap===id?'SELECTED':starters.length>=11?'SWAP ↑':'START ↑'}</button></div>})}{swap&&<p role="status">Select the starting player you want to replace.</p>}</div></div>
 {issues.length>0&&<div className="response-note"><strong>Complete your team before saving:</strong><ul>{issues.slice(0,5).map((issue,i)=><li key={i}>{issue.replace(/team ([0-9a-f-]{36})/i,(_,teamId:string)=>teams.get(teamId)||teamId)}</li>)}</ul></div>}
 <div className="toolbar"><button type="button" className="primary" disabled={locked||busy||!signedIn||issues.length>0||saved} onClick={save}>{busy?'SAVING…':saved?'✓ SQUAD SAVED':'SAVE FANTASY SQUAD ↗'}</button><span>{!signedIn?'Sign in to submit a squad.':saved?'All changes saved securely.':'Unsaved changes are not submitted.'}</span></div>
 {message&&<p className="response-note" role="status">{message}</p>}
 </section><p className="disclaimer">Tournament rosters, match data and fantasy squads are stored separately. Historical CricHeroes leaderboards are scouting references and do not award match points.</p></main>;
}
