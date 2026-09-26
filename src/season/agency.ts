import { clamp, createRng, type Rng } from "../engine";
import { amateurRanking } from "./amateurs";
import { mixSeed } from "./entries";
import { rankMap } from "./points";
import { absWeek, type Agency, type ClientManagement, type World, type WorldPlayer } from "./types";

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

/** How many clients the agency can look after: grows with reputation. */
export const rosterLimit = (reputation: number): number => Math.min(8, 2 + Math.floor(reputation / 15));

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

/** Rival agencies sign most players with status; the rest are free agents. */
export function assignRivalAgents(world: World, rng: Rng): void {
  const ranks = rankMap(world);
  for (const wp of Object.values(world.players)) {
    if (wp.client) continue;
    const rank = ranks.get(wp.player.id) ?? 999;
    if (wp.career.status === "amateur") {
      wp.agent = null; // amateurs don't have agents
      continue;
    }
    // The best players are almost never without an agent.
    const represented = rng.chance(rank <= 50 ? 0.97 : wp.career.status === "none" ? 0.35 : 0.8);
    wp.agent = represented ? { agency: rng.pick(RIVAL_AGENCIES), untilSeason: world.season + rng.int(0, 2) } : null;
  }
}

// ------------------------------------------------------------------ signing

export interface Offer {
  commission: number;
  years: number;
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
  if (world.clientIds.length >= rosterLimit(world.agency.reputation)) {
    return `Your agency can manage ${rosterLimit(world.agency.reputation)} clients at its reputation. Grow it to take on more.`;
  }
  return null;
}

/** The chance a player accepts an offer (before the dice roll). */
export function acceptChance(world: World, id: string, offer: Offer): number {
  const wp = world.players[id]!;
  const a = wp.player.attributes;
  let score = world.agency.reputation - expectedReputation(world, id);
  score += (STANDARD_COMMISSION - offer.commission) * 100 * 3; // each point under 10% helps
  // Ambitious players want a big-name agency; young ones like security, veterans like flexibility.
  score -= Math.max(0, a.ambition - 12) * 1.5;
  score += wp.player.age <= 25 ? (offer.years - 1) * 3 : wp.player.age >= 36 ? (1 - offer.years) * 2 : 0;
  // Someone with a rival agency is happy where he is unless you beat them.
  if (wp.agent) score -= 6;
  return clamp(1 / (1 + Math.exp(-score / 7)), 0.02, 0.97);
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
    return { accepted: false, chance, message: `${wp.player.name} turns you down${wp.agent ? ` and stays with ${wp.agent.agency}` : ""}.` };
  }
  signClient(world, id, offer);
  return { accepted: true, chance, message: `${wp.player.name} signs with ${world.agency.name}!` };
}

export function signClient(world: World, id: string, offer: Offer): void {
  const wp = world.players[id]!;
  // A player still on a rival's books in his final season joins you when that deal ends; we simplify and let him move now.
  wp.agent = null;
  wp.client = newManagement(world.season, offer.commission, offer.years);
  world.clientIds.push(id);
  world.agency.knowledge[id] = { accuracy: 1, reports: 99, absWeek: absWeek(world.season, world.week) };
  world.news.unshift(`${wp.player.name} signs with ${world.agency.name} (${Math.round(offer.commission * 100)}%, ${offer.years} season${offer.years === 1 ? "" : "s"}).`);
}

/** Offer a client in his final season a new deal; his happiness decides. */
export function extendContract(world: World, id: string, offer: Offer): OfferResponse {
  const wp = world.players[id];
  if (!wp?.client) return { accepted: false, chance: 0, message: "He isn't your client." };
  const until = world.agency.cooldowns[id];
  if (until !== undefined && until > absWeek(world.season, world.week)) return { accepted: false, chance: 0, message: "He's not ready to talk again yet." };
  const score = wp.client.happiness - 55 + (wp.client.contract.commission - offer.commission) * 100 * 3 - Math.max(0, expectedReputation(world, id) - world.agency.reputation) * 0.5;
  const chance = clamp(1 / (1 + Math.exp(-score / 7)), 0.02, 0.98);
  const rng = createRng(mixSeed(world.seed, world.season, world.week, 600, Number(id.replace(/\D/g, "")) || 1));
  if (!rng.chance(chance)) {
    world.agency.cooldowns[id] = absWeek(world.season, world.week) + 4;
    return { accepted: false, chance, message: `${wp.player.name} isn't ready to commit to a new deal.` };
  }
  wp.client.contract = { ...wp.client.contract, commission: offer.commission, untilSeason: world.season + offer.years };
  world.news.unshift(`${wp.player.name} extends with ${world.agency.name} until the end of season ${world.season + offer.years}.`);
  return { accepted: true, chance, message: `${wp.player.name} agrees to stay until the end of season ${world.season + offer.years}.` };
}

export function releaseClient(world: World, id: string): void {
  const wp = world.players[id];
  if (!wp?.client) return;
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
  target -= (c.contract.commission - STANDARD_COMMISSION) * 100 * 1.5;
  if (week.heldOut) target -= 15;
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
  // Harder to gain near the top.
  agency.reputation = clamp(agency.reputation + amount * (1 - agency.reputation / 120), 0, 100);
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
      releaseClient(world, wp.player.id);
      wp.agent = { agency: rng.pick(RIVAL_AGENCIES), untilSeason: world.season + 1 + rng.int(0, 2) };
    }
  }
  const ranks = rankMap(world);
  for (const wp of Object.values(world.players)) {
    if (wp.client) continue;
    if (wp.agent && wp.agent.untilSeason <= world.season) {
      wp.agent = rng.chance(0.65) ? { agency: rng.pick(RIVAL_AGENCIES), untilSeason: world.season + 1 + rng.int(0, 2) } : null;
    } else if (!wp.agent && wp.career.status !== "none" && wp.career.status !== "amateur" && rng.chance((ranks.get(wp.player.id) ?? 999) <= 50 ? 0.9 : 0.35)) {
      wp.agent = { agency: rng.pick(RIVAL_AGENCIES), untilSeason: world.season + 1 + rng.int(0, 2) };
    }
  }
  // Reputation fades a little each winter unless results keep it up.
  world.agency.reputation = clamp(world.agency.reputation * 0.95 + clients(world).length * 0.5, 0, 100);
  return departures;
}
