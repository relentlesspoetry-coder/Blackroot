// Dream Realms canonical playable race registry.
(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};

  const races = {
    human: {
      id: 'human', name: 'Human', description: 'Adaptable survivors found across the settled lands.',
      lore: 'Humans thrive through persistence, cooperation, and a willingness to learn from every land they settle.',
      statMods: { strength: 0, dexterity: 0, stamina: 0, intelligence: 0, wisdom: 0 },
      recommendedClasses: ['Paladin', 'Warden', 'Fighter', 'Rogue', 'Ranger', 'Assassin', 'Wizard', 'Shaman', 'Summoner', 'Necromancer', 'Cleric', 'Druid', 'Bard', 'Enchanter'],
      palettes: { settled: { name: 'Settled Lands', skin: '#d8a87e', accent: '#8ec9ff' } }, defaultPaletteId: 'settled',
      rendererKey: 'human_existing', equipmentAnchorProfile: 'human'
    },
    elf: {
      id: 'elf', name: 'Elf', description: 'Forest-born wanderers with sharp senses and old magic.',
      lore: 'Elves carry the memory of old forests and follow moonlit paths between wild places and settled lands.',
      statMods: { strength: -1, dexterity: 2, stamina: -1, intelligence: 1, wisdom: 1 },
      recommendedClasses: ['Druid','Ranger','Bard','Enchanter','Wizard','Rogue','Cleric','Shaman'],
      palettes: { forest: { name: 'Forest Born', skin: '#e0b889', accent: '#75c985' } }, defaultPaletteId: 'forest',
      rendererKey: 'elf_existing_or_humanoid_variant', equipmentAnchorProfile: 'elf'
    },
    bogling: {
      id: 'bogling', name: 'Bogling', description: 'Amphibious swampfolk from flooded reedlands, moss temples, drowned ruins, and rain-soaked marshes.',
      lore: 'Boglings are amphibious swampfolk from flooded reedlands, moss temples, drowned ruins, and rain-heavy marshlands. Outsiders underestimate them as simple bog-dwellers, but Boglings are skilled swimmers, poison-resistant survivors, and gifted spirit-speakers tied to mud, rain, insects, old swamp spirits, and sunken temples.',
      statMods: { strength: -1, dexterity: 1, stamina: 1, intelligence: 0, wisdom: 2 },
      recommendedClasses: ['Shaman','Druid','Warden','Ranger','Cleric','Necromancer'],
      palettes: {
        marsh_green:{name:'Marsh Green',spriteVariantId:'marsh_green',skin:'#4f8b55',skinMain:'#4f8b55',skinShadow:'#28543a',skinHighlight:'#86bd70',belly:'#b2c982',throatPouch:'#c2b978',webbing:'#88ad66',spot:'#254d32',spots:'#254d32',ridge:'#397044',iris:'#e0c75b',mouth:'#542f3c',wetHighlight:'rgba(209,255,226,.42)'},
        mossback:{name:'Mossback',spriteVariantId:'mossback',skin:'#3f6842',skinMain:'#3f6842',skinShadow:'#273c2c',skinHighlight:'#71885a',belly:'#a49d6b',throatPouch:'#9b875f',webbing:'#687849',spot:'#4b4628',spots:'#4b4628',ridge:'#304f32',iris:'#d6a84e',mouth:'#4b2a31',wetHighlight:'rgba(202,231,190,.34)'},
        yellow_reed:{name:'Reed Pale',spriteVariantId:'reed_pale',skin:'#aeb65e',skinMain:'#aeb65e',skinShadow:'#74763b',skinHighlight:'#d8d58c',belly:'#eee0ad',throatPouch:'#d8c789',webbing:'#c3bf72',spot:'#666b35',spots:'#666b35',ridge:'#8b9147',iris:'#825f2d',mouth:'#6b3b3d',wetHighlight:'rgba(255,250,201,.46)'},
        blue_pond:{name:'Blue Fen',spriteVariantId:'blue_fen',skin:'#438590',skinMain:'#438590',skinShadow:'#28515f',skinHighlight:'#78bac0',belly:'#a9d5cb',throatPouch:'#8fc7bd',webbing:'#62a5a4',spot:'#244b5c',spots:'#244b5c',ridge:'#326d78',iris:'#e3d269',mouth:'#493247',wetHighlight:'rgba(205,255,255,.48)'},
        dark_mud:{name:'Mud Brown',spriteVariantId:'mud_brown',skin:'#625b3e',skinMain:'#625b3e',skinShadow:'#383425',skinHighlight:'#948763',belly:'#b6a77c',throatPouch:'#a58e6b',webbing:'#807653',spot:'#2f3022',spots:'#2f3022',ridge:'#49472f',iris:'#d4ad55',mouth:'#482b2c',wetHighlight:'rgba(225,218,180,.32)'},
        night_marsh:{name:'Night Marsh',spriteVariantId:'night_marsh',skin:'#243f42',skinMain:'#243f42',skinShadow:'#14272f',skinHighlight:'#456d68',belly:'#718b78',throatPouch:'#526f68',webbing:'#395c58',spot:'#101f28',spots:'#101f28',ridge:'#1b3237',iris:'#f0c34c',mouth:'#351f32',wetHighlight:'rgba(158,222,218,.38)'},
        red_poison_dart:{name:'Amber Bog',spriteVariantId:'amber_bog',skin:'#bd793a',skinMain:'#bd793a',skinShadow:'#754429',skinHighlight:'#e3a45e',belly:'#e6bd7a',throatPouch:'#d69c63',webbing:'#c5894b',spot:'#6d3828',spots:'#6d3828',ridge:'#914d2d',iris:'#463522',mouth:'#5f2831',wetHighlight:'rgba(255,226,166,.44)'},
        pale_cave:{name:'Mist Albino',spriteVariantId:'mist_albino',skin:'#d8d3bf',skinMain:'#d8d3bf',skinShadow:'#9b9992',skinHighlight:'#f5f0df',belly:'#f3e9d2',throatPouch:'#ddb6b5',webbing:'#d8c5bd',spot:'#898b8c',spots:'#898b8c',ridge:'#b6b3a8',iris:'#c95f72',mouth:'#74414f',wetHighlight:'rgba(255,255,255,.58)'}
      }, defaultPaletteId: 'marsh_green', rendererKey: 'bogling', equipmentAnchorProfile: 'bogling',
      genderVariants: {
        male: { id:'male', bodyScale:1, torsoWidth:1, torsoHeight:1, shoulderScale:1, limbScale:1, headScale:1, eyeScale:1, pouchScale:1, ridgeScale:1, handScale:1, footScale:1, crouchOffset:0 },
        female: { id:'female', bodyScale:.94, torsoWidth:.91, torsoHeight:.94, shoulderScale:.88, limbScale:.88, headScale:1.025, eyeScale:1.07, pouchScale:.84, ridgeScale:.78, handScale:.92, footScale:.94, crouchOffset:1.5 }
      },
      spriteRenderer: {
        enabled: true,
        basePath: 'assets/characters/races/bogling/', variantSheets:true,
        frameWidth: 256,
        frameHeight: 256,
        directions: 8,
        animations: {
          idle: { file: 'bogling_idle.png', frames: 8, fps: 6 },
          walk: { file: 'bogling_walk.png', frames: 8, fps: 10 },
          attack: { file: 'bogling_attack.png', frames: 6, fps: 12 },
          cast: { file: 'bogling_cast.png', frames: 8, fps: 8 },
          hit: { file: 'bogling_hit.png', frames: 4, fps: 10 },
          death: { file: 'bogling_death.png', frames: 8, fps: 8, holdLastFrame: true },
          meditate: { file: 'bogling_meditate.png', frames: 8, fps: 5 },
          swim: { file: 'bogling_swim.png', frames: 8, fps: 8 },
          dance: { file: 'bogling_dance.png', frames: 8, fps: 8 },
          harvesting: { file: 'bogling_harvest.png', frames: 8, fps: 8 },
          mining: { file: 'bogling_mine.png', frames: 8, fps: 8 },
          fishing: { file: 'bogling_fish.png', frames: 8, fps: 8 }
        }
      }
    },
    ratkin: {
      id: 'ratkin', name: 'Ratkin', description: 'Quick scavenger-folk from tunnels, abandoned mines, ruined walls, and old battlefield wreckage.',
      lore: 'Ratkin survive where others discard things: collapsed mines, old sewers, ruined keeps, battlefield scrap piles, and forgotten tunnels. Fast, nervous, clever, and practical, they turn scraps into tools, traps, blades, and machines.',
      statMods: { strength: -2, dexterity: 3, stamina: -1, intelligence: 1, wisdom: -1 },
      recommendedClasses: ['Rogue','Assassin','Ranger','Bard','Necromancer','Fighter'],
      palettes: {
        grey_tunnel:{name:'Grey Tunnel',fur:'#777a78',belly:'#aaa69b',accent:'#d9a8a2'}, brown_field:{name:'Brown Field',fur:'#806145',belly:'#b59876',accent:'#d49b91'},
        black_sewer:{name:'Black Sewer',fur:'#302f31',belly:'#626065',accent:'#b27d84'}, white_albino:{name:'White Albino',fur:'#d9d4c8',belly:'#eee9dd',accent:'#e48f9e'},
        rust_red:{name:'Rust Red',fur:'#8b4f3d',belly:'#bc8064',accent:'#d08d88'}, mottled_patchwork:{name:'Mottled Patchwork',fur:'#71604e',belly:'#a99b80',accent:'#c38b83'}
      }, defaultPaletteId: 'grey_tunnel', rendererKey: 'ratkin', equipmentAnchorProfile: 'ratkin',
      spriteRenderer: {
        enabled: true,
        basePath: 'assets/characters/races/ratkin/',
        frameWidth: 256,
        frameHeight: 256,
        directions: 8,
        worldScale: 1.0,
        creatorScale: 2.0,
        animations: {
          idle: { file: 'ratkin_idle.png', frames: 8, fps: 6 },
          walk: { file: 'ratkin_walk.png', frames: 8, fps: 10 },
          attack: { file: 'ratkin_attack.png', frames: 6, fps: 12 },
          cast: { file: 'ratkin_cast.png', frames: 8, fps: 8 },
          hit: { file: 'ratkin_hit.png', frames: 4, fps: 10 },
          death: { file: 'ratkin_death.png', frames: 8, fps: 8, holdLastFrame: true },
          meditate: { file: 'ratkin_meditate.png', frames: 8, fps: 5 },
          swim: { file: 'ratkin_swim.png', frames: 8, fps: 8 }
        }
      }
    }
  };

  DR.RACES = Object.freeze(races);
  DR.normalizeRaceId = raceId => Object.prototype.hasOwnProperty.call(races, String(raceId || '').toLowerCase()) ? String(raceId).toLowerCase() : 'human';
  DR.getRaceDefinition = raceId => races[DR.normalizeRaceId(raceId)];
  DR.normalizeRacePaletteId = (raceId, paletteId) => {
    const race = DR.getRaceDefinition(raceId);
    const key = String(paletteId || '');
    return race.palettes?.[key] ? key : race.defaultPaletteId;
  };
})();
