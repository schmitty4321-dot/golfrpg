import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getCourse, holeLayout } from "../src/engine";
import { aerialMatrix } from "../src/ui/holeMaps";

describe("aerial photos", () => {
  it("line up with the hole: a green on the course map lands on the green in the drawing", () => {
    for (const [cid, n] of [["tpc-sawgrass", 17], ["augusta-national", 12], ["pebble-beach", 18]] as const) {
      const data = JSON.parse(readFileSync(`public/holes/${cid}.json`, "utf8"));
      const h = data.holes[String(n)];
      const course = getCourse(cid);
      const L = holeLayout(course, course.holes[n - 1]!);
      const [ox, oy, th, s] = h.frame as [number, number, number, number];
      // A point in the hole's frame, taken back to course yards...
      const [hx, hy] = [L.green.x, L.green.y];
      const x = (hx * Math.cos(th) + hy * Math.sin(th)) / s + ox;
      const y = (-hx * Math.sin(th) + hy * Math.cos(th)) / s + oy;
      // ...and through the photo's matrix, lands where the drawing puts it.
      const [a, b, c, d, e, f] = aerialMatrix(h.frame, L.bounds.minX, L.bounds.maxY);
      expect(a * x + c * -y + e).toBeCloseTo(hx - L.bounds.minX, 6);
      expect(b * x + d * -y + f).toBeCloseTo(L.bounds.maxY - hy, 6);
      // The photo covers it.
      const [x0, x1, y0, y1] = data.aerial.box;
      expect(x > x0 && x < x1 && y > y0 && y < y1).toBe(true);
      expect(existsSync(`public/${data.aerial.file}`)).toBe(true);
    }
  });

  it("are only for courses in the US", () => {
    const royal = JSON.parse(readFileSync("public/holes/royal-birkdale.json", "utf8"));
    expect(royal.aerial).toBeUndefined();
  });
});
