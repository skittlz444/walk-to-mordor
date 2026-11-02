#!/usr/bin/env python3
"""Generate badge candidate images with FLUX.3 Klein on a local ComfyUI server.

Usage:
  python3 scripts/badge-art/generate.py --list
  python3 scripts/badge-art/generate.py --dry-run --only emblem/habit-first-steps
  python3 scripts/badge-art/generate.py --group emblem --variants a --seeds 112358
  python3 scripts/badge-art/generate.py --only frame/journey --force

The prompt matrix (scripts/badge-art/prompts.json) holds the shared style prefix
and suffix, the per-asset motif variants and the default seed sets. Every graph
is a plain FLUX.3 text-to-image graph: no LoRA, 1024x1024, 16 steps, cfg 1.0.

ComfyUI's SaveImage always appends a counter, so a finished image is copied to
the canonical path output/badges/<asset>/<variant>-<seed>.png and then into
raw_assets/badges/candidates/<asset>/<variant>-<seed>.png. Results append to
reports/badge-art/candidates.jsonl; nothing is ever rewritten.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
PROMPTS_PATH = HERE / "prompts.json"
LOG_PATH = REPO_ROOT / "reports" / "badge-art" / "candidates.jsonl"
RAW_ROOT = REPO_ROOT / "raw_assets" / "badges"
COMFY_ROOT = Path(os.environ.get("COMFYUI_ROOT", "/run/media/skittlz/LinuxStorageSSD/github/comfyui"))
COMFY_OUTPUT = COMFY_ROOT / "output"

DEFAULT_SERVER = "http://127.0.0.1:8188"
MODEL = "flux3-image-klein-int8-convrot.safetensors"
TEXT_ENCODER = "qwen3vl_4b_int8_convrot.safetensors"
VAE = "flux2-vae.safetensors"
WIDTH = 1024
HEIGHT = 1024
STEPS = 16
CFG = 1.0
SAMPLER = "er_sde"
SCHEDULER = "simple"

TARGET_OUTER_PX = {"emblem": 800, "frame": 1016, "rank": 880}
GROUPS = ("emblem", "frame", "rank")


def load_matrix(path):
    """Load and validate the prompt matrix. Raises ValueError with a clear reason."""
    data = json.loads(path.read_text(encoding="utf-8"))
    for key in ("style_prefix", "style_suffix", "assets"):
        if not data.get(key):
            raise ValueError(f"{path}: missing or empty {key!r}")
    lowered = json.dumps(data).lower()
    if "watercolour" in lowered or "watercolor" in lowered:
        raise ValueError(f"{path}: prompt matrix must not request a watercolour treatment")

    seen = set()
    for asset in data["assets"]:
        asset_id = asset.get("id", "")
        group = asset.get("group")
        if group not in GROUPS:
            raise ValueError(f"{asset_id or '<no id>'}: bad group {group!r}")
        if not asset.get("slug"):
            raise ValueError(f"{asset_id or '<no slug>'}: missing slug")
        if not asset.get("name"):
            raise ValueError(f"{asset_id}: missing display name")
        if asset_id != f"{group}/{asset['slug']}":
            raise ValueError(f"{asset_id}: id must equal {group}/{asset['slug']}")
        if asset_id in seen:
            raise ValueError(f"{asset_id}: duplicate asset id")
        seen.add(asset_id)
        if "family" not in asset or "rank" not in asset:
            raise ValueError(f"{asset_id}: family and rank are required")
        if int(asset.get("canvas", 0)) != 1024:
            raise ValueError(f"{asset_id}: canvas must be 1024")
        if int(asset.get("target_outer_px", 0)) != TARGET_OUTER_PX[group]:
            raise ValueError(f"{asset_id}: target_outer_px must be {TARGET_OUTER_PX[group]}")

        variants = asset.get("variants")
        if not isinstance(variants, list) or len(variants) != 2:
            raise ValueError(f"{asset_id}: exactly two variants are required")
        if len({v.get("id") for v in variants}) != 2:
            raise ValueError(f"{asset_id}: variant ids must be unique")
        for variant in variants:
            if not variant.get("id") or not variant.get("prompt", "").strip():
                raise ValueError(f"{asset_id}: every variant needs an id and a prompt")

    seeds = data.get("seeds")
    used_groups = {asset["group"] for asset in data["assets"]}
    if not isinstance(seeds, dict) or any(group not in seeds for group in used_groups):
        raise ValueError(f"{path}: seeds must define {', '.join(sorted(used_groups))}")
    for group in used_groups:
        group_seeds = seeds[group]
        if not group_seeds or any(not isinstance(s, int) for s in group_seeds):
            raise ValueError(f"seeds: {group} must be a non-empty list of integers")
    return data


def compose_prompt(matrix, variant_prompt):
    parts = (matrix["style_prefix"], variant_prompt, matrix["style_suffix"])
    return " ".join(part.strip() for part in parts if part and part.strip())


def select_assets(assets, only, group):
    selected = []
    for asset in assets:
        if group and asset["group"] != group:
            continue
        if only and not any(token == asset["slug"] or token in asset["id"] for token in only):
            continue
        selected.append(asset)
    return selected


def seeds_for(asset, matrix, override):
    return override or matrix["seeds"][asset["group"]]


def build_candidates(assets, matrix, variants, seeds_override):
    candidates = []
    for asset in assets:
        seeds = seeds_for(asset, matrix, seeds_override)
        for variant in asset["variants"]:
            if variants and variant["id"] not in variants:
                continue
            prompt = compose_prompt(matrix, variant["prompt"])
            for seed in seeds:
                candidates.append({
                    "asset": asset["id"],
                    "group": asset["group"],
                    "variant": variant["id"],
                    "seed": int(seed),
                    "prompt": prompt,
                })
    return candidates


def build_graph(candidate):
    return {
        "unet": {"class_type": "UNETLoader", "inputs": {"unet_name": MODEL, "weight_dtype": "default"}},
        "clip": {
            "class_type": "CLIPLoader",
            "inputs": {"clip_name": TEXT_ENCODER, "type": "flux3", "device": "default"},
        },
        "vae": {"class_type": "VAELoader", "inputs": {"vae_name": VAE}},
        "positive": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": candidate["prompt"], "clip": ["clip", 0]},
        },
        "negative": {"class_type": "CLIPTextEncode", "inputs": {"text": "", "clip": ["clip", 0]}},
        "latent": {
            "class_type": "EmptyFlux2LatentImage",
            "inputs": {"width": WIDTH, "height": HEIGHT, "batch_size": 1},
        },
        "ksampler": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["unet", 0],
                "positive": ["positive", 0],
                "negative": ["negative", 0],
                "latent_image": ["latent", 0],
                "seed": candidate["seed"],
                "steps": STEPS,
                "cfg": CFG,
                "sampler_name": SAMPLER,
                "scheduler": SCHEDULER,
                "denoise": 1.0,
            },
        },
        "decode": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["ksampler", 0], "vae": ["vae", 0]},
        },
        "save": {
            "class_type": "SaveImage",
            "inputs": {
                "images": ["decode", 0],
                "filename_prefix": f"badges/{candidate['asset']}/{candidate['variant']}-{candidate['seed']}",
            },
        },
    }


def http_json(url, payload=None, timeout=60):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "replace")[:2000]
        raise RuntimeError(f"HTTP {exc.code} from {url}: {body}") from exc


def server_reachable(server):
    try:
        http_json(f"{server}/system_stats", timeout=5)
        return True
    except (urllib.error.URLError, OSError, ValueError, RuntimeError):
        return False


def wait_for(server, prompt_id, timeout):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            history = http_json(f"{server}/history/{prompt_id}")
        except (urllib.error.URLError, OSError, ValueError, RuntimeError):
            time.sleep(1)
            continue
        entry = history.get(prompt_id)
        if entry:
            status = entry.get("status", {})
            if entry.get("outputs") or status.get("status_str") in ("error", "success"):
                return entry
        time.sleep(1)
    raise TimeoutError(f"prompt {prompt_id} did not finish in {timeout}s")


def extract_images(entry):
    images = []
    for node_output in entry.get("outputs", {}).values():
        for item in node_output.get("images", []):
            subfolder = item.get("subfolder", "")
            name = item["filename"]
            images.append(f"{subfolder}/{name}" if subfolder else name)
    return images


def output_paths(candidate):
    name = f"{candidate['variant']}-{candidate['seed']}.png"
    comfy = COMFY_OUTPUT / "badges" / candidate["asset"] / name
    raw = RAW_ROOT / "candidates" / candidate["asset"] / name
    return comfy, raw


def existing_output(candidate):
    """The raw_assets copy is the completion marker.

    A ComfyUI-only file is not enough: if the copy to raw_assets was interrupted,
    skipping would leave the candidate missing from the processing stage forever.
    """
    _, raw = output_paths(candidate)
    if raw.exists() and raw.stat().st_size > 0:
        return raw
    return None


def repo_relative(path):
    try:
        return str(path.resolve().relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def comfy_relative(path):
    try:
        return str(path.resolve().relative_to(COMFY_ROOT))
    except ValueError:
        return str(path)


def append_log(record):
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")


def run_candidate(candidate, server, timeout):
    graph = build_graph(candidate)
    comfy_path, raw_path = output_paths(candidate)
    source = None
    started = time.time()
    record = {
        "asset": candidate["asset"],
        "group": candidate["group"],
        "variant": candidate["variant"],
        "seed": candidate["seed"],
        "file": None,
        "comfy_file": None,
        "status": "error",
        "wall_s": 0.0,
        "prompt": candidate["prompt"],
        "error": None,
    }

    try:
        response = http_json(
            f"{server}/prompt",
            {"prompt": graph, "client_id": "badge-art"},
            timeout=60,
        )
        entry = wait_for(server, response["prompt_id"], timeout)
        record["wall_s"] = round(time.time() - started, 1)

        status = entry.get("status", {})
        if status.get("status_str") == "error":
            messages = json.dumps(status.get("messages", []))[:2000]
            raise RuntimeError(f"ComfyUI reported an error: {messages}")

        images = extract_images(entry)
        if not images:
            raise RuntimeError("ComfyUI finished without returning an image")

        source = COMFY_OUTPUT / images[0]
        if not source.exists() or source.stat().st_size == 0:
            raise RuntimeError(f"output image missing or empty: {comfy_relative(source)}")

        comfy_path.parent.mkdir(parents=True, exist_ok=True)
        if source.resolve() != comfy_path.resolve():
            shutil.copy2(source, comfy_path)
        record["comfy_file"] = comfy_relative(comfy_path)

        raw_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(comfy_path, raw_path)
        record["file"] = repo_relative(raw_path)
        record["status"] = "success"
    except Exception as exc:  # noqa: BLE001 - one failed candidate must not stop the batch
        record["wall_s"] = round(time.time() - started, 1)
        record["error"] = f"{type(exc).__name__}: {exc}"
        if record["comfy_file"] is None and source is not None and source.exists() and source.stat().st_size > 0:
            record["comfy_file"] = comfy_relative(source)
        if record["file"] is None and record["comfy_file"]:
            # The copy into raw_assets failed; keep the ComfyUI path so the image is findable.
            record["file"] = record["comfy_file"]

    append_log(record)
    return record


def list_assets(assets, matrix, variants, seeds_override):
    total = 0
    for asset in assets:
        seeds = seeds_for(asset, matrix, seeds_override)
        variant_ids = [v["id"] for v in asset["variants"] if not variants or v["id"] in variants]
        count = len(variant_ids) * len(seeds)
        total += count
        print(
            f"{asset['id']:54s} {asset['group']:6s} family={str(asset['family']):12s} "
            f"rank={str(asset['rank']):10s} variants={','.join(variant_ids) or '-':5s} "
            f"seeds={','.join(str(s) for s in seeds)} candidates={count}"
        )
    print(f"\ntotal: {len(assets)} assets, {total} candidates")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--prompts", default=str(PROMPTS_PATH), help="prompt matrix JSON")
    parser.add_argument("--server", default=DEFAULT_SERVER, help="ComfyUI base URL")
    parser.add_argument("--only", action="append", metavar="ASSET",
                        help="asset id or slug fragment; repeatable")
    parser.add_argument("--group", choices=GROUPS, help="only this layer group")
    parser.add_argument("--variants", help="comma-separated variant ids (default: all)")
    parser.add_argument("--seeds", help="comma-separated seeds, overrides the defaults")
    parser.add_argument("--force", action="store_true", help="regenerate existing files")
    parser.add_argument("--dry-run", action="store_true", help="print graphs without POSTing")
    parser.add_argument("--timeout", type=int, default=900, help="seconds per candidate")
    parser.add_argument("--list", action="store_true", help="list the selected matrix and exit")
    args = parser.parse_args(argv)

    try:
        matrix = load_matrix(Path(args.prompts))
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    assets = select_assets(matrix["assets"], args.only, args.group)
    variants = [v.strip() for v in args.variants.split(",") if v.strip()] if args.variants else []
    if args.seeds:
        try:
            seeds_override = [int(s.strip()) for s in args.seeds.split(",") if s.strip()]
        except ValueError:
            print("ERROR: --seeds must be a comma-separated list of integers", file=sys.stderr)
            return 1
        if not seeds_override:
            print("ERROR: --seeds was empty", file=sys.stderr)
            return 1
        seeds_override = list(dict.fromkeys(seeds_override))
    else:
        seeds_override = []

    known_variants = {v["id"] for asset in matrix["assets"] for v in asset["variants"]}
    unknown = sorted(set(variants) - known_variants)
    if unknown:
        print(f"ERROR: unknown variant(s): {', '.join(unknown)}", file=sys.stderr)
        return 1

    if args.list:
        list_assets(assets, matrix, variants, seeds_override)
        return 0

    candidates = build_candidates(assets, matrix, variants, seeds_override)
    if not candidates:
        print("nothing selected", file=sys.stderr)
        return 0

    if args.dry_run:
        payload = {
            "dry_run": True,
            "model": MODEL,
            "text_encoder": TEXT_ENCODER,
            "vae": VAE,
            "width": WIDTH,
            "height": HEIGHT,
            "steps": STEPS,
            "cfg": CFG,
            "sampler": SAMPLER,
            "scheduler": SCHEDULER,
            "count": len(candidates),
            "candidates": [
                {
                    "asset": candidate["asset"],
                    "group": candidate["group"],
                    "variant": candidate["variant"],
                    "seed": candidate["seed"],
                    "prompt": candidate["prompt"],
                    "graph": build_graph(candidate),
                }
                for candidate in candidates
            ],
        }
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        return 0

    pending = []
    skipped = 0
    for candidate in candidates:
        existing = None if args.force else existing_output(candidate)
        if existing:
            skipped += 1
            label = f"{candidate['asset']} {candidate['variant']}-{candidate['seed']}"
            print(f"skip {label} (exists: {repo_relative(existing)})")
        else:
            pending.append(candidate)

    if not pending:
        print(f"\nsummary: 0 generated, {skipped} skipped, 0 failed")
        return 0

    if not server_reachable(args.server):
        print(f"ERROR: ComfyUI is not reachable at {args.server}", file=sys.stderr)
        return 1

    print(f"running {len(pending)} candidate(s) against {args.server}")
    succeeded = 0
    failed = 0
    try:
        for index, candidate in enumerate(pending, 1):
            label = f"{candidate['asset']} {candidate['variant']}-{candidate['seed']}"
            print(f"[{index}/{len(pending)}] {label} ...", end=" ", flush=True)
            record = run_candidate(candidate, args.server, args.timeout)
            if record["status"] == "success":
                succeeded += 1
                detail = record["file"]
            else:
                failed += 1
                detail = record["error"]
            print(f"{record['status']} {record['wall_s']}s | {detail}")
    except KeyboardInterrupt:
        print("\ninterrupted; partial results are logged", file=sys.stderr)
        return 130

    print(f"\nsummary: {succeeded} generated, {skipped} skipped, {failed} failed")
    attempted = succeeded + failed
    if attempted and failed > attempted * 0.10:
        print(f"ERROR: {failed} of {attempted} candidates failed (>10%); review the log before processing",
              file=sys.stderr)
        return 1
    return 0 if succeeded else 1


if __name__ == "__main__":
    sys.exit(main())
