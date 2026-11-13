/**
 * The orbital home scene, written against the three.js module passed in
 * (three is only ever loaded with a dynamic import).
 *
 *  - Footballs built as real truncated icosahedra: 12 pentagon + 20 hexagon
 *    panels, each a separate faceted slab with a gap, so they read as
 *    crystalline orbs. One ball per chapter, each with its own kit.
 *  - A floodlit "pitch planet" horizon with a rim glow and atmosphere.
 *  - A star field and a few small satellite balls.
 *  - Scroll moves the featured ball: the previous one rises away to the top,
 *    the next waits low on the horizon. Drag spins, click opens.
 */
import type * as THREENS from "three";

type THREE = typeof THREENS;
export type OrbKind = "draw" | "scoresheet" | "seven" | "thursday";

export interface OrbitScene {
  /** Continuous chapter position: 0 = hero, 1..n = chapters. */
  setProgress(p: number): void;
  dispose(): void;
}

interface Opts {
  kinds: OrbKind[];
  reduce: boolean;
  onOpen(index: number): void;
  onHover(index: number | null): void;
}

/* ------------------------------------------------------------------ */
/* Geometry: truncated icosahedron panels                              */
/* ------------------------------------------------------------------ */

interface Panel {
  pent: boolean;
  center: THREENS.Vector3;
  verts: THREENS.Vector3[];
}

function footballPanels(T: THREE): Panel[] {
  const t = (1 + Math.sqrt(5)) / 2;
  const V = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map(([x, y, z]) => new T.Vector3(x, y, z).normalize());
  const F = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  const at = (a: number, b: number, f: number) => V[a].clone().lerp(V[b], f).normalize();

  const sortRound = (center: THREENS.Vector3, pts: THREENS.Vector3[]) => {
    const u = new T.Vector3(0, 1, 0).cross(center);
    if (u.lengthSq() < 1e-6) u.set(1, 0, 0);
    u.normalize();
    const w = center.clone().cross(u).normalize();
    return pts.sort((p, q) => Math.atan2(p.dot(w), p.dot(u)) - Math.atan2(q.dot(w), q.dot(u)));
  };

  const panels: Panel[] = [];
  V.forEach((v, i) => {
    const nb = new Set<number>();
    F.forEach((f) => {
      if (f.includes(i)) f.forEach((j) => j !== i && nb.add(j));
    });
    const pts = [...nb].map((j) => at(i, j, 1 / 3));
    panels.push({ pent: true, center: v.clone(), verts: sortRound(v, pts) });
  });
  F.forEach(([a, b, c]) => {
    const pts = [at(a, b, 1 / 3), at(a, b, 2 / 3), at(b, c, 1 / 3), at(b, c, 2 / 3), at(c, a, 1 / 3), at(c, a, 2 / 3)];
    const center = pts.reduce((s, p) => s.add(p), new T.Vector3()).normalize();
    panels.push({ pent: false, center, verts: sortRound(center, pts) });
  });
  return panels;
}

function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

interface Kit {
  color(p: Panel, i: number): string;
  glow: Set<number>;
  glowColor: string;
  edge: string;
}

