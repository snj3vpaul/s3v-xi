"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type Libs = {
  gsap: typeof import("gsap").gsap;
  ScrollTrigger: typeof import("gsap/ScrollTrigger").ScrollTrigger;
};

/**
 * Site-wide motion layer.
 *
 * - Lenis smooth scrolling, driven by GSAP's ticker so ScrollTrigger stays in sync.
 *   Native touch scrolling is left alone (syncTouch: false), and anything marked
 *   data-lenis-prevent scrolls natively.
 * - Declarative scroll animations, set up per route from data attributes:
 *     data-reveal          fade/rise in when scrolled into view
 *     data-reveal-group    stagger the direct children in
 *     data-count="42"      count up from 0
 * - Elements already on screen when a route loads are never hidden, so nothing flashes.
 * - prefers-reduced-motion: none of this runs. Content is static and fully visible.
 */
export function MotionRoot() {
  const path = usePathname();
  const libs = useRef<Promise<Libs | null> | null>(null);

  // Lenis lives for the whole session.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      libs.current = Promise.resolve(null);
      return;
    }
    let destroy = () => {};
    libs.current = (async () => {
      const [{ default: Lenis }, { gsap }, { ScrollTrigger }] = await Promise.all([
        import("lenis"),
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      gsap.registerPlugin(ScrollTrigger);
      const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.9, syncTouch: false, anchors: true });
      lenis.on("scroll", ScrollTrigger.update);
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      destroy = () => {
        gsap.ticker.remove(tick);
        lenis.destroy();
      };
      return { gsap, ScrollTrigger };
    })();
    return () => destroy();
  }, []);

  // Scroll choreography is rebuilt on every route.
  useEffect(() => {
    let revert = () => {};
    let cancelled = false;
    void (async () => {
      const l = await libs.current;
      if (!l || cancelled) return;
      // Let the new route paint before measuring.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (cancelled) return;
      let mm: { revert: () => void } | undefined;
      const ctx = l.gsap.context(() => {
        mm = choreograph(l);
      });
      l.ScrollTrigger.refresh();
      revert = () => {
        mm?.revert();
        ctx.revert();
      };
    })();
    return () => {
      cancelled = true;
      revert();
    };
  }, [path]);

  return null;
}

function choreograph({ gsap, ScrollTrigger }: Libs): { revert: () => void } | undefined {
  const offscreen = (el: Element) => el.getBoundingClientRect().top > window.innerHeight * 0.92;

  gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
    if (!offscreen(el)) return;
    gsap.from(el, {
      autoAlpha: 0,
      y: 28,
      duration: 0.9,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 88%", once: true },
    });
  });

  gsap.utils.toArray<HTMLElement>("[data-reveal-group]").forEach((group) => {
    if (!offscreen(group)) return;
    gsap.from(group.children, {
      autoAlpha: 0,
      y: 18,
      duration: 0.7,
      stagger: 0.07,
      ease: "power3.out",
      scrollTrigger: { trigger: group, start: "top 88%", once: true },
    });
  });

  gsap.utils.toArray<HTMLElement>("[data-count]").forEach((el) => {
    const end = Number(el.dataset.count);
    if (!Number.isFinite(end) || end === 0 || !offscreen(el)) return;
    const n = { v: 0 };
    el.textContent = "0";
    gsap.to(n, {
      v: end,
      duration: 1.2,
      ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
      onUpdate: () => {
        el.textContent = String(Math.round(n.v));
      },
    });
  });

  ScrollTrigger.sort();
  return undefined;
}
