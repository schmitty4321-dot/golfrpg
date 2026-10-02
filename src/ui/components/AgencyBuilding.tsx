/** Production artwork for each step of the agency's office progression. */
export function AgencyBuilding({ tier, kind = "office" }: { tier: number; kind?: "office" | "center" }) {
  const file = `${kind === "center" ? "center" : "hq"}-${Math.max(0, Math.min(3, tier))}`;
  return <img className="agency-building" src={`/art/facilities/${file}.webp`} alt={`${kind === "center" ? "Training facility" : "Agency office"}, level ${tier + 1}`} loading="lazy" />;
}
