#!/usr/bin/env python3
"""Cut out, normalise and tile the handcrafted rank boss medallions.

Run with the ComfyUI venv, which has rembg, onnxruntime and Pillow:

  /run/media/skittlz/LinuxStorageSSD/github/comfyui/venv/bin/python \
      scripts/badge-art/process_bosses.py

`--list` and `--help` work on the system interpreter without rembg.

Pipeline per candidate:
  rembg birefnet-general cutout -> trim alpha bbox
  -> review master: longest side 800 px, centred on a 1024 transparent canvas
  -> placement tile: longest side 70 px, centred on a 90x90 transparent canvas
  -> contact shadow tile: blurred dark silhouette from the tile alpha,
     offset (0, 2), 45% opacity, on a 90x90 transparent canvas.

Outputs:
  raw_assets/badges/bosses/processed/<rank>/<variant>-<seed>.png
  raw_assets/badges/bosses/tiles/<rank>/<variant>-<seed>.png
  raw_assets/badges/bosses/tiles/<rank>/<variant>-<seed>-shadow.png
  reports/badge-art/sheets/rank-bosses/<rank>.jpg
  reports/badge-art/bosses.jsonl

The ranking names in the output paths are the metal suffixes of the asset ids
(bronze, silver, gold, mithril). No shortlist is written.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
PROMPTS_PATH = HERE / "boss-prompts.json"
RAW_ROOT = REPO_ROOT / "raw_assets" / "badges"
CANDIDATES_ROOT = RAW_ROOT / "candidates"
BOSS_ROOT = RAW_ROOT / "bosses"
REVIEW_ROOT = BOSS_ROOT / "processed"
TILE_ROOT = BOSS_ROOT / "tiles"
SHEET_ROOT = REPO_ROOT / "reports" / "badge-art" / "sheets" / "rank-bosses"
LOG_PATH = REPO_ROOT / "reports" / "badge-art" / "bosses.jsonl"

CANVAS = 1024
REVIEW_PX = 800
TILE_CANVAS = 90
TILE_PX = 70
SHADOW_BLUR = 3
SHADOW_OFFSET = (0, 2)
SHADOW_OPACITY = 0.45

SHEET_COLS = 4
SHEET_TILE = 320
SHEET_LABEL_H = 28
SHEET_GUTTER = 16
SHEET_MARGIN = 16
SHEET_TITLE_H = 56
SHEET_BG = "#14181f"
SHEET_PANEL = "#1b212b"
SHEET_LABEL_BG = "#252d3a"
SHEET_BORDER = "#2f3949"
SHEET_TEXT = "#e6e9ef"
SHEET_MUTED = "#8b94a7"
SHEET_MISSING = "#c25b5b"
SHEET_BROKEN = "#d08a4a"

DEFAULT_SESSION = "birefnet-general"
FALLBACK_SESSION = "isnet-general-use"

try:
    from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps
except ImportError:  # --list and --help still work without Pillow
    Image = ImageDraw = ImageFilter = ImageFont = ImageOps = None


def load_matrix(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    assets = data.get("assets")
    if not assets:
        raise ValueError(f"{path}: no assets")
    seen = set()
    for asset in assets:
        asset_id = asset.get("id", "")
        if asset.get("group") != "rank":
            raise ValueError(f"{asset_id or '<no id>'}: only rank bosses belong in this matrix")
        if not asset.get("slug"):
            raise ValueError(f"{asset_id or '<no slug>'}: missing slug")
        if asset_id != f"rank/{asset['slug']}":
            raise ValueError(f"{asset_id}: id must equal rank/<slug>")
        if asset_id in seen:
            raise ValueError(f"{asset_id}: duplicate asset id")
        seen.add(asset_id)
        if not str(asset.get("name", "")).strip():
            raise ValueError(f"{asset_id}: missing display name")
        variants = asset.get("variants")
        if not isinstance(variants, list) or len(variants) != 2:
            raise ValueError(f"{asset_id}: exactly two variants are required")
        if {v.get("id") for v in variants} != {"a", "b"}:
            raise ValueError(f"{asset_id}: variant ids must be a and b")
    seeds = data.get("seeds", {}).get("rank")
    if not seeds or any(not isinstance(seed, int) for seed in seeds):
        raise ValueError(f"{path}: seeds.rank must be a non-empty list of integers")
    return data


def rank_key(asset):
    """bronze/silver/gold/mithril from rank/boss-bronze."""
    return asset["slug"].removeprefix("boss-")


def select_assets(assets, only):
    if not only:
        return list(assets)
    selected = []
    for asset in assets:
        if any(token == asset["slug"] or token in asset["id"] for token in only):
            selected.append(asset)
    return selected


def candidates_for(asset, matrix):
    for variant in asset["variants"]:
        for seed in matrix["seeds"]["rank"]:
            yield variant["id"], int(seed)


def candidate_name(variant, seed):
    return f"{variant}-{seed}"


def paths_for(asset, variant, seed):
    key = rank_key(asset)
    stem = candidate_name(variant, seed)
    return {
        "raw": CANDIDATES_ROOT / asset["id"] / f"{stem}.png",
        "review": REVIEW_ROOT / key / f"{stem}.png",
        "tile": TILE_ROOT / key / f"{stem}.png",
        "shadow": TILE_ROOT / key / f"{stem}-shadow.png",
        "sheet": SHEET_ROOT / f"{key}.jpg",
    }


def repo_relative(path):
    try:
        return str(path.resolve().relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def require_pillow():
    if Image is None:
        raise SystemExit(
            "ERROR: Pillow is required. Run this script with the ComfyUI venv:\n"
            "  /run/media/skittlz/LinuxStorageSSD/github/comfyui/venv/bin/python "
            "scripts/badge-art/process_bosses.py"
        )


def require_rembg():
    try:
        from rembg import new_session, remove
    except ImportError as exc:
        raise SystemExit(
            "ERROR: rembg is not installed for this interpreter. Use the ComfyUI venv:\n"
            "  /run/media/skittlz/LinuxStorageSSD/github/comfyui/venv/bin/python "
            "scripts/badge-art/process_bosses.py"
        ) from exc
    return new_session, remove


def fit_longest(image, target):
    scale = target / max(image.size)
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    return image.resize(size, Image.Resampling.LANCZOS)


def centre_on_canvas(image, side):
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(image, ((side - image.width) // 2, (side - image.height) // 2))
    return canvas


def trim_alpha(image):
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("cutout is fully transparent")
    return image.crop(bbox), bbox


def make_shadow(tile):
    """Dark silhouette from the placement tile alpha, blurred and offset down."""
    alpha = tile.getchannel("A").filter(ImageFilter.GaussianBlur(SHADOW_BLUR))
    dimmed = alpha.point(lambda value: round(value * SHADOW_OPACITY))
    shadow_alpha = Image.new("L", (TILE_CANVAS, TILE_CANVAS), 0)
    shadow_alpha.paste(dimmed, SHADOW_OFFSET)
    shadow = Image.new("RGBA", (TILE_CANVAS, TILE_CANVAS), (0, 0, 0, 0))
    shadow.putalpha(shadow_alpha)
    return shadow


def build_derivatives(cutout):
    trimmed, bbox = trim_alpha(cutout)
    review = centre_on_canvas(fit_longest(trimmed, REVIEW_PX), CANVAS)
    tile = centre_on_canvas(fit_longest(trimmed, TILE_PX), TILE_CANVAS)
    shadow = make_shadow(tile)
    return review, tile, shadow, bbox


def load_ok(path, size):
    if not path.is_file() or path.stat().st_size == 0:
        return False
    if Image is None:  # --list without Pillow can only check presence
        return True
    try:
        with Image.open(path) as image:
            image.load()
            return image.size == size
    except Exception:  # noqa: BLE001 - a truncated PNG must be rebuilt
        return False


def all_outputs_ready(paths):
    return (
        load_ok(paths["review"], (CANVAS, CANVAS))
        and load_ok(paths["tile"], (TILE_CANVAS, TILE_CANVAS))
        and load_ok(paths["shadow"], (TILE_CANVAS, TILE_CANVAS))
    )


def append_log(record):
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")


def list_assets(assets, matrix):
    print(f"session: {DEFAULT_SESSION}")
    total = 0
    for asset in assets:
        pairs = list(candidates_for(asset, matrix))
        total += len(pairs)
        ready = sum(1 for variant, seed in pairs if all_outputs_ready(paths_for(asset, variant, seed)))
        raw = sum(1 for variant, seed in pairs if paths_for(asset, variant, seed)["raw"].is_file())
        key = rank_key(asset)
        print(
            f"{asset['id']:24s} rank={asset.get('rank', '-'):>2} {key:8s} "
            f"candidates={len(pairs):2d} raw={raw:2d} ready={ready:2d} "
            f"review={repo_relative(REVIEW_ROOT / key)}"
        )
    print(f"\ntotal: {len(assets)} assets, {total} candidates")


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


def draw_sheet_tile(sheet, draw, x, y, path, label, variant_font, status_font):
    draw.rectangle([x, y, x + SHEET_TILE - 1, y + SHEET_TILE + SHEET_LABEL_H - 1], fill=SHEET_PANEL)
    draw.rectangle([x, y + SHEET_TILE, x + SHEET_TILE - 1, y + SHEET_TILE + SHEET_LABEL_H - 1],
                   fill=SHEET_LABEL_BG)

    if path is None:
        status, colour = "MISSING", SHEET_MISSING
    else:
        status, colour = None, None
        try:
            with Image.open(path) as opened:
                image = opened.convert("RGBA")
            thumb = ImageOps.contain(image, (SHEET_TILE - 24, SHEET_TILE - 24),
                                     Image.Resampling.LANCZOS)
            sheet.paste(
                thumb,
                (x + (SHEET_TILE - thumb.width) // 2, y + (SHEET_TILE - thumb.height) // 2),
                thumb,
            )
        except Exception:  # noqa: BLE001 - a corrupt candidate must not abort the sheet
            status, colour = "BROKEN", SHEET_BROKEN

    if status:
        draw.rectangle([x + 4, y + 4, x + SHEET_TILE - 5, y + SHEET_TILE - 5],
                       outline=colour, width=2)
        draw.text((x + SHEET_TILE / 2, y + SHEET_TILE / 2), status, font=status_font,
                  fill=colour, anchor="mm")

    draw.rectangle([x, y, x + SHEET_TILE - 1, y + SHEET_TILE + SHEET_LABEL_H - 1],
                   outline=SHEET_BORDER, width=1)
    draw.text((x + SHEET_TILE / 2, y + SHEET_TILE + SHEET_LABEL_H / 2), label,
              font=variant_font, fill=SHEET_TEXT, anchor="mm")


def build_sheet(asset, matrix):
    pairs = list(candidates_for(asset, matrix))
    rows = max(1, math.ceil(len(pairs) / SHEET_COLS))
    width = SHEET_MARGIN * 2 + SHEET_COLS * SHEET_TILE + (SHEET_COLS - 1) * SHEET_GUTTER
    grid_top = SHEET_MARGIN + SHEET_TITLE_H
    height = (
        grid_top
        + rows * (SHEET_TILE + SHEET_LABEL_H)
        + (rows - 1) * SHEET_GUTTER
        + SHEET_MARGIN
    )

    sheet = Image.new("RGB", (width, height), SHEET_BG)
    draw = ImageDraw.Draw(sheet)
    title_font = load_font(22, bold=True)
    subtitle_font = load_font(13)
    variant_font = load_font(14)
    status_font = load_font(17, bold=True)

    draw.text((SHEET_MARGIN, SHEET_MARGIN + 2), asset["id"], font=title_font, fill=SHEET_TEXT)
    subtitle = (
        f"rank {asset.get('rank', '-')} · {rank_key(asset)} · {len(pairs)} candidates · "
        f"review masters, 320 px tiles"
    )
    draw.text((SHEET_MARGIN, SHEET_MARGIN + 32), subtitle, font=subtitle_font, fill=SHEET_MUTED)

    for index, (variant, seed) in enumerate(pairs):
        row, col = divmod(index, SHEET_COLS)
        x = SHEET_MARGIN + col * (SHEET_TILE + SHEET_GUTTER)
        y = grid_top + row * (SHEET_TILE + SHEET_LABEL_H + SHEET_GUTTER)
        review = paths_for(asset, variant, seed)["review"]
        path = review if load_ok(review, (CANVAS, CANVAS)) else None
        draw_sheet_tile(sheet, draw, x, y, path, candidate_name(variant, seed),
                        variant_font, status_font)

    return sheet


def write_sheet(asset, matrix, destination):
    sheet = build_sheet(asset, matrix)
    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination, "JPEG", quality=88, optimize=True)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--prompts", default=str(PROMPTS_PATH), help="boss prompt matrix JSON")
    parser.add_argument("--only", action="append", metavar="ASSET",
                        help="asset id or slug fragment; repeatable")
    parser.add_argument("--force", action="store_true", help="rebuild existing outputs")
    parser.add_argument("--limit", type=int, metavar="N", help="process at most N pending candidates")
    parser.add_argument("--list", action="store_true", help="list selection and exit")
    args = parser.parse_args(argv)
    if args.limit is not None and args.limit < 1:
        print("ERROR: --limit must be at least 1", file=sys.stderr)
        return 1

    try:
        matrix = load_matrix(Path(args.prompts))
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    assets = select_assets(matrix["assets"], args.only)
    if not assets:
        print("nothing selected", file=sys.stderr)
        return 0

    if args.list:
        list_assets(assets, matrix)
        return 0

    require_pillow()

    # Fail loudly before doing any work: a missing raw candidate means the
    # generation run did not finish and the batch would be silently incomplete.
    missing = []
    for asset in assets:
        for variant, seed in candidates_for(asset, matrix):
            raw = paths_for(asset, variant, seed)["raw"]
            if not raw.is_file() or raw.stat().st_size == 0:
                missing.append(raw)
    if missing:
        print(f"ERROR: {len(missing)} raw candidate(s) missing:", file=sys.stderr)
        for path in missing:
            print(f"  {repo_relative(path)}", file=sys.stderr)
        print("Run generate.py to completion before processing.", file=sys.stderr)
        return 1

    pending = []
    skipped = 0
    for asset in assets:
        for variant, seed in candidates_for(asset, matrix):
            paths = paths_for(asset, variant, seed)
            if not args.force and all_outputs_ready(paths):
                skipped += 1
                continue
            pending.append((asset, variant, seed, paths))
    if args.limit is not None:
        pending = pending[:args.limit]

    if pending:
        _, remove = require_rembg()
        used_session = DEFAULT_SESSION
        fallback = False
        try:
            session = new_session(used_session)
        except Exception as exc:  # noqa: BLE001 - model download failures are expected offline
            print(f"note: {DEFAULT_SESSION} unavailable ({exc}); falling back to {FALLBACK_SESSION}")
            used_session = FALLBACK_SESSION
            fallback = True
            try:
                session = new_session(used_session)
            except Exception as fallback_exc:  # noqa: BLE001
                print(f"ERROR: could not create rembg session {FALLBACK_SESSION!r}: {fallback_exc}",
                      file=sys.stderr)
                return 1
    else:
        new_session = remove = session = None
        used_session = DEFAULT_SESSION
        fallback = False

    processed = failed = 0
    try:
        for asset, variant, seed, paths in pending:
            started = time.time()
            record = {
                "asset": asset["id"],
                "rank": asset.get("rank"),
                "rank_key": rank_key(asset),
                "candidate": candidate_name(variant, seed),
                "variant": variant,
                "seed": seed,
                "status": "error",
                "input": repo_relative(paths["raw"]),
                "review": repo_relative(paths["review"]),
                "tile": repo_relative(paths["tile"]),
                "shadow": repo_relative(paths["shadow"]),
                "sheet": repo_relative(paths["sheet"]),
                "alpha_bbox": None,
                "review_alpha_bbox": None,
                "tile_alpha_bbox": None,
                "session": used_session,
                "fallback": fallback,
                "wall_s": 0.0,
                "error": None,
            }
            try:
                with Image.open(paths["raw"]) as opened:
                    cutout = remove(opened.convert("RGBA"), session=session)
                review, tile, shadow, bbox = build_derivatives(cutout)

                review_bbox = review.getchannel("A").getbbox()
                tile_bbox = tile.getchannel("A").getbbox()
                if review.size != (CANVAS, CANVAS) or review_bbox is None:
                    raise ValueError("review master failed the size/alpha check")
                if tile.size != (TILE_CANVAS, TILE_CANVAS) or tile_bbox is None:
                    raise ValueError("placement tile failed the size/alpha check")
                if shadow.size != (TILE_CANVAS, TILE_CANVAS):
                    raise ValueError("shadow tile failed the size check")

                for path in (paths["review"], paths["tile"], paths["shadow"]):
                    path.parent.mkdir(parents=True, exist_ok=True)
                review.save(paths["review"], "PNG")
                tile.save(paths["tile"], "PNG")
                shadow.save(paths["shadow"], "PNG")

                record["alpha_bbox"] = list(bbox)
                record["review_alpha_bbox"] = list(review_bbox)
                record["tile_alpha_bbox"] = list(tile_bbox)
                record["status"] = "success"
                processed += 1
                print(f"{asset['id']} {candidate_name(variant, seed)} ok "
                      f"bbox={list(bbox)} {time.time() - started:.1f}s")
            except Exception as exc:  # noqa: BLE001 - log and keep going
                record["error"] = f"{type(exc).__name__}: {exc}"
                failed += 1
                print(f"{asset['id']} {candidate_name(variant, seed)} FAILED: {record['error']}",
                      file=sys.stderr)
            record["wall_s"] = round(time.time() - started, 1)
            append_log(record)
    except KeyboardInterrupt:
        print("\ninterrupted; partial results are logged", file=sys.stderr)
        return 130

    # Only sheet ranks whose full 12-candidate set exists. A partial run must not
    # overwrite a good sheet with a mostly-MISSING one.
    sheets = 0
    for asset in assets:
        pairs = list(candidates_for(asset, matrix))
        complete = all(
            load_ok(paths_for(asset, variant, seed)["review"], (CANVAS, CANVAS))
            for variant, seed in pairs
        )
        if not complete:
            print(f"sheet skipped for {asset['id']}: review masters incomplete")
            continue
        destination = SHEET_ROOT / f"{rank_key(asset)}.jpg"
        write_sheet(asset, matrix, destination)
        sheets += 1
        print(f"{asset['id']} -> {repo_relative(destination)}")

    print(
        f"\nsummary: {processed} processed, {skipped} skipped, {failed} failed, "
        f"{sheets} sheet(s)"
    )
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
