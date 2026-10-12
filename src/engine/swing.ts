/**
 * Timing rules for a player's own swing (the broadcast three-click), matching the
 * broadcast-swing demo: the sweet spot is the club's window minus penalties for the
 * lie, shape, height, overdrive and shot type, with a 25 ms floor. The player's
 * skill with the club changes how fast the power meter sweeps (better players get a
 * slower meter) and how wide the window is. Prototype tuning; practice rounds only.
 */
import { TOUR_AVERAGE, type AttributeKey } from "./attributes";
import type { Player } from "./types";

export type SwingClub = "driver" | "iron" | "wedge";
export type SwingLie = "fairway" | "light" | "deep" | "fairwaySand" | "greenSand" | "green";
export type SwingShot = "normal" | "punch" | "flop" | "splash";

/** Strike window for each club on a clean fairway, in ms either side of the centre. */
export const BASE_WINDOW_MS: Record<SwingClub, number> = { driver: 60, iron: 85, wedge: 110 };
/** Time for the power meter to sweep 0 to 110%, and the strike meter to cross, for a tour average player. */
export const POWER_SWEEP_MS = 2200;
export const STRIKE_SWEEP_MS = 1200;
/** Window penalty for each lie (the demo's values). */
const LIE_PENALTY_MS: Record<SwingLie, number> = { fairway: 0, light: 8, deep: 22, fairwaySand: 25, greenSand: 0, green: 0 };
const FLOOR_MS = 25;
const SPLASH_WINDOW_MS = 115;

/** The attributes that govern each club. */
const CLUB_SKILLS: Record<SwingClub, AttributeKey[]> = {
  driver: ["drivingDistance", "drivingAccuracy"],
  iron: ["longIrons", "midIrons", "fairwayWoods"],
  wedge: ["wedges", "distanceControl", "chipping", "pitching", "bunkerPlay"],
};

/** How far above (+) or below (-) the tour average a player is with this club. */
export function clubSkill(player: Player, club: SwingClub): number {
  const keys = CLUB_SKILLS[club];
  const avg = keys.reduce((s, k) => s + player.attributes[k], 0) / keys.length;
  return avg - TOUR_AVERAGE;
}

/** Multiplier on the meter sweep: better players get a slower meter, weaker ones a faster one. */
export function meterFactor(player: Player, club: SwingClub): number {
  return Math.min(1.4, Math.max(0.7, 1 + 0.03 * clubSkill(player, club)));
}

/** Time for the power meter to sweep 0 to 110%, for this player and club. */
export const powerSweepMs = (player: Player, club: SwingClub): number => Math.round(POWER_SWEEP_MS * meterFactor(player, club));
/** Time for the strike meter to cross, for this player and club. */
export const strikeSweepMs = (player: Player, club: SwingClub): number => Math.round(STRIKE_SWEEP_MS * meterFactor(player, club));

/**
 * The sweet-spot half-width in ms for this swing. Worse lies, shaped and high or low
 * shots, overdriving the meter, and a weaker player all shrink it.
 */
export function sweetSpotMs(
  player: Player,
  club: SwingClub,
  lie: SwingLie,
  opts: { shot?: SwingShot; shape?: number; strength?: number; height?: number; power?: number } = {},
): number {
  const { shot = "normal", shape = 0, strength = 0.5, height = 0, power = 90 } = opts;
  const base = shot === "splash" ? SPLASH_WINDOW_MS : BASE_WINDOW_MS[club];
  const control = Math.min(1.25, Math.max(0.8, 1 + 0.02 * clubSkill(player, club)));
  const shotPenalty = shot === "flop" ? 30 : shot === "punch" ? 8 : 0;
  const overdrive = Math.max(0, power - 100) * (lie === "deep" ? 4 : 2.5);
  const raw = base * control - LIE_PENALTY_MS[lie] - 24 * Math.abs(shape) * strength - 14 * Math.abs(height) - overdrive - shotPenalty;
  return Math.max(FLOOR_MS, Math.round(raw));
}

export interface SwingResult {
  /** 0 to 1: 1 is dead centre on the timing and the target power. */
  quality: number;
  /** Timing in ms (negative early, positive late). */
  timingMs: number;
  /** Whether the strike landed inside the sweet spot. */
  inWindow: boolean;
}

/** Scores a strike: the timing against the sweet spot, and the power against the target. */
export function scoreSwing(input: { power: number; timingMs: number }, windowMs: number, targetPower: number): SwingResult {
  const timingError = Math.min(1, Math.abs(input.timingMs) / windowMs);
  const powerError = Math.min(1, Math.abs(input.power - targetPower) / 40);
  const quality = Math.max(0, 1 - 0.7 * timingError - 0.3 * powerError);
  return { quality, timingMs: input.timingMs, inWindow: Math.abs(input.timingMs) <= windowMs };
}
