#!/usr/bin/env python3
"""Build the badge artwork shortlist report, review gallery and selection sheet.

Shortlist schema (reports/badge-art/shortlist.json):
    {"assets": {"emblem/habit-first-steps": {
        "finalists": [
            {"candidate": "a-112358", "score": 4.5, "rationale": "One sentence on ..."},
            {"candidate": "b-271828", "score": 4.0, "rationale": "..."}],
        "recommended": "a-112358", "notes": "Optional reviewer note."}}}

Every asset in scripts/badge-art/prompts.json needs exactly two finalists and a
recommended candidate matching one of them. `candidate` is `<variant>-<seed>`;
files are read from raw_assets/badges/processed/<asset>/<candidate>.png, falling
back to raw_assets/badges/candidates/<asset>/<candidate>.png.

Usage:
  python3 scripts/badge-art/make_report.py --write-template
  python3 scripts/badge-art/make_report.py --render
  python3 scripts/badge-art/make_report.py --shortlist /tmp/opencode/test.json --out-dir /tmp/opencode/report

Outputs under reports/badge-art/: shortlist.md, review.html, selections.md and
finalists/<slug>--<candidate>.webp. Finalist masters go to
raw_assets/badges/shortlist/<asset>/. No compositing or production assets are made.
"""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import shutil
import sys
from datetime import date
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
REPORT_ROOT = REPO_ROOT / "reports" / "badge-art"
RAW_ROOT = REPO_ROOT / "raw_assets" / "badges"
PROMPTS_PATH, SHORTLIST_PATH = HERE / "prompts.json", REPORT_ROOT / "shortlist.json"
CANDIDATES_LOG, PROCESSING_LOG = REPORT_ROOT / "candidates.jsonl", REPORT_ROOT / "processing.jsonl"
SHEETS_ROOT, SHEET_INDEX = REPORT_ROOT / "sheets", REPORT_ROOT / "sheets" / "index.json"
GROUP_TITLES = {"emblem": "Emblems", "frame": "Family frames", "rank": "Rank rings"}
CANDIDATE_RE = re.compile(r"^[a-z0-9]+-\d+$")
SMALL_WORDS = {"a", "an", "and", "at", "by", "for", "in", "of", "on", "the", "to", "with"}
NAME_FIXES = {"dum": "Dûm", "lothlorien": "Lothlórien"}
# Mirrors plan §4 / scripts/badge-art/generate.py; update both together.
GENERATION = {"model": "flux3-image-klein-int8-convrot.safetensors",
              "config": "qwen3vl_4b_int8_convrot text encoder · flux2-vae · 1024 × 1024 · "
                        "16 steps · CFG 1.0 · er_sde / simple"}
BG = (20, 24, 31, 255)
REVIEW_PX, WEBP_QUALITY = 512, 88

CSS = """
:root{--bg:#0d1117;--panel:#14181f;--panel2:#1b212b;--border:#2f3949;--text:#e6e9ef;--muted:#8b94a7;--gold:#d9b45b}
*{box-sizing:border-box}html{scroll-padding-top:34vh}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}a{color:var(--gold)}code{font:.9em ui-monospace,SFMono-Regular,Menlo,monospace;color:#cbd5e1}
.topbar{position:sticky;top:0;z-index:20;padding:12px 20px;background:rgba(13,17,23,.96);border-bottom:1px solid var(--border);backdrop-filter:blur(8px)}.topbar h1{margin:0;font-size:18px}.topbar .meta{margin:2px 0 8px;font-size:12px;color:var(--muted)}
.tablewrap{max-height:26vh;overflow:auto;border:1px solid var(--border);border-radius:8px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{padding:6px 10px;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap}th{position:sticky;top:0;background:var(--panel2);color:var(--muted);font-weight:600}
main{max-width:1180px;margin:0 auto;padding:8px 20px 48px}.asset{padding:28px 0;border-bottom:1px solid var(--border)}h2{margin:0 0 2px;font-size:24px}h2 .slug{font-size:13px;font-weight:400;color:var(--muted);margin-left:8px}
.meta{color:var(--muted);margin:0 0 10px;font-size:14px}.motif{margin:0 0 16px;color:#c7cede}.sheet{margin:0 0 18px}
.sheet img{display:block;width:100%;height:auto;border:1px solid var(--border);border-radius:10px;background:var(--panel)}.sheet figcaption{margin-top:6px;font-size:12px;color:var(--muted)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:16px}.card{margin:0;padding:12px;background:var(--panel);border:1px solid var(--border);border-radius:12px}.card.rec{border-color:var(--gold);box-shadow:inset 0 0 0 1px var(--gold)}
.card img{display:block;width:100%;aspect-ratio:1;object-fit:contain;background:var(--panel);border-radius:8px}.card-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}.score{margin-left:auto;color:var(--gold);font-weight:700}
.badge{padding:2px 8px;border-radius:999px;background:var(--gold);color:#14181f;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}.card p{margin:10px 0 0;font-size:14px;color:#c7cede}.missing{padding:14px;border:1px dashed #c25b5b;border-radius:10px;color:#e0a0a0;background:#1b1518}
.notes{margin:14px 0 0;font-size:14px;color:#c7cede}footer{max-width:1180px;margin:0 auto;padding:8px 20px 64px;color:#c7cede}
@media (max-width:640px){.topbar{padding:10px 14px}.tablewrap{max-height:22vh}html{scroll-padding-top:30vh}main{padding:0 14px 36px}h2{font-size:20px}h2 .slug{display:block;margin:2px 0 0}.tablewrap th:nth-child(2),.tablewrap td:nth-child(2),.tablewrap th:nth-child(3),.tablewrap td:nth-child(3){display:none}}
"""


