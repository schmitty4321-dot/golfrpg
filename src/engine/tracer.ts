/**
 * Shot tracer: turns a hole score from the simulation into a believable
 * sequence of shots, and draws the hole they're played on.
 *
 * The simulation decides scores, not shots (that's what keeps it fast and
 * calibrated), so this works backwards: it plans shots that add up to
 * exactly the score, shaped by the player's game and the hole's layout.
 * The same inputs always give the same replay.
 */
import { pinSpot } from "./pins";
import { TOUR_AVERAGE } from "./attributes";
import { clamp, createRng, type Rng } from "./rng";
import type { Course, CourseStyle, Hole, Player } from "./types";
import { tendencies } from "./tendencies";
import realHoles from "./realHoles.json";
import realHoleOverrides from "./realHoleOverrides.json";
import type { HoleCall } from "./calls";

export interface Pt {
  x: number;
  y: number;
}

export interface Circle extends Pt {
  r: number;
}

/** A hole drawn in yards: tee at the bottom (0, 0), green at the top. */
export interface HoleLayout {
  par: number;
  yards: number;
  style: CourseStyle;
  tee: Pt;
  /** Centre line from tee to green. */
  path: Pt[];
  /** Fairway outline (empty on par 3s). */
  fairway: Pt[];
  green: Circle;
  pin: Pt;
  bunkers: Circle[];
  water: Pt[][];
  trees: Circle[];
  /** Bounding box of everything drawn. */
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  /** Set when the hole is drawn from its real map (OpenStreetMap). */
  real?: { courseId: string; hole: number };
  /** Real fairway width in yards, measured from the map, when known. */
  fairwayWidth?: number;
}

/**
 * The real holes, from OpenStreetMap: the centre line, green, bunkers, water
 * and trees, in yards with the tee at (0, 0) and the green up the y axis
 * (built by scripts/osm; the full outlines for drawing are in public/holes).
 */
interface RealHole {
  path: number[][];
  green: number[];
  bunkers: number[][];
  water: number[][][];
  trees: number[][];
  fw?: number;
}
const REAL_HOLES = realHoles as unknown as Record<string, Record<string, RealHole>>;
const REAL_HOLE_OVERRIDES = realHoleOverrides as unknown as Record<string, Record<string, RealHole>>;

/** Whether a course has real hole maps (and so a drawing to load). */
export const hasRealHoles = (courseId: string): boolean => !!REAL_HOLES[courseId] || !!REAL_HOLE_OVERRIDES[courseId];

export type Lie = "tee" | "fairway" | "rough" | "bunker" | "trees" | "water" | "ob" | "green" | "fringe" | "holed";

export interface Shot {
  /** Stroke number, counting penalty strokes. */
  stroke: number;
  kind: "tee" | "layup" | "recovery" | "approach" | "chip" | "bunker" | "putt" | "penalty";
  club: string;
  from: Pt;
  to: Pt;
  lie: Lie;
  /** Distance travelled in yards (putts: feet in `feet`). */
  yards: number;
  /** Distance left to the hole afterwards, in feet, once on or around the green. */
  feet?: number;
  text: string;
}

export interface HoleTrace {
  layout: HoleLayout;
  shots: Shot[];
  score: number;
  result: string;
}

// ---------------------------------------------------------------- seeds

/** Stable hash of strings and numbers, for repeatable replays. */
export function traceSeed(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= 0x9e37;
  }
  return h >>> 0;
}

// ---------------------------------------------------------------- layout

/** The point `along` yards up the centre line, `side` yards to the right of it. */
export function pointAt(path: Pt[], along: number, side = 0): Pt {
  let left = along;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= len || i === path.length - 2) {
      const t = len === 0 ? 0 : Math.min(left, len) / len;
      const dx = (b.x - a.x) / len;
      const dy = (b.y - a.y) / len;
      // Right-hand normal of the direction of play.
      return { x: a.x + (b.x - a.x) * t + dy * side, y: a.y + (b.y - a.y) * t - dx * side };
    }
    left -= len;
  }
  return path[path.length - 1]!;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

const layoutCache = new WeakMap<Hole, HoleLayout>();

