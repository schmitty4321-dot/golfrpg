/**
 * A client's home base: the city he lives in, picked from the places tour pros
 * actually live. It decides which events are a drive away (cheaper, a travel
 * day fewer), where his weeks off are spent (more recovery at home, and the
 * homesickness goes), which events have a home crowd (a small lift, more press),
 * and, when the setting is on, the income tax on his winnings: one flat rate
 * per city, taken from his own money, never the agency's.
 *
 * Every player has a home city: computer players get one from their
 * nationality and never move; your clients can move, at a cost.
 */
import { clamp, homeRegion, traceSeed } from "../engine";
import { ownedLifestyle } from "./lifestyle";
import { personalWealth } from "./finance";
import { has } from "./traits";
import { ensureFamilies } from "./family";
import { absWeek, type Region, type World, type WorldPlayer } from "./types";

export interface HomeCity {
  id: string;
  name: string;
  /** The state (USA) or country, for the label and the home crowd. */
  place: string;
  region: Region;
  /** Income tax on his winnings and endorsements, after commission. */
  tax: number;
  /** What a move here costs him: the movers, agents' fees, a new club. */
  moveCost: number;
  /** Practice facilities, 1-3: range days in his weeks at home count a little more. */
  practice: 1 | 2 | 3;
  lat: number;
  lon: number;
  blurb: string;
}

export const HOME_CITIES: HomeCity[] = [
  { id: "jupiter", name: "Jupiter", place: "Florida", region: "NA", tax: 0, moveCost: 150_000, practice: 3, lat: 26.93, lon: -80.09, blurb: "Where half the tour lives: no state income tax and the best practice in golf." },
  { id: "orlando", name: "Orlando", place: "Florida", region: "NA", tax: 0, moveCost: 100_000, practice: 2, lat: 28.54, lon: -81.38, blurb: "Lake Nona and Isleworth, and no state income tax." },
  { id: "ponte-vedra", name: "Ponte Vedra Beach", place: "Florida", region: "NA", tax: 0, moveCost: 130_000, practice: 3, lat: 30.24, lon: -81.39, blurb: "Next door to the tour's headquarters at Sawgrass." },
  { id: "dallas", name: "Dallas", place: "Texas", region: "NA", tax: 0, moveCost: 100_000, practice: 2, lat: 32.78, lon: -96.8, blurb: "Big airport, big clubs, no state income tax." },
  { id: "austin", name: "Austin", place: "Texas", region: "NA", tax: 0, moveCost: 100_000, practice: 2, lat: 30.27, lon: -97.74, blurb: "Hill Country golf and no state income tax." },
  { id: "scottsdale", name: "Scottsdale", place: "Arizona", region: "NA", tax: 0.025, moveCost: 110_000, practice: 3, lat: 33.49, lon: -111.93, blurb: "Desert courses and winter sun; a low state tax." },
  { id: "las-vegas", name: "Las Vegas", place: "Nevada", region: "NA", tax: 0, moveCost: 90_000, practice: 2, lat: 36.17, lon: -115.14, blurb: "Year-round golf and no state income tax." },
  { id: "sea-island", name: "Sea Island", place: "Georgia", region: "NA", tax: 0.055, moveCost: 120_000, practice: 2, lat: 31.2, lon: -81.33, blurb: "A quiet island with a tour pros' practice ground." },
  { id: "charlotte", name: "Charlotte", place: "North Carolina", region: "NA", tax: 0.045, moveCost: 90_000, practice: 2, lat: 35.23, lon: -80.84, blurb: "Quail Hollow country, a short flight from everywhere." },
  { id: "columbus", name: "Columbus", place: "Ohio", region: "NA", tax: 0.035, moveCost: 80_000, practice: 1, lat: 39.96, lon: -83.0, blurb: "Close to Muirfield Village; long winters indoors." },
  { id: "san-diego", name: "San Diego", place: "California", region: "NA", tax: 0.12, moveCost: 160_000, practice: 3, lat: 32.72, lon: -117.16, blurb: "Perfect weather and Torrey Pines, at California's tax rate." },
  { id: "toronto", name: "Toronto", place: "Canada", region: "NA", tax: 0.15, moveCost: 100_000, practice: 1, lat: 43.65, lon: -79.38, blurb: "Home crowds at the Canadian Open; short seasons." },
  { id: "london", name: "London", place: "England", region: "EU", tax: 0.2, moveCost: 180_000, practice: 2, lat: 51.51, lon: -0.13, blurb: "Wentworth and the Heathland courses, at British tax rates." },
  { id: "dublin", name: "Dublin", place: "Ireland", region: "EU", tax: 0.2, moveCost: 120_000, practice: 2, lat: 53.35, lon: -6.26, blurb: "Links golf on the doorstep." },
  { id: "stockholm", name: "Stockholm", place: "Sweden", region: "EU", tax: 0.25, moveCost: 110_000, practice: 1, lat: 59.33, lon: 18.07, blurb: "Long summer evenings, short golf seasons, high tax." },
  { id: "monte-carlo", name: "Monte Carlo", place: "Monaco", region: "EU", tax: 0, moveCost: 300_000, practice: 2, lat: 43.74, lon: 7.42, blurb: "No income tax, and the harbour views cost the earth." },
  { id: "dubai", name: "Dubai", place: "United Arab Emirates", region: "EU", tax: 0, moveCost: 200_000, practice: 3, lat: 25.2, lon: 55.27, blurb: "No income tax and desert practice facilities all winter." },
  { id: "sydney", name: "Sydney", place: "Australia", region: "AUS", tax: 0.2, moveCost: 140_000, practice: 2, lat: -33.87, lon: 151.21, blurb: "The sandbelt is a flight away; summer when the tour has winter." },
  { id: "tokyo", name: "Tokyo", place: "Japan", region: "ASIA", tax: 0.2, moveCost: 150_000, practice: 2, lat: 35.68, lon: 139.69, blurb: "Home fans in their thousands at the Japan swing." },
  { id: "seoul", name: "Seoul", place: "South Korea", region: "ASIA", tax: 0.2, moveCost: 130_000, practice: 2, lat: 37.57, lon: 126.98, blurb: "A golf-mad country watching every shot." },
];

