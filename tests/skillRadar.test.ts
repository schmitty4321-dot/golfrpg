import { describe, expect, it } from "vitest";
import { ATTRIBUTE_GROUPS, type AttributeKey } from "../src/engine";
import { groupAverages, type StatView } from "../src/ui/components/StatBoxes";

const exact = (value: number, potential?: number): StatView => ({ low: value, high: value, value, ...(potential === undefined ? {} : { potential }) });

describe("skill radar group averages", () => {
  it("averages each group, in the order the skill boxes show them", () => {
    const view = (k: AttributeKey) => exact(k === "drivingDistance" ? 16 : 12, 15);
    const groups = groupAverages(view);
    expect(groups.map((g) => g.group)).toEqual(Object.keys(ATTRIBUTE_GROUPS));
    const longGame = groups.find((g) => g.group === "longGame")!;
    expect(longGame.current).toBeCloseTo((16 + 12 * (ATTRIBUTE_GROUPS.longGame.length - 1)) / ATTRIBUTE_GROUPS.longGame.length, 6);
    expect(longGame.potential).toBe(15);
  });

  it("leaves potential out when his ceiling isn't known", () => {
    const groups = groupAverages(() => exact(11));
    expect(groups.every((g) => g.potential === undefined && g.current === 11)).toBe(true);
  });

  it("uses the scouts' best estimate for a player known only as a range", () => {
    const groups = groupAverages(() => ({ low: 10, high: 14, value: 12 }));
    expect(groups[0]!.current).toBe(12);
  });
});
