/**
 * The negotiation table: signing a player or extending a client becomes a
 * back-and-forth of up to four rounds. Signing talks run in weeks: the agency
 * makes one offer a week, and he takes his time over each (usually two to
 * four weeks for the first, a week or two after that; now and then he answers
 * on the spot, now and then he keeps you waiting). Other agencies' interest is
 * known, never their terms. He has a hidden bar, drawn once from
 * the same odds a straight offer would have (so a deal that was 60% likely
 * still is): offers that clear it are accepted; ones that don't get a counter
 * with the smallest change that would (a lower commission, a different
 * length, a promise), and cost him patience. A lowball costs double. When his
 * patience runs out he walks, and won't talk again for four weeks. A rival
 * bidding for him may raise its offer while you talk.
 */
import { bump } from "./achievements";
import { createRng } from "../engine";
import { acceptChance, applyExtension, approachBlock, extendChance, signClient, type Offer } from "./agency";
import { mixSeed } from "./entries";
import { MAX_PROMISES, PROMISES, makePromises, trustOf, type PromiseKind } from "./promises";
import { firstCall } from "./recruiting";
import { competingBid } from "./rivals";
import { bidPressure } from "./rivalAgents";
import { has } from "./traits";
import { teamOf } from "./ryderCup";
import { absWeek, type World, type WorldPlayer } from "./types";
import { describeExtras, type DealExtras } from "./contractTerms";
import { rivalBids } from "./rivals";
import { extensionWindow, leverage, maxYears, playCard, windowWeek, type CardId, type Wish } from "./extensions";

export interface Terms {
  commission: number;
  years: number;
  promises: PromiseKind[];
  extras?: DealExtras;
}

export interface NegotiationLine {
  by: "you" | "him" | "rival";
  text: string;
  terms?: Terms;
}

export interface Negotiation {
  playerId: string;
  kind: "sign" | "extend";
  round: number;
  patience: number;
  patienceMax: number;
  /** Hidden: the acceptance odds his bar sits at (an offer at least this likely is accepted). */
  bar: number;
  lines: NegotiationLine[];
  /** His latest counter-offer, if any: accepting it closes the deal. */
  counter: Terms | null;
  status: "open" | "agreed" | "walked";
  /** The rival bidding against you (signings), and whether it has raised yet. */
  rival?: { agency: string; raised: boolean };
  /** The offer he's thinking over, and the week he'll answer. */
  pending?: { terms: Terms; answerAbsWeek: number; agentWhenAsked?: string };
  /** Extension talks: the week of your last offer (one a week). */
  offerWeek?: number;
  /** Staff cards in play: rounds added, a boost for the next offer, a wish the next offer counts as meeting. */
  extraRounds?: number;
  boost?: number;
  fill?: Wish;
  /** He's already told you he wants to see what's out there. */
  tested?: boolean;
}

export const MAX_ROUNDS = 4;
export const WALK_COOLDOWN = 4;
/** An offer this far below his bar is a lowball: it costs two patience. */
const LOWBALL = 0.25;
const MIN_COMMISSION = 0.05;

const pct = (x: number) => `${Math.round(x * 100)}%`;
const idNum = (id: string) => Number(id.replace(/\D/g, "")) || 1;
const step = (c: number) => Math.round((c - 0.01) * 100) / 100;

/** The talks with this player: signing talks run over weeks, an extension at the table. */
export function negotiationFor(world: World, playerId?: string): Negotiation | undefined {
  if (playerId === undefined) return world.negotiation;
  return world.talks?.[playerId] ?? (world.negotiation?.playerId === playerId ? world.negotiation : undefined);
}

/** Rounds these talks can run: four, plus any your renewal specialist buys. */
export const roundsFor = (n: Negotiation): number => MAX_ROUNDS + (n.extraRounds ?? 0);

export const activeNegotiation = (world: World, playerId?: string): Negotiation | null => {
  const n = negotiationFor(world, playerId);
  return n?.status === "open" ? n : null;
};

