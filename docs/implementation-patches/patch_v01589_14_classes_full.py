from pathlib import Path
import re, json, tarfile, shutil, os, textwrap
root = Path('/mnt/data/dr_work/Dream Realms V0.15.52')
assert root.exists(), root

class_order = ['Paladin','Warden','Fighter','Rogue','Ranger','Assassin','Wizard','Shaman','Summoner','Necromancer','Cleric','Druid','Bard','Enchanter']

attrs = {
    'Paladin':     dict(strength=13,dexterity=7,stamina=17,intelligence=8,wisdom=14),
    'Warden':      dict(strength=12,dexterity=8,stamina=18,intelligence=7,wisdom=14),
    'Fighter':     dict(strength=17,dexterity=9,stamina=13,intelligence=5,wisdom=6),
    'Rogue':       dict(strength=12,dexterity=17,stamina=10,intelligence=7,wisdom=8),
    'Ranger':      dict(strength=10,dexterity=17,stamina=11,intelligence=7,wisdom=11),
    'Assassin':    dict(strength=10,dexterity=18,stamina=9,intelligence=9,wisdom=7),
    'Wizard':      dict(strength=5,dexterity=8,stamina=8,intelligence=18,wisdom=11),
    'Shaman':      dict(strength=7,dexterity=8,stamina=10,intelligence=14,wisdom=15),
    'Summoner':    dict(strength=6,dexterity=8,stamina=8,intelligence=15,wisdom=12),
    'Necromancer': dict(strength=7,dexterity=8,stamina=9,intelligence=15,wisdom=10),
    'Cleric':      dict(strength=8,dexterity=7,stamina=12,intelligence=10,wisdom=16),
    'Druid':       dict(strength=8,dexterity=9,stamina=11,intelligence=13,wisdom=15),
    'Bard':        dict(strength=9,dexterity=12,stamina=10,intelligence=10,wisdom=13),
    'Enchanter':   dict(strength=6,dexterity=9,stamina=8,intelligence=16,wisdom=12),
}
growth = {
    'Paladin':     dict(strength=2,dexterity=1,stamina=3,intelligence=0,wisdom=2),
    'Warden':      dict(strength=2,dexterity=1,stamina=3,intelligence=0,wisdom=2),
    'Fighter':     dict(strength=3,dexterity=2,stamina=2,intelligence=0,wisdom=0),
    'Rogue':       dict(strength=2,dexterity=3,stamina=1,intelligence=1,wisdom=1),
    'Ranger':      dict(strength=1,dexterity=3,stamina=1,intelligence=1,wisdom=2),
    'Assassin':    dict(strength=1,dexterity=3,stamina=1,intelligence=2,wisdom=1),
    'Wizard':      dict(strength=0,dexterity=1,stamina=1,intelligence=3,wisdom=2),
    'Shaman':      dict(strength=1,dexterity=1,stamina=2,intelligence=2,wisdom=3),
    'Summoner':    dict(strength=0,dexterity=1,stamina=1,intelligence=3,wisdom=2),
    'Necromancer': dict(strength=1,dexterity=1,stamina=1,intelligence=3,wisdom=1),
    'Cleric':      dict(strength=1,dexterity=1,stamina=2,intelligence=1,wisdom=3),
    'Druid':       dict(strength=1,dexterity=1,stamina=2,intelligence=2,wisdom=3),
    'Bard':        dict(strength=1,dexterity=2,stamina=1,intelligence=1,wisdom=2),
    'Enchanter':   dict(strength=0,dexterity=1,stamina=1,intelligence=3,wisdom=2),
}

def fmt_attr_obj(d):
    return '{ ' + ', '.join(f'{k}: {v}' for k,v in d.items()) + ' }'

# core/stats.js: add 14-class attribute bases/growths so derived stats do not fall back to Fighter.
p = root/'core/stats.js'
s = p.read_text()
attr_lines = ['  const CLASS_ATTRIBUTES = {']
for c in class_order:
    attr_lines.append(f"    {c+':':<13} {fmt_attr_obj(attrs[c])},")
attr_lines[-1] = attr_lines[-1].rstrip(',')
attr_lines.append('  };')
growth_lines = ['  const CLASS_ATTRIBUTE_GROWTH = {']
for c in class_order:
    growth_lines.append(f"    {c+':':<13} {fmt_attr_obj(growth[c])},")
growth_lines[-1] = growth_lines[-1].rstrip(',')
growth_lines.append('  };')
s = re.sub(r"  const CLASS_ATTRIBUTES = \{.*?\n  \};", '\n'.join(attr_lines), s, flags=re.S)
s = re.sub(r"  const CLASS_ATTRIBUTE_GROWTH = \{.*?\n  \};", '\n'.join(growth_lines), s, flags=re.S)
p.write_text(s)

# Starter gear mapping in systems/inventory-system.js.
p = root/'systems/inventory-system.js'
s = p.read_text()
new_starter = '''        const starterGear = {
          "Paladin": [
                    "item_starter_paladin_sun_mace",
                    "item_starter_paladin_oath_shield",
                    "item_starter_paladin_recruit_mail",
                    "item_starter_paladin_mail_leggings",
                    "item_starter_paladin_field_boots"
          ],
          "Warden": [
                    "item_starter_warden_stone_maul",
                    "item_starter_warden_bark_buckler",
                    "item_starter_warden_thornhide_vest",
                    "item_starter_warden_rootwoven_leggings",
                    "item_starter_warden_mossguard_boots"
          ],
          "Fighter": [
                    "item_starter_fighter_heavy_cleaver",
                    "item_starter_fighter_patched_mail",
                    "item_starter_fighter_mail_leggings",
                    "item_starter_fighter_scuffed_boots"
          ],
          "Rogue": [
                    "item_starter_rogue_dull_dagger",
                    "item_starter_rogue_offhand_shiv",
                    "item_starter_rogue_leather_jerkin",
                    "item_starter_rogue_pants",
                    "item_starter_rogue_softstep_boots"
          ],
          "Ranger": [
                    "item_starter_ranger_shortbow",
                    "item_starter_ranger_hide_jerkin",
                    "item_starter_ranger_field_pants",
                    "item_starter_ranger_trail_boots"
          ],
          "Assassin": [
                    "item_starter_assassin_light_crossbow",
                    "item_starter_assassin_throwing_knives",
                    "item_starter_assassin_dark_leather",
                    "item_starter_assassin_padded_trousers",
                    "item_starter_assassin_silent_boots"
          ],
          "Wizard": [
                    "item_starter_wizard_apprentice_wand",
                    "item_starter_wizard_cracked_focus",
                    "item_starter_wizard_novice_robe",
                    "item_starter_wizard_cloth_trousers",
                    "item_starter_wizard_soft_slippers"
          ],
          "Shaman": [
                    "item_starter_shaman_storm_rod",
                    "item_starter_shaman_tide_totem",
                    "item_starter_shaman_hide_wrap",
                    "item_starter_shaman_woven_leggings",
                    "item_starter_shaman_earthwalk_boots"
          ],
          "Summoner": [
                    "item_starter_summoner_grimoire",
                    "item_starter_summoner_shard_focus",
                    "item_starter_summoner_teal_robe",
                    "item_starter_summoner_cloth_pants",
                    "item_starter_summoner_sandals"
          ],
          "Necromancer": [
                    "item_starter_necromancer_bone_wand",
                    "item_starter_necromancer_skull_focus",
                    "item_starter_necromancer_gravecloth",
                    "item_starter_necromancer_wrappings",
                    "item_starter_necromancer_dusty_boots"
          ],
          "Cleric": [
                    "item_starter_cleric_mace",
                    "item_starter_cleric_prayer_symbol",
                    "item_starter_cleric_chain_vest",
                    "item_starter_cleric_chain_leggings",
                    "item_starter_cleric_field_boots"
          ],
          "Druid": [
                    "item_starter_druid_walking_staff",
                    "item_starter_druid_leaf_totem",
                    "item_starter_druid_acornleaf_robe",
                    "item_starter_druid_woven_leggings",
                    "item_starter_druid_mosswalk_sandals"
          ],
          "Bard": [
                    "item_starter_bard_songblade",
                    "item_starter_bard_travel_vest",
                    "item_starter_bard_travel_pants",
                    "item_starter_bard_performer_boots"
          ],
          "Enchanter": [
                    "item_starter_enchanter_apprentice_wand",
                    "item_starter_enchanter_cracked_orb",
                    "item_starter_enchanter_silk_robe",
                    "item_starter_enchanter_silk_trousers",
                    "item_starter_enchanter_soft_slippers"
          ]
};'''
s = re.sub(r"        const starterGear = \{.*?\n\};", new_starter, s, flags=re.S)
p.write_text(s)

