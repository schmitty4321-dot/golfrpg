/**
 * The moments and pressures that shape a career beyond the weekly grind:
 * breakthroughs that lift a client's ceiling, the mind hardening in
 * contention, burnout from too much work, late bloomers and busts, and a
 * season-end development report with milestones.
 */
import { clamp, type AttributeKey, type Rng } from "../engine";
import { addReputation } from "./agency";
import { MAX_POTENTIAL, overall } from "./development";
import type { World, WorldPlayer } from "./types";

// ---------------------------------------------------------------- breakthroughs

/** Moments that lift a client's ceiling the first time they happen. */
const BREAKTHROUGHS: { id: string; gain: number; text: (name: string) => string; when: (position: number, tier: string) => boolean }[] = [
  { id: "first-top5", gain: 0.2, text: (n) => `${n} has been in the mix on a Sunday now. Something has clicked.`, when: (p, t) => p <= 5 && t !== "dev" },
  { id: "first-win", gain: 0.5, text: (n) => `${n}'s first win changes how he sees himself: his ceiling has risen.`, when: (p, t) => p === 1 && t !== "dev" },
  { id: "major-contention", gain: 0.3, text: (n) => `${n} contended at a major and belonged there.`, when: (p, t) => p <= 5 && t === "major" },
  { id: "major-win", gain: 0.6, text: (n) => `A major champion: ${n} has gone to another level.`, when: (p, t) => p === 1 && t === "major" },
];

/** A client's result, checked for a breakthrough (each one happens once in a career). */
export function checkBreakthrough(world: World, wp: WorldPlayer, position: number, tier: string): void {
  const c = wp.client;
  if (!c) return;
  const done = (c.breakthroughs ??= []);
  for (const b of BREAKTHROUGHS) {
    if (done.includes(b.id) || !b.when(position, tier)) continue;
    done.push(b.id);
    wp.development.potential = Math.min(MAX_POTENTIAL + 2, wp.development.potential + b.gain);
    wp.player.form = clamp(wp.player.form + 0.2, -1, 1);
    world.news.unshift(b.text(wp.player.name));
  }
}

// ---------------------------------------------------------------- the mind under pressure

const PRESSURE_SKILLS: AttributeKey[] = ["composure", "sundayNerves", "focus"];

/** Being in contention hardens the mind: progress towards the next point of composure and nerve. */
export function pressureGrowth(wp: WorldPlayer, position: number, tier: string): void {
  if (position > 10 || tier === "dev") return;
  const amount = (position <= 3 ? 0.12 : 0.06) * (tier === "major" ? 1.5 : 1);
  for (const k of PRESSURE_SKILLS) {
    if (wp.player.attributes[k] >= Math.ceil(wp.development.potential) + 2) continue;
    wp.development.progress[k] = (wp.development.progress[k] ?? 0) + amount;
  }
}

// ---------------------------------------------------------------- burnout

/** Fatigue a week adds: training load, and more for an event. */
const LOAD: Record<string, number> = { light: 1, normal: 3, heavy: 6 };
export const BURNOUT_FROM = 60;

/** A client's week of work builds fatigue (a rest week clears a lot of it). Returns the growth multiplier. */
export function fatigueWeek(wp: WorldPlayer, played: boolean): number {
  const c = wp.client;
  if (!c) return 1;
  // A full schedule on normal training stays clear of burnout; heavy work and few rest weeks don't.
  const load = played ? LOAD[c.training.intensity]! + 3 : LOAD[c.training.intensity]! - 10;
  // Fit players carry more before it bites.
  const carry = 1 - (wp.player.attributes.stamina - 12) * 0.03;
  c.fatigue = clamp((c.fatigue ?? 0) + (load > 0 ? load * carry : load), 0, 100);
  return burnoutFactor(c.fatigue);
}

/** Growth slows once fatigue passes BURNOUT_FROM, down to half at 100. */
export const burnoutFactor = (fatigue: number): number => (fatigue <= BURNOUT_FROM ? 1 : 1 - ((fatigue - BURNOUT_FROM) / (100 - BURNOUT_FROM)) * 0.5);

/** Burnout also makes injuries likelier. */
export const burnoutInjury = (fatigue: number | undefined): number => 1 + Math.max(0, (fatigue ?? 0) - BURNOUT_FROM) / 40;

// ---------------------------------------------------------------- late bloomers and busts

/**
 * Each winter a few young players' ceilings move: hard work and good coaching
 * find more in some; injuries and poor habits take it away from others.
 */
export function bloomsAndBusts(world: World, rng: Rng): void {
  for (const wp of Object.values(world.players)) {
    if (wp.player.age > 29 || !rng.chance(0.12)) continue;
    const a = wp.player.attributes;
    let lean = (a.professionalism - 12) * 0.05 + (a.coachability - 12) * 0.03;
    if (wp.client) lean += 0.1;
    if ((wp.injury?.totalWeeks ?? 0) >= 6) lean -= 0.3;
    const shift = clamp(rng.normal(lean, 0.45), -0.8, 0.8);
    if (Math.abs(shift) < 0.2) continue;
    const before = wp.development.potential;
    wp.development.potential = clamp(before + shift, overall(wp.player), MAX_POTENTIAL + 2);
    if (wp.client) {
      world.news.unshift(
        shift > 0
          ? `${wp.player.name}'s coaches think there's more in him than they first thought.`
          : `${wp.player.name}'s coaches have lowered their expectations of him.`,
      );
    }
  }
}

// ---------------------------------------------------------------- the season's development report

export interface DevelopmentReport {
  season: number;
  from: number;
  to: number;
  milestones: string[];
}

/** Each client's season of development, with milestones, kept for the player page; a big year is good for the agency's name. */
export function developmentReports(world: World): void {
  for (const id of world.clientIds) {
    const wp = world.players[id];
    const c = wp?.client;
    if (!wp || !c) continue;
    const start = wp.development.seasonStart;
    const keys = Object.keys(start) as AttributeKey[];
    const from = Math.round(overall({ ...wp.player, attributes: start }) * 10) / 10;
    const to = Math.round(overall(wp.player) * 10) / 10;
    const milestones: string[] = [];
    for (const level of [12, 13, 14, 15, 16]) if (from < level && to >= level) milestones.push(`Reached ${level} overall`);
    if (to - from >= 0.8) milestones.push("Most improved: a big step in one season");
    const best = keys.filter((k) => wp.player.attributes[k] >= 18 && start[k] < 18);
    for (const k of best) milestones.push(`World-class ${k.replace(/([A-Z])/g, " $1").toLowerCase()}`);
    (c.devReports ??= []).push({ season: world.season, from, to, milestones });
    if (c.devReports.length > 10) c.devReports.shift();
    if (milestones.length) world.news.unshift(`${wp.player.name}'s season of development: ${milestones.join(", ")}.`);
    // An agency known for making players better draws prospects.
    if (to - from >= 0.8) addReputation(world.agency, 1.5);
  }
}
