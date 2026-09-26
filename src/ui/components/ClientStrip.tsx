import { pointsList, rankMap, STATUS_LABELS, type World } from "../../season";
import { formWord, money } from "../format";

export function ClientStrip({ world }: { world: World }) {
  const c = world.players[world.clientId]!;
  const pr = pointsList(world).indexOf(world.clientId) + 1;
  const wr = rankMap(world).get(world.clientId) ?? 0;
  const cond = Math.round(c.player.condition);
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h1 style={{ fontSize: 22 }}>{c.player.name}</h1>
          <div className="secondary small">
            {c.player.age} · {c.player.nationality} · <span className="badge badge-accent">{STATUS_LABELS[c.career.status]}</span>
          </div>
        </div>
        <div className="secondary small">Season {world.season} · Week {Math.min(world.week, 36)} of 36</div>
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
        <div className="stat">
          <span className="stat-label">Season earnings</span>
          <span className="stat-value">{money(c.career.seasonEarnings)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Agency bank</span>
          <span className="stat-value">{money(world.agencyBank)}</span>
          <span className="stat-sub">{Math.round(world.commissionRate * 100)}% commission</span>
        </div>
      </div>
    </section>
  );
}
