"use client";
import Link from "next/link";
import type { SelectorBreakdown } from "@/lib/league/pick7Table";
import { POINT_KIND_LABEL, type ContributionKind } from "@/lib/scoring/rules";

const ORDER: ContributionKind[] = ["goal", "assist", "second_assist", "win", "motm", "fair_play", "captain", "own_goal", "rotation"];
const fmtDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/**
 * "Where did my points come from?" — a season bar by source, then every round
 * with each pick's points itemised. Chips carry the exact reason as a tooltip.
 */
export function PointsBreakdown({ data, openFirst = true, example = false }: { data: SelectorBreakdown; openFirst?: boolean; example?: boolean }) {
  if (!data.rounds.length) return <p className="small muted" style={{ margin: 0 }}>No played rounds yet. You&apos;re on 0 until a match you picked for is played.</p>;
  const kinds = ORDER.filter((k) => data.byKind[k]);
  const pos = kinds.filter((k) => (data.byKind[k] ?? 0) > 0);
  const neg = kinds.filter((k) => (data.byKind[k] ?? 0) < 0);
  const posTotal = pos.reduce((t, k) => t + (data.byKind[k] ?? 0), 0) || 1;

  return (
    <div className="stack" style={{ gap: "0.75rem" }}>
      <div>
        <div className="pos-head"><span>Where the points came from</span><span className="num">{data.total} pts</span></div>
        <div className="source-bar" role="img" aria-label={kinds.map((k) => `${POINT_KIND_LABEL[k].label} ${signed(data.byKind[k]!)}`).join(", ")}>
          {pos.map((k) => (
            <span key={k} className={`src src-${k}`} style={{ flexGrow: data.byKind[k] }} title={`${POINT_KIND_LABEL[k].label} ${signed(data.byKind[k]!)}`} />
          ))}
        </div>
        <div className="source-legend">
          {kinds.map((k) => (
            <span key={k} className={(data.byKind[k] ?? 0) < 0 ? "neg" : ""}>
              <i className={`src src-${k}`} aria-hidden="true" /> {POINT_KIND_LABEL[k].icon} {POINT_KIND_LABEL[k].label}{" "}
              <b className="num">{signed(data.byKind[k]!)}</b>
              {(data.byKind[k] ?? 0) > 0 && <span className="muted"> ({Math.round(((data.byKind[k] ?? 0) / posTotal) * 100)}%)</span>}
            </span>
          ))}
          {neg.length === 0 && <span className="muted">No penalties</span>}
        </div>
      </div>

      {data.rounds.map((r, i) => (
        <details key={r.matchId} className="round" open={openFirst && i === 0}>
          <summary>
            <span>{fmtDate(r.date)} · <span className="muted">{r.result}</span></span>
            <b className="num">{r.total} pts</b>
          </summary>
          <ul className="breakdown-list">
            {r.picks.map((p) => (
              <li key={p.playerId}>
                <span className="bd-name">
                  {p.name}
                  {p.captain && <span className="cap-badge" title="Captain: points count double">C</span>}
                </span>
                <span className="bd-items">
                  {!p.played ? (
                    <span className="bd-dnp">Didn&apos;t play</span>
                  ) : p.items.length ? (
                    p.items.map((it, k) => (
                      <span key={k} className={`bd-chip${it.points < 0 ? " neg" : ""}`} title={it.detail}>
                        {POINT_KIND_LABEL[it.kind].icon} {signed(it.points)}
                        <span className="sr-only"> {it.detail}</span>
                      </span>
                    ))
                  ) : (
                    <span className="bd-dnp">Played, no points</span>
                  )}
                </span>
                <b className={`bd-total num${p.total < 0 ? " neg" : ""}`}>{p.total}</b>
              </li>
            ))}
          </ul>
          <p className="small muted" style={{ margin: "0.4rem 0 0" }}>
            {!example && <><Link href={`/matches/${r.matchId}`}>Match report</Link> · </>}
            <Link href="/rules">How is this scored?</Link>
            {r.corrections > 0 && ` · Scorecard corrected ${r.corrections}× since first published (reasons in the match report)`}
          </p>
        </details>
      ))}
    </div>
  );
}
