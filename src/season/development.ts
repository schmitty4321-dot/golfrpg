import {
  ATTRIBUTE_GROUPS,
  TOUR_AVERAGE,
  VISIBLE_ATTRIBUTES,
  clamp,
  createRng,
  traceSeed,
  type AttributeKey,
  type Attributes,
  type Player,
  type Rng,
  type VisibleAttribute,
} from "../engine";
import type { CoachRole, Development, Intensity, TrainingFocus, TrainingPlan, WorldPlayer } from "./types";
import { effectivePeak, has } from "./traits";

/** Skills that decide scoring: the average of these is a player's overall level. */
export const GOLF_SKILLS: readonly VisibleAttribute[] = [
  ...ATTRIBUTE_GROUPS.longGame,
  ...ATTRIBUTE_GROUPS.approach,
  ...ATTRIBUTE_GROUPS.shortGame,
  ...ATTRIBUTE_GROUPS.putting,
];

export const overall = (p: Player): number => GOLF_SKILLS.reduce((s, k) => s + p.attributes[k], 0) / GOLF_SKILLS.length;

/** Attributes that fade first with age: power and the body. */
const PHYSICAL: readonly AttributeKey[] = ["drivingDistance", "stamina", "flexibility", "longIrons", "fairwayWoods"];
/** Attributes experience improves: players get wiser as they age. */
const EXPERIENCE: readonly AttributeKey[] = ["courseManagement", "composure", "sundayNerves", "bounceBack", "focus"];
/** Personality traits never change through training. */
const FIXED: readonly AttributeKey[] = ["injuryProneness", "professionalism", "ambition", "coachability", "aggression"];

/** Which coach looks after which attributes. */
export const COACH_GROUPS: Record<CoachRole, readonly AttributeKey[]> = {
  swing: [...ATTRIBUTE_GROUPS.longGame, ...ATTRIBUTE_GROUPS.approach],
  shortGame: ATTRIBUTE_GROUPS.shortGame,
  putting: ATTRIBUTE_GROUPS.putting,
  mental: ["composure", "courseManagement", "focus", "sundayNerves", "bounceBack", "windTolerance"],
  fitness: ["stamina", "flexibility"],
};

export const FOCUS_GROUPS: Record<Exclude<TrainingFocus, "balanced">, readonly AttributeKey[]> = {
  longGame: ATTRIBUTE_GROUPS.longGame,
  approach: ATTRIBUTE_GROUPS.approach,
  shortGame: ATTRIBUTE_GROUPS.shortGame,
  putting: ATTRIBUTE_GROUPS.putting,
  mental: COACH_GROUPS.mental,
  fitness: ["stamina", "flexibility", "drivingDistance"],
};

export const INTENSITY: Record<Intensity, { growth: number; condition: number; injury: number }> = {
  light: { growth: 0.7, condition: 3, injury: 0.6 },
  normal: { growth: 1, condition: 0, injury: 1 },
  heavy: { growth: 1.35, condition: -4, injury: 2 },
};

/** Everything training can move: the visible attributes plus wind tolerance. */
const TRAINABLE: readonly AttributeKey[] = [...VISIBLE_ATTRIBUTES, "windTolerance"];

/** Growth per week for a young player well short of his ceiling, before modifiers. */
const BASE_GROWTH = 0.045;
/** A strength can sit this far above the player's overall ceiling. */
const STRENGTH_ROOM = 4;

/** A hidden ceiling for a player, by age: young players have room to grow. */
export function initialPotential(p: Player, rng: Rng): number {
  const now = overall(p);
  const room = p.age <= 22 ? Math.min(4.5, Math.abs(rng.normal(2.5, 1.3))) : p.age <= 27 ? Math.min(2.5, Math.abs(rng.normal(1, 0.8))) : Math.max(0, rng.normal(0.3, 0.5));
  // A generational talent is about 17: the very best seasons on record, not beyond.
  return Math.round(Math.min(Math.max(now, MAX_POTENTIAL), now + room) * 10) / 10;
}

/**
 * How far one attribute could grow, for showing beside the current value.
 * The game keeps a single overall ceiling, so this projects it onto each
 * skill: every trainable attribute gains the gap between the player's overall
 * and that ceiling, up to the cap growth stops at. Personality never changes.
 */
export function attributePotential(p: Player, key: AttributeKey, potential: number, value = p.attributes[key]): number {
  if (FIXED.includes(key)) return value;
  const cap = Math.min(20, Math.ceil(potential + STRENGTH_ROOM));
  return Math.max(value, Math.min(cap, Math.round(value + Math.max(0, potential - overall(p)))));
}