# New starter item definitions. Append before ITEM_BY_ID if not already present.
p = root/'data/items.js'
s = p.read_text()
if 'item_starter_paladin_sun_mace' not in s:
    starter_items = r'''

  // V0.15.89: starter gear for the expanded 14-class roster.
  DR.ITEM_DRAFTS.push(
    { id:'item_starter_paladin_sun_mace', name:'Sunmarked Training Mace', type:'weapon', slot:'weapon', rarity:'white', levelRequirement:1, classRestrictions:['Paladin'], stats:{attack:3,defense:1}, damage:{min:2,max:5,speed:2.7}, armor:0, sellValue:5, stackSize:1, icon:{family:'mace',color:'#f3d46b',glyph:'✚'}, description:'A blunt camp mace etched with a simple oath-mark.', editorNote:'V0.15.89 Paladin starter weapon.' },
    { id:'item_starter_paladin_oath_shield', name:'Oathbound Recruit Shield', type:'armor', slot:'offhand', rarity:'white', levelRequirement:1, classRestrictions:['Paladin'], stats:{defense:3,hp:6}, damage:null, armor:3, sellValue:5, stackSize:1, icon:{family:'shield',color:'#e9d37b',glyph:'▣'}, description:'A plain shield issued to new Paladin trainees.', editorNote:'V0.15.89 Paladin starter shield.' },
    { id:'item_starter_paladin_recruit_mail', name:'Sunlit Recruit Mail', type:'armor', slot:'chest', rarity:'white', levelRequirement:1, classRestrictions:['Paladin'], stats:{defense:3,hp:6,mana:3}, damage:null, armor:3, sellValue:6, stackSize:1, icon:{family:'mail',color:'#d8c98a',glyph:'▥'}, description:'Light mail for a new holy defender.', editorNote:'V0.15.89 Paladin starter chest.' },
    { id:'item_starter_paladin_mail_leggings', name:'Sunlit Mail Leggings', type:'armor', slot:'legs', rarity:'white', levelRequirement:1, classRestrictions:['Paladin'], stats:{defense:2,hp:3}, damage:null, armor:2, sellValue:4, stackSize:1, icon:{family:'legs',color:'#bfae72',glyph:'▥'}, description:'Simple mail leggings with dull brass rivets.', editorNote:'V0.15.89 Paladin starter legs.' },
    { id:'item_starter_paladin_field_boots', name:'Oathkeeper Field Boots', type:'armor', slot:'feet', rarity:'white', levelRequirement:1, classRestrictions:['Paladin'], stats:{defense:1,hp:2}, damage:null, armor:1, sellValue:3, stackSize:1, icon:{family:'boots',color:'#6e5736',glyph:'▰'}, description:'Sturdy boots for holding a line.', editorNote:'V0.15.89 Paladin starter feet.' },

    { id:'item_starter_warden_stone_maul', name:'Stonehand Training Maul', type:'weapon', slot:'weapon', rarity:'white', levelRequirement:1, classRestrictions:['Warden'], stats:{attack:3,defense:1}, damage:{min:2,max:5,speed:2.9}, armor:0, sellValue:5, stackSize:1, icon:{family:'maul',color:'#8fcf70',glyph:'◆'}, description:'A stone-weighted camp maul for a primal guardian.', editorNote:'V0.15.89 Warden starter weapon.' },
    { id:'item_starter_warden_bark_buckler', name:'Barkbound Buckler', type:'armor', slot:'offhand', rarity:'white', levelRequirement:1, classRestrictions:['Warden'], stats:{defense:3,hp:7}, damage:null, armor:3, sellValue:5, stackSize:1, icon:{family:'shield',color:'#8fcf70',glyph:'▣'}, description:'A buckler layered with bark and root fiber.', editorNote:'V0.15.89 Warden starter shield.' },
    { id:'item_starter_warden_thornhide_vest', name:'Thornhide Recruit Vest', type:'armor', slot:'chest', rarity:'white', levelRequirement:1, classRestrictions:['Warden'], stats:{defense:3,hp:7}, damage:null, armor:3, sellValue:6, stackSize:1, icon:{family:'hide',color:'#6fa861',glyph:'▧'}, description:'Flexible hide armor reinforced with thorned strips.', editorNote:'V0.15.89 Warden starter chest.' },
    { id:'item_starter_warden_rootwoven_leggings', name:'Rootwoven Leggings', type:'armor', slot:'legs', rarity:'white', levelRequirement:1, classRestrictions:['Warden'], stats:{defense:2,hp:3}, damage:null, armor:2, sellValue:4, stackSize:1, icon:{family:'legs',color:'#5f8545',glyph:'▧'}, description:'Leggings stitched from waxed root-fiber cloth.', editorNote:'V0.15.89 Warden starter legs.' },
    { id:'item_starter_warden_mossguard_boots', name:'Mossguard Boots', type:'armor', slot:'feet', rarity:'white', levelRequirement:1, classRestrictions:['Warden'], stats:{defense:1,hp:2}, damage:null, armor:1, sellValue:3, stackSize:1, icon:{family:'boots',color:'#4d6138',glyph:'▰'}, description:'Quiet boots with moss-padded soles.', editorNote:'V0.15.89 Warden starter feet.' },

    { id:'item_starter_fighter_heavy_cleaver', name:'Camp Heavy Cleaver', type:'weapon', slot:'weapon', rarity:'white', levelRequirement:1, classRestrictions:['Fighter'], stats:{attack:4}, damage:{min:3,max:6,speed:3.2}, armor:0, sellValue:6, stackSize:1, twoHanded:true, icon:{family:'greatsword',color:'#d0b070',glyph:'⚔'}, description:'A rough two-handed blade for a new heavy-weapon Fighter.', editorNote:'V0.15.89 Fighter starter weapon corrected to 2H DPS identity.' },

    { id:'item_starter_ranger_shortbow', name:'Bentwood Shortbow', type:'weapon', slot:'weapon', rarity:'white', levelRequirement:1, classRestrictions:['Ranger'], stats:{attack:3,speed:0.02}, damage:{min:2,max:5,speed:2.5}, armor:0, sellValue:5, stackSize:1, icon:{family:'bow',color:'#77b85f',glyph:'➶'}, description:'A simple bow balanced for moving shots.', editorNote:'V0.15.89 Ranger starter weapon.' },
    { id:'item_starter_ranger_hide_jerkin', name:'Trailhide Jerkin', type:'armor', slot:'chest', rarity:'white', levelRequirement:1, classRestrictions:['Ranger'], stats:{defense:2,hp:3,attack:1}, damage:null, armor:2, sellValue:5, stackSize:1, icon:{family:'leather',color:'#668f4b',glyph:'▧'}, description:'Quiet hide armor for scouts and hunters.', editorNote:'V0.15.89 Ranger starter chest.' },
    { id:'item_starter_ranger_field_pants', name:'Trail Field Pants', type:'armor', slot:'legs', rarity:'white', levelRequirement:1, classRestrictions:['Ranger'], stats:{defense:1,speed:0.01}, damage:null, armor:1, sellValue:3, stackSize:1, icon:{family:'legs',color:'#53683b',glyph:'▧'}, description:'Light field pants for wilderness travel.', editorNote:'V0.15.89 Ranger starter legs.' },
    { id:'item_starter_ranger_trail_boots', name:'Trail Boots', type:'armor', slot:'feet', rarity:'white', levelRequirement:1, classRestrictions:['Ranger'], stats:{defense:1,speed:0.02}, damage:null, armor:1, sellValue:3, stackSize:1, icon:{family:'boots',color:'#40542f',glyph:'▰'}, description:'Boots suited for kiting through brush.', editorNote:'V0.15.89 Ranger starter feet.' },

    { id:'item_starter_assassin_light_crossbow', name:'Light Camp Crossbow', type:'weapon', slot:'weapon', rarity:'white', levelRequirement:1, classRestrictions:['Assassin'], stats:{attack:3}, damage:{min:2,max:5,speed:2.7}, armor:0, sellValue:5, stackSize:1, icon:{family:'crossbow',color:'#7e6aa8',glyph:'⌁'}, description:'A compact crossbow for ranged executions.', editorNote:'V0.15.89 Assassin starter weapon.' },
    { id:'item_starter_assassin_throwing_knives', name:'Bundle of Throwing Knives', type:'weapon', slot:'offhand', rarity:'white', levelRequirement:1, classRestrictions:['Assassin'], stats:{attack:2,speed:0.02}, damage:{min:1,max:3,speed:2.0}, armor:0, sellValue:4, stackSize:1, icon:{family:'throwing',color:'#b777ff',glyph:'⌁'}, description:'Balanced knives for quick ranged follow-up attacks.', editorNote:'V0.15.89 Assassin starter offhand.' },
    { id:'item_starter_assassin_dark_leather', name:'Dark Padded Leather', type:'armor', slot:'chest', rarity:'white', levelRequirement:1, classRestrictions:['Assassin'], stats:{defense:2,attack:1}, damage:null, armor:2, sellValue:5, stackSize:1, icon:{family:'leather',color:'#45345d',glyph:'▧'}, description:'Dark leather built for trap work and movement.', editorNote:'V0.15.89 Assassin starter chest.' },
    { id:'item_starter_assassin_padded_trousers', name:'Padded Silent Trousers', type:'armor', slot:'legs', rarity:'white', levelRequirement:1, classRestrictions:['Assassin'], stats:{defense:1,speed:0.01}, damage:null, armor:1, sellValue:3, stackSize:1, icon:{family:'legs',color:'#332940',glyph:'▧'}, description:'Soft trousers that do not snag on trap wire.', editorNote:'V0.15.89 Assassin starter legs.' },
    { id:'item_starter_assassin_silent_boots', name:'Silent Step Boots', type:'armor', slot:'feet', rarity:'white', levelRequirement:1, classRestrictions:['Assassin'], stats:{defense:1,speed:0.02}, damage:null, armor:1, sellValue:3, stackSize:1, icon:{family:'boots',color:'#231d2c',glyph:'▰'}, description:'Soft-soled boots for quiet positioning.', editorNote:'V0.15.89 Assassin starter feet.' },

    { id:'item_starter_wizard_apprentice_wand', name:'Apprentice Arcane Wand', type:'weapon', slot:'weapon', rarity:'white', levelRequirement:1, classRestrictions:['Wizard'], stats:{attack:1,mana:8}, damage:{min:1,max:4,speed:2.8}, armor:0, sellValue:5, stackSize:1, icon:{family:'wand',color:'#6fa8ff',glyph:'✧'}, description:'A basic wand for channeling arcane bolts.', editorNote:'V0.15.89 Wizard starter weapon.' },
    { id:'item_starter_wizard_cracked_focus', name:'Cracked Arcane Focus', type:'accessory', slot:'offhand', rarity:'white', levelRequirement:1, classRestrictions:['Wizard'], stats:{mana:8}, damage:null, armor:0, sellValue:4, stackSize:1, icon:{family:'orb',color:'#8ec9ff',glyph:'◈'}, description:'A cracked focus stone still useful for practice casting.', editorNote:'V0.15.89 Wizard starter offhand.' },
    { id:'item_starter_wizard_novice_robe', name:'Novice Arcane Robe', type:'armor', slot:'chest', rarity:'white', levelRequirement:1, classRestrictions:['Wizard'], stats:{mana:10,defense:1}, damage:null, armor:1, sellValue:5, stackSize:1, icon:{family:'robe',color:'#344b8f',glyph:'▤'}, description:'A robe stitched with simple focus threads.', editorNote:'V0.15.89 Wizard starter chest.' },
    { id:'item_starter_wizard_cloth_trousers', name:'Novice Cloth Trousers', type:'armor', slot:'legs', rarity:'white', levelRequirement:1, classRestrictions:['Wizard'], stats:{mana:4}, damage:null, armor:1, sellValue:3, stackSize:1, icon:{family:'legs',color:'#263661',glyph:'▤'}, description:'Plain cloth trousers for an apprentice caster.', editorNote:'V0.15.89 Wizard starter legs.' },
    { id:'item_starter_wizard_soft_slippers', name:'Novice Soft Slippers', type:'armor', slot:'feet', rarity:'white', levelRequirement:1, classRestrictions:['Wizard'], stats:{mana:3}, damage:null, armor:1, sellValue:3, stackSize:1, icon:{family:'boots',color:'#202945',glyph:'▰'}, description:'Soft caster slippers with stitched soles.', editorNote:'V0.15.89 Wizard starter feet.' },

    { id:'item_starter_shaman_storm_rod', name:'Stormcall Rod', type:'weapon', slot:'weapon', rarity:'white', levelRequirement:1, classRestrictions:['Shaman'], stats:{attack:1,mana:7}, damage:{min:1,max:4,speed:2.8}, armor:0, sellValue:5, stackSize:1, icon:{family:'rod',color:'#59c9b2',glyph:'◈'}, description:'A rough rod wrapped in storm-blue cord.', editorNote:'V0.15.89 Shaman starter weapon.' },
    { id:'item_starter_shaman_tide_totem', name:'Small Tide Totem', type:'accessory', slot:'offhand', rarity:'white', levelRequirement:1, classRestrictions:['Shaman'], stats:{mana:6,defense:1}, damage:null, armor:0, sellValue:4, stackSize:1, icon:{family:'totem',color:'#70e6d3',glyph:'◆'}, description:'A small totem used to focus storm and earth rites.', editorNote:'V0.15.89 Shaman starter offhand.' },
    { id:'item_starter_shaman_hide_wrap', name:'Stormhide Wrap', type:'armor', slot:'chest', rarity:'white', levelRequirement:1, classRestrictions:['Shaman'], stats:{mana:7,defense:2}, damage:null, armor:2, sellValue:5, stackSize:1, icon:{family:'hide',color:'#35766b',glyph:'▧'}, description:'A flexible hide wrap marked with simple spirit knots.', editorNote:'V0.15.89 Shaman starter chest.' },
    { id:'item_starter_shaman_woven_leggings', name:'Stormwoven Leggings', type:'armor', slot:'legs', rarity:'white', levelRequirement:1, classRestrictions:['Shaman'], stats:{mana:4,defense:1}, damage:null, armor:1, sellValue:3, stackSize:1, icon:{family:'legs',color:'#28574f',glyph:'▧'}, description:'Woven leggings dyed in stormwater pigments.', editorNote:'V0.15.89 Shaman starter legs.' },
    { id:'item_starter_shaman_earthwalk_boots', name:'Earthwalk Boots', type:'armor', slot:'feet', rarity:'white', levelRequirement:1, classRestrictions:['Shaman'], stats:{defense:1,mana:2}, damage:null, armor:1, sellValue:3, stackSize:1, icon:{family:'boots',color:'#244840',glyph:'▰'}, description:'Boots packed with soft earth-fiber soles.', editorNote:'V0.15.89 Shaman starter feet.' }
  );
'''
    s = s.replace('\n\n  DR.ITEM_BY_ID =', starter_items + '\n\n  DR.ITEM_BY_ID =')
