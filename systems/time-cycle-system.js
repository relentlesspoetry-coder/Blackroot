// Dream Realms time cycle system
// V0.12.41 owner integration: in-game clock, day/night phase state, and weather-aware lighting data.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  const RULES = Object.freeze({
    defaultDay: 1,
    defaultStartMinute: 7 * 60 + 30,
    secondsPerGameDay: 10 * 60 * 24,
    minSecondsPerGameDay: 10 * 60,
    maxSecondsPerGameDay: 24 * 60 * 60,
    saveVersion: 2,
    phaseBoundaries: Object.freeze({
      dawnStart: 5 * 60,
      dayStart: 7 * 60,
      duskStart: 17 * 60,
      nightStart: 20 * 60
    })
  });
  DR.WORLD_TIME_RULES = RULES;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function smoothstep(edge0, edge1, x) {
    if (edge0 === edge1) return x < edge0 ? 0 : 1;
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function lerp(a, b, t) {
    return a + (b - a) * clamp(t, 0, 1);
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
    const r = Math.round(lerp(ca.r, cb.r, t)).toString(16).padStart(2, '0');
    const g = Math.round(lerp(ca.g, cb.g, t)).toString(16).padStart(2, '0');
    const bl = Math.round(lerp(ca.b, cb.b, t)).toString(16).padStart(2, '0');
    return `#${r}${g}${bl}`;
  }

  function rgba(hex, alpha) {
    const c = hexToRgb(hex);
    return `rgba(${c.r},${c.g},${c.b},${clamp(alpha, 0, 1).toFixed(3)})`;
  }

  function normalizeMinute(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return RULES.defaultStartMinute;
    return ((n % 1440) + 1440) % 1440;
  }

  function phaseForMinute(minuteOfDay) {
    const m = normalizeMinute(minuteOfDay);
    const b = RULES.phaseBoundaries;
    if (m >= b.dawnStart && m < b.dayStart) return { key: 'dawn', label: 'Dawn' };
    if (m >= b.dayStart && m < b.duskStart) {
      if (m < 10 * 60) return { key: 'morning', label: 'Morning' };
      if (m >= 14 * 60) return { key: 'afternoon', label: 'Afternoon' };
      return { key: 'day', label: 'Day' };
    }
    if (m >= b.duskStart && m < b.nightStart) return { key: 'dusk', label: 'Dusk' };
    if (m >= 0 && m < b.dawnStart) return { key: 'lateNight', label: 'Deep Night' };
    return { key: 'night', label: 'Night' };
  }

  function formatClock(minuteOfDay) {
    const m = Math.floor(normalizeMinute(minuteOfDay));
    const hour24 = Math.floor(m / 60);
    const minute = m % 60;
    const suffix = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = ((hour24 + 11) % 12) + 1;
    return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${suffix}`;
  }

  function computeLight(minuteOfDay, zone = 'overworld') {
    const m = normalizeMinute(minuteOfDay);
    const phase = phaseForMinute(m);
    const isCave = zone === 'cave' || zone === 'dungeon';

    const sunrise = smoothstep(5 * 60, 7 * 60, m);
    const sunset = 1 - smoothstep(17 * 60, 20 * 60, m);
    const sunStrength = clamp(Math.min(sunrise, sunset), 0, 1);
    const noonCurve = Math.max(0, Math.sin(((m - 6 * 60) / (12 * 60)) * Math.PI));
    const dawnCurve = smoothstep(4.75 * 60, 6.5 * 60, m) * (1 - smoothstep(7.1 * 60, 8.4 * 60, m));
    const duskCurve = smoothstep(16.4 * 60, 18.4 * 60, m) * (1 - smoothstep(19.2 * 60, 20.25 * 60, m));
    const transition = clamp(Math.max(dawnCurve, duskCurve), 0, 1);
    const nightStrength = clamp(1 - sunStrength + transition * 0.12, 0, 1);
    const moonStrength = clamp((1 - sunStrength) * (1 - transition * 0.45), 0, 1);

    const nightSky = ['#04101e', '#071423', '#020408'];
    const dawnSky = ['#2f3342', '#392e2a', '#0f0c13'];
    const daySky = ['#203d30', '#152b1d', '#07100a'];
    const duskSky = ['#33283a', '#2a1d25', '#07070d'];

    let sky = daySky;
    if (phase.key === 'dawn') {
      const t = smoothstep(5 * 60, 7 * 60, m);
      sky = dawnSky.map((color, i) => mixHex(color, daySky[i], t));
    } else if (phase.key === 'dusk') {
      const t = smoothstep(17 * 60, 20 * 60, m);
      sky = daySky.map((color, i) => mixHex(color, i === 1 ? duskSky[i] : duskSky[i], t));
    } else if (phase.key === 'night' || phase.key === 'lateNight') {
      sky = nightSky;
    }

    if (isCave) {
      sky = ['#06080b', '#070b0d', '#020303'];
    }

    return {
      minuteOfDay: m,
      dayPercent: m / 1440,
      phaseKey: phase.key,
      phaseLabel: isCave ? `${phase.label} outside` : phase.label,
      clockLabel: formatClock(m),
      sunStrength,
      noonCurve,
      transition,
      nightStrength: isCave ? 0.92 : nightStrength,
      moonStrength: isCave ? 0 : moonStrength,
      brightness: isCave ? 0.52 : clamp(0.34 + sunStrength * 0.66 + transition * 0.08, 0.25, 1),
      worldDarkness: isCave ? 0.08 : clamp(0.05 + nightStrength * 0.58 - transition * 0.14, 0.04, 0.64),
      skyTop: sky[0],
      skyMid: sky[1],
      skyBottom: sky[2],
      canopyAlpha: isCave ? 0.05 : clamp(0.17 + sunStrength * 0.21 + transition * 0.06, 0.12, 0.40),
      canopyNear: isCave ? '#07100d' : mixHex('#071326', '#1d3d27', clamp(sunStrength * 0.95 + transition * 0.2, 0, 1)),
      canopyFar: isCave ? '#060c0a' : mixHex('#06101e', '#18321f', clamp(sunStrength * 0.85 + transition * 0.25, 0, 1)),
      sunShaftAlpha: isCave ? 0 : clamp(sunStrength * (0.55 + noonCurve * 0.45) + transition * 0.18, 0, 1),
      sunShaftTint: phase.key === 'dawn' ? '#ffe4a4' : (phase.key === 'dusk' ? '#f0b178' : '#ede0a7'),
      fogAlpha: clamp(0.75 + nightStrength * 0.65 + transition * 0.25, 0.65, 1.55),
      fogTint: isCave ? '#8aa6a4' : (sunStrength > 0.45 ? '#d3d0a2' : '#9fb7d9'),
      dustAlpha: isCave ? 0.08 : clamp(0.018 + sunStrength * 0.08 + transition * 0.035, 0.015, 0.11),
      dustTint: sunStrength > 0.45 ? '#ece0ae' : '#c8dcff',
      starAlpha: isCave ? 0 : clamp((moonStrength - transition * 0.25) * 0.65, 0, 0.62),
      fireflyBoost: isCave ? 0.12 : clamp(nightStrength * 0.9 + transition * 0.22, 0.1, 1.0),
      vignetteAlpha: isCave ? 0.56 : clamp(0.42 + nightStrength * 0.22, 0.38, 0.66)
    };
  }



  function applyWeatherToLight(light, weather) {
    if (!weather || typeof weather !== 'object') return light;
    const influence = clamp(weather.weatherSkyInfluence || 0, 0, 0.85);
    const visibility = clamp(weather.visibilityLoss || 0, 0, 0.95);
    const darknessAdd = clamp(weather.darknessAdd || 0, 0, 0.35);
    const fogBoost = Math.max(1, Number(weather.fogBoost || 1));
    const fireflySuppression = clamp(weather.fireflySuppression || 0, 0, 0.95);
    const skyTop = weather.skyTop ? mixHex(light.skyTop, weather.skyTop, influence) : light.skyTop;
    const skyMid = weather.skyMid ? mixHex(light.skyMid, weather.skyMid, influence) : light.skyMid;
    const skyBottom = weather.skyBottom ? mixHex(light.skyBottom, weather.skyBottom, influence) : light.skyBottom;
    const weatherFogTint = weather.category === 'sandstorm' ? '#d2b489' : (weather.category === 'snow' ? '#dbe7f5' : (weather.category === 'rain' || weather.category === 'thunder' ? '#9fb1c8' : null));
    return {
      ...light,
      skyTop,
      skyMid,
      skyBottom,
      brightness: clamp((light.brightness || 1) - darknessAdd * 0.42 - visibility * 0.08, 0.18, 1),
      worldDarkness: clamp((light.worldDarkness || 0) + darknessAdd, 0.04, 0.76),
      canopyAlpha: clamp((light.canopyAlpha || 0.25) * (1 - visibility * 0.18), 0.07, 0.42),
      sunShaftAlpha: clamp((light.sunShaftAlpha || 0) * (1 - visibility * 0.86), 0, 1),
      fogAlpha: clamp((light.fogAlpha || 1) * fogBoost, 0.65, 3.8),
      fogTint: weatherFogTint || light.fogTint,
      dustAlpha: clamp((light.dustAlpha || 0.05) * (1 - Math.min(0.92, (weather.rainIntensity || 0) * 0.75 + (weather.snowIntensity || 0) * 0.35)) * (1 + (weather.sandstormIntensity || 0) * 0.65), 0.004, 0.14),
      starAlpha: clamp((light.starAlpha || 0) * (1 - visibility), 0, 0.62),
      fireflyBoost: clamp((light.fireflyBoost || 0.25) * (1 - fireflySuppression), 0.02, 1),
      vignetteAlpha: clamp((light.vignetteAlpha || 0.42) + darknessAdd * 0.36 + visibility * 0.08, 0.38, 0.78),
      weatherKey: weather.key || 'clear',
      weatherCategory: weather.category || 'clear'
    };
  }

  function safeClockState(state) {
    if (!state || typeof state !== 'object') {
      return { version: RULES.saveVersion, day: RULES.defaultDay, minuteOfDay: RULES.defaultStartMinute, secondsPerGameDay: RULES.secondsPerGameDay };
    }
    const incomingVersion = Math.floor(Number(state.version) || 0);
    const rawSecondsPerGameDay = incomingVersion < RULES.saveVersion
      ? RULES.secondsPerGameDay
      : (Number(state.secondsPerGameDay) || RULES.secondsPerGameDay);
    return {
      version: RULES.saveVersion,
      day: Math.max(1, Math.floor(Number(state.day) || RULES.defaultDay)),
      minuteOfDay: normalizeMinute(state.minuteOfDay),
      secondsPerGameDay: Math.max(RULES.minSecondsPerGameDay, Math.min(RULES.maxSecondsPerGameDay, rawSecondsPerGameDay))
    };
  }

  DR.TimeCycle = Object.freeze({
    RULES,
    phaseForMinute,
    formatClock,
    computeLight,
    normalizeMinute,
    safeClockState
  });

  DR.WorldTimeSystem = {
    install(Game) {
      Game.prototype.initializeWorldClock = function(state = null) {
        this.worldTime = safeClockState(state || this.worldTime);
        this.lastWorldClockUiMinute = null;
        this.lastWorldClockPhase = null;
        this.updateWorldClockUi?.(true);
        return this.worldTime;
      };

      Game.prototype.serializeWorldTime = function() {
        return safeClockState(this.worldTime);
      };

      Game.prototype.applyWorldTimeState = function(state) {
        this.worldTime = safeClockState(state);
        this.lastWorldClockUiMinute = null;
        this.lastWorldClockPhase = null;
        this.updateWorldClockUi?.(true);
        return this.worldTime;
      };

      Game.prototype.updateWorldClock = function(dt) {
        if (!this.worldTime) this.initializeWorldClock();
        // Phase 27: advance the per-frame world-light memo token once per frame
        // (before any early return), so getWorldLightState recomputes the shared
        // light exactly once per frame and every other caller reuses it. update()
        // runs before render() each frame, so render's many callers all hit the
        // memo. When paused/not-started update isn't called, the token freezes -
        // correct, since time (and thus the light) is frozen then too.
        this._worldLightFrameToken = (this._worldLightFrameToken || 0) + 1;
        const safeDt = Math.max(0, Math.min(0.25, Number(dt) || 0));
        if (safeDt <= 0) return;
        const minutesPerSecond = 1440 / Math.max(RULES.minSecondsPerGameDay, Number(this.worldTime.secondsPerGameDay) || RULES.secondsPerGameDay);
        const beforeMinute = this.worldTime.minuteOfDay;
        const beforePhase = phaseForMinute(beforeMinute).key;
        let nextMinute = beforeMinute + safeDt * minutesPerSecond;
        while (nextMinute >= 1440) {
          nextMinute -= 1440;
          this.worldTime.day = Math.max(1, Math.floor(Number(this.worldTime.day) || 1) + 1);
        }
        this.worldTime.minuteOfDay = nextMinute;
        const afterPhase = phaseForMinute(nextMinute).key;
        if (beforePhase !== afterPhase) this.worldSaveDirty = true;
        this.updateWorldClockUi?.(false);
      };

      Game.prototype.getWorldTimeInfo = function() {
        if (!this.worldTime) this.initializeWorldClock();
        return {
          ...safeClockState(this.worldTime),
          ...phaseForMinute(this.worldTime.minuteOfDay),
          clockLabel: formatClock(this.worldTime.minuteOfDay)
        };
      };

      Game.prototype.getWorldLightState = function() {
        if (!this.worldTime) this.initializeWorldClock();
        // Phase 27: memoize the computed light per frame. This is a pure function
        // of (minuteOfDay, zone, weather), all stable within a frame, yet it is
        // called ~17 times per frame plus once per on-screen lantern/wisp and the
        // waypoint aura. The token (bumped once per frame in updateWorldClock) +
        // zone key mean it recomputes exactly once per frame and every other
        // caller reuses the result - no stale light, no new loop/timer.
        const token = this._worldLightFrameToken || 0;
        const zone = this.currentZone || 'overworld';
        const cache = this._worldLightCache;
        if (cache && cache.token === token && cache.zone === zone) return cache.light;
        const baseLight = computeLight(this.worldTime.minuteOfDay, zone);
        const light = applyWeatherToLight(baseLight, this.getWeatherVisualState?.());
        this._worldLightCache = { token, zone, light };
        return light;
      };

      Game.prototype.updateWorldClockUi = function(force = false) {
        const ui = DR.ui || {};
        if (!this.worldTime) return;
        const info = this.getWorldTimeInfo();
        const displayMinute = Math.floor(info.minuteOfDay);
        const phaseKey = info.key;
        if (!force && displayMinute === this.lastWorldClockUiMinute && phaseKey === this.lastWorldClockPhase) return;
        this.lastWorldClockUiMinute = displayMinute;
        this.lastWorldClockPhase = phaseKey;
        if (ui.timeCycleClock) ui.timeCycleClock.dataset.phase = phaseKey;
        if (ui.worldClockTime) ui.worldClockTime.textContent = `Day ${info.day} · ${info.clockLabel}`;
        if (ui.worldClockPhase) ui.worldClockPhase.textContent = info.label;
        document.body?.setAttribute('data-world-phase', phaseKey);
      };

      Game.prototype.drawWorldSky = function(context) {
        const light = this.getWorldLightState?.() || computeLight(RULES.defaultStartMinute, this.currentZone || 'overworld');
        const w = window.innerWidth;
        const h = window.innerHeight;
        const sky = context.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, light.skyTop);
        sky.addColorStop(0.45, light.skyMid);
        sky.addColorStop(1, light.skyBottom);
        context.fillStyle = sky;
        context.fillRect(0, 0, w, h);

        if (light.starAlpha > 0.01) {
          const t = performance.now() * 0.00003;
          context.save();
          context.globalCompositeOperation = 'screen';
          for (let i = 0; i < 80; i++) {
            const hx = (Math.sin(i * 127.1) * 43758.5453) % 1;
            const hy = (Math.sin(i * 53.7 + 19.3) * 12345.6789) % 1;
            const x = (((hx < 0 ? hx + 1 : hx) + t * (0.05 + (i % 7) * 0.006)) % 1) * w;
            const y = ((hy < 0 ? hy + 1 : hy) * 0.56 + 0.02) * h;
            const twinkle = 0.55 + Math.sin(performance.now() * 0.001 + i * 1.9) * 0.25;
            context.globalAlpha = light.starAlpha * twinkle;
            context.fillStyle = '#dce8ff';
            context.fillRect(x | 0, y | 0, i % 5 === 0 ? 2 : 1, 1);
          }
          context.restore();
        }

        if (light.moonStrength > 0.18) {
          const moonX = w * (0.18 + light.dayPercent * 0.58);
          const moonY = h * (0.17 + Math.sin(light.dayPercent * Math.PI * 2) * 0.06);
          context.save();
          context.globalCompositeOperation = 'screen';
          context.globalAlpha = light.moonStrength * 0.22;
          const glow = context.createRadialGradient(moonX, moonY, 8, moonX, moonY, 150);
          glow.addColorStop(0, 'rgba(190,214,255,0.60)');
          glow.addColorStop(1, 'rgba(80,110,180,0)');
          context.fillStyle = glow;
          context.beginPath();
          context.arc(moonX, moonY, 150, 0, Math.PI * 2);
          context.fill();
          context.globalAlpha = light.moonStrength * 0.64;
          context.fillStyle = '#d8e4ff';
          context.beginPath();
          context.arc(moonX, moonY, 13, 0, Math.PI * 2);
          context.fill();
          context.globalCompositeOperation = 'source-over';
          context.globalAlpha = 0.42;
          context.fillStyle = light.skyTop;
          context.beginPath();
          context.arc(moonX + 6, moonY - 3, 13, 0, Math.PI * 2);
          context.fill();
          context.restore();
        }
        return true;
      };

      Game.prototype.drawWorldLightOverlay = function(context) {
        const light = this.getWorldLightState?.();
        if (!light) return;
        const darkness = clamp(light.worldDarkness || 0, 0, 0.72);
        if (darkness > 0.015) {
          context.save();
          context.globalCompositeOperation = 'multiply';
          context.fillStyle = `rgba(20,30,56,${darkness.toFixed(3)})`;
          context.fillRect(0, 0, window.innerWidth, window.innerHeight);
          context.restore();
        }
        if (light.transition > 0.02 && this.currentZone !== 'cave' && this.currentZone !== 'dungeon') {
          context.save();
          context.globalCompositeOperation = 'screen';
          const glow = context.createLinearGradient(0, 0, window.innerWidth, window.innerHeight);
          glow.addColorStop(0, rgba(light.sunShaftTint || '#f0b178', 0.05 * light.transition));
          glow.addColorStop(0.55, 'rgba(0,0,0,0)');
          glow.addColorStop(1, rgba('#6a4bff', 0.035 * light.transition));
          context.fillStyle = glow;
          context.fillRect(0, 0, window.innerWidth, window.innerHeight);
          context.restore();
        }
      };
    }
  };
})();
