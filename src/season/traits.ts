/**
 * The season's side of player traits: who has them, what your scouts have
 * seen, and the effects off the course (fitness, injuries, mood, contracts,
 * sponsors, development, and the few traits that come and go).
 */
import { clamp, hasTrait, homeRegion, rollTraits, traceSeed, traitsOf, type PlayerEventContext, type Rng } from "../engine";
import { rankMap } from "./points";
import { familiarityContext } from "./familiarity";
import { caddieOnBag, travelMode } from "./team";
import type { Region, SponsorCategory, TourEvent, World, WorldPlayer } from "./types";

/** Gives every player without traits his roll. Run when a world is made or loaded, and each week. */
export function ensureTraits(world: World): void {
  for (const wp of Object.values(world.players)) if (!wp.player.traits) wp.player.traits = rollTraits(wp.player);
}

export const has = (wp: WorldPlayer, id: string): boolean => hasTrait(wp.player, id);

/**
 * The traits your agency knows about: all of a client's, and for anyone else
 * each one your scouting has picked up (a report at accuracy x spots each trait
 * with chance x, and a sharper report never forgets what an earlier one saw).
 */
export function knownTraits(world: World, id: string): string[] {
  const wp = world.players[id];
  if (!wp) return [];
  const all = traitsOf(wp.player);
  if (wp.client) return [...all];
  const accuracy = world.agency.knowledge[id]?.accuracy ?? 0;
  return all.filter((t) => (traceSeed(id, t, "seen") % 1000) / 1000 < accuracy);
}

/** Region of an event this season (or null if it has gone from the schedule). */
function regionOf(world: World, eventId: string): Region | null {
  return world.schedule.find((e) => e.id === eventId)?.region ?? null;
}

/** Weeks in a row he has played up to last week, this season. */
function streakBefore(world: World, wp: WorldPlayer): number {
  const weeks = new Set(wp.career.results.filter((r) => r.season === world.season).map((r) => r.week));
  let n = 0;
  while (weeks.has(world.week - 1 - n)) n++;
  return n;
}

/** Straight starts outside his home region, most recent first, up to last week. */
function awayStreak(world: World, wp: WorldPlayer): number {
  const home = homeRegion(wp.player.nationality);
  if (!home) return 0;
  const recent = wp.career.results.filter((r) => r.season === world.season).sort((a, b) => b.week - a.week);
  let n = 0;
  for (const r of recent) {
    if (regionOf(world, r.eventId) === home) break;
    n++;
  }
  return n;
}

/** What the season knows about a player's week at an event, for the golf traits. */
export function eventContext(world: World, event: TourEvent, id: string): PlayerEventContext {
  const wp = world.players[id]!;
  const results = wp.career.results;
  const thisSeason = results.filter((r) => r.season === world.season);
  const last = thisSeason.reduce((m, r) => Math.max(m, r.week), 0);
  return {
    majorsStarted: results.filter((r) => r.tier === "major").length,
    missedCutHereLastSeason: results.some((r) => r.season === world.season - 1 && r.eventId === event.id && !r.madeCut),
    top25sHere: results.filter((r) => r.season < world.season && r.eventId === event.id && r.madeCut && r.position <= 25).length,
    home: homeRegion(wp.player.nationality) === event.region,
    regionChanged: wp.career.lastRegion !== null && wp.career.lastRegion !== event.region,
    consecutiveStarts: streakBefore(world, wp) + 1,
    weeksOff: last === 0 ? 99 : world.week - 1 - last,
    lateSeason: world.week > 30,
    ...familiarityContext(wp, event),
    ...(wp.client ? { caddie: caddieOnBag(world, wp), flewPrivate: travelMode(world, wp).private } : {}),
  };
}

// ------------------------------------------------------------------ fitness & injuries

/** Multiplier on the conditioning an event costs him. */
export function fatigueMultiplier(world: World, wp: WorldPlayer): number {
  let m = 1;
  if (has(wp, "iron-man")) m *= 0.7;
  if (has(wp, "night-before")) m *= 0.85;
  if (has(wp, "needs-rest") && streakBefore(world, wp) >= 2) m *= 1.4;
  return m;
}

/** Whether a trip between regions tires him. */
export const feelsTravel = (wp: WorldPlayer): boolean => !has(wp, "road-warrior");

/** Multiplier on a rest week's recovery. */
export const recoveryMultiplier = (world: World, wp: WorldPlayer): number => (has(wp, "late-fade") && world.week > 30 ? 0.75 : 1);

/** Multiplier on the weekly injury chance. */
export function injuryRisk(wp: WorldPlayer, highIntensity: boolean): number {
  return (has(wp, "glass-back") ? 1.5 : 1) * (has(wp, "gym-rat") && highIntensity ? 1.15 : 1);
}

/** How long a new injury keeps him out, after his traits. */
export function injuryLength(wp: WorldPlayer, weeks: number): number {
  if (has(wp, "glass-back")) weeks += 1;
  if (has(wp, "quick-healer")) weeks = Math.ceil(weeks * 0.6);
  return weeks;
}

