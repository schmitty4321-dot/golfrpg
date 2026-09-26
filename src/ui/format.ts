export const money = (n: number): string => `$${Math.round(n).toLocaleString("en-US")}`;
export const millions = (n: number): string => `$${(n / 1_000_000).toFixed(1)}M`;
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
  finale: "Finale",
  dev: "Dev tour",
} as const;
