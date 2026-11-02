#!/usr/bin/env python3
"""Export finalist review images at native, production and actual-card sizes.

Sizes:
  1024 - native processed master (zoom in)
   512 - production main image
   200 - production thumbnail
    96 - actual grid card size

Also builds:
  emblems-1024-sheet.jpg - 15 achievements, two candidates at 420 px
  emblems-96-sheet.jpg   - 15 achievements, two candidates at 96 px
"""
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

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
RANK = {1: "Bronze", 2: "Silver", 3: "Gold", 4: "Mithril"}
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


def flatten(path: Path, size: int) -> Image.Image:
    with Image.open(path) as opened:
        image = opened.convert("RGBA")
    canvas = Image.new("RGBA", (1024, 1024), BG)
    canvas.alpha_composite(image)
    if size != 1024:
        canvas = canvas.resize((size, size), Image.LANCZOS)
    return canvas.convert("RGB")


def load_data():
    prompts = json.loads(PROMPTS.read_text())
    shortlist = json.loads(SHORTLIST.read_text())
    assets = {a["id"]: a for a in prompts["assets"]}
    rows = []
    for asset_id, entry in shortlist["assets"].items():
        asset = assets[asset_id]
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


def build_sheet(rows, out_path: Path, image_px: int, cols: int, gap: int, label_h: int):
    emblems = [r for r in rows if r["asset"]["group"] == "emblem"]
    rows_n = (len(emblems) + cols - 1) // cols
    cell_w = image_px * 2 + 16
    cell_h = image_px + label_h
    width = cols * cell_w + (cols + 1) * gap
    height = 86 + rows_n * (cell_h + 18) + gap
    sheet = Image.new("RGB", (width, height), SHEET_BG)
    draw = ImageDraw.Draw(sheet)
    draw.text((gap, 18), f"Emblem finalists — {len(emblems)} achievements", font=font(26, True), fill=TEXT)
    draw.text((gap, 50), f"Two candidates each · {image_px} px · ★ = recommended · A/B labels under each image",
              font=font(13), fill=MUTED)
    for index, row in enumerate(emblems):
        col, line = index % cols, index // cols
        x = gap + col * (cell_w + gap)
        y = 86 + line * (cell_h + 18)
        asset = row["asset"]
        draw.text((x, y), asset["name"], font=font(15, True), fill=TEXT)
        draw.text((x, y + 21), f"{rank_text(asset)} · {asset['family']}", font=font(11), fill=MUTED)
        for j, finalist in enumerate(row["finalists"]):
            image = flatten(finalist["path"], image_px)
            ix = x + j * (image_px + 16)
            iy = y + 40
            sheet.paste(image, (ix, iy))
            selected = finalist["candidate"] == row["recommended"]
            border = GOLD if selected else "#2b3440"
            draw.rectangle([ix - 2, iy - 2, ix + image_px + 1, iy + image_px + 1], outline=border, width=2)
            letter = "AB"[j]
            draw.text((ix, iy + image_px + 5), f"{letter} · {finalist['candidate']}",
                      font=font(10, True), fill=TEXT)
            if selected:
                draw.text((ix + image_px - 4, iy + image_px + 5), "★ Recommended",
                          font=font(10, True), fill=GOLD2, anchor="ra")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path, "JPEG", quality=92, subsample=0, optimize=True)
    return sheet.size


def build_small_sheet(rows, out_path: Path):
    """True 96 px card-size sheet: short names, no crowded recommendation text."""
    emblems = [r for r in rows if r["asset"]["group"] == "emblem"]
    cols, gap, image_px = 3, 14, 96
    cell_w = image_px * 2 + 10
    cell_h = 20 + image_px + 26
    rows_n = (len(emblems) + cols - 1) // cols
    width = cols * cell_w + (cols + 1) * gap
    height = 76 + rows_n * (cell_h + 14) + gap
    sheet = Image.new("RGB", (width, height), SHEET_BG)
    draw = ImageDraw.Draw(sheet)
    draw.text((gap, 16), f"Emblem finalists — {len(emblems)} achievements", font=font(22, True), fill=TEXT)
    draw.text((gap, 45), "True 96 px card size · gold border + ★ = recommended · A/B under each image",
              font=font(10), fill=MUTED)
    for index, row in enumerate(emblems):
        col, line = index % cols, index // cols
        x = gap + col * (cell_w + gap)
        y = 76 + line * (cell_h + 14)
        asset = row["asset"]
        draw.text((x, y), SHORT_NAMES.get(asset["name"], asset["name"]), font=font(10, True), fill=TEXT)
        draw.text((x, y + 13), f"{rank_text(asset)} · {asset['family']}", font=font(8), fill=MUTED)
        for j, finalist in enumerate(row["finalists"]):
            image = flatten(finalist["path"], image_px)
            ix = x + j * (image_px + 10)
            iy = y + 26
            sheet.paste(image, (ix, iy))
            selected = finalist["candidate"] == row["recommended"]
            draw.rectangle([ix - 1, iy - 1, ix + image_px, iy + image_px], outline=GOLD if selected else "#2b3440", width=2)
            if selected:
                draw.text((ix + image_px - 3, iy + 1), "★", font=font(13, True), fill=GOLD2, anchor="ra")
            draw.text((ix, iy + image_px + 4), "AB"[j], font=font(8, True), fill=TEXT)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path, "JPEG", quality=92, subsample=0, optimize=True)
    return sheet.size


