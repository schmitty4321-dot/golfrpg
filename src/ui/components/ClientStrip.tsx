import { pointsList, rankMap, STATUS_LABELS, type World } from "../../season";
import { formWord, money } from "../format";
import { Nation } from "./Flag";

export function ClientStrip({ world, clientId }: { world: World; clientId: string }) {
  const c = world.players[clientId]!;
  const m = c.client!;
  const pr = pointsList(world).indexOf(clientId) + 1;
  const wr = rankMap(world).get(clientId) ?? 0;
  const cond = Math.round(c.player.condition);
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h1 style={{ fontSize: 22 }}>{c.player.name}</h1>
          <div className="secondary small">
            {c.player.age} · <Nation nationality={c.player.nationality} /> · <span className="badge badge-accent">{STATUS_LABELS[c.career.status]}</span>
          </div>
        </div>
        <div className="secondary small">
          Contract: {Math.round(m.contract.commission * 100)}% until end of season {m.contract.untilSeason}
        </div>
      </div>
      <div className="stat-row">
        <div className="stat">
          <span className="stat-label">Points list</span>
          <span className="stat-value">{pr ? `#${pr}` : "—"}</span>
          <span className="stat-sub">{Math.round(c.career.seasonPoints)} pts</span>
        </div>
        <div className="stat">
          <span className="stat-label">World rank</span>
          <span className="stat-value">#{wr}</span>
        </div>
        <div className="stat" style={{ minWidth: 120 }}>
          <span className="stat-label">Condition</span>
          <span className="stat-value">{cond}%</span>
          <div className="meter" aria-hidden><span style={{ width: `${cond}%`, background: cond < 65 ? "var(--serious)" : undefined }} /></div>
        </div>
        <div className="stat">
          <span className="stat-label">Form</span>
          <span className="stat-value">{formWord(c.player.form)}</span>
        </div>
        <div className="stat" style={{ minWidth: 120 }}>
          <span className="stat-label">Happiness</span>
          <span className="stat-value">{Math.round(m.happiness)}</span>
          <div className="meter" aria-hidden><span style={{ width: `${m.happiness}%`, background: m.happiness < 45 ? "var(--serious)" : undefined }} /></div>
        </div>
        <div className="stat">
          <span className="stat-label">Season earnings</span>
          <span className="stat-value">{money(c.career.seasonEarnings)}</span>
        </div>
      </div>
      {c.injury && (
        <p className="bad-text" style={{ marginBottom: 0 }}>
          <strong>Injured:</strong> {c.injury.name}, about {c.injury.weeksLeft} more week{c.injury.weeksLeft === 1 ? "" : "s"}.
        </p>
      )}
      {c.rebuild && (
        <p className="secondary" style={{ marginBottom: 0 }}>
          Swing rebuild: {c.rebuild.weeksLeft} of {c.rebuild.totalWeeks} weeks left. Expect his ball-striking to be off.
        </p>
      )}
    </section>
  );
}
