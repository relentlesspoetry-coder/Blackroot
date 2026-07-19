// Dream Realms runtime NPC interaction system
// Modular Pass 36: executes editor NPC markers as live dialogue, vendor, trainer, and quest-giver interactions.
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const STORAGE_KEY = 'dream-realms.npc-runtime.v1';

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[ch]);

  const cloneJson = value => JSON.parse(JSON.stringify(value ?? null));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const safeNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  // V0.20.62: day/night shifts. The camp draws ~45 procedural characters at once, which profiling
  // identified as the reason the frame rate collapses near camp (8 FPS at camp vs 20 away). Halving
  // the standing population is a content fix for a rendering cost. Every NPC gets a fixed shift, so
  // the camp always has a crew - just a different one after dark.
  //
  // The assignment is a hash of the NPC id, NOT a roster index: it must stay identical across
  // sessions, saves and roster edits, or a trainer would silently change shift when an unrelated NPC
  // is added. Off-shift NPCs reuse the existing `_asleep` flag rather than adding a second one -
  // that flag is already honoured by the renderer, both interaction pickers and the minimap, so
  // "off shift" inherits all four behaviours for free instead of needing four new checks.
  const NPC_SHIFT_CACHE = new Map();
  let NPC_SHIFT_STAMP = '';
  const npcShiftId = node => String(node?.npcId || node?.id || node?.name || '');
  // Assign by SORTING the roster and alternating, not by hashing each id independently. A per-id hash
  // is stable but not balanced - on the real 28-NPC roster it split 11/19 rather than 14/14. Sorting
  // by id keeps the assignment deterministic across sessions and saves (same roster -> same shifts)
  // while guaranteeing an even split, and re-runs only when the roster itself changes.
  function ensureNpcShifts(nodes) {
    const ids = [];
    for (const n of nodes) { const id = npcShiftId(n); if (id) ids.push(id); }
    ids.sort();
    const stamp = ids.join('|');
    if (stamp === NPC_SHIFT_STAMP) return;
    NPC_SHIFT_STAMP = stamp;
    NPC_SHIFT_CACHE.clear();
    ids.forEach((id, i) => NPC_SHIFT_CACHE.set(id, (i % 2) === 0 ? 'day' : 'night'));
  }
  const npcShift = node => NPC_SHIFT_CACHE.get(npcShiftId(node)) || 'day';
  const npcIsOffShift = (node, isNight) => (npcShift(node) === 'night') !== !!isNight;



  function npcClassModelFor(npc = {}) {
    const explicit = String(npc.className || npc.playerClass || npc.trainerClass || npc.classId || '').trim();
    if (explicit) return explicit;
    const id = String(npc.npcId || npc.id || '').toLowerCase();
    const role = String(npc.role || '').toLowerCase();
    if (id.includes('fighter') || role === 'blacksmith' || role === 'guard' || role === 'road_warden' || role === 'mercenary_master') return 'Fighter';
    if (id.includes('cleric') || role === 'healer') return 'Cleric';
    if (id.includes('rogue') || id.includes('scout')) return 'Rogue';
    if (id.includes('summoner')) return 'Summoner';
    if (id.includes('necromancer')) return 'Necromancer';
    if (id.includes('druid') || role === 'fisher_provisioner') return 'Druid';
    if (id.includes('bard') || role === 'cook') return 'Bard';
    if (id.includes('enchanter') || role === 'merchant' || role === 'merc_recruiter' || role === 'quest_giver') return 'Enchanter';
    return 'Fighter';
  }

  function npcRoleOverlayFor(npc = {}) {
    const role = String(npc.role || '').toLowerCase();
    if (role === 'merchant') return '$';
    if (role === 'blacksmith') return '⚒';
    if (role === 'merc_recruiter' || role === 'mercenary_master') return '★';
    if (role === 'healer') return '+';
    if (role === 'fisher_provisioner') return '~';
    if (npc.trainerClass || role === 'class_trainer') return 'T';
    return npc.label || 'N';
  }


  function npcVisualProfileFor(npc = {}) {
    const id = String(npc.npcId || npc.id || '').toLowerCase();
    const role = String(npc.role || '').toLowerCase();
    const className = npcClassModelFor(npc);
    const base = {
      className,
      skinTone: npc.skinTone || '#d8a87e',
      hairStyle: npc.hairStyle || 'short',
      faceStyle: npc.faceStyle || 'balanced',
      hairColor: npc.hairColor || '#4b3628',
      clothesPrimary: npc.clothesPrimary || npc.color || '#8a7356',
      clothesSecondary: npc.clothesSecondary || '#d6bc7c',
      palette: {
        accent: npc.color || '#d6bc7c',
        accentDark: '#5e4729',
        metal: '#c8c3ad',
        glow: npc.color || '#d6bc7c'
      }
    };
    const merge = extra => ({ ...base, ...extra, palette: { ...base.palette, ...(extra.palette || {}) } });

    if (npc.trainerClass || role === 'class_trainer') {
      const trainer = String(npc.trainerClass || className || '').toLowerCase();
      const trainerLooks = {
        fighter: { hairStyle: 'short', faceStyle: 'stern', hairColor: '#3b2b22', clothesPrimary: '#7f4a35', clothesSecondary: '#c2b07a', palette: { metal: '#c9c3aa', accent: '#d0b070' } },
        cleric: { hairStyle: 'bun', faceStyle: 'soft', hairColor: '#8b6b44', clothesPrimary: '#d8d1b5', clothesSecondary: '#f3df87', palette: { glow: '#fff2a8', accent: '#e7c15f' } },
        rogue: { hairStyle: 'undercut', faceStyle: 'sharp', hairColor: '#1d1b1b', clothesPrimary: '#1e2738', clothesSecondary: '#5f8d6a', palette: { accent: '#6dbb88' } },
        bard: { hairStyle: 'looseWaves', faceStyle: 'balanced', hairColor: '#6f3b27', clothesPrimary: '#714293', clothesSecondary: '#d8a65e', palette: { accent: '#d8a65e', glow: '#f5c4ff' } },
        druid: { hairStyle: 'braid', faceStyle: 'soft', hairColor: '#5b4a2d', clothesPrimary: '#4f7b48', clothesSecondary: '#b7d27a', palette: { accent: '#9acb6c', glow: '#b8ffd8' } },
        summoner: { hairStyle: 'topknot', faceStyle: 'balanced', hairColor: '#2b2440', clothesPrimary: '#26315d', clothesSecondary: '#62c7bd', palette: { accent: '#62c7bd', glow: '#75fff0' } },
        necromancer: { hairStyle: 'long', faceStyle: 'scarred', hairColor: '#16161c', clothesPrimary: '#1d1b29', clothesSecondary: '#b7ad86', palette: { accent: '#cfc6a0', glow: '#9fff6d' } },
        enchanter: { hairStyle: 'curls', faceStyle: 'sharp', hairColor: '#3a2450', clothesPrimary: '#382a69', clothesSecondary: '#d58df0', palette: { accent: '#d78cf4', glow: '#ffb6ff' } }
      };
      return merge(trainerLooks[trainer] || { clothesPrimary: '#3e5873', clothesSecondary: '#d6bc7c' });
    }
    if (role === 'merchant' || id.includes('merchant')) return merge({ className: 'Enchanter', hairStyle: 'short', faceStyle: 'balanced', hairColor: '#5b3523', clothesPrimary: '#8f6536', clothesSecondary: '#d8b46a', palette: { accent: '#e0b66a', glow: '#f5d38a' } });
    if (role === 'blacksmith' || id.includes('smith')) return merge({ className: 'Fighter', hairStyle: 'shaved', faceStyle: 'stern', hairColor: '#2f261f', clothesPrimary: '#5e3a2d', clothesSecondary: '#d08a54', palette: { metal: '#d2c8b5', accent: '#f0a15a' } });
    if (role === 'mercenary_master') return merge({ className: 'Fighter', hairStyle: 'short', faceStyle: 'stern', hairColor: '#2d261d', clothesPrimary: '#4a3826', clothesSecondary: '#c2a46d', palette: { accent: '#c2a46d', accentDark: '#3a2618', leather: '#6d462a', metal: '#b9b4a4', glow: '#f0d28d' } });
    if (role === 'merc_recruiter') return merge({ className: 'Fighter', hairStyle: 'short', faceStyle: 'stern', hairColor: '#2d261d', clothesPrimary: '#3f5d38', clothesSecondary: '#c5ec9e', palette: { accent: '#c2ec9e', glow: '#c2ec9e' } });
    if (role === 'healer') return merge({ className: 'Cleric', hairStyle: 'long', faceStyle: 'soft', hairColor: '#d8d1b5', clothesPrimary: '#d8efe5', clothesSecondary: '#bdf4de', palette: { accent: '#bdf4de', glow: '#e9fff4' } });
    if (role === 'fisher_provisioner') return merge({ className: 'Druid', hairStyle: 'looseWaves', faceStyle: 'balanced', hairColor: '#4b4a32', clothesPrimary: '#356c70', clothesSecondary: '#9ed6df', palette: { accent: '#8ccdde', glow: '#b3f5ff' } });
    if (role === 'quest_giver') return merge({ className: className || 'Enchanter', hairStyle: 'braid', faceStyle: 'balanced', hairColor: '#4b3628', clothesPrimary: npc.color || '#6d5b3d', clothesSecondary: '#f0d684', palette: { accent: npc.color || '#f0d684' } });
    if (role === 'lore') return merge({ className: 'Rogue', hairStyle: 'undercut', faceStyle: 'sharp', hairColor: '#2d2a24', clothesPrimary: '#415b42', clothesSecondary: '#9fc785', palette: { accent: '#9fc785' } });
    return base;
  }

  function drawNpcRolePropOverlay(context, s, npc = {}, profile = {}) {
    const role = String(npc.role || '').toLowerCase();
    const id = String(npc.npcId || npc.id || '').toLowerCase();
    const accent = profile?.palette?.accent || npc.color || '#d8b46a';
    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = 'rgba(12,10,7,0.82)';
    context.lineWidth = 3;
    context.fillStyle = accent;
    if (role === 'merchant' || id.includes('merchant')) {
      context.fillStyle = '#8a5a32';
      context.strokeRect(s.x + 16, s.y - 42, 15, 20);
      context.fillRect(s.x + 17, s.y - 41, 13, 18);
      context.strokeStyle = '#d8b46a'; context.lineWidth = 2;
      context.beginPath(); context.arc(s.x + 23.5, s.y - 43, 5, Math.PI, 0); context.stroke();
    } else if (role === 'blacksmith' || id.includes('smith')) {
      context.strokeStyle = '#d2c8b5'; context.lineWidth = 5;
      context.beginPath(); context.moveTo(s.x + 16, s.y - 50); context.lineTo(s.x + 29, s.y - 34); context.stroke();
      context.fillStyle = '#6b5544'; context.fillRect(s.x + 26, s.y - 36, 12, 6);
    } else if (role === 'merc_recruiter' || role === 'mercenary_master') {
      context.fillStyle = '#38271a'; context.fillRect(s.x + 18, s.y - 62, 15, 22);
      context.fillStyle = accent; context.fillRect(s.x + 20, s.y - 59, 11, 3);
      context.strokeStyle = accent; context.lineWidth = 2;
      context.beginPath(); context.moveTo(s.x + 18, s.y - 38); context.lineTo(s.x + 32, s.y - 38); context.stroke();
    } else if (role === 'healer') {
      context.strokeStyle = accent; context.lineWidth = 2;
      context.beginPath(); context.arc(s.x + 21, s.y - 55, 8, 0, Math.PI * 2); context.stroke();
      context.beginPath(); context.moveTo(s.x + 21, s.y - 63); context.lineTo(s.x + 21, s.y - 47); context.moveTo(s.x + 13, s.y - 55); context.lineTo(s.x + 29, s.y - 55); context.stroke();
    } else if (role === 'fisher_provisioner') {
      context.strokeStyle = '#9ed6df'; context.lineWidth = 2.5;
      context.beginPath(); context.moveTo(s.x + 14, s.y - 54); context.quadraticCurveTo(s.x + 34, s.y - 75, s.x + 42, s.y - 42); context.stroke();
    } else if (npc.trainerClass || role === 'class_trainer') {
      context.fillStyle = '#2c2418';
      context.strokeStyle = accent; context.lineWidth = 2;
      context.beginPath(); context.roundRect(s.x + 15, s.y - 48, 16, 13, 2); context.fill(); context.stroke();
      context.strokeStyle = 'rgba(255,255,220,0.55)'; context.lineWidth = 1;
      context.beginPath(); context.moveTo(s.x + 23, s.y - 47); context.lineTo(s.x + 23, s.y - 36); context.stroke();
    }
    context.restore();
  }

  function drawNpcClassModelDirect(context, game, actor) {
    const render = window.DreamRealms?.render || {};
    const classKey = String(actor.className || actor.playerClass || '').toLowerCase().replace(/[\s_\-]/g, '');
    const model = classKey === 'bard'
      ? (render.BardProceduralModel || window.BardProceduralModel)
      : (classKey === 'druid'
        ? (render.DruidProceduralModel || window.DruidProceduralModel)
        : (render.ClassIdentityProceduralModel || window.ClassIdentityProceduralModel));
    if (!model?.draw) return false;

    actor.screenX = safeNumber(actor.screenX, 0);
    actor.screenY = safeNumber(actor.screenY, 0);
    actor.facingName = actor.facingName || 'south';
    actor.action = actor.action || 'idle';
    // V0.20.45: this was an unconditional `actor.isMoving = false`, which clobbered the walking state one
    // line before the draw - so the sprite cache's animation bucket (which keys off action/isMoving) always
    // treated a camp NPC as idle and reused a single baked frame. Combined with the hardcoded idle/facing
    // in the caller, it is why walking NPCs slid around wearing a frozen standing pose. Derive it instead;
    // a genuinely idle NPC still reports false, so nothing else changes.
    actor.isMoving = actor.action === 'walk' || actor.action === 'swim' || safeNumber(actor.moveBlend, 0) > 0.08;
    actor.meditating = false;
    actor.fishing = false;
    actor.spellCastAnim = 0;
    actor.attackAnim = 0;
    actor.hitAnim = 0;
    actor.deathProgress = 0;
    actor._humanoidSheetRow = actor._humanoidSheetRow ?? 1;
    actor.isClassTrainerModel = !!(actor.trainerClass || actor.role === 'class_trainer');
    actor.isPlayerScaleNpcModel = actor.isNpcModel === true || !!actor.usePlayerClassModelBase;

    let ok = false;
    if (!actor.debugFacing && game?.runtimeSpriteCache?.drawModel && window.DreamRealms?.CONFIG?.PERFORMANCE?.enableSpriteCache !== false) {
      ok = game.runtimeSpriteCache.drawModel(context, actor, model, {
        rendererId: `npc_class:${classKey || 'trainer'}`,
        bounds: 'humanoid',
        scale: 1,
        screenX: actor.screenX,
        screenY: actor.screenY,
        nowMs: performance.now()
      }) !== false;
    }
    if (!ok) {
      context.save();
      try {
        ok = model.draw(context, actor, performance.now()) !== false;
      } finally {
        context.restore();
      }
    }
    if (!ok) return false;

    const source = actor.sourceEntity || actor;
    source._trainerClassRenderer = actor.isClassTrainerModel ? classKey : source._trainerClassRenderer;
    source._playerScaleNpcClassRenderer = actor.isPlayerScaleNpcModel ? classKey : source._playerScaleNpcClassRenderer;
    actor._nameplateAnchor = actor._nameplateAnchor || source._nameplateAnchor || {
      x: actor.screenX,
      y: actor.screenY - 94
    };
    if (source && actor._nameplateAnchor) source._nameplateAnchor = actor._nameplateAnchor;
    return true;
  }

  const DEFAULT_DIALOGUE = {
    dialogue_town_guide_intro: [
      'Dark Woods is not empty. Stay on the road until you understand what hunts between the trees.',
      'If you want work, I can mark your first task. Return when the woods have tested you.'
    ].join('\n\n'),
    dialogue_mossfang_warning: [
      'The cave mouth keeps breathing cold air, even at noon.',
      'Spiders and wolves have both been seen near the Hidden Tree Cave. Do not go deeper alone.'
    ].join('\n\n'),
    // V0.17.47 Phase 8: Hidden Tree Cave's interior lore NPC.
    dialogue_hidden_tree_hermit: [
      'Few find this root long enough to sit under. Fewer still leave the way they came.',
      'The wolves and the widow keep their distance from me. I have not asked them why, and I do not intend to.',
      'If you are looking for a warmer welcome, you will not find it here. But you are welcome to rest all the same.'
    ].join('\n\n'),
    dialogue_camp_merchant: 'Coin still works out here. Tools, food, ore, herbs, and starter gear are stocked when the roads are passable.',
    dialogue_camp_cook: 'I can make thin soup out of roots, but Gloomleaf makes it medicine. Bring me enough and I will send you back out with a proper bowl.',
    dialogue_bard_trainer: 'A song can brace a line, split a skull, or buy a heartbeat. Keep your hands steady and your rhythm cleaner than your fear.',
    dialogue_road_warden: [
      'The road is safer than the trees, but safer does not mean safe.',
      'Briar boars have started tearing through the lantern posts. Thin them out before they split the route to camp.'
    ].join('\n\n'),
    dialogue_deepwood_surveyor: [
      'Past the second bend the woods stop sounding like woods. The blue lights are not fireflies.',
      'If you are going deeper, mark what you kill and bring back proof. The camp needs a real map of the danger.'
    ].join('\n\n'),
    dialogue_camp_healer: 'Sit still and breathe. The woods leave splinters in the spirit before the skin shows a mark.',
    dialogue_merc_recruiter: 'Contracts are simple: coin, loyalty, and a clear command. I can assign class-trained bot companions or standard mercenary contracts. Choose the role that fits your party.',
    dialogue_mercenary_master: 'Looking for capable swords, magic, or stealth? My mercenaries never disappoint... for a price.',
    dialogue_camp_smith: 'I can keep your steel from snapping. Bring ore when you find it; I will make the camp less helpless.',
    dialogue_camp_fisher: 'The water talks if you watch it long enough. Bubbles mean food, coin, or trouble.',
    dialogue_fighter_trainer: 'Keep your stance square. A blade only matters if your feet survive the first swing.',
    dialogue_cleric_trainer: 'Healing is triage, not prayer alone. Learn who must live first.',
    dialogue_rogue_trainer: 'Do not fight fair. Fair fights are for people who already lost the advantage.',
    dialogue_summoner_trainer: 'Every bond is a leash in both directions. Command clearly, or the thing you call will command you.',
    dialogue_necromancer_trainer: 'Bone remembers shape. Spirit remembers debt. Use both carefully.',
    dialogue_druid_trainer: 'The woods are not kind, but they are honest. Listen before you ask them for power.',
    dialogue_enchanter_trainer: 'A mind is a door. A careless charm breaks the hinge.',
    dialogue_dream_spirit: 'Rest, dreamer. The realm has not released you yet. When death takes your body, your spirit returns to this light.',
    dialogue_silk_web_field_cleric: 'The expedition holds this entrance, but the webs thicken beyond the lanterns. I have work for anyone willing to cut a path through the brood.',
    dialogue_silk_web_scout_tamsin: 'Every route below is marked in silk and old blood. Bring back what the expedition needs, then cut the line to the Matriarch.',
    dialogue_silk_web_venomkeeper_oren: 'The green nests feed the brood. Break them before their venom reaches the entrance staging ground.',
    dialogue_silk_web_spirit_healer: 'This thread of light is anchored inside the cavern. If the brood takes you, your spirit can return here.'
  };

  const DEFAULT_NPC_PLACEMENTS = [
    // V0.15.49 compact Dark Woods camp layout: all trainers and remaining
    // service/quest NPCs fit inside the smaller outpost with clear approach lanes.
    { zone: 'dark_woods', x: 99, y: 97, npcId: 'npc_town_guide' },
    { zone: 'dark_woods', x: 102, y: 102, npcId: 'npc_camp_cook' },
    { zone: 'dark_woods', x: 106, y: 100, npcId: 'npc_camp_merchant' },
    { zone: 'dark_woods', x: 95, y: 101, npcId: 'npc_camp_healer' },
    { zone: 'dark_woods', x: 105, y: 106, npcId: 'npc_camp_smith' },
    { zone: 'dark_woods', x: 95, y: 106, npcId: 'npc_camp_fisher' },
    { zone: 'dark_woods', x: 91, y: 97, npcId: 'npc_mossfang_scout' },
    // V0.17.47 Phase 8: Hidden Tree Cave's one hidden interior NPC, placed at
    // the cave's deterministic 'nest' room center for seed 4103/floor 1
    // (computed from systems/cave-system.js buildRooms - see the Phase 8
    // report for how this was verified before committing to a fixed coord).
    { zone: 'mossfang_cave', x: 77, y: 100, npcId: 'npc_hidden_tree_hermit' },
    // V0.20.43 (Roadmap Item 2 - nameplate/interaction spacing): the V0.20.8 camp overhaul fixed the
    // Brann/merchant EXACT overlap but two east-ring quest NPCs still sat ~1 tile from a trainer
    // (road_warden 1.41 from fighter_trainer, deepwood_surveyor 1.00 from rogue_trainer), too close for
    // "enough surrounding space for nameplates and interaction prompts to remain readable". Each moves
    // one tile onto a prop-free camp tile that opens >=2.0 from every other NPC (verified).
    { zone: 'dark_woods', x: 110, y: 97, npcId: 'npc_road_warden' },
    { zone: 'dark_woods', x: 109, y: 102, npcId: 'npc_deepwood_surveyor' },

    // Trainers use comfortable spacing around the compact camp ring.
    { zone: 'dark_woods', x: 91, y: 100, npcId: 'npc_paladin_trainer' },
    { zone: 'dark_woods', x: 110, y: 100, npcId: 'npc_warden_trainer' },
    { zone: 'dark_woods', x: 90, y: 103, npcId: 'npc_ranger_trainer' },
    { zone: 'dark_woods', x: 110, y: 106, npcId: 'npc_assassin_trainer' },
    { zone: 'dark_woods', x: 92, y: 92, npcId: 'npc_wizard_trainer' },
    { zone: 'dark_woods', x: 108, y: 92, npcId: 'npc_shaman_trainer' },

    { zone: 'dark_woods', x: 108, y: 98, npcId: 'npc_fighter_trainer' },
    { zone: 'dark_woods', x: 109, y: 104, npcId: 'npc_rogue_trainer' },
    { zone: 'dark_woods', x: 103, y: 109, npcId: 'npc_bard_trainer' },
    { zone: 'dark_woods', x: 95, y: 98, npcId: 'npc_cleric_trainer' },
    { zone: 'dark_woods', x: 92, y: 104, npcId: 'npc_druid_trainer' },
    { zone: 'dark_woods', x: 95, y: 92, npcId: 'npc_enchanter_trainer' },
    { zone: 'dark_woods', x: 103, y: 92, npcId: 'npc_summoner_trainer' },
    { zone: 'dark_woods', x: 98, y: 109, npcId: 'npc_necromancer_trainer' },

    { zone: 'dark_woods', x: 100, y: 91, npcId: 'npc_dream_spirit_dark_woods' },
    { zone: 'dark_woods', x: 100, y: 108, npcId: 'npc_mercenary_master' },
    // V0.17.86 Rurik-allied-path fence, near (but off) the Bandit's Fall ruin
    // (center 230,60 / Rurik at 225,55). His [16] quest is gated on rurik_allied.
    { zone: 'dark_woods', x: 216, y: 70, npcId: 'npc_bandit_fence' },
    // V0.17.88 rescued expedition survivor turned quartermaster, at camp. Her [23]
    // quest is gated on questCompleted quest_fourth_member (only if you saved her).
    { zone: 'dark_woods', x: 104, y: 104, npcId: 'npc_silk_web_quartermaster' }
  ];

  const CAMP_NPC_LAYOUT = Object.freeze(Object.fromEntries(DEFAULT_NPC_PLACEMENTS
    .filter(entry => entry.zone === 'dark_woods')
    .map(entry => [entry.npcId, { x: entry.x, y: entry.y }])
  ));


  function defaultState() {
    return {
      version: 1,
      visitedNpcIds: {},
      lastNpcKey: null,
      classTraining: {},
      vendorTransactions: {}
    };
  }

  function normalizeState(raw) {
    const state = defaultState();
    if (!raw || typeof raw !== 'object') return state;
    state.visitedNpcIds = raw.visitedNpcIds && typeof raw.visitedNpcIds === 'object' ? raw.visitedNpcIds : {};
    state.lastNpcKey = raw.lastNpcKey || null;
    state.classTraining = raw.classTraining && typeof raw.classTraining === 'object' ? raw.classTraining : {};
    state.vendorTransactions = raw.vendorTransactions && typeof raw.vendorTransactions === 'object' ? raw.vendorTransactions : {};
    state.version = 1;
    return state;
  }

  function readLocalState() {
    try {
      const raw = window.localStorage?.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : defaultState();
    } catch (_err) {
      return defaultState();
    }
  }

  function writeLocalState(state) {
    try { window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_err) {}
  }

  function isTypingTarget(event) {
    const el = event.target;
    if (!el) return false;
    const tag = String(el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }

  function zoneKey(game) {
    if (game.currentZone === 'dungeon') {
      const dungeonId = game.activeDungeon?.id || game.dungeonSystem?.state?.active?.dungeonId || 'dungeon';
      const floor = Math.max(1, Math.floor(safeNumber(game.activeDungeon?.floor || game.dungeonSystem?.state?.active?.floor, 1)));
      return `${dungeonId}_floor${floor}`;
    }
    return game.currentZone === 'cave' ? (game.getActiveCaveZoneKey?.() || game.currentCave?.id || 'mossfang_cave') : 'dark_woods';
  }

  function npcKey(game, node) {
    return `${zoneKey(game)}:${Math.floor(safeNumber(node.x))},${Math.floor(safeNumber(node.y))}:${node.npcId || node.id || 'npc'}`;
  }

  function npcDef(game, nodeOrId) {
    const id = typeof nodeOrId === 'string' ? nodeOrId : (nodeOrId?.npcId || nodeOrId?.id);
    return game.editorNpcDefinitions?.[id] || DR.NPC_DRAFT_BY_ID?.[id] || (typeof nodeOrId === 'object' ? nodeOrId : null) || null;
  }

  function mergedNpc(game, node) {
    const def = npcDef(game, node) || {};
    return { ...def, ...(node || {}), id: node?.npcId || def.id || node?.id };
  }

  function currentNpcGrid(game) {
    return game.editorNpcs?.[zoneKey(game)] || {};
  }

  function allNpcNodes(game) {
    return Object.values(currentNpcGrid(game)).filter(node => node && node.enabled !== false && (node.npcId || node.id));
  }

  function distanceToPlayer(game, node) {
    if (!game.player || !node) return Infinity;
    const x = safeNumber(node.x, NaN);
    const y = safeNumber(node.y, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return Infinity;
    return Math.hypot((x + 0.5) - game.player.x, (y + 0.5) - game.player.y);
  }


  function setNpcWindowAnchor(runtime, npc) {
    const runtimeGame = runtime.game;
    runtime.windowAnchor = runtimeGame?.player && npc ? {
      playerX: runtimeGame.player.x,
      playerY: runtimeGame.player.y,
      npcX: safeNumber(npc.x, NaN),
      npcY: safeNumber(npc.y, NaN),
      npcId: npc.id || npc.npcId || npc.name || 'npc'
    } : null;
  }

  function activeNpcWindowInvalid(runtime, npc, maxRange = 3.25) {
    const runtimeGame = runtime.game;
    if (!runtimeGame?.player || !npc) return true;
    const anchor = runtime.windowAnchor;
    if (anchor && Math.hypot(runtimeGame.player.x - anchor.playerX, runtimeGame.player.y - anchor.playerY) > 0.08) return true;
    return distanceToPlayer(runtimeGame, npc) > maxRange;
  }

  function ensurePanel() {
    const host = document.getElementById('externalSystemsHud');
    if (!host) return null;
    let panel = document.getElementById('npcSystemPanel');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'npcSystemPanel';
    panel.className = 'systemPanel';
    panel.innerHTML = `
      <h3>NPCs</h3>
      <div class="small" data-npc-status>No NPC nearby.</div>
      <div class="systemMeter"><div class="systemMeterFill" data-npc-range style="background:linear-gradient(90deg,#c991ff,#ffd875)"></div></div>
      <div class="small" data-npc-meta>E: Talk · Dialogue / vendor / trainer / quests</div>
    `;
    host.appendChild(panel);
    return panel;
  }

  // V0.20.6 (Roadmap Item 5): NPC portraits. Every NPC in data/npcs.js already authors
  // `portrait: { family, color, glyph }` - 33/33 of them - and NOTHING in the codebase read `.portrait`.
  // Someone drew a portrait for every character in the game and it was never once put on screen. So the
  // portrait is not invented here: it is rendered FROM that authored descriptor.
  //
  // Procedural rather than artwork, because that is what this game already is: every NPC, mob and prop
  // is drawn from code, so a bust drawn the same way matches the established visual style by
  // construction, and satisfies "no stretched, cropped, or low-resolution portraits" at any UI scale.
  // The 14 authored families map to a silhouette; the authored colour tints it; the authored glyph is
  // the role badge. `defaultFamily` is the spec's required fallback for an NPC without a custom one.
  const PORTRAIT_FAMILIES = {
    villager:  { hat: 'none',  collar: 'cloth' },
    scout:     { hat: 'hood',  collar: 'leather' },
    hermit:    { hat: 'hood',  collar: 'cloth' },
    merchant:  { hat: 'brim',  collar: 'cloth' },
    cook:      { hat: 'toque', collar: 'apron' },
    trainer:   { hat: 'none',  collar: 'robe' },
    warden:    { hat: 'helm',  collar: 'mail' },
    officer:   { hat: 'helm',  collar: 'mail' },
    surveyor:  { hat: 'cap',   collar: 'cloth' },
    healer:    { hat: 'hood',  collar: 'robe' },
    smith:     { hat: 'cap',   collar: 'apron' },
    fisher:    { hat: 'brim',  collar: 'cloth' },
    alchemist: { hat: 'cap',   collar: 'robe' },
    spirit:    { hat: 'none',  collar: 'wisp', ethereal: true }
  };
  const PORTRAIT_FALLBACK = { hat: 'none', collar: 'cloth' };

  function portraitShade(hex, amt) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return hex || '#8a7a5c';
    const n = parseInt(m[1], 16);
    const ch = i => {
      const v = (n >> (16 - i * 8)) & 255;
      return Math.max(0, Math.min(255, Math.round(v + amt)));
    };
    return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
  }

  function drawNpcPortrait(canvas, npc) {
    if (!canvas?.getContext) return false;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    const W = canvas.width, H = canvas.height;
    const p = npc?.portrait || {};
    const fam = PORTRAIT_FAMILIES[p.family] || PORTRAIT_FALLBACK;
    const base = p.color || '#c0a875';
    const cx = W / 2;
    ctx.clearRect(0, 0, W, H);

    // Frame: a lit alcove behind the bust, tinted by the NPC's own colour.
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, portraitShade(base, -105));
    bg.addColorStop(1, '#0f0b08');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = portraitShade(base, -40);
    ctx.beginPath();
    ctx.ellipse(cx, H * 0.92, W * 0.42, H * 0.30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (fam.ethereal) {
      // Dream spirits have no bust - they are a wisp. Drawing them a pair of shoulders would be a lie
      // about what they are.
      const glow = ctx.createRadialGradient(cx, H * 0.5, 2, cx, H * 0.5, W * 0.42);
      glow.addColorStop(0, portraitShade(base, 60));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 0.5 - i * 0.13;
        ctx.strokeStyle = portraitShade(base, 30);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(cx, H * 0.5, W * (0.13 + i * 0.09), H * (0.19 + i * 0.10), 0.5 + i, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else {
      // Shoulders
      ctx.fillStyle = portraitShade(base, -55);
      ctx.beginPath();
      ctx.moveTo(cx - W * 0.40, H);
      ctx.quadraticCurveTo(cx - W * 0.34, H * 0.70, cx, H * 0.68);
      ctx.quadraticCurveTo(cx + W * 0.34, H * 0.70, cx + W * 0.40, H);
      ctx.closePath();
      ctx.fill();
      // Collar identifies the trade: an apron bib, mail rings, a robe's V, plain cloth.
      ctx.fillStyle = portraitShade(base, fam.collar === 'mail' ? 12 : -18);
      if (fam.collar === 'apron') ctx.fillRect(cx - W * 0.14, H * 0.72, W * 0.28, H * 0.28);
      else if (fam.collar === 'robe') { ctx.beginPath(); ctx.moveTo(cx - W * 0.12, H * 0.72); ctx.lineTo(cx, H * 0.92); ctx.lineTo(cx + W * 0.12, H * 0.72); ctx.closePath(); ctx.fill(); }
      else if (fam.collar === 'mail') { for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(cx + i * W * 0.09, H * 0.78, 2.6, 0, Math.PI * 2); ctx.fill(); } }
      else if (fam.collar === 'leather') { ctx.fillRect(cx - W * 0.20, H * 0.74, W * 0.40, H * 0.05); }
      // Neck + head
      ctx.fillStyle = portraitShade(base, 42);
      ctx.fillRect(cx - W * 0.07, H * 0.56, W * 0.14, H * 0.14);
      ctx.beginPath();
      ctx.ellipse(cx, H * 0.44, W * 0.17, H * 0.20, 0, 0, Math.PI * 2);
      ctx.fill();
      // Eyes - just enough to read as a face at 72px.
      ctx.fillStyle = 'rgba(20,14,10,.85)';
      ctx.beginPath(); ctx.arc(cx - W * 0.06, H * 0.44, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + W * 0.06, H * 0.44, 1.6, 0, Math.PI * 2); ctx.fill();
      // Headwear by family. Deliberately darker than the face (which is base+42): at 72px the
      // silhouette IS the identity, and at -25 the hoods and helms read as hair rather than headwear.
      ctx.fillStyle = portraitShade(base, -70);
      if (fam.hat === 'hood') {
        ctx.beginPath();
        ctx.moveTo(cx - W * 0.24, H * 0.58);
        ctx.quadraticCurveTo(cx - W * 0.26, H * 0.16, cx, H * 0.16);
        ctx.quadraticCurveTo(cx + W * 0.26, H * 0.16, cx + W * 0.24, H * 0.58);
        ctx.lineTo(cx + W * 0.17, H * 0.50);
        ctx.quadraticCurveTo(cx, H * 0.26, cx - W * 0.17, H * 0.50);
        ctx.closePath();
        ctx.fill();
      } else if (fam.hat === 'helm') {
        ctx.beginPath();
        ctx.ellipse(cx, H * 0.34, W * 0.19, H * 0.15, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(cx - W * 0.19, H * 0.32, W * 0.38, H * 0.04);
        ctx.fillRect(cx - 1.4, H * 0.30, 2.8, H * 0.18); // nasal bar
      } else if (fam.hat === 'brim') {
        ctx.beginPath(); ctx.ellipse(cx, H * 0.30, W * 0.30, H * 0.05, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(cx - W * 0.12, H * 0.18, W * 0.24, H * 0.13);
      } else if (fam.hat === 'toque') {
        ctx.fillStyle = portraitShade(base, 78);
        ctx.fillRect(cx - W * 0.15, H * 0.20, W * 0.30, H * 0.12);
        ctx.beginPath(); ctx.ellipse(cx, H * 0.20, W * 0.16, H * 0.08, 0, 0, Math.PI * 2); ctx.fill();
      } else if (fam.hat === 'cap') {
        ctx.beginPath(); ctx.ellipse(cx, H * 0.32, W * 0.18, H * 0.10, 0, Math.PI, 0); ctx.fill();
        ctx.fillRect(cx - W * 0.20, H * 0.31, W * 0.30, H * 0.03);
      } else {
        // bare head: hair
        ctx.beginPath(); ctx.ellipse(cx, H * 0.34, W * 0.17, H * 0.11, 0, Math.PI, 0); ctx.fill();
      }
    }

    // Role badge: the authored glyph.
    if (p.glyph) {
      ctx.fillStyle = 'rgba(12,9,7,.78)';
      ctx.beginPath(); ctx.arc(W - 12, H - 12, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = portraitShade(base, 40); ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = portraitShade(base, 70);
      ctx.font = '600 10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(p.glyph).slice(0, 1), W - 12, H - 11);
    }
    return true;
  }

  // V0.20.16 (Roadmap Item 16 - ambient behaviour): point a placed NPC in a direction.
  //
  // A placed NPC is a plain grid node, NOT an Entity - it has no setFacingFromDelta and starts with no
  // facingX/facingY at all. V0.20.15's patrol called `npc.setFacingFromDelta?.(...)` and the optional
  // chain swallowed it in silence for a whole version, so the two patrollers walked without turning.
  // The renderer reads facingX/facingY straight off the node (entity-renderer standingDirectionProfile),
  // so these are the fields to set, and setting them is all it takes.
  //
  // Normalised, and a zero delta is IGNORED rather than written: facing (0,0) is not a direction, and
  // V0.19.7 spent a version on what happens when a facing vector is quietly wrong.
  function faceNodeToward(node, dx, dy) {
    if (!node) return false;
    const len = Math.hypot(Number(dx) || 0, Number(dy) || 0);
    if (!(len > 1e-6)) return false;
    node.facingX = dx / len;
    node.facingY = dy / len;
    return true;
  }

  function ensureNpcWindow(runtime) {
    let panel = document.getElementById('npcInteractionPanel');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'npcInteractionPanel';
    panel.className = 'panel gameWindow';
    panel.style.display = 'none';
    panel.style.left = '50%';
    panel.style.bottom = '26px';
    panel.style.top = 'auto';
    panel.style.right = 'auto';
    panel.style.transform = 'translateX(-50%)';
    panel.style.width = 'min(720px, calc(100vw - 28px))';
    panel.style.maxHeight = 'min(620px, calc(100vh - 96px))';
    panel.style.overflow = 'auto';
    panel.innerHTML = `
      <!-- V0.20.6 (Roadmap Item 5): the portrait is a flex child of the header, NOT an overlay - the
           spec requires it to be part of the window layout, and this way the name/role text can never
           be overlapped by it because they are siblings that share the row. -->
      <div class="windowHeader" style="align-items:center; gap:12px">
        <canvas data-npc-portrait width="72" height="72"
                style="width:72px; height:72px; flex:0 0 auto; border-radius:8px; border:1px solid rgba(170,134,85,.45); background:#120d0a"
                aria-hidden="true"></canvas>
        <div style="flex:1 1 auto; min-width:0">
          <div class="name" data-npc-title>NPC</div>
          <div class="small" data-npc-subtitle>Runtime NPC</div>
        </div>
        <button data-npc-close>Close</button>
      </div>
      <!-- V0.20.7 (Roadmap Item 5): spoken dialogue is now visually a QUOTE - warm, italic, behind a
           speaker's rule - so it reads as a person talking rather than a system message. The spec asks
           for a "clear visual distinction between spoken dialogue and objective summaries"; the two are
           now different objects, not one blob of text. -->
      <div data-npc-body class="small"
           style="font-size:14px; line-height:1.6; color:#f7ead1; font-style:italic;
                  border-left:2px solid rgba(210,156,255,.5); padding:2px 0 2px 12px; margin-top:10px"></div>
      <div data-npc-objectives></div>
      <div data-npc-actions style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px"></div>
    `;
    if (!document.getElementById('botRecruiterStyle')) {
      const style = document.createElement('style');
      style.id = 'botRecruiterStyle';
      style.textContent = `.botRecruitPanel{width:100%;margin-top:8px;border:1px solid rgba(120,180,255,.28);border-radius:10px;background:rgba(10,16,28,.62);padding:10px}.botRecruitGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px;margin-top:8px}.botRecruitCard{display:grid;grid-template-columns:34px 1fr auto;gap:8px;align-items:center;padding:8px;border:1px solid rgba(180,210,255,.18);border-radius:9px;background:rgba(255,255,255,.045)}.botRecruitCard.inParty{border-color:rgba(108,188,255,.48);background:rgba(70,130,220,.12)}.botRecruitIcon{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:rgba(70,130,220,.24);border:1px solid rgba(120,190,255,.45)}.botRecruitInfo{display:flex;flex-direction:column;gap:2px;min-width:0}.botRecruitInfo span,.botRecruitInfo small,.botRecruitInfo em{font-size:11px;color:#cdd9ee}.botRecruitInfo small{color:#aebbd1}.botRecruitInfo em{font-style:normal;color:#8fb8ff}.botRecruitCard button{white-space:nowrap}.mercHiringPanel{width:100%;margin-top:8px;border:1px solid rgba(218,185,120,.35);border-radius:12px;background:linear-gradient(180deg,rgba(39,28,18,.72),rgba(11,14,10,.72));padding:12px}.mercHiringIntro{margin-bottom:10px;color:#f7ead1}.mercHiringMeta{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0 10px;color:#d8c8aa}.mercHiringGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px}.mercHireCard{display:grid;grid-template-columns:40px 1fr auto;gap:10px;align-items:center;padding:10px;border:1px solid rgba(215,190,130,.24);border-radius:10px;background:rgba(255,240,190,.055)}.mercHireCard.active{border-color:rgba(194,236,158,.55);background:rgba(108,148,72,.16)}.mercHireIcon{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(235,210,150,.55);background:rgba(68,45,22,.62);font-size:20px}.mercHireInfo{display:flex;flex-direction:column;gap:2px;min-width:0}.mercHireInfo strong{color:#fff2cf}.mercHireInfo span,.mercHireInfo small{font-size:11px;color:#d9caaa}.mercHireCard button{white-space:nowrap}.mercHireDisabled{opacity:.58}`;
      document.head.appendChild(style);
    }
    document.body.appendChild(panel);
    panel.querySelector('[data-npc-close]')?.addEventListener('click', () => runtime.closeNpcWindow());
    panel.addEventListener('click', event => {
      const button = event.target.closest('button[data-npc-action]');
      if (!button) return;
      runtime.handleNpcAction(button.dataset.npcAction);
    });
    return panel;
  }

  function ensureTrainerWindow(runtime) {
    let panel = document.getElementById('npcTrainerPanel');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'npcTrainerPanel';
    panel.className = 'panel gameWindow';
    panel.style.display = 'none';
    panel.style.right = '284px';
    panel.style.top = '84px';
    panel.style.width = 'min(560px, calc(100vw - 26px))';
    panel.style.maxHeight = 'min(680px, calc(100vh - 118px))';
    panel.style.overflow = 'auto';
    panel.innerHTML = `
      <div class="windowHeader">
        <div>
          <div class="name" data-trainer-title>Trainer</div>
          <div class="small" data-trainer-subtitle>Class Training</div>
        </div>
        <button data-trainer-close>Close</button>
      </div>
      <div class="small" data-trainer-meta></div>
      <div data-trainer-body></div>
    `;
    if (!document.getElementById('botRecruiterStyle')) {
      const style = document.createElement('style');
      style.id = 'botRecruiterStyle';
      style.textContent = `.botRecruitPanel{width:100%;margin-top:8px;border:1px solid rgba(120,180,255,.28);border-radius:10px;background:rgba(10,16,28,.62);padding:10px}.botRecruitGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px;margin-top:8px}.botRecruitCard{display:grid;grid-template-columns:34px 1fr auto;gap:8px;align-items:center;padding:8px;border:1px solid rgba(180,210,255,.18);border-radius:9px;background:rgba(255,255,255,.045)}.botRecruitCard.inParty{border-color:rgba(108,188,255,.48);background:rgba(70,130,220,.12)}.botRecruitIcon{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:rgba(70,130,220,.24);border:1px solid rgba(120,190,255,.45)}.botRecruitInfo{display:flex;flex-direction:column;gap:2px;min-width:0}.botRecruitInfo span,.botRecruitInfo small,.botRecruitInfo em{font-size:11px;color:#cdd9ee}.botRecruitInfo small{color:#aebbd1}.botRecruitInfo em{font-style:normal;color:#8fb8ff}.botRecruitCard button{white-space:nowrap}.mercHiringPanel{width:100%;margin-top:8px;border:1px solid rgba(218,185,120,.35);border-radius:12px;background:linear-gradient(180deg,rgba(39,28,18,.72),rgba(11,14,10,.72));padding:12px}.mercHiringIntro{margin-bottom:10px;color:#f7ead1}.mercHiringMeta{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0 10px;color:#d8c8aa}.mercHiringGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px}.mercHireCard{display:grid;grid-template-columns:40px 1fr auto;gap:10px;align-items:center;padding:10px;border:1px solid rgba(215,190,130,.24);border-radius:10px;background:rgba(255,240,190,.055)}.mercHireCard.active{border-color:rgba(194,236,158,.55);background:rgba(108,148,72,.16)}.mercHireIcon{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(235,210,150,.55);background:rgba(68,45,22,.62);font-size:20px}.mercHireInfo{display:flex;flex-direction:column;gap:2px;min-width:0}.mercHireInfo strong{color:#fff2cf}.mercHireInfo span,.mercHireInfo small{font-size:11px;color:#d9caaa}.mercHireCard button{white-space:nowrap}.mercHireDisabled{opacity:.58}`;
      document.head.appendChild(style);
    }
    document.body.appendChild(panel);
    panel.querySelector('[data-trainer-close]')?.addEventListener('click', () => runtime.closeTrainer());
    panel.addEventListener('click', event => {
      const button = event.target.closest('button[data-train-rank]');
      if (!button) return;
      runtime.trainClassRank();
    });
    return panel;
  }

  function questButtonText(game, npc) {
    if (!game.questSystem || !Array.isArray(npc.questIds) || !npc.questIds.length) return null;
    const source = { type: 'npc', name: npc.name || 'Quest NPC', questIds: npc.questIds, node: npc };
    const pick = game.questSystem.chooseQuestFromSource?.(source);
    if (!pick) return 'Quest';
    const quest = game.questSystem.questById?.(pick.id) || game.editorQuests?.[pick.id] || DR.QUEST_BY_ID?.[pick.id];
    const name = quest?.name || pick.id;
    if (pick.mode === 'complete') return `Complete: ${name}`;
    if (pick.mode === 'accept') return `Accept: ${name}`;
    if (pick.mode === 'progress') return `Quest Progress: ${name}`;
    return `Quest: ${name}`;
  }

  // V0.17.92: which quest-marker to float above an NPC.
  //   'accept'   -> a quest is available to take   (gold !)
  //   'complete' -> a quest is ready to turn in     (gold ?)
  //   'progress' -> a quest is in progress here      (silver ?)
  //   null       -> locked / none / already done     (no marker)
  function questMarkerMode(game, npc) {
    if (!game.questSystem || !Array.isArray(npc.questIds) || !npc.questIds.length) return null;
    const pick = game.questSystem.chooseQuestFromSource?.({ type: 'npc', name: npc.name || 'Quest NPC', questIds: npc.questIds, node: npc });
    if (!pick) return null;
    if (pick.mode === 'complete') return 'complete';
    if (pick.mode === 'accept') return 'accept';
    if (pick.mode === 'progress') return 'progress';
    return null;
  }

  // A large, bobbing, softly-glowing "!"/"?" marker floating over the NPC.
  function drawAnimatedQuestMarker(context, cx, baseY, mode, close, nowMs) {
    const bob = Math.sin(nowMs * 0.005) * 3.4;
    const pulse = 0.5 + 0.5 * Math.sin(nowMs * 0.006);
    const y = baseY + bob;
    const isGold = mode !== 'progress';
    const glyph = mode === 'accept' ? '!' : '?';
    const fill = isGold ? '#ffcf3f' : '#c9d2dc';
    const shade = isGold ? '#8a5a12' : '#3d4a58';
    const size = close ? 27 : 22;
    context.save();
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.globalAlpha = close ? 1 : 0.9;
    // soft radial glow (screen-blended halo)
    context.globalCompositeOperation = 'screen';
    const gr = context.createRadialGradient(cx, y, 1, cx, y, size);
    gr.addColorStop(0, isGold ? `rgba(255,206,80,${0.32 + 0.24 * pulse})` : `rgba(200,214,230,${0.22 + 0.16 * pulse})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gr;
    context.beginPath();
    context.arc(cx, y, size, 0, Math.PI * 2);
    context.fill();
    context.globalCompositeOperation = 'source-over';
    // glyph: dark outline, a drop shade, then the bright face
    context.font = `900 ${size}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
    context.lineJoin = 'round';
    context.lineWidth = Math.max(3, size * 0.24);
    context.strokeStyle = 'rgba(6,9,7,0.94)';
    context.strokeText(glyph, cx, y);
    context.fillStyle = shade;
    context.fillText(glyph, cx, y + 1.4);
    context.fillStyle = fill;
    context.fillText(glyph, cx, y);
    context.restore();
  }


  function botRecruiterPanelHtml(game) {
    if (!game?.getBotRecruitmentOptions) return '';
    const options = game.getBotRecruitmentOptions() || [];
    const count = game.currentBotPartyCount?.() || 0;
    const max = game.botPartyMaxBotSlots?.() ?? 5;
    const partyMax = game.partyMaxSize?.() || 6;
    const partyCount = game.partyCapacityCount?.() || (count + 1);
    const cards = options.map(opt => {
      const disabled = opt.inParty || !opt.canHire;
      const action = opt.inParty && opt.existingBotId ? `dismiss-bot:${escapeHtml(opt.existingBotId)}` : `hire-bot:${escapeHtml(opt.key)}`;
      const buttonText = opt.inParty ? 'Dismiss' : 'Recruit';
      const disabledAttr = (!opt.inParty && disabled) ? ' disabled' : '';
      const reason = opt.inParty ? 'Currently in party.' : (opt.disabledReason || 'Available.');
      return `<div class="botRecruitCard ${opt.inParty ? 'inParty' : ''}">
        <div class="botRecruitIcon">${escapeHtml(opt.icon || '●')}</div>
        <div class="botRecruitInfo"><strong>${escapeHtml(opt.className)}</strong><span>${escapeHtml(opt.roleLabel || opt.role || 'Companion')} · Range ${Number(opt.preferredRange || 1).toFixed(1)}</span><small>${escapeHtml(opt.desc || '')}</small><em>${escapeHtml(reason)}</em></div>
        <button data-npc-action="${action}"${disabledAttr}>${escapeHtml(buttonText)}</button>
      </div>`;
    }).join('');
    return `<div class="botRecruitPanel">
      <div class="sheetPanelTitle">Class Bot Contracts</div>
      <div class="small">Party slots: ${partyCount}/${partyMax}. Bot slots available: ${count}/${max}. Recruit AI companions by class, then manage stance from the bot HUD or party panel.</div>
      <div class="botRecruitGrid">${cards}</div>
    </div>`;
  }

  function trainingRank(runtime, className) {
    return Math.max(0, Math.floor(safeNumber(runtime.state.classTraining?.[className]?.rank, 0)));
  }

  function trainingCost(rank) {
    return 25 + rank * 20;
  }

  function classTrainingBonuses(rank, player) {
    const hasMana = (player?.baseMaxMana || player?.maxMana || 0) > 0;
    return {
      hp: rank * 6,
      mana: hasMana ? rank * 4 : 0,
      attack: Math.floor(rank / 2),
      defense: Math.floor(rank / 3),
      speed: 0
    };
  }

  const REMOVED_CAMP_NPC_IDS = new Set([
    'npc_merc_recruiter'
  ]);

  const TRAINER_GIVEN_NAMES = Object.freeze({
    Paladin: ['Aurel', 'Gareth', 'Ser Caldan', 'Maeron'],
    Warden: ['Bram', 'Irowen', 'Cael', 'Thorn'],
    Fighter: ['Corven', 'Garrick', 'Dane', 'Rowan'],
    Cleric: ['Maelle', 'Elowen', 'Seren', 'Alda'],
    Rogue: ['Vexa', 'Keir', 'Nessa', 'Shade'],
    Ranger: ['Rowan', 'Thorne', 'Iven', 'Kestrel'],
    Assassin: ['Nyx', 'Sable', 'Kairn', 'Velis'],
    Wizard: ['Althos', 'Merion', 'Vaelin', 'Edrin'],
    Shaman: ['Korr', 'Mara', 'Tavik', 'Syla'],
    Summoner: ['Ilyr', 'Aelric', 'Nemea', 'Soren'],
    Necromancer: ['Orren', 'Varric', 'Malven', 'Nyra'],
    Druid: ['Dylan', 'Thalen', 'Mira', 'Bryn'],
    Enchanter: ['Selene', 'Liora', 'Vael', 'Maris'],
    Bard: ['Lyric', 'Tamsin', 'Bren', 'Edda']
  });

  function isTrainerNpc(npc) {
    return !!(npc && (npc.trainerClass || npc.role === 'class_trainer'));
  }

  function trainerClassFor(npc) {
    const raw = String(npc?.trainerClass || npc?.className || npc?.playerClass || npc?.classId || '').trim();
    const lower = raw.toLowerCase();
    const canonical = ['Paladin','Warden','Fighter','Rogue','Ranger','Assassin','Wizard','Shaman','Summoner','Necromancer','Cleric','Druid','Bard','Enchanter'];
    return canonical.find(name => name.toLowerCase() === lower) || raw || 'Class';
  }

  function stableHash(text) {
    let h = 2166136261;
    const s = String(text || 'trainer');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function trainerDisplayName(npc) {
    const trainerClass = trainerClassFor(npc);
    const names = TRAINER_GIVEN_NAMES[trainerClass] || ['Aren', 'Dalen', 'Kara', 'Miren'];
    const first = names[stableHash(npc?.id || npc?.npcId || trainerClass) % names.length];
    return `${trainerClass} Master ${first}`;
  }

  function drawTrainerClassEmblem(context, className, x, y, size = 12) {
    const DR = window.DreamRealms || {};
    const meta = DR.classEmblemMeta?.(className) || null;
    const img = DR.classEmblemImage;
    context.save();
    context.fillStyle = 'rgba(0,0,0,0.72)';
    context.beginPath();
    context.arc(x, y, size * 0.72, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(218,236,214,0.70)';
    context.lineWidth = 0.85;
    context.stroke();
    if (img?.complete && img.naturalWidth && meta) {
      const cellW = img.naturalWidth / Math.max(1, Number(DR.classEmblemColumns || 7));
      const cellH = img.naturalHeight / Math.max(1, Number(DR.classEmblemRows || 2));
      context.save();
      context.beginPath();
      context.arc(x, y, size * 0.60, 0, Math.PI * 2);
      context.clip();
      context.drawImage(img, meta.col * cellW, meta.row * cellH, cellW, cellH, x - size * 0.58, y - size * 0.58, size * 1.16, size * 1.16);
      context.restore();
    } else {
      context.fillStyle = '#e9ffe8';
      context.font = `${Math.max(9, size * 0.82)}px Georgia, serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(meta?.fallback || String(className || 'T').charAt(0).toUpperCase(), x, y + 0.5);
    }
    context.restore();
  }

  function drawTrainerNameplate(context, npc, s, anchorY) {
    if (!isTrainerNpc(npc)) return;
    const trainerClass = trainerClassFor(npc);
    const label = trainerDisplayName(npc);
    context.save();
    context.font = '11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    const textW = context.measureText(label).width;
    const emblemSize = 13;
    const iconGap = 8;
    const groupW = emblemSize + iconGap + textW;
    const w = Math.max(92, Math.ceil(groupW + 24));
    const h = 24;
    const x0 = Math.round(s.x - w / 2);
    const y0 = Math.round(anchorY - 64);
    context.shadowColor = 'rgba(0,0,0,0.52)';
    context.shadowBlur = 4;
    context.fillStyle = 'rgba(4,16,12,0.88)';
    context.strokeStyle = 'rgba(218,238,197,0.78)';
    context.lineWidth = 1.2;
    context.beginPath();
    if (typeof context.roundRect === 'function') context.roundRect(x0, y0, w, h, 6);
    else {
      context.moveTo(x0 + 6, y0); context.lineTo(x0 + w - 6, y0); context.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + 6); context.lineTo(x0 + w, y0 + h - 6); context.quadraticCurveTo(x0 + w, y0 + h, x0 + w - 6, y0 + h); context.lineTo(x0 + 6, y0 + h); context.quadraticCurveTo(x0, y0 + h, x0, y0 + h - 6); context.lineTo(x0, y0 + 6); context.quadraticCurveTo(x0, y0, x0 + 6, y0);
    }
    context.fill();
    context.shadowBlur = 0;
    context.stroke();
    const groupX = Math.round(s.x - groupW / 2);
    const emblemX = groupX + emblemSize * 0.5;
    const textX = groupX + emblemSize + iconGap;
    drawTrainerClassEmblem(context, trainerClass, emblemX, y0 + h / 2, emblemSize);
    context.fillStyle = '#f2ffe8';
    context.textAlign = 'left';
    context.fillText(label, textX, y0 + 15.5);
    context.restore();
  }

  function describeBonuses(bonus) {
    const parts = [];
    if (bonus.hp) parts.push(`+${bonus.hp} HP`);
    if (bonus.mana) parts.push(`+${bonus.mana} MP`);
    if (bonus.attack) parts.push(`+${bonus.attack} ATK`);
    if (bonus.defense) parts.push(`+${bonus.defense} DEF`);
    return parts.join(' · ') || 'No bonus yet';
  }

  window.registerDreamRealmsSystem({
    id: 'npcRuntime',
    name: 'Runtime NPC Interaction',

    install(game) {
      const runtime = {
        id: 'npcRuntime',
        name: 'Runtime NPC Interaction',
        game,
        state: normalizeState(game.pendingNpcRuntimeState || readLocalState()),
        panel: ensurePanel(),
        npcPanel: null,
        trainerPanel: null,
        activeNpc: null,
        nearbyNpc: null,
        statusTick: 0,

        init() {
          game.npcSystem = this;
          game.npcRuntimeState = this.state;
          this.ensureDefaultNpcPlacements();
          this.pruneCampNpcRoster();
          this.applyTrainingBonuses();
          this.bindInput();
          this.refreshPanel();
        },

        bindInput() {
          if (this.inputBound) return;
          this.inputBound = true;
          window.addEventListener('keydown', event => {
            if (isTypingTarget(event) || event.repeat) return;
            if (!(game.isActionKey ? game.isActionKey(event, 'interact') : String(event.key || '').toLowerCase() === 'e')) return;
            if (!game.started || game.paused || !game.player || !game.player.alive) return;
            const node = this.findNearbyNpc();
            if (!node) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            this.interactWithNpc(node);
          });
        },

        serializeState() {
          return cloneJson(this.state);
        },

        importState(raw) {
          this.state = normalizeState(raw || defaultState());
          game.npcRuntimeState = this.state;
          this.applyTrainingBonuses();
          this.saveState();
          this.refreshPanel();
        },

        saveState() {
          game.npcRuntimeState = this.state;
          writeLocalState(this.state);
          if (game.worldSaveDirty !== undefined) game.worldSaveDirty = true;
        },

        onGameEvent(eventName) {
          if (eventName === 'player-started') {
            this.state = normalizeState(game.pendingNpcRuntimeState || this.state || readLocalState());
            this.ensureDefaultNpcPlacements();
            this.pruneCampNpcRoster();
            this.normalizeTownNpcPlacements();
            this.applyTrainingBonuses();
            this.saveState();
            this.refreshPanel();
          }
        },

        pruneCampNpcRoster() {
          const zone = game.editorNpcs?.dark_woods;
          if (!zone || typeof zone !== 'object') return false;
          let changed = false;
          for (const [key, node] of Object.entries(zone)) {
            if (!node) continue;
            const npcId = node.npcId || node.id || '';
            const def = npcDef(game, node) || {};
            const role = String(def.role || node.role || '').toLowerCase();
            const name = String(def.name || node.name || '').toLowerCase();
            const inCamp = Math.hypot((safeNumber(node.x, 100) - 100) / 1.35, safeNumber(node.y, 100) - 100) <= 24;
            const explicitlyRemoved = REMOVED_CAMP_NPC_IDS.has(npcId);
            const nonEssentialCampService = inCamp && (
              role === 'merc_recruiter' || /contract captain/.test(name)
            );
            if (explicitlyRemoved || nonEssentialCampService) {
              delete zone[key];
              changed = true;
            }
          }
          if (changed) {
            if (game.worldSaveDirty !== undefined) game.worldSaveDirty = true;
            this.saveState?.();
          }
          return changed;
        },

        ensureDefaultNpcPlacements() {
          if (!game.editorNpcs || typeof game.editorNpcs !== 'object') game.editorNpcs = { dark_woods: {}, mossfang_cave: {} };
          if (!game.editorNpcs.dark_woods) game.editorNpcs.dark_woods = {};
          if (!game.editorNpcs.mossfang_cave) game.editorNpcs.mossfang_cave = {};

          let changed = false;
          const hasNpc = (zone, npcId) => Object.values(game.editorNpcs?.[zone] || {}).some(node => (node?.npcId || node?.id) === npcId);
          for (const placement of DEFAULT_NPC_PLACEMENTS) {
            if (hasNpc(placement.zone, placement.npcId)) continue;
            const def = npcDef(game, placement.npcId);
            if (!def) continue;
            let key = `${placement.x},${placement.y}`;
            let x = placement.x;
            let y = placement.y;
            // Saved worlds can already contain an older NPC at the intended coordinate. Preserve it and slide the new required NPC nearby.
            if (game.editorNpcs[placement.zone][key]) {
              let found = false;
              for (let radius = 1; radius <= 3 && !found; radius++) {
                for (let oy = -radius; oy <= radius && !found; oy++) {
                  for (let ox = -radius; ox <= radius && !found; ox++) {
                    const nx = placement.x + ox;
                    const ny = placement.y + oy;
                    const candidateKey = `${nx},${ny}`;
                    if (!game.editorNpcs[placement.zone][candidateKey]) {
                      x = nx; y = ny; key = candidateKey; found = true;
                    }
                  }
                }
              }
            }
            game.editorNpcs[placement.zone][key] = {
              type: 'npc',
              npcId: def.id,
              id: def.id,
              name: def.name,
              role: def.role || 'npc',
              faction: def.faction || '',
              level: def.level || 1,
              species: def.species || def.race || 'human',
              race: def.race || def.species || 'human',
              npcRole: def.npcRole || def.visualRole || def.role || 'villager',
              x,
              y,
              dialogueId: def.dialogueId || null,
              questIds: Array.isArray(def.questIds) ? cloneJson(def.questIds) : [],
              shopId: def.shopId || null,
              trainerClass: def.trainerClass || null,
              vendorTags: Array.isArray(def.vendorTags) ? cloneJson(def.vendorTags) : [],
              interactionRange: def.interactionRange || 2.2,
              safeZoneRadius: def.safeZoneRadius || 0,
              color: def.color || '#ffd875',
              label: def.label || 'N',
              visualRole: def.visualRole || null,
              rendererId: def.rendererId || 'classModelNpc',
              className: def.className || def.playerClass || def.classId || npcClassModelFor(def),
              playerClass: def.playerClass || def.className || def.classId || npcClassModelFor(def),
              classId: def.classId || def.className || def.playerClass || npcClassModelFor(def),
              visualScale: def.visualScale || 1.0,
              usePlayerClassModelBase: def.trainerClass ? undefined : true,
              autoSeeded: true
            };
            changed = true;
          }
          if (changed) game.worldSaveDirty = true;
          return changed;
        },


        normalizeTownNpcPlacements() {
          const zone = game.editorNpcs?.dark_woods;
          if (!zone || typeof zone !== 'object') return false;
          let changed = false;
          const occupied = new Map(Object.entries(zone).map(([key, node]) => [node?.npcId || node?.id || key, { key, node }]));
          for (const [npcId, target] of Object.entries(CAMP_NPC_LAYOUT)) {
            const hit = occupied.get(npcId);
            if (!hit?.node) continue;
            const node = hit.node;
            const currentX = Math.floor(safeNumber(node.x, NaN));
            const currentY = Math.floor(safeNumber(node.y, NaN));
            const wrongTile = currentX !== target.x || currentY !== target.y;
            const oldPackedTrainerRow = String(npcId).includes('trainer') && currentY >= 100 && currentY <= 103 && currentX >= 91 && currentX <= 111; // migrate older packed trainer row saves into V0.15.49 compact ring
            if (!wrongTile && !oldPackedTrainerRow) continue;
            const oldKey = hit.key;
            const newKey = `${target.x},${target.y}`;
            const occupant = zone[newKey];
            if (occupant && (occupant.npcId || occupant.id) !== npcId) {
              let moved = false;
              for (let radius = 1; radius <= 4 && !moved; radius++) {
                for (let oy = -radius; oy <= radius && !moved; oy++) {
                  for (let ox = -radius; ox <= radius && !moved; ox++) {
                    const nx = target.x + ox;
                    const ny = target.y + oy;
                    const candidate = `${nx},${ny}`;
                    if (!zone[candidate]) {
                      occupant.x = nx;
                      occupant.y = ny;
                      zone[candidate] = occupant;
                      delete zone[newKey];
                      moved = true;
                    }
                  }
                }
              }
              if (!moved) continue;
            }
            if (oldKey !== newKey) delete zone[oldKey];
            node.x = target.x;
            node.y = target.y;
            zone[newKey] = node;
            changed = true;
          }
          if (changed) {
            if (game.worldSaveDirty !== undefined) game.worldSaveDirty = true;
            this.saveState?.();
          }
          return changed;
        },

        placeDungeonEntranceNpcs(dungeonId, floor, entrance, checkpoint) {
          if (String(dungeonId) !== 'silk_web_cavern' || Number(floor) !== 1 || !checkpoint) return [];
          const zone = `${dungeonId}_floor1`;
          if (!game.editorNpcs || typeof game.editorNpcs !== 'object') game.editorNpcs = {};
          if (!game.editorNpcs[zone] || typeof game.editorNpcs[zone] !== 'object') game.editorNpcs[zone] = {};
          const grid = game.editorNpcs[zone];
          const dungeon = DR.DUNGEON_BY_ID?.[dungeonId] || null;
          const specs = [
            ...(dungeon?.questGiverCluster || []).map(spec => ({ ...spec, kind: 'quest' })),
            ...(dungeon?.spiritHealer ? [{ ...dungeon.spiritHealer, kind: 'spirit' }] : [])
          ];
          const placed = [];
          for (const spec of specs) {
            const def = npcDef(game, spec.npcId);
            if (!def) continue;
            for (const [key, node] of Object.entries(grid)) if ((node?.npcId || node?.id) === spec.npcId) delete grid[key];
            const intendedX = checkpoint.x + spec.offsetX;
            const intendedY = checkpoint.y + spec.offsetY;
            const position = game.dungeonSystem?.findActorPlacementNear?.(intendedX, intendedY, { radius: 8, actorId: spec.npcId, minActorSpacing: 1.25 });
            if (!position) continue;
            game.dungeonSystem?.reserveActorPlacement?.(position);
            const x = Math.floor(position.x);
            const y = Math.floor(position.y);
            grid[`${x},${y}`] = {
              type: 'npc', npcId: def.id, id: def.id, name: def.name, role: def.role || 'npc', faction: def.faction || '',
              level: def.level || 1, species: def.species || def.race || 'human', race: def.race || def.species || 'human',
              npcRole: def.npcRole || def.visualRole || def.role || 'villager', x, y, dialogueId: def.dialogueId || null,
              questIds: Array.isArray(def.questIds) ? cloneJson(def.questIds) : [], shopId: def.shopId || null,
              trainerClass: def.trainerClass || null, vendorTags: Array.isArray(def.vendorTags) ? cloneJson(def.vendorTags) : [],
              interactionRange: def.interactionRange || 2.2, safeZoneRadius: def.safeZoneRadius || 0,
              color: def.color || '#ffd875', label: def.label || 'N', visualRole: def.visualRole || null,
              rendererId: def.rendererId || null, dungeonId, floor: 1, entranceStaging: true, autoSeeded: true
            };
            placed.push({ ...spec, x: position.x, y: position.y });
          }
          if (game.dungeonEntranceStaging) {
            game.dungeonEntranceStaging.questGivers = placed.filter(entry => entry.kind === 'quest');
            game.dungeonEntranceStaging.spiritHealer = placed.find(entry => entry.kind === 'spirit') || null;
            if (game.dungeonEntranceStaging.spiritHealer) game.dungeonEntranceStaging.spiritHealer.respawnCheckpoint = { ...checkpoint };
          }
          game.worldSaveDirty = true;
          return placed;
        },

        currentGrid() {
          return currentNpcGrid(game);
        },

        allNpcs() {
          return allNpcNodes(game);
        },

        findNearbyNpc(range = 2.65) {
          let best = null;
          let bestD = range;
          for (const node of this.allNpcs()) {
            if (node._asleep) continue; // V0.20.44: cannot talk to someone asleep in a tent
            const npc = mergedNpc(game, node);
            const d = distanceToPlayer(game, node);
            const allowed = safeNumber(npc.interactionRange, range);
            if (d <= allowed && d < bestD) {
              best = node;
              bestD = d;
            }
          }
          return best;
        },

        findNpcAtWorld(point, options = {}) {
          if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return null;
          const maxDistance = Math.max(0.55, safeNumber(options.maxDistance, 1.15));
          let best = null;
          let bestD = maxDistance;
          for (const node of this.allNpcs()) {
            if (node._asleep) continue; // V0.20.44: a sleeping NPC is not a click target
            const npc = mergedNpc(game, node);
            const x = safeNumber(node.x, NaN) + 0.5;
            const y = safeNumber(node.y, NaN) + 0.5;
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            const d = Math.hypot(x - Number(point.x), y - Number(point.y));
            const hitRadius = Math.max(maxDistance, Math.min(1.35, safeNumber(npc.interactionRange, 2.2) * 0.48));
            if (d <= hitRadius && d < bestD) {
              best = node;
              bestD = d;
            }
          }
          return best;
        },

        contextActionsAtWorld(point) {
          const node = point?.npc || this.findNpcAtWorld(point, { maxDistance: 1.25 });
          if (!node) return [];
          const npc = mergedNpc(game, node);
          const role = String(npc.role || npc.type || '').toLowerCase();
          const name = npc.name || npc.id || 'NPC';
          const label = role.includes('trainer') ? `Talk / Train with ${name}`
            : role.includes('merchant') || role.includes('vendor') || npc.shopId ? `Trade with ${name}`
            : `Talk to ${name}`;
          return [{
            title: name,
            label,
            run: () => this.interactWithNpc(node)
          }];
        },

        update(dt) {
          if (!this.panel) this.panel = ensurePanel();
          this.closeOpenNpcWindowsIfInvalid?.();
          this.updateNpcPatrols?.(dt);
          this.statusTick -= dt;
          if (this.statusTick <= 0) {
            this.statusTick = 0.2;
            this.nearbyNpc = this.findNearbyNpc();
            this.refreshPanel();
          }
        },

        // V0.20.15 (Roadmap Item 16 - NPC schedules and ambient behaviour).
        //
        // Every NPC in data/npcs.js authors `patrol: { mode, radius, speed }`. Nothing has ever read it
        // for behaviour - editor-system only COPIES it, and dungeon-system reads `encounter.patrol`, a
        // different object entirely (which is why the dead-field scanner never flagged it: the scan is
        // name-based, not type-aware).
        //
        // The field splits into two of the three kinds at once: 31 NPCs say mode 'stationary', which is
        // exactly what they already do - EMPTY, describing the default. TWO say 'short_loop' with a
        // radius and a speed, and have stood perfectly still since they were written - BROKEN. This
        // moves those two, and only those two: the data asked, so the data gets what it asked for.
        //
        // ITEM 16'S SAFETY RULES, each honoured explicitly rather than hoped for:
        //   "NPCs must not overlap"                    -> a step onto an occupied tile is refused
        //   "must respect collision"                   -> isWalkable gates every step
        //   "must not block portals, exits, or paths"  -> movement is bounded to the authored radius
        //                                                 around HOME, so an NPC can never wander into
        //                                                 a doorway it did not start in
        //   "critical quest NPCs must never become inaccessible" -> Road Warden Cael carries SIX quests
        //                                                 and a radius of 2; he orbits his own post and
        //                                                 cannot leave it
        //   "dialogue interaction should pause movement safely" -> the active NPC holds still
        //   "must recover if an NPC becomes stuck"     -> position is derived, never accumulated, so a
        //                                                 blocked step is simply skipped and the next
        //                                                 angle is tried - there is no stuck state to
        //                                                 recover FROM
        //   "deterministic and save-compatible"        -> the angle is a pure function of the clock and
        //                                                 the NPC's own id. No patrol state is stored,
        //                                                 so there is nothing to save, migrate, or
        //                                                 desync. A reload resumes mid-stride.
        // V0.20.44: shared eased step. Moves npc one frame toward (tx,ty), refusing the step if it is
        // unwalkable, would overlap another AWAKE npc, or would stand on the player. Advances walkCycle on
        // a real step. Returns true if it moved. faceNodeToward sets facingX/facingY, which the renderer
        // reads. NOTE: moveBlend (the walk/idle animation driver) is NOT touched here - the caller sets it
        // from the NPC's STATE (walking vs paused), so a blocked frame in a crowded camp does not drop the
        // gait to idle; the NPC keeps walking-in-place against the crowd, which reads far better than the
        // freeze-and-slide it replaced.
        _stepNpcToward(npc, tx, ty, dt, nodes, speedMul = 1) {
          const dist = Math.hypot(tx - npc.x, ty - npc.y);
          if (dist < 0.04) return false;
          const step = Math.min(1, dt * 2.2 * speedMul);
          const nx = npc.x + (tx - npc.x) * step;
          const ny = npc.y + (ty - npc.y) * step;
          if (game.isWalkable && !game.isWalkable(nx, ny, npc)) return false;
          // V0.20.46 (perf): this was a hypot() against EVERY node for every moving NPC each frame -
          // an O(n^2) sqrt storm. Compare squared distances (no sqrt) behind a cheap axis reject, so
          // the overwhelming majority of pairs cost two subtractions and a compare.
          for (const other of nodes) {
            if (other === npc || other._asleep) continue;
            const ox = other.x - nx;
            if (ox > 0.62 || ox < -0.62) continue;
            const oy = other.y - ny;
            if (oy > 0.62 || oy < -0.62) continue;
            if (ox * ox + oy * oy < 0.3844) return false; // 0.62^2
          }
          const p = game.player;
          if (p && p.alive) {
            const px = p.x - nx, py = p.y - ny;
            if (px * px + py * py < 0.49) return false; // 0.7^2
          }
          faceNodeToward(npc, nx - npc.x, ny - npc.y);
          npc.x = nx; npc.y = ny;
          npc.walkCycle = (npc.walkCycle || 0) + dt * 8.5 * speedMul;
          return true;
        },

        // V0.20.44 (camp liveliness): every overworld camp NPC now has ambient life on top of the
        // walk/idle animation the atlas already supports. By DAY the camp bustles - each NPC strolls to a
        // point near its home post, pauses a beat, strolls on; essential NPCs (quest/trainer/vendor) keep
        // a tighter leash so they stay easy to find and man their station. At NIGHT almost everyone walks
        // to the nearest tent and turns in (rendered/hidden + not interactable while asleep); the ethereal
        // dream spirit keeps its vigil. Supersedes the V0.20.15 two-NPC clockwork orbit.
        //
        // Item 16 safety kept: bounded to home (never wanders off station or into a doorway it did not
        // start in), isWalkable-gated, refuses to overlap another npc or the player, holds still while
        // being talked to. All state is RUNTIME (_home*, _wt*, _asleep, _sleepTent): nothing to save,
        // migrate or desync - a reload re-derives sleep from the world clock and picks a fresh target.
        updateNpcPatrols(dt) {
          if (!game.started || game.paused) return;
          const nodes = this.allNpcs?.() || [];
          if (!nodes.length) return;
          const nowSec = Date.now() / 1000;

          // Night uses the same threshold the quest system reads, with hysteresis so dusk does not flicker
          // the whole camp in and out of bed at the boundary.
          const nightStrength = Number(game.getWorldLightState?.()?.nightStrength) || 0;
          const isNight = nightStrength > (this._campIsNight ? 0.52 : 0.62);
          this._campIsNight = isNight;
          ensureNpcShifts(nodes); // V0.20.62: balanced day/night split, recomputed only on roster change
          const onOverworld = game.currentZone === 'overworld';

          // Tent tiles (where NPCs sleep), gathered once from the placed camp objects.
          if (onOverworld && (!this._campTents || this._campTentsStamp !== (game.objects?.length || 0))) {
            this._campTents = [];
            const objs = game.objects || [];
            for (let y = 0; y < objs.length; y++) {
              const row = objs[y]; if (!row) continue;
              for (let x = 0; x < row.length; x++) {
                const o = row[x];
                if (o && (o.campObject || o.startingCamp) && (o.type === 'tent' || o.type === 'campLeanTo')) this._campTents.push({ x, y });
              }
            }
            this._campTentsStamp = game.objects?.length || 0;
          }
          const tents = this._campTents || [];
          const campX = Math.round(DR.CONFIG?.START_X || 100);
          const campY = Math.round(DR.CONFIG?.START_Y || 100);

          for (const npc of nodes) {
            if (!Number.isFinite(npc.x) || !Number.isFinite(npc.y)) continue;
            // Home post: anchored to the AUTHORED placement, not the current position, so a save taken
            // mid-wander cannot let the home drift on reload (Item 16: bounded to home / save-safe).
            if (!Number.isFinite(npc._homeX)) {
              const post = CAMP_NPC_LAYOUT[npc.npcId] || CAMP_NPC_LAYOUT[npc.id] || null;
              npc._homeX = post ? post.x : npc.x;
              npc._homeY = post ? post.y : npc.y;
            }
            // Only overworld camp NPCs get ambient life; cave/dungeon NPCs are left exactly as they were.
            if (!onOverworld) { npc._asleep = false; continue; }
            // Ambient life belongs to the CAMP. NPCs stationed out in the world (the bandit fence by the
            // ruin, the silk-web quartermaster at the cave mouth) keep their post - they must not march
            // across the map to a camp tent at dusk.
            const ethereal = npc.role === 'dream_spirit' || npc.rendererId === 'dreamSpirit' || npc.rendererId === 'spiritHealer' || npc.visualRole === 'spiritHealer';
            const talking = this.activeNpc === npc && this.npcPanel?.style?.display !== 'none';
            const offShift = npcIsOffShift(npc, isNight);
            const inCamp = Math.hypot(npc._homeX - campX, npc._homeY - campY) <= 20;

            // V0.20.62: NPCs stationed out in the world (the bandit fence by the ruin, the silk-web
            // quartermaster at the cave mouth) have no camp tent to walk to, and the ethereal spirit
            // healer never had one. They stand down where they are instead of marching across the map.
            if (!inCamp || ethereal || !tents.length) {
              npc._asleep = offShift;
              if (offShift) { npc.moveBlend = 0; continue; }
              if (!inCamp) continue; // keep their post, exactly as before
            }

            // --- OFF SHIFT: walk to the nearest tent and turn in. ---
            // Previously this was `isNight` - everyone slept at night. Now each NPC has a fixed shift,
            // so half the camp beds down at dusk and the other half at dawn.
            if (offShift && !ethereal && tents.length) {
              if (!npc._sleepTent) {
                let best = null, bd = Infinity;
                for (const t of tents) { const d = Math.hypot(t.x - npc._homeX, t.y - npc._homeY); if (d < bd) { bd = d; best = t; } }
                npc._sleepTent = best;
              }
              const t = npc._sleepTent;
              // Bed down when NEAR the tent, not on its exact tile - several NPCs share a tent, and once
              // asleep they are skipped by the overlap check, so they no longer jostle for the doorway.
              if (t && Math.hypot(t.x - npc.x, t.y - npc.y) <= 1.5) { npc._asleep = true; npc.moveBlend = 0; npc._offShiftSince = 0; continue; }
              // V0.20.62: an NPC that cannot REACH its tent (blocked path, crowded doorway, no tent at
              // all) used to stay awake indefinitely and show up in BOTH phases - measured: 2 of 28 did
              // exactly that. Stand down where it stands after a grace period rather than never.
              if (!npc._offShiftSince) npc._offShiftSince = nowSec;
              if (nowSec - npc._offShiftSince > 8) { npc._asleep = true; npc.moveBlend = 0; continue; }
              npc._asleep = false; // still walking to bed
              if (!talking && t) { npc.moveBlend = Math.min(1, (npc.moveBlend || 0) + dt * 3.5); this._stepNpcToward(npc, t.x, t.y, dt, nodes, 1.15); }
              else npc.moveBlend = Math.max(0, (npc.moveBlend || 0) - dt * 2.6);
              continue;
            }

            // --- ON SHIFT: awake and about. ---
            npc._asleep = false;
            npc._sleepTent = null;
            npc._offShiftSince = 0;
            if (talking) { npc.moveBlend = Math.max(0, (npc.moveBlend || 0) - dt * 2.6); continue; }

            const essential = !!(npc.trainerClass || npc.role === 'class_trainer' || npc.role === 'quest_giver' || npc.role === 'merchant' || npc.vendor || npc.shopId);
            const wanderR = ethereal ? 0.8 : (essential ? 1.7 : 2.7);

            // Two-state stroll: walk to a point near home, pause a beat, pick another. Pausing lets the
            // gait settle back to idle (moveBlend decays in _stepNpcToward / here), which reads as a
            // person stopping, not a mannequin sliding.
            if (npc._wanderPauseUntil && nowSec < npc._wanderPauseUntil) {
              npc.moveBlend = Math.max(0, (npc.moveBlend || 0) - dt * 2.6);
              continue;
            }
            const hasTarget = Number.isFinite(npc._wtX);
            const reached = hasTarget && Math.hypot(npc._wtX - npc.x, npc._wtY - npc.y) <= 0.3;
            if (reached) { npc._wtX = undefined; npc._wanderPauseUntil = nowSec + 1.6 + Math.random() * 3.6; npc.moveBlend = Math.max(0, (npc.moveBlend || 0) - dt * 2.6); continue; }
            if (!hasTarget) {
              let picked = false;
              for (let tries = 0; tries < 6 && !picked; tries++) {
                const a = Math.random() * Math.PI * 2;
                const r = 0.4 + Math.random() * wanderR;
                const tx = npc._homeX + Math.cos(a) * r;
                const ty = npc._homeY + Math.sin(a) * r;
                if (game.isWalkable && !game.isWalkable(tx, ty, npc)) continue;
                npc._wtX = tx; npc._wtY = ty; picked = true;
              }
              if (!picked) { npc._wanderPauseUntil = nowSec + 1.0 + Math.random() * 2.0; continue; }
            }
            npc.moveBlend = Math.min(1, (npc.moveBlend || 0) + dt * 3.5); // walking intent, even if a step is briefly blocked
            this._stepNpcToward(npc, npc._wtX, npc._wtY, dt, nodes, ethereal ? 0.5 : 1);
          }
        },

        closeOpenNpcWindowsIfInvalid() {
          const npc = this.activeNpc;
          if (!npc) return;
          const npcVisible = this.npcPanel?.style?.display !== 'none';
          const trainerVisible = this.trainerPanel?.style?.display !== 'none';
          const shopVisible = game.eventSystem?.activeShop?.node && game.eventSystem?.shopPanel?.style?.display !== 'none';
          if ((npcVisible || trainerVisible || shopVisible) && activeNpcWindowInvalid(this, npc, 3.25)) {
            this.closeNpcWindow();
            this.closeTrainer();
            game.eventSystem?.closeShop?.();
            game.closeVendorSellWindow?.();
            this.activeNpc = null;
            game.log?.('NPC window closed: you moved away.', 'System');
          }
        },

        refreshPanel() {
          if (!this.panel) return;
          const status = this.panel.querySelector('[data-npc-status]');
          const fill = this.panel.querySelector('[data-npc-range]');
          const meta = this.panel.querySelector('[data-npc-meta]');
          const node = this.nearbyNpc || this.findNearbyNpc();
          if (status) {
            if (!node) status.textContent = 'No NPC nearby.';
            else {
              const npc = mergedNpc(game, node);
              status.textContent = `E: Talk to ${npc.name || npc.id || 'NPC'} · ${npc.role || 'npc'}`;
            }
          }
          if (fill) {
            const d = node ? clamp(distanceToPlayer(game, node), 0, 2.65) : 2.65;
            fill.style.width = node ? `${Math.floor((1 - d / 2.65) * 100)}%` : '0%';
          }
          if (meta) {
            const rank = game.player ? trainingRank(this, game.player.className) : 0;
            meta.textContent = `NPCs ${this.allNpcs().length} · Class training rank ${rank}`;
          }
        },

        interactWithNpc(node) {
          const npc = mergedNpc(game, node);
          this.activeNpc = npc;
          const key = npcKey(game, node);
          this.state.lastNpcKey = key;
          this.state.visitedNpcIds[npc.id || npc.npcId || key] = Date.now();
          this.saveState();
          game.notifyExternalSystems?.('npc-interacted', { npc, npcKey: key });
          // V0.20.16 (Roadmap Item 16 - ambient behaviour): look at the person talking to you. Cael
          // would tell you about the road while facing away from you down it. Item 16 asks for NPCs
          // that react rather than stare; this is the cheapest possible instance of that, and it needs
          // no authored data - the player's position is right there. Faces the NODE (see
          // faceNodeToward), because the placed NPC is not an Entity and has no facing method.
          if (game.player) faceNodeToward(node, game.player.x - safeNumber(node.x), game.player.y - safeNumber(node.y));
          this.openNpcWindow(npc);
          game.spawnRing?.(safeNumber(npc.x) + 0.5, safeNumber(npc.y) + 0.5, npc.color || '#ffd875', 16);
          game.log(`Talking to ${npc.name || 'NPC'}.`);
          return true;
        },

        dialogueText(npc) {
          const questId = Array.isArray(npc.questIds) ? npc.questIds[0] : null;
          const quest = questId ? (game.editorQuests?.[questId] || DR.QUEST_BY_ID?.[questId]) : null;
          // Phase 5 (Event/Quest/Condition/Variable Parity): optional
          // conditional dialogue variants, checked in order, first match
          // wins. Reuses the same condition format as event node
          // conditions and quest.requiredConditions
          // (systems/event-system.js evaluateEventConditions), so a future
          // NPC can vary its greeting by quest state, an event variable, a
          // self-switch, level, or item ownership. No shipped NPC declares
          // dialogueVariants today, so this is a no-op for every existing
          // NPC - the priority chain below is unchanged.
          if (Array.isArray(npc.dialogueVariants)) {
            for (const variant of npc.dialogueVariants) {
              if (variant?.text && game.eventSystem?.evaluateEventConditions?.(variant.conditions)) return variant.text;
            }
          }
          if (npc.dialogueText) return npc.dialogueText;
          if (npc.dialogueId && DEFAULT_DIALOGUE[npc.dialogueId]) return DEFAULT_DIALOGUE[npc.dialogueId];
          if (quest?.beforeOfferText) return quest.beforeOfferText;
          if (npc.notes) return npc.notes;
          return `${npc.name || 'The NPC'} watches the road and waits.`;
        },

        // V0.20.7 (Roadmap Item 5): what this NPC is actually asking of you, at the moment you decide.
        // Reads the SAME chooseQuestFromSource pick the action button uses, so the summary and the
        // button can never disagree about which quest is on the table. Returns '' when there is no
        // quest here - an empty briefing frame would be worse than none.
        objectiveSummaryHtml(npc) {
          if (!game.questSystem || !Array.isArray(npc.questIds) || !npc.questIds.length) return '';
          const source = { type: 'npc', name: npc.name || 'Quest NPC', questIds: npc.questIds, node: npc };
          const pick = game.questSystem.chooseQuestFromSource?.(source);
          if (!pick) return '';
          const active = (game.questSystem.state?.active || {})[pick.id];
          const quest = active || game.questSystem.questById?.(pick.id) || game.editorQuests?.[pick.id] || DR.QUEST_BY_ID?.[pick.id];
          const tasks = Array.isArray(quest?.tasks) ? quest.tasks : [];
          if (!tasks.length) return '';
          const heading = pick.mode === 'complete' ? 'Ready to report'
            : pick.mode === 'progress' ? 'Underway'
            : 'What this asks of you';
          const rows = tasks.map(task => {
            const required = Math.max(1, Number(task.required) || 1);
            // An OFFERED quest has no progress yet - showing "0/5" for something not taken reads as
            // failure. Only an accepted quest has a count worth printing.
            const showProgress = Boolean(active);
            const progress = clamp(Number(task.progress) || 0, 0, required);
            const done = showProgress && progress >= required;
            const label = escapeHtml(task.label || task.target || task.type);
            const count = showProgress
              ? `<span style="font-family:ui-monospace,monospace; color:${done ? '#8fd39b' : '#c9b898'}">${progress}/${required}</span>`
              : `<span style="font-family:ui-monospace,monospace; opacity:.7">${required}</span>`;
            return `<div style="display:flex; justify-content:space-between; gap:10px; margin:3px 0">
              <span style="color:${done ? '#8fd39b' : '#ddd0b4'}">${done ? '✔' : '•'} ${label}</span>${count}</div>`;
          }).join('');
          return `
            <section style="margin-top:10px; padding:8px 10px; border:1px solid rgba(170,134,85,.38);
                            border-radius:6px; background:rgba(20,15,10,.5)">
              <div class="small" style="letter-spacing:.06em; text-transform:uppercase; color:#d8b36a; margin-bottom:4px">${escapeHtml(heading)}</div>
              <div class="small" style="font-size:13px; font-style:normal">${rows}</div>
            </section>`;
        },

        openNpcWindow(npc) {
          this.npcPanel = ensureNpcWindow(this);
          this.activeNpc = npc;
          const title = this.npcPanel.querySelector('[data-npc-title]');
          const subtitle = this.npcPanel.querySelector('[data-npc-subtitle]');
          const body = this.npcPanel.querySelector('[data-npc-body]');
          const actions = this.npcPanel.querySelector('[data-npc-actions]');
          // V0.20.6 (Roadmap Item 5): repaint the portrait for whoever is speaking now. openNpcWindow is
          // the single entry point for showing an NPC, so the speaker cannot change without passing
          // through here - which is what makes "update the portrait immediately when the active speaker
          // changes" hold without a watcher.
          const portraitCanvas = this.npcPanel.querySelector('[data-npc-portrait]');
          if (portraitCanvas) {
            drawNpcPortrait(portraitCanvas, npc);
            portraitCanvas.title = `${npc.name || 'NPC'}${npc.role ? ` · ${String(npc.role).replace(/_/g, ' ')}` : ''}`;
          }
          if (title) title.textContent = npc.role === 'mercenary_master' ? 'Mercenary Hiring' : (npc.name || npc.id || 'NPC');
          // V0.20.7: the role is the NPC's TITLE in this window (the spec's "NPC title or role"), and it
          // was printing the raw data key - "quest_giver", "fisher_provisioner". Humanise it for the one
          // place a player reads it; the underlying value is untouched.
          const roleTitle = String(npc.role || 'npc').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          if (subtitle) subtitle.textContent = npc.role === 'mercenary_master' ? `${npc.name || 'Mercenary Master'} · ${npc.faction || 'neutral'} · Level ${npc.level || 1}` : `${roleTitle} · ${npc.faction || 'neutral'} · Level ${npc.level || 1}`;
          if (body) body.innerHTML = escapeHtml(this.dialogueText(npc)).replace(/\n/g, '<br>');
          // V0.20.7 (Roadmap Item 5): the objective summary. The button said "Accept: Light the Way"
          // and nothing told you what you were agreeing to - the task labels are authored (38 of them)
          // and never appeared at the moment of the decision. Rendered as a briefing panel, deliberately
          // NOT in the spoken voice: upright, monospace figures, its own frame. Speech is a quote; this
          // is a list. That IS the spec's "clear visual distinction".
          const objectivesNode = this.npcPanel.querySelector('[data-npc-objectives]');
          if (objectivesNode) objectivesNode.innerHTML = this.objectiveSummaryHtml(npc);
          if (actions) {
            const buttons = [];
            const questText = questButtonText(game, npc);
            if (questText) buttons.push(`<button data-npc-action="quest">${escapeHtml(questText)}</button>`);
            const opensVendor = npc.role !== 'mercenary_master' && (npc.shopId || (Array.isArray(npc.vendorTags) && npc.vendorTags.length && !npc.vendorTags.includes('mercenary')) || npc.role === 'merchant' || npc.role === 'blacksmith' || npc.role === 'fisher_provisioner' || npc.role === 'healer');
            if (opensVendor) buttons.push('<button data-npc-action="vendor">Open Vendor</button>');
            if (npc.trainerClass || npc.role === 'class_trainer') buttons.push('<button data-npc-action="trainer">Open Trainer</button>');
            if (npc.role === 'mercenary_master') {
              const hiring = game.mercenaryHiringPanelHtml?.({ sourceNpc: npc }) || game.mercContractButtonsHtml?.() || '';
              if (hiring) buttons.push(hiring);
            } else if (npc.role === 'merc_recruiter' || (Array.isArray(npc.vendorTags) && npc.vendorTags.includes('mercenary'))) {
              const botRecruitment = botRecruiterPanelHtml(game);
              if (botRecruitment) buttons.push(botRecruitment);
              const hiring = game.mercenaryHiringPanelHtml?.({ sourceNpc: npc, compact: true }) || '';
              if (hiring) buttons.push(hiring);
            }
            if (npc.role === 'dream_spirit') buttons.push('<button data-npc-action="bind-spirit">Bind Respawn</button>');
            buttons.push('<button data-npc-action="dialogue">Repeat Dialogue</button>');
            actions.innerHTML = buttons.join('');
          }
          setNpcWindowAnchor(this, npc);
          this.npcPanel.style.display = 'block';
        },

        closeNpcWindow() {
          if (this.npcPanel) this.npcPanel.style.display = 'none';
        },

        handleNpcAction(action) {
          const npc = this.activeNpc;
          if (!npc) return false;
          if (activeNpcWindowInvalid(this, npc, 3.25)) {
            this.closeNpcWindow();
            this.closeTrainer();
            game.eventSystem?.closeShop?.();
            game.log?.('You are too far away.', 'System');
            return false;
          }
          if (action === 'quest') return this.handleQuest(npc);
          if (action === 'vendor') return this.openVendor(npc);
          if (action === 'trainer') return this.openTrainer(npc);
          if (String(action || '').startsWith('hire-bot:')) {
            const classKey = String(action).split(':')[1] || '';
            const hired = game.hireClassBot?.(classKey, { sourceNpc: npc }) || false;
            this.openNpcWindow(npc);
            return Boolean(hired);
          }
          if (String(action || '').startsWith('dismiss-bot:')) {
            const botId = String(action).split(':')[1] || '';
            const dismissed = game.dismissClassBot?.(botId, { sourceNpc: npc }) || false;
            this.openNpcWindow(npc);
            return dismissed;
          }
          if (String(action || '').startsWith('hire-merc:')) {
            const roleKey = String(action).split(':')[1] || '';
            const hired = game.hireMerc?.(roleKey, { sourceNpc: npc }) || false;
            this.openNpcWindow(npc);
            return hired;
          }
          if (String(action || '') === 'dismiss-merc') {
            const dismissed = game.dismissMerc?.({ sourceNpc: npc }) !== false;
            this.openNpcWindow(npc);
            return dismissed;
          }
          if (action === 'bind-spirit') {
            game.boundDreamSpirit = { zone: zoneKey(game), npcId: npc.id || npc.npcId, x: safeNumber(npc.x), y: safeNumber(npc.y) };
            game.log?.('Your spirit is bound to the Dream Spirit.', 'System');
            game.spawnRing?.(safeNumber(npc.x) + 0.5, safeNumber(npc.y) + 0.5, npc.color || '#d8f6ff', 24);
            return true;
          }
          if (action === 'dialogue') {
            this.openNpcWindow(npc);
            return true;
          }
          return false;
        },

        handleQuest(npc) {
          if (!game.questSystem) {
            game.log(`${npc.name || 'NPC'}: quest runtime unavailable.`);
            return false;
          }
          const source = { type: 'npc', name: npc.name || 'Quest NPC', questIds: Array.isArray(npc.questIds) ? npc.questIds : [], node: npc };
          const pick = game.questSystem.chooseQuestFromSource?.(source);
          if (!pick) {
            game.log(`${source.name}: No quest assigned.`);
            return false;
          }
          const quest = game.questSystem.questById?.(pick.id) || game.editorQuests?.[pick.id] || DR.QUEST_BY_ID?.[pick.id];
          if (!quest) {
            game.log(`${source.name}: Quest data missing (${pick.id}).`);
            return false;
          }
          let result = false;
          if (pick.mode === 'complete') result = game.questSystem.completeQuest(pick.id, source.name);
          else if (pick.mode === 'accept') result = game.questSystem.acceptQuest(pick.id, source.name);
          else if (pick.mode === 'progress') {
            const active = game.questSystem.state?.active?.[pick.id];
            game.log(`${source.name}: ${active?.inProgressText || quest.inProgressText || 'Keep working on the objective.'}`);
            result = true;
          } else {
            // V0.19.2 (Roadmap Item 1, state 8): post-completion dialogue reflects the changed world;
            // completedText (the turn-in line) is the fallback.
            game.log(`${source.name}: ${quest.postCompletionText || quest.completedText || 'You have already completed this quest.'}`);
            result = true;
          }
          this.openNpcWindow(npc);
          return result;
        },

        openVendor(npc) {
          const shopNode = {
            ...npc,
            name: npc.name || 'Vendor',
            shopId: npc.shopId || (npc.vendorTags?.includes('training') ? 'trainer_goods' : 'shop_camp_basic_goods'),
            category: 'shop',
            type: 'shop_event'
          };
          this.activeNpc = npc;
          setNpcWindowAnchor(this, npc);
          if (game.eventSystem?.openShop) {
            const ok = game.eventSystem.openShop(shopNode);
            if (ok) {
              const key = npc.id || npc.npcId || npc.name || 'vendor';
              this.state.vendorTransactions[key] = this.state.vendorTransactions[key] || { opened: 0 };
              this.state.vendorTransactions[key].opened += 1;
              this.saveState();
            }
            return ok;
          }
          game.log(`${npc.name || 'Vendor'}: shop runtime unavailable.`);
          return false;
        },

        openTrainer(npc) {
          this.trainerPanel = ensureTrainerWindow(this);
          this.activeNpc = npc;
          setNpcWindowAnchor(this, npc);
          this.renderTrainer(npc);
          this.trainerPanel.style.display = 'block';
          game.log(`${npc.name || 'Trainer'} opened training.`);
          return true;
        },

        closeTrainer() {
          if (this.trainerPanel) this.trainerPanel.style.display = 'none';
        },

        renderTrainer(npc = this.activeNpc) {
          if (!this.trainerPanel || !npc) return;
          const title = this.trainerPanel.querySelector('[data-trainer-title]');
          const subtitle = this.trainerPanel.querySelector('[data-trainer-subtitle]');
          const meta = this.trainerPanel.querySelector('[data-trainer-meta]');
          const body = this.trainerPanel.querySelector('[data-trainer-body]');
          const playerClass = game.player?.className || '';
          const trainerClass = npc.trainerClass || playerClass;
          const rank = trainingRank(this, playerClass);
          const cost = trainingCost(rank);
          const currentBonus = classTrainingBonuses(rank, game.player);
          const nextBonus = classTrainingBonuses(rank + 1, game.player);
          if (title) title.textContent = npc.name || 'Trainer';
          if (subtitle) subtitle.textContent = `Trainer class: ${trainerClass || 'Any'} · Your class: ${playerClass || 'None'}`;
          if (meta) meta.textContent = `${game.moneyText ? game.moneyText() : `${game.player?.gold || 0}g`} · Current: ${describeBonuses(currentBonus)} · Next: ${describeBonuses(nextBonus)}`;
          if (!body) return;
          if (trainerClass && playerClass && trainerClass !== playerClass) {
            body.innerHTML = `<article class="systemPanel" style="margin-top:8px"><h3>Wrong class</h3><div class="small">${escapeHtml(npc.name || 'This trainer')} trains ${escapeHtml(trainerClass)} characters. You are ${escapeHtml(playerClass)}.</div></article>`;
            return;
          }
          const resource = String(playerClass || '').toLowerCase() === 'assassin' ? 'Focus' : 'MP';
          const spells = (DR.CLASS_SPELL_BOOK?.[playerClass] || []).map((spell, index) => `<li>${index + 2}: ${escapeHtml(spell.name)} · ${escapeHtml(spell.kind || 'spell')} · ${Math.floor(safeNumber(spell.cost, 0))} ${resource}</li>`).join('');
          const canTrain = (game.player?.gold || 0) >= cost;
          body.innerHTML = `
            <article class="systemPanel" style="margin-top:8px">
              <h3>Class Discipline Rank ${rank}</h3>
              <div class="small">Training is persistent runtime NPC state. It applies immediately through the player stat recalculation path.</div>
              <div class="small" style="margin-top:6px">Cost: ${cost}g</div>
              <button data-train-rank="1" ${canTrain ? '' : 'disabled'} style="margin-top:8px">Train Rank ${rank + 1}</button>
            </article>
            <article class="systemPanel" style="margin-top:8px">
              <h3>Known ${escapeHtml(playerClass)} Spells</h3>
              <ul class="small" style="margin:6px 0 0 18px; padding:0">${spells || '<li>No runtime spells found for this class.</li>'}</ul>
            </article>
          `;
        },

        trainClassRank() {
          if (!game.player) return false;
          const npc = this.activeNpc || {};
          const playerClass = game.player.className;
          const trainerClass = npc.trainerClass || playerClass;
          if (trainerClass && trainerClass !== playerClass) {
            game.log(`${npc.name || 'Trainer'} cannot train your class.`);
            return false;
          }
          const rank = trainingRank(this, playerClass);
          // V0.18.99: training costs are authored on the SILVER scale and paid from the real currency.
          // The old affordability check read the legacy player.gold field while the spend went through
          // spendGold (which checks coinCopper) - the two could disagree. Both now use copper.
          const cost = trainingCost(rank);
          const costCopper = game.silverToCopper ? game.silverToCopper(cost) : cost * 100;
          const purse = game.totalCopper ? game.totalCopper() : (game.player.gold || 0) * 10000;
          if (purse < costCopper) {
            game.log(`Not enough money for training. Cost: ${game.formatCopper ? game.formatCopper(costCopper) : `${cost}s`}.`);
            return false;
          }
          if (game.spendCopper) game.spendCopper(costCopper);
          else game.player.gold -= cost;
          this.state.classTraining[playerClass] = {
            rank: rank + 1,
            trainedAt: Date.now(),
            trainerId: npc.id || npc.npcId || null
          };
          this.applyTrainingBonuses();
          this.saveState();
          game.spawnRing?.(game.player.x, game.player.y, npc.color || '#c991ff', 22);
          game.updateUI?.();
          this.renderTrainer(npc);
          this.refreshPanel();
          game.log(`${playerClass} training rank ${rank + 1} learned.`);
          return true;
        },

        currentTrainingBonus() {
          if (!game.player) return { hp: 0, mana: 0, attack: 0, defense: 0, speed: 0 };
          return classTrainingBonuses(trainingRank(this, game.player.className), game.player);
        },

        applyTrainingBonuses() {
          if (!game.player) return;
          game.npcTrainingBonuses = this.currentTrainingBonus();
          if (typeof game.recalculatePlayerStats === 'function') game.recalculatePlayerStats();
        },

        render(context) {
          if (!game.started || !game.player) return;
          const nodes = this.allNpcs();
          if (!nodes.length) return;
          const px = game.player.x;
          const py = game.player.y;
          context.save();
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          for (const node of nodes) {
            // V0.20.44: a camp NPC that has turned in for the night is inside a tent - do not draw it.
            if (node._asleep) continue;
            const x = Math.floor(safeNumber(node.x));
            const y = Math.floor(safeNumber(node.y));
            if (Math.hypot(x + 0.5 - px, y + 0.5 - py) > 36) continue;
            const tile = game.map?.[y]?.[x];
            if (!tile) continue;
            // V0.20.56: the 36-tile radius above is a WORLD radius, not a screen test - standing away
            // from camp it keeps every camp NPC "in range" and each one paid for a full merge, class
            // model and nameplate while off screen. This is the same viewport cull the entity renderer
            // uses (cached camera projection, so it is cheap), placed before mergedNpc() so the
            // expensive work is skipped rather than merely not blitted. The pad is far larger than the
            // tallest NPC visual (~90px of model above the anchor plus a ~90px nameplate stack), so
            // nothing can pop in at the screen edge.
            if (game.worldPointInsideViewportFast
              && !game.worldPointInsideViewportFast(x + 0.5, y + 0.5, tile.elev + 0.12, 480)) continue;
            const npc = mergedNpc(game, node);
            const s = game.worldToScreen(x + 0.5, y + 0.5, tile.elev + 0.12);
            const close = distanceToPlayer(game, node) <= safeNumber(npc.interactionRange, 2.3);
            const color = npc.color || '#ffd875';

            const drawFallbackNpc = () => {
              context.globalAlpha = 0.28;
              context.fillStyle = '#050806';
              context.beginPath();
              context.ellipse(s.x, s.y - 2, 16, 7, 0, 0, Math.PI * 2);
              context.fill();
              context.globalAlpha = 0.96;
              context.fillStyle = '#15110d';
              context.fillRect(s.x - 7, s.y - 4, 5, 12);
              context.fillRect(s.x + 2, s.y - 4, 5, 12);
              context.fillStyle = '#2d2113';
              context.strokeStyle = '#0b0907';
              context.lineWidth = 2;
              context.beginPath();
              context.roundRect(s.x - 10, s.y - 35, 20, 31, 5);
              context.fill();
              context.stroke();
              context.fillStyle = color;
              context.beginPath();
              context.roundRect(s.x - 13, s.y - 31, 26, 10, 5);
              context.fill();
              context.fillStyle = '#d6a07c';
              context.strokeStyle = '#3b251b';
              context.beginPath();
              context.arc(s.x, s.y - 47, 9, 0, Math.PI * 2);
              context.fill();
              context.stroke();
              context.fillStyle = color;
              context.fillRect(s.x - 9, s.y - 57, 18, 5);
            };
            const drawLegacyDreamSpiritFallback = () => {
              const t = performance.now() * 0.003;
              context.save();
              context.globalCompositeOperation = 'screen';
              context.globalAlpha = 0.42 + Math.sin(t) * 0.08;
              const g = context.createRadialGradient(s.x, s.y - 36, 2, s.x, s.y - 36, 56);
              g.addColorStop(0, 'rgba(245,255,255,0.80)');
              g.addColorStop(0.35, 'rgba(160,225,255,0.30)');
              g.addColorStop(1, 'rgba(90,170,255,0)');
              context.fillStyle = g;
              context.beginPath();
              context.arc(s.x, s.y - 36, 56, 0, Math.PI * 2);
              context.fill();
              context.globalAlpha = 0.75;
              context.strokeStyle = '#e9fbff';
              context.lineWidth = 2;
              context.beginPath();
              context.ellipse(s.x, s.y - 70, 15, 5, 0, 0, Math.PI * 2);
              context.stroke();
              context.fillStyle = 'rgba(220,246,255,0.62)';
              context.beginPath();
              context.ellipse(s.x - 19, s.y - 33, 16, 33, -0.45, 0, Math.PI * 2);
              context.ellipse(s.x + 19, s.y - 33, 16, 33, 0.45, 0, Math.PI * 2);
              context.fill();
              context.fillStyle = 'rgba(240,255,255,0.82)';
              context.beginPath();
              context.roundRect(s.x - 9, s.y - 59, 18, 48, 9);
              context.fill();
              context.fillStyle = '#ffffff';
              context.beginPath();
              context.arc(s.x, s.y - 65, 9, 0, Math.PI * 2);
              context.fill();
              context.restore();
            };
            if (npc.role === 'dream_spirit' || npc.rendererId === 'dreamSpirit' || npc.rendererId === 'spiritHealer' || npc.visualRole === 'spiritHealer') {
              let drawn = false;
              const spiritModel = window.DreamRealms?.render?.SpiritHealerProceduralModel || window.SpiritHealerProceduralModel;
              if (spiritModel?.draw) {
                const spiritActor = {
                  ...npc,
                  kind: 'npc',
                  isNpcModel: true,
                  hideNameplate: true,
                  alive: true,
                  hp: safeNumber(npc.hp, 1),
                  maxHp: safeNumber(npc.maxHp, 1),
                  mana: safeNumber(npc.mana, 0),
                  maxMana: safeNumber(npc.maxMana, 0),
                  sourceEntity: npc,
                  screenX: s.x,
                  screenY: s.y,
                  x: x + 0.5,
                  y: y + 0.5,
                  close,
                  color,
                  species: 'spirit',
                  race: 'spirit',
                  npcType: 'sacred_spirit',
                  role: 'dream_spirit',
                  npcRole: 'spirit_healer',
                  visualRole: 'spiritHealer',
                  rendererId: 'spiritHealer',
                  facingName: 'south',
                  isMoving: false,
                  action: 'idle'
                };
                try {
                  drawn = spiritModel.draw(context, spiritActor, performance.now()) !== false;
                  if (spiritActor._nameplateAnchor) npc._nameplateAnchor = spiritActor._nameplateAnchor;
                } catch (err) {
                  game.recordRuntimeSystemFault?.({ id: 'spirit-healer-procedural-renderer' }, 'render', err);
                  drawn = false;
                }
              }
              if (!drawn) drawLegacyDreamSpiritFallback();
            } else {
              const facingName = String(npc.facingName || '').trim() || (close ? 'south' : (npc.role === 'merchant' || npc.role === 'class_trainer' || npc.role === 'healer' ? 'south' : 'southeast'));
              const visualProfile = npcVisualProfileFor(npc);
              const npcClassName = visualProfile.className || npcClassModelFor(npc);
              const npcSwimDepth = safeNumber(game.waterDepthAt?.(x + 0.5, y + 0.5), 0);
              const npcSwimming = npcSwimDepth > 0;
              const npcSwimTime = performance.now() * 0.001;
              // V0.20.45: read the LIVE locomotion state off the placed node. V0.20.44 sets moveBlend,
              // walkCycle and facingX/facingY on it, but this render bridge was discarding all of it (see
              // the note on the hardcoded fields below), so nothing downstream ever knew the NPC was
              // walking. facingName is derived from the same vector because faceNodeToward only writes
              // facingX/facingY - without this an NPC would walk north while still drawn facing south.
              const npcMoving = !npcSwimming && safeNumber(npc.moveBlend, 0) > 0.08;
              const npcFacingX = Number.isFinite(Number(npc.facingX)) ? Number(npc.facingX) : 0;
              const npcFacingY = Number.isFinite(Number(npc.facingY)) ? Number(npc.facingY) : 1;
              const npcDirName = (Math.hypot(npcFacingX, npcFacingY) > 1e-3)
                ? ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'][((Math.round(Math.atan2(npcFacingY, npcFacingX) / (Math.PI / 4)) % 8) + 8) % 8]
                : null;
              const classActor = {
                ...npc,
                // V0.13.0: town/camp NPCs are render-only player-class actors so they use
                // the same class model pipeline as actual player classes. The old NPC body is
                // reserved for catastrophic renderer failure only.
                kind: 'player',
                isNpcModel: true,
                hideNameplate: true,
                alive: true,
                hp: safeNumber(npc.hp, 1),
                maxHp: safeNumber(npc.maxHp, 1),
                mana: safeNumber(npc.mana, 0),
                maxMana: safeNumber(npc.maxMana, 0),
                sourceEntity: npc,
                screenX: s.x,
                screenY: s.y,
                x: x + 0.5,
                y: y + 0.5,
                close,
                color,
                species: npc.species || npc.race || npc.kind || 'human',
                race: npc.race || npc.species || 'human',
                npcType: npc.npcType || 'human',
                role: npc.visualRole || npc.npcRole || npc.role || 'villager',
                npcRole: npc.npcRole || npc.visualRole || npc.role || 'villager',
                visualRole: npc.visualRole || npc.npcRole || npc.role || 'villager',
                className: npcClassName,
                playerClass: npcClassName,
                classId: npcClassName,
                // V0.20.45: these four were HARDCODED to a south-facing idle, so the model AND the
                // runtime sprite cache were always told "standing still, facing south" no matter what the
                // NPC was actually doing. The cache keys its animation bucket off action/isMoving
                // (actionFrameMs + animationBucket), so every camp NPC baked as idle - 2 buckets at 250ms,
                // effectively one frozen frame - and then slid around wearing it. THAT was the real cause
                // of "they teleport, there is no walking animation": V0.20.44 made them move and set
                // moveBlend, but this bridge threw it away one line before it mattered. Derived now.
                facingName: (npcMoving && npcDirName) ? npcDirName : facingName,
                facingX: npcFacingX,
                facingY: npcFacingY,
                isMoving: npcMoving,
                action: npcSwimming ? 'swim' : (npcMoving ? 'walk' : 'idle'),
                swimming: npcSwimming,
                inWater: npcSwimDepth > 0,
                swimBlend: npcSwimming ? 1 : 0,
                swimMovement: 0,
                swimSubmerge: npcSwimming ? 0.52 : 0,
                swimAnim: npcSwimming ? npcSwimTime * 0.75 : 0,
                swimState: npcSwimming ? 'treading' : 'land',
                waterDepthMax: npcSwimDepth,
                npcRoleOverlay: npcRoleOverlayFor(npc),
                skinTone: visualProfile.skinTone || '#d8a87e',
                hairStyle: visualProfile.hairStyle || 'short',
                faceStyle: visualProfile.faceStyle || 'balanced',
                hairColor: visualProfile.hairColor || '#4b3628',
                clothesPrimary: visualProfile.clothesPrimary || color,
                clothesSecondary: visualProfile.clothesSecondary || '#8a7356',
                visualPalette: visualProfile.palette || null,
                usePlayerClassModelBase: !npc.trainerClass && npc.role !== 'class_trainer',
                visualScale: safeNumber(npc.visualScale, 1.0),
                debugFacing: !!(game.debugOverlayOpen || game.debugMode || game.showFacingDebug)
              };
              let drawn = false;
              const isClassTrainer = !!(npc.trainerClass || npc.role === 'class_trainer');
              try {
                // V0.15.49: trainers and ordinary camp/town NPCs both use the
                // player class model pipeline first. Non-trainers are assigned
                // role-specific outfits through npcVisualProfileFor(), which fixes
                // the tiny generic NPC scale problem without making them visually
                // match playable class uniforms.
                drawn = drawNpcClassModelDirect(context, game, classActor) !== false;
                if (classActor._nameplateAnchor) npc._nameplateAnchor = classActor._nameplateAnchor;
                if (isClassTrainer) npc._trainerClassRenderer = String(classActor.className || '').toLowerCase();
                else npc._playerScaleNpcClassRenderer = String(classActor.className || '').toLowerCase();
              } catch (err) {
                game.recordRuntimeSystemFault?.({ id: isClassTrainer ? 'npc-class-trainer-model-renderer' : 'npc-player-scale-class-model-renderer' }, 'render', err);
                drawn = false;
              }
              const humanModel = window.DreamRealms?.render?.HumanNpcProceduralModel || window.HumanNpcProceduralModel;
              const species = String(classActor.species || classActor.race || classActor.kind || 'human').toLowerCase();
              if (!drawn && (species === 'human' || classActor.isNpcModel || classActor.npcType) && humanModel?.draw) {
                try {
                  // V0.13.11: camp/town humans use the dedicated Human NPC
                  // procedural renderer first. Role identity is carried through
                  // visualRole/npcRole so cooks, merchants, clerics, miners,
                  // recruiters, and guards keep readable silhouettes.
                  drawn = (!classActor.debugFacing && game.runtimeSpriteCache?.drawModel)
                    ? game.runtimeSpriteCache.drawModel(context, classActor, humanModel, { rendererId: `npc_human:${classActor.visualRole || classActor.npcRole || 'human'}`, bounds: 'humanoid', scale: 1, screenX: classActor.screenX, screenY: classActor.screenY, nowMs: performance.now() }) !== false
                    : false;
                  if (!drawn) drawn = humanModel.draw(context, classActor, performance.now()) !== false;
                  if (classActor._nameplateAnchor) npc._nameplateAnchor = classActor._nameplateAnchor;
                } catch (err) {
                  game.recordRuntimeSystemFault?.({ id: 'npc-human-procedural-renderer' }, 'render', err);
                  drawn = false;
                }
              }
              const campModel = window.DreamRealms?.render?.CampNpcProceduralModel || window.CampNpcProceduralModel;
              if (!drawn && campModel?.draw) {
                try {
                  // V0.13.8 fallback: detailed legacy camp/town NPC renderer.
                  drawn = (!classActor.debugFacing && game.runtimeSpriteCache?.drawModel)
                    ? game.runtimeSpriteCache.drawModel(context, classActor, campModel, { rendererId: `npc_camp:${classActor.visualRole || classActor.npcRole || 'camp'}`, bounds: 'humanoid', scale: 1, screenX: classActor.screenX, screenY: classActor.screenY, nowMs: performance.now() }) !== false
                    : false;
                  if (!drawn) drawn = campModel.draw(context, classActor, performance.now()) !== false;
                  if (classActor._nameplateAnchor) npc._nameplateAnchor = classActor._nameplateAnchor;
                } catch (err) {
                  game.recordRuntimeSystemFault?.({ id: 'npc-detailed-camp-renderer' }, 'render', err);
                  drawn = false;
                }
              }
              if (!drawn) {
                try {
                  drawn = drawNpcClassModelDirect(context, game, classActor) !== false;
                  if (classActor._nameplateAnchor) npc._nameplateAnchor = classActor._nameplateAnchor;
                } catch (err) {
                  game.recordRuntimeSystemFault?.({ id: 'npc-class-model-renderer' }, 'render', err);
                  drawn = false;
                }
              }
              if (!drawn && typeof game.drawEntity === 'function') {
                try {
                  game.drawEntity(classActor);
                  if (classActor._nameplateAnchor) npc._nameplateAnchor = classActor._nameplateAnchor;
                  drawn = true;
                } catch (err) {
                  game.recordRuntimeSystemFault?.({ id: 'npc-draw-entity-renderer' }, 'render', err);
                  drawn = false;
                }
              }
              if (drawn) drawNpcRolePropOverlay(context, s, npc, visualProfile);
              if (!drawn) drawFallbackNpc();
            }

            const anchorY = Number.isFinite(Number(npc._nameplateAnchor?.y)) ? Number(npc._nameplateAnchor.y) : (s.y - 86);
            drawTrainerNameplate(context, npc, s, anchorY);
            // V0.17.92: large animated quest marker over quest-giving NPCs.
            const questMarker = questMarkerMode(game, npc);
            if (questMarker) drawAnimatedQuestMarker(context, s.x, anchorY - 14, questMarker, close, performance.now());

            // V0.14.17: keep the interact key behavior, but remove floating NPC/world text.
          }
          context.restore();
        }
      };

      runtime.init();
      return runtime;
    }
  });
})();
