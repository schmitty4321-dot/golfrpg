/**
 * The agency in its market: the people it hires, the players it is
 * tracking, and the rival agencies it competes with for talent.
 */
import { clamp, createRng, type Rng } from "../engine";
import { STANDARD_COMMISSION, clients, releaseClient } from "./agency";
import { ensureRivals, likeliestSuitor } from "./rivals";
import { earningsAtLevel } from "./finance";
import { overall } from "./development";
import { rankMap } from "./points";
import type { AgencyStaffer, StaffRole, World, WorldPlayer } from "./types";

// ------------------------------------------------------------------ staff

export const STAFF_ROLES: StaffRole[] = ["agent", "analyst", "marketing", "lawyer"];

export const STAFF_LABELS: Record<StaffRole, { label: string; blurb: string }> = {
  agent: { label: "Agent", blurb: "Closes signings and development deals: players are likelier to say yes." },
  analyst: { label: "Analyst", blurb: "Reads a client's ceiling as clearly as an elite coach would." },
  marketing: { label: "Marketing lead", blurb: "Bigger sponsorship offers, more often." },
  lawyer: { label: "Lawyer", blurb: "Contract renewals go through more often." },
};

const FIRST = ["Dana", "Marcus", "Elena", "Theo", "Priya", "Grant", "Sofia", "Owen", "Hannah", "Victor", "Nadia", "Cole"];
const LAST = ["Whitfield", "Okafor", "Lindqvist", "Moreno", "Castellano", "Brandt", "Ashworth", "Kaur", "Delaney", "Fujita", "Rourke", "Haldane"];

export const stafferFee = (quality: number): number => Math.round((200 + quality ** 3 * 0.8) / 100) * 100;

/** Three candidates per role, from the world seed. */
export function generateStaff(seed: number): AgencyStaffer[] {
  const rng = createRng(seed ^ 0x5717);
  const out: AgencyStaffer[] = [];
  for (const role of STAFF_ROLES) {
    for (const q of [8, 12, 16]) {
      const quality = clamp(q + rng.int(-2, 2), 4, 19);
      out.push({ id: `st${out.length + 1}`, name: `${rng.pick(FIRST)} ${rng.pick(LAST)}`, role, quality, weeklyFee: stafferFee(quality) });
    }
  }
  return out;
}

export function staffMarket(world: World): AgencyStaffer[] {
  return (world.agency.staffMarket ??= generateStaff(world.seed));
}

export function hiredStaffer(world: World, role: StaffRole): AgencyStaffer | undefined {
  const id = world.agency.staffHired?.[role];
  return id ? staffMarket(world).find((s) => s.id === id) : undefined;
}

/** Quality of the person in a role, or 0 with nobody hired. */
export const stafferQuality = (world: World, role: StaffRole): number => hiredStaffer(world, role)?.quality ?? 0;

export function hireStaffer(world: World, id: string): void {
  const s = staffMarket(world).find((x) => x.id === id);
  if (!s) throw new Error(`unknown staffer ${id}`);
  (world.agency.staffHired ??= {})[s.role] = s.id;
  world.news.unshift(`${world.agency.name} hires ${s.name} as its ${STAFF_LABELS[s.role].label.toLowerCase()}.`);
}

export function releaseStaffer(world: World, role: StaffRole): void {
  if (world.agency.staffHired) delete world.agency.staffHired[role];
}

export const staffWages = (world: World): number => STAFF_ROLES.reduce((s, r) => s + (hiredStaffer(world, r)?.weeklyFee ?? 0), 0);

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
    if (m.contract.untilSeason <= world.season || m.happiness >= 40) continue;
    if (!rng.chance(0.35)) continue;
    const rival = likeliestSuitor(world, wp.player.id, rng);
    if (m.happiness < 30 && rng.chance(0.5)) {
      const buyout = Math.round((earningsAtLevel(overall(wp.player)) * m.contract.commission) / 2);
      world.agency.bank += buyout;
      world.agency.ledger.buyouts = (world.agency.ledger.buyouts ?? 0) + buyout;
      releaseClient(world, wp.player.id);
      wp.agent = { agency: rival, untilSeason: world.season + 2, commission: STANDARD_COMMISSION };
      news.push(`${rival} poach ${wp.player.name}; they pay a ${Math.round(buyout / 1000)}k buyout.`);
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
