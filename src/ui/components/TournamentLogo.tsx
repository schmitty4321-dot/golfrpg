import { useId, type ReactNode } from "react";
import type { Course } from "../../engine";
import { WINNER_POINTS, type TourEvent } from "../../season";
import { millions } from "../format";

/**
 * Tournament logos: a round emblem with a scene from the event's part of the
 * world, and a wordmark of its name. The art is original to the game; no
 * sponsor or tournament marks are reproduced, only the event names the
 * schedule already uses. Scenes are drawn on a 100 x 100 grid.
 */

type Motif =
  | "tropical" | "desert" | "oasis" | "stadium" | "coast" | "island" | "lighthouse" | "oak" | "blossom"
  | "skyline" | "rocket" | "star" | "mountains" | "maple" | "lakes" | "links" | "tartan" | "farm" | "fuji"
  | "laurel" | "parkland" | "cabo";

interface LogoSpec {
  motif: Motif;
  /** The wordmark colour, and the emblem's ring. */
  color: string;
  pre?: string;
  main: string;
  sub?: string;
}

const SPECS: Record<string, LogoSpec> = {
  "Sony Open in Hawaii": { motif: "tropical", color: "#1f7a4d", main: "Sony Open", sub: "in Hawaii" },
  "The American Express": { motif: "oasis", color: "#1f5fa8", pre: "The", main: "American Express" },
  "Farmers Insurance Open": { motif: "coast", color: "#1d4f8c", main: "Farmers Insurance", sub: "Open" },
  "WM Phoenix Open": { motif: "stadium", color: "#2f7a3a", pre: "WM", main: "Phoenix Open" },
  "AT&T Pebble Beach Pro-Am": { motif: "coast", color: "#0f5c8f", pre: "AT&T", main: "Pebble Beach", sub: "Pro-Am" },
  "The Genesis Invitational": { motif: "parkland", color: "#1d2b45", pre: "The", main: "Genesis", sub: "Invitational" },
  "Cognizant Classic in The Palm Beaches": { motif: "tropical", color: "#d9662a", main: "Cognizant Classic", sub: "in The Palm Beaches" },
  "Arnold Palmer Invitational": { motif: "lakes", color: "#b8322a", main: "Arnold Palmer", sub: "Invitational" },
  "Puerto Rico Open": { motif: "tropical", color: "#c8283a", main: "Puerto Rico Open" },
  "THE PLAYERS Championship": { motif: "island", color: "#0e3d6b", pre: "The", main: "PLAYERS", sub: "Championship" },
  "Valspar Championship": { motif: "oak", color: "#2c6fa8", main: "Valspar", sub: "Championship" },
  "Texas Children's Houston Open": { motif: "skyline", color: "#c8372d", pre: "Texas Children's", main: "Houston Open" },
  "Valero Texas Open": { motif: "star", color: "#1d4f8c", pre: "Valero", main: "Texas Open" },
  "Masters Tournament": { motif: "blossom", color: "#1f6b45", main: "Masters", sub: "Tournament" },
  "RBC Heritage": { motif: "lighthouse", color: "#b8322a", pre: "RBC", main: "Heritage" },
  "Zurich Classic of New Orleans": { motif: "oak", color: "#5c3a8f", main: "Zurich Classic", sub: "of New Orleans" },
  "Cadillac Championship": { motif: "tropical", color: "#8a6a2f", main: "Cadillac", sub: "Championship" },
  "Truist Championship": { motif: "oak", color: "#5b2d8e", main: "Truist", sub: "Championship" },
  "ONEflight Myrtle Beach Classic": { motif: "tropical", color: "#0f8080", pre: "ONEflight", main: "Myrtle Beach", sub: "Classic" },
  "PGA Championship": { motif: "laurel", color: "#1d2b45", main: "PGA", sub: "Championship" },
  "THE CJ CUP Byron Nelson": { motif: "star", color: "#c2304f", pre: "The CJ Cup", main: "Byron Nelson" },
  "Charles Schwab Challenge": { motif: "tartan", color: "#a82a2a", main: "Charles Schwab", sub: "Challenge" },
  "The Memorial Tournament": { motif: "parkland", color: "#1f4f8c", pre: "The", main: "Memorial", sub: "Tournament" },
  "RBC Canadian Open": { motif: "maple", color: "#c8102e", pre: "RBC", main: "Canadian Open" },
  "U.S. Open": { motif: "laurel", color: "#1d2b45", main: "U.S. Open" },
  "Travelers Championship": { motif: "parkland", color: "#b8322a", main: "Travelers", sub: "Championship" },
  "John Deere Classic": { motif: "farm", color: "#367c2b", main: "John Deere", sub: "Classic" },
  "Genesis Scottish Open": { motif: "links", color: "#1d2b45", pre: "Genesis", main: "Scottish Open" },
  "ISCO Championship": { motif: "parkland", color: "#2a5fa8", main: "ISCO", sub: "Championship" },
  "The Open Championship": { motif: "links", color: "#7a1f2b", main: "The Open", sub: "Championship" },
  "Corales Puntacana Championship": { motif: "tropical", color: "#0f8080", main: "Corales Puntacana", sub: "Championship" },
  "3M Open": { motif: "lakes", color: "#c8102e", main: "3M Open" },
  "Rocket Classic": { motif: "rocket", color: "#b8322a", main: "Rocket", sub: "Classic" },
  "Wyndham Championship": { motif: "oak", color: "#3a2a6b", main: "Wyndham", sub: "Championship" },
  "FedEx St. Jude Championship": { motif: "laurel", color: "#4d2a8c", main: "FedEx St. Jude", sub: "Championship" },
  "BMW Championship": { motif: "laurel", color: "#1c5fb8", main: "BMW", sub: "Championship" },
  "TOUR Championship": { motif: "laurel", color: "#8a6a2f", main: "TOUR", sub: "Championship" },
  "Biltmore Championship Asheville": { motif: "mountains", color: "#1f4f8c", main: "Biltmore Championship", sub: "Asheville" },
  "Bank of Utah Championship": { motif: "desert", color: "#b8532a", main: "Bank of Utah", sub: "Championship" },
  "Baycurrent Classic": { motif: "fuji", color: "#c8102e", main: "Baycurrent", sub: "Classic" },
  "Butterfield Bermuda Championship": { motif: "tropical", color: "#c9507a", pre: "Butterfield", main: "Bermuda", sub: "Championship" },
  "VidantaWorld Mexico Open": { motif: "tropical", color: "#006847", pre: "VidantaWorld", main: "Mexico Open" },
  "World Wide Technology Championship": { motif: "cabo", color: "#1f5fa8", pre: "World Wide Technology", main: "Championship", sub: "Los Cabos" },
  "Austin Championship": { motif: "star", color: "#c2562e", main: "Austin", sub: "Championship" },
  "The RSM Classic": { motif: "lighthouse", color: "#1d4f8c", pre: "The", main: "RSM Classic" },
};

