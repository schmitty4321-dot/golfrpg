/**
 * The moments and pressures that shape a career beyond the weekly grind:
 * breakthroughs that lift a client's ceiling, the mind hardening in
 * contention, burnout from too much work, late bloomers and busts, a
 * season-end development report with milestones, practice targets for a
 * season, and a peak age that is only ever an estimate.
 */
import { clamp, createRng, type AttributeKey, type Rng } from "../engine";
import { addReputation } from "./agency";
import { seasonWeeks } from "./calendar";
import { GOLF_SKILLS, MAX_POTENTIAL, overall } from "./development";
import { mixSeed } from "./entries";
import { masteries } from "./mastery";
import { effectivePeak } from "./traits";
import type { World, WorldPlayer } from "./types";
import { hasSkill } from "./staffSkills";

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
export function fatigueWeek(wp: WorldPlayer, played: boolean, relief = 1): number {
  const c = wp.client;
  if (!c) return 1;
  // A full schedule on normal training stays clear of burnout; heavy work and few rest weeks don't.
  const load = played ? LOAD[c.training.intensity]! + 3 : LOAD[c.training.intensity]! - 10;
  // Fit players carry more before it bites.
  const carry = 1 - (wp.player.attributes.stamina - 12) * 0.03;
  c.fatigue = clamp((c.fatigue ?? 0) + (load > 0 ? load * carry * relief : load), 0, 100);
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
    if (wp.client) lean += 0.1 + (hasSkill(world, "hidden-gem") ? 0.15 : 0);
    if ((wp.injury?.totalWeeks ?? 0) >= 6) lean -= 0.3;
    let shift = clamp(rng.normal(lean, 0.45), -0.8, 0.8);
    // A bust detector catches it early: a client's ceiling falls only half as far.
    if (wp.client && shift < 0 && hasSkill(world, "bust-detector")) shift /= 2;
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

// ---------------------------------------------------------------- practice targets

/** Up to three skills a season, chosen in its first weeks. */
export const MAX_TARGETS = 3;
export const TARGET_SET_WEEKS = 6;
/** Mastery points a met target adds to every trait (or archetype) built on that skill. */
export const TARGET_MASTERY = 20;

export interface SkillTarget {
  key: AttributeKey;
  /** Where the skill stood (with its progress towards the next point) when the target was set. */
  from: number;
  /** The gain asked for: a full point while he's still growing, half a point once he's at his peak. */
  goal: number;
  met?: boolean;
}

export interface SkillTargets {
  season: number;
  skills: SkillTarget[];
}

const skillLevel = (wp: WorldPlayer, k: AttributeKey): number => wp.player.attributes[k] + (wp.development.progress[k] ?? 0);

/** This season's targets (last season's don't count). */
export const targetsOf = (world: World, wp: WorldPlayer): SkillTarget[] => (wp.client?.skillTargets?.season === world.season ? wp.client.skillTargets.skills : []);

/** The skills this week's training is aimed at. */
export const activeTargets = (world: World, wp: WorldPlayer): AttributeKey[] => targetsOf(world, wp).map((t) => t.key);

/** Why the targets can't be changed now, or null. */
export function targetsBlock(world: World, wp: WorldPlayer): string | null {
  if (!wp.client) return "Only your clients.";
  if (targetsOf(world, wp).length && world.week > TARGET_SET_WEEKS) return `Targets are set for the season after week ${TARGET_SET_WEEKS}.`;
  return null;
}

/** Sets a client's practice targets for the season; an empty list clears them. */
export function setSkillTargets(world: World, clientId: string, keys: AttributeKey[]): void {
  const wp = world.players[clientId];
  if (!wp?.client) throw new Error("Not a client.");
  const block = targetsBlock(world, wp);
  if (block) throw new Error(block);
  const unique = [...new Set(keys)];
  if (unique.length > MAX_TARGETS) throw new Error(`At most ${MAX_TARGETS} targets.`);
  if (unique.some((k) => !GOLF_SKILLS.includes(k as (typeof GOLF_SKILLS)[number]))) throw new Error("Targets are golf skills.");
  if (!unique.length) {
    delete wp.client.skillTargets;
    return;
  }
  const goal = wp.player.age < effectivePeak(wp) ? 1 : 0.5;
  // Targets already running keep their starting point.
  const kept = targetsOf(world, wp);
  wp.client.skillTargets = { season: world.season, skills: unique.map((key) => kept.find((t) => t.key === key) ?? { key, from: skillLevel(wp, key), goal }) };
}

/** The coaches' pick: his three weakest golf skills with room left to grow. */
export function suggestTargets(wp: WorldPlayer): AttributeKey[] {
  return [...GOLF_SKILLS]
    .filter((k) => wp.player.attributes[k] < 20)
    .sort((a, b) => wp.player.attributes[a] - wp.player.attributes[b])
    .slice(0, MAX_TARGETS);
}

export type TargetPace = "met" | "ahead" | "on track" | "behind";

/** How a target is going: the gain so far against where he should be by this week. */
export function targetProgress(world: World, wp: WorldPlayer, t: SkillTarget): { gained: number; share: number; pace: TargetPace; comment: string } {
  const gained = skillLevel(wp, t.key) - t.from;
  const share = clamp(gained / t.goal, 0, 1);
  const due = clamp(world.week / seasonWeeks(world), 0.05, 1);
  const pace: TargetPace = gained >= t.goal ? "met" : share >= due + 0.15 ? "ahead" : share >= due - 0.15 ? "on track" : "behind";
  const comment = {
    met: "Done. Whatever he adds now is a bonus.",
    ahead: "Ahead of schedule. The work is paying off.",
    "on track": "On track, if he keeps at it.",
    behind: due < 0.3 ? "Early days yet." : "Behind. A matching training focus or more range days would help.",
  }[pace];
  return { gained, share, pace, comment };
}

/** Season end: a met target adds mastery to the traits built on that skill, and goes in his development report. */
export function settleTargets(world: World): void {
  for (const id of world.clientIds) {
    const wp = world.players[id];
    const c = wp?.client;
    if (!wp || !c) continue;
    const list = targetsOf(world, wp);
    if (!list.length) continue;
    const met: AttributeKey[] = [];
    for (const t of list) {
      t.met = skillLevel(wp, t.key) - t.from >= t.goal - 1e-9;
      if (!t.met) continue;
      met.push(t.key);
      for (const m of masteries(wp)) {
        if (m.skills.includes(t.key)) (wp.mastery ??= {})[m.key] = (wp.mastery[m.key] ?? 0) + TARGET_MASTERY;
      }
    }
    const report = c.devReports?.at(-1);
    const label = (k: AttributeKey) => k.replace(/([A-Z])/g, " $1").toLowerCase();
    if (report?.season === world.season) report.milestones.push(`Practice targets: ${met.length} of ${list.length} met${met.length ? ` (${met.map(label).join(", ")})` : ""}`);
    if (met.length === list.length) world.news.unshift(`${wp.player.name} hit every practice target he set this season.`);
  }
}

// ---------------------------------------------------------------- the hidden peak

export interface PeakView {
  low: number;
  high: number;
  /** Past it and plainly declining: no doubt left. */
  exact: boolean;
}

/**
 * When a player will peak is never known for sure. His coaches give a range,
 * narrower the better they are, the longer they've watched him and the
 * nearer he gets to it; two years past it, the decline gives it away.
 */
export function peakView(wp: WorldPlayer, readerQuality: number, seasonsWatched: number, seed: number): PeakView {
  const truth = effectivePeak(wp);
  if (wp.player.age >= truth + 2) return { low: truth, high: truth, exact: true };
  let half = clamp(Math.round((20 - readerQuality) / 5), 1, 3) - Math.floor(seasonsWatched / 2);
  if (truth - wp.player.age <= 1) half = Math.min(half, 1);
  half = Math.max(0, half);
  // A fixed lean per player, so the range doesn't jump around from week to week.
  let h = 0;
  for (const ch of wp.player.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const lean = createRng(mixSeed(seed, h, 2501)).next() * 2 - 1;
  const centre = truth + Math.round(lean * half);
  return { low: centre - half, high: centre + half, exact: false };
}

/** The range as words. */
export const describePeak = (v: PeakView, age: number): string =>
  v.exact ? `${v.low} (past it)` : v.high < age ? "past it" : v.low === v.high ? `${v.low}` : `${v.low}–${v.high}`;