def display_name(asset):
    """Use the canonical name from prompts.json, falling back to the slug."""
    if asset.get("name"):
        return asset["name"]
    words = asset["slug"].split("-")
    if asset["group"] == "emblem":
        words = words[1:] if words[0] == asset["family"] else words
        words = words[2:] if words[:2] == ["frodo", "sam"] else words
        suffix = ""
    else:
        suffix = " Frame" if asset["group"] == "frame" else " Rank Ring"
    out = []
    for index, word in enumerate(words):
        word = NAME_FIXES.get(word, word)
        out.append(word if index and word in SMALL_WORDS else word[:1].upper() + word[1:])
    return " ".join(out) + suffix


def motif_for(asset):
    """The motif is the first sentence of variant a's prompt in prompts.json."""
    prompt = next((v["prompt"] for v in asset["variants"] if v["id"] == "a"),
                  asset["variants"][0]["prompt"]).strip()
    return re.split(r"(?<=\.)\s+", prompt, maxsplit=1)[0]


def fmt_score(score):
    return f"{score:g}" if isinstance(score, (int, float)) and not isinstance(score, bool) else str(score)


def md_cell(text):
    return " ".join(str(text).split()).replace("|", "\\|")


def esc(value):
    return html.escape(str(value), quote=True)


def candidate_path(asset_id, candidate):
    # Finalist masters must carry alpha. A raw candidate still has the black
    # generation field, so it is never accepted as a compositing master.
    path = RAW_ROOT / "processed" / asset_id / f"{candidate}.png"
    if path.is_file() and path.stat().st_size > 0:
        return path
    return None


def log_summary(path, key):
    if not path.is_file():
        return {"missing": True, "records": 0, "ok": 0, "failed": 0, "unique": 0,
                "sessions": [], "fallback": False}
    records = []
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(record, dict):
            records.append(record)
    ok = [r for r in records if r.get("status") == "success"]
    return {"missing": False, "records": len(records), "ok": len(ok),
            "failed": sum(1 for r in records if r.get("status") not in (None, "success")),
            "unique": len({key(r) for r in ok}),
            "sessions": sorted({r.get("session") for r in ok if r.get("session")}),
            "fallback": any(r.get("fallback") for r in records)}


def stats_markdown(matrix, cand, proc):
    planned = {g: sum(len(a["variants"]) * len(matrix["seeds"][g])
                      for a in matrix["assets"] if a["group"] == g) for g in GROUP_TITLES}
    total = sum(planned.values())
    pool = f"{total} planned ({planned['emblem']} emblems, {planned['frame']} frames, {planned['rank']} rings)"
    generation = (f"`{CANDIDATES_LOG.name}` not found" if cand["missing"] else
                  f"unique candidates: {cand['unique']} logged; matrix pool {total}; "
                  f"log {cand['records']} records: {cand['ok']} success, {cand['failed']} failed")
    if proc["missing"]:
        cutouts = f"`{PROCESSING_LOG.name}` not found"
    else:
        cutouts = (f"unique cutouts: {proc['unique']}; log {proc['records']} records: "
                   f"{proc['ok']} success, {proc['failed']} failed")
        if proc["sessions"]:
            cutouts += f"; session {', '.join(proc['sessions'])}"
        if proc["fallback"]:
            cutouts += " (fallback used)"
    return ["| Metric | Value |", "|---|---|", f"| Model (plan §4) | `{GENERATION['model']}` |",
            f"| Config (plan §4) | {GENERATION['config']} |", f"| Candidate pool | {pool} |",
            f"| Generation log | {generation} |", f"| Processing log | {cutouts} |"]


