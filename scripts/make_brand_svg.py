#!/usr/bin/env python3
"""Gossoko brand vectors: the coffee pin and the GOSSOKO wordmark.

    python3 scripts/make_brand_svg.py

Writes two SVGs to src/assets/brand/ (the single source for the app and for
scripts/make_icons.py):
  gossoko-pin.svg       the map pin with a latte inset (transparent)
  gossoko-wordmark.svg  chunky cream letters, burnt-orange extrude, the pin as
                        the 5th letter (the second O). Transparent background.

Letter outlines come from a system font (Arial Black) via fontTools, so the
SVG holds plain paths and needs no fonts at render time.
Needs fonttools (pip install fonttools). Run once after a design change.
"""
import math
import os

from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "assets", "brand")
FONT = "/System/Library/Fonts/Supplemental/Arial Black.ttf"

CREAM = "#f5f1ec"
CREAM_RIM = "#ffe9cf"
EXTRUDE = "#a8490c"
CAP = 200.0  # cap height of the wordmark, in SVG units
PIN_LABEL_INDEX = 4  # GOSSOKO -> G O S S [O] K O: the pin replaces the 5th letter
WORD = "GOSSOKO"


def f(v):
    return f"{v:.2f}".rstrip("0").rstrip(".")


# ---------- the pin ----------------------------------------------------------

def teardrop(cx, cy, r, d):
    """Map-pin outline: circle radius r centred (cx, cy), tip d below the centre."""
    py = r * r / d
    px = math.sqrt(r * r - py * py)
    tip = (cx, cy + d)
    left = (cx - px, cy + py)
    right = (cx + px, cy + py)
    return (
        f"M{f(tip[0])},{f(tip[1])} L{f(left[0])},{f(left[1])} "
        f"A{f(r)},{f(r)} 0 1 1 {f(right[0])},{f(right[1])} Z"
    )


def leaf(base, tip, w):
    bx, by = base
    tx, ty = tip
    mx, my = (bx + tx) / 2, (by + ty) / 2
    dx, dy = tx - bx, ty - by
    n = math.hypot(dx, dy)
    nx, ny = -dy / n, dx / n
    c1 = (mx + nx * w, my + ny * w)
    c2 = (mx - nx * w, my - ny * w)
    return (
        f"M{f(bx)},{f(by)} Q{f(c1[0])},{f(c1[1])} {f(tx)},{f(ty)} "
        f"Q{f(c2[0])},{f(c2[1])} {f(bx)},{f(by)} Z"
    )


def rosetta():
    """Cream latte-art rosetta centred on the inset."""
    parts = []
    # heart at the top of the stem
    for sx in (-1, 1):
        parts.append(
            f'<ellipse cx="{f(sx*8)}" cy="-46" rx="9" ry="12" '
            f'transform="rotate({f(sx*-22)} {f(sx*8)} -46)"/>'
        )
    # petals: broad, flat-ish pairs that fan out and stack down the stem, the
    # classic rosetta; the crema shows between them
    for i, (y, L) in enumerate(((-26, 34), (-6, 36), (14, 33), (32, 27))):
        for sx in (-1, 1):
            tip = (sx * L * 0.98, y - L * 0.18)
            parts.append(f'<path d="{leaf((0, y + 4), tip, 12 - i * 1.2)}"/>')
    return (
        '<g fill="#fff3e4" opacity=".96">'
        + "".join(parts)
        + '</g>'
        + '<path d="M0,-36 L0,46" fill="none" stroke="#fff3e4" stroke-width="4" '
        + 'stroke-linecap="round" opacity=".96"/>'
    )


