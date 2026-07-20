(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};

  DR.ENEMY_TYPES = [
    { name: 'Gloom Wolf', rendererId: 'wolf', mobVisualKey: 'gloomWolf', visualScale: 1.0, animationProfile: 'quadrupedPredator', family: 'wolf', wolfPalette: 'gloom', color: '#52605f', hp: 48, attack: 8, defense: 2, speed: 2.2, xp: 14, gold: 3, aiProfile: 'pack_hunter', threatTag: 'Pack Melee' },
    { name: 'Rotling', rendererId: 'rotling', mobVisualKey: 'rotling', rotlingPalette: 'rotling', visualScale: 0.98, animationProfile: 'rotlingCreep', targetClickWidthPx: 68, targetClickHeightPx: 92, targetAnchorHeightPx: 78, color: '#597034', hp: 38, attack: 6, defense: 1, speed: 1.7, xp: 11, gold: 2, aiProfile: 'swarm_snare', threatTag: 'Snare Swarm' },
    { name: 'Thorn Widow', rendererId: 'spider', mobVisualKey: 'thornWidow', visualScale: 1.0, animationProfile: 'arachnidSkitter', color: '#7b6d87', hp: 56, attack: 10, defense: 2, speed: 1.9, xp: 17, gold: 4, aiProfile: 'cave_ambusher', threatTag: 'Venom' },
    { name: 'Hollow Stag', rendererId: 'stag', mobVisualKey: 'hollowStag', visualScale: 1.08, animationProfile: 'deepwoodBruiser', color: '#8b7654', hp: 68, attack: 11, defense: 3, speed: 1.6, xp: 20, gold: 5, aiProfile: 'deepwood_bruiser', threatTag: 'Cleave Bruiser' },
    { name: 'Grave Wisp', rendererId: 'wisp', mobVisualKey: 'graveWisp', visualScale: 1.0, animationProfile: 'floatingCaster', color: '#95b8c4', hp: 44, attack: 12, defense: 1, speed: 2.0, xp: 19, gold: 4, aiProfile: 'ranged_caster', threatTag: 'Ranged Spirit' },
    { name: 'Briar Boar', rendererId: 'boar', mobVisualKey: 'briarBoar', boarPalette: 'mudTusker', visualScale: 1.05, animationProfile: 'heavyBeastCharge', color: '#8e6a46', hp: 72, attack: 11, defense: 4, speed: 1.8, xp: 20, gold: 5, aiProfile: 'charger', threatTag: 'Charge Melee' },
    { name: 'Duskwisp', rendererId: 'wisp', mobVisualKey: 'duskwisp', visualScale: 1.0, animationProfile: 'floatingCaster', color: '#80c9ff', hp: 62, attack: 14, defense: 2, speed: 2.05, xp: 28, gold: 8, aiProfile: 'ranged_caster', threatTag: 'Ranged Spirit' },
    { name: 'Ashroot Horror', rendererId: 'deadroot', mobVisualKey: 'ashrootHorror', visualScale: 1.22, animationProfile: 'corruptedPlantBruiser', family: 'ashroot', color: '#6f6659', hp: 190, attack: 22, defense: 8, speed: 1.35, xp: 90, gold: 20, elite: true, aiProfile: 'ashroot_horror_elite', threatTag: 'Elite Root', abilities: ['Ashroot Crush', 'Ash Cloud', 'Death Bloom', 'Cinderroot Snare', 'Blightwood Pulse', 'Ashen Regrowth'] }
    ,
    { name: 'Cave Bat', rendererId: 'bat', mobVisualKey: 'caveBat', visualScale: 0.94, animationProfile: 'flyingSkirmisher', color: '#4d4655', hp: 36, attack: 7, defense: 1, speed: 2.7, xp: 13, gold: 3, aiProfile: 'skirmisher', threatTag: 'Fast Flier' },
    { name: 'Webling Skitterer', rendererId: 'spider', mobVisualKey: 'weblingSkitterer', visualScale: 0.94, animationProfile: 'arachnidSkitter', color: '#b58ad0', hp: 46, attack: 9, defense: 1, speed: 2.35, xp: 16, gold: 4, aiProfile: 'cave_ambusher', threatTag: 'Web Swarm' },
    { name: 'Bone Watcher', rendererId: 'skeleton', mobVisualKey: 'boneWatcher', visualScale: 1.04, animationProfile: 'undeadHumanoid', color: '#c8c0a7', hp: 82, attack: 15, defense: 4, speed: 1.55, xp: 34, gold: 8, aiProfile: 'crypt_guard', threatTag: 'Undead Guard' },
    { name: 'Crystal Crawler', rendererId: 'crystalCrawler', mobVisualKey: 'crystalCrawler', visualScale: 1.06, animationProfile: 'crystalCrawler', color: '#70d8e6', hp: 96, attack: 17, defense: 6, speed: 1.45, xp: 42, gold: 10, aiProfile: 'crystal_brute', threatTag: 'Crystal Bruiser' },
    { name: 'Mine Husk', rendererId: 'skeleton', mobVisualKey: 'mineHusk', visualScale: 1.08, animationProfile: 'undeadHumanoid', color: '#9a7c55', hp: 108, attack: 18, defense: 5, speed: 1.35, xp: 46, gold: 11, aiProfile: 'mine_stalker', threatTag: 'Mine Undead' }

  ];

  DR.ENEMY_TYPES.push(
    { name: 'Webbed Cave Skitterer Elite', family: 'silk_web_spider', color: '#b58ad0', hp: 118, attack: 17, defense: 5, speed: 2.45, xp: 52, gold: 14, aiProfile: 'silk_web_fast_melee', threatTag: 'Elite Spider', elite: true, spiderFamily: true, lootTableId: 'loot_silk_web_cavern_elites' },
    { name: 'Silkfang Stalker Elite', family: 'silk_web_spider', color: '#c08ac6', hp: 136, attack: 19, defense: 6, speed: 2.15, xp: 58, gold: 16, aiProfile: 'silk_web_bleed', threatTag: 'Elite Bleed Spider', elite: true, spiderFamily: true, lootTableId: 'loot_silk_web_cavern_elites' },
    { name: 'Venom Sac Spider Elite', family: 'silk_web_spider', color: '#8fd06e', hp: 124, attack: 22, defense: 4, speed: 1.9, xp: 64, gold: 17, aiProfile: 'silk_web_poison_caster', threatTag: 'Elite Venom Caster', elite: true, spiderFamily: true, lootTableId: 'loot_silk_web_cavern_elites' },
    { name: 'Cocoon Crawler Elite', family: 'silk_web_spider', color: '#d9c2ef', hp: 154, attack: 18, defense: 8, speed: 1.7, xp: 66, gold: 18, aiProfile: 'silk_web_rooter', threatTag: 'Elite Cocoon Binder', elite: true, spiderFamily: true, lootTableId: 'loot_silk_web_cavern_elites' },
    { name: 'Webguard Spinner Elite', family: 'silk_web_spider', color: '#8f77af', hp: 178, attack: 20, defense: 11, speed: 1.55, xp: 72, gold: 20, aiProfile: 'silk_web_guard', threatTag: 'Elite Webguard', elite: true, spiderFamily: true, lootTableId: 'loot_silk_web_cavern_elites' },
    { name: 'Brood Spinner Elite', family: 'silk_web_spider', color: '#cf9eff', hp: 164, attack: 25, defense: 7, speed: 1.85, xp: 84, gold: 24, aiProfile: 'silk_web_ranged_web', threatTag: 'Elite Web Caster', elite: true, spiderFamily: true, lootTableId: 'loot_silk_web_cavern_elites' },
    { name: 'Pale Cave Widow Elite', family: 'silk_web_spider', color: '#e0d4fa', hp: 176, attack: 27, defense: 8, speed: 2.0, xp: 92, gold: 28, aiProfile: 'silk_web_poison_dot', threatTag: 'Elite Widow', elite: true, spiderFamily: true, lootTableId: 'loot_silk_web_cavern_elites' },
    { name: 'Hatchery Defender Elite', family: 'silk_web_spider', color: '#a486c0', hp: 230, attack: 24, defense: 14, speed: 1.45, xp: 96, gold: 30, aiProfile: 'silk_web_hatchery_tank', threatTag: 'Elite Hatchery Guard', elite: true, spiderFamily: true, lootTableId: 'loot_silk_web_cavern_elites' },
    { name: 'Cocoon Binder Elite', family: 'silk_web_spider', color: '#c7b2dc', hp: 188, attack: 24, defense: 9, speed: 1.65, xp: 98, gold: 30, aiProfile: 'silk_web_binder', threatTag: 'Elite Control Spider', elite: true, spiderFamily: true, lootTableId: 'loot_silk_web_cavern_elites' },
    { name: 'Venom Burster Elite', family: 'silk_web_spider', color: '#9bd86f', hp: 152, attack: 30, defense: 6, speed: 2.1, xp: 104, gold: 32, aiProfile: 'silk_web_burster', threatTag: 'Elite Burster', elite: true, spiderFamily: true, lootTableId: 'loot_silk_web_cavern_elites' },
    { name: 'Royal Webguard Elite', family: 'silk_web_spider', color: '#a87ddf', hp: 260, attack: 31, defense: 16, speed: 1.45, xp: 130, gold: 42, aiProfile: 'silk_web_royal_guard', threatTag: 'Royal Elite Guard', elite: true, spiderFamily: true, lootTableId: 'loot_silk_web_cavern_elites' },
    { name: "Queen's Silk Reaver Elite", family: 'silk_web_spider', color: '#d87cbf', hp: 228, attack: 38, defense: 11, speed: 2.0, xp: 138, gold: 45, aiProfile: 'silk_web_reaver', threatTag: 'Royal Reaver', elite: true, spiderFamily: true, lootTableId: 'loot_silk_web_cavern_elites' },
    { name: 'Gloom Brood Oracle Elite', family: 'silk_web_spider', color: '#7bd088', hp: 204, attack: 40, defense: 9, speed: 1.75, xp: 142, gold: 46, aiProfile: 'silk_web_oracle', threatTag: 'Royal Venom Caster', elite: true, spiderFamily: true, lootTableId: 'loot_silk_web_cavern_elites' },
    { name: 'Chitin Horror Elite', family: 'silk_web_spider', color: '#916f59', hp: 310, attack: 36, defense: 18, speed: 1.3, xp: 152, gold: 50, aiProfile: 'silk_web_chitin_brute', threatTag: 'Royal Brute', elite: true, spiderFamily: true, lootTableId: 'loot_silk_web_cavern_elites' },
    { name: 'Loom Spinner Elite', family: 'silk_web_spider', color: '#ff9de8', hp: 218, attack: 36, defense: 10, speed: 1.65, xp: 150, gold: 48, aiProfile: 'silk_web_loom_control', threatTag: 'Royal Control Spider', elite: true, spiderFamily: true, lootTableId: 'loot_silk_web_cavern_elites' }
  );


  DR.BOSS_DRAFTS = [
    {
      id: 'boss_hollow_warden',
      name: 'Hollow Warden',
      family: 'crypt_guardian',
      levelOffset: 1,
      hp: 540,
      attack: 28,
      defense: 11,
      speed: 1.55,
      xp: 320,
      gold: { min: 55, max: 95 },
      color: '#7e8f72',
      lootTableId: 'loot_boss_hollow_warden',
      abilities: [
        { id: 'warden_cleave', name: 'Warden Cleave', kind: 'cleave', damageScale: 1.20, radius: 2.1, cooldown: 4.2 },
        { id: 'grave_pulse', name: 'Grave Pulse', kind: 'aoe', damageScale: 0.82, radius: 4.2, cooldown: 6.4 }
      ],
      notes: 'Floor guardian boss for Gloom\'s Crypt.'
    },
    {
      id: 'boss_rootbound_matriarch',
      name: 'Rootbound Matriarch',
      family: 'root_boss',
      levelOffset: 2,
      hp: 660,
      attack: 31,
      defense: 13,
      speed: 1.35,
      xp: 410,
      gold: { min: 70, max: 125 },
      color: '#6c8d48',
      lootTableId: 'loot_boss_rootbound_matriarch',
      abilities: [
        { id: 'root_snare_burst', name: 'Root Snare Burst', kind: 'aoe', damageScale: 0.74, radius: 5.0, cooldown: 5.7 },
        { id: 'thorn_slam', name: 'Thorn Slam', kind: 'cleave', damageScale: 1.35, radius: 2.4, cooldown: 4.8 }
      ],
      notes: 'Mid-crypt root boss.'
    },
    {
      id: 'boss_gloom_king',
      name: 'Gloom King',
      family: 'crypt_lord',
      levelOffset: 3,
      hp: 820,
      attack: 36,
      defense: 15,
      speed: 1.45,
      xp: 560,
      gold: { min: 110, max: 190 },
      color: '#67507f',
      lootTableId: 'loot_boss_gloom_king',
      abilities: [
        { id: 'royal_decay', name: 'Royal Decay', kind: 'aoe', damageScale: 0.95, radius: 5.6, cooldown: 6.2 },
        { id: 'king_breaker', name: 'King Breaker', kind: 'cleave', damageScale: 1.48, radius: 2.6, cooldown: 4.6 }
      ],
      notes: 'Final Gloom\'s Crypt boss.'
    },
    {
      id: 'boss_silk_mother',
      name: 'Silk Mother',
      family: 'spider_boss',
      levelOffset: 2,
      hp: 620,
      attack: 30,
      defense: 10,
      speed: 1.8,
      xp: 390,
      gold: { min: 65, max: 120 },
      color: '#a46fc6',
      lootTableId: 'loot_boss_silk_mother',
      abilities: [
        { id: 'web_nova', name: 'Web Nova', kind: 'aoe', damageScale: 0.72, radius: 5.2, cooldown: 5.2 },
        { id: 'venom_lunge', name: 'Venom Lunge', kind: 'cleave', damageScale: 1.34, radius: 2.3, cooldown: 4.0 }
      ],
      notes: 'Spider boss for Silk Web Depths.'
    }
  ];

  DR.BOSS_DRAFTS.push(
    {
      id: 'boss_broodwarden_skirr',
      name: 'Broodwarden Skirr',
      family: 'silk_web_boss', levelOffset: 1, hp: 980, attack: 38, defense: 16, speed: 1.95, xp: 580,
      gold: { min: 150, max: 240 }, color: '#c28cff', lootTableId: 'loot_boss_broodwarden_skirr',
      abilities: [
        { id: 'web_snare', name: 'Web Snare', kind: 'snare', damageScale: 0.35, radius: 5.0, cooldown: 4.2, status: 'webbed' },
        { id: 'venomous_lunge', name: 'Venomous Lunge', kind: 'lunge', damageScale: 1.35, radius: 2.8, cooldown: 4.8, status: 'poisoned' },
        { id: 'brood_call', name: 'Brood Call', kind: 'summon_adds', summonCount: 2, cooldown: 8.5 },
        { id: 'silk_carapace', name: 'Silk Carapace', kind: 'shield', cooldown: 9.5 },
        { id: 'skirr_frenzy', name: 'Frenzy', kind: 'frenzy', cooldown: 12.0 }
      ],
      notes: 'Floor 1 boss for Silk Web Cavern. Movement, poison, and add-control tutorial.'
    },
    {
      id: 'boss_matron_velyra',
      name: 'Matron Velyra, the Cocoon-Seer',
      family: 'silk_web_boss', levelOffset: 2, hp: 1280, attack: 46, defense: 18, speed: 1.75, xp: 780,
      gold: { min: 220, max: 340 }, color: '#d8b4ff', lootTableId: 'loot_boss_matron_velyra',
      abilities: [
        { id: 'cocoon_prison', name: 'Cocoon Prison', kind: 'cocoon_prison', damageScale: 0.25, radius: 6.0, cooldown: 8.0 },
        { id: 'hatchling_burst', name: 'Hatchling Burst', kind: 'summon_adds', summonCount: 3, cooldown: 9.0 },
        { id: 'poison_cloud', name: 'Poison Cloud', kind: 'poison_cloud', damageScale: 0.85, radius: 5.2, cooldown: 6.5 },
        { id: 'thread_link', name: 'Thread Link', kind: 'shield', cooldown: 10.0 },
        { id: 'webbed_retreat', name: 'Webbed Retreat', kind: 'retreat', cooldown: 11.0 }
      ],
      notes: 'Floor 2 control and add-management boss for Silk Web Cavern.'
    },
    {
      id: 'boss_queen_arakhzel',
      name: "Queen Arakh'Zel, the Looming Hunger",
      family: 'silk_web_boss', levelOffset: 3, hp: 1680, attack: 56, defense: 23, speed: 1.65, xp: 1120,
      gold: { min: 360, max: 560 }, color: '#ff85d6', lootTableId: 'loot_boss_queen_arakhzel',
      abilities: [
        { id: 'loom_of_silk', name: 'Loom of Silk', kind: 'silk_lines', damageScale: 0.55, radius: 6.5, cooldown: 6.5 },
        { id: 'venom_rain', name: 'Venom Rain', kind: 'venom_rain', damageScale: 0.92, radius: 7.2, cooldown: 7.2 },
        { id: 'devour_cocoon', name: 'Devour Cocoon', kind: 'boss_heal', cooldown: 10.5 },
        { id: 'royal_brood', name: 'Royal Brood', kind: 'phase_adds', summonCount: 3, cooldown: 9.0 },
        { id: 'webquake', name: 'Webquake', kind: 'aoe', damageScale: 1.15, radius: 7.0, cooldown: 8.0 },
        { id: 'queens_hunger', name: "Queen's Hunger", kind: 'frenzy', cooldown: 12.0 }
      ],
      notes: 'Final Silk Web Cavern boss. Positioning, adds, healing throughput, and hazard awareness.'
    },
    { id: 'miniboss_threadjaw_alpha', name: 'Threadjaw Alpha', family: 'silk_web_miniboss', levelOffset: 0, hp: 420, attack: 31, defense: 11, speed: 2.0, xp: 210, gold: { min: 60, max: 110 }, color: '#b778aa', lootTableId: 'loot_silk_web_cavern_minibosses', abilities: [{ id:'threadjaw_bite', name:'Ripping Bite', kind:'cleave', damageScale:1.25, radius:2.4, cooldown:4.5 }] },
    { id: 'miniboss_old_venomsac', name: 'Old Venomsac', family: 'silk_web_miniboss', levelOffset: 0, hp: 390, attack: 34, defense: 8, speed: 1.55, xp: 220, gold: { min: 65, max: 120 }, color: '#98d664', lootTableId: 'loot_silk_web_cavern_minibosses', abilities: [{ id:'venom_pool', name:'Venom Pool', kind:'poison_cloud', damageScale:.8, radius:4.5, cooldown:5.5 }] },
    { id: 'miniboss_cocoon_tender', name: 'The Cocoon Tender', family: 'silk_web_miniboss', levelOffset: 0, hp: 520, attack: 34, defense: 15, speed: 1.35, xp: 275, gold: { min: 80, max: 140 }, color: '#d1bddf', lootTableId: 'loot_silk_web_cavern_minibosses', abilities: [{ id:'cocoon_shield', name:'Cocoon Shield', kind:'shield', cooldown:6.5 }] },
    { id: 'miniboss_pale_spinner_yssra', name: 'Pale Spinner Yssra', family: 'silk_web_miniboss', levelOffset: 0, hp: 470, attack: 38, defense: 10, speed: 1.75, xp: 285, gold: { min: 84, max: 145 }, color: '#e1d6fa', lootTableId: 'loot_silk_web_cavern_minibosses', abilities: [{ id:'silencing_web', name:'Silencing Web', kind:'snare', radius:5.4, cooldown:5.2 }] },
    { id: 'miniboss_hollowfang_broodsire', name: 'Hollowfang Brood-Sire', family: 'silk_web_miniboss', levelOffset: 0, hp: 560, attack: 44, defense: 13, speed: 2.0, xp: 300, gold: { min: 90, max: 155 }, color: '#b27a8c', lootTableId: 'loot_silk_web_cavern_minibosses', abilities: [{ id:'broodsire_burst', name:'Brood-Sire Burst', kind:'cleave', damageScale:1.55, radius:2.8, cooldown:4.8 }] },
    { id: 'miniboss_chitinmaw', name: 'Chitinmaw', family: 'silk_web_miniboss', levelOffset: 0, hp: 680, attack: 48, defense: 18, speed: 1.45, xp: 340, gold: { min: 110, max: 180 }, color: '#9b725e', lootTableId: 'loot_silk_web_cavern_minibosses', abilities: [{ id:'armor_break', name:'Armor Break', kind:'cleave', damageScale:1.35, radius:2.8, cooldown:4.2 }] },
    { id: 'miniboss_widow_of_the_loom', name: 'Widow of the Loom', family: 'silk_web_miniboss', levelOffset: 0, hp: 620, attack: 50, defense: 13, speed: 1.8, xp: 350, gold: { min: 112, max: 190 }, color: '#cc78c2', lootTableId: 'loot_silk_web_cavern_minibosses', abilities: [{ id:'stacking_poison', name:'Stacking Poison', kind:'poison_cloud', damageScale:.95, radius:5.0, cooldown:5.2 }] },
    { id: 'miniboss_venom_eye_oracle', name: 'Venom-Eye Oracle', family: 'silk_web_miniboss', levelOffset: 0, hp: 610, attack: 54, defense: 12, speed: 1.6, xp: 360, gold: { min: 120, max: 200 }, color: '#7ed77b', lootTableId: 'loot_silk_web_cavern_minibosses', abilities: [{ id:'venom_bolt_curse', name:'Venom Bolt Curse', kind:'aoe', damageScale:.92, radius:5.6, cooldown:5.5 }] },
    { id: 'miniboss_egg_heart', name: 'The Egg-Heart', family: 'silk_web_miniboss', levelOffset: 0, hp: 900, attack: 38, defense: 20, speed: 0.2, xp: 380, gold: { min: 130, max: 220 }, color: '#f1bfd8', lootTableId: 'loot_silk_web_cavern_minibosses', abilities: [{ id:'egg_wave', name:'Egg Wave', kind:'summon_adds', summonCount:4, cooldown:8.5 }] }
  );


  DR.BOSS_BY_ID = Object.fromEntries(DR.BOSS_DRAFTS.map(boss => [boss.id, boss]));
})();
