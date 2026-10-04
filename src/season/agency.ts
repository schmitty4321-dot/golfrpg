import { brandSeasonEnd, trophiesSeasonEnd } from "./showcase";
import { recordAlumnus, referralBonus } from "./legacy";
import { bidPressure } from "./rivalAgents";
import { START_TRUST, makePromises, promiseAppeal, trustOf, type PromiseKind } from "./promises";
import { negotiationBonus, rivalPoaching, shortlistAlerts } from "./market";
import { financeMood } from "./finance";
import { clamp, createRng, type Rng } from "../engine";
import { amateurRanking } from "./amateurs";
import { mixSeed } from "./entries";
import { rankMap } from "./points";
import { absWeek, type Agency, type ClientManagement, type World, type WorldPlayer } from "./types";
import { ensureGoals } from "./goals";
import { competingBid, planRivalWinters, rivalMarket } from "./rivals";
import { commissionWeight, decisionSensitivity, extensionBias, heldOutPenalty, onSigned, recruitingBonus } from "./traits";
import { cleanExtras, extrasAppeal, type DealExtras } from "./contractTerms";

export const RIVAL_AGENCIES = [
  "Apex Sports Management",
  "Fairway Global",
  "Links & Co.",
  "Pinnacle Talent",
  "Clubhouse Partners",
  "Eagle Rock Agency",
];

/** Standard terms, the kind most pros are on. */
export const STANDARD_COMMISSION = 0.1;
export const ENDORSEMENT_COMMISSION = 0.2;
/** Agency overheads per week of the season. */
export const OFFICE_COST = 2_500;
export const STARTING_BANK = 250_000;
export const STARTING_REPUTATION = 15;

/** How many clients the agency can look after: grows with reputation, and a bigger headquarters adds room. */
export const rosterLimit = (reputation: number, hq = 0): number => Math.min(8, 2 + Math.floor(reputation / 15)) + (HQ_TIERS[hq]?.roster ?? 0);

export interface HqTier {
  name: string;
  blurb: string;
  /** What moving up to it costs. */
  cost: number;
  /** Office and staff costs per week of the season. */
  office: number;
  /** Extra roster places. */
  roster: number;
  /** Reputation earned is multiplied by this. */
  reputationGain: number;
  /** Reputation the agency needs first. */
  reputation: number;
}

export const HQ_TIERS: HqTier[] = [
  { name: "Boutique office", blurb: "Two rooms and a coffee machine.", cost: 0, office: OFFICE_COST, roster: 0, reputationGain: 1, reputation: 0 },
  { name: "Regional office", blurb: "A proper front desk; players take your calls.", cost: 600_000, office: 5_000, roster: 1, reputationGain: 1.1, reputation: 25 },
  { name: "National headquarters", blurb: "A building with your name on it.", cost: 1_800_000, office: 9_000, roster: 2, reputationGain: 1.2, reputation: 45 },
  { name: "Global headquarters", blurb: "Offices on three continents.", cost: 4_500_000, office: 15_000, roster: 3, reputationGain: 1.3, reputation: 65 },
];

export const hqTier = (agency: Agency): HqTier => HQ_TIERS[agency.hq ?? 0]!;

export function newAgency(name = "Your Agency"): Agency {
  return {
    name,
    bank: STARTING_BANK,
    reputation: STARTING_REPUTATION,
    scouts: [],
    hiredScouts: [],
    scoutingQueue: [],
    knowledge: {},
    ledger: { prizeCommission: 0, endorsementCommission: 0, office: 0, scouts: 0 },
    cooldowns: {},
  };
}

export const emptyFinances = () => ({ prizeMoney: 0, endorsements: 0, caddie: 0, travel: 0, coaching: 0, commission: 0 });

export function newManagement(season: number, commission: number, years: number): ClientManagement {
  return {
    contract: { commission, endorsementCommission: ENDORSEMENT_COMMISSION, signedSeason: season, untilSeason: season + years - 1 },
    training: { focus: "balanced", intensity: "normal" },
    staff: {},
    finances: emptyFinances(),
    happiness: 70,
    sponsors: [],
    offers: [],
  };
}

export const clients = (world: World): WorldPlayer[] => world.clientIds.map((id) => world.players[id]!).filter(Boolean);
export const isClient = (world: World, id: string): boolean => world.clientIds.includes(id);

/** Rival agencies bid for every professional in a new world (see rivals.ts); the ones nobody wants are free agents. */
export function assignRivalAgents(world: World, _rng?: Rng): void {
  for (const wp of Object.values(world.players)) if (!wp.client && wp.career.status === "amateur") wp.agent = null; // amateurs don't have agents
  rivalMarket(world, { initial: true });
  planRivalWinters(world);
  for (const r of world.rivals ?? []) r.moves = [];
}

