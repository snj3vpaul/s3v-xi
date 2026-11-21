import type { CSSProperties } from "react";
import type { PortraitLook } from "@/config/portraits";

/**
 * A hand-built anime-style bust in four stacked SVG layers (2.5D):
 *   0 shoulders, kit, neck, back hair    (depth 0)
 *   1 face, ears, beard, light and rim   (depth 1)
 *   2 eyes, brows, nose, mouth, glasses  (depth 1.7)
 *   3 front hair and cap                 (depth 2.1)
 * Each layer shifts by its depth × the card's --px/--py (set by HoloCard with
 * GSAP), so the head turns in 3D while staying vector-sharp. The pupils follow
 * the same vars, and a highlight slides across the face toward the light.
 * Blink, breathing and hair sway are CSS. All motion stops with reduced motion.
 */
const INK = "#1a1210";
const CX = 100;
const VB = "0 0 200 240";

export function AnimePortrait({ id, look, phase = 0, className }: { id: string; look: PortraitLook; phase?: number; className?: string }) {
  const cw = 41 + look.jaw * 4; // cheek half-width
  const jw = 29 + look.jaw * 9; // jaw half-width
  const chin = 170 + look.length * 12;
  const eyeY = 120;
  const g = (s: string) => `${id}-${s}`;
  const face = `M${CX - cw} 104 C${CX - cw} 132 ${CX - jw} 150 ${CX - 13} ${chin - 5} Q${CX} ${chin + 3} ${CX + 13} ${chin - 5} C${CX + jw} 150 ${CX + cw} 132 ${CX + cw} 104 C${CX + cw} 52 ${CX - cw} 52 ${CX - cw} 104 Z`;
  const torso = "M14 240 C20 206 52 192 78 188 L122 188 C148 192 180 206 186 240 Z";
  const style = { "--pt-phase": `${phase}s` } as CSSProperties;
  const layer = (depth: number) => ({ className: "pt-layer", viewBox: VB, "aria-hidden": true, style: { "--d": depth } as CSSProperties });

  return (
    <div className={`pt3d ${className ?? ""}`} style={style} role="img" aria-hidden="true">
      <div className="pt-bust">
        {/* 0: body */}
        <svg {...layer(0)}>
          <defs>
            <radialGradient id={g("skin")} cx="0.42" cy="0.38" r="0.75">
              <stop offset="0" stopColor={look.skin} />
              <stop offset="0.68" stopColor={look.skin} />
              <stop offset="1" stopColor={look.shade} />
            </radialGradient>
            <radialGradient id={g("iris")} cx="0.5" cy="0.35" r="0.75">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.15" />
              <stop offset="0.35" stopColor={look.iris} />
              <stop offset="1" stopColor={INK} />
            </radialGradient>
            <linearGradient id={g("kit")} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={look.kit} />
              <stop offset="1" stopColor={look.kit} stopOpacity="0.78" />
            </linearGradient>
            <radialGradient id={g("light")} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#fff8e8" stopOpacity="0.55" />
              <stop offset="1" stopColor="#fff8e8" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={g("ao")} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#000" stopOpacity="0.45" />
              <stop offset="1" stopColor="#000" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={g("rim")} x1="0" y1="0" x2="1" y2="0.3">
              <stop offset="0.62" stopColor="#fff" stopOpacity="0" />
              <stop offset="1" style={{ stopColor: "var(--fut-key, #e9d8a6)" }} />
            </linearGradient>
            <clipPath id={g("torso")}>
              <path d={torso} />
            </clipPath>
            <clipPath id={g("face")}>
              <path d={face} />
            </clipPath>
          </defs>
          {/* soft contact shadow behind the head (no filters: stays crisp while moving) */}
          <ellipse cx={CX + 4} cy={150} rx={cw + 22} ry={70} fill={`url(#${g("ao")})`} />
          {look.hair === "curls" && <CurlsBack c={look.hairColor} />}
          <path d={torso} fill={`url(#${g("kit")})`} />
          <path d="M14 240 C20 206 52 192 78 188 L84 188 C62 198 40 214 34 240 Z" fill="#000" opacity="0.14" />
          <path d="M186 240 C180 206 148 192 122 188 L116 188 C140 198 162 214 168 240 Z" fill="#fff" opacity="0.08" />
          <Kit look={look} clip={g("torso")} />
          <path d={`M${CX - 16} ${chin - 16} L${CX - 17} 196 Q${CX} 205 ${CX + 17} 196 L${CX + 16} ${chin - 16} Z`} fill={look.shade} />
          <path d={`M${CX - 3} ${chin - 10} L${CX + 16} ${chin - 16} L${CX + 17} 196 Q${CX + 8} 202 ${CX - 3} 201 Z`} fill={look.skin} opacity="0.7" />
          {look.extras?.includes("chain") && (
            <path d={`M${CX - 17} 190 Q${CX} 214 ${CX + 17} 190`} fill="none" stroke="#d9b24a" strokeWidth="2" strokeDasharray="2.5 1.5" />
          )}
          {look.extras?.includes("medal") && <Medal />}
        </svg>

        {/* 1: face */}
        <svg {...layer(1)}>
          <ellipse cx={CX - cw + 1} cy={eyeY + 4} rx="6.5" ry="10" fill={look.shade} />
          <ellipse cx={CX + cw - 1} cy={eyeY + 4} rx="6.5" ry="10" fill={look.shade} />
          <ellipse cx={CX + cw} cy={eyeY + 4} rx="2.5" ry="5" fill="#000" opacity="0.15" />
          <path d={face} fill={`url(#${g("skin")})`} />
          {look.beard === "full" && <path d={`M${CX - 24} ${chin - 10} Q${CX} ${chin + 18} ${CX + 24} ${chin - 10} Z`} fill={look.beardColor} />}
          {look.beard === "long" && (
            <path d={`M${CX - 30} ${chin - 14} Q${CX - 18} ${chin + 26} ${CX} ${chin + 30} Q${CX + 18} ${chin + 26} ${CX + 30} ${chin - 14} Z`} fill={look.beardColor} />
          )}
          <g clipPath={`url(#${g("face")})`}>
            {/* cel shadow under the hairline, cheekbone and jaw shading */}
            <path d={`M${CX - cw} 70 Q${CX} 98 ${CX + cw} 70 L${CX + cw} 92 Q${CX} 108 ${CX - cw} 92 Z`} fill={look.shade} opacity="0.35" />
            <path d={`M${CX + cw - 10} 110 Q${CX + cw - 4} 140 ${CX + 12} ${chin}`} fill="none" stroke={look.shade} strokeWidth="8" opacity="0.35" />
            <Beard look={look} chin={chin} />
            {/* moving key light: slides toward the pointer */}
            <ellipse className="pt-light" cx={CX - 12} cy={eyeY - 8} rx={cw} ry={cw * 0.9} fill={`url(#${g("light")})`} />
          </g>
          {/* rim light on the shadow side */}
          <path className="pt-rim" d={face} fill="none" stroke={`url(#${g("rim")})`} strokeWidth="3" clipPath={`url(#${g("face")})`} />
          <ellipse cx={CX - 24} cy={eyeY + 17} rx="7" ry="3.5" fill="#e8807a" opacity="0.22" />
          <ellipse cx={CX + 24} cy={eyeY + 17} rx="7" ry="3.5" fill="#e8807a" opacity="0.22" />
        </svg>

        {/* 2: features */}
        <svg {...layer(1.7)}>
          <path d={`M${CX - 30} ${eyeY - 16} Q${CX - 20} ${eyeY - 22} ${CX - 9} ${eyeY - 17}`} fill="none" stroke={look.hairColor} strokeWidth="3.4" strokeLinecap="round" />
          <path d={`M${CX + 9} ${eyeY - 17} Q${CX + 20} ${eyeY - 22} ${CX + 30} ${eyeY - 16}`} fill="none" stroke={look.hairColor} strokeWidth="3.4" strokeLinecap="round" />
          <g className="pt-eyes" style={{ transformOrigin: `${CX}px ${eyeY}px` }}>
            <Eye x={CX - 19} y={eyeY} iris={`url(#${g("iris")})`} />
            <Eye x={CX + 19} y={eyeY} iris={`url(#${g("iris")})`} flip />
          </g>
          <path d={`M${CX + 1} ${eyeY + 13} L${CX - 3} ${eyeY + 24} Q${CX} ${eyeY + 26} ${CX + 3} ${eyeY + 24}`} fill="none" stroke={look.shade} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx={CX - 1} cy={eyeY + 15} r="1.4" fill="#fff" opacity="0.5" />
          <Mouth look={look} y={eyeY + 36} />
          {look.lines && (
            <g fill="none" stroke={look.shade} strokeWidth="1.6" strokeLinecap="round">
              <path d={`M${CX - 22} ${eyeY + 28} Q${CX - 25} ${eyeY + 38} ${CX - 20} ${eyeY + 45}`} />
              <path d={`M${CX + 22} ${eyeY + 28} Q${CX + 25} ${eyeY + 38} ${CX + 20} ${eyeY + 45}`} />
              <path d={`M${CX - 28} ${eyeY + 10} Q${CX - 20} ${eyeY + 13} ${CX - 12} ${eyeY + 10}`} opacity="0.6" />
              <path d={`M${CX + 12} ${eyeY + 10} Q${CX + 20} ${eyeY + 13} ${CX + 28} ${eyeY + 10}`} opacity="0.6" />
            </g>
          )}
          {look.glasses && <Glasses g={look.glasses} y={eyeY} cw={cw} />}
        </svg>

        {/* 3: front hair and cap */}
        <svg {...layer(2.1)}>
          <g className="pt-hair" style={{ transformOrigin: `${CX}px 70px` }}>
            <Hair look={look} cw={cw} />
          </g>
          {look.cap && <Cap cap={look.cap} cw={cw} />}
        </svg>
      </div>
    </div>
  );
}

