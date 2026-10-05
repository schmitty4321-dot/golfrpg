import { brandLift, followerLift } from "./showcase";
import { hiredStaffer, sponsorBoost } from "./market";
import { clamp, type Rng } from "../engine";
import { rankMap } from "./points";
import { absWeek, type SponsorCategory, type SponsorOffer, type World, type WorldPlayer } from "./types";
import { bonusMultiplier, offerChanceMultiplier, sponsorValueMultiplier } from "./traits";
import { hasSkill } from "./staffSkills";

export const BRANDS: Record<SponsorCategory, string[]> = {
  equipment: ["Talon Golf", "Kinetic Clubs", "Forged Theory", "Arcline", "Vantage Irons", "Northstar Golfworks", "TrueLine Putters", "Apex Forge", "Caddis Golf Lab"],
  apparel: ["Northcourse", "Linksmith", "Grayson & Pike", "Fescue Athletic", "Hollow Oak", "Sunday Standard", "Turnberry Thread", "Range & Row", "Evergreen Sport"],
  watch: ["Meridian Watches", "Calloway & Sons", "Stellan", "Horologe Nine", "Crown & Caddie", "Tempo House", "Alder Chronograph", "Westhaven Time"],
  financial: ["Harbor Trust", "Crestline Bank", "Ironbridge Wealth", "Summit Capital", "Fairway Mutual", "Oakmont Private Bank", "Pinnacle Partners", "Blue Heron Credit"],
  automotive: ["Veloce Motors", "Granite Trucks", "Aurora EV", "Bayshore Autos", "Halcyon Motors", "Ridgeline Automotive", "Cobalt Electric", "Sterling Road"],
  beverage: ["Clearwater Springs", "Ridgeback Coffee", "Tidal Sports Drink", "Orchard Tea", "Citrus Nine", "Blue Flag Hydration", "Turnhouse Coffee", "Green Jacket Tonic"],
};
/** Annual value range at the very top of the game, by category. */
const TOP_VALUE: Record<SponsorCategory, number> = {
  equipment: 5_000_000,
  apparel: 2_500_000,
  watch: 1_200_000,
  financial: 1_500_000,
  automotive: 900_000,
  beverage: 500_000,
};
const MARKET: Record<string, number> = { USA: 1.2, Japan: 1.3, Korea: 1.15, England: 1.05, Australia: 1.05 };

/**
 * How attractive a player is to sponsors, 0-1: world ranking, recent
 * wins, youth, home market, and your agency's pull.
 */
export function marketability(world: World, wp: WorldPlayer): number {
  const rank = rankMap(world).get(wp.player.id) ?? 400;
  const rankScore = rank <= 10 ? 1 : rank <= 50 ? 0.7 : rank <= 125 ? 0.45 : rank <= 250 ? 0.2 : 0.08;
  const recentWins = wp.career.results.filter((r) => r.position === 1 && r.season >= world.season - 1).length;
  const youth = wp.player.age <= 25 ? 1.15 : wp.player.age >= 40 ? 0.85 : 1;
  const market = MARKET[wp.player.nationality] ?? 1;
  const agency = 0.8 + world.agency.reputation / 250;
  // The press and his choices (inbox.ts) add or take away a little.
  return clamp(rankScore * youth * market * agency + recentWins * 0.08 + (wp.client?.buzz ?? 0), 0.02, 1.4);
}

/** What the marketing lead's skills add to an offer: their category, the underdog, the overseas client. */
function marketingSkills(world: World, wp: WorldPlayer, category: SponsorCategory): number {
  let x = 1;
  if (hasSkill(world, "category-expert") && (category === "equipment" || category === "apparel")) x *= 1.25;
  if (hasSkill(world, "underdog-seller") && (rankMap(world).get(wp.player.id) ?? 999) > 100) x *= 1.3;
  if (hasSkill(world, "global-reach") && wp.player.nationality !== "USA") x *= 1.2;
  return x;
}

