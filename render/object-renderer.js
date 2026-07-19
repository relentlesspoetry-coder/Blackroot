(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.SUPPRESS_WORLD_FLOATING_TEXT = true;


  DR.ObjectRenderer = {
    install(Game) {
      const { ctx } = DR.runtime || {};
      const { colorShade } = DR.utils || {};
      Object.assign(Game.prototype, {
      // Object / prop rendering

      // V0.20.98: honours the art profile's shadow block. Both knobs currently hold their existing
      // values (groundedProps true, contactRadiusScale 1), so this is a NO-OP by value today - it
      // makes the block a real, tunable knob instead of a dead one, without changing how anything
      // looks right now. That distinction matters: the profile shipped in V0.20.96 with five blocks
      // that nothing read at all.
      drawPropContactShadow(s, w = 22, h = 8, alpha = 0.22) {
        const { ctx } = window.DreamRealms.runtime || {};
        const shadows = window.DreamRealms.ART_PROFILE?.shadows;
        if (shadows && shadows.groundedProps === false) return;
        const rs = Number(shadows?.contactRadiusScale);
        if (Number.isFinite(rs) && rs > 0 && rs !== 1) { w *= rs; h *= rs; }
        ctx.save();
        const g = ctx.createRadialGradient(s.x, s.y + 6, 2, s.x, s.y + 6, Math.max(w, h));
        g.addColorStop(0, `rgba(0,0,0,${alpha})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 6, w, h, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },


      // Frame id for an authored prop, matching the naming in tools/authored-prop-spec.json:
      // "<type>_v<variant>" where the type has variants, "<type>" where it does not. Falls back
      // from the exact variant to v0 and then to the bare type, so a partially-delivered art set
      // still draws its authored frames instead of nothing.
      authoredPropFrameId(obj, atlasName) {
        const type = String(obj?.type || '');
        if (!type) return null;
        const v = obj?.variant;
        const candidates = [];
        if (v !== undefined && v !== null) candidates.push(`${type}_v${v}`);
        candidates.push(type, `${type}_v0`);
        for (const id of candidates) {
          if (this.authoredFrame?.(atlasName, id)) return id;
        }
        return null;
      },

      // ART DIRECTION PHASE 14: authored prop frames.
      //
      // ONE gated switch, placed ahead of the baked-procedural sheet path rather than threaded
      // through the ~180 per-prop draw routines. While no authored atlas is present this returns
      // false on its first line and the game renders exactly as it does today - the same
      // degrade-to-procedural contract systems/authored-atlas-system.js keeps throughout.
      //
      // The atlas is kicked off lazily on the first prop draw. Doing it at boot would need a call
      // site in the boot sequence, and the V0.20.96 profile is the cautionary tale there: it
      // shipped with nothing invoking it and sat inert for four versions.
      tryDrawAuthoredPropFrame(obj, s) {
        if (!obj || !s) return false;
        const atlasName = 'props_dark_woods';
        // Gate on THIS atlas, not on hasAuthoredArt('prop'). The waypoint shrine registers a
        // props-kind atlas of its own at boot, so the global flag is already true here and using
        // it meant the load below never fired and every lookup missed. Caught in verification.
        if (!this.authoredAtlases?.has(atlasName)) {
          if (!this._authoredPropAtlasKicked) {
            this._authoredPropAtlasKicked = true;
            this.ensureAuthoredAtlas?.('assets/atlases/props/props_dark_woods.json', atlasName);
          }
          return false;
        }
        const frameId = this.authoredPropFrameId(obj, atlasName);
        if (!frameId) return false;
        const f = this.authoredFrame(atlasName, frameId);
        if (!f?.rect) return false;
        // authoredFrame() swaps the numeric page index for the page OBJECT, so the index has to
        // come from the raw manifest. Reading f.page here would silently give NaN -> page 0, which
        // draws the wrong sprite for every frame that is not on the first page.
        const rawFrame = this.authoredAtlases.get(atlasName)?.manifest?.frames?.[frameId];
        const pageImg = this.authoredPageImage(atlasName, Number(rawFrame?.page) || 0);
        if (!pageImg) return false;

        const r = f.rect;
        const a = f.anchor || { x: r.w / 2, y: r.h };
        // Scale as the procedural path does, so authored and procedural props keep the same
        // footprint while the set is only partly converted.
        //
        // obj.scale is applied ONLY where the type's procedural routine actually responds to it.
        // Measured by drawing each type at obj.scale 1 and 2: tree, deadTree and brush grow, and
        // every other type measured EXACTLY 1.00 - it ignores obj.scale. Applying it uniformly
        // made authored rootArch 1.23x its procedural counterpart, which was that instance's
        // obj.scale exactly.
        const objScale = f.appliesObjScale ? (Number(obj?.scale) || 1) : 1;
        const scale = (this.overworldObjectScale?.(obj) ?? 1) * objScale;

        if (f.contactShadow && this.drawPropContactShadow) {
          this.drawPropContactShadow(s, f.contactShadow.rx * scale, f.contactShadow.ry * scale,
            f.contactShadow.alpha);
        }

        const dw = r.w * scale, dh = r.h * scale;
        ctx.save();
        ctx.imageSmoothingEnabled = false;   // authored pixel art must not be resampled soft
        ctx.drawImage(pageImg, r.x, r.y, r.w, r.h,
          s.x - a.x * scale, s.y - a.y * scale, dw, dh);
        ctx.restore();
        obj._authoredFrameKey = frameId;
        return true;
      },

      tryDrawObjectSpriteSheetFrame(obj, s) {
        const sheetSystem = this.spriteSheetSystem;
        if (!sheetSystem?.isReady?.() || !obj || !s) {
          sheetSystem?.recordProceduralFallback?.(sheetSystem?.indexLoading ? 'prop_sheet_index_loading' : 'prop_sheet_index_not_ready');
          return false;
        }
        const resolved = sheetSystem.getObjectFrame?.(obj, this, { warn: true });
        const frame = resolved?.frame;
        if (!frame) {
          sheetSystem.recordProceduralFallback?.('missing_prop_sheet_frame');
          obj._spriteSheetRenderMode = sheetSystem.loadingModels?.size ? 'prop sprite loading' : 'procedural';
          return false;
        }
        const objectType = String(obj?.type || '').toLowerCase();
        const spriteScale = (objectType === 'vendorstall' || objectType === 'vendor_stall' || objectType === 'largecamptent' || objectType === 'camptentlarge')
          ? (this.startingCampObjectScale?.(obj) || obj?.scale || 1)
          : 1;
        if (!sheetSystem.drawFrame(ctx, frame, s.x, s.y, { scale: spriteScale, imageSmoothingEnabled: false })) {
          sheetSystem.recordProceduralFallback?.('prop_sprite_draw_failed');
          obj._spriteSheetRenderMode = 'procedural';
          return false;
        }
        obj._spriteSheetRenderMode = 'sprite';
        obj._spriteSheetFrameKey = resolved.fullKey || `${resolved.modelId}.${resolved.key}`;
        return true;
      },

      startingCampObjectScale(obj) {
        const type = String(obj?.type || '').toLowerCase();
        const name = String(obj?.name || '').toLowerCase();
        const inCamp = Boolean(obj?.startingCamp || obj?.campObject || name.includes('camp') || name.includes('dead lantern'));
        if (type.includes('tent')) return obj?.scale || (inCamp ? 3.1 : 2.35);
        if (type.includes('building') || type.includes('hut') || type.includes('house') || type.includes('vendor') || type.includes('shop')) return obj?.scale || (inCamp ? 3.5 : 2.75);
        if (type.includes('banner') || type.includes('crate') || type.includes('barrel')) return obj?.scale || (inCamp ? 1.7 : 1.25);
        return obj?.scale || 1;
      },

      // Per-type "real world" size multiplier, applied as a transform around the
      // object's ground-contact point in drawObject. The generic prop draws are
      // authored at a small fixed footprint - a tent apex is only ~70px tall and
      // a well ~52px, versus a ~90px character - so untouched they read as
      // toy-sized next to the player. This scales built structures up so they are
      // clearly larger than a character, while leaving small ground clutter and
      // already-tuned foliage close to their authored size.
      overworldObjectScale(obj) {
        const key = (String(obj?.type || '') + ' ' + String(obj?.name || '')).toLowerCase();
        // Web / silk / cocoon props are decals stuck to a surface, not built
        // structures - keep them at authored size (and out of the 'cave' ->
        // caveEntrance, 'gate' and 'rack' structure buckets below).
        if (/web|silk|cocoon|spider/.test(key)) return 1;
        // Large built structures - noticeably bigger than a character.
        if (/tent|leanto|lean-to|hut|house|cabin|building|\bshop\b|vendor|stall|forge|smith|well|shrine|gate|caveentrance|cavemouth|dungeon|tower|barn|windmill/.test(key)) return 2.2;
        // Mid-sized furnishings / stations - roughly person-to-cart sized.
        if (/loom|cookingspit|weaponrack|studytable|ritualcircle|sparringdummy|herbalisttable|supplystack|stashchest|altar|anvil|cart|wagon|table|rack|bench|statue|obelisk|totem|banner|fence|rootarch|signpost/.test(key)) return 1.5;
        // Small ground clutter - keep close to authored size.
        if (/crate|barrel|bedroll|logseat|stool|\bpot\b|pouch|coin|candle|lantern|mushroom|shroom|rock|stone|bush|brush|bone|skull|trap|cloak|sack|basket|bucket|debris/.test(key)) return 1.12;
        // Natural growth is already tuned by its own draw routines.
        if (/tree|log|stump|root|flower|grass|reed|vine|fern/.test(key)) return 1;
        return 1.25; // gentle default so unlisted props still read at scale
      },

      drawObject(x, y, obj, elev) {
        const s = this.worldToScreen(x + 0.5, y + 0.5, elev);
        // Authored art wins over the baked-procedural sheet, which in turn wins over procedural
        // drawing. Both return false when they have nothing, so the chain degrades cleanly.
        if (this.tryDrawAuthoredPropFrame?.(obj, s)) return;
        if (this.tryDrawObjectSpriteSheetFrame?.(obj, s)) return;
        // Stable per-object seed from the WORLD tile (not the moving screen point)
        // so procedural props like spider webs keep a fixed shape as the camera
        // pans, instead of re-rolling their random geometry every frame.
        if (obj && obj._propSeed == null) obj._propSeed = Math.floor(x) * 73856 + Math.floor(y) * 19349;
        // V0.20.63: distance level-of-detail. Measured at camp, a webbed bush costs 274 canvas ops and
        // a tree 191 - drawn identically whether they are at your feet or twenty tiles away. Beyond
        // propDetailRadius the fiddly parts (orb webs, dew, extra crown blobs, branch strokes) are
        // skipped. This is NOT caching: no bitmaps, no textures, nothing retained between frames -
        // which is what separates it from the three reverted attempts. Set on the renderer rather than
        // threaded through every drawX signature, because those take (s, obj) and there are ~180 of them.
        const lodPlayer = this.player;
        if (lodPlayer) {
          const ldx = x - lodPlayer.x;
          const ldy = y - lodPlayer.y;
          const lodR = Number(DR.CONFIG?.PERFORMANCE?.propDetailRadius ?? 11);
          this._propFarDetail = (ldx * ldx + ldy * ldy) > lodR * lodR;
        } else this._propFarDetail = false;
        const objectType = String(obj?.type || '').toLowerCase();
        const campScale = this.startingCampObjectScale?.(obj) || obj?.scale || 1;
        if (objectType === 'vendorstall' || objectType === 'vendor_stall') return this.drawVendorStall(obj, s, null, campScale);
        if (objectType === 'largecamptent' || objectType === 'camptentlarge') return this.drawLargeCampTent(obj, s, null, campScale);
        const objScale = this.overworldObjectScale?.(obj) ?? 1;
        if (objScale === 1) return this.drawObjectShape(obj, s);
        // Scale the whole prop (and its contact shadow) about its foot point so it
        // grows upward from the ground rather than drifting off its tile.
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.scale(objScale, objScale);
        ctx.translate(-s.x, -s.y);
        this.drawObjectShape(obj, s);
        ctx.restore();
      },

      drawObjectShape(obj, s) {
        const shadowSize = {
          tree: [30, 11, 0.24],
          deadTree: [28, 10, 0.25],
          evilTree: [105, 28, 0.42],
          rock: [18, 7, 0.23],
          mushroom: [13, 5, 0.18],
          glowMushroom: [16, 6, 0.18],
          crate: [18, 7, 0.24],
          // barrel deliberately absent: drawBarrel already calls drawPropContactShadow itself with
          // the identical (16, 7, 0.24). Listing it here too drew the shadow TWICE, stacking to an
          // effective alpha near 0.42 - so every barrel in the game sat on a shadow well over half
          // again as dark as authored. Found by instrumenting the helper and counting calls per
          // prop type; the table was the duplicate, so the table entry is what goes.
          tent: [26, 10, 0.25],
          banner: [12, 5, 0.18],
          lanternPost: [10, 4, 0.20],
          campLeanTo: [34, 11, 0.24],
          bedroll: [19, 7, 0.18],
          logSeat: [24, 7, 0.18],
          cookingSpit: [28, 8, 0.19],
          sparringDummy: [16, 7, 0.22],
          weaponRack: [22, 8, 0.22],
          studyTable: [28, 9, 0.22],
          ritualCircle: [30, 10, 0.12],
          supplyStack: [26, 9, 0.23],
          stashChest: [30, 10, 0.26],
          rootArch: [31, 12, 0.22],
          caveEntrance: [35, 12, 0.28],
          dungeonGate: [42, 13, 0.30],

          // V0.20.98 (Art Direction Phase 19): props that rendered with NO grounding shadow at all.
          // Found by instrumenting drawPropContactShadow and calling drawObject once per dispatch
          // type - 105 types draw something, 66 were already grounded (many by calling the helper
          // directly rather than appearing in this table, which is why reading the source alone
          // suggested 118 were missing), and these are the ones that genuinely were not.
          //
          // The landmarks are the reason this reads as "floating": a town house, a shop, a well and
          // the waypoint shrine were all sitting on the ground with nothing under them.
          townHouse: [58, 18, 0.30],
          shop: [54, 17, 0.30],
          well: [30, 11, 0.26],
          campStall: [34, 12, 0.24],
          waypoint: [58, 20, 0.30],
          ruinWall: [40, 12, 0.26],
          ruinPillar: [20, 8, 0.26],
          forge: [30, 11, 0.26],
          loom: [26, 10, 0.24],
          herbalistTable: [28, 10, 0.24],
          mercpost: [22, 9, 0.24],
          ashStump: [20, 8, 0.24],
          brush: [16, 6, 0.18],
          caveHerb: [12, 5, 0.16],
          crystalNode: [18, 7, 0.20],
          brokenCart: [34, 12, 0.26],
          dungeonTreasure: [26, 10, 0.28],
          puzzleSwitch: [14, 6, 0.22],
          puzzleDoor: [34, 11, 0.28],
          chitinColumn: [22, 9, 0.26],
          royalPylon: [26, 10, 0.28],
          silkReliquary: [24, 9, 0.26],
          brokenExpeditionMarker: [18, 7, 0.22],
          limestoneRubble: [22, 8, 0.22],
          expeditionWarningRelic: [18, 7, 0.22],
          stalagmiteCluster: [24, 9, 0.24],
          silkWrappedGear: [18, 7, 0.22]

          // DELIBERATELY LEFT UNGROUNDED, because a contact shadow would be wrong rather than missing:
          //   cave, caveExit, caveStairsDown, caveStairsUp, dungeonStairs - openings in the floor. A
          //     shadow cast onto a hole reads as a lid over it.
          //   stalactiteCluster, flowstoneDrapery, heavyWebCurtain - hang from the ceiling and never
          //     touch the ground (note stalagmiteCluster, which does, IS grounded above).
          //   miningVein - embedded in a rock face, not standing on the floor.
          //   fire - a light source. Darkness directly beneath a flame is backwards.
          //   grassTuft, flower - small enough that a shadow only muddies the grass under them.
        }[obj.type];
        if (shadowSize) this.drawPropContactShadow(s, shadowSize[0], shadowSize[1], shadowSize[2]);
        switch (obj.type) {
          case 'tree': return this.drawTree(s, obj);
          case 'brush': return this.drawBrush(s, obj);
          case 'rock': return this.drawRock(s, obj);
          case 'thornBush': return this.drawThornBush(s, obj);
          case 'webbedBush': return this.drawWebbedBush(s, obj);
          case 'brokenWeapon': return this.drawBrokenWeapon(s, obj);
          case 'mushroom': return this.drawMushroom(s);
          case 'tent': return this.drawTent(s);
          case 'fire': return this.drawFire(s, obj);
          case 'forge': return this.drawForge(s);
          case 'loom': return this.drawLoom(s);
          case 'herbalistTable': return this.drawHerbalistTable(s);
          case 'crate': return this.drawCrate(s);
          case 'banner': return this.drawBanner(s);
          case 'lanternPost': return this.drawLanternPost(s, obj);
          case 'campLeanTo': return this.drawCampLeanTo(s, obj);
          case 'bedroll': return this.drawBedroll(s, obj);
          case 'logSeat': return this.drawLogSeat(s, obj);
          case 'cookingSpit': return this.drawCookingSpit(s, obj);
          case 'sparringDummy': return this.drawSparringDummy(s, obj);
          case 'weaponRack': return this.drawWeaponRack(s, obj);
          case 'studyTable': return this.drawStudyTable(s, obj);
          case 'ritualCircle': return this.drawRitualCircle(s, obj);
          case 'supplyStack': return this.drawSupplyStack(s, obj);
          case 'stashChest': return this.drawStashChest(s, obj);
          case 'deadTree': return this.drawDeadTree(s, obj);
          case 'evilTree': return this.drawEvilTree(s, obj);
          case 'ashStump': return this.drawAshStump(s, obj);
          case 'glowMushroom': return this.drawGlowMushroomCluster(s, obj);
          case 'rootArch': return this.drawRootArch(s, obj);
          case 'fallenLog': return this.drawFallenLog(s, obj);
          case 'rootCluster': return this.drawRootCluster(s, obj);
          case 'rootBarrier': return this.drawRootBarrier(s, obj);
          case 'hunterTrap': return this.drawHunterTrap(s, obj);
          case 'coinPouch': return this.drawCoinPouch(s, obj);
          case 'candleCluster': return this.drawCandleCluster(s, obj);
          case 'tornCloak': return this.drawTornCloak(s, obj);
          case 'bloodTrail': return this.drawBloodTrail(s, obj);
          case 'archerPlatform': return this.drawArcherPlatform(s, obj);
          case 'clawMarks': return this.drawClawMarks(s, obj);
          case 'mercpost': return this.drawMercPost(s);
          case 'grassTuft': return this.drawGrassTuft(s);
          case 'flower': return this.drawFlowerPatch(s);
          case 'cave': return this.drawCaveEntrance(s, obj);
          case 'caveExit': return this.drawCaveExit(s, obj);
          case 'caveStairsDown': return this.drawCaveStairs(s, obj, 'DOWN');
          case 'caveStairsUp': return this.drawCaveStairs(s, obj, 'UP');
          case 'caveWeb': return this.drawCaveWeb(s, obj);
          case 'caveHerb': return this.drawCaveHerb(s, obj);
          case 'caveMushrooms': return this.drawCaveMushrooms(s, obj);
          case 'miningVein': return this.drawMiningVein(s, obj);
          case 'crystalNode': return this.drawCrystalNode(s, obj);
          case 'cavePoolMarker': return this.drawCavePoolMarker(s, obj);
          case 'hangingRoots': return this.drawHangingRoots(s, obj);
          case 'bones': return this.drawBones(s, obj);
          case 'mineSupport': return this.drawMineSupport(s, obj);
          case 'brokenCart': return this.drawBrokenCart(s, obj);
          case 'torch': return this.drawTorch(s, obj);
          case 'dungeonGate': return this.drawDungeonGate(s, obj);
          case 'dungeonExit': return this.drawDungeonExit(s, obj);
          case 'dungeonStairs': return this.drawDungeonStairs(s, obj);
          case 'dungeonTreasure': return this.drawDungeonTreasure(s, obj);
          case 'puzzleSwitch': return this.drawPuzzleSwitch(s, obj);
          case 'puzzleKey': return this.drawPuzzleKey(s, obj);
          case 'puzzleLock': return this.drawPuzzleLock(s, obj);
          case 'puzzleDoor': return this.drawPuzzleDoor(s, obj);
          case 'webAnchor': return this.drawWebAnchor(s, obj);
          case 'webGate': return this.drawWebGate(s, obj);
          case 'silkCocoon': return this.drawSilkCocoon(s, obj);
          case 'bossCocoonPrison': return this.drawBossCocoonPrison(s, obj);
          case 'webHazard': return this.drawWebHazard(s, obj);
          case 'poisonDrip': return this.drawPoisonDrip(s, obj);
          case 'venomSack': return this.drawVenomSack(s, obj);
          case 'venomSackBurst': return this.drawVenomSackBurst(s, obj);
          case 'spiderEgg': return this.drawSpiderEgg(s, obj);
          case 'eggPile': return this.drawEggPile(s, obj);
          case 'spiderEggBurst': return this.drawSpiderEggBurst(s, obj);
          case 'venomEgg': return this.drawVenomEgg(s, obj);
          case 'venomEggBurst': return this.drawVenomEggBurst(s, obj);
          case 'webWrappedBody': return this.drawWebWrappedBody(s, obj);
          case 'brokenWrappedBody': return this.drawBrokenWrappedBody(s, obj);
          case 'ceilingWebColumn': return this.drawCeilingWebColumn(s, obj);
          case 'webJunkPile': return this.drawWebJunkPile(s, obj);
          case 'webbedBonePile': return this.drawWebbedBonePile(s, obj);
          case 'caveStalagmite': return this.drawCaveStalagmite(s, obj);
          case 'caveRocks': return this.drawCaveRocks(s, obj);
          case 'giantSpiderNest': return this.drawGiantSpiderNest(s, obj);
          case 'giantWebLair': return this.drawGiantWebLair(s, obj);
          case 'bossWebSeal': return this.drawBossWebSeal(s, obj);
          case 'webBridge': return this.drawWebBridge(s, obj);
          case 'silkStrands': return this.drawSilkStrands(s, obj);
          case 'eggCluster': return this.drawSilkCavernHighFidelityDetail(s, obj);
          case 'chitinColumn': return this.drawSilkCavernHighFidelityDetail(s, obj);
          case 'broodGrowth': return this.drawSilkCavernHighFidelityDetail(s, obj);
          case 'webBones': return this.drawSilkCavernHighFidelityDetail(s, obj);
          case 'venomPool': return this.drawVenomPool(s, obj);
          case 'royalPylon': return this.drawSilkCavernHighFidelityDetail(s, obj);
          case 'silkReliquary': return this.drawSilkCavernHighFidelityDetail(s, obj);
          case 'webCurtain': return this.drawWebCurtain(s, obj);
          case 'cocoonWall': return this.drawCocoonWall(s, obj);
          case 'pitShadow': return this.drawPitShadow(s, obj);
          case 'silkFloorSigil': return this.drawSilkFloorSigil(s, obj);
          case 'bossArenaMark': return this.drawBossArenaMark(s, obj);
          case 'brokenExpeditionMarker': return this.drawBrokenExpeditionMarker(s, obj);
          case 'webbedWeaponRack': return this.drawWebbedWeaponRack(s, obj);
          case 'venomRunoff': return this.drawVenomRunoff(s, obj);
          case 'flowstoneDrapery':
          case 'limestoneRubble':
          case 'expeditionWarningRelic':
          case 'silkAnchorBundle':
          case 'heavyWebCurtain':
          case 'preyCocoonRack':
          case 'boneMidden':
          case 'hatchedEggSac':
          case 'spiderlingNook':
          case 'shedExoskeleton':
          case 'bossBroodNest':
          case 'waterSeep':
          case 'escapeTunnelMouth':
          case 'stalactiteCluster':
          case 'stalagmiteCluster':
          case 'phosphorFungusCluster':
          case 'silkWrappedGear':
            return this.drawSilkCavernHighFidelityDetail(s, obj);
          case 'ruinWall': return this.drawRuinWall(s, obj);
          case 'ruinPillar': return this.drawRuinPillar(s, obj);
          case 'ruinArch': return this.drawRuinArch(s, obj);
          case 'rubble': return this.drawRubble(s, obj);
          case 'barrel': return this.drawBarrel(s, obj);
          case 'sackPile': return this.drawSackPile(s, obj);
          case 'ropeBundle': return this.drawRopeBundle(s, obj);
          case 'barricade': return this.drawBarricade(s, obj);
          case 'standingStone': return this.drawStandingStone(s, obj);
          case 'runeStone': return this.drawRuneStone(s, obj);
          case 'brokenSlab': return this.drawBrokenSlab(s, obj);
          case 'magicResidue': return this.drawMagicResidue(s, obj);
          case 'waypoint': return this.drawWaypoint(s, obj);
          case 'townHouse': return this.drawTownHouse(s, obj.variant);
          case 'shop': return this.drawShop(s);
          case 'well': return this.drawWell(s, obj);
          case 'fence': return this.drawFence(s);
          case 'campStall': return this.drawCampStall(s);
        }
      },

      drawStashChest(s, obj = {}) {
        ctx.save();
        const scale = Number(obj.scale || 1.35);
        ctx.translate(s.x, s.y);
        ctx.scale(scale, scale);
        ctx.fillStyle = 'rgba(0,0,0,0.30)';
        ctx.beginPath();
        ctx.ellipse(0, 8, 28, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        const wood = obj.color || '#7a4f2d';
        ctx.fillStyle = '#392516';
        this.fillPoly([{x:-26,y:-7},{x:26,y:-7},{x:22,y:12},{x:-22,y:12}]);
        ctx.fillStyle = wood;
        this.fillPoly([{x:-24,y:-8},{x:24,y:-8},{x:20,y:10},{x:-20,y:10}]);
        ctx.fillStyle = colorShade ? colorShade(wood, 34) : '#9b6a3c';
        this.fillPoly([{x:-22,y:-9},{x:0,y:-18},{x:22,y:-9},{x:24,y:-4},{x:-24,y:-4}]);
        ctx.strokeStyle = '#2a1a10';
        ctx.lineWidth = 2;
        ctx.strokeRect(-24, -8, 48, 18);
        ctx.beginPath();
        ctx.moveTo(-21, -4); ctx.lineTo(21, -4);
        ctx.moveTo(-14, -8); ctx.lineTo(-14, 10);
        ctx.moveTo(14, -8); ctx.lineTo(14, 10);
        ctx.stroke();
        ctx.fillStyle = '#d8ad57';
        ctx.strokeStyle = '#2a1a10';
        ctx.lineWidth = 1.5;
        ctx.fillRect(-5, -2, 10, 10);
        ctx.strokeRect(-5, -2, 10, 10);
        ctx.fillStyle = 'rgba(216,173,87,0.20)';
        ctx.beginPath();
        ctx.ellipse(0, 2, 28, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },

      drawCampLeanTo(s, obj = {}) {
        ctx.save();
        const scale = Number(obj.scale || 1);
        ctx.translate(s.x, s.y);
        ctx.scale(scale, scale);
        ctx.fillStyle = 'rgba(0,0,0,0.24)';
        ctx.beginPath();
        ctx.ellipse(4, 10, 36, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#3a2b1f';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-30, 4); ctx.lineTo(-8, -42); ctx.lineTo(28, -25); ctx.lineTo(34, 4);
        ctx.stroke();
        ctx.fillStyle = '#5a3d28';
        this.fillPoly([{x:-31,y:4},{x:-8,y:-42},{x:28,y:-25},{x:34,y:4},{x:4,y:-3}]);
        ctx.fillStyle = '#8b6a45';
        this.fillPoly([{x:-24,y:1},{x:-5,y:-33},{x:18,y:-22},{x:2,y:-4}]);
        ctx.strokeStyle = 'rgba(35,24,18,0.85)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(-25 + i * 12, 0 - i * 1.5);
          ctx.lineTo(-7 + i * 6, -36 + i * 2.2);
          ctx.stroke();
        }
        ctx.restore();
      },

      drawBedroll(s, obj = {}) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(Number(obj.rotation || -0.18));
        ctx.fillStyle = 'rgba(0,0,0,0.20)';
        ctx.beginPath();
        ctx.ellipse(0, 8, 24, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        const color = obj.color || '#776449';
        ctx.fillStyle = color;
        this.fillPoly([{x:-25,y:0},{x:12,y:-9},{x:28,y:-1},{x:-10,y:9}]);
        ctx.fillStyle = colorShade ? colorShade(color, 28) : '#927753';
        this.fillPoly([{x:9,y:-9},{x:28,y:-1},{x:15,y:8},{x:-2,y:1}]);
        ctx.strokeStyle = 'rgba(34,22,14,0.7)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(-17 + i * 13, -2 + i);
          ctx.lineTo(-1 + i * 13, 3 + i);
          ctx.stroke();
        }
        ctx.restore();
      },

      drawLogSeat(s, obj = {}) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(Number(obj.rotation || 0));
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath();
        ctx.ellipse(0, 8, 31, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5f3a22';
        this.fillPoly([{x:-34,y:-2},{x:23,y:-9},{x:34,y:-1},{x:-22,y:8}]);
        ctx.fillStyle = '#7a4a28';
        this.fillPoly([{x:-30,y:-7},{x:25,y:-14},{x:34,y:-6},{x:-20,y:2}]);
        ctx.strokeStyle = '#2f1b10';
        ctx.lineWidth = 1.4;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(-24 + i * 11, -6 + (i % 2));
          ctx.lineTo(-21 + i * 11, 3 + (i % 2));
          ctx.stroke();
        }
        ctx.restore();
      },

      drawCookingSpit(s, obj = {}) {
        ctx.save();
        ctx.strokeStyle = '#3e2a1c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(s.x - 30, s.y - 2); ctx.lineTo(s.x - 18, s.y - 33);
        ctx.moveTo(s.x + 31, s.y - 5); ctx.lineTo(s.x + 19, s.y - 35);
        ctx.stroke();
        ctx.strokeStyle = '#6c4b2f';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(s.x - 24, s.y - 31); ctx.lineTo(s.x + 27, s.y - 36);
        ctx.stroke();
        ctx.fillStyle = '#7b3e22';
        ctx.beginPath();
        ctx.ellipse(s.x + 2, s.y - 34, 13, 5, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.22 + Math.sin(performance.now() / 320) * 0.05;
        ctx.fillStyle = '#c9c0b0';
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.ellipse(s.x - 3 + i * 9, s.y - 54 - i * 5, 5 + i * 1.2, 13 + i * 3, -0.25, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      },

      drawSparringDummy(s, obj = {}) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.24)';
        ctx.beginPath();
        ctx.ellipse(s.x + 2, s.y + 10, 18, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#3b2617';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y + 8); ctx.lineTo(s.x, s.y - 52);
        ctx.moveTo(s.x - 23, s.y - 25); ctx.lineTo(s.x + 23, s.y - 31);
        ctx.stroke();
        ctx.fillStyle = obj.variant ? '#6a3e2a' : '#7a5436';
        this.fillPoly([{x:s.x-13,y:s.y-45},{x:s.x+11,y:s.y-48},{x:s.x+18,y:s.y-13},{x:s.x-10,y:s.y-10}]);
        ctx.strokeStyle = '#c9a46a';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(s.x - 12, s.y - 37 + i * 9);
          ctx.lineTo(s.x + 14, s.y - 40 + i * 9);
          ctx.stroke();
        }
        ctx.restore();
      },

      drawWeaponRack(s, obj = {}) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath();
        ctx.ellipse(s.x + 2, s.y + 10, 25, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#4c3320';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(s.x - 22, s.y + 4); ctx.lineTo(s.x - 16, s.y - 42);
        ctx.moveTo(s.x + 20, s.y + 4); ctx.lineTo(s.x + 14, s.y - 42);
        ctx.moveTo(s.x - 22, s.y - 25); ctx.lineTo(s.x + 18, s.y - 31);
        ctx.stroke();
        const weapons = [-14, -4, 6, 15];
        for (const [i, x] of weapons.entries()) {
          ctx.strokeStyle = i % 2 ? '#9f9a88' : '#b8ac82';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(s.x + x, s.y - 4);
          ctx.lineTo(s.x + x + (i % 2 ? 7 : -5), s.y - 50);
          ctx.stroke();
        }
        ctx.restore();
      },

      drawStudyTable(s, obj = {}) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.24)';
        ctx.beginPath();
        ctx.ellipse(s.x + 2, s.y + 12, 31, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4b2f1e';
        this.fillPoly([{x:s.x-28,y:s.y-13},{x:s.x+19,y:s.y-23},{x:s.x+32,y:s.y-10},{x:s.x-15,y:s.y+1}]);
        ctx.fillStyle = '#7f5b38';
        this.fillPoly([{x:s.x-24,y:s.y-16},{x:s.x+17,y:s.y-24},{x:s.x+27,y:s.y-14},{x:s.x-14,y:s.y-5}]);
        ctx.fillStyle = '#d9c79b';
        this.fillPoly([{x:s.x-12,y:s.y-21},{x:s.x+2,y:s.y-24},{x:s.x+10,y:s.y-19},{x:s.x-5,y:s.y-16}]);
        ctx.fillStyle = '#8fb7ff';
        ctx.beginPath();
        ctx.arc(s.x + 17, s.y - 21, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.35 + Math.sin(performance.now() / 260) * 0.08;
        ctx.strokeStyle = obj.color || '#b894ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(s.x + 17, s.y - 21, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      },

      drawRitualCircle(s, obj = {}) {
        ctx.save();
        const color = obj.color || '#83b7ff';
        const t = performance.now() / 800;
        ctx.globalAlpha = 0.42 + Math.sin(t) * 0.08;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 7, 31, 12, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha *= 0.75;
        for (let i = 0; i < 6; i++) {
          const a = t * 0.35 + i * Math.PI / 3;
          ctx.beginPath();
          ctx.arc(s.x + Math.cos(a) * 24, s.y + 7 + Math.sin(a) * 9, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
        ctx.restore();
      },

      drawSupplyStack(s, obj = {}) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.24)';
        ctx.beginPath();
        ctx.ellipse(s.x + 2, s.y + 12, 28, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 3; i++) {
          const ox = [-18, 1, -8][i];
          const oy = [0, -6, -14][i];
          ctx.fillStyle = i === 1 ? '#6b4a2c' : '#7b5634';
          this.fillPoly([{x:s.x+ox-12,y:s.y+oy-3},{x:s.x+ox+10,y:s.y+oy-8},{x:s.x+ox+18,y:s.y+oy+1},{x:s.x+ox-5,y:s.y+oy+7}]);
          ctx.strokeStyle = '#3c2516';
          ctx.stroke();
        }
        ctx.fillStyle = '#8d7a55';
        ctx.beginPath();
        ctx.ellipse(s.x + 17, s.y - 6, 10, 7, -0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },

      drawGrassTuft(s) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(s.x + 3, s.y + 8, 18, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        const blades = ['#8bae45', '#5f8d34', '#b0c866', '#3f6d2d'];
        for (let i = 0; i < 10; i++) {
          const px = s.x - 18 + i * 4 + (i % 2);
          const h = 11 + (i % 4) * 4;
          ctx.fillStyle = blades[i % blades.length];
          this.fillPoly([{ x: px, y: s.y + 7 }, { x: px + 3, y: s.y - h }, { x: px + 7, y: s.y + 8 }]);
        }
        ctx.restore();
      },

      drawFlowerPatch(s) {
        this.drawGrassTuft(s);
        const flowers = ['#e7d36a', '#d66d9b', '#e8eee2', '#9fc7ff'];
        for (let i = 0; i < 7; i++) {
          const x = s.x - 15 + i * 5;
          const y = s.y - 5 + (i % 3) * 4;
          ctx.fillStyle = flowers[i % flowers.length];
          ctx.fillRect((x - 1) | 0, (y - 1) | 0, 3, 3);
        }
      },



      drawCaveStairs(s, obj = {}, label = 'DOWN') {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.36)';
        ctx.beginPath();
        ctx.ellipse(s.x + 3, s.y + 13, 42, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = i % 2 ? '#3d3329' : '#6a5b45';
          this.fillPoly([
            { x: s.x - 35 + i * 8, y: s.y + 15 - i * 7 },
            { x: s.x + 18 + i * 8, y: s.y + 2 - i * 7 },
            { x: s.x + 31 + i * 8, y: s.y + 9 - i * 7 },
            { x: s.x - 21 + i * 8, y: s.y + 22 - i * 7 }
          ]);
        }
        ctx.strokeStyle = label === 'UP' ? '#f0dca0' : '#8df0bc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x - 30, s.y + 19);
        ctx.lineTo(s.x + 61, s.y - 12);
        ctx.stroke();
        ctx.fillStyle = '#f4dfae';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label, s.x + 13, s.y + 35);
        ctx.restore();
      },

      // Reusable spider-web primitive. Draws an orb web the way a real one is
      // built: irregular radial spokes off an off-centre hub, a bowed outer
      // frame, and a spiral CAPTURE thread whose segments sag toward the hub -
      // that concave sag between spokes is what reads as a "web" instead of the
      // old radar target of perfect concentric circles. Optional `anchors`
      // (surface points in screen space) get support/bridge threads tying the
      // web to whatever it hangs on. Deterministic per `seed` so a static web
      // doesn't shimmer every frame.
      // V0.20.3: renamed from drawOrbWeb. There were TWO methods called drawOrbWeb on this object -
      // this options-form one, and a positional-form `drawOrbWeb(cx, cy, r, silkP, alpha, rnd, ky)`
      // further down the file. In an object literal the LAST definition silently wins, so this entire
      // implementation was unreachable dead code, and its three callers were really hitting the
      // positional one: they passed an options OBJECT where `r` was expected, which left `rnd`
      // undefined and threw "rnd is not a function" every frame. Webbed bushes, web-strung trees and
      // the anchored props were not drawing at all. The two names now describe what each actually is:
      // this one ties a web to explicit `anchors` (branch tips), which the positional one cannot do.
      drawAnchoredOrbWeb(cx, cy, opts = {}) {
        const rx = Number(opts.rx || 30);
        const ry = Number(opts.ry != null ? opts.ry : rx * 0.62);
        const spokes = Math.max(6, Math.floor(opts.spokes || 11));
        const rings = Math.max(2, Math.floor(opts.rings || 5));
        const tilt = Number(opts.tilt || 0);
        const alpha = Number(opts.alpha != null ? opts.alpha : 1);
        const color = opts.color || '#e6ddf4';
        const sag = Number(opts.sag != null ? opts.sag : 0.16);
        const anchors = Array.isArray(opts.anchors) ? opts.anchors : null;
        const dew = Math.max(0, Math.floor(opts.dew || 0));
        const seed = Number(opts.seed != null ? opts.seed : (cx * 73856 + cy * 19349));
        const rnd = (n) => { const v = Math.sin(seed * 0.001 + n * 12.9898) * 43758.5453; return v - Math.floor(v); };

        // Off-centre hub, then spoke endpoints on an irregular frame.
        const hubX = cx + (rnd(1) - 0.5) * rx * 0.18;
        const hubY = cy + (rnd(2) - 0.5) * ry * 0.18;
        const spk = [];
        for (let i = 0; i < spokes; i++) {
          const a = (i / spokes) * Math.PI * 2 + tilt + (rnd(i + 3) - 0.5) * (Math.PI * 2 / spokes) * 0.42;
          const fr = 0.82 + rnd(i + 40) * 0.32;
          spk.push({ ex: hubX + Math.cos(a) * rx * fr, ey: hubY + Math.sin(a) * ry * fr });
        }
        const P = (i, f) => ({ x: hubX + (spk[i].ex - hubX) * f, y: hubY + (spk[i].ey - hubY) * f });

        const traceWeb = () => {
          ctx.beginPath();
          for (let i = 0; i < spokes; i++) { ctx.moveTo(hubX, hubY); ctx.lineTo(spk[i].ex, spk[i].ey); }
          for (let i = 0; i < spokes; i++) {           // bowed outer frame
            const a = spk[i], b = spk[(i + 1) % spokes];
            const mx = (a.ex + b.ex) / 2, my = (a.ey + b.ey) / 2;
            ctx.moveTo(a.ex, a.ey);
            ctx.quadraticCurveTo(mx + (mx - hubX) * 0.1, my + (my - hubY) * 0.1, b.ex, b.ey);
          }
          for (let r = 1; r <= rings; r++) {           // sagging capture spiral
            const f = (r / (rings + 0.5)) * (0.9 + rnd(r + 70) * 0.16);
            for (let i = 0; i < spokes; i++) {
              const A = P(i, f), B = P((i + 1) % spokes, f);
              const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
              ctx.moveTo(A.x, A.y);
              ctx.quadraticCurveTo(mx + (hubX - mx) * sag, my + (hubY - my) * sag, B.x, B.y);
            }
          }
        };

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = color;

        // Support / bridge threads tie the web to the surface it hangs on.
        if (anchors && anchors.length) {
          for (const an of anchors) {
            let best = spk[0], bd = Infinity;
            for (const p of spk) { const d = (p.ex - an.x) ** 2 + (p.ey - an.y) ** 2; if (d < bd) { bd = d; best = p; } }
            ctx.globalAlpha = alpha * 0.3; ctx.lineWidth = 2.1;
            ctx.beginPath(); ctx.moveTo(best.ex, best.ey); ctx.lineTo(an.x, an.y); ctx.stroke();
            ctx.globalAlpha = alpha * 0.8; ctx.lineWidth = 0.9;
            ctx.beginPath(); ctx.moveTo(best.ex, best.ey); ctx.lineTo(an.x, an.y); ctx.stroke();
          }
        }

        // Web: a faint wide sheen pass, then a crisp thin pass.
        ctx.globalAlpha = alpha * 0.26; ctx.lineWidth = 2.1; traceWeb(); ctx.stroke();
        ctx.globalAlpha = alpha * 0.82; ctx.lineWidth = 0.8; traceWeb(); ctx.stroke();

        ctx.globalAlpha = alpha * 0.5;                 // hub
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.ellipse(hubX, hubY, rx * 0.07 + 1.1, ry * 0.07 + 1, 0, 0, Math.PI * 2); ctx.fill();

        for (let d = 0; d < dew; d++) {                // dew droplets
          const pt = P(Math.floor(rnd(d + 200) * spokes), 0.3 + rnd(d + 210) * 0.6);
          ctx.globalAlpha = alpha * 0.55; ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(pt.x, pt.y, 0.9 + rnd(d + 220) * 0.8, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      },

      drawCaveWeb(s, obj = {}) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.20)';
        ctx.beginPath();
        ctx.ellipse(s.x + 2, s.y + 11, 30, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        const cx = s.x, cy = s.y - 14;
        const rx = obj.massive ? 44 : Number(obj.rx || 33);
        // Anchor strands out to the surrounding ground/rock so the web reads as
        // pinned in place rather than floating.
        const anchors = [
          { x: cx - rx * 1.18, y: cy + rx * 0.5 },
          { x: cx + rx * 1.22, y: cy + rx * 0.36 },
          { x: cx - rx * 0.55, y: cy - rx * 0.82 },
          { x: cx + rx * 0.62, y: cy - rx * 0.78 },
          { x: cx + rx * 0.06, y: cy + rx * 0.92 }
        ];
        this.drawAnchoredOrbWeb(cx, cy, {
          rx, ry: rx * 0.66, spokes: 12, rings: 5, tilt: 0.16,
          color: '#e0d2ee', alpha: 0.92, anchors,
          seed: obj._propSeed, dew: obj.massive ? 4 : 2
        });
        // Silk-wrapped egg sac accent, tied onto a capture ring.
        if (obj.egg !== false) {
          const ex = cx + rx * 0.52, ey = cy + rx * 0.14;
          ctx.globalAlpha = 0.5;
          ctx.strokeStyle = '#e0d2ee'; ctx.lineWidth = 0.9;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = obj.color || '#d68cff';
          ctx.beginPath(); ctx.ellipse(ex, ey, 5, 5.6, 0.3, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 0.3; ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(ex - 1.4, ey - 1.6, 1.6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      },

      // V0.17.60 Phase 21: restored missing renderer for the 'silkStrands' Silk
      // Web dungeon dressing (hanging web curtains). Its draw dispatch existed
      // (case 'silkStrands' -> this.drawSilkStrands) but the function was never
      // defined, so entering Silk Web Cavern threw a render fault every frame for
      // each such object (caught by the render-fault guard, so no crash, but
      // constant console spam). Pre-existing bug surfaced while verifying the
      // Phase 21 dungeon herbs; non-blocking dressing, modeled on drawCaveWeb.
      drawSilkStrands(s, obj = {}) {
        const color = obj.color || '#d8c8f2';
        const t = performance.now() * 0.0006 + (obj.phase || (s.x + s.y) * 0.05);
        ctx.save();
        ctx.strokeStyle = 'rgba(224, 214, 240, 0.42)';
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 5; i++) {
          const bx = s.x - 22 + i * 11;
          const sway = Math.sin(t + i * 1.3) * 3;
          const len = 26 + (i % 3) * 8;
          ctx.beginPath();
          ctx.moveTo(bx, s.y - 30);
          ctx.quadraticCurveTo(bx + sway, s.y - 30 + len * 0.5, bx + sway * 1.6, s.y - 30 + len);
          ctx.stroke();
          if (i % 2 === 0) {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = colorShade ? colorShade(color, 10) : color;
            ctx.beginPath();
            ctx.arc(bx + sway, s.y - 30 + len * 0.7, 1.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
        ctx.strokeStyle = 'rgba(224, 214, 240, 0.55)';
        for (let r = 8; r <= 20; r += 6) {
          ctx.beginPath();
          ctx.ellipse(s.x, s.y - 30, r, r * 0.4, 0, Math.PI * 0.05, Math.PI * 0.95);
          ctx.stroke();
        }
        ctx.restore();
      },

      drawCaveHerb(s, obj = {}) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath();
        ctx.ellipse(s.x + 2, s.y + 9, 23, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        const color = obj.color || '#69c59d';
        for (let i = 0; i < 8; i++) {
          const px = s.x - 18 + i * 5;
          const h = 12 + (i % 3) * 5;
          ctx.fillStyle = i % 2 ? color : colorShade(color, -22);
          this.fillPoly([{ x: px, y: s.y + 8 }, { x: px + 3, y: s.y - h }, { x: px + 8, y: s.y + 8 }]);
        }
        ctx.globalAlpha = 0.88;
        for (let i = 0; i < 4; i++) {
          const px = s.x - 10 + i * 7;
          ctx.fillStyle = i % 2 ? '#d8d0bd' : '#c6b79d';
          ctx.fillRect(px - 1.3, s.y - 9 - i, 2.6, 14 + i);
          ctx.fillStyle = i % 2 ? color : colorShade(color, 18);
          ctx.beginPath();
          ctx.ellipse(px, s.y - 11 - i, 7, 3.4, 0, Math.PI, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      },

      drawCaveMushrooms(s, obj = {}) {
        ctx.save();
        const caps = [obj.color || '#b894ff', '#74af74', '#d6e4cf'];
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(s.x + 2, s.y + 10, 26, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 5; i++) {
          const px = s.x - 18 + i * 9;
          const py = s.y + 4 - (i % 2) * 5;
          ctx.fillStyle = '#eadfc4';
          ctx.fillRect((px - 2) | 0, (py - 12) | 0, 5, 15);
          ctx.fillStyle = caps[i % caps.length];
          ctx.beginPath();
          ctx.ellipse(px, py - 13, 8 + (i % 3), 5, 0, Math.PI, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = obj.color || '#b894ff';
        ctx.beginPath();
        ctx.arc(s.x, s.y - 13, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },

      drawMiningVein(s, obj = {}) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.34)';
        ctx.beginPath();
        ctx.ellipse(s.x + 4, s.y + 13, 31, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        const color = obj.color || '#7b8292';
        const pts = [
          { x: s.x - 25, y: s.y + 6 }, { x: s.x - 15, y: s.y - 23 },
          { x: s.x + 7, y: s.y - 30 }, { x: s.x + 29, y: s.y - 8 },
          { x: s.x + 18, y: s.y + 16 }, { x: s.x - 14, y: s.y + 18 }
        ];
        ctx.fillStyle = '#53564f';
        this.fillPoly(pts);
        ctx.fillStyle = color;
        this.fillPoly([{ x: s.x - 12, y: s.y - 17 }, { x: s.x + 5, y: s.y - 25 }, { x: s.x + 15, y: s.y - 7 }, { x: s.x - 3, y: s.y - 2 }]);
        ctx.strokeStyle = colorShade(color, 35);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x - 10, s.y - 11);
        ctx.lineTo(s.x + 16, s.y - 13);
        ctx.stroke();
        ctx.restore();
      },

      drawCrystalNode(s, obj = {}) {
        ctx.save();
        const color = obj.color || '#70d8e6';
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(s.x + 3, s.y + 14, 34, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.35 + Math.sin(performance.now() / 220) * 0.08;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(s.x, s.y - 22, 36, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        for (let i = 0; i < 5; i++) {
          const px = s.x - 22 + i * 11;
          const h = 30 + (i % 3) * 11;
          ctx.fillStyle = i % 2 ? colorShade(color, -28) : color;
          this.fillPoly([{ x: px - 5, y: s.y + 7 }, { x: px, y: s.y - h }, { x: px + 7, y: s.y + 5 }, { x: px + 1, y: s.y + 15 }]);
          ctx.strokeStyle = colorShade(color, 45);
          ctx.stroke();
        }
        ctx.restore();
      },

      drawCavePoolMarker(s, obj = {}) {
        ctx.save();
        const color = obj.color || '#70d8e6';
        ctx.globalAlpha = 0.45 + Math.sin(performance.now() / 180) * 0.08;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.ellipse(s.x, s.y + 6, 14 + i * 10, 5 + i * 4, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#d6f7ff';
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('POOL', s.x, s.y - 8);
        ctx.restore();
      },

      drawHangingRoots(s, obj = {}) {
        ctx.save();
        ctx.strokeStyle = '#4f321f';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
          const x = s.x - 24 + i * 10;
          const len = 30 + (i % 3) * 14;
          ctx.beginPath();
          ctx.moveTo(x, s.y - 70);
          ctx.bezierCurveTo(x - 8, s.y - 40, x + 12, s.y - 25, x - 3, s.y - 70 + len);
          ctx.stroke();
        }
        ctx.restore();
      },

      drawBones(s, obj = {}) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(s.x + 2, s.y + 11, 30, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#d0b58b';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(s.x - 22 + i * 16, s.y + 5 - i * 3);
          ctx.lineTo(s.x - 6 + i * 16, s.y - 3 + i * 2);
          ctx.stroke();
        }
        ctx.fillStyle = '#d8c6a3';
        ctx.beginPath();
        ctx.arc(s.x + 22, s.y - 4, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },

      drawMineSupport(s, obj = {}) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.34)';
        ctx.beginPath();
        ctx.ellipse(s.x + 3, s.y + 15, 44, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#5a3922';
        ctx.lineWidth = 8;
        ctx.lineCap = 'square';
        ctx.beginPath();
        ctx.moveTo(s.x - 34, s.y + 12); ctx.lineTo(s.x - 34, s.y - 62);
        ctx.moveTo(s.x + 34, s.y + 12); ctx.lineTo(s.x + 34, s.y - 62);
        ctx.moveTo(s.x - 42, s.y - 60); ctx.lineTo(s.x + 42, s.y - 60);
        ctx.stroke();
        ctx.strokeStyle = '#2d1e12';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x - 34, s.y - 20); ctx.lineTo(s.x + 34, s.y - 48);
        ctx.stroke();
        ctx.restore();
      },

      drawBrokenCart(s, obj = {}) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.30)';
        ctx.beginPath();
        ctx.ellipse(s.x + 2, s.y + 16, 39, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6b4529';
        this.fillPoly([{x:s.x-31,y:s.y-8},{x:s.x+5,y:s.y-18},{x:s.x+32,y:s.y-5},{x:s.x-4,y:s.y+8}]);
        ctx.strokeStyle = '#2b1c12';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(s.x - 18, s.y + 11, 9, 0, Math.PI * 2);
        ctx.arc(s.x + 19, s.y + 4, 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      },

      // V0.18.58: an actual torch - a wooden handle, a pitch-soaked wrapped head, and a layered
      // flickering flame with a warm glow (was a stick topped by a solid triangle that read as an arrow).
      drawTorch(s, obj = {}) {
        // V0.18.64: register this torch as a light source. renderSilkCavernAtmosphere projects a
        // real warm glow from here THROUGH the cave darkness (the small on-torch glow below is
        // painted before the darkness overlay, so on its own it gets covered and emits nothing).
        // s is unzoomed screen space; the flame sits ~22px above the base at this prop's scale.
        if (Array.isArray(this._silkFrameLights)) {
          this._silkFrameLights.push({ ux: s.x, uy: s.y - 22, color: obj.color || '#ffcf8a', strength: 1 });
        }
        ctx.save();
        this.drawPropContactShadow?.(s, 7, 3, 0.22);
        // V0.18.60: ~40% smaller, and a smoother/gentler flame (lower-amplitude multi-sine flicker).
        ctx.translate(s.x, s.y); ctx.scale(0.62, 0.62);
        const cx = 0, groundY = 12, headY = -30;
        const tm = performance.now() * 0.0042;
        const flick = Math.sin(tm) * 0.34 + Math.sin(tm * 1.7 + 1.1) * 0.22 + Math.sin(tm * 0.55 + 2.3) * 0.16;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // 1) wooden handle
        ctx.strokeStyle = '#6b4a2c'; ctx.lineWidth = 5.5;
        ctx.beginPath(); ctx.moveTo(cx - 2, groundY); ctx.lineTo(cx, headY + 4); ctx.stroke();
        ctx.strokeStyle = '#4a3220'; ctx.lineWidth = 1.6; // grain shadow
        ctx.beginPath(); ctx.moveTo(cx - 3, groundY); ctx.lineTo(cx - 1, headY + 4); ctx.stroke();
        // 2) wrapped, pitch-soaked head + binding bands
        ctx.fillStyle = '#3a2a1e';
        ctx.beginPath(); ctx.ellipse(cx, headY, 6, 8.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#241811'; ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) { const yy = headY - 4 + i * 4; ctx.beginPath(); ctx.moveTo(cx - 5, yy); ctx.lineTo(cx + 5, yy); ctx.stroke(); }
        ctx.fillStyle = '#7a2f16'; ctx.beginPath(); ctx.ellipse(cx, headY - 6, 4.6, 3, 0, 0, Math.PI * 2); ctx.fill(); // embers
        // 3) warm glow
        const glowR = 34 + flick * 4;
        const glow = ctx.createRadialGradient(cx, headY - 16, 4, cx, headY - 16, glowR);
        glow.addColorStop(0, 'rgba(255,196,96,0.45)'); glow.addColorStop(0.5, 'rgba(255,140,50,0.17)'); glow.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, headY - 16, glowR, 0, Math.PI * 2); ctx.fill();
        // 4) the flame - layered teardrops that sway + flicker
        const sway = flick * 1.5;
        const flame = (h, w, col) => {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(cx, headY - 3);
          ctx.bezierCurveTo(cx - w, headY - 7, cx - w * 0.85, headY - h * 0.6, cx - w * 0.2 + sway, headY - h);
          ctx.bezierCurveTo(cx + w * 0.35 + sway, headY - h * 0.92, cx + w * 0.85, headY - h * 0.5, cx + w, headY - 7);
          ctx.quadraticCurveTo(cx, headY + 1, cx, headY - 3);
          ctx.closePath(); ctx.fill();
        };
        flame(40 + flick * 3.5, 9.5, '#ff5f18');   // outer orange
        flame(31 + flick * 2.8, 6.2, '#ffb43c');   // mid amber
        flame(22 + flick * 2.1, 3.3, '#ffe9a8');   // inner bright
        // 5) rising sparks (slow, smooth)
        ctx.fillStyle = 'rgba(255,205,130,0.8)';
        for (let i = 0; i < 3; i++) { const sy = headY - 26 - ((tm * 18 + i * 15) % 26); ctx.beginPath(); ctx.arc(cx + Math.sin(tm * 1.6 + i * 2) * 4, sy, 0.9, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      },

      drawDungeonGate(s, obj = {}) {
        ctx.save();
        const color = obj.color || '#a987ff';
        ctx.fillStyle = 'rgba(0,0,0,0.44)';
        ctx.beginPath();
        ctx.ellipse(s.x + 2, s.y + 18, 48, 13, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#241f22';
        this.fillPoly([{x:s.x-42,y:s.y+15},{x:s.x-36,y:s.y-64},{x:s.x+38,y:s.y-64},{x:s.x+44,y:s.y+15}]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect((s.x - 35) | 0, (s.y - 58) | 0, 70, 72);
        ctx.globalAlpha = 0.30 + Math.sin(performance.now() / 230) * 0.08;
        ctx.fillStyle = color;
        ctx.fillRect((s.x - 28) | 0, (s.y - 51) | 0, 56, 58);
        ctx.globalAlpha = 1;
        if (!DR.SUPPRESS_WORLD_FLOATING_TEXT) {
          ctx.fillStyle = '#f8ecd0';
          ctx.font = '10px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.fillText('DUNGEON', s.x, s.y + 31);
        }
        ctx.restore();
      },

      drawCaveEntrance(s, obj) {
        const name = typeof obj === 'string' ? obj : (obj?.name || 'Cave');
        const scale = typeof obj === 'object' ? (obj.scale || 3.85) : 3.85;
        const variant = typeof obj === 'object' ? String(obj.variant || 'moss') : 'moss';
        const glow = typeof obj === 'object' ? (obj.glow || '#8df0bc') : '#8df0bc';
        const sx = s.x;
        const sy = s.y;
        const P = pts => pts.map(p => ({ x: sx + p.x * scale, y: sy + p.y * scale }));
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.46)';
        ctx.beginPath();
        ctx.ellipse(sx + 2 * scale, sy + 20 * scale, 62 * scale, 16 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        // V0.18.39: seat the Silk Web Cavern mouth in a real earthen HILL/mound (grass +
        // dirt banks) so it reads as a cave dug into a hillside, not a floating rock arch.
        if (variant === 'web') {
          ctx.fillStyle = '#33412a'; // dark mossy earth mound (widest, behind the rock)
          this.fillPoly(P([{x:-108,y:26},{x:-92,y:-6},{x:-60,y:-42},{x:-18,y:-66},{x:32,y:-68},{x:78,y:-46},{x:108,y:-6},{x:120,y:28}]));
          ctx.fillStyle = '#415227'; // grassy crown highlight
          this.fillPoly(P([{x:-94,y:12},{x:-62,y:-32},{x:-14,y:-56},{x:30,y:-57},{x:70,y:-36},{x:96,y:8},{x:44,y:-4},{x:-32,y:-6}]));
          ctx.fillStyle = '#584631'; // exposed dirt bank at the base
          this.fillPoly(P([{x:-102,y:24},{x:-72,y:9},{x:-20,y:17},{x:42,y:15},{x:100,y:11},{x:114,y:26},{x:-108,y:28}]));
          // grass tufts fringing the crown
          ctx.strokeStyle = 'rgba(126,158,86,0.75)'; ctx.lineWidth = Math.max(1, 0.9 * scale);
          for (let i = 0; i < 18; i++) {
            const gx = (-96 + i * 11) * scale;
            const gy = (-28 - Math.abs(Math.sin(i * 1.7)) * 8) * scale;
            ctx.beginPath(); ctx.moveTo(sx + gx, sy + gy); ctx.lineTo(sx + gx - 2 * scale, sy + gy - 6 * scale);
            ctx.moveTo(sx + gx, sy + gy); ctx.lineTo(sx + gx + 2 * scale, sy + gy - 6 * scale); ctx.stroke();
          }
        }

        // Outer mountain mass: wide, heavy, and readable from gameplay zoom.
        ctx.fillStyle = '#453a31';
        this.fillPoly(P([{x:-76,y:18},{x:-63,y:-22},{x:-41,y:-59},{x:-10,y:-82},{x:31,y:-80},{x:62,y:-52},{x:82,y:-13},{x:88,y:20}]));
        ctx.fillStyle = '#5f5244';
        this.fillPoly(P([{x:-67,y:11},{x:-53,y:-26},{x:-24,y:-58},{x:2,y:-70},{x:22,y:-40},{x:4,y:15}]));
        ctx.fillStyle = '#6f6250';
        this.fillPoly(P([{x:13,y:-67},{x:39,y:-70},{x:66,y:-43},{x:78,y:8},{x:42,y:17},{x:29,y:-34}]));
        ctx.fillStyle = '#362b24';
        this.fillPoly(P([{x:-83,y:19},{x:-69,y:3},{x:-74,y:35},{x:-58,y:36},{x:-48,y:18}]));
        this.fillPoly(P([{x:63,y:14},{x:86,y:2},{x:95,y:31},{x:78,y:39},{x:53,y:24}]));

        // Deep mouth and inner darkness.
        ctx.fillStyle = '#221b16';
        this.fillPoly(P([{x:-42,y:18},{x:-32,y:-23},{x:-6,y:-51},{x:28,y:-54},{x:55,y:-21},{x:65,y:19}]));
        ctx.fillStyle = '#080605';
        this.fillPoly(P([{x:-25,y:17},{x:-15,y:-17},{x:8,y:-36},{x:35,y:-22},{x:48,y:17}]));
        ctx.fillStyle = '#020202';
        this.fillPoly(P([{x:-11,y:16},{x:-4,y:-6},{x:13,y:-19},{x:32,y:-9},{x:39,y:16}]));

        // Entrance glow and readable floor threshold.
        ctx.globalAlpha = 0.30;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sx + 20 * scale, sy - 10 * scale, 22 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#2d241d';
        this.fillPoly(P([{x:-44,y:17},{x:65,y:17},{x:77,y:28},{x:-56,y:30}]));
        ctx.strokeStyle = 'rgba(224, 210, 168, 0.55)';
        ctx.lineWidth = Math.max(1, 1.4 * scale);
        ctx.beginPath();
        ctx.moveTo(sx - 43 * scale, sy + 20 * scale);
        ctx.lineTo(sx + 65 * scale, sy + 20 * scale);
        ctx.stroke();

        // Big cave stone cuts.
        ctx.strokeStyle = 'rgba(20, 16, 13, 0.48)';
        ctx.lineWidth = Math.max(1, 1.2 * scale);
        for (let i = 0; i < 7; i++) {
          const ox = (-52 + i * 19) * scale;
          ctx.beginPath();
          ctx.moveTo(sx + ox, sy + (-10 - (i % 3) * 12) * scale);
          ctx.lineTo(sx + ox + (8 + (i % 2) * 7) * scale, sy + (-27 - (i % 2) * 13) * scale);
          ctx.stroke();
        }

        if (variant === 'web') {
          // V0.18.39: the mouth is choked with webbing - a giant orb web filling the
          // opening, heavy drape curtains, hanging egg sacs and corner webs - so the
          // entrance clearly reads as an infested spider lair, not a generic cave.
          const webCol = 'rgba(230, 214, 250, ';
          // darken the generic purple glow into a webbed hollow (leaves a sickly halo behind)
          ctx.globalAlpha = 0.55; ctx.fillStyle = '#0a0710';
          this.fillPoly(P([{x:-25,y:17},{x:-15,y:-17},{x:8,y:-36},{x:35,y:-22},{x:48,y:17}]));
          ctx.globalAlpha = 1;
          const wcx = sx + 12 * scale, wcy = sy - 12 * scale;
          // giant orb web: radial spokes + concentric rings filling the mouth
          ctx.strokeStyle = webCol + '0.5)'; ctx.lineWidth = Math.max(1, 0.9 * scale);
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            ctx.beginPath(); ctx.moveTo(wcx, wcy); ctx.lineTo(wcx + Math.cos(a) * 46 * scale, wcy + Math.sin(a) * 34 * scale); ctx.stroke();
          }
          ctx.globalAlpha = 0.42;
          for (let r = 1; r <= 5; r++) { ctx.beginPath(); ctx.ellipse(wcx, wcy, r * 9 * scale, r * 6.6 * scale, 0, 0, Math.PI * 2); ctx.stroke(); }
          ctx.globalAlpha = 1;
          // heavy drape curtains hanging from the top of the mouth
          ctx.strokeStyle = webCol + '0.6)'; ctx.lineWidth = Math.max(1, 1.0 * scale);
          for (let i = 0; i < 10; i++) {
            const bx = (-46 + i * 11) * scale;
            const drop = (30 + ((i * 7) % 20)) * scale;
            ctx.beginPath(); ctx.moveTo(sx + bx, sy - 44 * scale); ctx.quadraticCurveTo(sx + bx + 3 * scale, sy - 44 * scale + drop * 0.5, sx + bx - 2 * scale, sy - 44 * scale + drop); ctx.stroke();
          }
          // hanging egg sacs / cocoons on silk lines
          for (const cpos of [{x:-30,y:-18,r:7},{x:38,y:-12,r:6},{x:6,y:-30,r:5}]) {
            const ccx = sx + cpos.x * scale, ccy = sy + cpos.y * scale, cr = cpos.r * scale;
            ctx.strokeStyle = webCol + '0.5)'; ctx.lineWidth = Math.max(1, 0.8 * scale);
            ctx.beginPath(); ctx.moveTo(ccx, sy - 44 * scale); ctx.lineTo(ccx, ccy - cr); ctx.stroke();
            ctx.fillStyle = 'rgba(224,214,240,0.85)'; ctx.beginPath(); ctx.ellipse(ccx, ccy, cr * 0.8, cr, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(150,140,168,0.5)'; ctx.beginPath(); ctx.ellipse(ccx, ccy, cr * 0.8, cr, 0, 0, Math.PI * 2); ctx.stroke();
          }
          // corner webs tucked into the top corners of the mouth
          ctx.strokeStyle = webCol + '0.45)'; ctx.lineWidth = Math.max(1, 0.8 * scale);
          for (const corner of [{x:-42,y:-30,dir:1},{x:52,y:-24,dir:-1}]) {
            for (let i = 1; i <= 4; i++) {
              ctx.beginPath();
              ctx.moveTo(sx + corner.x * scale, sy + (corner.y + i * 6) * scale);
              ctx.lineTo(sx + (corner.x + corner.dir * i * 7) * scale, sy + corner.y * scale); ctx.stroke();
            }
          }
        } else if (variant === 'crystal') {
          ctx.fillStyle = '#8eeaff';
          for (const c of [{x:-62,y:25},{x:70,y:21},{x:53,y:-23}]) this.fillPoly(P([{x:c.x,y:c.y},{x:c.x+5,y:c.y-17},{x:c.x+11,y:c.y},{x:c.x+4,y:c.y+9}]));
        } else if (variant === 'mine') {
          ctx.strokeStyle = '#5a3922';
          ctx.lineWidth = Math.max(2, 3 * scale);
          ctx.beginPath();
          ctx.moveTo(sx - 50 * scale, sy + 16 * scale); ctx.lineTo(sx - 46 * scale, sy - 38 * scale);
          ctx.moveTo(sx + 58 * scale, sy + 16 * scale); ctx.lineTo(sx + 52 * scale, sy - 38 * scale);
          ctx.moveTo(sx - 53 * scale, sy - 35 * scale); ctx.lineTo(sx + 57 * scale, sy - 35 * scale);
          ctx.stroke();
        } else if (variant === 'catacomb') {
          ctx.fillStyle = '#d8ded1';
          ctx.beginPath(); ctx.arc(sx - 56 * scale, sy + 25 * scale, 5 * scale, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(sx + 66 * scale, sy + 23 * scale, 5 * scale, 0, Math.PI * 2); ctx.fill();
        } else if (variant === 'root') {
          ctx.strokeStyle = 'rgba(53, 33, 24, 0.82)';
          ctx.lineWidth = Math.max(1.5, 2.2 * scale);
          ctx.beginPath();
          ctx.moveTo(sx - 46 * scale, sy - 52 * scale); ctx.bezierCurveTo(sx - 20 * scale, sy - 36 * scale, sx - 18 * scale, sy + 0 * scale, sx - 4 * scale, sy + 23 * scale);
          ctx.moveTo(sx + 48 * scale, sy - 48 * scale); ctx.bezierCurveTo(sx + 20 * scale, sy - 35 * scale, sx + 18 * scale, sy - 1 * scale, sx + 2 * scale, sy + 23 * scale);
          ctx.stroke();
        }

        if (!DR.SUPPRESS_WORLD_FLOATING_TEXT) {
          ctx.fillStyle = '#d6e4cf';
          ctx.font = `${Math.max(10, Math.floor(10 * scale * 0.85))}px ui-monospace, monospace`;
          ctx.textAlign = 'center';
          ctx.fillText('ENTER', sx + 5 * scale, sy + 37 * scale);
          ctx.font = `${Math.max(9, Math.floor(8 * scale * 0.72))}px ui-monospace, monospace`;
          ctx.fillText(name, sx + 4 * scale, sy + 49 * scale);
          ctx.textAlign = 'left';
        }
        ctx.restore();
      },


      drawVendorStall(obj, foot, tile, scale = 3.35) {
        const x = foot.x, y = foot.y;
        const s = scale;
        ctx.save();
        ctx.globalAlpha = 1;
        // Ground footprint/shadow
        ctx.fillStyle = 'rgba(0,0,0,0.34)';
        ctx.beginPath();
        ctx.ellipse(x + 10, y + 12, 34 * s, 13 * s, 0, 0, Math.PI * 2);
        ctx.fill();

        // Counter/base
        ctx.fillStyle = '#4b2f1b';
        this.fillPoly([
          { x: x - 24 * s, y: y - 3 * s },
          { x: x + 26 * s, y: y - 10 * s },
          { x: x + 34 * s, y: y + 6 * s },
          { x: x - 18 * s, y: y + 16 * s }
        ]);
        ctx.fillStyle = '#87582c';
        this.fillPoly([
          { x: x - 18 * s, y: y - 9 * s },
          { x: x + 24 * s, y: y - 16 * s },
          { x: x + 26 * s, y: y - 7 * s },
          { x: x - 19 * s, y: y + 1 * s }
        ]);

        // Cloth awning
        ctx.fillStyle = '#6d1f1d';
        this.fillPoly([
          { x: x - 32 * s, y: y - 38 * s },
          { x: x + 25 * s, y: y - 47 * s },
          { x: x + 38 * s, y: y - 27 * s },
          { x: x - 20 * s, y: y - 16 * s }
        ]);
        ctx.fillStyle = '#c8a35e';
        this.fillPoly([
          { x: x - 20 * s, y: y - 36 * s },
          { x: x - 6 * s, y: y - 38 * s },
          { x: x + 0 * s, y: y - 20 * s },
          { x: x - 14 * s, y: y - 18 * s }
        ]);
        ctx.fillStyle = '#e3c47a';
        this.fillPoly([
          { x: x + 10 * s, y: y - 41 * s },
          { x: x + 24 * s, y: y - 43 * s },
          { x: x + 31 * s, y: y - 27 * s },
          { x: x + 17 * s, y: y - 24 * s }
        ]);

        // Poles
        ctx.strokeStyle = '#2f1e13';
        ctx.lineWidth = Math.max(2, 2.2 * s);
        ctx.beginPath();
        ctx.moveTo(x - 24 * s, y - 33 * s); ctx.lineTo(x - 18 * s, y + 12 * s);
        ctx.moveTo(x + 30 * s, y - 37 * s); ctx.lineTo(x + 28 * s, y + 7 * s);
        ctx.stroke();

        // Goods on counter
        ctx.fillStyle = '#83b15a';
        ctx.beginPath(); ctx.ellipse(x - 6 * s, y - 12 * s, 5 * s, 3 * s, -0.25, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d7bc7a';
        ctx.fillRect(x + 5 * s, y - 16 * s, 8 * s, 5 * s);
        ctx.fillStyle = '#74a7c4';
        ctx.beginPath(); ctx.arc(x + 18 * s, y - 16 * s, 3.5 * s, 0, Math.PI * 2); ctx.fill();

        // Label sign. Text is suppressed by default in V0.14.17 so world props no
        // longer float signage over the art; the sign board remains as a prop detail.
        ctx.fillStyle = 'rgba(18,12,7,0.86)';
        ctx.fillRect(x - 22 * s, y - 56 * s, 46 * s, 10 * s);
        if (!DR.SUPPRESS_WORLD_FLOATING_TEXT) {
          ctx.fillStyle = '#f6e1a0';
          ctx.font = `${Math.max(9, 4.5 * s)}px Georgia, serif`;
          ctx.textAlign = 'center';
          ctx.fillText('VENDOR', x + 1 * s, y - 48 * s);
        }
        ctx.restore();
      },

      drawLargeCampTent(obj, foot, tile, scale = 3.2) {
        const x = foot.x, y = foot.y;
        const s = scale;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.36)';
        ctx.beginPath();
        ctx.ellipse(x + 7, y + 13, 31 * s, 13 * s, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#3a2419';
        this.fillPoly([
          { x: x - 33 * s, y: y + 8 * s },
          { x: x + 23 * s, y: y - 3 * s },
          { x: x + 38 * s, y: y + 10 * s },
          { x: x - 18 * s, y: y + 24 * s }
        ]);

        const canvas = ctx.createLinearGradient(x - 30 * s, y - 43 * s, x + 37 * s, y + 13 * s);
        canvas.addColorStop(0, '#8b4f2a');
        canvas.addColorStop(0.45, '#b27236');
        canvas.addColorStop(1, '#4c2819');
        ctx.fillStyle = canvas;
        this.fillPoly([
          { x: x - 35 * s, y: y + 7 * s },
          { x: x - 7 * s, y: y - 45 * s },
          { x: x + 42 * s, y: y + 5 * s },
          { x: x + 12 * s, y: y + 20 * s }
        ]);

        // Door flap
        ctx.fillStyle = '#21140f';
        this.fillPoly([
          { x: x - 5 * s, y: y - 26 * s },
          { x: x + 13 * s, y: y - 5 * s },
          { x: x + 3 * s, y: y + 16 * s },
          { x: x - 13 * s, y: y + 4 * s }
        ]);
        ctx.fillStyle = 'rgba(235,190,108,0.26)';
        this.fillPoly([
          { x: x - 3 * s, y: y - 24 * s },
          { x: x + 9 * s, y: y - 5 * s },
          { x: x + 0 * s, y: y + 9 * s },
          { x: x - 8 * s, y: y + 2 * s }
        ]);

        // seams/ropes
        ctx.strokeStyle = '#2a1910';
        ctx.lineWidth = Math.max(1.5, 1.2 * s);
        ctx.beginPath();
        ctx.moveTo(x - 7 * s, y - 44 * s); ctx.lineTo(x - 35 * s, y + 7 * s);
        ctx.moveTo(x - 7 * s, y - 44 * s); ctx.lineTo(x + 42 * s, y + 5 * s);
        ctx.moveTo(x - 7 * s, y - 44 * s); ctx.lineTo(x + 6 * s, y + 18 * s);
        ctx.stroke();

        ctx.restore();
      },


      drawCaveExit(s, obj = {}) {
        const scale = obj.scale || 1.85;
        const sx = s.x;
        // The cave exit is not a cave-mouth prop. The interaction tile is the
        // doorway threshold; the visual is a bright opening cut directly into
        // the north wall face above that threshold.
        const wallY = s.y - 30 * scale;
        const thresholdY = s.y + 9 * scale;
        const t = performance.now() * 0.003;
        ctx.save();

        // Exterior brightness visible through the wall opening.
        const exterior = ctx.createRadialGradient(sx, wallY - 8 * scale, 2 * scale, sx, wallY + 8 * scale, 70 * scale);
        exterior.addColorStop(0, 'rgba(255, 255, 238, 1.00)');
        exterior.addColorStop(0.28, 'rgba(255, 244, 174, 0.86)');
        exterior.addColorStop(0.62, 'rgba(211, 232, 159, 0.42)');
        exterior.addColorStop(1, 'rgba(211, 232, 159, 0.00)');
        ctx.fillStyle = exterior;
        ctx.beginPath();
        ctx.ellipse(sx, wallY + 1 * scale, 72 * scale, 58 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        // Large doorway-shaped light cut. No surrounding cave mouth, arch prop,
        // rock decoration, or freestanding geometry is drawn here.
        const door = ctx.createLinearGradient(sx, wallY - 50 * scale, sx, wallY + 31 * scale);
        door.addColorStop(0, '#ffffff');
        door.addColorStop(0.30, '#fff7c8');
        door.addColorStop(0.68, '#e2efb0');
        door.addColorStop(1, '#9fcb88');
        ctx.fillStyle = door;
        ctx.beginPath();
        ctx.moveTo(sx - 31 * scale, wallY + 31 * scale);
        ctx.lineTo(sx - 31 * scale, wallY - 15 * scale);
        ctx.quadraticCurveTo(sx - 28 * scale, wallY - 40 * scale, sx, wallY - 48 * scale);
        ctx.quadraticCurveTo(sx + 28 * scale, wallY - 40 * scale, sx + 31 * scale, wallY - 15 * scale);
        ctx.lineTo(sx + 31 * scale, wallY + 31 * scale);
        ctx.closePath();
        ctx.fill();

        // Thin dark wall seam only. This is the edge of the cut wall, not a cave mouth.
        ctx.strokeStyle = 'rgba(20, 18, 15, 0.72)';
        ctx.lineWidth = Math.max(1.2, 1.05 * scale);
        ctx.beginPath();
        ctx.moveTo(sx - 32 * scale, wallY + 32 * scale);
        ctx.lineTo(sx - 32 * scale, wallY - 15 * scale);
        ctx.quadraticCurveTo(sx - 29 * scale, wallY - 42 * scale, sx, wallY - 50 * scale);
        ctx.quadraticCurveTo(sx + 29 * scale, wallY - 42 * scale, sx + 32 * scale, wallY - 15 * scale);
        ctx.lineTo(sx + 32 * scale, wallY + 32 * scale);
        ctx.stroke();

        // Doorway threshold is on the same tile that triggers the warp.
        ctx.fillStyle = 'rgba(255, 232, 141, 0.34)';
        ctx.beginPath();
        ctx.ellipse(sx, thresholdY + 2 * scale, 47 * scale, 11 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 241, 179, 0.88)';
        ctx.lineWidth = Math.max(1, 0.7 * scale);
        ctx.beginPath();
        ctx.moveTo(sx - 36 * scale, thresholdY - 3 * scale);
        ctx.lineTo(sx + 36 * scale, thresholdY - 3 * scale);
        ctx.stroke();

        // Light cast into the cave interior.
        const spill = ctx.createLinearGradient(sx, wallY + 24 * scale, sx, s.y + 92 * scale);
        spill.addColorStop(0, 'rgba(255, 246, 183, 0.66)');
        spill.addColorStop(0.48, 'rgba(236, 198, 91, 0.26)');
        spill.addColorStop(1, 'rgba(236, 198, 91, 0.00)');
        ctx.fillStyle = spill;
        this.fillPoly([
          { x: sx - 24 * scale, y: wallY + 26 * scale },
          { x: sx + 24 * scale, y: wallY + 26 * scale },
          { x: sx + 72 * scale, y: s.y + 92 * scale },
          { x: sx - 72 * scale, y: s.y + 92 * scale }
        ]);

        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = 'rgba(255, 255, 222, 0.46)';
        ctx.lineWidth = Math.max(1, 0.45 * scale);
        for (let i = 0; i < 7; i++) {
          const drift = Math.sin(t + i * 1.4) * 4 * scale;
          ctx.beginPath();
          ctx.moveTo(sx + (-16 + i * 5.4) * scale, wallY - 9 * scale);
          ctx.lineTo(sx + (-55 + i * 18) * scale + drift, s.y + (30 + i * 7) * scale);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';

        if (!DR.SUPPRESS_WORLD_FLOATING_TEXT) {
          ctx.fillStyle = '#fff2bb';
          ctx.font = `${Math.max(10, Math.floor(8.5 * scale))}px ui-monospace, monospace`;
          ctx.textAlign = 'center';
          ctx.fillText('EXIT', sx, thresholdY + 21 * scale);
          ctx.textAlign = 'left';
        }
        ctx.restore();
      },

      drawDungeonExit(s, obj = {}) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        ctx.beginPath();
        ctx.ellipse(s.x + 2, s.y + 14, 38, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        const t = performance.now() * 0.004;
        ctx.strokeStyle = '#8df0bc';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.86;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y - 20, 22 + Math.sin(t) * 2, 35 + Math.cos(t * 0.8) * 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.26;
        ctx.fillStyle = '#8df0bc';
        ctx.beginPath();
        ctx.ellipse(s.x, s.y - 20, 16, 28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        if (!DR.SUPPRESS_WORLD_FLOATING_TEXT) {
          ctx.fillStyle = '#f4dfae';
          ctx.font = '10px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.fillText('EXIT', s.x, s.y + 30);
        }
        ctx.restore();
      },

      drawDungeonStairs(s, obj = {}) {
        // V0.18.61: natural rough-hewn STONE cave stairs descending into the dark for the Silk
        // Web Cavern (other dungeons keep the old stylised steps).
        if (obj.dungeonId === 'silk_web_cavern') { this.drawNaturalCaveStairs(s, obj); return; }
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.34)';
        ctx.beginPath();
        ctx.ellipse(s.x + 3, s.y + 12, 42, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = i % 2 ? '#514435' : '#6c5c45';
          this.fillPoly([
            { x: s.x - 34 + i * 8, y: s.y + 14 - i * 7 },
            { x: s.x + 18 + i * 8, y: s.y + 2 - i * 7 },
            { x: s.x + 30 + i * 8, y: s.y + 9 - i * 7 },
            { x: s.x - 22 + i * 8, y: s.y + 22 - i * 7 }
          ]);
        }
        ctx.strokeStyle = 'rgba(169,135,255,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x - 31, s.y + 18);
        ctx.lineTo(s.x + 62, s.y - 12);
        ctx.stroke();
        ctx.fillStyle = '#f4dfae';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('DOWN', s.x + 14, s.y + 34);
        ctx.restore();
      },

      // V0.18.61: rough natural stone steps descending into a dark cave mouth (ref: cave stairs).
      // V0.20.3: renamed from drawCaveStairs. It collided with the EXISTING labelled
      // drawCaveStairs(s, obj, label) above, and being defined later it silently won - so the generic
      // caveStairsDown/caveStairsUp objects (drawObjectShape cases) started rendering these silk-web
      // steps and LOST their 'DOWN'/'UP' labels, which is the exact opposite of what V0.18.61's own
      // note promised ("other dungeons keep the old stylised steps"). Named for what it draws, so the
      // Silk Web Cavern keeps its cave mouth and every other staircase gets its label back.
      drawNaturalCaveStairs(s, obj = {}) {
        ctx.save();
        let st = ((obj._propSeed || (Math.floor(obj.x || 0) * 7 + Math.floor(obj.y || 0) * 13 + 31)) >>> 0) || 1;
        const rnd = () => { st = (st * 1664525 + 1013904223) >>> 0; return st / 4294967296; };
        const cx = s.x, cy = s.y;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        // ground shadow
        ctx.fillStyle = 'rgba(0,0,0,0.34)'; ctx.beginPath(); ctx.ellipse(cx, cy + 14, 48, 15, 0, 0, Math.PI * 2); ctx.fill();
        // dark descent mouth behind the steps
        const hole = ctx.createRadialGradient(cx, cy - 30, 4, cx, cy - 24, 46);
        hole.addColorStop(0, 'rgba(5,4,9,0.96)'); hole.addColorStop(0.72, 'rgba(10,8,16,0.62)'); hole.addColorStop(1, 'rgba(10,8,16,0)');
        ctx.fillStyle = hole; ctx.beginPath(); ctx.ellipse(cx, cy - 26, 42, 26, 0, 0, Math.PI * 2); ctx.fill();
        // rough stone steps descending toward the viewer (back = dark/into hole, front = lit)
        const steps = 6;
        for (let i = steps - 1; i >= 0; i--) {
          const t = i / (steps - 1);              // 0 back(top) .. 1 front(bottom)
          const yy = cy - 20 + t * 40;
          const w = 18 + t * 28;
          const lit = 0.32 + t * 0.5;
          const j = () => (rnd() - 0.5) * 5;
          const base = Math.round(60 + lit * 78);
          // step tread (lit stone, irregular)
          ctx.fillStyle = `rgb(${base + 16},${base + 6},${base - 10})`;
          this.fillPoly([
            { x: cx - w + j(), y: yy - 5 + j() }, { x: cx - w * 0.4 + j(), y: yy - 7 + j() },
            { x: cx + w * 0.4 + j(), y: yy - 6 + j() }, { x: cx + w + j(), y: yy - 4 + j() },
            { x: cx + w * 0.85, y: yy + 3 }, { x: cx - w * 0.85, y: yy + 3 }
          ]);
          // step riser (shadowed front face)
          ctx.fillStyle = `rgb(${Math.round(base * 0.46)},${Math.round(base * 0.42)},${Math.round(base * 0.4)})`;
          this.fillPoly([
            { x: cx - w * 0.85, y: yy + 3 }, { x: cx + w * 0.85, y: yy + 3 },
            { x: cx + w * 0.78, y: yy + 10 + j() }, { x: cx - w * 0.78, y: yy + 10 + j() }
          ]);
          // a couple of cracks / pebbles on the tread
          ctx.strokeStyle = 'rgba(28,22,16,0.4)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(cx - w * 0.4, yy - 2); ctx.lineTo(cx + w * 0.2 + j(), yy - 1); ctx.stroke();
        }
        // rough rock shoulders flanking the entrance
        for (const side of [-1, 1]) {
          ctx.fillStyle = 'rgb(78,70,58)';
          this.fillPoly([
            { x: cx + side * 40, y: cy - 20 }, { x: cx + side * 56, y: cy - 8 },
            { x: cx + side * 50, y: cy + 12 }, { x: cx + side * 34, y: cy + 6 }
          ]);
          ctx.fillStyle = 'rgba(20,16,12,0.3)';
          this.fillPoly([{ x: cx + side * 40, y: cy - 20 }, { x: cx + side * 34, y: cy + 6 }, { x: cx + side * 30, y: cy - 2 }]);
        }
        // cobwebs draping the sides of the mouth
        ctx.strokeStyle = 'rgba(216,206,240,0.42)'; ctx.lineWidth = 0.8;
        for (const side of [-1, 1]) for (let i = 0; i < 3; i++) { const x0 = cx + side * (30 + i * 5); ctx.beginPath(); ctx.moveTo(x0, cy - 24); ctx.quadraticCurveTo(x0 + side * 7, cy - 4, x0 + side * 3, cy + 12); ctx.stroke(); }
        ctx.restore();
      },

      drawDungeonTreasure(s, obj = {}) {
        ctx.save();
        if (obj.opened) {
          ctx.fillStyle = 'rgba(0,0,0,0.30)';
          ctx.beginPath();
          ctx.ellipse(s.x + 3, s.y + 17, 34, 10, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#5a351e';
          this.fillPoly([{x:s.x-28,y:s.y+13},{x:s.x+5,y:s.y+0},{x:s.x+34,y:s.y+11},{x:s.x+0,y:s.y+26}]);
          ctx.strokeStyle = '#75d069';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(s.x - 24, s.y + 9);
          ctx.lineTo(s.x + 30, s.y - 8);
          ctx.stroke();
          ctx.font = '10px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#d5ecc8';
          ctx.fillText('CLAIMED', s.x + 2, s.y + 44);
          ctx.restore();
          return;
        }
        ctx.fillStyle = 'rgba(0,0,0,0.36)';
        ctx.beginPath();
        ctx.ellipse(s.x + 3, s.y + 17, 36, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6e4325';
        this.fillPoly([{x:s.x-28,y:s.y+4},{x:s.x+8,y:s.y-8},{x:s.x+34,y:s.y+5},{x:s.x-3,y:s.y+19}]);
        ctx.fillStyle = '#8c572d';
        this.fillPoly([{x:s.x-28,y:s.y+4},{x:s.x-3,y:s.y+19},{x:s.x-3,y:s.y+36},{x:s.x-29,y:s.y+20}]);
        ctx.fillStyle = '#5a351e';
        this.fillPoly([{x:s.x-3,y:s.y+19},{x:s.x+34,y:s.y+5},{x:s.x+34,y:s.y+22},{x:s.x-3,y:s.y+36}]);
        ctx.strokeStyle = '#d8ad57';
        ctx.lineWidth = 2;
        ctx.strokeRect((s.x - 12) | 0, (s.y + 9) | 0, 13, 10);
        ctx.fillStyle = '#f8dd82';
        ctx.fillRect((s.x - 7) | 0, (s.y + 12) | 0, 4, 5);
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f4dfae';
        ctx.fillText('REWARD', s.x + 2, s.y + 49);
        ctx.restore();
      },

      drawPuzzleSwitch(s, obj = {}) {
        ctx.save();
        const color = obj.activated ? '#75d069' : (obj.color || '#fff08a');
        ctx.fillStyle = 'rgba(0,0,0,0.34)';
        ctx.beginPath();
        ctx.ellipse(s.x + 2, s.y + 13, 26, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = obj.activated ? '#324f2f' : '#4b4134';
        this.fillPoly([{x:s.x-15,y:s.y+9},{x:s.x+5,y:s.y+1},{x:s.x+18,y:s.y+9},{x:s.x-2,y:s.y+19}]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect((s.x - 7) | 0, (s.y + 3) | 0, 16, 13);
        ctx.fillStyle = color;
        ctx.globalAlpha = obj.activated ? 0.9 : 0.48;
        ctx.beginPath();
        ctx.arc(s.x + 1, s.y - 8, obj.activated ? 9 : 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#f8ecd0';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(obj.activated ? 'ON' : (obj.label || String((obj.sequenceIndex || 0) + 1)), s.x + 1, s.y - 5);
        ctx.restore();
      },

      drawPuzzleKey(s, obj = {}) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.30)';
        ctx.beginPath();
        ctx.ellipse(s.x + 2, s.y + 13, 23, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = obj.color || '#75d069';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(s.x - 8, s.y - 7, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - 7);
        ctx.lineTo(s.x + 22, s.y - 7);
        ctx.lineTo(s.x + 22, s.y - 1);
        ctx.moveTo(s.x + 11, s.y - 7);
        ctx.lineTo(s.x + 11, s.y + 1);
        ctx.stroke();
        ctx.fillStyle = '#f8ecd0';
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('KEY', s.x + 3, s.y + 24);
        ctx.restore();
      },

      drawPuzzleLock(s, obj = {}) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.beginPath();
        ctx.ellipse(s.x + 2, s.y + 15, 25, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = obj.color || '#fff08a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(s.x, s.y - 11, 10, Math.PI, 0);
        ctx.stroke();
        ctx.fillStyle = '#514435';
        ctx.fillRect((s.x - 13) | 0, (s.y - 10) | 0, 26, 24);
        ctx.strokeStyle = obj.color || '#fff08a';
        ctx.strokeRect((s.x - 13) | 0, (s.y - 10) | 0, 26, 24);
        ctx.fillStyle = '#f8ecd0';
        ctx.font = '12px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('L', s.x, s.y + 6);
        ctx.restore();
      },


      drawWebAnchor(s, obj = {}) {
        ctx.save();
        const color = obj.opened ? '#816199' : (obj.color || '#d68cff');
        this.drawPropContactShadow?.(s, 18, 6, 0.22);
        ctx.strokeStyle = '#15110e';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y + 8); ctx.lineTo(s.x, s.y - 42);
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y + 7); ctx.lineTo(s.x, s.y - 40);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(232,214,255,.82)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
          ctx.beginPath();
          ctx.moveTo(s.x, s.y - 32 + i * 6);
          ctx.lineTo(s.x + (i % 2 ? 23 : -23), s.y - 47 + i * 3);
          ctx.stroke();
        }
        ctx.fillStyle = obj.opened ? '#62506f' : color;
        ctx.beginPath();
        ctx.arc(s.x, s.y - 42, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },

      drawWebGate(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 48, 12, 0.32);
        const opened = Boolean(obj.opened || obj.severed || obj.sealed === false);
        const color = opened ? '#9f8cb5' : (obj.color || '#d68cff');
        ctx.fillStyle = opened ? 'rgba(80,72,94,0.34)' : 'rgba(20,13,25,0.72)';
        ctx.beginPath();
        ctx.ellipse(s.x, s.y - 10, 40, 62, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#15110e';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(s.x - 42, s.y + 8);
        ctx.bezierCurveTo(s.x - 24, s.y - 70, s.x + 24, s.y - 70, s.x + 42, s.y + 8);
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.globalAlpha = opened ? 0.24 : 0.9;
        ctx.strokeStyle = opened ? '#b9a6c8' : '#e8d6ff';
        ctx.lineWidth = 1.7;
        for (let i = -4; i <= 4; i++) {
          ctx.beginPath();
          ctx.moveTo(s.x + i * 10, s.y + 8);
          ctx.lineTo(s.x, s.y - 58);
          ctx.stroke();
        }
        for (let r = 0; r < 5; r++) {
          ctx.beginPath();
          ctx.ellipse(s.x, s.y - 3 - r * 12, 12 + r * 8, 5 + r * 2.8, 0, Math.PI, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = opened ? '#8df0bc' : '#f0c6ff';
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(opened ? 'OPEN' : 'SEALED', s.x, s.y + 30);
        ctx.restore();
      },

      // V0.18.34: a body cocooned in spider silk. Reads as a wrapped corpse (a body form showing
      // through woven, criss-crossing silk that is bound with cinching wraps and tied off to
      // anchor threads) rather than the old flat ellipse with horizontal ribs.
      drawSilkCocoon(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 22, 8, 0.28);
        const opened = Boolean(obj.opened);
        const kind = String(obj.cocoonType || 'egg');
        const seed = (obj._propSeed != null) ? obj._propSeed
          : Math.abs(Math.floor((Number(obj.x) || 0) * 73856 + (Number(obj.y) || 0) * 19349));
        const rnd = (n) => { const v = Math.sin(seed * 0.017 + n * 91.7) * 43758.5; return v - Math.floor(v); };

        // Vertical pod: rests on the ground, fattest in the middle (the wrapped body).
        const cx = s.x, botY = s.y + 5, topY = s.y - 52, span = botY - topY, maxHalf = 15;
        const widthAt = (t) => (2.5 + maxHalf * Math.pow(Math.sin(Math.PI * t), 0.7)) * (kind === 'corpse' ? 1 : 0.92);
        const yAt = (t) => topY + span * t;
        const podPath = () => {
          const N = 14;
          ctx.beginPath();
          ctx.moveTo(cx - widthAt(0), yAt(0));
          for (let i = 1; i <= N; i++) { const t = i / N; ctx.lineTo(cx - widthAt(t), yAt(t)); }
          for (let i = N; i >= 0; i--) { const t = i / N; ctx.lineTo(cx + widthAt(t), yAt(t)); }
          ctx.closePath();
        };

        // 1) loose web anchor threads tying the cocoon to its surroundings.
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(226,220,236,0.42)';
        ctx.lineWidth = 0.8;
        const anchors = [[-34, -6], [34, -10], [-26, -30], [28, -32], [0, -46], [-30, 14], [30, 12]];
        for (let i = 0; i < anchors.length; i++) {
          const ax = anchors[i][0] + (rnd(i) - 0.5) * 6, ay = anchors[i][1] + (rnd(i + 5) - 0.5) * 6;
          const t = 0.3 + rnd(i + 11) * 0.5;
          const attX = cx + (ax > 0 ? widthAt(t) : -widthAt(t)) * 0.7, attY = yAt(t);
          ctx.beginPath();
          ctx.moveTo(cx + ax, s.y + ay);
          ctx.quadraticCurveTo((cx + ax + attX) / 2, (s.y + ay + attY) / 2 + 4, attX, attY);
          ctx.stroke();
        }

        // 2) the silk pod silhouette.
        const base = opened ? '#9f8cb5' : (obj.color || (kind === 'poison' ? '#a7e28d' : '#dcd3ea'));
        const g = ctx.createLinearGradient(cx - maxHalf, topY, cx + maxHalf, botY);
        g.addColorStop(0, '#f1ecf7');
        g.addColorStop(0.5, base);
        g.addColorStop(1, '#857895');
        podPath(); ctx.fillStyle = g; ctx.fill();

        // 3) the body form showing faintly through the silk (head, torso, hips).
        if (!opened) {
          ctx.save(); podPath(); ctx.clip();
          ctx.globalAlpha = kind === 'corpse' ? 0.34 : 0.20;
          ctx.fillStyle = '#3a2f45';
          ctx.beginPath(); ctx.ellipse(cx, yAt(0.16), 7, 8.5, 0, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(cx, yAt(0.42), widthAt(0.42) * 0.68, 12, 0, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(cx, yAt(0.70), widthAt(0.70) * 0.55, 10, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }

        // 4) woven silk: two criss-crossing families of diagonal strands (clipped to the pod).
        ctx.save(); podPath(); ctx.clip();
        for (const dir of [1, -1]) {
          ctx.strokeStyle = dir > 0 ? 'rgba(248,244,252,0.50)' : 'rgba(240,236,248,0.40)';
          ctx.lineWidth = 1.0;
          for (let k = -7; k <= 7; k++) {
            const bx = cx - maxHalf * 1.4 + k * 5;
            ctx.beginPath();
            ctx.moveTo(bx, topY - 4);
            ctx.lineTo(bx + dir * span * 0.9, botY + 4);
            ctx.stroke();
          }
        }
        // 5) binding wraps cinching the silk (follow the pod width -> tapered ends).
        ctx.strokeStyle = 'rgba(255,255,255,0.58)';
        ctx.lineWidth = 1.5;
        for (let i = 1; i <= 6; i++) {
          const t = i / 7, w = widthAt(t), y = yAt(t);
          ctx.beginPath(); ctx.moveTo(cx - w, y); ctx.quadraticCurveTo(cx, y - 3.4, cx + w, y); ctx.stroke();
        }
        ctx.restore();

        // 6) frayed silk wisps escaping the top.
        ctx.strokeStyle = 'rgba(240,236,248,0.55)';
        ctx.lineWidth = 0.9;
        for (let i = 0; i < 4; i++) {
          const wx = cx + (i - 1.5) * 5;
          ctx.beginPath();
          ctx.moveTo(wx, topY + 2);
          ctx.quadraticCurveTo(wx + (rnd(i) - 0.5) * 8, topY - 8, wx + (rnd(i + 3) - 0.5) * 12, topY - 14 - rnd(i) * 4);
          ctx.stroke();
        }

        if (kind === 'poison') { ctx.fillStyle = '#83d873'; ctx.beginPath(); ctx.arc(cx + 7, yAt(0.35), 4.2, 0, Math.PI * 2); ctx.fill(); }
        if (kind === 'survivor' && !opened) { ctx.strokeStyle = '#f4dfae'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(cx - 4, yAt(0.6)); ctx.lineTo(cx + 5, yAt(0.66)); ctx.stroke(); }

        ctx.fillStyle = opened ? '#c9bcd8' : '#efe6d4';
        ctx.font = 'bold 8px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(opened ? 'OPEN' : (kind === 'survivor' ? 'SURVIVOR' : kind.toUpperCase()), cx, s.y + 15);
        ctx.restore();
      },

      drawBossCocoonPrison(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 25, 9, 0.30);
        const hpPct = Math.max(0, Math.min(1, Number(obj.hp || 0) / Math.max(1, Number(obj.maxHp || obj.hp || 1))));
        const t = performance.now() * 0.004;
        ctx.strokeStyle = 'rgba(232,214,255,.75)';
        ctx.lineWidth = 1.3;
        for (let i = 0; i < 8; i++) {
          ctx.beginPath();
          ctx.moveTo(s.x - 24 + i * 7, s.y - 58);
          ctx.quadraticCurveTo(s.x + Math.sin(t + i) * 7, s.y - 22, s.x - 18 + i * 6, s.y + 8);
          ctx.stroke();
        }
        ctx.fillStyle = '#15110e';
        ctx.beginPath();
        ctx.ellipse(s.x, s.y - 22, 21, 36, 0, 0, Math.PI * 2);
        ctx.fill();
        const g = ctx.createLinearGradient(s.x - 16, s.y - 56, s.x + 15, s.y + 8);
        g.addColorStop(0, '#f1e5ff');
        g.addColorStop(0.5, obj.color || '#d8c8f2');
        g.addColorStop(1, '#7b618e');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y - 23, 16, 31, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.72;
        for (let i = -4; i <= 4; i++) {
          ctx.beginPath();
          ctx.moveTo(s.x - 15, s.y - 22 + i * 6);
          ctx.quadraticCurveTo(s.x, s.y - 33 + i * 4, s.x + 15, s.y - 22 + i * 6);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#1d151f';
        ctx.fillRect((s.x - 18) | 0, (s.y + 17) | 0, 36, 5);
        ctx.fillStyle = '#8df0bc';
        ctx.fillRect((s.x - 17) | 0, (s.y + 18) | 0, Math.max(1, Math.floor(34 * hpPct)), 3);
        ctx.fillStyle = '#f8ecd0';
        ctx.font = 'bold 9px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('BREAK', s.x, s.y + 32);
        ctx.restore();
      },

      // V0.18.61: a big pile of spider eggs on the ground in a silk nest - varied egg sizes, some
      // hatched (a torn husk with a dark hole + maybe a hatchling), draped in webbing with a guard
      // spider crawling on it. obj.eggPileSize 'large' | 'small'; royal (pink) on floor 3.
      drawEggPile(s, obj = {}) {
        ctx.save();
        let st = ((obj._propSeed || (Math.floor(obj.x || 0) * 374761 + Math.floor(obj.y || 0) * 668265 + 29)) >>> 0) || 1;
        const rnd = () => { st = (st * 1664525 + 1013904223) >>> 0; return st / 4294967296; };
        const big = obj.eggPileSize === 'large' || obj.big === true;
        const royal = obj.royal === true || Number(obj.floor) >= 3;
        const scale = big ? 1 : 0.62;
        const t = performance.now() * 0.0016 + Number(obj.x || 0) * 0.11;
        const shell = royal ? '#f4d9ef' : '#ede4cf', shellShade = royal ? '#caa7c2' : '#c8bda0';
        const cx = s.x, by = s.y;
        this.drawPropContactShadow?.(s, 34 * scale, 12 * scale, 0.3);
        // silk nest mound
        const mound = ctx.createRadialGradient(cx - 6 * scale, by - 8 * scale, 4, cx, by, 40 * scale);
        mound.addColorStop(0, 'rgba(226,216,244,0.85)'); mound.addColorStop(0.6, 'rgba(198,188,214,0.6)'); mound.addColorStop(1, 'rgba(150,142,168,0.3)');
        ctx.fillStyle = mound; ctx.beginPath(); ctx.ellipse(cx, by, 38 * scale, 15 * scale, 0, 0, Math.PI * 2); ctx.fill();
        // the eggs - varied sizes, back-to-front, some hatched
        const n = big ? (13 + (rnd() * 8 | 0)) : (6 + (rnd() * 4 | 0));
        const eggs = [];
        for (let i = 0; i < n; i++) eggs.push({ dx: (rnd() - 0.5) * 66 * scale, dy: (rnd() - 0.9) * 26 * scale, r: (5 + rnd() * 4) * scale, ph: rnd() * Math.PI * 2, hatched: rnd() > 0.82 });
        eggs.sort((a, b) => a.dy - b.dy);
        for (const e of eggs) {
          const pulse = 1 + Math.sin(t + e.ph) * 0.03, ex = cx + e.dx, ey = by - 8 * scale + e.dy, rx = e.r * pulse, ry = e.r * 1.28 * pulse;
          if (e.hatched) {
            ctx.globalAlpha = 0.9; ctx.fillStyle = shellShade;
            ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(18,12,22,0.8)'; ctx.beginPath(); ctx.ellipse(ex, ey - ry * 0.15, rx * 0.6, ry * 0.55, 0, 0, Math.PI * 2); ctx.fill();
            if (rnd() > 0.5) this.drawTinySpider?.(ex, ey - ry * 0.2, 2.2 * scale, rnd() * Math.PI * 2, royal ? '#4a2a48' : '#2e2340');
          } else {
            const g = ctx.createRadialGradient(ex - rx * 0.3, ey - ry * 0.4, 1, ex, ey, ry * 1.3);
            g.addColorStop(0, '#fffdf6'); g.addColorStop(0.5, shell); g.addColorStop(1, shellShade);
            ctx.globalAlpha = 0.95; ctx.fillStyle = g;
            ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 0.22; ctx.fillStyle = royal ? '#7a3f74' : '#5a4a2e';
            ctx.beginPath(); ctx.ellipse(ex + rx * 0.15, ey + ry * 0.1, rx * 0.42, ry * 0.5, 0.4, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
        // webbing draped over the pile
        ctx.strokeStyle = 'rgba(224,214,244,0.5)'; ctx.lineWidth = 0.8; ctx.lineCap = 'round';
        const strands = big ? 7 : 4;
        for (let i = 0; i < strands; i++) { const x0 = cx - 30 * scale + i * (60 * scale / (strands - 1)); ctx.beginPath(); ctx.moveTo(x0, by + 4 * scale); ctx.quadraticCurveTo(cx, by - 16 * scale, x0 + (rnd() - 0.5) * 8, by - 22 * scale); ctx.stroke(); }
        // a guard spider or two crawling on the pile (animated)
        const now2 = performance.now();
        for (let i = 0; i < (big ? 2 : 1); i++) { const b = rnd(), cyc = (now2 * 0.00016 + b * 2) % 2, tri = cyc < 1 ? cyc : 2 - cyc; this.drawTinySpider?.(cx - 26 * scale + tri * 52 * scale, by - 6 * scale - Math.sin(tri * Math.PI) * 10 * scale, 2.6 * scale, cyc < 1 ? Math.PI / 2 : -Math.PI / 2, royal ? '#4a2a48' : '#2e2340', now2 * 0.012 + b * 6); }
        ctx.restore();
      },

      // V0.18.61: a real ORB WEB splat on the ground (iso-squashed radial spokes + a capture
      // spiral + silk beads) instead of the old concentric-ripple rings. Tears + puffs on break.
      drawWebHazard(s, obj = {}) {
        ctx.save();
        const now = performance.now();
        const broken = obj.broken === true;
        const breakAt = Number(obj.breakAt || 0);
        const triggered = !broken && breakAt > 0;
        const holdMs = Math.max(250, Number(obj.holdSeconds || obj.breakAfterSeconds || 5) * 1000);
        const leftPct = triggered ? Math.max(0, Math.min(1, (breakAt - now) / holdMs)) : 1;
        const breakAge = broken ? Math.max(0, now - Number(obj.brokenAt || now)) : 0;
        if (broken && breakAge > 1800) { ctx.restore(); return; }
        const alpha = broken ? Math.max(0, 0.62 * (1 - breakAge / 1800)) : 0.62;
        const col = broken ? '#8f82aa' : (obj.color || '#d8c8f2');
        const cx = s.x, cy = s.y + 5;
        const R = obj.temporarySpiderWebTrap ? 28 : 34, ky = 0.42;
        const snap = broken ? Math.min(1, breakAge / 500) : 0;
        const rot = (obj.x || 0) * 0.7 + (obj.y || 0) * 1.3;
        ctx.lineCap = 'round';
        // silk sheen sheet under the web
        ctx.globalAlpha = alpha * 0.28; ctx.fillStyle = col;
        ctx.beginPath(); ctx.ellipse(cx, cy, R * (1 + snap * 0.5), R * ky * (1 + snap * 0.5), 0, 0, Math.PI * 2); ctx.fill();
        // radial spokes
        const spokes = 10;
        ctx.globalAlpha = alpha * 0.85; ctx.strokeStyle = col; ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (let i = 0; i < spokes; i++) { const a = i * (Math.PI * 2 / spokes) + rot, rr = R * (1 + snap * (i % 2 ? 0.4 : 0.1)); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * ky); }
        ctx.stroke();
        // capture spiral (~3 turns), gapped on break
        ctx.globalAlpha = alpha * 0.8; ctx.lineWidth = 0.9;
        ctx.beginPath(); let started = false;
        for (let tt = 0.12; tt <= 1.001; tt += 1 / (spokes * 2.5)) {
          if (broken && (Math.floor(tt * 6) % 2 === 0)) { started = false; continue; }
          const a = tt * Math.PI * 2 * 3 + rot, rr = R * tt, px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * ky;
          if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
        }
        ctx.stroke();
        // bright silk beads at the junctions + centre
        ctx.globalAlpha = alpha * 0.7; ctx.fillStyle = broken ? '#b9aed0' : '#f2ecff';
        for (let i = 0; i < spokes; i += 2) { const a = i * (Math.PI * 2 / spokes) + rot; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * R * 0.66, cy + Math.sin(a) * R * 0.66 * ky, 0.9, 0, Math.PI * 2); ctx.fill(); }
        ctx.beginPath(); ctx.arc(cx, cy, 1.3, 0, Math.PI * 2); ctx.fill();
        // triggered: a countdown ring floating above
        if (triggered) {
          ctx.globalAlpha = 0.8; ctx.strokeStyle = '#fff2ff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(cx, cy - R * ky - 10, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * leftPct); ctx.stroke();
        }
        // break: rising silk puffs
        if (broken) {
          ctx.globalAlpha = Math.max(0, 0.6 * (1 - breakAge / 900)); ctx.fillStyle = '#f8f0ff';
          for (let i = 0; i < 8; i++) { const a = now * 0.004 + i * 0.9; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (16 + i * 2), cy - breakAge * 0.016 + Math.sin(a) * 6, 1.3, 0, Math.PI * 2); ctx.fill(); }
        }
        ctx.restore();
      },

      drawPoisonDrip(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 22, 7, 0.20);
        const t = performance.now() * 0.008;
        ctx.fillStyle = 'rgba(102,210,96,.20)'; ctx.beginPath(); ctx.ellipse(s.x, s.y + 8, 30, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = obj.color || '#83d873';
        for (let i = 0; i < 6; i++) {
          const yy = s.y - 18 + (i % 2) * 7 + Math.sin(t + i) * 2;
          ctx.beginPath(); ctx.ellipse(s.x - 18 + i * 7, yy, 3.4, 7.5, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(210,255,198,.45)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(s.x, s.y + 8, 31, 10, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      },

      drawVenomSack(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 24, 8, 0.28);
        const t = performance.now() * 0.006 + Number(obj.x || 0) * 0.13 + Number(obj.y || 0) * 0.07;
        const pulse = 1 + Math.sin(t) * 0.075;
        ctx.translate(s.x, s.y + 2);
        ctx.scale(pulse, pulse);
        const glow = ctx.createRadialGradient(0, -7, 3, 0, -7, 34);
        glow.addColorStop(0, 'rgba(198,255,91,0.44)');
        glow.addColorStop(0.58, 'rgba(103,215,87,0.18)');
        glow.addColorStop(1, 'rgba(103,215,87,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.ellipse(0, -5, 34, 20, 0, 0, Math.PI * 2); ctx.fill();
        const sac = ctx.createLinearGradient(-14, -28, 14, 10);
        sac.addColorStop(0, '#e6ff7a');
        sac.addColorStop(0.42, obj.color || '#a6ff68');
        sac.addColorStop(1, '#4d7632');
        ctx.globalAlpha = 0.88;
        ctx.fillStyle = sac;
        ctx.beginPath(); ctx.ellipse(0, -9, 15, 25, -0.08, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(38,54,29,0.52)';
        ctx.beginPath(); ctx.ellipse(1, -4, 9, 14, -0.18, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#2c3e20';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, -9, 15, 25, -0.08, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(244,255,166,0.72)';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-6, -29); ctx.quadraticCurveTo(-15, -13, -8, 8); ctx.stroke();
        ctx.fillStyle = '#efff94';
        ctx.beginPath(); ctx.arc(-5, -21, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5f352e';
        for (let i = 0; i < 3; i++) {
          const dx = -10 + i * 9;
          const dy = 11 + Math.sin(t + i) * 1.5;
          ctx.beginPath(); ctx.ellipse(dx, dy, 2.2, 4.6, 0.1 * i, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      },

      drawVenomSackBurst(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 18, 6, 0.18);
        ctx.translate(s.x, s.y + 8);
        ctx.fillStyle = 'rgba(73,96,46,0.52)';
        ctx.beginPath(); ctx.ellipse(0, 1, 22, 8, -0.08, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(166,255,104,0.22)';
        ctx.beginPath(); ctx.ellipse(2, -1, 16, 5, 0.12, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(40,56,30,0.65)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-17, -2); ctx.quadraticCurveTo(-4, -8, 8, -3); ctx.quadraticCurveTo(17, 1, 22, 4); ctx.stroke();
        ctx.restore();
      },

      // V0.18.35 Web Silk Cavern: smashable spider egg clutch. Pale, bulbous,
      // silk-veiled eggs with a faint embryo shadow and a slow live pulse -
      // reads as "these are about to hatch". Breaking one (walk-over) either
      // drops loot or spawns baby spiders (handled in dungeon-system).
      drawSpiderEgg(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 26, 9, 0.26);
        let st = ((obj._propSeed || 1) >>> 0) || 1;
        const rnd = () => { st = (st * 1664525 + 1013904223) >>> 0; return st / 4294967296; };
        const t = performance.now() * 0.0016 + Number(obj.x || 0) * 0.11;
        const royal = obj.royal === true || Number(obj.floor) >= 3;
        const shell = royal ? '#f4d9ef' : '#ede4cf';
        const shellShade = royal ? '#caa7c2' : '#c8bda0';
        // silk nest bed the clutch sits in
        ctx.fillStyle = 'rgba(216,200,240,0.16)';
        ctx.beginPath(); ctx.ellipse(s.x, s.y + 4, 24, 9, 0, 0, Math.PI * 2); ctx.fill();
        const n = 4 + Math.floor(rnd() * 2); // 4-5 eggs
        const eggs = [];
        for (let i = 0; i < n; i++) {
          eggs.push({ dx: (rnd() - 0.5) * 30, dy: 2 - rnd() * 10, r: 5.5 + rnd() * 3.5, ph: rnd() * Math.PI * 2 });
        }
        eggs.sort((a, b) => a.dy - b.dy); // back-to-front
        for (const e of eggs) {
          const pulse = 1 + Math.sin(t + e.ph) * 0.03;
          const ex = s.x + e.dx, ey = s.y - 6 + e.dy;
          const rx = e.r * pulse, ry = e.r * 1.28 * pulse;
          const g = ctx.createRadialGradient(ex - rx * 0.3, ey - ry * 0.4, 1, ex, ey, ry * 1.3);
          g.addColorStop(0, '#fffdf6'); g.addColorStop(0.5, shell); g.addColorStop(1, shellShade);
          ctx.globalAlpha = 0.95; ctx.fillStyle = g;
          ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
          // embryo shadow curled inside
          ctx.globalAlpha = 0.22; ctx.fillStyle = royal ? '#7a3f74' : '#5a4a2e';
          ctx.beginPath(); ctx.ellipse(ex + rx * 0.15, ey + ry * 0.1, rx * 0.42, ry * 0.5, 0.4, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 0.6; ctx.strokeStyle = shellShade; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
          // vein + sheen
          ctx.globalAlpha = 0.35; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(ex - rx * 0.5, ey - ry * 0.3); ctx.quadraticCurveTo(ex, ey - ry * 0.9, ex + rx * 0.4, ey - ry * 0.2); ctx.stroke();
          ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.ellipse(ex - rx * 0.35, ey - ry * 0.45, rx * 0.22, ry * 0.22, 0, 0, Math.PI * 2); ctx.fill();
        }
        // silk veil strands anchoring the clutch to the ground
        ctx.globalAlpha = 0.5; ctx.strokeStyle = 'rgba(224,214,240,0.7)'; ctx.lineWidth = 0.9;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.3;
          ctx.beginPath();
          ctx.moveTo(s.x + Math.cos(a) * 4, s.y - 10 + Math.sin(a) * 3);
          ctx.lineTo(s.x + Math.cos(a) * 22, s.y + 2 + Math.sin(a) * 8);
          ctx.stroke();
        }
        ctx.restore();
      },

      // V0.18.35: cracked, emptied spider-egg shells left after a clutch is smashed.
      drawSpiderEggBurst(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 20, 7, 0.18);
        let st = ((obj._propSeed || 1) >>> 0) || 1;
        const rnd = () => { st = (st * 1664525 + 1013904223) >>> 0; return st / 4294967296; };
        ctx.fillStyle = 'rgba(216,200,240,0.14)';
        ctx.beginPath(); ctx.ellipse(s.x, s.y + 2, 20, 8, 0, 0, Math.PI * 2); ctx.fill();
        const n = 3 + Math.floor(rnd() * 2);
        for (let i = 0; i < n; i++) {
          const ex = s.x + (rnd() - 0.5) * 26, ey = s.y - 2 - rnd() * 6, r = 4 + rnd() * 3, rot = rnd() * Math.PI;
          ctx.globalAlpha = 0.9; ctx.fillStyle = '#e6ddc8';
          ctx.beginPath(); ctx.ellipse(ex, ey, r, r * 0.7, rot, 0.4, Math.PI + 0.6); ctx.fill();
          ctx.globalAlpha = 0.5; ctx.strokeStyle = '#b9ad8f'; ctx.lineWidth = 0.9;
          ctx.beginPath(); ctx.ellipse(ex, ey, r, r * 0.7, rot, 0.4, Math.PI + 0.6); ctx.stroke();
          ctx.globalAlpha = 0.3; ctx.fillStyle = '#2a2418';
          ctx.beginPath(); ctx.ellipse(ex, ey + 1, r * 0.5, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      },

      // V0.18.35 Web Silk Cavern hazard: small, DEAD, green-tinted egg filled with
      // venom. Dull matte green (no living pulse), cracked and leaking venom.
      // Walking over OR smashing it poisons the player (dungeon-system).
      drawVenomEgg(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 18, 6, 0.24);
        let st = ((obj._propSeed || 1) >>> 0) || 1;
        const rnd = () => { st = (st * 1664525 + 1013904223) >>> 0; return st / 4294967296; };
        const t = performance.now() * 0.004 + Number(obj.x || 0) * 0.1;
        const haze = ctx.createRadialGradient(s.x, s.y - 2, 2, s.x, s.y - 2, 20);
        haze.addColorStop(0, 'rgba(150,210,80,0.24)'); haze.addColorStop(1, 'rgba(90,150,60,0)');
        ctx.fillStyle = haze;
        ctx.beginPath(); ctx.ellipse(s.x, s.y - 1, 20, 11, 0, 0, Math.PI * 2); ctx.fill();
        const n = 1 + Math.floor(rnd() * 2); // 1-2 small eggs
        for (let i = 0; i < n; i++) {
          const dx = n === 1 ? 0 : (i === 0 ? -6 : 7);
          const ex = s.x + dx, ey = s.y - 5 - (i ? 2 : 0);
          const rx = 6 - i * 1.2, ry = 8.4 - i * 1.6;
          const g = ctx.createLinearGradient(ex - rx, ey - ry, ex + rx, ey + ry);
          g.addColorStop(0, '#8fae57'); g.addColorStop(0.5, obj.color || '#6f8d3f'); g.addColorStop(1, '#3c4d24');
          ctx.globalAlpha = 0.92; ctx.fillStyle = g;
          ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, -0.05, 0, Math.PI * 2); ctx.fill();
          // dead mottling
          ctx.globalAlpha = 0.4; ctx.fillStyle = '#2b3a1c';
          ctx.beginPath(); ctx.ellipse(ex + rx * 0.2, ey + ry * 0.1, rx * 0.4, ry * 0.5, 0.3, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 0.7; ctx.strokeStyle = '#2c3a1a'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, -0.05, 0, Math.PI * 2); ctx.stroke();
          // venom crack leaking green
          ctx.globalAlpha = 0.85; ctx.strokeStyle = '#c3ff5a'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(ex - rx * 0.3, ey - ry * 0.5); ctx.lineTo(ex - rx * 0.1, ey); ctx.lineTo(ex + rx * 0.2, ey + ry * 0.4); ctx.stroke();
          // slow venom ooze at the base
          ctx.globalAlpha = 0.6 + Math.sin(t + i) * 0.2; ctx.fillStyle = '#a6ff68';
          ctx.beginPath(); ctx.ellipse(ex + rx * 0.1, ey + ry * 0.9, 1.6, 2.6, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      },

      // V0.18.35: burst venom egg - a splatter of venom and broken green shell.
      drawVenomEggBurst(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 16, 6, 0.16);
        const t = performance.now() * 0.004;
        const g = ctx.createRadialGradient(s.x, s.y + 2, 2, s.x, s.y + 2, 22);
        g.addColorStop(0, 'rgba(166,255,104,0.4)'); g.addColorStop(0.5, 'rgba(120,190,70,0.22)'); g.addColorStop(1, 'rgba(60,90,44,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(s.x, s.y + 2, 20 + Math.sin(t) * 1.5, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5c7433';
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.5;
          const fx = s.x + Math.cos(a) * (7 + i), fy = s.y - 1 + Math.sin(a) * 4;
          ctx.globalAlpha = 0.85;
          ctx.beginPath(); ctx.ellipse(fx, fy, 3, 2, a, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 0.5; ctx.strokeStyle = 'rgba(195,255,90,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(s.x - 14, s.y); ctx.quadraticCurveTo(s.x, s.y - 5, s.x + 14, s.y + 1); ctx.stroke();
        ctx.restore();
      },

      // V0.18.38: a full-size body cocooned upright in silk - a victim strung up in the
      // webs. Break it (walk into) and a skeleton tumbles out (dungeon-system VFX).
      drawWebWrappedBody(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 22, 8, 0.3);
        let st = ((obj._propSeed || 1) >>> 0) || 1;
        const rnd = () => { st = (st * 1664525 + 1013904223) >>> 0; return st / 4294967296; };
        const royal = obj.royal === true || Number(obj.floor) >= 3;
        const silk = royal ? '#f0d9ef' : '#d8ccdf';
        const silkDk = royal ? '#b892b4' : '#9b8fa8';
        const cx = s.x, footY = s.y;
        const topY = footY - 74; // tall upright body
        // anchor threads pulling the body up into the webs
        ctx.globalAlpha = 0.5; ctx.strokeStyle = 'rgba(224,214,240,0.7)'; ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          const ax = cx - 14 + i * 9;
          ctx.beginPath(); ctx.moveTo(ax, topY - 4); ctx.lineTo(cx - 22 + i * 15, topY - 30); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // silk-wrapped body pod (head bulge + torso taper to bound legs)
        const g = ctx.createLinearGradient(cx - 16, topY, cx + 16, footY);
        g.addColorStop(0, silk); g.addColorStop(0.5, royal ? '#e6c8e2' : '#c3b6cf'); g.addColorStop(1, silkDk);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(cx, topY);
        ctx.quadraticCurveTo(cx + 15, topY + 6, cx + 14, topY + 26);   // head/shoulder
        ctx.quadraticCurveTo(cx + 12, topY + 52, cx + 7, footY - 2);   // taper to feet
        ctx.quadraticCurveTo(cx, footY + 3, cx - 7, footY - 2);
        ctx.quadraticCurveTo(cx - 12, topY + 52, cx - 14, topY + 26);
        ctx.quadraticCurveTo(cx - 15, topY + 6, cx, topY);
        ctx.closePath(); ctx.fill();
        // faint body silhouette showing through the silk (head + slumped torso)
        ctx.globalAlpha = 0.16; ctx.fillStyle = '#2a2230';
        ctx.beginPath(); ctx.ellipse(cx, topY + 15, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx, topY + 40, 9, 16, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        // criss-cross binding wraps cinching the silk
        ctx.strokeStyle = 'rgba(245,240,252,0.7)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
        for (let i = 0; i < 8; i++) {
          const wy = topY + 8 + i * 8 + rnd() * 2;
          const w = 14 - Math.abs(i - 4) * 0.9;
          ctx.beginPath(); ctx.moveTo(cx - w, wy - 2); ctx.quadraticCurveTo(cx, wy + 2, cx + w, wy - 2); ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(155,143,168,0.5)'; ctx.lineWidth = 0.8;
        for (let i = 0; i < 5; i++) {
          const yy = topY + 12 + i * 12;
          ctx.beginPath(); ctx.moveTo(cx - 12, yy); ctx.lineTo(cx + 12, yy + 6); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx + 12, yy); ctx.lineTo(cx - 12, yy + 6); ctx.stroke();
        }
        // frayed silk wisps at the top
        ctx.globalAlpha = 0.5; ctx.strokeStyle = silk; ctx.lineWidth = 0.8;
        for (let i = 0; i < 4; i++) { const wx = cx - 6 + i * 4; ctx.beginPath(); ctx.moveTo(wx, topY); ctx.lineTo(wx + (rnd() - 0.5) * 6, topY - 8 - rnd() * 5); ctx.stroke(); }
        ctx.restore();
      },

      // V0.18.38: the torn-open cocoon left after a web-wrapped body is broken, with the
      // spilled skeleton crumpled on the ground below it.
      drawBrokenWrappedBody(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 20, 7, 0.24);
        const cx = s.x, footY = s.y, topY = footY - 60;
        const silk = obj.royal ? '#f0d9ef' : '#d8ccdf';
        // torn hanging cocoon shell (split open, empty)
        ctx.globalAlpha = 0.9; ctx.strokeStyle = 'rgba(216,204,223,0.85)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.fillStyle = 'rgba(40,32,46,0.35)';
        ctx.beginPath();
        ctx.moveTo(cx - 12, topY); ctx.quadraticCurveTo(cx - 18, topY + 22, cx - 8, topY + 34);
        ctx.lineTo(cx - 3, topY + 20); ctx.lineTo(cx - 6, topY + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 12, topY); ctx.quadraticCurveTo(cx + 18, topY + 22, cx + 8, topY + 34);
        ctx.lineTo(cx + 3, topY + 20); ctx.lineTo(cx + 6, topY + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
        // frayed strands dangling from the split
        ctx.globalAlpha = 0.5; ctx.strokeStyle = silk; ctx.lineWidth = 0.8;
        for (let i = 0; i < 5; i++) { const dx = cx - 8 + i * 4; ctx.beginPath(); ctx.moveTo(dx, topY + 30); ctx.lineTo(dx + 1, topY + 30 + 6 + i); ctx.stroke(); }
        // spilled skeleton crumpled on the floor
        ctx.globalAlpha = 0.95; ctx.strokeStyle = 'rgba(90,84,66,0.7)'; ctx.fillStyle = '#e6e0cf'; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(cx - 10, footY + 1); ctx.lineTo(cx + 8, footY - 1); ctx.stroke(); // spine on ground
        for (let i = 0; i < 3; i++) { const rx = cx - 6 + i * 5; ctx.beginPath(); ctx.moveTo(rx, footY); ctx.lineTo(rx - 2, footY + 5); ctx.moveTo(rx, footY); ctx.lineTo(rx + 2, footY + 5); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(cx - 12, footY, 3.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); // skull
        ctx.fillStyle = 'rgba(20,16,24,0.8)';
        ctx.beginPath(); ctx.arc(cx - 13, footY - 0.5, 0.9, 0, Math.PI * 2); ctx.arc(cx - 11, footY - 0.5, 0.9, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      },

      // a single orb web (radial spokes + a capture spiral + frame ring + centre bead).
      // silkP is an 'rgba(r,g,b,' prefix; alpha is the base thread opacity. V0.18.47.
      drawOrbWeb(cx, cy, r, silkP, alpha, rnd, ky = 0.88) {
        ctx.save();
        ctx.lineCap = 'round';
        const spokes = r > 20 ? 11 : 9;
        const rot = rnd() * Math.PI;
        // outer frame ring
        ctx.strokeStyle = silkP + (alpha * 0.7).toFixed(2) + ')';
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.ellipse(cx, cy, r, r * ky, 0, 0, Math.PI * 2); ctx.stroke();
        // radial spokes (one path)
        ctx.strokeStyle = silkP + alpha.toFixed(2) + ')';
        ctx.lineWidth = 0.85;
        ctx.beginPath();
        for (let sp = 0; sp < spokes; sp++) { const a = sp * (Math.PI * 2 / spokes) + rot; ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * ky); }
        ctx.stroke();
        // capture spiral tying the spokes together (~2.4 turns), one path
        ctx.strokeStyle = silkP + (alpha * 0.85).toFixed(2) + ')';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        let started = false;
        // V0.18.52: bigger orbs get more turns + finer steps so the capture spiral stays dense.
        const turns = r > 30 ? 4.6 : 2.6, sstep = 1 / (spokes * (r > 30 ? 4 : 3));
        for (let tt = 0.08; tt <= 1.001; tt += sstep) {
          const a = tt * Math.PI * 2 * turns + rot, rr = r * tt;
          const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * ky;
          if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
        }
        ctx.stroke();
        // centre bead
        ctx.fillStyle = silkP + '0.72)';
        ctx.beginPath(); ctx.arc(cx, cy, 1.1, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      },

      // V0.18.47: a hanging silk WEB stretching floor-to-ceiling, rebuilt as an actual woven
      // NET (crossing threads that form irregular web cells) with embedded ORB WEBS - the
      // unmistakable spider-web geometry - instead of a bundle of parallel vertical strings.
      drawCeilingWebColumn(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 15, 6, 0.2);
        // V0.18.56: seed from the tile position when no _propSeed is set, so every column gets a
        // DISTINCT random sequence (columns are placed without a seed, so they'd otherwise all
        // share seed=1 and look identical - defeating the variety below).
        let st = ((obj._propSeed || (Math.floor(obj.x || 0) * 374761 + Math.floor(obj.y || 0) * 668265 + 1)) >>> 0) || 1;
        const rnd = () => { st = (st * 1664525 + 1013904223) >>> 0; return st / 4294967296; };
        const royal = obj.royal === true || Number(obj.floor) >= 3;
        const silk = royal ? 'rgba(255,178,236,' : 'rgba(224,214,244,';
        // varied web sizes: 'thick' is an extremely dense ~3-tile-wide sheet, 'small' a wisp.
        const webSize = obj.webSize === 'thick' ? 'thick' : obj.webSize === 'small' ? 'small' : 'medium';
        const spread = webSize === 'thick' ? 3.2 : webSize === 'small' ? 0.62 : 1; // V0.18.57: thick = super-thick
        const opacityBoost = webSize === 'thick' ? 0.14 : webSize === 'small' ? -0.06 : 0;
        const cx = s.x, footY = s.y;
        const topY = footY - (150 + rnd() * 60); // up past the wall tops into the ceiling dark
        const span = footY - topY;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // width profile: broad at the ceiling anchor + the floor, gently pinched mid-hang.
        const botHalf = 17 * spread, topHalf = 24 * spread, midHalf = 13 * spread;
        const widthAt = (t) => { // t: 0 floor -> 1 ceiling
          const base = botHalf + (topHalf - botHalf) * t;
          const pinch = 1 - Math.abs(t - 0.5) * 2; // 1 at mid, 0 at ends
          return base - (base - midHalf) * pinch * 0.5;
        };
        // 0) translucent silk sheet behind the web (thick + medium) so it reads as filled silk
        if (webSize !== 'small') {
          ctx.globalAlpha = webSize === 'thick' ? 0.5 : 0.32;
          const sheet = ctx.createLinearGradient(0, topY, 0, footY);
          sheet.addColorStop(0, silk + '0)');
          sheet.addColorStop(0.5, silk + (webSize === 'thick' ? '0.15)' : '0.1)'));
          sheet.addColorStop(1, silk + (webSize === 'thick' ? '0.3)' : '0.2)'));
          ctx.fillStyle = sheet;
          ctx.beginPath();
          const STEPS = 8;
          for (let i = 0; i <= STEPS; i++) { const t = i / STEPS; ctx.lineTo(cx - widthAt(t), footY - span * t); }
          for (let i = STEPS; i >= 0; i--) { const t = i / STEPS; ctx.lineTo(cx + widthAt(t), footY - span * t); }
          ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 1;
        }

        // V0.18.52: rebuilt as a STACK of real ORB WEBS (radial spokes + a capture spiral) hung
        // on organic anchor threads - a true spider web. The old woven-net grid still read as a
        // rectangular fishing net no matter how much it was jittered, so it is gone entirely.
        const orbN = webSize === 'thick' ? 3 : webSize === 'small' ? 1 : 2;
        const orbs = [];
        for (let o = 0; o < orbN; o++) {
          const t = orbN === 1 ? 0.48 : 0.22 + (o / (orbN - 1)) * 0.56;
          orbs.push({ x: cx + (rnd() - 0.5) * widthAt(t) * 0.28, y: footY - span * t, r: widthAt(t) * (0.82 + rnd() * 0.16) });
        }
        // structural spine: a couple of slightly-splayed sagging strands floor -> each orb hub ->
        // ceiling, so the orbs hang on a real scaffold (no grid).
        ctx.strokeStyle = silk + ((royal ? 0.5 : 0.42) + opacityBoost).toFixed(2) + ')';
        ctx.lineWidth = webSize === 'thick' ? 1.3 : 1.0;
        const spineN = webSize === 'thick' ? 3 : 2;
        ctx.beginPath();
        for (let sN = 0; sN < spineN; sN++) {
          const dx = (sN - (spineN - 1) / 2) * 7 * spread;
          let px = cx + dx, py = footY;
          ctx.moveTo(px, py);
          for (const orb of orbs) { const nx = orb.x + dx * 0.5; ctx.quadraticCurveTo((px + nx) / 2 + (rnd() - 0.5) * 6, (py + orb.y) / 2, nx, orb.y); px = nx; py = orb.y; }
          ctx.quadraticCurveTo(px + (rnd() - 0.5) * 6, (py + topY) / 2, cx + dx * 1.4 + (rnd() - 0.5) * 10, topY);
        }
        ctx.stroke();
        // side guy-lines from each orb frame out toward the edges (organic, jittered)
        ctx.globalAlpha = royal ? 0.36 : 0.3; ctx.lineWidth = 0.7;
        ctx.beginPath();
        for (const orb of orbs) {
          const guys = webSize === 'small' ? 3 : 5;
          for (let k = 0; k < guys; k++) {
            const a = (k / guys) * Math.PI * 2 + rnd() * 0.6;
            const fx = orb.x + Math.cos(a) * orb.r, fy = orb.y + Math.sin(a) * orb.r * 0.92;
            ctx.moveTo(fx, fy); ctx.lineTo(orb.x + Math.cos(a) * orb.r * (1.35 + rnd() * 0.5), orb.y + Math.sin(a) * orb.r * (1.1 + rnd() * 0.4));
          }
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        // the ORB WEBS themselves, drawn over the scaffold (roundish - they face the camera)
        for (const orb of orbs) this.drawOrbWeb(orb.x, orb.y, orb.r, silk, (royal ? 0.54 : 0.46) + opacityBoost, rnd, 0.92);

        // 6) ceiling anchor fan (the web ties up into the dark) - one path
        ctx.strokeStyle = silk + (0.32 + opacityBoost).toFixed(2) + ')';
        ctx.lineWidth = 0.9;
        const fan = webSize === 'thick' ? 9 : 6;
        ctx.beginPath();
        for (let i = 0; i < fan; i++) { const a = -Math.PI / 2 + (i - (fan - 1) / 2) * 0.26; ctx.moveTo(cx, topY + 8); ctx.lineTo(cx + Math.cos(a) * widthAt(1), topY + 8 + Math.sin(a) * 22); }
        ctx.stroke();

        // 7) silk pool at the base (always)
        ctx.globalAlpha = 0.45; ctx.fillStyle = silk + '0.5)';
        ctx.beginPath(); ctx.ellipse(cx, footY, 13 * spread, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;

        // V0.18.56: each column INDEPENDENTLY rolls for which "infested" extras it carries - egg
        // sacs, a web nest, bones, a cocooned body, crawling spiders - so across the cavern you get
        // every mix: some bare web, some with just one thing, some with two, some with everything.
        // Deterministic per column (position-seeded above). Small columns carry lighter versions.
        const sizeF = webSize === 'thick' ? 1 : webSize === 'medium' ? 0.8 : 0.55;
        // egg sacs
        if (rnd() > 0.42) {
          ctx.fillStyle = 'rgba(224,214,240,0.82)';
          const sacs = 1 + ((rnd() * (webSize === 'thick' ? 3 : 2)) | 0);
          for (let e = 0; e < sacs; e++) { const t = 0.2 + rnd() * 0.55; ctx.beginPath(); ctx.ellipse(cx + (rnd() - 0.5) * widthAt(t) * 1.4, footY - span * t, 3.2 + 2 * sizeF, 4 + 2.6 * sizeF, 0, 0, Math.PI * 2); ctx.fill(); }
        }
        // a woven web nest
        if (rnd() > 0.62) {
          const nestY = footY - span * (0.4 + rnd() * 0.2);
          this.drawWebNest(cx + (rnd() - 0.5) * 10, nestY, (webSize === 'thick' ? 24 : 16) * (0.7 + sizeF * 0.35), royal ? '255,190,238' : '226,216,246', rnd);
        }
        // bones tangled at the base
        if (rnd() > 0.5) {
          this.drawBonesCluster(cx + (rnd() - 0.5) * 20, footY + 2, 0.4 + sizeF * 0.2, rnd, rnd() > 0.6);
          ctx.strokeStyle = silk + '0.55)'; ctx.lineWidth = 0.8;
          ctx.beginPath();
          for (let i = 0; i < 4; i++) { const bx = cx - 14 + i * 9; ctx.moveTo(bx, footY + 4); ctx.lineTo(bx + (rnd() - 0.5) * 8, footY - 12 - rnd() * 6); }
          ctx.stroke();
        }
        // a body cocooned in the silk
        if (rnd() > 0.5) {
          const t = 0.3 + rnd() * 0.32;
          this.drawWebCocoon(cx + (rnd() - 0.5) * widthAt(t) * 0.5, footY - span * t, 34 * sizeF, 8 * sizeF, silk, rnd);
        }
        // tiny spiders crawling up + down the column web (animated)
        if (rnd() > 0.25) {
          const colNow = performance.now();
          const colSpiders = 1 + ((rnd() * (webSize === 'thick' ? 4 : webSize === 'small' ? 1 : 3)) | 0);
          for (let si = 0; si < colSpiders; si++) {
            const base = rnd(), sideX = (rnd() - 0.5), spd = 0.00012 + rnd() * 0.0001;
            const cyc = (colNow * spd + base * 2) % 2, tri = cyc < 1 ? cyc : 2 - cyc, goingUp = cyc < 1;
            const t = 0.12 + tri * 0.72;
            this.drawTinySpider(cx + sideX * widthAt(t) * 0.7, footY - span * t, (2.1 + rnd() * 1.1) * (0.7 + sizeF * 0.4), goingUp ? 0 : Math.PI, '#2e2340', colNow * (0.01 + rnd() * 0.004));
          }
        }
        ctx.restore();
      },

      // V0.18.42: the web barrier that seals the boss-room entrance. A dense floor-to-ceiling
      // web wall that grows in over ~1.2s from sealedAt (animated), then holds until the
      // boss dies. Reads as an impassable curtain of silk.
      drawBossWebSeal(s, obj = {}) {
        ctx.save();
        const grow = Math.max(0, Math.min(1, (performance.now() - (obj.sealedAt || 0)) / 1200));
        const cx = s.x, footY = s.y + 6;
        // V0.18.45: floor-to-ceiling and wide enough that neighbouring seal tiles overlap
        // into one continuous giant web across the whole entrance.
        const topY = footY - (168 * grow);
        const halfW = 32;
        let stt = ((obj._propSeed || 1) >>> 0) || 1;
        const rnd = () => { stt = (stt * 1664525 + 1013904223) >>> 0; return stt / 4294967296; };
        // 1) translucent silk sheet filling the doorway
        const g = ctx.createLinearGradient(0, topY, 0, footY);
        g.addColorStop(0, 'rgba(226,216,246,0.34)');
        g.addColorStop(1, 'rgba(200,190,220,0.5)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(cx - halfW, footY); ctx.lineTo(cx - halfW * 0.82, topY);
        ctx.lineTo(cx + halfW * 0.82, topY); ctx.lineTo(cx + halfW, footY); ctx.closePath();
        ctx.fill();
        // 2) vertical drape strands
        ctx.strokeStyle = 'rgba(236,228,248,0.7)'; ctx.lineCap = 'round';
        for (let i = 0; i <= 15; i++) {
          const t = i / 15;
          const bx = cx - halfW + t * halfW * 2;
          const tx = cx - halfW * 0.82 + t * halfW * 1.64;
          ctx.lineWidth = 0.8 + rnd() * 1.4;
          ctx.beginPath(); ctx.moveTo(bx, footY); ctx.quadraticCurveTo((bx + tx) * 0.5 + (rnd() - 0.5) * 5, (footY + topY) * 0.5, tx, topY); ctx.stroke();
        }
        // 3) horizontal web rungs (woven mesh) + a big orb web in the middle
        ctx.strokeStyle = 'rgba(226,216,246,0.5)'; ctx.lineWidth = 0.8;
        for (let r = 1; r <= 8; r++) {
          const yy = footY + (topY - footY) * (r / 9);
          const w = halfW * (1 - (r / 9) * 0.18);
          ctx.beginPath(); ctx.moveTo(cx - w, yy); ctx.quadraticCurveTo(cx, yy + 3, cx + w, yy); ctx.stroke();
        }
        if (grow > 0.5) {
          const hy = (footY + topY) * 0.5;
          ctx.globalAlpha = 0.55; ctx.lineWidth = 0.7;
          for (let ring = 1; ring <= 3; ring++) { ctx.beginPath(); ctx.ellipse(cx, hy, ring * 5, ring * 6.5, 0, 0, Math.PI * 2); ctx.stroke(); }
          for (let sp = 0; sp < 8; sp++) { const a = sp * Math.PI / 4; ctx.beginPath(); ctx.moveTo(cx, hy); ctx.lineTo(cx + Math.cos(a) * 15, hy + Math.sin(a) * 19); ctx.stroke(); }
        }
        ctx.restore();
      },

      // ---- V0.18.46: recognizable bone primitives, reused by webbed bone piles, the
      // junk pile and web columns. Bright bone-ivory with dark hollows so they read as
      // ACTUAL bones (skull with eye sockets + jaw + teeth, knob-ended femurs, a ribbed
      // spine) rather than pale blobs. All draw in the current ctx transform.
      drawBoneSkull(cx, cy, r, ang = 0) {
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(ang);
        ctx.lineJoin = 'round';
        // cranium dome
        ctx.fillStyle = '#e9e2ce';
        ctx.strokeStyle = 'rgba(92,82,64,0.5)'; ctx.lineWidth = Math.max(0.5, r * 0.08);
        ctx.beginPath(); ctx.ellipse(0, -r * 0.12, r, r * 0.94, 0, Math.PI * 0.92, Math.PI * 2.08); ctx.closePath(); ctx.fill(); ctx.stroke();
        // jaw / lower face
        ctx.fillStyle = '#ddd4bd';
        ctx.beginPath(); ctx.moveTo(-r * 0.62, r * 0.18); ctx.quadraticCurveTo(0, r * 0.98, r * 0.62, r * 0.18); ctx.closePath(); ctx.fill();
        // teeth
        ctx.strokeStyle = 'rgba(92,82,64,0.5)'; ctx.lineWidth = Math.max(0.4, r * 0.06);
        for (let t = -2; t <= 2; t++) { ctx.beginPath(); ctx.moveTo(t * r * 0.2, r * 0.5); ctx.lineTo(t * r * 0.2, r * 0.74); ctx.stroke(); }
        // eye sockets
        ctx.fillStyle = 'rgba(22,16,26,0.86)';
        ctx.beginPath(); ctx.ellipse(-r * 0.42, -r * 0.08, r * 0.3, r * 0.36, 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(r * 0.42, -r * 0.08, r * 0.3, r * 0.36, -0.2, 0, Math.PI * 2); ctx.fill();
        // nasal cavity
        ctx.beginPath(); ctx.moveTo(0, r * 0.08); ctx.lineTo(-r * 0.14, r * 0.42); ctx.lineTo(r * 0.14, r * 0.42); ctx.closePath(); ctx.fill();
        // dome highlight
        ctx.fillStyle = 'rgba(255,252,240,0.5)';
        ctx.beginPath(); ctx.ellipse(-r * 0.28, -r * 0.5, r * 0.3, r * 0.2, -0.4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      },

      drawBoneFemur(cx, cy, len, ang = 0, w = 3) {
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(ang);
        ctx.lineCap = 'round';
        // shaft (slightly bowed)
        ctx.strokeStyle = '#e4dcc6'; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.quadraticCurveTo(0, -w * 0.6, len / 2, 0); ctx.stroke();
        // knobbed epiphyses (two lobes at each end -> classic bone ends)
        ctx.fillStyle = '#ece5d0'; ctx.strokeStyle = 'rgba(92,82,64,0.4)'; ctx.lineWidth = 0.5;
        for (const sgn of [-1, 1]) {
          const ex = sgn * len / 2;
          ctx.beginPath(); ctx.arc(ex, -w * 0.75, w * 0.92, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.arc(ex, w * 0.75, w * 0.92, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        // shaft highlight
        ctx.strokeStyle = 'rgba(255,252,240,0.4)'; ctx.lineWidth = w * 0.32;
        ctx.beginPath(); ctx.moveTo(-len / 2 + 2, -w * 0.25); ctx.quadraticCurveTo(0, -w * 0.75, len / 2 - 2, -w * 0.25); ctx.stroke();
        ctx.restore();
      },

      drawBoneRibs(cx, cy, scale, ang = 0) {
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(ang);
        ctx.strokeStyle = '#e0d8c2'; ctx.lineCap = 'round';
        // spine
        ctx.lineWidth = scale * 0.9;
        ctx.beginPath(); ctx.moveTo(0, -scale * 3); ctx.lineTo(0, scale * 3); ctx.stroke();
        // ribs curving off both sides of the spine
        ctx.lineWidth = scale * 0.6;
        for (let i = 0; i < 4; i++) {
          const yy = -scale * 2.1 + i * scale * 1.35;
          const rl = scale * (2.5 - i * 0.28);
          ctx.beginPath(); ctx.moveTo(0, yy); ctx.quadraticCurveTo(-rl, yy + scale * 0.4, -rl * 0.65, yy + scale * 1.35); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, yy); ctx.quadraticCurveTo(rl, yy + scale * 0.4, rl * 0.65, yy + scale * 1.35); ctx.stroke();
        }
        ctx.restore();
      },

      // a cluster of recognizable bones sitting on the ground at (cx, by)
      drawBonesCluster(cx, by, scale, rnd, big = false) {
        // crossed femurs at the base
        this.drawBoneFemur(cx - 3 * scale, by, 20 * scale, 0.5 + (rnd() - 0.5) * 0.3, 3 * scale);
        this.drawBoneFemur(cx + 3 * scale, by, 20 * scale, -0.5 + (rnd() - 0.5) * 0.3, 3 * scale);
        if (big) {
          this.drawBoneRibs(cx - 10 * scale, by - 1 * scale, 2.4 * scale, 0.25);
          this.drawBoneFemur(cx + 7 * scale, by - 5 * scale, 16 * scale, 1.15, 2.5 * scale);
        }
        // skull on top
        this.drawBoneSkull(cx + (rnd() - 0.5) * 4 * scale, by - 6 * scale, 6.5 * scale, (rnd() - 0.5) * 0.35);
        if (big) this.drawBoneSkull(cx - 12 * scale, by + 2 * scale, 4.4 * scale, -0.5);
      },

      // a dense woven web nest bulging inside a thick ceiling web (V0.18.46) - a funnel/orb
      // of concentric rings + radial spokes with a dark hollow mouth and clustered egg sacs.
      drawWebNest(cx, cy, r, silkRGB, rnd) {
        ctx.save();
        ctx.lineCap = 'round';
        // filled silk bulb
        const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.15);
        g.addColorStop(0, `rgba(${silkRGB},0.52)`);
        g.addColorStop(0.7, `rgba(${silkRGB},0.28)`);
        g.addColorStop(1, `rgba(${silkRGB},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 1.15, 0, 0, Math.PI * 2); ctx.fill();
        // concentric woven rings
        ctx.strokeStyle = `rgba(${silkRGB},0.62)`; ctx.lineWidth = 0.7;
        for (let ring = 1; ring <= 5; ring++) { const rr = r * ring / 5.2; ctx.beginPath(); ctx.ellipse(cx, cy, rr, rr * 1.12, 0, 0, Math.PI * 2); ctx.stroke(); }
        // radial spokes
        ctx.lineWidth = 0.6;
        for (let sp = 0; sp < 11; sp++) { const a = sp * (Math.PI * 2 / 11); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 1.12); ctx.stroke(); }
        // dark hollow mouth (the funnel the spider lurks in)
        const hole = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.3);
        hole.addColorStop(0, 'rgba(12,8,18,0.6)'); hole.addColorStop(1, 'rgba(12,8,18,0)');
        ctx.fillStyle = hole; ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.3, r * 0.34, 0, 0, Math.PI * 2); ctx.fill();
        // egg sacs clustered on the nest
        ctx.fillStyle = `rgba(238,230,248,0.85)`;
        for (let e = 0; e < 4; e++) { const a = rnd() * Math.PI * 2, rr = r * (0.5 + rnd() * 0.42); ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 1.1, r * 0.13, r * 0.17, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      },

      // V0.18.46: a pile of recognizable bones on the ground, heavily wrapped in webbing.
      // bonePileSize 'large' | 'small'. Reinforces "people die here".
      drawWebbedBonePile(s, obj = {}) {
        ctx.save();
        const big = obj.bonePileSize === 'large' || obj.big === true;
        const scale = big ? 1 : 0.6;
        this.drawPropContactShadow?.(s, big ? 30 : 20, big ? 10 : 7, 0.3);
        let st = ((obj._propSeed || (Math.floor(obj.x || 0) * 374761 + Math.floor(obj.y || 0) * 668265 + 7)) >>> 0) || 1; // V0.18.56: position-seed so piles vary
        const rnd = () => { st = (st * 1664525 + 1013904223) >>> 0; return st / 4294967296; };
        const cx = s.x, by = s.y;
        // 1) low silk-caked mound the bones are half-sunk into
        const mound = ctx.createRadialGradient(cx - 4, by - 6 * scale, 3, cx, by, 32 * scale);
        mound.addColorStop(0, 'rgba(228,220,242,0.82)');
        mound.addColorStop(0.6, 'rgba(198,188,214,0.66)');
        mound.addColorStop(1, 'rgba(150,142,168,0.36)');
        ctx.fillStyle = mound;
        ctx.beginPath(); ctx.ellipse(cx, by, 30 * scale, 12 * scale, 0, 0, Math.PI * 2); ctx.fill();
        // 2) the bones (before the wrap, so silk lies OVER them)
        this.drawBonesCluster(cx, by, scale, rnd, big);
        // 3) heavy webbing wrapping the bones (vertical strands + horizontal binds)
        ctx.strokeStyle = 'rgba(238,230,250,0.62)'; ctx.lineCap = 'round';
        const strands = big ? 12 : 7;
        for (let i = 0; i < strands; i++) {
          const x0 = cx - 26 * scale + i * (52 * scale / (strands - 1));
          ctx.lineWidth = 0.7 + rnd() * 1.1;
          ctx.beginPath(); ctx.moveTo(x0, by + 6 * scale); ctx.quadraticCurveTo(x0 + (rnd() - 0.5) * 8, by - 13 * scale, x0 + (rnd() - 0.5) * 6, by - 20 * scale); ctx.stroke();
        }
        ctx.globalAlpha = 0.5;
        for (let i = 0; i < 4; i++) { const yy = by - i * 5 * scale; ctx.beginPath(); ctx.moveTo(cx - 26 * scale, yy); ctx.quadraticCurveTo(cx, yy - 3, cx + 28 * scale, yy - 2); ctx.stroke(); }
        // 4) a few bright silk junction nodes where the binds cross
        ctx.globalAlpha = 0.8; ctx.fillStyle = 'rgba(248,244,255,0.8)';
        for (let i = 0; i < (big ? 5 : 3); i++) { ctx.beginPath(); ctx.arc(cx - 18 * scale + rnd() * 36 * scale, by - rnd() * 16 * scale, 0.9, 0, Math.PI * 2); ctx.fill(); }
        // 5) V0.18.55: tiny spiders crawling over the bones (animated)
        ctx.globalAlpha = 1;
        const bNow = performance.now();
        for (let si = 0; si < (big ? 3 : 2); si++) {
          const b = rnd(), cyc = (bNow * 0.00016 + b * 2) % 2, tri = cyc < 1 ? cyc : 2 - cyc;
          this.drawTinySpider(cx - 24 * scale + tri * 48 * scale, by - 4 * scale - Math.sin(tri * Math.PI) * 10 * scale, (2.2 + rnd()) * scale, cyc < 1 ? Math.PI / 2 : -Math.PI / 2, '#2e2340', bNow * (0.012 + rnd() * 0.004));
        }
        ctx.restore();
      },

      // V0.18.41: a big pile of webbing with a victim's junk cocooned in it - a shield,
      // a sword, and a bone or two poking out of the silk. "The spiders keep trophies."
      drawWebJunkPile(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 30, 10, 0.32);
        let st = ((obj._propSeed || (Math.floor(obj.x || 0) * 374761 + Math.floor(obj.y || 0) * 668265 + 11)) >>> 0) || 1; // V0.18.56: position-seed so piles vary
        const rnd = () => { st = (st * 1664525 + 1013904223) >>> 0; return st / 4294967296; };
        const cx = s.x, by = s.y;
        // 1) the web mound
        const mound = ctx.createRadialGradient(cx - 6, by - 12, 4, cx, by - 4, 34);
        mound.addColorStop(0, 'rgba(230,222,244,0.9)');
        mound.addColorStop(0.6, 'rgba(200,190,216,0.8)');
        mound.addColorStop(1, 'rgba(150,142,168,0.55)');
        ctx.fillStyle = mound;
        ctx.beginPath();
        ctx.moveTo(cx - 30, by + 4);
        ctx.quadraticCurveTo(cx - 26, by - 26, cx - 4, by - 28);
        ctx.quadraticCurveTo(cx + 22, by - 30, cx + 30, by - 6);
        ctx.quadraticCurveTo(cx + 32, by + 6, cx, by + 8);
        ctx.quadraticCurveTo(cx - 22, by + 9, cx - 30, by + 4);
        ctx.closePath(); ctx.fill();
        // 2) junk poking out of the silk (drawn before the top web layer so webs wrap over)
        // shield
        ctx.save();
        ctx.translate(cx - 16, by - 10); ctx.rotate(-0.35);
        ctx.fillStyle = '#5a4632'; ctx.strokeStyle = '#2e2418'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.ellipse(0, 0, 8, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#8a6a3e'; ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        // sword (hilt + blade angled out of the pile)
        ctx.strokeStyle = '#8f959c'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx + 6, by - 4); ctx.lineTo(cx + 26, by - 30); ctx.stroke();
        ctx.strokeStyle = '#c8ccd2'; ctx.lineWidth = 1.0;
        ctx.beginPath(); ctx.moveTo(cx + 6, by - 4); ctx.lineTo(cx + 26, by - 30); ctx.stroke();
        ctx.strokeStyle = '#4a3320'; ctx.lineWidth = 3; // crossguard
        ctx.beginPath(); ctx.moveTo(cx + 2, by - 2); ctx.lineTo(cx + 12, by - 8); ctx.stroke();
        // V0.18.46: recognizable bones cocooned in the pile - a femur poking out and a
        // half-buried skull, drawn with the shared bone primitives instead of squiggles.
        this.drawBoneFemur(cx - 15, by - 6, 18, -0.7, 2.2);
        this.drawBoneSkull(cx + 12, by, 4.6, 0.15);
        // 3) web strands wrapping over the whole pile + junk
        ctx.strokeStyle = 'rgba(236,228,248,0.6)'; ctx.lineWidth = 1; ctx.lineCap = 'round';
        for (let i = 0; i < 10; i++) {
          const x0 = cx - 28 + i * 6 + rnd() * 3;
          ctx.beginPath();
          ctx.moveTo(x0, by + 6);
          ctx.quadraticCurveTo(x0 + (rnd() - 0.5) * 8, by - 22 - rnd() * 8, x0 + 6 + (rnd() - 0.5) * 6, by - 30);
          ctx.stroke();
        }
        ctx.globalAlpha = 0.5;
        for (let i = 0; i < 5; i++) { const yy = by - 4 - i * 5; ctx.beginPath(); ctx.moveTo(cx - 28, yy); ctx.quadraticCurveTo(cx, yy - 3, cx + 30, yy - 2); ctx.stroke(); }
        // anchor threads up to the ceiling
        ctx.globalAlpha = 0.4;
        for (let i = 0; i < 3; i++) { const ax = cx - 14 + i * 14; ctx.beginPath(); ctx.moveTo(ax, by - 26); ctx.lineTo(ax + (rnd() - 0.5) * 20, by - 70 - rnd() * 20); ctx.stroke(); }
        // V0.18.55: tiny spiders crawling over the pile (animated)
        ctx.globalAlpha = 1;
        const jNow = performance.now();
        for (let si = 0; si < 2; si++) {
          const b = rnd(), cyc = (jNow * 0.00016 + b * 2) % 2, tri = cyc < 1 ? cyc : 2 - cyc;
          this.drawTinySpider(cx - 24 + tri * 48, by - 4 - Math.sin(tri * Math.PI) * 14, 2.6, cyc < 1 ? Math.PI / 2 : -Math.PI / 2, '#2e2340', jNow * (0.012 + rnd() * 0.004));
        }
        ctx.restore();
      },

      // V0.18.48: a tiny top-down spider silhouette (round abdomen + head + 8 splayed legs).
      // Used crawling on the giant nests and as ground clutter. r ~ body radius (2-8px).
      drawTinySpider(cx, cy, r, ang = 0, color = '#2e2340', walkPhase = 0) {
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(ang);
        ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(0.5, r * 0.26);
        // V0.18.54: 8 legs with a stepping walk gait - each leg swings fore/aft and lifts, out of
        // phase with its neighbours (alternating tetrapod), so the spider reads as CRAWLING rather
        // than sliding. walkPhase only advances while the spider is actually moving.
        let legIx = 0;
        for (let side = -1; side <= 1; side += 2) {
          for (let l = 0; l < 4; l++) {
            const t = (l - 1.5) * 0.5;
            const step = Math.sin(walkPhase + legIx * 1.9);
            const reach = 2.6 + step * 0.6;        // fore/aft swing of the foot
            const lift = Math.max(0, step) * 0.6;  // lift the foot on the forward swing
            const ex = side * r * reach, ey = t * r * 2.1 - lift * r;
            const mx = side * r * 1.3, my = t * r * 1.2 - r * 0.3 - lift * r * 0.5;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
            legIx++;
          }
        }
        const bob = Math.sin(walkPhase * 2) * r * 0.05;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.ellipse(0, r * 0.55 + bob, r * 0.9, r * 1.15, 0, 0, Math.PI * 2); ctx.fill(); // abdomen
        ctx.beginPath(); ctx.arc(0, -r * 0.55 + bob, r * 0.58, 0, Math.PI * 2); ctx.fill(); // cephalothorax
        ctx.fillStyle = 'rgba(216,200,242,0.45)';
        ctx.beginPath(); ctx.ellipse(0, r * 0.55 + bob, r * 0.3, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      },

      // V0.18.55: a body cocooned in silk, hanging in a web. silkP = 'rgba(r,g,b,' prefix.
      drawWebCocoon(cx, cy, len, w, silkP, rnd) {
        ctx.save();
        ctx.lineCap = 'round';
        // hanging thread up into the web
        ctx.strokeStyle = silkP + '0.5)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(cx, cy - len * 0.5 - 16); ctx.lineTo(cx + (rnd() - 0.5) * 3, cy - len * 0.5); ctx.stroke();
        // the silk-wrapped body: a bulge near the top (torso/head) tapering toward the feet
        const grad = ctx.createLinearGradient(cx - w, 0, cx + w, 0);
        grad.addColorStop(0, silkP + '0.5)'); grad.addColorStop(0.5, silkP + '0.92)'); grad.addColorStop(1, silkP + '0.55)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(cx, cy - len * 0.5);
        ctx.bezierCurveTo(cx - w * 1.35, cy - len * 0.32, cx - w, cy + len * 0.2, cx - w * 0.42, cy + len * 0.5);
        ctx.quadraticCurveTo(cx, cy + len * 0.6, cx + w * 0.42, cy + len * 0.5);
        ctx.bezierCurveTo(cx + w, cy + len * 0.2, cx + w * 1.35, cy - len * 0.32, cx, cy - len * 0.5);
        ctx.closePath(); ctx.fill();
        // horizontal wrap bands
        ctx.strokeStyle = silkP + '0.55)'; ctx.lineWidth = 0.8;
        for (let i = 0; i <= 6; i++) {
          const t = i / 6, yy = cy - len * 0.45 + t * len * 0.9, ww = w * (0.5 + Math.sin(t * Math.PI) * 0.72);
          ctx.beginPath(); ctx.moveTo(cx - ww, yy); ctx.quadraticCurveTo(cx, yy + 1.5, cx + ww, yy); ctx.stroke();
        }
        // a dark gap where a face / limb shows through the wrapping
        ctx.fillStyle = 'rgba(18,12,24,0.5)';
        ctx.beginPath(); ctx.ellipse(cx + (rnd() - 0.5) * w * 0.5, cy - len * 0.18, w * 0.3, len * 0.1, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      },

      // V0.18.48: a real cave stalagmite. obj.size 'small' | 'large' | 'column' (a floor-to-
      // ceiling stalagmite+stalactite column); obj.webbed drapes it in silk.
      drawCaveStalagmite(s, obj = {}) {
        ctx.save();
        let st = ((obj._propSeed || (Math.floor(obj.x || 0) * 374761 + Math.floor(obj.y || 0) * 668265 + 23)) >>> 0) || 1; // position-seed so stalagmites vary
        const rnd = () => { st = (st * 1664525 + 1013904223) >>> 0; return st / 4294967296; };
        const cx = s.x;
        const base = obj.color || '#78715f', dark = obj.color ? base : '#59533f', light = obj.color ? base : '#98917b';
        // V0.18.59: five size tiers (xs/small/medium/large/xl) + 'column', for both ground
        // stalagmites and ceiling stalactites (obj.hang).
        const hang = obj.hang === true || obj.size === 'stalactite';
        const size = obj.size === 'column' ? 'column' : (['xs', 'small', 'medium', 'large', 'xl'].includes(obj.size) ? obj.size : 'small');
        const HW = { xs: 5, small: 8, medium: 11, large: 15, xl: 21, column: 13 }[size];
        const H_UP = { xs: 14, small: 28, medium: 44, large: 64, xl: 92, column: 92 }[size];
        const H_DN = { xs: 22, small: 40, medium: 60, large: 86, xl: 120, column: 90 }[size];
        // a tapered spike from a wide base (footY, ±hw) to a point (tipY). Works up or down.
        const spike = (footY, tipY, hw, webbed) => {
          const bulge = (rnd() - 0.5) * hw * 0.4, dh = footY - tipY;
          ctx.fillStyle = base;
          ctx.beginPath(); ctx.moveTo(cx - hw, footY); ctx.quadraticCurveTo(cx - hw * 0.5 + bulge, (footY + tipY) / 2, cx + bulge, tipY);
          ctx.quadraticCurveTo(cx + hw * 0.5 + bulge, (footY + tipY) / 2, cx + hw, footY); ctx.closePath(); ctx.fill();
          ctx.fillStyle = dark;
          ctx.beginPath(); ctx.moveTo(cx + bulge, tipY); ctx.quadraticCurveTo(cx + hw * 0.55 + bulge, (footY + tipY) / 2, cx + hw, footY); ctx.lineTo(cx + bulge * 0.5, footY); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = light; ctx.lineWidth = 2; ctx.globalAlpha = 0.7;
          ctx.beginPath(); ctx.moveTo(cx - hw * 0.3, footY); ctx.quadraticCurveTo(cx - hw * 0.2 + bulge, (footY + tipY) / 2, cx + bulge, tipY); ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(40,36,28,0.3)'; ctx.lineWidth = 1;
          for (let b = 1; b <= 3; b++) { const yy = footY - dh * b / 4, w = hw * (1 - b / 4) * 0.9; ctx.beginPath(); ctx.moveTo(cx - w, yy); ctx.quadraticCurveTo(cx, yy + (dh > 0 ? 2 : -2), cx + w, yy); ctx.stroke(); }
          if (webbed) {
            ctx.strokeStyle = 'rgba(224,214,244,0.5)'; ctx.lineCap = 'round'; ctx.lineWidth = 0.8;
            for (let i = 0; i < 6; i++) { const yy = footY - rnd() * dh, w = hw * 1.4; ctx.beginPath(); ctx.moveTo(cx - w, yy); ctx.quadraticCurveTo(cx, yy + 4, cx + w, yy - 3); ctx.stroke(); }
            ctx.beginPath(); ctx.moveTo(cx, tipY); ctx.quadraticCurveTo(cx - hw, tipY + dh * 0.4, cx - hw * 1.6, footY - dh * 0.06); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx, tipY); ctx.quadraticCurveTo(cx + hw, tipY + dh * 0.4, cx + hw * 1.6, footY - dh * 0.06); ctx.stroke();
            ctx.fillStyle = 'rgba(224,214,244,0.55)'; ctx.beginPath(); ctx.ellipse(cx + bulge, tipY + (dh > 0 ? 3 : -3), hw * 0.8, 4, 0, 0, Math.PI * 2); ctx.fill();
          }
        };
        if (hang) {
          // ceiling stalactite pointing DOWN
          const ceilY = s.y - 198 + rnd() * 28, len = H_DN;
          spike(ceilY, ceilY + len, HW, obj.webbed);
        } else {
          const by = s.y + 4;
          this.drawPropContactShadow?.(s, HW + 8, HW * 0.55 + 3, 0.28);
          spike(by, by - H_UP, HW, obj.webbed && size !== 'column');
          if (size === 'column') spike(by - 198, by - H_UP - 10, HW, obj.webbed); // meeting stalactite
        }
        ctx.restore();
      },

      // V0.18.48: a small scatter of cave rocks/pebbles (obj.webbed optional).
      drawCaveRocks(s, obj = {}) {
        ctx.save();
        let st = ((obj._propSeed || 1) >>> 0) || 1;
        const rnd = () => { st = (st * 1664525 + 1013904223) >>> 0; return st / 4294967296; };
        this.drawPropContactShadow?.(s, 18, 6, 0.22);
        const cols = ['#7c7566', '#6b6455', '#857d6b'];
        const n = 2 + (rnd() * 3 | 0);
        for (let i = 0; i < n; i++) {
          const rx = s.x + (rnd() - 0.5) * 26, ry = s.y + (rnd() - 0.5) * 8, r = 4 + rnd() * 7;
          ctx.fillStyle = cols[(rnd() * 3) | 0];
          ctx.beginPath(); ctx.ellipse(rx, ry, r, r * 0.78, (rnd() - 0.5) * 0.6, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,250,235,0.18)';
          ctx.beginPath(); ctx.ellipse(rx - r * 0.25, ry - r * 0.32, r * 0.6, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(20,18,14,0.22)';
          ctx.beginPath(); ctx.ellipse(rx, ry + r * 0.5, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
        }
        if (obj.webbed) {
          ctx.strokeStyle = 'rgba(224,214,244,0.45)'; ctx.lineWidth = 0.7; ctx.lineCap = 'round';
          for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(s.x - 16 + rnd() * 32, s.y - 6); ctx.quadraticCurveTo(s.x, s.y + 2, s.x - 16 + rnd() * 32, s.y + 8); ctx.stroke(); }
        }
        ctx.restore();
      },

      // V0.18.48: a REALLY large spider nest - a domed silk mass with a dark mouth (a big
      // spider lurking inside, eyes glowing), egg sacs, and tiny spiders crawling all over it.
      drawGiantSpiderNest(s, obj = {}) {
        ctx.save();
        let st = ((obj._propSeed || (Math.floor(obj.x || 0) * 374761 + Math.floor(obj.y || 0) * 668265 + 13)) >>> 0) || 1; // V0.18.56: position-seed so nests vary
        const rnd = () => { st = (st * 1664525 + 1013904223) >>> 0; return st / 4294967296; };
        const royal = obj.royal === true || Number(obj.floor) >= 3;
        const silk = royal ? '255,190,238' : '226,216,246';
        const cx = s.x, by = s.y + 6, R = 46;
        this.drawPropContactShadow?.(s, R * 0.9, R * 0.4, 0.34);
        // anchor strands up into the dark
        ctx.strokeStyle = `rgba(${silk},0.4)`; ctx.lineCap = 'round'; ctx.lineWidth = 1;
        for (let i = 0; i < 7; i++) { const a = -Math.PI * 0.5 + (i - 3) * 0.32; ctx.beginPath(); ctx.moveTo(cx, by - R * 0.9); ctx.lineTo(cx + Math.cos(a) * R * 2 + (rnd() - 0.5) * 20, by - R * 1.5 + Math.sin(a) * R * 1.4); ctx.stroke(); }
        // the big silk mound
        const mound = ctx.createRadialGradient(cx - R * 0.3, by - R * 0.8, R * 0.2, cx, by - R * 0.4, R * 1.3);
        mound.addColorStop(0, `rgba(${silk},0.95)`); mound.addColorStop(0.6, `rgba(${silk},0.8)`); mound.addColorStop(1, `rgba(${silk},0.4)`);
        ctx.fillStyle = mound;
        ctx.beginPath();
        ctx.moveTo(cx - R, by);
        ctx.bezierCurveTo(cx - R * 1.1, by - R * 1.2, cx - R * 0.4, by - R * 1.7, cx, by - R * 1.7);
        ctx.bezierCurveTo(cx + R * 0.5, by - R * 1.7, cx + R * 1.1, by - R * 1.1, cx + R, by);
        ctx.bezierCurveTo(cx + R * 0.6, by + R * 0.28, cx - R * 0.6, by + R * 0.28, cx - R, by);
        ctx.closePath(); ctx.fill();
        // woven layers over the mound
        const wy = by - R * 0.55;
        ctx.strokeStyle = `rgba(${silk},0.55)`; ctx.lineWidth = 0.8;
        for (let ring = 1; ring <= 6; ring++) { ctx.beginPath(); ctx.ellipse(cx, wy, R * ring / 6.5, R * 0.92 * ring / 6.5, 0, Math.PI * 0.08, Math.PI * 1.92); ctx.stroke(); }
        for (let sp = 0; sp < 12; sp++) { const a = sp * (Math.PI * 2 / 12); ctx.beginPath(); ctx.moveTo(cx, wy); ctx.lineTo(cx + Math.cos(a) * R * 0.98, wy + Math.sin(a) * R * 0.85); ctx.stroke(); }
        // dark hollow mouth
        const hole = ctx.createRadialGradient(cx, wy, 2, cx, wy, R * 0.5);
        hole.addColorStop(0, 'rgba(8,5,12,0.92)'); hole.addColorStop(1, 'rgba(8,5,12,0)');
        ctx.fillStyle = hole; ctx.beginPath(); ctx.ellipse(cx, wy, R * 0.42, R * 0.5, 0, 0, Math.PI * 2); ctx.fill();
        // the big spider lurking in the mouth + glowing eyes
        this.drawTinySpider(cx, wy + 3, 8.5, 0, '#241a2b');
        ctx.fillStyle = royal ? '#ff7de0' : '#c59bff';
        ctx.beginPath(); ctx.arc(cx - 3.2, wy - 2, 1.4, 0, Math.PI * 2); ctx.arc(cx + 3.2, wy - 2, 1.4, 0, Math.PI * 2); ctx.fill();
        // egg sacs clustered on the nest
        ctx.fillStyle = `rgba(${silk},0.9)`;
        for (let e = 0; e < 6; e++) { const a = rnd() * Math.PI * 2, rr = R * (0.55 + rnd() * 0.4); ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * rr, wy + Math.sin(a) * rr * 0.8, 4 + rnd() * 2, 5 + rnd() * 3, 0, 0, Math.PI * 2); ctx.fill(); }
        // tiny spiders SLOWLY crawling all over it (V0.18.51: animated via time - each orbits
        // the nest at its own slow speed with a little radial breathing, so the nest looks alive)
        const nestNow = performance.now();
        for (let t = 0; t < 8; t++) {
          const a0 = rnd() * Math.PI * 2, rr = R * (0.34 + rnd() * 0.6), dir = rnd() < 0.5 ? -1 : 1;
          // V0.18.52: ~4x faster so they visibly crawl.
          const sp = 0.0002 + rnd() * 0.00024, sz = 2.2 + rnd() * 1.5;
          const wob = 1 + Math.sin(nestNow * 0.0013 + a0 * 3) * 0.07;
          const a = a0 + nestNow * sp * dir;
          this.drawTinySpider(cx + Math.cos(a) * rr * wob, wy + Math.sin(a) * rr * 0.82 * wob, sz, a + dir * Math.PI / 2, '#2e2340', nestNow * 0.011 + a0 * 5);
        }
        ctx.restore();
      },

      // V0.18.57: a MASSIVE floor-to-ceiling web lair - everything at once: a giant woven sheet,
      // many orb webs, multiple web nests, tons of crawling spiders, lots of eggs, bones,
      // cocooned bodies, and webbed stalagmite columns inside it. One per floor.
      drawGiantWebLair(s, obj = {}) {
        ctx.save();
        let st = ((obj._propSeed || (Math.floor(obj.x || 0) * 374761 + Math.floor(obj.y || 0) * 668265 + 17)) >>> 0) || 1;
        const rnd = () => { st = (st * 1664525 + 1013904223) >>> 0; return st / 4294967296; };
        const royal = obj.royal === true || Number(obj.floor) >= 3;
        const silk = royal ? 'rgba(255,178,236,' : 'rgba(224,214,244,';
        const silkRGB = royal ? '255,190,238' : '226,216,246';
        const cx = s.x, footY = s.y, H = 300, halfW = 132, topY = footY - H, now = performance.now();
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        this.drawPropContactShadow?.(s, halfW * 0.72, halfW * 0.3, 0.36);
        const widthAt = (t) => halfW * (0.7 + 0.3 * Math.sin(Math.max(0, Math.min(1, t)) * Math.PI));
        // 0) huge translucent silk sheet
        ctx.globalAlpha = 0.5;
        const sheet = ctx.createLinearGradient(0, topY, 0, footY);
        sheet.addColorStop(0, silk + '0)'); sheet.addColorStop(0.5, silk + '0.14)'); sheet.addColorStop(1, silk + '0.3)');
        ctx.fillStyle = sheet;
        ctx.beginPath();
        for (let i = 0; i <= 10; i++) { const t = i / 10; ctx.lineTo(cx - widthAt(t), footY - H * t); }
        for (let i = 10; i >= 0; i--) { const t = i / 10; ctx.lineTo(cx + widthAt(t), footY - H * t); }
        ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
        // 1) sagging vertical scaffold strands + horizontal capture threads
        ctx.strokeStyle = silk + (royal ? 0.5 : 0.42) + ')'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 11; i++) {
          const k = (i / 10 - 0.5); let px = cx + k * halfW * 1.4, py = footY; ctx.moveTo(px, py);
          for (let seg = 1; seg <= 4; seg++) { const t = seg / 4, nx = cx + k * widthAt(t) * 1.9 + (rnd() - 0.5) * 10, ny = footY - H * t; ctx.quadraticCurveTo((px + nx) / 2 + (rnd() - 0.5) * 8, (py + ny) / 2, nx, ny); px = nx; py = ny; }
        }
        ctx.stroke();
        ctx.strokeStyle = silk + (royal ? 0.42 : 0.34) + ')'; ctx.lineWidth = 1;
        for (let r = 1; r <= 8; r++) { const t = r / 9, yy = footY - H * t, w = widthAt(t); ctx.beginPath(); ctx.moveTo(cx - w, yy); ctx.quadraticCurveTo(cx + (rnd() - 0.5) * w * 0.4, yy + 14 + rnd() * 12, cx + w, yy); ctx.stroke(); }
        // 2) webbed stalagmite columns INSIDE the lair (drawn first, behind the web mesh)
        for (let scI = 0; scI < 3; scI++) this.drawCaveStalagmite({ x: cx + (scI - 1) * halfW * 0.62 + (rnd() - 0.5) * 16, y: footY }, { size: scI === 1 ? 'column' : 'large', webbed: true, _propSeed: (st ^ (scI * 7919)) >>> 0 });
        // 3) MANY big orb webs
        for (let o = 0; o < 7; o++) { const t = 0.15 + rnd() * 0.7; this.drawOrbWeb(cx + (rnd() - 0.5) * halfW * 1.2, footY - H * t, 26 + rnd() * 26, silk, (royal ? 0.5 : 0.44), rnd, 0.92); }
        // 4) MULTIPLE web nests
        for (let n = 0; n < 3; n++) { const t = 0.35 + rnd() * 0.45; this.drawWebNest(cx + (rnd() - 0.5) * halfW * 1.1, footY - H * t, 20 + rnd() * 14, silkRGB, rnd); }
        // 5) LOTS of egg sacs
        ctx.fillStyle = 'rgba(224,214,240,0.85)';
        for (let e = 0; e < 24; e++) { const t = 0.18 + rnd() * 0.72, w = widthAt(t); ctx.beginPath(); ctx.ellipse(cx + (rnd() - 0.5) * w * 1.7, footY - H * t, 4 + rnd() * 3, 5 + rnd() * 4, 0, 0, Math.PI * 2); ctx.fill(); }
        // 6) lots of bones + cocooned bodies
        for (let b = 0; b < 6; b++) this.drawBonesCluster(cx + (rnd() - 0.5) * halfW * 1.6, footY + 2 - rnd() * 8, 0.5 + rnd() * 0.4, rnd, rnd() > 0.5);
        for (let cbi = 0; cbi < 5; cbi++) { const t = 0.25 + rnd() * 0.5; this.drawWebCocoon(cx + (rnd() - 0.5) * halfW * 1.3, footY - H * t, 32 + rnd() * 20, 8 + rnd() * 4, silk, rnd); }
        // 7) TONS of tiny spiders crawling all over it (animated)
        for (let sp = 0; sp < 26; sp++) {
          const base = rnd(), sideX = (rnd() - 0.5) * 1.7, spd = 0.0001 + rnd() * 0.00012;
          const cyc = (now * spd + base * 2) % 2, tri = cyc < 1 ? cyc : 2 - cyc, goingUp = cyc < 1, t = 0.08 + tri * 0.82;
          this.drawTinySpider(cx + sideX * widthAt(t), footY - H * t, 2.4 + rnd() * 1.8, goingUp ? 0 : Math.PI, '#2e2340', now * (0.01 + rnd() * 0.004));
        }
        // 8) a big matriarch spider lurking in the centre, eyes aglow
        this.drawTinySpider(cx, footY - H * 0.5, 13, 0, '#241a2b', now * 0.008);
        ctx.fillStyle = royal ? '#ff7de0' : '#c59bff';
        ctx.beginPath(); ctx.arc(cx - 4.5, footY - H * 0.5 - 3.5, 1.9, 0, Math.PI * 2); ctx.arc(cx + 4.5, footY - H * 0.5 - 3.5, 1.9, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      },

      // V0.18.49: draw the decorative free-roaming floor spiders (game.silkCritters), in the
      // floor-overlay layer so party members visibly walk OVER them. Dead ones show a brief
      // squish splat before dungeonSystem.updateSilkCritters culls them.
      renderSilkCritters() {
        const critters = this.silkCritters;
        if (!Array.isArray(critters) || !critters.length) return;
        const cw = ctx.canvas?.width || 4096, ch = ctx.canvas?.height || 4096;
        // V0.18.53: use Date.now() to match c.deadAt (set with Date.now() in updateSilkCritters).
        // The old performance.now() here made (now - deadAt) hugely negative -> a negative 'k' ->
        // a NEGATIVE ellipse radius on the squish splat -> "CanvasRenderingContext2D.ellipse:
        // Negative radius" render fault when you stepped on a spider. Also clamp k defensively.
        const now = Date.now();
        for (const c of critters) {
          const scr = this.worldToScreen(c.x, c.y, 0);
          if (!scr || scr.x < -30 || scr.x > cw + 30 || scr.y < -30 || scr.y > ch + 30) continue;
          if (c.dead) {
            const k = Math.max(0, Math.min(1, (now - (c.deadAt || now)) / 420));
            ctx.save();
            ctx.globalAlpha = (1 - k) * 0.85;
            ctx.fillStyle = c.royal ? 'rgba(120,60,110,0.9)' : 'rgba(58,42,74,0.9)';
            ctx.beginPath(); ctx.ellipse(scr.x, scr.y, c.size * 1.7 * (0.7 + k * 0.5), c.size * 0.8 * (0.7 + k * 0.5), 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 0.7; ctx.lineCap = 'round';
            for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(scr.x, scr.y); ctx.lineTo(scr.x + Math.cos(a) * c.size * 2.6, scr.y + Math.sin(a) * c.size * 1.3); ctx.stroke(); }
            ctx.restore();
            continue;
          }
          const ang = Math.atan2(c.vy || 0, c.vx || 0) + Math.PI / 2;
          this.drawTinySpider(scr.x, scr.y, c.size, ang, c.royal ? '#4a2a48' : '#2e2340', c.walk || 0);
        }
      },

      // V0.18.59: darken the Silk Web Cavern like night + a slow layer of ground fog rolling
      // across. Screen-space overlay, drawn after the world (before the vignette).
      renderSilkCavernAtmosphere(ctx2) {
        const c = ctx2 || ctx; if (!c) return;
        const inSilk = this.currentZone === 'dungeon' &&
          ((this.dungeonSystem?.state?.active?.dungeonId === 'silk_web_cavern') || (this.activeDungeon?.dungeonId === 'silk_web_cavern') || (this.activeDungeon?.id === 'silk_web_cavern'));
        if (!inSilk) return;
        // V0.18.60: size the overlay in CSS pixels (window.innerWidth/Height), exactly like
        // drawVignette. Using canvas.width/height (device pixels) mismatched the dpr-scaled ctx
        // transform, so the darkness didn't cover the whole screen when zoomed.
        const w = window.innerWidth, h = window.innerHeight, now = performance.now();
        c.save();
        // 1) night darkening: a cool dark tint + a radial vignette so the cave feels enclosed.
        // V0.18.64: darker than before so the cave genuinely reads as pitch-black away from any
        // light, which makes the torch pools (drawn next) actually read as light.
        c.fillStyle = 'rgba(6,5,14,0.52)';
        c.fillRect(0, 0, w, h);
        const vig = c.createRadialGradient(w * 0.5, h * 0.52, Math.min(w, h) * 0.20, w * 0.5, h * 0.52, Math.max(w, h) * 0.72);
        vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(2,1,7,0.66)');
        c.fillStyle = vig; c.fillRect(0, 0, w, h);
        // V0.18.64: LIGHT PASS. Torches (registered in this._silkFrameLights during their draw) and
        // the player project real warm light THROUGH the darkness. Drawn additively ('lighter')
        // AFTER the darkening, so each light punches a warm, flickering pool out of the black - the
        // torch's own tiny on-prop glow was painted before this overlay and got covered, which is
        // why torches looked unlit. Positions are unzoomed screen space -> project with the live
        // camera zoom so the pools track pan/zoom exactly.
        const proj = this.getCameraProjectionCache?.() || {};
        const zoom = Number(proj.zoom) || 1;
        const hw = Number.isFinite(proj.halfWidth) ? proj.halfWidth : w * 0.5;
        const hh = Number.isFinite(proj.halfHeight) ? proj.halfHeight : h * 0.5;
        const toScreenX = ux => hw + (ux - hw) * zoom;
        const toScreenY = uy => hh + (uy - hh) * zoom;
        const paintLight = (sx, sy, radius, core, mid, coreA, midA) => {
          if (sx < -radius || sy < -radius || sx > w + radius || sy > h + radius) return;
          const g = c.createRadialGradient(sx, sy, Math.max(1, radius * 0.04), sx, sy, radius);
          g.addColorStop(0, `rgba(${core},${coreA.toFixed(3)})`);
          g.addColorStop(0.32, `rgba(${mid},${midA.toFixed(3)})`);
          g.addColorStop(0.66, `rgba(${mid},${(midA * 0.28).toFixed(3)})`);
          g.addColorStop(1, `rgba(${mid},0)`);
          c.fillStyle = g;
          c.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);
        };
        c.globalCompositeOperation = 'lighter';
        const lights = this._silkFrameLights;
        if (Array.isArray(lights)) {
          for (const L of lights) {
            const sx = toScreenX(L.ux), sy = toScreenY(L.uy);
            const ph = L.ux * 0.9 + L.uy * 1.3;
            const flick = 1 + Math.sin(now * 0.006 + ph) * 0.07 + Math.sin(now * 0.017 + ph * 1.7) * 0.05;
            const R = 178 * zoom * flick * (L.strength || 1);
            // warm torchlight: bright amber core, orange mid falloff
            paintLight(sx, sy, R, '255,227,170', '255,166,84', 0.5 * flick, 0.22 * flick);
          }
        }
        // a subtle warm light on the player so your own party isn't standing in pitch black even
        // with no torch nearby (much dimmer than a torch, so torches still clearly dominate).
        if (this.player && this.player.alive !== false) {
          const pt = this.tileAt?.(this.player.x, this.player.y);
          const pu = this.worldToScreen(this.player.x, this.player.y, (pt?.elev || 0));
          const psx = toScreenX(pu.x), psy = toScreenY(pu.y - 26);
          paintLight(psx, psy, 150 * zoom, '255,236,206', '236,176,120', 0.17, 0.085);
        }
        c.globalCompositeOperation = 'source-over';
        // 2) ground fog: soft pale wisps drifting slowly across the lower half of the view
        c.globalCompositeOperation = 'screen';
        const drift = now * 0.004;
        for (let i = 0; i < 8; i++) {
          const baseY = h * (0.48 + (i % 4) * 0.12);
          const speed = 0.5 + (i % 3) * 0.3;
          const x = ((drift * speed * 34 + i * 230) % (w + 460)) - 230;
          const fw = 230 + (i % 3) * 100, fh = 55 + (i % 2) * 26;
          const g = c.createRadialGradient(x, baseY, 8, x, baseY, fw);
          g.addColorStop(0, 'rgba(158,158,178,0.11)'); g.addColorStop(1, 'rgba(158,158,178,0)');
          c.fillStyle = g;
          c.beginPath(); c.ellipse(x, baseY + Math.sin(drift * 0.5 + i) * 10, fw, fh, 0, 0, Math.PI * 2); c.fill();
        }
        // V0.18.60: big "Silk Web Caverns" title card on entry, fading out ~2s later.
        const card = this.dungeonTitleCard;
        if (card && card.text) {
          const age = now - (card.at || 0);
          if (age >= 2000) { this.dungeonTitleCard = null; }
          else {
            const alpha = age < 1300 ? 1 : Math.max(0, 1 - (age - 1300) / 700);
            const pop = Math.min(1, age / 220);
            c.save();
            c.globalCompositeOperation = 'source-over';
            c.globalAlpha = alpha;
            c.textAlign = 'center'; c.textBaseline = 'middle';
            const fs = Math.round(Math.min(w * 0.11, h * 0.13) * (0.92 + pop * 0.08));
            c.font = `700 ${fs}px Georgia, "Times New Roman", serif`;
            const ty = h * 0.4;
            c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillText(card.text, w / 2 + 3, ty + 3);
            c.shadowColor = 'rgba(180,150,230,0.9)'; c.shadowBlur = 28;
            c.fillStyle = '#efe6ff'; c.fillText(card.text, w / 2, ty); c.shadowBlur = 0;
            c.strokeStyle = 'rgba(216,200,242,' + (alpha * 0.7).toFixed(2) + ')'; c.lineWidth = 2;
            const rw = fs * 3.2; c.beginPath(); c.moveTo(w / 2 - rw, ty + fs * 0.72); c.lineTo(w / 2 + rw, ty + fs * 0.72); c.stroke();
            c.restore();
          }
        }
        c.restore();
      },

      drawVenomPool(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 32, 8, 0.18);
        const t = performance.now() * 0.004;
        const g = ctx.createRadialGradient(s.x, s.y + 7, 4, s.x, s.y + 7, 42);
        g.addColorStop(0, 'rgba(195,255,102,0.42)');
        g.addColorStop(0.52, 'rgba(120,220,92,0.22)');
        g.addColorStop(1, 'rgba(48,80,44,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(s.x, s.y + 7, 42, 14, Math.sin(t) * 0.04, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(217,255,126,0.55)';
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath(); ctx.ellipse(s.x + Math.sin(t + i) * 2, s.y + 7, 23 + i * 7, 6 + i * 2.2, 0, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
      },

      drawWebBridge(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 48, 9, 0.22);
        ctx.strokeStyle = '#15110e'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(s.x - 48, s.y); ctx.lineTo(s.x + 48, s.y); ctx.stroke();
        ctx.strokeStyle = '#d8c8f2'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(s.x - 48, s.y); ctx.lineTo(s.x + 48, s.y); ctx.stroke();
        ctx.lineWidth = 1.5;
        for (let i = -5; i <= 5; i++) { ctx.beginPath(); ctx.moveTo(s.x + i * 10, s.y - 12); ctx.lineTo(s.x + i * 8, s.y + 12); ctx.stroke(); }
        ctx.globalAlpha = 0.34;
        ctx.fillStyle = '#d8c8f2';
        ctx.beginPath(); ctx.ellipse(s.x, s.y, 48, 11, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      },

      drawPuzzleDoor(s, obj = {}) {
        if (obj.opened) {
          ctx.save();
          ctx.fillStyle = 'rgba(117,208,105,0.22)';
          ctx.beginPath();
          ctx.ellipse(s.x + 2, s.y + 10, 34, 9, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#75d069';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(s.x - 22, s.y + 9);
          ctx.lineTo(s.x + 24, s.y + 9);
          ctx.stroke();
          ctx.restore();
          return;
        }
        ctx.save();
        const color = obj.color || '#9fd7ff';
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        ctx.beginPath();
        ctx.ellipse(s.x + 2, s.y + 16, 36, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#302a28';
        this.fillPoly([{x:s.x-28,y:s.y+15},{x:s.x-28,y:s.y-38},{x:s.x+28,y:s.y-38},{x:s.x+28,y:s.y+15}]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect((s.x - 28) | 0, (s.y - 38) | 0, 56, 53);
        ctx.globalAlpha = 0.35 + Math.sin(performance.now() * 0.006) * 0.12;
        ctx.fillStyle = color;
        ctx.fillRect((s.x - 23) | 0, (s.y - 33) | 0, 46, 43);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#f8ecd0';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SEALED', s.x, s.y + 30);
        ctx.restore();
      },



      drawWebCurtain(s, obj = {}) {
        ctx.save();
        const color = obj.color || '#d8c8f2';
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath();
        ctx.ellipse(s.x + 2, s.y + 10, 29, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.4;
        ctx.globalAlpha = 0.78;
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath();
          ctx.moveTo(s.x + i * 8, s.y - 34);
          ctx.quadraticCurveTo(s.x + i * 7 + Math.sin(i) * 6, s.y - 10, s.x + i * 9, s.y + 12);
          ctx.stroke();
        }
        ctx.globalAlpha = 0.45;
        for (let y = -25; y <= 3; y += 9) {
          ctx.beginPath();
          ctx.moveTo(s.x - 30, s.y + y);
          ctx.quadraticCurveTo(s.x, s.y + y + 6, s.x + 30, s.y + y - 1);
          ctx.stroke();
        }
        ctx.restore();
      },

      drawCocoonWall(s, obj = {}) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(s.x + 2, s.y + 13, 32, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        const colors = [obj.color || '#d8c8f2', '#bbaad4', '#ece0f4'];
        for (let i = 0; i < 4; i++) {
          const x = s.x - 20 + i * 13;
          const h = 24 + (i % 2) * 9;
          ctx.fillStyle = colors[i % colors.length];
          ctx.strokeStyle = '#211828';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(x, s.y - 9, 7, h, 0.1 * (i - 1.5), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.45)';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(x - 4, s.y - h - 8);
          ctx.lineTo(x + 4, s.y + h - 9);
          ctx.stroke();
        }
        ctx.restore();
      },

      drawPitShadow(s, obj = {}) {
        ctx.save();
        const g = ctx.createRadialGradient(s.x, s.y + 4, 4, s.x, s.y + 4, 44);
        g.addColorStop(0, 'rgba(0,0,0,0.88)');
        g.addColorStop(0.58, 'rgba(8,5,16,0.52)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 4, 44, 17, -0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(216,200,242,0.28)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 3, 39, 14, -0.12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      },

      drawSilkFloorSigil(s, obj = {}) {
        ctx.save();
        const color = obj.color || '#d68cff';
        ctx.fillStyle = 'rgba(0,0,0,0.24)';
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 8, 35, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.76;
        for (let r = 12; r <= 31; r += 9) {
          ctx.beginPath();
          ctx.ellipse(s.x, s.y + 2, r, r * 0.42, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y + 2);
          ctx.lineTo(s.x + Math.cos(a) * 33, s.y + 2 + Math.sin(a) * 12);
          ctx.stroke();
        }
        ctx.restore();
      },

      drawBossArenaMark(s, obj = {}) {
        ctx.save();
        const color = obj.color || '#ff6f6f';
        ctx.strokeStyle = color;
        ctx.fillStyle = 'rgba(0,0,0,0.24)';
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 8, 54, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2.4;
        ctx.globalAlpha = 0.72;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 7, 50, 16, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.38;
        for (let i = 0; i < 10; i++) {
          const a = i * Math.PI * 2 / 10;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y + 7);
          ctx.lineTo(s.x + Math.cos(a) * 48, s.y + 7 + Math.sin(a) * 15);
          ctx.stroke();
        }
        ctx.restore();
      },

      drawBrokenExpeditionMarker(s, obj = {}) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 12, 20, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#5c3924';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(s.x - 6, s.y + 12);
        ctx.lineTo(s.x - 2, s.y - 28);
        ctx.stroke();
        ctx.fillStyle = '#c49a53';
        this.fillPoly([{x:s.x-20,y:s.y-28},{x:s.x+10,y:s.y-33},{x:s.x+16,y:s.y-18},{x:s.x-13,y:s.y-14}]);
        ctx.strokeStyle = '#2a1b12';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#1d130d';
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SWC', s.x - 2, s.y - 22);
        ctx.restore();
      },

      drawWebbedWeaponRack(s, obj = {}) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 13, 26, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#6c5840';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(s.x - 18, s.y + 10);
        ctx.lineTo(s.x + 18, s.y - 18);
        ctx.moveTo(s.x - 12, s.y - 14);
        ctx.lineTo(s.x + 16, s.y + 11);
        ctx.stroke();
        ctx.strokeStyle = obj.color || '#d8ad57';
        ctx.lineWidth = 1.4;
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(s.x - 24 + i * 6, s.y - 24);
          ctx.lineTo(s.x + 17 + i * 2, s.y + 8);
          ctx.stroke();
        }
        ctx.restore();
      },

      drawVenomRunoff(s, obj = {}) {
        ctx.save();
        const g = ctx.createRadialGradient(s.x, s.y + 8, 2, s.x, s.y + 8, 30);
        g.addColorStop(0, 'rgba(166,255,104,0.72)');
        g.addColorStop(0.55, 'rgba(89,177,62,0.42)');
        g.addColorStop(1, 'rgba(89,177,62,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 9, 30, 9, -0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(210,255,146,0.55)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(s.x - 22, s.y + 4);
        ctx.quadraticCurveTo(s.x - 5, s.y + 14, s.x + 25, s.y + 8);
        ctx.stroke();
        ctx.restore();
      },

      drawSilkCavernHighFidelityDetail(s, obj = {}) {
        ctx.save();
        const type = String(obj.type || 'silkAnchorBundle');
        const color = obj.color || '#d8c8f2';
        const pulse = 0.85 + 0.15 * Math.sin((performance.now ? performance.now() : Date.now()) / 640 + (obj.x || 0));
        const shadow = (w = 34, h = 10, alpha = 0.22) => {
          ctx.fillStyle = `rgba(0,0,0,${alpha})`;
          ctx.beginPath();
          ctx.ellipse(s.x, s.y + 12, w, h, 0, 0, Math.PI * 2);
          ctx.fill();
        };
        const webStroke = (alpha = 0.62, width = 1.2) => {
          ctx.strokeStyle = color;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = width;
        };
        const drawWebFan = (cx, cy, r = 26, strands = 7) => {
          webStroke(0.42, 1.1);
          for (let i = 0; i < strands; i++) {
            const a = -Math.PI * 0.85 + i * Math.PI * 1.7 / Math.max(1, strands - 1);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.quadraticCurveTo(cx + Math.cos(a) * r * 0.65, cy + Math.sin(a) * r * 0.32, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.52);
            ctx.stroke();
          }
          ctx.globalAlpha = 0.28;
          for (let ring = 0.35; ring <= 0.85; ring += 0.25) {
            ctx.beginPath();
            ctx.ellipse(cx, cy, r * ring, r * ring * 0.34, 0.08, 0, Math.PI * 2);
            ctx.stroke();
          }
        };

        if (type === 'flowstoneDrapery') {
          shadow(32, 9, 0.18);
          ctx.fillStyle = '#83755f';
          for (let i = 0; i < 5; i++) {
            const x = s.x - 24 + i * 12;
            this.fillPoly([{x:x-5,y:s.y-30},{x:x+5,y:s.y-34},{x:x+7,y:s.y+10},{x:x-4,y:s.y+8}]);
            ctx.strokeStyle = 'rgba(217,198,150,0.24)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x, s.y - 28); ctx.lineTo(x + 1, s.y + 7); ctx.stroke();
          }
        } else if (type === 'limestoneRubble') {
          shadow(34, 11, 0.25);
          for (let i = 0; i < 7; i++) {
            ctx.fillStyle = i % 2 ? '#756c5b' : '#958a73';
            const x = s.x - 24 + i * 8; const y = s.y + 3 - (i % 3) * 4;
            this.fillPoly([{x:x-7,y:y+7},{x:x+2,y:y-5},{x:x+10,y:y+1},{x:x+5,y:y+10}]);
          }
        } else if (type === 'expeditionWarningRelic') {
          shadow(21, 7, 0.24);
          ctx.strokeStyle = '#8b7b62'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(s.x - 3, s.y + 12); ctx.lineTo(s.x + 5, s.y - 25); ctx.stroke();
          ctx.fillStyle = '#6b4b37';
          this.fillPoly([{x:s.x-20,y:s.y+8},{x:s.x+8,y:s.y-8},{x:s.x+23,y:s.y+0},{x:s.x-5,y:s.y+16}]);
          ctx.strokeStyle = '#d8ad57'; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(s.x - 15, s.y + 1); ctx.lineTo(s.x + 14, s.y + 6); ctx.stroke();
        } else if (type === 'silkAnchorBundle') {
          shadow(obj.massive ? 48 : 35, 9, 0.18);
          webStroke(0.72, obj.massive ? 3.2 : 2.2);
          for (let i = 0; i < (obj.massive ? 7 : 5); i++) {
            ctx.beginPath();
            ctx.moveTo(s.x - 40 + i * 5, s.y - 28 + i * 3);
            ctx.bezierCurveTo(s.x - 22, s.y - 4 + i, s.x + 14, s.y - 6 - i, s.x + 42 - i * 4, s.y + 13);
            ctx.stroke();
          }
          ctx.globalAlpha = 0.38; drawWebFan(s.x - 22, s.y - 13, 22, 6);
        } else if (type === 'heavyWebCurtain') {
          shadow(40, 9, 0.12);
          webStroke(0.54, 1.5);
          for (let i = 0; i < 9; i++) {
            const x = s.x - 34 + i * 8;
            ctx.beginPath();
            ctx.moveTo(x, s.y - 38);
            ctx.quadraticCurveTo(x + 4 * Math.sin(i), s.y - 8, x + 2, s.y + 16);
            ctx.stroke();
          }
          ctx.globalAlpha = 0.14; ctx.fillStyle = color;
          this.fillPoly([{x:s.x-36,y:s.y-36},{x:s.x+36,y:s.y-34},{x:s.x+30,y:s.y+13},{x:s.x-30,y:s.y+17}]);
        } else if (type === 'preyCocoonRack') {
          shadow(38, 10, 0.18);
          for (let i = 0; i < 3; i++) {
            const x = s.x - 18 + i * 18;
            ctx.strokeStyle = 'rgba(216,200,242,0.55)'; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(x, s.y - 43); ctx.lineTo(x, s.y - 22); ctx.stroke();
            const g = ctx.createRadialGradient(x - 4, s.y - 13, 2, x, s.y - 8, 18);
            g.addColorStop(0, 'rgba(255,255,255,0.68)'); g.addColorStop(1, 'rgba(164,151,132,0.82)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, s.y - 7, 10, 22, 0.05, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(80,70,60,0.35)'; ctx.lineWidth = 1;
            for (let w = -8; w <= 8; w += 8) { ctx.beginPath(); ctx.moveTo(x + w, s.y - 25); ctx.lineTo(x - w * .5, s.y + 13); ctx.stroke(); }
          }
        } else if (type === 'boneMidden') {
          shadow(38, 11, 0.25);
          ctx.strokeStyle = '#d6c8a2'; ctx.lineWidth = 3;
          for (let i = 0; i < 8; i++) {
            const x = s.x - 28 + i * 8; const y = s.y + 7 - (i % 4) * 5;
            ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 8, y - 5); ctx.stroke();
            ctx.beginPath(); ctx.arc(x - 7, y + 1, 2.5, 0, Math.PI * 2); ctx.arc(x + 9, y - 6, 2.5, 0, Math.PI * 2); ctx.fillStyle = '#d6c8a2'; ctx.fill();
          }
        } else if (type === 'hatchedEggSac') {
          shadow(34, 10, 0.18);
          for (let i = 0; i < 4; i++) {
            const x = s.x - 22 + i * 14;
            ctx.fillStyle = i % 2 ? '#e0d4b8' : '#f0e6ce';
            ctx.beginPath(); ctx.ellipse(x, s.y + 2 - (i % 2) * 4, 10, 15, 0.2, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(80,60,50,0.45)'; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(x - 7, s.y - 7); ctx.lineTo(x + 8, s.y + 7); ctx.stroke();
          }
        } else if (type === 'spiderlingNook') {
          shadow(28, 8, 0.20);
          ctx.fillStyle = '#14100f'; ctx.beginPath(); ctx.ellipse(s.x, s.y - 4, 27, 13, 0, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(185,214,154,0.46)'; ctx.lineWidth = 1; drawWebFan(s.x, s.y - 4, 25, 8);
          ctx.fillStyle = '#b9d69a';
          for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(s.x - 18 + i * 7, s.y + 3 - (i % 2) * 5, 2.1, 1.4, 0, 0, Math.PI * 2); ctx.fill(); }
        } else if (type === 'shedExoskeleton') {
          shadow(48, 12, 0.30);
          ctx.strokeStyle = '#5b3a2e'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(s.x, s.y - 3, 26, 14, 0.15, 0, Math.PI * 2); ctx.stroke();
          for (let i = -3; i <= 3; i++) {
            ctx.beginPath(); ctx.moveTo(s.x + i * 7, s.y + 0); ctx.lineTo(s.x + i * 14, s.y + 18 - Math.abs(i) * 2); ctx.stroke();
          }
          ctx.fillStyle = 'rgba(143,91,62,0.38)'; ctx.beginPath(); ctx.ellipse(s.x, s.y - 4, 24, 13, 0.15, 0, Math.PI * 2); ctx.fill();
        } else if (type === 'bossBroodNest') {
          shadow(54, 15, 0.24);
          const g = ctx.createRadialGradient(s.x, s.y + 2, 4, s.x, s.y + 4, 45);
          g.addColorStop(0, `rgba(255,240,255,${0.45 * pulse})`); g.addColorStop(1, 'rgba(216,200,242,0.12)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(s.x, s.y + 4, 48, 19, 0, 0, Math.PI * 2); ctx.fill();
          for (let i = 0; i < 7; i++) {
            ctx.fillStyle = i % 2 ? '#e9dfc8' : color;
            ctx.beginPath(); ctx.ellipse(s.x - 30 + i * 10, s.y + 2 - (i % 3) * 5, 7, 10, 0.12, 0, Math.PI * 2); ctx.fill();
          }
          drawWebFan(s.x, s.y + 4, 44, 10);
        } else if (type === 'waterSeep') {
          shadow(38, 9, 0.14);
          const g = ctx.createRadialGradient(s.x, s.y + 6, 2, s.x, s.y + 7, 34);
          g.addColorStop(0, 'rgba(127,200,216,0.55)'); g.addColorStop(1, 'rgba(18,40,48,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(s.x, s.y + 8, 38, 11, -0.12, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(160,230,245,0.55)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(s.x - 20, s.y + 6); ctx.quadraticCurveTo(s.x, s.y + 15, s.x + 26, s.y + 7); ctx.stroke();
        } else if (type === 'escapeTunnelMouth') {
          shadow(34, 10, 0.26);
          ctx.fillStyle = '#0d0b0b'; ctx.beginPath(); ctx.ellipse(s.x, s.y - 1, 30, 15, 0, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#5d5347'; ctx.lineWidth = 3; ctx.stroke();
          drawWebFan(s.x, s.y, 28, 7);
        } else if (type === 'stalactiteCluster' || type === 'stalagmiteCluster') {
          shadow(30, 9, 0.18);
          ctx.fillStyle = obj.color || '#8f8877';
          for (let i = 0; i < 4; i++) {
            const x = s.x - 18 + i * 12; const h = 20 + (i % 3) * 9;
            if (type === 'stalactiteCluster') this.fillPoly([{x:x-5,y:s.y-40},{x:x+6,y:s.y-42},{x:x+2,y:s.y-40+h}]);
            else this.fillPoly([{x:x-7,y:s.y+12},{x:x+7,y:s.y+12},{x:x+1,y:s.y+12-h}]);
          }
          webStroke(0.22, 1); ctx.beginPath(); ctx.moveTo(s.x - 26, s.y - 20); ctx.lineTo(s.x + 25, s.y + 4); ctx.stroke();
        } else if (type === 'phosphorFungusCluster') {
          shadow(28, 8, 0.10);
          const g = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, 34);
          g.addColorStop(0, `rgba(159,232,255,${0.36 * pulse})`); g.addColorStop(1, 'rgba(159,232,255,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, 34, 0, Math.PI * 2); ctx.fill();
          for (let i = 0; i < 8; i++) {
            ctx.fillStyle = i % 2 ? '#c6f6ff' : '#9fe8ff';
            ctx.beginPath(); ctx.ellipse(s.x - 22 + i * 7, s.y + 8 - (i % 4) * 5, 4, 2.4, 0, 0, Math.PI * 2); ctx.fill();
          }
        } else if (type === 'silkWrappedGear') {
          shadow(34, 9, 0.23);
          ctx.fillStyle = '#7a583b'; this.fillPoly([{x:s.x-22,y:s.y+8},{x:s.x+9,y:s.y-8},{x:s.x+24,y:s.y+3},{x:s.x-7,y:s.y+15}]);
          webStroke(0.62, 1.2);
          for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(s.x - 24 + i * 8, s.y - 10); ctx.lineTo(s.x + 18 - i * 4, s.y + 14); ctx.stroke(); }
          ctx.strokeStyle = '#d8ad57'; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.moveTo(s.x - 10, s.y - 7); ctx.lineTo(s.x + 18, s.y + 10); ctx.stroke();
        } else if (type === 'eggCluster') {
          shadow(30, 9, 0.2);
          ctx.globalAlpha = 0.4; drawWebFan(s.x, s.y - 4, 22, 6);
          for (let i = 0; i < 6; i++) {
            const ex = s.x - 14 + (i % 3) * 14; const ey = s.y - 2 + Math.floor(i / 3) * 9;
            ctx.globalAlpha = 1; ctx.fillStyle = obj.color || '#e7dcc4';
            ctx.beginPath(); ctx.ellipse(ex, ey, 6.5 * pulse, 8.5, 0.1, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(60,40,70,0.45)'; ctx.lineWidth = 1; ctx.stroke();
          }
        } else if (type === 'chitinColumn') {
          shadow(24, 9, 0.26);
          ctx.fillStyle = obj.color || '#4c3a52';
          this.fillPoly([{x:s.x-11,y:s.y+12},{x:s.x-7,y:s.y-42},{x:s.x+7,y:s.y-42},{x:s.x+11,y:s.y+12}]);
          ctx.strokeStyle = 'rgba(216,200,242,0.4)'; ctx.lineWidth = 1.4;
          for (let i = -34; i < 12; i += 8) { ctx.beginPath(); ctx.moveTo(s.x - 8, s.y + i); ctx.quadraticCurveTo(s.x, s.y + i - 3, s.x + 8, s.y + i); ctx.stroke(); }
        } else if (type === 'broodGrowth') {
          shadow(32, 10, 0.22);
          ctx.globalAlpha = 0.9; ctx.fillStyle = obj.color || '#6a4a68';
          for (let i = 0; i < 5; i++) { const bx = s.x - 16 + i * 8; ctx.beginPath(); ctx.ellipse(bx, s.y + 2 - (i % 2) * 6, 9, 7, 0, 0, Math.PI * 2); ctx.fill(); }
          ctx.globalAlpha = 1; drawWebFan(s.x, s.y - 6, 24, 6);
        } else if (type === 'webBones') {
          shadow(30, 9, 0.24);
          ctx.strokeStyle = '#d8d2c0'; ctx.globalAlpha = 0.9; ctx.lineWidth = 3; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(s.x - 18, s.y + 6); ctx.lineTo(s.x + 16, s.y - 4); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(s.x - 10, s.y - 8); ctx.lineTo(s.x + 8, s.y + 10); ctx.stroke();
          ctx.fillStyle = '#e8e2d2'; ctx.beginPath(); ctx.arc(s.x - 18, s.y + 6, 4, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1; drawWebFan(s.x, s.y, 22, 6);
        } else if (type === 'royalPylon') {
          shadow(28, 10, 0.26);
          ctx.fillStyle = obj.color || '#5b3f6e';
          this.fillPoly([{x:s.x-12,y:s.y+12},{x:s.x-6,y:s.y-46},{x:s.x+6,y:s.y-46},{x:s.x+12,y:s.y+12}]);
          ctx.globalAlpha = pulse; ctx.fillStyle = '#caa2ea';
          this.fillPoly([{x:s.x,y:s.y-58},{x:s.x-7,y:s.y-46},{x:s.x+7,y:s.y-46}]);
          ctx.globalAlpha = 0.5; ctx.strokeStyle = '#e6d2ff'; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(s.x - 5, s.y - 8); ctx.lineTo(s.x + 5, s.y - 8); ctx.stroke();
        } else if (type === 'silkReliquary') {
          shadow(30, 10, 0.24);
          ctx.fillStyle = obj.color || '#6c527e';
          this.fillPoly([{x:s.x-16,y:s.y+12},{x:s.x-12,y:s.y-20},{x:s.x+12,y:s.y-20},{x:s.x+16,y:s.y+12}]);
          ctx.globalAlpha = pulse; ctx.fillStyle = '#d8c8f2';
          ctx.beginPath(); ctx.arc(s.x, s.y - 22, 7, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1; drawWebFan(s.x, s.y - 10, 20, 6);
        } else {
          drawWebFan(s.x, s.y, 28, 7);
        }
        ctx.restore();
      },

      // V0.17.48 Phase 9 (Old Ruins / Bandit Area): drawRuinWall/drawRuinPillar
      // now take obj so a mossy/vines overlay (wall) or a fallen/toppled pose
      // (pillar) can be layered onto the same base geometry, matching the
      // variant technique already used for lanterns/trees/dead trees.
      drawRuinWall(s, obj = {}) {
        ctx.fillStyle = 'rgba(0,0,0,0.34)';
        ctx.beginPath();
        ctx.ellipse(s.x + 5, s.y + 14, 42, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6d6a59';
        this.fillPoly([{x:s.x-42,y:s.y-8},{x:s.x+22,y:s.y-22},{x:s.x+38,y:s.y-10},{x:s.x-25,y:s.y+6}]);
        ctx.fillStyle = '#4d4a3e';
        this.fillPoly([{x:s.x-42,y:s.y-8},{x:s.x-25,y:s.y+6},{x:s.x-25,y:s.y+34},{x:s.x-43,y:s.y+19}]);
        ctx.fillStyle = '#5e5b4c';
        this.fillPoly([{x:s.x-25,y:s.y+6},{x:s.x+38,y:s.y-10},{x:s.x+38,y:s.y+18},{x:s.x-25,y:s.y+34}]);
        ctx.strokeStyle = 'rgba(25,24,20,0.55)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(s.x - 36 + i * 25, s.y - 4 - i * 4);
          ctx.lineTo(s.x - 18 + i * 25, s.y + 1 - i * 4);
          ctx.stroke();
        }
        if (obj.mossy) {
          ctx.globalAlpha = 0.45;
          ctx.fillStyle = '#5c7a3f';
          ctx.beginPath(); ctx.ellipse(s.x - 20, s.y - 6, 12, 8, 0.3, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(s.x + 10, s.y + 10, 9, 6, -0.2, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
        if (obj.vines) {
          ctx.strokeStyle = 'rgba(74,102,52,0.75)';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          for (const [ox, len] of [[-15, 30], [8, 22], [25, 26]]) {
            ctx.beginPath();
            ctx.moveTo(s.x + ox, s.y - 16);
            ctx.quadraticCurveTo(s.x + ox - 4, s.y - 16 + len * 0.5, s.x + ox + 3, s.y - 16 + len);
            ctx.stroke();
          }
        }
      },

      drawRuinPillar(s, obj = {}) {
        ctx.save();
        if (obj.fallen) {
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath();
          ctx.ellipse(s.x, s.y + 4, 44, 11, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.translate(s.x, s.y);
          ctx.rotate(Math.PI / 2 + (obj.angle || 0.15));
          ctx.fillStyle = '#504d42';
          this.fillPoly([{x:-13,y:8},{x:13,y:5},{x:9,y:-68},{x:-9,y:-65}]);
          ctx.fillStyle = '#6d6a59';
          this.fillPoly([{x:-17,y:9},{x:17,y:5},{x:22,y:15},{x:-16,y:19}]);
          ctx.restore();
          return;
        }
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.beginPath();
        ctx.ellipse(s.x + 4, s.y + 12, 24, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#504d42';
        this.fillPoly([{x:s.x-13,y:s.y+8},{x:s.x+13,y:s.y+5},{x:s.x+9,y:s.y-68},{x:s.x-9,y:s.y-65}]);
        ctx.fillStyle = '#817d69';
        this.fillPoly([{x:s.x-9,y:s.y-65},{x:s.x+9,y:s.y-68},{x:s.x+17,y:s.y-58},{x:s.x-15,y:s.y-54}]);
        ctx.fillStyle = '#6d6a59';
        this.fillPoly([{x:s.x-17,y:s.y+9},{x:s.x+17,y:s.y+5},{x:s.x+22,y:s.y+15},{x:s.x-16,y:s.y+19}]);
        ctx.restore();
      },

      drawRuinArch(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 40, 10, 0.3);
        ctx.fillStyle = '#5e5b4c';
        this.fillPoly([{x:s.x-38,y:s.y+10},{x:s.x-24,y:s.y+8},{x:s.x-22,y:s.y-40},{x:s.x-38,y:s.y-36}]);
        this.fillPoly([{x:s.x+38,y:s.y+10},{x:s.x+24,y:s.y+8},{x:s.x+22,y:s.y-40},{x:s.x+38,y:s.y-36}]);
        ctx.fillStyle = '#6d6a59';
        ctx.beginPath();
        ctx.moveTo(s.x - 24, s.y - 38);
        ctx.quadraticCurveTo(s.x, s.y - 66, s.x + 24, s.y - 38);
        ctx.lineTo(s.x + 16, s.y - 38);
        ctx.quadraticCurveTo(s.x, s.y - 54, s.x - 16, s.y - 38);
        ctx.closePath();
        ctx.fill();
        if (obj.broken) {
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          this.fillPoly([{x:s.x+2,y:s.y-52},{x:s.x+14,y:s.y-46},{x:s.x+6,y:s.y-38},{x:s.x-2,y:s.y-42}]);
        }
        ctx.restore();
      },

      drawRubble(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 26, 9, 0.28);
        const cols = ['#6d6a59', '#5a5747', '#817d69', '#4d4a3e'];
        const rng = Number(obj.seed) || 1;
        for (let i = 0; i < 6; i++) {
          const px = s.x - 22 + i * 8 + (i % 2) * 3;
          const py = s.y + 4 - (i % 3) * 5;
          const sz = 6 + ((i + rng) % 3) * 2;
          ctx.fillStyle = cols[i % cols.length];
          this.fillPoly([{x:px-sz,y:py+sz*0.6},{x:px,y:py-sz},{x:px+sz,y:py+sz*0.5},{x:px+sz*0.3,y:py+sz}]);
        }
        ctx.restore();
      },

      drawBarrel(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 16, 7, 0.24);
        const color = obj.color || '#6b4a2c';
        ctx.fillStyle = colorShade(color, -20);
        ctx.beginPath(); ctx.ellipse(s.x, s.y + 6, 15, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = color;
        this.fillPoly([{x:s.x-15,y:s.y+6},{x:s.x-13,y:s.y-30},{x:s.x+13,y:s.y-30},{x:s.x+15,y:s.y+6}]);
        ctx.fillStyle = colorShade(color, 14);
        ctx.beginPath(); ctx.ellipse(s.x, s.y - 30, 13, 5.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(30,22,14,0.6)';
        ctx.lineWidth = 2;
        for (const dy of [-20, -6]) {
          ctx.beginPath();
          ctx.moveTo(s.x - 15, s.y + dy);
          ctx.quadraticCurveTo(s.x, s.y + dy + 3, s.x + 15, s.y + dy);
          ctx.stroke();
        }
        ctx.restore();
      },

      drawSackPile(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 22, 8, 0.26);
        const color = obj.color || '#8a7452';
        for (const [dx, dy, w, h] of [[-8, 4, 16, 11], [7, 2, 15, 10], [0, -6, 14, 9]]) {
          ctx.fillStyle = colorShade(color, (dx + dy) % 2 ? -10 : 6);
          ctx.beginPath();
          ctx.ellipse(s.x + dx, s.y + dy, w, h, 0.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(40,30,18,0.4)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(s.x + dx - w * 0.4, s.y + dy - h * 0.3);
          ctx.lineTo(s.x + dx + w * 0.4, s.y + dy - h * 0.1);
          ctx.stroke();
        }
        ctx.restore();
      },

      drawRopeBundle(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 12, 5, 0.2);
        ctx.strokeStyle = obj.color || '#a8895c';
        ctx.lineWidth = 3;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.ellipse(s.x, s.y - i * 1.5, 10 - i * 0.6, 6 - i * 0.4, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      },

      drawBarricade(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 30, 9, 0.28);
        ctx.strokeStyle = '#4a3420';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        for (const [x0, y0, x1, y1] of [[-26,6,-6,-22],[-10,8,10,-24],[6,8,26,-18]]) {
          ctx.beginPath();
          ctx.moveTo(s.x + x0, s.y + y0);
          ctx.lineTo(s.x + x1, s.y + y1);
          ctx.stroke();
        }
        ctx.strokeStyle = '#2e2013';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(s.x - 24, s.y - 4);
        ctx.lineTo(s.x + 22, s.y - 10);
        ctx.stroke();
        ctx.restore();
      },

      // V0.17.49 Phase 10 (Stone Hedge Ruins Static Landmark): deliberately
      // distinct grey-blue megalith palette (vs. the brown/tan bandit ruin
      // masonry from Phase 9) so the two ruin landmarks read as different
      // places at a glance.
      drawStandingStone(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 20, 8, 0.3);
        const lean = obj.lean ?? 0;
        ctx.translate(s.x, s.y);
        ctx.rotate(lean);
        ctx.fillStyle = '#4a5058';
        this.fillPoly([{x:-13,y:6},{x:12,y:5},{x:9,y:-72},{x:-9,y:-70}]);
        ctx.fillStyle = '#636a73';
        this.fillPoly([{x:-9,y:-70},{x:9,y:-72},{x:6,y:-58},{x:-7,y:-56}]);
        ctx.strokeStyle = 'rgba(20,22,26,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-4, -50); ctx.lineTo(-2, -10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(5, -60); ctx.lineTo(3, -20); ctx.stroke();
        if (obj.mossy !== false) {
          ctx.globalAlpha = 0.4;
          ctx.fillStyle = '#5c7a3f';
          ctx.beginPath(); ctx.ellipse(-3, -14, 8, 12, 0.2, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
        if (obj.rune) {
          const t = performance.now() * 0.0015 + (obj.phase || 0);
          ctx.globalAlpha = 0.55 + Math.sin(t) * 0.2;
          ctx.strokeStyle = '#9fd7ff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-3, -46); ctx.lineTo(3, -38); ctx.moveTo(3, -46); ctx.lineTo(-3, -38);
          ctx.arc(0, -42, 6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      },

      drawRuneStone(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 16, 7, 0.26);
        ctx.fillStyle = '#565c63';
        this.fillPoly([{x:s.x-11,y:s.y+4},{x:s.x+11,y:s.y+3},{x:s.x+8,y:s.y-22},{x:s.x-8,y:s.y-22}]);
        ctx.fillStyle = '#6d747c';
        ctx.beginPath(); ctx.ellipse(s.x, s.y - 22, 9, 3.5, 0, 0, Math.PI * 2); ctx.fill();
        const t = performance.now() * 0.0018 + (obj.phase || 0);
        const glow = 5 + Math.sin(t) * 1.4;
        ctx.globalAlpha = 0.5 + Math.sin(t) * 0.15;
        ctx.strokeStyle = obj.color || '#8fc8ff';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(s.x, s.y - 12, glow, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s.x - 4, s.y - 15); ctx.lineTo(s.x + 4, s.y - 9);
        ctx.moveTo(s.x + 4, s.y - 15); ctx.lineTo(s.x - 4, s.y - 9);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
      },

      drawBrokenSlab(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 24, 8, 0.26);
        ctx.fillStyle = '#565c63';
        this.fillPoly([{x:s.x-22,y:s.y+3},{x:s.x-2,y:s.y-6},{x:s.x+20,y:s.y+2},{x:s.x+8,y:s.y+11},{x:s.x-12,y:s.y+11}]);
        ctx.fillStyle = '#6d747c';
        this.fillPoly([{x:s.x-22,y:s.y+3},{x:s.x-12,y:s.y+11},{x:s.x-8,y:s.y+7},{x:s.x-16,y:s.y-1}]);
        ctx.strokeStyle = 'rgba(18,20,24,0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(s.x - 4, s.y - 4); ctx.lineTo(s.x + 6, s.y + 8); ctx.stroke();
        if (obj.mossy !== false) {
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = '#5c7a3f';
          ctx.beginPath(); ctx.ellipse(s.x + 4, s.y + 2, 7, 4, 0.1, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      },

      drawMagicResidue(s, obj = {}) {
        ctx.save();
        const t = performance.now() * 0.001 + (obj.phase || 0);
        const color = obj.color || '#a9d8ff';
        for (let i = 0; i < 4; i++) {
          const a = t * 0.7 + i * (Math.PI / 2);
          const rise = ((t * 0.4 + i * 0.3) % 1);
          const mx = Math.cos(a) * 6;
          const my = -rise * 22;
          ctx.globalAlpha = 0.5 * (1 - rise);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(s.x + mx, s.y + my, 1.8 + (1 - rise) * 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 2, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
      },

      // V0.17.50 Phase 11 (Wisps + Waypoint Integration): deliberately static
      // for now - a fixed-alpha glow only, no performance.now()-driven pulse,
      // rotation, or particles. Phase 12 (Animated Waypoint Aura) owns adding
      // that animation on top of this same object/case, per the master plan's
      // phase split; this function should not be extended with time-based
      // motion ahead of that phase.
      // V0.20.88: rebuilt AGAIN, and this time against measurements rather than a coarse ASCII map.
      // V0.20.86 was reported as not close to the reference, and the pixels agreed: the whole prop was
      // only 75px wide (the player sprite is ~150px tall), and the centre saturated to pure 255,255,255
      // across 12px - an opaque white blob, because the core used source-over rgba(238,250,255,0.95),
      // which is white PAINT, not light. No block courses, no readable rune work.
      //
      // Corrections: R 34 -> 58 so it reads at player scale; the dais has real THICKNESS (a side wall,
      // not a flat disc); the rim is built from 20 alternating block faces with mortar; concentric
      // courses are engraved into the inner floor; and every light element is ADDITIVE with capped
      // alpha so it blooms instead of painting over the stone.
      drawWaypoint(s, obj = {}) {
        // Attunement comes from the PLAYER, not the baked flag - obj.attuned is written at world-gen
        // when there may be no player, and is not refreshed on the "already attuned" path, so a
        // waypoint you had attuned rendered dormant after every reload.
        const attuned = !!obj.attuned
          || (!!obj.waypointId && !!this.player?.unlockedWaypoints?.includes?.(obj.waypointId));
        const t = performance.now() * 0.001;
        const phase = (Math.abs(s.x) * 0.017 + Math.abs(s.y) * 0.013) % (Math.PI * 2);
        const pulse = 0.5 + Math.sin(t * 1.5 + phase) * 0.5;
        // V0.20.89: night brightening, inherited from the removed waypointAura effect (V0.17.56 item
        // 3) - deleting the aura would otherwise have silently dropped the behaviour that makes a
        // waypoint read as a beacon after dark. nightStrength comes from the same world-light state
        // everything else uses, so it tracks one day/night curve rather than a second clock.
        //
        // The boost scales the light ALPHAS, exactly as the old aura did. A first attempt multiplied
        // `pulse` instead and clamped to 1, which measured as no change at all (2225 vs 2223 blue
        // pixels) - pulse already peaks at 1, so scaling it can only lift the troughs.
        const night = Math.max(0, Math.min(1, Number(this.getWorldLightState?.()?.nightStrength) || 0));
        const nightBoost = 1 + night * 0.8;
        const L = a => Math.min(1, a * nightBoost);       // light alpha, night-scaled

        // V0.21.2 (Art Direction Phase 2): the shrine STRUCTURE is now an authored atlas frame -
        // raised platform, weathered masonry, rune rings, ritual pillars, ruined backplate - baked
        // once and blitted, per the spec's "one authored shrine asset, not a small procedural circle
        // with generic glow". The animated light below still draws on top of it, because flames, core,
        // beam and particles have to move; baking those would freeze the part that sells it.
        //
        // Falls back to the procedural dais if the bake or its atlas registration failed, so a broken
        // asset degrades to the previous look rather than to nothing.
        const authored = this.drawAuthoredWaypointShrine?.(s, 1);

        const R = 58, RY = R * 0.42, TH = 12;      // radius, isometric squash, dais thickness
        const cx = s.x, cy = s.y - 6;              // top-face centre

        // Every radius clamped: a negative ellipse radius throws and takes the frame with it.
        const ell = (x, y, rx, ry) => {
          ctx.beginPath();
          ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
        };
        const ring = (x, y, rx, ry, style, w) => { ctx.strokeStyle = style; ctx.lineWidth = w; ell(x, y, rx, ry); ctx.stroke(); };

        ctx.save();

        // The BAKED shrine replaces all of this when it is available. Kept as a complete
        // fallback rather than deleted: if the bake or its atlas registration ever fails, the
        // waypoint degrades to the previous procedural dais instead of to bare ground.
        // This also retires a genuine double shadow - the block below drew its own contact
        // shadow inline while 'waypoint' is ALSO in the shadowSize table (added V0.20.99), so
        // an attuned waypoint has been sitting on two stacked shadows since that version. The
        // V0.20.99 probe counted drawPropContactShadow calls and could not see an inline one.
        if (!authored) {
          // --- shadow -------------------------------------------------------------------------
          ctx.fillStyle = 'rgba(0,0,0,0.32)';
          ell(cx, cy + TH + 4, R + 7, RY + 6); ctx.fill();

          // --- dais side wall, giving it real thickness ---------------------------------------
          ctx.fillStyle = '#33373d';
          ctx.beginPath();
          ctx.ellipse(cx, cy + TH, R, RY, 0, 0, Math.PI);
          ctx.lineTo(cx - R, cy);
          ctx.ellipse(cx, cy, R, RY, 0, Math.PI, 0, true);
          ctx.closePath();
          ctx.fill();
          // vertical joints down the visible wall
          ctx.strokeStyle = 'rgba(20,22,26,0.55)';
          ctx.lineWidth = 1.3;
          for (let i = 1; i < 20; i++) {
            const a = Math.PI * (i / 20);
            const px = cx + Math.cos(a) * R * -1;
            const py = cy + Math.sin(a) * RY;
            ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + TH); ctx.stroke();
          }

          // --- top face -----------------------------------------------------------------------
          ctx.fillStyle = '#5b626c';
          ell(cx, cy, R, RY); ctx.fill();

          // --- rim course: 20 fitted blocks, alternating so the masonry reads --------------------
          const rimIn = 0.74;
          for (let i = 0; i < 20; i++) {
            const a1 = (i / 20) * Math.PI * 2, a2 = ((i + 1) / 20) * Math.PI * 2;
            ctx.fillStyle = (i % 2) ? '#69707b' : '#5e656f';
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * RY);
            ctx.lineTo(cx + Math.cos(a2) * R, cy + Math.sin(a2) * RY);
            ctx.lineTo(cx + Math.cos(a2) * R * rimIn, cy + Math.sin(a2) * RY * rimIn);
            ctx.lineTo(cx + Math.cos(a1) * R * rimIn, cy + Math.sin(a1) * RY * rimIn);
            ctx.closePath();
            ctx.fill();
          }
          ring(cx, cy, R, RY, 'rgba(24,26,30,0.6)', 1.6);
          ring(cx, cy, R * rimIn, RY * rimIn, 'rgba(24,26,30,0.5)', 1.4);

          // --- inner floor, with engraved courses ---------------------------------------------
          ctx.fillStyle = '#4c525b';
          ell(cx, cy, R * rimIn - 2, RY * rimIn - 1); ctx.fill();
          ring(cx, cy, R * 0.60, RY * 0.60, 'rgba(30,33,38,0.55)', 1.3);
          ring(cx, cy, R * 0.42, RY * 0.42, 'rgba(30,33,38,0.5)', 1.2);
          ring(cx, cy, R * 0.24, RY * 0.24, 'rgba(30,33,38,0.45)', 1.1);

          // --- rune segments, cut into the stone and lit when attuned --------------------------
          const segs = 16;
          for (let i = 0; i < segs; i++) {
            const a = (i / segs) * Math.PI * 2 + (attuned ? t * 0.22 : 0);
            const ca = Math.cos(a), sa = Math.sin(a);
            const lit = attuned && ((i + Math.floor(t * 1.4)) % 4 !== 0);
            ctx.strokeStyle = lit ? `rgba(180,228,255,${L(0.55 + pulse * 0.3)})` : 'rgba(38,42,48,0.55)';
            ctx.lineWidth = lit ? 2.4 : 1.4;
            ctx.beginPath();
            ctx.moveTo(cx + ca * R * 0.46, cy + sa * RY * 0.46);
            ctx.lineTo(cx + ca * R * 0.60, cy + sa * RY * 0.60);
            ctx.stroke();
          }
        }

        // ===== light. Additive from here, so it blooms rather than painting over the stone =====
        ctx.globalCompositeOperation = 'lighter';

        if (attuned) {
          // glowing inscribed rings
          ring(cx, cy, R * 0.60, RY * 0.60, `rgba(90,170,235,${L(0.30 + pulse * 0.16)})`, 2.2);
          ring(cx, cy, R * 0.42, RY * 0.42, `rgba(120,196,250,${L(0.26 + pulse * 0.14)})`, 1.8);
          // two counter-rotating glyph rings
          ctx.strokeStyle = `rgba(150,210,255,${L(0.34 + pulse * 0.18)})`;
          ctx.lineWidth = 1.6;
          for (let k = 0; k < 2; k++) {
            const rr = R * (0.26 + k * 0.11), spin = t * (k ? -0.5 : 0.75);
            ctx.beginPath();
            for (let i = 0; i <= 6; i++) {
              const a = spin + (i / 6) * Math.PI * 2;
              const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * 0.42;
              i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
            }
            ctx.closePath(); ctx.stroke();
          }

          // ground pool
          const pool = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, R * 0.72));
          pool.addColorStop(0, `rgba(90,170,240,${L(0.30 + pulse * 0.10)})`);
          pool.addColorStop(1, 'rgba(60,130,210,0)');
          ctx.fillStyle = pool;
          ell(cx, cy, R * 0.72, RY * 0.72); ctx.fill();

          // --- beam ---------------------------------------------------------------------
          const beamH = 130 + pulse * 12;
          const halo = ctx.createLinearGradient(cx, cy - beamH, cx, cy);
          halo.addColorStop(0, 'rgba(40,90,150,0)');
          halo.addColorStop(0.62, `rgba(58,124,196,${L(0.13 + pulse * 0.06)})`);
          halo.addColorStop(1, `rgba(86,164,230,${L(0.24 + pulse * 0.08)})`);
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy);
          ctx.lineTo(cx + 17, cy - beamH); ctx.lineTo(cx - 17, cy - beamH);
          ctx.closePath(); ctx.fill();

          const beam = ctx.createLinearGradient(cx, cy - beamH, cx, cy);
          beam.addColorStop(0, 'rgba(96,176,240,0)');
          beam.addColorStop(0.5, `rgba(126,198,252,${L(0.34 + pulse * 0.12)})`);
          // Beam ROOT is not night-boosted either: at 0.58 x1.8 it clamps to a fully opaque white base
          // that stacks additively on the bloom sitting under it. Boosting the beam's mid-stop still
          // brightens the column, without welding the bottom of it into the core.
          beam.addColorStop(1, `rgba(186,226,255,${0.58 + pulse * 0.12})`);
          ctx.fillStyle = beam;
          ctx.beginPath();
          ctx.moveTo(cx - 2.6, cy); ctx.lineTo(cx + 2.6, cy);
          ctx.lineTo(cx + 6, cy - beamH); ctx.lineTo(cx - 6, cy - beamH);
          ctx.closePath(); ctx.fill();

          // --- core: SMALL and tight. The old one was a 23px-wide near-opaque white disc ----
          // Deliberately NOT night-boosted. It is already the brightest element, and scaling it
          // measured the blob straight back: the saturated run went 10px -> 25px at full night.
          // V0.17.56's own note on the removed aura said its boost was 'capped so it never blows
          // out'; this is that cap, applied where it actually matters.
          const bloom = ctx.createRadialGradient(cx, cy - 2, 0, cx, cy - 2, Math.max(1, 20 + pulse * 4));
          bloom.addColorStop(0, `rgba(170,215,255,${0.55 + pulse * 0.15})`);
          bloom.addColorStop(0.5, `rgba(110,175,240,${0.22 + pulse * 0.08})`);
          bloom.addColorStop(1, 'rgba(70,140,210,0)');
          ctx.fillStyle = bloom;
          ell(cx, cy - 2, 20 + pulse * 4, (20 + pulse * 4) * 0.5); ctx.fill();
          // Core disc alpha is divided by nightBoost. The layers beneath it (pool, rings, glow) ARE
          // night-boosted, so they raise the base the core sits on; without this compensation the
          // sum clipped and the centre bloomed into a 13px blob at midnight - measured at the dais
          // centre, not at the flames. Day is unchanged (nightBoost = 1).
          ctx.fillStyle = `rgba(200,232,255,${(0.55 + pulse * 0.2) / nightBoost})`;
          ell(cx, cy - 2, 4.2 + pulse * 0.8, 2.4 + pulse * 0.5); ctx.fill();

          // --- rising motes, deterministic so they do not flicker --------------------------
          ctx.fillStyle = 'rgba(200,232,255,0.9)';
          for (let i = 0; i < 12; i++) {
            const speed = 26 + (i % 5) * 8;
            const rise = (t * speed + i * 19) % 124;
            const a = 1 - rise / 124;
            const sway = Math.sin(t * 1.2 + i * 12.9898) * (4 + (i % 3) * 3);
            ctx.globalAlpha = a * 0.85;
            ctx.beginPath();
            ctx.arc(cx + sway, cy - 4 - rise, Math.max(0.4, 1.7 - rise / 124), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
        ctx.globalCompositeOperation = 'source-over';

        // --- braziers, LAST so they stand in front of the beam --------------------------------
        const brazier = (dx) => {
          const bx = cx + dx, by = cy - RY * 0.15;
          ctx.fillStyle = 'rgba(0,0,0,0.30)';
          ell(bx, by + 12, 12, 4.6); ctx.fill();
          // tapered plinth
          ctx.fillStyle = '#454b54';
          this.fillPoly([{x:bx-9,y:by+12},{x:bx+9,y:by+12},{x:bx+7,y:by-26},{x:bx-7,y:by-26}]);
          ctx.fillStyle = '#565d68';
          this.fillPoly([{x:bx-9,y:by+12},{x:bx-1,y:by+12},{x:bx-1,y:by-26},{x:bx-7,y:by-26}]);
          // cap
          ctx.fillStyle = '#6b7280';
          this.fillPoly([{x:bx-11,y:by-26},{x:bx+11,y:by-26},{x:bx+8,y:by-32},{x:bx-8,y:by-32}]);
          ctx.strokeStyle = 'rgba(22,24,28,0.55)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(bx-9,by+12); ctx.lineTo(bx-7,by-26); ctx.lineTo(bx+7,by-26); ctx.lineTo(bx+9,by+12);
          ctx.stroke();
          if (attuned) {
            const f = 0.6 + Math.sin(t * 4.5 + dx) * 0.4;
            ctx.globalCompositeOperation = 'lighter';
            const fl = ctx.createRadialGradient(bx, by - 40, 0, bx, by - 40, Math.max(1, 16 + f * 4));
            fl.addColorStop(0, `rgba(190,228,255,${L(0.6 + f * 0.2)})`);
            fl.addColorStop(0.45, `rgba(110,180,245,${L(0.28 + f * 0.1)})`);
            fl.addColorStop(1, 'rgba(70,140,210,0)');
            ctx.fillStyle = fl;
            ell(bx, by - 40, 16 + f * 4, 19 + f * 5); ctx.fill();
            ctx.fillStyle = `rgba(214,240,255,${0.75 + f * 0.2})`;
            ctx.beginPath();
            ctx.moveTo(bx, by - 50 - f * 5);
            ctx.quadraticCurveTo(bx + 5, by - 40, bx, by - 32);
            ctx.quadraticCurveTo(bx - 5, by - 40, bx, by - 50 - f * 5);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
          }
        };
        brazier(-R * 0.80);
        brazier(R * 0.80);

        ctx.restore();
      },

      drawTownHouse(s, variant = 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        ctx.beginPath();
        ctx.ellipse(s.x + 7, s.y + 20, 56, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        const wall = variant ? '#8f744e' : '#9c7a50';
        ctx.fillStyle = '#4d3321';
        this.fillPoly([{x:s.x-54,y:s.y-28},{x:s.x-3,y:s.y-70},{x:s.x+57,y:s.y-28},{x:s.x+6,y:s.y+7}]);
        ctx.fillStyle = wall;
        this.fillPoly([{x:s.x-42,y:s.y-24},{x:s.x+6,y:s.y+7},{x:s.x+6,y:s.y+42},{x:s.x-42,y:s.y+8}]);
        ctx.fillStyle = colorShade(wall, -18);
        this.fillPoly([{x:s.x+6,y:s.y+7},{x:s.x+47,y:s.y-20},{x:s.x+47,y:s.y+16},{x:s.x+6,y:s.y+42}]);
        ctx.fillStyle = '#2b1c12';
        this.fillPoly([{x:s.x-8,y:s.y+20},{x:s.x+8,y:s.y+10},{x:s.x+8,y:s.y+38},{x:s.x-8,y:s.y+40}]);
        ctx.fillStyle = '#d6b35a';
        ctx.fillRect((s.x + 23) | 0, (s.y - 2) | 0, 11, 10);
      },

      drawShop(s) {
        this.drawTownHouse(s, 1);
        ctx.fillStyle = '#d6b35a';
        this.fillPoly([{x:s.x-30,y:s.y-33},{x:s.x+21,y:s.y-43},{x:s.x+30,y:s.y-31},{x:s.x-21,y:s.y-21}]);
        if (!DR.SUPPRESS_WORLD_FLOATING_TEXT) {
          ctx.fillStyle = '#1b130c';
          ctx.font = '10px ui-monospace, monospace';
          ctx.fillText('SHOP', s.x - 17, s.y - 29);
        }
      },

      drawWell(s, obj = {}) {
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.beginPath();
        ctx.ellipse(s.x + 2, s.y + 12, 25, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5d5a4c';
        this.fillPoly([{x:s.x-22,y:s.y-4},{x:s.x,y:s.y-15},{x:s.x+24,y:s.y-3},{x:s.x+2,y:s.y+10}]);
        ctx.fillStyle = '#27241d';
        this.fillPoly([{x:s.x-10,y:s.y-4},{x:s.x,y:s.y-9},{x:s.x+12,y:s.y-3},{x:s.x+2,y:s.y+3}]);
        ctx.strokeStyle = '#3a2a1d';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(s.x - 18, s.y - 6); ctx.lineTo(s.x - 18, s.y - 42);
        ctx.moveTo(s.x + 19, s.y - 4); ctx.lineTo(s.x + 19, s.y - 42);
        ctx.moveTo(s.x - 22, s.y - 40); ctx.lineTo(s.x + 24, s.y - 40);
        ctx.stroke();
        // Phase 15 (Micro-Landmarks): moss-covered variant for the Old Forest
        // Well vignette, reusing this same well rather than a second prop.
        if (obj.mossy) {
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = '#5c7a3f';
          for (const [mx, my, mr] of [[-16, -6, 5], [12, -2, 4.5], [2, 8, 4]]) {
            ctx.beginPath();
            ctx.ellipse(s.x + mx, s.y + my, mr, mr * 0.65, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      },

      drawFence(s) {
        ctx.strokeStyle = '#4f321f';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.x - 31, s.y - 6); ctx.lineTo(s.x + 33, s.y - 14);
        ctx.moveTo(s.x - 31, s.y + 10); ctx.lineTo(s.x + 33, s.y + 2);
        ctx.stroke();
        ctx.strokeStyle = '#7d552e';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(s.x - 22, s.y - 17); ctx.lineTo(s.x - 22, s.y + 16);
        ctx.moveTo(s.x + 17, s.y - 20); ctx.lineTo(s.x + 17, s.y + 12);
        ctx.stroke();
        ctx.lineCap = 'butt';
      },

      drawCampStall(s) {
        ctx.fillStyle = 'rgba(0,0,0,0.34)';
        ctx.beginPath();
        ctx.ellipse(s.x + 3, s.y + 15, 38, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#54351f';
        ctx.fillRect((s.x - 30) | 0, (s.y - 12) | 0, 62, 18);
        ctx.fillStyle = '#8f4d34';
        this.fillPoly([{x:s.x-40,y:s.y-19},{x:s.x-9,y:s.y-44},{x:s.x+36,y:s.y-24},{x:s.x+7,y:s.y-2}]);
        ctx.fillStyle = '#d6b35a';
        ctx.fillRect((s.x - 19) | 0, (s.y - 8) | 0, 8, 8);
        ctx.fillStyle = '#78a06a';
        ctx.fillRect((s.x + 4) | 0, (s.y - 9) | 0, 8, 8);
      },

      drawTree(s, obj = {}) {
        const variant = Number(obj.variant || 0);
        const ancient = !!obj.ancient;
        const scaleCap = ancient ? 1.85 : 1.34;
        const scale = Math.max(0.78, Math.min(scaleCap, Number(obj.scale) || (ancient ? 1.5 : (0.90 + (variant % 5) * 0.08))));
        const hue = Number.isFinite(Number(obj.hue)) ? Number(obj.hue) : ((variant * 0.173) % 1);
        const shape = Math.floor(variant) % 9;
        const wind = Math.sin(performance.now() * 0.0012 + variant * 1.7) * 1.6;

        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.scale(scale, scale);

        if (ancient) {
          // Phase 17 (Atmosphere): ancient trees cast a heavier, wider pool of
          // shade - a broad soft outer shadow plus a darker inner core - to sell
          // the deep-woods gloom under the old-growth canopy. Drawn inside the
          // already-scaled context, so it grows with the ancient tree's size.
          ctx.fillStyle = 'rgba(0,0,0,0.30)';
          ctx.beginPath();
          ctx.ellipse(8, 18, 58 + shape * 2.0, 18 + (shape % 3), 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,0.30)';
          ctx.beginPath();
          ctx.ellipse(10, 16, 40 + shape * 1.8, 13 + (shape % 3), 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = 'rgba(0,0,0,0.34)';
          ctx.beginPath();
          ctx.ellipse(10, 16, 38 + shape * 1.8, 12 + (shape % 3), 0, 0, Math.PI * 2);
          ctx.fill();
        }

        const trunkPalette = [
          ['#56351e', '#2b1b11', '#7b5530'],
          ['#4a2f1c', '#23170f', '#8a5f35'],
          ['#5f3b25', '#2e1d13', '#9b6b3d'],
          ['#3f2b20', '#211813', '#6c4a31']
        ][shape % 4];
        const trunkBase = trunkPalette[0];
        const trunkDark = trunkPalette[1];
        const trunkHi = trunkPalette[2];
        const trunkLean = (shape - 4) * 0.8 + wind * 0.25;
        const height = 72 + (shape % 4) * 9;
        const trunkW = 10 + (shape % 3) * 2;

        ctx.fillStyle = trunkDark;
        this.fillPoly([
          { x: -trunkW - 3, y: 8 }, { x: trunkW + 4, y: 6 },
          { x: trunkLean + trunkW * 0.45, y: -height - 7 },
          { x: trunkLean - trunkW * 0.55, y: -height - 5 }
        ]);
        ctx.fillStyle = trunkBase;
        this.fillPoly([
          { x: -trunkW * 0.55, y: 5 }, { x: trunkW * 0.55, y: 3 },
          { x: trunkLean + trunkW * 0.18, y: -height - 4 },
          { x: trunkLean - trunkW * 0.25, y: -height - 3 }
        ]);
        ctx.fillStyle = trunkHi;
        this.fillPoly([
          { x: -1, y: -8 }, { x: 4, y: -12 },
          { x: trunkLean + 2, y: -height + 1 },
          { x: trunkLean - 2, y: -height + 2 }
        ]);

        // Ancient variant: an extra gnarled burl/knot partway up the trunk,
        // reusing the trunk's own palette rather than a separate object.
        if (ancient) {
          const knotY = -height * 0.4;
          ctx.fillStyle = trunkDark;
          ctx.beginPath();
          ctx.ellipse(trunkLean * 0.6 + trunkW * 0.7, knotY, trunkW * 0.9, trunkW * 1.1, 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = trunkHi;
          ctx.beginPath();
          ctx.ellipse(trunkLean * 0.6 + trunkW * 0.9, knotY - 2, trunkW * 0.35, trunkW * 0.45, 0.4, 0, Math.PI * 2);
          ctx.fill();
        }

        // V0.20.63: bare branches read as thin dark lines behind the crown; past the LOD radius they
        // are not distinguishable from the crown silhouette, so the whole stroke pass is skipped.
        if (!this._propFarDetail) {
          ctx.strokeStyle = trunkDark;
          ctx.lineWidth = 4.5 + (shape % 3);
          ctx.lineCap = 'round';
          ctx.beginPath();
          const branchY = -height * 0.62;
          ctx.moveTo(trunkLean * 0.3, branchY);
          ctx.lineTo(-34 - shape * 1.3, branchY - 28 - (shape % 2) * 8);
          ctx.moveTo(trunkLean * 0.4 + 3, branchY - 4);
          ctx.lineTo(34 + shape * 1.1, branchY - 30 - (shape % 3) * 5);
          if (shape % 2 === 0) {
            ctx.moveTo(trunkLean * 0.4, -height * 0.78);
            ctx.lineTo(10 + wind, -height - 35);
          } else {
            ctx.moveTo(trunkLean * 0.3, -height * 0.72);
            ctx.lineTo(-8 + wind, -height - 31);
          }
          ctx.stroke();
          ctx.lineCap = 'butt';
        }

        const palettes = [
          ['#658943', '#557a33', '#88a84e', '#3f632e'],
          ['#42642f', '#314f27', '#6f8f3e', '#233c22'],
          ['#3f6f50', '#2d5942', '#6c9b65', '#1f4337'],
          ['#6f7f3c', '#53622f', '#9a9f54', '#353f22'],
          ['#526f35', '#3d572c', '#7fa24b', '#273b24']
        ];
        const pal = palettes[Math.floor(hue * palettes.length) % palettes.length];
        const crownBase = pal[shape % pal.length];
        const crownH = height + 36;
        const broad = shape % 3 === 0;
        const tall = shape % 3 === 1;
        const sparse = shape % 3 === 2;

        // V0.20.63: at distance the crown collapses to its two largest masses. The silhouette and
        // colour are preserved (which is all that reads past ~11 tiles); the two smaller filler blobs
        // that only add internal shape are dropped, halving the crown's polygon cost.
        const farCrown = this._propFarDetail;
        if (tall) {
          if (!farCrown) this.drawLowPolyCrown(-16 + wind, -crownH + 22, 32, 42, colorShade(crownBase, -10));
          if (!farCrown) this.drawLowPolyCrown(18 + wind, -crownH + 18, 34, 45, colorShade(crownBase, 4));
          this.drawLowPolyCrown(2 + wind, -crownH - 12, 39, 50, colorShade(crownBase, 14));
          this.drawLowPolyCrown(0 + wind * 0.5, -crownH + 38, 43, 34, colorShade(crownBase, -4));
        } else if (sparse) {
          if (!farCrown) this.drawLowPolyCrown(-28 + wind, -crownH + 20, 34, 30, colorShade(crownBase, -14));
          if (!farCrown) this.drawLowPolyCrown(30 + wind, -crownH + 23, 34, 30, colorShade(crownBase, 6));
          this.drawLowPolyCrown(0 + wind, -crownH - 4, 42, 36, colorShade(crownBase, 12));
          ctx.globalAlpha = 0.72;
          this.drawLowPolyCrown(4 - wind, -crownH + 44, 38, 25, colorShade(crownBase, -8));
          ctx.globalAlpha = 1;
        } else {
          if (!farCrown) this.drawLowPolyCrown(-39 + wind, -crownH + 30, 45, 34, colorShade(crownBase, -10));
          if (!farCrown) this.drawLowPolyCrown(41 + wind, -crownH + 28, 48, 36, colorShade(crownBase, 5));
          this.drawLowPolyCrown(6 + wind, -crownH - 2, 52, 40, colorShade(crownBase, 13));
          this.drawLowPolyCrown(0, -crownH + 40, 58, 34, colorShade(crownBase, -5));
        }

        // Occasional moss/leaf color accents. V0.20.63: sub-20%-alpha detail, invisible at range.
        if (farCrown) { /* skipped at distance */ }
        else if (shape % 2 === 0) {
          ctx.globalAlpha = 0.18;
          ctx.fillStyle = '#efe0a4';
          this.fillPoly([
            { x: 14 + wind, y: -crownH - 4 },
            { x: 36 + wind, y: -crownH + 6 },
            { x: 20 + wind, y: -crownH + 20 },
            { x: 4 + wind, y: -crownH + 10 }
          ]);
        } else {
          ctx.globalAlpha = 0.14;
          ctx.fillStyle = '#a6d17a';
          this.fillPoly([
            { x: -32 + wind, y: -crownH + 15 },
            { x: -10 + wind, y: -crownH + 9 },
            { x: -18 + wind, y: -crownH + 27 }
          ]);
        }
        // V0.17.47 Phase 8 (Hidden Tree Cave concealment): optional moss-hung
        // trunk overlay, reusing this tree's own trunk geometry rather than a
        // second stacked object.
        if (obj.mossy) {
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = '#5c7a3f';
          for (const [mx, my, mr] of [[-trunkW * 0.6, -height * 0.35, 7], [trunkW * 0.5, -height * 0.55, 6], [-trunkW * 0.3, -height * 0.15, 5]]) {
            ctx.beginPath();
            ctx.ellipse(trunkLean * 0.3 + mx, my, mr, mr * 1.4, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      },

      drawLowPolyCrown(cx, cy, rx, ry, color) {
        const pts = [
          { x: cx, y: cy - ry }, { x: cx + rx * 0.72, y: cy - ry * 0.62 },
          { x: cx + rx, y: cy + ry * 0.04 }, { x: cx + rx * 0.56, y: cy + ry * 0.82 },
          { x: cx - rx * 0.32, y: cy + ry * 0.95 }, { x: cx - rx, y: cy + ry * 0.18 },
          { x: cx - rx * 0.68, y: cy - ry * 0.66 }
        ];
        ctx.fillStyle = colorShade(color, -15);
        this.fillPoly(pts);
        ctx.fillStyle = colorShade(color, 18);
        this.fillPoly([pts[0], pts[1], { x: cx + 5, y: cy - 2 }, pts[6]]);
        ctx.fillStyle = colorShade(color, 7);
        this.fillPoly([pts[1], pts[2], pts[3], { x: cx + 4, y: cy }]);
        ctx.fillStyle = colorShade(color, -25);
        this.fillPoly([pts[3], pts[4], pts[5], pts[6], { x: cx - 3, y: cy + 4 }]);
        ctx.strokeStyle = 'rgba(19,31,16,0.35)';
        ctx.lineWidth = 1;
        this.strokePoly(pts);
      },

      // obj.kind selects a palette/decoration variant (dead/berry/flowering/
      // mossy) and obj.scale gives a "tall bush" size option, reusing this
      // same clump geometry rather than a separate draw function per variant
      // (Phase 14: Trees, Bushes, Terrain Props).
      drawBrush(s, obj = {}) {
        ctx.save();
        const scale = Math.max(0.8, Math.min(1.55, Number(obj.scale) || 1));
        if (scale !== 1) {
          ctx.translate(s.x, s.y);
          ctx.scale(scale, scale);
          ctx.translate(-s.x, -s.y);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.beginPath();
        ctx.ellipse(s.x + 5, s.y + 8, 28, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        const kind = obj.kind || 'default';
        const cols = kind === 'dead'
          ? ['#7a6a4d', '#5f5238', '#8f7d5c', '#4a4030']
          : kind === 'mossy'
            ? ['#3f5c2c', '#4f7832', '#2e4a22', '#5c7a3f']
            : ['#4f7832', '#638d3d', '#385b29', '#789849'];
        for (let i = 0; i < 8; i++) {
          const px = s.x - 30 + i * 8;
          const py = s.y + 2 - (i % 3) * 5;
          ctx.fillStyle = cols[i % cols.length];
          this.fillPoly([{ x: px, y: py + 12 }, { x: px + 5, y: py - 15 }, { x: px + 13, y: py + 10 }, { x: px + 6, y: py + 4 }]);
        }
        if (kind === 'berry') {
          ctx.fillStyle = '#8a2d4e';
          for (const [dx, dy] of [[-20, -8], [-6, -14], [8, -9], [18, -12], [1, -4]]) {
            ctx.beginPath();
            ctx.arc(s.x + dx, s.y + dy, 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (kind === 'flowering') {
          ctx.fillStyle = '#f0d8e8';
          for (const [dx, dy] of [[-18, -10], [-4, -16], [10, -11], [20, -14], [-1, -6]]) {
            ctx.beginPath();
            ctx.arc(s.x + dx, s.y + dy, 2.6, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (kind === 'mossy') {
          ctx.globalAlpha = 0.4;
          ctx.fillStyle = '#9fc46a';
          for (const [dx, dy] of [[-22, -3], [-2, -10], [14, -4]]) {
            ctx.beginPath();
            ctx.ellipse(s.x + dx, s.y + dy, 5, 3, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      },

      drawRock(s, obj = {}) {
        ctx.fillStyle = 'rgba(0,0,0,0.34)';
        ctx.beginPath();
        ctx.ellipse(s.x + 6, s.y + 13, 30, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        const pts = [
          { x: s.x - 24, y: s.y + 6 }, { x: s.x - 12, y: s.y - 22 },
          { x: s.x + 12, y: s.y - 25 }, { x: s.x + 29, y: s.y - 6 },
          { x: s.x + 18, y: s.y + 15 }, { x: s.x - 15, y: s.y + 18 }
        ];
        ctx.fillStyle = '#77786a';
        this.fillPoly(pts);
        ctx.fillStyle = '#a2a086';
        this.fillPoly([pts[0], pts[1], { x: s.x + 1, y: s.y - 5 }, { x: s.x - 8, y: s.y + 10 }]);
        ctx.fillStyle = '#515349';
        this.fillPoly([{ x: s.x + 1, y: s.y - 5 }, pts[2], pts[3], pts[4], { x: s.x - 8, y: s.y + 10 }]);
        ctx.strokeStyle = 'rgba(32,31,27,0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x - 8, s.y + 10);
        ctx.lineTo(s.x + 1, s.y - 5);
        ctx.lineTo(s.x + 20, s.y + 2);
        ctx.stroke();
        // Optional moss-rock overlay for general forest scatter, reusing this
        // rock's own geometry (Phase 14: Trees, Bushes, Terrain Props).
        if (obj.mossy) {
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = '#5c7a3f';
          for (const [mx, my, mr] of [[-14, -12, 6], [10, -16, 5], [2, 6, 5.5], [-6, 12, 4]]) {
            ctx.beginPath();
            ctx.ellipse(s.x + mx, s.y + my, mr, mr * 0.7, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      },

      // V0.17.45 Phase 6 (Silk Web Cavern Exterior + Approach). Three small
      // new non-blocking ground props for the Silk Web Approach region:
      // a sparse thorn bush, a web-covered bush, and a broken weapon stuck in
      // the ground. All reuse the existing fillPoly/shadow helpers rather
      // than a new rendering path.
      drawThornBush(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 24, 8, 0.26);
        for (let i = 0; i < 6; i++) {
          const px = s.x - 22 + i * 8;
          const py = s.y + 2 - (i % 2) * 6;
          ctx.fillStyle = i % 2 ? '#3a3324' : '#2c2819';
          this.fillPoly([{ x: px, y: py + 10 }, { x: px + 3, y: py - 14 }, { x: px + 7, y: py + 8 }]);
        }
        ctx.strokeStyle = 'rgba(20,18,12,0.7)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          const bx = s.x - 18 + i * 9;
          ctx.beginPath();
          ctx.moveTo(bx, s.y + 4);
          ctx.lineTo(bx + (i % 2 ? 4 : -4), s.y - 12);
          ctx.stroke();
        }
        ctx.restore();
      },

      drawWebbedBush(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 26, 9, 0.28);
        const cols = ['#586e46', '#495c39', '#3d4d2f'];
        const tips = [];
        for (let i = 0; i < 7; i++) {
          const px = s.x - 26 + i * 8;
          const py = s.y + 2 - (i % 3) * 4;
          ctx.fillStyle = cols[i % cols.length];
          this.fillPoly([{ x: px, y: py + 11 }, { x: px + 5, y: py - 13 }, { x: px + 12, y: py + 9 }, { x: px + 5, y: py + 3 }]);
          tips.push({ x: px + 5, y: py - 12 });
        }
        // A small orb web slung across the top of the bush, its frame tied to the
        // outer sprig tips so it clearly sits IN the foliage rather than over it.
        // V0.20.63: the web is ~200 of this prop's 274 canvas ops - 9 spokes, 3 rings and dew drops.
        // At distance none of that is legible, so it is dropped and only the foliage remains.
        if (this._propFarDetail) { ctx.restore(); return; }
        this.drawAnchoredOrbWeb(s.x - 2, s.y - 8, {
          rx: 16, ry: 12, spokes: 9, rings: 3, tilt: -0.2,
          color: '#dcd0ee', alpha: 0.85,
          anchors: [tips[0], tips[3], tips[6], { x: s.x + 15, y: s.y - 1 }],
          seed: obj._propSeed, dew: 1
        });
        ctx.restore();
      },

      drawBrokenWeapon(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 18, 6, 0.24);
        const kind = obj.weaponKind || 'sword';
        ctx.translate(s.x, s.y);
        ctx.rotate(obj.angle ?? 0.6);
        if (kind === 'bow') {
          // Phase 15 (Micro-Landmarks): a snapped hunter's bow, distinct from
          // the ground-planted sword/spear poses above - drawn as two broken
          // stave halves with a slack string, no arrow rest/quiver detail.
          ctx.strokeStyle = '#5c4326';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-2, -18);
          ctx.quadraticCurveTo(-10, -6, -3, 4);
          ctx.moveTo(3, -14);
          ctx.quadraticCurveTo(9, -3, 4, 9);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(224,214,190,0.7)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-2, -18);
          ctx.lineTo(1, -6);
          ctx.lineTo(3, -14);
          ctx.stroke();
          ctx.restore();
          return;
        }
        if (kind === 'arrow') {
          ctx.strokeStyle = '#4a3a26';
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(0, 6);
          ctx.lineTo(0, -20);
          ctx.stroke();
          ctx.fillStyle = '#8b8a7a';
          this.fillPoly([{ x: -2, y: -20 }, { x: 0, y: -27 }, { x: 2, y: -20 }]);
          ctx.fillStyle = '#d9cdb0';
          this.fillPoly([{ x: -2, y: 4 }, { x: -5, y: 9 }, { x: 0, y: 6 }]);
          this.fillPoly([{ x: 2, y: 4 }, { x: 5, y: 9 }, { x: 0, y: 6 }]);
          ctx.restore();
          return;
        }
        ctx.fillStyle = '#4a3a26';
        ctx.fillRect(-2, -4, 4, 16);
        if (kind === 'spear') {
          ctx.fillStyle = '#6b6a5e';
          ctx.fillRect(-2, -30, 4, 26);
          this.fillPoly([{ x: -4, y: -30 }, { x: 0, y: -40 }, { x: 4, y: -30 }]);
        } else {
          ctx.fillStyle = '#8b8a7a';
          this.fillPoly([{ x: -3, y: -4 }, { x: -6, y: -18 }, { x: 0, y: -24 }, { x: 5, y: -12 }, { x: 3, y: -4 }]);
          ctx.strokeStyle = 'rgba(40,38,32,0.6)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-5, -16);
          ctx.lineTo(4, -10);
          ctx.stroke();
        }
        ctx.restore();
      },

      drawMushroom(s) {
        ctx.save();
        ctx.globalAlpha = 0.26;
        ctx.fillStyle = '#8df0bc';
        ctx.beginPath();
        ctx.arc(s.x, s.y - 13, 27, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#eadfc4';
        this.fillPoly([{ x: s.x - 5, y: s.y + 5 }, { x: s.x + 5, y: s.y + 3 }, { x: s.x + 4, y: s.y - 14 }, { x: s.x - 4, y: s.y - 13 }]);
        ctx.fillStyle = '#74af74';
        this.fillPoly([{ x: s.x - 20, y: s.y - 13 }, { x: s.x - 7, y: s.y - 30 }, { x: s.x + 15, y: s.y - 26 }, { x: s.x + 22, y: s.y - 10 }, { x: s.x, y: s.y - 7 }]);
        ctx.fillStyle = '#d9f6cf';
        ctx.fillRect((s.x - 4) | 0, (s.y - 24) | 0, 6, 4);
        ctx.restore();
      },

      drawTent(s) {
        ctx.fillStyle = 'rgba(0,0,0,0.36)';
        ctx.beginPath();
        ctx.ellipse(s.x + 5, s.y + 17, 43, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5a3922';
        this.fillPoly([{ x: s.x - 46, y: s.y + 14 }, { x: s.x - 3, y: s.y - 55 }, { x: s.x + 48, y: s.y + 14 }]);
        ctx.fillStyle = '#996b3f';
        this.fillPoly([{ x: s.x - 3, y: s.y - 55 }, { x: s.x + 48, y: s.y + 14 }, { x: s.x + 7, y: s.y + 14 }]);
        ctx.fillStyle = '#3a2719';
        this.fillPoly([{ x: s.x - 8, y: s.y + 14 }, { x: s.x - 1, y: s.y - 15 }, { x: s.x + 11, y: s.y + 14 }]);
        ctx.strokeStyle = '#24170f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(s.x - 3, s.y - 55);
        ctx.lineTo(s.x - 2, s.y + 14);
        ctx.stroke();
      },

      drawFire(s, obj = {}) {
        ctx.fillStyle = '#4b311b';
        this.fillPoly([{ x: s.x - 26, y: s.y - 1 }, { x: s.x + 18, y: s.y - 8 }, { x: s.x + 28, y: s.y + 3 }, { x: s.x - 18, y: s.y + 9 }]);
        // obj.dead: a long-abandoned firepit (no flame/glow), for authored
        // scene props like the Abandoned Hunter Camp / Failed Spider Hunt
        // (Phase 15) - reuses the same log-pile base rather than a second
        // firepit prop.
        if (obj.dead) {
          ctx.fillStyle = '#3a3630';
          ctx.beginPath();
          ctx.ellipse(s.x, s.y - 2, 16, 7, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = '#57524a';
          for (const [dx, dy] of [[-6, -3], [4, -1], [10, -4]]) {
            ctx.beginPath();
            ctx.arc(s.x + dx, s.y + dy, 2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          return;
        }
        const t = performance.now() * 0.008;
        ctx.globalAlpha = 0.24;
        ctx.fillStyle = '#ffb34d';
        ctx.beginPath();
        ctx.arc(s.x, s.y - 18, 44 + Math.sin(t) * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffd36a';
        this.fillPoly([{ x: s.x - 14, y: s.y - 4 }, { x: s.x, y: s.y - 44 - Math.sin(t) * 4 }, { x: s.x + 15, y: s.y - 5 }, { x: s.x + 1, y: s.y - 15 }]);
        ctx.fillStyle = '#e25f34';
        this.fillPoly([{ x: s.x - 6, y: s.y - 6 }, { x: s.x + 3, y: s.y - 31 + Math.sin(t) * 3 }, { x: s.x + 9, y: s.y - 6 }]);
      },

      drawForge(s) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.34)';
        ctx.beginPath();
        ctx.ellipse(s.x + 6, s.y + 12, 34, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4c4540';
        this.fillPoly([{ x: s.x - 28, y: s.y - 2 }, { x: s.x + 4, y: s.y - 16 }, { x: s.x + 34, y: s.y - 2 }, { x: s.x + 3, y: s.y + 13 }]);
        ctx.fillStyle = '#2d2a27';
        this.fillPoly([{ x: s.x - 23, y: s.y - 4 }, { x: s.x + 4, y: s.y - 14 }, { x: s.x + 28, y: s.y - 3 }, { x: s.x + 3, y: s.y + 8 }]);
        ctx.fillStyle = '#15100d';
        this.fillPoly([{ x: s.x - 11, y: s.y - 5 }, { x: s.x + 4, y: s.y - 10 }, { x: s.x + 17, y: s.y - 5 }, { x: s.x + 3, y: s.y + 2 }]);
        ctx.globalAlpha = 0.42;
        ctx.fillStyle = '#f08b45';
        ctx.beginPath();
        ctx.arc(s.x + 4, s.y - 6, 18 + Math.sin(performance.now() / 140) * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#6b625a';
        this.fillPoly([{ x: s.x + 18, y: s.y - 44 }, { x: s.x + 31, y: s.y - 48 }, { x: s.x + 34, y: s.y - 1 }, { x: s.x + 20, y: s.y + 3 }]);
        ctx.fillStyle = '#3a342e';
        ctx.fillRect((s.x + 20) | 0, (s.y - 56) | 0, 11, 10);
        ctx.restore();
      },

      drawLoom(s) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.30)';
        ctx.beginPath();
        ctx.ellipse(s.x + 3, s.y + 13, 30, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#7a5638';
        ctx.lineWidth = 4;
        ctx.strokeRect((s.x - 24) | 0, (s.y - 46) | 0, 48, 48);
        ctx.strokeStyle = '#3b2418';
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const x = s.x - 18 + i * 7;
          ctx.beginPath();
          ctx.moveTo(x, s.y - 43);
          ctx.lineTo(x + 3, s.y + 1);
          ctx.stroke();
        }
        ctx.fillStyle = '#7e5cb6';
        this.fillPoly([{ x: s.x - 18, y: s.y - 34 }, { x: s.x + 16, y: s.y - 38 }, { x: s.x + 18, y: s.y - 17 }, { x: s.x - 16, y: s.y - 12 }]);
        ctx.fillStyle = '#b894d8';
        this.fillPoly([{ x: s.x - 14, y: s.y - 30 }, { x: s.x + 13, y: s.y - 33 }, { x: s.x + 14, y: s.y - 24 }, { x: s.x - 14, y: s.y - 21 }]);
        ctx.restore();
      },

      drawHerbalistTable(s) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(s.x + 3, s.y + 12, 30, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5f3f25';
        this.fillPoly([{ x: s.x - 28, y: s.y - 13 }, { x: s.x + 18, y: s.y - 22 }, { x: s.x + 30, y: s.y - 10 }, { x: s.x - 16, y: s.y + 0 }]);
        ctx.fillStyle = '#3f2818';
        this.fillPoly([{ x: s.x - 16, y: s.y }, { x: s.x + 30, y: s.y - 10 }, { x: s.x + 30, y: s.y + 3 }, { x: s.x - 16, y: s.y + 14 }]);
        ctx.fillStyle = '#75d069';
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.arc(s.x - 15 + i * 9, s.y - 18 + (i % 2) * 3, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      },

      drawCrate(s) {
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.beginPath();
        ctx.ellipse(s.x + 5, s.y + 10, 28, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7d552e';
        this.fillPoly([{ x: s.x - 23, y: s.y - 27 }, { x: s.x + 8, y: s.y - 34 }, { x: s.x + 27, y: s.y - 18 }, { x: s.x - 5, y: s.y - 11 }]);
        ctx.fillStyle = '#4f321f';
        this.fillPoly([{ x: s.x - 23, y: s.y - 27 }, { x: s.x - 5, y: s.y - 11 }, { x: s.x - 5, y: s.y + 13 }, { x: s.x - 23, y: s.y + 0 }]);
        ctx.fillStyle = '#654126';
        this.fillPoly([{ x: s.x - 5, y: s.y - 11 }, { x: s.x + 27, y: s.y - 18 }, { x: s.x + 27, y: s.y + 6 }, { x: s.x - 5, y: s.y + 13 }]);
        ctx.strokeStyle = '#2d1e12';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x - 20, s.y - 24); ctx.lineTo(s.x + 25, s.y + 5);
        ctx.moveTo(s.x + 7, s.y - 31); ctx.lineTo(s.x - 5, s.y + 12);
        ctx.stroke();
      },

      drawBanner(s) {
        ctx.fillStyle = '#2a1c12';
        ctx.fillRect((s.x - 3) | 0, (s.y - 65) | 0, 7, 66);
        ctx.fillStyle = '#9e3333';
        this.fillPoly([{ x: s.x + 4, y: s.y - 63 }, { x: s.x + 39, y: s.y - 54 }, { x: s.x + 30, y: s.y - 21 }, { x: s.x + 4, y: s.y - 28 }]);
        ctx.fillStyle = '#d0b070';
        ctx.fillRect((s.x + 15) | 0, (s.y - 48) | 0, 12, 12);
      },

      // V0.17.43 Phase 4 (Dead Lantern Trail): obj.variant selects one of
      // intact/broken/hanging/fallen/wisp/bandit/webbed. All variants share
      // the same base post/lamp geometry so the motif reads as one consistent
      // prop family rather than separate objects; 'intact' (or no variant) is
      // the original look.
      drawLanternPost(s, obj = {}) {
        const variant = obj.variant || 'intact';
        const t = performance.now() * 0.004 + (obj.phase || 0);
        // Phase 17 (Atmosphere / Time-of-Day): faint lantern glow along roads,
        // strengthening at night. nightStrength is read from the shared world
        // light state so lantern glow tracks the same day/night curve as the
        // rest of the zone; only lit variants below use it.
        const light = this.getWorldLightState?.() || null;
        const night = Math.max(0, Math.min(1, Number(light?.nightStrength) || 0));
        ctx.save();

        if (variant === 'fallen') {
          ctx.fillStyle = 'rgba(0,0,0,0.28)';
          ctx.beginPath();
          ctx.ellipse(s.x, s.y + 4, 26, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.translate(s.x, s.y);
          ctx.rotate(Math.PI / 2 + 0.12);
          ctx.fillStyle = '#241811';
          ctx.fillRect(-3, -34, 7, 40);
          ctx.fillStyle = '#1c130d';
          ctx.fillRect(-9, -40, 19, 12);
          ctx.restore();
          return;
        }

        if (variant === 'hanging') {
          ctx.translate(s.x, s.y);
          ctx.rotate(0.22);
          ctx.translate(-s.x, -s.y);
        }

        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.beginPath();
        ctx.ellipse(s.x + 2, s.y + 10, 24, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = variant === 'bandit' ? '#3a1c14' : '#2c1c12';
        ctx.fillRect((s.x - 3) | 0, (s.y - 62) | 0, 7, 66);
        ctx.fillStyle = variant === 'broken' ? '#241a12' : '#5b3b21';
        this.fillPoly([{x:s.x-15,y:s.y-62},{x:s.x+19,y:s.y-68},{x:s.x+24,y:s.y-58},{x:s.x-10,y:s.y-53}]);

        if (variant === 'broken') {
          ctx.fillStyle = '#1c130d';
          ctx.fillRect((s.x + 8) | 0, (s.y - 50) | 0, 19, 14);
          ctx.strokeStyle = 'rgba(0,0,0,0.6)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(s.x + 10, s.y - 50);
          ctx.lineTo(s.x + 24, s.y - 38);
          ctx.stroke();
        } else {
          const isWisp = variant === 'wisp';
          // Faint road-marker halo (behind the lamp) that grows with night.
          if (night > 0.04) {
            const hx = s.x + 18, hy = s.y - 46;
            const haloR = isWisp ? 26 : 34;
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = (isWisp ? 0.12 : 0.18) * (0.2 + night * 0.8);
            const halo = ctx.createRadialGradient(hx, hy, 2, hx, hy, haloR);
            halo.addColorStop(0, isWisp ? 'rgba(150,240,200,0.6)' : 'rgba(255,214,120,0.6)');
            halo.addColorStop(1, isWisp ? 'rgba(120,200,170,0)' : 'rgba(200,150,60,0)');
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(hx, hy, haloR, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          ctx.fillStyle = '#281910';
          ctx.fillRect((s.x + 8) | 0, (s.y - 58) | 0, 19, 23);
          const glow = (isWisp ? 10 : 14) + Math.sin(t) * 2;
          ctx.globalAlpha = isWisp ? 0.32 : 0.44;
          ctx.fillStyle = isWisp ? '#8ff0c0' : '#ffd36a';
          ctx.beginPath();
          ctx.arc(s.x + 18, s.y - 46, glow, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = isWisp ? '#c8fbe0' : '#ffdc7e';
          ctx.fillRect((s.x + 13) | 0, (s.y - 53) | 0, 10, 14);
          ctx.fillStyle = isWisp ? '#eafff5' : '#fff2b0';
          ctx.fillRect((s.x + 16) | 0, (s.y - 50) | 0, 4, 8);
        }

        if (variant === 'bandit') {
          ctx.fillStyle = '#7a2020';
          this.fillPoly([{x:s.x-3,y:s.y-58},{x:s.x-14,y:s.y-52},{x:s.x-3,y:s.y-46}]);
        }

        if (variant === 'webbed') {
          ctx.strokeStyle = 'rgba(220,225,230,0.55)';
          ctx.lineWidth = 1;
          for (const [dx, dy] of [[-8,-4],[6,-2],[0,6]]) {
            ctx.beginPath();
            ctx.moveTo(s.x + 8, s.y - 58);
            ctx.lineTo(s.x + 8 + dx * 3, s.y - 58 + dy * 3);
            ctx.stroke();
          }
        }

        ctx.restore();
      },

      drawEvilTree(s, obj = {}) {
        const scale = Number(obj.scale) || 1;
        const t = performance.now() * 0.001;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.scale(scale, scale);
        ctx.translate(-s.x, -s.y);
        ctx.fillStyle = 'rgba(0,0,0,0.46)';
        ctx.beginPath();
        ctx.ellipse(s.x + 5, s.y + 18, 58, 16, -0.06, 0, Math.PI * 2);
        ctx.fill();

        // Root spread: readable 5-tile footprint without adding many separate objects.
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const roots = [
          [-12, 2, -54, 20, -78, 35], [8, 3, 49, 18, 77, 29],
          [-8, 0, -33, -2, -55, -13], [14, 2, 35, -5, 63, -18],
          [-2, 5, -6, 28, -12, 47], [6, 4, 16, 25, 24, 45]
        ];
        for (const [x0,y0,x1,y1,x2,y2] of roots) {
          ctx.strokeStyle = '#24150f';
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.moveTo(s.x + x0, s.y + y0);
          ctx.quadraticCurveTo(s.x + x1, s.y + y1, s.x + x2, s.y + y2);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(94,62,38,0.55)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        const trunkTop = s.y - 138;
        const trunkBase = s.y + 12;
        const wobble = Math.sin(t * 0.7) * 1.2;
        ctx.fillStyle = '#24170f';
        this.fillPoly([
          {x:s.x-24,y:trunkBase}, {x:s.x-31,y:s.y-42}, {x:s.x-20 + wobble,y:trunkTop},
          {x:s.x+18 + wobble,y:trunkTop-4}, {x:s.x+33,y:s.y-38}, {x:s.x+26,y:trunkBase}
        ]);
        ctx.fillStyle = '#3a2517';
        this.fillPoly([
          {x:s.x-14,y:trunkBase-2}, {x:s.x-19,y:s.y-50}, {x:s.x-8 + wobble,y:trunkTop+8},
          {x:s.x+8 + wobble,y:trunkTop+4}, {x:s.x+16,y:s.y-43}, {x:s.x+12,y:trunkBase-2}
        ]);
        ctx.strokeStyle = 'rgba(14,10,8,0.75)';
        ctx.lineWidth = 3;
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(s.x + i * 7, trunkBase - 10);
          ctx.bezierCurveTo(s.x + i * 5 - 9, s.y - 42, s.x + i * 8 + 8, s.y - 92, s.x + i * 5, trunkTop + 8);
          ctx.stroke();
        }

        // Twisted upper limbs.
        ctx.strokeStyle = '#20130e';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(s.x - 10, s.y - 106); ctx.quadraticCurveTo(s.x - 50, s.y - 143, s.x - 82, s.y - 120);
        ctx.moveTo(s.x + 9, s.y - 112); ctx.quadraticCurveTo(s.x + 52, s.y - 156, s.x + 86, s.y - 134);
        ctx.moveTo(s.x - 1, s.y - 132); ctx.quadraticCurveTo(s.x - 7, s.y - 174, s.x + 18, s.y - 191);
        ctx.stroke();
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(s.x - 70, s.y - 123); ctx.lineTo(s.x - 96, s.y - 146);
        ctx.moveTo(s.x + 72, s.y - 136); ctx.lineTo(s.x + 99, s.y - 164);
        ctx.moveTo(s.x + 13, s.y - 184); ctx.lineTo(s.x + 39, s.y - 204);
        ctx.stroke();

        // Gloom foliage mass.
        const canopies = [
          [-50,-154,34,'#233a20'], [-20,-174,42,'#1d321d'], [28,-164,40,'#263d21'],
          [62,-138,34,'#1b2d1a'], [-68,-130,32,'#1b2f19'], [3,-141,45,'#2c4727']
        ];
        for (const [ox, oy, r, color] of canopies) {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.ellipse(s.x + ox, s.y + oy, r, r * 0.78, 0.15, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 0.24;
        ctx.fillStyle = '#6c8a45';
        ctx.beginPath();
        ctx.ellipse(s.x + 24, s.y - 166, 42, 18, -0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Bark face.
        const glow = 0.75 + Math.sin(t * 2.1) * 0.18;
        ctx.fillStyle = '#120c09';
        ctx.beginPath();
        ctx.moveTo(s.x - 13, s.y - 74); ctx.lineTo(s.x - 3, s.y - 67); ctx.lineTo(s.x - 15, s.y - 61); ctx.closePath();
        ctx.moveTo(s.x + 13, s.y - 75); ctx.lineTo(s.x + 2, s.y - 67); ctx.lineTo(s.x + 16, s.y - 62); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = `rgba(136,223,114,${glow})`;
        ctx.beginPath();
        ctx.arc(s.x - 9, s.y - 66, 2.6, 0, Math.PI * 2);
        ctx.arc(s.x + 10, s.y - 66, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0e0806';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(s.x - 14, s.y - 42); ctx.quadraticCurveTo(s.x, s.y - 31, s.x + 17, s.y - 43);
        ctx.stroke();
        ctx.globalAlpha = 0.42;
        ctx.strokeStyle = '#5e452a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x - 22, s.y - 96); ctx.quadraticCurveTo(s.x - 6, s.y - 86, s.x - 18, s.y - 76);
        ctx.moveTo(s.x + 19, s.y - 99); ctx.quadraticCurveTo(s.x + 1, s.y - 84, s.x + 20, s.y - 74);
        ctx.stroke();
        ctx.restore();
      },

      drawDeadTree(s, obj = {}) {
        ctx.save();
        // Optional size variety (thin/gaunt <-> larger) for general forest
        // scatter, scaled around the base point so the existing s.x/s.y-anchored
        // geometry below needs no other changes.
        const deadScale = Math.max(0.7, Math.min(1.5, Number(obj.scale) || 1));
        if (deadScale !== 1) {
          ctx.translate(s.x, s.y);
          ctx.scale(deadScale, deadScale);
          ctx.translate(-s.x, -s.y);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        ctx.beginPath();
        ctx.ellipse(s.x + 5, s.y + 13, 35, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        const variant = obj.variant || 0;
        ctx.strokeStyle = variant % 2 ? '#2b231c' : '#34261b';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.x + 1, s.y + 5);
        ctx.quadraticCurveTo(s.x - 7, s.y - 32, s.x - 2, s.y - 74);
        ctx.stroke();
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(s.x - 3, s.y - 43); ctx.lineTo(s.x - 26, s.y - 62);
        ctx.moveTo(s.x - 1, s.y - 51); ctx.lineTo(s.x + 22, s.y - 70);
        ctx.moveTo(s.x - 1, s.y - 30); ctx.lineTo(s.x + 18, s.y - 43);
        ctx.stroke();
        ctx.fillStyle = 'rgba(116,89,54,0.45)';
        ctx.fillRect((s.x - 5) | 0, (s.y - 58) | 0, 4, 30);
        ctx.fillStyle = 'rgba(141,127,91,0.42)';
        ctx.beginPath();
        ctx.arc(s.x - 22, s.y - 62, 3, 0, Math.PI * 2);
        ctx.arc(s.x + 21, s.y - 70, 2.4, 0, Math.PI * 2);
        ctx.fill();
        // V0.17.45 Phase 6: optional web overlay for a "webbed dead tree" near
        // Silk Web Cavern, reusing this tree's own geometry rather than a
        // second stacked object (the object grid only holds one prop per
        // tile).
        if (obj.webbed) {
          // A web strung between the bare upper branches, its frame tied to the
          // branch tips so it hangs in the crown instead of floating over it.
          const wx = s.x - 2, wy = s.y - 68;
          this.drawAnchoredOrbWeb(wx, wy, {
            rx: 18, ry: 16, spokes: 10, rings: 4, tilt: 0.1,
            color: '#dcd0ee', alpha: 0.82,
            anchors: [
              { x: wx - 22, y: wy - 12 },
              { x: wx + 19, y: wy - 20 },
              { x: wx + 7, y: wy + 17 },
              { x: wx - 15, y: wy + 13 }
            ],
            seed: obj._propSeed, dew: 1
          });
        }
        ctx.restore();
      },

      // obj.natural swaps the burnt/ash palette for a plain forest stump
      // (brown wood, moss-green speckle) for general Dark Woods scatter,
      // reusing this same geometry rather than a second stump function
      // (Phase 14: Trees, Bushes, Terrain Props). Existing ash usage
      // (Bandit's Fall) is unaffected since it never sets obj.natural.
      drawAshStump(s, obj = {}) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(s.x + 2, s.y + 10, 22, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = obj.natural ? '#5f3f26' : '#4d3a2a';
        this.fillPoly([{x:s.x-12,y:s.y-26},{x:s.x+9,y:s.y-31},{x:s.x+16,y:s.y+4},{x:s.x-8,y:s.y+9}]);
        ctx.fillStyle = obj.natural ? '#3a2618' : '#211915';
        this.fillPoly([{x:s.x-9,y:s.y-28},{x:s.x+8,y:s.y-32},{x:s.x+12,y:s.y-23},{x:s.x-6,y:s.y-19}]);
        ctx.globalAlpha = 0.34;
        ctx.fillStyle = obj.natural ? '#6f8f47' : '#a89b83';
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(s.x - 14 + i * 9, s.y + 5 + (i % 2) * 3, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      },

      drawGlowMushroomCluster(s, obj = {}) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.20)';
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 8, 20, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        const t = performance.now() * 0.004;
        const colors = ['#79e7ff', '#b590ff', '#a6ffbf'];
        for (let i = 0; i < 6; i++) {
          const px = s.x - 17 + i * 7;
          const py = s.y + 2 - (i % 3) * 3;
          const h = 9 + (i % 2) * 5;
          ctx.fillStyle = '#d7d0b7';
          ctx.fillRect((px - 1) | 0, (py - h) | 0, 3, h);
          ctx.globalAlpha = 0.34 + Math.sin(t + i) * 0.07;
          ctx.fillStyle = colors[i % colors.length];
          ctx.beginPath();
          ctx.ellipse(px, py - h, 6, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      },

      drawRootArch(s, obj = {}) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        ctx.beginPath();
        ctx.ellipse(s.x + 2, s.y + 15, 52, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#3a2518';
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.x - 42, s.y + 8);
        ctx.bezierCurveTo(s.x - 34, s.y - 54, s.x + 34, s.y - 54, s.x + 42, s.y + 8);
        ctx.stroke();
        ctx.strokeStyle = '#5a3920';
        ctx.lineWidth = 4;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(s.x - 36 + i * 24, s.y + 6);
          ctx.quadraticCurveTo(s.x - 24 + i * 12, s.y - 20 - i * 6, s.x - 10 + i * 15, s.y - 38);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(143,203,112,0.48)';
        ctx.beginPath();
        ctx.arc(s.x - 30, s.y - 16, 5, 0, Math.PI * 2);
        ctx.arc(s.x + 28, s.y - 26, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },

      // Phase 14 (Trees, Bushes, Terrain Props): non-blocking ground-level
      // forest-floor decoration lying flat, reusing the tree trunk palette
      // style rather than inventing a new one.
      drawFallenLog(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 30, 9, 0.26);
        const rot = Number(obj.variant || 0) % 2 ? 0.35 : -0.28;
        ctx.translate(s.x, s.y);
        ctx.rotate(rot);
        ctx.fillStyle = '#2b1b11';
        this.fillPoly([{ x: -32, y: -6 }, { x: 32, y: -8 }, { x: 30, y: 7 }, { x: -30, y: 9 }]);
        ctx.fillStyle = '#56351e';
        this.fillPoly([{ x: -32, y: -6 }, { x: 32, y: -8 }, { x: 30, y: -2 }, { x: -30, y: 0 }]);
        ctx.fillStyle = '#7b5530';
        ctx.beginPath();
        ctx.ellipse(30, -2, 5, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        if (obj.mossy) {
          ctx.globalAlpha = 0.45;
          ctx.fillStyle = '#5c7a3f';
          for (const [mx, my, mr] of [[-18, -2, 5], [4, 1, 4], [18, -3, 4.5]]) {
            ctx.beginPath();
            ctx.ellipse(mx, my, mr, mr * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      },

      // Phase 14: small non-blocking knotted surface-root tangle, distinct
      // from drawRootArch (a walk-through arch) and drawHangingRoots
      // (vertical, cave-only) - this one sits flat on the forest floor.
      drawRootCluster(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 20, 7, 0.22);
        ctx.strokeStyle = '#4a2f1c';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        for (const [dx, dy] of [[-16, 2], [-4, -6], [10, 3], [17, -4]]) {
          ctx.beginPath();
          ctx.moveTo(s.x, s.y + 4);
          ctx.quadraticCurveTo(s.x + dx * 0.5, s.y + dy - 6, s.x + dx, s.y + dy);
          ctx.stroke();
        }
        ctx.fillStyle = '#6c4a31';
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 3, 7, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },

      // Phase 14: the plan's "rooted barrier" - a large blocking tangle of
      // surface roots used sparingly as a natural obstacle deep in the
      // woods. Reuses drawRootCluster's line style at a larger scale rather
      // than a wholly separate visual language.
      drawRootBarrier(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 38, 12, 0.3);
        ctx.strokeStyle = '#3a2518';
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        for (const [dx, dy] of [[-30, -4], [-14, -20], [4, -24], [20, -16], [32, -2]]) {
          ctx.beginPath();
          ctx.moveTo(s.x, s.y + 8);
          ctx.quadraticCurveTo(s.x + dx * 0.5, s.y + dy * 0.6 - 4, s.x + dx, s.y + dy);
          ctx.stroke();
        }
        ctx.strokeStyle = '#5a3920';
        ctx.lineWidth = 3;
        for (const [dx, dy] of [[-22, -12], [6, -18], [26, -10]]) {
          ctx.beginPath();
          ctx.moveTo(s.x, s.y + 6);
          ctx.lineTo(s.x + dx, s.y + dy);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(92,122,63,0.4)';
        ctx.beginPath();
        ctx.arc(s.x - 16, s.y - 10, 4, 0, Math.PI * 2);
        ctx.arc(s.x + 18, s.y - 12, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },

      drawMercPost(s) {
        // Backward-compatible renderer for old saved camp data. The previous blocky
        // MERC text sign is replaced with a neutral contract board/supply hook.
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.beginPath();
        ctx.ellipse(s.x + 4, s.y + 12, 34, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3d2818';
        ctx.fillRect((s.x - 25) | 0, (s.y - 54) | 0, 7, 57);
        ctx.fillRect((s.x + 20) | 0, (s.y - 54) | 0, 7, 57);
        ctx.fillStyle = '#77502d';
        this.fillPoly([{ x: s.x - 31, y: s.y - 60 }, { x: s.x + 31, y: s.y - 65 }, { x: s.x + 37, y: s.y - 49 }, { x: s.x - 28, y: s.y - 42 }]);
        ctx.fillStyle = '#1d130d';
        ctx.fillRect((s.x - 16) | 0, (s.y - 42) | 0, 32, 20);
        ctx.strokeStyle = '#e8d095';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(s.x - 10, s.y - 36); ctx.lineTo(s.x + 10, s.y - 36);
        ctx.moveTo(s.x - 10, s.y - 31); ctx.lineTo(s.x + 6, s.y - 31);
        ctx.moveTo(s.x - 10, s.y - 26); ctx.lineTo(s.x + 12, s.y - 26);
        ctx.stroke();
        ctx.fillStyle = '#c2ec9e';
        ctx.beginPath();
        ctx.arc(s.x + 19, s.y - 51, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },

      // Phase 15 (Micro-Landmarks + Environmental Storytelling): small
      // authored-scene-only props. Kept deliberately simple/low-detail since
      // each only ever appears once or twice per scene, not scattered.

      drawHunterTrap(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 14, 6, 0.2);
        ctx.strokeStyle = '#3a3a36';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, 12, 6, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#6b6a5e';
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const px = s.x + Math.cos(a) * 11;
          const py = s.y + Math.sin(a) * 5.5;
          this.fillPoly([{ x: px, y: py }, { x: px + Math.cos(a) * 4, y: py + Math.sin(a) * 2 }, { x: px + Math.cos(a + 0.3) * 2, y: py - 2 }]);
        }
        ctx.restore();
      },

      drawCoinPouch(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 10, 5, 0.2);
        ctx.fillStyle = '#5a3f22';
        this.fillPoly([{ x: s.x - 7, y: s.y - 2 }, { x: s.x + 6, y: s.y - 4 }, { x: s.x + 8, y: s.y + 6 }, { x: s.x - 6, y: s.y + 7 }]);
        ctx.strokeStyle = '#8a6a3a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(s.x - 3, s.y - 3);
        ctx.lineTo(s.x + 1, s.y - 6);
        ctx.stroke();
        ctx.fillStyle = '#d8ad57';
        for (const [dx, dy] of [[-3, 3], [1, 4], [-1, 1]]) {
          ctx.beginPath();
          ctx.arc(s.x + dx, s.y + dy, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      },

      drawCandleCluster(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 12, 5, 0.2);
        for (let i = 0; i < 3; i++) {
          const px = s.x - 8 + i * 8;
          const h = 4 + (i % 2) * 3;
          ctx.fillStyle = '#d9cdb0';
          this.fillPoly([{ x: px - 2, y: s.y + 4 }, { x: px + 2, y: s.y + 4 }, { x: px + 1, y: s.y - h }, { x: px - 1, y: s.y - h }]);
          ctx.fillStyle = 'rgba(220,190,120,0.7)';
          this.fillPoly([{ x: px - 2, y: s.y + 2 }, { x: px + 3, y: s.y + 2 }, { x: px, y: s.y + 5 }]);
        }
        ctx.restore();
      },

      drawTornCloak(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 16, 6, 0.22);
        ctx.translate(s.x, s.y);
        ctx.rotate(obj.angle ?? -0.3);
        ctx.fillStyle = obj.color || '#4a3f56';
        this.fillPoly([{ x: -14, y: 2 }, { x: -4, y: -5 }, { x: 10, y: -2 }, { x: 15, y: 6 }, { x: 2, y: 8 }, { x: -12, y: 7 }]);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        this.fillPoly([{ x: 2, y: -1 }, { x: 10, y: -2 }, { x: 15, y: 6 }, { x: 5, y: 5 }]);
        ctx.restore();
      },

      drawBloodTrail(s, obj = {}) {
        ctx.save();
        const seed = Number(obj.variant || 0);
        ctx.fillStyle = 'rgba(94,18,18,0.5)';
        for (let i = 0; i < 5; i++) {
          const a = (seed + i) * 1.7;
          const dx = Math.cos(a) * (i * 6);
          const dy = Math.sin(a) * (i * 3);
          ctx.beginPath();
          ctx.ellipse(s.x + dx, s.y + dy, 4 - i * 0.4, 2.4 - i * 0.2, a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      },

      drawArcherPlatform(s, obj = {}) {
        ctx.save();
        this.drawPropContactShadow?.(s, 32, 11, 0.3);
        ctx.fillStyle = '#2e2013';
        ctx.fillRect((s.x - 24) | 0, (s.y - 4) | 0, 6, 34);
        ctx.fillRect((s.x + 20) | 0, (s.y - 8) | 0, 6, 38);
        ctx.fillStyle = '#5c3f22';
        this.fillPoly([{ x: s.x - 30, y: s.y - 4 }, { x: s.x + 28, y: s.y - 10 }, { x: s.x + 34, y: s.y + 2 }, { x: s.x - 24, y: s.y + 8 }]);
        ctx.fillStyle = '#77502d';
        this.fillPoly([{ x: s.x - 30, y: s.y - 4 }, { x: s.x - 24, y: s.y + 8 }, { x: s.x - 20, y: s.y + 5 }, { x: s.x - 26, y: s.y - 7 }]);
        ctx.strokeStyle = '#2e2013';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(s.x - 22, s.y - 14); ctx.lineTo(s.x + 18, s.y - 20);
        ctx.stroke();
        ctx.restore();
      },

      // Phase 16 (Creature Territory Signposting): wolf-territory ground
      // sign for Bramblefen Thicket - scratched claw marks, ground-level and
      // non-blocking like the game's other decal-style signposts (bones,
      // rubble).
      drawClawMarks(s, obj = {}) {
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = '#3a2a1d';
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const ox = s.x - 8 + i * 8;
          ctx.beginPath();
          ctx.moveTo(ox - 3, s.y - 10);
          ctx.lineTo(ox + 3, s.y + 9);
          ctx.stroke();
        }
        ctx.restore();
      }

      });
    }
  };
})();
