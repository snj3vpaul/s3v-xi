import { NextResponse } from "next/server";
import { requestSupabase } from "@/lib/supabase";
import { error } from "@/lib/api-auth";
export const dynamic = "force-dynamic";
export async function GET() {
  const db=requestSupabase(); if(!db) return error(503,"Tournament database is not configured.");
  const query=await db.from("s3v_tournaments").select("id,name,slug,season,description,format,starts_on,ends_on,timezone,status,max_per_team,registration_deadline").neq("status","draft").order("starts_on",{ascending:false});
  if(query.error)return error(500,query.error.message);
  return NextResponse.json({tournaments:query.data},{headers:{"Cache-Control":"no-store"}});
}
