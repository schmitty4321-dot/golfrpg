/**
 * Player rivalries: a storyline between one of your clients and another
 * player. They start at a flashpoint (a playoff, a final-round duel, a
 * match-play knockout, a Ryder Cup singles) and build heat (0-100) every time
 * the two meet in contention; heat fades a little each week. Every event both
 * finish, the better finish counts on the head-to-head.
 *
 * When a hot rival is in the same field, it gets to your client: a
 * competitor (ambitious, clutch or ice-cold) finds a little extra, a fragile
 * one (a hothead, a tilter, a leaderboard watcher) a little less. At most
 * about 0.15 strokes a round either way.
 */
import { clamp } from "../engine";
import type { MatchResult, TournamentResult } from "../engine";
import { followers } from "./showcase";
import { has } from "./traits";
import type { RyderCupResult } from "./ryderCup";
import type { TourEvent, World, WorldPlayer } from "./types";

export interface Rivalry {
  /** Your client. */
  a: string;
  b: string;
  names: { a: string; b: string };
  heat: number;
  aWins: number;
  bWins: number;
  since: number;
  last?: { season: number; week: number; text: string };
}

/** Heat at which a rivalry starts to matter on the course. */
export const HOT = 40;
const MAX_RIVALRIES = 16;
const WEEKLY_FADE = 1;

export const rivalriesOf = (world: World, clientId: string): Rivalry[] => (world.rivalries ?? []).filter((r) => r.a === clientId).sort((x, y) => y.heat - x.heat);

const find = (world: World, a: string, b: string): Rivalry | undefined => (world.rivalries ?? []).find((r) => r.a === a && r.b === b);

/** Adds heat between a client and another player, starting the rivalry if `start` (a flashpoint). */
function flare(world: World, a: string, b: string, heat: number, start: boolean, text: string): void {
  if (a === b || !world.players[a]?.client || !world.players[b]) return;
  let r = find(world, a, b);
  if (!r) {
    if (!start) return;
    const list = (world.rivalries ??= []);
    r = { a, b, names: { a: world.players[a]!.player.name, b: world.players[b]!.player.name }, heat: 0, aWins: 0, bWins: 0, since: world.season };
    list.push(r);
    if (list.length > MAX_RIVALRIES) {
      list.sort((x, y) => y.heat - x.heat);
      list.length = MAX_RIVALRIES;
    }
    world.news.unshift(`A rivalry is born: ${r.names.a} and ${r.names.b}, after ${text}.`);
  }
  const before = r.heat;
  r.heat = clamp(r.heat + heat, 0, 100);
  r.last = { season: world.season, week: world.week, text };
  if (before < HOT && r.heat >= HOT) world.news.unshift(`${r.names.a} v ${r.names.b} is becoming the tour's grudge match.`);
}

/** After an event: flashpoints, contention and the head-to-head for your clients. */
export function recordRivalries(world: World, event: TourEvent, result: TournamentResult): void {
  if (event.tier === "dev") return;
  const board = result.leaderboard;
  const mine = board.filter((row) => world.players[row.player.id]?.client);
  if (!mine.length) return;
  const name = event.name;
  for (const me of mine) {
    const a = me.player.id;
    // A playoff: everyone in it.
    if (result.playoff?.players.includes(a)) {
      for (const b of result.playoff.players) if (b !== a) flare(world, a, b, 30, true, `a playoff at ${name}`);
    }
    // A final-round duel: first and second, a shot or less apart.
    if (!result.bracket && me.madeCut && me.position <= 2) {
      for (const o of board.slice(0, 3)) {
        if (o.player.id === a || !o.madeCut || o.position > 2) continue;
        if (Math.abs(o.total - me.total) <= 1) flare(world, a, o.player.id, 20, true, `a Sunday duel at ${name}`);
      }
    }
    // In contention together: existing rivalries warm up.
    if (me.madeCut && me.position <= 5) {
      for (const o of board) if (o.player.id !== a && o.madeCut && o.position <= 5) flare(world, a, o.player.id, 5, false, `contending at ${name}`);
    }
    // The head-to-head, for rivalries that exist.
    for (const r of rivalriesOf(world, a)) {
      const o = board.find((row) => row.player.id === r.b);
      if (!o || !me.madeCut || !o.madeCut || o.position === me.position) continue;
      const won = me.position < o.position;
      if (won) r.aWins++;
      else r.bWins++;
      if (r.heat >= HOT) {
        const wp = world.players[a]!;
        if (won && wp.client) wp.client.followers = Math.round(followers(world, wp) * 1.01);
        world.news.unshift(won ? `${r.names.a} gets the better of ${r.names.b} at ${name} (${r.aWins}-${r.bWins}).` : `${r.names.b} beats ${r.names.a} again at ${name} (${r.bWins}-${r.aWins}).`);
      }
    }
  }
  // Match play: every knockout match against a client is a flashpoint.
  if (result.bracket) {
    const ko: MatchResult[] = result.bracket.knockout.flatMap((round) => round.matches);
    for (const m of ko) {
      if (m.b.length === 0) continue;
      const [x, y] = [m.a[0]!, m.b[0]!];
      if (world.players[x]?.client) flare(world, x, y, 15, true, `a knockout match at ${name}`);
      if (world.players[y]?.client) flare(world, y, x, 15, true, `a knockout match at ${name}`);
    }
  }
}

/** The Ryder Cup: a client's singles opponent. */
export function recordRyderRivalries(world: World, r: RyderCupResult): void {
  const singles = r.sessions.find((s) => s.format === "singles");
  for (const m of singles?.matches ?? []) {
    const [x, y] = [m.a[0]!, m.b[0]!];
    if (world.players[x]?.client) flare(world, x, y, 15, true, "Ryder Cup singles");
    if (world.players[y]?.client) flare(world, y, x, 15, true, "Ryder Cup singles");
  }
}

/** Heat fades a little every week; cold rivalries with little history drop away, as do ones you no longer manage. */
export function rivalryWeek(world: World): void {
  if (!world.rivalries) return;
  for (const r of world.rivalries) r.heat = Math.max(0, r.heat - WEEKLY_FADE);
  world.rivalries = world.rivalries.filter((r) => (r.heat > 0 || r.aWins + r.bWins >= 3) && world.players[r.a]?.client && world.players[r.b]);
}

/** How a hot rival in the field gets to him: strokes a round (+ helps). */
export function rivalryEdge(world: World, wp: WorldPlayer, field: Set<string>): number {
  const r = rivalriesOf(world, wp.player.id).find((x) => x.heat >= HOT && field.has(x.b));
  if (!r) return 0;
  const a = wp.player.attributes;
  const fragile = has(wp, "hothead") || has(wp, "tilt-merchant") || has(wp, "leaderboard-watcher");
  const competitor = a.ambition >= 14 || has(wp, "clutch-gene") || has(wp, "ice-water");
  const size = 0.15 * (r.heat / 100);
  return fragile ? -size : competitor ? size : size / 3;
}
