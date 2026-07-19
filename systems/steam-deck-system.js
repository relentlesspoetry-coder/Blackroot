// Dream Realms Steam Deck / controller support.
// V0.10.9 cleanup: exports controller-owned methods only. Game lifecycle calls these methods directly.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const CONFIG = DR.CONFIG;
  const { clamp } = DR.utils || { clamp: (v, a, b) => Math.max(a, Math.min(b, v)) };

  const DEADZONE = 0.18;

  function axis(v) {
    if (!Number.isFinite(v) || Math.abs(v) < DEADZONE) return 0;
    const sign = Math.sign(v);
    return sign * ((Math.abs(v) - DEADZONE) / (1 - DEADZONE));
  }

  function pressed(pad, index) {
    return Boolean(pad?.buttons?.[index]?.pressed);
  }

  function buttonValue(pad, index) {
    return Number(pad?.buttons?.[index]?.value || 0);
  }

  DR.SteamDeckSystem = {
    install(Game) {
      Game.prototype.initSteamDeckSupport = function() {
        if (this.steamDeckSupportReady) return;
        this.steamDeckSupportReady = true;
        this.steamDeck = {
          connected: false,
          lastButtons: new Set(),
          activeButtons: new Set(),
          moveX: 0,
          moveY: 0,
          lookX: 0,
          lookY: 0,
          lastDeviceName: '',
          hintLogged: false
        };
        const updateLayout = () => document.body.classList.toggle('steamDeckMode', window.innerWidth <= 1280 && window.innerHeight <= 850);
        updateLayout();
        window.addEventListener('resize', updateLayout);
        if (!this.steamDeckSplashPoll) {
          this.steamDeckSplashPoll = window.setInterval(() => {
            if (this.started) {
              window.clearInterval(this.steamDeckSplashPoll);
              this.steamDeckSplashPoll = null;
              return;
            }
            const pads = typeof navigator.getGamepads === 'function' ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
            const pad = pads[0];
            if (!pad) return;
            document.body.classList.add('steamDeckMode');
            if (pressed(pad, 0) || pressed(pad, 9)) this.closeLogoSplash?.();
          }, 120);
        }
      };

      Game.prototype.bindSteamDeckEvents = function() {
        this.initSteamDeckSupport?.();
        if (this.steamDeckEventsBound) return;
        this.steamDeckEventsBound = true;

        const meditateBtn = document.getElementById('steamDeckMeditateBtn');
        if (meditateBtn && meditateBtn.dataset.bound !== '1') {
          meditateBtn.dataset.bound = '1';
          const setPressed = pressedState => {
            if (meditateBtn.disabled) return;
            meditateBtn.classList.toggle('meditatePressed', Boolean(pressedState));
          };
          const activateMeditation = event => {
            if (!this.started || this.paused || meditateBtn.disabled) return;
            event?.preventDefault?.();
            event?.stopPropagation?.();
            setPressed(false);
            this.toggleMeditate?.();
            this.renderHotbarCombatState?.();
          };
          meditateBtn.addEventListener('pointerdown', event => {
            if (!this.started || this.paused || meditateBtn.disabled) return;
            if (event.button != null && event.button !== 0) return;
            setPressed(true);
          }, { passive: true });
          meditateBtn.addEventListener('pointerup', () => setPressed(false), { passive: true });
          meditateBtn.addEventListener('pointercancel', () => setPressed(false), { passive: true });
          meditateBtn.addEventListener('pointerleave', () => setPressed(false), { passive: true });
          meditateBtn.addEventListener('blur', () => setPressed(false));
          meditateBtn.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') setPressed(true);
          });
          meditateBtn.addEventListener('keyup', event => {
            if (event.key === 'Enter' || event.key === ' ') setPressed(false);
          });
          meditateBtn.addEventListener('click', activateMeditation, { passive: false });
        }

        window.addEventListener('gamepadconnected', event => {
          this.initSteamDeckSupport?.();
          this.steamDeck.connected = true;
          this.steamDeck.lastDeviceName = event.gamepad?.id || 'Controller';
          document.body.classList.add('steamDeckMode');
          this.log?.(`Controller connected: ${this.steamDeck.lastDeviceName}. Steam Deck controls enabled.`);
        });

        window.addEventListener('gamepaddisconnected', () => {
          if (!this.steamDeck) return;
          this.steamDeck.connected = false;
          this.steamDeck.activeButtons.clear();
          this.steamDeck.lastButtons.clear();
          this.steamDeck.moveX = 0;
          this.steamDeck.moveY = 0;
        });
      };

      Game.prototype.pollSteamDeckInput = function(dt) {
        this.initSteamDeckSupport?.();
        const state = this.steamDeck;
        if (!state) return;

        const pads = typeof navigator.getGamepads === 'function' ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
        const pad = pads[0];
        if (!pad) {
          state.connected = false;
          state.moveX = 0;
          state.moveY = 0;
          state.lookX = 0;
          state.lookY = 0;
          return;
        }

        state.connected = true;
        state.lastDeviceName = pad.id || state.lastDeviceName || 'Controller';
        document.body.classList.add('steamDeckMode');

        const lx = axis(pad.axes?.[0] || 0);
        const ly = axis(pad.axes?.[1] || 0);
        const rx = axis(pad.axes?.[2] || 0);
        const ry = axis(pad.axes?.[3] || 0);
        state.moveX = lx;
        state.moveY = ly;
        state.lookX = rx;
        state.lookY = ry;

        const active = new Set();
        for (let i = 0; i < (pad.buttons?.length || 0); i++) {
          if (pressed(pad, i)) active.add(i);
        }
        const justPressed = index => active.has(index) && !state.lastButtons.has(index);

        if (!this.started) {
          if (justPressed(0) || justPressed(9)) this.closeLogoSplash?.();
          state.lastButtons = active;
          state.activeButtons = active;
          return;
        }

        if (this.paused) {
          if (justPressed(9) || justPressed(1)) this.togglePause?.();
          state.lastButtons = active;
          state.activeButtons = active;
          return;
        }

        if (justPressed(0)) this.playerJump?.();
        if (justPressed(1)) {
          if (this.menuOpen) this.toggleMenu?.(false);
          else this.tryPrimaryInteract?.();
        }
        if (justPressed(2)) this.playerAttack?.();
        if (justPressed(3)) this.targetNearest?.();
        if (justPressed(4)) this.useClassSpell?.(0);
        if (justPressed(5)) this.useClassSpell?.(1);
        if (justPressed(8)) this.toggleMap?.();
        if (justPressed(9)) this.toggleMenu?.();
        if (justPressed(10)) this.toggleMeditate?.();
        if (justPressed(11)) this.togglePartyPanel?.();
        if (justPressed(12)) this.toggleBag?.();
        if (justPressed(13)) this.toggleSkillsPanel?.();
        if (justPressed(14)) this.toggleCharacterPanel?.();
        if (justPressed(15)) this.toggleSpellPanel?.();

        const lt = buttonValue(pad, 6);
        const rt = buttonValue(pad, 7);
        if (lt > 0.6 && !state.lastButtons.has(106)) {
          active.add(106);
          this.adjustCameraZoom?.(-1);
        }
        if (rt > 0.6 && !state.lastButtons.has(107)) {
          active.add(107);
          this.adjustCameraZoom?.(1);
        }

        state.lastButtons = active;
        state.activeButtons = active;
      };

      Game.prototype.applySteamDeckLook = function(dt) {
        if (!this.steamDeck?.connected) return;
        const state = this.steamDeck;
        if (Math.abs(state.lookX || 0) > 0.08) this.camera.yawVel += state.lookX * 4.2 * dt;
        if (Math.abs(state.lookY || 0) > 0.35) {
          this.camera.targetZoom = clamp((this.camera.targetZoom || CONFIG.CAMERA_DEFAULT_ZOOM) - state.lookY * CONFIG.CAMERA_ZOOM_STEP * 0.45, CONFIG.CAMERA_MIN_ZOOM, CONFIG.CAMERA_MAX_ZOOM);
        }
      };

      Game.prototype.applySteamDeckMovement = function(dt) {
        if (!this.player || !this.player.alive || this.paused) return false;
        const padMoveX = this.steamDeck?.moveX || 0;
        const padMoveY = this.steamDeck?.moveY || 0;
        if (Math.abs(padMoveX) <= 0.01 && Math.abs(padMoveY) <= 0.01) return false;

        this.clearClickMoveTarget?.();
        this.cancelMeditation?.(this.player, 'movement');
        this.cancelPlayerEmote?.('movement');
        this.resourceGatheringSystem?.cancelForMovement?.();
        const camDx = padMoveY + padMoveX;
        const camDy = padMoveY - padMoveX;
        const len = Math.hypot(camDx, camDy) || 1;
        const nx = camDx / len;
        const ny = camDy / len;
        const c = Math.cos(this.camera.yaw || 0);
        const s = Math.sin(this.camera.yaw || 0);
        const dx = nx * c + ny * s;
        const dy = -nx * s + ny * c;
        const analogMag = clamp(Math.hypot(padMoveX, padMoveY), 0.25, 1);
        // V0.20.47: routed through the shared walk-speed knob so the controller matches keyboard/click.
        const speed = (this.playerWalkSpeed?.() ?? this.player.getStat('speed')) * analogMag * dt;
        this.tryMoveActorSubstepped?.(this.player, dx, dy, speed, { maxStep: 0.16 });
        this.player.setFacingFromDelta(dx, dy);
        return true;
      };

      Game.prototype.tryPrimaryInteract = function() {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', code: 'KeyE', bubbles: true, cancelable: true }));
        return true;
      };
    }
  };
})();
