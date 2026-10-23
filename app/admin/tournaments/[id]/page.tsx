import { SiteHeader } from '@/components/SiteHeader';
import { TournamentAdmin } from '@/components/TournamentAdmin';
type Ctx={params:Promise<{id:string}>};
export default async function AdminTournamentPage({params}:Ctx){const {id}=await params;return <><SiteHeader/><TournamentAdmin id={id}/></>;}