/** Draws a hole from its numbers. Features are placed from a seed of the course and hole, so they never move. */
export function holeLayout(course: Course, hole: Hole, round?: number): HoleLayout {
  let layout = layoutCache.get(hole);
  if (!layout) {
    const real = REAL_HOLES[course.id]?.[String(hole.number)] ?? REAL_HOLE_OVERRIDES[course.id]?.[String(hole.number)];
    layout = real ? realLayout(course, hole, real) : buildLayout(course, hole);
    layoutCache.set(hole, layout);
  }
  return round === undefined ? layout : { ...layout, pin: pinPosition(course, hole, layout.green, round) };
}

/** Where the pin is cut on a hole in a given round (0-3): see pins.ts. */
export function pinPosition(course: Course, hole: Hole, green: Circle, round: number): Pt {
  const r = pinSpot(course, hole, round);
  return { x: green.x + Math.cos(r.ang) * green.r * r.off, y: green.y + Math.sin(r.ang) * green.r * r.off };
}

/** "Back left", "Front", "Middle" ...: the pin as a player walking up the hole sees it. */
export function pinLabel(layout: HoleLayout): string {
  const { green, pin, path } = layout;
  // Direction of play into the green: from the last bend of the centre line.
  const from = path.length >= 2 ? path[path.length - 2]! : layout.tee;
  const dx = green.x - from.x;
  const dy = green.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const along = ((pin.x - green.x) * dx + (pin.y - green.y) * dy) / len / green.r;
  const across = ((pin.x - green.x) * dy - (pin.y - green.y) * dx) / len / green.r;
  const depth = along > 0.2 ? "Back" : along < -0.2 ? "Front" : "";
  const side = across > 0.2 ? "right" : across < -0.2 ? "left" : "";
  if (!depth && !side) return "Middle";
  if (!depth) return side === "right" ? "Middle right" : "Middle left";
  return side ? `${depth} ${side}` : depth;
}

function realLayout(course: Course, hole: Hole, real: RealHole): HoleLayout {
  const rng = createRng(traceSeed(course.id, hole.number, "layout"));
  const pt = (p: number[]): Pt => ({ x: p[0]!, y: p[1]! });
  const path = real.path.map(pt);
  const [gx, gy, gr] = real.green as [number, number, number];
  const green = { x: gx, y: gy, r: gr };
  const pinOff = rng.next() * gr * 0.55;
  const pinAng = rng.next() * Math.PI * 2;
  const pin = { x: gx + Math.cos(pinAng) * pinOff, y: gy + Math.sin(pinAng) * pinOff };
  const w = real.fw ?? (hole.par === 3 ? 0 : hole.fairwayWidth);
  // A plain fairway along the line, shown until the real outlines have loaded.
  const fairway: Pt[] = [];
  if (hole.par > 3) {
    const len = path.slice(1).reduce((sum, p, i) => sum + dist(p, path[i]!), 0);
    const steps = 16;
    for (let i = 0; i <= steps; i++) fairway.push(pointAt(path, 170 + ((len - 192) * i) / steps, w / 2));
    for (let i = steps; i >= 0; i--) fairway.push(pointAt(path, 170 + ((len - 192) * i) / steps, -w / 2));
  }
  const xs = path.map((p) => p.x);
  const ys = path.map((p) => p.y);
  return {
    par: hole.par,
    yards: hole.yards,
    style: course.style,
    tee: { x: 0, y: 0 },
    path,
    fairway,
    green,
    pin,
    bunkers: real.bunkers.map(([x, y, r]) => ({ x: x!, y: y!, r: r! })),
    water: real.water.map((poly) => poly.map(pt)),
    trees: real.trees.map(([x, y, r]) => ({ x: x!, y: y!, r: r! })),
    // The same frame the drawing data uses (see scripts/osm/buildholes.py).
    bounds: { minX: Math.min(Math.min(...xs) - 55, -60), maxX: Math.max(Math.max(...xs) + 55, 60), minY: -25, maxY: Math.max(...ys) + 35 },
    real: { courseId: course.id, hole: hole.number },
    ...(real.fw ? { fairwayWidth: real.fw } : {}),
  };
}

