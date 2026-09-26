import { TOUR_AVERAGE, type Attributes } from "./attributes";
import type { Course, Player, StrokesGained } from "./types";

/**
 * How much a course rewards each part of the game, 1.0 = typical tour venue.
 * A long course multiplies the value of distance; tight fairways and thick
 * rough multiply accuracy; fast greens multiply putting.
 */
export interface CourseDemands {
  distance: number;
  accuracy: number;
  approach: number;
  shortGame: number;
  putting: number;
}

const BASELINE_YARDS = 7200;

export function courseDemands(course: Course): CourseDemands {
  const yards = course.holes.reduce((s, h) => s + h.yards, 0);
  const teeShots = course.holes.filter((h) => h.par > 3);
  const avgWidth = teeShots.reduce((s, h) => s + h.fairwayWidth, 0) / Math.max(1, teeShots.length);
  const avgBunkers = course.holes.reduce((s, h) => s + h.bunkers, 0) / course.holes.length;
  const within = (x: number) => Math.min(1.6, Math.max(0.5, x));
  return {
    distance: within(1 + (yards - BASELINE_YARDS) / 1500),
    accuracy: within(1 + (30 - avgWidth) / 20 + (course.roughPenalty - 0.5) * 0.6),
    approach: within(1 + (course.firmness - 0.5) * 0.3),
    shortGame: within(1 + (avgBunkers - 2) * 0.1 + (course.firmness - 0.5) * 0.4),
    putting: within(1 + (course.greenSpeed - 12) * 0.08),
  };
}

/**
 * Per-point weights: strokes gained per round, per rating point above tour
 * average, before course demands. With every skill at 20 a player gains about
 * 3.5 strokes a round, roughly the best seasons on record.
 */
const W = {
  drivingDistance: 0.055,
  drivingAccuracy: 0.04,
  fairwayWoods: 0.015,
  midIrons: 0.045,
  wedges: 0.03,
  distanceControl: 0.035,
  longIrons: 0.025,
  shotShaping: 0.015,
  trajectoryControl: 0.015,
  chipping: 0.025,
  pitching: 0.02,
  bunkerPlay: 0.015,
  creativity: 0.01,
  shortPutts: 0.035,
  lagPutting: 0.02,
  greenReading: 0.025,
  speedControl: 0.02,
  courseManagement: 0.02,
} as const;

const rel = (a: Attributes, k: keyof Attributes) => a[k] - TOUR_AVERAGE;

/**
 * A player's expected strokes gained per round, by category, against a
 * tour-average player on this course in calm weather. Includes course fit,
 * form and condition; day-to-day randomness is added in the round sim.
 */
export function expectedStrokesGained(player: Player, course: Course): StrokesGained {
  const a = player.attributes;
  const d = courseDemands(course);
  const avgBunkers = course.holes.reduce((s, h) => s + h.bunkers, 0) / course.holes.length;

  const sg: StrokesGained = {
    offTheTee:
      d.distance * W.drivingDistance * rel(a, "drivingDistance") +
      d.accuracy * W.drivingAccuracy * rel(a, "drivingAccuracy") +
      W.fairwayWoods * rel(a, "fairwayWoods"),
    approach:
      d.approach *
        (W.midIrons * rel(a, "midIrons") +
          W.wedges * rel(a, "wedges") +
          W.distanceControl * rel(a, "distanceControl") +
          W.longIrons * rel(a, "longIrons") * d.distance +
          W.shotShaping * rel(a, "shotShaping") +
          W.trajectoryControl * rel(a, "trajectoryControl")) +
      W.courseManagement * rel(a, "courseManagement"),
    aroundTheGreen:
      d.shortGame *
      (W.chipping * rel(a, "chipping") +
        W.pitching * rel(a, "pitching") +
        W.bunkerPlay * rel(a, "bunkerPlay") * (avgBunkers / 2) +
        W.creativity * rel(a, "creativity")),
    putting:
      d.putting *
      (W.shortPutts * rel(a, "shortPutts") +
        W.lagPutting * rel(a, "lagPutting") +
        W.greenReading * rel(a, "greenReading") +
        W.speedControl * rel(a, "speedControl")),
  };

  // Course fit: home grass on the greens, and comfort with the style of course.
  sg.putting += player.grassPreference === course.grass ? 0.12 : -0.06;
  sg.approach += (player.styleComfort[course.style] - TOUR_AVERAGE) * 0.025;

  // Form and freshness apply evenly across the game.
  const general = player.form * 0.4 - Math.max(0, 80 - player.condition) * 0.02;
  sg.offTheTee += general / 4;
  sg.approach += general / 4;
  sg.aroundTheGreen += general / 4;
  sg.putting += general / 4;
  return sg;
}

export const totalSg = (sg: StrokesGained): number =>
  sg.offTheTee + sg.approach + sg.aroundTheGreen + sg.putting;