/** A player back from a long injury: Comeback Kids return in form and learn fast for a while. */
export function returnFromInjury(wp: WorldPlayer, totalWeeks: number): void {
  if (!has(wp, "comeback-kid") || totalWeeks < 6) return;
  wp.player.form = clamp(wp.player.form + 0.2, -1, 1);
  wp.comebackWeeks = 10;
}

// ------------------------------------------------------------------ mood & contracts

export interface MoodWeek {
  played: boolean;
  madeCut: boolean | null;
  earnings: number;
  /** He was entered in an opposite-field event by your choice. */
  sentToOpposite: boolean;
  /** Other clients who played the same event. */
  stablemates: number;
  /** Another of your clients won this week. */
  stablemateWon: boolean;
  /** He played an event in his home region. */
  playedAtHome: boolean;
}

/** Trait mood effects for the week (happiness points), plus any form change. */
export function traitMood(world: World, wp: WorldPlayer, w: MoodWeek): number {
  const c = wp.client;
  if (!c) return 0;
  let d = 0;
  if (has(wp, "diva")) {
    const coaches = Object.values(c.staff).map((id) => world.coaches.find((x) => x.id === id)?.quality ?? 0);
    if (coaches.length === 0 || coaches.some((q) => q < 14)) d -= 2;
  }
  if (has(wp, "homesick") && w.played && awayStreak(world, wp) >= 3) {
    d -= 2;
    wp.player.form = clamp(wp.player.form - 0.1, -1, 1);
  }
  if (has(wp, "needs-rest") && w.played && streakBefore(world, wp) >= 3) d -= 3;
  if (has(wp, "jealous-rival") && w.stablemateWon) d -= 5;
  if (has(wp, "money-motivated") && w.earnings > 0) d += Math.min(10, (w.earnings / 1_000_000) * 10);
  if (has(wp, "schedule-rebel") && w.sentToOpposite) d -= 5;
  if (has(wp, "team-player") && w.played) d += 2 * w.stablemates;
  if (has(wp, "home-crowd-hero") && w.playedAtHome) d += 3;
  if (w.madeCut === false) {
    if (has(wp, "hothead")) d -= 6;
    if (has(wp, "social-media-star")) d -= 3;
  }
  return d;
}

/** A hothead's missed cut sometimes makes the news, and it costs the agency. */
export function hotheadHeadline(world: World, wp: WorldPlayer, rng: Rng): void {
  if (!has(wp, "hothead") || !rng.chance(0.1)) return;
  world.news.unshift(`${wp.player.name} snaps a club and swears at a marshal after missing the cut. ${world.agency.name} fields the calls.`);
  world.agency.reputation = clamp(world.agency.reputation - 0.5, 0, 100);
}

/**
 * How much a week's mood change sticks: Loyal players' spirits sink half as
 * fast; Grateful Underdogs never drop below 40 in their first two seasons.
 */
export function settleHappiness(wp: WorldPlayer, before: number, world: World): void {
  const c = wp.client;
  if (!c) return;
  if (has(wp, "loyal") && c.happiness < before) c.happiness = before - (before - c.happiness) * 0.5;
  if (has(wp, "grateful-underdog") && (c.gratefulUntil ?? -1) >= world.season) c.happiness = Math.max(40, c.happiness);
}

/** How much schedule and commission decisions weigh on his mood (Low-Maintenance: less). */
export const decisionSensitivity = (wp: WorldPlayer): number => (has(wp, "low-maintenance") ? 0.6 : 1);

/** Extra mood hit for being kept out of a big event. */
export const heldOutPenalty = (wp: WorldPlayer): number => (has(wp, "schedule-rebel") ? 10 : 0);

/** Points added to (or taken from) the score when he weighs re-signing. */
export function extensionBias(world: World, wp: WorldPlayer): number {
  let b = 0;
  if (has(wp, "loyal")) b += 10;
  if (has(wp, "mercenary") && (wp.client?.happiness ?? 0) < 70) b -= 10;
  if (has(wp, "hard-bargainer")) b -= 8;
  if (has(wp, "grateful-underdog") && (wp.client?.gratefulUntil ?? -1) >= world.season) b += 5;
  return b;
}

/** How much commission counts in his talks (Money Motivated players care more). */
export const commissionWeight = (wp: WorldPlayer): number => (has(wp, "money-motivated") ? 1.5 : 1);

/** Free agents like an agency with a Team Player on the books. */
export const recruitingBonus = (world: World): number => (world.clientIds.some((id) => world.players[id] && has(world.players[id]!, "team-player")) ? 5 : 0);

/** When you sign him: an underdog from outside the top 100 stays grateful for two seasons. */
export function onSigned(world: World, wp: WorldPlayer): void {
  if (!wp.client || !has(wp, "grateful-underdog")) return;
  if ((rankMap(world).get(wp.player.id) ?? 999) > 100) wp.client.gratefulUntil = world.season + 1;
}

