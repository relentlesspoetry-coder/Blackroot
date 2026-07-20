from pathlib import Path
import re, json, textwrap
root = Path('/mnt/data/dr_work/Dream Realms V0.15.52')
spell_txt = Path('/mnt/data/Dream Realms - Level 1-20 Class Spellbook.txt')
text = spell_txt.read_text(encoding='utf-8')

# Parse uploaded class spellbook text.
parsed = []
for m in re.finditer(r'^([A-Z][A-Z ]+) — ([A-Z /]+)\n=+\nIdentity: ([^\n]+)\n\nLevel  Spell / Ability\s+Type\s+Function\n[-]+\n(.*?)(?=\n=+\n|\Z)', text, re.M | re.S):
    cname = m.group(1).title().replace('Dps', 'DPS')
    role = m.group(2).title().replace('Dps', 'DPS')
    identity = m.group(3).strip()
    rows = []
    for line in m.group(4).splitlines():
        if not line.strip():
            continue
        mm = re.match(r'^(\d{1,2})\s+(.+?)\s{2,}(.+?)\s{2,}(.+)$', line)
        if not mm:
            raise RuntimeError(f'Could not parse line for {cname}: {line}')
        rows.append({
            'level': int(mm.group(1)),
            'name': mm.group(2).strip(),
            'type': mm.group(3).strip(),
            'desc': mm.group(4).strip(),
        })
    parsed.append({'className': cname, 'role': role, 'identity': identity, 'spells': rows})

class_order = ['Paladin','Warden','Fighter','Rogue','Ranger','Assassin','Wizard','Shaman','Summoner','Necromancer','Cleric','Druid','Bard','Enchanter']
if [c['className'] for c in parsed] != class_order:
    raise RuntimeError([c['className'] for c in parsed])

