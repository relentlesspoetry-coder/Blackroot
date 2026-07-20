#!/usr/bin/env node
// Blackroot - static check: no object/class defines the same method name twice.
//
// V0.20.3. JavaScript accepts a duplicate method name silently: the LAST definition wins and the
// earlier one becomes unreachable dead code that still looks finished. It is invisible to node --check,
// to the runtime validators, and to reading the file - you have to be looking for it.
//
// It has already cost real bugs in this codebase:
//   * drawOrbWeb defined twice in render/object-renderer.js. The later positional form won, so the
//     options form was dead and its 3 callers passed an options OBJECT where a number was expected -
//     `rnd` came through undefined and threw "rnd is not a function" EVERY FRAME. Webbed bushes and
//     web-strung trees simply did not draw. (Fixed V0.20.3.)
//   * drawCaveStairs defined twice in the same file. The later no-label form wins, so caveStairsDown
//     and caveStairsUp both call it with a 'DOWN'/'UP' label it ignores - up and down stairs render
//     identically and the labelled implementation is dead.
//
// Heuristic, deliberately: this matches ES method shorthand at a consistent indent, which is how these
// renderer objects are written. It reports what it finds and where, and skips anything ambiguous rather
// than guessing - a checker that cries wolf gets ignored, which is worse than no checker.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['blender', 'backups', 'node_modules', '.git', 'tools']);
// Words that look like `name(args) {` but are control flow, not method definitions.
const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'do', 'else', 'with', 'typeof', 'new', 'delete', 'void', 'yield', 'await', 'case']);
const METHOD = /^(\s+)(?:(?:async|get|set|static)\s+)?([A-Za-z_$][\w$]*)\s*\(([^()]*)\)\s*\{\s*$/;

function jsFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) jsFiles(path.join(dir, entry.name), out);
    } else if (entry.name.endsWith('.js')) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

let fail = 0;
let scanned = 0;

for (const file of jsFiles(ROOT)) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  // name+indent -> [lineNumbers]. Indent is the cheapest proxy for "same object literal".
  const seen = new Map();
  lines.forEach((line, i) => {
    const m = METHOD.exec(line);
    if (!m) return;
    const [, indent, name] = m;
    if (KEYWORDS.has(name)) return;
    const key = `${indent.length}:${name}`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(i + 1);
  });
  scanned++;
  for (const [key, at] of seen) {
    if (at.length < 2) continue;
    const name = key.split(':')[1];
    console.log(`  DUPLICATE METHOD: ${path.relative(ROOT, file)} defines '${name}' ${at.length}x at lines ${at.join(', ')} - the LAST one silently wins, the rest are dead`);
    fail = 1;
  }
}

if (!fail) console.log(`  no duplicate method definitions across ${scanned} files`);
process.exit(fail);
