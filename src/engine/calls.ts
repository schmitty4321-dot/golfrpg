/**
 * Strategy calls for a hole played hole by hole: off the tee, going for a
 * par 5 in two, attacking a pin, and how hard to hit the putts. A call shifts
 * the hole's expected score, its spread and its blow-up risk, by how well it
 * suits the player and the hole. "His call" (no call) is the baseline the
 * simulation is calibrated on, so a round of no calls plays exactly like any
 * other round.
 */
import { TOUR_AVERAGE } from "./attributes";
import { realHoleOf } from "./tracer";
import { clamp } from "./rng";
import type { HoleMod } from "./round";
import { hasTrait, traitReachBonus } from "./traits";
import { equipmentReach } from "./equipment";
import type { Course, Hole, Player } from "./types";

export type TeeCall = "driver" | "3-wood" | "iron";
export type SecondCall = "go" | "layup";
export type ApproachCall = "attack" | "middle";
export type PuttCall = "charge" | "lag";

export interface HoleCall {
  tee?: TeeCall;
  second?: SecondCall;
  approach?: ApproachCall;
  putt?: PuttCall;
  /** Into the wind: hit it full, or knock it down. */
  wind?: "full" | "knockdown";
  /** Water short of the green: take it on, or play to the bail-out. */
  carry?: "carry" | "bailout";
  /** If he misses the fairway: the hero shot, or punch out. */
  trouble?: "hero" | "punch";
  /** Firm greens: fly it to the flag, or land it short and let it run. */
  firm?: "fly" | "run";
  /** Rain: his normal swing, or grip down and swing smooth (holds for the round). */
  rain?: "normal" | "smooth";
  /** After a big number: let him fire back, or slow him down. */
  temper?: "fire" | "calm";
  /** Watching the leaderboard, or playing blind to it (holds for the round). */
  board?: "look" | "blind";
  /** A par 5 lay-up: as close as he can, or his favourite full-wedge yardage. */
  layup?: "close" | "wedge";
  /** He and his caddie disagree: back him, or back the caddie. */
  trust?: "player" | "caddie";
  /** Fairway bunkers at his driving distance: carry them, or lay up short of them. */
  bunkerCarry?: "carry" | "short";
  /** A sharp dogleg: cut the corner, or play to the bend. */
  dogleg?: "cut" | "bend";
  /** A short par 3: chase the flag, or the fat side of the green. */
  chase?: "flag" | "fat";
  /** A long par 3: fire at the green, or play short for a chip. */
  longThree?: "fire" | "short";
  /** The course's hardest hole: take it on, or play for par. */
  hardest?: "attack" | "par";
  /** The course's scoring hole: press for birdie, or take what it gives. */
  scoring?: "press" | "take";
  /** Lightning greens: die the putts at the hole, or hit them firm (holds for the round). */
  speed?: "die" | "firm";
  /** Running on empty late in the week: dig deep, or conserve. */
  energy?: "dig" | "conserve";
}

/**
 * Holes whose picture shows no bend, checked by eye against the illustration. The course map's
 * line can read a bend that isn't there (TPC Scottsdale 10 reads 48°), so these never ask about a dogleg.
 */
const STRAIGHT_HOLES = new Set(["tpc-scottsdale:6", "tpc-scottsdale:10", "tpc-scottsdale:14", "waialae:8", "waialae:13", "waialae:14", "waialae:15", "waialae:16", "waialae:18", "torrey-pines-south:6", "pebble-beach:1"]);

/**
 * Holes with water beside the line of play but none short of the green, checked by eye. These never
 * ask about water short of the green.
 */
const WATER_ALONGSIDE = new Set(["tpc-scottsdale:11", "waialae:2"]);

/**
 * What the real course map says about a hole. `known` is false for a hole without a map, and then the
 * map-based questions keep their stat-based rules. `water` and `guardedGreen` gate the carry and
 * guarded-green questions: a hole with no water short of the green, or no bunker beside it, doesn't ask.
 */
