// Dream Realms audio system
// V0.12.75 owner: SFX/music manifests, semantic audio events, ambient audio hooks, mixer channels, voice budgeting, scene-aware music transitions, WebAudio playback, and procedural fallback audio.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  const SFX_MANIFEST = Object.freeze({
    ui_select: 'sound-effects/ui_select.wav',
    ui_open: 'sound-effects/ui_open.wav',
    ui_close: 'sound-effects/ui_close.wav',
    ui_error: 'sound-effects/ui_error.wav',
    target_select: 'sound-effects/target_select.wav',
    bag_open: 'sound-effects/bag_open.wav',
    chest_open: 'sound-effects/chest_open.wav',
    loot_item: 'sound-effects/loot_item.wav',
    coin_pickup: 'sound-effects/coin_pickup.wav',
    item_equip: 'sound-effects/item_equip.wav',
    quest_accept: 'sound-effects/quest_accept.wav',
    quest_complete: 'sound-effects/quest_complete.wav',
    merc_hire: 'sound-effects/merc_hire.wav',
    merc_command: 'sound-effects/merc_command.wav',
    meditation_start: 'sound-effects/meditation_start.wav',
    meditation_stop: 'sound-effects/meditation_stop.wav',
    footstep_grass: 'sound-effects/footstep_grass.wav',
    footstep_dirt: 'sound-effects/footstep_dirt.wav',
    footstep_leaves: 'sound-effects/footstep_leaves.wav',
    footstep_stone: 'sound-effects/footstep_stone.wav',
    footstep_water: 'sound-effects/footstep_water.wav',
    attack_slash: 'sound-effects/attack_slash.wav',
    attack_claw: 'sound-effects/attack_claw.wav',
    hit_thud: 'sound-effects/hit_thud.wav',
    magic_cast: 'sound-effects/magic_cast.wav',
    heal_chime: 'sound-effects/heal_chime.wav',
    pet_summon: 'sound-effects/pet_summon.wav',
    enemy_die: 'sound-effects/enemy_die.wav',
    level_up: 'sound-effects/level_up.wav',
    forest_wind: 'sound-effects/forest_wind.wav',
    bird_chirp: 'sound-effects/bird_chirp.wav',
    insect_trill: 'sound-effects/insect_trill.wav',
    owl_hoot: 'sound-effects/owl_hoot.wav',
    water_lap: 'sound-effects/water_lap.wav',
    cave_drip: 'sound-effects/cave_drip.wav',
    cave_rock: 'sound-effects/cave_rock.wav',
    campfire_crackle: 'sound-effects/campfire_crackle.wav',
    town_murmur: 'sound-effects/town_murmur.wav',
    thunder_roll: 'sound-effects/thunder_roll.wav'
  });

  const MUSIC_MANIFEST = Object.freeze({
    dark_woods: 'music/dark_woods_loop.wav',
    cave_ambience: 'music/cave_ambience_loop.wav',
    town_lantern: 'music/town_lantern_loop.wav',
    combat_pulse: 'music/combat_pulse_loop.wav',
    silk_web_cavern: 'music/silk_web_cavern_loop.wav',
    menu_theme: 'music/menu_theme_loop.wav'
  });

  const AUDIO_EVENT_MAP = Object.freeze({
    ui_select: { id: 'ui_select', volume: 0.28, cooldown: 0.045 },
    ui_open: { id: 'ui_open', volume: 0.32, cooldown: 0.08 },
    ui_close: { id: 'ui_close', volume: 0.25, cooldown: 0.08 },
    ui_error: { id: 'ui_error', volume: 0.28, cooldown: 0.12 },
    target_select: { id: 'target_select', volume: 0.28, cooldown: 0.12, radius: 16 },
    bag_open: { id: 'bag_open', volume: 0.34, cooldown: 0.18 },
    chest_open: { id: 'chest_open', volume: 0.46, cooldown: 0.28, radius: 16 },
    loot_item: { id: 'loot_item', volume: 0.34, cooldown: 0.055 },
    coin_pickup: { id: 'coin_pickup', volume: 0.34, cooldown: 0.08 },
    item_equip: { id: 'item_equip', volume: 0.36, cooldown: 0.12 },
    quest_accept: { id: 'quest_accept', volume: 0.36, cooldown: 0.18 },
    quest_complete: { id: 'quest_complete', volume: 0.48, cooldown: 0.24 },
    merc_hire: { id: 'merc_hire', volume: 0.42, cooldown: 0.24 },
    merc_command: { id: 'merc_command', volume: 0.27, cooldown: 0.12 },
    meditation_start: { id: 'meditation_start', volume: 0.36, cooldown: 0.26, radius: 13 },
    meditation_stop: { id: 'meditation_stop', volume: 0.24, cooldown: 0.22, radius: 13 },
    forest_wind: { id: 'forest_wind', channel: 'ambient', volume: 0.22, cooldown: 4.8, radius: 28, rateJitter: 0.04 },
    bird_chirp: { id: 'bird_chirp', channel: 'ambient', volume: 0.20, cooldown: 2.4, radius: 24, rateJitter: 0.18 },
    insect_trill: { id: 'insect_trill', channel: 'ambient', volume: 0.16, cooldown: 2.2, radius: 18, rateJitter: 0.10 },
    owl_hoot: { id: 'owl_hoot', channel: 'ambient', volume: 0.24, cooldown: 10.0, radius: 34, rateJitter: 0.08 },
    water_lap: { id: 'water_lap', channel: 'ambient', volume: 0.21, cooldown: 1.8, radius: 16, rateJitter: 0.07 },
    cave_drip: { id: 'cave_drip', channel: 'ambient', volume: 0.22, cooldown: 1.4, radius: 20, rateJitter: 0.16 },
    cave_rock: { id: 'cave_rock', channel: 'ambient', volume: 0.20, cooldown: 6.5, radius: 24, rateJitter: 0.08 },
    campfire_crackle: { id: 'campfire_crackle', channel: 'ambient', volume: 0.18, cooldown: 1.2, radius: 13, rateJitter: 0.20 },
    town_murmur: { id: 'town_murmur', channel: 'ambient', volume: 0.15, cooldown: 7.5, radius: 18, rateJitter: 0.04 },
    thunder_roll: { id: 'thunder_roll', channel: 'ambient', volume: 0.48, cooldown: 5.0, radius: 60, rateJitter: 0.04 }
  });

  const TERRAIN_SFX = Object.freeze({
    grass_soft: 'footstep_grass',
    brush_soft: 'footstep_grass',
    dirt_soft: 'footstep_dirt',
    packed_dirt: 'footstep_dirt',
    leaf_dry: 'footstep_leaves',
    stone_grit: 'footstep_stone',
    cave_dust: 'footstep_dirt',
    water_shallow: 'footstep_water',
    swamp_soft: 'footstep_water'
  });

  const AUDIO_SETTINGS_KEY = 'dreamRealms.audioSettings.v1';
  const DEFAULT_AUDIO_SETTINGS = Object.freeze({
    enabled: true,
    muted: false,
    musicMuted: false,
    sfxMuted: false,
    ambientMuted: false,
    masterVolume: 0.72,
    musicVolume: 0.34,
    sfxVolume: 0.72,
    ambientVolume: 0.56,
    ambientDensity: 0.78
  });

  function clamp(value, min, max) {
    const n = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
  }

  function safeId(id, fallback = '') {
    return String(id || fallback || '').trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '_');
  }

  function audioCtor() {
    return window.AudioContext || window.webkitAudioContext || null;
  }

  function now(ctx) {
    return ctx?.currentTime || 0;
  }

  function isLikelyBrowserFetchable() {
    return window.location?.protocol === 'http:' || window.location?.protocol === 'https:';
  }

  DR.AudioSystem = {
    SFX_MANIFEST,
    MUSIC_MANIFEST,
    TERRAIN_SFX,
    AUDIO_EVENT_MAP,
    DEFAULT_AUDIO_SETTINGS,

    install(Game) {
      if (!Game || !Game.prototype) return;

      Game.prototype.initAudioSystem = function() {
        if (this.audioSystem) return this.audioSystem;
        const settings = this.loadAudioSettings?.() || { ...DEFAULT_AUDIO_SETTINGS };
        this.audioSystem = {
          ...settings,
          unlocked: false,
          ctx: null,
          buffers: new Map(),
          loading: new Map(),
          failed: new Set(),
          cooldowns: new Map(),
          eventCooldowns: new Map(),
          currentMusicId: '',
          currentMusicSource: null,
          currentMusicGain: null,
          currentMusicElement: null,
          currentMusicElementId: '',
          currentMusicStopTimer: 0,
          fadingMusicNodes: [],
          fadingMusicElements: [],
          musicGeneration: 0,
          allowProceduralMusicFallback: false,
          proceduralMusicNodes: [],
          assetMode: isLikelyBrowserFetchable() ? 'external-or-procedural' : 'procedural-fallback',
          lastZoneMusicCheck: 0,
          lastAppliedMusicGain: 0,
          currentMusicScene: 'boot',
          pendingMusicScene: '',
          combatMusicHoldUntil: 0,
          lastMusicTransitionAt: 0,
          musicTransitionCount: 0,
          forcedMusicScene: '',
          forcedMusicSceneUntil: 0,
          activeVoices: [],
          voiceLimit: 28,
          ambientVoiceLimit: 8,
          sfxVoiceLimit: 20,
          droppedVoices: 0,
          playedVoices: 0,
          lastVoiceCleanup: 0
        };
        this.applyAudioSettings?.(settings, { save: false, restartMusic: false });
        this.installAudioUnlockListeners?.();
        this.installAudioUiBindings?.();
        this.preloadAudioAssets?.();
        return this.audioSystem;
      };

      Game.prototype.loadAudioSettings = function() {
        try {
          const raw = window.localStorage?.getItem(AUDIO_SETTINGS_KEY);
          const parsed = raw ? JSON.parse(raw) : {};
          return this.normalizeAudioSettings?.(parsed) || { ...DEFAULT_AUDIO_SETTINGS };
        } catch (_err) {
          return { ...DEFAULT_AUDIO_SETTINGS };
        }
      };

      Game.prototype.normalizeAudioSettings = function(settings = {}) {
        return {
          enabled: settings.enabled !== false,
          muted: Boolean(settings.muted),
          musicMuted: Boolean(settings.musicMuted),
          sfxMuted: Boolean(settings.sfxMuted),
          ambientMuted: Boolean(settings.ambientMuted),
          masterVolume: clamp(settings.masterVolume ?? DEFAULT_AUDIO_SETTINGS.masterVolume, 0, 1),
          musicVolume: clamp(settings.musicVolume ?? DEFAULT_AUDIO_SETTINGS.musicVolume, 0, 1),
          sfxVolume: clamp(settings.sfxVolume ?? DEFAULT_AUDIO_SETTINGS.sfxVolume, 0, 1),
          ambientVolume: clamp(settings.ambientVolume ?? DEFAULT_AUDIO_SETTINGS.ambientVolume, 0, 1),
          ambientDensity: clamp(settings.ambientDensity ?? DEFAULT_AUDIO_SETTINGS.ambientDensity, 0, 1)
        };
      };

      Game.prototype.saveAudioSettings = function() {
        const state = this.audioSystem || this.initAudioSystem?.();
        if (!state) return false;
        const snapshot = this.normalizeAudioSettings?.(state) || { ...DEFAULT_AUDIO_SETTINGS };
        try {
          window.localStorage?.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(snapshot));
          return true;
        } catch (_err) {
          return false;
        }
      };

      Game.prototype.effectiveMusicVolume = function() {
        const state = this.audioSystem || this.initAudioSystem?.();
        if (!state || !state.enabled || state.muted || state.musicMuted) return 0;
        return clamp(state.masterVolume * state.musicVolume, 0, 1);
      };

      Game.prototype.effectiveSfxVolume = function(localVolume = 1, channel = 'sfx') {
        const state = this.audioSystem || this.initAudioSystem?.();
        if (!state || !state.enabled || state.muted) return 0;
        const kind = safeId(channel || 'sfx');
        if (kind === 'ambient') {
          if (state.ambientMuted) return 0;
          return clamp(clamp(Number(localVolume ?? 1), 0, 2) * state.masterVolume * state.sfxVolume * state.ambientVolume, 0, 1);
        }
        if (state.sfxMuted) return 0;
        return clamp(clamp(Number(localVolume ?? 1), 0, 2) * state.masterVolume * state.sfxVolume, 0, 1);
      };

      Game.prototype.applyAudioSettings = function(settings = {}, options = {}) {
        const state = this.audioSystem || this.initAudioSystem?.();
        if (!state) return false;
        const normalized = this.normalizeAudioSettings?.({ ...state, ...settings }) || { ...DEFAULT_AUDIO_SETTINGS };
        Object.assign(state, normalized);

        const musicGain = this.effectiveMusicVolume?.() || 0;
        state.lastAppliedMusicGain = musicGain;
        if (state.currentMusicGain?.gain && state.ctx) {
          try {
            const t = now(state.ctx);
            state.currentMusicGain.gain.cancelScheduledValues(t);
            state.currentMusicGain.gain.setTargetAtTime(Math.max(0.0001, musicGain), t, 0.08);
          } catch (_err) {}
        }
        if (state.currentMusicElement) state.currentMusicElement.volume = clamp(musicGain, 0, 1);
        if (musicGain <= 0 && options.stopMutedMusic !== false) this.stopMusic?.(0.22);
        else if (options.restartMusic && this.started) this.playPendingZoneMusic?.();

        if (options.save !== false) this.saveAudioSettings?.();
        return true;
      };

      Game.prototype.setAudioVolume = function(kind, value) {
        const kindKey = String(kind || '').toLowerCase();
        const key = kindKey === 'density' || kindKey === 'ambientdensity' ? 'ambientDensity' : `${kindKey}Volume`;
        if (!['masterVolume', 'musicVolume', 'sfxVolume', 'ambientVolume', 'ambientDensity'].includes(key)) return false;
        const next = {};
        next[key] = clamp(Number(value), 0, 1);
        return this.applyAudioSettings?.(next, { restartMusic: key === 'masterVolume' || key === 'musicVolume' });
      };

      Game.prototype.toggleAudioMute = function(kind = 'master') {
        const state = this.audioSystem || this.initAudioSystem?.();
        if (!state) return false;
        const key = String(kind || 'master').toLowerCase() === 'music' ? 'musicMuted'
          : String(kind || '').toLowerCase() === 'ambient' ? 'ambientMuted'
          : String(kind || '').toLowerCase() === 'sfx' ? 'sfxMuted'
          : 'muted';
        const next = {};
        next[key] = !state[key];
        return this.applyAudioSettings?.(next, { restartMusic: key !== 'sfxMuted' });
      };

      Game.prototype.resetAudioSettings = function() {
        return this.applyAudioSettings?.({ ...DEFAULT_AUDIO_SETTINGS }, { restartMusic: true });
      };

      Game.prototype.installAudioUnlockListeners = function() {
        if (this.audioUnlockListenersInstalled) return;
        this.audioUnlockListenersInstalled = true;
        const unlock = () => {
          this.unlockAudioSystem?.();
          if (this.audioSystem?.unlocked) {
            window.removeEventListener('pointerdown', unlock, true);
            window.removeEventListener('keydown', unlock, true);
            window.removeEventListener('touchstart', unlock, true);
          }
        };
        window.addEventListener('pointerdown', unlock, true);
        window.addEventListener('keydown', unlock, true);
        window.addEventListener('touchstart', unlock, true);
      };

      Game.prototype.installAudioUiBindings = function() {
        if (this.audioUiBindingsInstalled) return;
        this.audioUiBindingsInstalled = true;
        document.addEventListener('click', event => {
          if (!this.started && !event.target?.closest?.('#classScreen, #logoSplash')) return;
          const button = event.target?.closest?.('button, [role="button"], .actionSlot, .bagSlot, .spellEntry');
          if (!button) return;
          const closes = button.matches('[data-corpse-close]') || /close|cancel|back|logout|exit/i.test(String(button.textContent || ''));
          this.playAudioEvent?.(closes ? 'ui_close' : 'ui_select', { volume: closes ? 0.22 : 0.18, cooldown: 0.035 });
        }, true);
      };

      Game.prototype.ensureAudioContext = function() {
        const state = this.audioSystem || this.initAudioSystem?.();
        if (!state || !state.enabled) return null;
        if (state.ctx) return state.ctx;
        const Ctor = audioCtor();
        if (!Ctor) return null;
        try {
          state.ctx = new Ctor();
        } catch (_err) {
          state.enabled = false;
          return null;
        }
        return state.ctx;
      };

      Game.prototype.unlockAudioSystem = function() {
        const state = this.audioSystem || this.initAudioSystem?.();
        const audioCtx = this.ensureAudioContext?.();
        if (!state || !audioCtx) return false;
        try {
          if (audioCtx.state === 'suspended') audioCtx.resume?.();
          state.unlocked = true;
          this.playPendingZoneMusic?.();
          // Before a character enters the world there is no "zone" scene, so start
          // the main-menu theme here on the first user gesture that unlocks audio.
          if (!this.started) this.playMenuMusic?.();
          return true;
        } catch (_err) {
          return false;
        }
      };

      // Main-menu / splash theme. Loops the menu_theme track while the player is on
      // the logo splash or character screens; replaced by zone music once start()
      // enters the world (updateAudioSystem crossfades to the zone scene).
      Game.prototype.playMenuMusic = function() {
        if (this.started) return false;
        const state = this.audioSystem || this.initAudioSystem?.();
        if (!state || !state.enabled || state.muted || state.musicMuted) return false;
        if (this.effectiveMusicVolume?.() <= 0) return false;
        if (!state.unlocked) return false; // retried from unlockAudioSystem on first gesture
        if (state.currentMusicId === 'menu_theme') return true;
        return this.playMusic?.('menu_theme', { fade: 0.9 });
      };

      Game.prototype.preloadAudioAssets = function() {
        const state = this.audioSystem || this.initAudioSystem?.();
        if (!state || state.preloadStarted) return;
        state.preloadStarted = true;
        if (!isLikelyBrowserFetchable()) return;
        for (const [id, url] of Object.entries(SFX_MANIFEST)) this.loadAudioBuffer?.(id, url);
        for (const [id, url] of Object.entries(MUSIC_MANIFEST)) this.loadAudioBuffer?.(`music:${id}`, url);
      };

      Game.prototype.loadAudioBuffer = function(id, url) {
        const state = this.audioSystem || this.initAudioSystem?.();
        const audioCtx = this.ensureAudioContext?.();
        if (!state || !audioCtx || !url) return Promise.resolve(null);
        if (state.buffers.has(id)) return Promise.resolve(state.buffers.get(id));
        if (state.loading.has(id)) return state.loading.get(id);
        if (state.failed.has(id)) return Promise.resolve(null);
        const promise = fetch(url)
          .then(resp => resp.ok ? resp.arrayBuffer() : Promise.reject(new Error(`Audio ${id} ${resp.status}`)))
          .then(data => audioCtx.decodeAudioData(data))
          .then(buffer => {
            state.buffers.set(id, buffer);
            state.loading.delete(id);
            return buffer;
          })
          .catch(() => {
            state.failed.add(id);
            state.loading.delete(id);
            return null;
          });
        state.loading.set(id, promise);
        return promise;
      };

      Game.prototype.audioDistanceGain = function(x, y, radius = 18) {
        if (!this.player || !Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) return 1;
        const d = Math.hypot(Number(x) - this.player.x, Number(y) - this.player.y);
        return clamp(1 - d / Math.max(1, radius), 0.05, 1);
      };

      Game.prototype.estimateAudioVoiceDuration = function(id, options = {}) {
        const key = safeId(id);
        if (Number.isFinite(Number(options.duration))) return clamp(Number(options.duration), 0.04, 6.0);
        if (key.includes('thunder')) return 1.05;
        if (key.includes('forest_wind')) return 0.72;
        if (key.includes('town_murmur')) return 0.58;
        if (key.includes('owl')) return 0.58;
        if (key.includes('combat') || key.includes('enemy_die')) return 0.42;
        if (key.includes('meditation_start') || key.includes('pet_summon')) return 0.55;
        if (key.includes('quest_complete')) return 0.42;
        if (key.includes('water') || key.includes('cave_rock')) return 0.32;
        if (key.includes('wind') || key.includes('insect')) return 0.28;
        if (key.includes('step') || key.includes('foot')) return 0.16;
        return 0.24;
      };

      Game.prototype.cleanupAudioVoices = function(force = false) {
        const state = this.audioSystem;
        const audioCtx = state?.ctx;
        if (!state || !audioCtx) return 0;
        const t = now(audioCtx);
        if (!force && t - Number(state.lastVoiceCleanup || 0) < 0.08) return state.activeVoices?.length || 0;
        state.lastVoiceCleanup = t;
        state.activeVoices = (state.activeVoices || []).filter(v => Number(v.endAt || 0) > t);
        return state.activeVoices.length;
      };

      Game.prototype.reserveAudioVoice = function(id, channel = 'sfx', duration = 0.24) {
        const state = this.audioSystem || this.initAudioSystem?.();
        const audioCtx = state?.ctx;
        if (!state || !audioCtx) return false;
        this.cleanupAudioVoices?.();
        const kind = safeId(channel || 'sfx') === 'ambient' ? 'ambient' : 'sfx';
        const active = state.activeVoices || (state.activeVoices = []);
        const totalLimit = Math.max(4, Number(state.voiceLimit || 28));
        const channelLimit = kind === 'ambient' ? Math.max(1, Number(state.ambientVoiceLimit || 8)) : Math.max(2, Number(state.sfxVoiceLimit || 20));
        const channelCount = active.filter(v => v.channel === kind).length;
        if (active.length >= totalLimit || channelCount >= channelLimit) {
          state.droppedVoices = Number(state.droppedVoices || 0) + 1;
          return false;
        }
        active.push({ id: safeId(id), channel: kind, endAt: now(audioCtx) + clamp(duration, 0.04, 6.0) });
        state.playedVoices = Number(state.playedVoices || 0) + 1;
        return true;
      };

      Game.prototype.audioRuntimeSummary = function() {
        const state = this.audioSystem || this.initAudioSystem?.();
        if (!state) return 'Audio not initialized.';
        this.cleanupAudioVoices?.(true);
        const active = state.activeVoices || [];
        const ambient = active.filter(v => v.channel === 'ambient').length;
        const sfx = active.length - ambient;
        const music = state.currentMusicId || 'none';
        const scene = state.currentMusicScene || 'none';
        const mode = state.assetMode || 'unknown';
        const loaded = state.buffers?.size || 0;
        const failed = state.failed?.size || 0;
        return `Mode ${mode} · Scene ${scene} · Music ${music} · Voices ${active.length}/${state.voiceLimit || 28} (${sfx} SFX, ${ambient} ambient) · Buffers ${loaded} loaded, ${failed} failed · Transitions ${state.musicTransitionCount || 0} · Dropped ${state.droppedVoices || 0}`;
      };

      Game.prototype.playSfx = function(id, options = {}) {
        const state = this.audioSystem || this.initAudioSystem?.();
        if (!state || !state.enabled || state.muted || state.sfxMuted) return false;
        const key = safeId(id);
        if (!key) return false;
        const audioCtx = this.ensureAudioContext?.();
        if (!audioCtx) return false;
        if (!state.unlocked) return false;

        const cooldown = Math.max(0, Number(options.cooldown ?? 0.035));
        const t = performance.now();
        const last = Number(state.cooldowns.get(key) || 0);
        if (cooldown > 0 && t - last < cooldown * 1000) return false;
        state.cooldowns.set(key, t);

        const channel = safeId(options.channel || options.audioGroup || 'sfx') === 'ambient' ? 'ambient' : 'sfx';
        const buffer = state.buffers.get(key);
        const volume = (this.effectiveSfxVolume?.(options.volume ?? 1, channel) || 0) * this.audioDistanceGain?.(options.x, options.y, options.radius || 18);
        if (volume <= 0.0001) return false;
        const rate = clamp(Number(options.rate ?? 1), 0.5, 1.8);
        const duration = buffer?.duration || this.estimateAudioVoiceDuration?.(key, options) || 0.24;
        if (!this.reserveAudioVoice?.(key, channel, duration)) return false;
        if (buffer) {
          try {
            const src = audioCtx.createBufferSource();
            const gain = audioCtx.createGain();
            src.buffer = buffer;
            src.playbackRate.value = rate;
            gain.gain.value = volume;
            src.connect(gain);
            gain.connect(audioCtx.destination);
            src.start();
            return true;
          } catch (_err) {}
        }
        this.playProceduralSfx?.(key, { ...options, volume, rate });
        return true;
      };

      Game.prototype.playAudioEvent = function(eventName, context = {}) {
        const state = this.audioSystem || this.initAudioSystem?.();
        if (!state) return false;
        const key = safeId(eventName);
        const event = AUDIO_EVENT_MAP[key];
        if (!event) return this.playSfx?.(key, context);
        const actor = context.actor || context.entity || context.target || null;
        const x = Number.isFinite(Number(context.x)) ? Number(context.x) : (Number.isFinite(Number(actor?.x)) ? Number(actor.x) : undefined);
        const y = Number.isFinite(Number(context.y)) ? Number(context.y) : (Number.isFinite(Number(actor?.y)) ? Number(actor.y) : undefined);
        const rateJitter = Number(context.rateJitter ?? event.rateJitter ?? 0.06);
        const rate = Number.isFinite(Number(context.rate)) ? Number(context.rate) : (Number(event.rate || 1) + (Math.random() * 2 - 1) * rateJitter);
        return this.playSfx?.(context.id || event.id, {
          ...event,
          ...context,
          x,
          y,
          volume: Number.isFinite(Number(context.volume)) ? Number(context.volume) : event.volume,
          cooldown: Number.isFinite(Number(context.cooldown)) ? Number(context.cooldown) : event.cooldown,
          radius: Number.isFinite(Number(context.radius)) ? Number(context.radius) : event.radius,
          channel: context.channel || context.audioGroup || event.channel,
          duration: context.duration || event.duration,
          rate
        });
      };

      Game.prototype.playTerrainFootstepSound = function(profile, options = {}) {
        if (!profile) return false;
        const set = safeId(profile.soundSet || profile.terrainId || 'dirt');
        const id = TERRAIN_SFX[set] || TERRAIN_SFX[safeId(profile.terrainId)] || 'footstep_dirt';
        return this.playSfx?.(id, {
          x: options.x,
          y: options.y,
          volume: 0.28 * clamp(Number(options.speedScale || 1), 0.65, 1.25),
          rate: 0.9 + Math.random() * 0.2,
          cooldown: 0.09,
          radius: 11
        });
      };

      Game.prototype.playProceduralSfx = function(id, options = {}) {
        const audioCtx = this.ensureAudioContext?.();
        if (!audioCtx || !this.audioSystem?.unlocked) return false;
        const volume = clamp(options.volume ?? 0.28, 0, 1.6);
        const t0 = now(audioCtx);
        const makeGain = (gainValue, attack = 0.004, release = 0.18) => {
          const gain = audioCtx.createGain();
          gain.gain.setValueAtTime(0.0001, t0);
          gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), t0 + attack);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + release);
          gain.connect(audioCtx.destination);
          return gain;
        };
        const osc = (type, freq, dur, gainValue = volume, endFreq = null) => {
          const node = audioCtx.createOscillator();
          node.type = type;
          node.frequency.setValueAtTime(freq, t0);
          if (endFreq) node.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
          node.connect(makeGain(gainValue, 0.003, dur));
          node.start(t0);
          node.stop(t0 + dur + 0.02);
        };
        const noise = (dur, gainValue = volume, filterFreq = 800) => {
          const len = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
          const buffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
          const src = audioCtx.createBufferSource();
          const filter = audioCtx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.value = filterFreq;
          src.buffer = buffer;
          src.connect(filter);
          filter.connect(makeGain(gainValue, 0.002, dur));
          src.start(t0);
          src.stop(t0 + dur + 0.02);
        };

        if (id.includes('footstep_water')) { noise(0.18, volume * 0.55, 1200); osc('sine', 220, 0.14, volume * 0.2, 140); }
        else if (id.includes('footstep_stone')) { noise(0.07, volume * 0.45, 1800); osc('triangle', 240, 0.08, volume * 0.18, 170); }
        else if (id.includes('footstep')) { noise(0.11, volume * 0.48, id.includes('leaves') ? 2200 : 650); osc('sine', 120, 0.09, volume * 0.14, 80); }
        else if (id.includes('attack') || id.includes('slash') || id.includes('claw')) { noise(0.13, volume * 0.45, 2600); osc('sawtooth', 760, 0.15, volume * 0.18, 360); }
        else if (id.includes('hit')) { noise(0.10, volume * 0.42, 450); osc('triangle', 95, 0.13, volume * 0.38, 55); }
        else if (id.includes('enemy_die')) { osc('sawtooth', 180, 0.36, volume * 0.28, 58); noise(0.24, volume * 0.2, 520); }
        else if (id.includes('ui_open') || id.includes('bag_open')) { osc('sine', 392, 0.08, volume * 0.16, 523); osc('triangle', 784, 0.12, volume * 0.08); }
        else if (id.includes('ui_close')) { osc('sine', 392, 0.08, volume * 0.12, 261); }
        else if (id.includes('ui_error')) { osc('square', 164, 0.12, volume * 0.12, 123); noise(0.08, volume * 0.08, 300); }
        else if (id.includes('target_select')) { osc('triangle', 330, 0.12, volume * 0.16, 440); }
        else if (id.includes('coin')) { osc('sine', 1046, 0.10, volume * 0.14, 1318); osc('triangle', 1568, 0.14, volume * 0.08); }
        else if (id.includes('loot_item')) { osc('triangle', 523, 0.12, volume * 0.12, 659); noise(0.05, volume * 0.06, 1800); }
        else if (id.includes('item_equip')) { noise(0.08, volume * 0.16, 1700); osc('triangle', 220, 0.10, volume * 0.12, 165); }
        else if (id.includes('chest_open')) { osc('triangle', 146, 0.20, volume * 0.2, 98); noise(0.13, volume * 0.16, 600); }
        else if (id.includes('quest_accept')) { osc('sine', 440, 0.12, volume * 0.12, 587); osc('sine', 880, 0.18, volume * 0.07); }
        else if (id.includes('quest_complete')) { osc('sine', 523, 0.13, volume * 0.13, 659); osc('sine', 784, 0.18, volume * 0.11); osc('sine', 1046, 0.24, volume * 0.08); }
        else if (id.includes('merc_hire')) { osc('triangle', 220, 0.16, volume * 0.18, 293); osc('sine', 440, 0.16, volume * 0.09); }
        else if (id.includes('merc_command')) { osc('sine', 330, 0.08, volume * 0.12, 392); }
        else if (id.includes('meditation_start')) { osc('sine', 196, 0.42, volume * 0.15, 392); osc('triangle', 588, 0.48, volume * 0.08); }
        else if (id.includes('meditation_stop')) { osc('sine', 392, 0.18, volume * 0.08, 220); }
        else if (id.includes('thunder_roll')) { noise(0.78, volume * 0.34, 160); osc('sawtooth', 72, 0.92, volume * 0.18, 38); osc('triangle', 118, 0.72, volume * 0.10, 56); }
        else if (id.includes('forest_wind')) { noise(0.58, volume * 0.26, 420); osc('sine', 120, 0.55, volume * 0.05, 90); }
        else if (id.includes('bird_chirp')) { osc('sine', 1220, 0.09, volume * 0.16, 1780); osc('triangle', 920, 0.08, volume * 0.08, 1280); }
        else if (id.includes('insect_trill')) { osc('square', 3600, 0.18, volume * 0.05, 4200); noise(0.12, volume * 0.06, 3400); }
        else if (id.includes('owl_hoot')) { osc('sine', 260, 0.48, volume * 0.18, 210); osc('triangle', 520, 0.38, volume * 0.07, 420); }
        else if (id.includes('water_lap')) { noise(0.24, volume * 0.23, 940); osc('sine', 180, 0.22, volume * 0.08, 130); }
        else if (id.includes('cave_drip')) { osc('sine', 980, 0.16, volume * 0.11, 1320); osc('triangle', 490, 0.22, volume * 0.05, 360); }
        else if (id.includes('cave_rock')) { noise(0.22, volume * 0.22, 260); osc('triangle', 86, 0.22, volume * 0.15, 54); }
        else if (id.includes('campfire_crackle')) { noise(0.16, volume * 0.14, 2400); noise(0.08, volume * 0.08, 5200); }
        else if (id.includes('town_murmur')) { noise(0.45, volume * 0.08, 380); osc('sine', 196, 0.44, volume * 0.04, 174); osc('triangle', 246, 0.40, volume * 0.035, 220); }
        else if (id.includes('heal')) { osc('sine', 523, 0.34, volume * 0.22, 784); osc('sine', 1046, 0.38, volume * 0.12); }
        else if (id.includes('pet_summon')) { osc('triangle', 247, 0.42, volume * 0.22, 494); osc('sine', 741, 0.38, volume * 0.14); }
        else if (id.includes('magic')) { osc('triangle', 330, 0.32, volume * 0.22, 660); osc('sine', 990, 0.32, volume * 0.12); }
        else if (id.includes('level')) { osc('sine', 523, 0.16, volume * 0.16, 659); setTimeout(() => this.playProceduralSfx?.('heal_chime', { volume: volume * 0.85 }), 60); }
        else { osc('sine', 660, 0.08, volume * 0.18, 880); }
        return true;
      };

      Game.prototype.inActiveCombatForAudio = function() {
        const p = this.player;
        if (!p || !p.alive) return false;
        if ((p.combatCooldown || 0) > 0 || p.autoAttack) return true;
        const target = this.getTarget?.();
        return Boolean(target && target.alive && Math.hypot(target.x - p.x, target.y - p.y) <= 7.5);
      };

      Game.prototype.isPlayerNearTownForAudio = function() {
        const p = this.player;
        if (!p || this.currentZone === 'cave') return false;
        const sx = Number(DR.CONFIG?.START_X || 0) + 0.5;
        const sy = Number(DR.CONFIG?.START_Y || 0) + 0.5;
        return Math.hypot(p.x - sx, p.y - sy) <= 13.5;
      };

      Game.prototype.audioSceneForCurrentState = function() {
        const state = this.audioSystem || this.initAudioSystem?.();
        const nowMs = performance.now();
        if (state?.forcedMusicScene && nowMs < Number(state.forcedMusicSceneUntil || 0)) {
          return { id: state.forcedMusicScene, scene: `test:${state.forcedMusicScene}`, priority: 90, fade: 0.22, reason: 'settings-test' };
        }
        if (state?.forcedMusicScene && nowMs >= Number(state.forcedMusicSceneUntil || 0)) {
          state.forcedMusicScene = '';
          state.forcedMusicSceneUntil = 0;
        }

        const inCombat = this.inActiveCombatForAudio?.() || false;
        if (inCombat && state) state.combatMusicHoldUntil = nowMs + 5200;
        if (inCombat || (state && nowMs < Number(state.combatMusicHoldUntil || 0))) {
          return { id: 'combat_pulse', scene: 'combat', priority: 80, fade: inCombat ? 0.22 : 0.45, reason: inCombat ? 'active-combat' : 'combat-release-hold' };
        }
        if (this.currentZone === 'cave' || this.currentZone === 'dungeon') {
          // The Silk Web Cavern dungeon gets its own dedicated theme; other caves
          // keep the generic cave ambience.
          if (this.dungeonSystem?.state?.active?.dungeonId === 'silk_web_cavern') {
            return { id: 'silk_web_cavern', scene: 'dungeon:silk_web_cavern', priority: 48, fade: 0.85, reason: 'silk-web-cavern' };
          }
          return { id: 'cave_ambience', scene: 'cave', priority: 45, fade: 0.85, reason: 'cave-zone' };
        }
        if (this.isPlayerNearTownForAudio?.()) {
          return { id: 'town_lantern', scene: 'town', priority: 35, fade: 1.0, reason: 'near-town' };
        }
        const zoneKey = this.currentZone === 'cave' ? (this.getActiveCaveZoneKey?.() || 'mossfang_cave') : 'dark_woods';
        return { id: this.zoneProperties?.[zoneKey]?.music || 'dark_woods', scene: 'overworld', priority: 20, fade: 1.05, reason: zoneKey };
      };

      Game.prototype.musicIdForCurrentZone = function() {
        return this.audioSceneForCurrentState?.().id || 'dark_woods';
      };

      Game.prototype.applyMusicScene = function(scene, options = {}) {
        const state = this.audioSystem || this.initAudioSystem?.();
        if (!state || !scene?.id) return false;
        const id = safeId(scene.id || 'dark_woods');
        const hasActiveMusic = Boolean(state.currentMusicSource || state.currentMusicElement || state.proceduralMusicNodes?.length);
        if (this.effectiveMusicVolume?.() <= 0) {
          if (hasActiveMusic) this.stopMusic?.(0.3);
          return false;
        }
        const nowMs = performance.now();
        const transitionGap = nowMs - Number(state.lastMusicTransitionAt || 0);
        if (id === state.currentMusicId && hasActiveMusic) {
          state.currentMusicScene = scene.scene || id;
          state.pendingMusicScene = '';
          return true;
        }
        if (transitionGap < 450 && hasActiveMusic && !options.force) {
          state.pendingMusicScene = id;
          return false;
        }
        state.currentMusicScene = scene.scene || id;
        state.pendingMusicScene = '';
        state.lastMusicTransitionAt = nowMs;
        state.musicTransitionCount = Number(state.musicTransitionCount || 0) + 1;
        return this.playMusic?.(id, { fade: Number(options.fade ?? scene.fade ?? 0.75) });
      };

      Game.prototype.updateAudioSystem = function(dt) {
        const state = this.audioSystem || this.initAudioSystem?.();
        if (!state || !state.enabled || !this.started) return;
        this.cleanupAudioVoices?.();
        this.cleanupMusicNodes?.(false);
        state.lastZoneMusicCheck += Number(dt) || 0;
        if (state.lastZoneMusicCheck < 0.32) return;
        state.lastZoneMusicCheck = 0;
        const scene = this.audioSceneForCurrentState?.() || { id: 'dark_woods', scene: 'overworld', fade: 1.0 };
        this.applyMusicScene?.(scene);
        this.updateAmbientAudioSystem?.(dt);
      };

      Game.prototype.playPendingZoneMusic = function() {
        if (!this.started) return;
        if (this.effectiveMusicVolume?.() <= 0) return;
        const scene = this.audioSceneForCurrentState?.() || { id: 'dark_woods', scene: 'overworld', fade: 0.1 };
        this.applyMusicScene?.(scene, { force: true, fade: 0.1 });
      };

      Game.prototype.testAudioMusicScene = function(id = 'dark_woods') {
        const state = this.audioSystem || this.initAudioSystem?.();
        if (!state) return false;
        const key = safeId(id || 'dark_woods');
        if (!MUSIC_MANIFEST[key]) return false;
        this.unlockAudioSystem?.();
        state.forcedMusicScene = key;
        state.forcedMusicSceneUntil = performance.now() + 8000;
        return this.applyMusicScene?.({ id: key, scene: `test:${key}`, fade: 0.18, reason: 'manual-test' }, { force: true, fade: 0.18 });
      };

      Game.prototype.stopMusic = function(fade = 0.4) {
        const state = this.audioSystem;
        const audioCtx = state?.ctx;
        if (!state) return;
        const fadeSeconds = Math.max(0, Number(fade) || 0);
        const source = state.currentMusicSource;
        const gain = state.currentMusicGain;
        const generation = ++state.musicGeneration;
        if (audioCtx && gain) {
          const endTime = now(audioCtx) + Math.max(0.02, fadeSeconds);
          try {
            gain.gain.cancelScheduledValues(now(audioCtx));
            gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value || 0.0001), now(audioCtx));
            gain.gain.exponentialRampToValueAtTime(0.0001, endTime);
          } catch (_err) {}
          if (source) {
            const entry = { source, gain, generation, stopAt: performance.now() + (fadeSeconds + 0.15) * 1000 };
            state.fadingMusicNodes.push(entry);
            source.onended = () => { try { source.disconnect(); } catch (_err) {} try { gain.disconnect(); } catch (_err) {} entry.ended = true; };
            try { source.stop(endTime + 0.03); } catch (_err) { entry.ended = true; }
          }
        }
        for (const node of state.proceduralMusicNodes || []) {
          try { node.stop?.(audioCtx ? now(audioCtx) + fadeSeconds + 0.03 : 0); } catch (_err) {}
          try { node.disconnect?.(); } catch (_err) {}
        }
        const element = state.currentMusicElement;
        if (element) {
          if (fadeSeconds > 0) state.fadingMusicElements.push({ element, fromVolume: clamp(element.volume, 0, 1), startedAt: performance.now(), durationMs: fadeSeconds * 1000 });
          else { try { element.pause(); element.removeAttribute('src'); element.load?.(); } catch (_err) {} }
        }
        state.proceduralMusicNodes = [];
        state.currentMusicSource = null;
        state.currentMusicGain = null;
        state.currentMusicElement = null;
        state.currentMusicElementId = '';
        state.currentMusicId = '';
        this.cleanupMusicNodes?.(fadeSeconds <= 0);
      };

      Game.prototype.cleanupMusicNodes = function(force = false) {
        const state = this.audioSystem;
        if (!state) return;
        const stamp = performance.now();
        state.fadingMusicNodes = (state.fadingMusicNodes || []).filter(entry => {
          if (!force && !entry.ended && stamp < Number(entry.stopAt || 0)) return true;
          try { entry.source?.stop?.(); } catch (_err) {}
          try { entry.source?.disconnect?.(); } catch (_err) {}
          try { entry.gain?.disconnect?.(); } catch (_err) {}
          return false;
        });
        state.fadingMusicElements = (state.fadingMusicElements || []).filter(entry => {
          const progress = force ? 1 : Math.min(1, (stamp - entry.startedAt) / Math.max(1, entry.durationMs));
          try { entry.element.volume = clamp(entry.fromVolume * (1 - progress), 0, 1); } catch (_err) {}
          if (progress < 1) return true;
          try { entry.element.pause(); entry.element.removeAttribute('src'); entry.element.load?.(); } catch (_err) {}
          return false;
        });
      };

      Game.prototype.playMusic = function(id, options = {}) {
        const state = this.audioSystem || this.initAudioSystem?.();
        if (!state || !state.enabled || state.muted || state.musicMuted) return false;
        const key = safeId(id || 'dark_woods');
        if (state.currentMusicId === key && (state.currentMusicSource || state.currentMusicElement)) return true;
        const audioCtx = this.ensureAudioContext?.();
        if (!state.unlocked) return false;
        this.cleanupMusicNodes?.(false);
        this.stopMusic?.(Number(options.fade ?? 0.45));
        const buffer = state.buffers.get(`music:${key}`);
        const targetGain = this.effectiveMusicVolume?.() || 0;
        if (targetGain <= 0.0001) return false;
        if (buffer && audioCtx) {
          try {
            const src = audioCtx.createBufferSource();
            const gain = audioCtx.createGain();
            src.buffer = buffer;
            src.loop = true;
            gain.gain.setValueAtTime(0.0001, now(audioCtx));
            gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, targetGain), now(audioCtx) + Math.max(0.05, Number(options.fade || 0.7)));
            src.connect(gain);
            gain.connect(audioCtx.destination);
            src.start();
            state.currentMusicSource = src;
            state.currentMusicGain = gain;
            state.currentMusicId = key;
            return true;
          } catch (_err) {}
        }
        const path = MUSIC_MANIFEST[key];
        if (isLikelyBrowserFetchable() && path && !state.failed.has(`music:${key}`)) {
          this.loadAudioBuffer?.(`music:${key}`, path).then(loaded => {
            // Still-relevant? Zone tracks re-check the current zone; the menu theme
            // is relevant as long as the world hasn't been entered yet.
            const stillWanted = this.musicIdForCurrentZone?.() === key || (!this.started && key === 'menu_theme');
            if (loaded && !state.currentMusicId && stillWanted) this.playMusic?.(key, { fade: 0.12 });
          });
          return false;
        }
        if (path && typeof Audio === 'function' && !state.failedMusicElements?.has?.(key)) {
          try {
            const element = new Audio(path);
            element.loop = true;
            element.preload = 'auto';
            element.volume = clamp(targetGain, 0, 1);
            const generation = state.musicGeneration;
            const started = element.play();
            state.currentMusicElement = element;
            state.currentMusicElementId = key;
            state.currentMusicId = key;
            started?.catch?.(() => {
              if (state.currentMusicElement === element && state.musicGeneration === generation) {
                state.currentMusicElement = null; state.currentMusicElementId = ''; state.currentMusicId = '';
              }
              try { element.pause(); element.removeAttribute('src'); } catch (_err) {}
              if (!state.failedMusicElements) state.failedMusicElements = new Set();
              state.failedMusicElements.add(key);
              if (!state.musicAssetWarningIds) state.musicAssetWarningIds = new Set();
              if (!state.musicAssetWarningIds.has(key)) { state.musicAssetWarningIds.add(key); console.warn(`[Dream Realms] Music asset could not play: ${path}`); }
            });
            return true;
          } catch (_err) {}
        }
        if (state.allowProceduralMusicFallback === true) return this.startProceduralMusic?.(key, targetGain, Number(options.fade || 0.7)) === true;
        return false;
      };

      Game.prototype.startProceduralMusic = function(id, gainValue = 0.2, fade = 0.7) {
        const state = this.audioSystem || this.initAudioSystem?.();
        const audioCtx = this.ensureAudioContext?.();
        if (!state || !audioCtx || !state.unlocked || !state.enabled || state.muted || state.musicMuted) return false;
        this.stopMusic?.(0.25);
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.0001, now(audioCtx));
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), now(audioCtx) + Math.max(0.05, fade));
        gain.connect(audioCtx.destination);
        const cave = id === 'cave_ambience';
        const combat = id === 'combat_pulse';
        const town = id === 'town_lantern';
        const freqs = cave ? [73.42, 110.0, 146.83] : combat ? [110.0, 164.81, 220.0] : town ? [196.0, 246.94, 329.63] : [146.83, 220.0, 293.66];
        const nodes = [gain];
        for (let i = 0; i < freqs.length; i++) {
          const osc = audioCtx.createOscillator();
          const oscGain = audioCtx.createGain();
          osc.type = i === 0 ? 'sine' : 'triangle';
          osc.frequency.value = freqs[i];
          oscGain.gain.value = cave ? 0.12 / (i + 1) : combat ? 0.13 / (i + 1) : town ? 0.09 / (i + 1) : 0.10 / (i + 1);
          osc.connect(oscGain);
          oscGain.connect(gain);
          osc.start();
          nodes.push(osc, oscGain);
        }
        const lfo = audioCtx.createOscillator();
        const lfoGain = audioCtx.createGain();
        lfo.frequency.value = cave ? 0.045 : combat ? 0.18 : town ? 0.035 : 0.06;
        lfoGain.gain.value = gainValue * 0.18;
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        lfo.start();
        nodes.push(lfo, lfoGain);
        state.currentMusicGain = gain;
        state.currentMusicSource = null;
        state.proceduralMusicNodes = nodes;
        return true;
      };
    }
  };
})();
