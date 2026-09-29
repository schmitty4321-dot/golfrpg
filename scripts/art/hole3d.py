"""
Builds one golf hole as a small 3D diorama in Blender and renders it.

    blender -b -P hole3d.py -- hole-02.json hole-02-3d.png

The ground is the hole's cut-out (from holeArt.ts's holeScene), one yard per
Blender unit: a height field coloured by surface (rough, striped fairway,
raised green, sunken bunkers, water), with a soil edge, rounded trees, and a
flag. Lit by a bright sun and seen from a slightly tilted overhead camera.
"""
import json
import math
import sys

import bpy
import bmesh

args = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = args[0], args[1]
data = json.load(open(SRC, encoding="utf8"))
sc = data["scene"]

# Yards between height-field points: finer on short holes, which are drawn bigger.
_span = max(c[1] + c[2] for c in sc["cutout"]) - min(c[1] - c[2] for c in sc["cutout"])
GRID = max(0.35, min(0.8, _span / 900))

# ---------------------------------------------------------------- geometry helpers

def inside(x, y, poly):
    hit = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i][0], poly[i][1]
        xj, yj = poly[j][0], poly[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-9) + xi:
            hit = not hit
        j = i
    return hit


def boxed(polys):
    out = []
    for p in polys:
        if len(p) < 3:
            continue
        xs = [q[0] for q in p]
        ys = [q[1] for q in p]
        out.append((min(xs), max(xs), min(ys), max(ys), p))
    return out


def in_any(x, y, polys):
    for x0, x1, y0, y1, p in polys:
        if x0 <= x <= x1 and y0 <= y <= y1 and inside(x, y, p):
            return True
    return False


cut = sc["cutout"]


def in_cut(x, y, grow=0.0):
    for cx, cy, r in cut:
        if (x - cx) ** 2 + (y - cy) ** 2 <= (r + grow) ** 2:
            return True
    return False


layers = {
    "water": boxed(sc["water"]),
    "bunker": boxed(sc["bunkers"]),
    "green": boxed(sc["greens"]),
    "tee": boxed(sc["tees"]),
    "fairway": boxed(sc["fairways"]),
    "cut": boxed(sc["rough"]),
    "wood": boxed(sc["woods"]),
}
ORDER = ["water", "bunker", "green", "tee", "fairway", "cut", "wood"]

# Surface colours (sRGB) and heights (yards).
COL = {
    "rough": (0.16, 0.47, 0.13),
    "cut": (0.24, 0.57, 0.17),
    "fairway": (0.36, 0.70, 0.19),
    "stripe": (0.43, 0.77, 0.24),
    "green": (0.46, 0.82, 0.27),
    "tee": (0.40, 0.75, 0.22),
    "bunker": (0.95, 0.80, 0.50),
    "water": (0.06, 0.45, 0.85),
    "wood": (0.10, 0.34, 0.10),
}
HEIGHT = {"rough": 0.0, "cut": 0.05, "fairway": 0.12, "green": 0.9, "tee": 0.9, "bunker": -1.1, "water": -1.2, "wood": 0.0}
ROUGH = {"water": 0.04, "bunker": 0.95, "green": 0.55}

xs = [c[0] - c[2] for c in cut] + [c[0] + c[2] for c in cut]
ys = [c[1] - c[2] for c in cut] + [c[1] + c[2] for c in cut]
X0, X1, Y0, Y1 = min(xs) - 2, max(xs) + 2, min(ys) - 2, max(ys) + 2
NX = int((X1 - X0) / GRID) + 1
NY = int((Y1 - Y0) / GRID) + 1

kind = [[None] * NX for _ in range(NY)]
height = [[0.0] * NX for _ in range(NY)]
for j in range(NY):
    y = Y0 + j * GRID
    for i in range(NX):
        x = X0 + i * GRID
        if not in_cut(x, y, 0.5):
            continue
        k = "rough"
        for name in ORDER:
            if in_any(x, y, layers[name]):
                k = name
                break
        kind[j][i] = k
        height[j][i] = HEIGHT[k]

# Soften the height steps so greens rise and bunkers dip rather than jump.
for _ in range(3):
    nh = [row[:] for row in height]
    for j in range(1, NY - 1):
        for i in range(1, NX - 1):
            if kind[j][i] is None or kind[j][i] == "water":
                continue
            s = n = 0
            for dj in (-1, 0, 1):
                for di in (-1, 0, 1):
                    if kind[j + dj][i + di] is not None:
                        s += height[j + dj][i + di]
                        n += 1
            nh[j][i] = s / n
    height = nh

# Gentle rolls in the ground, so it isn't billiard-table flat.
for j in range(NY):
    for i in range(NX):
        if kind[j][i] not in (None, "water", "bunker"):
            x = X0 + i * GRID
            y = Y0 + j * GRID
            height[j][i] += 0.35 * math.sin(x * 0.045 + y * 0.013) * math.cos(y * 0.031)

