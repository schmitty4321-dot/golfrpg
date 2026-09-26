import {
  ALL_ATTRIBUTES,
  clamp,
  coursePar,
  courseDemands,
  createRng,
  generateCourse,
  simulateRound,
  drawWeather,
  type AttributeKey,
  type Course,
  type CourseDemands,
  type CourseStyle,
  type Grass,
  type Hole,
  type Player,
} from "../engine";
import { flatTourAverage } from "./editorFixtures";
import { newDevelopment } from "./development";
import type { TourStatus, World, WorldPlayer } from "./types";

const STYLES: CourseStyle[] = ["links", "parkland", "desert", "resort"];
const GRASSES: Grass[] = ["bentgrass", "bermuda", "poa"];
const STATUSES: TourStatus[] = ["exempt", "graduate", "conditional", "none", "amateur"];

// ---------------------------------------------------------------- courses

/** Everything wrong with a course, in plain words; empty means it's playable. */
export function validateCourse(c: Course): string[] {
  const errors: string[] = [];
  if (!c.name.trim()) errors.push("The course needs a name.");
  if (c.holes.length !== 18) errors.push("A course has 18 holes.");
  const par = coursePar(c);
  if (par < 68 || par > 73) errors.push(`Par ${par} is outside the tour's range (68-73).`);
  c.holes.forEach((h, i) => {
    const n = i + 1;
    if (![3, 4, 5].includes(h.par)) errors.push(`Hole ${n}: par must be 3, 4 or 5.`);
    const [lo, hi] = h.par === 3 ? [100, 260] : h.par === 4 ? [280, 530] : [480, 680];
    if (h.yards < lo || h.yards > hi) errors.push(`Hole ${n}: a par ${h.par} should be ${lo}-${hi} yards.`);
    if (h.par > 3 && (h.fairwayWidth < 15 || h.fairwayWidth > 60)) errors.push(`Hole ${n}: fairway width should be 15-60 yards.`);
    if (h.hazard < 0 || h.hazard > 1) errors.push(`Hole ${n}: hazard must be 0-1.`);
    if (h.exposure < 0 || h.exposure > 1) errors.push(`Hole ${n}: wind exposure must be 0-1.`);
    if (h.bunkers < 0 || h.bunkers > 8) errors.push(`Hole ${n}: 0-8 bunkers.`);
  });
  if (c.greenSpeed < 8 || c.greenSpeed > 15) errors.push("Green speed (stimp) should be 8-15.");
  for (const [k, v] of [["Rough", c.roughPenalty], ["Windiness", c.windiness], ["Firmness", c.firmness]] as const) {
    if (v < 0 || v > 1) errors.push(`${k} must be 0-1.`);
  }
  if (!STYLES.includes(c.style)) errors.push("Unknown course style.");
  if (!GRASSES.includes(c.grass)) errors.push("Unknown grass.");
  return errors;
}

/** Keeps numbers in sane shape (whole yards, renumbered holes) without judging them. */
export function tidyCourse(c: Course): Course {
  return {
    ...c,
    name: c.name.trim(),
    holes: c.holes.map((h, i): Hole => ({
      number: i + 1,
      par: h.par,
      yards: Math.round(h.yards),
      fairwayWidth: h.par === 3 ? 0 : Math.round(h.fairwayWidth),
      hazard: Math.round(h.hazard * 100) / 100,
      bunkers: Math.round(h.bunkers),
      exposure: Math.round(h.exposure * 100) / 100,
    })),
  };
}

export function saveCourse(world: World, course: Course): string[] {
  const c = tidyCourse(course);
  const errors = validateCourse(c);
  if (errors.length) return errors;
  const i = world.courses.findIndex((x) => x.id === c.id);
  if (i >= 0) world.courses[i] = c;
  else world.courses.push(c);
  world.edited = true;
  return [];
}

function freshCourseId(world: World, base: string): string {
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "course";
  let id = `custom-${slug}`;
  for (let n = 2; world.courses.some((c) => c.id === id); n++) id = `custom-${slug}-${n}`;
  return id;
}

/** A new course to start designing from: a generated layout of the chosen style. */
export function newCourse(world: World, style: CourseStyle, name = "New Course"): Course {
  const rng = createRng(Date.now() % 1e9);
  return { ...generateCourse(rng, freshCourseId(world, name), name, style) };
}

