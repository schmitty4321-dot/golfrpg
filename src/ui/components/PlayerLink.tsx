import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { World } from "../../season";
import type { Game } from "../useGame";
import { PlayerProfile } from "./PlayerProfile";

/**
 * Any player's name, anywhere in the game, opens his player page over the
 * current screen; Back closes it and you're where you were. Pages opened from
 * a page stack up, so Back steps back through them one at a time.
 */
const OpenPlayer = createContext<((id: string) => void) | null>(null);
/** Whether a page can open for this id: retired players leave the world but stay in the record books. */
const HasPlayer = createContext<(id: string) => boolean>(() => true);

export function PlayerLinkProvider({ world, game, children }: { world: World | null; game: Game; children: ReactNode }) {
  const [stack, setStack] = useState<string[]>([]);
  const open = useCallback((id: string) => setStack((s) => (s.at(-1) === id ? s : [...s, id])), []);
  const top = stack.at(-1);
  const value = useMemo(() => open, [open]);
  const has = useCallback((id: string) => !!world?.players[id], [world]);
  return (
    <OpenPlayer.Provider value={value}>
      <HasPlayer.Provider value={has}>{children}</HasPlayer.Provider>
      {world && top && world.players[top] && <PlayerProfile key={top} world={world} game={game} id={top} onClose={() => setStack((s) => s.slice(0, -1))} />}
    </OpenPlayer.Provider>
  );
}

/** Opens a player's page from anywhere (null outside the provider). */
export const useOpenPlayer = () => useContext(OpenPlayer);

/** A player's name that opens his page. Falls back to plain text where pages can't open. */
export function PlayerName({ id, children, className }: { id: string; children?: ReactNode; className?: string }) {
  const open = useOpenPlayer();
  const has = useContext(HasPlayer);
  if (!open || !has(id)) return <>{children}</>;
  return (
    <button
      type="button"
      className={`player-link${className ? ` ${className}` : ""}`}
      onClick={(e) => {
        // Inside a clickable row or card, the name opens the page and nothing else.
        e.stopPropagation();
        open(id);
      }}
    >
      {children}
    </button>
  );
}
