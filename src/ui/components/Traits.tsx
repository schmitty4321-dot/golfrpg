import type { ReactNode } from "react";
import { TRAIT_BY_ID, TRAIT_CATEGORY_LABELS, type TraitCategory } from "../../engine";

/** A line drawing for each kind of trait, on a 24-unit grid. */
const CATEGORY_GLYPHS: Record<TraitCategory, ReactNode> = {
  // Shot-making: a target.
  shot: <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></>,
  // Short game and putting: a flag in the cup.
  short: <><path d="M8 20V4l9 3.5L8 11" /><ellipse cx="11" cy="20" rx="7" ry="1.6" /></>,
  // Mental: a steady pulse.
  mental: <path d="M2 13h4l2.5-6 4 11 3-8 1.5 3H22" />,
  // Venue and conditions: sun and cloud.
  venue: <><circle cx="9" cy="9" r="3.5" /><path d="M9 2v1.5M2 9h1.5M4 4l1 1M14 4l-1 1" /><path d="M8 19h10a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.5 1.5A2.8 2.8 0 0 0 8 19z" /></>,
  // Schedule and fitness: a calendar.
  schedule: <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4M8 14h2M12 14h2M16 14h0.5" /></>,
  // Development: a rising line.
  development: <><path d="M3 18l6-6 4 4 8-9" /><path d="M15 7h6v6" /></>,
  // Personality: a speech bubble.
  personality: <path d="M4 5h16v11H10l-5 4v-4H4z" />,
  // Commercial: a coin.
  commercial: <><circle cx="12" cy="12" r="9" /><path d="M15 9c-.5-1.2-1.7-2-3-2-1.7 0-3 1-3 2.4 0 3.2 6 1.8 6 5 0 1.4-1.3 2.6-3 2.6-1.4 0-2.6-.8-3-2M12 5v2M12 17v2" /></>,
  // Legendary: a crown.
  legendary: <path d="M3 18h18l-1.5-10-4.5 4-3-7-3 7-4.5-4z" />,
};

/** A trait's medallion: its kind as a symbol, green for a strength, red for a weakness, amber for both; rarer traits get a brighter rim. */
export function TraitIcon({ id, size = 34 }: { id: string; size?: number }) {
  const t = TRAIT_BY_ID.get(id);
  if (!t) return null;
  return (
    <span className={`trait-icon pol-${t.polarity} rim-${t.rarity}`} style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {CATEGORY_GLYPHS[t.category]}
      </svg>
    </span>
  );
}

/** A trait's name as a small chip, coloured by rarity; the effect shows on hover. */
/** A bronze, silver or gold medal for a trait or archetype's mastery. */
export function TierMedal({ tier }: { tier: "bronze" | "silver" | "gold" }) {
  return <span className={`tier-medal tier-${tier}`} title={`${tier[0]!.toUpperCase()}${tier.slice(1)}: its skills grow ${tier === "gold" ? "20%" : tier === "silver" ? "10%" : "at the normal rate, for now"} faster`}>{tier === "gold" ? "Gold" : tier === "silver" ? "Silver" : "Bronze"}</span>;
}

export function TraitChip({ id, dark, tier }: { id: string; dark?: boolean; tier?: "bronze" | "silver" | "gold" }) {
  const t = TRAIT_BY_ID.get(id);
  if (!t) return null;
  return (
    <span className={`trait-chip rarity-${t.rarity}${dark ? " on-dark" : ""}`} title={`${t.name} (${t.rarity}): ${t.effect}`}>
      {t.polarity === "positive" ? "▲ " : t.polarity === "negative" ? "▼ " : "◆ "}
      {t.name}
      {tier && <> <TierMedal tier={tier} /></>}
    </span>
  );
}

/** A player's traits in a table cell: small chips, the effect on hover. */
export function TraitChips({ ids, empty = "—" }: { ids: string[]; empty?: string }) {
  if (ids.length === 0) return <span className="muted small">{empty}</span>;
  return (
    <span className="trait-chips">
      {ids.map((id) => <TraitChip key={id} id={id} />)}
    </span>
  );
}

/** Every trait with what it does. */
export function TraitList({ ids, hiddenNote }: { ids: string[]; hiddenNote?: string }) {
  return (
    <div className="trait-list">
      {ids.length === 0 && <p className="empty" style={{ margin: 0 }}>None spotted yet.</p>}
      {ids.map((id) => {
        const t = TRAIT_BY_ID.get(id);
        if (!t) return null;
        return (
          <div key={id} className={`trait-card rarity-${t.rarity} with-icon`}>
            <TraitIcon id={id} />
            <div className="trait-card-body">
            <div className="trait-card-head">
              <strong>{t.name}</strong>
              <span className={`trait-tag rarity-${t.rarity}`}>{t.rarity}</span>
              <span className={`trait-tag pol-${t.polarity}`}>{t.polarity === "positive" ? "Strength" : t.polarity === "negative" ? "Weakness" : "Mixed"}</span>
              <span className="muted small">{TRAIT_CATEGORY_LABELS[t.category]}</span>
            </div>
            <div className="secondary small trait-blurb">{t.blurb}</div>
            <div className="small">{t.effect}</div>
            </div>
          </div>
        );
      })}
      {hiddenNote && <p className="muted small" style={{ margin: 0 }}>{hiddenNote}</p>}
    </div>
  );
}
