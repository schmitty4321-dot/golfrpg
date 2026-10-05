import type { ReactNode } from "react";
import { nationInfo } from "../../engine";

/**
 * National flags, drawn simply as SVG on a 30 x 20 grid (flag emoji don't
 * show on Windows). Details are simplified to read at 16-24 pixels wide.
 */

const W = 30;
const H = 20;

const hStripes = (colors: string[], weights = colors.map(() => 1)) => {
  const total = weights.reduce((s, w) => s + w, 0);
  let y = 0;
  return colors.map((c, i) => {
    const h = (weights[i]! / total) * H;
    const r = <rect key={i} x="0" y={y} width={W} height={h + 0.05} fill={c} />;
    y += h;
    return r;
  });
};
const vStripes = (colors: string[]) => colors.map((c, i) => <rect key={i} x={(i * W) / colors.length} y="0" width={W / colors.length + 0.05} height={H} fill={c} />);

/** A Nordic cross: optional inner cross for Norway. */
const nordic = (bg: string, cross: string, inner?: string) => (
  <>
    <rect width={W} height={H} fill={bg} />
    <rect x="8.5" y="0" width={inner ? 5.5 : 4} height={H} fill={cross} />
    <rect x="0" y={inner ? 7.25 : 8} width={W} height={inner ? 5.5 : 4} fill={cross} />
    {inner && (
      <>
        <rect x="9.9" y="0" width="2.7" height={H} fill={inner} />
        <rect x="0" y="8.65" width={W} height="2.7" fill={inner} />
      </>
    )}
  </>
);

const starPoints = (cx: number, cy: number, r: number, inner = 0.4) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * inner : r;
    return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
const star = (cx: number, cy: number, r: number, fill: string, key?: string | number) => <polygon key={key} points={starPoints(cx, cy, r)} fill={fill} />;

/** The Union Jack, as a canton 15 x 10. */
const unionCanton = (
  <g>
    <rect width="15" height="10" fill="#012169" />
    <path d="M0 0 L15 10 M15 0 L0 10" stroke="#fff" strokeWidth="2" />
    <path d="M0 0 L15 10 M15 0 L0 10" stroke="#c8102e" strokeWidth="0.7" />
    <path d="M7.5 0 V10 M0 5 H15" stroke="#fff" strokeWidth="3" />
    <path d="M7.5 0 V10 M0 5 H15" stroke="#c8102e" strokeWidth="1.6" />
  </g>
);

const MAPLE = "M15 3.6 l1.05 2.1 1.3-.65-.5 3 1.95-2.05.5 1.05 1.95-.4-.65 1.9.85.4-3.05 2.45.3 1.05-2.95-.45.1 3h-.7l.1-3-2.95.45.3-1.05-3.05-2.45.85-.4-.65-1.9 1.95.4.5-1.05 1.95 2.05-.5-3 1.3.65z";

