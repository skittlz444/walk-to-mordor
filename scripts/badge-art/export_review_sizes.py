#!/usr/bin/env python3
"""Export finalist review images at native, production and actual-card sizes.

Groups:
  emblems      - 15 achievements
  frames       - 6 family borders
  rank bosses  - the four F1 6 o'clock rank badges (bronze/silver/gold/mithril)

Individual badge/frame sizes:
  1024 - native processed master (full-detail inspection)
   200 - production thumbnail minimum
    96 - card-size stress test

Rank bosses are rendered from the F1v2 procedural source at 512/200/96.

Sheets (primary):
  emblems-hires-sheet.jpg / emblems-200-sheet.jpg / emblems-96-sheet.jpg
  frames-hires-sheet.jpg  / frames-200-sheet.jpg  / frames-96-sheet.jpg
  rank-bosses-hires-sheet.jpg / rank-bosses-200-sheet.jpg / rank-bosses-96-sheet.jpg
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

try:
    from composite_badges import render_rank_boss_v2
except ImportError as exc:  # numpy is required by the boss renderer
    raise SystemExit(
        "Run this with the ComfyUI venv:\n"
        "  /run/media/skittlz/LinuxStorageSSD/github/comfyui/venv/bin/python "
        "scripts/badge-art/export_review_sizes.py"
    ) from exc

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
REPORT = REPO / "reports" / "badge-art"
SHORTLIST = REPORT / "shortlist.json"
PROMPTS = HERE / "prompts.json"
PROCESSED = REPO / "raw_assets" / "badges" / "processed"
BG = "#14181f"
SHEET_BG = "#0d1117"
GOLD = "#d4a017"
GOLD2 = "#ffe8a3"
TEXT = "#e6edf3"
MUTED = "#8b94a7"
SIZES = (1024, 200, 96)
BOSS_SIZES = (512, 200, 96)
RANK = {1: "Bronze", 2: "Silver", 3: "Gold", 4: "Mithril"}
BOSS_RANKS = (
    ("bronze", "Bronze", "round cabochon"),
    ("silver", "Silver", "octagon cut"),
    ("gold", "Gold", "hexagon cut"),
    ("mithril", "Mithril", "star cut + halo"),
)
SHORT_NAMES = {
    "First Steps": "First Steps",
    "Across the Buckleberry Ferry": "Buckleberry",
    "Survivor of Weathertop": "Weathertop",
    "Through Khazad-dûm": "Khazad-dûm",
    "Guest of the Golden Wood": "Golden Wood",
    "The Breaking of the Fellowship": "The Breaking",
    "Standing at Mount Doom": "Mount Doom",
    "Home Again at Sunset": "Home",
    "Faithful Walker": "Faithful Walker",
    "The Glittering Caves": "Glittering Caves",
    "Weekend Warrior": "Weekend",
    "Steady Month": "Steady Month",
    "Hundred-K Week": "Hundred-K",
    "Fellowship Founder": "Founder",
    "Good Company": "Good Company",
}


def font(size: int, bold: bool = False):
    path = "/usr/share/fonts/truetype/dejavu/" + ("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf")
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def rank_text(asset: dict) -> str:
    rank = asset.get("rank")
    if rank == "thresholds":
        return "Ranked"
    if rank in RANK:
        return RANK[rank]
    return "—"


def kind_label(asset: dict) -> str:
    if asset["group"] == "frame":
        return f"Family frame · {asset['family']}"
    return f"{rank_text(asset)} · {asset['family']}"


def flatten(path: Path, size: int) -> Image.Image:
    with Image.open(path) as opened:
        image = opened.convert("RGBA")
    canvas = Image.new("RGBA", (1024, 1024), BG)
    canvas.alpha_composite(image)
    if size != 1024:
        canvas = canvas.resize((size, size), Image.LANCZOS)
    return canvas.convert("RGB")


def flatten_tile(image: Image.Image, size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), BG)
    canvas.alpha_composite(image)
    return canvas.convert("RGB")


def load_data():
    prompts = json.loads(PROMPTS.read_text())
    shortlist = json.loads(SHORTLIST.read_text())
    assets = {a["id"]: a for a in prompts["assets"]}
    rows = []
    for asset_id, entry in shortlist["assets"].items():
        asset = assets[asset_id]
        if asset["group"] == "rank":
            continue  # rank rings are retired under F1; bosses replace them
        finalists = []
        for candidate in entry["finalists"]:
            name = candidate["candidate"]
            path = PROCESSED / asset_id / f"{name}.png"
            if not path.is_file():
                raise FileNotFoundError(path)
            finalists.append({"candidate": name, "path": path, "score": candidate["score"]})
        rows.append({"id": asset_id, "asset": asset, "finalists": finalists,
                     "recommended": entry["recommended"], "notes": entry.get("notes", "")})
    return rows


def export(rows, out_dir: Path):
    for size in SIZES:
        (out_dir / str(size)).mkdir(parents=True, exist_ok=True)
    for row in rows:
        for finalist in row["finalists"]:
            name = f"{row['asset']['slug']}--{finalist['candidate']}"
            for size in SIZES:
                image = flatten(finalist["path"], size)
                image.save(out_dir / str(size) / f"{name}.webp", "WEBP",
                           quality=92 if size >= 512 else 88, method=6)


def export_bosses(out_dir: Path):
    for size in BOSS_SIZES:
        directory = out_dir / "rank-bosses" / str(size)
        directory.mkdir(parents=True, exist_ok=True)
        for rank, _, _ in BOSS_RANKS:
            image = flatten_tile(render_rank_boss_v2(rank, out_size=size), size)
            image.save(directory / f"{rank}.webp", "WEBP", quality=92, method=6)


def build_group_sheet(rows, out_path: Path, group: str, image_px: int, cols: int,
                      gap: int, label_h: int, title: str, note: str):
    selected = [r for r in rows if r["asset"]["group"] == group]
    lines = (len(selected) + cols - 1) // cols
    cell_w = image_px * 2 + 16
    cell_h = image_px + label_h
    width = cols * cell_w + (cols + 1) * gap
    height = 86 + lines * (cell_h + 18) + gap
    sheet = Image.new("RGB", (width, height), SHEET_BG)
    draw = ImageDraw.Draw(sheet)
    draw.text((gap, 18), title, font=font(26, True), fill=TEXT)
    draw.text((gap, 50), note, font=font(13), fill=MUTED)
    for index, row in enumerate(selected):
        col, line = index % cols, index // cols
        x = gap + col * (cell_w + gap)
        y = 86 + line * (cell_h + 18)
        asset = row["asset"]
        draw.text((x, y), asset["name"], font=font(15, True), fill=TEXT)
        draw.text((x, y + 21), kind_label(asset), font=font(11), fill=MUTED)
        for j, finalist in enumerate(row["finalists"]):
            image = flatten(finalist["path"], image_px)
            ix = x + j * (image_px + 16)
            iy = y + 40
            sheet.paste(image, (ix, iy))
            selected_candidate = finalist["candidate"] == row["recommended"]
            draw.rectangle([ix - 2, iy - 2, ix + image_px + 1, iy + image_px + 1],
                           outline=GOLD if selected_candidate else "#2b3440", width=2)
            draw.text((ix, iy + image_px + 5), f"{'AB'[j]} · {finalist['candidate']}",
                      font=font(10, True), fill=TEXT)
            if selected_candidate:
                draw.text((ix + image_px - 4, iy + image_px + 5), "★ Recommended",
                          font=font(10, True), fill=GOLD2, anchor="ra")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path, "JPEG", quality=92, subsample=0, optimize=True)
    return sheet.size


def build_group_small_sheet(rows, out_path: Path, group: str, cols: int,
                            title: str, note: str):
    selected = [r for r in rows if r["asset"]["group"] == group]
    image_px, gap = 96, 14
    cell_w = image_px * 2 + 10
    cell_h = 20 + image_px + 26
    lines = (len(selected) + cols - 1) // cols
    width = cols * cell_w + (cols + 1) * gap
    height = 76 + lines * (cell_h + 14) + gap
    sheet = Image.new("RGB", (width, height), SHEET_BG)
    draw = ImageDraw.Draw(sheet)
    title_size = 22
    while title_size > 12 and draw.textlength(title, font=font(title_size, True)) > width - 2 * gap:
        title_size -= 1
    draw.text((gap, 16), title, font=font(title_size, True), fill=TEXT)
    draw.text((gap, 45), note, font=font(10), fill=MUTED)
    for index, row in enumerate(selected):
        col, line = index % cols, index // cols
        x = gap + col * (cell_w + gap)
        y = 76 + line * (cell_h + 14)
        asset = row["asset"]
        draw.text((x, y), SHORT_NAMES.get(asset["name"], asset["name"]), font=font(10, True), fill=TEXT)
        draw.text((x, y + 13), kind_label(asset), font=font(8), fill=MUTED)
        for j, finalist in enumerate(row["finalists"]):
            image = flatten(finalist["path"], image_px)
            ix = x + j * (image_px + 10)
            iy = y + 26
            sheet.paste(image, (ix, iy))
            selected_candidate = finalist["candidate"] == row["recommended"]
            draw.rectangle([ix - 1, iy - 1, ix + image_px, iy + image_px],
                           outline=GOLD if selected_candidate else "#2b3440", width=2)
            if selected_candidate:
                draw.text((ix + image_px - 3, iy + 1), "★", font=font(13, True), fill=GOLD2, anchor="ra")
            draw.text((ix, iy + image_px + 4), "AB"[j], font=font(8, True), fill=TEXT)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path, "JPEG", quality=92, subsample=0, optimize=True)
    return sheet.size


def build_boss_sheet(out_path: Path, image_px: int, title: str, note: str):
    cols, gap = 4, 24 if image_px >= 512 else 18
    width = cols * image_px + (cols + 1) * gap
    height = 86 + image_px + (54 if image_px >= 512 else 38)
    sheet = Image.new("RGB", (width, height), SHEET_BG)
    draw = ImageDraw.Draw(sheet)
    draw.text((gap, 18), title, font=font(26 if image_px >= 512 else 20, True), fill=TEXT)
    draw.text((gap, 50), note, font=font(13 if image_px >= 512 else 9), fill=MUTED)
    for index, (rank, label, cut) in enumerate(BOSS_RANKS):
        x = gap + index * (image_px + gap)
        y = 86
        image = flatten_tile(render_rank_boss_v2(rank, out_size=image_px), image_px)
        sheet.paste(image, (x, y))
        draw.rectangle([x - 1, y - 1, x + image_px, y + image_px], outline=GOLD, width=2)
        draw.text((x, y + image_px + 5), label, font=font(14 if image_px >= 512 else 10, True), fill=TEXT)
        draw.text((x, y + image_px + (23 if image_px >= 512 else 18)), cut,
                  font=font(11 if image_px >= 512 else 8), fill=MUTED)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path, "JPEG", quality=92, subsample=0, optimize=True)
    return sheet.size


def write_index(out_dir: Path, sheets: dict, boss_sheets: dict):
    def block(group: str, label: str, anchor: str, note: str) -> str:
        data = sheets[group]
        return f"""
