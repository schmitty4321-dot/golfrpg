import { ATTRIBUTE_GROUPS, type AttributeKey } from "./attributes";
import { NATIONS } from "./nations";
import type { CourseStyle, Player } from "./types";

/**
 * Player archetypes: the shape of a player's game, meaning which skills sit
 * above or below his own overall level. A profile is balanced to zero across
 * the golf skills, so an archetype never makes a player better or worse
 * overall, only different. Traits (traits.ts) add the situational effects.
 */
export type ArchetypeId =
  | "power" | "precision" | "striker" | "shotmaker" | "wedge" | "pinseeker"
  | "shortgame" | "grinder" | "improviser" | "flatstick" | "lag"
  | "ice" | "gambler" | "closer" | "wind" | "athlete" | "oldpro" | "wunderkind" | "rangerat" | "allround";

/** What decides who gets an archetype when a player is generated. */
export interface ArchetypeContext {
  age: number;
  tier: string;
  nationality: string;
}

export interface Archetype {
  id: ArchetypeId;
  name: string;
  group: string;
  /** Badge colour. */
  color: string;
  blurb: string;
  /** Rating points above (+) or below (-) his level, as designed. */
  skew: Partial<Record<AttributeKey, number>>;
  style?: Partial<Record<CourseStyle, number>>;
  /** Extra room on his development ceiling. */
  ceiling?: number;
  /** Relative chance of this archetype for a new player (0 = not possible). */
  weight: (c: ArchetypeContext) => number;
}

const GOLF: readonly AttributeKey[] = [...ATTRIBUTE_GROUPS.longGame, ...ATTRIBUTE_GROUPS.approach, ...ATTRIBUTE_GROUPS.shortGame, ...ATTRIBUTE_GROUPS.putting];
/** Personality isn't tied to talent, so fit is judged against a typical value. */
const PERSONALITY: readonly AttributeKey[] = ["aggression", "injuryProneness", "professionalism", "ambition", "coachability"];
const TYPICAL_PERSONALITY = 10.5;

const top = (t: string) => (t === "elite" ? 1.6 : t === "tour" ? 1 : 0.45);
const look = (n: string) => NATIONS[n]?.look;
const BRITISH_ISLES = ["England", "Scotland", "Ireland", "Northern Ireland"];

