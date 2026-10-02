/**
 * The negotiation table: signing a player or extending a client becomes a
 * back-and-forth of up to four rounds. He has a hidden bar, drawn once from
 * the same odds a straight offer would have (so a deal that was 60% likely
 * still is): offers that clear it are accepted; ones that don't get a counter
 * with the smallest change that would (a lower commission, a different
 * length, a promise), and cost him patience. A lowball costs double. When his
 * patience runs out he walks, and won't talk again for four weeks. A rival
 * bidding for him may raise its offer while you talk.
 */
import { createRng } from "../engine";
import { acceptChance, applyExtension, approachBlock, extendChance, signClient, type Offer } from "./agency";
import { mixSeed } from "./entries";
import { MAX_PROMISES, PROMISES, makePromises, trustOf, type PromiseKind } from "./promises";
import { competingBid } from "./rivals";
import { bidPressure } from "./rivalAgents";
import { has } from "./traits";
import { teamOf } from "./ryderCup";
import { absWeek, type World, type WorldPlayer } from "./types";

export interface Terms {
  commission: number;
  years: number;
  promises: PromiseKind[];
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
}

export const MAX_ROUNDS = 4;
export const WALK_COOLDOWN = 4;
/** An offer this far below his bar is a lowball: it costs two patience. */
const LOWBALL = 0.25;
const MIN_COMMISSION = 0.05;

const pct = (x: number) => `${Math.round(x * 100)}%`;
const idNum = (id: string) => Number(id.replace(/\D/g, "")) || 1;
const step = (c: number) => Math.round((c - 0.01) * 100) / 100;

export const activeNegotiation = (world: World): Negotiation | null => (world.negotiation?.status === "open" ? world.negotiation : null);

/** The odds he'd accept these terms (the same as a straight offer). */
export function termsChance(world: World, n: Pick<Negotiation, "playerId" | "kind">, t: Terms): number {
  const offer: Offer = { commission: t.commission, years: t.years, promises: t.promises };
  return n.kind === "sign" ? acceptChance(world, n.playerId, offer) : extendChance(world, n.playerId, offer);
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
    const block = approachBlock(world, playerId);
    if (block) return block;
  } else {
    if (!wp.client) return "He isn't your client.";
    const until = world.agency.cooldowns[playerId];
    if (until !== undefined && until > absWeek(world.season, world.week)) return "He's not ready to talk again yet.";
  }
  const rng = createRng(mixSeed(world.seed, world.season, world.week, 1901, idNum(playerId), kind === "sign" ? 1 : 2));
  const patience = patienceFor(wp, kind);
  const bid = kind === "sign" ? competingBid(world, playerId) : null;
  world.negotiation = {
    playerId,
    kind,
    round: 0,
    patience,
    patienceMax: patience,
    // His bar: an offer is accepted when its odds reach it, so each offer's odds are its real chance.
    bar: rng.next(),
    lines: [{ by: "him", text: kind === "sign" ? `${wp.player.name} is listening. What are you offering?` : `${wp.player.name} wants to hear what you have in mind.` }],
    counter: null,
    status: "open",
    ...(bid ? { rival: { agency: bid.agency, raised: false } } : {}),
  };
  return null;
}

const allowedPromises = (wp: WorldPlayer, taken: PromiseKind[]) => PROMISES.filter((p) => !taken.includes(p.kind) && (p.kind !== "ryderCup" || teamOf(wp) !== null));

