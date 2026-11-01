#!/usr/bin/env python3
"""Composite badge layers for the art-direction review.

Builds circle and pointy-top hexagon badges from the processed RGBA layers,
using the recommended candidate per asset from reports/badge-art/shortlist.json.

Geometry (1024 px canvas, centre 512,512):
  circle  emblem 800 | rank 880/800 | frame 1016/880
  hexagon emblem R400 | rank R440/400 | frame R508/440
          overall 880 wide x 1016 tall; vertices at pi/6 + k*pi/3

Hexagon bands are radial remaps of the circular annuli: the destination
boundary at angle theta is R*cos(pi/6)/cos(d), d = ((theta+pi/6) mod pi/3) - pi/6.
The frame maps source 440..508 to destination 440..508; the rank maps
400..440 to 400..440 (variant A) or 410..450 (variant C inlay). Circle
variant C maps the rank to the 840/920 diameter band (420..460 radius).

Variant E puts the rank on the outer border: circle scales the rank layer
1016/880 about the centre (band 461.8..508 radius); hexagon remaps it to
R468..508. The stack is emblem -> frame -> rank, so the rank covers the
frame's outer ~46 px (circle) / ~40 px (hexagon) and becomes the outer rim.
The emblem is scaled 880/800 to the frame's opening so the moved rank does
not leave a transparent ring between the emblem and the frame.

Variant F is the rank-treatment proof the two artistic reviews converged on:
D geometry (emblem + family frame, no rank ring) plus a rank boss mounted on
the frame at 6 o'clock. F1 keeps the family frame's original metal; F2 first
plates the frame band to the rank alloy with a luminance duotone (alpha and
engraving preserved) and then adds the same boss. F is circle-only.

Outputs (default reports/badge-art/composites/):
  circle/<slug>.webp, hexagon/<slug>.webp  512x512 previews on #14181f
  circle-e/<slug>.webp, hexagon-e/<slug>.webp  variant E previews
  coherence-circle.jpg, coherence-hexagon.jpg  3x3 labelled grids
  coherence-circle-e.jpg, coherence-hexagon-e.jpg  variant E grids
  stack-circle.png, stack-hexagon.png          exploded A stack, 4 panels
  stack-variants.jpg                          A/C/D/E for the hero badge
  rank-matrix-circle.jpg, rank-matrix-hexagon.jpg
  circle-f1/<slug>.webp, circle-f2/<slug>.webp  variant F previews (--proof f)
  coherence-circle-f1.jpg, coherence-circle-f2.jpg  variant F grids
  legibility-96-circle-f1.jpg, legibility-96-circle-f2.jpg  96 px sheets
  stack-f.jpg                                 D / F1 / F2 for the hero badge
  manifest.json

The fixed sheets (stacks, variants, rank matrices) always use Across the
Buckleberry Ferry with a gold rank, matching the plan's variants sheet.

Usage:
  python3 scripts/badge-art/composite_badges.py --list
  VENV=/run/media/skittlz/LinuxStorageSSD/github/comfyui/venv/bin/python
  $VENV scripts/badge-art/composite_badges.py --skip-grids
  $VENV scripts/badge-art/composite_badges.py
  $VENV scripts/badge-art/composite_badges.py --proof f
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import numpy as np
except ImportError:  # circle variant A still works without numpy
    np = None

try:
    from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont
except ImportError:  # --list and --help still work without Pillow
    Image = ImageChops = ImageDraw = ImageFilter = ImageFont = None

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
PROMPTS_PATH = HERE / "prompts.json"
SHORTLIST_PATH = REPO_ROOT / "reports" / "badge-art" / "shortlist.json"
PROCESSED_ROOT = REPO_ROOT / "raw_assets" / "badges" / "processed"
DEFAULT_OUT = REPO_ROOT / "reports" / "badge-art" / "composites"

CANVAS = 1024
CENTRE = 512.0
SS = 4
PI = math.pi

# (inner circumradius, outer circumradius); the emblem has no inner boundary.
HEXAGON = {"emblem": (None, 400), "rank": (400, 440), "frame": (440, 508)}
# Variant C rank bands: (destination inner, destination outer) in circumradius.
VARIANT_C = {"circle": (420, 460), "hexagon": (410, 450)}
# Variant E: rank as the outer border.
# Circle scales the rank layer by 1016/880 about the centre; hexagon remaps
# the source annulus to the frame's outer band. Moving the rank outward also
# empties the 800..880 slot it filled in variant A, so the emblem grows to
# the frame's 880 opening (440 circumradius) to keep the badge solid.
VARIANT_E = {"circle": {"scale": 1016 / 880}, "hexagon": {"dest": (468, 508)}}
E_EMBLEM_SCALE = 880 / 800
RANK_SRC = (400, 440)
FRAME_SRC = (440, 508)

JOURNEY_RANKS = {1: "bronze", 2: "silver", 3: "gold", 4: "mithril"}
HABIT_RANKS = {"habit-first-steps": "bronze", "habit-faithful-walker": "gold"}
RANK_ORDER = ("bronze", "silver", "gold", "mithril")
RANK_LABELS = {"bronze": "Bronze", "silver": "Silver", "gold": "Gold", "mithril": "Mithril"}
RANK_COLORS = {
    "bronze": "#cd8a4a",
    "silver": "#c9d1d9",
    "gold": "#d4a94a",
    "mithril": "#a9d3e6",
}
SHAPE_LABELS = {"circle": "Circle", "hexagon": "Hexagon"}
VARIANT_LABELS = {
    "A": "rank inside frame",
    "C": "rank inlay",
    "D": "frame only",
    "E": "rank as outer border",
    "F1": "frame + 6 o'clock rank boss",
    "F2": "plated frame + 6 o'clock rank boss",
}
HERO_SLUG = "journey-frodo-sam-buckleberry-ferry"
HERO_RANK = "gold"

# Variant F: a single rank boss set into the family frame at 6 o'clock.
# The processed frame band is 68 px deep at 6 o'clock (y 952..1019), so the
# boss is sized to the band rather than the nominal 76 px: a 76 px bezel would
# overhang the badge's outer edge by ~4 px and push the metal disc into the
# dark well. 70/54/25 px keeps the boss on the band with the outer rim visible.
BOSS = {"centre": (511.0, 979.0), "bezel": 35.0, "disc": 27.0, "gem": 12.5}
RANK_BOSS = {
    "bronze": {"bezel": "#24160d", "metal": "#b87333",
               "highlight": "#f0c090", "gem": "#6e3b1d"},
    "silver": {"bezel": "#1d2329", "metal": "#b9c2cc",
               "highlight": "#f5f8fa", "gem": "#6f7d8c"},
    "gold": {"bezel": "#2b2008", "metal": "#d4a017",
             "highlight": "#ffe8a3", "gem": "#8a6410"},
    "mithril": {"bezel": "#17242e", "metal": "#9fc6d8",
                "highlight": "#e8f7ff", "gem": "#5f8fa6"},
}
RANK_PLATING = {
    "bronze": {"shadows": "#2a1a10", "mids": "#9c5a2e", "highlights": "#e8b27a"},
    "silver": {"shadows": "#232a31", "mids": "#9aa6b2", "highlights": "#eef4f8"},
    "gold": {"shadows": "#3a2a0b", "mids": "#c79a25", "highlights": "#ffe6a0"},
    "mithril": {"shadows": "#1b2b36", "mids": "#8fb6c8", "highlights": "#dff4ff"},
}
BOSS_SS = 8

PREVIEW_BG = "#14181f"
SHEET_BG = "#0d1117"
PANEL_BG = "#161b22"
PANEL_BG_FINAL = "#1b2230"
LABEL_BG = "#151b24"
BORDER = "#30363d"
TEXT = "#e6edf3"
MUTED = "#8b949e"
GOLD = "#d4a94a"

FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

_LAYER_CACHE = {}
_REMAP_CACHE = {}
_HEX_MASKS = {}
_BADGE_CACHE = {}
_BOSS_CACHE = {}
_COORDS = None


# --------------------------------------------------------------------------- #
# Plan resolution
# --------------------------------------------------------------------------- #

def repo_relative(path):
    try:
        return str(Path(path).resolve().relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_prompts():
    data = load_json(PROMPTS_PATH)
    if not isinstance(data.get("assets"), list) or not data["assets"]:
        raise ValueError(f"{PROMPTS_PATH}: no assets")
    return data


def load_shortlist():
    data = load_json(SHORTLIST_PATH)
    if not isinstance(data.get("assets"), dict):
        raise ValueError(f"{SHORTLIST_PATH}: no assets object")
    return data


def recommended(shortlist, asset_id):
    record = shortlist["assets"].get(asset_id)
    if not isinstance(record, dict):
        raise ValueError(f"{SHORTLIST_PATH}: missing {asset_id!r}")
    candidate = record.get("recommended")
    if not isinstance(candidate, str) or not candidate:
        raise ValueError(f"{SHORTLIST_PATH}: {asset_id!r} has no recommended candidate")
    return candidate


def resolve_assets(prompts, shortlist, only=None):
    assets = []
    for source in prompts["assets"]:
        if source.get("group") != "emblem":
            continue
        for key in ("id", "slug", "name", "family", "rank"):
            if key not in source:
                raise ValueError(f"{PROMPTS_PATH}: asset missing {key!r}")
        family = source["family"]
        if family == "journey":
            frame_id = "frame/journey"
            rank = JOURNEY_RANKS.get(source["rank"])
            if rank is None:
                raise ValueError(f"{source['id']}: no journey rank for {source['rank']!r}")
        elif family == "habit":
            frame_id = "frame/habit"
            rank = HABIT_RANKS.get(source["slug"])
            if rank is None:
                raise ValueError(f"{source['id']}: no habit rank for {source['slug']!r}")
        else:
            raise ValueError(f"{source['id']}: unknown family {family!r}")

        emblem_candidate = recommended(shortlist, source["id"])
        frame_candidate = recommended(shortlist, frame_id)
        rank_candidate = recommended(shortlist, f"rank/{rank}")
        record = {
            "id": source["id"],
            "slug": source["slug"],
            "name": source["name"],
            "family": family,
            "rank": rank,
            "frame": frame_id,
            "candidates": {
                "emblem": emblem_candidate,
                "rank": rank_candidate,
                "frame": frame_candidate,
            },
            "layers": {
                "emblem": PROCESSED_ROOT / source["id"] / f"{emblem_candidate}.png",
                "rank": PROCESSED_ROOT / f"rank/{rank}" / f"{rank_candidate}.png",
                "frame": PROCESSED_ROOT / frame_id / f"{frame_candidate}.png",
            },
        }
        if only and not any(
            token.lower() in record["id"].lower() or token.lower() in record["slug"].lower()
            for token in only
        ):
            continue
        assets.append(record)
    return assets


def with_rank(asset, rank, shortlist):
    """Copy an asset plan with a different rank ring (used by the hero sheets)."""
    candidate = recommended(shortlist, f"rank/{rank}")
    copy = dict(asset)
    copy["rank"] = rank
    copy["candidates"] = dict(asset["candidates"])
    copy["candidates"]["rank"] = candidate
    copy["layers"] = dict(asset["layers"])
    copy["layers"]["rank"] = PROCESSED_ROOT / f"rank/{rank}" / f"{candidate}.png"
    return copy


def validate_layers(assets):
    errors = []
    for asset in assets:
        for kind, path in asset["layers"].items():
            if not path.is_file() or path.stat().st_size == 0:
                errors.append(f"{asset['id']} {kind}: missing or empty {repo_relative(path)}")
                continue
            try:
                with Image.open(path) as opened:
                    opened.load()
                    if opened.size != (CANVAS, CANVAS):
                        errors.append(
                            f"{asset['id']} {kind}: expected {CANVAS}x{CANVAS}, "
                            f"got {opened.size[0]}x{opened.size[1]} ({repo_relative(path)})"
                        )
                    if opened.mode not in ("RGBA", "LA") and "transparency" not in opened.info:
                        errors.append(
                            f"{asset['id']} {kind}: no alpha channel "
                            f"(mode {opened.mode}, {repo_relative(path)})"
                        )
            except Exception as exc:  # noqa: BLE001 - report every broken layer
                errors.append(f"{asset['id']} {kind}: unreadable {repo_relative(path)}: {exc}")
    return errors


def print_plan(assets, shapes):
    header = (
        f"{'shape':8s} {'asset':46s} {'display name':32s} {'rank':7s} "
        f"{'frame':14s} {'emblem':10s} {'rank ring':10s} {'frame file':10s}"
    )
    print(header)
    print("-" * len(header))
    for shape in shapes:
        for asset in assets:
            print(
                f"{shape:8s} {asset['id']:46s} {asset['name']:32s} {asset['rank']:7s} "
                f"{asset['frame']:14s} {asset['candidates']['emblem']:10s} "
                f"{asset['candidates']['rank']:10s} {asset['candidates']['frame']:10s}"
            )
    print()
    print(f"{len(assets)} assets x {len(shapes)} shape(s) = {len(assets) * len(shapes)} badges")
    print("layer paths: raw_assets/badges/processed/<asset>/<candidate>.png")
    print("fixed sheets use: Across the Buckleberry Ferry / frame/journey / gold rank")


# --------------------------------------------------------------------------- #
# Image primitives
# --------------------------------------------------------------------------- #

def require_pillow():
    if Image is None:
        raise SystemExit(
            "ERROR: Pillow is required. Run this script with the ComfyUI venv:\n"
            "  /run/media/skittlz/LinuxStorageSSD/github/comfyui/venv/bin/python "
            "scripts/badge-art/composite_badges.py"
        )


def require_numpy():
    if np is None:
        raise SystemExit(
            "ERROR: numpy is required for hexagon remaps and variant C. "
            "Run this script with the ComfyUI venv:\n"
            "  /run/media/skittlz/LinuxStorageSSD/github/comfyui/venv/bin/python "
            "scripts/badge-art/composite_badges.py"
        )


def load_font(size, bold=False):
    names = [FONT_BOLD if bold else FONT_REGULAR,
             "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold
             else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"]
    for name in names:
        if Path(name).is_file():
            return ImageFont.truetype(name, size)
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def load_layer(path):
    key = str(path)
    if key not in _LAYER_CACHE:
        with Image.open(path) as opened:
            opened.load()
            _LAYER_CACHE[key] = opened.convert("RGBA")
    return _LAYER_CACHE[key]


def hex_mask(radius):
    """Antialiased pointy-top hexagon mask, supersampled 4x then downsampled."""
    if radius not in _HEX_MASKS:
        big = Image.new("L", (CANVAS * SS, CANVAS * SS), 0)
        draw = ImageDraw.Draw(big)
        points = [
            (
                (CENTRE + radius * math.cos(PI / 6 + k * PI / 3)) * SS,
                (CENTRE + radius * math.sin(PI / 6 + k * PI / 3)) * SS,
            )
            for k in range(6)
        ]
        draw.polygon(points, fill=255)
        _HEX_MASKS[radius] = big.resize((CANVAS, CANVAS), Image.LANCZOS)
    return _HEX_MASKS[radius]


def mask_hexagon(image, radius=400):
    out = image.copy()
    out.putalpha(ImageChops.multiply(image.getchannel("A"), hex_mask(radius)))
    return out


def get_coords():
    global _COORDS
    if _COORDS is None:
        yy, xx = np.mgrid[0:CANVAS, 0:CANVAS].astype(np.float32)
        dx = xx - CENTRE
        dy = yy - CENTRE
        _COORDS = (dx, dy, np.sqrt(dx * dx + dy * dy), np.arctan2(dy, dx))
    return _COORDS


def bilinear_premul(image, xs, ys):
    """Bilinear RGBA sample with premultiplied RGB to avoid transparent halos."""
    src = np.asarray(image, dtype=np.float32) / 255.0
    height, width = src.shape[:2]
    alpha = src[..., 3:4]
    rgb = src[..., :3] * alpha

    x0 = np.floor(xs).astype(np.int32)
    y0 = np.floor(ys).astype(np.int32)
    x1 = x0 + 1
    y1 = y0 + 1
    wx = (xs - x0)[..., None]
    wy = (ys - y0)[..., None]

    x0c = np.clip(x0, 0, width - 1)
    x1c = np.clip(x1, 0, width - 1)
    y0c = np.clip(y0, 0, height - 1)
    y1c = np.clip(y1, 0, height - 1)

    rgb_out = (
        rgb[y0c, x0c] * (1 - wx) * (1 - wy)
        + rgb[y0c, x1c] * wx * (1 - wy)
        + rgb[y1c, x0c] * (1 - wx) * wy
        + rgb[y1c, x1c] * wx * wy
    )
    alpha_out = (
        alpha[y0c, x0c] * (1 - wx) * (1 - wy)
        + alpha[y0c, x1c] * wx * (1 - wy)
        + alpha[y1c, x0c] * (1 - wx) * wy
        + alpha[y1c, x1c] * wx * wy
    )
    return np.concatenate([rgb_out / np.maximum(alpha_out, 1e-6), alpha_out], axis=2)


def remap_band(image, shape, dest_in, dest_out, src_in, src_out, feather=1.0):
    """Wrap a circular annulus around a circle or pointy-top hexagon annulus.

    dest_in/dest_out and src_in/src_out are circumradii in canvas pixels.
    The destination boundary at angle theta is R*cos(pi/6)/cos(d) for a
    hexagon and a constant R for a circle.
    """
    require_numpy()
    _, _, r, theta = get_coords()
    if shape == "hexagon":
        d = ((theta + PI / 6) % (PI / 3)) - PI / 6
        factor = np.cos(PI / 6) / np.cos(d)
        ri = dest_in * factor
        ro = dest_out * factor
    elif shape == "circle":
        ri = float(dest_in)
        ro = float(dest_out)
    else:
        raise ValueError(f"unknown shape {shape!r}")

    t = (r - ri) / (ro - ri)
    src_r = src_in + t * (src_out - src_in)
    xs = CENTRE + src_r * np.cos(theta)
    ys = CENTRE + src_r * np.sin(theta)
    out = bilinear_premul(image, xs, ys)

    edge = np.minimum(r - ri, ro - r)
    coverage = np.clip(edge / max(feather, 1e-6) + 0.5, 0.0, 1.0)[..., None]
    out = out * coverage
    return Image.fromarray(np.clip(out * 255.0 + 0.5, 0, 255).astype(np.uint8), "RGBA")


def cached_remap(path, shape, dest_in, dest_out, src_in, src_out):
    key = (str(path), shape, dest_in, dest_out, src_in, src_out)
    if key not in _REMAP_CACHE:
        _REMAP_CACHE[key] = remap_band(
            load_layer(path), shape, dest_in, dest_out, src_in, src_out
        )
    return _REMAP_CACHE[key]


def cached_hex_emblem(path):
    key = ("hex-emblem", str(path))
    if key not in _REMAP_CACHE:
        _REMAP_CACHE[key] = mask_hexagon(load_layer(path), HEXAGON["emblem"][1])
    return _REMAP_CACHE[key]


def scale_about_centre(image, scale):
    """Scale an RGBA layer about the canvas centre, cropped to the canvas.

    Resampling runs in premultiplied alpha so transparent pixels cannot bleed
    a halo into the scaled edge.
    """
    size = max(1, round(CANVAS * scale))
    resized = image.convert("RGBa").resize((size, size), Image.LANCZOS).convert("RGBA")
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    offset = (CANVAS - size) // 2
    if offset >= 0:
        canvas.alpha_composite(resized, (offset, offset))
    else:
        crop = -offset
        canvas.alpha_composite(resized.crop((crop, crop, crop + CANVAS, crop + CANVAS)), (0, 0))
    return canvas


def hex_rgb(value):
    value = value.lstrip("#")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4))


def mix_rgb(first, second, amount):
    return tuple(
        int(round(first[index] + (second[index] - first[index]) * amount))
        for index in range(3)
    )


def build_rank_boss(rank):
    """Procedural rank boss: dark bezel, rank-metal disc, cabochon at 6 o'clock.

    Supersampled 8x and downsized so the 96 px preview keeps a clean coloured
    dot instead of a jagged blob.
    """
    require_numpy()
    if rank in _BOSS_CACHE:
        return _BOSS_CACHE[rank]
    palette = RANK_BOSS[rank]
    bezel_rgb = hex_rgb(palette["bezel"])
    metal_rgb = hex_rgb(palette["metal"])
    highlight_rgb = hex_rgb(palette["highlight"])
    gem_rgb = hex_rgb(palette["gem"])

    bezel_r = BOSS["bezel"]
    disc_r = BOSS["disc"]
    gem_r = BOSS["gem"]
    pad = 10.0
    size = int(math.ceil((bezel_r + pad) * 2))
    big = size * BOSS_SS
    centre = big / 2.0

    # Contact shadow so the boss sits proud of the frame band.
    shadow = Image.new("L", (big, big), 0)
    ImageDraw.Draw(shadow).ellipse(
        [
            centre - (bezel_r + 1) * BOSS_SS,
            centre - (bezel_r - 1) * BOSS_SS + 2.5 * BOSS_SS,
            centre + (bezel_r + 1) * BOSS_SS,
            centre + (bezel_r + 1) * BOSS_SS + 2.5 * BOSS_SS,
        ],
        fill=150,
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(2.2 * BOSS_SS))
    boss = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    boss.putalpha(shadow.point(lambda value: int(value * 0.55)))
    draw = ImageDraw.Draw(boss)

    # Dark bezel: near-black outer lip, bezel body, inner shadow well.
    draw.ellipse(
        [centre - bezel_r * BOSS_SS, centre - bezel_r * BOSS_SS,
         centre + bezel_r * BOSS_SS, centre + bezel_r * BOSS_SS],
        fill=mix_rgb(bezel_rgb, (0, 0, 0), 0.5),
    )
    body_r = bezel_r - 1.2
    draw.ellipse(
        [centre - body_r * BOSS_SS, centre - body_r * BOSS_SS,
         centre + body_r * BOSS_SS, centre + body_r * BOSS_SS],
        fill=bezel_rgb,
    )
    well_r = disc_r + 2.2
    draw.ellipse(
        [centre - well_r * BOSS_SS, centre - well_r * BOSS_SS,
         centre + well_r * BOSS_SS, centre + well_r * BOSS_SS],
        fill=mix_rgb(bezel_rgb, (0, 0, 0), 0.65),
    )

    # Rank-metal disc with a top-left key light, matching the badge lighting.
    disc_mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(disc_mask).ellipse(
        [centre - disc_r * BOSS_SS, centre - disc_r * BOSS_SS,
         centre + disc_r * BOSS_SS, centre + disc_r * BOSS_SS],
        fill=255,
    )
    yy, xx = np.mgrid[0:big, 0:big].astype(np.float32)
    nx = (xx - centre) / (disc_r * BOSS_SS)
    ny = (yy - centre) / (disc_r * BOSS_SS)
    lit = np.clip(0.5 - 0.42 * nx - 0.55 * ny, 0, 1)[..., None]
    disc = np.zeros((big, big, 3), np.float32)
    for channel in range(3):
        disc[..., channel] = (
            metal_rgb[channel] * (0.55 + 0.55 * lit[..., 0])
            + highlight_rgb[channel] * 0.42 * lit[..., 0] ** 1.4
        )
    disc_image = Image.fromarray(
        np.clip(disc, 0, 255).astype(np.uint8), "RGB"
    ).convert("RGBA")
    disc_image.putalpha(disc_mask)
    boss.alpha_composite(disc_image)

    draw = ImageDraw.Draw(boss)
    engraved_r = disc_r - 4.2
    draw.ellipse(
        [centre - engraved_r * BOSS_SS, centre - engraved_r * BOSS_SS,
         centre + engraved_r * BOSS_SS, centre + engraved_r * BOSS_SS],
        outline=mix_rgb(metal_rgb, (0, 0, 0), 0.55) + (255,),
        width=int(0.75 * BOSS_SS),
    )
    edge_r = disc_r - 1.0
    draw.arc(
        [centre - edge_r * BOSS_SS, centre - edge_r * BOSS_SS,
         centre + edge_r * BOSS_SS, centre + edge_r * BOSS_SS],
        start=185, end=350,
        fill=mix_rgb(metal_rgb, highlight_rgb, 0.55) + (255,),
        width=int(0.8 * BOSS_SS),
    )

    # Gem well and cabochon.
    gem_well_r = gem_r + 1.6
    draw.ellipse(
        [centre - gem_well_r * BOSS_SS, centre - gem_well_r * BOSS_SS,
         centre + gem_well_r * BOSS_SS, centre + gem_well_r * BOSS_SS],
        fill=mix_rgb(bezel_rgb, (0, 0, 0), 0.45),
    )
    gem_size = int(math.ceil(gem_well_r * 2 * BOSS_SS))
    gy, gx = np.mgrid[0:gem_size, 0:gem_size].astype(np.float32)
    gem_centre = gem_size / 2.0
    radius = np.sqrt((gx - gem_centre) ** 2 + (gy - gem_centre) ** 2)
    edge = np.clip(radius / (gem_r * BOSS_SS), 0, 1)
    cabochon = np.zeros((gem_size, gem_size, 3), np.float32)
    for channel in range(3):
        cabochon[..., channel] = gem_rgb[channel]
    rim = np.clip((edge - 0.55) / 0.45, 0, 1)[..., None]
    cabochon *= 1 - 0.42 * rim
    spot_x = gem_centre - 0.30 * gem_r * BOSS_SS
    spot_y = gem_centre - 0.34 * gem_r * BOSS_SS
    spot_d = np.sqrt((gx - spot_x) ** 2 + (gy - spot_y) ** 2) / (gem_r * 1.05 * BOSS_SS)
    glow = np.clip(1 - spot_d, 0, 1)[..., None] ** 1.35
    for channel in range(3):
        cabochon[..., channel] = (
            cabochon[..., channel] * (1 - 0.78 * glow[..., 0])
            + highlight_rgb[channel] * 0.78 * glow[..., 0]
        )
    cabochon *= 1 - 0.55 * np.clip((edge - 0.86) / 0.14, 0, 1)[..., None]
    gem_image = Image.fromarray(
        np.clip(cabochon, 0, 255).astype(np.uint8), "RGB"
    ).convert("RGBA")
    gem_mask = Image.new("L", (gem_size, gem_size), 0)
    ImageDraw.Draw(gem_mask).ellipse([0, 0, gem_size - 1, gem_size - 1], fill=255)
    gem_image.putalpha(gem_mask)
    boss.alpha_composite(
        gem_image,
        (int(centre - gem_size / 2), int(centre - gem_size / 2)),
    )
    draw = ImageDraw.Draw(boss)
    spec_r = 0.20 * gem_r * BOSS_SS
    draw.ellipse(
        [spot_x - spec_r, spot_y - spec_r * 0.85,
         spot_x + spec_r, spot_y + spec_r * 0.85],
        fill=mix_rgb(highlight_rgb, (255, 255, 255), 0.65) + (235,),
    )

    small = boss.resize((size, size), Image.LANCZOS)
    out = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    cx, cy = BOSS["centre"]
    out.alpha_composite(small, (int(round(cx - size / 2)), int(round(cy - size / 2))))
    _BOSS_CACHE[rank] = out
    return out


def plate_frame(frame, rank):
    """Duotone gradient-map the frame's metal to the rank alloy.

    Luminance is stretched over the frame's own opaque range so the engraving
    keeps its contrast, then mapped through shadows/mids/highlights. Alpha is
    passed through untouched, so the frame silhouette and its soft edge survive.
    """
    require_numpy()
    palette = RANK_PLATING[rank]
    shadows = hex_rgb(palette["shadows"])
    mids = hex_rgb(palette["mids"])
    highlights = hex_rgb(palette["highlights"])

    source = np.asarray(frame.convert("RGBA"), dtype=np.float32) / 255.0
    rgb = source[..., :3]
    alpha = source[..., 3:4]
    luminance = (
        rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722
    )
    opaque = alpha[..., 0] > 0.6
    low, high = np.percentile(luminance[opaque], (2, 98))
    level = np.clip((luminance - low) / max(high - low, 1e-3), 0, 1)
    level = np.clip((level - 0.5) * 1.12 + 0.5, 0, 1)

    plated = np.zeros_like(rgb)
    shadow_side = level < 0.5
    amount = np.where(shadow_side, level * 2, (level - 0.5) * 2)[..., None]
    for channel in range(3):
        plated[..., channel] = np.where(
            shadow_side,
            shadows[channel] + (mids[channel] - shadows[channel]) * amount[..., 0],
            mids[channel] + (highlights[channel] - mids[channel]) * amount[..., 0],
        )
    # Fully transparent pixels must not carry a coloured fringe into resizes.
    plated = np.where(alpha < 1e-4, 0.0, plated)
    combined = np.concatenate([plated / 255.0, alpha], axis=2)
    return Image.fromarray(
        np.clip(combined * 255.0 + 0.5, 0, 255).astype(np.uint8), "RGBA"
    )


def get_shape_layers(asset, shape):
    if shape == "circle":
        return {kind: load_layer(asset["layers"][kind]) for kind in ("emblem", "rank", "frame")}
    if shape == "hexagon":
        rank_in, rank_out = HEXAGON["rank"]
        frame_in, frame_out = HEXAGON["frame"]
        return {
            "emblem": cached_hex_emblem(asset["layers"]["emblem"]),
            "rank": cached_remap(
                asset["layers"]["rank"], "hexagon", rank_in, rank_out, *RANK_SRC
            ),
            "frame": cached_remap(
                asset["layers"]["frame"], "hexagon", frame_in, frame_out, *FRAME_SRC
            ),
        }
    raise ValueError(f"unknown shape {shape!r}")


def flatten(layers):
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    for layer in layers:
        canvas.alpha_composite(layer)
    return canvas


def compose_badge(asset, shape, variant):
    key = (
        str(asset["layers"]["emblem"]),
        str(asset["layers"]["rank"]),
        str(asset["layers"]["frame"]),
        shape,
        variant,
    )
    if key in _BADGE_CACHE:
        return _BADGE_CACHE[key]
    layers = get_shape_layers(asset, shape)
    if variant == "A":
        badge = flatten([layers["emblem"], layers["rank"], layers["frame"]])
    elif variant == "D":
        badge = flatten([layers["emblem"], layers["frame"]])
    elif variant == "C":
        dest_in, dest_out = VARIANT_C[shape]
        rank_inlay = cached_remap(
            asset["layers"]["rank"], shape, dest_in, dest_out, *RANK_SRC
        )
        badge = flatten([layers["emblem"], layers["frame"], rank_inlay])
    elif variant == "E":
        emblem = scale_about_centre(layers["emblem"], E_EMBLEM_SCALE)
        if shape == "circle":
            rank_border = scale_about_centre(
                load_layer(asset["layers"]["rank"]), VARIANT_E["circle"]["scale"]
            )
        else:
            rank_border = cached_remap(
                asset["layers"]["rank"], shape, *VARIANT_E["hexagon"]["dest"], *RANK_SRC
            )
        badge = flatten([emblem, layers["frame"], rank_border])
    elif variant in ("F1", "F2"):
        if shape != "circle":
            raise ValueError("variant F is circle-only (frame-mounted boss)")
        frame = layers["frame"]
        if variant == "F2":
            frame = plate_frame(frame, asset["rank"])
        badge = flatten([layers["emblem"], frame, build_rank_boss(asset["rank"])])
    else:
        raise ValueError(f"unknown variant {variant!r}")
    _BADGE_CACHE[key] = badge
    return badge


def stack_panels(asset, shape):
    layers = get_shape_layers(asset, shape)
    emblem = layers["emblem"]
    emblem_rank = flatten([emblem, layers["rank"]])
    final = compose_badge(asset, shape, "A")
    return [emblem, emblem_rank, final, final], layers


# --------------------------------------------------------------------------- #
# Presentation
# --------------------------------------------------------------------------- #

def place_badge(canvas, badge, box, padding=16, shadow=True, scale=None):
    """Crop a badge to its alpha bbox, scale it into box, add the soft shadow."""
    x, y, width, height = box
    bbox = badge.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("badge is fully transparent")
    art = badge.crop(bbox)
    if scale is None:
        scale = min(
            (width - 2 * padding) / art.width,
            (height - 2 * padding) / art.height,
        )
    size = (max(1, round(art.width * scale)), max(1, round(art.height * scale)))
    art = art.resize(size, Image.LANCZOS)
    px = x + (width - size[0]) // 2
    py = y + (height - size[1]) // 2

    if shadow:
        alpha = Image.new("L", canvas.size, 0)
        alpha.paste(art.getchannel("A"), (px, py))
        alpha = alpha.filter(ImageFilter.GaussianBlur(max(1.0, 12.0 * scale)))
        alpha = ImageChops.offset(alpha, 0, max(1, round(8.0 * scale)))
        alpha = alpha.point(lambda value: int(value * 0.35))
        shadow_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 255))
        shadow_layer.putalpha(alpha)
        canvas.alpha_composite(shadow_layer)

    canvas.alpha_composite(art, (px, py))
    return px, py, size[0], size[1]


def draw_panel(draw, box, fill=PANEL_BG, border=BORDER, radius=10):
    x, y, width, height = box
    draw.rounded_rectangle(
        [x, y, x + width - 1, y + height - 1],
        radius=radius,
        fill=fill,
        outline=border,
        width=1,
    )


def draw_label(draw, centre_x, centre_y, parts, bold_font, regular_font):
    """Draw a horizontally centred label from (text, bold, fill) parts."""
    fonts = [bold_font if bold else regular_font for _, bold, _ in parts]
    widths = [draw.textlength(text, font=font) for (text, _, _), font in zip(parts, fonts)]
    cursor = centre_x - sum(widths) / 2
    for (text, _, fill), font, width in zip(parts, fonts, widths):
        draw.text((cursor, centre_y), text, font=font, fill=fill, anchor="lm")
        cursor += width


def save_image(image, path, fmt, **kwargs):
    path.parent.mkdir(parents=True, exist_ok=True)
    if fmt == "PNG":
        image.save(path, "PNG", optimize=True)
    else:
        image.convert("RGB").save(path, fmt, **kwargs)
    return path.stat().st_size


def dimensions(path):
    with Image.open(path) as opened:
        return list(opened.size)


def variant_note(shape, variant):
    if variant == "C":
        dest = VARIANT_C[shape]
        if shape == "circle":
            return f"rank remapped to {dest[0] * 2}/{dest[1] * 2} diameter band"
        return f"rank remapped to R{dest[0]}/R{dest[1]} circumradius band"
    if variant == "E":
        if shape == "circle":
            return ("rank scaled 1016/880 about centre (outer diameter 1016); "
                    "emblem 880/800 fills the frame opening")
        dest = VARIANT_E["hexagon"]["dest"]
        return (f"rank remapped to R{dest[0]}/R{dest[1]} circumradius outer border; "
                "emblem R440 fills the frame opening")
    if variant == "F1":
        return ("frame only + 6 o'clock rank boss "
                f"({int(BOSS['bezel'] * 2)} px bezel, {int(BOSS['disc'] * 2)} px "
                "rank-metal disc); no rank ring")
    if variant == "F2":
        return ("frame gradient-mapped to the rank alloy + 6 o'clock rank boss; "
                "alpha and engraving preserved; no rank ring")
    return None


def badge_entry(asset, shape, variant, path, size, nbytes):
    note = variant_note(shape, variant)
    return {
        "output": repo_relative(path),
        "kind": "badge",
        "asset": asset["id"],
        "display_name": asset["name"],
        "family": asset["family"],
        "shape": shape,
        "variant": variant,
        "rank": asset["rank"],
        "frame": asset["frame"],
        "candidates": dict(asset["candidates"]),
        "layers": {kind: repo_relative(path) for kind, path in asset["layers"].items()},
        "dimensions": size,
        "bytes": nbytes,
        "format": path.suffix.lstrip(".").lower(),
        "note": note,
    }


def component_entry(asset, shape, variant):
    note = variant_note(shape, variant)
    return {
        "asset": asset["id"],
        "display_name": asset["name"],
        "shape": shape,
        "variant": variant,
        "rank": asset["rank"],
        "frame": asset["frame"],
        "candidates": dict(asset["candidates"]),
        "layers": {kind: repo_relative(path) for kind, path in asset["layers"].items()},
        "note": note,
    }


# --------------------------------------------------------------------------- #
# Sheets
# --------------------------------------------------------------------------- #

def build_coherence_grid(assets, shape, variant, out_path):
    cols, rows = 3, max(1, math.ceil(len(assets) / 3))
    tile, label_h, gap, margin, title_h = 512, 56, 20, 32, 78
    width = margin * 2 + cols * tile + (cols - 1) * gap
    grid_top = margin + title_h
    height = grid_top + rows * (tile + label_h) + (rows - 1) * gap + margin

    canvas = Image.new("RGBA", (width, height), SHEET_BG)
    draw = ImageDraw.Draw(canvas)
    title_font = load_font(30, bold=True)
    subtitle_font = load_font(16)
    name_font = load_font(18, bold=True)
    sep_font = load_font(18)
    rank_font = load_font(18, bold=True)

    draw.text(
        (margin, margin),
        f"Badge set coherence \u2014 {SHAPE_LABELS[shape].lower()}",
        font=title_font,
        fill=TEXT,
    )
    draw.text(
        (margin, margin + 40),
        f"{len(assets)} recommended badges \u00b7 "
        + (f"{variant} \u00b7 {VARIANT_LABELS[variant]}" if variant in ("F1", "F2")
           else f"variant {variant}")
        + f" \u00b7 {SHAPE_LABELS[shape]} \u00b7 3\u00d73 review grid",
        font=subtitle_font,
        fill=MUTED,
    )

    for index, asset in enumerate(assets):
        row, col = divmod(index, cols)
        x = margin + col * (tile + gap)
        y = grid_top + row * (tile + label_h + gap)
        draw_panel(draw, (x, y, tile, tile))
        place_badge(canvas, compose_badge(asset, shape, variant), (x, y, tile, tile), padding=20)

        draw.rectangle([x, y + tile, x + tile - 1, y + tile + label_h - 1], fill=LABEL_BG)
        draw.line([x, y + tile, x + tile - 1, y + tile], fill=BORDER, width=1)
        draw_label(
            draw,
            x + tile / 2,
            y + tile + label_h / 2,
            [
                (asset["name"], True, TEXT),
                (" \u00b7 ", False, MUTED),
                (RANK_LABELS[asset["rank"]], True, RANK_COLORS[asset["rank"]]),
            ],
            name_font,
            sep_font,
        )
        draw.rectangle([x, y, x + tile - 1, y + tile + label_h - 1], outline=BORDER, width=1)

    nbytes = save_image(canvas, out_path, "JPEG", quality=92, subsampling=0, optimize=True)
    return {
        "output": repo_relative(out_path),
        "kind": "coherence-grid",
        "asset": "multiple",
        "shape": shape,
        "variant": variant,
        "components": [component_entry(asset, shape, variant) for asset in assets],
        "dimensions": dimensions(out_path),
        "bytes": nbytes,
        "format": "jpeg",
        "layout": {"cols": cols, "rows": rows, "tile_px": tile, "label_px": label_h},
    }


def build_stack_sheet(asset, shape, out_path):
    panels, _ = stack_panels(asset, shape)
    panel, label_h, gap, margin, title_h = 320, 52, 20, 32, 78
    width = margin * 2 + 4 * panel + 3 * gap
    height = margin + title_h + panel + label_h + margin

    canvas = Image.new("RGBA", (width, height), SHEET_BG)
    draw = ImageDraw.Draw(canvas)
    title_font = load_font(28, bold=True)
    subtitle_font = load_font(15)
    label_font = load_font(17, bold=True)
    small_font = load_font(12)

    draw.text((margin, margin), f"Exploded stack \u2014 {asset['name']}", font=title_font, fill=TEXT)
    draw.text(
        (margin, margin + 38),
        f"Variant A \u00b7 {SHAPE_LABELS[shape]} \u00b7 {RANK_LABELS[asset['rank']]} rank \u00b7 "
        f"{asset['frame']}",
        font=subtitle_font,
        fill=MUTED,
    )

    final_bbox = panels[-1].getchannel("A").getbbox()
    shared_scale = min(
        (panel - 32) / (final_bbox[2] - final_bbox[0]),
        (panel - 32) / (final_bbox[3] - final_bbox[1]),
    )
    labels = [
        ("1 \u00b7 Emblem", "emblem layer \u00b7 800 px" if shape == "circle" else "emblem layer \u00b7 R400 hex mask"),
        ("2 \u00b7 + Rank ring", "rank band \u00b7 800\u2013880 px" if shape == "circle" else "rank band \u00b7 R400\u2013440"),
        ("3 \u00b7 + Family frame", "frame band \u00b7 880\u20131016 px" if shape == "circle" else "frame band \u00b7 R440\u2013508"),
        ("4 \u00b7 Final badge", "variant A \u00b7 full stack"),
    ]

    for index, (panel_image, (label, sublabel)) in enumerate(zip(panels, labels)):
        x = margin + index * (panel + gap)
        y = margin + title_h
        final = index == 3
        draw_panel(
            draw,
            (x, y, panel, panel),
            fill=PANEL_BG_FINAL if final else PANEL_BG,
            border=GOLD if final else BORDER,
        )
        place_badge(canvas, panel_image, (x, y, panel, panel), padding=16, scale=shared_scale)
        draw.rectangle([x, y + panel, x + panel - 1, y + panel + label_h - 1], fill=LABEL_BG)
        draw.line([x, y + panel, x + panel - 1, y + panel], fill=BORDER, width=1)
        draw.text((x + panel / 2, y + panel + 17), label, font=label_font, fill=TEXT, anchor="mm")
        draw.text((x + panel / 2, y + panel + 35), sublabel, font=small_font, fill=MUTED, anchor="mm")
        draw.rectangle(
            [x, y, x + panel - 1, y + panel + label_h - 1],
            outline=GOLD if final else BORDER,
            width=1,
        )

    nbytes = save_image(canvas, out_path, "PNG")
    return {
        "output": repo_relative(out_path),
        "kind": "stack-sheet",
        "asset": asset["id"],
        "display_name": asset["name"],
        "shape": shape,
        "variant": "A",
        "rank": asset["rank"],
        "frame": asset["frame"],
        "layers": {kind: repo_relative(path) for kind, path in asset["layers"].items()},
        "panels": [
            {"label": labels[0][0], "layers": ["emblem"]},
            {"label": labels[1][0], "layers": ["emblem", "rank"]},
            {"label": labels[2][0], "layers": ["emblem", "rank", "frame"]},
            {"label": labels[3][0], "layers": ["emblem", "rank", "frame"]},
        ],
        "dimensions": dimensions(out_path),
        "bytes": nbytes,
        "format": "png",
        "note": "fixed sheet uses the hero badge with a representative gold rank "
                "(asset journey rank: bronze)",
    }


def build_variants_sheet(asset, shapes, out_path):
    variants = ("A", "C", "D", "E")
    cols, rows = len(variants), len(shapes)
    tile, label_h, gap, margin, title_h = 360, 52, 20, 32, 78
    width = margin * 2 + cols * tile + (cols - 1) * gap
    height = margin + title_h + rows * (tile + label_h) + (rows - 1) * gap + margin

    canvas = Image.new("RGBA", (width, height), SHEET_BG)
    draw = ImageDraw.Draw(canvas)
    title_font = load_font(28, bold=True)
    subtitle_font = load_font(15)
    label_font = load_font(17, bold=True)

    draw.text((margin, margin), f"Stack variants \u2014 {asset['name']}", font=title_font, fill=TEXT)
    draw.text(
        (margin, margin + 38),
        f"{asset['frame']} \u00b7 {RANK_LABELS[asset['rank']]} rank \u00b7 "
        "A = rank inside frame \u00b7 C = rank inlay \u00b7 D = frame only \u00b7 "
        "E = rank as outer border",
        font=subtitle_font,
        fill=MUTED,
    )

    for row, shape in enumerate(shapes):
        for col, variant in enumerate(variants):
            x = margin + col * (tile + gap)
            y = margin + title_h + row * (tile + label_h + gap)
            draw_panel(draw, (x, y, tile, tile))
            place_badge(canvas, compose_badge(asset, shape, variant), (x, y, tile, tile), padding=18)
            draw.rectangle([x, y + tile, x + tile - 1, y + tile + label_h - 1], fill=LABEL_BG)
            draw.line([x, y + tile, x + tile - 1, y + tile], fill=BORDER, width=1)
            draw_label(
                draw,
                x + tile / 2,
                y + tile + label_h / 2,
                [
                    (SHAPE_LABELS[shape], True, TEXT),
                    (" \u00b7 ", False, MUTED),
                    (f"{variant} \u2014 {VARIANT_LABELS[variant]}", True, TEXT),
                ],
                label_font,
                label_font,
            )
            draw.rectangle([x, y, x + tile - 1, y + tile + label_h - 1], outline=BORDER, width=1)

    nbytes = save_image(canvas, out_path, "JPEG", quality=92, subsampling=0, optimize=True)
    components = [
        component_entry(asset, shape, variant)
        for shape in shapes
        for variant in variants
    ]
    return {
        "output": repo_relative(out_path),
        "kind": "variants-sheet",
        "asset": asset["id"],
        "display_name": asset["name"],
        "shape": "both" if len(shapes) == 2 else shapes[0],
        "variant": "A/C/D/E",
        "rank": asset["rank"],
        "frame": asset["frame"],
        "components": components,
        "dimensions": dimensions(out_path),
        "bytes": nbytes,
        "format": "jpeg",
        "layout": {"cols": cols, "rows": rows, "tile_px": tile, "label_px": label_h},
        "note": "fixed sheet uses the hero badge with a representative gold rank "
                "(asset journey rank: bronze)",
    }


def build_rank_matrix(asset, shape, shortlist, out_path):
    cols, rows = 4, 1
    tile, label_h, gap, margin, title_h = 300, 48, 18, 32, 78
    width = margin * 2 + cols * tile + (cols - 1) * gap
    height = margin + title_h + tile + label_h + margin

    canvas = Image.new("RGBA", (width, height), SHEET_BG)
    draw = ImageDraw.Draw(canvas)
    title_font = load_font(28, bold=True)
    subtitle_font = load_font(15)
    rank_font = load_font(20, bold=True)

    draw.text((margin, margin), f"Rank matrix \u2014 {SHAPE_LABELS[shape]}", font=title_font, fill=TEXT)
    draw.text(
        (margin, margin + 38),
        f"{asset['name']} \u00b7 {asset['frame']} \u00b7 variant A \u00b7 four rank rings",
        font=subtitle_font,
        fill=MUTED,
    )

    components = []
    for index, rank in enumerate(RANK_ORDER):
        ranked = with_rank(asset, rank, shortlist)
        x = margin + index * (tile + gap)
        y = margin + title_h
        draw_panel(draw, (x, y, tile, tile))
        place_badge(canvas, compose_badge(ranked, shape, "A"), (x, y, tile, tile), padding=16)
        draw.rectangle([x, y + tile, x + tile - 1, y + tile + label_h - 1], fill=LABEL_BG)
        draw.line([x, y + tile, x + tile - 1, y + tile], fill=BORDER, width=1)
        draw_label(
            draw,
            x + tile / 2,
            y + tile + label_h / 2,
            [(RANK_LABELS[rank], True, RANK_COLORS[rank])],
            rank_font,
            rank_font,
        )
        draw.rectangle([x, y, x + tile - 1, y + tile + label_h - 1], outline=BORDER, width=1)
        components.append(component_entry(ranked, shape, "A"))

    nbytes = save_image(canvas, out_path, "JPEG", quality=92, subsampling=0, optimize=True)
    return {
        "output": repo_relative(out_path),
        "kind": "rank-matrix",
        "asset": asset["id"],
        "display_name": asset["name"],
        "shape": shape,
        "variant": "A",
        "rank": "all four",
        "frame": asset["frame"],
        "components": components,
        "dimensions": dimensions(out_path),
        "bytes": nbytes,
        "format": "jpeg",
        "layout": {"cols": cols, "rows": rows, "tile_px": tile, "label_px": label_h},
        "note": "four rank rings over the hero badge; the gold base is a representative rank",
    }


def wrap_text(draw, text, font, max_width):
    """Balanced 2-line wrap so 96 px tile labels keep every word in the tile."""
    if draw.textlength(text, font=font) <= max_width:
        return [text]
    words = text.split()
    best = None
    for split in range(1, len(words)):
        first = " ".join(words[:split])
        second = " ".join(words[split:])
        width = max(draw.textlength(first, font=font), draw.textlength(second, font=font))
        if best is None or width < best[0]:
            best = (width, [first, second])
    if best is None:
        return [text]
    return best[1]


def build_legibility_sheet(assets, shape, variant, out_path):
    """3x3 sheet of badges at their actual 96 px card size, name + rank."""
    cols = 3
    rows = max(1, math.ceil(len(assets) / cols))
    tile, label_h, gap, margin, title_h = 96, 42, 8, 12, 54
    width = margin * 2 + cols * tile + (cols - 1) * 12
    height = margin + title_h + rows * (tile + label_h) + (rows - 1) * gap + margin

    canvas = Image.new("RGBA", (width, height), SHEET_BG)
    draw = ImageDraw.Draw(canvas)
    title_font = load_font(22, bold=True)
    subtitle_font = load_font(9)
    name_font = load_font(9, bold=True)
    rank_font = load_font(9, bold=True)

    draw.text(
        (margin, margin),
        f"{SHAPE_LABELS[shape]} set at 96 px",
        font=title_font,
        fill=TEXT,
    )
    draw.text(
        (margin, margin + 30),
        f"Recommended picks \u00b7 {variant} \u00b7 {VARIANT_LABELS[variant]}",
        font=subtitle_font,
        fill=MUTED,
    )

    for index, asset in enumerate(assets):
        row, col = divmod(index, cols)
        x = margin + col * (tile + 12)
        y = margin + title_h + row * (tile + label_h + gap)
        draw_panel(draw, (x, y, tile, tile), radius=6)
        badge = compose_badge(asset, shape, variant)
        bbox = badge.getchannel("A").getbbox()
        if bbox is None:
            raise ValueError("badge is fully transparent")
        scale = tile / max(bbox[2] - bbox[0], bbox[3] - bbox[1])
        place_badge(canvas, badge, (x, y, tile, tile), padding=0, scale=scale)
        lines = wrap_text(draw, asset["name"], name_font, tile)
        for line_index, line in enumerate(lines):
            draw.text(
                (x, y + tile + 6 + line_index * 11),
                line,
                font=name_font,
                fill=TEXT,
                anchor="la",
            )
        draw.text(
            (x, y + tile + 6 + len(lines) * 11),
            RANK_LABELS[asset["rank"]],
            font=rank_font,
            fill=RANK_COLORS[asset["rank"]],
            anchor="la",
        )

    nbytes = save_image(canvas, out_path, "JPEG", quality=94, subsampling=0, optimize=True)
    return {
        "output": repo_relative(out_path),
        "kind": "legibility-sheet",
        "asset": "multiple",
        "shape": shape,
        "variant": variant,
        "components": [component_entry(asset, shape, variant) for asset in assets],
        "dimensions": dimensions(out_path),
        "bytes": nbytes,
        "format": "jpeg",
        "layout": {"cols": cols, "rows": rows, "tile_px": tile, "label_px": label_h},
        "note": "badges rendered at their actual 96 px card size",
    }


def build_f_stack_sheet(asset, out_path):
    """D / F1 / F2 for one badge, three panels, shared scale."""
    variants = ("D", "F1", "F2")
    panel, label_h, gap, margin, title_h = 380, 54, 20, 32, 78
    width = margin * 2 + len(variants) * panel + (len(variants) - 1) * gap
    height = margin + title_h + panel + label_h + margin

    canvas = Image.new("RGBA", (width, height), SHEET_BG)
    draw = ImageDraw.Draw(canvas)
    title_font = load_font(28, bold=True)
    subtitle_font = load_font(15)
    label_font = load_font(17, bold=True)
    small_font = load_font(12)

    draw.text((margin, margin), f"Stack F \u2014 {asset['name']}", font=title_font, fill=TEXT)
    draw.text(
        (margin, margin + 38),
        f"{asset['frame']} \u00b7 {RANK_LABELS[asset['rank']]} rank \u00b7 "
        "D = frame only \u00b7 F1 = + 6 o'clock rank boss \u00b7 "
        "F2 = rank-plated frame + boss",
        font=subtitle_font,
        fill=MUTED,
    )

    labels = [
        ("D \u00b7 frame only", "emblem + family frame \u00b7 no rank"),
        ("F1 \u00b7 + 6 o'clock boss", "family frame \u00b7 rank boss"),
        ("F2 \u00b7 plated frame + boss", "frame re-metalled to rank alloy"),
    ]
    badges = [compose_badge(asset, "circle", variant) for variant in variants]
    final_bbox = badges[0].getchannel("A").getbbox()
    shared_scale = min(
        (panel - 32) / (final_bbox[2] - final_bbox[0]),
        (panel - 32) / (final_bbox[3] - final_bbox[1]),
    )

    for index, (badge, (label, sublabel)) in enumerate(zip(badges, labels)):
        x = margin + index * (panel + gap)
        y = margin + title_h
        draw_panel(draw, (x, y, panel, panel))
        place_badge(canvas, badge, (x, y, panel, panel), padding=16, scale=shared_scale)
        draw.rectangle([x, y + panel, x + panel - 1, y + panel + label_h - 1], fill=LABEL_BG)
        draw.line([x, y + panel, x + panel - 1, y + panel], fill=BORDER, width=1)
        draw.text((x + panel / 2, y + panel + 18), label, font=label_font, fill=TEXT, anchor="mm")
        draw.text((x + panel / 2, y + panel + 37), sublabel, font=small_font, fill=MUTED, anchor="mm")
        draw.rectangle(
            [x, y, x + panel - 1, y + panel + label_h - 1], outline=BORDER, width=1
        )

    nbytes = save_image(canvas, out_path, "JPEG", quality=92, subsampling=0, optimize=True)
    return {
        "output": repo_relative(out_path),
        "kind": "stack-sheet",
        "asset": asset["id"],
        "display_name": asset["name"],
        "shape": "circle",
        "variant": "D/F1/F2",
        "rank": asset["rank"],
        "frame": asset["frame"],
        "components": [component_entry(asset, "circle", variant) for variant in variants],
        "dimensions": dimensions(out_path),
        "bytes": nbytes,
        "format": "jpeg",
        "layout": {"cols": len(variants), "rows": 1, "tile_px": panel, "label_px": label_h},
        "note": "fixed sheet uses the hero badge with a representative gold rank "
                "(asset journey rank: bronze)",
    }


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #

def write_manifest(outputs, out_dir):
    path = out_dir / "manifest.json"
    previous = {}
    if path.is_file():
        try:
            previous = load_json(path)
        except (OSError, ValueError, json.JSONDecodeError):
            previous = {}
    merged = {
        entry["output"]: entry
        for entry in previous.get("outputs", [])
        if isinstance(entry, dict) and isinstance(entry.get("output"), str)
    }
    for entry in outputs:
        merged[entry["output"]] = entry

    manifest = dict(previous)
    manifest.update({
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "plan": repo_relative(REPO_ROOT / "reports" / "badge-art" / "composite-test-plan.md"),
        "shortlist": repo_relative(SHORTLIST_PATH),
        "backgrounds": {"preview": PREVIEW_BG, "sheet": SHEET_BG},
        "geometry": {
            "canvas": CANVAS,
            "centre": [int(CENTRE), int(CENTRE)],
            "circle": {"emblem": "800", "rank": "880/800", "frame": "1016/880"},
            "hexagon": {
                "emblem": "R400",
                "rank": "R440/400",
                "frame": "R508/440",
                "overall": "880 wide x 1016 tall",
                "vertices": "pi/6 + k*pi/3",
            },
            "variant_c": {
                "circle": "rank 840/920 diameter (420..460 radius)",
                "hexagon": "rank R410/450 circumradius",
            },
            "variant_e": {
                "circle": "rank scaled 1016/880 about centre (band 461.8..508 radius); "
                          "emblem 880/800 fills the frame opening",
                "hexagon": "rank R468/508 circumradius; emblem R440 fills the frame opening",
            },
            "variant_f": {
                "stack": "emblem 800 -> family frame 880..1016 -> 6 o'clock rank boss; "
                         "no rank ring",
                "boss": {"centre": [BOSS["centre"][0], BOSS["centre"][1]],
                         "bezel_diameter": int(BOSS["bezel"] * 2),
                         "disc_diameter": int(BOSS["disc"] * 2),
                         "gem_diameter": int(BOSS["gem"] * 2)},
                "f1": "family frame keeps its original metal",
                "f2": "frame band gradient-mapped to the rank alloy (duotone, "
                      "alpha and engraving preserved) before the boss",
            },
        },
        "outputs": list(merged.values()),
    })
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return path


def build_f_proofs(assets, hero_gold, out_dir):
    """Build the F1/F2 circle proofs: badges, grids, 96 px sheets, stack sheet."""
    outputs = []
    for variant in ("F1", "F2"):
        suffix = variant.lower()
        shape_dir = f"circle-{suffix}"
        print(f"variant {variant} badges: circle")
        for asset in assets:
            badge = compose_badge(asset, "circle", variant)
            preview = Image.new("RGBA", (512, 512), PREVIEW_BG)
            place_badge(preview, badge, (0, 0, 512, 512), padding=16)
            path = out_dir / shape_dir / f"{asset['slug']}.webp"
            nbytes = save_image(preview, path, "WEBP", quality=90, method=6)
            outputs.append(
                badge_entry(asset, "circle", variant, path, dimensions(path), nbytes)
            )
            print(f"  {repo_relative(path)}")

        grid_path = out_dir / f"coherence-circle-{suffix}.jpg"
        outputs.append(build_coherence_grid(assets, "circle", variant, grid_path))
        print(f"  {repo_relative(grid_path)}")

        legibility_path = out_dir / f"legibility-96-circle-{suffix}.jpg"
        outputs.append(build_legibility_sheet(assets, "circle", variant, legibility_path))
        print(f"  {repo_relative(legibility_path)}")

    stack_path = out_dir / "stack-f.jpg"
    outputs.append(build_f_stack_sheet(hero_gold, stack_path))
    print(f"  {repo_relative(stack_path)}")
    return outputs



def main(argv=None):
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--shape", choices=("circle", "hexagon", "both"), default="both",
        help="shape(s) to build (default: both)",
    )
    parser.add_argument(
        "--only", action="append", metavar="ASSET",
        help="asset id or slug fragment; repeatable",
    )
    parser.add_argument(
        "--variant", choices=("A", "C", "D", "E"), default="A",
        help="individual badge / coherence grid variant (default: A; "
             "A/C/D reuse the shape dirs, E writes <shape>-e)",
    )
    parser.add_argument(
        "--out-dir", default=str(DEFAULT_OUT),
        help=f"output directory (default: {repo_relative(DEFAULT_OUT)})",
    )
    parser.add_argument(
        "--skip-grids", action="store_true",
        help="only individual badges + manifest (quick smoke run)",
    )
    parser.add_argument(
        "--proof", choices=("f",),
        help="build the F rank-treatment proofs (F1/F2, circle only): "
             "badges, coherence grids, 96 px sheets, stack-f.jpg",
    )
    parser.add_argument(
        "--list", action="store_true",
        help="print the resolved asset/shape/rank/frame plan and exit",
    )
    args = parser.parse_args(argv)

    shapes = ["circle", "hexagon"] if args.shape == "both" else [args.shape]
    out_dir = Path(args.out_dir).expanduser()

    try:
        prompts = load_prompts()
        shortlist = load_shortlist()
        assets = resolve_assets(prompts, shortlist, args.only)
        all_assets = resolve_assets(prompts, shortlist, None)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    if not assets:
        print("ERROR: nothing selected", file=sys.stderr)
        return 1

    if args.list:
        print_plan(assets, shapes)
        return 0

    require_pillow()
    errors = validate_layers(assets)
    if errors:
        print("ERROR: layer validation failed:", file=sys.stderr)
        for error in errors:
            print(f"  {error}", file=sys.stderr)
        return 1

    hero = next((asset for asset in all_assets if asset["slug"] == HERO_SLUG), None)
    if hero is None:
        print(f"ERROR: hero asset {HERO_SLUG!r} not found", file=sys.stderr)
        return 1
    hero_gold = with_rank(hero, HERO_RANK, shortlist)
    rank_variants = [with_rank(hero, rank, shortlist) for rank in RANK_ORDER]
    hero_errors = validate_layers([hero_gold] + rank_variants)
    if hero_errors:
        print("ERROR: hero layer validation failed:", file=sys.stderr)
        for error in hero_errors:
            print(f"  {error}", file=sys.stderr)
        return 1

    if args.proof == "f":
        if args.shape == "hexagon":
            print("ERROR: --proof f is circle-only (the boss sits on a circular frame band)",
                  file=sys.stderr)
            return 1
        try:
            outputs = build_f_proofs(assets, hero_gold, out_dir)
        except (OSError, ValueError) as exc:
            print(f"ERROR: could not build F proofs: {exc}", file=sys.stderr)
            return 1
        manifest_path = write_manifest(outputs, out_dir)
        print(f"\nwrote {len(outputs)} F composite(s) + manifest")
        print(f"manifest: {repo_relative(manifest_path)}")
        return 0

    outputs = []
    try:
        for shape in shapes:
            print(f"individual badges: {shape} (variant {args.variant})")
            shape_dir = f"{shape}-e" if args.variant == "E" else shape
            for asset in assets:
                badge = compose_badge(asset, shape, args.variant)
                preview = Image.new("RGBA", (512, 512), PREVIEW_BG)
                place_badge(preview, badge, (0, 0, 512, 512), padding=16)
                path = out_dir / shape_dir / f"{asset['slug']}.webp"
                nbytes = save_image(preview, path, "WEBP", quality=90, method=6)
                outputs.append(
                    badge_entry(asset, shape, args.variant, path, dimensions(path), nbytes)
                )
                print(f"  {repo_relative(path)}")

        if not args.skip_grids:
            print("coherence grids")
            for shape in shapes:
                suffix = "-e" if args.variant == "E" else ""
                path = out_dir / f"coherence-{shape}{suffix}.jpg"
                outputs.append(build_coherence_grid(assets, shape, args.variant, path))
                print(f"  {repo_relative(path)}")

            if args.variant != "E":
                print("exploded stacks")
                for shape in shapes:
                    path = out_dir / f"stack-{shape}.png"
                    outputs.append(build_stack_sheet(hero_gold, shape, path))
                    print(f"  {repo_relative(path)}")

            print("variants sheet")
            path = out_dir / "stack-variants.jpg"
            outputs.append(build_variants_sheet(hero_gold, shapes, path))
            print(f"  {repo_relative(path)}")

            if args.variant != "E":
                print("rank matrices")
                for shape in shapes:
                    path = out_dir / f"rank-matrix-{shape}.jpg"
                    outputs.append(build_rank_matrix(hero_gold, shape, shortlist, path))
                    print(f"  {repo_relative(path)}")
    except (OSError, ValueError) as exc:
        print(f"ERROR: could not build outputs: {exc}", file=sys.stderr)
        return 1

    manifest_path = write_manifest(outputs, out_dir)

    print(f"\nwrote {len(outputs)} composite(s) + manifest")
    print(f"manifest: {repo_relative(manifest_path)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
