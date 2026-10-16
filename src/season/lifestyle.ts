import { personalWealth } from "./finance";
import { clamp } from "../engine";
import { rankMap } from "./points";
import { followers } from "./showcase";
import type { World, WorldPlayer } from "./types";

/**
 * Lifestyle: the homes, cars and extras a client buys. They're personal (he pays),
 * they cost upkeep every year, and they lift his Q rating: his standing with the
 * public. Q drifts toward what he owns, and his following moves with it.
 */

export type LifestyleKind = "home" | "car" | "extra";
export interface LifestyleItem {
  id: string;
  kind: LifestyleKind;
  name: string;
  price: number;
  /** Upkeep a year, paid a fiftieth each week. */
  upkeep: number;
  /** How far this item lifts his Q rating's target. */
  qBonus: number;
  blurb: string;
}

export const LIFESTYLE_ITEMS: LifestyleItem[] = [
  { id: "home-condo", kind: "home", name: "Condo near the course", price: 350_000, upkeep: 18_000, qBonus: 6, blurb: "A tidy place a short drive from the tournament." },
  { id: "home-coastal", kind: "home", name: "Coastal house", price: 2_400_000, upkeep: 65_000, qBonus: 12, blurb: "Sea views and a long terrace for the photos." },
  { id: "home-estate", kind: "home", name: "Estate with its own course", price: 9_500_000, upkeep: 220_000, qBonus: 18, blurb: "Gated and private, and on every list." },
  { id: "car-sedan", kind: "car", name: "Luxury sedan", price: 85_000, upkeep: 6_000, qBonus: 3, blurb: "Quiet and comfortable on the tour road." },
  { id: "car-sports", kind: "car", name: "Sports coupe", price: 260_000, upkeep: 14_000, qBonus: 7, blurb: "The one parked outside the clubhouse." },
  { id: "car-supercar", kind: "car", name: "Supercar", price: 1_300_000, upkeep: 45_000, qBonus: 12, blurb: "Turns heads on every fairway." },
  { id: "extra-watches", kind: "extra", name: "Watch collection", price: 420_000, upkeep: 4_000, qBonus: 3, blurb: "Rare pieces with a story. Collectors notice." },
  { id: "extra-yacht", kind: "extra", name: "Yacht share", price: 3_200_000, upkeep: 95_000, qBonus: 8, blurb: "A boat for the off-weeks, and good for the feeds." },
];

/** Most extras a client can own at once. A home or a car replaces the one he has. */
export const MAX_EXTRAS = 2;
/** What a replaced home or car fetches, as a share of its price. */
export const TRADE_IN_SHARE = 0.5;

export const lifestyleItem = (id: string): LifestyleItem | undefined => LIFESTYLE_ITEMS.find((i) => i.id === id);

/** The items a client owns now. */
export function ownedLifestyle(wp: WorldPlayer): LifestyleItem[] {
  return (wp.client?.lifestyle ?? []).map(lifestyleItem).filter((i): i is LifestyleItem => !!i);
}

/** His standing before anything he buys: a higher ranked player starts higher. */
export function qBaseline(world: World, wp: WorldPlayer): number {
  const rank = rankMap(world).get(wp.player.id) ?? 400;
  return 40 + (rank <= 50 ? 12 : rank <= 150 ? 6 : 0);
}

/** Where his Q rating is heading: the baseline plus everything he owns. */
export function qTarget(world: World, wp: WorldPlayer): number {
  return clamp(qBaseline(world, wp) + ownedLifestyle(wp).reduce((s, i) => s + i.qBonus, 0), 0, 100);
}

/** His Q rating now (a new client starts at his baseline). */
export function qRating(world: World, wp: WorldPlayer): number {
  return wp.client?.qRating ?? qBaseline(world, wp);
}

/** Why a purchase can't be made now, or null when it can. */
export function lifestyleBlock(world: World, clientId: string, itemId: string): string | null {
  const wp = world.players[clientId];
  if (!wp?.client) return "He isn't your client.";
  const item = lifestyleItem(itemId);
  if (!item) return "No such item.";
  if ((wp.client.lifestyle ?? []).includes(itemId)) return "He already owns it.";
  const old = item.kind === "extra" ? undefined : ownedLifestyle(wp).find((i) => i.kind === item.kind);
  const cost = item.price - (old ? Math.round(old.price * TRADE_IN_SHARE) : 0);
  if (cost > personalWealth(wp)) return `He can't afford it: he has ${Math.max(0, personalWealth(wp)).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}.`;
  if (item.kind === "extra" && ownedLifestyle(wp).filter((i) => i.kind === "extra").length >= MAX_EXTRAS) return "Two extras at most: sell one to make room.";
  return null;
}

/**
 * Buys an item for the client. A home or a car he already has is traded in for half
 * its price. Extras stack, up to MAX_EXTRAS.
 */
export function buyLifestyle(world: World, clientId: string, itemId: string): void {
  const block = lifestyleBlock(world, clientId, itemId);
  if (block) throw new Error(block);
  const wp = world.players[clientId]!;
  const c = wp.client!;
  const item = lifestyleItem(itemId)!;
  const owned = (c.lifestyle ??= []);
  let credit = 0;
  if (item.kind !== "extra") {
    const old = ownedLifestyle(wp).find((i) => i.kind === item.kind);
    if (old) {
      owned.splice(owned.indexOf(old.id), 1);
      credit = Math.round(old.price * TRADE_IN_SHARE);
      world.news.unshift(`${wp.player.name} trades his ${old.name} in for a ${item.name}.`);
    }
  }
  owned.push(itemId);
  c.finances.lifestyle = (c.finances.lifestyle ?? 0) + item.price - credit;
  if (!credit) world.news.unshift(`${wp.player.name} buys a ${item.name}.`);
}

/**
 * Weekly: Q drifts a tenth of the way toward its target. His following drifts toward the
 * level his Q supports (about 20k at Q 40, doubling every ten points), so Q lifts the
 * following without compounding it. Upkeep is paid a fiftieth each week.
 */
export function lifestyleWeek(world: World): void {
  for (const id of world.clientIds) {
    const wp = world.players[id];
    const c = wp?.client;
    if (!wp || !c) continue;
    const q = qRating(world, wp);
    c.qRating = Math.round((q + (qTarget(world, wp) - q) * 0.1) * 10) / 10;
    const supported = 20_000 * 10 ** ((c.qRating - 40) / 25);
    const now = followers(world, wp);
    c.followers = Math.round(now + (supported - now) * 0.02);
    const upkeep = ownedLifestyle(wp).reduce((s, i) => s + i.upkeep, 0);
    if (upkeep) c.finances.lifestyle = (c.finances.lifestyle ?? 0) + Math.round(upkeep / 52);
  }
}
