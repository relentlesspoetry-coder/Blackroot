(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  // V0.20.57: memoized text measurement. The V0.17.96 nameplate image cache hits ~91% of the time,
  // but it is checked AFTER the layout block has already run three ctx.measureText() calls and two
  // ctx.font assignments per plate - and the ctx.restore() just below discards that font state
  // anyway. So every cached plate still paid full measurement: ~66 measureText calls per frame at
  // 22 plates. Widths are a pure function of (font, string), so memoize them and only touch
  // ctx.font on an actual miss.
  const TEXT_WIDTH_CACHE = new Map();
  function measuredTextWidth(context, font, text) {
    const key = `${font}\u0000${text}`;
    const hit = TEXT_WIDTH_CACHE.get(key);
    if (hit !== undefined) return hit;
    context.font = font;
    const width = context.measureText(text).width;
    if (TEXT_WIDTH_CACHE.size < 4096) TEXT_WIDTH_CACHE.set(key, width);
    return width;
  }

  class EntityRendererMethods {
      entityFacingView(e) {
        const fx = e.facingX ?? (e.facing >= 0 ? 1 : -1);
        const fy = e.facingY ?? 0;
        const c = Math.cos(this.camera.yaw || 0);
        const s = Math.sin(this.camera.yaw || 0);
        const cx = fx * c - fy * s;
        const cy = fx * s + fy * c;
        const screenX = cx - cy;
        const screenY = cx + cy;
        let mode = 'side';
        if (Math.abs(screenY) > Math.abs(screenX) * 1.22) mode = screenY < 0 ? 'back' : 'front';
        return { mode, side: screenX >= 0 ? 1 : -1, screenX, screenY };
      }


      isBardClassActor(e) {
        const mercMap = { guardian: 'Paladin', cleric: 'Cleric', adept: 'Wizard', scout: 'Ranger' };
        const roleClass = e?.kind === 'merc' ? (mercMap[e.roleKey] || '') : '';
        return String(e?.className || roleClass || '').toLowerCase() === 'bard';
      }

      isDruidClassActor(e) {
        const mercMap = { guardian: 'Paladin', cleric: 'Cleric', adept: 'Wizard', scout: 'Ranger' };
        const roleClass = e?.kind === 'merc' ? (mercMap[e.roleKey] || '') : '';
        return String(e?.className || roleClass || '').toLowerCase() === 'druid';
      }


      isEntitySwimming(e) {
        if (!e) return false;
        const action = String(e.action || '').toLowerCase();
        const swimState = String(e.swimState || '').toLowerCase();
        // Rendering submersion is bound to the authoritative swim state only.
        // `inWater` by itself may be reused by shallow-water/ankle-wet effects and
        // must not hide the lower body.
        return !!(e.swimming || action === 'swim' || action === 'swimming' || swimState === 'swimming' || swimState === 'treading');
      }

      isEntityEmoting(e) {
        const action = String(e?.emoteState || e?.action || '').toLowerCase();
        return !!(e && e.emoteActive && (action === 'dance' || action === 'sit'));
      }

      resolveActorVisualEquipment(e) {
        if (!e) return null;
        if (e.kind === 'player' || e === this.player || e.isPlayer) return this.equipment || e.equipment || null;
        if (e.kind === 'bot') return e.botEquipment || e.equipment || null;
        if (e.kind === 'merc') return e.equipment || null;
        if (e.kind === 'remotePlayer') return e.equipment || e.visualEquipment || null;
        return e.equipment || e.botEquipment || e.visualEquipment || null;
      }

      actorSlotItem(e, slot) {
        const eq = this.resolveActorVisualEquipment?.(e);
        if (!eq || typeof eq !== 'object') return null;
        if (eq[slot]) return eq[slot];
        const aliases = slot === 'weapon'
          ? ['mainHand', 'mainhand', 'main_hand', 'primary', 'rightHand', 'right_hand']
          : slot === 'offhand'
            ? ['offHand', 'off_hand', 'secondary', 'leftHand', 'left_hand']
            : [];
        for (const alias of aliases) {
          if (eq[alias]) return eq[alias];
        }
        return null;
      }

      actorHasEquippedWeapon(e) {
        return !!this.actorSlotItem?.(e, 'weapon');
      }

      actorHasEquippedOffhand(e) {
        return !!this.actorSlotItem?.(e, 'offhand');
      }

      swimMovementAmount(e) {
        if (!e) return 0;
        const explicit = Number(e.swimMovement);
        if (Number.isFinite(explicit)) return Math.max(0, Math.min(1, explicit));
        const velocity = Math.hypot(Number(e.vx) || 0, Number(e.vy) || 0) * 0.08;
        return Math.max(0, Math.min(1, velocity + Number(e.moveBlend || 0)));
      }

      renderActionForHumanoid(e, options = {}) {
        if (!e || !e.alive) return 'death';
        if (e.meditating) return 'meditate';
        if (this.isEntityEmoting?.(e)) return String(e.emoteState || e.action || '').toLowerCase();
        if (e.gathering) return 'gathering';
        if (e.fishing) return 'fishing';
        if (Number(e.spellCastAnim || 0) > 0.05) return options.bard ? 'performing' : 'cast';
        if (Number(e.attackAnim || 0) > 0.02) return 'attack';
        if (e.autoAttack && e.autoAttackVisualActive) {
          const type = String(e.autoAttackVisualType || '').toLowerCase();
          return type === 'caster' || type === 'ranged' || type === 'cast' ? (options.bard ? 'performing' : 'cast') : 'attack';
        }
        if (this.isEntitySwimming(e)) return 'swim';
        // V0.20.69 (Roadmap Item 7.G): models that pass an EXPLICIT action (Bard, Druid, and the
        // shared humanoid path) would otherwise report 'walk'/'idle' while mounted, overriding the
        // 'ride' action resolveAction derives - so those two classes stayed standing while the other
        // twelve seated correctly. Placed below swim because swimming dismounts you anyway.
        if (e.mounted) return 'ride';
        return e.action || '';
      }

      applySwimmingRenderState(actor, e) {
        actor.swimming = this.isEntitySwimming(e);
        actor.inWater = actor.swimming;
        actor.swimAnim = Number(e?.swimAnim || 0);
        actor.swimMovement = this.swimMovementAmount(e);
        actor.swimBlend = Number.isFinite(Number(e?.swimBlend)) ? Number(e.swimBlend) : (actor.swimming ? 1 : 0);
        actor.swimSubmerge = Number.isFinite(Number(e?.swimSubmerge)) ? Number(e.swimSubmerge) : 0.52;
        actor.waterDepthMax = Number(e?.waterDepthMax || 0);
        return actor;
      }


      drawScaledModelSafely(actor, scale, drawFn) {
        const safeX = Number.isFinite(Number(actor?.screenX)) ? Number(actor.screenX) : 0;
        const safeY = Number.isFinite(Number(actor?.screenY)) ? Number(actor.screenY) : 0;
        const safeScale = Number.isFinite(Number(scale)) ? Math.max(0.25, Math.min(3.25, Number(scale))) : 1;
        if (actor) {
          actor.screenX = safeX;
          actor.screenY = safeY;
        }
        ctx.save();
        try {
          ctx.imageSmoothingEnabled = false;
          try { ctx.filter = 'none'; } catch (_err) {}
          ctx.translate(safeX, safeY);
          ctx.scale(safeScale, safeScale);
          ctx.translate(-safeX, -safeY);
          drawFn();
          return true;
        } catch (err) {
          const source = actor?.sourceEntity || actor;
          if (source) {
            source._lastRendererError = err?.message || String(err || 'render error');
            source._lastRendererErrorAt = performance.now();
          }
          if (!this._rendererErrorLog) this._rendererErrorLog = new Set();
          const key = `${actor?.className || actor?.rendererId || actor?.kind || 'entity'}:${err?.message || err}`;
          if (!this._rendererErrorLog.has(key)) {
            this._rendererErrorLog.add(key);
            console.warn('[DreamRealms] model renderer failed; falling back to legacy draw path', key, err);
          }
          return false;
        } finally {
          ctx.restore();
        }
      }

      // The runtime sprite cache bakes procedural models into a small bounded
      // flip-book (e.g. idle = 2 frames), which is invisible on the distant
      // crowd but reads as "frozen" on the player and whatever is right next to
      // them. Render those live at full framerate; keep the cache for the rest.
      shouldRenderModelLive(actor) {
        const src = actor?.sourceEntity || actor;
        if (src === this.player || actor?.kind === 'player' || actor?.isPlayer || src?.kind === 'player') return true;
        const player = this.player;
        if (!player) return false;
        const perf = this.performanceSettings?.() || DR.CONFIG?.PERFORMANCE || {};
        const liveRadius = Number(perf.spriteCacheLiveRadius);
        if (!(liveRadius > 0)) return false;
        const ex = Number(src?.x);
        const ey = Number(src?.y);
        if (!Number.isFinite(ex) || !Number.isFinite(ey)) return false;
        const dx = ex - player.x;
        const dy = ey - player.y;
        return (dx * dx + dy * dy) <= liveRadius * liveRadius;
      }

      drawCachedModelOrFallback(actor, model, scale = 1, options = {}) {
        if (!actor || !model?.draw) return false;
        const safeX = Number.isFinite(Number(actor.screenX)) ? Number(actor.screenX) : 0;
        const safeY = Number.isFinite(Number(actor.screenY)) ? Number(actor.screenY) : 0;
        actor.screenX = safeX;
        actor.screenY = safeY;
        const debugFacing = !!(actor.debugFacing || this.debugMode || this.showFacingDebug);
        const cacheAllowed = !debugFacing && !this.shouldRenderModelLive(actor)
          && this.runtimeSpriteCache?.drawModel && DR.CONFIG?.PERFORMANCE?.enableSpriteCache !== false;
        if (cacheAllowed) {
          const drewCached = this.runtimeSpriteCache.drawModel(ctx, actor, model, {
            ...options,
            scale,
            screenX: safeX,
            screenY: safeY,
            nowMs: performance.now()
          });
          if (drewCached) return true;
        }
        return this.drawScaledModelSafely(actor, scale, () => model.draw(ctx, actor, performance.now()));
      }

      isMercIdentityActor(e) {
        const model = window.DreamRealms?.render?.MercNpcIdentityProceduralModel || window.MercNpcIdentityProceduralModel;
        return e?.kind === 'merc' && !!model?.canDraw && model.canDraw(e);
      }

      drawMercIdentityModel(e, foot, scale = 1) {
        const model = window.DreamRealms?.render?.MercNpcIdentityProceduralModel || window.MercNpcIdentityProceduralModel;
        if (!model?.draw) return false;
        const actor = {
          ...e,
          sourceEntity: e,
          equipment: this.resolveActorVisualEquipment?.(e) || null,
          visualEquipment: this.resolveActorVisualEquipment?.(e) || null,
          screenX: foot.x,
          screenY: foot.y,
          facingName: this.actorFacingName(e),
          isMoving: (e.moveBlend || 0) > 0.08 || Math.abs(e.vx || 0) + Math.abs(e.vy || 0) > 0.01,
          action: this.renderActionForHumanoid(e),
          emoteActive: !!e.emoteActive,
          emoteState: e.emoteState || '',
          emoteAnim: Number(e.emoteAnim || 0),
          meditating: !!e.meditating,
          gathering: !!e.gathering,
          gatheringProgress: Number(e.gatheringProgress || 0),
          gatheringKind: e.gatheringKind || '',
          swimming: this.isEntitySwimming(e),
          inWater: this.isEntitySwimming(e),
          swimAnim: Number(e.swimAnim || 0),
          swimMovement: this.swimMovementAmount(e),
          swimBlend: Number(e.swimBlend || (this.isEntitySwimming(e) ? 1 : 0)),
          swimSubmerge: Number(e.swimSubmerge || 0.52),
          attackAnim: Number(e.attackAnim || 0),
          spellCastAnim: Number(e.spellCastAnim || 0),
          autoAttack: !!e.autoAttack,
          autoAttackVisualActive: !!e.autoAttackVisualActive,
          autoAttackVisualType: e.autoAttackVisualType || '',
          autoAttackVisualClass: e.autoAttackVisualClass || e.className || '',
          autoAttackVisualRole: e.autoAttackVisualRole || '',
          autoAttackVisualPhase: Number(e.autoAttackVisualPhase || 0),
          autoAttackVisualPulse: Number(e.autoAttackVisualPulse || 0),
          hitAnim: Number(e.hitAnim || e.hitReaction || e.damageAnim || 0),
          deathProgress: !e.alive ? 1 : Number(e.deathProgress || 0),
          debugFacing: !!(this.debugOverlayOpen || this.debugMode || this.showFacingDebug)
        };

        const drew = this.drawCachedModelOrFallback(actor, model, scale, { rendererId: 'merc_identity', bounds: 'humanoid' });
        if (!drew) return false;

        if (!e._nameplateAnchor) {
          e._nameplateAnchor = {
            x: foot.x,
            y: foot.y - (e.meditating ? 83 : 93) * scale
          };
        }
        return true;
      }

      isClassIdentityActor(e) {
        const model = window.DreamRealms?.render?.ClassIdentityProceduralModel || window.ClassIdentityProceduralModel;
        if (!model?.canDraw) return false;
        const mercMap = { guardian: 'Paladin', cleric: 'Cleric', fieldcleric: 'Cleric', adept: 'Wizard', scout: 'Ranger' };
        const roleClass = e?.kind === 'merc' ? (mercMap[String(e.roleKey || '').toLowerCase()] || '') : '';
        return model.canDraw({ ...e, className: e?.className || roleClass });
      }

      isRaceIdentityActor(e) {
        const model = window.DreamRealms?.render?.RaceIdentityProceduralModel || window.RaceIdentityProceduralModel;
        return Boolean(model?.canDraw?.(e));
      }

      isRaceSpriteSheetActor(e) {
        const model = window.DreamRealms?.render?.RaceSpriteSheetRenderer;
        return Boolean(model?.canDraw?.(e));
      }

      drawRaceSpriteSheetModel(e, foot, scale = 1) {
        const model = window.DreamRealms?.render?.RaceSpriteSheetRenderer;
        if (!model?.draw || !model.canDraw?.(e)) return false;
        const actor = {
          ...e,
          sourceEntity:e,
          screenX:foot.x,
          screenY:foot.y,
          facingName:this.actorFacingName(e),
          isMoving:(e.moveBlend||0)>.08||Math.abs(e.vx||0)+Math.abs(e.vy||0)>.01,
          action:this.renderActionForHumanoid(e),
          meditating:!!e.meditating,
          swimming:this.isEntitySwimming(e),
          inWater:this.isEntitySwimming(e),
          attackAnim:Number(e.attackAnim||0),
          spellCastAnim:Number(e.spellCastAnim||0),
          hitAnim:Number(e.hitAnim||e.hitReaction||e.damageAnim||0),
          deathProgress:!e.alive?1:Number(e.deathProgress||0),
          spriteDisplayHeight:108
        };
        // Sprite sheets already contain animation frames, so bypass the procedural
        // model cache and draw the current frame through the normal Canvas2D scale.
        const drew=this.drawScaledModelSafely(actor,scale,()=>model.draw(ctx,actor,performance.now()));
        if(drew&&!e._nameplateAnchor)e._nameplateAnchor={x:foot.x,y:foot.y-105*scale};
        return drew;
      }

      drawRaceIdentityModel(e, foot, scale = 1) {
        const model = window.DreamRealms?.render?.RaceIdentityProceduralModel || window.RaceIdentityProceduralModel;
        if (!model?.draw) return false;
        const actor = {
          ...e, sourceEntity:e, equipment:this.resolveActorVisualEquipment?.(e)||null, visualEquipment:this.resolveActorVisualEquipment?.(e)||null,
          screenX:foot.x, screenY:foot.y, facingName:this.actorFacingName(e),
          isMoving:(e.moveBlend||0)>.08||Math.abs(e.vx||0)+Math.abs(e.vy||0)>.01, action:this.renderActionForHumanoid(e),
          meditating:!!e.meditating, swimming:this.isEntitySwimming(e), inWater:this.isEntitySwimming(e), swimAnim:Number(e.swimAnim||0),
          swimMovement:this.swimMovementAmount(e), swimBlend:Number(e.swimBlend||(this.isEntitySwimming(e)?1:0)), swimSubmerge:Number(e.swimSubmerge||.52),
          attackAnim:Number(e.attackAnim||0), spellCastAnim:Number(e.spellCastAnim||0), hitAnim:Number(e.hitAnim||e.hitReaction||0), deathProgress:!e.alive?1:Number(e.deathProgress||0)
        };
        const drew=this.drawCachedModelOrFallback(actor,model,scale,{rendererId:`race_${e.raceId}`,bounds:'humanoid'});
        if(drew&&!e._nameplateAnchor)e._nameplateAnchor={x:foot.x,y:foot.y-(e.raceId==='bogling'?78:86)*scale};
        return drew;
      }

      drawClassIdentityModel(e, foot, scale = 1) {
        const model = window.DreamRealms?.render?.ClassIdentityProceduralModel || window.ClassIdentityProceduralModel;
        if (!model?.draw) return false;
        const mercMap = { guardian: 'Paladin', cleric: 'Cleric', fieldcleric: 'Cleric', adept: 'Wizard', scout: 'Ranger' };
        const roleClass = e?.kind === 'merc' ? (mercMap[String(e.roleKey || '').toLowerCase()] || '') : '';
        const actor = {
          ...e,
          className: e.className || roleClass,
          sourceEntity: e,
          equipment: this.resolveActorVisualEquipment?.(e) || null,
          visualEquipment: this.resolveActorVisualEquipment?.(e) || null,
          screenX: foot.x,
          screenY: foot.y,
          facingName: this.actorFacingName(e),
          isMoving: (e.moveBlend || 0) > 0.08 || Math.abs(e.vx || 0) + Math.abs(e.vy || 0) > 0.01,
          action: this.renderActionForHumanoid(e),
          emoteActive: !!e.emoteActive,
          emoteState: e.emoteState || '',
          emoteAnim: Number(e.emoteAnim || 0),
          meditating: !!e.meditating,
          gathering: !!e.gathering,
          gatheringProgress: Number(e.gatheringProgress || 0),
          gatheringKind: e.gatheringKind || '',
          fishing: !!e.fishing,
          swimming: this.isEntitySwimming(e),
          inWater: this.isEntitySwimming(e),
          swimAnim: Number(e.swimAnim || 0),
          swimMovement: this.swimMovementAmount(e),
          swimBlend: Number(e.swimBlend || (this.isEntitySwimming(e) ? 1 : 0)),
          swimSubmerge: Number(e.swimSubmerge || 0.52),
          attackAnim: Number(e.attackAnim || 0),
          spellCastAnim: Number(e.spellCastAnim || 0),
          hitAnim: Number(e.hitAnim || e.hitReaction || e.damageAnim || 0),
          deathProgress: !e.alive ? 1 : Number(e.deathProgress || 0),
          debugFacing: !!(this.debugOverlayOpen || this.debugMode || this.showFacingDebug),
          fishingAction: e.fishingAction || this.fishingSystem?.active?.action || 'waiting',
          fishingCastTimer: Number(e.fishingCastTimer || this.fishingSystem?.active?.castTimer || 0)
        };

        const drew = this.drawCachedModelOrFallback(actor, model, scale, { rendererId: `class_identity:${actor.className || 'unknown'}`, bounds: 'humanoid' });
        if (!drew) return false;

        if (!e._nameplateAnchor) {
          e._nameplateAnchor = {
            x: foot.x,
            y: foot.y - (e.meditating ? 83 : 93) * scale
          };
        }
        return true;
      }

      actorFacingName(e) {
        const valid = ['north','northeast','east','southeast','south','southwest','west','northwest'];
        const anim = window.DreamRealms?.render?.HumanoidAnimationSystem;
        const directionVectors = {
          north: [0, -1],
          northeast: [1, -1],
          east: [1, 0],
          southeast: [1, 1],
          south: [0, 1],
          southwest: [-1, 1],
          west: [-1, 0],
          northwest: [-1, -1]
        };

        const normalizeName = name => String(name || '').toLowerCase().replace(/[\s_\-]/g, '');
        const hasFiniteVector = (x, y) => Number.isFinite(x) && Number.isFinite(y) && Math.hypot(x, y) > 0.01;
        const rowToName = row => anim?.directionNameForRow
          ? anim.directionNameForRow(row)
          : ['north','south','west','east','northeast','southeast','northwest','southwest'][row] || 'south';
        const rowToLabel = row => anim?.labelForRow ? anim.labelForRow(row) : String(row);
        const cameraYaw = Number(this.camera?.yaw || 0);
        const fallbackRow = Number.isFinite(e?._humanoidSheetRow) ? e._humanoidSheetRow : 1;

        let row = null;
        const fx = Number(e?.facingX);
        const fy = Number(e?.facingY);
        const moving = !!(e && ((e === this.player) || e.isPlayer || e.kind === 'player' || e.kind === 'remotePlayer' || e.kind === 'bot' || e.kind === 'merc' || e.kind === 'enemy' || e.kind === 'pet' || Number(e.moveBlend || 0) > 0.04 || Math.abs(e.vx || 0) + Math.abs(e.vy || 0) > 0.001));

        /*
         * V0.13.14: dynamic actor facing is screen/camera-relative, not raw
         * world-direction-name driven. WASD movement is already camera-relative;
         * after camera rotation the saved world vector must be projected through
         * the same camera transform used by worldToScreen. This keeps the model
         * front-facing when moving toward the bottom of the screen and back-facing
         * when moving toward the top of the screen, regardless of camera yaw.
         */
        if (moving && hasFiniteVector(fx, fy)) {
          row = anim?.getDirectionIndexFromWorldVector
            ? anim.getDirectionIndexFromWorldVector(fx, fy, cameraYaw, fallbackRow)
            : this.fallbackCanonicalDirectionRowFromVector(fx, fy, cameraYaw, fallbackRow);
        }

        if (row == null) {
          let explicit = normalizeName(e?.facingName || '');
          if (!valid.includes(explicit)) explicit = '';
          const vec = explicit ? directionVectors[explicit] : null;
          if (vec) {
            row = anim?.getDirectionIndexFromWorldVector
              ? anim.getDirectionIndexFromWorldVector(vec[0], vec[1], cameraYaw, fallbackRow)
              : this.fallbackCanonicalDirectionRowFromVector(vec[0], vec[1], cameraYaw, fallbackRow);
          }
        }

        if (row == null && hasFiniteVector(fx, fy)) {
          row = anim?.getDirectionIndexFromWorldVector
            ? anim.getDirectionIndexFromWorldVector(fx, fy, cameraYaw, fallbackRow)
            : this.fallbackCanonicalDirectionRowFromVector(fx, fy, cameraYaw, fallbackRow);
        }

        if (row == null) {
          const face = Number(e?.facing || 1);
          const vec = face < 0 ? [-1, 0] : [1, 0];
          row = anim?.getDirectionIndexFromWorldVector
            ? anim.getDirectionIndexFromWorldVector(vec[0], vec[1], cameraYaw, fallbackRow)
            : this.fallbackCanonicalDirectionRowFromVector(vec[0], vec[1], cameraYaw, fallbackRow);
        }

        const directionName = rowToName(row);

        if (e) {
          e._humanoidSheetRow = row;
          e._humanoidSheetDirection = rowToLabel(row);
        }
        return directionName;
      }

      fallbackCanonicalDirectionRow(characterWorldAngleDeg, cameraAngleDeg) {
        const relative = ((characterWorldAngleDeg - cameraAngleDeg) % 360 + 360) % 360;
        if (relative >= 337.5 || relative < 22.5) return 0;
        if (relative < 67.5) return 4;
        if (relative < 112.5) return 3;
        if (relative < 157.5) return 5;
        if (relative < 202.5) return 1;
        if (relative < 247.5) return 7;
        if (relative < 292.5) return 2;
        return 6;
      }

      fallbackCanonicalDirectionRowFromVector(facingX, facingY, cameraYawRad = 0, fallbackRow = 1) {
        const fx = Number(facingX) || 0;
        const fy = Number(facingY) || 0;
        if (Math.abs(fx) < 0.01 && Math.abs(fy) < 0.01) return fallbackRow;
        const c = Math.cos(Number(cameraYawRad) || 0);
        const s = Math.sin(Number(cameraYawRad) || 0);
        const cx = fx * c - fy * s;
        const cy = fx * s + fy * c;
        const screenX = cx - cy;
        const screenY = cx + cy;
        const angle = Math.atan2(screenY, screenX) * 180 / Math.PI;
        if (angle >= -22.5 && angle < 22.5) return 3;
        if (angle >= 22.5 && angle < 67.5) return 5;
        if (angle >= 67.5 && angle < 112.5) return 1;
        if (angle >= 112.5 && angle < 157.5) return 7;
        if (angle >= 157.5 || angle < -157.5) return 2;
        if (angle >= -157.5 && angle < -112.5) return 6;
        if (angle >= -112.5 && angle < -67.5) return 0;
        return 4;
      }

      drawBardClassModel(e, foot, scale = 1) {
        const model = window.DreamRealms?.render?.BardProceduralModel || window.BardProceduralModel;
        if (!model?.draw) return false;
        const actor = {
          ...e,
          sourceEntity: e,
          equipment: this.resolveActorVisualEquipment?.(e) || null,
          visualEquipment: this.resolveActorVisualEquipment?.(e) || null,
          screenX: foot.x,
          screenY: foot.y,
          facingName: this.actorFacingName(e),
          isMoving: (e.moveBlend || 0) > 0.08 || Math.abs(e.vx || 0) + Math.abs(e.vy || 0) > 0.01,
          action: this.renderActionForHumanoid(e, { bard: true }),
          emoteActive: !!e.emoteActive,
          emoteState: e.emoteState || '',
          emoteAnim: Number(e.emoteAnim || 0),
          bardAction: e.bardAction || (Number(e.spellCastAnim || 0) > 0.05 ? 'performing' : (this.isEntitySwimming(e) ? 'swim' : '')),
          meditating: !!e.meditating,
          gathering: !!e.gathering,
          gatheringProgress: Number(e.gatheringProgress || 0),
          gatheringKind: e.gatheringKind || '',
          fishing: !!e.fishing,
          swimming: this.isEntitySwimming(e),
          inWater: this.isEntitySwimming(e),
          swimAnim: Number(e.swimAnim || 0),
          swimMovement: this.swimMovementAmount(e),
          swimBlend: Number(e.swimBlend || (this.isEntitySwimming(e) ? 1 : 0)),
          swimSubmerge: Number(e.swimSubmerge || 0.52),
          attackAnim: Number(e.attackAnim || 0),
          spellCastAnim: Number(e.spellCastAnim || 0),
          hitAnim: Number(e.hitAnim || e.hitReaction || e.damageAnim || 0),
          deathProgress: !e.alive ? 1 : Number(e.deathProgress || 0),
          debugFacing: !!(this.debugOverlayOpen || this.debugMode || this.showFacingDebug),
          fishingAction: e.fishingAction || this.fishingSystem?.active?.action || 'waiting',
          fishingCastTimer: Number(e.fishingCastTimer || this.fishingSystem?.active?.castTimer || 0)
        };

        const drew = this.drawCachedModelOrFallback(actor, model, scale, { rendererId: 'bard_class', bounds: 'humanoid' });
        if (!drew) return false;

        if (!e._nameplateAnchor) {
          e._nameplateAnchor = {
            x: foot.x,
            y: foot.y - (e.meditating ? 83 : 93) * scale
          };
        }
        return true;
      }

      drawDruidClassModel(e, foot, scale = 1) {
        const model = window.DreamRealms?.render?.DruidProceduralModel || window.DruidProceduralModel;
        if (!model?.draw) return false;
        const actor = {
          ...e,
          sourceEntity: e,
          equipment: this.resolveActorVisualEquipment?.(e) || null,
          visualEquipment: this.resolveActorVisualEquipment?.(e) || null,
          screenX: foot.x,
          screenY: foot.y,
          facingName: this.actorFacingName(e),
          isMoving: (e.moveBlend || 0) > 0.08 || Math.abs(e.vx || 0) + Math.abs(e.vy || 0) > 0.01,
          action: this.renderActionForHumanoid(e),
          emoteActive: !!e.emoteActive,
          emoteState: e.emoteState || '',
          emoteAnim: Number(e.emoteAnim || 0),
          meditating: !!e.meditating,
          gathering: !!e.gathering,
          gatheringProgress: Number(e.gatheringProgress || 0),
          gatheringKind: e.gatheringKind || '',
          fishing: !!e.fishing,
          swimming: this.isEntitySwimming(e),
          inWater: this.isEntitySwimming(e),
          swimAnim: Number(e.swimAnim || 0),
          swimMovement: this.swimMovementAmount(e),
          swimBlend: Number(e.swimBlend || (this.isEntitySwimming(e) ? 1 : 0)),
          swimSubmerge: Number(e.swimSubmerge || 0.52),
          attackAnim: Number(e.attackAnim || 0),
          spellCastAnim: Number(e.spellCastAnim || 0),
          hitAnim: Number(e.hitAnim || e.hitReaction || e.damageAnim || 0),
          deathProgress: !e.alive ? 1 : Number(e.deathProgress || 0),
          debugFacing: !!(this.debugOverlayOpen || this.debugMode || this.showFacingDebug),
          fishingAction: e.fishingAction || this.fishingSystem?.active?.action || 'waiting',
          fishingCastTimer: Number(e.fishingCastTimer || this.fishingSystem?.active?.castTimer || 0)
        };

        const drew = this.drawCachedModelOrFallback(actor, model, scale, { rendererId: 'druid_class', bounds: 'humanoid' });
        if (!drew) return false;

        if (!e._nameplateAnchor) {
          e._nameplateAnchor = {
            x: foot.x,
            y: foot.y - (e.meditating ? 83 : 93) * scale
          };
        }
        return true;
      }



      isSilkWebSpiderActor(e) {
        const model = window.DreamRealms?.render?.SilkWebSpiderProceduralModel || window.SilkWebSpiderProceduralModel;
        return e?.kind === 'enemy' && !!model?.canDraw && model.canDraw(e);
      }

      drawSilkWebSpiderModel(e, foot, scale = 1, dead = false) {
        const model = window.DreamRealms?.render?.SilkWebSpiderProceduralModel || window.SilkWebSpiderProceduralModel;
        if (!model?.draw) return false;
        const actor = {
          ...e,
          sourceEntity: e,
          rendererId: 'silk_web_spider',
          spiderRole: e.spiderRole || e.baseType?.spiderRole || model.roleFor?.(e),
          screenX: foot.x,
          screenY: foot.y,
          facingName: this.actorFacingName?.(e) || e.facingName || 'south',
          isMoving: !dead && ((e.moveBlend || 0) > 0.08 || Math.abs(e.vx || 0) + Math.abs(e.vy || 0) > 0.01),
          alive: dead ? false : e.alive,
          attackAnim: Number(e.attackAnim || 0),
          spellCastAnim: Number(e.spellCastAnim || 0),
          hitAnim: Number(e.hitAnim || e.hitReaction || e.damageAnim || 0)
        };
        // V0.18.38/41: spiders render at varied modelScale (baby/little/big variants). The
        // sprite cache keys by rendererId and bakes modelScale INTO the bitmap, so bucket
        // by size or a small baby would share (and inherit the size of) the full-grown
        // skitterer sprite.
        // V0.18.48: key the sprite cache by the QUANTIZED modelScale (0.1 steps) rather than
        // a coarse xs/s/m/xl bucket. The old buckets baked ONE bitmap per bucket, so a tiny
        // 0.32 hatchling and a 0.5 skitterer both landed in 'xs' and the first one cached won
        // - i.e. shrinking a baby's modelScale did nothing. Quantizing gives each distinct
        // size its own baked bitmap (only ~6 sizes are ever used) so babies actually render tiny.
        const spiderMs = Number(e.modelScale || e.scale || 1);
        const sizeBucket = 'q' + Math.round(Math.max(0.2, Math.min(2.6, spiderMs)) * 10);
        const drew = this.drawCachedModelOrFallback(actor, model, scale, { rendererId: `spider:${actor.spiderRole || 'default'}:${sizeBucket}`, bounds: e.dungeonBoss ? 'boss' : 'spider' });
        if (!drew) return false;
        e._nameplateAnchor = actor._nameplateAnchor || { x: foot.x, y: foot.y - (e.dungeonBoss ? 98 : e.dungeonMiniBoss ? 82 : 66) * scale };
        return true;
      }


      isDarkWoodsMobVisualActor(e) {
        const model = window.DreamRealms?.render?.DarkWoodsMobProceduralModel || window.DarkWoodsMobProceduralModel;
        return e?.kind === 'enemy' && !!model?.canDraw && model.canDraw(e);
      }

      drawDarkWoodsMobVisualModel(e, foot, scale = 1, dead = false) {
        const model = window.DreamRealms?.render?.DarkWoodsMobProceduralModel || window.DarkWoodsMobProceduralModel;
        if (!model?.draw) return false;
        const moving = !dead && ((e.moveBlend || 0) > 0.08 || Math.abs(e.vx || 0) + Math.abs(e.vy || 0) > 0.01);
        // Phase 17 (Atmosphere / Time-of-Day): wisps read as ghost-lights that
        // brighten at night. The mob's procedural body is sprite-cached, so this
        // live, uncached halo is drawn behind it here (where the shared world
        // light state is available) instead of baked into the cached model.
        // Only living wisp-family mobs get it, and it is inherently camera-culled
        // because this method only runs for on-screen entities.
        if (!dead && e.alive && String(e.family || e.baseType?.family || '').toLowerCase() === 'wisp') {
          const light = this.getWorldLightState?.() || null;
          const night = Math.max(0, Math.min(1, Number(light?.nightStrength) || 0));
          if (night > 0.05) {
            const gx = foot.x;
            const gy = foot.y - 44 * scale;
            const rad = 34 * scale;
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = 0.10 + night * 0.30;
            const g = ctx.createRadialGradient(gx, gy, 2, gx, gy, rad);
            g.addColorStop(0, 'rgba(180,232,255,0.55)');
            g.addColorStop(0.5, 'rgba(120,200,235,0.22)');
            g.addColorStop(1, 'rgba(80,150,200,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(gx, gy, rad, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
        const actor = {
          ...e,
          sourceEntity: e,
          equipment: this.resolveActorVisualEquipment?.(e) || null,
          visualEquipment: this.resolveActorVisualEquipment?.(e) || null,
          screenX: foot.x,
          screenY: foot.y,
          facingName: this.actorFacingName?.(e) || e.facingName || 'south',
          isMoving: moving,
          alive: dead ? false : e.alive,
          dead: dead || !e.alive,
          action: dead || !e.alive ? 'death' : (Number(e.hitAnim || e.hitReaction || e.damageAnim || 0) > 0.02 ? 'hit' : (Number(e.spellCastAnim || 0) > 0.05 ? 'cast' : (Number(e.attackAnim || 0) > 0.02 ? 'attack' : (moving ? 'walk' : 'idle')))),
          attackAnim: Number(e.attackAnim || 0),
          spellCastAnim: Number(e.spellCastAnim || 0),
          hitAnim: Number(e.hitAnim || e.hitReaction || e.damageAnim || 0),
          visualScale: e.visualScale || e.baseType?.visualScale || 1,
          mobVisualKey: e.mobVisualKey || e.baseType?.mobVisualKey || e.visualKey || e.baseType?.visualKey,
          rendererId: e.rendererId || e.baseType?.rendererId,
          family: e.family || e.baseType?.family
        };
        const drew = this.drawCachedModelOrFallback(actor, model, scale, { rendererId: `dark_woods_mob:${actor.mobVisualKey || actor.family || actor.rendererId || 'default'}`, bounds: e.dungeonBoss ? 'boss' : 'mob' });
        if (!drew) return false;
        if (actor._wolfDedicatedRenderer) {
          const wolfModel = window.DreamRealms?.render?.WolfProceduralModel || window.WolfProceduralModel;
          e._nameplateAnchor = {
            x: foot.x,
            y: foot.y - (dead || !e.alive ? 50 : (wolfModel?.anchorHeight?.(actor) || 91)) * scale
          };
        } else if (actor._rotlingDedicatedRenderer) {
          const rotlingModel = window.DreamRealms?.render?.RotlingProceduralModel || window.RotlingProceduralModel;
          e._nameplateAnchor = {
            x: foot.x,
            y: foot.y - (dead || !e.alive ? 48 : (rotlingModel?.anchorHeight?.(actor) || 82)) * scale
          };
        } else if (actor._boarDedicatedRenderer) {
          const boarModel = window.DreamRealms?.render?.BoarProceduralModel || window.BoarProceduralModel;
          e._nameplateAnchor = {
            x: foot.x,
            y: foot.y - (dead || !e.alive ? 52 : (boarModel?.anchorHeight?.(actor) || 88)) * scale
          };
        } else {
          e._nameplateAnchor = actor._nameplateAnchor || { x: foot.x, y: foot.y - (dead || !e.alive ? 50 : 86) * scale };
        }
        e._darkWoodsMobVisualKey = actor._darkWoodsMobVisualKey;
        e._darkWoodsMobRenderer = actor._darkWoodsMobRenderer;
        e._darkWoodsMobAction = actor._darkWoodsMobAction;
        e._wolfDedicatedRenderer = !!actor._wolfDedicatedRenderer;
        e._boarDedicatedRenderer = !!actor._boarDedicatedRenderer;
        e._rotlingDedicatedRenderer = !!actor._rotlingDedicatedRenderer;
        e._rotlingVisualKey = actor._rotlingVisualKey;
        return true;
      }

      isWolfEnemyActor(e) {
        const text = String([
          e?.rendererId,
          e?.mobType,
          e?.species,
          e?.type,
          e?.name,
          e?.baseType?.name,
          e?.baseType?.rendererId,
          e?.family,
          e?.baseType?.family,
          e?.mobVisualKey,
          e?.baseType?.mobVisualKey
        ].filter(Boolean).join(' ')).toLowerCase();
        return e?.kind === 'enemy' && (text.includes('wolf') || text.includes('mossfang') || e?.rendererId === 'wolf' || e?.baseType?.rendererId === 'wolf');
      }

      drawWolfEnemyModel(e, foot, scale = 1, dead = false) {
        const model = window.DreamRealms?.render?.WolfProceduralModel || window.WolfProceduralModel;
        if (!model?.draw) return false;

        const moving = !dead && ((e.moveBlend || 0) > 0.08 || Math.abs(e.vx || 0) + Math.abs(e.vy || 0) > 0.01);
        const hit = !dead && Number(e.hitAnim || e.hitReaction || e.damageAnim || 0) > 0.02;
        const attacking = !dead && Number(e.attackAnim || 0) > 0.02;
        const casting = !dead && Number(e.spellCastAnim || 0) > 0.05;
        const actor = {
          ...e,
          sourceEntity: e,
          rendererId: 'wolf',
          family: e.family || e.baseType?.family || 'wolf',
          mobType: e.mobType || e.baseType?.name || e.name || 'Wolf',
          mobVisualKey: e.mobVisualKey || e.baseType?.mobVisualKey || e.visualKey || e.baseType?.visualKey,
          screenX: foot.x,
          screenY: foot.y,
          facingName: this.actorFacingName?.(e) || e.facingName || 'south',
          isMoving: moving,
          action: dead || !e.alive ? 'death' : hit ? 'hit' : casting ? 'howl' : attacking ? 'attack' : moving ? 'walk' : 'idle',
          isAttacking: attacking,
          dead: dead || !e.alive,
          alive: !(dead || !e.alive),
          attackAnim: Number(e.attackAnim || 0),
          hitAnim: Number(e.hitAnim || e.hitReaction || e.damageAnim || 0),
          visualScale: e.visualScale || e.baseType?.visualScale || 1
        };

        const drew = this.drawCachedModelOrFallback(actor, model, scale, { rendererId: `wolf:${actor.mobVisualKey || actor.family || 'default'}`, bounds: e.dungeonBoss ? 'boss' : 'wolf' });
        if (!drew) return false;

        e._nameplateAnchor = {
          x: foot.x,
          y: foot.y - (dead || !e.alive ? 50 : (model.anchorHeight?.(actor) || 91)) * scale
        };
        e._wolfDedicatedRenderer = !!actor._wolfDedicatedRenderer;
        e._wolfVisualKey = actor._wolfVisualKey;
        return true;
      }

      getEntityAtlasAction(e, dead = false) {
        if (dead || !e?.alive) return 'death';
        if (e?.meditating) return 'meditate';
        if (this.isEntityEmoting?.(e)) return String(e.emoteState || e.action || '').toLowerCase();
        if (e?.fishing) return 'fishing';
        if (Number(e?.hitAnim || e?.hitReaction || e?.damageAnim || 0) > 0.02) return 'hit';
        if (Number(e?.spellCastAnim || 0) > 0.05) return e?.kind === 'enemy' ? 'specialAttack' : 'cast';
        if (Number(e?.attackAnim || 0) > 0.02) return e?.chargeActive || e?.charging ? 'charge' : 'attack';
        if (this.isEntitySwimming(e)) return 'swim';
        if ((e?.moveBlend || 0) > 0.08 || Math.abs(e?.vx || 0) + Math.abs(e?.vy || 0) > 0.01) return 'walk';
        return 'idle';
      }

      buildEntityAtlasActor(e, foot, scale = 1, dead = false) {
        const base = e?.baseType || {};
        const isEnemy = e?.kind === 'enemy';
        const isSpiritHealer = String(e?.visualRole || e?.rendererId || e?.name || '').toLowerCase().includes('spirit');
        const className = e?.className || e?.playerClass || e?.classId || (e?.kind === 'merc' ? ({ guardian: 'Paladin', cleric: 'Cleric', fieldcleric: 'Cleric', adept: 'Wizard', scout: 'Ranger' }[String(e.roleKey || '').toLowerCase()] || '') : '');
        const moving = !dead && ((e?.moveBlend || 0) > 0.08 || Math.abs(e?.vx || 0) + Math.abs(e?.vy || 0) > 0.01);
        return {
          ...e,
          sourceEntity: e,
          equipment: this.resolveActorVisualEquipment?.(e) || null,
          visualEquipment: this.resolveActorVisualEquipment?.(e) || null,
          screenX: foot.x,
          screenY: foot.y,
          renderNowMs: performance.now(),
          facingName: this.actorFacingName?.(e) || e?.facingName || 'south',
          className,
          playerClass: e?.playerClass || className,
          rendererId: isSpiritHealer ? 'spiritHealer' : (e?.rendererId || base.rendererId || (className ? 'classIdentity' : '')),
          family: e?.family || base.family || '',
          mobType: e?.mobType || base.name || e?.name || '',
          mobVisualKey: e?.mobVisualKey || base.mobVisualKey || e?.visualKey || base.visualKey || e?.paletteKey,
          visualKey: e?.visualKey || base.visualKey,
          boarPalette: e?.boarPalette || base.boarPalette,
          wolfPalette: e?.wolfPalette || base.wolfPalette,
          rotlingPalette: e?.rotlingPalette || base.rotlingPalette,
          spiderRole: e?.spiderRole || base.spiderRole,
          variant: e?.variant || e?.visualVariant || e?.trainerVisualVariant || e?.paletteKey || e?.mobVisualKey || base.mobVisualKey,
          visualRole: e?.visualRole,
          visualScale: e?.visualScale || base.visualScale || 1,
          action: this.getEntityAtlasAction(e, dead),
          emoteActive: !!e?.emoteActive,
          emoteState: e?.emoteState || '',
          emoteAnim: Number(e?.emoteAnim || 0),
          swimming: this.isEntitySwimming(e),
          inWater: this.isEntitySwimming(e),
          swimAnim: Number(e?.swimAnim || 0),
          swimMovement: this.swimMovementAmount(e),
          swimBlend: Number(e?.swimBlend || (this.isEntitySwimming(e) ? 1 : 0)),
          swimSubmerge: Number(e?.swimSubmerge || 0.52),
          isMoving: moving,
          alive: !(dead || !e?.alive),
          dead: dead || !e?.alive,
          attackAnim: Number(e?.attackAnim || 0),
          spellCastAnim: Number(e?.spellCastAnim || 0),
          hitAnim: Number(e?.hitAnim || e?.hitReaction || e?.damageAnim || 0),
          deathProgress: !e?.alive || dead ? 1 : Number(e?.deathProgress || 0),
          scale
        };
      }

      tryDrawEntityAtlasFrame(e, foot, scale = 1, dead = false) {
        // V0.14.65: live procedural swim poses are authoritative until baked swim atlases exist.
        if (!dead && (this.isEntitySwimming?.(e) || this.isEntityEmoting?.(e))) return false;
        const atlas = this.spriteAtlasSystem;
        e._spriteAtlasRendered = false;
        e._spriteAtlasRenderMode = 'procedural';
        e._spriteAtlasFrameKey = '';
        if (!atlas?.isReady?.()) {
          atlas?.recordProceduralFallback?.(atlas?.loading ? 'atlas_loading' : 'atlas_not_ready');
          e._spriteAtlasRenderMode = atlas?.loading ? 'atlas loading' : 'procedural';
          return false;
        }
        const actor = this.buildEntityAtlasActor(e, foot, scale, dead);
        const resolved = atlas.getEntityFrame?.(actor, this, { warn: true });
        const frame = resolved?.frame;
        const frameKey = resolved?.key || atlas.getEntityFrameKey?.(actor, this) || '';
        if (!frame) {
          atlas.recordProceduralFallback?.('missing_frame');
          e._spriteAtlasRenderMode = 'missing frame';
          e._spriteAtlasFrameKey = frameKey;
          return false;
        }
        if (!atlas.drawFrame(ctx, frame, foot.x, foot.y, { scale, imageSmoothingEnabled: false })) {
          atlas.recordProceduralFallback?.('draw_failed');
          e._spriteAtlasRenderMode = 'procedural';
          e._spriteAtlasFrameKey = frameKey;
          return false;
        }
        atlas.applyFrameAnchors?.(e, frame, foot.x, foot.y, scale);
        e._spriteAtlasFrameKey = frameKey;
        e._spriteAtlasRendered = true;
        e._spriteAtlasRenderMode = 'atlas';
        return true;
      }

      // V0.20.64 (Roadmap Item 7.G): draw the beast the player is riding, beneath the rider.
      // Returns the saddle height in pixels so the caller can lift the rider onto its back.
      // Reuses the wild creature's own procedural model rather than authoring separate mount art,
      // so a tamed beast looks exactly like the beast that was tamed, from every camera direction.
      // V0.20.69: the saddle height is MEASURED from the beast's own artwork, once per mount, and
      // cached. The first pass used a flat 26px for everything, which is wrong by a wide margin
      // because the animals are not the same height: measured back lines run from 38px above the
      // anchor (dusk bat) to 95px (hollow stag). A wolf rider was sitting 34px BELOW the animal's
      // back, which is why the character read as standing in front of the mount rather than on it.
      // Measuring beats authoring a number per mount: it cannot drift if the art changes.
      mountSaddleHeight(def, modelScale) {
        const cacheKey = `${def.beastKey}:${modelScale.toFixed(2)}`;
        this._saddleHeightCache = this._saddleHeightCache || new Map();
        const hit = this._saddleHeightCache.get(cacheKey);
        if (hit !== undefined) return hit;
        let height = Math.round(30 * modelScale);   // fallback if the probe cannot run
        try {
          const model = window.DreamRealms?.render?.DarkWoodsMobProceduralModel;
          const size = 320;
          const cv = document.createElement('canvas');
          cv.width = size; cv.height = size;
          const c = cv.getContext('2d');
          const ox = size / 2, oy = size * 0.72;
          const drew = model?.draw?.(c, {
            mobVisualKey: def.beastKey, family: def.family, alive: true, kind: 'enemy',
            screenX: ox, screenY: oy, modelScale,
            facingX: 1, facingY: 0, facingName: 'east',
            moveBlend: 0, vx: 0, vy: 0, hp: 1, maxHp: 1
          }, 1000);
          if (drew) {
            const data = c.getImageData(0, 0, size, size).data;
            const tops = [];
            // Sample a band across the saddle area rather than the whole silhouette - the overall
            // topmost pixel is the head or antlers, not the part you sit on.
            for (let x = ox - 14; x <= ox + 14; x += 4) {
              for (let y = 0; y < size; y++) {
                if (data[(y * size + x) * 4 + 3] > 24) { tops.push(y); break; }
              }
            }
            if (tops.length) {
              const backY = tops.reduce((a, b) => a + b, 0) / tops.length;
              // Sit slightly INTO the back so the rider is seated rather than perched on the outline.
              height = Math.max(6, Math.round(oy - backY - 5 * modelScale));
            }
          }
        } catch (_err) { /* keep the fallback */ }
        this._saddleHeightCache.set(cacheKey, height);
        return height;
      }

      // V0.20.71: measure the mount's HEAD region from its front-facing artwork, once, and cache it.
      // Used to re-draw just the head over the rider when the animal faces the camera. Measured for
      // the same reason the saddle height is: the beasts are different shapes, and a hardcoded box
      // would be wrong for most of them.
      mountFrontHeadBox(def, modelScale, facing) { return this.mountOverlayBox(def, modelScale, 'front', facing); }

      // V0.20.73: the part of the mount that sits NEARER the camera than the rider does, measured from
      // the animal's own artwork and cached. Facing the camera that is the head; from behind it is the
      // rump and tail, which should lap over the rider's lower body (reported). Measured rather than
      // authored because the beasts are different shapes.
      // The facing the ridden mount is drawn with, so the overlay box is measured from the same
      // silhouette that reaches the screen rather than a canned one.
      mountProbeFacing(e) {
        return { fx: Number(e?.facingX) || 0, fy: Number(e?.facingY) || 0, name: e?.facingName || '' };
      }

      // V0.20.76: `facing` is the facing the entity is ACTUALLY drawn with, and is required. Measuring a
      // canned straight south/north probe while the game draws a diagonal put the clip rect 44px to the
      // left of the real head on the black wolf (probe centre -11 vs drawn centre +33), which clipped
      // one side of the head off and redrew blank canvas across the rider's chest. Same probe-vs-draw
      // mismatch as V0.20.65 / V0.20.69 / V0.20.73; measuring at the drawn facing closes the class.
      mountOverlayBox(def, modelScale, mode, facing) {
        const fx = Number(facing?.fx) || 0;
        const fy = Number(facing?.fy) || 0;
        // Quantise to 8 headings so the cache stays small but never spans two different silhouettes.
        const q = v => Math.round(v * 1.4142);
        const cacheKey = `${def.beastKey}:${modelScale.toFixed(2)}:${mode}:${q(fx)},${q(fy)}`;
        this._headBoxCache = this._headBoxCache || new Map();
        const hit = this._headBoxCache.get(cacheKey);
        if (hit !== undefined) return hit;
        let box = null;
        try {
          const model = window.DreamRealms?.render?.DarkWoodsMobProceduralModel;
          const size = 320;
          const cv = document.createElement('canvas');
          cv.width = size; cv.height = size;
          const c = cv.getContext('2d');
          const ox = size / 2, oy = size * 0.72;
          const rear = mode === 'back';
          const hasFacing = fx !== 0 || fy !== 0;
          const drew = model?.draw?.(c, {
            mobVisualKey: def.beastKey, family: def.family, alive: true, kind: 'enemy',
            screenX: ox, screenY: oy, modelScale,
            facingX: hasFacing ? fx : 0,
            facingY: hasFacing ? fy : (rear ? -1 : 1),
            facingName: facing?.name || (rear ? 'north' : 'south'),
            moveBlend: 0, vx: 0, vy: 0, hp: 1, maxHp: 1
          }, 1000);
          if (drew) {
            const data = c.getImageData(0, 0, size, size).data;
            const rowSpan = y => {
              let min = -1, max = -1;
              for (let x = 0; x < size; x++) {
                if (data[(y * size + x) * 4 + 3] > 24) { if (min < 0) min = x; max = x; }
              }
              return min < 0 ? null : { min, max, w: max - min };
            };
            let top = -1, bottom = -1;
            for (let y = 0; y < size; y++) { if (rowSpan(y)) { if (top < 0) top = y; bottom = y; } }
            if (top >= 0 && bottom > top && rear) {
              // V0.20.75: the rump is NOT measured from the top of the silhouette. The topmost mass is
              // the HEAD from every angle, including from behind -- measuring down from `top` drew the
              // wolf's head across the rider's back (reported). Nor is it the widest row: on both stags
              // that picks the ANTLERS, putting the box 30px above the rider entirely.
              //
              // Anchor to the BACK LINE: the first row where the outline widens to the body proper.
              // On the black wolf that is a hard jump from 44px of skull to 71px of shoulders.
              //
              // The saddle height is deliberately NOT the anchor: it is measured from a side view, and
              // at that height a rear silhouette is still neck and skull -- anchoring there redrew the
              // head over the rider all over again (measured: box -64..-40 against a head at -84..-52).
              let maxW = 0;
              for (let y = top; y <= bottom; y++) { const s = rowSpan(y); if (s && s.w > maxW) maxW = s.w; }
              let backY = top;
              for (let y = top; y <= bottom; y++) {
                const s = rowSpan(y);
                if (s && s.w >= maxW * 0.6) { backY = y; break; }
              }
              // This overlay exists to lap the rider's LOWER body. On both stags and all three
              // arachnids the back line sits ABOVE the rider's pelvis, so the band would land across
              // their chest -- the wrong half. Clamp to the pelvis, which is the saddle lift (the
              // rider's hip lands ~3px below it). This clamp, not the back line, is what corrects
              // those five.
              backY = Math.max(backY, Math.round(oy - this.mountSaddleHeight(def, modelScale)) - 3);
              // V0.20.78: the rear band now runs DOWN PAST THE RIDER'S LEGS, exactly as the front band
              // does, so the tail and hindquarters draw over them (reported: "the tail should be
              // rendered on top of the player"). The old 14px band stopped at the knee, which left the
              // tail behind the rider entirely.
              //
              // This makes the two views symmetric: from the front the rider's legs straddle the
              // animal's HEAD, from behind they straddle its TAIL. That is why the legs now use the
              // same wide splay in both (see buildRidingRig) - a narrow rear seat would sit inside the
              // band and simply vanish under it.
              const riderFootY = Math.round(oy - this.mountSaddleHeight(def, modelScale) + 28);
              const bandBottom = Math.min(bottom, Math.max(backY + 14, riderFootY + 4));
              // WIDTH from the rump rows only, for the same reason the front takes it from head+withers:
              // sampling the full band inherits the hind legs and blows the box out sideways.
              const rumpW = Math.min(bandBottom, backY + 14);
              let minX = size, maxX = 0;
              for (let y = backY; y <= rumpW; y++) {
                const span = rowSpan(y);
                if (span) { if (span.min < minX) minX = span.min; if (span.max > maxX) maxX = span.max; }
              }
              // Seen from behind the rump is inherently wide - the black wolf's is 131-139px across, which
              // gave a 147px band that buried the rider's LEFT leg (measured: that zone fell from 92.6%
              // to 63.2% non-animal pixels). Unlike the front, there is no narrow "head" band to fall
              // back on, so bound it by the RIDER instead: stay inside the leg line so the tail lands
              // between the legs and the legs themselves stay visible either side of it.
              // 27 tracks the +/-31 foot splay in buildRidingRig; keep the two in step.
              const legClear = 27;
              minX = Math.max(minX, ox - legClear);
              maxX = Math.min(maxX, ox + legClear);
              // If the band caught no pixels the anchor disagrees with the artwork; draw nothing rather
              // than clipping to a garbage rect.
              box = maxX > minX
                ? { dx: minX - ox - 2, dy: backY - oy - 2, w: (maxX - minX) + 4, h: (bandBottom - backY) + 4 }
                : null;
            } else if (top >= 0 && bottom > top) {
              // The head is the narrow mass at the top; the silhouette widens sharply at the
              // shoulders. Find that widening rather than assuming a fixed fraction.
              const headWidth = rowSpan(top + Math.max(2, Math.round((bottom - top) * 0.08)))?.w || 10;
              let shoulderY = top + Math.round((bottom - top) * 0.42);
              for (let y = top; y <= bottom; y++) {
                const span = rowSpan(y);
                if (span && span.w > headWidth * 1.9) { shoulderY = y; break; }
              }
              // V0.20.77: facing the camera the band covers the head AND the animal's UPPER BODY, down
              // past the rider's legs. Stopping at the head left the rider's pelvis and thighs painted
              // over the animal's chest (reported: "the lower body should be hidden behind the mount's
              // head and upper body") - measured, the rider's lower body is a solid block at dy -58..-31
              // while the band ended at -53, which is exactly where that block starts.
              //
              // Extending is safe by construction: the band only clips a REDRAW OF THE MOUNT, so it can
              // only ever paint the animal's own chest and never reveal background. And the rider's feet
              // splay to +/-31 in front views (V0.20.72), wider than the animal's chest, so they stay
              // visible at the sides - which is the look asked for.
              const saddle = this.mountSaddleHeight(def, modelScale);
              const riderFootY = Math.round(oy - saddle + 28);
              const bandBottom = Math.max(shoulderY, Math.min(bottom, riderFootY + 4));
              // WIDTH comes from the head and chest only, not the whole band. Measured on the black wolf
              // at southeast the silhouette jumps from 81px wide at dy -56 to 142px at dy -53, because
              // the angled flank sweeps far to the left - sampling the full band inherited that and
              // produced a 152px box that buried the rider's legs too. The head-and-chest rows describe
              // the "upper body" that should do the occluding.
              const chestY = Math.min(bandBottom, shoulderY + 4);
              let minX = size, maxX = 0;
              for (let y = top; y <= chestY; y++) {
                const span = rowSpan(y);
                if (span) { if (span.min < minX) minX = span.min; if (span.max > maxX) maxX = span.max; }
              }
              // NOTE (V0.20.77): the boars get much wider boxes here (briar boar 141px, old tusk 202px)
              // because the shoulder detection above NEVER FIRES for them - their skull merges straight
              // into the shoulders, so `headWidth * 1.9` is a threshold the silhouette never crosses
              // (old tusk: probe 106, threshold 201, actual max 182) and `shoulderY` falls back to 42%
              // of height. That is pre-existing behaviour, not introduced here, and for a boar covering
              // that width may well be correct since the rider's legs sit behind its bulk anyway. Left
              // alone deliberately rather than "fixed" blind - it needs eyes on a boar mount first.
              // A clamp against the head span was tried and REMOVED: it was inert on all 11 mounts.
              box = {
                dx: minX - ox - 3, dy: top - oy - 3,
                w: (maxX - minX) + 6, h: (bandBottom - top) + 6
              };
            }
          }
        } catch (_err) { /* no overlay rather than a broken one */ }
        this._headBoxCache.set(cacheKey, box);
        return box;
      }

      // V0.20.72: the screen rect of the mount's head, or null when the head is not in front of the
      // rider (any view but front). Used to cut that area out of the rider so the head shows through.
      mountHeadClipRect(e, foot, scale = 1) {
        const DRr = window.DreamRealms;
        const def = DRr?.MOUNT_BY_ID?.[e.mountId];
        if (!def) return null;
        const view = this.entityFacingView ? this.entityFacingView(e) : null;
        if (!view || (view.mode !== 'front' && view.mode !== 'back')) return null;
        const modelScale = Math.max(0.4, Number(def.mount?.visualScale) || 1) * scale;
        const box = this.mountOverlayBox(def, modelScale, view.mode, this.mountProbeFacing(e));
        if (!box) return null;
        // Trimmed slightly so the cut does not eat the rider's inner thighs, which should still meet
        // the animal's neck.
        const inset = 2;
        return { x: foot.x + box.dx + inset, y: foot.y + box.dy, w: Math.max(4, box.w - inset * 2), h: box.h };
      }

      // Retained for the sprite baker / debug inspection: draws just the head region of the mount.
      drawRiddenMountHeadOverlay(e, foot, scale = 1) {
        const DRr = window.DreamRealms;
        const def = DRr?.MOUNT_BY_ID?.[e.mountId];
        const model = DRr?.render?.DarkWoodsMobProceduralModel || window.DarkWoodsMobProceduralModel;
        if (!def || !model?.draw) return;
        const view = this.entityFacingView ? this.entityFacingView(e) : null;
        // V0.20.73: front -> the HEAD laps over the rider; back -> the RUMP and tail do. Side-on,
        // neither is nearer the camera than the rider, so nothing is redrawn.
        if (!view || (view.mode !== 'front' && view.mode !== 'back')) return;
        const mode = view.mode;
        const modelScale = Math.max(0.4, Number(def.mount?.visualScale) || 1) * scale;
        const box = this.mountOverlayBox(def, modelScale, mode, this.mountProbeFacing(e));
        if (!box) return;
        const side = view.side >= 0 ? 1 : -1;
        ctx.save();
        ctx.beginPath();
        ctx.rect(foot.x + box.dx, foot.y + box.dy, box.w, box.h);
        ctx.clip();
        try {
          model.draw(ctx, {
            mobVisualKey: def.beastKey, visualKey: def.beastKey, family: def.family,
            alive: true, kind: 'enemy',
            screenX: foot.x, screenY: foot.y, modelScale,
            facingX: side, facingY: mode === 'back' ? -1 : 1,
            facingName: mode === 'back' ? (side < 0 ? 'northwest' : 'north') : (side < 0 ? 'southwest' : 'south'),
            moveBlend: Number(e.moveBlend) || 0,
            vx: Number(e.vx) || 0, vy: Number(e.vy) || 0,
            walkCycle: Number(e.walkCycle) || 0,
            hp: 1, maxHp: 1
          }, performance.now());
        } catch (_err) { /* ignore - the body underneath already drew */ }
        ctx.restore();
      }

      drawRiddenMount(e, foot, scale = 1) {
        const DRr = window.DreamRealms;
        const def = DRr?.MOUNT_BY_ID?.[e.mountId];
        const model = DRr?.render?.DarkWoodsMobProceduralModel || window.DarkWoodsMobProceduralModel;
        if (!def || !model?.draw) return 0;
        const modelScale = Math.max(0.4, Number(def.mount?.visualScale) || 1) * scale;
        // V0.20.64: the mount's facing is derived from entityFacingView - the SAME camera-aware
        // function the rider's own model uses - and then expressed as a compass name the mob model
        // parses to the identical view. Passing the raw facingX/facingY instead was wrong: the mob
        // model does not apply camera yaw, so a rider facing 'northeast' (which projects to a SIDE
        // view on screen) would have shown the beast's BACK, and the two would have separated
        // further with every camera rotation.
        const view = this.entityFacingView ? this.entityFacingView(e) : null;
        const side = view ? (view.side >= 0 ? 1 : -1) : 1;
        const facingName = !view ? 'south'
          : view.mode === 'back' ? (side < 0 ? 'northwest' : 'north')
            : view.mode === 'front' ? (side < 0 ? 'southwest' : 'south')
              : (side < 0 ? 'west' : 'east');
        const rider = {
          mobVisualKey: def.beastKey,
          visualKey: def.beastKey,
          family: def.family,
          alive: true,
          kind: 'enemy',
          screenX: foot.x,
          screenY: foot.y,
          modelScale,
          facingX: side,
          facingY: view ? (view.mode === 'back' ? -1 : view.mode === 'front' ? 1 : 0) : 1,
          facingName,
          moveBlend: Number(e.moveBlend) || 0,
          vx: Number(e.vx) || 0,
          vy: Number(e.vy) || 0,
          walkCycle: Number(e.walkCycle) || 0,
          hp: 1, maxHp: 1
        };
        let drew = false;
        try { drew = model.draw(ctx, rider, performance.now()) === true; } catch (_err) { drew = false; }
        if (!drew) return 0;
        // Measured from the beast's own silhouette (see mountSaddleHeight) rather than a flat
        // constant, so a stag seats far higher than a bat, as it should.
        return this.mountSaddleHeight(def, modelScale);
      }

      drawSpriteAtlasDebugLabel(e, foot) {
        const atlas = this.spriteAtlasSystem;
        const sheet = this.spriteSheetSystem;
        if (!atlas?.debugDraw && !sheet?.debugDraw && !this.showSpriteAtlasDebug) return;
        const mode = e?._spriteAtlasRenderMode || (atlas?.isReady?.() ? 'procedural' : 'atlas loading/error');
        const key = e?._spriteAtlasFrameKey ? ` ${e._spriteAtlasFrameKey}` : '';
        ctx.save();
        ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const text = `${mode}${key}`;
        const y = (e?._nameplateAnchor?.y || foot.y - 82) - 12;
        const width = Math.min(280, ctx.measureText(text).width + 10);
        ctx.fillStyle = 'rgba(4,8,6,0.78)';
        ctx.fillRect(foot.x - width / 2, y - 7, width, 14);
        ctx.fillStyle = (mode === 'atlas' || mode === 'sprite') ? '#86ff9e' : mode === 'missing frame' ? '#ffd166' : '#d7e6d0';
        ctx.fillText(text.length > 42 ? text.slice(0, 39) + '...' : text, foot.x, y);
        ctx.restore();
      }

      tryDrawEntitySpriteSheetFrame(e, foot, scale = 1, dead = false) {
        // V0.14.65: avoid walking/idle sprite fallbacks masking active swimming animation.
        if (!dead && (this.isEntitySwimming?.(e) || this.isEntityEmoting?.(e))) return false;
        const sheetSystem = this.spriteSheetSystem;
        if (!sheetSystem?.isReady?.()) {
          sheetSystem?.recordProceduralFallback?.(sheetSystem?.indexLoading ? 'sheet_index_loading' : 'sheet_index_not_ready');
          return false;
        }
        e._spriteAtlasRendered = false;
        e._spriteAtlasRenderMode = 'procedural';
        e._spriteAtlasFrameKey = '';
        const actor = this.buildEntityAtlasActor(e, foot, scale, dead);
        const resolved = sheetSystem.getEntityFrame?.(actor, this, { warn: true });
        const frame = resolved?.frame;
        const frameKey = resolved?.fullKey || (resolved?.modelId && resolved?.key ? `${resolved.modelId}.${resolved.key}` : '');
        if (!frame) {
          sheetSystem.recordProceduralFallback?.('missing_or_loading_sheet_frame');
          e._spriteAtlasRenderMode = sheetSystem.loadingModels?.size ? 'sprite loading' : 'missing frame';
          e._spriteAtlasFrameKey = frameKey;
          return false;
        }
        if (!sheetSystem.drawFrame(ctx, frame, foot.x, foot.y, { scale, imageSmoothingEnabled: false })) {
          sheetSystem.recordProceduralFallback?.('sprite_draw_failed');
          e._spriteAtlasRenderMode = 'procedural';
          e._spriteAtlasFrameKey = frameKey;
          return false;
        }
        sheetSystem.applyFrameAnchors?.(e, frame, foot.x, foot.y, scale);
        e._spriteAtlasFrameKey = frameKey;
        e._spriteAtlasRendered = true;
        e._spriteAtlasRenderMode = 'sprite';
        return true;
      }





      drawCorpseLootMarker(x, y, scale = 1) {
        const pulse = 0.5 + Math.sin(performance.now() * 0.006) * 0.5;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        ctx.globalAlpha = 0.34;
        ctx.fillStyle = '#030201';
        ctx.beginPath();
        ctx.ellipse(0, 8, 20, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.62 + pulse * 0.20;
        const glow = ctx.createRadialGradient(0, -3, 2, 0, -3, 28 + pulse * 5);
        glow.addColorStop(0, 'rgba(255,232,141,0.46)');
        glow.addColorStop(0.45, 'rgba(216,167,91,0.18)');
        glow.addColorStop(1, 'rgba(216,167,91,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, -3, 28 + pulse * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#2b1a10';
        ctx.fillStyle = '#8f5b31';
        ctx.beginPath();
        ctx.roundRect(-13, -10, 26, 24, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#b9793f';
        ctx.beginPath();
        ctx.roundRect(-10, -13, 20, 10, 4);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#f3d48a';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-8, -5);
        ctx.quadraticCurveTo(0, -9 - pulse * 2, 8, -5);
        ctx.stroke();
        ctx.fillStyle = '#ffe79a';
        ctx.beginPath();
        ctx.arc(8, -12, 3.2 + pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,246,190,0.78)';
        ctx.beginPath();
        ctx.arc(-6, 0, 2.2, 0, Math.PI * 2);
        ctx.arc(2, 4, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // V0.18.3: animated water-surface ellipse drawn at a swimming mob's waterline. Called
      // twice per swimming mob - once behind the model (dark base) and once in front
      // (bright rim over the clipped body edge) - to sell "in the water", not on top of it.
      drawMobSwimSurface(foot, scale = 1, e, front = false) {
        const blend = Math.max(0, Math.min(1, Number(e?.swimBlend != null ? e.swimBlend : 1)));
        if (blend <= 0.02) return;
        const anim = Number(e?.swimAnim || 0);
        const waterY = foot.y - (6 + 13 * blend) * scale;
        const rw = (19 + 3.5 * Math.sin(anim * 6.28318)) * scale;
        const rh = 5.5 * scale;
        ctx.save();
        ctx.globalAlpha = (front ? 0.42 : 0.34) * blend;
        ctx.fillStyle = front ? '#5fb4d0' : '#12303e';
        ctx.beginPath();
        ctx.ellipse(foot.x, waterY, rw, rh, 0, 0, Math.PI * 2);
        ctx.fill();
        if (front) {
          ctx.globalAlpha = 0.55 * blend;
          ctx.strokeStyle = '#cdeeff';
          ctx.lineWidth = 1.1 * scale;
          ctx.beginPath();
          ctx.ellipse(foot.x, waterY, rw, rh, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      drawEntity(e) {
        // V0.15.50: model/nameplate anchors are screen-space data and must be
        // refreshed every draw. Sprite/model caches can otherwise leave bots,
        // players, mercs, and pets with stale anchors after camera movement,
        // walking, meditation pose changes, or camp repositioning.
        if (e) {
          e._nameplateAnchor = null;
          e._meditationExpBarAnchor = null;
          e._nameplateLayout = null;
        }
        const tile = this.tileAt(e.x, e.y);
        const foot = this.worldToScreen(e.x, e.y, tile.elev);
        const jumpLift = Math.max(0, Number(e.z) || 0);
        const jumpLiftPx = jumpLift * (DR.CONFIG?.ELEV_STEP || 28);
        // V0.20.64: `let` rather than `const` because a mounted rider is lifted by the saddle height
        // after the mount beneath is drawn (see drawRiddenMount below).
        let visualFoot = { x: foot.x, y: foot.y - jumpLiftPx };
        // V0.17.22: publish the actual rendered ground-contact/feet anchor.
        // Root/entangle VFX uses this anchor instead of the torso/nameplate or
        // generic entity center so the control feedback stays on the ground.
        e._groundContactAnchor = { x: visualFoot.x, y: visualFoot.y };
        e._rootVfxFootAnchor = { x: visualFoot.x, y: visualFoot.y + 5 };
        const sprite = { x: visualFoot.x, y: visualFoot.y - 28 };
        const scale = e.kind === 'enemy'
          ? (e.dungeonBoss ? 1.52 + e.level * 0.045 : 0.95 + e.level * 0.035)
          : (e.kind === 'pet' ? 1.18 : 1); // NPCs/players/mercs intentionally share character scale

        if (!e.alive && e.kind === 'enemy') {
          const hasLoot = this.corpseLootHasItems?.(e);
          if (e.corpseVisualExpired) {
            if (hasLoot) this.drawCorpseLootMarker?.(foot.x, foot.y - 18, scale);
            return;
          }
          if (this.tryDrawEntitySpriteSheetFrame(e, visualFoot, scale, true) || this.tryDrawEntityAtlasFrame(e, visualFoot, scale, true)) {
            if (hasLoot) this.drawCorpseLootMarker?.(foot.x, foot.y - 20, scale);
            return;
          }
          if (this.isSilkWebSpiderActor(e) && this.drawSilkWebSpiderModel(e, visualFoot, scale, true)) {
            if (hasLoot) this.drawCorpseLootMarker?.(foot.x, foot.y - 20, scale);
            return;
          }
          if (this.isDarkWoodsMobVisualActor(e) && this.drawDarkWoodsMobVisualModel(e, visualFoot, scale, true)) {
            if (hasLoot) this.drawCorpseLootMarker?.(foot.x, foot.y - 20, scale);
            return;
          }
          if (this.isWolfEnemyActor(e) && this.drawWolfEnemyModel(e, visualFoot, scale, true)) {
            if (hasLoot) this.drawCorpseLootMarker?.(foot.x, foot.y - 20, scale);
            return;
          }
          ctx.fillStyle = 'rgba(103, 31, 24, 0.58)';
          ctx.beginPath();
          ctx.ellipse(foot.x, foot.y + 5, 19, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(30,14,10,0.55)';
          this.fillPoly([{x:foot.x-12,y:foot.y},{x:foot.x+8,y:foot.y-4},{x:foot.x+15,y:foot.y+3},{x:foot.x-7,y:foot.y+8}]);
          if (hasLoot) this.drawCorpseLootMarker?.(foot.x, foot.y - 18, scale);
          return;
        }

        const wolfEnemy = e.kind === 'enemy' && this.isWolfEnemyActor(e);
        const silkWebSpider = e.kind === 'enemy' && this.isSilkWebSpiderActor(e);
        const darkWoodsMobVisual = e.kind === 'enemy' && !silkWebSpider && this.isDarkWoodsMobVisualActor(e);
        const identityPetModel = e.kind === 'pet' && this.canDrawIdentityPetModel?.(e);
        if (!wolfEnemy && !silkWebSpider && !darkWoodsMobVisual && !identityPetModel) {
          ctx.fillStyle = `rgba(0,0,0,${Math.max(0.16, 0.36 - jumpLift * 0.16).toFixed(3)})`;
          ctx.beginPath();
          const shadowW = (e.kind === 'pet' ? 20 : 17 * scale) * Math.max(0.72, 1 - jumpLift * 0.12);
          const shadowH = (e.kind === 'pet' ? 8 : 7 * scale) * Math.max(0.72, 1 - jumpLift * 0.12);
          ctx.ellipse(foot.x + 3, foot.y + 4, shadowW, shadowH, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        if (this.player?.targetId === e.id && (e.kind === 'enemy' || e.kind === 'merc' || e.kind === 'pet' || e.kind === 'bot')) this.drawActiveTargetIndicator(e, visualFoot, scale);
        if (e.kind === 'enemy' && this.questSystem?.isQuestTargetEnemy?.(e)) this.drawQuestTargetMarker(e, visualFoot, scale);
        // V0.18.3: mobs swim now - render the procedural enemy models partially submerged
        // (clip below an animated waterline + a surface ripple) so they look like they're
        // in the water, not on top of it. Humanoid/sprite actors already handle their own
        // swim pose, so this only wraps the enemy model draw below.
        const mobSwimming = e.kind === 'enemy' && this.isEntitySwimming?.(e) === true;
        let mobSwimClip = false;
        if (mobSwimming) {
          this.drawMobSwimSurface?.(visualFoot, scale, e, false);
          const blend = Math.max(0, Math.min(1, Number(e.swimBlend != null ? e.swimBlend : 1)));
          const waterY = visualFoot.y - (6 + 13 * blend) * scale;
          ctx.save();
          ctx.beginPath();
          ctx.rect(visualFoot.x - 150 * scale, waterY - 340, 300 * scale, 340);
          ctx.clip();
          mobSwimClip = true;
        }
        // V0.20.64 (Roadmap Item 7.G): a mounted rider is drawn as the beast BENEATH the character,
        // using the same procedural mob model the wild creature uses - so the mount matches the beast
        // that was tamed and inherits its 8-direction facing for free. Drawn before the rider so the
        // depth reads correctly, and the rider is lifted by the saddle height below.
        let mountLift = 0;
        // V0.20.73: publish the CAMERA-PROJECTED view for the riding rig. The rig otherwise derives leg
        // layout from the compass direction, and the two disagree - heading 'south' projects to a SIDE
        // view on screen but reads as 'front' by compass, so a side-on rider was given the wide
        // camera-facing straddle and looked like they were sitting sideways (reported). Same parity
        // trap as the mount facing in V0.20.65.
        if (e.kind === 'player' && e.mounted && this.entityFacingView) {
          e._cameraView = this.entityFacingView(e).mode;
        }
        if (e.kind === 'player' && e.mounted && this.drawRiddenMount) {
          mountLift = this.drawRiddenMount(e, visualFoot, scale) || 0;
        }
        if (mountLift) visualFoot = { x: visualFoot.x, y: visualFoot.y - mountLift };

        if (this.tryDrawEntitySpriteSheetFrame(e, visualFoot, scale, false) || this.tryDrawEntityAtlasFrame(e, visualFoot, scale, false)) {
          // Atlas frames are runtime entity sprites generated from the procedural model source.
        } else if (silkWebSpider && this.drawSilkWebSpiderModel(e, visualFoot, scale, false)) {
          // Silk Web Cavern spiders use role-specific elite/boss silhouettes instead of the generic enemy blob.
        } else if (darkWoodsMobVisual && this.drawDarkWoodsMobVisualModel(e, visualFoot, scale, false)) {
          // Dark Woods mobs use species-specific visual models with intentional elite/rare variants.
        } else if (wolfEnemy && this.drawWolfEnemyModel(e, visualFoot, scale, false)) {
          // Wolf mobs use a dedicated quadruped model with 8-direction body/head/tail/leg profiles.
        } else if (e.kind === 'enemy') this.drawEnemySprite(e, sprite, scale);
        else if (e.kind === 'pet') this.drawPetSprite(e, sprite, scale);
        else if (this.isRaceSpriteSheetActor(e) && this.drawRaceSpriteSheetModel(e, visualFoot, scale)) {
          // Optional Blender-rendered race frame; the procedural race model remains the per-state fallback.
        } else if (this.isRaceIdentityActor(e) && this.drawRaceIdentityModel(e, visualFoot, scale)) {
          // Bogling and Ratkin race models route before class-specific fallbacks.
        // V0.20.50: REVERTED the V0.20.49 humanoid sprite-cache routing. It made things WORSE (12 -> 7
        // FPS) and broke the foot anchors. Why: the cache key correctly includes the animation bucket and
        // moveBlend, so for actors that are actually MOVING the key churns every frame. The cache has a
        // per-frame miss budget (96), which real motion blows instantly - measured 2,514 budget skips in a
        // single sampled frame - so drawModel DECLINED almost every call. But each declined call had
        // already paid for an entity spread, equipment resolution and a long key-string build, and then
        // the procedural draw ran anyway. Pure added overhead. My 92% hit rate came from re-rendering a
        // FROZEN frame where nothing moved; it did not survive contact with a moving world.
        } else if (this.isBardClassActor(e) && this.drawBardClassModel(e, visualFoot, scale)) {
          // Bard uses the standard humanoid base with class-specific lute, sash, cape, and music overlays.
        } else if (this.isDruidClassActor(e) && this.drawDruidClassModel(e, visualFoot, scale)) {
          // Druid uses the standard humanoid base with class-specific leaf mantle, staff, vine sash, and nature overlays.
        } else if (this.isMercIdentityActor(e) && this.drawMercIdentityModel(e, visualFoot, scale)) {
          // Mercenaries use the shared humanoid base with role-specific identity overlays.
        } else if (this.isClassIdentityActor(e) && this.drawClassIdentityModel(e, visualFoot, scale)) {
          // Fighter/Rogue/Cleric/Enchanter/Summoner/Necromancer use the shared humanoid base plus class identity overlays.
        } else this.drawHumanoid(e, sprite, scale);
        // V0.20.72: the mount's head is nearer the camera than the rider's lower body when the animal
        // faces you, so it is re-drawn HERE, after the rider, clipped to the head only. A rectangular
        // cut-out of the rider was tried first and rejected: the head's silhouette is rounded, so the
        // corners of any rect would have shown the ground straight through the character's chest.
        // Painting the head over the top cannot do that - it only ever adds the animal's own pixels.
        if (e.kind === 'player' && e.mounted && mountLift) {
          this.drawRiddenMountHeadOverlay?.(e, foot, scale);
        }

        if (mobSwimClip) {
          ctx.restore();
          this.drawMobSwimSurface?.(visualFoot, scale, e, true); // surface line over the clipped body
        }

        // V0.20.24: persistent protective-buff aura, drawn AFTER the body so a shield envelops the
        // actor for exactly as long as the buff lives (Roadmap Item 6). Cheap when unshielded - it
        // returns immediately if e.buffs is empty, which is the overwhelming common case.
        this.drawEntityStatusAuras?.(e, visualFoot, scale);

        // V0.17.68: publish the live rod-tip screen anchor for the fishing line.
        // Cached / class-identity / merc model paths draw the rod via
        // drawClassFishingRig, which records the rod-tip offset (fishingRodTipLocal)
        // relative to the model foot (screenX/screenY == visualFoot). Convert it to
        // the same unzoomed worldToScreen space the fishing system consumes
        // (foot + offset*scale) so the line starts at the real pole tip instead of
        // the too-high world-space fallback. The humanoid-base path publishes its
        // own anchor inside drawFishingActionOverlay and never sets this field.
        if (e.fishing && e.fishingRodTipLocal
          && Number.isFinite(Number(e.fishingRodTipLocal.x))
          && Number.isFinite(Number(e.fishingRodTipLocal.y))) {
          e.fishingRodTipScreen = {
            x: visualFoot.x + Number(e.fishingRodTipLocal.x) * scale,
            y: visualFoot.y + Number(e.fishingRodTipLocal.y) * scale
          };
          e.fishingRodTipScreenAt = performance.now();
          e.fishingRodTipScreenCameraYaw = Number(this.camera?.yaw || 0);
          e.fishingRodTipScreenCameraZoom = Number(this.camera?.zoom || 1);
          e.fishingRodTipScreenCameraX = Number(this.camera?.x || 0);
          e.fishingRodTipScreenCameraY = Number(this.camera?.y || 0);
          e.fishingRodTipScreenAction = e.fishingAction || 'waiting';
        }

        if (this.player?.targetId === e.id && (e.kind === 'enemy' || e.kind === 'merc' || e.kind === 'pet' || e.kind === 'bot')) this.drawActiveTargetBrackets(e, visualFoot, scale);
        this.drawNameplate(e, visualFoot);
        this.drawSpriteAtlasDebugLabel(e, visualFoot);
        if (e.kind === 'bot') this.drawBotSpeechBubble(e, visualFoot);
      }

      drawActiveTargetIndicator(e, foot, scale = 1) {
        // V0.20.39 (Roadmap Item 20): high-contrast target reticle - thicker lines, full opacity, and
        // pure black backing + white ring instead of the thin amber, so the current target is
        // unmistakable for low-vision players. Off by default; only the look changes, not targeting.
        const hc = !!this.uiPrefs?.highContrastTarget;
        const lw = hc ? 1.8 : 1;
        const t = performance.now() * 0.006;
        const pulse = 1 + Math.sin(t) * 0.08;
        const visualScale = clamp(Number(e.visualScale || e.modelScale || scale || 1), 0.75, 2.25);
        const rx = Math.max(32, 34 * visualScale) * pulse;
        const ry = Math.max(12, 13 * visualScale) * pulse;
        ctx.save();
        ctx.globalAlpha = hc ? 1 : 0.72;
        ctx.strokeStyle = hc ? '#000000' : 'rgba(20, 12, 4, 0.88)';
        ctx.lineWidth = 5 * lw;
        ctx.beginPath();
        ctx.ellipse(foot.x, foot.y + 6, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = hc ? 1 : 0.96;
        ctx.strokeStyle = hc ? '#ffffff' : '#ffe56d';
        ctx.lineWidth = 3 * lw;
        ctx.beginPath();
        ctx.ellipse(foot.x, foot.y + 6, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.62;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.ellipse(foot.x, foot.y + 6, rx * 0.78, ry * 0.72, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = hc ? 1 : 0.95;
        ctx.strokeStyle = hc ? '#ffffff' : '#fff4b8';
        ctx.lineWidth = 2 * lw;
        for (let i = 0; i < 4; i++) {
          const a = t * 0.45 + i * Math.PI / 2;
          const x1 = foot.x + Math.cos(a) * (rx - 5);
          const y1 = foot.y + 6 + Math.sin(a) * (ry - 2);
          const x2 = foot.x + Math.cos(a) * (rx + 9);
          const y2 = foot.y + 6 + Math.sin(a) * (ry + 4);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        ctx.restore();
      }

      drawActiveTargetBrackets(e, foot, scale = 1) {
        const bounds = this.getEntityTargetScreenBounds?.(e, { hitPaddingPx: 0 });
        if (!bounds) return;
        const pulse = 1 + Math.sin(performance.now() * 0.006) * 0.05;
        const left = bounds.cx - bounds.rx * 0.72 * pulse;
        const right = bounds.cx + bounds.rx * 0.72 * pulse;
        const top = bounds.cy - bounds.ry * 0.72 * pulse;
        const bottom = bounds.cy + bounds.ry * 0.72 * pulse;
        const len = Math.max(9, 10 * Math.min(1.5, scale));
        ctx.save();
        ctx.globalAlpha = 0.94;
        ctx.strokeStyle = 'rgba(22, 12, 3, 0.92)';
        ctx.lineWidth = 5;
        for (const [x, y, sx, sy] of [[left,top,1,1],[right,top,-1,1],[left,bottom,1,-1],[right,bottom,-1,-1]]) {
          ctx.beginPath(); ctx.moveTo(x + sx * len, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * len); ctx.stroke();
        }
        ctx.strokeStyle = '#ffe56d';
        ctx.lineWidth = 2.4;
        for (const [x, y, sx, sy] of [[left,top,1,1],[right,top,-1,1],[left,bottom,1,-1],[right,bottom,-1,-1]]) {
          ctx.beginPath(); ctx.moveTo(x + sx * len, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * len); ctx.stroke();
        }
        ctx.restore();
      }

      drawQuestTargetMarker(e, foot, scale = 1) {
        const t = performance.now() * 0.004 + (Number(e.id) || 0);
        const pulse = 0.5 + Math.sin(t) * 0.5;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.34 + pulse * 0.18;
        ctx.strokeStyle = '#ffd76a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(foot.x, foot.y + 6, 28 * scale + pulse * 4, 11 * scale + pulse * 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.65;
        ctx.fillStyle = '#ffe9a8';
        ctx.beginPath();
        ctx.moveTo(foot.x, foot.y - 84 - pulse * 4);
        ctx.lineTo(foot.x - 6, foot.y - 73 - pulse * 4);
        ctx.lineTo(foot.x + 6, foot.y - 73 - pulse * 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      classModelMaterial(classKey, trim) {
        const key = String(classKey || '').toLowerCase();
        const t = String(trim || '').toLowerCase();
        if (key === 'fighter' || t === 'plate' || t === 'mail') return 'metal';
        if (key === 'rogue' || t === 'leather') return 'leather';
        if (key === 'druid' || t === 'leaf') return 'natural';
        if (key === 'cleric' || t === 'holy') return 'blessedMetal';
        if (key === 'necromancer' || t === 'grave') return 'boneCloth';
        if (key === 'summoner' || key === 'enchanter' || t === 'arcane' || t === 'runes') return 'arcaneCloth';
        return 'cloth';
      }

      classModelGradient(x, y, points, base, material = 'cloth', alpha = 1, bob = 0) {
        const xs = points.map(p => x + p.x);
        const ys = points.map(p => y + p.y + bob);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const grad = ctx.createLinearGradient(minX, minY, maxX, maxY);
        const hi = material === 'metal' || material === 'blessedMetal' ? 42 : 24;
        const mid = material === 'leather' || material === 'boneCloth' ? -4 : 3;
        const low = material === 'arcaneCloth' ? -40 : -32;
        grad.addColorStop(0, colorShade(base, low));
        grad.addColorStop(0.28, colorShade(base, mid));
        grad.addColorStop(0.58, colorShade(base, hi));
        grad.addColorStop(1, colorShade(base, -24));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = grad;
        this.fillPoly(points.map(p => ({ x: x + p.x, y: y + p.y + bob })));
        ctx.restore();
      }

      strokePolyPath(x, y, points, strokeStyle, lineWidth = 1, alpha = 1, bob = 0) {
        if (!points?.length) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x + points[0].x, y + points[0].y + bob);
        for (let i = 1; i < points.length; i++) ctx.lineTo(x + points[i].x, y + points[i].y + bob);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      drawClassMaterialDetails(x, y, bob, opts = {}) {
        const material = opts.material || 'cloth';
        const classKey = opts.classKey || 'Fighter';
        const primary = opts.primary || '#777';
        const secondary = opts.secondary || '#999';
        const accent = opts.accent || '#eee';
        const skin = opts.skin || '#c89463';
        const faceMode = opts.faceMode || 'front';
        const move = opts.move || 0;
        const phase = opts.phase || 0;
        const pulse = Math.sin(performance.now() * 0.004 + x * 0.01) * 0.5 + 0.5;
        const front = faceMode !== 'back';
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // Soft rim light and ambient-occlusion pass. This is the canvas equivalent of a small post-lighting pass.
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.20;
        const rim = ctx.createLinearGradient(x - 22, y - 58 + bob, x + 25, y + 10 + bob);
        rim.addColorStop(0, 'rgba(255,255,220,0)');
        rim.addColorStop(0.72, 'rgba(255,255,225,0.55)');
        rim.addColorStop(1, 'rgba(255,255,255,0.05)');
        ctx.fillStyle = rim;
        this.fillPoly([{x:x-21,y:y-56+bob},{x:x+20,y:y-62+bob},{x:x+30,y:y-6+bob},{x:x+2,y:y+19+bob},{x:x-25,y:y+4+bob}]);
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = '#1b160e';
        this.fillPoly([{x:x-20,y:y-7+bob},{x:x+21,y:y-14+bob},{x:x+12,y:y+13+bob},{x:x-13,y:y+14+bob}]);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;

        const stitch = colorShade(accent, 18);
        if (material === 'metal' || material === 'blessedMetal') {
          ctx.strokeStyle = colorShade(secondary, 34);
          ctx.lineWidth = 1.4;
          for (let i = 0; i < 4; i++) {
            const yy = y - 27 + bob + i * 7;
            ctx.beginPath();
            ctx.moveTo(x - 12 + i * 2, yy);
            ctx.lineTo(x + 12 - i, yy - 3);
            ctx.stroke();
          }
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = material === 'blessedMetal' ? 0.45 : 0.26;
          ctx.strokeStyle = material === 'blessedMetal' ? '#fff0ba' : '#f7e2ad';
          ctx.lineWidth = 2.2;
          ctx.beginPath(); ctx.moveTo(x + 3, y - 34 + bob); ctx.lineTo(x + 15, y - 8 + bob); ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
        } else if (material === 'leather') {
          ctx.strokeStyle = colorShade(primary, -34);
          ctx.lineWidth = 1.3;
          for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(x - 14 + i * 6, y - 24 + bob + (i % 2) * 2);
            ctx.lineTo(x - 9 + i * 5, y + 2 + bob);
            ctx.stroke();
          }
          ctx.fillStyle = stitch;
          for (let i = 0; i < 5; i++) ctx.fillRect(x - 10 + i * 5, y - 13 + bob + (i % 2), 2, 2);
        } else if (material === 'natural') {
          ctx.fillStyle = colorShade(accent, -6);
          for (let i = 0; i < 6; i++) {
            const lx = x - 12 + i * 5;
            const ly = y - 26 + bob + Math.sin(phase + i) * 1.3;
            this.fillPoly([{x:lx,y:ly},{x:lx+6,y:ly-3},{x:lx+8,y:ly+2},{x:lx+3,y:ly+5}]);
          }
          ctx.strokeStyle = colorShade(primary, -28);
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x - 7, y - 22 + bob); ctx.quadraticCurveTo(x + 2, y - 12 + bob, x - 1, y + 6 + bob); ctx.stroke();
        } else if (material === 'arcaneCloth') {
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = 0.36 + pulse * 0.18;
          ctx.fillStyle = accent;
          for (let i = 0; i < 5; i++) {
            const rx = x - 12 + i * 6;
            const ry = y - 26 + bob + Math.sin(performance.now() * 0.003 + i) * 2;
            ctx.fillRect(rx, ry, 3, 3);
          }
          ctx.strokeStyle = accent;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x - 10, y - 10 + bob); ctx.lineTo(x + 11, y - 15 + bob); ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
        } else if (material === 'boneCloth') {
          ctx.strokeStyle = '#d8e5b4';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x - 8, y - 26 + bob); ctx.lineTo(x + 8, y - 30 + bob);
          ctx.moveTo(x - 9, y - 17 + bob); ctx.lineTo(x + 9, y - 20 + bob);
          ctx.moveTo(x - 5, y - 8 + bob); ctx.lineTo(x + 7, y - 10 + bob);
          ctx.stroke();
          ctx.globalAlpha = 0.26;
          ctx.fillStyle = '#9fb07a';
          ctx.beginPath(); ctx.ellipse(x + 4, y - 16 + bob, 17, 20, -0.25, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        } else {
          // Cloth weave/fabric detail.
          ctx.strokeStyle = colorShade(primary, 18);
          ctx.lineWidth = 0.8;
          ctx.globalAlpha = 0.28;
          for (let i = 0; i < 6; i++) {
            ctx.beginPath(); ctx.moveTo(x - 13, y - 25 + bob + i * 5); ctx.lineTo(x + 13, y - 30 + bob + i * 5); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x - 14 + i * 5, y - 30 + bob); ctx.lineTo(x - 9 + i * 5, y + 4 + bob); ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }

        // Class silhouette/readability pass.
        if (front) {
          if (classKey === 'Fighter') {
            // Fighter fallback: hide old plate/shield language and keep the light-leather bruiser read.
            ctx.fillStyle = colorShade(d.cloak || secondary, 8);
            this.fillPoly([{x:x-25,y:y-37+bob},{x:x-10,y:y-44+bob},{x:x+7,y:y-39+bob},{x:x-6,y:y-27+bob},{x:x-19,y:y-25+bob}]);
            this.fillPoly([{x:x+11,y:y-40+bob},{x:x+28,y:y-34+bob},{x:x+23,y:y-24+bob},{x:x+8,y:y-29+bob}]);
            ctx.strokeStyle = colorShade(primary, -35);
            ctx.lineWidth = 1.1;
            for (let i = -2; i <= 2; i++) {
              ctx.beginPath(); ctx.moveTo(x + i * 5, y - 33 + bob); ctx.lineTo(x + i * 4, y - 12 + bob); ctx.stroke();
            }
          } else if (classKey === 'Rogue') {
            ctx.fillStyle = colorShade(primary, -22);
            this.fillPoly([{x:x-19,y:y-31+bob},{x:x+11,y:y-38+bob},{x:x+19,y:y-29+bob},{x:x-8,y:y-24+bob}]);
            ctx.fillStyle = accent;
            this.fillPoly([{x:x+6,y:y-34+bob},{x:x+18,y:y-31+bob},{x:x+14,y:y-26+bob},{x:x+2,y:y-29+bob}]);
          } else if (classKey === 'Bard') {
            ctx.strokeStyle = accent;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(x - 14, y - 26 + bob); ctx.lineTo(x + 13, y + 4 + bob); ctx.stroke();
            ctx.fillStyle = colorShade(accent, 8);
            for (let i = 0; i < 4; i++) ctx.fillRect(x - 7 + i * 5, y - 13 + bob + i, 2, 2);
          } else if (classKey === 'Cleric') {
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = 0.35 + pulse * 0.16;
            ctx.strokeStyle = '#fff2bf'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(x + 2, y - 57 + bob, 15, 6, -0.2, 0, Math.PI * 2); ctx.stroke();
            ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
          } else if (classKey === 'Summoner') {
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = 0.30 + pulse * 0.18;
            ctx.strokeStyle = '#adfff6'; ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.arc(x - 17, y - 23 + bob, 7, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(x + 20, y - 25 + bob, 6, 0, Math.PI * 2); ctx.stroke();
            ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
          } else if (classKey === 'Enchanter') {
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = 0.24 + pulse * 0.14;
            ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
            for (let i = 0; i < 3; i++) {
              ctx.beginPath(); ctx.ellipse(x + Math.cos(phase + i * 2) * 19, y - 34 + bob + i * 5, 5, 2, 0, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
          }
        }

        // Skin bevels/highlights so faces/hands are not flat blocks.
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = colorShade(skin, 28);
        ctx.beginPath(); ctx.ellipse(x + 5, y - 51 + bob, 9, 5, -0.35, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
      }



      humanoidClassProfiles() {
        return {
          Bard: { primary: '#9167bf', secondary: '#d3a45d', accent: '#f0d38d', cloak: '#5f417f', hair: '#5a3824', head: 'feather', gear: 'lute', trim: 'mail' },
          Druid: { primary: '#5f8550', secondary: '#9a7b51', accent: '#a6d27d', cloak: '#495e34', hair: '#6a4b2e', head: 'hood', gear: 'staff', trim: 'leaf' },
          Enchanter: { primary: '#7762c3', secondary: '#b99fe7', accent: '#ded6ff', cloak: '#4e3f87', hair: '#281f36', head: 'circlet', gear: 'orb', trim: 'runes' },
          Fighter: { primary: '#5f3827', secondary: '#9b6240', accent: '#e2d7b7', cloak: '#6b5742', hair: '#2b1b14', head: 'warpaint', gear: 'greatsword', trim: 'leather' },
          Rogue: { primary: '#50555b', secondary: '#838b95', accent: '#d9dfe6', cloak: '#32363b', hair: '#2b221d', head: 'hood', gear: 'daggers', trim: 'leather' },
          Summoner: { primary: '#467b80', secondary: '#6cd4ca', accent: '#c4fffa', cloak: '#264f52', hair: '#233b3d', head: 'hornhood', gear: 'grimoire', trim: 'arcane' },
          Necromancer: { primary: '#55643b', secondary: '#8eab69', accent: '#d8e5b4', cloak: '#303822', hair: '#201f17', head: 'skullhood', gear: 'bonewand', trim: 'grave' },
          Cleric: { primary: '#cdbb84', secondary: '#f0e2a6', accent: '#fff7dc', cloak: '#8d7a53', hair: '#6b5632', head: 'hood', gear: 'macebook', trim: 'holy' }
        };
      }

      humanoidDirectionProfile(e) {
        const view = this.entityFacingView(e);
        const mode = view.mode || 'front';
        const side = view.side >= 0 ? 1 : -1;
        return {
          ...view,
          faceVisible: mode !== 'back',
          sideProfile: mode === 'side',
          chestVisible: mode !== 'back',
          cloakDominant: mode === 'back',
          visibleEyeCount: mode === 'side' ? 1 : (mode === 'back' ? 0 : 2),
          side
        };
      }

      humanoidPuppetContext(e, s, scale = 1) {
        const mercMap = { guardian: 'Paladin', cleric: 'Cleric', adept: 'Wizard', scout: 'Ranger' };
        const roleClass = e.kind === 'merc' ? (mercMap[e.roleKey] || 'Paladin') : null;
        const classKey = e.className || roleClass || (e.kind === 'player' ? 'Fighter' : 'Bard');
        const profiles = this.humanoidClassProfiles();
        const p = profiles[classKey] || profiles.Fighter;
        const equipped = e.kind === 'player' && this.equipment ? this.equipment : null;
        // Class silhouette must not be washed out by white/grey starter rarity colors.
        // Rarity stays for item borders/tooltips; visual body color comes from explicit item visuals, player choices, or the class profile.
        const primary = equipped?.chest?.visualColor || e.clothesPrimary || p.primary || e.color;
        const secondary = equipped?.legs?.visualColor || e.clothesSecondary || p.secondary;
        const headTone = equipped?.head?.visualColor || colorShade(secondary, -25);
        const bootTone = equipped?.feet?.visualColor || '#3c2a1d';
        const defaultSkin = e.kind === 'player' ? '#c89463' : '#bc8457';
        return {
          e, s, scale, classKey, profile: p,
          dir: this.humanoidDirectionProfile(e),
          skin: e.skinTone || defaultSkin,
          primary,
          primaryDark: colorShade(primary, -34),
          primaryDeep: colorShade(primary, -54),
          primaryLight: colorShade(primary, 18),
          secondary,
          secondaryDark: colorShade(secondary, -25),
          accent: p.accent,
          cloak: p.cloak,
          headTone,
          bootTone,
          material: this.classModelMaterial(classKey, p.trim)
        };
      }


      buildActorPose(actor, mode = 'stand', time = performance.now() * 0.001, profile = null) {
        const breathe = Math.sin(time * 2.0 + (actor?.id || 0) * 0.17) * 1.1;
        const root = { x: 0, y: 0 };
        if (mode === 'meditate') {
          const medBreathe = Math.sin(time * 2.2 + (actor?.id || 0) * 0.1) * 1.25;
          const pelvis = { x: 0, y: 20 };
          const chest = { x: 0, y: -4 + medBreathe };
          const neck = { x: 0, y: -18 + medBreathe };
          const head = { x: 0, y: -32 + medBreathe, top: -47 + medBreathe, bottom: -20 + medBreathe };
          return { mode, root, pelvis, chest, neck, head, breathe: medBreathe };
        }
        const fishing = mode === 'fishing';
        const headTurnX = profile?.headTurnX || 0;
        const pelvis = { x: (profile?.torsoTurn || 0) * 1.2, y: -4 + (fishing ? 1 : 0) };
        const chest = { x: (profile?.torsoTurn || 0) * 2.0, y: -31 + breathe + (fishing ? 2 : 0) };
        const neck = { x: headTurnX * 0.18, y: -49 + breathe + (fishing ? 2 : 0) };
        const head = { x: headTurnX, y: -58 + breathe + (fishing ? 2 : 0), top: -72 + breathe + (fishing ? 2 : 0), bottom: -43 + breathe + (fishing ? 2 : 0) };
        return { mode, root, pelvis, chest, neck, head, breathe };
      }

      setActorNameplateAnchor(actor, screen, scale, pose, bob = 0) {
        if (!actor || !screen || !pose?.head) return;
        actor._nameplateAnchor = {
          x: screen.x + (pose.head.x || 0) * scale,
          y: screen.y + bob + (pose.head.top ?? pose.head.y ?? -70) * scale
        };
      }


      drawHumanoid(e, s, scale) {
        if (e.meditating) {
          const puppet = this.humanoidPuppetContext(e, s, scale);
          const time = performance.now() * 0.001;
          puppet.poseJoints = this.buildActorPose(e, 'meditate', time, puppet.dir);
          this.setActorNameplateAnchor(e, s, scale, puppet.poseJoints, 0);
          this.drawMeditationAura(e, s.x, s.y, time, scale);
          this.drawTerrainMeditationResponse(e, s.x, s.y, time, scale);
          ctx.save();
          try {
            ctx.translate(s.x, s.y);
            ctx.scale(scale, scale);
            this.drawMeditatingBody(e, puppet, time);
          } finally {
            ctx.restore();
          }
          this.drawMeditationParticles(e, s.x, s.y, time, scale);
          return;
        }
        return this.drawStandingBody(e, s, scale);
      }

      drawMeditationAura(e, x, y, time, scale = 1) {
        const pulse = Math.sin(time * 3 + e.id * 0.19) * 0.08 + 1;
        const auraY = y + 42 * scale;
        ctx.save();
        ctx.translate(x, auraY);
        ctx.scale(scale, scale);
        ctx.globalCompositeOperation = 'screen';

        const outer = ctx.createRadialGradient(0, 0, 6, 0, 0, 82 * pulse);
        outer.addColorStop(0, 'rgba(220,252,255,0.50)');
        outer.addColorStop(0.34, 'rgba(92,205,255,0.34)');
        outer.addColorStop(0.68, 'rgba(45,118,240,0.18)');
        outer.addColorStop(1, 'rgba(10,38,95,0)');
        ctx.fillStyle = outer;
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        ctx.ellipse(0, 0, 64 * pulse, 24 * pulse, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.66;
        ctx.strokeStyle = 'rgba(130,230,255,0.92)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, 48 * pulse, 16 * pulse, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = 0.46;
        ctx.strokeStyle = 'rgba(200,250,255,0.82)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 30 / pulse, 10 / pulse, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = 0.24 + Math.sin(time * 2.1) * 0.06;
        ctx.strokeStyle = 'rgba(118,168,255,0.72)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 72 * (1.03 - (pulse - 1) * 0.3), 27 * (1.03 - (pulse - 1) * 0.3), 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      }

      drawMeditationParticles(e, x, y, time, scale = 1) {
        const particleCount = e.kind === 'player' ? 11 : 7;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (let i = 0; i < particleCount; i++) {
          const phase = time * 0.82 + i * 0.73 + e.id * 0.17;
          const drift = 16 + (i % 4) * 4;
          const px = x + Math.sin(phase) * drift * scale;
          const py = y + 34 * scale - ((phase * 23 * scale) % (78 * scale));
          const size = (1.7 + Math.sin(phase * 2.1) * 0.65 + (i % 3) * 0.28) * scale;
          ctx.globalAlpha = 0.22 + Math.max(0, Math.sin(phase)) * 0.26;
          ctx.fillStyle = i % 3 === 0 ? 'rgba(215,252,255,0.92)' : 'rgba(105,220,255,0.88)';
          ctx.beginPath();
          ctx.arc(px, py, Math.max(1.2, size), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      drawTerrainMeditationResponse(e, x, y, time, scale = 1) {
        const tile = this.tileAt?.(e.x, e.y);
        if (!tile) return;
        const type = String(tile.type || '').toLowerCase();
        ctx.save();
        ctx.globalAlpha = 0.20;
        ctx.globalCompositeOperation = 'screen';
        if (type.includes('water')) {
          ctx.strokeStyle = 'rgba(170,238,255,0.75)';
          ctx.lineWidth = 1.2 * scale;
          for (let i = 0; i < 3; i++) {
            const r = (20 + ((time * 30 + i * 18) % 46)) * scale;
            ctx.beginPath();
            ctx.ellipse(x, y + 42 * scale, r, r * 0.34, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (type.includes('dirt') || type.includes('path')) {
          ctx.fillStyle = 'rgba(210,188,130,0.35)';
          for (let i = 0; i < 8; i++) {
            const phase = time * 1.3 + i;
            ctx.beginPath();
            ctx.arc(x + Math.sin(phase) * 34 * scale, y + (28 - ((phase * 8) % 30)) * scale, 1.2 * scale, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          ctx.strokeStyle = 'rgba(132,216,142,0.42)';
          ctx.lineWidth = 1 * scale;
          for (let i = 0; i < 6; i++) {
            const gx = x + (-28 + i * 11) * scale;
            ctx.beginPath();
            ctx.moveTo(gx, y + 40 * scale);
            ctx.quadraticCurveTo(gx + Math.sin(time * 2 + i) * 4 * scale, y + 31 * scale, gx + 3 * scale, y + 26 * scale);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      puppetGradient(x1, y1, x2, y2, c0, c1, c2 = null) {
        const g = ctx.createLinearGradient(x1, y1, x2, y2);
        g.addColorStop(0, c0);
        g.addColorStop(0.58, c1);
        g.addColorStop(1, c2 || colorShade(c1, -28));
        return g;
      }

      drawPuppetPoly(points, fill, stroke = 'rgba(0,0,0,0.55)', width = 1.5) {
        ctx.save();
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = width;
        ctx.lineJoin = 'round';
        this.fillPoly(points);
        if (width > 0) {
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
          ctx.closePath();
          ctx.stroke();
        }
        ctx.restore();
      }

      drawMeditatingBody(e, puppet, time) {
        puppet.poseJoints = puppet.poseJoints || this.buildActorPose(e, 'meditate', time, puppet.dir);
        const breathe = puppet.poseJoints.breathe || 0;
        const p = puppet.profile;
        const dir = puppet.dir;
        const sideBias = dir.sideProfile ? dir.side * 3 : 0;

        this.drawMeditationBackCloth(puppet, breathe, sideBias);
        this.drawMeditationLegs(puppet, breathe, sideBias);
        this.drawMeditationTorso(puppet, breathe, sideBias);
        this.drawMeditationArms(puppet, breathe, sideBias);
        this.drawMeditationHands(puppet, breathe, sideBias);
        this.drawPuppetHead(puppet, breathe, sideBias);
        this.drawPuppetHairOrHood(puppet, breathe, sideBias);
        this.drawMeditationGearDetails(puppet, breathe, sideBias, time);
      }

      drawMeditationBackCloth(puppet, breathe, sideBias = 0) {
        const fill = this.puppetGradient(-24, -30, 30, 38, colorShade(puppet.cloak, 16), puppet.cloak, colorShade(puppet.cloak, -36));
        this.drawPuppetPoly([
          { x: -24 + sideBias, y: -20 + breathe },
          { x: 21 + sideBias, y: -22 + breathe },
          { x: 34, y: 20 },
          { x: 14, y: 36 },
          { x: -14, y: 36 },
          { x: -34, y: 20 }
        ], fill, colorShade(puppet.cloak, -42), 1.6);
      }

      drawMeditationLegs(puppet, breathe, sideBias = 0) {
        const leftFill = this.puppetGradient(-34, 15, -2, 40, colorShade(puppet.secondary, 10), puppet.secondaryDark, colorShade(puppet.secondaryDark, -22));
        const rightFill = this.puppetGradient(4, 15, 34, 40, colorShade(puppet.secondary, 20), puppet.secondary, colorShade(puppet.secondary, -18));
        this.drawPuppetPoly([{ x: -8 + sideBias * 0.3, y: 18 }, { x: -36, y: 28 }, { x: -24, y: 39 }, { x: 0, y: 29 }], leftFill, colorShade(puppet.secondaryDark, -35), 1.6);
        this.drawPuppetPoly([{ x: 9 + sideBias * 0.3, y: 18 }, { x: 36, y: 28 }, { x: 24, y: 39 }, { x: 0, y: 29 }], rightFill, colorShade(puppet.secondaryDark, -35), 1.6);
        ctx.fillStyle = colorShade(puppet.bootTone, -18);
        ctx.fillRect(-40, 31, 16, 7);
        ctx.fillStyle = puppet.bootTone;
        ctx.fillRect(24, 31, 16, 7);
      }

      drawMeditationTorso(puppet, breathe, sideBias = 0) {
        const bodyGrad = this.puppetGradient(-20, -30, 25, 30, colorShade(puppet.primary, 25), puppet.primary, colorShade(puppet.primaryDeep, -4));
        this.drawPuppetPoly([
          { x: -20 + sideBias, y: -20 + breathe },
          { x: 20 + sideBias, y: -20 + breathe },
          { x: 28, y: 22 },
          { x: 12, y: 34 },
          { x: -12, y: 34 },
          { x: -28, y: 22 }
        ], bodyGrad, colorShade(puppet.primaryDeep, -18), 1.7);

        const panel = this.puppetGradient(-8, -18, 10, 28, colorShade(puppet.primaryLight, 10), puppet.primaryDark, colorShade(puppet.primaryDark, -22));
        this.drawPuppetPoly([{ x: -9 + sideBias * 0.25, y: -15 + breathe }, { x: 10 + sideBias * 0.25, y: -15 + breathe }, { x: 8, y: 26 }, { x: -10, y: 26 }], panel, 'rgba(0,0,0,0.35)', 1.1);

        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = '#000';
        this.fillPoly([{ x: 4, y: -18 + breathe }, { x: 24, y: -5 + breathe }, { x: 23, y: 25 }, { x: 8, y: 33 }]);
        ctx.restore();
      }

      drawMeditationArms(puppet, breathe, sideBias = 0) {
        const sleeveL = this.puppetGradient(-34, -12, -8, 12, colorShade(puppet.primary, 12), puppet.primaryDeep);
        const sleeveR = this.puppetGradient(8, -12, 34, 12, colorShade(puppet.primary, 10), puppet.primaryDark);
        this.drawPuppetPoly([{ x: -30, y: -7 + breathe }, { x: -13, y: -11 + breathe }, { x: -8, y: 3 }, { x: -26, y: 10 }], sleeveL, colorShade(puppet.primaryDeep, -28), 1.4);
        this.drawPuppetPoly([{ x: 13, y: -11 + breathe }, { x: 30, y: -7 + breathe }, { x: 26, y: 10 }, { x: 8, y: 3 }], sleeveR, colorShade(puppet.primaryDeep, -28), 1.4);
      }

      drawMeditationHands(puppet, breathe, sideBias = 0) {
        ctx.fillStyle = puppet.skin;
        this.fillPoly([{ x: -24, y: 5 }, { x: -9, y: 2 }, { x: -8, y: 9 }, { x: -25, y: 12 }]);
        this.fillPoly([{ x: 9, y: 2 }, { x: 24, y: 5 }, { x: 25, y: 12 }, { x: 8, y: 9 }]);
        ctx.fillStyle = 'rgba(255,235,205,0.30)';
        ctx.fillRect(-18, 5, 6, 2);
        ctx.fillRect(12, 5, 6, 2);
      }

      drawPuppetHead(puppet, breathe, sideBias = 0) {
        const joints = puppet.poseJoints || {};
        const head = joints.head || { x: sideBias, y: -32 + breathe, top: -47 + breathe, bottom: -20 + breathe };
        const neck = joints.neck || { x: sideBias * 0.15, y: -18 + breathe };
        const dir = puppet.dir;

        ctx.fillStyle = colorShade(puppet.skin, -8);
        ctx.fillRect(neck.x - 5 + sideBias * 0.08, neck.y - 4, 10, 9);

        const hx = (head.x || 0) + sideBias * 0.28;
        const hy = head.y || (-32 + breathe);
        const faceGrad = this.puppetGradient(hx - 16, hy - 17, hx + 17, hy + 13, colorShade(puppet.skin, 22), puppet.skin, colorShade(puppet.skin, -18));
        this.drawPuppetPoly([
          { x: hx - 15, y: hy - 15 },
          { x: hx + 15, y: hy - 15 },
          { x: hx + 18, y: hy - 1 },
          { x: hx + 8, y: hy + 12 },
          { x: hx - 8, y: hy + 12 },
          { x: hx - 18, y: hy - 1 }
        ], faceGrad, '#3b2a24', 1.5);

        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#000';
        this.fillPoly([{ x: hx + 1, y: hy - 15 }, { x: hx + 18, y: hy - 1 }, { x: hx + 8, y: hy + 12 }, { x: hx + 1, y: hy + 12 }]);
        ctx.restore();

        if (dir.faceVisible) {
          ctx.fillStyle = '#1b1714';
          if (dir.visibleEyeCount === 2) {
            ctx.fillRect(hx - 9, hy - 3, 5, 2);
            ctx.fillRect(hx + 5, hy - 3, 5, 2);
          } else if (dir.visibleEyeCount === 1) {
            ctx.fillRect(hx + (dir.side >= 0 ? 5 : -9), hy - 3, 5, 2);
          }
        }
      }

      drawPuppetHairOrHood(puppet, breathe, sideBias = 0) {
        const joints = puppet.poseJoints || {};
        const head = joints.head || { x: sideBias, y: -32 + breathe };
        const hx = (head.x || 0) + sideBias * 0.28;
        const hy = head.y || (-32 + breathe);
        const p = puppet.profile;
        const hood = p.head === 'hood' || p.head === 'hornhood' || p.head === 'skullhood';
        const helm = p.head === 'helm';
        const color = helm ? puppet.headTone : (hood ? puppet.secondaryDark : p.hair);
        const stroke = colorShade(color, -32);
        this.drawPuppetPoly([
          { x: hx - 18, y: hy - 15 },
          { x: hx - 6, y: hy - 29 },
          { x: hx + 12, y: hy - 26 },
          { x: hx + 22, y: hy - 12 },
          { x: hx + 18, y: hy + 2 },
          { x: hx + 10, y: hy - 13 },
          { x: hx - 10, y: hy - 13 },
          { x: hx - 18, y: hy + 2 }
        ], this.puppetGradient(hx - 18, hy - 29, hx + 22, hy + 2, colorShade(color, 20), color, colorShade(color, -28)), stroke, 1.5);

        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = '#fff';
        this.fillPoly([{ x: hx - 10, y: hy - 18 }, { x: hx, y: hy - 26 }, { x: hx + 8, y: hy - 21 }, { x: hx - 2, y: hy - 16 }]);
        ctx.restore();

        if (p.head === 'feather') {
          this.drawPuppetPoly([{ x: hx + 4, y: hy - 27 }, { x: hx + 17, y: hy - 40 }, { x: hx + 13, y: hy - 22 }], puppet.accent, colorShade(puppet.accent, -30), 1);
        } else if (p.head === 'hornhood') {
          this.drawPuppetPoly([{ x: hx - 9, y: hy - 27 }, { x: hx - 4, y: hy - 39 }, { x: hx + 2, y: hy - 27 }], '#bdf7ee', '#6fb6ad', 1);
          this.drawPuppetPoly([{ x: hx + 9, y: hy - 27 }, { x: hx + 17, y: hy - 39 }, { x: hx + 17, y: hy - 24 }], '#bdf7ee', '#6fb6ad', 1);
        }
      }

      drawMeditationGearDetails(puppet, breathe, sideBias = 0, time = 0) {
        const p = puppet.profile;
        const accent = puppet.accent;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (p.trim === 'plate' || p.trim === 'mail' || p.trim === 'holy') {
          ctx.strokeStyle = p.trim === 'holy' ? '#fff2bc' : colorShade(puppet.secondary, 25);
          ctx.lineWidth = 1.4;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(-12 + i * 8, -16 + breathe + i * 4);
            ctx.lineTo(-5 + i * 8, 12 + i * 2);
            ctx.stroke();
          }
          if (p.trim === 'holy') {
            ctx.fillStyle = accent;
            ctx.fillRect(-2, -13 + breathe, 4, 23);
            ctx.fillRect(-8, -5 + breathe, 16, 4);
          }
        } else if (p.trim === 'leather') {
          ctx.strokeStyle = '#241b16';
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(-14, -12 + breathe); ctx.lineTo(13, 15); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(13, -10 + breathe); ctx.lineTo(-12, 16); ctx.stroke();
          ctx.fillStyle = accent;
          ctx.fillRect(-17, 10, 5, 5);
          ctx.fillRect(13, 11, 5, 5);
        } else if (p.trim === 'arcane' || p.trim === 'runes') {
          ctx.globalCompositeOperation = 'screen';
          ctx.fillStyle = p.trim === 'arcane' ? '#bff7ff' : accent;
          for (let i = 0; i < 5; i++) {
            const a = time * 1.3 + i * 1.2;
            ctx.globalAlpha = 0.42 + Math.sin(a) * 0.18;
            ctx.fillRect(-11 + i * 5, -12 + Math.sin(a) * 2, 3, 3);
          }
        } else if (p.trim === 'leaf') {
          ctx.fillStyle = accent;
          for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.ellipse(-12 + i * 6, -10 + i * 5, 3, 1.8, 0.5, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (p.trim === 'grave') {
          ctx.strokeStyle = '#dcecb8';
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(-8, -13 + breathe); ctx.lineTo(8, 9); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(8, -12 + breathe); ctx.lineTo(-8, 9); ctx.stroke();
          ctx.fillStyle = '#dcecb8';
          ctx.fillRect(-2, -2, 4, 4);
        }
        ctx.restore();
      }


      standingDirectionProfile(e) {
        // V0.19.9: `Math.sign(e.facingY || 1)` made fy === 0 IMPOSSIBLE. facingY is legitimately 0 when an
        // entity faces due east or west, and `0 || 1` is 1 - so the `fy === 0` branch below could never be
        // taken, and the authored 'east'/'west' poses it selects (sideProfile, torsoTurn 1, one visible
        // eye) were DEAD CODE. Those entities rendered as southeast/southwest 3/4 diagonals instead.
        // At the default camera yaw the iso projection makes all four cardinals mode 'side', which is why
        // north/south get the side-profile override below - east/west were meant to reach their own
        // side-profile poses the same way. A MISSING facing must still default to south (1), so only a
        // non-finite value may be defaulted; zero is a real value. See also actorFacingVector (V0.19.7).
        const rawFx = Number(e.facingX), rawFy = Number(e.facingY);
        const fx = Math.sign(Number.isFinite(rawFx) ? rawFx : 0);
        const fy = Math.sign(Number.isFinite(rawFy) ? rawFy : 1);
        const view = this.entityFacingView(e);
        const side = view.side >= 0 ? 1 : -1;
        const key = fy < 0 ? (fx < 0 ? 'northwest' : fx > 0 ? 'northeast' : 'north')
          : fy > 0 ? (fx < 0 ? 'southwest' : fx > 0 ? 'southeast' : 'south')
          : (fx < 0 ? 'west' : 'east');
        const profiles = {
          south: { key:'south', faceVisible:true, backVisible:false, diagonal:false, sideProfile:false, headTurnX:0, torsoTurn:0, frontArmSide:'right', frontLegSide:'right', shoulderSkew:0, cloakBias:0, visibleEyeCount:2 },
          southeast: { key:'southeast', faceVisible:true, backVisible:false, diagonal:true, sideProfile:false, headTurnX:4, torsoTurn:0.45, frontArmSide:'right', frontLegSide:'right', shoulderSkew:5, cloakBias:4, visibleEyeCount:2 },
          east: { key:'east', faceVisible:true, backVisible:false, diagonal:false, sideProfile:true, headTurnX:7, torsoTurn:1, frontArmSide:'right', frontLegSide:'right', shoulderSkew:8, cloakBias:6, visibleEyeCount:1 },
          northeast: { key:'northeast', faceVisible:false, backVisible:true, diagonal:true, sideProfile:false, headTurnX:3, torsoTurn:0.35, frontArmSide:'right', frontLegSide:'right', shoulderSkew:4, cloakBias:7, visibleEyeCount:0 },
          north: { key:'north', faceVisible:false, backVisible:true, diagonal:false, sideProfile:false, headTurnX:0, torsoTurn:0, frontArmSide:'left', frontLegSide:'left', shoulderSkew:0, cloakBias:0, visibleEyeCount:0 },
          northwest: { key:'northwest', faceVisible:false, backVisible:true, diagonal:true, sideProfile:false, headTurnX:-3, torsoTurn:-0.35, frontArmSide:'left', frontLegSide:'left', shoulderSkew:-4, cloakBias:-7, visibleEyeCount:0 },
          west: { key:'west', faceVisible:true, backVisible:false, diagonal:false, sideProfile:true, headTurnX:-7, torsoTurn:-1, frontArmSide:'left', frontLegSide:'left', shoulderSkew:-8, cloakBias:-6, visibleEyeCount:1 },
          southwest: { key:'southwest', faceVisible:true, backVisible:false, diagonal:true, sideProfile:false, headTurnX:-4, torsoTurn:-0.45, frontArmSide:'left', frontLegSide:'left', shoulderSkew:-5, cloakBias:-4, visibleEyeCount:2 }
        };
        const profile = { ...profiles[key] };
        profile.side = side;
        profile.key = key;
        // camera-aware overrides for pure side views
        if (view.mode === 'side' && profile.sideProfile === false && (key === 'north' || key === 'south')) {
          profile.sideProfile = true;
          profile.faceVisible = key === 'south';
          profile.backVisible = key === 'north';
          profile.visibleEyeCount = key === 'south' ? 1 : 0;
          profile.headTurnX = side * 7;
          profile.shoulderSkew = side * 8;
          profile.frontArmSide = side > 0 ? 'right' : 'left';
          profile.frontLegSide = side > 0 ? 'right' : 'left';
        }
        return profile;
      }

      getStandingPuppetPose(e, time = performance.now() * 0.001) {
        const fishing = e.kind === 'player' && e.fishing;
        // V0.20.64 (Roadmap Item 7.G "enter appropriate travel animations"): a rider does not walk.
        // Suppressing the stride here - in the ONE place the humanoid pose is derived - means every
        // class model inherits the riding pose without fourteen separate edits.
        const riding = !!(e.mounted && e.mountId);
        const travelling = (e.moveBlend || 0) > 0.08;
        const moving = !fishing && !riding && travelling;
        const stepSpeed = moving ? 8.5 : 1.5;
        const step = (e.walkCycle || time * stepSpeed);
        if (riding) {
          // Seated: legs still and straddled, torso rising and falling with the mount's gait rather
          // than with a footstep cycle. The gait uses the same 8.5 rate the quadruped models run at,
          // so rider and beast bob together instead of drifting in and out of phase.
          const gait = travelling ? -Math.abs(Math.sin(time * 8.5)) * 2.4 : Math.sin(time * 1.8) * 0.5;
          const lean = travelling ? 1.6 : 0.6;
          return {
            fishing: false,
            mode: 'ride',
            riding: true,
            moving: false,
            step,
            breathe: Math.sin(time * 2.0 + (e.id || 0) * 0.17) * 1.0,
            bob: gait,
            armSwing: Math.sin(time * 8.5) * 1.2,
            legSwing: 0,
            legSpread: 6.5,      // knees out over the barrel of the animal
            legLift: 4.5,        // feet ride higher than they would on the ground
            rideLean: lean,
            attackPhase: 1 - clamp(e.attackAnim || 0, 0, 1)
          };
        }
        const attackPhase = 1 - clamp(e.attackAnim || 0, 0, 1);
        const attackSwing = fishing ? 0 : Math.sin(attackPhase * Math.PI) * 8;
        return {
          fishing,
          mode: fishing ? 'fishing' : (moving ? 'walk' : 'idle'),
          moving,
          step,
          breathe: Math.sin(time * 2.0 + (e.id || 0) * 0.17) * 1.2,
          bob: moving ? -Math.abs(Math.sin(step)) * 2.1 : 0,
          armSwing: fishing ? 0 : ((moving ? Math.sin(step) * 5 : 0) + attackSwing),
          legSwing: moving ? Math.sin(step) * 4.5 : 0,
          sway: moving ? Math.sin(step * 0.5) * 1.8 : 0,
          cloakSwing: moving ? Math.sin(step * 0.65) * 5.5 : 0
        };
      }

      classLocksStandingWeaponArt(actor = {}) {
        const source = actor?.sourceEntity || {};
        const cls = String(
          actor.className || actor.playerClass || actor.classId || actor.role || actor.type ||
          source.className || source.playerClass || source.classId || source.role || source.type || ''
        ).toLowerCase().replace(/[\s_\-]/g, '');
        return cls === 'ranger' || cls === 'warden' || cls === 'shaman' || cls.includes('ranger') || cls.includes('warden') || cls.includes('shaman');
      }

      standingHumanoidContext(e, s, scale = 1) {
        const puppet = this.humanoidPuppetContext(e, s, scale);
        const profile = this.standingDirectionProfile(e);
        const time = performance.now() * 0.001;
        const pose = this.getStandingPuppetPose(e, time);
        const equipped = e.kind === 'player' && this.equipment ? this.equipment : null;
        const classVisuals = {
          Rogue: { hood:true, mask:true, cloak:true, weapons:['dagger','dagger'], beltPouches:true, shoulderArmor:false },
          Cleric: { hood:false, robe:true, cloak:false, weapons:['mace','book'], holySymbol:true, shoulderArmor:false },
          Fighter: { helmet:false, shoulderArmor:false, fur:true, cloak:false, weapons:['greatsword', null], holySymbol:false },
          Druid: { hood:true, fur:true, cloak:true, weapons:['staff'], leaves:true },
          Ranger: { hood:true, cloak:true, weapons:['bow', null], shoulderArmor:false },
          Warden: { hood:true, fur:true, cloak:true, weapons:['mace', 'shield'], shoulderArmor:true },
          Shaman: { hood:false, fur:true, robe:true, weapons:['staff', null], runes:true, shoulderArmor:false },
          Bard: { hood:false, sash:true, cloak:true, weapons:['lute','dagger'], instrument:true },
          Enchanter: { circlet:true, robe:true, weapons:['wand','orb'], runes:true },
          Summoner: { hood:true, robe:true, weapons:['book','focus'], arcane:true },
          Necromancer: { hood:true, robe:true, weapons:['bonewand','skull'], grave:true }
        };
        const visual = { ...(classVisuals[puppet.classKey] || classVisuals.Fighter) };
        visual.suppressDefaultWeapon = this.actorHasEquippedWeapon?.(e) || false;
        visual.suppressDefaultOffhand = this.actorHasEquippedOffhand?.(e) || false;
        if (this.classLocksStandingWeaponArt?.(e)) {
          visual.suppressDefaultWeapon = true;
          visual.suppressDefaultOffhand = true;
        }
        if (Array.isArray(visual.weapons)) {
          visual.weapons = visual.weapons.slice();
          if (visual.suppressDefaultWeapon) visual.weapons[0] = null;
          if (visual.suppressDefaultWeapon || visual.suppressDefaultOffhand) visual.weapons[1] = null;
        }
        if (pose.fishing) visual.weapons = [];
        const joints = this.buildActorPose(e, pose.fishing ? 'fishing' : 'stand', time, profile);
        return { ...puppet, dir: profile, pose, time, visual, equipped, joints };
      }

      drawStandingBody(e, s, scale) {
        const d = this.standingHumanoidContext(e, s, scale);
        const x = s.x | 0;
        const y = s.y | 0;
        this.setActorNameplateAnchor(e, s, scale, d.joints, d.pose.bob);
        ctx.save();
        try {
          ctx.translate(x, y + d.pose.bob);
          ctx.scale(scale, scale);
          this.drawStandingBackEquipment(d);
          this.drawStandingLegs(d);
          this.drawStandingBoots(d);
          this.drawStandingTorsoBase(d);
          this.drawStandingChestPanels(d);
          this.drawStandingArms(d);
          this.drawStandingHands(d);
          this.drawStandingHeldWeapons(d);
          this.drawStandingNeck(d);
          this.drawStandingHead(d);
          this.drawStandingHairOrHelmet(d);
          this.drawStandingClassDetails(d);
          if (d.pose.fishing) this.drawFishingActionOverlay(d, s, scale);
        } finally {
          ctx.restore();
        }
      }

      drawStandingBackEquipment(d) {
        const p=d.profile, pose=d.pose, dir=d.dir, v=d.visual;
        if (v.cloak || dir.backVisible) {
          const cloakGrad = this.puppetGradient(-24, -44, 26, 12, colorShade(d.cloak, 18), d.cloak, colorShade(d.cloak, -34));
          this.drawPuppetPoly([
            {x:-20 + dir.shoulderSkew * -0.16, y:-32 + pose.breathe},
            {x:18 + dir.shoulderSkew * 0.16, y:-34 + pose.breathe},
            {x:22 + dir.cloakBias * 0.4, y:-8 + pose.cloakSwing * 0.25},
            {x:10 + dir.cloakBias * 0.2, y:18},
            {x:-10 + dir.cloakBias * -0.2, y:19},
            {x:-24 + dir.cloakBias * -0.5, y:-6 + pose.cloakSwing * -0.2}
          ], cloakGrad, colorShade(d.cloak, -42), 1.5);
        }
        // back-slung default gear silhouettes. Hide them while paperdoll gear owns the weapon slot.
        if (v.suppressDefaultWeapon) return;
        const gear = d.profile.gear || d.classKey;
        ctx.save();
        ctx.lineCap='round'; ctx.lineJoin='round';
        if (gear === 'staff' || gear === 'bonewand' || gear === 'greatsword') {
          ctx.strokeStyle = gear === 'bonewand' ? '#d9e2b2' : gear === 'greatsword' ? d.accent : '#8a6236';
          ctx.lineWidth = gear === 'greatsword' ? 5 : 4;
          ctx.beginPath(); ctx.moveTo(-18, 10); ctx.lineTo(22, -54); ctx.stroke();
        } else if (gear === 'grimoire') {
          const fill = this.puppetGradient(-22, -22, -4, 2, colorShade(d.secondary,18), d.secondary, colorShade(d.secondary,-22));
          this.drawPuppetPoly([{x:-22,y:-20},{x:-8,y:-24},{x:-2,y:-6},{x:-18,y:-2}], fill, colorShade(d.secondaryDark,-22), 1.2);
        } else if (gear === 'lute') {
          ctx.fillStyle = '#8b6236'; ctx.beginPath(); ctx.ellipse(-17,-5,8,11,0.25,0,Math.PI*2); ctx.fill();
          ctx.strokeStyle = '#b98d53'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-15,-14); ctx.lineTo(-7,-28); ctx.stroke();
        }
        ctx.restore();
      }

      drawStandingLegShape(x, y, isBack, fill, d) {
        ctx.save();
        ctx.globalAlpha = isBack ? 0.84 : 1;
        this.drawPuppetPoly([
          {x:x-6, y:y}, {x:x+6, y:y}, {x:x+8, y:y+20}, {x:x+3, y:y+30}, {x:x-7, y:y+30}, {x:x-8, y:y+20}
        ], fill, '#183a25', 1.5);
        ctx.restore();
      }

      // V0.20.69: a RIDING leg, built as two segments with a real knee joint. The standing leg is a
      // single straight polygon, which is why offsetting it sideways still read as "standing on top of
      // the animal" rather than sitting on it. Here the thigh runs outward across the mount's back and
      // the shin drops down its flank, which is the silhouette that actually says "riding".
      // Returns the foot position so the boot follows the shin instead of floating at the hip.
      drawRidingLegShape(x, y, isBack, fill, d, sideSign) {
        const s = sideSign >= 0 ? 1 : -1;
        const kneeX = x + s * 11;
        const footX = x + s * 13;
        ctx.save();
        ctx.globalAlpha = isBack ? 0.8 : 1;
        // thigh - hip to knee, splayed out over the barrel of the beast
        this.drawPuppetPoly([
          { x: x - 6, y }, { x: x + 6, y },
          { x: kneeX + s * 5, y: y + 14 }, { x: kneeX - s * 5, y: y + 16 }
        ], fill, '#183a25', 1.5);
        // shin - knee to foot, hanging down the flank
        this.drawPuppetPoly([
          { x: kneeX - s * 5, y: y + 12 }, { x: kneeX + s * 5, y: y + 12 },
          { x: footX + s * 4, y: y + 30 }, { x: footX - s * 5, y: y + 30 }
        ], fill, '#183a25', 1.5);
        ctx.restore();
        return { footX, footY: y + 30 };
      }

      drawStandingLegs(d) {
        const p=d.pose, dir=d.dir;
        const frontRight = dir.frontLegSide === 'right';
        // V0.20.69: riding uses bent legs rather than the straight standing polygon.
        if (p.riding) {
          const backFill = this.puppetGradient(-14, -6, 0, 26, colorShade(d.secondary, 4), d.secondaryDark, colorShade(d.secondaryDark, -18));
          const frontFill = this.puppetGradient(2, -6, 18, 26, colorShade(d.secondary, 18), d.secondary, colorShade(d.secondary, -18));
          const baseY = -8 - (Number(p.legLift) || 0);
          const lx = -5 + dir.torsoTurn * 1.2;
          const rx = 5 + dir.torsoTurn * 1.2;
          if (frontRight) {
            this.drawRidingLegShape(lx, baseY, true, backFill, d, -1);
            this.drawRidingLegShape(rx, baseY, false, frontFill, d, 1);
          } else {
            this.drawRidingLegShape(rx, baseY, true, backFill, d, 1);
            this.drawRidingLegShape(lx, baseY, false, frontFill, d, -1);
          }
          return;
        }
        // legSpread/legLift are set only by the riding pose - 0 for everyone else, so
        // walking and idle geometry is byte-identical to before.
        const spread = Number(p.legSpread) || 0;
        const lift = Number(p.legLift) || 0;
        const leftY = Math.sin(p.step) * 2.2 + p.legSwing * 0.15 - lift;
        const rightY = Math.sin(p.step + Math.PI) * 2.2 - p.legSwing * 0.15 - lift;
        const leftX = -8 - spread + (frontRight ? -1.2 : 0.4) + dir.torsoTurn * 1.2;
        const rightX = 8 + spread + (frontRight ? 0.4 : 1.2) + dir.torsoTurn * 1.2;
        const backFill = this.puppetGradient(-14, -6, 0, 26, colorShade(d.secondary, 4), d.secondaryDark, colorShade(d.secondaryDark, -18));
        const frontFill = this.puppetGradient(2, -6, 18, 26, colorShade(d.secondary, 18), d.secondary, colorShade(d.secondary, -18));
        if (frontRight) {
          this.drawStandingLegShape(leftX, -8 + leftY, true, backFill, d);
          this.drawStandingLegShape(rightX, -8 + rightY, false, frontFill, d);
        } else {
          this.drawStandingLegShape(rightX, -8 + rightY, true, backFill, d);
          this.drawStandingLegShape(leftX, -8 + leftY, false, frontFill, d);
        }
      }

      drawStandingBoots(d) {
        const p=d.pose, dir=d.dir;
        const frontRight = dir.frontLegSide === 'right';
        // V0.20.69: while riding, the boot must sit at the END OF THE SHIN. The standing boot is
        // positioned from the hip, which on a bent riding leg leaves it hanging in mid-air.
        if (p.riding) {
          const baseY = -8 - (Number(p.legLift) || 0);
          const bootAt = (hipX, s, isBack) => {
            const x = hipX + s * 13;
            const y = baseY + 30;
            ctx.save();
            ctx.globalAlpha = isBack ? 0.85 : 1;
            ctx.fillStyle = d.bootTone; ctx.strokeStyle = '#2a2520'; ctx.lineWidth = 1.4;
            // Angled slightly heel-down, the way a foot sits in a stirrup.
            ctx.beginPath();
            ctx.moveTo(x - s * 6, y - 3); ctx.lineTo(x + s * 6, y - 1);
            ctx.lineTo(x + s * 7, y + 6); ctx.lineTo(x - s * 6, y + 5);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = d.accent; ctx.globalAlpha *= 0.38;
            ctx.fillRect(x - s * 4, y - 1, 6, 2);
            ctx.restore();
          };
          const lx = -5 + dir.torsoTurn * 1.2;
          const rx = 5 + dir.torsoTurn * 1.2;
          if (frontRight) { bootAt(lx, -1, true); bootAt(rx, 1, false); }
          else { bootAt(rx, 1, true); bootAt(lx, -1, false); }
          return;
        }
        // legSpread/legLift are set only by the riding pose - 0 for everyone else, so
        // walking and idle geometry is byte-identical to before.
        const spread = Number(p.legSpread) || 0;
        const lift = Number(p.legLift) || 0;
        const leftY = Math.sin(p.step) * 2.2 + p.legSwing * 0.15 - lift;
        const rightY = Math.sin(p.step + Math.PI) * 2.2 - p.legSwing * 0.15 - lift;
        const leftX = -8 - spread + (frontRight ? -1.2 : 0.4) + dir.torsoTurn * 1.2;
        const rightX = 8 + spread + (frontRight ? 0.4 : 1.2) + dir.torsoTurn * 1.2;
        const drawBoot = (x,y,isBack) => {
          ctx.save(); ctx.globalAlpha = isBack ? 0.85 : 1; ctx.fillStyle = d.bootTone; ctx.strokeStyle = '#2a2520'; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(x-9,y+27); ctx.lineTo(x+9,y+27); ctx.lineTo(x+11,y+34); ctx.lineTo(x-8,y+34); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = d.accent; ctx.globalAlpha *= 0.38; ctx.fillRect(x-3,y+27,7,2); ctx.restore();
        };
        if (frontRight) { drawBoot(leftX, -8 + leftY, true); drawBoot(rightX, -8 + rightY, false); }
        else { drawBoot(rightX, -8 + rightY, true); drawBoot(leftX, -8 + leftY, false); }
      }

      drawStandingTorsoBase(d) {
        const p = d.pose, dir = d.dir;
        const armorGradient = this.puppetGradient(-18, -42, 18, -12, colorShade(d.primary, 26), d.primary, d.primaryDeep);
        this.drawPuppetPoly([
          {x:-19 + dir.shoulderSkew * -0.25, y:-42 + p.breathe},
          {x:19 + dir.shoulderSkew * 0.25, y:-42 + p.breathe},
          {x:14 + dir.torsoTurn * 2.1, y:-16},
          {x:7 + dir.torsoTurn * 1.7, y:-5},
          {x:-7 + dir.torsoTurn * 1.3, y:-5},
          {x:-14 + dir.torsoTurn * 0.8, y:-16}
        ], armorGradient, '#2e3532', 1.7);
        ctx.save();
        ctx.globalAlpha = 0.15; ctx.fillStyle = '#fff';
        this.fillPoly([{x:-5,y:-38+p.breathe},{x:6,y:-38+p.breathe},{x:4,y:-10},{x:-4,y:-10}]);
        ctx.restore();
      }

      drawStandingChestPanels(d) {
        const p=d.pose, dir=d.dir;
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        this.fillPoly([{x:-5+dir.torsoTurn*0.6,y:-38+p.breathe},{x:6+dir.torsoTurn*0.6,y:-38+p.breathe},{x:4+dir.torsoTurn*0.4,y:-10},{x:-4+dir.torsoTurn*0.2,y:-10}]);
        ctx.fillStyle = '#4a2d1c';
        ctx.fillRect(-16, -15, 32, 5);
        ctx.fillStyle = '#b88b47';
        ctx.fillRect(-3, -16, 6, 6);
        // Shoulder/collar structure: breaks the slab torso and gives the model a stronger humanoid read.
        ctx.fillStyle = colorShade(d.primaryLight, 10);
        this.fillPoly([{x:-15+dir.shoulderSkew*-0.18,y:-38+p.breathe},{x:-3,y:-41+p.breathe},{x:-4,y:-34+p.breathe},{x:-17,y:-31+p.breathe}]);
        this.fillPoly([{x:3,y:-41+p.breathe},{x:15+dir.shoulderSkew*0.18,y:-38+p.breathe},{x:17,y:-31+p.breathe},{x:4,y:-34+p.breathe}]);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        this.fillPoly([{x:7+dir.torsoTurn,y:-36+p.breathe},{x:15+dir.shoulderSkew*0.18,y:-32+p.breathe},{x:12,y:-12},{x:6,y:-8}]);
        if (d.profile.trim === 'holy') { ctx.fillStyle=d.accent; ctx.fillRect(-2,-28,4,18); ctx.fillRect(-7,-21,14,4); }
        if (d.profile.trim === 'arcane' || d.profile.trim === 'runes') {
          ctx.save(); ctx.globalCompositeOperation='screen'; ctx.globalAlpha=0.72; ctx.fillStyle=d.accent;
          ctx.fillRect(-8,-27,3,3); ctx.fillRect(0,-20,3,3); ctx.fillRect(6,-13,3,3); ctx.restore();
        }
        if (d.profile.trim === 'leaf') { ctx.fillStyle=d.accent; ctx.fillRect(-8,-24,4,3); ctx.fillRect(5,-16,4,3); }
        if (d.profile.trim === 'plate') { ctx.fillStyle=d.accent; ctx.fillRect(-11,-21,5,3); ctx.fillRect(-3,-23,5,3); ctx.fillRect(5,-25,5,3); }
      }

      drawStandingSingleArm(shoulderX, shoulderY, handX, handY, isBack, sleeveColor, d) {
        ctx.save();
        ctx.globalAlpha = isBack ? 0.82 : 1;
        ctx.strokeStyle = sleeveColor;
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(shoulderX, shoulderY); ctx.lineTo((shoulderX+handX)*0.5 + (isBack?-1:1), (shoulderY+handY)*0.52); ctx.lineTo(handX, handY); ctx.stroke();
        ctx.strokeStyle = '#303836'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(shoulderX, shoulderY); ctx.lineTo((shoulderX+handX)*0.5 + (isBack?-1:1), (shoulderY+handY)*0.52); ctx.lineTo(handX, handY); ctx.stroke();
        ctx.fillStyle = d.skin; ctx.beginPath(); ctx.arc(handX, handY, 4, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      }

      drawStandingArms(d) {
        const p=d.pose, dir=d.dir;
        const swing = p.armSwing;
        const backIsLeft = dir.frontArmSide === 'right';
        let leftHandX = -24 + dir.torsoTurn * 2;
        let leftHandY = -18 + swing;
        let rightHandX = 24 + dir.torsoTurn * 2;
        let rightHandY = -18 - swing;
        if (p.fishing) {
          const side = dir.side >= 0 ? 1 : -1;
          rightHandX = 26 * side + dir.torsoTurn * 1.5;
          rightHandY = -28 + p.breathe * 0.2;
          leftHandX = 8 * side + dir.torsoTurn;
          leftHandY = -18 + p.breathe * 0.15;
        }
        if (backIsLeft) {
          this.drawStandingSingleArm(-18 + dir.shoulderSkew * -0.22, -36 + p.breathe, leftHandX, leftHandY, true, d.primaryDark, d);
          this.drawStandingSingleArm(18 + dir.shoulderSkew * 0.22, -36 + p.breathe, rightHandX, rightHandY, false, d.primary, d);
        } else {
          this.drawStandingSingleArm(18 + dir.shoulderSkew * 0.22, -36 + p.breathe, rightHandX, rightHandY, true, d.primaryDark, d);
          this.drawStandingSingleArm(-18 + dir.shoulderSkew * -0.22, -36 + p.breathe, leftHandX, leftHandY, false, d.primary, d);
        }
        d._handPoints = { left:{x:leftHandX,y:leftHandY}, right:{x:rightHandX,y:rightHandY}, backIsLeft };
      }

      drawStandingHands(d) {
        // hands are rendered as part of arm pass; keep hook for draw order clarity
      }

      drawStandingWeaponShape(type, grip, d, isOffhand = false) {
        ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
        const x=grip.x, y=grip.y;
        switch(type){
          case 'dagger':
            ctx.strokeStyle='#d9dfe6'; ctx.lineWidth=2.4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (isOffhand?-8:8), y-10); ctx.stroke();
            ctx.strokeStyle='#5d4631'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x-2, y+1); ctx.lineTo(x+2, y-1); ctx.stroke(); break;
          case 'shield':
            this.drawPuppetPoly([{x:x-8,y:y-10},{x:x+6,y:y-10},{x:x+10,y:y+2},{x:x+4,y:y+13},{x:x-7,y:y+11},{x:x-10,y:y+1}], this.puppetGradient(x-8,y-10,x+10,y+12,colorShade(d.secondary,18), d.secondary, colorShade(d.secondary,-24)), '#463a26', 1.4);
            ctx.fillStyle=d.accent; ctx.fillRect(x-1,y-8,3,17); ctx.fillRect(x-5,y-1,12,3); break;
          case 'sword':
            ctx.strokeStyle='#d9dfe6'; ctx.lineWidth=3.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (d.dir.frontArmSide==='right'?10:-10), y-18); ctx.stroke();
            ctx.strokeStyle='#87683c'; ctx.lineWidth=2.4; ctx.beginPath(); ctx.moveTo(x-4,y+1); ctx.lineTo(x+4,y-1); ctx.stroke(); break;
          case 'greatsword': {
            const dir = d.dir.frontArmSide === 'right' ? 1 : -1;
            ctx.strokeStyle = '#15100c'; ctx.lineWidth = 6.2; ctx.beginPath(); ctx.moveTo(x - dir * 4, y + 7); ctx.lineTo(x + dir * 22, y - 42); ctx.stroke();
            ctx.strokeStyle = '#d8cfb3'; ctx.lineWidth = 4.2; ctx.beginPath(); ctx.moveTo(x - dir * 4, y + 7); ctx.lineTo(x + dir * 22, y - 42); ctx.stroke();
            ctx.strokeStyle = '#5d3a22'; ctx.lineWidth = 3.0; ctx.beginPath(); ctx.moveTo(x - dir * 8, y + 2); ctx.lineTo(x + dir * 8, y - 5); ctx.stroke();
            break;
          }
          case 'mace':
            ctx.strokeStyle='#8a6236'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (d.dir.frontArmSide==='right'?7:-7), y-15); ctx.stroke();
            ctx.fillStyle='#d0c59a'; ctx.beginPath(); ctx.arc(x + (d.dir.frontArmSide==='right'?8:-8), y-18, 5, 0, Math.PI*2); ctx.fill(); break;
          case 'staff':
          case 'bonewand':
            ctx.strokeStyle= type==='bonewand' ? '#d9e2b2' : '#8a6236'; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(x, y+4); ctx.lineTo(x + (d.dir.frontArmSide==='right'?8:-8), y-22); ctx.stroke(); break;
          case 'wand':
            ctx.strokeStyle='#ded6ff'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (d.dir.frontArmSide==='right'?9:-9), y-12); ctx.stroke(); break;
          case 'orb':
          case 'focus':
          case 'skull':
            ctx.fillStyle= type==='skull' ? '#dcecb8' : d.accent; ctx.beginPath(); ctx.arc(x + (isOffhand?-6:6), y-4, 5, 0, Math.PI*2); ctx.fill(); break;
          case 'book':
          case 'grimoire':
          case 'lute':
            this.drawPuppetPoly([{x:x-7,y:y-9},{x:x+7,y:y-11},{x:x+8,y:y+4},{x:x-6,y:y+6}], this.puppetGradient(x-8,y-11,x+8,y+6,colorShade(d.secondary,15), d.secondary, colorShade(d.secondary,-22)), '#3e3227', 1.2); break;
        }
        ctx.restore();
      }

      drawStandingHeldWeapons(d) {
        if (this.classLocksStandingWeaponArt?.(d?.actor)) return;
        const v=d.visual, hp=d._handPoints || {};
        const frontHand = d.dir.frontArmSide === 'right' ? hp.right : hp.left;
        const backHand = d.dir.frontArmSide === 'right' ? hp.left : hp.right;
        const weapons = v.weapons || [];
        if (backHand && weapons[1] && !v.suppressDefaultOffhand && !v.suppressDefaultWeapon) this.drawStandingWeaponShape(weapons[1], backHand, d, true);
        if (frontHand && weapons[0] && !v.suppressDefaultWeapon) this.drawStandingWeaponShape(weapons[0], frontHand, d, false);
      }

      drawStandingNeck(d) {
        const neck = d.joints?.neck || { x: d.dir.headTurnX * 0.15, y: -49 + d.pose.breathe };
        const chest = d.joints?.chest || { x: 0, y: -31 + d.pose.breathe };
        ctx.fillStyle = colorShade(d.skin, -8);
        ctx.fillRect(neck.x - 4, neck.y - 1, 8, Math.max(7, chest.y - neck.y + 3));
      }

      drawStandingHead(d) {
        const dir=d.dir;
        const head = d.joints?.head || { x: dir.headTurnX, y: -58 + d.pose.breathe, top: -72 + d.pose.breathe, bottom: -43 + d.pose.breathe };
        const hx = head.x || 0;
        const hy = head.y || -58;
        const headGrad = this.puppetGradient(hx - 14, hy - 14, hx + 16, hy + 14, colorShade(d.skin, 18), d.skin, colorShade(d.skin,-12));
        this.drawPuppetPoly([
          {x:hx-14,y:hy-12},
          {x:hx+14,y:hy-12},
          {x:hx+17,y:hy+2},
          {x:hx+8,y:hy+14},
          {x:hx-8,y:hy+14},
          {x:hx-17,y:hy+2}
        ], headGrad, '#3b2a24', 1.5);
        ctx.save();
        ctx.globalAlpha=0.14;
        ctx.fillStyle='#000';
        this.fillPoly([{x:hx+1,y:hy-11},{x:hx+16,y:hy+2},{x:hx+8,y:hy+14},{x:hx+1,y:hy+14}]);
        ctx.restore();
        if (dir.faceVisible) {
          ctx.fillStyle='#17120f';
          if (dir.visibleEyeCount===2) {
            ctx.fillRect(hx-8,hy,5,2);
            ctx.fillRect(hx+4,hy,5,2);
          } else if (dir.visibleEyeCount===1) {
            ctx.fillRect(hx+(dir.side>=0?4:-8),hy,5,2);
          }
        }
      }

      drawStandingHairOrHelmet(d) {
        const p=d.profile, dir=d.dir;
        const head = d.joints?.head || { x: dir.headTurnX, y: -58 + d.pose.breathe };
        const hx = head.x || 0;
        const hy = head.y || -58;
        let color = p.hair;
        if (p.head === 'hood' || p.head === 'hornhood' || p.head === 'skullhood') color = d.secondaryDark;
        if (p.head === 'helm') color = d.headTone;
        const fill = this.puppetGradient(hx-18,hy-21,hx+22,hy+10,colorShade(color,18), color, colorShade(color,-26));
        this.drawPuppetPoly([
          {x:hx-18,y:hy-10},
          {x:hx-6,y:hy-22},
          {x:hx+12,y:hy-19},
          {x:hx+22,y:hy-4},
          {x:hx+18,y:hy+10},
          {x:hx+9,y:hy+1},
          {x:hx-11,y:hy+1},
          {x:hx-18,y:hy+8}
        ], fill, colorShade(color,-32), 1.5);
        if (p.head === 'feather') this.drawPuppetPoly([{x:hx+4,y:hy-19},{x:hx+16,y:hy-31},{x:hx+13,y:hy-15}], d.accent, colorShade(d.accent,-30), 1);
        if (p.head === 'hornhood') {
          this.drawPuppetPoly([{x:hx-9,y:hy-19},{x:hx-4,y:hy-30},{x:hx+2,y:hy-19}], '#bdf7ee', '#6fb6ad', 1);
          this.drawPuppetPoly([{x:hx+9,y:hy-19},{x:hx+17,y:hy-31},{x:hx+17,y:hy-16}], '#bdf7ee', '#6fb6ad', 1);
        }
      }

      drawStandingClassDetails(d) {
        const v=d.visual, dir=d.dir, p=d.pose;
        if (v.mask && dir.faceVisible) { ctx.fillStyle='#20272d'; ctx.fillRect(-8 + dir.headTurnX * 0.4, -53 + p.breathe, 15, 6); }
        if (v.beltPouches) { ctx.fillStyle='#5d4631'; ctx.fillRect(-17,-12,7,7); ctx.fillRect(10,-12,7,7); }
        if (v.holySymbol) { ctx.fillStyle=d.accent; ctx.fillRect(14,-23,4,15); ctx.fillRect(9,-17,14,4); }
        if (v.instrument) { ctx.fillStyle='#c79d4d'; ctx.fillRect(-14,-19,5,20); }
        if (v.leaves) { ctx.fillStyle=d.accent; ctx.fillRect(-20,-30,4,3); ctx.fillRect(14,-26,4,3); }
        if (v.runes) { ctx.save(); ctx.globalCompositeOperation='screen'; ctx.globalAlpha=0.68; ctx.fillStyle=d.accent; ctx.fillRect(-15,-31,3,3); ctx.fillRect(12,-27,3,3); ctx.restore(); }
        if (v.arcane) { ctx.save(); ctx.globalCompositeOperation='screen'; ctx.globalAlpha=0.65; ctx.fillStyle='#bff7ff'; ctx.fillRect(-18,-8,4,4); ctx.fillRect(15,-12,4,4); ctx.restore(); }
        if (v.grave) { ctx.fillStyle='#dcecb8'; ctx.fillRect(-17,-27,3,3); ctx.fillRect(14,-10,3,3); }
        if (v.shoulderArmor) {
          this.drawPuppetPoly([{x:-22,y:-39+p.breathe},{x:-8,y:-43+p.breathe},{x:-7,y:-33+p.breathe},{x:-20,y:-29+p.breathe}], this.puppetGradient(-22,-43,-7,-29,colorShade(d.secondary,20), d.secondary, colorShade(d.secondary,-22)), '#51432f', 1.2);
          this.drawPuppetPoly([{x:8,y:-43+p.breathe},{x:22,y:-39+p.breathe},{x:20,y:-29+p.breathe},{x:7,y:-33+p.breathe}], this.puppetGradient(7,-43,22,-29,colorShade(d.secondary,20), d.secondary, colorShade(d.secondary,-22)), '#51432f', 1.2);
        }
      }


      drawFishingActionOverlay(d, screen, scale = 1) {
        const e = d.e;
        const side = d.dir.side >= 0 ? 1 : -1;
        const hand = d._handPoints?.right || { x: 24 * side, y: -28 };
        const action = String(e.fishingAction || 'waiting');
        const now = performance.now() * 0.001;
        const castPct = action === 'casting' ? 1 - clamp(Number(e.fishingCastTimer || 0) / 0.62, 0, 1) : 1;
        const reel = action === 'reeling' ? Math.sin(now * 15) * 3 : Math.sin(now * 3.2) * 1.5;
        const tip = {
          x: hand.x + side * (62 + castPct * 18),
          y: hand.y - 45 - castPct * 8 + reel
        };
        // V0.17.18: publish the actual rendered rod-tip anchor in the same
        // unzoomed screen coordinate space used by worldToScreen. The fishing
        // system consumes this after entity rendering, so the line starts at the
        // visible pole tip instead of a world-space approximation near the hand/body.
        if (e) {
          // V0.17.62 Phase 23 bugfix: this referenced an undeclared `s`
          // (ReferenceError) instead of the `screen` parameter the caller passes
          // as the model foot position - so drawFishingActionOverlay threw a
          // render fault for EVERY fishing player (overworld and dungeon), and
          // the accurate rod-tip anchor was never published (fishing line fell
          // back to a world-space approximation). Pre-existing; surfaced while
          // verifying the Phase 23 dungeon fishing.
          const modelFootX = Number(screen?.x || 0);
          const modelFootY = Number(screen?.y || 0) + Number(d?.pose?.bob || 0);
          e.fishingRodTipScreen = {
            x: modelFootX + tip.x * scale,
            y: modelFootY + tip.y * scale
          };
          e.fishingRodTipScreenAt = performance.now();
          e.fishingRodTipScreenCameraYaw = Number(this.camera?.yaw || 0);
          e.fishingRodTipScreenCameraZoom = Number(this.camera?.zoom || 1);
          e.fishingRodTipScreenCameraX = Number(this.camera?.x || 0);
          e.fishingRodTipScreenCameraY = Number(this.camera?.y || 0);
          e.fishingRodTipScreenAction = action;
        }

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Rod and reel are now action overlays anchored to the current puppet hand.
        ctx.strokeStyle = '#6d4525';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(hand.x, hand.y);
        ctx.quadraticCurveTo(hand.x + side * 34, hand.y - 28, tip.x, tip.y);
        ctx.stroke();

        ctx.strokeStyle = '#c79c56';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(hand.x + side * 3, hand.y - 2);
        ctx.quadraticCurveTo(hand.x + side * 34, hand.y - 29, tip.x - side * 2, tip.y + 1);
        ctx.stroke();

        ctx.fillStyle = '#c9a35a';
        ctx.beginPath();
        ctx.arc(hand.x + side * 9, hand.y + 4, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#4a2d1c';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(hand.x + side * 9, hand.y + 4, 7, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();

      }

      canDrawIdentityPetModel(e) {
        const petModel = window.DreamRealms?.render?.PetIdentityProceduralModel || window.PetIdentityProceduralModel;
        return !!(petModel?.canDraw && petModel.canDraw(e) && typeof petModel.draw === 'function');
      }

      drawMeditationMirrorAura(e, s, scale) {
        if (!e.meditationMirror) return;
        const DR = window.DreamRealms || {};
        const ownerClass = String(e.owner?.className || '');
        const color = DR.CLASSES?.[ownerClass]?.color || '#8fe8ff';
        const t = (performance.now() || 0) / 1000;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.5 * (0.7 + Math.sin(t * 2.1) * 0.12);
        const g = ctx.createRadialGradient(0, 4, 1, 0, 4, 34 * (scale || 1));
        g.addColorStop(0, color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 6, 26 * (scale || 1), 9 * (scale || 1), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      drawPetSprite(e, s, scale) {
        this.drawMeditationMirrorAura(e, s, scale);
        const petModel = window.DreamRealms?.render?.PetIdentityProceduralModel || window.PetIdentityProceduralModel;
        const actor = {
          ...e,
          sourceEntity: e,
          screenX: s.x,
          screenY: s.y,
          facingName: this.actorFacingName?.(e) || e.facingName || 'south',
          isMoving: (e.moveBlend || 0) > 0.08 || Math.abs(e.vx || 0) + Math.abs(e.vy || 0) > 0.01,
          action: !e.alive ? 'death' : (Number(e.attackAnim || 0) > 0.02 ? 'attack' : (Number(e.hitAnim || e.hitReaction || 0) > 0.02 ? 'hit' : (e.action || 'idle'))),
          attackAnim: Number(e.attackAnim || 0),
          hitAnim: Number(e.hitAnim || e.hitReaction || e.damageAnim || 0),
          deathProgress: !e.alive ? 1 : Number(e.deathProgress || 0),
          summonFx: Number(e.spawnFx || 0),
          debugFacing: !!(this.debugOverlayOpen || this.debugMode || this.showFacingDebug)
        };

        if (this.canDrawIdentityPetModel(e)) {
          const drew = this.drawCachedModelOrFallback(actor, petModel, scale || 1, { rendererId: `pet:${actor.petType || actor.rendererId || 'identity'}`, bounds: 'beast' });
          if (drew) {
            if (actor._nameplateAnchor) e._nameplateAnchor = actor._nameplateAnchor;
            else e._nameplateAnchor = { x: s.x, y: s.y - 76 * (scale || 1) };
            return;
          }
        }

        // Emergency fallback only. This intentionally does not reuse the old pet body,
        // so missing script/order issues cannot visually look like the pre-revamp pets.
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = e.petType === 'undead' ? '#d8d1b8' : '#2f9cff';
        ctx.strokeStyle = e.petType === 'undead' ? '#51483a' : '#bdefff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -74);
        ctx.lineTo(17, -39);
        ctx.lineTo(4, -10);
        ctx.lineTo(-15, -38);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        e._nameplateAnchor = { x: s.x, y: s.y - 80 * (scale || 1) };
      }


      drawEnemySprite(e, s, scale) {
        const x = s.x | 0;
        const y = s.y | 0;
        const faceView = this.entityFacingView(e);
        const mirrorSide = faceView.side < 0;
        ctx.save();
        if (mirrorSide) {
          ctx.translate(x * 2, 0);
          ctx.scale(-1, 1);
        }
        const move = clamp(e.moveBlend || 0, 0, 1);
        const phase = e.walkCycle || 0;
        const step = Math.sin(phase) * 12 * move;
        const bob = Math.abs(Math.sin(phase)) * 4.6 * move;
        const dir = 1;
        const base = e.color;
        if (e.dungeonBoss) {
          const pulse = Math.sin(performance.now() * 0.004 + e.id) * 0.5 + 0.5;
          ctx.save();
          ctx.globalAlpha = 0.18 + pulse * 0.12;
          ctx.fillStyle = base;
          ctx.beginPath();
          ctx.ellipse(x, y - 22, 54 * scale, 38 * scale, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.85;
          ctx.strokeStyle = '#d8ad57';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(x, y + 8, 36 * scale, 11 * scale, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        const dark = colorShade(base, -28);
        const deep = colorShade(base, -44);
        const light = colorShade(base, 18);
        const high = colorShade(base, 32);
        const px = (rx, ry, w = 3, h = 3, color = high, alpha = 1) => {
          ctx.save();
          if (alpha !== 1) ctx.globalAlpha = alpha;
          ctx.fillStyle = color;
          ctx.fillRect((x + rx) | 0, (y + ry) | 0, w, h);
          ctx.restore();
        };
        const poly = (pts, color, alpha = 1) => {
          ctx.save();
          if (alpha !== 1) ctx.globalAlpha = alpha;
          ctx.fillStyle = color;
          this.fillPoly(pts.map(p => ({ x: x + p.x, y: y + p.y })));
          ctx.restore();
        };

        if (e.name.includes('Wolf')) {
          const tail = Math.sin(phase * 0.9) * 6 * move;
          const neck = step * 0.35;
          poly([{ x: -38, y: -18 + bob }, { x: 2, y: -29 + neck + bob }, { x: 34, y: -16 + bob }, { x: 17, y: 6 + bob }, { x: -31, y: 4 + bob }], deep);
          poly([{ x: -26, y: -25 + bob }, { x: 7, y: -31 + neck + bob }, { x: 12, y: -14 + bob }, { x: -16, y: -8 + bob }], dark);
          poly([{ x: -12, y: -18 + bob }, { x: 13, y: -22 + bob }, { x: 7, y: -10 + bob }, { x: -9, y: -8 + bob }], light);
          poly([{ x: 21, y: -28 + neck + bob }, { x: 46 + dir * 2, y: -20 + bob }, { x: 46 + dir * 2, y: -7 + bob }, { x: 30, y: -8 + bob }], dark);
          poly([{ x: 25 + dir, y: -32 + neck + bob }, { x: 31 + dir, y: -43 + bob }, { x: 35 + dir, y: -29 + bob }], dark);
          poly([{ x: 35 + dir, y: -30 + neck + bob }, { x: 43 + dir, y: -40 + bob }, { x: 43 + dir, y: -25 + bob }], dark);
          poly([{ x: 35 + dir, y: -13 + bob }, { x: 44 + dir, y: -11 + bob }, { x: 44 + dir, y: -6 + bob }, { x: 37 + dir, y: -5 + bob }], '#cab99f');
          px(39 + dir, -19 + bob, 4, 4, '#141515');
          poly([{ x: -28, y: 2 + step }, { x: -17, y: 1 }, { x: -20, y: 22 }, { x: -31, y: 22 + step * 0.2 }], deep);
          poly([{ x: -4, y: 4 - step }, { x: 6, y: 2 }, { x: 2, y: 23 }, { x: -8, y: 23 - step * 0.2 }], deep);
          poly([{ x: 10, y: 3 + step }, { x: 20, y: 2 }, { x: 24, y: 23 }, { x: 13, y: 23 + step * 0.2 }], deep);
          poly([{ x: 24, y: 2 - step }, { x: 32, y: 1 }, { x: 36, y: 22 }, { x: 26, y: 22 - step * 0.2 }], deep);
          ctx.strokeStyle = dark; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x - 32, y - 16 + bob); ctx.lineTo(x - 57 - tail, y - 31 + tail * 0.35 + bob); ctx.stroke();
          for (let i = -18; i <= 6; i += 8) px(i, -17 + ((i / 2) % 2) + bob * 0.2, 9, 2, high, 0.35);
        } else if (e.name.includes('Widow')) {
          const legSpread = 7 + move * 10;
          poly([{ x: -24, y: -9 + bob }, { x: -3, y: -24 + bob }, { x: 21, y: -20 + bob }, { x: 30, y: -5 + bob }, { x: 13, y: 8 + bob }, { x: -12, y: 5 + bob }], dark);
          poly([{ x: -10, y: -20 + bob }, { x: 15, y: -18 + bob }, { x: 18, y: -6 + bob }, { x: -5, y: -4 + bob }], light);
          poly([{ x: 7, y: -23 + bob }, { x: 31, y: -18 + bob }, { x: 38, y: -6 + bob }, { x: 19, y: 5 + bob }, { x: 1, y: bob }], deep);
          ctx.strokeStyle = colorShade(base, -6); ctx.lineWidth = 3;
          for (let i = -3; i <= 4; i++) {
            if (i === 0) continue;
            const dirL = i < 0 ? -1 : 1;
            const swing = Math.sin(phase + i * 0.8) * legSpread;
            ctx.beginPath();
            ctx.moveTo(x + i * 5, y - 8 + bob);
            ctx.lineTo(x + i * 13 + swing * dirL * 0.4, y + 12 - Math.abs(swing) * 0.3 + bob);
            ctx.lineTo(x + i * 19 + swing * dirL, y + 5 + bob);
            ctx.stroke();
          }
          px(15, -17 + bob, 3, 3, '#ffccd5', 0.9); px(21, -15 + bob, 3, 3, '#ffccd5', 0.9); px(26, -13 + bob, 3, 3, '#ffccd5', 0.9);
          px(20, -8 + bob, 5, 3, '#d3f0d2', 0.65);
        } else if (e.name.includes('Wisp')) {
          const wobble = Math.sin(performance.now() * 0.006 + e.x + phase * 0.2) * (4 + move * 2);
          ctx.globalAlpha = 0.75;
          poly([{ x: 0, y: -57 + wobble }, { x: 24, y: -37 }, { x: 15, y: -9 }, { x: -14, y: -5 }, { x: -26, y: -33 }], dark);
          poly([{ x: -2, y: -48 + wobble }, { x: 12, y: -34 }, { x: 7, y: -19 }, { x: -12, y: -21 }], light);
          poly([{ x: -1, y: -38 + wobble }, { x: 7, y: -30 }, { x: 3, y: -22 }, { x: -6, y: -27 }], '#e4ffff');
          ctx.globalAlpha = 0.25; ctx.fillStyle = '#dffbff'; ctx.beginPath(); ctx.ellipse(x, y - 28 + wobble * 0.2, 31 + move * 2, 19 + move, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        } else if (e.name.includes('Stag')) {
          const neck = step * 0.4;
          poly([{ x: -37, y: -19 + bob }, { x: 11, y: -28 + bob }, { x: 39, y: -11 + bob }, { x: 14, y: 8 + bob }, { x: -31, y: 6 + bob }], dark);
          poly([{ x: -18, y: -18 + bob }, { x: 10, y: -22 + bob }, { x: 6, y: -9 + bob }, { x: -14, y: -7 + bob }], light);
          poly([{ x: 21, y: -44 + neck + bob }, { x: 46, y: -39 + bob }, { x: 45, y: -17 + bob }, { x: 27, y: -14 + bob }], colorShade(base, -18));
          ctx.strokeStyle = '#d6c18f'; ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x + 36, y - 46 + neck + bob); ctx.lineTo(x + 27, y - 68 + bob);
          ctx.moveTo(x + 36, y - 46 + neck + bob); ctx.lineTo(x + 50, y - 66 + bob);
          ctx.moveTo(x + 31, y - 57 + neck + bob); ctx.lineTo(x + 21, y - 63 + bob);
          ctx.moveTo(x + 46, y - 57 + neck + bob); ctx.lineTo(x + 57, y - 61 + bob);
          ctx.stroke();
          poly([{ x: -25, y: 4 + step }, { x: -15, y: 3 }, { x: -18, y: 24 }, { x: -28, y: 24 + step * 0.2 }], deep);
          poly([{ x: -3, y: 4 - step }, { x: 7, y: 3 }, { x: 3, y: 24 }, { x: -7, y: 24 - step * 0.2 }], deep);
          poly([{ x: 9, y: 5 + step }, { x: 19, y: 4 }, { x: 23, y: 24 }, { x: 12, y: 24 + step * 0.2 }], deep);
          poly([{ x: 24, y: 5 - step }, { x: 34, y: 4 }, { x: 37, y: 24 }, { x: 26, y: 24 - step * 0.2 }], deep);
          px(-10, -18 + bob, 4, 2, '#cdb389', 0.55); px(1, -13 + bob, 4, 2, '#cdb389', 0.55); px(9, -17 + bob, 4, 2, '#cdb389', 0.55);
        } else {
          const arm = Math.sin(phase * 0.9) * 6 * move;
          poly([{ x: -24, y: -37 + bob }, { x: 10, y: -44 + bob }, { x: 26, y: -15 + bob }, { x: 5, y: 7 + bob }, { x: -29, y: -4 + bob }], deep);
          poly([{ x: -10, y: -54 + bob }, { x: 8, y: -60 + bob }, { x: 19, y: -46 + bob }, { x: 7, y: -34 + bob }, { x: -12, y: -38 + bob }], dark);
          px(-4, -50 + bob, 3, 3, '#9fc27a', 0.9); px(4, -49 + bob, 3, 3, '#9fc27a', 0.9);
          poly([{ x: -16 - arm * 0.25, y: -25 + bob }, { x: -6, y: -15 + bob }, { x: -12, y: 4 + bob }, { x: -23 - arm * 0.2, y: 6 + bob }], colorShade(base, 8));
          poly([{ x: 7 + arm * 0.25, y: -27 + bob }, { x: 20, y: -18 + bob }, { x: 18, y: 4 + bob }, { x: 6 + arm * 0.2, y: 0 + bob }], colorShade(base, 8));
          ctx.strokeStyle = '#5f7645'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(x - 18, y - 9 + bob); ctx.lineTo(x - 33 - arm * 0.6, y + 2 + bob); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + 15, y - 10 + bob); ctx.lineTo(x + 29 + arm * 0.6, y + 2 + bob); ctx.stroke();
          px(-12, -21 + bob, 18, 2, '#6f8451', 0.4); px(-9, -10 + bob, 14, 2, '#6f8451', 0.4);
        }
        ctx.restore();
      }

      entityNameplateLevel(e) {
        return Math.max(1, Math.floor(Number(e?.level || e?.baseType?.level || e?.npcLevel || 1)));
      }

      entityNameplateClassKey(e) {
        const kind = String(e?.kind || '').toLowerCase();
        const sourceClass = kind === 'pet'
          ? (e?.owner?.className || e?.masterClassName || e?.ownerClassName || e?.className || e?.playerClass || e?.roleClass || '')
          : (e?.className || e?.playerClass || e?.roleClass || '');
        const rawText = String(sourceClass || '').trim();
        if (!rawText) return '';
        const meta = (window.DreamRealms || {}).classEmblemMeta?.(rawText);
        if (meta?.key) return meta.key;
        const raw = rawText.toLowerCase().replace(/[\s_\-]/g, '');
        if (raw.includes('paladin') || raw.includes('crusader') || raw.includes('templar')) return 'paladin';
        if (raw.includes('warden') || raw.includes('guardian')) return 'warden';
        if (raw.includes('fighter') || raw.includes('warrior') || raw.includes('bruiser')) return 'fighter';
        if (raw.includes('ranger') || raw.includes('archer')) return 'ranger';
        if (raw.includes('assassin') || raw.includes('crossbow')) return 'assassin';
        if (raw.includes('rogue') || raw.includes('scout')) return 'rogue';
        if (raw.includes('wizard') || raw.includes('mage') || raw.includes('arcane')) return 'wizard';
        if (raw.includes('shaman') || raw.includes('totem')) return 'shaman';
        if (raw.includes('cleric') || raw.includes('priest') || raw.includes('healer')) return 'cleric';
        if (raw.includes('enchanter') || raw.includes('illusion')) return 'enchanter';
        if (raw.includes('summoner') || raw.includes('adept')) return 'summoner';
        if (raw.includes('necromancer') || raw.includes('necro')) return 'necromancer';
        if (raw.includes('bard')) return 'bard';
        if (raw.includes('druid')) return 'druid';
        return raw;
      }

      entityHasPlayerClassEmblem(e) {
        const kind = String(e?.kind || '').toLowerCase();
        return (kind === 'player' || kind === 'remote' || kind === 'remoteplayer' || kind === 'bot' || kind === 'merc' || kind === 'pet') && !!this.entityNameplateClassKey(e);
      }

      entityNameplateActionText(e) {
        const kind = String(e?.kind || '').toLowerCase();
        if (!e || e.alive === false || Number(e.hp ?? 1) <= 0) return 'Downed';
        if (kind === 'player') return String(this.describePlayerHudStatus?.() || e.currentActivityLabel || 'Idle');
        const direct = String(e.currentActivityLabel || e.commandState || e.botState || e.action || '').trim();
        if (direct) {
          if (/^idle$/i.test(direct)) return 'Idle';
          return direct.replace(/[\-_]+/g, ' ').replace(/\s+/g, ' ').trim();
        }
        if (e.casting || e.isCasting || Number(e.spellCastAnim || 0) > 0.02) return 'Casting';
        if (e.inCombat || e.target || e.attackTargetId || Number(e.attackAnim || 0) > 0.02) return 'Fighting';
        if (e.meditating || e.isMeditating) return 'Meditating';
        if (e.moving || Math.abs(Number(e.vx || 0)) + Math.abs(Number(e.vy || 0)) > 0.01) return 'Moving';
        return kind === 'enemy' ? 'Hostile' : 'Idle';
      }

      entityHasEliteNameplateEmblem(e) {
        if (!e || String(e.kind || '').toLowerCase() !== 'enemy') return false;
        return !!(e.elite || e.dungeonElite || e.dungeonBoss || e.rareNameplate || /elite|boss|named/i.test(String(e.aiProfile || e.threatTag || e.zoneRole || '')));
      }

      roundedNameplateRect(x, y, w, h, r = 4) {
        r = Math.max(1, Math.min(r, Math.min(w, h) / 2));
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
        ctx.closePath();
      }

      drawNameplateClassEmblem(kind, x, y, size = 9) {
        const k = String(kind || '').toLowerCase();
        const dr = window.DreamRealms || {};
        const spriteMeta = dr.classEmblemMeta?.(k) || null;
        const badgeImage = dr.classEmblemImage;
        const columns = Math.max(1, Number(dr.classEmblemColumns || 7));
        const rows = Math.max(1, Number(dr.classEmblemRows || 2));
        if (spriteMeta && badgeImage && badgeImage.complete && (badgeImage.naturalWidth || badgeImage.width) > 0 && (badgeImage.naturalHeight || badgeImage.height) > 0) {
          const sourceW = (badgeImage.naturalWidth || badgeImage.width) / columns;
          const sourceH = (badgeImage.naturalHeight || badgeImage.height) / rows;
          const drawSize = Math.max(14, Math.round(size * 2.15));
          ctx.save();
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(
            badgeImage,
            spriteMeta.col * sourceW, spriteMeta.row * sourceH, sourceW, sourceH,
            Math.round(x - drawSize / 2), Math.round(y - drawSize / 2), drawSize, drawSize
          );
          ctx.restore();
          return;
        }

        const r = size / 2;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.translate(x, y);
        ctx.fillStyle = 'rgba(12,12,18,0.84)';
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, r + 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        if (k === 'fighter') {
          ctx.strokeStyle = '#f0d18a'; ctx.lineWidth = 1.8;
          ctx.beginPath(); ctx.moveTo(-3, 4); ctx.lineTo(3, -5); ctx.moveTo(3, 4); ctx.lineTo(-3, -5); ctx.stroke();
          ctx.fillStyle = '#b04438'; ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(4, 1); ctx.lineTo(2, 5); ctx.lineTo(-2, 5); ctx.lineTo(-4, 1); ctx.closePath(); ctx.fill();
        } else if (k === 'rogue') {
          ctx.strokeStyle = '#b9d4df'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-4, 4); ctx.lineTo(4, -5); ctx.stroke();
          ctx.fillStyle = '#75ffbd'; ctx.beginPath(); ctx.moveTo(4, -5); ctx.lineTo(6, -1); ctx.lineTo(1, -2); ctx.closePath(); ctx.fill();
        } else if (k === 'cleric') {
          ctx.strokeStyle = '#fff0a8'; ctx.lineWidth = 2.1;
          ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, 5); ctx.moveTo(-4, -1); ctx.lineTo(4, -1); ctx.stroke();
          ctx.fillStyle = 'rgba(255,245,174,0.28)'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
        } else if (k === 'summoner') {
          ctx.strokeStyle = '#8af8ff'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.ellipse(0, 0, 6, 2.6, 0.65, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.ellipse(0, 0, 6, 2.6, -0.65, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = '#d9ffff'; ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(4, 0); ctx.lineTo(0, 5); ctx.lineTo(-4, 0); ctx.closePath(); ctx.fill();
        } else if (k === 'necromancer') {
          ctx.fillStyle = '#d8dfc4'; ctx.beginPath(); ctx.arc(0, -1, 4.6, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#172013'; ctx.fillRect(-3, -2, 2, 2); ctx.fillRect(1, -2, 2, 2);
          ctx.strokeStyle = '#b7ff84'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-4, 4); ctx.lineTo(4, 4); ctx.stroke();
        } else if (k === 'bard') {
          ctx.strokeStyle = '#ffd56d'; ctx.lineWidth = 1.8;
          ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, 4); ctx.moveTo(0, -5); ctx.lineTo(5, -4); ctx.stroke();
          ctx.fillStyle = '#d59aff'; ctx.beginPath(); ctx.arc(-2.2, 4, 2.5, 0, Math.PI * 2); ctx.fill();
        } else if (k === 'druid') {
          ctx.fillStyle = '#8fe28a'; ctx.beginPath(); ctx.ellipse(0, 0, 4, 6, 0.7, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#325f32'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-2, 4); ctx.quadraticCurveTo(0, 0, 3, -5); ctx.stroke();
        } else if (k === 'paladin') {
          ctx.strokeStyle = '#fff0a8'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 5); ctx.moveTo(-4, -1); ctx.lineTo(4, -1); ctx.stroke();
        } else if (k === 'warden') {
          ctx.fillStyle = '#95d46d'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(5, 0); ctx.lineTo(0, 6); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill();
        } else if (k === 'ranger') {
          ctx.strokeStyle = '#bde987'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 5, -1.1, 1.1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.stroke();
        } else if (k === 'assassin') {
          ctx.strokeStyle = '#cfd6df'; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(-4, 4); ctx.lineTo(4, -5); ctx.moveTo(4, 4); ctx.lineTo(-4, -5); ctx.stroke();
        } else if (k === 'wizard') {
          ctx.fillStyle = '#b78cff'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 2); ctx.lineTo(0, 6); ctx.lineTo(-4, 2); ctx.closePath(); ctx.fill();
        } else if (k === 'shaman') {
          ctx.strokeStyle = '#70ffd7'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.moveTo(-4, -2); ctx.lineTo(4, 2); ctx.stroke();
        } else {
          ctx.fillStyle = '#e7eef7'; ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(5, 0); ctx.lineTo(0, 5); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }

      drawNameplateEliteEmblem(x, y, size = 10) {
        const r = size / 2;
        ctx.save();
        ctx.translate(x, y);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.fillStyle = 'rgba(32,21,5,0.92)';
        ctx.strokeStyle = '#f3c15a';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + i * Math.PI / 5;
          const rr = i % 2 === 0 ? r + 3 : r - 1;
          const px = Math.cos(a) * rr;
          const py = Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffd86b';
        ctx.beginPath(); ctx.arc(0, -1, 4.1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5b3210';
        ctx.fillRect(-2.8, -2.1, 1.8, 1.8); ctx.fillRect(1, -2.1, 1.8, 1.8);
        ctx.strokeStyle = '#5b3210'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-3, 3); ctx.quadraticCurveTo(0, 5, 3, 3); ctx.stroke();
        ctx.restore();
      }

      drawBotSpeechBubble(e, s) {
        const bubble = e?.speechBubble;
        if (!bubble?.text) return false;
        const nowMs = performance.now();
        const expiresAt = Number(bubble.expiresAt || 0);
        if (expiresAt <= nowMs) return false;
        const remaining = expiresAt - nowMs;
        const alpha = clamp(remaining / 420, 0, 1);
        const words = String(bubble.text).split(/\s+/).filter(Boolean);
        const maxWidth = 176;
        const lines = [];
        ctx.save();
        ctx.font = '11px ui-sans-serif, sans-serif';
        let line = '';
        for (const word of words) {
          const candidate = line ? `${line} ${word}` : word;
          if (line && ctx.measureText(candidate).width > maxWidth) {
            lines.push(line);
            line = word;
            if (lines.length >= 2) break;
          } else line = candidate;
        }
        if (line && lines.length < 3) lines.push(line);
        if (!lines.length) { ctx.restore(); return false; }
        const textWidth = Math.max(...lines.map(text => ctx.measureText(text).width));
        const width = Math.min(maxWidth + 18, Math.max(76, Math.ceil(textWidth) + 18));
        const height = lines.length * 14 + 14;
        const anchor = e._nameplateAnchor || { x: s.x, y: s.y - 74 };
        const centerX = clamp(anchor.x, width / 2 + 6, window.innerWidth - width / 2 - 6);
        const maxBottom = Math.max(height + 8, window.innerHeight - 96);
        let bottomY = clamp(anchor.y - 42, height + 8, maxBottom);
        const left = centerX - width / 2;
        let top = bottomY - height;
        const placementId = String(e.botId || e.id || e.name || 'bot');
        const placements = (this._botSpeechBubblePlacements || []).filter(rect => rect.id !== placementId);
        for (let attempt = 0; attempt < 5; attempt++) {
          const overlaps = placements.some(rect => left < rect.right + 8 && left + width > rect.left - 8 && top < rect.bottom + 6 && top + height > rect.top - 6);
          if (!overlaps) break;
          top = Math.max(8, top - 18);
          bottomY = top + height;
        }
        placements.push({ id: placementId, left, right: left + width, top, bottom: top + height });
        this._botSpeechBubblePlacements = placements;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(247,244,224,0.96)';
        ctx.strokeStyle = 'rgba(36,45,39,0.92)';
        ctx.lineWidth = 1.25;
        this.roundedNameplateRect(left, top, width, height, 7);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(centerX - 5, bottomY - 1);
        ctx.lineTo(centerX + 2, bottomY + 7);
        ctx.lineTo(centerX + 7, bottomY - 1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#172019';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        lines.forEach((text, index) => ctx.fillText(text, centerX, top + 10 + index * 14));
        ctx.restore();
        e._speechBubbleScreen = { x: centerX, y: top, width, height, alpha, overlapOffset: Math.max(0, (anchor.y - 42 - height) - top) };
        return true;
      }

      drawSpiderWebOverlay(e, s) {
        const web = e?.activeSpiderWeb;
        if (!web || e?.alive === false) return;
        const now = performance.now();
        const p = Math.max(0, Math.min(1, (Number(web.expiresAt || 0) - now) / Math.max(1, Number(web.duration || 1) * 1000)));
        const pulse = 0.5 + Math.sin(now * 0.012) * 0.5;
        ctx.save();
        ctx.globalAlpha = 0.54 + pulse * 0.14;
        ctx.strokeStyle = 'rgba(232,232,238,0.86)';
        ctx.lineWidth = 1.25;
        const cx = s.x;
        const top = s.y - (e.kind === 'pet' ? 54 : e.kind === 'merc' || e.kind === 'bot' || e.kind === 'player' ? 68 : 58);
        const bottom = s.y - 8;
        for (let i = 0; i < 7; i++) {
          const y = top + (bottom - top) * (i / 6);
          const w = 16 + Math.sin(now * 0.006 + i) * 4 + i * 1.2;
          ctx.beginPath();
          ctx.ellipse(cx, y, w, 4 + (i % 2), Math.sin(i) * 0.25, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 0.42 + pulse * 0.08;
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + i * 7, top - 4);
          ctx.quadraticCurveTo(cx + i * 3 + Math.sin(now * 0.008 + i) * 6, (top + bottom) * 0.5, cx - i * 6, bottom + 3);
          ctx.stroke();
        }
        ctx.globalAlpha = 0.30;
        ctx.fillStyle = 'rgba(248,248,255,0.18)';
        ctx.beginPath();
        ctx.ellipse(cx, s.y - 34, 24 + pulse * 3, 36, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      normalizeEntityNameplateAnchor(e, s) {
        const cfg = DR.CONFIG?.PERFORMANCE || {};
        const raw = e?._nameplateAnchor || null;
        const sx = Number(s?.x) || 0;
        const sy = Number(s?.y) || 0;
        const kind = String(e?.kind || '').toLowerCase();
        const isHumanoid = kind === 'player' || kind === 'bot' || kind === 'merc' || kind === 'remoteplayer' || kind === 'remote' || kind === 'npc';
        const baseOffset = kind === 'pet'
          ? 84
          : kind === 'enemy'
            ? (e?.dungeonBoss ? 120 : e?.dungeonMiniBoss ? 96 : 78)
            : (e?.meditating ? 86 : 96);
        let x = Number(raw?.x);
        let y = Number(raw?.y);
        if (!Number.isFinite(x)) x = sx;
        if (!Number.isFinite(y)) y = sy - baseOffset;
        // Cached procedural frames may skip the model draw that normally updates
        // sourceEntity._nameplateAnchor. Treat large screen-space drift as stale
        // and snap back to the current foot/head baseline.
        const maxDrift = Math.max(36, Number(cfg.nameplateHumanoidAnchorMaxDriftPx || 64));
        if (isHumanoid && Math.abs(x - sx) > maxDrift) x = sx;
        const verticalOffset = sy - y;
        const minOffset = kind === 'pet' ? 38 : (kind === 'enemy' ? 32 : 44);
        const maxOffset = kind === 'enemy' ? 178 : 148;
        if (!Number.isFinite(verticalOffset) || verticalOffset < minOffset || verticalOffset > maxOffset) y = sy - baseOffset;
        return { x, y };
      }

      estimateNameplateStackHeight(e, plateH, hpH) {
        let height = Number(plateH || 0) + 3 + Number(hpH || 5) + 2;
        if (e?.activeSpiderWeb) height += 10;
        if (e?.kind === 'enemy') height += 12;
        if (e?.kind === 'player' && e?.meditating && e?.meditationSkill) height += 11;
        return Math.max(36, height);
      }

      layoutEntityNameplate(e, nx, plateY, w, stackH) {
        const cfg = DR.CONFIG?.PERFORMANCE || {};
        const canvas = ctx?.canvas || document.getElementById('game');
        const viewW = Number(canvas?.width || window.innerWidth || 1280);
        const viewH = Number(canvas?.height || window.innerHeight || 720);
        const pad = 6;
        const width = Math.max(38, Number(w || 80));
        const height = Math.max(36, Number(stackH || 44));
        let centerX = clamp(Number(nx) || width / 2, width / 2 + pad, viewW - width / 2 - pad);
        const maxVisibleTop = Math.max(pad, viewH - height - pad);
        // V0.15.52: nameplates are allowed to clip at the top edge if necessary,
        // but their lower edge may not be pushed down into the actor's head/model.
        const rawTop = Number(plateY);
        const modelClearanceBottom = Number(e?._nameplateMaxBottomY);
        const hasModelClearance = Number.isFinite(modelClearanceBottom);
        const allowTopClip = cfg.nameplateAllowAboveViewportClip !== false;
        let top = Number.isFinite(rawTop) ? rawTop : pad;
        if (hasModelClearance && top + height > modelClearanceBottom) top = modelClearanceBottom - height;
        if (!allowTopClip) top = clamp(top, pad, maxVisibleTop);
        else if (top > maxVisibleTop) top = maxVisibleTop;
        let left = Math.round(centerX - width / 2);
        const stackable = ['player', 'bot', 'merc', 'pet', 'remoteplayer', 'remote', 'npc', 'enemy'].includes(String(e?.kind || '').toLowerCase());
        const placements = this._nameplatePlacements || (this._nameplatePlacements = []);
        const id = String(e?.id || e?.botId || e?.name || Math.random());
        if (stackable) {
          const spacing = Math.max(4, Number(cfg.nameplateStackSpacingPx || 7));
          const attempts = Math.max(2, Number(cfg.nameplateMaxStackAttempts || 9));
          const preferredTop = top;
          const step = Math.max(14, Math.min(34, height * 0.52));
          for (let attempt = 0; attempt < attempts; attempt++) {
            left = Math.round(centerX - width / 2);
            const right = left + width;
            const bottom = top + height;
            const overlap = placements.some(rect => rect.id !== id && left < rect.right + spacing && right > rect.left - spacing && top < rect.bottom + spacing && bottom > rect.top - spacing);
            if (!overlap) break;
            // Always resolve overlap upward first. Only move downward if it still
            // keeps the entire nameplate stack above the actor clearance line.
            const up = preferredTop - step * (attempt + 1);
            const down = preferredTop + step * (attempt + 1);
            if (!allowTopClip && up < pad) {
              const downAllowed = !hasModelClearance || down + height <= modelClearanceBottom;
              top = downAllowed ? clamp(down, pad, maxVisibleTop) : Math.max(pad, modelClearanceBottom - height);
            } else {
              top = up;
            }
            if (hasModelClearance && top + height > modelClearanceBottom) top = modelClearanceBottom - height;
            if (!allowTopClip) top = clamp(top, pad, maxVisibleTop);
            else if (top > maxVisibleTop) top = maxVisibleTop;
          }
        }
        if (hasModelClearance && top + height > modelClearanceBottom) top = modelClearanceBottom - height;
        if (!allowTopClip) top = clamp(top, pad, maxVisibleTop);
        else if (top > maxVisibleTop) top = maxVisibleTop;
        left = Math.round(centerX - width / 2);
        const rect = { id, left, right: left + width, top, bottom: top + height };
        placements.push(rect);
        if (placements.length > 96) placements.splice(0, placements.length - 96);
        e._nameplateLayout = { x: centerX, y: top, w: width, h: height, left, right: left + width, bottom: top + height };
        return { nx: Math.round(centerX), plateY: Math.round(top), x0: left };
      }

      drawNameplate(e, s) {
        if (e?.activeSpiderWeb) this.drawSpiderWebOverlay?.(e, s);
        if (e?.hideNameplate || e?.suppressNameplate) return;
        if (e.kind === 'enemy' && dist(e, this.player) > (e.nameplateRange || (e.dungeonBoss ? 24 : 7))) return;
        const questInfo = e.kind === 'enemy' ? this.questSystem?.getQuestTargetInfoForEnemy?.(e) : null;
        const level = this.entityNameplateLevel(e);
        const elite = this.entityHasEliteNameplateEmblem(e);
        const classKey = this.entityHasPlayerClassEmblem(e) ? this.entityNameplateClassKey(e) : '';
        const hasEmblem = elite || !!classKey;
        const isMercNameplate = e.kind === 'merc';
        const isPlayerNameplate = e.kind === 'player';
        const cleanMercName = value => String(value || '').split(' - ')[0].replace(/\s+Lvl\s*:?\s*\d+\s*$/i, '').trim();
        const mercName = isMercNameplate ? (cleanMercName(e.displayBaseName || e.baseName || e.name) || 'Mercenary') : '';
        const botTypeLabel = e.kind === 'bot' ? String(e.botTypeLabel || e.displayTypeLabel || (e.className ? `${e.className} Bot` : 'Bot')).trim() : '';
        const baseName = isMercNameplate ? mercName : (e.kind === 'player' ? `${e.name}` : (e.kind === 'bot' ? `${e.name || botTypeLabel || 'Bot'}` : (questInfo ? `${e.name} · Quest Target` : e.name)));
        const name = String(baseName || 'Unknown').trim();
        const actionTextRaw = this.entityNameplateActionText?.(e) || 'Idle';
        const actionText = String(actionTextRaw || 'Idle').replace(/\s+/g, ' ').trim();
        const levelText = `Lvl:${level}`;
        const anchor = this.normalizeEntityNameplateAnchor?.(e, s) || e._nameplateAnchor || { x: s.x, y: s.y - 74 };
        // V0.15.50: nameplates now derive from a fresh per-frame anchor, then pass
        // through one shared stacker so nearby bots/players/mercs/pets do not draw on
        // top of each other. The plate remains centered on the actor unless it needs
        // viewport clamping.
        let nx = Math.round(anchor.x);
        const kindKey = String(e.kind || '').toLowerCase();
        const clearance = Math.max(
          6,
          Number(kindKey === 'pet'
            ? (DR.CONFIG?.PERFORMANCE?.nameplatePetClearancePx ?? DR.CONFIG?.PERFORMANCE?.nameplateModelClearancePx ?? 10)
            : kindKey === 'enemy'
              ? (DR.CONFIG?.PERFORMANCE?.nameplateEnemyClearancePx ?? DR.CONFIG?.PERFORMANCE?.nameplateModelClearancePx ?? 12)
              : kindKey === 'npc'
                ? (DR.CONFIG?.PERFORMANCE?.nameplateNpcClearancePx ?? DR.CONFIG?.PERFORMANCE?.nameplateModelClearancePx ?? 12)
                : (DR.CONFIG?.PERFORMANCE?.nameplateHumanoidClearancePx ?? DR.CONFIG?.PERFORMANCE?.nameplateModelClearancePx ?? 12)
          ) || 10
        );

        ctx.save();
        ctx.textBaseline = 'alphabetic';
        // V0.20.57: memoized - see measuredTextWidth. These widths only depend on font + string, and
        // the ctx.restore() below discards any font state set here, so nothing downstream relies on it.
        const nameW = measuredTextWidth(ctx, '12px ui-monospace, monospace', name);
        const levelW = measuredTextWidth(ctx, '10px ui-monospace, monospace', levelText);
        const actionW = measuredTextWidth(ctx, '10px ui-monospace, monospace', actionText);
        const emblemPad = hasEmblem ? 22 : 0;
        const nameIconPad = classKey ? 21 : 0;
        const topLineW = nameW + nameIconPad;
        const bottomLineW = levelW + actionW + 24 + (elite ? emblemPad : 0);
        const w = Math.max(isMercNameplate ? 86 : (isPlayerNameplate ? 104 : 72), Math.ceil(Math.max(topLineW + 28, bottomLineW + 22)));
        const h = 34;
        const hpH = 5;
        const stackH = this.estimateNameplateStackHeight?.(e, h, hpH) || h + 12;
        // V0.15.52: anchor.y is treated as the top of the actor/model space.
        // The entire plate + HP/threat stack is placed above that line with a
        // small gap, so nameplates never touch heads/body silhouettes.
        e._nameplateMaxBottomY = Math.round(anchor.y - clearance);
        let plateY = Math.round(e._nameplateMaxBottomY - stackH);
        const layout = this.layoutEntityNameplate?.(e, nx, plateY, w, stackH) || { nx, plateY, x0: Math.round(nx - w / 2) };
        nx = layout.nx;
        plateY = layout.plateY;
        const x0 = layout.x0;
        const border = elite ? 'rgba(255,210,91,0.94)' : (e.kind === 'enemy' ? 'rgba(195,86,78,0.86)' : (isMercNameplate ? 'rgba(139,226,219,0.86)' : 'rgba(208,238,218,0.82)'));
        const bgTop = elite ? 'rgba(50,32,8,0.90)' : (e.kind === 'enemy' ? 'rgba(30,8,8,0.84)' : 'rgba(7,18,14,0.88)');
        const bgBottom = elite ? 'rgba(17,10,3,0.92)' : 'rgba(0,0,0,0.78)';
        const inner = elite ? 'rgba(255,205,100,0.17)' : (e.kind === 'enemy' ? 'rgba(255,130,115,0.12)' : 'rgba(155,230,190,0.10)');

        // V0.17.96: nameplate image cache. Redrawing every plate's text/frame/shadow/
        // bars from scratch each frame (fillText + measureText + shadowBlur + gradients +
        // multiple rounded-rect strokes) is ~2ms/plate and was the single largest render
        // cost. Cache the fully-drawn plate to a per-entity offscreen canvas keyed by
        // everything that changes its pixels; blit it while unchanged, and only re-run the
        // (unchanged) drawing below when the key changes. `ctx` is the global window.ctx,
        // so the existing draw code renders into the offscreen unmodified.
        ctx.restore(); // close the measure/layout save opened at the top of the plate
        const hpPctKey = clamp(Number(e.hp || 0) / Math.max(1, Number(e.maxHp || 1)), 0, 1);
        let threatKey = '';
        if (e.kind === 'enemy') {
          const _ti = this.getPlayerThreatInfoForEnemy?.(e, this.player) || {};
          threatKey = Math.round(clamp(Number(_ti.percent || 0), 0, 1) * 60) + (_ti.isPrimary ? 'P' : '');
        }
        const webKey = e.activeSpiderWeb ? Math.round(clamp(Number(e.activeSpiderWeb.hp || 0) / Math.max(1, Number(e.activeSpiderWeb.maxHp || 100)), 0, 1) * 40) : '';
        const medKey = (e.kind === 'player' && e.meditating) ? Math.round(clamp(Number(e.meditationProgress || 0), 0, 1) * 40) : '';
        const plateKey = `${name}|${level}|${actionText}|${kindKey}|${elite ? 1 : 0}|${classKey}|${questInfo ? 1 : 0}|${w}|${Math.round(hpPctKey * 60)}|${threatKey}|${webKey}|${medKey}`;
        const NP_PAD_X = 10, NP_PAD_TOP = 12, NP_PAD_BOTTOM = 62;
        const npCache = e._nameplateImgCache || (e._nameplateImgCache = {});
        if (npCache.key === plateKey && npCache.canvas) {
          ctx.drawImage(npCache.canvas, Math.round(x0 - NP_PAD_X), Math.round(plateY - NP_PAD_TOP));
          return;
        }
        const npBboxW = Math.max(1, Math.ceil(w + NP_PAD_X * 2));
        const npBboxH = Math.max(1, Math.ceil(h + NP_PAD_TOP + NP_PAD_BOTTOM));
        const npCanvas = npCache.canvas || (npCache.canvas = document.createElement('canvas'));
        if (npCanvas.width !== npBboxW) npCanvas.width = npBboxW;
        if (npCanvas.height !== npBboxH) npCanvas.height = npBboxH;
        const npMainCtx = window.ctx;
        const npOffCtx = npCanvas.getContext('2d');
        npOffCtx.setTransform(1, 0, 0, 1, 0, 0);
        npOffCtx.clearRect(0, 0, npBboxW, npBboxH);
        npOffCtx.imageSmoothingEnabled = false;
        // Translate so the plate's absolute screen coords land inside the padded buffer.
        npOffCtx.translate(NP_PAD_X - x0, NP_PAD_TOP - plateY);
        window.ctx = npOffCtx;
        try {
        ctx.save();
        ctx.textBaseline = 'alphabetic';

        // Premium compact plate: beveled outer frame, inner edge, and subtle top highlight.
        ctx.shadowColor = 'rgba(0,0,0,0.48)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetY = 2;
        const grad = ctx.createLinearGradient(x0, plateY, x0, plateY + h);
        grad.addColorStop(0, bgTop);
        grad.addColorStop(0.58, 'rgba(0,0,0,0.72)');
        grad.addColorStop(1, bgBottom);
        ctx.fillStyle = grad;
        this.roundedNameplateRect(x0, plateY, w, h, 6);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeStyle = 'rgba(0,0,0,0.92)';
        ctx.lineWidth = 2;
        this.roundedNameplateRect(x0 - 0.5, plateY - 0.5, w + 1, h + 1, 6);
        ctx.stroke();
        ctx.strokeStyle = border;
        ctx.lineWidth = elite ? 1.35 : 1.05;
        this.roundedNameplateRect(x0 + 0.5, plateY + 0.5, w - 1, h - 1, 5);
        ctx.stroke();
        ctx.strokeStyle = inner;
        ctx.lineWidth = 1;
        this.roundedNameplateRect(x0 + 3, plateY + 3, w - 6, h - 6, 4);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,220,0.20)';
        ctx.beginPath();
        ctx.moveTo(x0 + 7, plateY + 4.5);
        ctx.lineTo(x0 + w - 7, plateY + 4.5);
        ctx.stroke();

        const fitText = (text, maxWidth) => {
          let out = String(text || '');
          if (ctx.measureText(out).width <= maxWidth) return out;
          while (out.length > 3 && ctx.measureText(`${out.slice(0, -1)}…`).width > maxWidth) out = out.slice(0, -1);
          return `${out}…`;
        };
        ctx.font = '12px ui-monospace, monospace';
        const emblemSize = classKey ? 8.3 : 0;
        const topIconPad = classKey ? 20 : 0;
        const maxTopTextW = Math.max(36, w - 24 - topIconPad);
        const nameText = fitText(name, maxTopTextW);
        const nameTextW = ctx.measureText(nameText).width;
        const topGroupW = nameTextW + topIconPad;
        const topX = Math.round(nx - topGroupW / 2);
        ctx.fillStyle = questInfo ? '#ffe8a6' : (elite ? '#ffe1a3' : (e.kind === 'enemy' ? '#ffd0ca' : '#f4ffe6'));
        if (classKey) {
          const iconX = topX + nameTextW + 10;
          ctx.textAlign = 'left';
          ctx.fillText(nameText, topX, plateY + 13);
          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,0.72)';
          this.roundedNameplateRect(iconX - 7.5, plateY + 2.5, 15, 15, 4);
          ctx.fill();
          ctx.strokeStyle = 'rgba(210,235,218,0.62)';
          ctx.lineWidth = 0.8;
          this.roundedNameplateRect(iconX - 7, plateY + 3, 14, 14, 4);
          ctx.stroke();
          ctx.restore();
          this.drawNameplateClassEmblem(classKey, iconX, plateY + 10.3, emblemSize);
        } else {
          ctx.textAlign = 'center';
          ctx.fillText(nameText, nx, plateY + 13);
        }

        const lineY = plateY + 27;
        ctx.font = '10px ui-monospace, monospace';
        const levelDisplay = levelText;
        const maxActionW = Math.max(28, w - levelW - 28 - (elite ? 18 : 0));
        const actionDisplay = fitText(actionText, maxActionW);
        const actionColor = /fight|attack|hostile|combat/i.test(actionText) ? '#ffd18b' : (/meditat|rest/i.test(actionText) ? '#99f0ff' : '#f1dc9a');
        ctx.textAlign = 'left';
        ctx.fillStyle = elite ? '#ffdd92' : (e.kind === 'enemy' ? '#ffc7c0' : '#dff5d9');
        ctx.fillText(levelDisplay, x0 + 9, lineY);
        if (elite) this.drawNameplateEliteEmblem(x0 + 9 + levelW + 8, lineY - 3, 9.5);
        ctx.textAlign = 'right';
        ctx.fillStyle = actionColor;
        ctx.fillText(actionDisplay, x0 + w - 9, lineY);

        const hpw = Math.max(42, Math.min(82, w - 16));
        const hpY = plateY + h + 3;
        const hpX = Math.round(nx - hpw / 2);
        const hpPct = clamp(Number(e.hp || 0) / Math.max(1, Number(e.maxHp || 1)), 0, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.78)';
        this.roundedNameplateRect(hpX, hpY, hpw, hpH, 2.5);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.95)';
        ctx.lineWidth = 1;
        this.roundedNameplateRect(hpX - 0.5, hpY - 0.5, hpw + 1, hpH + 1, 3);
        ctx.stroke();
        ctx.save();
        this.roundedNameplateRect(hpX, hpY, hpw, hpH, 2.5);
        ctx.clip();
        const hpGrad = ctx.createLinearGradient(hpX, hpY, hpX, hpY + hpH);
        if (e.kind === 'enemy') {
          hpGrad.addColorStop(0, elite ? '#ffc66a' : '#ff9b8f');
          hpGrad.addColorStop(1, elite ? '#cc6f28' : '#b94037');
        } else {
          hpGrad.addColorStop(0, '#b9ff9d');
          hpGrad.addColorStop(0.55, '#71db68');
          hpGrad.addColorStop(1, '#32893b');
        }
        ctx.fillStyle = hpGrad;
        ctx.fillRect(hpX, hpY, Math.max(0, hpw * hpPct), hpH);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(hpX, hpY, Math.max(0, hpw * hpPct), 1);
        ctx.restore();

        if (e.activeSpiderWeb) {
          const web = e.activeSpiderWeb;
          const webPct = clamp(Number(web.hp || 0) / Math.max(1, Number(web.maxHp || 100)), 0, 1);
          const webY = hpY + hpH + 3;
          const webH = 7;
          ctx.save();
          ctx.fillStyle = 'rgba(18,18,22,0.88)';
          this.roundedNameplateRect(hpX, webY, hpw, webH, 3.2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(235,235,245,0.70)';
          ctx.lineWidth = 0.85;
          this.roundedNameplateRect(hpX - 0.5, webY - 0.5, hpw + 1, webH + 1, 3.6);
          ctx.stroke();
          ctx.save();
          this.roundedNameplateRect(hpX, webY, hpw, webH, 3.2);
          ctx.clip();
          const webGrad = ctx.createLinearGradient(hpX, webY, hpX + hpw, webY);
          webGrad.addColorStop(0, '#ffffff');
          webGrad.addColorStop(0.5, '#d8dbe2');
          webGrad.addColorStop(1, '#9f9aa8');
          ctx.fillStyle = webGrad;
          ctx.fillRect(hpX, webY, Math.max(0, hpw * webPct), webH);
          ctx.restore();
          ctx.font = 'bold 7px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 2;
          ctx.strokeStyle = 'rgba(0,0,0,0.86)';
          ctx.strokeText('WEB', hpX + hpw / 2, webY + webH / 2 + 0.2);
          ctx.fillStyle = '#f7f7ff';
          ctx.fillText('WEB', hpX + hpw / 2, webY + webH / 2 + 0.2);
          ctx.restore();
        }

        if (e.kind === 'enemy') {
          const threatInfo = this.getPlayerThreatInfoForEnemy?.(e, this.player) || { percent: 0, rank: 0, isPrimary: false, threat: 0, highest: 0 };
          const threatPct = clamp(Number(threatInfo.percent || 0), 0, 1);
          const threatY = hpY + hpH + 3;
          const threatH = 9;
          const threatRadius = 3.8;
          ctx.fillStyle = 'rgba(24,14,4,0.88)';
          this.roundedNameplateRect(hpX, threatY, hpw, threatH, threatRadius);
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.98)';
          ctx.lineWidth = 1.6;
          this.roundedNameplateRect(hpX - 1, threatY - 1, hpw + 2, threatH + 2, threatRadius + 1.1);
          ctx.stroke();
          ctx.strokeStyle = threatInfo.isPrimary ? 'rgba(255,72,42,0.95)' : 'rgba(82,45,12,0.96)';
          ctx.lineWidth = threatInfo.isPrimary ? 1.05 : 0.75;
          this.roundedNameplateRect(hpX - 0.25, threatY - 0.25, hpw + 0.5, threatH + 0.5, threatRadius + 0.45);
          ctx.stroke();
          if (threatPct > 0.01) {
            ctx.save();
            this.roundedNameplateRect(hpX, threatY, hpw, threatH, threatRadius);
            ctx.clip();
            const threatGrad = ctx.createLinearGradient(hpX, threatY, hpX + hpw, threatY);
            threatGrad.addColorStop(0, '#e7d84c');
            threatGrad.addColorStop(0.55, '#ff9e2c');
            threatGrad.addColorStop(1, '#ff3f2e');
            ctx.fillStyle = threatGrad;
            ctx.fillRect(hpX, threatY, Math.max(0, hpw * threatPct), threatH);
            ctx.fillStyle = 'rgba(255,255,255,0.26)';
            ctx.fillRect(hpX, threatY, Math.max(0, hpw * threatPct), 1.4);
            ctx.restore();
          }
          const threatLabel = `Threat ${Math.round(threatPct * 100)}%`;
          ctx.save();
          ctx.font = '7px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 2.4;
          ctx.strokeStyle = 'rgba(0,0,0,0.92)';
          ctx.strokeText(threatLabel, hpX + hpw / 2, threatY + threatH / 2 + 0.25);
          ctx.fillStyle = threatPct >= 0.72 ? '#fff8dc' : '#fff3b8';
          ctx.fillText(threatLabel, hpX + hpw / 2, threatY + threatH / 2 + 0.25);
          ctx.restore();
        }
        ctx.restore();

        if (e.kind === 'player' && e.meditating) {
          const mw = hpw;
          const mh = 7;
          const barX = nx;
          const bx = hpX;
          const by = hpY + hpH + 3;
          const progress = clamp(Number(e.meditationProgress || 0), 0, 1);
          const fillW = mw * progress;
          // This bar is 15-second recovery-tick progress feedback, not an
          // EXP bar. Active Meditation still never advances player level
          // EXP (see game.js updateMeditationForEntity's XP safeguard), but
          // as of V0.17.23 valid ticks do grant Meditation skill EXP again -
          // that only shows up in the Skills panel, never here, so this
          // meter intentionally does not move for it.
          const rounded = (x0, y0, w0, h0) => {
            const r = h0 / 2;
            ctx.beginPath();
            ctx.moveTo(x0 + r, y0);
            ctx.lineTo(x0 + w0 - r, y0);
            ctx.arc(x0 + w0 - r, y0 + r, r, -Math.PI / 2, Math.PI / 2);
            ctx.lineTo(x0 + r, y0 + h0);
            ctx.arc(x0 + r, y0 + r, r, Math.PI / 2, Math.PI * 1.5);
            ctx.closePath();
          };
          ctx.save();
          const bgGrad = ctx.createLinearGradient(bx, by, bx, by + mh);
          bgGrad.addColorStop(0, '#102313');
          bgGrad.addColorStop(0.58, '#071509');
          bgGrad.addColorStop(1, '#030803');
          ctx.fillStyle = bgGrad;
          rounded(bx, by, mw, mh);
          ctx.fill();
          ctx.save();
          rounded(bx, by, mw, mh);
          ctx.clip();
          const grad = ctx.createLinearGradient(bx, by, bx, by + mh);
          grad.addColorStop(0, '#f2fff5');
          grad.addColorStop(0.38, '#8fffa5');
          grad.addColorStop(1, '#29b95f');
          ctx.fillStyle = grad;
          if (fillW > 0.5) {
            rounded(bx, by, fillW, mh);
            ctx.fill();
          }
          ctx.restore();
          ctx.strokeStyle = 'rgba(150,255,169,0.94)';
          ctx.lineWidth = 1.05;
          rounded(bx, by, mw, mh);
          ctx.stroke();
          ctx.font = '7px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 2.2;
          ctx.strokeStyle = 'rgba(0,0,0,0.90)';
          ctx.strokeText('Recovery', barX, by + mh / 2 + 0.3);
          ctx.fillStyle = '#f5fff2';
          ctx.fillText('Recovery', barX, by + mh / 2 + 0.3);
          ctx.restore();
        }
        } finally {
          window.ctx = npMainCtx; // always restore the real canvas, even if drawing threw
        }
        npCache.key = plateKey;
        ctx.drawImage(npCanvas, Math.round(x0 - NP_PAD_X), Math.round(plateY - NP_PAD_TOP));
      }
  }

  DR.EntityRenderer = {
    install(Game) {
      for (const name of Object.getOwnPropertyNames(EntityRendererMethods.prototype)) {
        if (name !== 'constructor') Game.prototype[name] = EntityRendererMethods.prototype[name];
      }
    }
  };
})();
