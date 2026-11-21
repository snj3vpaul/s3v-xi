import type { CSSProperties } from "react";
import type { PortraitLook } from "@/config/portraits";

/**
 * A hand-built anime-style bust (SVG). Geometry is parametrised by the look so
 * each player keeps their own face shape, hair, beard and skin tone.
 * Animation is pure CSS (blink, breathing, hair sway) and switches off with
 * prefers-reduced-motion. `phase` staggers the blink so cards don't sync.
 */
const INK = "#1a1210";
const CX = 100;

export function AnimePortrait({ id, look, phase = 0, className }: { id: string; look: PortraitLook; phase?: number; className?: string }) {
  const cw = 41 + look.jaw * 4; // cheek half-width
  const jw = 29 + look.jaw * 9; // jaw half-width
  const chin = 170 + look.length * 12;
  const eyeY = 120;
  const g = (s: string) => `${id}-${s}`;

  const face = `M${CX - cw} 104 C${CX - cw} 132 ${CX - jw} 150 ${CX - 13} ${chin - 5} Q${CX} ${chin + 3} ${CX + 13} ${chin - 5} C${CX + jw} 150 ${CX + cw} 132 ${CX + cw} 104 C${CX + cw} 52 ${CX - cw} 52 ${CX - cw} 104 Z`;
  const style = { "--pt-phase": `${phase}s` } as CSSProperties;

  return (
    <svg className={`pt ${className ?? ""}`} viewBox="0 0 200 240" role="img" aria-hidden="true" style={style}>
      <defs>
        <linearGradient id={g("skin")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={look.skin} />
          <stop offset="0.72" stopColor={look.skin} />
          <stop offset="1" stopColor={look.shade} />
        </linearGradient>
        <radialGradient id={g("iris")} cx="0.5" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.15" />
          <stop offset="0.35" stopColor={look.iris} />
          <stop offset="1" stopColor={INK} />
        </radialGradient>
        <linearGradient id={g("kit")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={look.kit} />
          <stop offset="1" stopColor={look.kit} stopOpacity="0.85" />
        </linearGradient>
        <clipPath id={g("face")}>
          <path d={face} />
        </clipPath>
      </defs>

      <g className="pt-bust">
        {look.hair === "curls" && <CurlsBack c={look.hairColor} />}

        {/* Shoulders and kit */}
        <path d="M14 240 C20 206 52 192 78 188 L122 188 C148 192 180 206 186 240 Z" fill={`url(#${g("kit")})`} />
        <path d="M14 240 C20 206 52 192 78 188 L84 188 C62 198 40 214 34 240 Z" fill="#000" opacity="0.12" />
        <path d="M80 188 Q100 206 120 188" fill="none" stroke={look.kitTrim} strokeWidth="5" strokeLinecap="round" />

        {/* Neck */}
        <path d={`M${CX - 16} ${chin - 16} L${CX - 17} 196 Q${CX} 205 ${CX + 17} 196 L${CX + 16} ${chin - 16} Z`} fill={look.skin} />
        <path d={`M${CX - 16} ${chin - 12} Q${CX} ${chin + 10} ${CX + 16} ${chin - 12} L${CX + 16} ${chin} Q${CX} ${chin + 14} ${CX - 16} ${chin} Z`} fill={look.shade} opacity="0.8" />

        {look.extras?.includes("chain") && (
          <path d={`M${CX - 17} 190 Q${CX} 214 ${CX + 17} 190`} fill="none" stroke="#d9b24a" strokeWidth="2" strokeDasharray="2.5 1.5" />
        )}
        {look.extras?.includes("medal") && <Medal />}

        {/* Ears */}
        <ellipse cx={CX - cw + 1} cy={eyeY + 4} rx="6.5" ry="10" fill={look.shade} />
        <ellipse cx={CX + cw - 1} cy={eyeY + 4} rx="6.5" ry="10" fill={look.shade} />

        {/* Face, with cel shadow under the hairline */}
        <path d={face} fill={`url(#${g("skin")})`} />
        <g clipPath={`url(#${g("face")})`}>
          <path d={`M${CX - cw} 70 Q${CX} 98 ${CX + cw} 70 L${CX + cw} 92 Q${CX} 108 ${CX - cw} 92 Z`} fill={look.shade} opacity="0.35" />
          <Beard look={look} chin={chin} />
        </g>
        {look.beard === "full" && <path d={`M${CX - 24} ${chin - 10} Q${CX} ${chin + 18} ${CX + 24} ${chin - 10} Z`} fill={look.beardColor} />}
        <ellipse cx={CX - 24} cy={eyeY + 17} rx="7" ry="3.5" fill="#e8807a" opacity="0.22" />
        <ellipse cx={CX + 24} cy={eyeY + 17} rx="7" ry="3.5" fill="#e8807a" opacity="0.22" />

        {/* Brows */}
        <path d={`M${CX - 30} ${eyeY - 16} Q${CX - 20} ${eyeY - 22} ${CX - 9} ${eyeY - 17}`} fill="none" stroke={look.hairColor} strokeWidth="3.4" strokeLinecap="round" />
        <path d={`M${CX + 9} ${eyeY - 17} Q${CX + 20} ${eyeY - 22} ${CX + 30} ${eyeY - 16}`} fill="none" stroke={look.hairColor} strokeWidth="3.4" strokeLinecap="round" />

        {/* Eyes (blink together) */}
        <g className="pt-eyes" style={{ transformOrigin: `${CX}px ${eyeY}px` }}>
          <Eye x={CX - 19} y={eyeY} iris={`url(#${g("iris")})`} />
          <Eye x={CX + 19} y={eyeY} iris={`url(#${g("iris")})`} flip />
        </g>

        {/* Nose */}
        <path d={`M${CX + 1} ${eyeY + 13} L${CX - 3} ${eyeY + 24} Q${CX} ${eyeY + 26} ${CX + 3} ${eyeY + 24}`} fill="none" stroke={look.shade} strokeWidth="1.8" strokeLinecap="round" />

        <Mouth look={look} y={eyeY + 36} />

        <g className="pt-hair" style={{ transformOrigin: `${CX}px 70px` }}>
          <Hair look={look} cw={cw} />
        </g>
      </g>
    </svg>
  );
}

function Eye({ x, y, iris, flip = false }: { x: number; y: number; iris: string; flip?: boolean }) {
  const s = flip ? -1 : 1;
  return (
    <g transform={`translate(${x} ${y}) scale(${s} 1)`}>
      <path d="M-11 1 Q-1 -9 11 -3 L11 7 Q0 11 -10 6 Z" fill="#fff" />
      <ellipse cx="0.5" cy="1.5" rx="6.6" ry="8" fill={iris} />
      <ellipse cx="0.5" cy="2.5" rx="2.8" ry="3.6" fill={INK} />
      <circle cx="-2" cy="-1.8" r="2.4" fill="#fff" />
      <circle cx="3" cy="5" r="1.1" fill="#fff" opacity="0.85" />
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
