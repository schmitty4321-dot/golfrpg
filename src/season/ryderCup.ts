/**
 * The Ryder Cup: the United States against Europe every other year (odd
 * years; season 1 is 2026, so the first is season 2's, in 2027), in the week
 * after the TOUR Championship.
 *
 * Rules as played today (rydercup.com): twelve a side, six automatic
 * qualifiers from each team's points list and six captain's picks. Friday
 * and Saturday: four foursomes in the morning and four four-balls in the
 * afternoon; Sunday: twelve singles. A win is a point, a halved match half a
 * point each, and matches end once decided, never going past 18. 28 points:
 * 14½ wins the Cup, and the holder keeps it on 14-14. Europe hold it at the
 * start (they won at Bethpage in 2025).
 *
 * Points lists:
 * - United States: the 2027 system (rydercup.com, "2027 U.S. Ryder Cup
 *   Points System"): fixed points by finishing place and event type, from
 *   the season's first event through the BMW Championship, in the Ryder Cup
 *   year only. Opposite-field events earn nothing; a missed cut earns
 *   10/10/8/5, and places outside the top 70 nothing.
 * - Europe: points per event as the 2025 and 2027 systems set them (majors
 *   5,000; THE PLAYERS, signature events and playoffs 3,000; full-field PGA
 *   TOUR events 2,000; opposite-field events 1,000), from the end of the
 *   previous season's TOUR Championship through the BMW Championship. Europe
 *   doesn't publish a place-by-place table in the same form, so its places
 *   follow the US full-field table's shape, scaled to each event's value.
 */
import { clamp, createRng, getCourse, playMatch, type Course, type MatchFormat, type MatchResult, type Player } from "../engine";
import { addReputation } from "./agency";
import { overall } from "./development";
import { mixSeed } from "./entries";
import { rankMap } from "./points";
import { updateFollowers } from "./showcase";
import type { EventRecord, World, WorldPlayer } from "./types";

export type Team = "USA" | "Europe";
export const TEAMS: Team[] = ["USA", "Europe"];

/** The calendar year of a season (season 1 = 2026). */
export const yearOf = (season: number): number => 2025 + season;
// The silent warm-up season (0, 2025) keeps the real result: Europe won at Bethpage.
export const isRyderCupSeason = (season: number): boolean => season >= 1 && yearOf(season) % 2 === 1;
/** The Ryder Cup the points lists are building towards: this season's, or next season's. */
export const nextRyderCupSeason = (season: number): number => (isRyderCupSeason(season) ? season : season + 1);

/** The US 2027 points by place, 1-70: majors, THE PLAYERS, signature and playoff events, full-field events. */
const US_TABLE: [number, number, number, number][] = [
  [3000, 2850, 2250, 1500], [1818, 1734, 1362, 909], [1149, 1092, 864, 576], [816, 774, 612, 408], [684, 651, 513, 342],
  [603, 573, 453, 303], [564, 537, 423, 282], [522, 495, 390, 261], [489, 465, 366, 243], [453, 429, 342, 228],
  [420, 399, 315, 210], [387, 369, 291, 195], [354, 336, 267, 177], [321, 306, 240, 159], [303, 288, 228, 153],
  [288, 273, 216, 144], [270, 258, 204, 135], [255, 243, 192, 126], [237, 225, 177, 120], [222, 210, 165, 111],
  [204, 195, 153, 102], [189, 180, 141, 93], [174, 165, 132, 87], [162, 153, 120, 81], [147, 141, 111, 75],
  [135, 129, 102, 70], [129, 123, 96, 66], [123, 117, 93, 63], [120, 114, 90, 60], [114, 108, 87, 57],
  [108, 102, 81, 55], [105, 99, 78, 53], [99, 93, 75, 51], [96, 90, 72, 48], [90, 87, 69, 45],
  [87, 84, 66, 43], [84, 81, 63, 41], [78, 75, 60, 39], [75, 72, 57, 38], [72, 69, 54, 37],
  [69, 66, 51, 36], [66, 63, 48, 35], [63, 60, 45, 34], [60, 57, 42, 33], [57, 54, 40, 31],
  [54, 51, 38, 30], [51, 45, 36, 29], [48, 43, 34, 28], [45, 41, 32, 27], [42, 39, 30, 26],
  [40, 37, 29, 25], [38, 35, 28, 24], [36, 33, 27, 23], [34, 31, 26, 22], [32, 30, 25, 21],
  [30, 29, 24, 20], [28, 28, 23, 19], [26, 26, 22, 18], [24, 24, 21, 17], [22, 22, 20, 16],
  [21, 21, 19, 15], [20, 20, 18, 14], [19, 19, 17, 13], [18, 18, 16, 12], [17, 17, 15, 11],
  [16, 16, 13, 10], [15, 15, 12, 9], [14, 14, 11, 8], [13, 13, 10, 7], [12, 12, 9, 6],
];
const US_MISSED_CUT = [10, 10, 8, 5];
/** Europe's points for the winner of each kind of event. */
const EU_EVENT_VALUE = [5000, 3000, 3000, 2000];
const EU_OPPOSITE_VALUE = 1000;

