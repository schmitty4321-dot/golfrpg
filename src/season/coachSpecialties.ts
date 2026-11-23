/**
 * Coach specialties: what makes one coach different from another of the same
 * rating. Each coach has one specialty from his role's list, and the better
 * ones (15 and up) a second. A specialty is never a new effect, only a boost
 * of 10-30% to one thing that coach already does, so coaching stays inside
 * today's ranges. Specialties are fixed by who the coach is (his id and the
 * world), so a candidate shows them before you hire, and nothing is saved.
 * Specialists ask more: 10% for one specialty, 25% for two.
 */
import { createRng, type AttributeKey } from "../engine";
import { mixSeed } from "./entries";
import type { Coach, CoachRole, World, WorldPlayer } from "./types";

export interface CoachSpecialty {
  role: CoachRole;
  label: string;
  blurb: string;
  /** Skills that grow faster with him, and by how much (1.25: 25% faster). */
  growth?: { keys: readonly AttributeKey[]; mult: number; underAge?: number };
}

const MENTAL: readonly AttributeKey[] = ["composure", "courseManagement", "focus", "sundayNerves", "bounceBack", "windTolerance"];

export const COACH_SPECIALTIES: Record<string, CoachSpecialty> = {
  // Swing
  "rebuild-specialist": { role: "swing", label: "Rebuild specialist", blurb: "Swing rebuilds work more often and take 4 weeks less." },
  "distance-guru": { role: "swing", label: "Distance guru", blurb: "Driving distance grows 30% faster.", growth: { keys: ["drivingDistance"], mult: 1.3 } },
  "old-pros": { role: "swing", label: "Old pros", blurb: "From 35, his long game and irons fade 25% slower." },
  // Short game
  "bunker-wizard": { role: "shortGame", label: "Bunker wizard", blurb: "Bunker play grows 30% faster.", growth: { keys: ["bunkerPlay"], mult: 1.3 } },
  "links-touch": { role: "shortGame", label: "Links touch", blurb: "Chipping and pitching grow 20% faster.", growth: { keys: ["chipping", "pitching"], mult: 1.2 } },
  // Putting
  "speed-control": { role: "putting", label: "Speed control", blurb: "Speed control and lag putting grow 25% faster.", growth: { keys: ["speedControl", "lagPutting"], mult: 1.25 } },
  "green-reader": { role: "putting", label: "Green reader", blurb: "Green reading grows 30% faster.", growth: { keys: ["greenReading"], mult: 1.3 } },
  // Mental
  closer: { role: "mental", label: "Closer", blurb: "Contending hardens his nerve 30% faster." },
  "young-minds": { role: "mental", label: "Young minds", blurb: "Under 25, his mental game grows 25% faster.", growth: { keys: MENTAL, mult: 1.25, underAge: 25 } },
  // Fitness
  "injury-prevention": { role: "fitness", label: "Injury prevention", blurb: "His work against injuries is 30% stronger." },
  longevity: { role: "fitness", label: "Longevity", blurb: "His work against ageing is 30% stronger." },
};

/** How much of a boost the two specialties that scale a coach's own work give. */
export const INJURY_PREVENTION = 1.3;
export const LONGEVITY = 1.3;
export const CLOSER = 1.3;
export const OLD_PROS = 0.75;
export const OLD_PROS_FROM = 35;
/** A rebuild specialist's swing rebuild: this many weeks shorter, and this much likelier to work. */
export const REBUILD_SPECIALIST_WEEKS = 4;
export const REBUILD_SPECIALIST_CHANCE = 0.1;

const BY_ROLE = (role: CoachRole) => Object.keys(COACH_SPECIALTIES).filter((k) => COACH_SPECIALTIES[k]!.role === role);

/** One specialty, and a second from 15 out of 20. */
export const specialtyCount = (quality: number): number => (quality >= 15 ? 2 : 1);

const hash = (id: string): number => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
};

/** A coach's specialties (fixed by who he is in this world). */
export function specialtiesOf(seed: number, coach: Pick<Coach, "id" | "role" | "quality">): string[] {
  const pool = BY_ROLE(coach.role);
  const rng = createRng(mixSeed(seed, hash(coach.id), 4409));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, specialtyCount(coach.quality));
}

/** What a specialist asks on top of a coach's going rate (a former client keeps his friend's rate). */
export function specialistPremium(seed: number, coach: Pick<Coach, "id" | "role" | "quality" | "formerClient">): number {
  if (coach.formerClient) return 1;
  return specialtiesOf(seed, coach).length >= 2 ? 1.25 : 1.1;
}

/** Every specialty among a client's coaches. */
export function clientSpecialties(world: World, wp: WorldPlayer): Set<string> {
  const out = new Set<string>();
  const staff = wp.client?.staff;
  if (!staff) return out;
  for (const id of Object.values(staff)) {
    const c = world.coaches.find((x) => x.id === id);
    if (c) for (const s of specialtiesOf(world.seed, c)) out.add(s);
  }
  return out;
}

/** Whether a client's coach in that specialty's role has it. */
export function hasSpecialty(world: World, wp: WorldPlayer | undefined, specialty: string): boolean {
  const role = COACH_SPECIALTIES[specialty]?.role;
  const id = role ? wp?.client?.staff[role] : undefined;
  const c = id ? world.coaches.find((x) => x.id === id) : undefined;
  return !!c && specialtiesOf(world.seed, c).includes(specialty);
}

/** The specialties' growth boost for one skill at his age. */
export function specialtyGrowth(specialties: ReadonlySet<string> | undefined, key: AttributeKey, age: number): number {
  if (!specialties?.size) return 1;
  let m = 1;
  for (const s of specialties) {
    const g = COACH_SPECIALTIES[s]?.growth;
    if (g && g.keys.includes(key) && (g.underAge === undefined || age < g.underAge)) m *= g.mult;
  }
  return m;
}

/** How much a development director thinks a coach's specialties are worth to this client, in quality points. */
export function specialtyValue(world: World, wp: WorldPlayer, coach: Coach): number {
  const age = wp.player.age;
  let v = 0;
  for (const s of specialtiesOf(world.seed, coach)) {
    const fits =
      (s === "young-minds" && age < 25) ||
      (s === "old-pros" && age >= OLD_PROS_FROM - 2) ||
      (s === "longevity" && age >= 32) ||
      (s === "injury-prevention" && wp.player.attributes.injuryProneness >= 12) ||
      (s === "distance-guru" && wp.player.attributes.drivingDistance < 12);
    v += fits ? 1.5 : 0.5;
  }
  return v;
}
