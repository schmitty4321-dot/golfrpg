/** Warm, game-like building illustrations used by the agency upgrade cards. */
export function AgencyBuilding({ tier, kind = "office" }: { tier: number; kind?: "office" | "center" }) {
  const floors = Math.max(1, tier + (kind === "center" ? 1 : 0));
  const accent = kind === "center" ? "#b7802f" : "#247d55";
  return (
    <svg className="agency-building" viewBox="0 0 260 128" role="img" aria-label={`${kind === "center" ? "Training facility" : "Office"} illustration, tier ${tier + 1}`}>
      <defs><linearGradient id={`sky-${kind}-${tier}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#dbece5"/><stop offset="1" stopColor="#f5ead2"/></linearGradient></defs>
      <rect width="260" height="128" rx="12" fill={`url(#sky-${kind}-${tier})`} />
      <path d="M0 102 Q52 84 104 101 T208 98 T280 100 V128 H0Z" fill="#87b678" />
      <path d="M0 113 Q62 101 130 113 T270 108 V128 H0Z" fill="#5d9361" />
      {tier === 0 && kind === "office" ? <g><rect x="70" y="61" width="120" height="50" rx="4" fill="#f3e6cd" stroke="#315744" strokeWidth="2"/><path d="M59 62 L130 31 L201 62Z" fill="#315744"/><rect x="118" y="79" width="24" height="32" fill={accent}/><rect x="84" y="73" width="22" height="18" fill="#b8dbe1"/><rect x="154" y="73" width="22" height="18" fill="#b8dbe1"/></g> : <g>
        <rect x={54 - tier * 5} y={82 - floors * 18} width={152 + tier * 10} height={29 + floors * 18} rx="4" fill="#eee5d5" stroke="#315744" strokeWidth="2"/>
        <rect x={43 - tier * 5} y={77 - floors * 18} width={174 + tier * 10} height="8" rx="2" fill="#315744"/>
        {Array.from({ length: floors }).map((_, row) => Array.from({ length: 3 + tier }).map((__, col) => <rect key={`${row}-${col}`} x={70 - tier * 2 + col * (112 + tier * 4) / (3 + tier)} y={73 - floors * 18 + row * 18} width="18" height="10" rx="2" fill="#9ecbd0" stroke="#5d898a"/>))}
        <rect x="116" y="88" width="28" height="23" fill={accent}/><rect x="121" y="92" width="18" height="4" rx="2" fill="#f0d484"/>
      </g>}
      {kind === "center" && <g><rect x="18" y="96" width="54" height="10" rx="5" fill="#d5bf8c"/><circle cx="44" cy="101" r="3" fill="#fff"/><path d="M215 108 V58" stroke="#eee" strokeWidth="2"/><path d="M215 58 L237 65 L215 72Z" fill={accent}/></g>}
      <g fill="#315744"><circle cx="25" cy="77" r="17"/><circle cx="235" cy="80" r="20"/><rect x="22" y="82" width="6" height="29"/><rect x="232" y="86" width="6" height="27"/></g>
    </svg>
  );
}
