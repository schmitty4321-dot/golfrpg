import { createRng, generateCourse, getCourse, type Course, type CourseStyle, type Rng } from "../engine";
import type { EventTier, Region, TourEvent } from "./types";

/** [week, tier, region, style]. Opposite-field events share a week with a major or signature event. */
type Slot = [number, EventTier, Region, CourseStyle];

const TEMPLATE: Slot[] = [
  [1, "standard", "NA", "resort"],
  [2, "signature", "NA", "resort"],
  [3, "standard", "NA", "desert"],
  [4, "standard", "NA", "desert"],
  [5, "standard", "NA", "parkland"],
  [6, "signature", "NA", "parkland"],
  [7, "standard", "NA", "parkland"],
  [8, "standard", "NA", "resort"],
  [9, "signature", "NA", "parkland"],
  [9, "opposite", "NA", "resort"],
  [10, "standard", "NA", "parkland"],
  [11, "signature", "NA", "parkland"],
  [11, "opposite", "NA", "resort"],
  [12, "standard", "NA", "parkland"],
  [13, "standard", "NA", "parkland"],
  [14, "major", "NA", "parkland"],
  [15, "standard", "NA", "resort"],
  [16, "signature", "NA", "parkland"],
  [16, "opposite", "NA", "desert"],
  [17, "standard", "NA", "parkland"],
  [18, "standard", "NA", "parkland"],
  [19, "standard", "NA", "parkland"],
  [20, "major", "NA", "parkland"],
  [21, "standard", "NA", "parkland"],
  [22, "signature", "NA", "parkland"],
  [22, "opposite", "NA", "parkland"],
  [23, "standard", "NA", "parkland"],
  [24, "standard", "NA", "parkland"],
  [25, "major", "NA", "parkland"],
  [26, "signature", "NA", "parkland"],
  [26, "opposite", "NA", "parkland"],
  [27, "standard", "EU", "links"],
  [28, "major", "EU", "links"],
  [28, "opposite", "NA", "resort"],
  [29, "standard", "NA", "parkland"],
  [30, "standard", "NA", "parkland"],
  [31, "standard", "ASIA", "parkland"],
  [32, "standard", "AUS", "links"],
  [33, "standard", "NA", "desert"],
  [34, "signature", "NA", "parkland"],
  [35, "standard", "NA", "resort"],
  [36, "finale", "NA", "parkland"],
];

/** Weeks in a season; the last is the finale. */
export const SEASON_WEEKS = 36;
/** Card positions are decided on the points list after this week. */
export const LAST_REGULAR_WEEK = 35;

const MAJORS: Record<number, { name: string; courseId?: string }> = {
  14: { name: "The Harrow Invitational", courseId: "harrow-pines" },
  20: { name: "The Players' Guild Championship" },
  25: { name: "The Continental Open" },
  28: { name: "The Links Championship", courseId: "kilbrannan-links" },
};

const FIXED_VENUES: Record<number, string> = { 1: "marisol-bay", 4: "saguaro-wells" };

const SPONSORS = [
  "Crestline Bank", "Halvorsen Insurance", "Northwind Air", "Bayshore Motors", "Keystone Energy",
  "Summit Health", "Redwood Capital", "Atlas Freight", "Blue Heron Resorts", "Meridian Tech",
  "Granite Mutual", "Lakeshore Foods", "Pioneer Logistics", "Evergreen Telecom", "Harbor Point Hotels",
  "Ironbridge Steel", "Cobalt Software", "Sterling Watches", "Canyon Outfitters", "Orchard Farms",
  "Tidewater Shipping", "Silverline Rail", "Vantage Partners", "Aurora Pharma", "Coastal Credit Union",
  "Falcon Aerospace", "Juniper Wireless", "Willow Creek Dairy", "Stonegate Homes", "Pacifica Wines",
  "Brightwater Utilities", "Kestrel Airlines", "Oakmont Brewing", "Prairie Grain", "Lighthouse Media",
  "Northstar Mining", "Cardinal Health Partners", "Riverbend Paper", "Clearpath Security", "Highland Distillers",
  "Mosaic Retail", "Anchor Marine", "Everest Tools", "Solace Hospitals", "Driftwood Apparel",
];

/**
 * Majors are set up harder than the same course's regular event: faster
 * greens, deeper rough, firmer turf.
 */