export interface HoleFindings {
  /** Fairway bunkers at his driving distance. */
  bunkersAtDrive: number;
  /** How sharply the line of play bends, in degrees. */
  dogleg: number;
  known: boolean;
  water: boolean;
  guardedGreen: boolean;
}

export function holeFindings(course: Course, hole: Hole): HoleFindings {
  const real = realHoleOf(course.id, hole.number);
  if (!real) return { bunkersAtDrive: 0, dogleg: 0, known: false, water: false, guardedGreen: false };
  const [gx = 0, gy = 0, gr = 0] = real.green;
  // A bunker whose edge is within 30 yards of the green's edge guards it.
  const guardedGreen = real.bunkers.some(([x = 0, y = 0, r = 0]) => Math.hypot(x - gx, y - gy) - r - gr <= 30);
  const water = real.water.length > 0 && !WATER_ALONGSIDE.has(`${course.id}:${hole.number}`);
  if (hole.par === 3) return { bunkersAtDrive: 0, dogleg: 0, known: true, water, guardedGreen };
  // A bunker that reaches within 25 yards of the line, 245-325 yards out.
  const bunkersAtDrive = real.bunkers.filter((b) => {
    const [x = 0, y = 0, r = 0] = b;
    return y >= 245 && y <= 325 && Math.abs(x) - r <= 25;
  }).length;
  const p = real.path;
  let dogleg = 0;
  if (p.length >= 3) {
    const at = (i: number): [number, number] => [p[i]?.[0] ?? 0, p[i]?.[1] ?? 0];
    const [p0, p1, p2] = [at(0), at(1), at(2)];
    const a = Math.atan2(p1[0] - p0[0], p1[1] - p0[1]);
    const b = Math.atan2(p2[0] - p1[0], p2[1] - p1[1]);
    dogleg = Math.abs((((b - a) * 180) / Math.PI + 540) % 360 - 180);
  }
  if (STRAIGHT_HOLES.has(`${course.id}:${hole.number}`)) dogleg = 0;
  return { bunkersAtDrive, dogleg, known: true, water, guardedGreen };
}

/** The course's hardest and easiest holes against par, from the real tour's scoring (when most holes have it). */
function ratedHoles(course: Course): { hardest: Hole | null; easiest: Hole | null } {
  const rated = course.holes.filter((h) => h.tourAverage !== undefined);
  if (rated.length < 12) return { hardest: null, easiest: null };
  const diff = (h: Hole) => h.tourAverage! - h.par;
  const sorted = [...rated].sort((x, y) => diff(y) - diff(x));
  return { hardest: diff(sorted[0]!) >= 0.2 ? sorted[0]! : null, easiest: diff(sorted[sorted.length - 1]!) <= -0.15 ? sorted[sorted.length - 1]! : null };
}

/** Calls that, once made, hold for the rest of the round and aren't asked again. */
export const STANDING_KINDS: CallKind[] = ["putt", "rain", "board", "speed"];

/** Which questions win when a hole raises more than a few (situations first, then the big shots). */
const PRIORITY: CallKind[] = ["temper", "energy", "board", "putt", "speed", "carry", "second", "bunkerCarry", "dogleg", "tee", "longThree", "chase", "wind", "approach", "hardest", "scoring", "trouble", "layup", "firm", "rain", "trust"];

/** The few questions worth asking on one hole (at most `n`), in priority order. */
export function topDecisions(list: Decision[], n = 3): Decision[] {
  return [...list].sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind)).slice(0, n);
}

export type CallKind = keyof HoleCall;

export interface Decision {
  kind: CallKind;
  question: string;
  options: { value: string; label: string; blurb: string }[];
}