export const HOME_CITY_BY_ID: Readonly<Record<string, HomeCity>> = Object.fromEntries(HOME_CITIES.map((c) => [c.id, c]));

/** Where the real tour courses are: latitude, longitude, and the state or country (for the home crowd). */
const COURSE_GEO: Record<string, [number, number, string]> = {
  waialae: [21.27, -157.77, "Hawaii"],
  "pga-west-stadium": [33.66, -116.27, "California"],
  "torrey-pines-south": [32.9, -117.25, "California"],
  "tpc-scottsdale": [33.64, -111.91, "Arizona"],
  "pebble-beach": [36.57, -121.95, "California"],
  riviera: [34.05, -118.5, "California"],
  "pga-national-champion": [26.83, -80.14, "Florida"],
  "bay-hill": [28.46, -81.51, "Florida"],
  "grand-reserve": [18.38, -65.83, "Puerto Rico"],
  "tpc-sawgrass": [30.2, -81.39, "Florida"],
  "innisbrook-copperhead": [28.12, -82.76, "Florida"],
  "memorial-park": [29.77, -95.44, "Texas"],
  "tpc-san-antonio-oaks": [29.67, -98.43, "Texas"],
  "augusta-national": [33.5, -82.02, "Georgia"],
  "harbour-town": [32.14, -80.81, "South Carolina"],
  "tpc-louisiana": [29.88, -90.17, "Louisiana"],
  "doral-blue-monster": [25.81, -80.34, "Florida"],
  "quail-hollow": [35.1, -80.85, "North Carolina"],
  "dunes-club": [33.73, -78.84, "South Carolina"],
  aronimink: [39.97, -75.42, "Pennsylvania"],
  "tpc-craig-ranch": [33.13, -96.72, "Texas"],
  colonial: [32.72, -97.39, "Texas"],
  "muirfield-village": [40.12, -83.16, "Ohio"],
  "osprey-valley-north": [43.8, -79.95, "Canada"],
  "shinnecock-hills": [40.89, -72.44, "New York"],
  "tpc-river-highlands": [41.59, -72.65, "Connecticut"],
  "tpc-deere-run": [41.5, -90.43, "Illinois"],
  "renaissance-club": [56.05, -2.78, "Scotland"],
  hurstbourne: [38.24, -85.59, "Kentucky"],
  "royal-birkdale": [53.62, -3.03, "England"],
  corales: [18.53, -68.35, "Dominican Republic"],
  "tpc-twin-cities": [45.18, -93.2, "Minnesota"],
  "detroit-golf-club": [42.43, -83.13, "Michigan"],
  sedgefield: [36.05, -79.84, "North Carolina"],
  "tpc-southwind": [35.05, -89.81, "Tennessee"],
  bellerive: [38.63, -90.47, "Missouri"],
  "east-lake": [33.75, -84.3, "Georgia"],
  "walnut-cove": [35.45, -82.53, "North Carolina"],
  "black-desert": [37.17, -113.7, "Utah"],
  yokohama: [35.44, 139.64, "Japan"],
  "port-royal": [32.25, -64.86, "Bermuda"],
  "vidanta-vallarta": [20.69, -105.3, "Mexico"],
  "el-cardonal": [23.07, -109.7, "Mexico"],
  "barton-creek-fazio-canyons": [30.28, -97.85, "Texas"],
  "sea-island-seaside": [31.16, -81.38, "Georgia"],
};

