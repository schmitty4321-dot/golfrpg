import type { World } from "../../season";

/** Chips to switch between your clients. */
export function ClientPicker({ world, value, onChange }: { world: World; value: string; onChange: (id: string) => void }) {
  if (world.clientIds.length <= 1) return null;
  return (
    <div className="tabs" role="tablist" aria-label="Choose a client" style={{ flexWrap: "wrap" }}>
      {world.clientIds.map((id) => (
        <button key={id} role="tab" aria-selected={value === id} onClick={() => onChange(id)}>
          {world.players[id]!.player.name}
        </button>
      ))}
    </div>
  );
}
