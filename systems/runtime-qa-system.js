// Dream Realms runtime QA system
// V0.12.78 owner: renderer/audio integrity checks plus mercenary gear method coverage without patching runtime ownership.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  function exists(path, root = window) {
    return path.split('.').reduce((obj, key) => obj && obj[key], root);
  }

  function rendererCheck(label, value, failures) {
    if (!value) failures.push(`${label} missing`);
  }

  function methodCheck(label, target, name, failures) {
    if (!target || typeof target[name] !== 'function') failures.push(`${label}.${name} missing`);
  }

  function expectedDirectionRows(anim) {
    if (!anim || typeof anim.getDirectionIndexMath !== 'function') return ['direction mapper missing'];
    const expected = [
      [0, 0],
      [45, 4],
      [90, 3],
      [135, 5],
      [180, 1],
      [225, 7],
      [270, 2],
      [315, 6]
    ];
    const failures = [];
    for (const [angle, row] of expected) {
      const got = anim.getDirectionIndexMath(angle, 0);
      if (got !== row) failures.push(`angle ${angle} expected row ${row}, got ${got}`);
    }

    if (typeof anim.getDirectionIndexFromWorldVector === 'function') {
      const screenExpected = [
        ['screen-down/front', 1, 1, 1],
        ['screen-up/back', -1, -1, 0],
        ['screen-right', 1, -1, 3],
        ['screen-left', -1, 1, 2]
      ];
      for (const [label, x, y, row] of screenExpected) {
        const got = anim.getDirectionIndexFromWorldVector(x, y, 0, 1);
        if (got !== row) failures.push(`${label} expected row ${row}, got ${got}`);
      }
    } else {
      failures.push('screen-vector direction mapper missing');
    }
    return failures;
  }

  function socialProfileChecks(model) {
    if (!model || typeof model.resolveProfile !== 'function') return ['social renderer profile resolver missing'];
    const probes = [
      { kind: 'merc', roleKey: 'guardian' },
      { kind: 'merc', roleKey: 'cleric' },
      { kind: 'merc', roleKey: 'adept' },
      { kind: 'merc', roleKey: 'scout' },
      { id: 'npc_camp_merchant', role: 'merchant' },
      { id: 'npc_camp_smith', role: 'blacksmith' },
      { id: 'npc_camp_fisher', role: 'fisher_provisioner' },
      { id: 'npc_camp_healer', role: 'healer' }
    ];
    const failures = [];
    for (const probe of probes) {
      const profile = model.resolveProfile(probe);
      if (!profile || !profile.id) failures.push(`profile unresolved for ${probe.roleKey || probe.id || probe.role}`);
    }
    return failures;
  }

  DR.RuntimeQaSystem = {
    install(Game) {
      if (!Game || !Game.prototype) return;

      Game.prototype.runRuntimeIntegrityAudit = function(reason = 'manual') {
        const failures = [];
        const warnings = [];
        const render = DR.render || {};
        const anim = render.HumanoidAnimationSystem;
        const base = render.HumanoidBaseRenderer;
        const classModel = render.ClassIdentityProceduralModel;
        const socialModel = render.MercNpcIdentityProceduralModel || render.CampNpcProceduralModel;
        const petModel = render.PetIdentityProceduralModel;
        const audioSystem = DR.AudioSystem;
        const ambientAudioSystem = DR.AmbientAudioSystem;

        rendererCheck('HumanoidAnimationSystem', anim, failures);
        rendererCheck('HumanoidBaseRenderer', base, failures);
        rendererCheck('ClassIdentityProceduralModel', classModel, failures);
        rendererCheck('MercNpcIdentityProceduralModel', socialModel, failures);
        rendererCheck('BardProceduralModel', render.BardProceduralModel, failures);
        rendererCheck('DruidProceduralModel', render.DruidProceduralModel, failures);
        rendererCheck('WolfProceduralModel', render.WolfProceduralModel, warnings);
        rendererCheck('RotlingProceduralModel', render.RotlingProceduralModel, warnings);
        rendererCheck('PetIdentityProceduralModel', petModel, failures);
        rendererCheck('AudioSystem', audioSystem, warnings);
        rendererCheck('AmbientAudioSystem', ambientAudioSystem, warnings);

        methodCheck('HumanoidBaseRenderer', base, 'draw', failures);
        methodCheck('HumanoidBaseRenderer', base, 'buildRig', failures);
        methodCheck('HumanoidAnimationSystem', anim, 'buildPose', failures);
        methodCheck('ClassIdentityProceduralModel', classModel, 'draw', failures);
        methodCheck('ClassIdentityProceduralModel', classModel, 'canDraw', failures);
        methodCheck('MercNpcIdentityProceduralModel', socialModel, 'draw', failures);
        methodCheck('MercNpcIdentityProceduralModel', socialModel, 'canDraw', failures);
        methodCheck('PetIdentityProceduralModel', petModel, 'draw', failures);
        methodCheck('PetIdentityProceduralModel', petModel, 'canDraw', failures);
        methodCheck('AudioSystem', audioSystem, 'install', warnings);
        methodCheck('AmbientAudioSystem', ambientAudioSystem, 'install', warnings);
        if (!this.audioSystem) warnings.push('Game.audioSystem not initialized yet');
        if (typeof this.playSfx !== 'function') warnings.push('Game.playSfx missing');
        if (typeof this.playMusic !== 'function') warnings.push('Game.playMusic missing');
        if (typeof this.audioSceneForCurrentState !== 'function') warnings.push('Game.audioSceneForCurrentState missing');
        if (typeof this.applyMusicScene !== 'function') warnings.push('Game.applyMusicScene missing');
        if (typeof this.testAudioMusicScene !== 'function') warnings.push('Game.testAudioMusicScene missing');
        if (typeof this.playAudioEvent !== 'function') warnings.push('Game.playAudioEvent missing');
        if (!audioSystem?.AUDIO_EVENT_MAP?.quest_complete) warnings.push('AudioSystem quest_complete event missing');
        if (!audioSystem?.MUSIC_MANIFEST?.combat_pulse) warnings.push('AudioSystem combat_pulse music missing');
        if (!audioSystem?.AUDIO_EVENT_MAP?.forest_wind) warnings.push('AudioSystem forest_wind ambient event missing');
        if (!audioSystem?.AUDIO_EVENT_MAP?.thunder_roll) warnings.push('AudioSystem thunder_roll ambient event missing');
        if (typeof this.applyAudioSettings !== 'function') warnings.push('Game.applyAudioSettings missing');
        if (typeof this.setAudioVolume !== 'function') warnings.push('Game.setAudioVolume missing');
        if (typeof this.toggleAudioMute !== 'function') warnings.push('Game.toggleAudioMute missing');
        if (typeof this.reserveAudioVoice !== 'function') warnings.push('Game.reserveAudioVoice missing');
        if (typeof this.cleanupAudioVoices !== 'function') warnings.push('Game.cleanupAudioVoices missing');
        if (typeof this.audioRuntimeSummary !== 'function') warnings.push('Game.audioRuntimeSummary missing');
        if (typeof this.updateAmbientAudioSystem !== 'function') warnings.push('Game.updateAmbientAudioSystem missing');
        if (typeof this.playWeatherThunderAudio !== 'function') warnings.push('Game.playWeatherThunderAudio missing');
        if ((this.audioSystem || audioSystem?.DEFAULT_AUDIO_SETTINGS)?.ambientVolume == null) warnings.push('AudioSystem ambientVolume setting missing');
        if ((this.audioSystem || audioSystem?.DEFAULT_AUDIO_SETTINGS)?.ambientDensity == null) warnings.push('AudioSystem ambientDensity setting missing');
        if (typeof this.setMercCommand !== 'function') warnings.push('Game.setMercCommand missing');
        if (typeof this.describeMercCommandState !== 'function') warnings.push('Game.describeMercCommandState missing');
        if (typeof this.reviveMercenary !== 'function') warnings.push('Game.reviveMercenary missing');
        if (typeof this.markMercenaryDowned !== 'function') warnings.push('Game.markMercenaryDowned missing');
        if (!DR.entities?.Mercenary) warnings.push('Mercenary entity class missing');
        if (typeof this.mercRoleIcon !== 'function') warnings.push('Game.mercRoleIcon missing');
        if (typeof this.mercProgressionSummary !== 'function') warnings.push('Game.mercProgressionSummary missing');
        if (typeof this.mercStatsSnapshot !== 'function') warnings.push('Game.mercStatsSnapshot missing');
        if (typeof this.serializeMercenaryState !== 'function') warnings.push('Game.serializeMercenaryState missing');
        if (typeof this.restoreMercenaryState !== 'function') warnings.push('Game.restoreMercenaryState missing');
        if (typeof this.serializePetState !== 'function') warnings.push('Game.serializePetState missing');
        if (typeof this.restorePetState !== 'function') warnings.push('Game.restorePetState missing');
        if (typeof this.canMercEquipItem !== 'function') warnings.push('Game.canMercEquipItem missing');
        if (typeof this.equipMercInventoryItem !== 'function') warnings.push('Game.equipMercInventoryItem missing');
        if (typeof this.unequipMercSlot !== 'function') warnings.push('Game.unequipMercSlot missing');
        if (typeof this.mercGearScore !== 'function') warnings.push('Game.mercGearScore missing');
        if (typeof this.mercSlotForItem !== 'function') warnings.push('Game.mercSlotForItem missing');
        if (typeof this.renderUnifiedCompanionHud !== 'function') warnings.push('Game.renderUnifiedCompanionHud missing');
        if (typeof this.buildUnifiedCompanionHudEntries !== 'function') warnings.push('Game.buildUnifiedCompanionHudEntries missing');
        if (typeof this.companionHudFrame !== 'function') warnings.push('Game.companionHudFrame missing');
        if (!DR.entities?.BotPlayer) warnings.push('BotPlayer entity class missing');
        if (!DR.BotPlayerSystem) warnings.push('BotPlayerSystem missing');
        if (typeof this.ensureBotPlayers !== 'function') warnings.push('Game.ensureBotPlayers missing');
        if (typeof this.inviteBotToParty !== 'function') warnings.push('Game.inviteBotToParty missing');
        if (typeof this.serializeBotPlayerState !== 'function') warnings.push('Game.serializeBotPlayerState missing');
        if (typeof this.ensureBotSquads !== 'function') warnings.push('Game.ensureBotSquads missing');
        if (typeof this.resolveBotAssistTarget !== 'function') warnings.push('Game.resolveBotAssistTarget missing');
        if (typeof this.inspectBotPlayer !== 'function') warnings.push('Game.inspectBotPlayer missing');
        if (typeof this.openBotTradeWindow !== 'function') warnings.push('Game.openBotTradeWindow missing');
        if (typeof this.updateBotAdvancedRoutine !== 'function') warnings.push('Game.updateBotAdvancedRoutine missing');
        if (typeof this.advanceBotQuestProgress !== 'function') warnings.push('Game.advanceBotQuestProgress missing');
        if (typeof this.completeBotCampVisit !== 'function') warnings.push('Game.completeBotCampVisit missing');
        if (typeof this.beginBotDungeonRun !== 'function') warnings.push('Game.beginBotDungeonRun missing');
        if (typeof this.completeBotDungeonRun !== 'function') warnings.push('Game.completeBotDungeonRun missing');
        if (typeof this.ensureBotRuntimeScheduler !== 'function') warnings.push('Game.ensureBotRuntimeScheduler missing');
        if (typeof this.resolveBotActorSchedule !== 'function') warnings.push('Game.resolveBotActorSchedule missing');
        if (typeof this.shouldRunBotAdvancedRoutine !== 'function') warnings.push('Game.shouldRunBotAdvancedRoutine missing');
        if (typeof this.finalizeBotSchedulerFrame !== 'function') warnings.push('Game.finalizeBotSchedulerFrame missing');

        if (typeof this.drawScaledModelSafely !== 'function') failures.push('EntityRenderer.drawScaledModelSafely missing');
        if (typeof this.applyCanvasDisplayTransform !== 'function') failures.push('Game.applyCanvasDisplayTransform missing');
        if (typeof this.resetCanvasTransform !== 'function') failures.push('Game.resetCanvasTransform missing');
        if (typeof this.worldToScreen !== 'function') failures.push('Game.worldToScreen missing');
        if (typeof this.screenToWorld !== 'function') failures.push('Game.screenToWorld missing');

        failures.push(...expectedDirectionRows(anim));
        warnings.push(...socialProfileChecks(socialModel));

        const result = {
          reason,
          ok: failures.length === 0,
          failures,
          warnings,
          checkedAt: Date.now()
        };
        this.runtimeQa = result;

        if (!result.ok) {
          console.warn('[Dream Realms Runtime QA]', result);
          if (typeof this.logSystem === 'function') this.logSystem(`Runtime QA found ${failures.length} issue(s). Check console.`);
          else if (typeof this.log === 'function') this.log(`Runtime QA found ${failures.length} issue(s). Check console.`);
        } else if (this.debugMode || this.debugOverlayOpen) {
          console.info('[Dream Realms Runtime QA]', result);
        }
        return result;
      };

      Game.prototype.runtimeQaSummary = function() {
        const qa = this.runtimeQa || {};
        if (!qa.checkedAt) return 'Runtime QA has not run.';
        if (qa.ok) return `Runtime QA passed${qa.warnings?.length ? ` with ${qa.warnings.length} warning(s)` : ''}.`;
        return `Runtime QA failed with ${qa.failures?.length || 0} issue(s).`;
      };
    }
  };
})();
