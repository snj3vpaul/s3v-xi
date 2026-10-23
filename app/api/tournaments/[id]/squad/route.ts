import { NextRequest, NextResponse } from 'next/server';
import { authenticate, error, getBody, isResponse } from '@/lib/api-auth';
import { validateTournamentSquad, type EligiblePlayer } from '@/lib/tournament-rules';
import type { Role } from '@/lib/fantasy';
export const dynamic='force-dynamic';
type Ctx={params:Promise<{id:string}>};
export async function GET(req:NextRequest,ctx:Ctx){
  const auth=await authenticate(req);if(isResponse(auth))return auth;
  const {id}=await ctx.params;
  const saved=await auth.db.from('s3v_fantasy_squads').select('*').eq('tournament_id',id).eq('user_id',auth.user.id).maybeSingle();
  if(saved.error)return error(400,saved.error.message);
  return NextResponse.json({squad:saved.data},{headers:{'Cache-Control':'no-store'}});
}
export async function PUT(req:NextRequest,ctx:Ctx){
  const auth=await authenticate(req);if(isResponse(auth))return auth;
  const {id}=await ctx.params;
  const body=await getBody(req);if(!body)return error(400,'Invalid JSON body.');
  const isIds=(value:unknown):value is string[]=>Array.isArray(value)&&value.every(v=>typeof v==='string'&&/^[a-f0-9-]{36}$/i.test(v));
  if(!isIds(body.playerIds)||!isIds(body.benchIds)||typeof body.captainId!=='string'||typeof body.viceCaptainId!=='string')return error(400,'Invalid squad payload.');
  const [t,r]=await Promise.all([
    auth.db.from('s3v_tournaments').select('id,status,squad_size,max_per_team,registration_deadline').eq('id',id).maybeSingle(),
    auth.db.from('s3v_registrations').select('player_id,team_id,role,available,s3v_players(full_name)').eq('tournament_id',id),
  ]);
  if(t.error||!t.data||r.error||!r.data)return error(404,'Tournament or player records unavailable.');
  if(!['upcoming','active'].includes(t.data.status))return error(409,'Tournament is not accepting fantasy squads.');
  if(t.data.registration_deadline&&Date.now()>=new Date(t.data.registration_deadline).getTime())return error(409,'Fantasy registration deadline has passed.');
  const pool:EligiblePlayer[]=r.data.map(row=>({id:row.player_id,teamId:row.team_id,role:row.role as Role,available:row.available,name:(row.s3v_players as unknown as {full_name:string}|null)?.full_name||row.player_id}));
  const issues=validateTournamentSquad({playerIds:body.playerIds,benchIds:body.benchIds,captainId:body.captainId,viceCaptainId:body.viceCaptainId},pool,{maxPerTeam:t.data.max_per_team,squadSize:t.data.squad_size});
  if(issues.length)return NextResponse.json({error:'Squad validation failed.',issues},{status:422});
  const result=await auth.db.from('s3v_fantasy_squads').upsert({tournament_id:id,user_id:auth.user.id,player_ids:body.playerIds,bench_ids:body.benchIds,captain_id:body.captainId,vice_captain_id:body.viceCaptainId},{onConflict:'tournament_id,user_id'}).select('id,updated_at').single();
  if(result.error)return error(422,result.error.message);
  return NextResponse.json({saved:result.data},{headers:{'Cache-Control':'no-store'}});
}
