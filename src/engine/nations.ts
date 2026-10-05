import type { Grass } from "./types";

/**
 * Where golfers come from. `weight` is each country's share of new players,
 * taken from the 2026 PGA TOUR media guide: 86 international members from 27
 * countries and territories, the rest American (about two-thirds of a tour of
 * ~260, the size of this game's tour). The guide lists C.T. Pan under China;
 * here he'd count for Chinese Taipei.
 *
 * `key` is what saves store as a player's nationality, so existing keys never
 * change (South Korea stays "Korea"). `look` steers the portrait's skin and
 * hair colours as a spread of likelihoods, never a rule.
 */
export type Look = "mixed" | "northern" | "eastAsia" | "latin" | "pacific" | "southAsia";

export interface Nation {
  key: string;
  name: string;
  /** Three-letter code, as on tour leaderboards. */
  code: string;
  weight: number;
  first: string[];
  last: string[];
  grass: Grass[];
  look: Look;
  /** The tour region he calls home (travel, home crowds), if the tour plays there. */
  region: "NA" | "EU" | "ASIA" | "AUS" | null;
  /** Grew up on links golf. */
  links?: boolean;
}

export const NATION_LIST: readonly Nation[] = [
  {
    key: "USA", region: "NA", name: "United States", code: "USA", weight: 174, look: "mixed", grass: ["bermuda", "bentgrass", "poa"],
    first: ["Tyler", "Brooks", "Cole", "Mason", "Wyatt", "Grant", "Luke", "Carter", "Drew", "Jake", "Harris", "Reid", "Chase", "Trevor", "Blake", "Austin", "Garrett", "Tanner", "Hunter", "Parker", "Logan", "Brady", "Dalton", "Kyle", "Travis", "Jordan", "Marcus", "Andre", "Darius", "Isaiah", "Cameron", "Evan", "Nolan", "Spencer", "Connor", "Bryce", "Wesley", "Caleb", "Derek", "Shane"],
    last: ["Whitaker", "Dunlap", "Mercer", "Holloway", "Crane", "Sutter", "Bishop", "Langford", "Pruitt", "Keane", "Vance", "Rhodes", "Calloway", "Stroud", "Whitfield", "Bramlett", "Hollis", "Tate", "Garrison", "Kimbrough", "Easton", "Sampson", "Pittman", "Holt", "Barlow", "Mayfield", "Duncan", "Ellison", "Coleman", "Tillman", "Stanton", "Prescott", "Hargrove", "Lowell", "Brennan", "Carver", "Maddox", "Ramsey", "Winslow", "Gentry"],
  },
  {
    key: "England", region: "EU", name: "England", code: "ENG", weight: 13, look: "mixed", grass: ["bentgrass"], links: true,
    first: ["Oliver", "Harry", "Tom", "Callum", "James", "Freddie", "Alfie", "George", "Ben", "Sam", "Jack", "Toby", "Will", "Max", "Joe"],
    last: ["Ashworth", "Pemberton", "Fairclough", "Hartley", "Wickham", "Staunton", "Cartwright", "Blakemore", "Thornton", "Radcliffe", "Hollingworth", "Pickford", "Aldridge", "Crowther", "Whitlock"],
  },
  { key: "Canada", region: "NA", name: "Canada", code: "CAN", weight: 9, look: "mixed", grass: ["bentgrass", "poa"], first: ["Liam", "Carson", "Brody", "Nolan", "Ethan", "Owen", "Tristan", "Jesse"], last: ["Tremblay", "MacPhail", "Gagnon", "Bouchard", "Kowalczyk", "Lachance", "Fraser", "Beaulieu"] },
  { key: "Sweden", region: "EU", name: "Sweden", code: "SWE", weight: 7, look: "northern", grass: ["bentgrass"], first: ["Axel", "Linus", "Oskar", "Viktor", "Elias", "Hugo", "Filip"], last: ["Lindqvist", "Berglund", "Ekholm", "Sandberg", "Nyström", "Wallin", "Hedlund"] },
  { key: "Australia", region: "AUS", name: "Australia", code: "AUS", weight: 6, look: "mixed", grass: ["bentgrass", "bermuda"], first: ["Lachlan", "Bailey", "Hamish", "Jai", "Kade", "Mitchell", "Riley"], last: ["Hargreaves", "Pickering", "Doyle", "Mackintosh", "Tuckwell", "Brereton", "Kearney"] },
  { key: "Japan", region: "ASIA", name: "Japan", code: "JPN", weight: 6, look: "eastAsia", grass: ["bentgrass"], first: ["Haruto", "Ren", "Sota", "Yuki", "Kaito", "Daiki", "Takumi"], last: ["Takeda", "Moriyama", "Hoshino", "Kuroda", "Ishikawa", "Fujita", "Nakamura"] },
  { key: "Korea", region: "ASIA", name: "South Korea", code: "KOR", weight: 6, look: "eastAsia", grass: ["bentgrass"], first: ["Min-jun", "Ji-ho", "Seo-jun", "Hyun-woo", "Do-yun", "Jae-won", "Sung-min"], last: ["Kang", "Yoon", "Jang", "Seo", "Han", "Park", "Choi"] },
  { key: "South Africa", region: null, name: "South Africa", code: "RSA", weight: 5, look: "mixed", grass: ["bermuda"], first: ["Dewald", "Thabo", "Ruan", "Jaco", "Sipho", "Wian", "Lwazi"], last: ["van Wyk", "Botha", "Nkosi", "du Plessis", "Coetzee", "Mokoena", "Steyn"] },
  { key: "Denmark", region: "EU", name: "Denmark", code: "DEN", weight: 4, look: "northern", grass: ["bentgrass"], first: ["Mads", "Frederik", "Jonas", "Emil", "Magnus"], last: ["Kjeldsen", "Møller", "Thygesen", "Lund", "Bundgaard"] },
  { key: "China", region: "ASIA", name: "China", code: "CHN", weight: 3, look: "eastAsia", grass: ["bentgrass", "bermuda"], first: ["Wei", "Hao", "Jun", "Zhen", "Yu"], last: ["Zhang", "Liu", "Chen", "Wang", "Zhou"] },
  { key: "Norway", region: "EU", name: "Norway", code: "NOR", weight: 3, look: "northern", grass: ["bentgrass"], first: ["Sindre", "Eirik", "Håkon", "Anders", "Torstein"], last: ["Solberg", "Haugen", "Bakke", "Strand", "Lie"] },
  { key: "Germany", region: "EU", name: "Germany", code: "GER", weight: 3, look: "northern", grass: ["bentgrass"], first: ["Lukas", "Maximilian", "Felix", "Jannik", "Moritz"], last: ["Brandt", "Keller", "Hoffmann", "Wagner", "Richter"] },
  { key: "Argentina", region: null, name: "Argentina", code: "ARG", weight: 2, look: "latin", grass: ["bermuda"], first: ["Tomás", "Joaquín", "Facundo", "Santiago"], last: ["Echeverría", "Sosa", "Bustos", "Arriola"] },
  { key: "Colombia", region: null, name: "Colombia", code: "COL", weight: 2, look: "latin", grass: ["bermuda"], first: ["Camilo", "Sebastián", "Felipe", "Andrés"], last: ["Restrepo", "Cárdenas", "Ospina", "Zuluaga"] },
  { key: "France", region: "EU", name: "France", code: "FRA", weight: 2, look: "mixed", grass: ["bentgrass"], first: ["Antoine", "Julien", "Romain", "Victor"], last: ["Lefèvre", "Moreau", "Garnier", "Rousseau"] },
  { key: "Ireland", region: "EU", name: "Ireland", code: "IRL", weight: 2, look: "northern", grass: ["bentgrass"], links: true, first: ["Cian", "Seamus", "Niall", "Eoin", "Darragh", "Ronan"], last: ["Keating", "Brannigan", "O'Rourke", "Dunne", "Mulcahy", "Hennessy"] },
  { key: "Scotland", region: "EU", name: "Scotland", code: "SCO", weight: 1, look: "northern", grass: ["bentgrass"], links: true, first: ["Euan", "Fraser", "Callum", "Ross", "Hamish", "Angus", "Craig", "Gregor"], last: ["MacLeod", "Drummond", "Buchanan", "Kerr", "Munro", "Sinclair", "Galbraith", "Lennox"] },
  { key: "Northern Ireland", region: "EU", name: "Northern Ireland", code: "NIR", weight: 1, look: "northern", grass: ["bentgrass"], links: true, first: ["Gareth", "Ryan", "Stuart", "Conall"], last: ["McCann", "Doherty", "Maguire", "Beattie"] },
  { key: "Austria", region: "EU", name: "Austria", code: "AUT", weight: 1, look: "northern", grass: ["bentgrass"], first: ["Florian", "Tobias", "Matthias"], last: ["Gruber", "Huber", "Leitner"] },
  { key: "Belgium", region: "EU", name: "Belgium", code: "BEL", weight: 1, look: "northern", grass: ["bentgrass"], first: ["Arnaud", "Pieter", "Thibault"], last: ["Peeters", "Dubois", "Janssens"] },
  { key: "Fiji", region: "AUS", name: "Fiji", code: "FIJ", weight: 1, look: "pacific", grass: ["bermuda"], first: ["Josefa", "Semi", "Viliame"], last: ["Naivalu", "Tikoisuva", "Raikadroka"] },
  { key: "Finland", region: "EU", name: "Finland", code: "FIN", weight: 1, look: "northern", grass: ["bentgrass"], first: ["Eero", "Joonas", "Aleksi"], last: ["Virtanen", "Mäkinen", "Korhonen"] },
  { key: "Italy", region: "EU", name: "Italy", code: "ITA", weight: 1, look: "latin", grass: ["bentgrass", "bermuda"], first: ["Matteo", "Lorenzo", "Davide"], last: ["Ricci", "Colombo", "Marino"] },
  { key: "Mexico", region: "NA", name: "Mexico", code: "MEX", weight: 1, look: "latin", grass: ["bermuda"], first: ["Diego", "Emilio", "Rodrigo"], last: ["Herrera", "Villarreal", "Cantú"] },
  { key: "New Zealand", region: "AUS", name: "New Zealand", code: "NZL", weight: 1, look: "mixed", grass: ["bentgrass"], first: ["Hamish", "Blake", "Nathan"], last: ["Tait", "McKay", "Harland"] },
  { key: "Philippines", region: "ASIA", name: "Philippines", code: "PHI", weight: 1, look: "southAsia", grass: ["bermuda"], first: ["Miguel", "Paolo", "Carlo"], last: ["Santos", "Dizon", "Mercado"] },
  { key: "Puerto Rico", region: "NA", name: "Puerto Rico", code: "PUR", weight: 1, look: "latin", grass: ["bermuda"], first: ["Javier", "Gabriel", "Luis"], last: ["Rivera", "Colón", "Negrón"] },
  { key: "Venezuela", region: null, name: "Venezuela", code: "VEN", weight: 1, look: "latin", grass: ["bermuda"], first: ["Jesús", "Ricardo", "Alejandro"], last: ["Guzmán", "Salcedo", "Briceño"] },
  { key: "Chinese Taipei", region: "ASIA", name: "Chinese Taipei", code: "TPE", weight: 1, look: "eastAsia", grass: ["bermuda"], first: ["Chih-wei", "Kuan-lin", "Yu-ting"], last: ["Lin", "Tsai", "Hsu"] },
  // Not on the 2026 membership list: a rare Indian pro, about one on a tour of 260.
  { key: "India", region: "ASIA", name: "India", code: "IND", weight: 1, look: "southAsia", grass: ["bermuda"], first: ["Arjun", "Rohan", "Karan", "Vikram", "Aditya", "Rahul", "Dev"], last: ["Sharma", "Kapoor", "Mehta", "Iyer", "Reddy", "Malhotra", "Gill"] },
  // Not on the 2026 membership list, kept so older saves and hand-made databases still work.
  { key: "Spain", region: "EU", name: "Spain", code: "ESP", weight: 0, look: "latin", grass: ["bermuda", "bentgrass"], first: ["Álvaro", "Pablo", "Sergio", "Iker", "Mateo"], last: ["Ferrer", "Salazar", "Ortega", "Villanueva", "Castaño"] },
];

export const NATIONS: Readonly<Record<string, Nation>> = Object.fromEntries(NATION_LIST.map((n) => [n.key, n]));

const TOTAL_WEIGHT = NATION_LIST.reduce((s, n) => s + n.weight, 0);

/** A nationality drawn with tour weights, from one uniform number in [0, 1). */
export function nationFromRoll(u: number): Nation {
  let x = u * TOTAL_WEIGHT;
  for (const n of NATION_LIST) {
    x -= n.weight;
    if (x < 0) return n;
  }
  return NATION_LIST[0]!;
}

/** Everything the game shows about a nationality, including ones typed into the editor. */
export function nationInfo(key: string): { name: string; code: string; known: boolean } {
  const n = NATIONS[key];
  if (n) return { name: n.name, code: n.code, known: true };
  return { name: key, code: key.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "—", known: false };
}
