import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { holeLayout, REAL_COURSES } from "../src/engine";
import { illustratedArtFor, pointInsideArt, projectArtPoint, solveArtMatrix } from "../src/ui/illustratedArt";

describe("illustrated tracer art", () => {
  it("solves and applies the same three-point affine calibration used by the tracer", () => {
    const anchors = [
      { world: { x: 0, y: 0 }, pixel: { x: 100, y: 700 } },
      { world: { x: -20, y: 250 }, pixel: { x: 800, y: 400 } },
      { world: { x: 5, y: 430 }, pixel: { x: 1450, y: 100 } },
    ];
    const matrix = solveArtMatrix(anchors);
    for (const anchor of anchors) {
      const projected = projectArtPoint(matrix, anchor.world);
      expect(projected.x).toBeCloseTo(anchor.pixel.x, 3);
      expect(projected.y).toBeCloseTo(anchor.pixel.y, 3);
    }
  });

  it("registers valid image-first tracers for the Waialae pilot holes", () => {
    const course = REAL_COURSES.find((candidate) => candidate.id === "waialae")!;
    for (const number of [1, 2, 3]) {
      const art = illustratedArtFor(course.id, number);
      expect(art, `Hole ${number} art`).toBeDefined();
      expect(art!.width / art!.height).toBeCloseTo(16 / 9, 2);
      expect(existsSync(`public/${art!.image}`), art!.image).toBe(true);
      const layout = holeLayout(course, course.holes[number - 1]!);
      expect(pointInsideArt(art!, layout.tee, 20), `Hole ${number} tee`).toBe(true);
      expect(pointInsideArt(art!, layout.green, 20), `Hole ${number} green`).toBe(true);
    }
  });
});
