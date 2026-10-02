/**
 * Scouting trips: send a hired scout to a part of the world for two to four
 * weeks to look at its amateurs or its players without a card. Reports come
 * in as the trip goes, sharpening week by week (first impressions, then the
 * full picture). Each scout has an eye for one part of the game, which steers
 * who he watches. A good one may turn up a hidden gem: a lower-ranked
 * amateur with a star's ceiling (and sometimes a rival's scout was there too,
 * and will bid hard for him). The trip ends with his report in the inbox.
 *
 * A scout on a trip doesn't work the scouting queue at home.
 */
import { ATTRIBUTE_GROUPS, createRng, homeRegion, type AttributeKey } from "../engine";
import { amateurRanking } from "./amateurs";
import { overall } from "./development";
import { addDecision } from "./inbox";
import { mixSeed } from "./entries";
import { reportAccuracy } from "./scouting";
import { ensureRivals } from "./rivals";
import { absWeek, type Scout, type World, type WorldPlayer } from "./types";

export type ScoutRegion = "NA" | "EU" | "ASIA" | "AUS" | "ROW";

export const SCOUT_REGIONS: Record<ScoutRegion, { label: string; travel: number }> = {
  NA: { label: "North America", travel: 3_000 },
  EU: { label: "Europe", travel: 6_000 },
  ASIA: { label: "Asia", travel: 7_000 },
  AUS: { label: "Australia and the Pacific", travel: 7_000 },
  ROW: { label: "Rest of the world", travel: 6_000 },
};

export type ScoutEye = "power" | "irons" | "shortGame" | "putting" | "mental";
export const EYE_LABELS: Record<ScoutEye, string> = {
  power: "an eye for power",
  irons: "an eye for iron play",
  shortGame: "an eye for the short game",
  putting: "an eye for putting",
  mental: "an eye for temperament",
};
const EYE_SKILLS: Record<ScoutEye, readonly AttributeKey[]> = {
  power: ATTRIBUTE_GROUPS.longGame,
  irons: ATTRIBUTE_GROUPS.approach,
  shortGame: ATTRIBUTE_GROUPS.shortGame,
  putting: ATTRIBUTE_GROUPS.putting,
  mental: ATTRIBUTE_GROUPS.mental,
};

export interface ScoutTrip {
  id: string;
  scoutId: string;
  region: ScoutRegion;
  focus: "amateurs" | "pros";
  weeks: number;
  weeksLeft: number;
  /** Players he has seen, in the order he found them. */
  found: string[];
  gem?: string;
  /** A rival's scout was watching the gem too. */
  rival?: string;
}

/** The part of the game a scout watches most closely (fixed for each scout). */
export function scoutEye(scout: Scout): ScoutEye {
  const eyes: ScoutEye[] = ["power", "irons", "shortGame", "putting", "mental"];
  return eyes[(Number(scout.id.replace(/\D/g, "")) || 0) % eyes.length]!;
}

export const regionOf = (wp: WorldPlayer): ScoutRegion => (homeRegion(wp.player.nationality) as ScoutRegion | null) ?? "ROW";
export const scoutOnTrip = (world: World, scoutId: string): ScoutTrip | undefined => (world.agency.trips ?? []).find((t) => t.scoutId === scoutId);
export const tripCostPerWeek = (region: ScoutRegion): number => SCOUT_REGIONS[region].travel;

/** Who a trip can look at in a region: its amateurs, or its young professionals without a card. */
export function regionPool(world: World, region: ScoutRegion, focus: "amateurs" | "pros"): WorldPlayer[] {
  return Object.values(world.players).filter(
    (wp) => !wp.client && regionOf(wp) === region && (focus === "amateurs" ? wp.career.status === "amateur" : wp.career.status === "none" && wp.player.age <= 30),
  );
}

/** Sends a hired scout on a trip. Returns why he can't go, or null. */
export function sendScout(world: World, scoutId: string, region: ScoutRegion, focus: "amateurs" | "pros", weeks: number): string | null {
  if (!world.agency.hiredScouts.includes(scoutId)) return "Hire the scout first.";
  if (scoutOnTrip(world, scoutId)) return "He's already away.";
  if (weeks < 2 || weeks > 4) return "Trips last two to four weeks.";
  if (regionPool(world, region, focus).length === 0) return "Nobody to look at there.";
  (world.agency.trips ??= []).push({ id: `trip-${absWeek(world.season, world.week)}-${scoutId}`, scoutId, region, focus, weeks, weeksLeft: weeks, found: [] });
  const scout = world.agency.scouts.find((s) => s.id === scoutId)!;
  world.news.unshift(`${scout.name} sets off on a ${weeks}-week scouting trip to ${SCOUT_REGIONS[region].label}.`);
  return null;
}

/** How interesting a prospect looks to this scout: room to grow, plus what his eye picks out. */
function interest(wp: WorldPlayer, eye: ScoutEye): number {
  const keys = EYE_SKILLS[eye];
  const a = wp.player.attributes;
  const eyeScore = keys.reduce((t, k) => t + a[k], 0) / keys.length - overall(wp.player);
  return wp.development.potential - overall(wp.player) + eyeScore * 0.5;
}

