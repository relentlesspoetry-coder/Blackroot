#!/usr/bin/env node
// Blackroot - static check: every itemId a loot table drops must exist in the item catalog.
//
// V0.20.40 (Roadmap Item 12 - Loot & Acquisition Audit). A loot table that references a non-existent
// item is a drop that silently fails - the kill "rewards" an item that never materializes, with no
// error. The V0.20.40 audit cross-referenced all 193 loot itemIds against the 396-item catalog and
// found 0 dangling; this locks that invariant so a future loot or item edit can't reintroduce one.
//
// Text-based (not runtime) to match the other tools and to run under plain `node` in validate.sh. Loot
// tables reference items by ID (`itemId: 'item_...'`); the catalog defines them by ID (`id: 'item_...'`).
// Both are matched with the `item_` prefix so unrelated `id:`/`itemId:` fields (quests, npcs) are ignored.
// NOTE: this only covers ID-based loot references. Gathering/fishing reference items by display NAME and
// starter gear is granted at runtime - those are NOT loot-table drops and are out of scope here (the
// V0.20.40 audit verified them separately).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (_e) { return ''; } };

// item catalog ids (item definitions live in data/items.js)
const itemsSrc = read('data/items.js');
const catalog = new Set();
for (const m of itemsSrc.matchAll(/\bid:\s*'(item_[a-z0-9_]+)'/g)) catalog.add(m[1]);

// loot itemId references (loot tables live in data/loot-tables.js and data/loot.js)
const lootSrc = read('data/loot-tables.js') + '\n' + read('data/loot.js');
const refs = new Map(); // itemId -> first line number
const lines = lootSrc.split('\n');
lines.forEach((line, i) => {
  for (const m of line.matchAll(/\bitemId:\s*'(item_[a-z0-9_]+)'/g)) {
    if (!refs.has(m[1])) refs.set(m[1], i + 1);
  }
});

if (catalog.size === 0) {
  console.error('check-loot-references: could not read item catalog from data/items.js - aborting (not failing the build).');
  process.exit(0);
}

const dangling = [];
for (const [id, ln] of refs) if (!catalog.has(id)) dangling.push({ id, ln });

if (dangling.length) {
  console.error(`check-loot-references: ${dangling.length} loot itemId(s) reference items NOT in the catalog:`);
  for (const d of dangling) console.error(`  - ${d.id} (data/loot-tables.js:${d.ln})`);
  process.exit(1);
}

console.log(`  loot references OK - ${refs.size} loot itemIds all resolve to the ${catalog.size}-item catalog`);
process.exit(0);
