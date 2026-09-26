import { describeTendencies, tendencies, type Player } from "../../engine";

/** How a player misses, shapes and flies the ball, plays holes and putts. */
export function TendenciesPanel({ player }: { player: Player }) {
  const rows = describeTendencies(tendencies(player));
  return (
    <div className="tendencies">
      {rows.map((r) => (
        <div key={r.label} className="tendency">
          <span className="stat-label">{r.label}</span>
          <strong>{r.value}</strong>
          <span className="secondary small">{r.detail}</span>
        </div>
      ))}
    </div>
  );
}