p.write_text(s)

# Loot archetypes and core loot class pools.
p = root/'data/loot.js'
s = p.read_text()
new_arch = '''  DR.CLASS_ARCHETYPES = {
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
  };'''
s = re.sub(r"  DR\.CLASS_ARCHETYPES = \{.*?\n  \};", new_arch, s, flags=re.S)
repls = {
"{ slot: 'weapon', tags: ['sword', 'rapier', 'songblade'], name: 'Gloomforged Blade', classes: ['Bard'], stats: { attack: 6 } }": "{ slot: 'weapon', tags: ['sword', 'rapier', 'songblade'], name: 'Gloomforged Blade', classes: ['Bard', 'Fighter', 'Paladin'], stats: { attack: 6 } }",
"{ slot: 'weapon', tags: ['greatsword', 'greataxe', 'cleaver'], name: 'Darkwood Greatcleaver', classes: ['Fighter'], stats: { attack: 9, speed: -0.03 } }": "{ slot: 'weapon', tags: ['greatsword', 'greataxe', 'cleaver'], name: 'Darkwood Greatcleaver', classes: ['Fighter', 'Warden'], stats: { attack: 9, speed: -0.03 } }",
"{ slot: 'weapon', tags: ['dagger', 'shortblade', 'fang'], name: 'Widowfang Dagger', classes: ['Rogue', 'Bard'], stats: { attack: 7, speed: 0.08 } }": "{ slot: 'weapon', tags: ['dagger', 'shortblade', 'fang'], name: 'Widowfang Dagger', classes: ['Rogue', 'Assassin', 'Bard'], stats: { attack: 7, speed: 0.08 } }",
"{ slot: 'weapon', tags: ['staff', 'wand', 'bonewand', 'focus'], name: 'Blackroot Staff', classes: ['Druid', 'Enchanter', 'Summoner', 'Necromancer', 'Cleric'], stats: { attack: 3, mana: 14 } }": "{ slot: 'weapon', tags: ['staff', 'wand', 'bonewand', 'focus'], name: 'Blackroot Staff', classes: ['Wizard', 'Shaman', 'Druid', 'Enchanter', 'Summoner', 'Necromancer', 'Cleric'], stats: { attack: 3, mana: 14 } }",
"{ slot: 'weapon', tags: ['mace'], name: 'Gravebell Mace', classes: ['Cleric', 'Fighter'], stats: { attack: 5, defense: 1 } }": "{ slot: 'weapon', tags: ['mace'], name: 'Gravebell Mace', classes: ['Paladin', 'Cleric', 'Warden'], stats: { attack: 5, defense: 1 } }",
"{ slot: 'offhand', tags: ['shield'], name: 'Ironbark Shield', classes: ['Fighter', 'Cleric', 'Bard'], stats: { defense: 6, hp: 12 } }": "{ slot: 'offhand', tags: ['shield'], name: 'Ironbark Shield', classes: ['Paladin', 'Warden', 'Cleric'], stats: { defense: 6, hp: 12 } }",
"{ slot: 'offhand', tags: ['orb', 'grimoire', 'skull', 'symbol', 'totem'], name: 'Umbral Focus', classes: ['Druid', 'Enchanter', 'Summoner', 'Necromancer', 'Cleric', 'Bard'], stats: { mana: 18, defense: 1 } }": "{ slot: 'offhand', tags: ['orb', 'grimoire', 'skull', 'symbol', 'totem'], name: 'Umbral Focus', classes: ['Wizard', 'Shaman', 'Druid', 'Enchanter', 'Summoner', 'Necromancer', 'Cleric', 'Bard'], stats: { mana: 18, defense: 1 } }",
"{ slot: 'shoulders', tags: ['plate', 'mail'], name: 'Gloomguard Pauldrons', classes: ['Fighter', 'Cleric', 'Bard'], stats: { defense: 4, hp: 12 } }": "{ slot: 'shoulders', tags: ['plate', 'mail'], name: 'Gloomguard Pauldrons', classes: ['Paladin', 'Cleric', 'Bard'], stats: { defense: 4, hp: 12 } }",
"{ slot: 'shoulders', tags: ['leather', 'hide', 'silk'], name: 'Moss-Stitched Mantle', classes: ['Rogue', 'Druid', 'Enchanter', 'Summoner', 'Necromancer'], stats: { mana: 9, attack: 2 } }": "{ slot: 'shoulders', tags: ['leather', 'hide', 'silk'], name: 'Moss-Stitched Mantle', classes: ['Fighter', 'Rogue', 'Ranger', 'Assassin', 'Warden', 'Druid', 'Wizard', 'Shaman', 'Enchanter', 'Summoner', 'Necromancer'], stats: { mana: 9, attack: 2 } }",
"{ slot: 'chest', tags: ['plate'], name: 'Stagbone Cuirass', classes: ['Fighter'], stats: { hp: 22, defense: 6 } }": "{ slot: 'chest', tags: ['plate'], name: 'Stagbone Cuirass', classes: ['Paladin'], stats: { hp: 22, defense: 6 } }",
"{ slot: 'chest', tags: ['mail'], name: 'Lanternscale Hauberk', classes: ['Bard', 'Cleric'], stats: { hp: 14, defense: 4, mana: 6 } }": "{ slot: 'chest', tags: ['mail'], name: 'Lanternscale Hauberk', classes: ['Paladin', 'Bard', 'Cleric'], stats: { hp: 14, defense: 4, mana: 6 } }",
"{ slot: 'chest', tags: ['leather', 'hide'], name: 'Thornhide Jerkin', classes: ['Rogue', 'Druid'], stats: { hp: 10, attack: 3, speed: 0.05 } }": "{ slot: 'chest', tags: ['leather', 'hide'], name: 'Thornhide Jerkin', classes: ['Fighter', 'Rogue', 'Ranger', 'Assassin', 'Warden', 'Druid'], stats: { hp: 10, attack: 3, speed: 0.05 } }",
"{ slot: 'chest', tags: ['silk'], name: 'Moonless Robe', classes: ['Enchanter', 'Summoner', 'Necromancer', 'Cleric', 'Druid'], stats: { mana: 24, defense: 2 } }": "{ slot: 'chest', tags: ['silk'], name: 'Moonless Robe', classes: ['Wizard', 'Shaman', 'Enchanter', 'Summoner', 'Necromancer', 'Cleric', 'Druid'], stats: { mana: 24, defense: 2 } }",
}
for a,b in repls.items(): s = s.replace(a,b)
p.write_text(s)

