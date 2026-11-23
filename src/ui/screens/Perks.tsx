import { PERKS, PERK_ACHIEVEMENTS, PERK_BRANCHES, ACHIEVEMENT_BY_ID, buyPerk, perkBlock, perkPoints, perkState, perksOf, type World } from "../../season";
import type { Game } from "../useGame";

/** The agency perk tree: points to spend, and four branches of five tiers. */
export function Perks({ world, game }: { world: World; game: Game }) {
  const points = perkPoints(world);
  const owned = perksOf(world).length;
  const landmarks = PERK_ACHIEVEMENTS.map((id) => ACHIEVEMENT_BY_ID.get(id)?.title).filter(Boolean).join(", ");
  return (
    <main>
      <section className="panel">
        <div className="panel-head">
          <h2>Perks</h2>
          <span className="small">
            <strong className={points ? "good-text" : ""}>{points}</strong> point{points === 1 ? "" : "s"} to spend · {owned} of {PERKS.length} owned
          </span>
        </div>
        <div className="tier-bar" style={{ width: "100%", height: 8 }}><span style={{ width: `${(100 * owned) / PERKS.length}%` }} /></div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          You earn a point for every season you finish, and one for each of these achievements: {landmarks}. Each perk costs one point and is kept for good. A tier opens once you own the perk above it.
        </p>
      </section>
      <div className="perk-tree">
        {PERK_BRANCHES.map((b) => (
          <section key={b.id} className="panel perk-branch">
            <div className="panel-head" style={{ marginBottom: 8 }}>
              <h3>{b.label}</h3>
              <span className="muted small">{b.blurb}</span>
            </div>
            <ol className="perk-list">
              {PERKS.filter((p) => p.branch === b.id).map((p) => {
                const state = perkState(world, p.id);
                const block = perkBlock(world, p.id);
                return (
                  <li key={p.id} className={`perk perk-${state}`}>
                    <div className="perk-top">
                      <span className="perk-tier">Tier {p.tier}</span>
                      <span className="perk-state">{state === "owned" ? "✓ Owned" : state === "available" ? "Available" : "Locked"}</span>
                    </div>
                    <strong>{p.name}</strong>
                    <div className="small">{p.effect}</div>
                    {state === "locked" && block && <div className="small muted">{block}</div>}
                    {state !== "owned" && (
                      <button className="btn btn-small" disabled={state !== "available"} onClick={() => game.act((w) => buyPerk(w, p.id))}>
                        Buy (1 point)
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </main>
  );
}
