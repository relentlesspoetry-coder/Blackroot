/* Blackroot sprite atlas baker - dev tool loader.
 *
 * V0.20.52: rebuilt. The original tools/sprite-baker.{html,js} referenced by
 * assets/atlases/README.txt had gone missing from the repo, which is why the atlas was never
 * generated and assets/atlases/entities.json is still the placeholder ("pages": [], "frames": {}).
 * With no atlas, SpriteAtlasSystem.isReady() is permanently false, tryDrawEntityAtlasFrame bails with
 * 'atlas_not_ready' for every actor, and the whole world falls back to procedural vector drawing -
 * measured at ~10,000 canvas path operations per frame against only ~92 drawImage calls.
 *
 * This tool loads the game's renderer scripts WITHOUT booting a game (game.js is skipped because its
 * last line does `window.DarkWoodsGame = new Game()`, which would demand the full HUD DOM), then drives
 * DR.SpriteBakeSystem to bake and download the atlas.
 */
(() => {
  'use strict';

  const state = { loaded: false, scripts: [], baker: null };
  const logEl = () => document.getElementById('bakeLog');

  function log(msg, cls = '') {
    const el = logEl();
    const line = document.createElement('div');
    if (cls) line.className = cls;
    line.textContent = msg;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
    // eslint-disable-next-line no-console
    console.log('[sprite-baker]', msg);
  }

  function setBusy(busy) {
    document.querySelectorAll('button').forEach(b => { b.disabled = busy; });
  }

  // The load order lives in _script_order.json. Over http:// this fetch works; from a file://
  // launch it is blocked, which is exactly the failure the V0.13.68 pass fixed with a bundled
  // fallback. Serve the folder over http (e.g. `python3 -m http.server`) and open the tool from there.
  async function loadScriptOrder() {
    const res = await fetch('../_script_order.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} loading _script_order.json`);
    const list = await res.json();
    if (!Array.isArray(list) || !list.length) throw new Error('_script_order.json was empty or not an array');
    return list;
  }

  function injectScript(src) {
    return new Promise((resolve) => {
      const el = document.createElement('script');
      el.src = `../${src}`;
      el.onload = () => resolve({ src, ok: true });
      el.onerror = () => resolve({ src, ok: false });
      document.head.appendChild(el);
    });
  }

  async function loadRenderers() {
    if (state.loaded) { log('Renderers already loaded.'); return true; }
    setBusy(true);
    try {
      log('Fetching ../_script_order.json ...');
      const order = await loadScriptOrder();
      // game.js ends with `window.DarkWoodsGame = new Game()` and would boot the whole game
      // (and demand the full HUD DOM). The bake system builds its own minimal render context via
      // createObjectBakeGame(), so the renderers and data are all that is required.
      const scripts = order.filter(s => s !== 'game.js');
      log(`Loading ${scripts.length} scripts (skipping game.js)...`);
      let failed = 0;
      for (const src of scripts) {
        const r = await injectScript(src);
        if (!r.ok) { failed++; log(`  ! failed: ${src}`, 'warn'); }
      }
      const DR = window.DreamRealms;
      if (!DR) throw new Error('window.DreamRealms was never defined - script load failed.');
      if (!DR.SpriteBakeSystem) throw new Error('DR.SpriteBakeSystem missing - systems/sprite-bake-system.js did not load.');
      state.loaded = true;
      log(`Loaded. ${failed ? failed + ' script(s) failed (see above).' : 'All scripts OK.'}`, failed ? 'warn' : 'ok');
      const baker = new DR.SpriteBakeSystem({});
      log(`Bake definitions available: ${baker.getBakeDefinitions().length}`);
      return true;
    } catch (err) {
      log(`LOAD FAILED: ${err && err.message ? err.message : err}`, 'err');
      log('If you opened this from file://, fetch() is blocked. Serve the project over http instead:', 'warn');
      log('    python3 -m http.server 8899      (then open http://localhost:8899/tools/sprite-baker.html)', 'warn');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function makeBaker() {
    const size = Number(document.getElementById('atlasSize').value) || 4096;
    return new window.DreamRealms.SpriteBakeSystem({ maxAtlasSize: size });
  }

  // Bake a single model so you can confirm frames are produced before committing to the full run.
  async function smokeBake() {
    if (!state.loaded && !(await loadRenderers())) return;
    setBusy(true);
    try {
      const baker = makeBaker();
      const id = document.getElementById('smokeModel').value.trim() || 'Paladin';
      const defs = baker.getBakeDefinitions().filter(d => d.modelId === id);
      if (!defs.length) { log(`No definitions for model "${id}".`, 'err'); return; }
      log(`Smoke baking ${id} (${defs.length} definition(s))...`);
      const t0 = performance.now();
      const frames = [];
      for (const def of defs) baker.bakeDefinitionInto(def, frames);
      const ms = Math.round(performance.now() - t0);
      if (!frames.length) { log(`${id}: 0 frames produced (this model has no bakeable renderer - it will keep drawing procedurally).`, 'warn'); return; }
      log(`${id}: ${frames.length} frames in ${ms}ms (${frames[0].canvas.width}x${frames[0].canvas.height}).`, 'ok');
      const prev = document.getElementById('preview');
      prev.innerHTML = '';
      frames.slice(0, 24).forEach(f => prev.appendChild(f.canvas));
    } catch (err) {
      log(`SMOKE BAKE FAILED: ${err && err.message ? err.message : err}`, 'err');
    } finally {
      setBusy(false);
    }
  }

  // Full bake -> entities_N.png pages + entities.json + entities.manifest.js, all via browser download.
  async function fullBake() {
    if (!state.loaded && !(await loadRenderers())) return;
    setBusy(true);
    try {
      const baker = makeBaker();
      const defs = baker.getBakeDefinitions();
      log(`FULL BAKE starting: ${defs.length} definitions, atlas page ${baker.maxAtlasSize}x${baker.maxAtlasSize}.`);
      log('This runs the renderers thousands of times - the tab will freeze for a while. That is expected.', 'warn');
      await new Promise(r => setTimeout(r, 50)); // let the log paint before we block the thread
      const t0 = performance.now();
      const result = await baker.bakeAndDownload(defs);
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      const frameCount = Object.keys(result.manifest.frames || {}).length;
      log(`DONE in ${secs}s - ${frameCount} frames across ${result.pages.length} page(s).`, 'ok');
      log('Your browser is downloading: ' + result.pages.map(p => p.image).join(', ') + ', entities.json, entities.manifest.js', 'ok');
      log('If only the first file saved, allow "automatic downloads" for this site and run it again.', 'warn');
      log('Then copy every downloaded file into assets/atlases/ (replacing the placeholder entities.json).', 'ok');
    } catch (err) {
      log(`FULL BAKE FAILED: ${err && err.message ? err.message : err}`, 'err');
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnLoad').addEventListener('click', loadRenderers);
    document.getElementById('btnSmoke').addEventListener('click', smokeBake);
    document.getElementById('btnFull').addEventListener('click', fullBake);
    log('Ready. Click "Load Renderers" first.');
  });
})();