function Eye({ x, y, iris, flip = false }: { x: number; y: number; iris: string; flip?: boolean }) {
  const s = flip ? -1 : 1;
  return (
    <g transform={`translate(${x} ${y}) scale(${s} 1)`}>
      <path d="M-11 1 Q-1 -9 11 -3 L11 7 Q0 11 -10 6 Z" fill="#fff" />
      <g className="pt-look" style={{ "--s": s } as CSSProperties}>
        <ellipse cx="0.5" cy="1.5" rx="6.6" ry="8" fill={iris} />
        <ellipse cx="0.5" cy="2.5" rx="2.8" ry="3.6" fill={INK} />
        <circle cx="-2" cy="-1.8" r="2.4" fill="#fff" />
        <circle cx="3" cy="5" r="1.1" fill="#fff" opacity="0.85" />
      </g>
      <path d="M-12.5 2 Q-2 -11 12 -3.5" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M11 -3.5 L14 -6" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <path d="M-8 8.5 Q0 11.5 8 8" fill="none" stroke={INK} strokeWidth="0.9" opacity="0.5" />
    </g>
  );
}

function Mouth({ look, y }: { look: PortraitLook; y: number }) {
  if (look.mouth === "grin")
    return (
      <g>
        <path d={`M${CX - 15} ${y} Q${CX} ${y + 17} ${CX + 15} ${y} Q${CX} ${y + 4} ${CX - 15} ${y} Z`} fill="#7a2a2a" />
        <path d={`M${CX - 13} ${y + 0.8} Q${CX} ${y + 5} ${CX + 13} ${y + 0.8} L${CX + 11} ${y + 4.5} Q${CX} ${y + 8} ${CX - 11} ${y + 4.5} Z`} fill="#fff" />
        <path d={`M${CX - 6} ${y + 11} Q${CX} ${y + 13.5} ${CX + 6} ${y + 11}`} fill="none" stroke="#e8807a" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      </g>
    );
  if (look.mouth === "smile")
    return <path d={`M${CX - 11} ${y + 2} Q${CX} ${y + 10} ${CX + 11} ${y + 2}`} fill="none" stroke="#7a2a2a" strokeWidth="2.6" strokeLinecap="round" />;
  return <path d={`M${CX - 7} ${y + 3} Q${CX} ${y + 6} ${CX + 7} ${y + 3}`} fill="none" stroke="#7a2a2a" strokeWidth="2.2" strokeLinecap="round" />;
}

