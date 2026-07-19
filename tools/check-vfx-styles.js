#!/usr/bin/env node
// Blackroot - static check: every slash STYLE the code passes must be a style some renderer draws.
//
// V0.20.0 (Roadmap Item 6). This cannot be a runtime data validator: the styles are string literals in
// CODE, not data, and spawnSlash's `else` arm means an unimplemented style still draws *something* -
// it just draws the wrong thing, silently. 'slam' shipped that way (the fighter's level-20 capstone drew
// the level-1 swing), and so did 'crush' and 'cast' (casters swinging an invisible sword).
//
// A first attempt at this used grep, and it both raised a FALSE POSITIVE ('undead_minion' - a petType
// inside a ternary CONDITION, not a style) and MISSED a real one ('cast', the ternary's actual value).
// So the 4th argument is extracted by balancing parens, and for a ternary only the VALUE side (after the
// top-level `?`) is read. A non-literal argument is reported as unknown rather than guessed at.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['blender', 'backups', 'node_modules', '.git', 'tools']);
const CALL = /(?:playAttackAnimation|spawnSlash)\s*\??\.?\s*\(/g;

function jsFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) jsFiles(path.join(dir, entry.name), out);
    } else if (entry.name.endsWith('.js')) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

// Split the argument list at the call's open paren, respecting nesting and strings.
function splitArgs(src, openIndex) {
  let depth = 0, quote = null, start = openIndex + 1;
  const args = [];
  for (let i = openIndex; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth === 0) { args.push(src.slice(start, i)); return args; }
    } else if (c === ',' && depth === 1) {
      args.push(src.slice(start, i));
      start = i + 1;
    }
  }
  return null; // unbalanced
}

// A ternary's style value lives after the top-level '?'. Ignore '?.' (optional chaining).
function valueSide(expr) {
  let depth = 0, quote = null;
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === '?' && depth === 0 && expr[i + 1] !== '.') return expr.slice(i + 1);
  }
  return expr;
}

const IMPLEMENTED_IN = path.join(ROOT, 'render', 'effects-renderer.js');
const rendererSrc = fs.readFileSync(IMPLEMENTED_IN, 'utf8');

// Only the SLASH branch's styles count. Scanning the whole file over-collects: drawHighQualityBoltEffect
// has its own `e.style === 'arrow'`, which is a bolt style and has nothing to do with spawnSlash.
const slashStart = rendererSrc.indexOf("e.type === 'slash'");
if (slashStart === -1) {
  console.log("  CANNOT FIND the `e.type === 'slash'` branch in render/effects-renderer.js");
  process.exit(1);
}
const nextType = rendererSrc.indexOf("e.type === '", slashStart + 20);
const slashBlock = rendererSrc.slice(slashStart, nextType === -1 ? rendererSrc.length : nextType);
const implemented = new Set(['slash']); // the default arm of the branch
for (const m of slashBlock.matchAll(/e\.style === '([a-z_]+)'/g)) implemented.add(m[1]);

const requested = new Map(); // style -> [where]
const unknown = [];

for (const file of jsFiles(ROOT)) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(CALL)) {
    const open = m.index + m[0].length - 1;
    const args = splitArgs(src, open);
    if (!args || args.length < 4) continue;         // spawnSlash(from,to,color,style)
    const expr = valueSide(args[3]);
    const literals = [...expr.matchAll(/'([a-z_]+)'/g)].map(x => x[1]);
    const line = src.slice(0, m.index).split('\n').length;
    const where = `${path.relative(ROOT, file)}:${line}`;
    if (!literals.length) { unknown.push(where); continue; }
    for (const lit of literals) {
      if (!requested.has(lit)) requested.set(lit, []);
      requested.get(lit).push(where);
    }
  }
}

let fail = 0;

// V0.20.1: DR.SLASH_STYLES (render/effects-renderer.js) is what the RUNTIME validator checks authored
// spell vfxStyle values against. It is hand-written beside the branches, so assert it still matches the
// branches that actually exist - otherwise the registry itself becomes the next piece of dead data.
const registryMatch = rendererSrc.match(/DR\.SLASH_STYLES\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/);
if (!registryMatch) {
  console.log('  REGISTRY MISSING: render/effects-renderer.js no longer declares DR.SLASH_STYLES');
  fail = 1;
} else {
  const declared = new Set([...registryMatch[1].matchAll(/'([a-z_]+)'/g)].map(m => m[1]));
  for (const s of implemented) {
    if (!declared.has(s)) { console.log(`  REGISTRY STALE: '${s}' is drawn but missing from DR.SLASH_STYLES`); fail = 1; }
  }
  for (const s of declared) {
    if (!implemented.has(s)) { console.log(`  REGISTRY STALE: DR.SLASH_STYLES lists '${s}' but no branch draws it`); fail = 1; }
  }
  if (!fail) console.log(`  DR.SLASH_STYLES matches the ${declared.size} implemented branches`);
}

for (const [style, wheres] of [...requested].sort()) {
  if (implemented.has(style)) {
    console.log(`  '${style}' implemented`);
  } else {
    console.log(`  STYLE NOT DRAWN: '${style}' passed at ${wheres.join(', ')} but render/effects-renderer.js never branches on it`);
    fail = 1;
  }
}
for (const where of unknown) console.log(`  note: non-literal style argument at ${where} - not checkable statically`);
console.log(`  implemented: ${[...implemented].sort().join(' ')}`);
process.exit(fail);
