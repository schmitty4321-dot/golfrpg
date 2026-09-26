import { ALL_ATTRIBUTES, TOUR_AVERAGE, type Attributes, type Player } from "../engine";

/** A tour-average golfer: 12 in everything, neutral fit, fresh. */
export function flatTourAverage(id: string): Player {
  return {
    id,
    name: `Player ${id}`,
    nationality: "USA",
    age: 28,
    attributes: Object.fromEntries(ALL_ATTRIBUTES.map((k) => [k, TOUR_AVERAGE])) as Attributes,
    grassPreference: "bentgrass",
    styleComfort: { links: 12, parkland: 12, desert: 12, resort: 12 },
    peakAge: 31,
    form: 0,
    condition: 95,
  };
}
