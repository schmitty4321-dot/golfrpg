import { createRng } from "../engine";
import { newDevelopment } from "./development";
import { generateCoaches } from "./staff";
import { SAVE_VERSION, type World, type WorldPlayer } from "./types";

export function serializeWorld(world: World): string {
  return JSON.stringify(world);
}

/** Loads a save, upgrading older versions so no career is ever lost. */
export function deserializeWorld(json: string): World {
  const raw = JSON.parse(json) as { version?: number } & Record<string, unknown>;
  if (raw.version === 1) migrateV1(raw);
  const world = raw as unknown as World;
  if (world.version !== SAVE_VERSION) throw new Error(`unsupported save version ${String(world.version)}`);
  if (!world.players[world.clientId]) throw new Error("save has no client player");
  return world;
}

/** Version 1 (before development): add ceilings, injuries, coaches and training. */
function migrateV1(raw: Record<string, unknown>): void {
  const world = raw as unknown as World;
  const rng = createRng(world.seed ^ 0x2);
  for (const wp of Object.values(world.players) as WorldPlayer[]) {
    wp.development = newDevelopment(wp.player, rng);
    wp.injury = null;
    wp.rebuild = null;
  }
  world.finances.coaching = 0;
  for (const s of world.pastSeasons) s.client.finances.coaching ??= 0;
  world.coaches = generateCoaches(world.seed);
  world.staff = {};
  world.training = { focus: "balanced", intensity: "normal" };
  (world as { version: number }).version = SAVE_VERSION;
}