function Beard({ look, chin }: { look: PortraitLook; chin: number }) {
  const c = look.beardColor;
  // Drawn inside the face clip: everything below a cheek line, minus the mouth.
  const below = (side: number, mid: number) => `M0 240 L0 ${side} Q${CX} ${mid * 2 - side} 200 ${side} L200 240 Z`;
  const mouthHole = `M${CX - 16} 155 Q${CX} 175 ${CX + 16} 155 Q${CX} 160 ${CX - 16} 155 Z`;
  const tash = (w: number, t: number) => <path d={`M${CX - w} 154 Q${CX - w / 2} ${150 - t} ${CX} ${151 - t} Q${CX + w / 2} ${150 - t} ${CX + w} 154 Q${CX} ${152 - t / 3} ${CX - w} 154 Z`} />;
  switch (look.beard) {
    case "stubble":
      return <path d={`${below(130, 150)} ${mouthHole}`} fill={c} opacity="0.2" fillRule="evenodd" />;
    case "full":
      return (
        <g fill={c}>
          <path d={`${below(118, 146)} ${mouthHole}`} fillRule="evenodd" />
          {tash(19, 6)}
          <path d={`M${CX - 30} ${chin - 14} Q${CX} ${chin + 22} ${CX + 30} ${chin - 14} Z`} />
        </g>
      );
    case "trimmed":
      return (
        <g fill={c}>
          <path d={`${below(134, 160)} ${mouthHole}`} fillRule="evenodd" opacity="0.95" />
          {tash(16, 4)}
        </g>
      );
    case "goatee":
      return (
        <g fill={c}>
          <path d={`${below(140, 160)} ${mouthHole}`} fillRule="evenodd" opacity="0.7" />
          {tash(14, 3)}
        </g>
      );
    case "moustache":
      return <g fill={c}>{tash(18, 6)}</g>;
    case "long":
      return (
        <g fill={c}>
          <path d={`${below(120, 148)} ${mouthHole}`} fillRule="evenodd" />
          {tash(19, 5)}
        </g>
      );
    default:
      return null;
  }
}

