/**
 * The client's own businesses, paid for from his own money (the agency's
 * investments are in investments.ts). Each has a starting cost, a result every
 * winter (a range from a loss to a return, drawn from its own seeded stream),
 * sometimes a day of his week, and an event or two in the inbox. The agency
 * takes a share of the profits only if his contract says so (a term he can
 * refuse). When he leaves, his ventures go with him into the legacy record,
 * and they're valued when he retires. Computer players don't have any.
 */
import { createRng, traceSeed } from "../engine";
import { addReputation } from "./agency";
import { amateurRanking } from "./amateurs";
import { mixSeed } from "./entries";
import { personalWealth } from "./finance";
import { qRating } from "./lifestyle";
import { followers } from "./showcase";
import { absWeek, type World, type WorldPlayer } from "./types";
import type { DayActivity } from "./planner";

export type VentureKind = "restaurant" | "apparel" | "courseDesign" | "podcast" | "techStake" | "academy";

export interface VentureDef {
  label: string;
  blurb: string;
  cost: number;
  /** The yearly result as a share of the stake, low to high. */
  returnRange: [number, number];
  /** Lift to his Q rating's target. */
  qBonus: number;
  /** A day of his week, every fourth week: media (the podcast) or business (site visits, the academy). */
  day?: Extract<DayActivity, "media" | "business">;
  /** What it's worth when he retires, as a multiple of the stake. */
  retireMultiple: number;
}

export const VENTURES: Record<VentureKind, VentureDef> = {
  restaurant: { label: "Restaurant and bar", blurb: "His name over the door back home. A coin flip, and a little fame.", cost: 400_000, returnRange: [-0.25, 0.3], qBonus: 2, retireMultiple: 0.6 },
  apparel: { label: "Apparel line", blurb: "His own clothing brand. Needs a public profile (Q 55+), and his apparel sponsor may object.", cost: 1_500_000, returnRange: [-0.15, 0.35], qBonus: 3, retireMultiple: 0.8 },
  courseDesign: { label: "Course design firm", blurb: "For a veteran with a major: steady work now, and it pays most once he retires.", cost: 800_000, returnRange: [-0.05, 0.12], qBonus: 1, day: "business", retireMultiple: 3 },
  podcast: { label: "Podcast and channel", blurb: "More followers every winter; a media day each month.", cost: 150_000, returnRange: [-0.2, 0.4], qBonus: 1, day: "media", retireMultiple: 0.5 },
  techStake: { label: "Tech startup stake", blurb: "Big and risky: it could double, or lose half.", cost: 3_000_000, returnRange: [-0.45, 0.8], qBonus: 0, retireMultiple: 1 },
  academy: { label: "Junior academy", blurb: "Costs him money; lifts the agency's name, and you get first look at the juniors from his country.", cost: 600_000, returnRange: [-0.1, 0], qBonus: 2, day: "business", retireMultiple: 0.5 },
};

export const VENTURE_KINDS = Object.keys(VENTURES) as VentureKind[];

export interface Venture {
  kind: VentureKind;
  since: number;
  /** What he has put in (the base for results and a sale). */
  stake: number;
  /** Last winter's result. */
  last?: number;
}

/** A sale brings back this share of the stake. */
export const VENTURE_SALE_SHARE = 0.6;
/** The academy's chance each winter of a junior worth a look. */
export const ACADEMY_LOOK_CHANCE = 0.3;

export const venturesOf = (wp: WorldPlayer): Venture[] => wp.client?.ventures ?? [];
export const ownsVenture = (wp: WorldPlayer, kind: VentureKind): boolean => venturesOf(wp).some((v) => v.kind === kind);

/** The Q rating lift from what he owns. */
export const ventureQ = (wp: WorldPlayer): number => venturesOf(wp).reduce((s, v) => s + VENTURES[v.kind].qBonus, 0);

/** The agency's share of his business profits under his contract (0 unless agreed). */
export const businessShare = (wp: WorldPlayer): number => wp.client?.contract.extras?.businessShare ?? 0;