def validate_shortlist(shortlist, assets):
    """Return (errors, resolved). Errors are one line per invalid asset."""
    if not isinstance(shortlist, dict) or not isinstance(shortlist.get("assets"), dict):
        return ["shortlist.json: expected an object with an 'assets' object"], {}
    entries, known = shortlist["assets"], {a["id"]: a for a in assets}
    errors = [f"{x}: unknown asset id (not in prompts.json)" for x in sorted(set(entries) - set(known))]
    resolved = {}
    for asset in assets:
        aid, entry = asset["id"], entries.get(asset["id"])
        if not isinstance(entry, dict):
            errors.append(f"{aid}: missing from shortlist.json"); continue
        finals = entry.get("finalists")
        if not isinstance(finals, list) or len(finals) != 2:
            errors.append(f"{aid}: expected exactly 2 finalists, found "
                          f"{len(finals) if isinstance(finals, list) else 'no list'}"); continue
        problems, enriched, variants = [], [], {v["id"] for v in asset["variants"]}
        for index, item in enumerate(finals, 1):
            if not isinstance(item, dict):
                problems.append(f"finalist {index} is not an object"); continue
            candidate = item.get("candidate")
            if not isinstance(candidate, str) or not CANDIDATE_RE.match(candidate):
                problems.append(f"finalist {index} candidate {candidate!r} is not <variant>-<seed>"); continue
            if candidate.split("-", 1)[0] not in variants:
                problems.append(f"candidate {candidate!r} has an unknown variant")
            path = candidate_path(aid, candidate)
            if path is None:
                problems.append(f"candidate {candidate!r} missing from processed/ and candidates/")
            score = item.get("score")
            if isinstance(score, bool) or not isinstance(score, (int, float)):
                problems.append(f"candidate {candidate!r} score must be a number")
            if not isinstance(item.get("rationale"), str) or not item["rationale"].strip():
                problems.append(f"candidate {candidate!r} rationale must be a non-empty string")
            enriched.append({"candidate": candidate, "score": score,
                             "rationale": item.get("rationale") or "", "path": path})
        if len({f["candidate"] for f in enriched}) != len(enriched):
            problems.append("finalists must be two different candidates")
        recommended = entry.get("recommended")
        if not isinstance(recommended, str) or recommended not in {f["candidate"] for f in enriched}:
            problems.append(f"recommended {recommended!r} must match one of the two finalists")
        if problems:
            errors.append(f"{aid}: " + "; ".join(problems)); continue
        resolved[aid] = {"finalists": enriched, "recommended": recommended,
                         "notes": entry.get("notes") if isinstance(entry.get("notes"), str) else ""}
    return errors, resolved


def sheet_info(asset, index, out_dir):
    entry = index.get(asset["id"])
    rel = entry.get("sheet") if isinstance(entry, dict) else None
    path = REPO_ROOT / rel if rel else SHEETS_ROOT / asset["group"] / f"{asset['slug']}.jpg"
    return {"link": os.path.relpath(path, out_dir).replace(os.sep, "/"),
            "exists": path.is_file() and path.stat().st_size > 0}


def copy_finalists(assets, resolved):
    copied = 0
    for asset in assets:
        destination = RAW_ROOT / "shortlist" / asset["id"]
        destination.mkdir(parents=True, exist_ok=True)
        for finalist in resolved[asset["id"]]["finalists"]:
            shutil.copyfile(finalist["path"], destination / f"{finalist['candidate']}.png")
            copied += 1
    return copied


