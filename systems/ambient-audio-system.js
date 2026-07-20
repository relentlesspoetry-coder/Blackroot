// Dream Realms ambient audio system
// V0.12.74 owner: low-frequency positional ambience, day/night audio cues, cave ambience one-shots, weather-reactive ambience, and ambient-density controls.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const TILE = () => DR.TILE || {};

  function clamp(value, min, max) {
    const n = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function phaseKey(game) {
    const light = game?.getWorldLightState?.() || {};
    return String(light.phaseKey || game?.worldTime?.phaseKey || 'day');
  }

  function weatherCategory(game) {
    const visual = game?.getWeatherVisualState?.() || {};
    return String(visual.category || visual.weatherCategory || visual.key || game?.weatherState?.currentWeather || 'clear').toLowerCase();
  }

  function nearWater(game, radius = 5) {
    const player = game?.player;
    const map = game?.map;
    if (!player || !map) return false;
    const water = TILE().WATER;
    const px = Math.floor(player.x);
    const py = Math.floor(player.y);
    for (let y = py - radius; y <= py + radius; y++) {
      for (let x = px - radius; x <= px + radius; x++) {
        if (map?.[y]?.[x]?.type === water) return true;
      }
    }
    return false;
  }

  function positionNearPlayer(game, radiusMin = 3, radiusMax = 9) {
    const p = game?.player;
    if (!p) return {};
    const a = Math.random() * Math.PI * 2;
    const r = randomBetween(radiusMin, radiusMax);
    return { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r };
  }

  function createTimer(min, max, initial = 0) {
    return { t: initial || randomBetween(min, max), min, max };
  }

  function tickTimer(timer, dt) {
    timer.t -= clamp(dt, 0, 1);
    if (timer.t > 0) return false;
    timer.t = randomBetween(timer.min, timer.max);
    return true;
  }

  DR.AmbientAudioSystem = {
    install(Game) {
      if (!Game || !Game.prototype) return;

      Game.prototype.initAmbientAudioSystem = function() {
        if (this.ambientAudioSystem) return this.ambientAudioSystem;
        this.ambientAudioSystem = {
          enabled: true,
          forestWind: createTimer(6.0, 13.0, 2.0),
          bird: createTimer(4.0, 9.0, 3.0),
          insect: createTimer(3.6, 8.5, 4.0),
          owl: createTimer(18.0, 38.0, 14.0),
          water: createTimer(2.2, 5.8, 2.4),
          caveDrip: createTimer(2.4, 7.0, 1.0),
          caveRock: createTimer(12.0, 28.0, 9.0),
          fire: createTimer(1.4, 3.6, 1.4),
          town: createTimer(9.0, 18.0, 6.0),
          rainWind: createTimer(4.0, 9.0, 3.0),
          lastThunderAt: 0,
          lastContextKey: ''
        };
        return this.ambientAudioSystem;
      };

      Game.prototype.ambientAudioContext = function() {
        const p = this.player;
        const isCave = this.currentZone === 'cave' || this.currentZone === 'dungeon';
        const phase = phaseKey(this);
        const weather = weatherCategory(this);
        const night = ['dusk', 'night', 'latenight', 'lateNight'].includes(phase);
        const water = nearWater(this, 5);
        const town = this.isPlayerNearTownForAudio?.() || false;
        return { player: p, isCave, phase, weather, night, water, town };
      };

      Game.prototype.playAmbientAudioAtPlayer = function(eventName, options = {}) {
        const audio = this.audioSystem || this.initAudioSystem?.() || {};
        const density = clamp(audio.ambientDensity ?? 0.78, 0, 1);
        if (density <= 0 || Math.random() > density) return false;
        const pos = positionNearPlayer(this, Number(options.minRadius || 3), Number(options.maxRadius || 9));
        return this.playAudioEvent?.(eventName, {
          ...pos,
          volume: options.volume,
          radius: options.radius || 18,
          cooldown: options.cooldown,
          rate: options.rate,
          rateJitter: options.rateJitter,
          channel: 'ambient'
        });
      };

      Game.prototype.updateAmbientAudioSystem = function(dt) {
        const ambient = this.ambientAudioSystem || this.initAmbientAudioSystem?.();
        const audio = this.audioSystem || this.initAudioSystem?.();
        if (!ambient || !audio || !ambient.enabled || !this.started || !this.player) return;
        if (!audio.unlocked || !audio.enabled || audio.muted || audio.sfxMuted || audio.ambientMuted || Number(audio.ambientVolume || 0) <= 0) return;

        const ctx = this.ambientAudioContext?.() || {};
        const safeDt = clamp(dt, 0, 0.5);
        const weather = ctx.weather || 'clear';
        const raining = weather.includes('rain') || weather.includes('thunder');
        const windy = weather.includes('storm') || weather.includes('sandstorm') || weather.includes('fog') || raining;

        if (ctx.isCave) {
          if (tickTimer(ambient.caveDrip, safeDt)) this.playAmbientAudioAtPlayer?.('cave_drip', { volume: 0.19, radius: 24, minRadius: 4, maxRadius: 12 });
          if (tickTimer(ambient.caveRock, safeDt)) this.playAmbientAudioAtPlayer?.('cave_rock', { volume: 0.17, radius: 27, minRadius: 7, maxRadius: 15 });
          return;
        }

        if (tickTimer(ambient.forestWind, safeDt)) this.playAmbientAudioAtPlayer?.('forest_wind', { volume: windy ? 0.27 : 0.16, radius: 30, minRadius: 8, maxRadius: 18 });
        if (windy && tickTimer(ambient.rainWind, safeDt)) this.playAmbientAudioAtPlayer?.('forest_wind', { volume: 0.20, radius: 32, minRadius: 10, maxRadius: 20, rate: 0.84 + Math.random() * 0.12 });

        if (ctx.water && tickTimer(ambient.water, safeDt)) this.playAmbientAudioAtPlayer?.('water_lap', { volume: raining ? 0.23 : 0.16, radius: 18, minRadius: 3, maxRadius: 8 });

        if (ctx.town) {
          if (tickTimer(ambient.fire, safeDt)) this.playAmbientAudioAtPlayer?.('campfire_crackle', { volume: 0.14, radius: 13, minRadius: 2, maxRadius: 6 });
          if (tickTimer(ambient.town, safeDt)) this.playAmbientAudioAtPlayer?.('town_murmur', { volume: 0.11, radius: 18, minRadius: 4, maxRadius: 10 });
        }

        if (ctx.night) {
          if (tickTimer(ambient.insect, safeDt)) this.playAmbientAudioAtPlayer?.('insect_trill', { volume: 0.12, radius: 18, minRadius: 3, maxRadius: 10 });
          if (tickTimer(ambient.owl, safeDt)) this.playAmbientAudioAtPlayer?.('owl_hoot', { volume: 0.17, radius: 36, minRadius: 12, maxRadius: 24 });
        } else if (!raining) {
          if (tickTimer(ambient.bird, safeDt)) this.playAmbientAudioAtPlayer?.('bird_chirp', { volume: 0.14, radius: 24, minRadius: 5, maxRadius: 16 });
        }
      };

      Game.prototype.playWeatherThunderAudio = function(intensity = 1) {
        const ambient = this.ambientAudioSystem || this.initAmbientAudioSystem?.();
        if (!ambient) return false;
        const now = performance.now();
        if (now - Number(ambient.lastThunderAt || 0) < 5500) return false;
        ambient.lastThunderAt = now;
        return this.playAmbientAudioAtPlayer?.('thunder_roll', {
          volume: 0.30 + clamp(intensity, 0, 2) * 0.18,
          radius: 64,
          minRadius: 18,
          maxRadius: 34,
          cooldown: 4.5
        });
      };
    }
  };
})();