/** Where the round stands when a hole is about to be played. */
export interface HoleSituation {
  round: number;
  /** 0-based hole index. */
  index: number;
  /** Shots behind the leader (negative: leading by), counting the holes played today. */
  behind: number;
  /** Shots inside (+) or outside (-) the projected cut, in round 2. */
  cutMargin: number | null;
  /** Today's wind for him, mph. */
  wind?: number;
  /** Raining today. */
  rain?: boolean;
  /** Strokes over par on his last hole (0 if par or better). */
  lastOverPar?: number;
  /** His condition today, 0-100. */
  condition?: number;
}

/** Yards the player can reach in two on a par 5 (drive plus a long second). */
export const reachInTwo = (p: Player): number => 300 + (p.attributes.drivingDistance - TOUR_AVERAGE) * 6 + 245 + (p.attributes.longIrons - TOUR_AVERAGE) * 4 + traitReachBonus(p) + equipmentReach(p);

/** The calls worth making on this hole: key moments only; on other holes he plays his own game. */
export function decisionsFor(hole: Hole, course: Course, player: Player, s: HoleSituation): Decision[] {
  const out: Decision[] = [];
  const fw = hole.fairwayWidth || 30;
  const found = holeFindings(course, hole);
  if (hole.par > 3 && (hole.hazard >= 0.25 || fw <= 27 || (hole.par === 4 && hole.yards <= 360))) {
    out.push({
      kind: "tee",
      question: hole.par === 4 && hole.yards <= 360 ? "Short par 4: how aggressive off the tee?" : "Trouble off the tee: what does he hit?",
      options: [
        { value: "driver", label: "Driver", blurb: "Distance; brings the trouble into play." },
        { value: "3-wood", label: "3-wood", blurb: "Gives up 20 yards for more fairways." },
        { value: "iron", label: "Long iron", blurb: "Safe, but a much longer approach." },
      ],
    });
  }
  if (hole.par === 5 && hole.yards <= reachInTwo(player) + 15) {
    out.push({
      kind: "second",
      question: "Par 5 he can reach: go for it in two?",
      options: [
        { value: "go", label: "Go for it", blurb: "Eagle chance, but misses cost more." },
        { value: "layup", label: "Lay up", blurb: "A full wedge in; a solid birdie chance." },
      ],
    });
  }
  // A guarded green needs a bunker beside it on the map, where there is one.
  if (((hole.hazard >= 0.3 && hole.hazard < 0.45) || hole.bunkers >= 3 || (hole.par === 3 && hole.hazard >= 0.2 && hole.hazard < 0.45)) && (!found.known || found.guardedGreen)) {
    out.push({
      kind: "approach",
      question: "A guarded green: where does he aim?",
      options: [
        { value: "attack", label: "Attack the pin", blurb: "Closer birdie looks, more short-sided misses." },
        { value: "middle", label: "Middle of the green", blurb: "Fewer big numbers, longer putts." },
      ],
    });
  }
  // Water short of the green needs water on the map, where there is a map.
  if (hole.hazard >= 0.45 && (!found.known || found.water)) {
    out.push({
      kind: "carry",
      question: "Water short of the green: does he take it on?",
      options: [
        { value: "carry", label: "Take it on", blurb: "Flag at the pin; anything short is wet." },
        { value: "bailout", label: "Play to the bail-out", blurb: "Dry, but a long way from the hole." },
      ],
    });
  }
  if ((s.wind ?? 0) >= 13 && hole.exposure >= 0.45) {
    out.push({
      kind: "wind",
      question: "Into a stiff wind: how does he flight it?",
      options: [
        { value: "full", label: "Hit it full", blurb: "More club, full swing; the wind exaggerates any miss." },
        { value: "knockdown", label: "Knock it down", blurb: "Low and controlled; harder to get close." },
      ],
    });
  }
  if (hole.par > 3 && fw <= 28 && hole.hazard < 0.25) {
    out.push({
      kind: "trouble",
      question: "Tight, tree-lined hole: if he misses the fairway?",
      options: [
        { value: "hero", label: "Go for the hero shot", blurb: "Thread it at the green; sometimes it's a disaster." },
        { value: "punch", label: "Punch out", blurb: "Back to the fairway; bogey at worst." },
      ],
    });
  }
  if (course.firmness >= 0.6 && !s.rain && hole.par > 3 && hole.bunkers <= 2) {
    out.push({
      kind: "firm",
      question: "Firm, fast greens: how does he bring it in?",
      options: [
        { value: "fly", label: "Fly it to the flag", blurb: "Spin it on landing, if he can." },
        { value: "run", label: "Land it short, let it run", blurb: "Safer, but hard to judge the release." },
      ],
    });
  }
  if (s.rain && hole.par > 3) {
    out.push({
      kind: "rain",
      question: "Steady rain: how does he swing it today?",
      options: [
        { value: "normal", label: "His normal swing", blurb: "Full speed; slippery grips cause the odd wild one." },
        { value: "smooth", label: "Grip down, swing smooth", blurb: "Shorter but in play, for the rest of the round." },
      ],
    });
  }
  if ((s.lastOverPar ?? 0) >= 2) {
    out.push({
      kind: "temper",
      question: "He just made a big number. What's the message?",
      options: [
        { value: "fire", label: "Get it back now", blurb: "Attack the next one; anger can work, or spiral." },
        { value: "calm", label: "Slow him down", blurb: "Breathe, reset, fairway and green." },
      ],
    });
  }
  if ((s.round >= 3 && s.index >= 9 && s.behind <= 4) || (s.round === 2 && s.index >= 9 && s.cutMargin !== null && Math.abs(s.cutMargin) <= 2)) {
    out.push({
      kind: "board",
      question: "Does he look at the leaderboard?",
      options: [
        { value: "look", label: "Know where he stands", blurb: "Plays the number; some players tighten up." },
        { value: "blind", label: "Don't look", blurb: "One shot at a time, for the rest of the round." },
      ],
    });
  }
  if (hole.par === 5 && hole.yards > reachInTwo(player) + 15) {
    out.push({
      kind: "layup",
      question: "Laying up: where to?",
      options: [
        { value: "close", label: "As close as he can", blurb: "A short pitch in; awkward half shots." },
        { value: "wedge", label: "His full-wedge number", blurb: "Further back, but a stock swing." },
      ],
    });
  }
  // He and the caddie see a hole differently now and then.
  if ((hole.number * 7 + s.round * 3) % 11 === 0) {
    out.push({
      kind: "trust",
      question: "He and the caddie disagree on the play. Who do you back?",
      options: [
        { value: "player", label: "Back him", blurb: "His instinct, his commitment." },
        { value: "caddie", label: "Back the caddie", blurb: "The cooler head and the yardage book." },
      ],
    });
  }
  const closing = s.index >= course.holes.length - 3;
  const inContention = s.round >= 3 && s.behind <= 3;
  const onTheCut = s.round === 2 && s.cutMargin !== null && Math.abs(s.cutMargin) <= 1;
  if (closing && (inContention || onTheCut)) {
    out.push({
      kind: "putt",
      question: "Closing holes: how does he play the putts?",
      options: [
        { value: "charge", label: "Charge them", blurb: "More holed, more three-putts." },
        { value: "lag", label: "Lag them", blurb: "Two-putt pars; fewer birdies." },
      ],
    });
  }
  // What the course map and the tour's numbers say about this hole.
  if (found.bunkersAtDrive >= 1) {
    out.push({
      kind: "bunkerCarry",
      question: `Fairway bunker${found.bunkersAtDrive > 1 ? "s" : ""} at his driving distance: carry ${found.bunkersAtDrive > 1 ? "them" : "it"} or lay short?`,
      options: [
        { value: "carry", label: "Carry them", blurb: "Driver over the sand; a short approach if it works." },
        { value: "short", label: "Lay short", blurb: "A club less; dry sand-free fairway, a longer shot in." },
      ],
    });
  }
  if (found.dogleg >= 25) {
    out.push({
      kind: "dogleg",
      question: "A sharp dogleg: cut the corner or play to the bend?",
      options: [
        { value: "cut", label: "Cut the corner", blurb: "Shape it over the trees; a wedge in, or a lost ball." },
        { value: "bend", label: "Play to the bend", blurb: "The safe line; a mid-iron in." },
      ],
    });
  }
  if (hole.par === 3 && hole.yards <= 165) {
    out.push({
      kind: "chase",
      question: "A wedge in his hand on a short par 3: does he chase the flag?",
      options: [
        { value: "flag", label: "Chase the flag", blurb: "All over it; short-sided when he misses." },
        { value: "fat", label: "The fat side", blurb: "Twenty feet, two putts, on to the next." },
      ],
    });
  }
  if (hole.par === 3 && hole.yards >= 215) {
    out.push({
      kind: "longThree",
      question: "A long par 3: fire at the green or play short for a chip?",
      options: [
        { value: "fire", label: "Fire at the green", blurb: "Hybrid or long iron at it; the misses are long and wrong." },
        { value: "short", label: "Play short, chip on", blurb: "Lean on the short game for par." },
      ],
    });
  }
  const rated = ratedHoles(course);
  if (rated.hardest === hole) {
    out.push({
      kind: "hardest",
      question: `The course's hardest hole (the tour averages ${hole.tourAverage!.toFixed(2)}): take it on or play for par?`,
      options: [
        { value: "attack", label: "Take it on", blurb: "A birdie here is worth two anywhere else." },
        { value: "par", label: "Play for par", blurb: "Fairway, green, two putts and move on." },
      ],
    });
  }
  if (rated.easiest === hole) {
    out.push({
      kind: "scoring",
      question: `The scoring hole (the tour averages ${hole.tourAverage!.toFixed(2)}): press for birdie or take what it gives?`,
      options: [
        { value: "press", label: "Press for birdie", blurb: "Everyone's making birdie; he can't afford par." },
        { value: "take", label: "Take what it gives", blurb: "A birdie look without forcing it." },
      ],
    });
  }
  if (course.greenSpeed >= 12.5) {
    out.push({
      kind: "speed",
      question: `Lightning greens (${course.greenSpeed.toFixed(1)} on the stimp): how does he putt them today?`,
      options: [
        { value: "firm", label: "Hit them firm", blurb: "Takes the break out; the misses run past." },
        { value: "die", label: "Die them at the hole", blurb: "Tap-ins on the misses; a few come up short." },
      ],
    });
  }
  if ((s.condition ?? 100) < 60 && s.round >= 3 && s.index >= 11) {
    out.push({
      kind: "energy",
      question: `He's running on empty (${Math.round(s.condition!)}% condition): dig deep or conserve?`,
      options: [
        { value: "dig", label: "Dig deep", blurb: "Everything he has left on every shot." },
        { value: "conserve", label: "Conserve", blurb: "Simple shots, no heroics, get it in." },
      ],
    });
  }
  return out;
}

