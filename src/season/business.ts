import { negotiationBonus, staffWages } from "./market";
/**
 * The agency as a business beyond signing players: the Performance Center
 * it can build for its clients, and development deals where it funds a
 * client's coaching and camps in return for better terms.
 */
import { clamp, createRng } from "../engine";
import { mixSeed } from "./entries";
import { HQ_TIERS, SUPPORT_PER_CLIENT, addReputation, clients, hqTier } from "./agency";
import { developmentCost, earningsAtLevel } from "./finance";
import { overall } from "./development";
import { JET_LEASE_WEEKLY, JET_UPKEEP_WEEKLY } from "./team";
import { commissionWeight } from "./traits";
import { absWeek, type AgencyLedger, type World } from "./types";

// ------------------------------------------------------------------ Performance Center

export interface CenterTier {
  name: string;
  blurb: string;
  /** What it costs to build this tier (from the one below). */
  build: number;
  /** Weekly upkeep in the season. */
  upkeep: number;
  /** Added to every client's development budget (see MANAGED in development.ts). */
  growth: number;
  /** Off the price of winter programs. */
  campDiscount: number;
  /** Reputation the agency needs before it can build it. */
  reputation: number;
}

export const CENTER_TIERS: CenterTier[] = [
  { name: "No center", blurb: "Clients train wherever their coaches are.", build: 0, upkeep: 0, growth: 0, campDiscount: 0, reputation: 0 },
  { name: "Training base", blurb: "A range, a short-game area and a gym your clients can use year round.", build: 1_500_000, upkeep: 8_000, growth: 0.15, campDiscount: 0.25, reputation: 20 },
  { name: "Academy", blurb: "Launch monitors, putting lab, full-time staff: winters here are cheaper and better.", build: 4_000_000, upkeep: 18_000, growth: 0.3, campDiscount: 0.4, reputation: 40 },
  { name: "Elite institute", blurb: "A world-class campus. Players want to sign just to train here.", build: 9_000_000, upkeep: 35_000, growth: 0.5, campDiscount: 0.6, reputation: 60 },
];

export const centerTier = (world: World): CenterTier => CENTER_TIERS[world.agency.center ?? 0]!;

/** Why the next tier can't be built yet, or null if it can. */
export function centerBlock(world: World): string | null {
  const next = CENTER_TIERS[(world.agency.center ?? 0) + 1];
  if (!next) return "Your center is already the best there is.";
  if (world.agency.reputation < next.reputation) return `Needs reputation ${next.reputation}.`;
  if (world.agency.bank < next.build) return "Not enough in the bank.";
  return null;
}

export function buildCenter(world: World): void {
  const block = centerBlock(world);
  if (block) throw new Error(block);
  const tier = (world.agency.center ?? 0) + 1;
  const next = CENTER_TIERS[tier]!;
  world.agency.bank -= next.build;
  world.agency.ledger.facility = (world.agency.ledger.facility ?? 0) + next.build;
  world.agency.center = tier;
  addReputation(world.agency, 2 * tier);
  world.news.unshift(`${world.agency.name} opens its ${next.name.toLowerCase()}.`);
}

/** The week's upkeep, in the season. */
export function payCenter(world: World): void {
  const upkeep = centerTier(world).upkeep;
  if (!upkeep) return;
  world.agency.bank -= upkeep;
  world.agency.ledger.facility = (world.agency.ledger.facility ?? 0) + upkeep;
}

// ------------------------------------------------------------------ development deals

export type DealShare = 0.5 | 1;
export type DealTerms = "commission" | "years";

/** What the agency asks for in return. */
export const DEAL_ASK: Record<DealTerms, Record<DealShare, number>> = {
  /** Commission points added. */
  commission: { 0.5: 0.015, 1: 0.03 },
  /** Seasons added to the contract. */
  years: { 0.5: 1, 1: 2 },
};

export interface DealOffer {
  share: DealShare;
  terms: DealTerms;
}

/** The chance he takes a development deal: he likes being invested in, not paying more for it. */
export function dealChance(world: World, id: string, offer: DealOffer): number {
  const wp = world.players[id]!;
  const m = wp.client!;
  const a = wp.player.attributes;
  let score = m.happiness - 60 + offer.share * 12 + (a.ambition - 10) * 0.8 + negotiationBonus(world, "agent");
  if (offer.terms === "commission") score -= DEAL_ASK.commission[offer.share] * 100 * 3 * commissionWeight(wp);
  else score += wp.player.age <= 25 ? 5 : wp.player.age >= 33 ? -8 : 0;
  return clamp(1 / (1 + Math.exp(-score / 7)), 0.03, 0.97);
}

