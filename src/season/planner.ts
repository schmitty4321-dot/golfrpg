import { followers } from "./showcase";
/**
 * The weekly planner: a client's days before an event (Monday to Wednesday)
 * or his whole week off. Travel takes the first days (fewer with a better
 * class or the agency jet); every free day gets one activity. Rest is the
 * baseline and costs nothing; everything else trades condition, money or
 * mood for something useful.
 */
import { clamp } from "../engine";
import { afterPracticeRound } from "./practice";
import { travelDays } from "./team";
import type { Region, World, WorldPlayer } from "./types";

export type DayActivity = "rest" | "range" | "gym" | "practice" | "sponsor" | "media";

export const ACTIVITIES: Record<DayActivity, { label: string; short: string; blurb: string; condition: number; fee: number }> = {
  rest: { label: "Rest", short: "Rest", blurb: "Recover. Costs nothing.", condition: 0, fee: 0 },
  range: { label: "Range work", short: "Range", blurb: "Training this week counts 15% more.", condition: -1, fee: 0 },
  gym: { label: "Gym", short: "Gym", blurb: "Stamina and flexibility grow 30% faster this week; lowers injury risk.", condition: -1, fee: 0 },
  practice: { label: "Practice round", short: "Practice", blurb: "Learn this week's course: familiarity up before the event.", condition: -2, fee: 2_500 },
  sponsor: { label: "Sponsor day", short: "Sponsor", blurb: "Keeps sponsors sweet: a new offer is likelier, and he's paid an appearance fee.", condition: -1, fee: 0 },
  media: { label: "Media day", short: "Media", blurb: "Interviews and content: a little reputation for the agency; some players hate it.", condition: 0, fee: 0 },
};

/** Activities that make sense before an event, and in a week off. */
export const EVENT_WEEK_ACTIVITIES: DayActivity[] = ["rest", "practice", "range", "gym", "sponsor", "media"];
export const OFF_WEEK_ACTIVITIES: DayActivity[] = ["rest", "range", "gym", "sponsor", "media"];

const EVENT_DAYS = ["Mon", "Tue", "Wed"];
const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The week's days: which are travel, which are his to plan. */
export function weekDays(world: World, wp: WorldPlayer, eventRegion: Region | null): { days: string[]; travel: number } {
  if (!eventRegion) return { days: WEEK_DAYS, travel: 0 };
  return { days: EVENT_DAYS, travel: Math.min(EVENT_DAYS.length, travelDays(world, wp, eventRegion)) };
}

/** A plan fitted to the free days: missing days rest, extra days are dropped. */
export function fitPlan(plan: DayActivity[] | undefined, free: number, allowed: DayActivity[]): DayActivity[] {
  return Array.from({ length: free }, (_, i) => {
    const a = plan?.[i];
    return a && allowed.includes(a) ? a : "rest";
  });
}

/** His familiarity after n practice rounds this week. */
export function familiarityAfterPractice(wp: WorldPlayer, courseId: string, n: number): number {
  if (n <= 0) return wp.career.familiarity?.[courseId] ?? 0;
  const copy: WorldPlayer = { ...wp, career: { ...wp.career, familiarity: { ...(wp.career.familiarity ?? {}) } } };
  for (let i = 0; i < n; i++) copy.career.familiarity![courseId] = afterPracticeRound(copy, courseId);
  return copy.career.familiarity![courseId]!;
}

export const count = (plan: DayActivity[], a: DayActivity): number => plan.filter((x) => x === a).length;

/** What the plan does to his training this week (multipliers for development). */
export function trainingBoost(plan: DayActivity[]): { training: number; fitness: number; injury: number } {
  return { training: 1 + 0.15 * count(plan, "range"), fitness: 1 + 0.3 * count(plan, "gym"), injury: Math.pow(0.9, count(plan, "gym")) };
}

/** A plan's condition cost and fees, for showing before the week is played. */
export function planCost(plan: DayActivity[]): { condition: number; fees: number } {
  return plan.reduce((s, a) => ({ condition: s.condition + ACTIVITIES[a].condition, fees: s.fees + ACTIVITIES[a].fee }), { condition: 0, fees: 0 });
}

/**
 * The plan's week, once played: condition and fees, and the sponsor and
 * media days (practice rounds, range and gym are applied where they act).
 * Returns the change to his mood.
 */
export function applyPlan(world: World, wp: WorldPlayer, plan: DayActivity[]): number {
  const c = wp.client;
  if (!c) return 0;
  const cost = planCost(plan.filter((a) => a !== "practice")); // practice rounds are charged when played
  wp.player.condition = clamp(wp.player.condition + cost.condition, 0, 100);
  let mood = 0;
  const sponsors = count(plan, "sponsor");
  if (sponsors) {
    const fee = sponsors * (c.sponsors.length ? 15_000 : 5_000);
    c.finances.endorsements += fee;
    const cut = Math.round(fee * c.contract.endorsementCommission);
    c.finances.commission += cut;
    world.agency.bank += cut;
    world.agency.ledger.endorsementCommission += cut;
  }
  const media = count(plan, "media");
  if (media) {
    world.agency.reputation = clamp(world.agency.reputation + media * 0.15, 0, 100);
    c.followers = Math.round(followers(world, wp) * (1 + 0.02 * media));
    const t = wp.player.traits ?? [];
    mood += media * (t.includes("media-darling") ? 1 : t.includes("hothead") || t.includes("anonymous-grinder") ? -2 : -0.5);
  }
  return mood;
}
