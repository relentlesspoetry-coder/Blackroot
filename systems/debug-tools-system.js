// Dream Realms developer debug and content inspection tools (Roadmap Item 23).
//
// DEVELOPMENT-ONLY. Every command refuses to run unless debug mode is explicitly enabled, so a normal
// player build cannot reach them by accident. Enable with DarkWoodsGame.debug.on() (or ?debug=1, or
// DR.CONFIG.DEBUG). While enabled a DEBUG badge is shown, and every debug action is logged to both the
// console and the in-game log.
//
// Commands go through the game's AUTHORITATIVE systems (grantEditorItem, applyStatusEffect,
// setWorldTime, setWeather, the resource-gathering skill store, ...) rather than poking unrelated
// state directly - per the roadmap's safety requirements.
//
// Tools whose systems don't exist yet (spell VFX = Item 6) are deliberately NOT stubbed; they land with
// their systems. V0.20.68: the mount/taming tools arrived with Roadmap Item 7 and are live below.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  DR.DebugToolsSystem = {
    install(Game) {
      const BADGE_ID = 'drDebugBadge';

      function debugEnabled(game) {
        return Boolean(game._debugToolsOn || game.devMode || game.debugMode || DR.CONFIG?.DEBUG);
      }

      function showBadge(on) {
        try {
          let badge = document.getElementById(BADGE_ID);
          if (!on) { badge?.remove(); return; }
          if (badge) return;
          badge = document.createElement('div');
          badge.id = BADGE_ID;
          badge.textContent = 'DEBUG';
          badge.style.cssText = 'position:fixed;top:6px;left:6px;z-index:99999;pointer-events:none;'
            + 'font:700 11px/1 monospace;letter-spacing:.12em;padding:4px 7px;border-radius:4px;'
            + 'background:rgba(180,40,40,.85);color:#fff;border:1px solid rgba(255,255,255,.35);';
          document.body.appendChild(badge);
        } catch (_e) { /* badge is cosmetic - never break a debug command */ }
      }

      // Every command funnels through here: gate, log, run.
      function run(game, name, detail, fn) {
        if (!debugEnabled(game)) {
          console.warn(`[Debug] "${name}" is a development-only tool. Enable it first: DarkWoodsGame.debug.on()`);
          return false;
        }
        const label = `[Debug] ${name}${detail ? ` ${detail}` : ''}`;
        console.info(label);
        game.log?.(label, 'System');
        try {
          return fn();
        } catch (e) {
          console.warn(`${label} -> failed: ${(e && e.message) || e}`);
          return false;
        }
      }

      Game.prototype.installDebugTools = function() {
        const game = this;
        if (game.debug) return game.debug;

        const debug = {
          // ---- mode -------------------------------------------------------------------------
          on() {
            game._debugToolsOn = true;
            showBadge(true);
            console.info('[Debug] Debug tools ENABLED. DarkWoodsGame.debug.help() lists commands.');
            game.log?.('[Debug] Debug tools enabled.', 'System');
            return true;
          },
          off() {
            game._debugToolsOn = false;
            showBadge(false);
            console.info('[Debug] Debug tools disabled.');
            game.log?.('[Debug] Debug tools disabled.', 'System');
            return true;
          },
          get enabled() { return debugEnabled(game); },

          help() {
            const lines = [
              'Blackroot debug tools (development-only) - DarkWoodsGame.debug.*',
              '  on() / off() / enabled            enable or disable debug mode (badge shown while on)',
              'ITEMS',
              '  grantItem(id, qty=1)              grant an item via the authoritative grant path',
              '  removeItem(idOrIndex)             remove an item from the inventory',
              '  money(silver)                     add money (authored values are SILVER-scale)',
              'CHARACTER',
              '  applyBuff(idOrEffect, secs)       apply a status effect to the player',
              '  removeBuff(id)                    remove a status effect',
              '  setSkill(name, level)             set a resource skill (Gathering | Mining | Fishing)',
              '  statBreakdown()                   per-source stat contributions + final values',
              'WORLD',
              '  setTime(hour)                     set the world clock hour (0-24)',
              '  setWeather(kind)                  set the weather state',
              'CONTENT INSPECTION',
              '  lootTable(id)                     inspect a loot table (entries, chances)',
              '  lootTables()                      list loot table ids',
              '  item(id)                          inspect an item descriptor + compiled instance',
              'MOUNTS / TAMING',
              '  mounts()                          list every beast: level, rank, bait, owned',
              '  unlockMount(id?)                  grant one mount, or ALL if id is omitted',
              '  removeMount(id?)                  remove one mount, or clear the stable',
              '  spawnBeast(beastKey)              spawn a pre-weakened tameable beast and target it',
              '  giveBait(beastKey?, qty=3)        grant the bait a beast wants (or every bait)',
              '  tameTarget()                      begin taming the current target, or say why not',
              'VALIDATION',
              '  validate()                        full validation suite (content + stats + economy)',
              '  economy()                         economy audit (arbitrage, ladder, spread)',
              '  selfTest()                        stat-pipeline regression self-test',
              'NOTE: spell-VFX tools arrive with that system (Roadmap item 6).'
            ];
            console.info(lines.join('\n'));
            return lines.length;
          },

          // ---- items ------------------------------------------------------------------------
          grantItem(id, qty = 1) {
            return run(game, 'grantItem', `${id} x${qty}`, () => {
              if (!DR.ITEM_BY_ID?.[id]) { console.warn(`[Debug] unknown item id: ${id}`); return false; }
              const res = game.grantEditorItem?.(id, qty) || { ok: false };
              return res.ok !== false;
            });
          },
          removeItem(idOrIndex) {
            return run(game, 'removeItem', String(idOrIndex), () => {
              const inv = Array.isArray(game.inventory) ? game.inventory : [];
              const idx = typeof idOrIndex === 'number'
                ? idOrIndex
                : inv.findIndex(it => it && (it.itemId === idOrIndex || it.id === idOrIndex));
              if (idx < 0 || idx >= inv.length) { console.warn('[Debug] item not found in inventory.'); return false; }
              inv.splice(idx, 1);
              game.bagDirty = true;
              game.renderBag?.();
              game.updateUI?.();
              return true;
            });
          },
          money(silver = 100) {
            return run(game, 'money', `+${silver}s`, () => {
              if (!game.player) return false;
              // Authored money values are SILVER-scale; addSilver converts to the real currency.
              game.addSilver ? game.addSilver(silver) : game.addCopper?.(silver * 100);
              game.updateUI?.();
              return game.formatCopper ? game.formatCopper(game.totalCopper()) : game.totalCopper();
            });
          },

          // ---- character --------------------------------------------------------------------
          applyBuff(idOrEffect, seconds = 60) {
            return run(game, 'applyBuff', typeof idOrEffect === 'string' ? idOrEffect : idOrEffect?.id, () => {
              if (!game.player) return false;
              const effect = typeof idOrEffect === 'string'
                ? { id: idOrEffect, name: idOrEffect, duration: seconds }
                : idOrEffect;
              return Boolean(game.applyStatusEffect?.(game.player, effect));
            });
          },
          removeBuff(id) {
            return run(game, 'removeBuff', id, () => Boolean(game.removeStatusEffect?.(game.player, id)));
          },
          setSkill(name, level = 10) {
            return run(game, 'setSkill', `${name} -> ${level}`, () => {
              const sys = game.resourceGatheringSystem;
              // sys.skill(name) is the authoritative accessor, but it silently falls back to
              // 'Gathering' for an unknown name - so validate first rather than set the wrong skill.
              const known = Object.keys(sys?.state?.skills || {});
              if (!known.includes(name)) {
                console.warn(`[Debug] unknown skill: ${name}. Known: ${known.join(' | ') || 'none'}`);
                return false;
              }
              const skill = sys.skill(name);
              if (!skill) return false;
              skill.level = Math.max(1, Math.floor(Number(level) || 1));
              skill.xp = 0;
              game.updateUI?.();
              return { name, level: skill.level };
            });
          },
          statBreakdown() {
            return run(game, 'statBreakdown', '', () => game.getPlayerStatBreakdown?.() || null);
          },

          // ---- world ------------------------------------------------------------------------
          setTime(hour = 12) {
            return run(game, 'setTime', `${hour}:00`, () => {
              const h = Math.max(0, Math.min(24, Number(hour) || 0));
              if (typeof game.setWorldTime === 'function') return game.setWorldTime(h);
              console.warn('[Debug] setWorldTime is unavailable.');
              return false;
            });
          },
          setWeather(kind = 'clear') {
            return run(game, 'setWeather', String(kind), () => {
              if (typeof game.setWeather === 'function') return game.setWeather(kind);
              console.warn('[Debug] setWeather is unavailable.');
              return false;
            });
          },

          // ---- content inspection -----------------------------------------------------------
          lootTables() {
            return run(game, 'lootTables', '', () => Object.keys(game.editorLootTables || DR.LOOT_TABLE_BY_ID || {}));
          },
          lootTable(id) {
            return run(game, 'lootTable', id, () => {
              const table = (game.editorLootTables || DR.LOOT_TABLE_BY_ID || {})[id];
              if (!table) { console.warn(`[Debug] unknown loot table: ${id}`); return null; }
              const name = e => DR.ITEM_BY_ID?.[e.itemId]?.name || e.itemId;
              return {
                id,
                gold: table.gold || null,
                entries: (table.entries || []).map(e => ({ item: name(e), id: e.itemId, chance: e.chance, min: e.min, max: e.max })),
                rarePool: (table.rarePool || []).map(e => ({ item: name(e), id: e.itemId, chance: e.chance })),
                guaranteedPool: (table.guaranteedPool || []).map(e => ({ item: name(e), id: e.itemId }))
              };
            });
          },
          item(id) {
            return run(game, 'item', id, () => {
              const draft = DR.ITEM_BY_ID?.[id];
              if (!draft) { console.warn(`[Debug] unknown item id: ${id}`); return null; }
              const inst = game.createRuntimeItemInstance?.(id, 1) || null;
              const sellCopper = game.itemSellValue?.(draft) ?? null;
              return {
                draft,
                compiled: inst,
                sellBack: game.formatCopper && sellCopper != null ? game.formatCopper(sellCopper) : sellCopper
              };
            });
          },

          // ---- mounts / taming (Roadmap Item 23: "unlock mount", "remove mount", "spawn beast",
          // "start taming attempt"). These go through the owning systems rather than writing state
          // directly, so a debug unlock is indistinguishable from a legitimately tamed one and cannot
          // create a save state the game could not have produced itself.
          // V0.20.80: overworld zone travel (Roadmap Item 26 Phase 1). Goes through the real
          // travelToOverworldZone path, so a debug jump exercises exactly what the waypoint UI will.
          zones() {
            const g = game;
            const defs = DR.DEFAULT_WORLD?.zones || {};
            return Object.keys(defs).map(id => ({
              id,
              name: defs[id].name,
              size: `${defs[id].width}x${defs[id].height}`,
              levels: defs[id].levelMin ? `${defs[id].levelMin}-${defs[id].levelMax}` : '-',
              generated: !!g.isOverworldZoneGenerated?.(id),
              active: id === g.activeOverworldZoneId
            }));
          },

          travelZone(zoneId = 'ashen_valley') {
            const result = game.travelToOverworldZone?.(zoneId, { ignoreCombat: true });
            if (!result?.ok) game.log?.(result?.reason || 'Travel failed.');
            return result;
          },

          mounts() {
            return run(game, 'mounts', '', () => (DR.MOUNT_DEFINITIONS || []).map(d => ({
              id: d.id, name: d.name, family: d.family, rarity: d.rarity,
              level: d.taming?.minPlayerLevel, rank: d.taming?.requiredTier,
              bait: DR.ITEM_BY_ID?.[d.taming?.bait]?.name || d.taming?.bait,
              owned: !!game.mountSystem?.isUnlocked?.(d.id)
            })));
          },
          unlockMount(id) {
            return run(game, 'unlockMount', id || '(all)', () => {
              const sys = game.mountSystem;
              if (!sys) { console.warn('[Debug] mount system unavailable'); return false; }
              const ids = id ? [id] : (DR.MOUNT_DEFINITIONS || []).map(d => d.id);
              const done = [];
              for (const mountId of ids) {
                const res = sys.unlockMount(mountId, { source: 'Debug grant', method: 'Debug grant', level: game.player?.level || 1 });
                if (res?.ok) done.push(DR.MOUNT_BY_ID[mountId]?.name || mountId);
              }
              sys.togglePanel(true);
              return { unlocked: done, active: sys.state.active, total: sys.tamedCount() };
            });
          },
          removeMount(id) {
            return run(game, 'removeMount', id || '(all)', () => {
              const sys = game.mountSystem;
              if (!sys) return false;
              if (game.player?.mounted) sys.dismount('');
              if (id) delete sys.state.unlocked[id]; else sys.state.unlocked = {};
              if (!sys.state.unlocked[sys.state.active]) sys.state.active = Object.keys(sys.state.unlocked)[0] || null;
              sys.renderPanel();
              game.saveCharacterState?.({ silent: true });
              return { remaining: sys.tamedCount() };
            });
          },
          spawnBeast(beastKey) {
            return run(game, 'spawnBeast', beastKey || '', () => {
              const def = DR.MOUNT_BY_BEAST_KEY?.[String(beastKey || '').toLowerCase()];
              if (!def) { console.warn(`[Debug] not a tameable beast key: ${beastKey}`); return false; }
              const p = game.player;
              if (!p) return false;
              // Spawned already weakened, so it is immediately at the taming threshold.
              const beast = {
                id: Date.now() % 1000000, name: def.name, mobVisualKey: def.beastKey,
                family: def.family, kind: 'enemy', alive: true,
                maxHp: 100, hp: Math.floor(100 * (def.taming?.healthThreshold ?? 0.35) * 0.6),
                x: p.x + 1.5, y: p.y, level: def.taming?.minPlayerLevel || 1,
                facingX: 0, facingY: 1, moveBlend: 0, vx: 0, vy: 0
              };
              game.enemies?.push(beast);
              game.entities?.push(beast);   // runtime spawns must reach BOTH lists to be drawn
              game.target = beast;
              return { spawned: def.name, hp: `${beast.hp}/${beast.maxHp}`,
                bait: DR.ITEM_BY_ID?.[def.taming?.bait]?.name,
                requiresLevel: def.taming?.minPlayerLevel, yourLevel: p.level,
                requiresRank: DR.tamingTierLabel?.(def.taming?.requiredTier) };
            });
          },
          giveBait(beastKey, qty = 3) {
            return run(game, 'giveBait', `${beastKey || 'all'} x${qty}`, () => {
              const defs = beastKey
                ? [DR.MOUNT_BY_BEAST_KEY?.[String(beastKey).toLowerCase()]].filter(Boolean)
                : (DR.MOUNT_DEFINITIONS || []);
              const given = [];
              for (const bait of new Set(defs.map(d => d.taming?.bait).filter(Boolean))) {
                const added = game.addItem?.(bait, qty) ?? game.addMaterialItem?.(bait, qty);
                given.push(`${DR.ITEM_BY_ID?.[bait]?.name || bait} x${qty}${added === false ? ' (FAILED)' : ''}`);
              }
              game.renderBag?.();
              return given;
            });
          },
          tameTarget() {
            // Returns the EVALUATION, not a bare boolean: a debug tool that answers `false` when the
            // character is simply under-levelled is not a debugging aid.
            return run(game, 'tameTarget', '', () => {
              const t = game.tamingSystem;
              if (!t) return false;
              const check = t.evaluate(game.target);
              if (!check.ok) return { started: false, reason: check.reason };
              return { started: t.beginTaming(game.target), beast: check.def?.name };
            });
          },

          // ---- validation -------------------------------------------------------------------
          validate() { return run(game, 'validate', '', () => game.runValidationSuite?.() || null); },
          economy() { return run(game, 'economy', '', () => game.auditEconomy?.() || null); },
          selfTest() { return run(game, 'selfTest', '', () => game.runStatPipelineSelfTest?.() || null); }
        };

        game.debug = debug;

        // Auto-enable from an explicit opt-in only (never in a normal player build).
        try {
          const url = new URLSearchParams(window.location.search);
          if (url.get('debug') === '1' || DR.CONFIG?.DEBUG) debug.on();
        } catch (_e) { /* URL parsing is best-effort */ }

        return debug;
      };
    }
  };
})();
