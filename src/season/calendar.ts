import { REAL_COURSE_REGION, createRng, generateCourse, getCourse, isRealCourse, type Course, type CourseStyle } from "../engine";
import type { EventTier, Region, TourEvent } from "./types";

/**
 * The 2026 PGA TOUR season (pgatour.com/schedule), one row per event:
 * [week, tier, courseId, name, purse, fieldSize, cutTop]. Weeks run in
 * order with the tour's off weeks closed up. Team events (the Zurich Classic)
 * are played as individual stroke play, and the Presidents Cup and the
 * unofficial December events are left out.
 */
type Slot = [number, EventTier, string, string, number, number, number | null];

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
];

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
const DEV_PURSE: [number, number] = [900_000, 1_200_000];
const DEV_FIELD: [number, number] = [144, 65];

const REGIONS: Record<string, Region> = { NA: "NA", EU: "EU", ASIA: "ASIA", AUS: "AUS" };

/**
 * Builds the tour: the real 2026 season on its real venues, plus the
 * developmental tour. Calendars repeat each season, as the real tour's
 * mostly do.
 */
export function buildTour(seed: number): { courses: Course[]; schedule: TourEvent[] } {
  const courses: Course[] = [];
  const schedule: TourEvent[] = SCHEDULE.map(([week, tier, courseId, name, purse, fieldSize, cutTop], i) => {
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
    };
  });
  const dev = buildDevTour(seed);
  return { courses: [...courses, ...dev.courses], schedule: [...schedule, ...dev.schedule] };
}

/** Weeks the developmental tour plays: most weeks, but not the majors, the playoffs or the finale. */
export const DEV_WEEKS = [3, 4, 5, 6, 8, 9, 10, 11, 12, 14, 15, 16, 17, 19, 20, 21, 22, 24, 25, 26, 28, 29, 30, 34, 35, 36];
/** The top of the developmental tour's points list earns main-tour cards. */
export const DEV_GRADUATES = 25;

const DEV_TOWNS = ["Boise", "Wichita", "Knoxville", "Omaha", "Savannah", "Tulsa", "Spokane", "Fresno", "Lincoln", "Chattanooga", "Des Moines", "Albuquerque", "Greenville", "Lafayette", "Macon", "Reno", "Billings", "Tallahassee", "Charleston", "Pueblo", "Evansville", "Duluth", "Bakersfield", "Wilmington", "Sioux Falls", "Little Rock"];

/**
 * The developmental tour: smaller purses, weaker fields, and a points list
 * whose top 25 move up. Built from its own random stream so adding it
 * never changes a world's main tour.
 */
export function buildDevTour(seed: number): { courses: Course[]; schedule: TourEvent[] } {
  const rng = createRng(seed ^ 0xde7);
  const courses: Course[] = [];
  const styles: CourseStyle[] = ["parkland", "parkland", "resort", "desert", "links"];
  const schedule = DEV_WEEKS.map((week, i): TourEvent => {
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
  return { courses, schedule };
}
