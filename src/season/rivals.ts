/**
 * The rival agencies. Each has a reputation and a way of doing business:
 * the star hunter chases the world's best with low commission, the
 * developers back young players and coach them hard, the volume shops sign
 * anyone with a card and coach on the cheap, the boutique keeps a short,
 * well-coached list. Their coaching and winters decide how their players
 * develop, they fund development deals for the young players they believe
 * in, and every player who comes free (an expiring deal, a free agent, an
 * amateur turning pro) goes to the best bid: theirs, or yours if you got
 * there first.
 *
 * Coaching is centred so the tour as a whole develops as it did before
 * rivals had styles (the realism report checks the career curve): good
 * agencies lift their players, cheap ones hold theirs back.
 */
import { boardSigningMessages, relationshipOf } from "./rivalAgents";
import { clamp, createRng, type Rng } from "../engine";
import { STANDARD_COMMISSION, expectedReputation } from "./agency";
import { impliedStaff, overall } from "./development";
import { mixSeed } from "./entries";
import { earningsAtLevel } from "./finance";
import { rankMap } from "./points";
import { commissionWeight, effectivePeak } from "./traits";
import type { CoachRole, RivalAgency, RivalStyle, WinterProgram, World, WorldPlayer } from "./types";

export interface StyleDef {
  label: string;
  blurb: string;
  /** Coach quality against a player's implied staff, every role. */
  coach: number;
  /** The commission it offers. */
  commission: number;
  /** How many players it will carry. */
  capacity: number;
  /** Development deals it will fund at once. */
  deals: number;
  /** How much it wants a player, before reputation (below 0.5: not at all). */
  appetite: (wp: WorldPlayer, worth: number) => number;
}

const young = (wp: WorldPlayer) => wp.player.age <= 25;

export const RIVAL_STYLES: Record<RivalStyle, StyleDef> = {
  starHunter: {
    label: "Star hunter",
    blurb: "Chases the world's best with low commission; coaching is the player's business.",
    coach: 0,
    commission: 0.07,
    capacity: 36,
    deals: 1,
    appetite: (_wp, worth) => (worth >= 3_000_000 ? 2 : worth >= 1_500_000 ? 1 : 0.15),
  },
  developer: {
    label: "Developer",
    blurb: "Backs young players early, funds development deals and coaches them hard.",
    coach: 1,
    commission: 0.1,
    capacity: 40,
    deals: 5,
    appetite: (wp, worth) => (young(wp) ? 1.8 : worth >= 1_500_000 ? 0.8 : 0.35),
  },
  volume: {
    label: "Volume shop",
    blurb: "Signs anyone with a card at a high commission, and coaches on the cheap.",
    coach: -1.5,
    commission: 0.12,
    capacity: 60,
    deals: 0,
    appetite: (wp) => (wp.career.status === "none" ? 0.6 : 1),
  },
  boutique: {
    label: "Boutique",
    blurb: "A short list of good players, the best coaching money can buy.",
    coach: 2,
    commission: 0.1,
    capacity: 22,
    deals: 3,
    appetite: (_wp, worth) => (worth >= 1_200_000 ? 1.4 : 0.2),
  },
};

/** The six rivals and where each starts. */
export const RIVAL_PROFILES: { name: string; style: RivalStyle; reputation: number }[] = [
  { name: "Apex Sports Management", style: "starHunter", reputation: 82 },
  { name: "Fairway Global", style: "volume", reputation: 58 },
  { name: "Links & Co.", style: "boutique", reputation: 60 },
  { name: "Pinnacle Talent", style: "developer", reputation: 66 },
  { name: "Clubhouse Partners", style: "volume", reputation: 44 },
  { name: "Eagle Rock Agency", style: "developer", reputation: 50 },
];

/**
 * Coaching shift that keeps the tour's average development where it was (see
 * the header), for each age group: the young sit with developers and on deals
 * more often, so their centre is lower and rookies still develop as real ones do.
 */
export const COACH_CENTRE = 0.4;
export const YOUNG_COACH_CENTRE = -0.2;
/** A player without an agent works things out alone. */
export const FREE_AGENT_COACH = -1;
/** Extra coach quality a development deal pays for. */
export const DEAL_COACH = 1.5;

export function ensureRivals(world: World): RivalAgency[] {
  world.rivals ??= RIVAL_PROFILES.map((r) => ({ ...r, repHistory: [], moves: [] }));
  return world.rivals;
}

export const rivalNamed = (world: World, name: string): RivalAgency | undefined => ensureRivals(world).find((r) => r.name === name);

