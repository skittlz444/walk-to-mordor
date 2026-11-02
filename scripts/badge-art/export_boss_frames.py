#!/usr/bin/env python3
"""Rank bosses on the six family frames — the F1 interaction test.

For each family frame x rank boss, composite the selected frame and the v2
boss at the 6 o'clock position, with no emblem. The final badge adds the
emblem inside the frame; this sheet isolates the boss/frame relationship.

Outputs:
  review-sizes/rank-bosses-on-frames/{1024,512,200,96}/<frame>--<rank>.webp
  review-sizes/rank-bosses-on-frames-hires-sheet.jpg   (400 px full frames)
  review-sizes/rank-bosses-on-frames-detail-sheet.jpg  (180 px boss-area crops)
  review-sizes/rank-bosses-on-frames-200-sheet.jpg
  review-sizes/rank-bosses-on-frames-96-sheet.jpg
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
REPORT = REPO / "reports" / "badge-art"
SHORTLIST = REPORT / "shortlist.json"
PROMPTS = HERE / "prompts.json"
PROCESSED = REPO / "raw_assets" / "badges" / "processed"
PHOTOCRAFT = REPO / "raw_assets" / "badges" / "boss-frames" / "photocraft"
OUT = REPORT / "review-sizes"
BG = "#14181f"
SHEET_BG = "#0d1117"
GOLD = "#d4a017"
TEXT = "#e6edf3"
MUTED = "#8b94a7"
FRAME_IDS = (
    "frame/journey",
    "frame/habit",
    "frame/challenge",
    "frame/book",
    "frame/community",
    "frame/field-guide",
)
FRAME_SHORT = {
    "frame/journey": "Journey",
    "frame/habit": "Habit",
    "frame/challenge": "Challenge",
    "frame/book": "Book",
    "frame/community": "Community",
    "frame/field-guide": "Field Guide",
}
RANKS = (
    ("bronze", "Bronze"),
    ("silver", "Silver"),
    ("gold", "Gold"),
    ("mithril", "Mithril"),
)
SIZES = (1024, 512, 200, 96)


def font(size: int, bold: bool = False):
    path = "/usr/share/fonts/truetype/dejavu/" + ("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf")
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def load_frames():
    prompts = json.loads(PROMPTS.read_text())
    shortlist = json.loads(SHORTLIST.read_text())
    assets = {a["id"]: a for a in prompts["assets"]}
    frames = []
    for frame_id in FRAME_IDS:
        asset = assets[frame_id]
        entry = shortlist["assets"][frame_id]
        candidate = entry["recommended"]
        path = PROCESSED / frame_id / f"{candidate}.png"
        if not path.is_file():
            raise FileNotFoundError(path)
        frames.append({"id": frame_id, "asset": asset, "path": path, "candidate": candidate})
    return frames


def compose(frame: dict, rank: str) -> Image.Image:
    """Load the PhotoCraft-composited frame + boss and flatten for review."""
    path = PHOTOCRAFT / f"{frame['asset']['slug']}--{rank}.png"
    if not path.is_file():
        raise FileNotFoundError(
            f"missing PhotoCraft composite {path}; run the MCP compositing step first"
        )
    with Image.open(path) as opened:
        image = opened.convert("RGBA")
    background = Image.new("RGBA", (1024, 1024), BG)
    background.alpha_composite(image)
    return background.convert("RGB")


def detail(image: Image.Image, px: int) -> Image.Image:
    cx, half = 511, 120
    # Stay inside the 1024 canvas; the boss sits near the bottom edge.
    top = 1024 - 2 * half
    crop = image.crop((cx - half, top, cx + half, top + 2 * half))
    return crop.resize((px, px), Image.LANCZOS)


def export(frames):
    for size in SIZES:
        directory = OUT / "rank-bosses-on-frames" / str(size)
        directory.mkdir(parents=True, exist_ok=True)
        for frame in frames:
            for rank, _ in RANKS:
                image = compose(frame, rank)
                if size != 1024:
                    image = image.resize((size, size), Image.LANCZOS)
                image.save(directory / f"{frame['asset']['slug']}--{rank}.webp",
                           "WEBP", quality=92, method=6)


def build_matrix(frames, out_path: Path, px: int, detail_mode: bool, title: str, note: str):
    cols, rows = len(frames), len(RANKS)
    left_w = 116 if px >= 180 else 92
    gap, header = 10, 70
    width = left_w + cols * px + (cols - 1) * gap + 2 * gap
    height = header + rows * px + (rows - 1) * gap + 2 * gap
    sheet = Image.new("RGB", (width, height), SHEET_BG)
    draw = ImageDraw.Draw(sheet)
    draw.text((gap, 12), title, font=font(24 if px >= 180 else 15, True), fill=TEXT)
    draw.text((gap, 40), note, font=font(11 if px >= 180 else 7), fill=MUTED)
    for c, frame in enumerate(frames):
        x = left_w + c * (px + gap)
        label = FRAME_SHORT[frame["id"]]
        draw.text((x + px / 2, header - 14), label,
                  font=font(11 if px >= 180 else 7, True), fill=TEXT, anchor="ms")
    for r, (rank, rank_label) in enumerate(RANKS):
        y = header + r * (px + gap)
        draw.text((gap, y + px / 2), rank_label,
                  font=font(12 if px >= 180 else 8, True), fill=TEXT, anchor="lm")
        for c, frame in enumerate(frames):
            x = left_w + c * (px + gap)
            image = compose(frame, rank)
            if detail_mode:
                image = detail(image, px)
            else:
                image = image.resize((px, px), Image.LANCZOS)
            sheet.paste(image, (x, y))
            draw.rectangle([x - 1, y - 1, x + px, y + px], outline="#2b3440", width=1)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path, "JPEG", quality=92, subsample=0, optimize=True)
    return sheet.size


def write_subindex(sheets):
    html = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rank bosses on family frames — F1</title>
<style>
  body{{margin:0;background:#0b0f14;color:#e6edf3;font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}}
  header{{padding:26px 24px 18px;border-bottom:1px solid #2b3440;background:linear-gradient(180deg,#111821,#0b0f14)}}
  h1{{margin:0 0 6px;font-size:27px}} h2{{margin:0 0 8px;color:#ffe8a3;font-size:22px}}
  p{{max-width:1000px;color:#8b94a7}} a{{color:#ffe8a3}}
  nav{{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}}
  nav a{{border:1px solid #2b3440;background:#111821;border-radius:999px;padding:6px 12px;text-decoration:none;font-size:13px}}
  main{{max-width:1600px;margin:0 auto;padding:24px}}
  section{{margin:0 0 34px}} .shot{{display:block;max-width:100%;height:auto;border:1px solid #2b3440;border-radius:10px;background:#0d1117}}
  .small{{width:auto;max-width:100%}} .dim{{font-size:12px;color:#8b94a7;margin:4px 0 0}}
  footer{{border-top:1px solid #2b3440;padding:18px 24px 40px;color:#8b94a7;font-size:13px}}
</style></head><body>
<header><h1>Rank bosses on family frames — F1</h1>
<p>Each family frame with each rank boss at 6 o'clock, <b>composited in PhotoCraft</b>. No emblem: the final badge adds the emblem inside the frame. Use the detail sheet to judge the boss against each frame's band.</p>
<nav><a href="#hires">Hires full frames</a><a href="#detail">Boss detail</a><a href="#thumb">200 px</a><a href="#card">96 px</a><a href="../index.html">All review sheets</a><a href="1024/">Native 1024 files</a><a href="README.md">README</a></nav></header>
<main>
<section id="hires"><h2>Full frame matrix — 400 px</h2><p>{sheets['hires']['size'][0]}×{sheets['hires']['size'][1]}; six frames × four ranks.</p><a href="../rank-bosses-on-frames-hires-sheet.jpg"><img class="shot" src="../rank-bosses-on-frames-hires-sheet.jpg" alt="Rank bosses on family frames, full matrix"></a></section>
<section id="detail"><h2>Boss-area detail — 180 px crops</h2><p>{sheets['detail']['size'][0]}×{sheets['detail']['size'][1]}; the 6 o'clock band and boss, enlarged from the 1024 PhotoCraft composite.</p><a href="../rank-bosses-on-frames-detail-sheet.jpg"><img class="shot" src="../rank-bosses-on-frames-detail-sheet.jpg" alt="Rank bosses on family frames, detail"></a></section>
<section id="thumb"><h2>200 px thumbnail</h2><p>{sheets['200']['size'][0]}×{sheets['200']['size'][1]}; the production thumbnail minimum.</p><a href="../rank-bosses-on-frames-200-sheet.jpg"><img class="shot" src="../rank-bosses-on-frames-200-sheet.jpg" alt="Rank bosses on family frames, 200 px"></a></section>
<section id="card"><h2>96 px card-size stress test</h2><p>{sheets['96']['size'][0]}×{sheets['96']['size'][1]}; view at 100%.</p><a href="../rank-bosses-on-frames-96-sheet.jpg"><img class="shot small" src="../rank-bosses-on-frames-96-sheet.jpg" alt="Rank bosses on family frames, 96 px"></a></section>
</main>
<footer>24 composites · PhotoCraft MCP · frame + boss only. The full badge with emblem is in <code>../composites/circle-f1v2/</code> and <code>../rank-boss-v2.jpg</code>.</footer>
</body></html>"""
    (OUT / "rank-bosses-on-frames" / "index.html").write_text(html, encoding="utf-8")


