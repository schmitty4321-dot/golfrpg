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
}

/** Yards the player can reach in two on a par 5 (drive plus a long second). */
export const reachInTwo = (p: Player): number => 300 + (p.attributes.drivingDistance - TOUR_AVERAGE) * 6 + 245 + (p.attributes.longIrons - TOUR_AVERAGE) * 4 + traitReachBonus(p);

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
  if (hole.hazard >= 0.3 || hole.bunkers >= 3 || (hole.par === 3 && hole.hazard >= 0.2)) {
    out.push({
      kind: "approach",
      question: "A guarded green: where does he aim?",
      options: [
        { value: "attack", label: "Attack the pin", blurb: "Closer birdie looks, more short-sided misses." },
        { value: "middle", label: "Middle of the green", blurb: "Fewer big numbers, longer putts." },
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

/** What a set of calls does to the hole, for this player. */
export function callEffect(call: HoleCall | null | undefined, hole: Hole, player: Player): HoleMod {
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
      mod.mean += -0.06 - (d("midIrons") + d("wedges") + d("distanceControl")) * 0.002;
      mod.sd *= 1.1;
      mod.blowup *= 1 + hole.hazard * 1.5 + hole.bunkers * 0.05;
    } else {
      mod.mean += 0.04;
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
  // A stubborn player ignores a quarter of your calls and commits harder to the rest.
  if (hasTrait(player, "stubborn")) {
    const k = 0.825;
    return { mean: mod.mean * k, sd: Math.pow(mod.sd, k), blowup: Math.pow(mod.blowup, k) };
  }
  return mod;
}
