import Link from "next/link";
import {SiteHeader} from "@/components/SiteHeader";
import {PointsCalculator} from "@/components/PointsCalculator";
const rules=[
 {group:"BATTING",items:[["Each run","+1"],["Each boundary four","+1 bonus"],["Each six","+2 bonus"],["30+ runs","+4"],["50+ runs","+8"],["100+ runs","+16"],["Duck — dismissed batter/all-rounder","−2"]]},
 {group:"BOWLING",items:[["Bowler-credited wicket","+25"],["Maiden over","+12"]]},
 {group:"FIELDING",items:[["Catch (including caught behind)","+8"],["Stumping","+12"],["Direct run-out","+12"],["Assisted run-out","+6"]]},
];
export default function PointsPage(){return <main><SiteHeader/><div className="inner-hero"><p className="eyebrow">S3V XI / THE SCORING SYSTEM</p><h1>EVERY RUN.<br/><em>EVERY POINT.</em></h1><p>Transparent cricket-first rules. No hidden bonuses. Experiment with a player scorecard and see exactly where the points come from.</p><Link className="light-link" href="/match-centre">OPEN MATCH CENTRE ↗</Link></div>
 <section className="section inner-section"><div className="section-head"><div><p className="kicker">FANTASY RULES / V2</p><h2>THE POINTS<br/><em>PLAYBOOK.</em></h2></div><p>All rules are proposed S3V XI defaults, not CricHeroes MVP ratings. Milestones are non-cumulative: only the highest achieved bonus counts.</p></div>
 <div className="rules-grid">{rules.map(group=><div className="rule-group" key={group.group}><h3>{group.group}</h3>{group.items.map(([label,points])=><div className="rule-line" key={label}><span>{label}</span><b>{points}</b></div>)}</div>)}</div>
 <div className="rules-notes"><p><strong>Important:</strong> Bowler wickets exclude run-outs. Catches include caught-behind and caught-and-bowled, and must be counted only once. Duck penalties require confirmed BAT/AR roles and an actual dismissal. Unknown roles do not receive an assumed duck penalty.</p><p>Captain = 2×, vice-captain = 1.5×, Skipper x3 replaces captain's 2× with 3×. Full Squad counts 15 eligible players instead of 11. Chips do not stack. Per-match player points are distinct from an individual's fantasy XI total.</p></div>
 <PointsCalculator/></section></main>}