/** What a set of calls does to the hole, for this player. `tuck` (0-1) is how tucked today's pin is. */
export function callEffect(call: HoleCall | null | undefined, hole: Hole, player: Player, tuck = 0.5, cond: { wind?: number; firmness?: number; findings?: { bunkersAtDrive: number; dogleg: number } } = {}): HoleMod {
  const mod: HoleMod = { mean: 0, sd: 1, blowup: 1 };
  if (!call) return mod;
  const a = player.attributes;
  const d = (k: keyof typeof a) => a[k] - TOUR_AVERAGE;
  const fw = hole.fairwayWidth || 30;
  const tight = clamp((30 - fw) / 10, 0, 1);

  // Every call is a trade the hole, the day and his game decide: the bold
  // option pays for a player with the skills for it on a hole that allows it,
  // and costs one without them where it doesn't. "His call" is the baseline.
  if (call.tee && call.tee !== "driver" && hole.par > 3) {
    // Laying back costs distance (more for long hitters and long holes) and saves trouble (more for wild drivers, on tight or hazard-lined holes).
    const lost = 0.08 + Math.max(0, hole.yards - 400) / 1500 + d("drivingDistance") * 0.012;
    const saved = (0.5 * hole.hazard + 0.4 * tight) * (0.35 - d("drivingAccuracy") * 0.04 + d("fairwayWoods") * 0.01);
    const tee: HoleMod =
      call.tee === "3-wood"
        ? { mean: lost - saved, blowup: 0.65, sd: 0.95 }
        : { mean: 2.2 * lost - 1.6 * saved - (hasTrait(player, "stinger") ? 0.06 : 0), blowup: 0.4, sd: 0.9 };
    // A driver addict pulls driver anyway half the time.
    const k = hasTrait(player, "driver-addict") ? 0.5 : 1;
    mod.mean += tee.mean * k;
    mod.blowup *= Math.pow(tee.blowup, k);
    mod.sd *= Math.pow(tee.sd, k);
  }
  if (call.second && hole.par === 5) {
    if (call.second === "go") {
      // Eagles and birdies for the long hitter; the trouble shows up as big numbers on a hazard-lined hole.
      mod.mean += -0.12 - d("longIrons") * 0.025 - d("fairwayWoods") * 0.012 - (hasTrait(player, "rescue-merchant") ? 0.04 : 0);
      mod.sd *= 1.15;
      mod.blowup *= (1 + hole.hazard * 2.5) * (hasTrait(player, "rescue-merchant") ? 0.8 : 1) * (hasTrait(player, "long-iron-artist") ? 0.8 : 1);
    } else {
      // Laying up is the play where the trouble is, and for a wedge player.
      mod.mean += 0.08 - hole.hazard * 0.12 - d("wedges") * 0.012;
      mod.sd *= 0.9;
      mod.blowup *= 0.55;
    }
  }
  if (call.approach) {
    if (call.approach === "attack") {
      // Going at a tucked pin brings the edge of the green, and what's beyond it, into play; an open pin is there to be attacked.
      // The pin always gives more birdie looks; a tucked one behind trouble pays for them in big numbers.
      mod.mean += -0.1 - (d("midIrons") + d("wedges") + d("distanceControl")) * 0.008 + hole.hazard * 0.02;
      mod.sd *= 1.2;
      mod.blowup *= (1 + hole.hazard * 2.2 + hole.bunkers * 0.06) * (0.6 + tuck);
    } else {
      // The middle always means fewer big numbers; it costs birdies, less of a price the more tucked the pin (the one shot that doesn't chase it).
      mod.mean += 0.04 - tuck * 0.03 - hole.hazard * 0.03 - d("courseManagement") * 0.006;
      mod.sd *= 0.88;
      mod.blowup *= 0.65 - hole.hazard * 0.1;
    }
  }
  if (call.putt) {
    if (call.putt === "charge") {
      mod.mean += -0.02 - (d("shortPutts") + d("greenReading")) * 0.008 - (hasTrait(player, "long-range-sniper") ? 0.03 : 0);
      mod.sd *= 1.15;
      mod.blowup *= 1.1;
    } else {
      mod.mean += 0.01 - d("lagPutting") * 0.008;
      mod.sd *= 0.85;
      mod.blowup *= 0.85;
    }
  }
  const shift = (m: HoleMod) => {
    mod.mean += m.mean;
    mod.sd *= m.sd;
    mod.blowup *= m.blowup;
  };
  const wind = clamp(((cond.wind ?? 15) - 10) / 15, 0, 1);
  const firm = (cond.firmness ?? 0.6) - 0.6;
  // A stiff wind punishes the full swing and rewards the knock-down; a breeze is the other way round.
  if (call.wind === "full") shift({ mean: -0.06 - d("windTolerance") * 0.035 + wind * 0.04, sd: 1 + 0.2 * wind, blowup: 1 + 0.6 * wind * hole.exposure });
  if (call.wind === "knockdown") shift({ mean: 0.02 - d("trajectoryControl") * 0.035 - wind * 0.07, sd: 0.88, blowup: 0.75 });
  // Water short: the carry pays for a precise iron player, the bail-out when the hazard is real.
  if (call.carry === "carry") shift({ mean: -0.12 - (d("midIrons") + d("distanceControl")) * 0.01 + hole.hazard * 0.05, sd: 1.12, blowup: 1 + hole.hazard * 2 });
  if (call.carry === "bailout") shift({ mean: 0.1 - d("chipping") * 0.012 - hole.hazard * 0.1, sd: 0.88, blowup: 0.45 });
  // Trees: the hero shot for a shot-maker on an open hole, the punch-out where it's tight.
  if (call.trouble === "hero") shift({ mean: -0.07 - (d("creativity") + d("shotShaping")) * 0.012 + tight * 0.03, sd: 1.1, blowup: 1.5 + tight * 0.8 });
  if (call.trouble === "punch") shift({ mean: 0.05 - d("courseManagement") * 0.01 - tight * 0.08, sd: 0.92, blowup: 0.6 });
  // Firm greens: the firmer they are, the more running it in beats flying it; a shot-maker runs it in better, a wedge player flies it better.
  if (call.firm === "fly") shift({ mean: -0.04 - d("wedges") * 0.015 + firm * 0.6, sd: 1.1, blowup: 1.15 });
  if (call.firm === "run") shift({ mean: 0.02 - (d("creativity") + d("trajectoryControl")) * 0.015 - firm * 0.6, sd: 0.92, blowup: 0.85 });
  // Rain: the power player keeps swinging; the straight hitter grips down.
  if (call.rain === "normal") shift({ mean: -0.03 - d("drivingDistance") * 0.008, sd: 1.1, blowup: 1.3 });
  if (call.rain === "smooth") shift({ mean: 0.02 - d("drivingAccuracy") * 0.008 - d("composure") * 0.004, sd: 0.92, blowup: 0.75 });
  // After a big number: fire up the aggressive, calm the composed; a hothead told to get it back loses his head.
  if (call.temper === "fire") shift({ mean: -0.06 - d("aggression") * 0.012 + (hasTrait(player, "hothead") ? 0.15 : 0), sd: 1.18, blowup: 1.35 });
  if (call.temper === "calm") shift({ mean: -0.04 - d("composure") * 0.012, sd: 0.9, blowup: 0.75 });
  // The leaderboard: knowing where he stands lifts the composed and rattles the nervy.
  if (call.board === "look") shift({ mean: 0.02 - (d("composure") + d("sundayNerves")) * 0.012 - (hasTrait(player, "clutch-gene") ? 0.06 : 0), sd: 1.04, blowup: 1.05 });
  if (call.board === "blind") shift({ mean: 0.01 - d("focus") * 0.01, sd: 0.95, blowup: 0.9 });
  // Laying up: a strong pitcher gets it close and scores from there; everyone else wants his full-wedge number.
  if (call.layup === "close") shift({ mean: -0.02 - d("pitching") * 0.03, sd: 1.06, blowup: 1.15 });
  if (call.layup === "wedge") shift({ mean: -0.03 - d("wedges") * 0.015, sd: 0.94, blowup: 0.88 });
  // Backing him pays when he reads a course well (and the caddie adds little); backing the caddie, when he listens.
  if (call.trust === "player") shift({ mean: 0.03 - (d("courseManagement") + d("greenReading")) * 0.025, sd: 1.03, blowup: 1 });
  if (call.trust === "caddie") shift({ mean: -0.02 - d("coachability") * 0.015 + (d("courseManagement") + d("greenReading")) * 0.008, sd: 0.96, blowup: 0.9 });
  // Fairway bunkers: the long hitter carries them; the wild one finds them.
  const sand = cond.findings?.bunkersAtDrive ?? 1;
  if (call.bunkerCarry === "carry") shift({ mean: -0.06 - d("drivingDistance") * 0.02 + sand * 0.02, sd: 1.1, blowup: Math.max(0.5, (1 + 0.3 * sand) * (1 - d("drivingAccuracy") * 0.05)) });
  if (call.bunkerCarry === "short") shift({ mean: 0.01 - d("fairwayWoods") * 0.01 - d("midIrons") * 0.008 - sand * 0.01, sd: 0.92, blowup: 0.6 });
  // A dogleg: the shot-maker cuts it; the sharper the bend, the more it asks.
  const bend = clamp(((cond.findings?.dogleg ?? 30) - 25) / 40, 0, 1);
  if (call.dogleg === "cut") shift({ mean: -0.07 - (d("shotShaping") + d("drivingDistance")) * 0.012 + bend * 0.05, sd: 1.1, blowup: 1.3 + bend * 0.5 + tight * 0.4 });
  if (call.dogleg === "bend") shift({ mean: -d("courseManagement") * 0.012 - bend * 0.03, sd: 0.93, blowup: 0.7 });
  // A wedge on a short par 3: the precise player chases; a tucked pin punishes the chase.
  if (call.chase === "flag") shift({ mean: -0.08 - (d("wedges") + d("distanceControl")) * 0.015 + (tuck - 0.5) * 0.04, sd: 1.15, blowup: (1 + hole.hazard * 1.5 + hole.bunkers * 0.1) * (0.7 + tuck) });
  if (call.chase === "fat") shift({ mean: -0.01 - tuck * 0.03 - d("lagPutting") * 0.012, sd: 0.9, blowup: 0.6 });
  // A long par 3: the long-iron player fires; the chipper plays short.
  if (call.longThree === "fire") shift({ mean: -0.05 - (d("longIrons") + d("fairwayWoods")) * 0.015, sd: 1.12, blowup: 1.2 + hole.hazard * 0.8 });
  if (call.longThree === "short") shift({ mean: 0.02 - d("chipping") * 0.02 - hole.hazard * 0.06, sd: 0.9, blowup: 0.55 });
  // The hardest hole: the straight, aggressive player takes it on; the course manager plays for par.
  if (call.hardest === "attack") shift({ mean: -0.05 - d("aggression") * 0.006 - (d("midIrons") + d("drivingAccuracy")) * 0.01, sd: 1.15, blowup: 1.35 });
  if (call.hardest === "par") shift({ mean: 0.02 - d("courseManagement") * 0.018, sd: 0.88, blowup: 0.6 });
  // The scoring hole: the wedge-and-putter player presses.
  if (call.scoring === "press") shift({ mean: -0.06 - (d("wedges") + d("shortPutts")) * 0.015, sd: 1.12, blowup: 1.25 });
  if (call.scoring === "take") shift({ mean: -0.01 - d("courseManagement") * 0.01, sd: 0.9, blowup: 0.7 });
  // Fast greens: the speed player dies them; the holer hits them firm.
  if (call.speed === "die") shift({ mean: -(d("speedControl") + d("lagPutting")) * 0.012 + d("shortPutts") * 0.004, sd: 0.92, blowup: 0.85 });
  if (call.speed === "firm") shift({ mean: -d("shortPutts") * 0.015 + d("speedControl") * 0.004, sd: 1.1, blowup: 1.15 });
  // Running on empty: stamina digs deep; the composed conserve. The emptier he is, the more it matters.
  const empty = Math.max(0, 60 - player.condition);
  if (call.energy === "dig") shift({ mean: -0.02 - d("stamina") * 0.025 + empty * 0.005, sd: 1.1, blowup: 1.25 });
  if (call.energy === "conserve") shift({ mean: 0.02 - d("composure") * 0.012 - empty * 0.003, sd: 0.9, blowup: 0.7 });
  // A stubborn player ignores a quarter of your calls and commits harder to the rest.
  if (hasTrait(player, "stubborn")) {
    const k = 0.825;
    return { mean: mod.mean * k, sd: Math.pow(mod.sd, k), blowup: Math.pow(mod.blowup, k) };
  }
  return mod;
}
