/**
 * Where intel comes from, and how long it takes. The USA is split into four
 * quarters, and the HQ sits in one of them. Intel on a player takes a week if
 * he's in your home quarter, two weeks elsewhere in the USA, and three weeks
 * overseas. A scout works on two players at once in the same region, and three
 * overseas. The home quarter changes only the time, not the cost.
 */
import type { World, WorldPlayer } from "./types";

export type UsRegion = "North" | "South" | "East" | "West";
export const US_REGIONS: UsRegion[] = ["North", "South", "East", "West"];
/** Where a player is: a US quarter, overseas, or a US state we don't place. */
export type IntelRegion = UsRegion | "overseas" | "unknown";

/** Each state's quarter (a rough split: change it here if you'd draw the lines elsewhere). */
const STATE_REGION: Record<string, UsRegion> = {
  Michigan: "North", Ohio: "North", Illinois: "North", "New York": "North", Pennsylvania: "North",
  Texas: "South", Oklahoma: "South", Louisiana: "South", Mississippi: "South", Alabama: "South", Tennessee: "South",
  Florida: "East", Georgia: "East", "North Carolina": "East", "South Carolina": "East", Virginia: "East",
  California: "West", Arizona: "West", Nevada: "West", Utah: "West", Colorado: "West", Washington: "West", Hawaii: "West",
};

/** Where a player is: overseas, or the quarter of his home state (school state, if he has one). */
export function intelRegionOf(wp: WorldPlayer): IntelRegion {
  if (wp.player.nationality !== "USA") return "overseas";
  const state = wp.school && "state" in wp.school ? wp.school.state : undefined;
  return (state && STATE_REGION[state]) || "unknown";
}

/** The quarter your HQ is in (North until you choose). */
export const hqRegionOf = (world: World): UsRegion => world.agency.hqRegion ?? "North";

/** Weeks to gather intel on a player: his home quarter 1, another US quarter 2, overseas 3. An unplaced US player counts as elsewhere in the USA. */
export function intelWeeks(world: World, wp: WorldPlayer): number {
  const r = intelRegionOf(wp);
  if (r === "overseas") return 3;
  return r === hqRegionOf(world) ? 1 : 2;
}

/** How many players one scout can work on at once in a region: two in the same region, three overseas. */
export const intelCap = (region: IntelRegion): number => (region === "overseas" ? 3 : 2);

/** Moves the HQ to one of the four quarters. */
export function setHqRegion(world: World, region: UsRegion): void {
  world.agency.hqRegion = region;
  world.news.unshift(`Your HQ is now in the ${region.toLowerCase()}. Intel on players at home takes a week.`);
}
