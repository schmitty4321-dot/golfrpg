import { useCallback, useEffect, useRef, useState } from "react";
import * as season from "../season";
import {
  seasonWeeks,
  createWorld,
  deserializeWorld,
  finishSeason,
  liveEvents,
  playWeek,
  type LiveEvent,
  serializeWorld,
  type ClientChoices,
  type DatabasePlayer,
  type Scenario,
  type SeasonSummary,
  type WeekReport,
  type World,
} from "../season";
import { finishLive } from "../engine";
import { deleteSave, loadSave, writeSave } from "./storage";

/** A week being played live: your clients' events, round by round or hole by hole. Not saved until it's done. */
export interface LiveWeek {
  choices: ClientChoices;
  events: LiveEvent[];
  /** Bumped on every change, so screens re-render (the tournaments change in place). */
  version: number;
}

export interface GameState {
  world: World | null;
  /** Full week reports from this session (leaderboards aren't kept in saves). */
  reports: WeekReport[];
  /** Set when a season has just been closed, for the review screen. */
  review: SeasonSummary | null;
  busy: string | null;
  loaded: boolean;
  /** A week just played with your clients in the field, to reveal round by round. */
  live: WeekReport | null;
  /** A week in progress with your clients' events being played live. */
  liveWeek: LiveWeek | null;
  saveError: boolean;
}

/** Yields to the browser so a "working..." message paints before heavy simulation. */
const nextFrame = () => new Promise((r) => setTimeout(r, 30));

export function useGame() {
  const [state, setState] = useState<GameState>({ world: null, reports: [], review: null, busy: null, loaded: false, saveError: false, live: null, liveWeek: null });
  const worldRef = useRef<World | null>(null);
  const reportsRef = useRef<WeekReport[]>([]);
  const liveWeekRef = useRef<LiveWeek | null>(null);

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
    async (scenario: Scenario, seed: number, agencyName?: string, database?: DatabasePlayer[]) => {
      publish({ busy: "Building the golf world and playing a warm-up season…" });
      await nextFrame();
      worldRef.current = createWorld({ seed, scenario, agencyName, database });
      reportsRef.current = [];
      liveWeekRef.current = null;
      publish({ busy: null, review: null });
      await persist();
    },
    [publish, persist],
  );

  const play = useCallback(
    async (choices: ClientChoices, weeks = 1) => {
      const w = worldRef.current;
      if (!w) return;
      // A single week with your clients in the field is played live, on the event screen.
      if (weeks === 1) {
        const events = liveEvents(w, choices);
        if (events.length) {
          liveWeekRef.current = { choices, events, version: 0 };
          publish({ liveWeek: liveWeekRef.current, live: null });
          return;
        }
      }
      if (weeks > 1) {
        publish({ busy: `Simulating ${weeks} weeks…` });
        await nextFrame();
      }
      for (let i = 0; i < weeks && w.week <= seasonWeeks(w); i++) {
        reportsRef.current.push(playWeek(w, i === 0 ? choices : {}));
      }
      reportsRef.current = reportsRef.current.slice(-60);
      const last = reportsRef.current[reportsRef.current.length - 1];
      // A single week with your clients in the field opens the event screen.
      const live = weeks === 1 && last && Object.values(last.clients).some((c) => c.record) ? last : null;
      publish({ busy: null, live });
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

  /** Change a live tournament (play a round, a hole), then re-render. */
  const liveAct = useCallback(
    (fn: (events: LiveEvent[]) => void) => {
      const lw = liveWeekRef.current;
      if (!lw) return;
      fn(lw.events);
      liveWeekRef.current = { ...lw, version: lw.version + 1 };
      publish({ liveWeek: liveWeekRef.current });
    },
    [publish],
  );

  /** Finish anything left in the live week (automatically), then play the rest of the world's week and save. */
  const completeLiveWeek = useCallback(async () => {
    const w = worldRef.current;
    const lw = liveWeekRef.current;
    if (!w || !lw) return;
    const played = Object.fromEntries(lw.events.map((e) => [e.event.id, finishLive(e.tournament)]));
    const report = playWeek(w, lw.choices, played);
    reportsRef.current = [...reportsRef.current, report].slice(-60);
    liveWeekRef.current = null;
    publish({ liveWeek: null, live: report });
    await persist();
  }, [publish, persist]);

  const dismissReview = useCallback(() => publish({ review: null }), [publish]);
  const dismissLive = useCallback(async () => {
    // Leaving mid-event: the rest of it plays itself, so the week still counts.
    if (liveWeekRef.current) await completeLiveWeek();
    publish({ live: null });
  }, [publish, completeLiveWeek]);

  const importSave = useCallback(
    async (json: string) => {
      worldRef.current = deserializeWorld(json);
      reportsRef.current = [];
      liveWeekRef.current = null;
      publish({ review: null, liveWeek: null, live: null });
      await persist();
    },
    [publish, persist],
  );

  const abandon = useCallback(async () => {
    worldRef.current = null;
    reportsRef.current = [];
    liveWeekRef.current = null;
    await deleteSave();
    publish({ review: null, liveWeek: null, live: null });
  }, [publish]);

  const exportSave = useCallback(() => (worldRef.current ? serializeWorld(worldRef.current) : null), []);

  /** Apply a management decision (training, staff, rebuild) to the world, then save. */
  const act = useCallback(
    (fn: (w: World) => unknown) => {
      if (!worldRef.current) return;
      fn(worldRef.current);
      publish();
      void persist();
    },
    [publish, persist],
  );

  return { state, newGame, play, liveAct, completeLiveWeek, closeSeason, dismissReview, dismissLive, importSave, abandon, exportSave, act, lib: season };
}

export type Game = ReturnType<typeof useGame>;