/** Why a deal can't be offered right now, or null. */
export function dealBlock(world: World, id: string): string | null {
  const m = world.players[id]?.client;
  if (!m) return "He isn't your client.";
  const until = world.agency.cooldowns[id];
  if (until !== undefined && until > absWeek(world.season, world.week)) return "He's not ready to talk again yet.";
  return null;
}

/** Offers the deal. On a yes the agency starts paying its share and the terms change. */
export function offerDevelopmentDeal(world: World, id: string, offer: DealOffer): { accepted: boolean; chance: number; message: string } {
  const block = dealBlock(world, id);
  if (block) return { accepted: false, chance: 0, message: block };
  const wp = world.players[id]!;
  const m = wp.client!;
  const chance = dealChance(world, id, offer);
  const rng = createRng(mixSeed(world.seed, world.season, world.week, 700, Number(id.replace(/\D/g, "")) || 1));
  if (!rng.chance(chance)) {
    world.agency.cooldowns[id] = absWeek(world.season, world.week) + 4;
    return { accepted: false, chance, message: `${wp.player.name} would rather keep things as they are.` };
  }
  if (offer.terms === "commission") m.contract = { ...m.contract, commission: Math.min(0.2, m.contract.commission + DEAL_ASK.commission[offer.share]) };
  else m.contract = { ...m.contract, untilSeason: Math.min(world.season + 4, m.contract.untilSeason + DEAL_ASK.years[offer.share]) };
  m.devFunding = offer.share;
  m.devDeal = { share: offer.share, terms: offer.terms, since: world.season, funded: 0, commissionSince: 0 };
  const what = offer.terms === "commission" ? `${Math.round(m.contract.commission * 100)}% commission` : `a contract to the end of season ${m.contract.untilSeason}`;
  world.news.unshift(`${world.agency.name} will fund ${offer.share === 1 ? "all" : "half"} of ${wp.player.name}'s development (${what}).`);
  return { accepted: true, chance, message: `${wp.player.name} agrees: you fund ${offer.share === 1 ? "all" : "half"} of his development, for ${what}.` };
}

/** Stops funding him. The terms he agreed stay; he takes it badly. */
export function endDevelopmentDeal(world: World, id: string): void {
  const wp = world.players[id];
  const m = wp?.client;
  if (!m) return;
  m.devFunding = 0;
  delete m.devDeal;
  m.happiness = clamp(m.happiness - 8, 0, 100);
  world.news.unshift(`${world.agency.name} stops paying for ${wp.player.name}'s development.`);
}

/** Keeps a deal's books: what the agency paid in and the commission it has had back. */
export function recordDealFunding(world: World, id: string, agencyPaid: number): void {
  const d = world.players[id]?.client?.devDeal;
  if (d) d.funded += agencyPaid;
}

export function recordDealCommission(world: World, id: string, commission: number): void {
  const d = world.players[id]?.client?.devDeal;
  if (d) d.commissionSince += commission;
}

/** All clients on a deal, for the agency view. */
export const dealClients = (world: World) => clients(world).filter((wp) => wp.client!.devDeal);

// ------------------------------------------------------------------ headquarters

/** Why the next headquarters can't be taken yet, or null. */
export function hqBlock(world: World): string | null {
  const next = HQ_TIERS[(world.agency.hq ?? 0) + 1];
  if (!next) return "You already have the biggest headquarters.";
  if (world.agency.reputation < next.reputation) return `Needs reputation ${next.reputation}.`;
  if (world.agency.bank < next.cost) return "Not enough in the bank.";
  return null;
}

export function upgradeHq(world: World): void {
  const block = hqBlock(world);
  if (block) throw new Error(block);
  const tier = (world.agency.hq ?? 0) + 1;
  const next = HQ_TIERS[tier]!;
  world.agency.bank -= next.cost;
  world.agency.ledger.office += next.cost;
  world.agency.hq = tier;
  world.news.unshift(`${world.agency.name} moves into its ${next.name.toLowerCase()}.`);
}

// ------------------------------------------------------------------ credit line

/** Yearly interest on the credit line, charged by the week of the season. */
export const CREDIT_RATE = 0.08;

