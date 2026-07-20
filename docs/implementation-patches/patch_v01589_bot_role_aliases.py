from pathlib import Path
ROOT = Path('/mnt/data/dr_work/Dream Realms V0.15.52')

p = ROOT / 'core/utils.js'
s = p.read_text()
s = s.replace("""    guardian: 'tank',
    fighter: 'tank',
    healer: 'healer',""", """    guardian: 'tank',
    paladin: 'tank',
    warden: 'tank',
    fighter: 'meleeDps',
    healer: 'healer',""")
s = s.replace("""    ranged: 'casterDps',
    ranged_dps: 'casterDps',""", """    ranged: 'casterDps',
    ranged_dps: 'casterDps',
    physicalrangeddps: 'physicalRangedDps',
    physical_ranged_dps: 'physicalRangedDps',
    ranger: 'physicalRangedDps',
    assassin: 'physicalRangedDps',
    wizard: 'casterDps',
    shaman: 'casterDps',""")
s = s.replace("return botRoleIn(role, ['meleeDps']);", "return botRoleIn(role, ['meleeDps']);")
s = s.replace("return botRoleIn(role, ['casterDps', 'pet_caster', 'pet_dot_caster', 'control_support']);",
              "return botRoleIn(role, ['casterDps', 'pet_caster', 'pet_dot_caster', 'control_support']);")
s = s.replace("return botRoleIn(role, ['healer', 'support', 'casterDps', 'hybrid_healer_damage', 'support_control', 'control_support', 'pet_caster', 'pet_dot_caster']);",
              "return botRoleIn(role, ['healer', 'support', 'casterDps', 'physicalRangedDps', 'hybrid_healer_damage', 'support_control', 'control_support', 'pet_caster', 'pet_dot_caster']);")
s = s.replace("""    if (canonical === 'support_control' || canonical === 'control_support' || canonical === 'support') return 'support';
    if (isBotRangedRole(canonical)) return 'casterDps';""",
              """    if (canonical === 'support_control' || canonical === 'control_support' || canonical === 'support') return 'support';
    if (canonical === 'physicalRangedDps') return 'physicalRangedDps';
    if (isBotRangedRole(canonical)) return 'casterDps';""")
p.write_text(s)

p = ROOT / 'systems/bot-player-system.js'
s = p.read_text()
s = s.replace("""    casterDps: { spellPower: 1.32, magicPower: 1.24, intelligence: 1.18, mana: 0.16, magicCrit: 0.9, magicCritChance: 0.9, attack: 0.34 },
    meleeDps: { attack: 1.28, physicalPower: 1.22, dexterity: 1.05, strength: 0.92, crit: 0.92, critChance: 0.92, speed: 4.0, defense: 0.22 }""",
              """    casterDps: { spellPower: 1.32, magicPower: 1.24, intelligence: 1.18, mana: 0.16, magicCrit: 0.9, magicCritChance: 0.9, attack: 0.34 },
    physicalRangedDps: { attack: 1.24, physicalPower: 1.16, dexterity: 1.18, crit: 0.90, critChance: 0.90, speed: 4.2, defense: 0.18 },
    meleeDps: { attack: 1.28, physicalPower: 1.22, dexterity: 1.05, strength: 0.92, crit: 0.92, critChance: 0.92, speed: 4.0, defense: 0.22 }""")
s = s.replace("if (classKey === 'fighter') return 'tank';", "if (classKey === 'fighter') return 'meleeDps';")
s = s.replace("if (classKey === 'cleric') return 'healer';", "if (classKey === 'paladin' || classKey === 'warden') return 'tank';\n        if (classKey === 'cleric') return 'healer';")
s = s.replace("if (classKey === 'rogue') return 'meleeDps';", "if (classKey === 'rogue') return 'meleeDps';\n        if (classKey === 'ranger' || classKey === 'assassin') return 'physicalRangedDps';")
s = s.replace("if (['summoner', 'necromancer', 'enchanter', 'druid'].includes(classKey)) return 'casterDps';", "if (['summoner', 'necromancer', 'enchanter', 'druid', 'wizard', 'shaman'].includes(classKey)) return 'casterDps';")
p.write_text(s)
print('patched bot role aliases and gear weights')
