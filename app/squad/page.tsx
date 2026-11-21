import type { Metadata } from "next";
import Link from "next/link";
import { POSITIONS, POSITION_LABEL, isDropIn, type Position } from "@/config/club";
import { Kicker } from "@/components/ui";
import { Mascot } from "@/components/Mascot";
import {
  FACE_LABEL,
  FACE_STATS,
  SKILLS,
  SQUAD_RATINGS,
  tier,
  type FaceStat,
  type PlayerRating,
} from "@/lib/league/ratings";

export const metadata: Metadata = { title: "Squad ratings" };

type Sort = "OVR" | FaceStat;
const SORTS: readonly Sort[] = ["OVR", ...FACE_STATS];

/** Background for a 25–94 rating: bone at the bottom, club forest at the top. */
const heat = (v: number) => {
  const pct = Math.round(Math.max(0, Math.min(1, (v - 40) / 50)) * 78);
  return { background: `color-mix(in oklab, var(--s1) ${pct}%, var(--surface))`, color: pct > 45 ? "var(--bone)" : undefined };
};

function href(q: { pos?: string; sort?: string; view?: string }) {
  const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]);
  const s = p.toString();
  return s ? `/squad?${s}` : "/squad";
}

function Pips({ n, label }: { n: number; label: string }) {
  return (
    <span className="fut-pips" aria-label={`${label} ${n} of 5`}>
      <b aria-hidden="true">{"★".repeat(n)}</b>
      <span aria-hidden="true">{"★".repeat(5 - n)}</span>
    </span>
  );
}

function Card({ r }: { r: PlayerRating }) {
  return (
    <article className={`fut fut-${tier(r.ovr)}`} id={r.id}>
      <header className="fut-top">
        <span className="fut-ovr">{r.ovr}</span>
        <span className="fut-pos">{r.position}</span>
        <Mascot id={r.id} size={88} className="fut-mascot" />
      </header>
      <h2 className="fut-name">
        {r.name}
        {isDropIn(r.id) && <span className="fut-dropin"> · drop-in</span>}
      </h2>
      <dl className="fut-face">
        {FACE_STATS.map((g) => (
          <div key={g} title={FACE_LABEL[g]}>
            <dd>{r.face[g]}</dd>
            <dt>{g}</dt>
          </div>
        ))}
      </dl>
      <details className="fut-more">
        <summary>{r.style} · all 29 skills</summary>
        <div className="fut-meta">
          <span>Skill moves <Pips n={r.skillMoves} label="Skill moves" /></span>
          <span>Weak foot <Pips n={r.weakFoot} label="Weak foot" /></span>
          <span>{r.foot} foot · work rate {r.workRate.att}/{r.workRate.def}</span>
          <span className="fut-traits">{r.traits.join(" · ")}</span>
        </div>
        <div className="fut-skills">
          {FACE_STATS.map((g) => (
            <section key={g}>
              <h3>
                {FACE_LABEL[g]} <b>{r.face[g]}</b>
              </h3>
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
    </article>
  );
}

function Matrix({ rows }: { rows: PlayerRating[] }) {
  return (
    <div className="skill-matrix-wrap" tabIndex={0} aria-label="Skill matrix, scrolls sideways">
      <table className="skill-matrix">
        <thead>
          <tr>
            <th rowSpan={2} className="sm-name">Player</th>
            <th rowSpan={2}>OVR</th>
            {FACE_STATS.map((g) => (
              <th key={g} colSpan={SKILLS[g].length} className="sm-group">{FACE_LABEL[g]}</th>
            ))}
          </tr>
          <tr>
            {FACE_STATS.flatMap((g) =>
              SKILLS[g].map((s, i) => (
                <th key={s} className={`sm-skill${i === 0 ? " sm-first" : ""}`}><span>{s}</span></th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <th className="sm-name" scope="row">
                <a href={`#${r.id}`}>{r.name}</a> <small>{r.position}</small>
              </th>
              <td className="sm-ovr">{r.ovr}</td>
              {FACE_STATS.flatMap((g) =>
                SKILLS[g].map((s, i) => (
                  <td key={s} style={heat(r.skills[s])} className={i === 0 ? "sm-first" : undefined}>{r.skills[s]}</td>
                )),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function SquadPage({ searchParams }: { searchParams: Promise<{ pos?: string; sort?: string; view?: string }> }) {
  const q = await searchParams;
  const pos = POSITIONS.includes(q.pos as Position) ? (q.pos as Position) : null;
  const sort: Sort = SORTS.includes(q.sort as Sort) ? (q.sort as Sort) : "OVR";
  const view = q.view === "matrix" ? "matrix" : "cards";

  const rows = SQUAD_RATINGS.filter((r) => !pos || r.position === pos).toSorted((a, b) => {
    const d = sort === "OVR" ? b.ovr - a.ovr : b.face[sort] - a.face[sort];
    return d || b.ovr - a.ovr || a.name.localeCompare(b.name);
  });
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.ovr, 0) / rows.length) : 0;

  return (
    <main className="wrap stack-lg">
      <header className="stack">
        <Kicker label="The squad" no="Ratings" />
        <h1>
          Every player, <em>rated.</em>
        </h1>
        <p className="lede">
          FIFA-style cards for the whole roster: six headline stats built from 29 skills. They start from what the club knows about
          each player, the dice fill in the detail, and they don&apos;t affect points or Pick 7 stars.
        </p>
      </header>

      <nav className="stack squad-controls" aria-label="Filter and sort">
        <div className="row" role="group" aria-label="Position">
          <Link className="chip" aria-current={(!pos) ? "true" : undefined} href={href({ sort: sort === "OVR" ? undefined : sort, view: view === "matrix" ? view : undefined })}>
            All
          </Link>
          {POSITIONS.map((p) => (
            <Link key={p} className="chip" aria-current={(pos === p) ? "true" : undefined} href={href({ pos: p, sort: sort === "OVR" ? undefined : sort, view: view === "matrix" ? view : undefined })}>
              {POSITION_LABEL[p].many}
            </Link>
          ))}
        </div>
        <div className="row" role="group" aria-label="Sort by">
          <span className="muted">Sort</span>
          {SORTS.map((s) => (
            <Link key={s} className="chip chip-sm" aria-current={(sort === s) ? "true" : undefined} href={href({ pos: pos ?? undefined, sort: s === "OVR" ? undefined : s, view: view === "matrix" ? view : undefined })}>
              {s}
            </Link>
          ))}
        </div>
        <div className="row" role="group" aria-label="View">
          <Link className="chip chip-sm" aria-current={(view === "cards") ? "true" : undefined} href={href({ pos: pos ?? undefined, sort: sort === "OVR" ? undefined : sort })}>
            Cards
          </Link>
          <Link className="chip chip-sm" aria-current={(view === "matrix") ? "true" : undefined} href={href({ pos: pos ?? undefined, sort: sort === "OVR" ? undefined : sort, view: "matrix" })}>
            Skill matrix
          </Link>
          <span className="muted">
            {rows.length} players · average {avg}
          </span>
        </div>
      </nav>

      {view === "matrix" && <Matrix rows={rows} />}
      <div className="fut-grid">
        {rows.map((r) => (
          <Card key={r.id} r={r} />
        ))}
      </div>
    </main>
  );
}
