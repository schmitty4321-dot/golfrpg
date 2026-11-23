import { describe, expect, it } from "vitest";
import { EQUIPMENT_BY_ID, createRng, expectedStrokesGained, totalSg } from "../src/engine";
import {
  BRANDS,
  CLUB_SWITCH_PENALTY,
  COVERAGES,
  acceptSponsor,
  addSponsorship,
  applyEffects,
  brandMakes,
  clubSwitchCost,
  coveragesFor,
  createWorld,
  dealCoverageLabel,
  deserializeWorld,
  equip,
  equipBlock,
  fullBagDeal,
  kitWeek,
  maybeOffer,
  serializeWorld,
  withOwnClub,
  type SponsorOffer,
  type Sponsorship,
  type World,
} from "../src/season";

const base = createWorld({ seed: 91, scenario: "rookie" });
const fresh = (): World => deserializeWorld(serializeWorld(base));

const deal = (w: World, sponsor: string, slots: Sponsorship["slots"], extra: Partial<Sponsorship> = {}): Sponsorship => ({ id: `t-${sponsor}`, sponsor, category: "equipment", slots, annualValue: 1_000_000, winBonus: 100_000, majorBonus: 300_000, untilSeason: w.season + 1, ...extra });

describe("brands and what they make", () => {
  it("every equipment sponsor makes something, and offers only the slots it makes", () => {
    for (const b of BRANDS.equipment) {
      const options = coveragesFor(b);
      expect(options.length).toBeGreaterThan(0);
      for (const k of options) for (const s of COVERAGES[k].slots) expect(brandMakes(b, s)).toBe(true);
    }
    // A ball maker with no clubs offers a ball deal and nothing else.
    expect(coveragesFor("Apex Union")).toEqual(["ball"]);
    expect(coveragesFor("Talon Golf")).toContain("full");
  });

  it("a full bag pays about twice a putter-only deal, the ball least", () => {
    expect(COVERAGES.full.share / COVERAGES.putter.share).toBeCloseTo(2);
    expect(COVERAGES.ball.share).toBeLessThan(COVERAGES.putter.share);
  });
});

describe("an equipment deal", () => {
  it("puts the sponsor's clubs in the bag free and blocks other brands there", () => {
    const w = fresh();
    const id = w.clientIds[0]!;
    const wp = w.players[id]!;
    const spent = wp.client!.finances.equipment ?? 0;
    addSponsorship(w, wp, deal(w, "Talon Golf", [...COVERAGES.full.slots]));
    for (const s of COVERAGES.full.slots) expect(EQUIPMENT_BY_ID.get(wp.player.equipment![s]!)!.brand).toBe("Talon Golf");
    expect(wp.client!.finances.equipment ?? 0).toBe(spent);
    expect(equipBlock(w, id, "putter-milled")).toMatch(/Talon Golf deal covers his putter/);
    expect(() => equip(w, id, "irons-standard")).toThrow(/Talon Golf/);
    // Another Talon model in a covered slot is free; the ball isn't covered.
    const other = [...EQUIPMENT_BY_ID.values()].find((m) => m.brand === "Talon Golf" && m.slot === "irons" && m.id !== wp.player.equipment!.irons)!;
    equip(w, id, other.id);
    expect(wp.player.equipment!.irons).toBe(other.id);
    expect(wp.client!.finances.equipment ?? 0).toBe(spent);
    expect(equipBlock(w, id, "ball-wind")).toBeNull();
  });

  it("costs strokes at first and eases away over a few weeks", () => {
    const w = fresh();
    const wp = w.players[w.clientIds[0]!]!;
    const course = w.courses[0]!;
    const before = totalSg(expectedStrokesGained(wp.player, course));
    addSponsorship(w, wp, deal(w, "Talon Golf", [...COVERAGES.full.slots]));
    expect(clubSwitchCost(wp)).toBeCloseTo(CLUB_SWITCH_PENALTY[3]!);
    expect(clubSwitchCost(wp)).toBeGreaterThanOrEqual(0.1);
    expect(clubSwitchCost(wp)).toBeLessThanOrEqual(0.15);
    const bagGain = totalSg(expectedStrokesGained({ ...wp.player, kitAdjust: undefined }, course)) - before;
    expect(totalSg(expectedStrokesGained(wp.player, course)) - before - bagGain).toBeCloseTo(-CLUB_SWITCH_PENALTY[3]!);
    let weeks = 0;
    let last = clubSwitchCost(wp);
    while (wp.client!.clubSwitch && weeks < 10) {
      kitWeek(wp);
      weeks++;
      expect(clubSwitchCost(wp)).toBeLessThan(last);
      last = clubSwitchCost(wp);
    }
    expect(weeks).toBe(4);
    expect(wp.player.kitAdjust).toBeUndefined();
  });

  it("costs nothing to switch when he already plays the brand", () => {
    const w = fresh();
    const wp = w.players[w.clientIds[0]!]!;
    wp.player.equipment = { putter: "putter-milled" };
    addSponsorship(w, wp, deal(w, "Meridian", ["putter"]));
    expect(clubSwitchCost(wp)).toBe(0);
    expect(wp.player.equipment.putter).toBe("putter-milled");
  });

  it("an exception clause keeps his own putter for a little less money", () => {
    const w = fresh();
    const wp = w.players[w.clientIds[0]!]!;
    wp.player.equipment = { putter: "putter-mallet" };
    const full = deal(w, "Talon Golf", [...COVERAGES.full.slots]);
    const own = withOwnClub(full, "putter");
    expect(own.slots).toEqual(["driver", "irons", "wedges"]);
    expect(own.annualValue).toBeLessThan(full.annualValue);
    expect(own.annualValue).toBeGreaterThan(full.annualValue * 0.8);
    expect(dealCoverageLabel(own)).toBe("Full bag, his own putter");
    addSponsorship(w, wp, own);
    expect(wp.player.equipment.putter).toBe("putter-mallet");
    expect(equipBlock(w, wp.player.id, "putter-milled")).toBeNull();
    expect(clubSwitchCost(wp)).toBeCloseTo(CLUB_SWITCH_PENALTY[2]!);
  });

  it("old deals without slots leave the bag alone", () => {
    const w = fresh();
    const id = w.clientIds[0]!;
    const wp = w.players[id]!;
    addSponsorship(w, wp, deal(w, "Arcline", undefined));
    expect(wp.client!.clubSwitch).toBeUndefined();
    expect(equipBlock(w, id, "putter-standard")).toBeNull();
    expect(dealCoverageLabel(wp.client!.sponsors.at(-1)!)).toBe("His choice of clubs");
    const raw = JSON.parse(serializeWorld(w));
    const loaded = deserializeWorld(JSON.stringify(raw));
    expect(equipBlock(loaded, id, "irons-blades") ?? "").not.toMatch(/deal/);
  });
});

