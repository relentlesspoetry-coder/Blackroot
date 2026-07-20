#!/usr/bin/env bash
# Blackroot - CLI release validation (Roadmap Item 22).
# Runs the automatable checks: JS syntax, JSON parse, and version consistency across the shipped
# surfaces. The IN-BROWSER boot validation suite (DarkWoodsGame.runValidationSuite() -> must be PASS)
# is NOT runnable from the CLI; see RELEASE_CHECKLIST.md for the full process.
set -u
cd "$(dirname "$0")"
fail=0

echo "== node --check (all JS, excluding blender/ and backups/) =="
while IFS= read -r -d '' f; do
  node --check "$f" || { echo "  SYNTAX FAIL: $f"; fail=1; }
done < <(find . -path ./blender -prune -o -path ./backups -prune -o -name '*.js' -print0)
[ "$fail" -eq 0 ] && echo "  all JS OK"

echo "== JSON validation (excluding blender/ and backups/) =="
while IFS= read -r -d '' f; do
  node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$f" \
    || { echo "  JSON FAIL: $f"; fail=1; }
done < <(find . -path ./blender -prune -o -path ./backups -prune -o -name '*.json' -print0)
[ "$fail" -eq 0 ] && echo "  all JSON OK"

echo "== no duplicate method definitions =="
# V0.20.3: JS silently lets the LAST duplicate method win and turns the earlier one into dead code that
# still looks finished. node --check cannot see it. It cost two real bugs: drawOrbWeb (threw
# "rnd is not a function" every frame - webbed bushes never drew) and drawCaveStairs (up/down stairs
# lost their labels). Nothing else in the toolchain looks for this.
node tools/check-duplicate-methods.js || fail=1

echo "== VFX slash styles are implemented =="
# V0.20.0 (Roadmap Item 6): 'slam' was passed by titan_chop, perfect_masterstroke and the mercenary,
# and NO renderer branched on it - so the fighter's heaviest hits silently drew the level-1 slash.
# This CANNOT be a runtime data validator: the styles are string literals in code, not data, and the
# renderer's `else` fallback means an unimplemented style still draws something. So it is checked here,
# at the source level, where it is actually knowable.
node tools/check-vfx-styles.js || fail=1

echo "== Loot table item references resolve =="
# V0.20.40 (Roadmap Item 12): a loot table that drops a non-existent itemId is a reward that silently
# never materializes. The audit found 0 dangling across 178 loot refs; this guards that invariant.
node tools/check-loot-references.js || fail=1

echo "== version consistency =="
VER=$(grep -oE "DREAM_REALMS_VERSION = '[^']+'" core/config.js | grep -oE "V[0-9.]+")
echo "  config version: ${VER:-<none>}"
if [ -z "${VER:-}" ]; then
  echo "  could not read DREAM_REALMS_VERSION from core/config.js"; fail=1
else
  [ -f "Blackroot $VER.html" ]            || { echo "  MISSING: Blackroot $VER.html"; fail=1; }
  grep -q "^// $VER:" core/config.js      || { echo "  core/config.js missing top comment '// $VER:'"; fail=1; }
  grep -q "$VER" VERSION.txt              || { echo "  VERSION.txt missing $VER"; fail=1; }
  head -1 PATCH_NOTES.md | grep -q "$VER" || { echo "  PATCH_NOTES.md first line missing $VER"; fail=1; }
  head -1 README.txt | grep -q "$VER"     || { echo "  README.txt first line missing $VER"; fail=1; }
  htmls=$(ls -1 Blackroot\ *.html 2>/dev/null | wc -l)
  [ "$htmls" -eq 1 ]                       || { echo "  expected exactly one 'Blackroot *.html', found $htmls"; fail=1; }
  [ "$fail" -eq 0 ] && echo "  version $VER consistent across config / HTML / VERSION / PATCH_NOTES / README"
fi

echo ""
if [ "$fail" -eq 0 ]; then
  echo "RESULT: PASS (CLI checks). Still confirm the in-browser boot suite is PASS - see RELEASE_CHECKLIST.md."
else
  echo "RESULT: FAIL"
fi
exit "$fail"
