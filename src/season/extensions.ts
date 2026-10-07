/**
 * Contract extensions as a game of their own.
 *
 * - The window: talks open halfway through a client's final season, one offer
 *   a week, and he answers in a week or two (or tells you he wants to see
 *   what's out there). A year early you can lock him in for a loyalty discount.
 * - His wish list: two things he cares about in a new deal, found out by
 *   talking it over. Meet them and he softens; ignore them and he digs in.
 * - Leverage: his recent form and the rivals tapping him up in his final
 *   season push his price up; a slump brings it down.
 * - Staff cards: your lawyer and agent's skills, played at the table a couple
 *   of times a season each.
 * - Loyalty: three seasons with you opens career deals (up to four seasons, and
 *   a ladder deal he likes); an unhappy star left waiting goes public.
 * - Rookie deals: an amateur signed on signing day gets three full pro seasons.
 */
import { clamp, createRng } from "../engine";
import { addReputation, marketRate, rosterCount, rosterLimit, type Offer } from "./agency";
import { seasonWeeks } from "./calendar";
import { mixSeed } from "./entries";
import { hiredStaffer } from "./market";
import { rankMap } from "./points";
import { hasSkill } from "./staffSkills";
import type { Negotiation } from "./negotiation";
import { absWeek, type World, type WorldPlayer } from "./types";

// ---------------------------------------------------------------- his wish list

export type Wish = "commission" | "security" | "bonuses" | "majors" | "freedom" | "signingBonus";

export const WISHES: Record<Wish, { label: string; ask: string }> = {
  commission: { label: "A fair rate", ask: "a commission at or under his going rate" },
  security: { label: "Security", ask: "a long deal (three seasons, two once he's 34)" },
  bonuses: { label: "Rewards for winning", ask: "a ladder or star structure, so the rate falls as he wins" },
  majors: { label: "The majors", ask: "your promise of every major he's invited to" },
  freedom: { label: "A way out", ask: "a release clause" },
  signingBonus: { label: "Money up front", ask: "a signing bonus" },
};

const idNum = (id: string) => Number(id.replace(/\D/g, "")) || 1;

/** His two wishes: fixed for the player, weighted by who he is (young players want security, stars want structure). */
export function wishesOf(world: World, wp: WorldPlayer): Wish[] {
  const c = wp.client;
  if (c?.wishes?.length) return c.wishes as Wish[];
  const rng = createRng(mixSeed(world.seed, 7701, idNum(wp.player.id)));
  const rank = rankMap(world).get(wp.player.id) ?? 999;
  const weight: Record<Wish, number> = {
    commission: 3,
    security: wp.player.age <= 27 || wp.player.age >= 34 ? 4 : 2,
    bonuses: rank <= 50 ? 4 : 1,
    majors: rank <= 80 || wp.player.attributes.ambition >= 14 ? 3 : 1,
    freedom: wp.player.attributes.ambition >= 13 ? 3 : 1,
    signingBonus: rank > 100 ? 3 : 1,
  };
  const out: Wish[] = [];
  while (out.length < 2) {
    const pool = (Object.keys(weight) as Wish[]).filter((w) => !out.includes(w));
    const total = pool.reduce((t, w) => t + weight[w], 0);
    let r = rng.next() * total;
    out.push(pool.find((w) => (r -= weight[w]) < 0) ?? pool[0]!);
  }
  if (c) c.wishes = out;
  return out;
}

/** How many of his wishes you know: talking it over finds one; a hired lawyer with the right skill reads both. */
export function knownWishes(world: World, wp: WorldPlayer): Wish[] {
  const all = wishesOf(world, wp);
  const n = hasSkill(world, "renewal-specialist") ? 2 : (wp.client?.wishesKnown ?? 0);
  return all.slice(0, n);
}

/** Whether an offer meets a wish. */
export function wishMet(wp: WorldPlayer, wish: Wish, offer: Offer): boolean {
  const x = offer.extras;
  switch (wish) {
    case "commission":
      return offer.commission <= marketRate(wp) + 1e-9;
    case "security":
      return offer.years >= (wp.player.age >= 34 ? 2 : 3);
    case "bonuses":
      return x?.structure === "ladder" || x?.structure === "star";
    case "majors":
      return (offer.promises ?? []).includes("majors");
    case "freedom":
      return !!x?.releaseClause;
    case "signingBonus":
      return !!x?.signingBonus;
  }
}

/** Score points for an extension from his wishes: +4 for each met, -2 for each ignored. */
export function wishScore(world: World, wp: WorldPlayer, offer: Offer & { fill?: Wish }): number {
  return wishesOf(world, wp).reduce((s, w) => s + (offer.fill === w || wishMet(wp, w, offer) ? 3 : -2), 0);
}

