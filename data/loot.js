(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};

  DR.RARITIES = [
    { key: 'grey', name: 'Grey', label: 'Worn', color: '#8b928a', weight: 42, stat: 0.75, affixes: 0 },
    { key: 'white', name: 'White', label: 'Common', color: '#d8ded1', weight: 30, stat: 1.0, affixes: 0 },
    { key: 'green', name: 'Green', label: 'Rare', color: '#54c86f', weight: 16, stat: 1.22, affixes: 1 },
    { key: 'blue', name: 'Blue', label: 'Set Piece', color: '#5ea2ff', weight: 7, stat: 1.46, affixes: 2 },
    { key: 'purple', name: 'Purple', label: 'Super Rare', color: '#b777ff', weight: 3.2, stat: 1.72, affixes: 3 },
    { key: 'gold', name: 'Gold', label: 'Unique', color: '#e5bd5b', weight: 1.35, stat: 2.05, affixes: 4 },
    { key: 'orange', name: 'Orange', label: 'Legendary', color: '#f08a36', weight: 0.4, stat: 2.45, affixes: 5 },
    { key: 'red', name: 'Red', label: 'Godly', color: '#ff4f4f', weight: 0.05, stat: 3.1, affixes: 6 }
  ];

  DR.EQUIP_SLOTS = Object.freeze([
    'head', 'shoulders', 'chest', 'legs', 'hands', 'feet', 'cape',
    'amulet', 'earring1', 'earring2', 'ring1', 'ring2',
    'weapon', 'offhand', 'belt', 'charm'
  ]);

  DR.SLOT_LABELS = Object.freeze({
    head: 'Head', shoulders: 'Shoulders', chest: 'Chest', legs: 'Legs', hands: 'Hands', feet: 'Feet', cape: 'Cape',
    amulet: 'Amulet', earring1: 'Earring', earring2: 'Earring', ring1: 'Ring', ring2: 'Ring',
    weapon: 'Weapon', offhand: 'Offhand', belt: 'Belt', charm: 'Charm'
  });

  DR.CLASS_ARCHETYPES = {
    Paladin: ['mace', 'shield', 'mail', 'holy', 'charm'],
    Warden: ['maul', 'shield', 'hide', 'thorn', 'charm'],
    Fighter: ['greatsword', 'greataxe', 'cleaver', 'leather', 'charm'],
    Rogue: ['dagger', 'shortblade', 'leather', 'fang', 'charm'],
    Ranger: ['bow', 'leather', 'trap', 'fang', 'charm'],
    Assassin: ['crossbow', 'dagger', 'poison', 'leather', 'charm'],
    Wizard: ['wand', 'orb', 'silk', 'rune', 'charm'],
    Shaman: ['staff', 'totem', 'hide', 'storm', 'charm'],
    Summoner: ['focus', 'grimoire', 'silk', 'shard', 'charm'],
    Necromancer: ['bonewand', 'skull', 'silk', 'grave', 'charm'],
    Cleric: ['mace', 'symbol', 'mail', 'relic', 'charm'],
    Druid: ['staff', 'totem', 'hide', 'vine', 'charm'],
    Bard: ['lute', 'rapier', 'songblade', 'mail', 'charm'],
    Enchanter: ['wand', 'orb', 'silk', 'rune', 'charm']
  };

  DR.LOOT_BASES = [
    { slot: 'weapon', tags: ['sword', 'rapier', 'songblade'], name: 'Gloomforged Blade', classes: ['Bard', 'Fighter', 'Paladin'], stats: { attack: 6 } },
    { slot: 'weapon', tags: ['greatsword', 'greataxe', 'cleaver'], name: 'Darkwood Greatcleaver', classes: ['Fighter', 'Warden'], stats: { attack: 9, speed: -0.03 } },
    { slot: 'weapon', tags: ['dagger', 'shortblade', 'fang'], name: 'Widowfang Dagger', classes: ['Rogue', 'Assassin', 'Bard'], stats: { attack: 7, speed: 0.08 } },
    { slot: 'weapon', tags: ['staff', 'wand', 'bonewand', 'focus'], name: 'Blackroot Staff', classes: ['Wizard', 'Shaman', 'Druid', 'Enchanter', 'Summoner', 'Necromancer', 'Cleric'], stats: { attack: 3, mana: 14 } },
    { slot: 'weapon', tags: ['mace'], name: 'Gravebell Mace', classes: ['Paladin', 'Cleric', 'Warden'], stats: { attack: 5, defense: 1 } },
    { slot: 'offhand', tags: ['shield'], name: 'Ironbark Shield', classes: ['Paladin', 'Warden', 'Cleric'], stats: { defense: 6, hp: 12 } },
    { slot: 'offhand', tags: ['orb', 'grimoire', 'skull', 'symbol', 'totem'], name: 'Umbral Focus', classes: ['Wizard', 'Shaman', 'Druid', 'Enchanter', 'Summoner', 'Necromancer', 'Cleric', 'Bard'], stats: { mana: 18, defense: 1 } },

    { slot: 'head', tags: ['plate', 'mail', 'leather', 'silk', 'hide'], name: 'Hood of the Dark Bough', classes: Object.keys(DR.CLASSES), stats: { hp: 8, mana: 6 } },
    { slot: 'shoulders', tags: ['plate', 'mail'], name: 'Gloomguard Pauldrons', classes: ['Paladin', 'Cleric', 'Bard'], stats: { defense: 4, hp: 12 } },
    { slot: 'shoulders', tags: ['leather', 'hide', 'silk'], name: 'Moss-Stitched Mantle', classes: ['Fighter', 'Rogue', 'Ranger', 'Assassin', 'Warden', 'Druid', 'Wizard', 'Shaman', 'Enchanter', 'Summoner', 'Necromancer'], stats: { mana: 9, attack: 2 } },
    { slot: 'chest', tags: ['plate'], name: 'Stagbone Cuirass', classes: ['Paladin'], stats: { hp: 22, defense: 6 } },
    { slot: 'chest', tags: ['mail'], name: 'Lanternscale Hauberk', classes: ['Paladin', 'Bard', 'Cleric'], stats: { hp: 14, defense: 4, mana: 6 } },
    { slot: 'chest', tags: ['leather', 'hide'], name: 'Thornhide Jerkin', classes: ['Fighter', 'Rogue', 'Ranger', 'Assassin', 'Warden', 'Druid'], stats: { hp: 10, attack: 3, speed: 0.05 } },
    { slot: 'chest', tags: ['silk'], name: 'Moonless Robe', classes: ['Wizard', 'Shaman', 'Enchanter', 'Summoner', 'Necromancer', 'Cleric', 'Druid'], stats: { mana: 24, defense: 2 } },
    { slot: 'hands', tags: ['all'], name: 'Gloomstitch Gloves', classes: Object.keys(DR.CLASSES), stats: { attack: 2, mana: 5 } },
    { slot: 'legs', tags: ['all'], name: 'Bog-Tread Leggings', classes: Object.keys(DR.CLASSES), stats: { hp: 10, defense: 2 } },
    { slot: 'feet', tags: ['all'], name: 'Mirewalker Boots', classes: Object.keys(DR.CLASSES), stats: { speed: 0.06, defense: 1 } },
    { slot: 'cape', tags: ['cloak', 'cape', 'back'], name: 'Shadowmoss Cape', classes: Object.keys(DR.CLASSES), stats: { hp: 7, mana: 7, speed: 0.03 } },

    { slot: 'amulet', tags: ['necklace', 'amulet', 'relic'], name: 'Amulet of the Old Path', classes: Object.keys(DR.CLASSES), stats: { attack: 2, defense: 2, mana: 8 } },
    { slot: 'earring1', tags: ['earring', 'rune', 'silver'], name: 'Briar-Silver Earring', classes: Object.keys(DR.CLASSES), stats: { mana: 7, spirit: 1 } },
    { slot: 'earring2', tags: ['earring', 'fang', 'bone'], name: 'Fangbone Earring', classes: Object.keys(DR.CLASSES), stats: { attack: 1, hp: 7 } },
    { slot: 'ring1', tags: ['rune', 'grave', 'relic', 'ring'], name: 'Ring of Hollow Light', classes: Object.keys(DR.CLASSES), stats: { mana: 10, hp: 6 } },
    { slot: 'ring2', tags: ['ring', 'thorn', 'moss'], name: 'Deepwood Band', classes: Object.keys(DR.CLASSES), stats: { attack: 2, stamina: 1 } },
    { slot: 'charm', tags: ['charm', 'shard'], name: 'Blackroot Charm', classes: Object.keys(DR.CLASSES), stats: { hp: 8, mana: 8, attack: 1 } }
  ];

  DR.AFFIXES = [
    { name: 'Bear', stats: { hp: 14, stamina: 1 } },
    { name: 'Owl', stats: { mana: 16, wisdom: 1 } },
    { name: 'Wolf', stats: { attack: 3, strength: 1 } },
    { name: 'Stone', stats: { defense: 3, armor: 4 } },
    { name: 'Fleet', stats: { speed: 0.07, dexterity: 1 } },
    { name: 'Dusk', stats: { hp: 7, mana: 7, cdr: 3 } },
    { name: 'Ruin', stats: { attack: 2, defense: 2, critDamage: 3 } },
    { name: 'Fangs', stats: { dexterity: 2, crit: 5 } },
    { name: 'Embers', stats: { intelligence: 2, spellPower: 6 } },
    { name: 'Mercy', stats: { wisdom: 2, healingPower: 6 } },
    { name: 'Focus', stats: { cdr: 6, magicCrit: 4 } },
    { name: 'Might', stats: { strength: 2, physicalPower: 5 } }
  ];
})();
