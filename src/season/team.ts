/**
 * A client's team and kit beyond his coaches: his caddie, how he travels (and
 * the agency jet), and the clubs in his bag.
 */
import { personalWealth } from "./finance";
import { EQUIPMENT_BY_ID, clamp, createRng, traceSeed, type CaddieOnBag, type KitSlot, type StrokesGained } from "../engine";
import { absWeek, type Caddie, type Region, type TravelClass, type World, type WorldPlayer } from "./types";

// ------------------------------------------------------------------ caddies

const FIRST = ["Bones", "Mikey", "Jim", "Tommy", "Fluff", "Ricky", "Duke", "Kenny", "Stevie", "Paulie", "Joe", "Ted", "Sammy", "Bo"];
const LAST = ["Mackay", "Cowan", "Bennett", "Tinney", "Doyle", "Reyes", "Harmon", "Kline", "Walsh", "Ortiz", "Pruitt", "Lang", "Moss", "Crane"];

/** One hundred caddies for hire: better green readers and calmer heads cost more. */
export function generateCaddies(seed: number): Caddie[] {
  const rng = createRng(seed ^ 0xcadd1e);
  const used = new Set<string>();
  const out: Caddie[] = [];
  for (let i = 0; i < 100; i++) {
    let name = "";
    do name = `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
    while (used.has(name));
    used.add(name);
    const level = 4 + Math.round((i / 99) * 14); // 4 (a friend on the bag) to 18 (a major-winning looper)
    const skill = () => clamp(level + rng.int(-3, 3), 3, 20);
    const c = { greenReading: skill(), clubbing: skill(), calm: skill() };
    const avg = (c.greenReading + c.clubbing + c.calm) / 3;
    out.push({ id: `k${i + 1}`, name, ...c, weeklyFee: Math.round((800 + Math.max(0, avg - 6) ** 2 * 45) / 100) * 100, share: avg >= 14 ? 0.1 : avg >= 10 ? 0.08 : 0.06 });
  }
  return out;
}

export const caddiesOf = (world: World): Caddie[] => {
  const generated = generateCaddies(world.seed);
  if (!world.caddies) return (world.caddies = generated);
  const existing = new Set(world.caddies.map((c) => c.id));
  world.caddies.push(...generated.filter((c) => !existing.has(c.id)));
  return world.caddies;
};

/** The client whose bag a caddie is on, if any. */
export const caddieEmployer = (world: World, caddieId: string): string | undefined => world.clientIds.find((id) => world.players[id]?.client?.caddieId === caddieId);

export function hireCaddie(world: World, clientId: string, caddieId: string): void {
  const c = world.players[clientId]?.client;
  const caddie = caddiesOf(world).find((x) => x.id === caddieId);
  if (!c || !caddie) throw new Error("no such client or caddie");
  const other = caddieEmployer(world, caddieId);
  if (other && other !== clientId) throw new Error(`${caddie.name} is on another client's bag`);
  if (c.caddieId === caddieId) return;
  c.caddieId = caddieId;
  c.caddieWeeks = 0;
  world.news.unshift(`${world.players[clientId]!.player.name} hires ${caddie.name} to carry his bag.`);
}

export function releaseCaddie(world: World, clientId: string): void {
  const c = world.players[clientId]?.client;
  if (!c?.caddieId) return;
  const name = caddiesOf(world).find((x) => x.id === c.caddieId)?.name;
  delete c.caddieId;
  delete c.caddieWeeks;
  if (name) world.news.unshift(`${name} is no longer on ${world.players[clientId]!.player.name}'s bag.`);
}

/** Chemistry grows three points a week together, to 100. */
export const caddieChemistry = (weeks: number): number => Math.min(100, weeks * 3);

/** His caddie as the course sees him, if he has one. */
export function caddieOnBag(world: World, wp: WorldPlayer): CaddieOnBag | undefined {
  const c = wp.client;
  if (!c?.caddieId) return undefined;
  const k = caddiesOf(world).find((x) => x.id === c.caddieId);
  if (!k) return undefined;
  return { greenReading: k.greenReading, clubbing: k.clubbing, calm: k.calm, chemistry: caddieChemistry(c.caddieWeeks ?? 0) };
}

/** What the caddie costs this week: his fee, plus his share of any prize money. */
export function caddiePay(world: World, wp: WorldPlayer, earnings: number, share: number): number {
  const k = wp.client?.caddieId ? caddiesOf(world).find((x) => x.id === wp.client!.caddieId) : undefined;
  if (!k) return 2_000 + Math.round(earnings * share);
  return k.weeklyFee + Math.round(earnings * (earnings > 0 ? k.share : 0));
}

// ------------------------------------------------------------------ travel

export const TRAVEL_CLASSES: Record<TravelClass, { label: string; cost: number; fatigue: number; days: [number, number]; blurb: string }> = {
  economy: { label: "Economy", cost: 1, fatigue: 1, days: [1, 2], blurb: "Cheap and tiring." },
  business: { label: "Business", cost: 1.8, fatigue: 0.7, days: [1, 1], blurb: "Lie-flat seats: arrives fresher." },
  charter: { label: "Charter", cost: 4, fatigue: 0.4, days: [0, 1], blurb: "Private flights booked per trip: no jet lag." },
};

export const JET_LEASE_WEEKLY = 30_000;
export const JET_PRICE = 4_500_000;
export const JET_UPKEEP_WEEKLY = 10_000;

/** How a client travels this week: the agency jet if there is one, otherwise his travel class. */
export function travelMode(world: World, wp: WorldPlayer): { label: string; cost: number; fatigue: number; days: [number, number]; private: boolean } {
  if (wp.client && world.agency.jet) return { label: "Agency jet", cost: 0, fatigue: 0.25, days: [0, 0], private: true };
  const cls = TRAVEL_CLASSES[wp.client?.travelClass ?? "economy"];
  return { label: cls.label, cost: cls.cost, fatigue: cls.fatigue, days: cls.days, private: wp.client?.travelClass === "charter" };
}

/** Travel days before an event: [same region, another region]. */
export function travelDays(world: World, wp: WorldPlayer, to: Region): number {
  const m = travelMode(world, wp);
  const changed = wp.career.lastRegion !== null && wp.career.lastRegion !== to;
  return changed ? m.days[1] : m.days[0];
}

export function setTravelClass(world: World, clientId: string, cls: TravelClass): void {
  const c = world.players[clientId]?.client;
  if (c) c.travelClass = cls;
}

/** Lease or buy the agency jet, or give it up (a bought jet sells for 70% of its price). */
export function setJet(world: World, jet: "lease" | "own" | null): string {
  const a = world.agency;
  if (jet === (a.jet ?? null)) return "No change.";
  if (jet === "own") {
    if (a.bank < JET_PRICE) return `A jet costs $${JET_PRICE.toLocaleString("en-US")}; the agency has $${Math.round(a.bank).toLocaleString("en-US")}.`;
    a.bank -= JET_PRICE;
    a.ledger.office += JET_PRICE;
    a.jet = "own";
    world.news.unshift(`${a.name} buys a private jet. The clients fly private from now on.`);
    return "Bought.";
  }
  if (a.jet === "own") {
    a.bank += JET_PRICE * 0.7;
    a.ledger.office -= JET_PRICE * 0.7;
  }
  a.jet = jet;
  world.news.unshift(jet === "lease" ? `${a.name} leases a private jet for its clients.` : `${a.name} gives up its private jet.`);
  return "Done.";
}

/** The jet's weekly bill, taken from the agency's bank. */
export function payJet(world: World): void {
  const fee = world.agency.jet === "lease" ? JET_LEASE_WEEKLY : world.agency.jet === "own" ? JET_UPKEEP_WEEKLY : 0;
  world.agency.bank -= fee;
  world.agency.ledger.office += fee;
}

// ------------------------------------------------------------------ equipment

/** Buys (if he doesn't own it yet) and puts a model in his bag. The client pays. */
export function equip(world: World, clientId: string, modelId: string): void {
  const wp = world.players[clientId];
  const c = wp?.client;
  const m = EQUIPMENT_BY_ID.get(modelId);
  if (!wp || !c || !m) throw new Error("no such client or model");
  const owned = (c.ownedEquipment ??= []);
  if (m.price > 0 && !owned.includes(modelId) && m.price > personalWealth(wp)) throw new Error("He can't afford it.");
  if (m.price > 0 && !owned.includes(modelId)) {
    owned.push(modelId);
    c.finances.equipment = (c.finances.equipment ?? 0) + m.price;
    world.news.unshift(`${wp.player.name} puts a ${m.name} in the bag.`);
  }
  wp.player.equipment = { ...(wp.player.equipment ?? {}), [m.slot]: modelId };
}

export const inBag = (wp: WorldPlayer, slot: KitSlot): string | undefined => wp.player.equipment?.[slot];

// ------------------------------------------------------------------ the putter swap

/** A putting week this bad (strokes gained a round against the field) counts as cold. */
export const COLD_PUTTING = -0.3;
/** Weeks before he can swap putters again. */
export const PUTTER_SWAP_COOLDOWN = 4;
/** A new putter's "fresh eyes": strokes a round on the greens in his first and second events with it. */
export const PUTTER_FRESH = [0.1, 0.05];
/** The odds a new putter just feels wrong, and what that costs in those two events. */
export const PUTTER_WRONG_CHANCE = 0.2;
export const PUTTER_WRONG = -0.05;

/** How many of his latest events in a row he putted cold (stroke play, as your client). */
export function coldPuttingStreak(wp: WorldPlayer): number {
  let n = 0;
  for (let i = wp.career.results.length - 1; i >= 0; i--) {
    const p = wp.career.results[i]!.putting;
    if (p === undefined || p > COLD_PUTTING) break;
    n++;
  }
  return n;
}

/** Why he can't swap putters this week, or null. */
export function putterSwapBlock(world: World, clientId: string): string | null {
  const wp = world.players[clientId];
  if (!wp?.client) return "He isn't your client.";
  const swap = wp.client.putterSwap;
  const now = absWeek(world.season, world.week);
  if (swap && now - swap.absWeek < PUTTER_SWAP_COOLDOWN) {
    const left = PUTTER_SWAP_COOLDOWN - (now - swap.absWeek);
    return `He changed putters ${now - swap.absWeek === 0 ? "this week" : "recently"}: give it ${left} more week${left === 1 ? "" : "s"}.`;
  }
  const cold = coldPuttingStreak(wp);
  if (cold < 2) return cold === 1 ? "His putting was cold last time out. One more bad week on the greens and a new putter might help." : "His putting isn't cold. A swap helps when he's lost his touch for two events or more.";
  return null;
}

/** What his putter swap is worth on the greens in his next event (0 once it has faded). */
export function putterSwapLift(wp: WorldPlayer): number {
  const s = wp.client?.putterSwap;
  if (!s || s.played >= PUTTER_FRESH.length) return 0;
  return s.feel === "wrong" ? PUTTER_WRONG : PUTTER_FRESH[s.played]!;
}

/**
 * He puts a new putter in the bag after a cold spell: usually a lift for an
 * event or two, sometimes it just feels wrong. Seeded by the world, the
 * player and the week, so the same swap always turns out the same.
 */
export function swapPutter(world: World, clientId: string): string {
  const block = putterSwapBlock(world, clientId);
  if (block) return block;
  const wp = world.players[clientId]!;
  const now = absWeek(world.season, world.week);
  const rng = createRng(traceSeed(world.seed, wp.player.id, now, "putter-swap"));
  const feel = rng.chance(PUTTER_WRONG_CHANCE) ? "wrong" : "fresh";
  wp.client!.putterSwap = { absWeek: now, played: 0, feel };
  refreshKitAdjust(wp);
  world.news.unshift(
    feel === "fresh"
      ? `${wp.player.name} tries a new putter after a cold spell on the greens. He likes the look of it.`
      : `${wp.player.name} tries a new putter after a cold spell on the greens, but it doesn't sit right in his hands.`,
  );
  return feel === "fresh" ? "He likes the look of it." : "It doesn't feel right.";
}

/** The kit's passing effects on his game this week (the putter swap; the club switch adds to it). */
export function kitAdjustOf(wp: WorldPlayer): Partial<StrokesGained> | undefined {
  const out: Partial<StrokesGained> = {};
  const lift = putterSwapLift(wp);
  if (lift) out.putting = lift;
  return Object.keys(out).length ? out : undefined;
}

/** Puts the kit's passing effects on the player, where the course sees them. */
export function refreshKitAdjust(wp: WorldPlayer): void {
  const adj = kitAdjustOf(wp);
  if (adj) wp.player.kitAdjust = adj;
  else delete wp.player.kitAdjust;
}

/** After each event he plays: a new putter's lift fades. */
export function kitAfterEvent(wp: WorldPlayer): void {
  const s = wp.client?.putterSwap;
  if (s && s.played < PUTTER_FRESH.length) s.played++;
  refreshKitAdjust(wp);
}