/** Talk it over with him (once a week): you learn one more of his wishes. Returns what you learned, or why not. */
export function talkItOver(world: World, id: string): string {
  const wp = world.players[id];
  const c = wp?.client;
  if (!wp || !c) return "He isn't your client.";
  const now = absWeek(world.season, world.week);
  if (c.talkedWeek === now) return "You've already talked with him this week.";
  c.talkedWeek = now;
  const all = wishesOf(world, wp);
  const known = c.wishesKnown ?? 0;
  if (known >= all.length) return `You know what he wants: ${all.map((w) => WISHES[w].label.toLowerCase()).join(" and ")}.`;
  c.wishesKnown = known + 1;
  c.happiness = clamp(c.happiness + 1, 0, 100);
  const w = all[known]!;
  return `${wp.player.name} wants ${WISHES[w].ask}.`;
}

// ---------------------------------------------------------------- the window

/** The week of his final season extension talks open. */
export const windowWeek = (world: World): number => Math.ceil(seasonWeeks(world) / 2);

export type WindowState = { open: true; early: boolean } | { open: false; reason: string };

/** Whether you can talk extension with him now: from halfway through his final season, or a season early for a loyalty discount. */
export function extensionWindow(world: World, id: string): WindowState {
  const c = world.players[id]?.client;
  if (!c) return { open: false, reason: "He isn't your client." };
  if (c.farewell) return { open: false, reason: "You've agreed to let him go at the end of his deal." };
  const until = c.contract.untilSeason;
  if (until === world.season + 1) return { open: true, early: true };
  if (until <= world.season) {
    if (world.week >= windowWeek(world)) return { open: true, early: false };
    return { open: false, reason: `Talks open halfway through his final season (week ${windowWeek(world)}). Or extend a season early for a loyalty discount.` };
  }
  return { open: false, reason: `His deal runs to the end of season ${until}: you can talk a season before it ends.` };
}

// ---------------------------------------------------------------- leverage

/** 0-100: how strong his hand is. His last eight weeks' results, and how hard the rivals have been tapping him up. */
export function leverage(world: World, id: string): number {
  const wp = world.players[id];
  if (!wp?.client) return 0;
  const now = absWeek(world.season, world.week);
  const recent = wp.career.results.filter((r) => r.tier !== "dev" && now - absWeek(r.season, r.week) <= 8);
  let form = 0;
  for (const r of recent) form += r.position === 1 ? 30 : r.position <= 10 ? 10 : r.position <= 25 ? 4 : !r.madeCut ? -4 : 0;
  return Math.round(clamp(30 + form + (wp.client.tapped ?? 0), 0, 100));
}

/** Leverage as score points against an extension (neutral at 30). */
export const leverageScore = (world: World, id: string): number => -(leverage(world, id) - 30) * 0.25;

/**
 * The market's pull on any client whose deal is running out: other agencies
 * exist, so an ordinary offer keeps him about seven times in ten. Meeting his
 * wishes, settling a season early or a sharper rate is what beats it.
 */
export const MARKET_PULL = 7.25;

/** A rival's concrete bid for a top-100 client in his final season: about a point under his going rate. */
export function rivalBidFor(world: World, id: string): { agency: string; commission: number } | null {
  const wp = world.players[id];
  const c = wp?.client;
  if (!wp || !c || c.contract.untilSeason > world.season || world.week < windowWeek(world)) return null;
  if ((rankMap(world).get(id) ?? 999) > 100) return null;
  const rivals = world.rivals ?? [];
  const agency = rivals.length ? rivals[(idNum(id) + world.season) % rivals.length]!.name : "A rival agency";
  return { agency, commission: Math.max(0.05, Math.round((marketRate(wp) - 0.01) * 100) / 100) };
}

/** The rival bid against your offer: it counts against you, more so the further your rate is above theirs. */
export function rivalBidScore(world: World, id: string, offer: Offer): number {
  const bid = rivalBidFor(world, id);
  return bid ? -3 - Math.max(0, offer.commission - bid.commission) * 100 * 1.5 : 0;
}

/** The pull of the market on an expiring deal (a deal settled a season early feels it less). */
export function marketScore(world: World, id: string, offer: Offer): number {
  const c = world.players[id]?.client;
  if (!c) return 0;
  return -(c.contract.untilSeason > world.season ? MARKET_PULL / 2 : MARKET_PULL) + rivalBidScore(world, id, offer);
}

/** An ageing client: his best years may be behind him (shown on the extension desk). */
export function ageingNote(wp: WorldPlayer): string | null {
  const age = wp.player.age;
  if (age < 34) return null;
  return age >= 38 ? `At ${age}, he's near the end: a short deal, if any.` : `At ${age}, his best years may be behind him: think about the length.`;
}

