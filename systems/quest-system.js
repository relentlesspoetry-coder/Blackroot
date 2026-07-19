// Dream Realms runtime quest log and quest playback system
// Modular Pass 31: consumes editor quest drafts and quest-hook/NPC metadata at runtime.
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const STORAGE_KEY = 'dream-realms.quest-runtime.v1';

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[ch]);

  const cloneJson = value => JSON.parse(JSON.stringify(value ?? null));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  // V0.17.84 Dark Woods Quest Rebuild helpers.
  const isPoiTarget = to => typeof to === 'string' && to.startsWith('poi_');
  const itemName = id => DR.ITEM_BY_ID?.[id]?.name || id;

  function invCount(game, itemId) {
    let total = 0;
    for (const it of game.inventory || []) {
      if (!it) continue;
      if (it.id === itemId || it.itemId === itemId) total += Math.max(1, Math.floor(Number(it.stack ?? it.quantity ?? 1)) || 1);
    }
    return total;
  }

  function invRemove(game, itemId, qty) {
    let remaining = Math.max(1, Math.floor(qty) || 1);
    const inv = game.inventory || [];
    for (let i = inv.length - 1; i >= 0 && remaining > 0; i--) {
      const it = inv[i];
      if (!it || !(it.id === itemId || it.itemId === itemId)) continue;
      const stack = Math.max(1, Math.floor(Number(it.stack ?? it.quantity ?? 1)) || 1);
      const used = Math.min(stack, remaining);
      remaining -= used;
      if (stack - used <= 0) inv.splice(i, 1);
      else if (it.stack !== undefined) it.stack = stack - used;
      else it.quantity = stack - used;
    }
    game.bagDirty = true;
    if (game.bagOpen) game.renderBag?.();
    return remaining <= 0;
  }

  function defaultState() {
    return {
      active: {},
      completed: {},
      discovered: {},
      discoveredPois: {},
      consumedInteractPoints: {},
      selectedQuestId: null,
      version: 1
    };
  }

  function normalizeState(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== 'object') return base;
    base.active = raw.active && typeof raw.active === 'object' ? raw.active : {};
    base.completed = raw.completed && typeof raw.completed === 'object' ? raw.completed : {};
    base.discovered = raw.discovered && typeof raw.discovered === 'object' ? raw.discovered : {};
    base.discoveredPois = raw.discoveredPois && typeof raw.discoveredPois === 'object' ? raw.discoveredPois : {};
    base.consumedInteractPoints = raw.consumedInteractPoints && typeof raw.consumedInteractPoints === 'object' ? raw.consumedInteractPoints : {};
    base.selectedQuestId = raw.selectedQuestId || Object.keys(base.active)[0] || null;
    return base;
  }

  function readLocalState() {
    try {
      const raw = window.localStorage?.getItem(STORAGE_KEY);
      return normalizeState(raw ? JSON.parse(raw) : null);
    } catch (_err) {
      return defaultState();
    }
  }

  function writeLocalState(state) {
    try { window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_err) {}
  }

  function zoneKey(game) {
    return game.currentZone === 'cave' ? (game.getActiveCaveZoneKey?.() || game.currentCave?.id || 'mossfang_cave') : 'dark_woods';
  }

  function zoneRuntimeId(game) {
    return game.currentZone === 'cave' ? (game.getActiveCaveZoneKey?.() || game.currentCave?.id || 'mossfang_cave') : 'dark_woods';
  }

  function keyDistanceToPlayer(game, node) {
    if (!game.player || !node) return Infinity;
    const x = Number(node.x);
    const y = Number(node.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return Infinity;
    return Math.hypot((x + 0.5) - game.player.x, (y + 0.5) - game.player.y);
  }

  function findNearGridNodes(game, grid, range, predicate = null) {
    const out = [];
    if (!grid || typeof grid !== 'object' || !game.player) return out;
    for (const node of Object.values(grid)) {
      if (!node || node.enabled === false) continue;
      if (predicate && !predicate(node)) continue;
      const d = keyDistanceToPlayer(game, node);
      if (d <= range) out.push({ node, d });
    }
    out.sort((a, b) => a.d - b.d);
    return out;
  }

  function ensurePanel() {
    const host = document.getElementById('externalSystemsHud');
    if (!host) return null;
    let panel = document.getElementById('questSystemPanel');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'questSystemPanel';
    panel.className = 'systemPanel';
    panel.innerHTML = `
      <h3>Quests</h3>
      <div class="small" data-quest-status>Press E near a quest source.</div>
      <div class="systemMeter"><div class="systemMeterFill" data-quest-progress style="background:linear-gradient(90deg,#7c4dcf,#d29cff)"></div></div>
      <!-- V0.20.5 (Roadmap Item 15, tracking): the HUD showed an aggregate percentage across every
           active quest and never named a single objective, so "show tracked objectives clearly" had
           nothing behind it. The tracked quest is the one selected in the journal (selectedQuestId) -
           that is the tracked-quest limit: exactly one, which the journal's Select button already
           enforced by being a single-value field. -->
      <div data-quest-tracked></div>
      <div class="small" data-quest-meta>L: Quest Log · E: Interact</div>
    `;
    host.appendChild(panel);
    return panel;
  }

  function ensureQuestLogWindow(runtime) {
    let panel = document.getElementById('questLogPanel');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'questLogPanel';
    panel.className = 'panel gameWindow';
    panel.style.display = 'none';
    panel.style.right = '284px';
    panel.style.top = '84px';
    panel.style.width = 'min(520px, calc(100vw - 26px))';
    panel.style.maxHeight = 'min(650px, calc(100vh - 120px))';
    panel.style.overflow = 'auto';
    panel.innerHTML = `
      <div class="windowHeader">
        <div>
          <div class="name">Quest Journal</div>
          <div class="small">L toggles this window. E interacts with nearby quest sources.</div>
        </div>
        <button data-quest-close>Close</button>
      </div>
      <div class="small" data-quest-log-summary></div>
      <!-- V0.20.4 (Roadmap Item 15): search / filter / sort. Every option here is backed by a field the
           quest data actually authors - folder, region, minLevel, giver, repeatable. The spec also asks
           for a Main/Side split, a quest level distinct from minLevel, and repeatable reset timing:
           NONE of those exist in the data (audited across all 26 quests), so they are deliberately
           absent rather than faked with a placeholder that would always read the same. -->
      <div style="display:flex; gap:6px; margin-top:8px; flex-wrap:wrap; align-items:center">
        <input data-quest-search type="search" placeholder="Search name, giver, place…"
               style="flex:1 1 150px; min-width:120px" aria-label="Search quests">
        <select data-quest-filter aria-label="Filter quests">
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="repeatable">Repeatable</option>
          <option value="all">All</option>
        </select>
        <select data-quest-sort aria-label="Sort quests">
          <option value="level">Level</option>
          <option value="name">Name</option>
          <option value="region">Place</option>
        </select>
      </div>
      <div data-quest-log-body></div>
      <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap">
        <button data-quest-action="abandon">Abandon Selected</button>
        <button data-quest-action="reset">Reset Quest Runtime</button>
      </div>
    `;
    document.body.appendChild(panel);
    panel.querySelector('[data-quest-close]')?.addEventListener('click', () => runtime.toggleLog(false));
    // V0.20.4: journal view state is deliberately NOT saved into quest state - it is a view preference,
    // not character progress, and quest state round-trips through every character save.
    panel.querySelector('[data-quest-search]')?.addEventListener('input', event => {
      runtime.logSearch = String(event.target.value || '');
      runtime.renderQuestLog();
    });
    panel.querySelector('[data-quest-filter]')?.addEventListener('change', event => {
      runtime.logFilter = String(event.target.value || 'active');
      runtime.renderQuestLog();
    });
    panel.querySelector('[data-quest-sort]')?.addEventListener('change', event => {
      runtime.logSort = String(event.target.value || 'level');
      runtime.renderQuestLog();
    });
    panel.addEventListener('click', event => {
      const questButton = event.target.closest('button[data-quest-select]');
      if (questButton) {
        runtime.state.selectedQuestId = questButton.dataset.questSelect;
        runtime.saveState();
        runtime.refreshPanel();
        runtime.renderQuestLog();
        return;
      }
      const action = event.target.closest('button[data-quest-action]')?.dataset.questAction;
      if (action === 'abandon') runtime.abandonSelectedQuest();
      else if (action === 'reset') runtime.resetRuntimeState();
    });
    return panel;
  }

  function taskText(task) {
    const required = Math.max(1, Number(task.required) || 1);
    const progress = clamp(Number(task.progress) || 0, 0, required);
    return `${task.label || task.target || task.type}: ${progress}/${required}`;
  }

  function isTypingTarget(event) {
    const el = event.target;
    if (!el) return false;
    const tag = String(el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }

  registerDreamRealmsSystem({
    id: 'questRuntime',
    name: 'Runtime Quest System',

    install(game) {
      const runtime = {
        id: 'questRuntime',
        name: 'Runtime Quest System',
        game,
        state: normalizeState(game.pendingQuestRuntimeState || readLocalState()),
        panel: ensurePanel(),
        logPanel: null,
        logOpen: false,
        // V0.20.4 (Roadmap Item 15): journal view state. Deliberately NOT part of `state` - that
        // round-trips through every character save, and a search box is a view preference, not progress.
        logSearch: '',
        logFilter: 'active',
        logSort: 'level',
        promptSource: null,
        exploreTick: 0,
        defend: null,
        escort: null,

        init() {
          game.questSystem = this;
          game.questRuntimeState = this.state;
          this.pruneUnknownQuests();
          this.bindInput();
          this.refreshPanel();
        },

        // V0.17.84: the 11 legacy Dark Woods quests were removed. Drop any
        // active/completed entries in an existing save whose quest id no longer
        // exists so the log isn't stranded with un-turn-in-able old quests.
        pruneUnknownQuests() {
          const known = new Set(this.allQuestIds());
          let changed = false;
          for (const id of Object.keys(this.state.active || {})) {
            if (!known.has(id)) { delete this.state.active[id]; changed = true; }
          }
          for (const id of Object.keys(this.state.completed || {})) {
            if (!known.has(id)) { delete this.state.completed[id]; changed = true; }
          }
          if (this.state.selectedQuestId && !this.state.active[this.state.selectedQuestId]) {
            this.state.selectedQuestId = Object.keys(this.state.active)[0] || null;
            changed = true;
          }
          if (changed) this.saveState();
        },

        bindInput() {
          if (this.inputBound) return;
          this.inputBound = true;
          window.addEventListener('keydown', event => {
            if (isTypingTarget(event) || event.repeat) return;
            const key = event.key.toLowerCase();
            if (game.isActionKey ? game.isActionKey(event, 'questLog') : key === 'l') {
              if (!game.started) return;
              event.preventDefault();
              this.toggleLog();
            } else if (game.isActionKey ? game.isActionKey(event, 'interact') : key === 'e') {
              if (!game.started || game.paused || !game.player || !game.player.alive) return;
              event.preventDefault();
              this.interact();
            }
          });
        },

        onGameEvent(eventName, payload = {}) {
          if (eventName === 'player-started') {
            this.state = normalizeState(game.pendingQuestRuntimeState || this.state || readLocalState());
            this.saveState();
            this.refreshPanel();
          } else if (eventName === 'enemy-killed') {
            this.handleEnemyKilled(payload);
          } else if (eventName === 'zone-entered') {
            this.advanceObjective('enterZone', payload.zoneId || zoneRuntimeId(game), 1);
          } else if (eventName === 'item-gained') {
            this.advanceObjective('collect', payload.itemId || payload.name, Number(payload.qty) || 1);
          } else if (eventName === 'resource-gathered') {
            this.advanceObjective('gather', {
              id: payload.resourceId,
              name: payload.resourceName,
              category: payload.category,
              skill: payload.skill,
              zoneId: payload.zoneId
            }, 1);
          }
        },

        serializeState() {
          return cloneJson(this.state);
        },

        importState(state) {
          this.state = normalizeState(state || defaultState());
          game.questRuntimeState = this.state;
          this.saveState();
          this.refreshPanel();
          this.renderQuestLog();
        },

        saveState() {
          game.questRuntimeState = this.state;
          writeLocalState(this.state);
        },

        questById(id) {
          return game.editorQuests?.[id] || DR.QUEST_BY_ID?.[id] || null;
        },

        allQuestIds() {
          const ids = new Set([...Object.keys(DR.QUEST_BY_ID || {}), ...Object.keys(game.editorQuests || {})]);
          return Array.from(ids);
        },

        cloneQuestForRuntime(quest) {
          const copy = cloneJson(quest);
          copy.tasks = Array.isArray(copy.tasks) ? copy.tasks.map(task => ({ ...task, progress: 0 })) : [];
          copy.status = 'active';
          copy.acceptedAt = Date.now();
          copy.updatedAt = Date.now();
          this.resolveRotatingTasks(copy);
          this.syncWorldObjectivesOnAccept(copy);
          return copy;
        },

        // V0.17.84 [04]: a task carrying rotateOptions picks today's target by a
        // daily index so a repeatable's ask changes each day.
        resolveRotatingTasks(questState) {
          const dayIndex = Math.floor(Date.now() / 86400000);
          for (const task of questState.tasks || []) {
            if (!Array.isArray(task.rotateOptions) || !task.rotateOptions.length) continue;
            task.target = task.rotateOptions[dayIndex % task.rotateOptions.length];
            const name = DR.RESOURCE_BY_ID?.[task.target]?.name || itemName(task.target);
            if (name) task.label = `Gather ${name}`;
          }
        },

        // V0.17.84: seed progress for objectives whose trigger may have already
        // fired before the quest was accepted - discover POIs already visited,
        // and collect/deliver-to-NPC items already in the bag. This makes the
        // discover/collect/deliver verbs robust to out-of-order play.
        syncWorldObjectivesOnAccept(questState) {
          for (const task of questState.tasks || []) {
            const required = Math.max(1, Number(task.required) || 1);
            if (task.type === 'discover' && this.state.discoveredPois?.[task.target]) {
              task.progress = required;
            } else if ((task.type === 'collect' || (task.type === 'deliver' && !isPoiTarget(task.to))) && task.target) {
              task.progress = clamp(invCount(game, task.target), 0, required);
            }
          }
        },

        isQuestComplete(questState) {
          return Boolean(questState?.tasks?.length) && questState.tasks.every(task => (Number(task.progress) || 0) >= Math.max(1, Number(task.required) || 1));
        },

        isQuestAvailable(questId) {
          const quest = this.questById(questId);
          if (!quest) return false;
          if (this.state.active[questId]) return false;
          if (this.state.completed[questId] && !quest.repeatable) return false;
          const prereqs = Array.isArray(quest.prerequisiteQuestIds) ? quest.prerequisiteQuestIds : [];
          for (const prereqId of prereqs) {
            if (!this.state.completed[prereqId]) return false;
          }
          const minLevel = Math.max(0, Number(quest.minLevel || 0) || 0);
          if (minLevel > 0 && Number(game.player?.level || 1) < minLevel) return false;
          // Phase 5 (Event/Quest/Condition/Variable Parity): optional
          // quest.requiredConditions, reusing the same condition-object
          // format (variable/selfSwitch/questAvailable/questCompleted/
          // level/itemOwned) as event node conditions
          // (systems/event-system.js evaluateEventCondition). No shipped
          // quest sets this field, so this check is a no-op for every
          // current quest.
          if (Array.isArray(quest.requiredConditions) && quest.requiredConditions.length) {
            if (!game.eventSystem?.evaluateEventConditions?.(quest.requiredConditions)) return false;
          }
          return true;
        },

        unavailableQuestReason(questId) {
          const quest = this.questById(questId);
          if (!quest) return 'Quest data missing.';
          const prereqs = Array.isArray(quest.prerequisiteQuestIds) ? quest.prerequisiteQuestIds : [];
          const missing = prereqs.filter(id => !this.state.completed[id]);
          if (missing.length) {
            const names = missing.map(id => this.questById(id)?.name || id).join(', ');
            return `Complete ${names} first.`;
          }
          const minLevel = Math.max(0, Number(quest.minLevel || 0) || 0);
          if (minLevel > 0 && Number(game.player?.level || 1) < minLevel) return `Requires level ${minLevel}.`;
          if (Array.isArray(quest.requiredConditions) && quest.requiredConditions.length && !game.eventSystem?.evaluateEventConditions?.(quest.requiredConditions)) {
            // V0.19.4 (Roadmap Item 1, state 7 + the branch half of state 6): this string is spoken BY
            // the NPC (see the caller: `${source.name}: ${unavailableQuestReason(...)}`), so a bare
            // "Requirements not yet met." puts developer text in their mouth - Cael, whose patrol you
            // just killed for Rurik, would answer you with it. lockedText is the authored in-character
            // refusal, which for the Rurik fork IS each side's distinct response to your choice.
            // The prerequisite and level messages above are left alone: they carry useful information.
            return quest.lockedText || 'Requirements not yet met.';
          }
          if (this.state.completed[questId] && !quest.repeatable) return `${quest.name || questId} is already complete.`;
          if (this.state.active[questId]) return `${quest.name || questId} is already active.`;
          return 'Quest is not currently available.';
        },

        chooseQuestRewardChoice(rewards = {}) {
          const choices = Array.isArray(rewards.choiceItems) ? rewards.choiceItems : [];
          if (!choices.length) return null;
          const cls = String(game.player?.className || game.player?.class || '').toLowerCase();
          const matched = choices.find(choice => Array.isArray(choice.classes) && choice.classes.map(c => String(c).toLowerCase()).includes(cls));
          return matched || choices[0];
        },

        auditSilkWebQuestChain() {
          const ids = ['quest_silkweb_threads_in_the_dark','quest_silkweb_cocoons_that_whisper','quest_silkweb_cut_the_broodlines','quest_silkweb_venom_for_the_lanterns','quest_silkweb_the_looming_queen'];
          const missing = ids.filter(id => !this.questById(id));
          const rewardsMissing = [];
          for (const id of ids) {
            const q = this.questById(id);
            for (const reward of [...(q?.rewards?.items || []), ...(q?.rewards?.choiceItems || [])]) {
              const itemId = reward.id || reward.itemId;
              if (itemId && !(game.getEditorItemDraft?.(itemId) || DR.ITEM_BY_ID?.[itemId])) rewardsMissing.push(`${id}:${itemId}`);
            }
          }
          return { questCount: ids.length - missing.length, missing, rewardsMissing, ok: missing.length === 0 && rewardsMissing.length === 0 };
        },


        getQuestTargetInfoForEnemy(enemy) {
          if (!enemy || !enemy.alive) return null;
          const payload = {
            id: enemy.id,
            name: String(enemy.name || '').toLowerCase(),
            baseName: String(enemy.baseType?.name || enemy.name || '').toLowerCase(),
            zoneId: game.currentZone === 'cave' ? (game.getActiveCaveZoneKey?.() || game.currentCave?.id || 'mossfang_cave') : 'dark_woods',
            level: enemy.level || 1
          };
          for (const questState of Object.values(this.state.active || {})) {
            if (!questState || this.isQuestComplete(questState)) continue;
            for (const task of questState.tasks || []) {
              if (task.type !== 'kill' || !this.objectiveMatches(task, 'kill', payload)) continue;
              const required = Math.max(1, Number(task.required) || 1);
              const progress = clamp(Number(task.progress) || 0, 0, required);
              if (progress >= required) continue;
              return {
                questId: questState.id,
                questName: questState.name || questState.id,
                taskLabel: task.label || task.target || 'Quest Target',
                progress,
                required,
                remaining: Math.max(0, required - progress)
              };
            }
          }
          return null;
        },

        isQuestTargetEnemy(enemy) {
          return Boolean(this.getQuestTargetInfoForEnemy(enemy));
        },

        acceptQuest(questId, sourceName = 'Quest Source') {
          const quest = this.questById(questId);
          if (!quest) return false;
          if (!this.isQuestAvailable(questId)) {
            const active = this.state.active[questId];
            if (active && this.isQuestComplete(active)) return this.completeQuest(questId, sourceName);
            if (active) game.log(active.inProgressText || quest.inProgressText || `${quest.name} is already active.`);
            else game.log(`${quest.name} has already been completed.`);
            this.refreshPanel();
            return false;
          }
          this.state.active[questId] = this.cloneQuestForRuntime(quest);
          const deadline = this.questDeadlineSeconds(quest);
          if (deadline > 0) this.state.active[questId].deadlineAt = Date.now() + deadline * 1000;
          this.spawnQuestOnAccept(quest);
          this.state.discovered[questId] = Date.now();
          this.state.selectedQuestId = questId;
          this.saveState();
          game.playAudioEvent?.('quest_accept', { actor: game.player });
          game.log(`${sourceName}: ${quest.offerText || `Accepted quest: ${quest.name}.`}`);
          this.refreshPanel();
          this.renderQuestLog();
          return true;
        },

        completeQuest(questId, sourceName = 'Quest Source') {
          const active = this.state.active[questId];
          const quest = active || this.questById(questId);
          if (!active || !quest) return false;
          if (!this.isQuestComplete(active)) {
            game.log(active.inProgressText || quest.inProgressText || `${quest.name} is not complete yet.`);
            return false;
          }
          // V0.17.84: deliver-to-an-NPC tasks hand the carried item to the
          // turn-in NPC - consume it now. (deliver-to-a-POI tasks already
          // consumed their item at the delivery point.)
          for (const task of active.tasks || []) {
            if (task.type === 'deliver' && !isPoiTarget(task.to) && task.target) {
              invRemove(game, task.target, Math.max(1, Number(task.required) || 1));
            }
          }
          const rewards = active.rewards || quest.rewards || {};
          let xpAward = null;
          if (game.player) {
            const xp = Math.max(0, Math.floor(Number(rewards.xp) || 0));
            const gold = Math.max(0, Math.floor(Number(rewards.gold) || 0));
            const raceAdjustedXp = xp > 0 ? (game.player.raceId === 'human' ? Math.max(1, Math.floor(xp * 1.02)) : xp) : 0;
            xpAward = raceAdjustedXp > 0 ? game.awardPlayerXp?.(raceAdjustedXp) : null;
            // V0.18.99: authored quest money is on the SILVER scale - credit it through the real
            // currency (copper) instead of addGold, which was multiplying it by 10,000.
            if (game.addSilver) game.addSilver(gold);
            else if (game.addGold) game.addGold(gold);
            else game.player.gold += gold;
            if (Array.isArray(rewards.items)) {
              for (const reward of rewards.items) this.grantRewardItem(reward);
            }
            if (Array.isArray(rewards.choiceItems) && rewards.choiceItems.length) {
              if (rewards.playerChoice) {
                // V0.17.86: a genuine player-facing reward-choice picker.
                this.promptRewardChoice(quest.name, rewards.choiceItems);
              } else {
                const choiceReward = this.chooseQuestRewardChoice?.(rewards);
                if (choiceReward) {
                  this.grantRewardItem(choiceReward);
                  const choiceName = game.getEditorItemDraft?.(choiceReward.id || choiceReward.itemId)?.name || choiceReward.id || choiceReward.itemId || 'reward';
                  game.log?.(`Class reward selected: ${choiceName}.`);
                }
              }
            }
            if (typeof game.checkLevelUp === 'function') game.checkLevelUp();
            if (typeof game.updateUI === 'function') game.updateUI();
          }
          this.state.completed[questId] = Date.now();
          delete this.state.active[questId];
          this.state.selectedQuestId = Object.keys(this.state.active)[0] || null;
          this.applyQuestOnComplete(quest);
          this.saveState();
          game.log(`${sourceName}: ${quest.completedText || `${quest.name} complete.`}`);
          const awardedXp = xpAward?.amount ?? 0;
          const gold = Number(rewards.gold) || 0;
          const bondSuffix = xpAward?.partyBonusPercent > 0 ? ` (Party Bond Bonus: +${Math.round(xpAward.partyBonusPercent * 100)}%)` : '';
          game.log(`Quest complete: ${quest.name}. +${awardedXp} XP${bondSuffix}, +${gold}g.`);
          game.playAudioEvent?.('quest_complete', { actor: game.player });
          game.spawnRing?.(game.player?.x || 0, game.player?.y || 0, '#c991ff', 24);
          this.refreshPanel();
          this.renderQuestLog();
          return true;
        },

        grantRewardItem(reward) {
          if (!reward) return false;
          const id = reward.id || reward.itemId || reward.name;
          const qty = Math.max(1, Math.floor(Number(reward.qty || reward.quantity || 1) || 1));
          const compiled = game.getCompiledItem?.(id) || null;
          const def = game.editorItems?.[id] || DR.ITEM_BY_ID?.[id] || null;
          if (id && game.grantEditorItem) {
            const result = game.grantEditorItem(id, qty, { rarityKey: reward.rarityKey || compiled?.rarityKey || def?.rarity || 'white' });
            if (result.ok) return true;
          }
          if (!game.addMaterialItem) return false;
          return game.addMaterialItem({
            id,
            itemId: id,
            name: def?.name || String(id || 'Quest Reward'),
            category: 'Quest Reward',
            rarityKey: reward.rarityKey || def?.rarity || 'white',
            value: def?.sellValue || def?.value || 1,
            stack: qty,
            description: def?.description || 'A reward earned from a quest.'
          });
        },

        abandonSelectedQuest() {
          const id = this.state.selectedQuestId;
          const active = id ? this.state.active[id] : null;
          if (!active) {
            game.log('No active quest selected.');
            return false;
          }
          const quest = this.questById(id) || active;
          if (quest && quest.canAbandon === false) {
            game.log(`${quest.name || id} cannot be abandoned.`);
            return false;
          }
          delete this.state.active[id];
          this.state.selectedQuestId = Object.keys(this.state.active)[0] || null;
          this.saveState();
          game.log(`Abandoned quest: ${active.name || id}.`);
          this.refreshPanel();
          this.renderQuestLog();
          return true;
        },

        resetRuntimeState() {
          if (!window.confirm('Reset runtime quest progress? Editor quest drafts are not deleted.')) return;
          this.state = defaultState();
          this.saveState();
          game.log('Runtime quest progress reset.');
          this.refreshPanel();
          this.renderQuestLog();
        },

        handleEnemyKilled(payload) {
          const enemy = payload.enemy || {};
          const name = String(payload.name || enemy.name || '').toLowerCase();
          const baseName = String(payload.baseName || enemy.baseType?.name || '').toLowerCase();
          const killedInZone = payload.zoneId || zoneRuntimeId(game);
          const semanticTargets = Array.from(new Set([...(enemy.semanticTags || []), ...(payload.semanticTargets || [])].filter(Boolean).map(v => String(v).toLowerCase())));
          if (enemy.silkWebCavern || enemy.dungeonId === 'silk_web_cavern') {
            semanticTargets.push('silk_web_elite');
            if (enemy.dungeonFloor) semanticTargets.push(`silk_web_floor${enemy.dungeonFloor}_elite`);
          }
          if (enemy.dungeonMiniBoss) semanticTargets.push('silk_web_miniboss');
          if (enemy.bossId) semanticTargets.push(String(enemy.bossId).toLowerCase());
          this.advanceObjective('kill', {
            id: payload.id || enemy.bossId || enemy.id,
            name,
            baseName,
            zoneId: killedInZone,
            level: payload.level || enemy.level || 1,
            semanticTargets
          }, 1);
        },

        objectiveMatches(task, eventType, target) {
          if (!task) return false;
          // V0.17.84: a deliver-to-an-NPC objective accrues on item pickup, just
          // like collect (the item is later consumed on turn-in). deliver-to-a-POI
          // objectives are driven directly by tryQuestWorldInteract instead.
          if (eventType === 'collect' && task.type === 'deliver' && !isPoiTarget(task.to)) {
            const itemId = (typeof target === 'object' ? String(target.id || target.itemId || target.name || '') : String(target || '')).toLowerCase();
            return String(task.target || '').toLowerCase() === itemId;
          }
          if (task.type !== eventType) return false;
          const taskTarget = String(task.target || '').toLowerCase();
          if (eventType === 'kill') {
            const zone = String(target.zoneId || '').toLowerCase();
            const name = String(target.name || '').toLowerCase();
            const baseName = String(target.baseName || '').toLowerCase();
            const semanticTargets = Array.isArray(target.semanticTargets) ? target.semanticTargets.map(v => String(v).toLowerCase()) : [];
            if (semanticTargets.includes(taskTarget)) return true;
            if (taskTarget === 'any_dark_woods_mob') return zone === 'dark_woods';
            if (taskTarget === 'cave_enemy') return zone !== 'dark_woods' || name.includes('cave') || baseName.includes('widow');
            return taskTarget === name || taskTarget === baseName || taskTarget === String(target.id || '').toLowerCase() || name.includes(taskTarget) || baseName.includes(taskTarget);
          }
          if (eventType === 'gather') {
            const id = String(target.id || '').toLowerCase();
            const name = String(target.name || '').toLowerCase();
            const category = String(target.category || '').toLowerCase();
            const skill = String(target.skill || '').toLowerCase();
            const zone = String(target.zoneId || '').toLowerCase();
            if (taskTarget === 'any_resource') return Boolean(id || category || skill);
            if (taskTarget === 'any_herb') return category === 'herb' || skill === 'gathering';
            if (taskTarget === 'any_mining') return category === 'mining' || skill === 'mining';
            if (taskTarget === 'any_fishing') return category === 'fishing' || skill === 'fishing';
            if (taskTarget === 'dark_woods_resource') return zone === 'dark_woods';
            return taskTarget === id || taskTarget === name || taskTarget === category || taskTarget === skill || name.includes(taskTarget);
          }
          const value = typeof target === 'object'
            ? String(target.id || target.zoneId || target.name || '').toLowerCase()
            : String(target || '').toLowerCase();
          return taskTarget === value;
        },

        advanceObjective(eventType, target, amount = 1) {
          let anyChanged = false;
          const autoComplete = [];
          for (const [questId, questState] of Object.entries(this.state.active)) {
            if (!questState || this.isQuestComplete(questState)) continue;
            let questChanged = false;
            for (const task of questState.tasks || []) {
              if (!this.objectiveMatches(task, eventType, target)) continue;
              // V0.17.87: a nightOnly objective only advances after dark.
              if (task.nightOnly && !this.isNight()) { this.nightHint(`${task.label || 'This'} - only under moonlight.`); continue; }
              const required = Math.max(1, Number(task.required) || 1);
              const before = clamp(Number(task.progress) || 0, 0, required);
              if (before >= required) continue;
              task.progress = clamp(before + amount, 0, required);
              questChanged = true;
              anyChanged = true;
              game.log(`${questState.name}: ${taskText(task)}.`);
              game.notifyExternalSystems?.('quest-objective-progress', {
                questId, taskId: task.id || task.label || null, progress: task.progress, required, eventType
              });
            }
            if (questChanged) {
              questState.updatedAt = Date.now();
              if (this.isQuestComplete(questState)) {
                // V0.17.84: giver-less / hidden quests (autoComplete) have no
                // turn-in NPC, so they resolve the moment their objectives are met.
                if (questState.autoComplete) autoComplete.push(questId);
                else {
                  questState.status = 'ready';
                  game.log(`${questState.name} objective complete. Return to ${questState.turnIn || questState.giver || 'the quest giver'}.`);
                }
              }
            }
          }
          if (anyChanged) {
            this.saveState();
            this.refreshPanel();
            this.renderQuestLog();
          }
          for (const questId of autoComplete) this.completeQuest(questId, this.state.active[questId]?.name || 'Quest');
          return anyChanged;
        },

        update(dt) {
          if (!this.panel) this.panel = ensurePanel();
          this.promptSource = this.findNearbyQuestSource();
          this.exploreTick -= dt;
          if (this.exploreTick <= 0) {
            this.exploreTick = 0.35;
            this.checkDiscoveryObjectives();
            this.checkAutoOfferQuests();
            this.ensureQuestLanternDarkStates();
            this.checkBranchTriggers();
          }
          this.updateDefendEncounters(dt);
          this.updateEscortEncounters(dt);
          this.updateTimedQuests(dt);
          this.refreshPanel();
        },

        // ===== V0.17.88 escort verb =====
        // An escort task spawns a slow, low-HP follower NPC (a passive Pet, command
        // 'follow') at `from`; the player leads it to `to`. If it dies the quest
        // FAILS PERMANENTLY (onFail effects run, e.g. survivor_dead=1, so it never
        // re-offers); if it reaches `to` the quest completes.
        updateEscortEncounters() {
          if (!game.started || !game.player) return;
          let found = null;
          for (const [qid, qs] of Object.entries(this.state.active || {})) {
            if (!qs || this.isQuestComplete(qs)) continue;
            const idx = (qs.tasks || []).findIndex(t => t.type === 'escort' && (Number(t.progress) || 0) < Math.max(1, Number(t.required) || 1));
            if (idx >= 0) { found = { qid, qs, idx, task: qs.tasks[idx] }; break; }
          }
          const esc = this.escort;
          if (!found || game.currentZone !== 'overworld') { if (esc) this.endEscort(); return; }
          if (esc && (esc.questId !== found.qid || esc.taskIndex !== found.idx)) this.endEscort();

          const px = game.player.x, py = game.player.y;
          if (!this.escort) {
            const nearFrom = Math.hypot((Number(found.task.fromX) + 0.5) - px, (Number(found.task.fromY) + 0.5) - py) <= (Number(found.task.startRadius) || 7);
            if (nearFrom) this.startEscort(found.qid, found.idx, found.task);
            return;
          }

          const e = this.escort;
          const actor = e.actor;
          if (!actor || actor.alive === false || actor.hp <= 0) {
            // permanent failure
            const quest = this.state.active[e.questId];
            // V0.19.2 (Roadmap Item 1, state 5): prefer the quest's authored failure dialogue, which
            // can reflect the actual reason and the permanent consequence. Falls back to the previous
            // generic line (which hardcoded a gendered pronoun) when a quest has none.
            game.log(quest?.failureText || `${e.task.name || 'The survivor'} is dead. She does not come back.`);
            if (quest) this.applyQuestOnFail(quest);
            delete this.state.active[e.questId];
            this.state.selectedQuestId = Object.keys(this.state.active)[0] || null;
            this.endEscort();
            this.saveState(); this.refreshPanel(); this.renderQuestLog();
            return;
          }
          // arrived?
          if (Math.hypot((Number(e.task.toX) + 0.5) - actor.x, (Number(e.task.toY) + 0.5) - actor.y) <= (Number(e.task.arriveRadius) || 6)) {
            e.task.progress = Math.max(1, Number(e.task.required) || 1);
            const quest = this.state.active[e.questId];
            this.endEscort();
            if (quest) {
              quest.updatedAt = Date.now();
              if (this.isQuestComplete(quest)) { quest.status = 'ready'; game.log(`${quest.name} - she's safe. Return to ${quest.turnIn || quest.giver || 'the quest giver'}.`); }
            }
            this.saveState(); this.refreshPanel(); this.renderQuestLog();
          }
        },

        startEscort(questId, taskIndex, task) {
          const PetClass = DR.entities?.Pet || window.Pet;
          if (!PetClass || !game.player) return;
          const hp = Number(task.hp) || 40;
          const actor = new PetClass(Number(task.fromX) + 0.5, Number(task.fromY) + 1.0, game.player, {
            name: task.name || 'Survivor', petName: task.name || 'Survivor', petType: task.petType || 'shard',
            color: task.color || '#d8c8f2', petColor: task.color || '#d8c8f2',
            hp, maxHp: hp, attack: 0, attackDamageMin: 0, attackDamageMax: 0,
            attackIntervalSeconds: 3, temporaryPet: true, temporaryLife: 100000,
            speed: Number(task.speed) || 0.85,
            level: game.player.level || 1, zone: game.currentZone || 'dark_woods', command: 'follow', commandState: 'following'
          });
          actor.escortNpc = true;
          game.entities = Array.isArray(game.entities) ? game.entities : [];
          game.entities.push(actor);
          this.escort = { questId, taskIndex, task, actor };
          game.log(`${task.name || 'The survivor'} rises and follows you. Get her home alive.`);
        },

        endEscort() {
          const e = this.escort;
          if (e && e.actor) game.despawnQuestEntity?.(e.actor);
          this.escort = null;
        },

        applyQuestOnFail(quest) {
          const effects = Array.isArray(quest?.onFail) ? quest.onFail : [];
          for (const fx of effects) {
            if (fx && fx.type === 'setVariable' && game.eventSystem) {
              const cur = Number(game.eventSystem.getEventVariable(fx.name, 0)) || 0;
              const op = fx.op || 'set';
              const next = op === 'add' ? cur + (Number(fx.value) || 0) : op === 'sub' ? cur - (Number(fx.value) || 0) : fx.value;
              game.eventSystem.setEventVariable(fx.name, next);
            }
          }
        },

        // V0.20.42 (Roadmap Item 1, state 5 - failure dialogue for DEFENSE events):
        // a defend hold that breaks used to speak only a fixed system-narrator line, the same
        // for every quest, so the escort path was the only one honouring an authored failureText.
        // This routes every defend failure through the quest's own line first (unattributed, in the
        // same narrator voice as the escort failure), then the mechanical reason so the reset stays
        // clear. A defend failure is retryable, so - unlike the permanent escort loss - the reason
        // line is always shown. Quests with no failureText keep exactly their old behaviour.
        logDefendFailure(questId, reason) {
          const quest = this.state.active[questId] || this.questById(questId);
          const mech = reason === 'timeout'
            ? 'The hold breaks - you could not clear the waves in time. Try again.'
            : reason === 'left'
              ? 'You left the gate undefended - the encounter resets.'
              : 'The gate is overrun - the encounter resets. Return to hold it again.';
          if (quest && typeof quest.failureText === 'string' && quest.failureText) game.log(quest.failureText);
          game.log(mech);
        },

        // ===== V0.17.85 defend verb =====
        // A defend task holds a fixed point (x,y,radius) through sequential
        // `waves` of mobs; progress = waves cleared. The encounter starts when
        // the player reaches the point and resets if they die or wander off.
        // An optional `ally` (e.g. Road Warden Cael) fights alongside.
        updateDefendEncounters() {
          if (!game.started || !game.player) return;
          let found = null;
          for (const [qid, qs] of Object.entries(this.state.active || {})) {
            if (!qs || this.isQuestComplete(qs)) continue;
            const idx = (qs.tasks || []).findIndex(t => t.type === 'defend' && (Number(t.progress) || 0) < Math.max(1, Number(t.required) || 1));
            if (idx >= 0) { found = { qid, qs, idx, task: qs.tasks[idx] }; break; }
          }
          const enc = this.defend;
          if (!found) { if (enc) this.endDefendEncounter(false); return; }
          if (game.currentZone !== 'overworld') { if (enc) this.endDefendEncounter(false); return; }
          // V0.17.87: a nightOnly defend only runs after dark.
          if (found.task.nightOnly && !this.isNight()) { if (enc) this.endDefendEncounter(false); this.nightHint('The ring only opens the way at night.'); return; }
          if (enc && (enc.questId !== found.qid || enc.taskIndex !== found.idx)) this.endDefendEncounter(false);

          const px = game.player.x, py = game.player.y;
          const near = Math.hypot((Number(found.task.x) + 0.5) - px, (Number(found.task.y) + 0.5) - py) <= (Number(found.task.radius) || 11);
          if (!this.defend) { if (near) this.startDefendEncounter(found.qid, found.idx, found.task); return; }

          const e = this.defend;
          if (!game.player.alive) { this.logDefendFailure(e.questId, 'overrun'); this.endDefendEncounter(false); return; }
          if (Math.hypot((Number(e.task.x) + 0.5) - px, (Number(e.task.y) + 0.5) - py) > (Number(e.task.radius) || 11) + 8) {
            this.logDefendFailure(e.questId, 'left'); this.endDefendEncounter(false); return;
          }
          // V0.17.87 race: a holdSeconds defend must be cleared within the limit.
          if (Number(e.task.holdSeconds) > 0 && (Date.now() - (e.startAt || Date.now())) > Number(e.task.holdSeconds) * 1000) {
            this.logDefendFailure(e.questId, 'timeout'); this.endDefendEncounter(false); return;
          }
          e.mobs = e.mobs.filter(m => {
            const alive = m && m.alive !== false && (game.enemies?.includes(m) || game.overworldEnemies?.includes(m));
            if (!alive && m) game.despawnQuestEntity?.(m); // clear the corpse of a cleared wave mob
            return alive;
          });
          if (e.mobs.length > 0) return;
          // current wave cleared
          e.waveIndex += 1;
          const total = e.task.waves.length;
          if (e.waveIndex >= total) {
            e.task.progress = Math.max(1, Number(e.task.required) || total);
            e.task.updatedAt = Date.now();
            const qs = this.state.active[e.questId];
            this.endDefendEncounter(true);
            if (qs) {
              qs.updatedAt = Date.now();
              if (this.isQuestComplete(qs)) { qs.status = 'ready'; game.log(`${qs.name} objective complete. Return to ${qs.turnIn || qs.giver || 'the quest giver'}.`); }
            }
            game.log('The line holds. The gate is clear.');
            this.saveState(); this.refreshPanel(); this.renderQuestLog();
          } else {
            e.task.progress = e.waveIndex;
            this.spawnDefendWave(e, e.waveIndex);
            game.log(`Wave ${e.waveIndex + 1} of ${total}!`);
            this.saveState(); this.refreshPanel(); this.renderQuestLog();
          }
        },

        startDefendEncounter(questId, taskIndex, task) {
          this.defend = { questId, taskIndex, task, waveIndex: 0, mobs: [], ally: null, startAt: Date.now() };
          task.progress = 0;
          game.log(`${this.state.active[questId]?.name || 'Defend'}: Hold the line!`);
          if (task.ally) this.defend.ally = this.spawnQuestAlly(task.ally, task.x, task.y);
          this.spawnDefendWave(this.defend, 0);
          const total = task.waves.length;
          game.log(`Wave 1 of ${total}!`);
        },

        spawnDefendWave(enc, waveIndex) {
          const wave = enc.task.waves[waveIndex] || [];
          const ox = Number(enc.task.x) + (Number(enc.task.spawnDx) || 0);
          const oy = Number(enc.task.y) + (Number(enc.task.spawnDy) || 8);
          const lvl = Number(enc.task.mobLevel) || Math.max(2, game.player?.level || 2);
          for (const group of wave) {
            const count = Math.max(1, Number(group.count) || 1);
            for (let i = 0; i < count; i++) {
              const jx = ox + (Math.random() * 6 - 3);
              const jy = oy + (Math.random() * 4 - 2);
              const m = game.spawnQuestWaveEnemy?.(group.mob, jx, jy, group.level || lvl, { leashRadius: 60, roamRadius: 22 });
              if (m) enc.mobs.push(m);
            }
          }
        },

        endDefendEncounter(completed) {
          const e = this.defend;
          if (!e) return;
          for (const m of e.mobs) game.despawnQuestEntity?.(m);
          if (e.ally) game.despawnQuestEntity?.(e.ally);
          if (!completed && e.task) e.task.progress = 0;
          this.defend = null;
        },

        spawnQuestAlly(cfg, x, y) {
          const PetClass = DR.entities?.Pet || window.Pet;
          if (!PetClass || !game.player) return null;
          const hp = Number(cfg.hp) || 120;
          const ally = new PetClass(Number(x) + 0.5, Number(y) + 1.5, game.player, {
            name: cfg.name || 'Ally', petName: cfg.name || 'Ally', petType: cfg.petType || 'shard',
            color: cfg.color || '#9fb6c7', petColor: cfg.color || '#9fb6c7',
            hp, maxHp: hp, attack: Number(cfg.attack) || 12,
            attackDamageMin: Number(cfg.attackMin) || 8, attackDamageMax: Number(cfg.attackMax) || 14,
            attackIntervalSeconds: 1.5, temporaryPet: true, temporaryLife: 900,
            level: game.player.level || 1, zone: game.currentZone || 'dark_woods', command: 'assist', commandState: 'assist'
          });
          game.entities = Array.isArray(game.entities) ? game.entities : [];
          game.entities.push(ally);
          return ally;
        },

        // ===== V0.17.85 timed modifier =====
        // A quest (or a task) carrying deadlineSeconds gets a wall-clock deadline
        // set at accept; if it runs out before completion the quest fails.
        updateTimedQuests() {
          const now = Date.now();
          for (const [qid, qs] of Object.entries(this.state.active || {})) {
            if (!qs || !qs.deadlineAt) continue;
            if (this.isQuestComplete(qs)) { delete qs.deadlineAt; continue; }
            if (now > qs.deadlineAt) {
              game.log(`Time ran out: ${qs.name} failed.`);
              if (this.defend && this.defend.questId === qid) this.endDefendEncounter(false);
              delete this.state.active[qid];
              this.state.selectedQuestId = Object.keys(this.state.active)[0] || null;
              this.saveState(); this.refreshPanel(); this.renderQuestLog();
            }
          }
        },

        questDeadlineSeconds(quest) {
          if (Number(quest?.deadlineSeconds) > 0) return Number(quest.deadlineSeconds);
          for (const t of quest?.tasks || []) if (Number(t.deadlineSeconds) > 0) return Number(t.deadlineSeconds);
          return 0;
        },

        // ===== V0.17.87 night-gating =====
        isNight() {
          return (Number(game.getWorldLightState?.()?.nightStrength) || 0) > 0.6;
        },
        nightHint(msg) {
          const now = Date.now();
          if (now - (this._lastNightHint || 0) < 4000) return;
          this._lastNightHint = now;
          game.log(msg || 'This can only be done under moonlight.');
        },

        // ===== V0.17.86 branch / onComplete / choose =====
        // Apply a quest's onComplete effects. Branch flags are stored as global
        // event variables (rurik_dead, rurik_allied, bandit_hostility), read back
        // by requiredConditions {type:'variable', ...} on gated quests.
        applyQuestOnComplete(quest) {
          const effects = Array.isArray(quest?.onComplete) ? quest.onComplete : [];
          for (const fx of effects) {
            if (!fx || typeof fx !== 'object') continue;
            if (fx.type === 'setVariable' && game.eventSystem) {
              const cur = Number(game.eventSystem.getEventVariable(fx.name, 0)) || 0;
              const amt = Number(fx.value) || 0;
              const op = fx.op || 'set';
              const next = op === 'add' ? cur + amt : op === 'sub' ? cur - amt : fx.value;
              game.eventSystem.setEventVariable(fx.name, next);
            } else if (fx.type === 'worldEffect' && fx.effect === 'sealDarkWoods') {
              this.sealDarkWoods();
            }
          }
        },

        // ===== V0.17.89 capstone world change =====
        // The zone finale changes the world permanently. The signature, visible
        // payoff is the Dead Lantern Trail: every lantern in the overworld is
        // relit for good - the level-1 quest [01] finally ends at level 10.
        sealDarkWoods() {
          const lit = this.relightAllLanterns();
          game.eventSystem?.setEventVariable?.('dark_woods_sealed', 1);
          game.log('Thalen drives the seal home. The rot is contained - not cured, but held.');
          game.log(`The Dead Lantern Trail flares to life along its whole length (${lit} lanterns) and stays lit. Your first task, finished at last.`);
          game.log('In the hollow under the roots you find the thing that made the rot - and it did not come from Dark Woods. It came from somewhere else, and there is a road.');
        },

        relightAllLanterns() {
          const objs = game.overworldObjects || (game.currentZone === 'overworld' ? game.objects : null);
          if (!Array.isArray(objs)) return 0;
          let n = 0;
          for (const row of objs) {
            if (!Array.isArray(row)) continue;
            for (const o of row) {
              if (o && o.type === 'lanternPost' && o.variant !== 'intact') { o.variant = 'intact'; o.lit = true; o.questDark = false; n++; }
              else if (o && o.type === 'lanternPost') { o.lit = true; n++; }
            }
          }
          return n;
        },

        // Spawn mobs when a quest is accepted (e.g. [14a] Warden Patrol targets).
        spawnQuestOnAccept(quest) {
          const groups = Array.isArray(quest?.spawnOnAccept) ? quest.spawnOnAccept : [];
          for (const g of groups) {
            const count = Math.max(1, Number(g.count) || 1);
            const lvl = Number(g.level) || Math.max(2, game.player?.level || 2);
            for (let i = 0; i < count; i++) {
              const jx = Number(g.x) + (Math.random() * 6 - 3);
              const jy = Number(g.y) + (Math.random() * 6 - 3);
              game.spawnQuestWaveEnemy?.(g.mob, jx, jy, lvl, { leashRadius: 80, roamRadius: 30 });
            }
          }
        },

        // ===== V0.17.86 branch triggers (Rurik's Offer) =====
        checkBranchTriggers() {
          if (!game.started || !game.player) return;
          this.branchPrompted = this.branchPrompted || {};
          for (const branch of DR.QUEST_BRANCHES || []) {
            if (this.branchPrompted[branch.id] || this.branchModalOpen) continue;
            if (!this.state.discoveredPois[branch.poi]) continue;
            // already resolved? (any option / fallback active or completed)
            const ids = [...(branch.options || []).map(o => o.questId), branch.fallbackQuestId].filter(Boolean);
            if (ids.some(id => this.state.active[id] || this.state.completed[id])) { this.branchPrompted[branch.id] = true; continue; }
            const ok = !Array.isArray(branch.requiredConditions) || !branch.requiredConditions.length
              || (game.eventSystem?.evaluateEventConditions?.(branch.requiredConditions) === true);
            // Only fire once a resolution will actually succeed (e.g. level met),
            // so an under-level player at the ruin doesn't get a dead prompt.
            const acceptable = ok
              ? (branch.options || []).some(o => o.questId && this.isQuestAvailable(o.questId))
              : (branch.fallbackQuestId && this.isQuestAvailable(branch.fallbackQuestId));
            if (!acceptable) continue;
            this.branchPrompted[branch.id] = true;
            if (ok) {
              this.showQuestChoiceModal(branch.title, branch.prompt, (branch.options || []).map(o => ({ label: o.label, sub: o.sub })), idx => {
                const chosen = branch.options[idx];
                if (chosen?.questId) this.acceptQuest(chosen.questId, branch.title);
              });
            } else {
              if (branch.fallbackLog) game.log(branch.fallbackLog);
              if (branch.fallbackQuestId) this.acceptQuest(branch.fallbackQuestId, branch.title);
            }
          }
        },

        // ===== V0.17.86 reward-choice picker =====
        promptRewardChoice(questName, choiceItems) {
          const options = choiceItems.map(c => {
            const id = c.id || c.itemId;
            const item = game.getCompiledItem?.(id) || DR.ITEM_BY_ID?.[id] || { name: id };
            const qty = Math.max(1, Number(c.qty || c.quantity || 1) || 1);
            return { label: `${item.name || id}${qty > 1 ? ` x${qty}` : ''}`, sub: item.description || '' };
          });
          this.showQuestChoiceModal(`${questName} - Choose your reward`, 'Pick one:', options, idx => {
            const chosen = choiceItems[idx];
            if (chosen) {
              this.grantRewardItem(chosen);
              const id = chosen.id || chosen.itemId;
              const nm = game.getCompiledItem?.(id)?.name || DR.ITEM_BY_ID?.[id]?.name || id;
              game.log(`Reward chosen: ${nm}.`);
              if (typeof game.updateUI === 'function') game.updateUI();
            }
          });
        },

        // Generic modal: a titled prompt with a vertical list of option buttons.
        // The player must pick (no dismiss) so branch/reward choices always resolve.
        showQuestChoiceModal(title, prompt, options, onPick) {
          const existing = document.getElementById('questChoiceModal');
          if (existing) existing.remove();
          const overlay = document.createElement('div');
          overlay.id = 'questChoiceModal';
          overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(6,4,10,0.72);';
          const panel = document.createElement('div');
          panel.className = 'panel gameWindow';
          panel.style.cssText = 'max-width:min(460px,calc(100vw - 32px));padding:18px 20px;border:1px solid rgba(210,156,255,0.5);border-radius:12px;background:#160f1e;box-shadow:0 12px 40px rgba(0,0,0,0.6);';
          const optHtml = (options || []).map((o, i) => `
            <button data-choice-index="${i}" style="display:block;width:100%;text-align:left;margin:8px 0;padding:10px 12px;border:1px solid rgba(170,134,85,0.4);border-radius:8px;background:#20172c;color:#f0e6d2;cursor:pointer">
              <div style="font-weight:600">${escapeHtml(o.label)}</div>
              ${o.sub ? `<div class="small" style="opacity:0.8;margin-top:3px">${escapeHtml(o.sub)}</div>` : ''}
            </button>`).join('');
          panel.innerHTML = `
            <div style="font-size:16px;font-weight:700;color:#e8d5ff;margin-bottom:4px">${escapeHtml(title || 'Choose')}</div>
            <div class="small" style="opacity:0.85;margin-bottom:8px">${escapeHtml(prompt || '')}</div>
            ${optHtml}
          `;
          overlay.appendChild(panel);
          document.body.appendChild(overlay);
          this.branchModalOpen = true;
          panel.addEventListener('click', ev => {
            const btn = ev.target.closest('button[data-choice-index]');
            if (!btn) return;
            const idx = Number(btn.dataset.choiceIndex);
            overlay.remove();
            this.branchModalOpen = false;
            try { onPick?.(idx); } catch (e) { game.log?.(`Choice error: ${e}`); }
          });
        },

        // V0.17.84: the `discover` objective verb. Walks DR.DISCOVERY_POINTS for
        // the current zone and fires on first entry into a point's radius. POIs
        // are recorded in state.discoveredPois so re-entry doesn't re-trigger and
        // so syncWorldObjectivesOnAccept can seed a discover accepted afterward.
        checkDiscoveryObjectives() {
          if (!game.player) return;
          const zone = zoneRuntimeId(game);
          for (const poi of DR.DISCOVERY_POINTS || []) {
            if (poi.zone && poi.zone !== zone) continue;
            if (this.state.discoveredPois[poi.id]) continue;
            const d = Math.hypot((Number(poi.x) + 0.5) - game.player.x, (Number(poi.y) + 0.5) - game.player.y);
            if (d > (Number(poi.radius) || 5)) continue;
            this.state.discoveredPois[poi.id] = Date.now();
            this.saveState();
            game.log(`Discovered: ${poi.name || poi.id}.`);
            game.spawnRing?.(Number(poi.x) || 0, Number(poi.y) || 0, '#d29cff', 26);
            game.notifyExternalSystems?.('poi-discovered', poi);
            this.advanceObjective('discover', poi.id, 1);
          }
        },

        // V0.17.84 [07]/hidden quests: auto-offer a giver-less quest the moment
        // its prerequisites + requiredConditions are satisfied.
        checkAutoOfferQuests() {
          if (!game.started || !game.player) return;
          for (const id of this.allQuestIds()) {
            const quest = this.questById(id);
            if (!quest || !quest.autoOffer) continue;
            if (this.state.active[id]) continue;
            // A HIDDEN quest "found in the world" only offers once the player has
            // discovered its foundAtPoi landmark (not at spawn).
            if (quest.foundAtPoi && !this.state.discoveredPois?.[quest.foundAtPoi]) continue;
            if (this.isQuestAvailable(id)) this.acceptQuest(id, quest.name || 'Quest');
          }
        },

        findNearbyQuestSource() {
          if (!game.player) return null;
          const key = zoneKey(game);
          const events = findNearGridNodes(game, game.editorEvents?.[key], 2.65, node => node.category === 'quest' || node.questId);
          if (events.length) {
            const node = events[0].node;
            const questId = node.questId || node.commands?.find(cmd => cmd.questId)?.questId;
            return { type: 'event', name: node.questName || node.name || 'Quest Hook', questIds: [questId].filter(Boolean), node };
          }

          const npcs = findNearGridNodes(game, game.editorNpcs?.[key], 2.85, node => Array.isArray(node.questIds) && node.questIds.length);
          if (npcs.length) {
            const node = npcs[0].node;
            return { type: 'npc', name: node.name || 'Quest NPC', questIds: node.questIds || [], node };
          }
          // V0.17.84: the legacy hardcoded proximity "default" quest board /
          // Town Guide / Field Cleric Liora fallbacks were removed with the old
          // quests. Every new giver is a placed NPC carrying questIds (handled
          // by the editorNpcs branch above).
          return null;
        },

        chooseQuestFromSource(source) {
          const ids = (source?.questIds || []).filter(Boolean);
          for (const id of ids) {
            const active = this.state.active[id];
            if (active && this.isQuestComplete(active)) return { id, mode: 'complete' };
          }
          for (const id of ids) {
            if (this.isQuestAvailable(id)) return { id, mode: 'accept' };
          }
          for (const id of ids) {
            const quest = this.questById(id);
            if (quest && !this.state.completed[id] && !this.state.active[id]) return { id, mode: 'locked' };
          }
          for (const id of ids) {
            if (this.state.active[id]) return { id, mode: 'progress' };
          }
          return ids.length ? { id: ids[0], mode: 'done' } : null;
        },

        interact() {
          const source = this.findNearbyQuestSource();
          if (!source) {
            // V0.17.84: no NPC/event source - try quest world objects (relightable
            // lanterns, coin recoveries, shrine deliveries) before giving up.
            if (this.tryQuestWorldInteract()) return true;
            game.log('No quest source nearby. Look for quest markers, NPCs, town, camp, or cave scouts.');
            return false;
          }
          const pick = this.chooseQuestFromSource(source);
          if (!pick) {
            game.log(`${source.name}: No quest assigned.`);
            return false;
          }
          const quest = this.questById(pick.id);
          if (!quest) {
            game.log(`${source.name}: Quest data missing (${pick.id}).`);
            return false;
          }
          if (pick.mode === 'complete') return this.completeQuest(pick.id, source.name);
          if (pick.mode === 'accept') return this.acceptQuest(pick.id, source.name);
          if (pick.mode === 'progress') {
            const active = this.state.active[pick.id];
            game.log(`${source.name}: ${active.inProgressText || quest.inProgressText || 'Keep working on the objective.'}`);
            return true;
          }
          if (pick.mode === 'locked') {
            game.log(`${source.name}: ${this.unavailableQuestReason?.(pick.id) || 'That quest is locked.'}`);
            return true;
          }
          // V0.19.2 (Roadmap Item 1, state 8): once a quest is done, an NPC should acknowledge the
          // CHANGED world rather than replay their turn-in line forever. postCompletionText is that
          // line; completedText remains the fallback so every quest still says something in character.
          game.log(`${source.name}: ${quest.postCompletionText || quest.completedText || 'You have already helped me.'}`);
          return true;
        },

        // V0.17.84: the overworld `interact` + POI-`deliver` handler, run on E
        // when no NPC/event quest source is nearby. Returns true if it acted.
        hasActiveInteractTask(objId) {
          for (const qs of Object.values(this.state.active || {})) {
            if (!qs || this.isQuestComplete(qs)) continue;
            for (const task of qs.tasks || []) {
              if (task.type !== 'interact') continue;
              if (String(task.target) !== String(objId)) continue;
              if ((Number(task.progress) || 0) < Math.max(1, Number(task.required) || 1)) return true;
            }
          }
          return false;
        },

        tryQuestWorldInteract() {
          if (!game.player) return false;
          const zone = zoneRuntimeId(game);
          const px = game.player.x;
          const py = game.player.y;

          // 1) Nearest un-consumed interact point demanded by an active quest.
          let best = null;
          let bestD = Infinity;
          for (const pt of DR.INTERACT_POINTS || []) {
            if (pt.zone && pt.zone !== zone) continue;
            if (this.state.consumedInteractPoints[pt.id]) continue;
            if (!this.hasActiveInteractTask(pt.objId)) continue;
            const d = Math.hypot((Number(pt.x) + 0.5) - px, (Number(pt.y) + 0.5) - py);
            if (d <= (Number(pt.radius) || 2.6) && d < bestD) { best = pt; bestD = d; }
          }
          if (best) return this.activateInteractPoint(best);

          // 2) POI deliveries: standing at a POI that an active deliver task targets.
          for (const qs of Object.values(this.state.active || {})) {
            if (!qs || this.isQuestComplete(qs)) continue;
            for (const task of qs.tasks || []) {
              if (task.type !== 'deliver' || !isPoiTarget(task.to)) continue;
              const required = Math.max(1, Number(task.required) || 1);
              if ((Number(task.progress) || 0) >= required) continue;
              const poi = DR.DISCOVERY_POINT_BY_ID?.[task.to];
              if (!poi || (poi.zone && poi.zone !== zone)) continue;
              if (Math.hypot((Number(poi.x) + 0.5) - px, (Number(poi.y) + 0.5) - py) > (Number(poi.radius) || 5)) continue;
              if (invCount(game, task.target) < 1) {
                game.log(`You have nothing to leave at ${poi.name || 'the shrine'}. You need ${itemName(task.target)}.`);
                return true;
              }
              invRemove(game, task.target, 1);
              task.progress = clamp((Number(task.progress) || 0) + 1, 0, required);
              qs.updatedAt = Date.now();
              game.log(`${qs.name}: ${taskText(task)}.`);
              game.spawnRing?.(Number(poi.x) || 0, Number(poi.y) || 0, '#c9b8e8', 20);
              if (this.isQuestComplete(qs)) {
                qs.status = 'ready';
                game.log(`${qs.name} objective complete. Return to ${qs.turnIn || qs.giver || 'the quest giver'}.`);
              }
              this.saveState();
              this.refreshPanel();
              this.renderQuestLog();
              return true;
            }
          }
          return false;
        },

        activateInteractPoint(pt) {
          // V0.17.87 [17]: sequence-puzzle stones are re-usable (not consumed);
          // they must be woken in order or a wisp pack answers.
          if (pt.sequenceId) return this.activateSequenceStone(pt);
          this.state.consumedInteractPoints[pt.id] = Date.now();
          if (pt.grantItem) this.grantRewardItem({ id: pt.grantItem, qty: 1 });
          if (pt.relightLantern) this.relightLanternNear(pt.x, pt.y);
          game.spawnRing?.(Number(pt.x) || 0, Number(pt.y) || 0, pt.relightLantern ? '#ffd36a' : '#d29cff', 16);
          game.log(pt.prompt ? `${pt.prompt}.` : `${pt.name || 'You interact with the object'}.`);
          this.advanceObjective('interact', pt.objId, 1);
          this.saveState();
          return true;
        },

        activateSequenceStone(pt) {
          this.puzzle = this.puzzle || {};
          const st = this.puzzle[pt.sequenceId] || (this.puzzle[pt.sequenceId] = { next: 0 });
          const total = Number(pt.sequenceTotal) || 8;
          if (Number(pt.seq) === st.next) {
            st.next += 1;
            game.spawnRing?.(Number(pt.x) || 0, Number(pt.y) || 0, '#c9b8e8', 16);
            if (st.next >= total) {
              st.next = 0;
              game.log('The stones wake as one. A cache grinds open beneath the center stone.');
              this.advanceObjective('interact', pt.objId, 1);
              this.saveState();
            } else {
              game.log(`A stone wakes. (${st.next}/${total})`);
            }
          } else {
            st.next = 0;
            game.log('Wrong order - the stones flare and the wisps answer!');
            const lvl = Math.max(6, game.player?.level || 6);
            for (let i = 0; i < 3; i++) game.spawnQuestWaveEnemy?.('mob_duskwisp', Number(pt.x) + (Math.random() * 6 - 3), Number(pt.y) + (Math.random() * 6 - 3), lvl, { leashRadius: 40 });
          }
          return true;
        },

        // Return the nearest lanternPost prop within 3 tiles of (x,y), or null.
        nearestLanternObj(x, y) {
          const objs = game.overworldObjects || (game.currentZone === 'overworld' ? game.objects : null);
          if (!Array.isArray(objs)) return null;
          const cx = Math.round(Number(x));
          const cy = Math.round(Number(y));
          for (let r = 0; r <= 3; r++) {
            for (let dy = -r; dy <= r; dy++) {
              for (let dx = -r; dx <= r; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                const o = objs[cy + dy]?.[cx + dx];
                if (o && o.type === 'lanternPost') return o;
              }
            }
          }
          return null;
        },

        // Relight the nearest dark lanternPost prop for a visible change (the
        // renderer draws a flame for intact/lit lanterns, dark for broken ones).
        relightLanternNear(x, y) {
          const o = this.nearestLanternObj(x, y);
          if (o) { o.variant = 'intact'; o.lit = true; o.questDark = false; }
        },

        // V0.17.84 [01]: while Light the Way is active, the 5 target lanterns are
        // shown DARK (broken) so relighting each one is a visible dark->light
        // change - "the player's first act of changing the world." Once a point
        // is consumed (relit) or the quest ends, the lantern is left lit.
        ensureQuestLanternDarkStates() {
          const zone = zoneRuntimeId(game);
          for (const pt of DR.INTERACT_POINTS || []) {
            if (!pt.relightLantern) continue;
            if (pt.zone && pt.zone !== zone) continue;
            if (this.state.consumedInteractPoints[pt.id]) continue;
            if (!this.hasActiveInteractTask(pt.objId)) continue;
            const o = this.nearestLanternObj(pt.x, pt.y);
            if (o && o.variant !== 'broken') { o.variant = 'broken'; o.lit = false; o.questDark = true; }
          }
        },

        toggleLog(force) {
          this.logPanel = ensureQuestLogWindow(this);
          this.logOpen = typeof force === 'boolean' ? force : !this.logOpen;
          if (this.logPanel) this.logPanel.style.display = this.logOpen ? 'block' : 'none';
          if (this.logOpen) this.renderQuestLog();
        },

        progressSummary() {
          const active = Object.values(this.state.active || {});
          if (!active.length) return { text: 'No active quests. Press E near a quest source.', pct: 0 };
          const ready = active.filter(q => this.isQuestComplete(q));
          if (ready.length) return { text: `${ready[0].name} ready to turn in.`, pct: 100 };
          const selected = this.state.active[this.state.selectedQuestId] || active[0];
          let done = 0;
          let total = 0;
          for (const task of selected.tasks || []) {
            const required = Math.max(1, Number(task.required) || 1);
            done += clamp(Number(task.progress) || 0, 0, required);
            total += required;
          }
          const pct = total > 0 ? Math.floor((done / total) * 100) : 0;
          const nextTask = (selected.tasks || []).find(task => (Number(task.progress) || 0) < Math.max(1, Number(task.required) || 1));
          return { text: `${selected.name}: ${nextTask ? taskText(nextTask) : 'complete'}`, pct };
        },

        refreshPanel() {
          if (!this.panel) return;
          const statusNode = this.panel.querySelector('[data-quest-status]');
          const progressNode = this.panel.querySelector('[data-quest-progress]');
          const metaNode = this.panel.querySelector('[data-quest-meta]');
          const summary = this.progressSummary();
          const source = this.promptSource || this.findNearbyQuestSource();
          // V0.17.85 timed modifier: show a countdown when a timed quest is active.
          const timed = Object.values(this.state.active || {}).find(q => q && q.deadlineAt && !this.isQuestComplete(q));
          const timeLeft = timed ? Math.max(0, Math.ceil((timed.deadlineAt - Date.now()) / 1000)) : null;
          if (statusNode) statusNode.textContent = timeLeft != null ? `⏱ ${timeLeft}s · ${timed.name}` : (source ? `E: ${source.name}` : summary.text);
          if (progressNode) progressNode.style.width = `${summary.pct}%`;
          if (metaNode) {
            const activeCount = Object.keys(this.state.active || {}).length;
            const completedCount = Object.keys(this.state.completed || {}).length;
            metaNode.textContent = `L: Quest Log · Active ${activeCount} · Complete ${completedCount}`;
          }
          this.renderTrackedObjectives();
        },

        // V0.20.5 (Roadmap Item 15, tracking): name the objectives of the tracked quest on the HUD.
        // Everything here is backed by data that already exists and already WORKS - it was simply never
        // shown: task.nightOnly (3/38 tasks) already gates progress after dark, quest.deadlineAt already
        // drives the countdown, and this.escort already tracks the escort actor. The spec also asks to
        // "distinguish optional and required objectives" - NO task carries an optional flag (`required`
        // is a COUNT, not a flag), so that is deliberately absent rather than faked by labelling
        // everything "Required", which would be a word that never varies.
        renderTrackedObjectives() {
          const host = this.panel?.querySelector('[data-quest-tracked]');
          if (!host) return;
          const tracked = (this.state.active || {})[this.state.selectedQuestId];
          if (!tracked) {
            const anyActive = Object.keys(this.state.active || {}).length;
            host.innerHTML = anyActive
              ? `<div class="small" style="opacity:.75; margin-top:4px">No quest tracked · press L to select one</div>`
              : '';
            return;
          }
          const night = this.isNight?.();
          const rows = (tracked.tasks || []).map(task => {
            const required = Math.max(1, Number(task.required) || 1);
            const progress = clamp(Number(task.progress) || 0, 0, required);
            const done = progress >= required;
            // A nightOnly objective genuinely cannot advance by day - say so, rather than let the player
            // stand there wondering why nothing is counting.
            const blocked = task.nightOnly && !night && !done;
            const label = escapeHtml(task.label || task.target || task.type);
            const mark = done ? '✔' : blocked ? '☾' : '·';
            const colour = done ? '#8fd39b' : blocked ? '#9ab0d8' : '#d8cbb0';
            return `<div class="small" style="margin-top:3px; color:${colour}">${mark} ${label} ${progress}/${required}${blocked ? ' — waits for dark' : ''}</div>`;
          }).join('');
          // Escort state is runtime, not data: this.escort is the live escorted actor.
          const escort = this.escort?.actor
            ? `<div class="small" style="margin-top:3px; color:#e0c078">⚑ Escort underway — keep them alive${Number.isFinite(this.escort.actor.hp) && Number.isFinite(this.escort.actor.maxHp) ? ` (${Math.max(0, Math.ceil(this.escort.actor.hp))}/${Math.ceil(this.escort.actor.maxHp)} HP)` : ''}</div>`
            : '';
          host.innerHTML = `
            <div class="small" style="margin-top:6px; color:#f0d9a0">Tracking: ${escapeHtml(tracked.name || tracked.id)}</div>
            ${rows}${escort}
          `;
        },

        renderQuestLog() {
          if (!this.logPanel || this.logPanel.style.display === 'none') return;
          const summaryNode = this.logPanel.querySelector('[data-quest-log-summary]');
          const body = this.logPanel.querySelector('[data-quest-log-body]');
          const activeAll = Object.values(this.state.active || {});
          const completedIds = Object.keys(this.state.completed || {});
          if (summaryNode) summaryNode.textContent = `Active ${activeAll.length} · Completed ${completedIds.length}`;
          if (!body) return;

          // V0.20.4 (Roadmap Item 15): completed quests were only ever a COUNT in the summary line -
          // "Completed 7" and nothing else. The spec asks for completed history, and the data was there
          // the whole time. Descriptors are the source of truth for a finished quest: state.completed
          // stores only a key, so read the authored quest back out of the catalog.
          const descriptorFor = id => DR.QUEST_BY_ID?.[id] || null;
          const completedList = completedIds.map(id => {
            const d = descriptorFor(id);
            return { ...(d || { id, name: id }), id, __completed: true };
          }).filter(q => !q.hidden);

          const filter = this.logFilter || 'active';
          const search = String(this.logSearch || '').trim().toLowerCase();
          const sortBy = this.logSort || 'level';

          let list = filter === 'completed' ? completedList
            : filter === 'repeatable' ? [...activeAll, ...completedList].filter(q => (descriptorFor(q.id) || q).repeatable)
            : filter === 'all' ? [...activeAll, ...completedList]
            : activeAll;

          // Search across the fields a player would actually search by, all authored: the quest's name,
          // who gave it, and where it happens (folder carries "Region / Subregion").
          if (search) {
            list = list.filter(q => {
              const d = descriptorFor(q.id) || q;
              return `${q.name || q.id} ${d.giver || ''} ${d.folder || ''}`.toLowerCase().includes(search);
            });
          }
          const lvlOf = q => Number((descriptorFor(q.id) || q).minLevel) || 0;
          const placeOf = q => String((descriptorFor(q.id) || q).folder || '');
          list = list.slice().sort((a, b) =>
            sortBy === 'name' ? String(a.name || a.id).localeCompare(String(b.name || b.id))
            : sortBy === 'region' ? (placeOf(a).localeCompare(placeOf(b)) || lvlOf(a) - lvlOf(b))
            : (lvlOf(a) - lvlOf(b) || String(a.name || a.id).localeCompare(String(b.name || b.id))));

          if (!list.length) {
            const why = search ? `Nothing matches "${escapeHtml(search)}".`
              : filter === 'completed' ? 'No quests finished yet.'
              : filter === 'repeatable' ? 'No repeatable quests found or taken yet.'
              : 'No active quests. Press E near camp, town, cave scouts, placed NPC quest markers, or quest-hook events.';
            body.innerHTML = `<div class="small" style="margin-top:8px">${why}</div>`;
            return;
          }

          // Completed entries render as a compact history row - they have no live task progress or
          // claimable rewards, so reusing the full active card would show empty meters and dead buttons.
          if (filter === 'completed') {
            body.innerHTML = list.map(quest => {
              const d = descriptorFor(quest.id) || quest;
              const place = String(d.folder || '').split('/').pop().trim();
              return `
                <article class="systemPanel" style="margin-top:8px; border-color:rgba(140,200,150,.4)">
                  <div style="display:flex; justify-content:space-between; gap:8px; align-items:start">
                    <div>
                      <h3>${escapeHtml(quest.name || quest.id)}</h3>
                      <div class="small">${escapeHtml(place || 'Dark Woods')}${d.minLevel ? ` · Lv ${escapeHtml(String(d.minLevel))}` : ''}${d.giver ? ` · ${escapeHtml(d.giver)}` : ''}${d.repeatable ? ' · Repeatable' : ''}</div>
                    </div>
                    <div class="small" style="color:#8fd39b; white-space:nowrap">Completed</div>
                  </div>
                </article>`;
            }).join('');
            return;
          }

          body.innerHTML = list.map(quest => {
            const meta = descriptorFor(quest.id) || quest;   // authored fields, not the runtime copy
            const selected = this.state.selectedQuestId === quest.id;
            const ready = this.isQuestComplete(quest);
            const taskHtml = (quest.tasks || []).map(task => {
              const required = Math.max(1, Number(task.required) || 1);
              const progress = clamp(Number(task.progress) || 0, 0, required);
              const pct = required > 0 ? Math.floor((progress / required) * 100) : 0;
              return `
                <div class="small" style="margin:6px 0 2px">${escapeHtml(task.label || task.target || task.type)} · ${progress}/${required}</div>
                <div class="systemMeter"><div class="systemMeterFill" style="width:${pct}%; background:linear-gradient(90deg,#7c4dcf,#d29cff)"></div></div>
              `;
            }).join('');
            const rewardItems = Array.isArray(quest.rewards?.items) ? quest.rewards.items : [];
            const rewardChoices = Array.isArray(quest.rewards?.choiceItems) ? quest.rewards.choiceItems : [];
            const choiceHtml = rewardChoices.length ? `
              <div class="small" style="margin-top:8px;color:#c797ff">Class Reward Choice</div>
              <div class="inventoryGrid" style="margin-top:5px">
                ${rewardChoices.map((reward, rewardIndex) => {
                  const itemId = reward.id || reward.itemId || reward.name || '';
                  const item = game.getCompiledItem?.(itemId) || game.editorItems?.[itemId] || DR.ITEM_BY_ID?.[itemId] || { name: itemId || 'Choice Reward', category: 'Quest Reward', rarityKey: reward.rarityKey || 'white' };
                  const color = item.rarity?.color || item.icon?.color || '#cfdac8';
                  const cls = Array.isArray(reward.classes) && reward.classes.length ? ` · ${reward.classes.join(', ')}` : '';
                  return `<div class="itemSlot compactItem" data-item-tooltip="1" data-tooltip-item-id="${escapeHtml(itemId)}" data-quest-choice-index="${rewardIndex}" style="--rarity-color:${escapeHtml(color)};--icon-color:${escapeHtml(color)}">${game.itemIconHtml?.(item, 'equipIcon generatedIcon') || ''}<span>${escapeHtml(item.name || itemId || 'Choice')}${escapeHtml(cls)}</span></div>`;
                }).join('')}
              </div>
            ` : '';
            const rewardHtml = rewardItems.length ? `
              <div class="small" style="margin-top:8px;color:#d8b36a">Reward Items</div>
              <div class="inventoryGrid" style="margin-top:5px">
                ${rewardItems.map((reward, rewardIndex) => {
                  const itemId = reward.id || reward.itemId || reward.name || '';
                  const item = game.getCompiledItem?.(itemId) || game.editorItems?.[itemId] || DR.ITEM_BY_ID?.[itemId] || { name: itemId || 'Quest Reward', category: 'Quest Reward', rarityKey: reward.rarityKey || 'white', stack: reward.qty || reward.quantity || 1 };
                  const color = item.rarity?.color || item.icon?.color || '#cfdac8';
                  const qty = Math.max(1, Math.floor(Number(reward.qty || reward.quantity || item.stack || 1) || 1));
                  return `<div class="itemSlot compactItem" data-item-tooltip="1" data-tooltip-item-id="${escapeHtml(itemId)}" data-quest-reward-index="${rewardIndex}" style="--rarity-color:${escapeHtml(color)};--icon-color:${escapeHtml(color)}">${game.itemIconHtml?.(item, 'equipIcon generatedIcon') || ''}<span>${escapeHtml(item.name || itemId || 'Reward')}${qty > 1 ? ` x${qty}` : ''}</span></div>`;
                }).join('')}
              </div>
            ` : '';
            return `
              <article class="systemPanel" style="margin-top:8px; border-color:${ready ? 'rgba(210,156,255,.65)' : selected ? 'rgba(255,214,110,.55)' : 'rgba(170,134,85,.28)'}">
                <div style="display:flex; justify-content:space-between; gap:8px; align-items:start">
                  <div>
                    <h3>${escapeHtml(quest.name || quest.id)} ${ready ? '· Ready' : ''}</h3>
                    <!-- V0.20.4 (Roadmap Item 15): recommended level, giver and the repeatable flag were
                         authored on all 26 quests and had never been shown - the line only carried the
                         folder and the turn-in. Read from the descriptor rather than the active-state
                         copy, so this cannot go blank if that copy ever drops a field. -->
                    <div class="small">${escapeHtml(meta.folder || quest.folder || 'Quest')}${meta.minLevel ? ` · Lv ${escapeHtml(String(meta.minLevel))}` : ''}${meta.repeatable ? ' · Repeatable' : ''}</div>
                    <div class="small">${meta.giver ? `From: ${escapeHtml(meta.giver)} · ` : ''}Turn in: ${escapeHtml(quest.turnIn || meta.turnIn || meta.giver || 'Quest Source')}</div>
                  </div>
                  <button data-quest-select="${escapeHtml(quest.id)}">${selected ? 'Selected' : 'Select'}</button>
                </div>
                <div class="small" style="margin-top:6px">${escapeHtml(ready ? (quest.completedText || 'Return to the quest giver.') : (quest.inProgressText || quest.offerText || 'Complete the objectives.'))}</div>
                ${taskHtml}
                ${rewardHtml}
                ${choiceHtml}
              </article>
            `;
          }).join('');
          game.bindItemTooltips?.(body, node => {
            const itemId = node.dataset.tooltipItemId;
            if (!itemId) return null;
            return game.getCompiledItem?.(itemId) || game.editorItems?.[itemId] || DR.ITEM_BY_ID?.[itemId] || null;
          }, { source: 'quest-reward' });
        }
      };

      runtime.init();
      return runtime;
    }
  });
})();
