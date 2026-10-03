import { REAL_COURSE_REGION, createRng, generateCourse, getCourse, isRealCourse, type Course, type CourseStyle } from "../engine";
import type { EventTier, Region, TourEvent } from "./types";

/**
 * The 2026 PGA TOUR season (pgatour.com/schedule), one row per event:
 * [week, tier, courseId, name, purse, fieldSize, cutTop]. Weeks run in
 * order with the tour's off weeks closed up. Team events (the Zurich Classic)
 * are played as individual stroke play, and the Presidents Cup and the
 * unofficial December events are left out.
 *
 * One addition the 2026 tour doesn't have: a Match Play Championship in the
 * old WGC format (2015-2023: top 64 in the world, groups then a knockout),
 * in Austin in late March, sharing the week with the Houston Open as the 2023
 * Match Play shared its week with an opposite-field event. It sits at the end
 * of the list so the real events keep their ids.
 */
type Slot = [number, EventTier, string, string, number, number, number | null, "matchplay"?];

const SCHEDULE: Slot[] = [
  [1, "standard", "waialae", "Sony Open in Hawaii", 9_100_000, 144, 65],
  [2, "standard", "pga-west-stadium", "The American Express", 9_200_000, 156, 65],
  [3, "standard", "torrey-pines-south", "Farmers Insurance Open", 9_600_000, 156, 65],
  [4, "standard", "tpc-scottsdale", "WM Phoenix Open", 9_600_000, 132, 65],
  [5, "signature", "pebble-beach", "AT&T Pebble Beach Pro-Am", 20_000_000, 80, null],
  [6, "signature", "riviera", "The Genesis Invitational", 20_000_000, 72, 50],
  [7, "standard", "pga-national-champion", "Cognizant Classic in The Palm Beaches", 9_600_000, 144, 65],
  [8, "signature", "bay-hill", "Arnold Palmer Invitational", 20_000_000, 72, 50],
  [8, "opposite", "grand-reserve", "Puerto Rico Open", 4_000_000, 132, 65],
  [9, "standard", "tpc-sawgrass", "THE PLAYERS Championship", 25_000_000, 144, 65],
  [10, "standard", "innisbrook-copperhead", "Valspar Championship", 9_100_000, 144, 65],
  [11, "standard", "memorial-park", "Texas Children's Houston Open", 9_900_000, 132, 65],
  [12, "standard", "tpc-san-antonio-oaks", "Valero Texas Open", 9_800_000, 144, 65],
  [13, "major", "augusta-national", "Masters Tournament", 22_500_000, 90, 50],
  [14, "signature", "harbour-town", "RBC Heritage", 20_000_000, 72, null],
  [15, "standard", "tpc-louisiana", "Zurich Classic of New Orleans", 9_500_000, 144, 65],
  [16, "signature", "doral-blue-monster", "Cadillac Championship", 20_000_000, 72, null],
  [17, "signature", "quail-hollow", "Truist Championship", 20_000_000, 72, null],
  [17, "opposite", "dunes-club", "ONEflight Myrtle Beach Classic", 4_000_000, 132, 65],
  [18, "major", "aronimink", "PGA Championship", 20_500_000, 156, 70],
  [19, "standard", "tpc-craig-ranch", "THE CJ CUP Byron Nelson", 10_300_000, 156, 65],
  [20, "standard", "colonial", "Charles Schwab Challenge", 9_900_000, 132, 65],
  [21, "signature", "muirfield-village", "The Memorial Tournament", 20_000_000, 72, 50],
  [22, "standard", "osprey-valley-north", "RBC Canadian Open", 9_800_000, 156, 65],
  [23, "major", "shinnecock-hills", "U.S. Open", 22_500_000, 156, 60],
  [24, "signature", "tpc-river-highlands", "Travelers Championship", 20_000_000, 72, null],
  [25, "standard", "tpc-deere-run", "John Deere Classic", 8_800_000, 156, 65],
  [26, "standard", "renaissance-club", "Genesis Scottish Open", 9_000_000, 156, 65],
  [26, "opposite", "hurstbourne", "ISCO Championship", 4_000_000, 132, 65],
  [27, "major", "royal-birkdale", "The Open Championship", 17_750_000, 156, 70],
  [27, "opposite", "corales", "Corales Puntacana Championship", 4_000_000, 132, 65],
  [28, "standard", "tpc-twin-cities", "3M Open", 8_800_000, 156, 65],
  [29, "standard", "detroit-golf-club", "Rocket Classic", 10_000_000, 156, 65],
  [30, "standard", "sedgefield", "Wyndham Championship", 8_500_000, 156, 65],
  [31, "playoff", "tpc-southwind", "FedEx St. Jude Championship", 20_000_000, 70, null],
  [32, "playoff", "bellerive", "BMW Championship", 20_000_000, 50, null],
  [33, "finale", "east-lake", "TOUR Championship", 40_000_000, 30, null],
  [34, "standard", "walnut-cove", "Biltmore Championship Asheville", 5_000_000, 132, 65],
  [35, "standard", "black-desert", "Bank of Utah Championship", 6_000_000, 132, 65],
  [36, "standard", "yokohama", "Baycurrent Classic", 8_000_000, 78, null],
  [37, "standard", "port-royal", "Butterfield Bermuda Championship", 6_000_000, 132, 65],
  [38, "standard", "vidanta-vallarta", "VidantaWorld Mexico Open", 6_000_000, 132, 65],
  [39, "standard", "el-cardonal", "World Wide Technology Championship", 6_000_000, 132, 65],
  [40, "standard", "barton-creek-fazio-canyons", "Austin Championship", 6_000_000, 132, 65],
  [41, "standard", "sea-island-seaside", "The RSM Classic", 7_400_000, 156, 65],
  [11, "signature", "barton-creek-fazio-canyons", "Match Play Championship", 20_000_000, 64, null, "matchplay"],
];