// ------------------------------------------------------------------ signing

export interface Offer {
  commission: number;
  years: number;
  /** Structure, majors rate, bonuses and a release clause (see contractTerms.ts). */
  extras?: DealExtras;
  /** What you promise him (see promises.ts): at most two. */
  promises?: PromiseKind[];
}

export interface OfferResponse {
  accepted: boolean;
  /** 0-1, as the agency would estimate it. */
  chance: number;
  message: string;
}

/**
 * The reputation a player expects of his agent, from how good he is: the
 * world top 10 want an elite agency, a player without status takes anyone.
 */
export function requiredReputation(worldRank: number): number {
  if (worldRank <= 10) return 80;
  if (worldRank <= 30) return 62;
  if (worldRank <= 60) return 45;
  if (worldRank <= 125) return 28;
  if (worldRank <= 200) return 14;
  return 4;
}

/** The reputation a player expects: by world rank, or for amateurs by the amateur ranking. */
export function expectedReputation(world: World, id: string): number {
  const wp = world.players[id];
  if (wp?.career.status === "amateur") {
    const r = amateurRanking(world).indexOf(id) + 1;
    return r > 0 && r <= 5 ? 35 : r > 0 && r <= 20 ? 20 : 8;
  }
  return requiredReputation(rankMap(world).get(id) ?? 999);
}

/** Why a player can't be approached right now, if he can't. */
/** A player this far above your agency's standing won't take the meeting. */
export const OUT_OF_LEAGUE = 30;

export function approachBlock(world: World, id: string): string | null {
  const wp = world.players[id];
  if (!wp) return "Unknown player.";
  if (wp.client) return "He's already your client.";
  const needed = expectedReputation(world, id);
  if (needed - world.agency.reputation > OUT_OF_LEAGUE) {
    return `He only talks to agencies with a bigger name (reputation around ${needed}; yours is ${Math.round(world.agency.reputation)}).`;
  }
  if (wp.agent && wp.agent.untilSeason > world.season) {
    return `He's under contract with ${wp.agent.agency} until the end of season ${wp.agent.untilSeason}. You can talk to him in his final season.`;
  }
  const until = world.agency.cooldowns[id];
  if (until !== undefined && until > absWeek(world.season, world.week)) return "He turned you down recently. Give it a few weeks.";
  if (world.clientIds.length >= rosterLimit(world.agency.reputation, world.agency.hq)) {
    return `Your agency can manage ${rosterLimit(world.agency.reputation, world.agency.hq)} clients at its reputation. Grow it, or move to a bigger headquarters, to take on more.`;
  }
  return null;
}

/** The chance a player accepts an offer (before the dice roll). */
export function acceptChance(world: World, id: string, offer: Offer): number {
  const wp = world.players[id]!;
  const a = wp.player.attributes;
  let score = world.agency.reputation - expectedReputation(world, id);
  score += (STANDARD_COMMISSION - offer.commission) * 100 * 3 * commissionWeight(wp); // each point under 10% helps
  score += recruitingBonus(world);
  score += negotiationBonus(world, "agent");
  // Ambitious players want a big-name agency; young ones like security, veterans like flexibility.
  score -= Math.max(0, a.ambition - 12) * 1.5;
  score += wp.player.age <= 25 ? (offer.years - 1) * 3 : wp.player.age >= 36 ? (1 - offer.years) * 2 : 0;
  // Someone with a rival agency is happy where he is unless you beat them.
  if (wp.agent) score -= 6;
  // A rival bidding for a free player: its name and commission count against yours.
  const bid = competingBid(world, id);
  if (bid) score -= competitionPenalty(world, wp, bid);
  // What you promise him, and a head start if one of your old players sent him.
  score += promiseAppeal(wp, rankMap(world).get(id) ?? 999, offer.promises);
  score += extrasAppeal(wp, rankMap(world).get(id) ?? 999, offer.extras, offer.commission);
  score += referralBonus(world, id);
  return clamp(1 / (1 + Math.exp(-score / 7)), 0.02, 0.97);
}

/** How much a rival's bid takes off your chances: its name against yours, and its commission against the standard. */
export function competitionPenalty(world: World, wp: WorldPlayer, bid: { agency: string; commission: number }): number {
  const rival = world.rivals?.find((r) => r.name === bid.agency);
  const rep = rival?.reputation ?? 50;
  // A hostile agent bids harder against you, a friendly one eases off.
  return (3 + Math.max(0, rep - world.agency.reputation) * 0.25 + Math.max(0, STANDARD_COMMISSION - bid.commission) * 100 * 3 * commissionWeight(wp)) * bidPressure(world, bid.agency);
}

