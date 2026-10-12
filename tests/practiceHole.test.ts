import { describe, expect, it } from "vitest";
import { REAL_COURSES } from "../src/engine/realCourses";
import { createRng } from "../src/engine/rng";
import { generatePlayer } from "../src/engine/players";
import { clubCarry, lieAt, playPracticeShot, startPracticeHole, type PracticeHole, type PracticeShot } from "../src/engine/practiceHole";
import type { SwingClub } from "../src/engine/swing";

// A simple planner: the club that reaches the pin, the power that carries that far, a clean strike.
function plan(state: PracticeHole, player: ReturnType<typeof generatePlayer>): PracticeShot {
  const pin = state.layout.pin;
  const d = Math.hypot(pin.x - state.ball.x, pin.y - state.ball.y);
  if (state.lie === "green") {
    const feet = d * 3;
    return { club: "wedge", power: Math.min(110, 10 + feet * 0.75), timingMs: 0, aim: 0 };
  }
  const club: SwingClub = d > 170 ? "driver" : d > 60 ? "iron" : "wedge";
  const power = Math.min(110, (d / clubCarry(player, club)) * 100);
  return { club, power, timingMs: 0, aim: 0 };
}

describe("practice hole, shot by shot", () => {
  const course = REAL_COURSES.find((c) => c.id === "waialae")!;
  const player = generatePlayer(createRng(5), { tier: "tour" });

  it("plays every Waialae hole to the cup in a sensible number of strokes", () => {
    for (const hole of course.holes) {
      let state = startPracticeHole(course, hole, 0);
      let guard = 0;
      while (!state.holed && guard++ < 12) state = playPracticeShot(state, player, plan(state, player));
      expect(state.holed, `hole ${hole.number} holed`).toBe(true);
      expect(state.score, `hole ${hole.number} score`).toBeLessThanOrEqual(hole.par + 4);
    }
  });

  it("a ball into water is dropped back with a penalty stroke", () => {
    const hole = course.holes.find((h) => h.number === 1)!;
    const start = startPracticeHole(course, hole, 0);
    const state = { ...start, ball: { x: start.layout.pin.x, y: 431 }, lie: "fairway" as const };
    // Aim a strike at a point of water on the hole: its forward distance sets the power, its sideways offset the aim.
    // A point inside the water (the polygon is concave, so search its bounding box).
    const poly = state.layout.water[0]!;
    const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
    let water = { x: 0, y: 0 };
    search: for (let x = Math.min(...xs); x <= Math.max(...xs); x += 4) for (let y = Math.min(...ys); y <= Math.max(...ys); y += 4) if (lieAt(state.layout, { x, y }) === "water") { water = { x, y }; break search; }
    const pin = state.layout.pin;
    const toPin = Math.hypot(pin.x - state.ball.x, pin.y - state.ball.y);
    const fwd = { x: (pin.x - state.ball.x) / toPin, y: (pin.y - state.ball.y) / toPin };
    const right = { x: fwd.y, y: -fwd.x };
    const v = { x: water.x - state.ball.x, y: water.y - state.ball.y };
    const carryNeeded = v.x * fwd.x + v.y * fwd.y;
    const side = v.x * right.x + v.y * right.y;
    const wet = playPracticeShot(state, player, { club: "iron", power: Math.min(110, (carryNeeded / clubCarry(player, "iron")) * 100), timingMs: 0, aim: side });
    expect(wet.strokes[0]!.penalty).toBe(true);
    expect(wet.ball).toEqual(state.ball);
    expect(wet.score).toBe(state.score + 2);
  });

  it("the same strike goes shorter from a bunker than from the fairway", () => {
    const hole = course.holes.find((h) => h.number === 5)!;
    const state = startPracticeHole(course, hole, 0);
    const fairwayShot = playPracticeShot({ ...state, lie: "fairway" }, player, { club: "iron", power: 90, timingMs: 0, aim: 0 });
    const rough = playPracticeShot({ ...state, lie: "rough" }, player, { club: "iron", power: 90, timingMs: 0, aim: 0 });
    expect(rough.strokes[0]!.yards).toBeLessThan(fairwayShot.strokes[0]!.yards);
  });
  it("a moved target pulls the shot towards it, not the pin", () => {
    const hole = course.holes.find((h) => h.number === 5)!;
    const state = startPracticeHole(course, hole, 0);
    const pin = state.layout.pin;
    // A target 60 yards right of the pin, and enough power to reach it from the tee.
    const target = { x: pin.x + 60, y: pin.y };
    const dTarget = Math.hypot(target.x - state.ball.x, target.y - state.ball.y);
    const shot = playPracticeShot(state, player, { club: "driver", power: Math.min(110, (dTarget / clubCarry(player, "driver")) * 100), timingMs: 0, aim: 0, target });
    const landed = shot.strokes[0]!.to;
    const before = Math.hypot(target.x - state.ball.x, target.y - state.ball.y);
    const after = Math.hypot(target.x - landed.x, target.y - landed.y);
    expect(after).toBeLessThan(before);
  });
  it("the lie comes from the line of play: fairway on the line, rough well off it", () => {
    const hole = course.holes.find((h) => h.number === 1)!;
    const { layout } = startPracticeHole(course, hole, 0);
    const onLine = layout.path[1]!;
    expect(lieAt(layout, onLine)).toBe("fairway");
    expect(lieAt(layout, { x: onLine.x + 60, y: onLine.y })).toBe("rough");
  });

  it("each shot starts from where the last one landed, and its lie carries over", () => {
    const hole = course.holes.find((h) => h.number === 5)!;
    let state = startPracticeHole(course, hole, 0);
    state = playPracticeShot(state, player, { club: "driver", power: 90, timingMs: 0, aim: 0 });
    const landed = state.strokes[0]!.to;
    expect(state.ball).toEqual(landed);
    expect(state.lie).toBe(state.strokes[0]!.lieAfter);
    state = playPracticeShot(state, player, { club: "iron", power: 80, timingMs: 0, aim: 0 });
    expect(state.strokes[1]!.from).toEqual(landed);
  });
  it("a ball among the map's trees is in a tree lie, and punches out short", () => {
    const hole = course.holes.find((h) => h.number === 2)!;
    const start = startPracticeHole(course, hole, 0);
    const tree = start.layout.trees[0]!;
    expect(lieAt(start.layout, { x: tree.x, y: tree.y })).toBe("tree");
    const fromTree = playPracticeShot({ ...start, ball: { x: tree.x, y: tree.y }, lie: "tree" }, player, { club: "iron", power: 90, timingMs: 0, aim: 0 });
    const fromFairway = playPracticeShot({ ...start, ball: { x: tree.x, y: tree.y }, lie: "fairway" }, player, { club: "iron", power: 90, timingMs: 0, aim: 0 });
    expect(fromTree.strokes[0]!.yards).toBeLessThan(fromFairway.strokes[0]!.yards);
  });
});
