/**
 * The agency in its market: the people it hires, the players it is
 * tracking, and the rival agencies it competes with for talent.
 */
import { bidPressure, poachMessage } from "./rivalAgents";
import { trustOf } from "./promises";
import { clamp, createRng, type Rng } from "../engine";
import { STANDARD_COMMISSION, clients, releaseClient } from "./agency";
import { ensureRivals, likeliestSuitor } from "./rivals";
import { earningsAtLevel } from "./finance";
import { overall } from "./development";
import { rankMap } from "./points";
import type { AgencyStaffer, StaffContract, StaffRole, World, WorldPlayer } from "./types";
import { seasonWeeks } from "./calendar";

// ------------------------------------------------------------------ staff

export const STAFF_ROLES: StaffRole[] = ["agent", "analyst", "marketing", "lawyer"];

export const STAFF_LABELS: Record<StaffRole, { label: string; blurb: string }> = {
  agent: { label: "Agent", blurb: "Closes signings and development deals: players are likelier to say yes." },
  analyst: { label: "Analyst", blurb: "Reads a client's ceiling as clearly as an elite coach would." },
  marketing: { label: "Marketing lead", blurb: "Bigger sponsorship offers, more often." },
  lawyer: { label: "Lawyer", blurb: "Contract renewals go through more often." },
};

const FIRST = ["Dana", "Marcus", "Elena", "Theo", "Priya", "Grant", "Sofia", "Owen", "Hannah", "Victor", "Nadia", "Cole", "Amara", "Julian", "Maya", "Caleb", "Leila", "Mateo", "Naomi", "Andre", "Mina", "Jonah", "Aisha", "Elliot", "Camila", "Devon", "Inez", "Miles", "Talia", "Rafael"];
const LAST = ["Whitfield", "Okafor", "Lindqvist", "Moreno", "Castellano", "Brandt", "Ashworth", "Kaur", "Delaney", "Fujita", "Rourke", "Haldane", "Navarro", "Kim", "Bennett", "Mensah", "Sato", "Laurent", "Brooks", "Petrov", "Silva", "Walsh", "Ibrahim", "Chen", "Morgan", "Vega", "Nakamura", "Bishop", "Reyes", "Singh"];

export const stafferFee = (quality: number): number => Math.round((200 + quality ** 3 * 0.8) / 100) * 100;

/** A persistent 100-person market: 25 candidates at every agency role. */
export function generateStaff(seed: number): AgencyStaffer[] {
  const rng = createRng(seed ^ 0x5717);
  const out: AgencyStaffer[] = [];
  const used = new Set<string>();
  const name = () => {
    let candidate = "";
    do candidate = `${rng.pick(FIRST)} ${rng.pick(LAST)}`; while (used.has(candidate));
    used.add(candidate);
    return candidate;
  };
  // Keep the first twelve IDs and RNG sequence compatible with existing saves.
  for (const role of STAFF_ROLES) {
    for (const q of [8, 12, 16]) {
      const quality = clamp(q + rng.int(-2, 2), 4, 19);
      out.push({ id: `st${out.length + 1}`, name: name(), role, quality, weeklyFee: stafferFee(quality) });
    }
  }
  for (const role of STAFF_ROLES) {
    for (let i = 0; i < 22; i++) {
      const quality = clamp(4 + Math.round((i / 21) * 15) + rng.int(-1, 1), 3, 20);
      out.push({ id: `st${out.length + 1}`, name: name(), role, quality, weeklyFee: stafferFee(quality) });
    }
  }
  return out;
}

export function staffMarket(world: World): AgencyStaffer[] {
  const generated = generateStaff(world.seed);
  const saved = world.agency.staffMarket;
  if (!saved) return (world.agency.staffMarket = generated);
  if (saved.length >= generated.length) return saved;
  const existing = new Set(saved.map((s) => s.id));
  return (world.agency.staffMarket = [...saved, ...generated.filter((s) => !existing.has(s.id))]);
}

export function hiredStaffer(world: World, role: StaffRole): AgencyStaffer | undefined {
  const id = world.agency.staffHired?.[role];
  return id ? staffMarket(world).find((s) => s.id === id) : undefined;
}

/** Quality of the person in a role, or 0 with nobody hired. */
export const stafferQuality = (world: World, role: StaffRole): number => hiredStaffer(world, role)?.quality ?? 0;

/** Contract lengths on offer, and the weekly discount a longer deal earns. */
export const STAFF_TERMS = [1, 2, 3] as const;
export const termDiscount = (years: number): number => (years >= 3 ? 0.1 : years === 2 ? 0.05 : 0);
/** Loyal staff re-sign for less: 3% a season served, up to 15%. */
export const loyaltyDiscount = (seasonsServed: number): number => Math.min(0.15, seasonsServed * 0.03);
/** Firing someone pays off half of what's left on their deal. */
export const BUYOUT_SHARE = 0.5;

