import { useState } from "react";
import { SCENARIOS, type Scenario } from "../../season";
import type { Game } from "../useGame";

export function NewGame({ game }: { game: Game }) {
  const [scenario, setScenario] = useState<Scenario>("rookie");
  const [seed, setSeed] = useState("");
  const start = () => {
    const n = seed.trim() === "" ? Math.floor(Math.random() * 1e9) : Number(seed) || hash(seed);
    void game.newGame(scenario, n);
  };
  return (
    <main>
      <div className="hero">
        <h1>Fairway Manager</h1>
        <p className="secondary" style={{ margin: 0, maxWidth: 640 }}>
          You run a golf agency. Sign your first client, plan his schedule week by week, and keep him on tour.
          Your agency earns 10% of everything he wins.
        </p>
      </div>
      <section className="panel">
        <div className="panel-head"><h2>Choose your first client</h2></div>
        <div className="scenario-grid">
          {(Object.keys(SCENARIOS) as Scenario[]).map((k) => (
            <button key={k} className="scenario" aria-pressed={scenario === k} onClick={() => setScenario(k)}>
              <strong>{SCENARIOS[k].title}</strong>
              <span className="secondary small">{SCENARIOS[k].blurb}</span>
            </button>
          ))}
        </div>
        <div className="btn-row" style={{ marginTop: 16, alignItems: "center" }}>
          <label className="secondary small" htmlFor="seed">World seed</label>
          <input id="seed" type="text" placeholder="random" value={seed} onChange={(e) => setSeed(e.target.value)} style={{ width: 140 }} />
          <button className="btn btn-primary" onClick={start}>Start career</button>
        </div>
        <p className="muted small">The same seed always builds the same world: players, courses and calendar.</p>
      </section>
    </main>
  );
}

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return h;
}
