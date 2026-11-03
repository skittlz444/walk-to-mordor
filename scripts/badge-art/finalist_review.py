#!/usr/bin/env python3
"""Build side-by-side finalist review sheets and a dark HTML gallery.

Reads <report-root>/shortlist.json and scripts/badge-art/prompts.json, then
writes under <report-root> (default: reports/badge-art):

  finalist-review-emblems.jpg   emblem finalists, 3 columns
  finalist-review-frames.jpg    family frames, 3 columns
  finalist-review-ranks.jpg     rank rings, 2 columns
  finalist-review-all.jpg       all assets, 5 columns
  finalist-review.html          512 px gallery + selections table
  finalist-review.md            short index + selections table

The report root must contain shortlist.json and finalists/<slug>--<candidate>.webp.
Nothing is written outside that root.

Usage:
  python3 scripts/badge-art/finalist_review.py
  python3 scripts/badge-art/finalist_review.py --only habit-first-steps
  python3 scripts/badge-art/finalist_review.py --only emblem/habit-first-steps --skip-html
  python3 scripts/badge-art/finalist_review.py --out-dir reports/badge-art
"""
from __future__ import annotations

import argparse
import html
import json
import math
import re
import sys
from collections import Counter
from dataclasses import dataclass
from functools import lru_cache
from math import ceil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
PROMPTS_PATH = HERE / "prompts.json"
DEFAULT_OUT_DIR = "reports/badge-art"

REVIEW_PX = 512
GROUPS = ("emblem", "frame", "rank")
GROUP_NOUNS = {"emblem": "achievement", "frame": "family frame", "rank": "rank ring"}

BG = "#0d1117"
PANEL = "#14181f"
BORDER = "#2b3440"
TEXT = "#e6edf3"
MUTED = "#8b94a7"
GOLD = "#d4a017"

CATEGORY_COLS = {"emblem": 3, "frame": 3, "rank": 2}
CATEGORY_IMG = 220
CATEGORY_CELL_W = 500
CATEGORY_CELL_H = 397
CATEGORY_MARGIN = 36
CATEGORY_GUTTER = 24
CATEGORY_ROW_GAP = 22
CATEGORY_PAD = 22

ALL_COLS = 5
ALL_IMG = 140
ALL_CELL_W = 324
ALL_CELL_H = 246
ALL_MARGIN = 28
ALL_GUTTER = 16
ALL_ROW_GAP = 16
ALL_PAD = 16

KICKER = "BADGE ART \u00b7 FINALIST REVIEW"


class ReviewError(RuntimeError):
    """A loud, user-facing report generation failure."""


@dataclass(frozen=True)
class Finalist:
    letter: str
    candidate: str
    score: float
    rationale: str
    image: Path

    @property
    def score_text(self) -> str:
        return f"{self.score:.1f}"


@dataclass(frozen=True)
class ReviewAsset:
    id: str
    slug: str
    name: str
    group: str
    family: str
    rank: object
    finalists: tuple[Finalist, Finalist]
    recommended: str
    recommended_index: int
    notes: str

    @property
    def recommended_letter(self) -> str:
        return "AB"[self.recommended_index]

    @property
    def anchor(self) -> str:
        return "asset-" + self.id.replace("/", "-")

    @property
    def kind_label(self) -> str:
        if self.group == "emblem":
            return f"Emblem \u00b7 {rank_label(self)}"
        if self.group == "frame":
            return f"Family frame \u00b7 {self.family}"
        return f"Rank ring \u00b7 Tier {self.rank} \u00b7 reference only"


def rank_label(asset: ReviewAsset) -> str:
    """Human rank label; never leak the raw prompts.json 'thresholds' string."""
    if asset.group == "emblem":
        if isinstance(asset.rank, int) and not isinstance(asset.rank, bool):
            return f"Rank {asset.rank}"
        if asset.rank == "thresholds":
            return "Gold (representative)"
        return "Ranked"
    if asset.group == "frame":
        return "Family frame"
    return "Rank ring"


def plural(count: int, singular: str) -> str:
    return f"{count} {singular}{'' if count == 1 else 's'}"


