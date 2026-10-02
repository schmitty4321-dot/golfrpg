import { describe, expect, it } from "vitest";
import { traceHole, traceSeed } from "../src/engine";
import { createWorld, highlightReplay, latestHighlight, playWeek, seasonHighlights, seasonWeeks } from "../src/season";

describe("highlights", () => {
  it("keep a dramatic shot most weeks, and replay it on the tracer to the same score", () => {
    const w = createWorld({ seed: 81, scenario: "agency" });
    let weeks = 0;
    while (w.week <= Math.min(seasonWeeks(w), 12)) {
      playWeek(w);
      weeks++;
    }
    const all = w.highlights ?? [];
    expect(all.length).toBeGreaterThan(weeks / 2);
    for (const h of all) {
      expect(h.score).toBeLessThan(h.par); // every highlight is a birdie or better
      expect(h.drama).toBeGreaterThan(0);
    }
    const h = latestHighlight(w)!;
    const { result, row } = highlightReplay(w, h)!;
    const trace = traceHole({
      course: result.course,
      hole: result.course.holes[h.hole]!,
      score: row.holes[h.round]![h.hole]!,
      player: row.player,
      windMph: h.wind,
      seed: traceSeed(result.name, row.player.id, h.round, h.hole),
      call: row.calls?.[h.round]?.[h.hole] ?? null,
      round: h.round,
    });
    // The tracer's strokes (shots and penalties) always add up to the score.
    expect(trace.shots.length).toBe(h.score);
    const best = seasonHighlights(w, w.season, 3);
    for (let i = 1; i < best.length; i++) expect(best[i - 1]!.drama).toBeGreaterThanOrEqual(best[i]!.drama);
  });
});
