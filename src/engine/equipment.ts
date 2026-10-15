/**
 * The bag: four slots (driver, irons, wedges, putter), each with a few models
 * that trade one thing for another. "Tour standard" is what the field plays
 * and changes nothing, so only your clients' choices move them. Caddies live
 * here too: what a good caddie is worth on the course.
 */
import type { Player, StrokesGained } from "./types";

export type EquipmentSlot = "driver" | "irons" | "wedges" | "putter";
export const EQUIPMENT_SLOTS: EquipmentSlot[] = ["driver", "irons", "wedges", "putter"];
export const SLOT_LABELS: Record<EquipmentSlot, string> = { driver: "Driver", irons: "Irons", wedges: "Wedges", putter: "Putter" };

/** Apparel: a hat, a shirt and shoes. Bought like clubs; they sit in the same bag of models. */
export type ApparelSlot = "hat" | "shirt" | "shoes";
export const APPAREL_SLOTS: ApparelSlot[] = ["hat", "shirt", "shoes"];
export const APPAREL_LABELS: Record<ApparelSlot, string> = { hat: "Hat", shirt: "Shirt", shoes: "Shoes" };
export type GearSlot = EquipmentSlot | ApparelSlot;

export interface EquipmentModel {
  id: string;
  slot: GearSlot;
  name: string;
  price: number;
  blurb: string;
  /** Strokes gained a round by category (positive helps). */
  sg?: Partial<StrokesGained>;
  /** Multipliers on how much a category swings from round to round. */
  spread?: Partial<StrokesGained>;
  /** Yards added to how far he reaches par 5s in two. */
  reach?: number;
  /** Multiplier on greenside bunker costs. */
  bunker?: number;
  /** Multiplier on big numbers where the landing area is tight. */
  tightBlowup?: number;
  /** Strokes gained around the green when the greens are firm (and lost when soft). */
  firm?: number;
  /** Strokes gained a round when it rains (and nothing when it's dry). */
  wet?: Partial<StrokesGained>;
}

export const STANDARD: Record<EquipmentSlot, string> = { driver: "driver-standard", irons: "irons-standard", wedges: "wedges-standard", putter: "putter-standard" };

const CORE_EQUIPMENT: readonly EquipmentModel[] = [
  { id: "driver-standard", slot: "driver", name: "Tour Standard 10.5°", price: 0, blurb: "What most of the tour plays." },
  { id: "driver-bomber", slot: "driver", name: "Talon Bomber XL", price: 9_000, blurb: "Low spin, huge ball speed. Finds the rough more often.", sg: { offTheTee: 0.06 }, spread: { offTheTee: 1.12 }, reach: 12, tightBlowup: 1.08 },
  { id: "driver-fairway", slot: "driver", name: "Kinetic Fairway Finder", price: 7_500, blurb: "High forgiveness, a tighter pattern, a few yards shorter.", spread: { offTheTee: 0.88 }, reach: -6, tightBlowup: 0.92 },
  { id: "driver-adjustable", slot: "driver", name: "Arcline Adjustable Pro", price: 12_000, blurb: "Tuned to his swing on a launch monitor.", sg: { offTheTee: 0.03 } },

  { id: "irons-standard", slot: "irons", name: "Tour Standard Cavity", price: 0, blurb: "What most of the tour plays." },
  { id: "irons-blades", slot: "irons", name: "Forged Theory Blades", price: 14_000, blurb: "Pure feel and control; punishing off the toe.", sg: { approach: 0.07 }, spread: { approach: 1.12 } },
  { id: "irons-gi", slot: "irons", name: "Vantage Game-Improvement", price: 9_000, blurb: "Forgiving and steady, a touch less precise.", sg: { approach: -0.02 }, spread: { approach: 0.85 } },
  { id: "irons-combo", slot: "irons", name: "Forged Theory Combo Set", price: 16_000, blurb: "Blades in the scoring clubs, cavities in the long irons.", sg: { approach: 0.04 } },

  { id: "wedges-standard", slot: "wedges", name: "Tour Standard Wedges", price: 0, blurb: "What most of the tour plays." },
  { id: "wedges-spin", slot: "wedges", name: "Talon Spin-Milled", price: 4_000, blurb: "Fresh grooves every month: more check on chips.", sg: { aroundTheGreen: 0.05 } },
  { id: "wedges-low", slot: "wedges", name: "Linksmith Low Bounce", price: 3_500, blurb: "Nipping it off tight lies; digs in soft turf.", firm: 0.08 },
  { id: "wedges-wide", slot: "wedges", name: "Hollow Oak Wide Sole", price: 3_500, blurb: "Glides through sand.", bunker: 0.75, sg: { aroundTheGreen: -0.01 } },

  { id: "putter-standard", slot: "putter", name: "Tour Standard Blade", price: 0, blurb: "What most of the tour plays." },
  { id: "putter-milled", slot: "putter", name: "Meridian Milled Blade", price: 6_000, blurb: "Buttery feel, for a player who trusts his stroke.", sg: { putting: 0.05 }, spread: { putting: 1.1 } },
  { id: "putter-mallet", slot: "putter", name: "Grayson High-MOI Mallet", price: 5_500, blurb: "Stable through the stroke; fewer bad putting days.", spread: { putting: 0.85 } },
  { id: "putter-broom", slot: "putter", name: "Northcourse Broomstick", price: 5_000, blurb: "Anchored to the chest: calm hands under pressure.", sg: { putting: 0.02 }, spread: { putting: 0.9 } },
];

