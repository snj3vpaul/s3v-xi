'use client';
import { useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { clientAuth } from '@/lib/client-api';
export default function LoginPage(){
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
  async function submit(mode:'login'|'signup'){
    const db=clientAuth();if(!db){setMessage('Supabase is not configured yet. Follow docs/TOURNAMENT_SETUP.md.');return;}
    setBusy(true);setMessage('');
    const response=mode==='login'?await db.auth.signInWithPassword({email,password}):await db.auth.signUp({email,password});
    setBusy(false);
    if(response.error)setMessage(response.error.message);
    else if(mode==='signup')setMessage('Account created. If email confirmation is enabled, confirm your email before signing in.');
    else {window.location.href='/tournaments';}
  }
  return <><SiteHeader/><main className="section modern-page"><p className="kicker">S3V XI / ACCOUNT</p><h1 className="page-display">JOIN THE<br/><em>LEAGUE.</em></h1><div className="surface form-card"><p>Sign in to submit your tournament fantasy squad. Administrator accounts require a separate role assignment in Supabase.</p><label>Email<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6}/></label><div className="toolbar"><button className="primary" type="button" disabled={busy||!email||password.length<6} onClick={()=>submit('login')}>SIGN IN ↗</button><button className="outline-btn" type="button" disabled={busy||!email||password.length<6} onClick={()=>submit('signup')}>CREATE FREE ACCOUNT</button></div><p role="status" className="response-note">{message}</p><p>Already signed in? <Link href="/admin">Tournament administration</Link> · <Link href="/tournaments">Tournament explorer</Link></p></div></main></>;
}