/** A day's drive, in miles (about seven hours on the road). */
export const DAY_DRIVE_MILES = 450;
/** Weeks off at home recover this much more condition (a home of his own there: more again). */
export const HOME_RECOVERY = 1.15;
export const OWN_HOME_RECOVERY = 1.25;
/** A home he owns sells for this share of its price when he moves (better than the trade-in). */
export const HOME_RESALE = 0.8;
/** Travel to an event within a day's drive costs this share of the usual. */
export const DRIVE_COST_SHARE = 0.4;

/** Cities a nationality's players live in, with weights. */
const NATION_CITIES: Record<string, [string, number][]> = {
  USA: [["jupiter", 4], ["dallas", 3], ["orlando", 2], ["ponte-vedra", 2], ["scottsdale", 2], ["austin", 1], ["las-vegas", 1], ["sea-island", 1], ["charlotte", 1], ["columbus", 1], ["san-diego", 1]],
  Canada: [["toronto", 3], ["scottsdale", 1]],
  England: [["london", 3], ["jupiter", 1], ["dubai", 1]],
  Scotland: [["london", 2], ["dubai", 1]],
  "Northern Ireland": [["london", 1], ["jupiter", 1]],
  Ireland: [["dublin", 3], ["jupiter", 1]],
  Sweden: [["stockholm", 2], ["monte-carlo", 1], ["jupiter", 1]],
  Norway: [["stockholm", 1], ["monte-carlo", 1], ["jupiter", 1]],
  Denmark: [["stockholm", 1], ["monte-carlo", 1], ["dubai", 1]],
  Finland: [["stockholm", 1], ["monte-carlo", 1]],
  Germany: [["monte-carlo", 1], ["london", 1], ["orlando", 1]],
  Austria: [["monte-carlo", 1], ["orlando", 1]],
  Belgium: [["monte-carlo", 1], ["london", 1]],
  France: [["monte-carlo", 2], ["london", 1]],
  Italy: [["monte-carlo", 2], ["dubai", 1]],
  Spain: [["monte-carlo", 1], ["dubai", 1]],
  Australia: [["sydney", 2], ["jupiter", 1], ["dallas", 1]],
  "New Zealand": [["sydney", 1], ["orlando", 1]],
  Fiji: [["sydney", 1], ["orlando", 1]],
  Japan: [["tokyo", 3], ["las-vegas", 1]],
  Korea: [["seoul", 2], ["dallas", 1], ["las-vegas", 1]],
  China: [["dallas", 1], ["orlando", 1]],
  "Chinese Taipei": [["dallas", 1], ["orlando", 1]],
  Philippines: [["orlando", 1], ["las-vegas", 1]],
  India: [["dubai", 1], ["orlando", 1]],
};
const ELSEWHERE: [string, number][] = [["jupiter", 2], ["orlando", 2], ["dallas", 1]];

