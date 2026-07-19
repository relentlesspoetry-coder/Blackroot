// Dream Realms weather system
// V0.12.41 owner: biome/season/elevation-aware weather, climate state, particles, thunder, and weather HUD.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  const SAVE_VERSION = 1;
  const DEFAULT_STATE = Object.freeze({
    version: SAVE_VERSION,
    biome: 'temperate_forest',
    season: 'spring',
    elevation: 850,
    temperature: 18,
    humidity: 62,
    windSpeed: 14,
    currentWeather: 'clear',
    previousWeather: 'clear',
    transitionProgress: 1,
    isTransitioning: false,
    weatherTimer: 420,
    weatherDuration: 420,
    climateTimer: 0,
    lightningFlash: 0,
    lightningSeed: 0,
    particleSeed: 1
  });

  const WEATHER_TRANSITION_SECONDS = 8;
  const CLIMATE_REFRESH_SECONDS = 12;

  const BIOMES = Object.freeze({
    temperate_forest: Object.freeze({
      name: 'Temperate Forest', icon: '🌳', baseTemp: 15, baseHumidity: 60, baseWind: 10, elevationRange: [200, 1500],
      allowedWeather: Object.freeze(['clear', 'partly_cloudy', 'overcast', 'light_fog', 'fog', 'heavy_fog', 'light_rain', 'rain', 'heavy_rain', 'thunder_light_rain', 'thunder_rain', 'thunder_heavy_rain', 'light_snow', 'snow', 'heavy_snow']),
      snowAllowed: true, snowMinElevation: 800, sandstormAllowed: false
    }),
    desert: Object.freeze({
      name: 'Desert', icon: '🏜️', baseTemp: 35, baseHumidity: 15, baseWind: 18, elevationRange: [-100, 800],
      allowedWeather: Object.freeze(['clear', 'partly_cloudy', 'light_fog', 'fog', 'sandstorm_light', 'sandstorm', 'sandstorm_heavy', 'light_rain', 'rain']),
      snowAllowed: false, snowMinElevation: 9999, sandstormAllowed: true
    }),
    tundra: Object.freeze({
      name: 'Tundra', icon: '❄️', baseTemp: -5, baseHumidity: 40, baseWind: 22, elevationRange: [0, 1500],
      allowedWeather: Object.freeze(['clear', 'partly_cloudy', 'overcast', 'light_fog', 'fog', 'heavy_fog', 'light_snow', 'snow', 'heavy_snow', 'light_rain', 'rain']),
      snowAllowed: true, snowMinElevation: 0, sandstormAllowed: false
    }),
    mountain: Object.freeze({
      name: 'Mountain', icon: '🏔️', baseTemp: 2, baseHumidity: 45, baseWind: 30, elevationRange: [1500, 5000],
      allowedWeather: Object.freeze(['clear', 'partly_cloudy', 'overcast', 'light_fog', 'fog', 'heavy_fog', 'light_snow', 'snow', 'heavy_snow', 'light_rain', 'rain', 'heavy_rain', 'thunder_light_rain', 'thunder_rain', 'thunder_heavy_rain']),
      snowAllowed: true, snowMinElevation: 1200, sandstormAllowed: false
    }),
    swamp: Object.freeze({
      name: 'Swamp', icon: '🌿', baseTemp: 25, baseHumidity: 85, baseWind: 6, elevationRange: [0, 300],
      allowedWeather: Object.freeze(['clear', 'partly_cloudy', 'overcast', 'light_fog', 'fog', 'heavy_fog', 'light_rain', 'rain', 'heavy_rain', 'thunder_light_rain', 'thunder_rain', 'thunder_heavy_rain']),
      snowAllowed: false, snowMinElevation: 9999, sandstormAllowed: false
    }),
    plains: Object.freeze({
      name: 'Plains', icon: '🌾', baseTemp: 20, baseHumidity: 50, baseWind: 16, elevationRange: [100, 800],
      allowedWeather: Object.freeze(['clear', 'partly_cloudy', 'overcast', 'light_fog', 'fog', 'light_rain', 'rain', 'heavy_rain', 'thunder_light_rain', 'thunder_rain', 'thunder_heavy_rain', 'light_snow', 'snow']),
      snowAllowed: true, snowMinElevation: 500, sandstormAllowed: false
    }),
    cave: Object.freeze({
      name: 'Cave Interior', icon: '⛰', baseTemp: 9, baseHumidity: 72, baseWind: 2, elevationRange: [0, 1000],
      allowedWeather: Object.freeze(['clear']), snowAllowed: false, snowMinElevation: 9999, sandstormAllowed: false
    })
  });

  const SEASONS = Object.freeze({
    spring: Object.freeze({ tempMod: 0, humidMod: 5, name: 'Spring', icon: '🌸' }),
    summer: Object.freeze({ tempMod: 12, humidMod: -10, name: 'Summer', icon: '☀️' }),
    autumn: Object.freeze({ tempMod: -3, humidMod: 10, name: 'Autumn', icon: '🍂' }),
    winter: Object.freeze({ tempMod: -15, humidMod: -5, name: 'Winter', icon: '❄️' })
  });

  const WEATHER = Object.freeze({
    clear: weatherDef('Clear', '☀️', 'clear', 'none', 0, 0, 0, ['#3a7bd5', '#6db3f2', '#b8d4f0'], 0, 0, 0, 0, false, 0),
    partly_cloudy: weatherDef('Partly Cloudy', '⛅', 'cloudy', 'light', -1, 5, 2, ['#5c8ec9', '#8db8e0', '#c4daf0'], 18, 0, 0, 0, false, 0),
    overcast: weatherDef('Overcast', '☁️', 'cloudy', 'heavy', -3, 10, 4, ['#5d6b7b', '#7f8c9b', '#a4b0bd'], 42, 0.16, 0, 0, false, 0),
    light_fog: weatherDef('Light Fog', '🌫️', 'fog', 'light', -2, 15, -4, ['#8f9daa', '#aeb9c3', '#c7d0d8'], 88, 0.58, 0, 0, false, 0),
    fog: weatherDef('Fog', '🌫️', 'fog', 'medium', -4, 25, -7, ['#98a2ad', '#b7c0c8', '#ccd5dc'], 150, 0.92, 0, 0, false, 0),
    heavy_fog: weatherDef('Heavy Fog', '🌫️', 'fog', 'heavy', -6, 35, -10, ['#a9afb6', '#c2c7ce', '#d8dde2'], 240, 1.35, 0, 0, false, 0),
    light_rain: weatherDef('Light Rain', '🌦️', 'rain', 'light', -3, 30, 5, ['#526678', '#708595', '#91a4b0'], 210, 0.26, 0.62, 0, false, 0),
    rain: weatherDef('Rain', '🌧️', 'rain', 'medium', -5, 45, 8, ['#3d4e5d', '#596c7c', '#778a99'], 360, 0.36, 0.95, 0, false, 0),
    heavy_rain: weatherDef('Heavy Rain', '🌧️', 'rain', 'heavy', -7, 55, 12, ['#2e3e4c', '#4d6070', '#6b7d8c'], 520, 0.48, 1.25, 0, false, 0),
    light_snow: weatherDef('Light Snow', '🌨️', 'snow', 'light', -8, 20, 3, ['#8a9aaa', '#bcc8d4', '#dde4ec'], 40, 0.1, 0, 0.3, false, 0),
    snow: weatherDef('Snow', '❄️', 'snow', 'medium', -12, 30, 6, ['#7a8a9a', '#aab8c4', '#d0dae2'], 100, 0.2, 0, 0.6, false, 0),
    heavy_snow: weatherDef('Heavy Snow', '❄️', 'snow', 'heavy', -18, 40, 10, ['#6a7a8a', '#98a8b4', '#c8d2da'], 180, 0.3, 0, 1, false, 0),
    thunder_light_rain: weatherDef('Thunderstorm (Light Rain)', '⛈️', 'thunder', 'light', -4, 35, 15, ['#202a38', '#3d4b5d', '#5c6d7e'], 260, 0.32, 0.72, 0, true, 0),
    thunder_rain: weatherDef('Thunderstorm (Rain)', '⛈️', 'thunder', 'medium', -6, 48, 20, ['#141e2a', '#2d4050', '#4d6272'], 430, 0.42, 1.0, 0, true, 0),
    thunder_heavy_rain: weatherDef('Thunderstorm (Heavy Rain)', '⛈️', 'thunder', 'heavy', -8, 58, 28, ['#0b1420', '#233443', '#405565'], 620, 0.54, 1.35, 0, true, 0),
    sandstorm_light: weatherDef('Light Sandstorm', '💨', 'sandstorm', 'light', 2, -20, 20, ['#c4a882', '#d4bc98', '#e0d0b0'], 60, 0.2, 0, 0, false, 0.3),
    sandstorm: weatherDef('Sandstorm', '💨', 'sandstorm', 'medium', 4, -35, 30, ['#b89870', '#ccac88', '#dcc4a0'], 140, 0.4, 0, 0, false, 0.6),
    sandstorm_heavy: weatherDef('Heavy Sandstorm', '💨', 'sandstorm', 'heavy', 6, -50, 40, ['#a08060', '#c0a080', '#d4b898'], 220, 0.6, 0, 0, false, 1)
  });

  function weatherDef(name, icon, category, intensity, tempMod, humidMod, windMod, sky, particleDensity, fogDensity, rainIntensity, snowIntensity, thunder, sandstormIntensity) {
    return Object.freeze({
      name, icon, category, intensity, tempMod, humidMod, windMod,
      skyColors: Object.freeze({ top: sky[0], middle: sky[1], bottom: sky[2] }),
      particleDensity, fogDensity, rainIntensity, snowIntensity, thunder, sandstormIntensity
    });
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function safeInt(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : fallback;
  }

  function seededUnit(seed) {
    const n = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  function nextSeed(state) {
    state.particleSeed = ((Number(state.particleSeed) || 1) * 1664525 + 1013904223) >>> 0;
    return state.particleSeed;
  }

  function hexToRgb(hex) {
    const clean = String(hex || '').replace('#', '').trim();
    if (clean.length !== 6) return { r: 0, g: 0, b: 0 };
    return {
      r: parseInt(clean.slice(0, 2), 16) || 0,
      g: parseInt(clean.slice(2, 4), 16) || 0,
      b: parseInt(clean.slice(4, 6), 16) || 0
    };
  }

  function mixHex(a, b, t) {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    const f = clamp(t, 0, 1);
    const r = Math.round(ca.r + (cb.r - ca.r) * f).toString(16).padStart(2, '0');
    const g = Math.round(ca.g + (cb.g - ca.g) * f).toString(16).padStart(2, '0');
    const bl = Math.round(ca.b + (cb.b - ca.b) * f).toString(16).padStart(2, '0');
    return `#${r}${g}${bl}`;
  }

  function rgba(hex, alpha) {
    const c = hexToRgb(hex);
    return `rgba(${c.r},${c.g},${c.b},${clamp(alpha, 0, 1).toFixed(3)})`;
  }

  function easeInOutCubic(t) {
    const x = clamp(t, 0, 1);
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  function weatherDefFor(key) {
    return WEATHER[key] || WEATHER.clear;
  }

  function biomeFor(key) {
    return BIOMES[key] || BIOMES.temperate_forest;
  }

  function seasonFor(key) {
    return SEASONS[key] || SEASONS.spring;
  }

  function zoneBiome(game) {
    if (game?.currentZone === 'cave' || game?.currentZone === 'dungeon') return 'cave';
    const props = game?.zoneProperties?.dark_woods || game?.zoneProperties?.overworld || {};
    return String(props.biome || props.weatherBiome || 'temperate_forest');
  }

  function zoneElevation(game) {
    if (game?.currentZone === 'cave' || game?.currentZone === 'dungeon') return 120;
    const props = game?.zoneProperties?.dark_woods || game?.zoneProperties?.overworld || {};
    return safeInt(props.elevation, DEFAULT_STATE.elevation);
  }

  function rollClimate(state, game, force = false) {
    const nextBiome = zoneBiome(game);
    const nextElevation = zoneElevation(game);
    if (force || state.biome !== nextBiome || Math.abs(Number(state.elevation || 0) - nextElevation) > 1) {
      state.biome = BIOMES[nextBiome] ? nextBiome : 'temperate_forest';
      state.elevation = nextElevation;
      if (state.biome === 'cave') {
        state.currentWeather = 'clear';
        state.previousWeather = 'clear';
        state.isTransitioning = false;
        state.transitionProgress = 1;
      }
    }
    const biome = biomeFor(state.biome);
    const season = seasonFor(state.season);
    const range = Math.max(1, biome.elevationRange[1] - biome.elevationRange[0]);
    const elevFactor = clamp((state.elevation - biome.elevationRange[0]) / range, 0, 1);
    const jitterSeed = (Number(state.particleSeed) || 1) + Math.floor((game?.worldTime?.day || 1) * 37) + Math.floor((game?.worldTime?.minuteOfDay || 0) / 30) * 11;
    const tempJitter = (seededUnit(jitterSeed + 1) - 0.5) * 4;
    const humidJitter = (seededUnit(jitterSeed + 2) - 0.5) * 10;
    const windJitter = (seededUnit(jitterSeed + 3) - 0.5) * 8;
    state.temperature = Math.round(biome.baseTemp + season.tempMod - elevFactor * 12 + tempJitter);
    state.humidity = Math.round(clamp(biome.baseHumidity + season.humidMod + humidJitter, 5, 100));
    state.windSpeed = Math.round(clamp(biome.baseWind + windJitter + elevFactor * 10, 0, 95));
    state.climateTimer = CLIMATE_REFRESH_SECONDS;
  }

  function allowedWeather(state, game = null) {
    if (game?.currentZone === 'cave' || game?.currentZone === 'dungeon' || state.biome === 'cave') return ['clear'];
    const biome = biomeFor(state.biome);
    let allowed = [...biome.allowedWeather];
    if (!biome.snowAllowed || biome.snowMinElevation > state.elevation) allowed = allowed.filter(w => !w.includes('snow'));
    if (!biome.sandstormAllowed) allowed = allowed.filter(w => !w.includes('sandstorm'));
    if (state.temperature > 30) allowed = allowed.filter(w => !w.includes('snow'));
    if (state.temperature < -5) allowed = allowed.filter(w => !w.includes('rain') && !w.includes('thunder'));
    if (state.humidity < 20) allowed = allowed.filter(w => !w.includes('fog') && !w.includes('rain') && !w.includes('thunder'));
    if (state.windSpeed < 8) allowed = allowed.filter(w => !w.includes('sandstorm_heavy') && !w.includes('thunder_heavy'));
    return allowed.length ? allowed : ['clear'];
  }

  function weightedWeatherPick(state, game) {
    const allowed = allowedWeather(state, game);
    if (allowed.length <= 1) return allowed[0] || 'clear';
    const weights = allowed.map(key => {
      const w = weatherDefFor(key);
      let score = 1;
      if (w.category === 'clear') score += state.humidity < 55 ? 5 : 2;
      if (w.category === 'cloudy') score += 3;
      if (w.category === 'fog') score += Math.max(0, (state.humidity - 45) / 12) + (state.windSpeed < 10 ? 2 : 0);
      if (w.category === 'rain') score += Math.max(0, (state.humidity - 50) / 10);
      if (w.category === 'thunder') score += Math.max(0, (state.humidity - 68) / 14) + (state.windSpeed > 18 ? 1.5 : 0);
      if (w.category === 'snow') score += state.temperature <= 2 ? 4 : 0;
      if (w.category === 'sandstorm') score += state.windSpeed > 20 ? 3 : 0;
      if (w.intensity === 'heavy') score *= 0.46;
      if (w.intensity === 'medium') score *= 0.78;
      return Math.max(0.2, score);
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < allowed.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return allowed[i];
    }
    return allowed[allowed.length - 1];
  }

  function startWeatherTransition(state, key, duration = null) {
    const next = WEATHER[key] ? key : 'clear';
    if (next === state.currentWeather && !state.isTransitioning) return false;
    state.previousWeather = state.currentWeather || 'clear';
    state.currentWeather = next;
    state.isTransitioning = true;
    state.transitionProgress = 0;
    state.weatherDuration = duration || (300 + Math.random() * 420);
    state.weatherTimer = state.weatherDuration;
    nextSeed(state);
    return true;
  }

  function safeWeatherState(value, game = null) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const state = { ...DEFAULT_STATE };
    state.version = SAVE_VERSION;
    state.biome = BIOMES[source.biome] ? String(source.biome) : zoneBiome(game);
    if (!BIOMES[state.biome]) state.biome = 'temperate_forest';
    state.season = SEASONS[source.season] ? String(source.season) : DEFAULT_STATE.season;
    state.elevation = safeInt(source.elevation, zoneElevation(game));
    state.temperature = safeInt(source.temperature, DEFAULT_STATE.temperature);
    state.humidity = clamp(source.humidity ?? DEFAULT_STATE.humidity, 5, 100);
    state.windSpeed = clamp(source.windSpeed ?? DEFAULT_STATE.windSpeed, 0, 120);
    state.currentWeather = WEATHER[source.currentWeather] ? String(source.currentWeather) : DEFAULT_STATE.currentWeather;
    state.previousWeather = WEATHER[source.previousWeather] ? String(source.previousWeather) : state.currentWeather;
    state.transitionProgress = clamp(source.transitionProgress ?? 1, 0, 1);
    state.isTransitioning = Boolean(source.isTransitioning && state.transitionProgress < 1);
    state.weatherDuration = clamp(source.weatherDuration ?? DEFAULT_STATE.weatherDuration, 90, 1200);
    state.weatherTimer = clamp(source.weatherTimer ?? state.weatherDuration, 0, 1200);
    state.climateTimer = clamp(source.climateTimer ?? 0, 0, CLIMATE_REFRESH_SECONDS);
    state.lightningFlash = clamp(source.lightningFlash ?? 0, 0, 1);
    state.lightningSeed = safeInt(source.lightningSeed, 0);
    state.particleSeed = safeInt(source.particleSeed, 1) >>> 0;
    return state;
  }

  function visualState(state, game = null) {
    if (!state) state = safeWeatherState(null, game);
    const current = weatherDefFor(state.currentWeather);
    const previous = weatherDefFor(state.previousWeather);
    const t = easeInOutCubic(state.isTransitioning ? state.transitionProgress : 1);
    const skyTop = mixHex(previous.skyColors.top, current.skyColors.top, t);
    const skyMid = mixHex(previous.skyColors.middle, current.skyColors.middle, t);
    const skyBottom = mixHex(previous.skyColors.bottom, current.skyColors.bottom, t);
    const caveSuppressed = game?.currentZone === 'cave' || game?.currentZone === 'dungeon' || state.biome === 'cave';
    return {
      ...current,
      key: state.currentWeather,
      previousKey: state.previousWeather,
      transitionBlend: t,
      skyTop,
      skyMid,
      skyBottom,
      weatherSkyInfluence: caveSuppressed ? 0 : clamp(0.34 + current.fogDensity * 0.48 + current.rainIntensity * 0.50 + current.snowIntensity * 0.28 + current.sandstormIntensity * 0.38, 0, 0.92),
      darknessAdd: caveSuppressed ? 0 : clamp(current.rainIntensity * 0.20 + current.fogDensity * 0.08 + current.sandstormIntensity * 0.14 + (current.thunder ? 0.16 : 0), 0, 0.42),
      visibilityLoss: caveSuppressed ? 0 : clamp(current.fogDensity * 1.08 + current.rainIntensity * 0.36 + current.snowIntensity * 0.25 + current.sandstormIntensity * 0.60, 0, 0.96),
      fogBoost: caveSuppressed ? 0 : clamp(1 + current.fogDensity * 3.2 + current.rainIntensity * 1.15 + current.sandstormIntensity * 1.35, 1, 5.2),
      fireflySuppression: caveSuppressed ? 0 : clamp(current.rainIntensity * 0.7 + current.snowIntensity * 0.45 + current.sandstormIntensity, 0, 0.95),
      particleDensity: caveSuppressed ? 0 : current.particleDensity,
      lightningFlash: caveSuppressed ? 0 : clamp(state.lightningFlash || 0, 0, 1),
      biome: biomeFor(state.biome),
      season: seasonFor(state.season),
      climate: { temperature: state.temperature, humidity: state.humidity, windSpeed: state.windSpeed, elevation: state.elevation }
    };
  }

  function particleKind(visual) {
    if (visual.rainIntensity > 0) return 'rain';
    if (visual.snowIntensity > 0) return 'snow';
    if (visual.sandstormIntensity > 0) return 'sandstorm';
    if (visual.fogDensity > 0.32) return 'fog';
    return 'cloud';
  }

  function particleCount(visual, foreground) {
    const density = Number(visual.particleDensity) || 0;
    const rainBonus = Number(visual.rainIntensity || 0) * 120;
    const fogBonus = Number(visual.fogDensity || 0) * 78;
    const count = Math.floor((density + rainBonus + fogBonus) * (foreground ? 0.78 : 0.46));
    return clamp(count, 0, foreground ? 620 : 420);
  }

  function drawWeatherParticle(ctx, visual, seed, foreground, now, w, h) {
    const kind = particleKind(visual);
    if (kind === 'cloud') return;
    const r1 = seededUnit(seed + 1);
    const r2 = seededUnit(seed + 2);
    const r3 = seededUnit(seed + 3);
    const r4 = seededUnit(seed + 4);
    const wind = (visual.climate.windSpeed || 0) / 30;
    const speedMul = foreground ? 1 : 0.62;
    const xDrift = now * (18 + visual.climate.windSpeed * 1.5) * speedMul;
    let x = (r1 * w + xDrift + r3 * 80) % (w + 90) - 45;
    let y;
    ctx.save();
    if (kind === 'rain') {
      const speed = (430 + r4 * 340) * speedMul * (0.70 + visual.rainIntensity);
      y = (r2 * h + now * speed) % (h + 80) - 40;
      const len = (foreground ? 26 : 16) + visual.rainIntensity * (foreground ? 42 : 26) + r3 * 16;
      ctx.globalAlpha = clamp((foreground ? 0.86 : 0.58) * (0.62 + visual.rainIntensity * 0.85), 0, foreground ? 1 : 0.78);
      ctx.strokeStyle = 'rgba(210,232,252,0.98)';
      ctx.lineWidth = foreground ? 2.25 : 1.45;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - wind * 7.5 - 3, y + len);
      ctx.stroke();
      if (foreground && visual.rainIntensity >= 0.70 && r3 > 0.72) {
        ctx.globalAlpha = clamp(visual.rainIntensity * 0.28, 0, 0.32);
        ctx.strokeStyle = 'rgba(210,230,245,0.75)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - 7, y + len + 4);
        ctx.lineTo(x + 8, y + len + 1);
        ctx.stroke();
      }
    } else if (kind === 'snow') {
      const speed = (22 + r4 * 44) * speedMul * (0.5 + visual.snowIntensity);
      y = (r2 * h + now * speed) % (h + 30) - 15;
      x += Math.sin(now * (0.8 + r4) + seed) * (foreground ? 9 : 4);
      const size = (foreground ? 1.8 : 1.1) + r3 * (foreground ? 2.2 : 1.3);
      ctx.globalAlpha = (foreground ? 0.68 : 0.38) * (0.55 + visual.snowIntensity * 0.45);
      ctx.fillStyle = '#f4f8ff';
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'sandstorm') {
      const speed = (170 + r4 * 190) * speedMul * (0.6 + visual.sandstormIntensity);
      y = (r2 * h + now * speed * 0.55) % (h + 70) - 35;
      const size = (foreground ? 1.5 : 0.9) + r3 * (foreground ? 2.4 : 1.2);
      ctx.globalAlpha = (foreground ? 0.48 : 0.30) * (0.45 + visual.sandstormIntensity * 0.75);
      ctx.fillStyle = '#d3b183';
      ctx.beginPath();
      ctx.ellipse(x, y, size * (1.4 + wind * 0.2), size * 0.72, -0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'fog') {
      const speed = (10 + r4 * 22) * speedMul;
      x = (r1 * (w + 320) + now * speed * (0.55 + wind * 0.28)) % (w + 320) - 160;
      y = h * (0.28 + r2 * 0.68);
      const radius = (foreground ? 92 : 62) + r3 * (foreground ? 132 : 86);
      const alpha = clamp((foreground ? 0.245 : 0.155) * visual.fogDensity, 0, foreground ? 0.34 : 0.22);
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, `rgba(214,224,230,${alpha.toFixed(3)})`);
      grad.addColorStop(0.58, `rgba(205,216,224,${(alpha * 0.62).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(205,216,224,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(x, y, radius * 1.75, radius * 0.42, Math.sin(now * 0.11 + seed) * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRainCurtain(ctx, visual, now, w, h, seed) {
    const rain = Number(visual.rainIntensity || 0);
    if (rain <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = clamp(0.14 + rain * 0.25, 0.16, 0.48);
    const veil = ctx.createLinearGradient(0, 0, w, h);
    veil.addColorStop(0, 'rgba(155,190,220,0)');
    veil.addColorStop(0.5, 'rgba(175,210,238,0.38)');
    veil.addColorStop(1, 'rgba(155,190,220,0)');
    ctx.fillStyle = veil;
    const drift = (now * (90 + (visual.climate.windSpeed || 0) * 4)) % 180;
    for (let x = -w; x < w * 1.4; x += 180) {
      ctx.save();
      ctx.translate(x + drift, 0);
      ctx.transform(1, 0, -0.34, 1, 0, 0);
      ctx.fillRect(0, 0, 80 + rain * 90, h);
      ctx.restore();
    }
    ctx.globalAlpha = clamp(rain * 0.32, 0, 0.42);
    ctx.strokeStyle = 'rgba(210,230,245,0.78)';
    ctx.lineWidth = 1;
    const splashCount = Math.floor(28 + rain * 70);
    for (let i = 0; i < splashCount; i++) {
      const r1 = seededUnit(seed + i * 13 + 4);
      const r2 = seededUnit(seed + i * 17 + 8);
      const r3 = seededUnit(seed + i * 23 + 9);
      const x = r1 * w;
      const y = h * (0.55 + r2 * 0.42);
      const span = 4 + r3 * 12;
      ctx.beginPath();
      ctx.moveTo(x - span, y);
      ctx.lineTo(x + span, y - 2 - r3 * 3);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFogBands(ctx, visual, now, w, h, seed) {
    const fog = Number(visual.fogDensity || 0);
    if (fog <= 0.08) return;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    const color = visual.category === 'sandstorm' ? '178,145,103' : '202,214,221';
    const bandCount = Math.floor(7 + fog * 8);
    for (let i = 0; i < bandCount; i++) {
      const r1 = seededUnit(seed + i * 29 + 1);
      const r2 = seededUnit(seed + i * 31 + 2);
      const y = h * (0.24 + i * 0.115 + r2 * 0.05);
      const drift = ((now * (10 + i * 3) + r1 * w) % (w + 360)) - 180;
      const height = h * (0.08 + fog * 0.055);
      const alpha = clamp((0.080 + fog * 0.115) * (1 - i * 0.045), 0.045, 0.28);
      const grad = ctx.createRadialGradient(drift, y, 0, drift, y, w * 0.54);
      grad.addColorStop(0, `rgba(${color},${alpha.toFixed(3)})`);
      grad.addColorStop(0.62, `rgba(${color},${(alpha * 0.52).toFixed(3)})`);
      grad.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(drift, y, w * (0.46 + fog * 0.22), height, Math.sin(now * 0.08 + i) * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(drift + w * 0.56, y + height * 0.25, w * (0.42 + fog * 0.16), height * 0.88, Math.sin(now * 0.07 + i + 4) * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }


  // V0.16.52: shared rain primitive for the main menu ambience pass. The
  // in-game weather owner keeps the particle math; menu code supplies a
  // menu-safe viewport and visual options without touching world weather state.

  // V0.16.54: shared lightweight fog primitive for menu/weather ambience. This
  // reuses the weather-system particle/gradient language but lets callers pass
  // menu-local regions so gameplay weather state remains untouched.
  function drawFogLayer(ctx, viewport = {}, options = {}) {
    if (!ctx) return false;
    const w = Math.max(1, Number(viewport.width || viewport.w || ctx.canvas?.clientWidth || window.innerWidth || ctx.canvas?.width || 1280) || 1280);
    const h = Math.max(1, Number(viewport.height || viewport.h || ctx.canvas?.clientHeight || window.innerHeight || ctx.canvas?.height || 720) || 720);
    const fog = clamp(options.fogDensity ?? 0.42, 0, 1.1);
    if (fog <= 0.03) return false;
    const now = Number.isFinite(Number(options.now)) ? Number(options.now) : (typeof performance !== 'undefined' ? performance.now() * 0.001 : Date.now() * 0.001);
    const seed = Number(options.seed || 71231) || 71231;
    const color = options.color || { r: 174, g: 190, b: 202 };
    const regions = Array.isArray(options.regions) && options.regions.length ? options.regions : [
      { x: 0.50, y: 0.56, width: 0.58, height: 0.16, alpha: 0.16, drift: 70 },
      { x: 0.50, y: 0.90, width: 0.86, height: 0.18, alpha: 0.18, drift: 120 }
    ];

    ctx.save();
    ctx.globalCompositeOperation = options.composite || 'screen';
    for (let i = 0; i < regions.length; i++) {
      const region = regions[i] || {};
      const cx = w * clamp(Number(region.x ?? 0.5), -0.2, 1.2);
      const cy = h * clamp(Number(region.y ?? 0.5), -0.2, 1.2);
      const rw = w * clamp(Number(region.width ?? 0.58), 0.08, 1.5);
      const rh = h * clamp(Number(region.height ?? 0.16), 0.03, 0.8);
      const baseAlpha = clamp(Number(region.alpha ?? 0.16) * fog, 0.015, 0.28);
      const driftSpan = Number(region.drift ?? 80);
      const lanes = Math.max(2, Math.floor(Number(region.lanes ?? 4)));
      for (let lane = 0; lane < lanes; lane++) {
        const r1 = seededUnit(seed + i * 173 + lane * 29 + 1);
        const r2 = seededUnit(seed + i * 173 + lane * 31 + 2);
        const phase = now * (0.030 + lane * 0.006 + i * 0.004) + r1 * Math.PI * 2;
        const x = cx + Math.sin(phase) * driftSpan + (r2 - 0.5) * rw * 0.22;
        const y = cy + (lane - (lanes - 1) / 2) * rh * 0.18 + Math.cos(phase * 0.72) * rh * 0.12;
        const alpha = baseAlpha * (0.54 + r1 * 0.42) * (1 - lane * 0.065);
        const grad = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rw, rh) * (0.42 + r2 * 0.18));
        grad.addColorStop(0, `rgba(${color.r},${color.g},${color.b},${alpha.toFixed(3)})`);
        grad.addColorStop(0.55, `rgba(${color.r},${color.g},${color.b},${(alpha * 0.46).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(x, y, rw * (0.50 + r1 * 0.18), rh * (0.58 + r2 * 0.22), Math.sin(phase * 0.5) * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    return true;
  }

  function drawRainLayer(ctx, viewport = {}, options = {}) {
    if (!ctx) return false;
    const w = Math.max(1, Number(viewport.width || viewport.w || ctx.canvas?.clientWidth || window.innerWidth || ctx.canvas?.width || 1280) || 1280);
    const h = Math.max(1, Number(viewport.height || viewport.h || ctx.canvas?.clientHeight || window.innerHeight || ctx.canvas?.height || 720) || 720);
    const rain = clamp(options.intensity ?? 0.62, 0, 1.25);
    if (rain <= 0.01) return false;
    const densityScale = clamp(options.densityScale ?? 1, 0.15, 1.45);
    const visual = options.visual || {
      key: 'main_menu_rain',
      name: 'Main Menu Rain',
      icon: '🌧️',
      category: 'rain',
      intensity: rain >= 0.9 ? 'heavy' : (rain >= 0.48 ? 'medium' : 'light'),
      fogDensity: clamp(options.fogDensity ?? 0.10, 0, 0.32),
      rainIntensity: rain,
      snowIntensity: 0,
      sandstormIntensity: 0,
      particleDensity: Math.floor((options.particleDensity ?? 120) * densityScale),
      climate: {
        windSpeed: clamp(options.windSpeed ?? 18, 0, 70),
        temperature: 12,
        humidity: 86,
        elevation: 850
      }
    };
    const now = Number.isFinite(Number(options.now)) ? Number(options.now) : (typeof performance !== 'undefined' ? performance.now() * 0.001 : Date.now() * 0.001);
    const seed = Number(options.seed || 51152) || 51152;
    const backgroundCount = Math.floor(clamp(options.backgroundCount ?? 70, 0, 260) * densityScale);
    const foregroundCount = Math.floor(clamp(options.foregroundCount ?? 105, 0, 340) * densityScale);
    ctx.save();
    for (let i = 0; i < backgroundCount; i++) drawWeatherParticle(ctx, visual, seed + i * 17, false, now, w, h);
    for (let i = 0; i < foregroundCount; i++) drawWeatherParticle(ctx, visual, seed + 9000 + i * 23, true, now, w, h);
    if (options.curtain !== false) drawRainCurtain(ctx, visual, now, w, h, seed + 28000);
    ctx.restore();
    return true;
  }

  DR.WEATHER_BIOMES = BIOMES;
  DR.WEATHER_SEASONS = SEASONS;
  DR.WEATHER_TYPES = WEATHER;
  DR.Weather = Object.freeze({
    SAVE_VERSION,
    BIOMES,
    SEASONS,
    WEATHER,
    safeWeatherState,
    allowedWeather,
    visualState,
    drawRainLayer,
    drawFogLayer
  });

  DR.WeatherSystem = {
    install(Game) {
      Game.prototype.initializeWeather = function(state = null) {
        this.weatherState = safeWeatherState(state || this.weatherState, this);
        rollClimate(this.weatherState, this, true);
        const allowed = allowedWeather(this.weatherState, this);
        if (!allowed.includes(this.weatherState.currentWeather)) {
          this.weatherState.currentWeather = allowed[0] || 'clear';
          this.weatherState.previousWeather = this.weatherState.currentWeather;
        }
        this.lastWeatherUiKey = null;
        this.updateWeatherUi?.(true);
        uiBindCycleButton(this);
        return this.weatherState;
      };

      Game.prototype.serializeWeather = function() {
        return safeWeatherState(this.weatherState, this);
      };

      Game.prototype.applyWeatherState = function(state) {
        this.weatherState = safeWeatherState(state, this);
        rollClimate(this.weatherState, this, true);
        const allowed = allowedWeather(this.weatherState, this);
        if (!allowed.includes(this.weatherState.currentWeather)) {
          this.weatherState.currentWeather = allowed[0] || 'clear';
          this.weatherState.previousWeather = this.weatherState.currentWeather;
        }
        this.lastWeatherUiKey = null;
        this.updateWeatherUi?.(true);
        return this.weatherState;
      };

      Game.prototype.getWeatherVisualState = function() {
        if (!this.weatherState) this.initializeWeather?.();
        return visualState(this.weatherState, this);
      };

      Game.prototype.getAllowedWeather = function() {
        if (!this.weatherState) this.initializeWeather?.();
        return allowedWeather(this.weatherState, this);
      };

      Game.prototype.setWeather = function(key, options = {}) {
        if (!this.weatherState) this.initializeWeather?.();
        const allowed = allowedWeather(this.weatherState, this);
        const target = allowed.includes(key) ? key : (allowed[0] || 'clear');
        const changed = startWeatherTransition(this.weatherState, target, options.duration);
        if (changed && !options.silent) this.log?.(`Weather shifted to ${weatherDefFor(target).name}.`);
        this.updateWeatherUi?.(true);
        return changed;
      };

      Game.prototype.cycleWeather = function() {
        if (!this.weatherState) this.initializeWeather?.();
        rollClimate(this.weatherState, this, true);
        const allowed = allowedWeather(this.weatherState, this);
        const index = Math.max(0, allowed.indexOf(this.weatherState.currentWeather));
        const next = allowed[(index + 1) % allowed.length] || 'clear';
        return this.setWeather(next, { duration: 240 });
      };

      Game.prototype.updateWeather = function(dt) {
        if (!this.weatherState) this.initializeWeather?.();
        const state = this.weatherState;
        const safeDt = clamp(dt, 0, 0.25);
        if (safeDt <= 0) return;
        state.climateTimer = Math.max(0, Number(state.climateTimer || 0) - safeDt);
        if (state.climateTimer <= 0 || state.biome !== zoneBiome(this)) rollClimate(state, this, true);

        if (this.currentZone === 'cave' || this.currentZone === 'dungeon' || state.biome === 'cave') {
          if (state.currentWeather !== 'clear') {
            state.previousWeather = 'clear';
            state.currentWeather = 'clear';
            state.transitionProgress = 1;
            state.isTransitioning = false;
            this.updateWeatherUi?.(true);
          }
          state.lightningFlash = 0;
          return;
        }

        if (state.isTransitioning) {
          state.transitionProgress = clamp(Number(state.transitionProgress || 0) + safeDt / WEATHER_TRANSITION_SECONDS, 0, 1);
          if (state.transitionProgress >= 1) state.isTransitioning = false;
        } else {
          state.weatherTimer = Math.max(0, Number(state.weatherTimer || 0) - safeDt);
          if (state.weatherTimer <= 0) {
            const next = weightedWeatherPick(state, this);
            startWeatherTransition(state, next);
            this.worldSaveDirty = true;
          }
        }

        const current = weatherDefFor(state.currentWeather);
        if (current.thunder) {
          state.lightningFlash = Math.max(0, Number(state.lightningFlash || 0) - safeDt * 2.8);
          const chance = (0.005 + current.rainIntensity * 0.018) * safeDt * 60;
          if (state.lightningFlash <= 0 && Math.random() < chance) {
            state.lightningFlash = 1;
            state.lightningSeed = nextSeed(state);
            this.playWeatherThunderAudio?.(current.rainIntensity || 1);
          }
        } else {
          state.lightningFlash = Math.max(0, Number(state.lightningFlash || 0) - safeDt * 4.5);
        }
        this.updateWeatherUi?.(false);
      };

      Game.prototype.updateWeatherUi = function(force = false) {
        const ui = DR.ui || {};
        const visual = this.getWeatherVisualState?.();
        if (!visual || !ui.weatherStatus) return;
        const c = visual.climate;
        const key = [visual.key, visual.intensity, c.temperature, c.humidity, c.windSpeed, c.elevation, this.currentZone].join('|');
        if (!force && key === this.lastWeatherUiKey) return;
        this.lastWeatherUiKey = key;
        if (ui.weatherPanel) ui.weatherPanel.dataset.weather = visual.category;
        ui.weatherStatus.textContent = `${visual.icon} ${visual.name}`;
        if (ui.weatherClimate) ui.weatherClimate.textContent = `${visual.season.icon} ${visual.season.name} · ${c.temperature}°C · ${c.humidity}% humidity · ${c.windSpeed} km/h wind · ${c.elevation}m`;
        if (ui.weatherCycleBtn) ui.weatherCycleBtn.disabled = this.currentZone === 'cave' || this.currentZone === 'dungeon';
      };

      Game.prototype.renderWeatherSkyOverlay = function(context) {
        const visual = this.getWeatherVisualState?.();
        if (!context || !visual || visual.weatherSkyInfluence <= 0.01) return;
        const w = window.innerWidth;
        const h = window.innerHeight;
        context.save();
        context.globalCompositeOperation = visual.category === 'sandstorm' ? 'source-over' : 'multiply';
        context.globalAlpha = clamp(visual.weatherSkyInfluence, 0, 0.82);
        const sky = context.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, visual.skyTop);
        sky.addColorStop(0.5, visual.skyMid);
        sky.addColorStop(1, visual.skyBottom);
        context.fillStyle = sky;
        context.fillRect(0, 0, w, h);
        context.restore();

        if (visual.visibilityLoss > 0.08) {
          context.save();
          context.globalAlpha = clamp(visual.visibilityLoss * 0.46, 0, 0.54);
          context.fillStyle = visual.category === 'sandstorm' ? '#b99162' : '#c9d5df';
          context.fillRect(0, 0, w, h);
          context.restore();
        }
      };

      Game.prototype.renderWeatherWorld = function(context) {
        const visual = this.getWeatherVisualState?.();
        if (!context || !visual || visual.category === 'clear') return;
        if (visual.fogDensity <= 0.08 && visual.rainIntensity <= 0 && visual.sandstormIntensity <= 0 && visual.snowIntensity <= 0) return;
        const w = Number(context.canvas?.clientWidth || window.innerWidth || context.canvas?.width || 1280);
        const h = Number(context.canvas?.clientHeight || window.innerHeight || context.canvas?.height || 720);
        const now = performance.now() * 0.001;
        const seed = Number(this.weatherState?.particleSeed || 1) || 1;
        context.save();
        // V0.15.52: draw atmospheric weather in screen space. This fixes the
        // regression where fog/rain curtains were restored back into the world
        // camera transform and effectively disappeared.
        if (typeof this.resetCanvasTransform === 'function') this.resetCanvasTransform();
        else if (context.setTransform) {
          const dpr = Math.min(Math.max(Number(window.devicePixelRatio) || 1, 1), 2);
          context.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        const alpha = clamp(visual.fogDensity * 0.55 + visual.rainIntensity * 0.20 + visual.snowIntensity * 0.12 + visual.sandstormIntensity * 0.22, 0.08, 0.72);
        const grad = context.createLinearGradient(0, h * 0.18, 0, h);
        const color = visual.category === 'sandstorm' ? '190,160,118' : (visual.category === 'snow' ? '214,226,238' : '194,207,214');
        grad.addColorStop(0, `rgba(${color},0)`);
        grad.addColorStop(0.34, `rgba(${color},${(alpha * 0.32).toFixed(3)})`);
        grad.addColorStop(0.72, `rgba(${color},${(alpha * 0.70).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${color},${alpha.toFixed(3)})`);
        context.fillStyle = grad;
        context.fillRect(0, h * 0.18, w, h * 0.82);
        drawFogBands(context, visual, now, w, h, seed + 17000);
        context.restore();
      };

      Game.prototype.renderWeatherForeground = function(context) {
        const visual = this.getWeatherVisualState?.();
        if (!context || !visual || visual.category === 'clear') return;
        if (visual.particleDensity <= 0 && visual.rainIntensity <= 0 && visual.snowIntensity <= 0 && visual.sandstormIntensity <= 0 && visual.fogDensity <= 0.32) return;
        const w = Number(context.canvas?.clientWidth || window.innerWidth || context.canvas?.width || 1280);
        const h = Number(context.canvas?.clientHeight || window.innerHeight || context.canvas?.height || 720);
        const now = performance.now() * 0.001;
        const baseSeed = Number(this.weatherState?.particleSeed || 1) || 1;
        context.save();
        if (typeof this.resetCanvasTransform === 'function') this.resetCanvasTransform();
        else if (context.setTransform) {
          const dpr = Math.min(Math.max(Number(window.devicePixelRatio) || 1, 1), 2);
          context.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        const bg = Math.max(visual.category === 'clear' ? 0 : 8, particleCount(visual, false));
        const fg = Math.max(visual.category === 'clear' ? 0 : 10, particleCount(visual, true));
        for (let i = 0; i < bg; i++) drawWeatherParticle(context, visual, baseSeed + i * 17, false, now, w, h);
        for (let i = 0; i < fg; i++) drawWeatherParticle(context, visual, baseSeed + 9000 + i * 23, true, now, w, h);
        drawRainCurtain(context, visual, now, w, h, baseSeed + 28000);
        context.restore();
      };

      Game.prototype.renderWeatherFlash = function(context) {
        const visual = this.getWeatherVisualState?.();
        const flash = visual?.lightningFlash || 0;
        if (!context || flash <= 0.01) return;
        const w = Number(context.canvas?.clientWidth || window.innerWidth || context.canvas?.width || 1280);
        const h = Number(context.canvas?.clientHeight || window.innerHeight || context.canvas?.height || 720);
        const seed = Number(this.weatherState?.lightningSeed || 1) || 1;
        context.save();
        if (typeof this.resetCanvasTransform === 'function') this.resetCanvasTransform();
        else if (context.setTransform) {
          const dpr = Math.min(Math.max(Number(window.devicePixelRatio) || 1, 1), 2);
          context.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        context.globalCompositeOperation = 'screen';
        context.globalAlpha = clamp(flash * 0.55, 0, 0.7);
        context.fillStyle = '#fffde8';
        context.fillRect(0, 0, w, h);
        context.globalAlpha = clamp(flash, 0, 1);
        context.strokeStyle = 'rgba(255,255,230,0.95)';
        context.lineWidth = 2;
        context.beginPath();
        let x = w * (0.25 + seededUnit(seed + 1) * 0.5);
        context.moveTo(x, 0);
        for (let y = 0; y < h * 0.82; y += 24) {
          x += (seededUnit(seed + y * 0.71) - 0.5) * 52;
          context.lineTo(x, y);
        }
        context.stroke();
        context.lineWidth = 4;
        context.globalAlpha = clamp(flash * 0.46, 0, 0.6);
        context.stroke();
        context.restore();
      };
    }
  };

  function uiBindCycleButton(game) {
    const ui = DR.ui || {};
    if (!ui.weatherCycleBtn || ui.weatherCycleBtn.dataset.weatherBound === '1') return;
    ui.weatherCycleBtn.dataset.weatherBound = '1';
    ui.weatherCycleBtn.addEventListener('click', () => game.cycleWeather?.());
  }
})();