# class identity procedural model: new class aliases and profiles.
p = root/'render/class-identity-procedural-model.js'
s = p.read_text()
s = s.replace("fighter: 'fighter', warrior: 'fighter', guardian: 'fighter', tank: 'fighter',", "paladin: 'paladin', crusader: 'paladin', oathkeeper: 'paladin',\n    warden: 'warden', naturewarden: 'warden', stonewarden: 'warden',\n    fighter: 'fighter', warrior: 'fighter', bruiser: 'fighter',")
s = s.replace("rogue: 'rogue', scout: 'rogue', assassin: 'rogue', thief: 'rogue',", "rogue: 'rogue', thief: 'rogue',\n    ranger: 'ranger', hunter: 'ranger', scout: 'ranger', archer: 'ranger',\n    assassin: 'assassin', executioner: 'assassin', crossbowman: 'assassin',")
s = s.replace("enchanter: 'enchanter', mesmer: 'enchanter', illusionist: 'enchanter', charmer: 'enchanter',", "wizard: 'wizard', mage: 'wizard', archwizard: 'wizard',\n    shaman: 'shaman', stormcaller: 'shaman', spiritcaller: 'shaman',\n    enchanter: 'enchanter', mesmer: 'enchanter', illusionist: 'enchanter', charmer: 'enchanter',")
profile_insert = r'''
    paladin: {
      id: 'paladin', display: 'Paladin',
      silhouette: { shoulder: 1.20, torso: 1.10, waist: 1.00, hem: 0.88, coat: 32, mantle: 1.10, prop: 1.06, collar: 0.55, hood: 0, stance: 1.02 },
      posture: { armSwing: 0.56, stride: 0.76, torsoBob: 0.42, headBob: 0.42, castPulse: 1.04, lean: 0.42, cloth: 0.46, cape: 0.46 },
      layers: { back: 'shortCape', torso: 'plateCuirass', shoulders: 'platePauldrons', belt: 'holyCord', head: 'tonsureHalo', mainProp: 'mace', offProp: 'shield', chest: 'stoleCross' },
      palette: { outline: '#14110b', shadow: 'rgba(0,0,0,0.36)', skin: '#e0aa7c', skinShadow: '#9b674d', hair: '#4b3628', hairHi: '#7a5637', cloth: '#efe0a1', clothDark: '#6c5a2d', clothHi: '#fff5c7', accent: '#f3d46b', accentDark: '#8a6923', boot: '#2c2117', bootHi: '#6d5134', belt: '#72522b', metal: '#e8e2cd', metalDark: '#80755c', glow: '#fff0a8' }
    },
    warden: {
      id: 'warden', display: 'Warden',
      silhouette: { shoulder: 1.16, torso: 1.12, waist: 1.02, hem: 0.96, coat: 30, mantle: 1.04, prop: 1.08, collar: 0.46, hood: 0.18, stance: 1.06 },
      posture: { armSwing: 0.58, stride: 0.78, torsoBob: 0.40, headBob: 0.38, castPulse: 0.86, lean: 0.40, cloth: 0.52, cape: 0.50 },
      layers: { back: 'shortCape', torso: 'leatherWrap', shoulders: 'platePauldrons', belt: 'warBelt', head: 'bareWarrior', mainProp: 'mace', offProp: 'shield', chest: 'crossStraps' },
      palette: { outline: '#10150b', shadow: 'rgba(0,0,0,0.40)', skin: '#d29d72', skinShadow: '#805b3d', hair: '#3b2e20', hairHi: '#6f5635', cloth: '#415b31', clothDark: '#15200f', clothHi: '#7ea65b', accent: '#8fcf70', accentDark: '#365a28', boot: '#241d13', bootHi: '#59462b', belt: '#5a3f25', metal: '#b9bc9c', metalDark: '#596247', glow: '#b8ff8a' }
    },
    ranger: {
      id: 'ranger', display: 'Ranger',
      silhouette: { shoulder: 0.88, torso: 0.84, waist: 0.78, hem: 0.74, coat: 26, mantle: 0.82, prop: 0.96, collar: 0.70, hood: 0.38, stance: 0.92 },
      posture: { armSwing: 1.05, stride: 1.16, torsoBob: 0.36, headBob: 0.42, castPulse: 0.62, lean: 0.95, cloth: 0.58, cape: 0.66 },
      layers: { back: 'splitCloak', torso: 'leatherWrap', shoulders: 'softHoodMantle', belt: 'pouchBelt', head: 'bareWarrior', mainProp: 'dagger', offProp: 'dagger', chest: 'crossStraps' },
      palette: { outline: '#0b1009', shadow: 'rgba(0,0,0,0.42)', skin: '#d49a72', skinShadow: '#85583f', hair: '#3d2b1c', hairHi: '#6b4a2e', cloth: '#253820', clothDark: '#0b1208', clothHi: '#4f7340', accent: '#77b85f', accentDark: '#2f4c26', boot: '#1c160f', bootHi: '#4c3924', belt: '#5a3b20', metal: '#aebaa6', metalDark: '#465143', glow: '#a9ff7e' }
    },
    assassin: {
      id: 'assassin', display: 'Assassin',
      silhouette: { shoulder: 0.78, torso: 0.76, waist: 0.70, hem: 0.72, coat: 32, mantle: 0.68, prop: 0.92, collar: 1.02, hood: 1.08, stance: 0.86 },
      posture: { armSwing: 1.20, stride: 1.18, torsoBob: 0.34, headBob: 0.38, castPulse: 0.80, lean: 1.24, cloth: 0.62, cape: 0.72 },
      layers: { back: 'splitCloak', torso: 'leatherWrap', shoulders: 'softHoodMantle', belt: 'pouchBelt', head: 'deepHood', mainProp: 'dagger', offProp: 'dagger', chest: 'crossStraps' },
      palette: { outline: '#080711', shadow: 'rgba(0,0,0,0.50)', skin: '#c99178', skinShadow: '#765044', hair: '#111019', hairHi: '#302944', cloth: '#191527', clothDark: '#07050e', clothHi: '#3b3156', accent: '#b777ff', accentDark: '#4c2f76', boot: '#151014', bootHi: '#382b38', belt: '#4b334e', metal: '#b7adca', metalDark: '#4e475c', glow: '#d78cff' }
    },
    wizard: {
      id: 'wizard', display: 'Wizard',
      silhouette: { shoulder: 0.88, torso: 0.86, waist: 0.78, hem: 1.06, coat: 48, mantle: 1.02, prop: 1.06, collar: 1.24, hood: 0.22, stance: 0.90 },
      posture: { armSwing: 0.42, stride: 0.64, torsoBob: 0.30, headBob: 0.38, castPulse: 1.52, lean: 0.42, cloth: 1.12, cape: 0.88 },
      layers: { back: 'ribbonMantle', torso: 'illusionRobe', shoulders: 'mesmerCollar', belt: 'charmSash', head: 'mindCirclet', mainProp: 'charmScepter', offProp: 'charmFocus', chest: 'charmSigil' },
      palette: { outline: '#0b1324', shadow: 'rgba(0,0,0,0.38)', skin: '#dca982', skinShadow: '#9b6853', hair: '#263556', hairHi: '#5774a8', cloth: '#1b2e68', clothDark: '#070e24', clothHi: '#4c73c6', accent: '#6fa8ff', accentDark: '#294d8f', boot: '#111827', bootHi: '#33415f', belt: '#405b88', metal: '#c8d6f2', metalDark: '#526079', glow: '#8ec9ff' }
    },
    shaman: {
      id: 'shaman', display: 'Shaman',
      silhouette: { shoulder: 0.94, torso: 0.92, waist: 0.84, hem: 1.02, coat: 40, mantle: 0.96, prop: 1.10, collar: 1.02, hood: 0.38, stance: 0.96 },
      posture: { armSwing: 0.58, stride: 0.78, torsoBob: 0.40, headBob: 0.46, castPulse: 1.28, lean: 0.56, cloth: 0.96, cape: 0.78 },
      layers: { back: 'talismanCoat', torso: 'asymRitualRobe', shoulders: 'highCollar', belt: 'runeSash', head: 'arcaneCirclet', mainProp: 'ritualRod', offProp: 'floatingOrb', chest: 'talismans' },
      palette: { outline: '#071713', shadow: 'rgba(0,0,0,0.40)', skin: '#d79f78', skinShadow: '#845945', hair: '#263326', hairHi: '#566f52', cloth: '#17453e', clothDark: '#061815', clothHi: '#328071', accent: '#59c9b2', accentDark: '#22685f', boot: '#101b17', bootHi: '#33453b', belt: '#3b574f', metal: '#bdd7cd', metalDark: '#4d665f', glow: '#70e6d3' }
    },
'''
s = s.replace('  const PROFILES = Object.freeze({\n    fighter:', '  const PROFILES = Object.freeze({\n' + profile_insert + '    fighter:')
p.write_text(s)

