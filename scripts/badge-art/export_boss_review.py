#!/usr/bin/env python3
"""Build the top-2 boss finalist and stamped-frame review set.

Reads the boss shortlist and the 48 PhotoCraft stamped composites; writes:
  boss-review/boss-finalists-hires-sheet.jpg (512 px art)
  boss-review/boss-finalists-96-sheet.jpg
  boss-review/boss-stamped-full-sheet.jpg (6 frames x 8 finalists)
  boss-review/boss-stamped-detail-sheet.jpg (boss-area crops)
  boss-review/finalists/{1024,512,200,96}/<rank>--<candidate>.webp
  boss-review/stamped/{1024,512,200,96}/<frame>--<rank>--<candidate>.webp
  boss-review/index.html
  boss-review/README.md
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
REPORT = REPO / "reports" / "badge-art"
OUT = REPORT / "boss-review"
SHORTLIST = REPORT / "boss-shortlist.json"
FINAL_SELECTIONS = REPORT / "final-selections.json"
PROMPTS = HERE / "prompts.json"
PROCESSED = REPO / "raw_assets" / "badges" / "bosses" / "processed"
STAMPED = REPO / "raw_assets" / "badges" / "boss-frames" / "shortlist"
BG = "#14181f"
SHEET_BG = "#0d1117"
GOLD = "#d4a017"
GOLD2 = "#ffe8a3"
TEXT = "#e6edf3"
MUTED = "#8b94a7"
RANKS = ("bronze", "silver", "gold", "mithril")
FRAMES = ("journey", "habit", "challenge", "book", "community", "field-guide")
FRAME_NAMES = {
    "journey": "Journey", "habit": "Habit", "challenge": "Challenge",
    "book": "Book", "community": "Community", "field-guide": "Field Guide",
}


def font(size: int, bold: bool = False):
    path = "/usr/share/fonts/truetype/dejavu/" + ("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf")
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def flatten(path: Path, size: int) -> Image.Image:
    with Image.open(path) as opened:
        image = opened.convert("RGBA")
    canvas = Image.new("RGBA", (1024, 1024), BG)
    canvas.alpha_composite(image)
    if size != 1024:
        canvas = canvas.resize((size, size), Image.LANCZOS)
    return canvas.convert("RGB")


def load():
    data = json.loads(SHORTLIST.read_text())["ranks"]
    final = json.loads(FINAL_SELECTIONS.read_text())
    frames = final["frames"]
    for rank in RANKS:
        entry = data[rank]
        if len(entry["finalists"]) != 2:
            raise ValueError(f"{rank}: expected 2 finalists")
        if entry["recommended"] not in {f["candidate"] for f in entry["finalists"]}:
            raise ValueError(f"{rank}: recommended not in finalists")
    for frame in FRAMES:
        if f"frame/{frame}" not in frames:
            raise ValueError(f"missing locked frame {frame}")
    missing = [
        f"{frame}--{rank}--{f['candidate']}"
        for frame in FRAMES for rank in RANKS for f in data[rank]["finalists"]
        if not (STAMPED / f"{frame}--{rank}--{f['candidate']}.png").is_file()
    ]
    if missing:
        raise FileNotFoundError("missing stamped composites: " + ", ".join(missing))
    return data, frames


def export_individuals(data):
    for size in (512, 200, 96):
        (OUT / "finalists" / str(size)).mkdir(parents=True, exist_ok=True)
    (OUT / "stamped" / "512").mkdir(parents=True, exist_ok=True)
    for rank in RANKS:
        for finalist in data[rank]["finalists"]:
            candidate = finalist["candidate"]
            source = PROCESSED / rank / f"{candidate}.png"
            image = Image.open(source).convert("RGBA")
            for size in (512, 200, 96):
                image.resize((size, size), Image.LANCZOS).save(
                    OUT / "finalists" / str(size) / f"{rank}--{candidate}.webp",
                    "WEBP", quality=90 if size == 512 else 86, method=4)
    for frame in FRAMES:
        for rank in RANKS:
            for finalist in data[rank]["finalists"]:
                candidate = finalist["candidate"]
                source = STAMPED / f"{frame}--{rank}--{candidate}.png"
                image = Image.open(source).convert("RGBA")
                image.resize((512, 512), Image.LANCZOS).save(
                    OUT / "stamped" / "512" / f"{frame}--{rank}--{candidate}.webp",
                    "WEBP", quality=90, method=4)


def build_finalist_sheet(data, out_path: Path, px: int):
    rows = len(RANKS)
    width = px * 2 + 60
    height = 74 + rows * (px + 60)
    sheet = Image.new("RGB", (width, height), SHEET_BG)
    draw = ImageDraw.Draw(sheet)
    draw.text((20, 14), "Handcrafted rank bosses — top 2 per rank", font=font(24 if px >= 512 else 16), fill=TEXT)
    draw.text((20, 44), f"{px} px boss art · A/B · ★ recommended", font=font(11 if px >= 512 else 8), fill=MUTED)
    for i, rank in enumerate(RANKS):
        y = 74 + i * (px + 60)
        draw.text((20, y + 4), rank.title(), font=font(13 if px >= 512 else 9, True), fill=GOLD2)
        for j, finalist in enumerate(data[rank]["finalists"]):
            candidate = finalist["candidate"]
            x = 20 + j * (px + 20)
            image = flatten(PROCESSED / rank / f"{candidate}.png", px)
            sheet.paste(image, (x, y + 20))
            rec = candidate == data[rank]["recommended"]
            draw.rectangle([x - 1, y + 19, x + px, y + 20 + px], outline=GOLD if rec else "#2b3440", width=2)
            label = f"{'AB'[j]} · {candidate} · {finalist['score']}"
            draw.text((x, y + 24 + px), label, font=font(9 if px < 512 else 11, True), fill=TEXT)
            if rec:
                draw.text((x + px, y + 24 + px), "★ Recommended", font=font(9 if px < 512 else 11, True),
                          fill=GOLD2, anchor="ra")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path, "JPEG", quality=92, subsample=0, optimize=True)
    return sheet.size


def build_stamped_sheet(data, out_path: Path, px: int, detail: bool):
    cols = 8
    left = 92
    header = 84
    gap = 8
    height = header + len(FRAMES) * (px + 22) + gap
    width = left + cols * px + (cols - 1) * gap + 2 * gap
    sheet = Image.new("RGB", (width, height), SHEET_BG)
    draw = ImageDraw.Draw(sheet)
    title = "Bosses stamped on the locked frames — boss-area detail" if detail else "Bosses stamped on the locked frames — full frame"
    draw.text((gap, 10), title, font=font(20 if px >= 180 else 13, True), fill=TEXT)
    draw.text((gap, 36), "Both finalists per rank · A/B · ★ recommended · 6 locked frames", font=font(10 if px >= 180 else 7), fill=MUTED)
    # column headers: rank + A/B + recommended star
    for rank_idx, rank in enumerate(RANKS):
        for j, finalist in enumerate(data[rank]["finalists"]):
            col = rank_idx * 2 + j
            x = left + col * (px + gap)
            rec = finalist["candidate"] == data[rank]["recommended"]
            draw.text((x + px / 2, header - 14), f"{rank.title()} {'AB'[j]}{' ★' if rec else ''}",
                      font=font(8 if px < 180 else 10, True), fill=GOLD2 if rec else TEXT, anchor="ms")
    for r, frame in enumerate(FRAMES):
        y = header + r * (px + 22)
        draw.text((gap, y + px / 2), FRAME_NAMES[frame], font=font(9 if px < 180 else 12, True), fill=TEXT, anchor="lm")
        for rank in RANKS:
            for j, finalist in enumerate(data[rank]["finalists"]):
                candidate = finalist["candidate"]
                col = RANKS.index(rank) * 2 + j
                x = left + col * (px + gap)
                image = flatten(STAMPED / f"{frame}--{rank}--{candidate}.png", 1024)
                if detail:
                    crop = image.crop((511 - 120, 1024 - 240, 511 + 120, 1024))
                    image = crop.resize((px, px), Image.LANCZOS)
                else:
                    image = image.resize((px, px), Image.LANCZOS)
                sheet.paste(image, (x, y))
                draw.rectangle([x - 1, y - 1, x + px, y + px], outline="#2b3440", width=1)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path, "JPEG", quality=92, subsample=0, optimize=True)
    return sheet.size


def write_index(data, sheets):
    rows = []
    for rank in RANKS:
        a, b = data[rank]["finalists"]
        rows.append(f"<tr><td>{rank.title()}</td><td><code>{a['candidate']}</code> · {a['score']}</td>"
                    f"<td><code>{b['candidate']}</code> · {b['score']}</td>"
                    f"<td><strong>{data[rank]['recommended']}</strong></td></tr>")
    html = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Handcrafted rank bosses — review</title>
<style>
  body{{margin:0;background:#0b0f14;color:#e6edf3;font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}}
  header{{padding:26px 24px 18px;border-bottom:1px solid #2b3440;background:linear-gradient(180deg,#111821,#0b0f14)}}
  h1{{margin:0 0 6px;font-size:28px}} h2{{margin:0 0 8px;color:#ffe8a3;font-size:22px}}
  p{{max-width:1000px;color:#8b94a7}} a{{color:#ffe8a3}}
  nav{{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}}
  nav a{{border:1px solid #2b3440;background:#111821;border-radius:999px;padding:6px 12px;text-decoration:none;font-size:13px}}
  main{{max-width:1700px;margin:0 auto;padding:24px}} section{{margin:0 0 34px}}
  .shot{{display:block;max-width:100%;height:auto;border:1px solid #2b3440;border-radius:10px;background:#0d1117}}
  table{{border-collapse:collapse;margin:12px 0;background:#14181f;border:1px solid #2b3440}}
  th,td{{padding:8px 12px;border-bottom:1px solid #2b3440;text-align:left;font-size:14px}} th{{color:#ffe8a3}}
  .dim{{font-size:12px;color:#8b94a7;margin:4px 0 0}}
  footer{{border-top:1px solid #2b3440;padding:18px 24px 40px;color:#8b94a7;font-size:13px}}
</style></head><body>
<header><h1>Handcrafted rank bosses — top 2 per rank</h1>
<p>Both finalists are stamped onto all six locked frames in PhotoCraft, with the contact shadow. Choose one boss per rank. The final badge adds the selected emblem inside the frame; the boss sits at 6 o'clock.</p>
<nav><a href="#finalists">Boss finalists</a><a href="#stamped">Stamped frames</a><a href="#detail">Boss detail</a><a href="finalists/512/">Boss art files</a><a href="stamped/512/">Stamped frame files</a><a href="README.md">README</a></nav></header>
<main>
<section id="finalists"><h2>Boss finalists</h2>
<table><tr><th>Rank</th><th>Finalist A</th><th>Finalist B</th><th>Recommended</th></tr>{''.join(rows)}</table>
<h3>512 px boss art</h3><a href="boss-finalists-hires-sheet.jpg"><img class="shot" src="boss-finalists-hires-sheet.jpg" alt="Boss finalists 512"></a>
</section>
<section id="stamped"><h2>Stamped on the locked frames</h2>
<p>Six frames × four ranks × two finalists. The recommended boss is marked ★ in the column header.</p>
<a href="boss-stamped-full-sheet.jpg"><img class="shot" src="boss-stamped-full-sheet.jpg" alt="Bosses stamped on frames, full"></a>
<p class="dim">{sheets['full'][0]}×{sheets['full'][1]}</p></section>
<section id="detail"><h2>Boss-area detail</h2>
<p>The 6 o'clock band and boss, cropped from each 1024 PhotoCraft composite.</p>
<a href="boss-stamped-detail-sheet.jpg"><img class="shot" src="boss-stamped-detail-sheet.jpg" alt="Bosses stamped on frames, detail"></a>
<p class="dim">{sheets['detail'][0]}×{sheets['detail'][1]}</p></section>
</main>
<footer>Top 2 per rank · 48 PhotoCraft stamped composites · frames locked · final emblem layer not included. Recommendations are the shortlist proposal; the dual reviews are in the folder.</footer>
</body></html>"""
    (OUT / "index.html").write_text(html, encoding="utf-8")