export const rivalStyle = (world: World, name: string): StyleDef | undefined => {
  const r = rivalNamed(world, name);
  return r ? RIVAL_STYLES[r.style] : undefined;
};

/** A computer player's coaches: his implied staff, raised or lowered by his agency and any deal it funds. */
export function rivalCoaching(world: World, wp: WorldPlayer): Partial<Record<CoachRole, number>> {
  const base = impliedStaff(wp);
  if (wp.career.status === "amateur") return base;
  const style = wp.agent ? rivalStyle(world, wp.agent.agency) : undefined;
  const shift = (young(wp) ? YOUNG_COACH_CENTRE : COACH_CENTRE) + (wp.agent ? (style?.coach ?? 0) + (wp.agent.deal ? DEAL_COACH : 0) : FREE_AGENT_COACH);
  if (!shift) return base;
  const out: Partial<Record<CoachRole, number>> = {};
  for (const [k, q] of Object.entries(base) as [CoachRole, number][]) out[k] = clamp(q + shift, 1, 20);
  return out;
}

/** What a player is worth to an agency: a season's earnings at the level it expects him to reach soon. */
export function playerWorth(wp: WorldPlayer): number {
  const level = overall(wp.player);
  const room = Math.max(0, wp.development.potential - level);
  // Young players are bought on promise: about half the way to their ceiling.
  const toPeak = Math.max(0, effectivePeak(wp) - wp.player.age);
  const promise = young(wp) ? room * Math.min(1, toPeak / 6) * 0.5 : 0;
  return earningsAtLevel(level + promise);
}

export interface RivalBid {
  agency: string;
  commission: number;
  years: number;
  /** How good the offer looks to the player (higher is better). */
  appeal: number;
}

const idNum = (id: string) => Number(id.replace(/\D/g, "")) || 1;

/** How a player rates an agency's offer: reputation against what he expects, commission, and loyalty. */
export function offerAppeal(world: World, wp: WorldPlayer, reputation: number, commission: number, current: boolean): number {
  return reputation - expectedReputation(world, wp.player.id) + (STANDARD_COMMISSION - commission) * 100 * 3 * commissionWeight(wp) + (current ? 5 : 0);
}

export function rosterSizes(world: World): Map<string, number> {
  const out = new Map<string, number>();
  for (const wp of Object.values(world.players)) if (!wp.client && wp.agent) out.set(wp.agent.agency, (out.get(wp.agent.agency) ?? 0) + 1);
  return out;
}

/** List sizes once this season's expiring deals have run out: the room each rival has for the winter market. */
export function winterRoster(world: World): Map<string, number> {
  const out = new Map<string, number>();
  for (const wp of Object.values(world.players)) if (!wp.client && wp.agent && wp.agent.untilSeason > world.season) out.set(wp.agent.agency, (out.get(wp.agent.agency) ?? 0) + 1);
  return out;
}

/**
 * The rivals' offers for a player this winter, best first. The same each
 * time it is asked in a season, so the screen and the market agree.
 */
export function rivalBids(world: World, id: string, roster: Map<string, number> = winterRoster(world)): RivalBid[] {
  const wp = world.players[id];
  if (!wp || wp.client) return [];
  // Your academy's juniors are yours to approach first.
  if (wp.academy && wp.career.status === "amateur") return [];
  const worth = playerWorth(wp);
  const needed = expectedReputation(world, id);
  const out: RivalBid[] = [];
  ensureRivals(world).forEach((r, i) => {
    const style = RIVAL_STYLES[r.style];
    const current = wp.agent?.agency === r.name;
    if ((roster.get(r.name) ?? 0) >= style.capacity) return;
    // Nobody chases a player who would laugh at them.
    if (needed - r.reputation > 30) return;
    const rng = createRng(mixSeed(world.seed, world.season, 1401, idNum(id), i + 1));
    // A rival whose scout found him on your trip wants him more.
    const want = style.appetite(wp, worth) * (0.7 + rng.next() * 0.6) * (world.agency.contested?.[id] === r.name ? 1.5 : 1);
    if (want < 0.5) return;
    // Keen agencies shade their commission a little.
    const commission = Math.round((style.commission - (want >= 1.5 ? 0.01 : 0)) * 100) / 100;
    const years = young(wp) ? 3 : wp.player.age >= 36 ? 1 : 2;
    out.push({ agency: r.name, commission, years, appeal: offerAppeal(world, wp, r.reputation, commission, current) + rng.normal(0, 4) });
  });
  return out.sort((a, b) => b.appeal - a.appeal);
}

