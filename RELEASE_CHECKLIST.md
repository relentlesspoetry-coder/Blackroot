# Blackroot Release Checklist (Roadmap Item 22)

Validation runs as part of every release. Two layers: **CLI checks** (automated by `validate.sh`) and
the **in-browser boot validation suite** (must be checked in a browser — it needs the running game).

## Per-version process

1. **Back up the PREVIOUS version first** (before any edit):
   `zip -r -q "backups/Blackroot <PREV>.zip" . -x "blender/*" -x "backups/*" -x "assets/atlases/*.png"`
   — never overwrite an existing backup.

   > **Why `assets/atlases/*.png` is excluded (V0.20.53):** the baked atlas pages are 87MiB of
   > already-compressed PNG, so zip cannot shrink them — and they are a **reproducible build artifact**,
   > not source. Measured: with the exclusion a full backup is **165MiB, exactly the size of the
   > pre-atlas V0.20.51 backup**; without it, ~252MiB. Note the pattern excludes only the **PNG pages**
   > — `entities.json` and `entities.manifest.js` stay in (they compress well), so a restored tree still
   > records exactly which 7,969 frames it expects.
   >
   > **A restored backup therefore has no atlas pages** and will boot with `pageErrors` and fall back to
   > procedural drawing (playable, just slow). To restore them, re-run the bake — see
   > `docs/V0.20.53_ATLAS_INSTALLED.md`, or in short:
   > `python3 -m http.server 8899` → `http://localhost:8899/tools/sprite-baker.html` →
   > **Load Renderers** → **FULL BAKE & DOWNLOAD** → copy `entities_*.png` into `assets/atlases/`.
   >
   > **Keep one copy of the current pages somewhere outside `backups/`.** As of V0.20.53 the originals
   > from the bake run are still in `~/Downloads/entities_*.png` (all 19, byte-identical to the
   > installed copies — verified by md5). That folder gets cleaned out periodically, so move them
   > somewhere durable if you want to avoid a rebake.
2. Make the change (surgical, root-cause, in the owning module).
3. Bump the version across **all** surfaces so they match:
   - `core/config.js`: `DREAM_REALMS_VERSION`, `DREAM_REALMS_BUILD_NAME`, and the top `// <VER>:` comment
   - rename `Blackroot <PREV>.html` → `Blackroot <VER>.html`, and update its `<title>` + add a
     `<section class="patchNoteEntry">` note
   - `PATCH_NOTES.md`, `VERSION.txt`, `README.txt` (first line = the new version)
   - a `docs/<VER>_*.md` report
4. **Run the CLI validation:** `bash validate.sh` → must print `RESULT: PASS`.
   It covers: `node --check` on every JS file, `JSON.parse` on every JSON file, and version
   consistency across config / HTML / VERSION / PATCH_NOTES / README.
5. **Confirm the in-browser boot validation suite is PASS:** open the new
   `Blackroot <VER>.html`, then in the browser console:
   ```js
   DarkWoodsGame.runValidationSuite()
   ```
   The boot log also prints one line:
   `[Dream Realms] validation suite: PASS - stat-pipeline N/N, items sourced X/Y, 0 data issue(s), 0 compiler error(s), W descriptor warning(s).`
   Requirements to ship:
   - **stat-pipeline**: all checks pass (currently 14/14 — see `runStatPipelineSelfTest`)
   - **items sourced**: X == Y (every item obtainable; 0 unsourced)
   - **data issues**: 0 (no unknown item-stat keys / broken set references)
   - **compiler errors**: 0
   - **descriptor warnings**: advisory only — the current 7 are pre-existing quest-giver-name
     mismatches (Roadmap Item 1), not a release blocker.
   - **0 console errors** on boot.
6. Report: files changed, validation results, manual tests, next step. Then STOP.

## What each layer checks

| Check | Where | Blocks release? |
|-------|-------|-----------------|
| JS syntax (`node --check`) | `validate.sh` | yes |
| JSON parse | `validate.sh` | yes |
| Version consistency | `validate.sh` | yes |
| Stat-pipeline regression (idempotency, equip/unequip, set bonuses, save/load, death/respawn, level growth, HP-ratio, attribute aliases) | boot suite | yes |
| Item data integrity (stat keys, set refs) | boot suite | yes |
| Item obtainability (every item sourced) | boot suite | yes |
| Compiler errors | boot suite | yes |
| Descriptor reference warnings | boot suite | advisory (Item 1) |
| Console errors | browser | yes |

## Entry points

- `bash validate.sh` — CLI checks.
- `DarkWoodsGame.runValidationSuite()` — full in-browser report `{ ok, summary, sections }`.
- `DarkWoodsGame.runStatPipelineSelfTest()` — just the stat-pipeline regression checks.
- `DarkWoodsGame.validateItemData()` — just the item data-integrity check.
- `DreamRealms.Registry.runBootValidation()` — descriptor references + compiler errors + obtainability.
