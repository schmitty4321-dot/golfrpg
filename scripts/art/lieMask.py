"""Builds a coarse terrain map for each illustrated hole, so the tracer can put
a ball in the rough, a bunker or the water where the painting shows them.

Each cell (10 px square) of the illustration is labelled from its colour and
texture: f = mown grass (fairway, green, tee), s = sand, w = water, r = the
rest (rough, trees, paths, buildings). The map is stored run-length encoded
on each art entry as `mask`.

usage: python scripts/art/lieMask.py [course] [preview-dir]
"""
import colorsys
import json
import os
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MANIFEST = os.path.join(ROOT, "src", "ui", "illustratedArt.generated.json")
CELL = 10
# Where the scene's horizon sits, per course: above it only greens count (La Quinta's mountains
# read as sand). Torrey's greens and bunkers sit high in the frame, with only sea and sky above.
HORIZON = {"torrey-pines-south": 125, "tpc-scottsdale": 160, "pebble-beach": 90}
# Courses whose paintings show a wide band of mown rough (dark, smooth grass) between fairway and desert:
# it gets its own label (g), so a ball in the rough sits on it and one in the desert goes past it.
MOWN_ROUGH = {"tpc-scottsdale"}
# Courses whose paintings run the real sea up to the horizon: water at the top is ocean, not sky.
SEA_TO_HORIZON = {"pebble-beach"}


def label(pixels, mown_rough=False):
    """One cell's label from its pixels (a list of RGB tuples)."""
    n = len(pixels)
    r = sum(p[0] for p in pixels) / n / 255
    g = sum(p[1] for p in pixels) / n / 255
    b = sum(p[2] for p in pixels) / n / 255
    lum = [0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2] for p in pixels]
    mean = sum(lum) / n
    rough = (sum((x - mean) ** 2 for x in lum) / n) ** 0.5  # texture: trees are busy, mown grass is smooth
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    if b > r + 0.06 and b >= g - 0.03 and v > 0.2 and 0.48 <= h <= 0.62 and s >= 0.45:
        return "w"
    # Bunker sand is pale; desert ground and dry grass are more saturated or darker.
    # (Pale, unsaturated sand can be busy at a bunker's lip and in its shadows.)
    if s < 0.45 and v > 0.55 and 0.03 <= h <= 0.14 and r >= g and g >= b and rough < (62 if s < 0.32 else 45):
        return "s"
    if 0.16 <= h <= 0.36 and s > 0.3 and v > 0.45 and rough < 16:
        return "f"
    # Darker, still smooth: the mown rough (second cut) some courses paint as a wide band.
    if mown_rough and 0.16 <= h <= 0.3 and s > 0.5 and v > 0.25 and rough < 14:
        return "g"
    return "r"


def build(path, framed=False, horizon=200, mown_rough=False, sea=False):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    cols, rows = w // CELL, h // CELL
    px = im.load()
    labels = []
    for cy in range(rows):
        for cx in range(cols):
            x, y = cx * CELL, cy * CELL
            # Painted titles and hole cards are never in play.
            if framed and (y < 125 or (x < 230 and y < 380)):
                labels.append("r")
                continue
            cell = [px[x + i, y + j] for j in range(0, CELL, 2) for i in range(0, CELL, 2)]
            l = label(cell, mown_rough)
            # Above the horizon only the greens on the skyline count: mountains read as sand or water.
            if framed and y < horizon and l != "f":
                l = "r"
            labels.append(l)
    # Trees reflected in a lake read as land: a cell mostly surrounded by water is water.
    for _ in range(3):
        fill = []
        for cy in range(1, rows - 1):
            for cx in range(1, cols - 1):
                i = cy * cols + cx
                if labels[i] == "r" and sum(labels[(cy + dy) * cols + cx + dx] == "w" for dy in (-1, 0, 1) for dx in (-1, 0, 1)) >= 5:
                    fill.append(i)
        for i in fill:
            labels[i] = "w"
    # Reflections leave small islands of "land" in a lake; real islands (an island green) are big.
    seen = [False] * len(labels)
    for start in range(len(labels)):
        if seen[start] or labels[start] == "w":
            continue
        patch, edge_ok, stack = [], True, [start]
        seen[start] = True
        while stack:
            i = stack.pop()
            patch.append(i)
            cy, cx = divmod(i, cols)
            if cy in (0, rows - 1) or cx in (0, cols - 1):
                edge_ok = False
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = cy + dy, cx + dx
                if 0 <= ny < rows and 0 <= nx < cols:
                    j = ny * cols + nx
                    if not seen[j] and labels[j] != "w":
                        seen[j] = True
                        stack.append(j)
        if edge_ok and len(patch) < 120:
            for i in patch:
                labels[i] = "w"
    if framed and not sea:
        # Sky and distant hills read as water: drop any water joined to the top of the scene.
        top = 125 // CELL + 1
        stack = [(top, cx) for cx in range(cols) if labels[top * cols + cx] == "w"]
        while stack:
            cy, cx = stack.pop()
            i = cy * cols + cx
            if labels[i] != "w":
                continue
            labels[i] = "r"
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = cy + dy, cx + dx
                if 0 <= ny < rows and 0 <= nx < cols and labels[ny * cols + nx] == "w":
                    stack.append((ny, nx))
    return im, cols, rows, labels


def rle(labels):
    out, prev, run = [], labels[0], 0
    for l in labels:
        if l == prev:
            run += 1
        else:
            out.append(f"{prev}{run}")
            prev, run = l, 1
    out.append(f"{prev}{run}")
    return "".join(out)


def main():
    course = sys.argv[1] if len(sys.argv) > 1 else "waialae"
    preview = sys.argv[2] if len(sys.argv) > 2 else None
    manifest = json.load(open(MANIFEST, encoding="utf-8"))
    colors = {"f": (120, 255, 120), "s": (255, 240, 160), "w": (60, 140, 255), "g": (20, 120, 40), "r": (60, 60, 60)}
    for key, entry in manifest.items():
        if not key.startswith(course + ":"):
            continue
        im, cols, rows, labels = build(os.path.join(ROOT, "public", entry["image"].split("?")[0]), bool(entry.get("meta", {}).get("framed")), HORIZON.get(course, 200), course in MOWN_ROUGH, course in SEA_TO_HORIZON)
        entry["mask"] = {"cell": CELL, "cols": cols, "rows": rows, "rle": rle(labels)}
        if preview:
            over = im.copy()
            d = ImageDraw.Draw(over, "RGBA")
            for i, l in enumerate(labels):
                if l == "r":
                    continue
                x, y = (i % cols) * CELL, (i // cols) * CELL
                d.rectangle([x, y, x + CELL - 1, y + CELL - 1], fill=colors[l] + (110,))
            over.save(os.path.join(preview, f"mask_{key.replace(':', '_')}.jpg"), quality=75)
        print(key, {l: labels.count(l) for l in "fswgr"})
    with open(MANIFEST, "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")


if __name__ == "__main__":
    main()
