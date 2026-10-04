/**
 * What a client's development costs and what it's worth. Coaches charge a
 * weekly retainer plus a small share of his prize money; a winter program
 * has a price; he pays from his own earnings unless the agency funds some or
 * all of it. The payoff is prize money: in this world each point of overall
 * roughly doubles a season's earnings, and the agency takes its commission.
 */
import { centerTier, recordDealFunding } from "./business";
import { clamp, createRng, traceSeed } from "../engine";
import { COACH_ROLES, abilityView, coachFee, staffQuality } from "./staff";
import { GOLF_SKILLS, developWeek, overall } from "./development";
import { effectivePeak } from "./traits";
import type { CoachRole, Intensity, TrainingFocus, WinterProgram, World, WorldPlayer } from "./types";

/** Each coach he employs takes this share of his prize money, on top of the retainer. */
export const COACH_PRIZE_SHARE = 0.01;

/** How much of his development bill the agency pays. */
export type DevFunding = 0 | 0.5 | 1;
export const DEV_FUNDING: { value: DevFunding; label: string; blurb: string }[] = [
  { value: 0, label: "He pays", blurb: "Coaches and camps come out of his winnings." },
  { value: 0.5, label: "Split it", blurb: "The agency pays half. He appreciates it." },
  { value: 1, label: "Agency pays", blurb: "An investment in him: you pay it all, he keeps his winnings." },
];

export const fundingOf = (wp: WorldPlayer): DevFunding => wp.client?.devFunding ?? 0;

/** Season weeks a retainer is paid for. */
export const RETAINER_WEEKS = 41;

/**
 * Bills a development cost: the agency's share comes out of the bank (and
 * shows on its ledger), the rest goes on his books under coaching or training.
 */
export function chargeDevelopment(world: World, id: string, amount: number, kind: "coaching" | "training"): void {
  const wp = world.players[id];
  const m = wp?.client;
  if (!m || amount <= 0) return;
  const agency = Math.round(amount * fundingOf(wp));
  const his = amount - agency;
  if (agency > 0) {
    world.agency.bank -= agency;
    world.agency.ledger.development = (world.agency.ledger.development ?? 0) + agency;
    m.finances.agencyFunded = (m.finances.agencyFunded ?? 0) + agency;
    recordDealFunding(world, id, agency);
  }
  if (kind === "coaching") m.finances.coaching += his;
  else m.finances.training = (m.finances.training ?? 0) + his;
}

/** Coaches he employs (their prize-money bonus is per coach). */
export const coachesHired = (world: World, id: string): number =>
  COACH_ROLES.filter((r) => world.players[id]?.client?.staff[r] !== undefined).length;

/** A winter program's price: a camp scales with his swing coach, a fitness block with his trainer. */
export function winterCost(world: World, id: string, program: WinterProgram): number {
  const q = staffQuality(world, id);
  const base = program === "camp" ? 60_000 + clamp((q.swing ?? 8) - 8, 0, 12) * 10_000 : program === "fitness" ? 40_000 + clamp((q.fitness ?? 8) - 8, 0, 8) * 5_000 : program === "rest" ? 15_000 : 0;
  // The agency's Performance Center hosts camps for less.
  return program === "rest" ? base : Math.round((base * (1 - centerTier(world).campDiscount)) / 1_000) * 1_000;
}

/** Charges each client's winter program to the new season's books (call after the books are reset). */
export function chargeWinterPrograms(world: World): void {
  for (const id of world.clientIds) {
    const program = world.players[id]?.client?.training.winter ?? "standard";
    chargeDevelopment(world, id, winterCost(world, id, program), "training");
  }
}

/**
 * Season earnings by overall level: medians from simulated tour seasons
 * (seed 11, 2026-09-30 and again after the approach rescale on 2026-10-01),
 * smoothed and interpolated on a log scale.
 */
const EARNINGS_BY_LEVEL: [number, number][] = [
  [9.5, 220_000],
  [10.5, 450_000],
  [11.5, 780_000],
  [12.5, 1_820_000],
  [13.5, 3_250_000],
  [14.5, 6_300_000],
  [15.5, 11_500_000],
  [16.5, 21_000_000],
];

export function earningsAtLevel(level: number): number {
  const t = EARNINGS_BY_LEVEL;
  if (level <= t[0]![0]) return t[0]![1];
  if (level >= t[t.length - 1]![0]) return t[t.length - 1]![1];
  const i = t.findIndex(([l]) => l > level);
  const [l0, e0] = t[i - 1]!;
  const [l1, e1] = t[i]!;
  return Math.round(Math.exp(Math.log(e0) + ((level - l0) / (l1 - l0)) * (Math.log(e1) - Math.log(e0))));
}

export interface DevelopmentCost {
  coaches: number;
  coachBonus: number;
  winter: number;
  total: number;
  agency: number;
  client: number;
}

/** A season of his current plan: retainers, the coaches' share of the prize money he's expected to win, and the winter. */
export function developmentCost(world: World, id: string, winter: WinterProgram = world.players[id]?.client?.training.winter ?? "standard"): DevelopmentCost {
  const wp = world.players[id]!;
  const m = wp.client!;
  const coaches = COACH_ROLES.reduce((s, r) => {
    const c = world.coaches.find((x) => x.id === m.staff[r]);
    return s + (c ? coachFee(c.quality) * RETAINER_WEEKS : 0);
  }, 0);
  const coachBonus = Math.round(earningsAtLevel(overall(wp.player)) * COACH_PRIZE_SHARE * coachesHired(world, id));
  const w = winterCost(world, id, winter);
  const total = coaches + coachBonus + w;
  const agency = Math.round(total * fundingOf(wp));
  return { coaches, coachBonus, winter: w, total, agency, client: total - agency };
}

