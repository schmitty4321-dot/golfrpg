import { useState } from "react";
import { CHALLENGES, CHALLENGE_BY_ID, SCENARIOS, STYLES, parsePlayerDatabase, type DatabasePlayer, type Scenario, type WorldStyle } from "../../season";
import { bestScores } from "../components/Challenge";
import type { Game } from "../useGame";

export function NewGame({ game }: { game: Game }) {
  const [scenario, setScenario] = useState<Scenario>("agency");
  const [style, setStyle] = useState<WorldStyle>("realistic");
  const [seed, setSeed] = useState("");
  const [name, setName] = useState("");
  const [db, setDb] = useState<{ players: DatabasePlayer[]; errors: string[]; file: string } | null>(null);
  const [challenge, setChallenge] = useState<string | null>(null);
  const best = bestScores();
  const start = () => {
    const n = seed.trim() === "" ? Math.floor(Math.random() * 1e9) : Number(seed) || hash(seed);
    const def = challenge ? CHALLENGE_BY_ID.get(challenge) : undefined;
    void game.newGame(def?.scenario ?? scenario, n, name.trim() || undefined, db?.players.length ? db.players : undefined, style, def?.id);
  };
  return (
    <main>
      <div className="hero new-game-hero">
        <div className="new-game-hero-copy">
          <h1>Fairway Manager</h1>
          <p className="secondary">
            You've just opened a golf agency with three clients: a rookie, a 25-year-old and a veteran. Plan their
            schedules, hire their coaches, find them sponsors, then scout the tour for more players and grow the
            business. You earn a commission on everything your clients win and endorse, and every dollar you spend
            on one is a dollar you can't spend on the others.
          </p>
        </div>
        <img src="/art/new-game/career-hero.webp" alt="An agent planning the careers of three male golfers" />
      </div>
      <section className="panel">
        <div className="panel-head"><h2>Your agency</h2></div>
        <div className="scenario-grid">
          {(["agency"] as Scenario[]).map((k) => (
            <button key={k} className="scenario" aria-pressed={scenario === k && !challenge} onClick={() => { setScenario(k); setChallenge(null); }}>
              <strong>{SCENARIOS[k].title}</strong>
              <span className="secondary small">{SCENARIOS[k].blurb}</span>
            </button>
          ))}
        </div>
        <div className="panel-head" style={{ marginTop: 16 }}><h2>Or take on a challenge</h2><span className="muted small">A twist, a goal and a deadline</span></div>
        <div className="scenario-grid">
          {CHALLENGES.map((c) => (
            <button key={c.id} className="scenario" aria-pressed={challenge === c.id} onClick={() => setChallenge(challenge === c.id ? null : c.id)}>
              <BoardTile id={c.id} />
              <strong>{c.title}</strong>
              <span className="secondary small">{c.blurb}</span>
              <span className="small">{c.goal}</span>
              {best[c.id] !== undefined && <span className="small muted">Your best: {best[c.id]}</span>}
            </button>
          ))}
        </div>
        <div className="panel-head" style={{ marginTop: 16 }}><h2>Realism</h2></div>
        <div className="scenario-grid">
          {(Object.keys(STYLES) as WorldStyle[]).map((k) => (
            <button key={k} className="scenario" aria-pressed={style === k} onClick={() => setStyle(k)}>
              <BoardTile id={k} />
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

/**
 * Each challenge's (and realism mode's) scene, cut from the one illustrated board
 * (1600 x 900) by its frame, so the whole scene shows above its own description.
 */
const BOARD = { w: 1600, h: 900 };
// Down to the bottom of each scene's round badge, which sits on its frame.
const ROWS = [[13, 347], [358, 643], [656, 888]] as const;
const COLS = [[13, 387], [412, 786], [812, 1186], [1212, 1586]] as const;
// The realism scenes are panoramas: the part around each one's badge, shaped like the others.
const WIDE = [[255, 547], [1049, 1341]] as const;
const TILE_AT: Record<string, [x0: number, y0: number, x1: number, y1: number]> = {
  bankrupt: [COLS[0][0], ROWS[0][0], COLS[0][1], ROWS[0][1]],
  journeyman: [COLS[1][0], ROWS[0][0], COLS[1][1], ROWS[0][1]],
  "amateur-hunter": [COLS[2][0], ROWS[0][0], COLS[2][1], ROWS[0][1]],
  "ryder-factory": [COLS[3][0], ROWS[0][0], COLS[3][1], ROWS[0][1]],
  boutique: [COLS[0][0], ROWS[1][0], COLS[0][1], ROWS[1][1]],
  comeback: [COLS[1][0], ROWS[1][0], COLS[1][1], ROWS[1][1]],
  "rival-takedown": [COLS[2][0], ROWS[1][0], COLS[2][1], ROWS[1][1]],
  dynasty: [COLS[3][0], ROWS[1][0], COLS[3][1], ROWS[1][1]],
  realistic: [WIDE[0][0], ROWS[2][0], WIDE[0][1], ROWS[2][1]],
  lively: [WIDE[1][0], ROWS[2][0], WIDE[1][1], ROWS[2][1]],
};

function BoardTile({ id }: { id: string }) {
  const at = TILE_AT[id];
  if (!at) return null;
  const [x0, y0, x1, y1] = at;
  const w = x1 - x0;
  const h = y1 - y0;
  return (
    <span
      className="challenge-tile"
      aria-hidden
      style={{
        aspectRatio: `${w} / ${h}`,
        backgroundSize: `${(BOARD.w / w) * 100}% ${(BOARD.h / h) * 100}%`,
        backgroundPosition: `${(x0 / (BOARD.w - w)) * 100}% ${(y0 / (BOARD.h - h)) * 100}%`,
      }}
    />
  );
}
