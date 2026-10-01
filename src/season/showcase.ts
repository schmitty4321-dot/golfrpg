/**
 * The agency in public: brand partnerships, the events it hosts, its
 * clients' media following, and the trophy cabinet of what they've won.
 */
import { clamp, createRng, type Rng } from "../engine";
import { addReputation, clients } from "./agency";
import { agencyTable } from "./market";
import { mixSeed } from "./entries";
import { pointsList, rankMap } from "./points";
import { BRANDS } from "./sponsors";
import type { AgencyEventKind, BrandDeal, SponsorCategory, Trophy, World, WorldPlayer } from "./types";

// ------------------------------------------------------------------ brand partnerships

/** This season's partnership offers: more and bigger as the agency's name and roster grow. */
export function brandOffers(world: World): BrandDeal[] {
  if (world.agency.brandOffers) return world.agency.brandOffers;
  const rng = createRng(mixSeed(world.seed, world.season, 811));
  const taken = new Set((world.agency.brands ?? []).map((b) => b.category));
  const open = (Object.keys(BRANDS) as SponsorCategory[]).filter((c) => !taken.has(c));
  const n = world.agency.reputation < 15 ? 0 : Math.min(open.length, world.agency.reputation < 40 ? 2 : 3);
  const offers: BrandDeal[] = [];
  for (let i = 0; i < n; i++) {
    const category = open.splice(rng.int(0, open.length - 1), 1)[0]!;
    const scale = (world.agency.reputation / 50) * (0.6 + Math.min(4, world.clientIds.length) * 0.2) * (0.8 + rng.next() * 0.4);
    offers.push({
      id: `b${world.season}-${category}`,
      brand: rng.pick(BRANDS[category]),
      category,
      annual: Math.round((100_000 + 400_000 * scale) / 10_000) * 10_000,
      lift: Math.round((0.05 + rng.next() * 0.1) * 100) / 100,
      untilSeason: world.season + rng.int(1, 2),
    });
  }
  return (world.agency.brandOffers = offers);
}

export function signBrand(world: World, id: string): void {
  const offer = brandOffers(world).find((b) => b.id === id);
  if (!offer) throw new Error(`no brand offer ${id}`);
  (world.agency.brands ??= []).push(offer);
  world.agency.brandOffers = brandOffers(world).filter((b) => b.id !== id && b.category !== offer.category);
  addReputation(world.agency, 1);
  world.news.unshift(`${world.agency.name} signs an agency partnership with ${offer.brand}.`);
}

/** The week's partnership fees. */
export function payBrands(world: World): void {
  const weekly = (world.agency.brands ?? []).reduce((s, b) => s + b.annual / 41, 0);
  if (!weekly) return;
  const pay = Math.round(weekly);
  world.agency.bank += pay;
  world.agency.ledger.brands = (world.agency.ledger.brands ?? 0) + pay;
}

/** A partner brand makes its category's offers to your clients worth more. */
export const brandLift = (world: World, category: SponsorCategory): number =>
  1 + (world.agency.brands ?? []).filter((b) => b.category === category).reduce((s, b) => s + b.lift, 0);

/** Season end: finished partnerships lapse and next season brings new offers. */
export function brandSeasonEnd(world: World): void {
  world.agency.brands = (world.agency.brands ?? []).filter((b) => b.untilSeason > world.season);
  delete world.agency.brandOffers;
}

// ------------------------------------------------------------------ agency events

export interface AgencyEvent {
  label: string;
  blurb: string;
  cost: number;
  reputation: number;
  /** Followers each client gains (as a share). */
  followers: number;
}

export const AGENCY_EVENTS: Record<AgencyEventKind, AgencyEvent> = {
  clinic: { label: "Junior clinic", blurb: "Your clients coach local juniors. Cheap, good for their image.", cost: 60_000, reputation: 1, followers: 0.05 },
  proAm: { label: "Charity pro-am", blurb: "Sponsors pay to play with your clients. More clients, more money.", cost: 250_000, reputation: 2, followers: 0.08 },
  exhibition: { label: "Exhibition match", blurb: "A star client headlines a televised match. Needs someone in the world top 50.", cost: 400_000, reputation: 3, followers: 0.15 },
};

/** The client who would headline an exhibition: your best-ranked, if he's in the top 50. */
export function headliner(world: World): WorldPlayer | null {
  const ranks = rankMap(world);
  const best = clients(world).filter((wp) => (ranks.get(wp.player.id) ?? 999) <= 50).sort((a, b) => ranks.get(a.player.id)! - ranks.get(b.player.id)!)[0];
  return best ?? null;
}

