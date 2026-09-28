import { useId } from "react";
import { NATIONS, type Look } from "../../engine";
import { Nation } from "./Flag";

/**
 * Player pictures: illustrated head-and-shoulders golfer portraits, drawn as
 * SVG. Each is built from the player's id, so it's the same on every screen
 * and in every save, with colours that fit where he's from and how old he is.
 * Only colours and styles vary; every face has the same proportions.
 */

// Skin tones, lightest to deepest, and how likely each is by where a player is from.
const SKIN = ["#f8dcc8", "#f0c8a8", "#e2b08a", "#cf9870", "#b57a52", "#94603e", "#72472d", "#553322"];
const SKIN_ODDS: Record<Look, number[]> = {
  mixed: [14, 18, 16, 12, 10, 12, 10, 8],
  northern: [30, 34, 20, 8, 4, 2, 1, 1],
  eastAsia: [4, 20, 36, 28, 10, 2, 0, 0],
  latin: [4, 12, 24, 26, 20, 10, 3, 1],
  pacific: [0, 0, 4, 10, 20, 30, 24, 12],
  southAsia: [0, 4, 16, 30, 30, 14, 5, 1],
};
const HAIR = ["#1b1714", "#3a2a1f", "#5e4330", "#8a6440", "#c9a066", "#9a4a26"];
const HAIR_ODDS: Record<Look, number[]> = {
  mixed: [26, 30, 20, 10, 10, 4],
  northern: [6, 22, 26, 20, 20, 6],
  eastAsia: [80, 20, 0, 0, 0, 0],
  latin: [50, 38, 10, 2, 0, 0],
  pacific: [85, 15, 0, 0, 0, 0],
  southAsia: [80, 20, 0, 0, 0, 0],
};
const EYES = ["#2b1d14", "#5a3a22", "#7a6a3a", "#4f7a4a", "#4a78a8"];
const EYE_ODDS: Record<Look, number[]> = {
  mixed: [25, 35, 12, 10, 18],
  northern: [5, 25, 15, 20, 35],
  eastAsia: [60, 40, 0, 0, 0],
  latin: [35, 45, 12, 5, 3],
  pacific: [60, 40, 0, 0, 0],
  southAsia: [60, 40, 0, 0, 0],
};
const GREY = ["#a09b94", "#c9c5bf"];
const SHIRT = ["#1d2b45", "#2a5fa8", "#b8322a", "#f4f4f1", "#1c1c1c", "#1f6b45", "#8fb7d9", "#8c8f94", "#9b86c4", "#e07b39", "#f2d14a", "#2b9aa0"];
const HAT = ["#f7f7f4", "#1d2b45", "#1c1c1c", "#b8322a", "#1f6b45", "#8c8f94", "#8fb7d9", "#d8cdb4"];

type Headwear = "cap" | "visor" | "bucket" | "none";
type HairStyle = "short" | "side" | "buzz" | "curly" | "receding";
type FacialHair = "none" | "stubble" | "beard" | "mustache";
type Mouth = "smile" | "grin" | "neutral";

export interface PortraitSpec {
  skin: string;
  hair: string;
  eyes: string;
  hairStyle: HairStyle;
  headwear: Headwear;
  hat: string;
  shirt: string;
  facial: FacialHair;
  mouth: Mouth;
  shades: boolean;
}