/** The Match Play Championship as a tour event (older careers get it added at a season's end). */
export function matchPlayEvent(): TourEvent {
  const i = SCHEDULE.findIndex((s) => s[7] === "matchplay");
  const [week, tier, courseId, name, purse, fieldSize, cutTop] = SCHEDULE[i]!;
  return { id: `r${String(i + 1).padStart(2, "0")}`, name, week, tier, courseId, purse, fieldSize, cutTop, region: REGIONS[REAL_COURSE_REGION[courseId] ?? "NA"] ?? "NA", format: "matchplay" };
}

/**
 * What a real-tour event (id "r01" onwards) was called and where it was played
 * when the schedule was built, so it keeps its identity after the editor
 * renames it or moves it.
 */
export function realEventOrigin(id: string): { name: string; courseId: string } | undefined {
  const m = /^r(\d+)$/.exec(id);
  const slot = m ? SCHEDULE[Number(m[1]) - 1] : undefined;
  return slot ? { name: slot[3], courseId: slot[2] } : undefined;
}

/** Weeks in a new season (the real tour's). Saved careers keep their own calendar: use seasonWeeks(world). */
export const SEASON_WEEKS = Math.max(...SCHEDULE.map((s) => s[0]));

/** The last week of a world's season. */
export const seasonWeeks = (world: { schedule: TourEvent[] }): number => Math.max(...world.schedule.map((e) => e.week));

/** Card positions are decided on the points list after this week: the last event that isn't the finale or a playoff. */
export const lastRegularWeek = (world: { schedule: TourEvent[] }): number =>
  Math.max(...world.schedule.filter((e) => e.tier !== "finale" && e.tier !== "playoff").map((e) => e.week));

/** The week of the season's finale (null when a calendar has none). */
export const finaleWeek = (world: { schedule: TourEvent[] }): number | null =>
  world.schedule.find((e) => e.tier === "finale")?.week ?? null;

/**
 * Majors are set up harder than the same course's regular event: faster
 * greens, deeper rough, firmer turf. Real venues already play to their
 * real (major) scoring, so they're left as they are.
 */
