import { useMemo, useRef, useState } from "react";
import {
  ATTRIBUTE_GROUPS,
  ATTRIBUTE_LABELS,
  HIDDEN_ATTRIBUTES,
  coursePar,
  type AttributeKey,
  type Course,
  type CourseStyle,
  type Grass,
} from "../../engine";
import {
  STATUS_LABELS,
  courseReport,
  duplicateCourse,
  eventsAt,
  eventsInWeek,
  exportCourses,
  exportPlayers,
  newCourse,
  validateCourse,
  seasonWeeks,
  type PlayerPatch,
  type TourStatus,
  type World,
} from "../../season";
import { downloadText } from "../download";
import { TIER_LABELS, millions, signed } from "../format";
import type { Game } from "../useGame";
import { TournamentEmblem } from "../components/TournamentLogo";

type View = "players" | "courses" | "calendar" | "share";
const STYLES: CourseStyle[] = ["parkland", "links", "desert", "resort"];
const GRASSES: Grass[] = ["bentgrass", "bermuda", "poa"];

export function Editor({ world, game }: { world: World; game: Game }) {
  const [view, setView] = useState<View>("players");
  return (
    <main>
      <section className="panel">
        <div className="panel-head">
          <h2>Editor</h2>
          <span className="muted small">
            {world.edited ? "This world has been edited." : "Changes here mark the world as edited, like an in-game editor."} The editor shows true values, not scouting reports.
          </span>
        </div>
        <div className="tabs" role="tablist" style={{ flexWrap: "wrap", marginBottom: 0 }}>
          {(
            [
              ["players", "Players"],
              ["courses", "Courses"],
              ["calendar", "Calendar"],
              ["share", "Share & import"],
            ] as [View, string][]
          ).map(([v, label]) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}>{label}</button>
          ))}
        </div>
      </section>
      {view === "players" && <PlayerEditor world={world} game={game} />}
      {view === "courses" && <CourseEditor world={world} game={game} />}
      {view === "calendar" && <CalendarEditor world={world} game={game} />}
      {view === "share" && <Share world={world} game={game} />}
    </main>
  );
}

// ---------------------------------------------------------------- players

const EDITABLE_ATTRS: { group: string; keys: readonly AttributeKey[] }[] = [
  { group: "Long game", keys: ATTRIBUTE_GROUPS.longGame },
  { group: "Approach", keys: ATTRIBUTE_GROUPS.approach },
  { group: "Short game", keys: ATTRIBUTE_GROUPS.shortGame },
  { group: "Putting", keys: ATTRIBUTE_GROUPS.putting },
  { group: "Mental", keys: ATTRIBUTE_GROUPS.mental },
  { group: "Physical", keys: ATTRIBUTE_GROUPS.physical },
  { group: "Hidden", keys: HIDDEN_ATTRIBUTES },
];

interface Draft {
  name: string;
  nationality: string;
  age: number;
  peakAge: number;
  status: TourStatus;
  potential: number;
  grassPreference: Grass;
  styleComfort: Record<CourseStyle, number>;
  attributes: Record<AttributeKey, number>;
}

function draftFor(world: World, id: string | null): Draft {
  if (!id) {
    const blank = Object.fromEntries([...EDITABLE_ATTRS.flatMap((g) => g.keys)].map((k) => [k, 12])) as Record<AttributeKey, number>;
    return { name: "", nationality: "USA", age: 24, peakAge: 31, status: "none", potential: 13, grassPreference: "bentgrass", styleComfort: { links: 12, parkland: 12, desert: 12, resort: 12 }, attributes: blank };
  }
  const wp = world.players[id]!;
  return {
    name: wp.player.name,
    nationality: wp.player.nationality,
    age: wp.player.age,
    peakAge: wp.player.peakAge,
    status: wp.career.status,
    potential: wp.development.potential,
    grassPreference: wp.player.grassPreference,
    styleComfort: { ...wp.player.styleComfort },
    attributes: { ...wp.player.attributes },
  };
}

