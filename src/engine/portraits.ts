/**
 * Which portrait a player wears. Each player is given a portrait number once,
 * when he's created, and keeps it for his whole career (see `assignPortraits`).
 * The pools below are only used to choose that number: Asian or Indian faces
 * for players from those regions, and a face of about his age band.
 */
import { NATIONS } from "./nations";
import type { Player } from "./types";

export type AgeBand = "young" | "mid" | "older";
export const ageBand = (age: number): AgeBand => (age <= 29 ? "young" : age <= 40 ? "mid" : "older");

/** FNV-1a hash of the player's id: the seed for his picture. */
export function portraitSeed(playerId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < playerId.length; i++) {
    h ^= playerId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The male portraits sorted by how they look: Asian or not, and how old. 1-199 were sorted by eye;
 * 201-400 come tagged (public/people/portraits-201-400.json: 18-24, 25-40, 45-65; East or Southeast Asian or not).
 */
export const PORTRAIT_POOLS: Record<"asian" | "indian" | "other", Record<AgeBand, readonly number[]>> = {
  // Indian players: the Indian faces of the tagged set (they appear among "other" faces too).
  indian: {
    young: [202, 212, 222, 232, 242],
    mid: [252, 262, 272, 282, 292, 302, 312, 322, 332, 342],
    older: [352, 362, 372, 382, 392],
  },
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

/** The portrait that fits a player by region and age. Used once, to choose his number. */
export function golferPortraitIndex(player: Pick<Player, "id" | "nationality" | "age">): number {
  const nation = NATIONS[player.nationality];
  const pools = PORTRAIT_POOLS[nation?.key === "India" ? "indian" : nation?.region === "ASIA" ? "asian" : "other"];
  const pool = pools[ageBand(player.age)];
  return pool[portraitSeed(player.id) % pool.length]!;
}

/** Gives every player who doesn't have one his portrait number, which he keeps for his career. */
export function assignPortraits(players: Iterable<{ player: Player }>): void {
  for (const wp of players) {
    if (wp.player.portraitIndex === undefined) wp.player.portraitIndex = golferPortraitIndex(wp.player);
  }
}
