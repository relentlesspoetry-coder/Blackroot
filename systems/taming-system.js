// Blackroot beast-taming runtime (Roadmap Item 7.B / 7.C / 7.D / 7.E).
//
// V0.20.64. Design notes that matter:
//
// * Identity comes from the EXISTING mob record. This system never invents a creature; it looks the
//   target up by `mobVisualKey` in DR.MOUNT_BY_BEAST_KEY (data/mounts.js) and refuses anything that
//   is not an authored beast. Humanoids, undead, spirits and plant constructs therefore cannot be
//   tamed by construction, not by a blacklist (Item 7.A).
//
// * The minigame is DETERMINISTIC and frame-driven. No setTimeout, no setInterval, no promise
//   timers - every transition is advanced by update(dt) against accumulated time, and the state
//   sequence comes from a seeded PRNG so the same attempt replays identically (Item 7.J).
//
// * Bait is consumed through the same inventory semantics crafting uses (game.inventory, stack
//   decrement, splice at zero) rather than a private item path.
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const safeNumber = (v, f = 0) => Number.isFinite(Number(v)) ? Number(v) : f;

  const ACTIONS = [
    { id: 'soothe', key: '1', label: 'Soothe', hint: 'calm voice, slow hand' },
    { id: 'hold', key: '2', label: 'Hold', hint: 'stand absolutely still' },
    { id: 'feed', key: '3', label: 'Feed', hint: 'offer the bait' },
    { id: 'retreat', key: '4', label: 'Give Ground', hint: 'back away slowly' }
  ];
  const ACTION_BY_KEY = Object.create(null);
  for (const a of ACTIONS) ACTION_BY_KEY[a.key] = a.id;

  // Small deterministic PRNG (mulberry32). Seeded per attempt so a taming sequence is reproducible
  // and testable rather than depending on Math.random.
  function makeRng(seed) {
    let t = seed >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function inventoryMatches(entry, itemId) {
    if (!entry || !itemId) return false;
    return String(entry.itemId || entry.sourceItemId || entry.id) === String(itemId);
  }
  function itemStack(entry) {
    return Math.max(1, Math.floor(safeNumber(entry?.stack ?? entry?.qty ?? entry?.count, 1)));
  }
  function countBait(game, itemId) {
    let n = 0;
    for (const entry of game.inventory || []) if (inventoryMatches(entry, itemId)) n += itemStack(entry);
    return n;
  }
  // Mirrors systems/crafting-system.js consumeInputs so bait leaves the bag by the same rules
  // materials do - stack decrement first, splice when the stack empties.
  function consumeBait(game, itemId, quantity = 1) {
    let remaining = Math.max(1, Math.floor(quantity));
    const inv = game.inventory || [];
    for (let i = inv.length - 1; i >= 0 && remaining > 0; i--) {
      const entry = inv[i];
      if (!inventoryMatches(entry, itemId)) continue;
      const stack = itemStack(entry);
      if (game.isMaterialItem?.(entry) || stack > 1) {
        const used = Math.min(stack, remaining);
        entry.stack = stack - used;
        remaining -= used;
        if (entry.stack <= 0) inv.splice(i, 1);
      } else {
        inv.splice(i, 1);
        remaining -= 1;
      }
    }
    game.bagDirty = true;
    if (game.bagOpen) game.renderBag?.();
    return remaining <= 0;
  }

  function itemName(itemId) {
    const it = DR.ITEM_BY_ID?.[itemId];
    return it?.name || String(itemId || 'bait');
  }

  function beastDefFor(entity) {
    if (!entity) return null;
    const key = String(entity.mobVisualKey || entity.visualKey || '').toLowerCase();
    if (!key) return null;
    return DR.MOUNT_BY_BEAST_KEY?.[key] || null;
  }

  function registerDreamRealmsSystem(system) {
    const list = window.DreamRealmsSystems = window.DreamRealmsSystems || [];
    list.push(system);
  }

  registerDreamRealmsSystem({
    id: 'taming',
    name: 'Beast Taming',

    install(game) {
      const runtime = {
        id: 'taming',
        name: 'Beast Taming',
        game,
        session: null,
        // Retry cooldowns are RUNTIME only (Item 7.E "apply a retry cooldown"). They are intentionally
        // not persisted - a cooldown that survived a relog would be indistinguishable from a bug.
        cooldowns: new Map(),
        lastMessage: '',
        lastMessageAt: 0,

        init() {
          game.tamingSystem = this;
          game.beginTamingAttempt = target => this.beginTaming(target || game.target);
          game.tamingEligibility = target => this.evaluate(target);
          this.bindInput();
        },

        // ---------------------------------------------------------------
        // Eligibility + preparation (Roadmap Item 7.B)
        // ---------------------------------------------------------------
        evaluate(entity) {
          const player = game.player;
          if (!player) return { ok: false, reason: 'No character.' };
          if (!entity || entity.alive === false) return { ok: false, reason: 'No living target.' };
          const def = beastDefFor(entity);
          if (!def) return { ok: false, reason: `${entity.name || 'That creature'} is not a beast that can be tamed.` };

          const collection = game.mountSystem;
          const tamedCount = collection?.tamedCount?.() || 0;
          const tier = DR.tamingTierFor ? DR.tamingTierFor(tamedCount) : 0;
          const t = def.taming || {};

          if (collection?.isUnlocked?.(def.id)) {
            return { ok: false, def, reason: `You have already tamed a ${def.name}.` };
          }
          if (safeNumber(player.level, 1) < safeNumber(t.minPlayerLevel, 1)) {
            return { ok: false, def, reason: `Requires level ${t.minPlayerLevel}.` };
          }
          if (tier < safeNumber(t.requiredTier, 0)) {
            const label = DR.tamingTierLabel ? DR.tamingTierLabel(t.requiredTier) : `tier ${t.requiredTier}`;
            return { ok: false, def, reason: `Requires taming rank: ${label}.` };
          }
          const cdUntil = this.cooldowns.get(String(entity.id ?? def.beastKey)) || 0;
          if (cdUntil > game.nowMs?.() || cdUntil > Date.now()) {
            const left = Math.ceil((cdUntil - Date.now()) / 1000);
            if (left > 0) return { ok: false, def, reason: `This beast is still wary. Wait ${left}s.` };
          }
          const hpPct = safeNumber(entity.hp, 0) / Math.max(1, safeNumber(entity.maxHp, 1));
          if (hpPct > safeNumber(t.healthThreshold, 0.35)) {
            return { ok: false, def, reason: `Weaken it first - below ${Math.round(t.healthThreshold * 100)}% health (currently ${Math.round(hpPct * 100)}%).` };
          }
          if (countBait(game, t.bait) < 1) {
            return { ok: false, def, reason: `You need ${itemName(t.bait)} to approach it.` };
          }
          const dist = Math.hypot(entity.x - player.x, entity.y - player.y);
          if (dist > 4.5) return { ok: false, def, reason: 'Move closer.' };
          // Item 7.B: cannot begin while other hostiles are on you.
          const threats = (game.enemies || []).filter(e => e && e !== entity && e.alive !== false
            && Math.hypot(e.x - player.x, e.y - player.y) < 7
            && (e.target === player || game.isEntityInCombat?.(e)));
          if (threats.length) return { ok: false, def, reason: `Too dangerous - ${threats.length} other hostile${threats.length > 1 ? 's' : ''} nearby.` };
          if (game.player?.swimming) return { ok: false, def, reason: 'You cannot tame while swimming.' };
          return { ok: true, def, tier };
        },

        beginTaming(entity) {
          if (this.session) { this.notify('You are already handling a beast.'); return false; }
          const check = this.evaluate(entity);
          if (!check.ok) {
            // V0.20.66: the refusal reason MUST reach the player. Without this the feature is
            // undiscoverable - pressing T on a beast you cannot yet tame produced no feedback at all,
            // so there was no way to learn that it needs weakening, or which bait it wants.
            this.notify(check.reason);
            game.log?.(check.reason);
            return false;
          }
          const def = check.def;
          const t = def.taming || {};
          if (!consumeBait(game, t.bait, 1)) { this.notify('The bait slipped from your hand.'); return false; }

          const pattern = DR.TAMING_PATTERNS?.[t.pattern] || DR.TAMING_PATTERNS?.lunge;
          const seed = (Math.floor(entity.x * 73856) ^ Math.floor(entity.y * 19349) ^ Math.floor(Date.now() / 1000)) >>> 0;
          this.session = {
            entity, def, pattern,
            rng: makeRng(seed),
            trust: 12,
            agitation: 0,
            state: null,
            phase: 'approach',
            phaseTimer: 1.1,
            answered: false,
            correctStreak: 0,
            mistakes: 0,
            rounds: 0,
            zone: game.currentZone || 'overworld',
            anchorX: game.player.x,
            anchorY: game.player.y,
            lastPlayerHp: safeNumber(game.player.hp, 0),
            lastTargetHp: safeNumber(entity.hp, 0),
            baitItem: t.bait,
            log: 'You lower your voice and step in slowly.'
          };
          entity._tamingTarget = true;
          game.log?.(`Taming ${def.name}. Read the beast - answer with 1 Soothe, 2 Hold, 3 Feed, 4 Give Ground.`);
          return true;
        },

        // ---------------------------------------------------------------
        // Minigame (Roadmap Item 7.C) - all timing driven from update(dt)
        // ---------------------------------------------------------------
        nextState() {
          const s = this.session;
          const states = s.pattern?.states || [];
          if (!states.length) return null;
          // Avoid repeating the same state twice running so the player is reading, not memorising.
          let pick = states[Math.floor(s.rng() * states.length) % states.length];
          if (s.state && pick.id === s.state.id && states.length > 1) {
            pick = states[(states.indexOf(pick) + 1) % states.length];
          }
          return pick;
        },

        beginState() {
          const s = this.session;
          const st = this.nextState();
          if (!st) { this.finishFailure('The beast slips away.'); return; }
          s.state = st;
          s.phase = 'tell';
          // Difficulty compresses the reaction window; higher trust widens it slightly, so a
          // well-handled beast becomes readable rather than infinitely punishing.
          const diff = clamp(safeNumber(s.def.taming?.difficulty, 2), 1, 5);
          const trustEase = 1 + (s.trust / 100) * 0.25;
          s.phaseTimer = Math.max(0.45, safeNumber(st.tellSec, 1.2) * (1.25 - diff * 0.09) * trustEase);
          s.stateWindow = s.phaseTimer;   // remembered so the countdown bar has a real denominator
          s.answered = false;
          s.rounds += 1;
          s.log = st.tell;
        },

        submitAction(actionId) {
          const s = this.session;
          if (!s || s.phase !== 'tell' || s.answered) return;
          s.answered = true;
          const st = s.state;
          const t = s.def.taming || {};
          if (st.feint) {
            // Acting on a false opening is the mistake (Item 7.C "behavioural tells").
            s.agitation += safeNumber(t.agitationPerMistake, 18);
            s.mistakes += 1;
            s.correctStreak = 0;
            s.log = 'It was baiting you. The beast recoils.';
          } else if (actionId === st.answer) {
            s.correctStreak += 1;
            const bonus = 1 + Math.min(0.5, (s.correctStreak - 1) * 0.12);
            s.trust += safeNumber(t.trustPerCorrect, 14) * bonus;
            s.agitation = Math.max(0, s.agitation - 4);
            s.log = 'It settles a little.';
          } else {
            s.agitation += safeNumber(t.agitationPerMistake, 18);
            s.mistakes += 1;
            s.correctStreak = 0;
            s.log = 'Wrong read. It tenses.';
          }
          s.phase = 'resolve';
          s.phaseTimer = 0.6;
        },

        resolveUnanswered() {
          const s = this.session;
          const st = s.state;
          const t = s.def.taming || {};
          if (st.feint) {
            // Correctly doing nothing through a feint is a real success.
            s.correctStreak += 1;
            s.trust += safeNumber(t.trustPerCorrect, 14) * 0.8;
            s.log = 'You did not take the bait. It respects that.';
          } else {
            s.agitation += safeNumber(t.agitationPerMistake, 18) * 0.7;
            s.mistakes += 1;
            s.correctStreak = 0;
            s.log = 'You hesitated.';
          }
          s.phase = 'resolve';
          s.phaseTimer = 0.6;
        },

        update(dt) {
          const s = this.session;
          if (!s) return;
          const step = clamp(safeNumber(dt, 0), 0, 0.25);
          const player = game.player;
          const entity = s.entity;

          // ---- interrupts (Roadmap Item 7.B) ----
          if (!player || player.alive === false) return this.finishFailure('You went down.', { silentBeast: true });
          if (!entity || entity.alive === false) return this.finishFailure(`The ${s.def.name} is dead.`, { silentBeast: true });
          if (game.currentZone !== s.zone && s.zone) return this.finishFailure('You left the area.');
          const dist = Math.hypot(entity.x - player.x, entity.y - player.y);
          if (dist > 6.5) return this.finishFailure('The beast broke away.');
          if (Math.hypot(player.x - s.anchorX, player.y - s.anchorY) > 1.6) {
            return this.finishFailure('You moved too much - it bolted.');
          }
          const hpNow = safeNumber(player.hp, 0);
          if (hpNow < s.lastPlayerHp - 0.5) return this.finishFailure('You were struck - the moment is lost.');
          s.lastPlayerHp = hpNow;
          const targetHp = safeNumber(entity.hp, 0);
          if (targetHp < s.lastTargetHp - 0.5) {
            return this.finishFailure('It was wounded mid-approach and panicked.');
          }
          s.lastTargetHp = targetHp;

          // ---- agitation drift: standing still forever is not a strategy ----
          s.agitation += safeNumber(s.def.taming?.agitationDrift, 1.4) * step;

          s.phaseTimer -= step;
          if (s.phase === 'approach') {
            if (s.phaseTimer <= 0) this.beginState();
          } else if (s.phase === 'tell') {
            if (s.phaseTimer <= 0 && !s.answered) this.resolveUnanswered();
          } else if (s.phase === 'resolve') {
            if (s.phaseTimer <= 0) {
              if (s.trust >= 100) return this.finishSuccess();
              if (s.agitation >= 100) return this.finishFailure('The beast will not be handled.');
              this.beginState();
            }
          }
          s.trust = clamp(s.trust, 0, 100);
          s.agitation = clamp(s.agitation, 0, 100);
          if (s.agitation >= 100) this.finishFailure('The beast will not be handled.');
        },

        // ---------------------------------------------------------------
        // Outcomes (Roadmap Item 7.E)
        // ---------------------------------------------------------------
        finishSuccess() {
          const s = this.session;
          if (!s) return;
          const { entity, def } = s;
          this.session = null;
          if (entity) {
            entity._tamingTarget = false;
            // End the hostile encounter cleanly rather than leaving an aggroed corpse-in-waiting.
            entity.alive = false;
            entity.hp = 0;
            entity._tamedAway = true;
            entity.target = null;
            if (Array.isArray(game.enemies)) {
              const i = game.enemies.indexOf(entity);
              if (i >= 0) game.enemies.splice(i, 1);
            }
            if (Array.isArray(game.entities)) {
              const i = game.entities.indexOf(entity);
              if (i >= 0) game.entities.splice(i, 1);
            }
            if (game.target === entity) game.target = null;
          }
          const zone = game.currentZone || 'dark_woods';
          const result = game.mountSystem?.unlockMount?.(def.id, {
            source: game.portalCurrentZoneName?.() || zone,
            method: 'Tamed in the wild',
            level: safeNumber(game.player?.level, 1)
          });
          if (result?.alreadyOwned) game.log?.(`${def.name} was already in your stable.`);
          else game.log?.(`${def.name} accepts you. It has been added to your mounts.`);
          this.notify(`${def.name} tamed.`);
          game.playSound?.('quest_complete');
        },

        finishFailure(reason, options = {}) {
          const s = this.session;
          if (!s) return;
          const { entity, def } = s;
          this.session = null;
          const t = def?.taming || {};
          if (entity) entity._tamingTarget = false;
          const cdMs = Math.max(0, safeNumber(t.retryCooldownSec, 45)) * 1000;
          if (entity && cdMs > 0) this.cooldowns.set(String(entity.id ?? def.beastKey), Date.now() + cdMs);

          if (!options.silentBeast && entity && entity.alive !== false) {
            const behaviour = String(t.failure || 'enrage');
            if (behaviour === 'enrage') {
              entity.enraged = true;
              entity.target = game.player;
              entity.aggro = true;
              game.log?.(`The ${def.name} turns on you, enraged.`);
            } else if (behaviour === 'flee') {
              entity.fleeing = true;
              entity._fleeUntil = Date.now() + 8000;
              game.log?.(`The ${def.name} bolts into the trees.`);
            } else if (behaviour === 'untameable') {
              entity._untameable = true;
              game.log?.(`The ${def.name} will not let you near it again.`);
            }
          }
          game.log?.(`Taming failed: ${reason}`);
          this.notify(`Taming failed - ${reason}`);
        },

        cancel(reason = 'You step back.') {
          if (!this.session) return;
          this.finishFailure(reason);
        },

        notify(text) {
          this.lastMessage = String(text || '');
          this.lastMessageAt = Date.now();
        },

        // ---------------------------------------------------------------
        // Input
        // ---------------------------------------------------------------
        bindInput() {
          if (this.inputBound) return;
          this.inputBound = true;
          window.addEventListener('keydown', event => {
            if (!game.started || game.paused) return;
            const typing = document.activeElement && /input|textarea/i.test(document.activeElement.tagName || '');
            if (typing) return;
            const key = String(event.key || '');
            if (this.session) {
              // While a beast is being handled the four answer keys belong to the minigame. They are
              // captured (not merely handled) so the hotbar cannot fire a spell mid-taming, which
              // would break the encounter anyway.
              const action = ACTION_BY_KEY[key];
              if (action) {
                event.preventDefault();
                event.stopImmediatePropagation();
                this.submitAction(action);
                return;
              }
              if (key === 'Escape') {
                event.preventDefault();
                event.stopImmediatePropagation();
                this.cancel();
                return;
              }
              return;
            }
            // Begin an attempt on the current target. V0.20.67: routed through the binding table -
            // the original hardcoded 'T' silently collided with the portal action.
            if (event.ctrlKey || event.altKey || event.metaKey) return;
            if (game.isActionKey?.(event, 'tameBeast')) {
              const target = game.target;
              if (!target) return;
              // Stay silent for non-beasts so the key is not stolen from anything else bound to it.
              if (!beastDefFor(target)) return;
              event.preventDefault();
              event.stopImmediatePropagation();
              this.beginTaming(target);
            }
          }, true);
        },

        // ---------------------------------------------------------------
        // Minigame overlay
        // ---------------------------------------------------------------
        render(context) {
          const s = this.session;
          if (!s || !context) return;
          const canvas = context.canvas;
          const W = canvas.width, H = canvas.height;
          const w = Math.min(560, W * 0.6);
          const x = Math.round((W - w) / 2);
          const y = Math.round(H * 0.12);
          const h = 150;

          context.save();
          context.fillStyle = 'rgba(6,12,10,0.88)';
          context.strokeStyle = 'rgba(214,196,138,0.7)';
          context.lineWidth = 2;
          context.beginPath();
          if (context.roundRect) context.roundRect(x, y, w, h, 10); else context.rect(x, y, w, h);
          context.fill();
          context.stroke();

          context.textAlign = 'center';
          context.fillStyle = '#e6dcc8';
          context.font = 'bold 15px ui-monospace, monospace';
          context.fillText(`Taming ${s.def.name}`, x + w / 2, y + 24);

          // trust + agitation meters
          const barW = w - 48;
          const drawBar = (by, label, value, color) => {
            context.textAlign = 'left';
            context.font = '11px ui-monospace, monospace';
            context.fillStyle = '#9c9280';
            context.fillText(label, x + 24, by - 4);
            context.fillStyle = 'rgba(255,255,255,0.10)';
            context.fillRect(x + 24, by, barW, 9);
            context.fillStyle = color;
            context.fillRect(x + 24, by, barW * clamp(value / 100, 0, 1), 9);
          };
          drawBar(y + 48, `Trust ${Math.round(s.trust)}%`, s.trust, '#7fc96b');
          drawBar(y + 76, `Agitation ${Math.round(s.agitation)}%`, s.agitation, '#d2683f');

          // current tell
          context.textAlign = 'center';
          context.font = '13px ui-sans-serif, sans-serif';
          context.fillStyle = s.phase === 'tell' ? '#ffe9a8' : '#cfc7b4';
          context.fillText(String(s.log || ''), x + w / 2, y + 104);

          // reaction window
          if (s.phase === 'tell' && !s.answered) {
            const total = Math.max(0.001, safeNumber(s.stateWindow, s.phaseTimer));
            context.fillStyle = 'rgba(255,255,255,0.10)';
            context.fillRect(x + 24, y + 112, barW, 4);
            context.fillStyle = '#ffe9a8';
            context.fillRect(x + 24, y + 112, barW * clamp(s.phaseTimer / total, 0, 1), 4);
          }

          // action prompts
          context.font = '11px ui-monospace, monospace';
          const slotW = barW / ACTIONS.length;
          ACTIONS.forEach((a, i) => {
            const ax = x + 24 + slotW * i + slotW / 2;
            context.fillStyle = '#e2c270';
            context.fillText(`${a.key}`, ax, y + 132);
            context.fillStyle = '#b8ad97';
            context.fillText(a.label, ax, y + 144);
          });
          context.restore();
        },

        serializeState() {
          // Nothing here is persistent by design: the collection lives in mount-system, taming rank
          // is derived from it, and retry cooldowns are deliberately runtime-only.
          return null;
        },
        importState() { return true; }
      };

      runtime.init();
      return runtime;
    }
  });
})();