def main():
    frames = load_frames()
    missing = [
        f"{frame['asset']['slug']}--{rank}"
        for frame in frames
        for rank, _ in RANKS
        if not (PHOTOCRAFT / f"{frame['asset']['slug']}--{rank}.png").is_file()
    ]
    if missing:
        raise SystemExit(
            "Missing PhotoCraft composites: " + ", ".join(missing)
            + "\nRun the MCP compositing step first."
        )
    export(frames)
    sheets = {
        "hires": {"file": "rank-bosses-on-frames-hires-sheet.jpg",
                  "size": build_matrix(frames, OUT / "rank-bosses-on-frames-hires-sheet.jpg", 400, False,
                                       "Rank bosses on family frames — F1",
                                       "Frame + boss only · 400 px · the emblem sits inside the frame in the final composite")},
        "detail": {"file": "rank-bosses-on-frames-detail-sheet.jpg",
                   "size": build_matrix(frames, OUT / "rank-bosses-on-frames-detail-sheet.jpg", 180, True,
                                        "Boss area detail — 180 px crops",
                                        "6 o'clock boss + frame band · six family frames × four rank bosses")},
        "200": {"file": "rank-bosses-on-frames-200-sheet.jpg",
                "size": build_matrix(frames, OUT / "rank-bosses-on-frames-200-sheet.jpg", 200, False,
                                     "Rank bosses on family frames — 200 px",
                                     "Thumbnail size · frame + boss only")},
        "96": {"file": "rank-bosses-on-frames-96-sheet.jpg",
               "size": build_matrix(frames, OUT / "rank-bosses-on-frames-96-sheet.jpg", 96, False,
                                    "Rank bosses on family frames — 96 px",
                                    "Card-size stress · frame + boss only")},
    }
    readme = [
        "# Rank bosses on family frames",
        "",
        "The F1 interaction test: each family frame with each rank boss at 6 o'clock, composited in PhotoCraft MCP.",
        "No emblem, so the boss/frame relationship is isolated. The final badge adds the emblem inside the frame.",
        "",
        "## Sheets",
        "",
        f"- `../rank-bosses-on-frames-hires-sheet.jpg` — {sheets['hires']['size'][0]}×{sheets['hires']['size'][1]}, 400 px full frames.",
        f"- `../rank-bosses-on-frames-detail-sheet.jpg` — {sheets['detail']['size'][0]}×{sheets['detail']['size'][1]}, 180 px boss-area crops.",
        f"- `../rank-bosses-on-frames-200-sheet.jpg` — {sheets['200']['size'][0]}×{sheets['200']['size'][1]}, 200 px.",
        f"- `../rank-bosses-on-frames-96-sheet.jpg` — {sheets['96']['size'][0]}×{sheets['96']['size'][1]}, 96 px.",
        "",
        "## Individual files",
        "",
        "`1024/`, `512/`, `200/`, `96/` with `<frame>--<rank>.webp`.",
        "",
        "All images are flattened onto `#14181f`. The full badge with emblem is in `../composites/circle-f1v2/` and `../rank-boss-v2.jpg`.",
        "",
    ]
    (OUT / "rank-bosses-on-frames").mkdir(parents=True, exist_ok=True)
    (OUT / "rank-bosses-on-frames" / "README.md").write_text("\n".join(readme), encoding="utf-8")
    write_subindex(sheets)
    print(f"exported {len(frames)} frames x {len(RANKS)} ranks = {len(frames) * len(RANKS)} PhotoCraft composites")
    for key, value in sheets.items():
        print(key, value["file"], value["size"])
    print(OUT / "rank-bosses-on-frames")


if __name__ == "__main__":
    main()