export function majorSetup(course: Course): Course {
  return {
    ...course,
    greenSpeed: course.greenSpeed + 1,
    roughPenalty: Math.min(1, course.roughPenalty + 0.2),
    firmness: Math.min(1, course.firmness + 0.1),
    holes: course.holes.map((h) => ({ ...h, fairwayWidth: h.par === 3 ? 0 : h.fairwayWidth - 3, yards: h.yards + 10 })),
  };
}
const EVENT_SUFFIX: Record<EventTier, string[]> = {
  dev: ["Open", "Classic", "Championship", "Challenge"],
  major: [],
  signature: ["Invitational", "Championship", "Memorial"],
  standard: ["Classic", "Open", "Championship", "Pro-Am"],
  opposite: ["Classic", "Open", "Championship"],
  finale: [],
};
const PLACE_A = ["Cedar", "Willow", "Eagle", "Stone", "Silver", "Oak", "Heron", "Falcon", "Copper", "Juniper", "Pelican", "Sandpiper", "Crane", "Harbor", "Pine", "Aspen", "Quail", "Osprey", "Magnolia", "Cypress", "Raven", "Timber", "Coral", "Bramble"];
const PLACE_B = ["Creek", "Hollow", "Ridge", "Valley", "Dunes", "Point", "Bluff", "Springs", "National", "Hills", "Lakes", "Crossing", "Bay", "Links", "Glen", "Meadows"];

const PURSE: Record<EventTier, [number, number]> = {
  dev: [900_000, 1_200_000],
  major: [18_000_000, 21_000_000],
  signature: [20_000_000, 20_000_000],
  standard: [7_400_000, 9_600_000],
  opposite: [3_800_000, 4_200_000],
  finale: [25_000_000, 25_000_000],
};
const FIELD: Record<EventTier, [number, number | null]> = {
  dev: [144, 65],
  major: [156, 65],
  signature: [72, null],
  standard: [144, 65],
  opposite: [132, 65],
  finale: [30, null],
};

function uniquePick(rng: Rng, items: string[], used: Set<string>): string {
  for (let i = 0; i < 100; i++) {
    const x = rng.pick(items);
    if (!used.has(x)) {
      used.add(x);
      return x;
    }
  }
  const x = `${rng.pick(items)} ${used.size}`;
  used.add(x);
  return x;
}

/**
 * Builds the tour: one venue per event (the hand-built courses host the
 * majors and a couple of regular stops) and the season calendar. Calendars
 * repeat each season, as the real tour's mostly do.
 */
export function buildTour(seed: number): { courses: Course[]; schedule: TourEvent[] } {
  const rng = createRng(seed ^ 0x5eed);
  const courses: Course[] = [];
  const usedVenues = new Set<string>();
  const usedSponsors = new Set<string>();
  const schedule: TourEvent[] = TEMPLATE.map(([week, tier, region, style], i) => {
    const fixedId = tier === "major" ? MAJORS[week]?.courseId : FIXED_VENUES[week];
    let course: Course;
    if (fixedId) {
      course = getCourse(fixedId);
    } else {
      const venue = `${uniquePick(rng, PLACE_A, usedVenues)} ${rng.pick(PLACE_B)}`;
      course = generateCourse(rng, venue.toLowerCase().replace(/[^a-z]+/g, "-"), venue, style);
    }
    if (!courses.some((c) => c.id === course.id)) courses.push(course);

    let name: string;
    if (tier === "major") name = MAJORS[week]!.name;
    else if (tier === "finale") name = "The Tour Championship";
    else name = `${uniquePick(rng, SPONSORS, usedSponsors)} ${rng.pick(EVENT_SUFFIX[tier])}`;

    const [lo, hi] = PURSE[tier];
    const [fieldSize, cutTop] = FIELD[tier];
    return {
      id: `e${String(i + 1).padStart(2, "0")}`,
      name,
      week,
      tier,
      courseId: course.id,
      purse: Math.round((lo + rng.next() * (hi - lo)) / 100_000) * 100_000,
      fieldSize,
      cutTop,
      region,
    };
  });
  const dev = buildDevTour(seed);
  return { courses: [...courses, ...dev.courses], schedule: [...schedule, ...dev.schedule] };
}

/** Weeks the developmental tour plays: most weeks, but not the majors or the finale. */
export const DEV_WEEKS = [2, 3, 5, 6, 7, 9, 10, 12, 13, 15, 16, 17, 19, 21, 22, 23, 24, 26, 27, 29, 30, 31, 33, 34];
/** The top of the developmental tour's points list earns main-tour cards. */
export const DEV_GRADUATES = 25;

const DEV_TOWNS = ["Boise", "Wichita", "Knoxville", "Omaha", "Savannah", "Tulsa", "Spokane", "Fresno", "Lincoln", "Chattanooga", "Des Moines", "Albuquerque", "Greenville", "Lafayette", "Macon", "Reno", "Billings", "Tallahassee", "Charleston", "Pueblo", "Evansville", "Duluth", "Bakersfield", "Wilmington"];

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
    const [lo, hi] = PURSE.dev;
    return {
      id: `d${String(i + 1).padStart(2, "0")}`,
      name: `${town} ${rng.pick(EVENT_SUFFIX.dev)}`,
      week,
      tier: "dev",
      courseId: course.id,
      purse: Math.round((lo + rng.next() * (hi - lo)) / 50_000) * 50_000,
      fieldSize: FIELD.dev[0],
      cutTop: FIELD.dev[1],
      region: "NA",
    };
  });
  return { courses, schedule };
}
