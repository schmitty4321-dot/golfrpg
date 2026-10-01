import { useState } from "react";
import { SCENARIOS, STYLES, parsePlayerDatabase, type DatabasePlayer, type Scenario, type WorldStyle } from "../../season";
import type { Game } from "../useGame";

export function NewGame({ game }: { game: Game }) {
  const [scenario, setScenario] = useState<Scenario>("agency");
  const [style, setStyle] = useState<WorldStyle>("realistic");
  const [seed, setSeed] = useState("");
  const [name, setName] = useState("");
  const [db, setDb] = useState<{ players: DatabasePlayer[]; errors: string[]; file: string } | null>(null);
  const start = () => {
    const n = seed.trim() === "" ? Math.floor(Math.random() * 1e9) : Number(seed) || hash(seed);
    void game.newGame(scenario, n, name.trim() || undefined, db?.players.length ? db.players : undefined, style);
  };
  return (
    <main>
      <div className="hero">
        <h1>Fairway Manager</h1>
        <p className="secondary" style={{ margin: 0, maxWidth: 640 }}>
          You've just opened a golf agency. Your first client has signed. Plan his schedule, hire his coaches, find him
          sponsors, then scout the tour for more players and grow the business. You earn a commission on everything
          your clients win and endorse.
        </p>
      </div>
      <section className="panel">
        <div className="panel-head"><h2>Your agency</h2></div>
        <div className="scenario-grid">
          {(["agency"] as Scenario[]).map((k) => (
            <button key={k} className="scenario" aria-pressed={scenario === k} onClick={() => setScenario(k)}>
              <strong>{SCENARIOS[k].title}</strong>
              <span className="secondary small">{SCENARIOS[k].blurb}</span>
            </button>
          ))}
        </div>
        <div className="panel-head" style={{ marginTop: 16 }}><h2>Realism</h2></div>
        <div className="scenario-grid">
          {(Object.keys(STYLES) as WorldStyle[]).map((k) => (
            <button key={k} className="scenario" aria-pressed={style === k} onClick={() => setStyle(k)}>
              <strong>{STYLES[k].label}</strong>
              <span className="secondary small">{STYLES[k].blurb}</span>
            </button>
          ))}
        </div>
        <div className="btn-row" style={{ marginTop: 16, alignItems: "center" }}>
          <label className="secondary small" htmlFor="agency">Agency name</label>
          <input id="agency" type="text" placeholder="Your Agency" value={name} onChange={(e) => setName(e.target.value)} style={{ width: 200 }} maxLength={40} />
          <label className="secondary small" htmlFor="seed">World seed</label>
          <input id="seed" type="text" placeholder="random" value={seed} onChange={(e) => setSeed(e.target.value)} style={{ width: 140 }} />
          <button className="btn btn-primary" onClick={start}>Start career</button>
        </div>
        <p className="muted small">The same seed always builds the same world: players, courses and calendar.</p>
        <div className="btn-row" style={{ alignItems: "center", marginTop: 8 }}>
          <label className="secondary small" htmlFor="db">Player database (optional)</label>
          <input
            id="db"
            type="file"
            accept="application/json,.json"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return setDb(null);
              setDb({ ...parsePlayerDatabase(await f.text()), file: f.name });
            }}
          />
        </div>
        {db && (
          <p className={`small ${db.players.length ? "" : "bad-text"}`} role="status">
            {db.players.length
              ? `${db.file}: ${db.players.length} players will be used, and generated players fill any gaps so every field is full.`
              : "No usable players in that file."}
            {db.errors.length > 0 && ` ${db.errors.length} entr${db.errors.length === 1 ? "y was" : "ies were"} skipped (${db.errors[0]}${db.errors.length > 1 ? " …" : ""}).`}
          </p>
        )}
      </section>
    </main>
  );
}

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return h;
}
