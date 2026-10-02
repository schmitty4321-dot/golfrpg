import {
  ARCHETYPES,
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
import { MASTERY_CENTRE, masteryGrowth } from "./mastery";
import type { CoachRole, Development, Intensity, TrainingFocus, TrainingPlan, WinterProgram, WorldPlayer } from "./types";
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

/**
 * Growth per week at full speed, for every player. Unlike the old model a player
 * doesn't rush at his ceiling: he grows at the pace his week sets
 * (Data Golf: about +0.2 of overall a year from 23 for a typical pro, +0.6
 * for a well-run one) and only slows in the last point below it, so whether
 * he gets there before his peak age is up to you.
 */
const CLIENT_GROWTH = 0.0038;
/** Only the gifted race ahead: extra growth for an amateur per point of ceiling above PRODIGY_FROM. */
const PRODIGY_RATE = 0.5;
const PRODIGY_FROM = 13.5;
/** A strength can sit this far above the player's overall ceiling. */
const STRENGTH_ROOM = 4;

/** A hidden ceiling for a player, by age: young players have room to grow. */
export function initialPotential(p: Player, rng: Rng): number {
  const now = overall(p);
  const room = p.age <= 22 ? Math.min(4.5, Math.abs(rng.normal(2.5, 1.3))) : p.age <= 27 ? Math.min(3, Math.abs(rng.normal(1.5, 0.9))) : Math.max(0, rng.normal(0.3, 0.5));
  // A generational talent is about 17: the very best seasons on record, not beyond.
  return Math.round(Math.min(Math.max(now, MAX_POTENTIAL), now + room + archetypeCeiling(p)) * 10) / 10;
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

/** Extra ceiling some archetypes carry (a Wunderkind's). */
export const archetypeCeiling = (p: Player): number => (p.archetype ? ARCHETYPES[p.archetype].ceiling ?? 0 : 0);

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

/** Growth multiplier from age: fast when young, tapering into the peak, none after it. */
function ageGrowth(age: number, peak: number): number {
  // Data Golf (players' strokes gained by age, 2026): about +0.7 of overall a year up to
  // 21, +0.35 in the early twenties, +0.2 in the mid-twenties, then flat at the peak.
  const before = peak - age;
  // Mid-career growth holds up until close to the peak, then turns (Data Golf: +0.22 a year
  // at 26-28, then about -0.12 from 29).
  if (before >= 8) return 3;
  if (before >= 5) return 1.7;
  if (before >= 2) return 0.9;
  if (before >= 1) return 0.6;
  return 0;
}

/**
 * Ageing, per year past the peak. Data Golf's careers (2026) slip about 0.08
 * strokes a round a year from 30 to 36 and 0.2 from 37: about 0.17 and 0.4
 * of overall here. So it bites from the first year past the peak, then
 * steepens, capped so a 45-year-old fades rather than collapses.
 */
const declineYears = (yearsPast: number): number =>
  yearsPast > 0 ? DECLINE_ONSET + DECLINE_PER_YEAR * yearsPast + LATE_DECLINE * Math.max(0, yearsPast - LATE_FROM) : 0;
/**
 * Decline from the first year past the peak, steepening steadily (Data Golf, mean change from
 * each age to the next: about -0.11 at 29-31, -0.16 at 32-34, -0.2 at 35-37, -0.24 at 38-41).
 * Set a little above those figures: players who fade lose their cards and retire, so the
 * survivors measured decline less than the formula.
 */
const DECLINE_ONSET = 5.6;
const DECLINE_PER_YEAR = 0.15;
const LATE_DECLINE = 0;
const LATE_FROM = 7;
const MAX_YEARS_PAST = 12;

/**
 * Your clients' growth, as additions to what a computer player gets from the
 * same weeks (coaching 40%, training 30%, tournaments 15%, the winter 15% of
 * the extra). They add rather than multiply, so stacking every lever makes a
 * well-run young client about three times as quick, not six.
 */
export const MANAGED = {
  /** A computer player's coaching factor (exempt players' implied staff of 12). */
  base: 0.6 + 12 / 20,
  /** Per point of coach quality above or below 12, up to +1 (no coach: -0.5). */
  coachPerPoint: 1 / 6,
  coachMin: -0.5,
  coachMax: 1,
  intensity: { light: -0.2, normal: 0, heavy: 0.4 } as Record<Intensity, number>,
  /** Per range day in the week's plan. */
  perRangeDay: 0.12,
  /** A week he plays an event: reps under the gun. */
  competing: 0.6,
};

/** The off-season programs: extra growth for golf skills and the body, and how fast age bites. */
export const WINTER: Record<WinterProgram, { label: string; blurb: string; golf: number; fitness: number; decline: number }> = {
  standard: { label: "Standard winter", blurb: "The usual off-season work.", golf: 0, fitness: 0, decline: 1 },
  camp: { label: "Skills camp", blurb: "Ten weeks of hard work on his game. Big gains, but he starts the season rusty.", golf: 2, fitness: 0, decline: 1 },
  fitness: { label: "Fitness block", blurb: "Gym and conditioning: stamina and flexibility, and the years bite less.", golf: 0.5, fitness: 1.5, decline: 0.4 },
  rest: { label: "Rest and recharge", blurb: "Little work, but he starts the season fresh and in form.", golf: -0.3, fitness: -0.3, decline: 1 },
};

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
  /** One of your clients: growth comes from the MANAGED budget. */
  managed?: boolean;
  /** An off-season week, and what he's doing with it. */
  winter?: WinterProgram;
  /** The agency's Performance Center: added to a client's budget. */
  facility?: number;
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
  // Everyone grows at the pace his week sets, slowing only in the last point below his ceiling.
  const gap = clamp(ceiling - overall(p), -0.5, 1);
  // A gifted amateur races towards his ceiling: real winners are often in their twenties
  // (PGA TOUR: 48% of wins), so the best prospects must arrive good, not mature at 30.
  const prodigy = wp.career.status === "amateur" ? 1 + PRODIGY_RATE * Math.max(0, ceiling - PRODIGY_FROM) : 1;
  const peak = effectivePeak(wp);
  const growAge = ageGrowth(p.age, peak) * (has(wp, "early-peaker") && p.age <= 24 ? 1.25 : 1);
  const yearsPast = Math.min(MAX_YEARS_PAST, Math.max(0, p.age - peak + (has(wp, "early-peaker") ? 1 : 0)));
  const injured = wp.injury !== null;
  const selfTaught = has(wp, "self-taught");
  const coachQ = (key: AttributeKey) => {
    const q = coachFor(key, inputs.coachQuality);
    // Self-taught players do well alone and take less from a coach.
    return selfTaught ? (q === SELF_TAUGHT && !hasCoach(key, inputs.coachQuality) ? SELF_TAUGHT * 2 : q * 0.8) : q;
  };
  const fitnessQ = inputs.coachQuality.fitness ?? SELF_TAUGHT;
  const boost = (wp.comebackWeeks ? 1.5 : 1) * (inputs.mentored ? 1.1 : 1);
  const winter = inputs.winter ? WINTER[inputs.winter] : null;
  // A client's week apart from coaching: training load, range days, competing.
  const rangeDays = inputs.boost ? (inputs.boost.training - 1) / 0.15 : 0;
  const managedWeek = MANAGED.intensity[inputs.plan.intensity] + MANAGED.perRangeDay * rangeDays + (inputs.competed && !winter ? MANAGED.competing : 0) + (inputs.facility ?? 0);
  // Asked once a week rather than once per skill.
  const sponge = has(wp, "sponge");
  const gymRat = has(wp, "gym-rat");
  const slow = yearsPast > 0 ? clamp(1 - (fitnessQ - SELF_TAUGHT) / 30, 0.5, 1) * (inputs.plan.focus === "fitness" ? 0.7 : 1) * (has(wp, "ageless") ? 0.5 : 1) * (winter?.decline ?? 1) : 1;
  const years = yearsPast > 0 ? declineYears(yearsPast) : 0;
  const experience = p.age < 46 ? 0.0015 * (inputs.competed ? 1.3 : 1) * (inputs.competed && has(wp, "tournament-learner") ? 2 : 1) : 0;
  const cap = Math.min(20, Math.ceil(dev.potential + STRENGTH_ROOM));
  // Silver and gold traits and archetypes: their skills grow faster.
  const mastered = masteryGrowth(wp);

  for (const key of TRAINABLE) {
    if (FIXED.includes(key)) continue;
    const body = key === "stamina" || key === "flexibility";
    // One model for everyone: a computer player's week is his implied coaching and his events;
    // your clients add training load, range days, winters and the Performance Center.
    const coaching = clamp((coachQ(key) - 12) * MANAGED.coachPerPoint, MANAGED.coachMin, MANAGED.coachMax);
    const work = MANAGED.base * Math.max(0.2, 1 + coaching + managedWeek + (winter ? (body ? winter.fitness : winter.golf) : 0));
    let delta = CLIENT_GROWTH * prodigy * growAge * gap * learn * work * focusMultiplier(key, inputs.plan.focus) * boost;
    if (sponge && inputs.plan.focus !== "balanced" && FOCUS_GROUPS[inputs.plan.focus].includes(key)) delta *= 1.25;
    if (gymRat && body) delta *= 1.3;
    // Range days are already in a client's budget; gym days still speed up the body.
    if (inputs.boost && delta > 0 && (body || !inputs.managed)) delta *= body ? inputs.boost.fitness : inputs.boost.training;
    if (injured) delta *= 0.3;
    if (delta > 0) delta *= (mastered.get(key) ?? 1) * MASTERY_CENTRE;

    // Ageing: power goes first, then the short putts; fitness work slows it.
    if (yearsPast > 0) {
      if (PHYSICAL.includes(key)) delta -= 0.0015 * years * slow;
      else if (key === "shortPutts") delta -= 0.0009 * years;
      else if (!EXPERIENCE.includes(key)) delta -= 0.0006 * years;
    }
    // Experience: the mind keeps improving into the forties, faster when competing,
    // up to his ceiling (without one, the whole tour drifts to 16s in composure).
    if (experience && EXPERIENCE.includes(key) && a[key] < Math.ceil(dev.potential)) delta += experience;

    delta += rng.normal(0, 0.01);
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
