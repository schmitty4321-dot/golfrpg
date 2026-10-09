import { ALL_ATTRIBUTES, VISIBLE_ATTRIBUTES, clamp, createRng, type ArchetypeId, type AttributeKey } from "../engine";
import { mixSeed } from "./entries";
import { absWeek, type Scout, type World } from "./types";
import { hasSkill } from "./staffSkills";
import { intelCap, intelRegionOf, intelWeeks } from "./intel";

const FIRST = ["Walt", "Rosa", "Des", "Marty", "Yuki", "Ingrid", "Bo", "Carmen", "Olly", "Freddie", "Priya", "Sven"];
const LAST = ["Hollis", "Okafor", "Brennan", "Lukas", "Sato", "Varga", "Dunmore", "Reyes", "Whitlow", "Ahn", "Nakamura", "Pell"];

export function generateScouts(seed: number): Scout[] {
  const rng = createRng(seed ^ 0x5c0);
  const used = new Set<string>();
  return [6, 8, 10, 12, 14, 16, 18].map((q, i) => {
    let name = "";
    do name = `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
    while (used.has(name));
    used.add(name);
    const quality = clamp(q + rng.int(-1, 1), 1, 20);
    return { id: `sc${i + 1}`, name, quality, weeklyFee: Math.round(((500 + quality * quality * 25) * 0.4) / 100) * 100 };
  });
}

/** How far a report can be trusted, 0-1, from the scout's quality and how often he's been watched. */
export function reportAccuracy(scoutQuality: number, previous: number): number {
  const fresh = 0.35 + scoutQuality * 0.03;
  return clamp(Math.max(previous + 0.1, fresh), 0, 0.97);
}

export function hireScout(world: World, id: string): void {
  if (!world.agency.scouts.some((s) => s.id === id)) throw new Error("unknown scout");
  if (!world.agency.hiredScouts.includes(id)) world.agency.hiredScouts.push(id);
}

export function releaseScout(world: World, id: string): void {
  world.agency.hiredScouts = world.agency.hiredScouts.filter((x) => x !== id);
}

export function queueScouting(world: World, playerId: string): void {
  if (!world.players[playerId] || world.agency.scoutingQueue.includes(playerId) || world.clientIds.includes(playerId)) return;
  world.agency.scoutingQueue.push(playerId);
}

export const weeklyScoutCost = (world: World): number =>
  Math.round(world.agency.hiredScouts.reduce((s, id) => s + (world.agency.scouts.find((x) => x.id === id)?.weeklyFee ?? 0), 0) * (hasSkill(world, "scouting-reports") ? 0.5 : 1));

/**
 * Weekly: intel jobs move on a week, and a finished job files its report. Then
 * the queue goes out to scouts with room (best scout first). A player takes a
 * scout for as long as he's far from your HQ (see intel.ts); a player with no
 * free scout waits in the queue.
 */
export function scoutingWeek(world: World): string[] {
  const done: string[] = [];
  const now = absWeek(world.season, world.week);
  const jobs = (world.agency.intelJobs ??= []);
  for (const job of [...jobs]) {
    job.weeksLeft--;
    if (job.weeksLeft > 0) continue;
    jobs.splice(jobs.indexOf(job), 1);
    if (!world.players[job.playerId]) continue;
    const scout = world.agency.scouts.find((s) => s.id === job.scoutId);
    const k = world.agency.knowledge[job.playerId];
    world.agency.knowledge[job.playerId] = { accuracy: reportAccuracy(scout?.quality ?? 6, k?.accuracy ?? 0), reports: (k?.reports ?? 0) + 1, absWeek: now };
    done.push(job.playerId);
  }
  // Scouts away on a trip don't take new work at home.
  const away = new Set((world.agency.trips ?? []).map((t) => t.scoutId));
  const scouts = world.agency.hiredScouts
    .filter((id) => !away.has(id))
    .map((id) => world.agency.scouts.find((s) => s.id === id))
    .filter((s): s is Scout => !!s)
    .sort((a, b) => b.quality - a.quality);
  const queue = world.agency.scoutingQueue;
  for (const id of [...queue]) {
    const wp = world.players[id];
    if (!wp) {
      queue.splice(queue.indexOf(id), 1);
      continue;
    }
    const region = intelRegionOf(wp);
    const scout = scouts.find((s) => jobs.filter((j) => j.scoutId === s.id && j.region === region).length < intelCap(region));
    if (!scout) continue;
    const weeks = intelWeeks(world, wp);
    jobs.push({ id: `intel-${now}-${id}`, playerId: id, scoutId: scout.id, region, weeksLeft: weeks, totalWeeks: weeks });
    queue.splice(queue.indexOf(id), 1);
  }
  if (done.length) world.news.unshift(`Scouting: new report${done.length === 1 ? "" : "s"} on ${done.map((id) => world.players[id]!.player.name).join(", ")}.`);
  return done;
}

export interface ScoutedValue {
  /** Best estimate. */
  value: number;
  low: number;
  high: number;
}

/**
 * What your agency believes an attribute to be. The error is fixed per
 * player, attribute and report, so the numbers don't jump around between
 * screens; better reports shrink it. Null means nothing is known.
 */
export function scoutedAttribute(world: World, playerId: string, key: AttributeKey): ScoutedValue | null {
  const wp = world.players[playerId];
  const k = world.agency.knowledge[playerId];
  if (!wp || !k || k.accuracy <= 0) return null;
  // Only the ratings the trips have revealed so far; the rest stay hidden.
  if (!revealedRatings(world, playerId).includes(key)) return null;
  const truth = wp.player.attributes[key];
  if (k.accuracy >= 0.999) return { value: truth, low: truth, high: truth };
  const rng = createRng(mixSeed(world.seed, Number(playerId.replace(/\D/g, "")) || 7, ALL_ATTRIBUTES.indexOf(key), k.reports));
  const spread = Math.ceil((1 - k.accuracy) * 5);
  const value = clamp(Math.round(truth + (rng.next() * 2 - 1) * spread), 1, 20);
  return { value, low: clamp(value - spread, 1, 20), high: clamp(value + spread, 1, 20) };
}

/** Hidden traits come into view once a report is good enough. */
export const HIDDEN_REVEAL_ACCURACY = 0.6;
/** Ratings a scouting trip reveals: ten more each trip, in the same order for every scout. */
export const RATINGS_PER_TRIP = 10;
/** The trip that shows a player's archetype. */
export const ARCHETYPE_TRIP = 2;

/** How many scouting trips (reports) your agency has on a player. Clients count as fully known. */
export const scoutTrips = (world: World, playerId: string): number => world.agency.knowledge[playerId]?.reports ?? 0;

/** The ratings your scouting has revealed so far, in the order they come into view. */
export function revealedRatings(world: World, playerId: string): AttributeKey[] {
  const trips = scoutTrips(world, playerId);
  if (trips === 0) return [];
  const rng = createRng(mixSeed(world.seed, Number(playerId.replace(/\D/g, "")) || 7, 4401));
  const order = [...VISIBLE_ATTRIBUTES];
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order.slice(0, Math.min(order.length, RATINGS_PER_TRIP * trips));
}

/** Whether every rating is in view (after three trips). */
export const ratingsFullyKnown = (world: World, playerId: string): boolean => revealedRatings(world, playerId).length === VISIBLE_ATTRIBUTES.length;

/** A player's archetype, if your agency knows it (from the second trip). */
export function knownArchetype(world: World, playerId: string): ArchetypeId | null {
  const a = world.players[playerId]?.player.archetype;
  return a && scoutTrips(world, playerId) >= ARCHETYPE_TRIP ? a : null;
}

/** The known archetypes among some players, for lists and leaderboards. */
export function knownArchetypes(world: World, ids: Iterable<string>): Record<string, ArchetypeId> {
  const out: Record<string, ArchetypeId> = {};
  for (const id of ids) {
    const a = knownArchetype(world, id);
    if (a) out[id] = a;
  }
  return out;
}

export function knowsHidden(world: World, playerId: string): boolean {
  return (world.agency.knowledge[playerId]?.accuracy ?? 0) >= HIDDEN_REVEAL_ACCURACY;
}