export function majorSetup(course: Course): Course {
  if (isRealCourse(course)) return course;
  return {
    ...course,
    greenSpeed: course.greenSpeed + 1,
    roughPenalty: Math.min(1, course.roughPenalty + 0.2),
    firmness: Math.min(1, course.firmness + 0.1),
    holes: course.holes.map((h) => ({ ...h, fairwayWidth: h.par === 3 ? 0 : h.fairwayWidth - 3, yards: h.yards + 10 })),
  };
}
const DEV_SUFFIX = ["Open", "Classic", "Championship", "Challenge"];
const DEV_PURSE: [number, number] = [1_000_000, 1_300_000];
const DEV_FIELD: [number, number] = [144, 65];

const REGIONS: Record<string, Region> = { NA: "NA", EU: "EU", ASIA: "ASIA", AUS: "AUS" };

/**
 * Builds the tour: the real 2026 season on its real venues, plus the
 * developmental tour. Calendars repeat each season, as the real tour's
 * mostly do.
 */
export function buildTour(seed: number): { courses: Course[]; schedule: TourEvent[] } {
  const courses: Course[] = [];
  const schedule: TourEvent[] = SCHEDULE.map(([week, tier, courseId, name, purse, fieldSize, cutTop, format], i) => {
    const course = getCourse(courseId);
    if (!courses.some((c) => c.id === course.id)) courses.push(course);
    return {
      id: `r${String(i + 1).padStart(2, "0")}`,
      name,
      week,
      tier,
      courseId,
      purse,
      fieldSize,
      cutTop,
      region: REGIONS[REAL_COURSE_REGION[courseId] ?? "NA"] ?? "NA",
      ...(courseId === "tpc-sawgrass" ? { winnerPoints: 750 } : {}),
      ...(format ? { format } : {}),
    };
  });
  const dev = buildDevTour(seed);
  return { courses: [...courses, ...dev.courses], schedule: [...schedule, ...dev.schedule] };
}

/** Weeks the developmental tour first played (their events keep their ids, venues and purses). */
export const DEV_WEEKS = [3, 4, 5, 6, 8, 9, 10, 11, 12, 14, 15, 16, 17, 19, 20, 21, 22, 24, 25, 26, 28, 29, 30, 34, 35, 36];
/** Weeks added later, so the developmental tour plays nearly every week the main tour does (the last is the Finals' championship). */
export const DEV_WEEKS_ADDED = [1, 2, 7, 13, 18, 23, 27, 31, 32, 33, 37];
/** The Finals: four events to close the developmental season, by week, with their field sizes. */
export const DEV_FINALS: Record<number, { stage: 1 | 2 | 3 | 4; fieldSize: number; cutTop: number | null; name: string }> = {
  34: { stage: 1, fieldSize: 156, cutTop: 65, name: "Finals Opener" },
  35: { stage: 2, fieldSize: 144, cutTop: 65, name: "Finals Classic" },
  36: { stage: 3, fieldSize: 100, cutTop: null, name: "Finals Invitational" },
  37: { stage: 4, fieldSize: 60, cutTop: null, name: "Developmental Tour Championship" },
};
const DEV_FINALS_PURSE = 1_500_000;
/** Season points to the winner of a Finals event (500 in the regular season). */
export const DEV_FINALS_POINTS = 600;
/** Three developmental tour wins in a season earn a main-tour card on the spot. */
export const DEV_PROMOTION_WINS = 3;
/** The next block on the developmental points list keep full status there for the next season. */
export const DEV_EXEMPT_THROUGH = 60;
/** The top of the developmental tour's points list earns main-tour cards. */
export const DEV_GRADUATES = 20;

const DEV_TOWNS = ["Boise", "Wichita", "Knoxville", "Omaha", "Savannah", "Tulsa", "Spokane", "Fresno", "Lincoln", "Chattanooga", "Des Moines", "Albuquerque", "Greenville", "Lafayette", "Macon", "Reno", "Billings", "Tallahassee", "Charleston", "Pueblo", "Evansville", "Duluth", "Bakersfield", "Wilmington", "Sioux Falls", "Little Rock"];
const DEV_TOWNS_ADDED = ["Nassau", "Panama City", "Bogota", "Asheville", "Kansas City", "Grand Rapids", "Hershey", "Colorado Springs", "Columbus", "Boise Falls", "French Lick"];

