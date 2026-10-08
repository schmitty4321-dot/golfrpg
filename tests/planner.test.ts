import { describe, expect, it } from "vitest";
import { ACTIVITIES, EVENT_WEEK_ACTIVITIES, OFF_WEEK_ACTIVITIES, applyPlan, createWorld, fitPlan } from "../src/season";

describe("the weekly planner", () => {
  it("before an event, each activity but rest fills one day only", () => {
    expect(fitPlan(["practice", "practice", "range"], 3, EVENT_WEEK_ACTIVITIES, true)).toEqual(["practice", "rest", "range"]);
    expect(fitPlan(["rest", "rest", "gym"], 3, EVENT_WEEK_ACTIVITIES, true)).toEqual(["rest", "rest", "gym"]);
    // A week off is his to fill as he likes.
    expect(fitPlan(["range", "range", "gym"], 3, OFF_WEEK_ACTIVITIES)).toEqual(["range", "range", "gym"]);
  });

  it("media days earn reputation once a week across the agency; gym recovers, range sharpens", () => {
    const w = createWorld({ seed: 77, scenario: "agency" });
    const [a, b] = w.clientIds.map((id) => w.players[id]!);
    const rep = w.agency.reputation;
    applyPlan(w, a!, ["media", "media", "rest"]);
    const once = w.agency.reputation - rep;
    expect(once).toBeGreaterThan(0);
    applyPlan(w, b!, ["media", "rest", "rest"]);
    expect(w.agency.reputation - rep).toBeCloseTo(once, 6);
    const cond = b!.player.condition;
    const form = b!.player.form;
    applyPlan(w, b!, ["gym", "range", "rest"]);
    expect(b!.player.condition).toBeCloseTo(Math.min(100, cond + 2 + ACTIVITIES.range.condition), 6);
    expect(b!.player.form).toBeGreaterThan(form);
    expect(ACTIVITIES.practice.condition).toBe(-1);
  });
});
