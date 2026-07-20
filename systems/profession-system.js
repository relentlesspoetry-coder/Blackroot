// Dream Realms profession overview UI
// V0.11.9: aggregates gathering, mining, fishing, cooking, and blacksmithing progression in one window.
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[ch]);

  function isTypingTarget(event) {
    const el = event.target;
    if (!el) return false;
    const tag = String(el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }

  function ensureWindow(runtime) {
    let panel = document.getElementById('professionWindow');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'professionWindow';
    panel.className = 'panel gameWindow professionWindowPanel';
    panel.style.cssText = `
      position:fixed; left:18px; top:92px; z-index:19; width:min(460px,calc(100vw - 36px));
      max-height:calc(100vh - 130px); overflow:auto; display:none; padding:14px;
      background:rgba(8,13,10,.94); border:1px solid rgba(216,222,209,.22);
      box-shadow:0 16px 44px rgba(0,0,0,.45); color:#d8ded1;
    `;
    panel.innerHTML = `
      <div class="windowHeader">
        <div>
          <div class="name">Professions &amp; Skills</div>
          <div class="small" data-profession-summary>Gathering · Mining · Fishing · Cooking · Blacksmithing · Tailoring · Meditating</div>
        </div>
        <button type="button" data-profession-close>Close</button>
      </div>
      <div class="small" style="margin-bottom:10px;color:#bfb08e;">K toggles this panel. G gathers resource nodes, F fishes at nearby water, and C opens recipes near stations.</div>
      <div data-profession-body></div>
    `;
    document.body.appendChild(panel);
    panel.querySelector('[data-profession-close]')?.addEventListener('click', () => runtime.toggle(false));
    return panel;
  }

  function rowHtml(row) {
    const needed = Math.max(1, Math.floor(Number(row.needed) || 1));
    const xp = Math.max(0, Math.floor(Number(row.xp) || 0));
    const pct = Math.max(0, Math.min(100, (xp / needed) * 100));
    return `
      <article style="border:1px solid rgba(216,222,209,.15);background:rgba(255,255,255,.035);padding:10px;margin:8px 0;">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
          <strong style="color:${escapeHtml(row.color || '#f0bd70')};">${escapeHtml(row.name)}</strong>
          <span class="small">Level ${Math.max(1, Math.floor(Number(row.level) || 1))}</span>
        </div>
        <div class="bar" style="margin-top:6px;"><div class="fill xp" style="width:${pct.toFixed(1)}%"></div><div class="barText">EXP: ${xp}/${needed}</div></div>
        <div class="small" style="margin-top:4px;">${escapeHtml(row.meta || '')}</div>
      </article>`;
  }

  registerDreamRealmsSystem({
    id: 'runtimeProfessions',
    name: 'Runtime Professions',

    install(game) {
      const runtime = {
        id: 'runtimeProfessions',
        name: 'Runtime Professions',
        game,
        open: false,
        panel: null,

        init() {
          game.professionSystem = this;
          game.toggleProfessionPanel = force => this.toggle(force);
          this.panel = ensureWindow(this);
          // NOTE: the K key is bound centrally in game.js ('skills' action ->
          // toggleSkillsPanel, which delegates here). This system used to add its
          // OWN duplicate K listener too; with both routed to this one window they
          // double-toggled and cancelled out (K appeared to do nothing). The
          // duplicate listener is removed - the central binding is the single one.
        },

        toggle(force) {
          this.open = typeof force === 'boolean' ? force : !this.open;
          if (!this.panel) this.panel = ensureWindow(this);
          if (this.panel) this.panel.style.display = this.open ? 'block' : 'none';
          // Skills and professions are one window now: the retired standalone
          // Skills window must never linger open alongside this one, and K must
          // fully close the single window.
          game.skillsOpen = false;
          if (DR.ui?.skillsPanel) DR.ui.skillsPanel.style.display = 'none';
          if (this.open) {
            this.render();
            game.applyUiWindowStoredPosition?.(this.panel);
          }
        },

        collectRows() {
          const rows = [];
          const push = row => rows.push(row);
          const resourceSkills = game.resourceGatheringSystem?.state?.skills || {};
          const resourceNext = level => game.resourceGatheringSystem?.nextLevelXp?.(level) || Math.max(50, Math.floor(100 * Math.pow(Math.max(1, level || 1), 1.45)));
          for (const name of ['Gathering', 'Mining', 'Fishing']) {
            const skill = resourceSkills[name] || { level: 1, xp: 0, harvests: 0, failures: 0, rareFinds: 0 };
            const colors = { Gathering: '#75d069', Mining: '#c78347', Fishing: '#5eb7cc' };
            push({
              name,
              level: skill.level,
              xp: skill.xp,
              needed: resourceNext(skill.level),
              color: colors[name],
              meta: `${skill.harvests || 0} successful actions · ${skill.failures || 0} failures · ${skill.rareFinds || 0} rare finds`
            });
          }

          const craftingSkills = game.craftingSystem?.state?.skills || {};
          const craftNext = level => game.craftingSystem?.nextLevelXp?.(level) || Math.max(60, Math.floor(100 * Math.pow(Math.max(1, level || 1), 1.45)));
          const craftDefs = [
            ['cooking', 'Cooking', '#f0a35b'],
            ['blacksmithing', 'Blacksmithing', '#b8b2a8'],
            ['tailoring', 'Tailoring', '#c991ff']
          ];
          for (const [id, name, color] of craftDefs) {
            const skill = craftingSkills[id] || { level: 1, xp: 0, crafts: 0, failures: 0, rareCrafts: 0 };
            push({
              name,
              level: skill.level,
              xp: skill.xp,
              needed: craftNext(skill.level),
              color,
              meta: `${skill.crafts || 0} crafts · ${skill.failures || 0} failures · ${skill.rareCrafts || 0} rare crafts`
            });
          }
          // Meditating is a skill rather than a crafting profession, but this is
          // now the single unified window, so it lives here too. Reuse the Skills
          // system's meditation math so the level/XP curve stays in one place.
          const med = (game.collectSkillRows?.() || []).find(r => String(r?.name).toLowerCase() === 'meditating');
          if (med) push({ name: 'Meditating', level: med.level, xp: med.xp, needed: med.needed, color: '#b892e0', meta: med.meta });
          return rows;
        },

        render() {
          if (!this.panel) return;
          const body = this.panel.querySelector('[data-profession-body]');
          const summary = this.panel.querySelector('[data-profession-summary]');
          if (!body || !summary) return;
          const rows = this.collectRows();
          const totalLevels = rows.reduce((sum, row) => sum + Math.max(1, Math.floor(Number(row.level) || 1)), 0);
          summary.textContent = `${rows.length} tracked · ${totalLevels} total levels`;
          body.innerHTML = rows.map(rowHtml).join('') + `
            <div class="small" style="margin-top:10px;color:#bfb08e;">
              Recipes are available at Campfires and Forges. Nodes show ! when your profession level is too low.
            </div>`;
        },

        update() {
          if (this.open) this.render();
        }
      };

      runtime.init();
      return runtime;
    }
  });
})();
