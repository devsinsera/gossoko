#!/usr/bin/env python3
"""Every Gossoko icon from one drawing: dark base, safety-orange G, hazard tape.

    python3 scripts/make_icons.py

Writes the 1024 master to native/icon.png and the web icons to public/.
The native shells take icon.png (see native/README.md for the asset commands).
Needs Pillow.
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORANGE = (255, 122, 0)
BG = (10, 9, 8)
INK = (17, 17, 17)
FONT = "/System/Library/Fonts/Helvetica.ttc"
SS = 4  # supersample for smooth edges


def hazard(draw, box, size, flip=False):
    """Diagonal orange/black tape clipped to box."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    tile = Image.new("RGB", (w, h), INK)
    td = ImageDraw.Draw(tile)
    step = int(size * 0.10)
    for k in range(-h, w + h, step):
        pts = [(k, 0), (k + step // 2, 0), (k + step // 2 + h, h), (k + h, h)]
        if flip:
            pts = [(w - x, y) for x, y in pts]
        td.polygon(pts, fill=ORANGE)
    return tile


def master(size, g_scale=0.62, border=True, tape=True):
    s = size * SS
    img = Image.new("RGB", (s, s), BG)
    d = ImageDraw.Draw(img)
    if tape:
        t = int(s * 0.10)
        tw = int(s * 0.40)
        img.paste(hazard(d, (0, 0, tw, t), s), (s - tw, 0))
        img.paste(hazard(d, (0, 0, tw, t), s), (0, s - t))
    if border:
        inset = int(s * 0.08)
        d.rounded_rectangle(
            (inset, inset, s - inset, s - inset),
            radius=int(s * 0.10),
            outline=ORANGE,
            width=max(2, int(s * 0.025)),
        )
    font = ImageFont.truetype(FONT, int(s * g_scale), index=1)  # Helvetica Bold
    bbox = d.textbbox((0, 0), "G", font=font)
    gx = (s - (bbox[2] - bbox[0])) / 2 - bbox[0]
    gy = (s - (bbox[3] - bbox[1])) / 2 - bbox[1] - s * 0.01
    d.text((gx, gy), "G", font=font, fill=ORANGE)
    return img.resize((size, size), Image.LANCZOS)


def rounded(img, radius_frac=0.2237):
    size = img.size[0]
    mask = Image.new("L", (size * SS, size * SS), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, size * SS, size * SS), radius=int(size * SS * radius_frac), fill=255
    )
    mask = mask.resize((size, size), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img.convert("RGBA"), (0, 0), mask)
    return out


def native_icons(full):
    """iOS AppIcon + Android launcher (square, round, adaptive foreground)."""
    ios = os.path.join(ROOT, "native/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png")
    if os.path.isdir(os.path.dirname(ios)):
        full.save(ios, optimize=True)
    res = os.path.join(ROOT, "native/android/app/src/main/res")
    if not os.path.isdir(res):
        return
    for name, px in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
        d = os.path.join(res, f"mipmap-{name}")
        sq = full.resize((px, px), Image.LANCZOS).convert("RGBA")
        sq.save(os.path.join(d, "ic_launcher.png"))
        m = Image.new("L", (px * SS, px * SS), 0)
        ImageDraw.Draw(m).ellipse((0, 0, px * SS, px * SS), fill=255)
        rd = Image.new("RGBA", (px, px), (0, 0, 0, 0))
        rd.paste(sq, (0, 0), m.resize((px, px), Image.LANCZOS))
        rd.save(os.path.join(d, "ic_launcher_round.png"))
        # Adaptive foreground: 108dp canvas, G inside the 66dp safe zone, transparent.
        fg = px * 108 // 48
        g = master(fg * 2, g_scale=0.34, border=False, tape=False).convert("RGBA")
        pix = g.load()
        for y in range(g.size[1]):
            for x in range(g.size[0]):
                pix[x, y] = (255, 122, 0, min(255, max(0, (pix[x, y][0] - 10) * 4)))
        g.resize((fg, fg), Image.LANCZOS).save(os.path.join(d, "ic_launcher_foreground.png"))


def main():
    pub = os.path.join(ROOT, "public")
    nat = os.path.join(ROOT, "native")
    os.makedirs(pub, exist_ok=True)
    os.makedirs(nat, exist_ok=True)
    full = master(1024)
    full.save(os.path.join(nat, "icon.png"), optimize=True)           # flat square: iOS/Android round it
    full.resize((180, 180), Image.LANCZOS).save(os.path.join(pub, "apple-touch-icon.png"), optimize=True)
    rounded(full.resize((192, 192), Image.LANCZOS)).save(os.path.join(pub, "icon-192.png"), optimize=True)
    rounded(full.resize((512, 512), Image.LANCZOS)).save(os.path.join(pub, "icon-512.png"), optimize=True)
    # Maskable: full-bleed base, art pulled into the inner 80% safe zone.
    mk = master(512, g_scale=0.46, border=False, tape=False)
    mk.save(os.path.join(pub, "icon-maskable-512.png"), optimize=True)
    native_icons(full)
    print("icons written")


if __name__ == "__main__":
    main()
