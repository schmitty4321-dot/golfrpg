import { describeEffects, pendingDecisions, recentDecisions, type World } from "../../season";
import type { Game } from "../useGame";

/** The week's decisions about your clients: answer them, or they take their default when you play on. */
export function InboxPanel({ world, game }: { world: World; game: Game }) {
  const pending = pendingDecisions(world);
  const recent = recentDecisions(world, 3);
  if (world.clientIds.length === 0 && pending.length === 0) return null;
  const pause = world.agency.pauseOnDecisions !== false;
  return (
    <section className="panel inbox" aria-label="Inbox">
      <div className="panel-head">
        <h2>Inbox{pending.length ? <span className="badge badge-accent" style={{ marginLeft: 8 }}>{pending.length}</span> : null}</h2>
        <label className="small muted" style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={pause} onChange={() => game.act((w) => (w.agency.pauseOnDecisions = !pause))} />
          Stop long sims for big decisions
        </label>
      </div>
      {pending.length === 0 ? (
        <p className="empty" style={{ marginTop: 0 }}>Nothing waiting. Decisions about your clients turn up here between weeks.</p>
      ) : (
        <div className="inbox-cards">
          {pending.map((d) => (
            <article key={d.id} className={`inbox-card${d.big ? " inbox-big" : ""}`}>
              <div className="small muted">{d.kind === "press" ? "Press conference" : d.kind === "message" ? "Message" : d.big ? "Big decision" : "Decision"}</div>
              <h3>{d.title}</h3>
              <p className="small" style={{ marginTop: 4 }}>{d.text}</p>
              <div className="inbox-choices">
                {d.choices.map((c) => (
                  <button key={c.id} className="inbox-choice" onClick={() => game.act((w) => game.lib.resolveDecision(w, d.id, c.id))}>
                    <strong>{c.label}</strong>
                    <span className="small">{c.detail}</span>
                    {c.effects.length > 0 && <span className="small muted">{describeEffects(c.effects)}</span>}
                    {c.id === d.defaultChoice && <span className="small muted">Default if you play on</span>}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
      {recent.length > 0 && (
        <ul className="news small" style={{ marginTop: 10 }}>
          {recent.map((d) => (
            <li key={d.id}>{d.resolved!.outcome}{d.resolved!.auto ? " (by default)" : ""}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
