"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { reducedMotion } from "@/lib/client/motion";

type Gsap = typeof import("gsap").gsap;
let gsapLoad: Promise<Gsap> | null = null;
const loadGsap = () => (gsapLoad ??= import("gsap").then((m) => m.gsap));

/**
 * A squad card that turns in 3D. Everything is driven by two CSS variables on
 * the card, --px and --py (-1…1): the card tilt, the glare, and (inside
 * portraits) the depth layers, the eyes and the face light all read them.
 *
 * - Mouse or pen: GSAP springs the values toward the pointer.
 * - Otherwise (`idle`): a slow, staggered head turn, paused while off-screen.
 * - Reduced motion: nothing moves.
 */
export function HoloCard({
  id,
  className,
  style,
  idle = false,
  phase = 0,
  children,
}: {
  id: string;
  className: string;
  style?: CSSProperties;
  idle?: boolean;
  phase?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const api = useRef<{ follow: (x: number, y: number) => void; release: () => void } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    let dead = false;
    let cleanup = () => {};
    loadGsap().then((gsap) => {
      if (dead) return;
      const v = { px: 0, py: 0 };
      const paint = () => {
        el.style.setProperty("--px", v.px.toFixed(4));
        el.style.setProperty("--py", v.py.toFixed(4));
      };
      const toX = gsap.quickTo(v, "px", { duration: 0.7, ease: "power3.out", onUpdate: paint });
      const toY = gsap.quickTo(v, "py", { duration: 0.7, ease: "power3.out", onUpdate: paint });

      // Idle: look left and right, a little up and down, never in sync with the next card.
      const sway = idle
        ? gsap
            .timeline({ repeat: -1, yoyo: true, paused: true, delay: phase * 0.4 })
            .fromTo(v, { px: -0.55, py: 0.12 }, { px: 0.55, py: -0.12, duration: 3.6, ease: "sine.inOut", onUpdate: paint })
        : null;
      let onScreen = false;
      let following = false;
      const io = new IntersectionObserver(([e]) => {
        onScreen = e.isIntersecting;
        if (sway && !following) {
          if (onScreen) sway.play();
          else sway.pause();
        }
      });
      io.observe(el);

      api.current = {
        follow: (x, y) => {
          following = true;
          sway?.pause();
          toX(x);
          toY(y);
        },
        release: () => {
          following = false;
          toX(0);
          toY(0);
          if (sway && onScreen) gsap.delayedCall(0.7, () => !following && sway.play());
        },
      };
      cleanup = () => {
        io.disconnect();
        sway?.kill();
        gsap.killTweensOf(v);
      };
    });
    return () => {
      dead = true;
      api.current = null;
      cleanup();
    };
  }, [idle, phase]);

  const move = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === "touch" || !api.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    api.current.follow(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
    e.currentTarget.dataset.tilt = "on";
  };
  const leave = (e: React.PointerEvent<HTMLElement>) => {
    api.current?.release();
    delete e.currentTarget.dataset.tilt;
  };

  return (
    <article ref={ref} id={id} className={className} style={style} onPointerMove={move} onPointerLeave={leave}>
      {children}
    </article>
  );
}
