#!/usr/bin/env python3
"""Cut the two marks the notebook writes as symbols into one small face.

Run from the repo root:  python tools/make-symbols.py

The codex has two places where a mark is a *symbol* rather than a drawn shape:

* the list's star — a complete entry the owner has set aside (★, U+2605);
* the dictation stamp's ornament — `✦ Sans faute ✦` (U+2726).

Neither can come from the ordinary text faces. Newsreader carries no ★ and no
✦, and the merged `NewsreaderHan*` face — which does carry ★, because GB2312's
symbol rows include it — is a 3.5 MB download fence in `web/fonts.css`: a
French-only reader would pay the whole hanzi face for one star. The stamp has
been falling back to whatever symbol glyph the system owns, which is a
different shape on every platform.

So the two marks get one dedicated face: four codepoints, a couple of
kilobytes, and the same outline on Android and in the browser. The source is
Noto Sans Symbols 2 (OFL), the only face already in the family that has all
four — Noto Serif SC, the hanzi source, stops at ★ and ☆.

    subset to U+2605/2606/2726/2727
      -> rename the family after the file (Android names a family after it)
      -> write both copies, exactly as the other fonts are kept in step

Two copies come out:

* assets/fonts/NewsreaderSymbols.ttf                (CLI / web bundle)
* android/app/src/main/assets/fonts/NewsreaderSymbols.ttf

The source is cached under `.fonts-src/` (gitignored) and downloaded only
once, like the CJK variable font in tools/make-fonts.py.
"""

from __future__ import annotations

import argparse
import pathlib
import urllib.request

try:
    from fontTools import subset
    from fontTools.ttLib import TTFont
except ImportError:  # pragma: no cover - the message is the point
    raise SystemExit("fontTools is missing: pip install fonttools")

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = REPO_ROOT / ".fonts-src"
OUT_DIRS = (
    REPO_ROOT / "assets" / "fonts",
    REPO_ROOT / "android" / "app" / "src" / "main" / "assets" / "fonts",
)

# Pinned to a path, not to a moving tag: a regeneration months from now must
# produce the same outlines, and a changed upstream is noticed as a different
# download rather than as silently different marks.
SOURCE_URL = (
    "https://raw.githubusercontent.com/google/fonts/main/"
    "ofl/notosanssymbols2/NotoSansSymbols2-Regular.ttf"
)
SOURCE_NAME = "NotoSansSymbols2-Regular.ttf"

FAMILY = "NewsreaderSymbols"

# ★ ☆ ✦ ✧ — the two the app draws, and their hollow twins for whoever wants
# them next. Four outlines cost a few hundred bytes; re-cutting the face later
# would cost a download and a new binary diff.
CODEPOINTS = (0x2605, 0x2606, 0x2726, 0x2727)


def download(url: str, dest: pathlib.Path) -> pathlib.Path:
    if dest.exists():
        print(f"  cached  {dest.name} ({dest.stat().st_size / 1048576:.1f} MB)")
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"  fetch   {url}")
    request = urllib.request.Request(url, headers={"User-Agent": "verbcodex-fonts"})
    with urllib.request.urlopen(request, timeout=900) as response:
        payload = response.read()
    dest.write_bytes(payload)
    print(f"  saved   {dest.name} ({len(payload) / 1048576:.1f} MB)")
    return dest


def symbol_font(source: pathlib.Path) -> TTFont:
    """The four marks, renamed after the file they will be saved as."""
    font = TTFont(source)

    options = subset.Options()
    # Nothing here is a script: no ligatures, no marks, no kerning to keep.
    options.layout_features = []
    # Names survive the subset so the rename below has a table to write into.
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.notdef_outline = True
    options.recalc_bounds = True

    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=CODEPOINTS)
    subsetter.subset(font)

    name = font["name"]
    # One family per file, spelled exactly like the file: React Native on
    # Android names a family after the font file, so anything else here is a
    # second, contradictory answer.
    for name_id in (1, 3, 4, 6):
        name.setName(FAMILY, name_id, 3, 1, 0x409)
        name.setName(FAMILY, name_id, 1, 0, 0)
    name.setName("Regular", 2, 3, 1, 0x409)
    name.setName("Regular", 2, 1, 0, 0)
    # The typographic family/subfamily pair would regroup the face under a name
    # other than the file's.
    name.removeNames(nameID=16)
    name.removeNames(nameID=17)
    return font


def verify(path: pathlib.Path) -> None:
    """A subset that dropped a mark would render .notdef and look like a bug."""
    font = TTFont(path, lazy=True)
    cmap = font.getBestCmap()
    missing = [hex(code) for code in CODEPOINTS if code not in cmap]
    if missing:
        raise SystemExit(f"{path.name}: missing glyphs for {', '.join(missing)}")
    size = path.stat().st_size
    if size > 20_000:
        raise SystemExit(
            f"{path.name}: {size} bytes, larger than a symbol face should be"
        )
    print(f"  verify  {path.name}: {len(font.getGlyphOrder())} glyphs, {size} bytes")
    font.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--cache", type=pathlib.Path, default=CACHE)
    args = parser.parse_args()

    print(f"symbols: {' '.join(hex(code) for code in CODEPOINTS)}")
    source = download(SOURCE_URL, args.cache / SOURCE_NAME)
    font = symbol_font(source)

    for out_dir in OUT_DIRS:
        if not out_dir.is_dir():
            raise SystemExit(f"missing font directory: {out_dir}")
        target = out_dir / f"{FAMILY}.ttf"
        font.save(target)
        verify(target)
    font.close()


if __name__ == "__main__":
    main()
