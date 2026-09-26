/** Share of the purse (%) by finishing position, modelled on a PGA Tour payout table. */
export const PAYOUT_PERCENT: readonly number[] = [
  18, 10.9, 6.9, 4.9, 4.1, 3.625, 3.375, 3.125, 2.925, 2.725,
  2.525, 2.325, 2.125, 1.925, 1.825, 1.725, 1.625, 1.525, 1.425, 1.325,
  1.225, 1.125, 1.045, 0.965, 0.885, 0.805, 0.775, 0.745, 0.715, 0.685,
  0.655, 0.625, 0.595, 0.57, 0.545, 0.52, 0.495, 0.475, 0.455, 0.435,
  0.415, 0.395, 0.375, 0.355, 0.335, 0.315, 0.295, 0.279, 0.265, 0.257,
  0.251, 0.245, 0.241, 0.237, 0.235, 0.233, 0.231, 0.229, 0.227, 0.225,
  0.223, 0.221, 0.219, 0.217, 0.215,
];

/**
 * Money for players tied from `position` (1-based) over `count` places: the
 * tied places' shares are pooled and split evenly, as on tour.
 */
export function tiedPayout(purse: number, position: number, count: number): number {
  let pct = 0;
  for (let i = position - 1; i < position - 1 + count; i++) pct += payoutPercent(i + 1);
  return Math.round((purse * pct) / 100 / count);
}

/**
 * Share for a finishing place. Everyone who makes the cut is paid: past the
 * table's 65 places the share keeps stepping down (never below 0.15%), and
 * as on tour those extra places are paid on top of the advertised purse.
 */
export function payoutPercent(position: number): number {
  const listed = PAYOUT_PERCENT[position - 1];
  if (listed !== undefined) return listed;
  return Math.max(0.15, PAYOUT_PERCENT[PAYOUT_PERCENT.length - 1]! - 0.002 * (position - PAYOUT_PERCENT.length));
}