export function duplicateCourse(world: World, id: string): Course {
  const src = world.courses.find((c) => c.id === id);
  if (!src) throw new Error("unknown course");
  const name = `${src.name} (copy)`;
  return { ...structuredClone(src), id: freshCourseId(world, name), name };
}

/** Events currently played at a course. */
export const eventsAt = (world: World, courseId: string) => world.schedule.filter((e) => e.courseId === courseId);

export interface CourseReport {
  /** Average score to par for a tour-average player (12s everywhere). */
  scoringVsPar: number;
  /** What the course rewards, 1 = a typical tour venue. */
  demands: CourseDemands;
  yards: number;
  par: number;
}

/** How a course plays: a quick, repeatable simulation with tour-average players. */
export function courseReport(course: Course): CourseReport {
  const rng = createRng(12345);
  let total = 0;
  const rounds = 160;
  for (let i = 0; i < rounds; i++) {
    const player = flatTourAverage(`r${i}`);
    const weather = drawWeather(course, rng);
    total += simulateRound({ player, course, weather, wave: i % 2 ? "PM" : "AM", round: 1, shotsBehind: null, rng }).strokes;
  }
  const par = coursePar(course);
  return {
    scoringVsPar: Math.round((total / rounds - par) * 100) / 100,
    demands: courseDemands(course),
    yards: course.holes.reduce((s, h) => s + h.yards, 0),
    par,
  };
}

// ---------------------------------------------------------------- calendar

export function editEvent(world: World, eventId: string, patch: { name?: string; purse?: number; courseId?: string }): string[] {
  const e = world.schedule.find((x) => x.id === eventId);
  if (!e) return ["Unknown event."];
  const errors: string[] = [];
  if (patch.name !== undefined && !patch.name.trim()) errors.push("An event needs a name.");
  if (patch.purse !== undefined && (!Number.isFinite(patch.purse) || patch.purse < 100_000 || patch.purse > 100_000_000)) errors.push("Purse should be $100,000-$100,000,000.");
  if (patch.courseId !== undefined && !world.courses.some((c) => c.id === patch.courseId)) errors.push("Unknown venue.");
  if (errors.length) return errors;
  if (patch.name !== undefined) e.name = patch.name.trim();
  if (patch.purse !== undefined) e.purse = Math.round(patch.purse);
  if (patch.courseId !== undefined) e.courseId = patch.courseId;
  world.edited = true;
  return [];
}

// ---------------------------------------------------------------- players

export interface PlayerPatch {
  name?: string;
  nationality?: string;
  age?: number;
  peakAge?: number;
  status?: TourStatus;
  potential?: number;
  grassPreference?: Grass;
  styleComfort?: Partial<Record<CourseStyle, number>>;
  attributes?: Partial<Record<AttributeKey, number>>;
}

export function validatePlayerPatch(world: World, id: string | null, p: PlayerPatch): string[] {
  const errors: string[] = [];
  if (p.name !== undefined) {
    if (!p.name.trim()) errors.push("A player needs a name.");
    else if (Object.values(world.players).some((wp) => wp.player.name === p.name!.trim() && wp.player.id !== id)) errors.push("Another player already has that name.");
  }
  if (p.age !== undefined && (p.age < 14 || p.age > 60)) errors.push("Age should be 14-60.");
  if (p.peakAge !== undefined && (p.peakAge < 22 || p.peakAge > 40)) errors.push("Peak age should be 22-40.");
  if (p.potential !== undefined && (p.potential < 3 || p.potential > 20)) errors.push("Ceiling should be 3-20.");
  if (p.status !== undefined && !STATUSES.includes(p.status)) errors.push("Unknown status.");
  if (p.grassPreference !== undefined && !GRASSES.includes(p.grassPreference)) errors.push("Unknown grass.");
  for (const [k, v] of Object.entries(p.attributes ?? {})) {
    if (!ALL_ATTRIBUTES.includes(k as AttributeKey)) errors.push(`Unknown attribute ${k}.`);
    else if (!Number.isInteger(v) || v! < 1 || v! > 20) errors.push(`${k} must be a whole number 1-20.`);
  }
  for (const [k, v] of Object.entries(p.styleComfort ?? {})) {
    if (!STYLES.includes(k as CourseStyle) || !Number.isInteger(v) || v! < 1 || v! > 20) errors.push(`Comfort on ${k} courses must be 1-20.`);
  }
  if (p.status === "amateur" && id && world.players[id]?.career.results.length) errors.push("A player who has played as a pro can't become an amateur again.");
  return errors;
}