class_meta = {
    'Paladin': dict(color='#f3d46b', hp=132, mana=92, attack=12, defense=13, speed=0.92, combatStyle='melee', autoAttackRangeTiles=1.35, autoAttackProjectile=False, autoAttackDamageType='physical', attributes=dict(strength=13,dexterity=7,stamina=17,intelligence=8,wisdom=14), role='Tank', skill='Radiant Strike', desc='Holy shield tank. Divine mitigation, auras, self-healing, anti-undead pressure, and high threat control.'),
    'Warden': dict(color='#8fcf70', hp=138, mana=82, attack=11, defense=14, speed=0.90, combatStyle='melee', autoAttackRangeTiles=1.35, autoAttackProjectile=False, autoAttackDamageType='physical', attributes=dict(strength=12,dexterity=8,stamina=18,intelligence=7,wisdom=14), role='Tank', skill='Stonehand Strike', desc='Nature and stone tank. Bark armor, roots, thorns, regeneration, and primal endurance.'),
    'Fighter': dict(color='#d0b070', hp=118, mana=35, attack=19, defense=6, speed=0.98, combatStyle='melee', autoAttackRangeTiles=1.25, autoAttackProjectile=False, autoAttackDamageType='physical', attributes=dict(strength=17,dexterity=9,stamina=13,intelligence=5,wisdom=6), role='Heavy-Weapon Melee DPS', skill='Heavy Swing', desc='Light/leather heavy-weapon melee DPS. Two-handed strikes, cleaves, staggers, momentum, and raw weapon damage. Not a tank.'),
    'Rogue': dict(color='#9fa4aa', hp=92, mana=48, attack=18, defense=4, speed=1.24, combatStyle='melee', autoAttackRangeTiles=1.25, autoAttackProjectile=False, autoAttackDamageType='physical', attributes=dict(strength=12,dexterity=17,stamina=10,intelligence=7,wisdom=8), role='Melee DPS', skill='Quick Cut', desc='Light/leather melee stealth DPS. Daggers, short blades, poisons, bleeds, and evasion.'),
    'Ranger': dict(color='#77b85f', hp=98, mana=62, attack=17, defense=4, speed=1.12, combatStyle='rangedWeapon', autoAttackRangeTiles=7, autoAttackProjectile=True, autoAttackDamageType='physical', attributes=dict(strength=10,dexterity=17,stamina=11,intelligence=7,wisdom=11), role='Physical Ranged DPS', skill='Steady Shot', desc='Bow, trap, and tracking physical ranged DPS. Wilderness scouting, kiting, and terrain control.'),
    'Assassin': dict(color='#7e6aa8', hp=90, mana=58, attack=18, defense=3, speed=1.18, combatStyle='rangedWeapon', autoAttackRangeTiles=6.5, autoAttackProjectile=True, autoAttackDamageType='physical', attributes=dict(strength=10,dexterity=18,stamina=9,intelligence=9,wisdom=7), role='Physical Ranged DPS', skill='Throwing Knife', desc='Ranged executioner. Traps, throwing weapons, crossbow shots, poison bolts, and marked kills. Distinct from melee Rogue.'),
    'Wizard': dict(color='#6fa8ff', hp=76, mana=148, attack=8, defense=3, speed=0.96, combatStyle='rangedCaster', autoAttackRangeTiles=7.5, autoAttackProjectile=True, autoAttackDamageType='magic', attributes=dict(strength=5,dexterity=8,stamina=8,intelligence=18,wisdom=11), role='Magic Ranged DPS', skill='Arcane Bolt', desc='Arcane scholarly ranged damage caster. Spellbooks, mana, fire, frost, and arcane force.'),
    'Shaman': dict(color='#59c9b2', hp=88, mana=130, attack=10, defense=4, speed=0.98, combatStyle='rangedCaster', autoAttackRangeTiles=7, autoAttackProjectile=True, autoAttackDamageType='magic', attributes=dict(strength=7,dexterity=8,stamina=10,intelligence=14,wisdom=15), role='Magic Ranged DPS', skill='Lightning Spark', desc='Primal storm, earth, and spirit ranged damage caster. Not a healer replacement.'),
    'Summoner': dict(color='#66d6c7', hp=82, mana=142, attack=8, defense=3, speed=0.98, combatStyle='rangedCaster', autoAttackRangeTiles=6.8, autoAttackProjectile=True, autoAttackDamageType='magic', attributes=dict(strength=6,dexterity=8,stamina=8,intelligence=15,wisdom=12), role='Pet / DPS', skill='Summon Familiar', desc='Planar pet DPS. Creature bonds, summons, pet commands, and sustained magical pressure through allies.'),
    'Necromancer': dict(color='#78a06a', hp=84, mana=132, attack=10, defense=3, speed=0.96, combatStyle='rangedCaster', autoAttackRangeTiles=6.8, autoAttackProjectile=True, autoAttackDamageType='magic', attributes=dict(strength=7,dexterity=8,stamina=9,intelligence=15,wisdom=10), role='Pet / DPS', skill='Bone Splinter', desc='Undead pet DPS. Bone magic, disease, curses, drains, DoTs, and dark sustain.'),
    'Cleric': dict(color='#f0e6a0', hp=102, mana=128, attack=8, defense=7, speed=0.95, combatStyle='rangedCaster', autoAttackRangeTiles=6.8, autoAttackProjectile=True, autoAttackDamageType='magic', attributes=dict(strength=8,dexterity=7,stamina=12,intelligence=10,wisdom=16), role='Healer', skill='Minor Heal', desc='Holy healer. Direct heals, wards, cleansing, prayers, and anti-undead support.'),
    'Druid': dict(color='#78c26d', hp=96, mana=130, attack=9, defense=5, speed=1.0, combatStyle='rangedCaster', autoAttackRangeTiles=6.8, autoAttackProjectile=True, autoAttackDamageType='magic', attributes=dict(strength=8,dexterity=9,stamina=11,intelligence=13,wisdom=15), role='Healer', skill='Rejuvenating Vine', desc='Nature healer. HoTs, vines, roots, moon magic, animal spirits, and regeneration.'),
    'Bard': dict(color='#c69bea', hp=92, mana=90, attack=11, defense=5, speed=1.12, combatStyle='hybridMeleeSupport', autoAttackRangeTiles=1.5, autoAttackProjectile=False, autoAttackDamageType='physical', attributes=dict(strength=9,dexterity=12,stamina=10,intelligence=10,wisdom=13), role='Support / Utility', skill='Quick Note', desc='Music support. Songs, instruments, buffs, morale, regeneration, meditation synergy, and group utility.'),
    'Enchanter': dict(color='#b8a0ff', hp=78, mana=136, attack=8, defense=3, speed=1.0, combatStyle='rangedCaster', autoAttackRangeTiles=7, autoAttackProjectile=True, autoAttackDamageType='magic', attributes=dict(strength=6,dexterity=9,stamina=8,intelligence=16,wisdom=12), role='Support / Utility', skill='Mind Spark', desc='Mind magic support. Illusions, charms, mesmerize, confusion, rune buffs/debuffs, and control.'),
}

