// Dream Realms skills window and meditation progression system
// Pass 46 QoL: exposes profession/activity levels in a movable Skills UI.
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[ch]);

  // Level 1-20 XP curve and the migration-safe `entity.meditation` object are
  // owned by systems/meditation-system.js. This module only mirrors that
  // state into the legacy `meditationSkill` shape the Skills panel renders.
  function nextMeditationXp(level) {
    const fromChart = DR.MeditationHelpers?.xpNeededForNextLevel?.(level);
    return fromChart == null ? null : fromChart;
  }

  function normalizeMeditationSkill(player) {
    if (!player) return { name: 'Meditating', level: 1, xp: 0, ticks: 0 };
    if (typeof DR.migrateMeditationSaveData === 'function' && !player.meditation) DR.migrateMeditationSaveData(player);
    if (!player.meditationSkill || typeof player.meditationSkill !== 'object') {
      player.meditationSkill = { name: 'Meditating', level: 1, xp: 0, ticks: 0 };
    }
    player.meditationSkill.name = 'Meditating';
    player.meditationSkill.level = Math.max(1, Math.min(20, Math.floor(Number(player.meditationSkill.level) || 1)));
    player.meditationSkill.xp = Math.max(0, Math.floor(Number(player.meditationSkill.xp) || 0));
    player.meditationSkill.ticks = Math.max(0, Math.floor(Number(player.meditationSkill.ticks) || 0));
    return player.meditationSkill;
  }

  registerDreamRealmsSystem({
    id: 'skills-window',
    name: 'Skills Window',

    install(game) {
      const ui = DR.ui;
      const runtime = {
        id: 'skills-window',
        name: 'Skills Window',
        game,

        toggle(force, options = {}) {
          // Skills now live inside the unified "Professions & Skills" window, so
          // the menu button / gamepad shortcut route there - only one window ever
          // opens, and pressing it again closes that same window.
          if (typeof game.toggleProfessionPanel === 'function') {
            game.toggleProfessionPanel(force);
            return;
          }
          // Legacy fallback: standalone Skills window (only if the professions UI
          // somehow isn't present).
          game.skillsOpen = typeof force === 'boolean' ? force : !game.skillsOpen;
          if (ui.skillsPanel) ui.skillsPanel.style.display = game.skillsOpen ? 'block' : 'none';
          if (game.skillsOpen) this.render();
        },

        gainMeditationXp(amount) {
          const skill = normalizeMeditationSkill(game.player);
          skill.ticks += 1;
          // V0.17.24: was `Math.max(1, ...)`, which silently floored a
          // genuine 0-XP tick up to 1. Now that xpPerTick can legitimately
          // vary with bonus multipliers (see calculateMeditationRegen), a
          // 0 (or negative/NaN) amount must stay 0 - grantMeditationXp
          // already no-ops on non-positive amounts.
          if (typeof game.grantMeditationXp === 'function') game.grantMeditationXp(game.player, Math.max(0, Math.floor(Number(amount) || 0)), {});
        },

        rows() {
          const rows = [];
          const push = (name, level, xp, needed, meta = '') => rows.push({
            name,
            level: Math.max(1, Math.floor(Number(level) || 1)),
            xp: Math.max(0, Math.floor(Number(xp) || 0)),
            needed: Math.max(1, Math.floor(Number(needed) || 1)),
            meta
          });

          const meditation = normalizeMeditationSkill(game.player);
          const meditationNeeded = nextMeditationXp(meditation.level);
          push('Meditating', meditation.level, meditation.xp, meditationNeeded == null ? meditation.xp || 1 : meditationNeeded, meditationNeeded == null ? 'Max level' : `${meditation.ticks || 0} ticks`);

          const gatheringSkills = game.resourceGatheringSystem?.state?.skills || {};
          const fishing = gatheringSkills.Fishing || game.systemLookup?.fishing?.state;
          if (fishing) push('Fishing', fishing.level, fishing.xp, game.resourceGatheringSystem?.nextLevelXp?.(fishing.level) || game.systemLookup?.fishing?.nextLevelXp?.() || (45 + fishing.level * 20), `${fishing.harvests || fishing.catches || 0} catches/harvests · ${fishing.rareFinds || fishing.rareCatches || 0} rare`);
          else push('Fishing', 1, 0, 100, 'No catches yet');

          for (const key of ['Gathering', 'Mining']) {
            const skill = gatheringSkills[key];
            if (skill) push(key, skill.level, skill.xp, game.resourceGatheringSystem?.nextLevelXp?.(skill.level) || Math.floor(100 * Math.pow(skill.level || 1, 1.45)), `${skill.harvests || 0} harvests · ${skill.failures || 0} failures · ${skill.rareFinds || 0} rare`);
            else push(key, 1, 0, 100, 'No harvests yet');
          }

          const craftingSkills = game.craftingSystem?.state?.skills || {};
          const names = { cooking: 'Cooking', blacksmithing: 'Blacksmithing', tailoring: 'Tailoring', gathering: 'Gathering' };
          for (const [id, skill] of Object.entries(craftingSkills)) {
            if (!skill) continue;
            push(names[id] || skill.name || id, skill.level, skill.xp, game.craftingSystem?.nextLevelXp?.(skill.level) || (55 + skill.level * 24), `${skill.crafts || 0} crafts · ${skill.failures || 0} failures`);
          }

          const seen = new Set();
          return rows.filter(row => {
            const key = row.name.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }).sort((a, b) => a.name.localeCompare(b.name));
        },

        render() {
          if (!ui.skillsList) return;
          const rows = this.rows();
          ui.skillsMeta.textContent = `${rows.length} tracked skill${rows.length === 1 ? '' : 's'}`;
          ui.skillsList.innerHTML = rows.map(row => {
            const pct = Math.max(0, Math.min(100, (row.xp / Math.max(1, row.needed)) * 100));
            return `<div class="skillRow"><div class="skillTitleLine"><strong>${escapeHtml(row.name)}</strong><span class="small">Level ${row.level}</span></div><div class="bar"><div class="fill xp" style="width:${pct.toFixed(1)}%"></div><div class="barText">EXP: ${row.xp}/${row.needed}</div></div><div class="small">${escapeHtml(row.meta)}</div></div>`;
          }).join('');
        }
      };

      game.skillsSystem = runtime;
      game.toggleSkillsPanel = (force, options) => runtime.toggle(force, options);
      game.renderSkillsPanel = () => { runtime.render(); game.professionSystem?.update?.(); };
      game.collectSkillRows = () => runtime.rows();
      game.gainMeditationXp = amount => runtime.gainMeditationXp(amount);
      return runtime;
    }
  });
})();
