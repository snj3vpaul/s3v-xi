import {describe,it,expect} from 'vitest';
import { localTournamentTimeToIso, isoToLocalInput } from './timezone';
describe('tournament timezones',()=>{
 it('resolves winter in Toronto',()=>expect(localTournamentTimeToIso('2027-01-15T13:00','America/Toronto')).toBe('2027-01-15T18:00:00.000Z'));
 it('resolves summer in Toronto',()=>expect(localTournamentTimeToIso('2027-07-15T13:00','America/Toronto')).toBe('2027-07-15T17:00:00.000Z'));
 it('formats a UTC instant as local tournament time',()=>expect(isoToLocalInput('2027-07-15T17:00:00Z','America/Toronto')).toBe('2027-07-15T13:00'));
 it('rejects nonexistent DST hours',()=>expect(()=>localTournamentTimeToIso('2027-03-14T02:30','America/Toronto')).toThrow());
});
