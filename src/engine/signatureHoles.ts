/**
 * Each course's signature holes (hole numbers): the ones the broadcast always shows in a
 * watched round, like the 16th at TPC Scottsdale or the 12th at Augusta. Courses without
 * a hole everyone knows are left out, and get their featured holes at random.
 */
export const SIGNATURE_HOLES: Readonly<Record<string, readonly number[]>> = {
  "augusta-national": [12, 13, 16],
  "tpc-sawgrass": [17, 18],
  "tpc-scottsdale": [16, 17],
  "pebble-beach": [7, 18],
  "pga-west-stadium": [16, 17],
  "torrey-pines-south": [3, 18],
  riviera: [6, 10],
  "pga-national-champion": [15, 17],
  "bay-hill": [6, 18],
  "innisbrook-copperhead": [16, 17],
  "harbour-town": [18],
  "doral-blue-monster": [18],
  "quail-hollow": [17, 18],
  "dunes-club": [13],
  colonial: [5],
  "muirfield-village": [12, 16],
  "shinnecock-hills": [7],
  "tpc-river-highlands": [15, 17],
  "tpc-deere-run": [16],
  corales: [18],
  "tpc-southwind": [11],
  "east-lake": [18],
  "port-royal": [16],
  waialae: [18],
  "grand-reserve": [3], // the 12th on the club card, nines swapped
  "memorial-park": [15, 17],
  "tpc-san-antonio-oaks": [16, 17],
  "tpc-louisiana": [18],
  aronimink: [17],
  "tpc-craig-ranch": [17], // Ranch17 stadium hole
  "osprey-valley-north": [14, 18], // 14: The Rink
  "renaissance-club": [3, 4, 5], // the dunes stretch, 12-14 at the Scottish Open
  "royal-birkdale": [12, 16, 17],
  "tpc-twin-cities": [18],
  "detroit-golf-club": [14, 15, 16], // Area 313
  bellerive: [6],
  "black-desert": [17],
  "vidanta-vallarta": [17],
  "barton-creek-fazio-canyons": [10, 18],
  "sea-island-seaside": [13, 18],
};

/** A course's signature holes as indexes (0-17). */
export const signatureIndexes = (courseId: string): number[] => (SIGNATURE_HOLES[courseId] ?? []).map((n) => n - 1);
