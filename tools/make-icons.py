#!/usr/bin/env python3
"""Generate every application icon — Android launcher and web/PWA — from favicon.jpg.

Run from the repo root:  python tools/make-icons.py

Three variants are produced, because Android needs all of them:

* adaptive icon (API 26+, i.e. practically every device now):
  mipmap-anydpi-v26/ic_launcher{,_round}.xml = a flat colour background plus a
  transparent foreground layer on a 108dp canvas. The launcher applies its own
  mask, so the subject is scaled to sit inside the 72dp safe circle.
* legacy square/round PNGs (minSdk is 24, so API 24/25 still need them, and some
  third-party launchers prefer them): full-bleed, with the shape baked in.

Two things here are measured rather than guessed, and both matter:

* the background colour is sampled from the artwork's own border, so the flat
  background of the adaptive icon matches it exactly and leaves no seam;
* the foreground scale comes from the subject's largest distance to the centre,
  so no mask shape can clip it. A fixed "looks about right" padding is what
  produces icons with a sliced-off subject under a circular mask.

The background is removed by flood-filling inward from the border instead of
thresholding the whole image on colour: the illustration's collar has a green
trim that is close to the background but is a *separate* region, and a global
threshold would punch holes in it.

The same run also writes the web/PWA icons into `public/`, so both platforms
stay in step and the artwork is never edited twice:

* `icons/icon-{192,512}.png` — `purpose: any`. Full-bleed and square: with no
  mask promised, the artwork's own background is the frame.
* `icons/maskable-{192,512}.png` — `purpose: maskable`. Here a mask *is*
  promised, so this reuses the adaptive icon's composition: opaque to every
  edge and the subject inside the safe circle. A maskable icon with transparent
  corners is the classic mistake — the mask crops, and what shows through is not
  the artwork.
* `apple-touch-icon.png` — 180px, opaque square. iOS rounds it itself, and
  renders transparency as black.
* `favicon.ico` (16/32/48) and `favicon-32.png`.

Requires Pillow (`pip install pillow`).
"""

from PIL import Image, ImageDraw
import math
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
RES = ROOT / "android/app/src/main/res"
PUBLIC = ROOT / "public"
SOURCE = ROOT / "favicon.jpg"
PREVIEW = ROOT / "screenshots/icon-preview.png"

# dp sizes: legacy launcher icon, and the adaptive icon's full canvas.
LEGACY_DP = 48
CANVAS_DP = 108
# Keep the subject within 0.333 of the canvas (= the 72dp safe circle's radius),
# with a hair of margin so anti-aliased edges sit inside it too.
SAFE_RADIUS = 0.325
DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
FLOOD_THRESHOLD = 48


def patch_avg(img: Image.Image, x0: int, y0: int, size: int = 24):
    px = [img.getpixel((x, y)) for x in range(x0, x0 + size) for y in range(y0, y0 + size)]
    return tuple(round(sum(c[i] for c in px) / len(px)) for i in range(3))


def sample_background(img: Image.Image):
    w, h = img.size
    corners = [
        patch_avg(img, 2, 2),
        patch_avg(img, w - 26, 2),
        patch_avg(img, 2, h - 26),
        patch_avg(img, w - 26, h - 26),
    ]
    return tuple(round(sum(c[i] for c in corners) / len(corners)) for i in range(3))