function Hair({ look, cw }: { look: PortraitLook; cw: number }) {
  const c = look.hairColor;
  const shine = <path d={`M${CX - 26} 62 Q${CX} 50 ${CX + 24} 60`} fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.18" />;
  switch (look.hair) {
    case "swept":
      // Short, swept up and to the side, a few strands on the forehead.
      return (
        <g fill={c}>
          <path d={`M${CX - cw - 3} 112 C${CX - cw - 8} 62 ${CX - 28} 36 ${CX + 4} 36 C${CX + 36} 36 ${CX + cw + 8} 58 ${CX + cw + 3} 110 L${CX + cw - 2} 96 Q${CX + 30} 74 ${CX + 6} 80 L${CX + 14} 70 Q${CX - 6} 82 ${CX - 18} 78 L${CX - 12} 90 Q${CX - 28} 82 ${CX - cw + 2} 98 Z`} />
          <path d={`M${CX - 30} 46 Q${CX - 8} 22 ${CX + 30} 34 Q${CX + 8} 34 ${CX - 4} 42 Z`} />
          {shine}
        </g>
      );
    case "curls":
      return (
        <g fill={c}>
          {[
            [CX - cw + 2, 92, 13], [CX - cw + 6, 72, 15], [CX - 28, 52, 17], [CX - 6, 42, 18], [CX + 18, 44, 17], [CX + cw - 4, 66, 16], [CX + cw - 1, 90, 13],
            [CX - 16, 70, 13], [CX + 10, 68, 13], [CX - 32, 82, 10], [CX + 30, 80, 10],
          ].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} />
          ))}
          <g fill="#fff" opacity="0.14">
            <circle cx={CX - 10} cy={36} r="5" />
            <circle cx={CX + 16} cy={38} r="4" />
            <circle cx={CX - 32} cy={48} r="4" />
          </g>
        </g>
      );
    case "wavyBack":
      // Volume swept up and back from a high hairline, with a wave or two.
      return (
        <g fill={c}>
          <path d={`M${CX - cw - 2} 108 C${CX - cw - 10} 56 ${CX - 30} 26 ${CX + 6} 28 C${CX + 40} 28 ${CX + cw + 10} 54 ${CX + cw + 2} 108 L${CX + cw - 3} 92 Q${CX + 30} 68 ${CX + 10} 72 Q${CX - 6} 62 ${CX - 22} 74 Q${CX - 34} 76 ${CX - cw + 3} 92 Z`} />
          <path d={`M${CX - 28} 40 Q${CX - 6} 18 ${CX + 24} 26 Q${CX + 2} 30 ${CX - 10} 40 Q${CX - 18} 36 ${CX - 28} 40 Z`} />
          <path d={`M${CX + 6} 56 Q${CX + 20} 46 ${CX + 34} 58`} fill="none" stroke="#fff" strokeWidth="2.5" opacity="0.16" strokeLinecap="round" />
          {shine}
        </g>
      );
    case "crop":
      return (
        <g>
          <path d={`M${CX - cw + 0.5} 104 C${CX - cw - 1} 50 ${CX + cw + 1} 50 ${CX + cw - 0.5} 104 Q${CX + cw - 5} 82 ${CX + 30} 78 Q${CX} 72 ${CX - 30} 78 Q${CX - cw + 5} 82 ${CX - cw + 0.5} 104 Z`} fill={c} opacity="0.92" />
          <path d={`M${CX - 20} 68 Q${CX} 62 ${CX + 18} 66`} fill="none" stroke="#fff" strokeWidth="3" opacity="0.12" strokeLinecap="round" />
        </g>
      );
    case "short":
      return (
        <g fill={c}>
          <path d={`M${CX - cw - 1} 106 C${CX - cw - 4} 52 ${CX + cw + 4} 52 ${CX + cw + 1} 106 L${CX + cw - 3} 92 Q${CX + 26} 76 ${CX} 78 Q${CX - 26} 76 ${CX - cw + 3} 92 Z`} />
          <path d={`M${CX - 22} 76 Q${CX} 68 ${CX + 20} 74`} fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" opacity="0.15" />
        </g>
      );
    case "spiked":
      return (
        <g fill={c}>
          <path d={`M${CX - cw - 1} 106 C${CX - cw - 4} 58 ${CX - 20} 42 ${CX} 42 C${CX + 20} 42 ${CX + cw + 4} 58 ${CX + cw + 1} 106 L${CX + cw - 3} 92 Q${CX + 26} 76 ${CX} 78 Q${CX - 26} 76 ${CX - cw + 3} 92 Z`} />
          <path d={`M${CX - 26} 56 L${CX - 20} 30 L${CX - 10} 46 L${CX - 2} 24 L${CX + 6} 44 L${CX + 16} 28 L${CX + 20} 48 L${CX + 30} 40 L${CX + 28} 60 Z`} />
          {shine}
        </g>
      );
    case "fluffy":
      return (
        <g fill={c}>
          <path d={`M${CX - cw - 6} 112 C${CX - cw - 14} 50 ${CX - 24} 28 ${CX + 4} 30 C${CX + 34} 30 ${CX + cw + 14} 52 ${CX + cw + 6} 112 L${CX + cw - 1} 96 Q${CX + 30} 82 ${CX + 16} 86 Q${CX + 8} 74 ${CX - 4} 86 Q${CX - 16} 78 ${CX - 26} 90 Q${CX - cw + 2} 86 ${CX - cw + 1} 98 Z`} />
          <path d={`M${CX - 34} 44 Q${CX - 10} 22 ${CX + 22} 30 Q${CX + 4} 34 ${CX - 8} 44 Z`} />
          {shine}
        </g>
      );
    case "receding":
      return (
        <g fill={c}>
          <path d={`M${CX - cw - 1} 108 C${CX - cw - 3} 62 ${CX - cw + 6} 56 ${CX - 24} 54 Q${CX} 50 ${CX + 24} 54 C${CX + cw - 6} 56 ${CX + cw + 3} 62 ${CX + cw + 1} 108 L${CX + cw - 3} 92 Q${CX + cw - 6} 76 ${CX + 22} 70 Q${CX} 60 ${CX - 22} 70 Q${CX - cw + 6} 76 ${CX - cw + 3} 92 Z`} />
          <ellipse cx={CX - 4} cy={66} rx="14" ry="4.5" fill="#fff" opacity="0.16" />
        </g>
      );
    case "curlyShort":
      return (
        <g fill={c}>
          <path d={`M${CX - cw - 1} 104 C${CX - cw - 4} 54 ${CX + cw + 4} 54 ${CX + cw + 1} 104 L${CX + cw - 4} 90 Q${CX} 72 ${CX - cw + 4} 90 Z`} />
          {[[-34, 66], [-22, 54], [-8, 48], [8, 48], [22, 54], [34, 66], [-28, 80], [28, 80], [-14, 60], [12, 60]].map(([dx, y], i) => (
            <circle key={i} cx={CX + dx} cy={y} r="8" />
          ))}
          <g fill="#fff" opacity="0.12">
            <circle cx={CX - 8} cy={44} r="3" />
            <circle cx={CX + 20} cy={50} r="2.5" />
          </g>
        </g>
      );
    case "shaved":
      return (
        <g>
          <path d={`M${CX - cw + 0.5} 104 C${CX - cw} 52 ${CX + cw} 52 ${CX + cw - 0.5} 104 Q${CX + cw - 5} 84 ${CX + 30} 80 Q${CX} 74 ${CX - 30} 80 Q${CX - cw + 5} 84 ${CX - cw + 0.5} 104 Z`} fill={c} opacity="0.3" />
          <ellipse cx={CX - 10} cy={70} rx="15" ry="5.5" fill="#fff" opacity="0.25" transform={`rotate(-14 ${CX - 10} 70)`} />
        </g>
      );
  }
}