/** The city his nationality points to: the same pick every time for the same player. */
export function defaultHomeCity(wp: WorldPlayer): string {
  const options = NATION_CITIES[wp.player.nationality] ?? ELSEWHERE;
  const total = options.reduce((s, [, w]) => s + w, 0);
  let x = traceSeed("home-city", wp.player.id) % total;
  for (const [id, w] of options) {
    if (x < w) return id;
    x -= w;
  }
  return options[0]![0];
}

/** His home city (computer players: from nationality, and they never move). */
export function homeCityOf(wp: WorldPlayer): HomeCity {
  return HOME_CITY_BY_ID[wp.homeCity ?? ""] ?? HOME_CITY_BY_ID[defaultHomeCity(wp)]!;
}

/** Clients without a home city (older saves, new signings) get the one their nationality points to. */
export function ensureHomeCities(world: World): void {
  for (const id of world.clientIds) {
    const wp = world.players[id];
    if (wp && !HOME_CITY_BY_ID[wp.homeCity ?? ""]) wp.homeCity = defaultHomeCity(wp);
  }
}

export const cityLabel = (c: HomeCity): string => `${c.name}, ${c.place}`;

function miles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 3959 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Miles from his home to a course, or null when the course isn't on the map (made-up courses). */
export function milesFromHome(wp: WorldPlayer, courseId: string): number | null {
  const g = COURSE_GEO[courseId];
  if (!g) return null;
  const c = homeCityOf(wp);
  return Math.round(miles(c.lat, c.lon, g[0], g[1]));
}

/** An event within a day's drive of home. */
export function withinDrive(wp: WorldPlayer, courseId: string | undefined): boolean {
  if (!courseId) return false;
  const d = milesFromHome(wp, courseId);
  return d !== null && d <= DAY_DRIVE_MILES;
}

/** An event in his home state (or country, outside the USA): the home crowd turns out. */
export function homeCrowd(wp: WorldPlayer, courseId: string): boolean {
  const g = COURSE_GEO[courseId];
  return !!g && g[2] === homeCityOf(wp).place;
}

/** The state or country a course is in, if known. */
export const coursePlace = (courseId: string): string | undefined => COURSE_GEO[courseId]?.[2];

/** Whether the tax setting is on (it is unless switched off). */
export const taxOn = (world: World): boolean => world.homeTax !== false;

/** His tax rate where he lives now (0 when the setting is off). */
export const taxRate = (world: World, wp: WorldPlayer): number => (taxOn(world) ? homeCityOf(wp).tax : 0);

/** Income that tax is due on: prize money, endorsements and business profits, after the agency's commission. */
export function taxableIncome(wp: WorldPlayer): number {
  const f = wp.client?.finances;
  if (!f) return 0;
  return f.prizeMoney + f.endorsements + Math.max(0, f.business ?? 0) - f.commission;
}

/**
 * Weekly: tax on the income that came in since last week, at the rate where he
 * lives now (a move changes the rate from then on, not backwards).
 */
export function taxWeek(world: World): void {
  ensureHomeCities(world);
  ensureFamilies(world);
  for (const id of world.clientIds) {
    const wp = world.players[id];
    const f = wp?.client?.finances;
    if (!wp || !f) continue;
    const income = taxableIncome(wp);
    const fresh = income - (f.taxedIncome ?? 0);
    f.taxedIncome = income;
    const rate = taxRate(world, wp);
    if (fresh > 0 && rate > 0) f.tax = (f.tax ?? 0) + Math.round(fresh * rate);
  }
}