function kitFor(kind: OrbKind, panels: Panel[]): Kit {
  const r = seeded(kind.length * 977 + kind.charCodeAt(0));
  const pickIdx = (n: number, filter: (p: Panel) => boolean) => {
    const pool = panels.map((p, i) => [p, i] as const).filter(([p]) => filter(p)).map(([, i]) => i);
    const out = new Set<number>();
    while (out.size < n && pool.length) out.add(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return out;
  };
  switch (kind) {
    case "draw":
      // White vs Red: the ball is split down the middle.
      return {
        color: (p) => (p.center.x < 0 ? (r() < 0.5 ? "#ecebe4" : "#d9d7cf") : r() < 0.5 ? "#c9352c" : "#a8261f"),
        glow: new Set(),
        glowColor: "#ffffff",
        edge: "#ffffff",
      };
    case "scoresheet": {
      const greens = ["#14713f", "#0f5c35", "#1f9e5a", "#0b4a2a"];
      return { color: () => greens[Math.floor(r() * greens.length)], glow: pickIdx(5, (p) => !p.pent), glowColor: "#d9a52c", edge: "#c9f5de" };
    }
    case "seven": {
      const navy = ["#13263d", "#1a3350", "#0e1d2f", "#22406a"];
      return { color: () => navy[Math.floor(r() * navy.length)], glow: pickIdx(7, () => true), glowColor: "#22c06e", edge: "#9cc3ff" };
    }
    case "thursday":
    default:
      return { color: (p) => (p.pent ? "#0c1925" : r() < 0.5 ? "#f2efe6" : "#dedbd2"), glow: new Set(), glowColor: "#ffffff", edge: "#ffffff" };
  }
}

function buildBall(T: THREE, kind: OrbKind, panels: Panel[]): THREENS.Group {
  const kit = kitFor(kind, panels);
  const jitter = seeded(kind.charCodeAt(1) * 131 + 7);
  const pos: number[] = [];
  const col: number[] = [];
  const glowPos: number[] = [];
  const edges: number[] = [];
  const c = new T.Color();

  panels.forEach((p, i) => {
    const lift = 1 + jitter() * 0.05;
    const top = p.verts.map((v) => v.clone().lerp(p.center, 0.1).normalize().multiplyScalar(lift));
    const bot = p.verts.map((v) => v.clone().lerp(p.center, 0.18).normalize().multiplyScalar(0.8));
    const ct = top.reduce((s, v) => s.add(v), new T.Vector3()).multiplyScalar(1 / top.length);
    const glow = kit.glow.has(i);
    const out = glow ? glowPos : pos;
    c.set(kit.color(p, i));
    const push = (...vs: THREENS.Vector3[]) => {
      vs.forEach((v) => {
        out.push(v.x, v.y, v.z);
        if (!glow) col.push(c.r, c.g, c.b);
      });
    };
    const n = top.length;
    for (let k = 0; k < n; k++) {
      const a = top[k];
      const b = top[(k + 1) % n];
      push(ct, a, b);
      push(a, bot[k], bot[(k + 1) % n]);
      push(a, bot[(k + 1) % n], b);
      edges.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  });

  const group = new T.Group();
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
  const mat = new T.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.26, flatShading: true, side: T.DoubleSide });
  group.add(new T.Mesh(g, mat));

  if (glowPos.length) {
    const gg = new T.BufferGeometry();
    gg.setAttribute("position", new T.Float32BufferAttribute(glowPos, 3));
    const gm = new T.MeshStandardMaterial({
      color: "#06150d",
      emissive: kit.glowColor,
      emissiveIntensity: 1.25,
      metalness: 0,
      roughness: 0.85,
      envMapIntensity: 0,
      flatShading: true,
      side: T.DoubleSide,
    });
    group.add(new T.Mesh(gg, gm));
  }

  const eg = new T.BufferGeometry();
  eg.setAttribute("position", new T.Float32BufferAttribute(edges, 3));
  group.add(new T.LineSegments(eg, new T.LineBasicMaterial({ color: kit.edge, transparent: true, opacity: 0.28 })));
  return group;
}

/* ------------------------------------------------------------------ */
/* Pitch planet + atmosphere                                            */
/* ------------------------------------------------------------------ */

const PLANET_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vP; varying vec3 vView;
void main() {
  vN = normalize(normalMatrix * normal);
  vP = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

const PLANET_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
varying vec3 vN; varying vec3 vP; varying vec3 vView;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+1.0),f.x), f.y); }
float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.07; a*=0.5; } return v; }
void main(){
  vec3 n = normalize(vN);
  vec3 v = normalize(vView);
  vec3 p = normalize(vP);
  // Mown bands, roughened so it reads as worn turf at night, not a gradient.
  float bands = smoothstep(-0.25, 0.25, sin(p.x * 95.0 + fbm(p.xz * 14.0) * 1.6));
  float grain = fbm(p.xz * 260.0 + uTime * 0.01);
  float rough = fbm(p.xz * 40.0);
  vec3 turf = mix(vec3(0.040, 0.070, 0.056), vec3(0.070, 0.120, 0.090), bands);
  turf = mix(turf, vec3(0.09, 0.10, 0.10), rough * 0.45) + grain * 0.035;
  // Chalk halfway line running away from the camera.
  float line = 1.0 - smoothstep(0.0009, 0.0024, abs(p.x));
  turf = mix(turf, vec3(0.55), line * 0.35);
  // Floodlit from behind the horizon.
  vec3 L = normalize(vec3(-0.25, 0.85, -0.55));
  float diff = clamp(dot(n, L), 0.0, 1.0);
  float rim = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 5.0);
  vec3 col = turf * (0.18 + 0.75 * diff) + vec3(0.55, 0.74, 0.66) * rim * 0.95;
  gl_FragColor = vec4(col, 1.0);
}`;

const ATMO_VERT = /* glsl */ `
varying vec3 vN;
void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const ATMO_FRAG = /* glsl */ `
varying vec3 vN;
void main(){
  float i = pow(clamp(0.55 - dot(vN, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 4.0);
  gl_FragColor = vec4(vec3(0.62, 0.78, 0.72) * i * 0.9, 1.0);
}`;

