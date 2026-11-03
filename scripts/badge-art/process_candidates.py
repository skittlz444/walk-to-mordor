#!/usr/bin/env python3
"""Cut out and normalise badge candidates with rembg.

Run with the ComfyUI venv, which has rembg 2.0.76, onnxruntime and Pillow:

  /run/media/skittlz/LinuxStorageSSD/github/comfyui/venv/bin/python \
      scripts/badge-art/process_candidates.py --limit 2

`--list` and `--help` work on the system interpreter without rembg.

Pipeline per candidate:
  rembg cutout -> trim alpha bbox -> fit longest side to the group target
  -> centre on a 1024 transparent canvas -> group finishing.

Emblems get an 800 px circular alpha mask with a 1 px feather. Family frames
fit to 1016 px and are cut open inside r=440 (880 px). Rank rings fit to
880 px and are cut open inside r=400 (800 px). The stack is therefore
emblem 800 -> rank ring 800-880 -> frame 880-1016, with no layer covering
the one below. Alpha is always preserved; images are never flattened onto
black.

Outputs go to raw_assets/badges/processed/<asset>/<variant>-<seed>.png and one
JSON line per processed candidate appends to reports/badge-art/processing.jsonl.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
PROMPTS_PATH = HERE / "prompts.json"
RAW_ROOT = REPO_ROOT / "raw_assets" / "badges"
LOG_PATH = REPO_ROOT / "reports" / "badge-art" / "processing.jsonl"

CANVAS = 1024
TARGET_OUTER_PX = {"emblem": 800, "frame": 1016, "rank": 880}
GROUPS = ("emblem", "frame", "rank")
DEFAULT_SESSION = "birefnet-general"
FALLBACK_SESSION = "isnet-general-use"
# Inner opening of each layer type, in canvas pixels. The frame must clear the
# rank ring (880 px outer) and the rank ring must clear the emblem (800 px).
CORE_RADIUS = {"frame": 440, "rank": 400}
EMBLEM_FEATHER = 0.5  # Gaussian radius; about a 1 px transition

try:
    from PIL import Image, ImageChops, ImageDraw, ImageFilter
except ImportError:  # --list and --help still work without Pillow
    Image = ImageChops = ImageDraw = ImageFilter = None


def load_matrix(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    if not data.get("assets"):
        raise ValueError(f"{path}: no assets")
    for asset in data["assets"]:
        for key in ("id", "group", "slug", "variants"):
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


def candidates_for(asset, matrix, variants):
    for variant in asset["variants"]:
        if variants and variant["id"] not in variants:
            continue
        for seed in seeds_for(asset, matrix):
            yield variant["id"], int(seed)


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
            "scripts/badge-art/process_candidates.py"
        )


def fit_longest(image, target):
    width, height = image.size
    scale = target / max(width, height)
    size = (max(1, round(width * scale)), max(1, round(height * scale)))
    return image.resize(size, Image.LANCZOS)


def fit_shortest(image, target):
    """Scale so the short axis reaches target; decorative protrusions may clip."""
    width, height = image.size
    scale = target / min(width, height)
    size = (max(1, round(width * scale)), max(1, round(height * scale)))
    return image.resize(size, Image.LANCZOS)


def circular_mask(diameter, feather=EMBLEM_FEATHER):
    """Antialiased circular mask, supersampled 4x before the optional feather."""
    scale = 4
    big = Image.new("L", (CANVAS * scale, CANVAS * scale), 0)
    draw = ImageDraw.Draw(big)
    centre = CANVAS * scale / 2
    radius = diameter * scale / 2
    draw.ellipse(
        [centre - radius, centre - radius, centre + radius, centre + radius],
        fill=255,
    )
    mask = big.resize((CANVAS, CANVAS), Image.LANCZOS)
    if feather:
        mask = mask.filter(ImageFilter.GaussianBlur(feather))
    return mask


def ring_core_mask(radius=400):
    """Antialiased mask that is 0 inside the core radius and 255 outside."""
    scale = 4
    big = Image.new("L", (CANVAS * scale, CANVAS * scale), 255)
    draw = ImageDraw.Draw(big)
    centre = CANVAS * scale / 2
    r = radius * scale
    draw.ellipse([centre - r, centre - r, centre + r, centre + r], fill=0)
    return big.resize((CANVAS, CANVAS), Image.LANCZOS)


def alpha_coverage(image):
    histogram = image.getchannel("A").histogram()
    return round(sum(histogram[1:]) / (image.width * image.height), 4)


def core_coverage(image, core_mask):
    """Mean alpha inside the open core; core_mask is 0 inside and 255 outside."""
    alpha = image.getchannel("A")
    inside = ImageChops.invert(core_mask)
    masked = ImageChops.multiply(alpha, inside)
    histogram = masked.histogram()
    mass = sum(index * count for index, count in enumerate(histogram))
    area = sum(inside.histogram()[1:])
    return round(mass / (area * 255), 4) if area else 0.0


def process_one(image, group):
    """Return (normalised RGBA image, pre-cut core alpha or None)."""
    rgba = image.convert("RGBA")
    bbox = rgba.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("cutout is fully transparent")
    trimmed = rgba.crop(bbox)

    target = TARGET_OUTER_PX[group]
    # Rank rings must reach the frame's 880 px opening on their short axis;
    # emblems and frames fit their longest axis so decorative protrusions stay.
    fitted = fit_shortest(trimmed, target) if group == "rank" else fit_longest(trimmed, target)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    offset = ((CANVAS - fitted.width) // 2, (CANVAS - fitted.height) // 2)
    canvas.alpha_composite(fitted, offset)

    core_alpha = None
    if group == "emblem":
        mask = circular_mask(target)
        canvas.putalpha(ImageChops.multiply(canvas.getchannel("A"), mask))
    elif group in ("frame", "rank"):
        # Both layer types must have an open core: a filled centre would hide the
        # emblem underneath. Cut at the planned inner diameter so the stack is
        # emblem (800) -> rank ring (800-880) -> frame (880-1016).
        core_mask = ring_core_mask(CORE_RADIUS[group])
        core_alpha = core_coverage(canvas, core_mask)
        canvas.putalpha(ImageChops.multiply(canvas.getchannel("A"), core_mask))

    return canvas, core_alpha


def append_log(record):
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")


def require_rembg():
    try:
        from rembg import new_session, remove
    except ImportError as exc:
        raise SystemExit(
            "ERROR: rembg is not installed for this interpreter. Use the ComfyUI venv:\n"
            "  /run/media/skittlz/LinuxStorageSSD/github/comfyui/venv/bin/python "
            "scripts/badge-art/process_candidates.py"
        ) from exc
    return new_session, remove


def list_assets(assets, matrix, variants):
    total = 0
    for asset in assets:
        pairs = list(candidates_for(asset, matrix, variants))
        total += len(pairs)
        raw_dir = RAW_ROOT / "candidates" / asset["id"]
        out_dir = RAW_ROOT / "processed" / asset["id"]
        present = sum(1 for v, s in pairs if (raw_dir / f"{v}-{s}.png").is_file())
        done = sum(1 for v, s in pairs if (out_dir / f"{v}-{s}.png").is_file())
        print(
            f"{asset['id']:54s} {asset['group']:6s} target={TARGET_OUTER_PX[asset['group']]:4d}px "
            f"candidates={len(pairs):3d} raw={present:3d} processed={done:3d}"
        )
    print(f"\ntotal: {len(assets)} assets, {total} candidates")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--prompts", default=str(PROMPTS_PATH), help="prompt matrix JSON")
    parser.add_argument("--only", action="append", metavar="ASSET",
                        help="asset id or slug fragment; repeatable")
    parser.add_argument("--group", choices=GROUPS, help="only this layer group")
    parser.add_argument("--session", default=DEFAULT_SESSION,
                        help=f"rembg session (default: {DEFAULT_SESSION}; falls back to {FALLBACK_SESSION})")
    parser.add_argument("--force", action="store_true", help="overwrite processed files")
    parser.add_argument("--limit", type=int, metavar="N", help="process at most N pending candidates")
    parser.add_argument("--list", action="store_true", help="list the selected matrix and exit")
    parser.add_argument("--variants", help="comma-separated variant ids (default: all)")
    args = parser.parse_args(argv)
    if args.limit is not None and args.limit < 1:
        print("ERROR: --limit must be at least 1", file=sys.stderr)
        return 1

    try:
        matrix = load_matrix(Path(args.prompts))
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    assets = select_assets(matrix["assets"], args.only, args.group)
    variants = [v.strip() for v in args.variants.split(",") if v.strip()] if args.variants else []

    if args.list:
        list_assets(assets, matrix, variants)
        return 0

    require_pillow()
    processed = 0
    skipped = 0
    missing = 0
    failed = 0
    pending = []
    for asset in assets:
        for variant, seed in candidates_for(asset, matrix, variants):
            name = f"{variant}-{seed}.png"
            source = RAW_ROOT / "candidates" / asset["id"] / name
            destination = RAW_ROOT / "processed" / asset["id"] / name
            if destination.exists() and destination.stat().st_size > 0 and not args.force:
                try:
                    with Image.open(destination) as check:
                        check.load()
                    skipped += 1
                    continue
                except Exception:  # noqa: BLE001 - a truncated PNG must be reprocessed
                    pass
            if not source.exists() or source.stat().st_size == 0:
                missing += 1
                continue
            pending.append((asset, variant, seed, source, destination))

    limit_reached = bool(args.limit is not None and len(pending) > args.limit)
    if args.limit is not None:
        pending = pending[:args.limit]

    if not pending:
        print(f"\nsummary: {processed} processed, {skipped} skipped, {failed} failed, {missing} missing")
        return 0

    new_session, remove = require_rembg()

    used_session = args.session
    fallback = False
    try:
        session = new_session(used_session)
    except Exception as exc:  # noqa: BLE001 - model download failures are expected offline
        if args.session != DEFAULT_SESSION:
            print(f"ERROR: could not create rembg session {args.session!r}: {exc}", file=sys.stderr)
            return 1
        used_session = FALLBACK_SESSION
        fallback = True
        print(f"note: {DEFAULT_SESSION} unavailable ({exc}); falling back to {FALLBACK_SESSION}")
        try:
            session = new_session(used_session)
        except Exception as fallback_exc:  # noqa: BLE001
            print(f"ERROR: could not create fallback session {FALLBACK_SESSION!r}: {fallback_exc}",
                  file=sys.stderr)
            return 1

    try:
        for asset, variant, seed, source, destination in pending:
            started = time.time()
            record = {
                "asset": asset["id"],
                "group": asset["group"],
                "candidate": f"{variant}-{seed}",
                "variant": variant,
                "seed": seed,
                "status": "error",
                "alpha_bbox": None,
                "coverage": 0.0,
                "core_coverage": None,
                "output": repo_relative(destination),
                "input": repo_relative(source),
                "session": used_session,
                "fallback": fallback,
                "wall_s": 0.0,
                "error": None,
            }
            try:
                with Image.open(source) as opened:
                    cutout = remove(opened.convert("RGBA"), session=session)
                normalised, core_alpha = process_one(cutout, asset["group"])
                alpha_bbox = normalised.getchannel("A").getbbox()
                if normalised.size != (CANVAS, CANVAS) or alpha_bbox is None:
                    raise ValueError("normalised image failed the size/alpha check")
                destination.parent.mkdir(parents=True, exist_ok=True)
                normalised.save(destination, "PNG")
                record["alpha_bbox"] = list(alpha_bbox)
                record["coverage"] = alpha_coverage(normalised)
                if core_alpha is not None:
                    record["core_coverage"] = core_alpha
                record["status"] = "success"
                record["wall_s"] = round(time.time() - started, 1)
                processed += 1
                print(f"{asset['id']} {variant}-{seed} ok "
                      f"coverage={record['coverage']:.3f} "
                      f"bbox={record['alpha_bbox']} {record['wall_s']:.1f}s")
            except Exception as exc:  # noqa: BLE001 - log and keep going
                record["error"] = f"{type(exc).__name__}: {exc}"
                failed += 1
                print(f"{asset['id']} {variant}-{seed} FAILED: {record['error']}", file=sys.stderr)
            record["wall_s"] = round(time.time() - started, 1)
            append_log(record)
    except KeyboardInterrupt:
        print("\ninterrupted; partial results are logged", file=sys.stderr)
        return 130

    print(f"\nsummary: {processed} processed, {skipped} skipped, {failed} failed, {missing} missing")
    if limit_reached:
        print(f"limit reached: {args.limit} candidate(s) attempted")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
