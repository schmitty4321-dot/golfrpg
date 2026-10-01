import { ALL_ATTRIBUTES, TOUR_AVERAGE, type AttributeKey, type Attributes } from "./attributes";
import { clamp, type Rng } from "./rng";
import { APPLIED_SKEW, ARCHETYPES, archetypeFromRoll, type ArchetypeId } from "./archetypes";
import { NATIONS, nationFromRoll } from "./nations";
import type { CourseStyle, Player } from "./types";

/** Where a generated player sits in the golf world. */
export type PlayerTier = "elite" | "tour" | "fringe" | "college" | "junior" | "veteran";

const TIERS: Record<PlayerTier, { talent: [number, number]; age: [number, number] }> = {
  elite: { talent: [15.0, 1.0], age: [24, 36] },
  tour: { talent: [12.3, 1.1], age: [23, 40] },
  fringe: { talent: [10.8, 1.0], age: [22, 38] },
  college: { talent: [9.5, 1.5], age: [18, 22] },
  junior: { talent: [7.5, 1.5], age: [14, 17] },
  veteran: { talent: [11.5, 1.2], age: [42, 50] },
};

/** Attributes that aren't really golf skill, so they don't follow talent. */
const PERSONALITY: readonly AttributeKey[] = ["aggression", "injuryProneness", "professionalism", "ambition", "coachability"];

let nextId = 1;

export interface GenerateOptions {
  tier: PlayerTier;
  archetype?: ArchetypeId;
  nationality?: string;
  /** Names already taken in this world; the new player gets a different one. */
  usedNames?: Set<string>;
}

function uniqueName(rng: Rng, nation: { first: string[]; last: string[] }, used?: Set<string>): string {
  for (let i = 0; i < 50; i++) {
    const name = `${rng.pick(nation.first)} ${rng.pick(nation.last)}`;
    if (!used?.has(name)) {
      used?.add(name);
      return name;
    }
  }
  // Pool exhausted: add a middle initial, still checking it's unique.
  for (let i = 0; ; i++) {
    const initial = String.fromCharCode(65 + ((rng.int(0, 25) + i) % 26));
    const name = `${rng.pick(nation.first)} ${initial}. ${rng.pick(nation.last)}${i > 200 ? ` ${i}` : ""}`;
    if (!used?.has(name)) {
      used?.add(name);
      return name;
    }
  }
}

export function generatePlayer(rng: Rng, opts: GenerateOptions): Player {
  const tier = TIERS[opts.tier];
  // Capped so no generated player is untouchable: the very best are +3 a round, not +4.
  const talent = Math.min(16.5, rng.normal(tier.talent[0], tier.talent[1]));
  // The archetype is drawn here (one number, as before) and chosen once his age is known.
  const archetypeRoll = opts.archetype ? 0 : rng.next();
  // Weighted like the real tour's membership (one draw, as a plain pick was).
  const nationality = opts.nationality ?? nationFromRoll(rng.next()).key;
  const nation = NATIONS[nationality] ?? NATIONS.USA!;

  const base = {} as Attributes;
  for (const k of ALL_ATTRIBUTES) base[k] = PERSONALITY.includes(k) ? rng.normal(10.5, 3) : talent + rng.normal(0, 1.4);

  const age = rng.int(tier.age[0], tier.age[1]);
  const archetype = opts.archetype ?? archetypeFromRoll(archetypeRoll, { age, tier: opts.tier, nationality });
  const skew = APPLIED_SKEW[archetype];
  const attributes = {} as Attributes;
  for (const k of ALL_ATTRIBUTES) attributes[k] = Math.round(clamp(base[k] + (skew[k] ?? 0), 1, 20));
  // Veterans have lost distance and nerve on the greens; experience helps elsewhere.
  if (age >= 40) {
    const years = age - 39;
    attributes.drivingDistance = Math.max(1, attributes.drivingDistance - Math.ceil(years / 2));
    attributes.shortPutts = Math.max(1, attributes.shortPutts - Math.ceil(years / 4));
    attributes.stamina = Math.max(1, attributes.stamina - Math.ceil(years / 3));
    attributes.courseManagement = Math.min(20, attributes.courseManagement + 2);
  }

  const styleComfort = {} as Record<CourseStyle, number>;
  for (const s of ["links", "parkland", "desert", "resort"] as CourseStyle[]) {
    styleComfort[s] = Math.round(clamp(rng.normal(TOUR_AVERAGE, 2.5), 1, 20));
  }
  if (nation.links) styleComfort.links = Math.min(20, styleComfort.links + 3);
  for (const [st, d] of Object.entries(ARCHETYPES[archetype].style ?? {}) as [CourseStyle, number][]) styleComfort[st] = Math.min(20, styleComfort[st] + d);

  return {
    id: `p${nextId++}`,
    name: uniqueName(rng, nation, opts.usedNames),
    nationality,
    age,
    attributes,
    grassPreference: rng.pick(nation.grass),
    styleComfort,
    // Data Golf (2026): the median player's best two seasons come at 29-30, and he is slipping by 30.
    peakAge: Math.round(clamp(rng.normal(29, 2), 25, 34)),
    form: clamp(rng.normal(0, 0.3), -1, 1),
    condition: Math.round(clamp(rng.normal(90, 6), 60, 100)),
    archetype,
  };
}

/** A full-strength tour event field: a few stars, a deep middle, some qualifiers. */
export function generateTourField(rng: Rng, size = 156): Player[] {
  const field: Player[] = [];
  const usedNames = new Set<string>();
  const elite = Math.round(size * 0.06);
  const fringe = Math.round(size * 0.2);
  for (let i = 0; i < elite; i++) field.push(generatePlayer(rng, { tier: "elite", usedNames }));
  for (let i = 0; i < fringe; i++) field.push(generatePlayer(rng, { tier: "fringe", usedNames }));
  while (field.length < size) field.push(generatePlayer(rng, { tier: "tour", usedNames }));
  return field;
}
