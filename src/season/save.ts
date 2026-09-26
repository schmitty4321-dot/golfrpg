import type { World } from "./types";

export function serializeWorld(world: World): string {
  return JSON.stringify(world);
}

export function deserializeWorld(json: string): World {
  const world = JSON.parse(json) as World;
  if (world.version !== 1) throw new Error(`unsupported save version ${String(world.version)}`);
  if (!world.players[world.clientId]) throw new Error("save has no client player");
  return world;
}
