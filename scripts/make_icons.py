#!/usr/bin/env python3
"""Every Gossoko icon and splash from the vector pin.

    python3 scripts/make_icons.py

Sources (made by scripts/make_brand_svg.py):
  src/assets/brand/gossoko-pin.svg       the coffee pin

The app icon is the pin dropped on a quiet street map (map_svg below, vector, in the in-app
map palette), with a soft ground shadow under the tip. The splash stays plain near-black.

Writes:
  native/icon.png                   1024 master, full-bleed map, no drawn corners
  public/apple-touch-icon.png       180, full-bleed (iOS rounds it)
  public/icon-192.png, icon-512.png rounded (the web app icons)
  public/icon-maskable-512.png      full-bleed, pin inside the 80% safe zone
  native/ios/.../AppIcon-512@2x.png and the Android mipmap launcher set
      (adaptive: ic_launcher_foreground = pin, ic_launcher_background = map)
  native/electron/icon.png + icon.icns  the Mac app (icns via iconutil)
  native splash images (iOS Splash.imageset, Android drawable splash.png):
      plain near-black with the pin centred

Rasterising uses scripts/rasterize_svg.mjs (sharp). Needs Pillow and node.
"""
import os
import shutil
import subprocess
import tempfile

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PIN_SVG = os.path.join(ROOT, "src", "assets", "brand", "gossoko-pin.svg")
BG = (10, 9, 8)  # #0a0908
SS = 4  # supersample for smooth edges

# The pin SVG box is 240 x 336 units; the pin body spans y -100..188 inside it.
PIN_BOX_RATIO = 240 / 336

# Pin box height as a share of the canvas.
ICON_PIN_FRAC = 0.97  # app icon: body ~83% of the square (was 0.80, ~69%)
ICON_PIN_Y = 0.485  # a touch above centre so the tip and its shadow sit clear of the edge
MASKABLE_PIN_FRAC = 0.76  # PWA maskable: body (~65%) inside the 80% safe circle (was 0.62)
ADAPTIVE_PIN_FRAC = 0.67  # Android adaptive foreground: body (~62dp) inside the 66dp safe circle (was 0.56)
ADAPTIVE_VIEW = (-256, -256, 1536, 1536)  # 108dp canvas; its middle 72dp = the 1024 icon square


def rasterize(svg, width):
    """Return an RGBA PIL image of svg at the given pixel width (transparent bg)."""
    fd, tmp = tempfile.mkstemp(suffix=".png")
    os.close(fd)
    try:
        subprocess.run(
            ["node", os.path.join(ROOT, "scripts", "rasterize_svg.mjs"), svg, tmp, str(int(width))],
            check=True,
            cwd=ROOT,
        )
        return Image.open(tmp).convert("RGBA").copy()
    finally:
        os.remove(tmp)


def pin_image(box_height):
    """The pin at a given height of its SVG box (the box includes shadow margin)."""
    return rasterize(PIN_SVG, round(box_height * PIN_BOX_RATIO))


def rasterize_text(svg_text, width):
    fd, tmp = tempfile.mkstemp(suffix=".svg")
    with os.fdopen(fd, "w") as f:
        f.write(svg_text)
    try:
        return rasterize(tmp, width)
    finally:
        os.remove(tmp)


# ---- The app-icon ground: a quiet street map in the in-app map palette (src/lib/mapStyle.ts) ----
# Drawn on a 1024-unit icon square. Roads run past the square to -300..1324 so the Android
# adaptive background (108dp, only the middle 72dp shows) can be cut from the same drawing.
MAP = {
    "ground": "#0d0b09",
    "block": "#110d0a",
    "park": "#15130b",
    "water": "#1a110b",
    "water_edge": "#24170e",
    "minor": "#15100c",
    "street": "#1c1510",
    "avenue": "#2c1c11",
}
# The street grid is turned a little so it never lines up with the icon edge.
GRID_ANGLE = -14
GRID_STEP = 230


