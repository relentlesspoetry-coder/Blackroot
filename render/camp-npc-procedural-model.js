(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.render = DR.render || {};

  const Base = DR.render.HumanoidBaseRenderer;
  const Anim = DR.render.HumanoidAnimationSystem;
  const TAU = Math.PI * 2;

  /*
   * V0.12.55 Mercenary + NPC Identity Revamp Pass
   *
   * This module revamps all mercenaries and humanoid NPCs using the shared
   * humanoid base / animation framework instead of bespoke one-off camp sprites.
   *
   * Goals:
   * - stronger role silhouettes
   * - consistent 8-direction humanoid rendering
   * - mercenary role identity beyond simple recolors
   * - NPC role identity for merchants, healers, trainers, scouts, guards, etc.
   */

  const DEFAULT_ANCHOR = { x: 0, top: -86 };

  const PROFILES = Object.freeze({
    mercGuardian: profile('mercGuardian', 'Guardian Mercenary', {
      silhouette: { shoulder: 1.34, torso: 1.14, waist: 1.02, hem: 0.70, mantle: 1.14, coat: 18, prop: 1.18 },
      posture: { armSwing: 0.72, stride: 0.82, torsoBob: 0.54, headBob: 0.56, lean: 0.48, castPulse: 0.42, cloth: 0.26, cape: 0.30 },
      layers: { back: 'guardCape', torso: 'brigandine', shoulders: 'heavyPauldrons', belt: 'warBelt', head: 'crestHelm', chest: 'contractBadge', mainProp: 'sword', offProp: 'shield' },
      palette: palette('#d0c5a4', '#8c7858', '#e9ddba', '#5a4a36', '#24201d', '#e3c48b', '#d3d5d6', '#61696f', '#6a4b32', '#2d1e16', '#f7e4a4')
    }),
    mercCleric: profile('mercCleric', 'Field Cleric Mercenary', {
      silhouette: { shoulder: 1.04, torso: 1.00, waist: 0.92, hem: 1.24, mantle: 1.08, coat: 44, prop: 1.02 },
      posture: { armSwing: 0.46, stride: 0.70, torsoBob: 0.34, headBob: 0.36, lean: 0.30, castPulse: 1.04, cloth: 0.82, cape: 0.48 },
      layers: { back: 'medicRobe', torso: 'fieldVestment', shoulders: 'softMantle', belt: 'prayerCord', head: 'healerVeil', chest: 'crossStole', mainProp: 'mace', offProp: 'scripture' },
      palette: palette('#e5dec1', '#9c8765', '#fff4d1', '#8a7a54', '#41362c', '#f4e18d', '#ded9cf', '#75746c', '#806343', '#33261d', '#fff2a8')
    }),
    mercAdept: profile('mercAdept', 'Arcane Adept Mercenary', {
      silhouette: { shoulder: 0.96, torso: 0.92, waist: 0.82, hem: 1.06, mantle: 0.88, coat: 42, prop: 1.18 },
      posture: { armSwing: 0.58, stride: 0.78, torsoBob: 0.40, headBob: 0.46, lean: 0.54, castPulse: 1.30, cloth: 0.96, cape: 0.74 },
      layers: { back: 'arcaneCoat', torso: 'channelerRobe', shoulders: 'highCollar', belt: 'glyphBelt', head: 'circlet', chest: 'runeChain', mainProp: 'wand', offProp: 'floatingOrb' },
      palette: palette('#2f4473', '#8ab7ff', '#dbedff', '#273560', '#0f1528', '#83e2ff', '#ced3e6', '#596379', '#4c3b57', '#1d1623', '#86fff1')
    }),
    mercScout: profile('mercScout', 'Blade Scout Mercenary', {
      silhouette: { shoulder: 0.86, torso: 0.80, waist: 0.72, hem: 0.82, mantle: 0.72, coat: 34, prop: 0.96 },
      posture: { armSwing: 1.18, stride: 1.18, torsoBob: 0.34, headBob: 0.40, lean: 1.20, castPulse: 0.58, cloth: 0.58, cape: 0.68 },
      layers: { back: 'splitCloak', torso: 'leatherJerkin', shoulders: 'hoodMantle', belt: 'knifeBelt', head: 'shadowHood', chest: 'bandolier', mainProp: 'dagger', offProp: 'dagger' },
      palette: palette('#27303a', '#909ca8', '#dce3e9', '#1b222a', '#0c1014', '#86d8a0', '#c0c6cc', '#545d64', '#69462e', '#241813', '#7ff7ce')
    }),

    townGuide: profile('townGuide', 'Town Guide', {
      silhouette: { shoulder: 0.92, torso: 0.86, waist: 0.82, hem: 0.96, mantle: 0.84, coat: 28, prop: 0.94 },
      posture: { armSwing: 0.66, stride: 0.76, torsoBob: 0.38, headBob: 0.40, lean: 0.46, castPulse: 0.48, cloth: 0.56, cape: 0.48 },
      layers: { back: 'travelerCape', torso: 'travelerTunic', shoulders: 'hoodMantle', belt: 'satchelBelt', head: 'hood', chest: 'roadStrap', mainProp: 'scroll', offProp: 'lanternCharm' },
      palette: palette('#4a704f', '#d8bc78', '#f6e2ad', '#314b36', '#162219', '#ffe39b', '#d0cabf', '#66625a', '#6f5132', '#281b12', '#ffe2a8')
    }),
    merchant: profile('merchant', 'Merchant', {
      silhouette: { shoulder: 1.00, torso: 0.98, waist: 0.96, hem: 1.06, mantle: 0.86, coat: 30, prop: 0.92 },
      posture: { armSwing: 0.48, stride: 0.62, torsoBob: 0.26, headBob: 0.30, lean: 0.24, castPulse: 0.36, cloth: 0.44, cape: 0.38 },
      layers: { back: 'shortCape', torso: 'merchantCoat', shoulders: 'foldedMantle', belt: 'coinBelt', head: 'cap', chest: 'ledgerStrap', mainProp: 'ledger', offProp: 'coinPurse' },
      palette: palette('#6a4328', '#d8ad57', '#f7dc9d', '#442918', '#1e130d', '#f8d177', '#d5c8be', '#666058', '#7c5535', '#2e2017', '#ffe3a0')
    }),
    cook: profile('cook', 'Camp Cook', {
      silhouette: { shoulder: 0.96, torso: 0.94, waist: 0.90, hem: 1.10, mantle: 0.74, coat: 24, prop: 0.92 },
      posture: { armSwing: 0.52, stride: 0.60, torsoBob: 0.24, headBob: 0.28, lean: 0.20, castPulse: 0.34, cloth: 0.32, cape: 0.28 },
      layers: { back: 'apronBack', torso: 'cookApron', shoulders: 'none', belt: 'utilityBelt', head: 'chefHat', chest: 'apronPatch', mainProp: 'ladle', offProp: 'spicePouch' },
      palette: palette('#6e4730', '#f1eadc', '#fff8ef', '#514237', '#231b16', '#f7d39d', '#e0ddd8', '#7d7b75', '#8e5f34', '#312117', '#fff2b5')
    }),
    bardTrainer: profile('bardTrainer', 'Bard Trainer', {
      silhouette: { shoulder: 0.98, torso: 0.92, waist: 0.86, hem: 1.08, mantle: 0.94, coat: 36, prop: 1.12 },
      posture: { armSwing: 0.58, stride: 0.72, torsoBob: 0.32, headBob: 0.36, lean: 0.44, castPulse: 1.12, cloth: 0.74, cape: 0.68 },
      layers: { back: 'performerCape', torso: 'bardCoat', shoulders: 'shoulderMantle', belt: 'sashBelt', head: 'feather', chest: 'songTrim', mainProp: 'lute', offProp: 'pick' },
      palette: palette('#58386f', '#c991ff', '#ffe298', '#392549', '#1b1224', '#f1d57b', '#d6cee0', '#6f6679', '#72503a', '#2a1c15', '#ffea9f')
    }),
    roadWarden: profile('roadWarden', 'Road Warden', {
      silhouette: { shoulder: 1.22, torso: 1.08, waist: 0.98, hem: 0.80, mantle: 1.02, coat: 20, prop: 1.10 },
      posture: { armSwing: 0.66, stride: 0.78, torsoBob: 0.36, headBob: 0.40, lean: 0.52, castPulse: 0.40, cloth: 0.30, cape: 0.34 },
      layers: { back: 'guardCape', torso: 'wardenArmor', shoulders: 'lightPauldrons', belt: 'warBelt', head: 'halfHelm', chest: 'crestTabard', mainProp: 'spear', offProp: 'buckler' },
      palette: palette('#334351', '#9fb6c7', '#edf7ff', '#26313c', '#10161b', '#d4e0e8', '#d6d9dd', '#6a747b', '#68503b', '#261a12', '#d6f0ff')
    }),
    mossfangScout: profile('mossfangScout', 'Mossfang Scout', {
      silhouette: { shoulder: 0.88, torso: 0.80, waist: 0.74, hem: 0.84, mantle: 0.80, coat: 30, prop: 1.04 },
      posture: { armSwing: 1.12, stride: 1.06, torsoBob: 0.34, headBob: 0.38, lean: 1.04, castPulse: 0.48, cloth: 0.52, cape: 0.60 },
      layers: { back: 'splitCloak', torso: 'scoutLeathers', shoulders: 'hoodMantle', belt: 'satchelBelt', head: 'hood', chest: 'crossStrap', mainProp: 'shortBow', offProp: 'map' },
      palette: palette('#345231', '#9fc785', '#d9efbf', '#20351d', '#0f180d', '#cbe8a6', '#ced4c6', '#60675a', '#624a2f', '#241912', '#a8f6b4')
    }),
    surveyor: profile('surveyor', 'Deepwood Surveyor', {
      silhouette: { shoulder: 0.94, torso: 0.90, waist: 0.84, hem: 0.96, mantle: 0.76, coat: 28, prop: 0.94 },
      posture: { armSwing: 0.62, stride: 0.74, torsoBob: 0.30, headBob: 0.34, lean: 0.42, castPulse: 0.44, cloth: 0.46, cape: 0.34 },
      layers: { back: 'travelerCape', torso: 'surveyorCoat', shoulders: 'foldedMantle', belt: 'toolBelt', head: 'wideHat', chest: 'compassStrap', mainProp: 'map', offProp: 'marker' },
      palette: palette('#294353', '#80c9ff', '#d8f4ff', '#1b2c36', '#0e171c', '#c0ecff', '#cfdae0', '#647178', '#6d5234', '#281c14', '#c4f6ff')
    }),
    healer: profile('healer', 'Camp Healer', {
      silhouette: { shoulder: 0.98, torso: 0.96, waist: 0.92, hem: 1.22, mantle: 1.04, coat: 44, prop: 1.08 },
      posture: { armSwing: 0.44, stride: 0.66, torsoBob: 0.28, headBob: 0.34, lean: 0.22, castPulse: 1.24, cloth: 0.86, cape: 0.52 },
      layers: { back: 'prayerRobe', torso: 'healerVestment', shoulders: 'softMantle', belt: 'holyCord', head: 'veil', chest: 'crossStole', mainProp: 'staff', offProp: 'healingCharm' },
      palette: palette('#dfe9df', '#bdf4de', '#ffffff', '#9eb8ab', '#5a7569', '#fff3c0', '#ecebe6', '#8e8d87', '#7b5a35', '#2f2218', '#f6ffce')
    }),
    mercRecruiter: profile('mercRecruiter', 'Mercenary Master', {
      silhouette: { shoulder: 1.24, torso: 1.08, waist: 0.98, hem: 0.92, mantle: 1.12, coat: 30, prop: 1.02 },
      posture: { armSwing: 0.50, stride: 0.68, torsoBob: 0.28, headBob: 0.32, lean: 0.30, castPulse: 0.36, cloth: 0.36, cape: 0.42 },
      layers: { back: 'officerCape', torso: 'leatherJerkin', shoulders: 'lightPauldrons', belt: 'coinBelt', head: 'cap', chest: 'rankSash', mainProp: 'contract', offProp: 'badge' },
      palette: palette('#4a3826', '#c2a46d', '#f3d79b', '#2e2117', '#130d09', '#e7bf70', '#b9b4a4', '#666055', '#7b4f2c', '#24170f', '#ffe0a0')
    }),
    smith: profile('smith', 'Camp Smith', {
      silhouette: { shoulder: 1.12, torso: 1.04, waist: 0.98, hem: 0.86, mantle: 0.76, coat: 16, prop: 1.08 },
      posture: { armSwing: 0.72, stride: 0.72, torsoBob: 0.32, headBob: 0.34, lean: 0.44, castPulse: 0.34, cloth: 0.22, cape: 0.18 },
      layers: { back: 'shortCape', torso: 'smithApron', shoulders: 'rolledSleeves', belt: 'toolBelt', head: 'band', chest: 'forgeApron', mainProp: 'hammer', offProp: 'tongs' },
      palette: palette('#4b3028', '#f0a15a', '#ffd49a', '#2f1f1a', '#140d0b', '#ffc57f', '#d4d2d0', '#6e7072', '#804d2a', '#2a1a11', '#ffd295')
    }),
    fisher: profile('fisher', 'Camp Fisher', {
      silhouette: { shoulder: 0.92, torso: 0.88, waist: 0.82, hem: 0.92, mantle: 0.72, coat: 24, prop: 1.18 },
      posture: { armSwing: 0.54, stride: 0.68, torsoBob: 0.28, headBob: 0.32, lean: 0.34, castPulse: 0.36, cloth: 0.34, cape: 0.24 },
      layers: { back: 'travelerCape', torso: 'fisherCoat', shoulders: 'foldedMantle', belt: 'ropeBelt', head: 'wideHat', chest: 'hookStrap', mainProp: 'rod', offProp: 'baitBucket' },
      palette: palette('#26515c', '#8ccdde', '#d8f9ff', '#173640', '#0b1b20', '#c9a35a', '#d0dde2', '#66767b', '#6c512f', '#281b13', '#cdf6ff')
    }),
    genericNpc: profile('genericNpc', 'Villager', {
      silhouette: { shoulder: 0.92, torso: 0.88, waist: 0.82, hem: 0.94, mantle: 0.74, coat: 22, prop: 0.86 },
      posture: { armSwing: 0.54, stride: 0.68, torsoBob: 0.30, headBob: 0.32, lean: 0.30, castPulse: 0.34, cloth: 0.34, cape: 0.28 },
      layers: { back: 'travelerCape', torso: 'travelerTunic', shoulders: 'none', belt: 'simpleBelt', head: 'hair', chest: 'none', mainProp: 'none', offProp: 'none' },
      palette: palette('#54607a', '#d0bf8e', '#f0dfb2', '#3b4556', '#19202b', '#e8d39a', '#d7d3cb', '#6c675f', '#73523a', '#2a1d15', '#ffe5ac')
    })
  });

  function palette(cloth, accent, clothHi, clothDark, outline, trim, metal, metalDark, belt, boot, glow) {
    return {
      outline,
      shadow: 'rgba(0,0,0,0.38)',
      skin: '#d6a07c',
      skinShadow: '#99684e',
      hair: '#4b3326',
      hairHi: '#7e573e',
      cloth,
      clothHi,
      clothDark,
      accent,
      accentDark: shade(accent, -32),
      boot,
      bootHi: shade(boot, 24),
      belt,
      metal,
      metalDark,
      glow
    };
  }

  function profile(id, display, data) {
    return Object.freeze({ id, display, ...data });
  }

  function shade(hex, percent) {
    const amt = Math.max(-100, Math.min(100, percent)) / 100;
    const n = parseInt(String(hex || '#000000').replace('#', ''), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const mix = amt >= 0 ? 255 : 0;
    const p = Math.abs(amt);
    const rr = Math.round(r + (mix - r) * p);
    const gg = Math.round(g + (mix - g) * p);
    const bb = Math.round(b + (mix - b) * p);
    return `#${[rr, gg, bb].map(v => v.toString(16).padStart(2, '0')).join('')}`;
  }

  function normalizeKey(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function canDraw(actor = {}) {
    return !!resolveProfile(actor);
  }

  function resolveProfile(actor = {}) {
    if (String(actor.kind || '').toLowerCase() === 'merc') {
      const key = normalizeKey(actor.roleKey || actor.role || actor.name);
      if (key.includes('guardian')) return PROFILES.mercGuardian;
      if (key.includes('cleric')) return PROFILES.mercCleric;
      if (key.includes('adept')) return PROFILES.mercAdept;
      if (key.includes('scout')) return PROFILES.mercScout;
      return PROFILES.mercGuardian;
    }

    const visualRole = normalizeKey(actor.visualRole);
    const role = normalizeKey(actor.role);
    const trainer = normalizeKey(actor.trainerClass);
    const id = normalizeKey(actor.npcId || actor.id);
    const name = normalizeKey(actor.name);

    if (visualRole) {
      const profileKey = Object.keys(PROFILES).find(key => normalizeKey(key) === visualRole);
      if (profileKey) return PROFILES[profileKey];
    }
    if (trainer === 'bard' || id.includes('bard') || name.includes('bard')) return PROFILES.bardTrainer;
    if (id.includes('healer') || role.includes('healer') || name.includes('sister') || visualRole === 'healer') return PROFILES.healer;
    if (id.includes('merc_recruiter') || id.includes('mercenary_master') || id.includes('mercrecruiter') || id.includes('mercenarymaster') || id.includes('recruiter') || role.includes('merc_recruiter') || role.includes('mercenary_master') || role.includes('mercrecruiter') || role.includes('mercenarymaster') || role.includes('recruiter') || name.includes('contractcaptain') || name.includes('mercenarymaster') || visualRole === 'mercrecruiter' || visualRole === 'mercenarymaster') return PROFILES.mercRecruiter;
    if (id.includes('smith') || role.includes('blacksmith') || role.includes('smith')) return PROFILES.smith;
    if (id.includes('fisher') || role.includes('fisher') || role.includes('provisioner')) return PROFILES.fisher;
    if (role.includes('merchant') || id.includes('merchant')) return PROFILES.merchant;
    if (id.includes('cook') || name.includes('cook')) return PROFILES.cook;
    if (id.includes('warden') || role.includes('guard')) return PROFILES.roadWarden;
    if (id.includes('scout') || role.includes('scout')) return PROFILES.mossfangScout;
    if (id.includes('surveyor') || name.includes('surveyor')) return PROFILES.surveyor;
    if (role.includes('questgiver') || role.includes('lore') || id.includes('guide')) return PROFILES.townGuide;
    return PROFILES.genericNpc;
  }

  function draw(ctx, actor, nowMs = performance.now()) {
    const profile = resolveProfile(actor);
    if (!profile) return false;

    // V0.12.93: camp/town NPCs use a purpose-built readable 2.5D
    // billboard path instead of falling back to the old leg-heavy humanoid
    // puppet. Mercs still use the shared humanoid/animation rig because their
    // combat poses and command-state animations depend on that owner.
    if (String(actor.kind || '').toLowerCase() !== 'merc') {
      return drawNpcBillboard(ctx, actor, nowMs, profile);
    }

    if (!Base || !Anim) return drawNpcBillboard(ctx, actor, nowMs, profile);

    const pose = scalePose(Anim.buildPose(actor, nowMs), profile);
    const rig = Base.draw(ctx, actor, {
      pose,
      palette: paletteFor(actor, profile),
      hooks: buildHooks(profile, actor, pose),
      debugFacing: !!actor.debugFacing
    }, nowMs);

    const source = actor.sourceEntity || actor;
    if (source) {
      source._humanoidFacingName = pose.direction.name;
      source._lastHumanoidFacingName = pose.direction.name;
      source._socialIdentityRenderer = profile.id;
      const head = rig?.anchors?.head || DEFAULT_ANCHOR;
      source._nameplateAnchor = {
        x: Math.round(actor.screenX ?? actor.x ?? 0) + (head.x || 0),
        y: Math.round(actor.screenY ?? actor.y ?? 0) + (head.top || -86) - 7
      };
    }
    return true;
  }

  function drawNpcBillboard(ctx, actor, nowMs, profile) {
    if (!ctx) return false;
    const x = Math.round(Number(actor.screenX ?? actor.x ?? 0));
    const y = Math.round(Number(actor.screenY ?? actor.y ?? 0));
    const pal = paletteFor(actor, profile);
    const id = profile.id || 'genericNpc';
    const t = Number(nowMs || 0) * 0.001 + (Math.abs(hashCode(actor.id || actor.name || id)) % 100) * 0.013;
    const bob = Math.sin(t * 1.35) * 0.9;
    const pulse = 0.5 + Math.sin(t * 2.2) * 0.5;

    const roleScale = id === 'roadWarden' || id === 'mercRecruiter' || id === 'smith' ? 1.08 : id === 'mossfangScout' ? 0.98 : 1.0;
    const robe = id === 'healer' || id === 'mercAdept' || id === 'surveyor' || id === 'bardTrainer' || String(actor.trainerClass || '').toLowerCase().match(/cleric|druid|summoner|enchanter|necromancer/);
    const heavy = id === 'roadWarden' || id === 'mercRecruiter' || id === 'smith';
    const sx = roleScale;
    const footY = y - 4;
    const bodyY = y - 39 + bob;
    const headY = y - 74 + bob;

    ctx.save();

    // Grounding shadow + contact occlusion.
    ctx.globalAlpha = 0.44;
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(x, y - 2, 20 * sx, 7, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Back cape / robe silhouette.
    if (profile.layers.back && profile.layers.back !== 'none') {
      ctx.fillStyle = pal.clothDark || '#253022';
      ctx.strokeStyle = pal.outline || '#0b0d0a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 16 * sx, bodyY - 21);
      ctx.quadraticCurveTo(x, bodyY - 29, x + 16 * sx, bodyY - 21);
      ctx.lineTo(x + (robe ? 21 : 15) * sx, footY - 3);
      ctx.quadraticCurveTo(x, footY + 2, x - (robe ? 21 : 15) * sx, footY - 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Legs/boots are short and tucked under clothing; no more floating-leg look.
    ctx.strokeStyle = pal.outline || '#0b0d0a';
    ctx.lineWidth = 2;
    ctx.fillStyle = heavy ? pal.metalDark : shade(pal.clothDark, 8);
    roundRectPath(ctx, x - 10 * sx, footY - 26, 8 * sx, 26, 4); ctx.fill(); ctx.stroke();
    roundRectPath(ctx, x + 2 * sx, footY - 26, 8 * sx, 26, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = pal.boot || '#2a1d15';
    roundRectPath(ctx, x - 13 * sx, footY - 3, 12 * sx, 6, 3); ctx.fill(); ctx.stroke();
    roundRectPath(ctx, x + 1 * sx, footY - 3, 12 * sx, 6, 3); ctx.fill(); ctx.stroke();

    // Torso / robe body.
    ctx.fillStyle = pal.cloth || '#596246';
    ctx.strokeStyle = pal.outline || '#0b0d0a';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    if (robe) {
      ctx.moveTo(x - 14 * sx, bodyY - 21);
      ctx.quadraticCurveTo(x, bodyY - 28, x + 14 * sx, bodyY - 21);
      ctx.lineTo(x + 22 * sx, footY - 4);
      ctx.quadraticCurveTo(x, footY + 3, x - 22 * sx, footY - 4);
      ctx.closePath();
    } else {
      roundRectPath(ctx, x - 17 * sx, bodyY - 24, 34 * sx, 44, 8);
    }
    ctx.fill();
    ctx.stroke();

    // Chest panels and role trim.
    ctx.fillStyle = pal.clothHi || '#e4d6a7';
    ctx.globalAlpha = 0.34;
    roundRectPath(ctx, x - 10 * sx, bodyY - 18, 20 * sx, robe ? 42 : 30, 6); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = pal.trim || pal.accent || '#d8b36a';
    ctx.lineWidth = 2;
    if (robe) {
      ctx.beginPath();
      ctx.moveTo(x, bodyY - 19);
      ctx.lineTo(x - 5 * sx, footY - 7);
      ctx.moveTo(x, bodyY - 19);
      ctx.lineTo(x + 5 * sx, footY - 7);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x - 13 * sx, bodyY - 5);
      ctx.lineTo(x + 13 * sx, bodyY - 5);
      ctx.stroke();
    }

    // Belt.
    ctx.fillStyle = pal.belt || '#6f5132';
    roundRectPath(ctx, x - 18 * sx, bodyY + 8, 36 * sx, 6, 3); ctx.fill();
    ctx.fillStyle = pal.metal || '#d7d3cb';
    roundRectPath(ctx, x - 3, bodyY + 7, 6, 8, 2); ctx.fill();

    // Arms and hands.
    const armColor = pal.clothDark || pal.cloth;
    ctx.strokeStyle = pal.outline || '#0b0d0a';
    ctx.lineWidth = 2;
    ctx.fillStyle = armColor;
    roundRectPath(ctx, x - 23 * sx, bodyY - 17, 8 * sx, 34, 4); ctx.fill(); ctx.stroke();
    roundRectPath(ctx, x + 15 * sx, bodyY - 17, 8 * sx, 34, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = pal.skin || '#d6a07c';
    ctx.beginPath(); ctx.arc(x - 19 * sx, bodyY + 19, 4.5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 19 * sx, bodyY + 19, 4.5, 0, TAU); ctx.fill(); ctx.stroke();

    drawNpcRoleProp(ctx, x, y, sx, pal, profile, actor, t, pulse);

    // Neck, head, face.
    ctx.fillStyle = pal.skinShadow || '#9a6a50';
    roundRectPath(ctx, x - 5, headY + 11, 10, 10, 3); ctx.fill();
    ctx.fillStyle = pal.skin || '#d6a07c';
    ctx.strokeStyle = pal.outline || '#0b0d0a';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(x, headY, 11.5 * sx, 13.2, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Face readability.
    ctx.fillStyle = '#21150f';
    ctx.globalAlpha = 0.78;
    ctx.beginPath(); ctx.arc(x - 4 * sx, headY - 2, 1.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 4 * sx, headY - 2, 1.4, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = '#4b2b1c';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, headY + 4, 3.5, 0.08 * Math.PI, 0.92 * Math.PI); ctx.stroke();
    ctx.globalAlpha = 1;

    drawNpcHeadgear(ctx, x, headY, sx, pal, profile, actor);

    // Small job aura; subtle enough to not wash out the sprite.
    if (id === 'healer' || id === 'mercAdept' || id === 'bardTrainer') {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.18 + pulse * 0.08;
      ctx.strokeStyle = pal.glow || pal.accent || '#d8b36a';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(x, y - 36, 29 * sx, 12, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    const source = actor.sourceEntity || actor;
    if (source) {
      source._socialIdentityRenderer = profile.id;
      source._nameplateAnchor = { x, y: Math.round(headY - 27) };
    }

    ctx.restore();
    return true;
  }

  function drawNpcHeadgear(ctx, x, headY, sx, pal, profile, actor) {
    const id = profile.id || 'genericNpc';
    ctx.save();
    ctx.strokeStyle = pal.outline || '#0b0d0a';
    ctx.lineWidth = 2;
    const hair = pal.hair || '#4b3326';
    if (id === 'smith') {
      ctx.fillStyle = '#2b1c16';
      roundRectPath(ctx, x - 12 * sx, headY - 13, 24 * sx, 7, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e7ddd1';
      roundRectPath(ctx, x - 15 * sx, headY - 19, 30 * sx, 7, 3); ctx.fill(); ctx.stroke();
    } else if (id === 'fisher' || id === 'surveyor') {
      ctx.fillStyle = pal.accent || '#d8b36a';
      ctx.beginPath(); ctx.ellipse(x, headY - 13, 21 * sx, 5, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = shade(pal.accent || '#d8b36a', -18);
      roundRectPath(ctx, x - 10 * sx, headY - 25, 20 * sx, 13, 5); ctx.fill(); ctx.stroke();
    } else if (id === 'mercRecruiter' || id === 'merchant') {
      ctx.fillStyle = pal.accent || '#d8b36a';
      roundRectPath(ctx, x - 13 * sx, headY - 20, 26 * sx, 10, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = shade(pal.accent || '#d8b36a', -28);
      ctx.fillRect(x - 15 * sx, headY - 12, 30 * sx, 3);
    } else if (id === 'healer') {
      ctx.fillStyle = 'rgba(250,255,246,0.86)';
      ctx.beginPath(); ctx.moveTo(x - 13 * sx, headY - 9); ctx.quadraticCurveTo(x, headY - 25, x + 13 * sx, headY - 9); ctx.lineTo(x + 10 * sx, headY + 10); ctx.quadraticCurveTo(x, headY + 15, x - 10 * sx, headY + 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (id === 'mossfangScout' || id === 'mercScout') {
      ctx.fillStyle = shade(pal.clothDark || '#1b222a', 4);
      ctx.beginPath(); ctx.moveTo(x - 13 * sx, headY - 6); ctx.quadraticCurveTo(x, headY - 25, x + 13 * sx, headY - 6); ctx.lineTo(x + 9 * sx, headY + 10); ctx.quadraticCurveTo(x, headY + 13, x - 9 * sx, headY + 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (id === 'roadWarden') {
      ctx.fillStyle = pal.metal || '#d6d9dd';
      roundRectPath(ctx, x - 12 * sx, headY - 19, 24 * sx, 12, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = pal.accent || '#d8b36a';
      ctx.fillRect(x - 2, headY - 26, 4, 8);
    } else {
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.ellipse(x, headY - 9, 12 * sx, 7, 0, Math.PI, TAU);
      ctx.fill();
      ctx.stroke();
      if (id === 'bardTrainer') {
        ctx.strokeStyle = pal.trim || '#ffe298';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x + 8 * sx, headY - 18); ctx.quadraticCurveTo(x + 20 * sx, headY - 25, x + 23 * sx, headY - 12); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawNpcRoleProp(ctx, x, y, sx, pal, profile, actor, t, pulse) {
    const id = profile.id || 'genericNpc';
    ctx.save();
    ctx.strokeStyle = pal.outline || '#0b0d0a';
    ctx.lineWidth = 2.2;
    if (id === 'healer' || id === 'mercAdept' || String(actor.trainerClass || '').match(/Cleric|Druid|Summoner|Enchanter|Necromancer/)) {
      ctx.strokeStyle = pal.metal || '#ded9cf';
      ctx.beginPath(); ctx.moveTo(x - 28 * sx, y - 8); ctx.lineTo(x - 21 * sx, y - 64); ctx.stroke();
      ctx.fillStyle = pal.glow || pal.accent;
      ctx.beginPath(); ctx.arc(x - 21 * sx, y - 67, 5 + pulse * 1.5, 0, TAU); ctx.fill(); ctx.stroke();
    } else if (id === 'smith') {
      ctx.fillStyle = pal.metal || '#d6d6d6';
      ctx.save(); ctx.translate(x + 28 * sx, y - 35); ctx.rotate(-0.55); roundRectPath(ctx, -3, -18, 6, 32, 3); ctx.fill(); ctx.stroke(); roundRectPath(ctx, -10, -22, 20, 8, 3); ctx.fill(); ctx.stroke(); ctx.restore();
    } else if (id === 'fisher') {
      ctx.strokeStyle = pal.glow || '#cdf6ff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 23 * sx, y - 5); ctx.quadraticCurveTo(x + 37 * sx, y - 52, x + 19 * sx, y - 82); ctx.stroke();
      ctx.fillStyle = pal.belt || '#6f5132';
      roundRectPath(ctx, x - 31 * sx, y - 19, 9 * sx, 11, 3); ctx.fill(); ctx.stroke();
    } else if (id === 'merchant') {
      ctx.fillStyle = '#8b5a2b';
      roundRectPath(ctx, x - 33 * sx, y - 42, 17 * sx, 22, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = pal.trim || '#f8d177';
      ctx.fillRect(x - 30 * sx, y - 37, 11 * sx, 3);
    } else if (id === 'mercRecruiter') {
      ctx.fillStyle = '#ead9aa';
      roundRectPath(ctx, x + 18 * sx, y - 46, 18 * sx, 22, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = pal.accent || '#c2ec9e';
      ctx.fillRect(x + 21 * sx, y - 40, 12 * sx, 3);
    } else if (id === 'roadWarden') {
      ctx.strokeStyle = pal.metal || '#d7d3cb';
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 26 * sx, y - 7); ctx.lineTo(x + 30 * sx, y - 70); ctx.stroke();
      ctx.fillStyle = pal.accent || '#9fb6c7';
      ctx.beginPath(); ctx.moveTo(x + 30 * sx, y - 78); ctx.lineTo(x + 38 * sx, y - 64); ctx.lineTo(x + 24 * sx, y - 66); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (id === 'bardTrainer') {
      ctx.fillStyle = '#7a5034';
      ctx.beginPath(); ctx.ellipse(x - 26 * sx, y - 38, 9 * sx, 14, -0.35, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = pal.trim || '#ffe298';
      ctx.lineWidth = 1.2;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x - (31 - i * 3) * sx, y - 48); ctx.lineTo(x - (21 - i * 3) * sx, y - 28); ctx.stroke(); }
    }
    ctx.restore();
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(Number(r) || 0, Math.abs(w) / 2, Math.abs(h) / 2));
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }

  function hashCode(value) {
    let h = 0;
    const s = String(value || 'npc');
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return h;
  }

  function scalePose(pose, profile) {
    const m = profile.posture || {};
    return applySocialAnimationIdentity({
      ...pose,
      armSwing: pose.armSwing * (m.armSwing ?? 1),
      legSwing: pose.legSwing * (m.stride ?? 1),
      torsoBob: pose.torsoBob * (m.torsoBob ?? 1),
      headBob: pose.headBob * (m.headBob ?? 1),
      lean: pose.lean * (m.lean ?? 1),
      castPulse: pose.castPulse * (m.castPulse ?? 1),
      clothSway: pose.clothSway * (m.cloth ?? 1),
      capeSway: pose.capeSway * (m.cape ?? 1),
      socialProfileId: profile.id
    }, profile);
  }

  function applySocialAnimationIdentity(pose, profile) {
    const p = { ...pose };
    const id = profile.id;
    const t = p.t || 0;
    const pulse = 0.5 + Math.sin(t * 2.5 + (p.seed || 0)) * 0.5;
    p.socialPulse = pulse;
    p.jobSwing = Math.sin(t * (id === 'smith' ? 3.7 : id === 'cook' ? 2.8 : id === 'bardTrainer' ? 3.1 : 2.0) + (p.seed || 0));

    if (id === 'smith') {
      p.armSwing += p.jobSwing * 2.6;
      p.torsoBob -= Math.max(0, p.jobSwing) * 0.8;
    } else if (id === 'cook') {
      p.armSwing += p.jobSwing * 1.4;
      p.headBob += Math.sin(t * 1.7) * 0.18;
    } else if (id === 'fisher') {
      p.lean += Math.sin(t * 1.2) * 0.35;
      p.armSwing += Math.sin(t * 1.8) * 0.8;
    } else if (id === 'merchant') {
      p.headBob += pulse * 0.22;
      p.capeSway *= 0.6;
    } else if (id === 'bardTrainer') {
      p.torsoBob += Math.sin(t * 2.6) * 0.32;
      p.armSwing += Math.sin(t * 2.8) * 1.0;
    } else if (id === 'mossfangScout' || id === 'mercScout') {
      p.torsoBob -= 0.8;
      p.lean += Math.sin(t * 1.9) * 0.32;
    } else if (id === 'roadWarden' || id === 'mercGuardian') {
      p.torsoBob *= 0.72;
      p.headBob *= 0.62;
    } else if (id === 'healer' || id === 'mercCleric') {
      p.torsoBob *= 0.62;
      p.headBob *= 0.70;
      p.castPulse = Math.max(p.castPulse, pulse * 0.34);
    } else if (id === 'surveyor' || id === 'townGuide') {
      p.headBob += Math.sin(t * 1.3) * 0.22;
    } else if (id === 'mercAdept') {
      p.torsoBob += Math.sin(t * 2.1) * 0.30;
      p.castPulse = Math.max(p.castPulse, pulse * 0.46);
    }
    return p;
  }

  function paletteFor(actor, profile) {
    const p = profile.palette;
    const actorPalette = actor.palette || actor.visualPalette || {};
    return {
      ...p,
      skin: actor.skinTone || actorPalette.skin || p.skin,
      hair: actor.hairColor || actorPalette.hair || p.hair,
      cloth: actor.clothesPrimary || actorPalette.cloth || p.cloth,
      clothHi: actor.clothesSecondary || actorPalette.clothHi || p.clothHi,
      accent: actor.color || actorPalette.accent || p.accent,
      glow: actorPalette.glow || p.glow
    };
  }

  function buildHooks(profile, actor, pose) {
    return {
      back(ctx, rig, palette) {
        drawBackLayer(ctx, rig, palette, profile);
        drawBackProp(ctx, rig, palette, profile, pose);
      },
      backCape(ctx, rig, palette) {
        drawBackCape(ctx, rig, palette, profile, pose);
      },
      torsoOverlay(ctx, rig, palette) {
        drawTorsoLayer(ctx, rig, palette, profile, pose);
      },
      chest(ctx, rig, palette) {
        drawShoulders(ctx, rig, palette, profile);
        drawChestLayer(ctx, rig, palette, profile);
        drawBeltLayer(ctx, rig, palette, profile);
      },
      hair(ctx, rig, palette) {
        drawHeadLayer(ctx, rig, palette, profile, pose);
      },
      mid(ctx, rig, palette) {
        drawMidLayer(ctx, rig, palette, profile);
      },
      front(ctx, rig, palette) {
        drawFrontProps(ctx, rig, palette, profile, pose);
      },
      effects(ctx, rig, palette) {
        drawEffects(ctx, rig, palette, profile, actor, pose);
      }
    };
  }


  function chestAnchor(rig) { return rig?.anchors?.chest || rig?.anchors?.torso || { x: 0, y: -42 }; }
  function pelvisAnchor(rig) { return rig?.anchors?.pelvis || rig?.anchors?.hips || { x: 0, y: -10 }; }
  function mainHandAnchor(rig) { return rig?.anchors?.mainHand || rig?.anchors?.handMain || rig?.anchors?.arms?.near?.hand || { x: 14, y: -12 }; }
  function offHandAnchor(rig) { return rig?.anchors?.offHand || rig?.anchors?.handOff || rig?.anchors?.arms?.far?.hand || { x: -14, y: -12 }; }
  function bodyTop(rig) { return chestAnchor(rig); }
  function bodyBelt(rig) { return rig?.anchors?.belt || pelvisAnchor(rig); }
  function glowEllipse(ctx, x, y, rx, ry, fill) { Base.ellipse(ctx, x, y, rx, ry, 0, fill, null, 0); }

  function drawBackLayer(ctx, rig, palette, profile) {
    const BaseR = Base;
    const torso = chestAnchor(rig);
    const s = rig.dir.side || 1;
    const back = profile.layers.back;
    if (back === 'none') return;
    if (back === 'guardCape' || back === 'officerCape' || back === 'performerCape' || back === 'travelerCape' || back === 'arcaneCoat' || back === 'prayerRobe' || back === 'medicRobe' || back === 'shortCape' || back === 'splitCloak' || back === 'apronBack') {
      const width = back === 'guardCape' || back === 'officerCape' ? 18 : back === 'splitCloak' ? 15 : 16;
      const len = back === 'prayerRobe' || back === 'medicRobe' ? 34 : back === 'arcaneCoat' ? 31 : 24;
      BaseR.poly(ctx, [
        { x: torso.x - width, y: torso.y - 16 },
        { x: torso.x + width, y: torso.y - 16 },
        { x: torso.x + width - 3 + rig.pose.capeSway * 0.4, y: torso.y + len - 2 },
        { x: torso.x + 2 + rig.pose.capeSway * 0.2, y: torso.y + len - 9 },
        { x: torso.x - width + 3 + rig.pose.capeSway * 0.15, y: torso.y + len - 1 }
      ], shade(palette.clothDark, 8), palette.outline, 1.6);
      if (back === 'splitCloak') {
        BaseR.line(ctx, torso.x - 1, torso.y - 6, torso.x + 1, torso.y + len - 4, shade(palette.clothHi, 18), 1.1);
      }
    }

    if (profile.layers.offProp === 'floatingOrb' && !rig.dir.backVisible) {
      const hand = offHandAnchor(rig);
      BaseR.ellipse(ctx, hand.x - 8 * s, hand.y - 10, 7, 7, 0, 'rgba(134,255,241,0.18)', null, 0);
      BaseR.ellipse(ctx, hand.x - 8 * s, hand.y - 10, 3.5, 3.5, 0, palette.glow, palette.outline, 1.0);
    }
  }

  function drawBackProp(ctx, rig, palette, profile) {
    const BaseR = Base;
    const torso = chestAnchor(rig);
    const s = rig.dir.side || 1;
    if (profile.layers.mainProp === 'shortBow') {
      BaseR.line(ctx, torso.x - 17 * s, torso.y - 9, torso.x - 23 * s, torso.y + 24, '#8e6337', 2.2);
      BaseR.line(ctx, torso.x - 12 * s, torso.y - 7, torso.x - 16 * s, torso.y + 21, '#d6cba8', 1.0);
    } else if (profile.layers.mainProp === 'lute' && rig.dir.backVisible) {
      BaseR.ellipse(ctx, torso.x - 12 * s, torso.y + 2, 10, 14, 0, '#9a6535', palette.outline, 1.4);
      BaseR.line(ctx, torso.x - 7 * s, torso.y - 10, torso.x - 17 * s, torso.y + 7, '#6f4a28', 2.0);
    } else if (profile.layers.mainProp === 'rod' && rig.dir.backVisible) {
      BaseR.line(ctx, torso.x + 10 * s, torso.y - 14, torso.x + 34 * s, torso.y - 56, '#7a542f', 1.8);
    }
  }

  function drawBackCape(ctx, rig, palette, profile) {
    // reserved hook: Base already handles silhouette well; keep subtle trim only.
    if (profile.layers.back === 'performerCape' || profile.layers.back === 'guardCape' || profile.layers.back === 'officerCape') {
      Base.line(ctx, chestAnchor(rig).x - 10, chestAnchor(rig).y - 9, chestAnchor(rig).x + 10, chestAnchor(rig).y - 9, palette.accent, 1.3);
    }
  }

  function drawTorsoLayer(ctx, rig, palette, profile) {
    const BaseR = Base;
    const torso = chestAnchor(rig);
    const sx = profile.silhouette.shoulder || 1;
    const tx = profile.silhouette.torso || 1;
    const hem = profile.silhouette.hem || 1;

    const wTop = 12 * sx;
    const wMid = 15 * tx;
    const hemHalf = 16 * hem;
    const skirt = profile.layers.torso;
    const fill = skirt === 'brigandine' || skirt === 'wardenArmor' ? palette.metalDark : skirt === 'smithApron' || skirt === 'cookApron' ? '#e8decc' : palette.cloth;
    BaseR.poly(ctx, [
      { x: torso.x - wTop, y: torso.y - 17 },
      { x: torso.x + wTop, y: torso.y - 17 },
      { x: torso.x + wMid, y: torso.y + 4 },
      { x: torso.x + hemHalf, y: torso.y + 28 },
      { x: torso.x - hemHalf, y: torso.y + 28 },
      { x: torso.x - wMid, y: torso.y + 4 }
    ], fill, palette.outline, 1.7);

    if (skirt === 'fieldVestment' || skirt === 'healerVestment' || skirt === 'channelerRobe' || skirt === 'bardCoat' || skirt === 'surveyorCoat' || skirt === 'merchantCoat') {
      BaseR.line(ctx, torso.x, torso.y - 13, torso.x, torso.y + 25, palette.clothHi, 1.1);
    }
    if (skirt === 'brigandine' || skirt === 'wardenArmor') {
      for (let i = -1; i <= 1; i++) {
        BaseR.roundRect(ctx, torso.x - 10 + i * 7, torso.y - 8, 6, 15, 1.5, palette.metal, palette.outline, 1.0);
      }
    }
    if (skirt === 'smithApron' || skirt === 'cookApron') {
      BaseR.roundRect(ctx, torso.x - 7, torso.y - 6, 14, 24, 2, fill, palette.outline, 1.0);
      BaseR.line(ctx, torso.x - 8, torso.y - 6, torso.x - 12, torso.y - 16, palette.belt, 1.0);
      BaseR.line(ctx, torso.x + 8, torso.y - 6, torso.x + 12, torso.y - 16, palette.belt, 1.0);
    }
  }

  function drawShoulders(ctx, rig, palette, profile) {
    const BaseR = Base;
    const torso = chestAnchor(rig);
    const shoulderMode = profile.layers.shoulders;
    if (shoulderMode === 'none') return;
    const left = { x: torso.x - 15, y: torso.y - 15 };
    const right = { x: torso.x + 15, y: torso.y - 15 };
    const fill = shoulderMode === 'heavyPauldrons' || shoulderMode === 'lightPauldrons' ? palette.metal : shoulderMode === 'softMantle' ? palette.clothHi : palette.clothDark;
    BaseR.poly(ctx, [{ x: left.x - 6, y: left.y - 2 }, { x: left.x + 6, y: left.y - 5 }, { x: left.x + 8, y: left.y + 7 }, { x: left.x - 7, y: left.y + 5 }], fill, palette.outline, 1.2);
    BaseR.poly(ctx, [{ x: right.x - 6, y: right.y - 5 }, { x: right.x + 6, y: right.y - 2 }, { x: right.x + 7, y: right.y + 5 }, { x: right.x - 8, y: right.y + 7 }], fill, palette.outline, 1.2);
    if (shoulderMode === 'rolledSleeves') {
      BaseR.line(ctx, left.x - 5, left.y + 1, left.x + 5, left.y + 2, palette.accent, 1.0);
      BaseR.line(ctx, right.x - 5, right.y + 2, right.x + 5, right.y + 1, palette.accent, 1.0);
    }
  }

  function drawChestLayer(ctx, rig, palette, profile) {
    const BaseR = Base;
    const torso = chestAnchor(rig);
    const chest = profile.layers.chest;
    if (chest === 'none') return;
    if (chest === 'crossStole') {
      BaseR.line(ctx, torso.x - 7, torso.y - 15, torso.x - 2, torso.y + 14, palette.accent, 3.0);
      BaseR.line(ctx, torso.x + 7, torso.y - 15, torso.x + 2, torso.y + 14, palette.accent, 3.0);
      BaseR.line(ctx, torso.x - 4, torso.y - 1, torso.x + 4, torso.y - 1, palette.accent, 1.2);
      BaseR.line(ctx, torso.x, torso.y - 6, torso.x, torso.y + 4, palette.accent, 1.2);
      return;
    }
    if (chest === 'contractBadge' || chest === 'badge') {
      BaseR.roundRect(ctx, torso.x - 4, torso.y - 6, 8, 8, 1.8, palette.accent, palette.outline, 1.0);
      return;
    }
    if (chest === 'rankSash' || chest === 'songTrim' || chest === 'roadStrap' || chest === 'ledgerStrap' || chest === 'crossStrap' || chest === 'bandolier' || chest === 'compassStrap' || chest === 'hookStrap' || chest === 'runeChain') {
      BaseR.line(ctx, torso.x - 10, torso.y - 13, torso.x + 10, torso.y + 11, palette.accent, 2.0);
      if (chest === 'compassStrap') BaseR.ellipse(ctx, torso.x + 8, torso.y + 10, 3.5, 3.5, 0, palette.trim || palette.accent, palette.outline, 1.0);
      if (chest === 'hookStrap') BaseR.line(ctx, torso.x + 8, torso.y + 7, torso.x + 12, torso.y + 12, '#e5ddd0', 1.0);
      return;
    }
    if (chest === 'crestTabard') {
      BaseR.roundRect(ctx, torso.x - 5, torso.y - 13, 10, 18, 1.5, palette.accent, palette.outline, 1.0);
      BaseR.line(ctx, torso.x - 2, torso.y - 7, torso.x + 2, torso.y - 7, palette.clothHi, 1.0);
      return;
    }
    if (chest === 'apronPatch') {
      BaseR.roundRect(ctx, torso.x - 4, torso.y - 2, 8, 6, 1.5, palette.accent, palette.outline, 1.0);
    }
  }

  function drawBeltLayer(ctx, rig, palette, profile) {
    const BaseR = Base;
    const hips = bodyBelt(rig);
    BaseR.roundRect(ctx, hips.x - 15, hips.y - 2, 30, 5, 1.5, palette.belt, palette.outline, 1.0);
    BaseR.roundRect(ctx, hips.x - 3, hips.y - 3, 6, 7, 1.2, palette.accent, palette.outline, 1.0);
    const beltType = profile.layers.belt;
    if (beltType === 'coinBelt' || beltType === 'toolBelt' || beltType === 'knifeBelt' || beltType === 'satchelBelt' || beltType === 'utilityBelt' || beltType === 'contractBelt') {
      BaseR.roundRect(ctx, hips.x - 18, hips.y + 1, 5, 7, 1, shade(palette.belt, 12), palette.outline, 0.9);
      BaseR.roundRect(ctx, hips.x + 13, hips.y + 1, 5, 7, 1, shade(palette.belt, 12), palette.outline, 0.9);
    }
  }

  function drawHeadLayer(ctx, rig, palette, profile, pose) {
    const BaseR = Base;
    const head = rig.anchors.head;
    const hat = profile.layers.head;
    const s = rig.dir.side || 1;
    if (hat === 'hair' || !hat) return;
    if (hat === 'hood' || hat === 'shadowHood') {
      BaseR.poly(ctx, [
        { x: head.x - head.rx - 3, y: head.y - 5 },
        { x: head.x - head.rx + 1, y: head.y - 19 },
        { x: head.x, y: head.y - 24 },
        { x: head.x + head.rx + 3, y: head.y - 14 },
        { x: head.x + head.rx, y: head.y - 1 },
        { x: head.x - head.rx + 1, y: head.y + 1 }
      ], shade(palette.clothDark, 8), palette.outline, 1.6);
      return;
    }
    if (hat === 'chefHat') {
      BaseR.ellipse(ctx, head.x, head.y - 20, 14, 7, 0, '#f7f1e4', palette.outline, 1.1);
      BaseR.roundRect(ctx, head.x - 11, head.y - 18, 22, 8, 2, '#efe7d8', palette.outline, 1.0);
      return;
    }
    if (hat === 'crestHelm' || hat === 'halfHelm') {
      BaseR.poly(ctx, [
        { x: head.x - head.rx - 2, y: head.y - 2 },
        { x: head.x - head.rx + 1, y: head.y - 17 },
        { x: head.x + 1, y: head.y - 21 },
        { x: head.x + head.rx + 2, y: head.y - 15 },
        { x: head.x + head.rx, y: head.y - 1 },
        { x: head.x - head.rx + 1, y: head.y + 2 }
      ], palette.metal, palette.outline, 1.4);
      if (hat === 'crestHelm') BaseR.line(ctx, head.x, head.y - 22, head.x, head.y - 33, palette.accent, 1.8);
      return;
    }
    if (hat === 'cap') {
      BaseR.ellipse(ctx, head.x, head.y - 12, 12, 5, 0, palette.clothDark, palette.outline, 1.0);
      BaseR.roundRect(ctx, head.x - 8, head.y - 13, 16, 8, 1.8, palette.cloth, palette.outline, 1.0);
      return;
    }
    if (hat === 'band') {
      BaseR.line(ctx, head.x - 11, head.y - 9, head.x + 11, head.y - 9, palette.accent, 2.2);
      return;
    }
    if (hat === 'circlet') {
      BaseR.line(ctx, head.x - 10, head.y - 7, head.x + 10, head.y - 7, palette.accent, 2.0);
      BaseR.ellipse(ctx, head.x, head.y - 8, 2.8, 2.8, 0, palette.glow, palette.outline, 0.8);
      return;
    }
    if (hat === 'wideHat') {
      BaseR.ellipse(ctx, head.x, head.y - 12, 17, 5, 0, '#6f5730', palette.outline, 1.1);
      BaseR.poly(ctx, [
        { x: head.x - 7, y: head.y - 12 },
        { x: head.x + 7, y: head.y - 12 },
        { x: head.x + 4, y: head.y - 23 },
        { x: head.x - 4, y: head.y - 23 }
      ], '#8a6a38', palette.outline, 1.0);
      return;
    }
    if (hat === 'feather') {
      BaseR.line(ctx, head.x + 8 * s, head.y - 16, head.x + 16 * s, head.y - 27, palette.accent, 1.6);
      BaseR.ellipse(ctx, head.x + 18 * s, head.y - 27, 3.5, 7, 0, palette.accent, palette.outline, 0.8);
      return;
    }
    if (hat === 'veil' || hat === 'healerVeil') {
      BaseR.poly(ctx, [
        { x: head.x - 12, y: head.y - 13 },
        { x: head.x, y: head.y - 23 },
        { x: head.x + 12, y: head.y - 13 },
        { x: head.x + 9, y: head.y + 10 },
        { x: head.x - 9, y: head.y + 10 }
      ], 'rgba(245,248,242,0.75)', palette.outline, 1.0);
    }
  }

  function drawMidLayer(ctx, rig, palette, profile) {
    // Mid hook reserved for orbiting orb.
    if (profile.layers.offProp === 'floatingOrb' && !rig.dir.backVisible) {
      const hand = offHandAnchor(rig);
      Base.ellipse(ctx, hand.x - 8 * (rig.dir.side || 1), hand.y - 10, 7, 7, 0, 'rgba(134,255,241,0.18)', null, 0);
      Base.ellipse(ctx, hand.x - 8 * (rig.dir.side || 1), hand.y - 10, 3.5, 3.5, 0, palette.glow, palette.outline, 1.0);
    }
  }

  function drawFrontProps(ctx, rig, palette, profile) {
    const BaseR = Base;
    const main = profile.layers.mainProp;
    const off = profile.layers.offProp;
    const mh = mainHandAnchor(rig);
    const oh = offHandAnchor(rig);
    const s = rig.dir.side || 1;

    if (main === 'sword') {
      BaseR.line(ctx, mh.x, mh.y, mh.x + 11 * s, mh.y - 18, '#6f4d2d', 2.5);
      BaseR.line(ctx, mh.x + 11 * s, mh.y - 18, mh.x + 19 * s, mh.y - 33, palette.metal, 2.6);
      BaseR.line(ctx, mh.x + 7 * s, mh.y - 18, mh.x + 15 * s, mh.y - 18, palette.accent, 1.0);
    } else if (main === 'mace') {
      BaseR.line(ctx, mh.x, mh.y, mh.x + 9 * s, mh.y - 18, '#7a5734', 2.6);
      BaseR.ellipse(ctx, mh.x + 12 * s, mh.y - 22, 4.5, 4.5, 0, palette.metal, palette.outline, 1.0);
    } else if (main === 'wand') {
      BaseR.line(ctx, mh.x, mh.y, mh.x + 13 * s, mh.y - 20, '#7d6646', 2.2);
      BaseR.ellipse(ctx, mh.x + 14 * s, mh.y - 21, 3.2, 3.2, 0, palette.glow, palette.outline, 0.8);
    } else if (main === 'dagger') {
      BaseR.line(ctx, mh.x, mh.y, mh.x + 8 * s, mh.y - 10, '#6b4c2d', 2.0);
      BaseR.line(ctx, mh.x + 8 * s, mh.y - 10, mh.x + 13 * s, mh.y - 18, palette.metal, 1.8);
      BaseR.line(ctx, oh.x, oh.y, oh.x - 6 * s, oh.y - 10, '#6b4c2d', 2.0);
      BaseR.line(ctx, oh.x - 6 * s, oh.y - 10, oh.x - 11 * s, oh.y - 17, palette.metal, 1.8);
    } else if (main === 'ledger') {
      BaseR.roundRect(ctx, mh.x - 10 * s, mh.y - 15, 16, 12, 1.5, '#e6d6aa', palette.outline, 1.0);
      BaseR.line(ctx, mh.x - 7 * s, mh.y - 10, mh.x + 2 * s, mh.y - 10, '#8b744c', 0.9);
    } else if (main === 'scroll' || main === 'contract' || main === 'map') {
      BaseR.roundRect(ctx, mh.x - 10 * s, mh.y - 13, 14, 10, 1.5, main === 'map' ? '#dbc48c' : '#f1e0b2', palette.outline, 1.0);
      BaseR.line(ctx, mh.x - 7 * s, mh.y - 9, mh.x + 1 * s, mh.y - 9, '#7c643d', 0.8);
    } else if (main === 'ladle') {
      BaseR.line(ctx, mh.x, mh.y, mh.x + 10 * s, mh.y - 14, '#9a6740', 2.0);
      BaseR.ellipse(ctx, mh.x + 13 * s, mh.y - 17, 4, 3, 0, palette.metal, palette.outline, 0.8);
    } else if (main === 'hammer') {
      BaseR.line(ctx, mh.x, mh.y, mh.x + 12 * s, mh.y - 14, '#9a6740', 2.8);
      BaseR.roundRect(ctx, mh.x + 8 * s, mh.y - 19, 10, 6, 1.2, palette.metal, palette.outline, 1.0);
    } else if (main === 'staff') {
      BaseR.line(ctx, mh.x + 2 * s, mh.y + 6, mh.x + 10 * s, mh.y - 42, '#7a5a32', 2.6);
      BaseR.ellipse(ctx, mh.x + 12 * s, mh.y - 46, 4, 4, 0, palette.glow, palette.outline, 0.8);
    } else if (main === 'spear') {
      BaseR.line(ctx, mh.x + 2 * s, mh.y + 7, mh.x + 8 * s, mh.y - 46, '#6e4d2f', 2.4);
      BaseR.poly(ctx, [
        { x: mh.x + 8 * s, y: mh.y - 53 },
        { x: mh.x + 13 * s, y: mh.y - 44 },
        { x: mh.x + 8 * s, y: mh.y - 39 },
        { x: mh.x + 3 * s, y: mh.y - 44 }
      ], palette.metal, palette.outline, 0.9);
    } else if (main === 'shortBow') {
      BaseR.line(ctx, mh.x + 8 * s, mh.y - 17, mh.x + 14 * s, mh.y + 9, '#8a5a2a', 2.1);
      BaseR.line(ctx, mh.x + 8 * s, mh.y - 17, mh.x + 14 * s, mh.y + 9, 'rgba(0,0,0,0)', 0.0);
      BaseR.line(ctx, mh.x + 10 * s, mh.y - 16, mh.x + 10 * s, mh.y + 8, '#dfd7b7', 0.9);
    } else if (main === 'lute') {
      BaseR.ellipse(ctx, mh.x - 6 * s, mh.y - 4, 11, 14, 0, '#9a6535', palette.outline, 1.2);
      BaseR.line(ctx, mh.x + 2 * s, mh.y - 14, mh.x + 12 * s, mh.y - 28, '#6d4928', 2.4);
      for (let i = -2; i <= 2; i++) BaseR.line(ctx, mh.x - 5 * s + i, mh.y + 4, mh.x + 11 * s + i * 0.4, mh.y - 28, '#f2dfad', 0.7);
    } else if (main === 'rod') {
      BaseR.line(ctx, mh.x, mh.y, mh.x + 32 * s, mh.y - 42, '#6d4525', 1.8);
      BaseR.line(ctx, mh.x + 7 * s, mh.y - 3, mh.x + 29 * s, mh.y - 39, '#d7d0bd', 0.8);
    }

    if (off === 'shield' || off === 'buckler') {
      BaseR.ellipse(ctx, oh.x - 8 * s, oh.y - 6, off === 'shield' ? 9 : 6.5, off === 'shield' ? 12 : 8.5, 0, shade(palette.metal, 8), palette.outline, 1.1);
      BaseR.line(ctx, oh.x - 8 * s, oh.y - 15, oh.x - 8 * s, oh.y + 3, palette.accent, 1.0);
    } else if (off === 'scripture') {
      BaseR.roundRect(ctx, oh.x - 11 * s, oh.y - 11, 12, 10, 1.2, '#e7dfc2', palette.outline, 1.0);
    } else if (off === 'coinPurse' || off === 'spicePouch' || off === 'lanternCharm' || off === 'badge' || off === 'marker' || off === 'healingCharm' || off === 'baitBucket') {
      const fill = off === 'lanternCharm' ? '#f0cf7f' : off === 'healingCharm' ? palette.glow : shade(palette.belt, 10);
      BaseR.roundRect(ctx, oh.x - 6 * s, oh.y - 6, 8, 8, 1.2, fill, palette.outline, 1.0);
      if (off === 'healingCharm') BaseR.ellipse(ctx, oh.x - 2 * s, oh.y - 2, 2, 2, 0, '#ffffff', null, 0);
    }
  }

  function drawEffects(ctx, rig, palette, profile, actor, pose) {
    const BaseR = Base;
    const head = rig.anchors.head;
    const torso = chestAnchor(rig);
    const pulse = 0.5 + Math.sin((performance.now() * 0.006) + (Number(actor.x || 0) + Number(actor.y || 0))) * 0.5;

    drawSocialAnimationIdentity(ctx, rig, palette, profile, actor, pose, pulse);
    drawSocialCombatReadability(ctx, rig, palette, profile, actor, pose, pulse);

    if (profile.id === 'healer' || profile.id === 'mercCleric') {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      BaseR.ellipse(ctx, torso.x, torso.y - 6, 20 + pulse * 2, 12 + pulse, 0, 'rgba(246,255,206,0.10)', null, 0);
      BaseR.ellipse(ctx, head.x + 12, head.y - 24, 2.4, 2.4, 0, palette.glow, null, 0);
      BaseR.ellipse(ctx, head.x - 14, head.y - 18, 1.8, 1.8, 0, palette.glow, null, 0);
      ctx.restore();
    } else if (profile.id === 'mercAdept') {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      BaseR.ellipse(ctx, offHandAnchor(rig).x - 8 * (rig.dir.side || 1), offHandAnchor(rig).y - 10, 9 + pulse, 9 + pulse, 0, 'rgba(117,255,240,0.12)', null, 0);
      ctx.restore();
    } else if (profile.id === 'smith') {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      BaseR.ellipse(ctx, mainHandAnchor(rig).x + 10, mainHandAnchor(rig).y - 20, 1.6, 1.6, 0, '#ffbd68', null, 0);
      BaseR.ellipse(ctx, mainHandAnchor(rig).x + 14, mainHandAnchor(rig).y - 25, 1.2, 1.2, 0, '#ffd9a0', null, 0);
      ctx.restore();
    } else if (profile.id === 'mercRecruiter') {
      BaseR.roundRect(ctx, torso.x + 13, torso.y - 21, 10, 8, 1.2, 'rgba(219,255,173,0.18)', palette.accent, 0.7);
    }
  }

  function drawSocialCombatReadability(ctx, rig, palette, profile, actor, pose, pulse) {
    const BaseR = Base;
    const torso = chestAnchor(rig);
    const mh = mainHandAnchor(rig);
    const oh = offHandAnchor(rig);
    const side = rig.dir?.side || 1;
    const ground = rig.anchors?.ground || { x: 0, y: 0 };
    const attack = pose.action === 'attack' ? (pose.attackCurve || 0.65) : 0;
    const cast = pose.action === 'cast' ? (pose.castPulse || 0.5) : 0;
    const hit = pose.hitFlash || 0;

    if (attack > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const alpha = 0.18 + attack * 0.34;
      if (profile.id === 'mercGuardian' || profile.id === 'roadWarden') {
        ctx.globalAlpha = alpha;
        BaseR.ellipse(ctx, ground.x + side * 7, ground.y + 1, 21 + attack * 7, 4.5 + attack, 0, palette.accent, null, 0);
        drawSocialArc(ctx, mh.x + side * 8, mh.y - 18, side, 23 + attack * 8, '#fff1c2', alpha);
      } else if (profile.id === 'mercScout' || profile.id === 'mossfangScout') {
        drawSocialArc(ctx, mh.x + side * 3, mh.y - 6, side, 17 + attack * 5, palette.glow, alpha + 0.14);
        drawSocialArc(ctx, oh.x - side * 2, oh.y - 6, -side, 13 + attack * 4, palette.metal, alpha);
        BaseR.line(ctx, torso.x - side * 16, torso.y + 18, torso.x - side * 29, torso.y + 20, palette.glow, 1.1, alpha);
      } else if (profile.id === 'mercCleric' || profile.id === 'healer') {
        BaseR.ellipse(ctx, ground.x, ground.y + 2, 18 + attack * 5, 5, 0, palette.glow, null, 0);
        drawSocialTicks(ctx, mh.x + side * 8, mh.y - 17, palette.glow, alpha);
      } else if (profile.id === 'mercAdept') {
        BaseR.ellipse(ctx, torso.x, torso.y + 3, 20 + attack * 6, 7 + attack, 0, 'rgba(117,255,240,0.16)', null, 0);
        drawSocialTicks(ctx, oh.x - side * 8, oh.y - 11, palette.glow, alpha + 0.12);
      } else if (profile.id === 'smith') {
        drawSocialTicks(ctx, mh.x + side * 12, mh.y - 19, '#ffd49a', alpha + 0.12);
      }
      ctx.restore();
    }

    if (cast > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      if (profile.id === 'mercCleric' || profile.id === 'healer') {
        ctx.globalAlpha = 0.18 + cast * 0.24;
        BaseR.ellipse(ctx, ground.x, ground.y + 2, 33 + cast * 8, 10 + cast * 2, 0, palette.glow, null, 0);
        drawSocialTicks(ctx, torso.x, torso.y - 8, palette.glow, 0.24 + cast * 0.22);
      } else if (profile.id === 'mercAdept') {
        ctx.globalAlpha = 0.20 + cast * 0.28;
        BaseR.ellipse(ctx, ground.x, ground.y + 2, 30 + cast * 10, 9 + cast * 2, 0, 'rgba(117,255,240,0.16)', null, 0);
        drawSocialTicks(ctx, oh.x - side * 8, oh.y - 11, palette.glow, 0.24 + cast * 0.24);
      } else if (profile.id === 'bardTrainer') {
        BaseR.ellipse(ctx, torso.x, torso.y + 1, 25 + cast * 5, 8 + cast, 0, 'rgba(255,226,152,0.16)', null, 0);
      }
      ctx.restore();
    }

    if (hit > 0) {
      drawSocialTicks(ctx, torso.x, torso.y + 2, '#ffffff', Math.min(0.65, hit));
    }

    if (pose.action === 'death') {
      ctx.save();
      ctx.globalAlpha = 0.18 + (1 - pose.deathProgress) * 0.16;
      BaseR.ellipse(ctx, ground.x, ground.y + 3, 28 + pose.deathProgress * 8, 6 + pose.deathProgress * 2, 0, palette.clothDark, null, 0);
      ctx.restore();
    }
  }

  function drawSocialArc(ctx, x, y, side, radius, color, alpha) {
    const BaseR = Base;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = alpha == null ? 0.45 : alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y, radius, side > 0 ? -1.08 : Math.PI + 1.08, side > 0 ? 0.30 : Math.PI - 0.30, side < 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawSocialTicks(ctx, x, y, color, alpha) {
    const BaseR = Base;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = alpha == null ? 0.42 : alpha;
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6;
      BaseR.line(ctx, x + Math.cos(a) * 5, y + Math.sin(a) * 5, x + Math.cos(a) * 13, y + Math.sin(a) * 13, color, 1.2, ctx.globalAlpha);
    }
    ctx.restore();
  }

  function drawSocialAnimationIdentity(ctx, rig, palette, profile, actor, pose, pulse) {
    const BaseR = Base;
    const torso = chestAnchor(rig);
    const mh = mainHandAnchor(rig);
    const oh = offHandAnchor(rig);
    const side = rig.dir?.side || 1;
    const t = pose.t || performance.now() * 0.001;
    const swing = pose.jobSwing || 0;

    if (profile.id === 'smith') {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      BaseR.ellipse(ctx, mh.x + side * (10 + swing * 2), mh.y - 20 - Math.max(0, swing) * 4, 2.0, 2.0, 0, '#ffbd68', null, 0);
      BaseR.ellipse(ctx, mh.x + side * (15 + swing * 2), mh.y - 25, 1.3, 1.3, 0, '#ffd9a0', null, 0);
      ctx.restore();
      return;
    }

    if (profile.id === 'cook') {
      ctx.save();
      ctx.globalAlpha = 0.34 + pulse * 0.12;
      BaseR.line(ctx, mh.x - side * 5, mh.y - 6, mh.x + side * 8, mh.y - 17, '#f7e8c6', 1.1);
      BaseR.ellipse(ctx, torso.x + 15 * side, torso.y + 18, 5 + pulse, 2.2, 0, 'rgba(255,232,190,0.18)', null, 0);
      ctx.restore();
      return;
    }

    if (profile.id === 'fisher') {
      ctx.save();
      ctx.globalAlpha = 0.58;
      BaseR.line(ctx, mh.x, mh.y, mh.x + side * (36 + Math.sin(t * 1.8) * 3), mh.y - 45 + Math.sin(t * 1.3) * 4, '#d7d0bd', 0.8);
      ctx.restore();
      return;
    }

    if (profile.id === 'merchant') {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      BaseR.ellipse(ctx, oh.x - side * 6, oh.y - 6, 2.0 + pulse, 2.0 + pulse, 0, 'rgba(255,227,160,0.25)', null, 0);
      ctx.restore();
      return;
    }

    if (profile.id === 'bardTrainer') {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 3; i++) {
        const a = t * 1.8 + i * 2.1;
        const x = torso.x + Math.cos(a) * (18 + i * 3);
        const y = torso.y - 20 + Math.sin(a) * 6 - i * 4;
        BaseR.line(ctx, x, y, x, y - 8, palette.glow, 1.3, 0.28 + pulse * 0.20);
        BaseR.ellipse(ctx, x + 3, y, 2.6, 2.0, 0, palette.glow, null, 0);
      }
      ctx.restore();
      return;
    }

    if (profile.id === 'mercGuardian' || profile.id === 'roadWarden') {
      ctx.save();
      ctx.globalAlpha = 0.16 + pulse * 0.07;
      BaseR.ellipse(ctx, 0, 1, 22, 4, 0, palette.accent, null, 0);
      ctx.restore();
      return;
    }

    if (profile.id === 'mercScout' || profile.id === 'mossfangScout') {
      ctx.save();
      ctx.globalAlpha = 0.16 + Math.abs(swing) * 0.06;
      BaseR.line(ctx, torso.x - side * 18, torso.y + 18, torso.x - side * 30, torso.y + 20, palette.glow, 1.0, 0.45);
      ctx.restore();
      return;
    }

    if (profile.id === 'mercAdept') {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const r = 16 + pulse * 3;
      BaseR.ellipse(ctx, torso.x + Math.cos(t * 2.1) * r, torso.y - 3 + Math.sin(t * 2.1) * 5, 2.4, 2.4, 0, palette.glow, null, 0);
      ctx.restore();
      return;
    }

    if (profile.id === 'townGuide' || profile.id === 'surveyor') {
      ctx.save();
      ctx.globalAlpha = 0.22 + pulse * 0.13;
      BaseR.ellipse(ctx, oh.x - side * 5, oh.y - 7, 4.5, 4.5, 0, palette.glow, null, 0);
      ctx.restore();
    }
  }

  const api = { draw, canDraw, resolveProfile, profileFor: resolveProfile };
  DR.render.CampNpcProceduralModel = api;
  DR.render.MercNpcIdentityProceduralModel = api;
  window.CampNpcProceduralModel = api;
  window.MercNpcIdentityProceduralModel = api;
})();
