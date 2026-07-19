// Dream Realms UI runtime system
// V0.12.85 owner: character UI, appearance creation preview, unified companion HUD presentation, and account/character-slot screen routing.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const { CLASSES, MERC_ROLES } = DR;
  const { pct } = DR.utils;

  const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[ch]);

  const BLACKROOT_LOGO_MARKUP = `<img class="blackrootLogoImage" src="assets/logo/blackroot-logo.png" alt="Blackroot" decoding="async" draggable="false" />`;
  // V0.16.57: the action bar no longer registers or renders the PNG shell at runtime.
  // #hotbar.abilityBar uses the lightweight CSS/DOM renderer owned by the stylesheet.

  const CLASS_ICON = {
    Paladin: '✦', Warden: '◆', Fighter: '⚔', Rogue: '🗡', Ranger: '➶', Assassin: '⌁', Wizard: '✧', Shaman: '◈',
    Summoner: '✦', Necromancer: '☠', Cleric: '✚', Druid: '☘', Bard: '♫', Enchanter: '◇'
  };

  const CLASS_EMBLEM_SHEET = 'assets/ui/class-emblems.png';
  const CLASS_EMBLEM_COLUMNS = 7;
  const CLASS_EMBLEM_ROWS = 2;
  const CLASS_EMBLEM_BACKGROUND_SIZE = '700% 200%';
  const CREATOR_CLASS_EMBLEM_SHEET = 'assets/ui/class-emblems-creator-large.png';
  const CREATOR_CLASS_EMBLEM_COLUMNS = 7;
  const CREATOR_CLASS_EMBLEM_ROWS = 2;
  const CLASS_EMBLEM_META = {
    Paladin: { key: 'paladin', col: 0, row: 0, fallback: '✦' },
    Warden: { key: 'warden', col: 1, row: 0, fallback: '◆' },
    Fighter: { key: 'fighter', col: 2, row: 0, fallback: '⚔' },
    Rogue: { key: 'rogue', col: 3, row: 0, fallback: '🗡' },
    Ranger: { key: 'ranger', col: 4, row: 0, fallback: '➶' },
    Assassin: { key: 'assassin', col: 5, row: 0, fallback: '⌁' },
    Wizard: { key: 'wizard', col: 6, row: 0, fallback: '✧' },
    Shaman: { key: 'shaman', col: 0, row: 1, fallback: '◈' },
    Summoner: { key: 'summoner', col: 1, row: 1, fallback: '✦' },
    Necromancer: { key: 'necromancer', col: 2, row: 1, fallback: '☠' },
    Cleric: { key: 'cleric', col: 3, row: 1, fallback: '✚' },
    Druid: { key: 'druid', col: 4, row: 1, fallback: '☘' },
    Bard: { key: 'bard', col: 5, row: 1, fallback: '♫' },
    Enchanter: { key: 'enchanter', col: 6, row: 1, fallback: '◇' }
  };
  const CLASS_EMBLEM_BY_KEY = Object.fromEntries(Object.values(CLASS_EMBLEM_META).map(meta => [meta.key, meta]));


  // V0.16.58: main-menu class sigils are split into stable left/right lanes
  // around the logo/menu safe zones. Sizes are deliberately larger than the
  // earlier ambience pass, but movement remains bounded so the icons do not
  // drift into the center logo or the button column.
  const MAIN_MENU_FLOATING_CLASS_SIGILS = [
    { className: 'Assassin', side: 'left', x: 9, y: 18, size: 184, alpha: 0.76, scale: 1.06, dx: 48, dy: -34, rot: -12, rotTo: 14, duration: 21.5, delay: -2.4, depth: 'near' },
    { className: 'Bard', side: 'left', x: 25, y: 26, size: 168, alpha: 0.64, scale: 1.00, dx: -42, dy: 42, rot: 16, rotTo: -12, duration: 24.0, delay: -14.5, depth: 'mid' },
    { className: 'Cleric', side: 'left', x: 10, y: 45, size: 178, alpha: 0.70, scale: 1.03, dx: 46, dy: 36, rot: 11, rotTo: -14, duration: 22.8, delay: -5.3, depth: 'near' },
    { className: 'Druid', side: 'left', x: 28, y: 54, size: 172, alpha: 0.66, scale: 1.00, dx: -38, dy: -44, rot: -13, rotTo: 12, duration: 23.5, delay: -8.2, depth: 'mid' },
    { className: 'Enchanter', side: 'left', x: 11, y: 73, size: 174, alpha: 0.68, scale: 1.02, dx: 44, dy: -38, rot: 12, rotTo: -12, duration: 23.0, delay: -11.0, depth: 'mid' },
    { className: 'Fighter', side: 'left', x: 27, y: 83, size: 188, alpha: 0.74, scale: 1.06, dx: -44, dy: -32, rot: 13, rotTo: -15, duration: 21.0, delay: -3.6, depth: 'near' },
    { className: 'Necromancer', side: 'left', x: 18, y: 93, size: 170, alpha: 0.64, scale: 1.00, dx: 36, dy: -42, rot: 15, rotTo: -13, duration: 24.5, delay: -12.6, depth: 'mid' },

    { className: 'Paladin', side: 'right', x: 75, y: 18, size: 188, alpha: 0.76, scale: 1.06, dx: -48, dy: -34, rot: -12, rotTo: 14, duration: 20.5, delay: -2.0, depth: 'near' },
    { className: 'Ranger', side: 'right', x: 91, y: 27, size: 184, alpha: 0.74, scale: 1.05, dx: 42, dy: 40, rot: 9, rotTo: -15, duration: 21.8, delay: -5.8, depth: 'near' },
    { className: 'Rogue', side: 'right', x: 76, y: 46, size: 174, alpha: 0.68, scale: 1.01, dx: -38, dy: 42, rot: -15, rotTo: 12, duration: 23.0, delay: -8.7, depth: 'mid' },
    { className: 'Shaman', side: 'right', x: 92, y: 55, size: 178, alpha: 0.70, scale: 1.03, dx: 42, dy: -38, rot: -10, rotTo: 15, duration: 22.5, delay: -7.4, depth: 'mid' },
    { className: 'Summoner', side: 'right', x: 75, y: 74, size: 180, alpha: 0.72, scale: 1.04, dx: -46, dy: -34, rot: -10, rotTo: 14, duration: 21.5, delay: -4.9, depth: 'near' },
    { className: 'Warden', side: 'right', x: 91, y: 84, size: 176, alpha: 0.68, scale: 1.02, dx: 38, dy: -42, rot: 14, rotTo: -12, duration: 22.5, delay: -6.1, depth: 'mid' },
    { className: 'Wizard', side: 'right', x: 82, y: 93, size: 170, alpha: 0.64, scale: 1.00, dx: -36, dy: -40, rot: 12, rotTo: -12, duration: 24.0, delay: -11.8, depth: 'mid' }
  ];

  const CREATOR_CLASS_EMBLEM_BOUNDS = {
    paladin: { x: 106, y: 24, w: 193, h: 242 },
    warden: { x: 124, y: 29, w: 158, h: 231 },
    fighter: { x: 26, y: 43, w: 354, h: 203 },
    rogue: { x: 26, y: 31, w: 354, h: 227 },
    ranger: { x: 26, y: 32, w: 354, h: 225 },
    assassin: { x: 26, y: 31, w: 354, h: 227 },
    wizard: { x: 115, y: 38, w: 175, h: 213 },
    shaman: { x: 101, y: 27, w: 204, h: 235 },
    summoner: { x: 119, y: 26, w: 167, h: 237 },
    necromancer: { x: 26, y: 27, w: 354, h: 235 },
    cleric: { x: 26, y: 27, w: 354, h: 235 },
    druid: { x: 26, y: 36, w: 354, h: 218 },
    bard: { x: 26, y: 33, w: 354, h: 223 },
    enchanter: { x: 67, y: 29, w: 272, h: 231 }
  };

  const HAIR_LABELS = {
    short: 'Short', long: 'Long', ponytail: 'Ponytail', braid: 'Braid', shaved: 'Shaved',
    pixie: 'Pixie Cut', curls: 'Curls', mohawk: 'Mohawk', bun: 'Bun', twinbraids: 'Twin Braids',
    topknot: 'Topknot', undercut: 'Undercut', loosewaves: 'Loose Waves'
  };

  const FACE_LABELS = {
    balanced: 'Balanced', soft: 'Soft', sharp: 'Sharp', stern: 'Stern', scarred: 'Scarred', tattooed: 'Tattooed'
  };

  const EYE_LABELS = {
    '#5b3a24': 'Brown', '#3a2416': 'Dark Brown', '#8a5f3c': 'Hazel', '#3f7fd1': 'Blue', '#8ec9ff': 'Sky Blue',
    '#4a8f52': 'Green', '#8f8f96': 'Gray', '#d8c06a': 'Amber', '#b8a0ff': 'Violet', '#d7dee3': 'Pale Silver',
    '#4fb8ac': 'Teal', '#e0b84a': 'Gold'
  };

  // Single data source for the Hair Color swatch row and the randomize pool - kept next to
  // EYE_LABELS/HAIR_LABELS rather than hardcoded inline where the swatches are built.
  const HAIR_COLOR_LABELS = {
    '#0b0a09': 'Black', '#1c1613': 'Charcoal', '#2b1c13': 'Dark Brown', '#3f2a1c': 'Ash Brown',
    '#4b3628': 'Medium Brown', '#6b4a30': 'Chestnut', '#8a5a34': 'Light Brown', '#a66b3d': 'Auburn',
    '#8f3b22': 'Red', '#b8531f': 'Copper', '#d1a45e': 'Blonde', '#e8cf8a': 'Dirty Blonde',
    '#c9c9d1': 'Silver', '#f2ead8': 'White', '#5a4a7a': 'Twilight Violet'
  };

  function classIcon(className) {
    return CLASS_ICON[className] || '⚔';
  }

  function classEmblemKey(className) {
    const raw = String(className || '').toLowerCase().replace(/[\s_\-]/g, '');
    if (!raw) return 'fighter';
    if (raw.includes('paladin') || raw.includes('crusader') || raw.includes('templar')) return 'paladin';
    if (raw.includes('warden') || raw.includes('guardian')) return 'warden';
    if (raw.includes('fighter') || raw.includes('warrior') || raw.includes('bruiser')) return 'fighter';
    if (raw.includes('rogue') || raw.includes('scout')) return 'rogue';
    if (raw.includes('ranger') || raw.includes('archer')) return 'ranger';
    if (raw.includes('assassin') || raw.includes('crossbow')) return 'assassin';
    if (raw.includes('wizard') || raw.includes('mage') || raw.includes('arcane')) return 'wizard';
    if (raw.includes('shaman') || raw.includes('totem')) return 'shaman';
    if (raw.includes('summoner') || raw.includes('adept')) return 'summoner';
    if (raw.includes('necromancer') || raw.includes('necro')) return 'necromancer';
    if (raw.includes('cleric') || raw.includes('priest') || raw.includes('healer')) return 'cleric';
    if (raw.includes('druid')) return 'druid';
    if (raw.includes('bard')) return 'bard';
    if (raw.includes('enchanter') || raw.includes('illusion')) return 'enchanter';
    return raw;
  }

  function classEmblemMeta(className) {
    const key = classEmblemKey(className);
    return CLASS_EMBLEM_BY_KEY[key] || CLASS_EMBLEM_META.Fighter;
  }

  function classEmblemImagePath(className) {
    const meta = classEmblemMeta(className);
    return `assets/ui/class-emblems/${meta.key}.png`;
  }

  const CREATOR_CLASS_BACKGROUND_IMAGE_CACHE = Object.create(null);

  const CLASS_BACKGROUND_WARNED = Object.create(null);

  function canonicalClassNameForVisual(className) {
    const meta = classEmblemMeta(className || 'Fighter');
    const exact = Object.keys(CLASSES || {}).find(name => classEmblemKey(name) === meta.key);
    return exact || String(className || 'Fighter');
  }

  function classBackgroundVisualSpec(className) {
    const meta = classEmblemMeta(className || 'Fighter');
    const canonicalName = canonicalClassNameForVisual(className || meta.key);
    const cls = CLASSES?.[canonicalName] || null;
    const color = /^#[0-9a-f]{3,8}$/i.test(String(cls?.color || '')) ? String(cls.color) : '#d8ad57';
    const backgroundPath = `assets/ui/class-backgrounds/${meta.key}.png`;
    const emblemPath = classEmblemImagePath(canonicalName);
    return {
      key: meta.key,
      className: canonicalName,
      color,
      backgroundPath,
      backgroundCss: `url('${backgroundPath}')`,
      emblemPath,
      emblemCss: `url('${emblemPath}')`
    };
  }

  function creatorClassBackgroundImagePath(className) {
    return classBackgroundVisualSpec(className).backgroundPath;
  }


  function classHudVisualStyle(className) {
    const spec = classBackgroundVisualSpec(className || 'Fighter');
    return `--party-class-bg:${spec.backgroundCss};--party-class-bg-image:${spec.backgroundCss};--party-class-emblem-bg:${spec.emblemCss};--party-class-color:${spec.color};`;
  }

  function applyPlayerHudCoreClassBackground(hudRoot, spec) {
    if (!hudRoot || !spec) return;
    const core = hudRoot.querySelector?.('.playerHudCore');
    if (!core) return;

    hudRoot.dataset.classBackgroundKey = spec.key;
    hudRoot.dataset.classBackgroundPath = spec.backgroundPath;
    hudRoot.style.setProperty('--party-class-bg', spec.backgroundCss);
    hudRoot.style.setProperty('--party-class-bg-image', spec.backgroundCss);
    hudRoot.style.setProperty('--party-class-emblem-bg', spec.emblemCss);
    hudRoot.style.setProperty('--party-class-color', spec.color);
    hudRoot.style.setProperty('background', 'rgba(4,5,9,0.88)', 'important');

    core.dataset.classBackgroundKey = spec.key;
    core.dataset.classBackgroundPath = spec.backgroundPath;
    core.style.setProperty('--party-class-bg', spec.backgroundCss);
    core.style.setProperty('--party-class-bg-image', spec.backgroundCss);
    core.style.setProperty('--party-class-emblem-bg', spec.emblemCss);
    core.style.setProperty('--party-class-color', spec.color);
    core.style.setProperty('position', 'relative', 'important');
    core.style.setProperty('overflow', 'hidden', 'important');
    core.style.setProperty('isolation', 'isolate', 'important');
    core.style.setProperty('min-height', '88px', 'important');
    core.style.setProperty('padding', '8px 8px 8px 10px', 'important');
    core.style.setProperty('border-radius', '10px', 'important');
    core.style.setProperty('background-image', [
      'linear-gradient(90deg, rgba(5, 7, 10, 0.88), rgba(5, 7, 10, 0.56) 50%, rgba(5, 7, 10, 0.84))',
      'radial-gradient(circle at 82% 52%, color-mix(in srgb, var(--party-class-color, #d8ad57) 34%, transparent), transparent 48%)',
      spec.backgroundCss,
      spec.emblemCss
    ].join(', '), 'important');
    core.style.setProperty('background-size', 'auto, auto, cover, 86px 86px', 'important');
    core.style.setProperty('background-position', 'center, center, right center, right 8px center', 'important');
    core.style.setProperty('background-repeat', 'no-repeat, no-repeat, no-repeat, no-repeat', 'important');
    core.style.setProperty('box-shadow', 'inset 0 0 0 1px color-mix(in srgb, var(--party-class-color, #d8ad57) 28%, transparent), inset 0 18px 28px rgba(255,255,255,0.035), inset 0 -18px 28px rgba(0,0,0,0.34)', 'important');

    const legacyBackdrop = hudRoot.querySelector?.('.hudClassBackdrop');
    if (legacyBackdrop) {
      legacyBackdrop.dataset.classBackgroundKey = spec.key;
      legacyBackdrop.dataset.classBackgroundPath = spec.backgroundPath;
      legacyBackdrop.style.setProperty('display', 'none', 'important');
    }
  }

  function ensurePlayerHudBackdropImage(surface, spec) {
    if (!surface || !spec) return;
    surface.dataset.classBackgroundKey = spec.key;
    surface.dataset.classBackgroundPath = spec.backgroundPath;
    surface.style.setProperty('--party-class-bg', spec.backgroundCss);
    surface.style.setProperty('--party-class-bg-image', spec.backgroundCss);
    surface.style.setProperty('--party-class-emblem-bg', spec.emblemCss);
    surface.style.setProperty('--party-class-color', spec.color);

    // V0.17.39 root-cause correction: the visible Player HUD top card is
    // .playerHudCore. Previous passes updated either the outer HUD wrapper or
    // an absolute backdrop that the black panel could still visually win over.
    // Apply the resolved class background directly to .playerHudCore, and keep
    // the legacy backdrop disabled so there is one visible Player HUD owner.
    const hudRoot = surface.closest?.('#hud.compactCharacterHud');
    if (hudRoot) applyPlayerHudCoreClassBackground(hudRoot, spec);
  }

  function applyClassHudVisualStyle(node, className) {
    if (!node) return;
    const spec = classBackgroundVisualSpec(className || 'Fighter');
    node.dataset.hudClass = spec.key;
    node.dataset.classBackgroundKey = spec.key;
    node.dataset.classBackgroundPath = spec.backgroundPath;
    node.style.setProperty('--party-class-bg', spec.backgroundCss);
    node.style.setProperty('--party-class-bg-image', spec.backgroundCss);
    node.style.setProperty('--party-class-emblem-bg', spec.emblemCss);
    node.style.setProperty('--party-class-color', spec.color);
    node.style.setProperty('--pd-class-bg', spec.backgroundCss);
    node.style.setProperty('--pd-class-bg-image', spec.backgroundCss);
    node.style.setProperty('--pd-class-emblem', spec.emblemCss);
    node.style.setProperty('--pd-class-color', spec.color);

    if (node.matches?.('#hud.compactCharacterHud')) applyPlayerHudCoreClassBackground(node, spec);

    // Keep the actual background-bearing surfaces in sync even when a panel is
    // reparented, rendered through a fast HUD path, or rebuilt after this call.
    // V0.17.28 root cause: the previous helper updated only the container and
    // left the HUD fast path recursively calling itself instead of applying this
    // resolver. Both HUD and Character preview now get the same canonical class
    // image variables, including the explicit *-image aliases consumed by CSS
    // background-image layers.
    node.querySelectorAll?.('.hudClassBackdrop, .paperDollClassBackdrop, .classBackgroundSurface, .paperDollPreview')?.forEach(surface => {
      surface.dataset.classBackgroundKey = spec.key;
      surface.dataset.classBackgroundPath = spec.backgroundPath;
      surface.style.setProperty('--party-class-bg', spec.backgroundCss);
      surface.style.setProperty('--party-class-bg-image', spec.backgroundCss);
      surface.style.setProperty('--party-class-emblem-bg', spec.emblemCss);
      surface.style.setProperty('--party-class-color', spec.color);
      surface.style.setProperty('--pd-class-bg', spec.backgroundCss);
      surface.style.setProperty('--pd-class-bg-image', spec.backgroundCss);
      surface.style.setProperty('--pd-class-emblem', spec.emblemCss);
      surface.style.setProperty('--pd-class-color', spec.color);

      // V0.17.29: apply the resolved class image on the actual image-bearing
      // surfaces as an inline layer through the canonical resolver. The previous
      // passes set variables correctly, but later CSS fallback/background rules
      // could still win visually and make the panel read as flat green/dark.
      if (surface.classList?.contains('hudClassBackdrop')) {
        ensurePlayerHudBackdropImage(surface, spec);
      } else if (surface.classList?.contains('paperDollPreview')) {
        // V0.17.30: the paper-doll model canvas is the sole owner that draws
        // class background art for this surface. Keep the DOM layer as a dark
        // readability/vignette fallback only; otherwise the same class image is
        // painted once by CSS and once by canvas, creating the duplicate smaller
        // copy at the top of the Character Model preview.
        surface.style.backgroundImage = [
          'radial-gradient(ellipse at 50% 70%, rgba(0,0,0,0.00), rgba(0,0,0,0.22) 76%)',
          'linear-gradient(180deg, rgba(5,6,10,0.16), rgba(2,3,6,0.24))'
        ].join(', ');
        surface.style.backgroundSize = 'auto, auto';
        surface.style.backgroundPosition = 'center, center';
        surface.style.backgroundRepeat = 'no-repeat';
      }
    });
  }

  function getCreatorClassBackgroundImage(className) {
    if (typeof Image === 'undefined') return null;
    const meta = classEmblemMeta(className);
    let img = CREATOR_CLASS_BACKGROUND_IMAGE_CACHE[meta.key];
    if (!img) {
      img = new Image();
      img.decoding = 'async';
      img.onerror = () => {
        if (!CLASS_BACKGROUND_WARNED[meta.key]) {
          CLASS_BACKGROUND_WARNED[meta.key] = true;
          if (DR.CONFIG?.DEBUG || window.DEBUG) console.warn(`[Blackroot] Missing class background asset: ${meta.key} -> ${img.src}`);
        }
      };
      img.src = creatorClassBackgroundImagePath(className);
      CREATOR_CLASS_BACKGROUND_IMAGE_CACHE[meta.key] = img;
    }
    return img;
  }

  // V0.16.05: keep the previous public helper name alive. The V0.16.05
  // renderer moved from emblem-sheet art to full custom background art, but the
  // DreamRealms export block still referenced getCreatorClassEmblemImage. That
  // undefined reference aborted ui-system startup and left main-menu buttons inert.
  function getCreatorClassEmblemImage(className) {
    return getCreatorClassBackgroundImage(className);
  }

  function drawCreatorClassEmblemBackdrop(ctx, className, cssW, cssH, options = {}, owner = null) {
    const img = getCreatorClassBackgroundImage(className);
    if (!ctx || !img) return false;

    if (!img.complete || !img.naturalWidth || !img.naturalHeight) {
      if (!img.__dreamRealmsCreatorBackgroundLoadHooked) {
        img.__dreamRealmsCreatorBackgroundLoadHooked = true;
        img.addEventListener('load', () => owner?.renderCreatorPreviewCanvas?.(), { once: true });
      }
      return false;
    }

    // V0.16.05: use full custom class-background art for the character creator
    // instead of trying to reuse cropped emblem icons. The background is drawn
    // with a centered cover fit so the class emblem stays centered behind the
    // model while filling the entire preview canvas.
    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    const srcRatio = srcW / Math.max(1, srcH);
    const dstRatio = cssW / Math.max(1, cssH);

    let sx = 0;
    let sy = 0;
    let sw = srcW;
    let sh = srcH;

    if (srcRatio > dstRatio) {
      sw = Math.round(srcH * dstRatio);
      sx = Math.round((srcW - sw) * 0.5);
    } else if (srcRatio < dstRatio) {
      sh = Math.round(srcW / dstRatio);
      sy = Math.round((srcH - sh) * 0.5);
    }

    ctx.save();
    ctx.imageSmoothingEnabled = true;

    // Full custom class backdrop.
    ctx.globalAlpha = Number(options.backdropAlpha ?? 0.88);
    ctx.filter = 'saturate(1.08) brightness(0.92) contrast(1.05)';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cssW, cssH);

    // Subtle center-preserving vignette for character readability.
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    const vignette = ctx.createRadialGradient(
      cssW * 0.5, cssH * 0.48, Math.min(cssW, cssH) * 0.16,
      cssW * 0.5, cssH * 0.50, Math.max(cssW, cssH) * 0.62
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0.02)');
    vignette.addColorStop(0.58, 'rgba(0,0,0,0.10)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, cssW, cssH);

    // Slight floor darkening so lower UI/control strip does not fight the art.
    const bottomFade = ctx.createLinearGradient(0, cssH * 0.68, 0, cssH);
    bottomFade.addColorStop(0, 'rgba(0,0,0,0)');
    bottomFade.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = bottomFade;
    ctx.fillRect(0, 0, cssW, cssH);

    ctx.restore();

    // V0.16.15: subtle animated ambient flare layered on top of the existing static
    // backdrop art (glow pulse + drifting motes), themed to the selected class's own
    // accent color. This is additive polish on the same backdrop draw call driven by
    // the creator preview's per-frame animation loop - no second canvas, no separate
    // timer, no replacement of the existing background art.
    if (options.animateBackdrop !== false) {
      drawCreatorClassAmbientFlare(ctx, className, cssW, cssH, performance.now());
    }

    return true;
  }



  function drawClassBackgroundPanelBackdrop(ctx, className, cssW, cssH, options = {}, owner = null) {
    const img = getCreatorClassBackgroundImage(className);
    if (!ctx || !img) return false;

    if (!img.complete || !img.naturalWidth || !img.naturalHeight) {
      if (!img.__dreamRealmsPanelBackgroundLoadHooked) {
        img.__dreamRealmsPanelBackgroundLoadHooked = true;
        img.addEventListener('load', () => {
          owner?.renderPaperDollClassModel?.(document);
          owner?.renderCharacterPanel?.();
          owner?.markUiDirty?.('class-background-loaded');
        }, { once: true });
      }
      return false;
    }

    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    const coverRatio = cssW / Math.max(1, cssH);
    const srcRatio = srcW / Math.max(1, srcH);
    let sx = 0;
    let sy = 0;
    let sw = srcW;
    let sh = srcH;
    if (srcRatio > coverRatio) {
      sw = Math.round(srcH * coverRatio);
      sx = Math.round((srcW - sw) * 0.5);
    } else if (srcRatio < coverRatio) {
      sh = Math.round(srcW / coverRatio);
      sy = Math.round((srcH - sh) * 0.5);
    }

    ctx.save();
    ctx.imageSmoothingEnabled = true;

    // Root-cause correction for V0.17.29: the CSS class-background layer was
    // technically resolving, but the tall paper-doll viewport cropped the
    // landscape art to a narrow dark center slice and then stacked a green-tinted
    // readability layer above it. Draw the resolved class art directly into the
    // model canvas before the character, using the same canonical resolver, so
    // the background is not hidden by DOM fallback panels or viewport crop.
    ctx.globalAlpha = Number(options.coverAlpha ?? 0.72);
    ctx.filter = 'saturate(1.12) brightness(0.88) contrast(1.08)';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cssW, cssH);

    // V0.17.30: do not draw a second contained/hero copy of the same class
    // background. The prior V0.17.29 implementation intentionally added this
    // centered top layer to make the artwork obvious, but in the tall Character
    // Model panel it rendered as a visible duplicate image above the correctly
    // fitted full background. One cover-fit draw is now the only class art pass.

    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    const midVignette = ctx.createRadialGradient(
      cssW * 0.5, cssH * 0.54, Math.min(cssW, cssH) * 0.22,
      cssW * 0.5, cssH * 0.50, Math.max(cssW, cssH) * 0.74
    );
    midVignette.addColorStop(0, 'rgba(0,0,0,0.00)');
    midVignette.addColorStop(0.62, 'rgba(0,0,0,0.08)');
    midVignette.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = midVignette;
    ctx.fillRect(0, 0, cssW, cssH);

    const modelReadability = ctx.createLinearGradient(0, cssH * 0.34, 0, cssH);
    modelReadability.addColorStop(0, 'rgba(0,0,0,0.00)');
    modelReadability.addColorStop(0.52, 'rgba(0,0,0,0.08)');
    modelReadability.addColorStop(1, 'rgba(0,0,0,0.30)');
    ctx.fillStyle = modelReadability;
    ctx.fillRect(0, 0, cssW, cssH);

    ctx.restore();
    return true;
  }

  function hexToRgba(hex, alpha) {
    const clean = String(hex || '').replace('#', '');
    const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean.padEnd(6, '0').slice(0, 6);
    const r = parseInt(full.slice(0, 2), 16) || 0;
    const g = parseInt(full.slice(2, 4), 16) || 0;
    const b = parseInt(full.slice(4, 6), 16) || 0;
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
  }

  function creatorFlareSeed(className, index) {
    const str = `${className}-${index}`;
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967295;
  }

  const CREATOR_FLARE_PARTICLE_COUNT = 18;

  const CREATOR_CLASS_THEME_VISUALS = {
    Paladin: { accent: '#f3d98b', secondary: '#fff7cf', particle: 'holy', field: 'rays', symbol: 'sunCross', count: 24, speed: 0.18, intensity: 1.28, fieldDensity: 1.30 },
    Warden: { accent: '#9fba72', secondary: '#8e7d50', particle: 'stoneLeaf', field: 'wardRunes', symbol: 'wardRune', count: 22, speed: 0.13, intensity: 1.18, fieldDensity: 1.20 },
    Fighter: { accent: '#d88949', secondary: '#d8c2a0', particle: 'emberSteel', field: 'martialSigils', symbol: 'crossedBlades', count: 26, speed: 0.20, intensity: 1.25, fieldDensity: 1.18 },
    Rogue: { accent: '#7a85a5', secondary: '#313748', particle: 'shadow', field: 'shadowVeil', symbol: 'daggerMoon', count: 21, speed: 0.15, intensity: 1.18, fieldDensity: 1.12 },
    Ranger: { accent: '#7fc36b', secondary: '#d5ba69', particle: 'leaf', field: 'forestGlyphs', symbol: 'arrowLeaf', count: 27, speed: 0.20, intensity: 1.24, fieldDensity: 1.25 },
    Assassin: { accent: '#81c66a', secondary: '#293b2d', particle: 'poison', field: 'smoke', symbol: 'venomDagger', count: 23, speed: 0.18, intensity: 1.23, fieldDensity: 1.18 },
    Wizard: { accent: '#86b9ff', secondary: '#d6c4ff', particle: 'arcane', field: 'arcaneRunes', symbol: 'arcaneDiamond', count: 24, speed: 0.16, intensity: 1.25, fieldDensity: 1.25 },
    Shaman: { accent: '#5ec6d4', secondary: '#7edb8d', particle: 'spirit', field: 'spiritTotems', symbol: 'totemStorm', count: 26, speed: 0.18, intensity: 1.28, fieldDensity: 1.28 },
    Summoner: { accent: '#b485ff', secondary: '#6d5ad8', particle: 'sigil', field: 'summonCircle', symbol: 'summonSigil', count: 23, speed: 0.15, intensity: 1.25, fieldDensity: 1.30 },
    Necromancer: { accent: '#75e37f', secondary: '#46cfc3', particle: 'necro', field: 'graveMist', symbol: 'skullRune', count: 25, speed: 0.15, intensity: 1.30, fieldDensity: 1.32 },
    Cleric: { accent: '#f5e7a5', secondary: '#9edbff', particle: 'healing', field: 'softSanctum', symbol: 'healingCross', count: 22, speed: 0.13, intensity: 1.18, fieldDensity: 1.18 },
    Druid: { accent: '#72d37c', secondary: '#b1e06b', particle: 'seedGlow', field: 'groveGlyphs', symbol: 'moonLeaf', count: 27, speed: 0.17, intensity: 1.24, fieldDensity: 1.28 },
    Bard: { accent: '#f0be67', secondary: '#d99dff', particle: 'music', field: 'songGlyphs', symbol: 'musicNote', count: 24, speed: 0.16, intensity: 1.22, fieldDensity: 1.30 },
    Enchanter: { accent: '#d28cff', secondary: '#88d8ff', particle: 'charm', field: 'illusionGlyphs', symbol: 'charmEye', count: 25, speed: 0.15, intensity: 1.24, fieldDensity: 1.28 }
  };

  function getCreatorClassThemeVisuals(className) {
    const cls = CLASSES[className] || CLASSES.Fighter || {};
    const theme = CREATOR_CLASS_THEME_VISUALS[className] || CREATOR_CLASS_THEME_VISUALS.Fighter;
    return {
      accent: theme.accent || cls.color || '#d8ae43',
      secondary: theme.secondary || cls.color || '#d8ae43',
      particle: theme.particle || 'arcane',
      field: theme.field || 'arcaneRunes',
      symbol: theme.symbol || 'arcaneDiamond',
      count: Math.max(10, Math.min(30, Math.floor(theme.count || CREATOR_FLARE_PARTICLE_COUNT))),
      speed: Math.max(0.08, Math.min(0.32, Number(theme.speed || 0.16))),
      intensity: Math.max(0.75, Math.min(1.55, Number(theme.intensity || 1.12))),
      fieldDensity: Math.max(0.8, Math.min(1.6, Number(theme.fieldDensity || 1.1)))
    };
  }

  function drawCreatorThemeField(ctx, theme, cssW, cssH, t) {
    const cx = cssW * 0.5;
    const cy = cssH * 0.44;
    const base = Math.min(cssW, cssH);
    const intensity = theme.intensity || 1;
    const density = theme.fieldDensity || 1;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (theme.field === 'rays' || theme.field === 'softSanctum') {
      const rayCount = Math.max(7, Math.round(8 * density));
      for (let i = 0; i < rayCount; i++) {
        const a = -Math.PI * 0.9 + i * (Math.PI * 1.8 / Math.max(1, rayCount - 1)) + Math.sin(t * 0.32 + i) * 0.035;
        const len = base * (0.36 + 0.055 * Math.sin(t * 0.58 + i));
        ctx.globalAlpha = (theme.field === 'softSanctum' ? 0.11 : 0.15) * intensity;
        ctx.strokeStyle = hexToRgba(i % 2 ? theme.secondary : theme.accent, 1);
        ctx.lineWidth = Math.max(1, base * 0.006);
        ctx.beginPath();
        ctx.moveTo(cx, cy - base * 0.1);
        ctx.lineTo(cx + Math.cos(a) * len, cy - base * 0.1 + Math.sin(a) * len);
        ctx.stroke();
      }
    }

    if (['arcaneRunes', 'summonCircle', 'wardRunes'].includes(theme.field)) {
      const radius = base * (theme.field === 'summonCircle' ? 0.22 : 0.18);
      const ringCount = density > 1.22 ? 3 : 2;
      for (let ring = 0; ring < ringCount; ring++) {
        ctx.globalAlpha = (ring ? 0.13 : 0.2) * intensity;
        ctx.strokeStyle = hexToRgba(ring ? theme.secondary : theme.accent, 1);
        ctx.lineWidth = Math.max(1, base * (ring ? 0.003 : 0.004));
        ctx.setLineDash([base * 0.025, base * 0.02]);
        ctx.lineDashOffset = (ring ? -1 : 1) * t * base * 0.018;
        ctx.beginPath();
        ctx.arc(cx, cy + base * 0.05, radius + ring * base * 0.05, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      const glyphs = Math.max(theme.field === 'wardRunes' ? 6 : 8, Math.round((theme.field === 'wardRunes' ? 6 : 8) * density));
      for (let i = 0; i < glyphs; i++) {
        const a = i / glyphs * Math.PI * 2 + t * (theme.field === 'summonCircle' ? 0.12 : 0.08);
        const gx = cx + Math.cos(a) * (radius + base * 0.05);
        const gy = cy + base * 0.05 + Math.sin(a) * (radius + base * 0.05) * 0.42;
        ctx.globalAlpha = 0.2 * intensity;
        ctx.strokeStyle = hexToRgba(theme.secondary, 1);
        ctx.lineWidth = 1;
        ctx.strokeRect(gx - 3, gy - 3, 6, 6);
      }
    }

    if (['shadowVeil', 'smoke', 'graveMist'].includes(theme.field)) {
      const mistCount = Math.max(5, Math.round(6 * density));
      for (let i = 0; i < mistCount; i++) {
        const seed = creatorFlareSeed(theme.field, i);
        const x = (seed * cssW + Math.sin(t * 0.18 + i) * cssW * 0.08) % cssW;
        const y = cssH * (0.24 + i * 0.12) + Math.cos(t * 0.14 + i) * cssH * 0.035;
        const r = base * (0.09 + seed * 0.05);
        const mist = ctx.createRadialGradient(x, y, 0, x, y, r);
        mist.addColorStop(0, hexToRgba(i % 2 ? theme.secondary : theme.accent, (theme.field === 'graveMist' ? 0.16 : 0.1) * intensity));
        mist.addColorStop(1, hexToRgba(theme.accent, 0));
        ctx.globalAlpha = 1;
        ctx.fillStyle = mist;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }

    if (['martialSigils', 'forestGlyphs', 'songGlyphs', 'spiritTotems', 'groveGlyphs', 'illusionGlyphs'].includes(theme.field)) {
      const glyphCount = Math.max(5, Math.round(6 * density));
      const orbitX = base * 0.25;
      const orbitY = base * 0.13;
      for (let i = 0; i < glyphCount; i++) {
        const seed = creatorFlareSeed(theme.field, i);
        const a = seed * Math.PI * 2 + t * (0.045 + seed * 0.035) * (i % 2 ? -1 : 1);
        const gx = cx + Math.cos(a) * orbitX + Math.sin(t * 0.18 + i) * base * 0.02;
        const gy = cy + base * 0.04 + Math.sin(a) * orbitY + Math.cos(t * 0.16 + i) * base * 0.018;
        const scale = Math.max(0.72, Math.min(1.35, base / 820)) * (0.85 + seed * 0.45);
        const alpha = (0.13 + seed * 0.08) * intensity;
        drawCreatorThemeSymbol(ctx, theme, gx, gy, scale, a + t * 0.12, alpha, i);
      }

      const auraCount = Math.max(7, Math.round(8 * density));
      for (let i = 0; i < auraCount; i++) {
        const seed = creatorFlareSeed(`${theme.field}-aura`, i);
        const ring = base * (0.18 + seed * 0.16);
        const a = seed * Math.PI * 2 + t * (0.035 + seed * 0.025);
        const x = cx + Math.cos(a) * ring;
        const y = cy + base * 0.06 + Math.sin(a) * ring * 0.45;
        const r = base * (0.012 + seed * 0.016);
        const mote = ctx.createRadialGradient(x, y, 0, x, y, r);
        mote.addColorStop(0, hexToRgba(i % 2 ? theme.secondary : theme.accent, 0.18 * intensity));
        mote.addColorStop(1, hexToRgba(theme.accent, 0));
        ctx.globalAlpha = 1;
        ctx.fillStyle = mote;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }

    ctx.restore();
  }


  function drawCreatorThemeSymbol(ctx, theme, x, y, scale, angle, alpha, index = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = hexToRgba(index % 2 ? theme.secondary : theme.accent, 1);
    ctx.fillStyle = hexToRgba(theme.accent, 1);
    ctx.lineWidth = 1.25;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const symbol = theme.symbol || 'arcaneDiamond';
    if (symbol === 'crossedBlades') {
      ctx.beginPath();
      ctx.moveTo(-12, -10); ctx.lineTo(11, 10);
      ctx.moveTo(12, -10); ctx.lineTo(-11, 10);
      ctx.moveTo(-5, 7); ctx.lineTo(-9, 12);
      ctx.moveTo(5, 7); ctx.lineTo(9, 12);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (symbol === 'arrowLeaf') {
      ctx.beginPath();
      ctx.moveTo(0, -13); ctx.lineTo(8, 4); ctx.lineTo(2, 2); ctx.lineTo(2, 12); ctx.lineTo(-2, 12); ctx.lineTo(-2, 2); ctx.lineTo(-8, 4); ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(11, -3, 4, 8, 0.6, 0, Math.PI * 2);
      ctx.stroke();
    } else if (symbol === 'musicNote') {
      ctx.font = '24px Georgia, serif';
      ctx.fillText(index % 3 === 0 ? '♪' : (index % 3 === 1 ? '♫' : '♬'), -8, 8);
      ctx.beginPath();
      ctx.arc(0, 0, 14, Math.PI * 0.15, Math.PI * 0.75);
      ctx.stroke();
    } else if (symbol === 'totemStorm') {
      ctx.beginPath();
      ctx.moveTo(-5, -12); ctx.lineTo(5, -12); ctx.lineTo(2, -2); ctx.lineTo(8, -2); ctx.lineTo(-2, 13); ctx.lineTo(1, 3); ctx.lineTo(-7, 3); ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -15, 3, 0, Math.PI * 2);
      ctx.stroke();
    } else if (symbol === 'moonLeaf') {
      ctx.beginPath();
      ctx.arc(-2, -1, 11, Math.PI * 0.55, Math.PI * 1.55);
      ctx.arc(3, -1, 8, Math.PI * 1.52, Math.PI * 0.57, true);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(9, 6, 4, 9, -0.7, 0, Math.PI * 2);
      ctx.stroke();
    } else if (symbol === 'charmEye') {
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -14); ctx.lineTo(6, -7); ctx.lineTo(0, -3); ctx.lineTo(-6, -7); ctx.closePath();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -12); ctx.lineTo(12, 0); ctx.lineTo(0, 12); ctx.lineTo(-12, 0); ctx.closePath();
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawCreatorThemeParticle(ctx, theme, x, y, size, angle, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = hexToRgba(theme.accent, 1);
    ctx.strokeStyle = hexToRgba(theme.secondary, 1);
    ctx.lineWidth = 1;

    if (theme.particle === 'leaf' || theme.particle === 'stoneLeaf') {
      ctx.scale(size * 0.95, size * 0.55);
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.quadraticCurveTo(3, 0, 0, 2);
      ctx.quadraticCurveTo(-3, 0, 0, -2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-1.5, 0);
      ctx.lineTo(1.5, 0);
      ctx.stroke();
    } else if (theme.particle === 'emberSteel') {
      ctx.fillStyle = hexToRgba(theme.accent, 1);
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(theme.secondary, 1);
      ctx.beginPath();
      ctx.moveTo(-size * 1.15, -size * 1.15);
      ctx.lineTo(size * 1.15, size * 1.15);
      ctx.moveTo(size * 1.15, -size * 1.15);
      ctx.lineTo(-size * 1.15, size * 1.15);
      ctx.stroke();
    } else if (theme.particle === 'spirit') {
      ctx.strokeStyle = hexToRgba(theme.secondary, 1);
      ctx.fillStyle = hexToRgba(theme.accent, 1);
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-size * 0.7, -size * 1.7);
      ctx.lineTo(size * 0.1, -size * 0.3);
      ctx.lineTo(-size * 0.55, -size * 0.25);
      ctx.lineTo(size * 0.55, size * 1.7);
      ctx.stroke();
    } else if (theme.particle === 'seedGlow') {
      ctx.fillStyle = hexToRgba(theme.accent, 1);
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.75, size * 1.25, 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha * 0.55;
      ctx.strokeStyle = hexToRgba(theme.secondary, 1);
      ctx.beginPath();
      ctx.arc(0, 0, size * 1.8, 0, Math.PI * 2);
      ctx.stroke();
    } else if (theme.particle === 'charm') {
      ctx.strokeStyle = hexToRgba(theme.secondary, 1);
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 1.55, size * 0.75, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.45, 0, Math.PI * 2);
      ctx.fill();
    } else if (theme.particle === 'sparks' || theme.particle === 'current') {
      ctx.strokeStyle = hexToRgba(theme.particle === 'current' ? theme.secondary : theme.accent, 1);
      ctx.beginPath();
      ctx.moveTo(-size * 1.1, -size * 1.1);
      ctx.lineTo(size * 1.1, size * 1.1);
      ctx.moveTo(size * 1.1, -size * 1.1);
      ctx.lineTo(-size * 1.1, size * 1.1);
      ctx.stroke();
    } else if (theme.particle === 'music') {
      ctx.font = `${Math.max(9, size * 5)}px Georgia, serif`;
      ctx.fillText(creatorFlareSeed(theme.particle, Math.floor(size * 10)) > 0.5 ? '♪' : '♫', -size * 1.2, size * 1.3);
    } else if (theme.particle === 'arcane' || theme.particle === 'sigil' || theme.particle === 'illusion') {
      ctx.beginPath();
      ctx.moveTo(0, -size * 1.6);
      ctx.lineTo(size * 1.6, 0);
      ctx.lineTo(0, size * 1.6);
      ctx.lineTo(-size * 1.6, 0);
      ctx.closePath();
      ctx.stroke();
    } else if (theme.particle === 'holy' || theme.particle === 'healing') {
      ctx.beginPath();
      ctx.moveTo(-size * 1.7, 0);
      ctx.lineTo(size * 1.7, 0);
      ctx.moveTo(0, -size * 1.7);
      ctx.lineTo(0, size * 1.7);
      ctx.stroke();
    } else if (theme.particle === 'poison' || theme.particle === 'necro' || theme.particle === 'shadow') {
      ctx.beginPath();
      ctx.arc(0, 0, size * 1.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha * 0.45;
      ctx.beginPath();
      ctx.arc(size * 0.7, -size * 0.55, size * 0.65, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(theme.secondary, 1);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawCreatorClassAmbientFlare(ctx, className, cssW, cssH, now) {
    const theme = getCreatorClassThemeVisuals(className);
    const t = now * 0.001;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // V0.16.17: selected class now drives an explicit theme profile rather than a
    // single generic color tint. The work stays inside the existing preview-canvas
    // background owner so it does not add overlay canvases or duplicate timers.
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.55);
    const glowRadius = Math.max(cssW, cssH) * (0.4 + pulse * 0.05);
    const glow = ctx.createRadialGradient(
      cssW * 0.5, cssH * 0.42, glowRadius * 0.08,
      cssW * 0.5, cssH * 0.42, glowRadius
    );
    const intensity = theme.intensity || 1;
    glow.addColorStop(0, hexToRgba(theme.accent, (0.13 + pulse * 0.08) * intensity));
    glow.addColorStop(0.55, hexToRgba(theme.secondary, (0.045 + pulse * 0.025) * intensity));
    glow.addColorStop(1, hexToRgba(theme.accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, cssW, cssH);

    drawCreatorThemeField(ctx, theme, cssW, cssH, t);

    for (let i = 0; i < theme.count; i++) {
      const seedX = creatorFlareSeed(className, i);
      const seedSpeed = theme.speed + creatorFlareSeed(className, i + 100) * theme.speed;
      const seedPhase = creatorFlareSeed(className, i + 200) * Math.PI * 2;
      const seedSize = (1.2 + creatorFlareSeed(className, i + 300) * 2.2) * Math.min(1.22, intensity);
      const driftX = Math.sin(t * (0.38 + theme.speed * 0.85) + seedPhase) * cssW * (theme.field === 'wind' ? 0.072 : 0.037);
      const travel = (t * seedSpeed + seedX) % 1.1;
      const y = cssH * 1.03 - travel * cssH * 1.1;
      const x = (seedX * cssW + driftX + cssW) % cssW;
      const flicker = 0.36 + 0.64 * (0.5 + 0.5 * Math.sin(t * 2.0 + seedPhase));
      drawCreatorThemeParticle(ctx, theme, x, y, seedSize, seedPhase + t * (0.22 + theme.speed), Math.min(0.68, 0.45 * intensity) * flicker);
    }

    ctx.restore();
  }

  function classEmblemBackgroundPosition(className) {
    const meta = classEmblemMeta(className);
    const xDenom = Math.max(1, CLASS_EMBLEM_COLUMNS - 1);
    const yDenom = Math.max(1, CLASS_EMBLEM_ROWS - 1);
    return {
      x: `${(meta.col / xDenom) * 100}%`,
      y: `${(meta.row / yDenom) * 100}%`
    };
  }

  function classEmblemMarkup(className, options = {}) {
    const meta = classEmblemMeta(className);
    const pos = classEmblemBackgroundPosition(className);
    const size = Math.max(16, Math.round(Number(options.size) || 32));
    const extraClass = options.className ? ` ${escapeHtml(String(options.className))}` : '';
    const title = options.title === false ? '' : ` title="${escapeHtml(String(options.title || className || meta.key))}"`;
    return `<div class="classEmblemBadge${extraClass}" data-class-emblem="${escapeHtml(meta.key)}" style="width:${size}px;height:${size}px;--emblem-image:url('${classEmblemImagePath(className)}');--emblem-sheet:url('${CLASS_EMBLEM_SHEET}');--emblem-x:${pos.x};--emblem-y:${pos.y};--emblem-background-size:${CLASS_EMBLEM_BACKGROUND_SIZE}"${title}><span class="classEmblemFallback">${escapeHtml(meta.fallback || classIcon(className))}</span></div>`;
  }

  function applyClassEmblem(node, className, options = {}) {
    if (!node) return;
    const meta = classEmblemMeta(className);
    const pos = classEmblemBackgroundPosition(className);
    const size = Number(options.size) || 0;
    const fallback = escapeHtml(meta.fallback || classIcon(className));
    const extraClass = String(options.extraClass || '');
    node.classList.add('classEmblemBadge');
    if (extraClass) extraClass.split(/\s+/).filter(Boolean).forEach(cls => node.classList.add(cls));
    const renderKey = `${meta.key}|${Math.round(size || 0)}|${extraClass}|${options.title === false ? '' : String(options.title || className || meta.key)}`;
    if (node.dataset.classEmblemRenderKey === renderKey && node.querySelector('.classEmblemFallback')) return;
    const prevKey = node.dataset.classEmblem || '';
    node.dataset.classEmblem = meta.key;
    node.dataset.classEmblemRenderKey = renderKey;
    node.style.setProperty('--emblem-image', `url('${classEmblemImagePath(className)}')`);
    node.style.setProperty('--emblem-sheet', `url('${CLASS_EMBLEM_SHEET}')`);
    node.style.setProperty('--emblem-x', pos.x);
    node.style.setProperty('--emblem-y', pos.y);
    node.style.setProperty('--emblem-background-size', CLASS_EMBLEM_BACKGROUND_SIZE);
    if (size > 0) {
      const px = `${Math.round(size)}px`;
      if (node.style.width !== px) node.style.width = px;
      if (node.style.height !== px) node.style.height = px;
    }
    if (options.title !== false) {
      const nextTitle = String(options.title || className || meta.key);
      if (node.title !== nextTitle) node.title = nextTitle;
    }
    if (prevKey !== meta.key || !node.querySelector('.classEmblemFallback')) {
      node.innerHTML = `<span class="classEmblemFallback">${fallback}</span>`;
    }
  }

  DR.classEmblemKey = classEmblemKey;
  DR.classEmblemMeta = classEmblemMeta;
  DR.classEmblemMarkup = classEmblemMarkup;
  DR.classBackgroundVisualSpec = classBackgroundVisualSpec;
  DR.classHudVisualStyle = classHudVisualStyle;
  DR.applyClassHudVisualStyle = applyClassHudVisualStyle;
  DR.partyClassCardStyle = classHudVisualStyle;
  DR.applyClassEmblem = applyClassEmblem;
  DR.classEmblemImagePath = classEmblemImagePath;
  DR.getCreatorClassEmblemImage = getCreatorClassEmblemImage;
  DR.getCreatorClassBackgroundImage = getCreatorClassBackgroundImage;
  DR.creatorClassBackgroundImagePath = creatorClassBackgroundImagePath;
  DR.drawClassBackgroundPanelBackdrop = drawClassBackgroundPanelBackdrop;
  DR.classEmblemSheet = CLASS_EMBLEM_SHEET;
  DR.classEmblemColumns = CLASS_EMBLEM_COLUMNS;
  DR.classEmblemRows = CLASS_EMBLEM_ROWS;
  if (typeof Image !== 'undefined') {
    const classEmblemImage = new Image();
    classEmblemImage.src = CLASS_EMBLEM_SHEET;
    DR.classEmblemImage = classEmblemImage;
  }

  function renderStatusTray(entity, options = {}) {
    if (!DR.StatusEffects?.renderTray) return '';
    return DR.StatusEffects.renderTray(entity, options.limit || 10, options);
  }

  function activeGameForUiMetrics() {
    return window.DarkWoodsGame || null;
  }

  function recordUiWrite(kind) {
    const game = activeGameForUiMetrics();
    const stats = game?.perfStats;
    if (!stats) return;
    stats.uiDomWrites = (stats.uiDomWrites || 0) + 1;
    if (kind === 'html') stats.uiHtmlWrites = (stats.uiHtmlWrites || 0) + 1;
    else if (kind === 'style') stats.uiStyleWrites = (stats.uiStyleWrites || 0) + 1;
    else if (kind === 'class') stats.uiClassWrites = (stats.uiClassWrites || 0) + 1;
    else stats.uiTextWrites = (stats.uiTextWrites || 0) + 1;
  }

  function setText(node, value) {
    if (!node) return false;
    const next = String(value ?? '');
    if (node.textContent !== next) {
      node.textContent = next;
      recordUiWrite('text');
      return true;
    }
    return false;
  }

  function setHtml(node, value) {
    if (!node) return false;
    const next = String(value ?? '');
    if (node.innerHTML !== next) {
      node.innerHTML = next;
      recordUiWrite('html');
      return true;
    }
    return false;
  }

  function normalizedHudBarLabel(label) {
    const base = String(label ?? '').trim().replace(/:+$/, '');
    return `${base || 'Value'}:`;
  }

  function hudBarTextMarkup(label, value) {
    return `<span class="barTextLabel">${escapeHtml(normalizedHudBarLabel(label))}</span><span class="barTextValue">${escapeHtml(value)}</span>`;
  }

  function setHudBarText(node, label, value) {
    return setHtml(node, hudBarTextMarkup(label, value));
  }

  function partyBarTextMarkup(label, value) {
    return `<span class="partyValueLabel">${escapeHtml(normalizedHudBarLabel(label))}</span><span class="partyValueValue">${escapeHtml(value)}</span>`;
  }

  function legacyPartyHealthTextMarkup(label, value) {
    return `<span class="partyHealthLabel">${escapeHtml(normalizedHudBarLabel(label))}</span><span class="partyHealthValue">${escapeHtml(value)}</span>`;
  }

  function setDisplay(node, value) {
    if (!node) return false;
    const next = String(value ?? '');
    if (node.style.display !== next) {
      node.style.display = next;
      recordUiWrite('style');
      return true;
    }
    return false;
  }

  function setWidth(node, value) {
    if (!node) return false;
    const next = String(value ?? '');
    if (node.style.width !== next) {
      node.style.width = next;
      recordUiWrite('style');
      return true;
    }
    return false;
  }

  function setClassToggle(node, className, enabled) {
    if (!node) return false;
    const next = Boolean(enabled);
    if (node.classList.contains(className) === next) return false;
    node.classList.toggle(className, next);
    recordUiWrite('class');
    return true;
  }

  function setDisabled(node, value) {
    if (!node) return;
    const next = Boolean(value);
    if (node.disabled !== next) {
      node.disabled = next;
      recordUiWrite('attr');
    }
  }



  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function classSigilSpecFor(className) {
    return MAIN_MENU_FLOATING_CLASS_SIGILS.find(spec => spec.className === className) || null;
  }

  function floatingClassIconBoundsForSpec(spec, metrics, radius) {
    const width = Math.max(1, Number(metrics?.width || window.innerWidth || 1280));
    const height = Math.max(1, Number(metrics?.height || window.innerHeight || 720));
    const pad = Math.max(16, Math.min(36, width * 0.012));
    const verticalPad = Math.max(18, Math.min(42, height * 0.018));
    const centerGap = Math.max(radius * 1.45, Math.min(230, width * 0.115));
    const laneEdge = width * 0.5;
    const leftMax = Math.max(radius + pad, laneEdge - centerGap);
    const rightMin = Math.min(width - radius - pad, laneEdge + centerGap);
    const side = spec?.side === 'right' ? 'right' : 'left';
    const bounds = side === 'right'
      ? { minX: Math.max(radius + pad, rightMin), maxX: width - radius - pad }
      : { minX: radius + pad, maxX: Math.min(width - radius - pad, leftMax) };
    if (bounds.maxX < bounds.minX) {
      const fallback = side === 'right' ? width * 0.82 : width * 0.18;
      bounds.minX = bounds.maxX = clamp(fallback, radius + pad, width - radius - pad);
    }
    bounds.minY = radius + verticalPad;
    bounds.maxY = height - radius - verticalPad;
    if (bounds.maxY < bounds.minY) {
      const midY = clamp(height * 0.5, radius + verticalPad, height - radius - verticalPad);
      bounds.minY = bounds.maxY = midY;
    }
    return bounds;
  }

  function hashFloat(seed) {
    const str = String(seed || 'blackroot');
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 100000) / 100000;
  }

  function rectFromElementWithin(container, element, padding = 0) {
    if (!container || !element || !element.getBoundingClientRect) return null;
    const root = container.getBoundingClientRect?.();
    const rect = element.getBoundingClientRect?.();
    if (!root || !rect || !rect.width || !rect.height) return null;
    return {
      id: element.id || element.className || 'element',
      x: rect.left - root.left - padding,
      y: rect.top - root.top - padding,
      w: rect.width + padding * 2,
      h: rect.height + padding * 2,
      padding
    };
  }

  function buildMainMenuProtectedZones(splash, metrics) {
    const width = Number(metrics?.width || splash?.clientWidth || window.innerWidth || 1280);
    const height = Number(metrics?.height || splash?.clientHeight || window.innerHeight || 720);
    const zones = [];

    // The logo is painted by #logoSplash::before, so there is no DOM image rect to query.
    // Keep this viewport-derived safe zone aligned with the CSS logo background owner:
    // center-top, wide enough to include the branches/lettering, and padded for icon glows.
    const logoW = Math.min(width * 0.62, 1120);
    const logoH = Math.min(height * 0.54, 540);
    zones.push({
      id: 'logo',
      x: (width - logoW) * 0.5,
      y: Math.max(0, height * 0.015),
      w: logoW,
      h: logoH,
      padding: Math.max(28, Math.min(72, width * 0.035))
    });

    const actionRow = splash?.querySelector?.('.splashActionRow');
    const buttonZone = rectFromElementWithin(splash, actionRow, Math.max(42, Math.min(86, width * 0.032)));
    if (buttonZone) {
      buttonZone.id = 'menuButtons';
      zones.push(buttonZone);
    } else {
      zones.push({
        id: 'menuButtons',
        x: width * 0.39,
        y: height * 0.55,
        w: width * 0.22,
        h: height * 0.38,
        padding: Math.max(42, Math.min(86, width * 0.032))
      });
    }

    splash?.querySelectorAll?.('[data-main-menu-modal="true"].is-open, .accountMenuPanel.is-open, #splashPatchNotesPanel.is-open, #splashSettingsPanel.is-open')
      ?.forEach((modal, index) => {
        const zone = rectFromElementWithin(splash, modal, 44);
        if (zone) {
          zone.id = `modal-${index}`;
          zones.push(zone);
        }
      });
    return zones;
  }

  function circleOverlapsRect(circle, zone) {
    const closestX = clamp(circle.x, zone.x, zone.x + zone.w);
    const closestY = clamp(circle.y, zone.y, zone.y + zone.h);
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    return (dx * dx + dy * dy) < circle.r * circle.r;
  }

  function resolveCircleAwayFromRect(circle, zone, bounds) {
    if (!circleOverlapsRect(circle, zone)) return false;
    const candidates = [
      { x: zone.x - circle.r, y: circle.y, side: 'left' },
      { x: zone.x + zone.w + circle.r, y: circle.y, side: 'right' },
      { x: circle.x, y: zone.y - circle.r, side: 'top' },
      { x: circle.x, y: zone.y + zone.h + circle.r, side: 'bottom' }
    ].map(candidate => ({
      ...candidate,
      x: clamp(candidate.x, bounds.minX, bounds.maxX),
      y: clamp(candidate.y, bounds.minY, bounds.maxY)
    })).filter(candidate => !circleOverlapsRect({ ...circle, x: candidate.x, y: candidate.y }, zone));

    if (!candidates.length) {
      const centerX = zone.x + zone.w * 0.5;
      const centerY = zone.y + zone.h * 0.5;
      const dx = circle.x - centerX;
      const dy = circle.y - centerY;
      const horizontal = Math.abs(dx / Math.max(1, zone.w)) > Math.abs(dy / Math.max(1, zone.h));
      circle.x = horizontal
        ? clamp(dx < 0 ? zone.x - circle.r : zone.x + zone.w + circle.r, bounds.minX, bounds.maxX)
        : clamp(circle.x, bounds.minX, bounds.maxX);
      circle.y = horizontal
        ? clamp(circle.y, bounds.minY, bounds.maxY)
        : clamp(dy < 0 ? zone.y - circle.r : zone.y + zone.h + circle.r, bounds.minY, bounds.maxY);
      return true;
    }

    candidates.sort((a, b) => {
      const da = (a.x - circle.x) ** 2 + (a.y - circle.y) ** 2;
      const db = (b.x - circle.x) ** 2 + (b.y - circle.y) ** 2;
      return da - db;
    });
    circle.x = candidates[0].x;
    circle.y = candidates[0].y;
    return true;
  }

  function ensureFloatingClassIconState(splash, node, spec, metrics, zones) {
    if (!splash) return null;
    const state = splash._blackrootFloatingClassIconState || (splash._blackrootFloatingClassIconState = { icons: new Map(), lastTime: 0, width: 0, height: 0 });
    const className = spec?.className || node?.dataset?.className || 'Unknown';
    let icon = state.icons.get(className);
    const width = Math.max(1, Number(metrics?.width || splash.clientWidth || window.innerWidth || 1280));
    const height = Math.max(1, Number(metrics?.height || splash.clientHeight || window.innerHeight || 720));
    const size = Math.max(48, Math.round(Number(spec?.size) || 76));
    const radius = Math.max(34, size * 0.52 + 18);
    const changedViewport = !icon || Math.abs((icon.viewportW || width) - width) > 6 || Math.abs((icon.viewportH || height) - height) > 6;
    if (!icon || changedViewport) {
      const seed = hashFloat(className);
      const angle = seed * Math.PI * 2;
      const speed = 10 + seed * 8;
      icon = {
        className,
        x: clamp((Number(spec?.x) || 50) * width / 100, radius + 12, width - radius - 12),
        y: clamp((Number(spec?.y) || 50) * height / 100, radius + 12, height - radius - 12),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        phase: seed * Math.PI * 2,
        size,
        radius,
        viewportW: width,
        viewportH: height
      };
      state.icons.set(className, icon);
    }
    icon.size = size;
    icon.radius = radius;
    state.width = width;
    state.height = height;
    const bounds = floatingClassIconBoundsForSpec(spec, { width, height }, radius);
    for (let i = 0; i < 4; i += 1) {
      for (const zone of zones || []) {
        if (resolveCircleAwayFromRect({ get x() { return icon.x; }, set x(v) { icon.x = v; }, get y() { return icon.y; }, set y(v) { icon.y = v; }, r: radius }, zone, bounds)) {
          const cx = zone.x + zone.w * 0.5;
          const cy = zone.y + zone.h * 0.5;
          if (Math.abs(icon.x - cx) > Math.abs(icon.y - cy)) icon.vx = Math.abs(icon.vx || speed) * (icon.x > cx ? 1 : -1);
          else icon.vy = Math.abs(icon.vy || speed) * (icon.y > cy ? 1 : -1);
        }
      }
      icon.x = clamp(icon.x, bounds.minX, bounds.maxX);
      icon.y = clamp(icon.y, bounds.minY, bounds.maxY);
    }
    return icon;
  }

  function updateFloatingClassIconSafePositions(splash, dt = 0) {
    const layer = splash?.querySelector?.('.blackrootMenuClassSigils');
    if (!splash || !layer) return false;
    const rect = splash.getBoundingClientRect?.() || { width: window.innerWidth || 1280, height: window.innerHeight || 720 };
    const metrics = { width: Math.max(1, rect.width || window.innerWidth || 1280), height: Math.max(1, rect.height || window.innerHeight || 720) };
    const zones = buildMainMenuProtectedZones(splash, metrics);
    const nodes = Array.from(layer.querySelectorAll('[data-main-menu-class-sigil]'));
    const icons = [];

    for (const node of nodes) {
      const spec = classSigilSpecFor(node.dataset.className) || {};
      const icon = ensureFloatingClassIconState(splash, node, spec, metrics, zones);
      if (!icon) continue;
      const speedClamp = Math.max(8, Math.min(34, (Number(spec.duration) || 22) * 0.9));
      icon.phase += Math.max(0, dt) * (0.52 + hashFloat(icon.className) * 0.36);
      icon.vx += Math.cos(icon.phase * 0.74 + hashFloat(`${icon.className}:x`) * 4) * dt * 5.5;
      icon.vy += Math.sin(icon.phase * 0.81 + hashFloat(`${icon.className}:y`) * 4) * dt * 5.5;
      const currentSpeed = Math.hypot(icon.vx, icon.vy) || speedClamp;
      if (currentSpeed > speedClamp) {
        icon.vx = icon.vx / currentSpeed * speedClamp;
        icon.vy = icon.vy / currentSpeed * speedClamp;
      }
      icon.x += icon.vx * dt;
      icon.y += icon.vy * dt;
      const bounds = floatingClassIconBoundsForSpec(spec, metrics, icon.radius);
      if (icon.x <= bounds.minX || icon.x >= bounds.maxX) icon.vx *= -0.92;
      if (icon.y <= bounds.minY || icon.y >= bounds.maxY) icon.vy *= -0.92;
      icon.x = clamp(icon.x, bounds.minX, bounds.maxX);
      icon.y = clamp(icon.y, bounds.minY, bounds.maxY);
      icons.push({ node, spec, icon });
    }

    for (let pass = 0; pass < 3; pass += 1) {
      for (const entry of icons) {
        const bounds = floatingClassIconBoundsForSpec(entry.spec, metrics, entry.icon.radius);
        for (const zone of zones) {
          const beforeX = entry.icon.x;
          const beforeY = entry.icon.y;
          if (resolveCircleAwayFromRect({ get x() { return entry.icon.x; }, set x(v) { entry.icon.x = v; }, get y() { return entry.icon.y; }, set y(v) { entry.icon.y = v; }, r: entry.icon.radius }, zone, bounds)) {
            if (Math.abs(entry.icon.x - beforeX) > 0.5) entry.icon.vx *= -0.76;
            if (Math.abs(entry.icon.y - beforeY) > 0.5) entry.icon.vy *= -0.76;
          }
        }
      }
      for (let i = 0; i < icons.length; i += 1) {
        for (let j = i + 1; j < icons.length; j += 1) {
          const a = icons[i].icon;
          const b = icons[j].icon;
          const minDistance = a.radius + b.radius + 16;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.max(0.001, Math.hypot(dx, dy));
          if (dist >= minDistance) continue;
          const push = (minDistance - dist) * 0.52;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          a.vx -= nx * 2.2;
          a.vy -= ny * 2.2;
          b.vx += nx * 2.2;
          b.vy += ny * 2.2;
        }
      }
      for (const entry of icons) {
        const bounds = floatingClassIconBoundsForSpec(entry.spec, metrics, entry.icon.radius);
        entry.icon.x = clamp(entry.icon.x, bounds.minX, bounds.maxX);
        entry.icon.y = clamp(entry.icon.y, bounds.minY, bounds.maxY);
      }
    }

    for (const { node, spec, icon } of icons) {
      const baseScale = Number(spec.scale) || 1;
      const scale = baseScale + Math.sin(icon.phase) * 0.035;
      const rotA = Number(spec.rot) || 0;
      const rotB = Number(spec.rotTo) || rotA;
      const rot = rotA + (rotB - rotA) * (0.5 + Math.sin(icon.phase * 0.7) * 0.5) * 0.36;
      node.style.left = '0px';
      node.style.top = '0px';
      node.style.marginLeft = '0px';
      node.style.marginTop = '0px';
      node.style.animation = 'none';
      node.style.transformOrigin = 'center center';
      node.style.transform = `translate3d(${Math.round(icon.x - icon.size * 0.5)}px, ${Math.round(icon.y - icon.size * 0.5)}px, 0) scale(${scale.toFixed(3)}) rotate(${rot.toFixed(2)}deg)`;
    }
    return true;
  }

  function syncBlackrootMenuClassSigils(splash) {
    if (!splash) return null;
    let layer = splash.querySelector('.blackrootMenuClassSigils');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'blackrootMenuClassSigils';
      layer.setAttribute('aria-hidden', 'true');
      splash.insertBefore(layer, splash.firstElementChild || null);
    }
    layer.setAttribute('aria-hidden', 'true');
    layer.style.pointerEvents = 'none';
    const activeKeys = new Set();
    for (const spec of MAIN_MENU_FLOATING_CLASS_SIGILS) {
      const meta = classEmblemMeta(spec.className);
      const key = meta.key;
      activeKeys.add(key);
      let node = layer.querySelector(`[data-main-menu-class-sigil="${key}"]`);
      if (!node) {
        node = document.createElement('span');
        node.className = `blackrootMenuClassSigil depth${String(spec.depth || 'mid').replace(/^./, ch => ch.toUpperCase())}`;
        node.dataset.mainMenuClassSigil = key;
        node.dataset.className = spec.className;
        node.setAttribute('aria-hidden', 'true');
        const badge = document.createElement('span');
        badge.className = 'classEmblemBadge blackrootMenuClassSigilIcon';
        node.appendChild(badge);
        layer.appendChild(node);
      }
      node.className = `blackrootMenuClassSigil depth${String(spec.depth || 'mid').replace(/^./, ch => ch.toUpperCase())}`;
      node.style.setProperty('--sigil-x', `${Number(spec.x) || 50}%`);
      node.style.setProperty('--sigil-y', `${Number(spec.y) || 50}%`);
      node.style.setProperty('--sigil-size', `${Math.max(48, Math.round(Number(spec.size) || 76))}px`);
      node.style.setProperty('--sigil-alpha', String(Number(spec.alpha) || .48));
      node.style.setProperty('--sigil-scale', String(Number(spec.scale) || .9));
      node.style.setProperty('--sigil-scale-to', String((Number(spec.scale) || .9) + .115));
      node.style.setProperty('--sigil-dx', `${Number(spec.dx) || 18}px`);
      node.style.setProperty('--sigil-dy', `${Number(spec.dy) || 18}px`);
      node.style.setProperty('--sigil-rotation', `${Number(spec.rot) || 0}deg`);
      node.style.setProperty('--sigil-rotation-to', `${Number(spec.rotTo) || 6}deg`);
      node.style.setProperty('--sigil-duration', `${Math.max(10, Number(spec.duration) || 18)}s`);
      node.style.setProperty('--sigil-delay', `${Number(spec.delay) || 0}s`);
      const badge = node.querySelector('.blackrootMenuClassSigilIcon') || node.querySelector('.classEmblemBadge');
      const badgeSize = Math.max(48, Math.round(Number(spec.size) || 76));
      // V0.16.34: floating menu ambience renders the class emblem itself only;
      // circular orb/ring containers are removed from CSS so this asset remains the visual owner.
      applyClassEmblem(badge, spec.className, { size: badgeSize, title: false });
      badge.style.setProperty('--emblem-image', `url('${classEmblemImagePath(spec.className)}')`);
      badge.style.setProperty('--emblem-sheet', 'none');
      badge.style.backgroundImage = `url('${classEmblemImagePath(spec.className)}')`;
      badge.style.backgroundPosition = 'center';
      badge.style.backgroundSize = 'contain';
      badge.style.backgroundRepeat = 'no-repeat';
      badge.setAttribute('aria-hidden', 'true');
    }
    layer.querySelectorAll('[data-main-menu-class-sigil]').forEach(node => {
      if (!activeKeys.has(node.dataset.mainMenuClassSigil)) node.remove();
    });
    updateFloatingClassIconSafePositions(splash, 0);
    return layer;
  }


  function ensureBlackrootMenuRainCanvas(splash) {
    if (!splash) return null;
    let canvas = splash.querySelector('.blackrootMenuRainCanvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'blackrootMenuRainCanvas';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.tabIndex = -1;
      const classLayer = splash.querySelector('.blackrootMenuClassSigils');
      splash.insertBefore(canvas, classLayer || splash.firstElementChild || null);
    }
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.pointerEvents = 'none';
    return canvas;
  }

  function resizeRainCanvasToSplash(canvas, splash) {
    if (!canvas || !splash) return null;
    const rect = splash.getBoundingClientRect?.() || { width: window.innerWidth || 1280, height: window.innerHeight || 720 };
    const width = Math.max(1, Math.round(Number(rect.width || window.innerWidth || 1280)));
    const height = Math.max(1, Math.round(Number(rect.height || window.innerHeight || 720)));
    const dpr = Math.min(Math.max(Number(window.devicePixelRatio) || 1, 1), 2);
    const backingWidth = Math.max(1, Math.round(width * dpr));
    const backingHeight = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
      canvas.width = backingWidth;
      canvas.height = backingHeight;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    return { width, height, dpr };
  }

  function blackrootMenuRainVisible(splash) {
    if (!splash || document.body.classList.contains('gameStarted')) return false;
    const style = window.getComputedStyle ? window.getComputedStyle(splash) : null;
    return !style || (style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.01);
  }

  DR.UiSystem = {
    install(Game) {
      const ui = DR.ui;

      Game.prototype.mainMenuButtonDefinitions = function() {
        return [
          { id: 'login', elementId: 'splashLoginBtn', label: 'LOGIN' },
          { id: 'createAccount', elementId: 'splashCreateAccountBtn', label: 'CREATE ACCOUNT' },
          { id: 'loadGame', elementId: 'splashLoadGameBtn', label: 'LOAD GAME' },
          { id: 'linkSaveFolder', elementId: 'splashSaveFolderBtn', label: 'LINK SAVE FOLDER' },
          { id: 'patchNotes', elementId: 'splashPatchNotesBtn', label: 'PATCH NOTES' },
          { id: 'settings', elementId: 'splashSettingsBtn', label: 'SETTINGS' },
          { id: 'exitGame', elementId: 'splashExitBtn', label: 'EXIT GAME' }
        ];
      };



      // V0.18.1: render PATCH_NOTES.md (the canonical source) into patch-note entry HTML.
      // Fixes the in-game panels being frozen because they only ever showed a hand-embedded
      // copy that stopped being maintained after V0.17.25.
      Game.prototype.renderPatchNotesMarkdown = function(md) {
        if (!md) return '';
        const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const inline = s => esc(s)
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/`([^`]+)`/g, '<code>$1</code>')
          .replace(/(?<!\*)\*([^*\s][^*]*?)\*(?!\*)/g, '<em>$1</em>');
        const entries = [];
        let cur = null, group = null;
        const newGroup = head => { group = { head: head || null, items: [] }; if (cur) cur.groups.push(group); return group; };
        for (const raw of String(md).split(/\r?\n/)) {
          const line = raw.replace(/\s+$/, '');
          const h2 = line.match(/^##\s+(.*)/);
          if (h2) { cur = { title: h2[1], groups: [] }; entries.push(cur); group = null; newGroup(null); continue; }
          if (!cur) continue;
          const h3 = line.match(/^###\s+(.*)/); // sub-header within the entry (e.g. "Fixed / Updated")
          if (h3) { newGroup(h3[1]); continue; }
          if (!group) newGroup(null);
          const sub = line.match(/^\s+[-*]\s+(.*)/);
          if (sub) { const last = group.items[group.items.length - 1]; if (last) (last.sub = last.sub || []).push(sub[1]); else group.items.push({ text: sub[1] }); continue; }
          const bul = line.match(/^[-*]\s+(.*)/);
          if (bul) { group.items.push({ text: bul[1] }); continue; }
        }
        const renderGroup = g => {
          const lis = g.items.map(it => {
            let li = `<li>${inline(it.text)}`;
            if (it.sub && it.sub.length) li += `<ul>${it.sub.map(s => `<li>${inline(s)}</li>`).join('')}</ul>`;
            return li + '</li>';
          }).join('');
          return (g.head ? `<h5>${inline(g.head)}</h5>` : '') + (lis ? `<ul>${lis}</ul>` : '');
        };
        return entries.map(e => `<section class="patchNoteEntry"><h4>${inline(e.title)}</h4>${e.groups.map(renderGroup).join('')}</section>`).join('');
      };

      // Load the canonical PATCH_NOTES.md once (when served over http[s]) and stamp it into
      // every .patchNotesEntries container. file:// can't fetch, so the (regenerated)
      // embedded copy stays as the fallback.
      Game.prototype.ensurePatchNotesFromSource = function() {
        if (this._patchNotesLoaded || this._patchNotesLoading) return;
        if (!/^https?:$/.test(location.protocol || '')) { this._patchNotesLoaded = true; return; }
        const container = document.querySelector('.patchNotesEntries[data-patch-notes-source]') || document.querySelector('.patchNotesEntries');
        const src = container?.dataset?.patchNotesSource || 'PATCH_NOTES.md';
        this._patchNotesLoading = true;
        fetch(src, { cache: 'no-store' })
          .then(r => (r.ok ? r.text() : Promise.reject(new Error('http ' + r.status))))
          .then(md => {
            const html = this.renderPatchNotesMarkdown?.(md);
            if (html && html.length > 40) {
              for (const c of document.querySelectorAll('.patchNotesEntries')) c.innerHTML = html;
            }
            this._patchNotesLoaded = true;
          })
          .catch(() => { /* keep embedded fallback */ })
          .finally(() => { this._patchNotesLoading = false; });
      };

      Game.prototype.refreshPatchNotesPanels = function() {
        this.ensurePatchNotesFromSource?.();
        const splashPanel = ui.splashPatchNotesPanel || document.getElementById('splashPatchNotesPanel');
        const menuPanel = ui.menuPatchNotesPanel || document.getElementById('menuPatchNotesPanel');
        const splashEntries = splashPanel?.querySelector?.('.patchNotesEntries');
        const menuEntries = menuPanel?.querySelector?.('.patchNotesEntries');
        if (!splashEntries && !menuEntries) return false;
        const canonical = splashEntries || menuEntries;
        for (const panel of [splashPanel, menuPanel]) {
          if (!panel) continue;
          let target = panel.querySelector('.patchNotesEntries');
          if (!target) {
            const oldList = panel.querySelector('ul');
            target = canonical.cloneNode(true);
            if (oldList) oldList.replaceWith(target);
            else panel.appendChild(target);
          } else if (target !== canonical && target.innerHTML !== canonical.innerHTML) {
            target.replaceWith(canonical.cloneNode(true));
          }
        }
        return true;
      };

      Game.prototype.stopBlackrootMainMenuRain = function() {
        const state = this.mainMenuRainState;
        if (!state) return false;
        state.active = false;
        if (state.raf) {
          cancelAnimationFrame(state.raf);
          state.raf = 0;
        }
        if (state.context) {
          state.context.setTransform?.(1, 0, 0, 1, 0, 0);
          state.context.clearRect(0, 0, state.canvas?.width || 0, state.canvas?.height || 0);
        }
        return true;
      };

      Game.prototype.startBlackrootMainMenuRain = function(splash = null) {
        splash = splash || ui.logoSplash || document.getElementById('logoSplash');
        if (!splash) return false;
        const canvas = ensureBlackrootMenuRainCanvas(splash);
        if (!canvas) return false;
        const state = this.mainMenuRainState || (this.mainMenuRainState = { seed: 51152, raf: 0, active: false });
        state.active = true;
        state.splash = splash;
        state.canvas = canvas;
        state.context = canvas.getContext?.('2d') || null;
        if (!state.context || state.raf) return !!state.context;

        const draw = () => {
          if (!state.active || !blackrootMenuRainVisible(state.splash)) {
            state.raf = 0;
            if (state.context && state.canvas) {
              state.context.setTransform?.(1, 0, 0, 1, 0, 0);
              state.context.clearRect(0, 0, state.canvas.width || 0, state.canvas.height || 0);
            }
            return;
          }
          const metrics = resizeRainCanvasToSplash(state.canvas, state.splash);
          const ctx = state.context;
          const nowMs = performance.now();
          const dt = Math.min(0.05, Math.max(0, (nowMs - (state.lastIconUpdateMs || nowMs)) / 1000));
          state.lastIconUpdateMs = nowMs;
          updateFloatingClassIconSafePositions(state.splash, dt || 0.016);
          if (metrics && ctx) {
            const modalOpen = state.splash.classList.contains('blackrootModalOpen');
            ctx.save();
            ctx.setTransform?.(metrics.dpr, 0, 0, metrics.dpr, 0, 0);
            ctx.clearRect(0, 0, metrics.width, metrics.height);
            const now = performance.now() * 0.001;
            DR.Weather?.drawFogLayer?.(ctx, metrics, {
              seed: state.seed + 771,
              now,
              fogDensity: modalOpen ? 0.22 : 0.42,
              regions: [
                { x: 0.50, y: 0.525, width: 0.54, height: 0.145, alpha: modalOpen ? 0.08 : 0.16, drift: 72, lanes: 4 },
                { x: 0.50, y: 0.905, width: 0.88, height: 0.19, alpha: modalOpen ? 0.09 : 0.19, drift: 130, lanes: 5 }
              ]
            });
            DR.Weather?.drawRainLayer?.(ctx, metrics, {
              seed: state.seed,
              now,
              intensity: modalOpen ? 0.38 : 0.66,
              densityScale: modalOpen ? 0.52 : 0.78,
              particleDensity: modalOpen ? 64 : 102,
              backgroundCount: modalOpen ? 36 : 64,
              foregroundCount: modalOpen ? 52 : 102,
              windSpeed: 20,
              fogDensity: 0,
              curtain: false
            });
            ctx.restore();
            ctx.setTransform?.(1, 0, 0, 1, 0, 0);
            ctx.globalAlpha = 1;
            ctx.filter = 'none';
            ctx.globalCompositeOperation = 'source-over';
          }
          state.raf = requestAnimationFrame(draw);
        };

        state.raf = requestAnimationFrame(draw);
        return true;
      };

      Game.prototype.syncBlackrootMainMenu = function() {
        const splash = ui.logoSplash || document.getElementById('logoSplash');
        if (!splash) return false;
        ui.logoSplash = splash;
        splash.dataset.brand = 'blackroot';
        splash.setAttribute('aria-label', 'Blackroot main menu');
        splash.classList.remove('dreamRealmsSplash', 'dream-realms-splash', 'legacySplash');
        document.body.classList.remove('gameStarted');
        document.body.classList.add('blackrootMenuActive');
        splash.style.visibility = 'visible';
        splash.style.opacity = '1';
        syncBlackrootMenuClassSigils(splash);
        this.startBlackrootMainMenuRain?.(splash);
        let modalBackdrop = splash.querySelector('.blackrootMenuModalBackdrop');
        if (!modalBackdrop) {
          modalBackdrop = document.createElement('div');
          modalBackdrop.className = 'blackrootMenuModalBackdrop';
          modalBackdrop.setAttribute('aria-hidden', 'true');
          splash.insertBefore(modalBackdrop, splash.querySelector('.logoSplashCard') || splash.firstElementChild || null);
        }
        modalBackdrop.style.pointerEvents = 'auto';

        // V0.16.30: modal panels are direct splash children so their fixed z-index is
        // above the dim backdrop and central gothic menu card. Keeping them inside the
        // card left them trapped in the card's lower stacking context, which made the
        // backdrop cover/blur the active modal and made inputs feel frozen.
        const modalPanels = ['accountPanel', 'splashSettingsPanel', 'splashPatchNotesPanel']
          .map(id => document.getElementById(id))
          .filter(Boolean);
        for (const panel of modalPanels) {
          panel.dataset.mainMenuModal = 'true';
          if (panel.parentElement !== splash) splash.appendChild(panel);
        }

        // V0.16.32: the menu has one logo owner: the large background hero image.
        // Remove the former foreground boxed logo from the DOM instead of drawing or
        // hiding a duplicate layer above the hero branding.
        const logo = document.getElementById('splashLogo');
        if (logo) logo.remove();

        const prompt = splash.querySelector('.splashPrompt');
        if (prompt) prompt.textContent = 'Welcome, Adventurer';

        const actionRow = splash.querySelector('.splashActionRow');
        if (actionRow) {
          actionRow.dataset.mainMenuLayout = 'blackroot';
          const defs = this.mainMenuButtonDefinitions?.() || [];
          for (const def of defs) {
            let button = document.getElementById(def.elementId);
            if (!button) {
              button = document.createElement('button');
              button.id = def.elementId;
              actionRow.appendChild(button);
            }
            button.type = 'button';
            button.classList.remove('blackrootCircleMenuButton');
            button.classList.add('patchNotesButton', 'blackrootRoundedMenuButton');
            button.dataset.mainMenuAction = def.id;
            button.removeAttribute('data-icon');
            button.textContent = def.label;
            button.setAttribute('aria-label', def.label.replace(/\s+/g, ' ').trim());
          }
        }

        const legacySelectors = [
          '.dreamRealmsLogo', '.dream-realms-logo', '[data-legacy-dream-realms-menu]',
          '#dreamRealmsLogo', '#legacyDreamRealmsLogo', '#legacyLogoSplash'
        ];
        for (const selector of legacySelectors) {
          splash.querySelectorAll(selector).forEach(node => node.remove());
        }
        splash.querySelectorAll('img').forEach(img => {
          const src = String(img.getAttribute('src') || '');
          const alt = String(img.getAttribute('alt') || '');
          if (/dream\s*realms|dream-realms|dream_realms/i.test(`${src} ${alt}`)) img.remove();
        });
        return true;
      };


      Game.prototype.mainMenuModalPanels = function() {
        return [ui.accountPanel, ui.splashPatchNotesPanel, ui.splashSettingsPanel].filter(Boolean);
      };

      Game.prototype.getActiveMainMenuModal = function() {
        const panels = this.mainMenuModalPanels?.() || [];
        return panels.find(panel => panel.classList.contains('is-open') || panel.style.display !== 'none') || null;
      };

      Game.prototype.closeMainMenuModals = function() {
        for (const panel of this.mainMenuModalPanels?.() || []) {
          panel.classList.remove('is-open');
          panel.style.display = 'none';
          panel.setAttribute('aria-hidden', 'true');
        }
        this.updateBlackrootMainMenuModalState?.();
        return true;
      };

      Game.prototype.openMainMenuModal = function(panel, options = {}) {
        const splash = ui.logoSplash || document.getElementById('logoSplash');
        if (!splash || !panel) return false;

        // Create Account/Login are main-menu modals.  They must never inherit the
        // gameplay CSS gate, because body.gameStarted hides #logoSplash by design.
        document.body.classList.remove('gameStarted');
        document.body.classList.add('blackrootMenuActive');
        splash.style.display = 'grid';
        splash.style.visibility = 'visible';
        splash.style.opacity = '1';
        splash.removeAttribute('aria-hidden');
        splash.dataset.activeModal = panel.id || 'modal';

        for (const other of this.mainMenuModalPanels?.() || []) {
          const isActive = other === panel;
          other.classList.toggle('is-open', isActive);
          other.style.display = isActive ? 'block' : 'none';
          other.setAttribute('aria-hidden', isActive ? 'false' : 'true');
        }

        this.updateBlackrootMainMenuModalState?.();
        const focusTarget = options.focusTarget || panel.querySelector('input, button, textarea, select, [tabindex]:not([tabindex="-1"])');
        focusTarget?.focus?.({ preventScroll: true });
        return true;
      };

      Game.prototype.updateBlackrootMainMenuModalState = function() {
        const splash = ui.logoSplash || document.getElementById('logoSplash');
        if (!splash) return false;
        const activeModal = this.getActiveMainMenuModal?.();
        const modalOpen = Boolean(activeModal);
        splash.classList.toggle('blackrootModalOpen', modalOpen);
        splash.dataset.activeModal = modalOpen ? (activeModal.id || 'modal') : '';
        return modalOpen;
      };

      Game.prototype.runMainMenuAction = function(actionId, event = null) {
        const action = String(actionId || '');
        switch (action) {
          case 'login':
            this.showAccountPanel?.('login');
            return true;
          case 'createAccount':
            this.showAccountPanel?.('create');
            return true;
          case 'loadGame':
            this.closeMainMenuModals?.();
            this.loadGameFromSavePicker?.();
            return true;
          case 'linkSaveFolder':
            this.closeMainMenuModals?.();
            this.chooseCharacterSaveFolder?.();
            return true;
          case 'patchNotes': {
            this.refreshPatchNotesPanels?.();
            const panel = ui.splashPatchNotesPanel;
            if (!panel) return false;
            const isOpen = panel.classList.contains('is-open') || panel.style.display !== 'none';
            if (isOpen) this.closeMainMenuModals?.();
            else this.openMainMenuModal?.(panel, { focusTarget: panel.querySelector('button, a, [tabindex]:not([tabindex="-1"])') });
            return true;
          }
          case 'settings': {
            const panel = ui.splashSettingsPanel;
            if (!panel) return false;
            const isOpen = panel.classList.contains('is-open') || panel.style.display !== 'none';
            if (isOpen) this.closeMainMenuModals?.();
            else this.openMainMenuModal?.(panel, { focusTarget: panel.querySelector('button, input, select, [tabindex]:not([tabindex="-1"])') });
            return true;
          }
          case 'fullscreen':
            this.toggleFullscreen?.();
            return true;
          case 'closeModal':
            this.closeMainMenuModals?.();
            return true;
          case 'exitGame':
            this.closeMainMenuModals?.();
            this.exitGame?.();
            return true;
          default:
            return false;
        }
      };

      Game.prototype.handleMainMenuClick = function(event) {
        const splash = ui.logoSplash || document.getElementById('logoSplash');
        if (!splash || splash.style.display === 'none') return false;
        if (event?.__blackrootMainMenuHandled) return false;

        const target = event?.target;
        const activeModal = this.getActiveMainMenuModal?.();

        if (activeModal) {
          if (!activeModal.contains(target)) {
            event.__blackrootMainMenuHandled = true;
            event?.preventDefault?.();
            event?.stopPropagation?.();
            event?.stopImmediatePropagation?.();
            return true;
          }
          const modalActionButton = target?.closest?.('[data-main-menu-action]');
          if (!modalActionButton || !activeModal.contains(modalActionButton)) return false;
          event.__blackrootMainMenuHandled = true;
          event.preventDefault?.();
          event.stopPropagation?.();
          event.stopImmediatePropagation?.();
          return this.runMainMenuAction?.(modalActionButton.dataset.mainMenuAction, event) === true;
        }

        const button = target?.closest?.('[data-main-menu-action]');
        if (!button || !splash.contains(button)) return false;

        event.__blackrootMainMenuHandled = true;
        event.preventDefault?.();
        event.stopPropagation?.();
        event.stopImmediatePropagation?.();
        return this.runMainMenuAction?.(button.dataset.mainMenuAction, event) === true;
      };

      Game.prototype.bindMainMenuActions = function() {
        const splash = ui.logoSplash || document.getElementById('logoSplash');
        if (!splash) return false;
        this.syncBlackrootMainMenu?.();
        if (splash.__blackrootMainMenuActionsBound) return true;
        splash.__blackrootMainMenuActionsBound = true;
        splash.addEventListener('click', event => this.handleMainMenuClick?.(event), true);
        splash.addEventListener('pointerdown', event => {
          const activeModal = this.getActiveMainMenuModal?.();
          const button = event.target?.closest?.('[data-main-menu-action]');
          if (!button || !splash.contains(button)) return;
          if (activeModal && !activeModal.contains(button)) return;
          event.stopPropagation?.();
        }, true);
        splash.addEventListener('keydown', event => {
          const activeModal = this.getActiveMainMenuModal?.();
          const button = event.target?.closest?.('[data-main-menu-action]');
          if (!button || !splash.contains(button)) return;
          if (activeModal && !activeModal.contains(button)) return;
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          event.stopPropagation?.();
          this.runMainMenuAction?.(button.dataset.mainMenuAction, event);
        }, true);
        return true;
      };

      Game.prototype.getCharacterCreationData = function() {
        const selectedClass = this.selectedClass || Object.keys(CLASSES)[0] || 'Fighter';
        const raceId = DR.normalizeRaceId?.(this.selectedRace) || 'human';
        const fallbackName = selectedClass;
        return {
          raceId,
          racePaletteId: DR.normalizeRacePaletteId?.(raceId, this.selectedRacePaletteId),
          className: selectedClass,
          name: String(ui.charNameInput?.value || fallbackName).trim().slice(0, 18) || fallbackName,
          gender: ui.genderSelect?.value || 'male',
          hairStyle: DR.Hairstyles?.normalize?.(raceId, ui.hairSelect?.value) || ui.hairSelect?.value || 'short',
          hairColor: ui.hairColorInput?.value || '#4b3628',
          eyeColor: ui.eyeColorInput?.value || '#8ec9ff',
          faceStyle: ui.faceSelect?.value || 'balanced',
          skinTone: ui.skinSelect?.value || '#d8a87e',
          clothesPrimary: ui.clothesPrimaryInput?.value || (CLASSES[selectedClass]?.color || '#5f8550'),
          clothesSecondary: ui.clothesSecondaryInput?.value || '#9a7b51'
        };
      };

      Game.prototype.getRaceDefinition = function(raceId) { return DR.getRaceDefinition?.(raceId) || DR.RACES?.human; };
      Game.prototype.getSelectedRaceDefinition = function() { return this.getRaceDefinition(this.selectedRace); };
      Game.prototype.getDefaultRaceAppearance = function(raceId, className = this.selectedClass || 'Fighter') {
        const race=this.getRaceDefinition(raceId),base=this.getDefaultClassPreviewAppearance(className),palette=race?.palettes?.[race?.defaultPaletteId]||{};
        return {...base,raceId:race?.id||'human',racePaletteId:race?.defaultPaletteId,skinTone:palette.skin||palette.fur||base.skinTone,eyeColor:palette.accent||base.eyeColor};
      };

      Game.prototype.getDefaultClassPreviewAppearance = function(className) {
        const cls = CLASSES[className] || CLASSES.Fighter || {};
        return {
          className,
          name: className || 'Adventurer',
          gender: 'Male',
          hairStyle: DR.Hairstyles?.defaults?.human || 'human_short',
          hairColor: className === 'Necromancer' ? '#16161c' : className === 'Enchanter' ? '#3a2450' : '#4b3628',
          eyeColor: className === 'Necromancer' ? '#9fff6d' : className === 'Enchanter' ? '#d58df0' : className === 'Druid' ? '#6fbf73' : '#8ec9ff',
          faceStyle: className === 'Fighter' ? 'stern' : className === 'Rogue' ? 'sharp' : className === 'Cleric' ? 'soft' : 'balanced',
          skinTone: '#d8a87e',
          clothesPrimary: cls.color || '#5f8550',
          clothesSecondary: className === 'Cleric' ? '#f3df87' : className === 'Bard' ? '#d8a65e' : '#9a7b51'
        };
      };

      Game.prototype.getClassPreviewRenderer = function(className) {
        const render = window.DreamRealms?.render || {};
        const key = String(className || '').toLowerCase();
        if (key === 'bard') return render.BardProceduralModel || window.BardProceduralModel;
        if (key === 'druid') return render.DruidProceduralModel || window.DruidProceduralModel;
        return render.ClassIdentityProceduralModel || window.ClassIdentityProceduralModel;
      };

      Game.prototype.getCreatorPreviewPetProfile = function(className) {
        const key = String(className || '').toLowerCase();
        if (key === 'necromancer') {
          return {
            name: 'Bone Servant',
            petType: 'undead',
            visualModel: 'necroBoneServant',
            label: 'Bone Servant'
          };
        }
        if (key === 'summoner') {
          return {
            name: 'Azure Shard Familiar',
            petType: 'arcane',
            visualModel: 'summonerFloatingShard',
            label: 'Azure Shard Familiar'
          };
        }
        return null;
      };

      Game.prototype.renderClassPreviewModel = function(canvas, className, appearance = {}, options = {}) {
        if (!canvas) return false;
        const ctx = canvas.getContext?.('2d');
        if (!ctx) return false;
        const cssW = Number(options.width || canvas.clientWidth || canvas.width || 120);
        const cssH = Number(options.height || canvas.clientHeight || canvas.height || 150);
        const dpr = Math.max(1, Math.min(2, Number(window.devicePixelRatio || 1)));
        const pixelW = Math.max(1, Math.round(cssW * dpr));
        const pixelH = Math.max(1, Math.round(cssH * dpr));
        if (canvas.width !== pixelW) canvas.width = pixelW;
        if (canvas.height !== pixelH) canvas.height = pixelH;
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cssW, cssH);
        ctx.imageSmoothingEnabled = false;

        if (options.creatorBackdrop === true) {
          drawCreatorClassEmblemBackdrop(ctx, className, cssW, cssH, options, this);
          ctx.imageSmoothingEnabled = false;
        }

        const raceId=DR.normalizeRaceId?.(appearance.raceId)||'human';
        const spriteModel=window.DreamRealms?.render?.RaceSpriteSheetRenderer;
        const raceModel=window.DreamRealms?.render?.RaceIdentityProceduralModel;
        const previewProbe={...appearance,raceId,kind:'preview',action:options.action||'idle',alive:true};
        const model = spriteModel?.canDraw?.(previewProbe) ? spriteModel : raceModel?.canDraw?.({raceId}) ? raceModel : this.getClassPreviewRenderer?.(className);
        if (!model?.draw) return false;
        const cls = CLASSES[className] || CLASSES.Fighter || {};
        const petProfile = options.showPetPreview === true ? this.getCreatorPreviewPetProfile?.(className) : null;
        const hasPetPreview = !!petProfile;
        const groundY = cssH * (options.groundRatio || 0.78);
        const playerX = cssW * (hasPetPreview ? (cssW < 560 ? 0.40 : 0.43) : 0.5);
        const actor = {
          id: 900000 + Math.abs(String(className || '').split('').reduce((acc, ch) => ((acc * 31) + ch.charCodeAt(0)) | 0, 7)),
          name: appearance.name || className,
          className,
          raceId,
          racePaletteId:DR.normalizeRacePaletteId?.(raceId,appearance.racePaletteId),
          playerClass: className,
          classId: className,
          kind: 'preview',
          previewMode: options.previewMode === true,
          previewWidth: cssW,
          previewHeight: cssH,
          alive: true,
          level: 1,
          screenX: playerX,
          screenY: groundY,
          facingName: options.facingName || 'south',
          facingX: 0,
          facingY: 1,
          isMoving: false,
          action: options.action || 'idle',
          moveBlend: 0,
          attackAnim: 0,
          spellCastAnim: 0,
          hitAnim: 0,
          gender: appearance.gender || 'Male',
          hairStyle: appearance.hairStyle || 'short',
          hairColor: appearance.hairColor || '#4b3628',
          eyeColor: appearance.eyeColor || '#8ec9ff',
          faceStyle: appearance.faceStyle || 'balanced',
          skinTone: appearance.skinTone || '#d8a87e',
          clothesPrimary: appearance.clothesPrimary || cls.color || '#5f8550',
          clothesSecondary: appearance.clothesSecondary || '#9a7b51',
          palette: { eye: appearance.eyeColor || '#8ec9ff' }
        };
        ctx.save();
        try {
          if (options.clipToPreview !== false) {
            ctx.beginPath();
            ctx.rect(0, 0, cssW, cssH);
            ctx.clip();
          }

          const nowMs = performance.now();
          const scale = model === spriteModel ? 1 : Number(options.scale || 1);

          if (hasPetPreview) {
            const petModel = window.DreamRealms?.render?.PetIdentityProceduralModel || window.PetIdentityProceduralModel;
            const petScaleBase = Number(options.petScale || (scale * (petProfile.petType === 'undead' ? 0.42 : 0.38)));
            const petScale = Math.max(1.05, Math.min(2.25, Number.isFinite(petScaleBase) ? petScaleBase : 1.45));
            const petActor = {
              id: actor.id + 177,
              name: petProfile.name,
              petName: petProfile.name,
              petType: petProfile.petType,
              visualModel: petProfile.visualModel,
              className,
              ownerClassName: className,
              kind: 'pet',
              previewMode: true,
              alive: true,
              level: 1,
              screenX: Math.max(cssW * 0.58, Math.min(cssW - 86, cssW * (cssW < 560 ? 0.73 : 0.70))),
              screenY: groundY + (petProfile.petType === 'undead' ? 4 : 10),
              facingName: options.facingName || 'south',
              facingX: 0,
              facingY: 1,
              isMoving: false,
              action: 'idle',
              moveBlend: 0,
              attackAnim: 0,
              hitAnim: 0,
              deathProgress: 0,
              summonFx: 0
            };
            if (petModel?.draw && (!petModel.canDraw || petModel.canDraw(petActor))) {
              ctx.save();
              try {
                ctx.translate(petActor.screenX, petActor.screenY);
                ctx.scale(petScale, petScale);
                ctx.translate(-petActor.screenX, -petActor.screenY);
                petModel.draw(ctx, petActor, nowMs);
              } finally {
                ctx.restore();
              }
            }
          }

          ctx.save();
          try {
            if (scale !== 1) {
              ctx.translate(actor.screenX, actor.screenY);
              ctx.scale(scale, scale);
              ctx.translate(-actor.screenX, -actor.screenY);
            }
            model.draw(ctx, actor, nowMs);
          } finally {
            ctx.restore();
          }
        } catch (err) {
          console.warn('[CharacterCreator] class preview render failed', className, err);
          return false;
        } finally {
          ctx.restore();
        }
        return true;
      };

      Game.prototype.renderRaceClassPreview = function(canvas,raceId,className,appearance={},options={}) {
        return this.renderClassPreviewModel(canvas,className,{...appearance,raceId},options);
      };

      Game.prototype.renderCreatorPreviewCanvas = function() {
        const canvas = ui.creatorPreview?.querySelector?.('[data-creator-model-preview]');
        if (!canvas) return false;
        const data=this.getCharacterCreationData();
        const stage=ui.creatorPreview;
        const viewport=ui.creatorPreview?.querySelector?.('.creatorModelViewport') || stage;
        const width=Math.max(320,Number(viewport?.clientWidth)||Number(stage?.clientWidth)||640);
        const height=Math.max(260,Number(viewport?.clientHeight)||Number(stage?.clientHeight)||520);
        const isBogling=data.raceId==='bogling';

        /*
          V0.15.95 creator framing:
          The previous pass made the model smaller but left the feet below the
          visible canvas because the ground anchor was too low. Use a deliberate
          full-body fit: large enough to read, but with the feet anchored above
          the help/name strip instead of at the canvas edge.
        */
        const hasPreviewPet = !!this.getCreatorPreviewPetProfile?.(data.className);
        const widthFit = isBogling ? 142 : (hasPreviewPet ? 228 : 142);
        const heightFit = isBogling ? 78 : 88;
        const scaleBase = Math.min(width / widthFit, height / heightFit);
        const scale=isBogling
          ? Math.min(6.15,Math.max(3.9,scaleBase))
          : (hasPreviewPet ? Math.min(6.35,Math.max(3.9,scaleBase)) : Math.min(6.85,Math.max(4.25,scaleBase)));
        // V0.16.43: the full-layout creator gives the model a dominant showcase
        // panel. Anchor close to the stage floor and scale from the live preview
        // rectangle so large screens do not leave a thumbnail-sized character.
        const groundRatio=isBogling ? .83 : .86;

        return this.renderRaceClassPreview(canvas,data.raceId,data.className,data,{
          width,
          height,
          scale,
          groundRatio,
          previewMode:true,
          centerModel:true,
          showGroundShadow:true,
          facingName:'south',
          creatorBackdrop:true,
          backdropAlpha:.72,
          backdropGlowAlpha:.24,
          showPetPreview:hasPreviewPet,
          clipToPreview:true
        });
      };

      Game.prototype.renderClassCardPreviewCanvases = function() {
        if (!ui.classGrid) return;
        ui.classGrid.querySelectorAll('canvas[data-class-preview]').forEach(canvas => {
          const className = canvas.getAttribute('data-class-preview') || 'Fighter';
          const appearance = className === this.selectedClass ? this.getCharacterCreationData() : this.getDefaultClassPreviewAppearance(className);
          this.renderRaceClassPreview(canvas,this.selectedRace||'human',className,{...appearance,raceId:this.selectedRace||'human',racePaletteId:this.selectedRacePaletteId},{ width:72,height:86,scale:.63,groundRatio:.82 });
        });
      };

      Game.prototype.renderRaceCardPreviewCanvases = function() {
        if(!ui.raceGrid)return; ui.raceGrid.querySelectorAll('canvas[data-race-preview]').forEach(canvas=>{const id=canvas.dataset.racePreview;this.renderRaceClassPreview(canvas,id,this.selectedClass||'Fighter',this.getDefaultRaceAppearance(id),{width:48,height:54,scale:.46,groundRatio:.84});});
      };

      Game.prototype.renderRaceDetails = function() {
        const race=this.getSelectedRaceDefinition(); if(!race||!ui.raceDetailPanel)return;
        const cls=CLASSES[this.selectedClass]||CLASSES.Fighter||{};
        const characterName=String(ui.charNameInput?.value||this.selectedClass||'Adventurer').trim().slice(0,18)||'Adventurer';
        ui.raceDetailPanel.innerHTML=`<p><strong>${escapeHtml(characterName)}</strong> · ${escapeHtml(race.name)} ${escapeHtml(this.selectedClass)} · ${escapeHtml(cls.role||'Adventurer')}</p>`;
        // Heritage Palette is no longer a visible control (V0.16.15), but the underlying
        // palette id still has to stay valid for the current race internally - it backs the
        // Bogling skin-swatch palette system and is part of the saved character data model.
        this.selectedRacePaletteId = DR.normalizeRacePaletteId?.(race.id, this.selectedRacePaletteId) || race.defaultPaletteId;
      };

      Game.prototype.renderRaceCards = function() {
        if(!ui.raceGrid)return;
        const races=Object.values(DR.RACES||{}),selected=this.getSelectedRaceDefinition();
        const sigils={human:'♜',elf:'❧',bogling:'≈',ratkin:'♢'};
        ui.raceGrid.innerHTML=`<select aria-label="Race">${races.map(r=>`<option value="${escapeHtml(r.id)}"${r.id===this.selectedRace?' selected':''}>${escapeHtml(r.name)}</option>`).join('')}</select><div class="cc-race-current"><span class="cc-race-sigil">${sigils[selected?.id]||'◆'}</span><span>${escapeHtml(selected?.description||'')}</span></div>`;
        ui.raceGrid.querySelector('select')?.addEventListener('change',event=>{const race=this.getRaceDefinition(event.target.value);this.selectedRace=race.id;this.selectedRacePaletteId=race.defaultPaletteId;this.renderRaceCards();this.renderRaceDetails();this.renderCreatorSummary();});
      };

      Game.prototype.renderCreatorAppearanceControls = function() {
        const makeButton=(label,selected,attrs='')=>`<button type="button" class="${selected?'selected ':''}${attrs.includes('data-gender')?'cc-gender-button':'cc-hair-thumb'}" ${attrs}>${escapeHtml(label)}</button>`;
        if(ui.ccGenderGrid)ui.ccGenderGrid.innerHTML=['Male','Female'].map(value=>makeButton(value,ui.genderSelect?.value===value,`data-gender="${value}"`)).join('');
        const raceId=DR.normalizeRaceId?.(this.selectedRace)||'human',catalog=DR.Hairstyles?.stylesFor?.(raceId)||[];
        const normalized=DR.Hairstyles?.normalize?.(raceId,ui.hairSelect?.value)||catalog[0]?.id||'short';
        if(ui.hairSelect&&catalog.length){ui.hairSelect.innerHTML=catalog.map(style=>`<option value="${escapeHtml(style.id)}">${escapeHtml(style.name)}</option>`).join('');ui.hairSelect.value=normalized;}
        const active=Math.max(0,catalog.findIndex(style=>style.id===normalized));
        const visible=Array.from({length:4},(_,i)=>catalog[(active+i-1+catalog.length)%catalog.length]).filter(Boolean);
        if(ui.ccHairSelector){
          ui.ccHairSelector.innerHTML=`<button type="button" class="cc-hair-arrow" data-hair-step="-1" aria-label="Previous hairstyle">‹</button>${visible.map(style=>`<button type="button" class="cc-hair-thumb${style.id===normalized?' selected':''}" data-hair="${escapeHtml(style.id)}" title="${escapeHtml(style.name)}"><canvas width="52" height="52" aria-hidden="true"></canvas><span>${escapeHtml(style.name)}</span></button>`).join('')}<button type="button" class="cc-hair-arrow" data-hair-step="1" aria-label="Next hairstyle">›</button><div class="cc-hair-label">${escapeHtml(DR.Hairstyles?.definition?.(raceId,normalized)?.name||normalized)}</div>`;
          ui.ccHairSelector.querySelectorAll('[data-hair]').forEach(button=>DR.Hairstyles?.drawThumbnail?.(button.querySelector('canvas')?.getContext?.('2d'),raceId,button.dataset.hair,ui.hairColorInput?.value));
        }
        const hairColors=Object.keys(HAIR_COLOR_LABELS),eyeColors=Object.keys(EYE_LABELS),skinColorEls=Array.from(ui.skinSelect?.options||[]),skinColors=skinColorEls.map(o=>o.value);
        if(ui.ccHairColors)ui.ccHairColors.innerHTML=hairColors.map(color=>`<button type="button" class="cc-swatch${ui.hairColorInput?.value.toLowerCase()===color?' selected':''}" data-hair-color="${color}" style="--swatch:${color}" title="${escapeHtml(HAIR_COLOR_LABELS[color])}"></button>`).join('');
        if(ui.ccEyeColors)ui.ccEyeColors.innerHTML=eyeColors.map(color=>`<button type="button" class="cc-swatch${ui.eyeColorInput?.value.toLowerCase()===color?' selected':''}" data-eye="${color}" style="--swatch:${color}" title="${escapeHtml(EYE_LABELS[color])}"></button>`).join('');
        if(ui.ccSkinColors){
          if(raceId==='bogling'){
            const palettes=Object.entries(this.getRaceDefinition('bogling')?.palettes||{}),active=DR.normalizeRacePaletteId?.('bogling',this.selectedRacePaletteId);
            ui.ccSkinColors.innerHTML=palettes.map(([id,palette])=>`<button type="button" class="cc-swatch skin${active===id?' selected':''}" data-race-palette="${escapeHtml(id)}" style="--swatch:${escapeHtml(palette.skinMain||palette.skin)}" title="${escapeHtml(palette.name||id)}"></button>`).join('');
          }else ui.ccSkinColors.innerHTML=skinColorEls.map(o=>`<button type="button" class="cc-swatch skin${ui.skinSelect?.value.toLowerCase()===o.value?' selected':''}" data-skin="${o.value}" style="--swatch:${o.value}" title="${escapeHtml(o.text||'Skin')}"></button>`).join('');
        }
      };

      Game.prototype.renderCreatorSummary = function() {
        const data = this.getCharacterCreationData();
        const cls = CLASSES[data.className] || CLASSES.Fighter || {};
        const race = this.getRaceDefinition(data.raceId) || DR.RACES?.human || { name: 'Human', palettes: {} };
        const recommendedClasses = Array.isArray(race.recommendedClasses) ? race.recommendedClasses : [];
        const recommended = recommendedClasses.includes(data.className);
        const hairLabel = DR.Hairstyles?.definition?.(data.raceId, data.hairStyle)?.name || HAIR_LABELS[data.hairStyle] || data.hairStyle || 'Short';
        const faceLabel = FACE_LABELS[data.faceStyle] || data.faceStyle || 'Balanced';
        const eyeKey = String(data.eyeColor || '').toLowerCase();
        const eyeLabel = EYE_LABELS[eyeKey] || data.eyeColor || 'Default';
        const skinKey = String(data.skinTone || '').toLowerCase();
        const skinOption = Array.from(ui.skinSelect?.options || []).find(option => String(option.value || '').toLowerCase() === skinKey);
        const skinLabel = skinOption?.text || race.palettes?.[data.racePaletteId]?.name || data.skinTone || 'Default';
        const petProfile = this.getCreatorPreviewPetProfile?.(data.className);
        if (ui.creatorPreview) {
          ui.creatorPreview.innerHTML = `
            <div class="creatorModelViewport" data-preview-class="${escapeHtml(data.className)}" data-preview-has-pet="${petProfile ? 'true' : 'false'}">
              <div class="creatorClassEmblemBackdrop" aria-hidden="true">
                <img class="creatorBackdropEmblemImage" src="${escapeHtml(classEmblemImagePath(data.className))}" alt="" loading="eager" decoding="async">
              </div>
              <canvas class="creatorModelCanvas" data-creator-model-preview aria-label="Selected character model preview"></canvas>
              <div class="creatorModelPlate">${escapeHtml(race.name)} ${escapeHtml(data.className)}${petProfile ? ' + Pet' : ''}</div>
            </div>
          `;
          this.renderCreatorPreviewCanvas?.();
        }
        this.renderCreatorAppearanceControls?.();
        if (!ui.creatorSummary) return;
        ui.creatorSummary.innerHTML = [
          `<strong>${escapeHtml(data.name)}</strong> · ${escapeHtml(race.name)} ${escapeHtml(data.className)} · ${escapeHtml(data.gender)}`,
          `Role: ${escapeHtml(cls?.role||'Adventurer')} · Palette: ${escapeHtml(race.palettes?.[data.racePaletteId]?.name||data.racePaletteId)} · Race abilities retired${recommended?'':' · ⚠ Class is not race-recommended'}`,
          `${escapeHtml(faceLabel)} face · ${escapeHtml(hairLabel)} hair · ${escapeHtml(eyeLabel)} eyes`,
          `Skin: ${escapeHtml(skinLabel)}${petProfile ? ` · Companion: ${escapeHtml(petProfile.label)}` : ''}`
        ].map(line => `<div>${line}</div>`).join('');
        this.renderClassCardPreviewCanvases?.();
      };

      Game.prototype.renderLogTab = function() {
        const active = this.activeLogTab || 'System';
        const entries = this.logEntries?.[active] || [];
        if (ui.logMeta) ui.logMeta.textContent = `${active} feed`;
        if (ui.logTabs) {
          ui.logTabs.forEach(btn => btn.classList.toggle('active', btn.dataset.logTab === active));
        }
        if (!ui.logBody) return;
        ui.logBody.innerHTML = entries.map(entry => (
          `<div class="logLine"><span class="logTime">${escapeHtml(entry.time)}</span>${escapeHtml(entry.message)}</div>`
        )).join('') || `<div class="logLine small">No ${escapeHtml(active.toLowerCase())} messages yet.</div>`;
        ui.logBody.scrollTop = ui.logBody.scrollHeight;
      };

      Game.prototype.switchLogTab = function(tab) {
        this.activeLogTab = ['System', 'Combat', 'Chat', 'Party'].includes(tab) ? tab : 'System';
        this.renderLogTab();
      };

      Game.prototype.log = function(message, category = 'System') {
        const map = { system: 'System', combat: 'Combat', chat: 'Chat', party: 'Party' };
        const normalized = map[String(category || 'System').toLowerCase()] || 'System';
        const stamp = new Date();
        const time = `${String(stamp.getHours()).padStart(2, '0')}:${String(stamp.getMinutes()).padStart(2, '0')}`;
        this.logEntries = this.logEntries || { System: [], Combat: [], Chat: [], Party: [] };
        this.logEntries[normalized].push({ message: String(message), time, category: normalized });
        this.logEntries[normalized] = this.logEntries[normalized].slice(-64);
        this.logLines.push(message);
        this.logLines = this.logLines.slice(-10);
        if (normalized === this.activeLogTab || !this.activeLogTab) this.renderLogTab();
      };

      Game.prototype.logCombat = function(message) { this.log(message, 'Combat'); };
      Game.prototype.logParty = function(message) { this.log(message, 'Party'); };
      Game.prototype.logChat = function(message) { this.log(message, 'Chat'); };


      Game.prototype.actorResourceType = function(actorOrClass = null) {
        const actor = actorOrClass && typeof actorOrClass === 'object' ? actorOrClass : null;
        const rawClass = String(
          typeof actorOrClass === 'string'
            ? actorOrClass
            : (actor?.className || actor?.entity?.className || actor?.roleClass || actor?.displayTypeLabel || actor?.botTypeLabel || actor?.roleLabel || actor?.roleKey || '')
        ).toLowerCase();
        const resource = String(actor?.resourceName || actor?.entity?.resourceName || '').toLowerCase();
        if (resource === 'stamina' || rawClass.includes('fighter')) return 'stamina';
        if (resource === 'focus' || rawClass.includes('assassin') || rawClass.includes('ranger')) return 'focus';
        if (resource === 'energy' || rawClass.includes('rogue')) return 'energy';
        return 'mana';
      };

      Game.prototype.actorResourceLabel = function(actorOrClass = null) {
        const type = this.actorResourceType?.(actorOrClass) || 'mana';
        if (type === 'stamina') return 'Stamina';
        if (type === 'focus') return 'Focus';
        if (type === 'energy') return 'Energy';
        return 'Mana';
      };

      Game.prototype.actorResourceBarKind = function(actorOrClass = null) {
        const type = this.actorResourceType?.(actorOrClass) || 'mana';
        return type === 'mana' ? 'mp' : type;
      };

      Game.prototype.applyResourceBarType = function(barNode, fillNode, actorOrClass = null) {
        if (!barNode && !fillNode) return 'mana';
        const type = this.actorResourceType?.(actorOrClass) || 'mana';
        const fillClass = type === 'mana' ? 'mp' : type;
        const barClasses = ['resourceMana', 'resourceStamina', 'resourceFocus', 'resourceEnergy'];
        const fillClasses = ['mp', 'stamina', 'focus', 'energy'];
        const wantedBar = `resource${type.charAt(0).toUpperCase()}${type.slice(1)}`;
        if (barNode) {
          for (const cls of barClasses) setClassToggle(barNode, cls, cls === wantedBar);
        }
        if (fillNode) {
          for (const cls of fillClasses) setClassToggle(fillNode, cls, cls === fillClass);
        }
        return type;
      };


      Game.prototype.ensureCombatLevelUpPopup = function() {
        let overlay = document.getElementById('combatLevelUpPopup');
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.id = 'combatLevelUpPopup';
        overlay.setAttribute('aria-live', 'polite');
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML = `
          <div class="combatLevelUpPanel" data-combat-level-up-panel>
            <div class="combatLevelUpCorner tl" aria-hidden="true"></div>
            <div class="combatLevelUpCorner tr" aria-hidden="true"></div>
            <div class="combatLevelUpCorner bl" aria-hidden="true"></div>
            <div class="combatLevelUpCorner br" aria-hidden="true"></div>
            <div class="combatLevelUpSparkles" aria-hidden="true">
              ${Array.from({ length: 10 }, (_, i) => `<i style="--sparkle-i:${i};--sparkle-x:${10 + ((i * 23) % 80)}%;--sparkle-y:${12 + ((i * 37) % 72)}%;--sparkle-delay:${(i % 5) * -0.45}s"></i>`).join('')}
            </div>
            <div class="combatLevelUpEmblem" aria-hidden="true">✦</div>
            <div class="combatLevelUpTitle">LEVEL UP!</div>
            <div class="combatLevelUpNumber" data-combat-level-up-number>1</div>
            <div class="combatLevelUpSubtitle" data-combat-level-up-subtitle>Combat Level 1</div>
            <div class="combatLevelUpDetail" data-combat-level-up-detail>Current Level: 1</div>
            <div class="combatLevelUpFadeText">Fades after 3s</div>
            <div class="combatLevelUpCountdown" aria-hidden="true"><span data-combat-level-up-progress></span></div>
          </div>`;
        document.body.appendChild(overlay);
        return overlay;
      };

      Game.prototype.showCombatLevelUpPopup = function(level) {
        const resolvedLevel = Math.max(1, Math.floor(Number(level) || Number(this.player?.level) || 1));
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        this.combatLevelUpPopup = {
          active: true,
          level: resolvedLevel,
          startedAt: now,
          durationMs: 3000,
          fadeOutMs: 600
        };
        const overlay = this.ensureCombatLevelUpPopup?.();
        if (!overlay) return;
        overlay.style.display = 'grid';
        overlay.setAttribute('aria-hidden', 'false');
        const number = overlay.querySelector('[data-combat-level-up-number]');
        const subtitle = overlay.querySelector('[data-combat-level-up-subtitle]');
        const detail = overlay.querySelector('[data-combat-level-up-detail]');
        if (number) number.textContent = String(resolvedLevel);
        if (subtitle) subtitle.textContent = `Combat Level ${resolvedLevel}`;
        if (detail) detail.textContent = `Current Level: ${resolvedLevel}`;
        this.renderCombatLevelUpPopup?.();
      };

      Game.prototype.hideCombatLevelUpPopup = function() {
        if (this.combatLevelUpPopup) this.combatLevelUpPopup.active = false;
        const overlay = document.getElementById('combatLevelUpPopup');
        if (!overlay) return;
        overlay.style.display = 'none';
        overlay.setAttribute('aria-hidden', 'true');
      };

      Game.prototype.updateCombatLevelUpPopup = function(_deltaMs = 0) {
        const popup = this.combatLevelUpPopup;
        if (!popup?.active) return false;
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const elapsed = Math.max(0, now - Number(popup.startedAt || now));
        popup.elapsedMs = elapsed;
        if (elapsed >= Number(popup.durationMs || 3000)) {
          this.hideCombatLevelUpPopup?.();
          return false;
        }
        this.renderCombatLevelUpPopup?.();
        return true;
      };

      Game.prototype.renderCombatLevelUpPopup = function() {
        const popup = this.combatLevelUpPopup;
        if (!popup?.active) return false;
        const overlay = this.ensureCombatLevelUpPopup?.();
        if (!overlay) return false;
        const panel = overlay.querySelector('[data-combat-level-up-panel]');
        const progressNode = overlay.querySelector('[data-combat-level-up-progress]');
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const duration = Math.max(1, Number(popup.durationMs || 3000));
        const fadeInMs = 250;
        const fadeOutMs = Math.max(1, Number(popup.fadeOutMs || 600));
        const elapsed = Math.max(0, Number(popup.elapsedMs ?? (now - Number(popup.startedAt || now))));
        const remaining = Math.max(0, duration - elapsed);
        const fadeInAlpha = Math.min(1, elapsed / fadeInMs);
        const fadeOutAlpha = elapsed > duration - fadeOutMs ? Math.max(0, remaining / fadeOutMs) : 1;
        const alpha = Math.max(0, Math.min(1, fadeInAlpha * fadeOutAlpha));
        const scale = 0.92 + 0.08 * Math.min(1, elapsed / fadeInMs);
        const progress = Math.max(0, Math.min(1, remaining / duration));
        overlay.style.opacity = alpha.toFixed(3);
        overlay.style.display = 'grid';
        if (panel) panel.style.transform = `scale(${scale.toFixed(3)})`;
        if (progressNode) progressNode.style.transform = `scaleX(${progress.toFixed(4)})`;
        return true;
      };



      Game.prototype.showAccountPanel = function(mode = 'login') {
        this.accountMenuMode = mode === 'create' ? 'create' : 'login';
        if (ui.accountModeTitle) ui.accountModeTitle.textContent = this.accountMenuMode === 'create' ? 'Create Account' : 'Login';
        if (ui.accountSubmitBtn) ui.accountSubmitBtn.textContent = this.accountMenuMode === 'create' ? 'Create Account' : 'Login';
        if (ui.accountMessage) ui.accountMessage.textContent = this.accountMenuMode === 'create'
          ? 'Create a local offline account. Character slots are bound to this account and stored in the account save document.'
          : "Login to a local offline account to access only that account\'s character slots.";
        this.openMainMenuModal?.(ui.accountPanel, { focusTarget: ui.accountNameInput });
      };

      Game.prototype.hideAccountPanel = function() {
        if (ui.accountPanel) {
          ui.accountPanel.classList.remove('is-open');
          ui.accountPanel.style.display = 'none';
          ui.accountPanel.setAttribute('aria-hidden', 'true');
        }
        this.updateBlackrootMainMenuModalState?.();
      };

      Game.prototype.submitAccountPanel = function() {
        const name = ui.accountNameInput?.value || '';
        const password = ui.accountPasswordInput?.value || '';
        const result = this.accountMenuMode === 'create'
          ? this.createLocalAccount?.(name, password)
          : this.loginLocalAccount?.(name, password);
        if (!result?.ok) {
          if (ui.accountMessage) ui.accountMessage.textContent = result?.error || 'Account action failed.';
          this.playSfx?.('ui_error', { volume: 0.28, cooldown: 0.1 });
          return false;
        }
        if (ui.accountPasswordInput) ui.accountPasswordInput.value = '';
        this.hideAccountPanel();
        this.updateBlackrootMainMenuModalState?.();
        this.closeLogoSplash?.();
        this.playSfx?.('ui_select', { volume: 0.32, cooldown: 0.1 });
        return true;
      };

      Game.prototype.enterGameplayDisplayMode = function(reason = 'gameplay') {
        const splash = ui.logoSplash || document.getElementById('logoSplash');
        const panels = [ui.accountPanel, ui.splashPatchNotesPanel, ui.splashSettingsPanel, ui.classScreen, ui.characterSlotScreen].filter(Boolean);
        for (const panel of panels) panel.style.display = 'none';
        if (splash) {
          splash.style.display = 'none';
          splash.classList.remove('blackrootModalOpen');
          splash.setAttribute('aria-hidden', 'true');
        }
        document.body.classList.remove('blackrootMenuActive');
        document.body.classList.add('gameStarted');
        const gameCanvas = document.getElementById('game');
        if (gameCanvas) {
          gameCanvas.style.display = 'block';
          gameCanvas.style.visibility = 'visible';
          gameCanvas.style.opacity = '1';
          gameCanvas.style.filter = 'none';
          gameCanvas.style.pointerEvents = 'auto';
          gameCanvas.removeAttribute('aria-hidden');
        }
        const c = window.DreamRealms?.runtime?.ctx;
        if (c) {
          c.globalAlpha = 1;
          c.globalCompositeOperation = 'source-over';
          try { c.filter = 'none'; } catch (_err) {}
        }
        this.updateBlackrootMainMenuModalState?.();
        return true;
      };

      Game.prototype.showCharacterSlotsScreen = function() {
        if (ui.logoSplash) ui.logoSplash.style.display = 'none';
        if (ui.classScreen) ui.classScreen.style.display = 'none';
        if (ui.characterSlotScreen) ui.characterSlotScreen.style.display = 'flex';
        this.renderCharacterSlots?.();
        this.startCharacterSlotPreviewAnimation?.();
      };

      Game.prototype.hideCharacterSlotsScreen = function() {
        if (ui.characterSlotScreen) ui.characterSlotScreen.style.display = 'none';
        this.stopCharacterSlotPreviewAnimation?.();
      };

      // V0.16.40: Character Select redesign - one large "featured" slot showcase
      // (big live model + class-themed backdrop + name/meta + Play/New/Delete or
      // Create) instead of four equal plain cards. A slim switcher strip below lets
      // the player pick which of the (up to 4) slots is featured; all existing
      // slot/account/save behavior (load/create/replace/delete, Load Game, Link Save
      // Folder, Account Menu, Close) is unchanged - only the presentation and which
      // DOM nodes host it changed. this.featuredCharacterSlotIndex persists which
      // slot is currently featured across re-renders.
      Game.prototype.renderCharacterSlots = function() {
        if (!ui.characterSlotGrid || !ui.characterSlotFeatured) return;
        const account = this.getActiveAccount?.();
        if (!account) {
          ui.characterSlotFeatured.innerHTML = '<div class="small">Login or create an account first.</div>';
          ui.characterSlotGrid.innerHTML = '';
          if (ui.characterSlotAccountMeta) ui.characterSlotAccountMeta.textContent = 'No account selected.';
          return;
        }
        const slots = this.getCharacterSlots?.() || [];
        if (ui.characterSlotAccountMeta) ui.characterSlotAccountMeta.textContent = `Account: ${escapeHtml(account.username)} · ${slots.filter(Boolean).length}/4 slots used`;

        let featured = Number.isInteger(this.featuredCharacterSlotIndex) ? this.featuredCharacterSlotIndex : -1;
        if (featured < 0 || featured >= slots.length) {
          const firstOccupied = slots.findIndex(slot => slot?.payload);
          featured = firstOccupied >= 0 ? firstOccupied : 0;
        }
        this.featuredCharacterSlotIndex = featured;

        ui.characterSlotGrid.innerHTML = slots.map((slot, index) => {
          const isFeatured = index === featured;
          const summary = slot?.payload ? (slot.summary || {}) : null;
          const emblem = summary ? `<img src="${escapeHtml(classEmblemImagePath(summary.className || 'Fighter'))}" alt="" loading="eager" decoding="async">` : '<span class="characterSlotTileEmptyMark">+</span>';
          const label = summary ? escapeHtml(summary.name || 'Adventurer') : 'Empty';
          const sub = summary ? `Slot ${index + 1} · Lv ${escapeHtml(summary.level || 1)}` : `Slot ${index + 1}`;
          return `
            <button type="button" class="characterSlotTile${isFeatured ? ' featured' : ''}${summary ? '' : ' empty'}" data-slot-select="${index}" aria-pressed="${isFeatured ? 'true' : 'false'}">
              <span class="characterSlotTileEmblem">${emblem}</span>
              <span class="characterSlotTileLabel">${label}</span>
              <span class="characterSlotTileSub">${sub}</span>
            </button>`;
        }).join('');

        const featuredSlot = slots[featured];
        if (!featuredSlot?.payload) {
          ui.characterSlotFeatured.innerHTML = `
            <div class="characterSlotFeaturedStage characterSlotFeaturedStage--empty">
              <div class="characterSlotEmptySigil">✦</div>
            </div>
            <div class="characterSlotFeaturedInfo">
              <div class="characterSlotFeaturedName">Slot ${featured + 1}: Empty</div>
              <div class="characterSlotFeaturedMeta">Create a new character in this account slot.</div>
            </div>
            <div class="characterSlotFeaturedActions">
              <button type="button" data-slot-action="create" data-slot-index="${featured}">Create Character</button>
            </div>`;
          return;
        }
        const summary = featuredSlot.summary || {};
        const saved = summary.savedAt || featuredSlot.updatedAt || featuredSlot.createdAt || '';
        const hairLabel = DR.Hairstyles?.definition?.(summary.raceId, summary.hairStyle)?.name || HAIR_LABELS[summary.hairStyle] || summary.hairStyle || 'Short';
        const faceLabel = FACE_LABELS[summary.faceStyle] || summary.faceStyle || 'Balanced';
        ui.characterSlotFeatured.innerHTML = `
          <div class="characterSlotFeaturedStage">
            <canvas class="characterSlotFeaturedCanvas" data-featured-slot-preview aria-label="${escapeHtml(summary.name || 'Adventurer')} preview"></canvas>
          </div>
          <div class="characterSlotFeaturedInfo">
            <div class="characterSlotFeaturedName">${escapeHtml(summary.name || 'Adventurer')}</div>
            <div class="characterSlotFeaturedMeta">Slot ${featured + 1} · Level ${escapeHtml(summary.level || 1)} ${escapeHtml(summary.raceName || 'Human')} ${escapeHtml(summary.className || 'Fighter')} · ${escapeHtml(summary.gender || '')}<br>${escapeHtml(faceLabel)} face · ${escapeHtml(hairLabel)} hair · Saved ${escapeHtml(saved ? new Date(saved).toLocaleString?.() || saved : 'unknown')}</div>
          </div>
          <div class="characterSlotFeaturedActions">
            <button type="button" data-slot-action="load" data-slot-index="${featured}">Play</button>
            <button type="button" data-slot-action="replace" data-slot-index="${featured}">New</button>
            <button type="button" data-slot-action="delete" data-slot-index="${featured}">Delete</button>
          </div>`;
        this.renderFeaturedCharacterSlotPreview?.();
      };

      // Draws only the featured-slot canvas (no innerHTML rebuild) so the idle
      // animation loop can call this every frame without re-creating the DOM/canvas
      // each tick. Reuses the same renderRaceClassPreview/renderClassPreviewModel
      // path the character creator and class gallery already use, with
      // creatorBackdrop:true so the class's existing full illustrated background art
      // (assets/ui/class-backgrounds/*.png, already shipped but not used anywhere
      // else in the live UI) shows as the "large themed background motif" behind the
      // model - no second preview system, no static/fake image.
      Game.prototype.renderFeaturedCharacterSlotPreview = function() {
        const canvas = ui.characterSlotFeatured?.querySelector?.('[data-featured-slot-preview]');
        if (!canvas) return false;
        const slots = this.getCharacterSlots?.() || [];
        const summary = slots[this.featuredCharacterSlotIndex]?.summary;
        if (!summary) return false;
        const host = canvas.parentElement;
        const width = Math.max(240, Math.round(host?.clientWidth || 360));
        const height = Math.max(240, Math.round(host?.clientHeight || 420));
        return this.renderRaceClassPreview?.(canvas, summary.raceId || 'human', summary.className || 'Fighter', summary, {
          width,
          height,
          scale: 3.15,
          groundRatio: 0.86,
          previewMode: true,
          centerModel: true,
          facingName: 'south',
          creatorBackdrop: true,
          backdropAlpha: 0.72
        });
      };

      // Mirrors startCreatorPreviewAnimation/stopCreatorPreviewAnimation exactly -
      // self-terminating idle-animation loop, reusing the same render call every
      // frame rather than a second timer/loop system.
      Game.prototype.startCharacterSlotPreviewAnimation = function() {
        if (this._characterSlotPreviewAnimating) return;
        this._characterSlotPreviewAnimating = true;
        const step = () => {
          if (!this._characterSlotPreviewAnimating || !ui.characterSlotScreen || ui.characterSlotScreen.style.display === 'none') {
            this._characterSlotPreviewAnimating = false;
            this._characterSlotPreviewAnimationHandle = null;
            return;
          }
          this.renderFeaturedCharacterSlotPreview?.();
          this._characterSlotPreviewAnimationHandle = requestAnimationFrame(step);
        };
        this._characterSlotPreviewAnimationHandle = requestAnimationFrame(step);
      };

      Game.prototype.stopCharacterSlotPreviewAnimation = function() {
        this._characterSlotPreviewAnimating = false;
        if (this._characterSlotPreviewAnimationHandle) {
          cancelAnimationFrame(this._characterSlotPreviewAnimationHandle);
          this._characterSlotPreviewAnimationHandle = null;
        }
      };

      Game.prototype.beginCharacterCreationForSlot = function(slotIndex) {
        const index = Math.max(0, Math.min(3, Math.floor(Number(slotIndex) || 0)));
        this.pendingCharacterSlotIndex = index;
        this.activeCharacterSlotIndex = index;
        this.hideCharacterSlotsScreen?.();
        if (ui.classScreen) ui.classScreen.style.display = 'flex';
        if (ui.enterRealmBtn) ui.enterRealmBtn.textContent = `Create Character in Slot ${index + 1}`;
        this.renderCreatorSummary?.();
        this.startCreatorPreviewAnimation?.();
      };

      // V0.16.15: lightweight idle-animation loop for the character creation preview. This
      // reuses the existing renderCreatorPreviewCanvas render path exactly as-is (no second
      // model, no duplicate renderer) - the model draw already derives breathing/sway/etc from
      // the timestamp it's given (see Anim.buildPose), so simply calling that same render
      // function every frame while the creation screen is open is enough to animate it. The
      // loop is self-terminating: it checks the screen's own visibility each frame and stops
      // itself the moment the screen is hidden, so leaving character creation by any path
      // (Back, Create Character, or otherwise) can never leak a running loop.
      Game.prototype.startCreatorPreviewAnimation = function() {
        if (this._creatorPreviewAnimating) return;
        this._creatorPreviewAnimating = true;
        const step = () => {
          if (!this._creatorPreviewAnimating || !ui.classScreen || ui.classScreen.style.display === 'none') {
            this._creatorPreviewAnimating = false;
            this._creatorPreviewAnimationHandle = null;
            return;
          }
          this.renderCreatorPreviewCanvas?.();
          this._creatorPreviewAnimationHandle = requestAnimationFrame(step);
        };
        this._creatorPreviewAnimationHandle = requestAnimationFrame(step);
      };

      Game.prototype.stopCreatorPreviewAnimation = function() {
        this._creatorPreviewAnimating = false;
        if (this._creatorPreviewAnimationHandle) {
          cancelAnimationFrame(this._creatorPreviewAnimationHandle);
          this._creatorPreviewAnimationHandle = null;
        }
      };

      Game.prototype.initUI = function() {
        this.selectedRace = DR.normalizeRaceId?.(this.selectedRace) || 'human';
        this.selectedClass = this.selectedClass || Object.keys(CLASSES)[0] || 'Fighter';
        this.loadAccountsState?.();
        this.syncBlackrootMainMenu?.();
        this.bindMainMenuActions?.();

        const renderClassGallery = () => {
          ui.classGrid.innerHTML = '';
          const classOrder = ['Assassin','Bard','Cleric','Druid','Enchanter','Fighter','Necromancer','Paladin','Ranger','Rogue','Shaman','Summoner','Warden','Wizard'];
          const availableClasses = classOrder.filter(className => CLASSES[className]);
          ui.classGrid.style.setProperty('--class-gallery-count', String(Math.max(1, availableClasses.length)));
          for (const name of availableClasses) {
            const c = CLASSES[name];
            const selected = this.selectedClass === name;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `classIconOption${selected ? ' selected' : ''}`;
            button.dataset.classOption = name;
            button.style.setProperty('--class-accent', c.color || '#d8ae43');
            button.setAttribute('aria-pressed', selected ? 'true' : 'false');
            button.title = `${name} - ${c.role || 'Adventurer'}`;
            button.innerHTML = `
              <span class="cc-class-icon-halo" aria-hidden="true">
                <img class="cc-class-gallery-emblem" src="${escapeHtml(classEmblemImagePath(name))}" alt="" loading="eager" decoding="async" draggable="false">
              </span>
              <span class="cc-class-label">
                <span class="cc-class-name">${escapeHtml(name)}</span>
                <span class="cc-class-role">${escapeHtml(c.role || 'Adventurer')}</span>
              </span>
            `;
            const selectClass = () => {
              this.selectedClass = name;
              if (ui.clothesPrimaryInput && (!ui.clothesPrimaryInput.dataset.touched || ui.clothesPrimaryInput.dataset.autofill === '1')) {
                ui.clothesPrimaryInput.value = c.color || '#5f8550';
                ui.clothesPrimaryInput.dataset.autofill = '1';
              }
              renderClassGallery();
              this.renderRaceDetails();
              this.renderCreatorSummary();
            };
            button.addEventListener('click', selectClass);
            button.addEventListener('dblclick', () => {
              selectClass();
              ui.enterRealmBtn?.click();
            });
            ui.classGrid.appendChild(button);
          }
        };

        this.renderRaceCards();
        this.renderRaceDetails();
        renderClassGallery();
        this.renderCreatorSummary();
        this.renderClassCardPreviewCanvases?.();
        const refreshCreator=()=>{this.renderRaceDetails();this.renderCreatorSummary();};
        ui.ccGenderGrid?.addEventListener('click',event=>{const button=event.target.closest('[data-gender]');if(!button)return;ui.genderSelect.value=button.dataset.gender;refreshCreator();});
        ui.ccHairSelector?.addEventListener('click',event=>{const hair=event.target.closest('[data-hair]'),step=event.target.closest('[data-hair-step]');if(hair)ui.hairSelect.value=hair.dataset.hair;if(step){const options=Array.from(ui.hairSelect.options),index=Math.max(0,options.findIndex(o=>o.value===ui.hairSelect.value));ui.hairSelect.value=options[(index+Number(step.dataset.hairStep)+options.length)%options.length].value;}refreshCreator();});
        ui.ccHairColors?.addEventListener('click',event=>{const button=event.target.closest('[data-hair-color]');if(!button)return;ui.hairColorInput.value=button.dataset.hairColor;refreshCreator();});
        ui.ccEyeColors?.addEventListener('click',event=>{const button=event.target.closest('[data-eye]');if(!button)return;ui.eyeColorInput.value=button.dataset.eye;refreshCreator();});
        ui.ccSkinColors?.addEventListener('click',event=>{const button=event.target.closest('[data-skin],[data-race-palette]');if(!button)return;if(button.dataset.racePalette){this.selectedRacePaletteId=button.dataset.racePalette;}else ui.skinSelect.value=button.dataset.skin;refreshCreator();});
        ui.ccRandomizeBtn?.addEventListener('click',()=>{
          // Appearance + gender only. Race and class are the player's deliberate choices from
          // the left/right panels and must never be overwritten by a looks reroll - see
          // randomizeCharacterAppearanceOnly in the V0.16.15 character creation revamp notes.
          const pick=items=>items[Math.floor(Math.random()*items.length)];
          const raceId=DR.normalizeRaceId?.(this.selectedRace)||'human';
          ui.genderSelect.value=pick(['Male','Female']);
          const hairCatalog=DR.Hairstyles?.stylesFor?.(raceId)||[];
          const hairStyleIds=hairCatalog.length?hairCatalog.map(style=>style.id):Array.from(ui.hairSelect.options).map(o=>o.value);
          ui.hairSelect.value=pick(hairStyleIds)||ui.hairSelect.value;
          ui.hairColorInput.value=pick(Object.keys(HAIR_COLOR_LABELS));
          ui.eyeColorInput.value=pick(Object.keys(EYE_LABELS));
          if(raceId==='bogling'){
            const paletteIds=Object.keys(this.getRaceDefinition('bogling')?.palettes||{});
            if(paletteIds.length)this.selectedRacePaletteId=pick(paletteIds);
          }else{
            ui.skinSelect.value=pick(Array.from(ui.skinSelect.options).map(o=>o.value));
          }
          this.renderRaceDetails();this.renderCreatorSummary();
        });
        ui.ccBackBtn?.addEventListener('click',()=>{if(ui.classScreen)ui.classScreen.style.display='none';this.pendingCharacterSlotIndex=null;this.showCharacterSlotsScreen?.();});
        [ui.charNameInput, ui.genderSelect, ui.hairSelect, ui.hairColorInput, ui.eyeColorInput, ui.faceSelect, ui.skinSelect, ui.clothesPrimaryInput, ui.clothesSecondaryInput].forEach(el => {
          if (!el) return;
          el.addEventListener('input', () => {
            if (el === ui.clothesPrimaryInput || el === ui.clothesSecondaryInput) el.dataset.touched = '1';
            if (el === ui.charNameInput) this.renderRaceDetails();
            this.renderCreatorSummary();
          });
          el.addEventListener('change', () => this.renderCreatorSummary());
        });
        ui.enterRealmBtn?.addEventListener('click', () => {
          const data = this.getCharacterCreationData();
          if (this.activeAccountId == null) {
            this.showAccountPanel?.('login');
            if (ui.logoSplash) ui.logoSplash.style.display = 'grid';
            if (ui.classScreen) ui.classScreen.style.display = 'none';
            return;
          }
          if (!Number.isInteger(this.pendingCharacterSlotIndex)) this.pendingCharacterSlotIndex = Number.isInteger(this.activeCharacterSlotIndex) ? this.activeCharacterSlotIndex : 0;
          this.start(data.className, data);
          this.saveCharacterState?.({ manual: true, silent: true });
          this.log?.(`Created ${data.name} in slot ${(this.activeCharacterSlotIndex ?? 0) + 1}.`);
        });



        // Splash actions are delegated through bindMainMenuActions so the visible
        // Blackroot buttons and their click routing share one canonical source.
        this.bindMainMenuActions?.();
        ui.accountSubmitBtn?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.(); this.submitAccountPanel?.(); });
        ui.accountCancelBtn?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.(); this.hideAccountPanel?.(); });
        [ui.accountNameInput, ui.accountPasswordInput].forEach(input => input?.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); this.submitAccountPanel?.(); }
        }));
        ui.backToAccountBtn?.addEventListener('click', () => {
          this.logoutLocalAccount?.();
          if (ui.characterSlotScreen) ui.characterSlotScreen.style.display = 'none';
          if (ui.logoSplash) ui.logoSplash.style.display = 'grid';
          this.showAccountPanel?.('login');
        });
        ui.closeCharacterSlotsBtn?.addEventListener('click', () => {
          if (ui.characterSlotScreen) ui.characterSlotScreen.style.display = 'none';
          if (ui.logoSplash) ui.logoSplash.style.display = 'grid';
        });
        ui.characterSlotGrid?.addEventListener('click', e => {
          const tile = e.target.closest('button[data-slot-select]');
          if (!tile) return;
          const index = Math.max(0, Math.min(3, Math.floor(Number(tile.dataset.slotSelect) || 0)));
          this.featuredCharacterSlotIndex = index;
          this.renderCharacterSlots?.();
        });
        ui.characterSlotFeatured?.addEventListener('click', e => {
          const btn = e.target.closest('button[data-slot-action]');
          if (!btn) return;
          const action = btn.dataset.slotAction;
          const index = Math.max(0, Math.min(3, Math.floor(Number(btn.dataset.slotIndex) || 0)));
          if (action === 'load') this.loadCharacterSlot?.(index);
          else if (action === 'create') this.beginCharacterCreationForSlot?.(index);
          else if (action === 'replace') this.beginCharacterCreationForSlot?.(index);
          else if (action === 'delete') {
            this.deleteCharacterSlot?.(index);
            this.renderCharacterSlots?.();
          }
        });

        ui.mercOptions.innerHTML = '<div class="small">Hire contracts from the camp Mercenary Recruiter. Debug hotkey H still quick-hires/dismisses a Field Cleric.</div>';

        this.installExternalSystems();

        ui.logTabs?.forEach(btn => btn.addEventListener('click', () => this.switchLogTab(btn.dataset.logTab)));
        ui.chatSendBtn?.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          this.submitChatInput?.();
        });
        ui.chatInput?.addEventListener('keydown', e => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            this.submitChatInput?.();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            ui.chatInput.blur?.();
          }
        });
        ui.dismissMercBtn?.addEventListener('click', () => this.dismissMerc());
        ui.mercInvitePartyBtn?.addEventListener('click', () => this.inviteMercToParty?.());
        ui.closeMapBtn?.addEventListener('click', () => this.toggleMap(false));
        ui.closeBagBtn?.addEventListener('click', () => this.toggleBag(false));
        ui.closeBankBtn?.addEventListener('click', () => this.toggleBank?.(false));
        // Phase 10 (Intersect parity): trade window controls.
        ui.closeTradeBtn?.addEventListener('click', () => this.cancelTrade?.('closed'));
        ui.tradeConfirmBtn?.addEventListener('click', () => this.confirmTradeOffer?.());
        ui.closeSkillsBtn?.addEventListener('click', () => this.toggleSkillsPanel?.(false));
        ui.menuToggleBtn?.addEventListener('click', () => { this.ensureMenuButtonOwnership?.(); this.toggleMenu(); });
        ui.closeMenuBtn?.addEventListener('click', () => this.toggleMenu(false));
        this.ensureMenuButtonOwnership?.();
        ui.menuCharacterBtn?.addEventListener('click', () => { this.toggleMenu(false); this.toggleCharacterPanel(true); });
        ui.menuBagsBtn?.addEventListener('click', () => { this.toggleMenu(false); this.toggleBag(true); });
        ui.menuSkillsBtn?.addEventListener('click', () => { this.toggleMenu(false); this.toggleSkillsPanel?.(true); });
        ui.menuSpellsBtn?.addEventListener('click', () => { this.toggleMenu(false); this.toggleSpellPanel(true); });
        ui.menuSettingsBtn?.addEventListener('click', () => { this.toggleMenu(false); this.toggleSettingsPanel(true); });
        ui.menuLogoutBtn?.addEventListener('click', () => this.logoutToCharacterCreation());
        ui.menuExitBtn?.addEventListener('click', () => this.exitGame());
        ui.closeCharacterBtn?.addEventListener('click', () => this.toggleCharacterPanel(false));
        ui.closeSpellBtn?.addEventListener('click', () => this.toggleSpellPanel(false));
        ui.closeSettingsBtn?.addEventListener('click', () => this.toggleSettingsPanel(false));

        this.switchLogTab('System');
        this.togglePartyPanel(false);
        if (ui.classScreen) ui.classScreen.style.display = 'none';
        if (ui.characterSlotScreen) ui.characterSlotScreen.style.display = 'none';
        if (ui.mercPanel) ui.mercPanel.style.display = 'none';
        if (ui.partyHud) ui.partyHud.style.display = 'none';
        if (ui.unifiedCompanionHud) ui.unifiedCompanionHud.style.display = 'none';
        if (ui.menuPanel) ui.menuPanel.style.display = 'none';
        if (ui.characterPanel) ui.characterPanel.style.display = 'none';
        if (ui.spellPanel) ui.spellPanel.style.display = 'none';
        if (ui.settingsPanel) ui.settingsPanel.style.display = 'none';
        this.applyUiPreferences?.();
        this.installMovableUiWindows?.();
      };

      // Single authoritative gate for leaving the splash screen. Every caller (login
      // submit, save-folder import, gamepad/keyboard "confirm") routes through here, and
      // it can only ever land on the login panel or character selection - never directly
      // into gameplay - so there is no path that skips authentication or character choice.
      Game.prototype.closeLogoSplash = function() {
        if (!ui.logoSplash || ui.logoSplash.style.display === 'none') return;
        if (!this.activeAccountId) {
          this.showAccountPanel?.('login');
          return;
        }
        ui.logoSplash.style.display = 'none';
        this.showCharacterSlotsScreen?.();
        this.log('Welcome to Blackroot. Login, select a character slot, and enter Dark Woods.');
      };

      Game.prototype.describePlayerHudStatus = function() {
        const p = this.player;
        if (!p) return 'Idle';
        if (p.alive === false || Number(p.hp || 0) <= 0) return 'Downed';
        if (this.actorIsMeditating?.(p)) return 'Meditating';
        if (p.gathering || this.resourceGatheringSystem?.active) {
          const kind = String(p.gatheringKind || this.resourceGatheringSystem?.active?.category || '').toLowerCase();
          if (kind === 'mining') return 'Mining';
          if (kind === 'fishing') return 'Fishing';
          return 'Gathering';
        }
        if (p.fishing) return String(p.fishingAction || '').toLowerCase() === 'reeling' ? 'Fishing' : 'Fishing';
        const combat = Boolean(this.isEntityInCombat?.(p) || p.autoAttack || Number(p.combatCooldown || 0) > 0 || this.getOffensiveTarget?.());
        if (combat) return 'Fighting';
        const action = String(p.action || '').toLowerCase();
        if (action === 'cast' || action === 'casting') return 'Casting';
        if (p.isMoving || p.moving || Math.hypot(Number(p.vx || 0), Number(p.vy || 0)) > 0.01) return 'Moving';
        return 'Idle';
      };

      Game.prototype.initUiFrameMetrics = function() {
        const stats = this.perfStats || (this.perfStats = {});
        stats.uiFastUpdates = 0;
        stats.uiFullUpdates = 0;
        stats.uiSkippedUpdates = 0;
        stats.uiDomWrites = 0;
        stats.uiTextWrites = 0;
        stats.uiHtmlWrites = 0;
        stats.uiStyleWrites = 0;
        stats.uiClassWrites = 0;
        stats.uiUpdateMs = 0;
        stats.uiFastMs = 0;
        stats.uiFullMs = 0;
        stats.uiCompanionResourceUpdates = 0;
      };

      Game.prototype.markUiDirty = function(reason = 'general') {
        this.uiDirty = true;
        const set = this._uiDirtyReasons || (this._uiDirtyReasons = new Set());
        set.add(String(reason || 'general'));
      };

      Game.prototype.uiPerformanceConfig = function() {
        const root = window.DreamRealms?.CONFIG || {};
        const perf = this.performanceSettings?.() || root.PERFORMANCE || {};
        return {
          fastCombatInterval: Math.max(0.033, Number(perf.uiFastCombatInterval || root.UI_UPDATE_INTERVAL || 0.10)),
          fastIdleInterval: Math.max(0.075, Number(perf.uiFastIdleInterval || root.UI_IDLE_UPDATE_INTERVAL || 0.20)),
          fullCombatInterval: Math.max(0.18, Number(perf.uiFullCombatInterval || 0.45)),
          fullIdleInterval: Math.max(0.25, Number(perf.uiFullIdleInterval || 0.85)),
          panelInterval: Math.max(0.20, Number(perf.uiPanelInterval || 0.65)),
          debugOverlayInterval: Math.max(0.10, Number(perf.debugOverlayInterval || 0.25))
        };
      };

      Game.prototype.ensurePlayerHudClassVisuals = function(force = false) {
        if (!this.player || !ui.hud) return false;
        const className = this.player.className || 'Fighter';
        const spec = DR.classBackgroundVisualSpec?.(className);
        const key = `${spec?.key || className || 'fighter'}:${className || ''}`;
        const backdrop = ui.hud.querySelector?.('.hudClassBackdrop');
        const backdropImg = backdrop?.querySelector?.('.playerHudClassBackdropImage');
        const backdropNeedsSync = !backdropImg || backdropImg.getAttribute('src') !== spec?.backgroundPath || backdrop?.dataset.classBackgroundKey !== spec?.key;
        if (!force && ui.hud.dataset.playerHudClassVisualKey === key && !backdropNeedsSync) return false;
        ui.hud.dataset.playerHudClassVisualKey = key;
        applyClassHudVisualStyle(ui.hud, className);
        if (backdrop && spec) ensurePlayerHudBackdropImage(backdrop, spec);
        applyClassEmblem(ui.hudPortraitIcon, className, { size: 84, extraClass: 'hudClassEmblem', title: `${className} emblem` });
        return true;
      };

      Game.prototype.updateCoreHudFast = function() {
        if (!this.player) return false;
        this.ensureGameplayHudChrome?.('fast');
        this.ensurePlayerHudClassVisuals?.();
        const p = this.player;
        const target = this.getTarget?.();
        document.body.classList.toggle('gameStarted', Boolean(this.started && p));
        setWidth(ui.hpFill, pct(p.hp, p.maxHp));
        setWidth(ui.mpFill, pct(p.mana, p.maxMana || 1));
        this.applyResourceBarType?.(ui.mpFill?.closest?.('.bar'), ui.mpFill, p);
        setWidth(ui.xpFill, pct(p.xp, p.nextXp));
        setHudBarText(ui.hpText, 'HP', `${Math.ceil(p.hp)}/${Math.ceil(p.maxHp)}`);
        setHudBarText(ui.mpText, this.actorResourceLabel?.(p) || this.spellResourceLabel?.(p.className) || 'Mana', `${Math.ceil(p.mana)}/${Math.ceil(p.maxMana || 0)}`);
        setHudBarText(ui.xpText, 'Exp', `${Math.floor(p.xp)}/${Math.floor(p.nextXp)}`);
        if (target) {
          setDisplay(ui.targetBox, 'block');
          setText(ui.targetName, target.name);
          setWidth(ui.targetHpFill, pct(target.hp, target.maxHp));
          setHudBarText(ui.targetHpText, 'HP', `${Math.ceil(target.hp)}/${Math.ceil(target.maxHp)}`);
          const targetKey = `${target.id || target.name || ''}:${target.level || 0}:${target.baseType?.threatTag || ''}`;
          if (ui.targetMeta && ui.targetMeta.dataset.fastTargetKey !== targetKey) {
            ui.targetMeta.dataset.fastTargetKey = targetKey;
            const questInfo = this.questSystem?.getQuestTargetInfoForEnemy?.(target);
            const threat = target.baseType?.threatTag ? ` · ${target.baseType.threatTag}` : '';
            const threatLeader = this.describeThreatLeader?.(target) || '';
            setText(ui.targetMeta, questInfo
              ? `Level ${target.level}${threat} · Quest Target · ${questInfo.progress}/${questInfo.required}${threatLeader}`
              : `Level ${target.level}${threat}${threatLeader}`);
          }
        } else {
          setDisplay(ui.targetBox, 'none');
          if (ui.targetMeta) ui.targetMeta.dataset.fastTargetKey = '';
        }
        if (this.merc) {
          const merc = this.merc;
          setDisplay(ui.mercBarWrap, 'block');
          setWidth(ui.mercHpFill, pct(merc.hp, merc.maxHp));
          setWidth(ui.mercMpFill, pct(merc.mana, merc.maxMana || 1));
          this.applyResourceBarType?.(ui.mercMpFill?.closest?.('.bar'), ui.mercMpFill, merc);
          if (merc.alive) setHudBarText(ui.mercHpText, 'HP', `${Math.ceil(merc.hp)}/${Math.ceil(merc.maxHp)}`);
          else setHudBarText(ui.mercHpText, 'Downed', `${Math.ceil(Number(merc.reviveTimer || 0))}s`);
          setHudBarText(ui.mercMpText, this.actorResourceLabel?.(merc) || 'Mana', `${Math.ceil(merc.mana)}/${Math.ceil(merc.maxMana || 0)}`);
          setWidth(ui.mercXpFill, pct(merc.xp || 0, merc.nextXp || 1));
        } else {
          setDisplay(ui.mercBarWrap, 'none');
        }
        this.renderHotbarCombatState?.();
        this.updateUnifiedCompanionHudResourceBars?.();
        return true;
      };

      Game.prototype.updateUIBatched = function(dt = 0, options = {}) {
        if (!this.player) return false;
        const stats = this.perfStats || (this.perfStats = {});
        const cfg = this.uiPerformanceConfig?.() || {};
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const player = this.player;
        const activeCombat = Boolean(player?.combatCooldown > 0 || this.merc?.combatCooldown > 0 || this.pet?.combatCooldown > 0 || this.getTarget?.());
        const fastInterval = activeCombat ? cfg.fastCombatInterval : cfg.fastIdleInterval;
        const fullInterval = activeCombat ? cfg.fullCombatInterval : cfg.fullIdleInterval;
        this._uiFastAccumulator = Math.min(0.75, Math.max(0, Number(this._uiFastAccumulator || 0) + Math.max(0, Number(dt) || 0)));
        this._uiFullAccumulator = Math.min(2.0, Math.max(0, Number(this._uiFullAccumulator || 0) + Math.max(0, Number(dt) || 0)));
        const dirty = this.uiDirty === true || this.bagDirty === true || this.botHudDirty === true || this.mercCommandDirty === true || this.petCommandDirty === true || this.mercGearDirty === true || this.partyPanelDirty === true;
        const force = options.force === true || dirty;
        const dueFull = force || this._uiFullAccumulator >= fullInterval;
        const dueFast = dueFull || this._uiFastAccumulator >= fastInterval;
        if (!dueFast) {
          stats.uiSkippedUpdates = (stats.uiSkippedUpdates || 0) + 1;
          return false;
        }
        const start = now;
        this._uiFastAccumulator = 0;
        if (dueFull) {
          this._uiFullAccumulator = 0;
          this.updateUI();
          this.uiDirty = false;
          this._uiDirtyReasons?.clear?.();
          stats.uiFullUpdates = (stats.uiFullUpdates || 0) + 1;
          stats.uiFullMs = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - start;
        } else {
          this.updateCoreHudFast?.();
          stats.uiFastUpdates = (stats.uiFastUpdates || 0) + 1;
          stats.uiFastMs = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - start;
        }
        stats.uiUpdateMs = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - start;
        return true;
      };

      Game.prototype.updateUI = function() {
        if (!this.player) return;
        this.ensureGameplayHudChrome?.('full');
        setText(ui.playerName, this.player.name);
        const hudGender = String(this.player.gender || 'male').replace(/^./, ch => ch.toUpperCase());
        setText(ui.playerMeta, `Level ${this.player.level} ${hudGender} ${this.player.className}`);
        applyClassHudVisualStyle(ui.hud, this.player.className);
        applyClassEmblem(ui.hudPortraitIcon, this.player.className, { size: 84, extraClass: 'hudClassEmblem', title: `${this.player.className} emblem` });
        setText(ui.goldText, '');
        setWidth(ui.hpFill, pct(this.player.hp, this.player.maxHp));
        setWidth(ui.mpFill, pct(this.player.mana, this.player.maxMana || 1));
        this.applyResourceBarType?.(ui.mpFill?.closest?.('.bar'), ui.mpFill, this.player);
        setWidth(ui.xpFill, pct(this.player.xp, this.player.nextXp));
        setHudBarText(ui.hpText, 'HP', `${Math.ceil(this.player.hp)}/${Math.ceil(this.player.maxHp)}`);
        setHudBarText(ui.mpText, this.actorResourceLabel?.(this.player) || this.spellResourceLabel?.(this.player.className) || 'Mana', `${Math.ceil(this.player.mana)}/${Math.ceil(this.player.maxMana || 0)}`);
        setHudBarText(ui.xpText, 'Exp', `${Math.floor(this.player.xp)}/${Math.floor(this.player.nextXp)}`);
        const playerStatusHtml = renderStatusTray(this.player);
        const actionBuffHtml = renderStatusTray(this.player, { hostile: false, limit: 8 });
        const actionDebuffHtml = renderStatusTray(this.player, { hostile: true, limit: 8 });
        const playerStatusChanged = setHtml(ui.playerStatusTray, playerStatusHtml);
        const actionBuffChanged = setHtml(ui.actionBuffTray, actionBuffHtml);
        const actionDebuffChanged = setHtml(ui.actionDebuffTray, actionDebuffHtml);
        if (playerStatusChanged) this.bindStatusTrayTooltips?.(ui.playerStatusTray);
        if (actionBuffChanged) this.bindStatusTrayTooltips?.(ui.actionBuffTray);
        if (actionDebuffChanged) this.bindStatusTrayTooltips?.(ui.actionDebuffTray);

        const target = this.getTarget();
        if (target) {
          setDisplay(ui.targetBox, 'block');
          setText(ui.targetName, target.name);
          const questInfo = this.questSystem?.getQuestTargetInfoForEnemy?.(target);
          const threat = target.baseType?.threatTag ? ` · ${target.baseType.threatTag}` : '';
          const threatLeader = this.describeThreatLeader?.(target) || '';
          setText(ui.targetMeta, questInfo
            ? `Level ${target.level}${threat} · Quest Target · ${questInfo.progress}/${questInfo.required}${threatLeader}`
            : `Level ${target.level}${threat}${threatLeader}`);
          setWidth(ui.targetHpFill, pct(target.hp, target.maxHp));
          setHudBarText(ui.targetHpText, 'HP', `${Math.ceil(target.hp)}/${Math.ceil(target.maxHp)}`);
          if (setHtml(ui.targetStatusTray, renderStatusTray(target))) this.bindStatusTrayTooltips?.(ui.targetStatusTray);
        } else {
          setDisplay(ui.targetBox, 'none');
          setHtml(ui.targetStatusTray, '');
        }

        if (this.merc) {
          const merc = this.merc;
          const mercState = this.describeMercCommandState?.(merc) || (merc.meditating ? 'Meditating' : (merc.command || 'assist'));
          const progress = this.mercProgressionSummary?.(merc) || { level: merc.level || 1, xp: merc.xp || 0, nextXp: merc.nextXp || 1, pct: 0 };
          const roleIcon = this.mercRoleIcon?.(merc) || '◆';
          const roleName = this.mercRoleArchetype?.(merc) || merc.roleLabel || 'Mercenary';
          const badgeClass = this.mercStateBadgeClass?.(merc) || '';
          setText(ui.mercStatus, `${merc.name} · Level ${progress.level} · ${roleName}`);
          setDisplay(ui.mercBarWrap, 'block');
          setText(ui.mercPortrait, roleIcon);
          setHtml(ui.mercMetaTop, `<span>${merc.name}</span><span class="mercRoleBadge">${roleIcon} ${roleName}</span><span class="mercStateBadge ${badgeClass}">${merc.alive ? String(merc.command || 'assist') : 'Downed'}</span>`);
          setText(ui.mercRoleLine, `Level ${progress.level} ${merc.roleLabel || roleName} · ${progress.pct}% to next level`);
          setText(ui.mercStateLine, mercState);
          setHtml(ui.mercStatGrid, (this.mercStatsSnapshot?.(merc) || []).map(([label, value]) => `<div class="mercStatTile"><strong>${value}</strong><span>${label}</span></div>`).join(''));
          setWidth(ui.mercHpFill, pct(merc.hp, merc.maxHp));
          setWidth(ui.mercMpFill, pct(merc.mana, merc.maxMana || 1));
          this.applyResourceBarType?.(ui.mercMpFill?.closest?.('.bar'), ui.mercMpFill, merc);
          if (merc.alive) setHudBarText(ui.mercHpText, 'HP', `${Math.ceil(merc.hp)}/${Math.ceil(merc.maxHp)}`);
          else setHudBarText(ui.mercHpText, 'Downed', `${Math.ceil(Number(merc.reviveTimer || 0))}s`);
          setHudBarText(ui.mercMpText, this.actorResourceLabel?.(merc) || 'Mana', `${Math.ceil(merc.mana)}/${Math.ceil(merc.maxMana || 0)}`);
          setWidth(ui.mercXpFill, pct(merc.xp || 0, merc.nextXp || 1));
          setHudBarText(ui.mercXpText, 'Exp', `${progress.xp}/${progress.nextXp} · ${progress.pct}%`);
          setHtml(ui.mercStatusTray, renderStatusTray(merc));
          if (ui.mercGearBtn) {
            setDisabled(ui.mercGearBtn, !merc.alive);
            setText(ui.mercGearBtn, this.mercGearOpen ? 'Close Gear' : 'Merc Gear');
            if (ui.mercGearBtn.dataset.boundMercGear !== '1') {
              ui.mercGearBtn.dataset.boundMercGear = '1';
              ui.mercGearBtn.addEventListener('click', () => this.toggleMercGearWindow?.());
            }
          }
          if (this.mercGearOpen || this.mercGearDirty) this.renderMercGearWindow?.();
          if (ui.mercCommands) {
            const command = merc.command || 'assist';
            const signature = `${merc.id || merc.name || 'merc'}:${command}:${merc.alive ? 1 : 0}`;
            if (this.mercCommandDirty || ui.mercCommands.dataset.signature !== signature) {
              ui.mercCommands.dataset.signature = signature;
              const mercButtons = merc.alive
                ? ['follow', 'assist', 'guard', 'passive', 'attack', 'meditate', 'stand', 'gear', 'dismiss']
                : ['revive', 'dismiss'];
              ui.mercCommands.innerHTML = mercButtons.map(cmd => `<button data-merc-command="${cmd}" class="${cmd === command ? 'active' : ''}">${cmd}</button>`).join('');
              ui.mercCommands.querySelectorAll('[data-merc-command]').forEach(btn => btn.addEventListener('click', () => this.handleMercCommandAction?.(btn.dataset.mercCommand)));
              this.mercCommandDirty = false;
            }
          }
          setText(ui.mercInvitePartyBtn, this.partyMercIncluded ? 'Merc in Party' : 'Invite Merc to Party');
          setDisabled(ui.mercInvitePartyBtn, Boolean(this.partyMercIncluded) || !merc.alive);
        } else {
          setText(ui.mercStatus, 'No active mercenary.');
          setDisplay(ui.mercBarWrap, 'none');
          if (ui.mercCommands) {
            setHtml(ui.mercCommands, '');
            ui.mercCommands.dataset.signature = '';
          }
          setHtml(ui.mercMetaTop, '');
          setText(ui.mercRoleLine, '');
          setText(ui.mercStateLine, '');
          setHtml(ui.mercStatGrid, '');
          setWidth(ui.mercXpFill, '0%');
          setHudBarText(ui.mercXpText, 'Exp', '0/0');
          setHtml(ui.mercStatusTray, '');
          if (ui.mercGearBtn) { setText(ui.mercGearBtn, 'Merc Gear'); setDisabled(ui.mercGearBtn, true); }
          if (this.mercGearOpen) this.mercGearDirty = true;
          this.mercGearOpen = false;
          if (this.mercGearDirty) this.renderMercGearWindow?.();
          if (ui.mercInvitePartyBtn) { setText(ui.mercInvitePartyBtn, 'Invite Merc to Party'); setDisabled(ui.mercInvitePartyBtn, true); }
        }

        this.renderBagBar?.();
        if (this.bagOpen) this.renderBag?.();
        if (this.professionSystem?.open) this.professionSystem.update?.();
        if (this.characterPanelOpen) this.renderCharacterPanel();
        if (this.spellPanelOpen) this.renderSpellPanel();
        if (this.settingsPanelOpen) this.renderSettingsPanel();
        this.applyUiPreferences?.();
        this.renderHotbarCombatState?.();
        this.renderUnifiedCompanionHud?.();
      };

      Game.prototype.petRoleIcon = function(pet = this.pet) {
        if (!pet) return '◆';
        return pet.petType === 'undead' ? '☠' : '✦';
      };

      Game.prototype.describePetCommandState = function(pet = this.pet) {
        if (!pet) return 'No active pet';
        if (!pet.alive) return 'Downed';
        const command = String(pet.command || 'assist');
        const state = String(pet.commandState || command).replace(/-/g, ' ');
        return `${command} · ${state}`;
      };

      Game.prototype.setPetCommand = function(command) {
        if (!this.pet) return this.log?.('No active pet.');
        const allowed = new Set(['follow', 'assist', 'guard', 'passive', 'attack']);
        if (!allowed.has(command)) return false;
        this.pet.command = command;
        this.pet.commandState = command;
        this.playAudioEvent?.('merc_command', { actor: this.pet, volume: 0.18, cooldown: 0.12 });
        this.log?.(`${this.pet.name} command: ${command}.`);
        this.petCommandDirty = true;
        this.updateUI?.();
        return true;
      };

      Game.prototype.dismissPet = function() {
        if (!this.pet) return this.log?.('No active pet.');
        this.log?.(`${this.pet.name} dismissed.`);
        this.entities = (this.entities || []).filter(entity => entity !== this.pet);
        this.pet = null;
        this.petCommandDirty = true;
        this.updateUI?.();
        return true;
      };

      Game.prototype.ensurePetCommandHud = function() {
        let panel = document.getElementById('petCommandPanel');
        if (panel) return panel;
        panel = document.createElement('section');
        panel.id = 'petCommandPanel';
        panel.className = 'panel';
        panel.style.cssText = 'position:fixed;left:344px;bottom:94px;width:300px;padding:12px;z-index:4;display:none';
        panel.innerHTML = `
          <div class="title-row">
            <div><div class="name">Pet Command</div><div class="small" data-pet-status>No active pet.</div></div>
            <button data-pet-dismiss>Dismiss</button>
          </div>
          <div class="mercIdentity">
            <div class="mercPortrait" data-pet-portrait>✦</div>
            <div class="mercMetaGrid">
              <div class="mercMetaTop" data-pet-meta></div>
              <div class="small" data-pet-state></div>
            </div>
          </div>
          <div class="small">Pet Health</div>
          <div class="bar"><div data-pet-hp-fill class="fill hp"></div><div data-pet-hp-text class="barText">${hudBarTextMarkup('HP', '0/0')}</div></div>
          <div data-pet-commands></div>
        `;
        document.body.appendChild(panel);
        panel.querySelector('[data-pet-dismiss]')?.addEventListener('click', () => this.dismissPet?.());
        panel.addEventListener('click', event => {
          const btn = event.target.closest('[data-pet-command]');
          if (!btn) return;
          this.setPetCommand?.(btn.dataset.petCommand);
        });
        return panel;
      };

      Game.prototype.renderPetCommandHud = function() {
        const legacyPetPanel = this._legacyPetCommandPanel || (this._legacyPetCommandPanel = document.getElementById('petCommandPanel'));
        if (legacyPetPanel) legacyPetPanel.style.display = 'none';
        this.renderUnifiedCompanionHud?.();
      };

      Game.prototype.companionHudResourceBar = function(kind, current, max, label) {
        const cur = Math.max(0, Math.ceil(Number(current) || 0));
        const cap = Math.max(0, Math.ceil(Number(max) || 0));
        const width = cap > 0 ? Math.max(0, Math.min(100, (cur / cap) * 100)) : 0;
        return `<div class="partyValueBar ${escapeHtml(kind)}" data-resource-kind="${escapeHtml(kind)}" data-resource-label="${escapeHtml(label)}"><div class="partyValueFill" style="width:${width.toFixed(1)}%"></div><div class="partyValueText">${partyBarTextMarkup(label, `${cur}/${cap}`)}</div></div>`;
      };

      Game.prototype.partyHudAiIntent = function(member) {
        const entity = member?.entity || member;
        if (!entity || String(member?.type || entity.kind) !== 'bot') return String(member?.currentActivityLabel || member?.commandState || '');
        if (entity.alive === false) return 'Downed';
        if (this.actorIsMeditating?.(entity)) return 'Recovering';
        const state = `${entity.botState || ''} ${entity.currentActivityLabel || ''} ${entity.botPendingCast?.spellName || ''}`.toLowerCase();
        const combat = this.isEntityInCombat?.(entity) === true;
        if (/heal|mend|restore/.test(state)) return 'Healing';
        if (/buff|song|bless|prep/.test(state)) return 'Buffing';
        if (/control|root|debuff|enchant|bind/.test(state)) return 'Controlling';
        if (/cast|channel/.test(state)) return 'Casting';
        if (/recover|meditat|rest|defensive-reposition/.test(state)) return 'Recovering';
        if (combat || /fight|tank|attack|flank|combat|engag/.test(state)) return 'Fighting';
        return /follow|formation|moving-with-party/.test(state) ? 'Following' : (entity.currentActivityLabel || 'Following');
      };

      Game.prototype.unifiedCompanionCommandDefs = function(member = null) {
        const type = String(member?.type || member?.kind || '').toLowerCase();
        if (!['merc', 'bot'].includes(type)) return [];
        return [
          ['follow', 'Follow'],
          ['guard', 'Guard'],
          ['assist', 'Assist'],
          ['passive', 'Passive'],
          ['attack', 'Attack']
        ];
      };

      Game.prototype.unifiedCompanionActiveCommand = function(member = null, entry = null) {
        const entity = member?.entity || null;
        const type = String(member?.type || entity?.kind || entry?.kind || '').toLowerCase();
        const raw = type === 'bot'
          ? (entity?.botPartyCommand || entity?.commandState || member?.commandState || member?.command || entry?.activeCommand || 'follow')
          : (entity?.command || member?.command || entity?.commandState || member?.commandState || entry?.activeCommand || 'assist');
        return String(raw || '').toLowerCase().replace(/^party$/, 'follow');
      };

      Game.prototype.unifiedCompanionCommandRow = function(entry = null) {
        const member = entry?.member || null;
        const entity = member?.entity || null;
        if (!member || !entity || !['merc', 'bot'].includes(String(member.type || '').toLowerCase())) return '';
        if (member.alive === false || entity.alive === false) return '';
        const defs = this.unifiedCompanionCommandDefs?.(member) || [];
        if (!defs.length) return '';
        const active = this.unifiedCompanionActiveCommand?.(member, entry) || '';
        const memberId = escapeHtml(String(entry?.partyMemberId || member.id || entity.botId || entity.remoteId || entity.id || ''));
        const buttons = defs.map(([value, label]) => {
          const selected = active === value || (value === 'follow' && active === 'party');
          return `<button type="button" data-unified-companion-command="${escapeHtml(value)}" data-party-member-id="${memberId}" class="${selected ? 'active' : ''}" aria-pressed="${selected ? 'true' : 'false'}">${escapeHtml(label)}</button>`;
        }).join('');
        return `<div class="unifiedCommandRow" role="group" aria-label="Companion commands">${buttons}</div>`;
      };

      Game.prototype.companionHudFrame = function(entry) {
        const member = entry.member || {};
        const kind = String(entry.kind || member.type || 'member');
        const memberId = String(entry.partyMemberId || member.id || '');
        const icon = entry.icon || this.partyMemberIcon?.(member) || '●';
        const name = entry.name || member.name || 'Unknown';
        const role = entry.role || this.partyMemberClassLabel?.(member) || member.className || 'Member';
        const level = Math.max(1, Math.floor(Number(member.level) || 1));
        const entity = member.entity || null;
        const emblemClassName = entry.className || member.className || entity?.className || (member.type === 'pet' || kind === 'pet' ? (entity?.petType === 'undead' ? 'Necromancer' : 'Summoner') : '');
        const portrait = emblemClassName
          ? classEmblemMarkup(emblemClassName, { size: 26, className: 'partyFrameClassEmblem', title: `${emblemClassName} emblem` })
          : `<span class="partyFrameFallbackIcon">${escapeHtml(icon)}</span>`;
        const intent = String(member.type === 'bot' ? this.partyHudAiIntent?.(member) : (entry.state || member.currentActivityLabel || member.commandState || (member.type === 'merc' ? member.command : '')) || '').replace(/-/g, ' ');
        const transitionZone = member.entity?.zoneTransitionGrace > 0 ? String(member.entity?.zone || member.zone || '') : '';
        const transitionState = transitionZone === 'dungeon' ? 'Entering Dungeon' : (transitionZone === 'cave' ? 'Entering Cave' : (transitionZone === 'overworld' ? 'Following' : ''));
        const combat = Boolean(entity && member.alive !== false && this.isEntityInCombat?.(entity));
        const state = transitionState || (member.alive === false ? 'Downed' : (member.meditating ? 'Recovering · Meditating' : (combat ? `In Combat${intent ? ` · ${intent}` : ''}` : (intent || 'Following Party'))));
        const downedClass = member.alive === false ? ' downed' : '';
        const selected = Boolean(entity && this.player?.targetId === entity.id);
        const selectedClass = selected ? ' selected' : '';
        const contextEligible = ['bot', 'merc'].includes(String(member.type));
        const resourceKind = this.actorResourceBarKind?.(member) || 'mp';
        const resourceLabel = this.actorResourceLabel?.(member) || 'Mana';
        const mana = Number(member.maxMana || 0) > 0 ? this.companionHudResourceBar(resourceKind, member.mana, member.maxMana, resourceLabel) : '';
        const xp = entry.showXp && Number(member.nextXp || 0) > 0 ? this.companionHudResourceBar('xp', member.xp || 0, member.nextXp || 1, 'EXP') : '';
        const ownedCommands = this.unifiedCompanionCommandRow?.(entry) || '';
        const legacyCommands = entry.commands?.length ? `<div class="unifiedCommandRow">${entry.commands.map(cmd => `<button data-unified-${escapeHtml(kind)}-command="${escapeHtml(cmd)}" class="${cmd === (entry.activeCommand || member.command) ? 'active' : ''}">${escapeHtml(cmd)}</button>`).join('')}</div>` : '';
        const commands = ownedCommands || legacyCommands;
        const statuses = entity ? renderStatusTray(entity) : '';
        const classCardStyle = classHudVisualStyle(emblemClassName || role);
        return `<div class="unifiedHudFrame compactPlayerHudFrame ${escapeHtml(kind)}${downedClass}${selectedClass}" data-unified-kind="${escapeHtml(kind)}" data-party-member-id="${escapeHtml(memberId)}" data-party-context="${contextEligible ? '1' : '0'}" data-party-class="${escapeHtml(classEmblemMeta(emblemClassName || role).key)}" style="${classCardStyle}" tabindex="0" role="button" aria-selected="${selected ? 'true' : 'false'}">
          <div class="unifiedHudClassBackdrop" aria-hidden="true"></div>
          <div class="unifiedHudBody compactPlayerHudBody">
            <div class="unifiedHudName"><span>${escapeHtml(name)}</span><em>${escapeHtml(role)} · Lv ${level}</em></div>
            <div class="unifiedHudState">${escapeHtml(state)}</div>
            ${this.companionHudResourceBar('hp', member.hp, member.maxHp, 'HP')}
            ${mana}
            ${xp}
            ${commands}
            ${statuses ? `<div class="unifiedHudStatuses statusTray">${statuses}</div>` : ''}
          </div>
          <div class="unifiedHudPortrait compactPlayerHudPortrait">${portrait}</div>
        </div>`;
      };

      Game.prototype.buildUnifiedCompanionHudEntries = function() {
        const roster = (this.getPartyRoster?.({ includePet: false }) || []);
        const activeParty = roster.length > 1 || Boolean(this.partyId) || Boolean(this.partyMercIncluded);
        const entries = activeParty
          ? roster
            .filter(member => !member.local)
            .map(member => {
              const commandable = ['merc', 'bot'].includes(String(member.type || '').toLowerCase());
              return {
                kind: member.type === 'bot' ? 'partyBot' : member.type === 'merc' ? 'merc' : 'party',
                partyMemberId: String(member.id),
                member,
                icon: this.partyMemberIcon?.(member) || '●',
                className: member.className || member.entity?.className || '',
                role: this.partyMemberClassLabel?.(member) || 'Party Member',
                state: member.currentActivityLabel || member.commandState || '',
                activeCommand: commandable ? this.unifiedCompanionActiveCommand?.(member) : '',
                showXp: false,
                commands: commandable && member.alive !== false ? (this.unifiedCompanionCommandDefs?.(member) || []).map(([value]) => value) : []
              };
            })
          : [];
        const rosterIds = new Set(entries.map(entry => String(entry.partyMemberId)));
        if (this.merc && activeParty && this.partyMercIncluded && !rosterIds.has('merc')) {
          const mercMember = this.partySnapshotForActor?.(this.merc, { id: 'merc', type: 'merc', name: this.merc.name || 'Mercenary' }) || this.merc;
          entries.push({
            kind: 'merc',
            member: mercMember,
            icon: this.mercRoleIcon?.(this.merc) || '◆',
            className: this.merc.className || this.merc.roleClass || this.merc.roleLabel || '',
            name: this.merc.name || 'Mercenary',
            role: this.mercRoleArchetype?.(this.merc) || this.merc.roleLabel || 'Mercenary',
            state: this.describeMercCommandState?.(this.merc) || (this.merc.alive ? String(this.merc.command || 'assist') : 'Downed'),
            command: this.merc.command || 'assist',
            activeCommand: this.unifiedCompanionActiveCommand?.(mercMember) || this.merc.command || 'assist',
            showXp: true,
            commands: this.merc.alive ? (this.unifiedCompanionCommandDefs?.(mercMember) || []).map(([value]) => value) : []
          });
        }
        if (this.pet) {
          const petRole = this.pet.petType === 'undead' ? 'Necromancer Pet' : 'Summoner Pet';
          const petMember = this.partySnapshotForActor?.(this.pet, { id: 'pet', type: 'pet', name: this.pet.name || 'Pet' }) || this.pet;
          entries.push({
            kind: 'pet',
            member: petMember,
            icon: this.petRoleIcon?.(this.pet) || '◆',
            className: this.pet.petType === 'undead' ? 'Necromancer' : 'Summoner',
            name: this.pet.name || 'Pet',
            role: petRole,
            state: this.describePetCommandState?.(this.pet) || (this.pet.alive ? String(this.pet.command || 'assist') : 'Downed'),
            command: this.pet.command || 'assist',
            activeCommand: this.pet.command || 'assist',
            commands: this.pet.alive ? ['follow', 'assist', 'guard', 'passive', 'attack', 'dismiss'] : []
          });
        }
        return entries;
      };

      Game.prototype.unifiedCompanionHudSignature = function(entries = this.buildUnifiedCompanionHudEntries?.() || []) {
        const parts = this._unifiedHudSignatureParts || (this._unifiedHudSignatureParts = []);
        parts.length = 0;
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i] || {};
          const m = entry.member || {};
          const entity = m.entity || null;
          const buffs = entity?.buffs || [];
          let effectSig = '';
          for (let j = 0; j < buffs.length; j++) {
            const effect = buffs[j];
            if (!effect) continue;
            effectSig += `${effect.id || effect.name || ''}:${Math.ceil(Number(effect.remaining || 0))}:${Math.ceil(Number(effect.duration || 0))};`;
          }
          parts.push([
            entry.kind,
            entry.partyMemberId || m.id || '',
            entry.name || m.name || '',
            entry.role || m.className || m.roleLabel || '',
            m.level || 0,
            Math.ceil(Number(m.hp || 0)),
            Math.ceil(Number(m.maxHp || 0)),
            Math.ceil(Number(m.mana || 0)),
            Math.ceil(Number(m.maxMana || 0)),
            this.actorResourceBarKind?.(m) || 'mp',
            m.alive === false ? 0 : 1,
            m.meditating ? 1 : 0,
            entity && this.isEntityInCombat?.(entity) ? 1 : 0,
            entry.state || m.currentActivityLabel || m.commandState || '',
            entry.activeCommand || m.command || m.commandState || '',
            this.player?.targetId === entity?.id ? 1 : 0,
            effectSig,
            (entry.commands || []).join('|')
          ].join('~'));
        }
        return parts.join('^');
      };

      Game.prototype.unifiedCompanionHudStructureSignature = function(entries = this.buildUnifiedCompanionHudEntries?.() || []) {
        const parts = this._unifiedHudStructureSignatureParts || (this._unifiedHudStructureSignatureParts = []);
        parts.length = 0;
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i] || {};
          const m = entry.member || {};
          const entity = m.entity || null;
          const buffs = entity?.buffs || [];
          let effectSig = '';
          for (let j = 0; j < buffs.length; j++) {
            const effect = buffs[j];
            if (!effect) continue;
            effectSig += `${effect.id || effect.name || ''}:${Math.ceil(Number(effect.remaining || 0))}:${Math.ceil(Number(effect.duration || 0))};`;
          }
          parts.push([
            entry.kind,
            entry.partyMemberId || m.id || '',
            entry.name || m.name || '',
            entry.role || m.className || m.roleLabel || '',
            m.level || 0,
            Math.ceil(Number(m.maxHp || 0)),
            Math.ceil(Number(m.maxMana || 0)),
            this.actorResourceBarKind?.(m) || 'mp',
            Math.ceil(Number(m.nextXp || 0)),
            m.alive === false ? 0 : 1,
            m.meditating ? 1 : 0,
            entity && this.isEntityInCombat?.(entity) ? 1 : 0,
            entry.state || m.currentActivityLabel || m.commandState || '',
            entry.activeCommand || m.command || m.commandState || '',
            this.player?.targetId === entity?.id ? 1 : 0,
            effectSig,
            (entry.commands || []).join('|')
          ].join('~'));
        }
        return `v31-player-layout:${parts.join('^')}`;
      };

      Game.prototype.updateUnifiedCompanionHudResourceBars = function(entries = null) {
        if (!ui.unifiedHudFrames || !this.player) return false;
        const list = entries || this.buildUnifiedCompanionHudEntries?.() || [];
        let writes = 0;
        for (const entry of list) {
          const member = entry?.member || {};
          const id = String(entry?.partyMemberId || member.id || '');
          if (!id) continue;
          const frame = Array.from(ui.unifiedHudFrames.querySelectorAll?.('[data-party-member-id]') || []).find(node => String(node.dataset.partyMemberId || '') === id);
          if (!frame) continue;
          const updateBar = (kind, current, max, label) => {
            const node = frame.querySelector?.(`[data-resource-kind="${kind}"]`);
            if (!node) return;
            const cur = Math.max(0, Math.ceil(Number(current) || 0));
            const cap = Math.max(0, Math.ceil(Number(max) || 0));
            const width = cap > 0 ? Math.max(0, Math.min(100, (cur / cap) * 100)) : 0;
            const fill = node.querySelector?.('.partyValueFill');
            const text = node.querySelector?.('.partyValueText');
            const nextWidth = `${width.toFixed(1)}%`;
            if (fill && fill.style.width !== nextWidth) { fill.style.width = nextWidth; recordUiWrite('style'); writes += 1; }
            const nextText = partyBarTextMarkup(label, `${cur}/${cap}`);
            if (text && text.innerHTML !== nextText) { text.innerHTML = nextText; recordUiWrite('html'); writes += 1; }
          };
          updateBar('hp', member.hp, member.maxHp, 'HP');
          if (Number(member.maxMana || 0) > 0) {
            updateBar(this.actorResourceBarKind?.(member) || 'mp', member.mana, member.maxMana, this.actorResourceLabel?.(member) || 'Mana');
          }
          if (entry.showXp && Number(member.nextXp || 0) > 0) updateBar('xp', member.xp || 0, member.nextXp || 1, 'EXP');
        }
        if (writes && this.perfStats) this.perfStats.uiCompanionResourceUpdates = (this.perfStats.uiCompanionResourceUpdates || 0) + writes;
        return writes > 0;
      };

      Game.prototype.hidePartyMemberContextMenu = function() {
        const menu = document.getElementById('partyMemberContextMenu');
        if (menu) menu.style.display = 'none';
      };

      Game.prototype.openPartyMemberContextMenu = function(memberId, clientX, clientY) {
        const member = this.findPartyMemberById?.(memberId);
        const actor = member?.entity;
        if (!member || !actor || !['bot', 'merc'].includes(String(member.type))) return false;
        let menu = document.getElementById('partyMemberContextMenu');
        if (!menu) {
          menu = document.createElement('div');
          menu.id = 'partyMemberContextMenu';
          menu.addEventListener('click', event => {
            const button = event.target.closest('[data-party-context-action]');
            if (!button) return;
            this.handlePartyMemberContextAction?.(button.dataset.partyMemberId, button.dataset.partyContextAction);
            this.hidePartyMemberContextMenu?.();
          });
          document.body.appendChild(menu);
        }
        const actions = member.type === 'bot'
          ? [{ id: 'inspect', label: 'Inspect' }, { id: 'talk', label: 'Talk' }, { id: 'remove', label: 'Remove From Party' }]
          : [{ id: 'inspect', label: 'Inspect' }, { id: 'remove', label: 'Remove From Party' }];
        menu.innerHTML = `<div class="contextTitle">${escapeHtml(member.name)} · ${escapeHtml(this.partyMemberClassLabel?.(member) || 'Party Member')}</div>${actions.map(action => `<button data-party-member-id="${escapeHtml(String(member.id))}" data-party-context-action="${escapeHtml(action.id)}">${escapeHtml(action.label)}</button>`).join('')}`;
        menu.style.display = 'grid';
        const width = 190;
        const height = Math.max(90, 38 + actions.length * 31);
        menu.style.left = `${Math.max(6, Math.min(window.innerWidth - width - 6, Number(clientX) || 0))}px`;
        menu.style.top = `${Math.max(6, Math.min(window.innerHeight - height - 6, Number(clientY) || 0))}px`;
        return true;
      };

      Game.prototype.bindUnifiedCompanionHud = function() {
        if (!ui.unifiedCompanionHud || ui.unifiedCompanionHud.dataset.boundUnifiedHud === '1') return;
        ui.unifiedCompanionHud.dataset.boundUnifiedHud = '1';
        ui.unifiedCompanionHud.addEventListener('click', event => {
          const companionBtn = event.target.closest('[data-unified-companion-command]');
          if (companionBtn) {
            event.stopPropagation();
            const memberId = companionBtn.dataset.partyMemberId || companionBtn.closest('[data-party-member-id]')?.dataset.partyMemberId || '';
            const command = companionBtn.dataset.unifiedCompanionCommand || '';
            this.handlePartyCompanionCommand?.(memberId, command);
            return;
          }
          const mercBtn = event.target.closest('[data-unified-merc-command]');
          if (mercBtn) {
            this.handleMercCommandAction?.(mercBtn.dataset.unifiedMercCommand);
            return;
          }
          const petBtn = event.target.closest('[data-unified-pet-command]');
          if (petBtn) {
            const command = petBtn.dataset.unifiedPetCommand;
            if (command === 'dismiss') this.dismissPet?.();
            else this.setPetCommand?.(command);
            return;
          }
          const frame = event.target.closest('[data-party-member-id]');
          if (frame) this.selectPartyMember?.(frame.dataset.partyMemberId);
        });
        ui.unifiedCompanionHud.addEventListener('keydown', event => {
          if (!['Enter', ' '].includes(event.key)) return;
          const frame = event.target.closest('[data-party-member-id]');
          if (!frame) return;
          event.preventDefault();
          this.selectPartyMember?.(frame.dataset.partyMemberId);
        });
        ui.unifiedCompanionHud.addEventListener('contextmenu', event => {
          const frame = event.target.closest('[data-party-member-id]');
          if (!frame || frame.dataset.partyContext !== '1') return;
          event.preventDefault();
          this.openPartyMemberContextMenu?.(frame.dataset.partyMemberId, event.clientX, event.clientY);
        });
      };


      Game.prototype.ensureGameplayHudChrome = function(reason = 'ui-refresh') {
        const inGameplay = Boolean(this.started && this.player);
        document.body.classList.toggle('gameStarted', inGameplay);
        if (!inGameplay) return false;
        const hud = ui.hud || document.getElementById('hud');
        if (hud) {
          hud.style.display = 'block';
          hud.style.visibility = 'visible';
          hud.style.opacity = '1';
          hud.style.pointerEvents = 'auto';
          hud.style.zIndex = hud.style.zIndex || '18';
        }
        const dock = document.getElementById('menuDock');
        if (dock) {
          dock.style.visibility = 'visible';
          dock.style.pointerEvents = 'auto';
        }
        this.attachUnifiedCompanionHudToPlayerHud?.();
        return true;
      };

      Game.prototype.ensureMenuButtonOwnership = function() {
        const panel = ui.menuPanel || document.getElementById('menuPanel');
        const list = panel?.querySelector?.('.menuList');
        if (!panel || !list) return false;
        const patchPanel = ui.menuPatchNotesPanel || document.getElementById('menuPatchNotesPanel');
        const logout = ui.menuLogoutBtn || document.getElementById('menuLogoutBtn');
        const exit = ui.menuExitBtn || document.getElementById('menuExitBtn');
        // V0.17.07: the static menu patch-notes markup can be regenerated with a
        // very large embedded history. Keep Logout/Exit owned by .menuList, not by
        // the hidden Patch Notes panel, so hidden patch notes cannot hide menu exits.
        if (patchPanel && logout && logout.parentElement !== list) list.appendChild(logout);
        if (patchPanel && exit && exit.parentElement !== list) list.appendChild(exit);
        for (const btn of [logout, exit].filter(Boolean)) {
          btn.style.display = 'block';
          btn.hidden = false;
          btn.removeAttribute('aria-hidden');
        }
        panel.style.maxHeight = 'min(720px, calc(100vh - 48px))';
        panel.style.overflow = 'auto';
        list.style.maxHeight = 'calc(100vh - 132px)';
        list.style.overflowY = 'auto';
        return true;
      };

      Game.prototype.attachUnifiedCompanionHudToPlayerHud = function() {
        if (!ui.unifiedCompanionHud) return false;
        const playerHud = ui.hud || document.getElementById('hud');
        if (!playerHud) return false;
        if (ui.unifiedCompanionHud.parentElement !== playerHud) playerHud.appendChild(ui.unifiedCompanionHud);
        ui.unifiedCompanionHud.classList.add('inPlayerHud');
        ui.unifiedCompanionHud.setAttribute('aria-label', 'HUD companions');
        return true;
      };

      Game.prototype.renderUnifiedCompanionHud = function(options = {}) {
        if (ui.mercPanel) ui.mercPanel.style.display = 'none';
        if (ui.partyHud) ui.partyHud.style.display = 'none';
        const legacyPetPanel = this._legacyPetCommandPanel || (this._legacyPetCommandPanel = document.getElementById('petCommandPanel'));
        if (legacyPetPanel) legacyPetPanel.style.display = 'none';
        if (!ui.unifiedCompanionHud || !ui.unifiedHudFrames || !this.player) return;
        this.attachUnifiedCompanionHudToPlayerHud?.();
        this.bindUnifiedCompanionHud?.();
        const entries = this.buildUnifiedCompanionHudEntries?.() || [];
        const prefs = this.uiPrefs && typeof this.uiPrefs === 'object' ? this.uiPrefs : {};
        const visible = entries.length > 0 && (prefs.showMercPanel !== false || prefs.showPartyHud !== false);
        ui.unifiedCompanionHud.style.display = visible ? 'block' : 'none';
        if (!visible) {
          ui.unifiedHudFrames.innerHTML = '';
          ui.unifiedHudFrames.dataset.signature = '';
          if (ui.unifiedCompanionHud) ui.unifiedCompanionHud.classList.remove('petOnly');
          const headerLabel = ui.unifiedCompanionHud?.querySelector?.('[data-unified-hud-title]');
          if (headerLabel) headerLabel.textContent = 'Party / Companions';
          if (ui.unifiedHudMeta) ui.unifiedHudMeta.textContent = 'Solo';
          return;
        }
        if (options.resourcesOnly === true) {
          this.updateUnifiedCompanionHudResourceBars?.(entries);
          return;
        }
        const signature = this.unifiedCompanionHudStructureSignature?.(entries) || this.unifiedCompanionHudSignature?.(entries) || '';
        if (!options.force && ui.unifiedHudFrames.dataset.signature === signature) {
          this.updateUnifiedCompanionHudResourceBars?.(entries);
          return;
        }
        ui.unifiedHudFrames.innerHTML = entries.map(entry => this.companionHudFrame(entry)).join('');
        recordUiWrite('html');
        ui.unifiedHudFrames.dataset.signature = signature;
        const petOnly = entries.length === 1 && entries[0]?.kind === 'pet';
        if (ui.unifiedCompanionHud) {
          const before = ui.unifiedCompanionHud.classList.contains('petOnly');
          ui.unifiedCompanionHud.classList.toggle('petOnly', petOnly);
          if (before !== petOnly) recordUiWrite('class');
        }
        const headerLabel = ui.unifiedCompanionHud?.querySelector?.('[data-unified-hud-title]');
        if (headerLabel) setText(headerLabel, petOnly ? 'Pet Command' : 'Party / Companions');
        if (ui.unifiedHudMeta) {
          if (petOnly) {
            const pet = this.pet;
            setText(ui.unifiedHudMeta, pet?.alive === false ? 'Downed' : String(pet?.command || 'assist'));
          } else {
            const partyCount = this.partyCapacityCount?.() || 1;
            const companionCount = entries.filter(entry => entry.kind === 'merc' || entry.kind === 'pet').length;
            setText(ui.unifiedHudMeta, `${partyCount}/${this.partyMaxSize?.() || DR.MAX_PARTY_SIZE || 6} party slots${companionCount ? ` · ${companionCount} auxiliary` : ''}`);
          }
        }
        this.updateUnifiedCompanionHudResourceBars?.(entries);
      };

      Game.prototype.toggleMap = function(force) {
        this.mapOpen = typeof force === 'boolean' ? force : !this.mapOpen;
        ui.mapOverlay.style.display = this.mapOpen ? 'block' : 'none';
        // V0.18.3: hide gameplay chrome while the world map is open (CSS body.worldMapOpen)
        // so nothing (HUD / hotbar / minimap / party) draws on top of the map.
        document.body?.classList?.toggle('worldMapOpen', !!this.mapOpen);
        if (this.mapOpen) {
          this.ensureMapUiBindings?.();
          this.drawWorldMap();
        } else if (this.mapView) {
          this.mapView.dragging = false;
          this.mapView.hoverMarker = null;
        }
      };

      Game.prototype.togglePartyPanel = function(force) {
        this.partyOpen = typeof force === 'boolean' ? force : !this.partyOpen;
        ui.partyPanel.style.display = this.partyOpen ? 'block' : 'none';
        if (this.partyOpen) this.renderPartyPanel();
      };

      Game.prototype.centerMenuPanel = function() {
        if (!ui.menuPanel) return;
        if (ui.menuPanel.dataset.userPositioned === 'true' || this.applyUiWindowStoredPosition?.(ui.menuPanel)) {
          ui.menuPanel.style.zIndex = '40';
          return;
        }
        ui.menuPanel.style.position = 'fixed';
        ui.menuPanel.style.left = '50%';
        ui.menuPanel.style.top = '50%';
        ui.menuPanel.style.right = 'auto';
        ui.menuPanel.style.bottom = 'auto';
        ui.menuPanel.style.transform = 'translate(-50%, -50%)';
        ui.menuPanel.style.zIndex = '40';
      };

      Game.prototype.toggleMenu = function(force) {
        this.ensureMenuButtonOwnership?.();
        this.menuOpen = typeof force === 'boolean' ? force : !this.menuOpen;
        if (ui.menuPanel) {
          ui.menuPanel.style.display = this.menuOpen ? 'block' : 'none';
          if (this.menuOpen) this.centerMenuPanel?.();
        }
      };

      Game.prototype.toggleCharacterPanel = function(force) {
        this.characterPanelOpen = typeof force === 'boolean' ? force : !this.characterPanelOpen;
        if (ui.characterPanel) ui.characterPanel.style.display = this.characterPanelOpen ? 'block' : 'none';
        if (this.characterPanelOpen) this.renderCharacterPanel();
      };

      Game.prototype.toggleSpellPanel = function(force) {
        this.spellPanelOpen = typeof force === 'boolean' ? force : !this.spellPanelOpen;
        if (ui.spellPanel) ui.spellPanel.style.display = this.spellPanelOpen ? 'block' : 'none';
        if (this.spellPanelOpen) this.renderSpellPanel();
      };

      Game.prototype.toggleSettingsPanel = function(force) {
        this.settingsPanelOpen = typeof force === 'boolean' ? force : !this.settingsPanelOpen;
        if (ui.settingsPanel) ui.settingsPanel.style.display = this.settingsPanelOpen ? 'block' : 'none';
        if (this.settingsPanelOpen) this.renderSettingsPanel();
      };

      Game.prototype.ensureSettingsList = function() {
        let list = document.getElementById('settingsList') || ui.settingsList;
        if (list) {
          ui.settingsList = list;
          return list;
        }
        const panel = ui.settingsPanel || document.getElementById('settingsPanel');
        if (!panel) return null;
        list = document.createElement('div');
        list.id = 'settingsList';
        panel.appendChild(list);
        ui.settingsList = list;
        return list;
      };

      Game.prototype.applyUiPreferences = function() {
        const incoming = this.uiPrefs && typeof this.uiPrefs === 'object' ? this.uiPrefs : {};
        const prefs = this.uiPrefs = {
          ...incoming,
          showMinimap: incoming.showMinimap !== false,
          showMercPanel: incoming.showMercPanel !== false,
          showPartyHud: incoming.showPartyHud !== false
        };
        if (ui.minimapWrap) ui.minimapWrap.style.display = prefs.showMinimap ? 'block' : 'none';
        if (ui.mercPanel) ui.mercPanel.style.display = 'none';
        if (ui.partyHud) ui.partyHud.style.display = 'none';
        if (ui.unifiedCompanionHud && !prefs.showMercPanel && !prefs.showPartyHud) ui.unifiedCompanionHud.style.display = 'none';
        const legacyPetPanel = this._legacyPetCommandPanel || (this._legacyPetCommandPanel = document.getElementById('petCommandPanel'));
        if (legacyPetPanel) legacyPetPanel.style.display = 'none';
      };

      Game.prototype.renderCharacterPanel = function() {
        if (!this.player || !ui.characterStats) return;
        this.ensureEquipmentSlots?.();
        const cls = CLASSES[this.player.className] || {};
        const className = String(this.player.className || 'Adventurer');
        const gender = String(this.player.gender || 'male');
        const level = Math.floor(this.player.level || 1);
        applyClassHudVisualStyle(ui.characterPanel, className);
        if (ui.closeCharacterBtn) {
          ui.closeCharacterBtn.textContent = 'X';
          ui.closeCharacterBtn.setAttribute('aria-label', 'Close character window');
          ui.closeCharacterBtn.title = 'Close character window';
          ui.closeCharacterBtn.classList.add('ornateCloseButton');
        }
        const slotsLeft = ['head', 'shoulders', 'chest', 'belt', 'legs', 'hands', 'feet', 'cape'];
        const slotsRight = ['amulet', 'earring1', 'earring2', 'ring1', 'ring2', 'weapon', 'offhand', 'charm'];
        const slotGlyphs = {
          head: '♜', shoulders: '◆', chest: '▣', belt: '═', legs: '▥', hands: '✋', feet: '▰', cape: '♘',
          amulet: '♢', earring1: '⌘', earring2: '⌘', ring1: '○', ring2: '○', weapon: '⚔', offhand: '◈', charm: '✦'
        };
        const statGlyphs = {
          'Gear Score': '🛡', Damage: '⚔', HP: '♥', Mana: '💧', Armor: '⬟', CDR: '⌛',
          'Phys Crit': '✦', 'Magic Crit': '✣', 'Phys Output': '🗡', 'Magic Output': '✹', Healing: '✚',
          Speed: '羽', Attributes: '♜', Status: '♛'
        };
        const cleanSlotLabel = slot => `${((DR.SLOT_LABELS || {})[slot] || slot || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())} Slot`;
        const summarizeEquippedItemStats = item => {
          const stats = this.equipmentComparisonStats?.(item) || this.normalizeItemStats?.(item) || item?.stats || {};
          const lines = [];
          const push = (label, value, suffix = '') => {
            const n = Number(value);
            if (Number.isFinite(n) && n !== 0) lines.push(`${label} ${n > 0 ? '+' : ''}${Number.isInteger(n) ? n : n.toFixed(2)}${suffix}`);
          };
          const damage = item?.damage && typeof item.damage === 'object' ? item.damage : null;
          if (damage && (Number.isFinite(Number(damage.min)) || Number.isFinite(Number(damage.max)))) lines.push(`Damage ${Number(damage.min || 0)}-${Number(damage.max || 0)}`);
          else if (Number.isFinite(Number(item?.minDamage)) || Number.isFinite(Number(item?.maxDamage))) lines.push(`Damage ${Number(item.minDamage || 0)}-${Number(item.maxDamage || 0)}`);
          push('Armor', stats.armor ?? item?.armor);
          push('HP', stats.hp ?? stats.maxHp);
          push('Mana', stats.mana ?? stats.maxMana);
          push('Atk', stats.attack ?? stats.damage);
          push('Def', stats.defense);
          push('STR', stats.strength);
          push('DEX', stats.dexterity);
          push('STA', stats.stamina);
          push('INT', stats.intelligence);
          push('WIS', stats.wisdom);
          if (Number.isFinite(Number(stats.speed)) && Number(stats.speed) !== 0) lines.push(`Speed ${Number(stats.speed) > 0 ? '+' : ''}${Number(stats.speed).toFixed(2)}`);
          return lines.slice(0, 4);
        };
        const slotCard = slot => {
          const item = this.equipment?.[slot] || null;
          const label = cleanSlotLabel(slot);
          const glyph = slotGlyphs[slot] || '◇';
          if (!item) {
            return `<div class="equipSlot sheetSlot emptyEquipSlot ornateEquipSlot" data-slot="${escapeHtml(slot)}"><div class="equipmentSlotGlyph" aria-hidden="true">${escapeHtml(glyph)}</div><div class="equipmentSlotCopy"><span class="slotLabel">${escapeHtml(label)}</span><span class="itemName emptyName">Empty</span></div></div>`;
          }
          const rarity = this.itemRarityInfo?.(item) || item.rarity || { color: item.icon?.color || '#cfdac8' };
          const color = rarity.color || item.icon?.color || '#cfdac8';
          const icon = this.itemIconHtml?.(item, 'equipIcon generatedIcon') || `<div class="equipIcon generatedIcon">${escapeHtml(glyph)}</div>`;
          const statLines = summarizeEquippedItemStats(item);
          return `<div class="equipSlot sheetSlot itemSlot cleanEquipSlot ornateEquipSlot largeIconEquipSlot" data-slot="${escapeHtml(slot)}" data-tooltip-slot="${escapeHtml(slot)}" style="--rarity-color:${escapeHtml(color)};--icon-color:${escapeHtml(color)}" title="${escapeHtml(this.itemTooltip(item))}"><div class="slotItemRow equippedItemHeader">${icon}<div class="equipmentSlotCopy"><span class="slotLabel">${escapeHtml(label)}</span><span class="itemName">${escapeHtml(item.name || 'Equipped Item')}</span></div></div>${statLines.length ? `<div class="slotStats compactSlotStats">${statLines.map(line => `<span>${escapeHtml(line)}</span>`).join('')}</div>` : '<div class="slotStats compactSlotStats"><span>No stats</span></div>'}</div>`;
        };
        const gearTotals = Object.values(this.equipment || {}).reduce((acc, item) => {
          if (!item) return acc;
          for (const [key, value] of Object.entries(item.stats || {})) acc.stats[key] = (acc.stats[key] || 0) + Number(value || 0);
          if (item.armor && !item.stats?.armor) acc.stats.armor = (acc.stats.armor || 0) + Number(item.armor || 0);
          return acc;
        }, { stats: {} });
        const equipmentBonuses = this.normalizeItemStats?.(gearTotals) || { hp: 0, mana: 0, attack: 0, defense: 0, speed: 0 };
        const attrs = this.player.attributes || {};
        const pct = value => `${Math.round((Number(value) || 0) * 100)}%`;
        const mult = value => `${Math.round((Number(value) || 1) * 100)}%`;
        const gear = key => equipmentBonuses[key] || 0;
        const signed = (value, digits = 0) => {
          const n = Number(value) || 0;
          const out = digits ? n.toFixed(digits) : String(Math.round(n));
          return `${n >= 0 ? '+' : ''}${out}`;
        };
        const activeStatusText = (this.player.buffs || []).filter(effect => Number(effect.remaining || effect.duration || 0) > 0).map(effect => `${effect.name}${effect.stacks > 1 ? ` x${effect.stacks}` : ''}`).join(' · ') || 'None';
        const gearScore = Math.max(0, Math.floor(Number(this.recalculatePlayerGearScore?.(this.player) ?? this.player.gearScore ?? 0)));
        // V0.18.90 (Roadmap Item 14): per-source breakdown tooltip. Reuses the same aggregator sources
        // as recalculatePlayerStats via getPlayerStatBreakdown(), so the card tooltip is faithful.
        const breakdown = this.getPlayerStatBreakdown?.() || null;
        const bdTitle = (key, finalLabel) => {
          if (!breakdown) return '';
          const src = breakdown.sources || {};
          const label = { trainer: 'Trainer', talents: 'Talents', equipment: 'Equipment', set: 'Set Bonus' };
          const parts = [];
          for (const s of ['equipment', 'talents', 'trainer', 'set']) {
            const v = Number(src[s]?.[key] || 0);
            if (v) parts.push(`${label[s]} ${signed(v, key === 'speed' ? 2 : 0)}`);
          }
          const fin = Number(breakdown.final?.[key] || 0);
          const finTxt = key === 'speed' ? fin.toFixed(2) : Math.round(fin);
          const contrib = parts.length ? parts.join(' · ') : 'no gear/skill/set contribution';
          return `${finalLabel} breakdown — base class + level scaling, then: ${contrib}. Final ${finTxt}.`;
        };
        const stats = [
          ['Gear Score', gearScore, 'same equipped-item formula used by bots'],
          ['Damage', Math.round(this.player.attack || 0), `STR scaling · Gear ${signed(gear('attack'))}`, bdTitle('attack', 'Damage')],
          ['HP', Math.ceil(this.player.maxHp || 0), `STA scaling · Gear ${signed(gear('hp'))}`, bdTitle('hp', 'HP')],
          ['Mana', Math.ceil(this.player.maxMana || 0), `INT/WIS scaling · Gear ${signed(gear('mana'))}`, bdTitle('mana', 'Mana')],
          ['Armor', `${Math.floor(this.player.armor || this.player.defense || 0)}`, `${pct(this.player.armorReduction)} DR · cap ${pct(DR.STAT_RULES?.armor?.cap ?? 0.68)}`, bdTitle('armor', 'Armor')],
          ['CDR', pct(this.player.cooldownReduction), `Rating ${Math.round(this.player.derivedStats?.cooldownReductionRating || 0)} · cap ${pct(DR.STAT_RULES?.cooldownReduction?.cap ?? 0.40)}`],
          ['Phys Crit', pct(this.player.critChance), `${Math.round((this.player.critDamageMultiplier || 1.5) * 100)}% crit dmg`],
          ['Magic Crit', pct(this.player.magicCritChance), `${Math.round((this.player.magicCritDamageMultiplier || 1.5) * 100)}% crit dmg`],
          ['Phys Output', mult(this.player.physicalDamageMultiplier), 'STR/DEX + gear power'],
          ['Magic Output', mult(this.player.magicDamageMultiplier), 'INT/WIS + spell power'],
          ['Healing', mult(this.player.healingMultiplier), 'WIS/INT + heal power'],
          ['Speed', Math.round((this.player.speed || 0) * 10), `DEX scaling · Gear ${signed(gear('speed'), 2)}`, bdTitle('speed', 'Speed')],
          ['Attributes', `STR ${attrs.strength || 0} · DEX ${attrs.dexterity || 0}`, `STA ${attrs.stamina || 0} · INT ${attrs.intelligence || 0} · WIS ${attrs.wisdom || 0}`],
          ['Status', activeStatusText, 'Buff/debuff owner: StatusEffectSystem']
        ];
        const statCardMarkup = ([label, value, sub, title]) => `<div class="statCard ornateStatCard"${title ? ` title="${escapeHtml(title)}"` : ''}><div class="statCardIcon" aria-hidden="true">${escapeHtml(statGlyphs[label] || '✦')}</div><div class="statCardCopy"><strong>${escapeHtml(label)}</strong><div class="statValue">${escapeHtml(String(value))}</div><div class="small">${escapeHtml(sub)}</div></div></div>`;
        ui.characterStats.innerHTML = `
          <div class="characterSheet ornateCharacterSheet">
            <section class="sheetPanel characterModelPanel ornateSheetPanel">
              <div class="sheetPanelTitle ornateTitle"><span>Character Model</span></div>
              <div class="paperDollLayout ornatePaperDollLayout">
                <div class="equipColumn leftEquipColumn">${slotsLeft.map(slotCard).join('')}</div>
                <div class="dollCenter modelOnlyCenter ornateModelStage">
                  <div class="modelArcaneRing" aria-hidden="true"></div>
                  ${this.paperDollMarkup?.() || ''}
                  <div class="modelPedestal" aria-hidden="true"></div>
                </div>
                <div class="equipColumn rightEquipColumn">${slotsRight.map(slotCard).join('')}</div>
              </div>
            </section>
            <section class="sheetPanel characterStatsPanel ornateSheetPanel">
              <div class="sheetPanelTitle ornateTitle"><span>Character Stats</span></div>
              <div class="statHeader ornateStatHeader">
                ${classEmblemMarkup(className, { size: 132, className: 'sheetClassEmblem largeSheetClassEmblem', title: `${className} emblem` })}
                <div class="characterStatIdentity"><div class="name">${escapeHtml(this.player.name)}</div><div class="small">Level ${level} ${escapeHtml(gender)} ${escapeHtml(className)}</div></div>
                <div class="playerGearScoreBadge"><span>Gear Score</span><strong>${escapeHtml(String(gearScore))}</strong></div>
              </div>
              <div class="statGrid ornateStatGrid">${stats.map(statCardMarkup).join('')}</div>
              <div class="setBonusBox ornateSetBonus"><div class="sheetPanelTitle compactTitle"><span>Set Bonuses</span></div>${(() => {
                // V0.18.88 (Roadmap Item 4 D): show any armour set the player has at least one piece of,
                // with equipped count and whether the full-set bonus is active.
                const sets = window.DreamRealms?.ARMOR_SETS || {};
                const lines = [];
                for (const key of Object.keys(sets)) {
                  const set = sets[key];
                  const total = set.pieceIds?.length || 0;
                  const have = this.equippedArmorSetCount?.(key) || 0;
                  if (have <= 0) continue;
                  const active = total > 0 && have >= total;
                  lines.push(`<div class="small"><strong>${escapeHtml(set.name)}</strong> (${have}/${total})<br><span style="opacity:${active ? 1 : 0.5}">${active ? '● ' : '○ '}${escapeHtml(set.bonusText || '')}</span></div>`);
                }
                return lines.length ? lines.join('') : '<div class="small">No active set bonuses.</div>';
              })()}</div>
            </section>
          </div>`;
        applyClassHudVisualStyle(ui.characterPanel, className);
        this.renderPaperDollClassModel?.(ui.characterStats);
        ui.characterStats.querySelectorAll('[data-slot]').forEach(node => {
          node.addEventListener('contextmenu', e => { e.preventDefault(); this.unequipSlot?.(node.dataset.slot); });
          node.addEventListener('dblclick', () => this.unequipSlot?.(node.dataset.slot));
        });
        this.bindItemTooltips?.(ui.characterStats, node => this.equipment?.[node.dataset.tooltipSlot] || null, { source: 'equipped', compare: false });
      };

      Game.prototype.renderHotbarCombatState = function() {
        if (!this.player || !ui.spellSlots) return;
        const meditateBtn = this._meditateButton || (this._meditateButton = document.getElementById('steamDeckMeditateBtn'));
        if (meditateBtn) {
          const meditating = Boolean(this.actorIsMeditating?.(this.player) || this.player.meditating || this.player.isMeditating);
          const unavailable = Boolean(!this.started || this.paused || this.player.alive === false || Number(this.player.hp || 0) <= 0);
          const signature = `${meditating ? 1 : 0}:${unavailable ? 1 : 0}`;
          if (meditateBtn.dataset.stateSignature !== signature) {
            meditateBtn.dataset.stateSignature = signature;
            setClassToggle(meditateBtn, 'meditateActive', meditating);
            setClassToggle(meditateBtn, 'meditateDisabled', unavailable);
            if (unavailable) setClassToggle(meditateBtn, 'meditatePressed', false);
            setDisabled(meditateBtn, unavailable);
            meditateBtn.setAttribute('aria-pressed', meditating ? 'true' : 'false');
            meditateBtn.setAttribute('aria-disabled', unavailable ? 'true' : 'false');
            meditateBtn.title = unavailable ? 'Meditation is unavailable right now.' : (meditating ? 'Meditating. Click or press R to stop.' : 'Meditate. Click or press R to begin resting.');
            setText(meditateBtn, meditating ? 'Meditating' : 'Meditate');
          }
        }
        const autoSlot = this._autoAttackSlot || (this._autoAttackSlot = document.querySelector('.autoAttackSlot'));
        if (autoSlot) {
          const active = Boolean(this.player.autoAttack === true);
          if (autoSlot.dataset.autoAttackActive !== (active ? '1' : '0')) {
            autoSlot.dataset.autoAttackActive = active ? '1' : '0';
            setClassToggle(autoSlot, 'autoAttackActive', active);
            autoSlot.setAttribute('aria-pressed', active ? 'true' : 'false');
            autoSlot.title = active ? 'Auto attack is ON. Press 1 again to stop attacking.' : 'Auto attack is OFF. Press 1 to attack your selected or nearest enemy.';
            const label = autoSlot.querySelector('.actionName');
            setText(label, active ? 'Auto On' : 'Auto Off');
          }
        }
        const spellSlots = ui.spellSlots || [];
        const spells = this.getClassSpells?.(this.player.className) || [];
        const mana = Number(this.player.mana || 0);
        const spellResourceShort = this.spellResourceShortLabel?.(this.player.className) || 'MP';
        this._hotbarRuntimeNodes = this._hotbarRuntimeNodes || [];
        for (let index = 0; index < spellSlots.length; index++) {
          const label = spellSlots[index];
          const slot = label?.closest?.('.slot');
          if (!slot) continue;
          let cached = this._hotbarRuntimeNodes[index];
          if (!cached || cached.slot !== slot) {
            let cdBar = slot.querySelector('.slotCooldown');
            if (!cdBar) {
              cdBar = document.createElement('div');
              cdBar.className = 'slotCooldown';
              slot.appendChild(cdBar);
            }
            let readout = slot.querySelector('.slotReadout');
            if (!readout) {
              readout = document.createElement('div');
              readout.className = 'slotReadout';
              slot.appendChild(readout);
            }
            cached = this._hotbarRuntimeNodes[index] = { slot, cdBar, readout, cooldownPct: '', readoutText: '', cooldown: false, oom: false, disabled: false };
          }
          // V0.17.71 BUG 1: slot -> assigned spell (not slot-index === spell-index);
          // cooldown is keyed by the resolved book index so shared spells share cd.
          const spell = this.hotbarSlotSpell?.(index) || null;
          const resolvedIdx = this.hotbarSlotSpellIndex?.(index) ?? -1;
          const cooldown = Math.max(0, Number((resolvedIdx >= 0 ? this.player.spellCooldowns?.[resolvedIdx] : 0) || 0));
          const maxCooldown = Math.max(0.01, Number(spell?.cooldown || cooldown || 1));
          const cost = Math.floor(spell?.cost || 0);
          const disabled = !spell;
          const cooling = Boolean(spell && cooldown > 0);
          const oom = Boolean(spell && cost > mana);
          const cooldownRatio = cooling ? Math.max(0, Math.min(1, cooldown / maxCooldown)) : 0;
          const nextPct = cooldownRatio.toFixed(3);
          const nextReadout = disabled ? '' : (cooling ? `${cooldown.toFixed(1).replace(/\.0$/, '')}s` : (cost > 0 ? `${cost} ${spellResourceShort}` : ''));
          if (cached.cooldownPct !== nextPct) {
            cached.cooldownPct = nextPct;
            cached.cdBar.style.setProperty('--cooldown-pct', nextPct);
            recordUiWrite('style');
          }
          if (cached.readoutText !== nextReadout) {
            cached.readoutText = nextReadout;
            setText(cached.readout, nextReadout);
          }
          if (cached.cooldown !== cooling) { cached.cooldown = cooling; setClassToggle(slot, 'cooldown', cooling); }
          if (cached.oom !== oom) { cached.oom = oom; setClassToggle(slot, 'oom', oom); }
          if (cached.disabled !== disabled) { cached.disabled = disabled; setClassToggle(slot, 'disabledTurn', disabled); }
          setClassToggle(slot, 'readyTurn', false);
        }
      };

      Game.prototype.renderSpellPanel = function() {
        if (!ui.spellList || !this.player) return;
        const spellSlots = this.getClassSpells?.(this.player.className) || [];
        const spells = spellSlots.filter(Boolean);
        if (ui.spellSummary) ui.spellSummary.textContent = `${this.player.className} spellbook · ${spells.length} assigned`; 
        ui.spellList.innerHTML = spells.map((spell, index) => {
          const cost = Math.floor(spell?.cost || 0);
          const resourceLabel = this.spellResourceLabel?.(spell) || 'Mana';
          const cooldown = Number(spell?.cooldown || 0).toFixed(1).replace(/\.0$/, '');
          const durationText = this.formatSpellDuration?.(spell?.duration || spell?.tickDuration || 0);
          const durationMeta = durationText ? ` · Duration ${durationText}` : '';
          const rangeMeta = spell?.range != null ? ` · Range ${Number(spell.range).toFixed(1).replace(/\.0$/, '')}` : '';
          const radiusMeta = spell?.radius != null ? ` · Radius ${Number(spell.radius).toFixed(1).replace(/\.0$/, '')}` : '';
          const castMeta = spell?.instant === true || Number(spell?.castTime || 0) <= 0 ? ' · Cast Instant' : ` · Cast ${Number(spell.castTime).toFixed(1).replace(/\.0$/, '')}s`;
          const keyLabel = index < 9 ? String(index + 2).replace('10', '0') : `Lv ${Math.max(1, Math.floor(Number(spell?.levelRequirement || index + 1)))}`;
          const icon = this.spellIconHtml?.(spell, 'spellBookIcon') || '';
          return `<div class="spellEntry" title="${escapeHtml(this.spellTooltipText?.(spell) || '')}"><div class="spellEntryHeader">${icon}<div><strong>${escapeHtml(keyLabel)}. ${escapeHtml(spell.name || `Spell ${index + 1}`)}</strong><div class="small">${escapeHtml(spell.description || 'No description.')}</div></div></div><div class="small">${escapeHtml(resourceLabel)} ${cost} · Cooldown ${cooldown}s${castMeta}${rangeMeta}${radiusMeta}${durationMeta} · ${escapeHtml(spell.category || spell.kind || 'spell')}</div></div>`;
        }).join('') || '<div class="small">No spells assigned.</div>';
      };


      Game.prototype.queueSettingsPanelRender = function(reason = 'settings control') {
        if (this.__drSettingsRenderQueued) return;
        this.__drSettingsRenderQueued = true;
        window.setTimeout(() => {
          this.__drSettingsRenderQueued = false;
          if (this.settingsPanelOpen) this.renderSettingsPanel?.();
          this.markUiDirty?.(reason);
        }, 0);
      };

      Game.prototype.settingsControlHandled = function(event, options = {}) {
        event.preventDefault?.();
        event.stopPropagation?.();
        event.stopImmediatePropagation?.();
        if (options.rerender !== false) this.queueSettingsPanelRender?.(options.reason || 'settings control');
        return true;
      };

      Game.prototype.handleSettingsPanelClick = function(event) {
        const list = this.ensureSettingsList?.() || ui.settingsList || document.getElementById('settingsList');
        if (!list || !list.contains(event.target)) return false;
        const el = event.target.closest?.('button, [role="button"]');
        if (!el || !list.contains(el)) return false;
        const d = el.dataset || {};
        const call = (method, ...args) => { try { return this?.[method]?.(...args); } catch (err) { this.recordRuntimeSystemFault?.({ id: 'settings-controls-binding-fix' }, method, err); return undefined; } };
        const handled = (rerender = true, reason = 'settings click') => this.settingsControlHandled?.(event, { rerender, reason });

        if (d.settingKey) {
          const prefs = this.uiPrefs || (this.uiPrefs = this.defaultUiPrefs?.() || { showMinimap: true, showMercPanel: true, showPartyHud: true });
          prefs[d.settingKey] = !prefs[d.settingKey];
          call('applyUiPreferences');
          // V0.20.18: and remember it. This is the only place a UI pref changes, so it is the only
          // place that needs to save - the toggle was applied and then forgotten on every reload.
          call('saveUiPrefs');
          return handled(true, 'hud setting');
        }
        if (d.performancePreset) { call('setPerformancePreset', d.performancePreset, { reason: 'settings panel' }); return handled(true, 'performance preset'); }
        if ('performanceLowSpec' in d) { call('toggleLowSpecPerformanceMode'); return handled(true, 'low spec toggle'); }
        if ('renderBackendToggle' in d) { call('toggleRenderBackendMode'); return handled(true, 'render backend toggle'); }
        if ('renderWebglVisibleTerrain' in d) { call('toggleWebglVisibleTerrainLayer'); return handled(true, 'terrain layer toggle'); }
        if ('renderWebglVisibleSprites' in d) { call('toggleWebglVisibleSpriteLayer'); return handled(true, 'sprite layer toggle'); }
        if ('renderWebglVisibleEffects' in d) { call('toggleWebglVisibleEffectLayer'); return handled(true, 'effect layer toggle'); }
        if ('renderWebglVisibleDamageText' in d) { call('toggleWebglVisibleDamageTextLayer'); return handled(true, 'damage text layer toggle'); }
        if ('renderWebglScenePreview' in d) { call('toggleWebglScenePreviewOverlay'); return handled(true, 'scene preview toggle'); }
        if (d.renderWebglSceneLayer) { call('toggleWebglScenePreviewLayer', d.renderWebglSceneLayer); return handled(true, 'scene preview layer toggle'); }
        if ('performanceBenchmark' in d) { call('togglePerformanceBenchmark'); return handled(false, 'benchmark toggle'); }
        if ('performanceExport' in d) { call('exportLastBenchmarkReport'); return handled(false, 'benchmark export'); }
        if ('performanceCopy' in d) { call('copyBenchmarkSummary'); return handled(false, 'benchmark copy'); }
        if ('performanceReset' in d) { call('resetPerformanceSettings'); return handled(true, 'performance reset'); }
        if ('hybridQaReset' in d) { call('clearHybridRendererQaHoldoffs', 'settings panel'); return handled(true, 'hybrid qa reset'); }

        if (d.audioMute) { call('toggleAudioMute', d.audioMute); return handled(true, 'audio mute'); }
        if ('audioTest' in d) { call('unlockAudioSystem'); call('playSfx', 'ui_select', { volume: 0.45, cooldown: 0 }); return handled(false, 'audio test'); }
        if ('audioTestAmbient' in d) { call('unlockAudioSystem'); call('playAudioEvent', 'forest_wind', { volume: 0.32, cooldown: 0, channel: 'ambient' }); return handled(false, 'ambient test'); }
        if (d.audioTestMusic) { call('testAudioMusicScene', d.audioTestMusic); return handled(false, 'music test'); }
        if ('resetAudio' in d) { call('resetAudioSettings'); return handled(true, 'audio reset'); }
        if (d.keybindAction) { call('beginKeyRebind', d.keybindAction); return handled(true, 'keybind begin'); }
        if ('resetKeybinds' in d) { call('resetKeyBindings'); return handled(true, 'keybind reset'); }

        if ('dpsSettingsToggle' in d) { call('toggleDpsMeter'); return handled(true, 'dps toggle'); }
        if (d.dpsSettingsWindow != null) { call('setDpsMeterWindow', Number(d.dpsSettingsWindow)); return handled(true, 'dps window'); }
        if ('dpsSettingsReset' in d) { call('resetDpsMeter', 'settings reset'); return handled(true, 'dps reset'); }
        if ('dpsSettingsPopout' in d) { call('showDpsMeter'); return handled(true, 'dps open'); }

        if (d.renderPlayerProfile) { call('setRendererPlayerProfile', d.renderPlayerProfile || 'auto', 'settings panel'); return handled(true, 'renderer profile'); }
        if ('performanceSettingsAdvanced' in d) { call('togglePerformanceSettingsAdvanced'); return handled(true, 'advanced settings toggle'); }
        if ('renderResetAuto' in d) { call('resetRendererPerformanceAuto'); return handled(true, 'renderer reset auto'); }
        if ('renderClearRollbacks' in d) { call('clearRendererRollbacksAndHolds'); return handled(true, 'renderer clear rollbacks'); }
        if ('performanceSettingsExport' in d) { call('exportRendererHealthJson'); return handled(false, 'renderer export'); }

        if ('hybridApplyDefaultCandidate' in d) { call('applyHybridDefaultCandidateProfile', 'settings apply'); return handled(true, 'hybrid apply candidate'); }
        if ('hybridResetCanvasStable' in d) { call('resetHybridRendererCompatibility'); return handled(true, 'hybrid canvas reset'); }
        if ('hybridDefaultRolloutToggle' in d) { call('toggleHybridDefaultRollout'); return handled(true, 'hybrid rollout toggle'); }
        if (d.hybridRolloutPolicy) { call('setHybridDefaultRolloutPolicy', d.hybridRolloutPolicy, 'settings panel'); return handled(true, 'hybrid rollout policy'); }
        if ('hybridRolloutForce' in d) { call('forceHybridDefaultRollout', 'settings panel'); return handled(true, 'hybrid rollout force'); }
        if ('hybridRolloutRollback' in d) { call('triggerHybridDefaultRolloutRollback', 'settings panel'); return handled(true, 'hybrid rollout rollback'); }
        if ('hybridRolloutClear' in d) { call('clearHybridDefaultRolloutRollback', 'settings panel'); return handled(true, 'hybrid rollout clear'); }
        if ('hybridHealthToggle' in d) { call('toggleHybridRolloutHealthMonitor'); return handled(true, 'hybrid health toggle'); }
        if ('hybridHealthExport' in d) { call('exportHybridRolloutHealthJson'); return handled(false, 'hybrid health export'); }
        if ('hybridHealthCopy' in d) { call('copyHybridRolloutHealthSummary'); return handled(false, 'hybrid health copy'); }
        if ('hybridHealthReset' in d) { call('resetHybridRolloutHealth'); return handled(true, 'hybrid health reset'); }
        if ('hybridFinalQaToggle' in d) { call('toggleHybridFinalQaGate'); return handled(true, 'hybrid final qa toggle'); }
        if ('hybridFinalQaRc' in d) { call('toggleHybridFinalQaReleaseCandidate'); return handled(true, 'hybrid final qa rc'); }
        if ('hybridFinalQaExport' in d) { call('exportHybridFinalQaJson'); return handled(false, 'hybrid final qa export'); }
        if ('hybridFinalQaCopy' in d) { call('copyHybridFinalQaSummary'); return handled(false, 'hybrid final qa copy'); }
        if ('hybridFinalQaClearBlocks' in d) { call('clearHybridFinalQaLayerBlocks'); return handled(true, 'hybrid final qa clear blocks'); }
        if ('hybridFinalQaReset' in d) { call('resetHybridFinalQa'); return handled(true, 'hybrid final qa reset'); }

        if ('stableRcToggle' in d) { call('toggleStableReleaseCandidateGate'); return handled(true, 'stable rc toggle'); }
        if ('stableRcArmed' in d) { call('toggleStableReleaseCandidateArmed'); return handled(true, 'stable rc armed'); }
        if ('stableRcExport' in d) { call('exportStableReleaseCandidateJson'); return handled(false, 'stable rc export'); }
        if ('stableRcCopy' in d) { call('copyStableReleaseCandidateSummary'); return handled(false, 'stable rc copy'); }
        if ('stableRcReset' in d) { call('resetStableReleaseCandidateSamples'); return handled(true, 'stable rc reset'); }
        if ('postReleaseToggle' in d) { call('togglePostReleaseCandidateHardening'); return handled(true, 'post release toggle'); }
        if ('postReleaseBenchmark' in d) { call('runPostReleaseBenchmark'); return handled(false, 'post release benchmark'); }
        if ('postReleaseExport' in d) { call('exportPostReleaseHardeningJson'); return handled(false, 'post release export'); }
        if ('postReleaseCopy' in d) { call('copyPostReleaseHardeningSummary'); return handled(false, 'post release copy'); }
        if ('postReleaseReset' in d) { call('resetPostReleaseCandidateHardening'); return handled(true, 'post release reset'); }
        if ('postReleaseClearLock' in d) { call('clearPostReleaseCanvasLock'); return handled(true, 'post release clear lock'); }
        if ('renderPolishToggle' in d) { call('toggleRendererReleasePolish'); return handled(true, 'render polish toggle'); }
        if ('renderPolishExport' in d) { call('exportRendererReleasePolishJson'); return handled(false, 'render polish export'); }
        if ('renderPolishCopy' in d) { call('copyRendererReleasePolishSummary'); return handled(false, 'render polish copy'); }
        if ('renderPolishReset' in d) { call('resetRendererReleasePolish'); return handled(true, 'render polish reset'); }
        if ('renderPolishClear' in d) { call('clearRendererReleaseSafetyState'); return handled(true, 'render polish clear'); }
        if ('stableReleaseLockToggle' in d) { call('togglePerformanceStableReleaseLock'); return handled(true, 'stable release lock toggle'); }
        if ('stableReleaseModeToggle' in d) { call('togglePerformanceStableReleaseMode'); return handled(true, 'stable release mode toggle'); }
        if ('stableReleaseExport' in d) { call('exportPerformanceStableReleaseLockJson'); return handled(false, 'stable release export'); }
        if ('stableReleaseCopy' in d) { call('copyPerformanceStableReleaseLockSummary'); return handled(false, 'stable release copy'); }
        if ('stableReleaseReset' in d) { call('resetPerformanceStableReleaseLock'); return handled(true, 'stable release reset'); }
        if ('stableReleaseClear' in d) { call('clearPerformanceStableReleaseSafetyState'); return handled(true, 'stable release clear'); }

        if ('finalPerformanceQaToggle' in d) { call('toggleFinalPerformanceQaPatch'); return handled(true, 'final performance qa toggle'); }
        if ('finalPerformanceQaBenchmark' in d) { call('runFinalPerformanceReleaseBenchmark', 60); return handled(false, 'final performance qa benchmark'); }
        if ('finalPerformanceQaExport' in d) { call('exportFinalPerformanceQaPatchJson'); return handled(false, 'final performance qa export'); }
        if ('finalPerformanceQaCopy' in d) { call('copyFinalPerformanceQaPatchSummary'); return handled(false, 'final performance qa copy'); }
        if ('finalPerformanceQaClear' in d) { call('clearFinalPerformanceQaPatch'); return handled(true, 'final performance qa clear'); }
        if ('finalPerformanceQaCanvas' in d) { call('forceFinalPerformanceCanvasSafeMode', 'settings force'); return handled(true, 'final performance qa canvas'); }
        if ('releaseManifestToggle' in d) { call('toggleReleaseManifestChecklist'); return handled(true, 'release manifest toggle'); }
        if ('releaseManifestBenchmark' in d) { call('runReleaseManifestBenchmark', 60); return handled(false, 'release manifest benchmark'); }
        if ('releaseManifestExportJson' in d) { call('exportReleaseManifestChecklistJson'); return handled(false, 'release manifest json'); }
        if ('releaseManifestExportText' in d) { call('exportReleaseManifestChecklistText'); return handled(false, 'release manifest text'); }
        if ('releaseManifestCopy' in d) { call('copyReleaseManifestChecklistSummary'); return handled(false, 'release manifest copy'); }
        if ('releaseManifestClear' in d) { call('clearReleaseManifestChecklist'); return handled(true, 'release manifest clear'); }
        if ('finalShipToggle' in d) { call('toggleFinalShipCleanup'); return handled(true, 'final ship toggle'); }
        if ('finalShipBenchmark' in d) { call('runFinalShipBenchmark', 60); return handled(false, 'final ship benchmark'); }
        if ('finalShipExportJson' in d) { call('exportFinalShipCleanupJson'); return handled(false, 'final ship json'); }
        if ('finalShipExportText' in d) { call('exportFinalShipCleanupText'); return handled(false, 'final ship text'); }
        if ('finalShipCopy' in d) { call('copyFinalShipCleanupSummary'); return handled(false, 'final ship copy'); }
        if ('finalShipClear' in d) { call('clearFinalShipCleanup'); return handled(true, 'final ship clear'); }
        if ('finalShipClearSafety' in d) { call('clearFinalShipRendererSafetyState'); return handled(true, 'final ship clear safety'); }
        if ('launchValidationToggle' in d) { call('toggleLaunchValidationPackageAudit'); return handled(true, 'launch validation toggle'); }
        if ('launchValidationBenchmark' in d) { call('runLaunchValidationBenchmark', 60); return handled(false, 'launch validation benchmark'); }
        if ('launchValidationExportJson' in d) { call('exportLaunchValidationJson'); return handled(false, 'launch validation json'); }
        if ('launchValidationExportText' in d) { call('exportLaunchValidationText'); return handled(false, 'launch validation text'); }
        if ('launchValidationCopy' in d) { call('copyLaunchValidationSummary'); return handled(false, 'launch validation copy'); }
        if ('launchValidationClear' in d) { call('clearLaunchValidationPackageAudit'); return handled(true, 'launch validation clear'); }
        if ('finalGameplayQaToggle' in d) { call('toggleFinalGameplayQaFixes'); return handled(true, 'final gameplay qa toggle'); }
        if ('finalGameplayQaBenchmark' in d) { call('runFinalGameplayQaBenchmark', 60); return handled(false, 'final gameplay qa benchmark'); }
        if ('finalGameplayQaExportJson' in d) { call('exportFinalGameplayQaFixesJson'); return handled(false, 'final gameplay qa json'); }
        if ('finalGameplayQaExportText' in d) { call('exportFinalGameplayQaFixesText'); return handled(false, 'final gameplay qa text'); }
        if ('finalGameplayQaCopy' in d) { call('copyFinalGameplayQaFixesSummary'); return handled(false, 'final gameplay qa copy'); }
        if ('finalGameplayQaClear' in d) { call('clearFinalGameplayQaFixes'); return handled(true, 'final gameplay qa clear'); }
        if ('finalGameplayQaCanvas' in d) { call('forceFinalGameplayQaCanvasSafeMode', 'settings force'); return handled(true, 'final gameplay qa canvas'); }
        return false;
      };

      Game.prototype.handleSettingsPanelInput = function(event) {
        const list = this.ensureSettingsList?.() || ui.settingsList || document.getElementById('settingsList');
        if (!list || !list.contains(event.target)) return false;
        const renderInput = event.target.closest?.('[data-render-scale]');
        if (renderInput && list.contains(renderInput)) {
          event.preventDefault?.();
          event.stopPropagation?.();
          event.stopImmediatePropagation?.();
          const pct = Math.max(50, Math.min(100, Number(renderInput.value) || 100));
          try { this.setRenderResolutionScale?.(pct / 100, { log: false }); }
          catch (err) { this.recordRuntimeSystemFault?.({ id: 'settings-controls-binding-fix' }, 'setRenderResolutionScale', err); }
          const rv = renderInput.closest('.audioSliderWrap')?.querySelector('.audioValue');
          if (rv) rv.textContent = `${pct}%`;
          return true;
        }
        const input = event.target.closest?.('[data-audio-volume]');
        if (!input || !list.contains(input)) return false;
        event.preventDefault?.();
        event.stopPropagation?.();
        event.stopImmediatePropagation?.();
        const pct = Number(input.value) || 0;
        try { this.setAudioVolume?.(input.dataset.audioVolume, pct / 100); }
        catch (err) { this.recordRuntimeSystemFault?.({ id: 'settings-controls-binding-fix' }, 'setAudioVolume', err); }
        const value = input.closest('.audioSliderWrap')?.querySelector('.audioValue');
        if (value) value.textContent = `${pct}%`;
        return true;
      };

      Game.prototype.bindSettingsPanelControls = function(list) {
        list = list || this.ensureSettingsList?.() || ui.settingsList || document.getElementById('settingsList');
        if (!list || list.__drSettingsControlsDelegatedBound) return !!list;
        list.__drSettingsControlsDelegatedBound = true;
        list.addEventListener('click', event => this.handleSettingsPanelClick?.(event), true);
        list.addEventListener('input', event => this.handleSettingsPanelInput?.(event), true);
        list.addEventListener('change', event => this.handleSettingsPanelInput?.(event), true);
        return true;
      };

      Game.prototype.renderSettingsPanel = function() {
        ui.settingsList = this.ensureSettingsList?.() || ui.settingsList;
        if (!ui.settingsList) return;
        const prefs = this.uiPrefs || (this.uiPrefs = { showMinimap: true, showMercPanel: true, showPartyHud: true });
        const audio = this.audioSystem || this.initAudioSystem?.() || {};
        const pct = value => Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100);
        const renderScalePct = Math.round(Math.max(0.5, Math.min(1, Number(this.userRenderScale ?? 1))) * 100);
        const rows = [
          ['showMinimap', 'Show Minimap'],
          ['showMercPanel', 'Show Mercenary HUD'],
          ['showPartyHud', 'Show Party HUD']
        ];
        const audioSlider = (kind, label, value) => `
          <div class="settingsRow audioSettingsRow">
            <span>${escapeHtml(label)}</span>
            <label class="audioSliderWrap">
              <input class="audioSlider" type="range" min="0" max="100" step="1" value="${pct(value)}" data-audio-volume="${escapeHtml(kind)}">
              <span class="audioValue">${pct(value)}%</span>
            </label>
          </div>`;
        const controls = this.keyBindingLabels?.() || [];
        const performanceHtml = this.performanceVerifier?.settingsPanelHtml?.(escapeHtml) || '';
        const addOnsHtml = this.addOnsSettingsHtml?.(escapeHtml) || '<div class="small">No add-ons are installed.</div>';
        const controlHtml = controls.map(([group, actions]) => `
          <div class="keybindGroup">
            <div class="keybindGroupTitle">${escapeHtml(group)}</div>
            ${actions.map(([action, label]) => {
              const waiting = this.pendingKeyRebindAction === action;
              return `<div class="settingsRow keybindRow"><span>${escapeHtml(label)}</span><button class="keybindBtn ${waiting ? 'waiting' : ''}" data-keybind-action="${escapeHtml(action)}">${waiting ? 'Press a key...' : escapeHtml(this.displayKey?.(this.bindingForAction?.(action)) || '')}</button></div>`;
            }).join('')}
          </div>`).join('');
        // V0.20.19 (Roadmap Item 20): accessibility gets its own section rather than being filed under
        // HUD - it is not a HUD preference, and someone looking for it will look for the word.
        // It reuses the existing settingKey toggle path, so it persists through V0.20.18's uiPrefs
        // save for free: an accessibility setting the game forgets is worse than one it never offered.
        const accessibilityRows = [
          ['reduceScreenShake', 'Reduce Screen Shake'],
          ['reduceMotion', 'Reduce Motion'],
          ['colorblindStatusMarkers', 'Colourblind Status Markers'],
          ['highContrastTarget', 'High-Contrast Target Ring']
        ];
        const toggleRow = ([key, label]) => `<div class="settingsRow"><span>${escapeHtml(label)}</span><button class="toggleBtn ${prefs[key] ? 'active' : ''}" data-setting-key="${key}">${prefs[key] ? 'On' : 'Off'}</button></div>`;
        ui.settingsList.innerHTML = `
          <div class="settingsSectionTitle">HUD</div>
          ${rows.map(toggleRow).join('')}
          <div class="settingsSectionTitle">Accessibility</div>
          <div class="small" style="margin-bottom:8px">Screen shake is used for melee hits, critical strikes, and portals. Turning it off changes nothing else about how the game plays. Reduce Motion also stops screen shake and calms the swirling particle effects &mdash; spells, telegraphs and health bars are unaffected, so nothing you need to see is lost. Colourblind Status Markers add an up-triangle to buffs and a down-triangle to debuffs, so beneficial and harmful effects are told apart by shape, not colour. High-Contrast Target Ring draws the ring under your current target thicker and in black-and-white, so it is easy to see which enemy is selected.</div>
          ${accessibilityRows.map(toggleRow).join('')}
          <div class="settingsSectionTitle">Graphics</div>
          <div class="small" style="margin-bottom:8px">Render Resolution scales the world's internal resolution. Lower it for higher FPS on large or high-DPI displays &mdash; the game also lowers it automatically under sustained load, and restores it when the frame rate recovers. The HUD and text stay crisp.</div>
          <div class="settingsRow audioSettingsRow">
            <span>Render Resolution</span>
            <label class="audioSliderWrap">
              <input class="audioSlider" type="range" min="50" max="100" step="5" value="${renderScalePct}" data-render-scale="1">
              <span class="audioValue">${renderScalePct}%</span>
            </label>
          </div>
          ${performanceHtml}
          <div class="settingsSectionTitle" data-settings-category="addons">Add-Ons</div>
          ${addOnsHtml}
          <div class="settingsSectionTitle">Audio</div>
          <div class="small" style="margin-bottom:8px">Master, music, and sound-effect levels are saved locally. Audio unlocks after the first input event.</div>
          <div class="settingsRow"><span>Master Mute</span><button class="toggleBtn ${audio.muted ? 'active' : ''}" data-audio-mute="master">${audio.muted ? 'Muted' : 'On'}</button></div>
          <div class="settingsRow"><span>Music Mute</span><button class="toggleBtn ${audio.musicMuted ? 'active' : ''}" data-audio-mute="music">${audio.musicMuted ? 'Muted' : 'On'}</button></div>
          <div class="settingsRow"><span>SFX Mute</span><button class="toggleBtn ${audio.sfxMuted ? 'active' : ''}" data-audio-mute="sfx">${audio.sfxMuted ? 'Muted' : 'On'}</button></div>
          <div class="settingsRow"><span>Ambient Mute</span><button class="toggleBtn ${audio.ambientMuted ? 'active' : ''}" data-audio-mute="ambient">${audio.ambientMuted ? 'Muted' : 'On'}</button></div>
          ${audioSlider('master', 'Master Volume', audio.masterVolume ?? 0.72)}
          ${audioSlider('music', 'Music Volume', audio.musicVolume ?? 0.34)}
          ${audioSlider('sfx', 'SFX Volume', audio.sfxVolume ?? 0.72)}
          ${audioSlider('ambient', 'Ambient Volume', audio.ambientVolume ?? 0.56)}
          ${audioSlider('density', 'Ambient Density', audio.ambientDensity ?? 0.78)}
          <div class="small audioRuntimeSummary" style="margin-top:8px">${escapeHtml(this.audioRuntimeSummary?.() || 'Audio runtime not initialized.')}</div>
          <button class="toggleBtn" style="margin-top:8px;width:100%" data-audio-test="1">Test Sound</button>
          <button class="toggleBtn" style="margin-top:8px;width:100%" data-audio-test-ambient="1">Test Ambient</button>
          <div class="settingsRow" style="gap:6px;flex-wrap:wrap;margin-top:8px">
            <button class="toggleBtn" data-audio-test-music="dark_woods">Woods Music</button>
            <button class="toggleBtn" data-audio-test-music="town_lantern">Town Music</button>
            <button class="toggleBtn" data-audio-test-music="cave_ambience">Cave Music</button>
            <button class="toggleBtn" data-audio-test-music="combat_pulse">Combat Music</button>
          </div>
          <button class="toggleBtn" style="margin-top:8px;width:100%" data-reset-audio="1">Reset Audio</button>
          <div class="settingsSectionTitle">Controls</div>
          <div class="small" style="margin-bottom:8px">Click a binding, then press the new key. Custom controls are saved locally and persist between sessions.</div>
          ${controlHtml}
          <button class="toggleBtn" style="margin-top:10px;width:100%" data-reset-keybinds="1">Reset Controls</button>
        `;
        this.bindSettingsPanelControls?.(ui.settingsList);
      };

      Game.prototype.logoutToCharacterCreation = function() {
        this.toggleMenu(false);
        this.cleanupPartyForSessionEnd?.({ reason: 'logout' });
        this.saveCharacterState?.({ manual: true, silent: true, reason: 'logout' });
        this.resetRuntimeSessionForCharacterSwap?.({ reason: 'logout' });
        document.body.classList.remove('gameStarted');
        this.started = false;
        this.characterPanelOpen = false;
        this.spellPanelOpen = false;
        this.settingsPanelOpen = false;
        this.bagOpen = false;
        this.skillsOpen = false;
        this.mapOpen = false;
        if (ui.classScreen) ui.classScreen.style.display = 'none';
        this.showCharacterSlotsScreen?.();
        if (ui.characterPanel) ui.characterPanel.style.display = 'none';
        if (ui.spellPanel) ui.spellPanel.style.display = 'none';
        if (ui.settingsPanel) ui.settingsPanel.style.display = 'none';
        if (ui.bagPanel) ui.bagPanel.style.display = 'none';
        if (ui.skillsPanel) ui.skillsPanel.style.display = 'none';
        if (ui.mapOverlay) ui.mapOverlay.style.display = 'none';
        document.body?.classList?.remove('worldMapOpen');
        this.log('Returned to character slots.');
      };

      Game.prototype.setExitOverlayMessage = function(title, body) {
        if (!ui.pauseOverlay) return;
        ui.pauseOverlay.style.display = 'grid';
        const panel = ui.pauseOverlay.querySelector('.panel');
        if (!panel) return;
        panel.innerHTML = `<h2 style="margin-top:0">${escapeHtml(title)}</h2><p class="small">${escapeHtml(body)}</p>`;
      };

      Game.prototype.saveBeforeExit = async function() {
        this.cleanupPartyForSessionEnd?.({ reason: 'exit-game' });
        let worldSaved = true;
        let characterSaved = true;
        try {
          if (this.saveWorldState) worldSaved = this.saveWorldState({ silent: true }) !== false;
        } catch (err) {
          worldSaved = false;
          this.log?.(`Exit world save failed: ${err?.message || err}`, 'System');
        }
        try {
          if (this.started && this.player && this.saveCharacterState) characterSaved = this.saveCharacterState({ manual: true, silent: true, reason: 'exit-game' }) !== false;
        } catch (err) {
          characterSaved = false;
          this.log?.(`Exit character save failed: ${err?.message || err}`, 'System');
        }
        if (characterSaved && this.characterSaveDirectoryHandle && this.writeAccountsSaveToFolder) {
          try {
            await this.writeAccountsSaveToFolder({ manual: true, silent: true, reason: 'exit-game' });
          } catch (err) {
            this.log?.(`Exit account folder save failed: ${err?.message || err}`, 'System');
          }
        }
        return worldSaved && characterSaved;
      };

      Game.prototype.requestGameWindowClose = function() {
        try {
          if (window.opener && !window.opener.closed) {
            window.close();
            return true;
          }
        } catch (_err) {}
        try {
          window.close();
        } catch (_err) {}
        try {
          const selfWindow = window.open('', '_self');
          if (selfWindow) selfWindow.close();
        } catch (_err) {}
        return false;
      };

      Game.prototype.exitGame = async function() {
        if (this.exitInProgress) return;
        this.exitInProgress = true;
        this.toggleMenu(false);
        this.paused = true;
        this.keys?.clear?.();
        this.setExitOverlayMessage?.('Saving Game', 'Saving world and character state before closing Blackroot.');
        const saved = await this.saveBeforeExit?.();
        if (saved) this.log?.('Saved game on exit.', 'System');
        else this.log?.('Exit requested, but one or more save steps failed. Browser-local data may still contain the last autosave.', 'System');
        this.setExitOverlayMessage?.(saved ? 'Game Saved' : 'Save Warning', saved ? 'Blackroot saved successfully. Closing the game window now.' : 'Blackroot attempted to save before exit. Check the log for save errors. Closing the game window now.');
        this.requestGameWindowClose?.();
        window.setTimeout(() => {
          if (!document.hidden) {
            this.setExitOverlayMessage?.(saved ? 'Game Saved' : 'Save Warning', saved ? 'The browser blocked automatic window closing. Your game was saved; close this tab or app window manually.' : 'The browser blocked automatic window closing. Review the log, then close this tab or app window manually.');
            this.exitInProgress = false;
          }
        }, 800);
      };

      Game.prototype.uiWindowStorageKey = function() {
        const account = this.activeAccountId || 'local';
        return `dreamRealms.uiWindowPositions.${account}`;
      };

      Game.prototype.loadUiWindowPositions = function() {
        if (this.uiWindowPositions && typeof this.uiWindowPositions === 'object') return this.uiWindowPositions;
        try {
          this.uiWindowPositions = JSON.parse(localStorage.getItem(this.uiWindowStorageKey?.() || 'dreamRealms.uiWindowPositions.local') || '{}') || {};
        } catch (_err) {
          this.uiWindowPositions = {};
        }
        return this.uiWindowPositions;
      };

      Game.prototype.saveUiWindowPositions = function() {
        try {
          localStorage.setItem(this.uiWindowStorageKey?.() || 'dreamRealms.uiWindowPositions.local', JSON.stringify(this.uiWindowPositions || {}));
        } catch (_err) {}
      };

      Game.prototype.uiWindowId = function(panel) {
        if (!panel) return '';
        return panel.id || panel.dataset?.uiWindowId || panel.getAttribute?.('aria-label') || '';
      };

      Game.prototype.clampUiWindowPosition = function(left, top, width, height) {
        const margin = 4;
        const safeWidth = Math.max(80, Number(width) || 320);
        const safeHeight = Math.max(36, Number(height) || 160);
        const visibleWidth = Math.min(140, safeWidth);
        const headerHeight = Math.min(42, safeHeight);
        const minLeft = Math.min(margin, visibleWidth - safeWidth);
        const maxLeft = Math.max(margin, window.innerWidth - visibleWidth);
        const minTop = margin;
        const maxTop = Math.max(margin, window.innerHeight - headerHeight);
        return {
          left: Math.max(minLeft, Math.min(maxLeft, left)),
          top: Math.max(minTop, Math.min(maxTop, top))
        };
      };

      Game.prototype.setUiWindowPosition = function(panel, left, top, options = {}) {
        if (!panel) return null;
        const rect = panel.getBoundingClientRect?.() || { width: panel.offsetWidth || 320, height: panel.offsetHeight || 240 };
        const pos = this.clampUiWindowPosition?.(left, top, rect.width || panel.offsetWidth || 320, rect.height || panel.offsetHeight || 240) || { left, top };
        panel.style.position = 'fixed';
        panel.style.left = `${Math.round(pos.left)}px`;
        panel.style.top = `${Math.round(pos.top)}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.transform = 'none';
        if (options.userPositioned) {
          panel.dataset.userPositioned = 'true';
          const id = this.uiWindowId?.(panel);
          if (id) {
            const positions = this.loadUiWindowPositions?.() || (this.uiWindowPositions = {});
            positions[id] = { left: Math.round(pos.left), top: Math.round(pos.top), userPositioned: true };
            this.saveUiWindowPositions?.();
          }
        }
        return pos;
      };

      Game.prototype.applyUiWindowStoredPosition = function(panel) {
        if (!panel) return false;
        const id = this.uiWindowId?.(panel);
        if (!id) return false;
        const saved = (this.loadUiWindowPositions?.() || {})[id];
        if (!saved || !Number.isFinite(Number(saved.left)) || !Number.isFinite(Number(saved.top))) return false;
        panel.dataset.userPositioned = saved.userPositioned ? 'true' : '';
        this.setUiWindowPosition?.(panel, Number(saved.left), Number(saved.top), { userPositioned: false });
        return true;
      };

      Game.prototype.centerUiWindow = function(panel) {
        if (!panel) return null;
        const previousDisplay = panel.style.display;
        if (previousDisplay === 'none') panel.style.display = 'block';
        const rect = panel.getBoundingClientRect?.() || { width: panel.offsetWidth || 320, height: panel.offsetHeight || 240 };
        const left = Math.round((window.innerWidth - (rect.width || 320)) / 2);
        const top = Math.round((window.innerHeight - (rect.height || 240)) / 2);
        const pos = this.setUiWindowPosition?.(panel, left, top, { userPositioned: false });
        if (previousDisplay === 'none') panel.style.display = previousDisplay;
        return pos;
      };

      Game.prototype.layoutProfessionsAndSkillsWindows = function(options = {}) {
        const professionPanel = document.getElementById('professionWindow');
        const skillsPanel = ui.skillsPanel || document.getElementById('skillsPanel');
        if (!professionPanel || !skillsPanel) return false;

        const forceCenteredPair = options?.source === 'professions-open' || options?.forceCenteredPair === true;
        const wasProfessionHidden = professionPanel.style.display === 'none';
        const wasSkillsHidden = skillsPanel.style.display === 'none';

        // Measurement and placement are synchronous.  When Professions is the opener,
        // both panels intentionally remain visible and are treated as one centered pair.
        professionPanel.style.display = 'block';
        skillsPanel.style.display = 'block';

        const gap = Math.max(12, Math.min(22, Math.round(window.innerWidth * 0.012)));
        const profRect = professionPanel.getBoundingClientRect();
        const skillsRect = skillsPanel.getBoundingClientRect();
        const profWidth = Math.max(320, Math.ceil(profRect.width || professionPanel.offsetWidth || 460));
        const skillsWidth = Math.max(280, Math.ceil(skillsRect.width || skillsPanel.offsetWidth || 360));
        const pairWidth = profWidth + gap + skillsWidth;
        const viewportPad = 12;
        const maxLeft = Math.max(viewportPad, window.innerWidth - pairWidth - viewportPad);
        const pairLeft = Math.max(viewportPad, Math.min(maxLeft, Math.round((window.innerWidth - pairWidth) / 2)));
        const pairTop = Math.max(viewportPad, Math.round((window.innerHeight - Math.max(profRect.height || 360, skillsRect.height || 320)) / 2));

        if (forceCenteredPair) {
          professionPanel.dataset.userPositioned = '';
          skillsPanel.dataset.userPositioned = '';
          this.setUiWindowPosition?.(professionPanel, pairLeft, pairTop, { userPositioned: false });
          this.setUiWindowPosition?.(skillsPanel, pairLeft + profWidth + gap, pairTop, { userPositioned: false });
          return true;
        }

        const profUserMoved = professionPanel.dataset.userPositioned === 'true';
        const skillsUserMoved = skillsPanel.dataset.userPositioned === 'true';

        if (!profUserMoved && !skillsUserMoved) {
          this.setUiWindowPosition?.(professionPanel, pairLeft, pairTop, { userPositioned: false });
          this.setUiWindowPosition?.(skillsPanel, pairLeft + profWidth + gap, pairTop, { userPositioned: false });
        } else if (profUserMoved && !skillsUserMoved) {
          const anchor = professionPanel.getBoundingClientRect();
          const rightLeft = anchor.right + gap;
          const canFitRight = rightLeft + skillsWidth <= window.innerWidth - viewportPad;
          const skillsLeft = canFitRight ? rightLeft : anchor.left - gap - skillsWidth;
          this.setUiWindowPosition?.(skillsPanel, skillsLeft, anchor.top, { userPositioned: false });
        } else if (!profUserMoved && skillsUserMoved) {
          const anchor = skillsPanel.getBoundingClientRect();
          const profLeft = anchor.left - gap - profWidth;
          const canFitLeft = profLeft >= viewportPad;
          this.setUiWindowPosition?.(professionPanel, canFitLeft ? profLeft : anchor.right + gap, anchor.top, { userPositioned: false });
        }

        if (wasProfessionHidden && options?.preserveHidden !== false) professionPanel.style.display = 'none';
        if (wasSkillsHidden && options?.preserveHidden !== false) skillsPanel.style.display = 'none';
        return true;
      };

      Game.prototype.installMovableUiWindows = function() {
        if (this.movableWindowsInstalled) return;
        this.movableWindowsInstalled = true;
        this.loadUiWindowPositions?.();

        const isInteractiveTarget = target => !!target?.closest?.('button, input, select, textarea, a, [contenteditable="true"], [data-no-window-drag]');
        const isMovableWindow = panel => !!panel && (panel.classList?.contains('gameWindow') || panel.id === 'hud' || panel.id === 'mercPanel' || panel.id === 'partyPanel' || panel.id === 'partyHud');
        const findDragHandle = target => target.closest?.('.gameWindow .windowHeader, .gameWindow [data-window-drag-handle], .gameWindow .panelTitle, #hud .title-row, #mercPanel .title-row, #partyPanel .title-row, #partyHud .title-row');

        // V0.18.73 (user request): any window the player opens by pressing a button should always
        // open centered on screen. We watch each .gameWindow's inline style and, on a hidden ->
        // visible transition, re-center it (overriding any previously dragged/stored position).
        // Dragging while open still works - the observer only fires on the open transition. A few
        // windows opt out: the world map overlay (full-screen), and the profession/skills PAIR,
        // which has its own side-by-side centering (layoutProfessionsAndSkillsWindows).
        const noAutoCenter = panel => panel.dataset.noAutoCenter === 'true'
          || panel.id === 'professionWindow' || panel.id === 'skillsPanel' || panel.id === 'mapOverlay';
        const isPanelHidden = panel => {
          if (panel.style.display === 'none') return true;
          try { return getComputedStyle(panel).display === 'none'; } catch (_e) { return false; }
        };
        const prepareWindow = panel => {
          if (!panel || panel.dataset.uiWindowPrepared === 'true') return;
          panel.dataset.uiWindowPrepared = 'true';
          this.applyUiWindowStoredPosition?.(panel);
          if (noAutoCenter(panel)) return;
          panel.dataset.uiWasHidden = isPanelHidden(panel) ? 'true' : '';
          try {
            const styleObserver = new MutationObserver(() => {
              if (panel.dataset.uiCentering === 'true') return;
              const hidden = isPanelHidden(panel);
              if (!hidden && panel.dataset.uiWasHidden === 'true') {
                panel.dataset.uiCentering = 'true';
                this.centerUiWindow?.(panel);
                panel.dataset.uiCentering = '';
              }
              panel.dataset.uiWasHidden = hidden ? 'true' : '';
            });
            styleObserver.observe(panel, { attributes: true, attributeFilter: ['style'] });
          } catch (_e) {}
        };
        document.querySelectorAll('.gameWindow').forEach(prepareWindow);
        try {
          const observer = new MutationObserver(records => {
            for (const record of records) {
              record.addedNodes?.forEach(node => {
                if (!(node instanceof HTMLElement)) return;
                if (node.classList?.contains('gameWindow')) prepareWindow(node);
                node.querySelectorAll?.('.gameWindow').forEach(prepareWindow);
              });
            }
          });
          observer.observe(document.body, { childList: true, subtree: true });
          this.uiWindowObserver = observer;
        } catch (_err) {}

        window.addEventListener('resize', () => {
          document.querySelectorAll('.gameWindow').forEach(panel => {
            if (panel.style.display === 'none') return;
            const rect = panel.getBoundingClientRect();
            this.setUiWindowPosition?.(panel, rect.left, rect.top, { userPositioned: false });
          });
        });

        document.addEventListener('pointerdown', event => {
          const handle = findDragHandle(event.target);
          if (!handle) return;
          if (isInteractiveTarget(event.target)) return;
          const panel = handle.closest('.panel');
          if (!isMovableWindow(panel)) return;

          const rect = panel.getBoundingClientRect();
          const dragOffsetX = event.clientX - rect.left;
          const dragOffsetY = event.clientY - rect.top;

          event.preventDefault();
          this.setUiWindowPosition?.(panel, rect.left, rect.top, { userPositioned: false });
          panel.classList.add('draggingWindow');

          try { handle.setPointerCapture?.(event.pointerId); } catch (_err) {}

          const move = moveEvent => {
            moveEvent.preventDefault();
            this.setUiWindowPosition?.(panel, moveEvent.clientX - dragOffsetX, moveEvent.clientY - dragOffsetY, { userPositioned: false });
          };

          const up = upEvent => {
            try { handle.releasePointerCapture?.(upEvent.pointerId); } catch (_err) {}
            panel.classList.remove('draggingWindow');
            const currentRect = panel.getBoundingClientRect();
            this.setUiWindowPosition?.(panel, currentRect.left, currentRect.top, { userPositioned: true });
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            window.removeEventListener('pointercancel', up);
          };

          window.addEventListener('pointermove', move, { passive: false });
          window.addEventListener('pointerup', up, { once: true });
          window.addEventListener('pointercancel', up, { once: true });
        });
      };
    }
  };
})();
