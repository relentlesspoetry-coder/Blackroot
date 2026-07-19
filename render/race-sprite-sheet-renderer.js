// Optional Blender-rendered race sprite sheets for the existing Canvas2D stack.
// Missing sheets are expected during development and always fall back safely.
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.render = DR.render || {};

  const sheets = new Map();
  const warned = new Set();
  const directionRows = Object.freeze({
    north: 0, south: 1, west: 2, east: 3,
    northeast: 4, southeast: 5, northwest: 6, southwest: 7
  });

  function warnOnce(key, message) {
    if (warned.has(key)) return;
    warned.add(key);
    console.warn(`[DreamRealms] ${message}`);
  }

  function raceConfig(raceId) {
    const race = DR.getRaceDefinition?.(raceId);
    const config = race?.spriteRenderer;
    return config?.enabled === true ? config : null;
  }

  function normalizeAction(actor) {
    const source = actor?.sourceEntity || actor || {};
    const action = String(actor?.action || actor?.animationState || source.action || source.animationState || '').toLowerCase();
    if (!actor || actor.alive === false || actor.dead || actor.isDead || source.alive === false || source.dead || source.isDead || ['dead', 'death'].includes(action)) return 'death';
    if (actor.swimming || actor.isSwimming || actor.inWater || source.swimming || source.isSwimming || source.inWater || ['swim', 'swimming', 'tread'].includes(action) || ['swimming','treading'].includes(String(actor.swimState||source.swimState||'').toLowerCase())) return 'swim';
    if(actor.fishing||actor.isFishing||source.fishing||['fish','fishing'].includes(action))return 'fishing';
    if(actor.gathering||actor.harvesting||actor.mining||source.gathering||['gather','gathering','harvest','harvesting','mine','mining'].includes(action))return String(actor.gatheringKind||source.gatheringKind||'').toLowerCase()==='mining'?'mining':'harvesting';
    if(actor.emoteActive||actor.isEmoting||source.emoteActive||action==='dance')return 'dance';
    if (actor.meditating || actor.isMeditating || source.meditating || source.isMeditating || ['meditate', 'rest'].includes(action)) return 'meditate';
    if (Number(actor.hitAnim || actor.hitReaction || actor.damageAnim || actor.hitTimer || source.hitAnim || source.hitReaction || source.damageAnim || source.hitTimer || 0) > 0.02 || action === 'hit') return 'hit';
    if (actor.casting || actor.isCasting || source.casting || source.isCasting || Number(actor.spellCastAnim || source.spellCastAnim || 0) > 0.02 || ['cast', 'casting', 'performing'].includes(action)) return 'cast';
    if (actor.attacking || actor.isAttacking || source.attacking || source.isAttacking || Number(actor.attackAnim || source.attackAnim || 0) > 0.02 || action.includes('attack')) return 'attack';
    if (actor.isMoving || actor.moving || source.isMoving || source.moving || Number(actor.moveBlend || source.moveBlend || 0) > 0.05 || Math.hypot(Number(actor.vx ?? source.vx) || 0, Number(actor.vy ?? source.vy) || 0) > 0.01 || action === 'walk') return 'walk';
    return 'idle';
  }

  function getAnimationConfig(raceId, actionState) {
    const config = raceConfig(raceId);
    if (!config) return null;
    const action = String(actionState || 'idle').toLowerCase();
    return config.animations?.[action] || null;
  }

  function variantParts(actor={}){
    const raceId=String(actor.raceId||'').toLowerCase();if(raceId!=='bogling')return {gender:'',paletteId:''};
    const gender=String(actor.gender||actor.sourceEntity?.gender||'male').toLowerCase()==='female'?'female':'male',paletteId=DR.normalizeRacePaletteId?.('bogling',actor.racePaletteId||actor.sourceEntity?.racePaletteId)||'marsh_green';return {gender,paletteId};
  }
  function sheetKey(raceId, actionState,gender='',paletteId='') {
    return `${String(raceId||'').toLowerCase()}:${gender}:${paletteId}:${String(actionState||'idle').toLowerCase()}`;
  }
  function spritePath(actor,action,animation,config){
    const raceId=String(actor?.raceId||'').toLowerCase();if(raceId!=='bogling'||config.variantSheets!==true)return `${config.basePath||''}${animation.file||''}`;
    const {gender,paletteId}=variantParts(actor),palette=DR.getRaceDefinition?.('bogling')?.palettes?.[paletteId],assetId=palette?.spriteVariantId||paletteId,suffix=action==='harvesting'?'harvest':action==='mining'?'mine':action==='fishing'?'fish':action;
    return `${config.basePath||''}${gender}/${assetId}/bogling_${gender}_${assetId}_${suffix}.png`;
  }
  function hasLoadedSheet(raceId, actionState,gender='',paletteId='') {
    if(String(raceId).toLowerCase()==='bogling'&&!gender){for(const record of sheets.values())if(record.raceId==='bogling'&&record.action===actionState&&record.loaded)return true;return false;}
    const record = sheets.get(sheetKey(raceId, actionState,gender,paletteId));
    return Boolean(record?.loaded && record.image?.complete && Number(record.image.naturalWidth) > 0 && Number(record.image.naturalHeight) > 0);
  }

  function ensureSheet(actor,action,animation,config){
    if(typeof Image==='undefined')return null;const raceId=String(actor?.raceId||'').toLowerCase(),parts=variantParts(actor),key=sheetKey(raceId,action,parts.gender,parts.paletteId);if(sheets.has(key))return sheets.get(key);
    const image=new Image(),path=spritePath(actor,action,animation,config),record={raceId,action,gender:parts.gender,paletteId:parts.paletteId,animation,config,image,path,loaded:false,failed:false};sheets.set(key,record);
    image.onload=()=>{const requiredWidth=config.frameWidth*Math.max(1,Number(animation.frames)||1),requiredHeight=config.frameHeight*Math.max(1,Number(config.directions)||8);record.loaded=image.naturalWidth===requiredWidth&&image.naturalHeight===requiredHeight;record.failed=!record.loaded;if(!record.loaded)warnOnce(key,`Optional ${raceId} ${action} sprite sheet has invalid dimensions (${image.naturalWidth}x${image.naturalHeight}; expected ${requiredWidth}x${requiredHeight}): ${path}. Procedural fallback remains active.`);else window.DarkWoodsGame?.renderCreatorPreviewCanvas?.();};
    image.onerror=()=>{record.failed=true;warnOnce(key,`Optional ${raceId} ${action} sprite sheet is unavailable: ${path}. Procedural fallback remains active.`);};
    const version=encodeURIComponent(String(window.DREAM_REALMS_VERSION||'dev'));image.src=`${path}${path.includes('?')?'&':'?'}v=${version}`;return record;
  }

  function preload() {
    if (typeof Image === 'undefined') return Promise.resolve([]);
    const pending = [];
    for (const race of Object.values(DR.RACES || {})) {
      const config = raceConfig(race.id);
      if (!config) continue;
      if(config.variantSheets===true)continue;
      for (const [action, animation] of Object.entries(config.animations || {})) {
        const key = sheetKey(race.id, action,'','');
        if (sheets.has(key)) continue;
        const image = new Image();
        const path = `${config.basePath || ''}${animation.file || ''}`;
        const record = { raceId: race.id, action, animation, config, image, path, loaded: false, failed: false };
        sheets.set(key, record);
        pending.push(new Promise(resolve => {
          image.onload = () => {
            const requiredWidth = config.frameWidth * Math.max(1, Number(animation.frames) || 1);
            const requiredHeight = config.frameHeight * Math.max(1, Number(config.directions) || 8);
            record.loaded = image.naturalWidth >= requiredWidth && image.naturalHeight >= requiredHeight;
            record.failed = !record.loaded;
            if (!record.loaded) warnOnce(key, `Optional ${race.name} ${action} sprite sheet has invalid dimensions (${image.naturalWidth}x${image.naturalHeight}; expected at least ${requiredWidth}x${requiredHeight}): ${path}. Procedural fallback remains active.`);
            resolve(record);
          };
          image.onerror = () => {
            record.failed = true;
            warnOnce(key, `Optional ${race.name} ${action} sprite sheet is unavailable: ${path}. Procedural fallback remains active.`);
            resolve(record);
          };
          image.src = path;
        }));
      }
    }
    return Promise.all(pending);
  }

  function directionRow(actor) {
    const animationSystem = DR.render.HumanoidAnimationSystem;
    const explicitRow = actor?.directionRow ?? actor?.spriteDirectionRow ?? actor?.facingRow ?? actor?.directionIndex;
    if (Number.isInteger(Number(explicitRow)) && Number(explicitRow) >= 0 && Number(explicitRow) <= 7) return Number(explicitRow);
    const explicitName = animationSystem?.normalizeDirectionName?.(actor?.facingName || actor?.direction || actor?.facingDirection);
    const name = explicitName || animationSystem?.directionFromVector?.(actor?.facingX, actor?.facingY, 'south') || 'south';
    return directionRows[name] ?? 1;
  }

  function resolveSpriteFrame(actor, nowMs = performance.now()) {
    const raceId = String(actor?.raceId || '').toLowerCase();
    const action = normalizeAction(actor);
    const race = raceConfig(raceId);
    const animation = getAnimationConfig(raceId, action);
    if (!race || !animation) return null;
    const parts=variantParts(actor),record=ensureSheet(actor,action,animation,race);
    if(!record?.loaded)return null;
    const frameCount = Math.max(1, Math.floor(Number(animation.frames) || 1));
    const fps = Math.max(0.01, Number(animation.fps) || 1);
    let column;
    if (animation.holdLastFrame && (actor?.alive === false || actor?.dead || actor?.isDead)) {
      const progress = Number(actor?.deathProgress);
      column = Number.isFinite(progress) && progress > 0
        ? Math.min(frameCount - 1, Math.floor(progress * frameCount))
        : frameCount - 1;
    } else {
      const phaseOffset = (Number(actor?.id) || 0) * 0.173;
      column = Math.floor((Math.max(0, Number(nowMs) || 0) * 0.001 + phaseOffset) * fps) % frameCount;
    }
    const row = directionRow(actor);
    return {
      image: record.image,
      raceId,
      action,
      row,
      column,
      sx: column * race.frameWidth,
      sy: row * race.frameHeight,
      sw: race.frameWidth,
      sh: race.frameHeight,
      animation,
      config: race
    };
  }

  function canDraw(actor) {
    const raceId=String(actor?.raceId||'').toLowerCase();
    if (!raceConfig(raceId)) return false;
    return Boolean(resolveSpriteFrame(actor, typeof performance !== 'undefined' ? performance.now() : Date.now()));
  }

  function drawSpritePaperdoll(ctx,actor,nowMs,targetHeight,layer){
    const Gear=DR.render.PaperdollEquipmentRenderer,raceModel=DR.render.RaceIdentityProceduralModel,Anim=DR.render.HumanoidAnimationSystem;
    if(!Gear||!raceModel?.buildRaceRig||!Anim?.buildPose)return;
    const pose=Anim.buildPose(actor,nowMs),palette=DR.getRaceDefinition?.(actor.raceId)?.palettes?.[DR.normalizeRacePaletteId?.(actor.raceId,actor.racePaletteId)]||{},rig=raceModel.buildRaceRig(actor,pose,palette),scale=(targetHeight/256)*1.72,x=Number(actor.screenX)||0,y=Number(actor.screenY)||0;
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.translate(-x,-y);
    if(layer==='back')Gear.drawBodyLayer?.(ctx,rig,'back','back');
    else {for(const name of ['legs','torso'])Gear.drawBodyLayer?.(ctx,rig,name);Gear.drawBodyLayer?.(ctx,rig,'back','front');Gear.drawBodyLayer?.(ctx,rig,'arm','far');Gear.drawBodyLayer?.(ctx,rig,'offhand');Gear.drawBodyLayer?.(ctx,rig,'head');Gear.drawBodyLayer?.(ctx,rig,'arm','near');Gear.drawBodyLayer?.(ctx,rig,'weapon');if(!Gear.hasAny?.(actor))Gear.drawActivityTool?.(ctx,rig);}
    ctx.restore();
  }

  function draw(ctx, actor, nowMs) {
    if (!ctx || !actor) return false;
    const frame = resolveSpriteFrame(actor, nowMs);
    if (!frame) return false;
    const x = Number(actor.screenX) || 0;
    const y = Number(actor.screenY) || 0;
    const preview = actor.kind === 'preview';
    const largePreview = actor.previewMode === true;
    const previewWidth = Number(actor.previewWidth) || frame.sw;
    const previewHeight = Number(actor.previewHeight) || frame.sh;
    const configuredScale = preview ? Number(frame.config.creatorScale || 1) : Number(frame.config.worldScale || 1);
    const desiredHeight = (preview
      ? largePreview
        ? Math.max(128, Math.min(previewHeight * 0.80, previewWidth * 0.90))
        : Math.max(32, Math.min(previewHeight, previewWidth) * 0.88)
      : Math.max(82, Math.min(132, Number(actor.spriteDisplayHeight) || 108))) * Math.max(0.25, Math.min(2.5, configuredScale));
    const targetHeight = preview ? Math.min(previewHeight * 0.94, desiredHeight) : desiredHeight;
    const aspect = frame.sw / Math.max(1, frame.sh);
    const targetWidth = targetHeight * aspect;
    const footInset = preview ? targetHeight * 0.035 : targetHeight * 0.04;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    drawSpritePaperdoll(ctx,actor,nowMs,targetHeight,'back');
    ctx.drawImage(
      frame.image,
      frame.sx, frame.sy, frame.sw, frame.sh,
      x - targetWidth * 0.5, y - targetHeight + footInset,
      targetWidth, targetHeight
    );
    DR.Hairstyles?.drawSpriteOverlay?.(ctx, actor, { x, y, width: targetWidth, height: targetHeight });
    drawSpritePaperdoll(ctx,actor,nowMs,targetHeight,'front');
    ctx.restore();
    return true;
  }

  DR.render.RaceSpriteSheetRenderer = Object.freeze({
    canDraw,
    draw,
    preload,
    getAnimationConfig,
    resolveFrame: resolveSpriteFrame,
    resolveSpriteFrame,
    hasLoadedSheet
    ,spritePath,variantParts,normalizeAction,drawSpritePaperdoll
  });

  // Optional assets begin loading without blocking startup or creator setup.
  preload();
})();
