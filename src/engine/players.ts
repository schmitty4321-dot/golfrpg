import { ALL_ATTRIBUTES, TOUR_AVERAGE, type AttributeKey, type Attributes } from "./attributes";
import { clamp, type Rng } from "./rng";
import type { CourseStyle, Grass, Player } from "./types";

/** Where a generated player sits in the golf world. */
export type PlayerTier = "elite" | "tour" | "fringe" | "college" | "junior" | "veteran";

const TIERS: Record<PlayerTier, { talent: [number, number]; age: [number, number] }> = {
  elite: { talent: [15.0, 1.0], age: [24, 36] },
  tour: { talent: [12.3, 1.1], age: [23, 40] },
  fringe: { talent: [10.8, 1.0], age: [22, 38] },
  college: { talent: [9.5, 1.5], age: [18, 22] },
  junior: { talent: [7.5, 1.5], age: [14, 17] },
  veteran: { talent: [11.5, 1.2], age: [42, 50] },
};

/** Playing styles that skew a player's profile around their overall talent. */
const ARCHETYPES: Record<string, Partial<Record<AttributeKey, number>>> = {
  bomber: { drivingDistance: 3, drivingAccuracy: -2, aggression: 2, wedges: 1, flexibility: 2 },
  plotter: { drivingDistance: -2, drivingAccuracy: 3, courseManagement: 2, fairwayWoods: 1, aggression: -2 },
  ballStriker: { midIrons: 2, longIrons: 2, distanceControl: 2, shortPutts: -2, lagPutting: -1 },
  wedgeWizard: { wedges: 3, pitching: 2, chipping: 2, drivingDistance: -1 },
  flatStick: { shortPutts: 3, lagPutting: 2, greenReading: 2, speedControl: 2, longIrons: -2 },
  grinder: { bounceBack: 3, composure: 2, bunkerPlay: 2, creativity: 2, drivingDistance: -2 },
  shotmaker: { shotShaping: 3, trajectoryControl: 3, creativity: 2, windTolerance: 2, drivingAccuracy: -1 },
  allRounder: {},
};

/** Attributes that aren't really golf skill, so they don't follow talent. */
const PERSONALITY: readonly AttributeKey[] = ["aggression", "injuryProneness", "professionalism", "ambition", "coachability"];

const NATIONS: Record<string, { first: string[]; last: string[]; grass: Grass[] }> = {
  USA: {
    first: ["Tyler", "Brooks", "Cole", "Mason", "Wyatt", "Grant", "Luke", "Carter", "Drew", "Jake", "Harris", "Reid"],
    last: ["Whitaker", "Dunlap", "Mercer", "Holloway", "Crane", "Sutter", "Bishop", "Langford", "Pruitt", "Keane", "Vance", "Rhodes"],
    grass: ["bermuda", "bentgrass", "poa"],
  },
  England: {
    first: ["Oliver", "Harry", "Tom", "Callum", "James", "Freddie", "Alfie", "George", "Ben", "Sam"],
    last: ["Ashworth", "Pemberton", "Fairclough", "Hartley", "Wickham", "Staunton", "Cartwright", "Blakemore", "Thornton", "Radcliffe"],
    grass: ["bentgrass"],
  },
  Scotland: {
    first: ["Euan", "Fraser", "Callum", "Ross", "Hamish", "Angus", "Craig", "Gregor"],
    last: ["MacLeod", "Drummond", "Buchanan", "Kerr", "Munro", "Sinclair", "Galbraith", "Lennox"],
    grass: ["bentgrass"],
  },
  Ireland: {
    first: ["Cian", "Seamus", "Niall", "Rory", "Eoin", "Darragh", "Conor", "Ronan"],
    last: ["Keating", "Brannigan", "O'Rourke", "Dunne", "Mulcahy", "Fitzgerald", "Hennessy", "Coakley"],
    grass: ["bentgrass"],
  },
  Sweden: { first: ["Axel", "Linus", "Oskar", "Viktor", "Elias"], last: ["Lindqvist", "Berglund", "Ekholm", "Sandberg", "Nyström"], grass: ["bentgrass"] },
  Spain: { first: ["Álvaro", "Pablo", "Sergio", "Iker", "Mateo"], last: ["Ferrer", "Salazar", "Ortega", "Villanueva", "Castaño"], grass: ["bermuda", "bentgrass"] },
  "South Africa": { first: ["Dewald", "Thabo", "Ruan", "Jaco", "Sipho"], last: ["van Wyk", "Botha", "Nkosi", "du Plessis", "Coetzee"], grass: ["bermuda"] },
  Australia: { first: ["Lachlan", "Bailey", "Hamish", "Jai", "Kade"], last: ["Hargreaves", "Pickering", "Doyle", "Mackintosh", "Tuckwell"], grass: ["bentgrass", "bermuda"] },
  Japan: { first: ["Haruto", "Ren", "Sota", "Yuki", "Kaito"], last: ["Takeda", "Moriyama", "Hoshino", "Kuroda", "Ishikawa"], grass: ["bentgrass"] },
  Korea: { first: ["Min-jun", "Ji-ho", "Seo-jun", "Hyun-woo", "Do-yun"], last: ["Kang", "Yoon", "Jang", "Seo", "Han"], grass: ["bentgrass"] },
  Argentina: { first: ["Tomás", "Joaquín", "Facundo", "Santiago"], last: ["Echeverría", "Sosa", "Bustos", "Arriola"], grass: ["bermuda"] },
  Canada: { first: ["Liam", "Carson", "Brody", "Nolan"], last: ["Tremblay", "MacPhail", "Gagnon", "Bouchard"], grass: ["bentgrass", "poa"] },
};