export const ARCHETYPE_LIST: readonly Archetype[] = [
  { id: "power", name: "Power Player", group: "Off the tee", color: "#d9442e", blurb: "Overpowers courses and lives with the misses.",
    skew: { drivingDistance: 3, drivingAccuracy: -2, aggression: 2, wedges: 1, flexibility: 2 },
    weight: (c) => 6 * (c.age < 30 ? 1.3 : 1) * (c.nationality === "USA" ? 1.2 : 1) },
  { id: "precision", name: "Precision Player", group: "Iron play", color: "#6d4bc2", blurb: "Fairways and the fat part of every green.",
    skew: { drivingDistance: -2, drivingAccuracy: 3, courseManagement: 2, fairwayWoods: 1, aggression: -2 },
    weight: (c) => 6 * (c.age > 30 ? 1.3 : 1) },
  { id: "striker", name: "Ball-Striker", group: "Iron play", color: "#3a5f8f", blurb: "Pure contact tee to green, then a frustrating putter.",
    skew: { midIrons: 2, longIrons: 2, distanceControl: 2, shortPutts: -2, lagPutting: -1 },
    weight: (c) => 6 * (["Sweden", "Norway"].includes(c.nationality) ? 1.5 : 1) },
  { id: "shotmaker", name: "Shotmaker", group: "Iron play", color: "#2a6fc9", blurb: "Moves it both ways, high and low, on demand.",
    skew: { shotShaping: 3, trajectoryControl: 3, creativity: 2, windTolerance: 2, drivingAccuracy: -1 },
    weight: (c) => 5 * (look(c.nationality) === "latin" ? 1.5 : 1) },
  { id: "wedge", name: "Wedge Wizard", group: "Iron play", color: "#e0782f", blurb: "Inside 130 yards, he's thinking about holing it.",
    skew: { wedges: 3, pitching: 2, chipping: 2, drivingDistance: -1 },
    weight: () => 5 },
  { id: "pinseeker", name: "Pin Seeker", group: "Iron play", color: "#c2304f", blurb: "Fires at every flag and lives with the short-sided misses.",
    skew: { midIrons: 2, aggression: 2, distanceControl: 1, courseManagement: -2 },
    weight: (c) => 5 * (c.age < 28 ? 1.5 : 1) },
  { id: "shortgame", name: "Short-Game Wizard", group: "Around the greens", color: "#d4a21c", blurb: "Gets up and down from anywhere.",
    skew: { chipping: 3, pitching: 2, bunkerPlay: 2, creativity: 1, drivingDistance: -1 },
    weight: () => 5 },
  { id: "grinder", name: "Grinder", group: "Around the greens", color: "#2f8a4f", blurb: "Scraps, scrambles and never gives a shot away.",
    skew: { bounceBack: 3, composure: 2, bunkerPlay: 2, creativity: 2, drivingDistance: -2 },
    weight: (c) => 5 * (c.tier === "fringe" ? 1.5 : 1) },
  { id: "improviser", name: "Improviser", group: "Around the greens", color: "#8e44ad", blurb: "Invents shots nobody else sees, not always wisely.",
    skew: { creativity: 4, shotShaping: 1, chipping: 1, courseManagement: -1, focus: -1 },
    weight: () => 4 },
  { id: "flatstick", name: "Flatstick", group: "On the greens", color: "#1f6b45", blurb: "Holes everything; the long game just has to get him there.",
    skew: { shortPutts: 3, lagPutting: 2, greenReading: 2, speedControl: 2, longIrons: -2 },
    weight: (c) => 5 * (["Japan", "Korea"].includes(c.nationality) ? 2 : 1) },
  { id: "lag", name: "Lag Master", group: "On the greens", color: "#2b8fa3", blurb: "Never three-putts, rarely holes a long one.",
    skew: { lagPutting: 3, speedControl: 3, greenReading: 1, shortPutts: -1 },
    weight: (c) => 4 * (c.age > 30 ? 1.3 : 1) },
  { id: "ice", name: "Ice Man", group: "Mental game", color: "#4f9fd1", blurb: "Nothing rattles him, least of all a Sunday lead.",
    skew: { composure: 3, sundayNerves: 3, focus: 1, aggression: -1 },
    weight: (c) => 3 * top(c.tier) },
  { id: "gambler", name: "Riverboat Gambler", group: "Mental game", color: "#9b2d2d", blurb: "Birdies in bunches, and doubles too.",
    skew: { aggression: 4, bounceBack: 1, courseManagement: -2, composure: -1 },
    weight: (c) => 4 * (c.age < 28 ? 1.5 : 1) },
  { id: "closer", name: "Closer", group: "Mental game", color: "#27406b", blurb: "At his best with the lead on the back nine.",
    skew: { sundayNerves: 3, focus: 2, composure: 1 },
    weight: (c) => 2 * top(c.tier) },
  { id: "wind", name: "Wind Specialist", group: "Conditions", color: "#179e8f", blurb: "Happiest when it's blowing 25.",
    skew: { windTolerance: 4, trajectoryControl: 2 }, style: { links: 2 },
    weight: (c) => 4 * ([...BRITISH_ISLES, "Australia", "New Zealand"].includes(c.nationality) ? 3 : 1) },
  { id: "athlete", name: "Athlete", group: "Body and age", color: "#ef6a3a", blurb: "Gym-built, modern and powerful.",
    skew: { flexibility: 3, stamina: 2, drivingDistance: 2, injuryProneness: -2 },
    weight: (c) => (c.age < 32 ? 4 : 0) },
  { id: "oldpro", name: "Old Pro", group: "Body and age", color: "#9a6b3f", blurb: "The power has gone; the nous hasn't.",
    skew: { courseManagement: 3, composure: 2, bounceBack: 1, drivingDistance: -3, stamina: -1 },
    weight: (c) => (c.age >= 38 ? (c.tier === "veteran" ? 18 : 8) : 0) },
  { id: "wunderkind", name: "Wunderkind", group: "Body and age", color: "#2e9e58", blurb: "Raw, fearless and with a sky-high ceiling.",
    skew: { ambition: 3, aggression: 2, composure: -1 }, ceiling: 1,
    weight: (c) => (c.age <= 22 ? 4 : 0) },
  { id: "rangerat", name: "Range Rat", group: "Personality", color: "#6b7a2e", blurb: "First on the range, last to leave.",
    skew: { professionalism: 4, coachability: 2, distanceControl: 1, creativity: -1 },
    weight: (c) => 4 * (c.age < 27 ? 1.3 : 1) },
  { id: "allround", name: "All-Rounder", group: "Balanced", color: "#5b6b7a", blurb: "No weakness and no standout.",
    skew: {},
    weight: () => 6 },
];

