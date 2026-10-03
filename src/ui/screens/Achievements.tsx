import { ACHIEVEMENTS, type AchievementGroup, type World } from "../../season";

const GROUPS: AchievementGroup[] = ["Career", "Agency", "Management", "Story"];

const BADGES: Record<string, string> = {
  "first-win": "trophy", "five-wins": "crown", "twenty-wins": "crown", "first-major": "major", "three-majors": "trophy", dynasty: "crown",
  "grand-slam": "major", "points-title": "world-no1", "players-champ": "trophy", "match-play": "calendar", "top-ten": "podium", "world-no1": "world-no1",
  "ryder-three": "ryder", "ryder-hero": "ryder", ace: "ace", "hall-of-famer": "major", "rep-50": "map", "rep-75": "headquarters",
  "rep-90": "agency", "roster-5": "roster", "roster-10": "full-house", millionaire: "bank", "ten-million": "wealth", "profit-season": "bank",
  center: "headquarters", "hq-top": "headquarters", "top-agency": "world-no1", survivor: "five-years", gold: "trophy", "promises-5": "agency", "counter-deal": "agency",
  "decisions-25": "calendar", "press-10": "agency", "sponsors-3": "bank", "followers-1m": "world-no1", friend: "roster", enemy: "major", grudge: "ryder", domination: "podium",
};

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
                <div key={a.id} className={`achievement achievement-${g.toLowerCase()}${when ? " unlocked" : ""}`}>
                  <div className="achievement-medal" aria-hidden>
                    <img src={`/art/achievements/${BADGES[a.id] ?? "trophy"}.png`} alt="" />
                  </div>
                  <div className="achievement-copy">
                    <strong>{a.title}</strong>
                    <div className="small">{a.detail}</div>
                    <div className="achievement-meta"><span>{when ? "✓ Unlocked" : "▣ Locked"}</span><b>+{a.reward} REP</b></div>
                    {when && <div className="small muted">Season {when.season}, week {when.week}</div>}
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
