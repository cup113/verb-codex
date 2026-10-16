#!/usr/bin/env python3
"""Fold Chinese serif glyphs into Newsreader, so Latin and hanzi share one family.

Run from the repo root:  python tools/make-fonts.py

Needs fontTools (`pip install fonttools`). The CJK source — Noto Serif SC, the
思源宋体 / Source Han Serif that most Chinese books are set in — is 24 MB as
published and variable, so a copy is cached under `.fonts-src/` (gitignored)
and downloaded only once.

Why the two scripts are *merged* rather than shipped as a second family:

* Android resolves `fontFamily` to exactly one family — there is no CSS-style
  fallback list. A note reading "aimer 喜欢" set in Newsreader would paint the
  Latin in the notebook's serif and the hanzi in the system sans *on the same
  line*, which is the one thing a paper notebook never does.
* So the CJK outlines go into Newsreader's own instances: one file per weight,
  carrying both scripts, identical on Android and on the web. The web declares
  that same file behind a `unicode-range` (see web/fonts.css), so a browser
  that never renders a hanzi never downloads those megabytes.

Coverage is the GB2312 set: 6763 hanzi plus CJK punctuation and full-width
forms. It is a deliberate size/coverage trade — a character outside the set
falls back to the system font instead of costing every reader another 20 MB.

Per weight the pipeline is:

    instance the variable font at the weight
      -> subset to the GB2312 character set, horizontal layout only
      -> rescale 1000 upem to Newsreader's 2000
      -> merge, Newsreader first so its Latin wins every shared codepoint
      -> rename the family after the file (Android names a family after it)

Two facts about the two faces decide the fiddly parts, and both are measured
rather than guessed:

* the CJK face is *unhinted* (`maxFunctionDefs` 0) while Newsreader carries
  `cvt `/`fpgm`/`prep` and per-glyph instructions. The merger's default is to
  drop a table only one font has, which would throw away Newsreader's hinting
  and leave its glyph programs calling undefined functions. So those three
  tables are passed through from whichever font actually has them.
* the CJK face carries `vhea`/`vmtx` and the vertical features (`vert`, `vrt2`,
  …) and Newsreader carries neither. The merger's `equal` logic refuses a
  table present on one side only, and the codex sets no vertical text at all,
  so the vertical half is dropped here instead.

Two copies come out, kept in step as every other font in this repo already is:

* assets/fonts/NewsreaderHan{Regular,Medium}.ttf                (CLI bundles it)
* android/app/src/main/assets/fonts/NewsreaderHan{Regular,Medium}.ttf

Italic and mono are deliberately left alone: the italic face is only ever used
for French chrome ("‹ 1er", `votre nom`, hints) and the mono face for pronouns
and counters — neither can meet a hanzi.
"""

from __future__ import annotations

import argparse
import pathlib
import sys
import urllib.request

try:
    from fontTools import subset
    from fontTools import ttLib
    from fontTools.merge import Merger
    from fontTools.merge import base as merge_base
    from fontTools.ttLib import TTFont
    from fontTools.ttLib.scaleUpem import scale_upem
    from fontTools.varLib import instancer
except ImportError:  # pragma: no cover - the message is the point
    sys.exit("fontTools is missing: pip install fonttools")

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = REPO_ROOT / ".fonts-src"
OUT_DIRS = (
    REPO_ROOT / "assets" / "fonts",
    REPO_ROOT / "android" / "app" / "src" / "main" / "assets" / "fonts",
)
NEWSREADER_UPEM = 2000

# Pinned to a path, not to a moving tag: a regeneration months from now must
# produce the same file, and a changed upstream is noticed as a different
# download rather than as silently different glyphs.
NOTO_VF_URL = (
    "https://raw.githubusercontent.com/google/fonts/main/"
    "ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf"
)
NOTO_VF_NAME = "NotoSerifSC[wght].ttf"

# The two weights theme.ts names as families. 500 is Noto's Medium.
WEIGHTS = (("Regular", 400), ("Medium", 500))

# Horizontal text only: the codex has no vertical writing mode, and the merger
# cannot reconcile vertical metrics that only one of the two faces has.
VERTICAL_FEATURES = frozenset({"vert", "vrt2", "vpal", "valt", "vkna", "vrtr"})
VERTICAL_TABLES = ("vhea", "vmtx", "BASE", "STAT", "VORG", "DSIG")

# Hinting lives only on the Latin side; the CJK face has no instructions.
HINTING_TABLES = ("cvt ", "fpgm", "prep")

# Typographic odds and ends a French notebook picks up around hanzi. Most are
# already inside GB2312; listing them costs nothing and makes the intent clear.
EXTRA_CHARS = "—–…·×÷°§¶†‡•‰′″€£¥±≈≠≤≥←→↑↓“”‘’「」『』【】〈〉《》、。，！？：；（）"


def gb2312_codepoints() -> set[int]:
    """Every character GB2312 can encode, read out of the codec itself.

    Enumerating the codec beats shipping a character list: it is the standard's
    own answer, and it cannot drift from what the standard says.
    """
    chars: set[str] = set()
    for high in range(0xA1, 0xF8):
        for low in range(0xA1, 0xFF):
            try:
                chars.add(bytes((high, low)).decode("gb2312"))
            except UnicodeDecodeError:
                continue
    chars.update(EXTRA_CHARS)
    return {ord(char) for char in chars}


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


