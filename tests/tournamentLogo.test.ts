import { describe, expect, it } from "vitest";
import { getCourse } from "../src/engine";
import { buildTour } from "../src/season";
import { LOGO_EVENTS, logoSpec, motifFor, wordmarkFor } from "../src/ui/components/TournamentLogo";

describe("tournament logos", () => {
  const { courses, schedule } = buildTour(1);
  const tour = schedule.filter((e) => e.tier !== "dev");
  const course = (id: string) => courses.find((c) => c.id === id)!;

  it("has a hand-set logo for every event on the real tour", () => {
    for (const e of tour) expect(LOGO_EVENTS).toContain(e.name);
    expect(new Set(tour.map((e) => logoSpec(e).motif)).size).toBeGreaterThanOrEqual(18);
  });

  it("keeps a renamed real event's colour and scene, with a wordmark from its new name", () => {
    const sony = tour.find((e) => e.name === "Sony Open in Hawaii")!;
    const renamed = logoSpec({ ...sony, name: "Honolulu Classic" }, course(sony.courseId));
    expect(renamed).toMatchObject({ motif: "tropical", color: logoSpec(sony).color, main: "Honolulu", sub: "Classic" });
    // Moved to a desert course, it takes the new venue's scene but keeps its colour.
    const moved = logoSpec({ ...sony, name: "Honolulu Classic", courseId: "pga-west-stadium" }, course("pga-west-stadium"));
    expect(moved.motif).toBe("desert");
    expect(moved.color).toBe(logoSpec(sony).color);
  });

  it("builds a fitting logo for any new event from where it's played", () => {
    const parkland = { style: "parkland" as const, name: "Oakmont Country Club" };
    expect(motifFor({ name: "Lakeside Open", tier: "standard" }, { style: "parkland", name: "Lakeside Golf Club" })).toBe("lakes");
    expect(motifFor({ name: "Mesa Ridge Classic", tier: "standard" }, { style: "parkland" })).toBe("desert");
    expect(motifFor({ name: "Chicago Classic", tier: "standard" }, { style: "parkland", name: "Medinah" })).toBe("skyline");
    expect(motifFor({ name: "Fort Worth Invitational", tier: "standard" }, parkland)).toBe("star");
    expect(motifFor({ name: "Yokohama Open", tier: "standard" }, course("yokohama"))).toBe("fuji");
    expect(motifFor({ name: "Toronto Classic", tier: "standard" }, course("osprey-valley-north"))).toBe("maple");
    expect(motifFor({ name: "North Berwick Open", tier: "standard" }, course("renaissance-club"))).toBe("links");
    expect(motifFor({ name: "Anything", tier: "major" }, parkland)).toBe("laurel");
    expect(motifFor({ name: "Harbor Town Invitational", tier: "standard" }, { style: "resort" })).toBe("tropical");
    expect(logoSpec({ name: "Harrow Pines Classic", tier: "standard" }, getCourse("harrow-pines"))).toMatchObject({ main: "Harrow Pines", sub: "Classic" });
  });

  it("gives the developmental tour a spread of scenes, the same every time", () => {
    const dev = schedule.filter((e) => e.tier === "dev");
    const motifs = dev.map((e) => logoSpec(e, course(e.courseId)).motif);
    expect(new Set(motifs).size).toBeGreaterThanOrEqual(4);
    expect(dev.map((e) => logoSpec(e, course(e.courseId)))).toEqual(dev.map((e) => logoSpec(e, course(e.courseId))));
  });

  it("sets wordmarks like the hand-set ones", () => {
    expect(wordmarkFor("Bank of Utah Championship")).toEqual({ main: "Bank of Utah", sub: "Championship" });
    expect(wordmarkFor("Zurich Classic of New Orleans")).toEqual({ main: "Zurich Classic", sub: "of New Orleans" });
    expect(wordmarkFor("The Heritage")).toEqual({ pre: "The", main: "Heritage" });
    expect(wordmarkFor("Boise Open")).toEqual({ main: "Boise Open" });
    expect(wordmarkFor("Cognizant Classic in The Palm Beaches")).toEqual({ main: "Cognizant Classic", sub: "in The Palm Beaches" });
  });
});
