"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import {MATCH_POOL,MATCH_POOL_BY_ID,formatRole} from "@/lib/tournament";
import {MATCH_URL,STORAGE_KEY,csvRowsToEntries,downloadMatchCsv,parseMatchCsv,type MatchEntry} from "@/lib/match-store";
import {EMPTY_FIGURES,NUMBER_FIELDS,FIELD_LABELS,scoreMatchFigures,validateFigures,type MatchFigures} from "@/lib/scoring";
const initialPlayerId = MATCH_POOL.find(p=>p.team==="Canterbury T20")?.playerId || MATCH_POOL[0]?.playerId || "";
const initial:MatchFigures={...EMPTY_FIGURES,playerId:initialPlayerId};
function makeIllustrative():MatchEntry[]{
  const canterbury=MATCH_POOL.filter(p=>p.team==="Canterbury T20").slice(0,3);
  const kanata=MATCH_POOL.filter(p=>p.team==="Kanata T20").slice(0,3);
  const patterns=[{runs:62,fours:8,sixes:2,wickets:0,maidens:0,catches:1},{runs:18,fours:2,sixes:0,wickets:2,maidens:0,catches:0},{runs:0,fours:0,sixes:0,wickets:1,maidens:1,catches:1},{runs:40,fours:4,sixes:1,wickets:0,maidens:0,catches:0},{runs:9,fours:1,sixes:0,wickets:2,maidens:0,catches:1},{runs:29,fours:2,sixes:1,wickets:0,maidens:0,catches:0}];
  return [...canterbury,...kanata].map((p,i)=>({figures:{...EMPTY_FIGURES,playerId:p.playerId,...patterns[i]},origin:"illustrative"}));
}
export function MatchCentre(){
 const [entries,setEntries]=useState<MatchEntry[]>([]);
 const [selectedId,setSelectedId]=useState(initialPlayerId);
 const [draft,setDraft]=useState<MatchFigures>(initial);
 const [teamFilter,setTeamFilter]=useState("all");
 const [note,setNote]=useState("Select a player and enter figures from a verified match scorecard.");
 const [hydrated,setHydrated]=useState(false);
 const fileInput=useRef<HTMLInputElement>(null);
 const selected=MATCH_POOL_BY_ID.get(selectedId);
 const allRows=useMemo(()=>entries.map(entry=>({entry,player:MATCH_POOL_BY_ID.get(entry.figures.playerId),score:entry.figures.playerId&&MATCH_POOL_BY_ID.get(entry.figures.playerId) ? scoreMatchFigures(entry.figures,MATCH_POOL_BY_ID.get(entry.figures.playerId)!.role):null})).filter(x=>x.player&&x.score).sort((a,b)=>b.score!.total-a.score!.total||a.player!.name.localeCompare(b.player!.name)),[entries]);
 const sampleOnly=entries.length>0&&entries.every(x=>x.origin==="illustrative");
 const invalid=validateFigures(draft);
 const liveScore=invalid.length?null:scoreMatchFigures(draft,selected?.role??null);
 const totalPoints=allRows.reduce((n,r)=>n+r.score!.total,0);
 const saveEntries=useCallback((next:MatchEntry[],message:string)=>{
  setEntries(next);
  try {localStorage.setItem(STORAGE_KEY,JSON.stringify({entries:next,lastSaved:new Date().toISOString()}));setNote(message);} catch {setNote("Saved to this view, but browser storage is unavailable. Data will disappear after a reload.");}
 },[]);
 useEffect(()=>{
  try {
   const saved=localStorage.getItem(STORAGE_KEY);
   if(saved){const parsed=JSON.parse(saved) as {entries?:MatchEntry[]};const safe=(parsed.entries||[]).filter(e=>e&&e.figures&&MATCH_POOL_BY_ID.has(e.figures.playerId)&&![...validateFigures(e.figures)].length&&["manual","csv","illustrative"].includes(e.origin));
     setEntries(safe); if(safe.length) setNote(`Restored ${safe.length} locally saved entries. These are not published scores.`);
   }
  } catch {setNote("Could not read local match entries. Starting with an empty workspace.");}
  const wanted=new URLSearchParams(window.location.search).get("player");
  if(wanted&&MATCH_POOL_BY_ID.has(wanted)) setSelectedId(wanted);
  setHydrated(true);
 },[]);
 useEffect(()=>{
  const existing=entries.find(e=>e.figures.playerId===selectedId);
  setDraft(existing?{...existing.figures}:{...EMPTY_FIGURES,playerId:selectedId});
 // When choosing a player, display its saved figures. Saving is explicit.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[selectedId,entries]);
 function saveCurrent(){
  if(invalid.length){setNote(invalid.join(" "));return;}
  const next=entries.filter(e=>e.figures.playerId!==selectedId).concat({figures:{...draft},origin:"manual"});
  saveEntries(next,`Saved manually entered figures for ${selected?.name || "player"}. Not independently verified.`);
 }
 function removeCurrent(){const next=entries.filter(e=>e.figures.playerId!==selectedId);saveEntries(next,"Removed player figures from this browser's match workspace.");setDraft({...EMPTY_FIGURES,playerId:selectedId});}
 function clearAll(){if(window.confirm("Clear all locally entered figures for this match?")){saveEntries([],"Cleared local match entries.");setDraft({...EMPTY_FIGURES,playerId:selectedId});}}
 function loadSamples(){if(entries.length&&!window.confirm("Replace your current match entries with illustrative demo statistics?"))return;const next=makeIllustrative();saveEntries(next,"Loaded FICTIONAL demonstration figures for six real player identities. These are not the CricHeroes match result.");const item=next.find(x=>x.figures.playerId===selectedId);setDraft(item?{...item.figures}:{...EMPTY_FIGURES,playerId:selectedId});}
 async function upload(file:File){
  try{
   if(file.size>500000)throw new Error("Maximum supported CSV size is 500 KB.");
   const raw=await file.text();
   const next=csvRowsToEntries(parseMatchCsv(raw),new Set(MATCH_POOL.map(p=>p.playerId)));
   next.forEach(entry=>{const issues=validateFigures(entry.figures);if(issues.length)throw new Error(`Player ${entry.figures.playerId}: ${issues.join(" ")}`);});
   if(entries.length&&!window.confirm("Replace your currently saved match entries with this CSV file?"))return;
   saveEntries(next,`Imported ${next.length} CSV rows. Review against the official scorecard before using these figures.`);
   const entry=next.find(x=>x.figures.playerId===selectedId);
   setDraft(entry?{...entry.figures}:{...EMPTY_FIGURES,playerId:selectedId});
  }catch(e){setNote(e instanceof Error?e.message:"CSV import failed.");}
  finally{if(fileInput.current)fileInput.current.value="";}
 }
 function exportCurrent(){const csv=downloadMatchCsv(entries);const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="s3v-xi-match-24540875.csv";a.click();URL.revokeObjectURL(url);}
 return <>
 <div className="match-info"><div><p className="kicker">REFERENCE MATCH / CRICHEROES</p><h3>CANTERBURY T20 <span>vs</span> KANATA T20</h3><p>T20 Division 2026 · CricHeroes scorecard ID 24540875</p></div><a href={MATCH_URL} target="_blank" rel="noopener noreferrer" className="external-source">VIEW ORIGINAL SCORECARD ↗</a></div>
 <div className="source-warning"><strong>NOT AN AUTOMATIC CRICHEROES FEED</strong><span>The linked match statistics could not be verified here. Enter official figures yourself or import an authorized match CSV. Your entries stay in this browser and are never shown as independently verified official results.</span></div>
 <div className="import-toolbar"><a href="/templates/match-24540875.csv" download className="outline-btn">↓ DOWNLOAD CSV TEMPLATE</a><button type="button" className="outline-btn" onClick={()=>fileInput.current?.click()}>↑ IMPORT MATCH CSV</button><input type="file" accept=".csv,text/csv" className="visually-hidden" ref={fileInput} onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f)}} aria-label="Upload match statistics CSV"/><button type="button" className="outline-btn" onClick={exportCurrent} disabled={!entries.length}>↓ EXPORT ENTRIES</button><button type="button" className="outline-btn" onClick={loadSamples}>LOAD ILLUSTRATIVE EXAMPLE</button><button type="button" className="outline-btn danger-btn" onClick={clearAll} disabled={!entries.length}>CLEAR ENTRIES</button></div>
 <p className="workspace-feedback" role="status" aria-live="polite">{!hydrated?"Loading saved entries…":note}</p>
 <div className="match-stats-strip"><div><small>PLAYERS ENTERED</small><strong>{entries.length}</strong></div><div><small>BASE FANTASY POINTS</small><strong>{totalPoints}</strong></div><div><small>RECORD STATUS</small><strong className="status-text">{entries.length?sampleOnly?"SAMPLE ONLY":"UNVERIFIED":"EMPTY"}</strong></div></div>
 <div className="match-work-grid"><section className="surface"><div className="paneltitle"><div><p className="kicker">01 / MANUAL SCORECARD</p><h3>PLAYER PERFORMANCE</h3></div></div>
 <div className="two-selectors"><div className="calc-control"><label htmlFor="match-team">Filter team</label><select id="match-team" value={teamFilter} onChange={e=>{setTeamFilter(e.target.value);const newSelected=MATCH_POOL.find(p=>e.target.value==="all"||p.team===e.target.value);if(newSelected)setSelectedId(newSelected.playerId)}}><option value="all">Both teams</option><option>Canterbury T20</option><option>Kanata T20</option></select></div><div className="calc-control"><label htmlFor="match-player">Select player</label><select id="match-player" value={selectedId} onChange={e=>setSelectedId(e.target.value)}>{MATCH_POOL.filter(p=>teamFilter==="all"||p.team===teamFilter).map(p=><option value={p.playerId} key={p.playerId}>{p.name} · {p.team.replace(" T20","")}</option>)}</select></div></div>
 {selected&&<div className="chosen-player"><strong>{selected.name}</strong><span>{selected.team} · {formatRole(selected.role)} · ID {selected.playerId}</span><small>Historical form (entire tournament): {selected.runs} runs, {selected.wickets} wickets · NOT match points</small>{!selected.role&&<em>Role unconfirmed: no duck deduction unless verified BAT/AR.</em>}</div>}
 <div className="figure-inputs match-inputs">{NUMBER_FIELDS.map(key=><div key={key} className="calc-control"><label htmlFor={"match-"+key}>{FIELD_LABELS[key]}</label><input id={"match-"+key} type="number" min="0" step="1" value={draft[key]} onChange={e=>setDraft(previous=>({...previous,[key]:Number(e.target.value)}))}/></div>)}</div>
 <div className="toggle-grid"><label><input type="checkbox" checked={draft.dismissed} onChange={e=>setDraft(p=>({...p,dismissed:e.target.checked}))}/> Dismissed</label><label><input type="checkbox" checked={draft.played} onChange={e=>setDraft(p=>({...p,played:e.target.checked}))}/> Participated</label></div>
 {invalid.length>0&&<p className="validation-message" role="alert">{invalid.join(" ")}</p>}
 <div className="form-actions"><button type="button" className="primary action-save" disabled={invalid.length>0} onClick={saveCurrent}>SAVE PLAYER POINTS ↗</button><button type="button" className="outline-btn" disabled={!entries.some(e=>e.figures.playerId===selectedId)} onClick={removeCurrent}>REMOVE ENTRY</button></div>
 </section><aside className="calc-result match-live"><p className="kicker">02 / INSTANT PREVIEW</p><span className="metric-caption">BASE MATCH POINTS</span><strong className="large-result">{liveScore?liveScore.total:"—"}</strong><p className="result-note">Click save to add this player's match figures to the local leaderboard.</p>{liveScore&&["Batting","Bowling","Fielding"].map(category=><div className="result-category" key={category}><h4>{category} <span>{liveScore[category.toLowerCase() as "batting"|"bowling"|"fielding"]}</span></h4>{liveScore.lines.filter(l=>l.category===category).map(l=><div className="breakdown-row" key={l.key}><span>{l.description} <small>({l.count} × {l.rate})</small></span><strong>{l.points>0?"+":""}{l.points}</strong></div>)}</div>)}</aside></div>
 <div className="match-results"><div className="section-head match-list-head"><div><p className="kicker">03 / POINTS TABLE</p><h2>MATCH<br/><em>RANKINGS.</em></h2></div><p>Sorted by calculated BASE player points, not fantasy manager rank. Click any row to see where the points came from.</p></div>
 {allRows.length===0?<div className="empty-match"><strong>NO MATCH SCORES YET.</strong><p>Add a player, import a match CSV, or load illustrative examples to test the scoring engine.</p></div>:<div className="match-ranking-table"><div className="ranking-head"><span>RANK / PLAYER</span><span>BAT</span><span>BOWL</span><span>FIELD</span><span>POINTS</span></div>{allRows.map(({entry,score,player},i)=><details className="ranking-record" key={entry.figures.playerId}><summary><span className="rank-player"><b>{String(i+1).padStart(2,"0")}</b><span><strong>{player!.name}</strong><small>{player!.team} · {entry.origin.toUpperCase()}{entry.origin==="illustrative"?" SAMPLE":""}</small></span></span><span>{score!.batting}</span><span>{score!.bowling}</span><span>{score!.fielding}</span><strong className="rank-total">{score!.total} ↘</strong></summary><div className="ranking-details">{score!.lines.map(line=><p key={line.key}><span>{line.description} ({line.count} × {line.rate})</span><strong>{line.points}</strong></p>)}{score!.lines.length===0&&<p>Player registered zero points.</p>}<button type="button" className="text-action" onClick={()=>{setSelectedId(player!.playerId);window.scrollTo({top:0,behavior:"smooth"})}}>EDIT PLAYER FIGURES ↗</button></div></details>)}</div>}
 <p className="disclaimer">S3V XI fantasy points are independently calculated from manual/CSV inputs, not CricHeroes MVP ratings. Local storage is per-browser. No global leaderboard, authentication, external API integration or verified scoring publication is active yet.</p>
 <Link href="/leaderboard" className="outline-btn leader-link">VIEW PLAYER POINTS LEADERBOARD ↗</Link>
 </div>
 </>;
}
