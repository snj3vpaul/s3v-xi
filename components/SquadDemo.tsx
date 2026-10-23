"use client";
import {useMemo,useState} from "react";
import {PLAYERS,START_BENCH,START_SQUAD} from "@/lib/demo";
import {TARGET,validateSquad,scoreDemo,type Role,type Chip,type Player} from "@/lib/fantasy";
const roles:(Role|"ALL")[]=["ALL","WK","BAT","AR","BOWL"];
export function SquadDemo(){
 const [squadIds,setSquadIds]=useState<string[]>(START_SQUAD),[benchIds,setBenchIds]=useState<string[]>(START_BENCH),[captain,setCaptain]=useState<string|null>("p03"),[vice,setVice]=useState<string|null>("p08"),[chip,setChip]=useState<Chip>(null),[filter,setFilter]=useState<Role|"ALL">("ALL");
 const squad=useMemo(()=>PLAYERS.filter(p=>squadIds.includes(p.id)),[squadIds]);
 const starters=squad.filter(p=>!benchIds.includes(p.id));
 const issues=validateSquad(squad,benchIds,captain,vice),ready=issues.length===0;
 const base=ready?scoreDemo(squad,benchIds,captain!,vice!,null):null;
 const actual=ready?scoreDemo(squad,benchIds,captain!,vice!,chip):null;
 const switchPlayer=(p:Player)=>{
  if(squadIds.includes(p.id)){
    setSquadIds(ids=>ids.filter(id=>id!==p.id));setBenchIds(ids=>ids.filter(id=>id!==p.id));
    if(captain===p.id)setCaptain(null);if(vice===p.id)setVice(null);
    return;
  }
  if(squadIds.length===15||squad.filter(item=>item.role===p.role).length>=TARGET[p.role])return;
  setSquadIds(ids=>[...ids,p.id]);
  if(starters.length>=11)setBenchIds(ids=>[...ids,p.id]);
 };
 const move=(p:Player)=>{
   if(benchIds.includes(p.id)){
     if(starters.length===11)return;
     setBenchIds(ids=>ids.filter(id=>id!==p.id));
   }else{
     if(benchIds.length===4)return;
     setBenchIds(ids=>[...ids,p.id]);
     if(captain===p.id)setCaptain(null);if(vice===p.id)setVice(null);
   }
 };
 return <section className="workshop section" id="builder">
  <div className="section-head workshop-head"><div><p className="kicker">THE SELECTION ROOM / INTERACTIVE DEMO</p><h2>MAKE YOUR<br/><em>ELEVEN COUNT.</em></h2></div><p className="demo-warning">● FICTIONAL DEMO · NOT LIVE SCORES</p></div>
  <div className="scoreboard"><div className="scoretop"><span>DEMO ROUND 01</span><span>OTTAWA COMMUNITY SERIES · FICTIONAL</span></div><div className="scoremetrics"><div><small>ROUND POINTS</small><b>{actual?.total??"—"}</b></div><div><small>SELECTED</small><b>{squad.length}<i>/15</i></b></div><div><small>STARTING</small><b>{starters.length}<i>/11</i></b></div><div><small>ACTIVE CHIP</small><b className="chipname">{chip==="full-squad"?"FULL SQUAD":chip==="skipper-x3"?"SKIPPER x3":"NONE"}</b></div></div>{actual&&base&&chip&&<p className="gain">STRATEGY IMPACT: <strong>+{actual.total-base.total} demo pts</strong> compared with no chip.</p>}</div>
  <div className="grid">
   <div className="surface"><div className="paneltitle"><div><p className="kicker">01 / SQUAD BUILDER</p><h3>YOUR PLAYER POOL</h3></div><small>2 WK · 5 BAT · 3 AR · 5 BOWL</small></div><div className="filters" role="group" aria-label="Filter player roles">{roles.map(r=><button key={r} className={filter===r?"current":""} aria-pressed={filter===r} onClick={()=>setFilter(r)}>{r==="ALL"?"ALL PLAYERS":r}</button>)}</div><div className="pool-head"><span>PLAYER / CLUB</span><span>ROLE</span><span>PTS</span><span>SELECTION</span></div>{PLAYERS.filter(p=>filter==="ALL"||filter===p.role).map(p=>{const selected=squadIds.includes(p.id);const disabled=!selected&&(squadIds.length===15||squad.filter(s=>s.role===p.role).length>=TARGET[p.role]);return <div className="poolrow" key={p.id}><div className="person"><div className="avatar">{p.name.split(" ").map(s=>s[0]).join("")}</div><div><strong>{p.name}</strong><small>{p.team}</small></div></div><span className="role">{p.role}</span><b className="pts">{p.points}</b><button className={selected?"add selected":"add"} disabled={disabled} onClick={()=>switchPlayer(p)} aria-label={(selected?"Remove ":"Add ")+p.name}>{selected?"✓ ADDED":disabled?"FULL":"+ ADD"}</button></div>})}</div>
   <aside className="surface"><div className="paneltitle"><div><p className="kicker">02 / YOUR SELECTION</p><h3>STARTING XI</h3></div><small>{starters.length}/11</small></div><p className="helper">Select captain (C) and vice-captain (VC). Use ↓ and ↑ to manage your bench.</p>{starters.map((p,i)=><div className="xirow" key={p.id}><span className="index">{String(i+1).padStart(2,"0")}</span><div className="xiname"><strong>{p.name}</strong><small>{p.role} · {p.points} demo pts</small></div><button className={captain===p.id?"leader active":"leader"} aria-label={"Captain: "+p.name} aria-pressed={captain===p.id} disabled={vice===p.id} onClick={()=>setCaptain(p.id)}>C</button><button className={vice===p.id?"leader active":"leader"} aria-label={"Vice-captain: "+p.name} aria-pressed={vice===p.id} disabled={captain===p.id} onClick={()=>setVice(p.id)}>VC</button><button className="move" aria-label={"Bench "+p.name} disabled={benchIds.length===4} onClick={()=>move(p)}>↓</button></div>)}<div className="bench-head">THE BENCH <span>{benchIds.length}/4</span></div>{squad.filter(p=>benchIds.includes(p.id)).map(p=><div className="xirow" key={p.id}><span className="index">B</span><div className="xiname"><strong>{p.name}</strong><small>{p.role} · {p.points} demo pts</small></div><button className="move" disabled={starters.length===11} onClick={()=>move(p)}>START ↑</button></div>)}<div className={ready?"notice ready":"notice"} aria-live="polite"><strong>{ready?"✓ YOUR XI IS READY":"COMPLETE YOUR SQUAD"}</strong><p>{ready?"This demo lineup is valid. Selections are not saved.":issues[0]}</p></div></aside>
  </div>
  <div id="chips" className="chips"><div className="section-head"><div><p className="kicker">03 / STRATEGY DECK</p><h2>PLAY YOUR<br/><em>BEST CARD.</em></h2></div><p>Two strategic boosts. One round. Choose wisely. Every card is free.</p></div><div className="chipgrid"><button aria-pressed={chip==="full-squad"} className={chip==="full-squad"?"chip selected":"chip"} onClick={()=>setChip(c=>c==="full-squad"?null:"full-squad")}><span className="chiptop">01 / ONE ROUND <span>↗</span></span><b className="chipart">15<small>/15</small></b><strong>FULL SQUAD</strong><p>Count all four bench players alongside your starting XI.</p><span className="chipbottom">{chip==="full-squad"?"✓ SELECTED":"ACTIVATE CARD"} ↗</span></button><button aria-pressed={chip==="skipper-x3"} className={chip==="skipper-x3"?"chip second selected":"chip second"} onClick={()=>setChip(c=>c==="skipper-x3"?null:"skipper-x3")}><span className="chiptop">02 / ONE ROUND <span>✳</span></span><b className="chipart">3<small>×</small></b><strong>SKIPPER x3</strong><p>Your captain scores triple instead of double.</p><span className="chipbottom">{chip==="skipper-x3"?"✓ SELECTED":"ACTIVATE CARD"} ↗</span></button></div><p className="disclaimer">DEMO ONLY — POWER CARDS ARE NOT REDEEMED OR SAVED. PRODUCTION WILL REQUIRE SERVER-SIDE INVENTORY, DEADLINES AND AUDIT HISTORY. REBUILD AND ONE-ROUND XI ARE PLANNED.</p></div>
 </section>;
}
