import {describe,it,expect} from "vitest";
import {PLAYERS,START_BENCH} from "./demo";
import {scoreDemo,validateSquad} from "./fantasy";
const squad=PLAYERS.slice(0,15), captain="p03", vice="p08";
describe("fantasy rules",()=>{
  it("accepts 15 and rejects duplicate leaders",()=>{
    expect(validateSquad(squad,START_BENCH,captain,vice)).toEqual([]);
    expect(validateSquad(squad,START_BENCH,captain,captain)).not.toEqual([]);
  });
  it("excludes bench points by default",()=>{
    const result=scoreDemo(squad,START_BENCH,captain,vice,null);
    expect(result.details.filter(p=>p.bench).every(p=>p.earned===0)).toBe(true);
  });
  it("full squad adds four bench players exactly once",()=>{
    const basic=scoreDemo(squad,START_BENCH,captain,vice,null);
    const boosted=scoreDemo(squad,START_BENCH,captain,vice,"full-squad");
    const difference=squad.filter(p=>START_BENCH.includes(p.id)).reduce((n,p)=>n+p.points,0);
    expect(boosted.total-basic.total).toBe(difference);
  });
  it("triple captain replaces, rather than stacks, double points",()=>{
    const basic=scoreDemo(squad,START_BENCH,captain,vice,null);
    const boosted=scoreDemo(squad,START_BENCH,captain,vice,"skipper-x3");
    expect(boosted.total-basic.total).toBe(squad.find(p=>p.id===captain)!.points);
  });
});
