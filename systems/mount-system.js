// Blackroot mount runtime (Roadmap Item 7.F / 7.G / 7.H / 7.I).
//
// V0.20.64. Ownership notes:
//
// * The collection is the single source of truth for what the character owns, and it is persisted
//   through the normal character save path (serializeState/importState), mirrored in
//   resetCharacterOwnedState so a new character cannot inherit another's stable (the V0.20.2 bug
//   class).
//
// * Mounted movement does NOT get its own movement code. It multiplies the speed returned by
//   Game.playerWalkSpeed(), which is the single funnel feeding tryMoveActorSubstepped - so mounts
//   inherit collision, substepping, terrain rules and zone boundaries for free, exactly as
//   Roadmap Item 7.J requires. A mount can never outrun a wall.
//
// * Traits are traversal-only. Nothing here touches damage, healing or combat stats.
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const safeNumber = (v, f = 0) => Number.isFinite(Number(v)) ? Number(v) : f;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  const RARITY_COLOR = {
    common: '#cfc7b4', uncommon: '#7fc96b', rare: '#6fa8ff', epic: '#c47fff', legendary: '#e2a13a'
  };

  // V0.20.67: the panel must show the key the player has ACTUALLY bound, not a hardcoded letter.
  // These are remappable now, so a baked-in "Press H" would go stale the moment anyone rebinds it.
  function keyLabel(action) {
    const game = window.DarkWoodsGame;
    const key = game?.bindingForAction?.(action) || '';
    return key ? key.toUpperCase() : '(unbound)';
  }

  function defaultState() {
    return { unlocked: {}, active: null, favorite: null };
  }

  function normalizeState(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== 'object') return base;
    const unlocked = {};
    for (const [id, rec] of Object.entries(raw.unlocked || {})) {
      if (!DR.MOUNT_BY_ID?.[id]) continue;   // drop records for mounts that no longer exist
      unlocked[id] = {
        source: String(rec?.source || 'Unknown'),
        method: String(rec?.method || 'Tamed'),
        tamedAt: safeNumber(rec?.tamedAt, Date.now()),
        level: safeNumber(rec?.level, 1)
      };
    }
    base.unlocked = unlocked;
    base.active = DR.MOUNT_BY_ID?.[raw.active] ? raw.active : null;
    base.favorite = DR.MOUNT_BY_ID?.[raw.favorite] ? raw.favorite : null;
    return base;
  }

  function registerDreamRealmsSystem(system) {
    const list = window.DreamRealmsSystems = window.DreamRealmsSystems || [];
    list.push(system);
  }

  registerDreamRealmsSystem({
    id: 'mounts',
    name: 'Mounts',

    install(game) {
      const runtime = {
        id: 'mounts',
        name: 'Mounts',
        game,
        state: defaultState(),
        panelOpen: false,
        selectedId: null,
        blockedMessage: '',
        blockedAt: 0,

        init() {
          game.mountSystem = this;
          game.toggleMountPanel = force => this.togglePanel(force);
          game.renderMountPanel = () => this.renderPanel();
          game.serializeMountState = () => this.serializeState();
          game.importMountState = raw => this.importState(raw);
          game.isMounted = () => this.isMounted();
          game.mountSpeedMultiplier = () => this.speedMultiplier();
          game.dismountPlayer = reason => this.dismount(reason);
          game.mountHasTrait = trait => this.activeHasTrait(trait);
          game.drawMountPreviewInto = (c, def, w, h, opts) => this.drawPreview(c, def, w, h, opts);
          this.bindInput();
        },

        // Renders the REAL procedural beast into a preview canvas by handing the existing mob model
        // a synthetic actor, rather than authoring separate portrait art that could drift from the
        // creature (Roadmap Item 7.F "preserve the beast's intended appearance", Item 9 one-source).
        drawPreview(c, def, w, h, options = {}) {
          const model = DR.render?.DarkWoodsMobProceduralModel || window.DarkWoodsMobProceduralModel;
          if (!model?.draw || !def) return false;
          const fit = Math.min(w, h) / 150;
          const actor = {
            mobVisualKey: def.beastKey,
            visualKey: def.beastKey,
            family: def.family,
            alive: true,
            kind: 'enemy',
            screenX: w / 2,
            screenY: h * 0.80,
            modelScale: fit * 1.05,
            facingX: 0.82,
            facingY: 0.42,
            facingName: 'southeast',
            moveBlend: 0,
            vx: 0, vy: 0,
            hp: 1, maxHp: 1
          };
          c.save();
          // A fixed timestamp keeps the preview pose stable instead of animating in a list.
          const ok = model.draw(c, actor, 1200);
          if (ok && options.silhouette) {
            // Locked entries show the creature's shape only - enough to recognise, not enough to spoil.
            c.globalCompositeOperation = 'source-atop';
            c.fillStyle = 'rgba(10,14,12,0.86)';
            c.fillRect(0, 0, w, h);
          }
          c.restore();
          return ok;
        },

        // ---------------------------------------------------------------
        // Collection (Roadmap Item 7.F)
        // ---------------------------------------------------------------
        definitions() { return DR.MOUNT_DEFINITIONS || []; },
        isUnlocked(id) { return !!this.state.unlocked[id]; },
        tamedCount() {
          // V0.20.70: taming RANK must count beasts actually tamed. Buying the starter mount is not
          // an act of handling, so it does not advance the rank that gates the rarer beasts.
          return Object.keys(this.state.unlocked)
            .filter(id => DR.MOUNT_BY_ID?.[id]?.taming).length;
        },
        ownedCount() { return Object.keys(this.state.unlocked).length; },
        record(id) { return this.state.unlocked[id] || null; },
        tamingTier() { return DR.tamingTierFor ? DR.tamingTierFor(this.tamedCount()) : 0; },

        unlockMount(id, meta = {}) {
          const def = DR.MOUNT_BY_ID?.[id];
          if (!def) return { ok: false, reason: 'Unknown mount.' };
          // Item 7.E: prevent duplicate unlock abuse.
          if (this.state.unlocked[id]) return { ok: true, alreadyOwned: true, def };
          this.state.unlocked[id] = {
            source: String(meta.source || 'Dark Woods'),
            method: String(meta.method || 'Tamed in the wild'),
            tamedAt: Date.now(),
            level: safeNumber(meta.level, safeNumber(game.player?.level, 1))
          };
          if (!this.state.active) this.state.active = id;
          this.renderPanel();
          game.saveCharacterState?.({ silent: true });
          return { ok: true, def };
        },

        setActive(id) {
          if (!this.isUnlocked(id)) return false;
          this.state.active = id;
          this.renderPanel();
          game.saveCharacterState?.({ silent: true });
          return true;
        },

        toggleFavorite(id) {
          if (!this.isUnlocked(id)) return false;
          this.state.favorite = this.state.favorite === id ? null : id;
          this.renderPanel();
          game.saveCharacterState?.({ silent: true });
          return true;
        },

        // ---------------------------------------------------------------
        // Summon / mount / dismount (Roadmap Item 7.G) + safeguards (7.H)
        // ---------------------------------------------------------------
        isMounted() { return !!(game.player && game.player.mounted && this.state.active); },
        activeDef() { return this.state.active ? DR.MOUNT_BY_ID?.[this.state.active] : null; },

        activeHasTrait(trait) {
          const def = this.activeDef();
          if (!def || !this.isMounted()) return false;
          return (def.mount?.traits || []).includes(trait);
        },

        speedMultiplier() {
          if (!this.isMounted()) return 1;
          const def = this.activeDef();
          return Math.max(0.5, safeNumber(def?.mount?.speedMult, 1));
        },

        // Every reason mounting can be refused, in one place so the UI and the keybind agree.
        mountBlockedReason() {
          const player = game.player;
          if (!player || player.alive === false) return 'You cannot ride right now.';
          if (!this.state.active) return 'No mount selected.';
          if (!this.isUnlocked(this.state.active)) return 'You do not own that mount.';
          if (game.isEntityInCombat?.(player) || player.inCombat) return 'You cannot mount in combat.';
          if (player.swimming || player.underwater) {
            const def = this.activeDef();
            if (!(def?.mount?.traits || []).includes('swimmer')) return 'This mount cannot swim.';
          }
          const zone = String(game.currentZone || '');
          if (zone === 'dungeon') return 'Mounts cannot be ridden inside dungeons.';
          if (zone === 'cave') {
            const def = this.activeDef();
            if (!(def?.mount?.traits || []).includes('cave_sense')) return 'This mount will not enter the caves.';
          }
          if (game.dialogueOpen || game.activeCutscene) return 'Not during a conversation.';
          if (player.meditating) return 'Not while meditating.';
          return null;
        },

        mount() {
          const reason = this.mountBlockedReason();
          if (reason) { this.notify(reason); game.log?.(reason); return false; }
          const def = this.activeDef();
          game.player.mounted = true;
          game.player.mountId = def.id;
          game.player.mountVisualScale = safeNumber(def.mount?.visualScale, 1);
          game.log?.(`You mount the ${def.name}.`);
          game.playSound?.('ui_confirm');
          return true;
        },

        dismount(reason = '') {
          const player = game.player;
          if (!player || !player.mounted) return false;
          const def = this.activeDef();
          player.mounted = false;
          player.mountId = null;
          player.mountVisualScale = 1;
          if (reason) game.log?.(`${reason}`);
          else game.log?.(`You dismount${def ? ` from the ${def.name}` : ''}.`);
          return true;
        },

        toggleMounted() {
          if (this.isMounted()) return this.dismount();
          return this.mount();
        },

        // Item 7.H: taking damage may force a dismount, resisted by sure-footed mounts.
        notifyPlayerDamaged(amount) {
          if (!this.isMounted()) return;
          const def = this.activeDef();
          const resist = clamp(safeNumber(def?.mount?.dismountResist, 0), 0, 0.95);
          const player = game.player;
          const pct = safeNumber(amount, 0) / Math.max(1, safeNumber(player?.maxHp, 1));
          // A glancing hit will not unseat a rider; a real one probably will.
          const chance = clamp(pct * 4, 0.15, 1) * (1 - resist);
          if (Math.random() < chance) this.dismount('You are thrown from the saddle!');
        },

        update() {
          if (!this.isMounted()) return;
          const player = game.player;
          // Continuous safeguards - conditions that can arise while already mounted.
          if (!player || player.alive === false) return void this.dismount('');
          if (game.isEntityInCombat?.(player) || player.inCombat) return void this.dismount('Combat forces you from the saddle.');
          const zone = String(game.currentZone || '');
          if (zone === 'dungeon') return void this.dismount('You cannot ride in here.');
          if (zone === 'cave' && !this.activeHasTrait('cave_sense')) return void this.dismount('Your mount refuses the caves.');
          if ((player.swimming || player.underwater) && !this.activeHasTrait('swimmer')) {
            return void this.dismount('Your mount cannot swim - you slide off into the water.');
          }
          if (player.meditating) this.dismount('');
        },

        notify(text) { this.blockedMessage = String(text || ''); this.blockedAt = Date.now(); },

        // ---------------------------------------------------------------
        // Panel
        // ---------------------------------------------------------------
        togglePanel(force) {
          this.panelOpen = typeof force === 'boolean' ? force : !this.panelOpen;
          const el = document.getElementById('mountPanel');
          if (el) el.style.display = this.panelOpen ? 'block' : 'none';
          if (this.panelOpen) this.renderPanel();
        },

        renderPanel() {
          const el = document.getElementById('mountPanel');
          if (!el || !this.panelOpen) return;
          const defs = this.definitions();
          const owned = this.tamedCount();
          const tier = this.tamingTier();
          const tierLabel = DR.tamingTierLabel ? DR.tamingTierLabel(tier) : 'Untrained';
          const rows = defs.map(def => {
            const unlocked = this.isUnlocked(def.id);
            const rec = this.record(def.id);
            const t = def.taming || {};
            const m = def.mount || {};
            const traits = (m.traits || []).map(k => DR.MOUNT_TRAITS?.[k]?.label || k).join(', ') || 'None';
            const color = RARITY_COLOR[def.rarity] || '#cfc7b4';
            const isActive = this.state.active === def.id;
            const isFav = this.state.favorite === def.id;
            const speed = `${Math.round((safeNumber(m.speedMult, 1) - 1) * 100)}%`;
            return `
              <div class="mountRow${unlocked ? '' : ' mountRowLocked'}${isActive ? ' mountRowActive' : ''}" data-mount="${escapeHtml(def.id)}">
                <div class="mountPreview" data-beast="${escapeHtml(def.beastKey)}"></div>
                <div class="mountInfo">
                  <div class="mountName" style="color:${color}">
                    ${escapeHtml(def.name)}${isFav ? ' <span class="mountFav">&#9733;</span>' : ''}
                    ${isActive ? ' <span class="mountActiveTag">ACTIVE</span>' : ''}
                  </div>
                  <div class="mountMeta">${escapeHtml(def.family)} &middot; ${escapeHtml(def.rarity)} &middot; speed +${speed}</div>
                  <div class="mountTraits">${escapeHtml(traits)}</div>
                  ${unlocked
                    ? `<div class="mountSource">${escapeHtml(rec.method || 'Tamed')} &middot; ${escapeHtml(rec.source)} &middot; level ${rec.level}</div>`
                    : def.acquisition === 'vendor'
                      // V0.20.70: a vendor mount is not locked behind taming - say where to buy it.
                      ? `<div class="mountReq">Sold by the camp quartermaster</div>`
                      : `<div class="mountReq">Locked &middot; level ${safeNumber(t.minPlayerLevel, 1)} &middot; ${escapeHtml(DR.tamingTierLabel ? DR.tamingTierLabel(t.requiredTier) : '')} &middot; bait: ${escapeHtml(DR.ITEM_BY_ID?.[t.bait]?.name || t.bait || '?')}</div>`}
                  <div class="mountDesc">${escapeHtml(def.description || '')}</div>
                </div>
                <div class="mountActions">
                  ${unlocked ? `<button data-mount-act="select" data-mount="${escapeHtml(def.id)}">${isActive ? 'Selected' : 'Select'}</button>` : ''}
                  ${unlocked ? `<button data-mount-act="fav" data-mount="${escapeHtml(def.id)}">${isFav ? 'Unfavourite' : 'Favourite'}</button>` : ''}
                </div>
              </div>`;
          }).join('');

          el.innerHTML = `
            <h3>Mounts</h3>
            <div class="mountSummary">
              Owned <strong>${this.ownedCount()}</strong> of ${defs.length} &middot; Tamed <strong>${owned}</strong> &middot; Rank: <strong>${escapeHtml(tierLabel)}</strong>
              ${this.state.active ? `&middot; Active: <strong>${escapeHtml(DR.MOUNT_BY_ID[this.state.active]?.name || '')}</strong>` : ''}
            </div>
            <div class="mountHint">Press <strong>${escapeHtml(keyLabel('tameBeast'))}</strong> near a weakened beast to attempt taming. Press <strong>${escapeHtml(keyLabel('mountToggle'))}</strong> to mount or dismount.</div>
            <div class="mountList">${rows}</div>`;

          el.querySelectorAll('[data-mount-act]').forEach(btn => {
            btn.addEventListener('click', ev => {
              ev.preventDefault();
              const id = btn.getAttribute('data-mount');
              const act = btn.getAttribute('data-mount-act');
              if (act === 'select') this.setActive(id);
              else if (act === 'fav') this.toggleFavorite(id);
            });
          });
          this.drawPreviews(el);
        },

        // Live procedural preview of the actual beast model, so the collection shows the creature the
        // player tamed rather than a generic icon (Item 7.F "mount portrait or preview").
        drawPreviews(root) {
          root.querySelectorAll('.mountPreview').forEach(node => {
            const beastKey = node.getAttribute('data-beast');
            const def = DR.MOUNT_BY_BEAST_KEY?.[String(beastKey).toLowerCase()];
            if (!def) return;
            let canvas = node.querySelector('canvas');
            if (!canvas) {
              canvas = document.createElement('canvas');
              canvas.width = 72; canvas.height = 72;
              node.appendChild(canvas);
            }
            const c = canvas.getContext('2d');
            c.clearRect(0, 0, canvas.width, canvas.height);
            const unlocked = this.isUnlocked(def.id);
            try {
              if (game.drawMountPreviewInto) game.drawMountPreviewInto(c, def, canvas.width, canvas.height, { silhouette: !unlocked });
              else {
                c.fillStyle = unlocked ? 'rgba(226,194,112,0.25)' : 'rgba(255,255,255,0.08)';
                c.beginPath(); c.arc(36, 36, 22, 0, Math.PI * 2); c.fill();
              }
            } catch (_err) {
              c.fillStyle = 'rgba(255,255,255,0.08)';
              c.beginPath(); c.arc(36, 36, 22, 0, Math.PI * 2); c.fill();
            }
          });
        },

        bindInput() {
          if (this.inputBound) return;
          this.inputBound = true;
          window.addEventListener('keydown', event => {
            if (!game.started || game.paused) return;
            const typing = document.activeElement && /input|textarea/i.test(document.activeElement.tagName || '');
            if (typing) return;
            if (game.tamingSystem?.session) return;   // taming owns the keyboard while active
            if (event.ctrlKey || event.altKey || event.metaKey) return;
            // V0.20.67: routed through the binding table rather than hardcoded letters. The originals
            // ('h' to mount, 'm' for the panel) silently collided with hireMerc and map.
            if (game.isActionKey?.(event, 'mountToggle')) {
              event.preventDefault();
              this.toggleMounted();
            } else if (game.isActionKey?.(event, 'mountPanel')) {
              event.preventDefault();
              this.togglePanel();
            }
          }, true);
        },

        // ---------------------------------------------------------------
        // Persistence (Roadmap Item 7.F "must persist through saves", Item 10)
        // ---------------------------------------------------------------
        serializeState() {
          return JSON.parse(JSON.stringify(this.state));
        },

        importState(raw) {
          this.state = normalizeState(raw);
          // A mount can never be left "ridden" across a load - the player always lands on foot.
          if (game.player) { game.player.mounted = false; game.player.mountId = null; game.player.mountVisualScale = 1; }
          this.renderPanel();
          return true;
        }
      };

      runtime.init();
      return runtime;
    }
  });
})();
