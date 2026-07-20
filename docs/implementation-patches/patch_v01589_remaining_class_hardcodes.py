from pathlib import Path

ROOT = Path('/mnt/data/dr_work/Dream Realms V0.15.52')
CLASS_ORDER = [
    'Paladin', 'Warden', 'Fighter', 'Rogue', 'Ranger', 'Assassin', 'Wizard', 'Shaman',
    'Summoner', 'Necromancer', 'Cleric', 'Druid', 'Bard', 'Enchanter'
]
CLASS_LIST_JS = '[' + ', '.join(repr(c) for c in CLASS_ORDER) + ']'

# systems/bot-player-system.js
p = ROOT / 'systems/bot-player-system.js'
s = p.read_text()
s = s.replace(
    "const BOT_CLASSES = ['Fighter', 'Cleric', 'Rogue', 'Enchanter', 'Summoner', 'Druid', 'Bard', 'Necromancer'];",
    f"const BOT_CLASSES = {CLASS_LIST_JS};"
)
s = s.replace(
    "{ id: 'bot-guardian-bram', name: 'Bram', className: 'Fighter', role: 'tank', personalityId: 'steady', questName: 'Hold the Old Road', behaviorGoal: 'road-patrol', offset: { x: 2.8, y: 1.8 } },",
    "{ id: 'bot-guardian-bram', name: 'Bram', className: 'Paladin', role: 'tank', personalityId: 'steady', questName: 'Hold the Old Road', behaviorGoal: 'road-patrol', offset: { x: 2.8, y: 1.8 } },"
)
s = s.replace(
"""  const BOT_CLASS_AI_PROFILES = Object.freeze({
    fighter: {
      className: 'Fighter', role: 'tank', preferredRange: 1.18,
      healThreshold: 0.0, allyHealThreshold: 0.0,
      spellPriority: ['taunt', 'defensive', 'meleeDebuff', 'aoeMelee', 'melee'],
      fallbackDamageScale: 0.72,
      activity: 'Tanking'
    },""",
"""  const BOT_CLASS_AI_PROFILES = Object.freeze({
    paladin: {
      className: 'Paladin', role: 'tank', preferredRange: 1.18,
      healThreshold: 0.42, emergencyThreshold: 0.25, allyHealThreshold: 0.0,
      spellPriority: ['taunt', 'defensive', 'selfHeal', 'groupBuff', 'meleeDebuff', 'aoeMelee', 'melee'],
      fallbackDamageScale: 0.78,
      activity: 'Tanking'
    },
    warden: {
      className: 'Warden', role: 'tank', preferredRange: 1.24,
      healThreshold: 0.48, emergencyThreshold: 0.28, allyHealThreshold: 0.0,
      spellPriority: ['taunt', 'defensive', 'selfHeal', 'root', 'aoeDebuff', 'meleeDebuff', 'aoeMelee', 'melee'],
      fallbackDamageScale: 0.76,
      activity: 'Tanking'
    },
    fighter: {
      className: 'Fighter', role: 'meleeDps', preferredRange: 1.32,
      healThreshold: 0.0, allyHealThreshold: 0.0,
      spellPriority: ['meleeDebuff', 'dashStrike', 'aoeMelee', 'melee', 'buff'],
      fallbackDamageScale: 1.08,
      activity: 'Heavy-Weapon DPS'
    },"""
)
s = s.replace(
"""    summoner: {
      className: 'Summoner', role: 'pet_caster', preferredRange: 5.6,
      healThreshold: 0.0, allyHealThreshold: 0.0,
      spellPriority: ['summonPet', 'petHeal', 'petBuff', 'boltSummon', 'bolt', 'aoe', 'groupBuff'],
      fallbackDamageScale: 0.72,
      activity: 'Pet Casting'
    },""",
"""    ranger: {
      className: 'Ranger', role: 'physicalRangedDps', preferredRange: 6.6,
      healThreshold: 0.0, allyHealThreshold: 0.0,
      spellPriority: ['mark', 'trap', 'root', 'bolt', 'aoe', 'buff'],
      fallbackDamageScale: 0.94,
      activity: 'Bow DPS'
    },
    assassin: {
      className: 'Assassin', role: 'physicalRangedDps', preferredRange: 5.9,
      healThreshold: 0.0, allyHealThreshold: 0.0,
      spellPriority: ['mark', 'trap', 'boltDot', 'bolt', 'aoe', 'buff'],
      fallbackDamageScale: 0.98,
      activity: 'Ranged Execution'
    },
    wizard: {
      className: 'Wizard', role: 'casterDps', preferredRange: 6.4,
      healThreshold: 0.0, allyHealThreshold: 0.0,
      spellPriority: ['aoe', 'boltDot', 'root', 'defensive', 'bolt', 'buff'],
      fallbackDamageScale: 0.92,
      activity: 'Arcane Casting'
    },
    shaman: {
      className: 'Shaman', role: 'casterDps', preferredRange: 6.0,
      healThreshold: 0.0, allyHealThreshold: 0.0,
      spellPriority: ['aoe', 'boltDot', 'root', 'debuff', 'bolt', 'buff'],
      fallbackDamageScale: 0.90,
      activity: 'Primal Casting'
    },
    summoner: {
      className: 'Summoner', role: 'pet_caster', preferredRange: 5.6,
      healThreshold: 0.0, allyHealThreshold: 0.0,
      spellPriority: ['summonPet', 'petHeal', 'petBuff', 'boltSummon', 'bolt', 'aoe', 'groupBuff'],
      fallbackDamageScale: 0.72,
      activity: 'Pet Casting'
    },"""
)
s = s.replace(
"""  const BOT_TEMPLATE_DEFS = Object.freeze({
    fighter: { id: 'classbot-fighter', name: 'Fighter Bot', className: 'Fighter', role: 'tank', behaviorGoal: 'road-patrol' },""",
"""  const BOT_TEMPLATE_DEFS = Object.freeze({
    paladin: { id: 'classbot-paladin', name: 'Paladin Bot', className: 'Paladin', role: 'tank', behaviorGoal: 'road-patrol' },
    warden: { id: 'classbot-warden', name: 'Warden Bot', className: 'Warden', role: 'tank', behaviorGoal: 'road-patrol' },
    fighter: { id: 'classbot-fighter', name: 'Fighter Bot', className: 'Fighter', role: 'meleeDps', behaviorGoal: 'road-patrol' },
    ranger: { id: 'classbot-ranger', name: 'Ranger Bot', className: 'Ranger', role: 'physicalRangedDps', behaviorGoal: 'road-patrol' },
    assassin: { id: 'classbot-assassin', name: 'Assassin Bot', className: 'Assassin', role: 'physicalRangedDps', behaviorGoal: 'road-patrol' },
    wizard: { id: 'classbot-wizard', name: 'Wizard Bot', className: 'Wizard', role: 'casterDps', behaviorGoal: 'questing' },
    shaman: { id: 'classbot-shaman', name: 'Shaman Bot', className: 'Shaman', role: 'casterDps', behaviorGoal: 'questing' },"""
)
s = s.replace(
"""  const BOT_CLASS_ROLE_INFO = Object.freeze({
    fighter: { icon: '🛡', label: 'Tank', desc: 'Front-line tank that taunts, holds threat, and protects the group.' },""",
"""  const BOT_CLASS_ROLE_INFO = Object.freeze({
    paladin: { icon: '✚', label: 'Tank', desc: 'Holy shield tank that holds threat with divine mitigation, taunts, and protection tools.' },
    warden: { icon: '◆', label: 'Tank', desc: 'Nature and stone tank that uses bark armor, roots, thorns, and regeneration.' },
    fighter: { icon: '⚔', label: 'Melee DPS', desc: 'Heavy-weapon leather bruiser that deals 2H damage with cleaves, staggers, and momentum.' },"""
)
s = s.replace(
"""    rogue: { icon: '🗡', label: 'Melee DPS', desc: 'Burst melee fighter that favors flank attacks, bleeds, and poison pressure.' },""",
"""    rogue: { icon: '🗡', label: 'Melee DPS', desc: 'Burst melee fighter that favors flank attacks, bleeds, and poison pressure.' },
    ranger: { icon: '➶', label: 'Physical Ranged DPS', desc: 'Bow, trap, and tracking damage dealer that controls distance and terrain.' },
    assassin: { icon: '⌁', label: 'Physical Ranged DPS', desc: 'Trap, throwing weapon, poison dart, and crossbow execution specialist.' },
    wizard: { icon: '✧', label: 'Magic Ranged DPS', desc: 'Arcane, fire, and frost caster focused on ranged spell burst and area damage.' },
    shaman: { icon: '◈', label: 'Magic Ranged DPS', desc: 'Storm, earth, and spirit damage caster focused on primal ranged pressure.' },"""
)
s = s.replace(
"const preferredOrder = ['Fighter', 'Cleric', 'Druid', 'Summoner', 'Bard', 'Necromancer', 'Rogue', 'Enchanter'];",
    f"const preferredOrder = {CLASS_LIST_JS};"
)
p.write_text(s)

