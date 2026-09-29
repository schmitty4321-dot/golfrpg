"""Frames a wide Blender render as a premium course-guide hero image."""
import json
import sys

from PIL import Image, ImageDraw, ImageFont


meta = json.load(open(sys.argv[1], encoding="utf8"))["meta"]
art = Image.open(sys.argv[2]).convert("RGBA")
HEAD, FOOT = 132, 38
W = art.width
page = Image.new("RGBA", (W, HEAD + art.height + FOOT), (5, 53, 40, 255))
page.alpha_composite(art, (0, HEAD))
d = ImageDraw.Draw(page)
d.rectangle([0, 0, W, HEAD], fill=(5, 61, 44, 255))
d.rectangle([0, HEAD - 3, W, HEAD], fill=(215, 184, 83, 255))
d.rectangle([0, HEAD + art.height, W, page.height], fill=(246, 245, 237, 255))


def font(size, family="sans", bold=False):
    if family == "serif":
        names = ("georgiab.ttf" if bold else "georgia.ttf", "cambria.ttc")
    else:
        names = ("segoeuib.ttf" if bold else "segoeui.ttf", "calibri.ttf")
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


d.text((48, 18), meta["course"].upper(), font=font(48, "serif", True), fill=(251, 249, 235))
rule = f"HOLE {meta['number']}   |   PAR {meta['par']}   |   {meta['yards']} YARDS"
d.text((51, 82), rule, font=font(24, bold=True), fill=(242, 242, 230))
d.text(
    (W - 48, 35),
    "ISLAND GOLF.\nTIMELESS PLAY.",
    font=font(17, bold=True),
    fill=(238, 235, 211),
    anchor="ra",
    spacing=8,
)
d.text(
    (48, page.height - 27),
    "MAP © OPENSTREETMAP CONTRIBUTORS · ODbL",
    font=font(13, bold=True),
    fill=(35, 71, 53),
)
d.text(
    (W - 48, page.height - 27),
    "ILLUSTRATIVE TERRAIN + PLANTING",
    font=font(13),
    fill=(67, 92, 76),
    anchor="ra",
)
page.convert("RGB").save(sys.argv[3], quality=94)
print("composed", sys.argv[3], page.size)