export const ARCHETYPES: Readonly<Record<ArchetypeId, Archetype>> = Object.fromEntries(ARCHETYPE_LIST.map((a) => [a.id, a])) as Record<ArchetypeId, Archetype>;

/**
 * The profile as applied: the designed skew, plus one-point offsets spread over
 * the golf skills it doesn't touch, so the golf skills still sum to zero and
 * the player's overall level is unchanged.
 */
function balanced(a: Archetype, index: number): Partial<Record<AttributeKey, number>> {
  const out: Partial<Record<AttributeKey, number>> = { ...a.skew };
  let net = GOLF.reduce((s, k) => s + (a.skew[k] ?? 0), 0);
  const free = GOLF.filter((k) => a.skew[k] === undefined);
  for (let i = 0; net !== 0 && free.length; i++) {
    const k = free[(index * 3 + i) % free.length]!;
    const step = net > 0 ? -1 : 1;
    out[k] = (out[k] ?? 0) + step;
    net += step;
  }
  return out;
}

export const APPLIED_SKEW: Readonly<Record<ArchetypeId, Partial<Record<AttributeKey, number>>>> = Object.fromEntries(
  ARCHETYPE_LIST.map((a, i) => [a.id, balanced(a, i)]),
) as Record<ArchetypeId, Partial<Record<AttributeKey, number>>>;

/** An archetype for a new player, from one uniform number in [0, 1). */
export function archetypeFromRoll(u: number, c: ArchetypeContext): ArchetypeId {
  const weights = ARCHETYPE_LIST.map((a) => Math.max(0, a.weight(c)));
  const total = weights.reduce((s, w) => s + w, 0);
  let x = u * total;
  for (let i = 0; i < ARCHETYPE_LIST.length; i++) {
    x -= weights[i]!;
    if (x < 0) return ARCHETYPE_LIST[i]!.id;
  }
  return "allround";
}

/** How clearly an attribute stands out from where the player's level would put it. */
function deviation(p: Player, k: AttributeKey, level: number): number {
  return p.attributes[k] - (PERSONALITY.includes(k) ? TYPICAL_PERSONALITY : level);
}

/**
 * The archetype a player's attributes fit best, for players made before
 * archetypes existed or typed into the editor. It only reads his attributes;
 * nothing about him changes. A player with no clear shape is an All-Rounder.
 */
export function inferArchetype(p: Player): ArchetypeId {
  const level = GOLF.reduce((s, k) => s + p.attributes[k], 0) / GOLF.length;
  let best: ArchetypeId = "allround";
  let bestScore = 1.2;
  for (const a of ARCHETYPE_LIST) {
    const keys = Object.keys(a.skew) as AttributeKey[];
    if (!keys.length || a.weight({ age: p.age, tier: "tour", nationality: p.nationality }) <= 0) continue;
    const norm = Math.sqrt(keys.reduce((s, k) => s + a.skew[k]! ** 2, 0));
    const score = keys.reduce((s, k) => s + a.skew[k]! * deviation(p, k, level), 0) / norm;
    if (score > bestScore) {
      bestScore = score;
      best = a.id;
    }
  }
  return best;
}
