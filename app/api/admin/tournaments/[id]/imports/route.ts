import { NextRequest, NextResponse } from 'next/server';
import { authenticate, error, getBody, isResponse } from '@/lib/api-auth';
import { canonicalRows, importErrors, type ImportKind, type ImportRow } from '@/lib/imports';
export const dynamic='force-dynamic';
type Ctx={params:Promise<{id:string}>};
export async function POST(req:NextRequest,ctx:Ctx){
  const auth=await authenticate(req,true);if(isResponse(auth))return auth;
  const {id}=await ctx.params;const body=await getBody(req);
  if(!body||!['teams','players','fixtures'].includes(String(body.kind))||!Array.isArray(body.rows)||body.rows.length>2000)return error(400,'Invalid import type or size.');
  const kind=body.kind as ImportKind;
  if(!body.rows.every(r=>r&&typeof r==='object'&&!Array.isArray(r)&&Object.values(r).every(v=>typeof v==='string')))return error(422,'All import fields must be strings.');
  const rows=canonicalRows(kind,body.rows as ImportRow[]);
  const [t,teams]=await Promise.all([
    auth.db.from('s3v_tournaments').select('id,status').eq('id',id).maybeSingle(),
    auth.db.from('s3v_cricket_teams').select('name').eq('tournament_id',id)
  ]);
  if(!t.data||t.data.status!=='draft')return error(409,'Imports are allowed for draft tournaments only.');
  if(teams.error)return error(500,teams.error.message);
  const issues=importErrors(kind,rows,(teams.data??[]).map(team=>team.name));
  if(issues.length)return NextResponse.json({error:'Fix import errors before confirming.',issues},{status:422});
  let count=0;
  if(kind==='teams'){
    const inserted=await auth.db.from('s3v_cricket_teams').insert(rows.map(row=>({tournament_id:id,name:row.name}))).select('id');
    if(inserted.error)return error(409,inserted.error.message);
    count=inserted.data?.length??0;
  }else{
    const rpc=await auth.db.rpc(kind==='players'?'s3v_import_players':'s3v_import_fixtures',{p_tournament_id:id,p_rows:rows,...(kind==='fixtures'?{p_replace:body.replace===true}:{})});
    if(rpc.error)return error(422,rpc.error.message);
    count=Number(rpc.data);
  }
  await auth.db.from('s3v_admin_audit').insert({tournament_id:id,actor_id:auth.user.id,action:`import_${kind}`,payload:{rows:count}});
  return NextResponse.json({imported:count,rejected:0,duplicate:0});
}
