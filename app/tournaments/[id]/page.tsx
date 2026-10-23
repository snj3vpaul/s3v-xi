import {SiteHeader} from '@/components/SiteHeader';
import {TournamentExperience} from '@/components/TournamentExperience';
type Ctx={params:Promise<{id:string}>};
export default async function TournamentPage({params}:Ctx){const {id}=await params;return <><SiteHeader/><TournamentExperience id={id}/></>;}
