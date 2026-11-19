/**
 * The club loader's 3D scene (counts 1 → 100 before the site opens).
 *
 * Every piece stands for something the club plays by:
 *  - The match ball at the centre, clear-coated, turning under floodlights.
 *  - A 60-tick match clock around it. The arc fills as the count rises: one
 *    fun 60-minute match, minute by minute.
 *  - Three orbits around the ball, one per principle, each lighting up in turn:
 *    Respect (gold), No hard fouls (green), A fun 60 minutes (bone).
 *    They're orbits rather than walls: the principles keep the game turning.
 *  - Floodlight dust that drifts in toward the ball as the count rises, and
 *    scatters in a burst at 100.
 *
 * Bloom (UnrealBloomPass) makes the arc, ticks and orbits glow. Written
 * against the three module and addons passed in so they stay code-split.
 */
import type * as THREENS from "three";
import type { EffectComposer as EC } from "three/examples/jsm/postprocessing/EffectComposer.js";
import type { RenderPass as RP } from "three/examples/jsm/postprocessing/RenderPass.js";
import type { UnrealBloomPass as UBP } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { OutputPass as OP } from "three/examples/jsm/postprocessing/OutputPass.js";

type THREE = typeof THREENS;
export interface LoaderAddons {
  EffectComposer: typeof EC;
  RenderPass: typeof RP;
  UnrealBloomPass: typeof UBP;
  OutputPass: typeof OP;
}

export interface LoaderScene {
  /** 0..1 — the count divided by 100. */
  setProgress(p: number): void;
  /** The final whistle: a pulse and a burst of dust. */
  burst(): void;
  dispose(): void;
}

/** Respect, No hard fouls, A fun 60 minutes. */
export const PRINCIPLE_COLORS = ["#e2c27a", "#7fc49a", "#f5f0e6"] as const;
const GOLD = "#c9a85c";