/** Why another signing offer can't go in now, or null: one a week, and none while he's thinking one over. */
export function offerBlock(world: World, n: Negotiation): string | null {
  if (n.pending) return "He's still thinking over your last offer.";
  if (n.kind === "extend") return n.offerWeek === absWeek(world.season, world.week) ? "You've made him this week's offer; you can make another next week." : null;
  if (world.agency.offerWeek === absWeek(world.season, world.week)) return "You've made this week's offer; you can make another next week.";
  return null;
}

/** How long he takes over an offer: two to four weeks for the first (a bell curve: some answer at once, some keep you waiting), a week or two after that. */
export function answerDelay(world: World, n: Negotiation): number {
  const rng = createRng(mixSeed(world.seed, world.season, world.week, 1902, idNum(n.playerId), n.round));
  // Your own client knows you: on the spot now and then, otherwise a week or two.
  if (n.kind === "extend") return rng.chance(0.25) ? 0 : rng.chance(0.6) ? 1 : 2;
  if (n.round > 1) return rng.chance(0.3) ? 2 : 1;
  if (rng.chance(0.07)) return 0;
  return Math.max(1, Math.min(8, Math.round(rng.normal(3, 1))));
}

/** The rival agencies after a player: their names, never their terms. */
export const interestedAgencies = (world: World, playerId: string): string[] => [...new Set(rivalBids(world, playerId).map((b) => b.agency))].slice(0, 3);

/** The odds he'd accept these terms (the same as a straight offer). */
export function termsChance(world: World, n: Pick<Negotiation, "playerId" | "kind"> & Partial<Pick<Negotiation, "boost" | "fill">>, t: Terms): number {
  const offer: Offer = { commission: t.commission, years: t.years, promises: t.promises, ...(t.extras ? { extras: t.extras } : {}) };
  return n.kind === "sign" ? acceptChance(world, n.playerId, offer) : extendChance(world, n.playerId, { ...offer, ...(n.boost ? { boost: n.boost } : {}), ...(n.fill ? { fill: n.fill } : {}) });
}

function patienceFor(wp: WorldPlayer, kind: "sign" | "extend"): number {
  let p = 3;
  if (has(wp, "hard-bargainer")) p -= 1;
  if (has(wp, "loyal") && kind === "extend") p += 1;
  if (kind === "extend") p += trustOf(wp) >= 75 ? 1 : trustOf(wp) < 40 ? -1 : 0;
  return Math.max(1, Math.min(5, p));
}

/** Opens talks with a player (to sign) or a client (to extend). Returns why it can't, or null. */
export function startNegotiation(world: World, playerId: string, kind: "sign" | "extend"): string | null {
  const wp = world.players[playerId];
  if (!wp) return "Unknown player.";
  if (kind === "sign") {
    // Talks already going: pick them up where they are.
    if (world.talks?.[playerId]?.status === "open") return null;
    const block = approachBlock(world, playerId);
    if (block) return block;
  } else {
    if (!wp.client) return "He isn't your client.";
    if (world.talks?.[playerId]?.status === "open") return null;
    const until = world.agency.cooldowns[playerId];
    if (until !== undefined && until > absWeek(world.season, world.week)) return "He's not ready to talk again yet.";
    const win = extensionWindow(world, playerId);
    if (!win.open) return win.reason;
  }
  const rng = createRng(mixSeed(world.seed, world.season, world.week, 1901, idNum(playerId), kind === "sign" ? 1 : 2));
  const patience = patienceFor(wp, kind);
  // A keen pro on first call hears you before the other agencies bid.
  const bid = kind === "sign" && !firstCall(world, playerId) ? competingBid(world, playerId) : null;
  const talks: Negotiation = {
    playerId,
    kind,
    round: 0,
    patience,
    patienceMax: patience,
    // His bar: an offer is accepted when its odds reach it, so each offer's odds are its real chance.
    bar: rng.next(),
    lines: [{ by: "him", text: kind === "sign" ? `${wp.player.name} is listening. What are you offering?` : wp.client && wp.client.contract.untilSeason > world.season ? `${wp.player.name} is happy to talk a season early.` : `${wp.player.name} wants to hear what you have in mind.` }],
    counter: null,
    status: "open",
    ...(bid ? { rival: { agency: bid.agency, raised: false } } : {}),
  };
  (world.talks ??= {})[playerId] = talks;
  return null;
}

