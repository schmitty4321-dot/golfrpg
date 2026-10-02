import type { StaffRole } from "../../season";

const SKINS = ["#f2c7a5", "#d99c72", "#b97452", "#8b533b", "#633b2d"];
const HAIR = ["#241813", "#4b2d20", "#7b4a27", "#c08a47", "#d5bd89", "#323238"];
const JACKETS: Record<StaffRole, string> = { agent: "#174f3a", analyst: "#315b78", marketing: "#8d4f62", lawyer: "#4d465f" };

function hash(text: string): number {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

/** Deterministic illustrated staff portrait: every market candidate keeps the same face in every save. */
export function StaffPortrait({ id, name, role, size = 88 }: { id: string; name: string; role: StaffRole; size?: number }) {
  const n = hash(`${id}:${name}`);
  const skin = SKINS[n % SKINS.length]!;
  const hair = HAIR[(n >>> 3) % HAIR.length]!;
  const longHair = ((n >>> 7) & 1) === 1;
  const glasses = ((n >>> 9) % 4) === 0;
  const smile = ((n >>> 11) & 1) === 1;
  const bg = ["#dcebe2", "#dce8ee", "#eee3d8", "#e8dfe8"][(n >>> 13) % 4]!;
  return (
    <svg className="staff-portrait" width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Illustrated portrait of ${name}`}>
      <rect width="100" height="100" rx="12" fill={bg} />
      <circle cx="82" cy="17" r="22" fill="#fff" opacity=".25" />
      {longHair && <path d="M27 48Q25 17 50 14Q77 16 74 51L69 78H31Z" fill={hair} />}
      <path d="M12 100Q15 72 39 68H61Q86 72 89 100Z" fill={JACKETS[role]} />
      <path d="M40 64H60V78L50 85L40 78Z" fill={skin} />
      <ellipse cx="50" cy="42" rx="22" ry="27" fill={skin} />
      {!longHair && <path d="M28 39Q27 15 49 13Q74 14 73 42Q65 28 51 27Q37 28 28 39Z" fill={hair} />}
      {longHair && <path d="M28 39Q28 15 50 14Q73 16 72 41Q64 27 50 27Q36 27 28 39Z" fill={hair} />}
      <path d="M37 39q5-3 10 0M54 39q5-3 10 0" fill="none" stroke="#3b2922" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="42" cy="43" r="1.6" fill="#2a201d" /><circle cx="59" cy="43" r="1.6" fill="#2a201d" />
      <path d={smile ? "M43 55Q50 61 58 54" : "M44 56Q50 58 57 55"} fill="none" stroke="#8d4c4c" strokeWidth="1.7" strokeLinecap="round" />
      {glasses && <g fill="none" stroke="#31423b" strokeWidth="1.4"><rect x="34" y="38" width="14" height="11" rx="4" /><rect x="53" y="38" width="14" height="11" rx="4" /><path d="M48 42h5" /></g>}
      <path d="M39 70L50 85L61 70L67 73L58 100H42L33 73Z" fill="#f7f3e9" />
      <path d="M39 70L50 85L42 100H27L29 74Z M61 70L50 85L58 100H73L71 74Z" fill={JACKETS[role]} />
    </svg>
  );
}

export function StaffRoleIcon({ role }: { role: StaffRole }) {
  const label = role === "agent" ? "🤝" : role === "analyst" ? "▥" : role === "marketing" ? "◆" : "⚖";
  return <span className={`staff-role-icon role-${role}`} aria-hidden>{label}</span>;
}
