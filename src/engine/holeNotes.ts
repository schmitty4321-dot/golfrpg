/**
 * Hole names and descriptions for the illustrated courses, written to match
 * each hole's painting and the tour setup the game plays (par and yards from
 * the course data).
 */
export interface HoleNote {
  name: string;
  /** What the name means, when it's in another language. */
  meaning?: string;
  description: string;
}

export const HOLE_NOTES: Record<string, Record<number, HoleNote>> = {
  waialae: {
    1: { name: "Kipaku", meaning: "Drive Away", description: "A par 5 for members, a brutal 480-yard par 4 for the pros. A long, straight corridor between the palms runs to a shallow green guarded by a deep front bunker." },
    2: { name: "Kailani", meaning: "Sea and Sky", description: "From an elevated tee, a stream and lake run down the entire left side. Precision off the tee sets up a mid-iron into a generous green." },
    3: { name: "Imua", meaning: "Straight Ahead", description: "The lake pinches in tight on the left of the drive, so the play is a controlled fade. Bunkers sit short and left of the green." },
    4: { name: "Akau", meaning: "Right", description: "The first par 3 is long and demanding: a 204-yard shot to a narrow green ringed by six deep, penalizing bunkers." },
    5: { name: "Hema", meaning: "Left", description: "A long, straight par 4 that usually plays into the trade winds, with a canal running down the left. It tests long-iron accuracy into a green bunkered on both sides." },
    6: { name: "Pilikia", meaning: "Trouble", description: "A fairway framed tight by trees, with a bunker short and right of the green and water lurking beyond it. Anything long or left finds trouble." },
    7: { name: "Welo", meaning: "Float in the wind", description: "The shortest par 3 on the course. A creek tumbles down the left, deep bunkers guard the front, and the contoured green demands a precise short iron." },
    8: { name: "Alae", meaning: "Mud hen", description: "A long, straight par 4 with a stream running behind the trees on the left. Two bunkers on the right of the green catch anything that leaks away from the water." },
    9: { name: "Kilou", meaning: "Long Hook", description: "A classic risk-reward par 5 to close the front nine. It plays downwind, so a good drive past the fairway bunkers leaves a real chance to reach in two." },
    10: { name: "Mamao", meaning: "Distant", description: "A short, tactical par 4 under the great banyan trees. Lay back short of the fairway bunker, or challenge it for a wedge into a green bunkered left and right." },
    11: { name: "Oolea", meaning: "Unyielding", description: "A demanding par 3 with the ocean as its backdrop. Club selection changes wildly with the coastal wind, and bunkers wait on both sides of the green." },
    12: { name: "I'i", meaning: "Brown", description: "A tree-lined par 4 threaded between homes and banyans. A bunker on the left of the fairway catches the cautious drive; the green is guarded short and right." },
    13: { name: "Apiki", meaning: "Tricky", description: "A long par 4 that runs out through dry kiawe country with Diamond Head on the horizon. A fairway bunker guards the left side, and two more frame the green." },
    14: { name: "Auwai", meaning: "Two ditches", description: "The trade winds dictate strategy here. A pair of bunkers guards the left side of the fairway to catch over-aggressive drives, and the green is bunkered front and back." },
    15: { name: "Lalau", meaning: "Go astray", description: "A medium-length par 4 with a lava-rock lake hugging the entire right side. Approach from the left of the fairway to stay clear of the water and the greenside bunkers." },
    16: { name: "Upiki", meaning: "Trapped", description: "The ocean and black lava rock run all the way down the right. A string of bunkers lines the left, so the drive must be threaded between them to a green framed by palms." },
    17: { name: "Huluhulu", meaning: "Hairy", description: "A beautiful par 3 playing straight into the ocean breeze, with the beach right of the tee. A huge bunker guards the left of the tiered green and two more sit right." },
    18: { name: "Aloha", meaning: "Farewell / Greeting", description: "The grand finishing par 5 sweeps toward the clubhouse, with Diamond Head behind. Long hitters can reach in two to hunt for eagle, but bunkers guard the landing area and green." },
  },
  "tpc-scottsdale": {
    1: { name: "Sonoran Start", description: "A medium-length opener with a generous fairway. Most lay back with a fairway wood or long iron to stay short of the bunker on the left; one more bunker guards the right of the green." },
    2: { name: "Saguaro", description: "A longer par 4 that introduces the desert. A right-to-left drive avoids the fairway bunker on the right and sets up a mid-iron into an undulating green with sand on both sides." },
    3: { name: "Arroyo", description: "The first par 5. Long hitters can chase the green in two, but they must clear the fairway bunker on the left, with a dry desert wash waiting right." },
    4: { name: "Cholla", description: "A mid-length par 3 to a deep, contoured green with a bunker either side. Missing on the wrong side leaves a delicate up-and-down." },
    5: { name: "The Gauntlet", description: "A grueling par 4 that needs a long, straight drive. Bunkers on the right of the fairway and the green punish anything weak or leaking right." },
    6: { name: "Bunker Row", description: "Sand everywhere: a fairway bunker on the left, two on the right, and more clustered around the green. Only a straight drive leaves a clean look." },
    7: { name: "Mesquite", description: "The longest par 3 on the front nine: a long iron or hybrid over the desert scrub to a long, tiered green with bunkers left and right." },
    8: { name: "Dust Devil", description: "A massive, straight par 4, one of the toughest on the front side. A bunker on the left guards the drive, and par is a fine score when the afternoon wind picks up." },
    9: { name: "Turn for Home", description: "The front-nine finale. Bunkers on both sides of the fairway frame the landing area to swallow over-aggressive drives, and three more guard the green." },
    10: { name: "Ocotillo", description: "A strategic par 4 through the desert. Placing the drive between the bunkers on either side opens up the best look at a green that slopes hard from back to front." },
    11: { name: "Long Water", description: "The back nine's water begins. A long par 4 with a serene but dangerous lake running down the entire left side from tee to green." },
    12: { name: "Lakeside", description: "A beautiful par 3 with water framing the right of the green and two bunkers to the left. Tee shots must challenge the water to get close to a right-side pin." },
    13: { name: "Lake Bend", description: "A winding par 5 that bends around a lake on the right. Cut off as much water as you dare for a real chance at eagle; bunkers guard the green." },
    14: { name: "The Climb", description: "A brutal uphill par 4, the longest on the course. It takes a long iron or fairway wood into an elevated green guarded on both sides, with a bunker short and right." },
    15: { name: "The Island", description: "A volatile par 5 with an island green. It's reachable in two, but any misfired approach drops straight into the lake." },
    16: { name: "The Coliseum", description: "The most famous par 3 in golf. During tournament week it's completely enclosed by a 20,000-seat stadium. Only a short iron, but the noise makes it a daunting target." },
    17: { name: "Temptation", description: "A thrilling, drivable short par 4. Take dead aim at the green off the tee, but the lake hugs the left and wraps behind the green, and bunkers wait right." },
    18: { name: "The Cape", description: "A cape-style finishing hole. A big lake swallows the whole left side, so you decide how much water to cut off; a long bunker with grass islands guards the right." },
  },
  "pga-west-stadium": {
    1: { name: "Prelude", description: "" },
    2: { name: "Craters", description: "" },
    3: { name: "Eye of the Needle", description: "" },
    4: { name: "Sand Pit", description: "" },
    6: { name: "Amen", description: "" },
    7: { name: "Black Hole", description: "" },
    8: { name: "Camelback", description: "" },
    9: { name: "Reflection", description: "" },
    10: { name: "Quarry", description: "" },
    11: { name: "Eternity", description: "" },
    12: { name: "Water Work", description: "" },
    13: { name: "Second Thoughts", description: "" },
    14: { name: "Moat", description: "" },
    15: { name: "Turning Home", description: "" },
    5: { name: "Double Trouble", description: "True to its name, this par 5 demands navigation around water hugging the left side for most of the hole, before forcing players to deal with a second lake on the right as they approach the green." },
    16: { name: "San Andreas Fault", description: "A massive par 5 monster where the entire left side of the green is flanked by a notoriously deep, menacing bunker that drops nearly 19 to 20 feet below the putting surface." },
    17: { name: "Alcatraz", description: "The signature hole of PGA West. Inspired by the 17th at TPC Sawgrass, this terrifying island green is completely surrounded by water and jagged boulders." },
    18: { name: "Coliseum", description: "The brutal finishing hole features a dramatic amphitheater design. It requires a highly intimidating tee shot with water lining the entire left side all the way to a heavily guarded green." },
  },
  "innisbrook-copperhead": {
    1: { name: "Innisbrook's View", description: "A long par 5 that sweeps left between the pines. Bunkers pinch the landing area on both sides, and water waits right of a green ringed by sand." },
    2: { name: "Second Thoughts", description: "The fairway bends left around a lake that runs the whole right side. Anything leaking right is wet; the green is guarded by a bunker front-right." },
    3: { name: "Narrow Neck", description: "The fairway squeezes between two ponds in the landing area. Find the neck off the tee, then play to a green framed by bunkers." },
    4: { name: "Bunkered", description: "A par 3 to a green ringed by sand. Hit the putting surface or play from a bunker." },
    5: { name: "Longview", description: "A three-shot par 5 that starts beside a lake on the left. Fairway bunkers guard the second shot, and four bunkers surround the green." },
    6: { name: "Sidewinder", description: "A snaking fairway between the pines to a green with a bunker short and left." },
    7: { name: "Hidden Gem", description: "A tree-lined par 4 that drifts right to a green guarded by three bunkers." },
    8: { name: "Drop Off", description: "A long par 3 played down to a wide green, with bunkers short-left and short-right." },
    9: { name: "Hide Away", description: "A tight corridor of pines with a bunker in the middle of the landing area, and a green between two bunkers." },
    10: { name: "The Descent", description: "Downhill off the tee past a bunker on the left, to a green tucked between bunkers." },
    11: { name: "O's Alley", description: "A par 5 with a long sandy waste area down the right and water beyond it. The green is guarded by bunkers and the lake." },
    12: { name: "Bridge Hole", description: "The fairway ends at the water. A short approach crosses the pond to a green guarded by three bunkers; the players walk over the bridge." },
    13: { name: "Forced Carry", description: "All carry over a pond to a green with bunkers left, right and long." },
    14: { name: "Packard's Double Dogleg", description: "A par 5 that bends twice, with a pond right of the green to punish an aggressive second." },
    15: { name: "Snake Bite", description: "The first hole of the Snake Pit: a par 3 over water to a green with three bunkers." },
    16: { name: "Moccasin", description: "A demanding par 4 with a lake down the entire right side and bunkers either side of the green." },
    17: { name: "The Rattler", description: "A par 3 framed by pines, to a green surrounded by four bunkers." },
    18: { name: "The Copperhead", description: "The finishing par 4 runs uphill between bunkers on both sides of the fairway to a green guarded by sand." },
  },
};

export const holeNote = (courseId: string, hole: number): HoleNote | undefined => HOLE_NOTES[courseId]?.[hole];