/** A week of every trip: new players seen, earlier ones watched again, the bills paid; finished trips report. */
export function scoutTripsWeek(world: World): void {
  const trips = world.agency.trips ?? [];
  if (!trips.length) return;
  const now = absWeek(world.season, world.week);
  const ranked = amateurRanking(world);
  for (const trip of [...trips]) {
    const scout = world.agency.scouts.find((s) => s.id === trip.scoutId);
    if (!scout || !world.agency.hiredScouts.includes(scout.id)) {
      world.agency.trips = (world.agency.trips ?? []).filter((t) => t !== trip);
      continue;
    }
    const rng = createRng(mixSeed(world.seed, world.season, world.week, 2201, Number(scout.id.replace(/\D/g, "")) || 1));
    const eye = scoutEye(scout);
    // The travel bills.
    const cost = tripCostPerWeek(trip.region);
    world.agency.bank -= cost;
    world.agency.ledger.scouts += cost;
    // The ones already found are watched again: the picture sharpens.
    const full = reportAccuracy(scout.quality, 0);
    for (const id of trip.found) {
      const k = world.agency.knowledge[id];
      if (k) world.agency.knowledge[id] = { accuracy: Math.max(k.accuracy, Math.min(full, k.accuracy + 0.15)), reports: k.reports + 1, absWeek: now };
    }
    // Two new players a week: the most interesting to his eye, with a little luck.
    const pool = regionPool(world, trip.region, trip.focus)
      .filter((wp) => !trip.found.includes(wp.player.id))
      .map((wp) => ({ wp, score: interest(wp, eye) + rng.normal(0, 0.8) }))
      .sort((a, b) => b.score - a.score);
    for (const { wp } of pool.slice(0, 2)) {
      const id = wp.player.id;
      trip.found.push(id);
      const k = world.agency.knowledge[id];
      // First impressions only, for now.
      world.agency.knowledge[id] = { accuracy: Math.max(k?.accuracy ?? 0, 0.3), reports: (k?.reports ?? 0) + 1, absWeek: now };
    }
    // A hidden gem: an amateur ranked outside the top 15 with a star's ceiling. Better scouts find more.
    if (!trip.gem && trip.focus === "amateurs" && rng.chance(0.03 + scout.quality * 0.012)) {
      const gem = regionPool(world, trip.region, "amateurs").find((wp) => wp.development.potential >= 14 && (ranked.indexOf(wp.player.id) + 1 || 99) > 15);
      if (gem) {
        trip.gem = gem.player.id;
        if (!trip.found.includes(gem.player.id)) trip.found.push(gem.player.id);
        world.agency.knowledge[gem.player.id] = { accuracy: Math.max(world.agency.knowledge[gem.player.id]?.accuracy ?? 0, 0.5), reports: 1, absWeek: now };
        if (rng.chance(0.3)) {
          trip.rival = rng.pick(ensureRivals(world)).name;
          (world.agency.contested ??= {})[gem.player.id] = trip.rival;
        }
      }
    }
    trip.weeksLeft--;
    if (trip.weeksLeft <= 0) finishTrip(world, trip, scout);
  }
}

function finishTrip(world: World, trip: ScoutTrip, scout: Scout): void {
  world.agency.trips = (world.agency.trips ?? []).filter((t) => t !== trip);
  // The full report on everyone he saw.
  const now = absWeek(world.season, world.week);
  for (const id of trip.found) {
    const k = world.agency.knowledge[id];
    world.agency.knowledge[id] = { accuracy: Math.max(k?.accuracy ?? 0, reportAccuracy(scout.quality, 0)), reports: (k?.reports ?? 0) + 1, absWeek: now };
  }
  const names = trip.found.map((id) => world.players[id]?.player.name).filter(Boolean);
  const gem = trip.gem ? world.players[trip.gem]?.player.name : null;
  const text = [
    `Back from ${SCOUT_REGIONS[trip.region].label}: ${names.length} player${names.length === 1 ? "" : "s"} seen (${names.slice(0, 6).join(", ")}${names.length > 6 ? ", ..." : ""}).`,
    gem ? `One stands out: ${gem}. Ranked low, but I think he could be a star.` : "",
    trip.rival ? `${trip.rival}'s scout was there too. They'll want him.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  addDecision(world, {
    kind: "message",
    key: `trip-${trip.id}`,
    clientId: "",
    from: scout.name,
    title: `${scout.name}'s scouting report`,
    text,
    choices: [
      { id: "board", label: "Put them on the recruitment board", detail: "Everyone he found goes on your board.", effects: [{ k: "shortlist", ids: [...trip.found] }] },
      { id: "keep", label: "Just keep the reports", detail: "The reports are in either way.", effects: [] },
    ],
    defaultChoice: "keep",
    big: !!gem,
  });
}