<section id="{anchor}">
  <h2>{label}</h2>
  <p>{note}</p>
  <h3>Hires — 512 px per candidate</h3>
  <a href="{data['hires']['file']}"><img class="shot" src="{data['hires']['file']}" alt="{label} hires sheet"></a>
  <p class="dim">{data['hires']['size'][0]}×{data['hires']['size'][1]}</p>
  <h3>200 px thumbnail</h3>
  <a href="{data['200']['file']}"><img class="shot" src="{data['200']['file']}" alt="{label} 200 px sheet"></a>
  <p class="dim">{data['200']['size'][0]}×{data['200']['size'][1]}</p>
  <h3>96 px card-size stress test</h3>
  <a href="{data['96']['file']}"><img class="shot small" src="{data['96']['file']}" alt="{label} 96 px sheet"></a>
  <p class="dim">{data['96']['size'][0]}×{data['96']['size'][1]} — view at 100%</p>
</section>"""

    boss_block = f"""
<section id="bosses">
  <h2>Rank bosses — F1 6 o'clock</h2>
  <p>Bronze round · Silver octagon · Gold hexagon · Mithril star + halo. The rank label on the card is authoritative; the boss is the visual cue. Rank rings are retired and not included.</p>
  <h3>Hires — 512 px boss</h3>
  <a href="{boss_sheets['hires']['file']}"><img class="shot" src="{boss_sheets['hires']['file']}" alt="Rank bosses hires sheet"></a>
  <p class="dim">{boss_sheets['hires']['size'][0]}×{boss_sheets['hires']['size'][1]}</p>
  <h3>200 px thumbnail</h3>
  <a href="{boss_sheets['200']['file']}"><img class="shot" src="{boss_sheets['200']['file']}" alt="Rank bosses 200 px sheet"></a>
  <p class="dim">{boss_sheets['200']['size'][0]}×{boss_sheets['200']['size'][1]}</p>
  <h3>96 px card-size stress test</h3>
  <a href="{boss_sheets['96']['file']}"><img class="shot small" src="{boss_sheets['96']['file']}" alt="Rank bosses 96 px sheet"></a>
  <p class="dim">{boss_sheets['96']['size'][0]}×{boss_sheets['96']['size'][1]} — view at 100%</p>
  <p>Boss-on-frame matrix: <a href="rank-bosses-on-frames/index.html">open the six-frame × four-rank sheets</a>. In-context comparison: <a href="../rank-boss-v2.jpg">rank-boss-v2.jpg</a>.</p>
