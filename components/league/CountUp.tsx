"use client";
import { useEffect, useRef, useState } from "react";

/** Animates a number from 0 to `value` once it scrolls into view. */
export function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || value === 0) { setShown(value); return; }
    setShown(value);
    let raf = 0;
    const start = () => {
      setShown(0);
      const t0 = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) { start(); return () => cancelAnimationFrame(raf); }
    const io = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) { io.disconnect(); start(); } });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value, duration]);
  return <span ref={ref}>{shown}</span>;
}
