/**
 * Family on tour, kept light: a line on the profile (single, a partner or
 * married, and children), a weekly choice of whether the family travels to his
 * event, and a few life events over a career as inbox decisions (see
 * dilemmas.ts). Computer players get a family from their age only, for show.
 */
import { clamp, traceSeed } from "../engine";
import { homeCityOf, noteHomeWeek, withinDrive } from "./homeBase";
import { caddiesOf, hireCaddie, travelMode } from "./team";
import { has } from "./traits";
import { absWeek, type Family, type TourEvent, type World, type WorldPlayer } from "./types";

/** What the family's trip costs on top of his own, by region (a drive from home costs less). */
const FAMILY_TRAVEL = { NA: 4_000, EU: 8_000, ASIA: 9_000, AUS: 9_000 } as const;
export const FAMILY_MOOD = 3;
/** Young children on the road (four and under) cost him this much condition. */
export const YOUNG_KIDS_FATIGUE = 2;

const roll = (wp: WorldPlayer, what: string) => (traceSeed("family", wp.player.id, what) % 1000) / 1000;

/** A family drawn from his age alone (the same every time for the same player). */
export function defaultFamily(wp: WorldPlayer, season: number): Family {
  const age = wp.player.age;
  const r = roll(wp, "status");
  const [single, partner] = age < 24 ? [0.7, 0.3] : age < 30 ? [0.4, 0.3] : [0.15, 0.15];
  const status = r < single ? "single" : r < single + partner ? "partner" : "married";
  const children: number[] = [];
  if (status === "married" && age >= 27) {
    const n = Math.min(3, Math.floor(roll(wp, "kids") * Math.min(4, (age - 25) / 3)));
    for (let i = 0; i < n; i++) children.push(season - Math.floor(roll(wp, `kid${i}`) * Math.min(14, age - 26)));
    children.sort((a, b) => a - b);
  }
  return { status, children };
}

export const familyOf = (world: World, wp: WorldPlayer): Family => wp.family ?? defaultFamily(wp, world.season);

/** Clients keep their family on the save (life events change it); older saves and new signings get one now. */
export function ensureFamilies(world: World): void {
  for (const id of world.clientIds) {
    const wp = world.players[id];
    if (wp && !wp.family) wp.family = defaultFamily(wp, world.season);
  }
}

export const childAges = (world: World, wp: WorldPlayer): number[] => familyOf(world, wp).children.map((b) => Math.max(0, world.season - b)).sort((a, b) => b - a);
export const hasYoungKids = (world: World, wp: WorldPlayer): boolean => childAges(world, wp).some((a) => a <= 4);
export const hasSchoolKids = (world: World, wp: WorldPlayer): boolean => childAges(world, wp).some((a) => a >= 5 && a <= 15);
export const hasFamily = (world: World, wp: WorldPlayer): boolean => familyOf(world, wp).status !== "single";

const WORDS = ["no", "one", "two", "three", "four", "five"];

/** "Married, two children (6 and 3)". */
export function familyLabel(world: World, wp: WorldPlayer): string {
  const f = familyOf(world, wp);
  const status = f.status === "single" ? "Single" : f.status === "partner" ? "A partner" : "Married";
  const ages = childAges(world, wp);
  if (!ages.length) return status;
  const age = (a: number) => (a === 0 ? "a baby" : String(a));
  return `${status}, ${WORDS[ages.length] ?? ages.length} ${ages.length === 1 ? "child" : "children"} (${ages.length === 1 ? age(ages[0]!) : `${ages.slice(0, -1).map(age).join(", ")} and ${age(ages[ages.length - 1]!)}`})`;
}

/** Whether the family is on a summer on tour (a school-holidays decision). */
export const familyOnTour = (world: World, wp: WorldPlayer): boolean => (wp.client?.familyTourUntil ?? -1) >= absWeek(world.season, world.week);

/** His call: the family comes when it's a drive from home, a major, the summer on tour, or he's homesick and it's his part of the world. */
export function familyDefault(world: World, wp: WorldPlayer, event: TourEvent): boolean {
  if (!hasFamily(world, wp)) return false;
  if (familyOnTour(world, wp) || withinDrive(wp, event.courseId) || event.tier === "major") return true;
  return has(wp, "homesick") && event.region === homeCityOf(wp).region;
}