/* ------------------------------------------------------------------ */
/* Layout keyframes: where a ball sits relative to the featured slot   */
/* ------------------------------------------------------------------ */

type Key = [number, number, number, number]; // x, y, z, scale
const DESK: Record<number, Key> = {
  [-2]: [3.6, 7.8, -2, 0.5],
  [-1]: [2.2, 3.5, -1.6, 0.6],
  [0]: [2.55, 0.1, 0, 1.55],
  [1]: [-0.7, -3.25, 0.6, 0.72],
  [2]: [-1.6, -6.8, 0, 0.5],
};
const MOBILE: Record<number, Key> = {
  [-2]: [1.6, 8.5, -2, 0.4],
  [-1]: [1.0, 4.9, -1.6, 0.48],
  [0]: [0.15, 2.15, 0, 0.82],
  [1]: [-0.9, -3.4, 0.4, 0.55],
  [2]: [-1.4, -7.5, 0, 0.4],
};

function placeAt(table: Record<number, Key>, rel: number): Key {
  const r = Math.max(-2, Math.min(2, rel));
  const lo = Math.floor(r);
  const hi = Math.min(2, lo + 1);
  const f = r - lo;
  const s = f * f * (3 - 2 * f);
  const a = table[lo];
  const b = table[hi];
  return [0, 1, 2, 3].map((k) => a[k] + (b[k] - a[k]) * s) as Key;
}

/* ------------------------------------------------------------------ */

