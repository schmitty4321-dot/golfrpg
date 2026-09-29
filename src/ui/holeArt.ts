/**
 * Illustrated hole maps: a hole drawn as a cartoon course-guide page rather
 * than a photo. Striped fairway on rough, sand bunkers, blue water, round tree
 * clumps and a green with its flag, under a header with the hole's numbers.
 *
 * Built from the real outlines when a course has them (OpenStreetMap, in the
 * tracer's yards frame: tee at 0,0, green up the y axis) and from the hole
 * summary where they're missing: a fairway along the line of play, bunkers and
 * water where the summary puts them. Returns a standalone SVG string.
 */

type Pt = number[];
type Poly = Pt[];

/** The real outlines of one hole and its neighbours (see public/holes/*.json). */
export interface HoleOutlines {
  fairway: Poly[];
  green: Poly[];
  tee: Poly[];
  bunker: Poly[];
  water: Poly[];
  rough: Poly[];
  wood: Poly[];
  path: Poly[];
  tree: Pt[];
  bounds?: [number, number, number, number];
}

/** The compact summary the shot logic uses (see src/engine/realHoles.json). */
export interface HoleSummary {
  path: Pt[];
  green: [number, number, number];
  bunkers: [number, number, number][];
  water: Poly[];
  trees: [number, number, number][];
}

export interface HoleArtInput {
  number: number;
  par: number;
  yards: number;
  /** Fairway width in yards, for drawing one where the map has none. */
  fairwayWidth: number;
  /** Stroke index, 1 = hardest, if known. */
  difficulty?: number;
  tourAverage?: number;
  courseName: string;
  outlines?: HoleOutlines;
  summary?: HoleSummary;
}

const C = {
  rough: "#3f8a3e",
  roughDark: "#347a35",
  firstCut: "#58a54a",
  fairway: "#7cc85c",
  stripe: "rgba(255,255,255,0.10)",
  green: "#9be27e",
  fringe: "#6cc45a",
  sand: "#f1dca2",
  sandEdge: "#d6ba74",
  water: "#3d9ad6",
  waterEdge: "#2a7fb8",
  tee: "#a9e691",
  wood: "#2d6b34",
  tree: "#2f7a36",
  treeLight: "#4c9a45",
  path: "#e1ddcf",
  head: "#16261d",
};

const HEADER = 74;

const dist = (a: Pt, b: Pt) => Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!);

/** Points every `step` yards along a polyline, with the direction there. */
function along(path: Pt[], step: number): { p: Pt; dir: Pt; d: number }[] {
  const out: { p: Pt; dir: Pt; d: number }[] = [];
  let travelled = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const len = dist(a, b);
    if (len === 0) continue;
    const dir = [(b[0]! - a[0]!) / len, (b[1]! - a[1]!) / len];
    for (let t = out.length ? step - (travelled % step || step) : 0; t <= len; t += step) {
      out.push({ p: [a[0]! + dir[0]! * t, a[1]! + dir[1]! * t], dir, d: travelled + t });
    }
    travelled += len;
  }
  return out;
}

/** A fairway drawn along the line of play, for holes the map doesn't outline. */
function syntheticFairway(path: Pt[], green: [number, number, number], width: number): Poly {
  const total = path.slice(1).reduce((s, p, i) => s + dist(path[i]!, p), 0);
  const start = Math.min(120, total * 0.28);
  const end = total - green[2] - 3;
  const samples = along(path, 5).filter((s) => s.d >= start && s.d <= end);
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (const s of samples) {
    const taper = Math.min(1, (s.d - start) / 18 + 0.25, (end - s.d) / 14 + 0.55);
    // A little waist and flare so it reads as a mown shape, not a ribbon.
    const w = (width / 2) * taper * (1 + 0.12 * Math.sin((s.d / total) * Math.PI * 3));
    const n = [-s.dir[1]!, s.dir[0]!];
    left.push([s.p[0]! + n[0]! * w, s.p[1]! + n[1]! * w]);
    right.push([s.p[0]! - n[0]! * w, s.p[1]! - n[1]! * w]);
  }
  return [...left, ...right.reverse()];
}

