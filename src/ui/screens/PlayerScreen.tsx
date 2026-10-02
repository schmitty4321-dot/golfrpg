import { nationInfo, traitsOf, type AttributeKey } from "../../engine";
import { PromisesPanel } from "../components/Promises";
import { ARCHETYPES } from "../../engine";
import { HOT, rivalriesOf, ARCHETYPE_KEY, GOLD_AT, SILVER_AT, STATUS_LABELS, TRAIT_BY_ID_NAME, abilityView, attributePotential, masteries, masteryPoints, masteryTier, seasonChange, tierProgress, type World } from "../../season";
import { TierMedal } from "../components/Traits";
import { AbilityBars } from "../components/AbilityBars";
import { PortraitCard } from "../components/Portrait";
import { StatBoxes, StatLegend } from "../components/StatBoxes";
import { TraitList } from "../components/Traits";
import { FamiliarityPanel } from "../components/Familiarity";
import { TendenciesPanel } from "../components/TendenciesPanel";
import { formWord, money, signed, toPar } from "../format";
import { ArchetypePill } from "../components/Archetype";

export function PlayerScreen({ world, clientId }: { world: World; clientId: string }) {
  const wp = world.players[clientId]!;
  const p = wp.player;
  const c = wp.career;
  const season = c.results.filter((r) => r.season === world.season);
  const change = seasonChange(wp);
  const ability = abilityView(world, clientId);
  return (
    <main>
      <section className="panel">
        <div className="panel-head client-head">
          <PortraitCard player={p} size={64} title={p.name} />
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 22 }}>{p.name}</h1>
            <div className="secondary small">{p.age} · {nationInfo(p.nationality).name} · {STATUS_LABELS[c.status]}</div>
            {p.archetype && <div style={{ marginTop: 6 }}><ArchetypePill id={p.archetype} tier={masteryTier(wp, ARCHETYPE_KEY)} /></div>}
          </div>
        </div>
        <div className="stat-row">
          <div className="stat"><span className="stat-label">Career wins</span><span className="stat-value">{c.careerWins}</span></div>
          <div className="stat"><span className="stat-label">Career earnings</span><span className="stat-value">{money(c.careerEarnings)}</span></div>
          <div className="stat"><span className="stat-label">Form</span><span className="stat-value">{formWord(p.form)}</span></div>
          <div className="stat"><span className="stat-label">Condition</span><span className="stat-value">{Math.round(p.condition)}%</span></div>
        </div>
        <AbilityBars
          current={ability.current}
          potential={ability.potential}
          note={ability.coachQuality >= 14 ? "Potential is his coaches' estimate." : "Potential is his coaches' estimate; better coaches judge it more closely."}
        />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Attributes</h2>
          <span className="muted small"><StatLegend potential /> 1-20 · 12 is a tour average · Injury proneness: lower is better</span>
        </div>
        <StatBoxes
          view={(k: AttributeKey) => {
            const value = p.attributes[k];
            return { value, low: value, high: value, potential: attributePotential(p, k, ability.potential), change: change[k] };
          }}
        />
        <p className="muted small">Potential is his coaches' estimate of how far each skill can grow. Hidden traits (wind tolerance, grass preference, comfort on each style of course) show up only in results. Scouting comes later.</p>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Traits</h2><span className="muted small">What sets him apart, on the course and off it</span></div>
        <TraitList ids={[...traitsOf(p)]} />
      </section>

      <PromisesPanel world={world} wp={wp} />

      <section className="panel">
        <div className="panel-head"><h2>Rivalries</h2><span className="muted small">Heat {HOT}+ and it shows on the course when they meet</span></div>
        {rivalriesOf(world, clientId).length === 0 ? (
          <p className="empty">No rivalries yet. They start at a playoff, a Sunday duel, a match-play knockout or a Ryder Cup singles.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Rival</th><th>Heat</th><th className="num">Head to head</th><th>Last flashpoint</th></tr></thead>
              <tbody>
                {rivalriesOf(world, clientId).map((r) => (
                  <tr key={r.b}>
                    <td>{world.players[r.b]?.player.name ?? r.names.b}</td>
                    <td><span className="tier-bar"><span style={{ width: `${r.heat}%`, background: r.heat >= HOT ? "var(--critical)" : undefined }} /></span> <span className="small">{Math.round(r.heat)}</span></td>
                    <td className="num">{r.aWins}-{r.bWins}</td>
                    <td className="small muted">{r.last ? `${r.last.text} (season ${r.last.season}, week ${r.last.week})` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {masteries(wp).length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>Mastery</h2><span className="muted small">Silver: its skills grow 10% faster; gold: 20%</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Trait or archetype</th><th>Tier</th><th>Progress</th><th>Skills</th></tr></thead>
              <tbody>
                {masteries(wp).map(({ key, skills }) => {
                  const pts = masteryPoints(wp, key);
                  const tier = masteryTier(wp, key);
                  return (
                    <tr key={key}>
                      <td>{key === ARCHETYPE_KEY && p.archetype ? ARCHETYPES[p.archetype].name : TRAIT_BY_ID_NAME(key)}</td>
                      <td><TierMedal tier={tier} /></td>
                      <td className="small">
                        <span className="tier-bar"><span style={{ width: `${Math.round(tierProgress(pts) * 100)}%` }} /></span>{" "}
                        {tier === "gold" ? "Mastered" : `${Math.round(pts)} / ${tier === "silver" ? GOLD_AT : SILVER_AT}`}
                      </td>
                      <td className="small muted">{skills.map((k) => k.replace(/([A-Z])/g, " $1").toLowerCase()).join(", ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted small" style={{ marginBottom: 0 }}>Mastery builds every week: a point for an event played, half a point for a week off, double when his training focus works on those skills.</p>
        </section>
      )}

      <FamiliarityPanel world={world} wp={wp} />

      <section className="panel">
        <div className="panel-head"><h2>Tendencies</h2><span className="muted small">His habits: they show up in replays and round stats</span></div>
        <TendenciesPanel player={p} />
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Season {world.season} results</h2></div>
        {season.length === 0 ? (
          <p className="empty">No starts yet this season.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Week</th><th>Event</th><th>Pos</th><th className="num">Score</th><th className="num">Earnings</th><th className="num">Points</th><th className="num">SG / round</th></tr></thead>
              <tbody>
                {season.map((r) => (
                  <tr key={r.eventId}>
                    <td>{r.week}</td>
                    <td>{r.eventName}{r.via === "monday" ? <span className="muted small"> · Monday qualifier</span> : null}</td>
                    <td>{r.label}</td>
                    <td className="num">{toPar(r.toPar)}</td>
                    <td className="num">{r.earnings ? money(r.earnings) : "–"}</td>
                    <td className="num">{Math.round(r.seasonPoints)}</td>
                    <td className={`num ${r.sgPerRound >= 0 ? "good-text" : "bad-text"}`}>{signed(r.sgPerRound, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
