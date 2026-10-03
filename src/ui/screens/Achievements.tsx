import { ACHIEVEMENTS, type AchievementGroup, type World } from "../../season";

const GROUPS: AchievementGroup[] = ["Career", "Agency", "Management", "Story"];

const ICONS: Record<string, string> = {
  "first-win": "♛", "five-wins": "Ⅴ", "twenty-wins": "20", "first-major": "♜", "three-majors": "Ⅲ", dynasty: "♚",
  "grand-slam": "◆", "points-title": "№1", "players-champ": "Ⅴ", "match-play": "▦", "top-ten": "10", "world-no1": "1",
  "ryder-three": "♟", "ryder-hero": "⚑", ace: "●", "hall-of-famer": "HOF", "rep-50": "⌖", "rep-75": "✦",
  "rep-90": "A", "roster-5": "5", "roster-10": "10", millionaire: "$1M", "ten-million": "$10M", "profit-season": "↗",
  center: "⚒", "hq-top": "▥", "top-agency": "Ⅰ", survivor: "5Y", gold: "★", "promises-5": "✓", "counter-deal": "⇄",
  "decisions-25": "25", "press-10": "☏", "sponsors-3": "3", "followers-1m": "1M", friend: "☺", enemy: "!", grudge: "⚔", domination: "+5",
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
                  <div className="achievement-medal" aria-hidden><span>{ICONS[a.id] ?? "★"}</span></div>
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