const circlePoly = (x: number, y: number, r: number, squash = 1): Poly =>
  Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    return [x + Math.cos(a) * r, y + Math.sin(a) * r * squash];
  });

function inside(p: Pt, poly: Poly): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi! > p[1]! !== yj! > p[1]! && p[0]! < ((xj! - xi!) * (p[1]! - yi!)) / (yj! - yi!) + xi!) hit = !hit;
  }
  return hit;
}

/** How much of the hole's landing area the mapped fairways cover (they can belong to a neighbouring hole). */
function fairwayCover(path: Pt[], fairways: Poly[]): number {
  const total = path.slice(1).reduce((s, p, i) => s + dist(path[i]!, p), 0);
  const pts = along(path, 8).filter((x) => x.d > total * 0.3 && x.d < total * 0.9);
  if (!pts.length || !fairways.length) return 0;
  return pts.filter((x) => fairways.some((f) => inside(x.p, f))).length / pts.length;
}

/**
 * The hole's own ground as overlapping circles along the line of play: from a
 * little behind the tee to past the green, `half` yards either side, with more
 * room around the green. Clipping to them draws just the hole.
 */
function holeCutout(path: Pt[], green: [number, number, number], half: number): [number, number, number][] {
  const first = path[0]!;
  const second = path[1] ?? [first[0]!, first[1]! + 1];
  const len0 = dist(first, second) || 1;
  const back: Pt = [first[0]! - ((second[0]! - first[0]!) / len0) * 22, first[1]! - ((second[1]! - first[1]!) / len0) * 22];
  const last = path[path.length - 1]!;
  const prev = path[path.length - 2] ?? [last[0]!, last[1]! - 1];
  const lenN = dist(prev, last) || 1;
  const beyond: Pt = [green[0] + ((last[0]! - prev[0]!) / lenN) * (green[2] + 16), green[1] + ((last[1]! - prev[1]!) / lenN) * (green[2] + 16)];
  const out: [number, number, number][] = along([back, ...path, beyond], 6).map(({ p }) => [p[0]!, p[1]!, half]);
  out.push([green[0], green[1], Math.max(half, green[2] + 26)]);
  return out;
}

const centroid = (poly: Poly): Pt => {
  const n = poly.length || 1;
  return [poly.reduce((s, p) => s + p[0]!, 0) / n, poly.reduce((s, p) => s + p[1]!, 0) / n];
};

