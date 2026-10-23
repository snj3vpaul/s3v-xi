"use client";
import {useState} from "react";
import {EMPTY_FIGURES, FIELD_LABELS, NUMBER_FIELDS, scoreMatchFigures, validateFigures, type MatchFigures, type PlayerRole} from "@/lib/scoring";
const CATEGORIES=["Batting","Bowling","Fielding"] as const;
export function PointsCalculator(){
 const [figures,setFigures]=useState<MatchFigures>({...EMPTY_FIGURES,playerId:"calculator"});
 const [role,setRole]=useState<PlayerRole>("BAT");
 const [boost,setBoost]=useState<"normal"|"C"|"VC"|"C3">("normal");
 const errors=validateFigures(figures);
 const points=errors.length?null:scoreMatchFigures(figures,role);
 const factor=boost==="C"?2:boost==="VC"?1.5:boost==="C3"?3:1;
 return <div className="points-calculator">
 <section className="calc-form"><div className="paneltitle"><div><p className="kicker">01 / INTERACTIVE SCORING</p><h3>TRY THE CALCULATOR</h3></div></div>
 <div className="calc-control"><label htmlFor="calc-role">Confirmed playing role</label><select id="calc-role" value={role||"unknown"} onChange={e=>setRole(e.target.value==="unknown"?null:e.target.value as PlayerRole)}><option value="unknown">Not confirmed</option><option value="WK">Wicketkeeper</option><option value="BAT">Batter</option><option value="AR">All-rounder</option><option value="BOWL">Bowler</option></select></div>
 <div className="figure-inputs">{NUMBER_FIELDS.map(key=><div key={key} className="calc-control"><label htmlFor={"calc-"+key}>{FIELD_LABELS[key]}</label><input id={"calc-"+key} type="number" min="0" step="1" value={figures[key]} onChange={e=>setFigures(f=>({...f,[key]:Number(e.target.value)}))}/></div>)}</div>
 <div className="toggle-grid"><label><input type="checkbox" checked={figures.dismissed} onChange={e=>setFigures(f=>({...f,dismissed:e.target.checked}))}/> Player dismissed?</label><label><input type="checkbox" checked={figures.played} onChange={e=>setFigures(f=>({...f,played:e.target.checked}))}/> Played in this match?</label></div>
 <div className="calc-control"><label htmlFor="calc-boost">Captaincy preview</label><select id="calc-boost" value={boost} onChange={e=>setBoost(e.target.value as typeof boost)}><option value="normal">Regular player · 1×</option><option value="C">Captain · 2×</option><option value="VC">Vice-captain · 1.5×</option><option value="C3">Skipper x3 · 3×</option></select></div>
 {errors.length>0&&<p className="validation-message" role="alert">{errors.join(" ")}</p>}
 <button className="outline-btn" type="button" onClick={()=>{setFigures({...EMPTY_FIGURES,playerId:"calculator"});setBoost("normal")}}>RESET CALCULATOR ↺</button>
 </section>
 <aside className="calc-result"><p className="kicker">02 / YOUR POINTS</p><span className="metric-caption">FANTASY SCORE</span><strong className="large-result">{points ? Math.round(points.total*factor*10)/10 : "—"}</strong><p className="result-note">{points ? `${points.total} base pts × ${factor} multiplier` : "Complete a valid scorecard to calculate points."}</p>
 {points&&CATEGORIES.map(category=><div className="result-category" key={category}><h4>{category} <span>{points[category.toLowerCase() as "batting"|"bowling"|"fielding"]}</span></h4>{points.lines.filter(l=>l.category===category).map(l=><div className="breakdown-row" key={l.key}><span>{l.description} <small>({l.count} × {l.rate})</small></span><strong>{l.points>0?"+":""}{l.points}</strong></div>)}{!points.lines.some(l=>l.category===category)&&<p className="empty-small">No points in this category</p>}</div>)}
 <p className="result-footnote">Figures entered here are illustrative inputs only. No data is sent to CricHeroes or stored on a server.</p></aside>
 </div>
}