/** Tries to generate a new offer for a client; at most one per category at a time. */
export function maybeOffer(world: World, wp: WorldPlayer, rng: Rng, chance: number): SponsorOffer | null {
  const c = wp.client;
  // Amateurs can't take endorsement money.
  if (!c || wp.career.status === "amateur" || !rng.chance(chance)) return null;
  const taken = new Set([...c.sponsors, ...c.offers].map((s) => s.category));
  const open = (Object.keys(BRANDS) as SponsorCategory[]).filter((k) => !taken.has(k));
  if (open.length === 0) return null;
  const category = rng.pick(open);
  const m = marketability(world, wp);
  const scale = Math.min(1, m);
  const annualValue = Math.round((TOP_VALUE[category] * scale * scale * (0.7 + rng.next() * 0.6) * sponsorValueMultiplier(world, wp, category) * sponsorBoost(world) * brandLift(world, category) * followerLift(world, wp) * marketingSkills(world, wp, category)) / 5_000) * 5_000;
  if (annualValue < 20_000) return null;
  const offer: SponsorOffer = {
    id: `sp${world.season}-${world.week}-${wp.player.id}-${category}`,
    sponsor: rng.pick(BRANDS[category]),
    category,
    annualValue,
    winBonus: Math.round((annualValue * 0.1 * bonusMultiplier(wp)) / 1_000) * 1_000,
    majorBonus: Math.round((annualValue * 0.3 * bonusMultiplier(wp)) / 1_000) * 1_000,
    untilSeason: world.season + rng.int(0, 2),
    expiresAbsWeek: absWeek(world.season, world.week) + 3 + (hasSkill(world, "never-lapse") ? 3 : 0),
  };
  c.offers.push(offer);
  world.news.unshift(`${offer.sponsor} offers ${wp.player.name} a ${category} deal worth $${annualValue.toLocaleString("en-US")} a season.`);
  return offer;
}

export function acceptSponsor(world: World, clientId: string, offerId: string): void {
  const c = world.players[clientId]?.client;
  const offer = c?.offers.find((o) => o.id === offerId);
  if (!c || !offer) throw new Error("no such offer");
  c.offers = c.offers.filter((o) => o.id !== offerId);
  const { expiresAbsWeek: _drop, ...deal } = offer;
  void _drop;
  c.sponsors.push(deal);
  c.happiness = clamp(c.happiness + 5, 0, 100);
  world.news.unshift(`${world.players[clientId]!.player.name} signs with ${offer.sponsor}.`);
}

export function declineSponsor(world: World, clientId: string, offerId: string): void {
  const c = world.players[clientId]?.client;
  if (c) c.offers = c.offers.filter((o) => o.id !== offerId);
}

/** Weekly: pay instalments, lapse old offers, and maybe a new offer (likelier after a good week). */
export function sponsorWeek(world: World, wp: WorldPlayer, rng: Rng, goodWeek: boolean, seasonWeeks: number, extraChance = 0): number {
  const c = wp.client;
  if (!c) return 0;
  const now = absWeek(world.season, world.week);
  // Offers nobody answered: a marketing lead closes them at full value; otherwise he
  // sometimes signs on his own, at the sponsor's lower fallback terms.
  for (const o of c.offers.filter((x) => x.expiresAbsWeek < now)) lapseOffer(world, wp, o, rng);
  c.offers = c.offers.filter((o) => o.expiresAbsWeek >= now);
  const pay = c.sponsors.reduce((s, x) => s + x.annualValue / seasonWeeks, 0);
  maybeOffer(world, wp, rng, Math.min(0.95, (goodWeek ? 0.5 : world.week === 1 ? 0.8 : 0.05) * offerChanceMultiplier(wp) * (hasSkill(world, "deal-flow") ? 1.3 : 1) + extraChance));
  return Math.round(pay);
}

/** A lapsed sponsor share he takes without you: this much of the offer's value. */
export const SELF_SIGNED_SHARE = 0.7;
const SELF_SIGN_CHANCE = 0.5;

/** An offer that ran out unanswered. */
function lapseOffer(world: World, wp: WorldPlayer, o: SponsorOffer, rng: Rng): void {
  const c = wp.client!;
  const { expiresAbsWeek: _drop, ...deal } = o;
  void _drop;
  const lead = hiredStaffer(world, "marketing");
  if (lead) {
    c.sponsors.push(deal);
    world.news.unshift(`${lead.name} closes ${wp.player.name}'s ${o.category} deal with ${o.sponsor} while you were busy.`);
    return;
  }
  if (!rng.chance(SELF_SIGN_CHANCE)) return;
  const k = SELF_SIGNED_SHARE;
  c.sponsors.push({ ...deal, annualValue: Math.round((deal.annualValue * k) / 1000) * 1000, winBonus: Math.round(deal.winBonus * k), majorBonus: Math.round(deal.majorBonus * k) });
  world.news.unshift(`${wp.player.name} signs a smaller ${o.category} deal with ${o.sponsor} himself after the offer went unanswered.`);
}

/** Win and major bonuses owed for a result. */
export function sponsorBonus(wp: WorldPlayer, position: number, major: boolean): number {
  if (!wp.client || position !== 1) return 0;
  return wp.client.sponsors.reduce((s, x) => s + x.winBonus + (major ? x.majorBonus : 0), 0);
}

/** Deals that have run their course end at the season's close. */
export function expireSponsors(world: World, wp: WorldPlayer): void {
  if (!wp.client) return;
  wp.client.sponsors = wp.client.sponsors.filter((s) => s.untilSeason > world.season);
  wp.client.offers = [];
}
