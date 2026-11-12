"use client";
import { useEffect, useState } from "react";

type Mode = "datetime" | "short" | "relative";

function format(iso: string, mode: Mode, now: number): string {
  const d = new Date(iso);
  if (mode === "relative") {
    const diff = d.getTime() - now;
    const abs = Math.abs(diff);
    const m = Math.round(abs / 60_000), h = Math.round(abs / 3_600_000), days = Math.round(abs / 86_400_000);
    const span = abs < 3_600_000 ? `${Math.max(m, 1)} min` : abs < 172_800_000 ? `${h} h` : `${days} days`;
    return diff >= 0 ? `in ${span}` : `${span} ago`;
  }
  return new Intl.DateTimeFormat(undefined, mode === "short"
    ? { weekday: "short", hour: "numeric", minute: "2-digit" }
    : { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(d);
}

/**
 * Times are stored in UTC and shown in the viewer's own timezone. The server renders a
 * neutral UTC fallback; the browser swaps in local time after hydration.
 */
export function LocalTime({ iso, mode = "datetime" }: { iso: string; mode?: Mode }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setText(format(iso, mode, Date.now()));
    tick();
    if (mode !== "relative") return;
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [iso, mode]);
  const fallback = mode === "relative" ? "" : `${iso.slice(0, 16).replace("T", " ")} UTC`;
  return <time dateTime={iso} title={new Date(iso).toUTCString()}>{text ?? fallback}</time>;
}
