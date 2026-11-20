"use client";
import Link from "next/link";
import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { BoardRow } from "@/lib/league/tableView";
import { POINT_KIND_LABEL, type ContributionKind } from "@/lib/scoring/rules";
import { GrainOrb } from "./GrainOrb";
import { Mascot } from "./Mascot";
import { fmtDate } from "@/lib/format";
import { reducedMotion } from "@/lib/client/motion";

type SortKey = "points" | "goals" | "assists" | "motm" | "form";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "points", label: "Points" },
  { key: "goals", label: "Goals" },
  { key: "assists", label: "Assists" },
  { key: "motm", label: "Man of the Match" },
  { key: "form", label: "Form" },
];
const KIND_ORDER: ContributionKind[] = ["goal", "assist", "second_assist", "motm", "win", "defence", "fair_play", "own_goal", "rotation"];
const formSum = (r: BoardRow) => r.form.reduce((t, v) => t + v, 0);
const valueOf = (r: BoardRow, k: SortKey) => (k === "form" ? formSum(r) : r[k]);
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

function Move({ r }: { r: BoardRow }) {
  if (r.played === 0) return null;
  if (r.prevRank === null) return <span className="mv mv-new" title="First time on the table">new</span>;
  const d = r.prevRank - r.rank;
  if (d === 0) return <span className="mv mv-same" title="Same place as last week" aria-label="no change">–</span>;
  return (
    <span className={`mv ${d > 0 ? "mv-up" : "mv-down"}`} title={`${d > 0 ? "Up" : "Down"} ${Math.abs(d)} since last week`}>
      <svg viewBox="0 0 8 8" aria-hidden="true"><path d={d > 0 ? "M4 1 7 6H1z" : "M4 7 1 2h6z"} /></svg>
      {Math.abs(d)}
    </span>
  );
}

function Form({ values }: { values: number[] }) {
  if (!values.length) return <span className="muted">–</span>;
  const hi = Math.max(1, ...values.map(Math.abs));
  return (
    <span className="form-bars" aria-label={`Last ${values.length}: ${values.join(", ")} points`}>
      {values.map((v, i) => (
        <i key={i} className={v < 0 ? "neg" : ""} style={{ height: `${Math.max(12, (Math.abs(v) / hi) * 100)}%` }} title={`${v} pts`} />
      ))}
    </span>
  );
}