/** The smallest change to your offer that would get a yes (or the best he could hope for). */
function findCounter(world: World, n: Negotiation, t: Terms): Terms {
  const wp = world.players[n.playerId]!;
  const ok = (x: Terms) => termsChance(world, n, x) >= n.bar;
  const otherLength = wp.player.age <= 27 ? Math.min(3, t.years + 1) : Math.max(1, t.years - 1);
  // 1) a lower commission, a point at a time (or a different length at the same price).
  for (let c = t.commission; c >= MIN_COMMISSION - 1e-9; c = step(c)) {
    for (const x of [{ ...t, commission: c }, { ...t, commission: c, years: otherLength }]) if (ok(x)) return x;
  }
  // 2) a promise he'd value, with the commission cut as little as possible.
  if (t.promises.length < MAX_PROMISES) {
    for (let c = t.commission; c >= MIN_COMMISSION - 1e-9; c = step(c)) {
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
  return { commission: MIN_COMMISSION, years: t.years, promises: [...t.promises, ...best] };
}

export function describeTerms(t: Terms): string {
  const promises = t.promises.length ? `, and ${t.promises.map((k) => PROMISES.find((p) => p.kind === k)!.label.toLowerCase()).join(" and ")}` : "";
  return `${pct(t.commission)} for ${t.years} season${t.years === 1 ? "" : "s"}${promises}`;
}

function close(world: World, n: Negotiation, t: Terms): void {
  const wp = world.players[n.playerId]!;
  const offer: Offer = { commission: t.commission, years: t.years, promises: t.promises };
  n.status = "agreed";
  n.counter = null;
  if (n.kind === "sign") {
    signClient(world, n.playerId, offer);
    makePromises(world, wp, t.promises);
    n.lines.push({ by: "him", text: `"Deal." ${wp.player.name} signs with ${world.agency.name}: ${describeTerms(t)}.`, terms: t });
  } else {
    applyExtension(world, n.playerId, offer);
    n.lines.push({ by: "him", text: `"Deal." ${wp.player.name} stays until the end of season ${world.season + t.years}.`, terms: t });
  }
}

function walk(world: World, n: Negotiation): void {
  const wp = world.players[n.playerId]!;
  n.status = "walked";
  n.counter = null;
  world.agency.cooldowns[n.playerId] = absWeek(world.season, world.week) + WALK_COOLDOWN;
  n.lines.push({ by: "him", text: `${wp.player.name} has heard enough and walks away. He won't talk again for ${WALK_COOLDOWN} weeks.` });
  world.news.unshift(`${wp.player.name} walks out of talks with ${world.agency.name}.`);
}

/** You put terms on the table. */
export function makeOffer(world: World, t: Terms): Negotiation | null {
  const n = activeNegotiation(world);
  if (!n) return null;
  const terms: Terms = { commission: Math.min(0.2, Math.max(MIN_COMMISSION, t.commission)), years: Math.min(3, Math.max(1, t.years)), promises: t.promises.slice(0, MAX_PROMISES) };
  n.round++;
  n.lines.push({ by: "you", text: `You offer ${describeTerms(terms)}.`, terms });
  const chance = termsChance(world, n, terms);
  if (chance >= n.bar) {
    close(world, n, terms);
    return n;
  }
  n.patience -= chance < n.bar - LOWBALL ? 2 : 1;
  if (n.patience <= 0 || n.round >= MAX_ROUNDS) {
    walk(world, n);
    return n;
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
export function acceptCounter(world: World): Negotiation | null {
  const n = activeNegotiation(world);
  if (!n || !n.counter) return null;
  const t = n.counter;
  n.lines.push({ by: "you", text: `You accept: ${describeTerms(t)}.`, terms: t });
  if (termsChance(world, n, t) >= n.bar) close(world, n, t);
  else walk(world, n);
  return n;
}

/** You leave the table: no harm done, but no deal. */
export function abandonNegotiation(world: World): void {
  const n = activeNegotiation(world);
  if (!n) return;
  n.status = "walked";
  n.lines.push({ by: "you", text: "You leave it there for now." });
}

/** For the screen: how near your terms are to a deal, in words (never the bar itself). */
export function warmth(world: World, n: Negotiation, t: Terms): "Close" | "Some way off" | "Far apart" {
  const c = termsChance(world, n, t);
  if (c >= n.bar - 0.1) return "Close";
  if (c >= n.bar - LOWBALL) return "Some way off";
  return "Far apart";
}
