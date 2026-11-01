#!/usr/bin/env python3
"""Bespoke hexagon emblem test: cut out, hex-mask, composite, grid, manifest.

This is a shape test, not a shortlist change. It reuses the pointy-top hexagon
geometry and presentation helpers from composite_badges.py so the bespoke
emblems sit in exactly the same frame/rank stack as the existing hexagon
composites.

Pipeline per candidate:
  rembg birefnet-general cutout -> trim alpha bbox -> fit longest side to 800
  -> centre on a 1024 transparent canvas -> pointy-top hexagon mask R400.

Then variant A stack (emblem -> rank -> frame), 512 px preview on #14181f
with the same soft shadow as the existing composites.

Outputs:
  raw_assets/badges/processed/emblem/hex-test-*/<variant>-<seed>.png
  reports/badge-art/composites/hexagon-bespoke/<slug>-<variant>-<seed>.webp
  reports/badge-art/composites/hexagon-bespoke-grid.jpg
  reports/badge-art/composites/manifest.json (appended entries)

Usage (ComfyUI venv has rembg + Pillow + numpy):
  /run/media/skittlz/LinuxStorageSSD/github/comfyui/venv/bin/python \
      scripts/badge-art/hexagon_test.py
"""
from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import composite_badges as cb
import process_candidates as pc

try:
    from PIL import Image, ImageDraw
except ImportError:  # --list still works without Pillow
    Image = ImageDraw = None

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
MATRIX_PATH = HERE / "hexagon-test-prompts.json"
RAW_ROOT = REPO_ROOT / "raw_assets" / "badges"
PROCESSED_ROOT = cb.PROCESSED_ROOT
OUT_DIR = REPO_ROOT / "reports" / "badge-art" / "composites"
BESPOKE_DIR = OUT_DIR / "hexagon-bespoke"
GRID_PATH = OUT_DIR / "hexagon-bespoke-grid.jpg"
MANIFEST_PATH = OUT_DIR / "manifest.json"

CANVAS = cb.CANVAS
TARGET = pc.TARGET_OUTER_PX["emblem"]
HEX_RADIUS = cb.HEXAGON["emblem"][1]
SESSION = "birefnet-general"
SHADOW_PADDING = 16

MATERIAL = {"a": "enamel", "b": "engraved"}


