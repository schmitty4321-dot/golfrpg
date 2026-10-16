import { describe, expect, it } from "vitest";
import { distinctPortraits } from "../src/engine/portraits";
import { createWorld } from "../src/season";

describe("client portraits", () => {
  it("starting clients never share a face", () => {
    for (let seed = 1; seed <= 4; seed++) {
      const w = createWorld({ seed, scenario: "agency" });
      const faces = w.clientIds.map((id) => w.players[id]!.player.portraitIndex);
      expect(new Set(faces).size, `seed ${seed}`).toBe(faces.length);
    }
  }, 180_000);

  it("moves a duplicate to another face from the same pool and leaves the first alone", () => {
    const w = createWorld({ seed: 7, scenario: "agency" });
    const [a, b] = w.clientIds.map((id) => w.players[id]!);
    const before = a!.player.portraitIndex;
    b!.player.portraitIndex = before;
    distinctPortraits([a!, b!]);
    expect(a!.player.portraitIndex).toBe(before);
    expect(b!.player.portraitIndex).not.toBe(before);
    expect(b!.player.portraitIndex).toBeGreaterThanOrEqual(201);
  });
});