const FALLBACK_COLORS = ["#1f7a4d", "#1f5fa8", "#b8322a", "#6d4bc2", "#0f8080", "#c2562e", "#1d2b45", "#8a6a2f"];

/** The logo for any event: hand-set for the real tour, built from the venue for the rest. */
export function logoSpec(event: Pick<TourEvent, "name" | "tier">, course?: Pick<Course, "style">): LogoSpec {
  const known = SPECS[event.name];
  if (known) return known;
  let h = 0;
  for (const ch of event.name) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  const byStyle: Record<string, Motif> = { desert: "desert", links: "links", resort: "tropical", parkland: "parkland" };
  const motif = event.tier === "major" || event.tier === "finale" ? "laurel" : byStyle[course?.style ?? "parkland"] ?? "parkland";
  // "Harrow Pines Classic" reads as the place large and the word under it.
  const m = /^(.*)\s(Open|Classic|Championship|Challenge|Invitational)$/.exec(event.name);
  return { motif, color: FALLBACK_COLORS[h % FALLBACK_COLORS.length]!, main: m ? m[1]! : event.name, sub: m ? m[2] : undefined };
}

/** Every event with a hand-set logo. */
export const LOGO_EVENTS: readonly string[] = Object.keys(SPECS);

// ------------------------------------------------------------------ pieces