export function createLoaderScene(T: THREE, A: LoaderAddons, host: HTMLElement): LoaderScene {
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  const scene = new T.Scene();
  scene.background = new T.Color("#100f0d");
  scene.fog = new T.FogExp2("#100f0d", 0.045);
  const camera = new T.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0.4, 9);

  // ---- Light ----------------------------------------------------------------
  scene.add(new T.HemisphereLight(0xfff4e0, 0x141210, 0.6));
  const key = new T.DirectionalLight(0xfff1dc, 2.6);
  key.position.set(3, 5, 4);
  const rim = new T.DirectionalLight(0xd9b877, 2.0);
  rim.position.set(-4, 2, -3);
  const glow = new T.PointLight(0xc9a85c, 0, 8, 2);
  glow.position.set(0, 0, 2.2);
  scene.add(key, rim, glow);

  const world = new T.Group();
  world.position.y = 0.45;
  world.scale.setScalar(0.8);
  scene.add(world);
  const disposables: { dispose(): void }[] = [];
  const keep = <D extends { dispose(): void }>(d: D) => (disposables.push(d), d);

  // ---- The ball: 12 pentagons, 20 hexagons, seams between ------------------
  // Panels are worked out per pixel from the object-space normal, so the edges stay crisp.
  const phi = (1 + Math.sqrt(5)) / 2;
  const ip = 1 / phi;
  // Pentagon centres = icosahedron vertices; hexagon centres = dodecahedron vertices.
  const centres: THREENS.Vector3[] = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
  ].map(([x, y, z]) => new T.Vector3(x, y, z).normalize());
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) centres.push(new T.Vector3(x, y, z).normalize());
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    centres.push(new T.Vector3(0, a * ip, b * phi).normalize(), new T.Vector3(a * ip, b * phi, 0).normalize(), new T.Vector3(a * phi, 0, b * ip).normalize());
  }
  const ballMat = keep(new T.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.16, sheen: 0.25 }));
  ballMat.onBeforeCompile = (shader) => {
    shader.uniforms.uCentres = { value: centres };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObjN;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObjN = normalize(position);");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObjN;\nuniform vec3 uCentres[32];")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          vec3 n = normalize(vObjN);
          float best = -2.0, second = -2.0; int bi = 0;
          for (int i = 0; i < 32; i++) {
            float d = dot(n, uCentres[i]);
            if (d > best) { second = best; best = d; bi = i; } else if (d > second) { second = d; }
          }
          float aa = fwidth(best - second) * 1.5;
          float seam = 1.0 - smoothstep(0.004, 0.004 + aa + 0.004, best - second);
          vec3 panel = bi < 12 ? vec3(0.035, 0.03, 0.026) : vec3(0.93, 0.9, 0.84);
          diffuseColor.rgb = mix(panel, vec3(0.42, 0.39, 0.35), seam * 0.85);
        }`,
      );
  };
  const ball = new T.Mesh(keep(new T.IcosahedronGeometry(1, 12)), ballMat);
  ball.rotation.set(0.4, 0.2, 0.1);
  world.add(ball);

  // ---- The 60-minute match clock --------------------------------------------
  const CLOCK_R = 2.25;
  const arcMat = keep(
    new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      uniforms: { uProgress: { value: 0 }, uColor: { value: new T.Color(GOLD) }, uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uProgress; uniform vec3 uColor; uniform float uTime;
        varying vec2 vUv;
        const float TAU = 6.28318530718;
        void main() {
          vec2 p = vUv - 0.5;
          float r = length(p) * 2.0;
          // clockwise from 12 o'clock
          float a = mod(atan(p.x, p.y) + TAU, TAU) / TAU;
          float band = smoothstep(0.90, 0.925, r) * (1.0 - smoothstep(0.955, 0.98, r));
          float filled = step(a, uProgress);
          float head = exp(-pow((a - uProgress) * 60.0, 2.0)) * step(0.001, uProgress);
          float shimmer = 0.85 + 0.15 * sin(a * 40.0 - uTime * 4.0);
          float track = band * 0.07;
          float alpha = band * filled * shimmer * 0.55 + band * head * 1.4 + track;
          gl_FragColor = vec4(uColor * (1.0 + head * 1.2), alpha);
        }`,
    }),
  );
  const arc = new T.Mesh(keep(new T.PlaneGeometry(CLOCK_R * 2.2, CLOCK_R * 2.2)), arcMat);
  world.add(arc);

  // 60 ticks, one per minute; every 15th is longer.
  const tickGeo = keep(new T.BoxGeometry(0.025, 0.14, 0.02));
  const tickMat = keep(new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  const ticks = new T.InstancedMesh(tickGeo, tickMat, 60);
  const tickColor = new T.Color();
  const dim = new T.Color("#3b352c");
  const lit = new T.Color(GOLD).multiplyScalar(1.5);
  {
    const m = new T.Matrix4();
    const q = new T.Quaternion();
    const s = new T.Vector3();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const r = CLOCK_R * 1.15;
      q.setFromAxisAngle(new T.Vector3(0, 0, 1), -a);
      s.set(1, i % 15 === 0 ? 1.9 : 1, 1);
      m.compose(new T.Vector3(Math.sin(a) * r, Math.cos(a) * r, 0), q, s);
      ticks.setMatrixAt(i, m);
      ticks.setColorAt(i, dim);
    }
  }
  world.add(ticks);

  // ---- Three principle orbits ------------------------------------------------
  const tilts: [number, number][] = [[1.15, 0.35], [1.15, -0.95], [0.25, 1.6]];
  const orbits = PRINCIPLE_COLORS.map((col, i) => {
    const g = new T.Group();
    g.rotation.set(tilts[i][0], tilts[i][1], 0);
    const ringMat = keep(new T.MeshBasicMaterial({ color: new T.Color(col), transparent: true, opacity: 0.08, toneMapped: false }));
    const ring = new T.Mesh(keep(new T.TorusGeometry(1.55 + i * 0.12, 0.008, 8, 200)), ringMat);
    const satMat = keep(new T.MeshBasicMaterial({ color: new T.Color(col), transparent: true, opacity: 0.15, toneMapped: false }));
    const sat = new T.Mesh(keep(new T.SphereGeometry(0.055, 16, 16)), satMat);
    g.add(ring, sat);
    world.add(g);
    return { g, ringMat, satMat, sat, radius: 1.55 + i * 0.12, base: new T.Color(col), level: 0, speed: 1.2 + i * 0.35, phase: i * 2.1 };
  });

  // ---- Floodlight dust ---------------------------------------------------------
  const DUST = 1400;
  const home = new Float32Array(DUST * 3);
  const dustPos = new Float32Array(DUST * 3);
  const seeds = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    const r = 3.2 + Math.random() * 6;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    home.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.7, r * Math.sin(ph) * Math.sin(th) - 1], i * 3);
    seeds[i] = Math.random();
  }
  dustPos.set(home);
  const dustGeo = keep(new T.BufferGeometry());
  dustGeo.setAttribute("position", new T.BufferAttribute(dustPos, 3));
  const dustTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d")!;
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,244,224,1)");
    g.addColorStop(0.35, "rgba(255,230,190,0.45)");
    g.addColorStop(1, "rgba(255,230,190,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return keep(new T.CanvasTexture(c));
  })();
  const dustMat = keep(
    new T.PointsMaterial({ size: 0.06, map: dustTex, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending, color: 0xf3dfb5 }),
  );
  const dust = new T.Points(dustGeo, dustMat);
  scene.add(dust);

  // ---- Post: bloom ---------------------------------------------------------------
  const composer = new A.EffectComposer(renderer);
  composer.addPass(new A.RenderPass(scene, camera));
  const bloom = new A.UnrealBloomPass(new T.Vector2(1, 1), 0.5, 0.4, 0.62);
  composer.addPass(bloom);
  composer.addPass(new A.OutputPass());

  const resize = () => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
    camera.aspect = w / h;
    // Keep the clock in frame on narrow (portrait) screens.
    camera.position.z = w / h < 0.8 ? 9 / Math.max(0.5, (w / h) / 0.8) : 9;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // Pointer parallax.
  const look = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (e: PointerEvent) => {
    look.tx = (e.clientX / window.innerWidth - 0.5) * 0.5;
    look.ty = (e.clientY / window.innerHeight - 0.5) * 0.3;
  };
  window.addEventListener("pointermove", onMove, { passive: true });

  // ---- Loop -----------------------------------------------------------------------
  let target = 0;
  let shown = 0;
  let burstAt = -1;
  let lastTick = -1;
  const clock = new T.Clock();
  let raf = 0;

  const frame = () => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;
    shown += (target - shown) * Math.min(1, dt * 9);

    arcMat.uniforms.uProgress.value = shown;
    arcMat.uniforms.uTime.value = t;

    // Ticks light up minute by minute.
    const minute = Math.floor(shown * 60 + 1e-4);
    if (minute !== lastTick) {
      for (let i = 0; i < 60; i++) ticks.setColorAt(i, tickColor.copy(i < minute ? lit : dim));
      ticks.instanceColor!.needsUpdate = true;
      lastTick = minute;
    }

    // Principles: each orbit ignites over its third of the count.
    orbits.forEach((o, i) => {
      const want = Math.min(1, Math.max(0, (shown - i / 3) * 3));
      o.level += (want - o.level) * Math.min(1, dt * 6);
      o.ringMat.opacity = 0.08 + o.level * 0.7;
      o.ringMat.color.copy(o.base).multiplyScalar(1 + o.level * 0.6);
      o.satMat.opacity = 0.15 + o.level * 0.85;
      o.satMat.color.copy(o.base).multiplyScalar(1 + o.level * 1.8);
      const a = t * o.speed * (0.4 + o.level) + o.phase;
      o.sat.position.set(Math.cos(a) * o.radius, Math.sin(a) * o.radius, 0);
      o.g.rotation.z += dt * 0.08 * (i % 2 ? -1 : 1);
    });

    // Ball: rolls faster as kick-off nears.
    ball.rotation.y += dt * (0.35 + shown * 1.6);
    ball.rotation.x += dt * 0.12;
    const since = burstAt < 0 ? -1 : t - burstAt;
    const pulse = since >= 0 ? Math.exp(-since * 3.5) * Math.sin(since * 14) * 0.12 : 0;
    ball.scale.setScalar(1 + pulse + Math.sin(t * 2.2) * 0.012);
    glow.intensity = 1.2 * shown + (since >= 0 ? Math.exp(-since * 2.5) * 12 : 0);
    bloom.strength = 0.45 + shown * 0.25 + (since >= 0 ? Math.exp(-since * 2) * 0.9 : 0);

    // Dust: drifts in as the count rises, scatters on the burst.
    const pull = shown * 0.45;
    const scatter = since >= 0 ? 1 + since * 2.2 : 1;
    for (let i = 0; i < DUST; i++) {
      const k = i * 3;
      const sw = Math.sin(t * 0.6 + seeds[i] * 12) * 0.15;
      const f = (1 - pull * (0.6 + seeds[i] * 0.4)) * scatter;
      const spin = t * 0.05 * (0.5 + seeds[i]);
      const hx = home[k], hz = home[k + 2];
      dustPos[k] = (hx * Math.cos(spin) - hz * Math.sin(spin)) * f + sw;
      dustPos[k + 1] = home[k + 1] * f + Math.cos(t * 0.5 + seeds[i] * 9) * 0.12;
      dustPos[k + 2] = (hx * Math.sin(spin) + hz * Math.cos(spin)) * f;
    }
    dustGeo.attributes.position.needsUpdate = true;

    look.x += (look.tx - look.x) * dt * 3;
    look.y += (look.ty - look.y) * dt * 3;
    world.rotation.y = look.x;
    world.rotation.x = look.y;
    camera.lookAt(0, 0.2, 0);

    composer.render();
  };
  frame();

  return {
    setProgress(p) { target = Math.min(1, Math.max(0, p)); },
    burst() { if (burstAt < 0) burstAt = clock.elapsedTime; },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      disposables.forEach((d) => d.dispose());
      ticks.dispose();
      bloom.dispose();
      composer.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
