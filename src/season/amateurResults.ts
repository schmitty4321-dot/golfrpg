/**
 * Amateur weeks: each week the whole amateur field plays one event, one finish
 * order and no rounds. The finish sets each amateur's season record, and his
 * place on the standing: his average share of the field across the season's
 * events (1 is the winner's share, 0 the last place's). Before his first event,
 * his preseason ranking stands in. The movement arrows compare this week's
 * standing with last week's.
 */
import { createRng } from "../engine";
import { overall } from "./development";
import { amateurRanking } from "./amateurs";
import { mixSeed } from "./entries";
import { absWeek, type World } from "./types";

/** How far an amateur's form and ability are scrambled on the day: a good amateur can still have a bad week. */
export const EVENT_NOISE = 1.5;

const amateurIds = (world: World): string[] =>
  Object.values(world.players)
    .filter((wp) => wp.career.status === "amateur")
    .map((wp) => wp.player.id)
    .sort();

/** The amateur standing right now, best first. */
export function standingOrder(world: World): string[] {
  const ids = amateurIds(world);
  const pre = amateurRanking(world);
  const preShare = new Map(pre.map((id, i) => [id, 1 - i / pre.length]));
  const score = (id: string): number => {
    const r = world.amateurRecords?.[id];
    return r && r.events > 0 ? r.share / r.events : (preShare.get(id) ?? 0);
  };
  return [...ids].sort((a, b) => score(b) - score(a) || (a < b ? -1 : 1));
}

/** Play this week's amateur event: the whole field, one finish order. */
export function amateurWeek(world: World): void {
  const ids = amateurIds(world);
  if (ids.length === 0) return;
  const rng = createRng(mixSeed(world.seed, absWeek(world.season, world.week), 515));
  const scored = ids.map((id) => {
    const wp = world.players[id]!;
    return { id, s: overall(wp.player) + wp.player.form * 0.5 + rng.normal(0, EVENT_NOISE) };
  });
  scored.sort((a, b) => b.s - a.s || (a.id < b.id ? -1 : 1));
  const field = scored.length;
  const records = (world.amateurRecords ??= {});
  scored.forEach((row, i) => {
    const finish = i + 1;
    const share = field > 1 ? (field - finish) / (field - 1) : 1;
    const r = (records[row.id] ??= { events: 0, wins: 0, top10: 0, top20: 0, best: finish, share: 0 });
    r.events++;
    if (finish === 1) r.wins++;
    if (finish <= 10) r.top10++;
    if (finish <= 20) r.top20++;
    r.best = Math.min(r.best, finish);
    r.lastFinish = finish;
    r.share += share;
  });
  world.amateurEvent = { season: world.season, week: world.week, field, finishes: scored.map((r) => r.id) };
  world.amateurStandingPrev = world.amateurStanding;
  world.amateurStanding = { season: world.season, week: world.week, order: standingOrder(world) };
}

/** How far an amateur moved on the standing since last week (positive is up), or null when there's no week to compare. */
export function standingMove(world: World, id: string): number | null {
  const prev = world.amateurStandingPrev?.order;
  const now = world.amateurStanding?.order;
  if (!prev || !now) return null;
  const a = prev.indexOf(id);
  const b = now.indexOf(id);
  if (a < 0 || b < 0) return null;
  return a - b;
}

/** A new season: the records and the standing start again from the preseason ranking. */
export function resetAmateurSeason(world: World): void {
  delete world.amateurRecords;
  delete world.amateurEvent;
  delete world.amateurStanding;
  delete world.amateurStandingPrev;
}