/** Ceilings top out here unless a player already starts above it. */
export const MAX_POTENTIAL = 17;

export function newDevelopment(p: Player, rng: Rng): Development {
  return { potential: initialPotential(p, rng), progress: staggeredProgress(p), seasonStart: { ...p.attributes } };
}

/**
 * Starts each attribute part-way to its next point. Growth is nearly the same
 * for every attribute, so from a common start they all tick over in the same
 * few weeks: nothing for half a season, then a burst. Drawn from the player's
 * own stream so the world's shared one is untouched.
 */
export function staggeredProgress(p: Player): Development["progress"] {
  const rng = createRng(traceSeed("progress", p.id, p.name));
  const progress: Development["progress"] = {};
  for (const key of TRAINABLE) if (!FIXED.includes(key)) progress[key] = Math.round((rng.next() - 0.5) * 1000) / 1000 || 0;
  return progress;
}

/** Growth multiplier from age: fast when young, flat around the peak. */
function ageGrowth(age: number, peak: number): number {
  if (age <= peak - 5) return 1.2;
  if (age < peak) return 0.3 + (0.9 * (peak - age)) / 5;
  if (age <= peak + 2) return 0.1;
  return 0;
}

export interface DevelopmentInputs {
  plan: TrainingPlan;
  /** Coach quality per role (1-20); computer players get an implied staff. */
  coachQuality: Partial<Record<CoachRole, number>>;
  /** Whether the player competed this week (competition hardens the mind). */
  competed: boolean;
  /** A veteran Mentor on the same books (your clients under 25 learn faster). */
  mentored?: boolean;
  /** This week's planner: extra range work and gym time. */
  boost?: { training: number; fitness: number };
}

/** The coach quality a computer player works with, by standing. */
export function impliedStaff(wp: WorldPlayer): Partial<Record<CoachRole, number>> {
  const q = wp.career.status === "exempt" ? 12 : wp.career.status === "none" ? 7 : 10;
  return { swing: q, shortGame: q, putting: q, mental: q - 2, fitness: q - 2 };
}

/** Quality used when a role has no coach: working it out alone. */
const SELF_TAUGHT = 4;

function hasCoach(key: AttributeKey, quality: Partial<Record<CoachRole, number>>): boolean {
  return (Object.keys(COACH_GROUPS) as CoachRole[]).some((role) => COACH_GROUPS[role].includes(key) && quality[role] !== undefined);
}

function coachFor(key: AttributeKey, quality: Partial<Record<CoachRole, number>>): number {
  for (const role of Object.keys(COACH_GROUPS) as CoachRole[]) {
    if (COACH_GROUPS[role].includes(key)) return quality[role] ?? SELF_TAUGHT;
  }
  return SELF_TAUGHT;
}

function focusMultiplier(key: AttributeKey, focus: TrainingFocus): number {
  if (focus === "balanced") return 1;
  return FOCUS_GROUPS[focus].includes(key) ? 1.8 : 0.7;
}

/**
 * One week of development: growth towards the player's ceiling (fast when
 * young, driven by work ethic, coaching and training focus), decline in power
 * and nerve after the peak, and experience that keeps the mind sharpening.
 * Changes build up as fractional progress and tick over a whole point at a time.
 * Returns the attributes that changed this week.
 */