</section>"""

    html = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Badge finalist review — sheets</title>
<style>
  body{{margin:0;background:#0b0f14;color:#e6edf3;font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}}
  header{{padding:28px 24px 18px;border-bottom:1px solid #2b3440;background:linear-gradient(180deg,#111821,#0b0f14)}}
  h1{{margin:0 0 6px;font-size:28px}} h2{{margin:0 0 8px;color:#ffe8a3;font-size:24px}}
  h3{{margin:22px 0 8px;color:#e6edf3;font-size:16px}}
  p{{max-width:1000px;color:#8b94a7}} a{{color:#ffe8a3}}
  .dim{{font-size:12px;color:#8b94a7;margin:4px 0 0}}
  nav{{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}}
  nav a{{border:1px solid #2b3440;background:#111821;border-radius:999px;padding:6px 12px;text-decoration:none;font-size:13px}}
  main{{max-width:1600px;margin:0 auto;padding:24px}}
  section{{margin:0 0 36px;border-top:1px solid #2b3440;padding-top:24px}}
  section:first-child{{border-top:0;padding-top:0}}
  .shot{{display:block;max-width:100%;height:auto;border:1px solid #2b3440;border-radius:10px;background:#0d1117}}
  .small{{width:auto;max-width:100%}}
  footer{{border-top:1px solid #2b3440;padding:18px 24px 40px;color:#8b94a7;font-size:13px}}
</style></head><body>
<header><h1>Badge finalist review — sheets</h1>
<p>The sheets are the primary review. <b>Hires</b> is 512 px per candidate / per boss; <b>200</b> is the minimum thumbnail; <b>96</b> is the card-size stress test. Native 1024 badge/frame files are in <code>1024/</code> for full-detail inspection.</p>
<nav><a href="#emblems">Emblems</a><a href="#frames">Family frames</a><a href="#bosses">Rank bosses</a><a href="1024/">Native 1024 files</a><a href="200/">200 px files</a><a href="96/">96 px files</a><a href="README.md">README</a></nav></header>
<main>
{block("emblem", "Emblems — 15 achievements", "emblems", "Two finalist candidates per achievement. 512 px per candidate on the hires sheet; 200 px is the production thumbnail minimum; 96 px is the stress test.")}
{block("frame", "Family frames — 6 borders", "frames", "The reusable border families. These are not achievements; they are the chrome that sits around the emblem.")}
{boss_block}
</main>
<footer>42 badge/frame finalists + 4 rank bosses. All review images are flattened onto #14181f. Production 512 px mains remain in <code>reports/badge-art/finalists/</code>; native 1024 files are for inspection.</footer>
</body></html>"""
    (out_dir / "index.html").write_text(html, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", type=Path, default=REPORT / "review-sizes")
    args = parser.parse_args()
    out_dir = args.out_dir
    rows = load_data()
    export(rows, out_dir)
    export_bosses(out_dir)

    # Remove retired rank-ring individual files and old sheets, if present.
    for size in SIZES:
        for rank in ("bronze", "silver", "gold", "mithril"):
            for path in (out_dir / str(size)).glob(f"{rank}--*.webp"):
                path.unlink()
    for path in out_dir.glob("ranks-*-sheet.jpg"):
        path.unlink()

    sheets = {
        "emblem": {
            "hires": {"file": "emblems-hires-sheet.jpg",
                       "size": build_group_sheet(rows, out_dir / "emblems-hires-sheet.jpg", "emblem", 512, 3, 24, 60,
                                                 "Emblem finalists — 15 achievements",
                                                 "Two candidates each · 512 px · ★ = recommended · A/B under each image")},
            "200": {"file": "emblems-200-sheet.jpg",
                    "size": build_group_sheet(rows, out_dir / "emblems-200-sheet.jpg", "emblem", 200, 3, 20, 52,
                                              "Emblem finalists — 15 achievements",
                                              "Two candidates each · 200 px thumbnail · ★ = recommended")},
            "96": {"file": "emblems-96-sheet.jpg",
                   "size": build_group_small_sheet(rows, out_dir / "emblems-96-sheet.jpg", "emblem", 3,
                                                   "Emblem finalists — 15 achievements",
                                                   "True 96 px card size · gold border + ★ = recommended")},
        },
        "frame": {
            "hires": {"file": "frames-hires-sheet.jpg",
                       "size": build_group_sheet(rows, out_dir / "frames-hires-sheet.jpg", "frame", 512, 2, 24, 60,
                                                 "Family frame finalists — 6 borders",
                                                 "Two candidates each · 512 px · ★ = recommended")},
            "200": {"file": "frames-200-sheet.jpg",
                    "size": build_group_sheet(rows, out_dir / "frames-200-sheet.jpg", "frame", 200, 3, 20, 52,
                                              "Family frame finalists — 6 borders",
                                              "Two candidates each · 200 px thumbnail · ★ = recommended")},
            "96": {"file": "frames-96-sheet.jpg",
                   "size": build_group_small_sheet(rows, out_dir / "frames-96-sheet.jpg", "frame", 3,
                                                   "Family frame finalists — 6 borders",
                                                   "True 96 px card size · gold border + ★ = recommended")},
        },
    }
    boss_sheets = {
        "hires": {"file": "rank-bosses-hires-sheet.jpg",
                  "size": build_boss_sheet(out_dir / "rank-bosses-hires-sheet.jpg", 512,
                                           "Rank bosses — F1 6 o'clock",
                                           "Bronze round · Silver octagon · Gold hexagon · Mithril star + halo")},
        "200": {"file": "rank-bosses-200-sheet.jpg",
                "size": build_boss_sheet(out_dir / "rank-bosses-200-sheet.jpg", 200,
                                         "Rank bosses — F1 6 o'clock",
                                         "Bronze round · Silver octagon · Gold hexagon · Mithril star + halo")},
        "96": {"file": "rank-bosses-96-sheet.jpg",
               "size": build_boss_sheet(out_dir / "rank-bosses-96-sheet.jpg", 96,
                                        "Rank bosses — F1 6 o'clock",
                                        "Card-size stress · Bronze / Silver / Gold / Mithril")},
    }
    write_index(out_dir, sheets, boss_sheets)
    readme = [
        "# Finalist review sizes",
        "",
        "**Start with `index.html` or the sheets below.** The sheets are the primary review; the individual files are for inspection.",
        "",
        "| Folder | Size | Use |",
        "|---|---|---|",
        "| `1024/` | 1024×1024 | native emblems/frames, for full-detail inspection |",
        "| `200/` | 200×200 | production thumbnail minimum |",
        "| `96/` | 96×96 | card-size stress test only — very small |",
        "| `rank-bosses/512/` | 512×512 | high-res F1 rank boss |",
        "| `rank-bosses/200/` | 200×200 | thumbnail boss |",
        "| `rank-bosses/96/` | 96×96 | card-size boss |",
        "",
        "The production 512 px main images remain in `reports/badge-art/finalists/`; they are not duplicated here.",
        "",
        "## Sheets (primary)",
        "",
        "### Emblems",
        f"- `emblems-hires-sheet.jpg` — {sheets['emblem']['hires']['size'][0]}×{sheets['emblem']['hires']['size'][1]}, 15 achievements, 512 px per candidate.",
        f"- `emblems-200-sheet.jpg` — {sheets['emblem']['200']['size'][0]}×{sheets['emblem']['200']['size'][1]}, 200 px.",
        f"- `emblems-96-sheet.jpg` — {sheets['emblem']['96']['size'][0]}×{sheets['emblem']['96']['size'][1]}, 96 px.",
        "",
        "### Family frames (borders)",
        f"- `frames-hires-sheet.jpg` — {sheets['frame']['hires']['size'][0]}×{sheets['frame']['hires']['size'][1]}, 6 borders, 512 px per candidate.",
        f"- `frames-200-sheet.jpg` — {sheets['frame']['200']['size'][0]}×{sheets['frame']['200']['size'][1]}, 200 px.",
        f"- `frames-96-sheet.jpg` — {sheets['frame']['96']['size'][0]}×{sheets['frame']['96']['size'][1]}, 96 px.",
        "",
        "### Rank bosses — F1",
        f"- `rank-bosses-hires-sheet.jpg` — {boss_sheets['hires']['size'][0]}×{boss_sheets['hires']['size'][1]}, 4 bosses, 512 px each.",
        f"- `rank-bosses-200-sheet.jpg` — {boss_sheets['200']['size'][0]}×{boss_sheets['200']['size'][1]}, 200 px.",
        f"- `rank-bosses-96-sheet.jpg` — {boss_sheets['96']['size'][0]}×{boss_sheets['96']['size'][1]}, 96 px.",
        "",
        "Rank rings are retired and are not included. Boss-on-frame sheets: `rank-bosses-on-frames/index.html`. In-context F1 comparison: `../rank-boss-v2.jpg`.",
        "",
        "The individual files are `<slug>--<candidate>.webp` for emblems/frames and `<rank>.webp` for bosses; the recommended candidate is marked in the pair sheets.",
        "",
        "All images are flattened onto `#14181f` for review. Production exports preserve alpha separately.",
        "",
    ]
    (out_dir / "README.md").write_text("\n".join(readme), encoding="utf-8")
    print(f"exported {len(rows)} badge/frame assets / {sum(len(r['finalists']) for r in rows)} finalists + 4 rank bosses")
    for group in ("emblem", "frame"):
        print(group, {k: v["size"] for k, v in sheets[group].items()})
    print("bosses", {k: v["size"] for k, v in boss_sheets.items()})
    print(out_dir)


if __name__ == "__main__":
    main()
