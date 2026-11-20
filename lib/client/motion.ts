/** True when the visitor asked the OS for reduced motion (false during SSR). */
export const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