function PlayerEditor({ world, game }: { world: World; game: Game }) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null | "new">(null);
  const [created, setCreated] = useState<string | null>(null);
  const list = useMemo(
    () =>
      Object.values(world.players)
        .filter((wp) => !q || wp.player.name.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => a.player.name.localeCompare(b.player.name))
        .slice(0, 60),
    [world, q],
  );
  return (
    <div className="grid-2" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2.2fr)" }}>
      <section className="panel">
        <div className="btn-row" style={{ marginBottom: 10 }}>
          <input type="text" placeholder="Search players" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
          <button className="btn btn-small btn-primary" onClick={() => { setSelected("new"); setCreated(null); }}>New player</button>
        </div>
        <div style={{ maxHeight: 620, overflowY: "auto" }}>
          <table>
            <tbody>
              {list.map((wp) => (
                <tr key={wp.player.id} className={`clickable${selected === wp.player.id ? " me" : ""}`} onClick={() => { setSelected(wp.player.id); setCreated(null); }}>
                  <td>{wp.player.name}</td>
                  <td className="muted small">{wp.player.age}</td>
                  <td className="muted small">{STATUS_LABELS[wp.career.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 60 && <p className="muted small">Showing the first 60 matches; search to narrow it down.</p>}
        </div>
      </section>
      {selected === null ? (
        <section className="panel"><p className="empty">Pick a player to edit, or create a new one.</p></section>
      ) : (
        <div className="stack">
          {created && <section className="panel good-text" role="status">{created} has joined the tour. You can keep editing him below.</section>}
          <PlayerForm
            key={selected}
            world={world}
            game={game}
            id={selected === "new" ? null : selected}
            onCreated={(id) => {
              setSelected(id);
              setCreated(world.players[id]?.player.name ?? "The new player");
            }}
          />
        </div>
      )}
    </div>
  );
}

function PlayerForm({ world, game, id, onCreated }: { world: World; game: Game; id: string | null; onCreated: (id: string) => void }) {
  const [d, setD] = useState<Draft>(() => draftFor(world, id));
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const set = (patch: Partial<Draft>) => {
    setD((x) => ({ ...x, ...patch }));
    setSaved(false);
  };
  const num = (v: string) => (v === "" ? NaN : Number(v));

  const save = () => {
    const patch: PlayerPatch = { ...d, attributes: d.attributes, styleComfort: d.styleComfort };
    let errs: string[] = [];
    if (id) {
      // Only send the status if it changed, so an unchanged pro isn't checked against the amateur rule.
      if (world.players[id]!.career.status === d.status) delete patch.status;
      game.act((w) => (errs = game.lib.editPlayer(w, id, patch)));
    } else {
      let newId: string | null = null;
      game.act((w) => {
        const r = game.lib.createPlayer(w, { ...patch, name: d.name });
        errs = r.errors;
        newId = r.id;
      });
      if (newId) onCreated(newId);
    }
    setErrors(errs);
    setSaved(errs.length === 0);
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{id ? `Edit ${world.players[id]!.player.name}` : "New player"}</h2>
        <div className="btn-row">
          {saved && <span className="good-text small" role="status">Saved.</span>}
          <button className="btn btn-primary" onClick={save}>{id ? "Save changes" : "Create player"}</button>
        </div>
      </div>
      {errors.length > 0 && (
        <ul className="bad-text small" role="alert" style={{ marginTop: 0 }}>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
      )}
      <div className="form-grid">
        <label>Name<input type="text" value={d.name} onChange={(e) => set({ name: e.target.value })} /></label>
        <label>Nationality<input type="text" value={d.nationality} onChange={(e) => set({ nationality: e.target.value })} /></label>
        <label>Age<input type="number" value={d.age} min={14} max={60} onChange={(e) => set({ age: num(e.target.value) })} /></label>
        <label>Peak age<input type="number" value={d.peakAge} min={22} max={40} onChange={(e) => set({ peakAge: num(e.target.value) })} /></label>
        <label>Status
          <select value={d.status} onChange={(e) => set({ status: e.target.value as TourStatus })}>
            {(Object.keys(STATUS_LABELS) as TourStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </label>
        <label>Ceiling (overall)<input type="number" step={0.1} value={d.potential} min={3} max={20} onChange={(e) => set({ potential: num(e.target.value) })} /></label>
        <label>Home greens
          <select value={d.grassPreference} onChange={(e) => set({ grassPreference: e.target.value as Grass })}>
            {GRASSES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        {STYLES.map((s) => (
          <label key={s}>Comfort: {s}<input type="number" min={1} max={20} value={d.styleComfort[s]} onChange={(e) => set({ styleComfort: { ...d.styleComfort, [s]: num(e.target.value) } })} /></label>
        ))}
      </div>
      <div className="attr-groups" style={{ marginTop: 16 }}>
        {EDITABLE_ATTRS.map((g) => (
          <div key={g.group}>
            <h3 style={{ marginBottom: 6 }}>{g.group}</h3>
            {g.keys.map((k) => (
              <label key={k} className="attr" style={{ gridTemplateColumns: "1fr 64px" }}>
                <span>{ATTRIBUTE_LABELS[k]}</span>
                <input type="number" min={1} max={20} value={d.attributes[k]} onChange={(e) => set({ attributes: { ...d.attributes, [k]: num(e.target.value) } })} aria-label={ATTRIBUTE_LABELS[k]} />
              </label>
            ))}
          </div>
        ))}
      </div>
      <p className="muted small">Attributes are 1-20 (12 is a tour average). The ceiling is the overall level he can develop to.</p>
    </section>
  );
}

// ---------------------------------------------------------------- courses

function CourseEditor({ world, game }: { world: World; game: Game }) {
  const [id, setId] = useState(world.courses[0]!.id);
  const [draft, setDraft] = useState<Course>(() => structuredClone(world.courses[0]!));
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [style, setStyle] = useState<CourseStyle>("parkland");
  const isNew = !world.courses.some((c) => c.id === draft.id);
  const problems = validateCourse(draft);
  const report = useMemo(() => (problems.length ? null : courseReport(draft)), [draft, problems.length]);

  const load = (c: Course) => {
    setId(c.id);
    setDraft(structuredClone(c));
    setErrors([]);
    setSaved(false);
  };
  const edit = (patch: Partial<Course>) => {
    setDraft((x) => ({ ...x, ...patch }));
    setSaved(false);
  };
  const editHole = (i: number, patch: Partial<Course["holes"][number]>) => {
    setDraft((x) => ({ ...x, holes: x.holes.map((h, j) => (j === i ? { ...h, ...patch } : h)) }));
    setSaved(false);
  };
  const save = () => {
    let errs: string[] = [];
    game.act((w) => (errs = game.lib.saveCourse(w, draft)));
    setErrors(errs);
    setSaved(errs.length === 0);
    if (!errs.length) setId(draft.id);
  };
  const hosting = eventsAt(world, draft.id);

  return (
    <>
      <section className="panel">
        <div className="btn-row" style={{ alignItems: "center" }}>
          <label className="small secondary">Course
            <select value={isNew ? "" : id} onChange={(e) => load(world.courses.find((c) => c.id === e.target.value)!)} style={{ marginLeft: 6 }}>
              {isNew && <option value="">{draft.name} (unsaved)</option>}
              {[...world.courses].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <button className="btn btn-small" disabled={isNew} title={isNew ? "Save it first" : undefined} onClick={() => load(duplicateCourse(world, draft.id))}>Duplicate</button>
          <select aria-label="Style for a new course" value={style} onChange={(e) => setStyle(e.target.value as CourseStyle)}>
            {STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn btn-small" onClick={() => load(newCourse(world, style, "New Course"))}>New {style} course</button>
          <span style={{ flex: 1 }} />
          {saved && <span className="good-text small" role="status">Saved.</span>}
          <button className="btn btn-small" onClick={() => load(world.courses.find((c) => c.id === id) ?? draft)} disabled={isNew}>Revert</button>
          <button className="btn btn-primary" onClick={save}>{isNew ? "Save new course" : "Save course"}</button>
        </div>
        {(errors.length > 0 || problems.length > 0) && (
          <ul className="bad-text small" role="alert">{(errors.length ? errors : problems).slice(0, 6).map((e) => <li key={e}>{e}</li>)}</ul>
        )}
      </section>

      <div className="grid-2">
        <section className="panel">
          <div className="form-grid">
            <label>Name<input type="text" value={draft.name} onChange={(e) => edit({ name: e.target.value })} /></label>
            <label>Style
              <select value={draft.style} onChange={(e) => edit({ style: e.target.value as CourseStyle })}>
                {STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>Greens
              <select value={draft.grass} onChange={(e) => edit({ grass: e.target.value as Grass })}>
                {GRASSES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
            <label>Green speed (stimp)<input type="number" step={0.5} min={8} max={15} value={draft.greenSpeed} onChange={(e) => edit({ greenSpeed: Number(e.target.value) })} /></label>
            <label>Rough (0-1)<input type="number" step={0.05} min={0} max={1} value={draft.roughPenalty} onChange={(e) => edit({ roughPenalty: Number(e.target.value) })} /></label>
            <label>Windiness (0-1)<input type="number" step={0.05} min={0} max={1} value={draft.windiness} onChange={(e) => edit({ windiness: Number(e.target.value) })} /></label>
            <label>Firmness (0-1)<input type="number" step={0.05} min={0} max={1} value={draft.firmness} onChange={(e) => edit({ firmness: Number(e.target.value) })} /></label>
          </div>
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="hole-table">
              <thead><tr><th>Hole</th><th>Par</th><th>Yards</th><th>Fairway</th><th>Hazard</th><th>Bunkers</th><th>Wind</th></tr></thead>
              <tbody>
                {draft.holes.map((h, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>
                      <select aria-label={`Hole ${i + 1} par`} value={h.par} onChange={(e) => editHole(i, { par: Number(e.target.value) as 3 | 4 | 5, fairwayWidth: Number(e.target.value) === 3 ? 0 : h.fairwayWidth || 30 })}>
                        {[3, 4, 5].map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    <td><input aria-label={`Hole ${i + 1} yards`} type="number" step={5} value={h.yards} onChange={(e) => editHole(i, { yards: Number(e.target.value) })} /></td>
                    <td>{h.par === 3 ? <span className="muted">–</span> : <input aria-label={`Hole ${i + 1} fairway width`} type="number" value={h.fairwayWidth} onChange={(e) => editHole(i, { fairwayWidth: Number(e.target.value) })} />}</td>
                    <td><input aria-label={`Hole ${i + 1} hazard`} type="number" step={0.1} min={0} max={1} value={h.hazard} onChange={(e) => editHole(i, { hazard: Number(e.target.value) })} /></td>
                    <td><input aria-label={`Hole ${i + 1} bunkers`} type="number" min={0} max={8} value={h.bunkers} onChange={(e) => editHole(i, { bunkers: Number(e.target.value) })} /></td>
                    <td><input aria-label={`Hole ${i + 1} wind exposure`} type="number" step={0.1} min={0} max={1} value={h.exposure} onChange={(e) => editHole(i, { exposure: Number(e.target.value) })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">Fairway width is the landing area in yards (tour average about 30). Hazard is trouble that makes big numbers (water, out of bounds). Wind is how exposed the hole is.</p>
        </section>

        <div className="stack">
          <section className="panel">
            <div className="panel-head"><h2>How it plays</h2></div>
            {report ? (
              <>
                <div className="stat-row">
                  <div className="stat"><span className="stat-label">Par</span><span className="stat-value">{report.par}</span></div>
                  <div className="stat"><span className="stat-label">Length</span><span className="stat-value">{report.yards.toLocaleString("en-US")}</span><span className="stat-sub">yards</span></div>
                  <div className="stat"><span className="stat-label">Tour-average player</span><span className="stat-value">{report.scoringVsPar >= 0 ? "+" : "−"}{Math.abs(report.scoringVsPar).toFixed(1)}</span><span className="stat-sub">per round vs par</span></div>
                </div>
                <h3 style={{ margin: "14px 0 6px" }}>What it rewards</h3>
                {(
                  [
                    ["distance", "Length off the tee"],
                    ["accuracy", "Accuracy off the tee"],
                    ["approach", "Iron play"],
                    ["shortGame", "Short game"],
                    ["putting", "Putting"],
                  ] as const
                ).map(([k, label]) => {
                  const v = report.demands[k];
                  return (
                    <div className="sg-row" key={k} style={{ gridTemplateColumns: "150px 1fr 52px" }}>
                      <span className="secondary">{label}</span>
                      <div className="sg-track" title={`${label}: ${v.toFixed(2)}x a typical course`}>
                        <span className={`sg-bar ${v >= 1 ? "pos" : "neg"}`} style={{ width: `${Math.min(50, Math.abs(v - 1) * 100)}%` }} />
                      </div>
                      <span className="num">{signed((v - 1) * 100, 0)}%</span>
                    </div>
                  );
                })}
                <p className="muted small">Against a typical tour venue. Blue: this course rewards that skill more than usual. Red: less.</p>
              </>
            ) : (
              <p className="empty">Fix the problems above to see how it plays.</p>
            )}
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Hosting</h2></div>
            {hosting.length === 0 ? <p className="empty">No events here. Move one in on the Calendar tab.</p> : (
              <ul className="news">{hosting.map((e) => <li key={e.id}>Week {e.week}: {e.name}</li>)}</ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- calendar

function CalendarEditor({ world, game }: { world: World; game: Game }) {
  const [msg, setMsg] = useState<Record<string, string>>({});
  const apply = (id: string, patch: { name?: string; purse?: number; courseId?: string }) => {
    let errs: string[] = [];
    game.act((w) => (errs = game.lib.editEvent(w, id, patch)));
    setMsg((m) => ({ ...m, [id]: errs.length ? errs[0]! : "Saved" }));
  };
  const courses = [...world.courses].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <section className="panel">
      <p className="secondary" style={{ marginTop: 0 }}>Rename events, change purses, or move an event to any venue, including one you designed. Changes apply from the next time the event is played. Each event's logo follows: a renamed event keeps its colours with the new name, and a moved one takes a scene from its new venue.</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Week</th><th>Event</th><th>Type</th><th>Venue</th><th>Purse ($M)</th><th /></tr></thead>
          <tbody>
            {Array.from({ length: seasonWeeks(world) }, (_, i) => i + 1).flatMap((week) =>
              eventsInWeek(world, week).map((e) => (
                <tr key={e.id}>
                  <td>{week}</td>
                  <td>
                    <span className="cal-event">
                      <TournamentEmblem event={e} course={world.courses.find((c) => c.id === e.courseId)} size={30} />
                      <input type="text" defaultValue={e.name} aria-label={`Name of ${e.name}`} onBlur={(ev) => ev.target.value !== e.name && apply(e.id, { name: ev.target.value })} style={{ width: 260 }} />
                    </span>
                  </td>
                  <td><span className={`badge${e.tier === "major" ? " badge-major" : ""}`}>{TIER_LABELS[e.tier]}</span></td>
                  <td>
                    <select aria-label={`Venue of ${e.name}`} value={e.courseId} onChange={(ev) => apply(e.id, { courseId: ev.target.value })}>
                      {courses.map((c) => <option key={c.id} value={c.id}>{c.name} (par {coursePar(c)})</option>)}
                    </select>
                  </td>
                  <td><input type="number" step={0.1} defaultValue={e.purse / 1_000_000} aria-label={`Purse of ${e.name}`} onBlur={(ev) => Number(ev.target.value) * 1_000_000 !== e.purse && apply(e.id, { purse: Number(ev.target.value) * 1_000_000 })} style={{ width: 80 }} /></td>
                  <td className={`small ${msg[e.id] && msg[e.id] !== "Saved" ? "bad-text" : "good-text"}`}>{msg[e.id] ?? `${millions(e.purse)}`}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- sharing

function Share({ world, game }: { world: World; game: Game }) {
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="grid-2">
      <section className="panel">
        <div className="panel-head"><h2>Player database</h2></div>
        <p style={{ marginTop: 0 }}>Export every player in this world (the golfers themselves, not their careers) as a file you can edit and share. Start a new career from a database on the New Career screen, under "Player database".</p>
        <button className="btn btn-primary" onClick={() => downloadText(`fairway-players-season${world.season}.json`, exportPlayers(world))}>Export player database</button>
        <p className="muted small">Hand-made files only need names: any attribute left out is a tour average (12).</p>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Courses</h2></div>
        <p style={{ marginTop: 0 }}>Export all courses, or import course files other people have made. Imported courses are added alongside yours, and you can host events at them from the Calendar tab.</p>
        <div className="btn-row">
          <button className="btn" onClick={() => downloadText("fairway-courses.json", exportCourses(world))}>Export all courses</button>
          <button className="btn" onClick={() => file.current?.click()}>Import courses</button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const text = await f.text();
              let result = { added: [] as string[], errors: [] as string[] };
              game.act((w) => (result = game.lib.importCourses(w, text)));
              setMsg([result.added.length ? `Added: ${result.added.join(", ")}.` : "", ...result.errors].filter(Boolean).join(" "));
              e.target.value = "";
            }}
          />
        </div>
        {msg && <p role="status">{msg}</p>}
      </section>
    </div>
  );
}
