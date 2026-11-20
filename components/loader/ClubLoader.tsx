"use client";

import { useEffect, useRef, useState } from "react";
import type { LoaderScene } from "./scene";
import { LOADER_KEY, hasWebGL2, markLoaderDone } from "@/lib/client/loaderGate";
import { reducedMotion } from "@/lib/client/motion";


/** Each docks beside the ball: Respect on the left, No hard fouls on the right, the fun 60 below. */
const PRINCIPLES = [
  { no: "01", name: "Respect", line: "Teammates, opponents, the ref.", side: "left", color: "#e2c27a" },
  { no: "02", name: "No hard fouls", line: "Win the ball, not the shin.", side: "right", color: "#7fc49a" },
  { no: "03", name: "A fun 60 minutes", line: "One hour. Everyone smiling.", side: "below", color: "#f5f0e6" },
] as const;

const DURATION = 3000; // ms of rendered frames from 1 to 100
const HOLD = 1500; // at 100, all three principles stay up together before the site opens
const REDUCED = 700;
const BOOT_MAX = 1800; // start counting without 3D if it isn't on screen by then
const MAX_STEP = 34; // a stalled frame advances the count by at most ~2 frames' worth

// Start fetching the 3D as soon as this script runs, not after hydration.
type Mods = [typeof import("three"), typeof import("three/examples/jsm/postprocessing/EffectComposer.js"), typeof import("three/examples/jsm/postprocessing/RenderPass.js"), typeof import("three/examples/jsm/postprocessing/UnrealBloomPass.js"), typeof import("three/examples/jsm/postprocessing/OutputPass.js"), typeof import("./scene")];
let mods: Promise<Mods> | null = null;
function loadMods(): Promise<Mods> {
  mods ??= Promise.all([
    import("three"),
    import("three/examples/jsm/postprocessing/EffectComposer.js"),
    import("three/examples/jsm/postprocessing/RenderPass.js"),
    import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
    import("three/examples/jsm/postprocessing/OutputPass.js"),
    import("./scene"),
  ]);
  return mods;
}
if (typeof window !== "undefined" && !document.documentElement.classList.contains("no-loader")) void loadMods().catch(() => {});

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
  const tags = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let seen = false;
    try { seen = sessionStorage.getItem(LOADER_KEY) === "1"; } catch {}
    if (seen) { markLoaderDone(); setGone(true); return; }

    const html = document.documentElement;
    html.classList.add("loader-on");
    const reduce = reducedMotion();
    let scene: LoaderScene | null = null;
    let disposed = false;
    let raf = 0;
    let leaving = false;
    let timers: number[] = [];
    let lastCount = 0;

    // Phase 1 (boot): hold at 1 until the 3D has compiled and drawn its first frame.
    let booted = reduce;
    if (!reduce && stage.current && hasWebGL2()) {
      void (async () => {
        try {
          const [T, { EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, { createLoaderScene }] = await loadMods();
          if (disposed || !stage.current) return;
          scene = createLoaderScene(T, { EffectComposer, RenderPass, UnrealBloomPass, OutputPass }, stage.current, tags.current);
          scene.setProgress(lastCount / 100);
          await scene.ready;
          if (disposed) return;
          stage.current.classList.add("is-live");
          el.classList.add("has-scene");
        } catch {
          /* 2D count only */
        } finally {
          booted = true;
        }
      })();
    } else {
      booted = true;
    }

    const finish = () => {
      if (leaving) return;
      leaving = true;
      try { sessionStorage.setItem(LOADER_KEY, "1"); } catch {}
      // Freeze the 3D on its last frame so the fade has the GPU to itself.
      scene?.pause();
      el.classList.add("is-leaving");
      html.classList.remove("loader-on");
      timers.push(window.setTimeout(() => {
        setGone(true);
        // Only now may the home page start its own 3D.
        markLoaderDone();
      }, reduce ? 250 : 650));
    };

    const paint = (count: number) => {
      if (count === lastCount) return;
      lastCount = count;
      if (countEl.current) countEl.current.textContent = String(count);
      if (minuteEl.current) minuteEl.current.textContent = `${Math.round((count / 100) * 60)}'`;
      el.setAttribute("aria-valuenow", String(count));
      // Same thresholds the scene docks at (fallback labels when there's no 3D).
      el.dataset.stage = String(count >= 85 ? 3 : count >= 55 ? 2 : count >= 25 ? 1 : 0);
      scene?.setProgress(count / 100);
    };
    skip.current = () => {
      paint(100);
      finish();
    };

    // Phase 2 (count): advance by rendered frames, so a stall pauses the count
    // instead of letting it jump ahead of what's on screen.
    // Phase 3 (hold): at 100 the whistle goes and all three principles stay up for HOLD ms.
    const total = reduce ? REDUCED : DURATION;
    const bootStart = performance.now();
    let prev = 0;
    let elapsed = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!booted && now - bootStart < BOOT_MAX) { prev = now; return; }
      const step = prev ? Math.min(MAX_STEP, now - prev) : 0;
      prev = now;
      elapsed += step;
      const p = ease(Math.min(1, elapsed / total));
      paint(Math.max(1, Math.ceil(p * 100)));
      if (p >= 1) {
        cancelAnimationFrame(raf);
        scene?.burst();
        timers.push(window.setTimeout(finish, reduce ? 150 : HOLD));
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      timers = [];
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
      data-stage="0"
    >
      <div ref={stage} className="club-loader-stage" aria-hidden="true" />
      <div className="club-loader-vignette" aria-hidden="true" />

      {/* The principles: pinned beside the ball by the 3D scene (CSS places them there until it loads). */}
      <ol className="club-loader-tags" aria-label="How we play">
        {PRINCIPLES.map((p, i) => (
          <li
            key={p.no}
            ref={(n) => { tags.current[i] = n; }}
            className="club-loader-tag"
            data-at={i + 1}
            data-side={p.side}
            style={{ ["--c" as string]: p.color }}
          >
            <span className="club-loader-tag-in">
              <span className="club-loader-no">{p.no}</span>
              <span className="club-loader-name">{p.name}</span>
              <span className="club-loader-line">{p.line}</span>
            </span>
          </li>
        ))}
      </ol>

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
      </div>

      <button type="button" className="club-loader-skip" onClick={() => skip.current()}>
        Skip <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
