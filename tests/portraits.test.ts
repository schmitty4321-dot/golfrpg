import { describe, expect, it } from "vitest";
import { assignPortraits, golferPortraitIndex } from "../src/engine/portraits";
import { flatPlayer } from "./helpers";
import type { Player } from "../src/engine";

const wpOf = (p: Player) => ({ player: p });

describe("portraits stay with a player for his whole career", () => {
  it("gives a player a number once, and keeps it when he ages past the old bands", () => {
    const p = { ...flatPlayer("hank", 12), nationality: "USA", age: 27 } as Player;
    const wp = wpOf(p);
    assignPortraits([wp]);
    const first = p.portraitIndex!;
    expect(first).toBeGreaterThanOrEqual(1);
    expect(first).toBeLessThanOrEqual(400);
    // Older players used to get a different face (the age band changed); now the number is kept.
    p.age = 31;
    assignPortraits([wp]);
    p.age = 44;
    assignPortraits([wp]);
    expect(p.portraitIndex).toBe(first);
  });

  it("chooses a fitting number to start with, and only fills in players who don't have one", () => {
    const p = { ...flatPlayer("kim", 12), nationality: "KOR", age: 22 } as Player;
    const chosen = golferPortraitIndex(p);
    p.portraitIndex = 77;
    assignPortraits([wpOf(p)]);
    expect(p.portraitIndex).toBe(77);
    expect(chosen).toBeGreaterThanOrEqual(1);
  });
});
