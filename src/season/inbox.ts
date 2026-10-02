/**
 * The inbox: decisions about your clients that turn up between weeks. Each
 * has two to four choices, every choice says what it does, and the effects
 * are plain data so a save can hold them. Dilemmas (dilemmas.ts) and press
 * conferences (press.ts) both arrive here.
 *
 * You answer them before playing on; anything still open when the next week
 * is played takes its default (the do-nothing or safe choice). Long sims stop
 * for "big" decisions unless you switch that off.
 */
import { clamp, createRng, traceSeed, type Rng } from "../engine";
import { addReputation } from "./agency";
import { mixSeed } from "./entries";
import { followers } from "./showcase";
import { releaseCoach } from "./staff";
import { absWeek, type CoachRole, type World, type WorldPlayer } from "./types";

/** One thing a choice does. Numbers are changes (followers: a share, e.g. 0.03 = +3%). */
export type Effect =
  | { k: "mood"; v: number }
  | { k: "form"; v: number }
  | { k: "condition"; v: number }
  | { k: "followers"; v: number }
  | { k: "buzz"; v: number }
  | { k: "reputation"; v: number }
  | { k: "trust"; v: number }
  /** Paid by the agency (a cost). */
  | { k: "agencyCost"; v: number }
  /** Paid to the client (an appearance fee, an equipment deal); the agency takes its endorsement cut. */
  | { k: "clientMoney"; v: number }
  /** Sits out this many coming weeks. */
  | { k: "rest"; v: number }
  /** Back from injury now. */
  | { k: "heal" }
  | { k: "injure"; v: number; name: string }
  | { k: "releaseCoach"; role: CoachRole }
  | { k: "targetEvents"; v: number }
  /** A bold claim: if his next event goes badly, he eats his words. */
  | { k: "boldClaim" }
  | { k: "practiceAt"; courseId: string }
  /** How a rival agency's head agent feels about you (see rivals.ts). */
  | { k: "relationship"; agency: string; v: number }
  /** A tip-off: your scouts learn about a player straight away. */
  | { k: "scoutBoost"; playerId: string; v: number }
  /** A gamble: `p` chance of `then`, otherwise `else`, each with a line for the news. */
  | { k: "chance"; p: number; then: Effect[]; else: Effect[]; thenNews: string; elseNews: string };

export interface Choice {
  id: string;
  label: string;
  /** What it does, in plain words. */
  detail: string;
  effects: Effect[];
}

export interface Decision {
  id: string;
  kind: "dilemma" | "press" | "message";
  /** The template it came from (dilemmas cool down by key). */
  key: string;
  /** The client it's about ("" for agency business, such as a rival agent's message). */
  clientId: string;
  /** A rival agency, for messages from its head agent. */
  from?: string;
  season: number;
  week: number;
  title: string;
  text: string;
  choices: Choice[];
  /** Taken if you don't answer before the next week is played. */
  defaultChoice: string;
  /** Long sims stop for these. */
  big: boolean;
  resolved?: { choice: string; auto: boolean; outcome: string };
}

export const MAX_DECISIONS_PER_WEEK = 3;
/** Kept for the inbox's history and cooldowns. */
const HISTORY = 60;

export const pendingDecisions = (world: World): Decision[] => (world.inbox ?? []).filter((d) => !d.resolved);
export const recentDecisions = (world: World, n = 12): Decision[] => (world.inbox ?? []).filter((d) => d.resolved).slice(-n).reverse();
/** Long sims stop when one of these is waiting (unless switched off). */
export const shouldPause = (world: World): boolean => world.agency.pauseOnDecisions !== false && pendingDecisions(world).some((d) => d.big);

export function addDecision(world: World, d: Omit<Decision, "id" | "season" | "week">): Decision {
  const inbox = (world.inbox ??= []);
  const decision: Decision = { ...d, id: `d${world.season}-${world.week}-${inbox.length}-${d.key}-${d.clientId}`, season: world.season, week: world.week };
  inbox.push(decision);
  if (inbox.length > HISTORY) inbox.splice(0, inbox.length - HISTORY);
  return decision;
}

/** When this template last fired (absolute week), for one client or anyone. */
export function lastFired(world: World, key: string, clientId?: string): number | null {
  let last: number | null = null;
  for (const d of world.inbox ?? []) if (d.key === key && (!clientId || d.clientId === clientId)) last = Math.max(last ?? -Infinity, absWeek(d.season, d.week));
  return last;
}

const rngFor = (world: World, d: Decision): Rng => createRng(mixSeed(world.seed, d.season, d.week, 1801, traceSeed(d.id)));

/** Applies a choice (the default when none is given). Returns what happened, as a line for the news. */
export function resolveDecision(world: World, decisionId: string, choiceId?: string, auto = false): string {
  const d = (world.inbox ?? []).find((x) => x.id === decisionId);
  if (!d || d.resolved) return "";
  const choice = d.choices.find((c) => c.id === (choiceId ?? d.defaultChoice)) ?? d.choices.find((c) => c.id === d.defaultChoice)!;
  const wp = d.clientId ? world.players[d.clientId] : undefined;
  const rng = rngFor(world, d);
  const lines: string[] = [];
  applyEffects(world, wp?.client ? wp : null, choice.effects, rng, lines);
  const who = wp?.player.name ?? (d.from ? `To ${d.from}` : world.agency.name);
  const outcome = [`${who}: ${choice.label}.`, ...lines].join(" ");
  d.resolved = { choice: choice.id, auto, outcome };
  world.news.unshift(outcome);
  return outcome;
}

