import { describe, expect, it } from "vitest";
import { APPAREL_SLOTS, EQUIPMENT_BY_ID, apparelOf, equipmentRound, generatePlayer, createRng } from "../src/engine";
import { createWorld, equip } from "../src/season";

describe("apparel", () => {
  it("apparel slots are a hat, a shirt and shoes, and each slot has models", () => {
    expect(APPAREL_SLOTS).toEqual(["hat", "shirt", "shoes"]);
    for (const slot of APPAREL_SLOTS) {
      const models = [...EQUIPMENT_BY_ID.values()].filter((m) => m.slot === slot);
      expect(models.length).toBeGreaterThan(0);
    }
  });

  it("rain gear helps when it rains, and does nothing on a dry day", () => {
    const p = generatePlayer(createRng(19), { tier: "tour", nationality: "USA" });
    p.equipment = { shirt: "ap-rain-shell" };
    expect(apparelOf(p).map((m) => m.id)).toEqual(["ap-rain-shell"]);
    const wet = equipmentRound(p, false, true).sg.approach;
    const dry = equipmentRound(p, false, false).sg.approach;
    const bare = equipmentRound({ ...p, equipment: {} }, false, true).sg.approach;
    expect(wet).toBeGreaterThan(bare);
    expect(dry).toBe(bare);
  });

  it("buying apparel charges the client and puts the item on", () => {
    const world = createWorld({ seed: 31, scenario: "agency" });
    const id = world.clientIds[0]!;
    const wp = world.players[id]!;
    const before = wp.client!.finances.equipment ?? 0;
    equip(world, id, "ap-spiked");
    expect(wp.client!.finances.equipment ?? 0).toBe(before + EQUIPMENT_BY_ID.get("ap-spiked")!.price);
    expect(wp.player.equipment?.shoes).toBe("ap-spiked");
    expect(wp.client!.ownedEquipment).toContain("ap-spiked");
  });
});