# ---------------------------------------------------------------- the ground mesh

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def snap_to_edge(x, y):
    """Moves a point on the ragged grid edge onto the cut-out's true curved outline."""
    best = None
    for cx, cy, r in cut:
        dd = math.hypot(x - cx, y - cy)
        f = r - dd
        if best is None or f > best[0]:
            best = (f, cx, cy, r, dd)
    f, cx, cy, r, dd = best
    if dd < 1e-6:
        return x, y
    return cx + (x - cx) / dd * r, cy + (y - cy) / dd * r


verts, faces, index = [], [], {}
for j in range(NY):
    for i in range(NX):
        if kind[j][i] is not None:
            index[(i, j)] = len(verts)
            x, y = X0 + i * GRID, Y0 + j * GRID
            edge = any(
                not (0 <= j + dj < NY and 0 <= i + di < NX) or kind[j + dj][i + di] is None
                for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1))
            )
            if edge:
                sx, sy = snap_to_edge(x, y)
                # Only small moves: a big one would fold the surface over its neighbours.
                if math.hypot(sx - x, sy - y) <= GRID * 0.9:
                    x, y = sx, sy
            verts.append((x, y, height[j][i]))
for j in range(NY - 1):
    for i in range(NX - 1):
        q = [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]
        if all(k in index for k in q):
            faces.append([index[k] for k in q])

mesh = bpy.data.meshes.new("ground")
mesh.from_pydata(verts, [], faces)
mesh.update()
ground = bpy.data.objects.new("ground", mesh)
scene.collection.objects.link(ground)

col = mesh.color_attributes.new("col", "FLOAT_COLOR", "POINT")
rgh = mesh.attributes.new("rgh", "FLOAT", "POINT")


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


for (i, j), v in index.items():
    k = kind[j][i]
    c = COL[k]
    if k == "fairway" and int((Y0 + j * GRID) / 11) % 2 == 0:
        c = COL["stripe"]
    # A little speckle in the rough and woods floor.
    if k in ("rough", "wood", "cut"):
        f = 1 + 0.06 * math.sin(i * 12.9898 + j * 78.233) * math.cos(i * 3.7 + j * 1.3)
        c = tuple(min(1, x * f) for x in c)
    col.data[v].color = (srgb_to_linear(c[0]), srgb_to_linear(c[1]), srgb_to_linear(c[2]), 1)
    rgh.data[v].value = ROUGH.get(k, 0.8)

for p in mesh.polygons:
    p.use_smooth = True


def material(name, rgb=None, attribute=None, roughness=0.8, spec=0.3):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    if attribute:
        a = nt.nodes.new("ShaderNodeAttribute")
        a.attribute_name = attribute
        nt.links.new(a.outputs["Color"], bsdf.inputs["Base Color"])
        r = nt.nodes.new("ShaderNodeAttribute")
        r.attribute_name = "rgh"
        nt.links.new(r.outputs["Fac"], bsdf.inputs["Roughness"])
    else:
        bsdf.inputs["Base Color"].default_value = (*[srgb_to_linear(c) for c in rgb], 1)
        bsdf.inputs["Roughness"].default_value = roughness
    try:
        bsdf.inputs["Specular IOR Level"].default_value = spec
    except KeyError:
        pass
    return m


ground.data.materials.append(material("ground", attribute="col"))
ground.data.materials.append(material("soil", rgb=(0.48, 0.32, 0.19), roughness=0.95))
# The soil edge: straight walls dropped from the ground's outline.
bm = bmesh.new()
bm.from_mesh(mesh)
outline = [e for e in bm.edges if e.is_boundary]
made = bmesh.ops.extrude_edge_only(bm, edges=outline)
for v in (g for g in made["geom"] if isinstance(g, bmesh.types.BMVert)):
    v.co.z = -5.0
for f in (g for g in made["geom"] if isinstance(g, bmesh.types.BMFace)):
    f.material_index = 1
    f.smooth = False
bm.to_mesh(mesh)
bm.free()
mesh.update()

# ---------------------------------------------------------------- trees

leaf_mats = [material(f"leaf{i}", rgb=c, roughness=0.7) for i, c in enumerate([(0.11, 0.42, 0.12), (0.16, 0.50, 0.15), (0.08, 0.34, 0.10), (0.21, 0.55, 0.17)])]
trunk_mat = material("trunk", rgb=(0.40, 0.26, 0.15), roughness=0.9)

bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1)
canopy = bpy.context.active_object
bpy.ops.object.shade_smooth()
canopy_mesh = canopy.data
bpy.data.objects.remove(canopy)
bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.45, depth=3)
trunk = bpy.context.active_object
trunk_mesh = trunk.data
trunk_mesh.materials.append(trunk_mat)
bpy.data.objects.remove(trunk)


def ground_height(x, y):
    i = int(round((x - X0) / GRID))
    j = int(round((y - Y0) / GRID))
    if 0 <= j < NY and 0 <= i < NX:
        return height[j][i]
    return 0.0


