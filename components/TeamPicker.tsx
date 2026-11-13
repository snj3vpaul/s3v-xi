"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CLUB, playerName } from "@/config/club";
import { api } from "./api";
import { PlayerChips } from "./PlayerChips";
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

export function TeamPicker({ initial, deadlineLabel }: { initial: string[]; deadlineLabel: string | null }) {
  const router = useRouter();
  const [picks, setPicks] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [said, setSaid] = useState("");
  const need = CLUB.picksPerSelector;
  const dirty = picks.length !== initial.length || picks.some((p) => !initial.includes(p));

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

  const add = (id: string) => {
    const chip = document.querySelector(`[data-chip="${id}"] .mascot`);
    if (chip && !reducedMotion()) incoming.current = { id, from: chip.getBoundingClientRect() };
    snapshot();
    const next = [...picks, id];
    setPicks(next);
    setSaid(`Added ${playerName(id)}. ${next.length} of ${need} picked.`);
  };

  const remove = (id: string) => {
    const svg = slotMascot(id);
    if (svg && !reducedMotion()) {
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
    }
    snapshot();
    const next = picks.filter((x) => x !== id);
    setPicks(next);
    setSaid(`Removed ${playerName(id)}. ${next.length} of ${need} picked.`);
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

  return (
    <div className="stack">
      <div className="bench" ref={slotsRef}>
        {Array.from({ length: need }, (_, i) => {
          const id = picks[i];
          return id ? (
            <div key={id} className="bench-slot" data-slot={id}>
              <Mascot id={id} size={92} />
              <span className="bench-name">{playerName(id)}</span>
              <button type="button" className="bench-remove" aria-label={`Remove ${playerName(id)}`} onClick={() => remove(id)}>
                <span aria-hidden="true">✕</span>
              </button>
            </div>
          ) : (
            <div key={`empty-${i}`} className="bench-slot empty">
              <svg className="bench-ghost" viewBox="0 0 100 124" aria-hidden="true">
                <circle cx="50" cy="34" r="21" />
                <path d="M31 63 q0 -9 9 -10 h20 q9 1 9 10 v30 h-38 z" />
                <rect x="38" y="92" width="9" height="20" rx="3" />
                <rect x="53" y="92" width="9" height="20" rx="3" />
              </svg>
              <span className="bench-name muted">Pick {i + 1}</span>
            </div>
          );
        })}
      </div>
      <div>
        <div className="row spread">
          <h3>Choose from the squad</h3>
          <span className="num" aria-hidden="true">{picks.length}/{need}</span>
        </div>
        <p className="sr-only" aria-live="polite" aria-atomic="true">{said}</p>
        <PlayerChips selected={picks} max={need} withFaces onToggle={(id) => (picks.includes(id) ? remove(id) : add(id))} />
      </div>
      <div className="row">
        <button
          className="btn btn-primary"
          disabled={busy || picks.length !== need || !dirty}
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            try {
              await api("/api/me/squad", "PUT", { picks });
              setMsg({ ok: true, text: deadlineLabel ? `Saved. Locked in for ${deadlineLabel} — and every week after until you change it.` : "Saved." });
              router.refresh();
            } catch (e) {
              setMsg({ ok: false, text: (e as Error).message });
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving…" : initial.length ? "Save changes" : `Lock in my ${need}`}
        </button>
        {dirty && initial.length > 0 && <button className="btn btn-sm" onClick={() => setPicks(initial)}>Undo</button>}
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