def map_svg(view=(0, 0, 1024, 1024)):
    """The map as SVG text for the given viewBox (icon units)."""
    x, y, w, h = view
    lo, hi = -700, 1724  # grid extent before rotation, enough to cover the rotated corners
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x} {y} {w} {h}" width="{w}" height="{h}">',
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{MAP["ground"]}"/>',
        # Park patch, lower left; then the river, a slow curve across the top right.
        f'<path d="M-320,640 L250,560 Q300,560 300,620 L300,1400 L-320,1400 Z" fill="{MAP["park"]}"/>',
        f'<path d="M520,-400 C560,40 760,240 1100,300 S1500,330 1600,360" fill="none" '
        f'stroke="{MAP["water_edge"]}" stroke-width="104" stroke-linecap="round"/>',
        f'<path d="M520,-400 C560,40 760,240 1100,300 S1500,330 1600,360" fill="none" '
        f'stroke="{MAP["water"]}" stroke-width="88" stroke-linecap="round"/>',
        f'<g transform="rotate({GRID_ANGLE} 512 512)" stroke-linecap="square" fill="none">',
    ]
    # Lanes (thin) between the streets, then the streets themselves.
    for i, v in enumerate(range(lo, hi, GRID_STEP)):
        parts.append(
            f'<path d="M{lo},{v + GRID_STEP / 2} H{hi} M{v + GRID_STEP / 2},{lo} V{hi}" '
            f'stroke="{MAP["minor"]}" stroke-width="6"/>'
        )
        parts.append(f'<path d="M{lo},{v} H{hi} M{v},{lo} V{hi}" stroke="{MAP["street"]}" stroke-width="12"/>')
    parts.append("</g>")
    # Two avenues: a long diagonal and a gentle curve, the widest lines on the map.
    parts.append(
        f'<path d="M-400,1250 L1450,-180" fill="none" stroke="{MAP["ground"]}" stroke-width="44"/>'
        f'<path d="M-400,1250 L1450,-180" fill="none" stroke="{MAP["avenue"]}" stroke-width="28"/>'
    )
    parts.append(
        f'<path d="M-400,380 C200,300 520,520 760,820 S1100,1300 1300,1500" fill="none" '
        f'stroke="{MAP["ground"]}" stroke-width="34"/>'
        f'<path d="M-400,380 C200,300 520,520 760,820 S1100,1300 1300,1500" fill="none" '
        f'stroke="{MAP["avenue"]}" stroke-width="20"/>'
    )
    # Vignette: edges sink into the brand black so the middle (and the pin) carries the eye.
    parts.append(
        '<defs><radialGradient id="vig" gradientUnits="userSpaceOnUse" cx="512" cy="500" r="760">'
        '<stop offset=".35" stop-color="#0a0908" stop-opacity="0"/>'
        '<stop offset="1" stop-color="#0a0908" stop-opacity=".78"/></radialGradient></defs>'
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="url(#vig)"/>'
    )
    parts.append("</svg>")
    return "".join(parts)


def map_image(size, view=(0, 0, 1024, 1024)):
    return rasterize_text(map_svg(view), size).convert("RGBA")


# Pin geometry in the pin SVG's own units: box y -120..216, body y -100..188 (tip at 188).
PIN_BOX_TOP = -120
PIN_BOX_H = 336
PIN_BODY_MID = 44  # middle of -100..188


def pin_layer(size, pin_frac, centre_y=0.5):
    """Transparent square with the pin (body centred at centre_y) and a ground shadow at the tip.
    pin_frac = pin box height / canvas."""
    box_h = size * pin_frac
    unit = box_h / PIN_BOX_H
    pin = pin_image(box_h)
    left = (size - pin.width) // 2
    top = round(size * centre_y - (PIN_BODY_MID - PIN_BOX_TOP) * unit)
    tip_x, tip_y = size / 2, top + (188 - PIN_BOX_TOP) * unit
    rx, ry = 74 * unit, 15 * unit
    blur = max(0.6, 6 * unit)
    ground = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">'
        f'<defs><filter id="b" x="-50%" y="-200%" width="200%" height="500%">'
        f'<feGaussianBlur stdDeviation="{blur:.2f}"/></filter></defs>'
        f'<ellipse cx="{tip_x:.2f}" cy="{tip_y:.2f}" rx="{rx:.2f}" ry="{ry:.2f}" fill="#000" '
        f'opacity=".7" filter="url(#b)"/>'
        f'<ellipse cx="{tip_x:.2f}" cy="{tip_y:.2f}" rx="{rx * .42:.2f}" ry="{ry * .42:.2f}" fill="#000" '
        f'opacity=".6" filter="url(#b)"/>'
        "</svg>"
    )
    layer = rasterize_text(ground, size)
    layer.alpha_composite(pin, (left, top))
    return layer


def square(size, pin_frac, centre_y=0.5):
    """The app icon: map ground with the pin dropped on it. pin_frac = pin box height / canvas."""
    base = map_image(size)
    base.alpha_composite(pin_layer(size, pin_frac, centre_y))
    return base


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