const ball = (x: number, y: number, r = 4.2) => (
  <g>
    <circle cx={x} cy={y} r={r} fill="#fff" stroke="#c9ccc4" strokeWidth="0.6" />
    <circle cx={x - r * 0.35} cy={y - r * 0.2} r={r * 0.14} fill="#d5d8d0" />
    <circle cx={x + r * 0.25} cy={y - r * 0.35} r={r * 0.14} fill="#d5d8d0" />
    <circle cx={x + r * 0.1} cy={y + r * 0.25} r={r * 0.14} fill="#d5d8d0" />
  </g>
);
const flag = (x: number, y: number, h = 22, color = "#e03a2e") => (
  <g>
    <path d={`M${x} ${y} V${y - h}`} stroke="#f4f4ef" strokeWidth="1.3" />
    <path d={`M${x} ${y - h} L${x + 9} ${y - h + 3.2} L${x} ${y - h + 6.4} Z`} fill={color} />
  </g>
);
const sky = (top: string, bottom: string, id: string) => (
  <>
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={top} />
        <stop offset="1" stopColor={bottom} />
      </linearGradient>
    </defs>
    <rect width="100" height="100" fill={`url(#${id})`} />
  </>
);
const palm = (x: number, y: number, h: number, lean = 1) => (
  <g>
    <path d={`M${x} ${y} Q${x + 4 * lean} ${y - h * 0.55} ${x + 7 * lean} ${y - h}`} stroke="#7a5230" strokeWidth="3.2" fill="none" strokeLinecap="round" />
    {[-150, -115, -70, -30, 10].map((a, i) => {
      const r = (a * Math.PI) / 180;
      const tx = x + 7 * lean;
      const ty = y - h;
      return <path key={i} d={`M${tx} ${ty} Q${tx + Math.cos(r) * 9} ${ty + Math.sin(r) * 9 - 5} ${tx + Math.cos(r) * 16} ${ty + Math.sin(r) * 16 + 4}`} stroke="#2f8a3e" strokeWidth="3.4" fill="none" strokeLinecap="round" />;
    })}
  </g>
);
const pine = (x: number, y: number, h: number, c = "#1f5a3a") => <path d={`M${x} ${y - h} L${x + h * 0.32} ${y} L${x - h * 0.32} ${y} Z`} fill={c} />;
const star = (cx: number, cy: number, r: number, fill: string) => (
  <polygon
    points={Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.4 : r;
      return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`;
    }).join(" ")}
    fill={fill}
  />
);
const fairway = (y: number, c = "#6fbf5c") => <path d={`M0 ${y} Q30 ${y - 7} 55 ${y - 2} Q80 ${y + 3} 100 ${y - 5} V100 H0 Z`} fill={c} />;
const waves = (y: number) => (
  <>
    <path d={`M0 ${y} Q12 ${y - 4} 25 ${y} T50 ${y} T75 ${y} T100 ${y} V100 H0 Z`} fill="#1f8fc2" />
    <path d={`M0 ${y + 9} Q12 ${y + 5} 25 ${y + 9} T50 ${y + 9} T75 ${y + 9} T100 ${y + 9} V100 H0 Z`} fill="#16729f" />
    <path d={`M6 ${y + 2} Q14 ${y - 2} 22 ${y + 2} M56 ${y + 3} Q64 ${y - 1} 72 ${y + 3}`} stroke="#e8f6fb" strokeWidth="1.4" fill="none" strokeLinecap="round" />
  </>
);

const MAPLE = "M15 3.6 l1.05 2.1 1.3-.65-.5 3 1.95-2.05.5 1.05 1.95-.4-.65 1.9.85.4-3.05 2.45.3 1.05-2.95-.45.1 3h-.7l.1-3-2.95.45.3-1.05-3.05-2.45.85-.4-.65-1.9 1.95.4.5-1.05 1.95 2.05-.5-3 1.3.65z";

function Scene({ motif, color, id }: { motif: Motif; color: string; id: string }): ReactNode {
  const g = `${id}s`;
  switch (motif) {
    case "tropical":
      return (
        <>
          {sky("#a9dcf0", "#e6f6fb", g)}
          <circle cx="68" cy="30" r="10" fill="#ffd766" />
          {waves(64)}
          {palm(34, 80, 44)}
          {ball(64, 60)}
        </>
      );
    case "desert":
    case "cabo":
      return (
        <>
          {sky("#f7b267", "#fde6c4", g)}
          <circle cx="64" cy="40" r="12" fill="#fff1c9" />
          <path d="M0 62 L14 50 L30 50 L38 58 L60 58 L66 46 L84 46 L100 58 V100 H0 Z" fill={motif === "cabo" ? "#b8744a" : "#b8532a"} />
          {motif === "cabo" ? waves(74) : <path d="M0 70 Q50 64 100 72 V100 H0 Z" fill="#e3a95f" />}
          <g fill="#2f7a3a">
            <rect x="27" y="52" width="6" height="30" rx="3" />
            <path d="M27 66 H21 V58" stroke="#2f7a3a" strokeWidth="4.5" fill="none" strokeLinecap="round" />
            <path d="M33 62 H39 V54" stroke="#2f7a3a" strokeWidth="4.5" fill="none" strokeLinecap="round" />
          </g>
          {ball(66, 72)}
        </>
      );
    case "oasis":
      return (
        <>
          {sky("#f6c08a", "#fde9cf", g)}
          <path d="M0 58 L18 38 L32 50 L48 32 L66 50 L80 40 L100 56 V100 H0 Z" fill="#8a7aa8" />
          <path d="M0 68 Q50 60 100 68 V100 H0 Z" fill="#6fbf5c" />
          {palm(30, 78, 34)}
          {palm(70, 80, 30, -1)}
          {flag(52, 72, 20)}
        </>
      );
    case "stadium":
      return (
        <>
          {sky("#f7b267", "#fde6c4", g)}
          <path d="M8 60 Q50 30 92 60 L86 66 Q50 40 14 66 Z" fill="#8a4a2a" />
          <path d="M14 66 Q50 40 86 66 L80 71 Q50 50 20 71 Z" fill="#b8683a" />
          {Array.from({ length: 11 }, (_, i) => <circle key={i} cx={20 + i * 6} cy={60 - Math.sin((i / 10) * Math.PI) * 14} r="1" fill="#fde6c4" />)}
          {fairway(76)}
          <ellipse cx="50" cy="80" rx="14" ry="4" fill="#8fd47a" />
          {flag(52, 80, 18)}
        </>
      );
    case "coast":
      return (
        <>
          {sky("#b9dff0", "#eaf6fb", g)}
          <path d="M0 60 H100 V100 H0 Z" fill="#2b7fb8" />
          <path d="M40 100 L44 64 Q58 56 100 58 V100 Z" fill="#8a6a4a" />
          <path d="M44 64 Q58 56 100 58 V63 Q70 61 45 68 Z" fill="#4f9a4a" />
          <path d="M70 58 Q66 42 58 36 Q72 34 84 40 Q76 44 74 58 Z" fill="#1f4f36" />
          <path d="M72 58 V46" stroke="#5a3a24" strokeWidth="2" />
          {flag(88, 60, 16)}
          <path d="M8 72 Q16 69 24 72 M14 82 Q22 79 30 82" stroke="#e8f6fb" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </>
      );
    case "island":
      return (
        <>
          {sky("#bfe3f2", "#eaf6fb", g)}
          <path d="M0 50 H100 V100 H0 Z" fill="#2b8fc0" />
          <ellipse cx="50" cy="68" rx="26" ry="11" fill="#7a5a3a" />
          <ellipse cx="50" cy="66" rx="24" ry="9.5" fill="#5bb35c" />
          <ellipse cx="44" cy="69" rx="5" ry="2" fill="#efe2b8" />
          {flag(56, 66, 24)}
          {ball(40, 64, 2.8)}
        </>
      );
    case "lighthouse":
      return (
        <>
          {sky("#bfe3f2", "#f2f9fc", g)}
          {waves(66)}
          <path d="M0 76 Q30 68 60 74 Q80 78 100 72 V100 H0 Z" fill="#e7d3a0" />
          <path d="M44 74 L48 30 H56 L60 74 Z" fill="#f7f7f2" />
          {[36, 48, 60].map((y) => <path key={y} d={`M${44 + (74 - y) * 0.09} ${y} L${60 - (74 - y) * 0.09} ${y} L${60 - (74 - y - 6) * 0.09} ${y + 6} L${44 + (74 - y - 6) * 0.09} ${y + 6} Z`} fill="#c8372d" />)}
          <rect x="46" y="24" width="12" height="6" rx="1" fill="#2a3a4a" />
          <path d="M44 24 L52 17 L60 24 Z" fill="#c8372d" />
          <path d="M58 26 L78 20 M58 28 L80 30" stroke="#ffe27a" strokeWidth="1.6" strokeLinecap="round" />
        </>
      );
    case "oak":
      return (
        <>
          {sky("#cfe8d6", "#f0f8f2", g)}
          {fairway(70)}
          <path d="M36 74 Q38 60 34 50 M36 64 Q44 58 48 52" stroke="#5a3a24" strokeWidth="3" fill="none" strokeLinecap="round" />
          {[[24, 44, 10], [34, 38, 11], [46, 42, 10], [30, 50, 9], [42, 50, 9], [52, 48, 7]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={i % 2 ? "#2f6b3a" : "#3b8047"} />)}
          <path d="M20 44 Q18 52 22 58 M30 50 Q29 58 31 62" stroke="#9bb07a" strokeWidth="1" fill="none" opacity="0.7" />
          {flag(72, 76, 20)}
        </>
      );
    case "blossom":
      return (
        <>
          {sky("#dcefe0", "#f6fbf7", g)}
          {fairway(72)}
          {pine(20, 70, 34, "#1f5a3a")}
          {pine(80, 70, 30, "#1f5a3a")}
          {Array.from({ length: 5 }, (_, i) => {
            const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
            return <ellipse key={i} cx={50 + Math.cos(a) * 9} cy={42 + Math.sin(a) * 9} rx="7.5" ry="5.5" transform={`rotate(${(a * 180) / Math.PI} ${50 + Math.cos(a) * 9} ${42 + Math.sin(a) * 9})`} fill="#e46a9a" />;
          })}
          <circle cx="50" cy="42" r="4" fill="#f7d46a" />
          {flag(62, 82, 14, "#f4d23a")}
        </>
      );
    case "skyline":
    case "rocket":
      return (
        <>
          {sky("#f59a6b", "#fcd9a8", g)}
          <circle cx="30" cy="40" r="9" fill="#ffe7b0" />
          <g fill="#2a2f45">
            {[[14, 52, 9, 28], [24, 40, 8, 40], [33, 48, 10, 32], [44, 30, 8, 50], [53, 44, 11, 36], [65, 36, 8, 44], [74, 50, 12, 30]].map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} />)}
          </g>
          {motif === "rocket" && (
            <g transform="translate(70 26) rotate(35)">
              <path d="M0 -10 Q5 -4 4 8 H-4 Q-5 -4 0 -10 Z" fill="#f4f4ef" />
              <path d="M-4 4 L-7 10 L-4 8 Z M4 4 L7 10 L4 8 Z" fill="#c8372d" />
              <path d="M-2 9 Q0 18 2 9" fill="#ffb13b" />
            </g>
          )}
          {fairway(76)}
          {flag(70, 82, 16)}
        </>
      );
    case "star":
      return (
        <>
          {sky("#3a6ea8", "#9cc4e4", g)}
          {star(50, 40, 18, "#f7f7f2")}
          <path d="M0 70 Q25 60 50 66 Q75 72 100 62 V100 H0 Z" fill="#c9a86a" />
          {fairway(76)}
          {flag(66, 82, 16)}
        </>
      );
    case "mountains":
      return (
        <>
          {sky("#a9cfe8", "#e8f3fa", g)}
          <path d="M0 64 L22 36 L36 52 L54 28 L74 50 L88 38 L100 52 V100 H0 Z" fill="#5b7aa0" />
          <path d="M54 28 L60 36 L56 35 L52 38 L48 35 Z M22 36 L27 42 L20 42 Z" fill="#f4f6f8" />
          <path d="M0 72 L20 60 L40 70 L62 58 L100 70 V100 H0 Z" fill="#3f6b88" />
          {fairway(80)}
          {[14, 22, 84].map((x, i) => pine(x, 82, 18 + (i % 2) * 4))}
          {flag(56, 84, 14)}
        </>
      );
    case "maple":
      return (
        <>
          {sky("#bfdcef", "#eef6fb", g)}
          <path d={MAPLE} transform="translate(22 6) scale(1.9)" fill="#c8102e" />
          <path d="M0 68 H100 V100 H0 Z" fill="#3c86b8" />
          {[10, 18, 26, 74, 82, 90].map((x, i) => pine(x, 70, 16 + (i % 3) * 4, "#1f4f36"))}
          <path d="M20 80 Q30 77 40 80 M58 86 Q68 83 78 86" stroke="#e8f6fb" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </>
      );
    case "lakes":
      return (
        <>
          {sky("#b6daee", "#ecf6fb", g)}
          <path d="M0 58 H100 V100 H0 Z" fill="#3c86b8" />
          {[8, 16, 24, 32].map((x, i) => pine(x, 60, 18 + (i % 2) * 5, "#1f4f36"))}
          <path d="M40 78 Q60 70 100 74 V100 H30 Z" fill="#6fbf5c" />
          {flag(70, 80, 20)}
          {ball(56, 82, 3)}
          <path d="M44 66 Q50 63 56 66" stroke="#e8f6fb" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </>
      );
    case "links":
      return (
        <>
          {sky("#cfe0ea", "#eef4f7", g)}
          <path d="M0 52 H100 V100 H0 Z" fill="#5a8fa8" />
          <path d="M0 66 Q18 56 36 64 Q56 72 76 60 Q90 54 100 60 V100 H0 Z" fill="#c9b27a" />
          <path d="M0 76 Q30 70 60 78 Q80 82 100 74 V100 H0 Z" fill="#7aa35a" />
          {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${6 + i * 8} 68 q2 -6 5 -8`} stroke="#8a9a4a" strokeWidth="1" fill="none" />)}
          <path d="M60 86 V60" stroke="#f4f4ef" strokeWidth="1.3" />
          <path d="M60 60 Q66 61 70 64 Q65 65 60 67 Z" fill="#e8c23a" />
          <path d="M12 30 H40 M20 38 H52 M8 22 H30" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
        </>
      );
    case "tartan":
      return (
        <>
          <rect width="100" height="100" fill="#b8322a" />
          {[10, 34, 58, 82].map((x) => <rect key={x} x={x} y="0" width="8" height="100" fill="#1d2b45" opacity="0.75" />)}
          {[10, 34, 58, 82].map((y) => <rect key={y} x="0" y={y} width="100" height="8" fill="#1d2b45" opacity="0.6" />)}
          {[20, 44, 68, 92].map((x) => <rect key={x} x={x} y="0" width="1.2" height="100" fill="#f4d23a" opacity="0.8" />)}
          {[20, 44, 68, 92].map((y) => <rect key={y} x="0" y={y} width="100" height="1.2" fill="#f4d23a" opacity="0.7" />)}
          <circle cx="50" cy="52" r="20" fill="#f7f7f2" />
          <ellipse cx="50" cy="60" rx="14" ry="4" fill="#6fbf5c" />
          {flag(50, 60, 20, "#b8322a")}
        </>
      );
    case "farm":
      return (
        <>
          {sky("#bfe0f0", "#eef7fb", g)}
          <path d="M0 64 Q50 56 100 64 V100 H0 Z" fill="#e2b63d" />
          {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${i * 12 - 4} 100 L${30 + i * 5} 64`} stroke="#c49a2a" strokeWidth="1.4" />)}
          <path d="M20 64 V46 L32 38 L44 46 V64 Z" fill="#b8322a" />
          <path d="M18 47 L32 36 L46 47" stroke="#f4f4ef" strokeWidth="1.8" fill="none" />
          <rect x="28" y="52" width="8" height="12" fill="#f4f4ef" />
          <path d="M28 52 L36 64 M36 52 L28 64" stroke="#b8322a" strokeWidth="1" />
          {fairway(84)}
          {flag(70, 88, 20)}
        </>
      );
    case "fuji":
      return (
        <>
          {sky("#fde0d6", "#fff4ef", g)}
          <circle cx="50" cy="38" r="15" fill="#d8323a" />
          <path d="M14 70 L42 36 Q50 32 58 36 L86 70 Z" fill="#5b6f8f" />
          <path d="M42 36 Q50 32 58 36 L62 42 L56 40 L50 44 L44 40 L38 42 Z" fill="#f7f7f2" />
          {waves(70)}
          {pine(12, 74, 14, "#1f4f36")}
        </>
      );
    case "parkland":
      return (
        <>
          {sky("#c6e3f2", "#eef7fb", g)}
          <path d="M0 62 Q30 54 60 60 Q80 64 100 56 V100 H0 Z" fill="#3b8047" />
          {[[14, 52, 9], [26, 48, 8], [82, 50, 10], [92, 54, 7]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={i % 2 ? "#2f6b3a" : "#3f8a4a"} />)}
          <path d="M0 74 Q40 66 70 76 Q86 80 100 76 V84 Q80 88 64 82 Q40 74 0 82 Z" fill="#4a9ac8" />
          {fairway(88)}
          {flag(54, 70, 20)}
        </>
      );
    case "laurel":
      return (
        <>
          <rect width="100" height="100" fill={color} />
          <circle cx="50" cy="50" r="40" fill="rgba(255,255,255,0.08)" />
          {[-1, 1].map((s) => (
            <g key={s}>
              {Array.from({ length: 7 }, (_, i) => {
                const a = Math.PI / 2 + s * (0.35 + i * 0.28);
                const x = 50 + Math.cos(a) * 30;
                const y = 52 + Math.sin(a) * 30;
                return <ellipse key={i} cx={x} cy={y} rx="6" ry="2.6" transform={`rotate(${(a * 180) / Math.PI + s * 60} ${x} ${y})`} fill="#e3c26a" />;
              })}
            </g>
          ))}
          <path d="M38 30 H62 V38 Q62 52 50 54 Q38 52 38 38 Z" fill="#f2d27a" />
          <path d="M38 33 H32 Q32 42 40 44 M62 33 H68 Q68 42 60 44" stroke="#f2d27a" strokeWidth="2.2" fill="none" />
          <path d="M47 54 H53 V62 H58 V66 H42 V62 H47 Z" fill="#f2d27a" />
          {star(50, 40, 5, color)}
        </>
      );
  }
}

/** The round emblem, at any size. */
export function TournamentEmblem({ event, course, size = 72 }: { event: Pick<TourEvent, "name" | "tier">; course?: Pick<Course, "style">; size?: number }) {
  const spec = logoSpec(event, course);
  const id = `tl${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg className="tournament-emblem" width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`${event.name} logo`}>
      <defs>
        <clipPath id={`${id}c`}><circle cx="50" cy="50" r="42" /></clipPath>
      </defs>
      <circle cx="50" cy="50" r="49" fill={spec.color} />
      <circle cx="50" cy="50" r="45.5" fill="#fff" />
      <g clipPath={`url(#${id}c)`}>
        <Scene motif={spec.motif} color={spec.color} id={id} />
      </g>
      <circle cx="50" cy="50" r="42" fill="none" stroke={spec.color} strokeWidth="1.2" />
    </svg>
  );
}

/** The emblem and wordmark together, and the week's numbers, like a tour's tournament card. */
export function TournamentCard({ event, course, venue }: { event: TourEvent; course?: Pick<Course, "style">; venue?: string }) {
  const spec = logoSpec(event, course);
  const points = event.winnerPoints ?? WINNER_POINTS[event.tier];
  return (
    <div className="tournament-card" style={{ ["--logo" as string]: spec.color }}>
      <div className="tc-brand">
        <TournamentEmblem event={event} course={course} size={92} />
        <div className="tc-words">
          {spec.pre && <div className="tc-pre">{spec.pre}</div>}
          <div className="tc-main">{spec.main}</div>
          {spec.sub && <div className="tc-sub">{spec.sub}</div>}
          {venue && <div className="tc-venue">{venue}</div>}
        </div>
      </div>
      <dl className="tc-stats">
        <div><dt>Purse</dt><dd>{millions(event.purse)}</dd></div>
        {points > 0 && <div><dt>Winner's points</dt><dd>{points}</dd></div>}
        <div><dt>Field</dt><dd>{event.fieldSize}</dd></div>
      </dl>
    </div>
  );
}
