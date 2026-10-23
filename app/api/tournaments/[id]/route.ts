import { NextRequest, NextResponse } from "next/server";
import { requestSupabase } from "@/lib/supabase";
import { error } from "@/lib/api-auth";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{id:string}>};
export async function GET(_req:NextRequest,context:Ctx){
  const {id}=await context.params;
  const db=requestSupabase();if(!db)return error(503,"Database not configured.");
  const [tournament,teams,registrations,fixtures]=await Promise.all([
    db.from('s3v_tournaments').select('*').eq('id',id).neq('status','draft').maybeSingle(),
    db.from('s3v_cricket_teams').select('id,name').eq('tournament_id',id).order('name'),
    db.from('s3v_registrations').select('id,player_id,team_id,role,available,s3v_players(id,full_name,cricheroes_id)').eq('tournament_id',id),
    db.from('s3v_fixtures').select('id,match_id,starts_at,team_a_id,team_b_id,venue,round_name,status,scorecard_url').eq('tournament_id',id).order('starts_at'),
  ]);
  if(tournament.error||!tournament.data)return error(404,'Tournament not available.');
  if(teams.error||registrations.error||fixtures.error)return error(500,'Unable to load tournament details.');
  return NextResponse.json({tournament:tournament.data,teams:teams.data,registrations:registrations.data,fixtures:fixtures.data},{headers:{'Cache-Control':'no-store'}});
}
