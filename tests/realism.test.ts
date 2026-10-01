import { describe, expect, it } from "vitest";
import { createWorld } from "../src/season";
import { compareToAnchors, measureRealism, type MetricKey } from "../src/season/realism";

/**
 * A short realism run on every test pass. These measures should stay close
 * to real golf (Data Golf); the full report (npm run realism) also covers
 * careers and rookie outcomes, which need 12+ seasons.
 */
const MUST_HOLD: MetricKey[] = ["roundScatter", "spreadApproach", "spreadAroundGreen", "spreadPutting", "fieldVsReal", "age35to37", "age38to41"];

describe("realism against Data Golf", () => {
  it("keeps round scatter, skill spread, scoring and late-career decline close to real golf", () => {
    const rows = compareToAnchors(measureRealism(createWorld({ seed: 11, scenario: "rookie" }), 3));
    for (const key of MUST_HOLD) {
      const row = rows.find((r) => r.key === key)!;
      expect.soft(row.close, `${row.label}: sim ${row.sim?.toFixed(2)} vs real ${row.real}`).toBe(true);
    }
  }, 120_000);
});
