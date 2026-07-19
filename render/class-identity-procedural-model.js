(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.render = DR.render || {};

  const Base = DR.render.HumanoidBaseRenderer;
  const Anim = DR.render.HumanoidAnimationSystem;
  const TAU = Math.PI * 2;

  /*
   * V0.12.54 Strong Class Silhouette Identity Pass
   *
   * This renderer is the first real class-identity pass after the shared humanoid
   * base was cleaned up. It intentionally keeps the base body, row mapping, and
   * back-facing arm occlusion in HumanoidBaseRenderer, but pushes identity through
   * class visual profiles:
   *
   * - silhouette: shoulder/torso/robe/coat/prop scale
   * - posture: stride, arm swing, body bob, lean bias
   * - layers: back layer, torso layer, shoulders, belt, headwear, props
   * - vfx: cast, attack, meditation, hit, death flavors
   *
   * Canonical row format remains:
   * 0 Up, 1 Down, 2 Left, 3 Right, 4 Up Right, 5 Down Right, 6 Up Left, 7 Down Left.
   */

  const CLASS_ALIASES = Object.freeze({
    paladin: 'paladin', crusader: 'paladin', oathkeeper: 'paladin',
    warden: 'warden', naturewarden: 'warden', stonewarden: 'warden',
    fighter: 'fighter', warrior: 'fighter', bruiser: 'fighter',
    rogue: 'rogue', thief: 'rogue',
    ranger: 'ranger', hunter: 'ranger', scout: 'ranger', archer: 'ranger',
    assassin: 'assassin', executioner: 'assassin', crossbowman: 'assassin',
    cleric: 'cleric', priest: 'cleric', healer: 'cleric', fieldcleric: 'cleric',
    wizard: 'wizard', mage: 'wizard', archwizard: 'wizard',
    shaman: 'shaman', stormcaller: 'shaman', spiritcaller: 'shaman',
    enchanter: 'enchanter', mesmer: 'enchanter', illusionist: 'enchanter', charmer: 'enchanter',
    summoner: 'summoner', adept: 'summoner', arcaneadept: 'summoner',
    necromancer: 'necromancer', necro: 'necromancer'
  });

  const PROFILES = Object.freeze({

    paladin: {
      id: 'paladin', display: 'Paladin',
      silhouette: { shoulder: 1.20, torso: 1.10, waist: 1.00, hem: 0.88, coat: 32, mantle: 1.10, prop: 1.06, collar: 0.55, hood: 0, stance: 1.02 },
      posture: { armSwing: 0.56, stride: 0.76, torsoBob: 0.42, headBob: 0.42, castPulse: 1.04, lean: 0.42, cloth: 0.46, cape: 0.46 },
      layers: { back: 'shortCape', torso: 'plateCuirass', shoulders: 'platePauldrons', belt: 'holyCord', head: 'tonsureHalo', mainProp: 'mace', offProp: 'shield', chest: 'stoleCross' },
      palette: { outline: '#14110b', shadow: 'rgba(0,0,0,0.36)', skin: '#e0aa7c', skinShadow: '#9b674d', hair: '#4b3628', hairHi: '#7a5637', cloth: '#efe0a1', clothDark: '#6c5a2d', clothHi: '#fff5c7', accent: '#f3d46b', accentDark: '#8a6923', boot: '#2c2117', bootHi: '#6d5134', belt: '#72522b', metal: '#e8e2cd', metalDark: '#80755c', glow: '#fff0a8' }
    },
    warden: {
      id: 'warden', display: 'Warden',
      silhouette: { shoulder: 1.24, torso: 1.16, waist: 1.05, hem: 1.02, coat: 34, mantle: 1.15, prop: 1.13, collar: 0.72, hood: 0.42, stance: 1.10 },
      posture: { armSwing: 0.50, stride: 0.68, torsoBob: 0.30, headBob: 0.30, castPulse: 0.90, lean: 0.32, cloth: 0.44, cape: 0.42 },
      layers: { back: 'wardenDorsalBark', torso: 'wardenBarkPlate', shoulders: 'wardenBurlPauldrons', belt: 'rootBelt', head: 'barkMask', mainProp: 'wardenHammer', offProp: 'livingShield', chest: 'wardenHeartBramble' },
      palette: { outline: '#0b1208', shadow: 'rgba(0,0,0,0.46)', skin: '#8f9a76', skinShadow: '#4b5b3f', hair: '#2f2617', hairHi: '#6a4d2a', cloth: '#3a4a25', clothDark: '#111b0d', clothHi: '#66834a', accent: '#9fd56e', accentDark: '#35562b', boot: '#24170f', bootHi: '#5b3f24', belt: '#4e301b', metal: '#9ba18b', metalDark: '#4f5546', glow: '#9eff73' }
    },
    ranger: {
      id: 'ranger', display: 'Ranger',
      silhouette: { shoulder: 0.88, torso: 0.84, waist: 0.78, hem: 0.74, coat: 26, mantle: 0.82, prop: 0.96, collar: 0.70, hood: 0.38, stance: 0.92 },
      posture: { armSwing: 1.05, stride: 1.16, torsoBob: 0.36, headBob: 0.42, castPulse: 0.62, lean: 0.95, cloth: 0.58, cape: 0.66 },
      layers: { back: 'splitCloak', torso: 'leatherWrap', shoulders: 'softHoodMantle', belt: 'pouchBelt', head: 'bareWarrior', mainProp: 'longbow', offProp: 'none', chest: 'crossStraps' },
      palette: { outline: '#0b1009', shadow: 'rgba(0,0,0,0.42)', skin: '#d49a72', skinShadow: '#85583f', hair: '#3d2b1c', hairHi: '#6b4a2e', cloth: '#253820', clothDark: '#0b1208', clothHi: '#4f7340', accent: '#77b85f', accentDark: '#2f4c26', boot: '#1c160f', bootHi: '#4c3924', belt: '#5a3b20', metal: '#aebaa6', metalDark: '#465143', glow: '#a9ff7e' }
    },
    assassin: {
      id: 'assassin', display: 'Assassin',
      // V0.16.23 high-detail graphical pass: preserve the slim low-poly silhouette while
      // replacing the inherited dual-dagger read with the intended crossbow executioner kit.
      silhouette: { shoulder: 0.78, torso: 0.76, waist: 0.70, hem: 0.72, coat: 32, mantle: 0.68, prop: 0.94, collar: 1.02, hood: 1.08, stance: 0.86 },
      posture: { armSwing: 1.16, stride: 1.14, torsoBob: 0.32, headBob: 0.34, castPulse: 0.88, lean: 1.18, cloth: 0.62, cape: 0.72 },
      layers: { back: 'splitCloak', torso: 'leatherWrap', shoulders: 'softHoodMantle', belt: 'pouchBelt', head: 'deepHood', mainProp: 'assassinCrossbow', offProp: 'throwingKnife', chest: 'crossStraps' },
      palette: { outline: '#05060a', shadow: 'rgba(0,0,0,0.54)', skin: '#c99178', skinShadow: '#765044', hair: '#090a0d', hairHi: '#25212f', cloth: '#111620', clothDark: '#040609', clothHi: '#2c3342', accent: '#6fcf7a', accentDark: '#243d2b', boot: '#101114', bootHi: '#2d2f36', belt: '#372b2f', metal: '#87929a', metalDark: '#303942', metalHi: '#d1d6d4', brass: '#7c6240', poison: '#53df78', shadowGlass: '#8c66ff', glow: '#ad84ff' }
    },
    wizard: {
      id: 'wizard', display: 'Wizard',
      // V0.16.23 high-detail graphical pass: keep the existing tall scholarly caster silhouette
      // while replacing the old charm/enchanter read with Wizard-owned robes, staff, grimoire,
      // elemental orbs, hat, spectacles, celestial trim, and arcane research gear.
      silhouette: { shoulder: 0.94, torso: 0.88, waist: 0.78, hem: 1.18, coat: 54, mantle: 1.12, prop: 1.18, collar: 1.16, hood: 0.18, stance: 0.90 },
      posture: { armSwing: 0.36, stride: 0.58, torsoBob: 0.26, headBob: 0.34, castPulse: 1.68, lean: 0.34, cloth: 1.22, cape: 0.96 },
      layers: { back: 'wizardMantle', torso: 'wizardRobe', shoulders: 'wizardMantle', belt: 'wizardBelt', head: 'wizardHat', mainProp: 'wizardStaff', offProp: 'wizardGrimoire', chest: 'wizardCelestial' },
      palette: { outline: '#071026', shadow: 'rgba(0,0,0,0.42)', skin: '#dca982', skinShadow: '#9b6853', hair: '#263556', hairHi: '#b8c7ec', cloth: '#17295f', clothDark: '#050b20', clothHi: '#4f6fc6', underRobe: '#d8c9f6', accent: '#79b6ff', accentDark: '#253d82', boot: '#101525', bootHi: '#2d3d65', belt: '#4c3b66', metal: '#d2dcf5', metalDark: '#596782', metalHi: '#f1f6ff', gold: '#d8b760', silver: '#d9e4f7', fire: '#ff8a3d', frost: '#9edfff', arcane: '#b58cff', glow: '#91caff' }
    },
    shaman: {
      id: 'shaman', display: 'Shaman',
      silhouette: { shoulder: 1.02, torso: 0.94, waist: 0.84, hem: 1.04, coat: 42, mantle: 1.08, prop: 1.18, collar: 1.10, hood: 0.42, stance: 0.98 },
      posture: { armSwing: 0.62, stride: 0.78, torsoBob: 0.42, headBob: 0.48, castPulse: 1.38, lean: 0.58, cloth: 1.02, cape: 0.82 },
      layers: { back: 'talismanCoat', torso: 'asymRitualRobe', shoulders: 'highCollar', belt: 'runeSash', head: 'arcaneCirclet', mainProp: 'stormStaff', offProp: 'stormWisp', chest: 'talismans' },
      palette: { outline: '#0b0d12', shadow: 'rgba(0,0,0,0.46)', skin: '#b8825c', skinShadow: '#6a4530', hair: '#2e1d15', hairHi: '#6a4a34', cloth: '#5a432c', clothDark: '#1e120d', clothHi: '#887055', accent: '#55aee7', accentDark: '#8a5b2c', boot: '#24170f', bootHi: '#5c4330', belt: '#6a4b30', metal: '#c9874e', metalDark: '#6d4a2c', glow: '#9cd8ff' }
    },
    fighter: {
      id: 'fighter',
      display: 'Fighter',
      silhouette: {
        shoulder: 1.34, torso: 1.18, waist: 1.04, hem: 0.70, coat: 18, mantle: 1.18,
        prop: 1.16, collar: 0.45, hood: 0, stance: 1.06
      },
      posture: {
        armSwing: 0.70, stride: 0.86, torsoBob: 0.58, headBob: 0.62, castPulse: 0.55,
        lean: 0.55, cloth: 0.35, cape: 0.32
      },
      layers: {
        back: 'furHarness', torso: 'leatherScaleHarness', shoulders: 'wolfFurMantle', belt: 'bruiserWarBelt',
        head: 'bareWarrior', mainProp: 'greatweapon', offProp: 'none', chest: 'crossStraps'
      },
      palette: {
        outline: '#100b08', shadow: 'rgba(0,0,0,0.45)', skin: '#d89b70', skinShadow: '#8e563d',
        hair: '#2b1b14', hairHi: '#6d4630', cloth: '#5f3827', clothDark: '#24140f', clothHi: '#9b6240',
        accent: '#b95432', accentDark: '#5d261b', boot: '#21140d', bootHi: '#654021', belt: '#59321d',
        metal: '#b7ad93', metalDark: '#51473a', metalHi: '#e2d7b7', fur: '#6b5742', furHi: '#b29a76', glow: '#ffd680'
      }
    },
    rogue: {
      id: 'rogue',
      display: 'Rogue',
      silhouette: {
        shoulder: 0.82, torso: 0.78, waist: 0.72, hem: 0.78, coat: 34, mantle: 0.72,
        prop: 0.95, collar: 0.95, hood: 1.08, stance: 0.88
      },
      posture: {
        armSwing: 1.22, stride: 1.22, torsoBob: 0.38, headBob: 0.44, castPulse: 0.70,
        lean: 1.35, cloth: 0.66, cape: 0.72
      },
      layers: {
        back: 'splitCloak', torso: 'leatherWrap', shoulders: 'softHoodMantle', belt: 'pouchBelt',
        head: 'deepHood', mainProp: 'dagger', offProp: 'dagger', chest: 'crossStraps'
      },
      palette: {
        outline: '#090c11', shadow: 'rgba(0,0,0,0.48)', skin: '#d69a76', skinShadow: '#8d5747',
        hair: '#0c0f16', hairHi: '#222838', cloth: '#121927', clothDark: '#05070c', clothHi: '#27364c',
        accent: '#50705a', accentDark: '#1f3328', boot: '#17110f', bootHi: '#3a2a21', belt: '#5b3a24',
        metal: '#9ea9ae', metalDark: '#363f47', metalHi: '#d6dde0', glow: '#6affe1'
      }
    },
    cleric: {
      id: 'cleric',
      display: 'Cleric',
      silhouette: {
        shoulder: 1.02, torso: 1.04, waist: 0.96, hem: 1.28, coat: 48, mantle: 1.10,
        prop: 1.04, collar: 0.62, hood: 0.2, stance: 0.96
      },
      posture: {
        armSwing: 0.48, stride: 0.72, torsoBob: 0.36, headBob: 0.36, castPulse: 1.02,
        lean: 0.36, cloth: 0.82, cape: 0.56
      },
      layers: {
        back: 'prayerRobe', torso: 'longVestment', shoulders: 'softMantle', belt: 'holyCord',
        head: 'tonsureHalo', mainProp: 'mace', offProp: 'holySeal', chest: 'stoleCross'
      },
      palette: {
        outline: '#151310', shadow: 'rgba(0,0,0,0.34)', skin: '#e3ad83', skinShadow: '#a56e50',
        hair: '#4a3324', hairHi: '#7a5a3f', cloth: '#d7d0b1', clothDark: '#6d674f', clothHi: '#f1ead0',
        accent: '#e7c15f', accentDark: '#8d6c25', boot: '#2b2119', bootHi: '#695039', belt: '#6c4b28',
        metal: '#dad8ce', metalDark: '#7f8078', glow: '#fff2a8'
      }
    },
    enchanter: {
      id: 'enchanter',
      display: 'Enchanter',
      silhouette: {
        shoulder: 0.88, torso: 0.86, waist: 0.76, hem: 1.00, coat: 44, mantle: 1.08,
        prop: 1.06, collar: 1.34, hood: 0.28, stance: 0.90
      },
      posture: {
        armSwing: 0.46, stride: 0.68, torsoBob: 0.32, headBob: 0.42, castPulse: 1.48,
        lean: 0.48, cloth: 1.16, cape: 0.94
      },
      layers: {
        back: 'ribbonMantle', torso: 'illusionRobe', shoulders: 'mesmerCollar', belt: 'charmSash',
        head: 'mindCirclet', mainProp: 'charmScepter', offProp: 'charmFocus', chest: 'charmSigil'
      },
      palette: {
        outline: '#120d21', shadow: 'rgba(0,0,0,0.38)', skin: '#dca982', skinShadow: '#9b6853',
        hair: '#2b1938', hairHi: '#6d4f93', cloth: '#2f245d', clothDark: '#100b28', clothHi: '#6b5aa6',
        accent: '#d78cf4', accentDark: '#6d3f99', boot: '#181226', bootHi: '#423159', belt: '#6f4d7c',
        metal: '#d8c8ee', metalDark: '#75658d', glow: '#ffb6ff'
      }
    },
    summoner: {
      id: 'summoner',
      display: 'Summoner',
      silhouette: {
        shoulder: 0.94, torso: 0.92, waist: 0.84, hem: 1.10, coat: 42, mantle: 0.92,
        prop: 1.12, collar: 1.20, hood: 0.55, stance: 0.94
      },
      posture: {
        armSwing: 0.62, stride: 0.80, torsoBob: 0.42, headBob: 0.50, castPulse: 1.28,
        lean: 0.60, cloth: 1.05, cape: 0.82
      },
      layers: {
        back: 'talismanCoat', torso: 'asymRitualRobe', shoulders: 'highCollar', belt: 'runeSash',
        head: 'arcaneCirclet', mainProp: 'ritualRod', offProp: 'floatingOrb', chest: 'talismans'
      },
      palette: {
        outline: '#100f1c', shadow: 'rgba(0,0,0,0.39)', skin: '#dca982', skinShadow: '#9f6953',
        hair: '#24182f', hairHi: '#51356e', cloth: '#22284d', clothDark: '#0d1125', clothHi: '#375f81',
        accent: '#5ed0ca', accentDark: '#266c72', boot: '#171520', bootHi: '#38334c', belt: '#4d3b56',
        metal: '#c6c4d8', metalDark: '#55536b', glow: '#75fff0'
      }
    },
    necromancer: {
      id: 'necromancer',
      display: 'Necromancer',
      silhouette: {
        shoulder: 1.05, torso: 0.95, waist: 0.84, hem: 1.08, coat: 47, mantle: 1.16,
        prop: 1.20, collar: 1.28, hood: 0.86, stance: 0.92
      },
      posture: {
        armSwing: 0.52, stride: 0.72, torsoBob: 0.30, headBob: 0.28, castPulse: 1.34,
        lean: 0.42, cloth: 0.74, cape: 0.58
      },
      layers: {
        back: 'jaggedCoat', torso: 'boneRitualCoat', shoulders: 'boneSpikes', belt: 'boneChain',
        head: 'shadowHood', mainProp: 'boneStaff', offProp: 'skullFocus', chest: 'ribCharm'
      },
      palette: {
        outline: '#09090d', shadow: 'rgba(0,0,0,0.46)', skin: '#c99e83', skinShadow: '#7a5f55',
        hair: '#0f1015', hairHi: '#32313c', cloth: '#242033', clothDark: '#090811', clothHi: '#4b3b66',
        accent: '#cfc6a0', accentDark: '#756f54', boot: '#15100f', bootHi: '#3d2b26', belt: '#413021',
        metal: '#c7c0ab', metalDark: '#585043', glow: '#9fff6d'
      }
    }
  });

  function normalizeClassName(value) {
    const key = String(value || '').trim().toLowerCase().replace(/[\s_\-]/g, '');
    return CLASS_ALIASES[key] || '';
  }

  function classNameFor(actor = {}) {
    const mercMap = { guardian: 'paladin', cleric: 'cleric', fieldcleric: 'cleric', adept: 'wizard', scout: 'ranger' };
    const roleKey = String(actor.roleKey || '').toLowerCase().replace(/[\s_\-]/g, '');
    return normalizeClassName(actor.className || actor.playerClass || actor.classId || actor.role || actor.type) || mercMap[roleKey] || '';
  }

  function canDraw(actor = {}) {
    return !!PROFILES[classNameFor(actor)];
  }

  function equippedWeaponVisible(actor) {
    return !!DR.render?.PaperdollEquipmentRenderer?.hasEquippedWeapon?.(actor);
  }

  function equippedOffhandVisible(actor) {
    return !!DR.render?.PaperdollEquipmentRenderer?.hasEquippedOffhand?.(actor);
  }

  // V0.16.05: Ranger and Warden class identity weapons are canonical for the
  // visible class model. Equipped starter/default paperdoll weapons were hiding
  // the class bow / living shield+maul and producing generic stick silhouettes
  // in-world. Keep gear stats intact, but do not let generic weapon visuals
  // suppress these class-defining weapons.
  function locksClassIdentityWeapons(actor = {}) {
    const source = actor?.sourceEntity || {};
    const cls = normalizeClassName(
      actor.className || actor.playerClass || actor.classId || actor.role || actor.type ||
      source.className || source.playerClass || source.classId || source.role || source.type
    );
    return cls === 'ranger' || cls === 'warden';
  }

  function shouldHideDefaultMainWeapon(rig) {
    const actor = rig?.actor || rig?.sourceEntity || {};
    if (locksClassIdentityWeapons(actor)) return false;
    return equippedWeaponVisible(actor);
  }

  function shouldHideDefaultOffhandWeapon(rig) {
    const actor = rig?.actor || rig?.sourceEntity || {};
    if (locksClassIdentityWeapons(actor)) return false;
    return equippedOffhandVisible(actor);
  }

  function activeRuntimeGame() {
    return window.DarkWoodsGame || window.DreamRealms?.game || null;
  }

  function resolveActorTargetEntity(actor = {}) {
    const source = actor?.sourceEntity || actor || {};
    const targetId = source.targetId ?? actor.targetId ?? source.combatTargetId ?? actor.combatTargetId;
    if (targetId == null) return null;
    const game = source.game || actor.game || activeRuntimeGame();
    if (!game) return null;
    const groups = [
      game.enemies,
      game.bots,
      game.players,
      game.mercenaries,
      game.pets,
      game.summons,
      game.npcs,
      game.entities,
      [game.player]
    ];
    for (const group of groups) {
      if (!group) continue;
      const list = Array.isArray(group) ? group : [group];
      for (const entry of list) {
        if (!entry) continue;
        if (String(entry.id ?? '') === String(targetId) || String(entry.botId ?? '') === String(targetId)) return entry;
      }
    }
    return null;
  }

  // Single source of truth for Ranger combat facing. Every consumer - body facing (already set
  // via Entity.setFacingFromDelta in combat-system.js), bow side/placement, bow rotation, hand
  // and string pose, arrow spawn point, and projectile velocity - must agree, so this is the one
  // place the Ranger render path computes "which way is the fight." A live combat target vector
  // always wins over stale movement/keyboard facing; idle facing is only ever a fallback for when
  // there is no target at all.
  function getRangerCombatAim(rig) {
    const actor = rig?.actor || rig?.sourceEntity || {};
    const source = actor?.sourceEntity || actor || {};
    const originX = Number(source.x ?? actor.x ?? 0);
    const originY = Number(source.y ?? actor.y ?? 0);

    // Fast path: the player's own auto-attack visual state is refreshed every combat frame
    // (systems/combat-system.js) and is exactly the vector the real projectile is resolved
    // against. Bot/merc Rangers don't populate this, so fall back to resolving their actual
    // target entity by id.
    const active = Boolean(source.autoAttackVisualActive || actor.autoAttackVisualActive);
    const cachedTargetX = Number(source.autoAttackVisualTargetX ?? actor.autoAttackVisualTargetX ?? NaN);
    const cachedTargetY = Number(source.autoAttackVisualTargetY ?? actor.autoAttackVisualTargetY ?? NaN);
    const target = (active && Number.isFinite(cachedTargetX) && Number.isFinite(cachedTargetY))
      ? { x: cachedTargetX, y: cachedTargetY }
      : resolveActorTargetEntity(actor);

    if (target && target.alive !== false && Number.isFinite(target.x) && Number.isFinite(target.y)) {
      const dx = target.x - originX;
      const dy = target.y - originY;
      const distance = Math.hypot(dx, dy);
      if (distance > 0.0001) {
        const x = dx / distance, y = dy / distance;
        return { x, y, angle: Math.atan2(y, x), side: x >= 0 ? 1 : -1 };
      }
    }

    // No live target vector: fall back to the actor's last aim/movement facing rather than a
    // hardcoded side.
    const facingX = Number(source.facingX ?? actor.facingX ?? 0);
    const facingY = Number(source.facingY ?? actor.facingY ?? 0);
    const facingLen = Math.hypot(facingX, facingY);
    if (facingLen > 0.0001) {
      const x = facingX / facingLen, y = facingY / facingLen;
      return { x, y, angle: Math.atan2(y, x), side: x >= 0 ? 1 : -1 };
    }

    const fallbackSide = rig?.dir?.side || rig?.dir?.nearSide || 1;
    return { x: fallbackSide, y: 0, angle: fallbackSide >= 0 ? 0 : Math.PI, side: fallbackSide };
  }

  function draw(ctx, actor, nowMs = performance.now()) {
    if (!Base || !Anim) return false;
    const id = classNameFor(actor);
    const profile = PROFILES[id];
    if (!profile) return false;

    const pose = scalePoseForClass(Anim.buildPose(actor, nowMs), profile);

    // V0.13.91: Fighter meditation now exports a dedicated below-feet EXP bar anchor so the bar no longer crosses the seated model.
    // The previous shared hook-based front-prop composition made the shield dominate
    // the torso/head in front-facing previews.  This path draws a controlled humanoid
    // Fighter stack directly and leaves all non-Fighter class renderers on the shared
    // humanoid system.
    const hasVisualGear = !!(DR.render?.PaperdollEquipmentRenderer?.hasAny?.(actor));
    if (profile.id === 'paladin' && !['dance', 'sit', 'ride'].includes(String(pose.action || '').toLowerCase())) {
      return drawPremiumPaladinModel(ctx, actor, profile, pose, nowMs);
    }

    if (profile.id === 'fighter' && !hasVisualGear && !['dance', 'sit', 'ride'].includes(String(pose.action || '').toLowerCase())) {
      return drawPremiumFighterModel(ctx, actor, profile, pose, nowMs);
    }

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
      source._classIdentityRenderer = profile.id === 'wizard' ? 'wizard-high-detail-v0.16.23-arcane-scholar' : profile.id === 'assassin' ? 'assassin-high-detail-v0.16.22-crossbow-executioner' : profile.id === 'rogue' ? 'rogue-high-detail-v0.14.06-hand-anchor-daggers' : profile.id === 'ranger' ? 'ranger-high-detail-v0.16.03-wildwarden' : profile.id === 'summoner' ? 'summoner-high-detail-v0.14.07-ritual-regalia' : profile.id === 'enchanter' ? 'enchanter-high-detail-v0.14.09-atelier-regalia' : profile.id === 'necromancer' ? 'necromancer-high-detail-v0.14.10-funerary-regalia' : profile.id === 'cleric' ? 'cleric-high-detail-v0.14.11-battle-priest' : profile.id;
      source._nameplateAnchor = {
        x: Math.round(actor.screenX ?? actor.x ?? 0) + (rig?.anchors?.head?.x || 0),
        y: Math.round(actor.screenY ?? actor.y ?? 0) + (rig?.anchors?.head?.top || -90) - 7
      };
    }
    return true;
  }

  function scalePoseForClass(pose, profile) {
    const m = profile.posture;
    return applyClassAnimationIdentity({
      ...pose,
      armSwing: pose.armSwing * m.armSwing,
      legSwing: pose.legSwing * m.stride,
      torsoBob: pose.torsoBob * m.torsoBob,
      headBob: pose.headBob * m.headBob,
      lean: pose.lean * m.lean,
      castPulse: pose.castPulse * m.castPulse,
      clothSway: pose.clothSway * m.cloth,
      capeSway: pose.capeSway * m.cape,
      classProfileId: profile.id
    }, profile);
  }

  function applyClassAnimationIdentity(pose, profile) {
    const p = { ...pose };
    const id = profile.id;
    const side = p.direction?.side || 1;
    const step = Math.abs(Math.sin(p.walkCycle || 0));
    p.identityPulse = 0.5 + Math.sin((p.t || 0) * 3.2 + (p.seed || 0)) * 0.5;
    p.readyOffsetY = 0;
    p.propLag = Math.sin((p.t || 0) * 2.4 + (p.seed || 0)) * 1.0;
    p.groundPulse = p.moving ? step : 0;

    if (id === 'fighter') {
      p.torsoBob -= p.moving ? step * 0.65 : 0;
      p.headBob *= 0.72;
      p.armSwing *= p.action === 'attack' ? 1.26 : (p.action === 'fishing' ? 0.22 : p.action === 'meditate' ? 0.08 : 0.88);
      p.legSwing *= (p.action === 'meditate' || p.action === 'fishing') ? 0 : 0.86;
      p.shieldBrace = p.action === 'idle' ? 0.45 + p.identityPulse * 0.25 : p.action === 'attack' ? 0.2 : p.action === 'fishing' ? 0.58 : 0.35;
      p.weaponCommit = p.action === 'attack' ? p.attackCurve : 0;
      p.meditateFold = p.action === 'meditate' ? 1 : 0;
      p.fishingBrace = p.action === 'fishing' ? 1 : 0;
    } else if (id === 'rogue') {
      p.torsoBob -= 1.8 + (p.moving ? step * 0.55 : 0);
      p.headBob -= 1.1;
      p.lean += side * (p.moving ? 1.15 : 0.55);
      p.armSwing *= p.action === 'attack' ? 1.52 : 1.12;
      p.legSwing *= 1.20;
      p.stealthCrouch = 1;
      p.afterimageAlpha = p.moving ? 0.16 + step * 0.10 : 0;
    } else if (id === 'assassin') {
      p.torsoBob -= 1.3 + (p.moving ? step * 0.42 : 0);
      p.headBob -= 0.9;
      p.lean += side * (p.moving ? 0.96 : 0.38);
      p.armSwing *= p.action === 'attack' ? 1.18 : 0.74;
      p.legSwing *= 1.08;
      p.stealthCrouch = 0.72;
      p.executionPulse = p.action === 'cast' || p.action === 'attack' ? p.castPulse || p.attackCurve || 0 : p.identityPulse * 0.24;
      p.crossbowBrace = p.action === 'attack' ? 1 : p.action === 'cast' ? 0.7 : 0.34;
      p.afterimageAlpha = p.moving ? 0.10 + step * 0.06 : 0;
    } else if (id === 'wizard') {
      p.torsoBob += Math.sin((p.t || 0) * 1.45 + (p.seed || 0)) * 0.18;
      p.headBob += Math.sin((p.t || 0) * 1.10 + (p.seed || 0)) * 0.22;
      p.capeSway *= 1.16;
      p.armSwing *= p.action === 'cast' ? 0.30 : 0.54;
      p.staffPulse = p.action === 'cast' ? p.castPulse : 0.30 + p.identityPulse * 0.28;
      p.grimoireOrbit = p.action === 'cast' ? 1 : 0.36 + p.identityPulse * 0.18;
      p.elementalPulse = p.action === 'cast' ? 0.58 + p.castPulse * 0.42 : 0.32 + p.identityPulse * 0.24;
    } else if (id === 'cleric') {
      p.torsoBob *= 0.72;
      p.headBob *= 0.68;
      if (p.action === 'cast') {
        p.headBob -= 1.4 + p.castPulse * 0.8;
        p.armSwing *= 0.45;
        p.prayerLift = 1;
      }
      p.blessingPulse = p.action === 'cast' ? p.castPulse : p.identityPulse * 0.35;
    } else if (id === 'summoner') {
      p.torsoBob += Math.sin((p.t || 0) * 2.2 + (p.seed || 0)) * 0.34;
      p.headBob += Math.sin((p.t || 0) * 1.6 + (p.seed || 0)) * 0.44;
      p.capeSway *= 1.18;
      p.ritualOrbit = p.action === 'cast' ? 1 : 0.42;
      p.armSwing *= p.action === 'cast' ? 0.55 : 0.88;
    } else if (id === 'enchanter') {
      p.torsoBob += Math.sin((p.t || 0) * 1.8 + (p.seed || 0)) * 0.26;
      p.headBob += Math.sin((p.t || 0) * 2.4 + (p.seed || 0)) * 0.30;
      p.capeSway *= 1.28;
      p.armSwing *= p.action === 'cast' ? 0.36 : 0.62;
      p.charmPulse = p.action === 'cast' ? p.castPulse : 0.34 + p.identityPulse * 0.32;
      p.mindWave = p.action === 'cast' ? 1 : 0.24;
    } else if (id === 'necromancer') {
      p.torsoBob *= 0.55;
      p.headBob -= 0.8 + Math.sin((p.t || 0) * 1.25 + (p.seed || 0)) * 0.30;
      p.lean *= 0.5;
      p.armSwing *= p.action === 'cast' ? 0.48 : 0.62;
      p.deathMoteBias = 0.55 + p.identityPulse * 0.25;
      p.capeSway *= 0.62;
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
      glow: actorPalette.glow || p.glow,
      metalHi: actorPalette.metalHi || p.metalHi || '#dbe2df'
    };
  }

  function buildHooks(profile, actor, pose) {
    return {
      back(ctx, rig, palette) {
        drawBackHairOrHood(ctx, rig, palette, profile);
        drawBackProp(ctx, rig, palette, profile);
      },
      backCape(ctx, rig, palette) {
        drawBackSilhouette(ctx, rig, palette, profile);
      },
      torsoOverlay(ctx, rig, palette) {
        drawTorsoSilhouette(ctx, rig, palette, profile);
      },
      chest(ctx, rig, palette) {
        drawShoulderPackage(ctx, rig, palette, profile);
        drawChestPackage(ctx, rig, palette, profile);
        drawBeltPackage(ctx, rig, palette, profile);
      },
      hair(ctx, rig, palette) {
        if (Base.drawDefaultHair && profile.id !== 'shaman') Base.drawDefaultHair(ctx, rig, palette);
        drawHeadIdentity(ctx, rig, palette, profile);
      },
      mid(ctx, rig, palette) {
        drawMidProps(ctx, rig, palette, profile);
      },
      front(ctx, rig, palette) {
        drawFrontProps(ctx, rig, palette, profile);
        drawFrontClassDetails(ctx, rig, palette, profile);
      },
      effects(ctx, rig, palette) {
        drawClassEffects(ctx, rig, palette, profile);
        if (profile.id === 'cleric') drawClericHighDetailOverlay(ctx, rig, palette, profile);
      }
    };
  }

  function poly(ctx, pts, fill, stroke, width) { Base.poly(ctx, pts, fill, stroke, width); }
  function ellipse(ctx, x, y, rx, ry, rot, fill, stroke, width) { Base.ellipse(ctx, x, y, rx, ry, rot, fill, stroke, width); }
  function roundRect(ctx, x, y, w, h, r, fill, stroke, width) { Base.roundRect(ctx, x, y, w, h, r, fill, stroke, width); }
  function line(ctx, x1, y1, x2, y2, color, width, alpha) { Base.line(ctx, x1, y1, x2, y2, color, width, alpha); }

  // Small, shared animation-timing helpers used by the Ranger bow draw pose. Kept generic
  // (not Ranger-specific) so any future phase-based pose can reuse them.
  function clamp01(t) { return Math.max(0, Math.min(1, Number(t) || 0)); }
  function easeInOut(t) { t = clamp01(t); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function lerpPoint(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }

  function drawClassFishingRig(ctx, rig, palette, profile) {
    const a = rig.anchors;
    const p = rig.pose || {};
    const actor = rig.actor || {};
    const source = actor.sourceEntity || actor;
    const side = p.direction?.side || rig.dir?.nearSide || 1;
    const action = String(source.fishingAction || actor.fishingAction || 'waiting');
    const castPct = action === 'casting' ? Math.max(0, Math.min(1, 1 - Number(source.fishingCastTimer || actor.fishingCastTimer || 0) / 0.62)) : 1;
    const reel = action === 'reeling' ? Math.sin((p.t || 0) * 15) : 0;
    const wait = Math.sin((p.t || 0) * 3.2) * 1.6;
    const main = a.mainHand || { x: 22 * side, y: -18 };
    const off = a.offHand || { x: 8 * side, y: -10 };
    const butt = { x: off.x - side * 9, y: off.y + 12 + reel * 1.2 };
    const grip = { x: main.x, y: main.y + reel * 0.8 };
    const mid = { x: main.x + side * (38 + castPct * 15), y: main.y - 31 - castPct * 8 + wait * 0.3 };
    const tip = { x: main.x + side * (74 + castPct * 24), y: main.y - 63 - castPct * 14 + (action === 'reeling' ? -6 + reel * 3 : wait) };

    // V0.17.68: expose the actual rod-tip offset (model space, relative to the
    // model's foot anchor at screenX/screenY) so the entity renderer can publish
    // a live screen-space rod-tip anchor for the fishing line. Class players
    // render through this rig, not the humanoid-base drawFishingActionOverlay, so
    // without this the fishing system had no real anchor and fell back to a
    // too-high world-space guess that detached the line from the pole.
    if (source && typeof source === 'object') {
      source.fishingRodTipLocal = { x: tip.x, y: tip.y };
    }

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#4b2e19';
    ctx.lineWidth = 5.2;
    ctx.beginPath();
    ctx.moveTo(butt.x, butt.y);
    ctx.quadraticCurveTo(mid.x, mid.y, tip.x, tip.y);
    ctx.stroke();
    ctx.strokeStyle = '#c79b56';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(grip.x - side * 2, grip.y - 2);
    ctx.quadraticCurveTo(mid.x + side * 1.5, mid.y - 2, tip.x - side * 1.5, tip.y + 1);
    ctx.stroke();
    ctx.fillStyle = palette.belt || '#735135';
    ctx.strokeStyle = palette.outline || '#151015';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(grip.x - side * 6, grip.y + 5, 6 + Math.abs(reel) * 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#eed9a7';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(grip.x - side * 6, grip.y + 5, 9, 0.2 + reel, Math.PI * 1.55 + reel);
    ctx.stroke();
    if (action === 'reeling') {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.54;
      ctx.strokeStyle = palette.glow || '#d8f8ff';
      ctx.beginPath();
      ctx.arc(grip.x - side * 6, grip.y + 5, 14 + Math.abs(reel) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

  }

  function drawBackSilhouette(ctx, rig, palette, profile) {
    const a = rig.anchors;
    const d = rig.dir;
    const s = profile.silhouette;
    const side = d.capeSide || 0;
    const sway = rig.pose.capeSway * 0.28;
    const backVisible = !!d.backVisible;

    if (profile.layers.back === 'wardenDorsalBark') {
      const g = ctx.createLinearGradient(-24, a.chest.y - 17, 24, a.pelvis.y + 34);
      g.addColorStop(0, palette.bootHi);
      g.addColorStop(0.42, palette.cloth);
      g.addColorStop(1, palette.clothDark);
      poly(ctx, [
        { x: a.chest.x - 23 * s.shoulder - side * 2, y: a.chest.y - 15 },
        { x: a.chest.x + 21 * s.shoulder - side * 1, y: a.chest.y - 16 },
        { x: a.pelvis.x + 18 + sway, y: a.pelvis.y + 25 },
        { x: a.pelvis.x + 5, y: a.pelvis.y + 40 },
        { x: a.pelvis.x - 5, y: a.pelvis.y + 35 },
        { x: a.pelvis.x - 21 - sway, y: a.pelvis.y + 24 }
      ], g, palette.outline, 2.2);
      for (let i = -2; i <= 2; i++) {
        const x = a.chest.x + i * 8 + side * 2;
        line(ctx, x, a.chest.y - 12 + Math.abs(i) * 2, a.pelvis.x + i * 5, a.pelvis.y + 25, i === 0 ? palette.metalDark : palette.belt, 1.5, 0.58);
        drawWardenStone(ctx, x, a.chest.y - 6 + Math.abs(i) * 3, 0.45 + Math.abs(i) * 0.06, palette, 0.72);
      }
      drawWardenMossHang(ctx, a.chest.x - 14, a.chest.y - 8, 34, palette, 0.50);
      return;
    }

    if (profile.layers.back === 'shortCape') {
      const g = ctx.createLinearGradient(-20, a.chest.y - 16, 20, a.pelvis.y + 22);
      g.addColorStop(0, palette.clothHi);
      g.addColorStop(0.45, palette.cloth);
      g.addColorStop(1, palette.clothDark);
      poly(ctx, [
        { x: a.chest.x - 20 * s.shoulder - side * 2, y: a.chest.y - 13 },
        { x: a.chest.x + 20 * s.shoulder - side * 2, y: a.chest.y - 13 },
        { x: a.pelvis.x + 17 + sway, y: a.pelvis.y + 18 },
        { x: a.pelvis.x, y: a.pelvis.y + 27 },
        { x: a.pelvis.x - 17 - sway, y: a.pelvis.y + 18 }
      ], g, palette.outline, 2);
      return;
    }

    if (profile.layers.back === 'splitCloak') {
      const g = ctx.createLinearGradient(-24, a.chest.y - 14, 24, a.pelvis.y + 39);
      g.addColorStop(0, palette.clothHi);
      g.addColorStop(0.5, palette.cloth);
      g.addColorStop(1, palette.clothDark);
      poly(ctx, [
        { x: a.chest.x - 17, y: a.chest.y - 12 },
        { x: a.chest.x + 16, y: a.chest.y - 12 },
        { x: a.pelvis.x + 18 + sway, y: a.pelvis.y + 31 },
        { x: a.pelvis.x + 5, y: a.pelvis.y + 45 },
        { x: a.pelvis.x - 1, y: a.pelvis.y + 28 },
        { x: a.pelvis.x - 7, y: a.pelvis.y + 45 },
        { x: a.pelvis.x - 20 - sway, y: a.pelvis.y + 31 }
      ], g, palette.outline, 2);
      line(ctx, a.pelvis.x, a.pelvis.y + 5, a.pelvis.x + sway * 0.5, a.pelvis.y + 42, palette.accentDark, 1.2, 0.55);
      if (profile.id === 'rogue') drawRogueCloakDetail(ctx, rig, palette);
      if (profile.id === 'assassin') drawAssassinCloakDetail(ctx, rig, palette);
      return;
    }


    if (profile.layers.back === 'wizardMantle') {
      const bottom = a.pelvis.y + s.coat + 4;
      const topW = 18 * s.shoulder;
      const hemW = 23 * s.hem;
      const g = ctx.createLinearGradient(-26, a.chest.y - 18, 26, bottom + 6);
      g.addColorStop(0, palette.clothHi);
      g.addColorStop(0.35, palette.cloth);
      g.addColorStop(1, palette.clothDark);
      poly(ctx, [
        { x: a.chest.x - topW - side * 2, y: a.chest.y - 15 },
        { x: a.chest.x + topW - side * 1, y: a.chest.y - 15 },
        { x: a.pelvis.x + hemW + sway, y: bottom - 8 },
        { x: a.pelvis.x + 9, y: bottom + 4 },
        { x: a.pelvis.x + 1, y: bottom - 6 },
        { x: a.pelvis.x - 10, y: bottom + 3 },
        { x: a.pelvis.x - hemW - sway, y: bottom - 7 }
      ], g, palette.outline, 2);
      drawWizardBackRobeDetails(ctx, rig, palette, topW, hemW, bottom);
      return;
    }

    const long = profile.layers.back === 'prayerRobe' || profile.layers.back === 'jaggedCoat' || profile.layers.back === 'talismanCoat' || profile.layers.back === 'ribbonMantle';
    const topW = 18 * s.shoulder;
    const hemW = 22 * s.hem;
    const bottom = a.pelvis.y + (long ? s.coat : 36);
    const g = ctx.createLinearGradient(-25, a.chest.y - 18, 25, bottom);
    g.addColorStop(0, palette.clothHi);
    g.addColorStop(0.42, palette.cloth);
    g.addColorStop(1, palette.clothDark);
    if (profile.layers.back === 'jaggedCoat') {
      poly(ctx, [
        { x: a.chest.x - topW, y: a.chest.y - 15 },
        { x: a.chest.x + topW, y: a.chest.y - 15 },
        { x: a.pelvis.x + hemW + sway, y: bottom - 9 },
        { x: a.pelvis.x + 13, y: bottom + 2 },
        { x: a.pelvis.x + 4, y: bottom - 7 },
        { x: a.pelvis.x - 8, y: bottom + 3 },
        { x: a.pelvis.x - hemW - sway, y: bottom - 9 }
      ], g, palette.outline, 2);
    } else {
      poly(ctx, [
        { x: a.chest.x - topW - side * 2, y: a.chest.y - 15 },
        { x: a.chest.x + topW - side * 2, y: a.chest.y - 15 },
        { x: a.pelvis.x + hemW + sway, y: bottom },
        { x: a.pelvis.x + (profile.id === 'summoner' ? 10 : profile.id === 'enchanter' ? -8 : 0), y: bottom + 5 },
        { x: a.pelvis.x - hemW - sway, y: bottom }
      ], g, palette.outline, 2);
    }

    if (profile.id === 'summoner') {
      drawHangingTalismans(ctx, a.chest.x + side * 8, a.chest.y + 5, palette, rig.pose.t);
    }
    if (profile.id === 'enchanter') {
      drawCharmRibbons(ctx, a.chest.x, a.chest.y + 1, bottom - 4, palette, rig.pose.t, side);
    }
    if (profile.id === 'shaman') {
      drawShamanBackDetails(ctx, rig, palette, bottom);
    }
    if (profile.id === 'cleric' && backVisible) {
      drawCross(ctx, a.chest.x, a.chest.y + 5, 0.75, palette.accent, palette.outline);
    }
  }

  function drawTorsoSilhouette(ctx, rig, palette, profile) {
    const a = rig.anchors;
    const d = rig.dir;
    const s = profile.silhouette;
    const skew = d.torsoSkew * 0.22;
    const topW = 16.5 * s.torso * (d.torsoScaleX || 1);
    const waistW = 12.5 * s.waist * (d.torsoScaleX || 1);
    const hemW = 15.5 * s.hem * (d.torsoScaleX || 1);
    const robeBottom = a.pelvis.y + s.coat;
    const chestY = a.chest.y - 7;
    const g = ctx.createLinearGradient(-24, chestY, 24, robeBottom);
    g.addColorStop(0, palette.clothHi);
    g.addColorStop(0.36, palette.cloth);
    g.addColorStop(1, palette.clothDark);

    if (profile.layers.torso === 'wardenBarkPlate') {
      const bark = ctx.createLinearGradient(-22, chestY, 22, robeBottom);
      bark.addColorStop(0, palette.bootHi);
      bark.addColorStop(0.45, palette.cloth);
      bark.addColorStop(1, palette.clothDark);
      poly(ctx, [
        { x: a.chest.x - topW - 4 + skew, y: chestY + 1 },
        { x: a.chest.x + topW + 3 + skew, y: chestY + 1 },
        { x: a.pelvis.x + hemW + 4, y: a.pelvis.y + 22 },
        { x: a.pelvis.x + 5, y: a.pelvis.y + 34 },
        { x: a.pelvis.x - 6, y: a.pelvis.y + 31 },
        { x: a.pelvis.x - hemW - 4, y: a.pelvis.y + 22 }
      ], bark, palette.outline, 2.2);
      drawWardenTorsoDetails(ctx, rig, palette, topW, hemW, chestY);
      return;
    }

    if (profile.layers.torso === 'plateCuirass') {
      poly(ctx, [
        { x: a.chest.x - topW - 2 + skew, y: chestY },
        { x: a.chest.x + topW + 2 + skew, y: chestY },
        { x: a.pelvis.x + waistW + 2, y: a.pelvis.y + 17 },
        { x: a.pelvis.x + 7, y: a.pelvis.y + 27 },
        { x: a.pelvis.x - 7, y: a.pelvis.y + 27 },
        { x: a.pelvis.x - waistW - 2, y: a.pelvis.y + 17 }
      ], palette.metalDark, palette.outline, 2.1);
      poly(ctx, [
        { x: a.chest.x - topW * 0.68 + skew, y: chestY + 2 },
        { x: a.chest.x + topW * 0.68 + skew, y: chestY + 2 },
        { x: a.pelvis.x + waistW * 0.72, y: a.pelvis.y + 13 },
        { x: a.pelvis.x, y: a.pelvis.y + 24 },
        { x: a.pelvis.x - waistW * 0.72, y: a.pelvis.y + 13 }
      ], palette.metal, palette.outline, 1.4);
      return;
    }

    if (profile.layers.torso === 'leatherWrap') {
      poly(ctx, [
        { x: a.chest.x - topW + skew, y: chestY },
        { x: a.chest.x + topW + skew, y: chestY },
        { x: a.pelvis.x + hemW + rig.pose.clothSway * 0.12, y: a.pelvis.y + 27 },
        { x: a.pelvis.x + 4, y: a.pelvis.y + 34 },
        { x: a.pelvis.x - 8, y: a.pelvis.y + 30 },
        { x: a.pelvis.x - hemW - rig.pose.clothSway * 0.12, y: a.pelvis.y + 27 }
      ], g, palette.outline, 1.8);
      line(ctx, a.chest.x - topW + 5, chestY + 7, a.pelvis.x + hemW - 3, a.pelvis.y + 19, palette.belt, 3.2, 0.95);
      line(ctx, a.chest.x + topW - 4, chestY + 4, a.pelvis.x - hemW + 4, a.pelvis.y + 20, palette.accentDark, 2.4, 0.8);
      if (profile.id === 'rogue') drawRogueTorsoDetails(ctx, rig, palette);
      if (profile.id === 'assassin') drawAssassinTorsoDetails(ctx, rig, palette, topW, hemW, chestY);
      if (profile.id === 'ranger') drawRangerTorsoDetails(ctx, rig, palette, topW, hemW, chestY);
      return;
    }


    if (profile.layers.torso === 'wizardRobe') {
      const outer = ctx.createLinearGradient(-24, chestY, 24, robeBottom + 7);
      outer.addColorStop(0, palette.clothHi);
      outer.addColorStop(0.34, palette.cloth);
      outer.addColorStop(1, palette.clothDark);
      poly(ctx, [
        { x: a.chest.x - topW - 1 + skew, y: chestY },
        { x: a.chest.x + topW + 1 + skew, y: chestY },
        { x: a.pelvis.x + hemW + 4 + rig.pose.clothSway * 0.18, y: robeBottom - 4 },
        { x: a.pelvis.x + 4, y: robeBottom + 7 },
        { x: a.pelvis.x - hemW - 5 - rig.pose.clothSway * 0.14, y: robeBottom - 3 }
      ], outer, palette.outline, 2.1);
      poly(ctx, [
        { x: a.chest.x - topW * 0.34, y: chestY + 7 },
        { x: a.chest.x + topW * 0.38, y: chestY + 8 },
        { x: a.pelvis.x + hemW * 0.30, y: robeBottom - 3 },
        { x: a.pelvis.x + 1, y: robeBottom + 5 },
        { x: a.pelvis.x - hemW * 0.32, y: robeBottom - 4 }
      ], palette.underRobe || 'rgba(216,201,246,0.88)', palette.outline, 1.1);
      drawWizardRobeDetails(ctx, rig, palette, topW, hemW, robeBottom, chestY);
      return;
    }

    if (profile.layers.torso === 'asymRitualRobe') {
      poly(ctx, [
        { x: a.chest.x - topW + skew, y: chestY },
        { x: a.chest.x + topW + skew, y: chestY + 2 },
        { x: a.pelvis.x + hemW + 5 + rig.pose.clothSway * 0.18, y: robeBottom - 7 },
        { x: a.pelvis.x + 3, y: robeBottom + 4 },
        { x: a.pelvis.x - hemW - rig.pose.clothSway * 0.12, y: robeBottom - 2 }
      ], g, palette.outline, 2);
      drawRuneStrip(ctx, a.chest.x + 7, a.chest.y - 1, a.pelvis.y + 33, palette, rig.pose.t);
      if (profile.id === 'summoner') drawSummonerRobeDetails(ctx, rig, palette, topW, hemW, robeBottom, chestY);
      if (profile.id === 'shaman') drawShamanTorsoDetails(ctx, rig, palette, topW, hemW, robeBottom, chestY);
      return;
    }

    if (profile.layers.torso === 'illusionRobe') {
      poly(ctx, [
        { x: a.chest.x - topW + skew - 1, y: chestY },
        { x: a.chest.x + topW + skew + 2, y: chestY + 1 },
        { x: a.pelvis.x + hemW + 3 + rig.pose.clothSway * 0.20, y: robeBottom - 5 },
        { x: a.pelvis.x - 5, y: robeBottom + 6 },
        { x: a.pelvis.x - hemW - 4 - rig.pose.clothSway * 0.16, y: robeBottom - 3 }
      ], g, palette.outline, 2);
      line(ctx, a.chest.x - 7, a.chest.y - 3, a.pelvis.x + 10, robeBottom - 3, palette.accentDark, 3.2, 0.72);
      drawCharmGlyph(ctx, a.chest.x + 4, a.chest.y + 8, 0.82, palette, rig.pose.t, 0.72);
      if (profile.id === 'enchanter') drawEnchanterRobeDetails(ctx, rig, palette, topW, hemW, robeBottom, chestY);
      return;
    }

    if (profile.layers.torso === 'boneRitualCoat') {
      poly(ctx, [
        { x: a.chest.x - topW - 1 + skew, y: chestY },
        { x: a.chest.x + topW + 1 + skew, y: chestY },
        { x: a.pelvis.x + hemW + rig.pose.clothSway * 0.1, y: robeBottom - 9 },
        { x: a.pelvis.x + 9, y: robeBottom + 4 },
        { x: a.pelvis.x + 2, y: robeBottom - 5 },
        { x: a.pelvis.x - 8, y: robeBottom + 3 },
        { x: a.pelvis.x - hemW - rig.pose.clothSway * 0.1, y: robeBottom - 9 }
      ], g, palette.outline, 2);
      drawRibMarks(ctx, a.chest.x, a.chest.y + 1, palette);
      if (profile.id === 'necromancer') drawNecromancerRobeDetails(ctx, rig, palette, topW, hemW, robeBottom, chestY);
      return;
    }

    // Cleric vestment.
    poly(ctx, [
      { x: a.chest.x - topW + skew, y: chestY },
      { x: a.chest.x + topW + skew, y: chestY },
      { x: a.pelvis.x + hemW + rig.pose.clothSway * 0.12, y: robeBottom },
      { x: a.pelvis.x, y: robeBottom + 4 },
      { x: a.pelvis.x - hemW - rig.pose.clothSway * 0.12, y: robeBottom }
    ], g, palette.outline, 2);
    line(ctx, a.chest.x, a.chest.y - 4, a.pelvis.x, robeBottom - 2, palette.accent, 5, 0.96);
    line(ctx, a.chest.x, a.chest.y - 4, a.pelvis.x, robeBottom - 2, palette.accentDark, 1.2, 0.82);
  }

  function drawShoulderPackage(ctx, rig, palette, profile) {
    const a = rig.anchors;
    const d = rig.dir;
    const s = profile.silhouette;
    const y = a.chest.y - 16;
    const w = 23 * s.shoulder * (d.shoulderScale || 1);
    const side = d.side || 0;

    if (profile.layers.shoulders === 'wardenBurlPauldrons') {
      const sideBias = d.side || 1;
      ellipse(ctx, a.chest.x - w * 0.72 + sideBias, y + 2, 13.5, 8.2, -0.12, palette.bootHi, palette.outline, 2);
      ellipse(ctx, a.chest.x + w * 0.74 + sideBias, y + 3, 10.5, 6.2, 0.14, palette.cloth, palette.outline, 1.7);
      line(ctx, a.chest.x - 18, y + 7, a.chest.x + 18, y + 7, palette.belt, 3, 0.72);
      drawWardenShoulderDetails(ctx, rig, palette, w, y);
      return;
    }

    if (profile.layers.shoulders === 'platePauldrons') {
      ellipse(ctx, a.chest.x - w * 0.68 + side, y + 2, 10.5, 7.0, -0.14, palette.metal, palette.outline, 1.8);
      ellipse(ctx, a.chest.x + w * 0.68 + side, y + 2, 10.5, 7.0, 0.14, palette.metalDark, palette.outline, 1.8);
      line(ctx, a.chest.x - 15, y + 5, a.chest.x + 15, y + 5, palette.metal, 3, 0.8);
      return;
    }

    if (profile.layers.shoulders === 'softHoodMantle') {
      poly(ctx, [
        { x: a.chest.x - w, y: y + 1 },
        { x: a.chest.x - 5, y: y - 5 },
        { x: a.chest.x + 8, y: y - 4 },
        { x: a.chest.x + w, y: y + 1 },
        { x: a.chest.x + w - 7, y: y + 9 },
        { x: a.chest.x - w + 7, y: y + 9 }
      ], palette.clothDark, palette.outline, 1.8);
      if (profile.id === 'rogue') drawRogueShoulderDetails(ctx, rig, palette, w, y);
      if (profile.id === 'assassin') drawAssassinShoulderDetails(ctx, rig, palette, w, y);
      if (profile.id === 'ranger') drawRangerShoulderDetails(ctx, rig, palette, w, y);
      return;
    }

    if (profile.layers.shoulders === 'boneSpikes') {
      poly(ctx, [
        { x: a.chest.x - w, y: y + 5 }, { x: a.chest.x - w - 5, y: y - 7 }, { x: a.chest.x - w + 6, y: y + 2 }
      ], palette.accent, palette.outline, 1.3);
      poly(ctx, [
        { x: a.chest.x + w, y: y + 5 }, { x: a.chest.x + w + 5, y: y - 7 }, { x: a.chest.x + w - 6, y: y + 2 }
      ], palette.accentDark, palette.outline, 1.3);
      ellipse(ctx, a.chest.x, y + 4, w * 0.74, 4.8, 0, palette.clothDark, palette.outline, 1.2);
      if (profile.id === 'necromancer') drawNecromancerShoulderDetails(ctx, rig, palette, w, y);
      return;
    }


    if (profile.layers.shoulders === 'wizardMantle') {
      const mantle = ctx.createLinearGradient(-24, y - 4, 24, y + 17);
      mantle.addColorStop(0, palette.clothHi);
      mantle.addColorStop(0.58, palette.cloth);
      mantle.addColorStop(1, palette.clothDark);
      poly(ctx, [
        { x: a.chest.x - w * 0.82, y: y + 8 },
        { x: a.neck.x - 15, y: a.neck.y - 10 },
        { x: a.neck.x, y: a.neck.y - 4 },
        { x: a.neck.x + 15, y: a.neck.y - 10 },
        { x: a.chest.x + w * 0.84, y: y + 8 },
        { x: a.chest.x + w * 0.52, y: y + 16 },
        { x: a.chest.x - w * 0.52, y: y + 16 }
      ], mantle, palette.outline, 1.8);
      drawWizardShoulderDetails(ctx, rig, palette, w, y);
      return;
    }

    if (profile.layers.shoulders === 'mesmerCollar') {
      poly(ctx, [
        { x: a.chest.x - w * 0.70, y: y + 8 },
        { x: a.neck.x - 13, y: a.neck.y - 11 },
        { x: a.neck.x - 3, y: a.neck.y - 4 },
        { x: a.neck.x + 13, y: a.neck.y - 11 },
        { x: a.chest.x + w * 0.72, y: y + 8 },
        { x: a.chest.x + w * 0.42, y: y + 14 },
        { x: a.chest.x - w * 0.42, y: y + 14 }
      ], palette.clothDark, palette.outline, 1.7);
      line(ctx, a.neck.x - 10, a.neck.y - 9, a.chest.x + w * 0.45, y + 9, palette.accent, 1.4, 0.72);
      line(ctx, a.neck.x + 10, a.neck.y - 9, a.chest.x - w * 0.45, y + 9, palette.glow, 1.1, 0.52);
      if (profile.id === 'enchanter') drawEnchanterShoulderDetails(ctx, rig, palette, w, y);
      return;
    }

    if (profile.layers.shoulders === 'highCollar') {
      poly(ctx, [
        { x: a.chest.x - w * 0.78, y: y + 6 },
        { x: a.neck.x - 10, y: a.neck.y - 8 },
        { x: a.neck.x, y: a.neck.y - 3 },
        { x: a.neck.x + 10, y: a.neck.y - 8 },
        { x: a.chest.x + w * 0.78, y: y + 6 },
        { x: a.chest.x + w * 0.48, y: y + 13 },
        { x: a.chest.x - w * 0.48, y: y + 13 }
      ], palette.clothDark, palette.outline, 1.7);
      if (profile.id === 'summoner') drawSummonerShoulderDetails(ctx, rig, palette, w, y);
      if (profile.id === 'shaman') drawShamanShoulderDetails(ctx, rig, palette, w, y);
      return;
    }

    // Cleric soft mantle.
    ellipse(ctx, a.chest.x, y + 6, w * 0.82, 7.2, 0, palette.clothHi, palette.outline, 1.7);
    line(ctx, a.chest.x - w * 0.5, y + 8, a.chest.x + w * 0.5, y + 8, palette.accent, 1.6, 0.65);
  }

  function drawChestPackage(ctx, rig, palette, profile) {
    const a = rig.anchors;

    if (profile.layers.chest === 'wardenHeartBramble') {
      drawWardenChestDetails(ctx, rig, palette);
      return;
    }

    if (profile.layers.chest === 'plateRibs') {
      for (let i = -1; i <= 1; i++) {
        line(ctx, a.chest.x + i * 7, a.chest.y - 4, a.pelvis.x + i * 4, a.pelvis.y + 10, i === 0 ? palette.metal : palette.metalDark, 1.6, 0.78);
      }
      return;
    }

    if (profile.layers.chest === 'crossStraps') {
      line(ctx, a.chest.x - 11, a.chest.y - 4, a.pelvis.x + 11, a.pelvis.y + 12, palette.belt, 3.4, 0.9);
      line(ctx, a.chest.x + 11, a.chest.y - 4, a.pelvis.x - 11, a.pelvis.y + 12, palette.belt, 2.2, 0.72);
      ellipse(ctx, a.chest.x, a.chest.y + 7, 3.2, 3.2, 0, palette.metal, palette.outline, 1);
      if (profile.id === 'rogue') drawRogueChestHarnessDetails(ctx, rig, palette);
      if (profile.id === 'assassin') drawAssassinChestHarnessDetails(ctx, rig, palette);
      if (profile.id === 'ranger') drawRangerChestDetails(ctx, rig, palette);
      return;
    }

    if (profile.layers.chest === 'stoleCross') {
      drawCross(ctx, a.chest.x, a.chest.y + 7, 0.78, palette.accent, palette.outline);
      return;
    }


    if (profile.layers.chest === 'wizardCelestial') {
      drawWizardChestDetails(ctx, rig, palette);
      return;
    }

    if (profile.layers.chest === 'talismans') {
      drawFloatingCrystal(ctx, a.chest.x + 5, a.chest.y + 5, 0.65, palette.glow, palette.outline, rig.pose.t);
      drawHangingTalismans(ctx, a.chest.x - 9, a.chest.y + 3, palette, rig.pose.t);
      if (profile.id === 'summoner') drawSummonerChestDetails(ctx, rig, palette);
      if (profile.id === 'shaman') drawShamanChestDetails(ctx, rig, palette);
      return;
    }

    if (profile.layers.chest === 'charmSigil') {
      drawCharmGlyph(ctx, a.chest.x, a.chest.y + 8, 0.92, palette, rig.pose.t, 0.92);
      if (profile.id === 'enchanter') drawEnchanterChestDetails(ctx, rig, palette);
      return;
    }

    if (profile.layers.chest === 'ribCharm') {
      drawRibMarks(ctx, a.chest.x, a.chest.y + 2, palette);
      drawSkullCharm(ctx, a.chest.x, a.chest.y + 13, 0.62, palette);
      if (profile.id === 'necromancer') drawNecromancerChestDetails(ctx, rig, palette);
    }
  }

  function drawBeltPackage(ctx, rig, palette, profile) {
    const a = rig.anchors;
    const y = a.belt.y + 4;

    if (profile.layers.belt === 'rootBelt') {
      drawWardenBeltGear(ctx, rig, palette);
      return;
    }

    if (profile.layers.belt === 'warBelt') {
      roundRect(ctx, a.pelvis.x - 18, y - 3, 36, 7, 2, palette.belt, palette.outline, 1.2);
      roundRect(ctx, a.pelvis.x - 4, y - 5, 8, 10, 2, palette.metal, palette.outline, 1.1);
      return;
    }

    if (profile.layers.belt === 'pouchBelt') {
      line(ctx, a.pelvis.x - 18, y, a.pelvis.x + 18, y + 2, palette.belt, 3, 0.95);
      roundRect(ctx, a.pelvis.x + 9, y + 1, 8, 8, 2, palette.bootHi, palette.outline, 1);
      roundRect(ctx, a.pelvis.x - 18, y - 1, 7, 7, 2, palette.boot, palette.outline, 1);
      if (profile.id === 'rogue') drawRogueBeltGear(ctx, rig, palette);
      if (profile.id === 'assassin') drawAssassinBeltGear(ctx, rig, palette);
      if (profile.id === 'ranger') drawRangerBeltGear(ctx, rig, palette);
      return;
    }

    if (profile.layers.belt === 'holyCord') {
      line(ctx, a.pelvis.x - 17, y, a.pelvis.x + 17, y, palette.accent, 2.5, 0.9);
      ellipse(ctx, a.pelvis.x + 12, y + 7, 3, 5, 0, palette.accent, palette.outline, 0.8);
      return;
    }


    if (profile.layers.belt === 'wizardBelt') {
      drawWizardBeltGear(ctx, rig, palette, y);
      return;
    }

    if (profile.layers.belt === 'runeSash') {
      line(ctx, a.pelvis.x - 18, y - 3, a.pelvis.x + 17, y + 8, palette.accent, 3, 0.8);
      drawDiamond(ctx, a.pelvis.x + 2, y + 2, 5, palette.glow, palette.outline);
      if (profile.id === 'summoner') drawSummonerBeltGear(ctx, rig, palette, y);
      if (profile.id === 'shaman') drawShamanBeltGear(ctx, rig, palette, y);
      return;
    }

    if (profile.layers.belt === 'charmSash') {
      line(ctx, a.pelvis.x - 17, y - 4, a.pelvis.x + 18, y + 6, palette.accentDark, 3.1, 0.88);
      drawDiamond(ctx, a.pelvis.x + 7, y + 2, 4.5, palette.glow, palette.outline);
      line(ctx, a.pelvis.x + 9, y + 5, a.pelvis.x + 17, y + 18, palette.accent, 1.4, 0.58);
      if (profile.id === 'enchanter') drawEnchanterBeltGear(ctx, rig, palette, y);
      return;
    }

    if (profile.layers.belt === 'boneChain') {
      line(ctx, a.pelvis.x - 17, y - 1, a.pelvis.x + 17, y + 1, palette.accentDark, 2.3, 0.85);
      for (let i = -2; i <= 2; i++) drawBone(ctx, a.pelvis.x + i * 7, y + 5 + (i % 2), 0.45, palette);
      if (profile.id === 'necromancer') drawNecromancerBeltGear(ctx, rig, palette, y);
    }
  }

  function drawBackHairOrHood(ctx, rig, palette, profile) {
    if (!rig.dir.backVisible) return;
    const h = rig.anchors.head;
    if (profile.layers.head === 'barkMask') {
      ellipse(ctx, h.x, h.y - 2, h.rx + 4, h.ry + 5, 0, palette.bootHi, palette.outline, 1.8);
      drawWardenBackHeadDetails(ctx, rig, palette);
      return;
    }
    if (profile.layers.head === 'deepHood' || profile.layers.head === 'shadowHood') {
      const fill = profile.layers.head === 'shadowHood' ? palette.clothDark : palette.clothDark;
      ellipse(ctx, h.x, h.y - 1, h.rx + 3, h.ry + 4, 0, fill, palette.outline, 1.8);
      if (profile.id === 'assassin') drawAssassinBackHeadDetails(ctx, rig, palette);
      if (profile.id === 'necromancer') drawNecromancerBackHeadDetails(ctx, rig, palette);
      return;
    }
    if (profile.layers.head === 'arcaneCirclet') {
      ellipse(ctx, h.x, h.y - 1, h.rx + 1, h.ry + 2, 0, palette.hair, palette.outline, 1.6);
      if (profile.id === 'shaman') {
        drawShamanBackHeadDetails(ctx, rig, palette);
      } else {
        drawFloatingCrystal(ctx, h.x, h.y - 18, 0.44, palette.glow, palette.outline, rig.pose.t);
        drawSummonerBackHeadDetails(ctx, rig, palette);
      }
      return;
    }

    if (profile.layers.head === 'wizardHat') {
      drawWizardBackHeadDetails(ctx, rig, palette);
      return;
    }

    if (profile.layers.head === 'mindCirclet') {
      ellipse(ctx, h.x, h.y - 1, h.rx + 1, h.ry + 2, 0, palette.hair, palette.outline, 1.6);
      drawCharmGlyph(ctx, h.x, h.y - 18, 0.42, palette, rig.pose.t, 0.65);
      drawEnchanterBackHeadDetails(ctx, rig, palette);
      return;
    }
    if (profile.layers.head === 'tonsureHalo') {
      ellipse(ctx, h.x, h.y - 1, h.rx + 1, h.ry + 1, 0, palette.hair, palette.outline, 1.6);
      drawHalo(ctx, h.x, h.y - 17, 1, palette.glow);
    }
  }

  function drawHeadIdentity(ctx, rig, palette, profile) {
    const h = rig.anchors.head;
    const d = rig.dir;
    if (profile.layers.head === 'barkMask') {
      drawWardenHeadDetails(ctx, rig, palette);
      return;
    }

    if (profile.layers.head === 'deepHood' || profile.layers.head === 'shadowHood') {
      const hood = profile.layers.head === 'shadowHood' ? palette.clothDark : palette.clothDark;
      poly(ctx, [
        { x: h.x - h.rx - 4, y: h.y - 1 },
        { x: h.x - h.rx - 1, y: h.y - 14 },
        { x: h.x, y: h.y - 21 },
        { x: h.x + h.rx + 4, y: h.y - 14 },
        { x: h.x + h.rx + 2, y: h.y },
        { x: h.x + 5 * (d.side || 0), y: h.y + 8 },
        { x: h.x - h.rx * 0.8, y: h.y + 6 }
      ], hood, palette.outline, 1.8);
      if (profile.id === 'rogue') drawRogueHoodDetails(ctx, rig, palette);
      if (profile.id === 'assassin') drawAssassinHoodDetails(ctx, rig, palette);
      if (profile.id === 'necromancer') drawNecromancerHeadDetails(ctx, rig, palette);
      if (profile.layers.head === 'shadowHood' && !d.backVisible) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.48;
        line(ctx, h.x - 5, h.y - 1, h.x - 2, h.y - 1, palette.glow, 1.2, 0.6);
        line(ctx, h.x + 2, h.y - 1, h.x + 5, h.y - 1, palette.glow, 1.2, 0.6);
        ctx.restore();
      }
      return;
    }

    if (profile.layers.head === 'arcaneCirclet') {
      line(ctx, h.x - h.rx + 2, h.y - 8, h.x + h.rx - 2, h.y - 8, profile.id === 'shaman' ? palette.metal : palette.accent, 2, 0.8);
      if (profile.id === 'shaman') {
        drawShamanHeadDetails(ctx, rig, palette);
      } else {
        drawFloatingCrystal(ctx, h.x + (d.side || 0) * 4, h.y - 18, 0.42, palette.glow, palette.outline, rig.pose.t);
        drawSummonerHeadDetails(ctx, rig, palette);
      }
      return;
    }


    if (profile.layers.head === 'wizardHat') {
      drawWizardHeadDetails(ctx, rig, palette);
      return;
    }

    if (profile.layers.head === 'mindCirclet') {
      line(ctx, h.x - h.rx + 1, h.y - 8, h.x + h.rx - 1, h.y - 8, palette.accent, 2, 0.82);
      drawCharmGlyph(ctx, h.x + (d.side || 0) * 4, h.y - 18, 0.38, palette, rig.pose.t, 0.72);
      drawEnchanterHeadDetails(ctx, rig, palette);
      return;
    }

    if (profile.layers.head === 'tonsureHalo') {
      drawHalo(ctx, h.x, h.y - 17, 1, palette.glow);
      line(ctx, h.x - 8, h.y - 11, h.x + 8, h.y - 11, palette.accent, 1.7, 0.72);
      return;
    }

    if (profile.layers.head === 'bareWarrior') {
      // Simple brow band keeps the fighter from reading as another robe/hood caster.
      line(ctx, h.x - h.rx + 2, h.y - 7, h.x + h.rx - 2, h.y - 7, palette.belt, 2.2, 0.78);
      if (profile.id === 'ranger') drawRangerHeadDetails(ctx, rig, palette);
    }
  }

  function drawBackProp(ctx, rig, palette, profile) {
    const a = rig.anchors;
    const d = rig.dir;
    if (rig.pose?.action === 'fishing') return;
    if (!d.backVisible) return;
    const hideMainWeapon = shouldHideDefaultMainWeapon(rig);
    const hideOffhandWeapon = shouldHideDefaultOffhandWeapon(rig);

    if (profile.layers.mainProp === 'sword') {
      if (hideMainWeapon) return;
      drawSword(ctx, a.back.x + 12 * (d.side || 1), a.back.y + 1, -0.72, profile.silhouette.prop, palette, 0.72);
      return;
    }


    if (profile.layers.mainProp === 'wizardStaff') {
      if (!hideMainWeapon) drawWizardStaff(ctx, a.back.x + 16 * (d.side || 1), a.back.y - 5, -0.16 * (d.side || 1), profile.silhouette.prop * 1.05, palette, 0.78, rig.pose.t);
      drawWizardGrimoire(ctx, a.back.x - 18 * (d.side || 1), a.back.y + 2, 0.62, palette, rig.pose.t, 0.72, { chainSide: -(d.side || 1) });
      return;
    }

    if (profile.layers.mainProp === 'stormStaff') {
      if (hideMainWeapon) return;
      drawStormStaff(ctx, a.back.x + 17 * (d.side || 1), a.back.y - 4, -0.18 * (d.side || 1), profile.silhouette.prop, palette, 0.78);
      return;
    }

    if (profile.layers.mainProp === 'ritualRod') {
      if (hideMainWeapon) return;
      drawRitualRod(ctx, a.back.x + 15 * (d.side || 1), a.back.y - 3, -0.16 * (d.side || 1), profile.silhouette.prop, palette, 0.74);
      return;
    }

    if (profile.layers.mainProp === 'charmScepter') {
      if (hideMainWeapon) return;
      drawCharmScepter(ctx, a.back.x + 14 * (d.side || 1), a.back.y - 4, -0.12 * (d.side || 1), profile.silhouette.prop, palette, 0.76);
      return;
    }

    if (profile.layers.mainProp === 'boneStaff') {
      if (hideMainWeapon) return;
      drawBoneStaff(ctx, a.back.x + 16 * (d.side || 1), a.back.y - 6, -0.16 * (d.side || 1), profile.silhouette.prop, palette, 0.76);
      return;
    }

    if (profile.layers.mainProp === 'wardenHammer') {
      if (!hideMainWeapon) drawWardenHammer(ctx, a.back.x + 14 * (d.side || 1), a.back.y + 1, -0.30 * (d.side || 1), profile.silhouette.prop, palette, 0.74);
      drawLivingWoodShield(ctx, a.back.x - 13 * (d.side || 1), a.back.y + 4, profile.silhouette.prop * 0.92, palette, 0.68);
      return;
    }

    if (profile.layers.mainProp === 'mace') {
      if (hideMainWeapon) return;
      drawMace(ctx, a.back.x + 13 * (d.side || 1), a.back.y + 1, -0.35 * (d.side || 1), profile.silhouette.prop, palette, 0.68);
      return;
    }

    if (profile.layers.mainProp === 'longbow') {
      // A live combat target must produce the same aim-vector-driven drawn bow here as it does
      // in drawFrontProps - which row/view the body's 8-direction facing happens to quantize to
      // must not change whether the bow tracks the target.
      const actor = rig.actor || rig.sourceEntity || {};
      const rangedState = getRangerRangedAttackState(profile, actor);
      if (rangedState.active) {
        if (!hideMainWeapon) drawRangerDrawnBow(ctx, rig, palette, profile, rangedState.phase, rangedState.recovery);
        return;
      }
      if (!hideMainWeapon) drawLongbow(ctx, a.back.x + 11 * (d.side || 1), a.back.y - 1, -0.20 * (d.side || 1), profile.silhouette.prop * 1.05, palette, 0.84);
      drawQuiver(ctx, a.back.x - 13 * (d.side || 1), a.back.y + 2, 0.16 * (d.side || 1), profile.silhouette.prop * 0.92, palette, 0.86);
      return;
    }

    if (profile.layers.mainProp === 'assassinCrossbow') {
      if (!hideMainWeapon) {
        drawAssassinCrossbow(ctx, a.back.x + 9 * (d.side || 1), a.back.y - 1, -0.34 * (d.side || 1), profile.silhouette.prop * 0.92, palette, 0.88, { slung: true });
      }
      drawAssassinBackGear(ctx, rig, palette, 0.78);
      return;
    }

    if (profile.layers.mainProp === 'dagger') {
      const mh = a.mainHand || { x: a.back.x - 12, y: a.back.y - 6 };
      const oh = a.offHand || { x: a.back.x + 12, y: a.back.y - 6 };
      if (!hideMainWeapon) drawDagger(ctx, mh.x, mh.y - 8.8, -0.78, 0.98, palette, 0.88);
      if (!hideMainWeapon && !hideOffhandWeapon) drawDagger(ctx, oh.x, oh.y - 8.8, 0.78, 0.98, palette, 0.88);
    }
  }

  function drawMidProps(ctx, rig, palette, profile) {
    if (rig.pose?.action === 'fishing') return;
    if (rig.dir.backVisible) return;

    if (profile.id === 'wizard') {
      const a = rig.anchors;
      const p = rig.pose || {};
      const side = rig.dir?.side || 1;
      drawWizardGrimoire(ctx, a.chest.x - side * 31, a.chest.y + 1 + Math.sin((p.t || 0) * 1.35) * 1.1, 0.76, palette, p.t || 0, 0.92, { chainSide: -side });
      drawWizardElementalOrbs(ctx, a.chest.x, a.chest.y - 9, palette, p.t || 0, p.elementalPulse || 0.45);
    }
    if (profile.id === 'shaman') {
      const hand = rig.anchors.offHand;
      drawShamanSpiritOrbit(ctx, hand.x, hand.y - 6 - rig.pose.castPulse * 2, palette, rig.pose.t, 0.42 + rig.pose.castPulse * 0.22);
    }
    if (profile.id === 'summoner') {
      const hand = rig.anchors.offHand;
      drawFloatingCrystal(ctx, hand.x, hand.y - 5 - rig.pose.castPulse * 3, 0.62, palette.glow, palette.outline, rig.pose.t);
    }
    if (profile.id === 'enchanter') {
      const hand = rig.anchors.offHand;
      drawCharmGlyph(ctx, hand.x, hand.y - 6 - rig.pose.castPulse * 4, 0.48, palette, rig.pose.t, 0.52 + rig.pose.castPulse * 0.20);
    }
    if (profile.id === 'cleric' && rig.pose.action === 'cast') {
      drawHolySeal(ctx, rig.anchors.offHand.x, rig.anchors.offHand.y - 7, 0.72, palette);
    }
    if (profile.id === 'necromancer' && rig.pose.action === 'cast') {
      drawSkullCharm(ctx, rig.anchors.offHand.x, rig.anchors.offHand.y - 7, 0.76, palette);
    }
  }

  // Shared by both drawFrontProps and drawBackProp so the Ranger's bow-draw animation runs
  // identically regardless of which view/row the 8-direction body happens to be facing - a
  // due-west (or other back-row) target must get the exact same aim-vector-driven bow as a
  // due-east one, not fall back to a static, unaimed idle bow just because that row's body pose
  // shows more of the back.
  function getRangerRangedAttackState(profile, actor) {
    // Ranger's bow draw is driven by the same monotonic 0->1 auto-attack phase combat-system.js
    // resolves the hit/projectile against (phase reaches 1 exactly when the shot fires), never by
    // the shared melee attackCurve - that curve is a decaying post-hit swing flourish (bump-shaped,
    // effectively counting down from the previous hit) and mixing it in desynced the visual release
    // from the real projectile spawn by most of the swing interval and produced discontinuous,
    // out-of-range hand/string positions (the reported "white object").
    const active = profile.id === 'ranger' &&
      Boolean(actor.autoAttack) &&
      Boolean(actor.autoAttackVisualActive) &&
      String(actor.autoAttackVisualType || '').toLowerCase() === 'rangedweapon';
    const phase = active ? Math.max(0, Math.min(1, Number(actor.autoAttackVisualPhase ?? 0))) : 0;
    // Recovery reuses the existing brief post-hit settle timer (attackAnim: set to ~0.94 the instant
    // the shot fires, decaying to 0 over ~0.2s) so the drawing hand eases back to rest instead of
    // snapping there the instant the swing timer resets the phase back to 0 for the next cycle. Only
    // active during that brief decay window - once it reaches 0 the normal raise-phase pose (already
    // near idle at the start of a fresh cycle) takes back over.
    const recovery = profile.id === 'ranger' && Number(actor.attackAnim || 0) > 0
      ? Math.max(0, Math.min(1, 1 - Number(actor.attackAnim) / 0.94))
      : 0;
    return { active, phase, recovery };
  }

  function drawFrontProps(ctx, rig, palette, profile) {
    const d = rig.dir;
    if (rig.pose?.action === 'fishing') return;
    if (d.backVisible) return;
    const mh = rig.anchors.mainHand;
    const oh = rig.anchors.offHand;
    const side = d.side || 1;
    const attack = rig.pose.attackCurve || 0;
    const cast = rig.pose.action === 'cast' ? rig.pose.castPulse : 0;
    const hideMainWeapon = shouldHideDefaultMainWeapon(rig);
    const hideOffhandWeapon = shouldHideDefaultOffhandWeapon(rig);
    const actor = rig.actor || rig.sourceEntity || {};
    const rangedState = getRangerRangedAttackState(profile, actor);
    const rangedAttackActive = rangedState.active;
    const rangedAttackPhase = rangedState.phase;
    const rangedRecovery = rangedState.recovery;


    if (profile.layers.mainProp === 'wizardStaff') {
      if (!hideMainWeapon) drawWizardStaff(ctx, mh.x + side * 2, mh.y - 15 - cast * 6, -0.10 * side - cast * 0.04 * side, profile.silhouette.prop * 1.06, palette, 0.98, rig.pose.t);
      if (!hideOffhandWeapon) drawWizardCastingHand(ctx, oh.x - side * 1, oh.y - 6 - cast * 4, palette, rig.pose.t, 0.42 + cast * 0.34);
      return;
    }

    if (profile.layers.mainProp === 'stormStaff') {
      if (!hideMainWeapon) drawStormStaff(ctx, mh.x + side * 2, mh.y - 12 - cast * 5, -0.10 * side - cast * 0.04 * side, profile.silhouette.prop, palette, 0.98);
      if (!hideOffhandWeapon) drawShamanCastingHand(ctx, oh.x - side * 1, oh.y - 6 - cast * 3, palette, rig.pose.t, 0.42 + cast * 0.34);
      return;
    }

    if (profile.layers.mainProp === 'wardenHammer') {
      if (!hideMainWeapon) drawWardenHammer(ctx, mh.x + side * attack * 5, mh.y - 5 - attack * 6, 0.18 * side - attack * 0.34 * side, profile.silhouette.prop, palette, 0.98);
      if (!hideOffhandWeapon) drawLivingWoodShield(ctx, oh.x - side * 4, oh.y - 3, profile.silhouette.prop, palette, d.view === 'side' ? 0.78 : 1);
      return;
    }

    if (profile.layers.mainProp === 'sword') {
      if (!hideMainWeapon) drawSword(ctx, mh.x + side * attack * 6, mh.y - 8 - attack * 9, 0.18 * side - attack * 0.5 * side, profile.silhouette.prop, palette, 0.95);
      if (!hideOffhandWeapon) drawShield(ctx, oh.x - side * 4, oh.y - 4, profile.silhouette.prop, palette, d.view === 'side' ? 0.75 : 1);
      return;
    }

    if (profile.layers.mainProp === 'longbow') {
      if (!hideMainWeapon) {
        const aimSide = rangedAttackActive ? getRangerCombatAim(rig).side : side;
        if (rangedAttackActive) drawRangerDrawnBow(ctx, rig, palette, profile, rangedAttackPhase, rangedRecovery);
        else drawLongbow(ctx, mh.x + aimSide * 3, mh.y + 2, -0.06 * aimSide, profile.silhouette.prop * 1.02, palette, 0.98);
      }
      return;
    }

    if (profile.layers.mainProp === 'assassinCrossbow') {
      if (!hideMainWeapon) {
        const brace = rig.pose.crossbowBrace || 0.34;
        const recoil = attack * 3.4;
        drawAssassinCrossbow(ctx, mh.x + side * (2.0 + recoil), mh.y - 9.5 - attack * 3.5, -0.14 * side - attack * 0.16 * side, profile.silhouette.prop * (0.84 + brace * 0.10), palette, 1, { loaded: true });
      }
      if (!hideOffhandWeapon) {
        drawTinyKnife(ctx, oh.x - side * 1.5, oh.y - 8.6 - attack * 3, 0.26 * side, 0.82, palette, 0.92);
      }
      return;
    }

    if (profile.layers.mainProp === 'dagger') {
      // V0.14.27: anchor the dagger grip center to the actual hand positions.
      // The dagger local grip center is near +8.8y, so the origin is raised by that amount.
      if (!hideMainWeapon) drawDagger(ctx, mh.x + side * (attack * 2.5 + 0.5), mh.y - 8.8 - attack * 7.5, -0.34 * side - attack * 0.42 * side, profile.silhouette.prop * 1.06, palette, 1);
      if (!hideMainWeapon && !hideOffhandWeapon) drawDagger(ctx, oh.x - side * 0.5, oh.y - 8.8, 0.34 * side, profile.silhouette.prop * 1.02, palette, 0.96);
      return;
    }

    if (profile.layers.mainProp === 'mace') {
      if (!hideMainWeapon) drawMace(ctx, mh.x, mh.y - 8 - cast * 4, -0.12 * side, profile.silhouette.prop, palette, 0.95);
      if (!hideOffhandWeapon) drawHolySeal(ctx, oh.x - side * 2, oh.y - 5, 0.65, palette);
      return;
    }

    if (profile.layers.mainProp === 'ritualRod') {
      if (!hideMainWeapon) drawRitualRod(ctx, mh.x + side * 2, mh.y - 12 - cast * 5, -0.14 * side, profile.silhouette.prop, palette, 0.95);
      return;
    }

    if (profile.layers.mainProp === 'charmScepter') {
      if (!hideMainWeapon) drawCharmScepter(ctx, mh.x + side * 2, mh.y - 12 - cast * 6, -0.10 * side, profile.silhouette.prop, palette, 0.96);
      if (!hideOffhandWeapon) drawCharmGlyph(ctx, oh.x - side * 1, oh.y - 7 - cast * 3, 0.48, palette, rig.pose.t, 0.58 + cast * 0.22);
      return;
    }

    if (profile.layers.mainProp === 'boneStaff') {
      if (!hideMainWeapon) drawBoneStaff(ctx, mh.x + side * 2, mh.y - 12 - cast * 5, -0.18 * side, profile.silhouette.prop, palette, 0.95);
      if (!hideOffhandWeapon) drawSkullCharm(ctx, oh.x - side * 2, oh.y - 4, 0.62, palette);
      return;
    }
  }

  function drawFrontClassDetails(ctx, rig, palette, profile) {
    if (rig.dir.backVisible) return;
    if (profile.id === 'rogue') {
      const a = rig.anchors;
      roundRect(ctx, a.pelvis.x + 16, a.pelvis.y - 9, 7, 9, 2, palette.bootHi, palette.outline, 0.9);
      roundRect(ctx, a.pelvis.x - 23, a.pelvis.y - 8, 6, 8, 2, palette.boot, palette.outline, 0.9);
      drawRogueLegDetails(ctx, rig, palette);
    }
    if (profile.id === 'assassin') {
      drawAssassinLowerDetails(ctx, rig, palette);
    }
    if (profile.id === 'ranger') {
      drawRangerHipBlades(ctx, rig, palette);
      drawRangerLegDetails(ctx, rig, palette);
    }
    if (profile.id === 'warden') {
      drawWardenLegDetails(ctx, rig, palette);
    }
    if (profile.id === 'wizard') {
      drawWizardLowerDetails(ctx, rig, palette);
      return;
    }
    if (profile.id === 'shaman') {
      const a = rig.anchors;
      drawShamanLowerDetails(ctx, rig, palette);
      drawStormGroundRing(ctx, a.ground.x, a.ground.y + 1, palette, rig.pose.t, 0.18 + rig.pose.castPulse * 0.08);
    }
    if (profile.id === 'summoner') {
      const a = rig.anchors;
      drawRuneCircle(ctx, a.chest.x, a.chest.y + 7, 14 + rig.pose.castPulse * 2, palette, 0.16);
      drawSummonerLowerDetails(ctx, rig, palette);
    }
    if (profile.id === 'enchanter') {
      const a = rig.anchors;
      drawCharmGlyph(ctx, a.chest.x, a.chest.y + 7, 0.66, palette, rig.pose.t, 0.45);
      return;
    }
    if (profile.id === 'necromancer') {
      const a = rig.anchors;
      drawNecromancerLowerDetails(ctx, rig, palette);
      drawDiamond(ctx, a.chest.x, a.chest.y + 8, 1.9, palette.glow, palette.outline);
    }
  }


  function drawAssassinCloakDetail(ctx, rig, palette) {
    const a = rig.anchors;
    const side = rig.dir.side || 1;
    const sway = rig.pose.capeSway * 0.22;
    const leftWeight = -Math.abs(side || 1);
    const y = a.pelvis.y + 34;
    // Asymmetric waxed-canvas shoulder cape: heavier over the loading arm, jagged weighted hem.
    const canvas = ctx.createLinearGradient(-24, a.chest.y - 18, 16, y + 6);
    canvas.addColorStop(0, palette.clothHi || '#303744');
    canvas.addColorStop(0.38, palette.cloth || '#121722');
    canvas.addColorStop(1, palette.clothDark || '#05070a');
    poly(ctx, [
      { x: a.chest.x - 21 + sway * 0.3, y: a.chest.y - 13 },
      { x: a.chest.x + 9 + sway * 0.1, y: a.chest.y - 11 },
      { x: a.pelvis.x + 12 + sway, y: y - 7 },
      { x: a.pelvis.x + 5, y: y + 2 },
      { x: a.pelvis.x - 2, y: y - 6 },
      { x: a.pelvis.x - 12, y: y + 3 },
      { x: a.pelvis.x - 24 - sway, y: y - 5 }
    ], canvas, palette.outline, 1.6);
    // Sewn lead weights and frayed silhouette breakers.
    for (let i = 0; i < 5; i++) {
      const x = a.pelvis.x - 19 + i * 8 + (i % 2 ? sway * 0.2 : -sway * 0.1);
      const yy = y - 3 + (i % 2) * 4;
      ellipse(ctx, x, yy, 1.7, 1.2, 0, palette.metalDark, palette.outline, 0.35);
      line(ctx, x - 1.5, yy - 4, x + 0.6, yy + 2, palette.clothHi, 0.45, 0.24);
    }
    line(ctx, a.chest.x - 19, a.chest.y - 7, a.pelvis.x + 11 + leftWeight * 1.5, y - 4, palette.accentDark, 0.85, 0.36);
    // Tucked gauze shroud held by a small bone toggle.
    line(ctx, a.chest.x + 8 * side, a.chest.y - 6, a.chest.x + 15 * side, a.chest.y + 5, 'rgba(170,180,185,0.42)', 1.2, 0.55);
    ellipse(ctx, a.chest.x + 15 * side, a.chest.y + 6, 2.0, 3.2, 0.2 * side, '#c5b58a', palette.outline, 0.45);
    drawAssassinBackGear(ctx, rig, palette, 0.64);
  }

  function drawAssassinBackGear(ctx, rig, palette, alpha = 1) {
    const a = rig.anchors;
    const side = rig.dir.side || 1;
    ctx.save();
    ctx.globalAlpha *= alpha;
    // Padded back plate with spinal groove and compact trap carry points.
    roundRect(ctx, a.back.x - 8, a.back.y - 9, 16, 31, 3, palette.clothDark, palette.outline, 0.8);
    line(ctx, a.back.x, a.back.y - 7, a.back.x, a.back.y + 19, palette.clothHi, 0.7, 0.28);
    drawAssassinBoltQuiver(ctx, a.back.x - 16 * side, a.back.y + 7, 0.12 * side, 0.62, palette, 0.95);
    // Collapsed caltrop / bear-trap dispenser below cloak line.
    roundRect(ctx, a.back.x + 14 * side, a.back.y + 14, 13, 9, 2, palette.metalDark, palette.outline, 0.8);
    line(ctx, a.back.x + 16 * side, a.back.y + 16, a.back.x + 25 * side, a.back.y + 22, palette.metal, 0.9, 0.62);
    line(ctx, a.back.x + 24 * side, a.back.y + 16, a.back.x + 15 * side, a.back.y + 22, palette.metal, 0.9, 0.62);
    // Horizontal poisoner's dagger at small of back.
    drawTinyKnife(ctx, a.back.x - 1 * side, a.back.y + 28, Math.PI / 2, 0.72, palette, 0.86);
    ctx.restore();
  }

  function drawAssassinTorsoDetails(ctx, rig, palette, topW, hemW, chestY) {
    const a = rig.anchors;
    const side = rig.dir.side || 1;
    const beltY = a.belt.y + 4;
    // Matte fitted cuirass ribbing and leather grain. These are procedural surface details, not new silhouette.
    for (let i = -2; i <= 2; i++) {
      const x = a.chest.x + i * 4.8;
      line(ctx, x, chestY + 3 + Math.abs(i) * 0.6, a.pelvis.x + i * 2.4, beltY + 6, i === 0 ? palette.clothHi : palette.clothDark, 0.58, i === 0 ? 0.32 : 0.22);
    }
    for (let i = 0; i < 5; i++) {
      line(ctx, a.chest.x - topW + 5, chestY + 7 + i * 4, a.chest.x + topW - 3, chestY + 5 + i * 3.5, palette.outline, 0.35, 0.18);
    }
    // Sternum execution/crosshair motif, intentionally subdued.
    drawAssassinExecutionMark(ctx, a.chest.x, a.chest.y + 4, 0.50, palette, 0.54);
    // Deep red sash under belt, hanging to mid-thigh.
    const sash = '#4b1018';
    line(ctx, a.pelvis.x - 17, beltY + 2, a.pelvis.x + 15, beltY + 4, sash, 3.2, 0.72);
    poly(ctx, [
      { x: a.pelvis.x + 4, y: beltY + 5 },
      { x: a.pelvis.x + 12, y: beltY + 7 },
      { x: a.pelvis.x + 9 + rig.pose.clothSway * 0.08, y: beltY + 28 },
      { x: a.pelvis.x + 3, y: beltY + 24 }
    ], sash, palette.outline, 0.75);
    line(ctx, a.pelvis.x + 7, beltY + 8, a.pelvis.x + 8, beltY + 23, 'rgba(170,66,72,0.55)', 0.65, 0.55);
    // Low-profile webbing over the cuirass.
    line(ctx, a.chest.x - 12, a.chest.y - 5, a.pelvis.x + 13, beltY + 5, palette.belt, 2.0, 0.86);
    line(ctx, a.chest.x + 11, a.chest.y - 5, a.pelvis.x - 12, beltY + 4, palette.belt, 1.5, 0.72);
    for (let i = 0; i < 4; i++) {
      drawTinyKnife(ctx, a.chest.x - 12 + i * 5.5, a.chest.y + 2 + i * 1.8, -0.30 * side, 0.52, palette, 0.82);
    }
  }

  function drawAssassinShoulderDetails(ctx, rig, palette, w, y) {
    const a = rig.anchors;
    const side = rig.dir.side || 1;
    // Larger recoil pauldron on the loading arm; compact studs only, no flashy armor.
    const loadX = a.chest.x - w * 0.58 * side;
    const offX = a.chest.x + w * 0.52 * side;
    for (let i = 0; i < 3; i++) {
      roundRect(ctx, loadX - 7, y - 2 + i * 3, 14, 4.2, 2, i === 0 ? palette.bootHi : palette.boot, palette.outline, 0.7);
      ellipse(ctx, loadX - 4 + i * 4, y + 0.3 + i * 3, 0.8, 0.8, 0, palette.metalDark, null, 0.2);
    }
    roundRect(ctx, offX - 5, y + 1, 10, 4.5, 2, palette.boot, palette.outline, 0.65);
    for (let i = -2; i <= 2; i++) line(ctx, a.chest.x + i * 5, y + 7, a.chest.x + i * 5 + side * 1.6, y + 10, palette.clothHi, 0.45, 0.28);
  }

  function drawAssassinChestHarnessDetails(ctx, rig, palette) {
    const a = rig.anchors;
    const side = rig.dir.side || 1;
    // Black webbing, quick-draw knife sheaths, bolt clasps.
    line(ctx, a.chest.x - 15, a.chest.y + 14, a.chest.x + 15, a.chest.y + 15, palette.belt, 1.2, 0.72);
    for (let i = -1; i <= 1; i++) roundRect(ctx, a.chest.x + i * 7 - 2, a.chest.y + 7 + Math.abs(i), 4, 4, 1, palette.brass || palette.metalDark, palette.outline, 0.45);
    for (let i = 0; i < 3; i++) {
      const x = a.chest.x - 14 + i * 6;
      drawTinyKnife(ctx, x, a.chest.y + 11 + i, -0.16 * side, 0.48, palette, 0.78);
    }
    // Small scope-lens storage folded against the harness for side/back readability.
    ellipse(ctx, a.chest.x + 15 * side, a.chest.y + 5, 2.7, 2.7, 0, palette.shadowGlass || palette.glow, palette.outline, 0.55);
  }

  function drawAssassinBeltGear(ctx, rig, palette) {
    const a = rig.anchors;
    const y = a.belt.y + 5;
    const side = rig.dir.side || 1;
    roundRect(ctx, a.pelvis.x - 4, y - 4, 8, 7, 1.8, palette.metalDark, palette.outline, 0.75);
    // Toolkit pouch, smoke bomb, poison vials, gas globes, folded grapple.
    roundRect(ctx, a.pelvis.x + 17 * side, y + 2, 10, 12, 2, palette.boot, palette.outline, 0.78);
    roundRect(ctx, a.pelvis.x - 25 * side, y + 3, 9, 10, 2, palette.bootHi, palette.outline, 0.72);
    drawAssassinGasGlobe(ctx, a.pelvis.x - 15 * side, y + 16, 0.46, palette, 0.82);
    drawAssassinGasGlobe(ctx, a.pelvis.x - 8 * side, y + 18, 0.36, palette, 0.70);
    drawAssassinPoisonVial(ctx, a.pelvis.x + 24 * side, y + 15, 0.48, palette, 0.86);
    // Folded grappling hook and silk rope coil.
    ctx.save();
    ctx.strokeStyle = palette.metal;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.arc(a.pelvis.x + 10 * side, y + 13, 4.8, 0, TAU);
    ctx.stroke();
    ctx.restore();
    line(ctx, a.pelvis.x + 13 * side, y + 7, a.pelvis.x + 20 * side, y + 2, palette.metal, 0.8, 0.72);
    line(ctx, a.pelvis.x + 18 * side, y + 4, a.pelvis.x + 17 * side, y + 0, palette.metal, 0.75, 0.70);
    line(ctx, a.pelvis.x + 18 * side, y + 4, a.pelvis.x + 22 * side, y + 4, palette.metal, 0.75, 0.70);
  }

  function drawAssassinBackHeadDetails(ctx, rig, palette) {
    const h = rig.anchors.head;
    const side = rig.dir.side || 1;
    // Hood frame seams and folded brass/smoked-glass targeting lens visible at temple.
    line(ctx, h.x - h.rx + 2, h.y - 12, h.x, h.y - 20, palette.clothHi, 0.6, 0.26);
    line(ctx, h.x + h.rx - 2, h.y - 12, h.x, h.y - 20, palette.clothHi, 0.6, 0.20);
    ellipse(ctx, h.x + h.rx * side, h.y - 8, 2.3, 3.2, 0.15 * side, palette.brass || palette.metalDark, palette.outline, 0.45);
    ellipse(ctx, h.x + (h.rx + 0.7) * side, h.y - 8, 1.1, 1.5, 0.15 * side, palette.shadowGlass || palette.glow, null, 0.2);
  }

  function drawAssassinHoodDetails(ctx, rig, palette) {
    const h = rig.anchors.head;
    const d = rig.dir;
    if (d.backVisible) return;
    const side = d.side || 1;
    // Sculpted lower-face wrap, breathing perforations, brow shadow, and calm eye glint.
    poly(ctx, [
      { x: h.x - h.rx * 0.78, y: h.y - 1 },
      { x: h.x + h.rx * 0.80, y: h.y - 1 },
      { x: h.x + h.rx * 0.58, y: h.y + 9 },
      { x: h.x + side * 1.5, y: h.y + 12 },
      { x: h.x - h.rx * 0.58, y: h.y + 8 }
    ], 'rgba(5,7,10,0.93)', palette.outline, 0.75);
    line(ctx, h.x - h.rx + 1.5, h.y - 12, h.x + h.rx - 1.5, h.y - 12, palette.clothHi, 0.9, 0.30);
    line(ctx, h.x - h.rx * 0.55, h.y + 3, h.x + h.rx * 0.50, h.y + 3, palette.clothHi, 0.55, 0.22);
    for (let i = -2; i <= 2; i++) ellipse(ctx, h.x + i * 3, h.y + 5 + Math.abs(i) * 0.3, 0.55, 0.45, 0, palette.metalDark, null, 0.16);
    line(ctx, h.x - 6, h.y - 4, h.x - 2, h.y - 4, palette.glow, 0.9, 0.72);
    line(ctx, h.x + 2, h.y - 4, h.x + 6, h.y - 4, palette.shadowGlass || palette.glow, 0.9, 0.66);
    // Folded targeting monocle with cogs.
    ellipse(ctx, h.x + (h.rx + 2.0) * side, h.y - 7, 2.8, 3.4, 0.1 * side, palette.brass || palette.metalDark, palette.outline, 0.55);
    ellipse(ctx, h.x + (h.rx + 2.2) * side, h.y - 7, 1.25, 1.7, 0.1 * side, palette.shadowGlass || palette.glow, null, 0.25);
    for (let i = 0; i < 3; i++) line(ctx, h.x + (h.rx + 4 + i) * side, h.y - 9 + i, h.x + (h.rx + 5.4 + i) * side, h.y - 10 + i, palette.metal, 0.45, 0.50);
  }

  function drawAssassinLowerDetails(ctx, rig, palette) {
    const a = rig.anchors;
    const y = a.pelvis.y + 24;
    const side = rig.dir.side || 1;
    // Quilted knees, shin greaves, soft wrapped boots, and boot blade sheaths.
    for (let i = 0; i < 2; i++) {
      const x = a.pelvis.x + (i ? 7 : -14);
      roundRect(ctx, x, y - 2 + i, 8, 6, 2, i ? palette.bootHi : palette.boot, palette.outline, 0.65);
      for (let q = 0; q < 3; q++) line(ctx, x + 1, y + q * 2, x + 7, y + q * 2 + 1, palette.clothHi, 0.35, 0.22);
    }
    line(ctx, a.pelvis.x - 15, y + 9, a.pelvis.x - 5, y + 11, palette.belt, 0.95, 0.55);
    line(ctx, a.pelvis.x + 4, y + 10, a.pelvis.x + 15, y + 9, palette.belt, 0.95, 0.55);
    roundRect(ctx, a.pelvis.x - 15, y + 13, 10, 8, 2, palette.metalDark, palette.outline, 0.52);
    roundRect(ctx, a.pelvis.x + 5, y + 14, 10, 8, 2, palette.metalDark, palette.outline, 0.52);
    drawTinyKnife(ctx, a.pelvis.x + 18 * side, y + 5, -0.12 * side, 0.52, palette, 0.76);
    drawTinyKnife(ctx, a.pelvis.x - 18 * side, y + 7, 0.18 * side, 0.46, palette, 0.62);
  }

  function drawAssassinExecutionMark(ctx, x, y, scale, palette, alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    const s = scale || 1;
    ctx.globalCompositeOperation = 'screen';
    ellipse(ctx, x, y, 5.5 * s, 5.5 * s, 0, 'rgba(124,104,255,0.14)', null, 0);
    ctx.globalCompositeOperation = 'source-over';
    drawDiamond(ctx, x, y, 4.2 * s, palette.glow || '#ad84ff', palette.outline);
    line(ctx, x - 7 * s, y, x + 7 * s, y, palette.poison || palette.accent, 0.65 * s, 0.66);
    line(ctx, x, y - 7 * s, x, y + 7 * s, palette.poison || palette.accent, 0.65 * s, 0.66);
    ctx.restore();
  }

  function drawAssassinPoisonVial(ctx, x, y, scale, palette, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha *= alpha == null ? 1 : alpha;
    const s = scale || 1;
    roundRect(ctx, -2.8 * s, -7.5 * s, 5.6 * s, 13.5 * s, 2.2 * s, 'rgba(57,211,103,0.58)', palette.outline, 0.7 * s);
    line(ctx, -1.6 * s, -5.2 * s, 1.7 * s, 4.6 * s, 'rgba(210,255,220,0.55)', 0.55 * s, 0.6);
    roundRect(ctx, -2.0 * s, -9.2 * s, 4.0 * s, 2.4 * s, 0.6 * s, palette.brass || palette.metalDark, palette.outline, 0.4 * s);
    ellipse(ctx, 0.9 * s, 1.0 * s, 0.7 * s, 0.7 * s, 0, 'rgba(230,255,230,0.5)', null, 0);
    ctx.restore();
  }

  function drawAssassinGasGlobe(ctx, x, y, scale, palette, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha *= alpha == null ? 1 : alpha;
    const s = scale || 1;
    ellipse(ctx, 0, 0, 5.0 * s, 5.0 * s, 0, 'rgba(39,112,56,0.74)', palette.outline, 0.8 * s);
    ellipse(ctx, -1.4 * s, -1.6 * s, 1.3 * s, 1.0 * s, -0.4, 'rgba(116,238,124,0.46)', null, 0);
    line(ctx, 0, -5.0 * s, 1.8 * s, -8.0 * s, palette.belt, 0.8 * s, 0.7);
    ctx.restore();
  }

  function drawAssassinBoltQuiver(ctx, x, y, rot, scale, palette, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.globalAlpha *= alpha == null ? 1 : alpha;
    const s = scale || 1;
    roundRect(ctx, -5.0 * s, -13.0 * s, 10.0 * s, 26.0 * s, 2.2 * s, palette.boot, palette.outline, 0.75 * s);
    const colors = [palette.poison || '#53df78', '#1b1b21', '#d9d8cc'];
    for (let i = 0; i < 5; i++) {
      const ox = -3.4 * s + i * 1.7 * s;
      line(ctx, ox, -21.0 * s - (i % 2) * 1.0 * s, ox, -5.0 * s, palette.outline, 1.3 * s, 0.95);
      line(ctx, ox, -20.6 * s - (i % 2) * 1.0 * s, ox, -5.2 * s, palette.metal, 0.55 * s, 0.9);
      ellipse(ctx, ox, -4.2 * s, 0.9 * s, 2.1 * s, 0, colors[i % colors.length], palette.outline, 0.25 * s);
    }
    ctx.restore();
  }

  function drawAssassinCrossbow(ctx, x, y, rot, scale, palette, alpha, opts = {}) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.globalAlpha *= alpha == null ? 1 : alpha;
    const s = scale || 1;
    const wood = palette.belt || '#372b2f';
    const steel = palette.metalDark || '#303942';
    const edge = palette.metalHi || palette.metal || '#d1d6d4';
    const brass = palette.brass || '#7c6240';
    const string = 'rgba(230,232,226,0.82)';
    // Stock and leather cheek rest.
    roundRect(ctx, -15 * s, -4.2 * s, 34 * s, 8.4 * s, 2.2 * s, wood, palette.outline, 0.9 * s);
    roundRect(ctx, -12 * s, -7.4 * s, 14 * s, 4.8 * s, 1.6 * s, palette.boot, palette.outline, 0.5 * s);
    line(ctx, -10 * s, 2.5 * s, 12 * s, 2.5 * s, palette.clothHi || edge, 0.65 * s, 0.28);
    // Compact dark-steel prod, recurved limbs, and waxed string.
    line(ctx, 16 * s, 0, 28 * s, -16 * s, palette.outline, 4.1 * s, 1);
    line(ctx, 16 * s, 0, 28 * s, 16 * s, palette.outline, 4.1 * s, 1);
    line(ctx, 16 * s, 0, 27 * s, -15 * s, steel, 2.1 * s, 0.95);
    line(ctx, 16 * s, 0, 27 * s, 15 * s, steel, 2.1 * s, 0.95);
    line(ctx, 27 * s, -15 * s, 27 * s, 15 * s, string, 0.9 * s, 0.82);
    // Built-in stirrup and cocking channel.
    ctx.save();
    ctx.strokeStyle = steel;
    ctx.lineWidth = 1.3 * s;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(31 * s, 0, 4.2 * s, 6.0 * s, 0, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.stroke();
    ctx.restore();
    line(ctx, -3 * s, 0, 28 * s, 0, palette.outline, 2.4 * s, 1);
    line(ctx, -2 * s, 0, 27 * s, 0, edge, 0.9 * s, 0.82);
    // Loaded bolt with poison fletching variants.
    if (opts.loaded || opts.slung) {
      line(ctx, 0, 0, 30 * s, 0, palette.outline, 1.6 * s, 0.95);
      line(ctx, 1 * s, 0, 28 * s, 0, palette.metal, 0.6 * s, 0.9);
      poly(ctx, [
        { x: 31.5 * s, y: 0 },
        { x: 26.5 * s, y: -2.0 * s },
        { x: 27.8 * s, y: 0 },
        { x: 26.5 * s, y: 2.0 * s }
      ], edge, palette.outline, 0.55 * s);
      line(ctx, -1 * s, -2.8 * s, -6 * s, -5.2 * s, palette.poison || palette.accent, 0.9 * s, 0.8);
      line(ctx, -1 * s, 2.8 * s, -6 * s, 5.2 * s, '#141419', 0.9 * s, 0.72);
    }
    // Brass scope with liquid-shadow vial and glowing reticle.
    roundRect(ctx, 0 * s, -12 * s, 17 * s, 4.6 * s, 1.8 * s, brass, palette.outline, 0.55 * s);
    ellipse(ctx, 16.8 * s, -9.7 * s, 2.2 * s, 2.3 * s, 0, palette.shadowGlass || palette.glow, palette.outline, 0.35 * s);
    drawDiamond(ctx, 5.5 * s, -15.0 * s, 2.0 * s, palette.shadowGlass || palette.glow, palette.outline);
    line(ctx, 4.2 * s, -15.0 * s, 6.8 * s, -15.0 * s, palette.poison || palette.accent, 0.45 * s, 0.70);
    // Crossbow stock execution mark.
    drawAssassinExecutionMark(ctx, -8.2 * s, 0, 0.30 * s, palette, 0.58);
    ctx.restore();
  }

  function drawAssassinExecutionAura(ctx, rig, palette, pulse) {
    const a = rig.anchors;
    const p = rig.pose || {};
    const t = p.t || 0;
    const amount = Math.max(0.2, Math.min(1.2, pulse || 0.5));
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 5; i++) {
      const ang = t * 1.4 + i * (TAU / 5);
      const r = 13 + i * 2 + amount * 4;
      const x = a.chest.x + Math.cos(ang) * r;
      const y = a.chest.y + 5 + Math.sin(ang) * r * 0.55;
      ellipse(ctx, x, y, 1.2, 1.2, 0, i % 2 ? palette.poison || palette.accent : palette.shadowGlass || palette.glow, null, 0);
    }
    ctx.globalAlpha = 0.18 + amount * 0.12;
    drawAssassinExecutionMark(ctx, a.chest.x, a.chest.y + 4, 1.0 + amount * 0.18, palette, 0.52);
    ctx.restore();
  }


  function drawRogueCloakDetail(ctx, rig, palette) {
    const a = rig.anchors;
    const side = rig.dir.capeSide || rig.dir.side || 1;
    const sway = rig.pose.capeSway * 0.20;
    const y = a.pelvis.y + 39;
    // Jagged short cloak hem and inner lining. Kept compact so Rogue stays agile.
    poly(ctx, [
      { x: a.pelvis.x - 20 - sway, y: y - 8 },
      { x: a.pelvis.x - 13, y: y + 1 },
      { x: a.pelvis.x - 7, y: y - 9 },
      { x: a.pelvis.x, y: y + 2 },
      { x: a.pelvis.x + 6, y: y - 10 },
      { x: a.pelvis.x + 15, y: y + 1 },
      { x: a.pelvis.x + 21 + sway, y: y - 8 }
    ], 'rgba(5,7,12,0.58)', palette.outline, 0.8);
    line(ctx, a.chest.x - 14, a.chest.y - 9, a.pelvis.x + 16 * side, a.pelvis.y + 32, palette.clothHi, 0.9, 0.28);
    line(ctx, a.chest.x + 13, a.chest.y - 7, a.pelvis.x - 12 * side, a.pelvis.y + 34, palette.clothHi, 0.7, 0.20);
    drawRogueBackGear(ctx, rig, palette, 0.72);
  }

  function drawRogueBackGear(ctx, rig, palette, alpha = 1) {
    const a = rig.anchors;
    const side = rig.dir.side || 1;
    ctx.save();
    ctx.globalAlpha *= alpha;
    // Compact hand crossbow/bolt case and crossed quick-draw dagger handles.
    roundRect(ctx, a.back.x - 5 * side, a.back.y - 4, 18, 5, 2, palette.boot, palette.outline, 0.8);
    line(ctx, a.back.x - 9 * side, a.back.y - 2, a.back.x + 11 * side, a.back.y - 2, palette.metalDark, 1.8, 0.85);
    line(ctx, a.back.x + 10 * side, a.back.y - 7, a.back.x + 15 * side, a.back.y + 4, palette.metal, 1.1, 0.82);
    for (let i = 0; i < 3; i++) {
      line(ctx, a.back.x - 16 + i * 4, a.back.y + 9, a.back.x - 15 + i * 4, a.back.y + 19, palette.metal, 0.8, 0.75);
      line(ctx, a.back.x - 17 + i * 4, a.back.y + 9, a.back.x - 13 + i * 4, a.back.y + 9, palette.accentDark, 0.8, 0.75);
    }
    line(ctx, a.back.x - 10, a.back.y + 12, a.back.x + 7, a.back.y + 27, palette.belt, 2.2, 0.8);
    line(ctx, a.back.x + 10, a.back.y + 12, a.back.x - 7, a.back.y + 27, palette.belt, 2.2, 0.8);
    ctx.restore();
  }

  function drawRogueTorsoDetails(ctx, rig, palette) {
    const a = rig.anchors;
    const side = rig.dir.side || 1;
    const topY = a.chest.y - 6;
    const beltY = a.belt.y + 4;
    // Quilted gambeson seams and asymmetric wrap closure.
    for (let i = -2; i <= 2; i++) {
      line(ctx, a.chest.x + i * 5, topY + 3, a.pelvis.x + i * 3, beltY + 8, i === 0 ? palette.clothHi : palette.clothDark, 0.7, i === 0 ? 0.36 : 0.28);
    }
    line(ctx, a.chest.x - 12, topY + 6, a.pelvis.x + 9, beltY + 10, palette.belt, 1.6, 0.82);
    line(ctx, a.chest.x + 11, topY + 8, a.pelvis.x - 8, beltY + 8, palette.accentDark, 1.2, 0.68);
    for (let i = 0; i < 4; i++) {
      roundRect(ctx, a.chest.x - 7 + i * 5, a.chest.y + 4 + (i % 2), 2.2, 2.2, 0.6, palette.metalDark, palette.outline, 0.25);
    }
    // Chest knives/bandolier.
    for (let i = 0; i < 3; i++) {
      const x = a.chest.x - 13 + i * 6;
      drawTinyKnife(ctx, x, a.chest.y + 2 + i * 2, -0.25 * side, 0.62, palette, 0.85);
    }
    // Re-stitched slash repair.
    line(ctx, a.chest.x + 8, a.chest.y + 11, a.chest.x + 17, a.chest.y + 16, palette.clothHi, 0.7, 0.34);
    for (let i = 0; i < 4; i++) line(ctx, a.chest.x + 9 + i * 2, a.chest.y + 10 + i, a.chest.x + 7 + i * 2, a.chest.y + 13 + i, palette.accent, 0.45, 0.46);
  }

  function drawRogueShoulderDetails(ctx, rig, palette, w, y) {
    const a = rig.anchors;
    const side = rig.dir.side || 1;
    const pauldronX = a.chest.x + w * 0.62 * side;
    // One compact asymmetric leather pauldron; opposite side stays cloth for stealth silhouette.
    for (let i = 0; i < 3; i++) {
      roundRect(ctx, pauldronX - 6 * side, y - 1 + i * 3, 12, 4, 2, i === 0 ? palette.bootHi : palette.boot, palette.outline, 0.7);
      line(ctx, pauldronX - 4 * side, y + 1 + i * 3, pauldronX + 4 * side, y + 1 + i * 3, palette.metalDark, 0.55, 0.55);
    }
    // Hood seam stitches along the mantle.
    for (let i = -2; i <= 2; i++) {
      line(ctx, a.chest.x + i * 5, y + 7, a.chest.x + i * 5 + 2 * side, y + 10, palette.clothHi, 0.55, 0.34);
    }
  }

  function drawRogueChestHarnessDetails(ctx, rig, palette) {
    const a = rig.anchors;
    // Buckles, hidden tool slots, garrote loop.
    for (let i = -1; i <= 1; i++) roundRect(ctx, a.chest.x + i * 8 - 2, a.chest.y + 7 + Math.abs(i), 4, 4, 1, palette.metal, palette.outline, 0.55);
    line(ctx, a.chest.x - 15, a.chest.y + 15, a.chest.x + 15, a.chest.y + 17, palette.belt, 1.2, 0.65);
    ctx.save();
    ctx.strokeStyle = palette.metalDark;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    ctx.arc(a.chest.x + 12, a.chest.y + 15, 3.4, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawRogueBeltGear(ctx, rig, palette) {
    const a = rig.anchors;
    const y = a.belt.y + 4;
    const side = rig.dir.side || 1;
    roundRect(ctx, a.pelvis.x - 4, y - 3, 8, 7, 1.8, palette.metalDark, palette.outline, 0.8);
    roundRect(ctx, a.pelvis.x + 18 * side, y + 4, 8, 10, 2, palette.boot, palette.outline, 0.8);
    roundRect(ctx, a.pelvis.x - 24 * side, y + 4, 9, 11, 2, palette.bootHi, palette.outline, 0.8);
    line(ctx, a.pelvis.x - 2 * side, y + 4, a.pelvis.x + 10 * side, y + 19, palette.clothHi, 1.0, 0.52);
    drawTinyKnife(ctx, a.pelvis.x - 21 * side, y + 10, 0.8 * side, 0.74, palette, 0.88);
    // Grapple and lockpick slivers.
    line(ctx, a.pelvis.x + 23 * side, y - 2, a.pelvis.x + 29 * side, y + 5, palette.metal, 0.9, 0.75);
    line(ctx, a.pelvis.x + 27 * side, y + 4, a.pelvis.x + 30 * side, y + 1, palette.metal, 0.8, 0.65);
    for (let i = 0; i < 3; i++) line(ctx, a.pelvis.x + 8 + i * 2, y + 7, a.pelvis.x + 8 + i * 2, y + 14, palette.metalHi || palette.metal, 0.55, 0.66);
  }

  function drawRogueHoodDetails(ctx, rig, palette) {
    const h = rig.anchors.head;
    const d = rig.dir;
    if (d.backVisible) return;
    // Mask, brow slit, scar, and reinforced hood brim.
    poly(ctx, [
      { x: h.x - h.rx * 0.72, y: h.y + 1 },
      { x: h.x + h.rx * 0.78, y: h.y + 1 },
      { x: h.x + h.rx * 0.48, y: h.y + 9 },
      { x: h.x - h.rx * 0.52, y: h.y + 8 }
    ], 'rgba(6,8,12,0.88)', palette.outline, 0.75);
    line(ctx, h.x - h.rx + 2, h.y - 12, h.x + h.rx - 2, h.y - 12, palette.clothHi, 1.0, 0.35);
    line(ctx, h.x - 6, h.y - 4, h.x - 2, h.y - 4, palette.glow, 0.8, 0.62);
    line(ctx, h.x + 2, h.y - 4, h.x + 6, h.y - 4, palette.glow, 0.8, 0.62);
    line(ctx, h.x - 9, h.y - 9, h.x - 4, h.y - 12, palette.skinShadow, 0.85, 0.58);
    for (let i = 0; i < 3; i++) line(ctx, h.x - 7 + i * 6, h.y + 3, h.x - 5 + i * 6, h.y + 7, palette.clothHi, 0.45, 0.28);
  }

  function drawRogueLegDetails(ctx, rig, palette) {
    const a = rig.anchors;
    const y = a.pelvis.y + 25;
    const side = rig.dir.side || 1;
    // Knee pads, boot wraps, boot dagger handles.
    roundRect(ctx, a.pelvis.x - 13, y - 1, 8, 6, 2, palette.boot, palette.outline, 0.7);
    roundRect(ctx, a.pelvis.x + 6, y - 2, 8, 6, 2, palette.bootHi, palette.outline, 0.7);
    line(ctx, a.pelvis.x - 16, y + 8, a.pelvis.x - 5, y + 10, palette.belt, 1.0, 0.62);
    line(ctx, a.pelvis.x + 4, y + 9, a.pelvis.x + 16, y + 8, palette.belt, 1.0, 0.62);
    drawTinyKnife(ctx, a.pelvis.x + 17 * side, y + 4, -0.2 * side, 0.50, palette, 0.76);
  }

  function drawWardenStone(ctx, x, y, scale, palette, alpha) {
    ctx.save();
    ctx.globalAlpha *= alpha == null ? 1 : alpha;
    const s = scale || 1;
    poly(ctx, [
      { x: x - 4.0 * s, y: y - 3.0 * s },
      { x: x + 3.8 * s, y: y - 2.2 * s },
      { x: x + 5.0 * s, y: y + 1.8 * s },
      { x: x + 1.2 * s, y: y + 4.4 * s },
      { x: x - 4.8 * s, y: y + 2.2 * s }
    ], palette.metal, palette.outline, 0.75 * s);
    line(ctx, x - 2.0 * s, y + 0.4 * s, x + 2.4 * s, y - 0.8 * s, palette.glow, 0.65 * s, 0.28);
    ctx.restore();
  }

  function drawWardenMossHang(ctx, x, y, width, palette, alpha) {
    ctx.save();
    ctx.globalAlpha *= alpha == null ? 1 : alpha;
    for (let i = 0; i < 8; i++) {
      const xx = x + i * (width / 7);
      const len = 5 + (i % 3) * 3;
      line(ctx, xx, y, xx - 1 + (i % 2) * 2, y + len, i % 2 ? palette.accent : palette.clothHi, 0.85, 0.58);
      ellipse(ctx, xx, y + len + 1, 1.3, 2.1, 0.2, palette.accentDark, null, 0.45);
    }
    ctx.restore();
  }

  function drawWardenVine(ctx, x1, y1, x2, y2, palette, alpha) {
    line(ctx, x1, y1, x2, y2, palette.outline, 3.3, alpha == null ? 0.9 : alpha);
    line(ctx, x1, y1, x2, y2, palette.accentDark, 1.8, alpha == null ? 0.78 : alpha * 0.85);
    const dx = x2 - x1, dy = y2 - y1;
    for (let i = 0.18; i < 1; i += 0.22) {
      const x = x1 + dx * i;
      const y = y1 + dy * i;
      const nx = -dy * 0.035, ny = dx * 0.035;
      line(ctx, x, y, x + nx, y + ny, palette.outline, 1.4, 0.75);
      line(ctx, x, y, x + nx * 0.72, y + ny * 0.72, palette.accent, 0.65, 0.7);
    }
  }

  function drawWardenTorsoDetails(ctx, rig, palette, topW, hemW, chestY) {
    const a = rig.anchors;
    // Interlocking bark breastplate with a knot-eye sternum plate.
    for (let i = -2; i <= 2; i++) {
      const x = a.chest.x + i * 7;
      const h = 16 - Math.abs(i) * 2;
      poly(ctx, [
        { x: x - 6, y: chestY + 2 + Math.abs(i) },
        { x: x + 5, y: chestY + 1 + Math.abs(i) },
        { x: x + 4, y: chestY + h },
        { x: x - 4, y: chestY + h + 2 }
      ], i === 0 ? palette.bootHi : palette.cloth, palette.outline, 0.95);
      line(ctx, x - 2, chestY + 4, x + 2, chestY + h - 2, palette.belt, 0.8, 0.42);
      line(ctx, x + 3, chestY + 5, x - 1, chestY + h - 1, palette.clothHi, 0.5, 0.25);
    }
    ellipse(ctx, a.chest.x, a.chest.y + 5, 5.8, 4.6, 0.2, palette.bootHi, palette.outline, 0.9);
    ellipse(ctx, a.chest.x, a.chest.y + 5, 2.6, 1.8, 0.1, palette.glow, palette.outline, 0.45);
    drawWardenVine(ctx, a.chest.x - topW + 2, a.chest.y + 8, a.pelvis.x + hemW - 4, a.pelvis.y + 19, palette, 0.66);
    drawWardenVine(ctx, a.chest.x + topW - 3, a.chest.y + 4, a.pelvis.x - hemW + 5, a.pelvis.y + 20, palette, 0.58);
    for (let i = -2; i <= 2; i++) drawWardenStone(ctx, a.chest.x + i * 8, a.chest.y + 16 + Math.abs(i) * 2, 0.42, palette, 0.72);
    drawWardenMossHang(ctx, a.chest.x - 16, a.pelvis.y + 14, 32, palette, 0.52);
  }

  function drawWardenShoulderDetails(ctx, rig, palette, w, y) {
    const a = rig.anchors;
    const side = rig.dir.side || 1;
    // Dominant burl pauldron, asymmetrical smaller scale pauldron, moss and briars.
    ellipse(ctx, a.chest.x - w * 0.72 + side, y + 1, 7.0, 3.4, -0.18, palette.belt, null, 0.38);
    ellipse(ctx, a.chest.x - w * 0.70 + side, y + 2, 3.8, 2.0, -0.18, palette.glow, null, 0.16);
    for (let i = 0; i < 5; i++) {
      line(ctx, a.chest.x - w * 0.90 + i * 4, y + 3 + (i % 2), a.chest.x - w * 0.82 + i * 4, y - 3 + (i % 2), palette.belt, 0.75, 0.44);
    }
    drawWardenVine(ctx, a.chest.x - w * 0.95, y + 7, a.chest.x - w * 0.35, y + 8, palette, 0.65);
    drawWardenVine(ctx, a.chest.x + w * 0.35, y + 7, a.chest.x + w * 0.85, y + 9, palette, 0.50);
    drawWardenMossHang(ctx, a.chest.x - w * 0.82, y + 6, 18, palette, 0.45);
    drawWardenStone(ctx, a.chest.x + w * 0.62, y + 4, 0.44, palette, 0.70);
  }

  function drawWardenChestDetails(ctx, rig, palette) {
    const a = rig.anchors;
    // Heart bramble with pulsing green core.
    drawWardenVine(ctx, a.chest.x - 12, a.chest.y - 2, a.chest.x + 11, a.chest.y + 12, palette, 0.74);
    drawWardenVine(ctx, a.chest.x + 13, a.chest.y - 2, a.chest.x - 10, a.chest.y + 12, palette, 0.68);
    ellipse(ctx, a.chest.x, a.chest.y + 6, 4.8, 4.0, 0, palette.glow, palette.outline, 0.78);
    for (let i = 0; i < 6; i++) {
      const a0 = i * TAU / 6;
      ellipse(ctx, a.chest.x + Math.cos(a0) * 8, a.chest.y + 8 + Math.sin(a0) * 4, 1.5, 2.2, a0, palette.accent, palette.outline, 0.32);
    }
  }

  function drawWardenBeltGear(ctx, rig, palette) {
    const a = rig.anchors;
    const y = a.belt.y + 4;
    line(ctx, a.pelvis.x - 21, y, a.pelvis.x + 21, y + 1, palette.outline, 5.0, 0.98);
    line(ctx, a.pelvis.x - 20, y, a.pelvis.x + 20, y + 1, palette.belt, 2.6, 0.92);
    drawDiamond(ctx, a.pelvis.x, y, 4.6, palette.metal, palette.outline);
    line(ctx, a.pelvis.x - 2, y, a.pelvis.x + 2, y, palette.glow, 0.8, 0.5);
    // root curtain, seed pouch, gourd, animal-bone ward.
    for (let i = -3; i <= 3; i++) line(ctx, a.pelvis.x + i * 5, y + 3, a.pelvis.x + i * 5 + Math.sin(i) * 2, y + 19 + Math.abs(i), i % 2 ? palette.accentDark : palette.belt, 1.1, 0.58);
    roundRect(ctx, a.pelvis.x + 16, y + 5, 8, 9, 2, palette.bootHi, palette.outline, 0.75);
    ellipse(ctx, a.pelvis.x - 17, y + 10, 4.2, 5.6, 0, palette.clothHi, palette.outline, 0.7);
    for (let i = 0; i < 3; i++) drawBone(ctx, a.pelvis.x - 4 + i * 4, y + 14 + (i % 2), 0.34, palette);
  }

  function drawWardenHeadDetails(ctx, rig, palette) {
    const h = rig.anchors.head;
    const d = rig.dir;
    // Living bark mask, crown grain, moss ruff, visible lower jaw.
    poly(ctx, [
      { x: h.x - h.rx - 2, y: h.y - 8 },
      { x: h.x - h.rx + 2, y: h.y - 18 },
      { x: h.x - 5, y: h.y - 23 },
      { x: h.x, y: h.y - 29 },
      { x: h.x + 6, y: h.y - 23 },
      { x: h.x + h.rx - 1, y: h.y - 17 },
      { x: h.x + h.rx + 2, y: h.y - 8 },
      { x: h.x + 5 * (d.side || 0), y: h.y + 8 },
      { x: h.x - h.rx * 0.78, y: h.y + 6 }
    ], palette.bootHi, palette.outline, 1.8);
    line(ctx, h.x - 9, h.y - 12, h.x - 3, h.y + 4, palette.belt, 0.9, 0.52);
    line(ctx, h.x + 8, h.y - 12, h.x + 1, h.y + 5, palette.clothHi, 0.55, 0.35);
    line(ctx, h.x - 5, h.y - 4, h.x - 1, h.y - 4, palette.glow, 1.2, 0.72);
    line(ctx, h.x + 2, h.y - 4, h.x + 6, h.y - 4, palette.glow, 1.2, 0.72);
    ellipse(ctx, h.x, h.y + 9, h.rx * 0.55, 4.2, 0, palette.skinShadow, palette.outline, 0.65);
    drawWardenMossHang(ctx, h.x - h.rx, h.y + 8, h.rx * 2, palette, 0.56);
    drawWardenStone(ctx, h.x + h.rx - 2, h.y - 12, 0.32, palette, 0.66);
  }

  function drawWardenBackHeadDetails(ctx, rig, palette) {
    const h = rig.anchors.head;
    line(ctx, h.x - h.rx + 2, h.y - 10, h.x + h.rx - 2, h.y - 11, palette.belt, 1.0, 0.46);
    drawWardenMossHang(ctx, h.x - h.rx, h.y + 5, h.rx * 2, palette, 0.44);
    for (let i = -1; i <= 1; i++) drawWardenStone(ctx, h.x + i * 6, h.y - 15 + Math.abs(i) * 2, 0.30, palette, 0.54);
  }

  function drawWardenLegDetails(ctx, rig, palette) {
    const a = rig.anchors;
    const y = a.pelvis.y + 24;
    for (let side of [-1, 1]) {
      const x = a.pelvis.x + side * 10;
      roundRect(ctx, x - 4, y - 3, 8, 9, 2.5, palette.bootHi, palette.outline, 0.76);
      drawWardenStone(ctx, x, y + 1, 0.28, palette, 0.55);
      line(ctx, x - 4, y + 8, x + 4, y + 18, palette.belt, 1.4, 0.54);
      line(ctx, x + 4, y + 8, x - 4, y + 18, palette.accentDark, 1.0, 0.50);
      ellipse(ctx, x, y + 21, 6, 2.2, 0, palette.accentDark, null, 0.25);
    }
  }

  function drawWardenHammer(ctx, x, y, rot, scale, palette, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    const s = scale || 1;
    line(ctx, 0, 15 * s, 0, -23 * s, palette.outline, 5.8 * s, 1);
    line(ctx, 0, 14 * s, 0, -22 * s, palette.belt, 2.8 * s, 1);
    roundRect(ctx, -10 * s, -27 * s, 20 * s, 10 * s, 2 * s, palette.metalDark, palette.outline, 1.1 * s);
    poly(ctx, [
      { x: -7 * s, y: -28 * s }, { x: -2 * s, y: -34 * s }, { x: 3 * s, y: -28 * s }
    ], palette.metal, palette.outline, 0.8 * s);
    drawDiamond(ctx, 0, -22 * s, 3.8 * s, palette.glow, palette.outline);
    drawWardenVine(ctx, -4 * s, -15 * s, 4 * s, 7 * s, palette, 0.66);
    ctx.restore();
  }

  function drawLivingWoodShield(ctx, x, y, scale, palette, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    const s = scale || 1;
    poly(ctx, [
      { x: x - 12 * s, y: y - 14 * s },
      { x: x + 12 * s, y: y - 13 * s },
      { x: x + 10 * s, y: y + 7 * s },
      { x, y: y + 17 * s },
      { x: x - 10 * s, y: y + 7 * s }
    ], palette.bootHi, palette.outline, 1.6 * s);
    ellipse(ctx, x, y - 1 * s, 8.0 * s, 10.5 * s, 0, palette.cloth, palette.outline, 0.8 * s);
    ellipse(ctx, x, y - 1 * s, 3.4 * s, 3.0 * s, 0, palette.glow, palette.outline, 0.45 * s);
    for (let i = -2; i <= 2; i++) line(ctx, x + i * 3.4 * s, y - 10 * s, x + i * 1.2 * s, y + 11 * s, palette.belt, 0.7 * s, 0.40);
    drawWardenMossHang(ctx, x - 8 * s, y + 6 * s, 16 * s, palette, 0.40);
    ctx.restore();
  }

  function drawRangerTorsoDetails(ctx, rig, palette, topW, hemW, chestY) {
    const a = rig.anchors;
    const side = rig.dir.side || 1;
    poly(ctx, [
      { x: a.chest.x - topW * 0.34, y: chestY + 2 },
      { x: a.chest.x + topW * 0.28, y: chestY + 1 },
      { x: a.pelvis.x + hemW * 0.26, y: a.pelvis.y + 9 },
      { x: a.pelvis.x - hemW * 0.18, y: a.pelvis.y + 12 }
    ], palette.clothHi, palette.outline, 0.95);
    poly(ctx, [
      { x: a.chest.x - topW * 0.26, y: chestY + 4 },
      { x: a.chest.x + topW * 0.22, y: chestY + 3 },
      { x: a.pelvis.x + hemW * 0.18, y: a.pelvis.y + 5 },
      { x: a.pelvis.x - hemW * 0.15, y: a.pelvis.y + 7 }
    ], palette.bootHi, palette.outline, 0.85);
    // jerkin edge tooling and asym stitching
    line(ctx, a.chest.x - topW + 4, chestY + 3, a.chest.x - topW + 10, chestY + 18, palette.clothHi, 0.8, 0.45);
    for (let i = 0; i < 6; i++) line(ctx, a.chest.x + 4 + i * 2, a.chest.y - 1 + i * 3, a.chest.x + 6 + i * 2, a.chest.y + 1 + i * 3, palette.clothHi, 0.45, 0.32);
    // quiver strap and quick-release buckle
    line(ctx, a.chest.x + 11 * side, chestY - 1, a.pelvis.x - 7 * side, a.pelvis.y + 15, palette.boot, 2.0, 0.72);
    roundRect(ctx, a.chest.x + 3 * side - 2, a.chest.y + 7, 4, 4, 1, palette.metal, palette.outline, 0.55);
  }

  function drawRangerShoulderDetails(ctx, rig, palette, w, y) {
    const a = rig.anchors;
    const side = rig.dir.side || 1;
    // layered leather spaulders that still read mobile, plus hood folds and a clasp.
    for (let sgn of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        roundRect(ctx, a.chest.x + sgn * (w * 0.52) - 5, y + 2 + i * 3, 10, 4, 2, i === 0 ? palette.bootHi : palette.boot, palette.outline, 0.7);
      }
    }
    line(ctx, a.chest.x - 9, y + 8, a.chest.x + 9, y + 8, palette.clothHi, 0.9, 0.28);
    drawDiamond(ctx, a.neck.x + 1, a.neck.y + 2, 2.4, palette.metal, palette.outline);
    // oak leaf / feather token pinned near the right side of the hood.
    ellipse(ctx, a.neck.x + 12 * side, a.neck.y - 9, 2.2, 5.2, 0.35 * side, palette.accent, palette.outline, 0.55);
    line(ctx, a.neck.x + 12 * side, a.neck.y - 13, a.neck.x + 12 * side, a.neck.y - 5, palette.clothHi, 0.55, 0.42);
  }

  function drawRangerChestDetails(ctx, rig, palette) {
    const a = rig.anchors;
    // embossed leaf / antler motif on sternum and harness hardware.
    drawDiamond(ctx, a.chest.x, a.chest.y + 8, 3.6, palette.metal, palette.outline);
    line(ctx, a.chest.x, a.chest.y + 4, a.chest.x, a.chest.y + 13, palette.accent, 0.9, 0.55);
    line(ctx, a.chest.x - 5, a.chest.y + 9, a.chest.x + 5, a.chest.y + 9, palette.accentDark, 0.8, 0.52);
    line(ctx, a.chest.x - 5, a.chest.y + 11, a.chest.x - 1, a.chest.y + 7, palette.accent, 0.6, 0.46);
    line(ctx, a.chest.x + 5, a.chest.y + 11, a.chest.x + 1, a.chest.y + 7, palette.accent, 0.6, 0.46);
    roundRect(ctx, a.chest.x - 13, a.chest.y + 2, 4, 4, 1, palette.metalDark, palette.outline, 0.45);
    roundRect(ctx, a.chest.x + 9, a.chest.y + 16, 4, 4, 1, palette.metalDark, palette.outline, 0.45);
  }

  function drawRangerBeltGear(ctx, rig, palette) {
    const a = rig.anchors;
    const y = a.belt.y + 6;
    const side = rig.dir.side || 1;
    roundRect(ctx, a.pelvis.x - 4, y - 4, 8, 7, 1.8, palette.metalDark, palette.outline, 0.75);
    // satchel and pouch
    roundRect(ctx, a.pelvis.x + 16 * side, y + 3, 10, 11, 2, palette.boot, palette.outline, 0.82);
    roundRect(ctx, a.pelvis.x - 23 * side, y + 2, 9, 9, 2, palette.bootHi, palette.outline, 0.8);
    // water flask and rope coil
    ellipse(ctx, a.pelvis.x - 15 * side, y + 16, 4.2, 5.8, 0, palette.bootHi, palette.outline, 0.7);
    line(ctx, a.pelvis.x - 15 * side, y + 12, a.pelvis.x - 15 * side, y + 20, palette.clothHi, 0.45, 0.45);
    ctx.save();
    ctx.strokeStyle = palette.belt;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.62;
    ctx.beginPath();
    ctx.arc(a.pelvis.x + 22 * side, y + 15, 4.5, 0, TAU);
    ctx.stroke();
    ctx.restore();
    // bedroll hinted behind the hips
    line(ctx, a.pelvis.x - 11, y + 18, a.pelvis.x + 12, y + 18, palette.clothDark, 3.0, 0.32);
    line(ctx, a.pelvis.x - 4, y + 15, a.pelvis.x - 4, y + 21, palette.belt, 0.8, 0.42);
    line(ctx, a.pelvis.x + 5, y + 15, a.pelvis.x + 5, y + 21, palette.belt, 0.8, 0.42);
  }

  function drawRangerHeadDetails(ctx, rig, palette) {
    const h = rig.anchors.head;
    const side = rig.dir.side || 1;
    // headband already exists from bareWarrior; add feather token, beard/stubble, and scars.
    ellipse(ctx, h.x + h.rx - 2, h.y - 13, 2.2, 5.0, 0.25, palette.accent, palette.outline, 0.55);
    line(ctx, h.x + h.rx - 2, h.y - 16, h.x + h.rx - 2, h.y - 9, palette.clothHi, 0.45, 0.45);
    line(ctx, h.x - 6, h.y + 8, h.x + 6, h.y + 8, palette.skinShadow, 1.2, 0.55);
    line(ctx, h.x - 8, h.y - 2, h.x - 4, h.y - 6, palette.skinShadow, 0.85, 0.52);
    line(ctx, h.x + 2, h.y - 10, h.x + 7, h.y - 11, palette.skinShadow, 0.75, 0.48);
    line(ctx, h.x - 5, h.y - 4, h.x - 1, h.y - 4, palette.glow, 0.7, 0.22);
    line(ctx, h.x + 2, h.y - 4, h.x + 6, h.y - 4, palette.glow, 0.7, 0.22);
  }

  function drawRangerLegDetails(ctx, rig, palette) {
    const a = rig.anchors;
    const y = a.pelvis.y + 24;
    roundRect(ctx, a.pelvis.x - 13, y - 1, 8, 6, 2, palette.boot, palette.outline, 0.65);
    roundRect(ctx, a.pelvis.x + 5, y - 2, 8, 6, 2, palette.bootHi, palette.outline, 0.65);
    line(ctx, a.pelvis.x - 15, y + 9, a.pelvis.x - 5, y + 11, palette.belt, 0.95, 0.55);
    line(ctx, a.pelvis.x + 4, y + 10, a.pelvis.x + 15, y + 9, palette.belt, 0.95, 0.55);
    // folded boot cuffs
    line(ctx, a.pelvis.x - 13, y + 18, a.pelvis.x - 4, y + 18, palette.clothHi, 0.65, 0.34);
    line(ctx, a.pelvis.x + 4, y + 19, a.pelvis.x + 15, y + 19, palette.clothHi, 0.65, 0.34);
  }

  function drawTinyKnife(ctx, x, y, rot, scale, palette, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.globalAlpha *= alpha == null ? 1 : alpha;
    line(ctx, 0, 4 * scale, 0, -7 * scale, palette.outline, 2.2 * scale, 1);
    line(ctx, 0, 3.4 * scale, 0, -6.4 * scale, palette.metalHi || palette.metal, 1.0 * scale, 1);
    line(ctx, -2.5 * scale, 1.4 * scale, 2.5 * scale, 1.4 * scale, palette.metalDark, 1.0 * scale, 1);
    roundRect(ctx, -1.1 * scale, 2.2 * scale, 2.2 * scale, 4 * scale, 0.7 * scale, palette.belt, palette.outline, 0.35 * scale);
    ctx.restore();
  }

  function drawClassEffects(ctx, rig, palette, profile) {
    const a = rig.anchors;
    const p = rig.pose;

    drawAnimationIdentity(ctx, rig, palette, profile);
    drawCombatReadabilityLayer(ctx, rig, palette, profile);

    if (p.action === 'fishing') {
      drawClassFishingRig(ctx, rig, palette, profile);
      return;
    }

    if (p.action === 'gathering') {
      drawHarvestingReadability(ctx, rig, palette, profile);
      return;
    }

    if (p.action === 'cast') {
      if (profile.id === 'fighter') {
        drawSlash(ctx, a.mainHand.x, a.mainHand.y - 10, palette.glow, 0.6 + p.castPulse * 0.2);
      } else if (profile.id === 'rogue') {
        drawSlash(ctx, a.mainHand.x, a.mainHand.y - 2, palette.glow, 0.8 + p.castPulse * 0.2);
        drawSlash(ctx, a.offHand.x, a.offHand.y - 2, palette.accent, 0.55);
      } else if (profile.id === 'assassin') {
        drawAssassinExecutionAura(ctx, rig, palette, p.castPulse || 0.55);
      } else if (profile.id === 'wizard') {
        drawWizardArcaneCast(ctx, rig, palette, p.castPulse || 0.55);
      } else if (profile.id === 'cleric') {
        drawHolySpark(ctx, a.chest.x, a.chest.y - 3, palette, p.castPulse);
        drawHalo(ctx, a.head.x, a.head.y - 20, 1 + p.castPulse * 0.12, palette.glow);
      } else if (profile.id === 'summoner') {
        drawRuneCircle(ctx, a.chest.x, a.chest.y + 2, 24 + p.castPulse * 8, palette, 0.42);
        drawOrbitSpark(ctx, a.chest.x, a.chest.y + 2, palette, p.t);
      } else if (profile.id === 'enchanter') {
        drawMindWave(ctx, a.head.x, a.head.y - 7, palette, p.t, p.castPulse);
        drawCharmOrbit(ctx, a.chest.x, a.chest.y + 3, palette, p.t, 0.72 + p.castPulse * 0.28);
      } else if (profile.id === 'necromancer') {
        drawDarkMotes(ctx, a.chest.x, a.chest.y + 4, palette, p.t, p.castPulse);
        drawRuneCircle(ctx, a.chest.x, a.chest.y + 7, 22 + p.castPulse * 7, palette, 0.25);
      }
    }

    if (p.action === 'attack') {
      if (profile.id === 'fighter') drawSlash(ctx, a.mainHand.x, a.mainHand.y - 10, '#ffe0a3', 0.86);
      if (profile.id === 'rogue') {
        drawSlash(ctx, a.mainHand.x, a.mainHand.y - 4, palette.glow, 0.92);
        drawSlash(ctx, a.offHand.x, a.offHand.y - 2, palette.metal, 0.72);
      }
      if (profile.id === 'wizard') drawWizardArcaneCast(ctx, rig, palette, 0.34 + (p.attackCurve || 0) * 0.34);
      if (profile.id === 'enchanter') drawMindWave(ctx, a.head.x, a.head.y - 6, palette, p.t + p.attackCurve, p.attackCurve || 0.35);
    }

    if (p.action === 'meditate') {
      drawMeditationAura(ctx, 0, 0, palette, profile, p.t, p.meditatePulse);
    }

    if (p.hitFlash > 0) {
      drawHitFlash(ctx, a.chest.x, a.chest.y, palette, profile, p.hitFlash);
    }

    if (p.action === 'death') {
      ctx.save();
      ctx.globalAlpha = 0.42 * (1 - p.deathProgress);
      drawDarkMotes(ctx, a.chest.x, a.chest.y + 12, palette, p.t, 0.8);
      ctx.restore();
    }
  }

  function drawHarvestingReadability(ctx, rig, palette, profile) {
    const a = rig.anchors;
    const p = rig.pose;
    const side = p.direction?.side || 1;
    const ground = a.ground || { x: 0, y: 0 };
    const progress = Math.max(0, Math.min(1, Number(p.gatherProgress || 0)));
    const pulse = 0.5 + Math.sin((p.t || 0) * 8.5) * 0.5;
    const kind = String((rig.actor?.gatheringKind || rig.source?.gatheringKind || '')).toLowerCase();
    const harvestColor = kind === 'mining' ? '#d7b46c' : kind === 'fishing' ? '#70d8e6' : '#a6f08d';

    if (kind === 'mining') {
      drawMiningPickaxeReadability(ctx, rig, palette, profile);
      return;
    }

    const completeHold = Math.max(0, Math.min(1, Number(p.gatherCompleteHold || 0)));
    const cutImpact = Math.max(0, Math.min(1, Number(p.gatherCutImpact || 0)));
    const cutPhase = Math.max(0, Math.min(1, Number(p.gatherCutPhase || 0)));
    const cutX = ground.x + side * (11 + progress * 5 + cutPhase * 2);
    const cutY = ground.y + 3;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.18 + pulse * 0.12;
    ellipse(ctx, ground.x + side * 5, ground.y + 3, 15 + progress * 7, 4 + progress * 1.2, 0, harvestColor, null, 0);

    // V0.14.50: visible pick/cut/pluck motion synchronized to the progress bar loop.
    ctx.globalAlpha = 0.58 + cutImpact * 0.28;
    line(ctx, a.mainHand.x - side * 1.5, a.mainHand.y - 1, cutX + side * (2 + cutImpact * 3), cutY - 2, palette.metalHi || '#f1f0db', 2.2, 0.78);
    line(ctx, a.mainHand.x - side * 1.5, a.mainHand.y - 1, cutX + side * (2 + cutImpact * 3), cutY - 2, palette.outline, 0.7, 0.42);
    if (cutImpact > 0.02) {
      ctx.globalAlpha = 0.45 + cutImpact * 0.35;
      line(ctx, cutX - side * 5, cutY - 4, cutX + side * 7, cutY + 1, '#fff7b8', 1.2 + cutImpact, 0.76);
    }

    ctx.globalAlpha = 0.62;
    for (let i = 0; i < 4; i++) {
      const ox = ground.x - 10 + i * 7 + Math.sin((p.t || 0) * 4 + i) * 1.1;
      const oy = ground.y - 3 - i % 2 * 2 - cutImpact * (i % 2 ? 1.3 : 0.4);
      drawDiamond(ctx, ox, oy, 1.25 + progress * 0.45, harvestColor, palette.outline);
    }

    if (completeHold > 0 || progress > 0.88) {
      const hand = a.mainHand || { x: side * 14, y: -8 };
      const lift = Math.max(completeHold, Math.max(0, progress - 0.88) / 0.12);
      ctx.globalAlpha = 0.72 + lift * 0.22;
      line(ctx, hand.x - side * 1.5, hand.y + 2, hand.x + side * 1.5, hand.y - 8 - lift * 3, '#5c9a45', 1.6, 0.86);
      drawDiamond(ctx, hand.x + side * 3, hand.y - 8 - lift * 3, 2.5, harvestColor, palette.outline);
      drawDiamond(ctx, hand.x - side * 2, hand.y - 5 - lift * 2, 1.8, '#d7f8a8', palette.outline);
    }
    ctx.restore();
  }

  function drawMiningPickaxeReadability(ctx, rig, palette, profile) {
    const a = rig.anchors;
    const p = rig.pose;
    const side = p.direction?.side || 1;
    const ground = a.ground || { x: 0, y: 0 };
    const t = p.t || 0;
    const cycle = (t * 1.85) % 1;
    const impact = cycle > 0.54 && cycle < 0.72 ? Math.sin(((cycle - 0.54) / 0.18) * Math.PI) : 0;
    const sparkAlpha = 0.16 + impact * 0.72;
    const headX = ground.x + side * (22 + impact * 4);
    const headY = ground.y - 9 + impact * 2;
    const handA = a.mainHand || { x: side * 18, y: -8 };
    const handB = a.offHand || { x: -side * 12, y: 10 };
    const shaftTopX = handA.x + side * 3;
    const shaftTopY = handA.y - 20 + Math.sin(cycle * Math.PI * 2) * 2;
    const shaftBotX = handB.x - side * 3;
    const shaftBotY = handB.y + 18;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Pickaxe wooden shaft locked between both hands.
    line(ctx, shaftTopX + 1.6, shaftTopY + 1.8, shaftBotX + 1.6, shaftBotY + 1.8, 'rgba(0,0,0,0.55)', 4.4, 0.72);
    line(ctx, shaftTopX, shaftTopY, shaftBotX, shaftBotY, '#7a5637', 3.2, 1);
    line(ctx, shaftTopX - side * 0.8, shaftTopY, shaftBotX - side * 0.8, shaftBotY, '#bd8a55', 1.05, 0.78);

    // Curved metal head at the impact side.
    ctx.strokeStyle = '#d8d2bd';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(shaftTopX - side * 13, shaftTopY + 4);
    ctx.quadraticCurveTo(shaftTopX, shaftTopY - 6, shaftTopX + side * 14, shaftTopY + 4);
    ctx.stroke();
    ctx.strokeStyle = '#6d7270';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(shaftTopX - side * 15, shaftTopY + 5.5);
    ctx.quadraticCurveTo(shaftTopX, shaftTopY - 8, shaftTopX + side * 16, shaftTopY + 5.5);
    ctx.stroke();

    // Ore-contact target is an impact flash, not a target ring.
    if (impact > 0.05) {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = sparkAlpha;
      for (let i = 0; i < 7; i++) {
        const a0 = -Math.PI * 0.65 + i * Math.PI / 6;
        const r0 = 2 + (i % 2);
        const r1 = 8 + (i % 3) * 2;
        line(ctx, headX + Math.cos(a0) * r0, headY + Math.sin(a0) * r0, headX + Math.cos(a0) * r1, headY + Math.sin(a0) * r1, i % 2 ? '#fff2b2' : '#ffba4d', 1.15, sparkAlpha);
      }
      ctx.globalAlpha = 0.25 + impact * 0.28;
      ellipse(ctx, headX, headY + 3, 11 + impact * 5, 2.6, 0, '#ffcb63', null, 0);
    }
    ctx.restore();
  }

  function drawCombatReadabilityLayer(ctx, rig, palette, profile) {
    const a = rig.anchors;
    const p = rig.pose;
    const side = p.direction?.side || 1;
    const ground = a.ground || { x: 0, y: 0 };
    const attack = p.attackCurve || 0;
    const cast = p.action === 'cast' ? (p.castPulse || 0) : 0;

    if (p.action === 'attack') {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const alpha = 0.18 + attack * 0.42;
      if (profile.id === 'fighter') {
        ctx.globalAlpha = alpha;
        ellipse(ctx, ground.x + side * 8, ground.y + 1, 20 + attack * 8, 5 + attack * 2, 0, '#d8c190', null, 0);
        drawCommitArc(ctx, a.mainHand.x + side * 7, a.mainHand.y - 16, side, 24 + attack * 10, '#ffe2a8', alpha + 0.10);
        drawImpactTicks(ctx, a.mainHand.x + side * 16, a.mainHand.y - 24, '#fff1c2', alpha);
      } else if (profile.id === 'rogue') {
        ctx.globalAlpha = alpha;
        drawCommitArc(ctx, a.mainHand.x + side * 3, a.mainHand.y - 6, side, 18 + attack * 6, palette.glow, alpha + 0.16);
        drawCommitArc(ctx, a.offHand.x - side * 2, a.offHand.y - 4, -side, 14 + attack * 4, palette.metal, alpha);
        line(ctx, a.chest.x - side * 12, a.chest.y + 18, a.chest.x - side * 28, a.chest.y + 19, palette.glow, 1.1, 0.25 + attack * 0.2);
      } else if (profile.id === 'cleric') {
        ctx.globalAlpha = alpha * 0.80;
        ellipse(ctx, ground.x, ground.y + 2, 18 + attack * 5, 5, 0, palette.glow, null, 0);
        drawImpactTicks(ctx, a.mainHand.x + side * 8, a.mainHand.y - 17, palette.glow, alpha);
      } else if (profile.id === 'shaman') {
        ctx.globalAlpha = 0.20 + attack * 0.24;
        drawStormGroundRing(ctx, ground.x, ground.y + 2, palette, p.t + attack, 0.14 + attack * 0.14);
        drawShamanLightningArc(ctx, a.mainHand.x + side * 5, a.mainHand.y - 16, a.offHand.x, a.offHand.y - 10, palette.glow, 0.42 + attack * 0.22);
      } else if (profile.id === 'summoner') {
        drawRuneCircle(ctx, a.chest.x, a.chest.y + 6, 18 + attack * 7, palette, 0.18 + attack * 0.18);
        drawOrbitSpark(ctx, a.chest.x, a.chest.y + 4, palette, p.t + attack);
      } else if (profile.id === 'enchanter') {
        ctx.globalAlpha = 0.18 + attack * 0.24;
        drawMindWave(ctx, a.head.x + side * 2, a.head.y - 7, palette, p.t + attack, 0.42 + attack * 0.42);
        drawCommitArc(ctx, a.mainHand.x + side * 3, a.mainHand.y - 13, side, 17 + attack * 5, palette.glow, 0.24 + attack * 0.20);
      } else if (profile.id === 'necromancer') {
        ctx.globalAlpha = 0.20 + attack * 0.24;
        drawDarkMotes(ctx, a.chest.x + side * 5, a.chest.y + 9, palette, p.t + attack, 0.7);
        drawCommitArc(ctx, a.mainHand.x + side * 4, a.mainHand.y - 14, side, 19 + attack * 6, palette.glow, 0.30 + attack * 0.22);
      }
      ctx.restore();
    }

    if (cast > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      if (profile.id === 'fighter') {
        ctx.globalAlpha = 0.12 + cast * 0.16;
        ellipse(ctx, a.offHand.x - side * 7, a.offHand.y - 7, 11 + cast * 3, 13 + cast * 3, 0, palette.glow, null, 0);
      } else if (profile.id === 'rogue') {
        ctx.globalAlpha = 0.16 + cast * 0.18;
        line(ctx, a.mainHand.x - side * 4, a.mainHand.y - 12, a.mainHand.x + side * 13, a.mainHand.y - 19, palette.glow, 1.2, 0.35 + cast * 0.2);
      } else if (profile.id === 'cleric') {
        ctx.globalAlpha = 0.18 + cast * 0.25;
        ellipse(ctx, ground.x, ground.y + 2, 32 + cast * 8, 10 + cast * 2, 0, palette.glow, null, 0);
        drawImpactTicks(ctx, a.head.x, a.head.y - 22, palette.glow, 0.28 + cast * 0.22);
      } else if (profile.id === 'shaman') {
        ctx.globalAlpha = 0.24 + cast * 0.24;
        drawStormGroundRing(ctx, ground.x, ground.y + 2, palette, p.t, 0.24 + cast * 0.18);
        drawShamanLightningArc(ctx, a.mainHand.x + side * 2, a.mainHand.y - 20, a.head.x + side * 4, a.head.y - 24, palette.glow, 0.52 + cast * 0.24);
        drawImpactTicks(ctx, a.offHand.x, a.offHand.y - 10, palette.glow, 0.24 + cast * 0.18);
      } else if (profile.id === 'summoner') {
        ctx.globalAlpha = 0.25 + cast * 0.24;
        drawRuneCircle(ctx, ground.x, ground.y + 1, 30 + cast * 10, palette, 0.24 + cast * 0.20);
      } else if (profile.id === 'enchanter') {
        ctx.globalAlpha = 0.20 + cast * 0.24;
        drawCharmOrbit(ctx, ground.x, ground.y, palette, p.t, 0.50 + cast * 0.32);
        drawMindWave(ctx, a.head.x, a.head.y - 7, palette, p.t, cast);
      } else if (profile.id === 'necromancer') {
        ctx.globalAlpha = 0.18 + cast * 0.22;
        ellipse(ctx, ground.x, ground.y + 2, 30 + cast * 8, 9 + cast * 2, 0, 'rgba(120,255,95,0.20)', null, 0);
      }
      ctx.restore();
    }

    if (p.hitFlash > 0) {
      drawImpactTicks(ctx, a.chest.x, a.chest.y + 2, profile.id === 'necromancer' ? palette.glow : '#ffffff', Math.min(0.7, p.hitFlash));
    }

    if (p.action === 'death') {
      ctx.save();
      ctx.globalAlpha = 0.18 + (1 - p.deathProgress) * 0.16;
      ellipse(ctx, ground.x, ground.y + 3, 28 + p.deathProgress * 10, 6 + p.deathProgress * 2, 0, profile.id === 'necromancer' ? palette.glow : palette.clothDark, null, 0);
      ctx.restore();
    }
  }

  function drawCommitArc(ctx, x, y, side, radius, color, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = alpha == null ? 0.45 : alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y, radius, side > 0 ? -1.12 : Math.PI + 1.12, side > 0 ? 0.34 : Math.PI - 0.34, side < 0);
    ctx.stroke();
    ctx.lineWidth = 1.1;
    ctx.globalAlpha *= 0.62;
    ctx.beginPath();
    ctx.arc(x, y, radius + 5, side > 0 ? -0.92 : Math.PI + 0.92, side > 0 ? 0.18 : Math.PI - 0.18, side < 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawImpactTicks(ctx, x, y, color, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = alpha == null ? 0.45 : alpha;
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6;
      const r0 = 5 + (i % 2) * 2;
      const r1 = 12 + (i % 3) * 2;
      line(ctx, x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1, color, 1.3, ctx.globalAlpha);
    }
    ctx.restore();
  }

  function drawAnimationIdentity(ctx, rig, palette, profile) {
    const a = rig.anchors;
    const p = rig.pose;
    const pulse = p.identityPulse || 0.5;
    const ground = a.ground || { x: 0, y: 0 };

    if (profile.id === 'fighter') {
      if (p.moving || p.action === 'attack') {
        ctx.save();
        ctx.globalAlpha = 0.20 + (p.groundPulse || 0) * 0.18;
        ellipse(ctx, ground.x + (p.direction?.side || 1) * 5, ground.y + 1, 14 + (p.groundPulse || 0) * 4, 3.8, 0, '#d8c190', null, 0);
        ctx.restore();
      }
      if (p.action === 'idle') {
        line(ctx, a.offHand.x - (p.direction?.side || 1) * 6, a.offHand.y - 15, a.offHand.x - (p.direction?.side || 1) * 6, a.offHand.y + 5, palette.accent, 1.2, p.shieldBrace || 0.35);
      }
      return;
    }

    if (profile.id === 'rogue') {
      if (p.afterimageAlpha > 0 && !rig.dir.backVisible) {
        ctx.save();
        ctx.globalAlpha = p.afterimageAlpha;
        ctx.translate(-(p.direction?.side || 1) * 5, 1);
        drawSlash(ctx, a.mainHand.x, a.mainHand.y - 4, palette.glow, 0.55);
        ctx.restore();
      }
      if (p.action === 'idle') {
        line(ctx, a.chest.x - 9, a.chest.y + 12, a.chest.x + 9, a.chest.y + 13, palette.accentDark, 1.1, 0.45 + pulse * 0.18);
      }
      return;
    }

    if (profile.id === 'cleric') {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.10 + (p.blessingPulse || 0) * 0.16;
      ellipse(ctx, a.chest.x, a.chest.y - 2, 18 + pulse * 3, 9 + pulse * 2, 0, palette.glow, null, 0);
      ctx.restore();
      if (p.action === 'idle') drawHalo(ctx, a.head.x, a.head.y - 20, 0.72 + pulse * 0.04, 'rgba(255,242,168,0.52)');
      return;
    }

    if (profile.id === 'shaman') {
      drawShamanSpiritOrbit(ctx, a.chest.x, a.chest.y + 2, palette, p.t, 0.34 + pulse * 0.12);
      if (p.action === 'idle') drawStormGroundRing(ctx, ground.x, ground.y + 2, palette, p.t, 0.12 + pulse * 0.08);
      return;
    }

    if (profile.id === 'summoner') {
      if (!rig.dir.backVisible) {
        drawRuneCircle(ctx, a.chest.x, a.chest.y + 4, 16 + (p.ritualOrbit || 0) * 5, palette, 0.10 + (p.ritualOrbit || 0) * 0.12);
        const r = 18 + Math.sin((p.t || 0) * 2.3) * 2;
        const ox = a.chest.x + Math.cos((p.t || 0) * 2.0) * r;
        const oy = a.chest.y + 1 + Math.sin((p.t || 0) * 2.0) * 5;
        drawFloatingCrystal(ctx, ox, oy, 0.36 + (p.ritualOrbit || 0) * 0.08, palette.glow, palette.outline, p.t);
      }
      return;
    }

    if (profile.id === 'enchanter') {
      drawCharmOrbit(ctx, a.chest.x, a.chest.y + 2, palette, p.t, p.charmPulse || 0.45);
      drawEnchanterLowerDetails(ctx, rig, palette);
      if (p.action === 'idle') drawMindWave(ctx, a.head.x, a.head.y - 8, palette, p.t, 0.28 + pulse * 0.20);
      return;
    }

    if (profile.id === 'necromancer') {
      ctx.save();
      ctx.globalAlpha = 0.18 + (p.deathMoteBias || 0.3) * 0.12;
      drawDarkMotes(ctx, a.chest.x, a.chest.y + 8, palette, p.t, 0.55);
      ctx.restore();
    }
  }

  function drawCross(ctx, x, y, scale, fill, stroke) {
    line(ctx, x, y - 8 * scale, x, y + 10 * scale, stroke, 5 * scale, 0.9);
    line(ctx, x - 7 * scale, y - 1 * scale, x + 7 * scale, y - 1 * scale, stroke, 5 * scale, 0.9);
    line(ctx, x, y - 8 * scale, x, y + 10 * scale, fill, 2.4 * scale, 1);
    line(ctx, x - 7 * scale, y - 1 * scale, x + 7 * scale, y - 1 * scale, fill, 2.4 * scale, 1);
  }

  function drawDiamond(ctx, x, y, size, fill, stroke) {
    poly(ctx, [
      { x, y: y - size },
      { x: x + size, y },
      { x, y: y + size },
      { x: x - size, y }
    ], fill, stroke, 1.2);
  }

  function drawSword(ctx, x, y, rot, scale, palette, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    line(ctx, 0, 9 * scale, 0, -23 * scale, palette.outline, 6 * scale, 1);
    line(ctx, 0, 8 * scale, 0, -22 * scale, palette.metal, 3 * scale, 1);
    line(ctx, -7 * scale, 3 * scale, 7 * scale, 3 * scale, palette.accentDark, 3 * scale, 1);
    roundRect(ctx, -2 * scale, 5 * scale, 4 * scale, 11 * scale, 2 * scale, palette.belt, palette.outline, 0.8 * scale);
    ctx.restore();
  }

  function drawDagger(ctx, x, y, rot, scale, palette, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    const s = scale || 1;
    // V0.14.05: high-readability rogue dagger. Built as real procedural geometry
    // instead of a single stroke so dual-wield weapons remain visible at gameplay scale.
    poly(ctx, [
      { x: 0, y: -20 * s },
      { x: 4.6 * s, y: -9 * s },
      { x: 1.7 * s, y: 3.5 * s },
      { x: -1.7 * s, y: 3.5 * s },
      { x: -4.6 * s, y: -9 * s }
    ], palette.outline, palette.outline, 0.2 * s);
    poly(ctx, [
      { x: 0, y: -18.4 * s },
      { x: 3.0 * s, y: -8.4 * s },
      { x: 1.0 * s, y: 2.2 * s },
      { x: -1.0 * s, y: 2.2 * s },
      { x: -3.0 * s, y: -8.4 * s }
    ], palette.metalHi || palette.metal, palette.metalDark || palette.outline, 0.7 * s);
    line(ctx, 0, -16.2 * s, 0, 1.6 * s, 'rgba(255,255,255,0.62)', 0.85 * s, 1);
    line(ctx, -1.6 * s, -7.6 * s, -0.4 * s, 1.2 * s, palette.metal || '#cfd6d8', 0.7 * s, 0.78);
    line(ctx, -6.6 * s, 3.0 * s, 6.6 * s, 3.0 * s, palette.outline, 3.2 * s, 1);
    line(ctx, -5.2 * s, 3.0 * s, 5.2 * s, 3.0 * s, palette.belt, 1.55 * s, 1);
    roundRect(ctx, -2.2 * s, 4.0 * s, 4.4 * s, 9.6 * s, 1.4 * s, palette.belt, palette.outline, 0.9 * s);
    for (let i = 0; i < 4; i++) {
      const yy = (5.2 + i * 1.8) * s;
      line(ctx, -1.7 * s, yy, 1.7 * s, yy - 0.8 * s, palette.accentDark || palette.clothDark || '#111', 0.55 * s, 0.82);
    }
    ellipse(ctx, 0, 14.8 * s, 2.8 * s, 2.1 * s, 0, palette.metalDark || palette.outline, palette.outline, 0.55 * s);
    ctx.restore();
  }

  function drawShield(ctx, x, y, scale, palette, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    poly(ctx, [
      { x: x - 9 * scale, y: y - 12 * scale },
      { x: x + 9 * scale, y: y - 12 * scale },
      { x: x + 7 * scale, y: y + 6 * scale },
      { x, y: y + 14 * scale },
      { x: x - 7 * scale, y: y + 6 * scale }
    ], palette.metalDark, palette.outline, 1.4 * scale);
    line(ctx, x, y - 9 * scale, x, y + 8 * scale, palette.metal, 2 * scale, 0.85);
    line(ctx, x - 6 * scale, y - 4 * scale, x + 6 * scale, y - 4 * scale, palette.accent, 1.4 * scale, 0.75);
    ctx.restore();
  }

  function drawMace(ctx, x, y, rot, scale, palette, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    line(ctx, 0, 10 * scale, 0, -18 * scale, palette.outline, 5 * scale, 1);
    line(ctx, 0, 10 * scale, 0, -18 * scale, palette.metalDark, 2.5 * scale, 1);
    ellipse(ctx, 0, -22 * scale, 5.5 * scale, 6.5 * scale, 0, palette.metal, palette.outline, 1 * scale);
    drawCross(ctx, 0, -22 * scale, 0.32 * scale, palette.accent, palette.outline);
    ctx.restore();
  }

  function drawLongbow(ctx, x, y, rot, scale, palette, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    const s = scale || 1;
    const wood = palette.belt || '#6b4a2e';
    const horn = palette.metalDark || palette.outline;
    const wrap = palette.bootHi || palette.accentDark || '#4a3724';
    const string = palette.metalHi || 'rgba(240,240,230,0.9)';
    const glow = palette.glow || 'rgba(170,255,130,0.35)';
    const pts = [
      { x: -7.0 * s, y: 20.0 * s },
      { x: -9.0 * s, y: 10.0 * s },
      { x: -10.0 * s, y: 0 },
      { x: -8.0 * s, y: -10.0 * s },
      { x: -5.0 * s, y: -20.0 * s }
    ];
    for (let i = 0; i < pts.length - 1; i++) {
      line(ctx, pts[i].x, pts[i].y, pts[i+1].x, pts[i+1].y, palette.outline, 5.2 * s, 1);
      line(ctx, pts[i].x, pts[i].y, pts[i+1].x, pts[i+1].y, wood, 2.8 * s, 1);
    }
    line(ctx, -6.4 * s, 18.2 * s, -4.4 * s, -18.2 * s, string, 0.95 * s, 0.9);
    line(ctx, -7.0 * s, 20.0 * s, -5.0 * s, -20.0 * s, 'rgba(255,255,255,0.18)', 0.5 * s, 0.45);
    roundRect(ctx, -9.2 * s, -5.4 * s, 6.0 * s, 10.8 * s, 1.5 * s, wrap, palette.outline, 0.85 * s);
    for (let i = -1; i <= 1; i++) {
      line(ctx, -8.4 * s, i * 2.8 * s, -4.1 * s, i * 2.2 * s, palette.accentDark, 0.65 * s, 0.8);
    }
    line(ctx, -9.2 * s, 9.2 * s, -7.6 * s, 10.6 * s, horn, 0.9 * s, 0.8);
    line(ctx, -7.0 * s, -16.2 * s, -5.2 * s, -15.0 * s, horn, 0.9 * s, 0.8);
    ellipse(ctx, -5.7 * s, 14.0 * s, 1.1 * s, 2.1 * s, 0, palette.clothHi || palette.accent, palette.outline, 0.45 * s);
    ellipse(ctx, -5.3 * s, -13.2 * s, 1.1 * s, 2.1 * s, 0, palette.clothHi || palette.accent, palette.outline, 0.45 * s);
    line(ctx, -7.0 * s, 4.2 * s, -5.0 * s, 5.3 * s, glow, 0.8 * s, 0.35);
    ctx.restore();
  }


  // Increasing this scales the whole bow assembly - curve, grip, string rest/draw points,
  // hand reach, and arrow tip offset all derive from `s` below, so nothing is left behind at
  // the old size.
  const RANGER_BOW_SCALE = 1.25;

  // Explicit-phase Ranger bow draw pose. `drawProgress` is the same monotonic 0->1 value
  // combat-system.js resolves the hit/projectile against (reaches 1 exactly when the shot
  // fires), so the visual release below always lands on the same frame as the real arrow.
  // Phase split: 0-0.12 raise/aim, 0.12-0.30 reach the string (string stays neutral,
  // no stretch before contact), 0.30-0.92 grab + draw (string only bends once the hand
  // has actually arrived), 0.92-1.00 hold-and-release. `recoveryProgress` (0->1) blends
  // the hand the rest of the way to idle during the brief post-release settle window.
  //
  // Every position and angle below is derived from one aim vector (getRangerCombatAim), which
  // is itself the same combat-target vector combat-system.js resolves the shot against - the
  // bow's screen side, its rotation, the hand/string points, and the arrow all move together
  // because they all read from that single source instead of each recomputing their own idea
  // of "which way." All bow-relative geometry below is built in a fixed "aiming due east"
  // template and then rotated as one rigid unit by the true aim angle in drawRangerDrawnBow,
  // rather than mirrored per-point by a left/right-only `side` flag - that flag alone can't
  // express "target is above/below," which was the actual root cause of the bow only ever
  // reading as stuck on one hand.
  function getRangerBowPose(rig, profile, drawProgress, recoveryProgress) {
    const a = rig.anchors || {};
    const aim = getRangerCombatAim(rig);
    const s = (profile?.silhouette?.prop || 1) * 1.02 * RANGER_BOW_SCALE;
    const t = clamp01(drawProgress);
    const recovery = clamp01(recoveryProgress);

    const RAISE_END = 0.12;
    const REACH_END = 0.30;
    const DRAW_END = 0.92;

    const raiseT = easeInOut(t <= RAISE_END ? t / RAISE_END : 1);
    const reachT = t <= RAISE_END ? 0 : easeInOut(clamp01((t - RAISE_END) / (REACH_END - RAISE_END)));
    const drawT = t <= REACH_END ? 0 : easeInOut(clamp01((t - REACH_END) / (DRAW_END - REACH_END)));
    const released = t > DRAW_END;
    const armRaise = t <= RAISE_END ? raiseT : 1;

    // Bow pivot: anchored on the stable chest point (not the shared rig's mainHand/offHand -
    // those are assigned by body-row/near-arm convention, not by the target's actual side, which
    // is exactly why the bow used to stay on one hand regardless of where the target was) and
    // pushed out along the true aim vector, so the bow always sits between the Ranger and the
    // target on every axis, not just left/right.
    const origin = a.chest || a.pelvis || { x: 0, y: -30 };
    const forward = (13 + armRaise * 3) * s;
    const perp = { x: -aim.y, y: aim.x };
    const perpOffset = 4 * s;
    const bowX = origin.x + aim.x * forward + perp.x * perpOffset;
    const bowY = origin.y + aim.y * forward + perp.y * perpOffset - 6 * s;

    // Bow rotation: the whole assembly turns to the true aim angle, plus a small extra tilt
    // while raising/holding/releasing for a sense of tension - not a cosmetic wobble that left
    // the bow facing sideways regardless of where the target actually was.
    const drawWobble = -0.05 - armRaise * 0.08 + (released ? 0.10 : 0);
    const bowAngle = aim.angle + drawWobble;

    // Local points below are all offsets from the bow pivot in the fixed "aiming due east"
    // template; drawRangerDrawnBow rotates the whole set by bowAngle in one canvas transform,
    // so no point here needs its own per-point rotation math.
    const idleHandLocal = { x: 8.0 * s, y: 9.0 * s };
    const stringNeutralLocal = { x: -0.7 * s, y: -0.3 * s };
    const drawnHandLocal = { x: stringNeutralLocal.x + 13.5 * s, y: stringNeutralLocal.y - 4.5 * s };

    let drawHandLocal;
    if (t <= RAISE_END) drawHandLocal = idleHandLocal;
    else if (t <= REACH_END) drawHandLocal = lerpPoint(idleHandLocal, stringNeutralLocal, reachT);
    else if (!released) drawHandLocal = lerpPoint(stringNeutralLocal, drawnHandLocal, drawT);
    else drawHandLocal = lerpPoint(drawnHandLocal, stringNeutralLocal, easeInOut(clamp01((t - DRAW_END) / (1 - DRAW_END))));
    if (recovery > 0) drawHandLocal = lerpPoint(drawHandLocal, idleHandLocal, recovery);

    // The string only ever tracks the hand while the hand is actually attached (from the
    // moment it reaches the string through the moment it releases); before contact and
    // after release it snaps straight back to its neutral rest position.
    const stringControlLocal = (t <= REACH_END || released) ? stringNeutralLocal : drawHandLocal;
    const arrowTipLocal = { x: 21.0 * s, y: -0.6 * s };
    const shouldShowNockedArrow = t > REACH_END && !released;
    const shouldReleaseArrow = t >= DRAW_END && t < DRAW_END + 0.02;

    return {
      side: aim.side, s, bowX, bowY, bowAngle,
      bowHand: { x: bowX, y: bowY },
      drawHandLocal,
      stringNeutralLocal,
      stringControlLocal,
      arrowTipLocal,
      aimVector: { x: aim.x, y: aim.y },
      shouldShowNockedArrow,
      shouldReleaseArrow
    };
  }

  function drawRangerDrawnBow(ctx, rig, palette, profile, drawProgress, recoveryProgress) {
    const pose = getRangerBowPose(rig, profile, drawProgress, recoveryProgress);
    const { s, bowX, bowY, bowAngle, drawHandLocal, stringNeutralLocal, stringControlLocal, arrowTipLocal, shouldShowNockedArrow } = pose;
    const wood = palette.belt || '#6b4a2e';
    const horn = palette.metalDark || palette.outline;
    const wrap = palette.bootHi || palette.accentDark || '#4a3724';
    const string = palette.metalHi || '#ebe8d9';
    const arrowWood = '#7a5129';
    const arrowHead = '#dde0d9';
    const fletch = palette.clothHi || '#dfe8c4';

    ctx.save();
    ctx.translate(bowX, bowY);
    ctx.rotate(bowAngle);

    const top = { x: -5.0 * s, y: -19.0 * s };
    const midA = { x: -9.2 * s, y: -8.7 * s };
    const grip = { x: -7.0 * s, y: 0 };
    const midB = { x: -8.7 * s, y: 9.6 * s };
    const bottom = { x: -5.0 * s, y: 20.0 * s };
    const limbPts = [top, midA, grip, midB, bottom];
    const shaftTail = { x: stringControlLocal.x - 1.0 * s, y: stringControlLocal.y };

    for (let i = 0; i < limbPts.length - 1; i++) {
      line(ctx, limbPts[i].x, limbPts[i].y, limbPts[i + 1].x, limbPts[i + 1].y, palette.outline, 5.1 * s, 1);
      line(ctx, limbPts[i].x, limbPts[i].y, limbPts[i + 1].x, limbPts[i + 1].y, wood, 2.7 * s, 1);
    }
    line(ctx, limbPts[0].x, limbPts[0].y, stringControlLocal.x, stringControlLocal.y, string, 0.95 * s, 0.92);
    line(ctx, stringControlLocal.x, stringControlLocal.y, limbPts[4].x, limbPts[4].y, string, 0.95 * s, 0.92);
    roundRect(ctx, -9.3 * s, -5.3 * s, 6.1 * s, 10.6 * s, 1.5 * s, wrap, palette.outline, 0.85 * s);
    for (let i = -1; i <= 1; i++) {
      line(ctx, -8.4 * s, i * 2.8 * s, -4.1 * s, i * 2.2 * s, palette.accentDark, 0.65 * s, 0.8);
    }
    line(ctx, limbPts[1].x - 0.8 * s, limbPts[1].y + 0.4 * s, limbPts[1].x + 1.0 * s, limbPts[1].y + 1.8 * s, horn, 0.8 * s, 0.7);
    line(ctx, limbPts[3].x - 0.4 * s, limbPts[3].y - 1.0 * s, limbPts[3].x + 1.2 * s, limbPts[3].y - 0.1 * s, horn, 0.8 * s, 0.7);
    if (shouldShowNockedArrow) {
      line(ctx, shaftTail.x, shaftTail.y, arrowTipLocal.x, arrowTipLocal.y, palette.outline, 2.0 * s, 1);
      line(ctx, shaftTail.x, shaftTail.y, arrowTipLocal.x, arrowTipLocal.y, arrowWood, 0.95 * s, 1);
      poly(ctx, [
        { x: arrowTipLocal.x, y: arrowTipLocal.y },
        { x: arrowTipLocal.x - 5.2 * s, y: arrowTipLocal.y - 2.1 * s },
        { x: arrowTipLocal.x - 3.0 * s, y: arrowTipLocal.y },
        { x: arrowTipLocal.x - 5.2 * s, y: arrowTipLocal.y + 2.1 * s }
      ], arrowHead, palette.outline, 0.7 * s);
      line(ctx, shaftTail.x, shaftTail.y, shaftTail.x - 5.8 * s, shaftTail.y - 3.4 * s, fletch, 1.05 * s, 0.9);
      line(ctx, shaftTail.x, shaftTail.y, shaftTail.x - 5.8 * s, shaftTail.y + 3.4 * s, fletch, 1.05 * s, 0.9);
    }
    const handPull = Math.hypot(drawHandLocal.x - stringNeutralLocal.x, drawHandLocal.y - stringNeutralLocal.y) / (13.5 * s);
    const wristGlow = 0.22 + Math.min(1, handPull) * 0.18;
    ellipse(ctx, drawHandLocal.x, drawHandLocal.y, 2.1 * s, 2.4 * s, 0, palette.skin || '#d0b390', palette.outline, 0.55);
    line(ctx, drawHandLocal.x - 4.2 * s, drawHandLocal.y + 0.8 * s, drawHandLocal.x + 2.0 * s, drawHandLocal.y - 0.4 * s, palette.outline, 1.4, 0.38 + wristGlow);
    line(ctx, drawHandLocal.x - 3.8 * s, drawHandLocal.y + 0.5 * s, drawHandLocal.x + 1.7 * s, drawHandLocal.y - 0.1 * s, palette.clothHi || palette.accent, 0.8, 0.52 + wristGlow);
    ctx.restore();
  }

  function drawQuiver(ctx, x, y, rot, scale, palette, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    const s = scale || 1;
    roundRect(ctx, -6.0 * s, -14.0 * s, 12.0 * s, 29.0 * s, 3.2 * s, palette.belt, palette.outline, 0.95 * s);
    line(ctx, -5.0 * s, -11.5 * s, 5.0 * s, -11.5 * s, palette.bootHi || palette.accentDark, 1.2 * s, 0.7);
    line(ctx, -4.6 * s, -2.8 * s, 4.6 * s, -2.8 * s, palette.bootHi || palette.accentDark, 1.0 * s, 0.55);
    for (let i = 0; i < 4; i++) {
      const ox = -3.6 * s + i * 2.4 * s;
      line(ctx, ox, -22.0 * s - (i % 2) * 1.0 * s, ox + 0.2 * s, -7.5 * s, palette.outline, 1.8 * s, 0.95);
      line(ctx, ox, -22.0 * s - (i % 2) * 1.0 * s, ox + 0.2 * s, -7.5 * s, palette.bootHi || palette.belt, 0.75 * s, 0.95);
      poly(ctx, [
        { x: ox, y: -24.8 * s - (i % 2) * 1.0 * s },
        { x: ox + 2.1 * s, y: -20.5 * s - (i % 2) * 1.0 * s },
        { x: ox - 2.1 * s, y: -20.5 * s - (i % 2) * 1.0 * s }
      ], palette.metal, palette.outline, 0.7 * s);
      ellipse(ctx, ox - 0.7 * s, -5.0 * s, 1.0 * s, 3.2 * s, 0.4, palette.clothHi || '#c9d2b6', palette.outline, 0.35 * s);
      ellipse(ctx, ox + 0.8 * s, -5.2 * s, 1.0 * s, 3.2 * s, -0.2, palette.clothHi || '#c9d2b6', palette.outline, 0.35 * s);
    }
    ctx.restore();
  }

  function drawRangerHipBlades(ctx, rig, palette) {
    const a = rig.anchors;
    const sheath = palette.boot || '#21170f';
    const trim = palette.belt || '#5a3c24';
    // Secondary blades are sheathed sidearms. Do not render bright exposed blades;
    // they read as hand-held white sticks during combat.
    const drawSheath = (x, y, side) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(side * 0.24);
      roundRect(ctx, -2.3, -2.0, 4.6, 17.5, 1.4, sheath, palette.outline, 0.85);
      line(ctx, -1.2, 0.5, 1.2, 14.5, trim, 0.75, 0.52);
      roundRect(ctx, -4.0, -5.0, 8.0, 4.5, 1.2, trim, palette.outline, 0.70);
      line(ctx, -5.0, -3.0, 5.0, -3.0, palette.outline, 0.8, 0.55);
      ctx.restore();
    };
    drawSheath(a.pelvis.x - 18, a.pelvis.y + 1, -1);
    drawSheath(a.pelvis.x + 18, a.pelvis.y + 1, 1);
    line(ctx, a.pelvis.x - 11, a.pelvis.y - 3, a.pelvis.x - 18, a.pelvis.y + 8, palette.outline, 1.0, 0.40);
    line(ctx, a.pelvis.x + 11, a.pelvis.y - 3, a.pelvis.x + 18, a.pelvis.y + 8, palette.outline, 1.0, 0.40);
  }


  function drawCharmScepter(ctx, x, y, rot, scale, palette, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    line(ctx, 0, 16 * scale, 0, -26 * scale, palette.outline, 5.2 * scale, 1);
    line(ctx, 0, 15 * scale, 0, -25 * scale, palette.metalDark, 2.2 * scale, 1);
    roundRect(ctx, -2.2 * scale, 1 * scale, 4.4 * scale, 8.0 * scale, 1.2 * scale, palette.bootHi || palette.belt, palette.outline, 0.7 * scale);
    line(ctx, -5.6 * scale, -20 * scale, 5.6 * scale, -20 * scale, palette.metal, 1.2 * scale, 0.86);
    ellipse(ctx, 0, -29 * scale, 8.2 * scale, 3.2 * scale, 0, null, palette.glow, 0.9 * scale);
    drawCharmGlyph(ctx, 0, -29 * scale, 0.62 * scale, palette, 0, 0.92);
    for (let i = -1; i <= 1; i += 2) {
      drawDiamond(ctx, i * 8.2 * scale, -22.0 * scale, 1.9 * scale, palette.accent, palette.outline);
      line(ctx, i * 5.4 * scale, -20.5 * scale, i * 8.2 * scale, -22.0 * scale, palette.metalDark, 0.8 * scale, 0.72);
    }
    line(ctx, -4.2 * scale, -6 * scale, 4.2 * scale, -8.8 * scale, palette.accentDark, 0.8 * scale, 0.62);
    line(ctx, 4.0 * scale, 2.0 * scale, -3.5 * scale, -1.4 * scale, palette.accent, 0.7 * scale, 0.50);
    ctx.restore();
  }

  function drawCharmGlyph(ctx, x, y, scale, palette, t, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = alpha == null ? 0.72 : alpha;
    ctx.translate(x, y);
    ctx.rotate(Math.sin((t || 0) * 1.7) * 0.16);
    const r = 7 * scale;
    ctx.strokeStyle = palette.glow;
    ctx.lineWidth = Math.max(0.8, 1.5 * scale);
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.bezierCurveTo(r * 0.92, -r * 0.72, r * 0.92, r * 0.72, 0, r);
    ctx.bezierCurveTo(-r * 0.92, r * 0.72, -r * 0.92, -r * 0.72, 0, -r);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.34, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawCharmRibbons(ctx, x, y1, y2, palette, t, side) {
    const sway = Math.sin((t || 0) * 1.8) * 2;
    line(ctx, x - 9, y1, x - 14 - sway, y2, palette.accentDark, 1.5, 0.55);
    line(ctx, x + 9, y1 + 2, x + 13 + sway + side * 2, y2 - 2, palette.accent, 1.3, 0.48);
    drawDiamond(ctx, x - 14 - sway, y2 + 2, 2.4, palette.glow, palette.outline);
  }

  function drawCharmOrbit(ctx, x, y, palette, t, pulse) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const a0 = (t || 0) * 1.75;
    const alpha = 0.18 + (pulse || 0.4) * 0.18;
    drawRuneCircle(ctx, x, y, 18 + (pulse || 0.4) * 8, palette, alpha);
    for (let i = 0; i < 3; i++) {
      const a = a0 + i * TAU / 3;
      drawCharmGlyph(ctx, x + Math.cos(a) * 17, y + Math.sin(a) * 5, 0.26, palette, t + i, 0.32 + (pulse || 0.4) * 0.16);
    }
    ctx.restore();
  }

  function drawMindWave(ctx, x, y, palette, t, pulse) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.20 + (pulse || 0.35) * 0.22;
    ctx.strokeStyle = palette.glow;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      const r = 9 + i * 5 + (pulse || 0) * 4;
      ctx.beginPath();
      ctx.ellipse(x, y - i * 1.4, r, r * 0.30, Math.sin((t || 0) + i) * 0.08, Math.PI * 0.08, Math.PI * 0.92);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRitualRod(ctx, x, y, rot, scale, palette, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    line(ctx, 0, 18 * scale, 0, -28 * scale, palette.outline, 5.6 * scale, 1);
    line(ctx, 0, 17 * scale, 0, -27 * scale, palette.belt, 2.6 * scale, 1);
    for (let i = 0; i < 3; i++) {
      const yy = (8 - i * 10) * scale;
      line(ctx, -1.8 * scale, yy, 1.8 * scale, yy - 1.2 * scale, palette.accentDark, 0.7 * scale, 0.75);
    }
    roundRect(ctx, -2.4 * scale, 2 * scale, 4.8 * scale, 8.6 * scale, 1.4 * scale, palette.bootHi || palette.belt, palette.outline, 0.8 * scale);
    line(ctx, -6.5 * scale, -18.5 * scale, 6.5 * scale, -18.5 * scale, palette.metalDark, 1.5 * scale, 0.85);
    line(ctx, -5.2 * scale, -18.5 * scale, 5.2 * scale, -18.5 * scale, palette.metal, 0.7 * scale, 0.9);
    drawDiamond(ctx, 0, -30 * scale, 5.9 * scale, palette.glow, palette.outline);
    ellipse(ctx, 0, -30 * scale, 8.8 * scale, 3.2 * scale, 0, null, palette.metalDark, 1.1 * scale);
    for (let i = -1; i <= 1; i += 2) {
      line(ctx, i * 7 * scale, -30 * scale, i * 3.5 * scale, -23.5 * scale, palette.metalDark, 1.2 * scale, 0.85);
      drawDiamond(ctx, i * 8.1 * scale, -19.5 * scale, 1.9 * scale, palette.accent, palette.outline);
    }
    line(ctx, -4.6 * scale, -5.5 * scale, -8.5 * scale, 1.5 * scale, palette.accentDark, 0.85 * scale, 0.65);
    line(ctx, 4.6 * scale, -2.0 * scale, 8.1 * scale, 5.2 * scale, palette.accentDark, 0.85 * scale, 0.65);
    ctx.restore();
  }

  function drawBoneStaff(ctx, x, y, rot, scale, palette, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    line(ctx, 0, 19 * scale, 0, -31 * scale, palette.outline, 5.4 * scale, 1);
    line(ctx, 0, 18 * scale, 0, -30 * scale, palette.belt, 2.5 * scale, 1);
    for (let i = 0; i < 4; i++) {
      const yy = (10 - i * 9) * scale;
      line(ctx, -1.5 * scale, yy, 1.5 * scale, yy - 1.2 * scale, palette.accentDark, 0.7 * scale, 0.72);
    }
    line(ctx, -4.2 * scale, -18 * scale, -8.4 * scale, -23 * scale, palette.metalDark, 0.95 * scale, 0.82);
    line(ctx, 4.2 * scale, -13 * scale, 8.0 * scale, -18 * scale, palette.metalDark, 0.95 * scale, 0.82);
    drawBone(ctx, -3 * scale, -30 * scale, 0.72 * scale, palette);
    drawBone(ctx, 4 * scale, -26 * scale, 0.58 * scale, palette);
    ellipse(ctx, 0, -34 * scale, 7.0 * scale, 8.0 * scale, 0, palette.accentDark, palette.outline, 0.9 * scale);
    ctx.fillStyle = palette.outline;
    ctx.globalAlpha *= 0.88;
    ctx.fillRect(-3.6 * scale, -35.5 * scale, 2.1 * scale, 2.4 * scale);
    ctx.fillRect(1.5 * scale, -35.5 * scale, 2.1 * scale, 2.4 * scale);
    line(ctx, -2.4 * scale, -29.5 * scale, 2.4 * scale, -29.5 * scale, palette.outline, 0.9 * scale, 0.95);
    ctx.globalAlpha = (alpha == null ? 1 : alpha) * 0.55;
    ellipse(ctx, 0, -34 * scale, 10.5 * scale, 10.5 * scale, 0, palette.glow, null, 0);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    drawDiamond(ctx, 0, -43 * scale, 2.0 * scale, palette.glow, palette.outline);
    line(ctx, 0, -39 * scale, 0, -36 * scale, palette.metalDark, 0.8 * scale, 0.8);
    ctx.restore();
  }

  function drawBone(ctx, x, y, scale, palette) {
    line(ctx, x - 4 * scale, y, x + 4 * scale, y, palette.accent, 2.2 * scale, 0.95);
    ellipse(ctx, x - 5 * scale, y, 2.3 * scale, 2.3 * scale, 0, palette.accent, palette.outline, 0.6 * scale);
    ellipse(ctx, x + 5 * scale, y, 2.3 * scale, 2.3 * scale, 0, palette.accent, palette.outline, 0.6 * scale);
  }

  function drawSkullCharm(ctx, x, y, scale, palette) {
    ellipse(ctx, x, y, 5 * scale, 5.5 * scale, 0, palette.accent, palette.outline, 1 * scale);
    ctx.fillStyle = palette.outline;
    ctx.fillRect(x - 2.8 * scale, y - 1.3 * scale, 1.6 * scale, 1.6 * scale);
    ctx.fillRect(x + 1.2 * scale, y - 1.3 * scale, 1.6 * scale, 1.6 * scale);
    line(ctx, x - 2 * scale, y + 3.5 * scale, x + 2 * scale, y + 3.5 * scale, palette.outline, 1 * scale, 0.9);
  }

  function drawFloatingCrystal(ctx, x, y, scale, fill, stroke, t) {
    const bob = Math.sin((t || 0) * 3.2) * 1.2;
    drawDiamond(ctx, x, y + bob, 6 * scale, fill, stroke);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.28;
    ellipse(ctx, x, y + bob, 11 * scale, 11 * scale, 0, fill, fill, 0);
    ctx.restore();
  }

  function drawHolySeal(ctx, x, y, scale, palette) {
    ellipse(ctx, x, y, 8 * scale, 8 * scale, 0, 'rgba(255,245,170,0.22)', palette.glow, 1.4 * scale);
    drawCross(ctx, x, y, 0.45 * scale, palette.glow, palette.outline);
  }

  function drawHolySpark(ctx, x, y, palette, pulse) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6 + pulse;
      const r = 14 + Math.sin(pulse * 5 + i) * 3;
      line(ctx, x + Math.cos(a) * 4, y + Math.sin(a) * 4, x + Math.cos(a) * r, y + Math.sin(a) * r, palette.glow, 1.3, 0.52);
    }
    ctx.restore();
  }

  function drawRuneCircle(ctx, x, y, r, palette, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = alpha == null ? 0.35 : alpha;
    ctx.strokeStyle = palette.glow;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.36, 0, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5;
      drawDiamond(ctx, x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.28, 2.2, palette.glow, palette.glow);
    }
    ctx.restore();
  }

  function drawOrbitSpark(ctx, x, y, palette, t) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 4; i++) {
      const a = (t || 0) * 2.3 + i * TAU / 4;
      ellipse(ctx, x + Math.cos(a) * 22, y + Math.sin(a) * 7, 2.2, 2.2, 0, palette.glow, palette.glow, 0);
    }
    ctx.restore();
  }

  function drawHalo(ctx, x, y, scale, color) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.42;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.ellipse(x, y, 13 * scale, 4.2 * scale, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawSlash(ctx, x, y, color, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = alpha == null ? 0.65 : alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(x, y, 15, -0.85, 0.62);
    ctx.stroke();
    ctx.restore();
  }

  function drawDarkMotes(ctx, x, y, palette, t, pulse) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.36 + (pulse || 0) * 0.22;
    for (let i = 0; i < 7; i++) {
      const a = (t || 0) * 1.7 + i * 0.91;
      ellipse(ctx, x + Math.cos(a) * (11 + i), y + Math.sin(a * 1.3) * 9 - i, 1.6, 1.6, 0, palette.glow, palette.glow, 0);
    }
    ctx.restore();
  }

  function drawMeditationAura(ctx, x, y, palette, profile, t, pulse) {
    const id = profile.id;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const color = id === 'cleric' ? '#fff1a8' : id === 'necromancer' ? '#9fff6d' : id === 'enchanter' ? '#ffb6ff' : id === 'rogue' ? '#6affe1' : id === 'fighter' ? '#ffd680' : id === 'summoner' ? '#75fff0' : palette.glow;
    ctx.globalAlpha = 0.20;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y + 7, 24 + (pulse || 1) * 3, 7 + (pulse || 1), 0, 0, TAU);
    ctx.fill();

    if (id === 'rogue') {
      ctx.globalAlpha = 0.24;
      for (let i = 0; i < 5; i++) {
        const a = (t || 0) * 2.1 + i * 1.2;
        line(ctx, x + Math.cos(a) * (14 + i * 2), y + 2 + Math.sin(a) * 3, x + Math.cos(a + 0.4) * (20 + i * 2), y + 5 + Math.sin(a + 0.4) * 3, color, 1.0, 0.46);
      }
    } else if (id === 'cleric') {
      drawHalo(ctx, x, y - 34, 0.9 + Math.sin((t || 0) * 1.5) * 0.04, color);
      for (let i = -2; i <= 2; i++) line(ctx, x + i * 7, y - 4, x + i * 3, y - 24, '#fff8cf', 0.9, 0.30);
    } else if (id === 'summoner') {
      drawRuneCircle(ctx, x, y + 4, 22 + Math.sin((t || 0) * 1.6) * 1.5, { ...palette, glow: color }, 0.35);
      drawOrbitSpark(ctx, x, y - 14, { ...palette, glow: color }, t || 0);
    } else if (id === 'necromancer') {
      drawRuneCircle(ctx, x, y + 7, 20, { ...palette, glow: color }, 0.22);
      drawDarkMotes(ctx, x, y - 4, { ...palette, glow: color }, t || 0, 0.65);
    } else if (id === 'enchanter') {
      drawCharmOrbit(ctx, x, y + 1, { ...palette, glow: color }, t || 0, 0.55);
      drawMindWave(ctx, x, y - 28, { ...palette, glow: color }, t || 0, 0.35);
    }
    ctx.restore();
  }

  function drawHitFlash(ctx, x, y, palette, profile, hitFlash) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = Math.min(0.5, hitFlash * 0.38);
    const fill = profile.id === 'necromancer' ? palette.glow : '#ffffff';
    ellipse(ctx, x, y + 3, 22, 29, 0, fill, fill, 0);
    ctx.restore();
  }

  function drawRuneStrip(ctx, x, y1, y2, palette, t) {
    line(ctx, x, y1, x - 4, y2, palette.accent, 1.8, 0.82);
    for (let y = y1 + 8; y < y2; y += 10) {
      drawDiamond(ctx, x - 2 + Math.sin((t || 0) + y) * 0.7, y, 2.2, palette.glow, palette.outline);
    }
  }

  function drawRibMarks(ctx, x, y, palette) {
    for (let i = -2; i <= 2; i++) {
      line(ctx, x + i * 4, y - 4, x + i * 3, y + 13, i === 0 ? palette.accent : palette.accentDark, 1.3, i === 0 ? 0.9 : 0.65);
    }
    for (let j = 0; j < 3; j++) {
      line(ctx, x - 9, y + j * 5, x + 9, y + j * 5, palette.accentDark, 1.1, 0.7);
    }
  }

  function drawHangingTalismans(ctx, x, y, palette, t) {
    for (let i = 0; i < 3; i++) {
      const sx = x + (i - 1) * 6;
      const sy = y + i * 4 + Math.sin((t || 0) * 2 + i) * 0.8;
      line(ctx, sx, sy, sx + 1, sy + 10, palette.accentDark, 1, 0.8);
      drawDiamond(ctx, sx + 1, sy + 13, 2.5, i === 1 ? palette.glow : palette.accent, palette.outline);
    }
  }



  function drawStormStaff(ctx, x, y, rot, scale, palette, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    const s = scale || 1;
    line(ctx, 0, 14 * s, 0, -28 * s, palette.outline, 6.5 * s, 1);
    line(ctx, 0, 14 * s, 0, -28 * s, '#3a2518', 3.0 * s, 1);
    for (let i = -2; i <= 2; i++) {
      line(ctx, -2.4 * s, -18 * s + i * 6, 2.4 * s, -16 * s + i * 6, palette.accentDark, 0.8 * s, 0.6);
    }
    line(ctx, -6 * s, -8 * s, 6 * s, -4 * s, palette.belt, 1.1 * s, 0.72);
    line(ctx, -5 * s, 2 * s, 5 * s, 6 * s, palette.belt, 1.1 * s, 0.72);
    line(ctx, 0, -28 * s, -8 * s, -17 * s, palette.metalDark, 1.8 * s, 0.95);
    line(ctx, 0, -28 * s, 8 * s, -17 * s, palette.metalDark, 1.8 * s, 0.95);
    line(ctx, -8 * s, -17 * s, 8 * s, -17 * s, palette.metalDark, 1.5 * s, 0.95);
    drawFloatingCrystal(ctx, 0, -22 * s, 0.70 * s, palette.glow, palette.outline, 0);
    line(ctx, -6 * s, -21 * s, -13 * s, -26 * s, palette.accentDark, 0.9 * s, 0.85);
    line(ctx, 6 * s, -21 * s, 13 * s, -25 * s, palette.accentDark, 0.9 * s, 0.85);
    line(ctx, -3 * s, -10 * s, -10 * s, -13 * s, palette.metal, 0.8 * s, 0.75);
    line(ctx, 4 * s, -2 * s, 10 * s, 0 * s, palette.metal, 0.8 * s, 0.75);
    ellipse(ctx, -11 * s, -12 * s, 1.4 * s, 4.2 * s, -0.4, palette.clothHi, palette.outline, 0.45 * s);
    ellipse(ctx, 11 * s, 0 * s, 1.4 * s, 4.2 * s, 0.4, palette.clothHi, palette.outline, 0.45 * s);
    drawShamanLightningArc(ctx, -2 * s, -21 * s, 10 * s, -16 * s, palette.glow, 0.28);
    ctx.restore();
  }

  function drawShamanLightningArc(ctx, x1, y1, x2, y2, color, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = alpha == null ? 0.4 : alpha;
    const mx1 = x1 + (x2 - x1) * 0.33 + (y2 - y1) * 0.10;
    const my1 = y1 + (y2 - y1) * 0.33 - (x2 - x1) * 0.06;
    const mx2 = x1 + (x2 - x1) * 0.66 - (y2 - y1) * 0.12;
    const my2 = y1 + (y2 - y1) * 0.66 + (x2 - x1) * 0.08;
    line(ctx, x1, y1, mx1, my1, color, 1.9, 0.95);
    line(ctx, mx1, my1, mx2, my2, color, 1.5, 0.9);
    line(ctx, mx2, my2, x2, y2, color, 1.9, 0.95);
    line(ctx, mx1, my1, mx1 - 3, my1 - 4, color, 0.8, 0.58);
    line(ctx, mx2, my2, mx2 + 3, my2 + 4, color, 0.8, 0.58);
    ctx.restore();
  }

  function drawShamanSpiritOrbit(ctx, x, y, palette, t, pulse) {
    const time = t || 0;
    const glow = pulse || 0.4;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.55;
    ellipse(ctx, x + Math.cos(time * 2.0) * 15, y - 10 + Math.sin(time * 2.0) * 5, 3.0, 3.0, 0, palette.glow, palette.glow, 0);
    ellipse(ctx, x + Math.cos(time * 1.5 + 2.1) * 18, y + 2 + Math.sin(time * 1.7 + 2.1) * 4, 2.4, 3.6, 0, '#d7924d', '#d7924d', 0);
    ellipse(ctx, x + Math.cos(time * 1.7 + 4.3) * 12, y - 2 + Math.sin(time * 1.3 + 4.3) * 5, 2.6, 2.6, 0, '#dcd7b8', '#dcd7b8', 0);
    line(ctx, x + Math.cos(time * 2.0) * 15, y - 10 + Math.sin(time * 2.0) * 5, x + Math.cos(time * 2.0) * 18, y - 16 + Math.sin(time * 2.0) * 5, palette.glow, 0.9, 0.42 + glow * 0.2);
    ctx.restore();
  }

  function drawStormGroundRing(ctx, x, y, palette, t, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = alpha == null ? 0.18 : alpha;
    ellipse(ctx, x, y, 24, 7, 0, 'rgba(150,210,255,0.18)', palette.glow, 1.2);
    for (let i = 0; i < 5; i++) {
      const a = (t || 0) * 1.4 + i * TAU / 5;
      drawDiamond(ctx, x + Math.cos(a) * 18, y + Math.sin(a) * 4, 1.8, palette.glow, palette.glow);
    }
    ctx.restore();
  }

  function drawShamanBackDetails(ctx, rig, palette, bottom) {
    const a = rig.anchors;
    const side = rig.dir.side || 1;
    line(ctx, a.back.x - 12 * side, a.back.y - 12, a.back.x + 16 * side, a.back.y + 25, palette.belt, 3, 0.8);
    roundRect(ctx, a.back.x - 6 * side, a.back.y - 5, 14, 30, 3, palette.bootHi, palette.outline, 1.1);
    for (let i = 0; i < 3; i++) {
      line(ctx, a.back.x - 2 * side, a.back.y + 1 + i * 8, a.back.x + 3 * side, a.back.y + 1 + i * 8, palette.accentDark, 0.8, 0.7);
    }
    drawBone(ctx, a.back.x - 13 * side, a.back.y + 3, 0.42, palette);
    drawBone(ctx, a.back.x + 14 * side, a.back.y + 8, 0.42, palette);
    line(ctx, a.back.x - 17 * side, a.back.y - 5, a.back.x - 17 * side, a.back.y + 20, palette.metalDark, 0.9, 0.75);
    ellipse(ctx, a.back.x - 17 * side, a.back.y - 7, 1.6, 4.8, -0.3 * side, palette.clothHi, palette.outline, 0.4);
    ellipse(ctx, a.back.x - 19 * side, a.back.y + 1, 1.4, 4.1, -0.25 * side, palette.clothHi, palette.outline, 0.35);
    roundRect(ctx, a.back.x + 10 * side, a.back.y + 18, 7, 8, 2, palette.boot, palette.outline, 0.8);
    line(ctx, a.back.x + 13 * side, a.back.y + 14, a.back.x + 15 * side, bottom - 12, palette.metalDark, 0.8, 0.55);
  }

  function drawShamanTorsoDetails(ctx, rig, palette, topW, hemW, robeBottom, chestY) {
    const a = rig.anchors;
    const side = rig.dir.side || 1;
    roundRect(ctx, a.chest.x - 10, a.chest.y - 2, 20, 19, 3, palette.bootHi, palette.outline, 1.1);
    for (let i = -2; i <= 2; i++) {
      const yy = a.chest.y + 2 + (i + 2) * 3.4;
      line(ctx, a.chest.x - 7, yy, a.chest.x + 7, yy + 1, i % 2 === 0 ? palette.metalDark : palette.metal, 0.8, 0.7);
    }
    line(ctx, a.chest.x - 11, chestY + 3, a.pelvis.x + 10, robeBottom - 6, palette.accentDark, 2.0, 0.72);
    line(ctx, a.chest.x + 9, chestY + 6, a.pelvis.x - 9, robeBottom - 4, palette.accentDark, 1.5, 0.65);
    for (let i = 0; i < 4; i++) {
      const x = a.chest.x - 12 + i * 8;
      line(ctx, x, robeBottom - 5, x - side * 1, robeBottom + 13 + (i % 2) * 4, palette.belt, 2.0, 0.72);
      ellipse(ctx, x - side * 1, robeBottom + 14 + (i % 2) * 4, 1.6, 1.6, 0, palette.metal, palette.outline, 0.35);
    }
    for (let i = -1; i <= 1; i++) drawDiamond(ctx, a.chest.x + i * 7, a.chest.y + 6 + Math.abs(i), 2.0, i === 0 ? palette.glow : palette.accentDark, palette.outline);
  }

  function drawShamanShoulderDetails(ctx, rig, palette, w, y) {
    const a = rig.anchors;
    ellipse(ctx, a.chest.x - w * 0.52, y + 6, 11.5, 7.6, -0.12, palette.bootHi, palette.outline, 1.4);
    ellipse(ctx, a.chest.x + w * 0.54, y + 6, 11.5, 7.6, 0.12, palette.bootHi, palette.outline, 1.4);
    for (let i = -1; i <= 1; i++) {
      line(ctx, a.chest.x - 16 + i * 6, y + 8, a.chest.x - 20 + i * 6, y + 13, palette.clothHi, 0.9, 0.6);
      line(ctx, a.chest.x + 16 + i * 6, y + 8, a.chest.x + 20 + i * 6, y + 13, palette.clothHi, 0.9, 0.6);
    }
    line(ctx, a.neck.x - 9, a.neck.y - 10, a.neck.x - 13, a.neck.y - 18, palette.metalDark, 1.3, 0.82);
    line(ctx, a.neck.x + 9, a.neck.y - 10, a.neck.x + 13, a.neck.y - 18, palette.metalDark, 1.3, 0.82);
  }

  function drawShamanChestDetails(ctx, rig, palette) {
    const a = rig.anchors;
    drawFloatingCrystal(ctx, a.chest.x + 4, a.chest.y + 4, 0.72, palette.glow, palette.outline, rig.pose.t);
    drawSkullCharm(ctx, a.chest.x - 9, a.chest.y + 8, 0.48, { ...palette, accent: '#cdbb9a' });
    drawSkullCharm(ctx, a.chest.x + 12, a.chest.y + 10, 0.40, { ...palette, accent: '#d4c8ab' });
    line(ctx, a.chest.x - 12, a.chest.y - 3, a.chest.x + 12, a.chest.y - 1, palette.metalDark, 1.1, 0.72);
    drawShamanLightningArc(ctx, a.chest.x + 4, a.chest.y + 5, a.chest.x + 14, a.chest.y - 6, palette.glow, 0.22);
  }

  function drawShamanBeltGear(ctx, rig, palette, y) {
    const a = rig.anchors;
    roundRect(ctx, a.pelvis.x - 4, y - 4, 8, 8, 2, palette.bootHi, palette.outline, 0.9);
    roundRect(ctx, a.pelvis.x - 16, y + 4, 7, 8, 2, palette.boot, palette.outline, 0.8);
    ellipse(ctx, a.pelvis.x + 14, y + 8, 5, 5, 0, '#72503b', palette.outline, 0.8);
    line(ctx, a.pelvis.x + 14, y + 8, a.pelvis.x + 14, y + 12, '#c7b090', 0.8, 0.7);
    line(ctx, a.pelvis.x + 10, y + 8, a.pelvis.x + 18, y + 8, '#c7b090', 0.8, 0.7);
    line(ctx, a.pelvis.x + 7, y + 4, a.pelvis.x + 16, y + 18, palette.belt, 1.0, 0.74);
    drawDiamond(ctx, a.pelvis.x + 17, y + 19, 1.8, palette.glow, palette.outline);
  }

  function drawShamanBackHeadDetails(ctx, rig, palette) {
    const h = rig.anchors.head;
    ellipse(ctx, h.x, h.y - 2, h.rx + 3, h.ry + 3, 0, palette.hair, palette.outline, 1.1);
    line(ctx, h.x - 9, h.y - 13, h.x - 13, h.y - 20, palette.metalDark, 1.2, 0.82);
    line(ctx, h.x + 9, h.y - 13, h.x + 13, h.y - 20, palette.metalDark, 1.2, 0.82);
    ellipse(ctx, h.x - 15, h.y - 14, 1.5, 5.0, -0.35, palette.clothHi, palette.outline, 0.4);
    ellipse(ctx, h.x + 15, h.y - 12, 1.5, 5.0, 0.35, palette.clothHi, palette.outline, 0.4);
    drawFloatingCrystal(ctx, h.x, h.y - 18, 0.38, palette.glow, palette.outline, rig.pose.t);
  }

  function drawShamanHeadDetails(ctx, rig, palette) {
    const h = rig.anchors.head;
    const side = rig.dir.side || 0;
    line(ctx, h.x - h.rx + 1, h.y - 9, h.x + h.rx - 1, h.y - 9, palette.metal, 1.6, 0.85);
    line(ctx, h.x - 9, h.y - 9, h.x - 13, h.y - 18, palette.metalDark, 1.3, 0.82);
    line(ctx, h.x + 9, h.y - 9, h.x + 13, h.y - 18, palette.metalDark, 1.3, 0.82);
    ellipse(ctx, h.x - 14, h.y - 12, 1.5, 5.2, -0.35, palette.clothHi, palette.outline, 0.42);
    ellipse(ctx, h.x - 10, h.y - 15, 1.3, 4.2, -0.25, palette.clothHi, palette.outline, 0.38);
    ellipse(ctx, h.x + 14, h.y - 12, 1.5, 5.2, 0.35, palette.clothHi, palette.outline, 0.42);
    line(ctx, h.x - 7, h.y - 4, h.x - 1, h.y - 2, palette.glow, 1.0, 0.65);
    line(ctx, h.x + 1, h.y - 2, h.x + 7, h.y - 4, palette.glow, 1.0, 0.65);
    line(ctx, h.x - 11, h.y - 7, h.x - 6, h.y - 1, palette.accent, 0.9, 0.65);
    line(ctx, h.x + 11, h.y - 7, h.x + 6, h.y - 1, palette.accent, 0.9, 0.65);
    line(ctx, h.x + side * 4, h.y - 15, h.x + side * 8, h.y - 19, palette.metalDark, 0.9, 0.72);
    drawFloatingCrystal(ctx, h.x + 3 * side, h.y - 18, 0.32, palette.glow, palette.outline, rig.pose.t);
  }

  function drawShamanLowerDetails(ctx, rig, palette) {
    const a = rig.anchors;
    const left = a.pelvis.x - 10;
    const right = a.pelvis.x + 10;
    for (let i = 0; i < 5; i++) {
      const x = left + i * 5;
      line(ctx, x, a.pelvis.y + 18, x + (i % 2 ? 1 : -1), a.pelvis.y + 34 + (i % 2), palette.belt, 1.5, 0.72);
      ellipse(ctx, x + (i % 2 ? 1 : -1), a.pelvis.y + 35 + (i % 2), 1.4, 1.4, 0, palette.metal, palette.outline, 0.3);
    }
    // Leg wrap ties, drawn relative to the pelvis anchor - the same convention already used by
    // the sibling Rogue/Warden/Ranger leg-detail functions - instead of the nonexistent
    // rig.anchors.kneeLeft/kneeRight/ankleLeft/ankleRight this used to read. Those fields never
    // existed (leg joints live under rig.anchors.legs.left/right.knee/foot), so this threw on
    // every front-facing frame; drawScaledModelSafely's catch silently aborted the whole Shaman
    // model draw and fell back to the generic humanoid renderer for that frame only. Because the
    // crash only happened while front-facing (drawFrontClassDetails returns early when the back
    // is visible), the same actor alternated between the correct model and the generic fallback
    // frame to frame depending on facing - reading as a second "duplicate" model rather than what
    // it actually was: a render crash being caught and masked instead of fixed.
    const kneeY = a.pelvis.y + 24;
    const ankleY = a.pelvis.y + 40;
    const kneeLeftX = a.pelvis.x - 9;
    const kneeRightX = a.pelvis.x + 9;
    line(ctx, kneeLeftX - 2, kneeY + 4, kneeLeftX - 1, ankleY - 3, palette.belt, 1.2, 0.8);
    line(ctx, kneeRightX + 2, kneeY + 4, kneeRightX + 1, ankleY - 3, palette.belt, 1.2, 0.8);
    line(ctx, kneeLeftX - 4, kneeY + 12, kneeLeftX + 4, kneeY + 12, palette.metalDark, 0.8, 0.72);
    line(ctx, kneeRightX - 4, kneeY + 12, kneeRightX + 4, kneeY + 12, palette.metalDark, 0.8, 0.72);
  }

  function drawShamanCastingHand(ctx, x, y, palette, t, pulse) {
    ellipse(ctx, x, y, 2.5, 2.8, 0, palette.skin, palette.outline, 0.55);
    drawShamanSpiritOrbit(ctx, x + 1, y - 2, palette, t, pulse || 0.5);
    drawShamanLightningArc(ctx, x - 2, y - 1, x + 6, y - 7, palette.glow, 0.24 + (pulse || 0.5) * 0.18);
  }


  function drawSummonerBackHeadDetails(ctx, rig, palette) {
    const h = rig.anchors.head;
    const t = rig.pose.t || 0;
    line(ctx, h.x - 11, h.y - 12, h.x + 11, h.y - 12, palette.metalDark, 1.4, 0.72);
    line(ctx, h.x - 7, h.y - 16, h.x - 4, h.y - 10, palette.metalDark, 1.1, 0.72);
    line(ctx, h.x + 7, h.y - 16, h.x + 4, h.y - 10, palette.metalDark, 1.1, 0.72);
    for (let i = -1; i <= 1; i += 2) {
      line(ctx, h.x + i * 8, h.y - 10, h.x + i * 11, h.y - 2, palette.accentDark, 0.9, 0.65);
      drawDiamond(ctx, h.x + i * 11, h.y + 1 + Math.sin(t * 2 + i) * 0.5, 1.9, palette.accent, palette.outline);
    }
  }

  function drawSummonerHeadDetails(ctx, rig, palette) {
    const h = rig.anchors.head;
    const d = rig.dir;
    const t = rig.pose.t || 0;
    const side = d.side || 0;
    line(ctx, h.x - 10, h.y - 12, h.x + 10, h.y - 12, palette.metalDark, 1.4, 0.82);
    line(ctx, h.x - 7, h.y - 16, h.x - 3, h.y - 9, palette.metalDark, 1.1, 0.82);
    line(ctx, h.x + 7, h.y - 16, h.x + 3, h.y - 9, palette.metalDark, 1.1, 0.82);
    line(ctx, h.x - 5, h.y + 2, h.x + 5, h.y + 2, palette.outline, 0.9, 0.22);
    line(ctx, h.x - 7, h.y - 1, h.x - 3, h.y - 1, palette.glow, 1.0, 0.54);
    line(ctx, h.x + 2, h.y - 1, h.x + 6, h.y - 1, palette.glow, 1.0, 0.54);
    line(ctx, h.x + side * 2, h.y - 5, h.x + side * 6, h.y + 6, palette.accent, 0.85, 0.58);
    for (let i = -1; i <= 1; i += 2) {
      line(ctx, h.x + i * 8, h.y - 9, h.x + i * 11, h.y - 1, palette.accentDark, 0.9, 0.72);
      drawDiamond(ctx, h.x + i * 11, h.y + 2 + Math.sin(t * 2 + i) * 0.5, 1.9, palette.accent, palette.outline);
    }
    line(ctx, h.x - 5, h.y + 8, h.x + 4, h.y + 11, palette.accentDark, 1.0, 0.52);
  }

  function drawSummonerShoulderDetails(ctx, rig, palette, w, y) {
    const a = rig.anchors;
    const t = rig.pose.t || 0;
    poly(ctx, [
      { x: a.chest.x - w * 0.68, y: y + 4 },
      { x: a.chest.x, y: y - 3 },
      { x: a.chest.x + w * 0.70, y: y + 4 },
      { x: a.chest.x + w * 0.46, y: y + 12 },
      { x: a.chest.x - w * 0.44, y: y + 12 }
    ], palette.clothHi, palette.outline, 1.0);
    drawRuneCircle(ctx, a.chest.x, y + 8, 8 + Math.sin(t * 1.6) * 0.6, palette, 0.10);
    line(ctx, a.chest.x - w * 0.56, y + 8, a.chest.x + w * 0.56, y + 8, palette.accentDark, 1.1, 0.45);
    for (let i = -1; i <= 1; i++) {
      drawDiamond(ctx, a.chest.x + i * 8, y + 8 + (i === 0 ? -1 : 0), i === 0 ? 2.3 : 1.6, i === 0 ? palette.glow : palette.accent, palette.outline);
    }
  }

  function drawSummonerChestDetails(ctx, rig, palette) {
    const a = rig.anchors;
    const t = rig.pose.t || 0;
    line(ctx, a.chest.x - 10, a.chest.y - 2, a.pelvis.x + 8, a.pelvis.y + 11, palette.metalDark, 1.0, 0.68);
    line(ctx, a.chest.x + 8, a.chest.y - 1, a.pelvis.x - 7, a.pelvis.y + 9, palette.metalDark, 1.0, 0.68);
    roundRect(ctx, a.chest.x - 5, a.chest.y + 11, 10, 7, 1.6, palette.bootHi, palette.outline, 0.8);
    line(ctx, a.chest.x, a.chest.y + 11, a.chest.x, a.chest.y + 18, palette.accentDark, 0.9, 0.74);
    drawDiamond(ctx, a.chest.x, a.chest.y + 6, 2.7, palette.glow, palette.outline);
    for (let i = 0; i < 3; i++) {
      const x = a.chest.x + 12 + i * 4;
      const yy = a.chest.y + 1 + i * 5 + Math.sin(t * 2 + i) * 0.6;
      line(ctx, x, yy - 2, x, yy + 4, palette.metalDark, 0.8, 0.7);
      roundRect(ctx, x - 1.6, yy + 4, 3.2, 4.2, 1.0, palette.clothHi, palette.outline, 0.55);
    }
  }

  function drawSummonerBeltGear(ctx, rig, palette, y) {
    const a = rig.anchors;
    const t = rig.pose.t || 0;
    roundRect(ctx, a.pelvis.x - 15, y + 4, 9, 10, 1.6, palette.bootHi, palette.outline, 0.9);
    line(ctx, a.pelvis.x - 10.5, y + 14, a.pelvis.x - 13, y + 23, palette.metalDark, 0.9, 0.76);
    drawDiamond(ctx, a.pelvis.x - 13, y + 25, 1.8, palette.glow, palette.outline);
    roundRect(ctx, a.pelvis.x + 9, y + 4, 7, 12, 1.6, palette.boot, palette.outline, 0.9);
    line(ctx, a.pelvis.x + 12, y + 16, a.pelvis.x + 15 + Math.sin(t * 2) * 0.5, y + 25, palette.metalDark, 0.9, 0.74);
    ellipse(ctx, a.pelvis.x + 16, y + 28, 2.8, 4.4, 0, palette.metal, palette.outline, 0.7);
    roundRect(ctx, a.pelvis.x - 2, y + 6, 8, 13, 1.4, palette.clothDark, palette.outline, 0.8);
    line(ctx, a.pelvis.x + 2, y + 8, a.pelvis.x + 2, y + 18, palette.metalDark, 0.7, 0.66);
    drawDiamond(ctx, a.pelvis.x + 2, y + 12, 1.7, palette.accent, palette.outline);
  }

  function drawSummonerRobeDetails(ctx, rig, palette, topW, hemW, robeBottom, chestY) {
    const a = rig.anchors;
    const t = rig.pose.t || 0;
    line(ctx, a.chest.x - topW * 0.72, chestY + 6, a.pelvis.x - hemW * 0.46, robeBottom - 7, palette.clothHi, 0.9, 0.34);
    line(ctx, a.chest.x + topW * 0.40, chestY + 10, a.pelvis.x + hemW * 0.24, robeBottom - 11, palette.clothHi, 0.9, 0.28);
    poly(ctx, [
      { x: a.pelvis.x - 6, y: a.pelvis.y + 12 },
      { x: a.pelvis.x + 12, y: a.pelvis.y + 13 },
      { x: a.pelvis.x + 5, y: robeBottom - 10 },
      { x: a.pelvis.x - 8, y: robeBottom - 6 }
    ], 'rgba(255,255,255,0.03)', palette.outline, 0.9);
    for (let i = 0; i < 4; i++) {
      const yy = a.pelvis.y + 18 + i * 10;
      drawDiamond(ctx, a.pelvis.x + 4 + Math.sin(t * 1.4 + i) * 0.7, yy, 1.7, i % 2 ? palette.accent : palette.glow, palette.outline);
    }
    for (let i = 0; i < 3; i++) {
      const sx = a.chest.x - 11 + i * 11;
      line(ctx, sx, robeBottom - 16, sx + (i - 1), robeBottom - 4, palette.accentDark, 0.85, 0.58);
      drawDiamond(ctx, sx + (i - 1), robeBottom - 2, 1.5, palette.accent, palette.outline);
    }
  }

  function drawSummonerLowerDetails(ctx, rig, palette) {
    const a = rig.anchors;
    const t = rig.pose.t || 0;
    const hemY = a.pelvis.y + 38;
    drawDiamond(ctx, a.pelvis.x - 7, hemY - 2, 1.6, palette.accent, palette.outline);
    drawDiamond(ctx, a.pelvis.x + 8, hemY, 1.8, palette.glow, palette.outline);
    line(ctx, a.pelvis.x - 10, hemY - 8, a.pelvis.x - 14, hemY + 4 + Math.sin(t * 2) * 0.4, palette.accentDark, 0.8, 0.6);
    line(ctx, a.pelvis.x + 10, hemY - 7, a.pelvis.x + 15, hemY + 5 + Math.cos(t * 1.8) * 0.4, palette.accentDark, 0.8, 0.6);
  }



  function drawWizardBackRobeDetails(ctx, rig, palette, topW, hemW, bottom) {
    const a = rig.anchors;
    const t = rig.pose.t || 0;
    line(ctx, a.chest.x - topW * 0.55, a.chest.y - 10, a.pelvis.x - hemW * 0.58, bottom - 8, palette.silver || palette.metal, 0.75, 0.42);
    line(ctx, a.chest.x + topW * 0.55, a.chest.y - 10, a.pelvis.x + hemW * 0.58, bottom - 8, palette.silver || palette.metal, 0.75, 0.42);
    for (let i = 0; i < 5; i++) {
      const x = a.chest.x - 13 + i * 6.5;
      const y = a.pelvis.y + 8 + i * 6;
      drawStarGlyph(ctx, x + Math.sin(t * 1.2 + i) * 0.4, y, 0.34, i % 2 ? palette.silver : palette.gold, palette.outline, 0.62);
    }
    drawWizardCrescent(ctx, a.chest.x + 13, a.chest.y + 1, 0.40, palette, 0.55);
  }

  function drawWizardRobeDetails(ctx, rig, palette, topW, hemW, robeBottom, chestY) {
    const a = rig.anchors;
    const t = rig.pose.t || 0;
    line(ctx, a.chest.x - topW * 0.34, chestY + 8, a.pelvis.x - hemW * 0.24, robeBottom - 3, palette.silver || palette.metal, 0.9, 0.42);
    line(ctx, a.chest.x + topW * 0.35, chestY + 8, a.pelvis.x + hemW * 0.24, robeBottom - 4, palette.gold || palette.accent, 0.85, 0.42);
    line(ctx, a.chest.x, chestY + 8, a.pelvis.x + Math.sin(t * 1.0) * 0.7, robeBottom + 3, palette.accentDark, 1.0, 0.42);
    for (let i = 0; i < 5; i++) {
      const y = a.chest.y + 3 + i * 9;
      drawDiamond(ctx, a.chest.x - 10 + Math.sin(t * 1.25 + i) * 0.35, y, 1.25, i % 2 ? palette.silver || palette.metal : palette.gold || palette.accent, palette.outline);
      drawDiamond(ctx, a.chest.x + 10 + Math.cos(t * 1.10 + i) * 0.35, y + 1, 1.15, i % 2 ? palette.gold || palette.accent : palette.glow, palette.outline);
    }
    for (let i = 0; i < 4; i++) {
      const x = a.chest.x - 15 + i * 10;
      line(ctx, x, robeBottom - 14, x + (i - 1.5), robeBottom - 2, palette.accentDark, 0.7, 0.52);
      drawStarGlyph(ctx, x + (i - 1.5), robeBottom, 0.25, palette.silver || palette.metal, palette.outline, 0.55);
    }
    for (let i = -2; i <= 2; i++) {
      line(ctx, a.pelvis.x + i * 7, robeBottom - 5, a.pelvis.x + i * 7 + Math.sin(i) * 2, robeBottom + 1, i % 2 ? palette.bootHi : palette.fire || palette.accent, 0.55, 0.44);
    }
  }

  function drawWizardShoulderDetails(ctx, rig, palette, w, y) {
    const a = rig.anchors;
    const t = rig.pose.t || 0;
    line(ctx, a.chest.x - w * 0.56, y + 11, a.chest.x + w * 0.56, y + 11, palette.silver || palette.metal, 1.0, 0.52);
    for (let i = -2; i <= 2; i++) {
      const x = a.chest.x + i * 7.2;
      drawStarGlyph(ctx, x, y + 8 + Math.sin(t * 1.6 + i) * 0.45, i === 0 ? 0.43 : 0.29, i === 0 ? palette.glow : palette.gold || palette.accent, palette.outline, 0.62);
    }
    drawElementGlyph(ctx, a.chest.x - w * 0.42, y + 12, 0.36, 'fire', palette, 0.58);
    drawElementGlyph(ctx, a.chest.x + w * 0.42, y + 12, 0.36, 'frost', palette, 0.58);
  }

  function drawWizardChestDetails(ctx, rig, palette) {
    const a = rig.anchors;
    const t = rig.pose.t || 0;
    roundRect(ctx, a.chest.x - 8, a.chest.y + 8, 16, 9, 2, palette.clothDark, palette.outline, 0.8);
    drawStarGlyph(ctx, a.chest.x, a.chest.y + 12.5, 0.42, palette.glow, palette.outline, 0.78);
    line(ctx, a.chest.x - 12, a.chest.y - 1, a.pelvis.x + 9, a.pelvis.y + 11, palette.belt, 1.0, 0.60);
    line(ctx, a.chest.x + 11, a.chest.y - 1, a.pelvis.x - 8, a.pelvis.y + 10, palette.belt, 1.0, 0.56);
    for (let i = 0; i < 3; i++) {
      drawDiamond(ctx, a.chest.x - 6 + i * 6, a.chest.y + 19 + Math.sin(t * 1.8 + i) * 0.35, 1.25, i === 1 ? palette.glow : palette.silver || palette.metal, palette.outline);
    }
  }

  function drawWizardBeltGear(ctx, rig, palette, y) {
    const a = rig.anchors;
    const t = rig.pose.t || 0;
    line(ctx, a.pelvis.x - 18, y - 1, a.pelvis.x + 18, y + 4, palette.belt, 3.2, 0.92);
    roundRect(ctx, a.pelvis.x - 5, y - 4, 10, 9, 2, palette.gold || palette.accent, palette.outline, 0.9);
    drawBookGlyph(ctx, a.pelvis.x, y + 0.5, 0.42, palette, 0.78);
    roundRect(ctx, a.pelvis.x - 21, y + 2, 8, 12, 1.6, palette.bootHi, palette.outline, 0.8);
    line(ctx, a.pelvis.x - 17, y + 14, a.pelvis.x - 18, y + 22, palette.metalDark, 0.7, 0.58);
    drawScrollCase(ctx, a.pelvis.x + 17, y + 12, 0.52, palette, 0.84);
    ellipse(ctx, a.pelvis.x + 25, y + 17 + Math.sin(t * 1.6) * 0.4, 2.4, 4.0, 0, palette.glow, palette.outline, 0.62);
    for (let i = 0; i < 3; i++) {
      line(ctx, a.pelvis.x + 9 + i * 2.5, y + 6, a.pelvis.x + 10 + i * 2.5, y + 15, palette.metal, 0.55, 0.5);
      ellipse(ctx, a.pelvis.x + 10 + i * 2.5, y + 16, 1.0, 1.0, 0, palette.silver || palette.metal, palette.outline, 0.25);
    }
  }

  function drawWizardBackHeadDetails(ctx, rig, palette) {
    const h = rig.anchors.head;
    const t = rig.pose.t || 0;
    ellipse(ctx, h.x, h.y - 1, h.rx + 1, h.ry + 2, 0, palette.hair, palette.outline, 1.3);
    drawWizardHat(ctx, h.x, h.y - 13, 1.0, palette, t, 0.90, rig.dir?.side || 0);
    line(ctx, h.x - 7, h.y + 4, h.x + 7, h.y + 4, palette.hairHi || palette.silver, 0.8, 0.45);
  }

  function drawWizardHeadDetails(ctx, rig, palette) {
    const h = rig.anchors.head;
    const side = rig.dir?.side || 0;
    const t = rig.pose.t || 0;
    drawWizardHat(ctx, h.x + side * 0.5, h.y - 13, 1.0, palette, t, 1, side);
    ellipse(ctx, h.x - 4, h.y - 2, 3.1, 2.0, 0, 'rgba(170,210,255,0.18)', palette.metalDark, 0.65);
    ellipse(ctx, h.x + 4, h.y - 2, 3.1, 2.0, 0, 'rgba(170,210,255,0.16)', palette.metalDark, 0.65);
    line(ctx, h.x - 1, h.y - 2, h.x + 1, h.y - 2, palette.metalDark, 0.65, 0.8);
    line(ctx, h.x - 6, h.y - 2, h.x - 3, h.y - 2, palette.glow, 0.85, 0.50);
    line(ctx, h.x + 3, h.y - 2, h.x + 6, h.y - 2, palette.arcane || palette.glow, 0.85, 0.50);
    line(ctx, h.x - 7, h.y + 7, h.x + 5, h.y + 8, palette.hairHi || palette.silver, 0.75, 0.42);
  }

  function drawWizardHat(ctx, x, y, scale, palette, t, alpha = 1, side = 0) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ellipse(ctx, side * 1.2, 3.5, 18.5, 4.5, 0.03 * side, palette.clothDark, palette.outline, 1.25);
    poly(ctx, [
      { x: -8.0 + side * 1.5, y: 2.5 },
      { x: -4.5 + side * 0.6, y: -18.5 },
      { x: 1.0 + side * 1.2, y: -27.0 },
      { x: 5.3 + side * 2.0, y: -13.0 },
      { x: 8.8 + side * 1.4, y: 2.3 }
    ], palette.cloth, palette.outline, 1.35);
    line(ctx, -7.4, -1.0, 8.2, -0.3, palette.silver || palette.metal, 1.1, 0.72);
    for (let i = -2; i <= 2; i++) {
      drawStarGlyph(ctx, i * 3.5 + Math.sin(t * 1.3 + i) * 0.2, -3.2 - Math.abs(i) * 1.2, 0.18, i % 2 ? palette.gold : palette.silver || palette.metal, palette.outline, 0.60);
    }
    ctx.restore();
  }

  function drawWizardLowerDetails(ctx, rig, palette) {
    const a = rig.anchors;
    const hemY = a.pelvis.y + 45;
    line(ctx, a.pelvis.x - 17, hemY - 5, a.pelvis.x + 16, hemY - 4, palette.silver || palette.metal, 0.72, 0.46);
    drawStarGlyph(ctx, a.pelvis.x - 10, hemY - 1, 0.26, palette.gold || palette.accent, palette.outline, 0.62);
    drawStarGlyph(ctx, a.pelvis.x + 9, hemY - 1, 0.26, palette.glow, palette.outline, 0.62);
    roundRect(ctx, a.pelvis.x - 13, hemY + 4, 7, 4, 1.2, palette.boot, palette.outline, 0.6);
    roundRect(ctx, a.pelvis.x + 6, hemY + 4, 7, 4, 1.2, palette.boot, palette.outline, 0.6);
  }

  function drawWizardStaff(ctx, x, y, rot, scale, palette, alpha, t = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.globalAlpha *= alpha;
    line(ctx, 1.5, 25, -1.5, -34, palette.outline, 4.2, 0.98);
    line(ctx, 0, 25, -2.0, -34, '#2f2219', 2.3, 0.98);
    line(ctx, 1.2, 18, -1.0, -26, palette.silver || palette.metal, 0.62, 0.42);
    roundRect(ctx, -4.6, 4, 8.2, 12, 1.8, palette.belt, palette.outline, 0.8);
    for (let i = 0; i < 3; i++) line(ctx, -4.0, 6 + i * 3, 3.5, 5 + i * 3, palette.gold || palette.accent, 0.55, 0.65);
    ellipse(ctx, -2, -38, 8.4, 10.2, 0, 'rgba(145,202,255,0.18)', palette.silver || palette.metal, 1.1);
    for (let i = 0; i < 4; i++) {
      const ang = i * Math.PI / 2 + Math.sin(t * 1.2) * 0.03;
      line(ctx, -2 + Math.cos(ang) * 8.0, -38 + Math.sin(ang) * 9.3, -2, -38, palette.silver || palette.metal, 0.65, 0.60);
    }
    drawDiamond(ctx, -2, -38 + Math.sin(t * 2.0) * 0.7, 5.0, palette.glow, palette.outline);
    drawScrollRibbon(ctx, -8, -13, 0.46, palette, 0.72);
    drawCrystalDrop(ctx, 6.5, -18 + Math.sin(t * 1.7) * 0.8, 0.34, palette, 0.72);
    ctx.restore();
  }

  function drawWizardCastingHand(ctx, x, y, palette, t, amount) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.22 + amount * 0.30;
    ellipse(ctx, x, y, 8 + amount * 6, 8 + amount * 6, 0, palette.glow, palette.glow, 0);
    for (let i = 0; i < 8; i++) {
      const ang = t * 1.6 + i * TAU / 8;
      line(ctx, x + Math.cos(ang) * 3, y + Math.sin(ang) * 3, x + Math.cos(ang) * (10 + amount * 7), y + Math.sin(ang) * (10 + amount * 7), i % 3 === 0 ? palette.fire : i % 3 === 1 ? palette.frost : palette.arcane, 0.75, 0.48);
    }
    ctx.restore();
    drawDiamond(ctx, x, y, 2.4 + amount * 0.8, palette.glow, palette.outline);
  }

  function drawWizardGrimoire(ctx, x, y, scale, palette, t, alpha = 1, opts = {}) {
    const s = scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.10 + Math.sin(t * 1.2) * 0.03);
    ctx.scale(s, s);
    ctx.globalAlpha *= alpha;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha *= 0.22;
    ellipse(ctx, 0, 0, 19, 10, 0, palette.glow, palette.glow, 0);
    ctx.restore();
    roundRect(ctx, -16, -12, 32, 24, 3, '#1b1621', palette.outline, 1.5);
    roundRect(ctx, -14, -10, 28, 20, 2, palette.clothDark, palette.metalDark, 0.9);
    for (let i = -1; i <= 1; i++) roundRect(ctx, -17 + i * 15, -13, 4, 26, 1, palette.metalDark, palette.outline, 0.5);
    line(ctx, -10, -9, -10, 10, palette.gold || palette.accent, 0.9, 0.52);
    line(ctx, 10, -9, 10, 10, palette.gold || palette.accent, 0.9, 0.52);
    drawStarGlyph(ctx, 0, 0, 0.52, palette.glow, palette.outline, 0.82);
    for (let i = 0; i < 3; i++) line(ctx, -4 + i * 3, 12, -5 + i * 3 + Math.sin(t + i), 19, i === 1 ? palette.fire : palette.accent, 0.8, 0.68);
    if (opts.chainSide) for (let i = 0; i < 6; i++) ellipse(ctx, 16 + opts.chainSide * i * 2.2, 8 + i * 2.0, 1.3, 0.8, 0.3, 'transparent', palette.metal, 0.55);
    line(ctx, 16, -16, 27, -25 + Math.sin(t * 1.4) * 1.2, palette.silver || palette.metal, 0.85, 0.74);
    line(ctx, 22, -21, 29, -24, palette.hairHi || palette.silver, 1.2, 0.65);
    ctx.restore();
  }

  function drawWizardElementalOrbs(ctx, x, y, palette, t, amount) {
    const specs = [
      { a: t * 0.80, r: 25, color: palette.fire || '#ff8a3d', kind: 'fire' },
      { a: t * 0.80 + TAU / 3, r: 27, color: palette.frost || '#9edfff', kind: 'frost' },
      { a: t * 0.80 + TAU * 2 / 3, r: 24, color: palette.arcane || '#b58cff', kind: 'arcane' }
    ];
    for (const spec of specs) {
      const ox = x + Math.cos(spec.a) * spec.r;
      const oy = y + Math.sin(spec.a) * 6 - 8 - Math.sin(t * 1.3 + spec.r) * 1.2;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.18 + amount * 0.20;
      ellipse(ctx, ox, oy, 7.5, 7.5, 0, spec.color, spec.color, 0);
      ctx.restore();
      ellipse(ctx, ox, oy, 3.6, 3.6, 0, spec.color, palette.outline, 0.55);
      drawElementGlyph(ctx, ox, oy, 0.34, spec.kind, palette, 0.68);
    }
  }

  function drawWizardArcaneCast(ctx, rig, palette, amount) {
    const a = rig.anchors;
    const t = rig.pose.t || 0;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.18 + amount * 0.24;
    drawRuneCircle(ctx, a.chest.x, a.chest.y + 5, 22 + amount * 8, palette, 0.32);
    for (let i = 0; i < 9; i++) {
      const ang = t * 1.2 + i * TAU / 9;
      drawDiamond(ctx, a.chest.x + Math.cos(ang) * (16 + amount * 5), a.chest.y + 5 + Math.sin(ang) * (8 + amount * 2), 1.0 + amount * 0.4, i % 3 === 0 ? palette.fire : i % 3 === 1 ? palette.frost : palette.arcane, palette.glow);
    }
    ctx.restore();
  }

  function drawStarGlyph(ctx, x, y, scale, fill, stroke, alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    const s = scale * 5;
    line(ctx, x - s, y, x + s, y, fill, Math.max(0.45, scale * 1.3), 0.8);
    line(ctx, x, y - s, x, y + s, fill, Math.max(0.45, scale * 1.3), 0.8);
    line(ctx, x - s * 0.55, y - s * 0.55, x + s * 0.55, y + s * 0.55, stroke || fill, Math.max(0.35, scale * 0.9), 0.42);
    line(ctx, x - s * 0.55, y + s * 0.55, x + s * 0.55, y - s * 0.55, stroke || fill, Math.max(0.35, scale * 0.9), 0.42);
    ctx.restore();
  }

  function drawElementGlyph(ctx, x, y, scale, kind, palette, alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    const color = kind === 'fire' ? (palette.fire || palette.accent) : kind === 'frost' ? (palette.frost || palette.glow) : (palette.arcane || palette.glow);
    if (kind === 'fire') {
      poly(ctx, [{ x: 0, y: -6 }, { x: 5, y: 5 }, { x: 0, y: 3 }, { x: -5, y: 5 }], color, palette.outline, 1.0);
    } else if (kind === 'frost') {
      line(ctx, -6, 0, 6, 0, color, 1.2, 0.9);
      line(ctx, 0, -6, 0, 6, color, 1.2, 0.9);
      line(ctx, -4, -4, 4, 4, color, 0.8, 0.65);
      line(ctx, -4, 4, 4, -4, color, 0.8, 0.65);
    } else {
      drawDiamond(ctx, 0, 0, 5, color, palette.outline);
      line(ctx, -4, -4, 4, 4, palette.glow, 0.7, 0.58);
    }
    ctx.restore();
  }

  function drawBookGlyph(ctx, x, y, scale, palette, alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    roundRect(ctx, -6, -4, 5.5, 8, 1, palette.clothDark, palette.outline, 0.8);
    roundRect(ctx, 0.5, -4, 5.5, 8, 1, palette.clothDark, palette.outline, 0.8);
    line(ctx, 0, -4, 0, 4, palette.silver || palette.metal, 0.65, 0.8);
    ctx.restore();
  }

  function drawWizardCrescent(ctx, x, y, scale, palette, alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ellipse(ctx, x, y, 5 * scale, 6 * scale, 0, palette.silver || palette.metal, palette.outline, 0.4);
    ellipse(ctx, x + 2.0 * scale, y - 0.5 * scale, 4.5 * scale, 5.5 * scale, 0, palette.clothDark, null, 0);
    ctx.restore();
  }

  function drawScrollCase(ctx, x, y, scale, palette, alpha = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha *= alpha;
    roundRect(ctx, -4, -10, 8, 20, 3, '#c8b07a', palette.outline, 0.8);
    line(ctx, -5, -6, 5, -6, palette.gold || palette.accent, 0.75, 0.65);
    line(ctx, -5, 6, 5, 6, palette.gold || palette.accent, 0.75, 0.65);
    ctx.restore();
  }

  function drawScrollRibbon(ctx, x, y, scale, palette, alpha = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha *= alpha;
    roundRect(ctx, -5, -2, 11, 4, 1, '#cbbd94', palette.outline, 0.55);
    line(ctx, -3, 3, -6, 8, palette.accentDark, 0.7, 0.55);
    line(ctx, 4, 3, 7, 8, palette.accentDark, 0.7, 0.55);
    ctx.restore();
  }

  function drawCrystalDrop(ctx, x, y, scale, palette, alpha = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha *= alpha;
    poly(ctx, [{ x: 0, y: -6 }, { x: 5, y: 0 }, { x: 0, y: 8 }, { x: -5, y: 0 }], palette.glow, palette.outline, 0.8);
    ctx.restore();
  }

  function drawEnchanterBackHeadDetails(ctx, rig, palette) {
    const h = rig.anchors.head;
    const t = rig.pose.t || 0;
    line(ctx, h.x - 10, h.y - 12, h.x + 10, h.y - 12, palette.metalDark, 1.1, 0.72);
    for (let i = -1; i <= 1; i += 2) {
      const ox = h.x + i * (10 + Math.sin(t * 1.5) * 0.6);
      drawDiamond(ctx, ox, h.y - 15 + i, 1.7, palette.accent, palette.outline);
      line(ctx, h.x + i * 6, h.y - 11, ox, h.y - 15 + i, palette.metalDark, 0.75, 0.62);
    }
  }

  function drawEnchanterHeadDetails(ctx, rig, palette) {
    const h = rig.anchors.head;
    const d = rig.dir;
    const side = d.side || 0;
    const t = rig.pose.t || 0;
    line(ctx, h.x - h.rx + 3, h.y - 12, h.x + h.rx - 3, h.y - 12, palette.metalDark, 1.1, 0.72);
    drawDiamond(ctx, h.x + side * 2, h.y - 13.5, 2.0, palette.glow, palette.outline);
    for (let i = -1; i <= 1; i += 2) {
      const ox = h.x + i * (10 + Math.sin(t * 1.7 + i) * 0.8);
      drawDiamond(ctx, ox, h.y - 16 + i, 1.6, palette.accent, palette.outline);
      line(ctx, h.x + i * 5, h.y - 12, ox, h.y - 16 + i, palette.metalDark, 0.7, 0.62);
    }
    line(ctx, h.x - 6, h.y - 2, h.x - 2, h.y - 2, palette.glow, 0.9, 0.46);
    line(ctx, h.x + 2, h.y - 2, h.x + 6, h.y - 2, palette.glow, 0.9, 0.46);
    line(ctx, h.x + side * 2, h.y - 5, h.x + side * 6, h.y + 5, palette.accent, 0.7, 0.48);
    line(ctx, h.x - 8, h.y + 6, h.x - 4, h.y + 9, palette.hairHi || palette.accent, 0.8, 0.45);
  }

  function drawEnchanterShoulderDetails(ctx, rig, palette, w, y) {
    const a = rig.anchors;
    const t = rig.pose.t || 0;
    poly(ctx, [
      { x: a.chest.x - w * 0.50, y: y + 7 },
      { x: a.chest.x - w * 0.20, y: y + 2 },
      { x: a.chest.x + w * 0.52, y: y + 7 },
      { x: a.chest.x + w * 0.34, y: y + 13 },
      { x: a.chest.x - w * 0.34, y: y + 13 }
    ], palette.clothHi, palette.outline, 0.9);
    line(ctx, a.chest.x - w * 0.44, y + 10, a.chest.x + w * 0.44, y + 10, palette.accentDark, 1.0, 0.46);
    for (let i = -1; i <= 1; i++) drawDiamond(ctx, a.chest.x + i * 8, y + 8 + Math.sin(t * 1.8 + i) * 0.4, i === 0 ? 2.1 : 1.4, i === 0 ? palette.glow : palette.accent, palette.outline);
  }

  function drawEnchanterChestDetails(ctx, rig, palette) {
    const a = rig.anchors;
    const t = rig.pose.t || 0;
    roundRect(ctx, a.chest.x - 10, a.chest.y + 13, 20, 8, 1.8, palette.belt, palette.outline, 0.8);
    line(ctx, a.chest.x - 8, a.chest.y + 15, a.chest.x + 8, a.chest.y + 15, palette.metalDark, 0.8, 0.56);
    for (let i = 0; i < 3; i++) {
      const x = a.chest.x - 6 + i * 6;
      drawDiamond(ctx, x, a.chest.y + 19 + Math.sin(t * 2 + i) * 0.3, 1.4, i === 1 ? palette.glow : palette.accent, palette.outline);
    }
    line(ctx, a.chest.x - 12, a.chest.y - 2, a.pelvis.x + 8, a.pelvis.y + 12, palette.metalDark, 0.9, 0.62);
    line(ctx, a.chest.x + 10, a.chest.y - 1, a.pelvis.x - 8, a.pelvis.y + 10, palette.metalDark, 0.9, 0.62);
    drawDiamond(ctx, a.chest.x, a.chest.y + 5, 2.3, palette.glow, palette.outline);
  }

  function drawEnchanterBeltGear(ctx, rig, palette, y) {
    const a = rig.anchors;
    const t = rig.pose.t || 0;
    roundRect(ctx, a.pelvis.x - 16, y + 3, 8, 10, 1.5, palette.bootHi, palette.outline, 0.85);
    line(ctx, a.pelvis.x - 12, y + 13, a.pelvis.x - 14, y + 21, palette.metalDark, 0.8, 0.7);
    drawDiamond(ctx, a.pelvis.x - 14, y + 23, 1.5, palette.accent, palette.outline);
    roundRect(ctx, a.pelvis.x + 10, y + 2, 7, 12, 1.4, palette.clothDark, palette.outline, 0.8);
    line(ctx, a.pelvis.x + 13, y + 14, a.pelvis.x + 17 + Math.sin(t * 1.6) * 0.4, y + 22, palette.metalDark, 0.8, 0.66);
    ellipse(ctx, a.pelvis.x + 18, y + 24, 2.6, 3.6, 0, palette.glow, palette.outline, 0.65);
    for (let i = 0; i < 3; i++) roundRect(ctx, a.pelvis.x - 3 + i * 4, y + 8 + i, 2.8, 5.2, 0.7, i === 1 ? palette.glow : palette.accent, palette.outline, 0.45);
  }

  function drawEnchanterRobeDetails(ctx, rig, palette, topW, hemW, robeBottom, chestY) {
    const a = rig.anchors;
    const t = rig.pose.t || 0;
    line(ctx, a.chest.x - topW * 0.52, chestY + 8, a.pelvis.x - hemW * 0.44, robeBottom - 8, palette.clothHi, 0.85, 0.30);
    line(ctx, a.chest.x + topW * 0.45, chestY + 7, a.pelvis.x + hemW * 0.30, robeBottom - 9, palette.clothHi, 0.85, 0.30);
    poly(ctx, [
      { x: a.pelvis.x - 5, y: a.pelvis.y + 12 },
      { x: a.pelvis.x + 10, y: a.pelvis.y + 14 },
      { x: a.pelvis.x + 5, y: robeBottom - 7 },
      { x: a.pelvis.x - 8, y: robeBottom - 5 }
    ], 'rgba(255,255,255,0.035)', palette.outline, 0.8);
    for (let i = 0; i < 4; i++) {
      const yy = a.pelvis.y + 17 + i * 9;
      drawDiamond(ctx, a.pelvis.x + 3 + Math.sin(t * 1.3 + i) * 0.5, yy, 1.4, i % 2 ? palette.accent : palette.glow, palette.outline);
    }
    for (let i = 0; i < 3; i++) {
      const sx = a.chest.x - 12 + i * 10;
      line(ctx, sx, robeBottom - 13, sx + (i - 1), robeBottom - 3, palette.accentDark, 0.75, 0.52);
      drawDiamond(ctx, sx + (i - 1), robeBottom - 1, 1.25, palette.accent, palette.outline);
    }
  }

  function drawEnchanterLowerDetails(ctx, rig, palette) {
    const a = rig.anchors;
    const hemY = a.pelvis.y + 37;
    line(ctx, a.pelvis.x - 13, hemY - 5, a.pelvis.x + 13, hemY - 3, palette.accentDark, 0.75, 0.46);
    drawDiamond(ctx, a.pelvis.x - 8, hemY - 1, 1.3, palette.accent, palette.outline);
    drawDiamond(ctx, a.pelvis.x + 8, hemY - 1, 1.3, palette.glow, palette.outline);
  }


  function drawClericHighDetailOverlay(ctx, rig, palette, profile) {
    if (!rig || !rig.anchors || rig.pose?.action === 'death') return;
    const a = rig.anchors;
    const d = rig.dir || {};
    const p = rig.pose || {};
    const side = d.side || d.nearSide || 1;
    const pulse = p.blessingPulse || p.identityPulse || 0.4;
    const back = !!d.backVisible;

    // Heavy breastplate and tabard read: armored battle-priest, not a fragile robe caster.
    if (!back) {
      const chestTop = a.chest.y - 10;
      const beltY = a.belt.y + 4;
      poly(ctx, [
        { x: a.chest.x - 17, y: chestTop },
        { x: a.chest.x + 17, y: chestTop },
        { x: a.pelvis.x + 13, y: beltY + 5 },
        { x: a.pelvis.x + 3, y: beltY + 13 },
        { x: a.pelvis.x - 4, y: beltY + 13 },
        { x: a.pelvis.x - 13, y: beltY + 5 }
      ], 'rgba(218,216,206,0.72)', palette.outline, 1.2);
      line(ctx, a.chest.x - 13, chestTop + 4, a.pelvis.x - 8, beltY + 8, 'rgba(255,255,255,0.42)', 0.85, 0.58);
      line(ctx, a.chest.x + 13, chestTop + 4, a.pelvis.x + 8, beltY + 8, palette.metalDark, 0.9, 0.50);
      drawCross(ctx, a.chest.x, a.chest.y + 4, 0.50, palette.glow, palette.outline);
      ellipse(ctx, a.chest.x, a.chest.y + 4, 12 + pulse * 2, 7 + pulse, 0, 'rgba(255,242,168,0.10)', palette.glow, 0.65);

      // Front tabard panel with embroidered trim and campaign wear.
      poly(ctx, [
        { x: a.pelvis.x - 8, y: beltY + 7 },
        { x: a.pelvis.x + 8, y: beltY + 7 },
        { x: a.pelvis.x + 6, y: a.pelvis.y + 42 },
        { x: a.pelvis.x, y: a.pelvis.y + 47 },
        { x: a.pelvis.x - 7, y: a.pelvis.y + 42 }
      ], 'rgba(241,234,208,0.72)', palette.outline, 0.75);
      line(ctx, a.pelvis.x - 5, beltY + 10, a.pelvis.x - 6, a.pelvis.y + 40, palette.accent, 0.85, 0.58);
      line(ctx, a.pelvis.x + 5, beltY + 10, a.pelvis.x + 5, a.pelvis.y + 40, palette.accent, 0.85, 0.58);
      for (let i = 0; i < 3; i++) drawDiamond(ctx, a.pelvis.x, a.pelvis.y + 19 + i * 8, 1.2, i === 1 ? palette.glow : palette.accent, palette.outline);
    } else {
      // Backplate spine channel and devotional text strokes.
      line(ctx, a.chest.x, a.chest.y - 9, a.pelvis.x, a.pelvis.y + 30, palette.metalDark, 1.2, 0.46);
      for (let i = 0; i < 4; i++) line(ctx, a.chest.x - 8 + i * 5, a.chest.y + 0 + i * 7, a.chest.x - 5 + i * 5, a.chest.y + 2 + i * 7, palette.accent, 0.55, 0.36);
    }

    // Asymmetric plate pauldrons over the existing mantle.
    const shoulderY = a.chest.y - 15;
    ellipse(ctx, a.chest.x - 20, shoulderY + 3, 10.8, 6.5, -0.18, palette.metal, palette.outline, 1.0);
    ellipse(ctx, a.chest.x + 20, shoulderY + 4, 9.4, 5.7, 0.18, palette.metalDark, palette.outline, 1.0);
    line(ctx, a.chest.x - 27, shoulderY + 4, a.chest.x - 14, shoulderY + 4, palette.accent, 0.9, 0.56);
    line(ctx, a.chest.x + 14, shoulderY + 5, a.chest.x + 25, shoulderY + 5, palette.accent, 0.8, 0.46);
    drawDiamond(ctx, a.chest.x - 20, shoulderY + 2, 1.6, palette.glow, palette.outline);
    drawDiamond(ctx, a.chest.x + 20, shoulderY + 3, 1.35, palette.accent, palette.outline);

    // Shield face around off-hand: large holy profile with boss, rim, scripture/gouge detail.
    if (!back) {
      const oh = a.offHand || { x: -18 * side, y: -24 };
      const sx = oh.x - side * 6;
      const sy = oh.y - 6;
      ellipse(ctx, sx, sy + 5, 11.5, 15.5, -0.07 * side, 'rgba(218,216,206,0.78)', palette.outline, 1.15);
      ellipse(ctx, sx, sy + 4, 5.1, 5.1, 0, palette.accentDark, palette.outline, 0.8);
      drawCross(ctx, sx, sy + 4, 0.34, palette.glow, palette.outline);
      line(ctx, sx - 7, sy - 4, sx + 7, sy + 12, palette.metalDark, 0.75, 0.42);
      line(ctx, sx - 8, sy + 13, sx + 7, sy - 6, palette.accent, 0.55, 0.34);
    }

    // Mace/warhammer head detail near main hand, layered on top of existing mace draw.
    if (!back) {
      const mh = a.mainHand || { x: 20 * side, y: -24 };
      const mx = mh.x + side * 2;
      const my = mh.y - 19 - (p.action === 'cast' ? p.castPulse * 4 : 0);
      roundRect(ctx, mx - 3, my - 4, 6, 8, 1.4, palette.metalDark, palette.outline, 0.8);
      for (let i = -1; i <= 1; i++) line(ctx, mx + i * 3.1, my - 5, mx + i * 3.1, my + 5, palette.metal, 0.75, 0.70);
      line(ctx, mx - 6, my + 1, mx + 6, my + 1, palette.accent, 0.75, 0.54);
      drawDiamond(ctx, mx, my - 7, 1.6, palette.glow, palette.outline);
    }

    // Belt relics, prayer book, rosary, reliquary and field-healer pouch.
    const beltY = a.belt.y + 6;
    roundRect(ctx, a.pelvis.x - 20, beltY - 2, 40, 5, 2, palette.belt, palette.outline, 0.8);
    drawDiamond(ctx, a.pelvis.x, beltY, 3.3, palette.glow, palette.outline);
    roundRect(ctx, a.pelvis.x - 18, beltY + 4, 7, 10, 1.4, palette.bootHi, palette.outline, 0.65);
    roundRect(ctx, a.pelvis.x + 12, beltY + 3, 8, 11, 1.5, palette.clothHi, palette.outline, 0.65);
    drawCross(ctx, a.pelvis.x + 16, beltY + 8, 0.23, palette.accent, palette.outline);
    for (let i = 0; i < 5; i++) ellipse(ctx, a.pelvis.x - 6 + i * 2.6, beltY + 9 + Math.sin((p.t || 0) * 1.4 + i) * 0.3, 1.1, 1.1, 0, palette.accentDark, palette.outline, 0.35);
    line(ctx, a.pelvis.x + 5, beltY + 7, a.pelvis.x + 10, beltY + 18, palette.metalDark, 0.65, 0.56);
    drawDiamond(ctx, a.pelvis.x + 11, beltY + 20, 1.5, palette.glow, palette.outline);

    // Helm/face faith mark overlay: military-practical cleric read without replacing the head.
    const h = a.head;
    if (!back && h) {
      line(ctx, h.x - h.rx + 2, h.y - 8, h.x + h.rx - 2, h.y - 8, palette.metalDark, 1.1, 0.55);
      drawDiamond(ctx, h.x, h.y - 9.5, 1.3, palette.glow, palette.outline);
      line(ctx, h.x - 4, h.y - 1, h.x - 1, h.y - 1, palette.glow, 0.65, 0.34);
      line(ctx, h.x + 1, h.y - 1, h.x + 4, h.y - 1, palette.glow, 0.65, 0.34);
      line(ctx, h.x + (d.side || 0) * 2, h.y + 2, h.x + (d.side || 0) * 5, h.y + 8, palette.accentDark, 0.55, 0.44);
    }

    // Sabaton / greave hints below robe edges.
    const leftFoot = a.legs?.left?.foot || { x: a.pelvis.x - 8, y: a.pelvis.y + 44 };
    const rightFoot = a.legs?.right?.foot || { x: a.pelvis.x + 8, y: a.pelvis.y + 44 };
    for (const foot of [leftFoot, rightFoot]) {
      ellipse(ctx, foot.x, foot.y - 1, 5.6, 2.6, 0, palette.metalDark, palette.outline, 0.55);
      line(ctx, foot.x - 4, foot.y - 2, foot.x + 4, foot.y - 2, palette.metal, 0.55, 0.48);
    }
  }

  function drawNecromancerBackHeadDetails(ctx, rig, palette) {
    const h = rig.anchors.head;
    const t = rig.pose.t || 0;
    line(ctx, h.x - 8, h.y - 14, h.x + 8, h.y - 14, palette.accentDark, 1.0, 0.72);
    drawBone(ctx, h.x - 8, h.y - 17, 0.28, palette);
    drawBone(ctx, h.x + 8, h.y - 17, 0.28, palette);
    line(ctx, h.x - 5, h.y - 13, h.x - 10, h.y - 4, palette.accentDark, 0.7, 0.6);
    line(ctx, h.x + 5, h.y - 13, h.x + 10, h.y - 4, palette.accentDark, 0.7, 0.6);
    drawDiamond(ctx, h.x, h.y - 18 + Math.sin(t * 1.5) * 0.5, 1.5, palette.glow, palette.outline);
  }

  function drawNecromancerHeadDetails(ctx, rig, palette) {
    const h = rig.anchors.head;
    const side = rig.dir.side || 0;
    const t = rig.pose.t || 0;
    line(ctx, h.x - h.rx + 2, h.y - 11, h.x + h.rx - 2, h.y - 11, palette.accentDark, 1.0, 0.74);
    drawDiamond(ctx, h.x + side * 1.5, h.y - 13.5, 1.7, palette.glow, palette.outline);
    line(ctx, h.x - 4.5, h.y - 1.5, h.x - 1.5, h.y - 1.5, palette.glow, 0.85, 0.52);
    line(ctx, h.x + 1.5, h.y - 1.5, h.x + 4.5, h.y - 1.5, palette.glow, 0.85, 0.52);
    line(ctx, h.x - 4, h.y + 2, h.x + 4, h.y + 3.5, palette.accentDark, 0.8, 0.42);
    line(ctx, h.x + side * 1.5, h.y - 4.5, h.x + side * 4.5, h.y + 7, palette.accent, 0.75, 0.42);
    drawBone(ctx, h.x - 10, h.y - 14, 0.22, palette);
    drawBone(ctx, h.x + 10, h.y - 14, 0.22, palette);
    drawDiamond(ctx, h.x, h.y + 8 + Math.sin(t * 1.3) * 0.3, 1.2, palette.accent, palette.outline);
  }

  function drawNecromancerShoulderDetails(ctx, rig, palette, w, y) {
    const a = rig.anchors;
    poly(ctx, [
      { x: a.chest.x - w * 0.62, y: y + 6 },
      { x: a.chest.x - w * 0.40, y: y - 2 },
      { x: a.chest.x + w * 0.64, y: y + 6 },
      { x: a.chest.x + w * 0.48, y: y + 12 },
      { x: a.chest.x - w * 0.48, y: y + 12 }
    ], 'rgba(255,255,255,0.03)', palette.outline, 0.9);
    line(ctx, a.chest.x - w * 0.52, y + 8, a.chest.x + w * 0.52, y + 8, palette.accentDark, 0.95, 0.52);
    drawBone(ctx, a.chest.x - w * 0.35, y + 8, 0.24, palette);
    drawBone(ctx, a.chest.x + w * 0.35, y + 8, 0.24, palette);
  }

  function drawNecromancerChestDetails(ctx, rig, palette) {
    const a = rig.anchors;
    const t = rig.pose.t || 0;
    line(ctx, a.chest.x - 11, a.chest.y - 1, a.pelvis.x + 8, a.pelvis.y + 11, palette.metalDark, 0.9, 0.64);
    line(ctx, a.chest.x + 10, a.chest.y, a.pelvis.x - 7, a.pelvis.y + 10, palette.metalDark, 0.9, 0.64);
    roundRect(ctx, a.chest.x - 5, a.chest.y + 14, 10, 8, 1.6, palette.bootHi, palette.outline, 0.8);
    drawDiamond(ctx, a.chest.x, a.chest.y + 7, 2.2, palette.glow, palette.outline);
    line(ctx, a.chest.x, a.chest.y + 9, a.chest.x, a.chest.y + 16, palette.accentDark, 0.85, 0.7);
    for (let i = -1; i <= 1; i++) {
      const yy = a.chest.y + 20 + Math.sin(t * 1.7 + i) * 0.4;
      drawDiamond(ctx, a.chest.x + i * 5, yy, 1.2, i === 0 ? palette.glow : palette.accent, palette.outline);
    }
  }

  function drawNecromancerBeltGear(ctx, rig, palette, y) {
    const a = rig.anchors;
    const t = rig.pose.t || 0;
    roundRect(ctx, a.pelvis.x - 17, y + 3, 8, 11, 1.5, palette.boot, palette.outline, 0.85);
    drawDiamond(ctx, a.pelvis.x - 13, y + 17 + Math.sin(t * 1.8) * 0.5, 1.4, palette.glow, palette.outline);
    line(ctx, a.pelvis.x - 13, y + 14, a.pelvis.x - 13, y + 20, palette.metalDark, 0.75, 0.72);
    roundRect(ctx, a.pelvis.x + 11, y + 3, 6, 12, 1.3, palette.clothDark, palette.outline, 0.82);
    line(ctx, a.pelvis.x + 14, y + 15, a.pelvis.x + 18, y + 24, palette.metalDark, 0.75, 0.72);
    ellipse(ctx, a.pelvis.x + 19, y + 27, 2.6, 4.0, 0, palette.glow, palette.outline, 0.65);
    drawBone(ctx, a.pelvis.x + 1, y + 10, 0.22, palette);
  }

  function drawNecromancerRobeDetails(ctx, rig, palette, topW, hemW, robeBottom, chestY) {
    const a = rig.anchors;
    const t = rig.pose.t || 0;
    line(ctx, a.chest.x - topW * 0.58, chestY + 8, a.pelvis.x - hemW * 0.42, robeBottom - 8, palette.clothHi, 0.8, 0.20);
    line(ctx, a.chest.x + topW * 0.52, chestY + 7, a.pelvis.x + hemW * 0.34, robeBottom - 10, palette.clothHi, 0.8, 0.20);
    poly(ctx, [
      { x: a.pelvis.x - 6, y: a.pelvis.y + 12 },
      { x: a.pelvis.x + 10, y: a.pelvis.y + 12 },
      { x: a.pelvis.x + 6, y: robeBottom - 8 },
      { x: a.pelvis.x - 9, y: robeBottom - 4 }
    ], 'rgba(255,255,255,0.028)', palette.outline, 0.8);
    for (let i = 0; i < 4; i++) {
      const yy = a.pelvis.y + 18 + i * 9;
      drawDiamond(ctx, a.pelvis.x + 2 + Math.sin(t * 1.2 + i) * 0.5, yy, 1.25, i % 2 ? palette.accent : palette.glow, palette.outline);
    }
    for (let i = -1; i <= 1; i++) {
      line(ctx, a.pelvis.x + i * 8, robeBottom - 15, a.pelvis.x + i * 7, robeBottom - 4, palette.accentDark, 0.75, 0.55);
      drawBone(ctx, a.pelvis.x + i * 7, robeBottom - 1, 0.16, palette);
    }
  }

  function drawNecromancerLowerDetails(ctx, rig, palette) {
    const a = rig.anchors;
    const hemY = a.pelvis.y + 38;
    line(ctx, a.pelvis.x - 14, hemY - 3, a.pelvis.x + 14, hemY - 3, palette.accentDark, 0.7, 0.42);
    drawDiamond(ctx, a.pelvis.x - 8, hemY + 1, 1.2, palette.accent, palette.outline);
    drawDiamond(ctx, a.pelvis.x + 8, hemY + 1, 1.4, palette.glow, palette.outline);
    line(ctx, a.pelvis.x - 10, hemY - 8, a.pelvis.x - 13, hemY + 3, palette.metalDark, 0.7, 0.54);
    line(ctx, a.pelvis.x + 10, hemY - 8, a.pelvis.x + 14, hemY + 4, palette.metalDark, 0.7, 0.54);
  }


  function drawPremiumFighterWithSwimClip(ctx, anchors, pose, drawBody) {
    if (String(pose?.action || '').toLowerCase() !== 'swim') {
      drawBody();
      return;
    }
    const rawBlend = Number(pose.swimBlend ?? 1);
    const blend = Math.max(0, Math.min(1, Number.isFinite(rawBlend) ? rawBlend : 1));
    if (blend <= 0.01) {
      drawBody();
      return;
    }
    const eased = 1 - Math.pow(1 - blend, 2);
    const waterlineY = Number.isFinite(Number(anchors.waterlineY)) ? Number(anchors.waterlineY) : -1;
    const leftFoot = Number(anchors.legs?.left?.foot?.y);
    const rightFoot = Number(anchors.legs?.right?.foot?.y);
    const lowestFoot = Math.max(Number.isFinite(leftFoot) ? leftFoot : 56, Number.isFinite(rightFoot) ? rightFoot : 56);
    const transitionStart = Math.max(34, lowestFoot + 8);
    const clipY = transitionStart + (waterlineY + 0.5 - transitionStart) * eased;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-190, -230, 380, 230 + clipY);
    ctx.clip();
    drawBody();
    ctx.restore();
  }

  function drawPremiumFighterModel(ctx, actor, profile, pose, nowMs) {
    const palette = paletteFor(actor, profile);
    const source = actor.sourceEntity || actor;
    const x = Math.round(actor.screenX ?? actor.x ?? 0);
    const y = Math.round(actor.screenY ?? actor.y ?? 0);
    const dir = pose.direction || { name: 'south', view: 'front', side: 0, backVisible: false };
    const view = dir.view || 'front';
    const side = dir.side || 1;
    const isBack = !!dir.backVisible;
    const isSide = view === 'side';
    const isFrontDiag = view === 'frontDiagonal';
    const compress = isSide ? 0.58 : isFrontDiag ? 0.82 : 1;
    const t = pose.t || (nowMs || 0) / 1000;
    const walk = pose.groundPulse || Math.abs(Math.sin(pose.walkCycle || 0));
    const action = pose.action || 'idle';
    const attack = action === 'attack' ? (pose.attackCurve || 0) : 0;
    const meditate = action === 'meditate' ? 1 : 0;
    const fishing = action === 'fishing' ? 1 : 0;
    const swimming = action === 'swim' ? 1 : 0;
    const swimMove = swimming ? Math.max(0, Math.min(1, Number(pose.swimMovement || actor.swimMovement || source.swimMovement || 0))) : 0;
    const swimStroke = swimming ? Number(pose.swimStroke || Math.sin((pose.swimCycle || t) * Math.PI * 2)) : 0;
    const swimKick = swimming ? Number(pose.swimKick || Math.sin((pose.swimCycle || t) * Math.PI * 4)) : 0;
    const autoReady = !attack && !meditate && !fishing && !swimming && !!(actor.autoAttack || source.autoAttack || actor.combatCooldown || source.combatCooldown);
    const readyPulse = autoReady ? 0.5 + Math.sin(t * 8.2 + (pose.seed || 0)) * 0.5 : 0;
    const fishingReel = fishing ? Math.sin(t * 15 + (pose.seed || 0)) : 0;
    const bob = (pose.torsoBob || 0) * 0.65 + (actor.isPreview ? Math.sin(t * 2.0) * 0.45 : 0);
    const headBob = (pose.headBob || 0) * 0.55;
    const lean = (pose.lean || 0) * 0.018 + (isSide ? side * 0.03 : 0);
    const death = pose.deathProgress || 0;

    const anchors = buildPremiumFighterAnchors({ compress, side, isBack, isSide, isFrontDiag, bob, headBob, walk, attack, lean, death, meditate, fishing, swimming, swimMove, swimStroke, swimKick, autoReady: autoReady ? 1 : 0, readyPulse, fishingReel });
    const hideDefaultWeapon = equippedWeaponVisible(actor);
    const hideDefaultOffhand = equippedOffhandVisible(actor);

    ctx.save();
    try {
      ctx.translate(x, y);
      if (action === 'death') {
        ctx.translate(0, 15 * death);
        ctx.rotate((side || 1) * 0.30 * death);
      }

      drawPremiumFighterGroundShadow(ctx, anchors, palette, death);
      if (meditate) {
        drawPremiumFighterMeditationAuraUnderlay(ctx, anchors, palette, { t, pulse: pose.meditatePulse || pose.castPulse || 1, side, isBack, isSide, isFrontDiag });
      }
      drawPremiumFighterWithSwimClip(ctx, anchors, pose, () => {
        drawBruiserFighterBackLayer(ctx, anchors, palette, { isBack, isSide, isFrontDiag, side, t, attack, meditate, fishing, swimming, hideWeapon: hideDefaultWeapon });

        if (meditate) {
          drawBruiserFighterMeditationLegs(ctx, anchors, palette, { isBack, isSide, isFrontDiag, side, t });
        } else if (swimming) {
          drawPremiumFighterSwimmingLegs(ctx, anchors, palette, { isBack, isSide, isFrontDiag, t, swimMove, swimKick });
        } else {
          drawBruiserFighterLegs(ctx, anchors, palette, pose, isBack);
        }

        drawBruiserFighterTorso(ctx, anchors, palette, { isBack, isSide, isFrontDiag, compress, meditate, fishing, t });
        drawBruiserFighterShoulders(ctx, anchors, palette, { isBack, isSide, isFrontDiag, compress, side, t });

        if (meditate) {
          drawBruiserFighterMeditationArms(ctx, anchors, palette, { isBack, isSide, isFrontDiag, side, t, hideWeapon: hideDefaultWeapon });
        } else if (fishing) {
          drawPremiumFighterFishingArms(ctx, anchors, palette, { isBack, isSide, isFrontDiag, side, t, fishingReel });
          drawPremiumFighterFishingRig(ctx, anchors, palette, profile, actor, pose, { side, fishingReel });
        } else if (swimming) {
          drawPremiumFighterSwimmingArms(ctx, anchors, palette, { isBack, isSide, isFrontDiag, side, t, swimMove, swimStroke });
        } else if (!isBack) {
          drawBruiserFighterGreatweaponArms(ctx, anchors, palette, { side, attack, ready: autoReady ? 1 : 0, readyPulse, isSide, isFrontDiag, hideWeapon: hideDefaultWeapon });
        } else {
          drawBruiserFighterBackArms(ctx, anchors, palette, { side, isBack });
        }

        drawBruiserFighterBeltAndAccessories(ctx, anchors, palette, { isBack, compress, meditate, t });
        drawBruiserFighterHead(ctx, anchors, palette, actor, { isBack, isSide, side, t, meditate });
        if (!isBack) drawBruiserFighterFrontDetails(ctx, anchors, palette, { t, attack, ready: autoReady ? 1 : 0, readyPulse, isSide, isFrontDiag, side });
      });
      if (swimming) drawPremiumFighterSwimmingSurface(ctx, anchors, palette, { t, swimMove, swimStroke });
      if (action === 'meditate') {
        drawPremiumFighterMeditationSpiritOverlay(ctx, anchors, palette, { t, pulse: pose.meditatePulse || pose.castPulse || 1, side, isBack, isSide, isFrontDiag });
      } else if (action === 'cast') {
        drawMeditationAura(ctx, 0, 5, palette, profile, t, pose.castPulse || 1);
      }
      if (pose.hitFlash > 0) drawHitFlash(ctx, 0, -34, palette, profile, pose.hitFlash);
      if (actor.debugFacing) drawDebugFighterBounds(ctx, anchors, dir);
    } finally {
      ctx.restore();
    }

    // V0.20.51: same fix as the Paladin model below - `groundY: y` is the model origin (the hips), not
    // the feet, so ground-anchored VFX rode up to the waist. Derived from the leg anchors, matching the
    // shared humanoid base renderer.
    const bruiserFeetY = [anchors?.legs?.left?.foot?.y, anchors?.legs?.right?.foot?.y]
      .map(Number).filter(Number.isFinite);
    const groundAnchor = { x, y, groundY: y + (bruiserFeetY.length ? Math.max(...bruiserFeetY) : 0) };
    if (actor) actor._lastGroundAnchor = groundAnchor;
    if (source) {
      source._lastGroundAnchor = groundAnchor;
      source._humanoidFacingName = dir.name;
      source._lastHumanoidFacingName = dir.name;
      source._classIdentityRenderer = 'fighter-bruiser-twohand-v0.16.75';
      source._nameplateAnchor = { x: x + anchors.head.x, y: y + anchors.head.top - 9 };
      source._classModelClickBounds = { x: x - 40, y: y - 106, w: 80, h: 116 };
      if (action === 'meditate') {
        const leftFootY = anchors?.legs?.left?.foot?.y ?? 49;
        const rightFootY = anchors?.legs?.right?.foot?.y ?? 49;
        const footY = Math.max(leftFootY, rightFootY);
        source._meditationExpBarAnchor = { x, y: Math.round(y + footY + 28) };
      } else {
        source._meditationExpBarAnchor = null;
      }
    }
    return true;
  }

  function buildPremiumFighterAnchors(opts) {
    const compress = opts.compress || 1;
    const side = opts.side || 1;
    const walk = opts.walk || 0;
    const attack = opts.attack || 0;
    const meditate = opts.meditate || 0;
    const fishing = opts.fishing || 0;
    const swimming = opts.swimming || 0;
    const swimMove = opts.swimMove || 0;
    const swimStroke = opts.swimStroke || 0;
    const swimKick = opts.swimKick || 0;
    const ready = opts.autoReady || 0;
    const readyPulse = opts.readyPulse || 0;
    const fishingReel = opts.fishingReel || 0;
    const bob = opts.bob || 0;
    const headBob = opts.headBob || 0;
    const lean = opts.lean || 0;
    const sideOffset = opts.isSide ? side * 3 : opts.isFrontDiag ? side * 2 : 0;
    const shoulderW = 35 * compress * (1 - meditate * 0.05);
    const hipW = 17 * compress * (1 + meditate * 0.28 - swimming * 0.18);
    const chest = { x: sideOffset + lean * 10 + swimming * side * swimMove * 2, y: -43 + bob + meditate * 25 + fishing * 2 + swimming * 8 - ready * (1.2 + readyPulse * 0.8) };
    const pelvis = { x: sideOffset * 0.45 + swimming * side * swimMove, y: -12 + bob * 0.35 + meditate * 30 + fishing * 1 + swimming * 12 };
    const head = { x: sideOffset + side * (opts.isSide ? 3 : opts.isFrontDiag ? 1.5 : 0) + swimming * side * swimMove * 1.2, y: -75 + headBob + bob * 0.2 + meditate * 21 + swimming * 5 - ready * 1.2, rx: 11.5 * (opts.isSide ? 0.78 : 1), ry: 14.2, top: -91 + headBob + bob * 0.2 + meditate * 21 + swimming * 5 - ready * 1.2, bottom: -61 + headBob + bob * 0.2 + meditate * 21 + swimming * 5 - ready * 1.2 };
    const leftShoulder = { x: chest.x - shoulderW / 2, y: chest.y - 9 };
    const rightShoulder = { x: chest.x + shoulderW / 2, y: chest.y - 9 };
    const leftHip = { x: pelvis.x - hipW / 2, y: pelvis.y + 4 };
    const rightHip = { x: pelvis.x + hipW / 2, y: pelvis.y + 4 };
    const weaponSide = opts.isSide ? side : 1;
    const shieldSide = -weaponSide;
    const legSwing = walk * 3.0 * (1 - meditate) * (1 - fishing) * (1 - swimming);
    const shieldBrace = Math.max(0, 1 - attack * 0.4 + ready * 0.18);
    const weaponArm = meditate
      ? {
          shoulder: weaponSide < 0 ? leftShoulder : rightShoulder,
          elbow: { x: chest.x + weaponSide * (14 * compress), y: chest.y + 13 },
          hand: { x: pelvis.x + weaponSide * (9 * compress), y: pelvis.y + 18 + Math.sin((opts.readyPulse || 0) * TAU) * 0.4 }
        }
      : fishing
        ? {
            shoulder: weaponSide < 0 ? leftShoulder : rightShoulder,
            elbow: { x: chest.x + weaponSide * (18 * compress), y: chest.y + 5 + fishingReel * 0.8 },
            hand: { x: chest.x + weaponSide * (31 * compress), y: chest.y + 14 + fishingReel * 1.1 }
          }
        : swimming
          ? {
              shoulder: weaponSide < 0 ? leftShoulder : rightShoulder,
              elbow: { x: chest.x + weaponSide * (24 * compress + swimMove * 5), y: chest.y + 8 + swimStroke * 7 },
              hand: { x: chest.x + weaponSide * (37 * compress + swimMove * 8), y: -10 + swimStroke * 8 }
            }
        : {
            shoulder: weaponSide < 0 ? leftShoulder : rightShoulder,
            elbow: { x: chest.x + weaponSide * (22 * compress + attack * 7 + ready * 2), y: chest.y - 2 + attack * -5 - ready * (7 + readyPulse * 1.1) },
            hand: { x: chest.x + weaponSide * (32 * compress + attack * 12 + ready * 5), y: chest.y + 20 - attack * 12 - ready * (19 + readyPulse * 1.5) }
          };
    const shieldArm = meditate
      ? {
          shoulder: shieldSide < 0 ? leftShoulder : rightShoulder,
          elbow: { x: chest.x + shieldSide * (13 * compress), y: chest.y + 14 },
          hand: { x: pelvis.x + shieldSide * (13 * compress), y: pelvis.y + 19 }
        }
      : fishing
        ? {
            shoulder: shieldSide < 0 ? leftShoulder : rightShoulder,
            elbow: { x: chest.x + weaponSide * (7 * compress), y: chest.y + 12 - fishingReel * 0.6 },
            hand: { x: chest.x + weaponSide * (17 * compress), y: chest.y + 20 - fishingReel * 0.7 }
          }
        : swimming
          ? {
              shoulder: shieldSide < 0 ? leftShoulder : rightShoulder,
              elbow: { x: chest.x + shieldSide * (24 * compress + swimMove * 5), y: chest.y + 8 - swimStroke * 7 },
              hand: { x: chest.x + shieldSide * (37 * compress + swimMove * 8), y: -10 - swimStroke * 8 }
            }
        : {
            shoulder: shieldSide < 0 ? leftShoulder : rightShoulder,
            elbow: { x: chest.x + shieldSide * (21 * compress + ready * 2), y: chest.y + 4 + shieldBrace * 2 - ready * 7 },
            hand: { x: chest.x + shieldSide * (30 * compress + ready * 2), y: chest.y + 22 + shieldBrace * 2 - ready * 10 }
          };

    return {
      chest, pelvis, head,
      shoulderW, hipW, compress, side, weaponSide, shieldSide,
      shoulders: { left: leftShoulder, right: rightShoulder },
      hips: { left: leftHip, right: rightHip },
      weaponArm,
      shieldArm,
      backArm: {
        shoulder: shieldSide < 0 ? leftShoulder : rightShoulder,
        elbow: { x: chest.x + shieldSide * (17 * compress), y: chest.y + 8 },
        hand: { x: chest.x + shieldSide * (22 * compress), y: chest.y + 30 }
      },
      legs: {
        left: {
          hip: leftHip,
          knee: swimming ? { x: leftHip.x - 8 * compress + swimMove * side * 3, y: 17 + swimKick * 1.5 } : { x: leftHip.x - 2 * compress - legSwing * 0.35, y: 21 - walk * 1.3 },
          foot: swimming ? { x: leftHip.x - 16 * compress + swimMove * side * 6, y: 29 + swimKick * 3.2 } : { x: leftHip.x - 4 * compress - legSwing * 0.5, y: 49 - walk * 0.8 }
        },
        right: {
          hip: rightHip,
          knee: { x: rightHip.x + 2 * compress + legSwing * 0.35, y: 22 + walk * 0.8 },
          foot: { x: rightHip.x + 5 * compress + legSwing * 0.5, y: 49 + walk * 0.4 }
        }
      },
      waterlineY: -1 + (swimming ? Math.sin((opts.readyPulse || 0) * Math.PI * 2) * 0.2 : 0),
      swimSubmerge: swimming ? 0.52 : 0
    };
  }



  function drawPremiumFighterMeditationAuraUnderlay(ctx, a, palette, opts = {}) {
    const t = Number(opts.t || 0);
    const pulse = Math.max(0.85, Number(opts.pulse || 1));
    const leftFootY = a?.legs?.left?.foot?.y ?? 49;
    const rightFootY = a?.legs?.right?.foot?.y ?? 49;
    const baseY = Math.round(Math.max(leftFootY, rightFootY) + 4);
    const ember = '#ff8b38';
    const gold = '#ffd26d';
    const spin = t * 0.92;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    const baseGlow = ctx.createRadialGradient(0, baseY, 4, 0, baseY, 78 + pulse * 14);
    baseGlow.addColorStop(0, 'rgba(255,236,160,0.58)');
    baseGlow.addColorStop(0.26, 'rgba(255,139,56,0.42)');
    baseGlow.addColorStop(0.60, 'rgba(140,72,34,0.24)');
    baseGlow.addColorStop(1, 'rgba(140,72,34,0)');
    ctx.fillStyle = baseGlow;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.ellipse(0, baseY + 1, 70 + pulse * 9, 24 + pulse * 3, 0, 0, TAU);
    ctx.fill();

    ctx.globalAlpha = 0.72;
    ctx.fillStyle = 'rgba(92,74,57,0.68)';
    ctx.beginPath();
    ctx.ellipse(0, baseY + 2, 47, 13, 0, 0, TAU);
    ctx.fill();

    ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const x = -42 + i * 6.4;
      const y = baseY - 4 + Math.sin(i * 1.7 + t) * 4;
      ctx.strokeStyle = i % 3 ? 'rgba(255,156,66,0.58)' : 'rgba(255,226,130,0.70)';
      ctx.lineWidth = 1.0 + (i % 2) * 0.45;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 4 + Math.sin(t + i) * 2, y + 8 + Math.cos(t + i) * 2);
      ctx.stroke();
    }

    for (let i = 0; i < 4; i++) {
      const a0 = spin + i * (Math.PI / 2) + 0.16;
      const a1 = a0 + 0.88;
      ctx.globalAlpha = 0.72;
      ctx.strokeStyle = i % 2 ? gold : ember;
      ctx.lineWidth = 3.1;
      ctx.beginPath();
      ctx.ellipse(0, baseY + 1, 50 + Math.sin(t * 2 + i) * 2, 14, 0, a0, a1);
      ctx.stroke();
    }

    // Weapon planted in the ground; the pose hands read as resting on it.
    const side = opts.side || 1;
    line(ctx, side * 15, baseY - 55, side * 10, baseY + 2, '#18110c', 5.8, 0.86);
    line(ctx, side * 15, baseY - 55, side * 10, baseY + 2, '#d6d0bd', 3.2, 0.94);
    line(ctx, side * 7, baseY - 27, side * 23, baseY - 27, gold, 2.5, 0.84);

    for (let i = 0; i < 20; i++) {
      const phase = ((t * 0.48) + i * 0.071) % 1;
      const px = Math.sin((t * 2.0) + i * 1.31) * (10 + (i % 6) * 6.1);
      const py = baseY - phase * 48 - (i % 4) * 2.4;
      ctx.globalAlpha = 0.16 + Math.sin(phase * Math.PI) * 0.28;
      ctx.fillStyle = i % 3 === 0 ? '#fff0b2' : (i % 2 ? gold : ember);
      ctx.beginPath();
      ctx.arc(px, py, 1.2 + (i % 3) * 0.45, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawPremiumFighterMeditationSpiritOverlay(ctx, a, palette, opts = {}) {
    const t = Number(opts.t || 0);
    const leftFootY = a?.legs?.left?.foot?.y ?? 49;
    const rightFootY = a?.legs?.right?.foot?.y ?? 49;
    const baseY = Math.round(Math.max(leftFootY, rightFootY) + 4);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 16; i++) {
      const phase = ((t * 0.56) + i * 0.093) % 1;
      const px = Math.sin(t * 2.2 + i * 1.7) * (9 + (i % 5) * 5.6);
      const py = baseY - phase * 42 - (i % 3) * 3;
      ctx.globalAlpha = 0.12 + Math.sin(phase * Math.PI) * 0.24;
      ctx.fillStyle = i % 2 ? '#ffae52' : '#ffe4a0';
      ctx.beginPath();
      ctx.arc(px, py, 1.15 + (i % 3) * 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPremiumFighterGroundShadow(ctx, a, palette, death) {
    ctx.save();
    ctx.fillStyle = palette.shadow || 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(0, death ? 10 : 4, death ? 32 : 25, death ? 8 : 7, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawPremiumFighterCape(ctx, a, palette, dir, pose, backFacing) {
    const sway = (pose.capeSway || 0) * 0.22;
    const sideBias = (dir.capeSide || 0) * 3;
    const g = ctx.createLinearGradient(-23, -58, 24, 7);
    g.addColorStop(0, palette.clothHi || '#8c4d40');
    g.addColorStop(0.5, palette.cloth || '#5a2d2c');
    g.addColorStop(1, palette.clothDark || '#241b1b');
    poly(ctx, [
      { x: a.chest.x - 19 * a.compress - sideBias, y: a.chest.y - 9 },
      { x: a.chest.x + 19 * a.compress - sideBias, y: a.chest.y - 9 },
      { x: a.pelvis.x + 17 * a.compress - sideBias + sway, y: a.pelvis.y + (backFacing ? 45 : 34) },
      { x: a.pelvis.x, y: a.pelvis.y + (backFacing ? 51 : 40) },
      { x: a.pelvis.x - 17 * a.compress - sideBias - sway, y: a.pelvis.y + (backFacing ? 45 : 34) }
    ], g, palette.outline, 1.8);
  }

  function drawPremiumFighterSwimmingLegs(ctx, a, palette, opts = {}) {
    ctx.save();
    ctx.globalAlpha = 0.20;
    const left = a.legs.left;
    const right = a.legs.right;
    Base.limb(ctx, left.hip, left.knee, palette, { fill: palette.clothDark, width: 8, alpha: 0.20 });
    Base.limb(ctx, left.knee, left.foot, palette, { fill: palette.clothHi, width: 7, alpha: 0.16 });
    Base.limb(ctx, right.hip, right.knee, palette, { fill: palette.clothDark, width: 8, alpha: 0.20 });
    Base.limb(ctx, right.knee, right.foot, palette, { fill: palette.clothHi, width: 7, alpha: 0.16 });
    ctx.strokeStyle = 'rgba(202,250,255,0.55)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(0, 5, 30 + (opts.swimMove || 0) * 9, 7, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawPremiumFighterSwimmingArms(ctx, a, palette, opts = {}) {
    ctx.save();
    const weapon = a.weaponArm;
    const shield = a.shieldArm;
    Base.limb(ctx, weapon.shoulder, weapon.elbow, palette, { fill: palette.cloth, width: 8.4, alpha: 1 });
    Base.limb(ctx, weapon.elbow, weapon.hand, palette, { fill: palette.clothHi, width: 7.2, alpha: 1 });
    Base.ellipse(ctx, weapon.hand.x, weapon.hand.y, 5.4, 5.0, 0, palette.skin, palette.outline, 1.4);
    Base.limb(ctx, shield.shoulder, shield.elbow, palette, { fill: palette.clothDark, width: 8.0, alpha: 0.88 });
    Base.limb(ctx, shield.elbow, shield.hand, palette, { fill: palette.cloth, width: 6.8, alpha: 0.88 });
    Base.ellipse(ctx, shield.hand.x, shield.hand.y, 5.2, 4.8, 0, palette.skin, palette.outline, 1.3);
    ctx.restore();
  }

  function drawPremiumFighterSwimmingSurface(ctx, a, palette, opts = {}) {
    const t = opts.t || 0;
    const move = Math.max(0, Math.min(1, Number(opts.swimMove || 0)));
    const stroke = Number(opts.swimStroke || 0);
    ctx.save();
    ctx.globalAlpha = 0.78;
    const g = ctx.createLinearGradient(-44, -8, 44, 13);
    g.addColorStop(0, 'rgba(27,89,120,0.74)');
    g.addColorStop(0.45, 'rgba(86,180,206,0.76)');
    g.addColorStop(1, 'rgba(17,64,92,0.74)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 3, 35 + move * 10, 9 + move * 2, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.54;
    ctx.strokeStyle = 'rgba(222,255,255,0.88)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(stroke * (4 + i), 1 + i * 4, 23 + i * 7 + move * 7, 3.6 + i * 0.8, Math.sin(t + i) * 0.04, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPremiumFighterLegs(ctx, a, palette, pose, backFacing) {
    const left = a.legs.left;
    const right = a.legs.right;
    const drawLeg = (leg, front) => {
      const thighFill = front && !backFacing ? palette.clothHi : palette.clothDark;
      const thighShade = front && !backFacing ? palette.cloth : palette.clothDark;
      const greaveFill = front && !backFacing ? palette.metal : palette.metalDark;
      const bootFill = front && !backFacing ? palette.bootHi : palette.boot;

      line(ctx, leg.hip.x, leg.hip.y, leg.knee.x, leg.knee.y, palette.outline, 10.2, 1);
      line(ctx, leg.hip.x, leg.hip.y, leg.knee.x, leg.knee.y, thighFill, 7.2, 1);
      line(ctx, leg.hip.x + (front ? 1.4 : -1.4), leg.hip.y + 2, leg.knee.x + (front ? 1.2 : -1.2), leg.knee.y - 1, thighShade, 3.8, 0.9);

      const kneePlate = [
        { x: leg.knee.x - 6.2, y: leg.knee.y - 2 },
        { x: leg.knee.x + 6.2, y: leg.knee.y - 2 },
        { x: leg.knee.x + 5.1, y: leg.knee.y + 6.7 },
        { x: leg.knee.x, y: leg.knee.y + 10.2 },
        { x: leg.knee.x - 5.1, y: leg.knee.y + 6.7 }
      ];
      poly(ctx, kneePlate, greaveFill, palette.outline, 1.1);
      line(ctx, leg.knee.x - 3.5, leg.knee.y + 1.2, leg.knee.x + 3.5, leg.knee.y + 1.2, palette.metal, 0.9, 0.58);

      line(ctx, leg.knee.x, leg.knee.y + 4, leg.foot.x, leg.foot.y - 2, palette.outline, 9.2, 1);
      line(ctx, leg.knee.x, leg.knee.y + 4, leg.foot.x, leg.foot.y - 2, greaveFill, 6.2, 1);
      line(ctx, leg.knee.x + (front ? 1 : -1), leg.knee.y + 7, leg.foot.x + (front ? 1 : -1), leg.foot.y - 5, palette.metal, 1.1, 0.65);
      roundRect(ctx, leg.foot.x - 3.4, leg.foot.y - 9.8, 6.8, 9.8, 2, palette.metalDark, palette.outline, 0.95);
      ellipse(ctx, leg.foot.x, leg.foot.y + 2.2, 8.4, 4.7, 0.08, bootFill, palette.outline, 1.45);
      line(ctx, leg.foot.x - 4.6, leg.foot.y + 2.2, leg.foot.x + 5.2, leg.foot.y + 2.2, palette.boot, 1.0, 0.55);
    };
    drawLeg(left, false);
    drawLeg(right, true);
  }

  function drawPremiumFighterMeditationLegs(ctx, a, palette, opts) {
    const c = a.pelvis;
    const flat = opts.isSide ? 0.68 : opts.isFrontDiag ? 0.86 : 1;
    const y = c.y + 18;
    ctx.save();
    ctx.globalAlpha = 0.98;
    ellipse(ctx, c.x, y + 11, 28 * flat * a.compress, 8, 0, 'rgba(0,0,0,0.26)', null, 0);
    const left = [
      { x: c.x - 4 * a.compress, y: y - 2 },
      { x: c.x - 27 * flat * a.compress, y: y + 8 },
      { x: c.x - 24 * flat * a.compress, y: y + 18 },
      { x: c.x - 2 * a.compress, y: y + 10 }
    ];
    const right = [
      { x: c.x + 4 * a.compress, y: y - 2 },
      { x: c.x + 27 * flat * a.compress, y: y + 8 },
      { x: c.x + 24 * flat * a.compress, y: y + 18 },
      { x: c.x + 2 * a.compress, y: y + 10 }
    ];
    poly(ctx, left, palette.metalDark, palette.outline, 1.45);
    poly(ctx, right, palette.metal, palette.outline, 1.45);
    drawFighterQuadPlate(ctx, [
      { x: c.x - 19 * flat * a.compress, y: y + 5 }, { x: c.x - 8 * flat * a.compress, y: y + 1 },
      { x: c.x - 3 * flat * a.compress, y: y + 7 }, { x: c.x - 16 * flat * a.compress, y: y + 12 }
    ], 'rgba(218,224,220,0.20)', palette, 0.50, 0.42);
    drawFighterQuadPlate(ctx, [
      { x: c.x + 8 * flat * a.compress, y: y + 1 }, { x: c.x + 19 * flat * a.compress, y: y + 5 },
      { x: c.x + 16 * flat * a.compress, y: y + 12 }, { x: c.x + 3 * flat * a.compress, y: y + 7 }
    ], 'rgba(218,224,220,0.24)', palette, 0.54, 0.42);
    ellipse(ctx, c.x - 28 * flat * a.compress, y + 17, 8.4 * flat, 4.8, -0.15, palette.boot, palette.outline, 1.2);
    ellipse(ctx, c.x + 28 * flat * a.compress, y + 17, 8.4 * flat, 4.8, 0.15, palette.bootHi, palette.outline, 1.2);
    line(ctx, c.x - 20 * flat * a.compress, y + 13, c.x + 20 * flat * a.compress, y + 13, palette.accentDark, 0.9, 0.48);
    ctx.restore();
  }

  function drawPremiumFighterMeditationArms(ctx, a, palette, opts) {
    const drawFolded = (arm, side, fill) => {
      line(ctx, arm.shoulder.x, arm.shoulder.y, arm.elbow.x, arm.elbow.y, palette.outline, 8.0, 0.92);
      line(ctx, arm.shoulder.x, arm.shoulder.y, arm.elbow.x, arm.elbow.y, fill, 5.0, 0.92);
      line(ctx, arm.elbow.x, arm.elbow.y, arm.hand.x, arm.hand.y, palette.outline, 7.0, 0.94);
      line(ctx, arm.elbow.x, arm.elbow.y, arm.hand.x, arm.hand.y, palette.metalDark, 4.5, 0.94);
      roundRect(ctx, arm.elbow.x - 3.0, arm.elbow.y - 1, 6.0, 9.0, 2, palette.metalDark, palette.outline, 0.75);
      ellipse(ctx, arm.hand.x, arm.hand.y, 4.2, 4.4, 0, palette.skinShadow, palette.outline, 1.0);
      line(ctx, arm.hand.x - side * 3.0, arm.hand.y + 1.0, arm.hand.x + side * 3.0, arm.hand.y + 1.0, 'rgba(255,224,170,0.36)', 0.7, 0.55);
    };
    drawFolded(a.weaponArm, a.weaponSide, palette.cloth);
    drawFolded(a.shieldArm, a.shieldSide, palette.clothDark);

    // Resting gear reads as the Fighter's equipment, not a generic caster meditation pose.
    ctx.save();
    ctx.globalAlpha = 0.78;
    drawPremiumFighterSword(ctx, a.pelvis.x + a.weaponSide * 3, a.pelvis.y + 22, a.weaponSide, -0.12, palette);
    ctx.restore();
    ctx.save();
    ctx.translate(a.pelvis.x + a.shieldSide * (30 * a.compress), a.pelvis.y + 30);
    ctx.rotate(a.shieldSide * 0.38);
    drawPremiumFighterSideShield(ctx, 0, 0, a.shieldSide, { isSide: opts.isSide, isFrontDiag: opts.isFrontDiag }, palette);
    ctx.restore();
  }

  function drawPremiumFighterFishingArms(ctx, a, palette, opts) {
    const main = a.weaponArm;
    const support = a.shieldArm;
    const reel = opts.fishingReel || 0;
    line(ctx, main.shoulder.x, main.shoulder.y, main.elbow.x, main.elbow.y, palette.outline, 8.2, 1);
    line(ctx, main.shoulder.x, main.shoulder.y, main.elbow.x, main.elbow.y, palette.cloth, 5.1, 1);
    line(ctx, main.elbow.x, main.elbow.y, main.hand.x, main.hand.y, palette.outline, 7.3, 1);
    line(ctx, main.elbow.x, main.elbow.y, main.hand.x, main.hand.y, palette.metalDark, 4.3, 1);
    roundRect(ctx, main.elbow.x - 3.0, main.elbow.y - 1, 6.0, 9.6, 2, palette.metal, palette.outline, 0.78);

    line(ctx, support.shoulder.x, support.shoulder.y, support.elbow.x, support.elbow.y, palette.outline, 7.8, 0.94);
    line(ctx, support.shoulder.x, support.shoulder.y, support.elbow.x, support.elbow.y, palette.clothDark, 4.9, 0.94);
    line(ctx, support.elbow.x, support.elbow.y, support.hand.x, support.hand.y, palette.outline, 6.9, 0.94);
    line(ctx, support.elbow.x, support.elbow.y, support.hand.x, support.hand.y, palette.metalDark, 4.1, 0.94);
    ellipse(ctx, main.hand.x, main.hand.y, 4.7, 4.9, 0, palette.skin, palette.outline, 1.05);
    ellipse(ctx, support.hand.x, support.hand.y + reel * 0.4, 4.4, 4.7, 0, palette.skinShadow, palette.outline, 1.0);
  }

  function drawPremiumFighterFishingRig(ctx, a, palette, profile, actor, pose, opts) {
    const rig = {
      anchors: { mainHand: a.weaponArm.hand, offHand: a.shieldArm.hand },
      pose,
      actor,
      dir: { nearSide: opts.side || a.weaponSide || 1 }
    };
    drawClassFishingRig(ctx, rig, palette, profile);
  }

  function drawPremiumFighterBackArm(ctx, a, palette, isBack) {
    if (!isBack) return;
    const arm = a.backArm;
    line(ctx, arm.shoulder.x, arm.shoulder.y, arm.elbow.x, arm.elbow.y, palette.outline, 8.2, 0.78);
    line(ctx, arm.shoulder.x, arm.shoulder.y, arm.elbow.x, arm.elbow.y, palette.clothDark, 5.4, 0.78);
    line(ctx, arm.elbow.x, arm.elbow.y, arm.hand.x, arm.hand.y, palette.outline, 7.2, 0.75);
    line(ctx, arm.elbow.x, arm.elbow.y, arm.hand.x, arm.hand.y, palette.metalDark, 4.5, 0.75);
  }

  function drawPremiumFighterTorso(ctx, a, palette, opts) {
    const chest = a.chest;
    const pelvis = a.pelvis;
    const topW = (opts.isSide ? 16 : opts.isFrontDiag ? 24 : 29) * a.compress;
    const waistW = (opts.isSide ? 11 : opts.isFrontDiag ? 16 : 19) * a.compress;
    const skirtW = (opts.isSide ? 12 : opts.isFrontDiag ? 18 : 23) * a.compress;
    const g = ctx.createLinearGradient(chest.x - topW, chest.y - 22, chest.x + topW, pelvis.y + 33);
    g.addColorStop(0, palette.metalHi || '#dbe2df');
    g.addColorStop(0.18, palette.metal || '#c5c9c4');
    g.addColorStop(0.55, palette.metalDark || '#5a6469');
    g.addColorStop(1, palette.clothDark || '#241b1b');
    poly(ctx, [
      { x: chest.x - topW, y: chest.y - 15 },
      { x: chest.x + topW, y: chest.y - 15 },
      { x: pelvis.x + waistW, y: pelvis.y + 18 },
      { x: pelvis.x + skirtW * 0.58, y: pelvis.y + 32 },
      { x: pelvis.x - skirtW * 0.58, y: pelvis.y + 32 },
      { x: pelvis.x - waistW, y: pelvis.y + 18 }
    ], g, palette.outline, 2);

    poly(ctx, [
      { x: chest.x - topW * 0.8, y: chest.y - 12 },
      { x: chest.x - topW * 0.54, y: chest.y + 12 },
      { x: chest.x - waistW * 0.62, y: pelvis.y + 14 },
      { x: chest.x - waistW * 0.22, y: pelvis.y + 9 },
      { x: chest.x - topW * 0.24, y: chest.y - 7 }
    ], 'rgba(35,43,48,0.22)', 'rgba(255,255,255,0.05)', 0.6);
    poly(ctx, [
      { x: chest.x + topW * 0.8, y: chest.y - 12 },
      { x: chest.x + topW * 0.54, y: chest.y + 12 },
      { x: chest.x + waistW * 0.62, y: pelvis.y + 14 },
      { x: chest.x + waistW * 0.22, y: pelvis.y + 9 },
      { x: chest.x + topW * 0.24, y: chest.y - 7 }
    ], 'rgba(35,43,48,0.26)', 'rgba(255,255,255,0.05)', 0.6);

    if (!opts.isBack) {
      poly(ctx, [
        { x: chest.x, y: chest.y - 14 },
        { x: chest.x + topW * 0.68, y: chest.y - 6 },
        { x: chest.x + waistW * 0.52, y: pelvis.y + 10 },
        { x: chest.x, y: pelvis.y + 21 },
        { x: chest.x - waistW * 0.52, y: pelvis.y + 10 },
        { x: chest.x - topW * 0.68, y: chest.y - 6 }
      ], 'rgba(223,231,228,0.38)', 'rgba(255,235,176,0.38)', 1.15);

      poly(ctx, [
        { x: chest.x - topW * 0.22, y: chest.y - 2 },
        { x: chest.x + topW * 0.22, y: chest.y - 2 },
        { x: chest.x + waistW * 0.26, y: pelvis.y + 12 },
        { x: chest.x, y: pelvis.y + 18 },
        { x: chest.x - waistW * 0.26, y: pelvis.y + 12 }
      ], 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0.05)', 0.7);

      line(ctx, chest.x, chest.y - 11, chest.x, pelvis.y + 19, palette.metal, 1.5, 0.74);
      line(ctx, chest.x - topW * 0.4, chest.y - 5, chest.x + topW * 0.4, chest.y - 5, palette.accentDark, 1.15, 0.66);
      line(ctx, chest.x - topW * 0.58, chest.y + 1, chest.x - waistW * 0.35, pelvis.y + 8, palette.metalDark, 1.05, 0.6);
      line(ctx, chest.x + topW * 0.58, chest.y + 1, chest.x + waistW * 0.35, pelvis.y + 8, palette.metalDark, 1.05, 0.6);

      for (let i = -1; i <= 1; i++) {
        line(ctx, chest.x + i * 8 * a.compress, chest.y - 1, chest.x + i * 5 * a.compress, pelvis.y + 13, i === 0 ? palette.metal : palette.metalDark, 1.15, 0.7);
      }

      poly(ctx, [
        { x: pelvis.x - waistW * 0.92, y: pelvis.y + 14 },
        { x: pelvis.x + waistW * 0.92, y: pelvis.y + 14 },
        { x: pelvis.x + waistW * 0.84, y: pelvis.y + 20 },
        { x: pelvis.x - waistW * 0.84, y: pelvis.y + 20 }
      ], 'rgba(47,35,29,0.48)', palette.outline, 0.8);
    }
  }


  function fighterMetalGradient(ctx, x0, y0, x1, y1, palette, darkBias = 0) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, darkBias ? (palette.metal || '#c5c9c4') : (palette.metalHi || '#dbe2df'));
    g.addColorStop(0.34, palette.metal || '#c5c9c4');
    g.addColorStop(0.70, palette.metalDark || '#5a6469');
    g.addColorStop(1, darkBias ? '#252a2f' : 'rgba(255,255,255,0.18)');
    return g;
  }

  function drawFighterQuadPlate(ctx, pts, fill, palette, edgeAlpha = 0.62, strokeWidth = 0.55) {
    if (!pts || pts.length !== 4) return;
    poly(ctx, pts, fill, 'rgba(10,12,15,0.74)', strokeWidth);
    line(ctx, pts[0].x, pts[0].y, pts[1].x, pts[1].y, 'rgba(255,255,255,0.28)', 0.72, edgeAlpha);
    line(ctx, pts[0].x, pts[0].y, pts[3].x, pts[3].y, 'rgba(255,255,255,0.18)', 0.58, edgeAlpha * 0.75);
    line(ctx, pts[1].x, pts[1].y, pts[2].x, pts[2].y, 'rgba(0,0,0,0.48)', 0.7, edgeAlpha);
    line(ctx, pts[2].x, pts[2].y, pts[3].x, pts[3].y, 'rgba(0,0,0,0.52)', 0.74, edgeAlpha);
  }

  function drawFighterRivet(ctx, x, y, palette, r = 1.15, alpha = 0.72) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ellipse(ctx, x, y, r, r * 0.78, 0, palette.metalHi || '#dbe2df', 'rgba(0,0,0,0.58)', 0.45);
    ctx.restore();
  }

  function drawFighterVentedInset(ctx, x, y, w, h, palette, flip = 1) {
    roundRect(ctx, x - w / 2, y - h / 2, w, h, 1.4, 'rgba(18,23,26,0.72)', 'rgba(0,0,0,0.72)', 0.55);
    for (let i = -1; i <= 1; i++) {
      line(ctx, x - w * 0.32, y + i * h * 0.22, x + w * 0.30 * flip, y + i * h * 0.22 - flip * 0.5, palette.metalDark, 0.55, 0.70);
      line(ctx, x - w * 0.32, y + i * h * 0.22 - 0.7, x + w * 0.30 * flip, y + i * h * 0.22 - flip * 0.5 - 0.7, 'rgba(255,255,255,0.16)', 0.35, 0.55);
    }
  }

  function drawPremiumFighterTorsoPlateMesh(ctx, a, palette, opts) {
    const c = a.chest;
    const p = a.pelvis;
    const co = a.compress || 1;
    const topW = (opts.isSide ? 16 : opts.isFrontDiag ? 24 : 29) * co;
    const waistW = (opts.isSide ? 11 : opts.isFrontDiag ? 16 : 19) * co;
    const metal = fighterMetalGradient(ctx, c.x - topW, c.y - 18, c.x + topW, p.y + 24, palette, opts.isBack ? 1 : 0);

    ctx.save();
    ctx.globalAlpha = opts.isBack ? 0.82 : 0.92;

    if (opts.isSide) {
      const sx = opts.side || a.side || 1;
      drawFighterQuadPlate(ctx, [
        { x: c.x - topW * 0.40, y: c.y - 11 }, { x: c.x + topW * 0.34, y: c.y - 13 },
        { x: c.x + waistW * 0.42, y: c.y + 10 }, { x: c.x - waistW * 0.30, y: c.y + 15 }
      ], metal, palette, 0.58, 0.52);
      drawFighterQuadPlate(ctx, [
        { x: c.x - waistW * 0.32, y: c.y + 15 }, { x: c.x + waistW * 0.42, y: c.y + 10 },
        { x: p.x + waistW * 0.34, y: p.y + 16 }, { x: p.x - waistW * 0.18, y: p.y + 20 }
      ], 'rgba(90,100,105,0.55)', palette, 0.52, 0.50);
      line(ctx, c.x + sx * topW * 0.26, c.y - 7, p.x + sx * waistW * 0.24, p.y + 16, 'rgba(8,9,11,0.82)', 1.15, 0.72);
      drawFighterVentedInset(ctx, c.x - sx * topW * 0.10, c.y + 1, 6.5 * co, 9.5, palette, sx);
      drawFighterRivet(ctx, c.x + sx * topW * 0.18, c.y - 7, palette, 0.95, 0.62);
      drawFighterRivet(ctx, p.x + sx * waistW * 0.20, p.y + 13, palette, 0.95, 0.62);
      ctx.restore();
      return;
    }

    if (opts.isBack) {
      const spineW = Math.max(4, 6 * co);
      for (let i = 0; i < 4; i++) {
        const y0 = c.y - 10 + i * 8.2;
        drawFighterQuadPlate(ctx, [
          { x: c.x - spineW * 0.54, y: y0 }, { x: c.x + spineW * 0.54, y: y0 },
          { x: c.x + spineW * 0.42, y: y0 + 5.3 }, { x: c.x - spineW * 0.42, y: y0 + 5.3 }
        ], 'rgba(42,49,54,0.72)', palette, 0.46, 0.48);
      }
      for (const s of [-1, 1]) {
        drawFighterQuadPlate(ctx, [
          { x: c.x + s * topW * 0.20, y: c.y - 12 }, { x: c.x + s * topW * 0.78, y: c.y - 9 },
          { x: p.x + s * waistW * 0.58, y: p.y + 10 }, { x: c.x + s * waistW * 0.12, y: c.y + 14 }
        ], 'rgba(48,56,61,0.60)', palette, 0.46, 0.48);
        line(ctx, c.x + s * topW * 0.52, c.y - 8, p.x + s * waistW * 0.38, p.y + 9, 'rgba(0,0,0,0.42)', 0.72, 0.55);
      }
      ctx.restore();
      return;
    }

    for (const s of [-1, 1]) {
      drawFighterQuadPlate(ctx, [
        { x: c.x + s * topW * 0.10, y: c.y - 12 }, { x: c.x + s * topW * 0.78, y: c.y - 8 },
        { x: c.x + s * topW * 0.55, y: c.y + 4 }, { x: c.x + s * topW * 0.06, y: c.y + 3 }
      ], metal, palette, 0.66, 0.55);
      drawFighterQuadPlate(ctx, [
        { x: c.x + s * topW * 0.08, y: c.y + 5 }, { x: c.x + s * topW * 0.54, y: c.y + 6 },
        { x: p.x + s * waistW * 0.44, y: p.y + 11 }, { x: c.x + s * waistW * 0.08, y: p.y + 6 }
      ], 'rgba(118,129,132,0.54)', palette, 0.56, 0.50);
      drawFighterQuadPlate(ctx, [
        { x: c.x + s * waistW * 0.07, y: p.y + 7 }, { x: p.x + s * waistW * 0.43, y: p.y + 12 },
        { x: p.x + s * waistW * 0.33, y: p.y + 20 }, { x: p.x + s * waistW * 0.02, y: p.y + 19 }
      ], 'rgba(71,82,87,0.56)', palette, 0.50, 0.48);

      line(ctx, c.x + s * topW * 0.24, c.y - 5, c.x + s * topW * 0.50, c.y - 3, 'rgba(0,0,0,0.55)', 0.85, 0.58);
      line(ctx, c.x + s * waistW * 0.20, c.y + 12, p.x + s * waistW * 0.34, p.y + 13, 'rgba(255,255,255,0.18)', 0.58, 0.52);
      drawFighterVentedInset(ctx, c.x + s * topW * 0.38, c.y + 1, 6.8 * co, 7.4, palette, s);
      drawFighterRivet(ctx, c.x + s * topW * 0.66, c.y - 5, palette, 0.92, 0.66);
      drawFighterRivet(ctx, p.x + s * waistW * 0.33, p.y + 15, palette, 0.86, 0.58);
    }

    line(ctx, c.x, c.y - 12.5, p.x, p.y + 20, 'rgba(4,5,6,0.78)', 1.05, 0.74);
    line(ctx, c.x - topW * 0.72, c.y - 5, c.x + topW * 0.72, c.y - 5, 'rgba(4,5,6,0.65)', 0.72, 0.62);
    line(ctx, c.x - waistW * 0.50, p.y + 10, c.x + waistW * 0.50, p.y + 10, 'rgba(4,5,6,0.56)', 0.70, 0.55);
    drawFighterQuadPlate(ctx, [
      { x: c.x - topW * 0.11, y: c.y - 9 }, { x: c.x + topW * 0.11, y: c.y - 9 },
      { x: c.x + waistW * 0.10, y: c.y + 2 }, { x: c.x - waistW * 0.10, y: c.y + 2 }
    ], 'rgba(226,229,217,0.28)', palette, 0.46, 0.42);

    ctx.restore();
  }

  function drawPremiumFighterShoulderPlateMesh(ctx, a, palette, opts) {
    const y = a.chest.y - 18;
    const rx = (opts.isSide ? 8.5 : 11.5) * a.compress;
    const shoulders = [
      { x: a.shoulders.left.x, flip: -1, alpha: opts.isBack ? 0.62 : 0.84 },
      { x: a.shoulders.right.x, flip: 1, alpha: opts.isSide ? 0.58 : opts.isBack ? 0.62 : 0.88 }
    ];
    ctx.save();
    for (const sh of shoulders) {
      ctx.globalAlpha = sh.alpha;
      for (let i = 0; i < 3; i++) {
        const yy = y + 1.8 + i * 3.6;
        const inset = i * 1.5;
        line(ctx, sh.x - sh.flip * (rx * 0.68 - inset), yy, sh.x + sh.flip * (rx * 0.72 - inset), yy + 1.1, i === 0 ? 'rgba(255,255,255,0.24)' : 'rgba(0,0,0,0.42)', 0.72, 0.78);
      }
      drawFighterRivet(ctx, sh.x - sh.flip * rx * 0.42, y + 5.2, palette, 0.85, 0.58);
      drawFighterRivet(ctx, sh.x + sh.flip * rx * 0.45, y + 6.2, palette, 0.85, 0.58);
    }
    ctx.restore();
  }

  function drawPremiumFighterLegPlateMesh(ctx, a, palette, opts) {
    const legs = [a.legs.left, a.legs.right];
    ctx.save();
    ctx.globalAlpha = opts.isBack ? 0.60 : 0.82;
    for (const leg of legs) {
      const dx = leg.foot.x - leg.knee.x;
      const side = dx >= 0 ? 1 : -1;
      const thighW = 4.4 * a.compress;
      drawFighterQuadPlate(ctx, [
        { x: leg.hip.x - thighW, y: leg.hip.y + 4 }, { x: leg.hip.x + thighW, y: leg.hip.y + 4 },
        { x: leg.knee.x + thighW * 0.70, y: leg.knee.y - 4 }, { x: leg.knee.x - thighW * 0.70, y: leg.knee.y - 4 }
      ], 'rgba(77,88,94,0.42)', palette, 0.38, 0.42);
      for (let i = 0; i < 3; i++) {
        const t = (i + 1) / 4;
        const x = leg.knee.x * (1 - t) + leg.foot.x * t;
        const y = (leg.knee.y + 5) * (1 - t) + (leg.foot.y - 7) * t;
        line(ctx, x - side * 3.1, y, x + side * 3.6, y + 0.4, i === 1 ? 'rgba(0,0,0,0.50)' : 'rgba(255,255,255,0.18)', 0.62, 0.58);
      }
      drawFighterRivet(ctx, leg.knee.x - side * 2.4, leg.knee.y + 2.2, palette, 0.72, 0.50);
      drawFighterRivet(ctx, leg.knee.x + side * 2.4, leg.knee.y + 2.2, palette, 0.72, 0.50);
    }
    ctx.restore();
  }

  function drawPremiumFighterArmPlateMesh(ctx, a, palette, opts) {
    const arms = [a.weaponArm, a.shieldArm];
    ctx.save();
    ctx.globalAlpha = opts.isSide ? 0.64 : 0.76;
    for (const arm of arms) {
      const sx = arm.hand.x >= arm.elbow.x ? 1 : -1;
      drawFighterQuadPlate(ctx, [
        { x: arm.elbow.x - sx * 4.0, y: arm.elbow.y + 3.5 }, { x: arm.elbow.x + sx * 4.0, y: arm.elbow.y + 3.5 },
        { x: arm.hand.x + sx * 3.1, y: arm.hand.y - 6.2 }, { x: arm.hand.x - sx * 3.1, y: arm.hand.y - 6.2 }
      ], 'rgba(70,80,86,0.54)', palette, 0.42, 0.44);
      line(ctx, arm.elbow.x - sx * 2.5, arm.elbow.y + 6.2, arm.hand.x - sx * 2.0, arm.hand.y - 8.2, 'rgba(255,255,255,0.20)', 0.52, 0.52);
      line(ctx, arm.elbow.x + sx * 2.7, arm.elbow.y + 6.2, arm.hand.x + sx * 2.0, arm.hand.y - 8.2, 'rgba(0,0,0,0.48)', 0.56, 0.55);
    }
    ctx.restore();
  }

  function drawPremiumFighterShoulders(ctx, a, palette, opts) {
    const y = a.chest.y - 18;
    const leftX = a.shoulders.left.x;
    const rightX = a.shoulders.right.x;
    const rx = (opts.isSide ? 8.5 : 11.5) * a.compress;
    const drawPauldron = (x, flip, near, scaleMul) => {
      const rx2 = rx * (scaleMul || 1);
      const fill = near ? palette.metal : palette.metalDark;
      poly(ctx, [
        { x: x - flip * rx2, y: y + 6 },
        { x: x - flip * rx2 * 0.38, y: y - 5 },
        { x: x + flip * rx2 * 0.72, y: y - 3 },
        { x: x + flip * rx2 * 1.06, y: y + 7 },
        { x: x + flip * rx2 * 0.62, y: y + 11 },
        { x: x - flip * rx2 * 0.34, y: y + 13 },
        { x: x - flip * rx2 * 0.86, y: y + 10 }
      ], fill, palette.outline, 1.7);
      poly(ctx, [
        { x: x - flip * rx2 * 0.72, y: y + 3 },
        { x: x - flip * rx2 * 0.2, y: y - 2 },
        { x: x + flip * rx2 * 0.46, y: y + 0.5 },
        { x: x + flip * rx2 * 0.18, y: y + 7.4 },
        { x: x - flip * rx2 * 0.42, y: y + 8.1 }
      ], 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0.06)', 0.7);
      line(ctx, x - flip * rx2 * 0.55, y + 3, x + flip * rx2 * 0.60, y + 4, palette.metal, 1.0, 0.68);
      line(ctx, x - flip * rx2 * 0.45, y + 8, x + flip * rx2 * 0.32, y + 9, palette.accentDark, 0.85, 0.54);
    };
    drawPauldron(leftX, -1, !opts.isBack, 1.0);
    drawPauldron(rightX, 1, !opts.isBack && !opts.isSide, 1.1);
  }

  function drawPremiumFighterSwordArm(ctx, a, palette, opts) {
    const arm = a.weaponArm;
    const side = a.weaponSide;
    line(ctx, arm.shoulder.x, arm.shoulder.y, arm.elbow.x, arm.elbow.y, palette.outline, 8.6, 1);
    line(ctx, arm.shoulder.x, arm.shoulder.y, arm.elbow.x, arm.elbow.y, palette.cloth, 5.5, 1);
    line(ctx, arm.shoulder.x + side * 0.8, arm.shoulder.y + 2, arm.elbow.x + side * 0.5, arm.elbow.y, palette.clothHi, 2.2, 0.7);
    line(ctx, arm.elbow.x, arm.elbow.y, arm.hand.x, arm.hand.y, palette.outline, 7.6, 1);
    line(ctx, arm.elbow.x, arm.elbow.y, arm.hand.x, arm.hand.y, palette.metalDark, 4.7, 1);
    roundRect(ctx, arm.elbow.x - 3.3, arm.elbow.y - 1, 6.6, 10.8, 2, palette.metal, palette.outline, 0.9);
    roundRect(ctx, arm.hand.x - 3.6, arm.hand.y - 7.6, 7.2, 9.4, 2, palette.metalDark, palette.outline, 0.85);
    ellipse(ctx, arm.hand.x, arm.hand.y, 4.8, 5.2, 0, palette.skin, palette.outline, 1.2);
    if (!opts.hideWeapon) drawPremiumFighterSword(ctx, arm.hand.x + side * 4, arm.hand.y - 10, side, opts.attack, palette);
  }

  function drawPremiumFighterShieldArm(ctx, a, palette, opts) {
    const arm = a.shieldArm;
    const side = a.shieldSide;
    line(ctx, arm.shoulder.x, arm.shoulder.y, arm.elbow.x, arm.elbow.y, palette.outline, 8.5, 1);
    line(ctx, arm.shoulder.x, arm.shoulder.y, arm.elbow.x, arm.elbow.y, palette.clothDark, 5.4, 1);
    line(ctx, arm.shoulder.x + side * 0.6, arm.shoulder.y + 2, arm.elbow.x + side * 0.4, arm.elbow.y + 1, palette.clothHi, 1.9, 0.55);
    line(ctx, arm.elbow.x, arm.elbow.y, arm.hand.x, arm.hand.y, palette.outline, 7.5, 1);
    line(ctx, arm.elbow.x, arm.elbow.y, arm.hand.x, arm.hand.y, palette.metalDark, 4.5, 1);
    roundRect(ctx, arm.elbow.x - 3.1, arm.elbow.y - 1, 6.2, 10.2, 2, palette.metalDark, palette.outline, 0.85);
    ellipse(ctx, arm.hand.x, arm.hand.y, 4.4, 4.9, 0, palette.skinShadow, palette.outline, 1.1);
    if (!opts.hideShield) drawPremiumFighterSideShield(ctx, arm.hand.x + side * 7, arm.hand.y - 2, side, opts, palette);
  }

  function drawPremiumFighterBeltAndSkirt(ctx, a, palette, opts) {
    const y = a.pelvis.y + 5;
    const seated = opts.meditate ? 1 : 0;
    roundRect(ctx, a.pelvis.x - 21 * a.compress, y - 4, 42 * a.compress, 8, 2, palette.belt, palette.outline, 1.2);
    line(ctx, a.pelvis.x - 18 * a.compress, y - 1, a.pelvis.x + 18 * a.compress, y - 1, palette.accentDark, 0.9, 0.58);
    roundRect(ctx, a.pelvis.x - 4.5, y - 6.5, 9, 12, 2, palette.metal, palette.outline, 1.0);
    line(ctx, a.pelvis.x, y - 4, a.pelvis.x, y + 3, palette.metalDark, 0.9, 0.6);
    poly(ctx, [
      { x: a.pelvis.x - 12 * a.compress, y: y + 5 },
      { x: a.pelvis.x, y: y + 22 - seated * 5 },
      { x: a.pelvis.x + 12 * a.compress, y: y + 5 },
      { x: a.pelvis.x + 4 * a.compress, y: y + 29 - seated * 8 },
      { x: a.pelvis.x - 4 * a.compress, y: y + 29 - seated * 8 }
    ], palette.cloth, palette.outline, 1.3);
    line(ctx, a.pelvis.x - 7 * a.compress, y + 11, a.pelvis.x + 7 * a.compress, y + 11, palette.accentDark, 0.85, 0.54);
    line(ctx, a.pelvis.x - 4 * a.compress, y + 18, a.pelvis.x + 4 * a.compress, y + 18, palette.clothHi, 0.8, 0.5);
  }

  function drawPremiumFighterHead(ctx, a, palette, actor, opts) {
    const h = a.head;
    const skin = opts.isBack ? palette.hair : palette.skin;
    roundRect(ctx, h.x - 4, h.bottom - 4, 8, 10, 3, opts.isBack ? palette.clothDark : palette.skinShadow, palette.outline, 1.1);
    ellipse(ctx, h.x, h.y, h.rx, h.ry, 0.04 * (opts.side || 0), skin, palette.outline, 1.8);

    if (!opts.isBack) drawPremiumFighterFace(ctx, h, palette, actor, opts);
    drawPremiumFighterHair(ctx, h, palette, actor, opts);
    drawPremiumFighterBrowBand(ctx, h, palette, opts);
  }

  function drawPremiumFighterFace(ctx, h, palette, actor, opts) {
    const eyeColor = actor.eyeColor || actor.visualPalette?.eye || '#8ec9ff';
    if (opts.isSide) {
      const s = opts.side || 1;
      const ex = h.x + s * 4;
      ctx.fillStyle = '#100b08';
      ctx.fillRect(ex - (s < 0 ? 5 : 0), h.y - 4, 6, 4);
      ctx.fillStyle = eyeColor;
      ctx.fillRect(ex - (s < 0 ? 4 : -1), h.y - 3, 3, 2);
      line(ctx, h.x + s * 1, h.y + 1, h.x + s * 6, h.y + 4, palette.skinShadow, 1.1, 0.7);
      line(ctx, h.x + s * 2, h.y + 9, h.x + s * 8, h.y + 8, '#633427', 1.2, 0.85);
      return;
    }
    ctx.fillStyle = '#100b08';
    ctx.fillRect(h.x - 8, h.y - 5, 7, 4);
    ctx.fillRect(h.x + 1, h.y - 5, 7, 4);
    ctx.fillStyle = eyeColor;
    ctx.fillRect(h.x - 6, h.y - 4, 3, 2);
    ctx.fillRect(h.x + 3, h.y - 4, 3, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillRect(h.x - 4, h.y - 4, 1, 1);
    ctx.fillRect(h.x + 5, h.y - 4, 1, 1);
    line(ctx, h.x - 9, h.y - 8, h.x - 2, h.y - 7, '#24150f', 1.25, 0.9);
    line(ctx, h.x + 2, h.y - 7, h.x + 9, h.y - 8, '#24150f', 1.25, 0.9);
    line(ctx, h.x, h.y + 0, h.x - 1, h.y + 5, palette.skinShadow, 1.1, 0.7);
    line(ctx, h.x - 4, h.y + 10, h.x + 4, h.y + 10, '#633427', 1.2, 0.82);
  }

  function drawPremiumFighterHair(ctx, h, palette, actor, opts) {
    if (DR.Hairstyles?.drawHumanoid?.(ctx, { actor, anchors: { head: h }, dir: { side: opts.side || 1, backVisible: opts.isBack } }, palette)) return;
    const style = String(actor.hairStyle || 'short').toLowerCase();
    const s = opts.side || 1;
    const g = ctx.createLinearGradient(h.x - 14, h.y - 18, h.x + 14, h.y + 3);
    g.addColorStop(0, palette.hairHi || '#6b4631');
    g.addColorStop(0.62, palette.hair || '#3a271f');
    g.addColorStop(1, '#1b100d');

    if (opts.isBack) {
      ellipse(ctx, h.x, h.y - 4, h.rx + 1, h.ry - 1, 0, g, palette.outline, 1.3);
      if (style === 'long' || style === 'loosewaves') roundRect(ctx, h.x - h.rx - 1, h.y - 2, h.rx * 2 + 2, 26, 6, g, palette.outline, 1.2);
      return;
    }

    if (style === 'long' || style === 'loosewaves') {
      poly(ctx, [
        { x: h.x - h.rx - 2, y: h.y - 12 }, { x: h.x + h.rx + 2, y: h.y - 12 },
        { x: h.x + h.rx + 1, y: h.y + 17 }, { x: h.x - h.rx - 1, y: h.y + 17 }
      ], g, palette.outline, 1.35);
    } else if (style === 'ponytail' || style === 'braid') {
      ellipse(ctx, h.x + s * 15, h.y + 1, 5, style === 'braid' ? 19 : 15, -0.14 * s, palette.hair, palette.outline, 1.1);
    } else if (style === 'mohawk') {
      poly(ctx, [
        { x: h.x - 4, y: h.y - 18 }, { x: h.x, y: h.y - 27 }, { x: h.x + 4, y: h.y - 18 }, { x: h.x + 1, y: h.y - 8 }, { x: h.x - 1, y: h.y - 8 }
      ], g, palette.outline, 1.2);
    }

    poly(ctx, [
      { x: h.x - h.rx - 2, y: h.y - 10 },
      { x: h.x - 6, y: h.y - 17 },
      { x: h.x + 4, y: h.y - 16 },
      { x: h.x + h.rx + 2, y: h.y - 9 },
      { x: h.x + h.rx * 0.6, y: h.y - 1 },
      { x: h.x - h.rx * 0.7, y: h.y + 1 }
    ], g, palette.outline, 1.35);
  }

  function drawPremiumFighterBrowBand(ctx, h, palette, opts) {
    if (opts.isBack) return;
    line(ctx, h.x - h.rx + 2, h.y - 10, h.x + h.rx - 2, h.y - 10, palette.belt, 2.0, 0.82);
    line(ctx, h.x - h.rx + 4, h.y - 11, h.x + h.rx - 4, h.y - 11, palette.accent, 0.8, 0.52);
  }

  function drawPremiumFighterSword(ctx, x, y, side, attack, palette) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(side * (0.10 - attack * 0.42));
    const bladeLen = 38;
    poly(ctx, [
      { x: -2.8, y: 5 }, { x: -3.8, y: -bladeLen + 7 }, { x: 0, y: -bladeLen - 6 }, { x: 3.8, y: -bladeLen + 7 }, { x: 2.8, y: 5 }
    ], palette.metal, palette.outline, 1.0);
    poly(ctx, [
      { x: -1.2, y: 4 }, { x: -1.8, y: -bladeLen + 8 }, { x: 0, y: -bladeLen + 2 }, { x: 1.8, y: -bladeLen + 8 }, { x: 1.2, y: 4 }
    ], 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.04)', 0.5);
    line(ctx, 0, 2, 0, -bladeLen + 1, 'rgba(255,238,180,0.72)', 1.15, 0.76);
    line(ctx, -1.4, -bladeLen + 10, -1.4, -4, 'rgba(90,102,105,0.55)', 0.7, 0.55);
    line(ctx, 1.4, -bladeLen + 10, 1.4, -4, 'rgba(90,102,105,0.55)', 0.7, 0.55);
    poly(ctx, [
      { x: -9, y: 4.8 }, { x: 9, y: 4.8 }, { x: 7.2, y: 7.4 }, { x: -7.2, y: 7.4 }
    ], palette.accentDark, palette.outline, 0.95);
    roundRect(ctx, -3.2, 6.2, 6.4, 12.5, 2, palette.belt, palette.outline, 0.85);
    drawDiamond(ctx, 0, 9.3, 1.7, palette.accent, palette.outline);
    ctx.restore();
  }

  function drawPremiumFighterSideShield(ctx, x, y, side, opts, palette) {
    const sideView = opts.isSide;
    const diag = opts.isFrontDiag;
    const sx = sideView ? 0.62 : diag ? 0.82 : 0.92;
    const sy = sideView ? 0.78 : diag ? 0.90 : 0.96;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, sy);
    ctx.rotate(side * (sideView ? -0.06 : diag ? -0.05 : 0.0));

    const g = ctx.createLinearGradient(-17, -26, 17, 31);
    g.addColorStop(0, palette.metalHi || '#dbe2df');
    g.addColorStop(0.18, palette.metal || '#c5c9c4');
    g.addColorStop(0.52, palette.metalDark || '#5a6469');
    g.addColorStop(1, '#2d3338');
    const rim = [
      { x: -15, y: -23 }, { x: 15, y: -23 }, { x: 14, y: 8 }, { x: 7, y: 26 }, { x: 0, y: 32 }, { x: -7, y: 26 }, { x: -14, y: 8 }
    ];
    poly(ctx, rim, g, palette.outline, 1.45);
    poly(ctx, [
      { x: -11, y: -18 }, { x: 11, y: -18 }, { x: 10, y: 6 }, { x: 4.8, y: 22 }, { x: 0, y: 25.5 }, { x: -4.8, y: 22 }, { x: -10, y: 6 }
    ], 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.06)', 0.6);
    poly(ctx, [
      { x: 0, y: -14 }, { x: 7, y: -3 }, { x: 4, y: 13 }, { x: 0, y: 18 }, { x: -4, y: 13 }, { x: -7, y: -3 }
    ], palette.accent, palette.outline, 0.85);
    line(ctx, -10, -11, 10, -11, palette.metal, 1.1, 0.62);
    line(ctx, 0, -18, 0, 23, palette.metal, 1.1, 0.6);
    line(ctx, -8, 4, 8, 4, palette.metalDark, 0.85, 0.42);
    // High-poly-style shield plate segmentation: layered bevel loops, fasteners, and inset service plates without expanding the shield silhouette.
    drawFighterQuadPlate(ctx, [
      { x: -9, y: -16 }, { x: 9, y: -16 }, { x: 7.5, y: -7.5 }, { x: -7.5, y: -7.5 }
    ], 'rgba(225,231,226,0.22)', palette, 0.48, 0.38);
    drawFighterQuadPlate(ctx, [
      { x: -8.5, y: 8 }, { x: 8.5, y: 8 }, { x: 5, y: 20 }, { x: -5, y: 20 }
    ], 'rgba(38,48,54,0.34)', palette, 0.42, 0.36);
    for (const sx of [-1, 1]) {
      drawFighterRivet(ctx, sx * 10.2, -14.2, palette, 0.82, 0.58);
      drawFighterRivet(ctx, sx * 8.4, 7.0, palette, 0.76, 0.52);
      line(ctx, sx * 11.8, -18, sx * 10.5, 8, 'rgba(255,255,255,0.14)', 0.45, 0.48);
    }
    drawDiamond(ctx, 0, -1.5, 2.2, 'rgba(255,245,208,0.85)', palette.outline);
    ctx.restore();
  }

  function drawPremiumFighterBackWeaponHint(ctx, a, palette, side) {
    ctx.save();
    ctx.globalAlpha = 0.68;
    drawPremiumFighterSword(ctx, a.chest.x + 16 * side, a.chest.y - 5, side, 0, palette);
    ctx.restore();
  }

  function drawPremiumFighterFrontDetails(ctx, a, palette, opts) {
    const attack = opts.attack || 0;
    const ready = opts.ready || 0;
    const readyPulse = opts.readyPulse || 0;
    if (attack > 0.2) drawSlash(ctx, a.weaponArm.hand.x + a.weaponSide * 10, a.weaponArm.hand.y - 18, '#ffe0a3', 0.45 + attack * 0.35);
    if (ready && !attack) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.18 + readyPulse * 0.16;
      drawCommitArc(ctx, a.weaponArm.hand.x + a.weaponSide * 3, a.weaponArm.hand.y - 12, a.weaponSide, 13 + readyPulse * 4, palette.glow, 0.18 + readyPulse * 0.16);
      line(ctx, a.shieldArm.hand.x - a.weaponSide * 4, a.shieldArm.hand.y - 5, a.shieldArm.hand.x + a.weaponSide * 7, a.shieldArm.hand.y - 5, palette.metal, 0.9, 0.32);
      ctx.restore();
    }
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.10;
    ellipse(ctx, a.chest.x, a.chest.y + 3, 23 * a.compress, 28, 0, palette.glow, palette.glow, 0);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.22;
    line(ctx, a.chest.x - 11 * a.compress, a.chest.y - 9, a.chest.x - 2, a.chest.y - 15, '#fff1c7', 0.8, 0.45);
    line(ctx, a.chest.x + 11 * a.compress, a.chest.y - 9, a.chest.x + 2, a.chest.y - 15, '#fff1c7', 0.8, 0.45);
    ctx.restore();
  }


  function drawBruiserFighterBackLayer(ctx, a, palette, opts = {}) {
    const side = opts.side || a.weaponSide || 1;
    const backFill = palette.fur || '#6b5742';
    const furHi = palette.furHi || '#b29a76';
    ctx.save();
    ctx.globalAlpha = 0.94;
    const mantleY = a.chest.y - 23;
    poly(ctx, [
      { x: a.chest.x - 25 * a.compress, y: mantleY + 4 },
      { x: a.chest.x - 12 * a.compress, y: mantleY - 7 },
      { x: a.chest.x + 12 * a.compress, y: mantleY - 7 },
      { x: a.chest.x + 25 * a.compress, y: mantleY + 4 },
      { x: a.chest.x + 19 * a.compress, y: mantleY + 22 },
      { x: a.chest.x + 7 * a.compress, y: mantleY + 14 },
      { x: a.chest.x, y: mantleY + 24 },
      { x: a.chest.x - 7 * a.compress, y: mantleY + 14 },
      { x: a.chest.x - 19 * a.compress, y: mantleY + 22 }
    ], backFill, palette.outline, 1.4);
    for (let i = -4; i <= 4; i++) {
      const x = a.chest.x + i * 5.2 * a.compress;
      line(ctx, x, mantleY - 4 + Math.abs(i) * 1.2, x + (i % 2 ? side * 2 : -side * 2), mantleY + 17 + (i % 3) * 2, i % 2 ? furHi : palette.clothDark, 1.0, 0.42);
    }
    line(ctx, a.chest.x - 16 * a.compress, a.chest.y - 18, a.pelvis.x + 13 * a.compress, a.pelvis.y + 13, palette.belt, 3.1, 0.8);
    line(ctx, a.chest.x + 16 * a.compress, a.chest.y - 18, a.pelvis.x - 13 * a.compress, a.pelvis.y + 13, palette.belt, 3.1, 0.8);
    if (!opts.hideWeapon && !opts.meditate && !opts.fishing && !opts.swimming) {
      drawBruiserFighterBackGreatweapon(ctx, a, palette, { side, isBack: opts.isBack, isSide: opts.isSide, isFrontDiag: opts.isFrontDiag });
    }
    ctx.restore();
  }

  function drawBruiserFighterLegs(ctx, a, palette, pose, backFacing) {
    const drawLeg = (leg, front, flip) => {
      const hide = front && !backFacing ? palette.clothHi : palette.cloth;
      const shade = front && !backFacing ? palette.cloth : palette.clothDark;
      line(ctx, leg.hip.x, leg.hip.y, leg.knee.x, leg.knee.y, palette.outline, 10.0, 1);
      line(ctx, leg.hip.x, leg.hip.y, leg.knee.x, leg.knee.y, hide, 7.4, 1);
      line(ctx, leg.hip.x + flip * 2.1, leg.hip.y + 2, leg.knee.x + flip * 1.5, leg.knee.y - 1, shade, 3.0, 0.8);
      line(ctx, leg.hip.x - flip * 2.0, leg.hip.y + 8, leg.knee.x + flip * 3.5, leg.knee.y + 1, palette.belt, 1.2, 0.62);
      poly(ctx, [
        { x: leg.knee.x - 5.2, y: leg.knee.y - 1 },
        { x: leg.knee.x + 5.2, y: leg.knee.y - 1 },
        { x: leg.knee.x + 4.0, y: leg.knee.y + 6.2 },
        { x: leg.knee.x, y: leg.knee.y + 8.5 },
        { x: leg.knee.x - 4.0, y: leg.knee.y + 6.2 }
      ], palette.belt, palette.outline, 1.0);
      line(ctx, leg.knee.x, leg.knee.y + 4, leg.foot.x, leg.foot.y - 2, palette.outline, 9.0, 1);
      line(ctx, leg.knee.x, leg.knee.y + 4, leg.foot.x, leg.foot.y - 2, shade, 6.2, 1);
      line(ctx, leg.knee.x - flip * 2.8, leg.knee.y + 9, leg.foot.x - flip * 2.8, leg.foot.y - 5, palette.belt, 1.0, 0.62);
      ellipse(ctx, leg.foot.x, leg.foot.y + 2.0, 8.4, 4.8, 0.07 * flip, front ? palette.bootHi : palette.boot, palette.outline, 1.35);
      line(ctx, leg.foot.x - 3.9, leg.foot.y, leg.foot.x + 4.6, leg.foot.y, palette.metalDark, 1.0, 0.48);
      if (front && !backFacing) {
        line(ctx, leg.hip.x + flip * 7.0, leg.hip.y + 2, leg.knee.x + flip * 5.6, leg.knee.y + 10, palette.outline, 3.3, 0.65);
        line(ctx, leg.hip.x + flip * 7.0, leg.hip.y + 2, leg.knee.x + flip * 5.6, leg.knee.y + 10, palette.metalDark, 1.7, 0.75);
      }
    };
    drawLeg(a.legs.left, false, -1);
    drawLeg(a.legs.right, true, 1);
  }

  function drawBruiserFighterMeditationLegs(ctx, a, palette, opts = {}) {
    const c = a.pelvis;
    const flat = opts.isSide ? 0.70 : opts.isFrontDiag ? 0.86 : 1;
    const y = c.y + 18;
    ctx.save();
    ellipse(ctx, c.x, y + 11, 27 * flat * a.compress, 8, 0, 'rgba(0,0,0,0.27)', null, 0);
    poly(ctx, [
      { x: c.x - 4 * a.compress, y: y - 2 }, { x: c.x - 26 * flat * a.compress, y: y + 9 },
      { x: c.x - 23 * flat * a.compress, y: y + 18 }, { x: c.x - 2 * a.compress, y: y + 10 }
    ], palette.clothDark, palette.outline, 1.35);
    poly(ctx, [
      { x: c.x + 4 * a.compress, y: y - 2 }, { x: c.x + 26 * flat * a.compress, y: y + 9 },
      { x: c.x + 23 * flat * a.compress, y: y + 18 }, { x: c.x + 2 * a.compress, y: y + 10 }
    ], palette.cloth, palette.outline, 1.35);
    line(ctx, c.x - 18 * flat * a.compress, y + 13, c.x + 18 * flat * a.compress, y + 13, palette.belt, 1.2, 0.56);
    ellipse(ctx, c.x - 28 * flat * a.compress, y + 17, 8.0 * flat, 4.6, -0.15, palette.boot, palette.outline, 1.15);
    ellipse(ctx, c.x + 28 * flat * a.compress, y + 17, 8.0 * flat, 4.6, 0.15, palette.bootHi, palette.outline, 1.15);
    ctx.restore();
  }

  function drawBruiserFighterTorso(ctx, a, palette, opts = {}) {
    const chest = a.chest;
    const pelvis = a.pelvis;
    const topW = (opts.isSide ? 16 : opts.isFrontDiag ? 24 : 29) * a.compress;
    const waistW = (opts.isSide ? 11 : opts.isFrontDiag ? 16 : 19) * a.compress;
    const g = ctx.createLinearGradient(chest.x - topW, chest.y - 20, chest.x + topW, pelvis.y + 26);
    g.addColorStop(0, palette.clothHi || '#9b6240');
    g.addColorStop(0.42, palette.cloth || '#5f3827');
    g.addColorStop(1, palette.clothDark || '#24140f');
    poly(ctx, [
      { x: chest.x - topW, y: chest.y - 15 },
      { x: chest.x + topW, y: chest.y - 15 },
      { x: pelvis.x + waistW, y: pelvis.y + 17 },
      { x: pelvis.x + waistW * 0.72, y: pelvis.y + 29 },
      { x: pelvis.x - waistW * 0.72, y: pelvis.y + 29 },
      { x: pelvis.x - waistW, y: pelvis.y + 17 }
    ], g, palette.outline, 1.8);
    // Leather scale rows instead of plate ribs.
    for (let row = 0; row < 4; row++) {
      const yy = chest.y - 7 + row * 8.0;
      const rowW = (topW - row * 3.2) * 0.72;
      for (let i = -2; i <= 2; i++) {
        const sx = chest.x + i * rowW / 2.6 + (row % 2 ? rowW / 5.2 : 0);
        poly(ctx, [
          { x: sx - 4.6, y: yy - 2.5 }, { x: sx + 4.6, y: yy - 2.5 },
          { x: sx + 3.0, y: yy + 4.0 }, { x: sx, y: yy + 6.2 }, { x: sx - 3.0, y: yy + 4.0 }
        ], row % 2 ? 'rgba(126,76,45,0.68)' : 'rgba(82,48,30,0.70)', 'rgba(29,16,10,0.72)', 0.55);
      }
    }
    line(ctx, chest.x - topW * 0.85, chest.y - 12, pelvis.x + waistW * 0.70, pelvis.y + 19, palette.belt, 3.0, 0.78);
    line(ctx, chest.x + topW * 0.85, chest.y - 12, pelvis.x - waistW * 0.70, pelvis.y + 19, palette.belt, 3.0, 0.78);
    roundRect(ctx, pelvis.x - 17 * a.compress, pelvis.y + 3, 34 * a.compress, 8, 2, palette.belt, palette.outline, 1.1);
  }

  function drawBruiserFighterShoulders(ctx, a, palette, opts = {}) {
    const left = a.shoulders.left;
    const right = a.shoulders.right;
    const bulkSide = opts.side || 1;
    const drawFur = (s, heavy) => {
      const sh = s < 0 ? left : right;
      const rx = heavy ? 13 : 10;
      const fill = heavy ? (palette.furHi || '#b29a76') : (palette.fur || '#6b5742');
      poly(ctx, [
        { x: sh.x - s * 2, y: sh.y - 8 }, { x: sh.x + s * rx, y: sh.y - 5 },
        { x: sh.x + s * (rx + 4), y: sh.y + 6 }, { x: sh.x + s * 6, y: sh.y + 12 },
        { x: sh.x - s * 4, y: sh.y + 5 }
      ], fill, palette.outline, 1.2);
      for (let i = 0; i < 4; i++) line(ctx, sh.x + s * (2 + i * 2.7), sh.y - 4 + i, sh.x + s * (8 + i * 2.5), sh.y + 7 + i, palette.clothDark, 0.8, 0.42);
    };
    drawFur(-1, bulkSide < 0);
    drawFur(1, bulkSide > 0);
    const lead = bulkSide > 0 ? right : left;
    poly(ctx, [
      { x: lead.x - bulkSide * 3, y: lead.y - 8 }, { x: lead.x + bulkSide * 13, y: lead.y - 5 },
      { x: lead.x + bulkSide * 15, y: lead.y + 4 }, { x: lead.x + bulkSide * 5, y: lead.y + 9 }
    ], 'rgba(81,52,35,0.86)', palette.outline, 1.0);
  }

  function drawBruiserFighterBackArms(ctx, a, palette, opts = {}) {
    const arm = a.backArm;
    line(ctx, arm.shoulder.x, arm.shoulder.y, arm.elbow.x, arm.elbow.y, palette.outline, 8.2, 0.78);
    line(ctx, arm.shoulder.x, arm.shoulder.y, arm.elbow.x, arm.elbow.y, palette.skinShadow, 5.4, 0.78);
    line(ctx, arm.elbow.x, arm.elbow.y, arm.hand.x, arm.hand.y, palette.outline, 7.2, 0.75);
    line(ctx, arm.elbow.x, arm.elbow.y, arm.hand.x, arm.hand.y, palette.belt, 4.2, 0.75);
  }

  function drawBruiserFighterGreatweaponArms(ctx, a, palette, opts = {}) {
    const main = a.weaponArm;
    const off = a.shieldArm;
    const side = opts.side || a.weaponSide || 1;
    Base.limb(ctx, off.shoulder, off.elbow, palette, { fill: palette.skinShadow, width: 8.5, alpha: 1 });
    Base.limb(ctx, off.elbow, off.hand, palette, { fill: palette.belt, width: 6.4, alpha: 1 });
    roundRect(ctx, off.elbow.x - 3.1, off.elbow.y - 1, 6.2, 9.5, 2, palette.belt, palette.outline, 0.8);
    Base.ellipse(ctx, off.hand.x, off.hand.y, 4.9, 4.7, 0, palette.skinShadow, palette.outline, 1.0);
    if (!opts.hideWeapon) drawBruiserFighterGreatweapon(ctx, (main.hand.x + off.hand.x) / 2 + side * 2, (main.hand.y + off.hand.y) / 2 - 10, side, opts.attack || 0, palette, opts);
    Base.limb(ctx, main.shoulder, main.elbow, palette, { fill: palette.skin, width: 8.9, alpha: 1 });
    Base.limb(ctx, main.elbow, main.hand, palette, { fill: palette.belt, width: 6.6, alpha: 1 });
    roundRect(ctx, main.elbow.x - 3.2, main.elbow.y - 1, 6.4, 10, 2, palette.belt, palette.outline, 0.82);
    Base.ellipse(ctx, main.hand.x, main.hand.y, 5.1, 4.8, 0, palette.skin, palette.outline, 1.05);
    line(ctx, main.hand.x - side * 4, main.hand.y - 1, off.hand.x + side * 3, off.hand.y - 1, palette.belt, 2.2, 0.65);
  }

  function drawBruiserFighterMeditationArms(ctx, a, palette, opts = {}) {
    const drawResting = (arm, side, fill) => {
      line(ctx, arm.shoulder.x, arm.shoulder.y, arm.elbow.x, arm.elbow.y, palette.outline, 8.0, 0.92);
      line(ctx, arm.shoulder.x, arm.shoulder.y, arm.elbow.x, arm.elbow.y, palette.skinShadow, 5.2, 0.92);
      line(ctx, arm.elbow.x, arm.elbow.y, arm.hand.x, arm.hand.y, palette.outline, 7.0, 0.94);
      line(ctx, arm.elbow.x, arm.elbow.y, arm.hand.x, arm.hand.y, fill, 4.5, 0.94);
      ellipse(ctx, arm.hand.x, arm.hand.y, 4.2, 4.4, 0, palette.skinShadow, palette.outline, 1.0);
    };
    drawResting(a.weaponArm, a.weaponSide, palette.belt);
    drawResting(a.shieldArm, a.shieldSide, palette.belt);
    if (!opts.hideWeapon) {
      ctx.save();
      ctx.globalAlpha = 0.82;
      drawBruiserFighterGreatweapon(ctx, a.pelvis.x + a.weaponSide * 3, a.pelvis.y + 23, a.weaponSide, -0.10, palette, { isSide: opts.isSide, isFrontDiag: opts.isFrontDiag });
      ctx.restore();
    }
  }

  function drawBruiserFighterGreatweapon(ctx, x, y, side, attack, palette, opts = {}) {
    ctx.save();
    ctx.translate(x, y);
    const sideView = opts.isSide ? 1 : 0;
    const diag = opts.isFrontDiag ? 1 : 0;
    ctx.rotate(side * (0.18 - attack * 0.82 + sideView * 0.18 - diag * 0.06));
    const bladeLen = 58;
    const bladeW = 6.8;
    const hilt = 22;
    poly(ctx, [
      { x: -bladeW, y: 2 }, { x: -bladeW * 0.72, y: -bladeLen + 12 },
      { x: 0, y: -bladeLen - 9 }, { x: bladeW * 0.72, y: -bladeLen + 12 }, { x: bladeW, y: 2 }
    ], palette.metal || '#b7ad93', palette.outline, 1.2);
    line(ctx, 0, 0, 0, -bladeLen + 1, palette.metalHi || '#e2d7b7', 1.4, 0.82);
    line(ctx, -bladeW * 0.45, -bladeLen + 10, -bladeW * 0.45, -4, palette.metalDark, 0.7, 0.58);
    line(ctx, bladeW * 0.45, -bladeLen + 10, bladeW * 0.45, -4, palette.metalDark, 0.7, 0.58);
    for (let i = 0; i < 3; i++) line(ctx, -3 + i * 3, -bladeLen + 18 + i * 9, 2 + i * 2, -bladeLen + 24 + i * 9, 'rgba(40,31,24,0.50)', 0.9, 0.60);
    poly(ctx, [
      { x: -14, y: 4.0 }, { x: 14, y: 4.0 }, { x: 11.5, y: 7.6 }, { x: -11.5, y: 7.6 }
    ], palette.metalDark, palette.outline, 1.0);
    roundRect(ctx, -3.4, 7, 6.8, hilt, 2, palette.belt, palette.outline, 0.9);
    for (let i = 0; i < 4; i++) line(ctx, -3.1, 10 + i * 4.2, 3.1, 8 + i * 4.2, palette.accentDark, 0.8, 0.55);
    drawDiamond(ctx, 0, 10.8, 1.7, palette.accent, palette.outline);
    ctx.restore();
  }

  function drawBruiserFighterBackGreatweapon(ctx, a, palette, opts = {}) {
    const side = opts.side || a.weaponSide || 1;
    ctx.save();
    ctx.globalAlpha = opts.isBack ? 0.98 : 0.62;
    ctx.translate(a.chest.x + side * 17 * a.compress, a.chest.y - 4);
    ctx.rotate(side * -0.68);
    drawBruiserFighterGreatweapon(ctx, 0, 0, side, 0, palette, { isSide: opts.isSide, isFrontDiag: opts.isFrontDiag });
    ctx.restore();
  }

  function drawBruiserFighterBeltAndAccessories(ctx, a, palette, opts = {}) {
    const y = a.pelvis.y + 5;
    roundRect(ctx, a.pelvis.x - 22 * a.compress, y - 4, 44 * a.compress, 8, 2, palette.belt, palette.outline, 1.2);
    roundRect(ctx, a.pelvis.x - 5.2, y - 7, 10.4, 12.5, 2, palette.metalDark, palette.outline, 1.0);
    drawDiamond(ctx, a.pelvis.x, y - 1, 2.5, palette.metalHi || '#e2d7b7', palette.outline);
    line(ctx, a.pelvis.x - 18 * a.compress, y - 1, a.pelvis.x + 18 * a.compress, y - 1, palette.accentDark, 0.9, 0.54);
    // Pouches, flask, trophy chain, and a small thigh knife. Accessories only; the greatweapon remains the primary silhouette.
    roundRect(ctx, a.pelvis.x - 22 * a.compress, y + 3, 7, 10, 2, '#3b2117', palette.outline, 0.75);
    ellipse(ctx, a.pelvis.x + 19 * a.compress, y + 8, 4.2, 6.2, 0.1, '#3a251b', palette.outline, 0.75);
    for (let i = 0; i < 5; i++) ellipse(ctx, a.pelvis.x - 8 + i * 4, y + 10 + Math.sin(i) * 2, 2.0, 1.4, 0, palette.metalDark, palette.outline, 0.35);
    line(ctx, a.pelvis.x + 11 * a.compress, y + 7, a.pelvis.x + 18 * a.compress, y + 25, palette.outline, 3.0, 0.72);
    line(ctx, a.pelvis.x + 11 * a.compress, y + 7, a.pelvis.x + 18 * a.compress, y + 25, palette.metalDark, 1.5, 0.80);
    poly(ctx, [
      { x: a.pelvis.x - 11 * a.compress, y: y + 5 }, { x: a.pelvis.x, y: y + 19 - (opts.meditate ? 4 : 0) },
      { x: a.pelvis.x + 11 * a.compress, y: y + 5 }, { x: a.pelvis.x + 3.5 * a.compress, y: y + 27 - (opts.meditate ? 7 : 0) },
      { x: a.pelvis.x - 3.5 * a.compress, y: y + 27 - (opts.meditate ? 7 : 0) }
    ], palette.clothDark, palette.outline, 1.0);
  }

  function drawBruiserFighterHead(ctx, a, palette, actor, opts = {}) {
    const h = a.head;
    roundRect(ctx, h.x - 4, h.bottom - 4, 8, 10, 3, opts.isBack ? palette.clothDark : palette.skinShadow, palette.outline, 1.1);
    ellipse(ctx, h.x, h.y, h.rx, h.ry, 0.04 * (opts.side || 0), opts.isBack ? palette.hair : palette.skin, palette.outline, 1.8);
    if (!opts.isBack) {
      drawPremiumFighterFace(ctx, h, palette, actor, opts);
      const s = opts.side || 1;
      line(ctx, h.x - h.rx + 1, h.y - 6, h.x + h.rx - 1, h.y - 2, '#1b0c0a', 2.0, 0.75);
      line(ctx, h.x - 7, h.y + 1, h.x - 1, h.y + 8, palette.accentDark, 1.3, 0.78);
      line(ctx, h.x + 4, h.y - 8, h.x + 8, h.y - 12, 'rgba(255,220,170,0.72)', 0.8, 0.64);
      line(ctx, h.x + s * 2, h.y + 9, h.x + s * 8, h.y + 7, '#5a2017', 1.2, 0.82);
    }
    drawBruiserFighterWildHair(ctx, h, palette, actor, opts);
    drawPremiumFighterBrowBand(ctx, h, palette, opts);
  }

  function drawBruiserFighterWildHair(ctx, h, palette, actor, opts = {}) {
    const s = opts.side || 1;
    const g = ctx.createLinearGradient(h.x - 15, h.y - 20, h.x + 15, h.y + 5);
    g.addColorStop(0, palette.hairHi || '#6d4630');
    g.addColorStop(0.6, palette.hair || '#2b1b14');
    g.addColorStop(1, '#120b08');
    if (opts.isBack) {
      ellipse(ctx, h.x, h.y - 4, h.rx + 2.5, h.ry, 0, g, palette.outline, 1.25);
      poly(ctx, [
        { x: h.x - h.rx - 3, y: h.y - 3 }, { x: h.x + h.rx + 3, y: h.y - 3 },
        { x: h.x + h.rx, y: h.y + 19 }, { x: h.x, y: h.y + 12 }, { x: h.x - h.rx, y: h.y + 19 }
      ], g, palette.outline, 1.05);
      return;
    }
    poly(ctx, [
      { x: h.x - h.rx - 3, y: h.y - 10 }, { x: h.x - 6, y: h.y - 20 },
      { x: h.x - 1, y: h.y - 16 }, { x: h.x + 4, y: h.y - 22 },
      { x: h.x + h.rx + 4, y: h.y - 10 }, { x: h.x + h.rx * 0.7, y: h.y + 1 },
      { x: h.x - h.rx * 0.7, y: h.y + 1 }
    ], g, palette.outline, 1.25);
    for (let i = 0; i < 3; i++) {
      const bx = h.x - s * (h.rx + 2 + i * 1.8);
      line(ctx, bx, h.y - 4 + i * 2, bx - s * (3 + i), h.y + 14 + i * 5, palette.hair, 1.4, 0.82);
      ellipse(ctx, bx - s * (3 + i), h.y + 13 + i * 5, 1.5, 1.5, 0, palette.metalDark, palette.outline, 0.35);
    }
  }

  function drawBruiserFighterFrontDetails(ctx, a, palette, opts = {}) {
    const attack = opts.attack || 0;
    const ready = opts.ready || 0;
    const readyPulse = opts.readyPulse || 0;
    if (attack > 0.18) drawSlash(ctx, a.weaponArm.hand.x + a.weaponSide * 16, a.weaponArm.hand.y - 23, '#ffe0a3', 0.52 + attack * 0.38);
    if (ready && !attack) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.12 + readyPulse * 0.12;
      drawCommitArc(ctx, a.weaponArm.hand.x + a.weaponSide * 4, a.weaponArm.hand.y - 15, a.weaponSide, 18 + readyPulse * 4, palette.glow, 0.18 + readyPulse * 0.16);
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = 0.34;
    line(ctx, a.chest.x - 13 * a.compress, a.chest.y - 11, a.chest.x + 10 * a.compress, a.chest.y + 12, '#2b120d', 1.0, 0.55);
    line(ctx, a.chest.x + 13 * a.compress, a.chest.y - 11, a.chest.x - 10 * a.compress, a.chest.y + 12, '#2b120d', 1.0, 0.55);
    ctx.restore();
  }


  function drawPremiumPaladinModel(ctx, actor, profile, pose, nowMs) {
    const palette = paletteFor(actor, profile);
    const source = actor.sourceEntity || actor;
    const x = Math.round(actor.screenX ?? actor.x ?? 0);
    const y = Math.round(actor.screenY ?? actor.y ?? 0);
    const dir = pose.direction || { name: 'south', view: 'front', side: 0, backVisible: false };
    const view = dir.view || 'front';
    const side = dir.side || 1;
    const isBack = !!dir.backVisible;
    const isSide = view === 'side';
    const isFrontDiag = view === 'frontDiagonal';
    const compress = isSide ? 0.62 : isFrontDiag ? 0.86 : 1.04;
    const t = pose.t || (nowMs || 0) / 1000;
    const walk = pose.groundPulse || Math.abs(Math.sin(pose.walkCycle || 0));
    const action = pose.action || 'idle';
    const attack = action === 'attack' ? (pose.attackCurve || 0) : 0;
    const meditate = action === 'meditate' ? 1 : 0;
    const fishing = action === 'fishing' ? 1 : 0;
    const swimming = action === 'swim' ? 1 : 0;
    const swimMove = swimming ? Math.max(0, Math.min(1, Number(pose.swimMovement || actor.swimMovement || source.swimMovement || 0))) : 0;
    const swimStroke = swimming ? Number(pose.swimStroke || Math.sin((pose.swimCycle || t) * Math.PI * 2)) : 0;
    const swimKick = swimming ? Number(pose.swimKick || Math.sin((pose.swimCycle || t) * Math.PI * 4)) : 0;
    const autoReady = !attack && !meditate && !fishing && !swimming && !!(actor.autoAttack || source.autoAttack || actor.combatCooldown || source.combatCooldown);
    const readyPulse = autoReady ? 0.5 + Math.sin(t * 7.5 + (pose.seed || 0)) * 0.5 : 0;
    const fishingReel = fishing ? Math.sin(t * 15 + (pose.seed || 0)) : 0;
    const bob = (pose.torsoBob || 0) * 0.42 + (actor.isPreview ? Math.sin(t * 1.7) * 0.28 : 0);
    const headBob = (pose.headBob || 0) * 0.38;
    const lean = (pose.lean || 0) * 0.010 + (isSide ? side * 0.018 : 0);
    const death = pose.deathProgress || 0;

    const anchors = buildPremiumFighterAnchors({ compress, side, isBack, isSide, isFrontDiag, bob, headBob, walk, attack, lean, death, meditate, fishing, swimming, swimMove, swimStroke, swimKick, autoReady: autoReady ? 1 : 0, readyPulse, fishingReel });

    ctx.save();
    try {
      ctx.translate(x, y);
      if (action === 'death') {
        ctx.translate(0, 15 * death);
        ctx.rotate((side || 1) * 0.22 * death);
      }

      drawPremiumFighterGroundShadow(ctx, anchors, palette, death);
      if (meditate) {
        drawPremiumPaladinMeditationAuraUnderlay(ctx, anchors, palette, { t, pulse: pose.meditatePulse || pose.castPulse || 1, side, isBack, isSide, isFrontDiag });
      }
      drawPremiumFighterWithSwimClip(ctx, anchors, pose, () => {
        drawPremiumPaladinBackLayer(ctx, anchors, palette, { dir, pose, isBack, isSide, isFrontDiag, t, meditate, swimming });

        if (meditate) {
          drawPremiumPaladinMeditationLegs(ctx, anchors, palette, { isBack, isSide, isFrontDiag, side, t });
        } else if (swimming) {
          drawPremiumFighterSwimmingLegs(ctx, anchors, palette, { isBack, isSide, isFrontDiag, t, swimMove, swimKick });
        } else {
          drawPremiumFighterLegs(ctx, anchors, palette, pose, isBack);
          drawPremiumFighterLegPlateMesh(ctx, anchors, palette, { isBack, isSide, isFrontDiag, compress });
          drawPremiumPaladinLegDetail(ctx, anchors, palette, { isBack, isSide, isFrontDiag, t });
        }

        if (isBack && !meditate && !fishing && !swimming) drawPremiumPaladinBackArms(ctx, anchors, palette, { isBack, isSide, isFrontDiag, side, t });
        drawPremiumFighterTorso(ctx, anchors, palette, { isBack, isSide, isFrontDiag, compress, meditate, fishing });
        drawPremiumFighterTorsoPlateMesh(ctx, anchors, palette, { isBack, isSide, isFrontDiag, compress });
        drawPremiumPaladinTorsoDetail(ctx, anchors, palette, { isBack, isSide, isFrontDiag, compress, t, meditate });
        drawPremiumFighterShoulders(ctx, anchors, palette, { isBack, isSide, isFrontDiag, compress });
        drawPremiumFighterShoulderPlateMesh(ctx, anchors, palette, { isBack, isSide, isFrontDiag, compress });
        drawPremiumPaladinShoulderDetail(ctx, anchors, palette, { isBack, isSide, isFrontDiag, side, t });

        if (meditate) {
          drawPremiumPaladinMeditationArms(ctx, anchors, palette, { isBack, isSide, isFrontDiag, side, t });
        } else if (fishing) {
          drawPremiumFighterFishingArms(ctx, anchors, palette, { isBack, isSide, isFrontDiag, side, t, fishingReel });
          drawPremiumFighterFishingRig(ctx, anchors, palette, profile, actor, pose, { side, fishingReel });
        } else if (swimming) {
          drawPremiumFighterSwimmingArms(ctx, anchors, palette, { isBack, isSide, isFrontDiag, side, t, swimMove, swimStroke });
        } else if (!isBack) {
          drawPremiumFighterSwordArm(ctx, anchors, palette, { side, attack, ready: autoReady ? 1 : 0, readyPulse, isSide, isFrontDiag, hideWeapon: true });
          drawPremiumFighterShieldArm(ctx, anchors, palette, { side, attack, ready: autoReady ? 1 : 0, readyPulse, isSide, isFrontDiag, hideShield: true });
          drawPremiumFighterArmPlateMesh(ctx, anchors, palette, { side, attack, isSide, isFrontDiag });
          drawPremiumPaladinWeapon(ctx, anchors.weaponArm.hand.x + anchors.weaponSide * 4, anchors.weaponArm.hand.y - 10, anchors.weaponSide, attack, palette, { ready: autoReady ? 1 : 0, readyPulse, isSide, isFrontDiag });
          drawPremiumPaladinShield(ctx, anchors.shieldArm.hand.x + anchors.shieldSide * 7, anchors.shieldArm.hand.y - 2, anchors.shieldSide, { isSide, isFrontDiag, attack, ready: autoReady ? 1 : 0, readyPulse }, palette);
        } else {
          drawPremiumPaladinBackWeaponHint(ctx, anchors, palette, side);
        }

        drawPremiumPaladinBeltAndAccessories(ctx, anchors, palette, { isBack, compress, meditate, t });
        drawPremiumPaladinHead(ctx, anchors, palette, actor, { isBack, isSide, side, t, meditate, ready: autoReady ? 1 : 0, readyPulse });
        if (!isBack) drawPremiumPaladinFrontEffects(ctx, anchors, palette, { t, attack, ready: autoReady ? 1 : 0, readyPulse, isSide, isFrontDiag, side });
      });
      if (swimming) drawPremiumFighterSwimmingSurface(ctx, anchors, palette, { t, swimMove, swimStroke });
      if (action === 'meditate') {
        drawPremiumPaladinMeditationSpiritOverlay(ctx, anchors, palette, { t, pulse: pose.meditatePulse || pose.castPulse || 1, side, isBack, isSide, isFrontDiag });
      } else if (action === 'cast') {
        drawPremiumPaladinCastSigil(ctx, anchors, palette, { t, pulse: pose.castPulse || 1, side });
      }
      if (pose.hitFlash > 0) drawHitFlash(ctx, 0, -34, palette, profile, pose.hitFlash);
      if (actor.debugFacing) drawDebugPaladinBounds(ctx, anchors, dir);
    } finally {
      ctx.restore();
    }

    // V0.20.51: this published `groundY: y` - the model ORIGIN, which sits at the hips - so every
    // ground-anchored VFX (the snare roots especially) wrapped a Paladin's waist instead of the ankles.
    // The shared humanoid base renderer already derives the true foot line from the leg anchors; the
    // bespoke class models never did, which is why only the classes with their own model were affected
    // and a Fighter test looked fine. Measured before this fix: every other class reported its foot line
    // +33px BELOW the hip anchor, Paladin reported -5px (i.e. above it).
    const paladinFeetY = [anchors?.legs?.left?.foot?.y, anchors?.legs?.right?.foot?.y]
      .map(Number).filter(Number.isFinite);
    const groundAnchor = { x, y, groundY: y + (paladinFeetY.length ? Math.max(...paladinFeetY) : 0) };
    if (actor) actor._lastGroundAnchor = groundAnchor;
    if (source) {
      source._lastGroundAnchor = groundAnchor;
      source._humanoidFacingName = dir.name;
      source._lastHumanoidFacingName = dir.name;
      source._classIdentityRenderer = 'paladin-highpoly-v0.15.93-holy-kneel-armfix';
      source._nameplateAnchor = { x: x + anchors.head.x, y: y + anchors.head.top - 12 };
      source._classModelClickBounds = { x: x - 42, y: y - 103, w: 84, h: 154 };
      if (action === 'meditate') {
        const leftFootY = anchors?.legs?.left?.foot?.y ?? 49;
        const rightFootY = anchors?.legs?.right?.foot?.y ?? 49;
        const footY = Math.max(leftFootY, rightFootY);
        source._meditationExpBarAnchor = { x, y: Math.round(y + footY + 30) };
      } else {
        source._meditationExpBarAnchor = null;
      }
    }
    return true;
  }

  function paladinMetalGradient(ctx, x1, y1, x2, y2, palette, bright = 1) {
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, palette.metalHi || '#f7f1dc');
    g.addColorStop(0.18, palette.metal || '#e8e2cd');
    g.addColorStop(0.48, bright > 0.8 ? '#c8b987' : (palette.metalDark || '#80755c'));
    g.addColorStop(0.82, palette.metalDark || '#80755c');
    g.addColorStop(1, '#2f2c25');
    return g;
  }

  function drawPremiumPaladinBackLayer(ctx, a, palette, opts = {}) {
    const sway = (opts.pose?.capeSway || 0) * 0.22;
    const top = a.chest.y - 21;
    const bottom = a.pelvis.y + 43 - (opts.meditate ? 12 : 0);
    const wTop = 20 * a.compress;
    const wBot = 23 * a.compress;
    const g = ctx.createLinearGradient(-24, top, 24, bottom);
    g.addColorStop(0, palette.clothHi || '#fff5c7');
    g.addColorStop(0.40, palette.cloth || '#efe0a1');
    g.addColorStop(1, palette.clothDark || '#6c5a2d');
    poly(ctx, [
      { x: a.chest.x - wTop - 3, y: top },
      { x: a.chest.x + wTop + 3, y: top },
      { x: a.pelvis.x + wBot + sway, y: bottom - 4 },
      { x: a.pelvis.x + 10, y: bottom + 6 },
      { x: a.pelvis.x + 2, y: bottom - 6 },
      { x: a.pelvis.x - 8, y: bottom + 5 },
      { x: a.pelvis.x - wBot - sway, y: bottom - 4 }
    ], g, palette.outline, 2.0);
    line(ctx, a.chest.x, top + 6, a.pelvis.x + sway * 0.2, bottom - 7, palette.accentDark, 1.0, 0.50);
    for (let i = 0; i < 4; i++) {
      const yy = bottom - 2 + (i % 2) * 2;
      line(ctx, a.pelvis.x - 18 + i * 12, yy, a.pelvis.x - 14 + i * 12, yy + 5, palette.accent, 0.9, 0.48);
    }
    if (opts.isBack) drawPaladinSun(ctx, a.chest.x, a.chest.y + 9, 0.62 * a.compress, palette, 0.78);
  }

  function drawPremiumPaladinLegDetail(ctx, a, palette, opts = {}) {
    if (opts.isBack) return;
    const legs = [a.legs.left, a.legs.right];
    for (const leg of legs) {
      const flip = leg.hip.x < a.pelvis.x ? -1 : 1;
      drawFighterQuadPlate(ctx, [
        { x: leg.knee.x - 5.0 * a.compress, y: leg.knee.y - 10 },
        { x: leg.knee.x + 5.0 * a.compress, y: leg.knee.y - 10 },
        { x: leg.knee.x + 6.8 * a.compress, y: leg.knee.y - 2 },
        { x: leg.knee.x + 2.6 * a.compress, y: leg.knee.y + 5 },
        { x: leg.knee.x - 2.6 * a.compress, y: leg.knee.y + 5 },
        { x: leg.knee.x - 6.8 * a.compress, y: leg.knee.y - 2 }
      ], 'rgba(242,232,196,0.28)', palette, 0.54, 0.42);
      line(ctx, leg.knee.x, leg.knee.y - 8, leg.foot.x, leg.foot.y - 9, palette.accent, 0.75, 0.35);
      for (let i = 0; i < 3; i++) drawFighterRivet(ctx, leg.foot.x + flip * (2 + i * 2.4), leg.foot.y - 7 + i * 1.7, palette, 0.54, 0.46);
    }
  }

  function drawPremiumPaladinTorsoDetail(ctx, a, palette, opts = {}) {
    const topW = 17.5 * a.compress;
    const waistW = 12.0 * a.compress;
    const c = a.chest;
    const p = a.pelvis;
    const g = paladinMetalGradient(ctx, c.x - topW, c.y - 17, c.x + topW, p.y + 20, palette, 1);
    if (opts.isBack) {
      drawFighterQuadPlate(ctx, [
        { x: c.x - topW + 2, y: c.y - 17 },
        { x: c.x + topW - 2, y: c.y - 17 },
        { x: p.x + waistW + 2, y: p.y + 16 },
        { x: p.x, y: p.y + 25 },
        { x: p.x - waistW - 2, y: p.y + 16 }
      ], g, palette, 0.54, 0.55);
      drawPaladinSun(ctx, c.x, c.y + 1, 0.42 * a.compress, palette, 0.78);
      line(ctx, c.x, c.y - 12, p.x, p.y + 19, palette.metalHi || '#fff1d5', 0.65, 0.38);
      return;
    }
    drawFighterQuadPlate(ctx, [
      { x: c.x - topW + 2, y: c.y - 17 },
      { x: c.x + topW - 2, y: c.y - 17 },
      { x: p.x + waistW + 1, y: p.y + 13 },
      { x: p.x + 4, y: p.y + 23 },
      { x: p.x - 4, y: p.y + 23 },
      { x: p.x - waistW - 1, y: p.y + 13 }
    ], g, palette, 0.58, 0.56);
    line(ctx, c.x, c.y - 15, p.x, p.y + 20, palette.metalHi || '#fff1d5', 0.8, 0.42);
    drawPaladinSun(ctx, c.x, c.y - 2, 0.50 * a.compress, palette, 0.94);
    const tabardTop = c.y + 10;
    const tabardBottom = p.y + 38 - (opts.meditate ? 8 : 0);
    const tg = ctx.createLinearGradient(c.x - 8, tabardTop, c.x + 8, tabardBottom);
    tg.addColorStop(0, palette.clothHi || '#fff5c7');
    tg.addColorStop(0.58, palette.cloth || '#efe0a1');
    tg.addColorStop(1, palette.clothDark || '#6c5a2d');
    poly(ctx, [
      { x: c.x - 8.2 * a.compress, y: tabardTop },
      { x: c.x + 8.2 * a.compress, y: tabardTop },
      { x: p.x + 10.5 * a.compress, y: tabardBottom - 5 },
      { x: p.x + 2, y: tabardBottom + 5 },
      { x: p.x - 2, y: tabardBottom - 3 },
      { x: p.x - 10.5 * a.compress, y: tabardBottom - 5 }
    ], tg, palette.outline, 1.0);
    line(ctx, c.x - 5.8 * a.compress, tabardTop + 3, p.x - 7.0 * a.compress, tabardBottom - 7, palette.accentDark, 0.9, 0.50);
    line(ctx, c.x + 5.8 * a.compress, tabardTop + 3, p.x + 7.0 * a.compress, tabardBottom - 7, palette.accentDark, 0.9, 0.50);
    drawPaladinSun(ctx, c.x, p.y + 22, 0.34 * a.compress, palette, 0.76);
    for (let i = 0; i < 4; i++) line(ctx, p.x - 7 + i * 4.5, tabardBottom - 3, p.x - 8 + i * 4.5, tabardBottom + 4, palette.accent, 0.65, 0.42);
    for (let i = 0; i < 4; i++) {
      const yy = p.y + 11 + i * 3.1;
      line(ctx, p.x - 12 * a.compress, yy, p.x + 12 * a.compress, yy + 0.5, palette.metalHi || '#fff1d5', 0.55, 0.38);
    }
  }

  function drawPremiumPaladinShoulderDetail(ctx, a, palette, opts = {}) {
    const shoulders = [a.shoulders.left, a.shoulders.right];
    for (const sh of shoulders) {
      const flip = sh.x < a.chest.x ? -1 : 1;
      const dominant = flip === a.weaponSide ? 1 : 0;
      const rx = (13.5 + dominant * 2.2) * a.compress;
      const ry = 8.7 + dominant * 1.1;
      const gx = paladinMetalGradient(ctx, sh.x - rx, sh.y - 10, sh.x + rx, sh.y + 10, palette, 1);
      ellipse(ctx, sh.x + flip * 1, sh.y + 1, rx, ry, flip * -0.11, gx, palette.outline, 1.15);
      ellipse(ctx, sh.x + flip * 0.5, sh.y + 2, rx * 0.62, ry * 0.56, flip * -0.11, 'rgba(255,245,198,0.16)', palette.accentDark, 0.62);
      drawPaladinSun(ctx, sh.x + flip * (3.0 + dominant), sh.y + 1.5, 0.22 + dominant * 0.04, palette, 0.76);
      for (let i = 0; i < 3; i++) {
        line(ctx, sh.x - flip * (rx * 0.88), sh.y + 5 + i * 3.4, sh.x + flip * (rx * 0.48), sh.y + 2.5 + i * 2.7, palette.metalDark, 0.66, 0.36);
      }
    }
  }

  function drawPremiumPaladinBackArms(ctx, a, palette, opts = {}) {
    drawPremiumFighterBackArm(ctx, a, palette, true);
    const s = opts.side || a.weaponSide || 1;
    ctx.save();
    ctx.globalAlpha = 0.55;
    drawPremiumPaladinWeapon(ctx, a.chest.x + s * 18, a.chest.y - 2, s, 0, palette, { isSide: opts.isSide, isFrontDiag: opts.isFrontDiag, back: true });
    drawPremiumPaladinShield(ctx, a.chest.x - s * 20, a.chest.y + 4, -s, { isSide: true, isFrontDiag: false, back: true }, palette);
    ctx.restore();
  }

  function drawPremiumPaladinRestingShieldAndMace(ctx, a, palette, opts = {}) {
    const s = opts.side || a.weaponSide || 1;
    ctx.save();
    ctx.globalAlpha = opts.isBack ? 0.46 : 0.82;
    drawPremiumPaladinWeapon(ctx, a.pelvis.x + s * 13, a.pelvis.y + 19, s, 0, palette, { isSide: opts.isSide, isFrontDiag: opts.isFrontDiag, rested: true });
    drawPremiumPaladinShield(ctx, a.pelvis.x - s * 17, a.pelvis.y + 14, -s, { isSide: opts.isSide, isFrontDiag: opts.isFrontDiag, rested: true }, palette);
    ctx.restore();
  }

  function drawPremiumPaladinBeltAndAccessories(ctx, a, palette, opts = {}) {
    const y = a.pelvis.y + 2;
    roundRect(ctx, a.pelvis.x - 18 * a.compress, y - 6, 36 * a.compress, 8, 3, palette.belt || '#72522b', palette.outline, 1.0);
    drawDiamond(ctx, a.pelvis.x, y - 2, 3.2, palette.accent || '#f3d46b', palette.outline);
    for (let i = -3; i <= 3; i++) drawFighterRivet(ctx, a.pelvis.x + i * 4.8 * a.compress, y - 2, palette, 0.58, 0.42);
    if (opts.isBack) return;
    // Reliquary and prayer beads read as the Paladin's silhouette-breaking accessories.
    const chainX = a.pelvis.x + 15 * a.compress;
    line(ctx, chainX, y - 3, chainX + 3, y + 22, palette.accentDark, 0.7, 0.55);
    roundRect(ctx, chainX - 3, y + 12, 7, 9, 1.7, palette.metal, palette.outline, 0.7);
    drawDiamond(ctx, chainX + 0.5, y + 16, 1.4, palette.glow || '#fff0a8', palette.outline);
    const beadX = a.pelvis.x - 16 * a.compress;
    for (let i = 0; i < 7; i++) ellipse(ctx, beadX - 1.4 + Math.sin(i * 0.8) * 1.6, y + 4 + i * 3.1, 1.4, 1.4, 0, '#6b4a30', palette.outline, 0.45);
    roundRect(ctx, a.pelvis.x - 25 * a.compress, y + 5, 8, 12, 1.8, '#5a3824', palette.outline, 0.75);
    line(ctx, a.pelvis.x - 21 * a.compress, y + 7, a.pelvis.x - 21 * a.compress, y + 15, palette.accent, 0.7, 0.50);
  }

  function drawPremiumPaladinHead(ctx, a, palette, actor, opts = {}) {
    const h = a.head;
    const s = opts.side || 1;
    const helmGrad = paladinMetalGradient(ctx, h.x - h.rx - 3, h.y - h.ry - 6, h.x + h.rx + 3, h.y + h.ry + 3, palette, 1);
    roundRect(ctx, h.x - 5, h.bottom - 4, 10, 11, 3, palette.metalDark || '#80755c', palette.outline, 1.0);
    ellipse(ctx, h.x, h.y - 1, h.rx + 2.4, h.ry + 2.2, 0.03 * s, helmGrad, palette.outline, 1.65);
    if (!opts.isBack) {
      // Raised visor / open-faced armet, preserving a readable face while selling heavy helm mass.
      const skin = actor.skinTone || palette.skin || '#e0aa7c';
      roundRect(ctx, h.x - h.rx * 0.55, h.y - 5.2, h.rx * 1.10, 12.5, 4, skin, palette.outline, 0.75);
      drawPremiumPaladinFace(ctx, h, palette, actor, opts);
      line(ctx, h.x - h.rx + 2, h.y - 9, h.x + h.rx - 2, h.y - 9, palette.accentDark, 1.15, 0.75);
      line(ctx, h.x - h.rx + 3, h.y + 8, h.x + h.rx - 3, h.y + 8, palette.metalDark, 1.0, 0.62);
      // Cross/sword ventilation slits.
      for (let i = -2; i <= 2; i++) {
        const vx = h.x + i * 3.5;
        line(ctx, vx, h.y + 10, vx, h.y + 15, '#201b16', 0.68, 0.70);
        line(ctx, vx - 1.5, h.y + 12.5, vx + 1.5, h.y + 12.5, '#201b16', 0.55, 0.55);
      }
    } else {
      drawPaladinSun(ctx, h.x, h.y - 1, 0.28, palette, 0.70);
      line(ctx, h.x, h.y - h.ry - 1, h.x, h.y + h.ry - 2, palette.metalHi || '#fff1d5', 0.7, 0.42);
    }
    // Central ridge, cheek plates and crest.
    line(ctx, h.x, h.y - h.ry - 3, h.x, h.y + h.ry - 1, palette.metalHi || '#fff1d5', 1.05, 0.68);
    poly(ctx, [
      { x: h.x - 5.5, y: h.y - h.ry - 7 },
      { x: h.x, y: h.y - h.ry - 18 - (opts.readyPulse || 0) * 1.2 },
      { x: h.x + 5.5, y: h.y - h.ry - 7 },
      { x: h.x + 2, y: h.y - h.ry - 4 },
      { x: h.x - 2, y: h.y - h.ry - 4 }
    ], palette.accent || '#f3d46b', palette.outline, 0.85);
    for (let i = -2; i <= 2; i++) {
      line(ctx, h.x, h.y - h.ry - 8, h.x + i * 4.2, h.y - h.ry - 15 + Math.abs(i) * 2, palette.accent, 0.85, 0.48);
    }
    drawPaladinSun(ctx, h.x, h.y - h.ry - 1.5, 0.22, palette, 0.78);
  }

  function drawPremiumPaladinFace(ctx, h, palette, actor, opts = {}) {
    const eyeColor = actor.eyeColor || actor.visualPalette?.eye || palette.glow || '#fff0a8';
    if (opts.isSide) {
      const s = opts.side || 1;
      const ex = h.x + s * 4;
      ctx.fillStyle = '#120d08';
      ctx.fillRect(ex - (s < 0 ? 5 : 0), h.y - 5, 6, 4);
      ctx.fillStyle = eyeColor;
      ctx.fillRect(ex - (s < 0 ? 4 : -1), h.y - 4, 3, 2);
      line(ctx, h.x + s * 2, h.y + 2, h.x + s * 6, h.y + 5, palette.skinShadow, 1.0, 0.62);
      line(ctx, h.x + s * 2, h.y + 10, h.x + s * 8, h.y + 9, '#5c3328', 1.05, 0.70);
      return;
    }
    ctx.fillStyle = '#120d08';
    ctx.fillRect(h.x - 8, h.y - 5, 7, 4);
    ctx.fillRect(h.x + 1, h.y - 5, 7, 4);
    ctx.fillStyle = eyeColor;
    ctx.fillRect(h.x - 6, h.y - 4, 3, 2);
    ctx.fillRect(h.x + 3, h.y - 4, 3, 2);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.34;
    ellipse(ctx, h.x - 4.5, h.y - 3.2, 3.2, 2.1, 0, palette.glow, palette.glow, 0);
    ellipse(ctx, h.x + 4.5, h.y - 3.2, 3.2, 2.1, 0, palette.glow, palette.glow, 0);
    ctx.restore();
    line(ctx, h.x - 9, h.y - 8, h.x - 2, h.y - 7, '#24150f', 1.15, 0.78);
    line(ctx, h.x + 2, h.y - 7, h.x + 9, h.y - 8, '#24150f', 1.15, 0.78);
    line(ctx, h.x - 4, h.y + 10, h.x + 4, h.y + 10, '#5c3328', 1.05, 0.72);
    line(ctx, h.x + 7, h.y + 1, h.x + 9, h.y + 5, 'rgba(120,82,62,0.72)', 0.8, 0.68);
  }

  function drawPremiumPaladinWeapon(ctx, x, y, side, attack, palette, opts = {}) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(side * (0.12 - attack * 0.30 + (opts.rested ? 0.18 : 0)));
    if (opts.back) ctx.globalAlpha *= 0.7;
    const shaftGrad = ctx.createLinearGradient(-4, 16, 4, -39);
    shaftGrad.addColorStop(0, '#4d2f1d');
    shaftGrad.addColorStop(0.5, '#8a6435');
    shaftGrad.addColorStop(1, '#392314');
    roundRect(ctx, -2.6, -30, 5.2, 50, 2, shaftGrad, palette.outline, 0.75);
    for (let i = 0; i < 5; i++) line(ctx, -3, -22 + i * 8, 3, -25 + i * 8, palette.accentDark, 0.65, 0.45);
    const headY = -36;
    const metal = paladinMetalGradient(ctx, -12, headY - 10, 12, headY + 15, palette, 1);
    for (let i = 0; i < 6; i++) {
      const ang = i * Math.PI / 3;
      ctx.save();
      ctx.translate(0, headY);
      ctx.rotate(ang);
      poly(ctx, [
        { x: -2.8, y: -2.2 }, { x: 0, y: -14.0 }, { x: 2.8, y: -2.2 }, { x: 2.1, y: 7.2 }, { x: -2.1, y: 7.2 }
      ], metal, palette.outline, 0.78);
      ctx.restore();
    }
    ellipse(ctx, 0, headY, 7.6, 7.6, 0, palette.metal, palette.outline, 0.9);
    drawDiamond(ctx, 0, headY, 2.4, palette.glow || '#fff0a8', palette.outline);
    poly(ctx, [
      { x: -3.5, y: headY - 13.2 }, { x: 0, y: headY - 21.5 }, { x: 3.5, y: headY - 13.2 }, { x: 0, y: headY - 10.2 }
    ], palette.metalHi || '#fff1d5', palette.outline, 0.66);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.18 + (opts.readyPulse || 0) * 0.14 + attack * 0.22;
    ellipse(ctx, 0, headY, 17, 17, 0, palette.glow || '#fff0a8', palette.glow || '#fff0a8', 0);
    ctx.restore();
    ctx.restore();
  }

  function drawPremiumPaladinShield(ctx, x, y, side, opts = {}, palette) {
    const sideView = opts.isSide;
    const diag = opts.isFrontDiag;
    const sx = sideView ? 0.72 : diag ? 0.88 : 1.0;
    const sy = sideView ? 0.88 : diag ? 0.98 : 1.05;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, sy);
    ctx.rotate(side * (sideView ? -0.04 : diag ? -0.03 : 0.0));
    if (opts.back) ctx.globalAlpha *= 0.64;
    const g = paladinMetalGradient(ctx, -20, -34, 20, 36, palette, 1);
    const rim = [
      { x: -18, y: -30 }, { x: 18, y: -30 }, { x: 18, y: 5 }, { x: 12, y: 26 }, { x: 0, y: 38 }, { x: -12, y: 26 }, { x: -18, y: 5 }
    ];
    poly(ctx, rim, g, palette.outline, 1.65);
    const inset = [
      { x: -13.6, y: -24 }, { x: 13.6, y: -24 }, { x: 13.4, y: 4 }, { x: 8.5, y: 22 }, { x: 0, y: 31 }, { x: -8.5, y: 22 }, { x: -13.4, y: 4 }
    ];
    poly(ctx, inset, 'rgba(255,255,255,0.08)', palette.accentDark, 0.65);
    // Rope-like rim and holy studs.
    for (let i = 0; i < 9; i++) {
      const yy = -23 + i * 6.0;
      drawFighterRivet(ctx, -15.5, yy, palette, 0.70, 0.54);
      drawFighterRivet(ctx, 15.5, yy, palette, 0.70, 0.54);
      line(ctx, -17.8, yy - 2, -15.4, yy + 2, palette.accent, 0.45, 0.34);
      line(ctx, 17.8, yy - 2, 15.4, yy + 2, palette.accent, 0.45, 0.34);
    }
    drawPaladinSun(ctx, 0, -1, 1.04, palette, 0.96);
    line(ctx, 0, -25, 0, 30, palette.glow || '#fff0a8', 1.25, 0.60);
    line(ctx, -10, 9, 10, 9, palette.metalDark, 0.70, 0.42);
    line(ctx, -11, -14, 11, -14, palette.metalHi || '#fff1d5', 0.72, 0.42);
    for (let i = 0; i < 5; i++) {
      const x1 = -9 + i * 4.2;
      line(ctx, x1, 15 + (i % 2), x1 + 3, 18 + (i % 2), 'rgba(230,232,225,0.38)', 0.48, 0.44);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.16 + (opts.readyPulse || 0) * 0.16 + (opts.attack || 0) * 0.12;
    ellipse(ctx, 0, -1, 22, 34, 0, palette.glow || '#fff0a8', palette.glow || '#fff0a8', 0);
    ctx.restore();
    ctx.restore();
  }

  function drawPremiumPaladinBackWeaponHint(ctx, a, palette, side) {
    ctx.save();
    ctx.globalAlpha = 0.62;
    drawPremiumPaladinWeapon(ctx, a.chest.x + 16 * side, a.chest.y - 4, side, 0, palette, { back: true });
    drawPremiumPaladinShield(ctx, a.chest.x - 18 * side, a.chest.y + 6, -side, { isSide: true, back: true }, palette);
    ctx.restore();
  }

  function drawPremiumPaladinFrontEffects(ctx, a, palette, opts = {}) {
    const attack = opts.attack || 0;
    if (attack > 0.18) drawSlash(ctx, a.weaponArm.hand.x + a.weaponSide * 9, a.weaponArm.hand.y - 20, palette.glow || '#fff0a8', 0.40 + attack * 0.34);
    if (opts.ready && !attack) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.16 + (opts.readyPulse || 0) * 0.16;
      drawCommitArc(ctx, a.shieldArm.hand.x + a.shieldSide * 2, a.shieldArm.hand.y - 6, a.shieldSide, 19 + (opts.readyPulse || 0) * 5, palette.glow || '#fff0a8', 0.22);
      ctx.restore();
    }
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.09;
    ellipse(ctx, a.chest.x, a.chest.y + 3, 27 * a.compress, 31, 0, palette.glow || '#fff0a8', palette.glow || '#fff0a8', 0);
    ctx.restore();
  }

  function drawPremiumPaladinCastSigil(ctx, a, palette, opts = {}) {
    const pulse = opts.pulse || 1;
    const t = opts.t || 0;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.14 + pulse * 0.18;
    ellipse(ctx, 0, -31, 34 + pulse * 8, 13 + pulse * 3, 0, palette.glow || '#fff0a8', palette.glow || '#fff0a8', 1.0);
    for (let i = 0; i < 8; i++) {
      const ang = t * 1.2 + i * Math.PI / 4;
      line(ctx, Math.cos(ang) * 13, -31 + Math.sin(ang) * 5, Math.cos(ang) * (24 + pulse * 5), -31 + Math.sin(ang) * (9 + pulse * 2), palette.glow || '#fff0a8', 0.8, 0.35);
    }
    ctx.restore();
  }


  function drawPremiumPaladinMeditationAuraUnderlay(ctx, a, palette, opts = {}) {
    const t = Number(opts.t || 0);
    const pulse = Math.max(0.82, Number(opts.pulse || 1));
    const leftFootY = a?.legs?.left?.foot?.y ?? 49;
    const rightFootY = a?.legs?.right?.foot?.y ?? 49;
    const baseY = Math.round(Math.max(leftFootY, rightFootY) + 5);
    const gold = palette.glow || '#fff0a8';
    const ember = palette.accent || '#f3d46b';
    const deepGold = palette.accentDark || '#8a6923';

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    const baseGlow = ctx.createRadialGradient(0, baseY - 1, 3, 0, baseY - 1, 82 + pulse * 16);
    baseGlow.addColorStop(0, 'rgba(255,245,190,0.62)');
    baseGlow.addColorStop(0.20, 'rgba(255,219,116,0.43)');
    baseGlow.addColorStop(0.54, 'rgba(144,104,36,0.21)');
    baseGlow.addColorStop(1, 'rgba(144,104,36,0)');
    ctx.fillStyle = baseGlow;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.ellipse(0, baseY, 68 + pulse * 10, 21 + pulse * 3, 0, 0, TAU);
    ctx.fill();

    // Consecration circle: distinct from Fighter's ember ring. Reads as a Paladin oath sigil.
    for (let r = 0; r < 3; r++) {
      ctx.globalAlpha = 0.36 - r * 0.07;
      ctx.strokeStyle = r === 0 ? gold : (r === 1 ? ember : deepGold);
      ctx.lineWidth = 1.1 + r * 0.35;
      ctx.beginPath();
      ctx.ellipse(0, baseY + r * 1.2, 34 + r * 10 + pulse * 2, 9 + r * 3, 0, 0, TAU);
      ctx.stroke();
    }

    const spin = t * 0.55;
    for (let i = 0; i < 8; i++) {
      const ang = spin + i * Math.PI / 4;
      const ix = Math.cos(ang) * 17;
      const iy = baseY + Math.sin(ang) * 4.2;
      const ox = Math.cos(ang) * (42 + pulse * 4);
      const oy = baseY + Math.sin(ang) * (10 + pulse);
      line(ctx, ix, iy, ox, oy, i % 2 ? ember : gold, 1.1, 0.30 + (i % 2) * 0.10);
      drawDiamond(ctx, ox, oy, 1.55, i % 2 ? ember : gold, deepGold);
    }

    // Small cross-shaped prayer sparks lift from the circle.
    for (let i = 0; i < 18; i++) {
      const phase = ((t * 0.32) + i * 0.081) % 1;
      const px = Math.sin(t * 1.7 + i * 1.11) * (8 + (i % 6) * 6.4);
      const py = baseY - phase * 52 - (i % 4) * 2;
      const a0 = 0.10 + Math.sin(phase * Math.PI) * 0.24;
      ctx.globalAlpha = a0;
      line(ctx, px - 1.9, py, px + 1.9, py, gold, 0.65, 1);
      line(ctx, px, py - 2.2, px, py + 2.2, gold, 0.65, 1);
    }

    // Low shield-shaped ward behind the kneel pose.
    ctx.globalAlpha = 0.18 + pulse * 0.05;
    ctx.beginPath();
    ctx.moveTo(0, baseY - 47);
    ctx.bezierCurveTo(25, baseY - 39, 34, baseY - 17, 18, baseY + 6);
    ctx.bezierCurveTo(7, baseY + 20, -7, baseY + 20, -18, baseY + 6);
    ctx.bezierCurveTo(-34, baseY - 17, -25, baseY - 39, 0, baseY - 47);
    ctx.closePath();
    ctx.fillStyle = gold;
    ctx.fill();

    ctx.restore();
  }

  function drawPremiumPaladinMeditationLegs(ctx, a, palette, opts = {}) {
    const c = a.pelvis;
    const flat = opts.isSide ? 0.70 : opts.isFrontDiag ? 0.86 : 1;
    const s = opts.side || a.weaponSide || 1;
    const y = c.y + 17;
    const kneelPulse = Math.sin(Number(opts.t || 0) * 1.8) * 0.55;

    ctx.save();
    ctx.globalAlpha = 0.99;
    ellipse(ctx, c.x, y + 16, 29 * flat * a.compress, 7.4, 0, 'rgba(0,0,0,0.28)', null, 0);

    // Shield-side knee is down. Weapon-side foot is planted: an oath kneel, not Fighter cross-leg meditation.
    const kneeDownX = c.x - s * 10 * flat * a.compress;
    const kneeDownY = y + 8 + kneelPulse;
    const plantKneeX = c.x + s * 12 * flat * a.compress;
    const plantKneeY = y + 2;
    const plantFootX = c.x + s * 28 * flat * a.compress;
    const plantFootY = y + 20;

    drawFighterQuadPlate(ctx, [
      { x: c.x - s * 3 * a.compress, y: y - 4 },
      { x: kneeDownX + s * 7, y: kneeDownY - 4 },
      { x: kneeDownX + s * 3, y: kneeDownY + 9 },
      { x: c.x - s * 8 * a.compress, y: y + 9 }
    ], palette.metalDark, palette, 0.56, 0.52);
    ellipse(ctx, kneeDownX, kneeDownY + 4, 8.2 * flat, 6.8, 0.03 * s, palette.metal, palette.outline, 1.1);
    drawPaladinSun(ctx, kneeDownX, kneeDownY + 3.5, 0.14, palette, 0.62);
    ellipse(ctx, kneeDownX - s * 11, kneeDownY + 10, 12.5 * flat, 5.2, -0.10 * s, palette.boot, palette.outline, 1.05);

    drawFighterQuadPlate(ctx, [
      { x: c.x + s * 4 * a.compress, y: y - 4 },
      { x: plantKneeX - s * 3, y: plantKneeY - 7 },
      { x: plantKneeX + s * 5, y: plantKneeY + 3 },
      { x: c.x + s * 10 * a.compress, y: y + 8 }
    ], palette.metal, palette, 0.60, 0.54);
    ellipse(ctx, plantKneeX, plantKneeY, 7.4 * flat, 6.1, -0.05 * s, palette.metalHi || '#fff1d5', palette.outline, 1.05);
    drawFighterQuadPlate(ctx, [
      { x: plantKneeX + s * 3, y: plantKneeY + 3 },
      { x: plantFootX - s * 5, y: plantFootY - 7 },
      { x: plantFootX + s * 5, y: plantFootY - 3 },
      { x: plantKneeX + s * 8, y: plantKneeY + 9 }
    ], 'rgba(232,226,205,0.72)', palette, 0.60, 0.48);
    ellipse(ctx, plantFootX, plantFootY, 12.0 * flat, 5.0, 0.12 * s, palette.bootHi, palette.outline, 1.05);

    // Tabard drapes over the kneeling pose and hides the crossed-leg read completely.
    const tg = ctx.createLinearGradient(c.x, c.y - 1, c.x, y + 23);
    tg.addColorStop(0, palette.clothHi || '#fff5c7');
    tg.addColorStop(0.56, palette.cloth || '#efe0a1');
    tg.addColorStop(1, palette.clothDark || '#6c5a2d');
    poly(ctx, [
      { x: c.x - 10 * a.compress, y: c.y - 2 },
      { x: c.x + 10 * a.compress, y: c.y - 2 },
      { x: c.x + 8 * flat * a.compress, y: y + 22 },
      { x: c.x + s * 2, y: y + 17 },
      { x: c.x - 8 * flat * a.compress, y: y + 22 }
    ], tg, palette.outline, 1.0);
    line(ctx, c.x, c.y + 1, c.x + s * 2, y + 17, palette.accentDark, 0.72, 0.46);
    drawPaladinSun(ctx, c.x, c.y + 13, 0.20, palette, 0.62);
    ctx.restore();
  }

  function drawPremiumPaladinMeditationArms(ctx, a, palette, opts = {}) {
    const s = opts.side || a.weaponSide || 1;
    const t = Number(opts.t || 0);
    const breath = Math.sin(t * 1.7) * 0.7;
    const isSide = !!opts.isSide;
    const isDiag = !!opts.isFrontDiag;
    const flat = isSide ? 0.66 : isDiag ? 0.84 : 1.0;
    const centerX = a.chest.x + (isSide ? s * 2 : 0);
    const handY = a.pelvis.y + 8 + breath * 0.25;
    const weaponX = centerX + s * (isSide ? 8 : 5);
    const weaponY = a.pelvis.y + 23;
    const baseY = a.pelvis.y + 48;

    ctx.save();

    // Shield is planted upright beside the kneel pose. Keep it outside the torso silhouette so it
    // does not read as a crossed Fighter arm or cover the clasped-hands prayer pose.
    ctx.globalAlpha = opts.isBack ? 0.50 : 0.88;
    drawPremiumPaladinShield(
      ctx,
      a.pelvis.x - s * (24 * a.compress * flat),
      a.pelvis.y + 18,
      -s,
      { isSide: opts.isSide, isFrontDiag: opts.isFrontDiag, rested: true, readyPulse: 0.25 + Math.sin(t * 2.0) * 0.12 },
      palette
    );

    // Mace planted point-down in front of the kneeling oath pose.
    ctx.save();
    ctx.translate(weaponX, weaponY);
    ctx.rotate(s * 0.02);
    drawPremiumPaladinWeapon(ctx, 0, 0, s, 0, palette, { rested: true, readyPulse: 0.35 + Math.sin(t * 1.9) * 0.15 });
    ctx.restore();

    // Dedicated Paladin meditation arms: compact prayer pose with elbows down and hands clasped
    // over the planted mace. This intentionally does not reuse standing/fighter arm anchors,
    // because those anchors pull from the high shoulder line to the pelvis and create stretched
    // X-shaped arms in the kneeling meditation state.
    const leftShoulder = a.shoulders?.left || { x: a.chest.x - 17 * a.compress, y: a.chest.y - 9 };
    const rightShoulder = a.shoulders?.right || { x: a.chest.x + 17 * a.compress, y: a.chest.y - 9 };
    const nearShoulder = s < 0 ? leftShoulder : rightShoulder;
    const farShoulder = s < 0 ? rightShoulder : leftShoulder;
    const nearSign = s;
    const farSign = -s;

    const drawOathArm = (shoulder, sign, depthAlpha, sleeveFill) => {
      const elbow = {
        x: centerX + sign * (13.2 * flat * a.compress),
        y: a.chest.y + 9.5 + breath * 0.18
      };
      const wrist = {
        x: centerX + sign * (6.0 * flat * a.compress),
        y: handY - 1.5
      };
      const hand = {
        x: weaponX + sign * (1.8 * flat),
        y: handY + 0.6
      };

      ctx.globalAlpha = depthAlpha;
      line(ctx, shoulder.x, shoulder.y + 3.5, elbow.x, elbow.y, palette.outline, 8.2, 0.98);
      line(ctx, shoulder.x, shoulder.y + 3.5, elbow.x, elbow.y, sleeveFill, 5.2, 0.98);
      line(ctx, elbow.x, elbow.y, wrist.x, wrist.y, palette.outline, 7.2, 0.98);
      line(ctx, elbow.x, elbow.y, wrist.x, wrist.y, palette.metalDark, 4.2, 0.98);

      // Articulated elbow and vambrace plates; placed low beside the torso instead of crossing it.
      ellipse(ctx, elbow.x, elbow.y + 0.3, 4.9 * flat, 5.9, 0.06 * sign, palette.metal, palette.outline, 0.85);
      line(ctx, elbow.x - sign * 2.5, elbow.y + 3.8, wrist.x - sign * 1.4, wrist.y - 3.0, palette.metalHi || '#fff1d5', 0.7, 0.42);
      roundRect(ctx, wrist.x - 3.1, wrist.y - 5.2, 6.2, 8.6, 2, palette.metalDark, palette.outline, 0.65);

      // Small clasped gauntlet/hand cap at the mace grip. Kept tight to center to avoid the old
      // stretched-down arm silhouette.
      ellipse(ctx, hand.x, hand.y, 3.9 * flat, 4.2, 0.05 * sign, palette.skin || '#e0aa7c', palette.outline, 0.9);
      drawDiamond(ctx, hand.x - sign * 0.7, hand.y - 0.4, 0.9, palette.glow || '#fff0a8', palette.outline);
    };

    // Far arm first, near arm second. Both bend inward without crossing over the chest.
    drawOathArm(farShoulder, farSign, opts.isBack ? 0.38 : 0.76, palette.clothDark || '#6c5a2d');
    drawOathArm(nearShoulder, nearSign, opts.isBack ? 0.48 : 0.96, palette.cloth || '#efe0a1');

    // Clasp glow around the mace grip.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.18 + Math.sin(t * 2.2) * 0.04;
    ellipse(ctx, weaponX, handY + 0.5, 9.5 * flat, 5.2, 0, palette.glow || '#fff0a8', palette.glow || '#fff0a8', 0);
    ctx.restore();

    // Rosary loop between clasped hands and belt, specific to Paladin meditation.
    ctx.globalAlpha = 0.74;
    for (let i = 0; i < 9; i++) {
      const bx = centerX - 2 + Math.sin(i * 0.9) * 5.0 * flat;
      const by = handY + 5 + i * 2.3;
      ellipse(ctx, bx, by, 1.08, 1.08, 0, i === 8 ? palette.accent : '#6b4a30', palette.outline, 0.35);
    }
    line(ctx, centerX - 4, handY + 24, centerX + 2, handY + 30, palette.accent, 0.65, 0.44);

    // Ground contact flash at the planted mace head.
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.12 + Math.sin(t * 2.0) * 0.04;
    ellipse(ctx, weaponX + s * 4, baseY, 18, 5.2, 0, palette.glow || '#fff0a8', palette.glow || '#fff0a8', 0);
    ctx.restore();
  }

  function drawPremiumPaladinMeditationSpiritOverlay(ctx, a, palette, opts = {}) {
    const t = Number(opts.t || 0);
    const pulse = Math.max(0.82, Number(opts.pulse || 1));
    const gold = palette.glow || '#fff0a8';
    const ember = palette.accent || '#f3d46b';
    const h = a.head;
    const leftFootY = a?.legs?.left?.foot?.y ?? 49;
    const rightFootY = a?.legs?.right?.foot?.y ?? 49;
    const baseY = Math.round(Math.max(leftFootY, rightFootY) + 5);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // Halo above the bowed helm, slow breathing pulse.
    ctx.globalAlpha = 0.20 + pulse * 0.13;
    ctx.strokeStyle = gold;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.ellipse(h.x, h.top - 10, 16 + pulse * 2, 4.8 + pulse * 0.7, 0, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 10; i++) {
      const ang = t * 0.42 + i * TAU / 10;
      line(ctx, h.x + Math.cos(ang) * 10, h.top - 10 + Math.sin(ang) * 3, h.x + Math.cos(ang) * (18 + pulse * 2), h.top - 10 + Math.sin(ang) * (5 + pulse), i % 2 ? ember : gold, 0.75, 0.24);
    }

    // Shield-boss blessing shimmer: vertical shafts instead of Fighter ember motes.
    for (let i = 0; i < 7; i++) {
      const x = -30 + i * 10;
      const phase = ((t * 0.18) + i * 0.137) % 1;
      const top = baseY - 16 - phase * 35;
      line(ctx, x, top, x + Math.sin(t + i) * 2.5, top - 14, i % 2 ? ember : gold, 0.75 + (i % 3) * 0.25, 0.09 + Math.sin(phase * Math.PI) * 0.18);
    }

    for (let i = 0; i < 15; i++) {
      const phase = ((t * 0.42) + i * 0.073) % 1;
      const px = Math.sin(t * 1.5 + i * 1.23) * (9 + (i % 5) * 5.2);
      const py = baseY - phase * 50 - (i % 3) * 4;
      ctx.globalAlpha = 0.10 + Math.sin(phase * Math.PI) * 0.24;
      drawDiamond(ctx, px, py, 1.15 + (i % 3) * 0.28, i % 2 ? ember : gold, gold);
    }
    ctx.restore();
  }

  function drawPaladinSun(ctx, x, y, scale, palette, alpha = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha *= alpha;
    const glow = palette.glow || '#fff0a8';
    for (let i = 0; i < 8; i++) {
      const a0 = i * Math.PI / 4;
      line(ctx, Math.cos(a0) * 3.8, Math.sin(a0) * 3.8, Math.cos(a0) * 14.0, Math.sin(a0) * 14.0, palette.accent || '#f3d46b', 1.4, 0.76);
      line(ctx, Math.cos(a0 + Math.PI / 8) * 4.0, Math.sin(a0 + Math.PI / 8) * 4.0, Math.cos(a0 + Math.PI / 8) * 9.5, Math.sin(a0 + Math.PI / 8) * 9.5, palette.metalHi || '#fff1d5', 0.8, 0.54);
    }
    ellipse(ctx, 0, 0, 5.6, 5.6, 0, palette.accent || '#f3d46b', palette.outline, 0.9);
    drawDiamond(ctx, 0, 0, 2.2, glow, palette.outline);
    ctx.restore();
  }

  function drawDebugPaladinBounds(ctx, a, dir) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,210,80,0.66)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-42, -103, 84, 154);
    ctx.fillStyle = 'rgba(255,245,190,0.9)';
    ctx.font = '8px monospace';
    ctx.fillText(`PALADIN:${dir.name}`, -40, -108);
    ctx.restore();
  }

  function drawDebugFighterBounds(ctx, a, dir) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,0,0,0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-31, -91, 62, 140);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '8px monospace';
    ctx.fillText(`FIGHTER:${dir.name}`, -29, -96);
    ctx.restore();
  }

  DR.render.ClassIdentityProceduralModel = {
    draw,
    canDraw,
    classNameFor,
    normalizeClassName,
    PROFILES
  };
  window.ClassIdentityProceduralModel = DR.render.ClassIdentityProceduralModel;
})();
