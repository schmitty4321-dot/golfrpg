import { describe, expect, it } from "vitest";
import { createRng } from "../src/engine";

describe("rng", () => {
  it("is reproducible from a seed", () => {
    const a = createRng(123);
    const b = createRng(123);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it("draws normals with the requested mean and spread", () => {
    const rng = createRng(7);
    const xs = Array.from({ length: 20000 }, () => rng.normal(5, 2));
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length);
    expect(mean).toBeCloseTo(5, 1);
    expect(sd).toBeCloseTo(2, 1);
  });

  it("keeps int() inside its inclusive bounds", () => {
    const rng = createRng(9);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(rng.int(3, 6));
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });
});