/** Makes the offer. On a yes he becomes a client from now until the end of the contract. */
export function offerRepresentation(world: World, id: string, offer: Offer): OfferResponse {
  const block = approachBlock(world, id);
  if (block) return { accepted: false, chance: 0, message: block };
  if (offer.commission < 0.05 || offer.commission > 0.2 || offer.years < 1 || offer.years > 3) {
    return { accepted: false, chance: 0, message: "Commission must be 5-20% and the contract 1-3 seasons." };
  }
  const chance = acceptChance(world, id, offer);
  const rng = createRng(mixSeed(world.seed, world.season, world.week, 500, Number(id.replace(/\D/g, "")) || 1));
  const wp = world.players[id]!;
  if (!rng.chance(chance)) {
    world.agency.cooldowns[id] = absWeek(world.season, world.week) + 4;
    const bid = competingBid(world, id);
    const went = wp.agent ? ` and stays with ${wp.agent.agency}` : bid ? `; ${bid.agency} are offering ${Math.round(bid.commission * 100)}%` : "";
    return { accepted: false, chance, message: `${wp.player.name} turns you down${went}.` };
  }
  signClient(world, id, offer);
  makePromises(world, wp, offer.promises);
  return { accepted: true, chance, message: `${wp.player.name} signs with ${world.agency.name}!` };
}

/** A signing bonus: the agency pays it out. */
function payBonus(world: World, amount: number | undefined): void {
  if (!amount) return;
  world.agency.bank -= amount;
  world.agency.ledger.signingBonuses = (world.agency.ledger.signingBonuses ?? 0) + amount;
}

/** Weekly cost of looking after one client: admin and travel support, more for a star's entourage. */
export const SUPPORT_PER_CLIENT = 600;
export const SUPPORT_STAR_EXTRA = 900;

export function clientSupportCost(world: World): number {
  const ranks = rankMap(world);
  return clients(world).reduce((s, wp) => {
    const r = ranks.get(wp.player.id) ?? 999;
    return s + SUPPORT_PER_CLIENT + (r <= 50 ? SUPPORT_STAR_EXTRA : r <= 125 ? SUPPORT_STAR_EXTRA / 3 : 0);
  }, 0);
}

export function signClient(world: World, id: string, offer: Offer): void {
  const wp = world.players[id]!;
  // A player still on a rival's books in his final season joins you when that deal ends; we simplify and let him move now.
  wp.agent = null;
  wp.client = newManagement(world.season, offer.commission, offer.years);
  const extras = cleanExtras(offer.extras);
  if (extras) wp.client.contract.extras = extras;
  payBonus(world, extras?.signingBonus);
  world.clientIds.push(id);
  world.agency.knowledge[id] = { accuracy: 1, reports: 99, absWeek: absWeek(world.season, world.week) };
  onSigned(world, wp);
  ensureGoals(world);
  world.news.unshift(`${wp.player.name} signs with ${world.agency.name} (${Math.round(offer.commission * 100)}%, ${offer.years} season${offer.years === 1 ? "" : "s"}).`);
}

/** Offer a client in his final season a new deal; his happiness decides. */
export function extendContract(world: World, id: string, offer: Offer): OfferResponse {
  const wp = world.players[id];
  if (!wp?.client) return { accepted: false, chance: 0, message: "He isn't your client." };
  const until = world.agency.cooldowns[id];
  if (until !== undefined && until > absWeek(world.season, world.week)) return { accepted: false, chance: 0, message: "He's not ready to talk again yet." };
  const chance = extendChance(world, id, offer);
  const rng = createRng(mixSeed(world.seed, world.season, world.week, 600, Number(id.replace(/\D/g, "")) || 1));
  if (!rng.chance(chance)) {
    world.agency.cooldowns[id] = absWeek(world.season, world.week) + 4;
    return { accepted: false, chance, message: `${wp.player.name} isn't ready to commit to a new deal.` };
  }
  applyExtension(world, id, offer);
  return { accepted: true, chance, message: `${wp.player.name} agrees to stay until the end of season ${world.season + offer.years}.` };
}

/** The new deal takes effect: terms, promises and the headline. */
export function applyExtension(world: World, id: string, offer: Offer): void {
  const wp = world.players[id]!;
  const extras = cleanExtras(offer.extras);
  const { extras: _old, ...rest } = wp.client!.contract;
  wp.client!.contract = { ...rest, commission: offer.commission, untilSeason: world.season + offer.years, ...(extras ? { extras } : {}) };
  payBonus(world, extras?.signingBonus);
  makePromises(world, wp, offer.promises);
  world.news.unshift(`${wp.player.name} extends with ${world.agency.name} until the end of season ${world.season + offer.years}.`);
}

