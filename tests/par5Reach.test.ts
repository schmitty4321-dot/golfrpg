import { describe, expect, it } from "vitest";
import { REAL_COURSES, traceHole } from "../src/engine";
import { flatPlayer } from "./helpers";

describe("par 5 second shots", () => {
  it("a fairway wood never goes farther than his drive, and the score is kept", () => {
    const p = flatPlayer("r", 12);
    let checked = 0;
    for (const course of REAL_COURSES) {
      for (const hole of course.holes.filter((h) => h.par === 5 && h.yards >= 590)) {
        for (let seed = 0; seed < 15; seed++) {
          for (const score of [3, 4, 5]) {
            const t = traceHole({ course, hole, score, player: p, seed });
            expect(t.shots.length).toBe(score);
            const [drive, second] = t.shots;
            if (!drive || !second || drive.kind !== "tee" || drive.lie !== "fairway") continue;
            if (second.kind === "approach" || second.kind === "layup") {
              expect(second.yards, `${course.id} ${hole.number} seed ${seed} score ${score}`).toBeLessThanOrEqual(drive.yards);
              checked++;
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(50);
  });
});
