"""
Header photos for US courses with no freely licensed photo: a wide aerial crop
(USDA NAIP via the USGS National Map, public domain) around the finishing
hole's green, or the middle of the course when its holes aren't mapped.
Adds them to src/engine/realCoursePhotos.json without touching existing entries.

  python3 scripts/osm/banners.py
"""
import json, math, os, subprocess, time, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
PHOTOS = os.path.join(ROOT, "src", "engine", "realCoursePhotos.json")
OUT = os.path.join(ROOT, "public", "courses")
SERVICE = "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/export"
UA = "golfrpg/1.0 (https://github.com/schmitty4321-dot/golfrpg; course photos)"
YD = 0.9144
WIDTH_M, HEIGHT_M, PX = 900, 315, 1500
US = {"USA", "PUR"}
# Where the finishing green is ringed by houses, centre on the course's greens instead.
MIDDLE = {"pga-west-stadium"}
# The imagery here is older than the course, or unusable (a colour cast, a stand-in location).
SKIP = {"black-desert", "tpc-scottsdale", "tpc-river-highlands", "barton-creek-fazio-canyons"}

photos = json.load(open(PHOTOS))
courses = json.load(open(os.path.join(ROOT, "src", "engine", "realCourses.json")))
located = json.load(open(os.path.join(HERE, "courses.json")))
extra = json.load(open(os.path.join(HERE, "banner_places.json"))) if os.path.exists(os.path.join(HERE, "banner_places.json")) else {}


def centre(cid):
    """The finishing green (from the hole map), else the middle of the course's outline."""
    f = os.path.join(ROOT, "public", "holes", f"{cid}.json")
    if os.path.exists(f):
        d = json.load(open(f))
        lat0, lon0 = d["origin"]
        if cid in MIDDLE:
            pts = []
            for h in d["holes"].values():
                for g in h["green"][:1]:
                    gx = sum(q[0] for q in g) / len(g)
                    gy = sum(q[1] for q in g) / len(g)
                    ox, oy, th, s = h["frame"]
                    pts.append(((gx * math.cos(th) + gy * math.sin(th)) / s + ox, (-gx * math.sin(th) + gy * math.cos(th)) / s + oy))
            kx = math.cos(math.radians(lat0)) * 111320 / YD
            x = sum(q[0] for q in pts) / len(pts)
            y = sum(q[1] for q in pts) / len(pts)
            return lat0 + y / (110540 / YD), lon0 + x / kx
        h = d["holes"].get("18") or d["holes"][max(d["holes"], key=int)]
        kx = math.cos(math.radians(lat0)) * 111320 / YD
        ky = 110540 / YD
        g = h["green"][0] if h["green"] else [[0, 0]]
        gx = sum(p[0] for p in g) / len(g)
        gy = sum(p[1] for p in g) / len(g)
        ox, oy, th, s = h["frame"]
        x = (gx * math.cos(th) + gy * math.sin(th)) / s + ox
        y = (-gx * math.sin(th) + gy * math.cos(th)) / s + oy
        return lat0 + y / ky, lon0 + x / kx
    box = (located.get(cid) or {}).get("bbox") or extra.get(cid)
    if not box:
        return None
    s, n, w, e = map(float, box)
    return (s + n) / 2, (w + e) / 2


def merc(lat, lon):
    return lon * 20037508.34 / 180, math.log(math.tan(math.radians(90 + lat) / 2)) * 20037508.34 / math.pi


for c in courses:
    cid = c["id"]
    if cid in photos or c["country"] not in US or cid in SKIP:
        continue
    at = centre(cid)
    if not at:
        print(cid, "no location")
        continue
    lat, lon = at
    mx, my = merc(lat, lon)
    k = 1 / math.cos(math.radians(lat))  # Mercator metres per ground metre here
    hw, hh = WIDTH_M * k / 2, HEIGHT_M * k / 2
    h = round(PX * HEIGHT_M / WIDTH_M)
    url = f"{SERVICE}?bbox={mx - hw},{my - hh},{mx + hw},{my + hh}&bboxSR=3857&imageSR=3857&size={PX},{h}&format=jpg&f=image"
    img = os.path.join(OUT, f"{cid}.jpg")
    code = subprocess.run(["curl", "-s", "-m", "120", "-A", UA, "-o", img, "-w", "%{http_code}", url], capture_output=True, text=True).stdout
    if code != "200" or os.path.getsize(img) < 30000:
        print(cid, "failed", code)
        if os.path.exists(img):
            os.remove(img)
        continue
    photos[cid] = {
        "file": f"courses/{cid}.jpg",
        "artist": "USDA NAIP / USGS The National Map (aerial)",
        "license": "Public domain",
        "licenseUrl": "",
        "page": "https://apps.nationalmap.gov/viewer/",
    }
    print(cid, os.path.getsize(img) // 1024, "KB", flush=True)
    time.sleep(1)

json.dump(photos, open(PHOTOS, "w"), indent=1)