/** The chance a client accepts an extension on these terms: his mood, the commission, your name, trust and promises. */
export function extendChance(world: World, id: string, offer: Offer): number {
  const wp = world.players[id];
  if (!wp?.client) return 0;
  const score =
    wp.client.happiness -
    55 +
    (wp.client.contract.commission - offer.commission) * 100 * 3 * commissionWeight(wp) -
    Math.max(0, expectedReputation(world, id) - world.agency.reputation) * 0.5 +
    extensionBias(world, wp) +
    negotiationBonus(world, "lawyer") +
    // Promises kept build trust; broken ones make him wary of new ones.
    (trustOf(wp) - START_TRUST) * 0.25 +
    promiseAppeal(wp, rankMap(world).get(id) ?? 999, offer.promises) * (trustOf(wp) / START_TRUST) +
    extrasAppeal(wp, rankMap(world).get(id) ?? 999, offer.extras, offer.commission);
  return clamp(1 / (1 + Math.exp(-score / 7)), 0.02, 0.98);
}

export function releaseClient(world: World, id: string): void {
  const wp = world.players[id];
  if (!wp?.client) return;
  // He stays on the agency's books as an alumnus.
  recordAlumnus(world, wp);
  delete wp.client;
  wp.agent = null;
  wp.player.sgAdjust = undefined;
  wp.rebuild = null;
  world.clientIds = world.clientIds.filter((x) => x !== id);
  world.news.unshift(`${wp.player.name} leaves ${world.agency.name}.`);
}

// ------------------------------------------------------------------ happiness & reputation

/**
 * Weekly mood: results against his usual level, sponsor money, the
 * commission he pays, and whether you kept him out of an event he wanted.
 */
export function updateHappiness(wp: WorldPlayer, week: { played: boolean; sgVsExpected: number | null; heldOut: boolean }): void {
  const c = wp.client;
  if (!c) return;
  let target = 62;
  target += clamp(wp.player.form * 15, -12, 12);
  target += Math.min(10, c.sponsors.reduce((s, x) => s + x.annualValue, 0) / 150_000);
  const sensitivity = decisionSensitivity(wp);
  target -= (c.contract.commission - STANDARD_COMMISSION) * 100 * 1.5 * sensitivity;
  if (week.heldOut) target -= (15 + heldOutPenalty(wp)) * sensitivity;
  target += financeMood(wp);
  // He's happier with an agent he trusts.
  target += (trustOf(wp) - START_TRUST) * 0.05;
  c.happiness = clamp(c.happiness + (target - c.happiness) * 0.12, 0, 100);
  if (week.sgVsExpected !== null) c.happiness = clamp(c.happiness + clamp(week.sgVsExpected, -2, 2), 0, 100);
}

/** Reputation earned from a client's finish. */
export function reputationFor(position: number, madeCut: boolean, tier: string): number {
  if (!madeCut) return 0;
  if (tier === "dev") return position === 1 ? 1 : position <= 5 ? 0.3 : 0;
  const major = tier === "major";
  if (position === 1) return major ? 10 : 4;
  if (position <= 5) return major ? 3 : 1.2;
  if (position <= 10) return major ? 1.5 : 0.5;
  return 0;
}

export function addReputation(agency: Agency, amount: number): void {
  // Much harder to gain near the top: the same win is worth about a quarter as much at 70 as at 20,
  // and very little in the 90s. Losses hit at full weight.
  const gain = amount > 0 ? hqTier(agency).reputationGain * Math.max(0, 1 - agency.reputation / 105) ** 1.2 : 1;
  agency.reputation = clamp(agency.reputation + amount * gain, 0, 100);
}

/**
 * Season end for the agency business: expiring contracts are renewed only
 * if you extended them (otherwise the client walks), rival contracts churn,
 * and reputation drifts a little towards what the roster's results earned.
 */
export function agencySeasonEnd(world: World, rng: Rng): string[] {
  const departures: string[] = [];
  for (const wp of [...clients(world)]) {
    if (wp.client!.contract.untilSeason <= world.season) {
      departures.push(wp.player.name);
      // Clients walking out is noticed.
      addReputation(world.agency, -1.5);
      // He goes to the winter market, where the rivals bid for him (rivals.ts).
      releaseClient(world, wp.player.id);
    }
  }
  // Rivals circle unhappy clients; the recruitment board reports who came free.
  for (const line of [...rivalPoaching(world, rng), ...shortlistAlerts(world), ...trophiesSeasonEnd(world)]) world.news.unshift(line);
  brandSeasonEnd(world);
  // Reputation fades each winter unless results keep it up: a full roster alone holds it in the 30s.
  world.agency.reputation = clamp(world.agency.reputation * 0.92 + clients(world).length * 0.3, 0, 100);
  return departures;
}