def pin_group(prefix):
    """The pin in local units: circle r=100 at the origin, tip at y=188."""
    body = teardrop(0, 0, 100, 188)
    inner = teardrop(0, -4, 68, 116)
    return f"""
<defs>
  <linearGradient id="{prefix}body" gradientUnits="userSpaceOnUse" x1="0" y1="-100" x2="0" y2="188">
    <stop offset="0" stop-color="#ff8a1a"/>
    <stop offset=".42" stop-color="#ff7a00"/>
    <stop offset=".7" stop-color="#c9590c"/>
    <stop offset="1" stop-color="#7a3210"/>
  </linearGradient>
  <radialGradient id="{prefix}crema" gradientUnits="userSpaceOnUse" cx="0" cy="-14" r="92">
    <stop offset="0" stop-color="#c98246"/>
    <stop offset=".55" stop-color="#8e4a1c"/>
    <stop offset="1" stop-color="#4e2108"/>
  </radialGradient>
</defs>
<path d="{body}" fill="url(#{prefix}body)" stroke="{CREAM_RIM}" stroke-width="6" stroke-linejoin="round"/>
<path d="{inner}" fill="url(#{prefix}crema)" stroke="{CREAM_RIM}" stroke-width="7" stroke-linejoin="round"/>
{rosetta()}
"""


# Shadows: blur ONLY a black silhouette drawn underneath, never the artwork.
# WebKit (iOS/iPadOS, Safari) renders a filtered group through an offscreen
# buffer at reduced resolution, so wrapping the whole pin/wordmark in
# feDropShadow made the art itself soft on Retina screens. With the blur on a
# separate silhouette the art stays plain vector and pin-sharp.
PIN_FILTER = """<filter id="{p}shadow" x="-30%" y="-20%" width="160%" height="150%">
  <feGaussianBlur stdDeviation="8"/>
</filter>"""


def pin_shadow(prefix):
    """Soft drop shadow for the pin: the body outline, offset down, blurred."""
    return (
        f'<path d="{teardrop(0, 0, 100, 188)}" transform="translate(0 8)" '
        f'fill="#000" opacity=".6" filter="url(#{prefix}shadow)"/>'
    )


