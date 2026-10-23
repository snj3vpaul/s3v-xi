import {NextRequest,NextResponse} from 'next/server';
import {authenticate,error,getBody,isResponse} from '@/lib/api-auth';
type Ctx={params:Promise<{id:string;registrationId:string}>};
export async function PATCH(req:NextRequest,ctx:Ctx){
 const auth=await authenticate(req,true);if(isResponse(auth))return auth;
 const {id,registrationId}=await ctx.params;const body=await getBody(req);if(!body)return error(400,'Invalid JSON.');
 const t=await auth.db.from('s3v_tournaments').select('status').eq('id',id).maybeSingle();
 if(!t.data||t.data.status!=='draft')return error(409,'Published player assignments are locked.');
 const change:Record<string,unknown>={};
 if(typeof body.role==='string'&&['WK','BAT','AR','BOWL'].includes(body.role))change.role=body.role;
 if(typeof body.available==='boolean')change.available=body.available;
 if(typeof body.team_id==='string'){
   const team=await auth.db.from('s3v_cricket_teams').select('id').eq('id',body.team_id).eq('tournament_id',id).maybeSingle();
   if(!team.data)return error(422,'Player team must be part of this tournament.');
   change.team_id=body.team_id;
 }
 if(!Object.keys(change).length)return error(422,'No valid player changes.');
 const updated=await auth.db.from('s3v_registrations').update(change).eq('id',registrationId).eq('tournament_id',id).select('id').single();
 if(updated.error)return error(422,updated.error.message);
 await auth.db.from('s3v_admin_audit').insert({actor_id:auth.user.id,tournament_id:id,action:'player_registration_updated',payload:{registrationId,changes:change}});
 return NextResponse.json({updated:true});
}