def rel(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def read_json(path: Path) -> dict:
    if not path.is_file():
        raise ReviewError(f"missing input file: {rel(path)}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ReviewError(f"cannot read {rel(path)}: {exc}") from exc
    if not isinstance(data, dict):
        raise ReviewError(f"{rel(path)}: top level must be an object")
    return data


@lru_cache(maxsize=None)
def font(size: int, bold: bool = False) -> ImageFont.ImageFont:
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
    except TypeError:  # Pillow < 10.1
        return ImageFont.load_default()


def fit_font(draw: ImageDraw.ImageDraw, text: str, size: int, max_width: int,
             bold: bool = False) -> ImageFont.ImageFont:
    while size > 9:
        candidate = font(size, bold)
        if draw.textlength(text, font=candidate) <= max_width:
            return candidate
        size -= 1
    return font(9, bold)


def load_review(report_root: Path) -> list[ReviewAsset]:
    prompts = read_json(PROMPTS_PATH)
    prompt_assets = prompts.get("assets")
    if not isinstance(prompt_assets, list) or not prompt_assets:
        raise ReviewError(f"{rel(PROMPTS_PATH)}: no assets")

    shortlist_path = report_root / "shortlist.json"
    shortlist = read_json(shortlist_path)
    short_assets = shortlist.get("assets")
    if not isinstance(short_assets, dict) or not short_assets:
        raise ReviewError(f"{rel(shortlist_path)}: no assets object")

    prompt_ids: list[str] = []
    prompt_by_id: dict[str, dict] = {}
    slugs: set[str] = set()
    for raw in prompt_assets:
        if not isinstance(raw, dict):
            raise ReviewError(f"{rel(PROMPTS_PATH)}: asset entry is not an object")
        for key in ("id", "slug", "name", "group", "family"):
            if not isinstance(raw.get(key), str) or not raw[key].strip():
                raise ReviewError(
                    f"{rel(PROMPTS_PATH)}: asset {raw.get('id', '?')!r} missing {key!r}"
                )
        asset_id = raw["id"]
        if asset_id in prompt_by_id:
            raise ReviewError(f"{rel(PROMPTS_PATH)}: duplicate asset id {asset_id!r}")
        if raw["slug"] in slugs:
            raise ReviewError(f"{rel(PROMPTS_PATH)}: duplicate slug {raw['slug']!r}")
        if raw["group"] not in GROUPS:
            raise ReviewError(f"{asset_id}: unknown group {raw['group']!r}")
        if "rank" not in raw:
            raise ReviewError(f"{asset_id}: missing 'rank'")
        prompt_ids.append(asset_id)
        prompt_by_id[asset_id] = raw
        slugs.add(raw["slug"])

    expected_counts = Counter(raw["group"] for raw in prompt_assets)
    expected_total = len(prompt_ids)
    short_ids = set(short_assets)
    missing = sorted(set(prompt_ids) - short_ids)
    extra = sorted(short_ids - set(prompt_ids))
    if missing:
        raise ReviewError(
            f"{rel(shortlist_path)}: missing assets: " + ", ".join(missing)
        )
    if extra:
        raise ReviewError(
            f"{rel(shortlist_path)}: assets not in prompts.json: " + ", ".join(extra)
        )

    reviews: list[ReviewAsset] = []
    image_problems: list[str] = []
    for asset_id in prompt_ids:
        prompt_asset = prompt_by_id[asset_id]
        entry = short_assets[asset_id]
        if not isinstance(entry, dict):
            raise ReviewError(f"{asset_id}: shortlist entry is not an object")
        raw_finalists = entry.get("finalists")
        if not isinstance(raw_finalists, list) or len(raw_finalists) != 2:
            found = len(raw_finalists) if isinstance(raw_finalists, list) else "none"
            raise ReviewError(
                f"{asset_id}: expected exactly 2 finalists, found {found}"
            )
        recommended = entry.get("recommended")
        if not isinstance(recommended, str) or not recommended:
            raise ReviewError(f"{asset_id}: missing 'recommended' candidate")

        finalists: list[Finalist] = []
        for index, raw_finalist in enumerate(raw_finalists):
            if not isinstance(raw_finalist, dict):
                raise ReviewError(f"{asset_id}: finalist {index + 1} is not an object")
            candidate = raw_finalist.get("candidate")
            if not isinstance(candidate, str) or not candidate:
                raise ReviewError(f"{asset_id}: finalist {index + 1} missing candidate")
            try:
                score = float(raw_finalist.get("score"))
            except (TypeError, ValueError) as exc:
                raise ReviewError(
                    f"{asset_id}/{candidate}: invalid score "
                    f"{raw_finalist.get('score')!r}"
                ) from exc
            if not math.isfinite(score):
                raise ReviewError(f"{asset_id}/{candidate}: score must be finite")
            rationale = raw_finalist.get("rationale")
            if not isinstance(rationale, str) or not rationale.strip():
                raise ReviewError(f"{asset_id}/{candidate}: missing rationale")
            image_path = report_root / "finalists" / f"{prompt_asset['slug']}--{candidate}.webp"
            if not image_path.is_file() or image_path.stat().st_size == 0:
                image_problems.append(
                    f"{asset_id}/{candidate}: missing or empty {rel(image_path)}"
                )
            else:
                try:
                    with Image.open(image_path) as image:
                        image.load()
                        size = image.size
                except OSError as exc:
                    image_problems.append(f"{rel(image_path)}: unreadable ({exc})")
                else:
                    if size != (REVIEW_PX, REVIEW_PX):
                        image_problems.append(
                            f"{rel(image_path)}: expected {REVIEW_PX}x{REVIEW_PX}, "
                            f"got {size[0]}x{size[1]}"
                        )
            finalists.append(
                Finalist(
                    letter="AB"[index],
                    candidate=candidate,
                    score=score,
                    rationale=rationale.strip(),
                    image=image_path,
                )
            )

        candidates = [finalist.candidate for finalist in finalists]
        if len(set(candidates)) != 2:
            raise ReviewError(f"{asset_id}: finalists must have distinct candidates")
        if recommended not in candidates:
            raise ReviewError(
                f"{asset_id}: recommended {recommended!r} is not one of {candidates}"
            )

        reviews.append(
            ReviewAsset(
                id=asset_id,
                slug=prompt_asset["slug"],
                name=prompt_asset["name"],
                group=prompt_asset["group"],
                family=prompt_asset["family"],
                rank=prompt_asset["rank"],
                finalists=(finalists[0], finalists[1]),
                recommended=recommended,
                recommended_index=candidates.index(recommended),
                notes=str(entry.get("notes") or "").strip(),
            )
        )

    if image_problems:
        raise ReviewError(
            "finalist image validation failed:\n  " + "\n  ".join(image_problems)
        )

    counts = Counter(review.group for review in reviews)
    if counts != expected_counts:
        expected = ", ".join(
            plural(expected_counts[group], GROUP_NOUNS[group]) for group in GROUPS
        )
        found = ", ".join(
            plural(counts[group], GROUP_NOUNS[group]) for group in GROUPS
        )
        raise ReviewError(
            f"expected {expected_total} assets ({expected}), found "
            f"{len(reviews)} ({found})"
        )
    return reviews


def select_reviews(reviews: list[ReviewAsset], only: list[str]) -> list[ReviewAsset]:
    if not only:
        return reviews
    available = {review.id for review in reviews} | {review.slug for review in reviews}
    unknown = [token for token in only if token not in available]
    if unknown:
        raise ReviewError(
            "unknown --only value(s): " + ", ".join(unknown)
            + "\nuse an asset id or slug, for example: emblem/habit-first-steps"
        )
    selected = [
        review for review in reviews
        if review.id in only or review.slug in only
    ]
    if not selected:
        raise ReviewError("--only selected no assets")
    return selected


def thumb(path: Path, size: int) -> Image.Image:
    with Image.open(path) as image:
        return image.convert("RGB").resize((size, size), Image.Resampling.LANCZOS)


def draw_chip(draw: ImageDraw.ImageDraw, cx: float, top: float, label: str,
              text_font: ImageFont.ImageFont, fill: str, ink: str,
              height: int = 22, pad_x: int = 8) -> None:
    width = draw.textlength(label, font=text_font) + pad_x * 2
    draw.rounded_rectangle(
        [cx - width / 2, top, cx + width / 2, top + height],
        radius=height / 2,
        fill=fill,
    )
    draw.text((cx, top + height / 2), label, font=text_font, fill=ink, anchor="mm")


def paste_thumb(canvas: Image.Image, draw: ImageDraw.ImageDraw, path: Path,
                x: int, y: int, size: int, recommended: bool) -> None:
    canvas.paste(thumb(path, size), (x, y))
    if recommended:
        draw.rectangle(
            [x - 3, y - 3, x + size + 2, y + size + 2],
            outline=GOLD,
            width=2,
        )
    else:
        draw.rectangle([x, y, x + size - 1, y + size - 1], outline=BORDER, width=1)


def draw_sheet_header(draw: ImageDraw.ImageDraw, width: int, margin: int,
                      title: str, subtitle: str) -> int:
    draw.rectangle([margin, margin, margin + 4, margin + 72], fill=GOLD)
    text_x = margin + 18
    draw.text(
        (text_x, margin + 14), KICKER,
        font=font(12, True), fill=GOLD, anchor="ls",
    )
    title_font = fit_font(
        draw, title, 32, width - (margin + 18) - margin, bold=True,
    )
    draw.text(
        (text_x, margin + 64), title,
        font=title_font, fill=TEXT, anchor="ls",
    )
    draw.text(
        (text_x, margin + 90), subtitle,
        font=font(14), fill=MUTED, anchor="ls",
    )
    return margin + 120


def draw_sheet_footer(draw: ImageDraw.ImageDraw, width: int, height: int,
                      margin: int, note: str, show_aside: bool) -> None:
    baseline = height - 26
    draw.text((margin, baseline), note, font=font(12), fill=MUTED, anchor="ls")
    if show_aside:
        draw.text(
            (width - margin, baseline), "A or B \u00b7 one per achievement",
            font=font(11, True), fill=GOLD, anchor="rs",
        )


def render_category_sheet(assets: list[ReviewAsset], out_path: Path, group: str,
                          title: str) -> tuple[int, int]:
    cols = min(CATEGORY_COLS[group], len(assets))
    rows = ceil(len(assets) / cols)
    width = (
        CATEGORY_MARGIN * 2
        + cols * CATEGORY_CELL_W
        + (cols - 1) * CATEGORY_GUTTER
    )
    grid_top = CATEGORY_MARGIN + 120
    height = (
        grid_top
        + rows * CATEGORY_CELL_H
        + (rows - 1) * CATEGORY_ROW_GAP
        + 50
    )
    canvas = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(canvas)

    noun = GROUP_NOUNS[group]
    compact = width < 1000
    subtitle = (
        f"{plural(len(assets), noun)} \u00b7 "
        f"two finalists each \u00b7 {CATEGORY_IMG} px"
    )
    if not compact:
        subtitle += " review images \u00b7 gold \u2605 = shortlist recommendation"
    draw_sheet_header(draw, width, CATEGORY_MARGIN, title, subtitle)

    for index, asset in enumerate(assets):
        row, col = divmod(index, cols)
        x = CATEGORY_MARGIN + col * (CATEGORY_CELL_W + CATEGORY_GUTTER)
        y = grid_top + row * (CATEGORY_CELL_H + CATEGORY_ROW_GAP)
        draw.rounded_rectangle(
            [x, y, x + CATEGORY_CELL_W, y + CATEGORY_CELL_H],
            radius=16, fill=PANEL, outline=BORDER, width=1,
        )

        inner_x = x + CATEGORY_PAD
        inner_w = CATEGORY_CELL_W - CATEGORY_PAD * 2
        title_font = fit_font(draw, asset.name, 22, inner_w, bold=True)
        draw.text((inner_x, y + 42), asset.name, font=title_font,
                  fill=TEXT, anchor="ls")
        draw.text((inner_x, y + 64), rank_label(asset), font=font(13),
                  fill=MUTED, anchor="ls")

        image_y = y + 84
        for image_index, finalist in enumerate(asset.finalists):
            image_x = inner_x + image_index * (CATEGORY_IMG + 16)
            paste_thumb(
                canvas, draw, finalist.image, image_x, image_y,
                CATEGORY_IMG, image_index == asset.recommended_index,
            )
            cx = image_x + CATEGORY_IMG / 2
            draw.text(
                (cx, image_y + CATEGORY_IMG + 18),
                f"{finalist.letter} \u00b7 {finalist.candidate}",
                font=font(14), fill=TEXT, anchor="ms",
            )
            score_width = (
                draw.textlength("score ", font=font(10, True))
                + draw.textlength(finalist.score_text, font=font(15, True))
            )
            score_x = cx - score_width / 2
            draw.text(
                (score_x, image_y + CATEGORY_IMG + 40), "score ",
                font=font(10, True), fill=MUTED, anchor="ls",
            )
            draw.text(
                (score_x + draw.textlength("score ", font=font(10, True)),
                 image_y + CATEGORY_IMG + 40),
                finalist.score_text, font=font(15, True), fill=TEXT, anchor="ls",
            )
            if image_index == asset.recommended_index:
                draw_chip(
                    draw, cx, image_y + CATEGORY_IMG + 50,
                    "\u2605 Recommended", font(12, True), GOLD, BG,
                )

    draw_sheet_footer(
        draw, width, height, CATEGORY_MARGIN,
        "Rank rings are reference only \u2014 F1 removes them."
        if group == "rank" else
        ("Reply with A or B per achievement." if compact else
         "Both candidates are finalists. Reply with A or B per achievement, "
         "or edit selections.md."),
        show_aside=not compact and group != "rank",
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path, "JPEG", quality=94, subsampling=0, optimize=True)
    return canvas.size


def render_all_sheet(assets: list[ReviewAsset], out_path: Path) -> tuple[int, int]:
    cols = min(ALL_COLS, len(assets))
    rows = ceil(len(assets) / cols)
    width = ALL_MARGIN * 2 + cols * ALL_CELL_W + (cols - 1) * ALL_GUTTER
    grid_top = ALL_MARGIN + 120
    height = grid_top + rows * ALL_CELL_H + (rows - 1) * ALL_ROW_GAP + 50
    canvas = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(canvas)

    compact = width < 1000
    subtitle = (
        f"{len(assets)} assets \u00b7 {len(assets) * 2} finalists \u00b7 "
        f"{ALL_IMG} px"
    )
    if not compact:
        subtitle += " review images \u00b7 gold \u2605 = shortlist recommendation"
    draw_sheet_header(draw, width, ALL_MARGIN, "All Finalists \u2014 One Glance", subtitle)

    for index, asset in enumerate(assets):
        row, col = divmod(index, cols)
        x = ALL_MARGIN + col * (ALL_CELL_W + ALL_GUTTER)
        y = grid_top + row * (ALL_CELL_H + ALL_ROW_GAP)
        draw.rounded_rectangle(
            [x, y, x + ALL_CELL_W, y + ALL_CELL_H],
            radius=14, fill=PANEL, outline=BORDER, width=1,
        )
        inner_x = x + ALL_PAD
        inner_w = ALL_CELL_W - ALL_PAD * 2
        draw.text(
            (inner_x, y + 21), asset.group.upper(),
            font=font(9, True), fill=MUTED, anchor="ls",
        )
        name_font = fit_font(draw, asset.name, 15, inner_w, bold=True)
        draw.text((inner_x, y + 41), asset.name, font=name_font,
                  fill=TEXT, anchor="ls")
        draw.text(
            (inner_x, y + 58),
            f"\u2605 Recommended \u00b7 {asset.recommended_letter}",
            font=font(11, True), fill=GOLD, anchor="ls",
        )

        image_y = y + 68
        for image_index, finalist in enumerate(asset.finalists):
            image_x = inner_x + image_index * (ALL_IMG + 12)
            paste_thumb(
                canvas, draw, finalist.image, image_x, image_y,
                ALL_IMG, image_index == asset.recommended_index,
            )
            draw.text(
                (image_x + ALL_IMG / 2, image_y + ALL_IMG + 13),
                f"{finalist.letter} \u00b7 {finalist.candidate}",
                font=font(11), fill=MUTED, anchor="ms",
            )

    draw_sheet_footer(
        draw, width, height, ALL_MARGIN,
        "Reply with A or B per achievement." if compact else
        "Overview only \u2014 open the category sheets or finalist-review.html "
        "for 512 px detail. Reply with A or B per achievement.",
        show_aside=not compact,
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path, "JPEG", quality=94, subsampling=0, optimize=True)
    return canvas.size


def render_sheets(reviews: list[ReviewAsset], report_root: Path) -> list[dict]:
    specs = [
        ("emblem", "Emblem Finalists", "finalist-review-emblems.jpg"),
        ("frame", "Family Frame Finalists", "finalist-review-frames.jpg"),
        ("rank", "Rank Ring Finalists", "finalist-review-ranks.jpg"),
    ]
    outputs: list[dict] = []
    for group, title, filename in specs:
        group_assets = [review for review in reviews if review.group == group]
        if not group_assets:
            continue
        path = report_root / filename
        size = render_category_sheet(group_assets, path, group, title)
        outputs.append(
            {
                "label": title.replace(" Finalists", ""),
                "path": path,
                "size": size,
                "count": len(group_assets),
                "kind": "sheet",
                "group": group,
                "noun": GROUP_NOUNS[group],
            }
        )

    all_path = report_root / "finalist-review-all.jpg"
    all_size = render_all_sheet(reviews, all_path)
    outputs.append(
        {
            "label": "All assets",
            "path": all_path,
            "size": all_size,
            "count": len(reviews),
            "kind": "all",
            "group": None,
            "noun": "asset",
        }
    )
    return outputs


def sheet_nav(outputs: list[dict]) -> list[tuple[str, str]]:
    return [
        (f"{item['label']} \u00b7 {plural(item['count'], item['noun'])}",
         item["path"].name)
        for item in outputs if item["kind"] == "sheet"
    ] + [("All " + plural(
        next(item["count"] for item in outputs if item["kind"] == "all"),
        "asset",
    ), next(
        item["path"].name for item in outputs if item["kind"] == "all"
    ))]


def write_markdown(reviews: list[ReviewAsset], outputs: list[dict],
                   report_root: Path, include_html: bool) -> Path:
    counts = Counter(review.group for review in reviews)
    lines = [
        "# Badge Art \u2014 Finalist Review",
        "",
        f"**{plural(counts['emblem'], GROUP_NOUNS['emblem'])}**, "
        f"{plural(counts['frame'], GROUP_NOUNS['frame'])} and "
        f"{plural(counts['rank'], GROUP_NOUNS['rank'])} \u2014 "
        f"{plural(len(reviews), 'asset')}, {len(reviews) * 2} finalists. "
        "Each listed asset has two finalists. The rank-ring rows are "
        "**reference only \u2014 F1 removes the rank ring** in favour of the "
        "6 o'clock rank boss. The gold \u2605 is the current recommendation, "
        "not a decision.",
        "",
        "## Review sheets",
        "",
    ]
    for item in outputs:
        if item["kind"] == "all":
            all_cols = min(ALL_COLS, item["count"])
            all_rows = ceil(item["count"] / all_cols)
            lines.append(
                f"- [All assets \u2014 {item['count']} rows]"
                f"({item['path'].name}) (overview, "
                f"{all_cols} \u00d7 {all_rows})"
            )
        elif item["group"] == "rank":
            lines.append(
                f"- [Rank Ring \u2014 {plural(item['count'], 'component')}, "
                f"retired under F1]({item['path'].name})"
            )
        else:
            noun = "achievement" if item["group"] == "emblem" else "component"
            lines.append(
                f"- [{item['label']} \u2014 "
                f"{plural(item['count'], noun)}]({item['path'].name})"
            )
    if include_html:
        lines.append(
            "- [HTML gallery](finalist-review.html) \u2014 512 px images, scores, "
            "rationales and selections"
        )
    lines += [
        "",
        "## Selections",
        "",
        "Reply with **A** or **B** per achievement, or edit `selections.md`. "
        "Rank rings are reference only under F1.",
        "",
        "| Asset | Finalist A | Finalist B | Recommended | Selection |",
        "|---|---|---|---|---|",
    ]
    for asset in reviews:
        first, second = asset.finalists
        lines.append(
            f"| {asset.name}<br>`{asset.id}` "
            f"| [A \u00b7 {first.candidate}](finalists/{first.image.name}) "
            f"| [B \u00b7 {second.candidate}](finalists/{second.image.name}) "
            f"| **{asset.recommended_letter}** \u00b7 `{asset.recommended}` "
            f"| {'Reference only' if asset.group == 'rank' else 'Pending'} |"
        )
    lines += [
        "",
        "Scores and full rationales are in [finalist-review.html](finalist-review.html)."
        if include_html else "",
        "",
    ]
    path = report_root / "finalist-review.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


HTML_STYLE = """
:root{
  --bg:#0d1117; --panel:#14181f; --panel2:#111821; --line:#2b3440;
  --text:#e6edf3; --muted:#8b94a7; --gold:#d4a017; --gold2:#ffe8a3;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);
  font:16px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,
  "Helvetica Neue",Arial,sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:0 24px}
a{color:var(--gold2)}
code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  font-size:.86em;background:#1b222d;border:1px solid var(--line);
  border-radius:5px;padding:1px 5px;white-space:nowrap}
.hero{padding:54px 0 26px;border-bottom:1px solid var(--line);
  background:linear-gradient(180deg,#111821 0%,#0d1117 100%)}
.kicker{color:var(--gold);font-size:12px;font-weight:700;
  letter-spacing:.14em;text-transform:uppercase}
h1{margin:10px 0 10px;font-size:clamp(30px,5vw,46px);line-height:1.08;
  letter-spacing:-.02em}
.lede{max-width:860px;margin:0;color:#c3ccda;font-size:17px}
.links{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
.chip{display:inline-block;border:1px solid var(--line);border-radius:999px;
  padding:6px 12px;font-size:13px;text-decoration:none;color:var(--text);
  background:#111821}
.chip:hover{border-color:var(--gold);color:var(--gold2)}
.chip.gold{border-color:rgba(212,160,23,.55);color:var(--gold2)}
main{padding-top:28px}
section{scroll-margin-top:16px}
.summary{margin-bottom:42px}
.summary h2,.asset h2{color:var(--gold2)}
h2{font-size:24px;margin:0 0 6px;letter-spacing:-.01em}
.hint{color:var(--muted);font-size:13px;margin:0 0 12px}
.tablewrap{max-height:54vh;overflow:auto;overscroll-behavior:contain;
  border:1px solid var(--line);border-radius:12px;background:var(--panel)}
table{width:100%;border-collapse:separate;border-spacing:0}
.summary table{min-width:660px}
th,td{padding:9px 12px;text-align:left;vertical-align:top;
  border-bottom:1px solid var(--line);font-size:13px}
tbody tr:last-child td{border-bottom:0}
tbody tr:hover{background:#171e28}
thead th{position:sticky;top:0;z-index:2;background:var(--panel2);
  color:var(--gold2);font-weight:700;font-size:12px;letter-spacing:.05em;
  text-transform:uppercase;border-bottom:1px solid var(--line)}
td .slug,.slug{color:var(--muted);font-size:12px;font-family:ui-monospace,
  SFMono-Regular,Menlo,Consolas,monospace}
.letter{color:var(--gold2);font-weight:700}
.score{color:var(--gold2);font-weight:700;font-size:12px}
.rec-inline{color:var(--gold2);font-weight:700;white-space:nowrap}
.asset{padding:34px 0 38px;border-bottom:1px solid var(--line)}
.asset-head{display:flex;justify-content:space-between;align-items:flex-start;
  gap:18px;margin-bottom:18px}
.asset-title .kicker{font-size:11px}
.asset h2{font-size:28px;margin:6px 0 2px}
.asset-meta{display:flex;flex-direction:column;align-items:flex-end;gap:10px;
  flex:0 0 auto}
.rec-badge{display:inline-block;background:var(--gold);color:#0d1117;
  border-radius:999px;padding:6px 12px;font-size:12px;font-weight:700;
  white-space:nowrap}
.back{font-size:12px;color:var(--muted);text-decoration:none}
.back:hover{color:var(--gold2)}
.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
.cand{margin:0;background:var(--panel);border:1px solid var(--line);
  border-radius:16px;overflow:hidden;display:flex;flex-direction:column}
.cand.rec{border-color:rgba(212,160,23,.7);
  box-shadow:0 0 0 1px rgba(212,160,23,.18),0 10px 30px rgba(0,0,0,.22)}
.imwrap{display:flex;justify-content:center;background:#0d1117;
  padding:12px;border-bottom:1px solid var(--line)}
.imwrap img{display:block;width:100%;max-width:512px;height:auto;
  border-radius:8px;background:var(--panel)}
figcaption{padding:15px 18px 18px;display:flex;flex-direction:column;
  gap:10px;flex:1}
.candhead{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.candhead .score{margin-left:auto;font-size:16px}
.rationale{margin:0;color:#c6cfdd;font-size:15px;line-height:1.55;flex:1}
.rec-chip{align-self:flex-start;background:var(--gold);color:#0d1117;
  border-radius:999px;padding:4px 11px;font-size:11px;font-weight:700;
  letter-spacing:.02em}
.notes{margin:16px 0 0;color:var(--muted);font-size:13px}
.notes b{color:var(--text)}
.selections{padding-top:36px}
.note{background:var(--panel);border:1px solid var(--line);
  border-left:4px solid var(--gold);border-radius:10px;padding:13px 16px;
  margin:14px 0 18px;color:#c6cfdd}
.pending{display:inline-block;border:1px dashed var(--line);border-radius:999px;
  padding:2px 12px;color:var(--muted);font-size:12px}
footer{border-top:1px solid var(--line);margin-top:8px;padding:24px 0 40px;
  color:var(--muted);font-size:12px}
@media(max-width:760px){
  .wrap{padding:0 16px}
  .hero{padding:34px 0 20px}
  .lede{font-size:15px}
  .pair{grid-template-columns:1fr}
  .asset-head{flex-direction:column;gap:10px}
  .asset-meta{flex-direction:row;align-items:center}
  .asset h2{font-size:24px}
  .tablewrap{max-height:none;overflow:visible}
  th,td{padding:8px 9px}

  /* Summary and selections become compact two-line rows instead of
     sideways-scrolling tables on phones. */
  .summary table,.selections table{min-width:0}
  .summary thead,.selections thead{display:none}
  .summary tbody,.summary tr,.summary td,
  .selections tbody,.selections tr,.selections td{display:block}
  .summary tr,.selections tr{
    display:grid;
    grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;
    gap:4px 10px;
    padding:10px 12px;
    border-bottom:1px solid var(--line);
  }
  .summary tr:last-child,.selections tr:last-child{border-bottom:0}
  .summary td,.selections td{
    border:0;padding:0;font-size:12px;vertical-align:top;
  }
  .summary td:nth-child(1),.selections td:nth-child(1){
    grid-column:1/3;grid-row:1;
  }
  .summary td:nth-child(2),.selections td:nth-child(2){
    grid-column:1;grid-row:2;
  }
  .summary td:nth-child(3),.selections td:nth-child(3){
    grid-column:2;grid-row:2;
  }
  .summary td:nth-child(4){
    grid-column:3;grid-row:1;text-align:right;align-self:start;
  }
  .selections td:nth-child(4){
    grid-column:3;grid-row:2;text-align:right;align-self:start;
  }
  .selections td:nth-child(5){
    grid-column:3;grid-row:1;text-align:right;align-self:start;
  }
  .summary td .slug,.selections td .slug{display:none}
  .summary code,.selections code{font-size:10px;padding:0 3px}
  .summary .score{font-size:10px;margin-left:2px}
  .summary .rec-cand{display:none}
}
"""


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def write_html(reviews: list[ReviewAsset], outputs: list[dict],
               report_root: Path) -> Path:
    counts = Counter(review.group for review in reviews)
    nav = "".join(
        f'<a class="chip" href="{esc(filename)}">{esc(label)}</a>'
        for label, filename in sheet_nav(outputs)
    )
    nav += '<a class="chip gold" href="finalist-review.md">Markdown index</a>'

    summary_rows = []
    for asset in reviews:
        first, second = asset.finalists
        summary_rows.append(
            "<tr>"
            f'<td><a href="#{asset.anchor}"><strong>{esc(asset.name)}</strong></a>'
            f'<br><span class="slug">{esc(asset.id)}</span></td>'
            f'<td><span class="letter">A</span> <code>{esc(first.candidate)}</code> '
            f'<span class="score">{first.score_text}</span></td>'
            f'<td><span class="letter">B</span> <code>{esc(second.candidate)}</code> '
            f'<span class="score">{second.score_text}</span></td>'
            f'<td><span class="rec-inline">\u2605 {asset.recommended_letter}'
            f'<span class="rec-cand"> \u00b7 '
            f'<code>{esc(asset.recommended)}</code></span></span></td>'
            "</tr>"
        )

    sections = []
    for asset in reviews:
        cards = []
        for index, finalist in enumerate(asset.finalists):
            is_rec = index == asset.recommended_index
            chip = (
                '<span class="rec-chip">\u2605 Recommended</span>'
                if is_rec else ""
            )
            cards.append(
                f'<figure class="cand{" rec" if is_rec else ""}">'
                f'<a class="imwrap" href="finalists/{esc(finalist.image.name)}" '
                f'title="Open 512 px finalist {finalist.letter} \u00b7 '
                f'{esc(finalist.candidate)}">'
                f'<img src="finalists/{esc(finalist.image.name)}" '
                f'alt="{esc(asset.name)} \u2014 finalist {finalist.letter}, '
                f'{esc(finalist.candidate)}" width="512" height="512" '
                f'decoding="async"></a>'
                f'<figcaption><div class="candhead">'
                f'<span class="letter">{finalist.letter}</span>'
                f'<code>{esc(finalist.candidate)}</code>'
                f'<span class="score">{finalist.score_text}</span></div>'
                f'<p class="rationale">{esc(finalist.rationale)}</p>'
                f'{chip}</figcaption></figure>'
            )
        note = (
            f'<p class="notes"><b>Shortlist note:</b> {esc(asset.notes)}</p>'
            if asset.notes else ""
        )
        sections.append(
            f'<section class="asset" id="{asset.anchor}">'
            f'<div class="asset-head"><div class="asset-title">'
            f'<div class="kicker">{esc(asset.kind_label)}</div>'
            f'<h2>{esc(asset.name)}</h2>'
            f'<div class="slug">{esc(asset.id)}</div></div>'
            f'<div class="asset-meta">'
            f'<span class="rec-badge">\u2605 Recommended \u00b7 '
            f'{asset.recommended_letter}</span>'
            f'<a class="back" href="#summary">\u2191 summary</a></div></div>'
            f'<div class="pair">{"".join(cards)}</div>{note}</section>'
        )

    selection_rows = []
    for asset in reviews:
        first, second = asset.finalists
        selection_rows.append(
            "<tr>"
            f'<td><a href="#{asset.anchor}">{esc(asset.name)}</a>'
            f'<br><span class="slug">{esc(asset.id)}</span></td>'
            f'<td><span class="letter">A</span> <code>{esc(first.candidate)}</code></td>'
            f'<td><span class="letter">B</span> <code>{esc(second.candidate)}</code></td>'
            f'<td><span class="rec-inline">\u2605 {asset.recommended_letter}</span></td>'
            f'<td><span class="pending">{"Reference only" if asset.group == "rank" else "Pending"}</span></td>'
            "</tr>"
        )

    document = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>Finalist Review \u2014 Badge Art</title>
<style>{HTML_STYLE}</style>
</head>
<body>
<header class="hero"><div class="wrap">
  <div class="kicker">{esc(KICKER)}</div>
  <h1>Pick one finalist per achievement</h1>
  <p class="lede">{plural(counts['emblem'], GROUP_NOUNS['emblem'])},
  {plural(counts['frame'], GROUP_NOUNS['frame'])} and
  {plural(counts['rank'], GROUP_NOUNS['rank'])} \u2014 {plural(len(reviews), 'asset')},
  {len(reviews) * 2} finalists. Both shortlisted candidates sit side by side at
  512 px. Gold marks the shortlist recommendation; nothing is final until you
  reply with A or B.</p>
  <p class="hint">Rank rings are reference only \u2014 F1 removes the rank ring
  in favour of the 6 o'clock rank boss.</p>
  <div class="links">{nav}<a class="chip gold" href="#selections">Selections</a></div>
</div></header>
<main class="wrap">
<section class="summary" id="summary">
  <h2>Summary</h2>
  <p class="hint">Both scores sit beside each finalist; \u2605 marks the shortlist pick.</p>
  <div class="tablewrap"><table>
    <thead><tr><th>Asset</th><th>Finalist A</th><th>Finalist B</th>
    <th>Recommended</th></tr></thead>
    <tbody>{"".join(summary_rows)}</tbody>
  </table></div>
</section>
{"".join(sections)}
<section class="selections" id="selections">
  <h2>Selections</h2>
  <p class="note">Reply with <b>A</b> or <b>B</b> per achievement, or edit
  <code>selections.md</code>. Rank rings are reference only under F1.</p>
  <div class="tablewrap"><table>
    <thead><tr><th>Asset</th><th>Finalist A</th><th>Finalist B</th>
    <th>Recommended</th><th>Selection</th></tr></thead>
    <tbody>{"".join(selection_rows)}</tbody>
  </table></div>
</section>
</main>
<footer><div class="wrap">Built from <code>shortlist.json</code> and
<code>prompts.json</code>. Review copies only \u2014 no production assets were changed.</div></footer>
</body>
</html>
"""
    path = report_root / "finalist-review.html"
    path.write_text(document, encoding="utf-8")
    return path


HTML_LINK_RE = re.compile(r'(?:src|href)="([^"]+)"')
MD_LINK_RE = re.compile(r"\]\(([^)]+)\)")


def verify_links(path: Path, regex: re.Pattern[str], report_root: Path) -> None:
    text = path.read_text(encoding="utf-8")
    broken = []
    for ref in sorted(set(regex.findall(text))):
        if ref.startswith(("#", "http://", "https://", "mailto:", "data:")):
            continue
        target = (report_root / ref.split("#", 1)[0]).resolve()
        if not target.is_file():
            broken.append(ref)
    if broken:
        raise ReviewError(
            f"{rel(path)}: broken relative link(s): " + ", ".join(broken)
        )


def run(args: argparse.Namespace) -> None:
    report_root = Path(args.out_dir)
    if not report_root.is_absolute():
        report_root = (REPO_ROOT / report_root).resolve()
    else:
        report_root = report_root.resolve()

    reviews = load_review(report_root)
    selected = select_reviews(reviews, args.only)
    outputs = render_sheets(selected, report_root)

    md_path = write_markdown(
        selected, outputs, report_root, include_html=not args.skip_html,
    )
    html_path = None
    if not args.skip_html:
        html_path = write_html(selected, outputs, report_root)

    verify_links(md_path, MD_LINK_RE, report_root)
    if html_path is not None:
        verify_links(html_path, HTML_LINK_RE, report_root)

    print("FINALIST REPORT READY")
    print(f"  root: {rel(report_root)}")
    for item in outputs:
        width, height = item["size"]
        size_kb = item["path"].stat().st_size / 1024
        unit = "asset" if item["count"] == 1 else "assets"
        print(
            f"  {item['path'].name:31s} {width:4d}x{height:<4d} "
            f"{size_kb:7.1f} KB  {item['count']:2d} {unit}"
        )
    size_kb = md_path.stat().st_size / 1024
    print(f"  {md_path.name:31s} {'':13s} {size_kb:7.1f} KB")
    if html_path is not None:
        size_kb = html_path.stat().st_size / 1024
        print(f"  {html_path.name:31s} {'':13s} {size_kb:7.1f} KB")
    else:
        print("  finalist-review.html           skipped (--skip-html)")
    print(f"  {len(selected)} assets / {len(selected) * 2} finalists represented")
    counts = Counter(review.group for review in selected)
    print(
        f"  {plural(counts['emblem'], GROUP_NOUNS['emblem'])}, "
        f"{plural(counts['frame'], GROUP_NOUNS['frame'])}, "
        f"{plural(counts['rank'], GROUP_NOUNS['rank'])}"
    )


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build side-by-side finalist review sheets and gallery.",
    )
    parser.add_argument(
        "--only", action="append", default=[], metavar="ASSET",
        help="render one asset id or slug; repeatable",
    )
    parser.add_argument(
        "--skip-html", action="store_true", help="skip finalist-review.html",
    )
    parser.add_argument(
        "--out-dir", default=DEFAULT_OUT_DIR,
        help=f"report root containing shortlist.json and finalists/ "
             f"(default: {DEFAULT_OUT_DIR})",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        run(args)
    except ReviewError as exc:
        print(f"BLOCKED: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
