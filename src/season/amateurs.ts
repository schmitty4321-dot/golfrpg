import { clamp, createRng, generatePlayer, type AttributeKey, type CourseStyle, type Rng } from "../engine";
import { overall } from "./development";
import { mixSeed } from "./entries";
import type { World, WorldPlayer } from "./types";

/** Where each year's amateurs come from, and what their golf culture gives them. */
const REGIONS: { nationality: string; weight: number; bias: Partial<Record<AttributeKey, number>>; style?: Partial<Record<CourseStyle, number>> }[] = [
  { nationality: "USA", weight: 30, bias: { drivingDistance: 1, aggression: 1, wedges: 1 } },
  { nationality: "Sweden", weight: 6, bias: { midIrons: 1, longIrons: 1, distanceControl: 1 } },
  { nationality: "Korea", weight: 8, bias: { shortPutts: 1, chipping: 1, focus: 1, drivingDistance: -1 } },
  { nationality: "Japan", weight: 8, bias: { lagPutting: 1, pitching: 1, professionalism: 1, drivingDistance: -1 } },
  { nationality: "England", weight: 7, bias: { windTolerance: 1 }, style: { links: 3 } },
  { nationality: "Scotland", weight: 4, bias: { windTolerance: 2, trajectoryControl: 1 }, style: { links: 3 } },
  { nationality: "Ireland", weight: 4, bias: { windTolerance: 2, creativity: 1 }, style: { links: 3 } },
  { nationality: "Australia", weight: 7, bias: { windTolerance: 2, drivingDistance: 1 }, style: { links: 2 } },
  { nationality: "South Africa", weight: 6, bias: { windTolerance: 1, bunkerPlay: 1, composure: 1 } },
  { nationality: "Spain", weight: 6, bias: { creativity: 2, chipping: 1, pitching: 1 } },
  { nationality: "Argentina", weight: 5, bias: { creativity: 1, shotShaping: 1 } },
  { nationality: "Canada", weight: 5, bias: { drivingAccuracy: 1, courseManagement: 1 } },
];

/** New amateurs each year. */
export const AMATEUR_CLASS_SIZE = 24;
/**
 * Ceilings for each new class come from a fixed spread, so the world's
 * talent level stays put across decades: most amateurs top out as journeymen,
 * a few as tour winners, and a generational talent (17) is very rare.
 */
export function amateurPotential(currentOverall: number, rng: Rng): number {
  const drawn = rng.normal(11.6, 1.6);
  return Math.round(clamp(drawn, currentOverall + 0.5, 17) * 10) / 10;
}

/** Amateurs turn pro by this age at the latest. */
export const PRO_AGE = 22;

function pickRegion(rng: Rng) {
  const total = REGIONS.reduce((s, r) => s + r.weight, 0);
  let x = rng.next() * total;
  for (const r of REGIONS) {
    x -= r.weight;
    if (x <= 0) return r;
  }
  return REGIONS[0]!;
}

/** One amateur, shaped by where he learned the game. */
export function generateAmateur(rng: Rng, id: string, age: number, usedNames: Set<string>): WorldPlayer["player"] {
  const region = pickRegion(rng);
  const p = generatePlayer(rng, { tier: age <= 17 ? "junior" : "college", nationality: region.nationality, usedNames });
  p.id = id;
  p.age = age;
  for (const [k, d] of Object.entries(region.bias) as [AttributeKey, number][]) p.attributes[k] = clamp(p.attributes[k] + d, 1, 20);
  for (const [k, d] of Object.entries(region.style ?? {}) as [CourseStyle, number][]) p.styleComfort[k] = clamp(p.styleComfort[k] + d, 1, 20);
  return p;
}

/**
 * The amateur ranking: how good each amateur looks on the college and
 * amateur circuit, with a little luck from this season. Public: you don't
 * need a scout to read it, only to know why.
 */
export function amateurRanking(world: World): string[] {
  const rng = createRng(mixSeed(world.seed, world.season, 404));
  const luck = new Map<string, number>();
  const amateurs = Object.values(world.players).filter((wp) => wp.career.status === "amateur");
  for (const wp of [...amateurs].sort((a, b) => a.player.id.localeCompare(b.player.id))) luck.set(wp.player.id, rng.normal(0, 0.6));
  const score = (wp: WorldPlayer) => overall(wp.player) + wp.player.form * 0.5 + (luck.get(wp.player.id) ?? 0);
  return amateurs.sort((a, b) => score(b) - score(a)).map((wp) => wp.player.id);
}

/** A client (or anyone) leaves the amateur ranks and joins the developmental tour. */
export function turnPro(world: World, id: string): void {
  const wp = world.players[id];
  if (!wp || wp.career.status !== "amateur") return;
  wp.career.status = "none";
  world.news.unshift(`${wp.player.name} turns professional${wp.client ? ` with ${world.agency.name}` : ""}.`);
}

export function canTurnPro(world: World, id: string): boolean {
  return world.players[id]?.career.status === "amateur";
}