/** The strongest rival offer you are up against for a player, if any. */
export function competingBid(world: World, id: string): RivalBid | null {
  const wp = world.players[id];
  if (!wp || wp.client) return null;
  // A player under contract isn't on the market until his final season.
  if (wp.agent && wp.agent.untilSeason > world.season) return null;
  return rivalBids(world, id)[0] ?? null;
}

/** Ends a line with one full stop ("Links & Co." already has one). */
const sentence = (s: string) => (s.endsWith(".") ? s : `${s}.`);

const fmtRank = (rank: number | undefined) => (rank && rank <= 300 ? ` (world #${rank})` : "");

/**
 * The winter market: everyone who is free goes to the best bid, most valuable
 * first. Players nobody wants (or who want nobody) stay free agents. With
 * `initial`, everyone is on the market (a new world) and contracts are staggered.
 */
export function rivalMarket(world: World, opts: { initial?: boolean } = {}): string[] {
  const rivals = ensureRivals(world);
  const ranks = rankMap(world);
  const rng = createRng(mixSeed(world.seed, world.season, 1402));
  const pool = Object.values(world.players).filter(
    (wp) => !wp.client && wp.career.status !== "amateur" && (opts.initial || !wp.agent || wp.agent.untilSeason <= world.season),
  );
  if (opts.initial) for (const wp of pool) wp.agent = null;
  // Players whose deal is ending don't count against their agency's list while they choose.
  const roster = opts.initial ? new Map<string, number>() : winterRoster(world);
  const news: string[] = [];
  const signed: { agency: string; name: string; id: string }[] = [];
  if (!opts.initial) for (const r of rivals) r.moves = [];
  const worth = new Map(pool.map((wp) => [wp.player.id, playerWorth(wp)]));
  pool.sort((a, b) => worth.get(b.player.id)! - worth.get(a.player.id)! || a.player.id.localeCompare(b.player.id));
  for (const wp of pool) {
    const before = wp.agent?.agency ?? null;
    const bids = rivalBids(world, wp.player.id, roster);
    const best = bids[0];
    // A player without status takes almost anything; one with status won't sign a bad deal.
    const floor = wp.career.status === "none" ? -25 : -15;
    if (!best || best.appeal < floor) {
      if (before && !opts.initial) rivalNamed(world, before)?.moves.unshift(`${wp.player.name} leaves as a free agent.`);
      wp.agent = null;
      continue;
    }
    const years = opts.initial ? rng.int(0, 2) : best.years;
    // A development deal carries on when he re-signs with the same agency.
    const deal = before === best.agency && wp.agent?.deal;
    wp.agent = { agency: best.agency, untilSeason: world.season + years, commission: best.commission, ...(deal ? { deal: true } : {}) };
    roster.set(best.agency, (roster.get(best.agency) ?? 0) + 1);
    if (opts.initial) continue;
    const rank = ranks.get(wp.player.id);
    const fresh = wp.career.results.every((x) => x.season === world.season && x.tier === "dev") && wp.player.age <= 23;
    const notable = (rank !== undefined && rank <= 60) || (fresh && worth.get(wp.player.id)! >= 1_500_000);
    const rival = rivalNamed(world, best.agency)!;
    if (before === best.agency) {
      rival.moves.unshift(`Re-signs ${wp.player.name}${fmtRank(rank)} at ${Math.round(best.commission * 100)}%.`);
    } else {
      const rivalBid = bids.find((b) => b.agency !== best.agency && b.agency !== before);
      const beat = rivalBid ? `, beating ${rivalBid.agency}` : "";
      const who = fresh ? " (turning pro)" : fmtRank(rank);
      rival.moves.unshift(sentence(`Signs ${wp.player.name}${who}${before ? ` from ${before}` : ""} at ${Math.round(best.commission * 100)}%${beat}`));
      if (before) rivalNamed(world, before)?.moves.unshift(sentence(`Loses ${wp.player.name} to ${best.agency}`));
      if (notable) news.push(sentence(`${best.agency} sign ${wp.player.name}${who}${before ? ` from ${before}` : ""}${beat}`));
      signed.push({ agency: best.agency, name: wp.player.name, id: wp.player.id });
    }
  }
  // Anyone off your recruitment board: their agent lets you know.
  boardSigningMessages(world, signed);
  return news;
}

/** The winter a rival picks for a player: camps for the young it backs, fitness for veterans, rest for the tired. */
export function rivalWinter(style: RivalStyle, wp: WorldPlayer): WinterProgram {
  if (style === "volume") return "standard";
  if (wp.agent?.deal) return "camp";
  if (wp.player.age >= 34) return style === "starHunter" ? "standard" : "fitness";
  if (style === "starHunter" && wp.player.form < -0.2) return "rest";
  return "standard";
}