function CurlsBack({ c }: { c: string }) {
  return (
    <g fill={c}>
      <circle cx={CX - 48} cy={110} r="15" />
      <circle cx={CX + 48} cy={110} r="15" />
      <circle cx={CX - 44} cy={130} r="11" />
      <circle cx={CX + 44} cy={130} r="11" />
    </g>
  );
}

function Medal() {
  return (
    <g>
      <path d="M86 189 L98 222 L102 222 L90 189 Z" fill="#c8322b" />
      <path d="M114 189 L102 222 L98 222 L110 189 Z" fill="#2c4f8c" />
      <path d="M92 189 L100 214 L108 189" fill="none" stroke="#f5f2ea" strokeWidth="2" />
      <circle cx="100" cy="227" r="8" fill="#b07a3e" stroke="#7c5427" strokeWidth="1.5" />
      <circle cx="98" cy="225" r="2.5" fill="#fff" opacity="0.35" />
    </g>
  );
}

function Kit({ look, clip }: { look: PortraitLook; clip: string }) {
  const t = look.kitTrim;
  switch (look.kitStyle) {
    case "polo":
      return (
        <g>
          <path d="M80 187 L100 206 L92 214 L74 194 Z" fill={look.kit} stroke={t} strokeWidth="1.5" />
          <path d="M120 187 L100 206 L108 214 L126 194 Z" fill={look.kit} stroke={t} strokeWidth="1.5" />
          <path d="M100 206 L100 232" stroke={t} strokeWidth="1.5" />
          <circle cx="100" cy="216" r="1.6" fill={t} />
          <circle cx="100" cy="226" r="1.6" fill={t} />
        </g>
      );
    case "hoodie":
      return (
        <g>
          <path d="M66 192 Q100 222 134 192 Q128 208 100 214 Q72 208 66 192 Z" fill={t} />
          <path d="M92 210 L90 236 M108 210 L110 236" stroke={t} strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    case "jacket":
      return (
        <g clipPath={`url(#${clip})`}>
          <path d="M14 240 C20 206 52 192 78 188 L90 240 Z" fill={t} />
          <path d="M186 240 C180 206 148 192 122 188 L110 240 Z" fill={t} />
          <path d="M78 188 L90 240 M122 188 L110 240" stroke="#000" strokeOpacity="0.25" strokeWidth="1.5" />
        </g>
      );
    case "stripes":
      return (
        <g clipPath={`url(#${clip})`}>
          {[196, 208, 220, 232].map((y) => (
            <rect key={y} x="0" y={y} width="200" height="5" fill={t} />
          ))}
          <path d="M80 188 Q100 206 120 188" fill="none" stroke={t} strokeWidth="5" strokeLinecap="round" />
        </g>
      );
    default:
      return <path d="M80 188 Q100 206 120 188" fill="none" stroke={t} strokeWidth="5" strokeLinecap="round" />;
  }
}

function Glasses({ g, y, cw }: { g: NonNullable<PortraitLook["glasses"]>; y: number; cw: number }) {
  const lens = g.clear ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)";
  const frame = (x: number) =>
    g.shape === "round" ? <circle cx={x} cy={y + 1} r="13" /> : <rect x={x - 14} y={y - 10} width="28" height="21" rx="6" />;
  return (
    <g fill={lens} stroke={g.frame} strokeWidth={g.clear ? 2.6 : 2.2}>
      {frame(CX - 19)}
      {frame(CX + 19)}
      <path d={`M${CX - 6} ${y - 1} Q${CX} ${y - 5} ${CX + 6} ${y - 1}`} fill="none" />
      <path d={`M${CX - 33} ${y - 3} L${CX - cw + 1} ${y - 1} M${CX + 33} ${y - 3} L${CX + cw - 1} ${y - 1}`} fill="none" />
      <path d={`M${CX - 26} ${y - 6} L${CX - 21} ${y - 9} M${CX + 12} ${y - 6} L${CX + 17} ${y - 9}`} stroke="#fff" strokeOpacity="0.55" strokeWidth="1.6" fill="none" />
    </g>
  );
}

