"use client";
/**
 * Tiny signal bus between the picker and the live Pick 7 table.
 *  - "optimistic": a save/removal was just sent; show it now.
 *  - "settled":    the server answered; refetch (ok) or roll back (failed).
 * Other open tabs hear about successful changes through a BroadcastChannel.
 */
import type { Pick7Status } from "@/lib/league/pick7Table";

export type Pick7Signal = { kind: "optimistic"; status: Pick7Status } | { kind: "settled"; ok: boolean };

const EVENT = "pick7";
const CHANNEL = "rsfc-pick7";

export function emitPick7(signal: Pick7Signal) {
  window.dispatchEvent(new CustomEvent<Pick7Signal>(EVENT, { detail: signal }));
  if (signal.kind === "settled" && signal.ok && "BroadcastChannel" in window) {
    const ch = new BroadcastChannel(CHANNEL);
    ch.postMessage("changed");
    ch.close();
  }
}

export function onPick7(fn: (s: Pick7Signal) => void, onOtherTab: () => void): () => void {
  const local = (e: Event) => fn((e as CustomEvent<Pick7Signal>).detail);
  window.addEventListener(EVENT, local);
  const ch = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL) : null;
  if (ch) ch.onmessage = onOtherTab;
  return () => {
    window.removeEventListener(EVENT, local);
    ch?.close();
  };
}