/** FNV-1a hash of the player's id: the seed for his picture. */
export function portraitSeed(playerId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < playerId.length; i++) {
    h ^= playerId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

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

function weighted<T>(r: () => number, items: readonly T[], odds: readonly number[]): T {
  const total = odds.reduce((s, x) => s + x, 0);
  let x = r() * total;
  for (let i = 0; i < items.length; i++) {
    x -= odds[i] ?? 0;
    if (x < 0) return items[i]!;
  }
  return items[items.length - 1]!;
}
const pick = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;

/** Everything about a player's picture, fixed by his id, nationality and age. */
export function portraitSpec(player: { id: string; nationality: string; age: number }): PortraitSpec {
  const r = mulberry(portraitSeed(player.id));
  const look = NATIONS[player.nationality]?.look ?? "mixed";
  const skinIndex = SKIN.indexOf(weighted(r, SKIN, SKIN_ODDS[look]));
  // Deeper skin tones come with dark hair and eyes.
  const hairOdds = skinIndex >= 5 ? [70, 30, 0, 0, 0, 0] : HAIR_ODDS[look];
  const eyeOdds = skinIndex >= 4 ? [55, 45, 0, 0, 0] : EYE_ODDS[look];
  let hair = weighted(r, HAIR, hairOdds);
  const eyes = weighted(r, EYES, eyeOdds);
  const greyChance = player.age >= 48 ? 0.85 : player.age >= 44 ? 0.6 : player.age >= 38 ? 0.25 : 0;
  if (r() < greyChance) hair = player.age >= 46 ? GREY[1]! : GREY[0]!;
  const headwear = weighted<Headwear>(r, ["cap", "visor", "bucket", "none"], [68, 10, 4, 18]);
  const hairStyle = weighted<HairStyle>(r, ["short", "side", "buzz", "curly", "receding"], [34, 30, 16, 12, player.age >= 36 ? 20 : 3]);
  return {
    skin: SKIN[skinIndex]!,
    hair,
    eyes,
    hairStyle,
    headwear,
    hat: pick(r, HAT),
    shirt: pick(r, SHIRT),
    facial: weighted<FacialHair>(r, ["none", "stubble", "beard", "mustache"], [58, 22, 14, 6]),
    mouth: weighted<Mouth>(r, ["smile", "grin", "neutral"], [50, 25, 25]),
    shades: r() < 0.1,
  };
}

/** A lighter or darker version of a hex colour (amount -1..1). */
function shadeColor(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f);
  return `#${((1 << 24) | (r! << 16) | (g! << 8) | b!).toString(16).slice(1)}`;
}
const isLight = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 > 170;
};

const HEAD = "M31 44 C31 27 40 20 50 20 C60 20 69 27 69 44 C69 57 64 67 50 71 C36 67 31 57 31 44 Z";
const JAW = "M34 53 C35 63 42 69 50 71 C58 69 65 63 66 53 C62 60 56 62.5 50 62.5 C44 62.5 38 60 34 53 Z";

function TopHair({ s }: { s: PortraitSpec }) {
  const c = s.hair;
  switch (s.hairStyle) {
    case "short":
      return <path d="M30 44 C28 23 40 16 50 16 C61 16 72 23 70 44 C67 33 60 27.5 50 27.5 C40 27.5 33 33 30 44 Z" fill={c} />;
    case "side":
      return <path d="M30 45 C27 22 40 15 51 15.5 C63 16 73 24 70 44 C66 32 58 26 46 29 C40 30.5 33 36 30 45 Z" fill={c} />;
    case "buzz":
      return <path d="M31 42 C30 25 40 18.5 50 18.5 C60 18.5 70 25 69 42 C66 32 60 28 50 28 C40 28 34 32 31 42 Z" fill={c} opacity="0.8" />;
    case "curly":
      return (
        <g fill={c}>
          {[32, 38, 44, 50, 56, 62, 68].map((x, i) => <circle key={i} cx={x} cy={i % 2 ? 20 : 23.5} r="6" />)}
          <circle cx="31" cy="31" r="4.5" />
          <circle cx="69" cy="31" r="4.5" />
        </g>
      );
    case "receding":
      return <path d="M30.5 44 C30 36 31.5 31 34 28 C35 33 35.5 38 35.5 44 Z M69.5 44 C70 36 68.5 31 66 28 C65 33 64.5 38 64.5 44 Z" fill={c} />;
  }
}

