"use client";
import { useState } from "react";
import type { Leaderboard, LeaderboardRow } from "@/lib/league/service";
import { CountUp } from "./CountUp";

const MEDALS = ["🥇", "🥈", "🥉"];

function Movement({ value }: { value: number | null }) {
  if (value === null) return <span className="lg-move same" aria-label="New this round">–</span>;
  if (value > 0) return <span className="lg-move up" aria-label={`Up ${value}`}>▲{value}</span>;
  if (value < 0) return <span className="lg-move down" aria-label={`Down ${-value}`}>▼{-value}</span>;
  return <span className="lg-move same" aria-label="No change">=</span>;
}

type View = { row: LeaderboardRow; rank: number; tied: boolean; points: number };

function rankBy(rows: LeaderboardRow[], points: (r: LeaderboardRow) => number): View[] {
  const sorted = [...rows].sort((a, b) => points(b) - points(a) || b.exact - a.exact || a.name.localeCompare(b.name));
  let rank = 0;
  return sorted.map((row, i) => {
    if (i === 0 || points(sorted[i - 1]) !== points(row)) rank = i + 1;
    const p = points(row);
    return { row, rank, points: p, tied: sorted.filter((r) => points(r) === p).length > 1 };
  });
}

export function LeaderboardView({ board, meId, compact = false }: { board: Leaderboard; meId: string; compact?: boolean }) {
  const [tab, setTab] = useState<string>("overall");
  const roundName = board.rounds.find((r) => r.id === tab)?.name;
  const views = tab === "overall" ? rankBy(board.rows, (r) => r.total) : rankBy(board.rows, (r) => r.perRound[tab] ?? 0);
  const anyPoints = board.rows.some((r) => r.played > 0);

  if (!anyPoints) {
    return (
      <div className="lg-card lg-empty">
        <div className="big">🏟️</div>
        <h3>The table is spotless</h3>
        <p className="lg-muted">No results are in yet. Get your picks in and check back after the final whistle.</p>
      </div>
    );
  }

  // Podium: 2nd, 1st, 3rd so the winner stands tallest in the middle.
  const top = views.slice(0, 3);
  const podium = [top[1], top[0], top[2]].filter(Boolean) as View[];
  const list = compact ? views.slice(0, 5) : views;

  return (
    <>
      {!compact && board.rounds.length > 0 && (
        <div className="lg-tabs" role="group" aria-label="Choose standings">
          <button type="button" aria-pressed={tab === "overall"} onClick={() => setTab("overall")}>Overall</button>
          {[...board.rounds].reverse().map((r) => (
            <button key={r.id} type="button" aria-pressed={tab === r.id} onClick={() => setTab(r.id)}>{r.name}</button>
          ))}
        </div>
      )}
      <div className="lg-podium" key={tab}>
        {podium.map((v) => {
          const place = v.rank <= 3 ? v.rank : 3;
          const cls = v === top[0] ? "p1" : v === top[1] ? "p2" : "p3";
          return (
            <div key={v.row.id} className={`lg-step ${cls}`}>
              <span className="ava" aria-hidden="true">{v.row.avatar}</span>
              <span className="who">{v.row.name}{v.row.id === meId ? " (you)" : ""}</span>
              <div className="lg-block">
                <span className="medal" aria-hidden="true">{MEDALS[place - 1]}</span>
                <b className="num"><CountUp value={v.points} /></b>
                <small>{v.tied ? `Joint ${ordinal(v.rank)}` : ordinal(v.rank)}</small>
              </div>
            </div>
          );
        })}
      </div>
      <ol className="lg-table" aria-label={tab === "overall" ? "Overall standings" : `${roundName} standings`} style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {list.map((v) => (
          <li key={v.row.id} className={`lg-trow${v.row.id === meId ? " me" : ""}`}>
            <div className="lg-rank num">{v.tied ? `=${v.rank}` : v.rank}{v.rank <= 3 && <small aria-hidden="true">{MEDALS[v.rank - 1]}</small>}</div>
            <div className="lg-who">
              <span className="ava" aria-hidden="true">{v.row.avatar}</span>
              <div style={{ minWidth: 0 }}>
                <strong>{v.row.name}{v.row.id === meId ? " (you)" : ""}</strong>
                {v.row.achievements.length > 0 && (
                  <div className="lg-badges">
                    {v.row.achievements.map((a) => <span key={a.id} className="lg-badge" title={a.detail}>{a.emoji} {a.title}</span>)}
                  </div>
                )}
              </div>
            </div>
            {tab === "overall" ? <Movement value={v.row.movement} /> : <span />}
            <div className="lg-total num"><CountUp value={v.points} /><small>pts</small></div>
            {!compact && tab === "overall" && (
              <div className="lg-split">
                <span>🎯 <b>{v.row.exact}</b> exact</span>
                <span>✅ <b>{v.row.outcome}</b> right result</span>
                <span>❌ <b>{v.row.miss}</b> missed</span>
                {board.rounds.map((r) => <span key={r.id}>{r.name}: <b>{v.row.perRound[r.id] ?? 0}</b></span>)}
              </div>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
