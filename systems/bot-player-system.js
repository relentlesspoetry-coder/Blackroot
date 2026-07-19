// Dream Realms bot player simulation system
// V0.12.95 owner: bot adventure AI, class-model NPC rendering integration, bot gear inspection windows, and bot loot/trade/meditation behavior.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const { dist } = DR.utils;
  const BotPlayer = DR.entities?.BotPlayer;
  const BotRoles = DR.BotRoles || {};

  const BOT_NAME_POOL = ['Aeris', 'Bram', 'Calia', 'Dorin', 'Elowen', 'Fenn', 'Ivara', 'Jarek', 'Kael', 'Luma', 'Neris', 'Orin', 'Perrin', 'Riven', 'Talia', 'Varek', 'Calder', 'Brann', 'Veyra', 'Toren', 'Elric', 'Maelin', 'Odran', 'Maris'];
  const BOT_CLASSES = ['Paladin', 'Warden', 'Fighter', 'Rogue', 'Ranger', 'Assassin', 'Wizard', 'Shaman', 'Summoner', 'Necromancer', 'Cleric', 'Druid', 'Bard', 'Enchanter'];
  const BOT_SQUAD_GOALS = ['questing', 'camp-supply-run', 'road-patrol', 'dungeon-prep'];
  const BOT_QUEST_PLANS = Object.freeze([
    { id: 'quest_darkwood_first_steps', name: 'First Steps Into Dark Woods', minLevel: 1, maxLevel: 4, task: 'kill', target: 'any_dark_woods_mob', required: 3, xp: 80, gear: 1, preferredGoals: ['questing', 'road-patrol'] },
    { id: 'quest_briar_road_cull', name: 'Briars on the Road', minLevel: 2, maxLevel: 6, task: 'kill', target: 'briar boar', required: 3, xp: 150, gear: 2, preferredGoals: ['road-patrol', 'questing'] },
    { id: 'quest_gather_gloomleaf', name: 'Gloomleaf for the Fire', minLevel: 1, maxLevel: 5, task: 'gather', target: 'herb_gloomleaf', required: 5, xp: 60, gear: 1, preferredGoals: ['camp-supply-run', 'questing'] },
    { id: 'quest_wisps_at_dusk', name: 'Wisps at Dusk', minLevel: 4, maxLevel: 8, task: 'kill', target: 'duskwisp', required: 4, xp: 220, gear: 3, preferredGoals: ['questing', 'dungeon-prep'] },
    { id: 'quest_ashroot_signs', name: 'Ashroot Signs', minLevel: 7, maxLevel: 12, task: 'kill', target: 'ashroot horror', required: 1, xp: 320, gear: 4, preferredGoals: ['dungeon-prep', 'questing'] }
  ]);
  const BOT_DUNGEON_PLANS = Object.freeze([
    { id: 'dungeon_silk_web_depths', name: 'Silk Web Depths', minLevel: 4, maxLevel: 9, recommendedPartySize: 2, prepSeconds: 10, runSeconds: 26, xp: 210, gear: 4, entranceOffset: { x: -17, y: 26 } },
    { id: 'dungeon_glooms_crypt', name: "Gloom's Crypt", minLevel: 9, maxLevel: 12, recommendedPartySize: 3, prepSeconds: 15, runSeconds: 36, xp: 390, gear: 7, entranceOffset: { x: 35, y: 34 } }
  ]);
  const BOT_RUNTIME_DEFAULTS = Object.freeze({
    maxAdvancedBotsPerFrame: 3,
    maxActorAiTicksPerFrame: 12,
    nearDistance: 18,
    midDistance: 34,
    schedulerStatsWindow: 2.0,
    squadRefreshSeconds: 1.2,
    ensureSeconds: 0.75
  });

  // V0.14.45 owner constants: bot party formation and bot-to-player party invitations.
  // The existing bot "squad" hooks are retained as compatibility aliases, but party
  // cooperation is now restricted to explicit player parties or autonomous bot parties.
  const BOT_AUTONOMOUS_PARTY_MAX_SIZE = Math.max(2, Math.min(3, Math.floor(Number(DR.MAX_PARTY_SIZE) || 6)));
  const BOT_AUTONOMOUS_ROUTE_OFFSETS = Object.freeze([
    { x: 24, y: -13, goal: 'road-patrol' },
    { x: -20, y: 19, goal: 'questing' },
    { x: 32, y: 27, goal: 'dungeon-prep' },
    { x: -17, y: 28, goal: 'camp-supply-run' },
    { x: 37, y: 8, goal: 'road-patrol' },
    { x: 12, y: 35, goal: 'questing' }
  ]);
  const BOT_PARTY_INVITE_RADIUS = 13.5;
  const BOT_PARTY_PLAYER_INVITE_RADIUS = 5.5;
  const BOT_PARTY_PLAYER_INVITE_COOLDOWN = 42;

  const BOT_CLASS_AI_BALANCE = Object.freeze({
    castInterruptMoveThreshold: 0.18,
    fullCastThreshold: 0.46,
    minGlobalCooldown: 0.85,
    defaultCastSeconds: 0.78,
    manaReserve: {
      healer: 0.20,
      hybrid_healer_damage: 0.17,
      support_control: 0.18,
      control_support: 0.16,
      pet_caster: 0.13,
      pet_dot_caster: 0.13,
      meleeDps: 0.08,
      tank: 0.0,
      basic_assist: 0.10
    }
  });

  const BOT_GEAR_SLOT_ORDER = Object.freeze(['head', 'shoulders', 'chest', 'legs', 'hands', 'feet', 'cape', 'amulet', 'earring1', 'earring2', 'ring1', 'ring2', 'weapon', 'offhand', 'charm']);
  const BOT_GEAR_WEIGHTS = Object.freeze({
    tank: { armor: 1.45, defense: 1.35, hp: 0.24, stamina: 1.05, strength: 0.52, attack: 0.42, physicalPower: 0.32 },
    healer: { healingPower: 1.45, wisdom: 1.25, mana: 0.22, intelligence: 0.62, spellPower: 0.55, defense: 0.34, hp: 0.12 },
    support: { healingPower: 0.85, wisdom: 0.92, mana: 0.18, intelligence: 0.72, spellPower: 0.70, cdr: 1.0, cooldownReduction: 1.0, speed: 4.0 },
    casterDps: { spellPower: 1.32, magicPower: 1.24, intelligence: 1.18, mana: 0.16, magicCrit: 0.9, magicCritChance: 0.9, attack: 0.34 },
    physicalRangedDps: { attack: 1.24, physicalPower: 1.16, dexterity: 1.18, crit: 0.90, critChance: 0.90, speed: 4.2, defense: 0.18 },
    meleeDps: { attack: 1.28, physicalPower: 1.22, dexterity: 1.05, strength: 0.92, crit: 0.92, critChance: 0.92, speed: 4.0, defense: 0.22 }
  });

  const BOT_PERSONALITY_TYPES = Object.freeze({
    steady: Object.freeze({ speechBias: 'calm', riskTolerance: 0.45, chatterFrequency: 0.75, protectiveness: 0.70, recoveryBias: 1.00, rareInterest: 0.75, lootInterest: 0.65 }),
    bold: Object.freeze({ speechBias: 'confident', riskTolerance: 0.70, chatterFrequency: 0.85, protectiveness: 0.55, recoveryBias: 0.88, rareInterest: 1.00, lootInterest: 0.80 }),
    cautious: Object.freeze({ speechBias: 'careful', riskTolerance: 0.30, chatterFrequency: 0.65, protectiveness: 0.80, recoveryBias: 1.14, rareInterest: 0.85, lootInterest: 0.55 }),
    grim: Object.freeze({ speechBias: 'dark', riskTolerance: 0.50, chatterFrequency: 0.55, protectiveness: 0.50, recoveryBias: 0.98, rareInterest: 0.90, lootInterest: 0.50 }),
    witty: Object.freeze({ speechBias: 'light', riskTolerance: 0.55, chatterFrequency: 1.00, protectiveness: 0.45, recoveryBias: 0.96, rareInterest: 0.90, lootInterest: 1.00 })
  });
  const BOT_PERSONALITY_KEYS = Object.freeze(Object.keys(BOT_PERSONALITY_TYPES));
  DR.BOT_PERSONALITY_TYPES = BOT_PERSONALITY_TYPES;

  const BOT_SPEECH_COOLDOWNS = Object.freeze({
    generic: 9000, talk: 800, joinParty: 1000, inviteReject: 7000, partyFull: 7000, partyGrowing: 24000,
    combatStart: 12000, enemyKilled: 16000, lowHealth: 15000, lowMana: 18000,
    healAlly: 10000, emergencyHeal: 7000, purifyAlly: 9000, resurrectAlly: 14000, buffAlly: 14000, protectAlly: 12000,
    controlEnemy: 13000, manyAlliesHurt: 15000, addWarning: 18000,
    rareEnemySeen: 30000, namedEnemySeen: 35000, bossLikeEnemySeen: 45000, corruptedEnemy: 30000,
    petSummoned: 16000, petLowHealth: 15000, petDied: 18000,
    lootFound: 25000, chestOpened: 22000, startRecovery: 18000, stopRecoveryToFollow: 14000,
    enterCave: 25000, enterDungeon: 30000, playerDeath: 10000, botDeath: 10000
  });

  const BOT_SPEECH_PRIORITIES = Object.freeze({
    generic: 0, lootFound: 0, chestOpened: 1, buffAlly: 1, combatStart: 1, enemyKilled: 1,
    healAlly: 2, purifyAlly: 3, resurrectAlly: 4, controlEnemy: 2, startRecovery: 2, stopRecoveryToFollow: 2, lowMana: 2,
    rareEnemySeen: 2, namedEnemySeen: 2, petSummoned: 2, petLowHealth: 2, corruptedEnemy: 2,
    protectAlly: 3, emergencyHeal: 3, manyAlliesHurt: 3, addWarning: 3, lowHealth: 3,
    joinParty: 3, inviteReject: 3, partyFull: 3, partyGrowing: 2, bossLikeEnemySeen: 3,
    petDied: 3, enterCave: 3, enterDungeon: 3, playerDeath: 4, botDeath: 4, talk: 4
  });

  const BOT_BASE_SPEECH_LINES = Object.freeze({
    Fighter: {
      join: ['I’ll hold the front.'], partyFull: ['Looks like your line is already full.'], inviteReject: ['Not while I’m tied up here.'],
      combatStart: ['Behind me.'], kill: ['Threat down.'], lowHealth: ['I’m still standing.'], lowMana: ['No tricks left—just steel.'],
      healAlly: ['Stay on your feet.'], buffAlly: ['Hold the formation.'], protectAlly: ['Back on me!'], rareEnemy: ['That one is mine to hold.'],
      lootFound: ['Useful gear. Check it later.'], startMeditation: ['Catching my breath.'], stopMeditation: ['Moving. Stay close.'],
      zoneEntry: ['Eyes forward. Tight formation.'], playerDeath: ['I’ll hold until you return.'], botDeath: ['Front line is down.'], generic: ['Watching the approach.']
    },
    Cleric: {
      join: ['I’ll keep everyone breathing.'], partyFull: ['You already have a full congregation.'], inviteReject: ['I cannot leave my current duty.'],
      combatStart: ['Do not outrun my heals.'], kill: ['The danger has passed.'], lowHealth: ['I need protection.'], lowMana: ['My mana is running thin.'],
      healAlly: ['Light mend your wounds.'], buffAlly: ['A blessing for the road.'], protectAlly: ['Stay near me!'], rareEnemy: ['That foe will test our healing.'],
      lootFound: ['This may aid the wounded.'], startMeditation: ['I must restore my focus.'], stopMeditation: ['Rest can wait.'],
      zoneEntry: ['Stay within healing reach.'], playerDeath: ['Hold on—I will not abandon you.'], botDeath: ['An ally has fallen!'], generic: ['I am watching everyone’s health.']
    },
    Druid: {
      join: ['The wilds will walk with us.'], partyFull: ['This grove has no room for another root.'], inviteReject: ['The woods pull me elsewhere.'],
      combatStart: ['Roots below, claws ahead.'], kill: ['The earth reclaims it.'], lowHealth: ['My bark is splitting.'], lowMana: ['The grove grows quiet.'],
      healAlly: ['Life returns—breathe.'], buffAlly: ['Take the strength of old roots.'], protectAlly: ['Thorns around you!'], rareEnemy: ['The forest fears that one.'],
      lootFound: ['The wild leaves gifts.'], startMeditation: ['Listening to the roots.'], stopMeditation: ['The trail calls again.'],
      zoneEntry: ['The air changes here.'], playerDeath: ['Return with the turning season.'], botDeath: ['One voice leaves the grove.'], generic: ['The leaves are warning us.']
    },
    Bard: {
      join: ['A party needs rhythm.'], partyFull: ['Every part in this chorus is taken.'], inviteReject: ['I’ve promised this verse elsewhere.'],
      combatStart: ['Let’s make this one quick.'], kill: ['And that is the final note.'], lowHealth: ['This song needs a softer ending.'], lowMana: ['The song is fading.'],
      healAlly: ['A gentler verse for you.'], buffAlly: ['Keep pace with the song.'], protectAlly: ['Stay inside the chorus!'], rareEnemy: ['Now that is a tale worth singing.'],
      lootFound: ['A prize for the next verse.'], startMeditation: ['A brief rest between songs.'], stopMeditation: ['Back to tempo.'],
      zoneEntry: ['New room, new acoustics.'], playerDeath: ['The song is not over yet.'], botDeath: ['We lost a voice.'], generic: ['Keeping the party in time.']
    },
    Summoner: {
      join: ['My familiar and I are ready.'], partyFull: ['Too many bonds already crowd this circle.'], inviteReject: ['My pact requires me elsewhere.'],
      combatStart: ['Familiar, take the flank.'], kill: ['The binding held.'], lowHealth: ['I need space to recast.'], lowMana: ['The link is weakening.'],
      healAlly: ['A little borrowed vitality.'], buffAlly: ['The shard empowers you.'], protectAlly: ['Familiar, cover them!'], rareEnemy: ['That essence is unusually strong.'],
      lootFound: ['My familiar found something.'], startMeditation: ['Rebinding the channel.'], stopMeditation: ['The bond can move.'],
      zoneEntry: ['My familiar senses movement.'], playerDeath: ['I’ll guard your returning spark.'], botDeath: ['The summoning circle is broken.'], generic: ['The familiar is alert.']
    },
    Necromancer: {
      join: ['The dead make reliable allies.'], partyFull: ['Even the grave has occupancy limits.'], inviteReject: ['Another obligation has my bones.'],
      combatStart: ['Let them join the quiet.'], kill: ['Death remembers another name.'], lowHealth: ['Mortality is becoming inconvenient.'], lowMana: ['The grave answers faintly.'],
      healAlly: ['Borrow this life while it lasts.'], buffAlly: ['A grave ward surrounds you.'], protectAlly: ['Bones, shield them.'], rareEnemy: ['That soul burns strangely bright.'],
      lootFound: ['The corpse carried something useful.'], startMeditation: ['Listening beyond the veil.'], stopMeditation: ['The dead can wait.'],
      zoneEntry: ['There are old deaths here.'], playerDeath: ['Death is a door, not an ending.'], botDeath: ['Another servant for silence.'], generic: ['Something dead is listening.']
    },
    Rogue: {
      join: ['I’ll take the flank.'], partyFull: ['Crowded groups make noisy targets.'], inviteReject: ['Bad timing. I’m on another trail.'],
      combatStart: ['Keep it looking forward.'], kill: ['Never saw it coming.'], lowHealth: ['I need an exit.'], lowMana: ['Out of tricks for a moment.'],
      healAlly: ['Don’t bleed on the good gear.'], buffAlly: ['Use the opening.'], protectAlly: ['Move—I’ll draw it off.'], rareEnemy: ['Big target. Bigger blind spot.'],
      lootFound: ['Found something worth carrying.'], startMeditation: ['Watching from the shadows.'], stopMeditation: ['Quiet feet. We’re moving.'],
      zoneEntry: ['Check the corners.'], playerDeath: ['I’ll keep the route clear.'], botDeath: ['We just lost our angle.'], generic: ['I’m checking our flanks.']
    },
    Enchanter: {
      join: ['I’ll keep the dangerous ones controlled.'], partyFull: ['Your formation is already complete.'], inviteReject: ['My concentration is committed elsewhere.'],
      combatStart: ['Mark the adds—I’ll bind them.'], kill: ['Control resolved.'], lowHealth: ['My wards are failing.'], lowMana: ['My focus is nearly spent.'],
      healAlly: ['A stabilizing charm.'], buffAlly: ['Your edge is sharpened.'], protectAlly: ['I have them contained.'], rareEnemy: ['That aura is dangerously unstable.'],
      lootFound: ['This carries a useful resonance.'], startMeditation: ['Reordering the patterns.'], stopMeditation: ['The weave can travel.'],
      zoneEntry: ['There are active wards nearby.'], playerDeath: ['I will preserve the formation.'], botDeath: ['Our control line has broken.'], generic: ['Watching for uncontrolled threats.']
    }
  });
  const BOT_CLASS_EVENT_LINES = Object.freeze({
    Fighter: {
      protectAlly: ['Back on me!', 'Get off them!', 'Stay behind me.'], rareEnemySeen: ['That one hits harder. Stay sharp.', 'Big one. I’ll take the front.'],
      emergencyHeal: ['Good save. I’m holding.'], manyAlliesHurt: ['Stack behind me. Buy the healer time.'], bossLikeEnemySeen: ['Boss ahead. I own the front.'], lowHealth: ['I’m bleeding, but still up.', 'Need a heal soon.']
    },
    Cleric: {
      emergencyHeal: ['Hold still, I’m healing you.', 'Light preserve you.', 'You’re not falling here.'], manyAlliesHurt: ['Too many wounds at once.', 'Group up if you want my heals.'],
      lowMana: ['My mana is almost gone.', 'I need a moment to recover mana.'], protectAlly: ['Stay within the light.'],
      purifyAlly: ['Poison cleansed.', 'Hold still. Clearing the toxin.', 'That venom is gone.'],
      resurrectAlly: ['Get up. Your work is not done.', 'Light calls you back.', 'Stand again.']
    },
    Druid: {
      healAlly: ['Nature closes the wound.', 'Breathe. The roots still hold.'], controlEnemy: ['Roots have it.', 'Pinned it down.'],
      corruptedEnemy: ['This place is sick.', 'The woods are twisting around us.'], enterCave: ['Stone above, roots below.'], enterDungeon: ['Old growth fears this place.'],
      resurrectAlly: ['Rise with the roots.', 'Nature is not finished with you.', 'Breathe again.']
    },
    Bard: {
      buffAlly: ['Keep pace with the verse.', 'This song has teeth.'], combatStart: ['On rhythm. Strike together.', 'Let’s make this clean.'],
      lowMana: ['The song is thinning.', 'I need breath and mana.'], enemyKilled: ['Clean finish. Keep the tempo.'], lootFound: ['A bright note in a dark verse.']
    },
    Summoner: {
      petSummoned: ['Come forth. Guard us.', 'I have called something useful.'], petLowHealth: ['My summon is breaking.', 'Hold together, little one.'],
      petDied: ['The bond is gone. I’ll call it again.'], combatStart: ['My summon goes first.', 'Let the bound one take the teeth.']
    },
    Necromancer: {
      controlEnemy: ['The curse is taking hold.', 'Let it rot from the inside.'], emergencyHeal: ['Your life will patch mine.', 'A little borrowed blood.'],
      lowHealth: ['Death is close. Not close enough.', 'I need space.'], petSummoned: ['Rise. We have work.'], petDied: ['Back to the grave—for now.']
    },
    Rogue: {
      controlEnemy: ['Going around.', 'I’ve got its back.'], rareEnemySeen: ['That one looks expensive.', 'Careful. Big target.'],
      lootFound: ['Finally, something worth lifting.', 'I saw that shine.'], bossLikeEnemySeen: ['Big mark. I need a clean angle.']
    },
    Enchanter: {
      controlEnemy: ['That one is handled.', 'Do not break my hold.'], addWarning: ['More incoming.', 'We have another problem.'],
      buffAlly: ['Mind sharpened.', 'Focus. I have strengthened you.'], manyAlliesHurt: ['The formation is destabilizing.']
    }
  });

  const speechDefaults = (base = {}) => ({
    ...base,
    joinParty: base.join,
    enemyKilled: base.kill,
    rareEnemySeen: base.rareEnemy,
    namedEnemySeen: base.rareEnemy,
    bossLikeEnemySeen: base.rareEnemy,
    emergencyHeal: base.healAlly,
    controlEnemy: base.protectAlly,
    manyAlliesHurt: base.lowHealth,
    addWarning: base.rareEnemy,
    petSummoned: base.buffAlly,
    petLowHealth: base.lowHealth,
    petDied: base.botDeath,
    chestOpened: base.lootFound,
    startRecovery: base.startMeditation,
    stopRecoveryToFollow: base.stopMeditation,
    enterCave: base.zoneEntry,
    enterDungeon: base.zoneEntry,
    corruptedEnemy: base.rareEnemy
  });
  const BOT_SPEECH_LINES = Object.freeze(Object.fromEntries(Object.entries(BOT_BASE_SPEECH_LINES).map(([className, base]) => [
    className,
    Object.freeze({ ...speechDefaults(base), ...(BOT_CLASS_EVENT_LINES[className] || {}) })
  ])));
  DR.BOT_SPEECH_LINES = BOT_SPEECH_LINES;
  DR.BOT_SPEECH_COOLDOWNS = BOT_SPEECH_COOLDOWNS;

  const BOT_START_PROFILES = [
    { id: 'bot-guardian-bram', name: 'Bram', className: 'Paladin', role: 'tank', personalityId: 'steady', questName: 'Hold the Old Road', behaviorGoal: 'road-patrol', offset: { x: 2.8, y: 1.8 } },
    { id: 'bot-cleric-talia', name: 'Talia', className: 'Cleric', role: 'healer', personalityId: 'cautious', questName: 'Aid the Wounded', behaviorGoal: 'questing', offset: { x: -2.2, y: 2.4 } },
    { id: 'bot-rogue-riven', name: 'Riven', className: 'Rogue', role: 'meleeDps', personalityId: 'witty', questName: 'Scout the Woodline', behaviorGoal: 'road-patrol', offset: { x: 3.4, y: -1.6 } },
    { id: 'bot-adept-luma', name: 'Luma', className: 'Enchanter', role: 'control_support', personalityId: 'steady', questName: 'Study Gloom Residue', behaviorGoal: 'questing', offset: { x: -3.5, y: -1.2 } },
    { id: 'bot-druid-elowen', name: 'Elowen', className: 'Druid', role: 'hybrid_healer_damage', personalityId: 'cautious', questName: 'Tend the Gloomleaf', behaviorGoal: 'questing', offset: { x: 0.2, y: 3.7 } },
    { id: 'bot-summoner-orin', name: 'Orin', className: 'Summoner', role: 'pet_caster', personalityId: 'bold', questName: 'Bind a Shard Familiar', behaviorGoal: 'questing', offset: { x: -4.1, y: 1.0 } },
    { id: 'bot-bard-fenn', name: 'Fenn', className: 'Bard', role: 'support_control', personalityId: 'witty', questName: 'Keep the Road Rhythm', behaviorGoal: 'road-patrol', offset: { x: 4.0, y: 0.0 } },
    { id: 'bot-necro-varek', name: 'Varek', className: 'Necromancer', role: 'pet_dot_caster', personalityId: 'grim', questName: 'Bone Signs in the Dark', behaviorGoal: 'dungeon-prep', offset: { x: -1.0, y: -3.7 } }
  ];

  const BOT_CLASS_AI_PROFILES = Object.freeze({
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
    },
    cleric: {
      className: 'Cleric', role: 'healer', preferredRange: 5.4,
      healThreshold: 0.88, emergencyThreshold: 0.38, allyHealThreshold: 0.88,
      spellPriority: ['revive', 'emergencyHeal', 'cure', 'heal', 'groupBuff', 'debuff', 'bolt'],
      fallbackDamageScale: 0.52,
      activity: 'Healing'
    },
    druid: {
      className: 'Druid', role: 'hybrid_healer_damage', preferredRange: 5.3,
      healThreshold: 0.70, emergencyThreshold: 0.32, allyHealThreshold: 0.72,
      spellPriority: ['revive', 'emergencyHeal', 'root', 'heal', 'aoeHeal', 'boltDot', 'debuff', 'bolt', 'buff'],
      fallbackDamageScale: 0.70,
      activity: 'Nature Casting'
    },
    ranger: {
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
    },
    bard: {
      className: 'Bard', role: 'support_control', preferredRange: 1.5,
      healThreshold: 0.58, emergencyThreshold: 0.30, allyHealThreshold: 0.62,
      spellPriority: ['emergencySong', 'heal', 'groupBuff', 'buff', 'aoeDebuff', 'debuff', 'bolt', 'aoe'],
      fallbackDamageScale: 0.66,
      activity: 'Singing'
    },
    necromancer: {
      className: 'Necromancer', role: 'pet_dot_caster', preferredRange: 5.6,
      healThreshold: 0.0, allyHealThreshold: 0.0,
      spellPriority: ['summonPet', 'petHeal', 'petBuff', 'drainLowSelf', 'boltDot', 'debuff', 'aoeDebuff', 'drain', 'bolt', 'buff'],
      fallbackDamageScale: 0.78,
      activity: 'Dark Casting'
    },
    rogue: {
      className: 'Rogue', role: 'meleeDps', preferredRange: 1.32,
      healThreshold: 0.0, allyHealThreshold: 0.0,
      spellPriority: ['flank', 'meleeDebuff', 'dashStrike', 'aoeMelee', 'melee', 'buff'],
      fallbackDamageScale: 1.05,
      activity: 'Flanking'
    },
    enchanter: {
      className: 'Enchanter', role: 'control_support', preferredRange: 5.6,
      healThreshold: 0.0, allyHealThreshold: 0.0,
      spellPriority: ['crowdControl', 'debuff', 'aoeDebuff', 'mana', 'buff', 'bolt', 'aoe'],
      fallbackDamageScale: 0.64,
      activity: 'Controlling'
    },
    default: {
      className: 'Fighter', role: 'basic_assist', preferredRange: 1.45,
      healThreshold: 0.0, allyHealThreshold: 0.0,
      spellPriority: ['melee', 'bolt', 'debuff', 'buff'],
      fallbackDamageScale: 0.75,
      activity: 'Assisting'
    }
  });
  DR.BOT_CLASS_AI_PROFILES = BOT_CLASS_AI_PROFILES;

  const BOT_TEMPLATE_DEFS = Object.freeze({
    paladin: { id: 'classbot-paladin', name: 'Paladin Bot', className: 'Paladin', role: 'tank', behaviorGoal: 'road-patrol' },
    warden: { id: 'classbot-warden', name: 'Warden Bot', className: 'Warden', role: 'tank', behaviorGoal: 'road-patrol' },
    fighter: { id: 'classbot-fighter', name: 'Fighter Bot', className: 'Fighter', role: 'meleeDps', behaviorGoal: 'road-patrol' },
    ranger: { id: 'classbot-ranger', name: 'Ranger Bot', className: 'Ranger', role: 'physicalRangedDps', behaviorGoal: 'road-patrol' },
    assassin: { id: 'classbot-assassin', name: 'Assassin Bot', className: 'Assassin', role: 'physicalRangedDps', behaviorGoal: 'road-patrol' },
    wizard: { id: 'classbot-wizard', name: 'Wizard Bot', className: 'Wizard', role: 'casterDps', behaviorGoal: 'questing' },
    shaman: { id: 'classbot-shaman', name: 'Shaman Bot', className: 'Shaman', role: 'casterDps', behaviorGoal: 'questing' },
    cleric: { id: 'classbot-cleric', name: 'Cleric Bot', className: 'Cleric', role: 'healer', behaviorGoal: 'questing' },
    druid: { id: 'classbot-druid', name: 'Druid Bot', className: 'Druid', role: 'hybrid_healer_damage', behaviorGoal: 'questing' },
    summoner: { id: 'classbot-summoner', name: 'Summoner Bot', className: 'Summoner', role: 'pet_caster', behaviorGoal: 'questing' },
    bard: { id: 'classbot-bard', name: 'Bard Bot', className: 'Bard', role: 'support_control', behaviorGoal: 'questing' },
    necromancer: { id: 'classbot-necromancer', name: 'Necromancer Bot', className: 'Necromancer', role: 'pet_dot_caster', behaviorGoal: 'dungeon-prep' },
    rogue: { id: 'classbot-rogue', name: 'Rogue Bot', className: 'Rogue', role: 'meleeDps', behaviorGoal: 'road-patrol' },
    enchanter: { id: 'classbot-enchanter', name: 'Enchanter Bot', className: 'Enchanter', role: 'control_support', behaviorGoal: 'questing' }
  });


  const BOT_PARTY_MAX_SIZE = Math.max(2, Math.floor(Number(DR.MAX_PARTY_SIZE) || 6));
  const BOT_PARTY_MAX_BOTS = BOT_PARTY_MAX_SIZE - 1;
  const BOT_CLASS_ROLE_INFO = Object.freeze({
    paladin: { icon: '✚', label: 'Tank', desc: 'Holy shield tank that holds threat with divine mitigation, taunts, and protection tools.' },
    warden: { icon: '◆', label: 'Tank', desc: 'Nature and stone tank that uses bark armor, roots, thorns, and regeneration.' },
    fighter: { icon: '⚔', label: 'Melee DPS', desc: 'Heavy-weapon leather bruiser that deals 2H damage with cleaves, staggers, and momentum.' },
    cleric: { icon: '✚', label: 'Healer', desc: 'Main healer that prioritizes emergency healing, cures, and holy support.' },
    druid: { icon: '♧', label: 'Hybrid Healer', desc: 'Nature caster that mixes healing, roots, DoTs, and utility buffs.' },
    summoner: { icon: '✹', label: 'Pet Caster', desc: 'Ranged caster that summons a pet and deals sustained magic damage.' },
    bard: { icon: '♫', label: 'Support', desc: 'Song-based support that maintains group buffs and light control.' },
    necromancer: { icon: '☠', label: 'Pet / DoT', desc: 'Dark caster that uses an undead pet, DoTs, drains, and shields.' },
    rogue: { icon: '🗡', label: 'Melee DPS', desc: 'Burst melee fighter that favors flank attacks, bleeds, and poison pressure.' },
    ranger: { icon: '➶', label: 'Physical Ranged DPS', desc: 'Bow, trap, and tracking damage dealer that controls distance and terrain.' },
    assassin: { icon: '⌁', label: 'Physical Ranged DPS', desc: 'Trap, throwing weapon, poison dart, and crossbow execution specialist.' },
    wizard: { icon: '✧', label: 'Magic Ranged DPS', desc: 'Arcane, fire, and frost caster focused on ranged spell burst and area damage.' },
    shaman: { icon: '◈', label: 'Magic Ranged DPS', desc: 'Storm, earth, and spirit damage caster focused on primal ranged pressure.' },
    enchanter: { icon: '✦', label: 'Control', desc: 'Ranged controller that slows, charms, buffs, and supports caster resources.' },
    default: { icon: '●', label: 'Assist', desc: 'Basic companion behavior using the closest matching class profile.' }
  });

  function botClassRoleInfo(className) {
    const key = classKey(className);
    return BOT_CLASS_ROLE_INFO[key] || BOT_CLASS_ROLE_INFO.default;
  }

  function classKey(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function stableStringIndex(value, size) {
    let hash = 2166136261;
    for (const char of String(value || 'bot')) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0) % Math.max(1, size);
  }

  // V0.17.74 Talents: bots pick a talent SPEC (label only - rail 5 forbids real
  // bot talent mechanics) once they reach level 5, so the simulated population
  // has visible builds. Deterministic per bot id, varied across the roster.
  function botTalentSpecFor(bot) {
    if (!bot || Math.floor(Number(bot.level) || 1) < 5) return null;
    const cls = properClassName(bot.className);
    const specs = DR.TALENT_TREES?.[cls]?.specs;
    if (!Array.isArray(specs) || !specs.length) return null;
    const id = bot.botId || bot.remoteId || bot.id || `${bot.name || 'bot'}:${cls}`;
    return specs[stableStringIndex(`${id}:talentspec`, specs.length)] || null;
  }

  function normalizedPersonalityId(value, bot = null) {
    const requested = classKey(value);
    if (BOT_PERSONALITY_TYPES[requested]) return requested;
    const identity = bot?.botId || bot?.remoteId || bot?.id || `${bot?.name || 'bot'}:${bot?.className || 'fighter'}`;
    return BOT_PERSONALITY_KEYS[stableStringIndex(identity, BOT_PERSONALITY_KEYS.length)] || 'steady';
  }

  function properClassName(value) {
    const key = classKey(value);
    const classNames = Object.keys(DR.CLASSES || {});
    return classNames.find(name => classKey(name) === key) || BOT_CLASS_AI_PROFILES[key]?.className || value || 'Fighter';
  }

  function botTypeLabelForClass(className) {
    return `${properClassName(className || 'Fighter')} Bot`;
  }

  function isPlaceholderBotName(name, className) {
    const text = String(name || '').trim();
    if (!text) return true;
    const label = botTypeLabelForClass(className).toLowerCase();
    return text.toLowerCase() === label || /^bot$/i.test(text) || /^[a-z][a-z\s/.-]*\s+bot$/i.test(text);
  }

  function pickBotDisplayName(seed = {}, className = 'Fighter', index = 0, usedNames = null) {
    const id = seed.botId || seed.remoteId || seed.id || `${className}:${index}`;
    const start = stableStringIndex(`${id}:${className}`, BOT_NAME_POOL.length);
    const used = usedNames instanceof Set ? usedNames : new Set();
    for (let offset = 0; offset < BOT_NAME_POOL.length; offset++) {
      const name = BOT_NAME_POOL[(start + offset) % BOT_NAME_POOL.length];
      if (!used.has(String(name).toLowerCase())) return name;
    }
    return BOT_NAME_POOL[start] || 'Riven';
  }

  function hasStatus(entity, statusNameOrId) {
    const key = classKey(statusNameOrId);
    if (!key || !Array.isArray(entity?.buffs)) return false;
    return entity.buffs.some(effect => Number(effect?.remaining ?? effect?.duration ?? 0) > 0 && (classKey(effect.id) === key || classKey(effect.name) === key));
  }

  function hpRatio(actor) {
    return actor && Number(actor.maxHp || 0) > 0 ? Number(actor.hp || 0) / Math.max(1, Number(actor.maxHp || 1)) : 1;
  }

  function mpRatio(actor) {
    return actor && Number(actor.maxMana || 0) > 0 ? Number(actor.mana || 0) / Math.max(1, Number(actor.maxMana || 1)) : 1;
  }

  function spellKey(spell, index = 0) {
    return String(spell?.id || spell?.spellId || spell?.name || `slot-${index}`);
  }

  function isHealKind(kind) { return kind === 'heal' || kind === 'aoeHeal'; }
  function isBuffKind(kind) { return kind === 'buff' || kind === 'groupBuff' || kind === 'petBuff'; }
  function isPetKind(kind) { return kind === 'summonPet' || kind === 'boltSummon' || kind === 'petHeal' || kind === 'petBuff'; }
  function isOffensiveKind(kind) {
    return ['melee','meleeDebuff','dashStrike','drain','debuff','boltDot','boltSummon','bolt','aoe','aoeMelee','aoeDebuff'].includes(String(kind || ''));
  }


  function isBotHostileCombatActor(game, actor) {
    if (!alive(actor) || actor.ambient || actor.nonCombat) return false;
    const kind = String(actor.kind || '').toLowerCase();
    if (['player', 'remote', 'merc', 'pet', 'bot'].includes(kind)) return false;
    if (kind === 'enemy') return true;
    if (actor.hostile === true || String(actor.faction || '').toLowerCase() === 'hostile') return true;
    if (Array.isArray(game?.enemies) && game.enemies.includes(actor)) return true;
    if (typeof game?.isHostileToPlayer === 'function') {
      try { return game.isHostileToPlayer(actor) === true; } catch (_) {}
    }
    return false;
  }

  function resolveSpellBaseCastSeconds(spell) {
    const explicit = Number(spell?.castTime ?? spell?.castSeconds ?? spell?.windup);
    if (Number.isFinite(explicit) && explicit >= 0) return explicit;
    const kind = String(spell?.kind || '');
    if (['melee', 'meleeDebuff', 'dashStrike', 'aoeMelee'].includes(kind)) return 0.0;
    if (kind === 'buff' || kind === 'petBuff') return 0.45;
    if (kind === 'groupBuff') return 0.62;
    if (kind === 'mana') return 0.70;
    if (kind === 'summonPet' || kind === 'boltSummon') return 1.05;
    if (kind === 'petHeal' || kind === 'heal' || kind === 'aoeHeal') return 0.82;
    if (kind === 'aoe' || kind === 'aoeDebuff') return 0.95;
    if (kind === 'debuff' || kind === 'boltDot' || kind === 'drain') return 0.80;
    if (kind === 'bolt') return 0.72;
    return BOT_CLASS_AI_BALANCE.defaultCastSeconds;
  }

  function pendingActorStillValid(actor) {
    return Boolean(actor && actor.alive !== false && Number.isFinite(Number(actor.x)) && Number.isFinite(Number(actor.y)));
  }


  function safeLevel(actor) {
    return Math.max(1, Math.floor(Number(actor?.level) || 1));
  }

  function alive(actor) {
    return Boolean(actor && actor.alive !== false && Number.isFinite(Number(actor.x)) && Number.isFinite(Number(actor.y)));
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function clampNumber(value, min, max, fallback = min) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function lower(value) {
    return String(value || '').toLowerCase();
  }


  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[ch]);
  }

  function itemName(item) {
    return item?.name || item?.id || 'Unknown Item';
  }

  function questDraftName(id) {
    return DR.QUEST_BY_ID?.[id]?.name || BOT_QUEST_PLANS.find(plan => plan.id === id)?.name || id || 'Bot Quest';
  }

  DR.BotPlayerSystem = {
    install(Game) {
      Game.prototype.ensureBotPersonality = function(bot, requestedId = null) {
        if (!bot) return BOT_PERSONALITY_TYPES.steady;
        bot.personalityId = normalizedPersonalityId(requestedId || bot.personalityId, bot);
        bot.personalityProfile = BOT_PERSONALITY_TYPES[bot.personalityId] || BOT_PERSONALITY_TYPES.steady;
        return bot.personalityProfile;
      };

      Game.prototype.botPersonalityProfile = function(bot) {
        return this.ensureBotPersonality?.(bot) || BOT_PERSONALITY_TYPES.steady;
      };

      Game.prototype.ensureBotDisplayIdentity = function(bot, options = {}) {
        if (!bot) return bot;
        const className = properClassName(bot.className || options.className || 'Fighter');
        bot.className = className;
        bot.botTypeLabel = bot.botTypeLabel || bot.displayTypeLabel || botTypeLabelForClass(className);
        bot.displayTypeLabel = bot.botTypeLabel;
        if (isPlaceholderBotName(bot.name, className)) {
          const used = new Set((this.botPlayers || [])
            .filter(entry => entry && entry !== bot)
            .map(entry => String(entry.name || '').toLowerCase())
            .filter(Boolean));
          bot.name = pickBotDisplayName({ id: bot.botId || bot.remoteId || bot.id || options.id }, className, Number(options.index || 0), used);
          this.characterSaveDirty = true;
        }
        return bot;
      };

      Game.prototype.setBotCompanionCommand = function(botOrId, command, options = {}) {
        const bot = typeof botOrId === 'string'
          ? (this.botPlayers || []).find(entry => String(entry?.botId || entry?.remoteId || entry?.id || '') === String(botOrId))
          : botOrId;
        const value = String(command || '').toLowerCase();
        const allowed = new Set(['follow', 'guard', 'assist', 'passive', 'attack']);
        if (!bot || bot.kind !== 'bot' || !allowed.has(value)) return false;
        if (bot.alive === false) {
          this.logParty?.(`${bot.name || 'Bot'} is downed and cannot follow commands.`);
          this.playAudioEvent?.('ui_error', { volume: 0.18 });
          return false;
        }
        bot.botPartyCommand = value;
        bot.commandState = value;
        bot.command = this.isBotInParty?.(bot) ? 'party' : (bot.command || 'autonomous');
        const labels = { follow: 'Following Party', guard: 'Guarding Party', assist: 'Assisting Party', passive: 'Passive', attack: 'Attacking Target' };
        bot.currentActivityLabel = labels[value] || 'Following Party';
        if (value === 'passive' || value === 'follow') {
          bot.target = null;
          bot.attackTarget = null;
          bot.targetEnemy = null;
          bot.combatTarget = null;
          bot.objectiveEnemyId = null;
          bot.adventureTargetId = null;
          bot.botPendingCast = null;
          bot.attackAiTimer = 0;
          bot.attackTimer = 0;
        }
        this.cancelMeditation?.(bot, 'bot command changed', { silent: true });
        this.playAudioEvent?.('merc_command', { actor: bot, volume: 0.22, cooldown: 0.12 });
        this.logParty?.(`${bot.name || 'Bot'} command: ${value}.`);
        this.characterSaveDirty = true;
        this.partyPanelDirty = true;
        this.botHudDirty = true;
        this.renderPartyPanel?.();
        this.renderPartyHud?.({ force: true });
        this.updateUI?.();
        return true;
      };

      Game.prototype.normalizeBotState = function() {
        if (!Array.isArray(this.botPlayers)) this.botPlayers = [];
        if (!(this.botPartyMembers instanceof Set)) this.botPartyMembers = new Set(Array.isArray(this.botPartyMembers) ? this.botPartyMembers.map(String) : []);
        if (!(this.botSquads instanceof Map)) this.botSquads = new Map();
        // V0.14.45: botSquads remains a compatibility alias for autonomous bot parties.
        this.botPartyGroups = this.botSquads;
        if (!(this.botPartyInvites instanceof Map)) this.botPartyInvites = new Map();
        this.botPlayers = this.botPlayers.filter(bot => bot && bot.kind === 'bot');
        for (const bot of this.botPlayers) {
          bot.remoteId = bot.remoteId || bot.botId || bot.id;
          bot.botId = bot.botId || bot.remoteId || `bot-${Math.random().toString(36).slice(2, 8)}`;
          bot.zone = bot.zone || this.currentZone || 'overworld';
          this.ensureBotClassRuntime?.(bot);
          this.ensureBotDisplayIdentity?.(bot);
          bot.behaviorGoal = bot.behaviorGoal || bot.goal || 'questing';
          bot.currentQuestId = bot.currentQuestId || bot.questId || null;
          bot.questStage = bot.questStage || 'active';
          bot.questTaskProgress = bot.questTaskProgress && typeof bot.questTaskProgress === 'object' ? bot.questTaskProgress : {};
          bot.campSupply = clampNumber(bot.campSupply, 0, 100, 65);
          bot.campVisitCooldown = Math.max(0, Number(bot.campVisitCooldown || 0));
          bot.dungeonCooldown = Math.max(0, Number(bot.dungeonCooldown || 0));
          bot.dungeonRunTimer = Math.max(0, Number(bot.dungeonRunTimer || 0));
          bot.dungeonIntent = bot.dungeonIntent || null;
          bot.dungeonCompletions = Math.max(0, Math.floor(Number(bot.dungeonCompletions || 0)));
          bot.completedQuestIds = Array.isArray(bot.completedQuestIds) ? bot.completedQuestIds : [];
          bot.gold = Math.max(0, Math.floor(Number(bot.gold || 0)));
          bot.junkValue = Math.max(0, Math.floor(Number(bot.junkValue || 0)));
          bot.upgradeFragments = Math.max(0, Math.floor(Number(bot.upgradeFragments || 0)));
          bot.reputation = Math.max(0, Math.floor(Number(bot.reputation || 0)));
          bot.repairDebt = Math.max(0, Math.floor(Number(bot.repairDebt || 0)));
          bot.socialMood = bot.socialMood || 'focused';
          bot.currentActivityLabel = bot.currentActivityLabel || bot.botState || 'Questing';
          bot.lastSocialLine = bot.lastSocialLine || '';
          this.ensureBotPersonality?.(bot, bot.personalityId);
          bot.speechBubble = bot.speechBubble && typeof bot.speechBubble === 'object' ? bot.speechBubble : null;
          bot.speechCooldownUntil = Math.max(0, Number(bot.speechCooldownUntil || 0));
          bot.speechEventCooldowns = bot.speechEventCooldowns && typeof bot.speechEventCooldowns === 'object' ? bot.speechEventCooldowns : {};
          bot.speechSequence = Math.max(0, Math.floor(Number(bot.speechSequence || 0)));
          bot.socialCooldown = Math.max(0, Number(bot.socialCooldown || 0));
          bot.economyTimer = Math.max(0, Number(bot.economyTimer || 0));
          bot.botInventory = Array.isArray(bot.botInventory) ? bot.botInventory.filter(Boolean) : [];
          bot.botEquipment = bot.botEquipment && typeof bot.botEquipment === 'object' ? bot.botEquipment : {};
          bot.lootTradeCooldown = Math.max(0, Number(bot.lootTradeCooldown || 0));
          bot.tradeRequestCooldown = Math.max(0, Number(bot.tradeRequestCooldown || 0));
          bot.meditationIntent = bot.meditationIntent || '';
          bot.botPartyInviteCooldown = Math.max(0, Number(bot.botPartyInviteCooldown || 0));
          bot.botPartyPlayerInviteCooldown = Math.max(0, Number(bot.botPartyPlayerInviteCooldown || 0));
          bot.botPartyId = bot.botPartyId || bot.squadId || null;
          if (bot.botPartyId) bot.squadId = bot.botPartyId;
          const botWasDowned = bot.alive === false || bot.botState === 'downed';
          this.recalculateBotGearScore?.(bot);
          if (botWasDowned) {
            bot.alive = false;
            bot.hp = 0;
            bot.botState = bot.botState || 'downed';
            bot.currentActivityLabel = bot.currentActivityLabel || 'Downed';
          }
          bot.worldPresenceTimer = Math.max(0, Number(bot.worldPresenceTimer || 0));
          bot.actorAiAccumulator = Math.max(0, Number(bot.actorAiAccumulator || 0));
          bot.actorAiInterval = Math.max(0, Number(bot.actorAiInterval || 0));
          bot.advancedRoutineAccumulator = Math.max(0, Number(bot.advancedRoutineAccumulator || 0));
          bot.advancedRoutineInterval = Math.max(0, Number(bot.advancedRoutineInterval || 0));
          bot.stuckTimer = Math.max(0, Number(bot.stuckTimer || 0));
          bot.lastStableX = Number.isFinite(Number(bot.lastStableX)) ? Number(bot.lastStableX) : Number(bot.x || 0);
          bot.lastStableY = Number.isFinite(Number(bot.lastStableY)) ? Number(bot.lastStableY) : Number(bot.y || 0);
          const botPartyId = String(bot.botId || bot.remoteId || bot.id || '');
          if (botPartyId && this.botPartyMembers.has(botPartyId)) {
            bot.squadId = null;
            bot.botPartyId = null;
            bot.autonomousPartyId = null;
          }
        }
        if (this.partyMembers instanceof Set) {
          const botIds = new Set((this.botPlayers || [])
            .map(bot => String(bot?.botId || bot?.remoteId || bot?.id || ''))
            .filter(Boolean));
          for (const id of this.botPartyMembers || []) botIds.add(String(id));
          for (const id of Array.from(this.partyMembers)) {
            const normalizedId = String(id);
            if (botIds.has(normalizedId) || normalizedId.startsWith('bot-')) this.partyMembers.delete(id);
          }
          if (this.localPeerId) this.partyMembers.add(this.localPeerId);
        }
      };

      Game.prototype.ensureBotRuntimeScheduler = function() {
        const existing = this.botRuntimeScheduler && typeof this.botRuntimeScheduler === 'object' ? this.botRuntimeScheduler : {};
        this.botRuntimeScheduler = {
          ...BOT_RUNTIME_DEFAULTS,
          ...existing,
          ensureTimer: Math.max(0, Number(existing.ensureTimer || 0)),
          squadTimer: Math.max(0, Number(existing.squadTimer || 0)),
          cursor: Math.max(0, Math.floor(Number(existing.cursor || 0))),
          frameActorTicks: 0,
          frameAdvancedTicks: 0,
          actorTicks: Math.max(0, Math.floor(Number(existing.actorTicks || 0))),
          advancedTicks: Math.max(0, Math.floor(Number(existing.advancedTicks || 0))),
          skippedActorTicks: Math.max(0, Math.floor(Number(existing.skippedActorTicks || 0))),
          skippedAdvancedTicks: Math.max(0, Math.floor(Number(existing.skippedAdvancedTicks || 0))),
          statsTimer: Math.max(0, Number(existing.statsTimer || BOT_RUNTIME_DEFAULTS.schedulerStatsWindow)),
          lastStats: existing.lastStats || null
        };
        return this.botRuntimeScheduler;
      };

      Game.prototype.botDistanceToPlayer = function(bot) {
        if (!bot || !this.player) return Infinity;
        return dist(bot, this.player);
      };


      Game.prototype.botIdentityKey = function(botOrId) {
        if (!botOrId) return '';
        if (typeof botOrId === 'string') return String(botOrId);
        return String(botOrId.botId || botOrId.remoteId || botOrId.id || botOrId.name || '');
      };

      Game.prototype.botPlayableBounds = function() {
        const size = Math.max(1, Math.floor(Number(this.activeMapSize?.() || CONFIG.MAP_SIZE || 200)));
        return { minX: 0.5, minY: 0.5, maxX: size - 1.5, maxY: size - 1.5, size };
      };

      Game.prototype.botIsInsidePlayableBounds = function(bot, padding = 0) {
        if (!bot) return false;
        const x = Number(bot.x);
        const y = Number(bot.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
        const b = this.botPlayableBounds?.() || { minX: 0.5, minY: 0.5, maxX: CONFIG.MAP_SIZE - 1.5, maxY: CONFIG.MAP_SIZE - 1.5 };
        const pad = Math.max(0, Number(padding) || 0);
        return x >= b.minX - pad && y >= b.minY - pad && x <= b.maxX + pad && y <= b.maxY + pad;
      };

      Game.prototype.botSameZoneAsPlayer = function(bot) {
        if (!bot) return false;
        const current = String(this.currentZone || 'overworld');
        const zone = String(bot.zone || current);
        return zone === current;
      };

      Game.prototype.botHasValidWorldPresence = function(bot, options = {}) {
        if (!bot || bot.kind !== 'bot') return false;
        if (bot.alive === false || bot.hidden === true || bot.renderable === false || bot.botState === 'dismissed') return false;
        if (!Number.isFinite(Number(bot.x)) || !Number.isFinite(Number(bot.y))) return false;
        if (!this.botIsInsidePlayableBounds?.(bot, 0.25)) return false;
        if (options.sameZone === true && !this.botSameZoneAsPlayer?.(bot)) return false;
        if (options.requireWalkable !== false && this.botSameZoneAsPlayer?.(bot) && this.isWalkable && this.isWalkable(bot.x, bot.y, bot) !== true) return false;
        return true;
      };

      Game.prototype.findValidBotRecoveryPoint = function(bot = null, reason = 'recovery') {
        const candidates = [];
        const push = point => {
          if (!point) return;
          const x = Number(point.x);
          const y = Number(point.y);
          if (Number.isFinite(x) && Number.isFinite(y)) candidates.push({ x, y });
        };
        push(bot);
        push(this.player);
        push(this.defaultBotSpawnAnchor?.());
        push(this.botCampAnchor?.());
        push({ x: DR.CONFIG.START_X + 0.5, y: DR.CONFIG.START_Y + 0.5 });
        for (const point of candidates) {
          const nearest = this.findNearestCompanionWalkablePoint?.(point.x, point.y, bot || { kind: 'bot' }, 9);
          if (nearest && Number.isFinite(Number(nearest.x)) && Number.isFinite(Number(nearest.y))) return { x: nearest.x, y: nearest.y, reason };
          if (this.isWalkable?.(point.x, point.y, bot || { kind: 'bot' })) return { x: point.x, y: point.y, reason };
        }
        return null;
      };

      Game.prototype.repairInvalidBotPosition = function(bot, reason = 'bot sanity') {
        if (!bot) return false;
        if (this.botHasValidWorldPresence?.(bot, { sameZone: false, requireWalkable: true })) return true;
        const recovery = this.findValidBotRecoveryPoint?.(bot, reason);
        if (!recovery) return false;
        bot.x = recovery.x;
        bot.y = recovery.y;
        bot.zone = this.currentZone || bot.zone || 'overworld';
        bot.vx = 0;
        bot.vy = 0;
        bot.lastStableX = bot.x;
        bot.lastStableY = bot.y;
        bot.stuckTimer = 0;
        bot._pathRoute = [];
        bot._companionPathRoute = [];
        bot.currentActivityLabel = bot.currentActivityLabel || 'Recovered';
        return this.botHasValidWorldPresence?.(bot, { sameZone: false, requireWalkable: true }) === true;
      };

      Game.prototype.removeInvalidBotEverywhere = function(bot, reason = 'invalid bot') {
        if (!bot) return false;
        const id = this.botIdentityKey?.(bot) || '';
        const name = bot.name || id || 'Bot';
        this.removeBotFromParty?.(bot);
        this.botPartyMembers?.delete?.(id);
        this.partyMembers?.delete?.(id);
        this.clearBotCooperationState?.(bot, { leaveParty: true });
        if (bot.botPet && Array.isArray(this.entities)) this.entities = this.entities.filter(entry => entry !== bot.botPet);
        if (bot.pet && Array.isArray(this.entities)) this.entities = this.entities.filter(entry => entry !== bot.pet);
        if (this.pet === bot.botPet || this.pet === bot.pet) this.pet = null;
        this.botPlayers = (this.botPlayers || []).filter(entry => entry !== bot && this.botIdentityKey?.(entry) !== id);
        this.entities = (this.entities || []).filter(entry => entry !== bot);
        bot.alive = false;
        bot.hidden = true;
        bot.renderable = false;
        bot.command = 'despawned';
        bot.botState = 'despawned';
        bot.currentActivityLabel = 'Removed: Invalid Position';
        this.forgetDpsContributorForActor?.(bot, reason);
        this.ensureBotSquads?.();
        this.partyPanelDirty = true;
        this.botHudDirty = true;
        if (this.dpsMeterSystem) this.dpsMeterSystem.dirty = true;
        if (!this._botSanitySuppressLog) this.logParty?.(`${name} removed from world state (${reason}).`);
        return true;
      };

      Game.prototype.cleanupInvalidBotPlayers = function(reason = 'bot sanity cleanup', options = {}) {
        if (!Array.isArray(this.botPlayers) || !this.botPlayers.length) return 0;
        const now = performance.now?.() || Date.now();
        if (!options.force) {
          const interval = Math.max(0.5, Number(options.interval || 2.5));
          if (this._botSanityNextAt && now < this._botSanityNextAt) return 0;
          this._botSanityNextAt = now + interval * 1000;
        }
        let removed = 0;
        let repaired = 0;
        const previousSuppress = this._botSanitySuppressLog;
        this._botSanitySuppressLog = options.silent !== false;
        for (const bot of [...this.botPlayers]) {
          if (!bot || bot.kind !== 'bot') continue;
          if (bot.alive === false || bot.botState === 'dismissed' || bot.botState === 'despawned') continue;
          const sameZone = this.botSameZoneAsPlayer?.(bot);
          const finite = Number.isFinite(Number(bot.x)) && Number.isFinite(Number(bot.y));
          const inside = finite && this.botIsInsidePlayableBounds?.(bot, 0.25);
          const walkable = !sameZone || (this.isWalkable?.(bot.x, bot.y, bot) === true);
          if (finite && inside && walkable) continue;
          const canRepair = options.repair !== false && sameZone && finite && inside;
          if (canRepair && this.repairInvalidBotPosition?.(bot, reason)) { repaired += 1; continue; }
          if (this.removeInvalidBotEverywhere?.(bot, reason)) removed += 1;
        }
        this._botSanitySuppressLog = previousSuppress;
        if (removed || repaired) {
          this.botSanityLastReport = { reason, removed, repaired, at: Date.now ? Date.now() : 0 };
          this.partyPanelDirty = true;
          this.botHudDirty = true;
          this.dpsMeterSystem?.pruneInvalidContributors?.(reason);
          this.dpsMeterSystem?.render?.(true);
          if (options.silent === false) this.logParty?.(`Bot sanity: removed ${removed}, repaired ${repaired}.`);
        }
        return removed + repaired;
      };

      Game.prototype.isBotValidForDps = function(bot) {
        return this.botHasValidWorldPresence?.(bot, { sameZone: true, requireWalkable: false }) === true;
      };

      Game.prototype.debugBotsReport = function(options = {}) {
        this.normalizeBotState?.();
        this.cleanupInvalidBotPlayers?.('debug bots', { force: true, silent: true, repair: true });
        const bots = this.botPlayers || [];
        const lines = [`Active bots: ${bots.length}`];
        for (const bot of bots) {
          const id = this.botIdentityKey?.(bot) || 'unknown';
          const x = Number(bot.x), y = Number(bot.y);
          const valid = this.botHasValidWorldPresence?.(bot, { sameZone: true, requireWalkable: false });
          const walkable = this.botSameZoneAsPlayer?.(bot) && Number.isFinite(x) && Number.isFinite(y) ? this.isWalkable?.(x, y, bot) === true : 'off-zone';
          const party = this.isBotInParty?.(bot) ? 'party' : 'world';
          lines.push(`${bot.name || 'Bot'} ${bot.className || ''} · ${party} · ${bot.zone || 'overworld'} · ${Number.isFinite(x) ? x.toFixed(1) : 'NaN'},${Number.isFinite(y) ? y.toFixed(1) : 'NaN'} · ${bot.alive === false ? 'dead' : (bot.botState || 'idle')} · valid:${valid ? 'yes' : 'no'} · walk:${walkable}`);
        }
        return lines;
      };

      Game.prototype.debugBotsCommand = function() {
        const lines = this.debugBotsReport?.({ log: true }) || ['Bot debug unavailable.'];
        for (const line of lines) this.logParty?.(line);
        this.switchLogTab?.('Party');
        return true;
      };

      Game.prototype.botIsHotRuntime = function(bot) {
        if (!alive(bot)) return false;
        if (this.isBotInParty?.(bot)) return true;
        if (this.isEntityInCombat?.(bot) || Number(bot.combatCooldown || 0) > 0) return true;
        if (bot.botState === 'casting' || bot.botState === 'attacking' || bot.botState === 'healing') return true;
        return this.botDistanceToPlayer?.(bot) <= 12;
      };

      Game.prototype.resolveBotActorInterval = function(bot) {
        const scheduler = this.ensureBotRuntimeScheduler?.() || BOT_RUNTIME_DEFAULTS;
        if (!alive(bot)) return 0.25;
        if (this.isBotTemporarilyBusy?.(bot)) return 0.8;
        if (this.botIsHotRuntime?.(bot)) return 0;
        const d = this.botDistanceToPlayer?.(bot);
        if (d <= scheduler.nearDistance) return 0.12;
        if (d <= scheduler.midDistance) return 0.28;
        return 0.55;
      };

      Game.prototype.resolveBotActorSchedule = function(bot, dt) {
        const scheduler = this.ensureBotRuntimeScheduler?.() || BOT_RUNTIME_DEFAULTS;
        if (!bot || !alive(bot)) return { run: true, reason: 'dead-or-missing' };
        const interval = this.resolveBotActorInterval?.(bot) || 0;
        bot.actorAiInterval = interval;
        if (interval <= 0) return { run: true, reason: 'hot', interval };
        bot.actorAiAccumulator = Math.max(0, Number(bot.actorAiAccumulator || 0)) + Math.max(0, Number(dt || 0));
        if (scheduler.frameActorTicks >= scheduler.maxActorAiTicksPerFrame && !this.botIsHotRuntime?.(bot)) {
          scheduler.skippedActorTicks += 1;
          return { run: false, reason: 'frame-budget', interval };
        }
        if (bot.actorAiAccumulator < interval) {
          scheduler.skippedActorTicks += 1;
          return { run: false, reason: 'interval', interval };
        }
        bot.actorAiAccumulator = Math.min(bot.actorAiAccumulator - interval, interval * 0.5);
        return { run: true, reason: 'scheduled', interval };
      };

      Game.prototype.markBotActorAiTick = function(bot, schedule = {}) {
        const scheduler = this.ensureBotRuntimeScheduler?.() || BOT_RUNTIME_DEFAULTS;
        scheduler.frameActorTicks += 1;
        scheduler.actorTicks += 1;
        bot.lastActorAiSchedule = schedule.reason || 'scheduled';
      };

      Game.prototype.resolveBotAdvancedInterval = function(bot) {
        const scheduler = this.ensureBotRuntimeScheduler?.() || BOT_RUNTIME_DEFAULTS;
        if (!alive(bot)) return 1.0;
        if (this.isBotTemporarilyBusy?.(bot)) return 1.8;
        if (this.isBotInParty?.(bot)) return 0.35;
        if (this.botIsHotRuntime?.(bot)) return 0.45;
        const d = this.botDistanceToPlayer?.(bot);
        if (d <= scheduler.nearDistance) return 0.75;
        if (d <= scheduler.midDistance) return 1.25;
        return 2.25;
      };

      Game.prototype.shouldRunBotAdvancedRoutine = function(bot, dt) {
        const scheduler = this.ensureBotRuntimeScheduler?.() || BOT_RUNTIME_DEFAULTS;
        if (!bot || !alive(bot)) return false;
        if (this.actorIsMeditating?.(bot)) return false;
        const interval = this.resolveBotAdvancedInterval?.(bot) || 1.0;
        bot.advancedRoutineInterval = interval;
        bot.advancedRoutineAccumulator = Math.max(0, Number(bot.advancedRoutineAccumulator || 0)) + Math.max(0, Number(dt || 0));
        const hot = this.botIsHotRuntime?.(bot);
        if (!hot && scheduler.frameAdvancedTicks >= scheduler.maxAdvancedBotsPerFrame) {
          scheduler.skippedAdvancedTicks += 1;
          return false;
        }
        if (bot.advancedRoutineAccumulator < interval) {
          scheduler.skippedAdvancedTicks += 1;
          return false;
        }
        bot.advancedRoutineAccumulator = Math.min(bot.advancedRoutineAccumulator - interval, interval * 0.5);
        scheduler.frameAdvancedTicks += 1;
        scheduler.advancedTicks += 1;
        return true;
      };

      Game.prototype.sanitizeBotRuntimeState = function(bot) {
        if (!bot) return false;
        let repaired = false;
        if (!Number.isFinite(Number(bot.x)) || !Number.isFinite(Number(bot.y))) {
          const anchor = this.defaultBotSpawnAnchor?.() || { x: DR.CONFIG.START_X + 0.5, y: DR.CONFIG.START_Y + 0.5 };
          bot.x = anchor.x;
          bot.y = anchor.y;
          repaired = true;
        }
        if (!Number.isFinite(Number(bot.hp))) { bot.hp = Math.max(1, Number(bot.maxHp || 1)); repaired = true; }
        if (!Number.isFinite(Number(bot.mana))) { bot.mana = Math.max(0, Number(bot.maxMana || 0)); repaired = true; }
        const moved = Math.hypot(Number(bot.x || 0) - Number(bot.lastStableX || bot.x || 0), Number(bot.y || 0) - Number(bot.lastStableY || bot.y || 0));
        if (moved > 0.18) {
          bot.lastStableX = bot.x;
          bot.lastStableY = bot.y;
          bot.stuckTimer = 0;
        } else if (Number(bot.vx || 0) || Number(bot.vy || 0)) {
          bot.stuckTimer = Math.max(0, Number(bot.stuckTimer || 0)) + 0.016;
        }
        if (bot.stuckTimer > 3.5 && !this.isBotInParty?.(bot)) {
          const anchor = bot.roamAnchor || this.botCampAnchor?.() || this.defaultBotSpawnAnchor?.();
          if (anchor && this.isWalkable?.(anchor.x, anchor.y, bot)) {
            bot.x = anchor.x + (Math.random() * 1.4 - 0.7);
            bot.y = anchor.y + (Math.random() * 1.4 - 0.7);
            bot.stuckTimer = 0;
            bot.currentActivityLabel = 'Recovered Path';
            repaired = true;
          }
        }
        return repaired;
      };

      Game.prototype.finalizeBotSchedulerFrame = function(dt) {
        const scheduler = this.ensureBotRuntimeScheduler?.() || BOT_RUNTIME_DEFAULTS;
        scheduler.statsTimer = Math.max(0, Number(scheduler.statsTimer || 0) - Math.max(0, Number(dt || 0)));
        if (scheduler.statsTimer <= 0) {
          scheduler.lastStats = {
            bots: (this.botPlayers || []).length,
            actorTicks: scheduler.actorTicks,
            advancedTicks: scheduler.advancedTicks,
            skippedActorTicks: scheduler.skippedActorTicks,
            skippedAdvancedTicks: scheduler.skippedAdvancedTicks,
            maxActorAiTicksPerFrame: scheduler.maxActorAiTicksPerFrame,
            maxAdvancedBotsPerFrame: scheduler.maxAdvancedBotsPerFrame
          };
          scheduler.actorTicks = 0;
          scheduler.advancedTicks = 0;
          scheduler.skippedActorTicks = 0;
          scheduler.skippedAdvancedTicks = 0;
          scheduler.statsTimer = scheduler.schedulerStatsWindow || BOT_RUNTIME_DEFAULTS.schedulerStatsWindow;
        }
        scheduler.frameActorTicks = 0;
        scheduler.frameAdvancedTicks = 0;
      };

      Game.prototype.isPlayerActivelyMoving = function() {
        const p = this.player;
        if (!p) return false;
        return Math.hypot(Number(p.vx || 0), Number(p.vy || 0)) > 0.025 || Number(p.moveBlend || 0) > 0.18;
      };

      Game.prototype.botPlayerMovementIntent = function(bot) {
        if (!bot) return 'following-party';
        if (this.isBotInParty?.(bot)) return this.isPlayerActivelyMoving?.() ? 'moving-with-party' : 'holding-party-formation';
        return bot.squadId ? 'moving-with-bot-squad' : 'questing';
      };


      Game.prototype.resolveBotClassId = function(botOrClass) {
        const raw = typeof botOrClass === 'string' ? botOrClass : (botOrClass?.className || botOrClass?.classId || botOrClass?.role || 'Fighter');
        const canonical = properClassName(raw);
        return classKey(canonical || raw || 'fighter');
      };

      Game.prototype.getBotClassAiProfile = function(bot) {
        const key = this.resolveBotClassId?.(bot) || 'default';
        return BOT_CLASS_AI_PROFILES[key] || BOT_CLASS_AI_PROFILES.default;
      };

      Game.prototype.getBotPersonalityAiProfile = function(bot) {
        const classProfile = this.getBotClassAiProfile?.(bot) || BOT_CLASS_AI_PROFILES.default;
        const personality = this.botPersonalityProfile?.(bot) || BOT_PERSONALITY_TYPES.steady;
        const cacheKey = `${this.resolveBotClassId?.(bot) || 'default'}:${bot?.personalityId || 'steady'}`;
        if (bot?._personalityAiProfileKey === cacheKey && bot._personalityAiProfile) return bot._personalityAiProfile;
        const recoveryScale = Number(personality.recoveryBias || 1);
        const resolved = Object.freeze({
          ...classProfile,
          emergencyThreshold: Math.min(0.48, Number(classProfile.emergencyThreshold || 0.35) * recoveryScale),
          allyHealThreshold: Math.min(0.94, Number(classProfile.allyHealThreshold || classProfile.healThreshold || 0.70) * recoveryScale),
          healThreshold: Math.min(0.94, Number(classProfile.healThreshold || 0.70) * recoveryScale)
        });
        if (bot) {
          bot._personalityAiProfileKey = cacheKey;
          bot._personalityAiProfile = resolved;
        }
        return resolved;
      };

      Game.prototype.botPlayableClassNames = function() {
        const fromClasses = Object.keys(DR.CLASSES || {});
        const fromSpells = Object.keys(DR.CLASS_SPELL_BOOK || {});
        const seen = new Set();
        const preferredOrder = ['Paladin', 'Warden', 'Fighter', 'Rogue', 'Ranger', 'Assassin', 'Wizard', 'Shaman', 'Summoner', 'Necromancer', 'Cleric', 'Druid', 'Bard', 'Enchanter'];
        const ordered = [...preferredOrder, ...fromClasses, ...fromSpells]
          .map(properClassName)
          .filter(name => name && !seen.has(classKey(name)) && seen.add(classKey(name)));
        return ordered;
      };

      Game.prototype.getBotTemplateMap = function() {
        const out = {};
        for (const className of this.botPlayableClassNames?.() || []) {
          const key = classKey(className);
          const profile = BOT_CLASS_AI_PROFILES[key] || BOT_CLASS_AI_PROFILES.default;
          const base = BOT_TEMPLATE_DEFS[key] || { id: `classbot-${key}`, name: `${className} Bot`, className, role: profile.role, behaviorGoal: 'questing' };
          out[key] = { ...base, className, role: base.role || profile.role, botClassAiProfileId: key };
        }
        return out;
      };

      Game.prototype.spawnClassBot = function(className, options = {}) {
        const key = classKey(className);
        const templates = this.getBotTemplateMap?.() || {};
        const base = templates[key] || templates[classKey(properClassName(className))];
        if (!base) return null;
        const index = (this.botPlayers || []).filter(bot => this.resolveBotClassId?.(bot) === key).length;
        const profile = {
          ...base,
          id: options.id || `${base.id}-${Date.now().toString(36)}-${index}`,
          name: options.name || base.name,
          level: options.level || this.player?.level || 1,
          command: options.command || 'party',
          zone: this.currentZone || 'overworld',
          recruitedByPlayer: options.recruitedByPlayer === true,
          recruiterNpcId: options.recruiterNpcId || null,
          ...options.profile
        };
        const bot = this.spawnBotPlayer?.(profile, { anchor: options.anchor || this.player || this.defaultBotSpawnAnchor?.() });
        if (bot) {
          this.ensureBotPersonality?.(bot, profile.personalityId);
          bot.recruitedByPlayer = options.recruitedByPlayer === true || Boolean(bot.recruitedByPlayer);
          bot.recruiterNpcId = options.recruiterNpcId || bot.recruiterNpcId || null;
          bot.dismissable = options.dismissable !== false;
        }
        if (bot && options.addToParty !== false) {
          if (typeof this.inviteBotToParty === 'function') this.inviteBotToParty(bot, { force: options.forceParty === true, silent: options.silent === true });
          else {
            if (!(this.botPartyMembers instanceof Set)) this.botPartyMembers = new Set();
            this.botPartyMembers.add(String(bot.botId || bot.remoteId || bot.id));
            bot.command = 'party';
            bot.partyId = this.partyId || bot.partyId || 'local';
          }
        }
        this.botHudDirty = true;
        return bot;
      };

      Game.prototype.botPartyMaxBotSlots = function() {
        const configuredBotSlots = Number(this.maxBotPartySlots);
        if (Number.isFinite(configuredBotSlots) && configuredBotSlots >= 0) return Math.floor(configuredBotSlots);

        const partyMax = this.partyMaxSize?.() || BOT_PARTY_MAX_SIZE;
        const localId = String(this.localPeerId || 'local');
        const botIds = new Set();
        for (const bot of this.botPlayers || []) {
          const id = String(bot?.botId || bot?.remoteId || bot?.id || '');
          if (id && this.isBotInParty?.(bot)) botIds.add(id);
        }
        for (const id of this.botPartyMembers || []) if (id) botIds.add(String(id));

        let nonBotSlots = 1; // local player
        for (const id of this.partyMembers || []) {
          const normalized = String(id || '');
          if (!normalized || normalized === localId) continue;
          if (botIds.has(normalized) || normalized.startsWith('bot-')) continue;
          nonBotSlots += 1;
        }
        return Math.max(0, Math.min(BOT_PARTY_MAX_BOTS, partyMax - nonBotSlots));
      };

      Game.prototype.currentBotPartyCount = function() {
        this.normalizeBotState?.();
        return (this.botPlayers || []).filter(bot => this.isBotInParty?.(bot)).length;
      };

      Game.prototype.analyzeBotPartyRoleNeeds = function() {
        const members = (this.getPartyRoster?.() || []).map(member => member.entity || member).filter(Boolean);
        const roleFor = actor => actor.role || actor.roleKey || actor.className || '';
        const count = predicate => members.filter(predicate).length;
        const tankCount = count(actor => BotRoles.isTankRole?.(roleFor(actor)) || /paladin|warden|guardian|tank/i.test(String(roleFor(actor))));
        const healerCount = count(actor => BotRoles.isPrimaryHealerRole?.(roleFor(actor)) || /cleric|healer/i.test(String(roleFor(actor))));
        const supportCount = count(actor => BotRoles.isSupportRole?.(roleFor(actor)) || /bard|enchanter|druid|support|control/i.test(String(roleFor(actor))));
        const meleeCount = count(actor => BotRoles.isMeleeDpsRole?.(roleFor(actor)) || /rogue|melee|scout/i.test(String(roleFor(actor))));
        const rangedCount = count(actor => BotRoles.isRangedRole?.(roleFor(actor)) || /summoner|necromancer|caster|ranged/i.test(String(roleFor(actor))));
        const classCounts = members.reduce((counts, actor) => {
          const key = classKey(actor.className || actor.role || 'unknown');
          counts[key] = (counts[key] || 0) + 1;
          return counts;
        }, {});
        return {
          memberCount: members.length, playerClass: this.player?.className || '', classCounts,
          tankCount, healerCount, supportCount, meleeCount, rangedCount,
          hasTank: tankCount > 0, hasHealer: healerCount > 0, hasSupport: supportCount > 0,
          needsTank: tankCount < 1, needsHealer: healerCount < 1, needsSupport: supportCount < 1,
          needsMelee: meleeCount < 1, needsRanged: rangedCount < 1
        };
      };

      Game.prototype.evaluateBotPartyInvite = function(bot, options = {}) {
        if (!bot || bot.kind !== 'bot') return { accepted: false, reason: 'invalid_bot' };
        if (this.isBotInParty?.(bot)) return { accepted: false, reason: 'already_in_party' };
        if (!this.partyHasRoomFor?.(1)) return { accepted: false, reason: 'party_full' };
        if (bot.alive === false || this.isBotTemporarilyBusy?.(bot) || Number(bot.dungeonRunTimer || 0) > 0) return { accepted: false, reason: 'unavailable' };
        if (bot.partyId && (!this.partyId || bot.partyId !== this.partyId)) return { accepted: false, reason: 'already_grouped' };
        const playerLevel = Math.max(1, Number(this.player?.level || 1));
        const botLevel = Math.max(1, Number(bot.level || 1));
        if (!options.ignoreLevelRange && Math.abs(botLevel - playerLevel) > 8) return { accepted: false, reason: 'level_gap' };
        const needs = this.analyzeBotPartyRoleNeeds?.() || {};
        const role = bot.role || bot.className || '';
        const botClassKey = classKey(bot.className || role);
        if (needs.needsHealer && (BotRoles.isPrimaryHealerRole?.(role) || /cleric|healer/i.test(String(role)))) return { accepted: true, reason: 'needed_healer', needs };
        if (needs.needsTank && (BotRoles.isTankRole?.(role) || /paladin|warden|tank|guardian/i.test(String(role)))) return { accepted: true, reason: 'needed_tank', needs };
        if (needs.needsSupport && (BotRoles.isSupportRole?.(role) || /bard|enchanter|druid|support|control/i.test(String(role)))) return { accepted: true, reason: 'needed_support', needs };
        if (needs.needsMelee && BotRoles.isMeleeDpsRole?.(role)) return { accepted: true, reason: 'needed_melee', needs };
        if (needs.needsRanged && BotRoles.isRangedRole?.(role)) return { accepted: true, reason: 'needed_ranged', needs };
        if (Number(needs.classCounts?.[botClassKey] || 0) >= 2) return { accepted: true, reason: 'duplicate_role', needs };
        return { accepted: true, reason: 'available', needs };
      };

      Game.prototype.botPartyInviteReasonText = function(bot, reason) {
        const messages = {
          party_full: 'You already have a full party.', needed_healer: 'You need someone keeping wounds closed.',
          needed_tank: 'No front line? I’ll stand there.', needed_support: 'This group could use control and support.',
          needed_melee: 'I’ll work the close angles.', needed_ranged: 'I’ll cover the back line.',
          duplicate_role: 'Another one like me? Fine—more coverage.', level_gap: 'Our paths are too far apart in experience.',
          unavailable: 'I’m committed elsewhere right now.', already_grouped: 'I already have a party.', available: 'I’ll come along.'
        };
        return messages[reason] || `${bot?.name || 'Bot'} considers the party.`;
      };

      Game.prototype.botClassRoleInfo = function(className) {
        const info = botClassRoleInfo(className);
        const profile = BOT_CLASS_AI_PROFILES[classKey(className)] || BOT_CLASS_AI_PROFILES.default;
        return { ...info, profileRole: profile.role || info.label, preferredRange: profile.preferredRange || 1 };
      };

      Game.prototype.findBotByClass = function(className, options = {}) {
        const key = classKey(className);
        const candidates = (this.botPlayers || []).filter(bot => this.resolveBotClassId?.(bot) === key);
        if (options.inParty === true) return candidates.find(bot => this.isBotInParty?.(bot)) || null;
        if (options.available === true) return candidates.find(bot => bot.alive !== false && !this.isBotInParty?.(bot)) || null;
        return candidates[0] || null;
      };

      Game.prototype.canRecruitClassBot = function(className, options = {}) {
        const key = classKey(className);
        const classNameProper = properClassName(className);
        if (!key) return { ok: false, reason: 'Invalid class.' };
        const templates = this.getBotTemplateMap?.() || {};
        if (!templates[key]) return { ok: false, reason: 'That class is not available in this build.' };
        if (!this.player || this.player.alive === false) return { ok: false, reason: 'You must be alive to recruit a bot.' };
        const alreadyParty = this.findBotByClass?.(classNameProper, { inParty: true });
        if (alreadyParty && !options.allowDuplicate) return { ok: false, reason: `${classNameProper} bot is already in your party.` };
        const maxSlots = this.botPartyMaxBotSlots?.() ?? BOT_PARTY_MAX_BOTS;
        const count = this.currentBotPartyCount?.() || 0;
        if (count >= maxSlots && !options.force) return { ok: false, reason: `Bot party slots are full (${count}/${maxSlots}). Dismiss or remove a bot first.` };
        return { ok: true, reason: 'Available.', className: classNameProper, key, count, maxSlots };
      };

      Game.prototype.getBotRecruitmentOptions = function() {
        const classes = this.botPlayableClassNames?.() || [];
        const maxSlots = this.botPartyMaxBotSlots?.() ?? BOT_PARTY_MAX_BOTS;
        const count = this.currentBotPartyCount?.() || 0;
        return classes.map(className => {
          const key = classKey(className);
          const info = this.botClassRoleInfo?.(className) || botClassRoleInfo(className);
          const bot = this.findBotByClass?.(className) || null;
          const inParty = bot ? this.isBotInParty?.(bot) : false;
          const can = this.canRecruitClassBot?.(className) || { ok: false, reason: 'Unavailable.' };
          return {
            key,
            className: properClassName(className),
            icon: info.icon || '●',
            roleLabel: info.label || info.profileRole || 'Companion',
            role: info.profileRole || info.label || 'companion',
            desc: info.desc || 'Class AI companion.',
            preferredRange: info.preferredRange || 1,
            existingBotId: bot ? (bot.botId || bot.remoteId || bot.id) : null,
            inParty,
            alive: bot ? bot.alive !== false : true,
            canHire: can.ok,
            disabledReason: inParty ? 'Already in party.' : can.reason,
            partyCount: count,
            partyMax: maxSlots
          };
        });
      };

      Game.prototype.hireClassBot = function(className, options = {}) {
        const can = this.canRecruitClassBot?.(className, options) || { ok: false, reason: 'Recruitment unavailable.' };
        if (!can.ok) {
          if (!options.silent) this.logParty?.(can.reason || 'Cannot recruit bot.');
          return false;
        }
        const existing = this.findBotByClass?.(can.className, { available: true });
        let bot = existing;
        if (!bot) {
          const info = this.botClassRoleInfo?.(can.className) || botClassRoleInfo(can.className);
          const anchor = options.sourceNpc || this.player || this.defaultBotSpawnAnchor?.();
          bot = this.spawnClassBot?.(can.className, {
            anchor,
            level: options.level || this.player?.level || 1,
            addToParty: false,
            recruitedByPlayer: true,
            dismissable: true,
            recruiterNpcId: options.sourceNpc?.id || options.sourceNpc?.npcId || null,
            name: options.name || `${can.className} Companion`,
            profile: { currentActivityLabel: `Recruited ${info.label || can.className}` }
          });
        }
        if (!bot) return false;
        bot.recruitedByPlayer = true;
        bot.dismissable = true;
        bot.zone = this.currentZone || bot.zone || 'overworld';
        const joined = this.inviteBotToParty?.(bot, { force: options.force === true, silent: options.silent === true });
        if (!joined) return false;
        bot.command = 'party';
        bot.currentActivityLabel = 'Following Party';
        bot.lastSocialLine = `Contract accepted. ${bot.name} is ready.`;
        this.spawnRing?.(bot.x, bot.y, '#6bbcff', 22);
        if (!options.silent) this.logParty?.(`${bot.name} recruited as ${can.className}.`);
        this.botHudDirty = true;
        this.partyPanelDirty = true;
        return bot;
      };

      Game.prototype.dismissClassBot = function(botOrId, options = {}) {
        const bot = typeof botOrId === 'string'
          ? (this.botPlayers || []).find(entry => String(entry.botId || entry.remoteId || entry.id) === String(botOrId))
          : botOrId;
        if (!bot) return false;
        const name = bot.name || 'Bot';
        this.removeBotFromParty?.(bot);
        if (options.removeFromWorld !== false) this.removeBotPlayer?.(bot);
        else {
          bot.command = 'autonomous';
          bot.botState = 'dismissed';
          bot.currentActivityLabel = 'Dismissed';
        }
        if (!options.silent) this.logParty?.(`${name} dismissed.`);
        this.botHudDirty = true;
        this.partyPanelDirty = true;
        return true;
      };

      Game.prototype.spawnAllClassBotsForTesting = function(options = {}) {
        if (!options.allowDebug && !this.debugMode && !this.devMode && !this.qaMode) {
          this.logParty?.('Class bot mass-spawn is debug-only. Use the recruiter NPC for normal play.');
          return [];
        }
        const spawned = [];
        const classNames = this.botPlayableClassNames?.() || [];
        for (const className of classNames) {
          const key = classKey(className);
          if ((this.botPlayers || []).some(bot => this.resolveBotClassId?.(bot) === key && String(bot.id || '').includes('test-classbot'))) continue;
          const angle = spawned.length * (Math.PI * 2 / Math.max(1, classNames.length));
          const anchor = this.player ? { x: this.player.x + Math.cos(angle) * 2.6, y: this.player.y + Math.sin(angle) * 2.6 } : this.defaultBotSpawnAnchor?.();
          const bot = this.spawnClassBot?.(className, { id: `test-classbot-${key}`, name: `${className} AI`, anchor, level: options.level || this.player?.level || 1, addToParty: options.addToParty !== false });
          if (bot) spawned.push(bot);
        }
        this.logParty?.(`Spawned ${spawned.length} class AI bots for testing.`);
        return spawned;
      };

      Game.prototype.ensureBotClassRuntime = function(bot) {
        if (!bot) return null;
        bot.className = properClassName(bot.className || 'Fighter');
        bot.botClassAiProfileId = this.resolveBotClassId?.(bot) || 'fighter';
        const profile = this.getBotClassAiProfile?.(bot) || BOT_CLASS_AI_PROFILES.default;
        bot.role = bot.role || profile.role || 'basic_assist';
        if (!bot.botSpellCooldowns || typeof bot.botSpellCooldowns !== 'object') bot.botSpellCooldowns = {};
        return profile;
      };

      Game.prototype.updateBotSpellCooldowns = function(bot, dt = 0) {
        if (!bot?.botSpellCooldowns) return;
        const step = Math.max(0, Number(dt) || 0);
        for (const key of Object.keys(bot.botSpellCooldowns)) {
          bot.botSpellCooldowns[key] = Math.max(0, Number(bot.botSpellCooldowns[key] || 0) - step);
          if (bot.botSpellCooldowns[key] <= 0.001) delete bot.botSpellCooldowns[key];
        }
      };

      Game.prototype.resolveBotSpellCastSeconds = function(bot, spell) {
        const base = resolveSpellBaseCastSeconds(spell);
        const cdr = DR.StatSystem?.cooldownReductionMultiplier?.(bot) || 1;
        return Math.max(0, base * Math.max(0.65, Math.min(1.25, cdr)));
      };

      Game.prototype.botManaReserveRatioForSpell = function(bot, spell, options = {}) {
        if (!bot || Number(bot.maxMana || 0) <= 0 || Math.max(0, Number(spell?.cost || 0)) <= 0) return 0;
        const kind = String(spell?.kind || '');
        if (options.emergency || options.allowLowMana || kind === 'mana' || kind === 'summonPet') return 0;
        if (kind === 'heal' || kind === 'aoeHeal') {
          const threshold = Number(options.emergencyThreshold || 0.34);
          const ally = options.ally || this.findBotHealingTarget?.(bot, threshold, { range: spell.range || 18 });
          if (ally && hpRatio(ally) <= threshold + 0.02) return 0;
        }
        if (kind === 'drain' && hpRatio(bot) < 0.62) return 0;
        if ((kind === 'petHeal' || kind === 'petBuff') && alive(bot.botPet)) return 0.04;
        const profile = this.getBotClassAiProfile?.(bot) || BOT_CLASS_AI_PROFILES.default;
        return BOT_CLASS_AI_BALANCE.manaReserve[profile.role] ?? BOT_CLASS_AI_BALANCE.manaReserve.basic_assist;
      };

      Game.prototype.shouldBotConserveManaForSpell = function(bot, spell, target = null, options = {}) {
        const maxMana = Number(bot?.maxMana || 0);
        const cost = Math.max(0, Number(spell?.cost || 0));
        if (!bot || maxMana <= 0 || cost <= 0) return false;
        const reserve = this.botManaReserveRatioForSpell?.(bot, spell, options) || 0;
        if (reserve <= 0) return false;
        const after = Math.max(0, Number(bot.mana || 0) - cost) / Math.max(1, maxMana);
        return after < reserve;
      };

      Game.prototype.isBotHostileCombatTarget = function(actor) {
        return isBotHostileCombatActor(this, actor);
      };

      Game.prototype.cancelBotPendingCast = function(bot, reason = 'cancelled', options = {}) {
        if (!bot?.botPendingCast) return false;
        const pending = bot.botPendingCast;
        const name = pending.spellName || 'Spell';
        if (String(pending.spell?.kind || '') === 'revive' && pending.ally) this.clearBotReviveReservation?.(pending.ally, bot);
        bot.botPendingCast = null;
        bot.spellCastAnim = 0;
        if (!options.silent) this.spawnCastCue?.(bot, '#c66a66', `${name} interrupted`);
        bot.currentActivityLabel = reason === 'dead' ? 'Downed' : 'Ready';
        return true;
      };

      Game.prototype.startBotClassCast = function(bot, spell, target = null, options = {}) {
        if (!bot || !spell || bot.botPendingCast) return false;
        const castSeconds = Math.max(0, Number(options.castSeconds ?? this.resolveBotSpellCastSeconds?.(bot, spell) ?? 0));
        if (castSeconds <= BOT_CLASS_AI_BALANCE.fullCastThreshold) return false;
        const key = spell._botSpellKey || spellKey(spell, spell.slotIndex);
        bot.botPendingCast = {
          key,
          spellName: spell.name || key,
          spell: { ...spell },
          target,
          ally: options.ally || null,
          remaining: castSeconds,
          total: castSeconds,
          requireLineOfSight: Boolean(options.requireLineOfSight),
          startedAt: (typeof performance !== 'undefined' ? performance.now() : Date.now())
        };
        bot.botState = 'class-casting';
        bot.currentActivityLabel = `Casting ${spell.name || 'Spell'}`;
        bot.vx = 0; bot.vy = 0; bot.moveBlend = 0;
        bot.path = null; bot.pathGoal = null; bot.combatPath = null;
        bot.spellCastAnim = Math.max(bot.spellCastAnim || 0, 1);
        bot.setFacingFromDelta?.((target?.x || options.ally?.x || bot.x) - bot.x, (target?.y || options.ally?.y || bot.y) - bot.y);
        this.cancelMeditation?.(bot, 'spell cast', { silent: true });
        if (String(spell.kind || '') === 'revive' && options.ally) this.reserveBotReviveTarget?.(bot, options.ally, Math.max(4500, (castSeconds + 1.0) * 1000));
        this.spawnCastCue?.(bot, spell.color || bot.color || '#ffffff', spell.name || 'Cast');
        return true;
      };

      Game.prototype.completeBotPendingCast = function(bot) {
        const pending = bot?.botPendingCast;
        if (!pending) return false;
        const spell = pending.spell;
        const target = pending.target;
        const ally = pending.ally;
        bot.botPendingCast = null;
        bot.spellCastAnim = 0;
        if (!alive(bot)) return false;
        const kind = String(spell?.kind || '');
        if (isOffensiveKind(kind) && (!pendingActorStillValid(target) || !isBotHostileCombatActor(this, target))) return false;
        if (kind === 'revive' && (!ally || ally.alive !== false || !Number.isFinite(Number(ally.x)) || !Number.isFinite(Number(ally.y)))) return false;
        if ((isHealKind(kind) || isBuffKind(kind) || kind === 'mana' || kind === 'cleanse') && ally && !pendingActorStillValid(ally)) return false;
        return this.castBotClassSpell?.(bot, spell, target, { ally, requireLineOfSight: pending.requireLineOfSight, resolvePending: true, emergency: hpRatio(ally || bot) < 0.36 }) === true;
      };

      Game.prototype.updateBotPendingCast = function(bot, dt = 0) {
        const pending = bot?.botPendingCast;
        if (!pending) return false;
        if (!alive(bot)) { this.cancelBotPendingCast?.(bot, 'dead', { silent: true }); return false; }
        if (this.actorIsMeditating?.(bot)) { this.cancelBotPendingCast?.(bot, 'meditation', { silent: true }); return false; }
        const target = pending.target;
        const ally = pending.ally;
        const kind = String(pending.spell?.kind || '');
        if (isOffensiveKind(kind) && (!pendingActorStillValid(target) || !isBotHostileCombatActor(this, target))) { this.cancelBotPendingCast?.(bot, 'target lost', { silent: true }); return false; }
        if (kind === 'revive' && (!ally || ally.alive !== false || !Number.isFinite(Number(ally.x)) || !Number.isFinite(Number(ally.y)))) { this.cancelBotPendingCast?.(bot, 'revive target lost', { silent: true }); return false; }
        if ((isHealKind(kind) || isBuffKind(kind) || kind === 'mana' || kind === 'cleanse') && ally && !pendingActorStillValid(ally)) { this.cancelBotPendingCast?.(bot, 'ally lost', { silent: true }); return false; }
        bot.vx = 0; bot.vy = 0; bot.moveBlend = 0;
        bot.path = null; bot.pathGoal = null; bot.combatPath = null;
        bot.botState = 'class-casting';
        bot.currentActivityLabel = `Casting ${pending.spellName || 'Spell'}`;
        bot.setFacingFromDelta?.((target?.x || ally?.x || bot.x) - bot.x, (target?.y || ally?.y || bot.y) - bot.y);
        pending.remaining = Math.max(0, Number(pending.remaining || 0) - Math.max(0, Number(dt) || 0));
        if (pending.remaining <= 0.001) return this.completeBotPendingCast?.(bot) || true;
        return true;
      };

      Game.prototype.getBotClassSpells = function(bot) {
        const className = properClassName(bot?.className || 'Fighter');
        let spells = [];
        try { spells = this.getClassSpells?.(className) || []; } catch (_) { spells = []; }
        if (!spells.length) spells = DR.CLASS_SPELL_BOOK?.[className] || [];
        const level = safeLevel(bot);
        return spells
          .filter(Boolean)
          .map((spell, index) => ({ ...spell, slotIndex: spell.slotIndex ?? index, _botSpellKey: spellKey(spell, index) }))
          .filter(spell => level >= Math.max(1, Math.floor(Number(spell.levelRequirement || 1))));
      };

      Game.prototype.getBotFriendlyActors = function(bot, range = 18) {
        const actors = [];
        const push = actor => {
          if (!alive(actor)) return;
          if (range < Infinity && dist(bot, actor) > range) return;
          if (!actors.includes(actor)) actors.push(actor);
        };
        if (this.isBotInParty?.(bot)) {
          push(this.player); push(this.merc); push(this.pet); push(bot.botPet);
          for (const ally of this.botPlayers || []) if (ally === bot || this.isBotInParty?.(ally)) push(ally);
          for (const id of this.partyMembers || []) {
            if (String(id) === String(this.localPeerId)) continue;
            push(this.remotePlayers?.get?.(id));
          }
        } else {
          // V0.14.45: autonomous bots only cooperate with explicit bot-party members.
          // A solo bot heals/buffs itself and its pet; it never assists random friendly bots.
          push(bot); push(bot.botPet);
          for (const ally of this.getAutonomousBotPartyMembers?.(bot, { range }) || []) if (ally !== bot) push(ally);
        }
        return actors;
      };

      Game.prototype.findBotHealingTarget = function(bot, threshold = 0.75, options = {}) {
        const range = Number.isFinite(Number(options.range)) ? Number(options.range) : 10.5;
        const candidates = this.getBotFriendlyActors?.(bot, range) || [];
        let best = null;
        let bestScore = Infinity;
        for (const actor of candidates) {
          if (!actor || actor.maxHp <= 0) continue;
          const ratio = hpRatio(actor);
          if (ratio >= threshold) continue;
          const score = ratio + (actor === bot ? -0.10 : actor === this.player ? -0.16 : actor.role === 'tank' ? -0.08 : 0);
          if (score < bestScore) { best = actor; bestScore = score; }
        }
        return best;
      };

      Game.prototype.findBotManaTarget = function(bot, threshold = 0.45, options = {}) {
        const candidates = this.getBotFriendlyActors?.(bot, options.range || 12) || [];
        let best = null;
        let bestRatio = Infinity;
        for (const actor of candidates) {
          if (!actor || Number(actor.maxMana || 0) <= 0) continue;
          const ratio = mpRatio(actor);
          if (ratio >= threshold || ratio >= bestRatio) continue;
          best = actor;
          bestRatio = ratio;
        }
        return best;
      };

      Game.prototype.findBotCleanseTarget = function(bot, options = {}) {
        const tags = Array.isArray(options.tags) && options.tags.length ? options.tags : ['poison'];
        const candidates = this.getBotFriendlyActors?.(bot, options.range || 6) || [];
        let best = null;
        let bestScore = Infinity;
        for (const actor of candidates) {
          if (!actor) continue;
          let curable = false;
          for (let i = 0; i < tags.length; i++) {
            if (this.hasCurableStatusTag?.(actor, tags[i])) { curable = true; break; }
          }
          if (!curable) continue;
          const score = hpRatio(actor) - (actor === this.player ? 0.22 : actor.role === 'tank' ? 0.12 : 0);
          if (score < bestScore) { best = actor; bestScore = score; }
        }
        return best;
      };

      Game.prototype.botCanSafelyRevive = function(bot, target) {
        if (!bot || !target) return false;
        return !(this.enemies || []).some(enemy => isBotHostileCombatActor(this, enemy) && (dist(enemy, bot) < 3.25 || dist(enemy, target) < 2.5));
      };

      Game.prototype.botIdForReservation = function(bot) {
        return String(bot?.botId || bot?.remoteId || bot?.id || bot?.name || 'bot');
      };

      Game.prototype.isBotReviveReservationActive = function(target, bot = null) {
        if (!target) return false;
        const until = Number(target.reviveReservedUntil || 0);
        if (until <= ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now())) return false;
        const reservedBy = String(target.reviveReservedBy || '');
        if (!reservedBy) return false;
        if (bot && reservedBy === this.botIdForReservation?.(bot)) return false;
        const owner = (this.botPlayers || []).find(member => this.botIdForReservation?.(member) === reservedBy);
        return Boolean(owner && alive(owner));
      };

      Game.prototype.reserveBotReviveTarget = function(bot, target, durationMs = 5000) {
        if (!bot || !target) return false;
        target.reviveReservedBy = this.botIdForReservation?.(bot);
        target.reviveReservedUntil = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) + Math.max(1000, Number(durationMs) || 5000);
        return true;
      };

      Game.prototype.clearBotReviveReservation = function(target, bot = null) {
        if (!target) return false;
        if (bot && String(target.reviveReservedBy || '') && String(target.reviveReservedBy) !== this.botIdForReservation?.(bot)) return false;
        target.reviveReservedBy = null;
        target.reviveReservedUntil = 0;
        return true;
      };

      Game.prototype.botReviveSpellFor = function(bot) {
        if (!alive(bot) || this.actorIsMeditating?.(bot)) return null;
        const spells = this.getBotClassSpells?.(bot) || [];
        for (const spell of spells) {
          if (String(spell?.kind || '') !== 'revive') continue;
          const key = spell._botSpellKey || spellKey(spell, spell.slotIndex);
          if (Number(bot.botSpellCooldowns?.[key] || 0) > 0) continue;
          const cost = Math.max(0, Math.floor(Number(spell.cost || 0)));
          if (Number(bot.maxMana || 0) > 0 && Number(bot.mana || 0) < cost) continue;
          if (Number(bot.maxMana || 0) <= 0 && cost > 0) continue;
          return spell;
        }
        return null;
      };

      Game.prototype.findBotReviveTarget = function(bot, options = {}) {
        const range = Number(options.range || 6);
        const allowOutOfRange = options.allowOutOfRange === true;
        const searchRange = Number(options.searchRange || (allowOutOfRange ? 28 : range));
        const candidates = this.deadFriendlyActors?.() || [];
        let best = null;
        let bestPriority = Infinity;
        let bestDistance = Infinity;
        for (const actor of candidates) {
          if (!this.isResurrectableFriendlyActor?.(actor)) continue;
          if (this.isBotReviveReservationActive?.(actor, bot)) continue;
          if (!Number.isFinite(Number(actor.x)) || !Number.isFinite(Number(actor.y))) continue;
          const distance = dist(bot, actor);
          if (!allowOutOfRange) {
            if (!this.canReviveTarget?.(bot, actor, range) || !this.botCanSafelyRevive?.(bot, actor)) continue;
          } else if (distance > searchRange + 0.05) continue;
          const kind = String(actor.kind || '').toLowerCase();
          const priority = actor === this.player || kind === 'player' ? 0 : kind === 'bot' ? 1 : kind === 'merc' ? 2 : 3;
          if (priority < bestPriority || (priority === bestPriority && distance < bestDistance)) {
            best = actor;
            bestPriority = priority;
            bestDistance = distance;
          }
        }
        return best;
      };

      Game.prototype.updateBotReviveBehavior = function(bot, profile = BOT_CLASS_AI_PROFILES.default, dt = 0) {
        const spell = this.botReviveSpellFor?.(bot);
        if (!spell) return false;
        const range = Number(spell.range || 6);
        const ally = this.findBotReviveTarget?.(bot, { range, allowOutOfRange: true, searchRange: Math.max(24, range + 18) });
        if (!ally) return false;
        this.reserveBotReviveTarget?.(bot, ally, 5000);
        if (ally === this.player) this.refreshDeathRespawnOverlay?.();
        if (!this.canReviveTarget?.(bot, ally, range) || !this.botCanSafelyRevive?.(bot, ally)) {
          bot.botState = 'moving-to-revive';
          bot.currentActivityLabel = 'Moving to resurrect';
          bot.target = null;
          bot.targetId = null;
          bot.combatTargetId = null;
          this.moveCompanionToPoint?.(bot, ally.x, ally.y, dt, { mode: 'bot-revive', stopRange: Math.max(0.55, range - 0.65), recalcMs: 360, allowPartialPath: true, maxRange: 72, maxNodes: 2200 });
          return true;
        }
        if (this.castBotClassSpell?.(bot, spell, null, { ally, emergency: true, allowLowMana: true })) {
          bot.botState = 'class-reviving';
          bot.currentActivityLabel = spell.name || 'Resurrecting';
          return true;
        }
        return true;
      };

      Game.prototype.botNeedsBuff = function(actor, spell) {
        if (!actor || !spell) return false;
        const key = spell.buffName || spell.statusName || spell.name;
        return !hasStatus(actor, key);
      };

      Game.prototype.botCanCastSpell = function(bot, spell, target = null, options = {}) {
        if (!alive(bot) || !spell) return false;
        if (this.actorIsMeditating?.(bot)) return false;
        if (bot.botPendingCast && !options.resolvePending) return false;
        const key = spell._botSpellKey || spellKey(spell, spell.slotIndex);
        if (Number(bot.botSpellCooldowns?.[key] || 0) > 0) return false;
        const cost = Math.max(0, Math.floor(Number(spell.cost || 0)));
        if (Number(bot.maxMana || 0) > 0 && Number(bot.mana || 0) < cost) return false;
        if (Number(bot.maxMana || 0) <= 0 && cost > 0) return false;
        const kind = String(spell.kind || '');
        if (!options.resolvePending && this.shouldBotConserveManaForSpell?.(bot, spell, target, options)) return false;
        if (isOffensiveKind(kind)) {
          if (!isBotHostileCombatActor(this, target)) return false;
          const range = Number(spell.range || (kind === 'melee' || kind === 'meleeDebuff' || kind === 'aoeMelee' ? 2.1 : kind === 'dashStrike' ? 5.0 : 7.2));
          if (!['aoe', 'aoeMelee', 'aoeDebuff'].includes(kind) && dist(bot, target) > range + 0.35) return false;
          const requiresClearance = options.requireLineOfSight || ['melee', 'meleeDebuff', 'dashStrike'].includes(kind);
          if (requiresClearance && this.companionHasClearCombatLine && !this.companionHasClearCombatLine(bot, target, { desiredRange: range, requireLineOfSight: options.requireLineOfSight, requireMeleeClearance: ['melee', 'meleeDebuff', 'dashStrike'].includes(kind) })) return false;
          if (options.requireLineOfSight && !this.companionHasClearCombatLine && this.hasLineWalkPath && !this.hasLineWalkPath(bot.x, bot.y, target.x, target.y, bot)) return false;
        }
        if (kind === 'petHeal' && !alive(bot.botPet)) return false;
        if (kind === 'petBuff' && !alive(bot.botPet)) return false;
        if (kind === 'cleanse') {
          const ally = options.ally || this.findBotCleanseTarget?.(bot, { range: spell.range || 6, tags: spell.removesStatusTags });
          if (!alive(ally) || dist(bot, ally) > Number(spell.range || 6) + 0.05) return false;
          if (!(spell.removesStatusTags || ['poison']).some(tag => this.hasCurableStatusTag?.(ally, tag))) return false;
        }
        if (kind === 'revive') {
          const ally = options.ally || this.findBotReviveTarget?.(bot, { range: spell.range || 6 });
          if (!this.canReviveTarget?.(bot, ally, spell.range || 6) || !this.botCanSafelyRevive?.(bot, ally)) return false;
        }
        return true;
      };

      Game.prototype.markBotOwnerCombatTarget = function(bot, target = null, options = {}) {
        if (!bot) return false;
        const validTarget = isBotHostileCombatActor(this, target);
        if (!validTarget) {
          if (options.clear === true) {
            bot.target = null;
            bot.targetId = null;
            bot.combatTargetId = null;
          }
          return false;
        }
        bot.target = target;
        bot.targetId = target.id ?? null;
        bot.combatTargetId = target.id ?? null;
        bot.combatCooldown = Math.max(Number(bot.combatCooldown || 0), Number(options.cooldown || 4.0));
        return true;
      };

      Game.prototype.ensureBotPet = function(bot, spell = {}, target = null) {
        if (!bot || !['summoner', 'necromancer'].includes(this.resolveBotClassId?.(bot))) return null;
        const validTarget = isBotHostileCombatActor(this, target);
        if (validTarget) this.markBotOwnerCombatTarget?.(bot, target, { cooldown: 4.0 });
        if (bot.botPet && bot.botPet.alive !== false) {
          bot.botPet.owner = bot;
          bot.botPet.ownerId = bot.botId || bot.remoteId || bot.id || null;
          bot.botPet.zone = bot.zone || this.currentZone || bot.botPet.zone || 'overworld';
          bot.botPet.command = 'assist';
          bot.botPet.commandState = validTarget ? 'assisting' : 'assist';
          bot.botPet.forcedTargetId = null;
          if (!Array.isArray(this.entities)) this.entities = [];
          if (!this.entities.includes(bot.botPet)) this.entities.push(bot.botPet);
          return bot.botPet;
        }
        if (bot.botPet) {
          this.entities = (this.entities || []).filter(entity => entity !== bot.botPet);
          bot.botPet = null;
        }
        const PetClass = DR.entities?.Pet || window.Pet;
        if (!PetClass) return null;
        const necro = this.resolveBotClassId?.(bot) === 'necromancer' || String(spell.petType || '').toLowerCase() === 'undead';
        const pet = new PetClass(bot.x + 0.45, bot.y + 0.45, bot, {
          name: spell.petName || (necro ? 'Bone Servant' : 'Azure Shard Familiar'),
          petName: spell.petName,
          petType: spell.petType || (necro ? 'undead' : 'shard'),
          color: spell.petColor || spell.color || (necro ? '#d8e5b4' : '#66d6c7'),
          attack: spell.petAttack || (necro ? 10 + safeLevel(bot) : 11 + Math.floor(safeLevel(bot) * 0.6)),
          hp: spell.petHp || (necro ? 58 + safeLevel(bot) * 5 : 52 + safeLevel(bot) * 4),
          level: safeLevel(bot),
          zone: bot.zone || this.currentZone || 'overworld',
          command: 'assist',
          commandState: validTarget ? 'assisting' : 'assist'
        });
        pet.kind = 'pet';
        pet.owner = bot;
        pet.ownerId = bot.botId || bot.remoteId || bot.id || null;
        pet.target = validTarget ? target : null;
        pet.targetId = validTarget ? target.id ?? null : null;
        pet.forcedTargetId = null;
        pet.aiIntent = validTarget ? 'assisting' : 'following';
        bot.botPet = pet;
        bot.botPetId = pet.id || pet.name;
        if (!this.entities.includes(pet)) this.entities.push(pet);
        this.spawnRing?.(bot.x, bot.y, spell.color || pet.color || '#66d6c7', 14);
        this.playSfx?.('pet_summon', { x: bot.x, y: bot.y, volume: 0.26, cooldown: 0.25 });
        return pet;
      };

      Game.prototype.commandBotPet = function(bot, target = null) {
        const pet = bot?.botPet;
        if (!alive(pet)) return false;
        const validTarget = isBotHostileCombatActor(this, target);
        pet.owner = bot;
        pet.ownerId = bot.botId || bot.remoteId || bot.id || null;
        pet.zone = bot.zone || this.currentZone || pet.zone || 'overworld';
        pet.command = 'assist';
        pet.commandState = validTarget ? 'assisting' : 'assist';
        pet.target = validTarget ? target : null;
        pet.targetId = validTarget ? target.id ?? null : null;
        pet.forcedTargetId = null;
        pet.aiIntent = validTarget ? 'assisting' : 'following';
        if (validTarget) this.markBotOwnerCombatTarget?.(bot, target, { cooldown: 4.0 });
        return true;
      };

      Game.prototype.applyBotHostileSpellStatus = function(bot, target, spell, power = 0) {
        if (!alive(target) || !spell) return;
        const tickDamage = Number(spell.tickDamage || spell.statusDamage || 0);
        const mods = spell.mods || {};
        if (tickDamage <= 0 && !Object.keys(mods).length) return;
        const color = spell.color || bot.color || '#ffffff';
        this.applyStatusEffect?.(target, {
          id: spell.statusId || spell.statusName || spell.name,
          name: spell.statusName || spell.name,
          type: tickDamage > 0 ? 'dot' : 'debuff',
          duration: spell.tickDuration || spell.duration || 4,
          tickRate: tickDamage > 0 ? 2.3 : 0,
          periodicDamage: tickDamage > 0 ? tickDamage + Math.floor(safeLevel(bot) * 0.45) : 0,
          damageType: ['melee','meleeDebuff','aoeMelee'].includes(spell.kind) ? 'physical' : 'magic',
          mods,
          color,
          hostile: true,
          maxStacks: spell.maxStacks || 1,
          tags: spell.tags || (classKey(spell.name).includes('snare') || classKey(spell.name).includes('slow') ? ['slow'] : undefined)
        }, bot) || target.addBuff?.(spell.statusName || spell.name, spell.duration || 4, mods, { tickDamage, tickRate: 2.3, color, sourceId: bot.id, sourceKind: bot.kind, sourceName: bot.name, hostile: true });
        this.spawnStatusPulse?.(target, color, spell.statusName || spell.name);
      };

      Game.prototype.castBotClassSpell = function(bot, spell, target = null, options = {}) {
        if (!this.botCanCastSpell?.(bot, spell, target, {
          requireLineOfSight: options.requireLineOfSight,
          ally: options.ally,
          emergency: options.emergency,
          allowLowMana: options.allowLowMana,
          resolvePending: options.resolvePending
        })) return false;
        const castSeconds = this.resolveBotSpellCastSeconds?.(bot, spell) || 0;
        if (!options.resolvePending && castSeconds > BOT_CLASS_AI_BALANCE.fullCastThreshold) {
          return this.startBotClassCast?.(bot, spell, target, { ...options, castSeconds }) === true;
        }
        const key = spell._botSpellKey || spellKey(spell, spell.slotIndex);
        const kind = String(spell.kind || '');
        const color = spell.color || bot.color || '#ffffff';
        const level = safeLevel(bot);
        const power = Math.max(0, Math.floor(Number(spell.power || 0) + level * 4));
        const cost = Math.max(0, Math.floor(Number(spell.cost || 0)));
        let committed = false;
        const commitCast = () => {
          if (committed) return true;
          committed = true;
          bot.mana = Math.max(0, Number(bot.mana || 0) - cost);
          bot.botSpellCooldowns[key] = DR.StatSystem?.effectiveCooldown?.(spell.cooldown || 4, bot) || (spell.cooldown || 4);
          bot.attackAiTimer = Math.max(bot.attackAiTimer || 0, Math.min(2.8, Number(spell.castTime || 0.35) + 0.35));
          bot.spellCastAnim = 1;
          bot.botLastCastName = spell.name || 'Spell';
          bot.setFacingFromDelta?.((target?.x || options.ally?.x || bot.x) - bot.x, (target?.y || options.ally?.y || bot.y) - bot.y);
          this.cancelMeditation?.(bot, 'spell cast', { silent: true });
          this.spawnCastCue?.(bot, color, spell.name || 'Cast');
          return true;
        };

        const healTarget = options.ally || this.findBotHealingTarget?.(bot, 0.82, { range: spell.range || 18 }) || bot;
        const friendly = this.getBotFriendlyActors?.(bot, spell.radius || spell.range || 18) || [bot];
        const damageOptions = { damageType: ['melee','meleeDebuff','dashStrike','aoeMelee'].includes(kind) ? 'physical' : 'magic', canCrit: true };

        if (kind === 'summonPet') {
          const pet = this.ensureBotPet?.(bot, spell, target);
          if (!alive(pet)) return false;
          this.commandBotPet?.(bot, target);
          this.queueBotSpeechEvent?.(bot, 'petSummoned', { priority: 2 });
          return commitCast();
        }
        if (kind === 'boltSummon') {
          if (!isBotHostileCombatActor(this, target)) return false;
          this.damageEntity?.(target, power, bot, color, damageOptions);
          this.spawnBolt?.(bot, target, color);
          const pet = this.ensureBotPet?.(bot, spell, target);
          if (!alive(pet)) return false;
          this.commandBotPet?.(bot, target);
          this.queueBotSpeechEvent?.(bot, 'petSummoned', { priority: 2 });
          return commitCast();
        }
        if (kind === 'petHeal') {
          const pet = bot.botPet;
          if (!alive(pet)) return false;
          this.healEntity?.(pet, spell.heal || power, true, bot, { damageType: 'healing' });
          this.spawnStatusPulse?.(pet, color, spell.name);
          return commitCast();
        }
        if (kind === 'petBuff') {
          const pet = bot.botPet;
          if (!alive(pet)) return false;
          this.applyStatusEffect?.(pet, { id: spell.buffName || spell.name, name: spell.buffName || spell.name, type: 'buff', duration: spell.duration || 8, mods: spell.mods || {}, color, hostile: false }, bot) || pet.addBuff?.(spell.buffName || spell.name, spell.duration || 8, spell.mods || {});
          return commitCast();
        }
        if (kind === 'cleanse') {
          const ally = options.ally || this.findBotCleanseTarget?.(bot, { range: spell.range || 6, tags: spell.removesStatusTags });
          if (!alive(ally)) return false;
          const removed = this.cleanseStatusEffects?.(ally, { tags: spell.removesStatusTags || ['poison'] }) || [];
          if (!removed.length) return false;
          this.spawnRing?.(ally.x, ally.y, color, 12);
          this.spawnStatusPulse?.(ally, color, 'Purified');
          this.queueBotSpeechEvent?.(bot, 'purifyAlly', { priority: 3 });
          return commitCast();
        }
        if (kind === 'revive') {
          const ally = options.ally || this.findBotReviveTarget?.(bot, { range: spell.range || 6 });
          if (!this.reviveFriendlyActor?.(ally, {
            caster: bot,
            range: spell.range || 6,
            hpPct: spell.reviveHpPct || (String(bot.className) === 'Druid' ? 0.30 : 0.35),
            manaPct: spell.reviveManaPct || (String(bot.className) === 'Druid' ? 0.20 : 0.25),
            color,
            label: spell.name
          })) return false;
          this.clearBotReviveReservation?.(ally, bot);
          this.queueBotSpeechEvent?.(bot, 'resurrectAlly', { priority: 4, required: true });
          return commitCast();
        }
        if (kind === 'buff') {
          const ally = spell.selfOnly ? bot : (options.ally || bot);
          if (!alive(ally)) return false;
          this.applyStatusEffect?.(ally, { id: spell.buffName || spell.name, name: spell.buffName || spell.name, type: 'buff', duration: spell.duration || 8, mods: spell.mods || {}, color, hostile: false }, bot) || ally.addBuff?.(spell.buffName || spell.name, spell.duration || 8, spell.mods || {});
          this.spawnStatusPulse?.(ally, color, spell.name);
          this.queueBotSpeechEvent?.(bot, 'buffAlly', { priority: 1 });
          return commitCast();
        }
        if (kind === 'groupBuff') {
          let affected = 0;
          for (const ally of friendly) if (alive(ally)) {
            this.applyStatusEffect?.(ally, { id: spell.buffName || spell.name, name: spell.buffName || spell.name, type: 'buff', duration: spell.duration || 8, mods: spell.mods || {}, color, hostile: false }, bot) || ally.addBuff?.(spell.buffName || spell.name, spell.duration || 8, spell.mods || {});
            affected += 1;
          }
          if (!affected) return false;
          this.spawnRing?.(bot.x, bot.y, color, spell.radius || 16);
          this.queueBotSpeechEvent?.(bot, 'buffAlly', { priority: 1 });
          return commitCast();
        }
        if (kind === 'heal') {
          if (!alive(healTarget)) return false;
          const emergency = hpRatio(healTarget) <= 0.36;
          this.healEntity?.(healTarget, spell.heal || power, true, bot, { damageType: 'healing' });
          this.spawnStatusPulse?.(healTarget, color, spell.name);
          this.queueBotSpeechEvent?.(bot, emergency ? 'emergencyHeal' : 'healAlly', { priority: emergency ? 3 : 2 });
          return commitCast();
        }
        if (kind === 'mana') {
          const ally = options.ally || this.findBotManaTarget?.(bot, 0.48, { range: spell.range || 14 }) || bot;
          if (!alive(ally)) return false;
          this.restoreMana?.(ally, power);
          this.spawnStatusPulse?.(ally, color, spell.name || 'Mana');
          return commitCast();
        }
        if (kind === 'aoeHeal') {
          if (!alive(healTarget)) return false;
          const emergency = hpRatio(healTarget) <= 0.36;
          this.healEntity?.(healTarget, spell.heal || power, true, bot, { damageType: 'healing' });
          if (target && isBotHostileCombatActor(this, target)) this.aoeDamage?.(bot.x, bot.y, spell.radius || 4, power, color, bot, damageOptions);
          this.spawnRing?.(bot.x, bot.y, color, spell.radius || 18);
          this.queueBotSpeechEvent?.(bot, emergency ? 'emergencyHeal' : 'healAlly', { priority: emergency ? 3 : 2 });
          return commitCast();
        }
        if (kind === 'aoe' || kind === 'aoeMelee') {
          if (!isBotHostileCombatActor(this, target)) return false;
          this.aoeDamage?.(bot.x, bot.y, spell.radius || 4, power, color, bot, damageOptions);
          this.spawnRing?.(bot.x, bot.y, color, spell.radius || 18);
          return commitCast();
        }
        if (kind === 'aoeDebuff') {
          if (!isBotHostileCombatActor(this, target)) return false;
          this.aoeDamage?.(target.x, target.y, spell.radius || 4.5, power, color, bot, damageOptions);
          for (const enemy of this.enemies || []) if (isBotHostileCombatActor(this, enemy) && dist(enemy, target) <= (spell.radius || 4.5)) this.applyBotHostileSpellStatus?.(bot, enemy, spell, power);
          this.spawnRing?.(target.x, target.y, color, spell.radius || 20);
          this.queueBotSpeechEvent?.(bot, 'controlEnemy', { priority: 2 });
          return commitCast();
        }
        if (kind === 'drain') {
          if (!isBotHostileCombatActor(this, target)) return false;
          this.damageEntity?.(target, power, bot, color, damageOptions);
          this.healEntity?.(bot, Math.floor(power * 0.55), true, bot, { damageType: 'healing' });
          this.spawnBolt?.(bot, target, color);
          if (hpRatio(bot) < 0.62) this.queueBotSpeechEvent?.(bot, 'emergencyHeal', { priority: 3 });
          return commitCast();
        }
        if (kind === 'debuff' || kind === 'boltDot' || kind === 'meleeDebuff') {
          if (!isBotHostileCombatActor(this, target)) return false;
          this.damageEntity?.(target, power, bot, color, damageOptions);
          this.applyBotHostileSpellStatus?.(bot, target, spell, power);
          if (kind !== 'meleeDebuff') this.spawnBolt?.(bot, target, color);
          if (String(bot.className) === 'Druid' || String(bot.className) === 'Enchanter' || String(bot.className) === 'Necromancer') this.queueBotSpeechEvent?.(bot, 'controlEnemy', { priority: 2 });
          return commitCast();
        }
        if (kind === 'melee' || kind === 'dashStrike') {
          if (!isBotHostileCombatActor(this, target)) return false;
          this.playAttackAnimation?.(bot, target, color, 'slash');
          this.damageEntity?.(target, power, bot, color, damageOptions);
          return commitCast();
        }
        if (isBotHostileCombatActor(this, target) && isOffensiveKind(kind)) {
          this.damageEntity?.(target, power, bot, color, damageOptions);
          this.spawnBolt?.(bot, target, color);
          return commitCast();
        }
        return false;
      };

      Game.prototype.botSpellMatchesPriority = function(bot, spell, priority, target = null, profile = BOT_CLASS_AI_PROFILES.default) {
        const kind = String(spell?.kind || '');
        if (!spell) return false;
        if (priority === 'taunt') return false;
        if (priority === 'defensive') return isBuffKind(kind) && hpRatio(bot) < 0.58;
        if (priority === 'emergencyHeal' || priority === 'emergencySong') return isHealKind(kind) && Boolean(this.findBotHealingTarget?.(bot, profile.emergencyThreshold || 0.35, { range: spell.range || 18 }));
        if (priority === 'heal') return isHealKind(kind) && Boolean(this.findBotHealingTarget?.(bot, profile.allyHealThreshold || profile.healThreshold || 0.70, { range: spell.range || 18 }));
        if (priority === 'revive') return kind === 'revive' && Boolean(this.findBotReviveTarget?.(bot, { range: spell.range || 6 }));
        if (priority === 'cure') return kind === 'cleanse' && Boolean(this.findBotCleanseTarget?.(bot, { range: spell.range || 6, tags: spell.removesStatusTags }));
        if (priority === 'root' || priority === 'crowdControl') return ['debuff', 'aoeDebuff'].includes(kind) && target && !hasStatus(target, spell.statusName || spell.name);
        if (priority === 'mana') return kind === 'mana' && Boolean(this.findBotManaTarget?.(bot, 0.48, { range: spell.range || 14 }) || mpRatio(bot) < 0.42);
        if (priority === 'summonPet') return (kind === 'summonPet' || kind === 'boltSummon') && !alive(bot.botPet);
        if (priority === 'petHeal') return kind === 'petHeal' && alive(bot.botPet) && hpRatio(bot.botPet) < 0.72;
        if (priority === 'petBuff') return kind === 'petBuff' && alive(bot.botPet) && this.botNeedsBuff?.(bot.botPet, spell);
        if (priority === 'drainLowSelf') return kind === 'drain' && hpRatio(bot) < 0.78;
        if (priority === 'flank') return kind === 'dashStrike' || kind === 'melee';
        if (priority === 'buff') return kind === 'buff' && (this.getBotFriendlyActors?.(bot, spell.range || spell.radius || 16) || [bot]).some(actor => this.botNeedsBuff?.(actor, spell));
        if (priority === 'groupBuff') return kind === 'groupBuff' && (this.getBotFriendlyActors?.(bot, spell.radius || 18) || [bot]).some(ally => this.botNeedsBuff?.(ally, spell));
        return kind === priority;
      };

      Game.prototype.chooseBotClassSpell = function(bot, profile, target = null) {
        const spells = this.getBotClassSpells?.(bot) || [];
        for (const priority of profile.spellPriority || []) {
          if (priority === 'taunt') continue;
          for (const spell of spells) {
            if (!this.botSpellMatchesPriority?.(bot, spell, priority, target, profile)) continue;
            const ally = spell.kind === 'revive'
              ? this.findBotReviveTarget?.(bot, { range: spell.range || 6 })
              : isHealKind(spell.kind)
              ? this.findBotHealingTarget?.(bot, priority === 'emergencyHeal' ? (profile.emergencyThreshold || 0.35) : (profile.allyHealThreshold || profile.healThreshold || 0.72), { range: spell.range || 18 })
              : spell.kind === 'cleanse'
                ? this.findBotCleanseTarget?.(bot, { range: spell.range || 6, tags: spell.removesStatusTags })
              : spell.kind === 'mana'
                ? this.findBotManaTarget?.(bot, 0.48, { range: spell.range || 14 })
                : spell.kind === 'buff'
                  ? ((this.getBotFriendlyActors?.(bot, spell.range || spell.radius || 16) || [bot]).find(actor => this.botNeedsBuff?.(actor, spell)) || bot)
                  : null;
            if (this.botCanCastSpell?.(bot, spell, target, {
              ally,
              emergency: priority === 'emergencyHeal' || priority === 'emergencySong' || priority === 'drainLowSelf',
              requireLineOfSight: !['aoe','aoeMelee','aoeDebuff','heal','cleanse','revive','buff','groupBuff','mana','petHeal','petBuff','summonPet'].includes(spell.kind)
            })) return { spell, ally, priority };
          }
        }
        return null;
      };

      Game.prototype.botAutoAttack = function(bot, target, profile = BOT_CLASS_AI_PROFILES.default) {
        if (!alive(bot) || !alive(target) || bot.attackAiTimer > 0 || bot.attackTimer > 0) return false;
        if (!isBotHostileCombatActor(this, target)) return false;
        const identity = this.getActorAutoAttackIdentity?.(bot) || DR.getClassCombatIdentity?.(bot.className) || { autoAttackRangeTiles: Number(bot.range || 1.45), combatStyle: 'melee' };
        const ranged = identity.ranged === true || identity.combatStyle === 'rangedCaster' || identity.combatStyle === 'rangedWeapon';
        const attackRange = Math.max(0.75, Number(identity.range || identity.autoAttackRangeTiles || bot.range || 1.45));
        if (dist(bot, target) > attackRange + 0.05) return false;
        const clearCombatLine = this.companionHasClearCombatLine?.(bot, target, { desiredRange: attackRange, requireLineOfSight: ranged, requireMeleeClearance: !ranged }) !== false;
        if (!clearCombatLine) {
          bot._forcePathRecalcAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
          return false;
        }
        this.markBotOwnerCombatTarget?.(bot, target, { cooldown: 4.0 });
        const color = ranged ? '#a8e6ff' : '#ffd18a';
        const raw = Math.max(2, Math.floor((bot.getStat?.('attack') || bot.attack || 8) * (profile.fallbackDamageScale || 0.75) + safeLevel(bot) * 1.25 + Math.random() * 4));
        if (ranged) {
          bot.spellCastAnim = 1;
          bot.setFacingFromDelta?.(target.x - bot.x, target.y - bot.y);
          this.spawnCastCue?.(bot, color, 'Auto Cast');
          if (identity.projectile === true || identity.autoAttackProjectile === true) this.spawnBolt?.(bot, target, color);
        } else {
          this.startActorMeleeAutoAttackSwing?.(bot, target, identity, { forceImpact: true, interval: this.getAutoAttackIntervalSeconds?.(bot, { source: 'bot-auto-attack-impact' }) || 2.5, source: 'bot-auto-attack-impact' });
          this.playSfx?.('attack_slash', { x: bot.x, y: bot.y, volume: 0.34, rate: 0.94 + Math.random() * 0.10, cooldown: 0.055 });
        }
        this.damageEntity?.(target, raw, bot, color, { damageType: identity.damageType || identity.autoAttackDamageType || (ranged ? 'magic' : 'physical'), canCrit: true });
        if (BotRoles.isTankRole?.(profile.role)) this.addThreat?.(target, bot, raw * 1.7, { reason: 'bot-class-tank-auto', flatBonus: 10 });
        bot.attackAiTimer = this.getAutoAttackIntervalSeconds
          ? this.getAutoAttackIntervalSeconds(bot, { source: 'bot-auto-attack' })
          : 2.5;
        bot.attackTimer = bot.attackAiTimer * 0.65;
        return true;
      };

      Game.prototype.updateBotAI = function(bot, nowMs = performance.now(), dt = 0) {
        if (!alive(bot)) return false;
        this.ensureBotClassRuntime?.(bot);
        const personality = this.botPersonalityProfile?.(bot) || BOT_PERSONALITY_TYPES.steady;
        const profile = this.getBotPersonalityAiProfile?.(bot) || BOT_CLASS_AI_PROFILES.default;
        this.updateBotSpellCooldowns?.(bot, dt);
        bot.role = profile.role || bot.role;
        bot.range = Math.max(1.1, Number(profile.preferredRange || bot.range || 1.4));

        if (this.updateBotPendingCast?.(bot, dt)) return true;
        if (this.isBotTemporarilyBusy?.(bot)) return false;

        const grouped = this.isBotInParty?.(bot);
        const playerMoving = grouped && this.isPlayerActivelyMoving?.();
        let target = bot.selectTarget?.(this);
        if (grouped && target?.alive && this.player && dist(target, this.player) > 12.5) target = null;
        if (target?.alive && isBotHostileCombatActor(this, target)) {
          bot.target = target;
          bot.targetId = target.id ?? null;
          bot.combatTargetId = target.id ?? null;
        } else {
          bot.target = null;
          bot.targetId = null;
          bot.combatTargetId = null;
        }
        bot.currentTargetName = target?.alive ? (target.name || target.id || 'Target') : '';
        const inCombat = Boolean(target && target.alive) || this.isEntityInCombat?.(bot);
        if (inCombat && !bot._speechWasInCombat) {
          this.queueBotSpeechEvent?.(bot, this.botEnemySpeechEvent?.(target) || 'combatStart', { priority: target?.dungeonBoss || target?.boss ? 3 : target?.elite ? 2 : 1 });
        }
        bot._speechWasInCombat = inCombat;
        if (target?.alive && String(bot._speechTargetId || '') !== String(target.id || '')) {
          bot._speechTargetId = target.id || '';
          const threatEvent = this.botEnemySpeechEvent?.(target) || 'combatStart';
          if (threatEvent !== 'combatStart') this.maybeQueuePartyBanter?.(threatEvent, { priority: threatEvent === 'bossLikeEnemySeen' ? 3 : 2, preferredClass: BotRoles.isTankRole?.(profile.role) ? bot.className : '' });
          const corrupted = /corrupt|ashroot|deadroot|gloom|blight/i.test(String(target.name || target.baseType?.name || target.id || ''));
          if (corrupted && String(bot.className) === 'Druid') this.queueBotSpeechEvent?.(bot, 'corruptedEnemy', { priority: 2 });
        } else if (!target) bot._speechTargetId = '';
        const healthRatio = Number(bot.hp || 0) / Math.max(1, Number(bot.maxHp || 1));
        const manaRatio = Number(bot.maxMana || 0) > 0 ? Number(bot.mana || 0) / Math.max(1, Number(bot.maxMana || 1)) : 1;
        if (healthRatio <= 0.26 + (1 - Number(personality.riskTolerance || 0.45)) * 0.08) this.queueBotSpeechEvent?.(bot, 'lowHealth', { priority: 3 });
        else if (manaRatio <= 0.18) this.queueBotSpeechEvent?.(bot, 'lowMana', { priority: 2 });
        const hurtAllies = this.getBotFriendlyActors?.(bot, 18)?.filter(ally => alive(ally) && hpRatio(ally) < 0.52) || [];
        if (hurtAllies.length >= 3 && (BotRoles.isHealingSupportRole?.(profile.role) || BotRoles.isSupportRole?.(profile.role))) {
          this.maybeQueuePartyBanter?.('manyAlliesHurt', { priority: 3, preferredClass: bot.className });
        }
        if (alive(bot.botPet) && hpRatio(bot.botPet) < 0.34) this.queueBotSpeechEvent?.(bot, 'petLowHealth', { priority: 2 });
        if (target?.alive && BotRoles.isMeleeDpsRole?.(profile.role) && !BotRoles.isTankRole?.(profile.role) && healthRatio < 0.22 + (1 - Number(personality.riskTolerance || 0.45)) * 0.08) {
          bot.botState = 'class-defensive-reposition';
          bot.currentActivityLabel = 'Recovering';
          const slot = Math.max(0, (this.botPlayers || []).filter(member => this.isBotInParty?.(member)).indexOf(bot));
          const offset = this.partyBotFormationOffset?.(bot, slot) || { x: -1.1, y: 0.8 };
          this.moveCompanionToPoint?.(bot, this.player.x + offset.x, this.player.y + offset.y, dt, { mode: 'bot-defensive-reposition', stopRange: 0.65, recalcMs: 420, allowPartialPath: true });
          return true;
        }
        if (this.actorIsMeditating?.(bot)) {
          if (inCombat || playerMoving) {
            this.cancelMeditation?.(bot, inCombat ? 'combat' : 'party moving', { silent: true });
            this.queueBotSpeechEvent?.(bot, 'stopRecoveryToFollow', { priority: 2 });
            if (playerMoving) {
              this.commandBotPet?.(bot, null);
              this.markBotOwnerCombatTarget?.(bot, null, { clear: true });
              return bot.followParty?.(this, dt) === true;
            }
          } else {
            this.lockMeditatingActorMovement?.(bot);
            bot.currentActivityLabel = 'Meditating';
            this.updateMeditationForEntity?.(bot, dt, { silent: true });
            return true;
          }
        }

        const healFirst = BotRoles.isHealingSupportRole?.(profile.role) || ['healer', 'hybrid_healer_damage', 'support_control'].includes(profile.role);
        if (!playerMoving && this.updateBotReviveBehavior?.(bot, profile, dt)) return true;
        if (healFirst && !playerMoving) {
          const emergency = this.chooseBotClassSpell?.(bot, { ...profile, spellPriority: ['revive', 'emergencyHeal', 'cure', 'heal', 'emergencySong'] }, target);
          if (emergency && this.castBotClassSpell?.(bot, emergency.spell, target, { ally: emergency.ally, emergency: true, allowLowMana: true })) {
            bot.botState = 'class-healing'; bot.currentActivityLabel = emergency.spell.name || 'Healing'; return true;
          }
        }

        if (!inCombat && bot.restIfNeeded?.(this, dt)) return true;
        if (playerMoving) {
          this.commandBotPet?.(bot, null);
          this.markBotOwnerCombatTarget?.(bot, null, { clear: true });
          return bot.followParty?.(this, dt) === true;
        }

        // Pre-combat support/buff/pet prep while safe.
        if (!target) {
          this.commandBotPet?.(bot, null);
          const prep = this.chooseBotClassSpell?.(bot, { ...profile, spellPriority: ['summonPet', 'groupBuff', 'buff', 'mana'] }, null);
          if (prep && this.castBotClassSpell?.(bot, prep.spell, null, { ally: prep.ally })) {
            bot.botState = 'class-prep'; bot.currentActivityLabel = prep.spell.name || 'Preparing'; return true;
          }
          bot.currentTargetName = '';
          if (bot.followParty?.(this, dt)) return true;
          bot.updateRoam?.(this, dt);
          return true;
        }

        this.markBotOwnerCombatTarget?.(bot, target, { cooldown: 4.75 });
        this.markBotSquadCombat?.(bot, target);
        this.markPartyCombatEngaged?.(target, bot, { cooldown: 4.75 });
        target.aggro = true;
        const baseThreat = BotRoles.isTankRole?.(profile.role) ? 26 : BotRoles.isSupportRole?.(profile.role) ? 4 : 8;
        this.addThreat?.(target, bot, baseThreat, { reason: 'bot-class-ai-engage', actorCombatSeconds: 4.0, combatSeconds: 5.0 });
        if (BotRoles.isTankRole?.(profile.role)) {
          const threatTarget = this.getThreatTarget?.(target);
          if (threatTarget && threatTarget !== bot && (bot.supportCooldown || 0) <= 0) {
            this.addThreat?.(target, bot, 42, { reason: 'bot-class-taunt', taunt: true, tauntBonus: 32, actorCombatSeconds: 5.5, combatSeconds: 6.0 });
            this.spawnCastCue?.(bot, '#ffd18a', 'Taunt');
            this.queueBotSpeechEvent?.(bot, 'protectAlly', { priority: 3 });
            bot.supportCooldown = 5.2;
          }
        }

        if (String(bot.className) === 'Enchanter') {
          const nearbyThreats = (this.enemies || []).filter(enemy => isBotHostileCombatActor(this, enemy) && dist(enemy, bot) <= 9 && (enemy.aggro || Number(enemy.combatCooldown || 0) > 0));
          if (nearbyThreats.length >= 2) this.maybeQueuePartyBanter?.('addWarning', { priority: 3, preferredClass: 'Enchanter' });
        }

        this.commandBotPet?.(bot, target);

        const preferredRange = Number(profile.preferredRange || bot.range || 1.4);
        const d = dist(bot, target);
        const blockedCombatLine = this.companionHasClearCombatLine?.(bot, target, { desiredRange: preferredRange, requireLineOfSight: preferredRange > 2.25, requireMeleeClearance: preferredRange <= 2.25 }) === false;
        const needPosition = blockedCombatLine || d > preferredRange + 0.45 || (preferredRange > 2.25 && d < preferredRange - 1.25);
        if (needPosition) {
          bot.botState = preferredRange > 2.25 ? 'class-positioning-ranged' : 'class-positioning-melee';
          bot.currentActivityLabel = profile.activity || 'Positioning';
          this.moveCompanionToCombatPosition?.(bot, target, dt, { role: profile.role, desiredRange: preferredRange, stopRange: preferredRange > 2.25 ? 0.62 : 0.46, requireLineOfSight: preferredRange > 2.25, recalcMs: preferredRange > 2.25 ? 720 : 560, maxRange: 64, maxNodes: 1800, allowPartialPath: true });
          return true;
        }

        const selected = this.chooseBotClassSpell?.(bot, profile, target);
        if (selected && this.castBotClassSpell?.(bot, selected.spell, target, {
          ally: selected.ally,
          emergency: selected.priority === 'emergencyHeal' || selected.priority === 'emergencySong' || selected.priority === 'drainLowSelf',
          requireLineOfSight: preferredRange > 2.25
        })) {
          bot.botState = 'class-casting';
          bot.currentActivityLabel = selected.spell.name || profile.activity || 'Casting';
          return true;
        }

        bot.botState = BotRoles.isTankRole?.(profile.role) ? 'class-tanking' : preferredRange > 2.25 ? 'class-ranged-assist' : 'class-melee-assist';
        bot.currentActivityLabel = profile.activity || 'Assisting';
        this.applyCompanionSeparation?.(bot, { range: preferredRange > 2.25 ? 0.76 : 0.58, strength: preferredRange > 2.25 ? 0.20 : 0.14 });
        bot.setFacingFromDelta?.(target.x - bot.x, target.y - bot.y);
        this.botAutoAttack?.(bot, target, profile);
        return true;
      };

      Game.prototype.auditClassBotAiStability = function() {
        const classNames = this.botPlayableClassNames?.() || Object.keys(BOT_TEMPLATE_DEFS).map(key => BOT_TEMPLATE_DEFS[key].className);
        const missingProfiles = [];
        const missingSpellbooks = [];
        const missingCooldowns = [];
        const castCoverage = [];
        for (const className of classNames) {
          const key = classKey(className);
          const profile = BOT_CLASS_AI_PROFILES[key];
          if (!profile) missingProfiles.push(className);
          const spells = (DR.CLASS_SPELL_BOOK?.[properClassName(className)] || []);
          if (!spells.length) missingSpellbooks.push(className);
          for (const spell of spells) {
            if (!Number.isFinite(Number(spell.cooldown))) missingCooldowns.push(`${className}:${spell.name || 'spell'}`);
            castCoverage.push({ className, spell: spell.name || '', kind: spell.kind || '', castSeconds: resolveSpellBaseCastSeconds(spell) });
          }
        }
        const activeBots = (this.botPlayers || []).filter(bot => bot?.kind === 'bot');
        return {
          ok: !missingProfiles.length && !missingSpellbooks.length && !missingCooldowns.length && castCoverage.length > 0,
          classCount: classNames.length,
          activeBotCount: activeBots.length,
          missingProfiles,
          missingSpellbooks,
          missingCooldowns,
          castCoverageCount: castCoverage.length,
          pendingCastCount: activeBots.filter(bot => bot.botPendingCast).length,
          manaReserveRoles: Object.keys(BOT_CLASS_AI_BALANCE.manaReserve)
        };
      };

      Game.prototype.defaultBotSpawnAnchor = function() {
        const spirit = this.findDreamSpiritRespawnPoint?.();
        if (spirit) return { x: spirit.x + 2.0, y: spirit.y + 1.2 };
        return { x: (DR.CONFIG?.START_X || 20) + 4.5, y: (DR.CONFIG?.START_Y || 20) + 3.0 };
      };

      Game.prototype.makeBotProfile = function(seed = {}, index = 0) {
        const className = properClassName(seed.className || BOT_CLASSES[index % BOT_CLASSES.length] || 'Fighter');
        const typeLabel = seed.botTypeLabel || seed.displayTypeLabel || botTypeLabelForClass(className);
        const name = isPlaceholderBotName(seed.name, className)
          ? pickBotDisplayName(seed, className, index, new Set((this.botPlayers || []).map(bot => String(bot?.name || '').toLowerCase()).filter(Boolean)))
          : String(seed.name || '').trim();
        return {
          id: seed.id || `bot-${String(name).toLowerCase()}-${Date.now().toString(36)}-${index}`,
          name,
          botTypeLabel: typeLabel,
          displayTypeLabel: typeLabel,
          className,
          role: seed.role || null,
          botClassAiProfileId: seed.botClassAiProfileId || classKey(className),
          level: Math.max(1, Math.floor(Number(seed.level) || Number(this.player?.level) || 1)),
          xp: Math.max(0, Math.floor(Number(seed.xp) || 0)),
          nextXp: seed.nextXp,
          gearScore: seed.gearScore,
          questName: seed.questName || 'Explore Dark Woods',
          questProgress: seed.questProgress || 0,
          questRequired: seed.questRequired || 3,
          behaviorGoal: seed.behaviorGoal || seed.goal || BOT_SQUAD_GOALS[index % BOT_SQUAD_GOALS.length],
          squadId: seed.squadId || null,
          appearanceSeed: seed.appearanceSeed,
          hairStyle: seed.hairStyle,
          hairColor: seed.hairColor,
          faceStyle: seed.faceStyle,
          skinTone: seed.skinTone,
          clothesPrimary: seed.clothesPrimary,
          clothesSecondary: seed.clothesSecondary,
          currentQuestId: seed.currentQuestId || seed.questId || null,
          questStage: seed.questStage || 'active',
          questTaskProgress: seed.questTaskProgress,
          campSupply: seed.campSupply,
          campVisitCooldown: seed.campVisitCooldown,
          dungeonIntent: seed.dungeonIntent,
          dungeonRunTimer: seed.dungeonRunTimer,
          dungeonCooldown: seed.dungeonCooldown,
          dungeonCompletions: seed.dungeonCompletions,
          completedQuestIds: seed.completedQuestIds,
          gold: seed.gold,
          junkValue: seed.junkValue,
          upgradeFragments: seed.upgradeFragments,
          reputation: seed.reputation,
          repairDebt: seed.repairDebt,
          socialMood: seed.socialMood,
          currentActivityLabel: seed.currentActivityLabel,
          lastSocialLine: seed.lastSocialLine,
          personalityId: seed.personalityId || '',
          socialCooldown: seed.socialCooldown,
          economyTimer: seed.economyTimer,
          botInventory: seed.botInventory,
          botEquipment: seed.botEquipment,
          lootTradeCooldown: seed.lootTradeCooldown,
          tradeRequestCooldown: seed.tradeRequestCooldown,
          meditationIntent: seed.meditationIntent,
          worldPresenceTimer: seed.worldPresenceTimer,
          actorAiAccumulator: seed.actorAiAccumulator,
          actorAiInterval: seed.actorAiInterval,
          lastActorAiSkipReason: seed.lastActorAiSkipReason,
          lastStableX: seed.lastStableX,
          lastStableY: seed.lastStableY,
          stuckTimer: seed.stuckTimer,
          botSpellCooldowns: seed.botSpellCooldowns,
          botLastCastName: seed.botLastCastName,
          botPetId: seed.botPetId,
          advancedRoutineAccumulator: seed.advancedRoutineAccumulator,
          advancedRoutineInterval: seed.advancedRoutineInterval,
          zone: seed.zone || this.currentZone || 'overworld'
        };
      };

      Game.prototype.findBotSpawnPoint = function(anchor = null, offset = null, actorSeed = null) {
        const base = anchor || this.defaultBotSpawnAnchor?.() || { x: DR.CONFIG.START_X + 0.5, y: DR.CONFIG.START_Y + 0.5 };
        const ox = Number(offset?.x || 0);
        const oy = Number(offset?.y || 0);
        const wanted = { x: Number(base.x || 0) + ox, y: Number(base.y || 0) + oy };
        const probeActor = actorSeed || { kind: 'bot' };
        if (this.isWalkable?.(wanted.x, wanted.y, probeActor)) return wanted;
        const nearest = this.findNearestCompanionWalkablePoint?.(wanted.x, wanted.y, probeActor, 7)
          || this.findNearestCompanionWalkablePoint?.(Number(base.x || 0), Number(base.y || 0), probeActor, 9)
          || this.findValidBotRecoveryPoint?.(probeActor, 'spawn recovery');
        if (nearest && Number.isFinite(Number(nearest.x)) && Number.isFinite(Number(nearest.y))) return { x: nearest.x, y: nearest.y };
        const bounds = this.botPlayableBounds?.() || { minX: 0.5, minY: 0.5, maxX: CONFIG.MAP_SIZE - 1.5, maxY: CONFIG.MAP_SIZE - 1.5 };
        const clamped = { x: clampNumber(wanted.x, bounds.minX, bounds.maxX, DR.CONFIG.START_X + 0.5), y: clampNumber(wanted.y, bounds.minY, bounds.maxY, DR.CONFIG.START_Y + 0.5) };
        return this.isWalkable?.(clamped.x, clamped.y, probeActor) ? clamped : { x: DR.CONFIG.START_X + 0.5, y: DR.CONFIG.START_Y + 0.5 };
      };

      Game.prototype.ensureClassBotRoster = function(options = {}) {
        if (!BotPlayer || !this.started || !this.player) return [];
        this.normalizeBotState?.();
        const existingByClass = new Set((this.botPlayers || [])
          .map(bot => this.resolveBotClassId?.(bot))
          .filter(Boolean));
        const classNames = this.botPlayableClassNames?.() || [];
        const spawned = [];
        const anchor = this.defaultBotSpawnAnchor?.() || this.player;
        classNames.forEach((className, index) => {
          const key = classKey(className);
          if (!key || existingByClass.has(key)) return;
          const profile = (BOT_START_PROFILES.find(entry => classKey(entry.className) === key) || (this.getBotTemplateMap?.() || {})[key]);
          if (!profile) return;
          const angle = index * (Math.PI * 2 / Math.max(1, classNames.length));
          const ringOffset = profile.offset || { x: Math.cos(angle) * 4.2, y: Math.sin(angle) * 4.2 };
          const bot = this.spawnBotPlayer?.({ ...profile, id: profile.id || `class-roster-${key}`, offset: ringOffset }, { anchor, index });
          if (bot) {
            spawned.push(bot);
            existingByClass.add(key);
          }
        });
        if (spawned.length) {
          this.botHudDirty = true;
          this.partyPanelDirty = true;
          if (!options.silent) this.logParty?.(`Added ${spawned.length} missing class AI bot${spawned.length === 1 ? '' : 's'} to the world roster.`);
        }
        return spawned;
      };

      Game.prototype.spawnBotPlayer = function(profile = {}, options = {}) {
        if (!BotPlayer) return null;
        this.normalizeBotState?.();
        const anchor = options.anchor || this.defaultBotSpawnAnchor?.() || { x: DR.CONFIG.START_X + 0.5, y: DR.CONFIG.START_Y + 0.5 };
        const offset = profile.offset || { x: Math.random() * 4 - 2, y: Math.random() * 4 - 2 };
        const spawnPoint = this.findBotSpawnPoint?.(anchor, offset, { kind: 'bot' }) || { x: anchor.x + Number(offset.x || 0), y: anchor.y + Number(offset.y || 0) };
        let x = Number.isFinite(Number(profile.x)) ? Number(profile.x) : spawnPoint.x;
        let y = Number.isFinite(Number(profile.y)) ? Number(profile.y) : spawnPoint.y;
        const probe = { kind: 'bot', x, y, zone: profile.zone || this.currentZone || 'overworld' };
        const explicitValid = Number.isFinite(x) && Number.isFinite(y) && this.botIsInsidePlayableBounds?.(probe, 0.25) && (profile.zone && profile.zone !== this.currentZone || this.isWalkable?.(x, y, probe));
        if (!explicitValid) {
          x = spawnPoint.x;
          y = spawnPoint.y;
        }
        const bot = new BotPlayer(this.makeBotProfile(profile, this.botPlayers.length), x, y);
        this.ensureBotDisplayIdentity?.(bot, { index: this.botPlayers.length, id: profile.id });
        bot.roamAnchor = profile.roamAnchor || { x, y };
        bot.zone = profile.zone || this.currentZone || 'overworld';
        if (!this.botHasValidWorldPresence?.(bot, { sameZone: bot.zone === (this.currentZone || 'overworld'), requireWalkable: bot.zone === (this.currentZone || 'overworld') })) {
          if (!this.repairInvalidBotPosition?.(bot, 'spawn validation')) return null;
        }
        this.seedBotRoutine?.(bot, profile);
        this.botRoutineDirty = true;
        this.botPlayers.push(bot);
        if (!this.entities.includes(bot)) this.entities.push(bot);
        this.updateBotTalentSpec?.(bot);   // V0.17.74 Talents: spec label at level 5+
        this.botHudDirty = true;
        return bot;
      };

      Game.prototype.ensureBotPlayers = function(options = {}) {
        if (!this.started || !this.player) return [];
        this.normalizeBotState?.();
        this.cleanupInvalidBotPlayers?.('ensure bot roster', { force: true, silent: true, repair: true });
        const existingIds = new Set(this.botPlayers.map(bot => String(bot.botId || bot.remoteId || bot.id || '')));
        BOT_START_PROFILES.forEach((profile, index) => {
          if (!existingIds.has(profile.id)) this.spawnBotPlayer(profile, { index });
        });
        if (options.ensureClassRoster !== false) this.ensureClassBotRoster?.({ silent: true });
        this.botPlayers.forEach(bot => this.updateBotTalentSpec?.(bot));   // V0.17.74 Talents: refresh spec labels (covers loaded bots)
        this.ensureBotSquads?.();
        if (!options.silent && !this.botIntroLogged) {
          this.botIntroLogged = true;
          this.logParty?.('Bot players are active: they roam, fight, heal, level up, and can be invited to your party.');
        }
        return this.botPlayers;
      };

      Game.prototype.botCampAnchor = function() {
        const spirit = this.findDreamSpiritRespawnPoint?.();
        if (spirit) return { x: Number(spirit.x) + 1.6, y: Number(spirit.y) + 1.0 };
        return { x: Number(DR.CONFIG?.START_X || 100) + 0.5, y: Number(DR.CONFIG?.START_Y || 100) + 0.5 };
      };

      Game.prototype.botDungeonAnchor = function(plan = null) {
        const base = this.botCampAnchor?.() || { x: 100, y: 100 };
        const offset = plan?.entranceOffset || { x: 22, y: 28 };
        return { x: base.x + Number(offset.x || 0), y: base.y + Number(offset.y || 0) };
      };

      Game.prototype.botCampRadius = function() {
        return 7.25;
      };

      Game.prototype.isBotInsideCamp = function(bot, extra = 0) {
        const camp = this.botCampAnchor?.();
        return Boolean(bot && camp && dist(bot, camp) <= this.botCampRadius() + Number(extra || 0));
      };

      Game.prototype.botShouldForceAdventure = function(bot) {
        if (!bot || this.isBotInParty?.(bot) || this.isBotTemporarilyBusy?.(bot)) return false;
        if (bot.questStage === 'turn-in' || this.shouldBotVisitCamp?.(bot)) return false;
        return this.isBotInsideCamp?.(bot, 0.25) === true;
      };

      Game.prototype.botFindQuestEnemy = function(bot, options = {}) {
        if (!bot) return null;
        const camp = this.botCampAnchor?.() || bot.roamAnchor || { x: bot.x, y: bot.y };
        const maxDistance = Number.isFinite(Number(options.maxDistance)) ? Number(options.maxDistance) : 130;
        const minCampDistance = Number.isFinite(Number(options.minCampDistance)) ? Number(options.minCampDistance) : Math.max(10, this.botCampRadius?.() || 8.0);
        let best = null;
        let bestScore = Infinity;
        for (const enemy of (this.queryEnemiesNearEntity?.(bot, maxDistance + 2) || this.enemies || [])) {
          if (!enemy?.alive) continue;
          if (!this.enemyMatchesBotQuest?.(enemy, bot)) continue;
          const fromBot = dist(bot, enemy);
          if (fromBot > maxDistance) continue;
          const fromCamp = dist(enemy, camp);
          if (fromCamp < minCampDistance) continue;
          const levelDelta = Math.abs(Number(enemy.level || 1) - safeLevel(bot));
          const alreadyInCombat = enemy.aggro || enemy.hp < enemy.maxHp || Number(enemy.combatCooldown || 0) > 0;
          const routeScore = fromBot * 0.72 + fromCamp * 0.08;
          const score = routeScore + levelDelta * 2.0 + (enemy.elite ? 4.5 : 0) + (alreadyInCombat ? -3.5 : 0);
          if (score < bestScore) { best = enemy; bestScore = score; }
        }
        return best;
      };


      Game.prototype.botCurrentQuestPlan = function(bot) {
        if (!bot?.currentQuestId) this.seedBotRoutine?.(bot, {});
        return BOT_QUEST_PLANS.find(entry => entry.id === bot?.currentQuestId) || this.chooseBotQuestPlan?.(bot) || BOT_QUEST_PLANS[0];
      };

      Game.prototype.enemyMatchesBotQuest = function(enemy, bot) {
        if (!enemy?.alive || !bot) return false;
        const plan = this.botCurrentQuestPlan?.(bot);
        if (!plan || plan.task !== 'kill') return true;
        const target = lower(plan.target);
        if (!target || target === 'any_dark_woods_mob') return true;
        const text = lower(`${enemy.name || ''} ${enemy.id || ''} ${enemy.type || ''} ${enemy.kind || ''}`);
        return text.includes(target);
      };

      Game.prototype.resolveBotAdventureAnchor = function(bot) {
        if (!bot || this.isBotInParty?.(bot)) return null;
        const camp = this.botCampAnchor?.() || bot.roamAnchor || { x: bot.x, y: bot.y };
        if (bot.questStage === 'turn-in' || this.shouldBotVisitCamp?.(bot)) return camp;
        const autonomousPartyAnchor = this.resolveAutonomousBotPartyAdventureAnchor?.(bot);
        if (autonomousPartyAnchor) return autonomousPartyAnchor;
        const plan = this.botCurrentQuestPlan?.(bot);
        if (plan?.task === 'kill') {
          const committed = bot.adventureTargetId || bot.objectiveEnemyId;
          const committedEnemy = committed ? (this.enemies || []).find(enemy => enemy?.alive && enemy.id === committed) : null;
          if (committedEnemy && this.enemyMatchesBotQuest?.(committedEnemy, bot) && dist(committedEnemy, camp) >= 7.5) {
            bot.objectiveEnemyId = committedEnemy.id;
            bot.adventureTargetId = committedEnemy.id;
            return { x: committedEnemy.x, y: committedEnemy.y, enemyId: committedEnemy.id, type: 'hunt' };
          }
          const best = this.botFindQuestEnemy?.(bot, { maxDistance: 120, minCampDistance: this.botCampRadius?.() || 7.5 });
          if (best) {
            bot.objectiveEnemyId = best.id;
            bot.adventureTargetId = best.id;
            return { x: best.x, y: best.y, enemyId: best.id, type: 'hunt' };
          }
        }
        const level = safeLevel(bot);
        const spread = 14 + Math.min(22, level * 2.75);
        const goal = String(bot.behaviorGoal || '').toLowerCase();
        const planKey = String(plan?.id || '').toLowerCase();
        let offset = { x: spread, y: 11 + level };
        if (goal.includes('road')) offset = { x: 20 + level, y: -10 - level * 0.45 };
        else if (goal.includes('dungeon') || planKey.includes('ashroot')) offset = { x: 28 + level, y: 24 + level };
        else if (planKey.includes('wisp')) offset = { x: -22 - level, y: 19 + level };
        else if (planKey.includes('briar')) offset = { x: 22 + level, y: 8 + level * 0.5 };
        else if (plan?.task === 'gather') offset = { x: -15 - level * 0.6, y: 14 + level * 0.8 };
        const anchor = { x: camp.x + offset.x, y: camp.y + offset.y, type: plan?.task === 'gather' ? 'gather' : 'quest' };
        bot.adventureAnchor = anchor;
        return anchor;
      };

      Game.prototype.availableBotQuestPlans = function(bot) {
        const level = safeLevel(bot);
        const completed = new Set(bot?.completedQuestIds || []);
        return BOT_QUEST_PLANS.filter(plan => level >= plan.minLevel && level <= plan.maxLevel && (!completed.has(plan.id) || plan.task === 'gather'));
      };

      Game.prototype.chooseBotQuestPlan = function(bot) {
        const plans = this.availableBotQuestPlans?.(bot) || [];
        if (!plans.length) return BOT_QUEST_PLANS[0];
        const goal = bot?.behaviorGoal || 'questing';
        return plans.find(plan => (plan.preferredGoals || []).includes(goal)) || plans[0];
      };

      Game.prototype.seedBotRoutine = function(bot, seed = {}) {
        if (!bot) return false;
        const plan = bot.currentQuestId ? (BOT_QUEST_PLANS.find(entry => entry.id === bot.currentQuestId) || null) : this.chooseBotQuestPlan?.(bot);
        if (plan && !bot.currentQuestId) {
          bot.currentQuestId = plan.id;
          bot.questName = plan.name;
          bot.questRequired = Math.max(1, Number(plan.required || bot.questRequired || 3));
          bot.questProgress = clampNumber(bot.questProgress, 0, bot.questRequired, 0);
          bot.questStage = 'active';
          bot.questTaskProgress = bot.questTaskProgress && typeof bot.questTaskProgress === 'object' ? bot.questTaskProgress : {};
        }
        bot.campSupply = clampNumber(seed.campSupply ?? bot.campSupply, 0, 100, 62 + Math.random() * 22);
        bot.campVisitCooldown = Math.max(0, Number(seed.campVisitCooldown ?? bot.campVisitCooldown ?? (6 + Math.random() * 8)));
        bot.dungeonCooldown = Math.max(0, Number(seed.dungeonCooldown ?? bot.dungeonCooldown ?? (18 + Math.random() * 18)));
        bot.dungeonIntent = seed.dungeonIntent || bot.dungeonIntent || null;
        bot.dungeonRunTimer = Math.max(0, Number(seed.dungeonRunTimer ?? bot.dungeonRunTimer ?? 0));
        bot.dungeonCompletions = Math.max(0, Math.floor(Number(seed.dungeonCompletions ?? bot.dungeonCompletions ?? 0)));
        bot.completedQuestIds = Array.isArray(seed.completedQuestIds) ? [...seed.completedQuestIds] : (Array.isArray(bot.completedQuestIds) ? bot.completedQuestIds : []);
        bot.gold = Math.max(0, Math.floor(Number(seed.gold ?? bot.gold ?? 12)));
        bot.junkValue = Math.max(0, Math.floor(Number(seed.junkValue ?? bot.junkValue ?? 0)));
        bot.upgradeFragments = Math.max(0, Math.floor(Number(seed.upgradeFragments ?? bot.upgradeFragments ?? 0)));
        bot.reputation = Math.max(0, Math.floor(Number(seed.reputation ?? bot.reputation ?? 0)));
        bot.repairDebt = Math.max(0, Math.floor(Number(seed.repairDebt ?? bot.repairDebt ?? 0)));
        bot.socialMood = seed.socialMood || bot.socialMood || 'focused';
        bot.currentActivityLabel = seed.currentActivityLabel || bot.currentActivityLabel || 'Questing';
        bot.lastSocialLine = seed.lastSocialLine || bot.lastSocialLine || '';
        this.ensureBotPersonality?.(bot, seed.personalityId || bot.personalityId);
        bot.speechBubble = null;
        bot.speechCooldownUntil = 0;
        bot.speechEventCooldowns = {};
        bot.socialCooldown = Math.max(0, Number(seed.socialCooldown ?? bot.socialCooldown ?? (6 + Math.random() * 10)));
        bot.economyTimer = Math.max(0, Number(seed.economyTimer ?? bot.economyTimer ?? (2 + Math.random() * 4)));
        bot.botInventory = Array.isArray(seed.botInventory) ? seed.botInventory.filter(Boolean) : (Array.isArray(bot.botInventory) ? bot.botInventory.filter(Boolean) : []);
        bot.botEquipment = seed.botEquipment && typeof seed.botEquipment === 'object' ? { ...seed.botEquipment } : (bot.botEquipment && typeof bot.botEquipment === 'object' ? bot.botEquipment : {});
        bot.lootTradeCooldown = Math.max(0, Number(seed.lootTradeCooldown ?? bot.lootTradeCooldown ?? 0));
        bot.tradeRequestCooldown = Math.max(0, Number(seed.tradeRequestCooldown ?? bot.tradeRequestCooldown ?? 0));
        bot.meditationIntent = seed.meditationIntent || bot.meditationIntent || '';
        bot.adventureTargetId = seed.adventureTargetId || bot.adventureTargetId || bot.objectiveEnemyId || null;
        bot.objectiveEnemyId = seed.objectiveEnemyId || bot.objectiveEnemyId || bot.adventureTargetId || null;
        bot.adventureAnchor = seed.adventureAnchor && typeof seed.adventureAnchor === 'object' ? { ...seed.adventureAnchor } : (bot.adventureAnchor && typeof bot.adventureAnchor === 'object' ? bot.adventureAnchor : null);
        bot.adventureCommitTimer = Math.max(0, Number(seed.adventureCommitTimer ?? bot.adventureCommitTimer ?? 0));
        bot.campExitTimer = Math.max(0, Number(seed.campExitTimer ?? bot.campExitTimer ?? 0));
        this.recalculateBotGearScore?.(bot);
        bot.worldPresenceTimer = Math.max(0, Number(seed.worldPresenceTimer ?? bot.worldPresenceTimer ?? Math.random() * 1.5));
        return true;
      };

      Game.prototype.isBotTemporarilyBusy = function(bot) {
        if (!bot) return false;
        return Boolean(bot.dungeonRunTimer > 0 || bot.botState === 'in-dungeon' || bot.botState === 'turning-in-quest');
      };

      Game.prototype.shouldBotVisitCamp = function(bot) {
        if (!bot || this.isBotInParty?.(bot)) return false;
        if (this.isBotTemporarilyBusy?.(bot)) return false;
        const lowHealth = bot.maxHp > 0 && bot.hp / bot.maxHp < 0.55;
        const lowMana = bot.maxMana > 0 && bot.mana / bot.maxMana < 0.35;
        const lowSupply = Number(bot.campSupply || 0) < 22;
        const readyToTurnIn = bot.questStage === 'turn-in';
        return Boolean((lowHealth || lowMana || lowSupply || readyToTurnIn) && Number(bot.campVisitCooldown || 0) <= 0);
      };

      Game.prototype.routeBotTowardCamp = function(bot, dt) {
        const anchor = this.botCampAnchor?.();
        if (!bot || !anchor) return false;
        const d = dist(bot, anchor);
        bot.botState = bot.questStage === 'turn-in' ? 'returning-to-camp-turn-in' : 'returning-to-camp';
        bot.behaviorGoal = 'camp-supply-run';
        if (d > 1.35) {
          if (this.moveCompanionToPoint) this.moveCompanionToPoint(bot, anchor.x, anchor.y, dt, { mode: 'bot-return-camp', stopRange: 0.75, recalcMs: 760, allowPartialPath: true });
          else bot.moveToward?.(this, anchor.x, anchor.y, dt, 0.75);
          return true;
        }
        return this.completeBotCampVisit?.(bot);
      };

      Game.prototype.completeBotCampVisit = function(bot) {
        if (!bot) return false;
        if (bot.questStage === 'turn-in') {
          const plan = BOT_QUEST_PLANS.find(entry => entry.id === bot.currentQuestId) || this.chooseBotQuestPlan?.(bot);
          if (plan) {
            bot.completedQuestIds = Array.isArray(bot.completedQuestIds) ? bot.completedQuestIds : [];
            if (!bot.completedQuestIds.includes(plan.id) && plan.task !== 'gather') bot.completedQuestIds.push(plan.id);
            this.awardBotXp?.(bot, plan.xp || 40, { name: `${plan.name} Turn-In` });
            bot.gearScore = Math.max(0, Number(bot.gearScore || 0) + Number(plan.gear || 1));
            bot.updateBaseStatsFromLevel?.();
            this.logParty?.(`${bot.name} turned in ${plan.name} at camp.`);
          }
          const next = this.chooseBotQuestPlan?.(bot);
          if (next) {
            bot.currentQuestId = next.id;
            bot.questName = next.name;
            bot.questRequired = Math.max(1, Number(next.required || 3));
            bot.questProgress = 0;
            bot.questTaskProgress = {};
            bot.questStage = 'active';
          }
        }
        this.resolveBotCampEconomy?.(bot);
        bot.campSupply = 100;
        bot.currentActivityLabel = 'Resupplied';
        bot.hp = Math.max(bot.hp || 0, Math.ceil((bot.maxHp || 1) * 0.92));
        bot.mana = Math.max(bot.mana || 0, Math.ceil((bot.maxMana || 0) * 0.86));
        bot.campVisitCooldown = 18 + Math.random() * 12;
        bot.behaviorGoal = bot.level >= 4 && Math.random() < 0.28 ? 'dungeon-prep' : (Math.random() < 0.35 ? 'road-patrol' : 'questing');
        bot.botState = 'leaving-camp';
        bot.currentActivityLabel = 'Leaving Camp';
        bot.objectiveEnemyId = null;
        bot.adventureTargetId = null;
        bot.adventureAnchor = this.resolveBotAdventureAnchor?.(bot) || this.botCampAnchor?.() || bot.roamAnchor;
        bot.roamAnchor = bot.adventureAnchor || bot.roamAnchor;
        bot.roamTarget = bot.adventureAnchor ? { x: bot.adventureAnchor.x, y: bot.adventureAnchor.y } : null;
        bot.campExitTimer = 1.2;
        this.botRoutineDirty = true;
        this.partyPanelDirty = true;
        this.botHudDirty = true;
        return true;
      };

      Game.prototype.advanceBotQuestProgress = function(bot, amount = 1, source = null) {
        if (!bot || this.isBotInParty?.(bot)) return false;
        if (!bot.currentQuestId) this.seedBotRoutine?.(bot, {});
        const plan = BOT_QUEST_PLANS.find(entry => entry.id === bot.currentQuestId) || this.chooseBotQuestPlan?.(bot);
        if (!plan || bot.questStage === 'turn-in') return false;
        const sourceText = lower(source?.name || source?.id || source?.type || source?.target || '');
        if (plan.task === 'kill' && sourceText) {
          const target = lower(plan.target);
          const acceptsAny = target === 'any_dark_woods_mob';
          if (!acceptsAny && !sourceText.includes(target)) return false;
        }
        bot.questProgress = clampNumber(Number(bot.questProgress || 0) + Math.max(1, Math.floor(Number(amount) || 1)), 0, Number(plan.required || 1), 0);
        bot.questTaskProgress = bot.questTaskProgress && typeof bot.questTaskProgress === 'object' ? bot.questTaskProgress : {};
        bot.questTaskProgress[plan.task] = bot.questProgress;
        bot.questName = plan.name;
        bot.questRequired = Math.max(1, Number(plan.required || bot.questRequired || 1));
        if (bot.questProgress >= bot.questRequired) {
          bot.questStage = 'turn-in';
          bot.botState = 'quest-ready-turn-in';
          bot.currentActivityLabel = 'Quest Turn-In';
          bot.campVisitCooldown = 0;
          bot.junkValue = Math.max(0, Number(bot.junkValue || 0) + Math.max(1, Number(plan.gear || 1)));
          bot.reputation = Math.max(0, Number(bot.reputation || 0) + 1);
          this.logParty?.(`${bot.name} finished objectives for ${plan.name} and is returning to camp.`);
        }
        this.botRoutineDirty = true;
        this.partyPanelDirty = true;
        this.botHudDirty = true;
        return true;
      };

      Game.prototype.updateBotQuestRoutine = function(bot, dt) {
        if (!bot || this.isBotInParty?.(bot) || this.isBotTemporarilyBusy?.(bot)) return false;
        if (!bot.currentQuestId) this.seedBotRoutine?.(bot, {});
        bot.campSupply = clampNumber(Number(bot.campSupply || 0) - dt * 0.55, 0, 100, 60);
        bot.campVisitCooldown = Math.max(0, Number(bot.campVisitCooldown || 0) - dt);
        if (this.shouldBotVisitCamp?.(bot)) return this.routeBotTowardCamp?.(bot, dt);
        const autonomousPartyAnchor = this.resolveAutonomousBotPartyAdventureAnchor?.(bot);
        if (autonomousPartyAnchor && dist(bot, autonomousPartyAnchor) > 1.25) {
          bot.botState = autonomousPartyAnchor.enemyId ? 'bot-party-hunting' : 'bot-party-roaming';
          bot.currentActivityLabel = autonomousPartyAnchor.enemyId ? 'Party Hunt' : 'Party Roam';
          bot.roamAnchor = { x: autonomousPartyAnchor.x, y: autonomousPartyAnchor.y };
          bot.roamTarget = { x: autonomousPartyAnchor.x, y: autonomousPartyAnchor.y };
          if (this.moveCompanionToPoint) this.moveCompanionToPoint(bot, autonomousPartyAnchor.x, autonomousPartyAnchor.y, dt, { mode: 'bot-party-roam', stopRange: autonomousPartyAnchor.enemyId ? 1.05 : 0.90, recalcMs: 820, allowPartialPath: true });
          else bot.moveToward?.(this, autonomousPartyAnchor.x, autonomousPartyAnchor.y, dt, autonomousPartyAnchor.enemyId ? 1.05 : 0.90);
          return true;
        }
        const plan = BOT_QUEST_PLANS.find(entry => entry.id === bot.currentQuestId);
        if (!plan || bot.questStage !== 'active') return false;
        if (this.botShouldForceAdventure?.(bot)) {
          const anchor = this.resolveBotAdventureAnchor?.(bot);
          if (anchor) {
            bot.botState = 'leaving-camp-for-objective';
            bot.currentActivityLabel = 'Leaving Camp';
            bot.roamAnchor = { x: anchor.x, y: anchor.y };
            bot.roamTarget = { x: anchor.x, y: anchor.y };
            bot.campExitTimer = Math.max(0.75, Number(bot.campExitTimer || 0));
            if (this.moveCompanionToPoint) this.moveCompanionToPoint(bot, anchor.x, anchor.y, dt, { mode: 'bot-force-adventure', stopRange: 0.85, recalcMs: 760, allowPartialPath: true });
            else bot.moveToward?.(this, anchor.x, anchor.y, dt, 0.85);
            return true;
          }
        }
        if (plan.task === 'kill') {
          const target = this.botFindQuestEnemy?.(bot, { maxDistance: 120, minCampDistance: this.botCampRadius?.() || 7.25 });
          if (target) {
            bot.objectiveEnemyId = target.id;
            bot.adventureTargetId = target.id;
            if (dist(bot, target) > 2.2) {
              bot.botState = 'traveling-to-hunt';
              bot.currentActivityLabel = 'Hunting';
              bot.roamAnchor = { x: target.x, y: target.y };
              bot.roamTarget = { x: target.x, y: target.y };
              if (this.moveCompanionToCombatPosition) this.moveCompanionToCombatPosition(bot, target, dt, { role: bot.role || 'melee', desiredRange: 1.55, stopRange: 0.78, recalcMs: 650, maxRange: 64, maxNodes: 1800 });
              else bot.moveToward?.(this, target.x, target.y, dt, 1.55);
              return true;
            }
          }
        }
        if (plan.task === 'gather') {
          bot.currentActivityLabel = 'Gathering';
          bot.simQuestTimer = Math.max(0, Number(bot.simQuestTimer || 2.5) - dt);
          if (bot.simQuestTimer <= 0) {
            bot.simQuestTimer = 3.5 + Math.random() * 3.0;
            this.advanceBotQuestProgress?.(bot, 1, { name: plan.target, type: 'gather' });
          }
        }
        return false;
      };

      Game.prototype.chooseBotDungeonPlan = function(bot) {
        const level = safeLevel(bot);
        const eligible = BOT_DUNGEON_PLANS.filter(plan => level >= plan.minLevel && level <= plan.maxLevel);
        if (!eligible.length) return null;
        return eligible.sort((a, b) => b.minLevel - a.minLevel)[0];
      };

      Game.prototype.botDungeonGroupReady = function(bot, plan) {
        const squad = this.botSquadFor?.(bot);
        const members = squad ? this.getBotSquadMembers?.(bot, { range: 16 }) : [bot];
        const living = (members || []).filter(member => alive(member) && !this.isBotTemporarilyBusy?.(member));
        const hasSupport = living.some(member => BotRoles.isSupportRole?.(member.role) || BotRoles.isHealingSupportRole?.(member.role) || member.role === 'healer' || member.role === 'support');
        const required = Math.max(1, Number(plan?.recommendedPartySize || 1));
        return { ready: living.length >= required && (required <= 1 || hasSupport), members: living };
      };

      Game.prototype.updateBotDungeonRoutine = function(bot, dt) {
        if (!bot || this.isBotInParty?.(bot)) return false;
        bot.dungeonCooldown = Math.max(0, Number(bot.dungeonCooldown || 0) - dt);
        if (bot.dungeonRunTimer > 0) {
          bot.dungeonRunTimer = Math.max(0, bot.dungeonRunTimer - dt);
          bot.botState = 'in-dungeon';
          bot.currentActivityLabel = 'In Dungeon';
          if (bot.dungeonRunTimer <= 0) return this.completeBotDungeonRun?.(bot);
          return true;
        }
        if (bot.behaviorGoal !== 'dungeon-prep' && bot.level < 4) return false;
        if (bot.dungeonCooldown > 0 || this.shouldBotVisitCamp?.(bot)) return false;
        const plan = bot.dungeonIntent || this.chooseBotDungeonPlan?.(bot);
        if (!plan) return false;
        bot.dungeonIntent = typeof plan === 'string' ? this.chooseBotDungeonPlan?.(bot) : plan;
        const activePlan = bot.dungeonIntent;
        const readiness = this.botDungeonGroupReady?.(bot, activePlan);
        if (!readiness?.ready) {
          bot.botState = 'forming-dungeon-group';
          bot.currentActivityLabel = 'Forming Group';
          bot.behaviorGoal = 'dungeon-prep';
          return false;
        }
        const entrance = this.botDungeonAnchor?.(activePlan);
        const d = dist(bot, entrance);
        bot.botState = 'moving-to-dungeon';
        bot.currentActivityLabel = 'Dungeon Prep';
        if (d > 1.45) {
          if (this.moveCompanionToPoint) this.moveCompanionToPoint(bot, entrance.x, entrance.y, dt, { mode: 'bot-dungeon-prep', stopRange: 0.85, recalcMs: 760, allowPartialPath: true });
          else bot.moveToward?.(this, entrance.x, entrance.y, dt, 0.85);
          return true;
        }
        return this.beginBotDungeonRun?.(bot, activePlan, readiness.members);
      };

      Game.prototype.beginBotDungeonRun = function(bot, plan, members = []) {
        if (!bot || !plan) return false;
        const runMembers = members.length ? members : [bot];
        for (const member of runMembers) {
          member.dungeonIntent = plan;
          member.dungeonRunTimer = Math.max(6, Number(plan.runSeconds || 24) + Math.random() * 8);
          member.botState = 'in-dungeon';
          member.currentActivityLabel = 'In Dungeon';
          member.combatCooldown = 0;
          this.cancelMeditation?.(member, 'dungeon entry', { silent: true });
        }
        this.logParty?.(`${bot.name}'s bot group entered ${plan.name}.`);
        this.maybeQueuePartyBanter?.('enterDungeon', { priority: 3, preferredClass: bot.className });
        this.botRoutineDirty = true;
        this.botHudDirty = true;
        return true;
      };

      Game.prototype.completeBotDungeonRun = function(bot) {
        if (!bot) return false;
        const plan = typeof bot.dungeonIntent === 'string'
          ? BOT_DUNGEON_PLANS.find(entry => entry.id === bot.dungeonIntent)
          : bot.dungeonIntent;
        const rewardPlan = plan || this.chooseBotDungeonPlan?.(bot) || BOT_DUNGEON_PLANS[0];
        bot.dungeonIntent = null;
        bot.dungeonRunTimer = 0;
        bot.dungeonCooldown = 55 + Math.random() * 45;
        bot.dungeonCompletions = Math.max(0, Math.floor(Number(bot.dungeonCompletions || 0))) + 1;
        bot.gearScore = Math.max(0, Number(bot.gearScore || 0) + Number(rewardPlan?.gear || 2));
        bot.gold = Math.max(0, Number(bot.gold || 0) + 8 + Number(rewardPlan?.gear || 2) * 3);
        bot.upgradeFragments = Math.max(0, Number(bot.upgradeFragments || 0) + 1 + Math.floor(Number(rewardPlan?.gear || 2) / 3));
        bot.junkValue = Math.max(0, Number(bot.junkValue || 0) + Number(rewardPlan?.gear || 2));
        this.awardBotXp?.(bot, Number(rewardPlan?.xp || 160), { name: rewardPlan?.name || 'Dungeon Clear' });
        bot.hp = Math.max(1, Math.ceil((bot.maxHp || 1) * (0.64 + Math.random() * 0.25)));
        bot.mana = Math.max(0, Math.ceil((bot.maxMana || 0) * (0.48 + Math.random() * 0.30)));
        bot.campSupply = clampNumber(Number(bot.campSupply || 0) - 28, 0, 100, 35);
        bot.botState = 'dungeon-complete-returning';
        bot.currentActivityLabel = 'Dungeon Clear';
        bot.behaviorGoal = 'camp-supply-run';
        bot.campVisitCooldown = 0;
        this.logParty?.(`${bot.name} completed ${rewardPlan?.name || 'a dungeon'} and upgraded gear.`);
        this.botRoutineDirty = true;
        this.partyPanelDirty = true;
        this.botHudDirty = true;
        return true;
      };

      Game.prototype.botSocialLineFor = function(bot, topic = null) {
        if (!bot) return '';
        const eventType = topic === 'combat' ? 'combatStart'
          : topic === 'dungeon' ? 'enterDungeon'
            : topic === 'party' ? 'generic'
              : this.normalizeBotSpeechEvent?.(topic) || 'generic';
        const className = properClassName(bot.className || 'Fighter');
        const lines = BOT_SPEECH_LINES[className]?.[eventType] || BOT_SPEECH_LINES[className]?.generic || BOT_SPEECH_LINES.Fighter.generic;
        const sequence = Math.max(0, Math.floor(Number(bot.speechSequence || 0)));
        const personalityOffset = stableStringIndex(bot.personalityId || bot.botId || className, Math.max(1, lines.length));
        return lines[(sequence + personalityOffset) % Math.max(1, lines.length)] || 'Ready.';
      };

      Game.prototype.normalizeBotSpeechEvent = function(eventType) {
        const aliases = {
          join: 'joinParty', kill: 'enemyKilled', rareEnemy: 'rareEnemySeen',
          startMeditation: 'startRecovery', stopMeditation: 'stopRecoveryToFollow', zoneEntry: 'enterDungeon'
        };
        const key = String(eventType || 'generic');
        return aliases[key] || key;
      };

      Game.prototype.botEnemySpeechEvent = function(enemy) {
        if (!enemy) return 'combatStart';
        if (enemy.dungeonBoss || enemy.boss || enemy.bossLike) return 'bossLikeEnemySeen';
        if (enemy.rareNameplate || enemy.named || enemy.isNamed || (enemy.name && enemy.baseType?.name && enemy.name !== enemy.baseType.name)) return 'namedEnemySeen';
        if (enemy.elite || enemy.rare) return 'rareEnemySeen';
        return 'combatStart';
      };

      Game.prototype.botSpeechDispositionAllows = function(bot, eventType, options = {}) {
        if (options.force || options.required) return true;
        const priority = Number.isFinite(Number(options.priority)) ? Number(options.priority) : (BOT_SPEECH_PRIORITIES[eventType] || 0);
        if (priority >= 3) return true;
        const profile = this.botPersonalityProfile?.(bot) || BOT_PERSONALITY_TYPES.steady;
        let chance = priority >= 2 ? 0.88 : priority === 1 ? 0.72 : 0.42;
        chance *= Number(profile.chatterFrequency || 0.75);
        if (/rare|named|boss/i.test(eventType)) chance *= Number(profile.rareInterest || 0.75);
        if (/loot|chest/i.test(eventType)) chance *= Number(profile.lootInterest || 0.65);
        const sample = stableStringIndex(`${bot.botId || bot.id}:${eventType}:${bot.speechSequence || 0}`, 1000) / 1000;
        return sample <= Math.min(0.98, chance);
      };

      Game.prototype.canBotSpeak = function(bot, eventType = 'generic', nowMs = performance.now(), options = {}) {
        if (!bot || bot.kind !== 'bot' || !bot.alive) return false;
        const priority = Number.isFinite(Number(options.priority)) ? Number(options.priority) : (BOT_SPEECH_PRIORITIES[eventType] || 0);
        if (!options.force && nowMs < Number(bot.speechCooldownUntil || 0)) return false;
        if (!options.force && nowMs < Number(bot.speechEventCooldowns?.[eventType] || 0)) return false;
        if (!options.force && priority < 4 && nowMs < Number(this.botSpeechGlobalUntil || 0)) return false;
        const active = bot.speechBubble;
        if (!options.force && active && nowMs < Number(active.expiresAt || 0) && priority <= Number(active.priority || 0)) return false;
        return true;
      };

      Game.prototype.queueBotSpeech = function(bot, line, options = {}) {
        const text = String(line || '').trim().replace(/\s+/g, ' ').slice(0, 110);
        const eventType = String(options.eventType || 'generic');
        const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : performance.now();
        const priority = Number.isFinite(Number(options.priority)) ? Number(options.priority) : (BOT_SPEECH_PRIORITIES[eventType] || 0);
        if (!text || !this.canBotSpeak?.(bot, eventType, nowMs, { ...options, priority })) return false;
        const durationMs = Math.max(1400, Math.min(5200, Number(options.durationMs || (1800 + text.length * 24))));
        bot.speechBubble = { text, eventType, priority, createdAt: nowMs, expiresAt: nowMs + durationMs };
        bot.speechCooldownUntil = nowMs + Math.max(1200, Number(options.botCooldownMs || 5200));
        bot.speechEventCooldowns = bot.speechEventCooldowns && typeof bot.speechEventCooldowns === 'object' ? bot.speechEventCooldowns : {};
        bot.speechEventCooldowns[eventType] = nowMs + Math.max(500, Number(options.eventCooldownMs || BOT_SPEECH_COOLDOWNS[eventType] || BOT_SPEECH_COOLDOWNS.generic));
        bot.speechSequence = Math.max(0, Math.floor(Number(bot.speechSequence || 0))) + 1;
        bot.lastSocialLine = text;
        this.botSpeechGlobalUntil = nowMs + Math.max(650, Number(options.globalCooldownMs || 1800));
        if (options.log !== false) this.logChat?.(`${bot.name}: ${text}`);
        this.botHudDirty = true;
        return true;
      };

      Game.prototype.queueBotSpeechEvent = function(bot, eventType, options = {}) {
        const canonicalEvent = this.normalizeBotSpeechEvent?.(eventType) || String(eventType || 'generic');
        if (!this.botSpeechDispositionAllows?.(bot, canonicalEvent, options)) return false;
        const line = this.botSocialLineFor?.(bot, canonicalEvent);
        return this.queueBotSpeech?.(bot, line, { ...options, eventType: canonicalEvent });
      };

      Game.prototype.maybeQueuePartyBanter = function(eventType, context = {}) {
        const canonicalEvent = this.normalizeBotSpeechEvent?.(eventType) || String(eventType || 'generic');
        const nowMs = Number.isFinite(Number(context.nowMs)) ? Number(context.nowMs) : performance.now();
        this.botPartyBanterCooldowns = this.botPartyBanterCooldowns && typeof this.botPartyBanterCooldowns === 'object' ? this.botPartyBanterCooldowns : {};
        if (!context.force && (nowMs < Number(this.botPartyBanterUntil || 0) || nowMs < Number(this.botPartyBanterCooldowns[canonicalEvent] || 0))) return false;
        const candidates = (this.botPlayers || []).filter(bot => bot?.alive !== false && this.isBotInParty?.(bot) && this.canBotSpeak?.(bot, canonicalEvent, nowMs, context));
        if (!candidates.length) return false;
        const preferredClass = String(context.preferredClass || '').toLowerCase();
        candidates.sort((a, b) => {
          const aPreferred = String(a.className || '').toLowerCase() === preferredClass ? -1 : 0;
          const bPreferred = String(b.className || '').toLowerCase() === preferredClass ? -1 : 0;
          return aPreferred - bPreferred || stableStringIndex(`${a.botId}:${canonicalEvent}`, 1000) - stableStringIndex(`${b.botId}:${canonicalEvent}`, 1000);
        });
        const speaker = candidates[0];
        const queued = this.queueBotSpeechEvent?.(speaker, canonicalEvent, { ...context, nowMs, required: context.required !== false });
        if (!queued) return false;
        this.botPartyBanterUntil = nowMs + Math.max(5000, Number(context.partyCooldownMs || 6500));
        this.botPartyBanterCooldowns[canonicalEvent] = nowMs + Math.max(8000, Number(context.eventCooldownMs || BOT_SPEECH_COOLDOWNS[canonicalEvent] || 18000));
        return true;
      };

      Game.prototype.updateBotSpeechState = function(bot, nowMs = performance.now()) {
        if (!bot) return false;
        if (bot.speechBubble && nowMs >= Number(bot.speechBubble.expiresAt || 0)) {
          bot.speechBubble = null;
          return true;
        }
        return false;
      };

      Game.prototype.updateBotWorldPresence = function(bot, dt) {
        if (!bot) return false;
        if (this.actorIsMeditating?.(bot)) {
          this.lockMeditatingActorMovement?.(bot);
          bot.currentActivityLabel = 'Meditating';
          return true;
        }
        bot.worldPresenceTimer = Math.max(0, Number(bot.worldPresenceTimer || 0) - dt);
        if (bot.worldPresenceTimer > 0) return false;
        bot.worldPresenceTimer = 0.75 + Math.random() * 1.25;
        if (this.isBotInParty?.(bot)) {
          const command = String(bot.botPartyCommand || bot.commandState || 'follow').toLowerCase().replace(/^party$/, 'follow');
          const labels = { follow: this.isPlayerActivelyMoving?.() ? 'Following Party' : 'Party Ready', guard: 'Guarding Party', assist: 'Assisting Party', passive: 'Passive', attack: 'Attacking Target' };
          bot.currentActivityLabel = labels[command] || labels.follow;
        }
        else if (bot.dungeonRunTimer > 0 || bot.botState === 'in-dungeon') bot.currentActivityLabel = 'In Dungeon';
        else if (bot.botState?.includes?.('camp') || bot.behaviorGoal === 'camp-supply-run') bot.currentActivityLabel = bot.questStage === 'turn-in' ? 'Turning In' : 'Camp Supply';
        else if (bot.botState === 'forming-dungeon-group') bot.currentActivityLabel = 'Forming Group';
        else if (bot.botState === 'healing') bot.currentActivityLabel = 'Healing';
        else if (bot.botState === 'casting' || bot.botState === 'attacking') bot.currentActivityLabel = 'Fighting';
        else if (bot.currentQuestId) bot.currentActivityLabel = bot.questStage === 'turn-in' ? 'Quest Turn-In' : (BOT_QUEST_PLANS.find(plan => plan.id === bot.currentQuestId)?.task === 'gather' ? 'Gathering' : 'Questing');
        else bot.currentActivityLabel = 'Roaming';
        return true;
      };

      Game.prototype.resolveBotCampEconomy = function(bot) {
        if (!bot) return false;
        let changed = false;
        const junk = Math.max(0, Math.floor(Number(bot.junkValue || 0)));
        if (junk > 0) {
          const sale = Math.max(1, Math.floor(junk * (3 + Math.min(3, Math.floor(Number(bot.level || 1) / 4)))));
          bot.gold = Math.max(0, Math.floor(Number(bot.gold || 0)) + sale);
          bot.junkValue = 0;
          bot.lastSocialLine = 'Sold junk at camp.';
          changed = true;
        }
        const supplyCost = Math.max(2, Math.floor((100 - Number(bot.campSupply || 0)) / 18));
        if (supplyCost > 0 && bot.gold >= supplyCost) {
          bot.gold -= supplyCost;
          bot.campSupply = 100;
          bot.lastSocialLine = 'Bought supplies before heading out.';
          changed = true;
        }
        const repairCost = Math.min(Math.floor(Number(bot.repairDebt || 0)), Math.floor(Number(bot.gold || 0) / 2));
        if (repairCost > 0) {
          bot.gold -= repairCost;
          bot.repairDebt = Math.max(0, Number(bot.repairDebt || 0) - repairCost);
          changed = true;
        }
        const targetGear = Math.max(4, Number(bot.level || 1) * 5 + Math.floor(Number(bot.reputation || 0) / 3));
        const upgradeCost = Math.max(8, Math.floor(Number(bot.level || 1) * 5.5));
        if (Number(bot.gearScore || 0) < targetGear && Number(bot.gold || 0) >= upgradeCost && Number(bot.upgradeFragments || 0) >= 1) {
          bot.gold -= upgradeCost;
          bot.upgradeFragments = Math.max(0, Number(bot.upgradeFragments || 0) - 1);
          bot.gearScore = Math.max(0, Number(bot.gearScore || 0) + 2 + Math.floor(Math.random() * 3));
          bot.updateBaseStatsFromLevel?.();
          bot.lastSocialLine = 'Upgraded gear from loot sales.';
          bot.currentActivityLabel = 'Gear Upgrade';
          this.logParty?.(`${bot.name} upgraded gear at camp.`);
          changed = true;
        }
        if (changed) {
          bot.socialCooldown = Math.min(Number(bot.socialCooldown || 0), 1.0);
          this.botHudDirty = true;
          this.partyPanelDirty = true;
        }
        return changed;
      };

      Game.prototype.updateBotEconomyRoutine = function(bot, dt) {
        if (!bot || this.isBotInParty?.(bot) || this.isBotTemporarilyBusy?.(bot)) return false;
        bot.economyTimer = Math.max(0, Number(bot.economyTimer || 0) - dt);
        if (bot.economyTimer > 0) return false;
        bot.economyTimer = 4.0 + Math.random() * 4.0;
        if (this.isEntityInCombat?.(bot)) return false;
        const camp = this.botCampAnchor?.();
        const atCamp = camp && dist(bot, camp) <= 2.0;
        if (atCamp) return this.resolveBotCampEconomy?.(bot);
        if (Math.random() < 0.38) {
          bot.junkValue = Math.max(0, Number(bot.junkValue || 0) + 1);
          bot.campSupply = clampNumber(Number(bot.campSupply || 0) - 1.5, 0, 100, 50);
          return true;
        }
        return false;
      };

      Game.prototype.updateBotSocialRoutine = function(bot, dt) {
        if (!bot || this.isBotTemporarilyBusy?.(bot)) return false;
        bot.socialCooldown = Math.max(0, Number(bot.socialCooldown || 0) - dt);
        if (bot.socialCooldown > 0) return false;
        const nearPlayer = this.player && dist(bot, this.player) <= (this.isBotInParty?.(bot) ? 8.0 : 5.0);
        const personality = this.botPersonalityProfile?.(bot) || BOT_PERSONALITY_TYPES.steady;
        const chance = (this.isBotInParty?.(bot) ? 0.48 : 0.22) * Number(personality.chatterFrequency || 0.75);
        bot.socialCooldown = (14 + Math.random() * 20) / Math.max(0.55, Number(personality.chatterFrequency || 0.75));
        if (!nearPlayer || Math.random() > chance) return false;
        bot.currentActivityLabel = bot.currentActivityLabel || 'Ready';
        return this.queueBotSpeechEvent?.(bot, 'generic', { priority: 0, log: true }) === true;
      };

      Game.prototype.normalizeBotInventory = function(bot) {
        if (!bot) return false;
        bot.botInventory = Array.isArray(bot.botInventory) ? bot.botInventory.filter(Boolean) : [];
        bot.botEquipment = bot.botEquipment && typeof bot.botEquipment === 'object' ? bot.botEquipment : {};
        for (const slot of Object.keys(bot.botEquipment)) {
          if (!bot.botEquipment[slot]) delete bot.botEquipment[slot];
        }
        return true;
      };

      Game.prototype.botItemClassCompatible = function(bot, item) {
        if (!bot || !item) return false;
        const classes = Array.isArray(item.classes) ? item.classes : Object.keys(DR.CLASSES || {});
        return classes.includes(bot.className) || classes.length >= Object.keys(DR.CLASSES || {}).length || classes.includes('All');
      };

      Game.prototype.botCanUseItem = function(bot, item) {
        if (!bot || !item) return false;
        const slot = item.slot || item.equipSlot;
        if (!slot || !(DR.EQUIP_SLOTS || BOT_GEAR_SLOT_ORDER).includes(slot)) return false;
        if (item.kind && item.kind !== 'equipment') return false;
        if (item.questItem || item.protected || item.soulbound || item.bound) return false;
        if ((item.levelRequirement || item.level || 1) > safeLevel(bot)) return false;
        return this.botItemClassCompatible?.(bot, item) !== false;
      };

      Game.prototype.botItemScore = function(bot, item) {
        if (!bot || !item) return 0;
        const role = BotRoles.gearWeightRole?.(bot.role) || bot.role || 'meleeDps';
        const weights = BOT_GEAR_WEIGHTS[role] || BOT_GEAR_WEIGHTS.meleeDps;
        const stats = { ...(item.stats || {}) };
        if (item.armor && !stats.armor) stats.armor = Number(item.armor) || 0;
        let score = 0;
        for (const [stat, raw] of Object.entries(stats)) {
          const value = Number(raw) || 0;
          score += value * (weights[stat] || 0.20);
        }
        const rarityKey = item.rarityKey || item.rarity?.key || 'white';
        const rarityBonus = { grey: -1.5, white: 0, green: 2.5, blue: 5.5, purple: 9, gold: 13, orange: 16, red: 20 }[rarityKey] || 0;
        score += rarityBonus;
        score += Math.max(0, Number(item.level || item.levelRequirement || 1)) * 0.35;
        if (this.botItemClassCompatible?.(bot, item)) score += 1.5;
        return Number(score.toFixed(2));
      };

      Game.prototype.botEquippedScore = function(bot, slot) {
        const item = bot?.botEquipment?.[slot];
        return item ? this.botItemScore?.(bot, item) || 0 : 0;
      };

      Game.prototype.resolveGearScoreRole = function(actor) {
        if (!actor) return 'meleeDps';
        const rawRole = actor.role || actor.roleKey || '';
        const explicitRole = rawRole ? (BotRoles.gearWeightRole?.(rawRole) || rawRole) : '';
        if (explicitRole) return explicitRole;
        const classKey = String(actor.className || actor.class || '').toLowerCase();
        if (classKey === 'fighter') return 'meleeDps';
        if (classKey === 'paladin' || classKey === 'warden') return 'tank';
        if (classKey === 'cleric') return 'healer';
        if (classKey === 'rogue') return 'meleeDps';
        if (classKey === 'ranger' || classKey === 'assassin') return 'physicalRangedDps';
        if (classKey === 'bard') return 'support';
        if (['summoner', 'necromancer', 'enchanter', 'druid', 'wizard', 'shaman'].includes(classKey)) return 'casterDps';
        return 'meleeDps';
      };

      Game.prototype.calculateActorGearScore = function(actor, equipment = null, options = {}) {
        if (!actor) return 0;
        const equippedSource = equipment || actor.botEquipment || actor.equipment || {};
        const equipped = Object.values(equippedSource || {}).filter(Boolean);
        const scoreActor = {
          ...actor,
          className: actor.className || actor.class || this.player?.className || 'Fighter',
          role: this.resolveGearScoreRole?.(actor) || 'meleeDps',
          level: actor.level || this.player?.level || 1
        };
        const equippedScore = equipped.reduce((sum, item) => sum + Math.max(0, this.botItemScore?.(scoreActor, item) || 0), 0);
        const baseline = options.includeBaseline === false ? 0 : Math.max(0, safeLevel(scoreActor) * 4);
        const calculated = Math.floor(baseline + equippedScore * 0.18);
        if (options.preserveExisting) return Math.max(Math.floor(Number(actor.gearScore || 0)), calculated);
        return Math.max(0, calculated);
      };

      Game.prototype.recalculatePlayerGearScore = function(player = this.player) {
        if (!player) return 0;
        this.ensureEquipmentSlots?.();
        const score = this.calculateActorGearScore?.(player, this.equipment || player.equipment || {}, { preserveExisting: false });
        player.gearScore = Math.max(0, Math.floor(Number(score) || 0));
        return player.gearScore;
      };

      Game.prototype.recalculateBotGearScore = function(bot) {
        if (!bot) return 0;
        this.normalizeBotInventory?.(bot);
        bot.gearScore = this.calculateActorGearScore?.(bot, bot.botEquipment || {}, { preserveExisting: true });
        bot.updateBaseStatsFromLevel?.();
        return bot.gearScore;
      };

      Game.prototype.botEquipItem = function(bot, item, options = {}) {
        if (!bot || !item || !this.botCanUseItem?.(bot, item)) return false;
        this.normalizeBotInventory?.(bot);
        const slot = item.slot || item.equipSlot;
        const currentScore = this.botEquippedScore?.(bot, slot) || 0;
        const nextScore = this.botItemScore?.(bot, item) || 0;
        const margin = Number.isFinite(Number(options.margin)) ? Number(options.margin) : 0.75;
        if (currentScore && nextScore <= currentScore + margin) return false;
        const old = bot.botEquipment[slot] || null;
        bot.botEquipment[slot] = item;
        if (old) bot.botInventory.push(old);
        this.recalculateBotGearScore?.(bot);
        bot.currentActivityLabel = 'Equipped Loot';
        bot.lastSocialLine = `Equipped ${item.name || 'new gear'}.`;
        this.botHudDirty = true;
        this.partyPanelDirty = true;
        if (!options.silent) this.logParty?.(`${bot.name} equipped ${item.name || 'loot'}.`);
        return true;
      };

      Game.prototype.botReceiveLootItem = function(bot, item, source = null, options = {}) {
        if (!bot || !item) return false;
        this.normalizeBotInventory?.(bot);
        const equipped = this.botEquipItem?.(bot, item, { silent: options.silent, margin: options.margin });
        if (!equipped) bot.botInventory.push(item);
        bot.lootTradeCooldown = Math.min(Number(bot.lootTradeCooldown || 0), 0.3);
        bot.currentActivityLabel = equipped ? 'Equipped Loot' : 'Looting Gear';
        if (!options.silent && !equipped) this.logParty?.(`${bot.name} looted ${item.name || 'gear'} for trading.`);
        this.botHudDirty = true;
        this.partyPanelDirty = true;
        return true;
      };

      Game.prototype.bestBotForItem = function(item, options = {}) {
        const bots = (this.botPlayers || []).filter(bot => bot && bot.alive !== false && !this.isBotTemporarilyBusy?.(bot));
        let best = null;
        let bestGain = Number.isFinite(Number(options.minGain)) ? Number(options.minGain) : 1.0;
        for (const bot of bots) {
          if (options.excludeBot && bot === options.excludeBot) continue;
          if (!this.botCanUseItem?.(bot, item)) continue;
          const slot = item.slot || item.equipSlot;
          const gain = (this.botItemScore?.(bot, item) || 0) - (this.botEquippedScore?.(bot, slot) || 0);
          if (gain > bestGain) { best = bot; bestGain = gain; }
        }
        return best ? { bot: best, gain: bestGain } : null;
      };

      Game.prototype.tradeBotGearWithOtherBots = function(sourceBot, options = {}) {
        if (!sourceBot) return 0;
        this.normalizeBotInventory?.(sourceBot);
        let trades = 0;
        const remaining = [];
        for (const item of sourceBot.botInventory || []) {
          const target = this.bestBotForItem?.(item, { excludeBot: sourceBot, minGain: 1.5 });
          if (target?.bot) {
            this.botReceiveLootItem?.(target.bot, item, { name: `${sourceBot.name} Trade` }, { silent: true, margin: 0.25 });
            trades += 1;
            target.bot.lastSocialLine = `${sourceBot.name} traded me ${item.name || 'gear'}.`;
            sourceBot.lastSocialLine = `Traded ${item.name || 'gear'} to ${target.bot.name}.`;
            if (!options.silent) this.logParty?.(`${sourceBot.name} traded ${item.name || 'gear'} to ${target.bot.name}.`);
          } else remaining.push(item);
        }
        sourceBot.botInventory = remaining;
        if (trades) {
          this.botHudDirty = true;
          this.partyPanelDirty = true;
        }
        return trades;
      };

      Game.prototype.handleBotEnemyLoot = function(bot, enemy, lootResult) {
        if (!bot || bot.kind !== 'bot' || !lootResult) return false;
        this.normalizeBotInventory?.(bot);
        const inPlayerParty = this.isBotInParty?.(bot) === true;
        let takenItems = 0;
        const remaining = [];
        for (const entry of lootResult.items || []) {
          const item = entry?.item || (entry?.itemId ? (this.createRuntimeItemInstance?.(entry.itemId, entry.quantity || 1, { rarityKey: entry.rarityKey || 'white' }) || null) : null);
          const isEquipment = item && (!item.kind || item.kind === 'equipment') && item.slot;
          const botGain = isEquipment && this.botCanUseItem?.(bot, item)
            ? (this.botItemScore?.(bot, item) || 0) - (this.botEquippedScore?.(bot, item.slot) || 0)
            : -Infinity;
          const tradeTarget = isEquipment ? this.bestBotForItem?.(item, { excludeBot: bot, minGain: inPlayerParty ? 3.0 : 0.75 }) : null;
          const shouldTake = !inPlayerParty || botGain > 1.0 || Boolean(tradeTarget?.bot);
          if (shouldTake && item) {
            this.botReceiveLootItem?.(bot, item, enemy, { silent: true, margin: 0.35 });
            takenItems += 1;
          } else remaining.push(entry);
        }
        lootResult.items = remaining;
        if (!inPlayerParty && Number(lootResult.currencyCopper || 0) > 0) {
          bot.coinCopper = Math.max(0, Math.floor(Number(bot.coinCopper || 0)) + Math.floor(Number(lootResult.currencyCopper || 0)));
          lootResult.currencyCopper = 0;
        }
        lootResult.itemSummary = remaining.map(entry => entry?.name || entry?.item?.name || entry?.itemId || 'item');
        const summaryParts = [];
        if (Number(lootResult.currencyCopper || 0) > 0) summaryParts.push(this.formatCopper?.(lootResult.currencyCopper) || `${Math.floor(Number(lootResult.currencyCopper || 0))}C`);
        summaryParts.push(...lootResult.itemSummary);
        lootResult.summary = summaryParts.length ? summaryParts.join(', ') : 'nothing';
        const traded = this.tradeBotGearWithOtherBots?.(bot, { silent: false }) || 0;
        if (takenItems || traded) {
          bot.currentActivityLabel = 'Looted Gear';
          bot.lastSocialLine = takenItems ? `Looted ${takenItems} item${takenItems === 1 ? '' : 's'} from ${enemy?.name || 'a mob'}.` : bot.lastSocialLine;
          this.queueBotSpeechEvent?.(bot, 'lootFound', { priority: 0 });
          this.logParty?.(`${bot.name} looted ${takenItems} gear item${takenItems === 1 ? '' : 's'}${traded ? ` and made ${traded} bot trade${traded === 1 ? '' : 's'}` : ''}.`);
          this.botHudDirty = true;
          this.partyPanelDirty = true;
          return true;
        }
        return false;
      };

      Game.prototype.tradeGearWithBotPlayer = function(botOrId) {
        const bot = typeof botOrId === 'string'
          ? (this.botPlayers || []).find(entry => entry.botId === botOrId || entry.remoteId === botOrId)
          : botOrId;
        if (!bot || !this.player) return false;
        this.normalizeBotInventory?.(bot);
        let changed = false;
        let messages = [];

        let bestPlayerOffer = null;
        let bestOfferGain = 1.25;
        for (let i = 0; i < (this.inventory || []).length; i++) {
          const item = this.inventory[i];
          if (!this.botCanUseItem?.(bot, item)) continue;
          const gain = (this.botItemScore?.(bot, item) || 0) - (this.botEquippedScore?.(bot, item.slot) || 0);
          if (gain > bestOfferGain) { bestPlayerOffer = { item, index: i, gain }; bestOfferGain = gain; }
        }
        if (bestPlayerOffer) {
          const [item] = this.inventory.splice(bestPlayerOffer.index, 1);
          const price = Math.max(1, Math.floor(Number(item.value || item.level || 1)));
          const paid = Math.min(price, Math.floor(Number(bot.gold || 0)));
          bot.gold = Math.max(0, Math.floor(Number(bot.gold || 0)) - paid);
          if (paid > 0) this.addGold?.(paid);
          this.botReceiveLootItem?.(bot, item, { name: 'Player Trade' }, { silent: true, margin: 0.25 });
          messages.push(`${bot.name} took ${item.name || 'gear'}${paid ? ` and paid ${paid}g` : ''}`);
          changed = true;
        }

        let bestBotOffer = null;
        let bestBotScore = 0;
        for (let i = 0; i < (bot.botInventory || []).length; i++) {
          const item = bot.botInventory[i];
          if (!item || !this.canEquip?.(item)) continue;
          const score = Math.max(1, Number(item.value || 0)) + Math.max(0, this.botItemScore?.({ ...bot, className: this.player.className, role: 'meleeDps', level: this.player.level }, item) || 0);
          if (score > bestBotScore) { bestBotOffer = { item, index: i, score }; bestBotScore = score; }
        }
        if (bestBotOffer && (this.inventory || []).length < (this.getBagCapacity?.() || 999)) {
          const [item] = bot.botInventory.splice(bestBotOffer.index, 1);
          this.grantRuntimeItem?.(item);
          messages.push(`${bot.name} traded you ${item.name || 'gear'}`);
          changed = true;
        }

        if (!changed) {
          this.logParty?.(`${bot.name} has no useful gear trade right now.`);
          return false;
        }
        this.renderBag?.();
        this.updateUI?.();
        this.botHudDirty = true;
        this.partyPanelDirty = true;
        this.logParty?.(messages.join(' · '));
        return true;
      };

      Game.prototype.ensureBotTradeWindow = function() {
        let panel = document.getElementById('botTradePanel');
        if (panel) return panel;
        panel = document.createElement('div');
        panel.id = 'botTradePanel';
        panel.className = 'panel gameWindow';
        panel.style.display = 'none';
        panel.style.position = 'fixed';
        panel.style.left = '50%';
        panel.style.top = '50%';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.transform = 'translate(-50%, -50%)';
        panel.style.width = 'min(860px, calc(100vw - 34px))';
        panel.style.maxHeight = 'min(82vh, 740px)';
        panel.style.overflow = 'auto';
        panel.style.zIndex = '86';
        panel.innerHTML = `
          <div class="windowHeader">
            <div>
              <div class="name" data-bot-trade-title>Trade Gear</div>
              <div class="small" data-bot-trade-summary>Choose gear to trade.</div>
            </div>
            <div style="display:flex;gap:6px;align-items:center">
              <button data-bot-auto-trade>Best Trade</button>
              <button data-bot-trade-close>Close</button>
            </div>
          </div>
          <div data-bot-trade-body></div>`;
        document.body.appendChild(panel);
        panel.querySelector('[data-bot-trade-close]')?.addEventListener('click', () => { panel.style.display = 'none'; });
        panel.addEventListener('click', event => {
          const botId = panel.dataset.botTradeId;
          const bot = (this.botPlayers || []).find(entry => entry.botId === botId || entry.remoteId === botId);
          if (!bot) return;
          const give = event.target.closest('[data-bot-give-index]');
          if (give) {
            this.givePlayerGearToBot?.(bot, Number(give.dataset.botGiveIndex));
            this.renderBotTradeWindow?.(bot);
            this.renderBotInspectWindow?.(bot);
            return;
          }
          const take = event.target.closest('[data-bot-take-index]');
          if (take) {
            this.takeGearFromBotTrade?.(bot, Number(take.dataset.botTakeIndex));
            this.renderBotTradeWindow?.(bot);
            this.renderBotInspectWindow?.(bot);
            return;
          }
          if (event.target.closest('[data-bot-auto-trade]')) {
            this.tradeGearWithBotPlayer?.(bot);
            this.renderBotTradeWindow?.(bot);
            this.renderBotInspectWindow?.(bot);
          }
        });
        return panel;
      };

      Game.prototype.botTradeItemCardHtml = function(item, index, side, bot = null) {
        const color = item?.rarity?.color || item?.color || '#cfdac8';
        const name = itemName(item);
        const slot = item?.slot || item?.equipSlot || 'item';
        const score = bot && this.botCanUseItem?.(bot, item) ? Math.round((this.botItemScore?.(bot, item) || 0) * 10) / 10 : null;
        const detail = `${slot}${score !== null ? ` · bot score ${score}` : ''}`;
        const attr = side === 'player' ? `data-bot-give-index="${index}"` : `data-bot-take-index="${index}"`;
        const label = side === 'player' ? 'Give' : 'Take';
        return `<button class="itemSlot compactItem" data-item-tooltip="1" ${attr} style="--rarity-color:${escapeHtml(color)};--icon-color:${escapeHtml(color)};text-align:left;min-height:58px">
          ${this.itemIconHtml?.(item, 'equipIcon generatedIcon') || ''}
          <span><strong>${escapeHtml(name)}</strong><br><span class="small">${escapeHtml(detail)} · ${label}</span></span>
        </button>`;
      };

      Game.prototype.playerGearTradeCandidatesForBot = function(bot) {
        const inventory = Array.isArray(this.inventory) ? this.inventory : [];
        return inventory
          .map((item, index) => ({ item, index }))
          .filter(entry => entry.item && (entry.item.slot || entry.item.equipSlot))
          .filter(entry => !entry.item.questItem && !entry.item.protected && !entry.item.soulbound)
          .sort((a, b) => {
            const ag = this.botCanUseItem?.(bot, a.item) ? ((this.botItemScore?.(bot, a.item) || 0) - (this.botEquippedScore?.(bot, a.item.slot || a.item.equipSlot) || 0)) : -999;
            const bg = this.botCanUseItem?.(bot, b.item) ? ((this.botItemScore?.(bot, b.item) || 0) - (this.botEquippedScore?.(bot, b.item.slot || b.item.equipSlot) || 0)) : -999;
            return bg - ag;
          });
      };

      Game.prototype.renderBotTradeWindow = function(bot) {
        const panel = this.ensureBotTradeWindow?.();
        if (!panel || !bot) return false;
        this.normalizeBotInventory?.(bot);
        panel.dataset.botTradeId = bot.botId || bot.remoteId || '';
        const title = panel.querySelector('[data-bot-trade-title]');
        const summary = panel.querySelector('[data-bot-trade-summary]');
        const body = panel.querySelector('[data-bot-trade-body]');
        const playerItems = this.playerGearTradeCandidatesForBot?.(bot) || [];
        const botItems = (bot.botInventory || [])
          .map((item, index) => ({ item, index }))
          .filter(entry => entry.item && (entry.item.slot || entry.item.equipSlot));
        if (title) title.textContent = `Trade Gear with ${bot.name || 'Bot'}`;
        if (summary) summary.textContent = `Level ${safeLevel(bot)} ${bot.className || 'Fighter'} · ${bot.role || 'dps'} · ${Math.floor(Number(bot.gold || 0))}g`;
        if (body) body.innerHTML = `
          <div class="characterSheet" style="grid-template-columns:1fr 1fr;gap:12px">
            <section class="sheetPanel">
              <div class="sheetPanelTitle">Your Sell / Give Gear</div>
              <div class="small" style="margin-bottom:8px">Click an item to trade it to ${escapeHtml(bot.name || 'the bot')}. The bot equips upgrades automatically.</div>
              <div class="inventoryGrid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:6px">
                ${playerItems.length ? playerItems.map(entry => this.botTradeItemCardHtml?.(entry.item, entry.index, 'player', bot)).join('') : '<div class="small">No tradable carried gear found.</div>'}
              </div>
            </section>
            <section class="sheetPanel">
              <div class="sheetPanelTitle">Bot Carried Trade Gear</div>
              <div class="small" style="margin-bottom:8px">Click an item to take it from the bot into your bags.</div>
              <div class="inventoryGrid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:6px">
                ${botItems.length ? botItems.map(entry => this.botTradeItemCardHtml?.(entry.item, entry.index, 'bot', bot)).join('') : '<div class="small">This bot has no carried trade gear.</div>'}
              </div>
            </section>
          </div>`;
        panel.style.display = 'block';
        return true;
      };

      Game.prototype.openBotTradeWindow = function(botOrId) {
        const bot = typeof botOrId === 'string'
          ? (this.botPlayers || []).find(entry => entry.botId === botOrId || entry.remoteId === botOrId)
          : botOrId;
        if (!bot) return false;
        return this.renderBotTradeWindow?.(bot) || false;
      };

      Game.prototype.givePlayerGearToBot = function(bot, inventoryIndex) {
        if (!bot || !Array.isArray(this.inventory)) return false;
        const index = Math.floor(Number(inventoryIndex));
        const item = this.inventory[index];
        if (!item || !(item.slot || item.equipSlot) || item.questItem || item.protected || item.soulbound) return false;
        this.inventory.splice(index, 1);
        const price = Math.max(1, Math.floor(Number(item.value || item.level || 1)));
        const paid = Math.min(price, Math.floor(Number(bot.gold || 0)));
        bot.gold = Math.max(0, Math.floor(Number(bot.gold || 0)) - paid);
        if (paid > 0) this.addGold?.(paid);
        this.botReceiveLootItem?.(bot, item, { name: 'Player Trade' }, { silent: true, margin: 0.25 });
        bot.lastSocialLine = `Traded for ${item.name || 'gear'} from you.`;
        bot.currentActivityLabel = 'Trading Gear';
        this.renderBag?.();
        this.updateUI?.();
        this.botHudDirty = true;
        this.partyPanelDirty = true;
        this.logParty?.(`${bot.name} received ${item.name || 'gear'}${paid ? ` and paid ${paid}g` : ''}.`);
        return true;
      };

      Game.prototype.takeGearFromBotTrade = function(bot, botInventoryIndex) {
        if (!bot) return false;
        this.normalizeBotInventory?.(bot);
        const index = Math.floor(Number(botInventoryIndex));
        const item = bot.botInventory?.[index];
        if (!item) return false;
        const capacity = this.getBagCapacity?.() || 999;
        if ((this.inventory || []).length >= capacity) {
          this.logParty?.('Your bags are full.');
          return false;
        }
        bot.botInventory.splice(index, 1);
        this.grantRuntimeItem?.(item);
        bot.lastSocialLine = `Traded ${item.name || 'gear'} to you.`;
        bot.currentActivityLabel = 'Trading Gear';
        this.renderBag?.();
        this.updateUI?.();
        this.botHudDirty = true;
        this.partyPanelDirty = true;
        this.logParty?.(`${bot.name} traded you ${item.name || 'gear'}.`);
        return true;
      };


      Game.prototype.updateBotAdvancedRoutine = function(bot, dt) {
        if (!alive(bot)) return false;
        if (this.actorIsMeditating?.(bot)) {
          this.lockMeditatingActorMovement?.(bot);
          bot.currentActivityLabel = 'Meditating';
          return false;
        }
        this.seedBotRoutine?.(bot, bot);
        this.updateBotWorldPresence?.(bot, dt);
        this.updateBotSocialRoutine?.(bot, dt);
        bot.lootTradeCooldown = Math.max(0, Number(bot.lootTradeCooldown || 0) - dt);
        bot.adventureCommitTimer = Math.max(0, Number(bot.adventureCommitTimer || 0) - dt);
        bot.campExitTimer = Math.max(0, Number(bot.campExitTimer || 0) - dt);
        if (bot.lootTradeCooldown <= 0 && Array.isArray(bot.botInventory) && bot.botInventory.length) {
          bot.lootTradeCooldown = 5.0 + Math.random() * 5.0;
          this.tradeBotGearWithOtherBots?.(bot, { silent: true });
        }
        if (this.isBotInParty?.(bot)) return false;
        this.updateBotEconomyRoutine?.(bot, dt);
        if (this.updateBotDungeonRoutine?.(bot, dt)) return true;
        if (this.updateBotQuestRoutine?.(bot, dt)) return true;
        return false;
      };

      Game.prototype.removeBotPlayer = function(bot) {
        if (!bot) return false;
        const id = String(bot.botId || bot.remoteId || bot.id || '');
        this.botPlayers = (this.botPlayers || []).filter(entry => entry !== bot && String(entry?.botId || entry?.remoteId || entry?.id || '') !== id);
        this.entities = (this.entities || []).filter(entry => entry !== bot);
        this.botPartyMembers?.delete?.(bot.botId || bot.remoteId || bot.id);
        this.partyMembers?.delete?.(bot.botId || bot.remoteId || bot.id);
        this.clearBotCooperationState?.(bot, { leaveParty: true });
        if (bot.pet && Array.isArray(this.entities)) this.entities = this.entities.filter(entry => entry !== bot.pet);
        if (bot.pet && this.pet === bot.pet) this.pet = null;
        bot.alive = false;
        bot.command = 'dismissed';
        bot.botState = 'dismissed';
        bot.currentActivityLabel = 'Dismissed';
        this.forgetDpsContributorForActor?.(bot, 'bot removed');
        this.dpsMeterSystem?.pruneInvalidContributors?.('bot removed');
        this.ensureBotSquads?.();
        this.partyPanelDirty = true;
        this.botHudDirty = true;
        return true;
      };

      Game.prototype.isBotInParty = function(botOrId) {
        if (!(this.botPartyMembers instanceof Set)) {
          this.botPartyMembers = new Set(Array.isArray(this.botPartyMembers) ? this.botPartyMembers.map(String) : []);
        }
        const id = typeof botOrId === 'string' ? botOrId : (botOrId?.botId || botOrId?.remoteId || botOrId?.id);
        return Boolean(id && this.botPartyMembers.has(String(id)));
      };


      Game.prototype.partyBotFormationOffset = function(bot, index = 0) {
        const roleOffsets = {
          tank: { x: 1.15, y: 0.22 },
          healer: { x: -1.35, y: 1.05 },
          support: { x: -1.20, y: -1.04 },
          rangedDps: { x: -1.65, y: 0.05 },
          casterDps: { x: -1.65, y: 0.05 },
          meleeDps: { x: 0.82, y: -1.16 }
        };
        const roleKey = BotRoles.partyFormationRole?.(bot?.role) || bot?.role;
        const base = roleOffsets[roleKey] || roleOffsets.meleeDps;
        const ring = 0.34 + Math.floor(Math.max(0, index) / 5) * 0.24;
        const seed = Number(bot?.appearanceSeed || 0);
        const angle = (Math.max(0, index) * 2.39996323) + seed;
        return { x: base.x + Math.cos(angle) * ring, y: base.y + Math.sin(angle) * ring };
      };

      Game.prototype.syncPartyBotsToPlayerZone = function(options = {}) {
        // V0.13.3: bot-only callers are kept for compatibility, but party-system
        // owns the actual companion transition path so merc, pet, and party bots
        // cannot drift into different active-zone lists after cave/dungeon refreshes.
        if (typeof this.syncPartyCompanionsToPlayerZone === 'function') {
          return this.syncPartyCompanionsToPlayerZone(options);
        }
        if (!this.player || !Array.isArray(this.botPlayers)) return 0;
        const zone = options.zone || this.currentZone || 'overworld';
        const bots = this.botPlayers.filter(bot => bot && bot.alive !== false && this.isBotInParty?.(bot));
        let moved = 0;
        bots.forEach((bot, index) => {
          const offset = this.partyBotFormationOffset?.(bot, index) || { x: -1 - index * 0.35, y: 0.8 + index * 0.25 };
          bot.zone = zone;
          bot.x = (this.player.x || 0) + offset.x;
          bot.y = (this.player.y || 0) + offset.y;
          bot.vx = 0;
          bot.vy = 0;
          bot.botState = zone === 'dungeon' ? 'following-dungeon-party' : (zone === 'cave' ? 'following-cave-party' : 'following-party');
          bot.currentActivityLabel = zone === 'dungeon' ? 'In Dungeon Party' : (zone === 'cave' ? 'In Cave Party' : 'Following Party');
          if (!Array.isArray(this.entities)) this.entities = [];
          if (!this.entities.includes(bot)) this.entities.push(bot);
          moved += 1;
        });
        return moved;
      };

      Game.prototype.inviteBotToParty = function(botOrId, options = {}) {
        this.normalizeBotState?.();
        const bot = typeof botOrId === 'string'
          ? this.botPlayers.find(entry => entry.botId === botOrId || entry.remoteId === botOrId || entry.id === botOrId)
          : botOrId;
        if (!bot) return false;
        if (!this.isBotInParty?.(bot) && !options.force) {
          const decision = this.evaluateBotPartyInvite?.(bot, options) || { accepted: true, reason: 'available' };
          if (!decision.accepted) {
            const eventType = decision.reason === 'party_full' ? 'partyFull' : 'inviteReject';
            this.queueBotSpeechEvent?.(bot, eventType, { priority: 3, required: true });
            if (!options.silent) this.logParty?.(`${bot.name || 'Bot'}: ${this.botPartyInviteReasonText?.(bot, decision.reason) || String(decision.reason || 'unavailable').replace(/_/g, ' ')}`);
            return false;
          }
          bot.lastPartyInviteReason = decision.reason;
        }
        this.ensureLocalParty?.();
        const id = bot.botId || bot.remoteId || bot.id;
        if (!this.isBotInParty?.(bot)) {
          const count = this.currentBotPartyCount?.() || 0;
          const maxSlots = this.botPartyMaxBotSlots?.() ?? BOT_PARTY_MAX_BOTS;
          if (count >= maxSlots && !options.force) {
            if (!options.silent) this.logParty?.(`Bot party slots are full (${count}/${maxSlots}).`);
            return false;
          }
        }
        const oldAutonomousPartyId = bot.botPartyId || bot.squadId || null;
        if (oldAutonomousPartyId && this.botSquads?.has?.(oldAutonomousPartyId)) {
          const oldParty = this.botSquads.get(oldAutonomousPartyId);
          oldParty.memberIds = (oldParty.memberIds || []).filter(memberId => String(memberId) !== String(id));
          if (oldParty.memberIds.length < 2) {
            for (const ally of this.botPlayers || []) if ((ally.botPartyId || ally.squadId) === oldAutonomousPartyId) this.clearBotCooperationState?.(ally, { leaveParty: true });
            this.botSquads.delete(oldAutonomousPartyId);
          }
        }
        this.clearBotCooperationState?.(bot, { leaveParty: true });
        this.botPartyMembers.add(String(id));
        this.rememberPartyMemberOrder?.(id);
        this.partyMembers?.delete?.(String(id));
        bot.partyId = this.partyId;
        bot.command = 'party';
        bot.squadId = null;
        bot.botPartyId = null;
        bot.autonomousPartyId = null;
        bot.botState = 'joining-party';
        bot.currentActivityLabel = 'Joining Party';
        this.queueBotSpeechEvent?.(bot, 'joinParty', { priority: 3, required: true });
        if ((this.getPartyRoster?.() || []).length >= 4) this.maybeQueuePartyBanter?.('partyGrowing', { priority: 2 });
        this.partyPanelDirty = true;
        this.botHudDirty = true;
        if (!options.silent) this.logParty?.(`${bot.name} joined the party. ${this.botPartyInviteReasonText?.(bot, bot.lastPartyInviteReason || 'available') || ''}`);
        return true;
      };

      Game.prototype.removeBotFromParty = function(botOrId) {
        this.normalizeBotState?.();
        const bot = typeof botOrId === 'string'
          ? this.botPlayers.find(entry => entry.botId === botOrId || entry.remoteId === botOrId)
          : botOrId;
        const id = typeof botOrId === 'string' ? botOrId : (bot?.botId || bot?.remoteId);
        if (!id) return false;
        this.botPartyMembers.delete(String(id));
        this.forgetPartyMemberOrder?.(id);
        this.partyMembers?.delete?.(String(id));
        if (this.player?.targetId === bot?.id) this.player.targetId = null;
        if (bot) {
          this.clearBotCooperationState?.(bot, { leaveParty: true });
          bot.partyId = null;
          bot.command = 'autonomous';
          bot.botState = 'questing';
          bot.currentActivityLabel = 'Questing';
          bot.lastSocialLine = 'Back to my own route.';
        }
        this.partyPanelDirty = true;
        this.botHudDirty = true;
        this.logParty?.(`${bot?.name || 'Bot'} left the party.`);
        return true;
      };

      Game.prototype.botIdForParty = function(bot) {
        return String(bot?.botId || bot?.remoteId || bot?.id || '');
      };

      Game.prototype.clearBotCooperationState = function(bot, options = {}) {
        if (!bot) return false;
        bot.targetId = null;
        bot.botCombatTargetId = null;
        bot.objectiveEnemyId = null;
        bot.adventureTargetId = null;
        bot.combatPath = null;
        bot.path = null;
        bot.pathGoal = null;
        if (options.leaveParty) {
          bot.botPartyId = null;
          bot.autonomousPartyId = null;
          bot.squadId = null;
        }
        if (!this.isEntityInCombat?.(bot)) {
          bot.combatCooldown = 0;
          bot.attackAiTimer = 0;
        }
        return true;
      };

      Game.prototype.isBotAvailableForAutonomousParty = function(bot) {
        if (!alive(bot)) return false;
        if (this.isBotInParty?.(bot)) return false;
        if (this.isBotTemporarilyBusy?.(bot)) return false;
        if (bot.command === 'dismissed' || bot.botState === 'dismissed' || bot.botState === 'downed') return false;
        return true;
      };

      Game.prototype.botAutonomousPartyRoute = function(party, leader = null) {
        if (!party) return null;
        const routes = BOT_AUTONOMOUS_ROUTE_OFFSETS;
        const identity = `${party.id || ''}:${party.leaderId || leader?.botId || leader?.name || 'party'}`;
        const routeIndex = Number.isFinite(Number(party.routeIndex))
          ? Math.max(0, Math.floor(Number(party.routeIndex)) % routes.length)
          : stableStringIndex(identity, routes.length);
        party.routeIndex = routeIndex;
        party.route = party.route || clone(routes[routeIndex]);
        if (!party.goal || party.goal === 'questing') party.goal = party.route.goal || BOT_SQUAD_GOALS[routeIndex % BOT_SQUAD_GOALS.length] || 'questing';
        return party.route;
      };

      Game.prototype.botAutonomousPartyMemberOffset = function(bot, party = null) {
        const members = party?.memberIds || [];
        const id = this.botIdForParty?.(bot) || String(bot?.botId || bot?.remoteId || bot?.id || '');
        const slot = Math.max(0, members.map(String).indexOf(String(id)));
        const count = Math.max(1, members.length || 1);
        const angle = (slot / count) * Math.PI * 2 + ((Number(party?.routeIndex) || 0) * 0.71);
        const radius = count <= 1 ? 0 : (1.15 + (slot % 2) * 0.48);
        return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
      };

      Game.prototype.resolveAutonomousBotPartyAdventureAnchor = function(bot) {
        const party = this.botAutonomousPartyFor?.(bot);
        if (!party || !bot) return null;
        const camp = this.botCampAnchor?.() || bot.roamAnchor || { x: bot.x, y: bot.y };
        if (bot.questStage === 'turn-in' || this.shouldBotVisitCamp?.(bot)) return camp;
        const leader = (this.botPlayers || []).find(member => this.botIdForParty?.(member) === party.leaderId) || bot;
        const route = this.botAutonomousPartyRoute?.(party, leader) || BOT_AUTONOMOUS_ROUTE_OFFSETS[0];
        const plan = this.botCurrentQuestPlan?.(leader) || this.botCurrentQuestPlan?.(bot);
        const nowMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const memberOffset = this.botAutonomousPartyMemberOffset?.(bot, party) || { x: 0, y: 0 };

        const committed = party.adventureTargetId || party.combatTargetId;
        const committedEnemy = committed ? (this.enemies || []).find(enemy => enemy?.alive && enemy.id === committed) : null;
        if (committedEnemy && this.enemyMatchesBotQuest?.(committedEnemy, bot)) {
          bot.objectiveEnemyId = committedEnemy.id;
          bot.adventureTargetId = committedEnemy.id;
          party.anchor = { x: committedEnemy.x, y: committedEnemy.y };
          party.objectiveExpiresAt = nowMs + 4500;
          return { x: committedEnemy.x + memberOffset.x, y: committedEnemy.y + memberOffset.y, enemyId: committedEnemy.id, type: 'hunt' };
        }

        if (Number(party.objectiveExpiresAt || 0) > nowMs && party.anchor) {
          return { x: Number(party.anchor.x) + memberOffset.x, y: Number(party.anchor.y) + memberOffset.y, type: party.anchor.type || 'quest' };
        }

        if (plan?.task === 'kill') {
          const routeAnchor = { x: camp.x + Number(route.x || 0), y: camp.y + Number(route.y || 0) };
          const usedTargets = new Set();
          for (const other of this.botSquads?.values?.() || []) {
            if (other === party) continue;
            if (other.adventureTargetId) usedTargets.add(String(other.adventureTargetId));
            if (other.combatTargetId) usedTargets.add(String(other.combatTargetId));
          }
          let best = null;
          let bestScore = Infinity;
          for (const enemy of (this.queryEnemiesNearEntity?.(leader, 140) || this.enemies || [])) {
            if (!enemy?.alive || !this.enemyMatchesBotQuest?.(enemy, bot)) continue;
            if (dist(enemy, camp) < Math.max(8, this.botCampRadius?.() || 7.5)) continue;
            const levelDelta = Math.abs(Number(enemy.level || 1) - safeLevel(bot));
            const usedPenalty = usedTargets.has(String(enemy.id || '')) ? 42 : 0;
            const combatBias = (enemy.aggro || enemy.hp < enemy.maxHp || Number(enemy.combatCooldown || 0) > 0) ? -2.5 : 0;
            const jitter = stableStringIndex(`${party.id}:${enemy.id || enemy.name}`, 11) * 0.18;
            const score = dist(routeAnchor, enemy) * 0.72 + dist(leader, enemy) * 0.18 + levelDelta * 1.8 + usedPenalty + (enemy.elite ? 4.5 : 0) + combatBias + jitter;
            if (score < bestScore) { best = enemy; bestScore = score; }
          }
          if (best) {
            party.adventureTargetId = best.id;
            party.anchor = { x: best.x, y: best.y, type: 'hunt' };
            party.objectiveExpiresAt = nowMs + 5200;
            bot.objectiveEnemyId = best.id;
            bot.adventureTargetId = best.id;
            return { x: best.x + memberOffset.x, y: best.y + memberOffset.y, enemyId: best.id, type: 'hunt' };
          }
        }

        const anchor = { x: camp.x + Number(route.x || 0), y: camp.y + Number(route.y || 0), type: plan?.task === 'gather' ? 'gather' : (route.goal || 'quest') };
        party.anchor = anchor;
        party.objectiveExpiresAt = nowMs + 6500 + stableStringIndex(party.id || party.leaderId, 1500);
        bot.adventureAnchor = { x: anchor.x + memberOffset.x, y: anchor.y + memberOffset.y, type: anchor.type };
        return bot.adventureAnchor;
      };

      Game.prototype.botAutonomousPartyForId = function(partyId) {
        if (!(this.botSquads instanceof Map)) this.botSquads = new Map();
        this.botPartyGroups = this.botSquads;
        return partyId ? this.botSquads.get(String(partyId)) || null : null;
      };

      Game.prototype.botAutonomousPartyFor = function(bot) {
        if (!bot || this.isBotInParty?.(bot)) return null;
        const id = bot.botPartyId || bot.squadId || null;
        return this.botAutonomousPartyForId?.(id);
      };

      Game.prototype.getAutonomousBotPartyMembers = function(bot, options = {}) {
        const party = this.botAutonomousPartyFor?.(bot);
        if (!party) return [bot].filter(Boolean);
        const ids = new Set(party.memberIds || []);
        const range = Number.isFinite(Number(options.range)) ? Number(options.range) : Infinity;
        return (this.botPlayers || [])
          .filter(entry => alive(entry) && !this.isBotInParty?.(entry) && ids.has(this.botIdForParty?.(entry)))
          .filter(entry => !Number.isFinite(range) || entry === bot || dist(entry, bot) <= range);
      };

      Game.prototype.autonomousBotPartyComposition = function(members = []) {
        const roleFor = actor => String(actor?.role || actor?.className || '').toLowerCase();
        const count = predicate => members.filter(member => predicate(roleFor(member))).length;
        const healerCount = count(role => BotRoles.isHealingSupportRole?.(role) || /cleric|healer|druid|bard/.test(role));
        const tankCount = count(role => BotRoles.isTankRole?.(role) || /paladin|warden|tank|guardian/.test(role));
        const supportCount = count(role => BotRoles.isSupportRole?.(role) || /bard|enchanter|support|control/.test(role));
        return {
          size: members.length,
          healerCount,
          tankCount,
          supportCount,
          needsHealer: healerCount < 1,
          needsTank: tankCount < 1,
          needsSupport: supportCount < 1
        };
      };

      Game.prototype.scoreBotAutonomousPartyInvite = function(leader, candidate, members = []) {
        if (!leader || !candidate || leader === candidate) return Infinity;
        if (!this.isBotAvailableForAutonomousParty?.(candidate)) return Infinity;
        if (candidate.botPartyId || candidate.squadId) return Infinity;
        if (leader.zone && candidate.zone && leader.zone !== candidate.zone) return Infinity;
        const d = dist(leader, candidate);
        if (d > BOT_PARTY_INVITE_RADIUS) return Infinity;
        const composition = this.autonomousBotPartyComposition?.(members) || {};
        const role = String(candidate.role || candidate.className || '').toLowerCase();
        let score = d;
        if (composition.needsTank && (BotRoles.isTankRole?.(candidate.role) || /paladin|warden|tank|guardian/.test(role))) score -= 7;
        if (composition.needsHealer && (BotRoles.isHealingSupportRole?.(candidate.role) || /cleric|healer|druid|bard/.test(role))) score -= 8;
        if (composition.needsSupport && (BotRoles.isSupportRole?.(candidate.role) || /bard|enchanter|support|control/.test(role))) score -= 4;
        score += Math.abs(safeLevel(candidate) - safeLevel(leader)) * 1.5;
        return score;
      };

      Game.prototype.botAutonomousPartyName = function(party) {
        if (!party) return 'Bot Party';
        const leader = (this.botPlayers || []).find(bot => this.botIdForParty?.(bot) === party.leaderId);
        return `${leader?.name || 'Bot'}'s Party`;
      };

      Game.prototype.createAutonomousBotParty = function(leader, invited = [], options = {}) {
        if (!this.isBotAvailableForAutonomousParty?.(leader)) return null;
        if (!(this.botSquads instanceof Map)) this.botSquads = new Map();
        this.botPartyGroups = this.botSquads;
        const leaderId = this.botIdForParty?.(leader);
        if (!leaderId) return null;
        const partyId = options.partyId || `bot-party-${leaderId}-${Date.now().toString(36)}`;
        const members = [leader, ...invited]
          .filter((bot, index, list) => bot && list.indexOf(bot) === index)
          .filter(bot => this.isBotAvailableForAutonomousParty?.(bot))
          .slice(0, BOT_AUTONOMOUS_PARTY_MAX_SIZE);
        if (members.length < 2) return null;
        const memberIds = [];
        for (const bot of members) {
          const id = this.botIdForParty?.(bot);
          if (!id) continue;
          memberIds.push(id);
          bot.botPartyId = partyId;
          bot.autonomousPartyId = partyId;
          bot.squadId = partyId;
          bot.partyId = null;
          bot.command = 'autonomous-party';
          bot.botState = bot === leader ? 'bot-party-leader' : 'bot-party-member';
          bot.currentActivityLabel = bot === leader ? 'Leading Bot Party' : 'In Bot Party';
          bot.lastSocialLine = bot === leader ? 'Forming a party.' : `${leader.name || 'Leader'} invited me.`;
        }
        const party = {
          id: partyId,
          leaderId,
          memberIds,
          goal: leader.behaviorGoal || 'questing',
          combatTargetId: null,
          combatTargetTimer: 0,
          playerInviteCooldown: Math.max(8, Number(options.playerInviteCooldown || 12)),
          routeIndex: Number.isFinite(Number(options.routeIndex)) ? Math.floor(Number(options.routeIndex)) : stableStringIndex(partyId, BOT_AUTONOMOUS_ROUTE_OFFSETS.length),
          route: null,
          adventureTargetId: null,
          objectiveExpiresAt: 0,
          anchor: clone(leader.roamAnchor || { x: leader.x, y: leader.y })
        };
        this.botAutonomousPartyRoute?.(party, leader);
        this.botSquads.set(partyId, party);
        this.botHudDirty = true;
        return party;
      };

      Game.prototype.ensureBotSquads = function() {
        this.normalizeBotState?.();
        if (!(this.botSquads instanceof Map)) this.botSquads = new Map();
        this.botPartyGroups = this.botSquads;
        const available = (this.botPlayers || []).filter(bot => this.isBotAvailableForAutonomousParty?.(bot));
        const known = new Set(available.map(bot => this.botIdForParty?.(bot)).filter(Boolean));
        for (const [id, party] of [...this.botSquads.entries()]) {
          party.memberIds = (party.memberIds || []).map(String).filter(memberId => known.has(memberId));
          if (party.memberIds.length < 2) {
            for (const bot of available) {
              if ((bot.botPartyId || bot.squadId) === id) this.clearBotCooperationState?.(bot, { leaveParty: true });
            }
            this.botSquads.delete(id);
            continue;
          }
          for (const bot of available) if (party.memberIds.includes(this.botIdForParty?.(bot))) {
            bot.botPartyId = id;
            bot.autonomousPartyId = id;
            bot.squadId = id;
            if (bot.command !== 'autonomous-party') bot.command = 'autonomous-party';
          }
        }

        // Rebuild saved autonomous bot-party maps from bot.botPartyId when loading old/save data.
        const orphanParties = new Map();
        for (const bot of available) {
          const id = bot.botPartyId || bot.squadId;
          if (!id || this.botSquads.has(String(id))) continue;
          const list = orphanParties.get(String(id)) || [];
          list.push(bot);
          orphanParties.set(String(id), list);
        }
        for (const [partyId, members] of orphanParties.entries()) {
          if (members.length < 2) {
            members.forEach(bot => this.clearBotCooperationState?.(bot, { leaveParty: true }));
            continue;
          }
          const leader = members[0];
          this.botSquads.set(partyId, {
            id: partyId,
            leaderId: this.botIdForParty?.(leader),
            memberIds: members.map(bot => this.botIdForParty?.(bot)).filter(Boolean).slice(0, BOT_AUTONOMOUS_PARTY_MAX_SIZE),
            goal: leader.behaviorGoal || 'questing',
            combatTargetId: null,
            combatTargetTimer: 0,
            playerInviteCooldown: 12,
            routeIndex: stableStringIndex(partyId, BOT_AUTONOMOUS_ROUTE_OFFSETS.length),
            route: null,
            adventureTargetId: null,
            objectiveExpiresAt: 0,
            anchor: clone(leader.roamAnchor || { x: leader.x, y: leader.y })
          });
          this.botAutonomousPartyRoute?.(this.botSquads.get(partyId), leader);
        }

        const ungrouped = available.filter(bot => !(bot.botPartyId || bot.squadId));
        for (const leader of ungrouped) {
          if ((leader.botPartyInviteCooldown || 0) > 0) continue;
          const members = [leader];
          const candidates = ungrouped
            .filter(bot => bot !== leader && !(bot.botPartyId || bot.squadId))
            .map(bot => ({ bot, score: this.scoreBotAutonomousPartyInvite?.(leader, bot, members) ?? Infinity }))
            .filter(entry => Number.isFinite(entry.score))
            .sort((a, b) => a.score - b.score)
            .slice(0, Math.max(1, BOT_AUTONOMOUS_PARTY_MAX_SIZE - 1))
            .map(entry => entry.bot);
          if (!candidates.length) {
            leader.botPartyInviteCooldown = 7 + Math.random() * 7;
            continue;
          }
          const party = this.createAutonomousBotParty?.(leader, candidates);
          if (party) {
            leader.botPartyInviteCooldown = 24 + Math.random() * 12;
            for (const bot of candidates) bot.botPartyInviteCooldown = 18 + Math.random() * 10;
          }
        }

        this.maybeOfferPlayerBotPartyInvite?.();
        return this.botSquads;
      };

      Game.prototype.botSquadComplement = function(leader, candidates, takenIds) {
        const taken = new Set(takenIds);
        return candidates
          .filter(bot => bot !== leader && !taken.has(this.botIdForParty?.(bot)) && !(bot.botPartyId || bot.squadId))
          .map(bot => ({ bot, score: this.scoreBotAutonomousPartyInvite?.(leader, bot, [leader]) ?? Infinity }))
          .filter(entry => Number.isFinite(entry.score))
          .sort((a, b) => a.score - b.score)
          .map(entry => entry.bot)
          .slice(0, Math.max(0, BOT_AUTONOMOUS_PARTY_MAX_SIZE - 1));
      };

      Game.prototype.botSquadFor = function(bot) {
        return this.botAutonomousPartyFor?.(bot);
      };

      Game.prototype.getBotSquadMembers = function(bot, options = {}) {
        return this.getAutonomousBotPartyMembers?.(bot, options) || [bot].filter(Boolean);
      };

      Game.prototype.markBotSquadCombat = function(bot, enemy) {
        if (!bot || !enemy?.alive) return false;
        const party = this.botAutonomousPartyFor?.(bot);
        if (!party) return false;
        party.combatTargetId = enemy.id;
        party.combatTargetTimer = 5.5;
        this.botHudDirty = true;
        return true;
      };

      Game.prototype.resolveBotAssistTarget = function(bot, options = {}) {
        if (!bot) return null;
        const range = Number.isFinite(Number(options.range)) ? Number(options.range) : 11.5;
        if (this.isBotInParty?.(bot)) {
          const command = String(bot.botPartyCommand || bot.commandState || 'follow').toLowerCase().replace(/^party$/, 'follow');
          if (command === 'passive' || command === 'follow') return null;
          const assist = this.resolvePartyAssistTarget?.(bot, { range, preferPlayerTarget: true, allowUnengagedPlayerTarget: command === 'attack' });
          if (assist?.alive && isBotHostileCombatActor(this, assist)) return assist;
          return null;
        }
        if (options.includeAutonomousSquad === false) return null;
        const party = this.botAutonomousPartyFor?.(bot);
        if (!party) return null;
        const activeId = party.combatTargetId;
        const active = activeId ? (this.enemies || []).find(enemy => enemy.id === activeId && enemy.alive) : null;
        if (active && dist(bot, active) <= range) return active;
        const members = this.getAutonomousBotPartyMembers?.(bot, { range: 14 }) || [bot];
        let best = null;
        let bestScore = Infinity;
        for (const enemy of (this.queryEnemiesNearEntity?.(bot, range + 8) || this.enemies || [])) {
          if (!enemy?.alive) continue;
          const damaged = enemy.hp < enemy.maxHp || enemy.aggro || (enemy.combatCooldown || 0) > 0;
          if (!damaged) continue;
          const nearMember = members.some(member => dist(member, enemy) <= range);
          if (!nearMember) continue;
          const targetedPartyMember = members.some(member => this.pickEnemyTarget?.(enemy) === member);
          const score = dist(bot, enemy) + (targetedPartyMember ? -3 : 0) + (enemy.elite ? 1.5 : 0);
          if (score < bestScore) { best = enemy; bestScore = score; }
        }
        if (best) {
          this.markBotSquadCombat?.(bot, best);
          return best;
        }
        return null;
      };

      Game.prototype.maybeOfferPlayerBotPartyInvite = function() {
        if (!this.player || this.partyId) return false;
        if (!(this.partyInvites instanceof Map)) this.partyInvites = new Map();
        const now = performance.now();
        const existing = Array.from(this.partyInvites.values()).some(invite => invite.kind === 'bot_party' && Number(invite.expiresAt || 0) > now);
        if (existing) return false;
        let best = null;
        let bestDistance = Infinity;
        for (const party of this.botSquads?.values?.() || []) {
          const members = (party.memberIds || [])
            .map(id => (this.botPlayers || []).find(bot => this.botIdForParty?.(bot) === String(id)))
            .filter(bot => alive(bot) && !this.isBotInParty?.(bot));
          if (members.length < 2 || members.length >= (this.partyMaxSize?.() || BOT_AUTONOMOUS_PARTY_MAX_SIZE)) continue;
          if (Number(party.playerInviteCooldown || 0) > 0) continue;
          const leader = members.find(bot => this.botIdForParty?.(bot) === party.leaderId) || members[0];
          if (!leader || leader.zone !== (this.currentZone || leader.zone)) continue;
          const d = dist(leader, this.player);
          if (d <= BOT_PARTY_PLAYER_INVITE_RADIUS && d < bestDistance) { best = { party, leader, members }; bestDistance = d; }
        }
        if (!best) return false;
        const inviteId = `bot:${best.party.id}`;
        this.partyInvites.set(inviteId, {
          id: inviteId,
          kind: 'bot_party',
          fromId: best.leader.botId || best.leader.remoteId || best.leader.id,
          fromName: best.leader.name || 'Bot Leader',
          fromClassName: best.leader.className || 'Bot',
          leaderClassName: best.leader.className || 'Bot',
          fromLevel: Math.max(1, Math.floor(Number(best.leader.level) || 1)),
          partyId: best.party.id,
          partyLeaderId: best.party.leaderId,
          botPartyId: best.party.id,
          botMemberIds: best.members.map(bot => this.botIdForParty?.(bot)).filter(Boolean),
          expiresAt: now + 30000,
          receivedAt: now
        });
        best.party.playerInviteCooldown = BOT_PARTY_PLAYER_INVITE_COOLDOWN;
        best.leader.botPartyPlayerInviteCooldown = BOT_PARTY_PLAYER_INVITE_COOLDOWN;
        best.leader.lastSocialLine = `Want to join ${best.leader.name || 'our'}'s party?`;
        this.queueBotSpeechEvent?.(best.leader, 'joinParty', { priority: 2, required: false });
        this.logParty?.(`${best.leader.name || 'A bot'} invited you to join their party.`);
        this.partyPanelDirty = true;
        this.renderPartyPanel?.();
        this.renderPartyInvitePopup?.();
        return true;
      };

      Game.prototype.acceptBotPartyInvite = function(invite) {
        if (!invite || invite.kind !== 'bot_party') return false;
        this.normalizeBotState?.();
        this.normalizePartyState?.();
        const party = this.botAutonomousPartyForId?.(invite.botPartyId || invite.partyId);
        const ids = Array.isArray(invite.botMemberIds) ? invite.botMemberIds.map(String) : (party?.memberIds || []).map(String);
        const bots = ids.map(id => (this.botPlayers || []).find(bot => this.botIdForParty?.(bot) === id)).filter(bot => alive(bot));
        if (!bots.length) {
          this.logParty?.('That bot party is no longer nearby.');
          return false;
        }
        const max = this.partyMaxSize?.() || BOT_AUTONOMOUS_PARTY_MAX_SIZE;
        const candidateCount = bots.length + 1;
        if (candidateCount > max) {
          this.logParty?.(`Cannot join ${invite.fromName || 'bot'}'s party. Player/bot party slots are full (${candidateCount}/${max}). Mercenaries and pets do not consume slots.`);
          return false;
        }
        this.partyId = invite.partyId || `party-${this.localPeerId}-${Date.now().toString(36)}`;
        this.partyLeaderId = invite.partyLeaderId || this.botIdForParty?.(bots[0]) || this.localPeerId;
        this.partyMembers = new Set([this.localPeerId]);
        if (!(this.botPartyMembers instanceof Set)) this.botPartyMembers = new Set();
        for (const bot of bots) {
          const id = this.botIdForParty?.(bot);
          if (!id) continue;
          this.botPartyMembers.add(String(id));
          this.rememberPartyMemberOrder?.(id);
          this.clearBotCooperationState?.(bot, { leaveParty: true });
          bot.partyId = this.partyId;
          bot.command = 'party';
          bot.botState = 'joining-party';
          bot.currentActivityLabel = 'Joining Party';
          bot.lastSocialLine = 'Joined your party.';
        }
        if (party) this.botSquads?.delete?.(party.id);
        this.logParty?.(`Joined ${invite.fromName || 'bot'}'s party.`);
        this.partyPanelDirty = true;
        this.botHudDirty = true;
        this.renderPartyPanel?.();
        this.renderPartyHud?.({ force: true });
        return true;
      };

      Game.prototype.ensureBotInspectWindow = function() {
        let panel = document.getElementById('botInspectPanel');
        if (panel) return panel;
        panel = document.createElement('div');
        panel.id = 'botInspectPanel';
        panel.className = 'panel characterPanel gameWindow botInspectPanel';
        panel.style.display = 'none';
        panel.style.position = 'fixed';
        panel.style.left = '50%';
        panel.style.top = '50%';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.transform = 'translate(-50%, -50%)';
        panel.style.width = 'min(940px, calc(100vw - 30px))';
        panel.style.height = 'min(720px, calc(100vh - 36px))';
        panel.style.maxHeight = 'min(720px, calc(100vh - 36px))';
        panel.style.overflow = 'hidden';
        panel.style.zIndex = '84';
        panel.innerHTML = `
          <div class="panelTitle" data-window-drag-handle><span data-bot-inspect-title>Bot Player</span><button data-bot-inspect-close>Close</button></div>
          <div class="small" data-bot-inspect-summary></div>
          <div data-bot-inspect-body></div>`;
        document.body.appendChild(panel);
        panel.querySelector('[data-bot-inspect-close]')?.addEventListener('click', () => { panel.style.display = 'none'; });
        return panel;
      };

      Game.prototype.botGearSlotHtml = function(bot, slot) {
        const item = bot?.botEquipment?.[slot] || null;
        const label = (DR.SLOT_LABELS || {})[slot] || slot;
        if (!item) return `<div class="equipSlot sheetSlot"><span class="slotLabel">${escapeHtml(label)}</span><span class="itemMeta">Empty</span></div>`;
        const color = item.rarity?.color || item.color || '#cfdac8';
        const icon = this.itemIconHtml?.(item, 'equipIcon generatedIcon') || `<div class="equipIcon generatedIcon" style="--icon-color:${escapeHtml(color)}">?</div>`;
        return `<div class="equipSlot sheetSlot itemSlot" data-item-tooltip="1" data-bot-gear-slot="${escapeHtml(slot)}" style="--rarity-color:${escapeHtml(color)};--icon-color:${escapeHtml(color)}"><span class="slotLabel">${escapeHtml(label)}</span>${icon}<span class="itemName">${escapeHtml(itemName(item))}</span></div>`;
      };

      Game.prototype.renderBotInspectWindow = function(bot) {
        const panel = this.ensureBotInspectWindow?.();
        if (!panel || !bot) return false;
        this.normalizeBotInventory?.(bot);
        const title = panel.querySelector('[data-bot-inspect-title]');
        const summary = panel.querySelector('[data-bot-inspect-summary]');
        const body = panel.querySelector('[data-bot-inspect-body]');
        const party = this.isBotInParty?.(bot) ? 'In your party' : (bot.squadId ? 'Bot group' : 'Solo');
        const quest = bot.currentQuestId ? `${questDraftName(bot.currentQuestId)} ${bot.questProgress || 0}/${bot.questRequired || 1}` : (bot.questName || 'Questing');
        const slotsLeft = ['head', 'shoulders', 'chest', 'legs', 'hands', 'feet', 'cape'];
        const slotsRight = ['amulet', 'earring1', 'earring2', 'ring1', 'ring2', 'weapon', 'offhand', 'charm'];
        const carriedItems = (bot.botInventory || []).filter(Boolean);
        const carried = carriedItems.slice(0, 8).map(item => {
          const color = item?.rarity?.color || item?.color || '#cfdac8';
          return `<div class="itemSlot compactItem" data-item-tooltip="1" data-bot-carried-index="${carriedItems.indexOf(item)}" style="--rarity-color:${escapeHtml(color)};--icon-color:${escapeHtml(color)}">${this.itemIconHtml?.(item, 'equipIcon generatedIcon') || ''}<span>${escapeHtml(itemName(item))}</span></div>`;
        }).join('') || '<div class="small">No carried gear.</div>';
        const carriedMore = carriedItems.length > 8 ? `<div class="small" style="margin-top:4px">+${carriedItems.length - 8} more in Trade.</div>` : '';
        const stats = [
          ['HP', `${Math.ceil(bot.hp || 0)} / ${Math.ceil(bot.maxHp || 0)}`, 'current survivability'],
          ['Mana', `${Math.ceil(bot.mana || 0)} / ${Math.ceil(bot.maxMana || 0)}`, 'current resource'],
          ['Attack', Math.round(bot.attack || 0), 'base + equipped gear'],
          ['Defense', Math.round(bot.defense || 0), 'base + equipped gear'],
          ['Gear Score', Math.round(bot.gearScore || 0), 'computed from equipped items'],
          ['Gold', Math.floor(bot.gold || 0), `Junk ${Math.floor(bot.junkValue || 0)} · Fragments ${Math.floor(bot.upgradeFragments || 0)}`],
          ['Personality', String(bot.personalityId || 'steady').replace(/(^|_)\w/g, part => part.toUpperCase()), this.botPersonalityProfile?.(bot)?.speechBias || 'calm'],
          ['Quest', quest, bot.questStage || 'active'],
          ['Activity', bot.currentActivityLabel || bot.botState || 'Ready', this.actorIsMeditating?.(bot) ? `Meditating: ${bot.meditationIntent || 'resting'}` : party]
        ];
        if (title) title.textContent = `${bot.name || 'Bot'} · Bot Inspection`;
        if (summary) summary.textContent = `Level ${Math.floor(bot.level || 1)} ${bot.className || 'Fighter'} · ${bot.role || 'dps'} · ${party}`;
        if (body) body.innerHTML = `
          <div class="botInspectLayout">
            <section class="sheetPanel">
              <div class="sheetPanelTitle">Bot Equipment</div>
              <div class="botInspectEquipment">
                <div class="equipColumn">${slotsLeft.map(slot => this.botGearSlotHtml(bot, slot)).join('')}</div>
                <div class="dollCenter">
                  ${(window.DreamRealms?.classEmblemMarkup?.(bot.className || 'Fighter', { size: 64, className: 'sheetClassEmblem', title: `${bot.className || 'Fighter'} emblem` })) || `<div class="classEmblemIcon">${escapeHtml((bot.className || 'B').slice(0, 1))}</div>`}
                  <div class="paperDollCaption">${escapeHtml(bot.name || 'Bot')}<br>${escapeHtml(bot.className || 'Fighter')} · ${escapeHtml(bot.role || 'dps')}</div>
                  <button data-bot-trade-player style="margin-top:8px;width:100%">Open Trade</button>
                </div>
                <div class="equipColumn">${slotsRight.map(slot => this.botGearSlotHtml(bot, slot)).join('')}</div>
              </div>
            </section>
            <section class="sheetPanel">
              <div class="sheetPanelTitle">Bot Stats / Routine</div>
              <div class="botInspectStats">${stats.map(([label, value, sub]) => `<div class="statCard"><strong>${escapeHtml(label)}</strong><div>${escapeHtml(String(value))}</div><div class="small">${escapeHtml(String(sub || ''))}</div></div>`).join('')}</div>
              <div class="setBonusBox botInspectCarry"><div class="sheetPanelTitle" style="margin-bottom:5px">Carried Trade Gear</div><div class="inventoryGrid">${carried}</div>${carriedMore}</div>
            </section>
          </div>`;
        body?.querySelector('[data-bot-trade-player]')?.addEventListener('click', () => { this.openBotTradeWindow?.(bot); });
        this.bindItemTooltips?.(panel, node => {
          const gearSlot = node.dataset.botGearSlot;
          if (gearSlot) return bot.botEquipment?.[gearSlot] || null;
          const carriedIndex = node.dataset.botCarriedIndex;
          if (carriedIndex != null) return (bot.botInventory || [])[Number(carriedIndex)] || null;
          return null;
        }, { source: 'bot-inspect' });
        panel.style.display = 'block';
        return true;
      };

      Game.prototype.inspectBotPlayer = function(botOrId) {
        const bot = typeof botOrId === 'string'
          ? (this.botPlayers || []).find(entry => entry.botId === botOrId || entry.remoteId === botOrId)
          : botOrId;
        if (!bot) return false;
        return this.renderBotInspectWindow?.(bot) || false;
      };

      Game.prototype.getBotPartyActors = function(options = {}) {
        this.normalizeBotState?.();
        const anchor = options.anchor || this.player;
        const range = Number.isFinite(Number(options.range)) ? Number(options.range) : Infinity;
        return (this.botPlayers || [])
          .filter(bot => alive(bot) && this.isBotInParty?.(bot) && !this.isBotTemporarilyBusy?.(bot))
          .filter(bot => !anchor || !Number.isFinite(range) || dist(bot, anchor) <= range)
          .map(bot => ({ id: bot.botId || bot.remoteId, type: 'bot', actor: bot }));
      };

      Game.prototype.botSnapshot = function(bot) {
        const meditating = this.actorIsMeditating?.(bot) === true;
        return {
          id: bot.botId || bot.remoteId,
          name: bot.name,
          className: bot.className,
          role: bot.role,
          botClassAiProfileId: bot.botClassAiProfileId || this.resolveBotClassId?.(bot),
          botTypeLabel: bot.botTypeLabel || bot.displayTypeLabel || botTypeLabelForClass(bot.className),
          botPartyCommand: bot.botPartyCommand || '',
          recruitedByPlayer: Boolean(bot.recruitedByPlayer),
          dismissable: bot.dismissable !== false,
          recruiterNpcId: bot.recruiterNpcId || null,
          level: safeLevel(bot),
          hp: Math.ceil(bot.hp || 0),
          maxHp: Math.ceil(bot.maxHp || 1),
          mana: Math.ceil(bot.mana || 0),
          maxMana: Math.ceil(bot.maxMana || 0),
          xp: Math.floor(bot.xp || 0),
          nextXp: Math.floor(bot.nextXp || 1),
          gearScore: Math.floor(bot.gearScore || 0),
          questName: bot.questName || '',
          questProgress: bot.questProgress || 0,
          questRequired: bot.questRequired || 1,
          botState: meditating ? 'idle' : (bot.botState || 'idle'),
          command: bot.command || 'autonomous',
          personalityId: normalizedPersonalityId(bot.personalityId, bot),
          behaviorGoal: bot.behaviorGoal || bot.goal || 'questing',
          squadId: bot.squadId || null,
          botPartyId: bot.botPartyId || bot.squadId || null,
          botPartyInviteCooldown: Number(bot.botPartyInviteCooldown || 0),
          botPartyPlayerInviteCooldown: Number(bot.botPartyPlayerInviteCooldown || 0),
          appearanceSeed: bot.appearanceSeed,
          alive: bot.alive !== false,
          respawnTimer: Math.max(0, Number(bot.respawnTimer || 0)),
          inParty: this.isBotInParty?.(bot),
          x: Number(bot.x),
          y: Number(bot.y),
          zone: bot.zone || this.currentZone || 'overworld',
          dungeonId: bot.dungeonId || null,
          floorId: bot.floorId || null,
          dungeonFloor: bot.dungeonFloor || null,
          deathZone: bot.deathZone || null,
          deathDungeonId: bot.deathDungeonId || null,
          deathDungeonFloor: bot.deathDungeonFloor || null,
          currentQuestId: bot.currentQuestId || null,
          questStage: bot.questStage || 'active',
          questTaskProgress: clone(bot.questTaskProgress || {}),
          campSupply: Math.round(Number(bot.campSupply || 0)),
          campVisitCooldown: Math.ceil(Number(bot.campVisitCooldown || 0)),
          dungeonIntent: bot.dungeonIntent ? clone(bot.dungeonIntent) : null,
          dungeonRunTimer: Math.ceil(Number(bot.dungeonRunTimer || 0)),
          dungeonCooldown: Math.ceil(Number(bot.dungeonCooldown || 0)),
          dungeonCompletions: Math.max(0, Math.floor(Number(bot.dungeonCompletions || 0))),
          completedQuestIds: Array.isArray(bot.completedQuestIds) ? [...bot.completedQuestIds] : [],
          gold: Math.floor(Number(bot.gold || 0)),
          coinCopper: Math.max(0, Math.floor(Number(bot.coinCopper || 0))),
          junkValue: Math.floor(Number(bot.junkValue || 0)),
          upgradeFragments: Math.floor(Number(bot.upgradeFragments || 0)),
          reputation: Math.floor(Number(bot.reputation || 0)),
          repairDebt: Math.floor(Number(bot.repairDebt || 0)),
          socialMood: bot.socialMood || 'focused',
          currentActivityLabel: meditating ? 'Ready' : (bot.currentActivityLabel || bot.botState || 'Ready'),
          lastSocialLine: bot.lastSocialLine || '',
          socialCooldown: Math.ceil(Number(bot.socialCooldown || 0)),
          economyTimer: Math.ceil(Number(bot.economyTimer || 0)),
          botInventory: clone(bot.botInventory || []),
          botEquipment: clone(bot.botEquipment || {}),
          lootTradeCooldown: Number(bot.lootTradeCooldown || 0),
          tradeRequestCooldown: Number(bot.tradeRequestCooldown || 0),
          meditationIntent: '',
          adventureTargetId: bot.adventureTargetId || bot.objectiveEnemyId || null,
          objectiveEnemyId: bot.objectiveEnemyId || bot.adventureTargetId || null,
          adventureAnchor: bot.adventureAnchor ? clone(bot.adventureAnchor) : null,
          adventureCommitTimer: Number(bot.adventureCommitTimer || 0),
          campExitTimer: Number(bot.campExitTimer || 0),
          worldPresenceTimer: Number(bot.worldPresenceTimer || 0),
          actorAiAccumulator: Number(bot.actorAiAccumulator || 0),
          actorAiInterval: Number(bot.actorAiInterval || 0),
          lastActorAiSkipReason: bot.lastActorAiSkipReason || '',
          lastStableX: Number(bot.lastStableX || bot.x || 0),
          lastStableY: Number(bot.lastStableY || bot.y || 0),
          stuckTimer: Number(bot.stuckTimer || 0),
          botSpellCooldowns: clone(bot.botSpellCooldowns || {}),
          botLastCastName: bot.botLastCastName || '',
          botPendingCastName: bot.botPendingCast?.spellName || '',
          botPendingCastRemaining: Number(bot.botPendingCast?.remaining || 0),
          botPetId: bot.botPet?.id || bot.botPetId || null,
          advancedRoutineAccumulator: Number(bot.advancedRoutineAccumulator || 0),
          advancedRoutineInterval: Number(bot.advancedRoutineInterval || 0),
          hairStyle: bot.hairStyle,
          hairColor: bot.hairColor,
          faceStyle: bot.faceStyle,
          skinTone: bot.skinTone,
          clothesPrimary: bot.clothesPrimary,
          clothesSecondary: bot.clothesSecondary
        };
      };

      Game.prototype.serializeBotPlayerState = function() {
        this.normalizeBotState?.();
        return {
          version: 11,
          scheduler: this.botRuntimeScheduler?.lastStats || null,
          partyMemberIds: Array.from(this.botPartyMembers || []),
          bots: (this.botPlayers || []).map(bot => this.botSnapshot?.(bot)).filter(Boolean)
        };
      };

      Game.prototype.applyBotRuntimeSnapshot = function(bot, entry = {}) {
        if (!bot || !entry || typeof entry !== 'object') return false;
        bot.maxHp = Math.max(1, Math.floor(Number(entry.maxHp) || Number(bot.maxHp) || 1));
        bot.maxMana = Math.max(0, Math.floor(Number(entry.maxMana) || Number(bot.maxMana) || 0));
        bot.hp = clampNumber(entry.hp, 0, bot.maxHp, bot.hp || bot.maxHp);
        bot.mana = clampNumber(entry.mana, 0, bot.maxMana, bot.mana || bot.maxMana || 0);
        bot.alive = entry.alive !== false;
        bot.botState = String(entry.botState || (bot.alive ? bot.botState || 'idle' : 'downed'));
        bot.command = String(entry.command || bot.command || 'autonomous');
        bot.botTypeLabel = entry.botTypeLabel || bot.botTypeLabel || bot.displayTypeLabel || botTypeLabelForClass(bot.className);
        bot.displayTypeLabel = bot.botTypeLabel;
        bot.botPartyCommand = entry.botPartyCommand || bot.botPartyCommand || '';
        this.ensureBotDisplayIdentity?.(bot);
        bot.botPartyId = entry.botPartyId || entry.squadId || bot.botPartyId || null;
        bot.squadId = bot.botPartyId || entry.squadId || bot.squadId || null;
        bot.botPartyInviteCooldown = Math.max(0, Number(entry.botPartyInviteCooldown || bot.botPartyInviteCooldown || 0));
        bot.botPartyPlayerInviteCooldown = Math.max(0, Number(entry.botPartyPlayerInviteCooldown || bot.botPartyPlayerInviteCooldown || 0));
        this.ensureBotPersonality?.(bot, entry.personalityId || bot.personalityId);
        bot.speechBubble = null;
        bot.speechCooldownUntil = 0;
        bot.speechEventCooldowns = {};
        bot.botClassAiProfileId = entry.botClassAiProfileId || this.resolveBotClassId?.(bot) || bot.botClassAiProfileId || 'fighter';
        bot.botSpellCooldowns = entry.botSpellCooldowns && typeof entry.botSpellCooldowns === 'object' ? { ...entry.botSpellCooldowns } : (bot.botSpellCooldowns || {});
        bot.botLastCastName = entry.botLastCastName || bot.botLastCastName || '';
        bot.botPendingCast = null;
        bot.botPetId = entry.botPetId || bot.botPetId || null;
        bot.currentActivityLabel = String(entry.currentActivityLabel || bot.currentActivityLabel || bot.botState || 'Ready');
        bot.zone = entry.zone || bot.zone || this.currentZone || 'overworld';
        bot.dungeonId = entry.dungeonId || bot.dungeonId || null;
        bot.coinCopper = Math.max(0, Math.floor(Number(entry.coinCopper || bot.coinCopper || 0)));
        bot.floorId = entry.floorId || bot.floorId || null;
        bot.dungeonFloor = Number.isFinite(Number(entry.dungeonFloor)) ? Math.max(1, Math.floor(Number(entry.dungeonFloor))) : null;
        bot.deathZone = entry.deathZone || null;
        bot.deathDungeonId = entry.deathDungeonId || null;
        bot.deathDungeonFloor = Number.isFinite(Number(entry.deathDungeonFloor)) ? Math.max(1, Math.floor(Number(entry.deathDungeonFloor))) : null;
        if (Number.isFinite(Number(entry.x))) bot.x = Number(entry.x);
        if (Number.isFinite(Number(entry.y))) bot.y = Number(entry.y);
        bot.lastStableX = Number.isFinite(Number(entry.lastStableX)) ? Number(entry.lastStableX) : bot.x;
        bot.lastStableY = Number.isFinite(Number(entry.lastStableY)) ? Number(entry.lastStableY) : bot.y;
        bot.stuckTimer = Math.max(0, Number(entry.stuckTimer || 0));
        bot.worldPresenceTimer = Math.max(0, Number(entry.worldPresenceTimer || 0));
        bot.actorAiAccumulator = Math.max(0, Number(entry.actorAiAccumulator || 0));
        bot.actorAiInterval = Math.max(0, Number(entry.actorAiInterval || bot.actorAiInterval || 0));
        bot.advancedRoutineAccumulator = Math.max(0, Number(entry.advancedRoutineAccumulator || 0));
        bot.advancedRoutineInterval = Math.max(0, Number(entry.advancedRoutineInterval || bot.advancedRoutineInterval || 0));
        bot.meditationIntent = entry.meditationIntent || bot.meditationIntent || '';
        bot.adventureTargetId = entry.adventureTargetId || entry.objectiveEnemyId || bot.adventureTargetId || null;
        bot.objectiveEnemyId = entry.objectiveEnemyId || entry.adventureTargetId || bot.objectiveEnemyId || null;
        bot.adventureCommitTimer = Math.max(0, Number(entry.adventureCommitTimer || 0));
        bot.campExitTimer = Math.max(0, Number(entry.campExitTimer || 0));
        if (!bot.alive) {
          bot.hp = 0;
          bot.botState = entry.botState || 'downed';
          bot.currentActivityLabel = entry.currentActivityLabel || 'Downed';
          bot.respawnTimer = Math.max(Number(bot.respawnTimer || 0), Number(entry.respawnTimer || 0));
        }
        const persistedMeditation = Boolean(entry.meditating || entry.isMeditating || entry.isResting || entry.isRecovering)
          || /meditat|rest|recover/i.test(String(entry.botState || entry.currentActivityLabel || entry.meditationIntent || ''));
        if (persistedMeditation) this.cancelMeditation?.(bot, 'save-load cleanup', { silent: true });
        else this.clearActorMeditationPathPenalty?.(bot, performance.now());
        bot.meditating = false;
        bot.isMeditating = false;
        bot.isSitting = false;
        bot.isResting = false;
        bot.isRecovering = false;
        bot.wantsToMeditate = false;
        bot.meditationState = 'none';
        bot.recoveryState = 'none';
        bot.restState = 'none';
        bot.meditationIntent = '';
        if (/meditat|rest|recover/i.test(String(bot.botState || ''))) bot.botState = bot.alive === false ? 'downed' : 'idle';
        if (/meditat|rest|recover/i.test(String(bot.currentActivityLabel || ''))) bot.currentActivityLabel = bot.alive === false ? 'Downed' : 'Ready';
        return true;
      };

      Game.prototype.restoreBotPlayerState = function(state) {
        if (!state || typeof state !== 'object') return false;
        this.normalizeBotState?.();
        for (const bot of [...(this.botPlayers || [])]) this.removeBotPlayer?.(bot);
        const saved = Array.isArray(state.bots) ? state.bots : [];
        for (const entry of saved) {
          const bot = this.spawnBotPlayer(entry, { anchor: { x: entry.x, y: entry.y } });
          this.applyBotRuntimeSnapshot?.(bot, entry);
        }
        this.botPartyMembers = new Set(Array.isArray(state.partyMemberIds) ? state.partyMemberIds.map(String) : []);
        for (const bot of this.botPlayers || []) {
          if (this.botPartyMembers.has(bot.botId || bot.remoteId)) {
            this.ensureLocalParty?.();
            this.partyMembers?.delete?.(bot.botId || bot.remoteId);
            bot.partyId = this.partyId;
            bot.command = 'party';
          }
        }
        this.ensureBotSquads?.();
        for (const entry of saved) {
          const id = String(entry?.botId || entry?.remoteId || entry?.id || '');
          const bot = (this.botPlayers || []).find(candidate => String(candidate?.botId || candidate?.remoteId || candidate?.id || '') === id);
          if (bot) this.applyBotRuntimeSnapshot?.(bot, entry);
        }
        this.partyPanelDirty = true;
        this.botHudDirty = true;
        return true;
      };

      // V0.17.74 Talents: assign/refresh a bot's spec label (level 5+). Rail 5:
      // a display/role identity only - bots get no talent points or effects.
      Game.prototype.updateBotTalentSpec = function(bot) {
        if (!bot) return null;
        const spec = botTalentSpecFor(bot);
        if (spec) {
          bot.talentSpec = spec.id;
          bot.talentSpecName = spec.name;
          bot.botTypeLabel = `${spec.name} ${properClassName(bot.className)}`;
        } else {
          bot.talentSpec = null;
          bot.talentSpecName = null;
        }
        return spec;
      };

      Game.prototype.awardBotXp = function(bot, amount, source = null) {
        if (!bot || typeof bot.gainXp !== 'function') return false;
        const beforeLevel = Math.floor(Number(bot.level) || 1);
        const ok = bot.gainXp(this, amount, source);
        if (ok && Math.floor(Number(bot.level) || 1) !== beforeLevel) this.updateBotTalentSpec(bot);
        if (ok) {
          const reward = Math.max(0, Math.floor((Number(amount) || 0) / 45));
          if (reward > 0) {
            bot.gold = Math.max(0, Number(bot.gold || 0) + reward);
            bot.junkValue = Math.max(0, Number(bot.junkValue || 0) + Math.max(0, Math.floor(reward / 2)));
          }
          this.botHudDirty = true;
          this.partyPanelDirty = true;
        }
        return ok;
      };

      Game.prototype.respawnBotPlayer = function(bot) {
        if (!bot) return false;
        const dungeonCheckpoint = this.dungeonSystem?.getRespawnCheckpoint?.(bot) || null;
        const anchor = dungeonCheckpoint || this.defaultBotSpawnAnchor?.() || { x: DR.CONFIG.START_X + 0.5, y: DR.CONFIG.START_Y + 0.5 };
        bot.x = anchor.x + (dungeonCheckpoint ? 0 : (Math.random() * 2 - 1));
        bot.y = anchor.y + (dungeonCheckpoint ? 0 : (Math.random() * 2 - 1));
        bot.zone = dungeonCheckpoint?.zone || this.currentZone || bot.zone || 'overworld';
        bot.dungeonId = dungeonCheckpoint?.dungeonId || null;
        bot.floorId = dungeonCheckpoint?.floorId || null;
        bot.dungeonFloor = dungeonCheckpoint?.floor || null;
        bot.hp = Math.max(1, Math.floor((bot.maxHp || 1) * (dungeonCheckpoint ? 0.5 : 0.75)));
        bot.mana = Math.floor((bot.maxMana || 0) * (dungeonCheckpoint ? 0.35 : 0.65));
        this.restoreActorAfterRespawn?.(bot);
        if (bot.botPet) {
          bot.botPet.x = bot.x - 0.75;
          bot.botPet.y = bot.y + 0.75;
          bot.botPet.owner = bot;
          bot.botPet.ownerId = bot.botId || bot.remoteId || bot.id || null;
          bot.botPet.zone = bot.zone || this.currentZone || bot.botPet.zone || 'overworld';
          this.restoreActorAfterRespawn?.(bot.botPet);
          if (!Array.isArray(this.entities)) this.entities = [];
          if (!this.entities.includes(bot.botPet)) this.entities.push(bot.botPet);
        }
        bot.respawnTimer = 0;
        bot.targetId = null;
        bot.forcedTargetId = null;
        bot.combatTargetId = null;
        bot.combatCooldown = 0;
        bot.attackTimer = 0;
        bot.attackAiTimer = 0;
        bot.botPendingCast = null;
        bot.meditating = false;
        bot.meditationMoveScalar = 1;
        bot.vx = 0;
        bot.vy = 0;
        this.clearDeathStatusEffects?.(bot);
        this.clearActorPathState?.(bot);
        bot.botState = dungeonCheckpoint ? 'following-dungeon-party' : 'recovered';
        bot.currentActivityLabel = dungeonCheckpoint ? 'Recovered in Cavern' : 'Recovered';
        bot.deathZone = null;
        bot.deathDungeonId = null;
        bot.deathDungeonFloor = null;
        bot.repairDebt = Math.max(0, Number(bot.repairDebt || 0) + Math.max(1, Math.floor(Number(bot.level || 1) * 2)));
        this.spawnRing?.(bot.x, bot.y, '#b8ffd8', 22);
        this.logParty?.(`${bot.name} recovered at ${dungeonCheckpoint ? 'the Silk Web Cavern entrance' : 'camp'}.`);
        return true;
      };

      Game.prototype.updateBotPlayerSystem = function(dt) {
        if (!this.started || !this.player) return;
        this.cleanupInvalidBotPlayers?.('periodic bot sanity', { interval: 2.5, silent: true, repair: true });
        const scheduler = this.ensureBotRuntimeScheduler?.() || BOT_RUNTIME_DEFAULTS;
        scheduler.ensureTimer = Math.max(0, Number(scheduler.ensureTimer || 0) - dt);
        if (scheduler.ensureTimer <= 0) {
          this.ensureBotPlayers?.({ silent: true });
          scheduler.ensureTimer = scheduler.ensureSeconds || BOT_RUNTIME_DEFAULTS.ensureSeconds;
        }
        scheduler.squadTimer = Math.max(0, Number(scheduler.squadTimer || 0) - dt);
        if (scheduler.squadTimer <= 0) {
          this.ensureBotSquads?.();
          scheduler.squadTimer = scheduler.squadRefreshSeconds || BOT_RUNTIME_DEFAULTS.squadRefreshSeconds;
        }
        const bots = this.botPlayers || [];
        const speechNow = performance.now();
        for (const bot of bots) {
          this.sanitizeBotRuntimeState?.(bot);
          bot.botPartyInviteCooldown = Math.max(0, Number(bot.botPartyInviteCooldown || 0) - dt);
          bot.botPartyPlayerInviteCooldown = Math.max(0, Number(bot.botPartyPlayerInviteCooldown || 0) - dt);
          this.updateBotSpeechState?.(bot, speechNow);
        }
        const schedulerScratch = this._botSchedulerScratch || (this._botSchedulerScratch = { ordered: [], sortTimer: 0 });
        schedulerScratch.sortTimer = Math.max(0, Number(schedulerScratch.sortTimer || 0) - dt);
        const ordered = schedulerScratch.ordered;
        if (schedulerScratch.sortTimer <= 0 || ordered.length !== bots.length) {
          ordered.length = 0;
          for (let index = 0; index < bots.length; index++) {
            const bot = bots[index];
            ordered.push({ bot, index, hot: this.botIsHotRuntime?.(bot), d: this.botDistanceToPlayer?.(bot) ?? Infinity });
          }
          ordered.sort((a, b) => Number(b.hot) - Number(a.hot) || a.d - b.d || a.index - b.index);
          schedulerScratch.sortTimer = 0.20;
        } else {
          for (let index = 0; index < ordered.length; index++) {
            const entry = ordered[index];
            entry.index = index;
            entry.hot = this.botIsHotRuntime?.(entry.bot);
          }
        }
        for (const entry of ordered) {
          const bot = entry.bot;
          if (!this.shouldRunBotAdvancedRoutine?.(bot, dt)) continue;
          this.updateBotAdvancedRoutine?.(bot, Math.max(dt, Number(bot.advancedRoutineInterval || dt)));
        }
        for (const squad of this.botSquads?.values?.() || []) {
          squad.combatTargetTimer = Math.max(0, Number(squad.combatTargetTimer || 0) - dt);
          squad.playerInviteCooldown = Math.max(0, Number(squad.playerInviteCooldown || 0) - dt);
          if (squad.combatTargetTimer <= 0) squad.combatTargetId = null;
        }
        this.botStateBroadcastTimer = Math.max(0, Number(this.botStateBroadcastTimer || 0) - dt);
        if (this.botStateBroadcastTimer <= 0) {
          this.botStateBroadcastTimer = 2.5;
          this.partyPanelDirty = true;
          this.botHudDirty = true;
        }
        this.finalizeBotSchedulerFrame?.(dt);
      };

      Game.prototype.botContextActionsAtWorld = function(world) {
        if (!world || !this.player) return [];
        const point = { x: Number(world.x), y: Number(world.y) };
        const bot = (this.botPlayers || [])
          .filter(entry => alive(entry) && entry.zone === (this.currentZone || 'overworld'))
          .filter(entry => dist(entry, point) <= 1.85)
          .sort((a, b) => dist(a, point) - dist(b, point))[0];
        if (!bot) return [];
        const inParty = this.isBotInParty?.(bot);
        return [{
          title: bot.name || 'Bot Player',
          label: inParty ? `Remove ${bot.name} from Party` : `Invite ${bot.name} to Party`,
          run: () => inParty ? this.removeBotFromParty?.(bot) : this.inviteBotToParty?.(bot)
        }, {
          title: bot.name || 'Bot Player',
          label: `Trade Gear with ${bot.name}`,
          run: () => this.openBotTradeWindow?.(bot)
        }, {
          title: bot.name || 'Bot Player',
          label: `Inspect ${bot.name}`,
          run: () => this.inspectBotPlayer?.(bot)
        }, {
          title: bot.name || 'Bot Player',
          label: `Ask ${bot.name} Status`,
          run: () => { bot.socialCooldown = 0; bot.lastSocialLine = this.botSocialLineFor?.(bot) || bot.lastSocialLine || 'Ready.'; return this.inspectBotPlayer?.(bot); }
        }];
      };

      Game.prototype.botRuntimeSummary = function() {
        this.normalizeBotState?.();
        const bots = this.botPlayers || [];
        const partyCount = bots.filter(bot => this.isBotInParty?.(bot)).length;
        const squadCount = this.botSquads?.size || 0;
        const dungeonCount = bots.filter(bot => Number(bot.dungeonRunTimer || 0) > 0).length;
        const turnIns = bots.filter(bot => bot.questStage === 'turn-in').length;
        const campRuns = bots.filter(bot => bot.behaviorGoal === 'camp-supply-run' || String(bot.botState || '').includes('camp')).length;
        const adventuring = bots.filter(bot => String(bot.botState || '').includes('hunt') || String(bot.botState || '').includes('objective') || String(bot.botState || '').includes('quest')).length;
        const totalGold = bots.reduce((sum, bot) => sum + Math.floor(Number(bot.gold || 0)), 0);
        return `${bots.length} bot player${bots.length === 1 ? '' : 's'} active · ${partyCount} in your party · ${squadCount} bot part${squadCount === 1 ? 'y' : 'ies'} · ${adventuring} adventuring · ${turnIns} turn-in · ${campRuns} camp · ${dungeonCount} dungeon · ${totalGold}g bot economy`;
      };
    }
  };
})();
