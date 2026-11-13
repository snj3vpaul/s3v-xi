"use client";
import { useEffect, useRef } from "react";

/**
 * Floodlit pitch: one full-screen quad, one draw call.
 *
 * Mown stripes recede to a horizon, two floodlights glow from the top corners,
 * and a soft pool of light follows the pointer. As the hero scrolls away the
 * lights dim (uLight), so the page "walks off" the pitch.
 *
 * Performance guardrails:
 *  - three.js is imported only after first paint, when the browser is idle
 *  - pixel ratio capped at 1.5 (0.75x of that on narrow screens)
 *  - the loop pauses when the hero is off screen or the tab is hidden
 *  - reduced motion: a single static frame, re-rendered only on resize
 *  - no WebGL: the CSS fallback behind the canvas simply stays
 */

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;   // 0..1, eased on the CPU
uniform float uLight;   // 0..1, scroll-driven floodlight level
varying vec2  vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  vec3 navy  = vec3(0.047, 0.098, 0.145);   // #0C1925
  vec3 col   = navy;
  vec2 p     = vec2(uv.x * aspect, uv.y);

  // Floodlights at the top corners: haze in the night sky.
  float f1 = exp(-5.5 * distance(p, vec2(0.06 * aspect, 1.05)));
  float f2 = exp(-5.5 * distance(p, vec2(0.94 * aspect, 1.05)));
  col += vec3(0.62, 0.70, 0.62) * (f1 + f2) * 0.16 * (0.35 + 0.65 * uLight);

  float horizon = 0.56;
  if (uv.y < horizon) {
    float d = (horizon - uv.y) / horizon;     // 0 at horizon, 1 at the bottom edge
    float z = 1.0 / (d + 0.06);               // depth into the pitch
    float x = (uv.x - 0.5) * aspect * z * 0.55; // ground-plane x

    // Mown bands across the pitch, roughened with fbm so they read as grass, not a gradient.
    float bands = smoothstep(-0.2, 0.2, sin(z * 2.2 + fbm(vec2(x * 0.5, z * 0.35)) * 0.9));
    float grain = fbm(vec2(x * 9.0, z * 7.0) + uTime * 0.015);
    float turf  = mix(0.085, 0.140, bands) + grain * 0.040;
    vec3 grass  = vec3(0.17, 0.44, 0.28) * turf * 5.2;

    // Chalk: two touchlines and a halfway line, anti-aliased in screen space.
    float lwx = fwidth(x) * 1.3, lwz = fwidth(z) * 1.3;
    float chalk = 1.0 - smoothstep(0.0, lwx, abs(abs(x) - 2.6));
    chalk = max(chalk, (1.0 - smoothstep(0.0, lwz, abs(z - 5.5))) * step(abs(x), 2.6));
    grass = mix(grass, vec3(0.86, 0.85, 0.80) * 0.7, chalk * 0.6);

    // A pool of light that follows the pointer.
    float pool  = exp(-4.5 * distance(p, vec2(uMouse.x * aspect, uMouse.y)));
    float light = (0.40 + 0.60 * uLight) * (0.78 + 0.55 * pool);

    float fog = smoothstep(0.0, 0.38, d);     // grass fades into the dark at the horizon
    col = mix(col, grass * light + navy * 0.55, fog);
  }

  // Vignette keeps the edges quiet and the copy readable.
  float vig = smoothstep(1.25, 0.25, length((uv - vec2(0.55, 0.45)) * vec2(aspect, 1.0)));
  col *= mix(0.55, 1.0, vig);
  gl_FragColor = vec4(col, 1.0);
}`;

export function FloodlitPitch() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const probe = document.createElement("canvas");
    if (!probe.getContext("webgl2")) return; // keep the CSS fallback

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let disposed = false;
    let teardown = () => {};

    const start = async () => {
      const THREE = await import("three");
      if (disposed) return;

      const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: false, powerPreference: "low-power" });
      const canvas = renderer.domElement;
      canvas.setAttribute("aria-hidden", "true");
      el.appendChild(canvas);

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const uniforms = {
        uRes: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0.62, 0.3) },
        uLight: { value: 1 },
      };
      const material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, depthTest: false, depthWrite: false });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
      scene.add(quad);

      const size = () => {
        const { width, height } = el.getBoundingClientRect();
        const narrow = width < 720;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5) * (narrow ? 0.75 : 1));
        renderer.setSize(width, height, false);
        uniforms.uRes.value.set(width, height);
      };

      const target = new THREE.Vector2(0.62, 0.3);
      const onPointer = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        target.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
      };

      const lightFromScroll = () => {
        const r = el.getBoundingClientRect();
        const gone = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
        return 1 - gone * 0.85;
      };

      const draw = () => renderer.render(scene, camera);

      let visible = true;
      let raf = 0;
      const t0 = performance.now();
      const loop = () => {
        raf = 0;
        if (!visible || document.hidden) return;
        uniforms.uTime.value = (performance.now() - t0) / 1000;
        uniforms.uMouse.value.lerp(target, 0.06);
        uniforms.uLight.value += (lightFromScroll() - uniforms.uLight.value) * 0.12;
        draw();
        raf = requestAnimationFrame(loop);
      };
      const kick = () => {
        if (!reduce && !raf && visible && !document.hidden) raf = requestAnimationFrame(loop);
      };

      const ro = new ResizeObserver(() => {
        size();
        if (reduce) draw();
      });
      ro.observe(el);
      const io = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        kick();
      });
      io.observe(el);
      document.addEventListener("visibilitychange", kick);
      if (!reduce) window.addEventListener("pointermove", onPointer, { passive: true });

      size();
      draw();
      el.classList.add("is-live");
      kick();

      teardown = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        document.removeEventListener("visibilitychange", kick);
        window.removeEventListener("pointermove", onPointer);
        quad.geometry.dispose();
        material.dispose();
        renderer.dispose();
        canvas.remove();
      };
    };

    // Wait for the page to settle so three.js never competes with first paint.
    const w = window as Window & typeof globalThis;
    const hasIdle = typeof w.requestIdleCallback === "function";
    const handle = hasIdle ? w.requestIdleCallback(() => void start(), { timeout: 1500 }) : w.setTimeout(() => void start(), 300);

    return () => {
      disposed = true;
      if (hasIdle) w.cancelIdleCallback(handle);
      else w.clearTimeout(handle);
      teardown();
    };
  }, []);

  return <div ref={host} className="floodlit" aria-hidden="true" />;
}