def cut_out_subject(img: Image.Image) -> Image.Image:
    """Make the flat background transparent, without touching enclosed regions."""
    w, h = img.size
    out = img.copy()
    seeds = [
        (0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
        (w // 2, 0), (0, h // 2), (w - 1, h // 2), (w // 2, h - 1),
    ]
    for seed in seeds:
        if out.getpixel(seed)[3] != 0:
            ImageDraw.floodfill(out, seed, (0, 0, 0, 0), thresh=FLOOD_THRESHOLD)
    return out


def max_radius_frac(alpha: Image.Image, n: int = 512) -> float:
    """Largest distance of an opaque pixel from the centre, as a fraction of width."""
    small = alpha.resize((n, n), Image.Resampling.BILINEAR)
    px = small.load()
    best = 0.0
    for y in range(n):
        for x in range(n):
            if px[x, y] > 128:
                best = max(best, math.hypot((x + 0.5) / n - 0.5, (y + 0.5) / n - 0.5))
    return best


def shaped(img: Image.Image, size: int, shape: str, radius_frac: float = 0.0) -> Image.Image:
    out = img.resize((size, size), Image.Resampling.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    if shape == "circle":
        draw.ellipse([0, 0, size - 1, size - 1], fill=255)
    else:
        draw.rounded_rectangle(
            [0, 0, size - 1, size - 1], radius=int(size * radius_frac), fill=255
        )
    out.putalpha(mask)
    return out


def centred(subject: Image.Image, canvas: int, scale: float) -> Image.Image:
    side = round(canvas * scale)
    layer = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    piece = subject.resize((side, side), Image.Resampling.LANCZOS)
    layer.alpha_composite(piece, ((canvas - side) // 2, (canvas - side) // 2))
    return layer


def maskable(subject: Image.Image, background, size: int, scale: float) -> Image.Image:
    """Opaque to every edge, subject inside the safe circle."""
    layer = Image.new("RGBA", (size, size), background + (255,))
    layer.alpha_composite(centred(subject, size, scale))
    return layer


ADAPTIVE_XML = (
    '<?xml version="1.0" encoding="utf-8"?>\n'
    '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
    '    <background android:drawable="@color/ic_launcher_background" />\n'
    '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n'
    "</adaptive-icon>\n"
)


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    w, h = source.size
    background = sample_background(source)
    hexed = "#%02X%02X%02X" % background
    print(f"background sampled from the artwork: {background} {hexed}")

    subject = cut_out_subject(source)
    flat = Image.new("RGBA", (w, h), background + (255,))
    flat.alpha_composite(subject)

    full_radius = max_radius_frac(subject.getchannel("A"))
    scale = SAFE_RADIUS / full_radius
    print(f"subject max radius {full_radius:.3f} -> adaptive scale {scale:.3f}")
    if full_radius > 0.5:
        raise SystemExit("subject does not fit a circular mask; revisit the artwork")

    for name, density in DENSITIES.items():
        out_dir = RES / f"mipmap-{name}"
        out_dir.mkdir(parents=True, exist_ok=True)
        legacy = int(LEGACY_DP * density)
        shaped(flat, legacy, "square", 0.18).save(out_dir / "ic_launcher.png")
        shaped(flat, legacy, "circle").save(out_dir / "ic_launcher_round.png")
        canvas = int(CANVAS_DP * density)
        centred(subject, canvas, scale).save(out_dir / "ic_launcher_foreground.png")
        print(f"  {name}: legacy {legacy}px, adaptive canvas {canvas}px")

    anydpi = RES / "mipmap-anydpi-v26"
    anydpi.mkdir(parents=True, exist_ok=True)
    (anydpi / "ic_launcher.xml").write_text(ADAPTIVE_XML, encoding="utf-8", newline="\n")
    (anydpi / "ic_launcher_round.xml").write_text(ADAPTIVE_XML, encoding="utf-8", newline="\n")
    (RES / "values/colors.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<resources>\n"
        "    <!-- Sampled from the icon artwork's flat background by tools/make-icons.py. -->\n"
        f'    <color name="ic_launcher_background">{hexed}</color>\n'
        "</resources>\n",
        encoding="utf-8",
        newline="\n",
    )
    print("wrote mipmap-anydpi-v26/*.xml and values/colors.xml")

    # --- web / PWA ---------------------------------------------------------
    icons = PUBLIC / "icons"
    icons.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        # `any`: no mask promised, so the artwork's background is the frame.
        shaped(flat, size, "square", 0.0).convert("RGB").save(icons / f"icon-{size}.png")
        # `maskable`: a mask is promised, so stay opaque and inside the circle.
        maskable(subject, background, size, scale).convert("RGB").save(
            icons / f"maskable-{size}.png"
        )
    # iOS masks it itself and turns transparency into black.
    shaped(flat, 180, "square", 0.0).convert("RGB").save(PUBLIC / "apple-touch-icon.png")
    shaped(flat, 32, "square", 0.0).convert("RGB").save(PUBLIC / "favicon-32.png")
    shaped(flat, 48, "square", 0.0).convert("RGB").save(
        PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)]
    )
    print("wrote public/{icons/icon-*,icons/maskable-*,apple-touch-icon.png,favicon-32.png,favicon.ico}")

    # Side-by-side preview of the three variants, so the result can be eyeballed.
    size = 288
    sheet = Image.new("RGBA", (size * 3 + 160, size + 80), (246, 242, 235, 255))
    adaptive = Image.new("RGBA", (size, size), background + (255,))
    circle = Image.new("L", (size, size), 0)
    ImageDraw.Draw(circle).ellipse([0, 0, size - 1, size - 1], fill=255)
    adaptive.putalpha(circle)
    adaptive.alpha_composite(centred(subject, size, scale))
    for index, img in enumerate(
        [shaped(flat, size, "square", 0.18), shaped(flat, size, "circle"), adaptive]
    ):
        sheet.alpha_composite(img, (40 + index * (size + 40), 40))
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(PREVIEW)
    print(f"wrote {PREVIEW.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
