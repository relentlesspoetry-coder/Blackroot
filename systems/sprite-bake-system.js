(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.tools = DR.tools || {};

  const DEFAULT_DIRECTIONS = Object.freeze(['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest']);
  const DEFAULT_FRAME_SIZE = Object.freeze({ w: 192, h: 176, anchorX: 96, anchorY: 132 });
  const DEFAULT_STATES = Object.freeze(['idle', 'walk', 'attack', 'hit', 'death']);
  const CLASS_MODELS = Object.freeze(['Paladin', 'Warden', 'Fighter', 'Rogue', 'Ranger', 'Assassin', 'Wizard', 'Shaman', 'Summoner', 'Necromancer', 'Cleric', 'Druid', 'Bard', 'Enchanter']);
  const CLASS_MODEL_SET = new Set(CLASS_MODELS.map(v => v.toLowerCase()));

  const PROP_DEFINITIONS = Object.freeze([
    { modelId: 'Tree_Oak', type: 'prop', category: 'foliage', objectType: 'tree', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 192, h: 224, anchorX: 96, anchorY: 190 }, clickScaleX: 0.70, clickScaleY: 0.82 },
    { modelId: 'Tree_Dead', type: 'prop', category: 'foliage', objectType: 'deadTree', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 192, h: 224, anchorX: 96, anchorY: 192 }, clickScaleX: 0.68, clickScaleY: 0.82 },
    { modelId: 'Tree_Evil', type: 'prop', category: 'foliage', objectType: 'evilTree', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 288, h: 288, anchorX: 144, anchorY: 236 }, clickScaleX: 0.76, clickScaleY: 0.86 },
    { modelId: 'Brush', type: 'prop', category: 'foliage', objectType: 'brush', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 128, h: 104, anchorX: 64, anchorY: 78 }, clickScaleX: 0.74, clickScaleY: 0.62 },
    { modelId: 'Grass_Clump', type: 'prop', category: 'foliage', objectType: 'grassTuft', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 96, h: 80, anchorX: 48, anchorY: 58 }, clickScaleX: 0.70, clickScaleY: 0.52 },
    { modelId: 'Flower_Patch', type: 'prop', category: 'foliage', objectType: 'flower', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 104, h: 88, anchorX: 52, anchorY: 64 }, clickScaleX: 0.70, clickScaleY: 0.55 },
    { modelId: 'Mushroom_Brown', type: 'prop', category: 'foliage', objectType: 'mushroom', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 96, h: 88, anchorX: 48, anchorY: 68 }, clickScaleX: 0.58, clickScaleY: 0.58 },
    { modelId: 'Mushroom_Glow', type: 'prop', category: 'foliage', objectType: 'glowMushroom', variant: 'default', states: ['idle', 'glow'], directions: ['south'], frameCount: 4, frameSize: { w: 120, h: 104, anchorX: 60, anchorY: 78 }, clickScaleX: 0.64, clickScaleY: 0.62 },
    { modelId: 'Ash_Stump', type: 'prop', category: 'foliage', objectType: 'ashStump', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 120, h: 104, anchorX: 60, anchorY: 78 }, clickScaleX: 0.64, clickScaleY: 0.58 },
    { modelId: 'Root_Arch', type: 'prop', category: 'foliage', objectType: 'rootArch', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 176, h: 144, anchorX: 88, anchorY: 108 }, clickScaleX: 0.72, clickScaleY: 0.70 },
    { modelId: 'Rock', type: 'prop', category: 'nature', objectType: 'rock', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 112, h: 88, anchorX: 56, anchorY: 64 }, clickScaleX: 0.62, clickScaleY: 0.48 },
    { modelId: 'Crystal_Node', type: 'prop', category: 'nature', objectType: 'crystalNode', variant: 'default', states: ['idle', 'glow'], directions: ['south'], frameCount: 4, frameSize: { w: 128, h: 128, anchorX: 64, anchorY: 96 }, clickScaleX: 0.62, clickScaleY: 0.70 },
    { modelId: 'Mining_Vein', type: 'prop', category: 'nature', objectType: 'miningVein', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 144, h: 112, anchorX: 72, anchorY: 84 }, clickScaleX: 0.70, clickScaleY: 0.62 },
    { modelId: 'Tent_Small', type: 'prop', category: 'camp', objectType: 'tent', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 176, h: 144, anchorX: 88, anchorY: 110 }, clickScaleX: 0.78, clickScaleY: 0.70 },
    { modelId: 'Tent_Large_Camp', type: 'prop', category: 'camp', objectType: 'largeCampTent', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 256, h: 192, anchorX: 128, anchorY: 148 }, clickScaleX: 0.82, clickScaleY: 0.74 },
    { modelId: 'Vendor_Stall', type: 'prop', category: 'camp', objectType: 'vendorStall', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 240, h: 184, anchorX: 120, anchorY: 142 }, clickScaleX: 0.80, clickScaleY: 0.72 },
    { modelId: 'Crate', type: 'prop', category: 'camp', objectType: 'crate', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 104, h: 96, anchorX: 52, anchorY: 70 }, clickScaleX: 0.58, clickScaleY: 0.55 },
    { modelId: 'Banner', type: 'prop', category: 'camp', objectType: 'banner', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 96, h: 144, anchorX: 48, anchorY: 108 }, clickScaleX: 0.44, clickScaleY: 0.75 },
    { modelId: 'Lantern_Post', type: 'prop', category: 'camp', objectType: 'lanternPost', variant: 'default', states: ['idle', 'flicker'], directions: ['south'], frameCount: 4, frameSize: { w: 96, h: 160, anchorX: 48, anchorY: 120 }, clickScaleX: 0.42, clickScaleY: 0.78 },
    { modelId: 'Merc_Post', type: 'prop', category: 'camp', objectType: 'mercpost', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 120, h: 128, anchorX: 60, anchorY: 96 }, clickScaleX: 0.60, clickScaleY: 0.68 },
    { modelId: 'Camp_Stall', type: 'prop', category: 'camp', objectType: 'campStall', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 192, h: 160, anchorX: 96, anchorY: 122 }, clickScaleX: 0.74, clickScaleY: 0.70 },
    { modelId: 'Forge', type: 'prop', category: 'camp', objectType: 'forge', variant: 'default', states: ['idle', 'flicker'], directions: ['south'], frameCount: 4, frameSize: { w: 144, h: 128, anchorX: 72, anchorY: 96 }, clickScaleX: 0.68, clickScaleY: 0.64 },
    { modelId: 'Fire', type: 'prop', category: 'camp', objectType: 'fire', variant: 'default', states: ['idle', 'flicker'], directions: ['south'], frameCount: 4, frameSize: { w: 128, h: 120, anchorX: 64, anchorY: 88 }, clickScaleX: 0.58, clickScaleY: 0.58 },
    { modelId: 'Loom', type: 'prop', category: 'camp', objectType: 'loom', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 144, h: 128, anchorX: 72, anchorY: 94 }, clickScaleX: 0.68, clickScaleY: 0.62 },
    { modelId: 'Herbalist_Table', type: 'prop', category: 'camp', objectType: 'herbalistTable', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 144, h: 112, anchorX: 72, anchorY: 82 }, clickScaleX: 0.70, clickScaleY: 0.58 },
    { modelId: 'Cave_Entrance', type: 'prop', category: 'cave', objectType: 'cave', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 224, h: 176, anchorX: 112, anchorY: 132 }, clickScaleX: 0.82, clickScaleY: 0.74 },
    { modelId: 'Cave_Web', type: 'prop', category: 'cave', objectType: 'caveWeb', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 144, h: 112, anchorX: 72, anchorY: 82 }, clickScaleX: 0.72, clickScaleY: 0.64 },
    { modelId: 'Cave_Herb', type: 'prop', category: 'cave', objectType: 'caveHerb', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 104, h: 96, anchorX: 52, anchorY: 72 }, clickScaleX: 0.56, clickScaleY: 0.56 },
    { modelId: 'Cave_Mushrooms', type: 'prop', category: 'cave', objectType: 'caveMushrooms', variant: 'default', states: ['idle', 'glow'], directions: ['south'], frameCount: 4, frameSize: { w: 128, h: 112, anchorX: 64, anchorY: 82 }, clickScaleX: 0.64, clickScaleY: 0.62 },
    { modelId: 'Bones', type: 'prop', category: 'cave', objectType: 'bones', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 128, h: 96, anchorX: 64, anchorY: 70 }, clickScaleX: 0.68, clickScaleY: 0.52 },
    { modelId: 'Mine_Support', type: 'prop', category: 'cave', objectType: 'mineSupport', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 160, h: 144, anchorX: 80, anchorY: 108 }, clickScaleX: 0.72, clickScaleY: 0.70 },
    { modelId: 'Broken_Cart', type: 'prop', category: 'cave', objectType: 'brokenCart', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 160, h: 120, anchorX: 80, anchorY: 88 }, clickScaleX: 0.74, clickScaleY: 0.58 },
    { modelId: 'Torch', type: 'prop', category: 'cave', objectType: 'torch', variant: 'default', states: ['idle', 'flicker'], directions: ['south'], frameCount: 4, frameSize: { w: 96, h: 144, anchorX: 48, anchorY: 108 }, clickScaleX: 0.42, clickScaleY: 0.75 },
    { modelId: 'Dungeon_Gate', type: 'prop', category: 'dungeon', objectType: 'dungeonGate', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 224, h: 176, anchorX: 112, anchorY: 132 }, clickScaleX: 0.82, clickScaleY: 0.74 },
    { modelId: 'Dungeon_Treasure', type: 'prop', category: 'dungeon', objectType: 'dungeonTreasure', variant: 'default', states: ['idle', 'glow'], directions: ['south'], frameCount: 4, frameSize: { w: 128, h: 112, anchorX: 64, anchorY: 82 }, clickScaleX: 0.64, clickScaleY: 0.58 },
    { modelId: 'Web_Anchor', type: 'prop', category: 'dungeon', objectType: 'webAnchor', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 144, h: 112, anchorX: 72, anchorY: 84 }, clickScaleX: 0.70, clickScaleY: 0.58 },
    { modelId: 'Silk_Cocoon', type: 'prop', category: 'dungeon', objectType: 'silkCocoon', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 144, h: 160, anchorX: 72, anchorY: 120 }, clickScaleX: 0.60, clickScaleY: 0.78 },
    { modelId: 'Egg_Cluster', type: 'prop', category: 'dungeon', objectType: 'eggCluster', variant: 'default', states: ['idle', 'pulse'], directions: ['south'], frameCount: 4, frameSize: { w: 128, h: 112, anchorX: 64, anchorY: 82 }, clickScaleX: 0.62, clickScaleY: 0.56 },
    { modelId: 'Chitin_Column', type: 'prop', category: 'dungeon', objectType: 'chitinColumn', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 1, frameSize: { w: 144, h: 176, anchorX: 72, anchorY: 132 }, clickScaleX: 0.54, clickScaleY: 0.78 },
    { modelId: 'Venom_Pool', type: 'prop', category: 'dungeon', objectType: 'venomPool', variant: 'default', states: ['idle', 'pulse'], directions: ['south'], frameCount: 4, frameSize: { w: 144, h: 104, anchorX: 72, anchorY: 74 }, clickScaleX: 0.74, clickScaleY: 0.48 },
    { modelId: 'Venom_Sack', type: 'prop', category: 'dungeon', objectType: 'venomSack', variant: 'default', states: ['idle', 'pulse'], directions: ['south'], frameCount: 4, frameSize: { w: 112, h: 112, anchorX: 56, anchorY: 82 }, clickScaleX: 0.58, clickScaleY: 0.62 }
  ]);
  const PROP_MODEL_SET = new Set(PROP_DEFINITIONS.map(def => normalizeToken(def.modelId, '').toLowerCase()));
  const PROP_MODEL_BY_ID = new Map(PROP_DEFINITIONS.map(def => [normalizeToken(def.modelId, '').toLowerCase(), def]));
  const PROP_MODEL_BY_OBJECT_TYPE = new Map();
  for (const def of PROP_DEFINITIONS) {
    const rawType = String(def.objectType || '').toLowerCase();
    const compactType = rawType.replace(/[^a-z0-9]+/g, '');
    PROP_MODEL_BY_OBJECT_TYPE.set(rawType, def.modelId);
    PROP_MODEL_BY_OBJECT_TYPE.set(compactType, def.modelId);
  }

  function normalizeToken(value, fallback = 'default') {
    const helper = DR.SpriteSheetSystem?.normalizeToken || DR.SpriteAtlasSystem?.normalizeToken;
    return helper ? helper(value, fallback) : (String(value || fallback).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || fallback);
  }

  function stableBakeSeed(parts) {
    const text = Array.isArray(parts) ? parts.join('|') : String(parts || 'bake');
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % 1000000;
  }

  function makeFrameKey(modelId, variant, state, direction, frameIndex) {
    return [modelId, variant, state, direction, frameIndex].map((part, index) => index === 4 ? String(part || 0) : normalizeToken(part, 'default')).join('.');
  }

  function makeLocalFrameKey(variant, state, direction, frameIndex) {
    return [variant, state, direction, frameIndex].map((part, index) => index === 3 ? String(part || 0) : normalizeToken(part, 'default')).join('.');
  }


  function propModelIdForObjectType(objectType, fallback = '') {
    const key = String(objectType || '').trim().toLowerCase();
    const compact = key.replace(/[^a-z0-9]+/g, '');
    return PROP_MODEL_BY_OBJECT_TYPE.get(key) || PROP_MODEL_BY_OBJECT_TYPE.get(compact) || fallback || normalizeToken(objectType, 'UnknownProp');
  }

  function createPropBakeObject(def) {
    return Object.assign({
      type: def.objectType || def.modelId,
      name: def.name || def.modelId,
      variant: def.variant || 'default',
      spriteModelId: def.modelId,
      bakeMode: true,
      scale: def.scale || 1
    }, def.object || {});
  }

  function createObjectBakeGame(ctx, anchorX, anchorY) {
    if (!DR.RenderUtils?.install || !DR.ObjectRenderer?.install) throw new Error('Object renderer utilities are not loaded; cannot bake prop/object sheet.');
    const previousRuntime = DR.runtime || {};
    DR.runtime = Object.assign({}, previousRuntime, { ctx });
    class BakeObjectGame {}
    DR.RenderUtils.install(BakeObjectGame);
    DR.ObjectRenderer.install(BakeObjectGame);
    const game = new BakeObjectGame();
    game.worldToScreen = () => ({ x: anchorX, y: anchorY });
    game.renderNowMs = 1000;
    game._isSpriteBakeObjectGame = true;
    return { game, previousRuntime };
  }

  function drawPropBakeFrame(ctx, actor, nowMs = 1000) {
    const obj = actor.object || createPropBakeObject(actor.definition || {});
    const { game, previousRuntime } = createObjectBakeGame(ctx, actor.screenX, actor.screenY);
    try {
      game.renderNowMs = nowMs;
      game.drawObject(0, 0, obj, 0);
    } finally {
      DR.runtime = previousRuntime;
    }
    return true;
  }

  const PROP_BAKE_RENDERER = Object.freeze({
    draw: drawPropBakeFrame,
    canDraw: actor => !!actor?.object?.type,
    supportedActions: () => ['idle', 'sway', 'flicker', 'pulse', 'glow', 'active', 'inactive', 'open', 'closed'],
    supportedDirections: () => ['south']
  });

  function modelType(modelId) {
    const key = normalizeToken(modelId, '').toLowerCase();
    if (CLASS_MODEL_SET.has(key)) return 'class';
    if (PROP_MODEL_SET.has(key)) return 'prop';
    return 'mob';
  }

  function modelFolder(modelId) {
    const type = modelType(modelId);
    if (type === 'class') return 'classes';
    if (type === 'prop') return 'props';
    return 'mobs';
  }

  function rendererByModel(modelId) {
    const render = DR.render || {};
    const key = String(modelId || '').toLowerCase();
    if (key === 'briarboar') return render.BoarProceduralModel || window.BoarProceduralModel;
    if (key === 'gloomwolf') return render.WolfProceduralModel || window.WolfProceduralModel;
    if (key === 'rotling') return render.RotlingProceduralModel || window.RotlingProceduralModel;
    if (key === 'spider') return render.SilkWebSpiderProceduralModel || window.SilkWebSpiderProceduralModel;
    if (key === 'spirithealer') return render.SpiritHealerProceduralModel || window.SpiritHealerProceduralModel;
    if (key === 'skeleton' || key === 'bandit' || key === 'wisp' || key === 'hollowstag' || key === 'ashroothorror') return render.DarkWoodsMobProceduralModel || window.DarkWoodsMobProceduralModel;

    // Class sheets must use the same renderer family as runtime. Bard and Druid
    // are not handled by ClassIdentityProceduralModel; routing them there bakes
    // transparent frames. Keep the per-class source renderers as source of truth.
    if (key === 'bard') return render.BardProceduralModel || window.BardProceduralModel;
    if (key === 'druid') return render.DruidProceduralModel || window.DruidProceduralModel;
    if (CLASS_MODEL_SET.has(key)) return render.ClassIdentityProceduralModel || window.ClassIdentityProceduralModel;
    if (PROP_MODEL_SET.has(key)) return PROP_BAKE_RENDERER;
    return null;
  }

  function rendererCanDrawDefinition(renderer, def) {
    if (!renderer?.draw) return false;
    if (typeof renderer.canDraw !== 'function') return true;
    try {
      return renderer.canDraw(createBakeActor(def, 'idle', 'south', 0, 1, Object.assign({}, DEFAULT_FRAME_SIZE, def.frameSize || {}))) !== false;
    } catch (err) {
      return false;
    }
  }

  function countOpaquePixels(canvas) {
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 4 && ++count >= 16) return count;
    }
    return count;
  }

  function supportedActions(renderer, fallback = DEFAULT_STATES) {
    if (typeof renderer?.supportedActions === 'function') return renderer.supportedActions().filter(Boolean);
    return fallback.slice();
  }

  function supportedDirections(renderer) {
    if (typeof renderer?.supportedDirections === 'function') return renderer.supportedDirections().filter(Boolean);
    return DEFAULT_DIRECTIONS.slice();
  }

  function createBakeActor(def, state, direction, frameIndex, frameCount, geom) {
    const isClass = CLASS_MODELS.includes(def.modelId);
    const isProp = def.type === 'prop' || modelType(def.modelId) === 'prop';
    const alive = state !== 'death';
    const progress = frameCount <= 1 ? 1 : frameIndex / Math.max(1, frameCount - 1);
    const bakeKey = `${def.modelId}.${def.variant || 'default'}.${state}.${direction}.${frameIndex}`;
    if (isProp) {
      return {
        id: stableBakeSeed(bakeKey),
        bakeKey,
        bakeSourceId: bakeKey,
        kind: 'object',
        type: 'prop',
        modelId: def.modelId,
        definition: def,
        objectType: def.objectType,
        category: def.category || 'prop',
        variant: def.variant || 'default',
        visualVariant: def.variant || 'default',
        action: state,
        state,
        direction,
        facingName: direction,
        screenX: geom.anchorX,
        screenY: geom.anchorY,
        object: createPropBakeObject(def),
        bakeMode: true,
        disableNameplate: true,
        disableHealthBar: true,
        disableChatBubble: true,
        disableSelectionRing: true,
        disableDamageNumbers: true,
        includeShadow: true
      };
    }
    const actor = {
      id: stableBakeSeed(bakeKey),
      bakeKey,
      bakeSourceId: bakeKey,
      name: def.name || def.modelId,
      kind: isClass ? (def.variant === 'trainer' ? 'npc' : 'player') : 'enemy',
      className: isClass ? def.modelId : undefined,
      playerClass: isClass ? def.modelId : undefined,
      classId: isClass ? def.modelId : undefined,
      type: isClass ? def.modelId : undefined,
      role: isClass ? def.modelId : undefined,
      rendererId: def.rendererId,
      family: def.family,
      mobType: def.name || def.modelId,
      mobVisualKey: def.mobVisualKey || def.variant,
      visualKey: def.visualKey || def.mobVisualKey || def.variant,
      boarPalette: def.boarPalette,
      wolfPalette: def.wolfPalette,
      rotlingPalette: def.rotlingPalette,
      spiderRole: def.spiderRole,
      variant: def.variant,
      visualVariant: def.variant,
      trainerVisualVariant: isClass && def.variant === 'trainer' ? `${def.modelId.toLowerCase()}_mentor` : undefined,
      paletteKey: def.paletteKey || def.variant,
      screenX: geom.anchorX,
      screenY: geom.anchorY,
      facingName: direction,
      facingX: direction.includes('east') ? 1 : direction.includes('west') ? -1 : 0,
      facingY: direction.includes('south') ? 1 : direction.includes('north') ? -1 : 0,
      direction: direction,
      facingDirection: direction,
      action: state,
      alive,
      dead: !alive,
      isMoving: state === 'walk',
      meditating: state === 'meditate',
      fishing: state === 'fishing',
      swimming: state === 'swim',
      inWater: state === 'swim',
      swimAnim: progress * 1.0,
      swimMovement: state === 'swim' ? 0.82 : 0,
      swimBlend: state === 'swim' ? 1 : 0,
      swimSubmerge: state === 'swim' ? 0.52 : 0,
      chargeActive: state === 'charge',
      charging: state === 'charge',
      attackAnim: state === 'attack' || state === 'charge' || state === 'specialAttack' || state === 'rangedAttack' ? 1 - progress : 0,
      spellCastAnim: state === 'cast' || state === 'corruptionCast' || state === 'sporeBurst' ? 1 - progress : 0,
      hitAnim: state === 'hit' ? 1 - progress : 0,
      deathProgress: state === 'death' ? progress : 0,
      visualScale: 1,
      bakeMode: true,
      disableNameplate: true,
      disableHealthBar: true,
      disableChatBubble: true,
      disableSelectionRing: true,
      disableDamageNumbers: true,
      includeShadow: true
    };
    if (isClass && def.variant === 'trainer') {
      actor.visualRole = 'class_trainer';
      actor.rendererId = 'classTrainer';
    }
    if (def.modelId === 'SpiritHealer') {
      actor.kind = 'npc';
      actor.visualRole = 'spiritHealer';
      actor.rendererId = 'spiritHealer';
      actor.name = 'Spirit Healer';
      actor.action = 'idle';
    }
    if (def.modelId === 'Spider') {
      actor.rendererId = 'silk_web_spider';
      actor.family = 'silk_web_spider';
      actor.spiderFamily = true;
      actor.spiderRole = def.spiderRole || def.variant;
    }
    if (def.modelId === 'Skeleton') {
      actor.rendererId = 'skeleton';
      actor.family = 'skeleton';
      actor.mobVisualKey = def.mobVisualKey || 'boneWatcher';
      actor.visualKey = actor.mobVisualKey;
    }
    if (def.modelId === 'Bandit') {
      actor.rendererId = 'bandit';
      actor.family = 'bandit';
      actor.mobVisualKey = def.mobVisualKey || 'bandit';
      actor.visualKey = actor.mobVisualKey;
    }
    if (def.modelId === 'Wisp') {
      actor.rendererId = 'wisp';
      actor.family = 'wisp';
      actor.mobVisualKey = def.mobVisualKey || def.variant || 'duskwisp';
      actor.visualKey = actor.mobVisualKey;
    }
    if (def.modelId === 'HollowStag') {
      actor.rendererId = 'stag';
      actor.family = 'stag';
      actor.mobVisualKey = def.mobVisualKey || def.variant || 'hollowStag';
      actor.visualKey = actor.mobVisualKey;
    }
    if (def.modelId === 'AshRootHorror') {
      actor.rendererId = 'deadroot';
      actor.family = 'deadroot';
      actor.mobVisualKey = def.mobVisualKey || def.variant || 'ashrootHorror';
      actor.visualKey = actor.mobVisualKey;
    }
    return actor;
  }

  function defaultDefinitions() {
    const classDefs = [];
    for (const modelId of CLASS_MODELS) {
      classDefs.push({ modelId, variant: 'player', frameSize: { w: 176, h: 192, anchorX: 88, anchorY: 150 }, states: ['idle', 'walk', 'swim', 'attack', 'hit', 'death', 'cast', 'meditate'] });
      classDefs.push({ modelId, variant: 'trainer', rendererId: 'classTrainer', frameSize: { w: 176, h: 192, anchorX: 88, anchorY: 150 }, states: ['idle', 'cast'] });
    }
    return [
      ...classDefs,
      { modelId: 'GloomWolf', rendererId: 'wolf', family: 'wolf', variant: 'gloomWolf', mobVisualKey: 'gloomWolf', wolfPalette: 'gloom', states: ['idle', 'walk', 'attack', 'hit', 'death', 'specialAttack'], frameSize: { w: 192, h: 144, anchorX: 96, anchorY: 108 } },
      { modelId: 'GloomWolf', rendererId: 'wolf', family: 'wolf', variant: 'mossfangAlpha', mobVisualKey: 'mossfangAlpha', wolfPalette: 'mossfang', states: ['idle', 'walk', 'attack', 'hit', 'death', 'specialAttack'], frameSize: { w: 216, h: 160, anchorX: 108, anchorY: 118 } },
      { modelId: 'BriarBoar', rendererId: 'boar', family: 'boar', variant: 'briarBoar', mobVisualKey: 'briarBoar', boarPalette: 'mudTusker', states: ['idle', 'walk', 'charge', 'attack', 'hit', 'death', 'specialAttack'], frameSize: { w: 208, h: 152, anchorX: 104, anchorY: 114 } },
      { modelId: 'BriarBoar', rendererId: 'boar', family: 'boar', variant: 'oldTuskBriarback', mobVisualKey: 'oldTuskBriarback', boarPalette: 'oldTusk', states: ['idle', 'walk', 'charge', 'attack', 'hit', 'death', 'specialAttack'], frameSize: { w: 224, h: 160, anchorX: 112, anchorY: 120 } },
      { modelId: 'HollowStag', rendererId: 'stag', family: 'stag', variant: 'hollowStag', mobVisualKey: 'hollowStag', states: ['idle', 'walk', 'attack', 'hit', 'death', 'specialAttack'], frameSize: { w: 224, h: 216, anchorX: 112, anchorY: 170 }, clickScaleX: 0.58, clickScaleY: 0.72 },
      { modelId: 'HollowStag', rendererId: 'stag', family: 'stag', variant: 'thornCrownedStag', mobVisualKey: 'thornCrownedStag', states: ['idle', 'walk', 'attack', 'hit', 'death', 'specialAttack'], frameSize: { w: 256, h: 240, anchorX: 128, anchorY: 188 }, clickScaleX: 0.60, clickScaleY: 0.74 },
      { modelId: 'AshRootHorror', rendererId: 'deadroot', family: 'deadroot', variant: 'ashrootHorror', mobVisualKey: 'ashrootHorror', states: ['idle', 'walk', 'attack', 'hit', 'death', 'specialAttack', 'corruptionCast'], frameSize: { w: 224, h: 224, anchorX: 112, anchorY: 176 }, clickScaleX: 0.58, clickScaleY: 0.76 },
      { modelId: 'AshRootHorror', rendererId: 'deadroot', family: 'deadroot', variant: 'ashrootElder', mobVisualKey: 'ashrootElder', states: ['idle', 'walk', 'attack', 'hit', 'death', 'specialAttack', 'corruptionCast'], frameSize: { w: 256, h: 256, anchorX: 128, anchorY: 198 }, clickScaleX: 0.60, clickScaleY: 0.78 },
      { modelId: 'Rotling', rendererId: 'rotling', family: 'rotling', variant: 'rotling', mobVisualKey: 'rotling', rotlingPalette: 'rotling', states: ['idle', 'walk', 'attack', 'hit', 'death', 'corruptionCast'], frameSize: { w: 176, h: 160, anchorX: 88, anchorY: 124 } },
      { modelId: 'Spider', rendererId: 'silk_web_spider', family: 'spider', variant: 'lurker', spiderRole: 'lurker', states: ['idle', 'walk', 'attack', 'hit', 'death'], frameSize: { w: 208, h: 144, anchorX: 104, anchorY: 108 } },
      { modelId: 'Spider', rendererId: 'silk_web_spider', family: 'spider', variant: 'thornWidow', spiderRole: 'venom', states: ['idle', 'walk', 'attack', 'hit', 'death'], frameSize: { w: 208, h: 144, anchorX: 104, anchorY: 108 } },
      { modelId: 'Skeleton', rendererId: 'skeleton', family: 'skeleton', variant: 'boneWatcher', mobVisualKey: 'boneWatcher', states: ['idle', 'walk', 'attack', 'hit', 'death'], frameSize: { w: 176, h: 176, anchorX: 88, anchorY: 132 } },
      { modelId: 'Bandit', rendererId: 'bandit', family: 'bandit', variant: 'bandit', mobVisualKey: 'bandit', states: ['idle', 'walk', 'attack', 'hit', 'death'], frameSize: { w: 176, h: 176, anchorX: 88, anchorY: 132 } },
      { modelId: 'Wisp', rendererId: 'wisp', family: 'wisp', variant: 'duskwisp', mobVisualKey: 'duskwisp', states: ['idle', 'walk', 'attack', 'hit', 'death', 'cast', 'rangedAttack'], frameSize: { w: 176, h: 176, anchorX: 88, anchorY: 132 }, clickScaleX: 0.52, clickScaleY: 0.66 },
      { modelId: 'Wisp', rendererId: 'wisp', family: 'wisp', variant: 'dustWisp', mobVisualKey: 'dustWisp', states: ['idle', 'walk', 'attack', 'hit', 'death', 'cast', 'rangedAttack'], frameSize: { w: 176, h: 176, anchorX: 88, anchorY: 132 }, clickScaleX: 0.52, clickScaleY: 0.66 },
      { modelId: 'Wisp', rendererId: 'wisp', family: 'wisp', variant: 'graveWisp', mobVisualKey: 'graveWisp', states: ['idle', 'walk', 'attack', 'hit', 'death', 'cast', 'rangedAttack'], frameSize: { w: 176, h: 176, anchorX: 88, anchorY: 132 }, clickScaleX: 0.52, clickScaleY: 0.66 },
      { modelId: 'Wisp', rendererId: 'wisp', family: 'wisp', variant: 'lumenWisp', mobVisualKey: 'lumenWisp', states: ['idle', 'walk', 'attack', 'hit', 'death', 'cast', 'rangedAttack'], frameSize: { w: 192, h: 192, anchorX: 96, anchorY: 144 }, clickScaleX: 0.54, clickScaleY: 0.68 },
      { modelId: 'SpiritHealer', rendererId: 'spiritHealer', variant: 'default', states: ['idle'], directions: ['south'], frameCount: 4, frameSize: { w: 224, h: 224, anchorX: 112, anchorY: 168 } },
      ...PROP_DEFINITIONS
    ];
  }

  class SpriteBakeSystem {
    constructor(options = {}) {
      this.padding = Number(options.padding || 4);
      this.maxAtlasSize = Number(options.maxAtlasSize || 2048);
      this.frameCountByState = Object.assign({ idle: 4, walk: 6, attack: 4, charge: 4, specialAttack: 4, rangedAttack: 4, cast: 4, meditate: 4, fishing: 4, swim: 6, hit: 2, death: 3, corruptionCast: 4, sporeBurst: 4 }, options.frameCountByState || {});
      this.definitions = options.definitions || defaultDefinitions();
      this.log = [];
    }

    getBakeDefinitions() { return this.definitions.slice(); }

    frameCountFor(def, state) {
      return Math.max(1, Number(def.frameCount || def.frameCounts?.[state] || this.frameCountByState[state] || 1));
    }

    bakeFrame(def, state, direction, frameIndex, frameCount) {
      const renderer = rendererByModel(def.modelId);
      if (!renderer?.draw) throw new Error(`No renderer available for ${def.modelId}`);
      const geom = Object.assign({}, DEFAULT_FRAME_SIZE, def.frameSize || {});
      const canvas = document.createElement('canvas');
      canvas.width = geom.w;
      canvas.height = geom.h;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      const actor = createBakeActor(def, state, direction, frameIndex, frameCount, geom);
      const ok = renderer.draw(ctx, actor, 1000 + frameIndex * 120);
      if (ok === false) throw new Error(`Renderer returned false for ${def.modelId}.${def.variant}.${state}.${direction}.${frameIndex}`);

      const opaquePixels = countOpaquePixels(canvas);
      if (opaquePixels <= 0) {
        throw new Error(`Renderer produced a transparent frame for ${def.modelId}.${def.variant}.${state}.${direction}.${frameIndex}; refusing to export a blank class/model sheet.`);
      }

      const frame = this.extractMetadata(def, state, direction, frameIndex, geom, actor);
      frame.opaquePixels = opaquePixels;
      return { canvas, frame, actor, key: frame.key, localKey: frame.localKey };
    }

    extractMetadata(def, state, direction, frameIndex, geom, actor) {
      const anchorX = geom.anchorX;
      const anchorY = geom.anchorY;
      const nameplate = actor._nameplateAnchor
        ? { x: anchorX + (actor._nameplateAnchor.x - actor.screenX), y: anchorY + (actor._nameplateAnchor.y - actor.screenY) }
        : { x: anchorX, y: Math.max(14, anchorY - 94) };
      const clickW = Math.round(geom.w * (def.clickScaleX || 0.62));
      const clickH = Math.round(geom.h * (def.clickScaleY || 0.52));
      const variant = def.variant || 'normal';
      const key = makeFrameKey(def.modelId, variant, state, direction, frameIndex);
      const localKey = makeLocalFrameKey(variant, state, direction, frameIndex);
      return {
        key,
        localKey,
        x: 0, y: 0, w: geom.w, h: geom.h,
        anchorX, anchorY,
        footAnchorX: anchorX,
        footAnchorY: anchorY,
        nameplateAnchorX: Math.round(nameplate.x),
        nameplateAnchorY: Math.round(nameplate.y),
        shadowAnchorX: anchorX,
        shadowAnchorY: anchorY + 4,
        clickBounds: { x: Math.round(anchorX - clickW / 2), y: Math.round(anchorY - clickH), w: clickW, h: clickH },
        modelId: def.modelId,
        variant,
        state,
        direction,
        frameIndex
      };
    }

    bakeFrames(definitions = this.definitions) {
      this.log.length = 0;
      const frames = [];
      for (const def of definitions) this.bakeDefinitionInto(def, frames);
      frames.sort((a, b) => a.key.localeCompare(b.key));
      return frames;
    }

    bakeDefinitionInto(def, frames) {
      const renderer = rendererByModel(def.modelId);
      if (!renderer?.draw) {
        this.log.push(`Skipped ${def.modelId}.${def.variant || 'normal'}: renderer unavailable`);
        return;
      }
      if (!rendererCanDrawDefinition(renderer, def)) {
        this.log.push(`Skipped ${def.modelId}.${def.variant || 'normal'}: renderer cannot draw this class/model definition`);
        return;
      }
      const states = (def.states || supportedActions(renderer)).filter(Boolean);
      const directions = (def.directions || supportedDirections(renderer)).filter(Boolean);
      this.log.push(`Bake definition ${def.modelId}.${def.variant || 'normal'}: ${states.length} states x ${directions.length} directions.`);
      for (const state of states) {
        const frameCount = this.frameCountFor(def, state);
        for (const direction of directions) {
          for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
            try {
              frames.push(this.bakeFrame(def, state, direction, frameIndex, frameCount));
            } catch (err) {
              this.log.push(`Failed ${def.modelId}.${def.variant || 'normal'}.${state}.${direction}.${frameIndex}: ${err.message}`);
            }
          }
        }
      }
    }

    groupDefinitionsByModel(definitions = this.definitions) {
      const groups = new Map();
      for (const def of definitions) {
        const id = normalizeToken(def.modelId, 'Unknown');
        if (!groups.has(id)) groups.set(id, []);
        groups.get(id).push(def);
      }
      return groups;
    }

    packFrames(frames, options = {}) {
      const imagePrefix = options.imagePrefix || 'entities';
      const useModelFileName = !!options.useModelFileName;
      const pages = [];
      let page = this.createPage(0, imagePrefix, useModelFileName);
      let cursorX = this.padding;
      let cursorY = this.padding;
      let rowH = 0;
      for (const item of frames) {
        const w = item.canvas.width;
        const h = item.canvas.height;
        if (cursorX + w + this.padding > this.maxAtlasSize) {
          cursorX = this.padding;
          cursorY += rowH + this.padding;
          rowH = 0;
        }
        if (cursorY + h + this.padding > this.maxAtlasSize) {
          pages.push(page);
          page = this.createPage(pages.length, imagePrefix, useModelFileName);
          cursorX = this.padding;
          cursorY = this.padding;
          rowH = 0;
        }
        page.ctx.drawImage(item.canvas, cursorX, cursorY);
        item.frame.x = cursorX;
        item.frame.y = cursorY;
        item.frame.page = page.image;
        item.frame.image = page.image;
        const key = options.localKeys ? item.localKey : item.key;
        page.frames[key] = item.frame;
        cursorX += w + this.padding;
        rowH = Math.max(rowH, h);
      }
      pages.push(page);
      return pages;
    }

    createPage(index, imagePrefix = 'entities', useModelFileName = false) {
      const canvas = document.createElement('canvas');
      canvas.width = this.maxAtlasSize;
      canvas.height = this.maxAtlasSize;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      const image = useModelFileName && index === 0 ? `${imagePrefix}.png` : `${imagePrefix}_${index}.png`;
      return { index, canvas, ctx, image, frames: {} };
    }

    buildManifest(pages, options = {}) {
      const frames = {};
      for (const page of pages) Object.assign(frames, page.frames);
      return {
        version: options.version || window.DREAM_REALMS_VERSION || '0.13.70',
        type: 'dream-realms-entity-atlas',
        generatedAt: new Date().toISOString(),
        pages: pages.map(page => ({ image: page.image, w: page.canvas.width, h: page.canvas.height })),
        frames
      };
    }

    buildModelManifest(modelId, pages, definitions, options = {}) {
      const frames = {};
      for (const page of pages) Object.assign(frames, page.frames);
      const pageImages = pages.map(page => page.image);
      return {
        version: options.version || window.DREAM_REALMS_VERSION || '0.13.70',
        type: 'dream-realms-model-sprite-sheet',
        modelId,
        modelType: definitions?.[0]?.type || modelType(modelId),
        image: pageImages[0] || `${modelId}.png`,
        pages: pages.map(page => ({ image: page.image, w: page.canvas.width, h: page.canvas.height })),
        variants: [...new Set(definitions.map(def => def.variant || 'normal'))],
        generatedAt: new Date().toISOString(),
        frames
      };
    }

    buildSpriteIndex(modelResults, options = {}) {
      const models = {};
      for (const result of modelResults) {
        const id = result.modelId;
        const type = result.manifest?.modelType || modelType(id);
        const folder = type === 'class' ? 'classes' : type === 'prop' ? 'props' : 'mobs';
        models[id] = {
          type,
          modelId: id,
          image: `assets/sprites/${folder}/${result.manifest.image}`,
          metadata: `assets/sprites/${folder}/${id}.json`
        };
      }
      return {
        version: options.version || window.DREAM_REALMS_VERSION || '0.13.70',
        type: 'dream-realms-sprite-index',
        generatedAt: new Date().toISOString(),
        models
      };
    }

    async downloadCanvas(canvas, filename) {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error(`Failed to encode ${filename}`);
      this.downloadBlob(blob, filename);
    }

    downloadJson(data, filename) {
      this.downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename);
    }

    downloadManifestScript(data, filename = 'entities.manifest.js') {
      const json = JSON.stringify(data, null, 2);
      const script = `window.DreamRealmsSpriteAtlasManifest = ${json};\nwindow.DreamRealmsSpriteAtlasManifests = window.DreamRealmsSpriteAtlasManifests || {};\nwindow.DreamRealmsSpriteAtlasManifests['entities.json'] = window.DreamRealmsSpriteAtlasManifest;\n`;
      this.downloadBlob(new Blob([script], { type: 'application/javascript' }), filename);
    }

    downloadSpriteIndexScript(index, filename = 'sprite-index.manifest.js') {
      const json = JSON.stringify(index, null, 2);
      const script = `window.DreamRealmsSpriteSheetIndex = ${json};\nwindow.DreamRealmsSpriteSheetIndexes = window.DreamRealmsSpriteSheetIndexes || {};\nwindow.DreamRealmsSpriteSheetIndexes['sprite-index.json'] = window.DreamRealmsSpriteSheetIndex;\n`;
      this.downloadBlob(new Blob([script], { type: 'application/javascript' }), filename);
    }

    downloadModelMetadataScript(modelId, metadata, filename = `${modelId}.manifest.js`) {
      const json = JSON.stringify(metadata, null, 2);
      const script = `window.DreamRealmsSpriteSheetMetadata = window.DreamRealmsSpriteSheetMetadata || {};\nwindow.DreamRealmsSpriteSheetMetadata['${modelId}.json'] = ${json};\n`;
      this.downloadBlob(new Blob([script], { type: 'application/javascript' }), filename);
    }

    downloadBlob(blob, filename) {
      const a = document.createElement('a');
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }

    async bakeAndDownload(definitions = this.definitions) {
      const frames = this.bakeFrames(definitions);
      const pages = this.packFrames(frames);
      const manifest = this.buildManifest(pages);
      for (const page of pages) await this.downloadCanvas(page.canvas, page.image);
      this.downloadJson(manifest, 'entities.json');
      this.downloadManifestScript(manifest, 'entities.manifest.js');
      return { frames, pages, manifest, log: this.log.slice() };
    }

    async bakeModelSheet(modelId, definitions = this.definitions) {
      this.log.length = 0;
      const id = normalizeToken(modelId, 'Unknown');
      const defs = definitions.filter(def => normalizeToken(def.modelId, 'Unknown') === id);
      const frames = [];
      for (const def of defs) this.bakeDefinitionInto(def, frames);
      frames.sort((a, b) => a.localKey.localeCompare(b.localKey));
      if (!frames.length) {
        const detail = this.log.length ? ` Bake log: ${this.log.join(' | ')}` : '';
        throw new Error(`No visible frames baked for ${id}. Check renderer routing, humanoid dependencies, numeric bake seed, and opaque-pixel validation.${detail}`);
      }
      const pages = this.packFrames(frames, { imagePrefix: id, useModelFileName: true, localKeys: true });
      const manifest = this.buildModelManifest(id, pages, defs);
      return { modelId: id, definitions: defs, frames, pages, manifest, log: this.log.slice() };
    }

    async bakeModelSheetAndDownload(modelId, definitions = this.definitions) {
      const result = await this.bakeModelSheet(modelId, definitions);
      for (const page of result.pages) await this.downloadCanvas(page.canvas, page.image);
      this.downloadJson(result.manifest, `${result.modelId}.json`);
      this.downloadModelMetadataScript(result.modelId, result.manifest);
      return result;
    }

    async bakeSpriteSheetsAndDownload(definitions = this.definitions, options = {}) {
      const groups = this.groupDefinitionsByModel(definitions);
      const results = [];
      const logSnapshot = [];
      for (const modelId of [...groups.keys()].sort((a, b) => a.localeCompare(b))) {
        const result = await this.bakeModelSheet(modelId, groups.get(modelId));
        results.push(result);
        logSnapshot.push(...result.log);
        for (const page of result.pages) await this.downloadCanvas(page.canvas, page.image);
        this.downloadJson(result.manifest, `${modelId}.json`);
        if (options.manifestScripts) this.downloadModelMetadataScript(modelId, result.manifest);
      }
      const spriteIndex = this.buildSpriteIndex(results);
      this.downloadJson(spriteIndex, 'sprite-index.json');
      this.downloadSpriteIndexScript(spriteIndex);
      return { results, spriteIndex, log: logSnapshot };
    }
  }

  SpriteBakeSystem.defaultDefinitions = defaultDefinitions;
  SpriteBakeSystem.makeFrameKey = makeFrameKey;
  SpriteBakeSystem.makeLocalFrameKey = makeLocalFrameKey;
  SpriteBakeSystem.rendererByModel = rendererByModel;
  SpriteBakeSystem.rendererCanDrawDefinition = rendererCanDrawDefinition;
  SpriteBakeSystem.countOpaquePixels = countOpaquePixels;
  SpriteBakeSystem.stableBakeSeed = stableBakeSeed;
  SpriteBakeSystem.modelType = modelType;
  SpriteBakeSystem.modelFolder = modelFolder;
  SpriteBakeSystem.CLASS_MODELS = CLASS_MODELS;
  SpriteBakeSystem.PROP_DEFINITIONS = PROP_DEFINITIONS;
  SpriteBakeSystem.PROP_MODEL_SET = PROP_MODEL_SET;
  SpriteBakeSystem.propModelIdForObjectType = propModelIdForObjectType;
  DR.SpriteBakeSystem = SpriteBakeSystem;
  DR.tools.SpriteBakeSystem = SpriteBakeSystem;
})();
