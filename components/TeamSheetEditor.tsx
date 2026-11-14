"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { POSITIONS, POSITION_LABEL, ROSTER, type Player } from "@/config/club";
import { parseTeamSheet } from "@/lib/league/teamSheet";
import { api } from "./api";

import type { Side } from "@/lib/league/types";
const TEAM: Record<Side, string> = { A: "White", B: "Red" };

/** Roster grouped by Pick 7 position, then anyone without one. */
const GROUPS: { label: string; players: Player[] }[] = [
  ...POSITIONS.map((pos) => ({ label: POSITION_LABEL[pos].many, players: ROSTER.filter((p) => p.position === pos) })),
  { label: "Others", players: ROSTER.filter((p) => !p.position) },
].filter((g) => g.players.length);

export function TeamSheetEditor({
  matchId,
  initialA,
  initialB,
  locked,
}: {
  matchId: string;
  initialA: string[];
  initialB: string[];
  /** Scorecard is in: teams are final. */
  locked: boolean;
}) {
  const router = useRouter();
  const [side, setSide] = useState<Record<string, Side | undefined>>(() => ({
    ...Object.fromEntries(initialA.map((id) => [id, "A" as const])),
    ...Object.fromEntries(initialB.map((id) => [id, "B" as const])),
  }));
  const [paste, setPaste] = useState("");
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const teamA = useMemo(() => ROSTER.filter((p) => side[p.id] === "A").map((p) => p.id), [side]);
  const teamB = useMemo(() => ROSTER.filter((p) => side[p.id] === "B").map((p) => p.id), [side]);
  const dirty =
    teamA.length !== initialA.length ||
    teamB.length !== initialB.length ||
    teamA.some((id) => !initialA.includes(id)) ||
    teamB.some((id) => !initialB.includes(id));

  const set = (id: string, s: Side | undefined) => setSide((x) => ({ ...x, [id]: s }));

  return (
    <div className="stack">
      <div className="sheet-count" aria-live="polite">
        <span><span className="bib bib-A" aria-hidden="true" /> {TEAM.A} <b className="num">{teamA.length}</b></span>
        <span><span className="bib bib-B" aria-hidden="true" /> {TEAM.B} <b className="num">{teamB.length}</b></span>
        <span className="muted small">{ROSTER.length - teamA.length - teamB.length} not playing</span>
      </div>

      {!locked && (
        <details className="sheet-paste">
          <summary>Paste the teams from WhatsApp</summary>
          <p className="small muted" style={{ margin: "0.4rem 0" }}>
            Paste both captains&apos; lists. Put a line saying &ldquo;White&rdquo; before the White players and &ldquo;Red&rdquo; before the Red
            ones. Names are matched to the roster; check the result below before saving.
          </p>
          <textarea
            rows={6}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder={"White\nVikram\nRobin\nArchit\n…\n\nRed\nNakul\nTadas\n…"}
            style={{ width: "100%" }}
          />
          <div className="row">
            <button
              type="button"
              className="btn btn-sm"
              disabled={!paste.trim()}
              onClick={() => {
                const { sides, unmatched } = parseTeamSheet(paste);
                const n = Object.keys(sides).length;
                setSide(sides);
                setPasteNote(
                  n === 0
                    ? "No roster names found. Add a “White” and a “Red” line before each list."
                    : `Filled in ${n} player${n > 1 ? "s" : ""}.${unmatched.length ? ` Didn't recognise: ${unmatched.slice(0, 6).join(", ")}${unmatched.length > 6 ? "…" : ""}` : ""}`,
                );
              }}
            >
              Fill in the teams
            </button>
            {pasteNote && <span className="small muted">{pasteNote}</span>}
          </div>
        </details>
      )}

      {GROUPS.map((g) => (
        <div key={g.label}>
          <div className="pos-head" style={{ margin: "0.4rem 0 0.2rem" }}><span>{g.label}</span></div>
          {g.players.map((p) => {
            const s = side[p.id];
            return (
              <div key={p.id} className="sheet-row">
                <span className="sheet-name">
                  {p.name}
                  {p.kind === "dropin" && <span className="badge badge-dropin" style={{ marginLeft: "0.35rem" }}>D</span>}
                </span>
                <span className="seg" role="radiogroup" aria-label={`${p.name}'s team`}>
                  {(["A", "B"] as Side[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={s === t}
                      className={`seg-btn seg-${t}${s === t ? " is-on" : ""}`}
                      disabled={locked}
                      onClick={() => set(p.id, s === t ? undefined : t)}
                    >
                      {TEAM[t]}
                    </button>
                  ))}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!s}
                    className={`seg-btn${!s ? " is-on" : ""}`}
                    disabled={locked}
                    onClick={() => set(p.id, undefined)}
                  >
                    Out
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      ))}

      {!locked && (
        <div className="row">
          <button
            className="btn btn-primary"
            disabled={busy || !teamA.length || !teamB.length || !dirty}
            onClick={async () => {
              setBusy(true);
              setMsg(null);
              try {
                await api(`/api/matchdays/${matchId}/teams`, "PUT", { teamA, teamB });
                setMsg({ ok: true, text: `Saved: ${TEAM.A} ${teamA.length}, ${TEAM.B} ${teamB.length}.` });
                router.refresh();
              } catch (e) {
                setMsg({ ok: false, text: (e as Error).message });
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving…" : initialA.length ? "Save team changes" : "Save team sheet"}
          </button>
          {(!teamA.length || !teamB.length) && <span className="small muted">Put at least one player on each team.</span>}
          {msg && <span className={`small ${msg.ok ? "" : "neg"}`} role="status">{msg.text}</span>}
        </div>
      )}
      {locked && <p className="small muted" style={{ margin: 0 }}>The scorecard is in, so these teams are final.</p>}
    </div>
  );
}
