import { TOUR_AVERAGE } from "./attributes";
import { clamp, type Rng } from "./rng";
import { expectedStrokesGained } from "./skill";
import { roundTendencyShift, tendencies } from "./tendencies";
import { pinEffect } from "./pins";
import { caddieCalm, caddieRound, equipmentHole, equipmentRound } from "./equipment";
import { familiarityHole, familiarityRound, type FamiliarityInfo } from "./familiarity";
import { hasTrait, traitHoleEffects, traitRoundEffects, type PlayerEventContext } from "./traits";
import {
  SG_CATEGORIES,
  type Course,
  type Hole,
  type Player,
  type RoundWeather,
  type StrokesGained,
  type Wave,
} from "./types";

/**
 * Day-to-day spread of each strokes-gained category, per round, for a
 * tour-average player (roughly what tour ShotLink data shows).
 */
// Scaled so a player's scores scatter about 2.75 strokes from round to round, as Data Golf measures.
export const DAY_SD: StrokesGained = { offTheTee: 0.38, approach: 0.57, aroundTheGreen: 0.43, putting: 0.57 };
/** Spread of a player's level from one week to the next, strokes per round. */
export const WEEK_SD = 0.4;
/** Leftover hole-to-hole luck (bounces, lip-outs) not tied to a category. */
export const HOLE_SD = 0.35;
/** Strokes a hole added for a final-round leader (or one behind): about 0.8 a round. Data Golf: leaders play 0.44 below expectation. */
export const LEADER_BURDEN = 0.045;
/**
 * Extra hole-to-hole spread in the final round for the chasers (2-6 back): they swing
 * freely, so someone usually comes at the leader and blowouts stay rare (real winning
 * margin about 2 shots; the biggest of 2022-23 was 7).
 */
export const SUNDAY_SPREAD = 1.3;
/** The leader's own round-four scatter (the chasers' is SUNDAY_SPREAD). */
export const LEADER_SPREAD = 1.0;

/**
 * Expected score before blow-ups for a tour-average player on a standard
 * hole of each par. Blow-ups add roughly 0.04 a hole on top.
 */
export const BASE = { par3: 2.995, par4: 3.965, par5: 4.585 };

/** Scoring average of a tour-average player on this hole, calm and dry. */
export function holeBaseline(hole: Hole, course: Course, weather: RoundWeather): number {
  let mean =
    hole.par === 3
      ? BASE.par3 + (hole.yards - 185) * 0.0035
      : hole.par === 4
        ? BASE.par4 + (hole.yards - 430) * 0.0028
        : BASE.par5 + (hole.yards - 570) * 0.002;
  mean += hole.hazard * 0.05;
  if (hole.par > 3) mean += (30 - hole.fairwayWidth) * 0.004 * (0.5 + course.roughPenalty);
  mean += (course.greenSpeed - 12) * 0.015;
  mean += hole.bunkers * 0.008;
  mean += weather.rain ? -0.06 : (course.firmness - 0.5) * 0.08;
  // Real holes carry a correction so they play to their real scoring average.
  mean += hole.adjust ?? 0;
  // The season's course setup, spread evenly over the holes.
  mean += (course.setup ?? 0) / course.holes.length;
  return mean;
}

/**
 * Strokes added by wind on one hole for a tour-average player. Tuned so a field
 * scores about 0.75 a round higher in 10-15 mph than in calm, and 1.5-3 higher
 * in 20+ mph (PGA TOUR wind trends, golfweatherscore.com).
 */
export const WIND_STROKES = 0.15;
export const WIND_POWER = 1.25;
const windStrokes = (hole: Hole, windMph: number): number => hole.exposure * WIND_STROKES * Math.pow(Math.max(0, windMph) / 10, WIND_POWER);
/**
 * Wind's effect against the course's typical day: real hole averages already
 * include a normal day's breeze there, so a calm day plays easier than them
 * and a windy one harder.
 */
