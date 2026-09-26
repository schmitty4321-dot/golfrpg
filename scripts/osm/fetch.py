"""Downloads each course's OpenStreetMap data (scripts/osm/courses.json) into $OSM_CACHE (default /tmp/golfrpg-osm)."""
import json, os, subprocess, time
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.environ.get("OSM_CACHE", "/tmp/golfrpg-osm")
UA = "golfrpg/1.0 (https://github.com/schmitty4321-dot/golfrpg; course maps)"
os.makedirs(CACHE, exist_ok=True)
for cid, v in json.load(open(os.path.join(HERE, "courses.json"))).items():
    f = os.path.join(CACHE, f"{cid}.osm")
    if os.path.exists(f) and os.path.getsize(f) > 1000:
        continue
    s, n, w, e = map(float, v["bbox"])
    pad = 0.002
    url = f"https://api.openstreetmap.org/api/0.6/map?bbox={w - pad},{s - pad},{e + pad},{n + pad}"
    code = subprocess.run(["curl", "-s", "-m", "120", "-A", UA, "-o", f, "-w", "%{http_code}", url], capture_output=True, text=True).stdout
    print(cid, code, flush=True)
    time.sleep(1.5)  # be gentle with the OSM API
