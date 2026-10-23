'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {SiteHeader} from '@/components/SiteHeader';
type Tournament={id:string;name:string;description:string;season:number;format:string;status:string;starts_on:string;max_per_team:number};
export default function Tournaments(){
 const [items,setItems]=useState<Tournament[]>([]);const [message,setMessage]=useState('Loading available tournaments…');
 useEffect(()=>{fetch('/api/tournaments',{cache:'no-store'}).then(async res=>{const data=await res.json();if(!res.ok)throw new Error(data.error);setItems(data.tournaments);setMessage('');}).catch(e=>setMessage(e.message));},[]);
 return <><SiteHeader/><main className="section modern-page"><p className="kicker">S3V XI / COMPETITIONS</p><h1 className="page-display">FIND YOUR<br/><em>LEAGUE.</em></h1><p className="intro-copy">Each league has its own fixtures, registered players, selection rules and fantasy entries.</p>{message&&<p role="status" className="response-note">{message}</p>}{!items.length&&!message&&<div className="surface">No tournaments are published yet. An administrator can create one and import its roster and schedule.</div>}<div className="tournament-grid">{items.map(item=><Link href={`/tournaments/${item.id}`} className="tournament-tile" key={item.id}><p className="kicker">{item.format} / {item.season}</p><h2>{item.name}</h2><p>{item.description||'Community fantasy cricket tournament'}</p><div className="tile-footer"><span>{item.status.toUpperCase()} · MAX {item.max_per_team} PER CLUB</span><span>VIEW TOURNAMENT ↗</span></div></Link>)}</div></main></>;
}
