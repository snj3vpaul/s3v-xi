import {describe,expect,it} from 'vitest';
import {pageOf,visibleFixtures,visibleRoster,type RosterListRow,type FixtureListRow} from './admin-list';
const names=new Map([['team-a','Canterbury T20'],['team-b','Kanata T20']]);
const players:RosterListRow[]=[
 {id:'r1',player_id:'p1',team_id:'team-a',role:'BAT',available:true,s3v_players:{full_name:'Aarav Example',cricheroes_id:'123'}},
 {id:'r2',player_id:'p2',team_id:'team-a',role:'BOWL',available:false,s3v_players:{full_name:'Samar Example',cricheroes_id:'456'}},
 {id:'r3',player_id:'p3',team_id:'team-b',role:'WK',available:true,s3v_players:{full_name:'Yash Example',cricheroes_id:'789'}}
];
const matches:FixtureListRow[]=[
 {id:'f1',match_id:'m1',team_a_id:'team-a',team_b_id:'team-b',venue:'Ottawa Cricket Ground',round_name:'Round 1',status:'scheduled',starts_at:'2027-05-01T13:00:00Z'},
 {id:'f2',match_id:'m2',team_a_id:'team-b',team_b_id:'team-a',venue:'Kanata',round_name:'Round 2',status:'completed',starts_at:'2027-05-08T13:00:00Z'}
];
describe('admin tournament list filtering',()=>{
 it('finds players by stable CricHeroes ID',()=>expect(visibleRoster(players,{search:'456',team:'all',role:'all',availability:'all'},names).map(p=>p.id)).toEqual(['r2']));
 it('filters team role and availability together',()=>expect(visibleRoster(players,{search:'',team:'team-a',role:'BAT',availability:'available'},names).map(p=>p.id)).toEqual(['r1']));
 it('filters by real cricket team name',()=>expect(visibleRoster(players,{search:'kanata',team:'all',role:'all',availability:'all'},names).length).toBe(1));
 it('never truncates player lists to an unannounced 150 records',()=>expect(pageOf(Array.from({length:305},(_,i)=>i),13).rows.length).toBe(5));
 it('clamps stale page numbers when filtering',()=>expect(pageOf([1,2,3],12).page).toBe(1));
 it('finds fixtures by status and round',()=>expect(visibleFixtures(matches,{search:'round 2',status:'completed'},names).map(f=>f.id)).toEqual(['f2']));
});
