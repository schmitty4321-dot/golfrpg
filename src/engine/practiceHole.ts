/**
 * A practice hole played one shot at a time. Each stroke is a swing: the club, the lie
 * the ball sits in, and the player's swing (power, timing, aim, shape) decide where it
 * goes. The course layout gives the greens, bunkers, water and fairway. Practice only:
 * it doesn't feed a tournament result.
 */
import { TOUR_AVERAGE } from "./attributes";
import { holeLayout, projectAlong, type HoleLayout, type Pt } from "./tracer";
import { scoreSwing, sweetSpotMs, type SwingClub, type SwingLie, type SwingShot } from "./swing";
import type { Course, Hole, Player } from "./types";

export type BallLie = "tee" | "fairway" | "rough" | "bunker" | "tree" | "green" | "water" | "holed";

export interface PracticeShot {
  club: SwingClub;
  /** Power on the meter, 0 to 110 (the target for a calm, full swing is about 90). */
  power: number;
  /** Strike timing in ms (negative early, positive late). */
  timingMs: number;
  /** Aim left (-) or right (+) of the line to the target, in yards. */
  aim: number;
  /** The landing target on the course, in yards. Defaults to the pin. */
  target?: Pt;
  shot?: SwingShot;
  /** -1 draw, 0 straight, 1 fade. */
  shape?: number;
  strength?: number;
}

export interface PracticeStroke {
  stroke: number;
  club: SwingClub;
  from: Pt;
  to: Pt;
  lieBefore: BallLie;
  lieAfter: BallLie;
  yards: number;
  penalty: boolean;
  quality: number;
}

export interface PracticeHole {
  layout: HoleLayout;
  par: number;
  ball: Pt;
  lie: BallLie;
  strokes: PracticeStroke[];
  /** Strokes taken so far, counting penalties. */
  score: number;
  holed: boolean;
}

const YARDS_PER_POINT = 4.2;
const PUTT_WINDOW_MS = 40;

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Point in a polygon (even-odd rule). */
function inPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** How far the player hits each club on a full swing, in yards carry (from the same skill numbers the tracer uses). */
export function clubCarry(player: Player, club: SwingClub): number {
  const a = player.attributes;
  if (club === "driver") return Math.round(255 + YARDS_PER_POINT * (a.drivingDistance - TOUR_AVERAGE));
  if (club === "iron") return Math.round(165 + YARDS_PER_POINT * ((a.longIrons + a.midIrons) / 2 - TOUR_AVERAGE));
  return Math.round(95 + YARDS_PER_POINT * (a.wedges - TOUR_AVERAGE));
}

/** Distance from a point to the centre line of the hole (the nearest point on the path). */
function lateralFromLine(path: Pt[], p: Pt): number {
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len2));
    best = Math.min(best, dist(p, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }));
  }
  return best;
}

/**
 * On the fairway: within half the fairway width of the line of play, from the tee box up to the
 * green. A par 3 has no fairway width, so it gets a narrow corridor for the tee and approach.
 */
function onFairway(layout: HoleLayout, p: Pt): boolean {
  const halfWidth = Math.max(15, (layout.fairwayWidth ?? 30) / 2);
  const along = projectAlong(layout.path, p);
  const total = projectAlong(layout.path, layout.path[layout.path.length - 1]!);
  if (along < 0 || along > total - 15) return false;
  return lateralFromLine(layout.path, p) <= halfWidth;
}

/** The lie the ball is in at a point on the course. */
export function lieAt(layout: HoleLayout, p: Pt): BallLie {
  if (layout.water.some((poly) => inPolygon(p, poly))) return "water";
  if (dist(p, layout.green) <= layout.green.r) return "green";
  if (layout.bunkers.some((b) => dist(p, b) <= b.r)) return "bunker";
  // Under or among trees: the map's tree zones.
  if (layout.trees.some((t) => dist(p, t) <= t.r)) return "tree";
  return onFairway(layout, p) ? "fairway" : "rough";
}

/** The lie the swing model uses for the sweet spot, for a ball in a given lie. */
function swingLie(lie: BallLie): SwingLie {
  if (lie === "rough") return "light";
  if (lie === "bunker") return "fairwaySand";
  if (lie === "green") return "greenSand";
  if (lie === "tree") return "tree";
  if (lie === "tee") return "tee";
  return "fairway";
}