# render3d class visuals for new classes.
p = root/'systems/render3d-system.js'
s = p.read_text()
new_vis = '''  const CLASS_VISUALS = {
    Paladin:    { color: classColor('Paladin', '#f3d46b'), head: 'halo', weapon: 'sword', robe: false, widthScale: 1.08 },
    Warden:     { color: classColor('Warden', '#8fcf70'), head: 'crown', weapon: 'staff', robe: false, widthScale: 1.12 },
    Fighter:    { color: classColor('Fighter', '#d0b070'), head: 'helmet', weapon: 'sword', robe: false, widthScale: 1.08 },
    Rogue:      { color: classColor('Rogue', '#9fa4aa'), head: 'hood', weapon: 'daggers', robe: false, widthScale: 0.85 },
    Ranger:     { color: classColor('Ranger', '#77b85f'), head: 'hood', weapon: 'sword', robe: false, widthScale: 0.92 },
    Assassin:   { color: classColor('Assassin', '#7e6aa8'), head: 'hood', weapon: 'daggers', robe: false, widthScale: 0.84 },
    Wizard:     { color: classColor('Wizard', '#6fa8ff'), head: 'hat', weapon: 'orb', robe: true, widthScale: 0.90 },
    Shaman:     { color: classColor('Shaman', '#59c9b2'), head: 'crown', weapon: 'staff', robe: true, widthScale: 0.95 },
    Summoner:   { color: classColor('Summoner', '#66d6c7'), head: 'hood', weapon: 'orb', robe: true, widthScale: 0.9 },
    Necromancer:{ color: classColor('Necromancer', '#78a06a'), head: 'hood', weapon: 'staff', robe: true, widthScale: 0.95 },
    Cleric:     { color: classColor('Cleric', '#f0e6a0'), head: 'halo', weapon: 'staff', robe: true, widthScale: 1.0 },
    Druid:      { color: classColor('Druid', '#78c26d'), head: 'crown', weapon: 'staff', robe: true, widthScale: 0.95 },
    Bard:       { color: classColor('Bard', '#c69bea'), head: 'hat', weapon: 'lute', robe: false, widthScale: 0.9 },
    Enchanter:  { color: classColor('Enchanter', '#b8a0ff'), head: 'hat', weapon: 'orb', robe: true, widthScale: 0.9 }
  };'''