describe("equipment offers", () => {
  it("name the slots they cover, priced by coverage, and accepting one switches the bag", () => {
    const w = fresh();
    const id = w.clientIds[0]!;
    const wp = w.players[id]!;
    wp.career.status = "exempt";
    let offer: SponsorOffer | null = null;
    for (let i = 0; i < 400 && !offer; i++) {
      wp.client!.offers = [];
      wp.client!.sponsors = [];
      const o = maybeOffer(w, wp, createRng(1000 + i), 1);
      if (o?.category === "equipment") offer = o;
    }
    expect(offer).not.toBeNull();
    expect(offer!.slots!.length).toBeGreaterThan(0);
    for (const s of offer!.slots!) expect(brandMakes(offer!.sponsor, s)).toBe(true);
    wp.client!.offers = [offer!];
    acceptSponsor(w, id, offer!.id);
    const signed = wp.client!.sponsors.find((s) => s.category === "equipment")!;
    for (const s of signed.slots!) expect(EQUIPMENT_BY_ID.get(wp.player.equipment?.[s] ?? "")?.brand).toBe(offer!.sponsor);
  });

  it("the equipment-deal dilemma signs a real full-bag deal", () => {
    const w = fresh();
    const wp = w.players[w.clientIds[0]!]!;
    wp.career.status = "exempt";
    wp.client!.sponsors = [];
    const d = fullBagDeal(w, wp) ?? deal(w, "Talon Golf", [...COVERAGES.full.slots]);
    expect(d.slots).toEqual(COVERAGES.full.slots);
    const lines: string[] = [];
    applyEffects(w, wp, [{ k: "equipmentDeal", deal: d }], createRng(3), lines);
    expect(wp.client!.sponsors.some((s) => s.category === "equipment" && s.sponsor === d.sponsor)).toBe(true);
    expect(clubSwitchCost(wp)).toBeGreaterThan(0);
    // A second one bounces off.
    applyEffects(w, wp, [{ k: "equipmentDeal", deal: { ...d, id: "again" } }], createRng(3), lines);
    expect(lines.join(" ")).toMatch(/No deal/);
  });
});