/** Every decision still open takes its default (a new week is about to be played). */
export function autoResolve(world: World): void {
  for (const d of pendingDecisions(world)) resolveDecision(world, d.id, undefined, true);
}

function applyEffects(world: World, wp: WorldPlayer | null, effects: Effect[], rng: Rng, lines: string[]): void {
  const now = absWeek(world.season, world.week);
  for (const e of effects) {
    // Agency business first: these need no client.
    if (e.k === "relationship") {
      const r = world.rivals?.find((x) => x.name === e.agency);
      if (r) r.relationship = clamp((r.relationship ?? 0) + e.v, -100, 100);
      continue;
    }
    if (e.k === "scoutBoost") {
      const k = world.agency.knowledge[e.playerId];
      world.agency.knowledge[e.playerId] = { accuracy: Math.max(k?.accuracy ?? 0, e.v), reports: (k?.reports ?? 0) + 1, absWeek: now };
      continue;
    }
    if (e.k === "reputation") {
      addReputation(world.agency, e.v);
      continue;
    }
    if (e.k === "agencyCost") {
      world.agency.bank -= e.v;
      world.agency.ledger.clientCare = (world.agency.ledger.clientCare ?? 0) + e.v;
      continue;
    }
    if (e.k === "chance") {
      const hit = rng.chance(e.p);
      applyEffects(world, wp, hit ? e.then : e.else, rng, lines);
      const line = hit ? e.thenNews : e.elseNews;
      if (line) lines.push(line);
      continue;
    }
    if (!wp?.client) continue;
    const m = wp.client;
    switch (e.k) {
      case "mood":
        m.happiness = clamp(m.happiness + e.v, 0, 100);
        break;
      case "form":
        wp.player.form = clamp(wp.player.form + e.v, -1, 1);
        break;
      case "condition":
        wp.player.condition = clamp(wp.player.condition + e.v, 0, 100);
        break;
      case "followers":
        m.followers = Math.max(1000, Math.round(followers(world, wp) * (1 + e.v)));
        break;
      case "buzz":
        m.buzz = clamp((m.buzz ?? 0) + e.v, -0.3, 0.3);
        break;
      case "trust":
        m.trust = clamp((m.trust ?? 60) + e.v, 0, 100);
        break;
      case "clientMoney": {
        const cut = Math.round(e.v * m.contract.endorsementCommission);
        m.finances.endorsements += e.v;
        m.finances.commission += cut;
        world.agency.bank += cut;
        world.agency.ledger.endorsementCommission += cut;
        break;
      }
      case "rest":
        m.restUntil = Math.max(m.restUntil ?? 0, now + e.v);
        break;
      case "heal":
        wp.injury = null;
        break;
      case "injure":
        wp.injury = { name: e.name, weeksLeft: e.v, totalWeeks: e.v };
        break;
      case "releaseCoach":
        if (m.staff[e.role]) releaseCoach(world, wp.player.id, e.role);
        break;
      case "targetEvents":
        wp.targetEvents = clamp(wp.targetEvents + e.v, 15, 32);
        break;
      case "boldClaim":
        m.boldClaim = now;
        break;
      case "practiceAt": {
        if (!e.courseId) break;
        const fam = (wp.career.familiarity ??= {});
        fam[e.courseId] = Math.min(100, (fam[e.courseId] ?? 0) + 15);
        break;
      }
    }
  }
}

/** A short, plain description of a choice's effects, for the card. */
export function describeEffects(effects: Effect[]): string {
  const parts: string[] = [];
  const sign = (x: number) => (x > 0 ? "+" : "−");
  for (const e of effects) {
    if (e.k === "mood") parts.push(`mood ${sign(e.v)}${Math.abs(e.v)}`);
    else if (e.k === "form") parts.push(`form ${sign(e.v)}`);
    else if (e.k === "condition") parts.push(`condition ${sign(e.v)}${Math.abs(e.v)}`);
    else if (e.k === "followers") parts.push(`followers ${sign(e.v)}${Math.round(Math.abs(e.v) * 100)}%`);
    else if (e.k === "buzz") parts.push(`sponsor appeal ${sign(e.v)}`);
    else if (e.k === "reputation") parts.push(`reputation ${sign(e.v)}${Math.abs(e.v)}`);
    else if (e.k === "trust") parts.push(`trust ${sign(e.v)}${Math.abs(e.v)}`);
    else if (e.k === "agencyCost") parts.push(`costs $${Math.round(e.v / 1000)}k`);
    else if (e.k === "clientMoney") parts.push(`pays him $${Math.round(e.v / 1000)}k`);
    else if (e.k === "rest") parts.push(e.v === 1 ? "sits out next week" : `sits out ${e.v} weeks`);
    else if (e.k === "heal") parts.push("plays straight away");
    else if (e.k === "injure") parts.push(`out ${e.v} weeks`);
    else if (e.k === "releaseCoach") parts.push("loses the coach");
    else if (e.k === "targetEvents") parts.push(`${e.v > 0 ? "more" : "fewer"} starts`);
    else if (e.k === "boldClaim") parts.push("risky if he plays badly next");
    else if (e.k === "practiceAt") parts.push("knows the course better");
    else if (e.k === "relationship") parts.push(`${e.agency}: ${e.v > 0 ? "warmer" : "cooler"}`);
    else if (e.k === "scoutBoost") parts.push("a full report on him");
    else if (e.k === "chance") parts.push(`${Math.round(e.p * 100)}% chance: ${describeEffects(e.then) || "nothing"}`);
  }
  return parts.join(", ");
}
