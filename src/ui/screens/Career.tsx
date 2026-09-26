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
    <main>
      <section className="panel">
        <div className="panel-head"><h2>Saving</h2></div>
        <p style={{ marginTop: 0 }}>
          The game saves itself in this browser after every week.{" "}
          {game.state.saveError ? <strong className="bad-text">The last save failed: this browser is blocking storage, so export a file to keep your progress.</strong> : null}
        </p>
        <p className="secondary">Export a save file to back it up or move it to another computer.</p>
        <div className="btn-row">
          <button className="btn" onClick={exportFile}>Export save file</button>
          <button className="btn" onClick={() => file.current?.click()}>Import save file</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && void importFile(e.target.files[0])} />
        </div>
        {msg && <p>{msg}</p>}
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Start over</h2></div>
        <p className="secondary" style={{ marginTop: 0 }}>This deletes the career saved in this browser. Export it first if you want to keep it.</p>
        <button
          className="btn"
          onClick={() => {
            if (confirm("Delete this career and start a new one?")) void game.abandon();
          }}
        >
          New career
        </button>
        <p className="muted small">World seed: {world.seed}</p>
      </section>
    </main>
  );
}
