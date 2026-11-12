"use client";
import { useEffect, useState } from "react";
import { SCORING_RULES } from "@/lib/league/config";

const COLORS = ["#ffd23f", "#ff7a1a", "#2ec4a0", "#c2187a", "#7b4ce0", "#ffffff"];

type Piece = { left: number; dx: number; rot: number; d: number; delay: number; color: string; round: boolean };
function pieces(n: number): Piece[] {
  return Array.from({ length: n }, () => ({
    left: Math.random() * 100, dx: (Math.random() - 0.5) * 260, rot: 360 + Math.random() * 720,
    d: 2 + Math.random() * 1.6, delay: Math.random() * 0.5,
    color: COLORS[Math.floor(Math.random() * COLORS.length)], round: Math.random() < 0.3,
  }));
}

/** Fire-and-forget CSS confetti. Pure DOM spans; no libraries. */
export function ConfettiBurst({ fire }: { fire: number }) {
  const [burst, setBurst] = useState<Piece[] | null>(null);
  useEffect(() => {
    if (!fire) return;
    setBurst(pieces(110));
    const t = setTimeout(() => setBurst(null), 4200);
    return () => clearTimeout(t);
  }, [fire]);
  if (!burst) return null;
  return (
    <div className="lg-confetti" aria-hidden="true">
      {burst.map((p, i) => (
        <i key={i} style={{
          left: `${p.left}%`, background: p.color, borderRadius: p.round ? "50%" : undefined,
          ["--dx" as string]: `${p.dx}px`, ["--rot" as string]: `${p.rot}deg`, ["--d" as string]: `${p.d}s`, ["--delay" as string]: `${p.delay}s`,
        }} />
      ))}
    </div>
  );
}

/**
 * Celebrates exact-score hits the viewer hasn't seen yet (remembered per browser), plus a
 * replay button so you can relive the glory.
 */
export function ExactCelebration({ hits, userId }: { hits: Array<{ fixtureId: string; label: string }>; userId: string }) {
  const [fire, setFire] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    let seen: string[] = [];
    try { seen = JSON.parse(localStorage.getItem(`league-exact-seen:${userId}`) ?? "[]"); } catch { /* storage unavailable */ }
    const fresh = hits.filter((h) => !seen.includes(h.fixtureId));
    if (!fresh.length) return;
    const t = setTimeout(() => {
      setFire(Date.now());
      setToast(fresh.length === 1 ? `🎯 Exact score! ${fresh[0].label}, +${SCORING_RULES.exact} points` : `🎯 ${fresh.length} exact scores! Absolute scenes.`);
      // Only remember them once the party has actually happened.
      try { localStorage.setItem(`league-exact-seen:${userId}`, JSON.stringify([...new Set([...seen, ...hits.map((h) => h.fixtureId)])].slice(-300))); } catch { /* ignore */ }
    }, 450);
    return () => clearTimeout(t);
  }, [hits, userId]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4200); return () => clearTimeout(t); }, [toast]);
  return (
    <>
      <ConfettiBurst fire={fire} />
      {toast && <div className="lg-toast" role="status">{toast}</div>}
      {hits.length > 0 && (
        <button type="button" className="lg-btn small secondary" onClick={() => { setFire(Date.now()); setToast(`🎯 ${hits.length} exact ${hits.length === 1 ? "score" : "scores"} and counting`); }}>
          🎉 Replay my exact hits
        </button>
      )}
    </>
  );
}
