import { brandLift, followerLift } from "./showcase";
import { hiredStaffer, sponsorBoost } from "./market";
import { clamp, type Rng } from "../engine";
import { rankMap } from "./points";
import { absWeek, type SponsorCategory, type SponsorOffer, type World, type WorldPlayer } from "./types";
import { bonusMultiplier, offerChanceMultiplier, sponsorValueMultiplier } from "./traits";
import { hasSkill } from "./staffSkills";
import { owns } from "./investments";

export const BRANDS: Record<SponsorCategory, string[]> = {
  equipment: ["Arcline", "Talon Golf", "Kinetic", "Northcourse", "Linksmith", "Hollow Oak", "Meridian", "Graystone", "Forge & Field", "Apex Union"],
  apparel: ["Sunday Standard", "Turnberry Thread", "Fairway & Co.", "Pinecrest", "Eleven Under", "Greenroom Golf", "Clubhouse Cloth", "Heritage Links", "North & Needle", "Caddie Row"],
  watch: ["Alder Chronograph", "Meridian Time", "Greenline", "Pin & Crown", "Sunday Watch Co.", "Heritage Hour", "Tourborne", "Links Standard", "Fairway Timeworks", "Longitude"],
  financial: ["Blue Heron Credit", "Caddie Capital", "Green Ledger", "First Fairway Bank", "Summit Wealth", "Harbor & Pine", "Long Game Financial", "Flagstone", "Turn House", "Pinnacle Trust"],
  automotive: ["Sterling Road", "Apex Motorworks", "Northline", "Fairway GT", "Redline Touring", "Crest Motors", "Long Drive Auto", "Meridian Performance", "Oak & Steel", "Grand Tour"],
  beverage: ["Citrus Nine", "Back Nine Brewing", "Turnhouse Coffee", "Fairway Reserve", "Sunday Soda Co.", "Pin High Spirits", "Clubhouse Tonic", "Links Lager", "The 19th Pour", "Coastal Caddie"],
};