def horizontal_features(font: TTFont) -> list[str]:
    """Every layout feature the face ships, minus the vertical ones."""
    tags: set[str] = set()
    for tag in ("GSUB", "GPOS"):
        if tag not in font:
            continue
        records = font[tag].table.FeatureList.FeatureRecord
        tags.update(record.FeatureTag for record in records)
    return sorted(tags - VERTICAL_FEATURES)


def han_static(
    noto_path: pathlib.Path, weight: int, codepoints: set[int], cache: pathlib.Path
) -> pathlib.Path:
    """Instance, subset and rescale one weight of the CJK face."""
    cached = cache / f"NotoSerifSC-Han-{weight}.ttf"
    if cached.exists():
        print(f"  cached  {cached.name}")
        return cached

    font = TTFont(noto_path)
    instancer.instantiateVariableFont(
        font, {"wght": weight}, inplace=True, updateFontNames=False
    )

    options = subset.Options()
    # Named features rather than `*`: ccmp/locl/mark are what make hanzi
    # compose, and the vertical half must not come along (see module docstring).
    options.layout_features = horizontal_features(font)
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.notdef_outline = True
    options.recalc_bounds = True
    options.drop_tables = list(options.drop_tables) + list(VERTICAL_TABLES)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)

    # Newsreader is 2000 upem and the CJK source is 1000; the merge below
    # refuses mixed metrics, so this is the bridge between them.
    if font["head"].unitsPerEm != NEWSREADER_UPEM:
        scale_upem(font, NEWSREADER_UPEM)

    font.save(cached)
    font.close()
    print(f"  built   {cached.name} ({cached.stat().st_size / 1048576:.1f} MB)")
    return cached


_HINTING_REGISTERED = False


def keep_hinting_tables() -> None:
    """Let `cvt `/`fpgm`/`prep` come from whichever font has them.

    Registered on the table classes the merger would otherwise treat as
    unknown and drop, which is what would strip Newsreader's hinting. The
    registration is on the classes themselves, so it happens once per process
    — the second weight reuses it.
    """
    global _HINTING_REGISTERED
    if _HINTING_REGISTERED:
        return
    classes = [ttLib.getTableClass(tag) for tag in HINTING_TABLES]

    @merge_base.add_method(*classes)
    def merge(self, merger, tables):
        present = [table for table in tables if table is not NotImplemented]
        return present[0] if present else NotImplemented

    _HINTING_REGISTERED = True


def merged_font(
    newsreader_path: pathlib.Path, han_path: pathlib.Path, family: str
) -> TTFont:
    """Newsreader first: its Latin, digits and accents win every shared codepoint."""
    keep_hinting_tables()
    font = Merger().merge([str(newsreader_path), str(han_path)])
    # Left over from the variable source, meaningless on a static instance, and
    # actively wrong once two fonts are combined.
    for table in ("DSIG", "STAT", "fvar", "gvar", "avar", "HVAR", "MVAR", "VVAR"):
        if table in font:
            del font[table]
    name = font["name"]
    # One family per file, spelled exactly like the file: React Native on
    # Android names a family after the font file, so anything else here is a
    # second, contradictory answer.
    for name_id in (1, 3, 4, 6):
        name.setName(family, name_id, 3, 1, 0x409)
        name.setName(family, name_id, 1, 0, 0)
    name.setName("Regular", 2, 3, 1, 0x409)
    name.setName("Regular", 2, 1, 0, 0)
    # The typographic family/subfamily pair would regroup the two weights under
    # one name and undo the per-file convention above.
    name.removeNames(nameID=16)
    name.removeNames(nameID=17)
    return font


def verify(path: pathlib.Path, probed: dict[str, int]) -> None:
    """A merged font is only worth committing if both scripts really landed."""
    font = TTFont(path, lazy=True)
    cmap = font.getBestCmap()
    missing = [char for char in probed if ord(char) not in cmap]
    if missing:
        raise SystemExit(f"{path.name}: missing glyphs for {''.join(missing)!r}")
    hinted = all(tag in font for tag in HINTING_TABLES)
    print(
        f"  verify  {path.name}: {len(font.getGlyphOrder())} glyphs, "
        f"both scripts present, hinting {'kept' if hinted else 'MISSING'}"
    )
    font.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--cache", type=pathlib.Path, default=CACHE)
    args = parser.parse_args()

    codepoints = gb2312_codepoints()
    print(f"charset: GB2312 + extras = {len(codepoints)} characters")

    noto = download(NOTO_VF_URL, args.cache / NOTO_VF_NAME)
    for out_dir in OUT_DIRS:
        if not out_dir.is_dir():
            raise SystemExit(f"missing font directory: {out_dir}")

    # 懿 is 二级字库, 法 is 一级, é/œ/’ are Newsreader's own — one probe per
    # script and per coverage tier, so a half-merged file cannot pass.
    probe = {"法": 0, "懿": 0, "é": 0, "œ": 0, "’": 0, "—": 0}

    for suffix, weight in WEIGHTS:
        family = f"NewsreaderHan{suffix}"
        print(f"{family} (wght {weight})")
        newsreader = REPO_ROOT / "assets" / "fonts" / f"Newsreader{suffix}.ttf"
        if not newsreader.exists():
            raise SystemExit(f"missing Latin source: {newsreader}")
        han = han_static(noto, weight, codepoints, args.cache)
        font = merged_font(newsreader, han, family)
        for out_dir in OUT_DIRS:
            target = out_dir / f"{family}.ttf"
            font.save(target)
            verify(target, probe)
        font.close()
        print(f"  wrote   {family}.ttf to {len(OUT_DIRS)} directories")

    print("done: theme.ts already points at NewsreaderHan{Regular,Medium}")


if __name__ == "__main__":
    main()
