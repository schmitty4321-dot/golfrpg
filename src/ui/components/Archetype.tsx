import { useId } from "react";
import { TierMedal } from "./Traits";
import { ARCHETYPES, type ArchetypeId } from "../../engine";

/**
 * Archetype badges: a coloured round badge with a white symbol, drawn on a
 * 24 x 24 grid. The symbols are fixed strings from this file, never player data.
 */
const GLYPHS: Record<ArchetypeId, string> = {
  power: '<circle cx="16.2" cy="12" r="4.4" fill="#fff" stroke="none"/><path d="M2.5 8.6h7M1.8 12h8M2.5 15.4h7"/>',
  precision: '<circle cx="12" cy="12" r="7.6"/><circle cx="12" cy="12" r="3.6"/><path d="M12 1.8v4.2M12 18v4.2M1.8 12H6M18 12h4.2"/><circle cx="12" cy="12" r="1.1" fill="#fff" stroke="none"/>',
  striker: '<path d="M7.5 2.5l5.2 12.8"/><path d="M12.4 14.6h7l-1.1 4H11z" fill="#fff"/><circle cx="6" cy="18.3" r="2.3" fill="#fff" stroke="none"/><path d="M2 14.6l1.5 1.5M1.6 19.4h2M3 23l1.3-1.3"/>',
  shotmaker: '<path d="M12 20C12 13.6 8.6 9.4 4.6 5.2"/><path d="M4.3 8.8L4.6 5.2l3.4 1.2"/><path d="M12 20c0-6.4 3.4-10.6 7.4-14.8"/><path d="M16 6.4l3.4-1.2.3 3.6"/><circle cx="12" cy="20.4" r="1.9" fill="#fff" stroke="none"/>',
  wedge: '<path d="M4.5 6.5h11.5L14 19.5H6.3z"/><path d="M7.4 10h7.1M7.8 13h6.3M8.2 16h5.5"/><path d="M16 6.5l3.6-4.5"/>',
  pinseeker: '<path d="M8.5 21.5V2.5l8.6 3.6-8.6 3.8"/><path d="M3.5 21.5h15"/><circle cx="13.6" cy="19.2" r="1.7" fill="#fff" stroke="none"/>',
  shortgame: '<path d="M4 17c2.2-8.4 8.6-11.2 14.4-6" stroke-dasharray="2 2.3"/><ellipse cx="18.4" cy="18.6" rx="3.6" ry="1.4"/><circle cx="4" cy="17" r="1.9" fill="#fff" stroke="none"/><path d="M19.6 2.5v4M17.6 4.5h4"/>',
  grinder: "",
  improviser: '<path d="M12 3.2l1.9 4.9 5.1.3-4 3.3 1.3 5-4.3-2.8-4.3 2.8 1.3-5-4-3.3 5.1-.3z" fill="#fff"/><path d="M4.5 19.5c2 1.6 4.4 2.2 7.5 2.2s5.5-.6 7.5-2.2" stroke-dasharray="1.6 2"/>',
  flatstick: '<path d="M14.6 2.5l-3.2 13.2"/><path d="M5.2 15.8h9.6v3.2H4.7z" fill="#fff"/><circle cx="19.2" cy="17.4" r="2.1" fill="#fff" stroke="none"/>',
  lag: '<path d="M3 18.2c5.2-8.6 10.2 0 15.4-6.4" stroke-dasharray="1.4 2.3"/><circle cx="3" cy="18.2" r="1.9" fill="#fff" stroke="none"/><ellipse cx="19.6" cy="11" rx="3" ry="1.2"/><path d="M19.6 11V3.5l3 1.4-3 1.4"/>',
  ice: '<path d="M12 2v20M3.3 7l17.4 10M20.7 7L3.3 17"/><path d="M9.3 3.6L12 6.2l2.7-2.6M9.3 20.4L12 17.8l2.7 2.6"/>',
  gambler: '<rect x="3" y="8.2" width="11" height="11" rx="2.3"/><rect x="11.4" y="3.2" width="9.4" height="9.4" rx="2" transform="rotate(14 16.1 7.9)"/><circle cx="6.1" cy="11.3" r="1" fill="#fff" stroke="none"/><circle cx="8.5" cy="13.7" r="1" fill="#fff" stroke="none"/><circle cx="10.9" cy="16.1" r="1" fill="#fff" stroke="none"/><circle cx="16.1" cy="7.9" r="1" fill="#fff" stroke="none"/>',
  closer: '<path d="M7 3.5h10v5.2a5 5 0 01-10 0z"/><path d="M7 5.5H4.4a2.6 2.6 0 002.9 3.6M17 5.5h2.6a2.6 2.6 0 01-2.9 3.6"/><path d="M12 13.8v4.2M8.2 21.5h7.6M9.6 18h4.8"/>',
  wind: '<path d="M2.5 8h10.2a3 3 0 10-3-3"/><path d="M2.5 12.2h15a3 3 0 11-3 3"/><path d="M2.5 16.4h7"/>',
  athlete: '<path d="M6 12h12"/><rect x="3" y="7.6" width="3" height="8.8" rx="1" fill="#fff"/><rect x="18" y="7.6" width="3" height="8.8" rx="1" fill="#fff"/><path d="M1.4 10v4M22.6 10v4"/>',
  oldpro: '<path d="M5.5 2.8h13M5.5 21.2h13"/><path d="M7 2.8c0 6 10 5.2 10 9.2s-10 3.2-10 9.2M17 2.8c0 6-10 5.2-10 9.2s10 3.2 10 9.2"/><path d="M9.2 19.4h5.6l-2.8-2.4z" fill="#fff" stroke="none"/>',
  wunderkind: '<path d="M12 2.2c3.4 2.4 5 5.8 5 9.8l-2.4 4.6H9.4L7 12c0-4 1.6-7.4 5-9.8z"/><circle cx="12" cy="9" r="1.7" fill="#fff" stroke="none"/><path d="M9.4 16.6l-2.6 2.6M14.6 16.6l2.6 2.6M12 17.8v4"/>',
  rangerat: '<path d="M4.6 11h14.8l-2.1 10.4H6.7z"/><path d="M5.6 15.4h12.8"/><circle cx="8.3" cy="8.2" r="2.3" fill="#fff" stroke="none"/><circle cx="12.9" cy="7.1" r="2.3" fill="#fff" stroke="none"/><circle cx="16.8" cy="9.1" r="2.1" fill="#fff" stroke="none"/>',
  allround: '<polygon points="12,2.8 19.9,7.4 19.9,16.6 12,21.2 4.1,16.6 4.1,7.4"/><polygon points="12,7 16.4,9.8 15.6,15.3 12,16.9 8.2,14.8 8.4,9.4" fill="#fff" stroke="none"/>',
};
// The Grinder's cog: sixteen corners around a ring.
GLYPHS.grinder = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    const r = i % 2 ? 7.2 : 9.6;
    for (const b of [a - Math.PI / 16, a + Math.PI / 16]) pts.push(`${(12 + r * Math.cos(b)).toFixed(2)},${(12 + r * Math.sin(b)).toFixed(2)}`);
  }
  return `<polygon points="${pts.join(" ")}" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.2"/>`;
})();

/** One archetype badge at any size. */
export function ArchetypeBadge({ id, size = 22 }: { id: ArchetypeId; size?: number }) {
  const a = ARCHETYPES[id];
  const g = `ab${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg className="archetype-badge" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={a.name}>
      <title>{`${a.name}: ${a.blurb}`}</title>
      <defs>
        <radialGradient id={g} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.22" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={a.color} />
      <circle cx="32" cy="32" r="30" fill={`url(#${g})`} />
      <circle cx="32" cy="32" r="26.5" fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="1.2" />
      <g transform="translate(15.8 15.8) scale(1.35)" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: GLYPHS[id] }} />
    </svg>
  );
}

/** Badge and name, for a player card. */
export function ArchetypePill({ id, tier }: { id: ArchetypeId; tier?: "bronze" | "silver" | "gold" }) {
  const a = ARCHETYPES[id];
  return (
    <span className="archetype-pill" title={a.blurb}>
      <ArchetypeBadge id={id} size={26} />
      <span>{a.name}</span>
      {tier && <TierMedal tier={tier} />}
    </span>
  );
}
