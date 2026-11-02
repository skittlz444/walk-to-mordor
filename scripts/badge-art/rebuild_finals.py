#!/usr/bin/env python3
"""Rebuild the final badge composites from the recovered production layers.

Reads the machine-readable picks in `final-selections.json` and the processed
1024 px layers under `raw_assets/badges/processed/` and
`raw_assets/badges/bosses/tiles/`, then writes:

  raw_assets/badges/final-complete/<name>.png   1024 px RGBA master
  <out-root>/img/achievements/full/<name>.webp  1024 px inspection image
  <out-root>/img/achievements/<name>.webp        512 px card image
  <out-root>/img/achievements/<name>-thumb.webp  200 px thumbnail

It also refreshes the tracked reusable layers under `assets/badge-art/`:
family frames, boss masters, boss tiles, and boss shadows. Use
`--no-retain-layers` to skip that copy.

`<name>` is `<slug>` for fixed-rank badges and the no-boss fallback, and
`<slug>--<rank_label>` for repeatable rank variants.

The composite is the locked F1 stack: an opaque dark well at 880, the emblem
at 800, the family frame at 1016/880, and the selected handcrafted rank boss
at 6 o'clock with its contact shadow. The boss and shadow are clipped to the
badge alpha so they cannot spill outside the silhouette.

Usage:
  /run/media/skittlz/LinuxStorageSSD/github/comfyui/venv/bin/python \
      scripts/badge-art/rebuild_finals.py --out-root /tmp/opencode/rebuild-output
  /run/media/skittlz/LinuxStorageSSD/github/comfyui/venv/bin/python \
      scripts/badge-art/rebuild_finals.py
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageChops

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
CONFIG = HERE / "final-selections.json"
PROMPTS = HERE / "prompts.json"
RAW = REPO / "raw_assets" / "badges"
PROCESSED = RAW / "processed"
BOSS_TILES = RAW / "bosses" / "tiles"
MASTERS = RAW / "final-complete"

CANVAS = 1024
WELL_DIAMETER = 880
WELL_COLOUR = (10, 13, 19, 255)
BOSS_POSITION = (466, 934)
SHADOW_POSITION = (466, 936)
MAIN_PX, THUMB_PX, FULL_PX = 512, 200, 1024
MAIN_KB, THUMB_KB, FULL_KB = 120, 20, 500
RETAIN = REPO / "assets" / "badge-art"


def load_config():
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    prompts = json.loads(PROMPTS.read_text(encoding="utf-8"))
    families = {a["slug"]: a["family"] for a in prompts["assets"] if a["group"] == "emblem"}
    for slug in config["emblems"]:
        if slug not in families:
            raise ValueError(f"{slug}: no family in prompts.json")
    return config, families


def require(path: Path):
    if not path.is_file():
        raise FileNotFoundError(path)
    return path


def emblem_layer(config, slug):
    return require(PROCESSED / "emblem" / slug / f"{config['emblems'][slug]}.png")


def frame_layer(config, family):
    return require(PROCESSED / "frame" / family / f"{config['frames'][family]}.png")


def boss_layers(config, rank):
    candidate = config["bosses"][rank]
    return (
        require(BOSS_TILES / rank / f"{candidate}.png"),
        require(BOSS_TILES / rank / f"{candidate}-shadow.png"),
    )


def build_base(config, families, slug):
    emblem = Image.open(emblem_layer(config, slug)).convert("RGBA")
    frame = Image.open(frame_layer(config, families[slug])).convert("RGBA")
    base = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(base)
    inset = (CANVAS - WELL_DIAMETER) // 2
    draw.ellipse(
        [inset, inset, CANVAS - inset - 1, CANVAS - inset - 1],
        fill=WELL_COLOUR,
    )
    base.alpha_composite(emblem)
    base.alpha_composite(frame)
    return base


def add_boss(config, base, rank):
    boss = Image.open(boss_layers(config, rank)[0]).convert("RGBA")
    shadow = Image.open(boss_layers(config, rank)[1]).convert("RGBA")
    composite = base.copy()
    composite.alpha_composite(shadow, SHADOW_POSITION)
    composite.alpha_composite(boss, BOSS_POSITION)
    composite.putalpha(ImageChops.multiply(composite.getchannel("A"), base.getchannel("A")))
    return composite


def retain_layers(config):
    """Copy the reusable frame and boss layers out of the gitignored workspace."""
    import shutil

    frames = RETAIN / "frames"
    bosses = RETAIN / "bosses"
    frames.mkdir(parents=True, exist_ok=True)
    bosses.mkdir(parents=True, exist_ok=True)
    for family in config["frames"]:
        shutil.copy2(frame_layer(config, family), frames / f"{family}.png")
    for rank in config["bosses"]:
        master = BOSS_TILES.parent / "processed" / rank / f"{config['bosses'][rank]}.png"
        tile, shadow = boss_layers(config, rank)
        shutil.copy2(require(master), bosses / f"{rank}.png")
        shutil.copy2(tile, bosses / f"{rank}-tile.png")
        shutil.copy2(shadow, bosses / f"{rank}-shadow.png")


def save_webp(image: Image.Image, path: Path, size: int, max_kb: int, quality: int):
    path.parent.mkdir(parents=True, exist_ok=True)
    resized = image.resize((size, size), Image.LANCZOS)
    current = quality
    while current >= 60:
        resized.save(path, "WEBP", quality=current, method=4)
        if path.stat().st_size <= max_kb * 1024:
            return path.stat().st_size, current
        current -= 4
    print(f"warning: {path.name} is still above {max_kb} KiB at quality 60", file=sys.stderr)
    return path.stat().st_size, current + 4


def output_name(slug, rank=None):
    return f"{slug}--{rank}" if rank else slug


def build_one(config, families, slug, rank, out_root: Path, name: str):
    base = build_base(config, families, slug)
    image = add_boss(config, base, rank) if rank else base

    MASTERS.mkdir(parents=True, exist_ok=True)
    master_path = MASTERS / f"{name}.png"
    image.save(master_path, "PNG", optimize=True)

    achievements = out_root / "img" / "achievements"
    main_size, main_q = save_webp(image, achievements / f"{name}.webp", MAIN_PX, MAIN_KB, 90)
    thumb_size, thumb_q = save_webp(image, achievements / f"{name}-thumb.webp", THUMB_PX, THUMB_KB, 80)
    full_size, full_q = save_webp(image, achievements / "full" / f"{name}.webp", FULL_PX, FULL_KB, 90)
    return {
        "name": name,
        "rank": rank or "none",
        "master": str(master_path.relative_to(REPO)),
        "main_kb": round(main_size / 1024, 1),
        "main_q": main_q,
        "thumb_kb": round(thumb_size / 1024, 1),
        "thumb_q": thumb_q,
        "full_kb": round(full_size / 1024, 1),
        "full_q": full_q,
    }


def validate_config(config):
    fixed = set(config["fixed_ranks"])
    repeatable = set(config["repeatable"])
    emblems = set(config["emblems"])
    if fixed & repeatable:
        raise ValueError(f"badge is both fixed and repeatable: {sorted(fixed & repeatable)}")
    if fixed | repeatable != emblems:
        raise ValueError(
            "fixed_ranks + repeatable must equal emblems; "
            f"missing={sorted(emblems - fixed - repeatable)} extra={sorted((fixed | repeatable) - emblems)}"
        )
    for slug, rank in config["fixed_ranks"].items():
        if rank not in config["bosses"]:
            raise ValueError(f"{slug}: unknown rank {rank}")
    for rank in config["bosses"]:
        if rank not in config["ranks"]:
            raise ValueError(f"boss rank {rank} not in ranks")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out-root", default=str(REPO / "public"),
                        help="root for img/achievements (default: public/)")
    parser.add_argument("--only", action="append", metavar="SLUG", help="only this badge; repeatable")
    parser.add_argument("--no-retain-layers", action="store_true",
                        help="do not refresh assets/badge-art/{frames,bosses}")
    args = parser.parse_args(argv)

    config, families = load_config()
    validate_config(config)
    out_root = Path(args.out_root).resolve()
    selected = set(args.only or [])

    jobs = []
    for slug, rank in config["fixed_ranks"].items():
        jobs.append((slug, rank, slug))
    for slug in config["repeatable"]:
        jobs.append((slug, None, slug))
        for rank in config["ranks"]:
            jobs.append((slug, rank, output_name(slug, rank)))
    if selected:
        jobs = [job for job in jobs if job[0] in selected]

    if not args.no_retain_layers:
        retain_layers(config)
        print(f"retained reusable layers: {RETAIN}")

    results = []
    for slug, rank, name in jobs:
        results.append(build_one(config, families, slug, rank, out_root, name))
        print(f"{name:52s} rank={rank or '-':7s} "
              f"main={results[-1]['main_kb']:6.1f}K full={results[-1]['full_kb']:6.1f}K")

    total_kb = sum(r["main_kb"] + r["thumb_kb"] + r["full_kb"] for r in results)
    print(f"\n{len(results)} composites · {total_kb / 1024:.1f} MiB public assets")
    print(f"masters: {MASTERS}")
    print(f"output:  {out_root / 'img' / 'achievements'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