/** Each brand's banner and tagline (public/art/sponsors/banners). */
export const BRAND_ART: Record<string, { banner: string; tagline: string }> = {
  "Arcline": { banner: "art/sponsors/banners/equipment/01-arcline.webp", tagline: "Built for the next shot" },
  "Talon Golf": { banner: "art/sponsors/banners/equipment/02-talon-golf.webp", tagline: "Command every lie" },
  "Kinetic": { banner: "art/sponsors/banners/equipment/03-kinetic.webp", tagline: "Speed shaped precisely" },
  "Northcourse": { banner: "art/sponsors/banners/equipment/04-northcourse.webp", tagline: "Engineered for control" },
  "Linksmith": { banner: "art/sponsors/banners/equipment/05-linksmith.webp", tagline: "Forged for the fairway" },
  "Hollow Oak": { banner: "art/sponsors/banners/equipment/06-hollow-oak.webp", tagline: "Tradition meets distance" },
  "Meridian": { banner: "art/sponsors/banners/equipment/07-meridian.webp", tagline: "Find your line" },
  "Graystone": { banner: "art/sponsors/banners/equipment/08-graystone.webp", tagline: "Pure strike technology" },
  "Forge & Field": { banner: "art/sponsors/banners/equipment/09-forge-field.webp", tagline: "Made to compete" },
  "Apex Union": { banner: "art/sponsors/banners/equipment/10-apex-union.webp", tagline: "Performance at every level" },
  "Sunday Standard": { banner: "art/sponsors/banners/apparel/01-sunday-standard.webp", tagline: "Play well dressed" },
  "Turnberry Thread": { banner: "art/sponsors/banners/apparel/02-turnberry-thread.webp", tagline: "Made for the final round" },
  "Fairway & Co.": { banner: "art/sponsors/banners/apparel/03-fairway-co.webp", tagline: "Quiet confidence" },
  "Pinecrest": { banner: "art/sponsors/banners/apparel/04-pinecrest.webp", tagline: "Course to clubhouse" },
  "Eleven Under": { banner: "art/sponsors/banners/apparel/05-eleven-under.webp", tagline: "Modern tour essentials" },
  "Greenroom Golf": { banner: "art/sponsors/banners/apparel/06-greenroom-golf.webp", tagline: "Ready when the cameras roll" },
  "Clubhouse Cloth": { banner: "art/sponsors/banners/apparel/07-clubhouse-cloth.webp", tagline: "Tailored for the game" },
  "Heritage Links": { banner: "art/sponsors/banners/apparel/08-heritage-links.webp", tagline: "Tradition in every stitch" },
  "North & Needle": { banner: "art/sponsors/banners/apparel/09-north-needle.webp", tagline: "Refined performance" },
  "Caddie Row": { banner: "art/sponsors/banners/apparel/10-caddie-row.webp", tagline: "The uniform of golf" },
  "Alder Chronograph": { banner: "art/sponsors/banners/watch/01-alder-chronograph.webp", tagline: "A higher measure" },
  "Meridian Time": { banner: "art/sponsors/banners/watch/02-meridian-time.webp", tagline: "Every moment matters" },
  "Greenline": { banner: "art/sponsors/banners/watch/03-greenline.webp", tagline: "Precision under pressure" },
  "Pin & Crown": { banner: "art/sponsors/banners/watch/04-pin-crown.webp", tagline: "Time for greatness" },
  "Sunday Watch Co.": { banner: "art/sponsors/banners/watch/05-sunday-watch-co.webp", tagline: "Made for the moment" },
  "Heritage Hour": { banner: "art/sponsors/banners/watch/06-heritage-hour.webp", tagline: "Built beyond seasons" },
  "Tourborne": { banner: "art/sponsors/banners/watch/07-tourborne.webp", tagline: "Tested on tour" },
  "Links Standard": { banner: "art/sponsors/banners/watch/08-links-standard.webp", tagline: "Exact by tradition" },
  "Fairway Timeworks": { banner: "art/sponsors/banners/watch/09-fairway-timeworks.webp", tagline: "Measure the pursuit" },
  "Longitude": { banner: "art/sponsors/banners/watch/10-longitude.webp", tagline: "Performance in motion" },
  "Blue Heron Credit": { banner: "art/sponsors/banners/financial/01-blue-heron-credit.webp", tagline: "Backing the long game" },
  "Caddie Capital": { banner: "art/sponsors/banners/financial/02-caddie-capital.webp", tagline: "Guidance that compounds" },
  "Green Ledger": { banner: "art/sponsors/banners/financial/03-green-ledger.webp", tagline: "Built on sound decisions" },
  "First Fairway Bank": { banner: "art/sponsors/banners/financial/04-first-fairway-bank.webp", tagline: "Your future in play" },
  "Summit Wealth": { banner: "art/sponsors/banners/financial/05-summit-wealth.webp", tagline: "Climb with confidence" },
  "Harbor & Pine": { banner: "art/sponsors/banners/financial/06-harbor-pine.webp", tagline: "A steady hand for growth" },
  "Long Game Financial": { banner: "art/sponsors/banners/financial/07-long-game-financial.webp", tagline: "Plan beyond the season" },
  "Flagstone": { banner: "art/sponsors/banners/financial/08-flagstone.webp", tagline: "A foundation for progress" },
  "Turn House": { banner: "art/sponsors/banners/financial/09-turn-house.webp", tagline: "Capital for opportunity" },
  "Pinnacle Trust": { banner: "art/sponsors/banners/financial/10-pinnacle-trust.webp", tagline: "Performance preserved" },
  "Sterling Road": { banner: "art/sponsors/banners/automotive/01-sterling-road.webp", tagline: "For a higher drive" },
  "Apex Motorworks": { banner: "art/sponsors/banners/automotive/02-apex-motorworks.webp", tagline: "Performance unleashed" },
  "Northline": { banner: "art/sponsors/banners/automotive/03-northline.webp", tagline: "Own the road ahead" },
  "Fairway GT": { banner: "art/sponsors/banners/automotive/04-fairway-gt.webp", tagline: "Touring without compromise" },
  "Redline Touring": { banner: "art/sponsors/banners/automotive/05-redline-touring.webp", tagline: "Built for the chase" },
  "Crest Motors": { banner: "art/sponsors/banners/automotive/06-crest-motors.webp", tagline: "Arrive above the rest" },
  "Long Drive Auto": { banner: "art/sponsors/banners/automotive/07-long-drive-auto.webp", tagline: "Distance in every detail" },
  "Meridian Performance": { banner: "art/sponsors/banners/automotive/08-meridian-performance.webp", tagline: "Engineered to move" },
  "Oak & Steel": { banner: "art/sponsors/banners/automotive/09-oak-steel.webp", tagline: "Strength with refinement" },
  "Grand Tour": { banner: "art/sponsors/banners/automotive/10-grand-tour.webp", tagline: "The road is yours" },
  "Citrus Nine": { banner: "art/sponsors/banners/beverage/01-citrus-nine.webp", tagline: "Brighten the back nine" },
  "Back Nine Brewing": { banner: "art/sponsors/banners/beverage/02-back-nine-brewing.webp", tagline: "Made for the turn" },
  "Turnhouse Coffee": { banner: "art/sponsors/banners/beverage/03-turnhouse-coffee.webp", tagline: "Start the round right" },
  "Fairway Reserve": { banner: "art/sponsors/banners/beverage/04-fairway-reserve.webp", tagline: "Pour something memorable" },
  "Sunday Soda Co.": { banner: "art/sponsors/banners/beverage/05-sunday-soda-co.webp", tagline: "Raise your game" },
  "Pin High Spirits": { banner: "art/sponsors/banners/beverage/06-pin-high-spirits.webp", tagline: "Celebrate the approach" },
  "Clubhouse Tonic": { banner: "art/sponsors/banners/beverage/07-clubhouse-tonic.webp", tagline: "Refresh the tradition" },
  "Links Lager": { banner: "art/sponsors/banners/beverage/08-links-lager.webp", tagline: "Brewed for golf" },
  "The 19th Pour": { banner: "art/sponsors/banners/beverage/09-the-19th-pour.webp", tagline: "Where every round finishes" },
  "Coastal Caddie": { banner: "art/sponsors/banners/beverage/10-coastal-caddie.webp", tagline: "A taste of the tour" },
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
  // The agency's fitting studio makes its clients' equipment worth more to the brands.
  if (category === "equipment" && owns(world, "fitting")) x *= 1.05;
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
  let total = 0;
  // Each deal keeps a tally of what it has paid, for the sponsorship cards.
  for (const x of wp.client.sponsors) {
    const paid = x.winBonus + (major ? x.majorBonus : 0);
    x.earned = (x.earned ?? 0) + paid;
    total += paid;
  }
  return total;
}

/** Deals that have run their course end at the season's close. */
export function expireSponsors(world: World, wp: WorldPlayer): void {
  if (!wp.client) return;
  wp.client.sponsors = wp.client.sponsors.filter((s) => s.untilSeason > world.season);
  wp.client.offers = [];
}
