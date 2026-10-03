import { useRef, useState } from "react";
import type { World } from "../../season";
import type { Game } from "../useGame";

export function Career({ world, game }: { world: World; game: Game }) {
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const exportFile = () => {
    const json = game.exportSave();
    if (!json) return;
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `fairway-manager-season${world.season}-week${world.week}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = async (f: File) => {
    try {
      await game.importSave(await f.text());
      setMsg("Save loaded.");
    } catch (e) {
      setMsg(`That file couldn't be loaded: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <main className="career-save-page">
      <section className="career-save-hero"><img src="/art/new-game/career-hero.webp" alt="Illustrated golf agency office" /><div><span>GAME MANAGEMENT</span><h1>Your agency, safely filed</h1><p>Back up a career, move it to another computer, or begin a new story.</p></div></section>
      <section className="panel save-management">
        <div className="panel-head"><h2>Game management</h2><span className="save-status">✓ Saved locally</span></div>
        <p style={{ marginTop: 0 }}>
          The game saves itself in this browser after every week.{" "}
          {game.state.saveError ? <strong className="bad-text">The last save failed: this browser is blocking storage, so export a file to keep your progress.</strong> : null}
        </p>
        <div className="save-action-grid">
          <button className="save-action" onClick={exportFile}><span className="save-action-icon">⇧</span><strong>Export save file</strong><small>Download a backup or move this career to another computer.</small></button>
          <button className="save-action" onClick={() => file.current?.click()}><span className="save-action-icon">⇩</span><strong>Import save file</strong><small>Load a saved career from this computer.</small></button>
          <button className="save-action save-danger" onClick={() => { if (confirm("Delete this career and start a new one?")) void game.abandon(); }}><span className="save-action-icon">⚑</span><strong>Start new career</strong><small>This deletes the career saved in this browser.</small></button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && void importFile(e.target.files[0])} />
        </div>
        {msg && <p>{msg}</p>}
        <div className="world-seed"><span>◎</span><div><strong>World seed: {world.seed}</strong><small>This identifies your career world.</small></div></div>
      </section>
    </main>
  );
}