function applyPatch(wp: WorldPlayer, p: PlayerPatch): void {
  const pl = wp.player;
  if (p.name !== undefined) pl.name = p.name.trim();
  if (p.nationality !== undefined) pl.nationality = p.nationality.trim() || pl.nationality;
  if (p.age !== undefined) pl.age = Math.round(p.age);
  if (p.peakAge !== undefined) pl.peakAge = Math.round(p.peakAge);
  if (p.grassPreference !== undefined) pl.grassPreference = p.grassPreference;
  if (p.status !== undefined) wp.career.status = p.status;
  if (p.potential !== undefined) wp.development.potential = Math.round(p.potential * 10) / 10;
  for (const [k, v] of Object.entries(p.attributes ?? {})) pl.attributes[k as AttributeKey] = v!;
  for (const [k, v] of Object.entries(p.styleComfort ?? {})) pl.styleComfort[k as CourseStyle] = v!;
}

export function editPlayer(world: World, id: string, patch: PlayerPatch): string[] {
  const wp = world.players[id];
  if (!wp) return ["Unknown player."];
  const errors = validatePlayerPatch(world, id, patch);
  if (errors.length) return errors;
  applyPatch(wp, patch);
  if (wp.client) world.agency.knowledge[id] = { accuracy: 1, reports: 99, absWeek: 0 };
  world.edited = true;
  return [];
}

/** Adds a brand-new player to the world, a tour-average free agent unless told otherwise. */
export function createPlayer(world: World, patch: PlayerPatch & { name: string }): { id: string | null; errors: string[] } {
  const errors = validatePlayerPatch(world, null, patch);
  if (errors.length) return { id: null, errors };
  let n = 1;
  while (world.players[`custom${n}`]) n++;
  const id = `custom${n}`;
  const player = flatTourAverage(id);
  player.name = patch.name.trim();
  const wp: WorldPlayer = {
    player,
    career: {
      status: "none",
      exemptThrough: null,
      seasonPoints: 0,
      seasonEarnings: 0,
      seasonEvents: 0,
      seasonWins: 0,
      priorPointsRank: null,
      lastRegion: null,
      owgr: [],
      results: [],
      careerEarnings: 0,
      careerWins: 0,
      devPoints: 0,
      careerMajors: 0,
      careerEvents: 0,
      careerTop10s: 0,
      careerCuts: 0,
      pointsTitles: 0,
    },
    targetEvents: 26,
    development: newDevelopment(player, createRng(n)),
    injury: null,
    rebuild: null,
    agent: null,
  };
  applyPatch(wp, patch);
  wp.development.seasonStart = { ...player.attributes };
  world.players[id] = wp;
  world.edited = true;
  world.news.unshift(`${player.name} joins the tour.`);
  return { id, errors: [] };
}

// ---------------------------------------------------------------- sharing

export const PLAYER_DB_FORMAT = "fairway-manager-players";
export const COURSE_DB_FORMAT = "fairway-manager-courses";

/** A player as he appears in a shareable database file (no career, just the golfer). */
export interface DatabasePlayer {
  name: string;
  nationality: string;
  age: number;
  peakAge: number;
  status?: TourStatus;
  potential?: number;
  grassPreference: Grass;
  styleComfort: Record<CourseStyle, number>;
  attributes: Record<AttributeKey, number>;
}

export interface PlayerDatabase {
  format: typeof PLAYER_DB_FORMAT;
  version: 1;
  players: DatabasePlayer[];
}

export function exportPlayers(world: World): string {
  const db: PlayerDatabase = {
    format: PLAYER_DB_FORMAT,
    version: 1,
    players: Object.values(world.players).map((wp) => ({
      name: wp.player.name,
      nationality: wp.player.nationality,
      age: wp.player.age,
      peakAge: wp.player.peakAge,
      status: wp.career.status,
      potential: wp.development.potential,
      grassPreference: wp.player.grassPreference,
      styleComfort: { ...wp.player.styleComfort },
      attributes: { ...wp.player.attributes },
    })),
  };
  return JSON.stringify(db, null, 1);
}

