const HQ_ART = ["hq-boutique", "hq-regional", "hq-national", "hq-global"];

/** Production artwork for each step of the agency's office progression. */
export function AgencyBuilding({ tier, kind = "office" }: { tier: number; kind?: "office" | "center" }) {
  const file = HQ_ART[Math.max(0, Math.min(HQ_ART.length - 1, tier))]!;
  return <img className="agency-building" src={`/agency/${file}.webp`} alt={`${kind === "center" ? "Training facility" : "Agency office"}, level ${tier + 1}`} loading="lazy" />;
}
