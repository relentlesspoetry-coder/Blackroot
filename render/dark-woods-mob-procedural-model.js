(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.render = DR.render || {};

  const TAU = Math.PI * 2;
  const OUTLINE = 'rgba(17,12,10,0.86)';
  const SHADOW = 'rgba(4,3,2,0.28)';

  const DARK_WOODS_MOB_VISUALS = Object.freeze({
    gloomWolf: { renderer: 'wolf', family: 'wolf', palette: 'gloom', scale: 1.0, animationProfile: 'quadrupedPredator', eliteVariant: 'direGloomWolf', anchorY: 86 },
    // V0.20.71: the camp's broke-in riding wolf. A real authored visual key (not an invented
    // creature) so a mount may reference it, exactly as mossfangAlpha and thornCrownedStag do.
    blackWolf: { renderer: 'wolf', family: 'wolf', palette: 'black', scale: 1.04, animationProfile: 'quadrupedPredator', eliteVariant: 'direGloomWolf', anchorY: 88 },
    mossfangAlpha: { renderer: 'wolf', family: 'wolf', palette: 'mossfang', scale: 1.18, animationProfile: 'quadrupedPredator', eliteVariant: 'direGloomWolf', anchorY: 96, named: true },
    thornWidow: { renderer: 'spider', family: 'spider', palette: 'thornWeb', scale: 1.0, animationProfile: 'arachnidSkitter', eliteVariant: 'webMatriarch', anchorY: 74 },
    weblingSkitterer: { renderer: 'spider', family: 'spider', palette: 'webSkitter', scale: 0.94, animationProfile: 'arachnidSkitter', eliteVariant: 'webMatriarch', anchorY: 70 },
    rotling: { renderer: 'rotling', family: 'rotling', palette: 'rotling', scale: 0.98, animationProfile: 'rotlingCreep', eliteVariant: 'rotlingElder', anchorY: 82 },
    briarBoar: { renderer: 'boar', family: 'boar', palette: 'mudTusker', scale: 1.05, animationProfile: 'heavyBeastCharge', eliteVariant: 'bristleback', anchorY: 84 },
    oldTuskBriarback: { renderer: 'boar', family: 'boar', palette: 'oldTusk', scale: 1.22, animationProfile: 'heavyBeastCharge', eliteVariant: 'bristleback', anchorY: 94, named: true },
    hollowStag: { renderer: 'stag', family: 'stag', palette: 'hollowStag', scale: 1.08, animationProfile: 'deepwoodBruiser', eliteVariant: 'thornCrownedStag', anchorY: 104 },
    thornCrownedStag: { renderer: 'stag', family: 'stag', palette: 'thornCrowned', scale: 1.24, animationProfile: 'deepwoodBruiser', eliteVariant: 'thornCrownedStag', anchorY: 116, named: true },
    duskwisp: { renderer: 'wisp', family: 'wisp', palette: 'duskWisp', scale: 1.0, animationProfile: 'floatingCaster', eliteVariant: 'lumenWisp', anchorY: 82 },
    dustWisp: { renderer: 'wisp', family: 'wisp', palette: 'dustWisp', scale: 1.0, animationProfile: 'floatingCaster', eliteVariant: 'lumenWisp', anchorY: 84 },
    lumenWisp: { renderer: 'wisp', family: 'wisp', palette: 'lumenWisp', scale: 1.18, animationProfile: 'floatingCaster', eliteVariant: 'lumenWisp', anchorY: 92, named: true },
    graveWisp: { renderer: 'wisp', family: 'wisp', palette: 'graveWisp', scale: 1.0, animationProfile: 'floatingCaster', eliteVariant: 'graveLantern', anchorY: 82 },
    ashrootHorror: { renderer: 'deadroot', family: 'deadroot', palette: 'ashroot', scale: 1.22, animationProfile: 'corruptedPlantBruiser', eliteVariant: 'ashrootElder', anchorY: 122, elite: true },
    ashrootElder: { renderer: 'deadroot', family: 'deadroot', palette: 'ashrootElder', scale: 1.45, animationProfile: 'corruptedPlantBruiser', eliteVariant: 'ashrootElder', anchorY: 142, named: true },
    caveBat: { renderer: 'bat', family: 'bat', palette: 'caveBat', scale: 0.94, animationProfile: 'flyingSkirmisher', eliteVariant: 'graveBat', anchorY: 74 },
    boneWatcher: { renderer: 'skeleton', family: 'skeleton', palette: 'oldBone', scale: 1.04, animationProfile: 'undeadHumanoid', eliteVariant: 'graveKnight', anchorY: 96 },
    mineHusk: { renderer: 'skeleton', family: 'skeleton', palette: 'mineHusk', scale: 1.08, animationProfile: 'undeadHumanoid', eliteVariant: 'graveKnight', anchorY: 100 },
    crystalCrawler: { renderer: 'crystalCrawler', family: 'crawler', palette: 'crystal', scale: 1.06, animationProfile: 'crystalCrawler', eliteVariant: 'crystalBrute', anchorY: 82 },
    bandit: { renderer: 'bandit', family: 'bandit', palette: 'darkWoodsOutlaw', scale: 1.0, animationProfile: 'armedHumanoid', eliteVariant: 'banditVeteran', anchorY: 96 }
  });

  const PALETTES = Object.freeze({
    gloom: { body:'#52605f', dark:'#303b3d', deep:'#1d2526', light:'#788d87', accent:'#b7c8bd', eye:'#a8f2d6', mark:'#9aa9a0' },
    caveGloom: { body:'#465257', dark:'#293238', deep:'#171f23', light:'#708791', accent:'#bfcdda', eye:'#b6eaff', mark:'#9db6ba' },
    mossfang: { body:'#94a28d', dark:'#4c5e4e', deep:'#263228', light:'#b6c8a8', accent:'#e0d7b9', eye:'#fff0b4', mark:'#d2c89a' },
    thornWeb: { body:'#7b6d87', dark:'#493d57', deep:'#211d2a', light:'#a08fb0', accent:'#d8c4ea', eye:'#f0caff', venom:'#8fd66d', web:'#dccbeb' },
    webSkitter: { body:'#b58ad0', dark:'#674676', deep:'#2d1d38', light:'#d1aee4', accent:'#ead8f4', eye:'#fff0ff', venom:'#9fe878', web:'#e9d5f2' },
    rotling: { body:'#597034', dark:'#34431f', deep:'#1e2812', light:'#88a955', accent:'#b8d676', eye:'#d5ff8b', thorn:'#4b321d' },
    mudTusker: { body:'#8e6a46', dark:'#553c27', deep:'#2a1e14', light:'#b78d5d', accent:'#e1c18d', tusk:'#eadfc6', eye:'#19100a' },
    oldTusk: { body:'#b18451', dark:'#6c472c', deep:'#2f1e13', light:'#d0a064', accent:'#eed097', tusk:'#fff2d6', eye:'#ffcf7a' },
    hollowStag: { body:'#a38f6b', dark:'#66563c', deep:'#30281d', light:'#cab78a', accent:'#ead99f', antler:'#e6d1a0', eye:'#d8f4bd' },
    thornCrowned: { body:'#d2bd83', dark:'#7c6943', deep:'#3a3020', light:'#efdaa0', accent:'#ffe6aa', antler:'#f5dfaa', eye:'#fff2a6' },
    duskWisp: { body:'#80c9ff', dark:'#2f739c', deep:'#17405d', light:'#c4edff', accent:'#e2fbff', eye:'#ffffff', glow:'#9de9ff', core:'#f0d58a', sand:'#b79861', debris:'#70543b', spark:'#fff5bc' },
    dustWisp: { body:'#b99b63', dark:'#6f5639', deep:'#30261b', light:'#dec483', accent:'#f0d58a', eye:'#fff0b2', glow:'#e0ba5c', core:'#f1c66a', sand:'#c49a5e', debris:'#604532', spark:'#fff3a8' },
    lumenWisp: { body:'#bce8ff', dark:'#6aaed2', deep:'#2b6380', light:'#ecfbff', accent:'#fff8bc', eye:'#ffffff', glow:'#d9fbff', core:'#fff2a6', sand:'#bdd4d7', debris:'#5f7882', spark:'#fffadc' },
    graveWisp: { body:'#95b8c4', dark:'#526e78', deep:'#283a43', light:'#c4dde3', accent:'#e3f6f4', eye:'#ffffff', glow:'#bdeaff', core:'#c8b486', sand:'#8a8274', debris:'#4e473d', spark:'#fff0b9' },
    ashroot: { body:'#5a3b25', dark:'#231814', deep:'#100b09', light:'#80674c', accent:'#c89b67', ember:'#ff6f26', eye:'#ffbd74', thorn:'#1b120f', ash:'#b8afa0', smoke:'#c8c0b4', living:'#d7b987', soot:'#080605' },
    ashrootElder: { body:'#6b4428', dark:'#2a1a12', deep:'#120907', light:'#a07752', accent:'#ffb05f', ember:'#ff8b31', eye:'#ffd08a', thorn:'#1c0f0a', ash:'#d1c2ad', smoke:'#e0d1c0', living:'#f3c486', soot:'#070403' },
    caveBat: { body:'#4d4655', dark:'#2a2631', deep:'#15131b', light:'#7b7285', accent:'#b4a6c7', eye:'#ffb0c8', wing:'#393343' },
    oldBone: { body:'#c8c0a7', dark:'#736c59', deep:'#2d2a23', light:'#eee4c3', accent:'#9a7050', eye:'#a7f1ff', cloth:'#4b3a32' },
    mineHusk: { body:'#9a7c55', dark:'#5c442e', deep:'#2d2117', light:'#c4a06c', accent:'#d7c39a', eye:'#f0c96a', cloth:'#3f352b' },
    crystal: { body:'#70d8e6', dark:'#2f7f8e', deep:'#184c55', light:'#b7f5ff', accent:'#e7fdff', eye:'#ffffff', crystal:'#79f2ff' },
    darkWoodsOutlaw: { body:'#6e5141', dark:'#3d2d26', deep:'#1d1714', light:'#a37656', accent:'#bfc0a0', eye:'#f2d6a7', cloth:'#27242d', metal:'#b8b0a0' }
  });

  const FAMILY_TO_KEY = Object.freeze({
    wolf: 'gloomWolf', hound: 'gloomWolf', spider: 'thornWidow', rootling: 'rotling', rotling: 'rotling', root: 'rotling', blight: 'rotling', fungus: 'rotling', boar: 'briarBoar', stag: 'hollowStag', wisp: 'duskwisp', spirit: 'duskwisp', deadroot: 'ashrootHorror', plant: 'ashrootHorror', bat: 'caveBat', skeleton: 'boneWatcher', undead: 'boneWatcher', crawler: 'crystalCrawler', crystal: 'crystalCrawler', bandit: 'bandit', humanoid: 'bandit' });

  function normalize(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
  function shade(hex, amount) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return hex || '#777777';
    const n = parseInt(m[1], 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
    const b = Math.max(0, Math.min(255, (n & 255) + amount));
    return `rgb(${r},${g},${b})`;
  }
  function ellipse(ctx, x, y, rx, ry, rot, fill, stroke = OUTLINE, lw = 2) { ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); ctx.stroke(); }
  function circle(ctx, x, y, r, fill, stroke = OUTLINE, lw = 1.5) { ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke(); }
  function poly(ctx, points, fill, stroke = OUTLINE, lw = 2) { if (!points.length) return; ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]); for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  function strokePath(ctx, points, color, width = 3, alpha = 1) { if (!points.length) return; ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = OUTLINE; ctx.lineWidth = width + 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]); for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]); ctx.stroke(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]); for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]); ctx.stroke(); ctx.restore(); }
  function translatePoints(points, dx, dy) { return points.map(([x, y]) => [x + dx, y + dy]); }

  function visualKeyFor(enemy) {
    const explicit = enemy?.mobVisualKey || enemy?.baseType?.mobVisualKey || enemy?.visualKey || enemy?.baseType?.visualKey;
    if (explicit && DARK_WOODS_MOB_VISUALS[explicit]) return explicit;
    const rid = normalize(enemy?.rendererId || enemy?.baseType?.rendererId || '');
    if (rid && DARK_WOODS_MOB_VISUALS[rid]) return rid;
    const id = normalize(enemy?.mobDraftId || enemy?.baseType?.id || '');
    if (id.includes('mossfang')) return 'mossfangAlpha';
    if (id.includes('oldtusk') || id.includes('briarback')) return 'oldTuskBriarback';
    if (id.includes('dust')) return 'dustWisp';
    if (id.includes('lumen')) return 'lumenWisp';
    if (id.includes('thorncrowned')) return 'thornCrownedStag';
    if (id.includes('ashrootelder')) return 'ashrootElder';
    const text = normalize([enemy?.name, enemy?.baseType?.name, enemy?.family, enemy?.baseType?.family, enemy?.aiProfile, enemy?.baseType?.aiProfile].filter(Boolean).join(' '));
    if (text.includes('mossfang')) return 'mossfangAlpha';
    if (text.includes('oldtusk') || text.includes('briarback')) return 'oldTuskBriarback';
    if (text.includes('dust')) return 'dustWisp';
    if (text.includes('lumen')) return 'lumenWisp';
    if (text.includes('thorncrowned')) return 'thornCrownedStag';
    if (text.includes('ashrootelder')) return 'ashrootElder';
    if (text.includes('gloomwolf') || text.includes('wolf')) return 'gloomWolf';
    if (text.includes('widow') || text.includes('spider') || text.includes('webling') || text.includes('skitter')) return text.includes('webling') ? 'weblingSkitterer' : 'thornWidow';
    if (text.includes('rotling') || text.includes('rootling')) return 'rotling';
    if (text.includes('boar') || text.includes('tusk')) return 'briarBoar';
    if (text.includes('stag')) return 'hollowStag';
    if (text.includes('duskwisp')) return 'duskwisp';
    if (text.includes('gravewisp')) return 'graveWisp';
    if (text.includes('wisp')) return 'duskwisp';
    if (text.includes('ashroot') || text.includes('deadroot')) return 'ashrootHorror';
    if (text.includes('bat')) return 'caveBat';
    if (text.includes('bonewatcher')) return 'boneWatcher';
    if (text.includes('minehusk')) return 'mineHusk';
    if (text.includes('skeleton') || text.includes('undead')) return 'boneWatcher';
    if (text.includes('crystalcrawler') || text.includes('crystal')) return 'crystalCrawler';
    if (text.includes('bandit') || text.includes('outlaw')) return 'bandit';
    const fam = normalize(enemy?.family || enemy?.baseType?.family || '');
    return FAMILY_TO_KEY[fam] || null;
  }

  function canDraw(enemy) {
    if (!enemy || enemy.kind !== 'enemy') return false;
    if (enemy.silkWebCavern || enemy.dungeonBoss || normalize(enemy.baseType?.family).includes('silkwebboss')) return false;
    return !!visualKeyFor(enemy);
  }

  function facingProfile(actor) {
    const name = String(actor.facingName || actor._humanoidSheetDirection || '').toLowerCase();
    if (name.includes('north')) return { view:'back', side:name.includes('west') ? -1 : 1, front:false, back:true };
    if (name.includes('south')) return { view:'front', side:name.includes('west') ? -1 : 1, front:true, back:false };
    if (name.includes('west')) return { view:'side', side:-1, front:true, back:false };
    if (name.includes('east')) return { view:'side', side:1, front:true, back:false };
    const fx = Number(actor.facingX || 1), fy = Number(actor.facingY || 0);
    if (fy < -0.35) return { view:'back', side:fx < 0 ? -1 : 1, front:false, back:true };
    if (fy > 0.35) return { view:'front', side:fx < 0 ? -1 : 1, front:true, back:false };
    return { view:'side', side:fx < 0 ? -1 : 1, front:true, back:false };
  }

  function poseFor(actor, nowMs) {
    const dead = actor.alive === false || actor.dead === true || actor.action === 'death' || actor.action === 'dead';
    const moving = !dead && (actor.isMoving || Number(actor.moveBlend || 0) > 0.05 || Math.abs(actor.vx || 0) + Math.abs(actor.vy || 0) > 0.01);
    const attacking = !dead && (Number(actor.attackAnim || 0) > 0.02 || actor.action === 'attack' || actor.action === 'charge' || actor.action === 'rangedAttack');
    const casting = !dead && (Number(actor.spellCastAnim || 0) > 0.02 || actor.action === 'cast' || actor.action === 'webSpit' || actor.action === 'howl');
    const hit = !dead && (Number(actor.hitAnim || actor.hitReaction || actor.damageAnim || 0) > 0.02 || actor.action === 'hit');
    const t = nowMs / 1000;
    const attack = Math.max(0, Math.min(1, Number(actor.attackAnim || 0)));
    const hitAmt = Math.max(0, Math.min(1, Number(actor.hitAnim || actor.hitReaction || actor.damageAnim || 0)));
    return {
      time: t,
      moving, attacking, casting, hit, dead,
      action: dead ? 'death' : attacking ? 'attack' : casting ? 'cast' : hit ? 'hit' : moving ? 'walk' : 'idle',
      step: t * (moving ? 8.5 : 1.4),
      bob: dead ? 0 : (moving ? -Math.abs(Math.sin(t * 8.5)) * 1.4 : Math.sin(t * 2.1) * 0.45),
      attack: attacking ? (attack || 0.75) : 0,
      hitAmt
    };
  }

  function variantFor(actor, base) {
    const isNamed = !!(actor.isNamed || actor.named || actor.rareNameplate || base.named || actor.baseType?.named || actor.rarity === 'named');
    const isRare = !!(isNamed || actor.isRare || actor.rare || actor.rarity === 'rare');
    const isElite = !!(isRare || actor.isElite || actor.elite || actor.baseType?.elite || actor.rank === 'elite' || base.elite);
    return { isNamed, isRare, isElite, scale: Number(base.scale || 1) * (isNamed ? 1.08 : isElite ? 1.04 : 1), accentBoost: isNamed ? 2 : isElite ? 1 : 0 };
  }

  function drawGroundShadow(ctx, rx, ry, alpha = 1) { ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = SHADOW; ctx.beginPath(); ctx.ellipse(0, 7, rx, ry, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  function drawEliteAura(ctx, p, v, size = 44) { if (!v.isElite) return; const pulse = 0.5 + Math.sin(performance.now() * 0.004) * 0.5; ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = v.isNamed ? 0.22 + pulse * 0.08 : 0.12 + pulse * 0.06; ctx.strokeStyle = v.isNamed ? (p.accent || p.eye || '#ffe6a0') : (p.eye || p.accent || '#d8b56a'); ctx.lineWidth = v.isNamed ? 3 : 2; ctx.beginPath(); ctx.ellipse(0, 4, size, size * 0.23, 0, 0, TAU); ctx.stroke(); ctx.restore(); }

  function drawQuadrupedLegs(ctx, p, pose, dir, opts = {}) {
    const side = dir.side || 1;
    const step = pose.dead ? 0 : Math.sin(pose.step) * (opts.step || 8) * (pose.moving ? 1 : 0);
    const legColor = opts.legColor || p.dark;
    const hoofColor = opts.hoofColor || p.deep;
    const positions = opts.positions || [-30, -8, 12, 30];
    for (let i = 0; i < positions.length; i++) {
      const x = positions[i];
      const phase = (i % 2 ? -step : step);
      const back = (dir.view === 'front' && i < 2) || (dir.view === 'back' && i > 1);
      ctx.save(); ctx.globalAlpha = back ? 0.62 : 1;
      const lean = (pose.attacking ? side * 4 : 0) + phase * 0.12;
      poly(ctx, [[x - 4, -3], [x + 5, -2], [x + 5 + lean, 22 + phase * 0.08], [x - 4 + lean, 23 + phase * 0.08]], legColor, OUTLINE, 1.5);
      poly(ctx, [[x - 7 + lean, 21 + phase * 0.08], [x + 7 + lean, 21 + phase * 0.08], [x + 9 + lean, 25], [x - 8 + lean, 25]], hoofColor, OUTLINE, 1.2);
      ctx.restore();
    }
  }

  function drawWolf(ctx, p, pose, dir, variant) {
    const s = dir.side || 1;
    const attack = pose.attack * 9;
    const neck = pose.moving ? Math.sin(pose.step) * 2.2 : Math.sin(pose.time * 2) * 1.0;
    drawGroundShadow(ctx, 36, 9, pose.dead ? 0.22 : 1);
    if (pose.dead) {
      ctx.rotate(-0.1 * s);
      ellipse(ctx, -8, 4, 39, 16, -0.05, p.dark, OUTLINE, 2);
      ellipse(ctx, 26 * s, -4, 18, 10, -0.12 * s, p.body, OUTLINE, 2);
      strokePath(ctx, [[-37 * s, 0], [-58 * s, 6], [-68 * s, 4]], p.deep, 6, 0.82);
      return;
    }
    strokePath(ctx, [[-35 * s, -15], [-57 * s, -28 + Math.sin(pose.step) * 2], [-70 * s, -24]], p.deep, 7, 0.95);
    drawQuadrupedLegs(ctx, p, pose, dir, { step: 9, legColor: p.dark, hoofColor: p.deep });
    ellipse(ctx, -8 * s, -15, 42, 17, -0.08 * s, p.dark, OUTLINE, 2.2);
    ellipse(ctx, 4 * s, -18, 31, 14, -0.05 * s, p.body, OUTLINE, 1.8);
    ellipse(ctx, 24 * s, -19 - neck * 0.25, 21, 13, -0.12 * s, p.light, OUTLINE, 1.8);
    poly(ctx, [[31*s,-31-neck],[38*s,-48-neck],[43*s,-29-neck]], p.dark, OUTLINE, 1.8);
    poly(ctx, [[45*s,-31-neck],[55*s,-44-neck],[53*s,-27-neck]], p.dark, OUTLINE, 1.8);
    ellipse(ctx, (45 + attack) * s, -18 - neck, 21, 11, -0.04 * s, p.dark, OUTLINE, 2);
    poly(ctx, [[(58+attack)*s,-17-neck],[(71+attack)*s,-12-neck],[(58+attack)*s,-8-neck]], p.accent, OUTLINE, 1.5);
    circle(ctx, (51 + attack) * s, -21 - neck, 2.7, variant.isElite ? p.eye : '#101515', OUTLINE, 0.8);
    if (pose.attacking) poly(ctx, [[(67+attack)*s,-9-neck],[(73+attack)*s,-4-neck],[(60+attack)*s,-5-neck]], '#f1efe5', OUTLINE, 0.8);
    for (let i = -30; i <= 12; i += 8) poly(ctx, [[i*s,-30 + (i%3)],[(i+5)*s,-40],[(i+10)*s,-29]], p.mark, 'rgba(20,16,12,0.35)', 0.7);
    if (variant.isElite) {
      strokePath(ctx, [[-12*s,-32], [4*s,-39], [18*s,-34]], p.accent, 2.2, 0.75);
      if (variant.isNamed) strokePath(ctx, [[36*s,-13], [48*s,-10], [58*s,-8]], '#b85d4e', 2.4, 0.78);
    }
  }

  function drawSpiderLegSet(ctx, p, pose, dir, variant) {
    const s = dir.side || 1;
    const walk = pose.moving ? Math.sin(pose.step) * 6 : Math.sin(pose.time * 3) * 1.2;
    const legColor = p.dark;
    const rows = [ [-17, 38, -17], [-8, 46, -5], [2, 43, 8], [10, 35, 20] ];
    for (const side of [-1, 1]) {
      for (let i = 0; i < rows.length; i++) {
        const [y, len, lift] = rows[i];
        const back = (side !== s && dir.view === 'side') || i === 0;
        const swing = ((i % 2 ? -walk : walk) * side);
        ctx.save(); ctx.globalAlpha = back ? 0.58 : 1;
        strokePath(ctx, [[side * 9, y], [side * (20 + i * 4) + swing * 0.25, y + lift * 0.35 - 9], [side * len + swing, y + lift]], legColor, variant.isElite && i < 2 ? 6 : 4.5, 1);
        ctx.restore();
      }
    }
  }

  function drawSpider(ctx, p, pose, dir, variant) {
    const s = dir.side || 1;
    const attack = pose.attack * 7;
    drawGroundShadow(ctx, 35, 8, pose.dead ? 0.2 : 1);
    if (pose.dead) {
      ellipse(ctx, -8, 4, 24, 13, 0, p.dark, OUTLINE, 2);
      ellipse(ctx, 18, 1, 18, 10, 0, p.body, OUTLINE, 2);
      for (let i = -4; i <= 4; i++) strokePath(ctx, [[i*5, 5], [i*7, 19]], p.deep, 3, 0.7);
      return;
    }
    drawSpiderLegSet(ctx, p, pose, dir, variant);
    ellipse(ctx, -12 * s, -7, 27 + (variant.isElite ? 3 : 0), 18, 0.05 * s, p.body, OUTLINE, 2.2);
    ellipse(ctx, 15 * s, -11, 22, 14, -0.08 * s, p.dark, OUTLINE, 2);
    ellipse(ctx, (32 + attack) * s, -12, 16, 11, -0.05 * s, p.light, OUTLINE, 1.8);
    const eyeCount = variant.isElite ? 6 : 4;
    for (let i = 0; i < eyeCount; i++) circle(ctx, (26 + attack + i * 4) * s, -17 + (i % 2) * 3, 1.8, p.eye, OUTLINE, 0.5);
    poly(ctx, [[(37+attack)*s,-7],[(44+attack)*s,5],[(31+attack)*s,-2]], p.accent || p.web, OUTLINE, 1.2);
    poly(ctx, [[(27+attack)*s,-6],[(20+attack)*s,6],[(34+attack)*s,-2]], p.accent || p.web, OUTLINE, 1.2);
    ctx.save(); ctx.strokeStyle = p.web || p.accent; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.58; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo((-18 + i*8) * s, -17); ctx.quadraticCurveTo((-12 + i*8) * s, -28, (-3 + i*8) * s, -17); ctx.stroke(); } ctx.restore();
    if (variant.isElite) {
      for (let i = -2; i <= 2; i++) poly(ctx, [[(i*8-4)*s,-25],[(i*8)*s,-36],[(i*8+5)*s,-24]], p.venom || p.eye, OUTLINE, 1);
    }
  }

  function drawBoar(ctx, p, pose, dir, variant) {
    const s = dir.side || 1;
    const attack = pose.attack * 10;
    drawGroundShadow(ctx, 38, 10, pose.dead ? 0.22 : 1);
    if (pose.dead) { ellipse(ctx, 0, 5, 42, 18, 0, p.dark, OUTLINE, 2.2); ellipse(ctx, 33*s, 0, 20, 13, 0, p.body, OUTLINE, 2); return; }
    drawQuadrupedLegs(ctx, p, pose, dir, { step: 7, legColor: p.dark, hoofColor: p.deep, positions: [-28,-8,12,28] });
    ellipse(ctx, -5 * s, -15, 45, 19, -0.04*s, p.body, OUTLINE, 2.4);
    ellipse(ctx, 10 * s, -20, 30, 20, 0.03*s, p.dark, OUTLINE, 2.2);
    for (let i = -35; i <= 5; i += 8) poly(ctx, [[i*s,-33],[(i+4)*s,-45],[(i+9)*s,-32]], p.deep, OUTLINE, 1.1);
    ellipse(ctx, (38+attack)*s, -17, 23, 15, -0.08*s, p.light, OUTLINE, 2);
    ellipse(ctx, (53+attack)*s, -11, 15, 8, -0.05*s, p.accent, OUTLINE, 1.8);
    poly(ctx, [[(50+attack)*s,-8],[(67+attack)*s,-18],[(61+attack)*s,-3]], p.tusk, OUTLINE, 1.2);
    poly(ctx, [[(46+attack)*s,-7],[(61+attack)*s,6],[(53+attack)*s,-8]], p.tusk, OUTLINE, 1.2);
    circle(ctx, (42+attack)*s, -22, 2.2, p.eye, OUTLINE, 0.8);
    if (variant.isElite) strokePath(ctx, [[-28*s,-28],[-6*s,-38],[18*s,-33]], p.accent, 2.4, 0.75);
  }

  function stagDetailCurve(ctx, points, color, width = 2, alpha = 1, outline = true) {
    if (!points.length) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (outline) {
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = width + 2;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
      ctx.stroke();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.stroke();
    ctx.restore();
  }

  function drawStagAntlerRack(ctx, p, s, attack, pose, variant) {
    const antler = p.antler || p.accent;
    const bark = shade(antler, -38);
    const moss = variant.isElite ? '#8fb45b' : '#748a4c';
    const rot = colorAlpha(p.deep, 0.82);
    const glow = variant.isElite ? p.accent : (p.eye || '#d8f4bd');
    const baseX = (45 + attack) * s;
    const baseY = -58;
    const rack = variant.isElite ? 1.15 : 1.0;
    const branches = [
      [[baseX, baseY], [(33 + attack) * s, -76], [(22 + attack) * s, -88], [(11 + attack) * s, -84]],
      [[baseX, baseY], [(53 + attack) * s, -78], [(70 + attack) * s, -91], [(82 + attack) * s, -83]],
      [[(34 + attack) * s, -75], [(27 + attack) * s, -96], [(19 + attack) * s, -102]],
      [[(56 + attack) * s, -76], [(68 + attack) * s, -101], [(78 + attack) * s, -106]],
      [[(27 + attack) * s, -85], [(18 + attack) * s, -71], [(11 + attack) * s, -66]],
      [[(65 + attack) * s, -86], [(79 + attack) * s, -73], [(89 + attack) * s, -68]],
      [[(41 + attack) * s, -83], [(40 + attack) * s, -101], [(36 + attack) * s, -112]],
      [[(51 + attack) * s, -84], [(55 + attack) * s, -104], [(60 + attack) * s, -114]]
    ];
    branches.forEach((pts, i) => {
      const scaled = pts.map(([x, y]) => [x, baseY + (y - baseY) * rack]);
      stagDetailCurve(ctx, scaled, i < 2 ? antler : bark, i < 2 ? 4.2 : 2.4, 0.96, true);
    });
    // Bark fissures, bore holes, lichen crusts, thorn/vine wraps, and small death totems.
    for (let i = 0; i < 11; i++) {
      const side = i % 2 ? -1 : 1;
      const x = (35 + attack + side * (7 + i * 2.8)) * s;
      const y = -71 - (i % 5) * 6;
      stagDetailCurve(ctx, [[x, y], [x + side * 5 * s, y - 3], [x + side * 9 * s, y + 1]], colorAlpha(p.deep, 0.68), 0.9, 0.72, false);
      if (i % 3 === 0) circle(ctx, x + side * 4 * s, y + 1, 1.4, moss, OUTLINE, 0.5);
      if (i % 4 === 1) circle(ctx, x - side * 2 * s, y - 1, 1.1, glow, colorAlpha(glow, 0.5), 0.4);
    }
    stagDetailCurve(ctx, [[(31+attack)*s,-75],[(41+attack)*s,-78],[(50+attack)*s,-71],[(62+attack)*s,-76]], '#3d2d20', 1.4, 0.72, false);
    stagDetailCurve(ctx, [[(57+attack)*s,-83],[(64+attack)*s,-79],[(69+attack)*s,-86],[(75+attack)*s,-81]], '#4c3a22', 1.0, 0.75, false);
    // Hanging skull/bone fragments caught in the crown.
    circle(ctx, (72 + attack) * s, -69, 2.4, '#d8cfb1', OUTLINE, 0.7);
    stagDetailCurve(ctx, [[(72+attack)*s,-71],[(71+attack)*s,-77]], '#75664c', 0.8, 0.72, false);
    circle(ctx, (70.8 + attack) * s, -69.2, 0.45, p.deep, p.deep, 0.2);
    circle(ctx, (73.2 + attack) * s, -69.2, 0.45, p.deep, p.deep, 0.2);
  }

  function drawStagLeg(ctx, p, x, y, s, phase, front = true, pose) {
    const bent = Math.sin(phase) * (pose.moving ? 5 : 1.4);
    const kneeY = y + 28 + Math.abs(bent) * 0.25;
    const hoofX = x + bent * 0.55;
    const exposedBone = '#d6cfb7';
    const tendon = shade(p.dark, -22);
    stagDetailCurve(ctx, [[x*s,y],[ (x+2)*s,kneeY ],[hoofX*s,y+61]], p.dark, front ? 5.2 : 4.8, 1, true);
    stagDetailCurve(ctx, [[(x+2)*s,kneeY-7],[(x+5)*s,kneeY+13]], exposedBone, 2.0, 0.72, true);
    stagDetailCurve(ctx, [[(x-2)*s,kneeY-2],[(hoofX-2)*s,y+53]], tendon, 1.1, 0.84, false);
    ellipse(ctx, (hoofX+1)*s, y+65, 6, 2.6, 0.1*s, p.deep, OUTLINE, 1.1);
    stagDetailCurve(ctx, [[(hoofX-4)*s,y+64],[(hoofX-8)*s,y+68]], '#17100b', 0.9, 0.8, false);
    if (front) circle(ctx, (x+2)*s, kneeY, 2.0, colorAlpha(p.eye || '#d8f4bd', 0.48), OUTLINE, 0.5);
  }

  function drawStagRibsAndVoid(ctx, p, s, pose, variant) {
    const glow = p.eye || p.accent;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ellipse(ctx, -6*s, -18, 24, 20, 0.03*s, colorAlpha(glow, 0.22), colorAlpha(glow, 0.10), 0.4);
    ellipse(ctx, -5*s, -18, 12, 11, 0.02*s, colorAlpha(glow, 0.36), colorAlpha(glow, 0.16), 0.3);
    ctx.restore();
    ellipse(ctx, -8*s, -17, 22, 17, 0.02*s, colorAlpha('#090706', 0.88), OUTLINE, 1.7);
    for (let i = 0; i < 7; i++) {
      const ribX = (-27 + i * 6.5) * s;
      const ribY = -30 + Math.abs(i - 3) * 1.8;
      stagDetailCurve(ctx, [[ribX, ribY], [(ribX + 3*s), -20 + i * 0.8], [(ribX + 1*s), -8 + Math.abs(i-3)]], '#d7cab0', 1.8, 0.82, true);
    }
    stagDetailCurve(ctx, [[-31*s,-15],[-18*s,-25],[-5*s,-28],[11*s,-18],[7*s,-5],[-9*s,-1],[-25*s,-5],[-31*s,-15]], p.deep, 1.2, 0.55, false);
    // Torn hide margins and peeled-bark flesh tags.
    for (let i = 0; i < 8; i++) {
      const x = (-28 + i * 7.5) * s;
      const y = i % 2 ? -4 : -32;
      poly(ctx, [[x,y],[(x+4*s),y+(i%2?9:-8)],[(x+8*s),y+(i%2?1:5)]], i % 2 ? p.dark : shade(p.body, -24), OUTLINE, 0.65);
    }
    // Dripping corruption and inner fungal/crystal deposits.
    for (let i = 0; i < 6; i++) {
      const x = (-18 + i * 7) * s;
      const y = -2 + (i % 3) * 2;
      stagDetailCurve(ctx, [[x,y],[x + (i%2?2:-1)*s,y+10+i]], colorAlpha('#151008', 0.82), 1.4, 0.7, false);
      circle(ctx, x, y + 12 + i, 1.3, i % 2 ? '#394a25' : glow, OUTLINE, 0.4);
    }
    for (let i = 0; i < 5; i++) circle(ctx, (-10 + i * 5) * s, -18 + Math.sin(pose.time+i)*3, 1.5, i % 2 ? '#536d3a' : '#2c2218', OUTLINE, 0.35);
  }

  function drawStagHeadAndNeck(ctx, p, s, attack, pose, variant) {
    const glow = p.eye || p.accent;
    const skull = shade(p.light || p.body, 18);
    const mummified = shade(p.body, -14);
    // Burdened neck with visible vertebrae, torn throat, and patchy mane.
    stagDetailCurve(ctx, [[21*s,-28],[31*s,-46],[(39+attack)*s,-54]], p.dark, 10.5, 1, true);
    stagDetailCurve(ctx, [[22*s,-29],[29*s,-43],[(34+attack)*s,-53]], '#d5ccb6', 2.1, 0.72, true);
    for (let i = 0; i < 6; i++) circle(ctx, (23 + i * 2.5 + attack*0.2) * s, -33 - i * 3, 1.4, '#d6cdb9', OUTLINE, 0.45);
    ellipse(ctx, (29+attack*0.3)*s, -37, 5.2, 9.0, -0.14*s, colorAlpha('#0a0705', 0.78), OUTLINE, 0.7);
    for (let i = 0; i < 7; i++) {
      const x = (16 + i * 3.8) * s;
      const y = -32 - i * 3.5 + Math.sin(pose.time+i) * 0.8;
      stagDetailCurve(ctx, [[x,y],[(x-5*s),y-7],[(x-8*s),y-3]], i%2 ? p.deep : p.dark, 2.2, 0.82, true);
    }
    // Elongated skull / mummified head.
    ellipse(ctx, (46+attack)*s, -51, 20, 10.5, -0.10*s, mummified, OUTLINE, 1.7);
    ellipse(ctx, (60+attack)*s, -47, 17, 7.0, -0.04*s, skull, OUTLINE, 1.5);
    poly(ctx, [[(67+attack)*s,-50],[(78+attack)*s,-47],[(70+attack)*s,-42],[(58+attack)*s,-43]], skull, OUTLINE, 1.2);
    ellipse(ctx, (49+attack)*s, -52, 4.5, 3.4, -0.05*s, colorAlpha('#050403', 0.92), OUTLINE, 0.8);
    ctx.save(); ctx.globalCompositeOperation = 'screen'; circle(ctx, (49+attack)*s, -52, 1.5, glow, glow, 0.2); ctx.restore();
    ellipse(ctx, (69+attack)*s, -48, 3.2, 2.0, 0, colorAlpha('#080604', 0.88), OUTLINE, 0.5);
    // Receded lip line / exposed teeth.
    stagDetailCurve(ctx, [[(56+attack)*s,-42],[(66+attack)*s,-40],[(76+attack)*s,-42]], '#120d09', 1.4, 0.8, false);
    for (let i = 0; i < 5; i++) stagDetailCurve(ctx, [[(59+attack+i*3)*s,-41],[(60+attack+i*3)*s,-38]], '#e2d7bd', 0.75, 0.85, false);
    // Torn nasal skin / turbinate suggestion.
    for (let i = 0; i < 3; i++) stagDetailCurve(ctx, [[(64+attack+i*2)*s,-49],[(62+attack+i*3)*s,-45],[(66+attack+i*2)*s,-44]], '#bfb59b', 0.65, 0.6, false);
    drawStagAntlerRack(ctx, p, s, attack, pose, variant);
  }

  function drawStagSurfaceDecay(ctx, p, s, pose, variant) {
    const glow = p.eye || p.accent;
    const moss = '#6f8750';
    const fungus = '#c8b887';
    // Patchy fur, lesions, parasite bumps, blackened veins, lichen and vapor.
    for (let i = 0; i < 18; i++) {
      const x = (-38 + (i * 9) % 78) * s;
      const y = -34 + ((i * 11) % 28);
      if (i % 3 === 0) circle(ctx, x, y, 1.5, moss, OUTLINE, 0.35);
      else if (i % 3 === 1) stagDetailCurve(ctx, [[x,y],[(x+4*s),y+3],[(x+8*s),y-1]], colorAlpha('#11100b', 0.58), 0.9, 0.66, false);
      else circle(ctx, x, y, 1.0, fungus, OUTLINE, 0.28);
    }
    for (let i = 0; i < 10; i++) {
      const x = (-25 + i * 8) * s;
      const y = -5 + Math.sin(pose.time * 0.9 + i) * 2;
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.10 + (i % 3) * 0.05;
      circle(ctx, x, y - 14, 2.0 + (i % 2), glow, glow, 0.2);
      ctx.restore();
    }
    for (let i = 0; i < 5; i++) {
      stagDetailCurve(ctx, [[(-6+i*4)*s,-21],[(-9+i*7)*s,-32 - i]], colorAlpha('#0e2615', 0.44), 0.8, 0.52, false);
    }
  }

  function drawStag(ctx, p, pose, dir, variant) {
    const s = dir.side || 1;
    const attack = pose.attack * 7;
    drawGroundShadow(ctx, variant.isElite ? 47 : 42, 10, pose.dead ? 0.2 : 1);
    if (pose.dead) {
      ellipse(ctx, -5, 5, 45, 15, 0, p.deep, OUTLINE, 2);
      ellipse(ctx, -9*s, -4, 26, 10, 0.02*s, colorAlpha('#080604', 0.90), OUTLINE, 1.2);
      for (let i = 0; i < 6; i++) stagDetailCurve(ctx, [[(-30+i*8)*s,-8],[(-26+i*7)*s,0]], '#d7cab0', 1.6, 0.72, true);
      stagDetailCurve(ctx, [[31*s,-7],[45*s,-22],[58*s,-18],[64*s,-29]], p.antler, 3, 0.76);
      stagDetailCurve(ctx, [[41*s,-22],[31*s,-34]], p.antler, 1.8, 0.76);
      ctx.save(); ctx.globalCompositeOperation = 'screen'; circle(ctx, -3*s, -5, 5, colorAlpha(p.eye || p.accent, 0.25), p.eye || p.accent, 0.2); ctx.restore();
      return;
    }

    const walk = pose.moving ? pose.time * 7 : pose.time * 1.35;
    drawStagLeg(ctx, p, -28, -22, s, walk, true, pose);
    drawStagLeg(ctx, p, -6, -22, s, walk + Math.PI, true, pose);
    drawStagLeg(ctx, p, 15, -23, s, walk + Math.PI * 0.7, false, pose);
    drawStagLeg(ctx, p, 32, -22, s, walk + Math.PI * 1.4, false, pose);

    // Gaunt torso: preserve the original stag footprint but expose corrupted anatomy.
    ellipse(ctx, -8*s, -20, 48, 16, -0.05*s, p.dark, OUTLINE, 2.4);
    ellipse(ctx, 7*s, -22, 32, 12, 0.02*s, colorAlpha(p.body, 0.92), OUTLINE, 1.6);
    stagDetailCurve(ctx, [[-48*s,-31],[-30*s,-37],[-8*s,-36],[14*s,-31],[30*s,-26]], shade(p.light, -10), 1.6, 0.55, false);
    stagDetailCurve(ctx, [[-41*s,-12],[-21*s,-8],[-1*s,-9],[22*s,-13]], shade(p.deep, 8), 1.4, 0.52, false);

    drawStagRibsAndVoid(ctx, p, s, pose, variant);
    drawStagSurfaceDecay(ctx, p, s, pose, variant);
    drawStagHeadAndNeck(ctx, p, s, attack, pose, variant);

    // Corruption drip pool and wilting ground contact under the guardian.
    for (let i = 0; i < 5; i++) ellipse(ctx, (-16 + i * 9) * s, 45 + (i % 2), 5 + (i % 2), 1.4, 0, colorAlpha('#080604', 0.42), colorAlpha('#080604', 0.24), 0.3);
    stagDetailCurve(ctx, [[-40*s,44],[-27*s,47],[-13*s,45],[-3*s,48],[14*s,46]], colorAlpha('#2a3d22', 0.32), 1.0, 0.65, false);
    if (variant.isElite) {
      poly(ctx, [[42*s,-64],[49*s,-78],[56*s,-64]], p.accent, OUTLINE, 1.2);
      stagDetailCurve(ctx, [[23*s,-33],[34*s,-41],[50*s,-36]], p.accent, 2, 0.65);
      ctx.save(); ctx.globalCompositeOperation = 'screen'; circle(ctx, 2*s, -17, 7, colorAlpha(p.accent, 0.22), p.accent, 0.3); ctx.restore();
    }
  }

  function drawRootling(ctx, p, pose, dir, variant) {
    const s = dir.side || 1;
    const sway = Math.sin(pose.time * (pose.moving ? 7 : 2.2)) * (pose.moving ? 4 : 2);
    drawGroundShadow(ctx, 25, 8, pose.dead ? 0.2 : 1);
    if (pose.dead) { ellipse(ctx, 0, 8, 25, 9, 0, p.dark, OUTLINE, 2); for (let i=-2;i<=2;i++) strokePath(ctx, [[i*7,4],[i*10,16]], p.thorn, 3, 0.65); return; }
    strokePath(ctx, [[-10,-2],[-23,17],[-32,22]], p.thorn, 5, 1);
    strokePath(ctx, [[11,-2],[25,16],[34,20]], p.thorn, 5, 1);
    ellipse(ctx, 0, -20 + sway*0.2, 22, 27, 0.02*s, p.body, OUTLINE, 2.2);
    ellipse(ctx, 8*s, -44 + sway*0.35, 18, 15, 0.05*s, p.dark, OUTLINE, 2);
    circle(ctx, 14*s, -47 + sway*0.35, 2.5, p.eye, OUTLINE, 0.6);
    circle(ctx, 5*s, -45 + sway*0.35, 2.0, p.eye, OUTLINE, 0.6);
    for (let i = -2; i <= 2; i++) poly(ctx, [[i*8-4,-47+Math.abs(i)*3], [i*8,-61+Math.abs(i)*2], [i*8+5,-47+Math.abs(i)*3]], p.light, OUTLINE, 1);
    strokePath(ctx, [[-9,-2],[-9+sway,23],[-17,27]], p.dark, 6, 1);
    strokePath(ctx, [[9,-2],[9-sway,23],[18,27]], p.dark, 6, 1);
    if (variant.isElite) strokePath(ctx, [[-16,-29], [0,-38], [17,-28]], p.accent, 2.2, 0.8);
  }

  function drawAshrootRootCurve(ctx, pts, color, width, alpha = 1, ember = null) {
    wispCurve(ctx, pts, color, width, alpha, true);
    if (ember) wispCurve(ctx, pts, ember, Math.max(0.85, width * 0.18), Math.min(0.42, alpha * 0.44), false);
  }

  function drawAshrootWoodGrain(ctx, p, pose, variant, s) {
    const lines = variant.isNamed ? 30 : 24;
    for (let i = 0; i < lines; i++) {
      const side = i % 2 ? -1 : 1;
      const y0 = -104 + i * 5.0;
      const bend = Math.sin(i * 1.73 + pose.time * 0.22) * 3.4;
      const x = (side * (5 + (i % 5) * 3.7) + bend) * s;
      const hot = i % 5 === 0 || (variant.isNamed && i % 7 === 0);
      const color = hot ? (p.ember || p.eye) : (i % 3 === 0 ? p.deep : shade(p.dark, -6));
      const alpha = hot ? 0.56 : 0.42;
      strokePath(ctx, [[x, y0], [x + side * 3.2 * s, y0 + 11], [x - side * 1.5 * s, y0 + 23]], color, hot ? 1.7 : 1.1, alpha);
    }
  }

  function drawAshrootEmberSplit(ctx, p, pose, x, y, h, width, alpha = 1) {
    const pulse = 0.55 + Math.sin(pose.time * 4.4) * 0.18;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = alpha * (0.32 + pulse * 0.26);
    strokePath(ctx, [[x, y], [x + Math.sin(pose.time) * 2.4, y + h * 0.33], [x - 1.8, y + h * 0.66], [x + 2.5, y + h]], p.ember || p.eye, width, 0.82);
    ctx.restore();
  }

  function drawAshrootCharFlakes(ctx, p, pose, x, y, w, h, s, variant) {
    const count = variant.isNamed ? 16 : 12;
    for (let i = 0; i < count; i++) {
      const px = x + (Math.sin(i * 2.41) * 0.5 + (i % 5 - 2) / 4) * w * s;
      const py = y - h * 0.48 + (i / Math.max(1, count - 1)) * h;
      const size = 2.8 + (i % 4) * 1.1;
      const fill = i % 3 === 0 ? p.ash : (i % 3 === 1 ? p.soot : p.deep);
      poly(ctx, [[px - size*s, py - size*0.5], [px + size*0.6*s, py - size*0.25], [px + size*0.45*s, py + size*0.65], [px - size*0.55*s, py + size*0.45]], fill, colorAlpha('#070504', 0.62), 0.5);
    }
  }

  function drawAshrootLeg(ctx, p, pose, s, side, variant) {
    const walk = pose.moving ? Math.sin(pose.time * 6.3 + (side > 0 ? Math.PI : 0)) : 0;
    const hipX = side * 13 * s;
    const kneeX = side * (18 + walk * 4) * s;
    const kneeY = -10 + Math.abs(walk) * 2;
    const ankleX = side * (11 - walk * 3) * s;
    const footY = 38;
    const footX = side * (18 - walk * 4) * s;
    // Heavy, awkward tree-trunk legs with healed branch-fork bends.
    drawAshrootRootCurve(ctx, [hipX, -37, kneeX, -18, ankleX, 4, footX, footY - 4], side > 0 ? p.dark : p.body, variant.isNamed ? 11 : 9.5, 0.98, p.ember);
    drawAshrootRootCurve(ctx, [hipX - side * 3*s, -33, kneeX + side * 4*s, -13, ankleX - side * 2*s, 6, footX + side * 6*s, footY], p.soot || p.deep, variant.isNamed ? 6.4 : 5.2, 0.80, null);
    // Split gripping feet, not trailing roots.
    for (let i = -1; i <= 1; i++) {
      const toeX = footX + side * (6 + i * 5) * s;
      poly(ctx, [[footX - side*3*s, footY-3], [toeX + side*12*s, footY + 5 + Math.abs(i)*2], [toeX + side*4*s, footY + 8], [footX - side*6*s, footY+2]], i === 0 ? p.thorn : p.deep, OUTLINE, 1.1);
    }
    drawAshrootEmberSplit(ctx, p, pose, kneeX + side * 2*s, -9, 24, 1.3, 0.55);
  }

  function drawAshrootSplinterHand(ctx, p, pose, x, y, s, side, variant) {
    const talonCount = variant.isNamed ? 4 : 3;
    for (let i = 0; i < talonCount; i++) {
      const spread = (i - (talonCount - 1) / 2) * 5.4;
      const len = 22 + i * 2 + (variant.isNamed ? 4 : 0);
      const tipX = x + side * (len + Math.abs(spread) * 0.6) * s;
      const tipY = y + 9 + spread + Math.sin(pose.time * 1.6 + i) * 1.2;
      poly(ctx, [[x + side*2*s, y + spread*0.25], [x + side*(9+i)*s, y + spread*0.55], [tipX, tipY], [x + side*5*s, y + spread*0.9 + 4]], i % 2 ? p.deep : p.thorn, OUTLINE, 0.9);
      if (i % 2 === 0) drawAshrootEmberSplit(ctx, p, pose, x + side * (9+i) * s, y + spread*0.5, 12, 0.8, 0.38);
    }
  }

  function drawAshrootArm(ctx, p, pose, s, side, variant) {
    const attackReach = pose.attack * (variant.isNamed ? 18 : 14);
    const swing = pose.moving ? Math.sin(pose.time * 5.7 + (side > 0 ? 0.4 : Math.PI)) * 5 : Math.sin(pose.time * 1.2 + side) * 2.4;
    const shoulderX = side * 27 * s;
    const shoulderY = -76;
    const elbowX = side * (47 + attackReach * 0.45 + swing) * s;
    const elbowY = -43 + (side > 0 ? pose.attack * 4 : -pose.attack * 2);
    const handX = side * (38 + attackReach + swing * 0.4) * s;
    const handY = -3 + pose.attack * 7 + Math.abs(swing) * 0.35;
    // Long, below-knee branch arms. One side deliberately longer.
    const thick = (side > 0 ? 9.8 : 8.4) + (variant.isNamed ? 2.2 : 0);
    drawAshrootRootCurve(ctx, [shoulderX, shoulderY, elbowX, elbowY, handX, handY], side > 0 ? p.dark : p.body, thick, 0.98, p.ember);
    drawAshrootRootCurve(ctx, [shoulderX - side*4*s, shoulderY + 5, elbowX - side*3*s, elbowY + 9, handX - side*2*s, handY + 4], p.soot || p.deep, thick * 0.48, 0.76, null);
    // Burned branch stubs along the arm read as thorns/spines, not vines.
    for (let i = 0; i < 4; i++) {
      const t = (i + 1) / 5;
      const bx = shoulderX + (handX - shoulderX) * t;
      const by = shoulderY + (handY - shoulderY) * t - 4;
      const out = (i % 2 ? 1 : -1) * side;
      poly(ctx, [[bx, by], [bx + out * (9+i*2) * s, by - 4 - i], [bx + out * 3 * s, by + 5]], p.thorn, OUTLINE, 0.75);
    }
    drawAshrootSplinterHand(ctx, p, pose, handX, handY, s, side, variant);
  }

  function drawAshrootBackSpines(ctx, p, pose, s, variant) {
    const count = variant.isNamed ? 9 : 7;
    for (let i = 0; i < count; i++) {
      const y = -104 + i * 10;
      const x = (-6 + Math.sin(i * 1.3) * 8) * s;
      const len = 11 + (i % 4) * 5;
      const lean = i % 2 ? -1 : 1;
      poly(ctx, [[x, y], [x + lean * len * s, y - 8 - (i % 2) * 4], [x + lean * 3 * s, y + 7]], i % 3 === 0 ? p.soot : p.thorn, OUTLINE, 0.9);
    }
    drawAshrootEmberSplit(ctx, p, pose, 0, -113, 94, variant.isNamed ? 2.4 : 1.9, 0.76);
  }

  function drawAshrootTorso(ctx, p, pose, s, variant) {
    const sway = Math.sin(pose.time * 1.25) * (variant.isNamed ? 2.8 : 2.0);
    // Fused burned trunk torso: tall, lean, hunched, with no root mass silhouette.
    const trunk = [
      [-27*s, -35], [-34*s, -61], [-29*s, -92], [-18*s, -115], [0, -122 + sway], [18*s, -113], [29*s, -88], [32*s, -57], [24*s, -31], [8*s, -23], [-11*s, -25]
    ];
    poly(ctx, trunk, p.dark, OUTLINE, 2.8);
    poly(ctx, [[-18*s,-34],[-23*s,-70],[-16*s,-105],[-4*s,-117],[4*s,-104],[3*s,-61],[-2*s,-29]], p.soot || p.deep, colorAlpha('#070504',0.82), 1.3);
    poly(ctx, [[9*s,-30],[15*s,-65],[12*s,-102],[23*s,-90],[25*s,-52],[17*s,-27]], p.body, colorAlpha('#080504',0.74), 1.2);
    // Burned-through chest hole and ember fissures.
    ellipse(ctx, 4*s, -66 + sway*0.2, 10, 20, 0.08*s, p.soot || p.deep, OUTLINE, 1.9);
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.24 + Math.sin(pose.time * 4.2) * 0.05; ellipse(ctx, 4*s, -66, 6.5, 15, 0.1*s, p.ember || p.eye, p.ember || p.eye, 0.4); ctx.restore();
    drawAshrootEmberSplit(ctx, p, pose, -6*s, -111, 77, variant.isNamed ? 2.7 : 2.1, 0.88);
    drawAshrootEmberSplit(ctx, p, pose, 16*s, -92, 46, 1.5, 0.56);
    // Accidental ribcage made of broken branch stubs.
    for (let i = -2; i <= 2; i++) {
      const y = -81 + i * 9;
      const len = 12 - Math.abs(i) * 1.4;
      poly(ctx, [[-18*s, y], [(-18-len)*s, y + 2], [(-20)*s, y + 6]], p.thorn, OUTLINE, 0.7);
      poly(ctx, [[17*s, y+1], [(18+len)*s, y + 4], [19*s, y + 7]], p.thorn, OUTLINE, 0.7);
    }
    drawAshrootWoodGrain(ctx, p, pose, variant, s);
    drawAshrootCharFlakes(ctx, p, pose, 0, -72, 52, 88, s, variant);
  }

  function drawAshrootHead(ctx, p, pose, s, variant) {
    const bob = Math.sin(pose.time * 1.25) * 1.4 + pose.attack * 2;
    const x = -3 * s;
    const y = -129 + bob;
    // No neck: a shattered stump/burl wedged between shoulders.
    const points = [[-19*s,y+6],[-24*s,y-10],[-16*s,y-27],[-4*s,y-34],[10*s,y-29],[22*s,y-12],[17*s,y+8],[4*s,y+15]];
    poly(ctx, points, p.soot || p.deep, OUTLINE, 2.4);
    ellipse(ctx, -5*s, y-9, 17, 24, 0.06*s, p.dark, colorAlpha('#090605',0.88), 1.6);
    // Face is damage: split crack, knothole eyes, screaming mouth-like bottom gap.
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.52 + Math.sin(pose.time * 5.1) * 0.08;
    strokePath(ctx, [[x, y-31], [x + 3*s, y-17], [x - 1*s, y-4], [x + 5*s, y+11]], p.ember || p.eye, 2.7, 0.86);
    ellipse(ctx, -8*s, y-14, 3.8, 5.8, -0.2*s, p.ember || p.eye, p.ember || p.eye, 0.4);
    ellipse(ctx, 8*s, y-12, 4.4, 6.4, 0.15*s, p.ember || p.eye, p.ember || p.eye, 0.4);
    ellipse(ctx, 2*s, y+5, 5.5, 9, 0.05*s, p.ember || p.eye, p.ember || p.eye, 0.4);
    ctx.restore();
    ellipse(ctx, -8*s, y-14, 5.5, 7.5, -0.2*s, colorAlpha('#070403',0.82), OUTLINE, 0.8);
    ellipse(ctx, 8*s, y-12, 5.8, 7.8, 0.15*s, colorAlpha('#070403',0.82), OUTLINE, 0.8);
    // Splintered crack edges exposing pale hot inner wood.
    for (let i = -3; i <= 3; i++) {
      const py = y - 29 + (i + 3) * 6.4;
      const side = i % 2 ? -1 : 1;
      poly(ctx, [[x + side*1.8*s, py], [x + side*(9 + Math.abs(i))*s, py + 2], [x + side*3*s, py + 5]], i % 2 ? p.living : p.accent, OUTLINE, 0.6);
    }
    // Small never-extinguished flames from upper crack.
    for (let i = 0; i < 3; i++) {
      const fx = (-7 + i * 7) * s;
      const fy = y - 34 - i * 2;
      poly(ctx, [[fx, fy+8], [fx + (i-1)*2*s, fy - 5 - Math.sin(pose.time*4+i)*2], [fx + 4*s, fy+6]], i === 1 ? (p.eye || p.ember) : (p.ember || p.eye), null, 0);
    }
  }

  function drawAshrootSmokeAndAsh(ctx, p, pose, variant) {
    const smokeColor = p.smoke || '#c8c0b4';
    const sources = [[-4,-132], [11,-96], [-13,-72], [22,-46], [-20,-110]];
    for (let i = 0; i < sources.length; i++) {
      const [sx, sy] = sources[i];
      const phase = pose.time * 0.9 + i * 0.87;
      wispCurve(ctx, [sx, sy, sx + Math.sin(phase) * 9, sy - 15, sx - 10, sy - 30, sx + 5, sy - 43], smokeColor, 1.25 + (i % 2) * 0.7, 0.12 + (i % 3) * 0.035, false);
    }
    for (let i = 0; i < 28; i++) {
      const phase = pose.time * 1.2 + i * 1.91;
      const x = Math.sin(phase) * (24 + (i % 5) * 5);
      const y = -102 + (i % 11) * 13 + Math.cos(phase * 0.7) * 3;
      ctx.save();
      ctx.globalAlpha = 0.16 + (i % 3) * 0.04;
      circle(ctx, x, y, 0.9 + (i % 3) * 0.38, i % 8 === 0 ? (p.ember || p.eye) : (p.ash || p.light), 'rgba(20,16,12,0.18)', 0.25);
      ctx.restore();
    }
  }

  function drawDeadroot(ctx, p, pose, dir, variant) {
    const s = dir.side || 1;
    const rootPulse = 0.5 + Math.sin(pose.time * 4.2) * 0.5;
    drawGroundShadow(ctx, variant.isNamed ? 43 : 36, variant.isNamed ? 12 : 10, pose.dead ? 0.18 : 1);
    if (pose.dead) {
      ellipse(ctx, 0, 13, 44, 13, -0.05 * s, p.soot || p.deep, OUTLINE, 2);
      poly(ctx, [[-32*s,4],[-18*s,-8],[2*s,-2],[21*s,-13],[36*s,-2],[18*s,10],[-5*s,9]], p.dark, OUTLINE, 1.8);
      for (let i = -3; i <= 3; i++) {
        const x = i * 9 * s;
        strokePath(ctx, [[x, 5], [x + Math.sin(i) * 5, 17]], i % 2 ? p.thorn : p.ash, i % 2 ? 2.4 : 1.3, 0.55);
      }
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.22; ellipse(ctx, 2*s, 0, 12, 5, 0, p.ember || p.eye, p.ember || p.eye, 0.5); ctx.restore();
      return;
    }

    // A burned tree that stood up: humanoid silhouette, no trailing root mass or vine halo.
    drawAshrootLeg(ctx, p, pose, s, -1, variant);
    drawAshrootLeg(ctx, p, pose, s, 1, variant);
    drawAshrootBackSpines(ctx, p, pose, s, variant);
    drawAshrootArm(ctx, p, pose, s, -1, variant);
    drawAshrootArm(ctx, p, pose, s, 1, variant);
    drawAshrootTorso(ctx, p, pose, s, variant);
    drawAshrootHead(ctx, p, pose, s, variant);

    // Ember vents and heat pulse concentrated in face, chest, back, and finger cracks.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.18 + rootPulse * 0.12;
    ellipse(ctx, 0, -76, variant.isNamed ? 27 : 21, 58, 0, p.ember || p.eye, p.ember || p.eye, 0.4);
    ctx.restore();
    drawAshrootSmokeAndAsh(ctx, p, pose, variant);

    // Ash settled on shoulders/head and shaken loose around the feet.
    for (let i = 0; i < 7; i++) {
      ctx.save(); ctx.globalAlpha = 0.24; ellipse(ctx, -24 + i * 8, -112 + (i % 2) * 4, 5, 1.4, 0.1, p.ash || p.light, 'rgba(40,32,24,0.2)', 0.35); ctx.restore();
    }
    for (let i = 0; i < 8; i++) {
      ctx.save(); ctx.globalAlpha = 0.22; ellipse(ctx, -38 + i * 11, 43 + (i % 2), 8, 2.2, 0.08, p.ash || p.light, 'rgba(40,32,24,0.2)', 0.35); ctx.restore();
    }
    if (variant.isElite) {
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = variant.isNamed ? 0.34 : 0.25; ellipse(ctx, 0, -78, 32, 64, 0, p.ember || p.eye, p.ember || p.eye, 0.5); ctx.restore();
      strokePath(ctx, [[-21*s,-120],[-7*s,-139],[5*s,-121],[22*s,-137],[26*s,-114]], p.accent, 2.4, 0.62);
    }
  }

  function colorAlpha(color, alpha) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(color || ''));
    if (!m) return color || `rgba(255,255,255,${alpha})`;
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, alpha))})`;
  }

  function wispCurve(ctx, points, color, width = 2, alpha = 1, outline = false) {
    if (!points || points.length < 4) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (outline) {
      ctx.strokeStyle = colorAlpha('#17110b', Math.min(0.45, alpha));
      ctx.lineWidth = width + 2.4;
      ctx.beginPath();
      ctx.moveTo(points[0], points[1]);
      if (points.length >= 8) ctx.bezierCurveTo(points[2], points[3], points[4], points[5], points[6], points[7]);
      else ctx.quadraticCurveTo(points[2], points[3], points[4], points[5]);
      ctx.stroke();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    if (points.length >= 8) ctx.bezierCurveTo(points[2], points[3], points[4], points[5], points[6], points[7]);
    else ctx.quadraticCurveTo(points[2], points[3], points[4], points[5]);
    ctx.stroke();
    ctx.restore();
  }

  function wispMote(ctx, x, y, r, fill, alpha = 1, stroke = null) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(0.45, r * 0.42);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWispVortexBands(ctx, p, pose, dir, variant, wobble, twist) {
    const s = dir.side || 1;
    const core = p.core || p.glow || p.accent || p.light;
    const sand = p.sand || p.body;
    const bands = variant.isElite ? 10 : 8;
    for (let i = 0; i < bands; i++) {
      const phase = twist + i * 0.74;
      const y0 = 0 - i * 7.4;
      const radius = 27 - i * 1.6 + Math.sin(phase) * 2.2;
      const x0 = Math.sin(phase) * radius * 0.36 * s;
      const x1 = Math.cos(phase * 0.82) * (radius + 8) * s;
      const x2 = -Math.sin(phase + 0.8) * (radius + 14) * s;
      const y2 = -15 - i * 6.2 + wobble * 0.12;
      const color = i % 3 === 0 ? p.light : (i % 3 === 1 ? sand : p.dark);
      wispCurve(ctx, [x0, y0, x1, y0 - 11, x2, y2 - 7, -x0 * 0.54, y2 - 19], color, i % 2 ? 2.1 : 2.8, 0.28 + (i % 3) * 0.08, true);
      if (i % 2 === 0) wispCurve(ctx, [-x0 * 0.7, y2 - 5, -x2 * 0.9, y2 - 15, x1 * 0.55, y2 - 25, x0 * 0.2, y2 - 33], core, 1.0, 0.22, false);
    }
  }

  function drawWispParticleCloud(ctx, p, pose, dir, variant, wobble, twist) {
    const s = dir.side || 1;
    const sand = p.sand || p.body;
    const debris = p.debris || p.deep || p.dark;
    const core = p.core || p.glow || p.accent || p.light;
    const count = variant.isElite ? 38 : 30;
    for (let i = 0; i < count; i++) {
      const phase = twist * (0.75 + (i % 5) * 0.03) + i * 1.618;
      const ring = i % 7;
      const radius = 8 + ring * 4.9 + (i % 3) * 1.8;
      const y = -10 - (i % 11) * 5.4 + Math.sin(phase * 1.7) * 2.8 + wobble * 0.08;
      const x = Math.sin(phase) * radius * (0.74 + (i % 4) * 0.06) + (ring > 4 ? s * 5 : 0);
      const r = (i % 9 === 0 ? 2.1 : i % 5 === 0 ? 1.45 : 0.95) * (variant.isElite && i % 8 === 0 ? 1.25 : 1);
      const fill = i % 9 === 0 ? debris : (i % 6 === 0 ? core : sand);
      wispMote(ctx, x, y, r, fill, i % 6 === 0 ? 0.74 : 0.46, i % 9 === 0 ? colorAlpha('#170f08', 0.48) : null);
    }
  }

  function drawWispStaticAndEnergy(ctx, p, pose, dir, variant, wobble, twist) {
    const s = dir.side || 1;
    const spark = p.spark || p.eye || p.accent || '#fff3ad';
    const core = p.core || p.glow || p.accent || p.light;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < (variant.isElite ? 6 : 4); i++) {
      const phase = twist * 1.45 + i * 1.22;
      const x = Math.sin(phase) * (15 + i * 3.8) * s;
      const y = -34 - i * 5 + Math.cos(phase * 1.3) * 3 + wobble * 0.08;
      wispCurve(ctx, [x, y, x + 4 * s, y - 4, x + 8 * s, y + 2, x + 13 * s, y - 6], spark, i % 2 ? 0.8 : 1.1, 0.42, false);
    }
    // Loose luminous containment cage around the nucleus.
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = 0.20 + i * 0.06;
      ctx.strokeStyle = core;
      ctx.lineWidth = 0.9 + i * 0.25;
      ctx.beginPath();
      ctx.ellipse(Math.sin(twist + i) * 1.6, -37 + wobble * 0.05, 13 + i * 3, 21 - i * 2, 0.46 * s + i * 0.32, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWispDebrisAndFallout(ctx, p, pose, dir, variant, wobble, twist) {
    const s = dir.side || 1;
    const debris = p.debris || p.deep || p.dark;
    const sand = p.sand || p.body;
    for (let i = 0; i < 18; i++) {
      const phase = twist * 0.65 + i * 0.92;
      const x = Math.sin(phase) * (13 + (i % 5) * 7) * (i % 2 ? 1 : s);
      const y = -1 + (i % 6) * 4.4 + Math.cos(phase) * 1.6;
      const r = i % 5 === 0 ? 1.8 : 0.9;
      wispMote(ctx, x, y, r, i % 4 === 0 ? debris : sand, 0.34);
    }
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = colorAlpha(sand, 0.62);
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 8 + i * 2, 30 + i * 6, 6 + i, 0.08 * Math.sin(twist + i), 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWisp(ctx, p, pose, dir, variant) {
    const s = dir.side || 1;
    const wobble = Math.sin(pose.time * 4.2) * 5;
    const twist = pose.time * (pose.moving ? 2.9 : 1.75) + (pose.attacking ? 0.55 : 0) + (pose.casting ? 0.95 : 0);
    const core = p.core || p.glow || p.accent || p.light;
    const glow = p.glow || p.body;
    const sand = p.sand || p.body;
    const debris = p.debris || p.deep || p.dark;
    const opacity = variant.isElite ? 1.12 : 1;

    drawGroundShadow(ctx, variant.isElite ? 37 : 31, 9, pose.dead ? 0.22 : 0.54);
    if (pose.dead) {
      ctx.save();
      ctx.globalAlpha = 0.52;
      ellipse(ctx, 0, 7, 35, 7, 0, colorAlpha(debris, 0.68), colorAlpha(core, 0.34), 1.2);
      ctx.restore();
      drawWispDebrisAndFallout(ctx, p, pose, dir, variant, 0, twist);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      wispMote(ctx, 0, 0, 4.5, core, 0.28);
      ctx.restore();
      return;
    }

    // Ambient translucent particulate envelope: preserves the original hovering wisp silhouette while adding volumetric depth.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = (variant.isElite ? 0.24 : 0.17) * opacity;
    ellipse(ctx, 0, -36 + wobble * 0.22, variant.isElite ? 42 : 35, variant.isElite ? 48 : 40, 0.03 * s, glow, glow, 0.5);
    ctx.globalAlpha = 0.10 * opacity;
    ellipse(ctx, -5 * s, -30 + wobble * 0.1, variant.isElite ? 52 : 43, variant.isElite ? 35 : 28, -0.25 * s, sand, sand, 0.5);
    ctx.restore();

    // Lower dust-devil base and ground interaction.
    ctx.save();
    ctx.globalAlpha = 0.38;
    ellipse(ctx, 0, 3, variant.isElite ? 34 : 29, 12, 0.05 * Math.sin(twist), colorAlpha(sand, 0.44), colorAlpha(debris, 0.36), 1.1);
    ctx.restore();
    for (let i = 0; i < 6; i++) {
      const a = twist + i * 0.88;
      wispCurve(ctx, [Math.sin(a) * 22, 6 + Math.cos(a) * 2, Math.cos(a) * 34, 2, -Math.sin(a) * 18, -6 - i * 2, Math.sin(a + 1.4) * 11, -13 - i * 3], i % 2 ? p.dark : sand, 1.3 + (i % 2) * 0.7, 0.25, false);
    }

    // Soft body density lobes. These replace the old hard polygon body with layered dust density.
    ctx.save();
    ctx.globalAlpha = 0.34 * opacity;
    ellipse(ctx, 0, -29 + wobble * 0.16, 24, 34, 0.04 * s, colorAlpha(p.dark, 0.72), colorAlpha(debris, 0.36), 1.0);
    ctx.globalAlpha = 0.28 * opacity;
    ellipse(ctx, -4 * s, -43 + wobble * 0.22, 20, 24, -0.12 * s, colorAlpha(p.body, 0.68), colorAlpha(debris, 0.26), 0.8);
    ctx.globalAlpha = 0.22 * opacity;
    ellipse(ctx, 5 * s, -54 + wobble * 0.26, 19, 17, 0.18 * s, colorAlpha(p.light, 0.62), colorAlpha(debris, 0.22), 0.8);
    ctx.restore();

    drawWispVortexBands(ctx, p, pose, dir, variant, wobble, twist);

    // Vague arms: soft particulate streamers attached to the torso, never separated as solid limbs.
    const reach = pose.attacking ? 9 : pose.casting ? 6 : 0;
    wispCurve(ctx, [-14 * s, -40 + wobble * 0.12, (-33 - reach) * s, -50, (-44 - reach) * s, -30, (-54 - reach) * s, -24], p.dark, 8, 0.22, true);
    wispCurve(ctx, [-10 * s, -39 + wobble * 0.16, (-30 - reach) * s, -48, (-44 - reach) * s, -32, (-58 - reach) * s, -24], sand, 3.4, 0.44, false);
    wispCurve(ctx, [16 * s, -36 + wobble * 0.10, (32 + reach * 0.4) * s, -27, (22 + reach) * s, -18, (8 + reach) * s, -22], p.light, 4.2, 0.34, true);
    for (let i = 0; i < 4; i++) {
      const sign = i % 2 ? 1 : -1;
      wispCurve(ctx, [(-56 - reach) * s, -24, (-64 - i * 2) * s, -18 + i * 4, (-66 - i) * s, -10 + i * 3], i % 2 ? p.light : sand, 1.1, 0.32, false);
      wispCurve(ctx, [(9 + reach) * s, -22, (18 + i * 3) * s, -18 + sign * i, (24 + i * 5) * s, -14 + i * 2], i % 2 ? sand : p.light, 1.0, 0.26, false);
    }

    // Core consciousness: clearing zone, darker nucleus, amber/ochre glow, motes, and elemental containment threads.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.30 + Math.sin(pose.time * 2.1) * 0.05;
    ellipse(ctx, 0, -37 + wobble * 0.05, 18, 23, 0, core, core, 0.5);
    ctx.globalAlpha = 0.55;
    wispMote(ctx, 0, -37 + wobble * 0.05, 7.5, core, 0.78);
    wispMote(ctx, -1.5 * s, -37 + wobble * 0.04, 3.1, debris, 0.62);
    ctx.restore();
    drawWispStaticAndEnergy(ctx, p, pose, dir, variant, wobble, twist);

    // Head and face suggestion: dimples, eye hollows, unresolved jaw break.
    ctx.save();
    ctx.globalAlpha = 0.36;
    ellipse(ctx, 1 * s, -58 + wobble * 0.3, 20, 18, 0.1 * s, colorAlpha(p.dark, 0.58), colorAlpha(debris, 0.24), 0.9);
    ctx.globalAlpha = 0.34;
    ellipse(ctx, -5 * s, -60 + wobble * 0.24, 5.8, 4.7, -0.15 * s, colorAlpha(p.deep, 0.76), colorAlpha(core, 0.28), 0.5);
    ellipse(ctx, 7 * s, -60 + wobble * 0.24, 5.1, 4.4, 0.12 * s, colorAlpha(p.deep, 0.72), colorAlpha(core, 0.28), 0.5);
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    wispMote(ctx, -5 * s, -60 + wobble * 0.25, 1.7, p.eye || core, 0.78);
    wispMote(ctx, 7 * s, -60 + wobble * 0.25, 1.5, p.eye || core, 0.72);
    wispCurve(ctx, [1 * s, -57, 4 * s, -53, 2 * s, -49], core, 0.8, 0.18, false);
    wispCurve(ctx, [-8 * s, -48, -1 * s, -46, 10 * s, -48], debris, 1.0, 0.22, false);
    ctx.restore();

    drawWispParticleCloud(ctx, p, pose, dir, variant, wobble, twist);
    drawWispDebrisAndFallout(ctx, p, pose, dir, variant, wobble, twist);

    if (variant.isElite) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = p.accent || core;
      ctx.globalAlpha = variant.isNamed ? 0.64 : 0.48;
      ctx.lineWidth = variant.isNamed ? 2.4 : 1.8;
      ctx.beginPath();
      ctx.ellipse(0, -36, 40, 14, Math.sin(twist) * 0.06, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBat(ctx, p, pose, dir, variant) {
    const s = dir.side || 1;
    const flap = Math.sin(pose.time * (pose.moving ? 14 : 7)) * 13;
    drawGroundShadow(ctx, 21, 6, 0.42);
    if (pose.dead) { ellipse(ctx, 0, 5, 25, 8, 0, p.dark, OUTLINE, 2); return; }
    poly(ctx, [[-10*s,-29],[-47*s,-43+flap],[-34*s,-17],[-18*s,-12]], p.wing || p.dark, OUTLINE, 1.7);
    poly(ctx, [[10*s,-29],[47*s,-43+flap],[34*s,-17],[18*s,-12]], p.wing || p.dark, OUTLINE, 1.7);
    ellipse(ctx, 0, -27, 15, 19, 0, p.body, OUTLINE, 2);
    poly(ctx, [[-7,-43],[-3,-56],[2,-43]], p.dark, OUTLINE, 1.2);
    poly(ctx, [[7,-43],[13,-55],[14,-41]], p.dark, OUTLINE, 1.2);
    circle(ctx, -4*s, -32, 2.2, p.eye, OUTLINE, 0.6); circle(ctx, 5*s, -32, 2.2, p.eye, OUTLINE, 0.6);
    if (variant.isElite) strokePath(ctx, [[-18*s,-13],[0,-4],[18*s,-13]], p.accent, 2, 0.7);
  }

  function drawSkeleton(ctx, p, pose, dir, variant) {
    const s = dir.side || 1;
    const step = pose.moving ? Math.sin(pose.step) * 6 : 0;
    const swing = pose.attack * 18;
    drawGroundShadow(ctx, 25, 7, pose.dead ? 0.18 : 1);
    if (pose.dead) { for (let i=-2;i<=2;i++) ellipse(ctx, i*9, 7 + (i%2)*2, 9, 4, 0, p.body, OUTLINE, 1); return; }
    strokePath(ctx, [[-7,-4],[-10+step*0.2,24]], p.body, 5, 1); strokePath(ctx, [[8,-4],[12-step*0.2,24]], p.body, 5, 1);
    ellipse(ctx, 0, -26, 15, 24, 0, p.body, OUTLINE, 2);
    for (let i=-2;i<=2;i++) strokePath(ctx, [[i*5,-24],[i*6,-5]], p.light, 2, 0.86);
    circle(ctx, 4*s, -56, 18, p.light, OUTLINE, 2);
    circle(ctx, -3*s, -59, 3.2, p.deep, p.deep, 0.5); circle(ctx, 8*s, -58, 3.2, p.deep, p.deep, 0.5);
    strokePath(ctx, [[-13*s,-32],[(-34-swing)*s,-20],[(-45-swing)*s,-7]], p.body, 5, 1);
    strokePath(ctx, [[13*s,-32],[(31+swing)*s,-15],[(48+swing)*s,-23]], variant.isElite ? p.accent : p.body, 5, 1);
    strokePath(ctx, [[(49+swing)*s,-25],[(57+swing)*s,-55]], p.accent || p.metal || p.light, variant.isElite ? 5 : 3.2, 1);
    if (variant.isElite) poly(ctx, [[-13,-76],[0,-91],[13,-76]], p.accent, OUTLINE, 1.4);
  }

  function drawCrystalCrawler(ctx, p, pose, dir, variant) {
    const s = dir.side || 1;
    drawGroundShadow(ctx, 33, 8, pose.dead ? 0.2 : 1);
    if (pose.dead) { ellipse(ctx, 0, 6, 34, 10, 0, p.dark, OUTLINE, 2); for (let i=-2;i<=2;i++) poly(ctx, [[i*11,1],[i*11+5,-13],[i*11+11,3]], p.crystal, OUTLINE, 1); return; }
    drawQuadrupedLegs(ctx, p, pose, dir, { step: 5, legColor:p.dark, hoofColor:p.deep, positions:[-25,-8,9,25] });
    ellipse(ctx, -5*s, -12, 37, 17, 0.05*s, p.dark, OUTLINE, 2.2);
    ellipse(ctx, 21*s, -14, 20, 12, -0.05*s, p.body, OUTLINE, 2);
    for (let i=-3;i<=3;i++) poly(ctx, [[(i*10-4)*s,-25+Math.abs(i)*2],[(i*10+1)*s,-48+Math.abs(i)*2],[(i*10+7)*s,-24+Math.abs(i)*2]], i%2 ? p.light : p.crystal, OUTLINE, 1.1);
    circle(ctx, 28*s, -17, 2.4, p.eye, OUTLINE, 0.6);
    if (variant.isElite) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.28; ellipse(ctx, 0, -18, 42, 18, 0, p.crystal, p.crystal, 1); ctx.restore(); }
  }

  function drawBandit(ctx, p, pose, dir, variant) {
    const s = dir.side || 1;
    const step = pose.moving ? Math.sin(pose.step) * 5 : 0;
    const swing = pose.attack * 16;
    drawGroundShadow(ctx, 24, 7, pose.dead ? 0.18 : 1);
    if (pose.dead) { ellipse(ctx, 0, 8, 31, 8, -0.12*s, p.dark, OUTLINE, 2); return; }
    strokePath(ctx, [[-7,-1],[-10+step*0.2,26]], p.dark, 6, 1); strokePath(ctx, [[8,-1],[13-step*0.2,26]], p.dark, 6, 1);
    poly(ctx, [[-17,-43],[12,-47],[22,-8],[3,4],[-20,-7]], p.body, OUTLINE, 2.2);
    poly(ctx, [[-13,-39],[6,-43],[15,-13],[0,-4],[-16,-13]], p.cloth, OUTLINE, 1.6);
    circle(ctx, 4*s, -62, 16, p.light, OUTLINE, 2);
    poly(ctx, [[-15,-65],[-2,-81],[16,-69],[13,-55],[-14,-54]], p.cloth, OUTLINE, 1.8);
    circle(ctx, 8*s, -63, 2.3, p.eye, OUTLINE, 0.7);
    strokePath(ctx, [[-13*s,-33], [(-32-swing)*s,-19], [(-43-swing)*s,-6]], p.body, 5, 1);
    strokePath(ctx, [[15*s,-33], [(34+swing)*s,-20], [(55+swing)*s,-30]], p.body, 5, 1);
    strokePath(ctx, [[(55+swing)*s,-32],[(68+swing)*s,-52]], p.metal || p.accent, variant.isElite ? 4.5 : 3.2, 1);
    if (variant.isElite) poly(ctx, [[-18,-48],[0,-56],[19,-48],[12,-38],[-12,-38]], p.accent, OUTLINE, 1.3);
  }

  const DRAWERS = Object.freeze({ wolf: drawWolf, spider: drawSpider, boar: drawBoar, stag: drawStag, rootling: drawRootling, deadroot: drawDeadroot, wisp: drawWisp, bat: drawBat, skeleton: drawSkeleton, crystalCrawler: drawCrystalCrawler, bandit: drawBandit, rotling: drawRootling });

  function rendererForKey(key) { const base = DARK_WOODS_MOB_VISUALS[key]; return base?.renderer || null; }
  function supportedActions() { return ['idle', 'walk', 'attack', 'hit', 'death', 'cast', 'rangedAttack', 'charge', 'specialAttack', 'leap', 'webSpit', 'howl']; }
  function supportedDirections() { return ['north','northeast','east','southeast','south','southwest','west','northwest']; }

  function drawDedicatedWolfFamily(ctx, actor, base, visualKey, pose, variant, scale, nowMs) {
    const wolfModel = DR.render?.WolfProceduralModel || window.WolfProceduralModel;
    if (!wolfModel?.draw) return false;
    const wolfActor = {
      ...actor,
      rendererId: 'wolf',
      family: actor.family || actor.baseType?.family || 'wolf',
      mobVisualKey: actor.mobVisualKey || actor.baseType?.mobVisualKey || visualKey || 'gloomWolf',
      wolfVisualKey: actor.mobVisualKey || actor.baseType?.mobVisualKey || visualKey || 'gloomWolf',
      wolfPalette: base.palette || 'gloom',
      wolfVariant: variant,
      isNamed: variant.isNamed,
      isRare: variant.isRare,
      isElite: variant.isElite,
      visualScale: scale,
      screenX: Number(actor.screenX || 0),
      screenY: Number(actor.screenY || 0),
      action: pose.action === 'cast' ? 'howl' : pose.action,
      isMoving: pose.moving,
      alive: !pose.dead,
      dead: pose.dead,
      attackAnim: Number(actor.attackAnim || 0),
      hitAnim: Number(actor.hitAnim || actor.hitReaction || actor.damageAnim || 0)
    };
    const ok = wolfModel.draw(ctx, wolfActor, nowMs);
    if (!ok) return false;
    actor._nameplateAnchor = wolfActor._nameplateAnchor || {
      x: Number(actor.screenX || 0),
      y: Number(actor.screenY || 0) - Number(base.anchorY || 91) * scale
    };
    actor._darkWoodsMobVisualKey = wolfActor._wolfVisualKey || wolfActor.mobVisualKey || 'gloomWolf';
    actor._darkWoodsMobRenderer = 'wolfDedicated';
    actor._darkWoodsMobAction = wolfActor._wolfAction || pose.action;
    actor._wolfDedicatedRenderer = true;
    return true;
  }



  function drawDedicatedRotlingFamily(ctx, actor, base, visualKey, pose, variant, scale, nowMs) {
    const rotlingModel = DR.render?.RotlingProceduralModel || window.RotlingProceduralModel;
    if (!rotlingModel?.draw) return false;
    const rawAction = pose.action === 'cast' ? 'corruptionCast' : pose.action;
    const rotlingActor = {
      ...actor,
      rendererId: 'rotling',
      family: actor.family || actor.baseType?.family || 'rotling',
      mobVisualKey: actor.mobVisualKey || actor.baseType?.mobVisualKey || visualKey || 'rotling',
      rotlingVisualKey: actor.mobVisualKey || actor.baseType?.mobVisualKey || visualKey || 'rotling',
      rotlingPalette: base.palette || 'rotling',
      rotlingVariant: variant,
      isNamed: variant.isNamed,
      isRare: variant.isRare,
      isElite: variant.isElite,
      visualScale: scale,
      screenX: Number(actor.screenX || 0),
      screenY: Number(actor.screenY || 0),
      action: rawAction,
      isMoving: pose.moving,
      alive: !pose.dead,
      dead: pose.dead,
      attackAnim: Number(actor.attackAnim || 0),
      spellCastAnim: Number(actor.spellCastAnim || 0),
      hitAnim: Number(actor.hitAnim || actor.hitReaction || actor.damageAnim || 0)
    };
    const ok = rotlingModel.draw(ctx, rotlingActor, nowMs);
    if (!ok) return false;
    actor._nameplateAnchor = rotlingActor._nameplateAnchor || {
      x: Number(actor.screenX || 0),
      y: Number(actor.screenY || 0) - Number(base.anchorY || 82) * scale
    };
    actor._darkWoodsMobVisualKey = rotlingActor._rotlingVisualKey || rotlingActor.mobVisualKey || visualKey || 'rotling';
    actor._darkWoodsMobRenderer = 'rotlingDedicated';
    actor._darkWoodsMobAction = rotlingActor._rotlingAction || rawAction;
    actor._rotlingDedicatedRenderer = true;
    return true;
  }

  function drawDedicatedBoarFamily(ctx, actor, base, visualKey, pose, variant, scale, nowMs) {
    const boarModel = DR.render?.BoarProceduralModel || window.BoarProceduralModel;
    if (!boarModel?.draw) return false;
    const action = pose.action === 'cast' ? 'charge' : (pose.action === 'attack' && String(actor?.aiProfile || actor?.baseType?.aiProfile || '').toLowerCase().includes('charge') ? 'charge' : pose.action);
    const boarActor = {
      ...actor,
      rendererId: 'boar',
      family: actor.family || actor.baseType?.family || 'boar',
      mobVisualKey: actor.mobVisualKey || actor.baseType?.mobVisualKey || visualKey || 'briarBoar',
      boarVisualKey: actor.mobVisualKey || actor.baseType?.mobVisualKey || visualKey || 'briarBoar',
      boarPalette: base.palette || 'mudTusker',
      boarVariant: variant,
      isNamed: variant.isNamed,
      isRare: variant.isRare,
      isElite: variant.isElite,
      visualScale: scale,
      screenX: Number(actor.screenX || 0),
      screenY: Number(actor.screenY || 0),
      action,
      isMoving: pose.moving,
      alive: !pose.dead,
      dead: pose.dead,
      attackAnim: Number(actor.attackAnim || 0),
      hitAnim: Number(actor.hitAnim || actor.hitReaction || actor.damageAnim || 0)
    };
    const ok = boarModel.draw(ctx, boarActor, nowMs);
    if (!ok) return false;
    actor._nameplateAnchor = boarActor._nameplateAnchor || {
      x: Number(actor.screenX || 0),
      y: Number(actor.screenY || 0) - Number(base.anchorY || 88) * scale
    };
    actor._darkWoodsMobVisualKey = boarActor._boarVisualKey || boarActor.mobVisualKey || visualKey || 'briarBoar';
    actor._darkWoodsMobRenderer = 'boarDedicated';
    actor._darkWoodsMobAction = boarActor._boarAction || action;
    actor._boarDedicatedRenderer = true;
    return true;
  }

  function draw(ctx, actor, nowMs = performance.now()) {
    if (!ctx || !actor) return false;
    const key = visualKeyFor(actor);
    const base = DARK_WOODS_MOB_VISUALS[key];
    if (!base) return false;
    const drawer = DRAWERS[base.renderer];
    if (!drawer && base.renderer !== 'wolf' && base.renderer !== 'boar' && base.renderer !== 'rotling') return false;
    const palette = PALETTES[base.palette] || PALETTES.gloom;
    const pose = poseFor(actor, nowMs);
    const dir = facingProfile(actor);
    const variant = variantFor(actor, base);
    const scale = variant.scale * Number(actor.modelScale || actor.visualScale || actor.baseType?.visualScale || 1);

    if (base.renderer === 'wolf' && drawDedicatedWolfFamily(ctx, actor, base, key, pose, variant, scale, nowMs)) {
      return true;
    }
    if (base.renderer === 'rotling' && drawDedicatedRotlingFamily(ctx, actor, base, key, pose, variant, scale, nowMs)) {
      return true;
    }
    if (base.renderer === 'boar' && drawDedicatedBoarFamily(ctx, actor, base, key, pose, variant, scale, nowMs)) {
      return true;
    }

    ctx.save();
    ctx.translate(Math.round(actor.screenX || 0), Math.round((actor.screenY || 0) + pose.bob));
    ctx.scale(scale, scale);
    if (pose.hit) ctx.translate((dir.side || 1) * -pose.hitAmt * 4, -pose.hitAmt * 2);
    drawEliteAura(ctx, palette, variant, base.renderer === 'deadroot' ? 50 : 42);
    drawer(ctx, palette, pose, dir, variant);
    ctx.restore();
    actor._nameplateAnchor = {
      x: Number(actor.screenX || 0),
      y: Number(actor.screenY || 0) - Number(base.anchorY || 88) * scale
    };
    actor._darkWoodsMobVisualKey = key;
    actor._darkWoodsMobRenderer = base.renderer;
    actor._darkWoodsMobAction = pose.action;
    return true;
  }

  DR.DARK_WOODS_MOB_VISUALS = DARK_WOODS_MOB_VISUALS;
  DR.render.DarkWoodsMobProceduralModel = { canDraw, draw, visualKeyFor, rendererForKey, supportedActions, supportedDirections, DARK_WOODS_MOB_VISUALS };
  window.DarkWoodsMobProceduralModel = DR.render.DarkWoodsMobProceduralModel;
})();
