"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrbKind, OrbitScene } from "./scene";

export interface OrbChapter {
  no: string;
  name: string;
  tag: string;
  href: string;
  kind: OrbKind;
}

/**
 * Sticky full-screen stage for the orbital home: the WebGL scene plus the HUD
 * (hint, chapters menu, counter, side label). The chapter copy itself is plain
 * server-rendered HTML scrolling over this stage, so it works without WebGL/JS.
 */
export function OrbitStage({ chapters, label }: { chapters: OrbChapter[]; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [menu, setMenu] = useState(false);
  const [hover, setHover] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    const section = el?.closest<HTMLElement>("[data-orbit]");
    if (!el || !section) return;
    const states = chapters.length + 1; // hero + chapters
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let scene: OrbitScene | null = null;
    let disposed = false;
    let lastIdx = -1;

    const progress = () => {
      const r = section.getBoundingClientRect();
      const span = Math.max(1, r.height - window.innerHeight);
      return Math.min(1, Math.max(0, -r.top / span)) * (states - 1);
    };
    const onScroll = () => {
      const p = progress();
      scene?.setProgress(p);
      const i = Math.min(chapters.length - 1, Math.max(0, Math.round(p) - 1));
      if (i !== lastIdx) {
        lastIdx = i;
        setIndex(i);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();

    const probe = document.createElement("canvas");
    if (probe.getContext("webgl2")) {
      const start = async () => {
        const [T, { RoomEnvironment }, { createOrbitScene }] = await Promise.all([
          import("three"),
          import("three/examples/jsm/environments/RoomEnvironment.js"),
          import("./scene"),
        ]);
        if (disposed) return;
        scene = createOrbitScene(T, RoomEnvironment, el, {
          kinds: chapters.map((c) => c.kind),
          reduce,
          onOpen: (i) => router.push(chapters[i].href),
          onHover: (i) => setHover(i !== null),
        });
        scene.setProgress(progress());
        el.classList.add("is-live");
      };
      const w = window as Window & typeof globalThis;
      if (typeof w.requestIdleCallback === "function") w.requestIdleCallback(() => void start(), { timeout: 1200 });
      else w.setTimeout(() => void start(), 200);
    }

    return () => {
      disposed = true;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      scene?.dispose();
    };
    // The scene is built once per mount; chapters come from the server and don't change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);

  const cur = chapters[index];
  const total = String(chapters.length).padStart(2, "0");

  return (
    <div className="orbit-stage">
      <div className="orbit-canvas" ref={host} />
      <div className="orbit-side" aria-hidden="true">
        <span>{label}</span>
        <i />
      </div>
      <div className="orbit-hud">
        <p className="orbit-hint">
          <span aria-hidden="true">↓</span> Scroll to explore<span className="hide-sm"> · Drag to spin · Click a ball to open</span>
        </p>
        <div className="orbit-menu" ref={menuRef}>
          <button type="button" className="orbit-pill" aria-expanded={menu} aria-controls="orbit-chapters" onClick={() => setMenu((m) => !m)}>
            <span aria-hidden="true">☰</span> Chapters
          </button>
          {menu && (
            <ol id="orbit-chapters" className="orbit-list">
              {chapters.map((c, i) => (
                <li key={c.no}>
                  <a href={`#ch-${i + 1}`} aria-current={i === index ? "true" : undefined} onClick={() => setMenu(false)}>
                    <span className="num">{c.no}</span> {c.name}
                    <small>{c.tag}</small>
                  </a>
                </li>
              ))}
            </ol>
          )}
        </div>
        <a className={`orbit-now${hover ? " is-hover" : ""}`} href={cur.href}>
          <span className="num">{cur.no}</span>
          <span>
            <b>{cur.name}</b>
            <small>{cur.tag}</small>
          </span>
          <span className="orbit-count num">
            {cur.no}<em> / {total}</em>
          </span>
        </a>
      </div>
    </div>
  );
}