/** Reputation your agency gains from a client's result, on top of the usual. */
export function reputationBonus(wp: WorldPlayer, position: number, madeCut: boolean): number {
  if (!madeCut) return 0;
  let r = 0;
  if (position === 1 && has(wp, "media-darling")) r += 1;
  if (position <= 10 && has(wp, "box-office")) r += 2;
  return r;
}

// ------------------------------------------------------------------ sponsors

const IMAGE_CATEGORIES: SponsorCategory[] = ["financial", "watch", "automotive"];

/** Multiplier on a new sponsor offer's annual value. */
export function sponsorValueMultiplier(world: World, wp: WorldPlayer, category: SponsorCategory): number {
  let m = 1;
  if (has(wp, "sponsor-magnet")) m *= 1.2;
  if (has(wp, "media-darling")) m *= 1.05;
  if (has(wp, "social-media-star") && wp.player.age < 30) m *= 1.15;
  if (has(wp, "clean-cut") && IMAGE_CATEGORIES.includes(category)) m *= 1.15;
  if (has(wp, "bonus-hunter")) m *= 0.9;
  if (has(wp, "anonymous-grinder") && (rankMap(world).get(wp.player.id) ?? 999) > 20) m *= 0.75;
  if (has(wp, "box-office")) m *= 1.5;
  return m;
}

export const bonusMultiplier = (wp: WorldPlayer): number => (has(wp, "bonus-hunter") ? 1.3 : 1);
export const offerChanceMultiplier = (wp: WorldPlayer): number => (has(wp, "sponsor-magnet") ? 1.5 : 1);

// ------------------------------------------------------------------ development

/** The age he actually peaks at, after his traits. */
export function effectivePeak(wp: WorldPlayer): number {
  return wp.player.peakAge + (has(wp, "late-bloomer") ? 3 : 0) - (has(wp, "early-peaker") ? 3 : 0);
}

// ------------------------------------------------------------------ traits that come and go

function addTrait(wp: WorldPlayer, id: string): void {
  const t = traitsOf(wp.player);
  if (!t.includes(id)) wp.player.traits = [...t, id];
}

function removeTrait(wp: WorldPlayer, id: string): void {
  wp.player.traits = traitsOf(wp.player).filter((t) => t !== id);
}

/** A major win can make a big-stage player of anyone. */
export function onMajorWin(world: World, wp: WorldPlayer): void {
  if (has(wp, "major-monster") || has(wp, "major-mindset")) return;
  if (has(wp, "big-stage-freeze")) removeTrait(wp, "big-stage-freeze");
  addTrait(wp, "major-mindset");
  if (wp.client) world.news.unshift(`${wp.player.name} has a major now, and a new belief to go with it (Major Mindset).`);
}

const CURABLE = [
  ["chip-yips", "the chipping yips"],
  ["tilt-merchant", "his temper on the course"],
  ["big-stage-freeze", "his nerves at the majors"],
] as const;

/**
 * Season end: a season with a mental coach rated 14+ cures the mental
 * demons, and a veteran's putting stroke can go.
 */
export function seasonEndTraits(world: World, rng: Rng): void {
  for (const wp of Object.values(world.players)) {
    const c = wp.client;
    if (c?.staff.mental) {
      const q = world.coaches.find((x) => x.id === c.staff.mental)?.quality ?? 0;
      if (q >= 14) {
        for (const [id, words] of CURABLE) {
          if (!has(wp, id)) continue;
          removeTrait(wp, id);
          world.news.unshift(`A season with his mental coach has cured ${wp.player.name} of ${words}.`);
        }
      }
    }
    if (wp.player.age >= 38 && !has(wp, "yips-prone") && !has(wp, "three-foot-robot") && !has(wp, "clutch-gene") && rng.chance(0.03)) {
      addTrait(wp, "yips-prone");
      if (c) world.news.unshift(`${wp.player.name} admits the short putts have started to feel different (Yips-Prone).`);
    }
  }
}

/** Weekly surprises: a tinkerer starts a rebuild nobody asked for; a scandal breaks. */
export function weeklyTraitEvents(world: World, rng: Rng, startRebuild: (wp: WorldPlayer) => void): void {
  for (const id of world.clientIds) {
    const wp = world.players[id];
    if (!wp?.client) continue;
    if (has(wp, "swing-tinkerer") && !wp.rebuild && rng.chance(0.005)) {
      startRebuild(wp);
      world.news.unshift(`${wp.player.name} has decided to rebuild his swing. Nobody asked him to.`);
    }
    if (has(wp, "scandal-prone") && rng.chance(0.05 / 41)) {
      const lost = wp.client.sponsors.length ? wp.client.sponsors[rng.int(0, wp.client.sponsors.length - 1)]! : null;
      if (lost) wp.client.sponsors = wp.client.sponsors.filter((s) => s !== lost);
      world.agency.reputation = clamp(world.agency.reputation - 3, 0, 100);
      world.news.unshift(`Scandal: ${wp.player.name} is in the tabloids${lost ? `, and ${lost.sponsor} ends his deal` : ""}.`);
    }
  }
}
