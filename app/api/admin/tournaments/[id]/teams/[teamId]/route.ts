import {NextRequest,NextResponse} from 'next/server';
import {authenticate,error,getBody,isResponse,textField} from '@/lib/api-auth';
type Ctx={params:Promise<{id:string;teamId:string}>};
export async function PATCH(req:NextRequest,ctx:Ctx){
 const auth=await authenticate(req,true);if(isResponse(auth))return auth;
 const {id,teamId}=await ctx.params;const body=await getBody(req);const name=textField(body?.name);
 if(name.length<2)return error(422,'Enter a cricket team name.');
 const t=await auth.db.from('s3v_tournaments').select('status').eq('id',id).maybeSingle();
 if(!t.data||t.data.status!=='draft')return error(409,'Published team lists are locked.');
 const saved=await auth.db.from('s3v_cricket_teams').update({name}).eq('id',teamId).eq('tournament_id',id).select('id').single();
 if(saved.error)return error(422,saved.error.message);
 await auth.db.from('s3v_admin_audit').insert({actor_id:auth.user.id,tournament_id:id,action:'team_renamed',payload:{teamId,name}});
 return NextResponse.json({updated:true});
}