export function createOrbitScene(T: THREE, RoomEnvironment: new () => THREENS.Scene, host: HTMLElement, opts: Opts): OrbitScene {
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  const scene = new T.Scene();
  scene.background = new T.Color("#04080d");
  const pmrem = new T.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.4;

  const camera = new T.PerspectiveCamera(35, 1, 0.1, 200);
  camera.position.set(0, 0, 10);

  scene.add(new T.AmbientLight(0xffffff, 0.12));
  const key = new T.DirectionalLight(0xffffff, 1.9);
  key.position.set(-4, 6, 6);
  scene.add(key);
  const rim = new T.DirectionalLight(0x8fe3c0, 2.2);
  rim.position.set(5, 1, -6);
  scene.add(rim);

  // Stars
  const starGeo = new T.BufferGeometry();
  const sr = seeded(42);
  const star: number[] = [];
  for (let i = 0; i < 1800; i++) {
    const th = sr() * Math.PI * 2;
    const ph = Math.acos(2 * sr() - 1);
    const rad = 45 + sr() * 40;
    star.push(rad * Math.sin(ph) * Math.cos(th), rad * Math.cos(ph), -Math.abs(rad * Math.sin(ph) * Math.sin(th)) - 5);
  }
  starGeo.setAttribute("position", new T.Float32BufferAttribute(star, 3));
  const stars = new T.Points(starGeo, new T.PointsMaterial({ color: 0xcfd8e3, size: 0.09, sizeAttenuation: true, transparent: true, opacity: 0.75 }));
  scene.add(stars);

  // Pitch planet
  const planetUniforms = { uTime: { value: 0 } };
  const planet = new T.Mesh(
    new T.SphereGeometry(40, 160, 80),
    new T.ShaderMaterial({ vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG, uniforms: planetUniforms }),
  );
  const atmo = new T.Mesh(
    new T.SphereGeometry(40, 96, 48),
    new T.ShaderMaterial({ vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG, side: T.BackSide, blending: T.AdditiveBlending, transparent: true, depthWrite: false }),
  );
  atmo.scale.setScalar(1.016);
  const world = new T.Group();
  world.add(planet, atmo);
  scene.add(world);

  // Balls
  const panels = footballPanels(T);
  const balls = opts.kinds.map((k, i) => {
    const b = buildBall(T, k, panels);
    b.rotation.set(0.35, i * 1.3, 0.12);
    scene.add(b);
    return { group: b, vel: 0, spin: 0.12 + i * 0.015 };
  });

  // Small satellite balls drifting around the featured one
  const satMat = new T.MeshStandardMaterial({ color: "#5d7690", metalness: 0.5, roughness: 0.45, flatShading: true });
  const sats = [0.16, 0.11, 0.2, 0.09, 0.13].map((r, i) => {
    const m = new T.Mesh(new T.IcosahedronGeometry(r, 1), satMat);
    scene.add(m);
    return { m, a: i * 1.37, sp: 0.12 + i * 0.03, rx: 1.6 + i * 0.22, ry: 1.0 + (i % 3) * 0.4, z: -1 - i * 0.4 };
  });

  /* ---------- sizing ---------- */
  let mobile = false;
  const size = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    mobile = width / height < 0.85;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    world.position.set(0, mobile ? -43.2 : -44.6, -12);
  };

  /* ---------- interaction ---------- */
  const ray = new T.Raycaster();
  const ndc = new T.Vector2(9, 9);
  const parallax = new T.Vector2();
  let drag: { x: number; moved: number } | null = null;
  let hovered: number | null = null;
  let target = 0;
  let k = 0;

  const featured = () => Math.max(0, Math.min(balls.length - 1, Math.round(Math.max(0, k - 1))));
  const hitFeatured = () => {
    ray.setFromCamera(ndc, camera);
    const i = featured();
    return ray.intersectObject(balls[i].group, true).length > 0 ? i : null;
  };
  const toNdc = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    parallax.set(ndc.x, ndc.y);
  };
  const onDown = (e: PointerEvent) => {
    toNdc(e);
    drag = { x: e.clientX, moved: 0 };
  };
  const onMove = (e: PointerEvent) => {
    toNdc(e);
    if (drag) {
      const dx = e.clientX - drag.x;
      drag.x = e.clientX;
      drag.moved += Math.abs(dx);
      balls[featured()].vel += dx * 0.0035;
    }
    const h = hitFeatured();
    if (h !== hovered) {
      hovered = h;
      canvas.style.cursor = h === null ? (drag ? "grabbing" : "grab") : "pointer";
      opts.onHover(h);
    }
  };
  const onUp = () => {
    if (drag && drag.moved < 6) {
      const h = hitFeatured();
      if (h !== null) opts.onOpen(h);
    }
    drag = null;
  };
  canvas.style.cursor = "grab";
  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerup", onUp);

  /* ---------- loop ---------- */
  let raf = 0;
  let last = performance.now();
  let visible = true;
  const t0 = last;

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    k = opts.reduce ? Math.round(target) : k + (target - k) * Math.min(1, dt * 5);
    const idx = Math.max(0, k - 1); // hero (k=0) features ball 1
    const table = mobile ? MOBILE : DESK;

    balls.forEach((b, i) => {
      const rel = opts.reduce ? (i === Math.round(idx) ? 0 : 3) : i - idx;
      b.group.visible = Math.abs(rel) < 2.2;
      if (!b.group.visible) return;
      const [x, y, z, s] = placeAt(table, rel);
      b.group.position.set(x, y, z);
      b.group.scale.setScalar(s);
      if (!opts.reduce) {
        b.group.rotation.y += (b.spin + b.vel) * dt;
        b.group.rotation.x = 0.35 + Math.sin(now / 2600 + i) * 0.06;
      } else {
        b.group.rotation.y += b.vel * dt;
      }
      b.vel *= Math.pow(0.04, dt);
    });

    const [fx, fy, fz, fs] = placeAt(table, 0);
    sats.forEach((s, i) => {
      if (!opts.reduce) s.a += s.sp * dt;
      s.m.position.set(fx + Math.cos(s.a) * s.rx * fs, fy + Math.sin(s.a * 1.3) * s.ry * fs + (i % 2 ? 1.6 : -0.4), fz + s.z);
      s.m.rotation.x += dt * 0.3;
    });

    if (!opts.reduce) {
      stars.rotation.y += dt * 0.004;
      camera.position.x += (parallax.x * 0.25 - camera.position.x) * Math.min(1, dt * 3);
      camera.position.y += (parallax.y * 0.15 - camera.position.y) * Math.min(1, dt * 3);
      camera.lookAt(0, 0, 0);
      planetUniforms.uTime.value = (now - t0) / 1000;
    }
    world.rotation.x = -k * 0.025; // walk a little further over the horizon each chapter

    renderer.render(scene, camera);
  };

  const loop = (now: number) => {
    raf = 0;
    if (!visible || document.hidden) return;
    frame(now);
    const settled = opts.reduce && balls.every((b) => Math.abs(b.vel) < 0.001);
    if (!settled) raf = requestAnimationFrame(loop);
  };
  const kick = () => {
    if (!raf && visible && !document.hidden) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  };

  const ro = new ResizeObserver(() => {
    size();
    kick();
    frame(performance.now());
  });
  ro.observe(host);
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    kick();
  });
  io.observe(host);
  document.addEventListener("visibilitychange", kick);

  size();
  frame(performance.now());
  kick();

  return {
    setProgress(p: number) {
      target = p;
      kick();
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", kick);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      scene.traverse((o) => {
        const m = o as THREENS.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREENS.Material | THREENS.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