export const windPenalty = (hole: Hole, windMph: number, typicalMph = 0): number =>
  fittedTypicalWind(hole, typicalMph) + windStrokes(hole, windMph) - windStrokes(hole, typicalMph);
/**
 * The real courses' hole difficulty was fitted (scripts/fitRealCourses.ts) with the old wind
 * curve, which charged a typical day this much; keep it so they still play to their averages.
 */
const fittedTypicalWind = (hole: Hole, typicalMph: number): number => hole.exposure * 0.06 * Math.pow(Math.max(0, typicalMph) / 10, 1.6);
/** A course's usual wind (see drawWeather): its windiness, plus the afternoon's extra breeze. */
export const typicalWind = (course: Course): number => course.windiness * 18 + 1.25;

/** How strongly wind affects this player: 1 = average, lower is better. */
export function windMultiplier(player: Player): number {
  const a = player.attributes;
  return clamp(
    1 - (a.windTolerance - TOUR_AVERAGE) * 0.02 - (a.trajectoryControl - TOUR_AVERAGE) * 0.015,
    0.5,
    1.5,
  );
}

export interface RoundContext {
  player: Player;
  course: Course;
  weather: RoundWeather;
  wave: Wave;
  /** 1-4. */
  round: number;
  /** Shots behind the leader at the start of the round (null in rounds 1-2). */
  shotsBehind: number | null;
  /** This week's hot or cold spell, strokes per round (drawn once per event). */
  weekForm?: number;
  rng: Rng;
  /** The event's tier ("major", "signature", ...), for traits that care. */
  tier?: string;
  /** What the season knows about his week (schedule, history), for traits. */
  event?: PlayerEventContext;
  /** Round 2: shots inside (+) or outside (-) the projected cut after round 1. */
  cutGap?: number | null;
  /** Rounds 3-4: his position after 36 holes. */
  position36?: number | null;
  /** A sudden-death playoff hole. */
  playoff?: boolean;
}

export interface RoundResult {
  holes: number[];
  strokes: number;
  /** The player's category performance today, against a tour-average player. */
  dayForm: StrokesGained;
}

/** Converts a continuous expected score to whole strokes without biasing the mean. */
function stochasticRound(x: number, rng: Rng): number {
  const lo = Math.floor(x);
  return lo + (rng.next() < x - lo ? 1 : 0);
}

/**
 * Pressure on the player's scoring per hole: negative helps, positive hurts.
 * Only bites in contention on the weekend, hardest on the back nine Sunday.
 */
export function pressureShift(player: Player, round: number, shotsBehind: number | null, holeNumber: number): number {
  if (round < 3 || shotsBehind === null || shotsBehind > 4) return 0;
  const a = player.attributes;
  // Ice Water plays as if his nerve and composure were 3 higher; Clutch Gene feels it the right way.
  const steadiness = a.sundayNerves * 0.6 + a.composure * 0.4 - TOUR_AVERAGE + (hasTrait(player, "ice-water") ? 3 : 0);
  const weight = (round === 4 ? 1 : 0.4) * (holeNumber > 9 ? 1 : 0.5);
  const shift = -steadiness * 0.02 * weight;
  if (hasTrait(player, "clutch-gene")) return shift < 0 ? shift * 1.8 : shift * 0.5;
  return shift;
}

export interface HoleState {
  /** Strokes over par on the previous hole (for bounce-back / tilt). */
  lastOverPar: number;
}

export interface HoleInputs {
  ctx: RoundContext;
  hole: Hole;
  dayForm: StrokesGained;
  teeShotHoles: number;
  state: HoleState;
  /** A strategy call's effect on this hole (see calls.ts): strokes added, spread and blow-up multipliers. */
  mod?: HoleMod;
}

export interface HoleMod {
  mean: number;
  sd: number;
  blowup: number;
}