function buildLayout(course: Course, hole: Hole): HoleLayout {
  const rng = createRng(traceSeed(course.id, hole.number, "layout"));
  const Y = hole.yards;
  const path: Pt[] = [{ x: 0, y: 0 }];
  if (hole.par > 3 && rng.chance(0.65)) {
    const corner = hole.par === 4 ? rng.int(235, 285) : rng.int(270, 320);
    const angle = (rng.chance(0.5) ? 1 : -1) * (0.17 + rng.next() * 0.28);
    path.push({ x: 0, y: corner });
    path.push({ x: Math.sin(angle) * (Y - corner), y: corner + Math.cos(angle) * (Y - corner) });
  } else {
    const drift = hole.par === 3 ? rng.normal(0, 8) : rng.normal(0, 15);
    path.push({ x: drift, y: Math.sqrt(Math.max(1, Y * Y - drift * drift)) });
  }

  const w = hole.par === 3 ? 0 : hole.fairwayWidth;
  const fairway: Pt[] = [];
  if (hole.par > 3) {
    const start = 170;
    const end = Y - 22;
    const steps = 16;
    const edge = (s: number) => (w / 2) * (0.85 + 0.15 * Math.sin(s / 37));
    for (let i = 0; i <= steps; i++) {
      const s = start + ((end - start) * i) / steps;
      fairway.push(pointAt(path, s, edge(s)));
    }
    for (let i = steps; i >= 0; i--) {
      const s = start + ((end - start) * i) / steps;
      fairway.push(pointAt(path, s, -edge(s)));
    }
  }

  const greenR = clamp(hole.par === 3 ? 13 - (Y - 180) / 40 : 15, 10, 17);
  const green = { ...pointAt(path, Y), r: greenR };
  const pinOff = rng.next() * greenR * 0.55;
  const pinAng = rng.next() * Math.PI * 2;
  const pin = { x: green.x + Math.cos(pinAng) * pinOff, y: green.y + Math.sin(pinAng) * pinOff };

  const bunkers: Circle[] = [];
  const greenside = Math.min(hole.bunkers, 4);
  for (let i = 0; i < greenside; i++) {
    const ang = -Math.PI / 2 + (rng.next() - 0.5) * Math.PI * 1.6 + (i % 2 ? Math.PI : 0) * 0.5;
    bunkers.push({ x: green.x + Math.cos(ang) * (greenR + 5), y: green.y + Math.sin(ang) * (greenR + 5), r: 4 + rng.next() * 3 });
  }
  if (hole.par > 3) {
    for (let i = 0; i < Math.max(0, hole.bunkers - greenside + (hole.bunkers >= 2 ? 1 : 0)) && i < 2; i++) {
      const s = rng.int(245, 300);
      bunkers.push({ ...pointAt(path, s, (rng.chance(0.5) ? 1 : -1) * (w / 2 + 3)), r: 5 + rng.next() * 3 });
    }
  }

  const water: Pt[][] = [];
  if (hole.hazard >= 0.35) {
    const side = rng.chance(0.5) ? 1 : -1;
    const pond = (s0: number, s1: number, x0: number, x1: number) => {
      const pts: Pt[] = [];
      for (let i = 0; i <= 8; i++) pts.push(pointAt(path, s0 + ((s1 - s0) * i) / 8, x0 + Math.sin(i) * 2));
      for (let i = 8; i >= 0; i--) pts.push(pointAt(path, s0 + ((s1 - s0) * i) / 8, x1 + Math.cos(i) * 2));
      return pts;
    };
    if (hole.par === 3) water.push(pond(Y - greenR - 45, Y - greenR - 6, -28, 28));
    else water.push(pond(215, 330, side * (w / 2 + 8), side * (w / 2 + 40)));
  }

  const trees: Circle[] = [];
  if (course.style === "parkland" || course.style === "resort") {
    for (let s = 40; s < Y - 10; s += 22 + rng.next() * 18) {
      for (const side of [-1, 1]) {
        if (rng.chance(0.7)) trees.push({ ...pointAt(path, s, side * ((w || 30) / 2 + 24 + rng.next() * 14)), r: 5 + rng.next() * 4 });
      }
    }
  }

  const all: Pt[] = [...path, ...fairway, ...trees.map((t) => ({ x: t.x + t.r * Math.sign(t.x || 1), y: t.y })), ...water.flat(), { x: green.x - greenR, y: green.y + greenR }, { x: green.x + greenR, y: green.y + greenR }];
  const pad = 20;
  const bounds = {
    minX: Math.min(...all.map((p) => p.x), -45) - pad,
    maxX: Math.max(...all.map((p) => p.x), 45) + pad,
    minY: -pad,
    maxY: Math.max(...all.map((p) => p.y)) + pad,
  };
  return { par: hole.par, yards: Y, style: course.style, tee: { x: 0, y: 0 }, path, fairway, green, pin, bunkers, water, trees, bounds };
}

