/**
 * Strategy calls for a hole played hole by hole: off the tee, going for a
 * par 5 in two, attacking a pin, and how hard to hit the putts. A call shifts
 * the hole's expected score, its spread and its blow-up risk, by how well it
 * suits the player and the hole. "His call" (no call) is the baseline the
 * simulation is calibrated on, so a round of no calls plays exactly like any
 * other round.
 */
import { TOUR_AVERAGE } from "./attributes";
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
  /** Just off the green: flop it, bump it, or putt it. */
  around?: "flop" | "bump" | "putt";
  /** He and his caddie disagree: back him, or back the caddie. */
  trust?: "player" | "caddie";
}

/** Calls that, once made, hold for the rest of the round and aren't asked again. */
export const STANDING_KINDS: CallKind[] = ["putt", "rain", "board"];

/** Which questions win when a hole raises more than a few (situations first, then the big shots). */
const PRIORITY: CallKind[] = ["temper", "board", "putt", "carry", "second", "tee", "wind", "approach", "trouble", "layup", "around", "firm", "rain", "trust"];

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
}

/** Yards the player can reach in two on a par 5 (drive plus a long second). */
export const reachInTwo = (p: Player): number => 300 + (p.attributes.drivingDistance - TOUR_AVERAGE) * 6 + 245 + (p.attributes.longIrons - TOUR_AVERAGE) * 4 + traitReachBonus(p) + equipmentReach(p);