/** The hole's illustrated map as an SVG string, `width` pixels wide. */
export function holeArtSvg(h: HoleArtInput, width = 600, maxHeight = 1000, view: "hole" | "course" = "hole"): string {
  const o = h.outlines;
  const sm = h.summary;
  const path = sm?.path ?? [[0, 0], [0, h.yards]];
  const green: [number, number, number] = sm?.green ?? [path[path.length - 1]![0]!, path[path.length - 1]![1]!, 14];

  // The view: the map's box for this hole, or the line of play with room around it.
  const xs = path.map((p) => p[0]!);
  const ys = path.map((p) => p[1]!);
  // "hole": just the hole, cut out along the line of play (tee to green, the fairway and the trees
  // either side). "course": the hole in the middle of everything around it.
  const cutout = view === "hole" ? holeCutout(path, green, Math.max(26, h.fairwayWidth || 32) / 2 + 30) : [];
  let minX: number, maxX: number, minY: number, maxY: number;
  if (cutout.length) {
    minX = Math.min(...cutout.map(([x, , r]) => x! - r!)) - 6;
    maxX = Math.max(...cutout.map(([x, , r]) => x! + r!)) + 6;
    minY = Math.min(...cutout.map(([, y, r]) => y! - r!)) - 6;
    maxY = Math.max(...cutout.map(([, y, r]) => y! + r!)) + 6;
  } else {
    [minX, maxX, minY, maxY] = o?.bounds ?? [Math.min(...xs) - 70, Math.max(...xs) + 70, -25, Math.max(...ys) + 40];
    minX = Math.min(minX, Math.min(...xs) - 45);
    maxX = Math.max(maxX, Math.max(...xs) + 45);
    minY = Math.min(minY, -22);
    maxY = Math.max(maxY, green[1] + green[2] + 30);
  }
  const margin = cutout.length ? 16 : 0;
  const s = Math.min((width - margin * 2) / (maxX - minX), (maxHeight - HEADER - margin * 2) / (maxY - minY));
  if (cutout.length) {
    // The page is as wide as the hole needs, with room for the header.
    width = Math.max(380, Math.round((maxX - minX) * s + margin * 2));
  }
  // Centre the view across the page.
  const extra = ((width - margin * 2) / s - (maxX - minX)) / 2;
  minX -= extra;
  maxX += extra;
  const height = Math.round((maxY - minY) * s + HEADER + margin * 2);
  const X = (x: number) => ((x - minX) * s + margin).toFixed(1);
  const Y = (y: number) => ((maxY - y) * s + HEADER + margin).toFixed(1);
  const d = (poly: Poly) => poly.length ? `M${poly.map((p) => `${X(p[0]!)} ${Y(p[1]!)}`).join(" L")} Z` : "";
  const yd = (v: number) => (v * s).toFixed(1);
  const parts: string[] = [];
  const add = (x: string) => parts.push(x);

  // Rough, with a soft darker vignette so the hole sits in the middle.
  add(`<rect x="0" y="${HEADER}" width="${width}" height="${height - HEADER}" fill="${C.rough}"/>`);
  for (let i = 0; i < 26; i++) {
    const cx = ((i * 97) % 100) / 100 * width;
    const cy = HEADER + ((i * 57) % 100) / 100 * (height - HEADER);
    add(`<ellipse cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${yd(26)}" ry="${yd(16)}" fill="${C.roughDark}" opacity="0.35"/>`);
  }

  // Water.
  const water = o?.water.length ? o.water : (sm?.water ?? []);
  for (const w of water) {
    add(`<path d="${d(w)}" fill="${C.water}" stroke="${C.waterEdge}" stroke-width="${yd(2.2)}" stroke-linejoin="round"/>`);
    const [cx, cy] = centroid(w);
    add(`<path d="M${X(cx! - 8)} ${Y(cy!)} q${yd(4)} -${yd(2.5)} ${yd(8)} 0 M${X(cx! + 2)} ${Y(cy! - 7)} q${yd(4)} -${yd(2.5)} ${yd(8)} 0" stroke="#bfe5f7" stroke-width="${yd(1)}" fill="none" stroke-linecap="round" opacity="0.8"/>`);
  }

  // First cut, fairway (real or drawn along the line of play), and its mowing stripes.
  // The mapped fairways, plus one along the line of play if they don't cover this hole's landing area.
  const fairways = [...(o?.fairway ?? [])];
  if (h.par > 3 && fairwayCover(path, fairways) < 0.5) fairways.push(syntheticFairway(path, green, Math.max(26, h.fairwayWidth || 32)));
  for (const r of o?.rough ?? []) add(`<path d="${d(r)}" fill="${C.firstCut}" opacity="0.55" stroke-linejoin="round"/>`);
  for (const f of fairways) add(`<path d="${d(f)}" fill="${C.firstCut}" stroke="${C.firstCut}" stroke-width="${yd(5)}" stroke-linejoin="round"/>`);
  if (fairways.length) {
    add(`<clipPath id="fw">${fairways.map((f) => `<path d="${d(f)}"/>`).join("")}</clipPath>`);
    for (const f of fairways) add(`<path d="${d(f)}" fill="${C.fairway}" stroke="${C.fairway}" stroke-width="${yd(1.5)}" stroke-linejoin="round"/>`);
    // Mowing stripes: plain bands across the hole, clipped to the fairway.
    const band = 12 * s;
    const stripes: string[] = [];
    for (let y = HEADER, i = 0; y < height; y += band, i++) if (i % 2 === 0) stripes.push(`<rect x="0" y="${y.toFixed(1)}" width="${width}" height="${band.toFixed(1)}" fill="#ffffff" opacity="0.11"/>`);
    add(`<g clip-path="url(#fw)">${stripes.join("")}</g>`);
  }

  // Cart paths, faint.
  for (const p of o?.path ?? []) add(`<path d="M${p.map((q) => `${X(q[0]!)} ${Y(q[1]!)}`).join(" L")}" stroke="${C.path}" stroke-width="${yd(1.6)}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/>`);

  // Tee boxes.
  const tees = o?.tee.length ? o.tee : [[[-6, -4], [6, -4], [6, 6], [-6, 6]]];
  for (const t of tees) add(`<path d="${d(t)}" fill="${C.tee}" stroke="#8fd675" stroke-width="${yd(1)}" stroke-linejoin="round"/>`);

  // Greens: every one on the page, the hole's own with its flag.
  const greens = o?.green.length ? o.green : [circlePoly(green[0], green[1], green[2], 0.82)];
  for (const g of greens) add(`<path d="${d(g)}" fill="${C.green}" stroke="${C.fringe}" stroke-width="${yd(3)}" stroke-linejoin="round"/>`);

  // Bunkers, with a lighter lip.
  const bunkers = o?.bunker.length ? o.bunker : (sm?.bunkers ?? []).map(([x, y, r]) => circlePoly(x, y, r, 0.7));
  for (const b of bunkers) {
    add(`<path d="${d(b)}" fill="${C.sand}" stroke="${C.sandEdge}" stroke-width="${yd(1.2)}" stroke-linejoin="round"/>`);
    const [cx, cy] = centroid(b);
    add(`<ellipse cx="${X(cx! - 1)}" cy="${Y(cy! + 1)}" rx="${yd(2.4)}" ry="${yd(1.2)}" fill="#fff6d6" opacity="0.7"/>`);
  }

  // Woods: a dark mass with round crowns along the edge, then single trees.
  for (const w of o?.wood ?? []) {
    add(`<path d="${d(w)}" fill="${C.wood}" stroke="${C.wood}" stroke-width="${yd(4)}" stroke-linejoin="round"/>`);
    for (let i = 0; i < w.length; i++) {
      const a = w[i]!;
      const b = w[(i + 1) % w.length]!;
      const n = Math.max(1, Math.floor(dist(a, b) / 9));
      for (let k = 0; k < n; k++) {
        const x = a[0]! + ((b[0]! - a[0]!) * k) / n;
        const y = a[1]! + ((b[1]! - a[1]!) * k) / n;
        if (x < minX - 10 || x > maxX + 10 || y < minY - 10 || y > maxY + 10) continue;
        add(`<circle cx="${X(x)}" cy="${Y(y)}" r="${yd(5.2)}" fill="${C.tree}"/><circle cx="${X(x - 1.2)}" cy="${Y(y + 1.2)}" r="${yd(2.6)}" fill="${C.treeLight}" opacity="0.8"/>`);
      }
    }
  }
  const trees = o?.tree.length ? o.tree.map((t) => [t[0]!, t[1]!, 5]) : (sm?.trees ?? []);
  for (const [x, y, r] of trees as number[][]) {
    const rr = Math.max(4, r!);
    add(`<circle cx="${X(x! + 1.5)}" cy="${Y(y! - 1.5)}" r="${yd(rr)}" fill="#000" opacity="0.18"/>`);
    add(`<circle cx="${X(x!)}" cy="${Y(y!)}" r="${yd(rr)}" fill="${C.tree}"/>`);
    add(`<circle cx="${X(x! - rr * 0.3)}" cy="${Y(y! + rr * 0.3)}" r="${yd(rr * 0.5)}" fill="${C.treeLight}"/>`);
  }

  // The line of play, dotted, and the flag on the hole's own green.
  add(`<path d="M${path.map((p) => `${X(p[0]!)} ${Y(p[1]!)}`).join(" L")}" stroke="#ffffff" stroke-width="${yd(1.4)}" stroke-dasharray="${yd(3)} ${yd(4)}" fill="none" stroke-linecap="round" opacity="0.85"/>`);
  const [gx, gy] = [green[0], green[1]];
  add(`<ellipse cx="${X(gx)}" cy="${Y(gy)}" rx="${yd(1.4)}" ry="${yd(0.9)}" fill="#1b1b1b"/>`);
  add(`<path d="M${X(gx)} ${Y(gy)} V${Y(gy + 16)}" stroke="#ffffff" stroke-width="${yd(0.9)}"/>`);
  add(`<path d="M${X(gx)} ${Y(gy + 16)} L${X(gx + 9)} ${Y(gy + 13)} L${X(gx)} ${Y(gy + 10)} Z" fill="#e0342b"/>`);
  // A soft darker frame so the hole sits in the middle (full-course view).
  for (let i = 0; i < (cutout.length ? 0 : 6); i++) {
    const inset = i * 7;
    add(`<rect x="${inset}" y="${HEADER + inset}" width="${width - inset * 2}" height="${height - HEADER - inset * 2}" fill="none" stroke="#000000" stroke-width="7" opacity="${(0.12 - i * 0.018).toFixed(3)}"/>`);
  }

  // Cut out: the hole on a light page, with a shadow and a darker edge around its shape.
  let body = parts.splice(0).join("");
  if (cutout.length) {
    const circles = (grow: number, dx = 0, dy = 0) => cutout.map(([x, y, r]) => `<circle cx="${(Number(X(x!)) + dx).toFixed(1)}" cy="${(Number(Y(y!)) + dy).toFixed(1)}" r="${yd(r! + grow)}"/>`).join("");
    body = `<rect width="${width}" height="${height}" fill="#eef2ea"/>`
      + `<g fill="#000000" opacity="0.16">${circles(2, 3, 5)}</g>`
      + `<g fill="#2a5e2e">${circles(2.2)}</g>`
      + `<clipPath id="hole">${circles(0)}</clipPath><g clip-path="url(#hole)">${body}</g>`;
  }
  add(body);

  // The header card: hole, par, length, difficulty.
  const facts = [`Par ${h.par}`, `${h.yards} yds`, ...(h.difficulty ? [`Difficulty ${h.difficulty}`] : []), ...(h.tourAverage ? [`Tour avg ${h.tourAverage.toFixed(2)}`] : [])];
  add(`<rect width="${width}" height="${HEADER}" fill="${C.head}"/>`);
  add(`<text x="20" y="40" font-family="Segoe UI, system-ui, sans-serif" font-size="30" font-weight="800" fill="#ffffff">Hole ${h.number}</text>`);
  add(`<text x="${width - 20}" y="34" text-anchor="end" font-family="Segoe UI, system-ui, sans-serif" font-size="17" font-weight="700" fill="#e7f1ea">${facts.slice(0, 2).join("  ·  ")}</text>`);
  add(`<text x="${width - 20}" y="56" text-anchor="end" font-family="Segoe UI, system-ui, sans-serif" font-size="14" fill="#a9c9b4">${facts.slice(2).join("  ·  ")}</text>`);
  add(`<text x="20" y="62" font-family="Segoe UI, system-ui, sans-serif" font-size="13" fill="#a9c9b4">${h.courseName.replace(/&/g, "&amp;")}</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join("")}</svg>`;
}

/** The shapes the drawing is made from, in yards, for other renderers (the 3D hole models). */
export function holeScene(h: HoleArtInput) {
  const o = h.outlines;
  const sm = h.summary;
  const path = sm?.path ?? [[0, 0], [0, h.yards]];
  const green: [number, number, number] = sm?.green ?? [path[path.length - 1]![0]!, path[path.length - 1]![1]!, 14];
  const fairways = [...(o?.fairway ?? [])];
  if (h.par > 3 && fairwayCover(path, fairways) < 0.5) fairways.push(syntheticFairway(path, green, Math.max(26, h.fairwayWidth || 32)));
  return {
    path,
    green,
    cutout: holeCutout(path, green, Math.max(26, h.fairwayWidth || 32) / 2 + 30),
    fairways,
    rough: o?.rough ?? [],
    greens: o?.green.length ? o.green : [circlePoly(green[0], green[1], green[2], 0.82)],
    tees: o?.tee.length ? o.tee : [[[-6, -4], [6, -4], [6, 6], [-6, 6]]],
    bunkers: o?.bunker.length ? o.bunker : (sm?.bunkers ?? []).map(([x, y, r]) => circlePoly(x, y, r, 0.7)),
    water: o?.water.length ? o.water : (sm?.water ?? []),
    woods: o?.wood ?? [],
    trees: o?.tree.length ? o.tree.map((t) => [t[0]!, t[1]!, 5]) : (sm?.trees ?? []),
  };
}