export function startPracticeHole(course: Course, hole: Hole, round = 0): PracticeHole {
  const layout = holeLayout(course, hole, round);
  return { layout, par: hole.par, ball: layout.tee, lie: "tee", strokes: [], score: 0, holed: false };
}

/**
 * Plays one stroke with this swing. Returns the new state. A ball into water is
 * dropped back where it was struck from, with a penalty stroke.
 */
export function playPracticeShot(state: PracticeHole, player: Player, shot: PracticeShot): PracticeHole {
  if (state.holed) throw new Error("the hole is finished");
  const { layout } = state;
  const from = state.ball;
  const onGreen = state.lie === "green";
  // The target is where the player is aiming: the pin unless he has moved it.
  const pin = shot.target ?? layout.pin;
  const toPin = dist(from, pin);

  // Putting: holed when the timing is inside the putt window and the power is near the distance to the hole.
  if (onGreen) {
    // A putt travels about (power - 10) / 0.75 feet-per-point of the meter; holed when the power and timing are both right.
    const ideal = Math.min(110, 10 + toPin * 3 * 0.75);
    const holed = Math.abs(shot.timingMs) <= PUTT_WINDOW_MS && Math.abs(shot.power - ideal) <= 3;
    const travel = Math.max(0, (shot.power - 10) / 0.75 / 3) + (Math.abs(shot.timingMs) > PUTT_WINDOW_MS ? 0.5 : 0);
    const left = holed ? 0 : Math.max(0, toPin - travel);
    const scale = toPin > 0 ? left / toPin : 0;
    const to = holed ? pin : { x: pin.x + (from.x - pin.x) * scale, y: pin.y + (from.y - pin.y) * scale };
    const lieAfter: BallLie = holed ? "holed" : "green";
    const stroke: PracticeStroke = { stroke: state.score + 1, club: "wedge", from, to, lieBefore: "green", lieAfter, yards: toPin, penalty: false, quality: holed ? 1 : 0 };
    return { ...state, ball: to, lie: lieAfter, strokes: [...state.strokes, stroke], score: state.score + 1, holed };
  }

  // Full swing: power scales the club's carry; the lie reduces it; timing and aim move it sideways.
  const club = shot.club;
  const sLie = swingLie(state.lie);
  const window = sweetSpotMs(player, club, sLie, { shot: shot.shot, shape: shot.shape ?? 0, strength: shot.strength ?? 0.5, power: shot.power });
  const scored = scoreSwing({ power: shot.power, timingMs: shot.timingMs }, window, 90);
  // A tree lie takes a lot of the power: a punch out at best.
  const lieCarry = state.lie === "rough" ? 0.94 : state.lie === "bunker" ? 0.9 : state.lie === "tree" ? 0.6 : 1;
  const carry = clubCarry(player, club) * Math.min(shot.power, 110) / 100 * lieCarry * (shot.shot === "flop" ? 0.5 : shot.shot === "punch" ? 0.8 : 1);
  const forward = toPin > 0 ? { x: (pin.x - from.x) / toPin, y: (pin.y - from.y) / toPin } : { x: 0, y: 1 };
  const right = { x: forward.y, y: -forward.x };
  // Late strikes push right, early strikes pull left, outside the window; aim and shape add to the line.
  const outside = Math.max(0, Math.abs(shot.timingMs) - window);
  const sideways = (Math.sign(shot.timingMs) * outside) / 600 * 75 + shot.aim + (shot.shape ?? 0) * (shot.strength ?? 0.5) * carry * 0.03;
  const landing = { x: from.x + forward.x * carry + right.x * sideways, y: from.y + forward.y * carry + right.y * sideways };
  const landLie = lieAt(layout, landing);
  if (landLie === "water") {
    const stroke: PracticeStroke = { stroke: state.score + 2, club, from, to: from, lieBefore: state.lie, lieAfter: state.lie, yards: carry, penalty: true, quality: scored.quality };
    return { ...state, strokes: [...state.strokes, stroke], score: state.score + 2 };
  }
  const stroke: PracticeStroke = { stroke: state.score + 1, club, from, to: landing, lieBefore: state.lie, lieAfter: landLie, yards: carry, penalty: false, quality: scored.quality };
  return { ...state, ball: landing, lie: landLie, strokes: [...state.strokes, stroke], score: state.score + 1 };
}