function Hat({ s }: { s: PortraitSpec }) {
  const c = s.hat;
  const dark = shadeColor(c, -0.22);
  const patch = isLight(c) ? "#1d2b45" : "#f4f4f1";
  const emblem = isLight(c) ? "#f4f4f1" : "#1d2b45";
  // The brim's shadow across his forehead.
  const shadow = <path d="M32 38.5 Q50 42.5 68 38.5 L68 42 Q50 46.5 32 42 Z" fill="rgba(0,0,0,0.16)" />;
  const brim = (
    <>
      <path d="M27 36.5 Q50 32.8 73 36.5 Q72.4 41.6 50 42.4 Q27.6 41.6 27 36.5 Z" fill={dark} />
      <path d="M27 36.5 Q50 32.8 73 36.5 Q72.6 38.6 50 39.2 Q27.4 38.6 27 36.5 Z" fill={c} />
    </>
  );
  switch (s.headwear) {
    case "none":
      return null;
    case "cap":
      return (
        <g>
          {shadow}
          <path d="M29.5 37 C29.5 15.5 70.5 15.5 70.5 37 Z" fill={c} />
          <path d="M50 22.2 V37 M39.5 23.6 Q37 29 36.5 37 M60.5 23.6 Q63 29 63.5 37" stroke={dark} strokeWidth="0.6" fill="none" />
          <ellipse cx="50" cy="21.6" rx="1.4" ry="0.9" fill={dark} />
          {/* A plain patch with a little flagstick: no real brand. */}
          <rect x="43.5" y="25" width="13" height="8" rx="2" fill={patch} />
          <path d="M48.3 26.6 V31.6" stroke={emblem} strokeWidth="0.7" />
          <path d="M48.3 26.6 L52.6 27.9 L48.3 29.2 Z" fill={emblem} />
          {brim}
        </g>
      );
    case "visor":
      return (
        <g>
          {shadow}
          <path d="M30 31.5 Q50 27.5 70 31.5 L70 36.5 Q50 33 30 36.5 Z" fill={c} />
          <rect x="45" y="30" width="10" height="4.2" rx="1.2" fill={patch} />
          {brim}
        </g>
      );
    case "bucket":
      return (
        <g>
          {shadow}
          <path d="M31.5 36 C31.5 16 68.5 16 68.5 36 Z" fill={c} />
          <path d="M31.5 31.5 Q50 29 68.5 31.5 L68.5 34.5 Q50 32 31.5 34.5 Z" fill={dark} />
          <path d="M21 37.5 Q50 30.5 79 37.5 Q73 43.5 50 44 Q27 43.5 21 37.5 Z" fill={c} stroke={dark} strokeWidth="0.6" />
        </g>
      );
  }
}

function Face({ s }: { s: PortraitSpec }) {
  const brow = s.hair === GREY[1] || s.hair === "#c9a066" ? shadeColor(s.hair, -0.35) : s.hair;
  const lip = shadeColor(s.skin, -0.42);
  return (
    <g>
      {s.facial === "stubble" && <path d={JAW} fill={s.hair} opacity="0.22" />}
      {s.facial === "beard" && <path d="M33 50 C33 64 41 72 50 73 C59 72 67 64 67 50 C63 58 57 60.5 50 60.5 C43 60.5 37 58 33 50 Z" fill={s.hair} />}
      <path d="M38.2 41.8 Q42.4 39.6 46.6 41.5 M53.4 41.5 Q57.6 39.6 61.8 41.8" stroke={brow} strokeWidth="1.9" fill="none" strokeLinecap="round" />
      {s.shades ? (
        <g>
          <path d="M36.5 44 H47.5 L46.8 49 Q42 50.5 37.3 49 Z M52.5 44 H63.5 L62.7 49 Q58 50.5 53.2 49 Z" fill="#1b1b1b" />
          <path d="M47.5 44.6 H52.5" stroke="#1b1b1b" strokeWidth="1.2" />
          <path d="M38.5 45.2 L41 45.2" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" strokeLinecap="round" />
        </g>
      ) : (
        [42.4, 57.6].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy="46.4" rx="3.3" ry="2" fill="#fbfbf8" />
            <circle cx={x} cy="46.5" r="1.55" fill={s.eyes} />
            <circle cx={x} cy="46.5" r="0.7" fill="#111" />
            <circle cx={x + 0.55} cy="45.9" r="0.35" fill="#fff" />
            <path d={`M${x - 3.4} 45.9 Q${x} 43.4 ${x + 3.4} 45.9`} stroke="rgba(0,0,0,0.5)" strokeWidth="0.8" fill="none" />
          </g>
        ))
      )}
      <path d="M50.3 46.5 Q48.6 52.2 47.6 54.8 Q50 56.3 52.4 54.8" stroke={shadeColor(s.skin, -0.28)} strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <circle cx="38.5" cy="55" r="3.4" fill="#d9573f" opacity="0.07" />
      <circle cx="61.5" cy="55" r="3.4" fill="#d9573f" opacity="0.07" />
      {s.facial === "mustache" && <path d="M44 59.4 Q50 56.4 56 59.4 Q50 58.4 44 59.4 Z" fill={s.hair} stroke={s.hair} strokeWidth="1.6" strokeLinejoin="round" />}
      {s.mouth === "grin" ? (
        <path d="M44.6 61 Q50 66 55.4 61 Q50 62.6 44.6 61 Z" fill="#fff" stroke={lip} strokeWidth="0.9" strokeLinejoin="round" />
      ) : s.mouth === "smile" ? (
        <path d="M44.8 61.2 Q50 64.6 55.2 61.2" stroke={lip} strokeWidth="1.35" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M45.5 62 Q50 63 54.5 62" stroke={lip} strokeWidth="1.3" fill="none" strokeLinecap="round" />
      )}
    </g>
  );
}