/**
 * The winter's plans for each rival's players: development deals for the
 * young players it believes in (an extra season on the contract in return),
 * and a winter programme for everyone.
 */
export function planRivalWinters(world: World): void {
  const byAgency = new Map<string, WorldPlayer[]>();
  for (const wp of Object.values(world.players)) {
    if (wp.client || !wp.agent) continue;
    (byAgency.get(wp.agent.agency) ?? byAgency.set(wp.agent.agency, []).get(wp.agent.agency)!).push(wp);
  }
  const room = (wp: WorldPlayer) => wp.development.potential - overall(wp.player);
  for (const r of ensureRivals(world)) {
    const style = RIVAL_STYLES[r.style];
    const list = byAgency.get(r.name) ?? [];
    // Deals end when the player has grown up or has nowhere left to go.
    for (const wp of list) {
      if (wp.agent!.deal && (wp.player.age >= 27 || room(wp) < 0.4)) {
        delete wp.agent!.deal;
        r.moves.unshift(`Ends its development deal with ${wp.player.name}.`);
      }
    }
    const open = style.deals - list.filter((wp) => wp.agent!.deal).length;
    const candidates = list
      .filter((wp) => !wp.agent!.deal && wp.player.age <= 24 && room(wp) >= 1.2)
      .sort((a, b) => room(b) - room(a) || a.player.id.localeCompare(b.player.id));
    for (const wp of candidates.slice(0, Math.max(0, open))) {
      wp.agent!.deal = true;
      wp.agent!.untilSeason = Math.max(wp.agent!.untilSeason, world.season + 2);
      r.moves.unshift(`Funds a development deal for ${wp.player.name} (${wp.player.age}).`);
    }
    for (const wp of list) wp.agent!.winter = rivalWinter(r.style, wp);
  }
}

/**
 * A rival's reputation after a season moves a quarter of the way towards what
 * its best ten players earned against the leading agency's best ten (a big
 * list of journeymen doesn't make a name), plus a little for majors.
 */
export function rivalReputations(world: World): void {
  const earned = new Map<string, number[]>();
  const majors = new Map<string, number>();
  for (const wp of Object.values(world.players)) {
    if (wp.client || !wp.agent) continue;
    (earned.get(wp.agent.agency) ?? earned.set(wp.agent.agency, []).get(wp.agent.agency)!).push(wp.career.seasonEarnings);
    const m = wp.career.results.filter((x) => x.season === world.season && x.tier === "major" && x.position === 1).length;
    if (m) majors.set(wp.agent.agency, (majors.get(wp.agent.agency) ?? 0) + m);
  }
  const top = (name: string) => (earned.get(name) ?? []).sort((a, b) => b - a).slice(0, 10).reduce((t, x) => t + x, 0);
  const best = Math.max(1, ...ensureRivals(world).map((r) => top(r.name)));
  for (const r of ensureRivals(world)) {
    const target = Math.min(100, 20 + 70 * (top(r.name) / best) ** 0.7 + 3 * (majors.get(r.name) ?? 0));
    r.reputation = clamp(Math.round((r.reputation * 0.75 + target * 0.25) * 10) / 10, 5, 100);
    r.repHistory.push(r.reputation);
    if (r.repHistory.length > 30) r.repHistory.shift();
  }
}

/** The rivals' whole winter, in order: reputations, the market, then deals and winter plans. */
export function rivalSeasonEnd(world: World): string[] {
  rivalReputations(world);
  const news = rivalMarket(world);
  planRivalWinters(world);
  return news;
}

/** The rival most likely to come for a player (poaching): its best bidder, or any rival. */
export function likeliestSuitor(world: World, id: string, rng: Rng): string {
  // Hostile agents come for your players first.
  const bids = rivalBids(world, id).sort((a, b) => b.appeal - relationshipOf(world, b.agency) / 10 - (a.appeal - relationshipOf(world, a.agency) / 10));
  return bids[0]?.agency ?? rng.pick(ensureRivals(world)).name;
}

/** Every rival with its style, list size and deals, for the Rivals screen. */
export function rivalSummaries(world: World): { rival: RivalAgency; style: StyleDef; players: number; deals: number }[] {
  const roster = rosterSizes(world);
  const deals = new Map<string, number>();
  for (const wp of Object.values(world.players)) if (!wp.client && wp.agent?.deal) deals.set(wp.agent.agency, (deals.get(wp.agent.agency) ?? 0) + 1);
  return ensureRivals(world).map((r) => ({ rival: r, style: RIVAL_STYLES[r.style], players: roster.get(r.name) ?? 0, deals: deals.get(r.name) ?? 0 }));
}
