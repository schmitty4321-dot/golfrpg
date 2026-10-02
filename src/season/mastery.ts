/**
 * Bronze, silver and gold: traits and archetypes grow with use. Every
 * positive (or two-edged) trait tied to golf skills, and the player's
 * archetype, has its own mastery that builds week by week (more in a week he
 * competes, double when his training works on those skills). A silver one
 * makes its skills grow 10% faster, a gold one 20%: he reaches his ceiling
 * sooner, but the ceiling itself doesn't move.
 *
 * Silver takes about two seasons of regular play and gold about five; a
 * player who trains the right things gets there quicker.
 */
import { APPLIED_SKEW, TRAIT_BY_ID, traitsOf, type AttributeKey } from "../engine";
import { FOCUS_GROUPS } from "./development";
import type { TrainingFocus, WorldPlayer } from "./types";

export type Tier = "bronze" | "silver" | "gold";
export const SILVER_AT = 60;
export const GOLD_AT = 160;
export const TIER_GROWTH: Record<Tier, number> = { bronze: 1, silver: 1.1, gold: 1.2 };
/**
 * Every player's growth, scaled so the tour as a whole still develops at the
 * real rate (the realism report's age curve) once silver and gold speed some
 * skills up: tiers spread growth towards the mastered skills rather than add to it.
 */
export const MASTERY_CENTRE = 0.95;
/** The key archetype mastery is kept under. */
export const ARCHETYPE_KEY = "archetype";

/** The skills each trait is about. Traits not listed (schedule, personality, commercial, ...) have no tiers. */
export const TRAIT_SKILLS: Record<string, readonly AttributeKey[]> = {
  "bombers-licence": ["drivingDistance"],
  "fairway-finder": ["drivingAccuracy"],
  "long-iron-artist": ["longIrons"],
  "wedge-wizard": ["wedges"],
  "two-way-shaper": ["shotShaping"],
  "one-shape-wonder": ["drivingAccuracy"],
  flusher: ["midIrons"],
  "par5-predator": ["drivingDistance", "fairwayWoods"],
  "par3-specialist": ["midIrons"],
  stinger: ["trajectoryControl"],
  "rescue-merchant": ["fairwayWoods"],
  "rough-rider": ["longIrons", "midIrons"],
  "ground-game": ["trajectoryControl"],
  magician: ["creativity", "chipping"],
  "sand-saver": ["bunkerPlay"],
  "three-foot-robot": ["shortPutts"],
  "speed-slot": ["speedControl"],
  "slow-green-grinder": ["lagPutting"],
  "long-range-sniper": ["greenReading", "lagPutting"],
  "grain-reader": ["greenReading"],
  "up-and-down": ["chipping", "pitching"],
  "ice-water": ["composure", "sundayNerves"],
  grinder: ["bounceBack"],
  "cut-line-specialist": ["focus"],
  "major-mindset": ["composure"],
  "short-memory": ["bounceBack"],
  perfectionist: ["focus"],
  "momentum-rider": ["aggression"],
  "playoff-assassin": ["sundayNerves"],
  "links-lifer": ["windTolerance"],
  "desert-rat": ["distanceControl"],
  "second-shot-lover": ["distanceControl"],
  "poa-survivor": ["shortPutts"],
  "mile-high": ["distanceControl"],
  "resort-bandit": ["wedges"],
  "loves-a-brute": ["courseManagement"],
  "birdie-fest": ["wedges"],
  "rain-man": ["windTolerance"],
  "clutch-gene": ["sundayNerves", "composure"],
  "sunday-red": ["sundayNerves"],
  "generational-striker": ["midIrons", "longIrons"],
  "major-monster": ["composure"],
};

export const tierOf = (points: number): Tier => (points >= GOLD_AT ? "gold" : points >= SILVER_AT ? "silver" : "bronze");

/** The skills an archetype is built on: the ones its shape raises. */
export function archetypeSkills(wp: WorldPlayer): AttributeKey[] {
  const id = wp.player.archetype;
  if (!id) return [];
  return (Object.entries(APPLIED_SKEW[id] ?? {}) as [AttributeKey, number][]).filter(([, v]) => v > 0).map(([k]) => k);
}

/** Everything with a tier for this player: key (trait id or "archetype") and its skills. */
export function masteries(wp: WorldPlayer): { key: string; skills: readonly AttributeKey[] }[] {
  const out: { key: string; skills: readonly AttributeKey[] }[] = [];
  const arch = archetypeSkills(wp);
  if (arch.length) out.push({ key: ARCHETYPE_KEY, skills: arch });
  for (const t of traitsOf(wp.player)) {
    const skills = TRAIT_SKILLS[t];
    if (skills) out.push({ key: t, skills });
  }
  return out;
}

export const masteryPoints = (wp: WorldPlayer, key: string): number => wp.mastery?.[key] ?? 0;
export const masteryTier = (wp: WorldPlayer, key: string): Tier => tierOf(masteryPoints(wp, key));

/**
 * A week's mastery: a point for competing, half for a week at home, doubled
 * for what his training focus works on. It starts when he turns professional:
 * every rookie arrives at bronze.
 */
export function masteryWeek(wp: WorldPlayer, competed: boolean, focus: TrainingFocus = "balanced"): void {
  if (wp.career.status === "amateur") return;
  const list = masteries(wp);
  if (!list.length) return;
  const base = competed ? 1 : 0.5;
  const trained = focus === "balanced" ? null : FOCUS_GROUPS[focus];
  const m = (wp.mastery ??= {});
  for (const { key, skills } of list) {
    const gain = base * (trained && skills.some((k) => trained.includes(k)) ? 2 : 1);
    m[key] = Math.round(((m[key] ?? 0) + gain) * 10) / 10;
  }
}

/** Growth multipliers by skill from silver and gold masteries (the best one counts). */
export function masteryGrowth(wp: WorldPlayer): Map<AttributeKey, number> {
  const out = new Map<AttributeKey, number>();
  if (!wp.mastery) return out;
  for (const { key, skills } of masteries(wp)) {
    const g = TIER_GROWTH[masteryTier(wp, key)];
    if (g <= 1) continue;
    for (const k of skills) out.set(k, Math.max(out.get(k) ?? 1, g));
  }
  return out;
}

/** Progress to the next tier, 0-1 (1 at gold). */
export function tierProgress(points: number): number {
  if (points >= GOLD_AT) return 1;
  return points >= SILVER_AT ? (points - SILVER_AT) / (GOLD_AT - SILVER_AT) : points / SILVER_AT;
}

/** A trait's display name by id. */
export const TRAIT_BY_ID_NAME = (id: string): string => TRAIT_BY_ID.get(id)?.name ?? id;