def hashf(a, b):
    v = math.sin(a * 127.1 + b * 311.7) * 43758.5453
    return v - math.floor(v)


spots = []
for t in sc["trees"]:
    spots.append((t[0], t[1], max(3.2, t[2] * 0.8 if len(t) > 2 else 4)))
# Scatter trees through the woods inside the cut-out.
STEP = 6
for j in range(0, NY, int(STEP / GRID)):
    for i in range(0, NX, int(STEP / GRID)):
        if kind[j][i] == "wood":
            jx = (hashf(i, j) - 0.5) * 3
            jy = (hashf(j, i) - 0.5) * 3
            spots.append((X0 + i * GRID + jx, Y0 + j * GRID + jy, 3.4 + hashf(i + 3, j) * 1.6))

canopy_mesh.materials.append(leaf_mats[0])
placed = 0
for n, (x, y, r) in enumerate(spots):
    if not in_cut(x, y, -1.5):
        continue
    z = ground_height(x, y)
    leaf = bpy.data.objects.new(f"tree{n}", canopy_mesh)
    leaf.location = (x, y, z + 2.2 + r * 0.8)
    leaf.scale = (r, r, r * 0.95)
    scene.collection.objects.link(leaf)
    # Canopies share one mesh; each takes its own shade of green through an object-level slot.
    leaf.material_slots[0].link = "OBJECT"
    leaf.material_slots[0].material = leaf_mats[int(hashf(x, y) * len(leaf_mats)) % len(leaf_mats)]
    stem = bpy.data.objects.new(f"trunk{n}", trunk_mesh)
    stem.location = (x, y, z + 1.4)
    scene.collection.objects.link(stem)
    placed += 1

# ---------------------------------------------------------------- flag

gx, gy, gr = sc["green"]
gz = ground_height(gx, gy)
bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.35, depth=13, location=(gx, gy, gz + 6.5))
pole = bpy.context.active_object
pole.data.materials.append(material("pole", rgb=(0.97, 0.97, 0.95), roughness=0.4))
flag_mesh = bpy.data.meshes.new("flag")
flag_mesh.from_pydata([(gx, gy, gz + 13), (gx + 7, gy + 0.6, gz + 11.2), (gx, gy, gz + 9.4)], [], [(0, 1, 2)])
flag = bpy.data.objects.new("flag", flag_mesh)
flag.data.materials.append(material("red", rgb=(0.90, 0.13, 0.12), roughness=0.5))
scene.collection.objects.link(flag)
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.55, depth=0.1, location=(gx, gy, gz + 0.08))
bpy.context.active_object.data.materials.append(material("cup", rgb=(0.05, 0.05, 0.05)))

# ---------------------------------------------------------------- light, camera, render

world = bpy.data.worlds.new("world")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (0.62, 0.74, 0.86, 1)
bg.inputs["Strength"].default_value = 0.55

sun_data = bpy.data.lights.new("sun", "SUN")
sun_data.energy = 4.6
sun_data.angle = math.radians(6)
sun = bpy.data.objects.new("sun", sun_data)
sun.rotation_euler = (math.radians(52), math.radians(-14), math.radians(38))
scene.collection.objects.link(sun)

TILT = math.radians(38)
cx, cy = (X0 + X1) / 2, (Y0 + Y1) / 2
w, h = X1 - X0, Y1 - Y0
cam_data = bpy.data.cameras.new("cam")
cam_data.type = "ORTHO"
cam = bpy.data.objects.new("cam", cam_data)
dist = 500
cam.location = (cx, cy - dist * math.sin(TILT), dist * math.cos(TILT))
cam.rotation_euler = (TILT, 0, 0)
scene.collection.objects.link(cam)
scene.camera = cam
vis_h = h * math.cos(TILT) + 14
vis_w = w + 10
RES_X = 900
res_y = min(1500, int(RES_X * vis_h / vis_w))
scene.render.resolution_x = RES_X if res_y < 1500 else int(1500 * vis_w / vis_h)
scene.render.resolution_y = res_y
cam_data.sensor_fit = "VERTICAL" if vis_h / vis_w > scene.render.resolution_y / scene.render.resolution_x - 1e-6 else "HORIZONTAL"
cam_data.ortho_scale = vis_h if cam_data.sensor_fit == "VERTICAL" else vis_w

# Cycles: real soft shadows and ambient occlusion, denoised.
scene.render.engine = "CYCLES"
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 4
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.get_devices()
    for dev_type in ("OPTIX", "CUDA", "HIP", "ONEAPI", "METAL"):
        try:
            prefs.compute_device_type = dev_type
            if any(d.type == dev_type for d in prefs.devices):
                for d in prefs.devices:
                    d.use = True
                scene.cycles.device = "GPU"
                break
        except TypeError:
            continue
except Exception:
    pass
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.view_settings.exposure = 0.0
scene.render.film_transparent = True
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print(f"RENDERED {OUT} trees={placed} grid={NX}x{NY}")
