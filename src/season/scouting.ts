import { ALL_ATTRIBUTES, clamp, createRng, type ArchetypeId, type AttributeKey } from "../engine";
import { mixSeed } from "./entries";
import { absWeek, type Scout, type World } from "./types";

const FIRST = ["Walt", "Rosa", "Des", "Marty", "Yuki", "Ingrid", "Bo", "Carmen", "Olly", "Freddie", "Priya", "Sven"];
const LAST = ["Hollis", "Okafor", "Brennan", "Lukas", "Sato", "Varga", "Dunmore", "Reyes", "Whitlow", "Ahn", "Nakamura", "Pell"];

/** Players each scout can report on per week. */
export const REPORTS_PER_WEEK = 2;

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
  world.agency.hiredScouts.reduce((s, id) => s + (world.agency.scouts.find((x) => x.id === id)?.weeklyFee ?? 0), 0);

/** Weekly: each hired scout files reports on the next players in the queue. */
export function scoutingWeek(world: World): string[] {
  const done: string[] = [];
  const now = absWeek(world.season, world.week);
  // Scouts away on a trip don't work the queue at home.
  const away = new Set((world.agency.trips ?? []).map((t) => t.scoutId));
  const scouts = world.agency.hiredScouts.filter((id) => !away.has(id)).map((id) => world.agency.scouts.find((s) => s.id === id)!).sort((a, b) => b.quality - a.quality);
  for (const scout of scouts) {
    for (let i = 0; i < REPORTS_PER_WEEK; i++) {
      const id = world.agency.scoutingQueue.shift();
      if (!id) break;
      if (!world.players[id]) continue;
      const k = world.agency.knowledge[id];
      world.agency.knowledge[id] = { accuracy: reportAccuracy(scout.quality, k?.accuracy ?? 0), reports: (k?.reports ?? 0) + 1, absWeek: now };
      done.push(id);
    }
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
  const truth = wp.player.attributes[key];
  if (k.accuracy >= 0.999) return { value: truth, low: truth, high: truth };
  const rng = createRng(mixSeed(world.seed, Number(playerId.replace(/\D/g, "")) || 7, ALL_ATTRIBUTES.indexOf(key), k.reports));
  const spread = Math.ceil((1 - k.accuracy) * 5);
  const value = clamp(Math.round(truth + (rng.next() * 2 - 1) * spread), 1, 20);
  return { value, low: clamp(value - spread, 1, 20), high: clamp(value + spread, 1, 20) };
}

/** Hidden traits come into view once a report is good enough. */
export const HIDDEN_REVEAL_ACCURACY = 0.6;
/** A report this good shows a player's archetype. Your clients are always fully known. */
export const ARCHETYPE_REVEAL_ACCURACY = 0.4;

/** A player's archetype, if your agency knows it. */
export function knownArchetype(world: World, playerId: string): ArchetypeId | null {
  const a = world.players[playerId]?.player.archetype;
  return a && (world.agency.knowledge[playerId]?.accuracy ?? 0) >= ARCHETYPE_REVEAL_ACCURACY ? a : null;
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