physical_classes = {'Fighter','Rogue','Ranger','Assassin','Paladin','Warden','Bard'}
melee_classes = {'Fighter','Rogue','Paladin','Warden','Bard'}
tank_classes = {'Paladin','Warden'}
pet_classes = {'Summoner','Necromancer'}
healer_classes = {'Cleric','Druid'}
support_classes = {'Bard','Enchanter'}
magic_classes = {'Wizard','Shaman','Summoner','Necromancer','Cleric','Druid','Enchanter'}

colors = {c: class_meta[c]['color'] for c in class_order}
secondary = {
    'Paladin':'#fff2a8','Warden':'#b8e070','Fighter':'#e0c78f','Rogue':'#cfd4d9','Ranger':'#8ed16f','Assassin':'#b777ff','Wizard':'#8ec9ff','Shaman':'#70e6d3','Summoner':'#9ff7ed','Necromancer':'#9fff6d','Cleric':'#fff2ba','Druid':'#a7e384','Bard':'#d7b5ff','Enchanter':'#d9ccff'
}

def js_str(s):
    return json.dumps(s, ensure_ascii=False)

def classify(cname, row):
    t = (row['type'] + ' ' + row['name'] + ' ' + row['desc']).lower()
    name = row['name'].lower()
    is_melee = cname in melee_classes
    is_physical_ranged = cname in {'Ranger','Assassin'}
    # Hard classifications first.
    if 'revive' in t or 'revival' in t:
        return 'revive'
    if 'cleanse' in t or 'purify' in t or 'remove one poison' in t or 'remove stronger harmful' in t:
        return 'cleanse'
    if 'pet heal' in t or 'mend companion' in name or 'corpse mender' in name:
        return 'petHeal'
    if 'pet swarm' in t or 'temporary' in t or 'army of bones' in name or 'call swarm' in name or 'legion gate' in name:
        return 'tempMinions'
    if 'pet command' in t or name.startswith('command '):
        return 'petBuff'
    if ('pet' == row['type'].strip().lower()) or ('summon ' in name and cname in pet_classes and 'temporary' not in t):
        return 'summonPet'
    if 'drain' in t or 'life tap' in name or 'leech' in name:
        return 'drain'
    if 'group heal' in t or 'channel heal' in t or 'group hot' in t or 'aoe heal' in t or 'smart heal' in t or 'wild growth' in name or 'divine light' in name or 'hymn of renewal' in name or 'moonlit tranquility' in name or 'ancient bloom' in name:
        return 'aoeHeal'
    if 'heal' in t or 'hot' in row['type'].lower() or 'mend' in t or 'regenerate health' in t or 'regeneration' in t or 'lifebloom' in name or 'rejuvenating' in name or 'renewal' in name or 'renewing' in name:
        return 'heal'
    if 'capstone' in row['type'].lower() or 'stance' in t or 'cooldown' in t or 'survival' in t or 'defense' in row['type'].lower() or 'self-buff' in t or ('buff' in row['type'].lower() and 'debuff' not in row['type'].lower()):
        if 'group' in t or 'party' in t or 'nearby allies' in t or 'aura' in t or 'zone' in t or 'shelter' in t or 'sanctuary' in t:
            return 'groupBuff'
        return 'buff'
    if 'group defense' in t or 'group cooldown' in t or 'group buff' in t or 'movement buff' in t or 'combat buff' in t or 'meditation support' in t or 'major buff' in t or 'utility' in row['type'].lower() and cname in support_classes:
        return 'groupBuff' if cname in support_classes else 'buff'
    if 'aoe' in t or 'area' in t or 'nearby enemies' in t or 'wide area' in t or 'cone' in t or 'volley' in t or 'rain of' in t or 'ground' in t or 'field' in t or 'zone' in t:
        if 'debuff' in t or 'control' in t or 'taunt' in t or 'threat' in t or 'weaken' in t or 'slow' in t:
            return 'aoeDebuff'
        return 'aoeMelee' if is_melee else 'aoe'
    if 'taunt' in t or 'interrupt' in t or 'control' in t or 'trap' in t or 'debuff' in t or 'mark' in t or 'poison' in t or 'dot' in t or 'silence' in t or 'slow' in t or 'snare' in t or 'root' in t or 'fear' in t or 'weaken' in t or 'curse' in t or 'bleed' in t or 'stagger' in t or 'break' in t:
        if is_melee and not is_physical_ranged:
            return 'meleeDebuff'
        return 'boltDot' if ('dot' in t or 'poison' in t or 'bleed' in t or 'curse' in t or 'flame' in t or 'rot' in t or 'disease' in t) else 'debuff'
    if 'mobility' in row['type'].lower() and cname in {'Rogue','Fighter'}:
        return 'dashStrike' if cname == 'Rogue' else 'buff'
    if 'execute' in t or 'burst' in t:
        if is_melee and not is_physical_ranged:
            return 'melee'
        return 'bolt'
    if is_melee and ('melee' in row['type'].lower() or cname in {'Fighter','Rogue','Paladin','Warden'}):
        return 'melee'
    if 'support / damage' in row['type'].lower():
        return 'bolt'
    return 'bolt'