/** 0 majors, 1 THE PLAYERS, 2 signature and playoffs, 3 full-field. */
type Kind = 0 | 1 | 2 | 3 | "opposite";

/** Which column an event uses, or null when it earns nothing (the TOUR Championship, the developmental tour). */
function kindOf(e: Pick<EventRecord, "tier" | "eventName">): Kind | null {
  if (e.tier === "major") return 0;
  if (/players championship/i.test(e.eventName)) return 1;
  if (e.tier === "signature" || e.tier === "playoff") return 2;
  if (e.tier === "standard") return 3;
  if (e.tier === "opposite") return "opposite";
  return null;
}

/** Points for a place, shared evenly over the places a tie covers. */
function byPlace(column: (place: number) => number, position: number, tied: number): number {
  let t = 0;
  for (let p = position; p < position + tied; p++) t += p <= 70 ? column(p) : 0;
  return t / tied;
}

/** Ryder Cup points for one result on a team's list. `tied`: how many shared the place. */
export function ryderPoints(team: Team, r: Pick<EventRecord, "tier" | "eventName" | "position" | "madeCut">, tied = 1): number {
  const kind = kindOf(r);
  if (kind === null) return 0;
  if (team === "USA") {
    if (kind === "opposite") return 0;
    if (!r.madeCut) return US_MISSED_CUT[kind]!;
    return byPlace((p) => US_TABLE[p - 1]![kind], r.position, tied);
  }
  const value = kind === "opposite" ? EU_OPPOSITE_VALUE : EU_EVENT_VALUE[kind]!;
  if (!r.madeCut) return Math.round(value * (5 / 1500));
  return byPlace((p) => US_TABLE[p - 1]![3] / 1500, r.position, tied) * value;
}

/** The countries in the game that play for Europe. */
export const EUROPE = new Set(["England", "Scotland", "Ireland", "Northern Ireland", "Wales", "Sweden", "Denmark", "Norway", "Finland", "Germany", "Austria", "Belgium", "France", "Spain", "Italy", "Netherlands", "Switzerland", "Poland", "Portugal"]);
export const teamOf = (wp: WorldPlayer): Team | null => (wp.player.nationality === "USA" ? "USA" : EUROPE.has(wp.player.nationality) ? "Europe" : null);

/** The week of the BMW Championship (the last qualifying event), or the last playoff week. */
export function bmwWeek(world: Pick<World, "schedule">): number {
  const bmw = world.schedule.find((e) => /BMW Championship/i.test(e.name));
  return bmw?.week ?? Math.max(0, ...world.schedule.filter((e) => e.tier === "playoff").map((e) => e.week));
}
/** The Ryder Cup is played the week after the TOUR Championship. */
export function ryderCupWeek(world: Pick<World, "schedule">): number {
  const finale = Math.max(0, ...world.schedule.filter((e) => e.tier === "finale").map((e) => e.week));
  return (finale || bmwWeek(world)) + 1;
}