const MAKERS = ["Talon", "Kinetic", "Arcline", "Meridian", "Grayson", "Northcourse", "Linksmith", "Hollow Oak", "Vantage", "Aeroform"];
const LINES = ["Apex", "Vector", "Tour", "Forge", "Pulse", "Carbon", "Precision", "Velocity", "Control", "Heritage"];
const EDITIONS = ["One", "Pro", "Max", "LS", "X", "Elite", "Core", "GT", "Prime", "Studio"];

function generatedEquipment(slot: EquipmentSlot): EquipmentModel[] {
  const out: EquipmentModel[] = [];
  for (let i = 0; i < 96; i++) {
    const maker = MAKERS[i % MAKERS.length]!;
    const line = LINES[Math.floor(i / 10) % LINES.length]!;
    const edition = EDITIONS[(i * 7 + Math.floor(i / 10)) % EDITIONS.length]!;
    const band = i % 8;
    const premium = Math.floor(i / 24);
    const priceBase = slot === "driver" ? 6_000 : slot === "irons" ? 9_000 : slot === "wedges" ? 3_000 : 3_500;
    const price = Math.round((priceBase + premium * 2_500 + band * 450) / 100) * 100;
    const id = `${slot}-catalog-${String(i + 1).padStart(2, "0")}`;
    if (slot === "driver") {
      const power = band % 2 === 0;
      out.push({ id, slot, name: `${maker} ${line} ${edition}`, price, blurb: power ? "Fast face and a penetrating flight." : "A forgiving head built to keep more drives in play.", sg: power ? { offTheTee: 0.015 + premium * 0.012 } : undefined, spread: { offTheTee: power ? 1.02 + premium * 0.02 : 0.97 - premium * 0.015 }, reach: power ? 3 + premium * 3 : -1 - premium, tightBlowup: power ? 1.01 + premium * 0.015 : 0.98 - premium * 0.012 });
    } else if (slot === "irons") {
      const control = band % 3 !== 0;
      out.push({ id, slot, name: `${maker} ${line} ${edition}`, price, blurb: control ? "Consistent launch and precise distance control." : "Compact shaping with extra workability.", sg: { approach: (control ? 0.012 : 0.02) + premium * 0.012 }, spread: { approach: control ? 0.98 - premium * 0.015 : 1.02 + premium * 0.018 } });
    } else if (slot === "wedges") {
      const sand = band % 3 === 0;
      out.push({ id, slot, name: `${maker} ${line} ${edition}`, price, blurb: sand ? "A versatile sole that slides cleanly through sand." : "Fresh grooves provide predictable flight and check.", sg: { aroundTheGreen: 0.008 + premium * 0.012 }, ...(sand ? { bunker: 0.94 - premium * 0.035 } : { firm: 0.02 + premium * 0.015 }) });
    } else {
      const stable = band % 2 === 0;
      out.push({ id, slot, name: `${maker} ${line} ${edition}`, price, blurb: stable ? "High stability helps the face return square." : "A responsive face rewards a confident stroke.", sg: stable ? undefined : { putting: 0.01 + premium * 0.012 }, spread: { putting: stable ? 0.97 - premium * 0.018 : 1.01 + premium * 0.012 } });
    }
  }
  return out;
}

