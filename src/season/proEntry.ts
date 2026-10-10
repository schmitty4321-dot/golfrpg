import { standingOrder } from "./amateurResults";
import { stars } from "./recruiting";
import type { World, WorldPlayer } from "./types";

/**
 * Records where an amateur stood when he turned professional: his place on the
 * amateur standing and his stars. Called just before his status changes, while
 * the standing still reflects his final season.
 */
export function recordProEntry(world: World, wp: WorldPlayer): void {
  const i = standingOrder(world).indexOf(wp.player.id);
  wp.career.proEntry = { season: world.season, place: i < 0 ? null : i + 1, stars: stars(world, wp.player.id) };
}