def main():
    data, frames = load()
    export_individuals(data)
    final_hires = build_finalist_sheet(data, OUT / "boss-finalists-hires-sheet.jpg", 512)
    full = build_stamped_sheet(data, OUT / "boss-stamped-full-sheet.jpg", 220, False)
    detail = build_stamped_sheet(data, OUT / "boss-stamped-detail-sheet.jpg", 180, True)
    write_index(data, {"full": full, "detail": detail})
    readme = [
        "# Handcrafted rank bosses — review",
        "",
        "Top 2 per rank, with recommendation. Both finalists are stamped onto all six locked frames in PhotoCraft with a contact shadow.",
        "",
        "## Sheets",
        f"- `boss-finalists-hires-sheet.jpg` — {final_hires[0]}×{final_hires[1]}, 512 px boss art.",
                f"- `boss-stamped-full-sheet.jpg` — {full[0]}×{full[1]}, 6 frames × 8 finalists.",
        f"- `boss-stamped-detail-sheet.jpg` — {detail[0]}×{detail[1]}, boss-area crops.",
        "",
        "## Individual files",
        "- `finalists/{512,200,96}/<rank>--<candidate>.webp`",
        "- `stamped/512/<frame>--<rank>--<candidate>.webp`",
        "",
        "Frames are locked. The emblem layer is not included in these stamped review images; it is added in the final badge composite.",
        "",
    ]
    (OUT / "README.md").write_text("\n".join(readme), encoding="utf-8")
    print("boss review", OUT)
    print("finalists", final_hires)
    print("stamped", full, detail)


if __name__ == "__main__":
    main()