s = re.sub(r"  const CLASS_VISUALS = \{.*?\n  \};", new_vis, s, flags=re.S)
p.write_text(s)

# Sprite model lists.
for rel in ['systems/sprite-atlas-system.js','systems/sprite-sheet-system.js','systems/sprite-bake-system.js']:
    p = root/rel
    s = p.read_text()
    s = re.sub(r"const CLASS_MODELS = Object\.freeze\(\[.*?\]\);", "const CLASS_MODELS = Object.freeze(['Paladin', 'Warden', 'Fighter', 'Rogue', 'Ranger', 'Assassin', 'Wizard', 'Shaman', 'Summoner', 'Necromancer', 'Cleric', 'Druid', 'Bard', 'Enchanter']);", s)
    p.write_text(s)

# Mercenary class pools.
p = root/'systems/mercenary-system.js'
s = p.read_text()
s = s.replace("if (key === 'guardian') return ['Fighter', 'Cleric'];", "if (key === 'guardian') return ['Paladin', 'Warden'];")
s = s.replace("if (key === 'adept') return ['Summoner', 'Enchanter', 'Necromancer', 'Druid', 'Cleric'];", "if (key === 'adept') return ['Wizard', 'Shaman', 'Summoner', 'Enchanter', 'Necromancer'];")
s = s.replace("if (key === 'scout') return ['Rogue', 'Bard', 'Fighter'];", "if (key === 'scout') return ['Ranger', 'Assassin', 'Rogue', 'Bard', 'Fighter'];")
p.write_text(s)

