"""Puts a Blender hole render on a page with the header bar: python compose.py hole-02.json hole-02-3d.png out.png"""
import json, sys
from PIL import Image, ImageDraw, ImageFont

meta = json.load(open(sys.argv[1], encoding="utf8"))["meta"]
art = Image.open(sys.argv[2]).convert("RGBA")
HEAD, PAD = 96, 24
W = max(620, art.width + PAD * 2)
page = Image.new("RGBA", (W, HEAD + art.height + PAD * 2), (236, 242, 232, 255))
# A soft light wash behind the hole.
glow = Image.new("RGBA", page.size, (0, 0, 0, 0))
ImageDraw.Draw(glow).ellipse([W * 0.1, HEAD, W * 0.9, page.height], fill=(248, 251, 244, 255))
page = Image.alpha_composite(page, glow)
page.alpha_composite(art, ((W - art.width) // 2, HEAD + PAD))
d = ImageDraw.Draw(page)
d.rectangle([0, 0, W, HEAD], fill=(22, 38, 29, 255))
def font(size, bold=False):
    for name in (("segoeuib.ttf" if bold else "segoeui.ttf"), "arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()
d.text((24, 16), f"Hole {meta['number']}", font=font(40, True), fill=(255, 255, 255))
d.text((26, 64), meta["course"], font=font(17), fill=(169, 201, 180))
right = f"Par {meta['par']}  ·  {meta['yards']} yds"
sub = f"Difficulty {meta['difficulty']}  ·  Tour avg {meta['tourAverage']:.2f}"
d.text((W - 24, 22), right, font=font(24, True), fill=(231, 241, 234), anchor="ra")
d.text((W - 24, 58), sub, font=font(17), fill=(169, 201, 180), anchor="ra")
page.convert("RGB").save(sys.argv[3], quality=92)
print("composed", sys.argv[3], page.size)
