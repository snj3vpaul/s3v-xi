import type { Metadata } from "next";
import type React from "react";
import Link from "next/link";
import { POSITIONS, POSITION_LABEL, isDropIn, type Position } from "@/config/club";
import { Kicker } from "@/components/ui";
import { Mascot } from "@/components/Mascot";
import { AnimePortrait } from "@/components/AnimePortrait";
import { HoloCard } from "@/components/HoloCard";
import { portraitFor } from "@/config/portraits";
import { FACE_LABEL, FACE_STATS, SKILLS, type FaceStat } from "@/lib/league/ratings";
import { formMoves, squadWithForm, type FormRating } from "@/lib/league/ratingForm";
import { deriveSeason } from "@/lib/league/derive";
import { getState } from "@/lib/server/store";
import { simulateSeason } from "@/lib/league/simulate";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "The squad" };

/**
 * The squad page is deliberately not a ranking: no overall number, no tiers, no
 * best-to-worst order, and form only shows when it's good news. Each player's
 * shape (the spider web) is the headline; the numbers sit one tap away.
 * OVR, scouting order and form still exist underneath (lib/league/ratings*.ts).
 */

/**
 * Web scale: square-root from 25 (the lowest a skill can be) to 95 at the rim. Order along each
 * spoke is kept, but gaps are squeezed, so a defender's web still looks like a full player
 * next to an all-rounder's and the shape tells the story rather than the size.
 */
const WEB_MIN = 25;
const WEB_MAX = 95;
const SIGNATURE = new Set(["Box to box", "Clinical finisher", "Ball winner", "Finesse shot", "Leadership", "Long shot taker"]);

/** The player's two strongest areas, in words. */
function strengths(face: Record<FaceStat, number>): FaceStat[] {
  return [...FACE_STATS].sort((a, b) => face[b] - face[a]).slice(0, 2);
}
const strengthsText = (face: Record<FaceStat, number>) => strengths(face).map((g) => FACE_LABEL[g].toLowerCase()).join(" and ");

function Web({ face, size = 168 }: { face: Record<FaceStat, number>; size?: number }) {
  const c = 50;
  const R = 34;
  const pt = (i: number, f: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / FACE_STATS.length;
    return [c + Math.cos(a) * R * f, c + Math.sin(a) * R * f] as const;
  };
  const frac = (v: number) => Math.sqrt(Math.max(0.01, Math.min(1, (v - WEB_MIN) / (WEB_MAX - WEB_MIN))));
  const ring = (f: number) => FACE_STATS.map((_, i) => pt(i, f).join(",")).join(" ");
  const shape = FACE_STATS.map((g, i) => pt(i, frac(face[g])).join(",")).join(" ");
  return (
    <svg className="web" viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`Strongest at ${strengthsText(face)}`}>
      {[1, 0.66, 0.33].map((f) => (
        <polygon key={f} points={ring(f)} className="web-ring" />
      ))}
      {FACE_STATS.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} className="web-spoke" />;
      })}
      <polygon points={shape} className="web-shape" />
      {FACE_STATS.map((g, i) => {
        const [x, y] = pt(i, 1.24);
        return (
          <text key={g} x={x} y={y} className="web-label" textAnchor="middle" dominantBaseline="middle">
            {g}
          </text>
        );
      })}
    </svg>
  );
}

