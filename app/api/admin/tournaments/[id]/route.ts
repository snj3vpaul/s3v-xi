import { NextRequest, NextResponse } from 'next/server';
import { authenticate, error, getBody, isResponse, textField } from '@/lib/api-auth';
export const dynamic='force-dynamic';
type Ctx={params:Promise<{id:string}>};
export async function GET(req:NextRequest,ctx:Ctx){
  const auth=await authenticate(req,true);if(isResponse(auth))return auth;
  const {id}=await ctx.params;
  const [t,teams,registrations,fixtures,squads]=await Promise.all([
    auth.db.from('s3v_tournaments').select('*').eq('id',id).maybeSingle(),
    auth.db.from('s3v_cricket_teams').select('id,name').eq('tournament_id',id).order('name'),
    auth.db.from('s3v_registrations').select('id,player_id,team_id,role,available,s3v_players(full_name,cricheroes_id)').eq('tournament_id',id),
    auth.db.from('s3v_fixtures').select('*').eq('tournament_id',id).order('starts_at'),
    auth.db.from('s3v_fantasy_squads').select('id,user_id,updated_at').eq('tournament_id',id)
  ]);
  if(!t.data||t.error)return error(404,'Tournament not found.');
  if([teams,registrations,fixtures,squads].some(x=>x.error))return error(500,'Could not load tournament management data.');
  return NextResponse.json({tournament:t.data,teams:teams.data,registrations:registrations.data,fixtures:fixtures.data,managers:squads.data});
}
export async function PATCH(req:NextRequest,ctx:Ctx){
  const auth=await authenticate(req,true);if(isResponse(auth))return auth;
  const {id}=await ctx.params;const body=await getBody(req);if(!body)return error(400,'Invalid JSON.');
  if(body.action==='publish'){
    const published=await auth.db.rpc('s3v_publish_tournament',{p_id:id});
    return published.error?error(422,published.error.message):NextResponse.json({status:'upcoming'});
  }
  if(body.action==='activate'||body.action==='complete'){
    const expected=body.action==='activate'?'upcoming':'active';
    const next=body.action==='activate'?'active':'completed';
    const status=await auth.db.from('s3v_tournaments').update({status:next}).eq('id',id).eq('status',expected).select('id').maybeSingle();
    if(status.error||!status.data)return error(409,'Invalid tournament status transition.');
    await auth.db.from('s3v_admin_audit').insert({tournament_id:id,actor_id:auth.user.id,action:`status_${next}`});
    return NextResponse.json({status:next});
  }
  const previous=await auth.db.from('s3v_tournaments').select('status').eq('id',id).maybeSingle();
  if(!previous.data||previous.data.status!=='draft')return error(409,'Only draft tournaments can change their rules and configuration.');
  const updates:Record<string,unknown>={};
  if(typeof body.description==='string')updates.description=textField(body.description,2000);
  if(typeof body.registration_deadline==='string'&&Number.isFinite(Date.parse(body.registration_deadline)))updates.registration_deadline=body.registration_deadline;
  if(typeof body.max_per_team==='number'&&Number.isInteger(body.max_per_team)&&body.max_per_team>=1&&body.max_per_team<=15)updates.max_per_team=body.max_per_team;
  if(!Object.keys(updates).length)return error(422,'No valid changes.');
  const saved=await auth.db.from('s3v_tournaments').update(updates).eq('id',id).select('id').single();
  if(saved.error)return error(422,saved.error.message);
  await auth.db.from('s3v_admin_audit').insert({tournament_id:id,actor_id:auth.user.id,action:'configuration_updated',payload:updates});
  return NextResponse.json({updated:true});
}