const FLAGS: Record<string, () => ReactNode> = {
  USA: () => (
    <>
      {hStripes(Array.from({ length: 13 }, (_, i) => (i % 2 ? "#fff" : "#b22234")))}
      <rect width="12" height={(H * 7) / 13} fill="#3c3b6e" />
      {Array.from({ length: 12 }, (_, i) => <circle key={i} cx={1.6 + (i % 4) * 2.9} cy={1.6 + Math.floor(i / 4) * 3.4} r="0.55" fill="#fff" />)}
    </>
  ),
  ENG: () => (
    <>
      <rect width={W} height={H} fill="#fff" />
      <rect x="13" width="4" height={H} fill="#ce1124" />
      <rect y="8" width={W} height="4" fill="#ce1124" />
    </>
  ),
  SCO: () => (
    <>
      <rect width={W} height={H} fill="#005eb8" />
      <path d="M0 0 L30 20 M30 0 L0 20" stroke="#fff" strokeWidth="3.4" />
    </>
  ),
  NIR: () => (
    <>
      <rect width={W} height={H} fill="#fff" />
      <path d="M0 0 L30 20 M30 0 L0 20" stroke="#c8102e" strokeWidth="2.6" />
    </>
  ),
  IRL: () => <>{vStripes(["#169b62", "#fff", "#ff883e"])}</>,
  SWE: () => nordic("#006aa7", "#fecc00"),
  DEN: () => nordic("#c8102e", "#fff"),
  NOR: () => nordic("#ba0c2f", "#fff", "#00205b"),
  FIN: () => nordic("#fff", "#002f6c"),
  ESP: () => <>{hStripes(["#aa151b", "#f1bf00", "#aa151b"], [1, 2, 1])}</>,
  GER: () => <>{hStripes(["#000", "#dd0000", "#ffce00"])}</>,
  AUT: () => <>{hStripes(["#c8102e", "#fff", "#c8102e"])}</>,
  BEL: () => <>{vStripes(["#000", "#fdda24", "#ef3340"])}</>,
  FRA: () => <>{vStripes(["#002395", "#fff", "#ed2939"])}</>,
  ITA: () => <>{vStripes(["#009246", "#fff", "#ce2b37"])}</>,
  COL: () => <>{hStripes(["#fcd116", "#003893", "#ce1126"], [2, 1, 1])}</>,
  JPN: () => (
    <>
      <rect width={W} height={H} fill="#fff" />
      <circle cx="15" cy="10" r="6" fill="#bc002d" />
    </>
  ),
  KOR: () => (
    <>
      <rect width={W} height={H} fill="#fff" />
      <g transform="rotate(-33.7 15 10)">
        <path d="M10 10 A5 5 0 0 1 20 10 Z" fill="#cd2e3a" />
        <path d="M10 10 A5 5 0 0 0 20 10 Z" fill="#0047a0" />
        <circle cx="12.5" cy="10" r="2.5" fill="#cd2e3a" />
        <circle cx="17.5" cy="10" r="2.5" fill="#0047a0" />
      </g>
      {[
        [5.2, 4, 33.7],
        [24.8, 16, 33.7],
        [24.8, 4, -33.7],
        [5.2, 16, -33.7],
      ].map(([x, y, a], i) => (
        <g key={i} transform={`rotate(${a} ${x} ${y})`} fill="#000">
          <rect x={x! - 2.2} y={y! - 1.6} width="4.4" height="0.75" />
          <rect x={x! - 2.2} y={y! - 0.37} width="4.4" height="0.75" />
          <rect x={x! - 2.2} y={y! + 0.85} width="4.4" height="0.75" />
        </g>
      ))}
    </>
  ),
  CHN: () => (
    <>
      <rect width={W} height={H} fill="#de2910" />
      {star(5, 5, 3, "#ffde00")}
      {[[10, 2], [12, 4], [12, 7], [10, 9]].map(([x, y], i) => star(x!, y!, 1, "#ffde00", i))}
    </>
  ),
  TPE: () => (
    <>
      <rect width={W} height={H} fill="#fff" />
      {Array.from({ length: 5 }, (_, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        return <circle key={i} cx={15 + 3.6 * Math.cos(a)} cy={10 + 3.6 * Math.sin(a)} r="2.6" fill="#de2910" />;
      })}
      <circle cx="15" cy="10" r="2.9" fill="#003f87" />
      <circle cx="15" cy="10" r="1.2" fill="#fff" />
    </>
  ),
  CAN: () => (
    <>
      <rect width={W} height={H} fill="#fff" />
      <rect width="7.5" height={H} fill="#d80621" />
      <rect x="22.5" width="7.5" height={H} fill="#d80621" />
      <path d={MAPLE} fill="#d80621" />
    </>
  ),
  AUS: () => (
    <>
      <rect width={W} height={H} fill="#012169" />
      {unionCanton}
      {star(7.5, 15, 2.4, "#fff")}
      {[[22.5, 4], [19.5, 9], [25.5, 8], [22.5, 16]].map(([x, y], i) => star(x!, y!, 1.2, "#fff", i))}
      {star(24, 11.5, 0.6, "#fff")}
    </>
  ),
  NZL: () => (
    <>
      <rect width={W} height={H} fill="#012169" />
      {unionCanton}
      {[[22.5, 4], [19.5, 9], [25.5, 8], [22.5, 15.5]].map(([x, y], i) => (
        <g key={i}>
          {star(x!, y!, 1.75, "#fff")}
          {star(x!, y!, 1.2, "#c8102e")}
        </g>
      ))}
    </>
  ),
  FIJ: () => (
    <>
      <rect width={W} height={H} fill="#68bfe5" />
      {unionCanton}
      <path d="M19.5 5 H26.5 V11.5 Q26.5 15.5 23 16.5 Q19.5 15.5 19.5 11.5 Z" fill="#fff" stroke="#c8102e" strokeWidth="0.4" />
      <path d="M23 5 V16.5 M19.5 9 H26.5" stroke="#c8102e" strokeWidth="0.9" />
    </>
  ),
  RSA: () => (
    <>
      <rect width={W} height="10" fill="#e03c31" />
      <rect y="10" width={W} height="10" fill="#001489" />
      <polygon points="0,0 5,0 15.5,7 30,7 30,13 15.5,13 5,20 0,20" fill="#fff" />
      <polygon points="0,1.5 2.2,0 14.2,8.2 30,8.2 30,11.8 14.2,11.8 2.2,20 0,18.5" fill="#007749" />
      <polygon points="0,4 8.5,10 0,16" fill="#ffb81c" />
      <polygon points="0,5.4 6.6,10 0,14.6" fill="#000" />
    </>
  ),
  ARG: () => (
    <>
      {hStripes(["#74acdf", "#fff", "#74acdf"])}
      <circle cx="15" cy="10" r="1.8" fill="#f6b40e" />
    </>
  ),
  MEX: () => (
    <>
      {vStripes(["#006847", "#fff", "#ce1126"])}
      <circle cx="15" cy="10" r="2.2" fill="#8c5a2b" />
      <circle cx="15" cy="10.6" r="1.2" fill="#3f7d3a" />
    </>
  ),
  VEN: () => (
    <>
      {hStripes(["#ffcc00", "#00247d", "#cf142b"])}
      {Array.from({ length: 8 }, (_, i) => {
        const a = Math.PI + ((i + 0.5) * Math.PI) / 8;
        return <circle key={i} cx={15 + 4.2 * Math.cos(a)} cy={11.8 + 4.2 * Math.sin(a)} r="0.55" fill="#fff" />;
      })}
    </>
  ),
  PHI: () => (
    <>
      <rect width={W} height="10" fill="#0038a8" />
      <rect y="10" width={W} height="10" fill="#ce1126" />
      <polygon points="0,0 17.3,10 0,20" fill="#fff" />
      <circle cx="5.8" cy="10" r="2" fill="#fcd116" />
    </>
  ),
  IND: () => (
    <>
      {hStripes(["#ff9933", "#fff", "#138808"])}
      <circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" strokeWidth="0.6" />
      <circle cx="15" cy="10" r="0.6" fill="#000080" />
    </>
  ),
  PUR: () => (
    <>
      {hStripes(["#ed0000", "#fff", "#ed0000", "#fff", "#ed0000"])}
      <polygon points="0,0 17.3,10 0,20" fill="#0050f0" />
      {star(5.8, 10, 2.8, "#fff")}
    </>
  ),
};

/** Codes the game draws a real flag for. */
export const FLAG_CODES: readonly string[] = Object.keys(FLAGS);

/** A country's flag, or a plain tile with its code for a nationality the game doesn't draw. */
export function Flag({ nationality, width = 20, className }: { nationality: string; width?: number; className?: string }) {
  const info = nationInfo(nationality);
  const draw = FLAGS[info.code];
  return (
    <svg className={`flag ${className ?? ""}`} width={width} height={(width * 2) / 3} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={info.name}>
      <title>{info.name}</title>
      {draw ? draw() : (
        <>
          <rect width={W} height={H} fill="var(--surface-2)" />
          <text x="15" y="13.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--text-2)">{info.code}</text>
        </>
      )}
      <rect x="0.25" y="0.25" width={W - 0.5} height={H - 0.5} fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth="0.5" />
    </svg>
  );
}

/** Flag and three-letter code, as tour leaderboards show a player's country. */
export function Nation({ nationality, className }: { nationality: string; className?: string }) {
  const info = nationInfo(nationality);
  return (
    <span className={`nation ${className ?? ""}`} title={info.name}>
      <Flag nationality={nationality} width={18} />
      <span className="nation-code">{info.code}</span>
    </span>
  );
}