# NPC trainer names, drafts, and placements.
p = root/'systems/npc-system.js'
s = p.read_text()
s = s.replace("  const TRAINER_GIVEN_NAMES = Object.freeze({\n    Fighter:", "  const TRAINER_GIVEN_NAMES = Object.freeze({\n    Paladin: ['Aurel', 'Gareth', 'Ser Caldan', 'Maeron'],\n    Warden: ['Bram', 'Irowen', 'Cael', 'Thorn'],\n    Fighter:")
s = s.replace("    Rogue: ['Vexa', 'Keir', 'Nessa', 'Shade'],", "    Rogue: ['Vexa', 'Keir', 'Nessa', 'Shade'],\n    Ranger: ['Rowan', 'Thorne', 'Iven', 'Kestrel'],\n    Assassin: ['Nyx', 'Sable', 'Kairn', 'Velis'],")
s = s.replace("    Summoner: ['Ilyr', 'Aelric', 'Nemea', 'Soren'],", "    Wizard: ['Althos', 'Merion', 'Vaelin', 'Edrin'],\n    Shaman: ['Korr', 'Mara', 'Tavik', 'Syla'],\n    Summoner: ['Ilyr', 'Aelric', 'Nemea', 'Soren'],")
if 'npc_paladin_trainer' not in s:
    placement = """    { zone: 'dark_woods', x: 91, y: 100, npcId: 'npc_paladin_trainer' },\n    { zone: 'dark_woods', x: 110, y: 100, npcId: 'npc_warden_trainer' },\n    { zone: 'dark_woods', x: 90, y: 103, npcId: 'npc_ranger_trainer' },\n    { zone: 'dark_woods', x: 110, y: 106, npcId: 'npc_assassin_trainer' },\n    { zone: 'dark_woods', x: 92, y: 92, npcId: 'npc_wizard_trainer' },\n    { zone: 'dark_woods', x: 108, y: 92, npcId: 'npc_shaman_trainer' },\n\n"""
    s = s.replace("    // Trainers use comfortable spacing around the compact camp ring.\n", "    // Trainers use comfortable spacing around the compact camp ring.\n" + placement)
p.write_text(s)

p = root/'data/npcs.js'
s = p.read_text()
if 'npc_paladin_trainer' not in s:
    trainers = r'''
    ,
    {
      id: 'npc_paladin_trainer', name: 'Aurel Lightshield', species: 'human', npcRole: 'guard', role: 'class_trainer', faction: 'Dark Woods Settlement', level: 8,
      portrait: { family: 'trainer', color: '#f3d46b', glyph: 'P' }, dialogueId: 'dialogue_paladin_trainer', questIds: [], shopId: null,
      trainerClass: 'Paladin', className: 'Paladin', playerClass: 'Paladin', classId: 'Paladin', rendererId: 'classTrainer', visualRole: 'class_trainer', trainerVisualVariant: 'paladin_mentor', vendorTags: ['training', 'oaths', 'shield'], patrol: { mode: 'stationary', radius: 0, speed: 0 }, interactionRange: 2.25, safeZoneRadius: 4, color: '#f3d46b', label: 'T', notes: 'Paladin class trainer for the 14-class roster.'
    },
    {
      id: 'npc_warden_trainer', name: 'Bram Ironroot', species: 'human', npcRole: 'guard', role: 'class_trainer', faction: 'Dark Woods Settlement', level: 8,
      portrait: { family: 'trainer', color: '#8fcf70', glyph: 'W' }, dialogueId: 'dialogue_warden_trainer', questIds: [], shopId: null,
      trainerClass: 'Warden', className: 'Warden', playerClass: 'Warden', classId: 'Warden', rendererId: 'classTrainer', visualRole: 'class_trainer', trainerVisualVariant: 'warden_mentor', vendorTags: ['training', 'nature', 'shield'], patrol: { mode: 'stationary', radius: 0, speed: 0 }, interactionRange: 2.25, safeZoneRadius: 4, color: '#8fcf70', label: 'T', notes: 'Warden class trainer for the 14-class roster.'
    },
    {
      id: 'npc_ranger_trainer', name: 'Rowan Greenbow', species: 'human', npcRole: 'villager', role: 'class_trainer', faction: 'Dark Woods Settlement', level: 8,
      portrait: { family: 'trainer', color: '#77b85f', glyph: 'R' }, dialogueId: 'dialogue_ranger_trainer', questIds: [], shopId: null,
      trainerClass: 'Ranger', className: 'Ranger', playerClass: 'Ranger', classId: 'Ranger', rendererId: 'classTrainer', visualRole: 'class_trainer', trainerVisualVariant: 'ranger_mentor', vendorTags: ['training', 'bows', 'traps'], patrol: { mode: 'stationary', radius: 0, speed: 0 }, interactionRange: 2.25, safeZoneRadius: 4, color: '#77b85f', label: 'T', notes: 'Ranger class trainer for the 14-class roster.'
    },
    {
      id: 'npc_assassin_trainer', name: 'Nyx Wirehand', species: 'human', npcRole: 'villager', role: 'class_trainer', faction: 'Dark Woods Settlement', level: 8,
      portrait: { family: 'trainer', color: '#7e6aa8', glyph: 'A' }, dialogueId: 'dialogue_assassin_trainer', questIds: [], shopId: null,
      trainerClass: 'Assassin', className: 'Assassin', playerClass: 'Assassin', classId: 'Assassin', rendererId: 'classTrainer', visualRole: 'class_trainer', trainerVisualVariant: 'assassin_mentor', vendorTags: ['training', 'crossbow', 'traps'], patrol: { mode: 'stationary', radius: 0, speed: 0 }, interactionRange: 2.25, safeZoneRadius: 4, color: '#7e6aa8', label: 'T', notes: 'Assassin class trainer for the 14-class roster.'
    },
    {
      id: 'npc_wizard_trainer', name: 'Althos Blueflame', species: 'human', npcRole: 'villager', role: 'class_trainer', faction: 'Dark Woods Settlement', level: 8,
      portrait: { family: 'trainer', color: '#6fa8ff', glyph: 'W' }, dialogueId: 'dialogue_wizard_trainer', questIds: [], shopId: null,
      trainerClass: 'Wizard', className: 'Wizard', playerClass: 'Wizard', classId: 'Wizard', rendererId: 'classTrainer', visualRole: 'class_trainer', trainerVisualVariant: 'wizard_mentor', vendorTags: ['training', 'arcane', 'spellbook'], patrol: { mode: 'stationary', radius: 0, speed: 0 }, interactionRange: 2.25, safeZoneRadius: 4, color: '#6fa8ff', label: 'T', notes: 'Wizard class trainer for the 14-class roster.'
    },
    {
      id: 'npc_shaman_trainer', name: 'Korr Stormstone', species: 'human', npcRole: 'villager', role: 'class_trainer', faction: 'Dark Woods Settlement', level: 8,
      portrait: { family: 'trainer', color: '#59c9b2', glyph: 'S' }, dialogueId: 'dialogue_shaman_trainer', questIds: [], shopId: null,
      trainerClass: 'Shaman', className: 'Shaman', playerClass: 'Shaman', classId: 'Shaman', rendererId: 'classTrainer', visualRole: 'class_trainer', trainerVisualVariant: 'shaman_mentor', vendorTags: ['training', 'storm', 'spirits'], patrol: { mode: 'stationary', radius: 0, speed: 0 }, interactionRange: 2.25, safeZoneRadius: 4, color: '#59c9b2', label: 'T', notes: 'Shaman class trainer for the 14-class roster.'
    }
'''
    s = s.replace('\n\n\n  ];\n\n  DR.MOB_DRAFTS', trainers + '\n\n  ];\n\n  DR.MOB_DRAFTS')
