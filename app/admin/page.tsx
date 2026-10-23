'use client';
import Link from 'next/link';
import {useCallback,useEffect,useState} from 'react';
import {SiteHeader} from '@/components/SiteHeader';
import {appFetch,clientAuth} from '@/lib/client-api';
import {localTournamentTimeToIso} from '@/lib/timezone';
type Tournament={id:string;name:string;season:number;format:string;status:string};
export default function AdminPage(){
 const [items,setItems]=useState<Tournament[]>([]);const [authorized,setAuthorized]=useState(false);const [message,setMessage]=useState('Checking administrator access…');const [busy,setBusy]=useState(false);
 const [form,setForm]=useState({name:'',season:new Date().getFullYear()+1,format:'T20',starts_on:'',ends_on:'',timezone:'America/Toronto',registration_deadline:'',max_per_team:3,description:'',logo_url:''});
 const refresh=useCallback(async()=>{try{const response=await appFetch('/api/admin/tournaments') as {tournaments:Tournament[]};setItems(response.tournaments);setAuthorized(true);setMessage('');}catch(e){setAuthorized(false);setMessage((e as Error).message+' Sign in first if you have administrator access.');}},[]);
 useEffect(()=>{void refresh();},[refresh]);
 async function create(e:React.FormEvent){e.preventDefault();setBusy(true);try{
   const payload={...form,registration_deadline:form.registration_deadline?localTournamentTimeToIso(form.registration_deadline,form.timezone):''};
   const result=await appFetch('/api/admin/tournaments',{method:'POST',body:JSON.stringify(payload)}) as {tournament:{id:string}};
   window.location.href=`/admin/tournaments/${result.tournament.id}`;
 }catch(err){setMessage((err as Error).message);setBusy(false);}}
 async function signOut(){await clientAuth()?.auth.signOut();window.location.href='/login';}
 return <><SiteHeader/><main className="section modern-page"><p className="kicker">ADMIN / TOURNAMENT MANAGEMENT</p><h1 className="page-display">RUN THE<br/><em>TOURNAMENT.</em></h1><div className="toolbar"><Link className="outline-btn" href="/tournaments">PUBLIC TOURNAMENTS ↗</Link><button className="outline-btn" onClick={signOut}>SIGN OUT</button></div><p role="status" className="response-note">{message}</p>{authorized&&<div className="admin-grid"><section className="surface"><h2 className="admin-title">EXISTING TOURNAMENTS</h2>{items.map(t=><Link className="admin-row" href={`/admin/tournaments/${t.id}`} key={t.id}><strong>{t.name} · {t.season}</strong><span>{t.format} · {t.status.toUpperCase()} ↗</span></Link>)}{!items.length&&<p>There are no tournaments to manage yet, or administrator access has not been configured.</p>}</section>
 <section className="surface"><p className="kicker">+ ADD NEW TOURNAMENT</p><h2 className="admin-title">CREATE A DRAFT</h2><form className="admin-form" onSubmit={create}>
 <label>Tournament name<input required minLength={3} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ottawa T20 Division"/></label>
 <div className="form-two"><label>Season / year<input type="number" min="2000" max="2100" value={form.season} onChange={e=>setForm({...form,season:Number(e.target.value)})}/></label><label>Format<select value={form.format} onChange={e=>setForm({...form,format:e.target.value})}><option>T20</option><option>ODI</option><option>Other</option></select></label></div>
 <div className="form-two"><label>Starts<input required type="date" value={form.starts_on} onChange={e=>setForm({...form,starts_on:e.target.value})}/></label><label>Ends<input required type="date" value={form.ends_on} onChange={e=>setForm({...form,ends_on:e.target.value})}/></label></div>
 <label>Timezone<input value={form.timezone} onChange={e=>setForm({...form,timezone:e.target.value})}/></label>
 <label>Registration deadline (local browser timezone)<input type="datetime-local" value={form.registration_deadline} onChange={e=>setForm({...form,registration_deadline:e.target.value})}/></label>
 <label>Maximum players per cricket team<input type="number" min="1" max="15" value={form.max_per_team} onChange={e=>setForm({...form,max_per_team:Number(e.target.value)})}/></label>
 <label>Optional tournament logo URL (HTTPS)<input type="url" placeholder="https://.../logo.png" value={form.logo_url} onChange={e=>setForm({...form,logo_url:e.target.value})}/></label>
 <label>Description<textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><p className="helper">All tournaments start as Draft. Teams, fixtures and verified rosters must be imported before publishing. No player prices or bidding.</p><button type="submit" className="primary" disabled={busy}>{busy?'CREATING…':'+ ADD NEW TOURNAMENT ↗'}</button>
 </form></section></div>}</main></>;
}
