import { schoolLabel, schoolOf, type World, type WorldPlayer } from "../../season";

const slug = (name: string) => name.toLowerCase().replaceAll("&", "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** The locally stored team mark for every college program used by the game. */
export function schoolLogoPath(name: string): string {
  return `/school-logos/${slug(name)}.${name === "Augusta" ? "svg" : "png"}`;
}

/** A compact school identity. The visible table cell is logo-only; its full label remains accessible. */
export function SchoolMark({ world, player, size = 30 }: { world: World; player: WorldPlayer; size?: number }) {
  const school = schoolOf(world, player);
  const label = schoolLabel(world, player) ?? "No school";
  if (!school) return <span className="school-mark school-mark-generic" aria-label={label} title={label}>—</span>;
  if (school.kind === "college") {
    return <img className="school-mark" src={schoolLogoPath(school.name)} width={size} height={size} alt={label} title={label} loading="lazy" />;
  }
  return (
    <span className="school-mark school-mark-generic" style={{ width: size, height: size }} aria-label={label} title={label}>
      {school.kind === "high" ? "HS" : "◎"}
    </span>
  );
}
