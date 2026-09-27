import { useId } from "react";

/**
 * Player pictures: 100 flat-style golfer portraits, drawn as SVG. Each player
 * gets one from his id, so it is the same on every screen and in every save.
 */

export const PORTRAIT_COUNT = 100;

const SKIN = ["#f6d7c3", "#eec1a0", "#d9a07a", "#b97c55", "#8d5a3b", "#5e3b28"];
const HAIR = ["#1d1a17", "#3b2a1e", "#6b4a2b", "#a0703f", "#d6b370", "#8a8a88", "#b3471f"];
const SHIRT = ["#1f7a4d", "#2a5fa8", "#c8372d", "#f2f2ee", "#1c1c1c", "#e0ad3c", "#7a4fa3", "#2b9aa0", "#f08aa0", "#445566"];
const HAT = ["#ffffff", "#1c2f4a", "#1c1c1c", "#c8372d", "#1f7a4d", "#d8d2c0"];
const BACK = ["#dbe9e0", "#dfe6f2", "#f1e4cf", "#e9dff0", "#dcecee", "#efe0dc", "#e4e8d6"];

type HairStyle = "short" | "side" | "long" | "buzz" | "bald" | "curly";
type Headwear = "none" | "cap" | "visor" | "bucket";
type Face = "clean" | "stubble" | "beard" | "mustache";

export interface PortraitSpec {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  headwear: Headwear;
  hat: string;
  shirt: string;
  back: string;
  face: Face;
  shades: boolean;
}

/** A small deterministic generator so portrait n is always the same picture. */
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;

function buildSpecs(): PortraitSpec[] {
  const out: PortraitSpec[] = [];
  const seen = new Set<string>();
  for (let seed = 1; out.length < PORTRAIT_COUNT; seed++) {
    const r = mulberry(seed * 7919);
    const headwear = pick(r, ["none", "cap", "cap", "visor", "bucket"] as const);
    const spec: PortraitSpec = {
      skin: pick(r, SKIN),
      hair: pick(r, HAIR),
      hairStyle: pick(r, ["short", "side", "long", "buzz", "bald", "curly"] as const),
      headwear,
      hat: pick(r, HAT),
      shirt: pick(r, SHIRT),
      back: pick(r, BACK),
      face: pick(r, ["clean", "clean", "stubble", "beard", "mustache"] as const),
      shades: r() < 0.22,
    };
    // Two portraits must differ in something you can see.
    const key = [spec.skin, spec.hair, spec.hairStyle, spec.headwear, spec.headwear === "none" ? "" : spec.hat, spec.shirt, spec.face, spec.shades].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(spec);
  }
  return out;
}

export const PORTRAITS: readonly PortraitSpec[] = buildSpecs();

/** Which portrait a player has: fixed by his id (FNV-1a hash). */
export function portraitIndex(playerId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < playerId.length; i++) {
    h ^= playerId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % PORTRAIT_COUNT;
}

function Hair({ s }: { s: PortraitSpec }) {
  const c = s.hair;
  switch (s.hairStyle) {
    case "bald":
      return <path d="M31 44 q2 -6 6 -8 M69 44 q-2 -6 -6 -8" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" />;
    case "buzz":
      return <path d="M30 46 C30 26 70 26 70 46 C66 38 34 38 30 46 Z" fill={c} opacity="0.75" />;
    case "short":
      return <path d="M29 48 C27 24 73 24 71 48 C68 38 60 34 50 34 C40 34 32 38 29 48 Z" fill={c} />;
    case "side":
      return <path d="M29 50 C26 24 74 22 71 48 C66 36 56 32 44 35 C38 36 32 40 29 50 Z M44 35 C50 30 60 30 66 36" fill={c} />;
    case "long":
      return <path d="M27 62 C22 24 78 22 73 62 L70 62 C70 44 64 36 50 35 C36 36 30 44 30 62 Z" fill={c} />;
    case "curly":
      return (
        <g fill={c}>
          {[30, 37, 44, 51, 58, 65, 70].map((x, i) => <circle key={i} cx={x} cy={i % 2 ? 33 : 37} r="6.5" />)}
          <circle cx="29" cy="44" r="5" />
          <circle cx="71" cy="44" r="5" />
        </g>
      );
  }
}

