import { NATIONS, type Look } from "../../engine";
import { Nation } from "./Flag";

/** Player pictures remain stable across screens and saved games. */

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

/** The reusable portrait bank promised by the UI; IDs 1-200 all resolve to stable cartoon faces. */
export const PLAYER_PORTRAIT_CATALOG = Array.from({ length: 200 }, (_, i) => `player-portrait-${i + 1}`);

/** Audited male-only portraits used anywhere a golfer, coach or caddie appears. */
export const MALE_GOLFER_PORTRAIT_IDS = [
  1, 2, 3, 4, 5, 6, 8, 9, 11, 12, 13, 15, 16, 18, 19, 20, 21, 23, 25,
  26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43,
  44, 45, 46, 47, 48, 49, 50, 51, 53, 55, 57, 59, 60, 61, 63, 65, 67, 69,
  71, 73, 75, 78, 79, 81, 82, 84, 88, 90, 91, 92, 94, 95, 97, 99, 100,
  101, 103, 105, 106, 108, 110, 112, 114, 116, 118, 120, 121, 123, 125, 126,
  128, 130, 132, 133, 135, 136, 138, 140, 141, 143, 145, 147, 149, 151, 153,
  155, 156, 157, 159, 161, 163, 164, 167, 169, 170, 171, 173, 175, 176, 178,
  179, 181, 182, 184, 185, 187, 188, 190, 191, 193, 194, 196, 197, 199,
  // The tagged second set, 201-400.
  ...Array.from({ length: 200 }, (_, i) => 201 + i),
] as const;

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

type PortraitPlayer = { id: string; nationality: string; age: number };

/** How old a portrait looks: young (up to 29), in his thirties (30-40), or older (41 and up). */
export type AgeBand = "young" | "mid" | "older";
export const ageBand = (age: number): AgeBand => (age <= 29 ? "young" : age <= 40 ? "mid" : "older");

/**
 * The male portraits sorted by how they look: Asian or not, and how old. 1-199 were sorted by eye;
 * 201-400 come tagged (public/people/portraits-201-400.json: 18-24, 25-40, 45-65; East or Southeast Asian or not).
 */
export const PORTRAIT_POOLS: Record<"asian" | "other", Record<AgeBand, readonly number[]>> = {
  asian: {
    young: [
      5, 13, 16, 28, 31, 38, 44, 49, 105, 133, 136, 161, 201, 211, 221, 231, 241,
    ],
    mid: [
      35, 42, 55, 67, 190, 251, 261, 271, 281, 291, 301, 311, 321, 331, 341,
    ],
    older: [
      97, 351, 361, 371, 381, 391,
    ],
  },
  other: {
    young: [
      1, 2, 3, 4, 6, 8, 9, 11, 12, 15, 18, 19, 20, 21, 23, 25, 30, 34, 36, 61, 71, 75, 81, 88, 90, 92, 95, 99, 101,
      116, 123, 126, 135, 145, 151, 153, 155, 156, 157, 159, 163, 164, 167, 169, 170, 171, 173, 175, 176, 178, 179,
      182, 184, 187, 191, 194, 196, 199, 202, 203, 204, 205, 206, 207, 208, 209, 210, 212, 213, 214, 215, 216, 217,
      218, 219, 220, 222, 223, 224, 225, 226, 227, 228, 229, 230, 232, 233, 234, 235, 236, 237, 238, 239, 240, 242,
      243, 244, 245, 246, 247, 248, 249, 250,
    ],
    mid: [
      26, 29, 32, 33, 37, 39, 41, 45, 46, 47, 53, 57, 60, 63, 69, 78, 84, 100, 103, 106, 110, 112, 114, 118, 120,
      125, 128, 130, 132, 138, 140, 143, 147, 181, 193, 252, 253, 254, 255, 256, 257, 258, 259, 260, 262, 263, 264,
      265, 266, 267, 268, 269, 270, 272, 273, 274, 275, 276, 277, 278, 279, 280, 282, 283, 284, 285, 286, 287, 288,
      289, 290, 292, 293, 294, 295, 296, 297, 298, 299, 300, 302, 303, 304, 305, 306, 307, 308, 309, 310, 312, 313,
      314, 315, 316, 317, 318, 319, 320, 322, 323, 324, 325, 326, 327, 328, 329, 330, 332, 333, 334, 335, 336, 337,
      338, 339, 340, 342, 343, 344, 345, 346, 347, 348, 349, 350,
    ],
    older: [
      27, 40, 43, 48, 50, 51, 59, 65, 73, 79, 82, 91, 94, 108, 121, 141, 149, 185, 188, 197, 352, 353, 354, 355, 356,
      357, 358, 359, 360, 362, 363, 364, 365, 366, 367, 368, 369, 370, 372, 373, 374, 375, 376, 377, 378, 379, 380,
      382, 383, 384, 385, 386, 387, 388, 389, 390, 392, 393, 394, 395, 396, 397, 398, 399, 400,
    ],
  },
};

/** A portrait that fits him: Asian faces for players from Asia, and one his age. Stable while he stays in the same age band. */
export function golferPortraitIndex(player: PortraitPlayer): number {
  const pools = PORTRAIT_POOLS[NATIONS[player.nationality]?.region === "ASIA" ? "asian" : "other"];
  const pool = pools[ageBand(player.age)];
  return pool[portraitSeed(player.id) % pool.length]!;
}

/** One portrait, drawn at any size. */
export function Portrait({ player, size = 72, className, title, index: fixed }: { player: PortraitPlayer; size?: number; className?: string; title?: string; index?: number }) {
  // A fixed picture (a rival head agent) or one that fits the player.
  const index = fixed ?? golferPortraitIndex(player);
  return <img className={`portrait ${className ?? ""}`} src={`/people/person-${String(index).padStart(3, "0")}.webp`} width={size} height={size} alt={title ?? "Illustrated player portrait"} loading="lazy" />;
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