/** The weekly wage for a staffer on a deal of `years`, with any loyalty discount. */
export const contractFee = (s: AgencyStaffer, years: number, seasonsServed = 0): number =>
  Math.round((s.weeklyFee * (1 - termDiscount(years)) * (1 - loyaltyDiscount(seasonsServed))) / 100) * 100;

/** The contract for a role (a hire from an older save gets a deal through next season). */
export function staffContract(world: World, role: StaffRole): StaffContract | undefined {
  const s = hiredStaffer(world, role);
  if (!s) return undefined;
  const contracts = (world.agency.staffContracts ??= {});
  const c = contracts[role];
  if (c && c.stafferId === s.id) return c;
  return (contracts[role] = { stafferId: s.id, signedSeason: world.season, untilSeason: world.season + 1, weeklyFee: s.weeklyFee, seasonsServed: 0 });
}

export function hireStaffer(world: World, id: string, years = 1): void {
  const s = staffMarket(world).find((x) => x.id === id);
  if (!s) throw new Error(`unknown staffer ${id}`);
  if (hiredStaffer(world, s.role)) throw new Error(`fire your ${STAFF_LABELS[s.role].label.toLowerCase()} first`);
  (world.agency.staffHired ??= {})[s.role] = s.id;
  (world.agency.staffContracts ??= {})[s.role] = { stafferId: s.id, signedSeason: world.season, untilSeason: world.season + years - 1, weeklyFee: contractFee(s, years), seasonsServed: 0 };
  world.news.unshift(`${world.agency.name} hires ${s.name} as its ${STAFF_LABELS[s.role].label.toLowerCase()} on a ${years}-year deal.`);
}

/** Weeks left on a deal: the rest of this season, plus every season after it. */
export function contractWeeksLeft(world: World, c: StaffContract): number {
  const perSeason = seasonWeeks(world);
  const thisSeason = Math.max(0, perSeason - world.week + 1);
  return thisSeason + Math.max(0, c.untilSeason - world.season) * perSeason;
}

/** What it costs to fire whoever holds a role. */
export function buyoutCost(world: World, role: StaffRole): number {
  const c = staffContract(world, role);
  return c ? Math.round((contractWeeksLeft(world, c) * c.weeklyFee * BUYOUT_SHARE) / 100) * 100 : 0;
}

/** Fires a staffer: their buyout is paid now, and the role opens up. */
export function fireStaffer(world: World, role: StaffRole): number {
  const s = hiredStaffer(world, role);
  if (!s) return 0;
  const cost = buyoutCost(world, role);
  world.agency.bank -= cost;
  world.agency.ledger.staff = (world.agency.ledger.staff ?? 0) + cost;
  releaseStaffer(world, role);
  world.news.unshift(`${world.agency.name} fires ${s.name}${cost ? `, paying ${money(cost)} to end the deal` : ""}.`);
  return cost;
}

/** Ends a role with no payment (a deal that has run out). */
export function releaseStaffer(world: World, role: StaffRole): void {
  if (world.agency.staffHired) delete world.agency.staffHired[role];
  if (world.agency.staffContracts) delete world.agency.staffContracts[role];
}

/** Re-signs a staffer for `years` more seasons at their current rating, less their loyalty discount. */
export function renewStaffer(world: World, role: StaffRole, years: number): void {
  const s = hiredStaffer(world, role);
  const c = staffContract(world, role);
  if (!s || !c) return;
  s.weeklyFee = stafferFee(s.quality);
  c.weeklyFee = contractFee(s, years, c.seasonsServed);
  c.untilSeason = Math.max(c.untilSeason, world.season - 1) + years;
  world.news.unshift(`${s.name} re-signs with ${world.agency.name} for ${years} more year${years === 1 ? "" : "s"} at ${money(c.weeklyFee)} a week.`);
}

/**
 * The season's end for your staff: every hire earns a year of loyalty and a
 * point on their rating; deals that are up come back as a decision.
 */
export function staffSeasonEnd(world: World): { role: StaffRole; staffer: AgencyStaffer; contract: StaffContract }[] {
  const expiring: { role: StaffRole; staffer: AgencyStaffer; contract: StaffContract }[] = [];
  for (const role of STAFF_ROLES) {
    const s = hiredStaffer(world, role);
    const c = staffContract(world, role);
    if (!s || !c) continue;
    c.seasonsServed++;
    s.quality = Math.min(20, s.quality + 1);
    if (c.untilSeason <= world.season) expiring.push({ role, staffer: s, contract: c });
  }
  return expiring;
}

export const staffWages = (world: World): number => STAFF_ROLES.reduce((s, r) => s + (staffContract(world, r)?.weeklyFee ?? 0), 0);

const money = (x: number) => (x >= 1_000_000 ? `$${(x / 1_000_000).toFixed(1)}M` : `$${Math.round(x / 1000)}k`);

export function payStaff(world: World): void {
  const wages = staffWages(world);
  if (!wages) return;
  world.agency.bank -= wages;
  world.agency.ledger.staff = (world.agency.ledger.staff ?? 0) + wages;
}