def write_review_copies(assets, resolved, out_dir):
    destination = out_dir / "finalists"
    destination.mkdir(parents=True, exist_ok=True)
    count = 0
    for asset in assets:
        for finalist in resolved[asset["id"]]["finalists"]:
            with Image.open(finalist["path"]) as opened:
                image = opened.convert("RGBA")
            image.thumbnail((REVIEW_PX, REVIEW_PX), Image.LANCZOS)
            canvas = Image.new("RGBA", (REVIEW_PX, REVIEW_PX), BG)
            canvas.alpha_composite(image, ((REVIEW_PX - image.width) // 2,
                                           (REVIEW_PX - image.height) // 2))
            path = destination / f"{asset['slug']}--{finalist['candidate']}.webp"
            canvas.convert("RGB").save(path, "WEBP", quality=WEBP_QUALITY, method=6)
            count += 1
    return count


def asset_section(asset, entry, sheet):
    rank = asset.get("rank")
    lines = [f"### {display_name(asset)}", "",
             f"`{asset['id']}` · family **{asset['family']}** · "
             f"rank **{rank if rank is not None else '—'}**", "",
             f"**Motif:** {motif_for(asset)}", ""]
    lines += ([f"[Contact sheet]({sheet['link']}) — all candidates.", ""] if sheet["exists"]
              else [f"**Contact sheet missing** (`{sheet['link']}`).", ""])
    lines += ["| Candidate | Score | Rationale | Image |", "|---|---|---|---|"]
    for finalist in entry["finalists"]:
        image = f"finalists/{asset['slug']}--{finalist['candidate']}.webp"
        lines.append(f"| `{finalist['candidate']}` | {fmt_score(finalist['score'])} | "
                     f"{md_cell(finalist['rationale'])} | [512 px]({image}) |")
    chosen = next(f for f in entry["finalists"] if f["candidate"] == entry["recommended"])
    lines += ["", f"**Recommended:** `{chosen['candidate']}` (score {fmt_score(chosen['score'])})."]
    if entry["notes"]:
        lines += ["", f"**Notes:** {md_cell(entry['notes'])}"]
    return lines + [""]


def build_markdown(assets, matrix, resolved, sheets, stats, today):
    emblem_count = sum(1 for asset in assets if asset["group"] == "emblem")
    lines = ["# Badge Artwork — Shortlist Review", "", f"**Date:** {today}", "",
             "**Scope:** OpenSpec tasks 8.1–8.5 (prompts, generation, processing, shortlist, "
             "report, review gate). Final compositing (8.6–8.8) is deferred until sign-off.", "",
             "Browse the gallery: [review.html](review.html).", "", "## Generation summary", ""]
    lines += stats_markdown(matrix, stats["candidates"], stats["processing"])
    lines += ["", "## Summary", "",
              "| Asset | Family | Rank | Finalist A | Finalist B | Recommended |",
              "|---|---|---|---|---|---|"]
    for asset in assets:
        entry, rank = resolved[asset["id"]], asset.get("rank")
        first, second = entry["finalists"]
        lines.append(f"| `{asset['id']}` | {asset['family']} | {rank if rank is not None else '—'} | "
                     f"`{first['candidate']}` | `{second['candidate']}` | `{entry['recommended']}` |")
    for group, title in GROUP_TITLES.items():
        group_assets = [a for a in assets if a["group"] == group]
        if not group_assets:
            continue
        lines += ["", f"## {title} ({len(group_assets)})", ""]
        for asset in group_assets:
            lines += asset_section(asset, resolved[asset["id"]], sheets[asset["id"]])
    lines += ["## Review gate", "", "No compositing has been performed. Nothing was written to "
              "`public/img/achievements/`; no migration, seed, or UI work was touched. The images above "
              "are review copies, not production assets.", "", "After sign-off:", "",
              "1. Record final picks in `selections.md`.",
              f"2. Build the PhotoCraft smart-object template and composite the {emblem_count} badges (8.6).",
              "3. Export 512 px main and 200 px thumb WebP files and verify sizes (8.7–8.8).",
              "4. Normalise each frame's outer bbox to 1016 px and re-cut the inner at 880 px; rank rings are already 880/800.", ""]
    return "\n".join(lines)


def build_html(assets, resolved, sheets, today):
    emblem_count = sum(1 for asset in assets if asset["group"] == "emblem")
    rows, sections = [], []
    for asset in assets:
        entry = resolved[asset["id"]]
        name, anchor = display_name(asset), f"asset-{asset['group']}-{asset['slug']}"
        rank = asset.get("rank")
        rank_text = str(rank) if rank is not None else "—"
        first, second = entry["finalists"]
        rows.append(f'<tr><td><a href="#{anchor}">{esc(name)}</a></td><td>{esc(asset["family"])}</td>'
                    f'<td>{esc(rank_text)}</td><td><code>{esc(first["candidate"])}</code> / '
                    f'<code>{esc(second["candidate"])}</code></td><td><code>{esc(entry["recommended"])}</code></td></tr>')
        sheet = sheets[asset["id"]]
        sheet_html = (f'<figure class="sheet"><img src="{esc(sheet["link"])}" alt="Contact sheet for '
                      f'{esc(name)}" loading="lazy"><figcaption>Contact sheet — all candidates'
                      '</figcaption></figure>'
                      if sheet["exists"] else
                      f'<p class="missing">Contact sheet missing — expected <code>{esc(sheet["link"])}</code></p>')
        cards = []
        for finalist in entry["finalists"]:
            recommended = finalist["candidate"] == entry["recommended"]
            image = f"finalists/{asset['slug']}--{finalist['candidate']}.webp"
            badge = '<span class="badge">Recommended</span>' if recommended else ""
            cards.append(f'<article class="card{" rec" if recommended else ""}"><div class="card-head">'
                         f'<code>{esc(finalist["candidate"])}</code><span class="score">'
                         f'{esc(fmt_score(finalist["score"]))}</span>{badge}</div>'
                         f'<img src="{esc(image)}" alt="{esc(name)} finalist {esc(finalist["candidate"])}" '
                         f'loading="lazy"><p>{esc(finalist["rationale"])}</p></article>')
        notes = (f'<p class="notes"><strong>Notes:</strong> {esc(entry["notes"])}</p>' if entry["notes"] else "")
        sections.append(f'<section class="asset" id="{anchor}"><h2>{esc(name)} '
                        f'<span class="slug">{esc(asset["id"])}</span></h2>'
                        f'<p class="meta">Family <strong>{esc(asset["family"])}</strong> · Rank '
                        f'<strong>{esc(rank_text)}</strong></p>'
                        f'<p class="motif"><strong>Motif:</strong> {esc(motif_for(asset))}</p>'
                        f'{sheet_html}<div class="cards">{"".join(cards)}</div>{notes}</section>')
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Badge Artwork — Shortlist Review</title><style>{CSS}</style></head>
<body><nav class="topbar"><h1>Badge Artwork — Shortlist Review</h1>
<p class="meta">{esc(today)} · OpenSpec tasks 8.1–8.5 · review copies only; no compositing performed</p>
<div class="tablewrap"><table>
<thead><tr><th>Asset</th><th>Family</th><th>Rank</th><th>Finalists</th><th>Recommended</th></tr></thead>
<tbody>{"".join(rows)}</tbody></table></div></nav>
<main>{"".join(sections)}</main>
<footer><h2>Review gate</h2>
<p>No compositing has been performed. Nothing was written to <code>public/img/achievements/</code>;
no migration, seed, or UI work was touched. These are review copies, not production assets.</p>
<p>After sign-off: record picks in <code>selections.md</code>, build the PhotoCraft smart-object
template and composite the {emblem_count} badges (8.6), then export 512 px main and 200 px thumb WebP files
and verify sizes (8.7–8.8). Before compositing, normalise each frame's outer bbox to 1016 px and
re-cut the inner at 880 px; rank rings are already 880/800.</p>
<p><a href="shortlist.md">Markdown report</a> · <a href="selections.md">Selection sheet</a></p>
</footer></body></html>
"""


def build_selections(assets, resolved, today):
    lines = ["# Badge Artwork — Final Selections", "", f"**Date:** {today}", "",
             "Replace each `Pending` pick with `a-<seed>` or `b-<seed>` from that asset's two finalists. "
             "Rank rings are reference only — F1 removes them.",
             "", "| Asset | Finalist A | Finalist B | Your pick | Notes |", "|---|---|---|---|---|"]
    for asset in assets:
        first, second = resolved[asset["id"]]["finalists"]
        selection = "Reference only" if asset["group"] == "rank" else "Pending"
        lines.append(f"| `{asset['id']}` | `{first['candidate']}` | `{second['candidate']}` | "
                     f"{selection} |  |")
    lines += ["", "Picks are recorded here only; no compositing or production assets exist yet.", ""]
    return "\n".join(lines)


def write_template(path, assets, force):
    if path.exists() and not force:
        print(f"ERROR: {path} already exists; use --force to overwrite", file=sys.stderr)
        return 1
    data = {"assets": {a["id"]: {"finalists": [], "recommended": None, "notes": ""} for a in assets}}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {path} ({len(assets)} assets)")
    return 0


def render(args, matrix, assets):
    if not args.shortlist.is_file():
        print(f"ERROR: shortlist not found: {args.shortlist}\nRun --write-template first.", file=sys.stderr)
        return 1
    try:
        shortlist = json.loads(args.shortlist.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: cannot read shortlist {args.shortlist}: {exc}", file=sys.stderr)
        return 1
    errors, resolved = validate_shortlist(shortlist, assets)
    if errors:
        print(f"ERROR: shortlist is not ready; {len(errors)} asset(s) invalid:", file=sys.stderr)
        for error in errors:
            print(f"  {error}", file=sys.stderr)
        return 2
    out_dir = args.out_dir.expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    try:
        # Only the real report root owns the raw_assets masters; a draft render
        # with --out-dir must not mutate them.
        copied = copy_finalists(assets, resolved) if out_dir == REPORT_ROOT.resolve() else 0
        webp_count = write_review_copies(assets, resolved, out_dir)
    except OSError as exc:
        print(f"ERROR: could not prepare finalist images: {exc}", file=sys.stderr)
        return 1
    index = {}
    if SHEET_INDEX.is_file():
        try:
            index = json.loads(SHEET_INDEX.read_text(encoding="utf-8")).get("assets", {})
        except (OSError, json.JSONDecodeError, AttributeError):
            pass
        if not isinstance(index, dict):
            index = {}
    if not index:
        print("note: sheets/index.json not found or empty; using expected sheet paths")
    sheets = {asset["id"]: sheet_info(asset, index, out_dir) for asset in assets}
    today = date.today().isoformat()
    stats = {"candidates": log_summary(CANDIDATES_LOG, lambda r: (r.get("asset"), r.get("variant"), r.get("seed"))),
             "processing": log_summary(PROCESSING_LOG, lambda r: (r.get("asset"), r.get("candidate")))}
    outputs = {"shortlist.md": build_markdown(assets, matrix, resolved, sheets, stats, today),
               "review.html": build_html(assets, resolved, sheets, today),
               "selections.md": build_selections(assets, resolved, today)}
    for name, content in outputs.items():
        path = out_dir / name
        if name == "selections.md" and path.exists():
            if path.read_text(encoding="utf-8") != content:
                print(f"WARNING: {path} differs from the generated sheet; leaving it untouched. "
                      "Delete it to regenerate.")
            else:
                print(f"note: {path} exists; leaving it untouched")
            continue
        path.write_text(content, encoding="utf-8")
    missing = [a["id"] for a in assets if not sheets[a["id"]]["exists"]]
    print(f"rendered {len(assets)} assets, {webp_count} review copies")
    print(f"copied {copied} finalist(s) to {RAW_ROOT / 'shortlist'}")
    print(f"missing contact sheets ({len(missing)}): {', '.join(missing) if missing else 'none'}")
    print("outputs:")
    for name in outputs:
        print(f"  {out_dir / name}")
    print(f"  {out_dir / 'finalists'}/")
    return 1 if missing else 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--write-template", action="store_true",
                        help="create an empty shortlist.json for every asset")
    parser.add_argument("--render", action="store_true", help="render the report (default)")
    parser.add_argument("--force", action="store_true",
                        help="with --write-template, overwrite an existing shortlist.json")
    parser.add_argument("--shortlist", type=Path, default=SHORTLIST_PATH,
                        help="shortlist JSON (default: reports/badge-art/shortlist.json)")
    parser.add_argument("--out-dir", type=Path, default=REPORT_ROOT,
                        help="output directory (default: reports/badge-art)")
    args = parser.parse_args(argv)
    if args.write_template and args.render:
        print("ERROR: --write-template and --render are mutually exclusive", file=sys.stderr)
        return 2
    if args.force and not args.write_template:
        print("ERROR: --force only applies to --write-template", file=sys.stderr)
        return 2
    try:
        matrix = json.loads(PROMPTS_PATH.read_text(encoding="utf-8"))
        assets = matrix["assets"]
        if not isinstance(assets, list) or not assets:
            raise ValueError("no assets")
        if not all(isinstance(a, dict) and a.get("id") for a in assets):
            raise ValueError("asset missing id")
        seeds = matrix.get("seeds")
        if not isinstance(seeds, dict) or not all(isinstance(seeds.get(g), list) for g in GROUP_TITLES):
            raise ValueError("seeds missing")
    except (OSError, TypeError, ValueError, KeyError, json.JSONDecodeError) as exc:
        print(f"ERROR: cannot read prompt matrix {PROMPTS_PATH}: {exc}", file=sys.stderr)
        return 1
    return write_template(args.shortlist, assets, args.force) if args.write_template else render(args, matrix, assets)


if __name__ == "__main__":
    sys.exit(main())