const usd = (n: number) => Math.max(0, n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Why he can't start one now, or null. */
export function ventureBlock(world: World, clientId: string, kind: VentureKind): string | null {
  const wp = world.players[clientId];
  if (!wp?.client) return "He isn't your client.";
  const d = VENTURES[kind];
  if (!d) return "No such venture.";
  if (ownsVenture(wp, kind)) return "He already has one.";
  if (kind === "apparel" && qRating(world, wp) < 55) return "Needs a Q rating of 55.";
  if (kind === "courseDesign" && (wp.player.age < 35 || wp.career.careerMajors < 1)) return "For veterans (35+) with a major.";
  if (d.cost > personalWealth(wp)) return `He can't afford it: he has ${usd(personalWealth(wp))}.`;
  return null;
}

export function buyVenture(world: World, clientId: string, kind: VentureKind): void {
  const block = ventureBlock(world, clientId, kind);
  if (block) throw new Error(block);
  const wp = world.players[clientId]!;
  const c = wp.client!;
  const d = VENTURES[kind];
  (c.ventures ??= []).push({ kind, since: world.season, stake: d.cost });
  c.finances.ventures = (c.finances.ventures ?? 0) + d.cost;
  world.news.unshift(`${wp.player.name} starts a ${d.label.toLowerCase()}.`);
}

/** Closes a venture: he gets a share of the stake back. Returns what he got. */
export function sellVenture(world: World, clientId: string, kind: VentureKind, share = VENTURE_SALE_SHARE): number {
  const wp = world.players[clientId];
  const c = wp?.client;
  const v = c?.ventures?.find((x) => x.kind === kind);
  if (!wp || !c || !v) return 0;
  const back = Math.round(v.stake * share);
  c.finances.ventures = (c.finances.ventures ?? 0) - back;
  c.ventures = c.ventures!.filter((x) => x !== v);
  world.news.unshift(`${wp.player.name} closes his ${VENTURES[kind].label.toLowerCase()}.`);
  return back;
}

/** Puts more in (or, negative, is diluted). Paid from his money when positive. */
export function addToStake(wp: WorldPlayer, kind: VentureKind, amount: number, paid: boolean): void {
  const v = wp.client?.ventures?.find((x) => x.kind === kind);
  if (!v) return;
  v.stake = Math.max(0, v.stake + amount);
  if (paid && amount > 0) wp.client!.finances.ventures = (wp.client!.finances.ventures ?? 0) + amount;
}

/** The day a venture takes this week, if any (every fourth week, staggered by kind). */
export function ventureDay(world: World, wp: WorldPlayer): { kind: VentureKind; day: "media" | "business" } | null {
  for (const v of venturesOf(wp)) {
    const d = VENTURES[v.kind];
    if (d.day && (world.week + VENTURE_KINDS.indexOf(v.kind)) % 4 === 0) return { kind: v.kind, day: d.day };
  }
  return null;
}

/** His planned days with the venture's day in place of his last free one. */
export function withVentureDay(world: World, wp: WorldPlayer, plan: DayActivity[]): DayActivity[] {
  const v = ventureDay(world, wp);
  if (!v || !plan.length) return plan;
  return [...plan.slice(0, -1), v.day];
}

/**
 * Winter: each venture's result comes in (his money; the agency's share of a
 * profit if his contract has one), the podcast grows his following, and the
 * academy lifts the agency and may send you a junior from his country.
 */
export function venturesSeasonEnd(world: World): void {
  for (const id of world.clientIds) {
    const wp = world.players[id];
    const c = wp?.client;
    if (!wp || !c?.ventures?.length) continue;
    for (const v of c.ventures) {
      const d = VENTURES[v.kind];
      const rng = createRng(mixSeed(world.seed, world.season, 2501, traceSeed(id, v.kind)));
      const [lo, hi] = d.returnRange;
      const result = Math.round(v.stake * (lo + rng.next() * (hi - lo)));
      v.last = result;
      c.finances.business = (c.finances.business ?? 0) + result;
      const cut = result > 0 ? Math.round(result * businessShare(wp)) : 0;
      if (cut) {
        c.finances.commission += cut;
        world.agency.bank += cut;
        world.agency.ledger.businessShare = (world.agency.ledger.businessShare ?? 0) + cut;
      }
      if (v.kind === "podcast") c.followers = Math.round(followers(world, wp) * 1.04);
      if (v.kind === "academy") {
        addReputation(world.agency, 0.3);
        if (rng.chance(ACADEMY_LOOK_CHANCE)) academyLook(world, wp);
      }
    }
  }
}

/** First look: the best amateur from his country your scouts don't know yet. */
function academyLook(world: World, wp: WorldPlayer): void {
  const pick = amateurRanking(world)
    .slice(0, 80)
    .find((pid) => {
      const p = world.players[pid];
      return p && p.player.nationality === wp.player.nationality && !(world.agency.knowledge[pid]?.accuracy ?? 0);
    });
  if (!pick) return;
  world.agency.knowledge[pick] = { accuracy: 0.75, reports: 1, absWeek: absWeek(world.season, world.week) };
  const board = (world.agency.shortlist ??= []);
  if (!board.includes(pick)) board.push(pick);
  (world.agency.referrals ??= {})[pick] = world.season + 1;
  world.news.unshift(`${world.players[pick]!.player.name} trains at ${wp.player.name}'s academy: you get the first look. He's on your recruitment board.`);
}

/** What his ventures are worth when he retires. */
export function retirementValue(ventures: { kind: VentureKind; stake: number }[], majors: number): number {
  return Math.round(ventures.reduce((s, v) => s + v.stake * VENTURES[v.kind].retireMultiple * (v.kind === "courseDesign" ? 1 + 0.25 * majors : 1), 0));
}
