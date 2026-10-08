import { describe, expect, it } from "vitest";
import { REAL_COURSES, callOdds, createRng, decisionsFor, generateTourField, getCourse, holeFindings, markAsked, nextDecisions, playLiveHole, startLive, startLiveRound, type Hole, type HoleSituation } from "../src/engine";
import { flatPlayer } from "./helpers";

const field = generateTourField(createRng(5), 120);
const calm: HoleSituation = { round: 1, index: 5, behind: 2, cutMargin: null, wind: 5, rain: false, lastOverPar: 0, condition: 90 };
const kinds = (course: ReturnType<typeof getCourse>, hole: Hole, s: HoleSituation = calm) => decisionsFor(hole, course, flatPlayer("p", 12), s).map((d) => d.kind);

describe("the eight hole-specific questions", () => {
  it("come from the hole's length, the course map, the tour's numbers, the greens and his condition", () => {
    const sawgrass = getCourse("tpc-sawgrass");
    const short = sawgrass.holes.find((h) => h.par === 3 && h.yards <= 165)!;
    const long = sawgrass.holes.find((h) => h.par === 3 && h.yards >= 215)!;
    expect(kinds(sawgrass, short)).toContain("chase");
    expect(kinds(sawgrass, long)).toContain("longThree");
    // One hardest hole and at most one scoring hole per rated course.
    const hardest = sawgrass.holes.filter((h) => kinds(sawgrass, h).includes("hardest"));
    expect(hardest).toHaveLength(1);
    expect(hardest[0]!.tourAverage! - hardest[0]!.par).toBeGreaterThanOrEqual(0.2);
    expect(sawgrass.holes.filter((h) => kinds(sawgrass, h).includes("scoring")).length).toBeLessThanOrEqual(1);
    // The course map: somewhere on tour there are fairway bunkers at driving distance, and a sharp dogleg.
    let sand = 0;
    let bends = 0;
    for (const c of REAL_COURSES) {
      for (const h of c.holes) {
        const f = holeFindings(c, h);
        if (f.bunkersAtDrive >= 1) {
          sand++;
          expect(kinds(c, h)).toContain("bunkerCarry");
        }
        if (f.dogleg >= 25) {
          bends++;
          expect(kinds(c, h)).toContain("dogleg");
        }
      }
    }
    expect(sand).toBeGreaterThan(5);
    expect(bends).toBeGreaterThan(5);
    // Fast greens ask how he'll putt them; slow ones don't.
    const fast = REAL_COURSES.find((c) => c.greenSpeed >= 12.5)!;
    const slow = REAL_COURSES.find((c) => c.greenSpeed < 12.5)!;
    expect(kinds(fast, fast.holes[0]!)).toContain("speed");
    expect(kinds(slow, slow.holes[0]!)).not.toContain("speed");
    // Running on empty late in the week, and only then.
    const tired = { ...calm, round: 4, index: 12, condition: 50 };
    expect(kinds(sawgrass, sawgrass.holes[12]!, tired)).toContain("energy");
    expect(kinds(sawgrass, sawgrass.holes[12]!, { ...tired, condition: 85 })).not.toContain("energy");
    expect(kinds(sawgrass, sawgrass.holes[12]!, { ...tired, round: 1 })).not.toContain("energy");
  });

  it("no question is put to him twice in a round", () => {
    const t = startLive({ name: "Once", course: getCourse("tpc-sawgrass"), field, purse: 9_000_000, seed: 3, cutTop: 65 }, field[10]!.id);
    for (let round = 0; round < 2; round++) {
      startLiveRound(t);
      const seen = new Set<string>();
      let asked = 0;
      while (t.live[field[10]!.id]) {
        const ds = nextDecisions(t);
        for (const d of ds) {
          expect(seen.has(d.kind)).toBe(false);
          seen.add(d.kind);
        }
        asked += ds.length;
        markAsked(t, field[10]!.id, ds.map((d) => d.kind));
        playLiveHole(t, null);
      }
      expect(asked).toBeGreaterThan(5);
    }
  });

  it("chasing a short-par-3 flag buys birdies and pays in bogeys, like every bold call", () => {
    const course = getCourse("tpc-sawgrass");
    const idx = course.holes.findIndex((h) => h.par === 3 && h.yards <= 165);
    const p = flatPlayer("avg", 12);
    const t = startLive({ name: "Chase", course, field: [...field.slice(0, 40), p, ...field.slice(41)], purse: 9_000_000, seed: 3, cutTop: 65 }, p.id);
    startLiveRound(t);
    for (let i = 0; i < idx; i++) playLiveHole(t);
    const flag = callOdds(t, { chase: "flag" });
    const fat = callOdds(t, { chase: "fat" });
    expect(flag.birdie).toBeGreaterThan(fat.birdie);
    expect(flag.bogey).toBeGreaterThan(fat.bogey);
  });
});
