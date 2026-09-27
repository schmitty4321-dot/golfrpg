import { TRAIT_BY_ID, TRAIT_CATEGORY_LABELS } from "../../engine";

/** A trait's name as a small chip, coloured by rarity; the effect shows on hover. */
export function TraitChip({ id, dark }: { id: string; dark?: boolean }) {
  const t = TRAIT_BY_ID.get(id);
  if (!t) return null;
  return (
    <span className={`trait-chip rarity-${t.rarity}${dark ? " on-dark" : ""}`} title={`${t.name} (${t.rarity}): ${t.effect}`}>
      {t.polarity === "positive" ? "▲ " : t.polarity === "negative" ? "▼ " : "◆ "}
      {t.name}
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
          <div key={id} className={`trait-card rarity-${t.rarity}`}>
            <div className="trait-card-head">
              <strong>{t.name}</strong>
              <span className={`trait-tag rarity-${t.rarity}`}>{t.rarity}</span>
              <span className={`trait-tag pol-${t.polarity}`}>{t.polarity === "positive" ? "Strength" : t.polarity === "negative" ? "Weakness" : "Mixed"}</span>
              <span className="muted small">{TRAIT_CATEGORY_LABELS[t.category]}</span>
            </div>
            <div className="secondary small trait-blurb">{t.blurb}</div>
            <div className="small">{t.effect}</div>
          </div>
        );
      })}
      {hiddenNote && <p className="muted small" style={{ margin: 0 }}>{hiddenNote}</p>}
    </div>
  );
}
