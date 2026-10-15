/** Dollars: in full under a million ($300,000), then in millions to one decimal ($1.0M). */
export const money = (n: number): string => {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return abs >= 999_950 ? `${sign}$${(abs / 1_000_000).toFixed(1)}M` : `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
};
/** The same as money: kept for the places that always showed millions. */
export const millions = money;
export const toPar = (n: number): string => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
export const signed = (n: number, d = 1): string => (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(d);
export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;

export function formWord(f: number): string {
  if (f > 0.5) return "On fire";
  if (f > 0.2) return "Good";
  if (f > -0.2) return "Steady";
  if (f > -0.5) return "Poor";
  return "Slump";
}

export function fitWord(fit: number): { label: string; tone: "good" | "neutral" | "bad" } {
  if (fit > 0.2) return { label: "Great fit", tone: "good" };
  if (fit > 0.05) return { label: "Good fit", tone: "good" };
  if (fit > -0.05) return { label: "Neutral", tone: "neutral" };
  if (fit > -0.2) return { label: "Poor fit", tone: "bad" };
  return { label: "Bad fit", tone: "bad" };
}

export const TIER_LABELS = {
  major: "Major",
  signature: "Signature",
  standard: "Tour event",
  opposite: "Opposite field",
  playoff: "Playoff",
  finale: "Finale",
  dev: "Dev tour",
} as const;