function Card({ r }: { r: FormRating }) {
  const inForm = !r.form.fixed && r.form.total > 0;
  const tags = [r.style, ...r.traits.filter((t) => SIGNATURE.has(t))].slice(0, 3);
  const look = portraitFor(r.id);
  const phase = (r.id.length * 0.9) % 5;
  const badge = inForm && (
    <span className="fut-tag">
      <span className="fut-form is-up" title="Playing well lately">In form ▲</span>
    </span>
  );
  return (
    <HoloCard
      id={r.id}
      className={`fut fut-${r.position.toLowerCase()}${look ? " fut-has-portrait" : ""}`}
      style={{ "--pt-phase": `${phase}s` } as React.CSSProperties}
      idle={!!look}
      phase={phase}
    >
      {look ? (
        <header className="fut-stage">
          <span className="fut-rays" aria-hidden="true" />
          <span className="fut-sparks" aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => (
              <i key={i} style={{ "--i": i } as React.CSSProperties} />
            ))}
          </span>
          <AnimePortrait id={r.id} look={look} phase={phase} className="fut-portrait" />
          <span className="fut-stage-pos">{r.position}</span>
          {badge}
        </header>
      ) : (
        <header className="fut-top">
          <span className="fut-pos">{r.position}</span>
          {badge}
          <Mascot id={r.id} size={64} className="fut-mascot" />
        </header>
      )}
      <h2 className="fut-name">
        {r.name}
        {isDropIn(r.id) && <span className="fut-dropin"> · drop-in</span>}
      </h2>
      <p className="fut-tags">{tags.join(" · ")}</p>
      <Web face={r.face} />
      <p className="fut-best">Best at {strengthsText(r.face)}</p>
      <details className="fut-more">
        <summary>The numbers</summary>
        <dl className="fut-face">
          {FACE_STATS.map((g) => (
            <div key={g} title={FACE_LABEL[g]}>
              <dd>{r.face[g]}</dd>
              <dt>{g}</dt>
            </div>
          ))}
        </dl>
        <div className="fut-meta">
          <span>Skill moves {r.skillMoves}/5 · weak foot {r.weakFoot}/5</span>
          <span>{r.foot} foot · work rate {r.workRate.att}/{r.workRate.def}</span>
          <span className="fut-traits">{r.traits.join(" · ")}</span>
        </div>
        <div className="fut-skills">
          {FACE_STATS.map((g) => (
            <section key={g}>
              <h3>{FACE_LABEL[g]}</h3>
              <ul>
                {SKILLS[g].map((s) => (
                  <li key={s}>
                    <span>{s}</span>
                    <span className="fut-bar" aria-hidden="true">
                      <i style={{ width: `${r.skills[s]}%` }} />
                    </span>
                    <b>{r.skills[s]}</b>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </details>
      <span className="fut-glare" aria-hidden="true" />
    </HoloCard>
  );
}

export default async function SquadPage({ searchParams }: { searchParams: Promise<{ pos?: string; example?: string }> }) {
  const q = await searchParams;
  const pos = POSITIONS.includes(q.pos as Position) ? (q.pos as Position) : null;
  const exampleSeed = q.example?.replace(/[^a-z0-9]/gi, "").slice(0, 12) || null;
  const state = exampleSeed ? simulateSeason(exampleSeed, 6).state : await getState();
  const { played, standings } = deriveSeason(state);
  const squad = squadWithForm(formMoves(played, standings));

  // Grouped by position, alphabetical inside: no pecking order.
  const groups = POSITIONS.filter((p) => !pos || p === pos).map((p) => ({
    pos: p,
    players: squad.filter((r) => r.position === p).toSorted((a, b) => a.name.localeCompare(b.name)),
  }));
  const href = (p?: Position) => {
    const s = new URLSearchParams({ ...(exampleSeed ? { example: exampleSeed } : {}), ...(p ? { pos: p } : {}) }).toString();
    return s ? `/squad?${s}` : "/squad";
  };

  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <Kicker label="The squad" no="Player webs" />
        <h1>
          Every player, <em>their shape.</em>
        </h1>
        <p className="lede">
          No rankings here. Each web shows what a player brings: pace, shooting, passing, dribbling, defending and
          physical. The further it reaches along a spoke, the stronger they are there. Tap &ldquo;The numbers&rdquo; for
          the detail. Webs shift a little with form, and none of it affects points or Pick 7.
        </p>
      </header>

      <nav className="row squad-controls" aria-label="Position">
        <Link className="chip" aria-current={!pos ? "true" : undefined} href={href()}>
          Everyone
        </Link>
        {POSITIONS.map((p) => (
          <Link key={p} className="chip" aria-current={pos === p ? "true" : undefined} href={href(p)}>
            {POSITION_LABEL[p].many}
          </Link>
        ))}
      </nav>

      {groups.map((g) =>
        g.players.length ? (
          <section key={g.pos} className="stack" aria-labelledby={`pos-${g.pos}`}>
            <h2 id={`pos-${g.pos}`} className="squad-group">
              {POSITION_LABEL[g.pos].many} <span className="muted">{g.players.length}</span>
            </h2>
            <div className="fut-grid">
              {g.players.map((r) => (
                <Card key={r.id} r={r} />
              ))}
            </div>
          </section>
        ) : null,
      )}
    </main>
  );
}