let nextId = 1;

export interface GenerateOptions {
  tier: PlayerTier;
  archetype?: keyof typeof ARCHETYPES;
  nationality?: string;
  /** Names already taken in this world; the new player gets a different one. */
  usedNames?: Set<string>;
}

function uniqueName(rng: Rng, nation: { first: string[]; last: string[] }, used?: Set<string>): string {
  for (let i = 0; i < 50; i++) {
    const name = `${rng.pick(nation.first)} ${rng.pick(nation.last)}`;
    if (!used?.has(name)) {
      used?.add(name);
      return name;
    }
  }
  // Pool exhausted: add a middle initial, still checking it's unique.
  for (let i = 0; ; i++) {
    const initial = String.fromCharCode(65 + ((rng.int(0, 25) + i) % 26));
    const name = `${rng.pick(nation.first)} ${initial}. ${rng.pick(nation.last)}${i > 200 ? ` ${i}` : ""}`;
    if (!used?.has(name)) {
      used?.add(name);
      return name;
    }
  }
}

export function generatePlayer(rng: Rng, opts: GenerateOptions): Player {
  const tier = TIERS[opts.tier];
  // Capped so no generated player is untouchable: the very best are +3 a round, not +4.
  const talent = Math.min(16.5, rng.normal(tier.talent[0], tier.talent[1]));
  const archetype = ARCHETYPES[opts.archetype ?? rng.pick(Object.keys(ARCHETYPES))] ?? {};
  const nationality = opts.nationality ?? rng.pick(Object.keys(NATIONS));
  const nation = NATIONS[nationality] ?? NATIONS.USA!;

  const attributes = {} as Attributes;
  for (const k of ALL_ATTRIBUTES) {
    const base = PERSONALITY.includes(k) ? rng.normal(10.5, 3) : talent + rng.normal(0, 1.4);
    attributes[k] = Math.round(clamp(base + (archetype[k] ?? 0), 1, 20));
  }

  const age = rng.int(tier.age[0], tier.age[1]);
  // Veterans have lost distance and nerve on the greens; experience helps elsewhere.
  if (age >= 40) {
    const years = age - 39;
    attributes.drivingDistance = Math.max(1, attributes.drivingDistance - Math.ceil(years / 2));
    attributes.shortPutts = Math.max(1, attributes.shortPutts - Math.ceil(years / 4));
    attributes.stamina = Math.max(1, attributes.stamina - Math.ceil(years / 3));
    attributes.courseManagement = Math.min(20, attributes.courseManagement + 2);
  }

  const styleComfort = {} as Record<CourseStyle, number>;
  for (const s of ["links", "parkland", "desert", "resort"] as CourseStyle[]) {
    styleComfort[s] = Math.round(clamp(rng.normal(TOUR_AVERAGE, 2.5), 1, 20));
  }
  if (["Scotland", "Ireland", "England"].includes(nationality)) styleComfort.links = Math.min(20, styleComfort.links + 3);

  return {
    id: `p${nextId++}`,
    name: uniqueName(rng, nation, opts.usedNames),
    nationality,
    age,
    attributes,
    grassPreference: rng.pick(nation.grass),
    styleComfort,
    peakAge: Math.round(clamp(rng.normal(31, 2.5), 26, 37)),
    form: clamp(rng.normal(0, 0.3), -1, 1),
    condition: Math.round(clamp(rng.normal(90, 6), 60, 100)),
  };
}

/** A full-strength tour event field: a few stars, a deep middle, some qualifiers. */
export function generateTourField(rng: Rng, size = 156): Player[] {
  const field: Player[] = [];
  const usedNames = new Set<string>();
  const elite = Math.round(size * 0.06);
  const fringe = Math.round(size * 0.2);
  for (let i = 0; i < elite; i++) field.push(generatePlayer(rng, { tier: "elite", usedNames }));
  for (let i = 0; i < fringe; i++) field.push(generatePlayer(rng, { tier: "fringe", usedNames }));
  while (field.length < size) field.push(generatePlayer(rng, { tier: "tour", usedNames }));
  return field;
}
