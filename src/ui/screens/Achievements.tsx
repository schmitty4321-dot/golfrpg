import { ACHIEVEMENTS, type AchievementGroup, type World } from "../../season";

const GROUPS: AchievementGroup[] = ["Career", "Agency", "Management", "Story"];

/** Every achievement: the ones you've unlocked (and when), and the ones still to come. */
export function AchievementsScreen({ world }: { world: World }) {
  const got = world.achievements ?? {};
  const done = ACHIEVEMENTS.filter((a) => got[a.id]).length;
  return (
    <main>
      <section className="panel">
        <div className="panel-head">
          <h2>Achievements</h2>
          <span className="small"><strong>{done}</strong> of {ACHIEVEMENTS.length} unlocked</span>
        </div>
        <div className="tier-bar" style={{ width: "100%", height: 8 }}><span style={{ width: `${(100 * done) / ACHIEVEMENTS.length}%` }} /></div>
        <p className="muted small" style={{ marginBottom: 0 }}>Each one unlocks once and adds a little to your reputation.</p>
      </section>
      {GROUPS.map((g) => (
        <section key={g} className="panel">
          <div className="panel-head"><h2>{g}</h2></div>
          <div className="achievement-grid">
            {ACHIEVEMENTS.filter((a) => a.group === g).map((a) => {
              const when = got[a.id];
              return (
                <div key={a.id} className={`achievement${when ? " unlocked" : ""}`}>
                  <div className="achievement-icon" aria-hidden>{when ? "★" : "☆"}</div>
                  <div>
                    <strong>{a.title}</strong>
                    <div className="small">{a.detail}</div>
                    <div className="small muted">{when ? `Season ${when.season}, week ${when.week} · +${a.reward} reputation` : `Worth +${a.reward} reputation`}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