/** The calls worth making on this hole: key moments only; on other holes he plays his own game. */
export function decisionsFor(hole: Hole, course: Course, player: Player, s: HoleSituation): Decision[] {
  const out: Decision[] = [];
  const fw = hole.fairwayWidth || 30;
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
  if ((hole.hazard >= 0.3 && hole.hazard < 0.45) || hole.bunkers >= 3 || (hole.par === 3 && hole.hazard >= 0.2 && hole.hazard < 0.45)) {
    out.push({
      kind: "approach",
      question: "A guarded green: where does he aim?",
      options: [
        { value: "attack", label: "Attack the pin", blurb: "Closer birdie looks, more short-sided misses." },
        { value: "middle", label: "Middle of the green", blurb: "Fewer big numbers, longer putts." },
      ],
    });
  }
  if (hole.hazard >= 0.45) {
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
  if (hole.par === 4 && hole.bunkers >= 2 && hole.hazard < 0.3 && hole.yards >= 430) {
    out.push({
      kind: "around",
      question: "If he misses the green: what's his go-to?",
      options: [
        { value: "flop", label: "Flop it", blurb: "High and soft, close or a disaster." },
        { value: "bump", label: "Bump and run", blurb: "Low and simple." },
        { value: "putt", label: "Putt it", blurb: "Hard to make a mess; hard to hole." },
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
  return out;
}

/** What a set of calls does to the hole, for this player. `tuck` (0-1) is how tucked today's pin is. */
export function callEffect(call: HoleCall | null | undefined, hole: Hole, player: Player, tuck = 0.5, cond: { wind?: number; firmness?: number } = {}): HoleMod {
  const mod: HoleMod = { mean: 0, sd: 1, blowup: 1 };
  if (!call) return mod;
  const a = player.attributes;
  const d = (k: keyof typeof a) => a[k] - TOUR_AVERAGE;
  const fw = hole.fairwayWidth || 30;
  const tight = clamp((30 - fw) / 10, 0, 1);

  if (call.tee && call.tee !== "driver" && hole.par > 3) {
    // Laying back costs distance (more for long hitters and long holes) and saves trouble (more for wild drivers).
    const lost = 0.05 + Math.max(0, hole.yards - 400) / 2500 + d("drivingDistance") * 0.006;
    const saved = (0.4 * hole.hazard + 0.3 * tight) * (0.25 - d("drivingAccuracy") * 0.02 + d("fairwayWoods") * 0.005);
    const tee: HoleMod =
      call.tee === "3-wood"
        ? { mean: lost - saved, blowup: 0.75, sd: 0.96 }
        : { mean: 2.2 * lost - 1.6 * saved - (hasTrait(player, "stinger") ? 0.03 : 0), blowup: 0.5, sd: 0.92 };
    // A driver addict pulls driver anyway half the time.
    const k = hasTrait(player, "driver-addict") ? 0.5 : 1;
    mod.mean += tee.mean * k;
    mod.blowup *= Math.pow(tee.blowup, k);
    mod.sd *= Math.pow(tee.sd, k);
  }
  if (call.second && hole.par === 5) {
    if (call.second === "go") {
      // More eagles and birdies; the trouble shows up as big numbers, not a worse average.
      mod.mean += -0.07 - d("longIrons") * 0.01 - d("fairwayWoods") * 0.005 - (hasTrait(player, "rescue-merchant") ? 0.02 : 0);
      mod.sd *= 1.12;
      mod.blowup *= (1 + hole.hazard * 2) * (hasTrait(player, "rescue-merchant") ? 0.85 : 1) * (hasTrait(player, "long-iron-artist") ? 0.85 : 1);
    } else {
      mod.mean += 0.05 - d("wedges") * 0.004;
      mod.sd *= 0.9;
      mod.blowup *= 0.6;
    }
  }
  if (call.approach) {
    if (call.approach === "attack") {
      // Going at a tucked pin brings the edge of the green, and what's beyond it, into play.
      mod.mean += -0.06 - (d("midIrons") + d("wedges") + d("distanceControl")) * 0.002 + (tuck - 0.5) * 0.04;
      // Tuned with the hole-to-hole luck (HOLE_SD): attacking keeps its extra misses.
      mod.sd *= 1.17;
      mod.blowup *= (1 + hole.hazard * 1.5 + hole.bunkers * 0.05) * (1 + (tuck - 0.5) * 0.6);
    } else {
      mod.mean += 0.04 - (tuck - 0.5) * 0.03;
      mod.sd *= 0.9;
      mod.blowup *= 0.7;
    }
  }
  if (call.putt) {
    if (call.putt === "charge") {
      mod.mean += -0.005 - (d("shortPutts") + d("greenReading")) * 0.002 - (hasTrait(player, "long-range-sniper") ? 0.012 : 0);
      mod.sd *= 1.12;
    } else {
      mod.mean += 0.01 - d("lagPutting") * 0.002;
      mod.sd *= 0.88;
    }
  }
  // Each call below shifts the hole a little, by how well it suits him: close
  // to an even swap for a tour-average player, so "his call" stays the baseline.
  const shift = (m: HoleMod) => {
    mod.mean += m.mean;
    mod.sd *= m.sd;
    mod.blowup *= m.blowup;
  };
  const wind = clamp(((cond.wind ?? 15) - 10) / 15, 0, 1);
  if (call.wind === "full") shift({ mean: -0.03 - d("windTolerance") * 0.006, sd: 1 + 0.12 * wind, blowup: 1 + 0.25 * wind * hole.exposure });
  if (call.wind === "knockdown") shift({ mean: 0.02 - d("trajectoryControl") * 0.008, sd: 0.9, blowup: 0.8 });
  if (call.carry === "carry") shift({ mean: -0.06 - (d("midIrons") + d("distanceControl")) * 0.003, sd: 1.1, blowup: 1 + hole.hazard * 1.6 });
  if (call.carry === "bailout") shift({ mean: 0.07 - d("chipping") * 0.004, sd: 0.9, blowup: 0.5 });
  if (call.trouble === "hero") shift({ mean: -0.03 - (d("creativity") + d("shotShaping")) * 0.004, sd: 1.08, blowup: 1.3 });
  if (call.trouble === "punch") shift({ mean: 0.025 - d("courseManagement") * 0.003, sd: 0.94, blowup: 0.7 });
  if (call.firm === "fly") shift({ mean: -0.02 - d("wedges") * 0.004 + ((cond.firmness ?? 0.6) - 0.6) * 0.1, sd: 1.08, blowup: 1.1 });
  if (call.firm === "run") shift({ mean: 0.01 - (d("creativity") + d("trajectoryControl")) * 0.003, sd: 0.94, blowup: 0.9 });
  if (call.rain === "normal") shift({ mean: -0.01, sd: 1.06, blowup: 1.15 });
  if (call.rain === "smooth") shift({ mean: 0.015 - d("drivingAccuracy") * 0.002, sd: 0.95, blowup: 0.85 });
  if (call.temper === "fire") shift({ mean: -0.03 - d("aggression") * 0.004 + (hasTrait(player, "hothead") ? 0.06 : 0), sd: 1.12, blowup: 1.2 });
  if (call.temper === "calm") shift({ mean: -0.02 - d("composure") * 0.004, sd: 0.93, blowup: 0.85 });
  if (call.board === "look") shift({ mean: -(d("composure") + d("sundayNerves")) * 0.004 - (hasTrait(player, "clutch-gene") ? 0.03 : 0), sd: 1.02, blowup: 1 });
  if (call.board === "blind") shift({ mean: 0.005 - d("focus") * 0.003, sd: 0.97, blowup: 0.95 });
  if (call.layup === "close") shift({ mean: -0.01 - d("pitching") * 0.004, sd: 1.05, blowup: 1.1 });
  if (call.layup === "wedge") shift({ mean: -0.005 - d("wedges") * 0.004, sd: 0.95, blowup: 0.9 });
  if (call.around === "flop") shift({ mean: -0.02 - (d("creativity") + d("pitching")) * 0.004, sd: 1.1, blowup: 1.15 });
  if (call.around === "bump") shift({ mean: -0.005 - d("chipping") * 0.005, sd: 0.97, blowup: 0.95 });
  if (call.around === "putt") shift({ mean: 0.01 - d("lagPutting") * 0.004, sd: 0.93, blowup: 0.85 });
  if (call.trust === "player") shift({ mean: 0.01 - (d("courseManagement") + d("greenReading")) * 0.003, sd: 1.02, blowup: 1 });
  if (call.trust === "caddie") shift({ mean: -0.01, sd: 0.97, blowup: 0.95 });
  // A stubborn player ignores a quarter of your calls and commits harder to the rest.
  if (hasTrait(player, "stubborn")) {
    const k = 0.825;
    return { mean: mod.mean * k, sd: Math.pow(mod.sd, k), blowup: Math.pow(mod.blowup, k) };
  }
  return mod;
}
