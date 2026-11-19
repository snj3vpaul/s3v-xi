import Link from "next/link";
import { getPlayer, playerName, POSITION_LABEL } from "@/config/club";
import { Mascot } from "@/components/Mascot";
import type { CaptaincyNews as News } from "@/lib/league/captaincy";

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);
const teamWord = (n: number) => (n === 1 ? "team" : "teams");

/**
 * FPL Draft-style "breaking news" strip for the most-captained player: a
 * headline with the stat line (selected by / armbands), and a scrolling
 * ticker underneath. Pure CSS motion; static under reduced motion.
 */
export function CaptaincyNews({ news }: { news: News }) {
  const { playerId, teams, selectedBy, captainedBy, seasonArmbands } = news;
  const name = playerName(playerId);
  const pos = getPlayer(playerId)?.position;
  const sel = pct(selectedBy, teams);

  const ticker = [
    `${name} is in ${selectedBy} of ${teams} ${teamWord(teams)}`,
    `Selected by ${sel}% of managers`,
    `${captainedBy} ${captainedBy === 1 ? "manager hands" : "managers hand"} ${name} the armband`,
    seasonArmbands > 0 ? `${seasonArmbands} armband${seasonArmbands === 1 ? "" : "s"} worn this season` : "First armbands go on at kick-off",
    "Captains score double. Choose wisely.",
    "Respect · No hard fouls · A fun 60 minutes",
  ];

  return (
    <section className="news theme-night" aria-labelledby="news-headline">
      <div className="wrap news-inner">
        <div className="news-flag">
          <span className="news-pill"><span className="news-dot" aria-hidden="true" />Breaking</span>
          <span className="news-desk">RSFC Draft News</span>
        </div>

        <div className="news-story">
          <Mascot id={playerId} variant="head" size={56} />
          <div className="news-copy">
            <h2 id="news-headline" className="news-headline">
              <b className="num">{selectedBy}</b> of <b className="num">{teams}</b> {teamWord(teams)} have selected{" "}
              <em>{name}</em>, the league&apos;s most-captained player
            </h2>
            <dl className="news-stats">
              <div><dt>Selected by</dt><dd className="num">{sel}%</dd></div>
              <div><dt>Captain in</dt><dd className="num">{captainedBy}<small>/{teams}</small></dd></div>
              <div><dt>Season armbands</dt><dd className="num">{seasonArmbands}</dd></div>
              {pos && <div><dt>Position</dt><dd>{POSITION_LABEL[pos].one}</dd></div>}
            </dl>
          </div>
          <Link className="news-cta text-link" href="/team">Pick your seven <span aria-hidden="true">→</span></Link>
        </div>
      </div>

      <div className="news-ticker" aria-hidden="true">
        <div className="news-track">
          {[0, 1].map((copy) => (
            <ul key={copy}>
              {ticker.map((t, i) => (
                <li key={i}><span className="news-sep">C</span>{t}</li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