p.write_text(s)

# Version metadata / notes.
version_line = 'Dream Realms V0.15.89 — 14-Class Roster Spellbook Integration\n'
(root/'VERSION.txt').write_text(version_line)
(root/'docs/V0.15.89_14_CLASS_ROSTER_SPELLBOOK_INTEGRATION.txt').write_text('''Dream Realms V0.15.89 — 14-Class Roster Spellbook Integration

Imported the uploaded Level 1–20 Class Spellbook into runtime systems:
- Canonical playable class order: Paladin, Warden, Fighter, Rogue, Ranger, Assassin, Wizard, Shaman, Summoner, Necromancer, Cleric, Druid, Bard, Enchanter.
- DR.CLASSES now exposes all 14 classes with role metadata, base stats, combat style, auto-attack range, colors, and role descriptions.
- DR.CLASS_SPELL_BOOK now contains exactly 20 level-gated abilities per class, 280 total.
- Core stat growth was expanded so new classes do not fall back to Fighter scaling.
- Added starter gear and item definitions for Paladin, Warden, Ranger, Assassin, Wizard, and Shaman; corrected Fighter starter gear toward 2H heavy-weapon DPS identity.
- Added starter-camp trainer NPC drafts and default placements for the six newly playable classes.
- Expanded loot archetypes, mercenary role pools, procedural class renderer aliases/profiles, 3D class visuals, and sprite model registries for the full 14-class roster.

Known limitation: the new class spell VFX use the existing runtime spell-kind compiler mappings rather than bespoke per-spell animation art. This keeps the integration stable and playable before deeper class-specific animation passes.
''')

p = root/'core/config.js'
s = p.read_text()
s = "// V0.15.89: 14-class roster spellbook integration - added Paladin, Warden, Ranger, Assassin, Wizard, and Shaman as playable classes from the uploaded Level 1-20 class spellbook, expanded DR.CLASSES/DR.CLASS_SPELL_BOOK to 14 classes and 280 abilities, added starter gear, trainers, stat growth, loot archetypes, merc pools, and renderer aliases for the full roster.\n" + re.sub(r"^// V0\.15\.88: .*\n", "", s)
s = s.replace("window.DREAM_REALMS_VERSION = '0.15.88';", "window.DREAM_REALMS_VERSION = '0.15.89';")
s = s.replace("window.DREAM_REALMS_BUILD_NAME = 'Dream Realms V0.15.88 Class Emblem Icon Integration';", "window.DREAM_REALMS_BUILD_NAME = 'Dream Realms V0.15.89 14-Class Roster Spellbook Integration';")
p.write_text(s)

html_path = root/'Dream Realms V0.15.52.html'
s = html_path.read_text()
s = s.replace('<title>Dream Realms V0.15.88 - Class Emblem Icon Integration</title>', '<title>Dream Realms V0.15.89 - 14-Class Roster Spellbook Integration</title>')
li = "<li><strong>V0.15.89:</strong> Added the full 14-class playable roster from the Level 1-20 Class Spellbook: Paladin, Warden, Fighter, Rogue, Ranger, Assassin, Wizard, Shaman, Summoner, Necromancer, Cleric, Druid, Bard, and Enchanter. Runtime data now includes 20 level-gated abilities per class / 280 total, expanded stat growth, starter gear, trainers, loot archetypes, mercenary class pools, and renderer routing for the new classes.</li>"
# Insert before V0.15.88 entries in both visible patch-note lists if absent.
if 'V0.15.89:' not in s:
    s = s.replace('          <li><strong>V0.15.88:', '          ' + li + '\n          <li><strong>V0.15.88:', 1)
    s = s.replace('            <li><strong>V0.15.88:', '            ' + li + '\n            <li><strong>V0.15.88:', 1)
html_path.write_text(s)

p = root/'PATCH_NOTES.md'
s = p.read_text()
if '## V0.15.89' not in s:
    insert = """
## V0.15.89 — 14-Class Roster Spellbook Integration

- Imported the uploaded Level 1–20 Class Spellbook as runtime class/spell data.
- Added Paladin, Warden, Ranger, Assassin, Wizard, and Shaman as playable classes beside the existing Fighter, Rogue, Summoner, Necromancer, Cleric, Druid, Bard, and Enchanter.
- Rebuilt `DR.CLASSES` and `DR.CLASS_SPELL_BOOK` to the canonical 14-class order with exactly 20 level-gated abilities per class / 280 total.
- Added core stat growth, starter gear, trainer NPCs, default trainer placements, loot archetypes, mercenary role pools, class renderer aliases/profiles, 3D class visuals, and sprite registry coverage for the full roster.
- Corrected Fighter starter gear toward its heavy-weapon 2H melee DPS identity rather than shield-tank gear.

"""
    s = s.replace('## V0.15.88', insert + '## V0.15.88')
p.write_text(s)

# Basic validation summary from generated data files.
print('patched V0.15.89 class roster integration')