/** Whether the family travels with him to this event: your choice, or his call. */
export function familyTravels(world: World, wp: WorldPlayer, event: TourEvent, choice?: "travel" | "home"): boolean {
  if (!hasFamily(world, wp)) return false;
  return choice ? choice === "travel" : familyDefault(world, wp, event);
}

/** What the family's trip costs him. */
export function familyTripCost(world: World, wp: WorldPlayer, event: TourEvent): number {
  const kids = familyOf(world, wp).children.length;
  const mode = travelMode(world, wp);
  // The agency jet carries them for free; a drive costs less than flights.
  const fly = mode.private && world.agency.jet ? 0.2 : mode.cost;
  return Math.round((FAMILY_TRAVEL[event.region] * (0.8 + 0.4 * kids) * fly * (withinDrive(wp, event.courseId) ? 0.4 : 1)) / 100) * 100;
}

/** The family's week at his event: he pays, he's happier, homesickness eases; small children tire him. Returns the mood change. */
export function familyWeek(world: World, wp: WorldPlayer, event: TourEvent, choice?: "travel" | "home"): number {
  const c = wp.client;
  if (!c || !familyTravels(world, wp, event, choice)) return 0;
  c.finances.travel += familyTripCost(world, wp, event);
  noteHomeWeek(world, wp);
  if (hasYoungKids(world, wp)) wp.player.condition = clamp(wp.player.condition - YOUNG_KIDS_FATIGUE, 0, 100);
  return FAMILY_MOOD;
}

/** A new baby (from the "new baby" decision): a child born this season. */
export function addChild(world: World, wp: WorldPlayer): void {
  const f = (wp.family ??= defaultFamily(wp, world.season));
  if (f.status === "single") f.status = "partner";
  f.children = [...f.children, world.season].sort((a, b) => a - b);
}

export function marry(world: World, wp: WorldPlayer): void {
  const f = (wp.family ??= defaultFamily(wp, world.season));
  f.status = "married";
}

// ------------------------------------------------------------------ the family caddie

const RELATIONS = ["brother", "father", "cousin", "uncle"];
const FIRSTS = ["Dale", "Rick", "Mike", "Tom", "Gary", "Steve", "Ben", "Rob", "Phil", "Dave"];
const WIVES = ["Amy", "Kate", "Sarah", "Lucy", "Emma", "Jess"];

export const familyCaddieId = (clientId: string): string => `fam-${clientId}`;
export const isFamilyCaddie = (caddieId: string | undefined): boolean => !!caddieId?.startsWith("fam-");

/** Someone from his family who'd carry the bag: cheap, knows him inside out, not much of a caddie. */
export function familyCaddie(world: World, clientId: string): import("./types").Caddie {
  const wp = world.players[clientId]!;
  const last = wp.player.name.split(" ").slice(1).join(" ") || wp.player.name;
  const h = traceSeed("family-caddie", clientId);
  const married = familyOf(world, wp).status === "married";
  const relation = married && h % 5 === 0 ? "wife" : RELATIONS[h % RELATIONS.length]!;
  const first = relation === "wife" ? WIVES[(h >>> 3) % WIVES.length]! : FIRSTS[(h >>> 3) % FIRSTS.length]!;
  const skill = (n: number) => 4 + ((h >>> n) % 4);
  return { id: familyCaddieId(clientId), name: `${first} ${last} (his ${relation})`, greenReading: skill(6), clubbing: skill(9), calm: skill(12), weeklyFee: 600, share: 0.03 };
}

/** Weeks together a family caddie starts with: chemistry starts high. */
export const FAMILY_CADDIE_WEEKS = 25;

/** Puts the family member on the bag (he's added to the caddie list the first time). */
export function hireFamilyCaddie(world: World, clientId: string): void {
  const k = familyCaddie(world, clientId);
  const list = caddiesOf(world);
  if (!list.some((c) => c.id === k.id)) list.push(k);
  hireCaddie(world, clientId, k.id);
  world.players[clientId]!.client!.caddieWeeks = FAMILY_CADDIE_WEEKS;
}
