"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { reducedMotion } from "@/lib/client/motion";

/**
 * A squad card that tilts toward the pointer with a moving glare, FIFA-promo
 * style. Only sets CSS variables (--rx, --ry, --gx, --gy); the look lives in
 * globals.css. Does nothing with reduced motion or on touch scroll.
 */
export function HoloCard({ id, className, style, children }: { id: string; className: string; style?: CSSProperties; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const frame = useRef(0);

  const move = (e: React.PointerEvent) => {
    if (e.pointerType === "touch" || reducedMotion()) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty("--rx", `${(0.5 - y) * 10}deg`);
      el.style.setProperty("--ry", `${(x - 0.5) * 12}deg`);
      el.style.setProperty("--gx", `${x * 100}%`);
      el.style.setProperty("--gy", `${y * 100}%`);
      el.dataset.tilt = "on";
    });
  };
  const leave = () => {
    cancelAnimationFrame(frame.current);
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    delete el.dataset.tilt;
  };

  return (
    <article ref={ref} id={id} className={className} style={style} onPointerMove={move} onPointerLeave={leave}>
      {children}
    </article>
  );
}
