/**
 * Which players your agency knows exist. A player is discovered when he's one of
 * your clients, was in the starting pool, has been scouted (a trip or a report
 * gives him knowledge), or is on your watch list or the scouting queue. Players
 * who arrive later (the new classes, the academy) stay hidden until a scout finds them.
 */
import type { World } from "./types";

export function isDiscovered(world: World, id: string): boolean {
  // First version: only amateurs are hidden. Pros are always visible.
  if (world.players[id]?.career.status !== "amateur") return true;
  if (world.clientIds.includes(id)) return true;
  const a = world.agency;
  if (a.discovered?.[id]) return true;
  if ((a.knowledge[id]?.accuracy ?? 0) > 0) return true;
  return (a.shortlist ?? []).includes(id) || a.scoutingQueue.includes(id);
}

/** Saves from before discovery: everyone already in the world is known, as before. */
export function ensureDiscovery(world: World): void {
  if (world.agency.discovered) return;
  world.agency.discovered = Object.fromEntries(Object.keys(world.players).map((id) => [id, true as const]));
}
