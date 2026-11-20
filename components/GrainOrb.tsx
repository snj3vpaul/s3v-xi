"use client";
import { useEffect, useRef } from "react";
import { mulberry32 } from "@/lib/random";
import { reducedMotion } from "@/lib/client/motion";

/**
 * Every point of the season as one grain on a slowly turning globe.
 * The highlighted player's grains turn champagne and glow; pointing at a
 * grain reports its owner, so the orb and the table light each other up.
 */
export interface OrbOwner {
  id: string;
  points: number;
}

const ESPRESSO = [43, 33, 24];
const TAUPE = [138, 109, 79];
const GOLD = [201, 168, 92];
const MAX_GRAINS = 1600;
const SPIN = 0.045; // radians per second: barely moving
const TILT = 0.38;

interface Grain {
  owner: number;
  x: number;
  y: number;
  z: number;
  size: number;
  phase: number;
}

export function GrainOrb({ owners, hot, onHover }: { owners: OrbOwner[]; hot: string | null; onHover: (id: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const hotRef = useRef(hot);
  const onHoverRef = useRef(onHover);
  const redraw = useRef<() => void>(() => {});
  hotRef.current = hot;
  onHoverRef.current = onHover;

  useEffect(() => redraw.current(), [hot]);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    // ---- Grains: one per point (scaled down past MAX_GRAINS), shuffled so each player's are spread over the globe.
    const total = owners.reduce((t, o) => t + Math.max(0, o.points), 0);
    const per = Math.max(1, Math.ceil(total / MAX_GRAINS));
    const ownerOf: number[] = [];
    owners.forEach((o, i) => {
      for (let k = 0; k < Math.round(Math.max(0, o.points) / per); k++) ownerOf.push(i);
    });
    const rnd = mulberry32(total * 7919 + owners.length);
    for (let i = ownerOf.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [ownerOf[i], ownerOf[j]] = [ownerOf[j], ownerOf[i]];
    }
    const n = ownerOf.length;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const grains: Grain[] = ownerOf.map((owner, i) => {
      // Fibonacci sphere, with a little depth so it reads as dust rather than a shell.
      const y = 1 - ((i + 0.5) / n) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = i * golden;
      const depth = 0.82 + rnd() * 0.22;
      return { owner, x: Math.cos(th) * r * depth, y: y * depth, z: Math.sin(th) * r * depth, size: 1.3 + rnd() * 1.4, phase: rnd() * Math.PI * 2 };
    });

    const reduced = reducedMotion();
    let w = 0;
    let dpr = 1;
    let angle = 0.6;
    let last = performance.now();
    let raf = 0;
    let visible = true;
    let glow = 0; // eases toward 1 when someone is highlighted
    let glowFor: number | null = null;
    const projected = new Float32Array(n * 3);

    // A soft gold sprite for highlighted grains (drawn once, stamped many times).
    const sprite = document.createElement("canvas");
    sprite.width = sprite.height = 32;
    const sc = sprite.getContext("2d")!;
    const g = sc.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, "rgba(241,223,178,0.95)");
    g.addColorStop(0.35, "rgba(201,168,92,0.55)");
    g.addColorStop(1, "rgba(201,168,92,0)");
    sc.fillStyle = g;
    sc.fillRect(0, 0, 32, 32);

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cv.clientWidth;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(w * dpr);
    };

    const draw = (t: number) => {
      const hotIdx = hotRef.current ? owners.findIndex((o) => o.id === hotRef.current) : -1;
      if (hotIdx >= 0) glowFor = hotIdx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, w);
      const R = w * 0.4;
      const cx = w / 2;
      const cy = w / 2;
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);
      const ct = Math.cos(TILT);
      const st = Math.sin(TILT);
      const lit: number[] = [];
      for (let i = 0; i < n; i++) {
        const p = grains[i];
        const x1 = p.x * ca + p.z * sa;
        const z1 = -p.x * sa + p.z * ca;
        const y2 = p.y * ct - z1 * st;
        const z2 = p.y * st + z1 * ct;
        const sx = cx + x1 * R;
        const sy = cy + y2 * R;
        projected[i * 3] = sx;
        projected[i * 3 + 1] = sy;
        projected[i * 3 + 2] = z2;
        const front = (z2 + 1) / 2; // 0 back … 1 front
        if (glowFor !== null && p.owner === glowFor && glow > 0.02) {
          lit.push(i);
          continue;
        }
        const shimmer = reduced ? 1 : 0.85 + 0.15 * Math.sin(t / 900 + p.phase);
        const dim = glowFor !== null ? 1 - glow * 0.5 : 1;
        const col = front > 0.45 ? ESPRESSO : TAUPE;
        ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${(0.3 + front * 0.62) * shimmer * dim})`;
        const s = p.size * (0.55 + front * 0.65);
        ctx.beginPath();
        ctx.arc(sx, sy, s / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // Highlighted grains last, in gold, with a soft halo.
      for (const i of lit) {
        const sx = projected[i * 3];
        const sy = projected[i * 3 + 1];
        const front = (projected[i * 3 + 2] + 1) / 2;
        const halo = (6 + front * 9) * glow;
        ctx.globalAlpha = (0.35 + front * 0.65) * glow;
        ctx.drawImage(sprite, sx - halo / 2, sy - halo / 2, halo, halo);
        ctx.globalAlpha = 1;
        ctx.fillStyle = `rgba(${GOLD[0]},${GOLD[1]},${GOLD[2]},${0.55 + front * 0.45})`;
        const s = grains[i].size * (1 + front);
        ctx.beginPath();
        ctx.arc(sx, sy, s * 0.75, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const target = hotRef.current ? 1 : 0;
      glow += (target - glow) * Math.min(1, dt * 7);
      if (!hotRef.current && glow < 0.02) glowFor = null;
      if (!reduced) angle += SPIN * dt;
      draw(t);
      const settling = Math.abs(target - glow) > 0.01;
      if (visible && (!reduced || settling)) raf = requestAnimationFrame(frame);
      else raf = 0;
    };
    const start = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    redraw.current = start;

    resize();
    start();
    const ro = new ResizeObserver(() => {
      resize();
      start();
    });
    ro.observe(cv);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
    });
    io.observe(cv);

    // Pointing at a grain reports its owner.
    let pending = false;
    const onMove = (e: PointerEvent) => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        const r = cv.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        let best = -1;
        let bestD = 14 * 14;
        for (let i = 0; i < n; i++) {
          if (projected[i * 3 + 2] < -0.2) continue; // only the near side
          const dx = projected[i * 3] - mx;
          const dy = projected[i * 3 + 1] - my;
          const d = dx * dx + dy * dy;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
        onHoverRef.current(best >= 0 ? owners[grains[best].owner].id : null);
      });
    };
    const onLeave = () => onHoverRef.current(null);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerleave", onLeave);
    };
  }, [owners]);

  return <canvas ref={canvas} className="orb-canvas" aria-hidden="true" />;
}
