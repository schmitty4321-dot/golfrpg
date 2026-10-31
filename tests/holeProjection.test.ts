import { describe, expect, it } from "vitest";
import { createRng, generatePlayer, REAL_COURSES, traceHole } from "../src/engine";
import { holeProjection, projectedFlight } from "../src/ui/holeProjection";

const course = REAL_COURSES.find(c => c.id === "waialae")!;
const player = generatePlayer(createRng(19), { tier: "tour", nationality: "USA" });

describe("geometry-led Waialae projection", () => {
  it("keeps every shot endpoint, penalty drop and round pin in the same world frame", () => {
    for (const round of [0, 1, 2, 3]) for (const score of [3, 4, 5, 6, 7, 8]) {
      const trace = traceHole({ course, hole: course.holes[0]!, score, player, windMph: 9, seed: 42, round });
      const project = holeProjection(trace.layout);
      for (const shot of trace.shots) {
        expect(projectedFlight(shot, project, 0)).toEqual(project(shot.from));
        const end = projectedFlight(shot, project, 1);
        expect(end.x).toBeCloseTo(project(shot.to).x, 10);
        expect(end.y).toBeCloseTo(project(shot.to).y, 10);
        const mid = project({ x: (shot.from.x + shot.to.x) / 2, y: (shot.from.y + shot.to.y) / 2 });
        if (shot.kind === "putt" || shot.kind === "penalty") expect(projectedFlight(shot, project, .5)).toEqual(mid);
        else expect(projectedFlight(shot, project, .5).y).toBeLessThan(mid.y);
      }
      const last = trace.shots.at(-1)!;
      expect(project(last.to).x).toBeCloseTo(project(trace.layout.pin).x);
      expect(project(last.to).y).toBeCloseTo(project(trace.layout.pin).y);
      expect(trace.shots.length).toBe(score);
    }
  });
});