const allowedPromises = (wp: WorldPlayer, taken: PromiseKind[]) => PROMISES.filter((p) => !taken.includes(p.kind) && (p.kind !== "ryderCup" || teamOf(wp) !== null));

/** The smallest change to your offer that would get a yes (or the best he could hope for). */
function findCounter(world: World, n: Negotiation, t: Terms): Terms {
  const wp = world.players[n.playerId]!;
  const ok = (x: Terms) => termsChance(world, n, x) >= n.bar;
  const otherLength = wp.player.age <= 27 ? Math.min(3, t.years + 1) : Math.max(1, t.years - 1);
  // A client re-signing moves at most two points: past that, he'd rather see what the market says.
  const floor = n.kind === "extend" ? Math.max(MIN_COMMISSION, Math.round((t.commission - 0.02) * 100) / 100) : MIN_COMMISSION;
  // 1) a lower commission, a point at a time (or a different length at the same price).
  for (let c = t.commission; c >= floor - 1e-9; c = step(c)) {
    for (const x of [{ ...t, commission: c }, { ...t, commission: c, years: otherLength }]) if (ok(x)) return x;
  }
  // 2) a promise he'd value, with the commission cut as little as possible.
  if (t.promises.length < MAX_PROMISES) {
    for (let c = t.commission; c >= floor - 1e-9; c = step(c)) {
      for (const p of allowedPromises(wp, t.promises)) {
        const x = { ...t, commission: c, promises: [...t.promises, p.kind] };
        if (ok(x)) return x;
      }
    }
  }
  // 3) nothing reaches his bar: the best terms going, his final word.
  const best = allowedPromises(wp, t.promises)
    .sort((a, b) => b.appeal(wp, 999) - a.appeal(wp, 999))
    .slice(0, Math.max(0, MAX_PROMISES - t.promises.length))
    .map((p) => p.kind);
  return { commission: floor, years: t.years, promises: [...t.promises, ...best], ...(t.extras ? { extras: t.extras } : {}) };
}

export function describeTerms(t: Terms): string {
  const promises = t.promises.length ? `, and ${t.promises.map((k) => PROMISES.find((p) => p.kind === k)!.label.toLowerCase()).join(" and ")}` : "";
  const extras = describeExtras(t.extras);
  return `${pct(t.commission)} for ${t.years} season${t.years === 1 ? "" : "s"}${extras ? ` (${extras})` : ""}${promises}`;
}

function close(world: World, n: Negotiation, t: Terms): void {
  const wp = world.players[n.playerId]!;
  const offer: Offer = { commission: t.commission, years: t.years, promises: t.promises, ...(t.extras ? { extras: t.extras } : {}) };
  n.status = "agreed";
  n.counter = null;
  if (n.kind === "sign") {
    signClient(world, n.playerId, offer);
    makePromises(world, wp, t.promises);
    n.lines.push({ by: "him", text: `"Deal." ${wp.player.name} signs with ${world.agency.name}: ${describeTerms(t)}.`, terms: t });
  } else {
    applyExtension(world, n.playerId, offer);
    n.lines.push({ by: "him", text: `"Deal." ${wp.player.name} stays until the end of season ${wp.client?.contract.untilSeason ?? world.season + t.years}.`, terms: t });
  }
}