type PortraitPlayer = { id: string; nationality: string; age: number };

/** One portrait, drawn at any size. */
export function Portrait({ player, size = 72, className, title }: { player: PortraitPlayer; size?: number; className?: string; title?: string }) {
  const s = portraitSpec(player);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const shirtDark = shadeColor(s.shirt, -0.2);
  const skinDark = shadeColor(s.skin, -0.14);
  const buttons = isLight(s.shirt) ? "#9a9a94" : "#f4f4f1";
  return (
    <svg className={`portrait ${className ?? ""}`} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={title ?? "Player picture"}>
      <defs>
        <linearGradient id={`bg${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e3eee5" />
          <stop offset="0.62" stopColor="#cfe2d3" />
          <stop offset="1" stopColor="#b7d2bd" />
        </linearGradient>
        <radialGradient id={`face${uid}`} cx="0.5" cy="0.42" r="0.62">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.16" />
        </radialGradient>
        <linearGradient id={`shirt${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={shirtDark} />
          <stop offset="0.35" stopColor={s.shirt} />
          <stop offset="0.65" stopColor={s.shirt} />
          <stop offset="1" stopColor={shirtDark} />
        </linearGradient>
        <clipPath id={`clip${uid}`}><rect width="100" height="100" rx="14" /></clipPath>
      </defs>
      <g clipPath={`url(#clip${uid})`}>
        <rect width="100" height="100" fill={`url(#bg${uid})`} />
        {/* The tree line on the course behind him. */}
        <path d="M0 64 Q12 57 22 62 Q32 55 44 61 Q56 54 68 60 Q80 55 100 61 V100 H0 Z" fill="#a9c9b0" opacity="0.55" />
        {/* A polo: collar, placket and a small chest logo. */}
        <path d="M5 101 C7 84 23 76.5 40 74 L50 81 L60 74 C77 76.5 93 84 95 101 Z" fill={`url(#shirt${uid})`} />
        <path d="M41 60 L41 73 Q50 79 59 73 L59 60 Z" fill={s.skin} />
        <path d="M41 63 Q50 70.5 59 63 L59 60 L41 60 Z" fill="rgba(0,0,0,0.16)" />
        <path d="M40 72.5 L50 81.5 L45 87 L36 75.5 Z M60 72.5 L50 81.5 L55 87 L64 75.5 Z" fill={s.shirt} stroke={shirtDark} strokeWidth="0.7" strokeLinejoin="round" />
        <rect x="48.9" y="82" width="2.2" height="11" fill="rgba(0,0,0,0.1)" />
        <circle cx="50" cy="85.2" r="0.85" fill={buttons} />
        <circle cx="50" cy="89.4" r="0.85" fill={buttons} />
        <circle cx="68" cy="88" r="2" fill={isLight(s.shirt) ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.4)"} />
        <ellipse cx="31.5" cy="48" rx="3.4" ry="5.6" fill={s.skin} />
        <ellipse cx="68.5" cy="48" rx="3.4" ry="5.6" fill={s.skin} />
        <ellipse cx="31.8" cy="48" rx="1.4" ry="3" fill={skinDark} />
        <ellipse cx="68.2" cy="48" rx="1.4" ry="3" fill={skinDark} />
        <path d={HEAD} fill={s.skin} />
        <path d={HEAD} fill={`url(#face${uid})`} />
        {/* Hair on top when bare-headed or in a visor; just sideburns under a cap. */}
        {s.headwear === "none" || s.headwear === "visor" ? <TopHair s={s} /> : <path d="M31 35 L34.5 35 L34.2 46 L31.6 44.5 Z M69 35 L65.5 35 L65.8 46 L68.4 44.5 Z" fill={s.hair} />}
        <Face s={s} />
        <Hat s={s} />
      </g>
    </svg>
  );
}

/** A portrait tile with the player's flag and country code underneath, as on a player card. */
export function PortraitCard({ player, size = 96, title }: { player: PortraitPlayer; size?: number; title?: string }) {
  return (
    <figure className="portrait-card" style={{ width: size }}>
      <Portrait player={player} size={size} title={title} />
      <figcaption>
        <Nation nationality={player.nationality} />
      </figcaption>
    </figure>
  );
}
