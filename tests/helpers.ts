import { ALL_ATTRIBUTES, type Attributes, type Player } from "../src/engine";

/** A player with every attribute at `level`, neutral fit, form and condition. */
export function flatPlayer(id: string, level: number, overrides: Partial<Attributes> = {}): Player {
  const attributes = Object.fromEntries(ALL_ATTRIBUTES.map((k) => [k, level])) as Attributes;
  return {
    id,
    name: `Player ${id}`,
    nationality: "USA",
    age: 28,
    attributes: { ...attributes, ...overrides },
    grassPreference: "bentgrass",
    styleComfort: { links: 12, parkland: 12, desert: 12, resort: 12 },
    peakAge: 31,
    form: 0,
    condition: 95,
  };
}