/** What the bank will lend: more as the agency's name grows. */
export const creditLimit = (world: World): number => Math.round((250_000 + world.agency.reputation * 20_000) / 50_000) * 50_000;

export function borrow(world: World, amount: number): void {
  const owed = world.agency.loan ?? 0;
  const take = Math.max(0, Math.min(amount, creditLimit(world) - owed));
  world.agency.loan = owed + take;
  world.agency.bank += take;
}

export function repay(world: World, amount: number): void {
  const pay = Math.max(0, Math.min(amount, world.agency.loan ?? 0, Math.max(0, world.agency.bank)));
  world.agency.loan = (world.agency.loan ?? 0) - pay;
  world.agency.bank -= pay;
}

export function payInterest(world: World): void {
  const owed = world.agency.loan ?? 0;
  if (owed <= 0) return;
  const interest = Math.round((owed * CREDIT_RATE) / 41);
  world.agency.bank -= interest;
  world.agency.ledger.interest = (world.agency.ledger.interest ?? 0) + interest;
}

/** Keeps the end-of-week balance for the bank chart (the last five seasons). */
export function recordBank(world: World): void {
  const h = (world.agency.bankHistory ??= []);
  h.push({ season: world.season, week: world.week, bank: world.agency.bank });
  if (h.length > 41 * 5) h.splice(0, h.length - 41 * 5);
}

// ------------------------------------------------------------------ the books

export const agencyIncome = (l: AgencyLedger): number =>
  l.prizeCommission + l.endorsementCommission + (l.winBonuses ?? 0) + (l.brands ?? 0) + (l.buyouts ?? 0) + Math.max(0, l.events ?? 0);
export const agencyCosts = (l: AgencyLedger): number =>
  l.office + l.scouts + (l.development ?? 0) + (l.facility ?? 0) + (l.interest ?? 0) + (l.staff ?? 0) + (l.clientCare ?? 0) + (l.support ?? 0) + (l.signingBonuses ?? 0) + Math.max(0, -(l.events ?? 0));

export interface ClientBook {
  id: string;
  name: string;
  /** Everything the agency took from him: prize and endorsement commission, win bonuses. */
  income: number;
  /** What he cost the agency: support, development it funded, signing bonus. */
  costs: number;
  profit: number;
}

/** Each client's season for the agency: what he brought in against what he cost, best first. */
export function clientBooks(world: World): ClientBook[] {
  return world.clientIds
    .map((id) => world.players[id])
    .filter((wp): wp is NonNullable<typeof wp> => !!wp?.client)
    .map((wp) => {
      const f = wp.client!.finances;
      const costs = (f.agencySupport ?? 0) + (f.agencyFunded ?? 0) + (f.agencyBonus ?? 0);
      return { id: wp.player.id, name: wp.player.name, income: f.commission, costs, profit: f.commission - costs };
    })
    .sort((a, b) => b.profit - a.profit);
}
export const agencyProfit = (l: AgencyLedger): number => agencyIncome(l) - agencyCosts(l);

/** Weekly running costs: office, scouts, center, staff, interest and the jet. */
export function weeklyRunningCosts(world: World, scouts: number, staff = 0): number {
  const jet = world.agency.jet === "lease" ? JET_LEASE_WEEKLY : world.agency.jet === "own" ? JET_UPKEEP_WEEKLY : 0;
  const support = world.clientIds.length * SUPPORT_PER_CLIENT;
  return hqTier(world.agency).office + scouts + centerTier(world).upkeep + Math.max(staff, staffWages(world)) + jet + support + Math.round(((world.agency.loan ?? 0) * CREDIT_RATE) / 41);
}

/**
 * A rough weekly forecast: the commission each client's level should bring
 * in and the endorsement cuts, less running costs and the development the
 * agency funds.
 */
export function weeklyForecast(world: World, scouts: number, staff = 0): { income: number; costs: number; net: number } {
  let income = 0;
  let funded = 0;
  for (const wp of clients(world)) {
    const m = wp.client!;
    income += (earningsAtLevel(overall(wp.player)) * m.contract.commission) / 41;
    income += (m.sponsors.reduce((s, x) => s + x.annualValue, 0) * m.contract.endorsementCommission) / 41;
    funded += developmentCost(world, wp.player.id).agency / 41;
  }
  const costs = weeklyRunningCosts(world, scouts, staff) + funded;
  return { income: Math.round(income), costs: Math.round(costs), net: Math.round(income - costs) };
}