export function playHole({ ctx, hole, dayForm, teeShotHoles, state, mod }: HoleInputs): number {
  const { player, course, weather, wave, rng } = ctx;
  const a = player.attributes;

  let mean = holeBaseline(hole, course, weather);
  const t = traitHoleEffects({
    player,
    hole,
    course,
    round: ctx.round,
    shotsBehind: ctx.shotsBehind,
    tier: ctx.tier,
    playoff: ctx.playoff,
    lastToPar: state.lastOverPar,
    roughCost: hole.par > 3 ? (30 - hole.fairwayWidth) * 0.004 * (0.5 + course.roughPenalty) : 0,
    bunkerCost: hole.bunkers * 0.008,
  });
  mean += t.mean;
  // Today's pin: tucked by the edge plays harder, in the middle easier; local knowledge softens it.
  const pin = familiarityHole(familiarityOf(ctx), hole.hazard, pinEffect(course, hole, ctx.playoff ? 3 : ctx.round - 1));
  mean += pin.mean;
  // His bag: wide-soled wedges in the sand, a long driver on tight holes.
  const bag = equipmentHole(player, hole.par > 3 ? hole.fairwayWidth : 0, hole.bunkers * 0.008);
  mean += bag.mean;
  mean += windPenalty(hole, weather.windMph[wave], typicalWind(course)) * windMultiplier(player) * t.wind;

  // Today's category form, spread over the holes where it applies.
  if (hole.par > 3) mean -= dayForm.offTheTee / teeShotHoles;
  mean -= (dayForm.approach + dayForm.aroundTheGreen + dayForm.putting) / course.holes.length;

  // Aggressive players attack par 5s.
  if (hole.par === 5) mean -= (a.aggression - TOUR_AVERAGE) * 0.01;

  // A bogey or worse carries over: everyone tilts a little, good bounce-back cancels it.
  if (state.lastOverPar > 0) mean += 0.03 - (a.bounceBack - TOUR_AVERAGE) * 0.015;

  // A calm caddie takes some of the weekend nerves away.
  const rawPressure = pressureShift(player, ctx.round, ctx.shotsBehind, hole.number);
  const pressure = rawPressure > 0 ? rawPressure * (1 - caddieCalm(ctx.event?.caddie)) : rawPressure;
  mean += pressure;

  // Late fatigue on the weekend for low-stamina or worn-out players.
  if (ctx.round >= 3 && hole.number > 12) {
    mean += Math.max(0, TOUR_AVERAGE - a.stamina) * 0.004 + Math.max(0, 70 - player.condition) * 0.002;
  }

  if (mod) mean += mod.mean;

  let sd = HOLE_SD * (1 + (a.aggression - TOUR_AVERAGE) * 0.015) * (mod?.sd ?? 1) * t.sd * (ctx.event?.scatter ?? 1);
  if (pressure > 0) sd *= 1 + pressure * 3; // nervy players get wilder, not just worse
  // Sunday with a lead is hard: real 54-hole leaders win only about a third of the time
  // (Golf Channel, 34.6% over 15 seasons). The leader feels it; the chasers swing freely.
  if (ctx.round === 4 && !ctx.playoff && ctx.shotsBehind !== null) {
    if (ctx.shotsBehind <= 1) {
      mean += LEADER_BURDEN;
      sd *= LEADER_SPREAD;
    } else if (ctx.shotsBehind <= 6) sd *= SUNDAY_SPREAD;
  }

  // Big numbers: trouble on the hole, wind, and poor decisions.
  const blowupChance = clamp(
    (0.014 + hole.hazard * 0.05) * (1 - (a.courseManagement - TOUR_AVERAGE) * 0.04) * (1 + weather.windMph[wave] / 30) * (mod?.blowup ?? 1) * t.blowup * pin.blowup * bag.blowup,
    0,
    0.25,
  );

  let score = stochasticRound(mean + rng.normal(0, sd), rng);
  if (rng.chance(blowupChance)) score += rng.chance(0.45) ? 2 : 1;
  score = clamp(score, hole.par === 3 ? 1 : hole.par - 2, hole.par + 5);
  state.lastOverPar = score - hole.par;
  return score;
}

