import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { holeLayout, REAL_COURSES, type Shot } from "../src/engine";
import { illustratedArtFor, illustratedShotPaths, pointInsideArt, projectArtPoint, solveArtMatrix, type ArtEntry } from "../src/ui/illustratedArt";

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

  it("keeps penalty strokes in sequence and carries a snapped hazard landing into the drop", () => {
    const art: ArtEntry = {
      image: "test.png", width: 1000, height: 600,
      matrix: { x: [1, 0, 0], y: [0, 1, 0] },
      targets: { water: [{ x: 300, y: 250 }] },
    };
    const shots: Shot[] = [
      { stroke: 1, kind: "tee", club: "Driver", from: { x: 0, y: 0 }, to: { x: 200, y: 200 }, lie: "water", yards: 260, text: "Driver finds the water." },
      { stroke: 2, kind: "penalty", club: "", from: { x: 200, y: 200 }, to: { x: 210, y: 205 }, lie: "rough", yards: 0, text: "Penalty stroke." },
      { stroke: 3, kind: "approach", club: "5-iron", from: { x: 210, y: 205 }, to: { x: 400, y: 100 }, lie: "green", yards: 185, text: "5-iron to the green." },
    ];

    const paths = illustratedShotPaths(art, shots);
    expect(paths.map((path) => path.shot.stroke)).toEqual([1, 2, 3]);
    expect(paths[0]!.end).toEqual({ x: 300, y: 250 });
    expect(paths[1]!.start).toEqual(paths[0]!.end);
    expect(paths[2]!.start).toEqual(paths[1]!.end);
  });

  it("snaps green approaches and the holed putt to the illustrated green", () => {
    const art: ArtEntry = {
      image: "test.png", width: 1000, height: 600,
      matrix: { x: [1, 0, 0], y: [0, 1, 0] },
      targets: { green: [{ x: 780, y: 100 }], holed: [{ x: 800, y: 80 }] },
    };
    const shots: Shot[] = [
      { stroke: 1, kind: "approach", club: "6-iron", from: { x: 200, y: 300 }, to: { x: 700, y: 100 }, lie: "green", yards: 179, feet: 5, text: "6-iron to 5 ft." },
      { stroke: 2, kind: "putt", club: "Putter", from: { x: 700, y: 100 }, to: { x: 710, y: 90 }, lie: "holed", yards: 2, feet: 0, text: "Holes the 5-footer." },
    ];

    const paths = illustratedShotPaths(art, shots);
    expect(paths[0]!.end).toEqual({ x: 780, y: 100 });
    expect(paths[1]!.start).toEqual(paths[0]!.end);
    expect(paths[1]!.end).toEqual({ x: 800, y: 80 });
  });
});