export function developWeek(wp: WorldPlayer, inputs: DevelopmentInputs, rng: Rng): { key: AttributeKey; delta: number }[] {
  const p = wp.player;
  const dev = wp.development;
  const a = p.attributes;
  const changes: { key: AttributeKey; delta: number }[] = [];
  const learn = (a.professionalism + a.coachability) / (2 * TOUR_AVERAGE);
  // A Plateau player stops growing half a point above where he is from 25.
  const ceiling = has(wp, "plateau") && p.age >= 25 ? Math.min(dev.potential, overall(p) + 0.5) : dev.potential;
  const gap = clamp((ceiling - overall(p)) / 4, -0.5, 1.5);
  const peak = effectivePeak(wp);
  const growAge = ageGrowth(p.age, peak) * (has(wp, "early-peaker") && p.age <= 24 ? 1.25 : 1);
  const yearsPast = Math.max(0, p.age - peak - (has(wp, "early-peaker") ? 1 : 2));
  const intensity = INTENSITY[inputs.plan.intensity].growth;
  const injured = wp.injury !== null;
  const selfTaught = has(wp, "self-taught");
  const coachQ = (key: AttributeKey) => {
    const q = coachFor(key, inputs.coachQuality);
    // Self-taught players do well alone and take less from a coach.
    return selfTaught ? (q === SELF_TAUGHT && !hasCoach(key, inputs.coachQuality) ? SELF_TAUGHT * 2 : q * 0.8) : q;
  };
  const fitnessQ = inputs.coachQuality.fitness ?? SELF_TAUGHT;
  const boost = (wp.comebackWeeks ? 1.5 : 1) * (inputs.mentored ? 1.1 : 1);

  for (const key of TRAINABLE) {
    if (FIXED.includes(key)) continue;
    const coach = 0.6 + coachQ(key) / 20;
    let delta = BASE_GROWTH * growAge * gap * learn * coach * focusMultiplier(key, inputs.plan.focus) * intensity * boost;
    if (has(wp, "sponge") && inputs.plan.focus !== "balanced" && FOCUS_GROUPS[inputs.plan.focus].includes(key)) delta *= 1.25;
    if (has(wp, "gym-rat") && (key === "stamina" || key === "flexibility")) delta *= 1.3;
    if (inputs.boost && delta > 0) delta *= key === "stamina" || key === "flexibility" ? inputs.boost.fitness : inputs.boost.training;
    if (injured) delta *= 0.3;

    // Ageing: power goes first, then the short putts; fitness work slows it.
    if (yearsPast > 0) {
      const slow = clamp(1 - (fitnessQ - SELF_TAUGHT) / 30, 0.5, 1) * (inputs.plan.focus === "fitness" ? 0.7 : 1) * (has(wp, "ageless") ? 0.5 : 1);
      if (PHYSICAL.includes(key)) delta -= 0.0015 * yearsPast * slow;
      else if (key === "shortPutts") delta -= 0.0009 * yearsPast;
      else if (!EXPERIENCE.includes(key)) delta -= 0.0006 * yearsPast;
    }
    // Experience: the mind keeps improving into the forties, faster when competing,
    // up to his ceiling (without one, the whole tour drifts to 16s in composure).
    if (EXPERIENCE.includes(key) && p.age < 46 && a[key] < Math.ceil(dev.potential)) delta += 0.0015 * (inputs.competed ? 1.3 : 1) * (inputs.competed && has(wp, "tournament-learner") ? 2 : 1);

    delta += rng.normal(0, 0.01);
    const cap = Math.min(20, Math.ceil(dev.potential + STRENGTH_ROOM));
    let prog = (dev.progress[key] ?? 0) + delta;
    if (prog >= 1) {
      if (a[key] < cap) {
        a[key]++;
        changes.push({ key, delta: 1 });
      }
      prog -= 1;
    } else if (prog <= -1) {
      if (a[key] > 1) {
        a[key]--;
        changes.push({ key, delta: -1 });
      }
      prog += 1;
    }
    dev.progress[key] = Math.round(prog * 1000) / 1000 || 0; // avoid saving -0
  }
  return changes;
}

/** Attribute change since the season started, for display. */
export function seasonChange(wp: WorldPlayer): Partial<Record<AttributeKey, number>> {
  const out: Partial<Record<AttributeKey, number>> = {};
  for (const k of VISIBLE_ATTRIBUTES) {
    const d = wp.player.attributes[k] - wp.development.seasonStart[k];
    if (d !== 0) out[k] = d;
  }
  return out;
}

/** What his coaches think his ceiling is, as an overall level (1-20), blurred by their quality. */
export function potentialEstimate(wp: WorldPlayer, coachQuality: number, rng: Rng): number {
  const noise = rng.normal(0, Math.max(0.3, (20 - coachQuality) / 10));
  // The hype around a junior fools other people's scouts, not his own coaches.
  const hype = !wp.client && has(wp, "hyped-junior") ? 1.5 : 0;
  return clamp(wp.development.potential + noise + hype, 1, 20);
}

/** The same estimate as 1-5 stars. */
export const ceilingStars = (level: number): number => clamp(Math.round(((level - 8) / 10) * 5 * 2) / 2, 0.5, 5);

/** What his coaches think his ceiling is: 1-5 stars, blurred by their quality. */
export function ceilingEstimate(wp: WorldPlayer, coachQuality: number, rng: Rng): number {
  return ceilingStars(potentialEstimate(wp, coachQuality, rng));
}

export const snapshot = (a: Attributes): Attributes => ({ ...a });
export { STRENGTH_ROOM };