/** Whether a result counts towards a team's list for the Ryder Cup in `cupSeason`. */
function inWindow(world: World, team: Team, cupSeason: number, r: EventRecord): boolean {
  if (r.season === cupSeason) return r.week <= bmwWeek(world);
  // Europe's list opens after the previous season's TOUR Championship.
  return team === "Europe" && r.season === cupSeason - 1 && r.week >= ryderCupWeek(world);
}

export interface StandingRow {
  id: string;
  name: string;
  points: number;
  events: number;
  /** World ranking now. */
  rank: number | null;
}

/** A team's points list for the coming (or current) Ryder Cup, best first. */
export function ryderStandings(world: World, team: Team, cupSeason = nextRyderCupSeason(world.season)): StandingRow[] {
  const ranks = rankMap(world);
  // How many shared each place at each event, to split the points.
  const ties = new Map<string, number>();
  for (const wp of Object.values(world.players)) {
    for (const r of wp.career.results) {
      if (r.season < cupSeason - 1 || !r.madeCut) continue;
      const k = `${r.season}:${r.eventId}:${r.position}`;
      ties.set(k, (ties.get(k) ?? 0) + 1);
    }
  }
  const rows: StandingRow[] = [];
  for (const wp of Object.values(world.players)) {
    if (teamOf(wp) !== team || wp.career.status === "amateur") continue;
    let points = 0;
    let events = 0;
    for (const r of wp.career.results) {
      if (!inWindow(world, team, cupSeason, r)) continue;
      const p = ryderPoints(team, r, r.madeCut ? (ties.get(`${r.season}:${r.eventId}:${r.position}`) ?? 1) : 1);
      if (p > 0) events++;
      points += p;
    }
    if (points > 0) rows.push({ id: wp.player.id, name: wp.player.name, points: Math.round(points * 10) / 10, events, rank: ranks.get(wp.player.id) ?? null });
  }
  return rows.sort((a, b) => b.points - a.points || (a.rank ?? 9999) - (b.rank ?? 9999));
}

/** Strokes a round the home side plays better. */
export const HOME_EDGE = 0.4;

export const AUTOMATIC = 6;
export const TEAM_SIZE = 12;

export interface TeamSheet {
  automatic: string[];
  picks: string[];
}

/** The twelve: the top six on the points list who are fit, then the captain's six picks, by world ranking. */
export function selectTeam(world: World, team: Team): TeamSheet {
  const fit = (id: string) => !!world.players[id] && !world.players[id]!.injury;
  const automatic = ryderStandings(world, team, nextRyderCupSeason(world.season)).map((r) => r.id).filter(fit).slice(0, AUTOMATIC);
  const ranks = rankMap(world);
  const pool = Object.values(world.players)
    .filter((wp) => teamOf(wp) === team && wp.career.status !== "amateur" && !wp.injury && !automatic.includes(wp.player.id))
    .sort((a, b) => (ranks.get(a.player.id) ?? 9999) - (ranks.get(b.player.id) ?? 9999) || overall(b.player) - overall(a.player) || a.player.id.localeCompare(b.player.id));
  return { automatic, picks: pool.slice(0, TEAM_SIZE - automatic.length).map((wp) => wp.player.id) };
}

export interface RyderSession {
  name: string;
  format: MatchFormat;
  /** Side `a` is the USA, side `b` Europe. */
  matches: MatchResult[];
}

export interface RyderCupResult {
  season: number;
  year: number;
  host: Team;
  venue: string;
  courseId: string;
  teams: Record<Team, TeamSheet>;
  /** Names at the time, so the history survives retirements. */
  names: Record<string, string>;
  sessions: RyderSession[];
  score: Record<Team, number>;
  /** Who holds the Cup afterwards. */
  winner: Team;
  /** True when the holder kept it on 14-14. */
  retained: boolean;
}

export interface RyderCupState {
  holder: Team;
  history: RyderCupResult[];
}

export function ensureRyderCup(world: World): RyderCupState {
  world.ryderCup ??= { holder: "Europe", history: [] };
  return world.ryderCup;
}