def mods_for_spell(cname, row, kind):
    t = (row['type'] + ' ' + row['name'] + ' ' + row['desc']).lower()
    mods = {}
    if kind in ('buff','groupBuff','petBuff','transform'):
        if cname in tank_classes:
            mods.update({'defense': 7 if row['level'] < 15 else 11, 'stamina': 1 if row['level'] < 10 else 2})
            if 'threat' in t or 'oath' in t or 'warden form' in t or 'avatar' in t:
                mods['attack'] = 3
        elif cname == 'Fighter':
            mods.update({'attack': 6 + row['level']//4, 'speed': 0.12})
            if 'defense' in t or 'footwork' in t:
                mods['defense'] = 4
        elif cname in {'Rogue','Ranger','Assassin'}:
            mods.update({'attack': 5 + row['level']//5, 'speed': 0.18})
            if 'dodge' in t or 'evasion' in t or 'reflex' in t:
                mods['defense'] = 5
        elif cname in {'Wizard','Shaman'}:
            mods.update({'spellDamage': 5 + row['level']//4, 'intelligence': 1 if row['level'] < 12 else 2})
            if 'shield' in t or 'defense' in t:
                mods['defense'] = 5
        elif cname in pet_classes:
            mods.update({'spellDamage': 4 + row['level']//5, 'wisdom': 1})
            if kind == 'petBuff':
                mods = {'attack': 6 + row['level']//4, 'speed': 0.18}
        elif cname in healer_classes:
            mods.update({'wisdom': 2, 'defense': 4})
        elif cname == 'Bard':
            mods.update({'attack': 4 + row['level']//5, 'speed': 0.12, 'mana': 4})
        elif cname == 'Enchanter':
            mods.update({'spellDamage': 4 + row['level']//5, 'defense': 3})
    elif kind in ('debuff','boltDot','meleeDebuff','aoeDebuff'):
        if 'armor' in t or 'resistance' in t or 'frailty' in t:
            mods['defense'] = -3 - row['level']//6
        if 'damage' in t or 'weaken' in t or 'dissonant' in t or 'dirge' in t:
            mods['attack'] = -3 - row['level']//6
        if 'slow' in t or 'snare' in t or 'root' in t or 'sleep' in t or 'mesmerize' in t or 'control' in t:
            mods['speed'] = -0.8
    return mods

def pet_fields(cname, row, kind):
    if kind not in ('summonPet','boltSummon'):
        return {}
    lvl = row['level']
    if cname == 'Necromancer':
        if 'bone servant' in row['name'].lower() or lvl >= 11:
            name = 'Bone Servant'
            hp = 110 + lvl*8
            atk_min, atk_max = 7 + lvl//3, 11 + lvl//2
            ptype = 'undead'
        elif 'skeleton' in row['name'].lower():
            name = 'Skeleton'
            hp = 90 + lvl*6
            atk_min, atk_max = 6 + lvl//4, 10 + lvl//2
            ptype = 'undead'
        else:
            name = 'Skeleton Minion'
            hp = 82 + lvl*5
            atk_min, atk_max = 5 + lvl//4, 9 + lvl//2
            ptype = 'undead'
        return {'petName': name, 'petType': ptype, 'petColor': '#d8e5b4', 'petHp': hp, 'petAttackMin': atk_min, 'petAttackMax': atk_max, 'petAttackSpeed': 1.8, 'replacePet': True}
    name = 'Planar Familiar' if lvl < 8 else 'Elemental Servitor'
    return {'petName': name, 'petType': 'shard' if lvl < 8 else 'elemental', 'petColor': '#66d6c7', 'petHp': 70 + lvl*6, 'petAttackMin': 5 + lvl//3, 'petAttackMax': 10 + lvl//2, 'petAttackSpeed': 1.75, 'replacePet': True}

def build_spell(cname, row):
    kind = classify(cname, row)
    level = row['level']
    t = (row['type'] + ' ' + row['name'] + ' ' + row['desc']).lower()
    spell = {
        'name': row['name'],
        'levelRequirement': level,
        'kind': kind,
        'cost': 0,
        'cooldown': round(2.4 + min(8, level * 0.26), 1),
        'color': secondary.get(cname, colors[cname]),
        'description': f"{row['type']}. {row['desc']}",
        'category': row['type'],
    }
    # Range and radius.
    if kind in ('melee','meleeDebuff','dashStrike'):
        spell['range'] = 2.05 if kind != 'dashStrike' else 5.0
    elif kind in ('bolt','boltDot','debuff','drain','boltSummon','tempMinions','cleanse','revive'):
        spell['range'] = 7.0 if cname not in {'Ranger','Assassin','Wizard'} else 8.0
    if kind in ('aoe','aoeDebuff','aoeMelee','aoeHeal','groupBuff'):
        spell['radius'] = 3.2 + min(2.6, level * 0.12)
    # Power/heal values.
    if kind in ('heal','aoeHeal'):
        spell['power'] = 0
        spell['heal'] = 24 + level * (5 if cname in healer_classes else 4)
        spell['cooldown'] = round(3.4 + min(7, level * 0.22), 1)
    elif kind == 'cleanse':
        spell['power'] = 0
        spell['removesStatusTags'] = ['poison','disease','curse','shadow','magic','bleed']
        spell['cooldown'] = 8.0
    elif kind == 'revive':
        spell['power'] = 0
        spell['cost'] = 34
        spell['cooldown'] = 18.0
        spell['castTime'] = 1.4
        spell['reviveHpPct'] = 0.32 if cname == 'Druid' else 0.38
        spell['reviveManaPct'] = 0.22
    elif kind == 'summonPet':
        spell['power'] = 0
        spell['cooldown'] = 6.0 + level * 0.35
        spell['castTime'] = 1.0 if level < 10 else 1.6
        spell.update(pet_fields(cname, row, kind))
    elif kind == 'tempMinions':
        spell['power'] = 0
        spell['cooldown'] = 14.0 + level * 0.7
        spell['castTime'] = 1.2
        spell['tempMinionCount'] = 2 if level < 15 else 3 if level < 20 else 5
        spell['tempMinionDuration'] = 10 + min(10, level // 2)
        spell['petAttackMin'] = 5 + level//3
        spell['petAttackMax'] = 9 + level//2
        spell['petAttackSpeed'] = 1.8
    else:
        base = {
            'melee': 24, 'meleeDebuff': 20, 'dashStrike': 22,
            'bolt': 23, 'boltDot': 16, 'debuff': 16, 'drain': 18,
            'aoe': 18, 'aoeMelee': 20, 'aoeDebuff': 14, 'boltSummon': 20,
            'buff': 0, 'groupBuff': 0, 'petBuff': 0, 'transform': 0,
        }.get(kind, 20)
        if base:
            spell['power'] = base + level * (4 if kind not in ('aoe','aoeMelee','aoeDebuff') else 3)
        if kind in ('boltDot','debuff','meleeDebuff','aoeDebuff'):
            spell['tickDamage'] = 3 + level // 2 if any(k in t for k in ['poison','bleed','burn','rot','disease','flame','curse','dot']) else 0
            spell['duration'] = 4 + min(8, level // 2)
            spell['mods'] = mods_for_spell(cname, row, kind)
        if kind in ('buff','groupBuff','petBuff','transform'):
            spell['duration'] = 540 if level < 10 else 720 if level < 18 else 900
            spell['buffName'] = row['name']
            spell['mods'] = mods_for_spell(cname, row, kind)
            if kind == 'buff' and ('group' not in t and 'party' not in t and 'nearby allies' not in t):
                spell['selfOnly'] = True
    # Mana/energy cost.
    if spell['cost'] == 0:
        if cname == 'Fighter':
            spell['cost'] = 0
        elif cname in {'Rogue','Ranger','Assassin'}:
            spell['cost'] = 6 + min(22, level)
        elif cname in tank_classes:
            spell['cost'] = 8 + min(28, level * 2)
        elif cname in healer_classes:
            spell['cost'] = 12 + min(40, level * 2)
        elif cname in support_classes:
            spell['cost'] = 10 + min(34, level * 2)
        else:
            spell['cost'] = 12 + min(42, level * 2)
    # Cast times for caster non-instant spells.
    if cname in magic_classes and kind in ('bolt','boltDot','aoe','aoeDebuff','drain','heal','aoeHeal') and level >= 5:
        spell['castTime'] = 0.8 if kind in ('bolt','drain','heal') else 1.1
    if kind in ('melee','meleeDebuff','dashStrike','buff','groupBuff','petBuff','cleanse'):
        spell.pop('castTime', None)
    # Damage type and tank threat.
    if cname in {'Fighter','Rogue','Ranger','Assassin','Bard'}:
        spell['damageType'] = 'physical'
    elif cname == 'Paladin':
        spell['damageType'] = 'holy'
    elif cname == 'Warden':
        spell['damageType'] = 'nature'
    elif cname == 'Shaman':
        spell['damageType'] = 'elemental'
    elif cname == 'Necromancer':
        spell['damageType'] = 'shadow'
    else:
        spell['damageType'] = 'magic'
    if cname in tank_classes and ('threat' in t or 'taunt' in t or 'challenge' in t or 'roar' in t or 'oath' in t or 'bulwark' in t or 'warden form' in t):
        spell['threatBonus'] = 35 + level * 4
        if 'taunt' in t or 'challenge' in t or 'roar' in t:
            spell['taunt'] = True
            spell['tauntDuration'] = 3.5 + min(2.5, level * 0.08)
            spell['tauntBonus'] = 40 + level * 3
    if 'execute' in t or 'low-health' in t or 'low health' in t:
        spell['executeBonusBelowPct'] = 0.35
    return spell

books = {c['className']: [build_spell(c['className'], row) for row in c['spells']] for c in parsed}

# Write classes.js
class_lines = []
for cname in class_order:
    meta = class_meta[cname]
    attrs = meta['attributes']
    class_lines.append(f"    {cname}: makeClass({js_str(cname)}, {{")
    class_lines.append(f"      color: {js_str(meta['color'])}, hp: {meta['hp']}, mana: {meta['mana']}, attack: {meta['attack']}, defense: {meta['defense']}, speed: {meta['speed']},")
    class_lines.append(f"      combatStyle: {js_str(meta['combatStyle'])}, autoAttackRangeTiles: {meta['autoAttackRangeTiles']}, autoAttackProjectile: {str(meta['autoAttackProjectile']).lower()}, autoAttackDamageType: {js_str(meta['autoAttackDamageType'])},")
    class_lines.append(f"      attributes: {{ strength: {attrs['strength']}, dexterity: {attrs['dexterity']}, stamina: {attrs['stamina']}, intelligence: {attrs['intelligence']}, wisdom: {attrs['wisdom']} }},")
    class_lines.append(f"      role: {js_str(meta['role'])},")
    class_lines.append(f"      skill: {js_str(meta['skill'])},")
    class_lines.append(f"      desc: {js_str(meta['desc'])}")
    class_lines.append("    }),")
class_obj = '\n'.join(class_lines).rstrip(',')
classes_js = f"""(() => {{
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {{}};
  const dist = DR.utils?.dist || ((a, b) => Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0)));

  const COMBAT_STYLE_RANGES = Object.freeze({{
    melee: 1.25,
    hybridMeleeSupport: 1.5,
    rangedCaster: 6,
    rangedWeapon: 7
  }});

  const GLOBAL_AUTO_ATTACK_INTERVAL_MS = 2500;
  const GLOBAL_AUTO_ATTACK_INTERVAL_SECONDS = GLOBAL_AUTO_ATTACK_INTERVAL_MS / 1000;

  const AUTO_ATTACK_SPEED_TUNING = Object.freeze({{
    globalIntervalMs: GLOBAL_AUTO_ATTACK_INTERVAL_MS,
    globalIntervalSeconds: GLOBAL_AUTO_ATTACK_INTERVAL_SECONDS,
    minSwingSeconds: GLOBAL_AUTO_ATTACK_INTERVAL_SECONDS,
    maxSwingSeconds: GLOBAL_AUTO_ATTACK_INTERVAL_SECONDS,
    speedBaseline: 3.2,
    speedScalarPerPoint: 0,
    minHasteMultiplier: 1,
    maxSlowMultiplier: 1
  }});

  const CLASS_ORDER = Object.freeze({json.dumps(class_order)});

  function safeNumber(value, fallback = 0) {{
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }}

  function clampNumber(value, min, max) {{
    return Math.max(min, Math.min(max, safeNumber(value, min)));
  }}

  function equippedWeapon(actor) {{
    const equipment = actor?.equipment || actor?.gear || {{}};
    return equipment.weapon || equipment.mainHand || equipment.mainhand || equipment.primary || null;
  }}

  function weaponSwingSeconds(actor) {{
    const weapon = equippedWeapon(actor);
    if (!weapon) return null;
    const damage = weapon.damage && typeof weapon.damage === 'object' ? weapon.damage : null;
    const raw = weapon.attackSpeed ?? weapon.weaponSpeed ?? weapon.swingSpeed ?? damage?.speed;
    const seconds = safeNumber(raw, NaN);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  }}

  function actorHasteMultiplier(actor, context = {{}}) {{
    if (!actor || context.ignoreSpeedStat === true) return 1;
    const explicit = safeNumber(context.speedBaseline, NaN);
    const fallback = safeNumber(actor.baseSpeed, safeNumber(actor.speed, AUTO_ATTACK_SPEED_TUNING.speedBaseline));
    const baseline = Number.isFinite(explicit) ? explicit : fallback;
    const effective = safeNumber(actor.getStat?.('speed'), safeNumber(actor.speed, baseline));
    const delta = effective - baseline;
    return clampNumber(
      1 - delta * AUTO_ATTACK_SPEED_TUNING.speedScalarPerPoint,
      AUTO_ATTACK_SPEED_TUNING.minHasteMultiplier,
      AUTO_ATTACK_SPEED_TUNING.maxSlowMultiplier
    );
  }}

  function applyAutoAttackSpeedModifiers(actor, baseSeconds, context = {{}}) {{
    if (context.applyExplicitAutoAttackModifiers === true) return baseSeconds * actorHasteMultiplier(actor, context);
    return baseSeconds;
  }}

  function resolveAutoAttackIntervalSeconds(actor, context = {{}}) {{
    const base = GLOBAL_AUTO_ATTACK_INTERVAL_SECONDS;
    const tuned = applyAutoAttackSpeedModifiers(actor, base, context);
    return Number(clampNumber(tuned, GLOBAL_AUTO_ATTACK_INTERVAL_SECONDS, GLOBAL_AUTO_ATTACK_INTERVAL_SECONDS).toFixed(3));
  }}

  function combatIdentity(className) {{
    const definition = DR.CLASSES?.[className] || DR.CLASSES?.Fighter || {{}};
    const combatStyle = definition.combatStyle || 'melee';
    return {{
      combatStyle,
      autoAttackRangeTiles: Number(definition.autoAttackRangeTiles || COMBAT_STYLE_RANGES[combatStyle] || 1.25),
      autoAttackProjectile: definition.autoAttackProjectile === true,
      autoAttackDamageType: definition.autoAttackDamageType || (combatStyle === 'rangedCaster' ? 'magic' : 'physical')
    }};
  }}

  function executeSignatureSpell(game, className) {{
    if (!game?.player) return false;
    const spell = (DR.CLASS_SPELL_BOOK?.[className] || [])[0];
    if (spell && typeof game.resolveClassSpell === 'function') {{
      game.player.spellCastAnim = 1;
      game.spawnCastCue?.(game.player, spell.color || DR.CLASSES?.[className]?.color || '#d8ded1', spell.name || className);
      game.resolveClassSpell(spell, {{ target: game.getTarget?.() || null }});
      return true;
    }}
    game.log?.(`${{className}} training is not ready yet.`);
    return false;
  }}

  function makeClass(name, definition) {{
    return {{
      ...definition,
      use(game) {{ return executeSignatureSpell(game, name); }}
    }};
  }}

  DR.CLASSES = {{
{class_obj}
  }};

  DR.CLASS_ORDER = CLASS_ORDER;
  DR.AUTO_ATTACK_RANGE_TILES = COMBAT_STYLE_RANGES;
  DR.GLOBAL_AUTO_ATTACK_INTERVAL_MS = GLOBAL_AUTO_ATTACK_INTERVAL_MS;
  DR.GLOBAL_AUTO_ATTACK_INTERVAL_SECONDS = GLOBAL_AUTO_ATTACK_INTERVAL_SECONDS;
  DR.AUTO_ATTACK_SPEED_TUNING = AUTO_ATTACK_SPEED_TUNING;
  DR.applyAutoAttackSpeedModifiers = applyAutoAttackSpeedModifiers;
  DR.resolveAutoAttackIntervalSeconds = resolveAutoAttackIntervalSeconds;
  DR.getClassCombatIdentity = combatIdentity;
}})();
"""
(root/'data/classes.js').write_text(classes_js, encoding='utf-8')

# Write spells.js from parsed spellbook.
def obj_to_js(obj, indent=0):
    sp = ' ' * indent
    if isinstance(obj, dict):
        items = []
        for k, v in obj.items():
            key = k if re.match(r'^[A-Za-z_$][\w$]*$', k) else js_str(k)
            items.append(f"{sp}  {key}: {obj_to_js(v, indent+2)}")
        return '{\n' + ',\n'.join(items) + f"\n{sp}}}"
    if isinstance(obj, list):
        if not obj:
            return '[]'
        return '[\n' + ',\n'.join(' '*(indent+2)+obj_to_js(v, indent+2) for v in obj) + f"\n{sp}]"
    if isinstance(obj, str):
        return js_str(obj)
    if isinstance(obj, bool):
        return 'true' if obj else 'false'
    if obj is None:
        return 'null'
    return str(obj)

spell_book_js = obj_to_js(books, 2)
spells_js = f"""(() => {{
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {{}};

  // V0.15.89: 14-class level 1-20 runtime spellbook generated from the canonical design spec.
  // Every class has exactly 20 level-gated abilities. Runtime kinds are mapped onto the existing spell compiler's supported kind set.
  DR.CLASS_SPELL_BOOK = {spell_book_js};
}})();
"""
(root/'data/spells.js').write_text(spells_js, encoding='utf-8')

# Save parsed manifest for audit.
(root/'docs/V0.15.89_14_CLASS_SPELLBOOK_IMPORT_PASS.txt').write_text("""Dream Realms V0.15.89 — 14 Class Spellbook Import Pass

Imported the uploaded 14-class level 1-20 spellbook into runtime data:
- Added Paladin, Warden, Ranger, Assassin, Wizard, and Shaman as playable classes.
- Rebuilt DR.CLASSES with the canonical 14-class order.
- Rebuilt DR.CLASS_SPELL_BOOK so every class has 20 level-gated abilities, 280 total.
- Mapped design ability categories onto the existing runtime spell kinds: melee, ranged bolt, DoT/debuff, AoE, group buff, heal, revive, cleanse, summon pet, pet buff, and temporary minions.
- Preserved Fighter as heavy-weapon melee DPS, Assassin as physical ranged DPS, Shaman as magic ranged DPS, and Paladin/Warden as the two true tanks.
""", encoding='utf-8')

print('Parsed classes:', len(parsed), 'spells:', sum(len(c['spells']) for c in parsed))
