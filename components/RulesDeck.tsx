"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { reducedMotion } from "@/lib/client/motion";

/**
 * A swipeable deck of rules. The card in the middle is in focus; its
 * neighbours are blurred. Swipe, scroll, use the buttons, or arrow keys.
 */
export interface RuleCard {
  id: string;
  title: string;
  /** Big number on the card, e.g. "+6" or "×2". */
  value: string;
  /** One or two sentences: what it is. */
  body: string;
  /** A worked example from a Thursday night. */
  example: string;
  /** The dot-label pinned on the drawing. */
  tag: string;
  /** Where the tag sits on the drawing, in % of the art box. */
  tagAt: [number, number];
}

export function RulesDeck({ cards }: { cards: RuleCard[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  // The card nearest the middle of the track is the one in focus.
  const measure = useCallback(() => {
    const t = track.current;
    if (!t) return;
    const mid = t.scrollLeft + t.clientWidth / 2;
    let best = 0;
    let dist = Infinity;
    t.querySelectorAll<HTMLElement>("[data-card]").forEach((el, i) => {
      const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    setCurrent(best);
  }, []);

  useEffect(() => {
    const t = track.current;
    if (!t) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    t.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    measure();
    return () => {
      t.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, [measure]);

  const go = (i: number) => {
    const t = track.current;
    const el = t?.querySelectorAll<HTMLElement>("[data-card]")[Math.max(0, Math.min(cards.length - 1, i))];
    if (!t || !el) return;
    t.scrollTo({ left: el.offsetLeft + el.offsetWidth / 2 - t.clientWidth / 2, behavior: reducedMotion() ? "auto" : "smooth" });
  };

  return (
    <section className="deck" aria-roledescription="carousel" aria-label="How points are scored">
      <div
        className="deck-track"
        ref={track}
        tabIndex={0}
        aria-label="Rules, one card each. Use the left and right arrow keys."
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            go(current + 1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            go(current - 1);
          }
        }}
      >
        {cards.map((c, i) => (
          <article
            key={c.id}
            data-card
            className={`deck-card${i === current ? " is-current" : ""}${Math.abs(i - current) === 1 ? " is-near" : ""}`}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${cards.length}: ${c.title}`}
            aria-hidden={i !== current}
            onClick={() => i !== current && go(i)}
          >
            <div className="deck-art">
              <RuleArt id={c.id} />
              <span className="deck-tag" style={{ left: `${c.tagAt[0]}%`, top: `${c.tagAt[1]}%` }}>
                <i aria-hidden="true" />
                {c.tag}
              </span>
            </div>
            <div className="deck-copy">
              <div className="deck-head">
                <h3>{c.title}</h3>
                <span className="deck-value num">{c.value}</span>
              </div>
              <p>{c.body}</p>
              <p className="deck-example">{c.example}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="deck-controls">
        <button type="button" className="deck-btn" onClick={() => go(current - 1)} disabled={current === 0} aria-label="Previous rule">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" /></svg>
        </button>
        <span className="deck-count num" aria-live="polite">
          {cards[current]?.title} <span className="muted">({current + 1} of {cards.length})</span>
        </span>
        <button type="button" className="deck-btn" onClick={() => go(current + 1)} disabled={current === cards.length - 1} aria-label="Next rule">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
        </button>
      </div>
    </section>
  );
}

/** Line drawings, one per rule: espresso strokes, one champagne accent. */
function RuleArt({ id }: { id: string }) {
  const common = { viewBox: "0 0 320 220", className: "deck-svg", "aria-hidden": true } as const;
  switch (id) {
    case "goal":
      return (
        <svg {...common}>
          <path d="M70 60h180v120" className="ln" />
          <path d="M70 60v120" className="ln" />
          {Array.from({ length: 9 }, (_, i) => <path key={`v${i}`} d={`M${88 + i * 18} 60v120`} className="ln thin" />)}
          {Array.from({ length: 6 }, (_, i) => <path key={`h${i}`} d={`M70 ${78 + i * 18}h180`} className="ln thin" />)}
          <path d="M20 192h280" className="ln" />
          <circle cx="196" cy="128" r="17" className="ln fill-bg" />
          <path d="m196 113 9 6-3 11h-12l-3-11z" className="ln" />
          <path d="M60 205q50-40 118-70" className="ln dash acc" />
        </svg>
      );
    case "assist":
      return (
        <svg {...common}>
          <circle cx="80" cy="70" r="13" className="ln" />
          <path d="M80 83v42m0-30-20 16m20-16 18 14m-18 16-16 34m16-34 14 32" className="ln" />
          <circle cx="240" cy="70" r="13" className="ln" />
          <path d="M240 83v42m0-30-18 14m18-14 20 16m-20 16-14 32m14-32 16 34" className="ln" />
          <circle cx="112" cy="168" r="9" className="ln" />
          <path d="M124 166q60-50 104-6" className="ln dash acc" />
          <path d="m222 152 8 8-11 3" className="ln acc" />
          <path d="M20 192h280" className="ln" />
        </svg>
      );
    case "motm":
      return (
        <svg {...common}>
          <circle cx="160" cy="92" r="46" className="ln" />
          <circle cx="160" cy="92" r="36" className="ln thin" />
          <path d="m160 66 7 16 17 1-13 11 4 17-15-9-15 9 4-17-13-11 17-1z" className="ln acc" />
          <path d="m132 132-14 62 22-12 10 20 10-36m20-34 14 62-22-12-10 20-10-36" className="ln" />
        </svg>
      );
    case "win":
      return (
        <svg {...common}>
          <rect x="70" y="40" width="180" height="96" rx="6" className="ln" />
          <path d="M160 52v72" className="ln thin" />
          <text x="115" y="104" className="art-num">4</text>
          <text x="205" y="104" className="art-num">3</text>
          <path d="M100 150h120M160 136v14" className="ln" />
          <path d="M136 172h48l-6 22h-36z" className="ln" />
          <path d="m108 72 10 8 16-18" className="ln acc" />
        </svg>
      );
    case "defence":
      return (
        <svg {...common}>
          <path d="M40 170h240M90 170V70h140v100" className="ln" />
          <path d="M110 70v100m20-100v100m20-100v100m20-100v100m20-100v100m20-100v100" className="ln thin" />
          <circle cx="132" cy="150" r="14" className="ln fill-bg" />
          <circle cx="160" cy="150" r="14" className="ln fill-bg" />
          <circle cx="188" cy="150" r="14" className="ln fill-bg" />
          <path d="M132 136v-14m28 14v-14m28 14v-14" className="ln" />
          <path d="M60 200h200" className="ln dash acc" />
          <text x="252" y="196" className="art-small">0</text>
        </svg>
      );
    case "conduct":
      return (
        <svg {...common}>
          <path d="M60 130q20-26 52-26h30l26 18m92 8q-20-26-52-26h-30" className="ln" />
          <path d="M142 104q14-6 26 4l22 18q8 8-2 14t-18-4l-12-10" className="ln" />
          <path d="M168 122q8 8-2 14m-14-26 22 18" className="ln thin" />
          <rect x="120" y="150" width="34" height="44" rx="5" className="ln" />
          <rect x="166" y="150" width="34" height="44" rx="5" className="ln" />
          <path d="M126 162h22m-22 10h22m24-10h22m-22 10h22" className="ln thin" />
          <path d="M232 52a18 18 0 1 1 0 36 18 18 0 0 1 0-36m-12 18 8 8 16-16" className="ln acc" />
        </svg>
      );
    case "captain":
      return (
        <svg {...common}>
          <path d="M110 40q50-10 100 0l6 150H104z" className="ln" />
          <rect x="104" y="96" width="112" height="34" rx="4" className="ln acc" />
          <text x="160" y="121" className="art-num acc-text" textAnchor="middle">C</text>
          <path d="M110 40 80 70l24 26m106-56 30 30-24 26" className="ln" />
          <path d="M240 150a14 14 0 1 1 0 28 14 14 0 0 1 0-28" className="ln" />
          <text x="240" y="169" className="art-small" textAnchor="middle">V</text>
        </svg>
      );
    case "bench":
      return (
        <svg {...common}>
          <path d="M40 140h240M60 140v50m200-50v50M40 120h240" className="ln" />
          <path d="M40 120v20m240-20v20" className="ln" />
          <circle cx="110" cy="70" r="12" className="ln" />
          <path d="M110 82v38m-14-22 14-6 14 6" className="ln" />
          <circle cx="210" cy="70" r="12" className="ln acc" />
          <path d="M210 82v38m-14-22 14-6 14 6" className="ln acc" />
          <path d="M236 64q30-10 40 18m-6-10 6 10 8-8" className="ln dash" />
        </svg>
      );
    case "chips":
      return (
        <svg {...common}>
          <circle cx="110" cy="110" r="54" className="ln" />
          <circle cx="110" cy="110" r="42" className="ln thin dash" />
          <text x="110" y="122" className="art-num" textAnchor="middle">×3</text>
          <circle cx="215" cy="110" r="54" className="ln acc" />
          <circle cx="215" cy="110" r="42" className="ln thin dash" />
          <path d="M190 118h50m-44 0v14m38-14v14m-44-26h50" className="ln" />
        </svg>
      );
    default:
      return null;
  }
}
