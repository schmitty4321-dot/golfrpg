import { describe, expect, it } from "vitest";
import { buildTour } from "../src/season";
import { LOGO_EVENTS, logoSpec } from "../src/ui/components/TournamentLogo";

describe("tournament logos", () => {
  const { courses, schedule } = buildTour(1);
  const tour = schedule.filter((e) => e.tier !== "dev");

  it("has a hand-set logo for every event on the real tour", () => {
    for (const e of tour) expect(LOGO_EVENTS).toContain(e.name);
    expect(new Set(tour.map((e) => logoSpec(e).motif)).size).toBeGreaterThanOrEqual(18);
  });

  it("builds a logo for any other event from its venue", () => {
    const dev = schedule.find((e) => e.tier === "dev")!;
    const course = courses.find((c) => c.id === dev.courseId)!;
    const spec = logoSpec(dev, course);
    expect(spec.main.length).toBeGreaterThan(0);
    expect(logoSpec({ name: "Harrow Pines Classic", tier: "standard" }, { style: "links" })).toMatchObject({ motif: "links", main: "Harrow Pines", sub: "Classic" });
    expect(logoSpec({ name: "Some Major", tier: "major" }).motif).toBe("laurel");
  });
});
