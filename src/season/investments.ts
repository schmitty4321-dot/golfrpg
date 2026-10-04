/**
 * Where a successful agency puts its money: a charitable foundation, its own
 * invitational, a stake in an equipment brand, a golf course. Each costs a
 * lump to start, then pays (or costs) something every winter, and some lift
 * reputation. Selling gets most of the stake back.
 */
import { createRng } from "../engine";
import { addReputation } from "./agency";
import { mixSeed } from "./entries";
import type { World } from "./types";

export type InvestmentKind = "foundation" | "invitational" | "brandStake" | "course";

export interface InvestmentDef {
  label: string;
  blurb: string;
  /** Paid to start it. */
  cost: number;
  /** Reputation the agency needs first. */
  reputation: number;
  /** The yearly result: a return on the stake (fraction, low to high), a fixed running cost, and reputation. */
  returnRange: [number, number];
  upkeep: number;
  reputationPerSeason: number;
}

export const INVESTMENTS: Record<InvestmentKind, InvestmentDef> = {
  foundation: { label: "Charitable foundation", blurb: "Junior golf and community work. Costs every year; earns respect and fans.", cost: 500_000, reputation: 25, returnRange: [0, 0], upkeep: 250_000, reputationPerSeason: 2 },
  invitational: { label: "Your own invitational", blurb: "An event with your name on it. Sponsors and gate money pay for it in a good year.", cost: 4_000_000, reputation: 50, returnRange: [-0.05, 0.25], upkeep: 400_000, reputationPerSeason: 2.5 },
  brandStake: { label: "Equipment brand stake", blurb: "A share of a club maker. Returns swing with the market.", cost: 3_000_000, reputation: 40, returnRange: [-0.15, 0.3], upkeep: 0, reputationPerSeason: 0 },
  course: { label: "A golf course", blurb: "Steady green-fee income, and a home for your players' practice.", cost: 8_000_000, reputation: 60, returnRange: [0.03, 0.08], upkeep: 0, reputationPerSeason: 0.5 },
};

export interface Investment {
  kind: InvestmentKind;
  since: number;
  /** What it cost; the base for returns and a sale. */
  stake: number;
  /** Last winter's result, for the screen. */
  last?: number;
}

/** Share of the stake a sale brings back. */
export const SALE_SHARE = 0.8;

export const investmentsOf = (world: World): Investment[] => world.agency.investments ?? [];

/** Why it can't be bought now, or null. */
export function investBlock(world: World, kind: InvestmentKind): string | null {
  const d = INVESTMENTS[kind];
  if (investmentsOf(world).some((i) => i.kind === kind)) return "You already own one.";
  if (world.agency.reputation < d.reputation) return `Needs reputation ${d.reputation}.`;
  if (world.agency.bank < d.cost) return "Not enough in the bank.";
  return null;
}

export function buyInvestment(world: World, kind: InvestmentKind): void {
  const block = investBlock(world, kind);
  if (block) throw new Error(block);
  const d = INVESTMENTS[kind];
  world.agency.bank -= d.cost;
  world.agency.ledger.invested = (world.agency.ledger.invested ?? 0) + d.cost;
  (world.agency.investments ??= []).push({ kind, since: world.season, stake: d.cost });
  world.news.unshift(`${world.agency.name} invests in ${d.label.toLowerCase()} (${Math.round(d.cost / 1e5) / 10}M).`);
}

export function sellInvestment(world: World, kind: InvestmentKind): number {
  const list = investmentsOf(world);
  const inv = list.find((i) => i.kind === kind);
  if (!inv) return 0;
  const back = Math.round(inv.stake * SALE_SHARE);
  world.agency.bank += back;
  world.agency.ledger.invested = (world.agency.ledger.invested ?? 0) - back;
  world.agency.investments = list.filter((i) => i !== inv);
  world.news.unshift(`${world.agency.name} sells its ${INVESTMENTS[kind].label.toLowerCase()} for ${Math.round(back / 1e5) / 10}M.`);
  return back;
}

/** The winter's returns and running costs, booked to the ledger as one line. */
export function investmentsSeasonEnd(world: World): void {
  for (const inv of investmentsOf(world)) {
    const d = INVESTMENTS[inv.kind];
    const rng = createRng(mixSeed(world.seed, world.season, 2401, inv.kind.length * 7 + inv.since));
    const [lo, hi] = d.returnRange;
    const result = Math.round(inv.stake * (lo + rng.next() * (hi - lo)) - d.upkeep);
    inv.last = result;
    world.agency.bank += result;
    world.agency.ledger.investments = (world.agency.ledger.investments ?? 0) + result;
    if (d.reputationPerSeason) addReputation(world.agency, d.reputationPerSeason);
  }
}