/** His development bill against what he earns: above about half, he starts to resent it. */
export function costBurden(wp: WorldPlayer): number {
  const f = wp.client?.finances;
  if (!f) return 0;
  const spend = f.coaching + (f.training ?? 0);
  return spend / Math.max(250_000, f.prizeMoney + f.endorsements);
}

/** Mood from money: a heavy bill he pays himself weighs on him; the agency paying earns goodwill. */
export function financeMood(wp: WorldPlayer): number {
  return clamp((0.5 - costBurden(wp)) * 20, -12, 0) + 4 * fundingOf(wp);
}

// ------------------------------------------------------------------ projections

export interface DevPlan {
  focus: TrainingFocus;
  intensity: Intensity;
  winter: WinterProgram;
  coachQuality: Partial<Record<CoachRole, number>>;
  /** Range days in a typical week. */
  range: number;
}

/** What he has now, a bare-bones plan, and the best money can buy. */
export function plans(world: World, id: string): Record<"current" | "basic" | "best", DevPlan> {
  const m = world.players[id]!.client!;
  const elite = Object.fromEntries(COACH_ROLES.map((r) => [r, 18])) as Record<CoachRole, number>;
  return {
    current: { focus: m.training.focus, intensity: m.training.intensity, winter: m.training.winter ?? "standard", coachQuality: staffQuality(world, id), range: 0 },
    basic: { focus: "balanced", intensity: "normal", winter: "standard", coachQuality: {}, range: 0 },
    best: { focus: "balanced", intensity: "heavy", winter: "camp", coachQuality: elite, range: 3 },
  };
}

export interface Projection {
  /** His level at the end of each coming season, up to his peak (at most 8). */
  levels: { season: number; age: number; level: number }[];
  /** The ceiling his coaches see (the projection can't pass it). */
  ceiling: number;
}

/**
 * Plays his coming seasons forward on a copy, at the ceiling his coaches
 * estimate (never the hidden one), averaged over a few runs. Assumes a full
 * schedule of about 25 events.
 */
export function projectDevelopment(world: World, id: string, plan: DevPlan, runs = 3): Projection {
  const start = world.players[id]!;
  const ceiling = abilityView(world, id).potential;
  const facility = centerTier(world).growth;
  const seasons = clamp(effectivePeak(start) - start.player.age + 1, 1, 8);
  const sums = Array<number>(seasons).fill(0);
  for (let run = 0; run < runs; run++) {
    const wp: WorldPlayer = structuredClone(start);
    wp.development.potential = ceiling;
    wp.injury = null;
    const rng = createRng(traceSeed("projection", id, String(world.season), String(run)));
    const events = clamp(wp.targetEvents ?? 25, 10, 32);
    for (let s = 0; s < seasons; s++) {
      for (let wk = 0; wk < 41; wk++) {
        const competed = Math.floor(((wk + 1) * events) / 41) > Math.floor((wk * events) / 41);
        const boost = plan.range ? { training: 1 + 0.15 * plan.range, fitness: 1 } : undefined;
        developWeek(wp, { plan: { focus: plan.focus, intensity: plan.intensity }, coachQuality: plan.coachQuality, competed, managed: true, facility, ...(boost ? { boost } : {}) }, rng);
      }
      for (let wk = 0; wk < 10; wk++) developWeek(wp, { plan: { focus: plan.focus, intensity: plan.intensity }, coachQuality: plan.coachQuality, competed: false, managed: true, winter: plan.winter, facility }, rng);
      wp.player.age++;
      sums[s]! += trueLevel(wp);
    }
  }
  // Skills tick over a whole point at a time, so measure the progress building underneath too.
  const from = trueLevel(start);
  const now = overall(start.player);
  return {
    ceiling,
    levels: sums.map((sum, s) => ({ season: world.season + s, age: start.player.age + s + 1, level: Math.min(Math.max(ceiling, now), now + sum / runs - from) })),
  };
}

/** His level counting the part-way progress towards each skill's next point. */
function trueLevel(wp: WorldPlayer): number {
  return GOLF_SKILLS.reduce((s, k) => s + wp.player.attributes[k] + (wp.development.progress[k] ?? 0), 0) / GOLF_SKILLS.length;
}

/** Seasons the payback adds up. */
export const PAYBACK_SEASONS = 3;

/**
 * The next few seasons' prize money on his plan against a bare-bones one,
 * and the agency's commission on the difference.
 */
export function payback(world: World, id: string, current: Projection, basic: Projection): { seasons: number; extraEarnings: number; extraCommission: number } {
  const wp = world.players[id]!;
  const seasons = Math.min(PAYBACK_SEASONS, current.levels.length, basic.levels.length);
  let extraEarnings = 0;
  for (let s = 0; s < seasons; s++) extraEarnings += Math.max(0, earningsAtLevel(current.levels[s]!.level) - earningsAtLevel(basic.levels[s]!.level));
  return { seasons, extraEarnings, extraCommission: Math.round(extraEarnings * (wp.client?.contract.commission ?? 0.1)) };
}
