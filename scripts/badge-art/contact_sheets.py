#!/usr/bin/env python3
"""Build one contact sheet per badge asset.

Each sheet uses a 4-column grid: 3 rows for the 12 emblem candidates and 2 rows
for the 8 frame/ring candidates. Tiles are 320 px with a 28 px label strip and
16 px gutters on a #14181f background. Images come from
raw_assets/badges/processed/<asset>/ when present, otherwise from
raw_assets/badges/candidates/<asset>/; missing or broken tiles are labelled.

Sheets and the index are written under reports/badge-art/sheets/:
  sheets/<asset>.jpg
  sheets/index.json

Usage:
  python3 scripts/badge-art/contact_sheets.py --group emblem
  python3 scripts/badge-art/contact_sheets.py --only emblem/habit-first-steps
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
PROMPTS_PATH = HERE / "prompts.json"
RAW_ROOT = REPO_ROOT / "raw_assets" / "badges"
SHEETS_ROOT = REPO_ROOT / "reports" / "badge-art" / "sheets"

TILE = 320
LABEL_H = 28
GUTTER = 16
MARGIN = 16
COLS = 4
TITLE_H = 56
BG = "#14181f"
PANEL = "#1b212b"
LABEL_BG = "#252d3a"
BORDER = "#2f3949"
TEXT = "#e6e9ef"
MUTED = "#8b94a7"
MISSING = "#c25b5b"
BROKEN = "#d08a4a"

GROUPS = ("emblem", "frame", "rank")


def load_font(size, bold=False):
    names = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold
        else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for name in names:
        if Path(name).is_file():
            return ImageFont.truetype(name, size)
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def load_matrix(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    if not data.get("assets"):
        raise ValueError(f"{path}: no assets")
    for asset in data["assets"]:
        for key in ("id", "group", "family", "variants"):
            if key not in asset:
                raise ValueError(f"{path}: asset missing {key!r}")
        if asset["group"] not in GROUPS:
            raise ValueError(f"{asset['id']}: bad group {asset['group']!r}")
    seeds = data.get("seeds")
    if not isinstance(seeds, dict) or any(group not in seeds for group in GROUPS):
        raise ValueError(f"{path}: seeds must define {', '.join(GROUPS)}")
    return data


def select_assets(assets, only, group):
    selected = []
    for asset in assets:
        if group and asset["group"] != group:
            continue
        if only and not any(token == asset["slug"] or token in asset["id"] for token in only):
            continue
        selected.append(asset)
    return selected


def seeds_for(asset, matrix):
    return matrix["seeds"][asset["group"]]


def candidates_for(asset, matrix):
    candidates = []
    for variant in asset["variants"]:
        for seed in seeds_for(asset, matrix):
            candidates.append((variant["id"], int(seed)))
    return candidates


def repo_relative(path):
    try:
        return str(path.resolve().relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def resolve_candidate(asset_id, variant, seed):
    """Prefer the processed cutout; fall back to the raw candidate per file."""
    name = f"{variant}-{seed}.png"
    for kind in ("processed", "candidates"):
        path = RAW_ROOT / kind / asset_id / name
        if path.is_file() and path.stat().st_size > 0:
            return path, kind
    return None, None


def resolve_all(asset, matrix):
    resolved = []
    for variant, seed in candidates_for(asset, matrix):
        path, source = resolve_candidate(asset["id"], variant, seed)
        resolved.append({
            "variant": variant,
            "seed": seed,
            "source": source,
            "file": repo_relative(path) if path else None,
        })
    return resolved


def draw_tile(sheet, draw, x, y, path, label, variant_font, status_font):
    draw.rectangle([x, y, x + TILE - 1, y + TILE + LABEL_H - 1], fill=PANEL)
    draw.rectangle([x, y + TILE, x + TILE - 1, y + TILE + LABEL_H - 1], fill=LABEL_BG)

    if path is None:
        draw.rectangle([x + 4, y + 4, x + TILE - 5, y + TILE - 5], outline=MISSING, width=2)
        draw.text((x + TILE / 2, y + TILE / 2 - 8), "MISSING", font=status_font,
                  fill=MISSING, anchor="mm")
        draw.text((x + TILE / 2, y + TILE / 2 + 12), label, font=variant_font,
                  fill=MUTED, anchor="mm")
    else:
        try:
            with Image.open(path) as opened:
                image = opened.convert("RGBA")
            thumb = ImageOps.contain(image, (TILE - 24, TILE - 24), Image.LANCZOS)
            sheet.paste(
                thumb,
                (x + (TILE - thumb.width) // 2, y + (TILE - thumb.height) // 2),
                thumb,
            )
        except Exception:  # noqa: BLE001 - a corrupt candidate must not abort the sheet
            draw.rectangle([x + 4, y + 4, x + TILE - 5, y + TILE - 5], outline=BROKEN, width=2)
            draw.text((x + TILE / 2, y + TILE / 2 - 8), "BROKEN", font=status_font,
                      fill=BROKEN, anchor="mm")
            draw.text((x + TILE / 2, y + TILE / 2 + 12), label, font=variant_font,
                      fill=MUTED, anchor="mm")

    draw.rectangle([x, y, x + TILE - 1, y + TILE + LABEL_H - 1], outline=BORDER, width=1)
    draw.text((x + TILE / 2, y + TILE + LABEL_H / 2), label, font=variant_font,
              fill=TEXT, anchor="mm")


def build_sheet(asset, matrix):
    candidates = candidates_for(asset, matrix)
    rows = max(1, math.ceil(len(candidates) / COLS))
    width = MARGIN * 2 + COLS * TILE + (COLS - 1) * GUTTER
    grid_top = MARGIN + TITLE_H
    height = grid_top + rows * (TILE + LABEL_H) + (rows - 1) * GUTTER + MARGIN

    sheet = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(sheet)
    title_font = load_font(22, bold=True)
    subtitle_font = load_font(13)
    variant_font = load_font(14)
    status_font = load_font(17, bold=True)

    draw.text((MARGIN, MARGIN + 2), asset["id"], font=title_font, fill=TEXT)

    resolved = resolve_all(asset, matrix)

    sources = sorted({item["source"] for item in resolved if item["source"]})
    source_label = "+".join(sources) if sources else "none"
    rank = asset.get("rank")
    subtitle = (
        f"{asset['group']} · family {asset['family']} · rank {rank if rank is not None else '-'} · "
        f"{len(resolved)} candidates · source: {source_label}"
    )
    draw.text((MARGIN, MARGIN + 32), subtitle, font=subtitle_font, fill=MUTED)

    for index, item in enumerate(resolved):
        row, col = divmod(index, COLS)
        x = MARGIN + col * (TILE + GUTTER)
        y = grid_top + row * (TILE + LABEL_H + GUTTER)
        label = f"{item['variant']}-{item['seed']}"
        path = REPO_ROOT / item["file"] if item["file"] else None
        draw_tile(sheet, draw, x, y, path, label, variant_font, status_font)

    return sheet, resolved


def sheet_path(asset_id):
    return SHEETS_ROOT / f"{asset_id}.jpg"


def index_entry(asset, destination, resolved):
    return {
        "sheet": repo_relative(destination),
        "group": asset["group"],
        "family": asset["family"],
        "rank": asset.get("rank"),
        "layout": {
            "cols": COLS,
            "rows": max(1, math.ceil(len(resolved) / COLS)),
            "tile_px": TILE,
        },
        "candidates": resolved,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--only", action="append", metavar="ASSET",
                        help="asset id or slug fragment; repeatable")
    parser.add_argument("--group", choices=GROUPS, help="only this layer group")
    args = parser.parse_args(argv)

    try:
        matrix = load_matrix(PROMPTS_PATH)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    assets = select_assets(matrix["assets"], args.only, args.group)
    if not assets:
        print("nothing selected", file=sys.stderr)
        return 0

    index_path = SHEETS_ROOT / "index.json"
    if index_path.is_file():
        try:
            index = json.loads(index_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            index = {}
    else:
        index = {}
    if not isinstance(index, dict):
        index = {}
    if not isinstance(index.get("assets"), dict):
        index["assets"] = {}

    built = 0
    for asset in assets:
        destination = sheet_path(asset["id"])
        sheet, resolved = build_sheet(asset, matrix)
        destination.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(destination, "JPEG", quality=88, optimize=True)
        built += 1
        print(f"{asset['id']} -> {repo_relative(destination)} ({len(resolved)} candidates)")
        index["assets"][asset["id"]] = index_entry(asset, destination, resolved)

    SHEETS_ROOT.mkdir(parents=True, exist_ok=True)
    index_path.write_text(json.dumps(index, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"\nsummary: {built} built, index: {repo_relative(index_path)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
