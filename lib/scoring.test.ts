import {describe, expect, it} from "vitest";
import {scoreMatchFigures, boostedPoints, EMPTY_FIGURES, type MatchFigures} from "./scoring";
import {parseMatchCsv, csvRowsToEntries, downloadMatchCsv} from "./match-store";
const f = (changes: Partial<MatchFigures> = {}): MatchFigures => ({...EMPTY_FIGURES, playerId: "12", ...changes});
describe("match fantasy point engine", () => {
  it("calculates batting bonus and selects only highest milestone", () => {
    const s = scoreMatchFigures(f({runs:101,fours:10,sixes:5}),"BAT");
    expect(s.batting).toBe(101+10+10+16);
    expect(s.lines.filter(x=>x.key==="milestone")).toHaveLength(1);
  });
  it("awards bowling and fielding points without doubling catches", () => {
    const s=scoreMatchFigures(f({wickets:2,maidens:1,catches:2,stumpings:1,directRunOuts:1,assistedRunOuts:2}),"AR");
    expect(s.bowling).toBe(62);
    expect(s.fielding).toBe(52);
    expect(s.total).toBe(114);
  });
  it("only deducts a duck when role and dismissal are confirmed", () => {
    expect(scoreMatchFigures(f({dismissed:true}),"BAT").total).toBe(-2);
    expect(scoreMatchFigures(f({dismissed:true}),null).total).toBe(0);
    expect(scoreMatchFigures(f({dismissed:false}),"BAT").total).toBe(0);
  });
  it("does not award non-playing members points",()=>{
    expect(scoreMatchFigures(f({played:false}),"AR").total).toBe(0);
    expect(()=>scoreMatchFigures(f({played:false, wickets:1}),"AR")).toThrow();
  });
  it("rejects invalid scorecard entries",()=>{
    expect(()=>scoreMatchFigures(f({runs:4,fours:2}),null)).toThrow();
    expect(()=>scoreMatchFigures(f({wickets:-1}),null)).toThrow();
    expect(()=>scoreMatchFigures(f({runs:1.3}),null)).toThrow();
  });
  it("supports normal, triple captain and full-squad point multipliers",()=>{
    expect(boostedPoints(40,"C")).toBe(80);
    expect(boostedPoints(40,"C","skipper-x3")).toBe(120);
    expect(boostedPoints(31,"VC")).toBe(46.5);
    expect(boostedPoints(40,"BENCH","full-squad")).toBe(40);
    expect(boostedPoints(40,"BENCH")).toBe(0);
  });
});
describe("match imports",()=>{
  const csv="player_id,runs,fours,sixes,wickets,maidens,catches,stumpings,directRunOuts,assistedRunOuts,dismissed,played\n12,44,2,1,1,0,0,0,0,0,true,true\n";
  it("imports a match data row with a known player ID",()=>{
    const entries=csvRowsToEntries(parseMatchCsv(csv),new Set(["12"]));
    expect(scoreMatchFigures(entries[0].figures,null).total).toBe(44+2+2+4+25);
    expect(downloadMatchCsv(entries)).toContain("12,44,2,1,1");
  });
  it("rejects unknown player IDs and duplicate rows",()=>{
    expect(()=>csvRowsToEntries(parseMatchCsv(csv),new Set(["99"]))).toThrow();
    expect(()=>csvRowsToEntries(parseMatchCsv(csv+"12,0,0,0,0,0,0,0,0,0,false,true\n"),new Set(["12"]))).toThrow();
  });
  it("parses quoted csv fields and rejects malformed rows",()=>{
    expect(parseMatchCsv('player_id,runs,fours,sixes,wickets,maidens,catches,stumpings,directRunOuts,assistedRunOuts,dismissed,played,notes\n12,0,0,0,0,0,0,0,0,0,false,true,"hello, world"\n')[0].notes).toBe("hello, world");
    expect(()=>parseMatchCsv('player_id,runs\n12')).toThrow();
  });
});