/** Was his week off spent at home? Off weeks count as home unless he's on another continent without a private plane to fly back. */
export function offWeekAtHome(world: World, wp: WorldPlayer): boolean {
  const home = homeCityOf(wp).region;
  const last = wp.career.lastRegion;
  if (last === null || last === home) return true;
  return !!wp.client && (!!world.agency.jet || wp.client.travelClass === "charter");
}

/** A home of his own in his city. */
export const ownsHome = (wp: WorldPlayer): boolean => ownedLifestyle(wp).some((i) => i.kind === "home");

/** Recovery in a week off at home. */
export const homeRecovery = (wp: WorldPlayer): number => (ownsHome(wp) ? OWN_HOME_RECOVERY : HOME_RECOVERY);

/** Range work at home: better facilities count a little more. */
export const homePracticeBoost = (wp: WorldPlayer): number => 1 + (homeCityOf(wp).practice - 1) * 0.03;

/** Marks a week spent at home: homesickness starts over (see awayStreak in traits.ts). */
export function noteHomeWeek(world: World, wp: WorldPlayer): void {
  if (wp.client) wp.client.homeWeek = absWeek(world.season, world.week);
}

/** What a move costs: the movers and fees, less what his old home sells for. */
export function moveCost(wp: WorldPlayer, cityId: string): { cost: number; resale: number; net: number } {
  const city = HOME_CITY_BY_ID[cityId];
  const home = ownedLifestyle(wp).find((i) => i.kind === "home");
  const resale = home ? Math.round(home.price * HOME_RESALE) : 0;
  const cost = city?.moveCost ?? 0;
  return { cost, resale, net: cost - resale };
}

/** How the move sits with him: homesick players hate leaving their part of the world, and love going back. */
export function moveMood(wp: WorldPlayer, cityId: string): number {
  const to = HOME_CITY_BY_ID[cityId];
  if (!to) return 0;
  const from = homeCityOf(wp);
  const roots = homeRegion(wp.player.nationality);
  if (has(wp, "homesick")) {
    if (roots && to.region !== roots && from.region === roots) return -10;
    if (roots && to.region === roots && from.region !== roots) return 6;
    return -3;
  }
  return -2;
}

/** Why he can't move there now, or null. */
export function moveBlock(world: World, clientId: string, cityId: string): string | null {
  const wp = world.players[clientId];
  if (!wp?.client) return "He isn't your client.";
  if (!HOME_CITY_BY_ID[cityId]) return "No such city.";
  if (homeCityOf(wp).id === cityId) return "He already lives there.";
  if (wp.client.movedSeason === world.season) return "He has moved once this season already.";
  const { net } = moveCost(wp, cityId);
  if (net > personalWealth(wp)) return `He can't afford the move: he has ${Math.max(0, personalWealth(wp)).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}.`;
  return null;
}

/** Moves him: he pays the move, sells the home he owns (it was in his old city), and his mood moves. */
export function moveHome(world: World, clientId: string, cityId: string): void {
  const block = moveBlock(world, clientId, cityId);
  if (block) throw new Error(block);
  const wp = world.players[clientId]!;
  const c = wp.client!;
  const { net } = moveCost(wp, cityId);
  const home = ownedLifestyle(wp).find((i) => i.kind === "home");
  if (home) c.lifestyle = (c.lifestyle ?? []).filter((x) => x !== home.id);
  c.finances.lifestyle = (c.finances.lifestyle ?? 0) + net;
  c.happiness = clamp(c.happiness + moveMood(wp, cityId), 0, 100);
  c.movedSeason = world.season;
  const city = HOME_CITY_BY_ID[cityId]!;
  wp.homeCity = cityId;
  world.news.unshift(`${wp.player.name} moves to ${cityLabel(city)}${home ? `, selling his ${home.name.toLowerCase()}` : ""}.`);
}

/** Sets the tax setting for the whole career. */
export function setHomeTax(world: World, on: boolean): void {
  world.homeTax = on;
}

