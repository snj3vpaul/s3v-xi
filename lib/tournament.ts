import historical from "./historical-players.json";
export type Role = "WK" | "BAT" | "AR" | "BOWL" | null;
export interface HistoricalPlayer {
  id:string; playerId:string; tournamentId:string; teamId:string; name:string; team:string;
  matches:number; runs:number; fours:number; sixes:number; wickets:number; maidens:number;
  catches:number; strikeRate:number; economy:number; role:Role;
}
export const HISTORICAL_PLAYERS = historical as unknown as HistoricalPlayer[];
export const TOURNAMENTS = [
  {id:"1985886",name:"T20 Division 2026",subtitle:"Newly uploaded tournament leaderboard"},
  {id:"1985875",name:"Tournament 1985875",subtitle:"Historical CSV · title unconfirmed"},
  {id:"1985883",name:"Tournament 1985883",subtitle:"Historical CSV · title unconfirmed"},
  {id:"2198428",name:"Tournament 2198428",subtitle:"Historical CSV · title unconfirmed"},
] as const;
export const MATCH_POOL = HISTORICAL_PLAYERS.filter(p => p.tournamentId === "1985886" && ["Canterbury T20", "Kanata T20"].includes(p.team));
export const MATCH_POOL_BY_ID = new Map(MATCH_POOL.map(p=>[p.playerId,p]));
export const ALL_2026 = HISTORICAL_PLAYERS.filter(p=>p.tournamentId === "1985886");
export const formatRole = (role:Role) => ({WK:"WK",BAT:"BAT",AR:"AR",BOWL:"BOWL"} as Record<string,string>)[role||""] || "UNCONFIRMED";