function walk(world: World, n: Negotiation): void {
  const wp = world.players[n.playerId]!;
  n.status = "walked";
  n.counter = null;
  // A client walking out in his final season has made up his mind: he'll test the market (only your dispute settler can talk him round).
  const final = n.kind === "extend" && !!wp.client && wp.client.contract.untilSeason <= world.season;
  // Early talks that break down wait for his final-season window.
  const early = n.kind === "extend" && !!wp.client && wp.client.contract.untilSeason > world.season;
  world.agency.cooldowns[n.playerId] = final ? absWeek(world.season + 1, 0) : early ? absWeek(world.season + 1, windowWeek(world)) : absWeek(world.season, world.week) + WALK_COOLDOWN;
  n.lines.push({ by: "him", text: final ? `${wp.player.name} has heard enough. He'll see what the market says when his deal runs out.` : early ? `${wp.player.name} would rather wait: he'll talk again in his final season.` : `${wp.player.name} has heard enough and walks away. He won't talk again for ${WALK_COOLDOWN} weeks.` });
  world.news.unshift(`${wp.player.name} walks out of talks with ${world.agency.name}.`);
}

/** You put terms on the table. */
export function makeOffer(world: World, t: Terms, playerId?: string): Negotiation | null {
  const n = activeNegotiation(world, playerId);
  if (!n || offerBlock(world, n)) return null;
  const longest = n.kind === "extend" ? maxYears(world, world.players[n.playerId]!) : 3;
  const terms: Terms = { commission: Math.min(0.2, Math.max(MIN_COMMISSION, t.commission)), years: Math.min(longest, Math.max(1, t.years)), promises: t.promises.slice(0, MAX_PROMISES), ...(t.extras ? { extras: t.extras } : {}) };
  n.round++;
  n.lines.push({ by: "you", text: `You offer ${describeTerms(terms)}.`, terms });
  {
    // He takes his time: the answer comes in a later week (or, now and then, on the spot).
    if (n.kind === "sign") world.agency.offerWeek = absWeek(world.season, world.week);
    else n.offerWeek = absWeek(world.season, world.week);
    n.counter = null;
    const delay = answerDelay(world, n);
    if (delay > 0) {
      const agent = world.players[n.playerId]?.agent?.agency;
      n.pending = { terms, answerAbsWeek: absWeek(world.season, world.week) + delay, ...(agent ? { agentWhenAsked: agent } : {}) };
      n.lines.push({ by: "him", text: n.round === 1 ? `"Let me think it over."` : `"I'll come back to you."` });
      return n;
    }
  }
  return answer(world, n, terms);
}

/** His answer to an offer: yes, a counter, or (patience gone) he walks. */
function answer(world: World, n: Negotiation, terms: Terms): Negotiation {
  const chance = termsChance(world, n, terms);
  // A card's boost and wish are for one offer only.
  delete n.boost;
  delete n.fill;
  if (chance >= n.bar) {
    close(world, n, terms);
    return n;
  }
  n.patience -= chance < n.bar - LOWBALL ? 2 : 1;
  if (n.patience <= 0 || n.round >= roundsFor(n)) {
    walk(world, n);
    return n;
  }
  // A client with a strong hand wants to see what's out there first (once): the rivals get a look in.
  if (n.kind === "extend" && !n.tested && leverage(world, n.playerId) >= 60) {
    n.tested = true;
    const c = world.players[n.playerId]!.client!;
    c.tapped = Math.min(40, (c.tapped ?? 0) + 8);
    n.lines.push({ by: "him", text: `"I'm not saying no. But the way I'm playing, I want to see what's out there first."` });
  }
  // A rival bidding for him comes back with more while you talk.
  if (n.rival && !n.rival.raised && n.round >= 2) {
    n.rival.raised = true;
    n.bar = Math.min(0.99, n.bar + 0.05 * bidPressure(world, n.rival.agency));
    n.lines.push({ by: "rival", text: `${n.rival.agency} hear you're talking and sweeten their offer.` });
  }
  const counter = findCounter(world, n, terms);
  n.counter = counter;
  const final = termsChance(world, n, counter) < n.bar;
  n.lines.push({
    by: "him",
    text: final ? `"Even ${describeTerms(counter)} wouldn't quite do it. I'm close to walking."` : `"Make it ${describeTerms(counter)} and we have a deal."`,
    terms: counter,
  });
  return n;
}