function Headwear({ s }: { s: PortraitSpec }) {
  const c = s.hat;
  const edge = "rgba(0,0,0,0.18)";
  switch (s.headwear) {
    case "none":
      return null;
    case "cap":
      return (
        <g>
          <path d="M28 43 C28 22 72 22 72 43 Z" fill={c} stroke={edge} />
          <path d="M26 43 C40 40 66 40 84 45 C70 49 40 48 26 45 Z" fill={c} stroke={edge} />
          <circle cx="50" cy="25" r="1.8" fill={edge} />
        </g>
      );
    case "visor":
      return (
        <g>
          <path d="M29 40 C40 36 60 36 71 40 L71 44 C60 41 40 41 29 44 Z" fill={c} stroke={edge} />
          <path d="M27 43 C42 40 66 40 84 45 C70 49 42 48 27 46 Z" fill={c} stroke={edge} />
        </g>
      );
    case "bucket":
      return (
        <g>
          <path d="M31 42 C31 20 69 20 69 42 Z" fill={c} stroke={edge} />
          <path d="M22 44 C30 38 70 38 78 44 C70 48 30 48 22 44 Z" fill={c} stroke={edge} />
        </g>
      );
  }
}

/** One portrait, drawn at any size. */
export function Portrait({ playerId, size = 72, className, title }: { playerId: string; size?: number; className?: string; title?: string }) {
  const s = PORTRAITS[portraitIndex(playerId)]!;
  const clip = `pc${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const shade = "rgba(0,0,0,0.12)";
  // Hats sit over the top of the hair; long hair still shows at the sides.
  const showHair = s.headwear === "none" || s.headwear === "visor" || s.hairStyle === "long" || s.hairStyle === "curly";
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={title ?? "Player picture"}>
      <defs>
        <clipPath id={clip}><circle cx="50" cy="50" r="50" /></clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="100" height="100" fill={s.back} />
        {/* Shirt with a polo collar. */}
        <path d="M12 104 C14 80 30 74 50 74 C70 74 86 80 88 104 Z" fill={s.shirt} />
        <path d="M40 74 L50 86 L60 74 L56 72 L50 79 L44 72 Z" fill="#fff" opacity={s.shirt === "#f2f2ee" ? 0.9 : 0.85} stroke={shade} />
        <rect x="43" y="60" width="14" height="15" rx="5" fill={s.skin} />
        <rect x="43" y="66" width="14" height="4" fill={shade} />
        {/* Head. */}
        <ellipse cx="30" cy="50" rx="4" ry="6" fill={s.skin} />
        <ellipse cx="70" cy="50" rx="4" ry="6" fill={s.skin} />
        <ellipse cx="50" cy="48" rx="20" ry="23" fill={s.skin} />
        {showHair && <Hair s={s} />}
        {/* Face. */}
        {s.face === "stubble" && <path d="M32 54 C34 72 66 72 68 54 C64 66 36 66 32 54 Z" fill={s.hair} opacity="0.25" />}
        {s.face === "beard" && <path d="M31 50 C31 76 69 76 69 50 C66 62 60 62 50 62 C40 62 34 62 31 50 Z" fill={s.hair} />}
        {s.face === "mustache" && <path d="M42 59 C46 56 54 56 58 59 C54 58 46 58 42 59 Z" fill={s.hair} stroke={s.hair} strokeWidth="2" strokeLinejoin="round" />}
        {s.shades ? (
          <g>
            <rect x="35" y="44" width="13" height="7" rx="3" fill="#1b1b1b" />
            <rect x="52" y="44" width="13" height="7" rx="3" fill="#1b1b1b" />
            <path d="M48 47 L52 47" stroke="#1b1b1b" strokeWidth="1.6" />
          </g>
        ) : (
          <g fill="#222">
            <circle cx="42" cy="47" r="2" />
            <circle cx="58" cy="47" r="2" />
            <path d="M38 42 L45 41 M55 41 L62 42" stroke={s.hair} strokeWidth="1.8" strokeLinecap="round" />
          </g>
        )}
        <path d="M49 50 Q50 55 48 56" stroke={shade} strokeWidth="1.4" fill="none" />
        {s.face !== "beard" && <path d="M44 62 Q50 65 56 62" stroke="#7a3b2e" strokeWidth="1.6" fill="none" strokeLinecap="round" />}
        <g transform="translate(0 -5)"><Headwear s={s} /></g>
      </g>
    </svg>
  );
}