/** Players with you this many seasons can sign career deals. */
export const CAREER_SEASONS = 3;

export function tenure(world: World, wp: WorldPlayer): number {
  const c = wp.client;
  return c ? world.season - (c.joinedSeason ?? c.contract.signedSeason) : 0;
}

/** The longest deal he'll sign: four seasons for a long-time client, otherwise three. */
export const maxYears = (world: World, wp: WorldPlayer): number => (tenure(world, wp) >= CAREER_SEASONS ? 4 : 3);

/** Loyalty in an extension's score: a season early (+4), and a ladder career deal for a long-time client (+3). */
export function loyaltyScore(world: World, wp: WorldPlayer, offer: Offer): number {
  let s = 0;
  if (wp.client && wp.client.contract.untilSeason > world.season) s += 2;
  if (tenure(world, wp) >= CAREER_SEASONS && offer.extras?.structure === "ladder") s += 3;
  return s;
}

/**
 * Weekly: in a client's final season, once talks could have opened, the
 * rivals tap him up (his leverage climbs) until he's re-signed; and an
 * unhappy star you haven't opened talks with goes public. Returns news lines.
 */
export function extensionsWeek(world: World): string[] {
  const out: string[] = [];
  if (world.week < windowWeek(world)) return out;
  // Only clients in their final season; the ranking is built only if there are any.
  if (!world.clientIds.some((id) => world.players[id]!.client!.contract.untilSeason <= world.season)) return out;
  const ranks = rankMap(world);
  const now = absWeek(world.season, world.week);
  for (const id of world.clientIds) {
    const wp = world.players[id]!;
    const c = wp.client!;
    if (c.contract.untilSeason > world.season || c.farewell) continue;
    const rank = ranks.get(id) ?? 999;
    const before = c.tapped ?? 0;
    c.tapped = Math.min(40, before + (rank <= 30 ? 4 : rank <= 100 ? 2.5 : 1));
    if (Math.floor(before / 10) < Math.floor(c.tapped / 10)) {
      const rival = world.rivals?.length ? world.rivals[(idNum(id) + world.week) % world.rivals.length]!.name : "A rival agency";
      out.push(`${rival} have been in touch with ${wp.player.name}: his deal with you runs out this season.`);
    }
    // A holdout: unhappy, ranked, nobody's talking to him, not in the last few weeks.
    const talking = world.talks?.[id]?.status === "open";
    const quiet = c.holdoutWeek === undefined || now - c.holdoutWeek >= 3;
    if (!talking && quiet && rank <= 60 && leverage(world, id) >= 50 && world.week >= windowWeek(world) + 3) {
      const rng = createRng(mixSeed(world.seed, world.season, world.week, 7702, idNum(id)));
      if (rng.chance(0.25)) {
        c.holdoutWeek = now;
        c.tapped = Math.min(40, c.tapped + 10);
        c.happiness = clamp(c.happiness - 3, 0, 100);
        addReputation(world.agency, -0.5);
        out.push(`${wp.player.name} goes public: with no new deal on the table, he's listening to offers.`);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- letting him go

/** Why you can't let him go now, or null: only in his final season. */
export function letGoBlock(world: World, id: string): string | null {
  const c = world.players[id]?.client;
  if (!c) return "He isn't your client.";
  if (c.farewell) return "You've already agreed to let him go.";
  if (c.contract.untilSeason > world.season) return "You can let him go in the final season of his deal.";
  return null;
}

/**
 * Let him go: he plays out his deal and leaves on good terms at the season's
 * end (a little reputation instead of the hit for a client walking out). His
 * place is free at once, for a new signing or signing day; talks about a new
 * deal end, and the rivals stop circling.
 */
export function letHimGo(world: World, id: string): string {
  const block = letGoBlock(world, id);
  if (block) return block;
  const wp = world.players[id]!;
  const c = wp.client!;
  c.farewell = true;
  c.tapped = 0;
  c.happiness = clamp(c.happiness + 5, 0, 100);
  const n = world.talks?.[id];
  if (n && n.status === "open") {
    n.status = "walked";
    delete n.pending;
    n.lines.push({ by: "you", text: "You agree to part ways at the end of the season." });
  }
  world.news.unshift(`${wp.player.name} and ${world.agency.name} agree to part ways when his deal ends this season.`);
  return `${wp.player.name} plays out his deal and leaves on good terms. His place is free now.`;
}

/** Changed your mind: only while his place hasn't been filled. */
export function keepHim(world: World, id: string): string {
  const c = world.players[id]?.client;
  if (!c?.farewell) return "You haven't let him go.";
  if (rosterCount(world) >= rosterLimit(world.agency.reputation, world.agency.hq)) return "His place has been filled: you can't take it back.";
  c.farewell = false;
  return "He's staying for now: talk about a new deal when you're ready.";
}

// ---------------------------------------------------------------- staff cards

export type CardId = "extraRound" | "closingPitch" | "clearTheAir" | "bonusLadder" | "finePrint";

export interface CardDef {
  label: string;
  blurb: string;
  /** The staff skill (or, for the fine print, any lawyer) that deals the card. */
  skill: string | null;
  uses: number;
}

export const CARDS: Record<CardId, CardDef> = {
  extraRound: { label: "One more round", blurb: "Your renewal specialist keeps him at the table: +1 patience.", skill: "renewal-specialist", uses: 2 },
  closingPitch: { label: "Closing pitch", blurb: "Your closer makes the case: your next offer lands much better.", skill: "closer", uses: 2 },
  clearTheAir: { label: "Clear the air", blurb: "Your dispute settler gets a client who walked back to the table (or calms a tense one: +1 patience).", skill: "dispute-settler", uses: 2 },
  bonusLadder: { label: "Bonus ladder", blurb: "Your bonus negotiator dresses up the next offer: it counts as rewarding his wins.", skill: "bonus-negotiator", uses: 2 },
  finePrint: { label: "Read the fine print", blurb: "Your lawyer works out what he'd sign for at your length, without spending patience.", skill: null, uses: 2 },
};

function cardState(world: World): Record<string, number> {
  const s = world.agency.cards;
  if (!s || s.season !== world.season) world.agency.cards = { season: world.season, used: {} };
  return world.agency.cards!.used;
}

/** Your cards this season and how many uses each has left (only the ones your staff can deal). */
export function cardsInHand(world: World): { id: CardId; def: CardDef; left: number }[] {
  const used = cardState(world);
  return (Object.keys(CARDS) as CardId[])
    .filter((id) => (CARDS[id].skill ? hasSkill(world, CARDS[id].skill!) : !!hiredStaffer(world, "lawyer")))
    .map((id) => ({ id, def: CARDS[id], left: CARDS[id].uses - (used[id] ?? 0) }));
}

/**
 * Plays a card in extension talks. `counter` works out the terms he'd take
 * (passed in by the negotiation module). Returns what happened, or why not.
 */
export function playCard(world: World, n: Negotiation, card: CardId, counter: () => string): string {
  const hand = cardsInHand(world).find((c) => c.id === card);
  if (!hand) return "Your staff can't play that card.";
  if (hand.left <= 0) return "You've used that card this season.";
  if (n.kind !== "extend") return "Cards are for extension talks.";
  const reopen = card === "clearTheAir" && n.status === "walked";
  if (n.status !== "open" && !reopen) return "The talks are over.";
  if (n.pending) return "Wait for his answer first.";
  const wp = world.players[n.playerId]!;
  let text = "";
  switch (card) {
    case "extraRound":
      n.patience++;
      n.patienceMax = Math.max(n.patienceMax, n.patience);
      n.extraRounds = (n.extraRounds ?? 0) + 1;
      text = `Your renewal specialist keeps ${wp.player.name} talking: one more round.`;
      break;
    case "closingPitch":
      n.boost = (n.boost ?? 0) + 6;
      text = "Your closer has a word: your next offer will land better.";
      break;
    case "clearTheAir":
      if (reopen) {
        n.status = "open";
        n.patience = 2;
        n.patienceMax = Math.max(n.patienceMax, 2);
        delete world.agency.cooldowns[n.playerId];
        text = `Your dispute settler gets ${wp.player.name} back to the table.`;
      } else {
        n.patience++;
        n.patienceMax = Math.max(n.patienceMax, n.patience);
        text = `Your dispute settler calms things down: ${wp.player.name} has a little more patience.`;
      }
      break;
    case "bonusLadder":
      n.fill = "bonuses";
      text = "Your bonus negotiator builds in win bonuses: your next offer counts as rewarding his wins.";
      break;
    case "finePrint":
      text = `Your lawyer's read: ${counter()}`;
      break;
  }
  cardState(world)[card] = (cardState(world)[card] ?? 0) + 1;
  n.lines.push({ by: "you", text });
  return text;
}

// ---------------------------------------------------------------- rookie deals

/** An amateur signed on signing day: three full pro seasons, and the rate doesn't rankle while it runs. */
export const ROOKIE_SEASONS = 3;

export function makeRookieDeal(world: World, wp: WorldPlayer): void {
  const c = wp.client;
  if (!c) return;
  // Signing day falls at the end of a season: the deal covers the next three.
  c.contract.untilSeason = world.season + ROOKIE_SEASONS;
  c.contract.rookie = true;
}
