import { useCallback, useEffect, useRef, useState } from "react";
import {
  SEASON_WEEKS,
  createWorld,
  deserializeWorld,
  finishSeason,
  playWeek,
  serializeWorld,
  type ClientChoice,
  type Scenario,
  type SeasonSummary,
  type WeekReport,
  type World,
} from "../season";
import { deleteSave, loadSave, writeSave } from "./storage";

export interface GameState {
  world: World | null;
  /** Full week reports from this session (leaderboards aren't kept in saves). */
  reports: WeekReport[];
  /** Set when a season has just been closed, for the review screen. */
  review: SeasonSummary | null;
  busy: string | null;
  loaded: boolean;
  saveError: boolean;
}

/** Yields to the browser so a "working..." message paints before heavy simulation. */
const nextFrame = () => new Promise((r) => setTimeout(r, 30));

export function useGame() {
  const [state, setState] = useState<GameState>({ world: null, reports: [], review: null, busy: null, loaded: false, saveError: false });
  const worldRef = useRef<World | null>(null);
  const reportsRef = useRef<WeekReport[]>([]);

  const publish = useCallback((patch: Partial<GameState> = {}) => {
    setState((s) => ({ ...s, world: worldRef.current, reports: [...reportsRef.current], ...patch }));
  }, []);

  const persist = useCallback(async () => {
    if (!worldRef.current) return;
    const ok = await writeSave(serializeWorld(worldRef.current));
    setState((s) => ({ ...s, saveError: !ok }));
  }, []);

  useEffect(() => {
    void (async () => {
      const json = await loadSave();
      if (json) {
        try {
          worldRef.current = deserializeWorld(json);
        } catch {
          worldRef.current = null;
        }
      }
      publish({ loaded: true });
    })();
  }, [publish]);

  const newGame = useCallback(
    async (scenario: Scenario, seed: number) => {
      publish({ busy: "Building the golf world and playing a warm-up season…" });
      await nextFrame();
      worldRef.current = createWorld({ seed, scenario });
      reportsRef.current = [];
      publish({ busy: null, review: null });
      await persist();
    },
    [publish, persist],
  );

  const play = useCallback(
    async (choice: ClientChoice, weeks = 1) => {
      const w = worldRef.current;
      if (!w) return;
      if (weeks > 1) {
        publish({ busy: `Simulating ${weeks} weeks…` });
        await nextFrame();
      }
      for (let i = 0; i < weeks && w.week <= SEASON_WEEKS; i++) {
        reportsRef.current.push(playWeek(w, i === 0 ? choice : { kind: "auto" }));
      }
      reportsRef.current = reportsRef.current.slice(-60);
      publish({ busy: null });
      await persist();
    },
    [publish, persist],
  );

  const closeSeason = useCallback(async () => {
    const w = worldRef.current;
    if (!w) return;
    const summary = finishSeason(w);
    reportsRef.current = [];
    publish({ review: summary });
    await persist();
  }, [publish, persist]);

  const dismissReview = useCallback(() => publish({ review: null }), [publish]);

  const importSave = useCallback(
    async (json: string) => {
      worldRef.current = deserializeWorld(json);
      reportsRef.current = [];
      publish({ review: null });
      await persist();
    },
    [publish, persist],
  );

  const abandon = useCallback(async () => {
    worldRef.current = null;
    reportsRef.current = [];
    await deleteSave();
    publish({ review: null });
  }, [publish]);

  const exportSave = useCallback(() => (worldRef.current ? serializeWorld(worldRef.current) : null), []);

  return { state, newGame, play, closeSeason, dismissReview, importSave, abandon, exportSave };
}

export type Game = ReturnType<typeof useGame>;
