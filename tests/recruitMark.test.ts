import { describe, expect, it } from "vitest";
import { FIRST_CALL, createWorld, prospectOf, recruitMark } from "../src/season";

describe("recruited marks on the desk", () => {
  it("are none until you've worked on a prospect, then recruiting, then keen at the first-call interest", () => {
    const w = createWorld({ seed: 21, scenario: "rookie" });
    const id = Object.keys(w.players).find((k) => !w.players[k]!.client)!;
    expect(recruitMark(w, id)).toBe("none");
    prospectOf(w, id).interest = FIRST_CALL - 1;
    expect(recruitMark(w, id)).toBe("recruiting");
    prospectOf(w, id).interest = FIRST_CALL;
    expect(recruitMark(w, id)).toBe("keen");
  });
});