// ---------------------------------------------------------------- planning

/** How the strokes on a hole break down; they always sum to the score. */
export interface ShotPlan {
  long: number;
  recoveries: number;
  penalties: number;
  missGreen: boolean;
  chips: number;
  putts: number;
}

export const planStrokes = (p: ShotPlan): number => p.long + p.penalties + p.chips + p.putts;

/** Picks a believable way to make a score on a hole. */
export function planHole(par: number, score: number, hazard: number, rng: Rng): ShotPlan {
  const g = par - 2;
  const d = score - par;
  const plan = (x: Partial<ShotPlan>): ShotPlan => ({ long: g, recoveries: 0, penalties: 0, missGreen: false, chips: 0, putts: 0, ...x });
  if (score === 1) return plan({ long: 1 });
  if (d <= -2) {
    if (score === 2) return plan({ long: 2 });
    return rng.chance(0.8) ? plan({ long: 2, putts: 1 }) : plan({ long: 2, missGreen: true, chips: 1 });
  }
  if (d === -1) {
    if (par === 5 && rng.chance(0.35)) return plan({ long: 2, putts: 2 });
    return rng.chance(0.85) ? plan({ putts: 1 }) : plan({ missGreen: true, chips: 1 });
  }
  if (d === 0) return rng.chance(0.68) ? plan({ putts: 2 }) : plan({ missGreen: true, chips: 1, putts: 1 });

  // Bogey or worse: start from a way to make bogey, then add trouble.
  const options: [number, ShotPlan][] = [
    [0.45, plan({ missGreen: true, chips: 1, putts: 2 })],
    [0.13, plan({ putts: 3 })],
    [0.25, plan({ long: g + 1, recoveries: 1, putts: 2 })],
    [0.1 + hazard * 0.3, plan({ penalties: 1, putts: 2 })],
  ];
  let pick = rng.next() * options.reduce((s, [w]) => s + w, 0);
  let p = options[options.length - 1]![1];
  for (const [w, o] of options) {
    if ((pick -= w) <= 0) {
      p = o;
      break;
    }
  }
  for (let extra = d - 1; extra > 0; extra--) {
    const r = rng.next();
    if (r < 0.1 + hazard * 0.4 && p.penalties < 2) p.penalties++;
    else if (r < 0.65) {
      p.long++;
      p.recoveries++;
    } else if (r < 0.85 || p.putts >= 3) {
      if (!p.missGreen) p.missGreen = true;
      p.chips++;
    } else p.putts++;
  }
  // A lost ball needs a shot from the drop as well as the one that went in: make room for it.
  if (p.penalties > 0 && p.long < 2) {
    if (p.putts > 1) p.putts--;
    else if (p.chips > 0) {
      p.chips--;
      if (p.chips === 0) p.missGreen = false;
    } else p.penalties--;
    p.long++;
  }
  return p;
}

// ---------------------------------------------------------------- shots

export function clubFor(yards: number, fromTee: boolean): string {
  if (fromTee && yards >= 255) return "Driver";
  if (yards >= 228) return "3-wood";
  if (yards >= 208) return "Hybrid";
  if (yards >= 196) return "4-iron";
  if (yards >= 184) return "5-iron";
  if (yards >= 172) return "6-iron";
  if (yards >= 160) return "7-iron";
  if (yards >= 148) return "8-iron";
  if (yards >= 136) return "9-iron";
  if (yards >= 120) return "Pitching wedge";
  if (yards >= 100) return "Gap wedge";
  if (yards >= 75) return "Sand wedge";
  return "Lob wedge";
}

const SCORE_NAMES: Record<number, string> = { [-3]: "Albatross", [-2]: "Eagle", [-1]: "Birdie", 0: "Par", 1: "Bogey", 2: "Double bogey", 3: "Triple bogey" };
export const scoreName = (score: number, par: number): string =>
  score === 1 ? "Hole in one" : SCORE_NAMES[score - par] ?? `${score - par > 0 ? "+" : ""}${score - par}`;

