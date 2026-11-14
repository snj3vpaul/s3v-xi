"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CLUB, FORMATION, PICK7, PICKABLE, POSITIONS, POSITION_LABEL, getPlayer, playerName, type Position } from "@/config/club";
import { checkTeam, isFormationValid, starsTotal, type StarMap } from "@/lib/league/pick7";
import { api } from "./api";
import { emitPick7 } from "./pick7Live";
import { Mascot } from "./Mascot";

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Fixed-position copy of an element's mascot, used for flights between the squad and the slots. */
function ghostOf(svg: Element, rect: DOMRect): HTMLDivElement {
  const g = document.createElement("div");
  g.className = "mascot-ghost";
  Object.assign(g.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
  const copy = svg.cloneNode(true) as SVGElement;
  copy.style.width = "100%";
  copy.style.height = "100%";
  g.appendChild(copy);
  document.body.appendChild(g);
  return g;
}

interface PickerProps {
  /** Picks to start the editor with (an old seven already trimmed to what fits the formation). */
  initial: string[];
  /** The user's saved seven exactly as stored (for "dirty" and the over-budget allowance). */
  saved: string[];
  /** The saved captain (one of `saved`), if any. */
  savedCaptain: string | null;
  /** Current star rating per player. */
  stars: StarMap;
  /** Last locked round's ownership share per player (0..1). */
  ownership: Record<string, number>;
  deadlineLabel: string | null;
}

const starStr = (n: number) => "★".repeat(n);

export function TeamPicker({ initial, saved, savedCaptain, stars, ownership, deadlineLabel }: PickerProps) {
  const router = useRouter();
  const [picks, setPicks] = useState<string[]>(initial);
  /** Exactly one of the seven: their points count double. */
  const [captain, setCaptain] = useState<string | null>(savedCaptain && initial.includes(savedCaptain) ? savedCaptain : null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [said, setSaid] = useState("");
  /** A player tapped while their position was full: choose who they replace. */
  const [swapIn, setSwapIn] = useState<string | null>(null);
  /** Two-step removal: first tap arms it, second tap removes. */
  const [confirmRemove, setConfirmRemove] = useState(false);
  const need = CLUB.picksPerSelector;
  const dirty = picks.length !== saved.length || picks.some((p) => !saved.includes(p)) || captain !== savedCaptain;
  const toggleCaptain = (id: string) => {
    const next = captain === id ? null : id;
    setCaptain(next);
    setSaid(next ? `${playerName(id)} is your captain: their points count double.` : "Captain removed. Choose one before saving.");
  };

  const check = checkTeam(picks, stars, saved);
  const total = check.starsTotal;
  const savedTotal = isFormationValid(saved) ? starsTotal(saved, stars) : 0;
  /** Over-budget teams may be changed, but never to a higher total. */
  const cap = Math.max(PICK7.starBudget, savedTotal);
  const complete = picks.length === need;
  const posOf = (id: string) => getPlayer(id)?.position ?? null;
  const picksIn = (pos: Position) => picks.filter((id) => posOf(id) === pos);

  const slotsRef = useRef<HTMLDivElement>(null);
  /** Where each slotted mascot was before the last change (for the FLIP shuffle). */
  const before = useRef<Map<string, DOMRect>>(new Map());
  /** A mascot that should fly in from its squad chip after the next render. */
  const incoming = useRef<{ id: string; from: DOMRect } | null>(null);

  const slotMascot = (id: string) => slotsRef.current?.querySelector<SVGElement>(`[data-slot="${id}"] .mascot`) ?? null;

  const snapshot = () => {
    before.current = new Map();
    slotsRef.current?.querySelectorAll<HTMLElement>("[data-slot]").forEach((el) => {
      const svg = el.querySelector(".mascot");
      if (svg) before.current.set(el.dataset.slot!, svg.getBoundingClientRect());
    });
  };

  const tumble = (id: string) => {
    const svg = slotMascot(id);
    if (!svg || reducedMotion()) return;
    // Tumble out: a little hop, then fall off the bench and spin away.
    const g = ghostOf(svg, svg.getBoundingClientRect());
    const dir = Math.random() < 0.5 ? -1 : 1;
    g.animate(
      [
        { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
        { transform: `translate(${dir * 14}px,-34px) rotate(${dir * -10}deg)`, opacity: 1, offset: 0.28 },
        { transform: `translate(${dir * 60}px,240px) rotate(${dir * 220}deg)`, opacity: 0 },
      ],
      { duration: 760, easing: "cubic-bezier(.3,.1,.6,1)" },
    ).finished.finally(() => g.remove());
  };

  const flyFromChip = (id: string) => {
    const chip = document.querySelector(`[data-chip="${id}"] .mascot`);
    if (chip && !reducedMotion()) incoming.current = { id, from: chip.getBoundingClientRect() };
  };

  const add = (id: string) => {
    flyFromChip(id);
    snapshot();
    const next = [...picks, id];
    setPicks(next);
    setSwapIn(null);
    setSaid(`Added ${playerName(id)}. ${next.length} of ${need} picked.`);
  };

  const remove = (id: string) => {
    tumble(id);
    snapshot();
    const next = picks.filter((x) => x !== id);
    setPicks(next);
    if (captain === id) setCaptain(null);
    setSaid(`Removed ${playerName(id)}. ${next.length} of ${need} picked.${captain === id ? " Choose a new captain." : ""}`);
  };

  /** Atomic swap, so the team is never shown half-changed. */
  const swap = (outId: string, inId: string) => {
    tumble(outId);
    flyFromChip(inId);
    snapshot();
    setPicks(picks.map((x) => (x === outId ? inId : x)));
    if (captain === outId) setCaptain(null);
    setSwapIn(null);
    setSaid(`Swapped ${playerName(outId)} for ${playerName(inId)}.`);
  };

  /** Why a player can't be added right now (null = they can). Position-full is handled by the swap sheet. */
  const blockReason = (id: string): string | null => {
    const over = total + (stars[id] ?? 0) - cap;
    return over > 0 ? `Over budget by ${over}★` : null;
  };
  const swapBlock = (outId: string, inId: string): string | null => {
    const over = total - (stars[outId] ?? 0) + (stars[inId] ?? 0) - cap;
    return over > 0 ? `Over budget by ${over}★` : null;
  };

  const toggle = (id: string) => {
    if (picks.includes(id)) return remove(id);
    const pos = posOf(id);
    if (!pos) return;
    if (picksIn(pos).length >= FORMATION[pos]) {
      setSwapIn(swapIn === id ? null : id);
      return;
    }
    if (!blockReason(id)) add(id);
  };

  useLayoutEffect(() => {
    const root = slotsRef.current;
    if (!root || reducedMotion()) {
      incoming.current = null;
      return;
    }
    // Slide the mascots that changed seat (someone left from in front of them).
    root.querySelectorAll<HTMLElement>("[data-slot]").forEach((el) => {
      const id = el.dataset.slot!;
      const svg = el.querySelector<SVGElement>(".mascot");
      const was = before.current.get(id);
      if (!svg || !was || incoming.current?.id === id) return;
      const now = svg.getBoundingClientRect();
      const dx = was.left - now.left;
      const dy = was.top - now.top;
      if (Math.abs(dx) + Math.abs(dy) < 1) return;
      svg.animate(
        [
          { transform: `translate(${dx}px,${dy}px)` },
          { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 18}px)`, offset: 0.5 },
          { transform: "translate(0,0)" },
        ],
        { duration: 420, easing: "cubic-bezier(.3,.7,.3,1)" },
      );
    });
    before.current = new Map();

    // Hop in: jump from the squad chip along an arc and land in the slot.
    const job = incoming.current;
    incoming.current = null;
    if (!job) return;
    const target = slotMascot(job.id);
    if (!target) return;
    const to = target.getBoundingClientRect();
    const g = ghostOf(target, to);
    target.style.visibility = "hidden";
    const sx = job.from.width / to.width;
    const dx = job.from.left + job.from.width / 2 - (to.left + to.width / 2);
    const dy = job.from.top + job.from.height / 2 - (to.top + to.height / 2);
    const lift = Math.min(-90, dy * 0.5 - 90);
    g.animate(
      [
        { transform: `translate(${dx}px,${dy}px) scale(${sx})`, offset: 0 },
        { transform: `translate(${dx * 0.45}px,${lift}px) scale(${(1 + sx) / 2}) rotate(-8deg)`, offset: 0.5 },
        { transform: "translate(0,0) scale(1) rotate(0deg)", offset: 1 },
      ],
      { duration: 640, easing: "cubic-bezier(.25,.6,.35,1)" },
    ).finished.finally(() => {
      g.remove();
      target.style.visibility = "";
      target.classList.remove("is-landing");
      void target.getBoundingClientRect();
      target.classList.add("is-landing");
    });
  }, [picks]);

  // Clean up any stray ghosts if the page navigates mid-flight.
  useEffect(() => () => document.querySelectorAll(".mascot-ghost").forEach((g) => g.remove()), []);

  /** What the save button says when the team isn't ready yet. */
  const missing = POSITIONS.map((pos) => ({ pos, short: FORMATION[pos] - picksIn(pos).length })).find((x) => x.short > 0);
  const saveLabel = busy
    ? "Saving…"
    : missing
      ? `Pick ${missing.short} more ${missing.short === 1 ? POSITION_LABEL[missing.pos].one : POSITION_LABEL[missing.pos].many}`
      : !check.valid
        ? check.errors[0]
        : !captain
          ? "Tap C to choose your captain"
          : saved.length
          ? "Save changes"
          : `Lock in my ${need}`;

  // Bench in formation order: each position's picks, then its empty seats.
  const seats = POSITIONS.flatMap((pos) => {
    const mine = picksIn(pos);
    return Array.from({ length: FORMATION[pos] }, (_, i) => ({ pos, id: mine[i] ?? null, n: i }));
  });
  const pct = Math.min(100, (total / PICK7.starBudget) * 100);

  return (
    <div className="stack">
      <div className="pick7-status" aria-label="Team status">
        {POSITIONS.map((pos) => {
          const have = picksIn(pos).length;
          const done = have === FORMATION[pos];
          return (
            <span key={pos} className={`pos-pill${done ? " is-done" : ""}`}>
              {pos} <b className="num">{have}/{FORMATION[pos]}</b>
              {done && <span aria-hidden="true"> ✓</span>}
            </span>
          );
        })}
        <span className={`budget${total > PICK7.starBudget ? " is-over" : ""}`}>
          <span className="budget-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
          <span className="num">{total} / {PICK7.starBudget}★</span>
        </span>
      </div>
      {check.grandfathered && (
        <p className="small muted" style={{ margin: 0 }}>
          Ratings moved and your seven is now over budget. It stays legal; changes can only bring it down until it fits.
        </p>
      )}

      <p className="small cap-hint" style={{ margin: 0 }}>
        <span className="cap-badge" aria-hidden="true">C</span>
        {captain ? (
          <span><b>{playerName(captain)}</b> is your captain: their points count double. Tap another C to change.</span>
        ) : (
          <span className={complete ? "neg" : "muted"}>Tap <b>C</b> on one of your seven to make them captain. Their points count double.</span>
        )}
      </p>

      <div className="bench" ref={slotsRef}>
        {seats.map(({ pos, id, n }) =>
          id ? (
            <div key={id} className={`bench-slot${captain === id ? " is-captain" : ""}`} data-slot={id}>
              <button
                type="button"
                className="bench-cap"
                aria-pressed={captain === id}
                aria-label={captain === id ? `${playerName(id)} is captain (double points)` : `Make ${playerName(id)} captain (double points)`}
                title={captain === id ? "Captain: double points" : "Make captain (double points)"}
                onClick={() => toggleCaptain(id)}
              >
                C
              </button>
              <Mascot id={id} size={92} />
              <span className="bench-name">{playerName(id)}</span>
              <span className="bench-pos">{pos} · {starStr(stars[id] ?? 0)}</span>
              <button type="button" className="bench-remove" aria-label={`Remove ${playerName(id)}`} onClick={() => remove(id)}>
                <span aria-hidden="true">✕</span>
              </button>
            </div>
          ) : (
            <div key={`empty-${pos}-${n}`} className="bench-slot empty">
              <svg className="bench-ghost" viewBox="0 0 100 124" aria-hidden="true">
                <circle cx="50" cy="34" r="21" />
                <path d="M31 63 q0 -9 9 -10 h20 q9 1 9 10 v30 h-38 z" />
                <rect x="38" y="92" width="9" height="20" rx="3" />
                <rect x="53" y="92" width="9" height="20" rx="3" />
              </svg>
              <span className="bench-name muted">{POSITION_LABEL[pos].one}</span>
            </div>
          ),
        )}
      </div>

      <div className="stack">
        <h3>Choose from the squad</h3>
        <p className="small muted" style={{ margin: 0 }}>
          {FORMATION.DEF} defenders · {FORMATION.CM} CMs · {FORMATION.CAM} CAM · {FORMATION.ATT} attackers, at most {PICK7.starBudget}★ in total.
          Tap a player in a full position to swap them in.
        </p>
        <p className="sr-only" aria-live="polite" aria-atomic="true">{said}</p>
        {POSITIONS.map((pos) => {
          const list = PICKABLE.filter((p) => p.position === pos);
          const have = picksIn(pos);
          const full = have.length >= FORMATION[pos];
          const pendingSwap = swapIn && posOf(swapIn) === pos ? swapIn : null;
          return (
            <div key={pos} className="pos-group">
              <div className="pos-head">
                <span>{POSITION_LABEL[pos].many}</span>
                <span className={`num${full ? " pos-full" : ""}`}>{have.length}/{FORMATION[pos]} selected</span>
              </div>
              <div className="chips">
                {list.map((p) => {
                  const on = picks.includes(p.id);
                  const block = on || full ? null : blockReason(p.id);
                  const own = ownership[p.id];
                  return (
                    <button
                      type="button"
                      key={p.id}
                      className={`chip chip-face${full && !on ? " chip-swap" : ""}${pendingSwap === p.id ? " is-swapping" : ""}`}
                      data-chip={p.id}
                      aria-pressed={on}
                      disabled={!!block}
                      title={block ?? (full && !on ? `${POSITION_LABEL[pos].many} full: tap to swap` : undefined)}
                      onClick={() => toggle(p.id)}
                    >
                      <Mascot id={p.id} variant="head" size={26} />
                      {p.name}
                      <span className="chip-stars" aria-label={`${stars[p.id]} stars`}>{starStr(stars[p.id] ?? 0)}</span>
                      {own !== undefined && <span className="chip-own num">{Math.round(own * 100)}%</span>}
                      {p.kind === "dropin" && (
                        <span className="badge badge-dropin" style={{ color: on ? "inherit" : undefined }}>
                          <span aria-hidden="true">D</span>
                          <span className="sr-only">drop-in</span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {pendingSwap && (
                <div className="swap-sheet" role="group" aria-label={`Swap ${playerName(pendingSwap)} in`}>
                  <span className="small">
                    {POSITION_LABEL[pos].many} full. Swap <b>{playerName(pendingSwap)}</b> in for:
                  </span>
                  {have.map((outId) => {
                    const why = swapBlock(outId, pendingSwap);
                    return (
                      <button key={outId} type="button" className="btn btn-sm" disabled={!!why} title={why ?? undefined} onClick={() => swap(outId, pendingSwap)}>
                        {playerName(outId)}{why ? ` (${why})` : ""}
                      </button>
                    );
                  })}
                  <button type="button" className="btn btn-sm" onClick={() => setSwapIn(null)}>Cancel</button>
                </div>
              )}
            </div>
          );
        })}
        {Object.keys(ownership).length > 0 && <p className="small muted" style={{ margin: 0 }}>% = share of teams that picked them last round.</p>}
      </div>

      <div className="row">
        <button
          className="btn btn-primary"
          disabled={busy || !complete || !check.valid || !captain || !dirty}
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            emitPick7({ kind: "optimistic", status: "picked" }); // the table shows you on 0 right away
            try {
              await api("/api/me/squad", "PUT", { picks, captain });
              emitPick7({ kind: "settled", ok: true });
              setMsg({ ok: true, text: deadlineLabel ? `Saved. Locked in for ${deadlineLabel} — and every week after until you change it.` : "Saved." });
              router.refresh();
            } catch (e) {
              emitPick7({ kind: "settled", ok: false });
              setMsg({ ok: false, text: (e as Error).message });
            } finally {
              setBusy(false);
            }
          }}
        >
          {saveLabel}
        </button>
        {dirty && saved.length > 0 && (
          <button className="btn btn-sm" onClick={() => { setPicks(initial); setCaptain(savedCaptain); setSwapIn(null); }}>Undo</button>
        )}
        {saved.length > 0 && !dirty && (
          <button
            type="button"
            className={`btn btn-sm${confirmRemove ? " btn-danger" : ""}`}
            disabled={busy}
            onBlur={() => setConfirmRemove(false)}
            onClick={async () => {
              if (!confirmRemove) return setConfirmRemove(true);
              setConfirmRemove(false);
              setBusy(true);
              setMsg(null);
              emitPick7({ kind: "optimistic", status: "no_pick" });
              try {
                await api("/api/me/squad", "DELETE");
                emitPick7({ kind: "settled", ok: true });
                setPicks([]);
                setMsg({ ok: true, text: "Team removed. You won't be entered until you pick again." });
                router.refresh();
              } catch (e) {
                emitPick7({ kind: "settled", ok: false });
                setMsg({ ok: false, text: (e as Error).message });
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmRemove ? "Tap again to remove" : "Remove my team"}
          </button>
        )}
        {msg && <span className={`small ${msg.ok ? "" : "neg"}`} role="status">{msg.text}</span>}
      </div>
    </div>
  );
}

export function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(() => Date.now());
  useStateTick(setNow);
  const ms = Math.max(0, new Date(to).getTime() - now);
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return <span className="countdown num" suppressHydrationWarning>{ms === 0 ? "Locked" : `${d ? `${d}d ` : ""}${h}h ${String(m).padStart(2, "0")}m`}</span>;
}

function useStateTick(set: (n: number) => void) {
  useEffect(() => {
    const t = setInterval(() => set(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [set]);
}