def splash_on(width, height, bg=BG):
    """Plain near-black with the pin centred, about 34% of the shorter side tall."""
    base = Image.new("RGBA", (width, height), bg + (255,))
    pin = pin_image(min(width, height) * 0.34)
    base.alpha_composite(pin, ((width - pin.width) // 2, (height - pin.height) // 2))
    return base


def native_icons(full):
    """iOS AppIcon + Android launcher (square, round, adaptive foreground)."""
    ios = os.path.join(ROOT, "native/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png")
    if os.path.isdir(os.path.dirname(ios)):
        full.convert("RGB").save(ios, optimize=True)
    res = os.path.join(ROOT, "native/android/app/src/main/res")
    if not os.path.isdir(res):
        return
    for name, px in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
        d = os.path.join(res, f"mipmap-{name}")
        sq = full.resize((px, px), Image.LANCZOS)
        sq.convert("RGB").save(os.path.join(d, "ic_launcher.png"))
        m = Image.new("L", (px * SS, px * SS), 0)
        ImageDraw.Draw(m).ellipse((0, 0, px * SS, px * SS), fill=255)
        rd = Image.new("RGBA", (px, px), (0, 0, 0, 0))
        rd.paste(sq, (0, 0), m.resize((px, px), Image.LANCZOS))
        rd.save(os.path.join(d, "ic_launcher_round.png"))
        # Adaptive icon, 108dp canvas of which the middle 72dp shows. Foreground: the pin, its
        # whole body inside the 66dp safe circle. Background: the same map, drawn so the visible
        # 72dp matches the 1024 icon square.
        fg_px = px * 108 // 48
        pin_layer(fg_px, ADAPTIVE_PIN_FRAC).save(os.path.join(d, "ic_launcher_foreground.png"))
        map_image(fg_px, ADAPTIVE_VIEW).convert("RGB").save(os.path.join(d, "ic_launcher_background.png"))


def electron_icons(full):
    """Mac app (Electron): icon.png and icon.icns, same square as iOS."""
    d = os.path.join(ROOT, "native", "electron")
    if not os.path.isdir(d):
        return
    full.convert("RGB").save(os.path.join(d, "icon.png"), optimize=True)
    if not shutil.which("iconutil"):
        print("iconutil not found (not macOS?); native/electron/icon.icns left as it was")
        return
    with tempfile.TemporaryDirectory() as tmp:
        iconset = os.path.join(tmp, "icon.iconset")
        os.makedirs(iconset)
        for pt in (16, 32, 128, 256, 512):
            for scale in (1, 2):
                px = pt * scale
                name = f"icon_{pt}x{pt}{'@2x' if scale == 2 else ''}.png"
                full.resize((px, px), Image.LANCZOS).convert("RGB").save(os.path.join(iconset, name))
        subprocess.run(["iconutil", "-c", "icns", iconset, "-o", os.path.join(d, "icon.icns")], check=True)


def splashes():
    """Replace every existing splash PNG (iOS imageset + Android drawables) at its own size."""
    targets = []
    ios_dir = os.path.join(ROOT, "native/ios/App/App/Assets.xcassets/Splash.imageset")
    if os.path.isdir(ios_dir):
        targets += [os.path.join(ios_dir, n) for n in os.listdir(ios_dir) if n.endswith(".png")]
    res = os.path.join(ROOT, "native/android/app/src/main/res")
    if os.path.isdir(res):
        for dirpath, _, files in os.walk(res):
            if "splash.png" in files:
                targets.append(os.path.join(dirpath, "splash.png"))
    for path in targets:
        w, h = Image.open(path).size
        splash_on(w, h).convert("RGB").save(path, optimize=True)
        print("splash", os.path.relpath(path, ROOT), f"{w}x{h}")


def main():
    pub = os.path.join(ROOT, "public")
    nat = os.path.join(ROOT, "native")
    os.makedirs(pub, exist_ok=True)

    full = square(1024, ICON_PIN_FRAC, ICON_PIN_Y)
    full.convert("RGB").save(os.path.join(nat, "icon.png"), optimize=True)  # flat square; iOS/Android round it
    full.resize((180, 180), Image.LANCZOS).convert("RGB").save(
        os.path.join(pub, "apple-touch-icon.png"), optimize=True
    )
    rounded(full.resize((192, 192), Image.LANCZOS)).save(os.path.join(pub, "icon-192.png"), optimize=True)
    rounded(full.resize((512, 512), Image.LANCZOS)).save(os.path.join(pub, "icon-512.png"), optimize=True)
    # Maskable: full-bleed base, pin pulled into the inner safe zone.
    square(512, MASKABLE_PIN_FRAC).convert("RGB").save(os.path.join(pub, "icon-maskable-512.png"), optimize=True)
    native_icons(full)
    electron_icons(full)
    splashes()
    print("icons written")


if __name__ == "__main__":
    main()