export interface TraceInput {
  course: Course;
  hole: Hole;
  score: number;
  player: Player;
  windMph?: number;
  seed: number;
  /** Strategy calls made for this hole (hole-by-hole play): the replay follows them. */
  call?: HoleCall | null;
  /** 0-based round: the pin moves each day. */
  round?: number;
}

/** The shots behind a hole score. The strokes (shots plus penalties) always equal the score. */
export function traceHole({ course, hole, score, player, windMph = 0, seed, call, round }: TraceInput): HoleTrace {
  const layout = holeLayout(course, hole, round);
  const rng = createRng(seed);
  const a = player.attributes;
  const habits = tendencies(player);
  const plan = planHole(hole.par, score, hole.hazard, rng);
  // Laid up on a par 5: a birdie is a wedge and a putt, not two shots and two putts.
  if (call?.second === "layup" && hole.par === 5 && plan.long === 2 && !plan.missGreen && plan.putts >= 1 && plan.recoveries === 0 && plan.penalties === 0) {
    plan.long = 3;
    plan.putts--;
  }
  // Going for a par 5 in two and missing (then chipping) scores the same as laying up and pitching on:
  // aggressive long hitters take that route more often.
  const reach = hole.yards - (300 + (a.drivingDistance - TOUR_AVERAGE) * 6);
  if (hole.par === 5 && plan.long === 3 && plan.recoveries === 0 && plan.penalties === 0 && reach < 270) {
    const natural = (habits.strategy === "aggressive" ? 0.95 : habits.strategy === "conservative" ? 0.35 : 0.7) * (reach < 240 ? 1 : 0.6);
    const goChance = call?.second === "go" ? 1 : call?.second === "layup" ? 0 : natural;
    if (rng.chance(goChance)) {
      // One fewer full shot, one more chip: the same score.
      plan.long = 2;
      plan.missGreen = true;
      plan.chips++;
    }
  }
  const shots: Shot[] = [];
  const Y = hole.yards;
  const w = layout.fairwayWidth ?? (hole.fairwayWidth || 30);
  let cur: Pt = layout.tee;
  let stroke = 0;
  const pin = layout.pin;
  const toPinFt = (p: Pt) => Math.round(dist(p, pin) * 3);

  const push = (s: Omit<Shot, "stroke" | "yards" | "from"> & { yards?: number }) => {
    stroke++;
    const yards = s.yards ?? Math.round(dist(cur, s.to));
    shots.push({ ...s, stroke, from: cur, yards });
    cur = s.to;
  };
  const penalty = (text: string, drop: Pt) => {
    stroke++;
    shots.push({ stroke, kind: "penalty", club: "", from: cur, to: drop, lie: "rough", yards: 0, text });
    cur = drop;
  };
  /** Where a ball that finds the water ends up: in the hole's real water near `target`, when there's some close by. */
  const inWater = (target: Pt): Pt | null => {
    let best: Pt | null = null;
    let bestD = Infinity;
    for (const poly of layout.water) {
      const c = { x: poly.reduce((s, p) => s + p.x, 0) / poly.length, y: poly.reduce((s, p) => s + p.y, 0) / poly.length };
      for (const v of poly) {
        const d = dist(v, target);
        if (d < bestD) {
          bestD = d;
          // A few yards in from the edge.
          const k = Math.min(1, 6 / Math.max(1, dist(v, c)));
          best = { x: v.x + (c.x - v.x) * k, y: v.y + (c.y - v.y) * k };
        }
      }
    }
    return bestD <= 70 ? best : null;
  };
  /** A spot on the green `feet` from the pin, on the side the ball came from. */
  const onGreen = (feet: number, from: Pt): Pt => {
    const g = layout.green;
    // How far from the pin the green runs in a given direction (pins sit off centre).
    const reach = (ang: number) => {
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const b = (pin.x - g.x) * dx + (pin.y - g.y) * dy;
      const c = (pin.x - g.x) ** 2 + (pin.y - g.y) ** 2 - g.r * g.r;
      return (-b + Math.sqrt(Math.max(0, b * b - c))) * 0.95;
    };
    let ang = Math.atan2(from.y - pin.y, from.x - pin.x) + rng.normal(0, 0.9);
    // A long putt needs room: it comes from the far side of the green, away from a tucked pin.
    if (feet / 3 > reach(ang)) ang = Math.atan2(pin.y - g.y, pin.x - g.x) + Math.PI + rng.normal(0, 0.4);
    const yds = Math.min(feet / 3, reach(ang));
    return { x: pin.x + Math.cos(ang) * yds, y: pin.y + Math.sin(ang) * yds };
  };
  /** Where a missed green ends up: a greenside bunker or the rough around it. */
  const aroundGreen = (): { at: Pt; lie: Lie } => {
    const greenside = layout.bunkers.filter((b) => dist(b, layout.green) < layout.green.r + 12);
    // Greenside bunkers cost more shots than rough: they turn up more on the bogey holes.
    const bunkerOdds = trace_scoreOver(score, hole.par) ? 0.55 : 0.25;
    if (greenside.length && rng.chance(bunkerOdds)) {
      const b = rng.pick(greenside);
      return { at: { x: b.x + rng.normal(0, 1), y: b.y + rng.normal(0, 1) }, lie: "bunker" };
    }
    const ang = rng.next() * Math.PI * 2;
    const r = layout.green.r + 3 + rng.next() * 8;
    return { at: { x: layout.green.x + Math.cos(ang) * r, y: layout.green.y + Math.sin(ang) * r }, lie: "rough" };
  };
  const approachFeet = (): number => {
    const skill = (a.midIrons + a.distanceControl + a.wedges) / 3 - TOUR_AVERAGE;
    // One-putts are mostly from inside 20 feet, with the odd long one holed.
    const onePutt = () => (rng.chance(0.08) ? 22 + 50 * rng.next() ** 2 : 3 + rng.next() * 17);
    const base = plan.putts <= 1 ? onePutt() : plan.putts === 2 ? 18 + rng.next() * 35 : 38 + rng.next() * 30;
    const aim = call?.approach === "attack" ? 0.8 : call?.approach === "middle" ? 1.3 : 1;
    return Math.round(clamp(base * aim * (1 - skill * 0.03), 2, 90));
  };
  const chipFeet = (): number => (plan.putts <= 1 ? 1 + rng.next() * 6 : plan.putts === 2 ? 6 + rng.next() * 10 : 20 + rng.next() * 15);

  // ---- long shots
  // Every player has a favourite miss: some fight a slice, some a hook.
  const missSide = () => (rng.chance(habits.missRight) ? 1 : -1);
  const driveLen = clamp(305 + (a.drivingDistance - TOUR_AVERAGE) * 6 + rng.normal(0, 9) - windMph * 0.6, 230, 345);
  // Fairways lead to greens: a hole where the approach finds the green was usually played from the short grass.
  const accurate = clamp(0.66 + (a.drivingAccuracy - TOUR_AVERAGE) * 0.03 + (plan.missGreen ? -0.25 : 0.12), 0.1, 0.95);
  const lastLong = plan.long;
  const finalLong = (club?: string) => {
    const from = cur;
    const yards = Math.round(dist(from, pin));
    const name = club ?? clubFor(yards, stroke === 0);
    if (plan.chips === 0 && plan.putts === 0) {
      push({ kind: stroke === 0 ? "tee" : "approach", club: name, to: pin, lie: "holed", text: `${name} from ${yards} yds... and it's in!` });
    } else if (plan.missGreen) {
      const g = aroundGreen();
      push({ kind: stroke === 0 ? "tee" : "approach", club: name, to: g.at, lie: g.lie, feet: toPinFt(g.at), text: `${name} from ${yards} yds misses the green${g.lie === "bunker" ? ", into a bunker" : ""}.` });
    } else {
      const ft = approachFeet();
      const to = onGreen(ft, from);
      push({ kind: stroke === 0 ? "tee" : "approach", club: name, to, lie: "green", feet: toPinFt(to), text: `${name} from ${yards} yds to ${toPinFt(to)} ft.` });
    }
  };

  if (hole.par === 3) {
    if (plan.penalties > 0) {
      const aim = pointAt(layout.path, Y - layout.green.r - 25, rng.normal(0, 8));
      const into = layout.water[0] ? (layout.real ? inWater(layout.green) ?? aim : aim) : pointAt(layout.path, Y + 10, (rng.chance(0.5) ? 1 : -1) * 45);
      const club = clubFor(Y, true);
      push({ kind: "tee", club, to: into, lie: layout.water[0] ? "water" : "ob", text: `${club} ${layout.water[0] ? "comes up short, in the water" : "sails out of bounds"}.` });
      for (let i = 0; i < plan.penalties; i++) penalty(i === 0 ? "Penalty stroke: plays from the drop zone." : "Another penalty stroke.", pointAt(layout.path, Y - 70, 0));
      for (let i = 2; i < lastLong; i++) push({ kind: "recovery", club: "Wedge", to: pointAt(layout.path, Y - 25, rng.normal(0, 6)), lie: "rough", text: "Wedge, short of the green." });
      finalLong();
    } else if (plan.recoveries > 0) {
      const miss = pointAt(layout.path, Y - rng.int(10, 40), (rng.chance(0.5) ? 1 : -1) * (layout.green.r + 20));
      const club = clubFor(Y, true);
      push({ kind: "tee", club, to: miss, lie: layout.trees.length ? "trees" : "rough", text: `${club} misses badly, ${layout.trees.length ? "into the trees" : "into thick rough"}.` });
      for (let i = 2; i < lastLong; i++) push({ kind: "recovery", club: "Wedge", to: pointAt(layout.path, Y - 30, rng.normal(0, 5)), lie: "rough", text: "Pitches out." });
      finalLong();
    } else {
      finalLong(clubFor(Y, true));
    }
  } else {
    // Tee shot.
    let tee: Pt;
    let lie: Lie;
    let teeText: string;
    const teeClub = call?.tee === "iron" ? "Long iron" : call?.tee === "3-wood" ? "3-wood" : call?.tee === "driver" ? "Driver" : Y < 360 || (w < 24 && a.courseManagement >= 13) ? "3-wood" : "Driver";
    const len = Math.min(teeClub === "Long iron" ? driveLen - 55 : teeClub === "3-wood" ? driveLen - 25 : driveLen, Y - 70);
    if (plan.penalties > 0) {
      const wet = layout.water.length > 0;
      const landing = pointAt(layout.path, len - 20, (layout.water[0]?.[0]?.x ?? 0) > 0 ? w / 2 + 22 : -(w / 2 + 22));
      tee = wet ? (layout.real ? inWater(pointAt(layout.path, len)) ?? landing : landing) : pointAt(layout.path, len, missSide() * (w / 2 + 50));
      lie = wet ? "water" : "ob";
      teeText = `${teeClub} ${wet ? "finds the water" : "goes out of bounds"}.`;
    } else if (plan.recoveries > 0) {
      const side = missSide();
      tee = pointAt(layout.path, len - 10, side * (w / 2 + (layout.trees.length ? 24 : 14)));
      lie = layout.trees.length ? "trees" : "rough";
      teeText = `${teeClub}, ${Math.round(len - 10)} yds, ${lie === "trees" ? "blocked out in the trees" : "buried in deep rough"}.`;
    } else if (rng.chance(accurate)) {
      tee = pointAt(layout.path, len, rng.normal(0, w / 6));
      lie = "fairway";
      teeText = `${teeClub}, ${Math.round(len)} yds, finds the fairway.`;
    } else {
      const fb = layout.bunkers.filter((b) => dist(b, layout.green) > layout.green.r + 12);
      if (fb.length && rng.chance(0.35)) {
        tee = { ...rng.pick(fb) };
        lie = "bunker";
        teeText = `${teeClub} runs into a fairway bunker.`;
      } else {
        tee = pointAt(layout.path, len, missSide() * (w / 2 + 4 + rng.next() * 8));
        lie = "rough";
        teeText = `${teeClub}, ${Math.round(len)} yds, just in the rough.`;
      }
    }
    if (lastLong === 1) {
      // A drivable par 4 (rare): the tee shot is the approach.
      finalLong(teeClub);
    } else {
      push({ kind: "tee", club: teeClub, to: tee, lie, text: teeText, yards: Math.round(len) });
      for (let i = 0; i < plan.penalties; i++) {
        penalty(i === 0 ? `Penalty stroke: drops ${lie === "water" ? "beside the water" : "back in play"}.` : "Another penalty stroke.", pointAt(layout.path, Math.max(150, len - 40), (lie === "water" ? 1 : 0) * Math.sign(tee.x) * (w / 2)));
      }
      let recoveriesLeft = plan.recoveries;
      for (let k = 2; k < lastLong; k++) {
        const alongNow = Math.min(Y - 30, Math.max(0, projectAlong(layout.path, cur)));
        if (recoveriesLeft > 0) {
          recoveriesLeft--;
          const to = pointAt(layout.path, Math.min(Y - 90, alongNow + 40 + rng.next() * 60), rng.normal(0, w / 8));
          push({ kind: "recovery", club: "9-iron", to, lie: "fairway", text: "Punches out to the fairway." });
        } else {
          const target = Math.max(alongNow + 60, Y - rng.int(85, 115));
          const to = pointAt(layout.path, Math.min(target, Y - 60), rng.normal(0, w / 7));
          const club = clubFor(dist(cur, to), false);
          push({ kind: "layup", club, to, lie: "fairway", text: `${club} lays up, ${Math.round(Y - projectAlong(layout.path, to))} yds out.` });
        }
      }
      finalLong();
    }
  }

  // ---- chips and bunker shots
  for (let i = 0; i < plan.chips; i++) {
    const last = i === plan.chips - 1;
    const fromBunker = shots[shots.length - 1]?.lie === "bunker";
    const club = fromBunker ? "Sand wedge" : "Chip";
    if (last && plan.putts === 0) {
      push({ kind: fromBunker ? "bunker" : "chip", club, to: pin, lie: "holed", text: fromBunker ? "Splashes out... and it drops!" : "Chips in!" });
    } else if (last) {
      const ft = Math.round(chipFeet());
      const to = onGreen(ft, cur);
      push({ kind: fromBunker ? "bunker" : "chip", club, to, lie: "green", feet: toPinFt(to), text: `${fromBunker ? "Bunker shot" : "Chip"} to ${toPinFt(to)} ft.` });
    } else {
      const g = aroundGreen();
      push({ kind: fromBunker ? "bunker" : "chip", club, to: g.at, lie: g.lie, feet: toPinFt(g.at), text: `${fromBunker ? "Leaves it in the bunker" : "Duffs the chip"}, still off the green.` });
    }
  }

  // ---- putts
  for (let i = 0; i < plan.putts; i++) {
    const last = i === plan.putts - 1;
    const ft = toPinFt(cur);
    if (last) {
      push({ kind: "putt", club: "Putter", to: pin, lie: "holed", yards: Math.round(ft / 3), feet: 0, text: ft <= 3 ? "Taps in." : `Holes the ${ft}-footer.` });
    } else {
      const pace = call?.putt === "charge" ? "charger" : call?.putt === "lag" ? "dier" : habits.puttingPace;
      const paceLeave = pace === "charger" ? 1.6 : pace === "dier" ? 0.6 : 1;
      const leave = (plan.putts - i === 3 ? 5 + rng.next() * 6 : 1 + rng.next() * 3) * paceLeave;
      const to = onGreen(leave, cur);
      push({ kind: "putt", club: "Putter", to, lie: "green", yards: Math.round(ft / 3), feet: toPinFt(to), text: `Putts from ${ft} ft, leaves ${toPinFt(to)} ft.` });
    }
  }

  return { layout, shots, score, result: scoreName(score, hole.par) };
}

/** How far up the hole a point is (distance along the centre line). */
export function projectAlong(path: Pt[], p: Pt): number {
  let best = 0;
  let bestD = Infinity;
  let acc = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const t = clamp(((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (len * len), 0, 1);
    const q = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    const d = dist(p, q);
    if (d < bestD) {
      bestD = d;
      best = acc + t * len;
    }
    acc += len;
  }
  return best;
}

/** Which side of the centre line a point is on (+1 right, -1 left, looking down the hole). */
export function sideOf(path: Pt[], p: Pt): number {
  let best = Infinity;
  let sign = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const t = clamp(((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (len * len), 0, 1);
    const q = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    const d = Math.hypot(p.x - q.x, p.y - q.y);
    if (d < best) {
      best = d;
      // Right-hand normal of the direction of play is (dy, -dx).
      sign = Math.sign((p.x - q.x) * (b.y - a.y) - (p.y - q.y) * (b.x - a.x));
    }
  }
  return sign;
}

const trace_scoreOver = (score: number, par: number) => score > par;