/**
 * The developmental tour: smaller purses, weaker fields, and a points list
 * whose top 20 move up after the four-event Finals. The original 26 events
 * come from one random stream and the added ones from another, so a world's
 * main tour and its older developmental events never change.
 */
export function buildDevTour(seed: number): { courses: Course[]; schedule: TourEvent[] } {
  const rng = createRng(seed ^ 0xde7);
  const courses: Course[] = [];
  const styles: CourseStyle[] = ["parkland", "parkland", "resort", "desert", "links"];
  const original = DEV_WEEKS.map((week, i): TourEvent => {
    const town = DEV_TOWNS[i % DEV_TOWNS.length]!;
    const course = generateCourse(rng, `dev-${i + 1}`, `${town} Country Club`, rng.pick(styles));
    courses.push(course);
    const [lo, hi] = DEV_PURSE;
    return {
      id: `d${String(i + 1).padStart(2, "0")}`,
      name: `${town} ${rng.pick(DEV_SUFFIX)}`,
      week,
      tier: "dev",
      courseId: course.id,
      purse: Math.round((lo + rng.next() * (hi - lo)) / 50_000) * 50_000,
      fieldSize: DEV_FIELD[0],
      cutTop: DEV_FIELD[1],
      region: "NA",
    };
  });
  const more = createRng(seed ^ 0xde8);
  const added = DEV_WEEKS_ADDED.map((week, i): TourEvent => {
    const town = DEV_TOWNS_ADDED[i % DEV_TOWNS_ADDED.length]!;
    const course = generateCourse(more, `dev-${DEV_WEEKS.length + i + 1}`, `${town} Golf Club`, more.pick(styles));
    courses.push(course);
    const [lo, hi] = DEV_PURSE;
    return {
      id: `d${String(DEV_WEEKS.length + i + 1).padStart(2, "0")}`,
      name: `${town} ${more.pick(DEV_SUFFIX)}`,
      week,
      tier: "dev",
      courseId: course.id,
      purse: Math.round((lo + more.next() * (hi - lo)) / 50_000) * 50_000,
      fieldSize: DEV_FIELD[0],
      cutTop: DEV_FIELD[1],
      region: "NA",
    };
  });
  const schedule = [...original, ...added].map((e) => {
    const f = DEV_FINALS[e.week];
    return f ? { ...e, name: f.stage === 4 ? f.name : `${e.name.split(" ").slice(0, -1).join(" ")} ${f.name}`, purse: DEV_FINALS_PURSE, fieldSize: f.fieldSize, cutTop: f.cutTop, winnerPoints: DEV_FINALS_POINTS, devFinals: f.stage } : e;
  });
  return { courses, schedule };
}

/**
 * Careers that began with the shorter developmental tour get the full one
 * (the added weeks and the Finals) from their next season. Calendars edited
 * by hand are left alone. Safe to call more than once.
 */
export function addFullDevTour(world: { seed: number; schedule: TourEvent[]; courses: Course[] }): boolean {
  const dev = world.schedule.filter((e) => e.tier === "dev");
  if (!dev.some((e) => e.id === "d01") || dev.some((e) => e.devFinals)) return false;
  const full = buildDevTour(world.seed);
  const byId = new Map(full.schedule.map((e) => [e.id, e]));
  world.schedule = world.schedule.map((e) => (e.tier === "dev" && byId.has(e.id) ? byId.get(e.id)! : e));
  const have = new Set(world.schedule.map((e) => e.id));
  const added = full.schedule.filter((e) => !have.has(e.id));
  world.schedule.push(...added);
  const courseIds = new Set(world.courses.map((c) => c.id));
  for (const c of full.courses) if (!courseIds.has(c.id) && added.some((e) => e.courseId === c.id)) world.courses.push(c);
  world.schedule.sort((a, b) => a.week - b.week);
  return true;
}
