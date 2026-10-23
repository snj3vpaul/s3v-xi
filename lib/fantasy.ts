export type Role = "WK" | "BAT" | "AR" | "BOWL";
export const MAX_PLAYERS_PER_TEAM = 3;
export type Chip = "full-squad" | "skipper-x3" | null;
export interface Player {id:string;name:string;team:string;role:Role;points:number}
export const TARGET:Record<Role,number>={WK:2,BAT:5,AR:3,BOWL:5};
export function validateSquad(squad:Player[],benchIds:string[],captain:string|null,vice:string|null):string[] {
  const issues:string[]=[];
  const unique=new Set(squad.map(p=>p.id));
  if(unique.size!==squad.length) issues.push("Duplicate players are not allowed");
  if(squad.length!==15) issues.push("Squad must have 15 players");
  (Object.keys(TARGET) as Role[]).forEach(role=>{if(squad.filter(p=>p.role===role).length!==TARGET[role])issues.push("Incorrect "+role+" count")});
  const teamCounts = new Map<string, number>();
  squad.forEach(p => teamCounts.set(p.team, (teamCounts.get(p.team) ?? 0) + 1));
  for(const [team, count] of teamCounts) if(count > MAX_PLAYERS_PER_TEAM) issues.push(`Maximum ${MAX_PLAYERS_PER_TEAM} players from ${team} (selected ${count}).`);
  if(benchIds.length!==4||new Set(benchIds).size!==4||benchIds.some(id=>!unique.has(id)))issues.push("Choose exactly four unique bench players");
  const starting=squad.filter(p=>!benchIds.includes(p.id));
  if(starting.length!==11)issues.push("Starting XI must have 11 players");
  if(!captain||!starting.some(p=>p.id===captain))issues.push("Choose a starting captain");
  if(!vice||vice===captain||!starting.some(p=>p.id===vice))issues.push("Choose a distinct starting vice-captain");
  return issues;
}
export function scoreDemo(squad:Player[],benchIds:string[],captain:string,vice:string,chip:Chip) {
  const issues=validateSquad(squad,benchIds,captain,vice);
  if(issues.length)throw new Error(issues.join("; "));
  const details=squad.map(p=>{
    const bench=benchIds.includes(p.id);
    const active=!bench||chip==="full-squad";
    const multiplier=!active?0:p.id===captain?(chip==="skipper-x3"?3:2):p.id===vice?1.5:1;
    return {id:p.id,bench,multiplier,earned:Math.round(p.points*multiplier*10)/10};
  });
  return {total:Math.round(details.reduce((n,p)=>n+p.earned,0)*10)/10,details};
}