def repo_relative(path):
    try:
        return str(Path(path).resolve().relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def load_matrix():
    data = json.loads(MATRIX_PATH.read_text(encoding="utf-8"))
    if not data.get("assets"):
        raise ValueError(f"{MATRIX_PATH}: no assets")
    return data


def selected_layers():
    """Read the frame/rank picks from the shortlist, not a second copy."""
    shortlist = cb.load_shortlist()
    frames = {
        family: (f"frame/{family}", cb.recommended(shortlist, f"frame/{family}"))
        for family in ("journey", "habit")
    }
    return frames, cb.recommended(shortlist, "rank/bronze")


def candidates(matrix, frames, rank_pick):
    for asset in matrix["assets"]:
        frame_id, frame_pick = frames[asset["family"]]
        for variant in asset["variants"]:
            for seed in matrix["seeds"][asset["group"]]:
                yield {
                    "asset": asset,
                    "variant": variant["id"],
                    "seed": int(seed),
                    "source": RAW_ROOT / "candidates" / asset["id"] / f"{variant['id']}-{seed}.png",
                    "processed": PROCESSED_ROOT / asset["id"] / f"{variant['id']}-{seed}.png",
                    "frame_id": frame_id,
                    "frame_pick": frame_pick,
                    "rank_id": "rank/bronze",
                    "rank_pick": rank_pick,
                }


def require_runtime():
    if Image is None:
        raise SystemExit("ERROR: Pillow is required; run with the ComfyUI venv.")
    try:
        from rembg import new_session, remove  # noqa: F401
    except ImportError as exc:
        raise SystemExit(
            "ERROR: rembg is not installed for this interpreter. Use the ComfyUI venv:\n"
            "  /run/media/skittlz/LinuxStorageSSD/github/comfyui/venv/bin/python "
            "scripts/badge-art/hexagon_test.py"
        ) from exc


def process_cutout(cutout, destination):
    """Trim, fit longest side to 800, centre, hex-mask R400."""
    rgba = cutout.convert("RGBA")
    bbox = rgba.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("cutout is fully transparent")
    trimmed = rgba.crop(bbox)
    fitted = pc.fit_longest(trimmed, TARGET)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    offset = ((CANVAS - fitted.width) // 2, (CANVAS - fitted.height) // 2)
    canvas.alpha_composite(fitted, offset)
    canvas = cb.mask_hexagon(canvas, HEX_RADIUS)

    alpha_bbox = canvas.getchannel("A").getbbox()
    if alpha_bbox is None:
        raise ValueError("hex-masked image is fully transparent")
    destination.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(destination, "PNG")
    return {
        "trimmed": trimmed.size,
        "fitted": fitted.size,
        "alpha_bbox": list(alpha_bbox),
        "coverage": round(
            sum(canvas.getchannel("A").histogram()[1:]) / (CANVAS * CANVAS), 4
        ),
    }


def compose(entry):
    frame_path = PROCESSED_ROOT / entry["frame_id"] / f"{entry['frame_pick']}.png"
    rank_path = PROCESSED_ROOT / entry["rank_id"] / f"{entry['rank_pick']}.png"
    frame_in, frame_out = cb.HEXAGON["frame"]
    rank_in, rank_out = cb.HEXAGON["rank"]
    frame = cb.cached_remap(frame_path, "hexagon", frame_in, frame_out, *cb.FRAME_SRC)
    rank = cb.cached_remap(rank_path, "hexagon", rank_in, rank_out, *cb.RANK_SRC)
    emblem = cb.load_layer(entry["processed"])
    return cb.flatten([emblem, rank, frame])


def badge_manifest_entry(entry, path, nbytes):
    asset = entry["asset"]
    return {
        "output": repo_relative(path),
        "kind": "badge",
        "asset": asset["id"],
        "display_name": asset["name"],
        "family": asset["family"],
        "shape": "hexagon",
        "variant": "A",
        "rank": entry["rank_id"].split("/")[-1],
        "frame": entry["frame_id"],
        "candidates": {
            "emblem": f"{entry['variant']}-{entry['seed']}",
            "rank": entry["rank_pick"],
            "frame": entry["frame_pick"],
        },
        "layers": {
            "emblem": repo_relative(entry["processed"]),
            "rank": repo_relative(PROCESSED_ROOT / entry["rank_id"] / f"{entry['rank_pick']}.png"),
            "frame": repo_relative(PROCESSED_ROOT / entry["frame_id"] / f"{entry['frame_pick']}.png"),
        },
        "dimensions": cb.dimensions(path),
        "bytes": nbytes,
        "format": "webp",
        "note": "bespoke hexagon shape test; not a shortlist change",
    }


def build_grid(rows, out_path):
    """2 rows x 4 candidates, dark sheet style matching the coherence grids."""
    cols = 4
    if any(len(entries) != cols for _, entries in rows):
        raise ValueError(f"grid expects {cols} candidates per row")
    tile, label_h, gap, margin, title_h, row_head = 384, 56, 20, 32, 78, 34
    width = margin * 2 + cols * tile + (cols - 1) * gap
    height = (
        margin + title_h
        + len(rows) * (row_head + tile + label_h)
        + (len(rows) - 1) * gap
        + margin
    )
    canvas = Image.new("RGBA", (width, height), cb.SHEET_BG)
    draw = ImageDraw.Draw(canvas)
    title_font = cb.load_font(30, bold=True)
    subtitle_font = cb.load_font(16)
    head_font = cb.load_font(19, bold=True)
    head_small = cb.load_font(15)
    label_font = cb.load_font(16, bold=True)
    small_font = cb.load_font(15)

    draw.text((margin, margin), "Bespoke hexagon emblem test", font=title_font, fill=cb.TEXT)
    draw.text(
        (margin, margin + 40),
        f"{len(rows)} assets \u00b7 4 candidates each \u00b7 variant A stack "
        "(emblem \u2192 rank \u2192 frame) \u00b7 512 px previews",
        font=subtitle_font,
        fill=cb.MUTED,
    )

    y = margin + title_h
    for asset, entries in rows:
        draw.text(
            (margin, y),
            asset["name"].replace(" (hex test)", ""),
            font=head_font,
            fill=cb.TEXT,
        )
        caption = f" \u00b7 {asset['family']} frame \u00b7 bronze rank"
        caption_x = margin + draw.textlength(
            asset["name"].replace(" (hex test)", ""), font=head_font
        )
        draw.text((caption_x, y + 2), caption, font=head_small, fill=cb.MUTED)
        y += row_head

        for col, (entry, badge) in enumerate(entries):
            x = margin + col * (tile + gap)
            draw.rectangle([x, y, x + tile - 1, y + tile - 1], fill=cb.PANEL_BG, outline=cb.BORDER, width=1)
            cb.place_badge(canvas, badge, (x, y, tile, tile), padding=SHADOW_PADDING)
            draw.rectangle([x, y + tile, x + tile - 1, y + tile + label_h - 1], fill=cb.LABEL_BG)
            draw.line([x, y + tile, x + tile - 1, y + tile], fill=cb.BORDER, width=1)
            cb.draw_label(
                draw,
                x + tile / 2,
                y + tile + label_h / 2,
                [
                    (entry["variant"], True, cb.TEXT),
                    (" \u00b7 ", False, cb.MUTED),
                    (MATERIAL[entry["variant"]], False, cb.MUTED),
                    (" \u00b7 ", False, cb.MUTED),
                    (str(entry["seed"]), True, cb.GOLD),
                ],
                label_font,
                small_font,
            )
            draw.rectangle([x, y, x + tile - 1, y + tile + label_h - 1], outline=cb.BORDER, width=1)

        y += tile + label_h + gap

    out_path.parent.mkdir(parents=True, exist_ok=True)
    nbytes = cb.save_image(canvas, out_path, "JPEG", quality=92, subsampling=0, optimize=True)
    return nbytes


def update_manifest(badge_entries, grid_entry):
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    outputs = manifest.setdefault("outputs", [])
    by_output = {item.get("output"): index for index, item in enumerate(outputs)}
    for entry in [*badge_entries, grid_entry]:
        if entry["output"] in by_output:
            outputs[by_output[entry["output"]]] = entry
        else:
            by_output[entry["output"]] = len(outputs)
            outputs.append(entry)
    manifest["generated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    manifest["hexagon_test"] = {
        "prompts": repo_relative(MATRIX_PATH),
        "session": SESSION,
        "geometry": "pointy-top hexagon R400 emblem, R440/400 rank, R508/440 frame",
        "note": "bespoke hexagon emblems; shape test only, shortlist unchanged",
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return len(outputs)


def main():
    matrix = load_matrix()
    frames, rank_pick = selected_layers()
    pending = list(candidates(matrix, frames, rank_pick))
    missing = [entry["source"] for entry in pending if not entry["source"].is_file()]
    if missing:
        print("ERROR: missing raw candidates:", file=sys.stderr)
        for path in missing:
            print(f"  {repo_relative(path)}", file=sys.stderr)
        return 1
    if len(pending) != 8:
        print(f"ERROR: expected 8 candidates, found {len(pending)}", file=sys.stderr)
        return 1

    require_runtime()
    from rembg import new_session, remove

    print(f"rembg session: {SESSION}")
    session = new_session(SESSION)

    started = time.time()
    for entry in pending:
        with Image.open(entry["source"]) as opened:
            cutout = remove(opened.convert("RGBA"), session=session)
        stats = process_cutout(cutout, entry["processed"])
        print(
            f"{entry['asset']['id']} {entry['variant']}-{entry['seed']} "
            f"trim={stats['trimmed']} fit={stats['fitted']} "
            f"bbox={stats['alpha_bbox']} coverage={stats['coverage']:.3f}"
        )
    print(f"processed 8 in {time.time() - started:.1f}s")

    badges = []
    rows = []
    for asset in matrix["assets"]:
        entries = []
        for entry in (item for item in pending if item["asset"] is asset):
            badge = compose(entry)
            preview = Image.new("RGBA", (512, 512), cb.PREVIEW_BG)
            cb.place_badge(preview, badge, (0, 0, 512, 512), padding=SHADOW_PADDING)
            path = BESPOKE_DIR / f"{asset['slug']}-{entry['variant']}-{entry['seed']}.webp"
            nbytes = cb.save_image(preview, path, "WEBP", quality=90, method=6)
            badges.append(badge_manifest_entry(entry, path, nbytes))
            entries.append((entry, badge))
            print(f"  {repo_relative(path)} ({nbytes} bytes)")
        rows.append((asset, entries))

    grid_bytes = build_grid(rows, GRID_PATH)
    print(f"  {repo_relative(GRID_PATH)} ({grid_bytes} bytes)")

    grid_entry = {
        "output": repo_relative(GRID_PATH),
        "kind": "hexagon-test-grid",
        "asset": "multiple",
        "shape": "hexagon",
        "variant": "A",
        "components": [
            {
                "asset": entry["asset"]["id"],
                "display_name": entry["asset"]["name"],
                "shape": "hexagon",
                "variant": "A",
                "rank": entry["rank_id"].split("/")[-1],
                "frame": entry["frame_id"],
                "candidates": {
                    "emblem": f"{entry['variant']}-{entry['seed']}",
                    "rank": entry["rank_pick"],
                    "frame": entry["frame_pick"],
                },
                "layers": {
                    "emblem": repo_relative(entry["processed"]),
                    "rank": repo_relative(PROCESSED_ROOT / entry["rank_id"] / f"{entry['rank_pick']}.png"),
                    "frame": repo_relative(PROCESSED_ROOT / entry["frame_id"] / f"{entry['frame_pick']}.png"),
                },
            }
            for entry in pending
        ],
        "dimensions": cb.dimensions(GRID_PATH),
        "bytes": grid_bytes,
        "format": "jpeg",
        "layout": {"cols": 4, "rows": 2, "tile_px": 384, "label_px": 56},
        "note": "bespoke hexagon shape test; variant/seed labelled",
    }
    total = update_manifest(badges, grid_entry)
    print(f"\nwrote 8 badges + 1 grid; manifest now has {total} outputs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
