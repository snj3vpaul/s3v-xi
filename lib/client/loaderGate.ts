/**
 * Lets heavy client work (the home page's 3D scenes) wait until the opening
 * loader has finished, so the loader isn't fighting the page it covers for the
 * GPU and main thread. Resolves at once when the loader isn't showing.
 */
export const LOADER_KEY = "rsfc-loader-seen";
export const LOADER_DONE_EVENT = "rsfc:loader-done";

type W = Window & { __rsfcLoaderDone?: boolean };

export function markLoaderDone(): void {
  const w = window as W;
  if (w.__rsfcLoaderDone) return;
  w.__rsfcLoaderDone = true;
  window.dispatchEvent(new Event(LOADER_DONE_EVENT));
}

export function loaderShowing(): boolean {
  const w = window as W;
  if (w.__rsfcLoaderDone) return false;
  if (document.documentElement.classList.contains("no-loader")) return false;
  try { if (sessionStorage.getItem(LOADER_KEY) === "1") return false; } catch {}
  return !!document.querySelector(".club-loader");
}

/**
 * Resolves once the loader is done (or isn't showing). The loader always
 * signals when it finishes; the long safety timeout only covers a loader that
 * crashed, and is checked against the loader still being on the page.
 */
export function afterLoader(maxMs = 30000): Promise<void> {
  if (typeof window === "undefined" || !loaderShowing()) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => { window.removeEventListener(LOADER_DONE_EVENT, done); clearInterval(t); resolve(); };
    const started = Date.now();
    const t = window.setInterval(() => { if (!document.querySelector(".club-loader") || Date.now() - started > maxMs) done(); }, 1000);
    window.addEventListener(LOADER_DONE_EVENT, done);
  });
}

let webgl2: boolean | null = null;
/** One shared WebGL2 check (each probe canvas is a real GPU context, so only make one and release it). */
export function hasWebGL2(): boolean {
  if (webgl2 !== null) return webgl2;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    webgl2 = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl2 = false;
  }
  return webgl2;
}
