#!/usr/bin/env python3
"""Every Gossoko icon and splash from the vector pin.

    python3 scripts/make_icons.py

Sources (made by scripts/make_brand_svg.py):
  src/assets/brand/gossoko-pin.svg       the glossy coffee pin

Writes:
  native/icon.png                   1024 master, full-bleed near-black, no drawn corners
  public/apple-touch-icon.png       180, full-bleed (iOS rounds it)
  public/icon-192.png, icon-512.png rounded (the web app icons)
  public/icon-maskable-512.png      full-bleed, pin inside the 80% safe zone
  native/ios/.../AppIcon-512@2x.png and the Android mipmap launcher set
  native splash images (iOS Splash.imageset, Android drawable splash.png):
      plain near-black with the pin centred

Rasterising uses scripts/rasterize_svg.mjs (sharp). Needs Pillow and node.
"""
import os
import subprocess
import tempfile

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PIN_SVG = os.path.join(ROOT, "src", "assets", "brand", "gossoko-pin.svg")
BG = (10, 9, 8)  # #0a0908
SS = 4  # supersample for smooth edges

# The pin SVG box is 240 x 336 units; the pin body spans y -100..188 inside it.
PIN_BOX_RATIO = 240 / 336


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


def square(size, pin_frac, bg=BG):
    """Near-black square with the pin centred. pin_frac = pin box height / canvas."""
    pin = pin_image(size * pin_frac)
    base = Image.new("RGBA", (size, size), bg + (255,))
    base.alpha_composite(pin, ((size - pin.width) // 2, (size - pin.height) // 2))
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
        # Adaptive foreground: 108dp canvas, pin inside the 66dp safe zone, transparent.
        fg_px = px * 108 // 48
        fg = Image.new("RGBA", (fg_px, fg_px), (0, 0, 0, 0))
        pin = pin_image(fg_px * 0.56)
        fg.alpha_composite(pin, ((fg_px - pin.width) // 2, (fg_px - pin.height) // 2))
        fg.save(os.path.join(d, "ic_launcher_foreground.png"))


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

    full = square(1024, 0.80)
    full.convert("RGB").save(os.path.join(nat, "icon.png"), optimize=True)  # flat square; iOS/Android round it
    full.resize((180, 180), Image.LANCZOS).convert("RGB").save(
        os.path.join(pub, "apple-touch-icon.png"), optimize=True
    )
    rounded(full.resize((192, 192), Image.LANCZOS)).save(os.path.join(pub, "icon-192.png"), optimize=True)
    rounded(full.resize((512, 512), Image.LANCZOS)).save(os.path.join(pub, "icon-512.png"), optimize=True)
    # Maskable: full-bleed base, pin pulled into the inner safe zone.
    square(512, 0.62).convert("RGB").save(os.path.join(pub, "icon-maskable-512.png"), optimize=True)
    native_icons(full)
    splashes()
    print("icons written")


if __name__ == "__main__":
    main()