export function StandingsBoard({ rows, played, through }: { rows: BoardRow[]; played: number; through: string }) {
  const [hot, setHot] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("points");
  const [open, setOpen] = useState<string | null>(null);
  const [showBench, setShowBench] = useState(false);

  const active = useMemo(() => rows.filter((r) => r.played > 0), [rows]);
  const idle = useMemo(() => rows.filter((r) => r.played === 0), [rows]);
  const owners = useMemo(() => active.map((r) => ({ id: r.id, points: r.points })), [active]);
  const total = useMemo(() => active.reduce((t, r) => t + Math.max(0, r.points), 0), [active]);
  const leader = Math.max(1, ...active.map((r) => r.points));
  const podium = active.filter((r) => r.points > 0).slice(0, 3);
  const sorted = useMemo(
    () => (sort === "points" ? active : [...active].sort((a, b) => valueOf(b, sort) - valueOf(a, sort) || a.rank - b.rank)),
    [active, sort],
  );
  const hotRow = hot ? active.find((r) => r.id === hot) : null;

  // FLIP: rows glide to their new places when the sort changes.
  const body = useRef<HTMLTableSectionElement>(null);
  const before = useRef<Map<string, number>>(new Map());
  const changeSort = (k: SortKey) => {
    before.current = new Map();
    body.current?.querySelectorAll<HTMLElement>("tr[data-id]").forEach((tr) => before.current.set(tr.dataset.id!, tr.getBoundingClientRect().top));
    setSort(k);
  };
  useLayoutEffect(() => {
    if (!before.current.size || reducedMotion()) return;
    body.current?.querySelectorAll<HTMLElement>("tr[data-id]").forEach((tr) => {
      const was = before.current.get(tr.dataset.id!);
      if (was === undefined) return;
      const dy = was - tr.getBoundingClientRect().top;
      if (Math.abs(dy) > 1) tr.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 520, easing: "cubic-bezier(.3,.7,.2,1)" });
    });
    before.current = new Map();
  }, [sort]);

  return (
    <>
      <section className="tb-hero">
        <div className="tb-hero-copy">
          <p className="tb-through">{through}</p>
          <h1 className="tb-title">
            The <em>table.</em>
          </h1>
          <p className="lede">
            Every point scored this season is one grain in the orb. Point at a name, or at the orb, to see whose they are.
          </p>
          {podium.length > 0 && (
            <ol className="podium">
              {podium.map((r) => (
                <li key={r.id} onMouseEnter={() => setHot(r.id)} onMouseLeave={() => setHot(null)} className={hot === r.id ? "is-hot" : ""}>
                  <span className="podium-rank num">{r.rank}</span>
                  <a href={`#row-${r.id}`} className="podium-name" onFocus={() => setHot(r.id)} onBlur={() => setHot(null)}>
                    {r.name}
                  </a>
                  <span className="podium-pts num">{r.points}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <figure className="tb-orb">
          <GrainOrb owners={owners} hot={hot} onHover={setHot} />
          <figcaption aria-live="polite">
            {hotRow ? (
              <>
                <b>{hotRow.name}</b>: {Math.max(0, hotRow.points)} of {total} points{total ? ` (${Math.round((Math.max(0, hotRow.points) / total) * 100)}%)` : ""}
              </>
            ) : (
              <>
                <b>{total}</b> points across {played} Thursday{played === 1 ? "" : "s"}
              </>
            )}
          </figcaption>
        </figure>
      </section>

      <section className="board">
        <div className="board-head">
          <h2>Players</h2>
          <div className="board-sort" role="group" aria-label="Sort the table by">
            {SORTS.map((s) => (
              <button key={s.key} type="button" aria-pressed={sort === s.key} onClick={() => changeSort(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table className="board-table">
            <thead>
              <tr>
                <th className="c-rank">#</th>
                <th>Player</th>
                <th className="r hide-sm" title="Played">P</th>
                <th className="r" title="Goals">G</th>
                <th className="r" title="Assists">A</th>
                <th className="r hide-sm" title="Man of the Match">MOTM</th>
                <th className="hide-sm">Form</th>
                <th className="r c-pts">Pts</th>
              </tr>
            </thead>
            <tbody ref={body}>
              {sorted.map((r) => {
                const isOpen = open === r.id;
                const kinds = KIND_ORDER.filter((k) => r.byKind[k]);
                return (
                  <Fragment key={r.id}>
                    <tr
                      data-id={r.id}
                      id={`row-${r.id}`}
                      className={`brow${hot === r.id ? " is-hot" : ""}${isOpen ? " is-open" : ""}`}
                      onMouseEnter={() => setHot(r.id)}
                      onMouseLeave={() => setHot(null)}
                      onClick={() => setOpen(isOpen ? null : r.id)}
                    >
                      <td className="c-rank">
                        <span className="num">{r.rank}{r.shared ? "=" : ""}</span>
                        <Move r={r} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="brow-name"
                          aria-expanded={isOpen}
                          aria-controls={`detail-${r.id}`}
                          onFocus={() => setHot(r.id)}
                          onBlur={() => setHot(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpen(isOpen ? null : r.id);
                          }}
                        >
                          <Mascot id={r.id} variant="head" size={28} />
                          <span>{r.name}</span>
                          {r.dropin && <span className="badge badge-dropin" title="Drop-in">D</span>}
                        </button>
                      </td>
                      <td className="r hide-sm num">{r.played}</td>
                      <td className={`r num${sort === "goals" ? " is-key" : ""}`}>{r.goals}</td>
                      <td className={`r num${sort === "assists" ? " is-key" : ""}`}>{r.assists}</td>
                      <td className={`r hide-sm num${sort === "motm" ? " is-key" : ""}`}>{r.motm}</td>
                      <td className={`hide-sm${sort === "form" ? " is-key" : ""}`}>
                        <Form values={r.form} />
                      </td>
                      <td className="r c-pts">
                        <span className={`num pts${r.points < 0 ? " neg" : ""}`}>{r.points}</span>
                        <span className="share" aria-hidden="true">
                          <i style={{ width: `${Math.max(0, (r.points / leader) * 100)}%` }} />
                        </span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bdetail" id={`detail-${r.id}`}>
                        <td colSpan={8}>
                          <div className="bdetail-inner">
                            <div>
                              <h3>Where {r.name}&apos;s {r.points} points came from</h3>
                              <ul className="kind-list">
                                {kinds.map((k) => (
                                  <li key={k} className={(r.byKind[k] ?? 0) < 0 ? "neg" : ""}>
                                    <span aria-hidden="true">{POINT_KIND_LABEL[k].icon}</span> {POINT_KIND_LABEL[k].label} <b className="num">{signed(r.byKind[k] ?? 0)}</b>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <h3>Thursday by Thursday</h3>
                              <ul className="night-list">
                                {r.nights.map((n) => (
                                  <li key={n.matchId}>
                                    <Link href={`/matches/${n.matchId}`}>{fmtDate(n.date)}</Link>
                                    <b className={`num${n.points < 0 ? " neg" : ""}`}>{signed(n.points)}</b>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {idle.length > 0 && (
          <div className="board-idle">
            <button type="button" className="btn btn-sm" aria-expanded={showBench} onClick={() => setShowBench(!showBench)}>
              {showBench ? "Hide" : "Show"} the {idle.length} who haven&apos;t played yet
            </button>
            {showBench && <p className="small muted">{idle.map((r) => r.name).join(", ")}. They join the table on their first Thursday.</p>}
          </div>
        )}
        <p className="small muted" style={{ margin: "0.75rem 0 0" }}>
          “=” marks a shared rank. Ties split by goals, then assists, then head-to-head. Arrows show the move since the previous Thursday. Click a
          player to see where their points came from.
        </p>
      </section>
    </>
  );
}