/** You take his counter-offer. */
export function acceptCounter(world: World, playerId?: string): Negotiation | null {
  const n = activeNegotiation(world, playerId);
  if (!n || !n.counter) return null;
  const t = n.counter;
  n.lines.push({ by: "you", text: `You accept: ${describeTerms(t)}.`, terms: t });
  if (termsChance(world, n, t) >= n.bar) {
    close(world, n, t);
    bump(world, "counterDeals");
    delete n.boost;
    delete n.fill;
  }
  else walk(world, n);
  return n;
}

/** You leave the table: no harm done, but no deal. */
export function abandonNegotiation(world: World, playerId?: string): void {
  const n = activeNegotiation(world, playerId);
  if (!n) return;
  n.status = "walked";
  delete n.pending;
  n.lines.push({ by: "you", text: n.kind === "sign" ? "You withdraw your offer." : "You leave it there for now." });
}

/** Signing talks that are over and read: off the books. */
export function clearTalks(world: World, playerId: string): void {
  if (world.talks?.[playerId] && world.talks[playerId]!.status !== "open") delete world.talks[playerId];
}

/** Plays a staff card in extension talks (see extensions.ts). Returns what happened, or why not. */
export function playTalksCard(world: World, playerId: string, card: CardId): string {
  const n = world.talks?.[playerId];
  if (!n) return "You're not talking to him.";
  return playCard(world, n, card, () => {
    const last = [...n.lines].reverse().find((l) => l.terms)?.terms ?? { commission: world.players[playerId]!.client?.contract.commission ?? 0.1, years: 2, promises: [] };
    const c = findCounter(world, n, last);
    return termsChance(world, n, c) >= n.bar ? `he'd sign for ${describeTerms(c)}.` : "nothing you can offer gets him there yet.";
  });
}

/** Weekly: players whose thinking time is up give their answers. Returns the news lines. */
export function talksWeek(world: World): string[] {
  const now = absWeek(world.season, world.week);
  const out: string[] = [];
  for (const n of Object.values(world.talks ?? {})) {
    const wp = world.players[n.playerId];
    if (n.status !== "open" || !n.pending || n.pending.answerAbsWeek > now) continue;
    const { terms, agentWhenAsked } = n.pending;
    delete n.pending;
    // He may have gone elsewhere in the meantime (or, for an extension, left you).
    if (n.kind === "extend" ? !wp?.client : !wp || wp.client || (wp.agent && wp.agent.agency !== agentWhenAsked)) {
      n.status = "walked";
      n.lines.push({ by: "him", text: wp ? `${wp.player.name} has signed with ${wp.agent?.agency ?? "someone else"}.` : "He's gone." });
      out.push(`${wp?.player.name ?? "A player"} signed elsewhere while you waited.`);
      continue;
    }
    const status = answer(world, n, terms).status as Negotiation["status"];
    const ext = n.kind === "extend";
    out.push(status === "agreed" ? (ext ? `${wp!.player.name} agrees a new deal with ${world.agency.name}!` : `${wp!.player.name} accepts your offer and signs with ${world.agency.name}!`) : status === "walked" ? `${wp!.player.name} turns down your ${ext ? "extension" : "offer"}.` : `${wp!.player.name} has come back with a counter-offer${ext ? " on his extension" : ""}.`);
  }
  return out;
}

/** For the screen: how near your terms are to a deal, in words (never the bar itself). */
export function warmth(world: World, n: Negotiation, t: Terms): "Close" | "Some way off" | "Far apart" {
  const c = termsChance(world, n, t);
  if (c >= n.bar - 0.1) return "Close";
  if (c >= n.bar - LOWBALL) return "Some way off";
  return "Far apart";
}