def write_pin():
    p = "pin-"
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="-120 -120 240 336" width="240" height="336">
<defs>{PIN_FILTER.format(p=p)}</defs>
{pin_shadow(p)}
{pin_group(p)}
</svg>
"""
    path = os.path.join(OUT, "gossoko-pin.svg")
    with open(path, "w") as fh:
        fh.write(svg)
    print("wrote", path)


# ---------- the wordmark ------------------------------------------------------

def glyph_metrics(font):
    gs = font.getGlyphSet()
    cmap = font.getBestCmap()
    upm = font["head"].unitsPerEm
    cap_units = getattr(font["OS/2"], "sCapHeight", 0) or 0
    if not cap_units:
        bp = BoundsPen(gs)
        gs[cmap[ord("H")]].draw(bp)
        cap_units = bp.bounds[3]
    return gs, cmap, CAP / cap_units


def write_wordmark():
    font = TTFont(FONT)
    gs, cmap, s = glyph_metrics(font)
    hmtx = font["hmtx"]
    baseline = CAP  # y of the baseline; cap top sits at y=0
    track = CAP * 0.03
    depth = CAP * 0.10  # extrude depth in px, drawn as stacked copies down-right
    steps = int(round(depth))
    shadow_pad = 36

    x = 0.0
    defs = []
    body = []
    ink = []  # (letter index, x0, x1) of each glyph's ink, for pin placement
    for i, ch in enumerate(WORD):
        gname = cmap[ord(ch)]
        adv = hmtx[gname][0] * s
        bp = BoundsPen(gs)
        gs[gname].draw(bp)
        bx0, _, bx1, _ = bp.bounds
        ink.append((x + bx0 * s, x + bx1 * s))
        if i == PIN_LABEL_INDEX:
            x += adv + track
            continue
        pen = SVGPathPen(gs)
        tpen = TransformPen(pen, (s, 0, 0, -s, x, baseline))
        gs[gname].draw(tpen)
        defs.append(f'<path id="g{i}" d="{pen.getCommands()}"/>')
        x += adv + track
    width = x - track

    # Pin takes the slot of letter PIN_LABEL_INDEX: width equal to that O's ink.
    pin_x0, pin_x1 = ink[PIN_LABEL_INDEX]
    k = (pin_x1 - pin_x0) / 200.0
    pin_cx = (pin_x0 + pin_x1) / 2
    pin_top = baseline - CAP - CAP * 0.04  # just above the cap line
    pin_tf = f"translate({f(pin_cx)} {f(pin_top + 100 * k)}) scale({f(k)})"

    # Extrude: stacked copies of each face, offset down-right, drawn behind.
    extrude = []
    for t in range(steps, 0, -1):
        for i in range(len(WORD)):
            if i == PIN_LABEL_INDEX:
                continue
            extrude.append(
                f'<use href="#g{i}" fill="{EXTRUDE}" transform="translate({f(t*0.55)} {f(t)})"/>'
            )
    # Shadow silhouette: every letter face plus its deepest extrude copy.
    shadow = []
    for i in range(len(WORD)):
        if i == PIN_LABEL_INDEX:
            continue
        shadow.append(f'<use href="#g{i}"/>')
        shadow.append(f'<use href="#g{i}" transform="translate({f(steps*0.55)} {f(steps)})"/>')
    faces = [
        f'<use href="#g{i}" fill="url(#face)"/>'
        for i in range(len(WORD))
        if i != PIN_LABEL_INDEX
    ]

    # Viewbox: letters + extrude + pin + shadow padding.
    pin_bottom = pin_top + 288 * k
    vb_x0 = -shadow_pad
    vb_y0 = min(pin_top, 0) - shadow_pad
    vb_w = width + depth + shadow_pad * 2
    vb_h = max(pin_bottom, baseline + depth) - vb_y0 + shadow_pad

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="{f(vb_x0)} {f(vb_y0)} {f(vb_w)} {f(vb_h)}" role="img" aria-label="Gossoko">
<defs>
<linearGradient id="face" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="{f(baseline)}">
  <stop offset="0" stop-color="#fff7ec"/>
  <stop offset=".6" stop-color="{CREAM}"/>
  <stop offset="1" stop-color="#e2cfb8"/>
</linearGradient>
<filter id="wshadow" x="-10%" y="-20%" width="120%" height="150%">
  <feGaussianBlur stdDeviation="{f(CAP*0.08)}"/>
</filter>
{PIN_FILTER.format(p="wp-")}
{''.join(defs)}
{pin_group_defs("wp-")}
</defs>
<g fill="#000" opacity=".7" filter="url(#wshadow)" transform="translate(0 {f(CAP*0.07)})">{''.join(shadow)}</g>
<g>{''.join(extrude)}</g>
<g>{''.join(faces)}</g>
<g transform="{pin_tf}">
{pin_shadow("wp-")}
{pin_group_body("wp-")}
</g>
</svg>
"""
    path = os.path.join(OUT, "gossoko-wordmark.svg")
    with open(path, "w") as fh:
        fh.write(svg)
    print("wrote", path, f"viewBox {f(vb_w)}x{f(vb_h)}")

    # Where the pin-only SVG sits inside the wordmark, so the intro can fly the
    # pin into the slot and hand over with no jump. Same maths as pin_tf above:
    # the pin SVG box is 240x336 units with its origin at the pin centre.
    slot = (pin_cx - 120 * k, pin_top + 100 * k - 120 * k, 240 * k, 336 * k)
    geo = os.path.join(OUT, "wordmark-geometry.ts")
    with open(geo, "w") as fh:
        fh.write(
            "// Generated by scripts/make_brand_svg.py. Do not edit by hand.\n"
            "// Units: the wordmark SVG viewBox.\n"
            f"export const WORDMARK_VIEWBOX = {{ x: {f(vb_x0)}, y: {f(vb_y0)}, w: {f(vb_w)}, h: {f(vb_h)} }} as const;\n"
            f"export const WORDMARK_PIN_SLOT = {{ x: {f(slot[0])}, y: {f(slot[1])}, w: {f(slot[2])}, h: {f(slot[3])} }} as const;\n"
        )
    print("wrote", geo)


def pin_group_defs(prefix):
    # gradients only; the pin body is emitted separately so defs stay in <defs>
    full = pin_group(prefix)
    start = full.index("<defs>") + len("<defs>")
    end = full.index("</defs>")
    return full[start:end]


def pin_group_body(prefix):
    full = pin_group(prefix)
    return full[full.index("</defs>") + len("</defs>"):]


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    write_pin()
    write_wordmark()
