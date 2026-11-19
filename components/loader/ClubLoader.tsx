"use client";

import { useEffect, useRef, useState } from "react";
import type { LoaderScene } from "./scene";

/** Set once the loader has played, so it shows once per browser session. */
export const LOADER_KEY = "rsfc-loader-seen";

const PRINCIPLES = [
  { no: "01", name: "Respect", line: "Teammates, opponents, the ref, the pitch." },
  { no: "02", name: "No hard fouls", line: "Win the ball, not the shin. Everyone works tomorrow." },
  { no: "03", name: "A fun 60 minutes", line: "One hour, two bibs, everyone smiling at the end." },
];

const DURATION = 3400; // ms from 1 to 100 when the page is already loaded
const REDUCED = 900;
const MAX_WAIT = 7000; // never hold the site back longer than this

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/**
 * Opening loader: counts 1 → 100 over a three.js scene (match ball, 60-minute
 * clock, three principle orbits; see ./scene). Each principle lights up as the
 * count passes its third. Plays once per session; tap Skip to jump in.
 * Rendered on the server so there's no flash of the page underneath. An inline
 * script in the layout hides it straight away on repeat visits.
 */
export function ClubLoader() {
  const [gone, setGone] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const countEl = useRef<HTMLSpanElement>(null);
  const minuteEl = useRef<HTMLSpanElement>(null);
  const skip = useRef<() => void>(() => {});

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let seen = false;
    try { seen = sessionStorage.getItem(LOADER_KEY) === "1"; } catch {}
    if (seen) { setGone(true); return; }

    const html = document.documentElement;
    html.classList.add("loader-on");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let scene: LoaderScene | null = null;
    let disposed = false;
    let raf = 0;
    let leaving = false;
    let timers: number[] = [];

    // 3D, when WebGL is there and motion is welcome. The count runs regardless.
    let sceneSettled = reduce;
    if (!reduce && stage.current && document.createElement("canvas").getContext("webgl2")) {
      void (async () => {
        try {
          const [T, { EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, { createLoaderScene }] = await Promise.all([
            import("three"),
            import("three/examples/jsm/postprocessing/EffectComposer.js"),
            import("three/examples/jsm/postprocessing/RenderPass.js"),
            import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
            import("three/examples/jsm/postprocessing/OutputPass.js"),
            import("./scene"),
          ]);
          if (disposed || !stage.current) return;
          scene = createLoaderScene(T, { EffectComposer, RenderPass, UnrealBloomPass, OutputPass }, stage.current);
          stage.current.classList.add("is-live");
        } catch {
          /* 2D count only */
        } finally {
          sceneSettled = true;
        }
      })();
    } else {
      sceneSettled = true;
    }

    let loaded = document.readyState === "complete";
    const onLoad = () => { loaded = true; };
    window.addEventListener("load", onLoad);

    const finish = () => {
      if (leaving) return;
      leaving = true;
      try { sessionStorage.setItem(LOADER_KEY, "1"); } catch {}
      el.classList.add("is-leaving");
      html.classList.remove("loader-on");
      timers.push(window.setTimeout(() => setGone(true), reduce ? 250 : 900));
    };
    skip.current = () => {
      paint(100);
      finish();
    };

    let lastCount = 0;
    const paint = (count: number) => {
      if (count === lastCount) return;
      lastCount = count;
      if (countEl.current) countEl.current.textContent = String(count);
      if (minuteEl.current) minuteEl.current.textContent = `${Math.round((count / 100) * 60)}'`;
      el.setAttribute("aria-valuenow", String(count));
      el.dataset.stage = String(count >= 67 ? 3 : count >= 34 ? 2 : 1);
      scene?.setProgress(count / 100);
    };

    const t0 = performance.now();
    const total = reduce ? REDUCED : DURATION;
    const tick = (now: number) => {
      const el2 = now - t0;
      let p = ease(Math.min(1, el2 / total));
      // Hold just short of 100 until the page and the scene are ready (or we've waited long enough).
      const ready = (loaded && sceneSettled) || el2 > MAX_WAIT;
      if (!ready) p = Math.min(p, 0.96);
      paint(Math.max(1, Math.ceil(p * 100)));
      if (p >= 1) {
        scene?.burst();
        timers.push(window.setTimeout(finish, reduce ? 150 : 650));
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      timers = [];
      window.removeEventListener("load", onLoad);
      html.classList.remove("loader-on");
      scene?.dispose();
    };
  }, []);

  if (gone) return null;
  return (
    <div
      ref={root}
      className="club-loader theme-night"
      role="progressbar"
      aria-label="Loading RSFC League"
      aria-valuemin={1}
      aria-valuemax={100}
      aria-valuenow={1}
      data-stage="1"
    >
      <div ref={stage} className="club-loader-stage" aria-hidden="true" />
      <div className="club-loader-vignette" aria-hidden="true" />

      <div className="club-loader-ui">
        <p className="club-loader-eyebrow">RSFC · Thursday, kick-off</p>

        <div className="club-loader-meter" aria-hidden="true">
        <div className="club-loader-count">
          <span ref={countEl} className="num">1</span>
          <span className="club-loader-of">/100</span>
        </div>
        <p className="club-loader-clock">
          Match clock <span ref={minuteEl} className="num">1&apos;</span> <span className="club-loader-of">of 60&apos;</span>
        </p>
        </div>

        <ol className="club-loader-principles" aria-label="How we play">
          {PRINCIPLES.map((p, i) => (
            <li key={p.no} data-at={i + 1} style={{ ["--c" as string]: ["#e2c27a", "#7fc49a", "#f5f0e6"][i] }}>
              <span className="club-loader-no">{p.no}</span>
              <span className="club-loader-name">{p.name}</span>
              <span className="club-loader-line">{p.line}</span>
            </li>
          ))}
        </ol>
      </div>

      <button type="button" className="club-loader-skip" onClick={() => skip.current()}>
        Skip <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