/** What an event would take in. */
export function eventTakings(world: World, kind: AgencyEventKind): number {
  const n = world.clientIds.length;
  if (kind === "clinic") return 40_000 + 20_000 * n;
  if (kind === "proAm") return 150_000 + 60_000 * n + world.agency.reputation * 2_000;
  const star = headliner(world);
  const rank = star ? rankMap(world).get(star.player.id) ?? 50 : 50;
  return 300_000 + (51 - rank) * 20_000;
}

export function eventBlock(world: World, kind: AgencyEventKind): string | null {
  if (world.clientIds.length === 0) return "You need clients to put on.";
  if ((world.agency.eventsHeld?.[world.season] ?? []).includes(kind)) return "Already held this season.";
  if (kind === "exhibition" && !headliner(world)) return "Needs a client in the world top 50.";
  if (world.agency.bank < AGENCY_EVENTS[kind].cost) return "Not enough in the bank.";
  return null;
}

/** Holds the event: takings less costs to the ledger, reputation, and a following for every client. */
export function holdEvent(world: World, kind: AgencyEventKind, rng: Rng = createRng(mixSeed(world.seed, world.season, world.week, 812))): number {
  const block = eventBlock(world, kind);
  if (block) throw new Error(block);
  const e = AGENCY_EVENTS[kind];
  const net = Math.round(eventTakings(world, kind) * (0.85 + rng.next() * 0.3)) - e.cost;
  world.agency.bank += net;
  world.agency.ledger.events = (world.agency.ledger.events ?? 0) + net;
  ((world.agency.eventsHeld ??= {})[world.season] ??= []).push(kind);
  addReputation(world.agency, e.reputation);
  for (const wp of clients(world)) wp.client!.followers = Math.round(followers(world, wp) * (1 + e.followers));
  if (kind === "exhibition") {
    const star = headliner(world);
    if (star) star.player.condition = clamp(star.player.condition - 8, 0, 100);
  }
  world.news.unshift(`${world.agency.name}'s ${e.label.toLowerCase()} ${net >= 0 ? `makes ${Math.round(net / 1000)}k` : `loses ${Math.round(-net / 1000)}k`}.`);
  return net;
}

// ------------------------------------------------------------------ media following

/** His following: set from his standing the first time it's needed, then earned. */
export function followers(world: World, wp: WorldPlayer): number {
  const c = wp.client;
  if (!c) return 0;
  if (c.followers === undefined) {
    const rank = rankMap(world).get(wp.player.id) ?? 400;
    c.followers = Math.round(20_000 + 2_000_000 / Math.max(1, rank) ** 0.8);
  }
  return c.followers;
}

/** A week's change: results and media days build it; quiet weeks let it slip. */
export function updateFollowers(world: World, wp: WorldPlayer, result: { position: number; madeCut: boolean } | null, mediaDays: number): void {
  if (!wp.client) return;
  let f = followers(world, wp) * 0.996;
  if (result?.position === 1) f *= 1.12;
  else if (result?.madeCut && result.position <= 10) f *= 1.03;
  else if (result?.madeCut) f *= 1.005;
  f *= 1 + 0.02 * mediaDays;
  wp.client.followers = Math.round(f);
}

/** A following makes him worth more to sponsors: about +10% per tenfold, from 50k. */
export const followerLift = (world: World, wp: WorldPlayer): number => clamp(1 + Math.log10(Math.max(1, followers(world, wp)) / 50_000) * 0.1, 0.9, 1.3);

// ------------------------------------------------------------------ trophy cabinet

export function addTrophy(world: World, t: Trophy): void {
  (world.agency.trophies ??= []).push(t);
}

/** Records a client's win (call when he wins an event). */
export function recordClientWin(world: World, wp: WorldPlayer, eventName: string, major: boolean): void {
  addTrophy(world, { season: world.season, kind: major ? "major" : "win", title: eventName, player: wp.player.name });
}

/**
 * Season end: a client topping the points list, the agency's awards from the
 * league table, and its reputation for the history chart.
 */
export function trophiesSeasonEnd(world: World): string[] {
  const news: string[] = [];
  const top = pointsList(world)[0];
  const champ = top ? world.players[top] : undefined;
  if (champ?.client) {
    addTrophy(world, { season: world.season, kind: "pointsTitle", title: "Season points title", player: champ.player.name });
    news.push(`${champ.player.name} wins the season points title for ${world.agency.name}.`);
  }
  if (world.clientIds.length) {
    const table = agencyTable(world);
    const place = table.findIndex((r) => r.yours) + 1;
    const award = place === 1 ? "Agency of the Year" : place <= 3 && world.season >= 1 ? "Rising Agency of the Year" : null;
    if (award) {
      addTrophy(world, { season: world.season, kind: "award", title: award });
      addReputation(world.agency, place === 1 ? 4 : 2);
      news.push(`${world.agency.name} is named ${award}.`);
    }
  }
  (world.agency.repHistory ??= []).push({ season: world.season, reputation: Math.round(world.agency.reputation * 10) / 10 });
  return news;
}
