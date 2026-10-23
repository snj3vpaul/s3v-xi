import { describe,it,expect } from 'vitest';
import { importErrors, canonicalRows } from './imports';
describe('data import validation',()=>{
  it('rejects duplicates',()=>expect(importErrors('teams',[{name:'Canterbury'},{name:'canterbury'}]).join(' ')).toMatch(/duplicate/));
  it('rejects teams not part of tournament',()=>expect(importErrors('players',[{name:'A',team:'Missing',role:'BAT'}],['Canterbury']).join(' ')).toMatch(/not a registered/));
  it('rejects invalid fixture timing',()=>expect(importErrors('fixtures',[{match_id:'M1',match_date:'2027-05-01',match_time:'25:00',team_a:'A',team_b:'B'}],['A','B']).join(' ')).toMatch(/HH:mm/));
  it('allows valid roles and fixture records',()=>{
    expect(importErrors('players',[{name:'Test Player',role:'BAT',team:'A'}],['A'])).toEqual([]);
    expect(importErrors('fixtures',[{match_id:'M1',match_date:'2027-05-01',match_time:'13:00',team_a:'A',team_b:'B'}],['A','B'])).toEqual([]);
  });
  it('normalizes roles and availability',()=>expect(canonicalRows('players',[{name:'Person',role:'bat',available:'no',team:'A'}])[0]).toMatchObject({role:'BAT',available:'false'}));
});
