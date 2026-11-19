/**
 * The "most captained" stage: the player's own squad mascot (an original
 * cartoon footballer, see components/Mascot.tsx) rebuilt in 3D on a lit plinth.
 * Same look as everywhere else: skin, hair style/colour, eyes, beard, boots,
 * socks, club kit with their initial, plus a captain's armband.
 *
 * Idles with a bob, blinks, waves now and then, turns slowly on its own;
 * drag to spin it. Written against the three module passed in.
 */
import type * as THREENS from "three";
import type { MascotLook } from "@/config/mascots";

type THREE = typeof THREENS;

export interface CaptainScene {
  dispose(): void;
}

const KIT = "#4c7d62";
const SHORTS = "#f5f0e6";
const INK = "#16110e";
const GOLD = "#c9a85c";

export function createCaptainScene(T: THREE, host: HTMLElement, look: MascotLook, initial: string, reduce: boolean): CaptainScene {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 2.3, 10.2);
  camera.lookAt(0, 1.85, 0);

  // ---- Light: a warm floodlight from above, a cool fill, a gold rim -------
  scene.add(new T.HemisphereLight(0xfff4e0, 0x1c1a17, 0.55));
  const spot = new T.SpotLight(0xfff1dc, 60, 20, Math.PI / 7, 0.55, 1.4);
  spot.position.set(0.6, 7.5, 3.2);
  spot.target.position.set(0, 0.8, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0004;
  scene.add(spot, spot.target);
  const rim = new T.DirectionalLight(0xd9b877, 2.2);
  rim.position.set(-4, 3, -4);
  scene.add(rim);
  const fill = new T.DirectionalLight(0x9fb7c9, 0.5);
  fill.position.set(4, 2, 5);
  scene.add(fill);

  const mat = (color: string, rough = 0.6, metal = 0) => new T.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  const shadowy = <M extends THREENS.Object3D>(m: M) => {
    m.traverse((o) => { if ((o as THREENS.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return m;
  };

  // ---- Plinth -------------------------------------------------------------
  const plinth = new T.Group();
  const base = new T.Mesh(new T.CylinderGeometry(1.55, 1.7, 0.42, 72), mat("#2b2118", 0.45, 0.2));
  base.position.y = -0.21;
  base.receiveShadow = true;
  const top = new T.Mesh(new T.CylinderGeometry(1.5, 1.5, 0.04, 72), mat("#26302a", 0.85));
  top.position.y = 0.02;
  top.receiveShadow = true;
  const ring = new T.Mesh(new T.TorusGeometry(1.56, 0.025, 12, 120), mat(GOLD, 0.25, 1));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.0;
  const ring2 = ring.clone();
  ring2.position.y = -0.42;
  ring2.scale.setScalar(1.09);
  plinth.add(base, top, ring, ring2);
  scene.add(plinth);

  // ---- The mascot -----------------------------------------------------------
  const figure = new T.Group();
  const bob = new T.Group();
  figure.add(bob);
  scene.add(figure);

  const skin = mat(look.skin, 0.55);
  const hairMat = mat(look.hairColor, 0.75);
  const kit = mat(KIT, 0.7);

  // Legs, socks, boots
  for (const sx of [-0.26, 0.26]) {
    const leg = new T.Mesh(new T.CapsuleGeometry(0.15, 0.42, 6, 16), skin);
    leg.position.set(sx, 0.62, 0);
    const sock = new T.Mesh(new T.CylinderGeometry(0.165, 0.165, 0.32, 20), mat(look.socks, 0.8));
    sock.position.set(sx, 0.38, 0);
    const boot = new T.Mesh(new T.CapsuleGeometry(0.17, 0.26, 6, 16), mat(look.boots, 0.35, 0.1));
    boot.rotation.x = Math.PI / 2;
    boot.position.set(sx, 0.17, 0.08);
    bob.add(leg, sock, boot);
  }

  // Shorts
  const shorts = new T.Mesh(new T.CylinderGeometry(0.56, 0.6, 0.42, 32), mat(SHORTS, 0.8));
  shorts.position.y = 1.0;
  bob.add(shorts);

  // Shirt with the initial on the front (canvas texture)
  const tex = (() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const g = c.getContext("2d")!;
    g.fillStyle = KIT;
    g.fillRect(0, 0, 512, 256);
    g.fillStyle = "rgba(0,0,0,0.08)";
    g.fillRect(0, 0, 512, 18);
    g.fillStyle = "#171412";
    g.font = "600 120px Fraunces, Georgia, serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(initial, 128, 140); // front of the cylinder faces +z at u = 0.25
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  })();
  const shirt = new T.Mesh(
    new T.CylinderGeometry(0.62, 0.6, 0.86, 48, 1, false, -Math.PI / 2, Math.PI * 2),
    new T.MeshStandardMaterial({ map: tex, roughness: 0.75 }),
  );
  shirt.position.y = 1.58;
  const shoulders = new T.Mesh(new T.SphereGeometry(0.62, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), kit);
  shoulders.scale.y = 0.42;
  shoulders.position.y = 2.0;
  const collar = new T.Mesh(new T.TorusGeometry(0.22, 0.05, 10, 32), mat(SHORTS, 0.7));
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 2.24;
  bob.add(shirt, shoulders, collar);

  // Arms (pivot at the shoulder). The right one waves.
  const arm = (side: 1 | -1) => {
    const pivot = new T.Group();
    pivot.position.set(0.68 * side, 2.02, 0);
    const sleeve = new T.Mesh(new T.CapsuleGeometry(0.15, 0.38, 6, 16), kit);
    sleeve.position.y = -0.32;
    const hand = new T.Mesh(new T.SphereGeometry(0.15, 20, 16), skin);
    hand.position.y = -0.68;
    pivot.add(sleeve, hand);
    pivot.rotation.z = 0.2 * side;
    return { pivot, sleeve };
  };
  const armL = arm(-1);
  const armR = arm(1);
  bob.add(armL.pivot, armR.pivot);

  // Captain's armband on the left sleeve, with a "C"
  const band = new T.Mesh(new T.CylinderGeometry(0.165, 0.165, 0.14, 24, 1, true), mat(GOLD, 0.3, 0.8));
  band.material.side = T.DoubleSide;
  band.position.y = -0.26;
  armL.pivot.add(band);
  const cTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = "#171412";
    g.font = "700 96px Manrope, system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("C", 64, 70);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    return t;
  })();
  const cBadge = new T.Mesh(new T.PlaneGeometry(0.14, 0.14), new T.MeshBasicMaterial({ map: cTex, transparent: true }));
  cBadge.position.set(-0.168, -0.26, 0.02);
  cBadge.rotation.y = -Math.PI / 2 + 0.25;
  armL.pivot.add(cBadge);

  // Head: big and round, ears, cheeks, face
  const head = new T.Group();
  head.position.y = 3.02;
  bob.add(head);
  const neck = new T.Mesh(new T.CylinderGeometry(0.17, 0.2, 0.3, 20), skin);
  neck.position.y = 2.32;
  bob.add(neck);
  const R = 0.82;
  head.add(new T.Mesh(new T.SphereGeometry(R, 64, 48), skin));
  for (const sx of [-1, 1]) {
    const ear = new T.Mesh(new T.SphereGeometry(0.17, 20, 16), skin);
    ear.position.set(0.8 * sx, -0.08, 0);
    ear.scale.set(0.6, 1, 0.8);
    head.add(ear);
    const cheek = new T.Mesh(new T.CircleGeometry(0.12, 24), new T.MeshBasicMaterial({ color: 0xff7a7a, transparent: true, opacity: 0.22 }));
    const cx = 0.45 * sx, cy = -0.28;
    cheek.position.set(cx, cy, Math.sqrt(R * R - cx * cx - cy * cy) + 0.004);
    cheek.lookAt(cheek.position.clone().multiplyScalar(2));
    head.add(cheek);
  }

  // Put something on the head's surface, facing out, at a given (x, y) on the face.
  const onFace = (o: THREENS.Object3D, x: number, y: number, lift = 0) => {
    const z = Math.sqrt(Math.max(0, R * R - x * x - y * y));
    const n = new T.Vector3(x, y, z).normalize();
    o.position.copy(n.clone().multiplyScalar(R + lift));
    o.lookAt(n.clone().multiplyScalar(R * 3));
    head.add(o);
    return o;
  };

  // Eyes
  const eyes = new T.Group();
  head.add(eyes);
  const inkMat = mat(INK, 0.3);
  for (const sx of [-1, 1]) {
    const ex = 0.27 * sx, ey = 0.06;
    if (look.eyes === "happy") {
      const arc = new T.Mesh(new T.TorusGeometry(0.1, 0.028, 8, 24, Math.PI), inkMat);
      eyes.add(onFace(arc, ex, ey, 0.01));
    } else if (look.eyes === "dot") {
      const d = new T.Mesh(new T.SphereGeometry(0.07, 20, 16), inkMat);
      d.scale.z = 0.5;
      eyes.add(onFace(d, ex, ey, 0.0));
    } else {
      const white = new T.Mesh(new T.SphereGeometry(0.13, 24, 16), mat("#ffffff", 0.2));
      white.scale.z = 0.45;
      eyes.add(onFace(white, ex, ey, 0.0));
      const pupil = new T.Mesh(new T.SphereGeometry(0.07, 20, 16), inkMat);
      pupil.scale.z = 0.45;
      eyes.add(onFace(pupil, ex + 0.015, ey - 0.01, 0.045));
      const glint = new T.Mesh(new T.SphereGeometry(0.022, 10, 8), new T.MeshBasicMaterial({ color: 0xffffff }));
      eyes.add(onFace(glint, ex + 0.04, ey + 0.03, 0.075));
    }
  }
  // Brows, tilted like the 2D mascot
  for (const sx of [-1, 1]) {
    const brow = new T.Mesh(new T.CapsuleGeometry(0.03, 0.17, 4, 8), hairMat);
    onFace(brow, 0.27 * sx, 0.3, 0.01);
    brow.rotateZ(Math.PI / 2 + (look.brow * Math.PI / 180) * -sx);
  }
  // Mouth
  {
    const mouth = look.mouth;
    if (mouth === "o") {
      onFace(new T.Mesh(new T.TorusGeometry(0.06, 0.025, 8, 20), inkMat), 0, -0.3, 0.01);
    } else {
      const span = mouth === "grin" ? Math.PI * 0.95 : mouth === "smile" ? Math.PI * 0.7 : Math.PI * 0.5;
      const r = mouth === "grin" ? 0.17 : 0.14;
      const m = new T.Mesh(new T.TorusGeometry(r, 0.026, 8, 32, span), inkMat);
      const g = new T.Group();
      g.add(m);
      m.rotation.z = Math.PI + (Math.PI - span) / 2 + (mouth === "smirk" ? 0.35 : 0);
      onFace(g, mouth === "smirk" ? 0.05 : 0, -0.18, 0.005);
    }
  }
  // Beard: a shell over the jaw in the hair colour
  if (look.beard) {
    // phi = π/2 faces +z (the face); theta from just under the mouth to the chin.
    const beard = new T.Mesh(new T.SphereGeometry(R + 0.025, 48, 24, Math.PI * 0.16, Math.PI * 0.68, Math.PI * 0.7, Math.PI * 0.24), hairMat);
    beard.material = hairMat.clone();
    (beard.material as THREENS.MeshStandardMaterial).side = T.DoubleSide;
    head.add(beard);
  }

  // Hair: a cap over the crown, then a flourish per style
  const cap = (thetaLen = Math.PI * 0.42, lift = 0.04) => {
    const m = new T.Mesh(new T.SphereGeometry(R + lift, 64, 32, 0, Math.PI * 2, 0, thetaLen), hairMat);
    m.rotation.x = -0.18; // a touch further back than the brow
    head.add(m);
    return m;
  };
  switch (look.hair) {
    case "buzz":
      cap(Math.PI * 0.36, 0.02);
      break;
    case "curly": {
      cap(Math.PI * 0.38, 0.03);
      for (let i = 0; i < 26; i++) {
        const th = (i / 26) * Math.PI * 2;
        const ph = 0.25 + (i % 3) * 0.28;
        const b = new T.Mesh(new T.SphereGeometry(0.2, 16, 12), hairMat);
        b.position.set(Math.sin(ph) * Math.cos(th) * (R + 0.06), Math.cos(ph) * (R + 0.06), Math.sin(ph) * Math.sin(th) * (R + 0.06));
        if (b.position.z > 0.45 && b.position.y < 0.55) continue; // keep the forehead clear
        head.add(b);
      }
      break;
    }
    case "quiff": {
      cap(Math.PI * 0.38, 0.03);
      const q = new T.Mesh(new T.SphereGeometry(0.42, 32, 16), hairMat);
      q.scale.set(1.2, 0.6, 0.9);
      q.position.set(0.12, 0.78, 0.32);
      q.rotation.z = -0.3;
      head.add(q);
      break;
    }
    case "spiky": {
      cap(Math.PI * 0.36, 0.03);
      for (let i = 0; i < 14; i++) {
        const th = (i / 14) * Math.PI * 2;
        const ph = i % 2 ? 0.35 : 0.65;
        const spike = new T.Mesh(new T.ConeGeometry(0.13, 0.42, 10), hairMat);
        const n = new T.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
        spike.position.copy(n.clone().multiplyScalar(R + 0.12));
        spike.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), n);
        head.add(spike);
      }
      const top = new T.Mesh(new T.ConeGeometry(0.14, 0.48, 10), hairMat);
      top.position.y = R + 0.18;
      head.add(top);
      break;
    }
    case "waves": {
      cap(Math.PI * 0.4, 0.035);
      for (let k = 0; k < 4; k++) {
        const w = new T.Mesh(new T.TorusGeometry(R * (0.35 + k * 0.17), 0.018, 6, 64), mat("#000000", 0.9));
        (w.material as THREENS.MeshStandardMaterial).transparent = true;
        (w.material as THREENS.MeshStandardMaterial).opacity = 0.25;
        w.rotation.x = Math.PI / 2;
        w.position.y = Math.sqrt(Math.max(0, (R + 0.04) ** 2 - (R * (0.35 + k * 0.17)) ** 2));
        head.add(w);
      }
      break;
    }
    case "sidepart": {
      const c = cap(Math.PI * 0.4, 0.04);
      c.rotation.z = 0.12;
      const sweep = new T.Mesh(new T.SphereGeometry(0.4, 24, 16), hairMat);
      sweep.scale.set(1.3, 0.45, 0.8);
      sweep.position.set(-0.28, 0.66, 0.42);
      sweep.rotation.z = 0.35;
      head.add(sweep);
      break;
    }
    case "topknot": {
      cap(Math.PI * 0.38, 0.03);
      const bun = new T.Mesh(new T.SphereGeometry(0.26, 24, 16), hairMat);
      bun.position.y = R + 0.26;
      const tie = new T.Mesh(new T.TorusGeometry(0.13, 0.04, 8, 24), kit);
      tie.rotation.x = Math.PI / 2;
      tie.position.y = R + 0.06;
      head.add(bun, tie);
      break;
    }
    case "mop":
    default: {
      const c = cap(Math.PI * 0.5, 0.06);
      c.rotation.x = -0.32;
      const fringe = new T.Mesh(new T.SphereGeometry(R + 0.07, 48, 16, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.18, Math.PI * 0.14), hairMat);
      fringe.rotation.y = Math.PI;
      head.add(fringe);
      break;
    }
  }

  shadowy(bob);
  figure.position.y = 0.04;

  // ---- Floating gold motes ---------------------------------------------------
  const motes = new T.Group();
  const moteMat = new T.MeshBasicMaterial({ color: 0xe8c77a, transparent: true, opacity: 0.85 });
  const moteGeo = new T.OctahedronGeometry(0.035);
  const moteData: { m: THREENS.Mesh; r: number; a: number; y: number; s: number }[] = [];
  for (let i = 0; i < 36; i++) {
    const m = new T.Mesh(moteGeo, moteMat);
    const d = { m, r: 1.6 + Math.random() * 1.6, a: Math.random() * Math.PI * 2, y: Math.random() * 4, s: 0.15 + Math.random() * 0.35 };
    moteData.push(d);
    motes.add(m);
  }
  scene.add(motes);

  // ---- Interaction: drag to spin ------------------------------------------------
  let spin = reduce ? 0 : 0.35; // rad/s auto turn
  let vel = 0;
  let yaw = -0.35;
  let dragging = false;
  let lastX = 0;
  const onDown = (e: PointerEvent) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    yaw += dx * 0.012;
    vel = dx * 0.6;
  };
  const onUp = () => { dragging = false; };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.style.touchAction = "pan-y";
  canvas.style.cursor = "grab";

  // ---- Size + loop --------------------------------------------------------------
  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  let visible = true;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }, { threshold: 0 });
  io.observe(host);

  let raf = 0;
  let last = performance.now();
  const t0 = last;
  const frame = (now: number) => {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - t0) / 1000;
    if (!dragging) {
      vel *= Math.pow(0.04, dt);
      yaw += (spin + vel) * dt;
    }
    figure.rotation.y = yaw;
    plinth.rotation.y = yaw * 0.5;
    if (!reduce) {
      bob.position.y = Math.abs(Math.sin(t * 2.2)) * 0.06;
      head.rotation.z = Math.sin(t * 1.1) * 0.05;
      // Blink every ~4 s
      const blink = (t % 4.2) > 4.05 ? 0.12 : 1;
      eyes.scale.y = blink;
      // Wave for a second every ~6 s
      const w = t % 6.5;
      armR.pivot.rotation.z = w < 1.6 ? 2.5 + Math.sin(w * 11) * 0.35 : 0.2 + Math.sin(t * 2.2) * 0.04;
      armL.pivot.rotation.z = -0.2 - Math.sin(t * 2.2) * 0.04;
      for (const d of moteData) {
        d.a += d.s * dt;
        d.y = (d.y + d.s * 0.25 * dt) % 4.2;
        d.m.position.set(Math.cos(d.a) * d.r, d.y - 0.2, Math.sin(d.a) * d.r * 0.7 - 0.4);
        d.m.rotation.y += dt * 2;
      }
    } else {
      for (const d of moteData) d.m.position.set(Math.cos(d.a) * d.r, d.y - 0.2, Math.sin(d.a) * d.r * 0.7 - 0.4);
    }
    renderer.render(scene, camera);
    if (visible && !reduce) raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  kick();
  // Reduced motion: still redraw when dragged.
  if (reduce) canvas.addEventListener("pointermove", kick);

  return {
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointermove", kick);
      scene.traverse((o) => {
        const m = o as THREENS.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          const ms = Array.isArray(m.material) ? m.material : [m.material];
          ms.forEach((x) => { (x as THREENS.MeshStandardMaterial).map?.dispose(); x.dispose(); });
        }
      });
      renderer.dispose();
      canvas.remove();
    },
  };
}
