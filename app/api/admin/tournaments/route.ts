import { NextRequest, NextResponse } from 'next/server';
import { authenticate, error, getBody, isResponse, textField } from '@/lib/api-auth';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
  const auth=await authenticate(req,true);if(isResponse(auth))return auth;
  const q=await auth.db.from('s3v_tournaments').select('id,name,season,status,format,starts_on,ends_on,timezone').order('created_at',{ascending:false});
  return q.error?error(400,q.error.message):NextResponse.json({tournaments:q.data});
}
export async function POST(req:NextRequest){
  const auth=await authenticate(req,true);if(isResponse(auth))return auth;
  const body=await getBody(req);if(!body)return error(400,'Invalid JSON body.');
  const name=textField(body.name),season=Number(body.season),format=textField(body.format,20)||'T20';
  const starts_on=textField(body.starts_on,10),ends_on=textField(body.ends_on,10),tz=textField(body.timezone,80)||'America/Toronto';
  const deadline=textField(body.registration_deadline,40);
  const max_per_team=body.max_per_team===undefined?3:Number(body.max_per_team);
  const logo_url=textField(body.logo_url,500);
  if(logo_url&&!/^https:\/\/[^\s]+$/i.test(logo_url))return error(422,'Tournament logo must be a valid HTTPS URL.');
  const slug=`${name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}-${season}`;
  if(name.length<3||!Number.isInteger(season)||season<2000||season>2100||!['T20','ODI','Other'].includes(format)||!/^\d{4}-\d{2}-\d{2}$/.test(starts_on)||!/^\d{4}-\d{2}-\d{2}$/.test(ends_on)||ends_on<starts_on||!Number.isInteger(max_per_team)||max_per_team<1||max_per_team>15)return error(422,'Check name, season, dates, format and max players per team.');
  try{new Intl.DateTimeFormat('en-US',{timeZone:tz});}catch{return error(422,'Enter a valid IANA timezone.');}
  if(deadline&&!Number.isFinite(Date.parse(deadline)))return error(422,'Invalid deadline. Use an ISO date with timezone.');
  const result=await auth.db.from('s3v_tournaments').insert({name,slug,season,description:textField(body.description,2000),format,starts_on,ends_on,timezone:tz,registration_deadline:deadline||null,max_per_team,status:'draft',logo_url:logo_url||null,created_by:auth.user.id}).select('id,slug').single();
  if(result.error)return error(409,result.error.message);
  await auth.db.from('s3v_admin_audit').insert({tournament_id:result.data.id,actor_id:auth.user.id,action:'tournament_created'});
  return NextResponse.json({tournament:result.data},{status:201});
}