/**
 * Reads a player database file. Missing attributes default to a tour
 * average (12) so hand-made files can be short; anything invalid is
 * reported per player and that player skipped.
 */
export function parsePlayerDatabase(json: string): { players: DatabasePlayer[]; errors: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { players: [], errors: ["That file isn't valid JSON."] };
  }
  const db = raw as Partial<PlayerDatabase>;
  if (db.format !== PLAYER_DB_FORMAT || !Array.isArray(db.players)) return { players: [], errors: ["That isn't a Fairway Manager player database."] };
  const players: DatabasePlayer[] = [];
  const errors: string[] = [];
  const names = new Set<string>();
  db.players.forEach((p, i) => {
    const label = `Player ${i + 1}${p?.name ? ` (${p.name})` : ""}`;
    if (!p || typeof p.name !== "string" || !p.name.trim()) return void errors.push(`${label}: missing name.`);
    if (names.has(p.name.trim())) return void errors.push(`${label}: duplicate name.`);
    const attributes = Object.fromEntries(ALL_ATTRIBUTES.map((k) => [k, clamp(Math.round(Number(p.attributes?.[k] ?? 12)) || 12, 1, 20)])) as Record<AttributeKey, number>;
    const age = clamp(Math.round(Number(p.age) || 28), 14, 60);
    names.add(p.name.trim());
    players.push({
      name: p.name.trim(),
      nationality: typeof p.nationality === "string" && p.nationality.trim() ? p.nationality.trim() : "USA",
      age,
      peakAge: clamp(Math.round(Number(p.peakAge) || 31), 22, 40),
      status: STATUSES.includes(p.status as TourStatus) ? p.status : undefined,
      potential: typeof p.potential === "number" ? clamp(p.potential, 3, 20) : undefined,
      grassPreference: GRASSES.includes(p.grassPreference as Grass) ? p.grassPreference! : "bentgrass",
      styleComfort: Object.fromEntries(STYLES.map((s) => [s, clamp(Math.round(Number(p.styleComfort?.[s] ?? 12)) || 12, 1, 20)])) as Record<CourseStyle, number>,
      attributes,
    });
  });
  if (players.length === 0 && errors.length === 0) errors.push("The database has no players.");
  return { players, errors };
}

/** Turns a database entry into an engine player. */
export function databasePlayer(p: DatabasePlayer, id: string): Player {
  return {
    id,
    name: p.name,
    nationality: p.nationality,
    age: p.age,
    attributes: { ...p.attributes },
    grassPreference: p.grassPreference,
    styleComfort: { ...p.styleComfort },
    peakAge: p.peakAge,
    form: 0,
    condition: 92,
  };
}

export interface CourseDatabase {
  format: typeof COURSE_DB_FORMAT;
  version: 1;
  courses: Course[];
}

export function exportCourses(world: World, ids?: string[]): string {
  const courses = world.courses.filter((c) => !ids || ids.includes(c.id));
  return JSON.stringify({ format: COURSE_DB_FORMAT, version: 1, courses } satisfies CourseDatabase, null, 1);
}

/** Adds the valid courses from a file to the world (renamed ids if they clash). */
export function importCourses(world: World, json: string): { added: string[]; errors: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { added: [], errors: ["That file isn't valid JSON."] };
  }
  const db = raw as Partial<CourseDatabase>;
  if (db.format !== COURSE_DB_FORMAT || !Array.isArray(db.courses)) return { added: [], errors: ["That isn't a Fairway Manager course file."] };
  const added: string[] = [];
  const errors: string[] = [];
  for (const c of db.courses) {
    const course = tidyCourse({ ...c, id: freshCourseId(world, c.name ?? "imported") } as Course);
    const problems = validateCourse(course);
    if (problems.length) errors.push(`${c.name ?? "A course"}: ${problems[0]}`);
    else {
      world.courses.push(course);
      added.push(course.name);
    }
  }
  if (added.length) world.edited = true;
  return { added, errors };
}