/** Draws a player's category form for the day around their expected level. */
export function drawDayForm(
  player: Player,
  course: Course,
  rng: Rng,
  weekForm = 0,
  streak = 1,
  adj?: { sg: StrokesGained; spread: StrokesGained; grinder: boolean },
): StrokesGained {
  const expected = expectedStrokesGained(player, course);
  // Focused players are steadier from day to day; streaky ones less so.
  const spread = clamp(1 - (player.attributes.focus - TOUR_AVERAGE) * 0.02, 0.7, 1.3) * streak;
  const day = { ...expected };
  for (const k of SG_CATEGORIES) day[k] = expected[k] + (adj?.sg[k] ?? 0) + weekForm / 4 + rng.normal(0, DAY_SD[k] * spread * (adj?.spread[k] ?? 1));
  // A grinder claws some of a bad day back.
  if (adj?.grinder) {
    const below = SG_CATEGORIES.reduce((s, k) => s + day[k] - expected[k], 0);
    if (below < -1) for (const k of SG_CATEGORIES) day[k] += 0.05;
  }
  return day;
}

/**
 * The day's form for a round: his usual level, this week's spell, his
 * round-level habits and traits (all as strokes gained, positive helps).
 */
export function roundForm(ctx: RoundContext): StrokesGained {
  const habits = tendencies(ctx.player);
  const shift = roundTendencyShift(habits, ctx.round, ctx.shotsBehind);
  const traits = traitRoundEffects({
    player: ctx.player,
    course: ctx.course,
    rain: ctx.weather.rain,
    wave: ctx.wave,
    round: ctx.round,
    shotsBehind: ctx.shotsBehind,
    tier: ctx.tier,
    event: ctx.event,
    cutGap: ctx.cutGap,
    position36: ctx.position36,
  });
  // Local knowledge of the course, against the field's.
  const local = familiarityRound(familiarityOf(ctx), ctx.round);
  traits.sg.approach += local.approach;
  traits.sg.putting += local.putting;
  // His clubs and his caddie.
  const bag = equipmentRound(ctx.player, !ctx.weather.rain && ctx.course.firmness > 0.6, ctx.weather.rain);
  const caddie = caddieRound(ctx.event?.caddie);
  for (const k of SG_CATEGORIES) {
    traits.sg[k] += bag.sg[k];
    traits.spread[k] *= bag.spread[k];
  }
  traits.sg.approach += caddie.approach;
  traits.sg.putting += caddie.putting;
  return drawDayForm(ctx.player, ctx.course, ctx.rng, (ctx.weekForm ?? 0) + (ctx.event?.seasonForm ?? 0) + (ctx.event?.rivalry ?? 0) - shift - traits.strokes - local.strokes, habits.streak, traits);
}

/** His familiarity with the course this week, when the season supplied it. */
function familiarityOf(ctx: RoundContext): FamiliarityInfo | undefined {
  const e = ctx.event;
  if (!e || e.familiarity === undefined) return undefined;
  return { familiarity: e.familiarity, fieldFamiliarity: e.fieldFamiliarity ?? e.familiarity, debut: !!e.debut };
}

export function simulateRound(ctx: RoundContext): RoundResult {
  // Round-level habits and traits: early- or late-week form, leading or chasing, streakiness, venue.
  const dayForm = roundForm(ctx);
  const teeShotHoles = ctx.course.holes.filter((h) => h.par > 3).length;
  const state: HoleState = { lastOverPar: 0 };
  const holes = ctx.course.holes.map((hole) => playHole({ ctx, hole, dayForm, teeShotHoles, state }));
  return { holes, strokes: holes.reduce((s, x) => s + x, 0), dayForm };
}
