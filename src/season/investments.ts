/**
 * Where a successful agency puts its money: a charitable foundation, its own
 * invitational, a stake in an equipment brand, a golf course. Each costs a
 * lump to start, then pays (or costs) something every winter, and some lift
 * reputation. Selling gets most of the stake back.
 */
import { createRng, type Rng } from "../engine";
import { addReputation } from "./agency";
import { mixSeed } from "./entries";
import { absWeek, type World, type WorldPlayer } from "./types";
import { hasSkill } from "./staffSkills";

export type InvestmentKind = "academy" | "media" | "range" | "fitting" | "foundation" | "brandStake" | "invitational" | "course" | "techStake" | "titleEvent" | "resort";

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
  academy: { label: "Junior golf academy", blurb: "Teaches the game to the next generation; now and then a gifted junior asks you to represent him.", cost: 150_000, reputation: 5, returnRange: [0, 0], upkeep: 60_000, reputationPerSeason: 0.5 },
  media: { label: "Golf podcast and video channel", blurb: "Content about your clients: a hit some years, a flop in others, and their followers grow.", cost: 100_000, reputation: 10, returnRange: [-0.1, 0.4], upkeep: 0, reputationPerSeason: 0 },
  range: { label: "Driving range franchise", blurb: "Buckets of balls, every day of the year: steady money.", cost: 400_000, reputation: 15, returnRange: [0.06, 0.1], upkeep: 0, reputationPerSeason: 0 },
  fitting: { label: "Club-fitting studio", blurb: "Fits tour players and weekend golfers; equipment brands pay your clients more.", cost: 600_000, reputation: 20, returnRange: [0.03, 0.09], upkeep: 0, reputationPerSeason: 0 },
  foundation: { label: "Charitable foundation", blurb: "Junior golf and community work. Costs every year; earns respect and fans.", cost: 500_000, reputation: 25, returnRange: [0, 0], upkeep: 250_000, reputationPerSeason: 2 },
  invitational: { label: "Your own invitational", blurb: "An event with your name on it. Sponsors and gate money pay for it in a good year.", cost: 4_000_000, reputation: 50, returnRange: [-0.05, 0.25], upkeep: 400_000, reputationPerSeason: 2.5 },
  brandStake: { label: "Equipment brand stake", blurb: "A share of a club maker. Returns swing with the market.", cost: 3_000_000, reputation: 40, returnRange: [-0.15, 0.3], upkeep: 0, reputationPerSeason: 0 },
  course: { label: "A golf course", blurb: "Steady green-fee income, and a home for your players' practice.", cost: 8_000_000, reputation: 60, returnRange: [0.03, 0.08], upkeep: 0, reputationPerSeason: 0.5 },
  techStake: { label: "Sports-tech startup stake", blurb: "Launch monitors and swing analytics: it might be the next big thing, or nothing at all.", cost: 12_000_000, reputation: 75, returnRange: [-0.3, 0.6], upkeep: 0, reputationPerSeason: 0 },
  titleEvent: { label: "Tour event title partnership", blurb: "Your name on a tour event, and a sponsor's invitation into it for every client who needs one.", cost: 20_000_000, reputation: 75, returnRange: [0, 0.12], upkeep: 0, reputationPerSeason: 3 },
  resort: { label: "Destination golf resort", blurb: "A world-class resort and training base: rooms, rounds and reputation, and clients carry fatigue better.", cost: 40_000_000, reputation: 90, returnRange: [0.04, 0.09], upkeep: 0, reputationPerSeason: 2 },
};

export const owns = (world: World, kind: InvestmentKind): boolean => (world.agency.investments ?? []).some((i) => i.kind === kind);

/** The tour event a title partnership is with (a regular event, fixed when you buy in). */
export const titleEvent = (world: World): string | undefined => (world.agency.investments ?? []).find((i) => i.kind === "titleEvent")?.eventId;

export interface Investment {
  kind: InvestmentKind;
  since: number;
  /** What it cost; the base for returns and a sale. */
  stake: number;
  /** Last winter's result, for the screen. */
  last?: number;
  /** A title partnership's event. */
  eventId?: string;
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
  // A title partnership takes the richest regular event on the schedule.
  const event = kind === "titleEvent" ? [...world.schedule].filter((e) => e.tier === "standard").sort((a, b) => b.purse - a.purse)[0] : undefined;
  (world.agency.investments ??= []).push({ kind, since: world.season, stake: d.cost, ...(event ? { eventId: event.id } : {}) });
  world.news.unshift(`${world.agency.name} invests in ${d.label.toLowerCase()} (${Math.round(d.cost / 1e5) / 10}M).`);
}

export function sellInvestment(world: World, kind: InvestmentKind): number {
  const list = investmentsOf(world);
  const inv = list.find((i) => i.kind === kind);
  if (!inv) return 0;
  // Investment counsel gets a better price.
  const back = Math.round(inv.stake * (hasSkill(world, "investment-counsel") ? 0.85 : SALE_SHARE));
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
    const result = Math.round(inv.stake * (lo + rng.next() * (hi - lo) + (hasSkill(world, "investment-counsel") ? 0.01 : 0)) - d.upkeep);
    inv.last = result;
    world.agency.bank += result;
    world.agency.ledger.investments = (world.agency.ledger.investments ?? 0) + result;
    if (d.reputationPerSeason) addReputation(world.agency, d.reputationPerSeason);
  }
}

/** Winter: the podcast grows clients' followers. */
export function mediaSeasonEnd(world: World): void {
  if (!owns(world, "media")) return;
  for (const id of world.clientIds) {
    const c = world.players[id]?.client;
    if (c?.followers) c.followers = Math.round(c.followers * 1.03);
  }
}

/** The academy's chance, each winter, of a junior worth representing: better the longer it has run. */
export const academyChance = (world: World): number => {
  const a = (world.agency.investments ?? []).find((i) => i.kind === "academy");
  return a ? Math.min(0.5, 0.3 + (world.season - a.since) * 0.05) : 0;
};

/**
 * Winter: maybe one of the academy's juniors asks you to represent him. He's
 * the best of three, fully known to your coaches, on your recruitment board,
 * leans your way for years, and rivals leave him alone while he's an amateur.
 */
export function academyIntake(world: World, rng: Rng, make: (age: number) => WorldPlayer): WorldPlayer | null {
  // No academy, no roll: the world's random sequence is untouched.
  const chance = academyChance(world);
  if (!chance || !rng.chance(chance)) return null;
  const pick = [0, 1, 2].map(() => make(rng.pick([16, 17, 18]))).sort((a, b) => b.development.potential - a.development.potential)[0]!;
  pick.academy = true;
  world.players[pick.player.id] = pick;
  world.agency.knowledge[pick.player.id] = { accuracy: 1, reports: 3, absWeek: absWeek(world.season, world.week) };
  (world.agency.shortlist ??= []).push(pick.player.id);
  (world.agency.referrals ??= {})[pick.player.id] = world.season + 8;
  world.news.unshift(`${pick.player.name}, ${pick.player.age}, from your academy, asks whether you'd represent him when he turns pro. He's on your recruitment board.`);
  return pick;
}
