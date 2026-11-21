import { CHIPS, playerName } from "@/config/club";
import type { GwChanges, GwHistoryRow, GwStatus } from "@/lib/league/gameweeks";
import { shortDate } from "@/lib/format";

const name = (id: string | null) => (id === null ? "?" : id === "?" ? "?" : playerName(id));
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** One line for the table cell: "No changes", "2 transfers · new C", "New team". */
export function gwStatusText(g: GwStatus): string {
  if (g.kind === "none") return "–";
  if (g.kind === "new") return "New team";
  if (g.kind === "no_changes") return "No changes";
  const bits = [g.transfers ? plural(g.transfers, "transfer") : null, g.captainChanged ? "new captain" : null].filter(Boolean);
  return bits.length ? bits.join(" · ") : "Tweaked";
}

/** Swaps as "In ← Out" pairs (FPL style), plus armband and bench changes. */
function Changes({ c, hidden }: { c: GwChanges; hidden: boolean }) {
  if (c.newTeam) return <span className="muted">First team</span>;
  if (!c.changed) return <span className="muted">No changes</span>;
  if (hidden) {
    const bits = [c.transfers ? plural(c.transfers, "transfer") : null, c.captain ? "new captain" : null, c.vice ? "new vice" : null, c.bench ? "new bench" : null];
    return (
      <span>
        {bits.filter(Boolean).join(" · ")} <span className="muted">· revealed at kick-off</span>
      </span>
    );
  }
  return (
    <ul className="gw-swaps">
      {c.in.map((id, i) => (
        <li key={id}>
          <b className="gw-in">{name(id)}</b> <span className="muted">for</span> <span className="gw-out">{name(c.out[i] ?? null)}</span>
        </li>
      ))}
      {c.captain && (
        <li>
          Captain <span className="gw-out">{name(c.captain.from)}</span> → <b>{name(c.captain.to)}</b>
        </li>
      )}
      {c.vice && (
        <li>
          Vice <span className="gw-out">{c.vice.from ? name(c.vice.from) : "none"}</span> → <b>{c.vice.to ? name(c.vice.to) : "none"}</b>
        </li>
      )}
      {c.bench && (
        <li>
          Bench <span className="gw-out">{c.bench.from ? name(c.bench.from) : "none"}</span> → <b>{c.bench.to ? name(c.bench.to) : "none"}</b>
        </li>
      )}
    </ul>
  );
}

/**
 * FPL-style team history: one row per gameweek, newest first. A week that hasn't
 * locked shows counts only unless `owner` (then names, marked "not locked yet").
 */
export function GwHistory({ rows, owner = false }: { rows: GwHistoryRow[]; owner?: boolean }) {
  if (!rows.length) return <p className="small muted" style={{ margin: 0 }}>No team picked yet.</p>;
  return (
    <div className="table-wrap">
      <table className="gw-table">
        <thead>
          <tr>
            <th>GW</th>
            <th>Changes</th>
            <th className="hide-sm">Chip</th>
            <th className="r">Pts</th>
          </tr>
        </thead>
        <tbody>
          {[...rows].reverse().map((r) => (
            <tr key={r.matchId} className={r.locked ? "" : "gw-open"}>
              <td className="gw-n">
                <b>GW{r.n}</b>
                <span className="muted">{shortDate(r.date)}</span>
                {!r.locked && <span className="gw-tag">{owner ? "Not locked" : "Open"}</span>}
              </td>
              <td>{r.changes ? <Changes c={r.changes} hidden={!r.locked && !owner} /> : <span className="muted">Not entered</span>}</td>
              <td className="hide-sm">{r.team?.chip ? CHIPS[r.team.chip].label : <span className="muted">–</span>}</td>
              <td className="r num">{r.points ?? <span className="muted">–</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
