"""
Fetches a public-domain aerial photo of each US course (USDA NAIP via the USGS
National Map) covering all of its mapped holes, and records where it sits in the
course's map frame so the shot tracer can lay it under each hole.

  python3 scripts/osm/aerial.py        (after buildholes.py)
"""
import json, math, os, subprocess, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
HOLES = os.path.join(ROOT, "public", "holes")
OUT = os.path.join(ROOT, "public", "aerial")
YD = 0.9144
PX_PER_YARD = 1.0
SERVICE = "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/export"
US = {"USA", "PUR"}
os.makedirs(OUT, exist_ok=True)
country = {c["id"]: c["country"] for c in json.load(open(os.path.join(ROOT, "src", "engine", "realCourses.json")))}

for f in sorted(os.listdir(HOLES)):
    cid = f[:-5]
    if country.get(cid) not in US:
        continue
    path = os.path.join(HOLES, f)
    data = json.load(open(path))
    lat0, lon0 = data["origin"]
    kx = math.cos(math.radians(lat0)) * 111320 / YD
    ky = 110540 / YD
    # The course-frame box that holds every hole's drawing.
    xs, ys = [], []
    for h in data["holes"].values():
        ox, oy, th, s = h["frame"]
        c, sn = math.cos(th), math.sin(th)
        x0, x1, y0, y1 = h["bounds"]
        for hx, hy in ((x0, y0), (x0, y1), (x1, y0), (x1, y1)):
            xs.append((hx * c + hy * sn) / s + ox)
            ys.append((-hx * sn + hy * c) / s + oy)
    x0, x1, y0, y1 = min(xs) - 20, max(xs) + 20, min(ys) - 20, max(ys) + 20
    scale = min(PX_PER_YARD, 4096 / max(x1 - x0, y1 - y0))
    w, h = round((x1 - x0) * scale), round((y1 - y0) * scale)
    # Ask in Web Mercator, which (unlike plain degrees) keeps pixels square on the ground,
    # then read back the exact box the service drew and convert it to course yards.
    def merc(lat, lon):
        return lon * 20037508.34 / 180, math.log(math.tan(math.radians(90 + lat) / 2)) * 20037508.34 / math.pi
    def unmerc(mx, my):
        return math.degrees(2 * math.atan(math.exp(my * math.pi / 20037508.34)) - math.pi / 2), mx * 180 / 20037508.34
    mx0, my0 = merc(lat0 + y0 / ky, lon0 + x0 / kx)
    mx1, my1 = merc(lat0 + y1 / ky, lon0 + x1 / kx)
    # Keep the box's shape in Mercator metres so the service doesn't pad it.
    h = round(w * (my1 - my0) / (mx1 - mx0))
    meta_url = f"{SERVICE}?bbox={mx0},{my0},{mx1},{my1}&bboxSR=3857&imageSR=3857&size={w},{h}&format=jpg&f=json"
    meta = json.loads(subprocess.run(["curl", "-s", "-m", "180", meta_url], capture_output=True, text=True).stdout or "{}")
    img = os.path.join(OUT, f"{cid}.jpg")
    ok = False
    if meta.get("href"):
        e = meta["extent"]
        code = subprocess.run(["curl", "-s", "-m", "180", "-o", img, "-w", "%{http_code}", meta["href"]], capture_output=True, text=True).stdout
        ok = code == "200" and os.path.getsize(img) > 30000 and open(img, "rb").read(3) == b"\xff\xd8\xff"
    if not ok:
        if os.path.exists(img):
            os.remove(img)
        data.pop("aerial", None)
        print(cid, "no imagery")
    else:
        la0, lo0 = unmerc(e["xmin"], e["ymin"])
        la1, lo1 = unmerc(e["xmax"], e["ymax"])
        box = [(lo0 - lon0) * kx, (lo1 - lon0) * kx, (la0 - lat0) * ky, (la1 - lat0) * ky]
        data["aerial"] = {"file": f"aerial/{cid}.jpg", "box": [round(v, 2) for v in box], "size": [meta.get("width"), meta.get("height")], "credit": "USDA NAIP / USGS The National Map (public domain)"}
        print(cid, f"{meta.get('width')}x{meta.get('height')}", os.path.getsize(img) // 1024, "KB", flush=True)
    json.dump(data, open(path, "w"), separators=(",", ":"))
    time.sleep(1)
