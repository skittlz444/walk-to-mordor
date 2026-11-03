# Badge Art Source Layers

Locked, reusable production layers for badge compositing. Tracked so they survive `raw_assets/` cleanup.

| Folder | Contents |
|---|---|
| `frames/` | One 1024 RGBA family frame per `badge_type`: 1016 px outer, 880 px inner, transparent core. |
| `bosses/` | `<rank>.png` is the 800 px RGBA master; `<rank>-tile.png` is the 90 × 90 ready-to-place tile with 70 px art; `<rank>-shadow.png` is the matching contact shadow. |

- Place the boss tile at `(466, 934)` and the shadow at `(466, 936)` on a 1024 canvas, then clip both to the badge alpha.
- Picks and rank mapping: `scripts/badge-art/final-selections.json`.
- Decisions and output paths: `docs/badge-art-decisions.md`.
- Rebuild: `/run/media/skittlz/LinuxStorageSSD/github/comfyui/venv/bin/python scripts/badge-art/rebuild_finals.py`.

Do not edit these files directly. Change the candidate in `final-selections.json`, regenerate the layer, and rebuild the set.

Only reusable frames and bosses are kept here. Emblems are achievement-specific; their final composites are in `public/img/achievements/` and `public/img/achievements/full/`.