/** Hosts alternate: Europe in 2027 (Adare Manor), the USA in 2029, and so on. */
export const hostOf = (season: number): Team => (((yearOf(season) - 2027) / 2) % 2 === 0 ? "Europe" : "USA");

/** The venue: a championship course in the host's part of the world that the game has (the real venues aren't in it). */
export function venueFor(world: World, season: number): Course {
  const host = hostOf(season);
  const prefer = host === "Europe" ? ["royal-birkdale", "renaissance-club"] : ["bellerive", "shinnecock-hills", "aronimink", "quail-hollow"];
  const turn = Math.max(0, Math.floor((yearOf(season) - 2027) / 4));
  for (let i = 0; i < prefer.length; i++) {
    const id = prefer[(turn + i) % prefer.length]!;
    const have = world.courses.find((x) => x.id === id);
    if (have) return have;
    try {
      return getCourse(id);
    } catch {
      // not in this game
    }
  }
  return world.courses[0]!;
}

/** Everyone playing in this week's Ryder Cup (they skip the week's other events). */
export function ryderCupPlayers(world: World): Set<string> {
  if (!isRyderCupSeason(world.season) || world.week !== ryderCupWeek(world)) return new Set();
  if (ensureRyderCup(world).history.some((r) => r.season === world.season)) return new Set();
  const out = new Set<string>();
  for (const team of TEAMS) {
    const t = selectTeam(world, team);
    for (const id of [...t.automatic, ...t.picks]) out.add(id);
  }
  return out;
}

/**
 * The captain's line-up for a team session: the eight in best form, resting
 * those who have played most from Friday afternoon on, strongest paired together.
 */
function lineup(world: World, ids: string[], played: Map<string, number>, session: number): string[][] {
  const fresh = (id: string) => overall(world.players[id]!.player) + world.players[id]!.player.form * 0.5 - (played.get(id) ?? 0) * (session >= 1 ? 0.35 : 0);
  const eight = [...ids].sort((a, b) => fresh(b) - fresh(a) || a.localeCompare(b)).slice(0, 8);
  return [0, 2, 4, 6].map((i) => [eight[i]!, eight[i + 1]!]);
}

/** Plays the Ryder Cup: five sessions, Friday to Sunday. */
export function playRyderCup(world: World): RyderCupResult {
  const state = ensureRyderCup(world);
  const rng = createRng(mixSeed(world.seed, world.season, 1701));
  const course = venueFor(world, world.season);
  const teams: Record<Team, TeamSheet> = { USA: selectTeam(world, "USA"), Europe: selectTeam(world, "Europe") };
  const ids = { USA: [...teams.USA.automatic, ...teams.USA.picks], Europe: [...teams.Europe.automatic, ...teams.Europe.picks] };
  const player = (id: string): Player => world.players[id]!.player;
  // The home crowd (and the home captain's course set-up) is worth something: the home side won 9 of the 12 from 2002 to 2025.
  const home = hostOf(world.season);
  const weekForm = new Map([...ids.USA, ...ids.Europe].map((id) => [id, rng.normal(0, 0.4) + (ids[home].includes(id) ? HOME_EDGE : 0)]));
  const played = new Map<string, number>();
  const shuffle = <T,>(xs: T[]): T[] => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  };
  const plan: { name: string; format: MatchFormat; day: number }[] = [
    { name: "Friday foursomes", format: "foursomes", day: 1 },
    { name: "Friday four-balls", format: "fourball", day: 1 },
    { name: "Saturday foursomes", format: "foursomes", day: 2 },
    { name: "Saturday four-balls", format: "fourball", day: 2 },
    { name: "Sunday singles", format: "singles", day: 3 },
  ];
  const sessions: RyderSession[] = plan.map((s, n) => {
    // Singles: everyone plays, in an order each captain sets blind. Team sessions: four pairs each.
    const us = s.format === "singles" ? shuffle(ids.USA).map((x) => [x]) : lineup(world, ids.USA, played, n);
    const eu = s.format === "singles" ? shuffle(ids.Europe).map((x) => [x]) : shuffle(lineup(world, ids.Europe, played, n));
    const matches = us.map((side, i) =>
      playMatch({ course, a: side.map(player), b: eu[i]!.map(player), format: s.format, rng, weekForm, day: s.day + 1, tier: "major" }),
    );
    for (const m of matches) for (const id of [...m.a, ...m.b]) played.set(id, (played.get(id) ?? 0) + 1);
    return { name: s.name, format: s.format, matches };
  });
  const score: Record<Team, number> = { USA: 0, Europe: 0 };
  for (const s of sessions) {
    for (const m of s.matches) {
      if (m.winner === "a") score.USA += 1;
      else if (m.winner === "b") score.Europe += 1;
      else {
        score.USA += 0.5;
        score.Europe += 0.5;
      }
    }
  }
  const retained = score.USA === score.Europe;
  const winner: Team = retained ? state.holder : score.USA > score.Europe ? "USA" : "Europe";
  const names = Object.fromEntries([...ids.USA, ...ids.Europe].map((id) => [id, world.players[id]!.player.name]));
  const result: RyderCupResult = { season: world.season, year: yearOf(world.season), host: hostOf(world.season), venue: course.name, courseId: course.id, teams, names, sessions, score, winner, retained };
  state.holder = winner;
  state.history.push(result);
  return result;
}

