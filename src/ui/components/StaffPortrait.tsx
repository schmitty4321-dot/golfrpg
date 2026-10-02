import type { StaffRole } from "../../season";

function hash(text: string): number {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

/** Deterministic illustrated staff portrait: every market candidate keeps the same face in every save. */
export function StaffPortrait({ id, name, size = 88 }: { id: string; name: string; role: StaffRole; size?: number }) {
  const index = 101 + (hash(`${id}:${name}`) % 50);
  return <img className="staff-portrait" src={`/people/person-${String(index).padStart(3, "0")}.webp`} width={size} height={size} alt={`Illustrated portrait of ${name}`} loading="lazy" />;
}

export function StaffRoleIcon({ role }: { role: StaffRole }) {
  const label = role === "agent" ? "🤝" : role === "analyst" ? "▥" : role === "marketing" ? "◆" : "⚖";
  return <span className={`staff-role-icon role-${role}`} aria-hidden>{label}</span>;
}
