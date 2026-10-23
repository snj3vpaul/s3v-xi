import {NextRequest,NextResponse} from 'next/server';
import {authenticate,error,getBody,isResponse,textField} from '@/lib/api-auth';
type Ctx={params:Promise<{id:string;fixtureId:string}>};
export async function PATCH(req:NextRequest,ctx:Ctx){
 const auth=await authenticate(req,true);if(isResponse(auth))return auth;
 const {id,fixtureId}=await ctx.params;const body=await getBody(req);if(!body)return error(400,'Invalid JSON.');
 const t=await auth.db.from('s3v_tournaments').select('status,timezone').eq('id',id).maybeSingle();
 if(!t.data||t.data.status!=='draft')return error(409,'Only draft fixtures may be edited.');
 const existing=await auth.db.from('s3v_fixtures').select('*').eq('id',fixtureId).eq('tournament_id',id).maybeSingle();
 if(!existing.data)return error(404,'Fixture not found.');
 const updates:Record<string,unknown>={};
 if(typeof body.venue==='string')updates.venue=textField(body.venue,200);
 if(typeof body.round_name==='string')updates.round_name=textField(body.round_name,100);
 if(typeof body.status==='string'&&['scheduled','postponed','cancelled','abandoned'].includes(body.status))updates.status=body.status;
 if(typeof body.starts_at==='string'&&Number.isFinite(Date.parse(body.starts_at)))updates.starts_at=body.starts_at;
 if(!Object.keys(updates).length)return error(422,'No valid changes supplied.');
 const result=await auth.db.from('s3v_fixtures').update(updates).eq('id',fixtureId).eq('tournament_id',id).select('id').single();
 if(result.error)return error(422,result.error.message);
 await auth.db.from('s3v_admin_audit').insert({actor_id:auth.user.id,tournament_id:id,action:'fixture_updated',payload:{fixtureId,changes:updates}});
 return NextResponse.json({updated:true});
}