# data/races.js: remove obsolete recommendations and make the class picker aware of the new full roster.
p = ROOT / 'data/races.js'
s = p.read_text()
s = s.replace("recommendedClasses: ['Fighter','Cleric','Druid','Rogue','Bard','Summoner','Enchanter','Necromancer'],", f"recommendedClasses: {CLASS_LIST_JS},")
s = s.replace("recommendedClasses: ['Druid','Ranger','Bard','Enchanter','Wizard','Rogue'],", "recommendedClasses: ['Druid','Ranger','Bard','Enchanter','Wizard','Rogue','Cleric','Shaman'],")
s = s.replace("recommendedClasses: ['Shaman','Druid','Monk','Rogue','Ranger','Cleric'],", "recommendedClasses: ['Shaman','Druid','Warden','Ranger','Cleric','Necromancer'],")
s = s.replace("recommendedClasses: ['Rogue','Tinkerer','Ranger','Bard','Necromancer'],", "recommendedClasses: ['Rogue','Assassin','Ranger','Bard','Necromancer','Fighter'],")
p.write_text(s)

# Renderer merc-role defaults: map tank mercs to true tanks, scout to physical ranged, adept to caster DPS.
for rel in ['render/class-identity-procedural-model.js', 'render/entity-renderer.js']:
    p = ROOT / rel
    s = p.read_text()
    s = s.replace("guardian: 'fighter', cleric: 'cleric', fieldcleric: 'cleric', adept: 'summoner', scout: 'rogue'",
                  "guardian: 'paladin', cleric: 'cleric', fieldcleric: 'cleric', adept: 'wizard', scout: 'ranger'")
    s = s.replace("guardian: 'Fighter', cleric: 'Cleric', fieldcleric: 'Cleric', adept: 'Summoner', scout: 'Rogue'",
                  "guardian: 'Paladin', cleric: 'Cleric', fieldcleric: 'Cleric', adept: 'Wizard', scout: 'Ranger'")
    s = s.replace("guardian: 'Fighter', cleric: 'Cleric', adept: 'Enchanter', scout: 'Rogue'",
                  "guardian: 'Paladin', cleric: 'Cleric', adept: 'Wizard', scout: 'Ranger'")
    s = s.replace("guardian: 'Fighter', cleric: 'Cleric', adept: 'Enchanter', scout: 'Rogue'",
                  "guardian: 'Paladin', cleric: 'Cleric', adept: 'Wizard', scout: 'Ranger'")
    s = s.replace("mercMap[e.roleKey] || 'Fighter'", "mercMap[e.roleKey] || 'Paladin'")
    p.write_text(s)

# Add documentation addendum.
doc = ROOT / 'docs/V0.15.89_14_CLASS_ROSTER_SPELLBOOK_INTEGRATION.txt'
text = doc.read_text() if doc.exists() else ''
addendum = """

Additional hardcode cleanup:
- Updated bot playable class roster/order to all 14 classes.
- Reassigned autonomous guardian bot identity from Fighter to Paladin so Fighter remains melee DPS.
- Added bot AI profiles/templates/role labels for Paladin, Warden, Ranger, Assassin, Wizard, and Shaman.
- Updated race recommended-class lists and removed obsolete Monk/Tinkerer recommendations.
- Updated mercenary renderer role defaults so guardian/scout/adept resolve to Paladin/Ranger/Wizard instead of old 8-class fallbacks.
"""
if 'Additional hardcode cleanup:' not in text:
    doc.write_text(text.rstrip() + addendum)

print('patched remaining class hardcodes')