function Cap({ cap, cw }: { cap: NonNullable<PortraitLook["cap"]>; cw: number }) {
  return (
    <g>
      <path d={`M${CX - cw - 3} 92 C${CX - cw - 4} 40 ${CX + cw + 4} 40 ${CX + cw + 3} 92 Q${CX} 82 ${CX - cw - 3} 92 Z`} fill={cap.color} />
      <path d={`M${CX - cw - 2} 92 Q${CX} 80 ${CX + cw + 2} 92 Q${CX + cw + 10} 98 ${CX + cw + 4} 102 Q${CX} 90 ${CX - cw - 4} 102 Q${CX - cw - 10} 98 ${CX - cw - 2} 92 Z`} fill={cap.brim ?? cap.color} />
      <path d={`M${CX} 56 L${CX} 84`} stroke="#000" strokeOpacity="0.12" strokeWidth="1.5" />
      <circle cx={CX} cy={55} r="2.5" fill={cap.brim ?? cap.color} />
      {cap.logo && <rect x={CX - 12} y={62} width="24" height="10" rx="2" fill={cap.logo} opacity="0.85" />}
      <path d={`M${CX - 26} 70 Q${CX - 8} 60 ${CX + 14} 64`} fill="none" stroke="#fff" strokeWidth="3" opacity="0.2" strokeLinecap="round" />
    </g>
  );
}
