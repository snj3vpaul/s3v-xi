"use client";

import { useEffect, useRef, useState } from "react";
import { getPlayer, playerName } from "@/config/club";
import { mascotLook } from "@/lib/league/mascot";
import { Mascot } from "@/components/Mascot";
import type { CaptainScene } from "./scene";
import { afterLoader, hasWebGL2 } from "@/lib/client/loaderGate";
import { reducedMotion } from "@/lib/client/motion";

/**
 * Home-page stage for the most-captained player: their squad mascot in 3D on a
 * lit plinth. Just the figure and the name. Without WebGL it shows the 2D mascot.
 */
export function CaptainShowcase({ playerId }: { playerId: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    if (!hasWebGL2()) return;
    const reduce = reducedMotion();
    let scene: CaptainScene | null = null;
    let disposed = false;

    const start = async () => {
      // Don't compete with the opening loader for the GPU.
      await afterLoader();
      if (disposed) return;
      const [T, { createCaptainScene }] = await Promise.all([import("three"), import("./scene")]);
      if (disposed) return;
      const initial = (getPlayer(playerId)?.name ?? playerId).charAt(0).toUpperCase();
      scene = createCaptainScene(T, el, mascotLook(playerId), initial, reduce);
      setLive(true);
    };
    // Only build it when it's about to be seen.
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { io.disconnect(); void start(); }
    }, { rootMargin: "300px" });
    io.observe(el);

    return () => {
      disposed = true;
      io.disconnect();
      scene?.dispose();
      setLive(false);
    };
  }, [playerId]);

  const name = playerName(playerId);
  return (
    <section className="captain-stage theme-night" aria-label={`Most captained: ${name}`}>
      <div className="captain-glow" aria-hidden="true" />
      <div ref={host} className={`captain-canvas${live ? " is-live" : ""}`}>
        {!live && (
          <div className="captain-fallback" aria-hidden="true">
            <Mascot id={playerId} size={260} />
          </div>
        )}
      </div>
      <p className="captain-name">
        <span className="captain-c" aria-hidden="true">C</span>
        {name}
      </p>
    </section>
  );
}