/** A 400-model market: 100 choices in each of the four bag slots. */
/** Apparel: small effects, bought for the client like clubs. Good in the rain or the wind, or steady over a round. */
const APPAREL: readonly EquipmentModel[] = [
  { id: "ap-visor", slot: "hat", name: "Tour Visor", price: 450, blurb: "Cuts the glare on the greens.", sg: { putting: 0.04 } },
  { id: "ap-rain-cap", slot: "hat", name: "Storm Brim Cap", price: 600, blurb: "Keeps the rain off his eyes.", wet: { offTheTee: 0.06, approach: 0.04 } },
  { id: "ap-aero-cap", slot: "hat", name: "Aero Tour Cap", price: 800, blurb: "A low-profile cap that stays settled through the swing.", spread: { offTheTee: 0.97 } },
  { id: "ap-wide-brim", slot: "hat", name: "Heritage Sun Hat", price: 650, blurb: "A wide brim makes long practice days easier.", sg: { aroundTheGreen: 0.03 } },
  { id: "ap-cooling-cap", slot: "hat", name: "Cooling Mesh Cap", price: 900, blurb: "Ventilated panels keep his concentration steady.", spread: { approach: 0.97, putting: 0.97 } },
  { id: "ap-compression", slot: "shirt", name: "Compression Base Layer", price: 700, blurb: "Holds the swing together over 18 holes.", spread: { offTheTee: 0.95, approach: 0.95 } },
  { id: "ap-rain-shell", slot: "shirt", name: "Waterproof Shell", price: 1_400, blurb: "Stays dry on wet days.", wet: { approach: 0.05, putting: 0.04 } },
  { id: "ap-tour-polo", slot: "shirt", name: "Tailored Tour Polo", price: 850, blurb: "A precise cut that moves cleanly through impact.", sg: { approach: 0.03 } },
  { id: "ap-quarter-zip", slot: "shirt", name: "Thermal Quarter-Zip", price: 1_100, blurb: "Warm, quiet fabric for cold and wet rounds.", wet: { offTheTee: 0.03, approach: 0.03 } },
  { id: "ap-motion-polo", slot: "shirt", name: "Freedom Motion Polo", price: 1_000, blurb: "Stretch panels keep the full swing unrestricted.", spread: { offTheTee: 0.97, approach: 0.97 } },
  { id: "ap-spikeless", slot: "shoes", name: "Spikeless Grip Shoes", price: 900, blurb: "Grips firm turf; slips when it's wet.", firm: 0.05 },
  { id: "ap-spiked", slot: "shoes", name: "Tour Spikes", price: 1_200, blurb: "Bites into soft, wet turf around the greens.", wet: { aroundTheGreen: 0.05 } },
  { id: "ap-stability", slot: "shoes", name: "Stability Platform Shoes", price: 1_350, blurb: "A grounded base keeps approach swings repeatable.", spread: { approach: 0.96 } },
  { id: "ap-waterproof-shoes", slot: "shoes", name: "All-Weather High Shoes", price: 1_500, blurb: "Sealed uppers and deep traction for wet weeks.", wet: { approach: 0.03, aroundTheGreen: 0.03 } },
  { id: "ap-lightweight", slot: "shoes", name: "Featherweight Tour Shoes", price: 1_100, blurb: "Light, responsive shoes for an athletic move.", sg: { offTheTee: 0.02, putting: 0.02 } },
];

