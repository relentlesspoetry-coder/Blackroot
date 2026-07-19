#!/usr/bin/env node
// Blackroot - find fields that DATA authors and CODE never reads.
//
// V0.20.11. This session found six of these by accident, one at a time:
//   coneDegrees   (V0.19.6)  - authored on a "cone" spell, read for one hardcoded spell id
//   'east'/'west' (V0.19.9)  - authored poses, unreachable because `0 || 1` is 1
//   slam/crush/cast (V0.20.0) - authored VFX styles, no renderer branch
//   portrait      (V0.20.6)  - authored on all 33 NPCs, read by NOTHING
//   interactLabel (V0.20.10) - authored on 4 objects, read by NOTHING
// Each was a field somebody wrote with care that never reached a player. Finding them by stumbling
// over them is not a strategy, so this looks for the whole class at once.
//
// HOW: collect every `fieldName:` key authored in data/*.js, then look for any READ of that name
// anywhere outside data/ - `.field`, `['field']`, `"field"`, or destructuring. A name with no read is
// a candidate.
//
// ADVISORY, and deliberately not wired into validate.sh as a failure. It is a heuristic: dynamic
// access (obj[key] in a loop), fields consumed only by save/load round-tripping, and names that
// collide with common words will all fool it. A checker that cries wolf gets ignored - so this reports
// candidates for a human to triage, and says so, rather than pretending to be a verdict.
//
// Usage: node tools/check-dead-fields.js [--all]
//   default   - only fields authored 3+ times (a one-off is usually a deliberate special case)
//   --all     - every candidate

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['blender', 'backups', 'node_modules', '.git', 'tools', 'docs']);
const MIN_USES = process.argv.includes('--all') ? 1 : 3;

// Names that are structural, or so generic that a read is impossible to attribute.
const IGNORE = new Set([
  'id', 'name', 'type', 'label', 'color', 'x', 'y', 'z', 'w', 'h', 'kind', 'note', 'notes',
  'value', 'text', 'key', 'title', 'description', 'icon', 'tags', 'slot', 'level', 'scale',
  'width', 'height', 'src', 'style', 'class', 'data', 'items', 'list', 'min', 'max', 'default'
]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out); }
    else if (e.name.endsWith('.js')) out.push(path.join(dir, e.name));
  }
  return out;
}

// 1. Every field name authored in data/, with a count and an example file.
const dataDir = path.join(ROOT, 'data');
if (!fs.existsSync(dataDir)) { console.log('  no data/ directory'); process.exit(0); }
const authored = new Map(); // field -> { count, files:Set }
for (const file of walk(dataDir)) {
  const src = fs.readFileSync(file, 'utf8');
  // `field:` and `"field":` at a property position
  for (const m of src.matchAll(/(?:^|[{,\s])["']?([a-zA-Z_$][\w$]*)["']?\s*:/gm)) {
    const f = m[1];
    if (IGNORE.has(f)) continue;
    // Capitalised names are catalogue KEYS, not fields - loot-tables.js is a map of 'Woods', 'Rare',
    // 'Boss' entries, and reporting those as dead fields is noise. Real fields here are camelCase.
    if (/^[A-Z]/.test(f)) continue;
    if (!authored.has(f)) authored.set(f, { count: 0, files: new Set() });
    const rec = authored.get(f);
    rec.count++;
    rec.files.add(path.relative(ROOT, file));
  }
}

// 2. Everything the CODE (outside data/) could be reading.
const codeFiles = walk(ROOT).filter(f => !f.startsWith(dataDir));
let code = '';
for (const f of codeFiles) code += fs.readFileSync(f, 'utf8') + '\n';

function isRead(field) {
  // .field | ['field'] | ["field"] | { field } destructure | 'field' as a lookup key
  const patterns = [
    new RegExp(`\\.${field}\\b`),
    new RegExp(`\\[\\s*['"\`]${field}['"\`]\\s*\\]`),
    new RegExp(`\\{[^}]*\\b${field}\\b[^}]*\\}\\s*=`),
    new RegExp(`['"\`]${field}['"\`]`)
  ];
  return patterns.some(re => re.test(code));
}

const dead = [];
for (const [field, rec] of authored) {
  if (rec.count < MIN_USES) continue;
  if (isRead(field)) continue;
  dead.push({ field, count: rec.count, files: [...rec.files].slice(0, 2) });
}
dead.sort((a, b) => b.count - a.count);

console.log(`  scanned ${authored.size} authored field names across data/ (threshold: ${MIN_USES}+ uses)`);
if (!dead.length) {
  console.log('  no dead-field candidates');
} else {
  console.log(`  ${dead.length} CANDIDATE(S) - authored in data, no read found in code:`);
  for (const d of dead) console.log(`    ${d.field}  (${d.count}x, e.g. ${d.files.join(', ')})`);
  console.log('  NOTE: advisory. These are CANDIDATES, not verdicts. "Authored and never read" says');
  console.log('  where to look, NOT what you will find. Three different things look identical here:');
  console.log('    BROKEN    - claims something and never delivers it. Implement it.');
  console.log('                (coneDegrees drew a circle; 33 NPC portraits were never shown)');
  console.log('    EMPTY     - true of everything, or duplicated by a field that IS read. Retire it.');
  console.log('                (requiresHeavyWeapon is on every Fighter attack; the loose footstep');
  console.log('                 fields were copies of footstepProfile) - V0.20.12/13');
  console.log('    DELIBERATE- documented metadata awaiting a later phase. LEAVE IT ALONE.');
  console.log('                (allowedZone/Region/Biome: data/resources.js says so in a comment,');
  console.log('                 and placement already enforces it physically)');
  console.log('  And the scan itself can be wrong in both directions - it has been:');
  console.log('    - dynamic access (obj[key] in a loop) reads a field without ever naming it');
  console.log('    - fields nested INSIDE a read object look unread (terrainName, in footstepProfile)');
  console.log('    - a name WRITTEN in code (a default literal) is not a read, but fools a naive grep');
  console.log('  Open the file. Read the comments. Ask what it would MEAN if it were read.');
}
process.exit(0);
