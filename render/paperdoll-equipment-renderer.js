(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.render = DR.render || {};

  const Base = DR.render.HumanoidBaseRenderer || {};
  const TAU = Math.PI * 2;

  const EQUIPMENT_PROFILES = Object.freeze({
    human: Object.freeze({ armorScale:1, helmetScale:1, shoulderScale:1, gloveScale:1, bootScale:1, weaponScale:1, shieldScale:1, chestY:0, helmetY:0, gripX:0, gripY:0, capeWidth:1, capeLength:1 }),
    elf: Object.freeze({ armorScale:.94, helmetScale:.96, shoulderScale:.9, gloveScale:.92, bootScale:.92, weaponScale:1.02, shieldScale:.92, chestY:-2, helmetY:-2, gripX:1, gripY:-1, capeWidth:.9, capeLength:1.05 }),
    ratkin: Object.freeze({ armorScale:.72, helmetScale:.7, shoulderScale:.66, gloveScale:.7, bootScale:.68, weaponScale:.78, shieldScale:.68, chestY:5, helmetY:3, gripX:4, gripY:5, capeWidth:.66, capeLength:.7 }),
    bogling_male: Object.freeze({ armorScale:.88, helmetScale:1.14, shoulderScale:.84, gloveScale:.92, bootScale:.78, weaponScale:.88, shieldScale:.72, chestY:5, helmetY:-5, gripX:4, gripY:5, capeWidth:.86, capeLength:.7 }),
    bogling_female: Object.freeze({ armorScale:.8, helmetScale:1.08, shoulderScale:.76, gloveScale:.84, bootScale:.72, weaponScale:.82, shieldScale:.66, chestY:6, helmetY:-5, gripX:3, gripY:5, capeWidth:.78, capeLength:.66 })
  });

  function equipmentProfile(actor={}) {
    const race=String(actor.raceId||actor.sourceEntity?.raceId||'human').toLowerCase();
    if(race==='bogling')return EQUIPMENT_PROFILES[String(actor.gender||actor.sourceEntity?.gender||'male').toLowerCase()==='female'?'bogling_female':'bogling_male'];
    return EQUIPMENT_PROFILES[race]||EQUIPMENT_PROFILES.human;
  }

  function activityHidesWeapons(rig){return ['meditate','swim','dance','sit'].includes(String(rig?.pose?.action||''));}

  // Same back/front depth split already used by the Bard instrument and
  // Druid staff hooks (render/bard-procedural-model.js instrumentLayer,
  // render/druid-procedural-model.js staffLayer): while actively attacking
  // or casting the weapon swings out in front regardless of facing;
  // otherwise a back-facing (north-row) actor's held weapon/offhand should
  // draw before the torso/cloak so the body occludes it, and everyone else
  // keeps the existing in-front draw position.
  function weaponDepthLayer(rig) {
    if (['cast', 'attack'].includes(String(rig?.pose?.action || ''))) return 'front';
    return rig?.dir?.backVisible ? 'back' : 'front';
  }

  // Cape/cloak depth is the inverse of held weapons for back-facing rows:
  // weapons are hidden by a back-facing torso, but a back-slot garment must
  // drape over that same torso so the actor reads as facing away. Front and
  // side facings keep the original behind-body cape placement.
  function capeDepthLayer(rig) {
    return rig?.dir?.backVisible ? 'front' : 'back';
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, Number(v) || 0));
  }

  const SLOT_ALIASES = Object.freeze({
    weapon: ['weapon', 'mainHand', 'mainhand', 'main_hand', 'primary', 'rightHand', 'right_hand'],
    offhand: ['offhand', 'offHand', 'off_hand', 'secondary', 'leftHand', 'left_hand'],
    head: ['head', 'helmet', 'helm'],
    shoulders: ['shoulders', 'shoulder'],
    chest: ['chest', 'body', 'torso'],
    legs: ['legs', 'pants'],
    hands: ['hands', 'gloves'],
    feet: ['feet', 'boots'],
    cape: ['cape', 'cloak']
  });


  const CLASS_NAME_ALIASES = Object.freeze({
    paladin: 'Paladin', crusader: 'Paladin', oathkeeper: 'Paladin', guardian: 'Paladin',
    warden: 'Warden', naturewarden: 'Warden', stonewarden: 'Warden',
    fighter: 'Fighter', warrior: 'Fighter', bruiser: 'Fighter',
    rogue: 'Rogue', thief: 'Rogue',
    ranger: 'Ranger', hunter: 'Ranger', scout: 'Ranger', archer: 'Ranger',
    assassin: 'Assassin', executioner: 'Assassin', crossbowman: 'Assassin',
    wizard: 'Wizard', mage: 'Wizard', archwizard: 'Wizard', adept: 'Wizard',
    shaman: 'Shaman', stormcaller: 'Shaman', spiritcaller: 'Shaman',
    summoner: 'Summoner', planarist: 'Summoner', binder: 'Summoner',
    necromancer: 'Necromancer', necro: 'Necromancer',
    cleric: 'Cleric', priest: 'Cleric', healer: 'Cleric', fieldcleric: 'Cleric',
    druid: 'Druid', grovekeeper: 'Druid',
    bard: 'Bard', minstrel: 'Bard',
    enchanter: 'Enchanter', mesmer: 'Enchanter', illusionist: 'Enchanter', charmer: 'Enchanter'
  });

  const CLASS_DEFAULT_VISUAL_ITEM_IDS = Object.freeze({
    Paladin: Object.freeze({ weapon: 'item_starter_v01689_paladin_oath_mace', offhand: 'item_starter_v01689_paladin_lantern_shield' }),
    Warden: Object.freeze({ weapon: 'item_starter_v01689_warden_root_mallet', offhand: 'item_starter_v01689_warden_barkguard' }),
    Fighter: Object.freeze({ weapon: 'item_starter_v01689_fighter_rustcleaver', offhand: 'item_starter_v01689_fighter_bruisers_token' }),
    Rogue: Object.freeze({ weapon: 'item_starter_v01689_rogue_gutter_dagger', offhand: 'item_starter_v01689_rogue_sleeve_shiv' }),
    Ranger: Object.freeze({ weapon: 'item_starter_v01689_ranger_greenwood_bow', offhand: 'item_starter_v01689_ranger_frayed_quiver' }),
    Assassin: Object.freeze({ weapon: 'item_starter_v01689_assassin_hand_crossbow', offhand: 'item_starter_v01689_assassin_throwing_fangs' }),
    Wizard: Object.freeze({ weapon: 'item_starter_v01689_wizard_splinter_wand', offhand: 'item_starter_v01689_wizard_chipped_orb' }),
    Shaman: Object.freeze({ weapon: 'item_starter_v01689_shaman_raincaller_rod', offhand: 'item_starter_v01689_shaman_pebble_totem' }),
    Summoner: Object.freeze({ weapon: 'item_starter_v01689_summoner_binder_rod', offhand: 'item_starter_v01689_summoner_pact_grimoire' }),
    Necromancer: Object.freeze({ weapon: 'item_starter_v01689_necromancer_bonepin_wand', offhand: 'item_starter_v01689_necromancer_chalk_skull' }),
    Cleric: Object.freeze({ weapon: 'item_starter_v01689_cleric_bell_mace', offhand: 'item_starter_v01689_cleric_wooden_prayer_icon' }),
    Druid: Object.freeze({ weapon: 'item_starter_v01689_druid_crooked_branch_staff', offhand: 'item_starter_v01689_druid_seedling_totem' }),
    Bard: Object.freeze({ weapon: 'item_starter_v01689_bard_camp_songblade', offhand: 'item_starter_v01689_bard_weathered_lute' }),
    Enchanter: Object.freeze({ weapon: 'item_starter_v01689_enchanter_rune_wand', offhand: 'item_starter_v01689_enchanter_clouded_orb' })
  });

  function canonicalActorClassName(actor = {}) {
    const source = actor?.sourceEntity || {};
    const raw = String(
      actor.className || actor.playerClass || actor.classId || actor.role || actor.type ||
      source.className || source.playerClass || source.classId || source.role || source.type || ''
    ).trim();
    const token = raw.toLowerCase().replace(/[\s_\-]/g, '');
    return CLASS_NAME_ALIASES[token] || (DR.CLASSES?.[raw] ? raw : '');
  }

  function classDefaultVisualItem(actor, slot) {
    const cls = canonicalActorClassName(actor);
    const id = cls && CLASS_DEFAULT_VISUAL_ITEM_IDS[cls]?.[slot];
    const catalog = itemCatalogEntry(id);
    if (!catalog) return null;
    return { ...catalog, itemId: catalog.itemId || catalog.id, sourceItemId: catalog.sourceItemId || catalog.id, _classDefaultVisual: true };
  }

  function itemAllowsActorClass(item, actor = {}) {
    if (!item) return false;
    const restrictions = Array.isArray(item.classRestrictions) ? item.classRestrictions : [];
    if (!restrictions.length) return true;
    const cls = canonicalActorClassName(actor);
    if (!cls) return true;
    return restrictions.some(value => String(value || '').toLowerCase() === cls.toLowerCase());
  }

  function resolveVisualSlotItem(actor, slot) {
    const direct = slotItemRaw(actor, slot);
    if (direct && itemAllowsActorClass(direct, actor)) return direct;
    return classDefaultVisualItem(actor, slot) || direct || null;
  }

  function equipmentForActor(actor) {
    return actor?.equipment || actor?.visualEquipment || actor?.botEquipment || actor?.gear || actor?.sourceEntity?.equipment || actor?.sourceEntity?.visualEquipment || actor?.sourceEntity?.botEquipment || {};
  }

  function itemCatalogEntry(id) {
    const key = String(id || '').trim();
    if (!key) return null;
    return DR.ITEM_BY_ID?.[key] || DR.ITEM_DRAFTS?.find?.(draft => String(draft?.id || '') === key) || null;
  }

  function hydrateVisualItem(value) {
    if (!value) return null;
    if (typeof value === 'string') return itemCatalogEntry(value) || { itemId: value, sourceItemId: value, id: value, name: value };
    if (typeof value !== 'object') return null;
    const sourceId = String(value.itemId || value.sourceItemId || value.sourceId || value.id || '').trim();
    const catalog = itemCatalogEntry(sourceId);
    // Runtime equipment instances may only carry normalized slot/stat data. Merge the
    // immutable draft visual metadata back in for the renderer without mutating gameplay data.
    if (catalog) return { ...catalog, ...value, icon: value.icon || catalog.icon, description: value.description || catalog.description, editorNote: value.editorNote || catalog.editorNote };
    return value;
  }

  function slotItemRaw(actor, slot) {
    const equipment = equipmentForActor(actor);
    if (!equipment || typeof equipment !== 'object') return null;
    if (equipment[slot]) return hydrateVisualItem(equipment[slot]);
    const aliases = SLOT_ALIASES[slot] || [];
    for (const alias of aliases) {
      if (equipment[alias]) return hydrateVisualItem(equipment[alias]);
    }
    return null;
  }

  function slotItem(actor, slot) {
    return resolveVisualSlotItem(actor, slot);
  }

  function hasEquippedWeapon(actor) {
    return !!slotItem(actor, 'weapon');
  }

  function hasEquippedOffhand(actor) {
    return !!slotItem(actor, 'offhand');
  }

  // V0.16.05: Ranger and Warden use class-locked weapon visuals. Their equipped
  // starter/default weapon stats remain valid, but paperdoll weapon/offhand art
  // is suppressed so it cannot draw generic sticks over the class bow or the
  // Warden shield+maul.
  function classLockClassToken(actor = {}) {
    const source = actor?.sourceEntity || {};
    return String(
      actor.className || actor.playerClass || actor.classId || actor.role || actor.type ||
      source.className || source.playerClass || source.classId || source.role || source.type || ''
    )
      .toLowerCase()
      .replace(/[\s_\-]/g, '');
  }

  function classLocksWeaponArt(actor = {}) {
    const cls = classLockClassToken(actor);
    return cls === 'ranger' || cls === 'warden' || cls.includes('ranger') || cls.includes('warden');
  }

  // Full class revamps that own their complete silhouette must not receive the
  // generic equipment paperdoll pass. Otherwise starter robes/weapons render as
  // a second model on top of the class model.
  function classOwnsFullBodyArt(actor = {}) {
    const cls = classLockClassToken(actor);
    return cls === 'shaman' || cls.includes('shaman');
  }

  function itemText(item) {
    return `${item?.name || ''} ${item?.baseName || ''} ${item?.itemId || ''} ${item?.sourceItemId || ''} ${item?.id || ''} ${(item?.tags || []).join(' ')} ${item?.type || ''} ${item?.subtype || ''} ${item?.slot || ''} ${item?.icon?.family || ''} ${item?.icon?.glyph || ''} ${item?.editorNote || ''}`.toLowerCase();
  }

  function rarityColor(item, fallback = '#cfdac8') {
    if (!item) return fallback;
    return item.visualColor || item.rarity?.color || item.icon?.color || item.color || fallback;
  }

  function shade(hex, amt) {
    try {
      const raw = String(hex || '').replace('#', '').trim();
      const full = raw.length === 3 ? raw.split('').map(ch => ch + ch).join('') : raw.padEnd(6, '0').slice(0, 6);
      const n = parseInt(full, 16);
      const r = clamp(((n >> 16) & 255) + amt, 0, 255) | 0;
      const g = clamp(((n >> 8) & 255) + amt, 0, 255) | 0;
      const b = clamp((n & 255) + amt, 0, 255) | 0;
      return `rgb(${r},${g},${b})`;
    } catch (_) { return hex || '#cfdac8'; }
  }

  function qualityAccent(item, fallback = '#d6b35a') {
    const key = String(item?.rarity?.key || item?.rarity || '').toLowerCase();
    if (key === 'gold' || key === 'orange' || key === 'red') return '#ffd36a';
    if (key === 'purple') return '#c48cff';
    if (key === 'blue') return '#73b7ff';
    if (key === 'green') return '#68e081';
    return rarityColor(item, fallback);
  }


  const RARITY_DETAIL = Object.freeze({
    grey: 0, gray: 0, trash: 0,
    white: 1, common: 1,
    green: 2, uncommon: 2,
    blue: 3, rare: 3,
    purple: 4, epic: 4,
    gold: 5, legendary: 5, orange: 5
  });

  function rarityKey(item) {
    return String(item?.rarity?.key || item?.rarity || 'white').toLowerCase();
  }

  function detailTier(item) {
    return RARITY_DETAIL[rarityKey(item)] ?? 1;
  }

  function classThemeName(actor = {}) {
    return String(canonicalActorClassName(actor) || actor?.className || '').toLowerCase();
  }

  function materialKind(item, actor = {}) {
    const text = itemText(item);
    if (/bone|skull|grave|necromancer|crypt/.test(text)) return 'bone';
    if (/bark|root|moss|leaf|vine|thorn|druid|warden/.test(text)) return 'nature';
    if (/holy|oath|sun|cleric|paladin|prayer|candle/.test(text)) return 'holy';
    if (/arcane|rune|violet|wizard|enchanter|summoner|planar|orb|silk/.test(text)) return 'arcane';
    if (/shaman|spirit|storm|river|totem|ritual|feather/.test(text)) return 'ritual';
    if (/plate|steel|iron|mail|chain|greaves|shield/.test(text)) return 'metal';
    if (/leather|hide|jerkin|boot|glove|belt|rogue|assassin|ranger|bard/.test(text)) return 'leather';
    if (/robe|cloth|silk|wrap|trousers|pants/.test(text)) return 'cloth';
    const cls = classThemeName(actor);
    if (['paladin','cleric'].includes(cls)) return 'holy';
    if (['wizard','enchanter','summoner'].includes(cls)) return 'arcane';
    if (cls === 'necromancer') return 'bone';
    if (['druid','warden','ranger'].includes(cls)) return 'nature';
    if (cls === 'shaman') return 'ritual';
    if (['rogue','assassin','bard','fighter'].includes(cls)) return 'leather';
    return 'cloth';
  }

  function armorTheme(item, actor = {}, slot = '') {
    const base = rarityColor(item, '#596061');
    const accent = qualityAccent(item, base);
    const material = materialKind(item, actor);
    const tier = detailTier(item);
    const theme = {
      base, accent, material, tier,
      dark: '#151018', outline: '#100d11', seam: shade(base, -32),
      light: shade(base, 38), mid: shade(base, 12), shadow: shade(base, -38),
      strap: '#322419', buckle: '#c69b52', stitch: '#cdb78c', rune: accent,
      cloth: base, leather: '#3f2d22', metal: '#9aa2a0', bone: '#d6ccb2', wood: '#6d4b2d'
    };
    if (material === 'metal') Object.assign(theme, { light: '#d9ded5', shadow: '#465052', seam: '#253036', strap: '#3a2a1d', buckle: accent });
    if (material === 'leather') Object.assign(theme, { light: shade(base, 46), shadow: shade(base, -48), seam: '#1f1715', strap: shade(base, -44), buckle: '#b48649', stitch: '#d2b17b' });
    if (material === 'cloth') Object.assign(theme, { light: shade(base, 32), shadow: shade(base, -36), seam: shade(base, -28), stitch: shade(base, 52) });
    if (material === 'arcane') Object.assign(theme, { rune: accent, light: shade(base, 48), shadow: shade(base, -48), buckle: '#b8c7ff', stitch: '#b9a8ff' });
    if (material === 'holy') Object.assign(theme, { rune: '#fff2a6', light: '#fff4c4', shadow: shade(base, -32), buckle: '#ffd36a', stitch: '#f2ddb3' });
    if (material === 'nature') Object.assign(theme, { rune: '#9ee57e', light: shade(base, 38), shadow: shade(base, -42), strap: '#4b3a24', buckle: '#8f7c4e', stitch: '#a5cf7a' });
    if (material === 'bone') Object.assign(theme, { light: '#efe5cc', shadow: '#3b4032', seam: '#302820', strap: '#2b201c', buckle: '#78ff9a', stitch: '#a8c09a', rune: '#78ff9a' });
    if (material === 'ritual') Object.assign(theme, { light: '#d6fff0', shadow: shade(base, -42), seam: '#244840', strap: '#5d3b24', buckle: '#70e6d3', stitch: '#d7a96e', rune: '#72d9ff' });
    return theme;
  }

  function drawRivet(ctx, x, y, color, r = 1.05, alpha = 0.8) {
    ctx.save(); ctx.globalAlpha = alpha;
    ellipse(ctx, x, y, r, r, 0, color, '#21160f', 0.35);
    ctx.restore();
  }

  function drawBuckle(ctx, x, y, w, h, theme, rot = 0) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    roundRect(ctx, -w / 2, -h / 2, w, h, Math.min(2, h / 2), 'rgba(0,0,0,0)', theme.buckle, 1.15);
    line(ctx, -w * .22, 0, w * .22, 0, theme.buckle, 0.75, 0.8);
    ctx.restore();
  }

  function drawShortStitches(ctx, x1, y1, x2, y2, theme, count = 4, alpha = 0.58) {
    const vx = x2 - x1, vy = y2 - y1;
    const len = Math.hypot(vx, vy) || 1;
    const nx = -vy / len, ny = vx / len;
    for (let i = 1; i <= count; i++) {
      const t = i / (count + 1);
      const x = x1 + vx * t, y = y1 + vy * t;
      line(ctx, x - nx * 1.9, y - ny * 1.9, x + nx * 1.9, y + ny * 1.9, theme.stitch, 0.55, alpha);
    }
  }

  function drawRarityRunes(ctx, x, y, theme, count = 2, spread = 7) {
    if ((theme.tier || 0) < 2) return;
    ctx.save();
    ctx.globalAlpha = Math.min(0.82, 0.22 + theme.tier * 0.12);
    ctx.strokeStyle = theme.rune; ctx.lineWidth = 0.65; ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const ox = (i - (count - 1) / 2) * spread;
      ctx.beginPath();
      ctx.moveTo(x + ox - 2, y - 2); ctx.lineTo(x + ox + 2, y + 2);
      ctx.moveTo(x + ox + 2, y - 2); ctx.lineTo(x + ox - 2, y + 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMaterialNoise(ctx, x1, y1, x2, y2, theme, count = 4, alpha = 0.22) {
    if ((theme.tier || 0) < 1) return;
    for (let i = 0; i < count; i++) {
      const t = (i + 1) / (count + 1);
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;
      const len = 3 + (i % 2) * 2;
      line(ctx, x - len * 0.5, y, x + len * 0.5, y - 1.4, theme.light, 0.45, alpha);
    }
  }

  function drawLayeredBand(ctx, x1, y1, x2, y2, theme, width = 3, alpha = 0.85) {
    line(ctx, x1, y1, x2, y2, theme.outline, width + 1.5, alpha);
    line(ctx, x1, y1, x2, y2, theme.strap, width, alpha);
    line(ctx, x1, y1 - 0.7, x2, y2 - 0.7, theme.light, 0.55, alpha * 0.55);
  }

  function poly(ctx, pts, fill, stroke = '#141016', lw = 1.2) {
    if (!pts || pts.length < 3) return;
    if (Base.poly) return Base.poly(ctx, pts, fill, stroke, lw);
    ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.fill(); if (lw > 0) ctx.stroke();
  }

  function ellipse(ctx, x, y, rx, ry, rot, fill, stroke = '#141016', lw = 1.1) {
    if (Base.ellipse) return Base.ellipse(ctx, x, y, rx, ry, rot, fill, stroke, lw);
    ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU); ctx.fill(); if (lw > 0) ctx.stroke();
  }

  function line(ctx, x1, y1, x2, y2, color, width = 2, alpha = 1) {
    if (Base.line) return Base.line(ctx, x1, y1, x2, y2, color, width, alpha);
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke = '#141016', lw = 1.1) {
    if (Base.roundRect) return Base.roundRect(ctx, x, y, w, h, r, fill, stroke, lw);
    ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.beginPath(); ctx.rect(x, y, w, h); ctx.fill(); if (lw > 0) ctx.stroke();
  }

  function hasAny(actor) {
    const eq = equipmentForActor(actor);
    if (eq && typeof eq === 'object' && Object.values(eq).some(Boolean)) return true;
    return !!canonicalActorClassName(actor);
  }

  function armorClass(item, actor) {
    const text = itemText(item);
    if (/plate|cuirass|pauldron|great|guard|iron|steel/.test(text)) return 'plate';
    if (/mail|scale|hauberk|lanternscale|chain/.test(text)) return 'mail';
    if (/leather|jerkin|hide|thornhide|rogue|fang/.test(text)) return 'leather';
    if (/silk|robe|moonless|rune|arcane|grave/.test(text)) return 'robe';
    const cls = String(actor?.className || '').toLowerCase();
    if (cls === 'fighter') return 'plate';
    if (cls === 'rogue') return 'leather';
    if (['enchanter','summoner','necromancer','cleric','druid'].includes(cls)) return 'robe';
    return 'mail';
  }

  function weaponKind(item, actor) {
    const text = itemText(item);
    const cls = String(actor?.className || actor?.playerClass || actor?.classId || '').toLowerCase();
    if (/crossbow/.test(text) || /assassin/.test(text) && /bow/.test(text)) return 'crossbow';
    if (/longbow|shortbow|greenwood|quiver|\bbow\b/.test(text)) return 'bow';
    if (/lute|mandolin|instrument|weathered_camp_lute|weathered camp lute/.test(text)) return 'lute';
    if (/songblade|sword|blade/.test(text)) return cls === 'fighter' || /greatsword|two.hand|rustcleaver/.test(text) ? 'greatsword' : 'sword';
    if (/throwing|fang|shiv|dagger|shortblade/.test(text)) return /throwing|fang/.test(text) ? 'throwingKnife' : 'dagger';
    if (/axe|cleaver/.test(text)) return cls === 'fighter' || /rustcleaver/.test(text) ? 'greatsword' : 'axe';
    if (/maul|mallet|mace|hammer|bell/.test(text)) return /mallet|maul/.test(text) ? 'maul' : 'mace';
    if (/skull/.test(text)) return 'skull';
    if (/grimoire|book/.test(text)) return 'book';
    if (/totem/.test(text)) return 'totem';
    if (/symbol|prayer|icon/.test(text)) return 'symbol';
    if (/orb|focus/.test(text)) return 'orb';
    if (/staff/.test(text)) return 'staff';
    if (/wand|bonewand|rod|scepter/.test(text)) return 'wand';
    if (cls === 'bard') return 'lute';
    return 'sword';
  }


  function weaponTheme(item, actor = {}, kind = '') {
    const cls = String(canonicalActorClassName(actor) || actor?.className || '').toLowerCase();
    const base = rarityColor(item, '#cfdac8');
    const accent = qualityAccent(item, base);
    const theme = { base, accent, dark: '#151018', edge: shade(base, 58), grip: '#4a3020', wrap: '#d8c09a', gem: accent, shadow: shade(base, -38), metal: '#aeb5b6', wood: '#6b4b2d' };
    if (cls === 'assassin') Object.assign(theme, { base: '#4d4658', accent: '#8a70c9', edge: '#cfd3d8', grip: '#1b1519', wrap: '#4f2733', gem: '#67e08f', shadow: '#141016', metal: '#6d7275', wood: '#2d2022' });
    else if (cls === 'ranger') Object.assign(theme, { base: '#77b85f', accent: '#c8e08a', edge: '#efe8bd', grip: '#5a3d24', wrap: '#d0a35f', gem: '#9be56d', shadow: '#2e3a26', wood: '#815a30' });
    else if (cls === 'bard') Object.assign(theme, { base: '#b77fe6', accent: '#ffd36a', edge: '#fff1bc', grip: '#744a2e', wrap: '#eacb8b', gem: '#e9b0ff', shadow: '#2d173f', wood: '#8b5730' });
    else if (cls === 'cleric') Object.assign(theme, { base: '#d9d2a2', accent: '#fff0a8', edge: '#fff8d0', grip: '#766842', wrap: '#f1e4b5', gem: '#aee3ff', shadow: '#55513e', metal: '#d4d0be' });
    else if (cls === 'paladin') Object.assign(theme, { base: '#d7c070', accent: '#ffd36a', edge: '#fff1b5', grip: '#6c5230', wrap: '#f3df99', gem: '#fff7bc', shadow: '#6b5c32', metal: '#d7d5c6' });
    else if (cls === 'fighter') Object.assign(theme, { base: '#9d8964', accent: '#e0b56b', edge: '#f0e6cf', grip: '#3b2b1c', wrap: '#8c6540', gem: '#d08a4b', shadow: '#2b2620', metal: '#8e9190' });
    else if (cls === 'rogue') Object.assign(theme, { base: '#6b7078', accent: '#66db89', edge: '#e5edf1', grip: '#1f1b1d', wrap: '#3a3539', gem: '#75e28a', shadow: '#121014', metal: '#9098a0' });
    else if (cls === 'warden') Object.assign(theme, { base: '#76a85e', accent: '#9be47c', edge: '#c6e3a0', grip: '#4b3a24', wrap: '#79a85e', gem: '#8fd875', shadow: '#2f3e26', metal: '#75806a', wood: '#6e4c2f' });
    else if (cls === 'wizard') Object.assign(theme, { base: '#6fa8ff', accent: '#a7d8ff', edge: '#e5f4ff', grip: '#3e4770', wrap: '#c1d3ff', gem: '#69cfff', shadow: '#20315a', metal: '#b5c8d9' });
    else if (cls === 'enchanter') Object.assign(theme, { base: '#b8a0ff', accent: '#e4b8ff', edge: '#fff2ff', grip: '#4b3c74', wrap: '#c7b6ff', gem: '#ef9dff', shadow: '#33264f', metal: '#c0b7d6' });
    else if (cls === 'shaman') Object.assign(theme, { base: '#59c9b2', accent: '#70e6d3', edge: '#d5fff3', grip: '#5d3b24', wrap: '#d7a96e', gem: '#72d9ff', shadow: '#244840', metal: '#879d91', wood: '#734c2f' });
    else if (cls === 'summoner') Object.assign(theme, { base: '#66d6c7', accent: '#8be9dd', edge: '#d6fff8', grip: '#30475f', wrap: '#8be9dd', gem: '#9b8cff', shadow: '#1f3f45', metal: '#9bc2c1' });
    else if (cls === 'necromancer') Object.assign(theme, { base: '#a8c09a', accent: '#78ff9a', edge: '#e4efd5', grip: '#302b25', wrap: '#4a4438', gem: '#78ff9a', shadow: '#26301f', metal: '#7f867b' });
    else if (cls === 'druid') Object.assign(theme, { base: '#78c26d', accent: '#9adf87', edge: '#e2ffd9', grip: '#5f4228', wrap: '#8dbd66', gem: '#b6f0a5', shadow: '#274927', metal: '#7a8568', wood: '#7a4d2c' });
    if (kind === 'book') theme.edge = '#f3dfb0';
    return theme;
  }

  function pxy(hand, dx, x, y) { return { x: hand.x + dx * x, y: hand.y + y }; }

  function drawGripWrap(ctx, a, b, color, count = 4, alpha = 0.75) {
    for (let i = 1; i <= count; i++) {
      const t = i / (count + 1);
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      line(ctx, x - 2.4, y + 1.5, x + 2.4, y - 1.5, color, 0.7, alpha);
    }
  }

  function drawGem(ctx, x, y, r, color, stroke = '#151018', alpha = 1) {
    poly(ctx, [{ x, y: y - r }, { x: x + r, y }, { x, y: y + r }, { x: x - r, y }], color, stroke, 0.8);
    line(ctx, x - r * 0.45, y - r * 0.25, x + r * 0.38, y - r * 0.5, '#ffffff', 0.55, 0.45 * alpha);
  }

  function drawBladePoly(ctx, hand, dx, gripX, gripY, tipX, tipY, halfWidth, theme, opts = {}) {
    const gx = hand.x + dx * gripX, gy = hand.y + gripY;
    const tx = hand.x + dx * tipX, ty = hand.y + tipY;
    const vx = tx - gx, vy = ty - gy;
    const len = Math.hypot(vx, vy) || 1;
    const nx = -vy / len, ny = vx / len;
    const baseW = halfWidth * 0.75;
    poly(ctx, [
      { x: gx + nx * baseW, y: gy + ny * baseW },
      { x: tx, y: ty },
      { x: gx - nx * baseW, y: gy - ny * baseW },
      { x: gx - dx * 1.2, y: gy + 5 }
    ], theme.base, theme.dark, opts.stroke || 1.2);
    line(ctx, gx, gy, tx, ty, theme.edge, opts.edgeWidth || 1.0, opts.edgeAlpha || 0.72);
    if (opts.fuller) line(ctx, gx + dx * 1.4, gy - 3, tx - dx * 1.8, ty + 4, shade(theme.base, 32), 0.9, 0.55);
  }

  function drawClassCrest(ctx, x, y, glyph, color, dark = '#151018', scale = 1) {
    if (!glyph) return;
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = dark;
    ctx.lineWidth = 0.4;
    ctx.font = `${Math.max(7, 9 * scale)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(glyph).slice(0, 2), x, y);
    ctx.restore();
  }

  function drawShieldShape(ctx, hand, side, item, actor) {
    const theme = weaponTheme(item, actor, 'shield');
    const glyph = item?.icon?.glyph || (/paladin/i.test(String(canonicalActorClassName(actor))) ? '✚' : '◆');
    poly(ctx, [
      { x: hand.x - side * 12, y: hand.y - 14 }, { x: hand.x + side * 10, y: hand.y - 10 },
      { x: hand.x + side * 9, y: hand.y + 11 }, { x: hand.x, y: hand.y + 21 },
      { x: hand.x - side * 10, y: hand.y + 10 }
    ], theme.shadow, theme.dark, 1.8);
    poly(ctx, [
      { x: hand.x - side * 9, y: hand.y - 11 }, { x: hand.x + side * 7, y: hand.y - 8 },
      { x: hand.x + side * 6, y: hand.y + 8 }, { x: hand.x, y: hand.y + 16 },
      { x: hand.x - side * 7, y: hand.y + 7 }
    ], theme.base, theme.dark, 1.0);
    line(ctx, hand.x - side * 8, hand.y - 6, hand.x + side * 5, hand.y + 4, theme.edge, 0.9, 0.58);
    line(ctx, hand.x - side * 4, hand.y - 12, hand.x + side * 4, hand.y + 13, theme.accent, 1.2, 0.62);
    drawClassCrest(ctx, hand.x, hand.y + 2, glyph, theme.accent, theme.dark, 0.92);
  }

  function drawBack(ctx, rig, pass = 'back') {
    const actor = rig?.actor || {};
    const requestedPass = pass === 'front' ? 'front' : 'back';
    if (capeDepthLayer(rig) !== requestedPass) return;
    if (classOwnsFullBodyArt(actor)) return;
    const cape = slotItem(actor, 'cape');
    if (!cape) return;
    const a = rig.anchors;
    const theme = armorTheme(cape, actor, 'cape');
    const profile = equipmentProfile(actor), side = rig.dir?.capeSide || 0;
    const sway = (rig.pose?.capeSway || 0) * 0.42;
    const topY = a.chest.y - 15 + profile.chestY;
    const hemY = a.pelvis.y + 48 * profile.capeLength;
    ctx.save();
    ctx.globalAlpha = 0.91;
    poly(ctx, [
      { x: a.chest.x - 24 * profile.capeWidth - side * 4, y: topY },
      { x: a.chest.x + 24 * profile.capeWidth - side * 4, y: topY },
      { x: a.pelvis.x + 22 * profile.capeWidth - side * 3 + sway, y: hemY },
      { x: a.pelvis.x + 4 * profile.capeWidth + sway * .3, y: hemY + 4 },
      { x: a.pelvis.x - 22 * profile.capeWidth - side * 3 - sway, y: hemY }
    ], theme.shadow, theme.outline, 1.8);
    poly(ctx, [
      { x: a.chest.x - 18 * profile.capeWidth - side * 3, y: topY + 4 },
      { x: a.chest.x + 18 * profile.capeWidth - side * 3, y: topY + 4 },
      { x: a.pelvis.x + 15 * profile.capeWidth + sway, y: hemY - 3 },
      { x: a.pelvis.x - 15 * profile.capeWidth - sway, y: hemY - 3 }
    ], shade(theme.base, -16), theme.outline, 0.65);
    line(ctx, a.chest.x - 14, topY + 8, a.pelvis.x - 12 + sway, hemY - 7, theme.light, 1.0, 0.44);
    line(ctx, a.chest.x + 13, topY + 8, a.pelvis.x + 12 + sway * .7, hemY - 7, theme.seam, 1.0, 0.52);
    line(ctx, a.chest.x - 20, topY + 4, a.chest.x + 20, topY + 4, theme.accent, 1.15, 0.55 + theme.tier * 0.05);
    drawShortStitches(ctx, a.pelvis.x - 13 - sway, hemY - 2, a.pelvis.x + 14 + sway, hemY - 2, theme, 6, 0.44);
    drawRarityRunes(ctx, a.chest.x, topY + 11, theme, Math.min(3, Math.max(1, theme.tier - 1)), 6);
    ctx.restore();
  }

  function drawLegs(ctx, rig) {
    const actor = rig?.actor || {};
    if (classOwnsFullBodyArt(actor)) return;
    const race = String(actor.raceId || '').toLowerCase();
    const legsItem = slotItem(actor, 'legs');
    const feetItem = slotItem(actor, 'feet');
    if (!legsItem && !feetItem) return;
    const a = rig.anchors, profile = equipmentProfile(actor);
    const legs = a.legs || {};
    const legTheme = armorTheme(legsItem, actor, 'legs');
    const bootTheme = armorTheme(feetItem, actor, 'feet');
    const cls = armorClass(legsItem, actor);
    ctx.save();
    for (const l of [legs.far, legs.near]) {
      if (!l) continue;
      const far = l === legs.far;
      const alpha = far ? 0.58 : 0.86;
      if (legsItem) {
        const width = (cls === 'robe' ? 8.4 : 7.2) * profile.armorScale;
        line(ctx, l.hip.x, l.hip.y + 1, l.knee.x, l.knee.y + 1, legTheme.outline, width + 3, 0.68);
        line(ctx, l.hip.x, l.hip.y + 1, l.knee.x, l.knee.y + 1, legTheme.base, width, alpha);
        line(ctx, l.knee.x, l.knee.y + 1, l.foot.x, l.foot.y - 3, legTheme.shadow, Math.max(4.8, width - 1.1), far ? 0.50 : 0.76);
        line(ctx, l.hip.x + l.sign * 1.7, l.hip.y + 5, l.knee.x + l.sign * 1.1, l.knee.y - 1, legTheme.light, 0.75, alpha * 0.55);
        drawShortStitches(ctx, l.hip.x - l.sign * 2, l.hip.y + 7, l.knee.x - l.sign * 2, l.knee.y + 3, legTheme, 4, alpha * 0.58);
        if (cls === 'mail') {
          for (let j = 0; j < 3; j++) line(ctx, l.hip.x - 4, l.hip.y + 8 + j * 5, l.knee.x + 4, l.knee.y + j * 2, legTheme.light, 0.45, alpha * 0.35);
        } else if (cls === 'robe') {
          poly(ctx, [
            { x: l.hip.x - l.sign * 6, y: l.hip.y + 1 }, { x: l.hip.x + l.sign * 6, y: l.hip.y + 1 },
            { x: l.foot.x + l.sign * 5, y: l.foot.y - 8 }, { x: l.foot.x - l.sign * 6, y: l.foot.y - 9 }
          ], shade(legTheme.base, -6), legTheme.outline, 0.7);
          line(ctx, l.hip.x, l.hip.y + 3, l.foot.x, l.foot.y - 10, legTheme.accent, 0.75, alpha * 0.52);
        }
        if (legTheme.tier >= 2) drawRarityRunes(ctx, l.knee.x, l.knee.y + 1, legTheme, 1, 5);
      }
      if (feetItem) {
        if (race === 'bogling') {
          const ankle = l.ankle || l.foot, sgn = l.sign || 1;
          poly(ctx, [
            { x: ankle.x - sgn * 7 * profile.bootScale, y: ankle.y - 7 * profile.bootScale },
            { x: ankle.x + sgn * 8 * profile.bootScale, y: ankle.y - 5 * profile.bootScale },
            { x: ankle.x + sgn * 7 * profile.bootScale, y: ankle.y + 5 * profile.bootScale },
            { x: ankle.x - sgn * 6 * profile.bootScale, y: ankle.y + 5 * profile.bootScale }
          ], bootTheme.shadow, bootTheme.outline, 1.1);
          line(ctx, ankle.x - sgn * 6, ankle.y - 2, ankle.x + sgn * 6, ankle.y + 2, bootTheme.light, 1.2, 0.75);
          drawShortStitches(ctx, ankle.x - sgn * 5, ankle.y + 3, ankle.x + sgn * 5, ankle.y - 1, bootTheme, 3, 0.45);
        } else {
          ellipse(ctx, l.foot.x + l.sign * 2, l.foot.y + 2, 9.2 * profile.bootScale, 4.9 * profile.bootScale, 0.08 * l.sign, bootTheme.shadow, bootTheme.outline, 1.2);
          ellipse(ctx, l.foot.x + l.sign * 4, l.foot.y + 1, 5.0 * profile.bootScale, 2.5 * profile.bootScale, 0.08 * l.sign, bootTheme.base, null, 0);
          line(ctx, l.foot.x - 3, l.foot.y, l.foot.x + 6, l.foot.y - 1, bootTheme.light, 0.9, 0.72);
          line(ctx, l.foot.x - 6, l.foot.y + 4, l.foot.x + 6, l.foot.y + 4, '#110d0b', 1.0, 0.78);
          drawRivet(ctx, l.foot.x + l.sign * 1, l.foot.y - 1, bootTheme.buckle, 0.75, 0.62);
        }
      }
    }
    ctx.restore();
  }

  function drawTorso(ctx, rig) {
    const actor = rig?.actor || {};
    if (classOwnsFullBodyArt(actor)) return;
    const chestItem = slotItem(actor, 'chest');
    const shouldersItem = slotItem(actor, 'shoulders');
    const handsItem = slotItem(actor, 'hands');
    const amulet = slotItem(actor, 'amulet') || slotItem(actor, 'charm');
    if (!chestItem && !shouldersItem && !handsItem && !amulet) return;
    const a = rig.anchors, profile = equipmentProfile(actor);
    const d = rig.dir || {};
    const sw = 23 * profile.armorScale * (d.shoulderScale || 1);
    const hw = 14 * profile.armorScale * (d.torsoScaleX || 1);
    const chest = { x: a.chest.x, y: a.chest.y + profile.chestY };
    const pelvis = a.pelvis;
    const cls = armorClass(chestItem || shouldersItem, actor);
    const theme = armorTheme(chestItem || shouldersItem || amulet, actor, 'chest');
    ctx.save();
    if (chestItem) {
      const topY = chest.y - 14;
      const midY = chest.y + 8;
      const botY = pelvis.y + (cls === 'robe' ? 41 : 26);
      const fill = cls === 'plate' ? theme.mid : cls === 'robe' ? shade(theme.base, -8) : theme.base;
      poly(ctx, [
        { x: chest.x - sw + d.torsoSkew * 0.25, y: topY },
        { x: chest.x + sw + d.torsoSkew * 0.25, y: topY },
        { x: pelvis.x + hw + (cls === 'robe' ? 6 : 1), y: botY },
        { x: pelvis.x - hw - (cls === 'robe' ? 6 : 1), y: botY }
      ], fill, theme.outline, 1.55);

      if (cls === 'plate') {
        poly(ctx, [
          { x: chest.x - 14, y: topY + 5 }, { x: chest.x - 2, y: topY + 9 },
          { x: pelvis.x - 4, y: pelvis.y + 20 }, { x: pelvis.x - 13, y: pelvis.y + 14 }
        ], shade(theme.base, -7), theme.outline, 0.55);
        poly(ctx, [
          { x: chest.x + 14, y: topY + 5 }, { x: chest.x + 2, y: topY + 9 },
          { x: pelvis.x + 4, y: pelvis.y + 20 }, { x: pelvis.x + 13, y: pelvis.y + 14 }
        ], shade(theme.base, 4), theme.outline, 0.55);
        line(ctx, chest.x, topY + 4, pelvis.x, pelvis.y + 23, theme.light, 1.05, 0.74);
        line(ctx, chest.x - 17, midY, chest.x + 17, midY, theme.seam, 1.0, 0.66);
        for (const x of [-11, 11]) drawRivet(ctx, chest.x + x, midY - 4, theme.buckle, 1.0, 0.72);
        drawMaterialNoise(ctx, chest.x - 12, topY + 4, chest.x + 10, pelvis.y + 14, theme, 4, 0.23);
      } else if (cls === 'mail') {
        for (let i = -2; i <= 3; i++) line(ctx, chest.x - 17, midY + i * 4.5, chest.x + 17, midY + i * 4.5, i % 2 ? theme.shadow : theme.light, 0.72, 0.42);
        for (let i = -1; i <= 1; i++) line(ctx, chest.x + i * 7, topY + 5, chest.x + i * 5, pelvis.y + 22, theme.seam, 0.55, 0.35);
        drawLayeredBand(ctx, chest.x - 17, midY + 7, chest.x + 17, midY + 8, theme, 2.1, 0.72);
        drawBuckle(ctx, chest.x, midY + 8, 5.4, 4.0, theme, 0.02);
      } else if (cls === 'robe') {
        poly(ctx, [
          { x: chest.x - 13, y: topY + 3 }, { x: chest.x + 13, y: topY + 3 },
          { x: pelvis.x + 18, y: botY - 1 }, { x: pelvis.x, y: botY + 6 }, { x: pelvis.x - 18, y: botY - 1 }
        ], shade(theme.base, -13), theme.outline, 0.8);
        line(ctx, chest.x, topY + 5, pelvis.x, botY - 2, theme.accent, 1.15, 0.82);
        line(ctx, chest.x - 12, midY, chest.x + 12, midY, theme.light, 1.0, 0.52);
        drawLayeredBand(ctx, chest.x - 15, midY + 9, chest.x + 15, midY + 9, theme, 2.4, 0.68);
        drawShortStitches(ctx, chest.x - 14, topY + 6, pelvis.x - 13, botY - 5, theme, 7, 0.35);
        drawShortStitches(ctx, chest.x + 14, topY + 6, pelvis.x + 13, botY - 5, theme, 7, 0.35);
        drawRarityRunes(ctx, chest.x, chest.y + 3, theme, Math.min(3, Math.max(1, theme.tier)), 6);
      } else {
        poly(ctx, [
          { x: chest.x - 17, y: topY + 3 }, { x: chest.x - 2, y: topY + 7 },
          { x: pelvis.x - 8, y: pelvis.y + 20 }, { x: pelvis.x - 17, y: pelvis.y + 14 }
        ], theme.shadow, theme.outline, 0.55);
        poly(ctx, [
          { x: chest.x + 17, y: topY + 3 }, { x: chest.x + 2, y: topY + 7 },
          { x: pelvis.x + 8, y: pelvis.y + 20 }, { x: pelvis.x + 17, y: pelvis.y + 14 }
        ], shade(theme.base, 5), theme.outline, 0.55);
        drawLayeredBand(ctx, chest.x - 16, topY + 4, pelvis.x + 12, pelvis.y + 18, theme, 2.4, 0.82);
        drawLayeredBand(ctx, chest.x + 16, topY + 4, pelvis.x - 12, pelvis.y + 18, theme, 2.4, 0.82);
        drawBuckle(ctx, chest.x, midY + 5, 5.5, 4.0, theme, 0.03);
        drawShortStitches(ctx, chest.x - 14, topY + 8, chest.x - 10, pelvis.y + 20, theme, 5, 0.46);
        drawShortStitches(ctx, chest.x + 14, topY + 8, chest.x + 10, pelvis.y + 20, theme, 5, 0.46);
        drawMaterialNoise(ctx, chest.x - 16, topY + 8, chest.x + 16, pelvis.y + 16, theme, 5, 0.25);
      }
      if (theme.tier >= 3) drawGem(ctx, chest.x, midY - 6, 2.4, theme.rune, theme.outline, 0.82);
    }
    if (shouldersItem) {
      const st = armorTheme(shouldersItem, actor, 'shoulders');
      const left = a.shoulders.left, right = a.shoulders.right;
      const nearFirst = d.nearSide < 0;
      const drawShoulder = (pt, flip, alpha = 0.88) => {
        ctx.save(); ctx.globalAlpha = alpha;
        poly(ctx, [
          { x: pt.x - flip * 11 * profile.shoulderScale, y: pt.y - 3 + profile.chestY },
          { x: pt.x + flip * 4 * profile.shoulderScale, y: pt.y - 6 + profile.chestY },
          { x: pt.x + flip * 13 * profile.shoulderScale, y: pt.y + 1 + profile.chestY },
          { x: pt.x + flip * 4 * profile.shoulderScale, y: pt.y + 7 + profile.chestY },
          { x: pt.x - flip * 10 * profile.shoulderScale, y: pt.y + 5 + profile.chestY }
        ], st.shadow, st.outline, 1.2);
        ellipse(ctx, pt.x + flip * 1.5, pt.y + 1 + profile.chestY, 9.2 * profile.shoulderScale, 5.6 * profile.shoulderScale, flip * 0.14, st.base, st.outline, 0.8);
        line(ctx, pt.x - flip * 7, pt.y - 1 + profile.chestY, pt.x + flip * 6, pt.y - 3 + profile.chestY, st.light, 0.9, 0.68);
        if (st.tier >= 2) drawRivet(ctx, pt.x + flip * 3, pt.y + 2 + profile.chestY, st.buckle, 0.8, 0.58);
        ctx.restore();
      };
      drawShoulder(nearFirst ? right : left, nearFirst ? 1 : -1, 0.64);
      drawShoulder(nearFirst ? left : right, nearFirst ? -1 : 1, 0.90);
    }
    if (amulet) {
      const at = armorTheme(amulet, actor, 'charm');
      line(ctx, chest.x - 7, chest.y - 8, chest.x, chest.y + 3, at.buckle, 0.95, 0.75);
      line(ctx, chest.x + 7, chest.y - 8, chest.x, chest.y + 3, at.buckle, 0.95, 0.75);
      ellipse(ctx, chest.x, chest.y + 5, 3.2, 4.2, 0, at.accent, at.outline, 0.8);
      drawGem(ctx, chest.x, chest.y + 5, 1.5, at.rune, at.outline, 0.8);
    }
    ctx.restore();
  }

  function drawArmGear(ctx, rig, which) {
    const item = slotItem(rig?.actor || {}, 'hands');
    if (!item) return;
    const arms = rig.anchors?.arms || {}, profile = equipmentProfile(rig?.actor || {});
    const targets = which === 'far' ? [arms.far] : [arms.near];
    const theme = armorTheme(item, rig?.actor || {}, 'hands');
    ctx.save();
    for (const arm of targets) {
      if (!arm || arm.hiddenBehindTorso) continue;
      const far = arm === arms.far;
      const alpha = far ? 0.52 : 0.82;
      line(ctx, arm.elbow.x, arm.elbow.y, arm.hand.x, arm.hand.y, theme.outline, 7.6 * profile.gloveScale, alpha * 0.92);
      line(ctx, arm.elbow.x, arm.elbow.y, arm.hand.x, arm.hand.y, theme.shadow, 5.9 * profile.gloveScale, alpha);
      const mx = arm.elbow.x + (arm.hand.x - arm.elbow.x) * 0.55;
      const my = arm.elbow.y + (arm.hand.y - arm.elbow.y) * 0.55;
      ellipse(ctx, mx, my, 4.2 * profile.gloveScale, 5.0 * profile.gloveScale, 0.15, theme.base, theme.outline, 0.8);
      drawShortStitches(ctx, arm.elbow.x, arm.elbow.y + 1, arm.hand.x, arm.hand.y - 1, theme, 3, alpha * 0.42);
      line(ctx, arm.elbow.x + 1, arm.elbow.y - 1, arm.hand.x - 1, arm.hand.y - 2, theme.light, 0.6, alpha * 0.55);
      ellipse(ctx, arm.hand.x, arm.hand.y, 5.7 * profile.gloveScale, 5.1 * profile.gloveScale, 0, theme.base, theme.outline, 1.0);
      line(ctx, arm.hand.x - 2, arm.hand.y - 2, arm.hand.x + 3, arm.hand.y - 4, theme.light, 0.75, 0.58);
      if (theme.tier >= 3) drawRivet(ctx, mx, my, theme.buckle, 0.8, alpha * 0.6);
    }
    ctx.restore();
  }

  function drawHeadGear(ctx, rig) {
    const actor = rig?.actor || {};
    const item = slotItem(actor, 'head');
    if (!item) return;
    const h = rig.anchors?.head;
    if (!h) return;
    const cls = armorClass(item, actor), profile = equipmentProfile(actor), hs = profile.helmetScale, hy = profile.helmetY;
    const theme = armorTheme(item, actor, 'head');
    const text = itemText(item);
    ctx.save();
    if (cls === 'plate' || /helm|guard|cuirass/.test(text)) {
      ellipse(ctx, h.x, h.y - 7 + hy, (h.rx + 2.7) * hs, h.ry * 0.74 * hs, 0, theme.base, theme.outline, 1.5);
      poly(ctx, [
        { x: h.x - (h.rx + 3) * hs, y: h.y - 7 + hy }, { x: h.x + (h.rx + 3) * hs, y: h.y - 7 + hy },
        { x: h.x + h.rx * 0.70 * hs, y: h.y + 4 + hy }, { x: h.x - h.rx * 0.70 * hs, y: h.y + 4 + hy }
      ], theme.shadow, theme.outline, 1.05);
      line(ctx, h.x, h.y - 18 + hy, h.x, h.y + 2 + hy, theme.light, 1.05, 0.74);
      line(ctx, h.x - h.rx * .74, h.y - 6 + hy, h.x + h.rx * .74, h.y - 6 + hy, theme.accent, 0.9, 0.55);
      for (const sx of [-.55, .55]) drawRivet(ctx, h.x + h.rx * sx, h.y - 5 + hy, theme.buckle, 0.85, 0.58);
    } else if (cls === 'leather' || /hood|mask/.test(text)) {
      poly(ctx, [
        { x: h.x - h.rx - 4, y: h.y - 1 }, { x: h.x - h.rx + 1, y: h.y - 15 },
        { x: h.x, y: h.y - 24 }, { x: h.x + h.rx - 1, y: h.y - 15 },
        { x: h.x + h.rx + 4, y: h.y - 1 }, { x: h.x + h.rx * 0.58, y: h.y + 8 },
        { x: h.x - h.rx * 0.58, y: h.y + 8 }
      ], theme.shadow, theme.outline, 1.45);
      poly(ctx, [
        { x: h.x - h.rx + 1, y: h.y - 2 }, { x: h.x - h.rx + 4, y: h.y - 13 },
        { x: h.x, y: h.y - 20 }, { x: h.x + h.rx - 4, y: h.y - 13 },
        { x: h.x + h.rx - 1, y: h.y - 2 }, { x: h.x + h.rx * 0.46, y: h.y + 5 },
        { x: h.x - h.rx * 0.46, y: h.y + 5 }
      ], theme.base, theme.outline, 0.55);
      drawShortStitches(ctx, h.x - h.rx + 2, h.y - 4, h.x, h.y - 17, theme, 4, 0.46);
      drawShortStitches(ctx, h.x + h.rx - 2, h.y - 4, h.x, h.y - 17, theme, 4, 0.46);
      if (theme.tier >= 2) line(ctx, h.x - 8, h.y - 7, h.x + 8, h.y - 7, theme.accent, 0.8, 0.58);
    } else {
      poly(ctx, [
        { x: h.x - h.rx - 3, y: h.y - 4 }, { x: h.x - 3, y: h.y - 23 },
        { x: h.x + h.rx + 3, y: h.y - 4 }, { x: h.x + h.rx * 0.72, y: h.y + 9 },
        { x: h.x - h.rx * 0.72, y: h.y + 9 }
      ], theme.shadow, theme.outline, 1.4);
      poly(ctx, [
        { x: h.x - h.rx, y: h.y - 2 }, { x: h.x - 2, y: h.y - 19 },
        { x: h.x + h.rx, y: h.y - 2 }, { x: h.x + h.rx * 0.55, y: h.y + 6 },
        { x: h.x - h.rx * 0.55, y: h.y + 6 }
      ], theme.base, theme.outline, 0.55);
      line(ctx, h.x - 8, h.y - 7, h.x + 8, h.y - 7, theme.accent, 1.0, 0.72);
      drawRarityRunes(ctx, h.x, h.y - 2, theme, Math.min(2, Math.max(1, theme.tier - 1)), 5);
    }
    ctx.restore();
  }

  function drawJewelry(ctx, rig) {
    const actor = rig?.actor || {};
    const h = rig.anchors?.head;
    if (!h) return;
    const ring1 = slotItem(actor, 'ring1');
    const ring2 = slotItem(actor, 'ring2');
    const ear1 = slotItem(actor, 'earring1');
    const ear2 = slotItem(actor, 'earring2');
    ctx.save();
    if (ear1) ellipse(ctx, h.x - h.rx - 2, h.y + 4, 1.6, 2.4, 0, qualityAccent(ear1), '#241806', 0.5);
    if (ear2) ellipse(ctx, h.x + h.rx + 2, h.y + 4, 1.6, 2.4, 0, qualityAccent(ear2), '#241806', 0.5);
    const main = rig.anchors?.mainHand;
    const off = rig.anchors?.offHand;
    if (ring1 && main) ellipse(ctx, main.x + 2, main.y + 1, 1.5, 1.1, 0, qualityAccent(ring1), '#241806', 0.35);
    if (ring2 && off) ellipse(ctx, off.x - 2, off.y + 1, 1.5, 1.1, 0, qualityAccent(ring2), '#241806', 0.35);
    ctx.restore();
  }

  function drawWeaponShape(ctx, kind, hand, offHand, side, item, actor) {
    const dx = side || 1;
    const theme = weaponTheme(item, actor, kind);
    const text = itemText(item);
    const dark = theme.dark;
    const color = theme.base;
    const accent = theme.accent;
    const edge = theme.edge;
    const grip = theme.grip;
    const wrap = theme.wrap;
    const cls = String(canonicalActorClassName(actor) || '').toLowerCase();

    if (kind === 'staff') {
      const base = pxy(hand, dx, -5, 17), tip = pxy(hand, dx, 8, -42);
      line(ctx, base.x, base.y, tip.x, tip.y, dark, 5.4, 1);
      line(ctx, base.x, base.y, tip.x, tip.y, shade(theme.wood, -8), 3.6, 1);
      line(ctx, hand.x - dx * 2, hand.y + 8, hand.x + dx * 6, hand.y - 31, shade(theme.wood, 28), 0.9, 0.52);
      drawGripWrap(ctx, pxy(hand, dx, -2, 9), pxy(hand, dx, 3, -9), wrap, 5, 0.72);
      if (cls === 'druid') {
        line(ctx, tip.x - dx * 3, tip.y + 7, tip.x + dx * 5, tip.y - 1, accent, 1.3, 0.75);
        ellipse(ctx, tip.x + dx * 5, tip.y + 1, 3.0, 5.2, dx * 0.45, '#6fcb71', dark, 0.55);
        ellipse(ctx, tip.x - dx * 4, tip.y + 5, 2.5, 4.4, -dx * 0.35, '#88d47c', dark, 0.45);
        drawGem(ctx, tip.x, tip.y - 1, 2.6, '#baf4a7', dark, 0.85);
      } else if (cls === 'shaman') {
        line(ctx, tip.x - dx * 6, tip.y + 6, tip.x + dx * 6, tip.y + 2, '#dbc180', 1.5, 0.86);
        ellipse(ctx, tip.x, tip.y - 2, 4.5, 5.6, 0, accent, dark, 0.9);
        for (let i = -1; i <= 1; i += 2) line(ctx, tip.x + dx * (i * 3), tip.y + 5, tip.x + dx * (i * 6), tip.y + 13, '#d7a96e', 0.9, 0.75);
      } else {
        ellipse(ctx, tip.x, tip.y - 1, 5.2, 6.4, 0, accent, dark, 1.0);
        drawGem(ctx, tip.x, tip.y - 1, 2.6, cls === 'wizard' ? '#69cfff' : accent, dark, 0.9);
        line(ctx, tip.x - dx * 6, tip.y + 6, tip.x + dx * 6, tip.y + 4, shade(color, 24), 1.3, 0.65);
      }
    } else if (kind === 'wand') {
      const base = pxy(hand, dx, -2, 8), tip = pxy(hand, dx, 14, -27);
      line(ctx, base.x, base.y, tip.x, tip.y, dark, 4.0, 1);
      line(ctx, base.x + dx * 1, base.y - 1, tip.x, tip.y, color, 2.0, 0.95);
      drawGripWrap(ctx, pxy(hand, dx, 0, 4), pxy(hand, dx, 6, -9), wrap, 3, 0.7);
      drawGem(ctx, tip.x + dx * 1, tip.y - 2, 4.0, cls === 'necromancer' ? '#78ff9a' : accent, dark, 0.9);
      if (cls === 'necromancer') {
        ellipse(ctx, tip.x - dx * 3, tip.y + 4, 3.1, 3.8, 0, '#e7dcc1', dark, 0.8);
        line(ctx, tip.x - dx * 1, tip.y + 4, tip.x + dx * 4, tip.y + 9, '#5b4a3d', 0.7, 0.55);
      } else {
        line(ctx, tip.x - dx * 6, tip.y + 2, tip.x + dx * 5, tip.y + 5, edge, 0.7, 0.5);
      }
    } else if (kind === 'book') {
      roundRect(ctx, hand.x - 11, hand.y - 16, 20, 25, 2.6, shade(color, -16), dark, 1.4);
      roundRect(ctx, hand.x - 8, hand.y - 13, 14, 19, 2.0, color, dark, 0.8);
      line(ctx, hand.x - 1, hand.y - 14, hand.x - 1, hand.y + 8, accent, 0.9, 0.82);
      line(ctx, hand.x - 7, hand.y - 8, hand.x + 5, hand.y - 8, edge, 0.7, 0.58);
      line(ctx, hand.x - 7, hand.y - 3, hand.x + 4, hand.y - 3, shade(color, 35), 0.55, 0.42);
      drawClassCrest(ctx, hand.x + 1, hand.y + 1, item?.icon?.glyph || '▤', accent, dark, 0.82);
    } else if (kind === 'orb' || kind === 'focus') {
      ellipse(ctx, hand.x, hand.y - 7, 7.2, 8.0, 0, shade(color, -8), dark, 1.2);
      ellipse(ctx, hand.x, hand.y - 7, 4.6, 5.0, 0, color, dark, 0.6);
      drawGem(ctx, hand.x, hand.y - 7, 3.2, accent, dark, 0.85);
      for (let i = 0; i < 3; i++) {
        line(ctx, hand.x - dx * (8 + i * 1.7), hand.y - 7 + i * 2, hand.x + dx * (8 + i * 1.6), hand.y - 7 - i * 1.6, shade(accent, i * 10), 0.55, 0.28);
      }
    } else if (kind === 'symbol') {
      ellipse(ctx, hand.x, hand.y - 7, 7.8, 8.6, 0, shade(color, -10), dark, 1.25);
      ellipse(ctx, hand.x, hand.y - 7, 4.4, 5.0, 0, color, dark, 0.6);
      line(ctx, hand.x, hand.y - 14, hand.x, hand.y + 1, accent, 1.7, 0.95);
      line(ctx, hand.x - dx * 5, hand.y - 8, hand.x + dx * 5, hand.y - 8, accent, 1.2, 0.88);
      drawGem(ctx, hand.x, hand.y - 7, 1.8, '#aee3ff', dark, 0.8);
    } else if (kind === 'totem') {
      roundRect(ctx, hand.x - 5.6, hand.y - 18, 11.2, 22.5, 2.5, shade(color, -16), dark, 1.3);
      line(ctx, hand.x - 5, hand.y - 10, hand.x + 5, hand.y - 10, accent, 1.1, 0.8);
      line(ctx, hand.x - 4, hand.y - 3, hand.x + 4, hand.y - 4, '#d7a96e', 0.9, 0.7);
      ellipse(ctx, hand.x, hand.y - 19, 4.9, 3.4, 0, accent, dark, 0.8);
      for (let i = -1; i <= 1; i += 2) line(ctx, hand.x + dx * i * 3.8, hand.y - 15, hand.x + dx * i * 8, hand.y - 21, '#dcc385', 0.8, 0.65);
    } else if (kind === 'skull') {
      ellipse(ctx, hand.x, hand.y - 8, 7.2, 7.8, 0, '#d9d2b8', dark, 1.2);
      ellipse(ctx, hand.x - 2.8, hand.y - 9.5, 1.5, 1.9, 0, dark, null, 0);
      ellipse(ctx, hand.x + 2.8, hand.y - 9.5, 1.5, 1.9, 0, dark, null, 0);
      line(ctx, hand.x - 3.2, hand.y - 4.5, hand.x + 3.2, hand.y - 4.5, dark, 0.8, 0.8);
      drawGem(ctx, hand.x, hand.y - 14.5, 1.8, '#78ff9a', dark, 0.72);
      line(ctx, hand.x - dx * 6, hand.y - 1, hand.x + dx * 6, hand.y + 2, '#4a4438', 0.9, 0.55);
    } else if (kind === 'lute') {
      ellipse(ctx, hand.x - dx * 8, hand.y - 1, 10.8, 13.4, -dx * 0.22, shade(theme.wood, -5), dark, 1.5);
      ellipse(ctx, hand.x - dx * 8, hand.y - 1, 6.2, 8.0, -dx * 0.22, color, dark, 0.8);
      ellipse(ctx, hand.x - dx * 8, hand.y - 1, 2.1, 2.5, 0, '#1d120b', '#513219', 0.45);
      line(ctx, hand.x - dx * 2, hand.y - 8, hand.x + dx * 18, hand.y - 24, shade(theme.wood, 12), 3.8, 1);
      line(ctx, hand.x + dx * 15, hand.y - 25, hand.x + dx * 22, hand.y - 25, dark, 1.8, 0.85);
      for (let i = -2; i <= 2; i++) line(ctx, hand.x - dx * (12 - i * 0.4), hand.y - 7 + i * 2, hand.x + dx * 14, hand.y - 21 + i * 0.75, '#f3dfb0', 0.42, 0.62);
      line(ctx, hand.x - dx * 16, hand.y + 9, hand.x - dx * 11, hand.y + 15, accent, 1.2, 0.7);
    } else if (kind === 'bow') {
      const top = pxy(hand, dx, 10, -38), bot = pxy(hand, dx, -5, 19), mid = pxy(hand, dx, 1, -8);
      ctx.save(); ctx.strokeStyle = shade(theme.wood, -10); ctx.lineWidth = 4.0; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.quadraticCurveTo(hand.x + dx * 22, hand.y - 8, bot.x, bot.y); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.strokeStyle = shade(theme.wood, 28); ctx.lineWidth = 1.05; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(top.x - dx * 1.2, top.y + 4); ctx.quadraticCurveTo(hand.x + dx * 15, hand.y - 8, bot.x + dx * 0.8, bot.y - 4); ctx.stroke(); ctx.restore();
      line(ctx, top.x, top.y, bot.x, bot.y, '#efe7c8', 0.72, 0.82);
      roundRect(ctx, mid.x - dx * 5, mid.y - 3, dx * 11 || 11, 5, 2, wrap, dark, 0.65);
      line(ctx, mid.x - dx * 7, mid.y, mid.x + dx * 19, mid.y - 3, accent, 1.4, 0.75);
      ellipse(ctx, mid.x + dx * 19, mid.y - 3, 2.5, 1.1, 0, '#d8e0bd', dark, 0.35);
    } else if (kind === 'crossbow') {
      const cx = hand.x + dx * 4, cy = hand.y - 8;
      line(ctx, hand.x - dx * 7, hand.y + 7, cx + dx * 7, cy - 6, dark, 5.6, 1);
      line(ctx, hand.x - dx * 6, hand.y + 6, cx + dx * 6, cy - 5, shade(theme.wood, -4), 3.6, 0.95);
      line(ctx, cx - dx * 15, cy - 4, cx + dx * 16, cy - 8, dark, 5.6, 1);
      line(ctx, cx - dx * 14, cy - 4, cx + dx * 15, cy - 8, color, 3.4, 0.98);
      line(ctx, cx - dx * 18, cy - 9, cx - dx * 9, cy + 2, edge, 1.1, 0.78);
      line(ctx, cx + dx * 18, cy - 13, cx + dx * 9, cy - 2, edge, 1.1, 0.78);
      line(ctx, cx - dx * 14, cy - 6, cx + dx * 15, cy - 7, '#121014', 0.75, 0.62);
      line(ctx, cx - dx * 3, cy - 6, cx + dx * 20, cy - 15, '#d8dde0', 1.05, 0.88);
      line(ctx, cx + dx * 8, cy - 11, cx + dx * 14, cy - 14, accent, 0.85, 0.72);
      ellipse(ctx, cx + dx * 3, cy - 4, 3.8, 2.2, 0, shade(color, 26), dark, 0.8);
      drawClassCrest(ctx, cx - dx * 5, cy - 1, '✦', '#2c0f18', dark, 0.7);
    } else if (kind === 'throwingKnife') {
      for (let i = 0; i < 3; i++) {
        const spread = (i - 1) * 4;
        drawBladePoly(ctx, hand, dx, -1, 4 + spread * 0.2, 15 + i * 2, -14 + spread, 1.7, { ...theme, base: i === 1 ? edge : color, dark, edge }, { stroke: 0.65, edgeWidth: 0.55, edgeAlpha: 0.55 });
        line(ctx, hand.x - dx * 2, hand.y + 4 + spread * 0.2, hand.x + dx * 3, hand.y - 1 + spread * 0.2, wrap, 1.1, 0.74);
      }
    } else if (kind === 'dagger') {
      drawBladePoly(ctx, hand, dx, 2, 2, 20, -20, 3.2, theme, { fuller: false, edgeWidth: 1.0 });
      line(ctx, hand.x - dx * 2, hand.y + 4, hand.x + dx * 3, hand.y - 1, grip, 3.0, 0.95);
      line(ctx, hand.x - dx * 5, hand.y - 1, hand.x + dx * 6, hand.y + 1, accent, 1.4, 0.74);
      drawGem(ctx, hand.x + dx * 4, hand.y - 2, 1.45, cls === 'rogue' ? '#66db89' : accent, dark, 0.7);
    } else if (kind === 'sword') {
      drawBladePoly(ctx, hand, dx, 1, 6, 21, -31, 4.0, theme, { fuller: true, edgeWidth: 1.1 });
      line(ctx, hand.x - dx * 7, hand.y, hand.x + dx * 9, hand.y - 4, accent, 1.9, 0.76);
      line(ctx, hand.x - dx * 2, hand.y + 10, hand.x + dx * 4, hand.y - 2, grip, 3.4, 1);
      drawGripWrap(ctx, pxy(hand, dx, -1, 8), pxy(hand, dx, 4, -1), wrap, 3, 0.72);
    } else if (kind === 'greatsword') {
      drawBladePoly(ctx, hand, dx, -2, 14, 22, -48, 5.7, theme, { fuller: true, stroke: 1.5, edgeWidth: 1.45, edgeAlpha: 0.83 });
      line(ctx, hand.x - dx * 12, hand.y + 2, hand.x + dx * 11, hand.y - 4, accent, 2.3, 0.78);
      line(ctx, hand.x - dx * 4, hand.y + 17, hand.x + dx * 5, hand.y - 3, grip, 4.4, 1);
      drawGripWrap(ctx, pxy(hand, dx, -3, 15), pxy(hand, dx, 5, -3), wrap, 5, 0.72);
      line(ctx, hand.x + dx * 8, hand.y - 25, hand.x + dx * 18, hand.y - 43, '#ffffff', 0.75, 0.32);
    } else if (kind === 'axe') {
      line(ctx, hand.x - dx * 3, hand.y + 13, hand.x + dx * 11, hand.y - 29, grip, 4.2, 1);
      drawGripWrap(ctx, pxy(hand, dx, 0, 7), pxy(hand, dx, 7, -15), wrap, 4, 0.62);
      poly(ctx, [pxy(hand, dx, 7, -27), pxy(hand, dx, 22, -35), pxy(hand, dx, 20, -14), pxy(hand, dx, 8, -13)], color, dark, 1.4);
      poly(ctx, [pxy(hand, dx, 8, -25), pxy(hand, dx, 18, -31), pxy(hand, dx, 16, -18), pxy(hand, dx, 9, -15)], edge, dark, 0);
      line(ctx, hand.x + dx * 12, hand.y - 28, hand.x + dx * 18, hand.y - 17, shade(color, -25), 0.7, 0.54);
    } else if (kind === 'mace' || kind === 'maul') {
      const heavy = kind === 'maul';
      line(ctx, hand.x - dx * 2, hand.y + (heavy ? 14 : 10), hand.x + dx * (heavy ? 15 : 13), hand.y - (heavy ? 30 : 24), grip, heavy ? 5.2 : 4.2, 1);
      drawGripWrap(ctx, pxy(hand, dx, -1, heavy ? 12 : 8), pxy(hand, dx, heavy ? 9 : 8, -13), wrap, heavy ? 5 : 4, 0.66);
      const hx = hand.x + dx * (heavy ? 17 : 15), hy = hand.y - (heavy ? 32 : 27);
      ellipse(ctx, hx, hy, heavy ? 9.4 : 7.4, heavy ? 8.8 : 7.2, 0, color, dark, 1.35);
      ellipse(ctx, hx - dx * 1.8, hy - 1.8, heavy ? 5.6 : 4.3, heavy ? 4.9 : 4.0, 0, shade(color, 25), null, 0);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        line(ctx, hx + Math.cos(a) * (heavy ? 5.5 : 4.2), hy + Math.sin(a) * (heavy ? 5 : 4), hx + Math.cos(a) * (heavy ? 9.4 : 7.2), hy + Math.sin(a) * (heavy ? 8.8 : 6.8), edge, 0.85, 0.58);
      }
      if (/warden/i.test(cls)) {
        line(ctx, hx - dx * 7, hy + 7, hx + dx * 4, hy + 13, '#79a85e', 1.1, 0.64);
        ellipse(ctx, hx + dx * 5, hy + 13, 2.5, 3.5, dx * 0.35, '#8fd875', dark, 0.45);
      }
    } else {
      drawBladePoly(ctx, hand, dx, -1, 10, 19, -36, 4.2, theme, { fuller: true, edgeWidth: 1.0 });
      line(ctx, hand.x - dx * 8, hand.y + 1, hand.x + dx * 8, hand.y - 3, accent, 1.7, 0.7);
      line(ctx, hand.x - dx * 2, hand.y + 9, hand.x + dx * 5, hand.y - 3, grip, 3.2, 1);
    }
  }


  function drawOffhand(ctx, rig) {
    const actor = rig?.actor || {};
    if (classLocksWeaponArt(actor)) return;
    const item = slotItem(actor, 'offhand');
    if (!item||activityHidesWeapons(rig)||['fishing','gathering'].includes(String(rig?.pose?.action||''))) return;
    const hand = rig.anchors?.offHand;
    if (!hand) return;
    const text = itemText(item);
    const color = rarityColor(item, '#5d4433');
    const profile=equipmentProfile(actor),side = -(rig.dir?.nearSide || 1),offScale=/shield|buckler|barkguard/.test(text)?profile.shieldScale:profile.weaponScale;
    ctx.save();
    ctx.translate(hand.x+profile.gripX*side,hand.y+profile.gripY);ctx.scale(offScale,offScale);ctx.translate(-hand.x,-hand.y);
    if (/shield|buckler|barkguard/.test(text)) {
      drawShieldShape(ctx, hand, side, item, actor);
    } else {
      drawWeaponShape(ctx, weaponKind(item, actor), hand, null, side, item, actor);
    }
    ctx.restore();
  }

  function drawActivityTool(ctx,rig){
    const actor=rig?.actor||{},race=String(actor.raceId||'human').toLowerCase();
    if(!['ratkin','bogling'].includes(race))return false;
    const action=String(rig?.pose?.action||''),kind=String(rig?.pose?.gatheringKind||actor.gatheringKind||'').toLowerCase();
    const hand=rig.anchors?.mainHand,off=rig.anchors?.offHand;if(!hand)return false;
    const profile=equipmentProfile(actor),side=rig.dir?.nearSide||1,t=Number(rig.pose?.t||0);
    ctx.save();ctx.translate(hand.x+profile.gripX*side,hand.y+profile.gripY);ctx.scale(profile.weaponScale,profile.weaponScale);ctx.translate(-hand.x,-hand.y);
    if(action==='fishing'){
      const reel=String(actor.fishingAction||'')==='reeling'?Math.sin(t*15)*2:0;
      line(ctx,hand.x-side*3,hand.y+9,hand.x+side*45,hand.y-48+reel,'#2d2115',4,1);line(ctx,hand.x-side*2,hand.y+8,hand.x+side*45,hand.y-48+reel,'#8b6737',2.2,1);ellipse(ctx,hand.x+side*45,hand.y-49+reel,2.4,2.4,0,'#d3ae5a','#20150e',.7);ctx.restore();return true;
    }
    if(action==='gathering'&&kind==='mining'){
      const swing=Math.sin((Number(rig.pose?.gatherLoop||0))*Math.PI*2),tip={x:hand.x+side*(16+swing*9),y:hand.y-28+swing*12};line(ctx,hand.x-side*5,hand.y+14,tip.x,tip.y,'#4a3020',4,1);line(ctx,tip.x-side*14,tip.y-5,tip.x+side*13,tip.y+4,'#adb3ae',5,1);line(ctx,tip.x-side*12,tip.y-6,tip.x+side*12,tip.y+3,'#e1ddd0',1.3,.7);ctx.restore();return true;
    }
    if(action==='gathering'){
      line(ctx,hand.x,hand.y+5,hand.x+side*12,hand.y-10,'#6f4a28',2.5,1);ctx.strokeStyle='#bfc8b7';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(hand.x+side*14,hand.y-12,7,-1.1,1.7);ctx.stroke();ctx.restore();return true;
    }
    ctx.restore();return false;
  }

  function drawWeapon(ctx, rig) {
    const actor = rig?.actor || {};
    if (classLocksWeaponArt(actor)) return;
    if(drawActivityTool(ctx,rig))return;
    const item = slotItem(actor, 'weapon');
    const hand = rig.anchors?.mainHand;
    if (!item || !hand||activityHidesWeapons(rig)||['fishing','gathering'].includes(String(rig?.pose?.action||''))) return;
    const profile=equipmentProfile(actor),side=rig.dir?.nearSide||1;
    ctx.save();
    ctx.translate(hand.x+profile.gripX*side,hand.y+profile.gripY);ctx.scale(profile.weaponScale,profile.weaponScale);ctx.translate(-hand.x,-hand.y);
    drawWeaponShape(ctx, weaponKind(item, actor), hand, rig.anchors?.offHand, side, item, actor);
    ctx.restore();
  }

  function drawEquipSpark(ctx, rig) {
    const actor = rig?.actor || {};
    const source = actor.sourceEntity || actor;
    const at = Number(source?.gearVisualChangedAt || actor?.gearVisualChangedAt || 0);
    if (!at || typeof performance === 'undefined' || !performance.now) return;
    const age = (performance.now() - at) / 600;
    if (age < 0 || age > 1) return;
    const a = 1 - age;
    const c = '#ffd36a';
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = a * 0.55;
    ellipse(ctx, rig.anchors.chest.x, rig.anchors.chest.y + 2, 28 + age * 10, 36 + age * 12, 0, c, c, 0);
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * TAU + age * 2.2;
      line(ctx, Math.cos(ang) * 8, -35 + Math.sin(ang) * 14, Math.cos(ang) * (16 + age * 10), -35 + Math.sin(ang) * (20 + age * 10), c, 1.1, a);
    }
    ctx.restore();
  }

  function drawBodyLayer(ctx, rig, layer, arg) {
    if (!hasAny(rig?.actor)) return;
    if (classOwnsFullBodyArt(rig?.actor)) return;
    if ((layer === 'weapon' || layer === 'offhand') && classLocksWeaponArt(rig?.actor)) return;
    if (layer === 'back') return drawBack(ctx, rig, arg);
    if (layer === 'legs') return drawLegs(ctx, rig);
    if (layer === 'torso') return drawTorso(ctx, rig);
    if (layer === 'arm') return drawArmGear(ctx, rig, arg);
    if (layer === 'head') { drawHeadGear(ctx, rig); return drawJewelry(ctx, rig); }
    // 'weapon'/'offhand' are invoked from two call sites in Base.draw() - a
    // pre-torso "back" pass and the original post-head "front" pass. Only
    // the pass matching this facing's weaponDepthLayer() actually draws, so
    // a back-facing actor's weapon is occluded by the torso/cloak drawn in
    // between, while every other facing keeps drawing at the original spot.
    const requestedPass = arg === 'back' ? 'back' : 'front';
    if (layer === 'offhand') {
      if (weaponDepthLayer(rig) !== requestedPass) return;
      return drawOffhand(ctx, rig);
    }
    if (layer === 'weapon') {
      if (weaponDepthLayer(rig) !== requestedPass) return;
      drawWeapon(ctx, rig);
      return drawEquipSpark(ctx, rig);
    }
  }

  DR.render.PaperdollEquipmentRenderer = Object.freeze({
    hasAny,
    drawBodyLayer,
    drawBack,
    capeDepthLayer,
    drawLegs,
    drawTorso,
    drawArmGear,
    drawHeadGear,
    drawWeapon,
    drawOffhand,
    hasEquippedWeapon,
    hasEquippedOffhand,
    classLocksWeaponArt,
    classOwnsFullBodyArt,
    slotItem,
    rarityColor,
    weaponKind,
    armorClass,
    canonicalActorClassName,
    classDefaultVisualItem,
    resolveVisualSlotItem
    ,equipmentProfiles:EQUIPMENT_PROFILES,equipmentProfile,drawActivityTool
  });
})();