def write_index(out_dir: Path, large, mid, small):
    html = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Badge finalist review — sheets</title>
<style>
  body{{margin:0;background:#0b0f14;color:#e6edf3;font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}}
  header{{padding:28px 24px 18px;border-bottom:1px solid #2b3440;background:linear-gradient(180deg,#111821,#0b0f14)}}
  h1{{margin:0 0 6px;font-size:28px}} h2{{margin:0 0 8px;color:#ffe8a3;font-size:22px}}
  p{{max-width:1000px;color:#8b94a7}} a{{color:#ffe8a3}}
  nav{{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}}
  nav a{{border:1px solid #2b3440;background:#111821;border-radius:999px;padding:6px 12px;text-decoration:none;font-size:13px}}
  main{{max-width:1600px;margin:0 auto;padding:24px}}
  section{{margin:0 0 34px}} .shot{{display:block;max-width:100%;height:auto;border:1px solid #2b3440;border-radius:10px;background:#0d1117}}
  .small{{width:auto;max-width:100%}}
  footer{{border-top:1px solid #2b3440;padding:18px 24px 40px;color:#8b94a7;font-size:13px}}
</style></head><body>
<header><h1>Badge finalist review — sheets</h1>
<p>The sheets are the primary review. <b>Hires</b> is 512 px per candidate; <b>200</b> is the minimum thumbnail; <b>96</b> is the card-size stress test. Native 1024 files are in <code>1024/</code> for full-emblem inspection.</p>
<nav><a href="#hires">Hires sheet</a><a href="#thumb">200 px sheet</a><a href="#card">96 px sheet</a><a href="1024/">Native 1024 files</a><a href="200/">200 px files</a><a href="96/">96 px files</a><a href="README.md">README</a></nav></header>
<main>
<section id="hires"><h2>Hires sheet — 512 px per candidate</h2><p>{large[0]}×{large[1]}; 15 achievements, two candidates each. Click the image to open it at full size.</p><a href="emblems-hires-sheet.jpg"><img class="shot" src="emblems-hires-sheet.jpg" alt="Hires emblem finalists sheet"></a></section>
<section id="thumb"><h2>200 px thumbnail sheet</h2><p>{mid[0]}×{mid[1]}; the minimum thumbnail size. Click to open full size.</p><a href="emblems-200-sheet.jpg"><img class="shot" src="emblems-200-sheet.jpg" alt="200 px emblem finalists sheet"></a></section>
<section id="card"><h2>96 px card-size sheet</h2><p>{small[0]}×{small[1]}; shown at natural size where possible. This is the stress test, not the recommended minimum.</p><a href="emblems-96-sheet.jpg"><img class="shot small" src="emblems-96-sheet.jpg" alt="96 px emblem finalists sheet"></a></section>
</main>
<footer>50 finalists / 25 assets. All review images are flattened onto #14181f. Production 512 px mains remain in <code>reports/badge-art/finalists/</code>; native 1024 files are only for inspection.</footer>
</body></html>"""
    (out_dir / "index.html").write_text(html, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", type=Path, default=REPORT / "review-sizes")
    args = parser.parse_args()
    out_dir = args.out_dir
    rows = load_data()
    export(rows, out_dir)
    large = build_sheet(rows, out_dir / "emblems-hires-sheet.jpg", 512, 3, 24, 60)
    mid = build_sheet(rows, out_dir / "emblems-200-sheet.jpg", 200, 3, 20, 52)
    small = build_small_sheet(rows, out_dir / "emblems-96-sheet.jpg")
    write_index(out_dir, large, mid, small)
    readme = [
        "# Finalist review sizes",
        "",
        "**Start with `index.html` or the sheets below.** The sheets are the primary review; the individual files are for inspection.",
        "",
        "| Folder | Size | Use |",
        "|---|---|---|",
        "| `1024/` | 1024×1024 | native processed master, for full-emblem inspection |",
        "| `200/` | 200×200 | production thumbnail minimum |",
        "| `96/` | 96×96 | card-size stress test only — very small |",
        "",
        "The production 512 px main images remain in `reports/badge-art/finalists/` (and become `public/img/achievements/` later); they are not duplicated here.",
        "",
        "## Sheets (primary)",
        "",
        f"- `emblems-hires-sheet.jpg` — {large[0]}×{large[1]}, 15 achievements, two candidates at 512 px.",
        f"- `emblems-200-sheet.jpg` — {mid[0]}×{mid[1]}, 15 achievements, two candidates at 200 px.",
        f"- `emblems-96-sheet.jpg` — {small[0]}×{small[1]}, 15 achievements, two candidates at 96 px.",
        "",
        "The individual files are `<slug>--<candidate>.webp`; the recommended candidate is marked in the pair sheets.",
        "",
        "All images are flattened onto `#14181f` for review. Production exports preserve alpha separately.",
        "",
    ]
    (out_dir / "README.md").write_text("\n".join(readme), encoding="utf-8")
    print(f"exported {len(rows)} assets / {sum(len(r['finalists']) for r in rows)} finalists")
    print(f"large sheet {large}, small sheet {small}")
    print(out_dir)


if __name__ == "__main__":
    main()