export const EQUIPMENT: readonly EquipmentModel[] = [
  ...CORE_EQUIPMENT,
  ...EQUIPMENT_SLOTS.flatMap(generatedEquipment),
  ...APPAREL,
];

export const EQUIPMENT_BY_ID: ReadonlyMap<string, EquipmentModel> = new Map(EQUIPMENT.map((e) => [e.id, e]));

/** The apparel he's wearing (nothing where a slot is empty). */
export function apparelOf(p: Player): EquipmentModel[] {
  return APPAREL_SLOTS.map((s) => EQUIPMENT_BY_ID.get(p.equipment?.[s] ?? "")).filter((m): m is EquipmentModel => !!m);
}

/** The models in a player's bag (tour standard where he hasn't chosen). */
export function bagOf(p: Player): EquipmentModel[] {
  return EQUIPMENT_SLOTS.map((s) => EQUIPMENT_BY_ID.get(p.equipment?.[s] ?? STANDARD[s]) ?? EQUIPMENT_BY_ID.get(STANDARD[s])!);
}

/** A round's effect of his bag: strokes gained, spreads, and the course conditions some clubs care about. */
export function equipmentRound(p: Player, firmDry: boolean, rain: boolean): { sg: StrokesGained; spread: StrokesGained } {
  const sg: StrokesGained = { offTheTee: 0, approach: 0, aroundTheGreen: 0, putting: 0 };
  const spread: StrokesGained = { offTheTee: 1, approach: 1, aroundTheGreen: 1, putting: 1 };
  if (!p.equipment) return { sg, spread };
  for (const m of [...bagOf(p), ...apparelOf(p)]) {
    for (const k of Object.keys(m.sg ?? {}) as (keyof StrokesGained)[]) sg[k] += m.sg![k]!;
    if (rain) for (const k of Object.keys(m.wet ?? {}) as (keyof StrokesGained)[]) sg[k] += m.wet![k]!;
    for (const k of Object.keys(m.spread ?? {}) as (keyof StrokesGained)[]) spread[k] *= m.spread![k]!;
    if (m.firm) sg.aroundTheGreen += firmDry ? m.firm : rain ? -m.firm / 2 : 0;
  }
  return { sg, spread };
}

/** Hole-level effects of his bag. */
export function equipmentHole(p: Player, fairwayWidth: number, bunkerCost: number): { mean: number; blowup: number } {
  if (!p.equipment) return { mean: 0, blowup: 1 };
  let mean = 0;
  let blowup = 1;
  for (const m of bagOf(p)) {
    if (m.bunker) mean += bunkerCost * (m.bunker - 1);
    if (m.tightBlowup && fairwayWidth > 0 && fairwayWidth < 27) blowup *= m.tightBlowup;
  }
  return { mean, blowup };
}

/** Yards his driver adds to (or takes from) his reach in two. */
export const equipmentReach = (p: Player): number => (p.equipment ? bagOf(p).reduce((s, m) => s + (m.reach ?? 0), 0) : 0);

// ------------------------------------------------------------------ caddies

/** A caddie as the course sees him: three skills (1-20) and his chemistry with the player (0-100). */
export interface CaddieOnBag {
  greenReading: number;
  clubbing: number;
  calm: number;
  chemistry: number;
}

/** What a caddie is worth a round, as strokes gained (10 = an ordinary tour caddie). */
export function caddieRound(c: CaddieOnBag | undefined): { approach: number; putting: number } {
  if (!c) return { approach: 0, putting: 0 };
  const bond = 0.6 + (0.4 * c.chemistry) / 100;
  return { approach: (c.clubbing - 10) * 0.006 * bond, putting: (c.greenReading - 10) * 0.007 * bond };
}

/** How much of weekend pressure a calm caddie takes away (0-0.4). */
export function caddieCalm(c: CaddieOnBag | undefined): number {
  if (!c) return 0;
  return Math.max(0, ((c.calm - 10) / 10) * 0.4 * (0.6 + (0.4 * c.chemistry) / 100));
}
