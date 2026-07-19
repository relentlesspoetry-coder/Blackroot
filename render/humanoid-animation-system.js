(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.render = DR.render || {};

  const TAU = Math.PI * 2;
  const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));
  const easeOutCubic = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeInCubic = t => Math.pow(clamp01(t), 3);
  const easeInOut = t => {
    t = clamp01(t);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  /*
   * Canonical 8-direction model/sprite row format.
   *
   * This is the required shared model order for all humanoid class renderers and
   * any future sprite-sheet-backed actor renderer:
   *
   *   Row | Sheet Direction | Camera-relative facing        | World equivalent
   *   ----+-----------------+-------------------------------+-----------------
   *    0  | Up              | facing away / back             | North
   *    1  | Down            | facing toward / front          | South
   *    2  | Left            | facing camera-left             | West
   *    3  | Right           | facing camera-right            | East
   *    4  | Up Right        | facing away + right            | Northeast
   *    5  | Down Right      | facing toward + right          | Southeast
   *    6  | Up Left         | facing away + left             | Northwest
   *    7  | Down Left       | facing toward + left           | Southwest
   *
   * Do not present or export this framework as N/NE/E/SE/S/SW/W/NW order.
   * World direction names remain internal aliases only; the public format is
   * row-indexed as Up, Down, Left, Right, Up Right, Down Right, Up Left, Down Left.
   */
  const ROW = Object.freeze({
    UP: 0,
    DOWN: 1,
    LEFT: 2,
    RIGHT: 3,
    UP_RIGHT: 4,
    DOWN_RIGHT: 5,
    UP_LEFT: 6,
    DOWN_LEFT: 7
  });

  const DIRECTION_ROW_ORDER = Object.freeze(['north', 'south', 'west', 'east', 'northeast', 'southeast', 'northwest', 'southwest']);
  const DIRECTION_ROW_LABELS = Object.freeze(['Up', 'Down', 'Left', 'Right', 'Up Right', 'Down Right', 'Up Left', 'Down Left']);
  const DIRECTION_ROW_DEBUG_LABELS = Object.freeze(['UP', 'DOWN', 'LEFT', 'RIGHT', 'UP RIGHT', 'DOWN RIGHT', 'UP LEFT', 'DOWN LEFT']);
  const DIRECTION_TO_ROW = Object.freeze({
    north: 0,
    south: 1,
    west: 2,
    east: 3,
    northeast: 4,
    southeast: 5,
    northwest: 6,
    southwest: 7
  });
  const ROW_TO_WORLD_DIRECTION = Object.freeze({
    0: 'north',
    1: 'south',
    2: 'west',
    3: 'east',
    4: 'northeast',
    5: 'southeast',
    6: 'northwest',
    7: 'southwest'
  });

  // Kept only for converting a vector angle into an internal world direction name.
  const VECTOR_OCTANT_ORDER = ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'];

  function enrichDirection(def) {
    const row = DIRECTION_TO_ROW[def.name] ?? 1;
    return Object.freeze({
      ...def,
      row,
      spriteRow: row,
      sheetRow: row,
      sheetDirection: DIRECTION_ROW_LABELS[row],
      sheetDebugLabel: DIRECTION_ROW_DEBUG_LABELS[row],
      worldDirection: def.name,
      worldShort: def.worldShort || def.short
    });
  }

  const DIRECTIONS = {
    north: enrichDirection({
      name: 'north', short: 'UP', worldShort: 'N', angle: -Math.PI / 2, view: 'back', side: 0,
      faceVisible: false, backVisible: true, headTurn: 0, torsoSkew: 0,
      shoulderScale: 0.94, torsoScaleX: 0.94, headScaleX: 0.96,
      farSide: 1, nearSide: -1, depth: 'back', capeSide: 0,
      faceOffsetX: 0, handBiasX: 0, footOverlap: -1,
      armOcclusion: 'fullBackBody', showNearArm: false, showFarArm: false, showNearHand: false, showFarHand: false, armSwingScale: 0.22, handInset: 0.15
    }),
    northeast: enrichDirection({
      name: 'northeast', short: 'UP RIGHT', worldShort: 'NE', angle: -Math.PI / 4, view: 'backDiagonal', side: 1,
      faceVisible: false, backVisible: true, headTurn: 4.5, torsoSkew: 4.5,
      shoulderScale: 0.84, torsoScaleX: 0.86, headScaleX: 0.9,
      farSide: -1, nearSide: 1, depth: 'backDiag', capeSide: -1,
      faceOffsetX: 0, handBiasX: 4, footOverlap: -0.5,
      armOcclusion: 'backBiased', showNearArm: false, showFarArm: true, showNearHand: false, showFarHand: false, armSwingScale: 0.42, handInset: 0.42
    }),
    east: enrichDirection({
      name: 'east', short: 'RIGHT', worldShort: 'E', angle: 0, view: 'side', side: 1,
      faceVisible: true, backVisible: false, headTurn: 7.5, torsoSkew: 8,
      shoulderScale: 0.66, torsoScaleX: 0.72, headScaleX: 0.74,
      farSide: -1, nearSide: 1, depth: 'side', capeSide: -1,
      faceOffsetX: 4, handBiasX: 8, footOverlap: 0
    }),
    southeast: enrichDirection({
      name: 'southeast', short: 'DOWN RIGHT', worldShort: 'SE', angle: Math.PI / 4, view: 'frontDiagonal', side: 1,
      faceVisible: true, backVisible: false, headTurn: 4.5, torsoSkew: 4.5,
      shoulderScale: 0.88, torsoScaleX: 0.9, headScaleX: 0.92,
      farSide: -1, nearSide: 1, depth: 'frontDiag', capeSide: -1,
      faceOffsetX: 2.5, handBiasX: 4, footOverlap: 0.5
    }),
    south: enrichDirection({
      name: 'south', short: 'DOWN', worldShort: 'S', angle: Math.PI / 2, view: 'front', side: 0,
      faceVisible: true, backVisible: false, headTurn: 0, torsoSkew: 0,
      shoulderScale: 1.0, torsoScaleX: 1.0, headScaleX: 1.0,
      farSide: -1, nearSide: 1, depth: 'front', capeSide: 0,
      faceOffsetX: 0, handBiasX: 0, footOverlap: 1
    }),
    southwest: enrichDirection({
      name: 'southwest', short: 'DOWN LEFT', worldShort: 'SW', angle: Math.PI * 0.75, view: 'frontDiagonal', side: -1,
      faceVisible: true, backVisible: false, headTurn: -4.5, torsoSkew: -4.5,
      shoulderScale: 0.88, torsoScaleX: 0.9, headScaleX: 0.92,
      farSide: 1, nearSide: -1, depth: 'frontDiag', capeSide: 1,
      faceOffsetX: -2.5, handBiasX: -4, footOverlap: 0.5
    }),
    west: enrichDirection({
      name: 'west', short: 'LEFT', worldShort: 'W', angle: Math.PI, view: 'side', side: -1,
      faceVisible: true, backVisible: false, headTurn: -7.5, torsoSkew: -8,
      shoulderScale: 0.66, torsoScaleX: 0.72, headScaleX: 0.74,
      farSide: 1, nearSide: -1, depth: 'side', capeSide: 1,
      faceOffsetX: -4, handBiasX: -8, footOverlap: 0
    }),
    northwest: enrichDirection({
      name: 'northwest', short: 'UP LEFT', worldShort: 'NW', angle: -Math.PI * 0.75, view: 'backDiagonal', side: -1,
      faceVisible: false, backVisible: true, headTurn: -4.5, torsoSkew: -4.5,
      shoulderScale: 0.84, torsoScaleX: 0.86, headScaleX: 0.9,
      farSide: 1, nearSide: -1, depth: 'backDiag', capeSide: 1,
      faceOffsetX: 0, handBiasX: -4, footOverlap: -0.5,
      armOcclusion: 'backBiased', showNearArm: false, showFarArm: true, showNearHand: false, showFarHand: false, armSwingScale: 0.42, handInset: 0.42
    })
  };

  function normalizeDirectionName(value) {
    const f = String(value || '').trim().toLowerCase().replace(/[\s_\-]/g, '');
    if (!f) return '';
    if (f === 'n' || f === 'north') return 'north';
    if (f === 'ne' || f === 'northeast' || f === 'eastnorth') return 'northeast';
    if (f === 'e' || f === 'east') return 'east';
    if (f === 'se' || f === 'southeast' || f === 'eastsouth') return 'southeast';
    if (f === 's' || f === 'south') return 'south';
    if (f === 'sw' || f === 'southwest' || f === 'westsouth') return 'southwest';
    if (f === 'w' || f === 'west') return 'west';
    if (f === 'nw' || f === 'northwest' || f === 'westnorth') return 'northwest';
    if (f.includes('north') && f.includes('east')) return 'northeast';
    if (f.includes('north') && f.includes('west')) return 'northwest';
    if (f.includes('south') && f.includes('east')) return 'southeast';
    if (f.includes('south') && f.includes('west')) return 'southwest';
    if (f.includes('north')) return 'north';
    if (f.includes('south')) return 'south';
    if (f.includes('east')) return 'east';
    if (f.includes('west')) return 'west';
    return '';
  }

  function directionFromVector(x, y, fallback = 'south') {
    x = Number(x) || 0;
    y = Number(y) || 0;
    if (Math.abs(x) < 0.01 && Math.abs(y) < 0.01) return fallback;
    const angle = Math.atan2(y, x);
    const index = Math.round(angle / (Math.PI / 4));
    return VECTOR_OCTANT_ORDER[(index + 8) % 8] || fallback;
  }

  function normalizeDegrees(value) {
    return ((Number(value) || 0) % 360 + 360) % 360;
  }

  /**
   * Camera-relative direction mapper using the canonical row format:
   * 0 Up, 1 Down, 2 Left, 3 Right, 4 Up Right, 5 Down Right, 6 Up Left, 7 Down Left.
   * Angles are degrees, 0 = North, 90 = East, clockwise positive.
   */
  function getDirectionIndexMath(characterWorldAngleDeg, cameraAngleDeg) {
    const relative = normalizeDegrees(characterWorldAngleDeg - cameraAngleDeg);
    if (relative >= 337.5 || relative < 22.5) return ROW.UP;          // Up / North / back
    if (relative < 67.5) return ROW.UP_RIGHT;                         // Up Right / Northeast
    if (relative < 112.5) return ROW.RIGHT;                           // Right / East
    if (relative < 157.5) return ROW.DOWN_RIGHT;                      // Down Right / Southeast
    if (relative < 202.5) return ROW.DOWN;                            // Down / South / front
    if (relative < 247.5) return ROW.DOWN_LEFT;                       // Down Left / Southwest
    if (relative < 292.5) return ROW.LEFT;                            // Left / West
    return ROW.UP_LEFT;                                               // Up Left / Northwest
  }

  /** Lookup-table version of getDirectionIndexMath. */
  function getDirectionIndexLookup(characterWorldAngleDeg, cameraAngleDeg) {
    const relative = normalizeDegrees(characterWorldAngleDeg - cameraAngleDeg);
    const octant = Math.floor((relative + 22.5) / 45) & 7;
    return [ROW.UP, ROW.UP_RIGHT, ROW.RIGHT, ROW.DOWN_RIGHT, ROW.DOWN, ROW.DOWN_LEFT, ROW.LEFT, ROW.UP_LEFT][octant];
  }

  function directionRowFromScreenVector(screenX, screenY, fallbackRow = ROW.DOWN) {
    screenX = Number(screenX) || 0;
    screenY = Number(screenY) || 0;
    if (Math.abs(screenX) < 0.01 && Math.abs(screenY) < 0.01) return fallbackRow;
    const angle = Math.atan2(screenY, screenX) * 180 / Math.PI;
    if (angle >= -22.5 && angle < 22.5) return ROW.RIGHT;
    if (angle >= 22.5 && angle < 67.5) return ROW.DOWN_RIGHT;
    if (angle >= 67.5 && angle < 112.5) return ROW.DOWN;
    if (angle >= 112.5 && angle < 157.5) return ROW.DOWN_LEFT;
    if (angle >= 157.5 || angle < -157.5) return ROW.LEFT;
    if (angle >= -157.5 && angle < -112.5) return ROW.UP_LEFT;
    if (angle >= -112.5 && angle < -67.5) return ROW.UP;
    return ROW.UP_RIGHT;
  }

  function getDirectionIndexFromWorldVector(facingX, facingY, cameraYawRad = 0, fallbackRow = ROW.DOWN) {
    const fx = Number(facingX) || 0;
    const fy = Number(facingY) || 0;
    if (Math.abs(fx) < 0.01 && Math.abs(fy) < 0.01) return fallbackRow;

    /*
     * V0.12.67: actor animation rows are selected from projected screen motion,
     * not from raw world north/south alone. This keeps visual facing aligned with
     * what the player sees:
     * - moving toward the bottom of the screen uses Row 1 Down/front
     * - moving toward the top of the screen uses Row 0 Up/back
     */
    const c = Math.cos(Number(cameraYawRad) || 0);
    const s = Math.sin(Number(cameraYawRad) || 0);
    const cx = fx * c - fy * s;
    const cy = fx * s + fy * c;
    const screenX = cx - cy;
    const screenY = cx + cy;
    return directionRowFromScreenVector(screenX, screenY, fallbackRow);
  }

  function directionNameForRow(row) {
    return ROW_TO_WORLD_DIRECTION[Number(row)] || 'south';
  }

  function labelForRow(row) {
    return DIRECTION_ROW_LABELS[Number(row)] || 'Down';
  }

  function resolveDirection(actor = {}) {
    const rowValue = actor.directionRow ?? actor.spriteDirectionRow ?? actor.facingRow ?? actor.directionIndex ?? actor.spriteRow;
    if (rowValue != null && ROW_TO_WORLD_DIRECTION[Number(rowValue)] && DIRECTIONS[ROW_TO_WORLD_DIRECTION[Number(rowValue)]]) {
      return DIRECTIONS[ROW_TO_WORLD_DIRECTION[Number(rowValue)]];
    }

    const explicit = normalizeDirectionName(actor.facingName || actor.facingLabel || actor.direction || actor.facingDirection);
    if (explicit && DIRECTIONS[explicit]) return DIRECTIONS[explicit];

    const source = actor.sourceEntity || actor;
    const last = normalizeDirectionName(source.lastFacingName || source._lastHumanoidFacingName);
    const fallback = DIRECTIONS[last] ? last : (Number(source.facing || 1) < 0 ? 'west' : 'south');
    const dirName = directionFromVector(source.facingX ?? actor.facingX, source.facingY ?? actor.facingY, fallback);
    if (source) source._lastHumanoidFacingName = dirName;
    return DIRECTIONS[dirName] || DIRECTIONS.south;
  }

  function resolveAction(actor = {}) {
    const source = actor.sourceEntity || actor;
    const actionText = String(actor.action || actor.animationState || source.action || source.animationState || '').toLowerCase();
    const gatheringKind=String(actor.gatheringKind||source.gatheringKind||actor.toolType||source.toolType||'').toLowerCase();
    if (actor.dead || actor.alive === false || actionText === 'dead' || actionText === 'death') return 'death';
    if (actor.swimming || actor.isSwimming || actor.inWater || source.swimming || source.isSwimming || source.inWater || ['swim','swimming','tread'].includes(actionText) || ['swimming','treading'].includes(String(actor.swimState||source.swimState||'').toLowerCase())) return 'swim';
    if (actor.fishing || actor.isFishing || source.fishing || ['fish','fishing'].includes(actionText)) return 'fishing';
    if (actor.gathering || actor.harvesting || actor.mining || source.gathering || ['gather','gathering','harvest','harvesting','mine','mining'].includes(actionText) || ['mining','herb','harvest'].includes(gatheringKind)) return 'gathering';
    if (actor.isJumping || source.isJumping || actionText === 'jump') return 'jump';
    // V0.20.69 (Roadmap Item 7.G): riding is a first-class ACTION, not a flag bolted onto the walk
    // pose. Resolving it here means every class model - bespoke and shared alike - inherits a seated
    // rig from the one animation system, exactly as 'sit' and 'swim' already do. Placed above the
    // emote/meditate checks because a mounted character is riding regardless of what else is going on,
    // and below swim/gather because those states dismount you anyway.
    if (actor.mounted || source.mounted) return 'ride';
    if (actor.emoteActive || actor.isEmoting || actionText === 'dance' || actionText === 'sit') {
      const emote = String(actor.emoteState || actionText || '').toLowerCase();
      if (emote === 'dance' || emote === 'sit') return emote;
    }
    if (actor.meditating || actor.isMeditating || source.meditating || actionText === 'meditate' || actionText === 'rest') return 'meditate';
    if (Number(actor.hitAnim || actor.hitReaction || actor.damageAnim || 0) > 0.01 || actionText === 'hit') return 'hit';
    if (Number(actor.spellCastAnim || actor.castAnim || 0) > 0.02 || ['cast', 'casting', 'performing', 'song', 'playing'].includes(actionText)) return 'cast';
    if (Number(actor.attackAnim || 0) > 0.02 || actionText === 'attack') return 'attack';
    const autoVisual = (actor.autoAttackVisualActive || source.autoAttackVisualActive);
    if (autoVisual) {
      const type = String(actor.autoAttackVisualType || source.autoAttackVisualType || '').toLowerCase();
      return type === 'caster' || type === 'ranged' || type === 'cast' ? 'cast' : 'attack';
    }
    const moving = actor.isMoving ?? actor.moving ?? ((Math.abs(actor.vx || 0) + Math.abs(actor.vy || 0)) > 0.01 || Number(actor.moveBlend || 0) > 0.08);
    return moving ? 'walk' : 'idle';
  }

  function stableActorSeed(value) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const text = String(value || 'actor');
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % 1000000;
  }

  function buildPose(actor = {}, nowMs = performance.now()) {
    const source = actor.sourceEntity || actor;
    const t = nowMs / 1000;
    const seed = stableActorSeed(source.id || actor.id || actor.bakeKey || 0) * 0.17;
    const direction = resolveDirection(actor);
    const action = resolveAction(actor);
    const swimming = action === 'swim';
    const swimMoveAmount = swimming ? clamp01(Number(actor.swimMovement ?? source.swimMovement ?? source.moveBlend ?? actor.moveBlend ?? 0)) : 0;
    const swimMoving = swimming && swimMoveAmount > 0.10;
    const moving = action === 'walk';
    const walkSpeed = 7.4 + Math.min(2.4, Math.hypot(source.vx || 0, source.vy || 0) * 0.08);
    const swimSpeed = 2.6 + swimMoveAmount * 2.0 + Math.min(1.4, Math.hypot(source.vx || 0, source.vy || 0) * 0.04);
    const phase = t * (moving ? walkSpeed : swimming ? swimSpeed : 1.5) + seed;
    const walkCycle = moving ? phase : seed + t * 0.7;
    const strideRaw = Math.sin(walkCycle);
    const counterStride = Math.sin(walkCycle + Math.PI);
    const breath = Math.sin(t * 2.05 + seed) * 0.9;
    const swimCycle = swimming ? (Number(actor.swimAnim ?? source.swimAnim ?? 0) || phase) : 0;
    const explicitLocomotionPhase=Number(actor.animationPhase??source.animationPhase),normalizeCycle=value=>((value%1)+1)%1;
    const walkPhase=moving?(Number.isFinite(explicitLocomotionPhase)?normalizeCycle(explicitLocomotionPhase):normalizeCycle(walkCycle/(Math.PI*2))):0;
    const swimPhase=swimming?(Number.isFinite(explicitLocomotionPhase)?normalizeCycle(explicitLocomotionPhase):normalizeCycle(swimCycle)):0;
    // Jump is a one-shot arc rather than a repeating gait: explicitLocomotionPhase (the sprite-sheet
    // exporter's 0..1 frame sweep) takes priority, otherwise fall back to the live entity's decaying
    // jumpAnim (1 at takeoff -> 0 at landing) reinterpreted as a rising 0..1 progress value.
    const jumping = action === 'jump';
    const jumpPhase = jumping ? (Number.isFinite(explicitLocomotionPhase) ? normalizeCycle(explicitLocomotionPhase) : clamp01(1 - Number(actor.jumpAnim ?? source.jumpAnim ?? actor.jumpPhase ?? source.jumpPhase ?? 0))) : 0;
    const danceCycle = action === 'dance' ? ((Number(actor.emoteAnim ?? source.emoteAnim ?? 0) || (t * 1.65 + seed * 0.01)) % 1 + 1) % 1 : 0;
    const sitCycle = action === 'sit' ? ((Number(actor.emoteAnim ?? source.emoteAnim ?? 0) || (t * 0.55 + seed * 0.01)) % 1 + 1) % 1 : 0;
    const emotePulse = (action === 'dance' || action === 'sit') ? (0.5 + Math.sin(t * (action === 'dance' ? 5.2 : 1.6) + seed) * 0.5) : 0;
    const swimStroke = swimming ? Math.sin(swimCycle * Math.PI * 2) : 0;
    const swimKick = swimming ? Math.sin(swimCycle * Math.PI * 4 + Math.PI * 0.35) : 0;
    const swimBob = swimming ? Math.sin((t * (swimMoving ? 3.2 : 1.9)) + seed) : 0;
    const moveBlend = swimming
      ? swimMoveAmount
      : (moving ? clamp01((Math.abs(source.vx || 0) + Math.abs(source.vy || 0)) * 0.08 + Number(source.moveBlend || 0)) : 0);

    const autoVisualActive = Boolean(actor.autoAttackVisualActive || source.autoAttackVisualActive);
    const autoAttackPhase = autoVisualActive ? clamp01(Number(actor.autoAttackVisualPhase ?? source.autoAttackVisualPhase ?? 0)) : 0;
    const autoAttackPulse = autoVisualActive ? clamp01(Number(actor.autoAttackVisualPulse ?? source.autoAttackVisualPulse ?? Math.sin(autoAttackPhase * Math.PI))) : 0;
    const rawAttackAnim = clamp01(Number(actor.attackAnim || source.attackAnim || 0));
    const rawCastAnim = clamp01(Number(actor.spellCastAnim || source.spellCastAnim || actor.castAnim || 0));
    const attack = rawAttackAnim > 0 ? rawAttackAnim : (autoVisualActive && action === 'attack' ? 1 - autoAttackPhase : 0);
    const attackCurve = attack > 0 ? Math.sin((1 - attack) * Math.PI) : 0;
    const cast = rawCastAnim > 0 ? rawCastAnim : (autoVisualActive && action === 'cast' ? Math.max(0.16, autoAttackPulse) : 0);
    const gatherProgress = action === 'gathering' ? clamp01(Number(actor.gatheringProgress ?? source.gatheringProgress ?? 0)) : 0;
    const gatherLoop = action === 'gathering' ? ((t * 2.35 + seed * 0.037) % 1 + 1) % 1 : 0;
    const gatherCutPhase = action === 'gathering' ? Math.sin(gatherLoop * Math.PI) : 0;
    const gatherCutImpact = action === 'gathering' && gatherLoop >= 0.52 && gatherLoop <= 0.68
      ? Math.sin(((gatherLoop - 0.52) / 0.16) * Math.PI)
      : 0;
    const gatherCompleteHold = action === 'gathering' ? clamp01(Number(actor.gatheringCompleteTimer ?? source.gatheringCompleteTimer ?? 0) / 0.34) : 0;
    const gatherPulse = action === 'gathering' ? (0.5 + Math.sin(t * 8.5 + seed) * 0.5) : 0;
    const castPulse = action === 'cast' ? (0.5 + Math.sin(t * 7.2 + seed) * 0.5) : cast;
    const hit = clamp01(Number(actor.hitAnim || actor.hitReaction || actor.damageAnim || source.hitAnim || 0));
    const death = clamp01(Number(actor.deathProgress || source.deathProgress || (!source.alive || actor.dead ? 1 : 0)));
    const meditatePulse = action === 'meditate' ? 1 + Math.sin(t * 3.1 + seed) * 0.16 : 1;
    const meditateLoop = action === 'meditate' ? ((t * 0.82 + seed * 0.013) % 1 + 1) % 1 : 0;
    const rawMeditationProgress = Number(actor.meditationProgress ?? source.meditationProgress ?? (Number(source.meditationTickRate || 0) > 0 ? Number(source.meditationTickTimer || 0) / Number(source.meditationTickRate || 1) : 0));
    const meditationProgress = action === 'meditate' ? clamp01(rawMeditationProgress) : 0;
    const meditationStartedAt = Number(actor.meditationStartedAt ?? source.meditationStartedAt ?? actor.startedMeditatingAt ?? source.startedMeditatingAt ?? nowMs);
    const meditationAuraAlpha = action === 'meditate' ? clamp01((nowMs - meditationStartedAt) / 260) : 0;
    const meditationLevel = Math.max(1, Math.min(20, Number(actor.meditation?.level ?? source.meditation?.level ?? actor.meditationSkill?.level ?? source.meditationSkill?.level ?? 1)));

    const torsoBob = action === 'meditate'
      ? Math.sin(t * 2.0 + seed) * 0.42
      : swimming
        ? swimBob * (swimMoving ? 1.0 : 0.55)
        : (moving ? -Math.abs(strideRaw) * 1.9 : breath * 0.38);
    const headBob = action === 'meditate'
      ? Math.sin(t * 2.0 + seed) * 0.35
      : swimming
        ? swimBob * (swimMoving ? 0.9 : 0.5)
        : (moving ? -Math.abs(strideRaw) * 1.1 : breath * 0.32);
    const footLift = moving ? Math.max(0, Math.sin(walkCycle)) * 3.6 : 0;
    const footLiftAlt = moving ? Math.max(0, Math.sin(walkCycle + Math.PI)) * 3.6 : 0;

    const lean = (swimming ? 1.35 : moving ? 2.0 : 0) * Math.sign(direction.side || 0 || (source.facingX || 0));
    const recoil = action === 'hit' ? (1 - easeOutCubic(hit || 0.35)) * 5 : 0;
    const collapse = action === 'death' ? easeInOut(death || 1) : 0;

    return {
      nowMs,
      t,
      seed,
      action,
      direction,
      moving,
      swimming,
      swimMoving,
      swimMovement: swimMoveAmount,
      swimCycle,
      swimStroke,
      swimKick,
      swimBob,
      danceCycle,
      sitCycle,
      emotePulse,
      // V0.20.69: riding gait. The rider does not stride - the BEAST does - so the body rises and
      // falls at the quadruped models' own 8.5 rate, keeping rider and mount in phase. `rideMoving`
      // distinguishes a travelling mount from a standing one.
      riding: action === 'ride',
      rideMoving: action === 'ride' && Number(source.moveBlend || actor.moveBlend || 0) > 0.08,
      rideGait: action === 'ride'
        ? (Number(source.moveBlend || actor.moveBlend || 0) > 0.08
          ? -Math.abs(Math.sin(t * 8.5)) * 2.4
          : Math.sin(t * 1.8 + seed) * 0.5)
        : 0,
      emoteState: action === 'dance' || action === 'sit' ? action : '',
      swimSubmerge: swimming ? clamp01(Number(actor.swimSubmerge ?? source.swimSubmerge ?? 0.52)) : 0,
      swimBlend: swimming ? clamp01(Number(actor.swimBlend ?? source.swimBlend ?? 1)) : 0,
      moveBlend,
      phase,
      walkCycle,
      walkPhase,
      swimPhase,
      jumping,
      jumpPhase,
      breath,
      stride: strideRaw,
      counterStride,
      armSwing: swimming ? swimStroke * (swimMoving ? 8.8 : 3.2) : (moving ? strideRaw * 5.6 : breath * 0.55),
      legSwing: swimming ? swimKick * (swimMoving ? 4.2 : 1.35) : (moving ? strideRaw * 4.6 : 0),
      shoulderCounter: swimming ? -swimStroke * (swimMoving ? 2.3 : 0.75) : (moving ? -strideRaw * 1.6 : breath * 0.22),
      torsoBob,
      headBob,
      footLift,
      footLiftAlt,
      lean,
      attack,
      attackCurve,
      cast,
      autoAttackVisualActive: autoVisualActive,
      autoAttackPhase,
      autoAttackPulse,
      autoAttackVisualDurationMs: Number(actor.autoAttackVisualDurationMs || source.autoAttackVisualDurationMs || 0),
      autoAttackVisualImpactPhase: Number(actor.autoAttackVisualImpactPhase || source.autoAttackVisualImpactPhase || 0.58),
      autoAttackVisualAimX: Number(actor.autoAttackVisualAimX || source.autoAttackVisualAimX || 0),
      autoAttackVisualAimY: Number(actor.autoAttackVisualAimY || source.autoAttackVisualAimY || 0),
      autoAttackVisualType: String(actor.autoAttackVisualType || source.autoAttackVisualType || '').toLowerCase(),
      autoAttackVisualClass: String(actor.autoAttackVisualClass || source.autoAttackVisualClass || actor.className || source.className || '').toLowerCase(),
      autoAttackVisualRole: String(actor.autoAttackVisualRole || source.autoAttackVisualRole || '').toLowerCase(),
      castPulse,
      gatherProgress,
      gatheringKind: String(actor.gatheringKind ?? source.gatheringKind ?? '').toLowerCase(),
      gatherLoop,
      gatherCutPhase,
      gatherCutImpact,
      gatherCompleteHold,
      gatherPulse,
      hit,
      hitFlash: action === 'hit' ? Math.max(0.15, 1 - hit) : 0,
      recoil,
      death: collapse,
      deathProgress: collapse,
      meditatePulse,
      meditateLoop,
      meditationProgress,
      meditationAuraAlpha,
      meditationLevel,
      clothSway: swimming ? swimStroke * 1.8 : (moving ? Math.sin(walkCycle + 0.4) * 3.0 : Math.sin(t * 1.8 + seed) * 1.2),
      capeSway: swimming ? swimStroke * 2.3 : (moving ? Math.sin(walkCycle - 0.35) * 4.0 : Math.sin(t * 1.4 + seed) * 1.4),
      handTremor: (action === 'cast' || action === 'gathering') ? Math.sin(t * 12 + seed) * 1.0 : 0,
      directionRow: direction.row,
      directionLabel: direction.sheetDirection || 'Down',
      directionWorldShort: direction.worldShort || '?',
      shortDirection: direction.sheetDebugLabel || direction.short || '?'
    };
  }

  DR.render.HumanoidAnimationSystem = {
    ROW,
    DIRECTION_ROW_ORDER,
    DIRECTION_ROW_LABELS,
    DIRECTION_ROW_DEBUG_LABELS,
    DIRECTION_TO_ROW,
    ROW_TO_WORLD_DIRECTION,
    VECTOR_OCTANT_ORDER,
    normalizeDegrees,
    getDirectionIndexMath,
    getDirectionIndexLookup,
    directionRowFromScreenVector,
    getDirectionIndexFromWorldVector,
    directionNameForRow,
    labelForRow,
    DIRECTIONS,
    normalizeDirectionName,
    directionFromVector,
    resolveDirection,
    resolveAction,
    buildPose,
    stableActorSeed,
    clamp01,
    easeOutCubic,
    easeInCubic,
    easeInOut,
    TAU
  };
})();