/** A player's record in one Ryder Cup: won, lost, halved. */
export function playerRecord(r: RyderCupResult, id: string): { w: number; l: number; h: number } {
  const rec = { w: 0, l: 0, h: 0 };
  for (const s of r.sessions) {
    for (const m of s.matches) {
      const side = m.a.includes(id) ? "a" : m.b.includes(id) ? "b" : null;
      if (!side) continue;
      if (m.winner === null) rec.h++;
      else if (m.winner === side) rec.w++;
      else rec.l++;
    }
  }
  return rec;
}

export const halfPoints = (x: number): string => (x === 0.5 ? "½" : `${Math.floor(x)}${x % 1 ? "½" : ""}`);
export const scoreLine = (r: RyderCupResult): string => `USA ${halfPoints(r.score.USA)} – ${halfPoints(r.score.Europe)} Europe`;

/**
 * The Ryder Cup week, after the week's other events: play it, and let it
 * count for the players (tiring, a lift for the winners) and for your agency
 * (a client on the team is good for your name and his following).
 */
export function ryderCupWeekEnd(world: World): RyderCupResult | null {
  if (!isRyderCupSeason(world.season) || world.week !== ryderCupWeek(world)) return null;
  if (ensureRyderCup(world).history.some((r) => r.season === world.season)) return null;
  const r = playRyderCup(world);
  const winners = new Set([...r.teams[r.winner].automatic, ...r.teams[r.winner].picks]);
  for (const team of TEAMS) {
    for (const id of [...r.teams[team].automatic, ...r.teams[team].picks]) {
      const wp = world.players[id];
      if (!wp) continue;
      const rec = playerRecord(r, id);
      wp.player.condition = clamp(wp.player.condition - 10, 0, 100);
      wp.player.form = clamp(wp.player.form + (winners.has(id) ? 0.15 : -0.05) + (rec.w - rec.l) * 0.03, -1, 1);
      if (wp.client) {
        addReputation(world.agency, 3 + (winners.has(id) ? 2 : 0));
        updateFollowers(world, wp, { position: winners.has(id) ? 1 : 10, madeCut: true }, 0);
        wp.client.happiness = clamp(wp.client.happiness + 6, 0, 100);
        world.news.unshift(`${wp.player.name} goes ${rec.w}-${rec.l}-${rec.h} for ${team === "USA" ? "the USA" : "Europe"} at the Ryder Cup.`);
      }
    }
  }
  const side = r.winner === "USA" ? "The USA" : "Europe";
  world.news.unshift(`${side} ${r.retained ? "retain" : "win"} the Ryder Cup, ${scoreLine(r)}, at ${r.venue}.`);
  return r;
}
