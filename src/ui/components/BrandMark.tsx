import type { SponsorCategory } from "../../season";
import type { CSSProperties } from "react";

const COLORS: Record<SponsorCategory, string> = {
  equipment: "#276a50", apparel: "#8a5147", watch: "#66558b",
  financial: "#9a7426", automotive: "#356681", beverage: "#2b7b83",
};

export function BrandMark({ name, category }: { name: string; category: SponsorCategory }) {
  const initials = name.split(/\s|&/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("");
  return (
    <span className="brand-mark" style={{ "--brand-color": COLORS[category] } as CSSProperties} aria-hidden>
      <span>{initials}</span>
    </span>
  );
}
