# Profile View / Settings Mockups

High-fidelity design artifacts for the `profile-view-settings` change. They reuse
the repo's real stylesheets (`main.css` and its imports, `drawer.css`, `party.css`,
`friends.css`, `badge-display.css`) and real badge/avatar assets, so what you see is
what the app would render. Only the proposed elements (avatar-as-button, Settings
CTA, styled Back button, per-field auto-save status, picker modal chrome with
current-avatar preview, skeleton, Account card) come from `mockups.css` — those
styles would become `public/css/profile-view.css` (view/picker chrome) and
`public/css/profile.css` (Back button, auto-save status, Account card) at
implementation time.

**Tracking**: only the files in this folder are tracked in git. The PNG screenshots
under `_inspection-screenshots/profile-view-settings/` are a gitignored review
output, regenerable from these mockups (see the README next to the PNGs).

## Files

| File | Shows |
|---|---|
| `view.html` | The new read-only `/profile` view: hero (avatar button with camera badge, username, Total Distance "2412.50 km", Member Since "August 15, 2024"), "Heading to: Reach northern edge of Ithilien", "Journey: Frodo & Sam" chip, gold "Edit Profile & Settings" CTA, then **Fellowships card** (`{ id, name }`, no shared flag — rendered by `ProfileViewIsland` before the badge island), then the badge grid (The Road to Mordor 5/8 with rank pills bronze/bronze/silver/silver/gold, then Other: Faithful Walker silver ×4 first, First Steps bronze — newest-earned first) |
| `settings.html` | The new `/profile/settings`: SSR-shell styled Back to profile button at the top (present before the islands hydrate), "Changes save automatically" note, inline auto-save statuses for username/email (one shown post-save "Saved", the other empty — the default), avatar + "Change avatar", toggles, journey select, moved Push card, then `ProfileAccountIsland` with the Logout card. There is no Save button or bottom action bar. |
| `avatar-modal.html` | The view page with the shared `AvatarPickerModal` open: "Choose Avatar" title + close, **current-avatar preview row outside the gallery**, 64 px radiogroup gallery with the selected gold ring, "Saved" status, Use initials / Done |
| `mockups.css` | Proposed-only styles (documented draft of `profile-view.css` view/picker chrome and `profile.css` Back button/auto-save status/Account styles); includes the CTA `box-sizing: border-box` overflow fix |

## How to render

Serve the **repo root** (CSS/image URLs are absolute) and open the mockups:

```bash
python3 -m http.server 8123   # from the repository root
# then browse http://127.0.0.1:8123/openspec/changes/profile-view-settings/mockups/view.html
```

The screenshot harness maps `/css/*` and `/img/*` onto `public/` via Playwright route
interception. Screenshots for review live in the gitignored
`_inspection-screenshots/profile-view-settings/` folder (390 px and 360 px mobile
widths at 2× DPR); see the README there for the exact files, the overflow check, and
the regeneration command.