/** A good agent or lawyer is worth a few points of a player's "yes" (the 0-centred score the chances use). */
export const negotiationBonus = (world: World, role: "agent" | "lawyer"): number => {
  const q = stafferQuality(world, role);
  return q ? (q - 6) * 0.6 : 0;
};

/** Marketing makes sponsorship offers bigger. */
export const sponsorBoost = (world: World): number => 1 + stafferQuality(world, "marketing") / 80;

// ------------------------------------------------------------------ recruitment board

export const onShortlist = (world: World, id: string): boolean => (world.agency.shortlist ?? []).includes(id);

export function toggleShortlist(world: World, id: string): void {
  const list = (world.agency.shortlist ??= []);
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1);
  else list.push(id);
}

/** Season-end news for the board: who became a free agent, who retired. */
export function shortlistAlerts(world: World): string[] {
  const list = world.agency.shortlist ?? [];
  const out: string[] = [];
  world.agency.shortlist = list.filter((id) => {
    const wp = world.players[id];
    if (!wp) {
      out.push("A player on your recruitment board has retired.");
      return false;
    }
    if (wp.client) return false;
    if (!wp.agent && wp.career.status !== "amateur") out.push(`${wp.player.name}, on your recruitment board, is a free agent.`);
    else if (wp.agent && wp.agent.untilSeason === world.season + 1) out.push(`${wp.player.name}'s deal with ${wp.agent.agency} ends next season.`);
    return true;
  });
  return out;
}

// ------------------------------------------------------------------ rival agencies

export interface AgencyRow {
  name: string;
  yours: boolean;
  clients: number;
  wins: number;
  majors: number;
  earnings: number;
  best: { name: string; rank: number } | null;
}

/** Every agency this season: clients, wins, majors and what their players have earned. */
export function agencyTable(world: World): AgencyRow[] {
  const ranks = rankMap(world);
  const rows = new Map<string, AgencyRow>();
  const row = (name: string, yours: boolean) => {
    let r = rows.get(name);
    if (!r) rows.set(name, (r = { name, yours, clients: 0, wins: 0, majors: 0, earnings: 0, best: null }));
    return r;
  };
  row(world.agency.name, true);
  for (const r of ensureRivals(world)) row(r.name, false);
  for (const wp of Object.values(world.players)) {
    const name = wp.client ? world.agency.name : wp.agent?.agency;
    if (!name) continue;
    const r = row(name, !!wp.client);
    const season = wp.career.results.filter((x) => x.season === world.season && x.tier !== "dev");
    r.clients++;
    r.wins += season.filter((x) => x.position === 1).length;
    r.majors += season.filter((x) => x.position === 1 && x.tier === "major").length;
    r.earnings += wp.career.seasonEarnings;
    const rank = ranks.get(wp.player.id);
    if (rank && (!r.best || rank < r.best.rank)) r.best = { name: wp.player.name, rank };
  }
  return [...rows.values()].sort((a, b) => b.earnings - a.earnings || b.wins - a.wins);
}

/**
 * At season's end a rival may come for an unhappy client. Below 40 he hears
 * them out and gets a little more restless; below 30 he may go, and the
 * rival pays a buyout of half a season's commission.
 */
export function rivalPoaching(world: World, rng: Rng): string[] {
  const news: string[] = [];
  for (const wp of [...clients(world)]) {
    const m = wp.client!;
    // A client who doesn't trust you listens sooner.
    if (m.contract.untilSeason <= world.season || m.happiness >= (trustOf(wp) < 40 ? 50 : 40)) continue;
    const rival = likeliestSuitor(world, wp.player.id, rng);
    if (!rng.chance(0.35 * bidPressure(world, rival))) continue;
    if (m.happiness < 30 && rng.chance(0.5)) {
      const buyout = Math.round((earningsAtLevel(overall(wp.player)) * m.contract.commission) / 2);
      world.agency.bank += buyout;
      world.agency.ledger.buyouts = (world.agency.ledger.buyouts ?? 0) + buyout;
      releaseClient(world, wp.player.id);
      wp.agent = { agency: rival, untilSeason: world.season + 2, commission: STANDARD_COMMISSION };
      news.push(`${rival} poach ${wp.player.name}; they pay a ${Math.round(buyout / 1000)}k buyout.`);
      poachMessage(world, rival, wp.player.name);
    } else {
      m.happiness = clamp(m.happiness - 4, 0, 100);
      news.push(`${rival} have been talking to ${wp.player.name}. Keep him happy or lose him.`);
    }
  }
  return news;
}

/** Rival interest in a client, for the roster: none, sniffing, or a real threat. */
export function poachRisk(wp: WorldPlayer): "none" | "watching" | "threat" {
  const h = wp.client?.happiness ?? 100;
  return h < 30 ? "threat" : h < 40 ? "watching" : "none";
}
