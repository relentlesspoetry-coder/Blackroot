// Dream Realms external class spell and meditation system
// Modular Pass 41: runtime hotbars now read compiled editor spell drafts instead of the static book.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const getUi = () => DR.ui || window.ui || {};
  const distFn = DR.utils?.dist || window.dist || ((a, b) => Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0)));
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));

  function clone(value, fallback = null) {
    if (value === undefined || value === null) return fallback;
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_) { return fallback; }
  }

  const NECROMANCER_ICON_THEMES = Object.freeze([
    { keys: ['raise bone servant', 'bone servant', 'skeleton knight', 'raise skeleton', 'summon', 'army of bones', 'bone minion'], family: 'necro_summon', glyph: '☠', color: '#e6f2bf', accent: '#7dff6f' },
    { keys: ['bone splinter', 'bone spear', 'bone shard', 'bone lance', 'ossuary'], family: 'necro_bone', glyph: '✣', color: '#f1e6bf', accent: '#a46dff' },
    { keys: ['life tap', 'blood tap', 'siphon blood', 'drain life'], family: 'necro_drain', glyph: '✥', color: '#97ff6d', accent: '#6f2cff' },
    { keys: ['rot cloud', 'plague', 'disease', 'miasma', 'pestilence', 'decay'], family: 'necro_rot', glyph: '☣', color: '#8dff5a', accent: '#3d1666' },
    { keys: ['grave armor', 'bone shield', 'bone armor', 'ward', 'barrier'], family: 'necro_ward', glyph: '▣', color: '#d9e6b4', accent: '#6a3dff' },
    { keys: ['soul leech', 'soul drain', 'soul harvest', 'spirit leech'], family: 'necro_soul', glyph: '◉', color: '#c57cff', accent: '#87ff6a' },
    { keys: ['dark pact', 'blood pact', 'death pact', 'lich form'], family: 'necro_pact', glyph: '◆', color: '#b35cff', accent: '#5cff70' },
    { keys: ['fear', 'terror', 'haunt', 'wail'], family: 'necro_fear', glyph: '☽', color: '#885cff', accent: '#d7f7bd' },
    { keys: ['curse', 'hex', 'weakness', 'frailty'], family: 'necro_curse', glyph: '☾', color: '#b777ff', accent: '#a6ff75' },
    { keys: ['corpse', 'grave', 'tomb', 'death bloom'], family: 'necro_grave', glyph: '✹', color: '#d7d0aa', accent: '#74ff68' }
  ]);

  const NECROMANCER_SPELL_ICON_PATHS = Object.freeze({
    bone_splinter: 'assets/spell-icons/necromancer/bone_splinter.png',
    raise_skeleton: 'assets/spell-icons/necromancer/raise_skeleton.png',
    grave_rot: 'assets/spell-icons/necromancer/grave_rot.png',
    life_tap: 'assets/spell-icons/necromancer/life_tap.png',
    command_undead: 'assets/spell-icons/necromancer/command_undead.png',
    bone_armor: 'assets/spell-icons/necromancer/bone_armor.png',
    plague_mark: 'assets/spell-icons/necromancer/plague_mark.png',
    corpse_mender: 'assets/spell-icons/necromancer/corpse_mender.png',
    fear_the_living: 'assets/spell-icons/necromancer/fear_the_living.png',
    rot_cloud: 'assets/spell-icons/necromancer/rot_cloud.png',
    summon_bone_servant: 'assets/spell-icons/necromancer/summon_bone_servant.png',
    soul_harvest: 'assets/spell-icons/necromancer/soul_harvest.png',
    bone_shackles: 'assets/spell-icons/necromancer/bone_shackles.png',
    withering_curse: 'assets/spell-icons/necromancer/withering_curse.png',
    army_of_bones: 'assets/spell-icons/necromancer/army_of_bones.png',
    death_pact: 'assets/spell-icons/necromancer/death_pact.png',
    bone_storm: 'assets/spell-icons/necromancer/bone_storm.png',
    lich_veil: 'assets/spell-icons/necromancer/lich_veil.png',
    soul_leech: 'assets/spell-icons/necromancer/soul_leech.png',
    grave_sovereign: 'assets/spell-icons/necromancer/grave_sovereign.png',
    // Backward-compatible aliases for older Necromancer spell drafts/saves.
    bone_spear: 'assets/spell-icons/necromancer/bone_splinter.png',
    raise_bone_servant: 'assets/spell-icons/necromancer/raise_skeleton.png',
    grave_armor: 'assets/spell-icons/necromancer/bone_armor.png',
    siphon_strength: 'assets/spell-icons/necromancer/life_tap.png',
    summon_skeleton_knight: 'assets/spell-icons/necromancer/summon_bone_servant.png',
    grave_nova: 'assets/spell-icons/necromancer/rot_cloud.png',
    lich_form: 'assets/spell-icons/necromancer/lich_veil.png'
  });



  const PALADIN_SPELL_ICON_PATHS = Object.freeze({
    radiant_strike: 'assets/spell-icons/paladin/radiant_strike.png',
    shield_of_faith: 'assets/spell-icons/paladin/shield_of_faith.png',
    divine_challenge: 'assets/spell-icons/paladin/divine_challenge.png',
    blessing_of_resolve: 'assets/spell-icons/paladin/blessing_of_resolve.png',
    judgment: 'assets/spell-icons/paladin/judgment.png',
    consecrated_ground: 'assets/spell-icons/paladin/consecrated_ground.png',
    guardian_aura: 'assets/spell-icons/paladin/guardian_aura.png',
    radiant_bulwark: 'assets/spell-icons/paladin/radiant_bulwark.png',
    cleanse_corruption: 'assets/spell-icons/paladin/cleanse_corruption.png',
    holy_rebuke: 'assets/spell-icons/paladin/holy_rebuke.png',
    oathbound_stand: 'assets/spell-icons/paladin/oathbound_stand.png',
    light_within: 'assets/spell-icons/paladin/light_within.png',
    hammer_of_reckoning: 'assets/spell-icons/paladin/hammer_of_reckoning.png',
    blessed_intercept: 'assets/spell-icons/paladin/blessed_intercept.png',
    sunlit_aegis: 'assets/spell-icons/paladin/sunlit_aegis.png',
    turn_the_fallen: 'assets/spell-icons/paladin/turn_the_fallen.png',
    divine_verdict: 'assets/spell-icons/paladin/divine_verdict.png',
    sanctuary_vow: 'assets/spell-icons/paladin/sanctuary_vow.png',
    unbroken_faith: 'assets/spell-icons/paladin/unbroken_faith.png',
    avatar_of_the_oath: 'assets/spell-icons/paladin/avatar_of_the_oath.png'
  });

  const ASSASSIN_SPELL_ICON_PATHS = Object.freeze({
    throwing_knife: 'assets/spell-icons/assassin/throwing_knife.png',
    light_crossbow_shot: 'assets/spell-icons/assassin/light_crossbow_shot.png',
    tripwire: 'assets/spell-icons/assassin/tripwire.png',
    poison_dart: 'assets/spell-icons/assassin/poison_dart.png',
    marked_for_death: 'assets/spell-icons/assassin/marked_for_death.png',
    quick_reload: 'assets/spell-icons/assassin/quick_reload.png',
    fan_of_knives: 'assets/spell-icons/assassin/fan_of_knives.png',
    poison_snare: 'assets/spell-icons/assassin/poison_snare.png',
    piercing_bolt: 'assets/spell-icons/assassin/piercing_bolt.png',
    silent_step: 'assets/spell-icons/assassin/silent_step.png',
    springblade_trap: 'assets/spell-icons/assassin/springblade_trap.png',
    venom_bolt: 'assets/spell-icons/assassin/venom_bolt.png',
    ricochet_blade: 'assets/spell-icons/assassin/ricochet_blade.png',
    death_box: 'assets/spell-icons/assassin/death_box.png',
    execution_bolt: 'assets/spell-icons/assassin/execution_bolt.png',
    shadow_fuse: 'assets/spell-icons/assassin/shadow_fuse.png',
    repeater_burst: 'assets/spell-icons/assassin/repeater_burst.png',
    black_lotus_venom: 'assets/spell-icons/assassin/black_lotus_venom.png',
    silent_finish: 'assets/spell-icons/assassin/silent_finish.png',
    perfect_ambush: 'assets/spell-icons/assassin/perfect_ambush.png'
  });

  const BARD_SPELL_ICON_PATHS = Object.freeze({
    quick_note: 'assets/spell-icons/bard/quick_note.png',
    song_of_mending: 'assets/spell-icons/bard/song_of_mending.png',
    mana_melody: 'assets/spell-icons/bard/mana_melody.png',
    hymn_of_courage: 'assets/spell-icons/bard/hymn_of_courage.png',
    dissonant_chord: 'assets/spell-icons/bard/dissonant_chord.png',
    lullaby: 'assets/spell-icons/bard/lullaby.png',
    battle_hymn: 'assets/spell-icons/bard/battle_hymn.png',
    drumbeat_rush: 'assets/spell-icons/bard/drumbeat_rush.png',
    mournful_note: 'assets/spell-icons/bard/mournful_note.png',
    perfect_harmony: 'assets/spell-icons/bard/perfect_harmony.png',
    blade_rhythm: 'assets/spell-icons/bard/blade_rhythm.png',
    chorus_of_clarity: 'assets/spell-icons/bard/chorus_of_clarity.png',
    dirge_of_weakness: 'assets/spell-icons/bard/dirge_of_weakness.png',
    echoing_verse: 'assets/spell-icons/bard/echoing_verse.png',
    resonant_shield: 'assets/spell-icons/bard/resonant_shield.png',
    chorus_of_war: 'assets/spell-icons/bard/chorus_of_war.png',
    final_refrain: 'assets/spell-icons/bard/final_refrain.png',
    songweave: 'assets/spell-icons/bard/songweave.png',
    legendary_ballad: 'assets/spell-icons/bard/legendary_ballad.png',
    dreamsong_crescendo: 'assets/spell-icons/bard/dreamsong_crescendo.png'
  });

  const CLERIC_SPELL_ICON_PATHS = Object.freeze({
    minor_heal: 'assets/spell-icons/cleric/minor_heal.png',
    smite: 'assets/spell-icons/cleric/smite.png',
    renewing_prayer: 'assets/spell-icons/cleric/renewing_prayer.png',
    cleanse: 'assets/spell-icons/cleric/cleanse.png',
    greater_heal: 'assets/spell-icons/cleric/greater_heal.png',

    // V0.16.69: the uploaded Cleric icon manifest uses a newer/alternate
    // naming set from level 6 onward. Keep shipped Cleric spell names intact
    // and bind the uploaded icons by matching unlock level so existing saves,
    // spellbook rows, and action-bar assignments inherit the art without data
    // or behavior migration.
    holy_ward: 'assets/spell-icons/cleric/blessing_of_protection.png',
    radiant_touch: 'assets/spell-icons/cleric/guardian_ward.png',
    turn_undead: 'assets/spell-icons/cleric/divine_focus.png',
    prayer_of_mending: 'assets/spell-icons/cleric/harmful_purge.png',
    sanctuary: 'assets/spell-icons/cleric/resurrection.png',
    divine_light: 'assets/spell-icons/cleric/group_ward.png',
    blessed_barrier: 'assets/spell-icons/cleric/prayer_of_healing.png',
    judgment_light: 'assets/spell-icons/cleric/remove_curse.png',
    purify_soul: 'assets/spell-icons/cleric/divine_inspiration.png',
    divine_intervention: 'assets/spell-icons/cleric/holy_nova.png',
    hymn_of_renewal: 'assets/spell-icons/cleric/avenging_light.png',
    exorcise_evil: 'assets/spell-icons/cleric/benediction.png',
    guardian_prayer: 'assets/spell-icons/cleric/mass_cleanse.png',
    radiant_revival: 'assets/spell-icons/cleric/divine_intervention.png',
    avatar_of_mercy: 'assets/spell-icons/cleric/final_prayer.png',

    // Direct asset-manifest keys remain available for future data compatibility
    // if the Cleric spell definitions are later aligned to the uploaded pack.
    blessing_of_protection: 'assets/spell-icons/cleric/blessing_of_protection.png',
    guardian_ward: 'assets/spell-icons/cleric/guardian_ward.png',
    divine_focus: 'assets/spell-icons/cleric/divine_focus.png',
    harmful_purge: 'assets/spell-icons/cleric/harmful_purge.png',
    resurrection: 'assets/spell-icons/cleric/resurrection.png',
    group_ward: 'assets/spell-icons/cleric/group_ward.png',
    prayer_of_healing: 'assets/spell-icons/cleric/prayer_of_healing.png',
    remove_curse: 'assets/spell-icons/cleric/remove_curse.png',
    divine_inspiration: 'assets/spell-icons/cleric/divine_inspiration.png',
    holy_nova: 'assets/spell-icons/cleric/holy_nova.png',
    avenging_light: 'assets/spell-icons/cleric/avenging_light.png',
    benediction: 'assets/spell-icons/cleric/benediction.png',
    mass_cleanse: 'assets/spell-icons/cleric/mass_cleanse.png',
    final_prayer: 'assets/spell-icons/cleric/final_prayer.png'
  });


  const DRUID_SPELL_ICON_PATHS = Object.freeze({
    rejuvenating_vine: 'assets/spell-icons/druid/rejuvenating_vine.png',
    thorn_whip: 'assets/spell-icons/druid/thorn_whip.png',
    lifebloom: 'assets/spell-icons/druid/lifebloom.png',
    root_snare: 'assets/spell-icons/druid/root_snare.png',
    wild_growth: 'assets/spell-icons/druid/wild_growth.png',
    moonfire: 'assets/spell-icons/druid/moonfire.png',
    soothing_howl: 'assets/spell-icons/druid/soothing_howl.png',
    barkskin_blessing: 'assets/spell-icons/druid/barkskin_blessing.png',
    verdant_renewal: 'assets/spell-icons/druid/verdant_renewal.png',
    cleansing_rain: 'assets/spell-icons/druid/cleansing_rain.png',
    starfall_roots: 'assets/spell-icons/druid/starfall_roots.png',
    spirit_stag: 'assets/spell-icons/druid/spirit_stag.png',
    regrowth_surge: 'assets/spell-icons/druid/regrowth_surge.png',
    wild_mend: 'assets/spell-icons/druid/wild_mend.png',
    crescent_surge: 'assets/spell-icons/druid/crescent_surge.png',
    pack_renewal: 'assets/spell-icons/druid/pack_renewal.png',
    ancient_bloom: 'assets/spell-icons/druid/ancient_bloom.png',
    nature_s_grasp: 'assets/spell-icons/druid/nature_s_grasp.png',
    moonlit_tranquility: 'assets/spell-icons/druid/moonlit_tranquility.png',
    heart_of_the_wild: 'assets/spell-icons/druid/heart_of_the_wild.png'
  });

  const ENCHANTER_SPELL_ICON_PATHS = Object.freeze({
    mind_spark: 'assets/spell-icons/enchanter/mind_spark.png',
    mesmerize: 'assets/spell-icons/enchanter/mesmerize.png',
    rune_of_focus: 'assets/spell-icons/enchanter/rune_of_focus.png',
    confusing_glare: 'assets/spell-icons/enchanter/confusing_glare.png',
    sleep_hex: 'assets/spell-icons/enchanter/sleep_hex.png',
    arcane_binding: 'assets/spell-icons/enchanter/arcane_binding.png',
    mirror_image: 'assets/spell-icons/enchanter/mirror_image.png',
    seal_of_frailty: 'assets/spell-icons/enchanter/seal_of_frailty.png',
    charm: 'assets/spell-icons/enchanter/charm.png',
    mind_lock: 'assets/spell-icons/enchanter/mind_lock.png',
    false_target: 'assets/spell-icons/enchanter/false_target.png',
    rune_of_power: 'assets/spell-icons/enchanter/rune_of_power.png',
    phantom_army: 'assets/spell-icons/enchanter/phantom_army.png',
    memory_fog: 'assets/spell-icons/enchanter/memory_fog.png',
    disorienting_field: 'assets/spell-icons/enchanter/disorienting_field.png',
    glyphstorm: 'assets/spell-icons/enchanter/glyphstorm.png',
    illusory_step: 'assets/spell-icons/enchanter/illusory_step.png',
    mass_mesmerize: 'assets/spell-icons/enchanter/mass_mesmerize.png',
    grand_rune: 'assets/spell-icons/enchanter/grand_rune.png',
    reality_rewrite: 'assets/spell-icons/enchanter/reality_rewrite.png'
  });


  const FIGHTER_SPELL_ICON_PATHS = Object.freeze({
    heavy_swing: 'assets/spell-icons/fighter/heavy_swing.png',
    cleave: 'assets/spell-icons/fighter/cleave.png',
    battle_rush: 'assets/spell-icons/fighter/battle_rush.png',
    crushing_blow: 'assets/spell-icons/fighter/crushing_blow.png',
    momentum: 'assets/spell-icons/fighter/momentum.png',
    groundbreaker: 'assets/spell-icons/fighter/groundbreaker.png',
    reckless_strike: 'assets/spell-icons/fighter/reckless_strike.png',
    heavy_riposte: 'assets/spell-icons/fighter/heavy_riposte.png',
    weapon_flow: 'assets/spell-icons/fighter/weapon_flow.png',
    armor_splitter: 'assets/spell-icons/fighter/armor_splitter.png',
    savage_momentum: 'assets/spell-icons/fighter/savage_momentum.png',
    bonebreaker: 'assets/spell-icons/fighter/bonebreaker.png',
    whirlwind_cleave: 'assets/spell-icons/fighter/whirlwind_cleave.png',
    final_swing: 'assets/spell-icons/fighter/final_swing.png',
    bloodrush: 'assets/spell-icons/fighter/bloodrush.png',
    shatter_guard: 'assets/spell-icons/fighter/shatter_guard.png',
    titan_chop: 'assets/spell-icons/fighter/titan_chop.png',
    unstoppable_footwork: 'assets/spell-icons/fighter/unstoppable_footwork.png',
    berserker_s_roar: 'assets/spell-icons/fighter/berserker_s_roar.png',
    perfect_masterstroke: 'assets/spell-icons/fighter/perfect_masterstroke.png'
  });


  const RANGER_SPELL_ICON_PATHS = Object.freeze({
    steady_shot: 'assets/spell-icons/ranger/steady_shot.png',
    hunter_s_mark: 'assets/spell-icons/ranger/hunter_s_mark.png',
    snare_trap: 'assets/spell-icons/ranger/snare_trap.png',
    quickdraw: 'assets/spell-icons/ranger/quickdraw.png',
    track_prey: 'assets/spell-icons/ranger/track_prey.png',
    piercing_arrow: 'assets/spell-icons/ranger/piercing_arrow.png',
    camouflage: 'assets/spell-icons/ranger/camouflage.png',
    binding_net: 'assets/spell-icons/ranger/binding_net.png',
    predator_shot: 'assets/spell-icons/ranger/predator_shot.png',
    spike_trap: 'assets/spell-icons/ranger/spike_trap.png',
    eagle_eye: 'assets/spell-icons/ranger/eagle_eye.png',
    volley: 'assets/spell-icons/ranger/volley.png',
    disengage_shot: 'assets/spell-icons/ranger/disengage_shot.png',
    beastbane_arrow: 'assets/spell-icons/ranger/beastbane_arrow.png',
    kill_zone: 'assets/spell-icons/ranger/kill_zone.png',
    heartseeker_arrow: 'assets/spell-icons/ranger/heartseeker_arrow.png',
    wilderness_reflexes: 'assets/spell-icons/ranger/wilderness_reflexes.png',
    rain_of_barbs: 'assets/spell-icons/ranger/rain_of_barbs.png',
    apex_predator: 'assets/spell-icons/ranger/apex_predator.png',
    true_hunt: 'assets/spell-icons/ranger/true_hunt.png'
  });

  const ROGUE_SPELL_ICON_PATHS = Object.freeze({
    quick_cut: 'assets/spell-icons/rogue/quick_cut.png',
    backstab: 'assets/spell-icons/rogue/backstab.png',
    smoke_veil: 'assets/spell-icons/rogue/smoke_veil.png',
    venom_edge: 'assets/spell-icons/rogue/venom_edge.png',
    evasive_step: 'assets/spell-icons/rogue/evasive_step.png',
    bleeding_vein: 'assets/spell-icons/rogue/bleeding_vein.png',
    shadowstep: 'assets/spell-icons/rogue/shadowstep.png',
    sap: 'assets/spell-icons/rogue/sap.png',
    crippling_toxin: 'assets/spell-icons/rogue/crippling_toxin.png',
    twin_fang: 'assets/spell-icons/rogue/twin_fang.png',
    vanish: 'assets/spell-icons/rogue/vanish.png',
    garrote: 'assets/spell-icons/rogue/garrote.png',
    flurry_cut: 'assets/spell-icons/rogue/flurry_cut.png',
    perfect_counter: 'assets/spell-icons/rogue/perfect_counter.png',
    deathdose: 'assets/spell-icons/rogue/deathdose.png',
    smoke_bomb: 'assets/spell-icons/rogue/smoke_bomb.png',
    killing_cut: 'assets/spell-icons/rogue/killing_cut.png',
    phantom_blades: 'assets/spell-icons/rogue/phantom_blades.png',
    shadow_dance: 'assets/spell-icons/rogue/shadow_dance.png',
    silent_execution: 'assets/spell-icons/rogue/silent_execution.png'
  });


  const SHAMAN_SPELL_ICON_PATHS = Object.freeze({
    lightning_spark: 'assets/spell-icons/shaman/lightning_spark.png',
    stone_shard: 'assets/spell-icons/shaman/stone_shard.png',
    spirit_flame: 'assets/spell-icons/shaman/spirit_flame.png',
    stormcall: 'assets/spell-icons/shaman/stormcall.png',
    earthbind: 'assets/spell-icons/shaman/earthbind.png',
    lightning_spear: 'assets/spell-icons/shaman/lightning_spear.png',
    totem_of_sparks: 'assets/spell-icons/shaman/totem_of_sparks.png',
    earth_spike: 'assets/spell-icons/shaman/earth_spike.png',
    ancestor_s_brand: 'assets/spell-icons/shaman/ancestor_s_brand.png',
    chain_storm: 'assets/spell-icons/shaman/chain_storm.png',
    quaking_ground: 'assets/spell-icons/shaman/quaking_ground.png',
    ghostfire: 'assets/spell-icons/shaman/ghostfire.png',
    thunderclap: 'assets/spell-icons/shaman/thunderclap.png',
    stone_fist: 'assets/spell-icons/shaman/stone_fist.png',
    ritual_inferno: 'assets/spell-icons/shaman/ritual_inferno.png',
    skybreak: 'assets/spell-icons/shaman/skybreak.png',
    mountain_s_wrath: 'assets/spell-icons/shaman/mountain_s_wrath.png',
    spirit_walk: 'assets/spell-icons/shaman/spirit_walk.png',
    tempest_avatar: 'assets/spell-icons/shaman/tempest_avatar.png',
    ancestral_cataclysm: 'assets/spell-icons/shaman/ancestral_cataclysm.png'
  });

  const SUMMONER_SPELL_ICON_PATHS = Object.freeze({
    summon_familiar: 'assets/spell-icons/summoner/summon_familiar.png',
    arcane_spark: 'assets/spell-icons/summoner/arcane_spark.png',
    command_attack: 'assets/spell-icons/summoner/command_attack.png',
    mend_companion: 'assets/spell-icons/summoner/mend_companion.png',
    empower_beast: 'assets/spell-icons/summoner/empower_beast.png',
    planar_bolt: 'assets/spell-icons/summoner/planar_bolt.png',
    protective_bond: 'assets/spell-icons/summoner/protective_bond.png',
    summon_elemental_servitor: 'assets/spell-icons/summoner/summon_elemental_servitor.png',
    familiar_rush: 'assets/spell-icons/summoner/familiar_rush.png',
    planar_gate: 'assets/spell-icons/summoner/planar_gate.png',
    bind_essence: 'assets/spell-icons/summoner/bind_essence.png',
    call_swarm: 'assets/spell-icons/summoner/call_swarm.png',
    soul_link: 'assets/spell-icons/summoner/soul_link.png',
    elemental_rotation: 'assets/spell-icons/summoner/elemental_rotation.png',
    planar_surge: 'assets/spell-icons/summoner/planar_surge.png',
    mass_dismissal: 'assets/spell-icons/summoner/mass_dismissal.png',
    twin_summon: 'assets/spell-icons/summoner/twin_summon.png',
    overrun: 'assets/spell-icons/summoner/overrun.png',
    grand_binding: 'assets/spell-icons/summoner/grand_binding.png',
    legion_gate: 'assets/spell-icons/summoner/legion_gate.png'
  });


  const WARDEN_SPELL_ICON_PATHS = Object.freeze({
    stonehand_strike: 'assets/spell-icons/warden/stonehand_strike.png',
    barkskin: 'assets/spell-icons/warden/barkskin.png',
    root_grasp: 'assets/spell-icons/warden/root_grasp.png',
    thorn_guard: 'assets/spell-icons/warden/thorn_guard.png',
    earthen_roar: 'assets/spell-icons/warden/earthen_roar.png',
    grove_mend: 'assets/spell-icons/warden/grove_mend.png',
    stonehide: 'assets/spell-icons/warden/stonehide.png',
    briar_lash: 'assets/spell-icons/warden/briar_lash.png',
    wild_fortitude: 'assets/spell-icons/warden/wild_fortitude.png',
    living_wall: 'assets/spell-icons/warden/living_wall.png',
    quaking_challenge: 'assets/spell-icons/warden/quaking_challenge.png',
    ancient_pulse: 'assets/spell-icons/warden/ancient_pulse.png',
    ironroot_stance: 'assets/spell-icons/warden/ironroot_stance.png',
    thornsnare: 'assets/spell-icons/warden/thornsnare.png',
    mountain_s_patience: 'assets/spell-icons/warden/mountain_s_patience.png',
    grove_shelter: 'assets/spell-icons/warden/grove_shelter.png',
    primal_guard: 'assets/spell-icons/warden/primal_guard.png',
    heart_of_the_grove: 'assets/spell-icons/warden/heart_of_the_grove.png',
    titanroot: 'assets/spell-icons/warden/titanroot.png',
    ancient_warden_form: 'assets/spell-icons/warden/ancient_warden_form.png'
  });

  const WIZARD_SPELL_ICON_PATHS = Object.freeze({
    arcane_bolt: 'assets/spell-icons/wizard/arcane_bolt.png',
    fireball: 'assets/spell-icons/wizard/fireball.png',
    frost_lance: 'assets/spell-icons/wizard/frost_lance.png',
    mana_shield: 'assets/spell-icons/wizard/mana_shield.png',
    arcane_intellect: 'assets/spell-icons/wizard/arcane_intellect.png',
    flame_wave: 'assets/spell-icons/wizard/flame_wave.png',
    blink: 'assets/spell-icons/wizard/blink.png',
    ice_prison: 'assets/spell-icons/wizard/ice_prison.png',
    arcane_barrage: 'assets/spell-icons/wizard/arcane_barrage.png',
    ignite: 'assets/spell-icons/wizard/ignite.png',
    mana_spear: 'assets/spell-icons/wizard/mana_spear.png',
    shatter: 'assets/spell-icons/wizard/shatter.png',
    meteorfall: 'assets/spell-icons/wizard/meteorfall.png',
    frost_nova: 'assets/spell-icons/wizard/frost_nova.png',
    overchannel: 'assets/spell-icons/wizard/overchannel.png',
    arcane_mirror: 'assets/spell-icons/wizard/arcane_mirror.png',
    spellstorm: 'assets/spell-icons/wizard/spellstorm.png',
    time_slip: 'assets/spell-icons/wizard/time_slip.png',
    prismatic_surge: 'assets/spell-icons/wizard/prismatic_surge.png',
    archwizard_s_cataclysm: 'assets/spell-icons/wizard/archwizard_s_cataclysm.png'
  });

  const CLASS_SPELL_ICON_PATHS = Object.freeze({
    necromancer: NECROMANCER_SPELL_ICON_PATHS,
    paladin: PALADIN_SPELL_ICON_PATHS,
    assassin: ASSASSIN_SPELL_ICON_PATHS,
    bard: BARD_SPELL_ICON_PATHS,
    cleric: CLERIC_SPELL_ICON_PATHS,
    druid: DRUID_SPELL_ICON_PATHS,
    enchanter: ENCHANTER_SPELL_ICON_PATHS,
    fighter: FIGHTER_SPELL_ICON_PATHS,
    ranger: RANGER_SPELL_ICON_PATHS,
    rogue: ROGUE_SPELL_ICON_PATHS,
    shaman: SHAMAN_SPELL_ICON_PATHS,
    summoner: SUMMONER_SPELL_ICON_PATHS,
    warden: WARDEN_SPELL_ICON_PATHS,
    wizard: WIZARD_SPELL_ICON_PATHS
  });

  function normalizeSpellIconKey(spell) {
    const raw = String(spell?.necroSpellId || spell?.id || spell?.name || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return raw;
  }

  function resolveBoundSpellImagePath(spell) {
    const directKey = normalizeSpellIconKey(spell);
    const classKey = String(spell?.className || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const nameKey = String(spell?.name || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const classMap = CLASS_SPELL_ICON_PATHS[classKey];
    if (classMap) {
      if (directKey && classMap[directKey]) return classMap[directKey];
      if (nameKey && classMap[nameKey]) return classMap[nameKey];
    }

    // Backward compatibility for older Necromancer drafts that carried
    // necroSpellId but no className in local spell-editor state.
    if (directKey && NECROMANCER_SPELL_ICON_PATHS[directKey]) return NECROMANCER_SPELL_ICON_PATHS[directKey];
    if (nameKey && NECROMANCER_SPELL_ICON_PATHS[nameKey]) return NECROMANCER_SPELL_ICON_PATHS[nameKey];
    return '';
  }

  function themedNecromancerIcon(spell, fallbackColor) {
    const name = String(spell?.name || '').toLowerCase();
    const kind = String(spell?.kind || '').toLowerCase();
    const normalizedKey = normalizeSpellIconKey(spell);
    let resolved = null;
    for (const theme of NECROMANCER_ICON_THEMES) {
      if (theme.keys.some(key => name.includes(key))) {
        resolved = theme;
        break;
      }
    }
    if (!resolved) {
      if (kind === 'summonpet' || kind === 'boltsummon') resolved = NECROMANCER_ICON_THEMES[0];
      else if (kind === 'drain') resolved = NECROMANCER_ICON_THEMES[2];
      else if (kind === 'buff' || kind === 'groupbuff' || kind === 'petbuff') resolved = NECROMANCER_ICON_THEMES[4];
      else if (kind === 'aoedebuff' || kind === 'debuff' || kind === 'boltdot' || kind === 'meleedebuff') resolved = NECROMANCER_ICON_THEMES[3];
      else if (kind === 'aoe' || kind === 'aoemelee') resolved = NECROMANCER_ICON_THEMES[9];
      else if (kind === 'mana') resolved = NECROMANCER_ICON_THEMES[6];
      else if (kind === 'heal' || kind === 'aoeheal' || kind === 'petheal') resolved = NECROMANCER_ICON_THEMES[5];
      else resolved = { family: 'necro_bone', glyph: '✣', color: fallbackColor || '#e6f2bf', accent: '#9f6cff' };
    }
    return { ...resolved, imagePath: NECROMANCER_SPELL_ICON_PATHS[normalizedKey] || resolved?.imagePath || null };
  }

  // Shared spell icon descriptor - the single owner of "what icon represents
  // this spell" (bound imported images, Necromancer themed icons, kind-based
  // fallback glyphs). Game.prototype.spellIconDescriptor below is a thin
  // delegate so action bar / spellbook rendering is unchanged; the active
  // status/buff tray (systems/status-effect-system.js) reads this same
  // object via DR.SpellIcons.descriptorForSpell instead of duplicating any
  // of this resolution logic.
  DR.SpellIcons = DR.SpellIcons || {};
  DR.SpellIcons.descriptorForSpell = function(spell, fallbackClassName = '') {
    const className = String(spell?.className || fallbackClassName || '').toLowerCase();
    const kind = String(spell?.kind || '').toLowerCase();
    const color = spell?.color || (className.includes('necromancer') ? '#b9d28f' : '#d8ded1');
    const spellForLookup = spell?.className ? spell : { ...(spell || {}), className: spell?.className || fallbackClassName };
    const boundImagePath = resolveBoundSpellImagePath(spellForLookup);

    if (boundImagePath) {
      if (className === 'necromancer') {
        const themed = themedNecromancerIcon(spellForLookup, color);
        themed.imagePath = boundImagePath;
        return themed;
      }
      return {
        family: `${className || 'spell'}_imported`,
        glyph: '',
        color,
        accent: color,
        imagePath: boundImagePath
      };
    }

    if (className === 'necromancer') {
      return themedNecromancerIcon(spellForLookup, color);
    }

    if (kind === 'summonpet' || kind === 'boltsummon') return { family: 'spell_summon', glyph: '✦', color };
    if (kind === 'drain') return { family: 'spell_drain', glyph: '✥', color };
    if (kind === 'heal' || kind === 'aoeheal' || kind === 'petheal') return { family: 'spell_heal', glyph: '✚', color };
    if (kind === 'mana') return { family: 'spell_mana', glyph: '✦', color };
    if (kind === 'buff' || kind === 'groupbuff' || kind === 'petbuff') return { family: 'spell_buff', glyph: '▲', color };
    if (kind === 'aoedebuff' || kind === 'debuff' || kind === 'boltdot' || kind === 'meleedebuff') return { family: 'spell_debuff', glyph: '▾', color };
    if (kind === 'aoe' || kind === 'aoemelee') return { family: 'spell_aoe', glyph: '✹', color };
    if (kind === 'dashstrike' || kind === 'melee') return { family: 'spell_melee', glyph: '⚔', color };
    if (kind === 'cleanse') return { family: 'spell_cleanse', glyph: '✧', color };
    if (kind === 'revive') return { family: 'spell_revive', glyph: '✚', color };
    if (kind === 'bolt') return { family: 'spell_bolt', glyph: '✦', color };
    return { family: 'spell_generic', glyph: '◇', color };
  };

  DR.SpellSystem = {
    install(Game) {
      Game.prototype.ensureEditorSpellData = function() {
        if (!this.editorSpells || typeof this.editorSpells !== 'object') this.editorSpells = clone(DR.SPELL_BY_ID || {}, {});
        if (!this.classSpellSlots || typeof this.classSpellSlots !== 'object') this.classSpellSlots = clone(DR.DEFAULT_CLASS_SPELL_SLOTS || {}, {});
        const revampClasses = new Set(['assassin', 'bard', 'cleric', 'druid', 'enchanter', 'fighter', 'paladin', 'necromancer', 'ranger', 'rogue', 'shaman', 'summoner', 'warden', 'wizard']);
        for (const [spellId, draft] of Object.entries(DR.SPELL_BY_ID || {})) {
          const draftClassKey = String(draft?.className || '').toLowerCase();
          if (!this.editorSpells[spellId] || revampClasses.has(draftClassKey)) {
            this.editorSpells[spellId] = clone(draft, {});
            continue;
          }
          const existing = this.editorSpells[spellId];
          if (existing && typeof existing === 'object' && draft && typeof draft === 'object') {
            if (existing.necroSpellId == null || existing.necroSpellId === '') existing.necroSpellId = draft.necroSpellId || existing.necroSpellId || null;
            if (existing.className == null || existing.className === '') existing.className = draft.className || existing.className || '';
            if (existing.name == null || existing.name === '') existing.name = draft.name || existing.name || spellId;
          }
        }
        for (const [className, defaultSlots] of Object.entries(DR.DEFAULT_CLASS_SPELL_SLOTS || {})) {
          if (!Array.isArray(this.classSpellSlots[className])) this.classSpellSlots[className] = [];
          for (let index = 0; index < defaultSlots.length; index++) {
            if (!this.classSpellSlots[className][index] && defaultSlots[index]) this.classSpellSlots[className][index] = defaultSlots[index];
          }
        }
        if (!Object.keys(this.classSpellSlots || {}).length && DR.SpellRuntimeCompiler) {
          this.classSpellSlots = DR.SpellRuntimeCompiler.seedDefaultClassSpellSlots(this.editorSpells || {});
        }
      };

      Game.prototype.rebuildRuntimeSpellBook = function() {
        this.ensureEditorSpellData();
        const compiler = DR.SpellRuntimeCompiler;
        const compiled = compiler
          ? compiler.buildRuntimeBooks(this.editorSpells, this.classSpellSlots)
          : { books: DR.CLASS_SPELL_BOOK || {}, spellsById: {}, errors: [] };
        this.compiledClassSpellBook = compiled.books || {};
        this.compiledSpellById = compiled.spellsById || {};
        this.spellCompilerErrors = compiled.errors || [];
        this.spellBookDirty = false;
        return compiled;
      };

      Game.prototype.markSpellBookDirty = function(reason = '') {
        this.spellBookDirty = true;
        if (reason) this.spellBookDirtyReason = reason;
      };

      Game.prototype.getClassSpells = function(className = this.player?.className) {
        if (!className) return [];
        if (!this.compiledClassSpellBook || this.spellBookDirty) this.rebuildRuntimeSpellBook();
        const spells = this.compiledClassSpellBook?.[className] || [];
        // V0.17.69 Talents: player-only spell patches (cost/cooldown/power/heal/
        // duration...). Index order preserved exactly - hotbar slot indices and
        // spellCooldowns[] must not shift. Bots/mercs/NPCs read the shared book.
        if (className !== this.player?.className) return spells;
        return this.applyTalentSpellMods?.(spells) || spells;
      };

      Game.prototype.getCompiledSpellById = function(spellId) {
        if (!this.compiledSpellById || this.spellBookDirty) this.rebuildRuntimeSpellBook();
        return this.compiledSpellById?.[spellId] || null;
      };

      // Phase 3 (Combat/Spell Parity): Intersect-style cooldown groups.
      // When a cast spell declares a `cooldownGroup`, every other hotbar
      // slot in the same class spellbook sharing that group id is put on
      // the same cooldown value. No shipped spell sets `cooldownGroup`
      // today (see systems/spell-compiler-system.js), so this is a no-op
      // for all current content - it only activates once a future spell
      // opts in, and never affects per-slot cooldowns for spells outside
      // the group.
      Game.prototype.applySpellCooldownGroup = function(spell, slotIndex, cooldownValue) {
        const group = spell?.cooldownGroup;
        if (!group) return;
        const cooldowns = this.player?.spellCooldowns;
        if (!Array.isArray(cooldowns)) return;
        const spells = this.getClassSpells?.() || [];
        for (let i = 0; i < spells.length && i < cooldowns.length; i++) {
          if (i === slotIndex) continue;
          if (spells[i]?.cooldownGroup === group) cooldowns[i] = Math.max(cooldowns[i] || 0, cooldownValue);
        }
      };

      Game.prototype.spellIconDescriptor = function(spell) {
        return DR.SpellIcons.descriptorForSpell(spell, spell?.className || this.player?.className || '');
      };

      Game.prototype.spellIconHtml = function(spell, className = 'spellIcon') {
        const icon = this.spellIconDescriptor(spell);
        const family = String(icon.family || 'spell_generic').toLowerCase().replace(/[^a-z0-9_-]+/g, '_') || 'spell_generic';
        const color = icon.color || '#d8ded1';
        const accent = icon.accent || color;
        const glyph = icon.glyph || '◇';
        const imagePath = icon.imagePath ? String(icon.imagePath) : '';
        if (imagePath) {
          return `<div class="${escapeHtml(className)} generatedItemIcon spellImageIcon icon-${escapeHtml(family)}" style="--icon-color:${escapeHtml(color)};--icon-accent:${escapeHtml(accent)}" data-icon-family="${escapeHtml(family)}" data-icon-image="1" aria-hidden="true"><img class="spellIconImageAsset" src="${escapeHtml(imagePath)}" alt="${escapeHtml(spell?.name || 'Spell icon')}" draggable="false"><span class="iconCore"></span><span class="iconGlyph">${escapeHtml(glyph)}</span></div>`;
        }
        return `<div class="${escapeHtml(className)} generatedItemIcon icon-${escapeHtml(family)}" style="--icon-color:${escapeHtml(color)};--icon-accent:${escapeHtml(accent)}" data-icon-family="${escapeHtml(family)}"><span class="iconCore"></span><span class="iconGlyph">${escapeHtml(glyph)}</span></div>`;
      };

      Game.prototype.resolveClassSpellId = function(spell = {}) {
        return String(
          spell.id ||
          spell.spellId ||
          spell.paladinSpellId ||
          spell.wardenSpellId ||
          spell.fighterSpellId ||
          spell.rogueSpellId ||
          spell.rangerSpellId ||
          spell.assassinSpellId ||
          spell.wizardSpellId ||
          spell.shamanSpellId ||
          spell.summonerSpellId ||
          spell.necroSpellId ||
          spell.necromancerSpellId ||
          spell.clericSpellId ||
          spell.druidSpellId ||
          spell.bardSpellId ||
          spell.enchanterSpellId ||
          spell.name ||
          ''
        );
      };

      // Looks up a class's own compiled spellbook for a spell whose resolved
      // id matches `wantedId`. Used where a status effect (e.g. Fighter
      // Momentum stacks, gained from several different weapon abilities)
      // always represents one fixed named spell rather than whichever
      // ability happened to trigger it - not a hardcoded icon map, just a
      // lookup against the same spellbook the action bar already reads.
      Game.prototype.findClassSpellById = function(className, wantedId) {
        const spells = this.getClassSpells?.(className) || [];
        const wanted = String(wantedId || '').toLowerCase();
        return spells.find(s => String(this.resolveClassSpellId?.(s) || '').toLowerCase() === wanted) || null;
      };

      Game.prototype.decorateStatusEffectFromSpell = function(spell, effect = {}) {
        const descriptor = this.spellIconDescriptor?.(spell) || null;

        return {
          ...effect,
          sourceSpellId: effect.sourceSpellId || this.resolveClassSpellId?.(spell) || null,
          sourceSpellName: effect.sourceSpellName || spell?.name || effect.name || null,
          sourceClass: effect.sourceClass || spell?.className || this.player?.className || null,
          spellIconDescriptor: descriptor ? {
            family: descriptor.family || 'spell_generic',
            glyph: descriptor.glyph || '',
            color: descriptor.color || spell?.color || effect.color || '#d8ded1',
            accent: descriptor.accent || descriptor.color || spell?.color || effect.color || '#d8ded1',
            imagePath: descriptor.imagePath || ''
          } : null
        };
      };

      Game.prototype.ensureSpellActionSlotLayout = function(slotNode, labelNode) {
        if (!slotNode || !labelNode) return null;
        labelNode.classList.add('actionName', 'spellActionLabel');
        let iconNode = slotNode.querySelector('.spellActionIcon');
        if (!iconNode) {
          iconNode = document.createElement('span');
          iconNode.className = 'actionIcon spellActionIcon';
          slotNode.insertBefore(iconNode, labelNode);
        }
        return iconNode;
      };

      Game.prototype.formatSpellDuration = function(seconds) {
        const value = Number(seconds || 0);
        if (!Number.isFinite(value) || value <= 0) return '';
        if (value >= 60) {
          const mins = Math.floor(value / 60);
          const secs = Math.round(value - mins * 60);
          return secs > 0 ? `${mins}m ${secs}s` : `${mins} min`;
        }
        return `${value.toFixed(1).replace(/\.0$/, '')}s`;
      };

      Game.prototype.spellTooltipText = function(spell) {
        if (!spell) return 'No spell assigned to this class slot.';
        const cost = Math.floor(spell?.cost || 0);
        const resourceLabel = this.spellResourceLabel?.(spell) || 'Mana';
        const baseCooldown = Number(spell?.cooldown || 0);
        const effectiveCooldown = spell && this.player ? (DR.StatSystem?.effectiveCooldown?.(baseCooldown, this.player) || baseCooldown) : baseCooldown;
        const cooldown = effectiveCooldown.toFixed(1).replace(/\.0$/, '');
        const baseCooldownText = baseCooldown > effectiveCooldown + 0.05 ? ` · Base ${baseCooldown.toFixed(1).replace(/\.0$/, '')}s` : '';
        const durationText = this.formatSpellDuration?.(spell.duration || spell.tickDuration || 0);
        const durationMeta = durationText ? ` · Duration: ${durationText}` : '';
        const rangeMeta = spell.range != null ? ` · Range: ${Number(spell.range).toFixed(1).replace(/\.0$/, '')}` : '';
        const radiusMeta = spell.radius != null ? ` · Radius: ${Number(spell.radius).toFixed(1).replace(/\.0$/, '')}` : '';
        const castMeta = spell.instant === true || Number(spell.castTime || 0) <= 0 ? ' · Cast: Instant' : ` · Cast: ${Number(spell.castTime).toFixed(1).replace(/\.0$/, '')}s`;
        const categoryMeta = spell.category ? ` · ${spell.category}` : '';
        return `${spell.name}
${spell.description || ''}
Unlock: Level ${spell.levelRequirement || 1} · ${resourceLabel} Cost: ${cost} · Cooldown: ${cooldown}s${baseCooldownText}${castMeta}${rangeMeta}${radiusMeta}${durationMeta}${categoryMeta} · ${spell.requiresTarget ? 'Target required' : 'Self/ally action'} · Source: ${spell.compiledFromEditor ? 'Spell Editor' : 'Runtime'}`;
      };


      Game.prototype.spellResourceLabel = function(spellOrClass = null) {
        const className = String(typeof spellOrClass === 'string' ? spellOrClass : (spellOrClass?.className || this.player?.className || '')).toLowerCase();
        const resource = String(spellOrClass?.resourceName || '').toLowerCase();
        if (resource === 'focus' || className === 'assassin' || className === 'ranger') return 'Focus';
        if (resource === 'stamina' || className === 'fighter') return 'Stamina';
        if (resource === 'energy' || className === 'rogue') return 'Energy';
        return 'Mana';
      };

      Game.prototype.spellResourceShortLabel = function(spellOrClass = null) {
        const label = this.spellResourceLabel?.(spellOrClass);
        if (label === 'Focus') return 'Focus';
        if (label === 'Stamina') return 'STA';
        if (label === 'Energy') return 'Energy';
        return 'MP';
      };

      Game.prototype.scaledSpellValue = function(spell, baseKey = 'power', scaleKey = 'levelScale') {
        const level = Math.max(1, Number(this.player?.level || 1));
        return Math.max(0, Math.floor(Number(spell?.[baseKey] || 0) + Math.max(0, level - 1) * Number(spell?.[scaleKey] || 0)));
      };



      Game.prototype.fighterMomentumEffect = function(actor = this.player) {
        return actor?.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === 'fighter_momentum') || null;
      };

      Game.prototype.fighterMomentumStacks = function(actor = this.player) {
        const momentum = this.fighterMomentumEffect?.(actor);
        return Math.max(0, Math.min(5, Math.floor(Number(momentum?.stacks || 0))));
      };

      Game.prototype.addFighterMomentum = function(stacks = 1, actor = this.player) {
        if (!actor || actor.alive === false) return null;
        if (!Array.isArray(actor.buffs)) actor.buffs = [];
        const add = Math.max(0, Math.floor(Number(stacks || 0)));
        let effect = this.fighterMomentumEffect?.(actor);
        if (!effect) {
          const momentumSpellDef = this.findClassSpellById?.('Fighter', 'momentum') || { name: 'Momentum', className: 'Fighter', color: '#d0b070', kind: 'buff' };
          effect = this.applyStatusEffect?.(actor, this.decorateStatusEffectFromSpell(momentumSpellDef, {
            id: 'fighter_momentum',
            name: 'Momentum',
            type: 'buff',
            duration: 300,
            stacks: 0,
            maxStacks: 5,
            color: '#d0b070',
            hostile: false,
            attackSpeedPerStack: 0.02,
            tags: ['fighter', 'momentum'],
            description: 'Each stack increases Fighter attack speed by 2%. Stacks up to 5.'
          }), actor);
        }
        if (!effect) return null;
        effect.stacks = Math.max(add > 0 ? 1 : 0, Math.min(5, Math.floor(Number(effect.stacks || 0)) + add));
        effect.maxStacks = 5;
        effect.remaining = Math.max(Number(effect.remaining || 0), 300);
        effect.duration = Math.max(Number(effect.duration || 0), 300);
        effect.attackSpeedPerStack = 0.02;
        effect.description = `Momentum: ${effect.stacks}/5 stacks. +${effect.stacks * 2}% attack speed.`;
        this.spawnStatusPulse?.(actor, '#d0b070', `Momentum ${effect.stacks}`);
        this.updateUI?.();
        return effect;
      };

      Game.prototype.consumeFighterMomentum = function(maxStacks = 5, actor = this.player) {
        const effect = this.fighterMomentumEffect?.(actor);
        if (!effect) return 0;
        const available = Math.max(0, Math.floor(Number(effect.stacks || 0)));
        const consumed = Math.min(available, Math.max(0, Math.floor(Number(maxStacks || 0))));
        effect.stacks = Math.max(0, available - consumed);
        if (effect.stacks <= 0) effect.remaining = 0;
        else effect.description = `Momentum: ${effect.stacks}/5 stacks. +${effect.stacks * 2}% attack speed.`;
        this.updateUI?.();
        return consumed;
      };

      Game.prototype.consumeFighterBuffCharge = function(statusId, actor = this.player) {
        const effect = actor?.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === statusId);
        if (!effect) return null;
        const stacks = Math.max(0, Math.floor(Number(effect.stacks || effect.charges || 1)) - 1);
        effect.stacks = stacks;
        effect.charges = stacks;
        if (stacks <= 0) effect.remaining = 0;
        return effect;
      };

      Game.prototype.fighterWeaponDamage = function(spell, actor = this.player) {
        const attack = Math.max(1, Number(actor?.getStat?.('attack') ?? actor?.attack ?? 8));
        const flat = Number(spell?.flatDamage ?? spell?.power ?? 0);
        const mult = Number(spell?.weaponDamageMultiplier ?? 1);
        const levelScale = Math.max(0, Number(actor?.level || 1) - 1) * Number(spell?.levelScale || 0);
        return Math.max(1, Math.floor(flat + attack * mult + levelScale));
      };

      Game.prototype.isFighterPhysicalVulnerableTarget = function(target) {
        return target?.buffs?.some?.(buff => buff && buff.remaining > 0 && buff.id === 'fighter_split_guard');
      };

      Game.prototype.applyFighterSelfBuff = function(spell, statusId, name, extra = {}) {
        const p = this.player;
        const stacks = Math.max(1, Number(extra.stacks ?? spell.charges ?? 1));
        this.applyStatusEffect?.(p, this.decorateStatusEffectFromSpell(spell, {
          id: statusId,
          name,
          type: 'buff',
          duration: Number(extra.duration || spell.duration || 300),
          stacks,
          maxStacks: Math.max(stacks, Number(extra.maxStacks || spell.charges || stacks)),
          color: spell.color || '#d0b070',
          hostile: false,
          tags: extra.tags || spell.tags || ['fighter'],
          ...extra
        }), p);
        this.spawnRing?.(p.x, p.y, spell.color || '#d0b070', 16);
        this.spawnStatusPulse?.(p, spell.color || '#d0b070', name);
        this.log(`${name} applied.`);
      };

      // V0.19.7: reading a facing vector is NOT `Number(p.facingX || 1)`. facingX is legitimately 0 when
      // an actor faces due north or south (setFacingFromDelta normalises dx/len), and `0 || 1` is 1 - so
      // that idiom silently rewrote a north-facing actor's facing to (1, 1) and swung their cone 45
      // degrees off-axis. It came from the original `inFront` closure, which means shipping Cleave has
      // mis-aimed for any fighter facing straight up or down. `||` cannot supply a numeric default where
      // zero is a valid value; only a genuinely absent/non-finite component may be defaulted.
      Game.prototype.actorFacingVector = function(actor = this.player) {
        let fx = Number(actor?.facingX);
        let fy = Number(actor?.facingY);
        if (!Number.isFinite(fx)) fx = NaN;
        if (!Number.isFinite(fy)) fy = NaN;
        // Both missing -> fall back to the actor's facingAngle if it has one, else east.
        if (Number.isNaN(fx) && Number.isNaN(fy)) {
          const a = Number(actor?.facingAngle);
          if (Number.isFinite(a)) return { x: Math.cos(a), y: Math.sin(a) };
          return { x: 1, y: 0 };
        }
        if (Number.isNaN(fx)) fx = 0;
        if (Number.isNaN(fy)) fy = 0;
        if (fx === 0 && fy === 0) return { x: 1, y: 0 }; // zero vector has no direction
        return { x: fx, y: fy };
      };

      // V0.19.6 (Roadmap Item 6): THE shared spell-shape test. This lived as a local `inFront` closure
      // inside resolveFighterRevampSpell, which is why cone targeting was fighter-only - no other
      // resolver could reach it, so every other spell's coneDegrees was inert. It is a prototype method
      // now so one implementation serves every class, rather than each resolver growing its own copy.
      // Returns true when `enemy` is alive, inside `radius`, and within `coneDegrees` of actor facing.
      Game.prototype.spellShapeContains = function(enemy, radius, coneDegrees = 360, actor = this.player) {
        const p = actor;
        if (!p || !enemy?.alive || distFn(enemy, p) > radius) return false;
        if (!(Number(coneDegrees) > 0) || Number(coneDegrees) >= 359) return true;
        const { x: fx, y: fy } = this.actorFacingVector(p);
        const dx = enemy.x - p.x, dy = enemy.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        const dot = (fx * dx + fy * dy) / (Math.hypot(fx, fy) || 1) / len;
        // Epsilon: Math.cos(Math.PI / 2) is 6.12e-17, not 0, so an enemy at EXACTLY 90 degrees fell
        // outside a 180-degree cone - a target standing straight out to your side got skipped on a
        // rounding artifact. Harmless at cleave's 100 degrees; right on the boundary for a half-plane.
        return dot >= Math.cos((Number(coneDegrees) * Math.PI / 180) * 0.5) - 1e-9;
      };

      Game.prototype.resolveFighterRevampSpell = function(spell, options = {}) {
        const p = this.player;
        const id = spell.fighterSpellId || normalizeSpellIconKey(spell);
        const color = spell.color || '#d0b070';
        const selectedTarget = options.target || this.getTarget?.();
        const hostileTarget = (range = spell.range || 1.65) => {
          const resolved = this.resolveHostileSpellTarget?.(spell, selectedTarget, { range });
          if (!resolved?.ok) return null;
          const target = resolved.target;
          p.setFacingFromDelta?.(target.x - p.x, target.y - p.y);
          return target;
        };
        const inFront = (enemy, radius, coneDegrees = 360) => this.spellShapeContains(enemy, radius, coneDegrees, p);
        const activeDamageMultiplier = () => {
          let mult = 1;
          for (const effect of p.buffs || []) {
            if (!effect || effect.remaining <= 0) continue;
            if (Number(effect.fighterMeleeDamageBonus || 0) > 0) mult *= (1 + Number(effect.fighterMeleeDamageBonus));
          }
          return mult;
        };
        const applyWeaponFlow = () => {
          const flow = p.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === 'fighter_weapon_flow');
          if (!flow) return 1;
          this.consumeFighterBuffCharge?.('fighter_weapon_flow', p);
          return 1 + Number(flow.damageBonus || 0.18);
        };
        const consumeMeleeChargeBuffs = () => {
          for (const id of ['fighter_bloodrush', 'fighter_berserkers_roar', 'fighter_savage_momentum']) {
            if (p.buffs?.some?.(buff => buff && buff.remaining > 0 && buff.id === id)) this.consumeFighterBuffCharge?.(id, p);
          }
        };
        const dealSingle = (target, baseDamage, extra = {}) => {
          if (!target) return 0;
          let dmg = Math.max(1, Math.floor(baseDamage * activeDamageMultiplier() * applyWeaponFlow() * Number(extra.multiplier || 1)));
          if (id === 'groundbreaker' && target.buffs?.some?.(buff => buff && buff.remaining > 0 && buff.id === 'fighter_crushed_armor')) dmg = Math.floor(dmg * (1 + Number(spell.bonusVsCrushedArmor || 0.10)));
          if (id === 'perfect_masterstroke' && this.isFighterPhysicalVulnerableTarget?.(target)) dmg = Math.floor(dmg * (1 + Number(spell.bonusVsSplitGuard || 0.15)));
          const dealt = this.damageEntity?.(target, dmg, p, color, { damageType: 'physical', spellName: spell.name, canCrit: true, threatMultiplier: spell.threatMultiplier || 1 }) || dmg;
          consumeMeleeChargeBuffs();
          return dealt;
        };

        if (id === 'momentum') {
          this.log('Momentum is a passive Fighter mechanic. Land heavy weapon attacks to build stacks.');
          this.addFighterMomentum?.(0, p);
          return;
        }
        if (id === 'battle_rush') {
          const t = hostileTarget(spell.range || 6); if (!t) return;
          if (this.hasStatusTag?.(p, 'root')) { this.log('You cannot Battle Rush while rooted.'); return; }
          const dx = p.x - t.x, dy = p.y - t.y;
          const len = Math.hypot(dx, dy) || 1;
          p.x = t.x + (dx / len) * 1.05;
          p.y = t.y + (dy / len) * 1.05;
          p.setFacingFromDelta?.(t.x - p.x, t.y - p.y);
          this.applyFighterSelfBuff?.(spell, 'fighter_rushing_force', 'Rushing Force', { stacks: 1, maxStacks: 1, nextMeleeDamageBonus: spell.nextMeleeDamageBonus || 0.25, tags: ['fighter', 'mobility', 'empower'] });
          this.spawnRing?.(p.x, p.y, color, 18);
          this.log('Battle Rush closes the distance without forcing enemy threat.');
          return;
        }
        if (id === 'weapon_flow') return this.applyFighterSelfBuff?.(spell, 'fighter_weapon_flow', 'Weapon Flow', { stacks: 2, maxStacks: 2, damageBonus: spell.damageBonus || 0.18, tags: ['fighter', 'heavy_weapon'] });
        if (id === 'savage_momentum') return this.applyFighterSelfBuff?.(spell, 'fighter_savage_momentum_watcher', 'Savage Momentum Watcher', { duration: 1800, stacks: 1, maxStacks: 1, fighterWatcher: true, tags: ['fighter', 'watcher'] });
        if (id === 'bloodrush') return this.applyFighterSelfBuff?.(spell, 'fighter_bloodrush', 'Bloodrush', { stacks: 10, maxStacks: 10, fighterMeleeDamageBonus: 0.18, critChanceBonus: 0.12, damageTakenMultiplier: 1.08, tags: ['fighter', 'reckless'] });
        if (id === 'unstoppable_footwork') {
          this.cleanseStatusEffects?.(p, { tags: ['root', 'slow', 'snare'] });
          return this.applyFighterSelfBuff?.(spell, 'fighter_unstoppable_footwork', 'Unstoppable Footwork', { stacks: 3, maxStacks: 3, moveSpeedMultiplier: 1.10, controlResistancePct: 0.50, tags: ['fighter', 'movement', 'control_resist'] });
        }
        if (id === 'berserker_s_roar') return this.applyFighterSelfBuff?.(spell, 'fighter_berserkers_roar', "Berserker's Roar", { stacks: 8, maxStacks: 8, fighterMeleeDamageBonus: 0.15, cleaveRadiusBonus: 2, damageTakenMultiplier: 1.10, tags: ['fighter', 'reckless', 'cleave'] });

        if (id === 'heavy_riposte' && !p.buffs?.some?.(buff => buff && buff.remaining > 0 && buff.id === 'fighter_riposte_ready')) {
          this.log('Heavy Riposte requires Riposte Ready from a dodge or parry.');
          return;
        }

        if (id === 'cleave' || id === 'groundbreaker' || id === 'whirlwind_cleave') {
          const radiusBonus = p.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === 'fighter_berserkers_roar')?.cleaveRadiusBonus || 0;
          const radius = Number(spell.radius || 2.5) + Number(radiusBonus || 0);
          const enemies = (this.queryEnemiesNearPoint?.(p.x, p.y, radius + 0.5) || this.enemies || [])
            // V0.19.6 (Roadmap Item 6): data-driven cone. This used to hardcode `id === 'cleave'`, so a
            // spell's declared coneDegrees was inert for all 279 other spells. Behaviour is unchanged:
            // cleave declares coneDegrees 100 and still gets 100; groundbreaker and whirlwind_cleave
            // declare none and stay 360 - correctly, since a ground slam and a spin ARE omnidirectional.
            .filter(enemy => inFront(enemy, radius, Number(spell.coneDegrees) > 0 ? Number(spell.coneDegrees) : 360))
            .slice(0, Math.max(1, Number(spell.targetCap || 5)));
          let hits = 0;
          const base = this.fighterWeaponDamage?.(spell, p) || Number(spell.power || 1);
          const tickCount = id === 'whirlwind_cleave' ? Math.max(1, Number(spell.tickCount || 3)) : 1;
          for (const enemy of enemies) {
            for (let i = 0; i < tickCount; i += 1) dealSingle(enemy, base, { multiplier: 1 });
            hits += 1;
            if (id === 'groundbreaker') {
              const duration = Number(spell.staggerDuration || 0.75) + (p.buffs?.some?.(buff => buff && buff.remaining > 0 && buff.id === 'fighter_berserkers_roar') ? 0.25 : 0);
              this.applyStatusEffect?.(enemy, this.decorateStatusEffectFromSpell(spell, { id: 'fighter_groundbreaker_stagger', name: 'Staggered', type: 'debuff', duration, color, hostile: true, tags: ['fighter', 'stun'], mods: { speed: -999 } }), p);
            }
          }
          if (hits >= Number(spell.momentumGainOnTargets || 99)) this.addFighterMomentum?.(spell.momentumGain || 1, p);
          // V0.19.8 (Roadmap Item 6): draw the arc that was actually swung. Cleave tested a 100-degree
          // cone and drew a full ring, telling the player the opposite of where it lands. `radius` here
          // already includes the Berserker's Roar bonus, so the drawn cone grows exactly as the real one
          // does. Groundbreaker and whirlwind_cleave declare no cone and ARE omnidirectional - they keep
          // the ring, which is the honest picture for a ground slam and a spin.
          const drawnCone = Number(spell.coneDegrees) > 0 ? Number(spell.coneDegrees) : 0;
          if (drawnCone > 0) this.spawnSpellConeVfx?.(p, color, radius, drawnCone, { sourceClass: 'fighter', kind: id });
          else this.spawnRing?.(p.x, p.y, color, id === 'cleave' ? 16 : 22);
          p.attackAnim = Math.max(Number(p.attackAnim || 0), id === 'whirlwind_cleave' ? 1.2 : 0.9);
          this.log(`${spell.name} hits ${hits} enem${hits === 1 ? 'y' : 'ies'}.`);
          return;
        }

        const t = hostileTarget(spell.range || 1.65); if (!t) return;
        if (id === 'final_swing' && (t.hp || 0) / Math.max(1, t.maxHp || 1) > Number(spell.executeThresholdPct || 0.30)) {
          this.log('Final Swing requires the target to be at or below 30% HP.');
          return;
        }
        let base = this.fighterWeaponDamage?.(spell, p) || Number(spell.power || 1);
        if (id === 'final_swing') {
          const missing = 1 - ((t.hp || 0) / Math.max(1, t.maxHp || 1));
          base = Math.floor(base * (1 + Math.min(Number(spell.missingHpBonusMax || 0.75), missing * Number(spell.missingHpBonusMax || 0.75))));
        }
        if (id === 'perfect_masterstroke') {
          const consumed = this.consumeFighterMomentum?.(spell.consumeMomentumMax || 5, p) || 0;
          base += consumed * Number(spell.perMomentumFlatDamage || 30) + Math.floor((p.getStat?.('attack') || p.attack || 8) * consumed * Number(spell.perMomentumWeaponMultiplier || 0.35));
        }
        const rush = p.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === 'fighter_rushing_force');
        if (rush) { base = Math.floor(base * (1 + Number(rush.nextMeleeDamageBonus || 0.25))); rush.remaining = 0; }
        const wasAlive = t.alive && t.hp > 0;
        const damage = dealSingle(t, base);
        if (id === 'crushing_blow') this.applyStatusEffect?.(t, this.decorateStatusEffectFromSpell(spell, { id: 'fighter_crushed_armor', name: 'Crushed Armor', type: 'debuff', duration: 12, color, hostile: true, mods: { defense: -3 }, tags: ['fighter', 'armor_break'], description: 'Armor reduced by 8%.' }), p);
        if (id === 'armor_splitter') this.applyStatusEffect?.(t, this.decorateStatusEffectFromSpell(spell, { id: 'fighter_split_guard', name: 'Split Guard', type: 'debuff', duration: 10, color, hostile: true, physicalDamageTakenMultiplier: 1.08, tags: ['fighter', 'physical_vulnerability'], description: 'Physical damage taken increased by 8%.' }), p);
        if (id === 'bonebreaker') this.applyStatusEffect?.(t, this.decorateStatusEffectFromSpell(spell, { id: 'fighter_bonebreaker', name: 'Bonebreaker', type: 'debuff', duration: 10, color, hostile: true, moveSpeedMultiplier: 0.60, tags: ['fighter', 'slow'], description: 'Movement slowed and attack speed reduced.' }), p);
        if (id === 'reckless_strike') this.applyStatusEffect?.(p, this.decorateStatusEffectFromSpell(spell, { id: 'fighter_reckless_exposure', name: 'Reckless Exposure', type: 'debuff', duration: 8, color: '#b85a42', hostile: true, damageTakenMultiplier: 1.08, tags: ['fighter', 'reckless'], description: 'Incoming damage increased by 8%.' }), p);
        if (id === 'shatter_guard') {
          const shield = t.buffs?.find?.(buff => buff && buff.remaining > 0 && (Number(buff.absorbRemaining || 0) > 0 || buff.tags?.includes?.('shield') || buff.tags?.includes?.('ward')));
          if (shield) { shield.remaining = 0; this.spawnStatusPulse?.(t, color, 'Shattered'); }
        }
        if (spell.momentumGain) this.addFighterMomentum?.(spell.momentumGain, p);
        if (id === 'heavy_riposte') this.removeStatusEffect?.(p, 'fighter_riposte_ready');
        if (wasAlive && (!t.alive || t.hp <= 0)) {
          if (Number(spell.killResourceRefund || 0) > 0) this.restoreMana?.(p, Number(spell.killResourceRefund));
          if (Number(spell.killMomentumGain || 0) > 0) this.addFighterMomentum?.(spell.killMomentumGain, p);
          const watcher = p.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === 'fighter_savage_momentum_watcher');
          if (watcher) this.applyFighterSelfBuff?.({ ...spell, duration: 300, color }, 'fighter_savage_momentum', 'Savage Momentum', { stacks: 6, maxStacks: 6, fighterMeleeDamageBonus: 0.08, moveSpeedMultiplier: 1.12, tags: ['fighter', 'triggered'] });
        }
        // V0.20.1 (Roadmap Item 6): the style is authored per-spell now, like coneDegrees. This used to
        // read `id === 'titan_chop' || id === 'perfect_masterstroke' ? 'slam' : 'slash'`, so all eight
        // of the fighter's OTHER single-target melee spells - an armor split, a bone snap, an execute,
        // a shield shatter, a counter-riposte - drew the same generic sweep as level-1 Heavy Swing.
        // validateSpellShapes() checks every authored vfxStyle against DR.SLASH_STYLES.
        this.playAttackAnimation?.(p, t, color, spell.vfxStyle || 'slash');
        this.spawnCombatImpact?.(t, color, 1.2, 'player');
        this.log(`${spell.name} hits ${t.name || 'target'} for ${damage}.`);
      };

      Game.prototype.isAssassinMarkedTarget = function(target, source = this.player) {
        if (!target || !Array.isArray(target.buffs)) return false;
        const sourceId = source?.id ?? null;
        return target.buffs.some(buff => buff && buff.remaining > 0 && buff.id === 'assassin_marked_for_death' && (sourceId == null || buff.sourceId === sourceId));
      };

      Game.prototype.applyAssassinPoisonStack = function(target, spell, stacks = 1, options = {}) {
        if (!target || !target.alive) return null;
        const lotus = this.player?.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === 'black_lotus_venom');
        const lotusBonus = lotus ? Number(lotus.poisonDamageBonus || 0.35) : 0;
        const tickBase = Number(options.tick || spell?.poisonTick || 6) + Math.max(0, (this.player?.level || 1) - 1) * Number(options.tickScale ?? spell?.poisonTickScale ?? 0.45);
        const markBonus = this.isAssassinMarkedTarget?.(target, this.player) ? Number(spell?.markPoisonBonus || 0) : 0;
        const periodicDamage = Math.max(1, Math.floor(tickBase * (1 + lotusBonus + markBonus)));
        const effect = this.applyStatusEffect?.(target, this.decorateStatusEffectFromSpell(spell, {
          id: 'assassin_poison_payload',
          name: 'Poison Payload',
          type: 'dot',
          duration: Number(options.duration || spell?.poisonDuration || 12),
          tickRate: Number(options.tickRate || spell?.poisonTickRate || 3),
          periodicDamage,
          damageType: 'poison',
          maxStacks: 5,
          stacks: Math.max(1, Math.floor(stacks)),
          color: '#71d36a',
          hostile: true,
          tags: ['poison', 'venom', 'dot'],
          sourceClass: 'Assassin',
          sourceSpellId: spell?.id || spell?.assassinSpellId || null,
          description: 'Assassin poison stack. Stacks up to 5 and ticks every 3 seconds.'
        }), this.player);
        if (lotus) {
          lotus.stacks = Math.max(0, Number(lotus.stacks || lotus.charges || 1) - Math.max(1, Math.floor(stacks)));
          if (lotus.stacks <= 0) lotus.remaining = 0;
        }
        return effect;
      };

      Game.prototype.consumeAssassinBuffStack = function(statusId) {
        const p = this.player;
        const buff = p?.buffs?.find?.(entry => entry && entry.remaining > 0 && entry.id === statusId);
        if (!buff) return null;
        buff.stacks = Math.max(0, Number(buff.stacks || buff.charges || 1) - 1);
        if (buff.stacks <= 0) buff.remaining = 0;
        return buff;
      };

      Game.prototype.applyAssassinTrap = function(spell, target = null) {
        const p = this.player;
        const t = target || this.getTarget?.();
        if (!t || !t.alive || !this.isHostileTarget?.(t)) {
          this.log(`${spell.name} requires a hostile target path to place the trap.`);
          return false;
        }
        const base = this.scaledSpellValue?.(spell, 'power', 'levelScale') || Number(spell.power || 0);
        let damage = base;
        if (this.isAssassinMarkedTarget?.(t, p)) damage = Math.floor(damage * (1 + Number(spell.markDamageBonus || 0)));
        const fused = t.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === 'assassin_shadow_fused');
        if (fused) { damage = Math.floor(damage * 1.35); fused.remaining = 0; }
        if (damage > 0) this.damageEntity?.(t, damage, p, spell.color || p.color, { damageType: spell.damageType || 'physical', spellName: spell.name });
        if (Number(spell.poisonStacks || 0) > 0 || Number(spell.poisonTick || 0) > 0) this.applyAssassinPoisonStack?.(t, spell, Math.max(1, Number(spell.poisonStacks || 1)));
        if (Number(spell.tickDamage || 0) > 0) {
          this.applyStatusEffect?.(t, this.decorateStatusEffectFromSpell(spell, { id: `${spell.assassinSpellId || normalizeSpellIconKey(spell)}_bleed`, name: spell.name, type: 'dot', duration: spell.tickDuration || 8, tickRate: spell.tickRate || 2, periodicDamage: spell.tickDamage, damageType: spell.damageType || 'physical', color: spell.color, hostile: true, tags: spell.tags || ['trap'] }), p);
        }
        if (spell.mods && Object.keys(spell.mods).length) {
          this.applyStatusEffect?.(t, this.decorateStatusEffectFromSpell(spell, { id: `${spell.assassinSpellId || normalizeSpellIconKey(spell)}_debuff`, name: spell.name, type: 'debuff', duration: spell.duration || 6, mods: spell.mods, moveSpeedMultiplier: spell.moveSpeedMultiplier || 0, color: spell.color, hostile: true, tags: spell.tags || ['trap'] }), p);
        }
        const shadowFuse = p?.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === 'shadow_fuse');
        if (shadowFuse) {
          this.applyStatusEffect?.(t, this.decorateStatusEffectFromSpell(spell, { id: 'assassin_shadow_fused', name: 'Shadow Fused', type: 'debuff', duration: 10, color: '#9b5cff', hostile: true, tags: ['trap', 'poison'], description: 'The next Assassin trap hit deals increased damage and poison bites harder.' }), p);
          this.consumeAssassinBuffStack?.('shadow_fuse');
        }
        const trapId = spell.assassinSpellId || normalizeSpellIconKey(spell);
        const trapMarked = this.isAssassinMarkedTarget?.(t, p);
        this.spawnAssassinTripwireVfx?.(p, t, 'place', { color: trapId === 'poison_snare' ? '#8fe07d' : '#cfd5d0', marked: trapMarked });
        this.spawnAssassinTripwireVfx?.(p, t, 'trigger', { color: trapId === 'poison_snare' ? '#a6f28c' : '#f1f4e7', marked: trapMarked });
        if (trapId === 'poison_snare') this.spawnAssassinPoisonPulseVfx?.(t, { color: '#72df68', intensity: 1.0 });
        else if (trapId === 'springblade_trap') this.spawnAssassinImpactVfx?.('blade', t, { intensity: 1.25, marked: trapMarked });
        this.spawnStatusPulse?.(t, spell.color || p.color, spell.name);
        this.log(`${spell.name} triggers on ${t.name || 'target'}.`);
        return true;
      };

      Game.prototype.resolveAssassinRevampSpell = function(spell, options = {}) {
        const p = this.player;
        const id = spell.assassinSpellId || normalizeSpellIconKey(spell);
        const color = spell.color || p.color;
        const target = options.target || this.getTarget?.();
        const hostileTarget = () => {
          const resolved = this.resolveHostileSpellTarget?.(spell, target, { range: spell.range || 7 });
          if (!resolved?.ok) return null;
          p.setFacingFromDelta?.(resolved.target.x - p.x, resolved.target.y - p.y);
          return resolved.target;
        };
        const SELF_BUFF_STYLE = { quick_reload: 'reload', silent_step: 'silentstep', shadow_fuse: 'shadowfuse', black_lotus_venom: 'venomcoat', perfect_ambush: 'ambush' };
        const selfBuff = (statusId, name, extra = {}) => {
          this.applyStatusEffect?.(p, this.decorateStatusEffectFromSpell(spell, { id: statusId, name, type: 'buff', duration: spell.duration || 300, mods: spell.mods || {}, color, hostile: false, stacks: extra.stacks || spell.charges || 1, maxStacks: extra.maxStacks || spell.charges || 1, tags: extra.tags || ['assassin'], ...extra }), p);
          this.spawnAssassinSelfBuffVfx?.(SELF_BUFF_STYLE[statusId] || 'ambush', p, { color });
          this.log(`${spell.name} is ready.`);
        };
        // Each damage spell fires as the weapon it actually is.
        const ASSASSIN_PROJECTILE_KIND = { throwing_knife: 'knife', ricochet_blade: 'blade', light_crossbow_shot: 'crossbow', piercing_bolt: 'heavyBolt', venom_bolt: 'venomBolt', execution_bolt: 'executionBolt', repeater_burst: 'crossbow', silent_finish: 'executionBolt', poison_dart: 'poisonDart' };
        if (id === 'marked_for_death') {
          const t = hostileTarget(); if (!t) return;
          for (const enemy of this.enemies || []) {
            if (!Array.isArray(enemy.buffs)) continue;
            const hadMark = enemy.buffs.some(buff => buff && buff.id === 'assassin_marked_for_death' && buff.sourceId === p.id);
            if (hadMark && enemy !== t) this.spawnAssassinMarkRemovedVfx?.(enemy, 'replaced', p);
            enemy.buffs = enemy.buffs.filter(buff => !(buff.id === 'assassin_marked_for_death' && buff.sourceId === p.id));
          }
          this.applyStatusEffect?.(t, this.decorateStatusEffectFromSpell(spell, { id: 'assassin_marked_for_death', name: 'Marked for Death', type: 'debuff', duration: 300, color: '#d44545', hostile: true, tags: ['mark', 'execution'], description: 'Assassin damage against this target is increased by 8%.' }), p);
          this.spawnAssassinMarkAppliedVfx?.(p, t);
          this.spawnStatusPulse?.(t, '#d44545', 'Marked');
          this.log(`${t.name || 'Target'} is Marked for Death.`);
          return;
        }
        if (id === 'quick_reload') return selfBuff('quick_reload', 'Quick Reload', { stacks: 1, maxStacks: 1, quickReloadDamageBonus: spell.quickReloadDamageBonus || 0.20, tags: ['assassin', 'crossbow'] });
        if (id === 'silent_step') return selfBuff('silent_step', 'Silent Step', { stacks: 3, maxStacks: 3, tags: ['assassin', 'movement'] });
        if (id === 'shadow_fuse') return selfBuff('shadow_fuse', 'Shadow Fuse', { stacks: 3, maxStacks: 3, tags: ['assassin', 'trap'] });
        if (id === 'black_lotus_venom') return selfBuff('black_lotus_venom', 'Black Lotus Venom', { stacks: 12, maxStacks: 12, poisonDamageBonus: spell.poisonDamageBonus || 0.35, tags: ['assassin', 'poison'] });
        if (id === 'perfect_ambush') return selfBuff('perfect_ambush', 'Perfect Ambush', { stacks: 3, maxStacks: 3, tags: ['assassin', 'ambush'] });
        if (spell.trap) { this.applyAssassinTrap?.(spell, target); return; }
        if (id === 'death_box') {
          const center = target && target.alive && this.isHostileTarget?.(target) ? target : p;
          let count = 0;
          for (const enemy of (this.queryEnemiesNearPoint?.(center.x, center.y, spell.radius || 8) || this.enemies || [])) {
            if (!enemy?.alive || distFn(enemy, center) > (spell.radius || 8)) continue;
            let dmg = this.scaledSpellValue?.(spell, 'fieldTickDamage', 'levelScale') || this.scaledSpellValue?.(spell);
            if (this.isAssassinMarkedTarget?.(enemy, p)) dmg = Math.floor(dmg * (1 + Number(spell.markDamageBonus || 0)));
            this.damageEntity?.(enemy, dmg, p, color, { damageType: 'physical', spellName: spell.name });
            this.spawnAssassinImpactVfx?.('blade', enemy, { intensity: 0.72, seed: count * 91, marked: this.isAssassinMarkedTarget?.(enemy, p) });
            count++;
          }
          this.spawnAssassinTrapFieldVfx?.(center, spell.radius || 8, { color, color2: '#f0c6ff' });
          this.log(`${spell.name} tears through ${count} enemies.`);
          return;
        }
        if (spell.kind === 'aoe') {
          let count = 0, aimX = 0, aimY = 0, aimed = false;
          // V0.19.6 (Roadmap Item 6): honour a declared cone here too - this handler was a pure radius
          // check, so a spell describing itself as a cone still hit a full circle. Only engages when
          // the spell actually declares coneDegrees, so every existing aoe spell is unchanged.
          const aoeRadius = spell.radius || 3.2;
          const aoeCone = Number(spell.coneDegrees) > 0 ? Number(spell.coneDegrees) : 360;
          // V0.19.7 (Roadmap Item 6): a cone needs ONE direction, or the arc you see and the arc that
          // kills are different arcs. Unlike the fighter's resolver - whose hostileTarget() faces the
          // target before it swings - this handler never set facing, so the cone pointed wherever the
          // player happened to be looking while the VFX pointed at the first enemy found: up to half a
          // cone apart. Face the selected target first, then facing drives BOTH the test and the visual.
          if (aoeCone < 359) {
            const sel = this.getTarget?.();
            if (sel?.alive && distFn(sel, p) <= aoeRadius) p.setFacingFromDelta?.(sel.x - p.x, sel.y - p.y);
          }
          for (const enemy of (this.queryEnemiesNearPoint?.(p.x, p.y, aoeRadius) || this.enemies || [])) {
            if (!enemy?.alive || distFn(enemy, p) > aoeRadius) continue;
            if (aoeCone < 359 && !this.spellShapeContains(enemy, aoeRadius, aoeCone, p)) continue;
            if (!aimed) { aimX = enemy.x - p.x; aimY = enemy.y - p.y; aimed = true; }
            let dmg = this.scaledSpellValue?.(spell);
            const em = this.isAssassinMarkedTarget?.(enemy, p);
            if (em) dmg = Math.floor(dmg * (1 + Number(spell.markDamageBonus || 0)));
            this.damageEntity?.(enemy, dmg, p, color, { damageType: 'physical', spellName: spell.name });
            this.spawnAssassinImpactVfx?.('blade', enemy, { intensity: 0.8, seed: count * 71, marked: em });
            count++;
            if (count >= Number(spell.targetCap || 5)) break;
          }
          // V0.19.7: for a cone, draw exactly what was tested - same origin, direction, spread and reach.
          // The old `radius: spell.range || spell.radius` also drew the blades to range (3.0) while the
          // hit test used radius (3.2), so they visibly fell short of where they were killing.
          const coneSpell = aoeCone < 359;
          const facingVec = this.actorFacingVector(p);
          const facing = coneSpell
            ? Math.atan2(facingVec.y, facingVec.x)
            : (aimed ? Math.atan2(aimY, aimX) : (Number(p.facingAngle) || 0));
          const fanOptions = {
            count: spell.targetCap || 5,
            radius: coneSpell ? aoeRadius : (spell.range || spell.radius || 3.2),
            angle: facing,
            marked: aimed && this.isAssassinMarkedTarget?.(this.getTarget?.(), p)
          };
          if (coneSpell) fanOptions.spread = (aoeCone * Math.PI) / 180;
          this.spawnAssassinFanVfx?.(p, fanOptions);
          this.log(`${spell.name} hits ${count} enemies.`);
          return;
        }
        const t = hostileTarget(); if (!t) return;
        let dmg = this.scaledSpellValue?.(spell);
        const quickReload = p.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === 'quick_reload');
        if (quickReload && spell.crossbow) { dmg = Math.floor(dmg * (1 + Number(quickReload.quickReloadDamageBonus || 0.20))); quickReload.remaining = 0; }
        if (this.isAssassinMarkedTarget?.(t, p)) dmg = Math.floor(dmg * (1 + Number(spell.markDamageBonus || 0)));
        if (Number(spell.executeThresholdPct || 0) > 0 && (t.hp || 0) / Math.max(1, t.maxHp || 1) <= spell.executeThresholdPct) dmg = Math.floor(dmg * (1 + Number(spell.executeDamageBonus || 0.35)));
        if (Number(spell.poisonStackDamageBonus || 0) > 0) {
          const poison = t.buffs?.find?.(buff => buff && buff.id === 'assassin_poison_payload' && buff.remaining > 0);
          const stacks = Math.max(0, Number(poison?.stacks || 0));
          dmg = Math.floor(dmg * (1 + Math.min(Number(spell.poisonStackDamageBonusMax || 0.60), stacks * Number(spell.poisonStackDamageBonus || 0))));
        }
        const ambush = p.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === 'perfect_ambush');
        if (ambush && this.isAssassinMarkedTarget?.(t, p)) { dmg = Math.floor(dmg * (1 + Number(spell.ambushDamageBonus || 0.20))); this.consumeAssassinBuffStack?.('perfect_ambush'); }
        const wasAlive = t.alive && t.hp > 0;
        const markedAtImpact = this.isAssassinMarkedTarget?.(t, p) === true;
        // Bespoke launch VFX - each damage spell reads as the weapon it is
        // (thrown steel, light bolt, heavy quarrel, venom bolt, executioner bolt,
        // a five-bolt burst). No generic bolt fallback.
        const projKind = ASSASSIN_PROJECTILE_KIND[id] || (spell.crossbow ? 'crossbow' : 'knife');
        const vfxSeed = Math.floor(Math.random() * 10000);
        if (spell.crossbow) this.spawnAssassinCrossbowAimVfx?.(p, t, { color: '#c7cdd0' });
        if (id === 'repeater_burst') this.spawnAssassinBurstVfx?.('crossbow', p, t, Number(spell.boltCount || 5), { marked: markedAtImpact, seed: vfxSeed });
        else this.spawnAssassinProjectileVfx?.(projKind, p, t, { marked: markedAtImpact, seed: vfxSeed });
        const dealt = this.damageEntity?.(t, dmg, p, color, { damageType: spell.damageType || 'physical', spellName: spell.name });
        this.spawnAssassinImpactVfx?.(projKind, t, { marked: markedAtImpact, intensity: id === 'repeater_burst' ? 1.4 : (spell.crossbow ? 1.15 : 0.95), seed: vfxSeed });
        if (Number(spell.poisonStacks || 0) > 0 || Number(spell.poisonTick || 0) > 0) {
          this.applyAssassinPoisonStack?.(t, spell, Math.max(1, Number(spell.poisonStacks || 1)));
          this.spawnAssassinPoisonPulseVfx?.(t, { color: '#72df68', intensity: 1.0 });
        }
        const lotus = p.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === 'black_lotus_venom');
        if (lotus && Number(spell.blackLotusPoisonChance || 0) > 0 && Math.random() < Number(spell.blackLotusPoisonChance)) { this.applyAssassinPoisonStack?.(t, spell, 1); this.spawnAssassinPoisonPulseVfx?.(t, { color: '#72df68', intensity: 0.8 }); }
        if (id === 'ricochet_blade') {
          const secondary = (this.queryEnemiesNearPoint?.(t.x, t.y, spell.bounceRange || 8) || this.enemies || []).find(enemy => enemy && enemy !== t && enemy.alive && distFn(enemy, t) <= (spell.bounceRange || 8));
          if (secondary) {
            const sm = this.isAssassinMarkedTarget?.(secondary, p);
            this.spawnAssassinProjectileVfx?.('blade', t, secondary, { marked: sm, seed: vfxSeed + 7, speed: 34 });
            this.damageEntity?.(secondary, Math.floor(dmg * Number(spell.bounceDamageMultiplier || 0.65)), p, color, { damageType: 'physical', spellName: spell.name });
            this.spawnAssassinImpactVfx?.('blade', secondary, { marked: sm, intensity: 0.85, seed: vfxSeed + 7 });
          }
        }
        if (wasAlive && (!t.alive || t.hp <= 0)) {
          if (markedAtImpact) this.spawnAssassinMarkRemovedVfx?.(t, 'death', p);
          if (Number(spell.killResourceRefund || 0) > 0) this.restoreMana?.(p, Number(spell.killResourceRefund));
        }
        this.log(`${spell.name} hits ${t.name || 'target'} for ${dealt || dmg}.`);
      };

      Game.prototype.bardAlliesForSpell = function(spell) {
        const allies = (this.friendlyTargetsForSpell?.(spell.radius || 18) || [this.player, this.merc, this.pet, ...(this.botPlayers || [])]).filter(actor => actor && actor.alive !== false);
        return allies.slice(0, Math.max(1, Number(spell.targetCap || 6)));
      };

      Game.prototype.applyBardMajorSongLimit = function(ally, source, incomingId) {
        if (!ally || !Array.isArray(ally.buffs)) return;
        const sourceId = source?.id ?? null;
        // V0.18.65 (Roadmap Item 13): the major-song concurrency cap is now DATA in the central
        // effect policy (core/effect-policy.js, category 'major_song') instead of hard-coded here.
        // This drops the oldest major songs from the same bard until the incoming one fits, exactly
        // as before, but the number (currently 5, was a hard-coded 2 then 5) lives in one place.
        const policy = window.DreamRealms?.effectPolicy;
        if (policy?.enforceConcurrency) {
          policy.enforceConcurrency(ally, 'major_song', { sourceId, incomingId });
          return;
        }
        // Fallback if the policy module is unavailable: preserve the previous behaviour.
        const cap = 5;
        const majors = ally.buffs.filter(buff => buff && buff.remaining > 0 && buff.sourceId === sourceId && buff.majorSong === true && buff.id !== incomingId);
        while (majors.length >= cap) {
          const oldest = majors.shift();
          ally.buffs = ally.buffs.filter(buff => buff !== oldest);
        }
      };

      Game.prototype.resolveBardRevampSpell = function(spell, options = {}) {
        const p = this.player;
        const id = spell.bardSpellId || normalizeSpellIconKey(spell);
        const color = spell.color || p.color;
        const target = options.target || this.getTarget?.();
        const bardDebuffed = entity => entity?.buffs?.some?.(buff => buff && buff.remaining > 0 && buff.tags?.includes?.('bard_debuff'));
        const hitHostile = (bonus = 0) => {
          const resolved = this.resolveHostileSpellTarget?.(spell, target, { range: spell.range || 7 });
          if (!resolved?.ok) return null;
          const t = resolved.target;
          let dmg = this.scaledSpellValue?.(spell);
          if (bardDebuffed(t)) dmg = Math.floor(dmg * (1 + bonus));
          if (Number(spell.executeThresholdPct || 0) > 0 && (t.hp || 0) / Math.max(1, t.maxHp || 1) <= spell.executeThresholdPct) dmg = Math.floor(dmg * (1 + Number(spell.executeDamageBonus || 0)));
          this.damageEntity?.(t, dmg, p, color, { damageType: spell.damageType || 'magic', spellName: spell.name });
          if ((spell.mods && Object.keys(spell.mods).length) || spell.moveSpeedMultiplier) this.applyStatusEffect?.(t, this.decorateStatusEffectFromSpell(spell, { id: id, name: spell.name, type: 'debuff', duration: spell.duration || 10, mods: spell.mods || {}, moveSpeedMultiplier: spell.moveSpeedMultiplier || 0, color, hostile: true, tags: spell.tags || ['bard_debuff'] }), p);
          this.spawnBardSpellEffect?.(spell.name, p, t, { spell, color });
          this.log(`${spell.name} resonates through ${t.name || 'target'}.`);
          return t;
        };
        if (spell.kind === 'bolt') { hitHostile(0.10); return; }
        if (spell.kind === 'debuff') { hitHostile(0); return; }
        if (spell.kind === 'aoeDebuff') {
          let count = 0;
          for (const enemy of (this.queryEnemiesNearPoint?.(p.x, p.y, spell.radius || 8) || this.enemies || [])) {
            if (!enemy?.alive || distFn(enemy, p) > (spell.radius || 8)) continue;
            this.damageEntity?.(enemy, this.scaledSpellValue?.(spell), p, color, { damageType: spell.damageType || 'magic', spellName: spell.name });
            this.applyStatusEffect?.(enemy, this.decorateStatusEffectFromSpell(spell, { id, name: spell.name, type: 'debuff', duration: spell.duration || 10, mods: spell.mods || {}, moveSpeedMultiplier: spell.moveSpeedMultiplier || 0, color, hostile: true, tags: spell.tags || ['bard_debuff'] }), p);
            if (++count >= Number(spell.targetCap || 6)) break;
          }
          this.spawnBardSpellEffect?.(spell.name, p, null, { spell, color, center: p, radius: spell.radius || 6 });
          this.log(`${spell.name} weakens ${count} enemies.`);
          return;
        }
        if (spell.kind === 'buff') {
          this.applyStatusEffect?.(p, this.decorateStatusEffectFromSpell(spell, { id, name: spell.buffName || spell.name, type: 'buff', duration: spell.duration || 300, mods: spell.mods || {}, color, hostile: false, tags: spell.tags || ['song'], ...spell }), p);
          this.spawnBardSpellEffect?.(spell.name, p, p, { spell, color });
          this.log(`${spell.name} begins.`);
          return;
        }
        if (spell.kind === 'groupBuff') {
          const allies = this.bardAlliesForSpell?.(spell) || [p];
          const statusId = id;
          for (const ally of allies) {
            if (spell.majorSong) this.applyBardMajorSongLimit?.(ally, p, statusId);
            const periodicHealing = spell.periodicHealingPct ? Math.max(1, Math.floor((ally.maxHp || 1) * spell.periodicHealingPct)) : (spell.periodicHealing ? Math.floor(spell.periodicHealing + (this.player.level - 1) * Number(spell.periodicHealingScale || 0)) : 0);
            const periodicMana = spell.periodicManaPct ? Math.max(1, Math.floor((ally.maxMana || 0) * spell.periodicManaPct)) : Number(spell.periodicMana || 0);
            this.applyStatusEffect?.(ally, this.decorateStatusEffectFromSpell(spell, { id: statusId, name: spell.buffName || spell.name, type: periodicHealing || periodicMana ? 'hot' : 'buff', duration: spell.duration || 300, mods: spell.mods || {}, periodicHealing, periodicMana, tickRate: spell.tickRate || 5, color, hostile: false, tags: spell.tags || ['song'], majorSong: Boolean(spell.majorSong), damageTakenMultiplier: spell.damageTakenMultiplier || 0, damageDoneMultiplier: spell.damageDoneMultiplier || 0, absorbRemaining: Number(spell.absorbFlat || 0) + Math.floor((ally.maxHp || 0) * Number(spell.absorbMaxHpPct || 0)) }), p);
          }
          this.spawnBardSpellEffect?.(spell.name, p, p, { spell, color, allies: allies.map(a => ({ id: a.id || null, x: a.x, y: a.y, name: a.name || '' })), duration: spell.duration, radius: spell.radius });
          this.log(`${spell.name} carries to ${allies.length} allies.`);
          return;
        }
        hitHostile(0.10);
      };


      Game.prototype.druidAlliesForSpell = function(spell, origin = this.player) {
        const radius = Number(spell.radius || spell.range || 12);
        const allies = (this.friendlyTargetsForSpell?.(radius) || [this.player, this.merc, this.pet, ...(this.botPlayers || [])]).filter(actor => actor && actor.alive !== false);
        return allies.slice(0, Math.max(1, Number(spell.targetCap || 6)));
      };

      Game.prototype.hasDruidHot = function(actor) {
        return Array.isArray(actor?.buffs) && actor.buffs.some(buff => buff && buff.remaining > 0 && buff.tags?.includes?.('druid') && buff.tags?.includes?.('hot'));
      };

      Game.prototype.druidScaledValue = function(spell, key = 'power', scaleKey = 'levelScale') {
        return Math.max(0, Math.floor(Number(spell?.[key] || 0) + Math.max(0, (this.player?.level || 1) - 1) * Number(spell?.[scaleKey] || 0)));
      };

      Game.prototype.resolveDruidRevampSpell = function(spell, options = {}) {
        const p = this.player;
        const id = spell.druidSpellId || normalizeSpellIconKey(spell);
        const color = spell.color || p.color;
        const target = options.target || this.getTarget?.();
        const allyTarget = () => this.getFriendlySpellTarget?.(spell.range || 7.5) || this.lowestAlly?.() || p;
        const hostileTarget = () => {
          const resolved = this.resolveHostileSpellTarget?.(spell, target, { range: spell.range || 7.5 });
          if (!resolved?.ok) return null;
          p.setFacingFromDelta?.(resolved.target.x - p.x, resolved.target.y - p.y);
          return resolved.target;
        };
        const applyHot = (ally, statusId = id, statusName = spell.buffName || spell.name, bonus = 0) => {
          const tick = Math.max(1, Math.floor(this.druidScaledValue?.(spell, 'periodicHealing', 'periodicHealingScale') || Number(spell.periodicHealing || 0)));
          this.applyStatusEffect?.(ally, this.decorateStatusEffectFromSpell(spell, { id: statusId, name: statusName, type: 'hot', duration: spell.duration || 300, periodicHealing: Math.floor(tick * (1 + bonus)), tickRate: spell.tickRate || 3, color, hostile: false, tags: spell.tags || ['druid','hot','nature'], healingCapPct: spell.healingCapPct || 0 }), p);
          return tick;
        };
        const healAlly = (ally, baseSpell = spell, bonus = 0) => {
          let amount = this.druidScaledValue?.(baseSpell, 'heal', 'healScale') || Number(baseSpell.heal || 0);
          if (this.hasDruidHot?.(ally)) amount = Math.floor(amount * (1 + Number(baseSpell.hotHealBonus || baseSpell.hotHealingBonus || 0)));
          amount = Math.floor(amount * (1 + bonus));
          return this.healEntity?.(ally, amount, true, p, { canCrit: true, spellName: spell.name }) || 0;
        };
        const damageEnemy = (enemy, baseSpell = spell, bonus = 0) => {
          let dmg = this.druidScaledValue?.(baseSpell) || Number(baseSpell.power || 0);
          if (enemy?.buffs?.some?.(buff => buff && buff.remaining > 0 && (buff.tags?.includes?.('root') || buff.tags?.includes?.('slow')))) dmg = Math.floor(dmg * (1 + Number(baseSpell.rootDamageBonus || 0)));
          dmg = Math.floor(dmg * (1 + bonus));
          const dealt = dmg > 0 ? this.damageEntity?.(enemy, dmg, p, color, { damageType: baseSpell.damageType || 'nature', spellName: spell.name }) : 0;
          // V0.20.29: Druid bespoke motif - lunar (moon glow) for moon/lunar spells, nature (leaves) otherwise.
          if (dmg > 0) this.spawnCasterMotifEffect?.(enemy.x, enemy.y, /lunar|moon/.test(`${id} ${String(baseSpell.damageType || '')} ${(baseSpell.tags || []).join(' ')}`.toLowerCase()) ? 'lunar' : 'nature', { radius: 20 });
          if (Number(baseSpell.tickDamage || 0) > 0) {
            const tick = Math.max(1, Math.floor(Number(baseSpell.tickDamage || 0) + Math.max(0, (p.level || 1) - 1) * Number(baseSpell.tickDamageScale || 0)));
            this.applyStatusEffect?.(enemy, this.decorateStatusEffectFromSpell(spell, { id, name: spell.name, type: 'dot', duration: baseSpell.tickDuration || baseSpell.duration || 10, tickRate: baseSpell.tickRate || 2, periodicDamage: tick, damageType: baseSpell.damageType || 'nature', color, hostile: true, tags: baseSpell.tags || ['druid','dot'] }), p);
          }
          return dealt || dmg;
        };
        if (spell.kind === 'heal') {
          const ally = spell.smartHeal ? (this.lowestAlly?.() || allyTarget()) : allyTarget();
          if (Number(spell.periodicHealing || 0) > 0) { applyHot(ally); this.log(`${spell.name} takes root on ${ally.name || 'ally'}.`); }
          else { const healed = healAlly(ally); this.log(`${spell.name} restores ${healed} health to ${ally.name || 'ally'}.`); }
          if (Array.isArray(spell.refreshHotIds) && Array.isArray(ally?.buffs)) {
            for (const key of spell.refreshHotIds) for (const buff of ally.buffs) if (buff?.sourceId === p.id && String(buff.id || '').includes(String(key))) buff.remaining = Math.max(buff.remaining || 0, buff.duration || 300);
          }
          if (Number(spell.hotHealingBonus || 0) > 0) this.applyStatusEffect?.(ally, this.decorateStatusEffectFromSpell(spell, { id: `${id}_hot_amp`, name: spell.buffName || spell.name, type: 'buff', duration: spell.duration || 300, color, hostile: false, tags: ['druid','hot_amp'], healingMultiplier: spell.hotHealingBonus, maxStacks: spell.hotBonusTicks || 1, stacks: spell.hotBonusTicks || 1 }), p);
          this.spawnRing?.(ally.x, ally.y, color, 14);
          return;
        }
        if (spell.kind === 'cleanse') {
          const allies = this.druidAlliesForSpell?.(spell) || [allyTarget()];
          let total = 0, removed = 0;
          for (const ally of allies) {
            total += healAlly(ally);
            const gone = this.cleanseStatusEffects?.(ally, { tags: spell.removesStatusTags || ['poison','disease'] }) || [];
            removed += gone.length;
          }
          this.spawnRing?.(p.x, p.y, color, 20);
          this.log(`${spell.name} restores ${total} health and clears ${removed} effects.`);
          return;
        }
        if (spell.kind === 'buff') {
          const ally = spell.selfOnly ? p : allyTarget();
          this.applyStatusEffect?.(ally, this.decorateStatusEffectFromSpell(spell, { id, name: spell.buffName || spell.name, type: 'buff', duration: spell.duration || 300, mods: spell.mods || {}, color, hostile: false, tags: spell.tags || ['druid'], damageTakenMultiplier: spell.damageTakenMultiplier || 0, allyHealingReceivedMultiplier: spell.allyHealingReceivedMultiplier || 0, healingMultiplier: spell.healingMultiplier || 0, maxStacks: spell.charges || 1, stacks: spell.charges || 1 }), p);
          this.spawnRing?.(ally.x, ally.y, color, 16);
          this.log(`${spell.name} blesses ${ally.name || 'ally'}.`);
          return;
        }
        if (spell.kind === 'groupBuff') {
          const allies = this.druidAlliesForSpell?.(spell) || [p];
          for (const ally of allies) this.applyStatusEffect?.(ally, this.decorateStatusEffectFromSpell(spell, { id, name: spell.buffName || spell.name, type: Number(spell.periodicHealing || 0) > 0 ? 'hot' : 'buff', duration: spell.duration || 300, mods: spell.mods || {}, periodicHealing: spell.periodicHealing ? this.druidScaledValue?.(spell, 'periodicHealing', 'periodicHealingScale') : 0, tickRate: spell.tickRate || 5, color, hostile: false, tags: spell.tags || ['druid'], allyHealingReceivedMultiplier: spell.allyHealingReceivedMultiplier || 0, maxStacks: spell.charges || 1, stacks: spell.charges || 1 }), p);
          this.spawnRing?.(p.x, p.y, color, spell.radius || 18);
          this.log(`${spell.name} reaches ${allies.length} allies.`);
          return;
        }
        if (spell.kind === 'aoeHeal') {
          const allies = this.druidAlliesForSpell?.(spell) || [p];
          let total = 0;
          for (const ally of allies) {
            if (Number(spell.periodicHealing || 0) > 0 && !spell.channel && !spell.hybridDamageHeal) applyHot(ally);
            else total += healAlly(ally);
          }
          if (spell.hybridDamageHeal || Number(spell.power || 0) > 0) {
            const center = target && target.x != null ? target : p;
            let hit = 0;
            for (const enemy of (this.queryEnemiesNearPoint?.(center.x, center.y, spell.radius || 4) || this.enemies || [])) {
              if (!enemy?.alive || !this.isHostileTarget?.(enemy) || distFn(enemy, center) > (spell.radius || 4)) continue;
              damageEnemy(enemy);
              if (++hit >= Number(spell.targetCap || 6)) break;
            }
          }
          this.spawnRing?.(p.x, p.y, color, spell.radius || 14);
          this.log(`${spell.name} restores ${total || 'sustained'} health.`);
          return;
        }
        if (spell.kind === 'aoeDebuff' || spell.kind === 'aoe') {
          const center = target && target.x != null ? target : p;
          let count = 0;
          for (const enemy of (this.queryEnemiesNearPoint?.(center.x, center.y, spell.radius || 4) || this.enemies || [])) {
            if (!enemy?.alive || !this.isHostileTarget?.(enemy) || distFn(enemy, center) > (spell.radius || 4)) continue;
            damageEnemy(enemy);
            if ((spell.mods && Object.keys(spell.mods).length) || spell.moveSpeedMultiplier != null) this.applyStatusEffect?.(enemy, this.decorateStatusEffectFromSpell(spell, { id, name: spell.name, type: spell.tags?.includes?.('root') ? 'control' : 'debuff', duration: spell.duration || 5, mods: spell.mods || {}, moveSpeedMultiplier: spell.moveSpeedMultiplier || 0, color, hostile: true, tags: spell.tags || ['druid','control'] }), p);
            if (++count >= Number(spell.targetCap || 6)) break;
          }
          this.spawnRing?.(center.x, center.y, color, spell.radius || 12);
          this.log(`${spell.name} affects ${count} enemies.`);
          return;
        }
        const enemy = hostileTarget(); if (!enemy) return;
        damageEnemy(enemy);
        if ((spell.mods && Object.keys(spell.mods).length) || spell.moveSpeedMultiplier != null) this.applyStatusEffect?.(enemy, this.decorateStatusEffectFromSpell(spell, { id, name: spell.name, type: spell.tags?.includes?.('root') ? 'control' : 'debuff', duration: spell.duration || 5, mods: spell.mods || {}, moveSpeedMultiplier: spell.moveSpeedMultiplier || 0, color, hostile: true, tags: spell.tags || ['druid'] }), p);
        this.spawnBolt?.(p, enemy, color);
        this.log(`${spell.name} strikes ${enemy.name || 'target'}.`);
      };

      Game.prototype.enchanterControlDuration = function(target, baseDuration) {
        const now = this.runtimeNowMs?.() || Date.now();
        const state = target._enchanterControlDR || (target._enchanterControlDR = { count: 0, lastAt: 0, immuneUntil: 0 });
        if (state.immuneUntil > now) return 0;
        if (now - state.lastAt > 30000) state.count = 0;
        state.count += 1;
        state.lastAt = now;
        if (state.count >= 4) { state.immuneUntil = now + 30000; return 0; }
        const scalar = state.count === 1 ? 1 : (state.count === 2 ? 0.5 : 0.25);
        const rewrite = this.player?.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === 'reality_rewrite');
        return Math.max(0.25, Number(baseDuration || 0) * scalar * (rewrite ? 1.25 : 1));
      };

      Game.prototype.applyEnchanterControlLimit = function(target, source, tag, limit) {
        if (!tag || !limit) return;
        const sourceId = source?.id ?? null;
        const active = [];
        for (const enemy of this.enemies || []) {
          for (const buff of enemy?.buffs || []) if (buff && buff.remaining > 0 && buff.sourceId === sourceId && buff.tags?.includes?.(tag)) active.push({ enemy, buff });
        }
        active.sort((a, b) => (a.buff.appliedAt || 0) - (b.buff.appliedAt || 0));
        while (active.length >= limit) {
          const oldest = active.shift();
          if (oldest?.enemy?.buffs) oldest.enemy.buffs = oldest.enemy.buffs.filter(buff => buff !== oldest.buff);
        }
      };

      Game.prototype.resolveEnchanterRevampSpell = function(spell, options = {}) {
        const p = this.player;
        const id = spell.enchanterSpellId || normalizeSpellIconKey(spell);
        const color = spell.color || p.color;
        const target = options.target || this.getTarget?.();
        const allyTarget = () => this.getFriendlySpellTarget?.(spell.range || 7.5) || this.lowestAlly?.() || p;
        const hostileTarget = () => {
          const resolved = this.resolveHostileSpellTarget?.(spell, target, { range: spell.range || 7.5 });
          if (!resolved?.ok) return null;
          p.setFacingFromDelta?.(resolved.target.x - p.x, resolved.target.y - p.y);
          return resolved.target;
        };
        const hitEnemy = (enemy, baseSpell = spell) => {
          let dmg = Math.max(0, Math.floor(Number(baseSpell.power || 0) + Math.max(0, (p.level || 1) - 1) * Number(baseSpell.levelScale || 0)));
          if (enemy?.buffs?.some?.(buff => buff && buff.remaining > 0 && (buff.tags?.includes?.('confusion') || buff.tags?.includes?.('mesmerize')))) dmg = Math.floor(dmg * (1 + Number(baseSpell.controlledDamageBonus || 0)));
          if (dmg > 0) this.damageEntity?.(enemy, dmg, p, color, { damageType: baseSpell.damageType || 'psychic', spellName: spell.name });
          if (dmg > 0) this.spawnCasterMotifEffect?.(enemy.x, enemy.y, 'mind', { radius: 20 }); // V0.20.29: Enchanter psychic pulses
          return dmg;
        };
        const applyControl = (enemy, extra = {}) => {
          const controlTag = spell.controlType || (spell.tags?.includes?.('mesmerize') ? 'mesmerize' : 'control');
          const limit = controlTag === 'charm' ? 1 : (controlTag === 'mesmerize' || controlTag === 'sleep' ? 3 : 0);
          if (limit) this.applyEnchanterControlLimit?.(enemy, p, controlTag === 'sleep' ? 'mesmerize' : controlTag, limit);
          const duration = this.enchanterControlDuration?.(enemy, spell.controlDuration || spell.duration || 6) || 0;
          if (duration <= 0) { this.log(`${enemy.name || 'Target'} resists repeated control.`); return null; }
          const tags = Array.from(new Set([...(spell.tags || ['enchanter','control']), controlTag === 'sleep' ? 'mesmerize' : controlTag]));
          const effect = this.applyStatusEffect?.(enemy, this.decorateStatusEffectFromSpell(spell, { id, name: spell.name, type: (tags.includes('root') || tags.includes('mesmerize') || tags.includes('charm')) ? 'control' : 'debuff', duration, mods: spell.mods || {}, moveSpeedMultiplier: spell.moveSpeedMultiplier || (tags.includes('root') || tags.includes('mesmerize') ? 0 : 0), color, hostile: true, tags, breakOnDamage: Boolean(spell.breakOnDamage), description: spell.description || '' , ...extra }), p);
          if (controlTag === 'charm') { enemy.charmedById = p.id; enemy.charmedUntil = (this.runtimeNowMs?.() || Date.now()) + duration * 1000; enemy.aggro = false; }
          if (effect) this.spawnCasterMotifEffect?.(enemy.x, enemy.y, 'mind', { radius: 22 }); // V0.20.29: Enchanter psychic pulse on control
          return effect;
        };
        if (spell.kind === 'buff') {
          const ally = spell.selfOnly ? p : allyTarget();
          if (id === 'illusory_step') {
            const dist = Number(spell.teleportDistance || 2.5);
            const { x: fx, y: fy } = this.actorFacingVector(p); // V0.19.7: `|| 1` swung this 45deg off when facing N/S
            const nx = p.x + fx * dist, ny = p.y + fy * dist;
            if (!this.isWalkable || this.isWalkable(nx, ny, p)) { p.x = nx; p.y = ny; }
            this.cleanseStatusEffects?.(p, { tags: ['slow','root'] });
          }
          this.applyStatusEffect?.(ally, this.decorateStatusEffectFromSpell(spell, { id, name: spell.buffName || spell.name, type: 'buff', duration: spell.duration || 300, mods: spell.mods || {}, color, hostile: false, tags: spell.tags || ['enchanter','rune'], damageDoneMultiplier: spell.damageDoneMultiplier || 0, healingMultiplier: spell.healingMultiplier || 0, absorbRemaining: Number(spell.absorbFlat || 0), maxStacks: spell.charges || 1, stacks: spell.charges || 1 }), p);
          this.spawnRing?.(ally.x, ally.y, color, 16);
          this.log(`${spell.name} settles over ${ally.name || 'ally'}.`);
          return;
        }
        if (spell.kind === 'groupBuff') {
          const allies = (this.friendlyTargetsForSpell?.(spell.radius || 16) || [p, this.merc, this.pet, ...(this.botPlayers || [])]).filter(a => a && a.alive !== false).slice(0, spell.targetCap || 6);
          for (const ally of allies) this.applyStatusEffect?.(ally, this.decorateStatusEffectFromSpell(spell, { id, name: spell.buffName || spell.name, type: 'buff', duration: spell.duration || 300, mods: spell.mods || {}, color, hostile: false, tags: spell.tags || ['enchanter'], maxStacks: spell.charges || 1, stacks: spell.charges || 1 }), p);
          this.spawnRing?.(p.x, p.y, color, spell.radius || 16);
          this.log(`${spell.name} bends reality around ${allies.length} allies.`);
          return;
        }
        if (spell.kind === 'aoe' || spell.kind === 'aoeDebuff') {
          const center = target && target.x != null ? target : p;
          let count = 0;
          for (const enemy of (this.queryEnemiesNearPoint?.(center.x, center.y, spell.radius || 4) || this.enemies || [])) {
            if (!enemy?.alive || !this.isHostileTarget?.(enemy) || distFn(enemy, center) > (spell.radius || 4)) continue;
            hitEnemy(enemy);
            if (spell.controlType || (spell.mods && Object.keys(spell.mods).length) || spell.moveSpeedMultiplier != null) applyControl(enemy);
            if (++count >= Number(spell.targetCap || 6)) break;
          }
          if (spell.allyEmpower) {
            for (const ally of (this.friendlyTargetsForSpell?.(spell.radius || 10) || [p]).slice(0, 6)) this.applyStatusEffect?.(ally, this.decorateStatusEffectFromSpell(spell, { id: `${id}_empower`, name: 'Glyphstorm Empowerment', type: 'buff', duration: 300, mods: { spellDamage: 2, wisdom: 2 }, color, hostile: false, tags: ['enchanter','rune'], maxStacks: 10, stacks: 10 }), p);
          }
          this.spawnRing?.(center.x, center.y, color, spell.radius || 12);
          this.log(`${spell.name} affects ${count} enemies.`);
          return;
        }
        const enemy = hostileTarget(); if (!enemy) return;
        if (Number(spell.power || 0) > 0) hitEnemy(enemy);
        if (spell.interrupt) enemy.casting = null;
        if (spell.controlType || spell.kind === 'debuff' || (spell.mods && Object.keys(spell.mods).length)) applyControl(enemy);
        else this.spawnBolt?.(p, enemy, color);
        if (spell.threatReduction && enemy.targetId) enemy.targetId = null;
        this.spawnStatusPulse?.(enemy, color, spell.name);
        this.log(`${spell.name} bends ${enemy.name || 'target'}'s mind.`);
      };


      Game.prototype.isPaladinEvilTarget = function(target) {
        return /undead|demon|fallen|skeleton|ghost|spirit|shadow/i.test(`${target?.name || ''} ${target?.family || ''} ${target?.type || ''} ${target?.tags || ''}`);
      };

      Game.prototype.paladinThreatMultiplier = function() {
        const p = this.player;
        let mult = 1;
        for (const effect of p?.buffs || []) {
          if (!effect || effect.remaining <= 0) continue;
          if (Number(effect.threatGenerationMultiplier || 0) > 0) mult *= Number(effect.threatGenerationMultiplier);
        }
        return mult;
      };

      Game.prototype.applyPaladinThreat = function(enemy, baseDamage = 0, spell = {}, options = {}) {
        if (!enemy || !this.player || !this.addThreat) return;
        const baseMult = Number(spell.threatMultiplier || 1) * (this.paladinThreatMultiplier?.() || 1);
        const flat = Number(spell.flatThreat || 0) + (options.evil ? Number(spell.undeadDemonFlatThreat || 0) : 0);
        const extra = Math.max(0, Math.floor(Number(baseDamage || 0) * Math.max(0, baseMult - 1) + flat));
        if (extra > 0) this.addThreat(enemy, this.player, extra, { reason: `${spell.name || 'paladin'}-bonus-threat` });
        const leadPct = Number(spell.threatLeadPct || 0);
        if (leadPct > 0 && this.highestThreatValue) {
          const currentHigh = this.highestThreatValue(enemy) || 0;
          const desired = currentHigh * leadPct;
          const table = enemy.threatTable || enemy.threat || null;
          if (table && this.player.id != null) {
            const key = String(this.player.id);
            const entry = table instanceof Map ? (table.get(key) || { threat: 0 }) : (table[key] || { threat: 0 });
            if (entry.threat < desired) {
              const add = Math.floor(desired - entry.threat);
              if (add > 0) this.addThreat(enemy, this.player, add, { reason: `${spell.name || 'paladin'}-threat-lead` });
            }
          }
        }
      };

      Game.prototype.resolvePaladinRevampSpell = function(spell, options = {}) {
        const p = this.player;
        if (!p) return;
        const id = spell.paladinSpellId || normalizeSpellIconKey(spell);
        const color = spell.color || '#fff2a8';
        const selected = options.target || this.findSpellActorById?.(options.targetId) || this.getTarget?.();
        const hostile = (range = spell.range || 2) => {
          const resolved = this.resolveHostileSpellTarget?.(spell, selected, { range });
          if (!resolved?.ok) return null;
          const t = resolved.target;
          p.setFacingFromDelta?.(t.x - p.x, t.y - p.y);
          return t;
        };
        const allyTarget = (range = spell.range || 7) => this.getFriendlySpellTarget?.(range) || (selected && this.isFriendlyTarget?.(selected) ? selected : null) || p;
        const enemiesIn = (cx, cy, radius) => (this.enemies || []).filter(enemy => enemy && enemy.alive && this.isHostileTarget?.(enemy) && distFn(enemy, { x: cx, y: cy }) <= radius);
        const holyWeaponDamage = (base = spell.power || spell.flatDamage || 1) => {
          const atk = Math.max(1, Number(p.getStat?.('attack') ?? p.attack ?? 8));
          return Math.max(1, Math.floor(Number(base || 0) + atk * Number(spell.weaponDamageMultiplier || 0)));
        };
        const hit = (target, amount, extra = {}) => {
          if (!target) return 0;
          const evil = this.isPaladinEvilTarget?.(target);
          let dmg = Math.max(0, Math.floor(Number(amount || 0)));
          if (evil) dmg = Math.floor(dmg * (1 + Number(spell.undeadDemonBonus || 0))) + Number(spell.undeadDemonBonusFlat || 0);
          if (extra.judged && target.buffs?.some?.(b => b && b.remaining > 0 && b.id === 'paladin_judged')) dmg = Math.floor(dmg * (1 + Number(spell.judgedDamageBonus || 0)));
          const dealt = this.damageEntity?.(target, dmg, p, color, { damageType: spell.damageType || 'holy', spellName: spell.name, canCrit: true }) || dmg;
          this.applyPaladinThreat?.(target, dealt, spell, { evil });
          this.spawnBolt?.(p, target, color);
          return dealt;
        };
        const applyBuff = (target, data = {}) => {
          const duration = Number(data.duration ?? spell.duration ?? 300);
          const stacks = Math.max(1, Number(data.stacks ?? spell.charges ?? 1));
          return this.applyStatusEffect?.(target, this.decorateStatusEffectFromSpell(spell, {
            id: data.id || `paladin_${id}`,
            name: data.name || spell.buffName || spell.name,
            type: 'buff', duration, color, hostile: false,
            mods: data.mods || spell.mods || {},
            tags: data.tags || spell.tags || ['holy','paladin'],
            stacks, maxStacks: Math.max(stacks, Number(data.maxStacks || stacks)),
            damageTakenMultiplier: data.damageTakenMultiplier ?? spell.damageTakenMultiplier ?? 0,
            magicDamageTakenMultiplier: data.magicDamageTakenMultiplier ?? spell.magicDamageTakenMultiplier ?? 0,
            threatGenerationMultiplier: data.threatGenerationMultiplier ?? spell.threatGenerationMultiplier ?? 0,
            damageDoneMultiplier: data.damageDoneMultiplier ?? spell.damageDoneMultiplier ?? 0,
            moveSpeedMultiplier: data.moveSpeedMultiplier ?? spell.moveSpeedMultiplier ?? 0,
            healingReceivedMultiplier: data.healingReceivedMultiplier ?? spell.healingReceivedMultiplier ?? 0,
            absorbRemaining: Number(data.absorbRemaining ?? spell.absorbFlat ?? 0) + Math.floor((target.maxHp || 0) * Number(data.absorbMaxHpPct ?? spell.absorbMaxHpPct ?? 0)),
            lethalSave: Boolean(data.lethalSave ?? spell.lethalSave),
            consumeOnHit: Boolean(data.consumeOnHit ?? (Number(spell.charges || 0) > 0 && (spell.damageTakenMultiplier || spell.magicDamageTakenMultiplier))),
            damageRedirectPct: Number(data.damageRedirectPct ?? spell.damageRedirectPct ?? 0),
            redirectActorId: data.redirectActorId ?? null,
            flatThreatPerRedirect: Number(data.flatThreatPerRedirect ?? spell.flatThreatPerRedirect ?? 0),
            reflectPreventedPct: Number(data.reflectPreventedPct ?? spell.reflectPreventedPct ?? 0),
            reflectCap: Number(data.reflectCap ?? spell.reflectCap ?? 0),
            description: spell.description || ''
          }), p);
        };

        if (id === 'radiant_strike') { const t = hostile(1.9); if (!t) return; hit(t, holyWeaponDamage(spell.flatDamage || spell.power || 14)); this.log(`Radiant Strike marks ${t.name || 'target'} with holy threat.`); return; }
        if (id === 'shield_of_faith') { applyBuff(p, { id: 'paladin_shield_of_faith', stacks: 5, damageTakenMultiplier: 0.85, tags: ['holy','shield','ward','paladin'], consumeOnHit: true }); this.applyPaladinThreat?.(this.getTarget?.(), 0, spell); this.spawnRing?.(p.x, p.y, color, 14); this.log('Shield of Faith raised.'); return; }
        if (id === 'divine_challenge') { const t = hostile(spell.range || 6.25); if (!t) return; this.tauntEnemy?.(t, p, Number(spell.tauntDuration || 6), Number(spell.flatThreat || 60)); this.applyPaladinThreat?.(t, 0, spell, { evil: this.isPaladinEvilTarget?.(t) }); this.spawnStatusPulse?.(t, color, 'Challenged'); this.log(`You challenge ${t.name || 'target'}.`); return; }
        if (id === 'blessing_of_resolve') { const ally = allyTarget(spell.range || 7.5); applyBuff(ally, { id: 'paladin_blessing_of_resolve', duration: 3600, stacks: 1, tags: ['holy','blessing','paladin'] }); this.spawnRing?.(ally.x, ally.y, color, 12); this.log(`Blessing of Resolve protects ${ally.name || 'ally'}.`); return; }
        if (id === 'judgment') { const t = hostile(spell.range || 6.25); if (!t) return; const dealt = hit(t, this.scaledSpellValue?.(spell) || spell.power || 32); this.applyStatusEffect?.(t, this.decorateStatusEffectFromSpell(spell, { id: 'paladin_judged', name: 'Judged', type: 'debuff', duration: 15, color, hostile: true, tags: ['holy','judged'], paladinThreatTakenMultiplier: 1.15, description: 'Paladin threat against this target is increased.' }), p); this.log(`Judgment hits ${t.name || 'target'} for ${dealt}.`); return; }
        if (id === 'consecrated_ground') { let count = 0; for (const enemy of enemiesIn(p.x, p.y, spell.radius || 4).slice(0, spell.targetCap || 6)) { this.applyStatusEffect?.(enemy, this.decorateStatusEffectFromSpell(spell, { id: 'paladin_consecrated_ground', name: 'Consecrated Ground', type: 'dot', duration: 10, tickRate: 1, periodicDamage: spell.tickDamage || 9, damageType: 'holy', color, hostile: true, tags: ['holy','consecration'], description: spell.description }), p); this.applyPaladinThreat?.(enemy, (spell.tickDamage || 9) * 10, spell, { evil: this.isPaladinEvilTarget?.(enemy) }); count++; } this.spawnRing?.(p.x, p.y, color, 22); this.log(`Consecrated Ground burns beneath ${count} enemies.`); return; }
        if (id === 'guardian_aura') { const allies = (this.friendlyTargetsForSpell?.(spell.radius || 4.5) || [p]).slice(0, spell.targetCap || 6); for (const ally of allies) applyBuff(ally, { id: 'paladin_guardian_aura', duration: 1800, stacks: 1, damageTakenMultiplier: ally === p ? 0.97 : 0.95, tags: ['holy','aura','paladin'] }); this.spawnRing?.(p.x, p.y, color, 20); this.log(`Guardian Aura shields ${allies.length} allies.`); return; }
        if (id === 'radiant_bulwark') { applyBuff(p, { id: 'paladin_radiant_bulwark', absorbRemaining: 90 + Math.floor((p.maxHp || 0) * 0.18), stacks: 1, tags: ['holy','shield','ward','paladin'] }); this.applyPaladinThreat?.(this.getTarget?.(), 0, spell); this.spawnRing?.(p.x, p.y, color, 16); this.log('Radiant Bulwark forms.'); return; }
        if (id === 'cleanse_corruption') { const ally = allyTarget(spell.range || 6.25); const removed = this.cleanseStatusEffects?.(ally, { tags: spell.removesStatusTags || ['poison','curse','disease','shadow'] }) || []; if (!removed.length) { const refund = Math.floor(Number(spell.cost || 0) * Number(spell.failureRefundPct || 0)); if (refund > 0) this.restoreMana?.(p, refund); this.log(`${ally.name || 'Target'} has no removable corruption.`); } else { this.spawnRing?.(ally.x, ally.y, color, 12); this.log(`Cleanse Corruption removes ${removed.length} effect${removed.length === 1 ? '' : 's'}.`); } return; }
        if (id === 'holy_rebuke') { const t = hostile(spell.range || 2); if (!t) return; if (t.casting) t.casting = null; const dealt = hit(t, this.scaledSpellValue?.(spell) || spell.power || 28); this.applyStatusEffect?.(t, this.decorateStatusEffectFromSpell(spell, { id: 'paladin_holy_rebuke_lockout', name: 'Holy Rebuke Lockout', type: 'debuff', duration: 3, color, hostile: true, tags: ['holy','interrupt'], description: 'Interrupted and briefly locked out.' }), p); this.log(`Holy Rebuke interrupts ${t.name || 'target'} for ${dealt}.`); return; }
        if (id === 'oathbound_stand') { applyBuff(p, { id: 'paladin_oathbound_stand', duration: 3600, threatGenerationMultiplier: 1.25, damageTakenMultiplier: 0.94, damageDoneMultiplier: 0.92, moveSpeedMultiplier: 0.95, tags: ['holy','stance','paladin'] }); this.spawnRing?.(p.x, p.y, color, 16); this.log('Oathbound Stand active.'); return; }
        if (id === 'light_within') { const amount = Math.max(Number(spell.heal || 90), Math.floor((p.maxHp || 1) * Number(spell.healMaxHpPct || 0.24))); const healed = this.healEntity?.(p, amount, true, p, { spellName: spell.name }); this.log(`Light Within restores ${healed} health.`); return; }
        if (id === 'hammer_of_reckoning') { let count = 0; for (const enemy of enemiesIn(p.x, p.y, spell.radius || 3).slice(0, spell.targetCap || 5)) { const dealt = hit(enemy, holyWeaponDamage(spell.power || 65)); if (!/boss/i.test(enemy.rank || enemy.type || '')) this.applyStatusEffect?.(enemy, this.decorateStatusEffectFromSpell(spell, { id: 'paladin_hammer_stun', name: 'Hammer Stagger', type: 'control', duration: /elite/i.test(enemy.rank || '') ? 0.5 : 2, color, hostile: true, tags: ['stun','holy'], description: 'Briefly stunned by Hammer of Reckoning.' }), p); count++; } this.spawnRing?.(p.x, p.y, color, 18); this.log(`Hammer of Reckoning strikes ${count} enemies.`); return; }
        if (id === 'blessed_intercept') { const ally = allyTarget(spell.range || 6.25); if (ally !== p) { p.x = ally.x + 0.45; p.y = ally.y + 0.25; } applyBuff(ally, { id: 'paladin_blessed_guard', name: 'Blessed Guard', duration: 300, stacks: 6, damageRedirectPct: 0.35, redirectActorId: p.id, flatThreatPerRedirect: 60, tags: ['holy','guard','paladin'] }); this.spawnRing?.(ally.x, ally.y, color, 14); this.log(`Blessed Intercept guards ${ally.name || 'ally'}.`); return; }
        if (id === 'sunlit_aegis') { applyBuff(p, { id: 'paladin_sunlit_aegis', duration: 300, stacks: 5, magicDamageTakenMultiplier: 0.75, reflectPreventedPct: 0.10, reflectCap: 35, tags: ['holy','aegis','paladin'], consumeOnHit: true }); this.spawnRing?.(p.x, p.y, color, 18); this.log('Sunlit Aegis shines.'); return; }
        if (id === 'turn_the_fallen') { let count = 0; for (const enemy of enemiesIn(p.x, p.y, spell.radius || 3).slice(0, spell.targetCap || 6)) { if (!this.isPaladinEvilTarget?.(enemy)) continue; this.applyStatusEffect?.(enemy, this.decorateStatusEffectFromSpell(spell, { id: 'paladin_turn_the_fallen', name: 'Turned Fallen', type: 'control', duration: 8, color, hostile: true, tags: ['fear','holy','undead'], damageTakenMultiplier: 0.85, description: 'Undead or demonic enemy is turned or weakened.' }), p); this.applyPaladinThreat?.(enemy, 0, spell, { evil: true }); count++; } for (const ally of (this.friendlyTargetsForSpell?.(spell.radius || 3) || [p]).slice(0, 6)) applyBuff(ally, { id: 'paladin_ward_against_the_fallen', name: 'Ward Against the Fallen', duration: 300, stacks: 1, damageTakenMultiplier: 0.90, tags: ['holy','undead_ward','paladin'] }); this.spawnRing?.(p.x, p.y, color, 18); this.log(`Turn the Fallen affects ${count} undead or demonic enemies.`); return; }
        if (id === 'divine_verdict') { const t = hostile(1.9); if (!t) return; const dealt = hit(t, holyWeaponDamage(spell.power || 115), { judged: true }); this.log(`Divine Verdict lands for ${dealt}.`); return; }
        if (id === 'sanctuary_vow') { const allies = (this.friendlyTargetsForSpell?.(spell.radius || 5) || [p]).slice(0, spell.targetCap || 6); for (const ally of allies) applyBuff(ally, { id: 'paladin_sanctuary_vow', duration: 300, stacks: 10, damageTakenMultiplier: 0.88, tags: ['holy','sanctuary','paladin'], consumeOnHit: true }); this.spawnRing?.(p.x, p.y, color, 24); this.log(`Sanctuary Vow protects ${allies.length} allies.`); return; }
        if (id === 'unbroken_faith') { applyBuff(p, { id: 'paladin_unbroken_faith', duration: 300, lethalSave: true, absorbRemaining: Math.floor((p.maxHp || 1) * 0.18), tags: ['holy','cheat_death','paladin'] }); this.spawnRing?.(p.x, p.y, color, 18); this.log('Unbroken Faith will prevent lethal harm once.'); return; }
        if (id === 'avatar_of_the_oath') { applyBuff(p, { id: 'paladin_avatar_of_the_oath', duration: 300, threatGenerationMultiplier: 1.75, damageTakenMultiplier: 0.82, healingReceivedMultiplier: 1.20, tags: ['holy','avatar','paladin'] }); this.spawnRing?.(p.x, p.y, color, 26); this.log('Avatar of the Oath manifests.'); return; }

        const fallback = hostile(spell.range || 7); if (fallback) hit(fallback, this.scaledSpellValue?.(spell) || spell.power || 1);
      };

      Game.prototype.resolveClericRevampSpell = function(spell, options = {}) {
        const p = this.player;
        const id = spell.clericSpellId || normalizeSpellIconKey(spell);
        const color = spell.color || p.color;
        const target = options.target || this.getTarget?.();
        const allyTarget = () => this.getFriendlySpellTarget?.(spell.range || 7.5) || this.lowestAlly?.() || p;
        const hostileTarget = () => {
          const resolved = this.resolveHostileSpellTarget?.(spell, target, { range: spell.range || 7.5 });
          return resolved?.ok ? resolved.target : null;
        };
        if (spell.kind === 'heal') {
          const ally = allyTarget();
          if (Number(spell.periodicHealing || 0) > 0) {
            const tick = Math.floor(Number(spell.periodicHealing || 0) + Math.max(0, p.level - 1) * Number(spell.periodicHealingScale || 0));
            this.applyStatusEffect?.(ally, this.decorateStatusEffectFromSpell(spell, { id, name: spell.buffName || spell.name, type: 'hot', duration: spell.duration || 300, periodicHealing: tick, tickRate: spell.tickRate || 3, color, hostile: false, tags: spell.tags || ['hot'], healingCapPct: spell.healingCapPct || 0 }), p);
            this.log(`${spell.name} renews ${ally.name || 'ally'}.`);
          } else {
            let amount = this.scaledSpellValue?.(spell, 'heal', 'healScale') || Number(spell.heal || 0);
            if (Number(spell.woundedThresholdPct || 0) > 0 && (ally.hp || 0) / Math.max(1, ally.maxHp || 1) <= spell.woundedThresholdPct) amount = Math.floor(amount * (1 + Number(spell.woundedHealBonus || 0)));
            const healed = this.healEntity?.(ally, amount, true, p, { canCrit: true, spellName: spell.name });
            this.log(`${spell.name} restores ${healed} health to ${ally.name || 'ally'}.`);
          }
          this.spawnClericSpellEffect?.(spell, p, ally);
          return;
        }
        if (spell.kind === 'cleanse') {
          const ally = allyTarget();
          const count = Math.max(1, Number(spell.cleanseCount || 1));
          const removed = [];
          for (let i = 0; i < count; i++) {
            const next = this.cleanseStatusEffects?.(ally, { tags: spell.removesStatusTags || ['poison'] }) || [];
            if (!next.length) break;
            removed.push(...next);
          }
          if (!removed.length) {
            const refund = Math.floor(Number(spell.cost || 0) * Number(spell.failureRefundPct || 0));
            if (refund > 0) this.restoreMana?.(p, refund);
            this.log(`${ally.name || 'Target'} has no removable effect.`);
            return;
          }
          if (spell.resistanceBuff) this.applyStatusEffect?.(ally, this.decorateStatusEffectFromSpell(spell, { id: `${id}_resistance`, name: 'Purified Soul', type: 'buff', duration: spell.duration || 300, mods: { resist: 6 }, color, hostile: false, tags: ['cleanse','resist'] }), p);
          this.spawnClericSpellEffect?.(spell, p, ally);
          this.log(`${spell.name} removes ${removed.length} harmful effect${removed.length === 1 ? '' : 's'} from ${ally.name || 'ally'}.`);
          return;
        }
        if (spell.kind === 'buff') {
          const ally = spell.selfOnly ? p : allyTarget();
          this.applyStatusEffect?.(ally, this.decorateStatusEffectFromSpell(spell, { id, name: spell.buffName || spell.name, type: 'buff', duration: spell.duration || 300, mods: spell.mods || {}, color, hostile: false, tags: spell.tags || ['holy'], damageTakenMultiplier: spell.damageTakenMultiplier || 0, allyHealingReceivedMultiplier: spell.allyHealingReceivedMultiplier || 0, healingMultiplier: spell.healingMultiplier || 0, holyDamageMultiplier: spell.holyDamageMultiplier || 0, lethalSave: Boolean(spell.lethalSave), absorbRemaining: Number(spell.absorbFlat || 0) + Math.floor((ally.maxHp || 0) * Number(spell.absorbMaxHpPct || 0)), maxStacks: spell.charges || 1, stacks: spell.charges || 1 }), p);
          this.spawnClericSpellEffect?.(spell, p, ally);
          this.log(`${spell.name} protects ${ally.name || 'ally'}.`);
          return;
        }
        if (spell.kind === 'groupBuff') {
          const allies = (this.friendlyTargetsForSpell?.(spell.radius || 12) || [p, this.merc, this.pet, ...(this.botPlayers || [])]).filter(a => a && a.alive !== false).slice(0, spell.targetCap || 6);
          for (const ally of allies) this.applyStatusEffect?.(ally, this.decorateStatusEffectFromSpell(spell, { id, name: spell.buffName || spell.name, type: 'buff', duration: spell.duration || 300, mods: spell.mods || {}, color, hostile: false, tags: spell.tags || ['holy'], damageTakenMultiplier: spell.damageTakenMultiplier || 0, allyHealingReceivedMultiplier: spell.allyHealingReceivedMultiplier || 0, absorbRemaining: Number(spell.absorbFlat || 0) + Math.floor((ally.maxHp || 0) * Number(spell.absorbMaxHpPct || 0)) }), p);
          this.spawnClericSpellEffect?.(spell, p, p, { allies: allies.map(a => ({ id: a.id || null, x: a.x, y: a.y })), radius: spell.radius });
          this.log(`${spell.name} shields ${allies.length} allies.`);
          return;
        }
        if (spell.kind === 'aoeHeal') {
          const allies = (this.friendlyTargetsForSpell?.(spell.radius || 12) || [p, this.merc, this.pet, ...(this.botPlayers || [])]).filter(a => a && a.alive !== false).slice(0, spell.targetCap || 6);
          let total = 0;
          for (const ally of allies) {
            let amount = this.scaledSpellValue?.(spell, 'heal', 'healScale') || Number(spell.heal || 0);
            if (Number(spell.woundedThresholdPct || 0) > 0 && (ally.hp || 0) / Math.max(1, ally.maxHp || 1) <= spell.woundedThresholdPct) amount = Math.floor(amount * (1 + Number(spell.woundedHealBonus || 0)));
            total += this.healEntity?.(ally, amount, true, p, { canCrit: true, spellName: spell.name }) || 0;
          }
          this.spawnClericSpellEffect?.(spell, p, p, { allies: allies.map(a => ({ id: a.id || null, x: a.x, y: a.y })), radius: spell.radius });
          this.log(`${spell.name} restores ${total} total health.`);
          return;
        }
        if (spell.kind === 'revive') {
          const ally = this.getReviveTarget?.(p);
          if (!this.reviveFriendlyActor?.(ally, { caster: p, range: spell.range || 7.5, hpPct: spell.reviveHpPct || 0.35, manaPct: spell.reviveManaPct || 0.25, color, label: spell.name })) this.log(`${spell.name} failed: select a reachable dead party member.`);
          else { this.spawnClericSpellEffect?.(spell, p, ally); this.log(`${spell.name} returns ${ally.name || 'an ally'} to life.`); }
          return;
        }
        const t = hostileTarget(); if (!t) return;
        let dmg = this.scaledSpellValue?.(spell);
        const validEvil = /undead|demon|shadow|curse|skeleton|ghost|spirit/i.test(`${t.name || ''} ${t.family || ''} ${t.type || ''} ${t.tags || ''}`);
        if (validEvil) dmg = Math.floor(dmg * (1 + Number(spell.undeadDemonBonus || 0)));
        const dealt = this.damageEntity?.(t, dmg, p, color, { damageType: spell.damageType || 'holy', spellName: spell.name });
        if (Number(spell.healFromDamagePct || 0) > 0) {
          const ally = this.lowestAlly?.() || p;
          if (ally && ally.alive !== false && (ally.hp || 0) < (ally.maxHp || 0)) this.healEntity?.(ally, Math.floor((dealt || dmg) * spell.healFromDamagePct), true, p, { spellName: spell.name });
        }
        if ((spell.mods && Object.keys(spell.mods).length) || spell.kind === 'debuff') this.applyStatusEffect?.(t, this.decorateStatusEffectFromSpell(spell, { id, name: spell.name, type: 'debuff', duration: spell.duration || 8, mods: spell.mods || {}, color, hostile: true, tags: spell.tags || ['holy'] }), p);
        this.spawnClericSpellEffect?.(spell, p, t);
        this.log(`${spell.name} strikes ${t.name || 'target'}.`);
      };

      // V0.17.71 BUG 1: drag-to-assign hotbar. The compiled class book has 20
      // spells but only ~9 were ever castable (9 DOM slots / 9 keys). Two bars
      // of 9 assignable slots (18 total; keys 2-0 and Shift+2-0) plus a spellbook
      // window (all 20, click-to-cast + drag source) make every ability reachable.
      // A slot stores a stable spell id; casting resolves id -> current book
      // index so talent re-patches / content order never desync slot bindings.
      Game.prototype.HOTBAR_SLOT_COUNT = 18;

      Game.prototype.hotbarSpellKey = function(spell) { return spell?.id || spell?.name || null; };

      Game.prototype.ensureHotbarAssignments = function() {
        const p = this.player; if (!p) return null;
        const count = this.HOTBAR_SLOT_COUNT;
        if (!Array.isArray(p.hotbar) || p.hotbar.length !== count) {
          const spells = this.getClassSpells(p.className) || [];
          const next = new Array(count).fill(null);
          for (let i = 0; i < count; i++) next[i] = this.hotbarSpellKey(spells[i]) || null;
          p.hotbar = next;
        }
        return p.hotbar;
      };

      Game.prototype.hotbarSpellIndexByKey = function(key) {
        if (!key) return -1;
        const spells = this.getClassSpells(this.player?.className) || [];
        for (let i = 0; i < spells.length; i++) if (this.hotbarSpellKey(spells[i]) === key) return i;
        return -1;
      };
      Game.prototype.hotbarSlotSpellIndex = function(slotIndex) {
        const hb = this.ensureHotbarAssignments(); if (!hb) return -1;
        return this.hotbarSpellIndexByKey(hb[slotIndex]);
      };
      Game.prototype.hotbarSlotSpell = function(slotIndex) {
        const idx = this.hotbarSlotSpellIndex(slotIndex);
        if (idx < 0) return null;
        return (this.getClassSpells(this.player?.className) || [])[idx] || null;
      };
      Game.prototype.useHotbarSlot = function(slotIndex) {
        const idx = this.hotbarSlotSpellIndex(slotIndex);
        if (idx < 0) return false;
        return this.useClassSpell(idx);
      };
      Game.prototype.assignHotbarSlot = function(slotIndex, spellKey) {
        const hb = this.ensureHotbarAssignments(); if (!hb) return false;
        slotIndex = Math.floor(Number(slotIndex));
        if (!(slotIndex >= 0 && slotIndex < this.HOTBAR_SLOT_COUNT)) return false;
        hb[slotIndex] = spellKey || null;
        this.updateSpellHotbar?.();
        this.renderHotbarCombatState?.();
        this.renderSpellbookWindow?.();
        return true;
      };
      Game.prototype.swapHotbarSlots = function(a, b) {
        const hb = this.ensureHotbarAssignments(); if (!hb) return false;
        a = Math.floor(Number(a)); b = Math.floor(Number(b));
        const n = this.HOTBAR_SLOT_COUNT;
        if (!(a >= 0 && a < n && b >= 0 && b < n)) return false;
        const t = hb[a]; hb[a] = hb[b]; hb[b] = t;
        this.updateSpellHotbar?.();
        this.renderHotbarCombatState?.();
        this.renderSpellbookWindow?.();
        return true;
      };
      Game.prototype.clearHotbarSlot = function(slotIndex) { return this.assignHotbarSlot(slotIndex, null); };
      Game.prototype.normalizeHotbar = function() {
        const p = this.player; if (!p) return;
        if (!Array.isArray(p.hotbar)) { this.ensureHotbarAssignments(); return; }
        const spells = this.getClassSpells(p.className) || [];
        const valid = new Set(spells.map(s => this.hotbarSpellKey(s)).filter(Boolean));
        const count = this.HOTBAR_SLOT_COUNT;
        const next = new Array(count).fill(null);
        for (let i = 0; i < count; i++) { const k = p.hotbar[i]; next[i] = (k && valid.has(k)) ? k : null; }
        p.hotbar = next;
      };

      Game.prototype.updateSpellHotbar = function() {
        const runtimeUi = getUi();
        const spellSlots = runtimeUi.spellSlots || [];
        this.ensureHotbarAssignments();
        this.bindActionBarInput?.();
        for (let i = 0; i < spellSlots.length; i++) {
          const spell = this.hotbarSlotSpell(i);
          const labelNode = spellSlots[i];
          if (!labelNode) continue;
          const actionSlot = labelNode.closest?.('.actionSlot');
          const iconNode = this.ensureSpellActionSlotLayout?.(actionSlot, labelNode);
          if (actionSlot) {
            actionSlot.dataset.actionSlot = 'spell';
            actionSlot.dataset.hotbarSlot = String(i);
            actionSlot.dataset.spellIndex = String(i);
            actionSlot.tabIndex = 0;
            actionSlot.setAttribute('role', 'button');
            actionSlot.setAttribute('aria-label', spell ? `Cast ${spell.name}` : `Empty ability slot ${i + 1}`);
            actionSlot.classList.toggle('emptySpellSlot', !spell);
          }
          labelNode.textContent = spell?.name || 'Empty';
          labelNode.title = this.spellTooltipText?.(spell) || '';
          if (iconNode) iconNode.innerHTML = this.spellIconHtml?.(spell || { name: 'Empty Slot', kind: 'empty', color: '#57625d' }, 'hotbarSpellIcon') || '';
          if (actionSlot) actionSlot.title = this.spellTooltipText?.(spell) || 'No spell assigned to this class slot.';
        }
        const autoSlot = document.querySelector?.('.autoAttackSlot');
        if (autoSlot) {
          autoSlot.dataset.actionSlot = 'autoAttack';
          autoSlot.tabIndex = 0;
          autoSlot.setAttribute('role', 'button');
          autoSlot.setAttribute('aria-label', 'Toggle auto attack');
        }
      };

      Game.prototype.bindActionBarInput = function() {
        const hotbar = document.getElementById('hotbar');
        if (!hotbar || hotbar.dataset.inputBound === '1') return;
        hotbar.dataset.inputBound = '1';
        let lastActionAt = 0;
        const activate = event => {
          const slot = event.target?.closest?.('.actionSlot');
          if (!slot || !hotbar.contains(slot)) return;
          if (!this.started || this.paused) return;
          const now = performance.now();
          if (event.type === 'click' && now - lastActionAt < 260) return;
          lastActionAt = now;
          event.preventDefault?.();
          event.stopPropagation?.();

          const action = slot.dataset.actionSlot;
          if (action === 'autoAttack') {
            this.playerAttack?.();
            return;
          }
          if (action === 'spellbook') {
            this.toggleSpellbookWindow?.();
            return;
          }
          if (action === 'spell') {
            const slotIndex = Math.max(0, Math.floor(Number(slot.dataset.hotbarSlot) || 0));
            this.useHotbarSlot?.(slotIndex);
          }
        };

        hotbar.addEventListener('pointerup', activate, { passive: false });
        hotbar.addEventListener('click', activate, { passive: false });
        hotbar.addEventListener('touchend', activate, { passive: false });
        hotbar.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') activate(event);
        });

        // V0.17.71 BUG 1: drag-to-assign. Drag a spellbook entry (text/spell-key)
        // onto a slot to bind it; drag one slot onto another to swap; right-click
        // a slot to clear it.
        const spellSlotAt = target => target?.closest?.('.actionSlot[data-action-slot="spell"]');
        hotbar.addEventListener('dragstart', event => {
          const slot = spellSlotAt(event.target);
          if (!slot || !event.dataTransfer) return;
          event.dataTransfer.setData('text/hotbar-slot', slot.dataset.hotbarSlot || '');
          event.dataTransfer.effectAllowed = 'move';
        });
        hotbar.addEventListener('dragover', event => {
          if (!spellSlotAt(event.target)) return;
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        });
        hotbar.addEventListener('drop', event => {
          const slot = spellSlotAt(event.target);
          if (!slot || !event.dataTransfer) return;
          event.preventDefault();
          const dest = Math.floor(Number(slot.dataset.hotbarSlot));
          const fromSlot = event.dataTransfer.getData('text/hotbar-slot');
          const spellKey = event.dataTransfer.getData('text/spell-key');
          if (fromSlot !== '' && fromSlot != null) this.swapHotbarSlots(Number(fromSlot), dest);
          else if (spellKey) this.assignHotbarSlot(dest, spellKey);
        });
        hotbar.addEventListener('contextmenu', event => {
          const slot = spellSlotAt(event.target);
          if (!slot) return;
          event.preventDefault();
          this.clearHotbarSlot(Number(slot.dataset.hotbarSlot));
        });
      };

      // V0.17.71 BUG 1: spellbook window - the home of all 20 class abilities.
      // Drag a card onto an action-bar slot to bind it; click a card to cast it
      // (so nothing is ever uncastable, even unassigned). Modelled on the shared
      // .panel.gameWindow pattern for free drag/z-order.
      function spellbookEscape(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
          '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        })[ch]);
      }
      Game.prototype.ensureSpellbookWindow = function() {
        let panel = document.getElementById('spellbookPanel');
        if (panel) return panel;
        if (!document.getElementById('spellbookPanelStyles')) {
          const style = document.createElement('style');
          style.id = 'spellbookPanelStyles';
          style.textContent = `
            #hotbar .abilitySlots.abilitySlots2 { margin-top: 6px; }
            .spellbookSlot { cursor: pointer; }
            #spellbookPanel { width: min(560px, calc(100vw - 26px)); max-height: min(620px, calc(100vh - 120px)); overflow: auto; right: 120px; bottom: 150px; top: auto; }
            #spellbookPanel .sbHint { color: #9c927a; margin: 4px 0 10px; }
            #spellbookPanel .sbGrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
            #spellbookPanel .sbCard { display: flex; gap: 8px; align-items: center; padding: 6px 8px; border: 1px solid #5a533f; border-radius: 8px; background: rgba(255,255,255,0.03); cursor: grab; user-select: none; }
            #spellbookPanel .sbCard:hover { background: rgba(214,179,90,0.14); border-color: #d6b35a; }
            #spellbookPanel .sbCard.sbOnBar { border-color: #8fe47d; }
            #spellbookPanel .sbCard:active { cursor: grabbing; }
            #spellbookPanel .sbIconWrap { width: 34px; height: 34px; flex: 0 0 34px; display: grid; place-items: center; }
            #spellbookPanel .sbIconWrap svg, #spellbookPanel .sbIconWrap img, #spellbookPanel .sbIconWrap canvas { max-width: 100%; max-height: 100%; }
            #spellbookPanel .sbName { font-size: 13px; color: #f7ead1; }
            #spellbookPanel .sbSub { font-size: 11px; color: #b3a988; }
          `;
          document.head.appendChild(style);
        }
        panel = document.createElement('section');
        panel.id = 'spellbookPanel';
        panel.className = 'panel gameWindow';
        panel.style.display = 'none';
        panel.innerHTML = `
          <div class="windowHeader">
            <div>
              <div class="name">Spellbook</div>
              <div class="small" data-sb-sub></div>
            </div>
            <button type="button" data-sb-close>Close</button>
          </div>
          <div class="small sbHint">Drag an ability onto an action-bar slot to bind it &middot; click to cast &middot; right-click a bar slot to clear.</div>
          <div class="sbGrid" data-sb-grid></div>
        `;
        document.body.appendChild(panel);
        panel.querySelector('[data-sb-close]')?.addEventListener('click', () => this.toggleSpellbookWindow(false));
        panel.addEventListener('click', event => {
          const card = event.target.closest?.('[data-sb-key]');
          if (!card) return;
          const idx = this.hotbarSpellIndexByKey(card.dataset.sbKey);
          if (idx >= 0) this.useClassSpell(idx);
        });
        panel.addEventListener('dragstart', event => {
          const card = event.target.closest?.('[data-sb-key]');
          if (!card || !event.dataTransfer) return;
          event.dataTransfer.setData('text/spell-key', card.dataset.sbKey);
          event.dataTransfer.effectAllowed = 'copy';
        });
        return panel;
      };
      Game.prototype.renderSpellbookWindow = function() {
        const panel = document.getElementById('spellbookPanel');
        if (!panel || panel.style.display === 'none' || !this.player) return;
        const spells = this.getClassSpells(this.player.className) || [];
        const assigned = new Set((this.player.hotbar || []).filter(Boolean));
        const sub = panel.querySelector('[data-sb-sub]');
        if (sub) sub.textContent = `${this.player.className} · ${spells.filter(Boolean).length} abilities`;
        const grid = panel.querySelector('[data-sb-grid]');
        if (!grid) return;
        grid.innerHTML = spells.map(sp => {
          if (!sp) return '';
          const key = this.hotbarSpellKey(sp);
          const onBar = assigned.has(key);
          const cost = Math.floor(sp.cost || 0);
          const cd = Number(sp.cooldown || 0);
          const lvl = sp.levelRequirement || 1;
          const icon = this.spellIconHtml?.(sp, 'sbIcon') || '';
          const meta = `Lv ${lvl}${cost > 0 ? ` · ${cost} MP` : ''}${cd > 0 ? ` · ${cd.toFixed(1).replace(/\.0$/, '')}s` : ''}${onBar ? ' · on bar' : ''}`;
          return `<div class="sbCard${onBar ? ' sbOnBar' : ''}" data-sb-key="${spellbookEscape(key)}" draggable="true" title="${spellbookEscape(this.spellTooltipText?.(sp) || sp.name)}">`
            + `<div class="sbIconWrap">${icon}</div>`
            + `<div class="sbMeta"><div class="sbName">${spellbookEscape(sp.name)}</div><div class="sbSub">${spellbookEscape(meta)}</div></div></div>`;
        }).join('');
      };
      Game.prototype.toggleSpellbookWindow = function(force) {
        const panel = this.ensureSpellbookWindow();
        const open = typeof force === 'boolean' ? force : panel.style.display === 'none';
        panel.style.display = open ? 'block' : 'none';
        if (open) { this.ensureHotbarAssignments(); this.renderSpellbookWindow(); }
      };

      Game.prototype.useClassSkill = function() {
        return this.useClassSpell(0);
      };

      Game.prototype.isOffensiveSpellKind = function(kind) {
        return new Set(['melee', 'meleeDebuff', 'dashStrike', 'drain', 'debuff', 'boltDot', 'boltSummon', 'aoe', 'aoeMelee', 'aoeDebuff', 'bolt', 'tempMinions']).has(String(kind || ''));
      };

      Game.prototype.friendlyTargetsForSpell = function(range = 18) {
        const actors = this.friendlyTargetActors?.() || [this.player, this.merc, this.pet].filter(Boolean);
        return actors.filter(actor => actor && actor.alive && (!this.player || distFn(this.player, actor) <= range));
      };


      Game.prototype.findSpellActorById = function(id) {
        if (id == null) return null;
        const key = String(id);
        if (this.player && String(this.player.id) === key) return this.player;
        if (this.merc && String(this.merc.id) === key) return this.merc;
        if (this.pet && String(this.pet.id) === key) return this.pet;
        for (const enemy of this.enemies || []) if (String(enemy?.id) === key) return enemy;
        for (const bot of this.botPlayers || []) if (String(bot?.id) === key) return bot;
        for (const entity of this.entities || []) if (String(entity?.id) === key) return entity;
        if (this.remotePlayers instanceof Map) {
          for (const actor of this.remotePlayers.values()) if (String(actor?.id) === key) return actor;
        }
        return null;
      };

      Game.prototype.getActiveStatusById = function(actor, statusId) {
        const key = String(statusId || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        if (!key || !Array.isArray(actor?.buffs)) return null;
        return actor.buffs.find(effect => effect && effect.remaining > 0 && String(effect.id || '').toLowerCase() === key) || null;
      };

      Game.prototype.removeStatusById = function(actor, statusId) {
        const key = String(statusId || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        if (!key || !Array.isArray(actor?.buffs)) return false;
        const before = actor.buffs.length;
        actor.buffs = actor.buffs.filter(effect => String(effect?.id || '').toLowerCase() !== key);
        return actor.buffs.length !== before;
      };

      Game.prototype.necromancerSpellDamageFlatBonus = function() {
        const p = this.player;
        if (!Array.isArray(p?.buffs)) return 0;
        let bonus = 0;
        for (const effect of p.buffs) {
          if (!effect || effect.remaining <= 0) continue;
          const mods = effect.mods || {};
          if (Number.isFinite(Number(mods.spellDamage))) bonus += Number(mods.spellDamage);
        }
        return bonus;
      };

      Game.prototype.necromancerLichStatus = function() {
        return this.getActiveStatusById?.(this.player, 'necro_lich_veil') || this.getActiveStatusById?.(this.player, 'necro_lich_form') || null;
      };

      Game.prototype.necromancerDamageMultiplier = function(target, options = {}) {
        let multiplier = 1;
        const mark = this.getActiveStatusById?.(target, 'necro_plague_mark');
        if (mark) {
          if (options.dot) multiplier *= 1 + Number(mark.dotAmpPct || 0.16);
          if (options.drain) multiplier *= 1 + Number(mark.drainAmpPct || 0.10);
        }
        const lich = this.necromancerLichStatus?.();
        if (lich && options.damageType === 'shadow' && Number(lich.shadowDamageMultiplier || 0) > 0) multiplier *= Number(lich.shadowDamageMultiplier || 1);
        if (options.skipConsumableNecroBuffs !== true) {
          const pact = this.getActiveStatusById?.(this.player, 'necro_death_pact_empower');
          if (pact && (options.dot || options.drain || ['bone', 'shadow', 'disease', 'necrotic'].includes(String(options.damageType || '')))) multiplier *= Number(pact.necromancySpellDamageMultiplier || 1.22);
          const harvest = this.getActiveStatusById?.(this.player, 'necro_harvested_soul');
          if (harvest && (options.dot || options.drain || options.damageType === 'shadow' || options.damageType === 'disease')) multiplier *= Number(harvest.necromancySpellDamageMultiplier || 1.18);
        }
        const sovereign = this.getActiveStatusById?.(this.pet, 'necro_grave_sovereign');
        if (sovereign && (options.damageType === 'bone' || options.damageType === 'disease' || options.drain || options.dot)) multiplier *= Number(sovereign.necromancySpellDamageMultiplier || 1.18);
        return multiplier;
      };

      Game.prototype.necromancerDrainHealingMultiplier = function() {
        const lich = this.necromancerLichStatus?.();
        const pact = this.getActiveStatusById?.(this.player, 'necro_death_pact_empower');
        const sovereign = this.getActiveStatusById?.(this.pet, 'necro_grave_sovereign');
        let mult = lich ? Number(lich.drainHealingMultiplier || 1.30) : 1;
        if (pact) mult *= Number(pact.drainHealingMultiplier || 1.20);
        if (sovereign) mult *= Number(sovereign.drainHealingMultiplier || 1.20);
        return mult;
      };

      Game.prototype.consumeNecromancerEmpowerments = function(options = {}) {
        let multiplier = 1;
        const p = this.player;
        const pact = options.consumeDeathPact !== false ? this.getActiveStatusById?.(p, 'necro_death_pact_empower') : null;
        if (pact) {
          multiplier *= Number(pact.necromancySpellDamageMultiplier || 1.22);
          const remaining = Math.max(0, Math.floor(Number(pact.stacks ?? pact.charges ?? 1)) - 1);
          pact.stacks = remaining;
          pact.charges = remaining;
          if (remaining <= 0) this.removeStatusById?.(p, 'necro_death_pact_empower');
        }
        const harvestEligible = options.consumeHarvest === true || options.eligibleHarvest === true;
        const harvest = harvestEligible ? this.getActiveStatusById?.(p, 'necro_harvested_soul') : null;
        if (harvest) {
          multiplier *= Number(harvest.necromancySpellDamageMultiplier || 1.18);
          this.removeStatusById?.(p, 'necro_harvested_soul');
        }
        return multiplier;
      };

      Game.prototype.consumeNecromancerDeathPactDotBonus = function() {
        return this.consumeNecromancerEmpowerments?.({ consumeDeathPact: true, consumeHarvest: true }) || 1;
      };

      Game.prototype.getNecromancerHostileTarget = function(spell, options = {}) {
        const p = this.player;
        const candidate = options.target || this.findSpellActorById?.(options.targetId) || this.getTarget?.();
        const resolved = this.resolveHostileSpellTarget?.(spell, candidate, { range: Number(spell.range || 7) });
        if (!resolved?.ok) return null;
        const target = resolved.target;
        p.setFacingFromDelta?.(target.x - p.x, target.y - p.y);
        return target;
      };

      Game.prototype.applyNecromancerDot = function(target, spell, baseTick, duration, damageType, options = {}) {
        if (!target || !target.alive) return null;
        const consumedMultiplier = Number(options.deathPactMultiplier || 0) > 0 ? Number(options.deathPactMultiplier) : (options.consumeDeathPact ? (this.consumeNecromancerEmpowerments?.({ consumeDeathPact: true, consumeHarvest: Boolean(options.drain || options.harvestEligible) }) || 1) : 1);
        const ambientMultiplier = this.necromancerDamageMultiplier?.(target, { dot: true, drain: Boolean(options.drain), damageType, skipConsumableNecroBuffs: options.consumeDeathPact === true }) || 1;
        const conditionalMultiplier = Number(options.multiplier || 1);
        const tickBase = Math.max(1, Math.floor((Number(baseTick || 0) + (options.allowFlatBonus === false ? 0 : (this.necromancerSpellDamageFlatBonus?.() || 0))) * consumedMultiplier * ambientMultiplier * conditionalMultiplier));
        const effect = {
          id: options.id || spell.statusId || spell.necroSpellId || spell.name,
          name: options.name || spell.statusName || spell.name,
          type: 'dot',
          duration: Number(duration || spell.tickDuration || spell.duration || 8),
          tickRate: Number(spell.tickRate || 2),
          periodicDamage: tickBase,
          damageType: damageType || spell.damageType || 'shadow',
          color: spell.color || '#9fff6d',
          hostile: true,
          maxStacks: 1,
          tags: options.tags || spell.tags || ['dot'],
          mods: options.mods || spell.mods || {},
          necromancerDot: true,
          necromancerDrain: Boolean(options.drain),
          drainHealPct: Number(options.drainHealPct || 0),
          sourceClass: 'Necromancer',
          sourceSpellId: spell.necroSpellId || spell.name,
          healingReceivedMultiplier: options.healingReceivedMultiplier ?? spell.healingReceivedMultiplier,
          moveSpeedMultiplier: options.moveSpeedMultiplier ?? spell.moveSpeedMultiplier,
          description: options.description || spell.description || ''
        };
        const applied = this.applyStatusEffect?.(target, this.decorateStatusEffectFromSpell(spell, effect), this.player);
        if (applied) this.spawnStatusPulse?.(target, spell.color || '#9fff6d', applied.name || spell.name);
        return applied;
      };

      Game.prototype.damageNecromancerTarget = function(target, spell, amount, options = {}) {
        if (!target || !target.alive) return 0;
        const flat = options.allowFlatBonus === false ? 0 : (this.necromancerSpellDamageFlatBonus?.() || 0);
        const consumedMultiplier = options.consumeEmpower === true ? (this.consumeNecromancerEmpowerments?.({ consumeDeathPact: options.consumeDeathPact !== false, consumeHarvest: Boolean(options.consumeHarvest) }) || 1) : 1;
        const multiplier = (this.necromancerDamageMultiplier?.(target, { ...options, skipConsumableNecroBuffs: options.consumeEmpower === true }) || 1) * consumedMultiplier;
        const finalAmount = Math.max(0, Math.floor((Number(amount || 0) + flat) * multiplier));
        if (finalAmount <= 0) return 0;
        this.damageEntity?.(target, finalAmount, this.player, spell.color || '#9fff6d', {
          damageType: options.damageType || spell.damageType || 'shadow',
          canCrit: false,
          sourceSpellId: spell.necroSpellId || spell.name
        });
        if (options.drainHealPct > 0) {
          const healed = Math.floor(finalAmount * Number(options.drainHealPct) * (this.necromancerDrainHealingMultiplier?.() || 1));
          if (healed > 0) this.healEntity?.(this.player, healed, true, this.player, { sourceSpellId: spell.necroSpellId || spell.name });
        }
        return finalAmount;
      };

      Game.prototype.summonNecromancerPetFromSpell = function(spell) {
        const p = this.player;
        const PetClass = DR.entities?.Pet || window.Pet;
        if (!PetClass || !p) { this.log('No pet entity available.'); return null; }
        if (this.pet && spell.replacePet !== false) {
          this.pet.alive = false;
          this.pet.dismissed = true;
          this.entities = (this.entities || []).filter(entity => entity !== this.pet);
          this.pet = null;
        }
        const pet = new PetClass(p.x + 0.55, p.y + 0.35, p, {
          name: spell.petName || 'Bone Servant',
          petName: spell.petName || 'Bone Servant',
          petType: spell.petType || 'undead',
          color: spell.petColor || spell.color || '#d8e5b4',
          petColor: spell.petColor || spell.color || '#d8e5b4',
          hp: Number(spell.petHp || 95),
          maxHp: Number(spell.petHp || 95),
          attack: Math.floor((Number(spell.petAttackMin || spell.petAttack || 6) + Number(spell.petAttackMax || spell.petAttack || 9)) / 2),
          attackDamageMin: Number(spell.petAttackMin || spell.petAttack || 6),
          attackDamageMax: Number(spell.petAttackMax || spell.petAttack || 9),
          attackIntervalSeconds: Number(spell.petAttackSpeed || 1.8),
          petDamageType: spell.petDamageType || 'physical',
          mainPetLife: Number(spell.petDuration || 3600),
          defense: Number(spell.petDefense || 0),
          shieldBashDamage: Number(spell.shieldBashDamage || 0),
          shieldBashCooldown: Number(spell.shieldBashCooldown || 10),
          level: p.level || 1,
          zone: this.currentZone || p.zone || 'dark_woods',
          command: 'assist',
          commandState: 'assist'
        });
        this.pet = pet;
        this.entities = Array.isArray(this.entities) ? this.entities : [];
        if (!this.entities.includes(pet)) this.entities.push(pet);
        this.spawnRing?.(p.x, p.y, spell.color || '#d8e5b4', 16);
        this.playSfx?.('pet_summon', { x: p.x, y: p.y, volume: 0.42, rate: 0.82, cooldown: 0.18 });
        this.log(`${pet.name} answers your command.`);
        return pet;
      };

      Game.prototype.resolveNecromancerClassSpell = function(spell, options = {}) {
        const p = this.player;
        if (!p) return;
        const color = spell.color || '#9fff6d';
        const id = String(spell.necroSpellId || spell.name || '').toLowerCase();
        const trigger = target => this.spawnNecromancerSpellEffect?.(spell.name, p, target || null, { spell, color });
        const hostile = () => this.getNecromancerHostileTarget?.(spell, options);
        const enemiesIn = (cx, cy, radius) => (this.enemies || []).filter(enemy => enemy && enemy.alive && this.isHostileTarget?.(enemy) && Math.hypot(enemy.x - cx, enemy.y - cy) <= radius);

        if (['raise_bone_servant', 'summon_skeleton_knight', 'raise_skeleton', 'summon_bone_servant'].includes(id)) {
          trigger({ x: p.x + 0.5, y: p.y + 0.5 });
          this.summonNecromancerPetFromSpell?.(spell);
          return;
        }

        if (id === 'death_pact') {
          if (!this.pet || !this.pet.alive) { this.log('No active pet to sacrifice.'); return; }
          if (distFn(p, this.pet) > Number(spell.range || 7)) { this.log(`${spell.name} is out of range of your pet.`); return; }
          const petHpPct = Number(this.pet.hp || 0) / Math.max(1, Number(this.pet.maxHp || this.pet.hp || 1));
          if (petHpPct < Number(spell.minPetHpPct || 0.30)) { this.log('Death Pact requires your undead minion to be above 30% health.'); return; }
          const sacrifice = Math.max(1, Math.floor(Math.max(1, this.pet.hp || 1) * Number(spell.petSacrificePct || 0.25)));
          this.pet.hp = Math.max(1, Math.floor((this.pet.hp || 1) - sacrifice));
          this.applyStatusEffect?.(p, this.decorateStatusEffectFromSpell(spell, {
            id: 'necro_death_pact_empower', name: 'Death Pact', type: 'buff', duration: Number(spell.duration || 300), stacks: Number(spell.charges || 10), maxStacks: Number(spell.charges || 10),
            necromancySpellDamageMultiplier: 1 + Number(spell.spellDamageBonusPct || 0.22), drainHealingMultiplier: 1 + Number(spell.drainHealingBonusPct || 0.20), color, hostile: false,
            description: spell.description || 'Necromancy spells deal more damage and drains heal for more while charges remain.'
          }), p);
          this.spawnRing?.(p.x, p.y, color, 14);
          this.spawnStatusPulse?.(this.pet, color, 'Sacrificed');
          this.log(`Death Pact sacrifices ${sacrifice} pet health and empowers your necromancy.`);
          return;
        }

        if (id === 'grave_armor' || id === 'bone_armor') {
          this.applyStatusEffect?.(p, this.decorateStatusEffectFromSpell(spell, {
            id: 'necro_bone_armor', name: 'Bone Armor', type: 'buff', duration: Number(spell.duration || 300), stacks: Number(spell.charges || 6), maxStacks: Number(spell.charges || 6), consumeOnHit: true, mods: spell.mods || { resist: 3 },
            physicalDamageTakenMultiplier: Number(spell.physicalDamageTakenMultiplier || 0.86), color, hostile: false,
            description: spell.description
          }), p);
          trigger(p); this.spawnRing?.(p.x, p.y, color, 14); this.log('Bone Armor hardens around you.'); return;
        }

        if (id === 'lich_form' || id === 'lich_veil') {
          this.applyStatusEffect?.(p, this.decorateStatusEffectFromSpell(spell, {
            id: 'necro_lich_veil', name: 'Lich Veil', type: 'buff', duration: Number(spell.duration || 300), stacks: Number(spell.charges || 8), maxStacks: Number(spell.charges || 8), consumeOnHit: true,
            shadowDamageTakenMultiplier: Number(spell.shadowDamageTakenMultiplier || 0.70), drainHealingMultiplier: Number(spell.drainHealingMultiplier || 1.30),
            diseaseResistancePct: Number(spell.diseaseResistancePct || 0.20), holyDamageTakenMultiplier: Number(spell.holyDamageTakenMultiplier || 1.10), color, hostile: false,
            description: spell.description
          }), p);
          trigger(p); this.spawnRing?.(p.x, p.y, color, 20); this.log('Lich Veil wraps you in deathly shadow.'); return;
        }

        if (id === 'corpse_mender') {
          if (!this.pet || !this.pet.alive) { this.log('No active pet to heal.'); return; }
          if (distFn(p, this.pet) > Number(spell.range || 7)) { this.log(`${spell.name} is out of range.`); return; }
          this.applyStatusEffect?.(this.pet, this.decorateStatusEffectFromSpell(spell, {
            id: 'necro_corpse_mender_hot', name: 'Corpse Mender', type: 'hot', duration: Number(spell.petHealDuration || 300),
            tickRate: Number(spell.petHealTickRate || 3), periodicHealing: Number(spell.petHealTick || 12), healingCapPct: Number(spell.healingCapPct || 0.35), color, hostile: false,
            description: 'Repairs undead minion health every 3s until the healing cap is reached.'
          }), p);
          trigger(this.pet); this.spawnRing?.(this.pet.x, this.pet.y, color, 12); this.log('Corpse Mender begins repairing your undead minion.'); return;
        }

        if (id === 'army_of_bones') {
          const target = hostile();
          if (!target) return;
          const PetClass = DR.entities?.Pet || window.Pet;
          if (!PetClass) { this.log('No pet entity available.'); return; }
          const count = Math.max(1, Math.floor(Number(spell.tempMinionCount || 3)));
          for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i / count) + 0.45;
            const minion = new PetClass(p.x + Math.cos(angle) * 0.75, p.y + Math.sin(angle) * 0.75, p, {
              name: `Bone Minion ${i + 1}`, petName: `Bone Minion ${i + 1}`, petType: 'undead_minion', color, petColor: color,
              hp: 70, maxHp: 70, attack: 9, attackDamageMin: Number(spell.petAttackMin || 8), attackDamageMax: Number(spell.petAttackMax || 11),
              attackIntervalSeconds: Number(spell.petAttackSpeed || 1.8), temporaryPet: true, temporaryLife: Number(spell.tempMinionDuration || 300), tempAttackLimit: Number(spell.tempMinionAttackLimit || 6),
              level: p.level || 1, zone: this.currentZone || p.zone || 'dark_woods', command: 'attack', commandState: 'attack'
            });
            minion.forcedTargetId = target.id;
            this.entities = Array.isArray(this.entities) ? this.entities : [];
            this.entities.push(minion);
          }
          trigger(target); this.spawnRing?.(target.x, target.y, color, 18); this.log('Army of Bones claws its way into battle.'); return;
        }

        if (id === 'command_undead') {
          const target = hostile();
          if (!this.pet || !this.pet.alive) { this.log('No active undead to command.'); return; }
          if (target) { this.pet.forcedTargetId = target.id; this.pet.command = 'attack'; this.pet.commandState = 'attack'; this.log(`Your undead attacks ${target.name || 'target'}.`); }
          else { this.pet.command = 'assist'; this.pet.commandState = 'assist'; this.log('Your undead returns to Assist.'); }
          trigger(this.pet); return;
        }

        if (id === 'grave_sovereign') {
          if (!this.pet || !this.pet.alive) { this.log('No active undead to empower.'); return; }
          this.applyStatusEffect?.(this.pet, this.decorateStatusEffectFromSpell(spell, { id: 'necro_grave_sovereign', name: 'Grave Sovereign', type: 'buff', duration: Number(spell.duration || 300), stacks: Number(spell.charges || 24), maxStacks: Number(spell.charges || 24), color, hostile: false, petDamageMultiplier: Number(spell.petDamageMultiplier || 1.35), petAttackSpeedMultiplier: Number(spell.petAttackSpeedMultiplier || 0.80), necromancySpellDamageMultiplier: Number(spell.necromancySpellDamageMultiplier || 1.18), drainHealingMultiplier: Number(spell.drainHealingMultiplier || 1.20), tags: ['necromancer', 'pet', 'bone'], description: spell.description }), p);
          const hpMultiplier = Number(spell.petHpMultiplier || 1.35); if (!this.pet._graveSovereignHpApplied) { this.pet.maxHp = Math.floor((this.pet.maxHp || this.pet.hp || 1) * hpMultiplier); this.pet.hp = Math.min(this.pet.maxHp, Math.floor((this.pet.hp || 1) * hpMultiplier)); this.pet._graveSovereignHpApplied = true; }
          this.pet.name = this.pet.petName = 'Grave Champion';
          this.pet.color = this.pet.petColor = color;
          trigger(this.pet); this.spawnRing?.(this.pet.x, this.pet.y, color, 22); this.log('Your undead rises as a Grave Sovereign.'); return;
        }

        if (id === 'grave_nova') {
          const radius = Number(spell.radius || 4);
          let count = 0;
          const dotMultiplier = this.getActiveStatusById?.(p, 'necro_death_pact_empower') ? this.consumeNecromancerDeathPactDotBonus?.() || 1 : 1;
          for (const enemy of enemiesIn(p.x, p.y, radius)) {
            this.damageNecromancerTarget?.(enemy, spell, Number(spell.power || 36), { damageType: 'shadow', allowFlatBonus: true });
            this.applyNecromancerDot?.(enemy, spell, Number(spell.tickDamage || 9), Number(spell.duration || 8), 'disease', { deathPactMultiplier: dotMultiplier });
            count++;
          }
          trigger(p); this.spawnRing?.(p.x, p.y, color, 24); this.log(`Grave Nova erupts through ${count} enemies.`); return;
        }

        const target = hostile();
        if (!target) return;

        if (id === 'life_tap') {
          const cursedOrDiseased = target.buffs?.some?.(buff => buff && buff.remaining > 0 && (buff.tags?.includes?.('curse') || buff.tags?.includes?.('disease') || buff.tags?.includes?.('rot')));
          const dealt = this.damageNecromancerTarget?.(target, spell, Number(spell.power || 28) * (cursedOrDiseased ? (1 + Number(spell.cursedDiseasedBonus || 0.10)) : 1), { drain: true, damageType: 'shadow', drainHealPct: Number(spell.drainHealPct || 0.35), consumeEmpower: true, consumeHarvest: true });
          trigger(target); this.spawnBolt?.(p, target, color); this.log(`Life Tap drains ${target.name} for ${dealt}.`); return;
        }
        if (id === 'bone_spear' || id === 'bone_splinter') {
          const diseased = target.buffs?.some?.(buff => buff && buff.remaining > 0 && (buff.tags?.includes?.('disease') || String(buff.id || '').includes('grave_rot')));
          const base = Number(spell.power || 17) * (diseased ? 1.10 : 1);
          const dealt = this.damageNecromancerTarget?.(target, spell, base, { damageType: 'bone', consumeEmpower: true, consumeHarvest: false });
          trigger(target); this.spawnBolt?.(p, target, color); this.log(`Bone Splinter hits ${target.name} for ${dealt}.`); return;
        }
        if (id === 'grave_rot') {
          this.damageNecromancerTarget?.(target, spell, Number(spell.power || 8), { damageType: 'disease', consumeEmpower: true, consumeHarvest: false });
          this.applyNecromancerDot?.(target, spell, Number(spell.tickDamage || 10), Number(spell.duration || 12), 'disease', { consumeDeathPact: true, harvestEligible: false });
          trigger(target); this.spawnBolt?.(p, target, color); this.log(`Grave Rot infects ${target.name}.`); return;
        }
        if (id === 'rot_cloud') {
          let count = 0;
          const dotMultiplier = this.getActiveStatusById?.(p, 'necro_death_pact_empower') ? this.consumeNecromancerDeathPactDotBonus?.() || 1 : 1;
          for (const enemy of enemiesIn(target.x, target.y, Number(spell.radius || 8))) {
            const marked = this.getActiveStatusById?.(enemy, 'necro_plague_mark');
            this.applyNecromancerDot?.(enemy, spell, Number(spell.tickDamage || 14), Number(spell.duration || 10), 'disease', { deathPactMultiplier: dotMultiplier, multiplier: marked ? (1 + Number(spell.markBonus || 0.15)) : 1, mods: {}, tags: ['dot', 'disease', 'rot'] });
            count++;
          }
          trigger(target); this.spawnRing?.(target.x, target.y, color, 18); this.log(`Rot Cloud infects ${count} enemies.`); return;
        }
        if (id === 'bone_shackles') {
          this.damageNecromancerTarget?.(target, spell, Number(spell.power || 30), { damageType: 'bone', consumeEmpower: true, consumeHarvest: false });
          this.applyStatusEffect?.(target, this.decorateStatusEffectFromSpell(spell, { id: 'necro_bone_shackles_root', name: 'Bone Shackles', type: 'control', duration: Number(spell.rootDuration || 5), tags: ['root', 'bone'], color, hostile: true, boneDamageTakenMultiplier: Number(spell.boneDamageTakenMultiplier || 1.10), description: 'Rooted by Bone Shackles; bone damage taken increased.' }), p);
          trigger(target); this.spawnBolt?.(p, target, color); this.log(`Bone Shackles binds ${target.name}.`); return;
        }
        if (id === 'siphon_strength') {
          const dealt = this.damageNecromancerTarget?.(target, spell, 18, { drain: true, damageType: 'shadow' });
          this.applyStatusEffect?.(target, this.decorateStatusEffectFromSpell(spell, { id: 'necro_siphon_strength', name: 'Siphon Strength', type: 'debuff', duration: 12, mods: { attack: -5 }, color, hostile: true, description: 'Attack reduced by 5.' }), p);
          this.applyStatusEffect?.(p, this.decorateStatusEffectFromSpell(spell, { id: 'necro_siphoned_strength', name: 'Siphoned Strength', type: 'buff', duration: 12, mods: { spellDamage: 4 }, color, hostile: false, description: '+4 spell damage.' }), p);
          trigger(target); this.spawnBolt?.(p, target, color); this.log(`Siphon Strength drains ${target.name} for ${dealt}.`); return;
        }
        if (id === 'soul_leech') {
          const cursedOrDiseased = target.buffs?.some?.(buff => buff && buff.remaining > 0 && (buff.tags?.includes?.('curse') || buff.tags?.includes?.('disease') || buff.tags?.includes?.('rot') || String(buff.id || '').includes('plague_mark')));
          this.applyNecromancerDot?.(target, spell, Number(spell.tickDamage || 38), Number(spell.duration || 5), 'shadow', { consumeDeathPact: true, drain: true, drainHealPct: Number(spell.drainHealPct || 0.45), harvestEligible: true, multiplier: cursedOrDiseased ? (1 + Number(spell.cursedDiseasedBonus || 0.25)) : 1, tags: ['dot', 'drain', 'shadow'] });
          trigger(target); this.spawnBolt?.(p, target, color); this.log(`Soul Leech drains ${target.name}.`); return;
        }
        if (id === 'fear_the_living') {
          this.applyStatusEffect?.(target, this.decorateStatusEffectFromSpell(spell, { id: 'necro_fear_the_living_fear', name: 'Fear the Living', type: 'control', duration: Number(spell.fearDuration || 8), tags: ['fear'], color, hostile: true, description: 'Feared by necromantic terror.' }), p);
          trigger(target); this.spawnBolt?.(p, target, color); this.log(`${target.name} flees in fear.`); return;
        }
        if (id === 'bone_storm') {
          let count = 0;
          const dotMultiplier = this.getActiveStatusById?.(p, 'necro_death_pact_empower') ? this.consumeNecromancerDeathPactDotBonus?.() || 1 : 1;
          const center = (this.pet && this.pet.alive && distFn(p, this.pet) <= Number(spell.range || 7)) ? this.pet : target;
          for (const enemy of enemiesIn(center.x, center.y, Number(spell.radius || 7))) {
            const shackled = this.getActiveStatusById?.(enemy, 'necro_bone_shackles_root');
            this.applyNecromancerDot?.(enemy, spell, Number(spell.tickDamage || 24), Number(spell.duration || 8), 'bone', { deathPactMultiplier: dotMultiplier, multiplier: shackled ? (1 + Number(spell.boneShackleBonus || 0.10)) : 1, tags: ['dot', 'bone', 'storm'] });
            count++;
          }
          trigger(center); this.spawnRing?.(center.x, center.y, color, 20); this.log(`Bone Storm tears through ${count} enemies.`); return;
        }
        if (id === 'plague_mark') {
          for (const enemy of this.enemies || []) this.removeStatusById?.(enemy, 'necro_plague_mark');
          this.applyStatusEffect?.(target, this.decorateStatusEffectFromSpell(spell, { id: 'necro_plague_mark', name: 'Plague Mark', type: 'debuff', duration: Number(spell.duration || 20), dotAmpPct: Number(spell.dotAmpPct || 0.16), drainAmpPct: Number(spell.drainAmpPct || 0.10), color, hostile: true, maxStacks: 1, tags: ['disease', 'mark'], description: spell.description }), p);
          trigger(target); this.spawnBolt?.(p, target, color); this.log(`Plague Mark brands ${target.name}.`); return;
        }
        if (id === 'withering_curse') {
          this.damageNecromancerTarget?.(target, spell, Number(spell.power || 22), { damageType: 'shadow', consumeEmpower: true, consumeHarvest: false });
          this.applyNecromancerDot?.(target, spell, Number(spell.tickDamage || 16), Number(spell.duration || 12), 'shadow', { consumeDeathPact: true, harvestEligible: true, mods: { attack: -2 }, tags: ['dot', 'curse', 'shadow'] });
          this.applyStatusEffect?.(target, this.decorateStatusEffectFromSpell(spell, { id: 'necro_withering_damage_down', name: 'Withering Curse Weakness', type: 'debuff', duration: Number(spell.debuffDuration || 10), damageDoneMultiplier: Number(spell.enemyDamageMultiplier || 0.92), color, hostile: true, tags: ['curse'], description: 'Damage dealt reduced by Withering Curse.' }), p);
          trigger(target); this.spawnBolt?.(p, target, color); this.log(`Withering Curse grips ${target.name}.`); return;
        }
        if (id === 'soul_harvest') {
          const pct = (target.hp || 0) / Math.max(1, target.maxHp || 1);
          if (pct > Number(spell.requirementHpPct || 0.60) && !this.getActiveStatusById?.(target, 'necro_plague_mark')) { this.log('Soul Harvest requires a weakened or Plague Marked target.'); return; }
          const beforeAlive = target.alive;
          const dealt = this.damageNecromancerTarget?.(target, spell, Number(spell.power || 34), { drain: false, damageType: 'shadow', consumeEmpower: true, consumeHarvest: false });
          this.restoreMana?.(p, Math.floor((p.maxMana || 0) * Number(spell.manaRestorePct || 0.08)));
          this.applyStatusEffect?.(p, this.decorateStatusEffectFromSpell(spell, { id: 'necro_harvested_soul', name: 'Harvested Soul', type: 'buff', duration: Number(spell.duration || 300), stacks: 1, maxStacks: 1, color, hostile: false, necromancySpellDamageMultiplier: 1 + Number(spell.empowerDamagePct || 0.18), tags: ['necromancer', 'soul'], description: 'Next disease, curse, or drain spell is empowered.' }), p);
          if (beforeAlive && (!target.alive || target.hp <= 0)) this.restoreMana?.(p, Math.floor((p.maxMana || 0) * Number(spell.bonusManaRestorePctOnKill || 0.03)));
          trigger(target); this.spawnBolt?.(p, target, color); this.log(`Soul Harvest rips ${dealt} life from ${target.name}.`); return;
        }

        this.damageNecromancerTarget?.(target, spell, Number(spell.power || 0), { damageType: spell.damageType || 'shadow' });
        trigger(target); this.spawnBolt?.(p, target, color);
      };

      Game.prototype.startPlayerClassSpellCast = function(spell, slotIndex, target = null) {
        const p = this.player;
        if (!p) return false;
        const castTime = Math.max(0, Number(spell.castTime || 0));
        p._pendingClassSpellCast = {
          spell: clone(spell, spell),
          slotIndex,
          targetId: target?.id ?? null,
          remaining: castTime,
          total: castTime
        };
        p.spellCastAnim = 1;
        this.spawnCastCue?.(p, spell.color || p.color, spell.name || 'Cast', { sfx: this.spellCastSfxId(spell) });
        this.log(`Casting ${spell.name}...`);
        return true;
      };

      Game.prototype.updatePlayerSpellCast = function(dt) {
        const p = this.player;
        const cast = p?._pendingClassSpellCast;
        if (!cast) return;
        if (!p.alive) { p._pendingClassSpellCast = null; return; }
        cast.remaining = Math.max(0, Number(cast.remaining || 0) - Math.max(0, Number(dt || 0)));
        p.spellCastAnim = Math.max(p.spellCastAnim || 0, 0.18);
        if (cast.remaining > 0) return;
        p._pendingClassSpellCast = null;
        const target = this.findSpellActorById?.(cast.targetId) || this.getTarget?.();
        this.resolveClassSpell?.(cast.spell, { target, targetId: cast.targetId });
        if (target?.alive && this.isHostileTarget?.(target)) target.aggro = true;
      };

      Game.prototype.canCastClassSpell = function(spell) {
        if (!this.player || !this.player.alive || !spell) return false;
        if (this.player._pendingClassSpellCast) {
          this.log('Already casting.');
          return false;
        }
        if (this.isActionLocked?.(this.player)) {
          this.log('You cannot act while stunned.');
          return false;
        }
        if (this.isSilenced?.(this.player)) {
          this.log('You cannot cast spells while silenced.');
          return false;
        }
        const requiredLevel = Math.max(1, Math.floor(Number(spell.levelRequirement || 1)));
        if ((this.player.level || 1) < requiredLevel) {
          this.log(`${spell.name} unlocks at level ${requiredLevel}.`);
          return false;
        }
        const cd = this.player.spellCooldowns[spell.slotIndex ?? 0] || 0;
        if (cd > 0) {
          this.log(`${spell.name} is still recovering.`);
          return false;
        }
        const cost = Math.floor(spell.cost || 0);
        if (this.player.maxMana > 0 && this.player.mana < cost) {
          const resourceLabel = this.spellResourceLabel?.(spell).toLowerCase() || 'mana';
          this.log(`Not enough ${resourceLabel} for ${spell.name}.`);
          return false;
        }
        if (String(this.player.className || '').toLowerCase() === 'rogue' && spell.rogueSpellId) {
          const selectedTarget = this.getTarget?.();
          if (spell.rogueSpellId === 'killing_cut') {
            const resolved = this.resolveHostileSpellTarget?.(spell, selectedTarget, { range: spell.range || 1.65 });
            if (!resolved?.ok) return false;
            if ((resolved.target.hp || 0) / Math.max(1, resolved.target.maxHp || 1) > Number(spell.executeThresholdPct || 0.30)) {
              this.log('Killing Cut requires the target to be at or below 30% HP.');
              return false;
            }
          }
          if (spell.rogueSpellId === 'deathdose') {
            const resolved = this.resolveHostileSpellTarget?.(spell, selectedTarget, { range: spell.range || 1.65 });
            if (!resolved?.ok) return false;
            const poison = resolved.target.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === 'rogue_poison_stack');
            if (!poison || Number(poison.stacks || 0) <= 0) {
              this.log('Deathdose requires poison stacks on the target.');
              return false;
            }
          }
          if (spell.rogueSpellId === 'perfect_counter' && !this.player.buffs?.some?.(buff => buff && buff.remaining > 0 && buff.id === 'rogue_counter_ready')) {
            this.log('Perfect Counter requires Counter Ready from an evade.');
            return false;
          }
        }
        if (String(this.player.className || '').toLowerCase() === 'fighter' && spell.fighterSpellId) {
          const selectedTarget = this.getTarget?.();
          if (spell.fighterSpellId === 'final_swing') {
            const resolved = this.resolveHostileSpellTarget?.(spell, selectedTarget, { range: spell.range || 1.65 });
            if (!resolved?.ok) return false;
            if ((resolved.target.hp || 0) / Math.max(1, resolved.target.maxHp || 1) > Number(spell.executeThresholdPct || 0.30)) {
              this.log('Final Swing requires the target to be at or below 30% HP.');
              return false;
            }
          }
          if (spell.fighterSpellId === 'heavy_riposte' && !this.player.buffs?.some?.(buff => buff && buff.remaining > 0 && buff.id === 'fighter_riposte_ready')) {
            this.log('Heavy Riposte requires Riposte Ready from a dodge or parry.');
            return false;
          }
        }
        if (String(this.player.className || '').toLowerCase() === 'summoner' && spell.summonerSpellId) {
          if (spell.requiresActivePet && (!this.pet || !this.pet.alive)) {
            this.log(`${spell.name} requires an active summon.`);
            return false;
          }
        }
        if (spell.requiresPet && (!this.pet || !this.pet.alive)) {
          this.log(spell.kind === 'petHeal' ? 'No active pet to heal.' : 'No active pet to empower.');
          return false;
        }
        if (spell.requiresTarget) {
          if (spell.kind === 'revive') {
            const deadTarget = this.getReviveTarget?.(this.player);
            if (!deadTarget) {
              this.log(`${spell.name} requires a dead party member target.`);
              return false;
            }
            if (!this.canReviveTarget?.(this.player, deadTarget, spell.range || 6)) {
              this.log(`${spell.name} cannot reach that dead party member.`);
              return false;
            }
            return true;
          }
          const offensive = this.isOffensiveSpellKind?.(spell.kind);
          const selectedTarget = this.getTarget?.();
          if (offensive) {
            const range = spell.range || (spell.kind === 'melee' || spell.kind === 'meleeDebuff' ? 2 : 7);
            const resolved = this.resolveHostileSpellTarget?.(spell, selectedTarget, { range });
            if (!resolved?.ok) return false;
            return true;
          }
          const target = selectedTarget;
          if (!target || !target.alive) {
            this.log(`No target for ${spell.name}.`);
            return false;
          }
          if (!this.isFriendlyTarget?.(target)) {
            this.log(`${spell.name} requires a friendly target.`);
            return false;
          }
          if (spell.kind === 'cleanse' && !(spell.removesStatusTags || ['poison']).some(tag => this.hasCurableStatusTag?.(target, tag))) {
            this.log(`${target.name || 'Target'} has no curable poison effect.`);
            return false;
          }
          const range = spell.range || 7;
          if (distFn(this.player, target) > range) {
            this.log(`${spell.name} is out of range.`);
            return false;
          }
        }
        return true;
      };

      Game.prototype.useClassSpell = function(index) {
        if (!this.player || !this.player.alive) return false;
        const spells = this.getClassSpells();
        const spell = spells[index];
        if (!spell) {
          this.log(`No spell assigned to hotkey ${index + 2}.`);
          return false;
        }

        const target = this.getTarget?.();
        const slotIndex = Math.max(0, Math.floor(Number(index) || 0));
        spell.slotIndex = slotIndex;
        if (!this.canCastClassSpell(spell)) return false;

        const cost = Math.floor(spell.cost || 0);
        if (this.player.maxMana > 0) this.player.mana = Math.max(0, this.player.mana - cost);
        this.cancelMeditation?.(this.player, 'spell cast', { silent: true });
        this.cancelPlayerEmote?.('action');
        const cooldownValue = spell.noLevelScaling ? (spell.cooldown || 4) : (DR.StatSystem?.effectiveCooldown?.(spell.cooldown || 4, this.player) || (spell.cooldown || 4));
        this.player.spellCooldowns[slotIndex] = cooldownValue;
        this.applySpellCooldownGroup?.(spell, slotIndex, cooldownValue);
        this.player.skillCooldown = Math.max(this.player.skillCooldown, Number(spell.globalCooldown || 0.4));
        const castTime = Math.max(0, Number(spell.castTime || 0));
        if (castTime > 0.05 && spell.instant !== true) {
          this.startPlayerClassSpellCast?.(spell, slotIndex, target);
          return true;
        }
        this.player.spellCastAnim = 1;
        this.spawnCastCue?.(this.player, spell.color || this.player.color, spell.name || 'Cast', { sfx: this.spellCastSfxId(spell) });
        this.resolveClassSpell(spell, { target, targetId: target?.id ?? null });
        // V0.17.69 Talents: onCast capstone trigger (instant-cast path).
        this.fireTalentProc?.('onCast', { spell, target });
        if (target?.alive && this.isHostileTarget?.(target)) target.aggro = true;
        return true;
      };



      Game.prototype.isRangerMarkedTarget = function(target, source = this.player) {
        return Boolean(target?.buffs?.some?.(buff => buff && buff.remaining > 0 && buff.id === 'ranger_hunters_mark' && (buff.sourceId == null || buff.sourceId === source?.id)));
      };

      Game.prototype.consumePlayerBuffCharge = function(statusId, count = 1) {
        const p = this.player;
        const buff = p?.buffs?.find?.(entry => entry && entry.remaining > 0 && entry.id === statusId);
        if (!buff) return null;
        buff.stacks = Math.max(0, Number(buff.stacks || buff.charges || 1) - Math.max(1, Number(count || 1)));
        if (buff.stacks <= 0) buff.remaining = 0;
        return buff;
      };

      Game.prototype.applyRangerTrap = function(spell, target = null) {
        const p = this.player;
        const t = target || this.getTarget?.();
        if (!t || !t.alive || !this.isHostileTarget?.(t)) {
          this.log(`${spell.name} requires a hostile path target for trap placement.`);
          return false;
        }
        p.rangerActiveTraps = Array.isArray(p.rangerActiveTraps) ? p.rangerActiveTraps.filter(trap => trap && (this.time || 0) - Number(trap.createdAt || 0) < Number(trap.duration || 300)) : [];
        const limit = Math.max(1, Number(spell.trapLimit || 2));
        while (p.rangerActiveTraps.length >= limit) p.rangerActiveTraps.shift();
        p.rangerActiveTraps.push({ id: spell.rangerSpellId || normalizeSpellIconKey(spell), createdAt: this.time || 0, duration: Number(spell.trapDuration || 300), x: t.x, y: t.y });
        let damage = Number(spell.power || 0);
        if (this.isRangerMarkedTarget?.(t, p) && Number(spell.markDamageBonus || 0) > 0) damage = Math.floor(damage * (1 + Number(spell.markDamageBonus || 0)));
        const killZone = p.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === 'ranger_kill_zone_focus');
        if (killZone && Number(spell.trapDamageBonus || 0) >= 0) damage = Math.floor(damage * (1 + Number(killZone.trapDamageBonus || 0.25)));
        if (damage > 0) this.damageEntity?.(t, damage, p, spell.color || p.color, { damageType: spell.damageType || 'physical', spellName: spell.name });
        if (Number(spell.tickDamage || 0) > 0) {
          let tick = Number(spell.tickDamage || 0);
          if (this.isRangerMarkedTarget?.(t, p) && Number(spell.markBleedBonus || 0) > 0) tick = Math.floor(tick * (1 + Number(spell.markBleedBonus || 0)));
          this.applyStatusEffect?.(t, this.decorateStatusEffectFromSpell(spell, { id: `${spell.rangerSpellId || normalizeSpellIconKey(spell)}_bleed`, name: spell.name, type: 'dot', duration: Number(spell.tickDuration || spell.duration || 10), tickRate: Number(spell.tickRate || 2), periodicDamage: tick, damageType: spell.damageType || 'physical', color: spell.color, hostile: true, tags: ['ranger', 'trap', 'bleed'] }), p);
        }
        if (spell.moveSpeedMultiplier || (spell.mods && Object.keys(spell.mods).length)) {
          this.applyStatusEffect?.(t, this.decorateStatusEffectFromSpell(spell, { id: `${spell.rangerSpellId || normalizeSpellIconKey(spell)}_snare`, name: spell.name, type: 'debuff', duration: Number(spell.duration || 8), mods: spell.mods || {}, moveSpeedMultiplier: Number(spell.moveSpeedMultiplier || 0), color: spell.color, hostile: true, tags: ['ranger', 'trap', 'slow'] }), p);
        }
        this.spawnRing?.(t.x, t.y, spell.color || p.color, 18);
        this.spawnStatusPulse?.(t, spell.color || p.color, spell.name);
        this.log(`${spell.name} triggers on ${t.name || 'target'}.`);
        return true;
      };

      Game.prototype.resolveRangerRevampSpell = function(spell, options = {}) {
        const p = this.player;
        const id = spell.rangerSpellId || normalizeSpellIconKey(spell);
        const color = spell.color || '#8ed16f';
        const selectedTarget = options.target || this.getTarget?.();
        const hostileTarget = (range = spell.range || 8) => {
          const resolved = this.resolveHostileSpellTarget?.(spell, selectedTarget, { range });
          if (!resolved?.ok) return null;
          const target = resolved.target;
          p.setFacingFromDelta?.(target.x - p.x, target.y - p.y);
          return target;
        };
        const selfBuff = (statusId, name, extra = {}) => {
          this.applyStatusEffect?.(p, this.decorateStatusEffectFromSpell(spell, { id: statusId, name, type: 'buff', duration: Number(extra.duration || spell.duration || 300), color, hostile: false, stacks: extra.stacks || spell.charges || 1, maxStacks: extra.maxStacks || spell.charges || 1, tags: extra.tags || ['ranger'], mods: spell.mods || {}, ...extra }), p);
          this.spawnRing?.(p.x, p.y, color, 16);
          this.log(`${name} applied.`);
        };
        if (id === 'hunter_s_mark') {
          const t = hostileTarget(spell.range || 10); if (!t) return;
          for (const enemy of this.enemies || []) if (Array.isArray(enemy.buffs)) enemy.buffs = enemy.buffs.filter(buff => !(buff.id === 'ranger_hunters_mark' && buff.sourceId === p.id));
          this.applyStatusEffect?.(t, this.decorateStatusEffectFromSpell(spell, { id: 'ranger_hunters_mark', name: "Hunter's Mark", type: 'debuff', duration: 300, color, hostile: true, rangerMarkDamageBonus: Number(spell.markDamageBonus || 0.08), tags: ['ranger', 'mark', 'tracking'], description: 'Ranger damage against this target is increased and tracks are revealed.' }), p);
          this.spawnStatusPulse?.(t, color, 'Marked');
          this.log(`${t.name || 'Target'} is marked as prey.`);
          return;
        }
        if (id === 'track_prey') return selfBuff('ranger_track_prey', 'Track Prey', { duration: 1800, stacks: 1, maxStacks: 1, tags: ['ranger', 'tracking'] });
        if (id === 'camouflage') return selfBuff('ranger_camouflage', 'Camouflage', { duration: 300, stacks: 1, maxStacks: 1, moveSpeedMultiplier: 0.85, tags: ['ranger', 'stealth'] });
        if (id === 'eagle_eye') return selfBuff('ranger_eagle_eye', 'Eagle Eye', { duration: 300, stacks: 8, maxStacks: 8, rangedCritBonus: 0.10, tags: ['ranger', 'bow'] });
        if (id === 'wilderness_reflexes') return selfBuff('ranger_wilderness_reflexes', 'Wilderness Reflexes', { duration: 300, stacks: 3, maxStacks: 3, moveSpeedMultiplier: 1.15, tags: ['ranger', 'dodge'] });
        if (id === 'apex_predator') return selfBuff('ranger_apex_predator', 'Apex Predator', { duration: 300, stacks: 8, maxStacks: 8, markedRangedDamageBonus: 0.22, markedCritBonus: 0.08, tags: ['ranger', 'mark'] });
        if (id === 'true_hunt') return selfBuff('ranger_true_hunt', 'True Hunt', { duration: 300, stacks: 1, maxStacks: 1, bowDamageBonus: 0.18, trueHuntMarkBonus: 0.18, trapDamageBonus: 0.15, tags: ['ranger', 'capstone'] });
        if (id === 'kill_zone') return selfBuff('ranger_kill_zone_focus', 'Kill Zone Focus', { duration: 300, stacks: 10, maxStacks: 10, trapDamageBonus: 0.25, rangedDamageBonus: 0.12, tags: ['ranger', 'trap', 'field'] });
        if (spell.trap) { this.applyRangerTrap?.(spell, selectedTarget); return; }
        if (spell.kind === 'aoe' || spell.kind === 'aoeDebuff') {
          const center = selectedTarget && selectedTarget.alive && this.isHostileTarget?.(selectedTarget) ? selectedTarget : p;
          let count = 0;
          for (const enemy of (this.queryEnemiesNearPoint?.(center.x, center.y, spell.radius || 7) || this.enemies || [])) {
            if (!enemy?.alive || distFn(enemy, center) > (spell.radius || 7)) continue;
            let dmg = this.scaledSpellValue?.(spell) || Number(spell.power || 0);
            if (this.isRangerMarkedTarget?.(enemy, p)) dmg = Math.floor(dmg * (1 + Number(spell.markDamageBonus || 0.10)));
            this.damageEntity?.(enemy, dmg, p, color, { damageType: spell.damageType || 'physical', spellName: spell.name });
            this.spawnCasterMotifEffect?.(enemy.x, enemy.y, 'hunt', { radius: 18 }); // V0.20.29: Ranger hunt mark
            if (Number(spell.tickDamage || 0) > 0) this.applyStatusEffect?.(enemy, this.decorateStatusEffectFromSpell(spell, { id: `${id}_bleed`, name: spell.name, type: 'dot', duration: Number(spell.tickDuration || spell.duration || 12), tickRate: Number(spell.tickRate || 2), periodicDamage: Number(spell.tickDamage || 0), damageType: spell.damageType || 'physical', color, hostile: true, tags: ['ranger', 'bleed'] }), p);
            count++;
            if (count >= Number(spell.targetCap || 6)) break;
          }
          this.spawnRing?.(center.x, center.y, color, 24);
          this.log(`${spell.name} hits ${count} enemies.`);
          return;
        }
        const t = hostileTarget(spell.range || 8); if (!t) return;
        let dmg = this.scaledSpellValue?.(spell) || Number(spell.power || 0);
        if (this.isRangerMarkedTarget?.(t, p)) {
          const trueHunt = p.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === 'ranger_true_hunt');
          const bonus = id === 'hunter_s_mark' ? 0 : Number(spell.markDamageBonus || (trueHunt ? 0.18 : 0.08));
          dmg = Math.floor(dmg * (1 + bonus));
        }
        const apex = p.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === 'ranger_apex_predator');
        if (apex && this.isRangerMarkedTarget?.(t, p)) { dmg = Math.floor(dmg * 1.22); this.consumePlayerBuffCharge?.('ranger_apex_predator'); }
        const trueHunt = p.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === 'ranger_true_hunt');
        if (trueHunt) dmg = Math.floor(dmg * (1 + Number(trueHunt.bowDamageBonus || 0.18)));
        if ((id === 'steady_shot' || id === 'quickdraw') && trueHunt && this.isRangerMarkedTarget?.(t, p)) this.restoreMana?.(p, Number(spell.markedShotRefund || 8));
        if (id === 'disengage_shot') {
          const { x: fx, y: fy } = this.actorFacingVector(p); // V0.19.7: see actorFacingVector - `|| 1` broke N/S
          p.x -= fx * 1.2; p.y -= fy * 1.2;
        }
        const dealt = this.damageEntity?.(t, dmg, p, color, { damageType: spell.damageType || 'physical', spellName: spell.name });
        this.spawnCasterMotifEffect?.(t.x, t.y, 'hunt', { radius: 18 }); // V0.20.29: Ranger hunt mark
        if (spell.moveSpeedMultiplier || (spell.mods && Object.keys(spell.mods).length)) this.applyStatusEffect?.(t, this.decorateStatusEffectFromSpell(spell, { id: `${id}_debuff`, name: spell.name, type: 'debuff', duration: Number(spell.duration || 5), mods: spell.mods || {}, moveSpeedMultiplier: Number(spell.moveSpeedMultiplier || 0), color, hostile: true, tags: ['ranger', 'slow'] }), p);
        this.spawnBolt?.(p, t, color, { projectile: spell.projectile });
        this.log(`${spell.name} hits ${t.name || 'target'} for ${dealt || dmg}.`);
      };

      Game.prototype.isRogueBehindTarget = function(rogue = this.player, target = null) {
        if (!rogue || !target) return false;
        // V0.19.7: was `Number(target.facingX || 0), Number(target.facingY || 1)` - a target facing due
        // EAST has facingY === 0, and `0 || 1` is 1, so it was read as facing 45 degrees and the whole
        // "behind" arc rotated with it. Backstab positioning has been wrong against axis-facing targets.
        const { x: tx, y: ty } = this.actorFacingVector(target);
        const dx = Number(rogue.x || 0) - Number(target.x || 0);
        const dy = Number(rogue.y || 0) - Number(target.y || 0);
        const len = Math.hypot(dx, dy) || 1;
        const facingLen = Math.hypot(tx, ty) || 1;
        const dot = (tx * dx + ty * dy) / facingLen / len;
        return dot < -0.35;
      };

      Game.prototype.applyRoguePoisonStack = function(target, spell = {}, stacks = 1) {
        if (!target) return null;
        const p = this.player;
        const current = target.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === 'rogue_poison_stack' && buff.sourceId === p?.id);
        const nextStacks = Math.min(5, Math.max(1, Number(current?.stacks || 0) + Math.max(1, Number(stacks || 1))));
        return this.applyStatusEffect?.(target, this.decorateStatusEffectFromSpell(spell, { id: 'rogue_poison_stack', name: 'Poison', type: 'dot', duration: 12, tickRate: 3, periodicDamage: Number(spell.poisonTick || 6), damageType: 'nature', color: spell.color || '#8ed16f', hostile: true, stacks: nextStacks, maxStacks: 5, tags: ['rogue', 'poison'], stackMode: 'refresh', description: 'Rogue poison stack. Stacks up to 5 and ticks every 3 seconds.' }), p);
      };

      Game.prototype.resolveRogueRevampSpell = function(spell, options = {}) {
        const p = this.player;
        const id = spell.rogueSpellId || normalizeSpellIconKey(spell);
        const color = spell.color || '#cfd4d9';
        const selectedTarget = options.target || this.getTarget?.();
        const hostileTarget = (range = spell.range || 1.65) => {
          const resolved = this.resolveHostileSpellTarget?.(spell, selectedTarget, { range });
          if (!resolved?.ok) return null;
          const target = resolved.target;
          p.setFacingFromDelta?.(target.x - p.x, target.y - p.y);
          return target;
        };
        const selfBuff = (statusId, name, extra = {}) => {
          this.applyStatusEffect?.(p, this.decorateStatusEffectFromSpell(spell, { id: statusId, name, type: 'buff', duration: Number(extra.duration || spell.duration || 300), color, hostile: false, stacks: extra.stacks || spell.charges || 1, maxStacks: extra.maxStacks || spell.charges || 1, tags: extra.tags || ['rogue'], mods: spell.mods || {}, ...extra }), p);
          this.spawnRing?.(p.x, p.y, color, 14);
          this.log(`${name} applied.`);
        };
        if (id === 'smoke_veil') return selfBuff('rogue_smoke_veil', 'Smoke Veil', { duration: 300, stacks: 1, maxStacks: 1, rogueStealth: true, tags: ['rogue', 'stealth'] });
        if (id === 'venom_edge') return selfBuff('rogue_venom_edge', 'Venom Edge', { duration: 3600, stacks: 40, maxStacks: 40, poisonChance: 0.35, tags: ['rogue', 'poison'] });
        if (id === 'evasive_step') {
          const { x: fx, y: fy } = this.actorFacingVector(p); // V0.19.7: see actorFacingVector - `|| 1` broke N/S
          p.x -= fx * 0.85; p.y -= fy * 0.85;
          return selfBuff('rogue_evasive_step', 'Evasive Step', { duration: 300, stacks: 2, maxStacks: 2, dodgeBonus: 0.35, tags: ['rogue', 'evasion'] });
        }
        if (id === 'crippling_toxin') return selfBuff('rogue_crippling_toxin', 'Crippling Toxin', { duration: 1800, stacks: 30, maxStacks: 30, toxinChance: 0.30, tags: ['rogue', 'poison', 'slow'] });
        if (id === 'vanish') return selfBuff('rogue_vanish', 'Vanish', { duration: 300, stacks: 1, maxStacks: 1, rogueStealth: true, tags: ['rogue', 'stealth'] });
        if (id === 'phantom_blades') return selfBuff('rogue_phantom_blades', 'Phantom Blades', { duration: 300, stacks: 10, maxStacks: 10, echoDamagePct: 0.30, tags: ['rogue', 'shadow'] });
        if (id === 'shadow_dance') return selfBuff('rogue_shadow_dance', 'Shadow Dance', { duration: 300, stacks: 6, maxStacks: 6, stealthAttackDamageBonus: 0.12, tags: ['rogue', 'stealth', 'burst'] });
        if (id === 'smoke_bomb') {
          const center = selectedTarget && selectedTarget.alive && this.isHostileTarget?.(selectedTarget) ? selectedTarget : p;
          for (const enemy of (this.queryEnemiesNearPoint?.(center.x, center.y, spell.radius || 8) || this.enemies || [])) {
            if (!enemy?.alive || distFn(enemy, center) > (spell.radius || 8)) continue;
            this.applyStatusEffect?.(enemy, this.decorateStatusEffectFromSpell(spell, { id: 'rogue_smoke_bomb_accuracy', name: 'Smoke Bomb', type: 'debuff', duration: 12, color, hostile: true, mods: { attack: -5 }, tags: ['rogue', 'smoke'], description: 'Accuracy reduced while attacking targets inside smoke.' }), p);
          }
          this.spawnRing?.(center.x, center.y, color, 24);
          this.log('Smoke Bomb spreads a defensive smoke field.');
          return;
        }
        if (id === 'shadowstep') {
          const t = hostileTarget(spell.range || 6.3); if (!t) return;
          // V0.19.7: `t.facingY || 1` put Shadowstep BESIDE an east-facing target rather than behind it.
          const { x: tx, y: ty } = this.actorFacingVector(t);
          p.x = t.x - tx * 0.8; p.y = t.y - ty * 0.8;
          return selfBuff('rogue_shadowstep_advantage', 'Shadowstep Advantage', { duration: 300, stacks: 1, maxStacks: 1, nextDaggerDamageBonus: 0.25, tags: ['rogue', 'mobility'] });
        }
        const t = hostileTarget(spell.range || 1.65); if (!t) return;
        const behind = this.isRogueBehindTarget?.(p, t);
        const stealth = p.buffs?.some?.(buff => buff && buff.remaining > 0 && (buff.id === 'rogue_smoke_veil' || buff.id === 'rogue_vanish' || buff.id === 'rogue_shadow_dance'));
        const poison = t.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === 'rogue_poison_stack' && (buff.sourceId == null || buff.sourceId === p.id));
        const poisonStacks = Math.max(0, Number(poison?.stacks || 0));
        let dmg = this.scaledSpellValue?.(spell) || Number(spell.power || 0);
        if (id === 'backstab') {
          let setup = 0;
          if (behind) setup += Number(spell.behindDamageBonus || 0.35);
          if (stealth) setup += Number(spell.stealthDamageBonus || 0.50);
          dmg = Math.floor(dmg * (1 + Math.min(Number(spell.maxSetupBonus || 0.75), setup)));
        }
        if (id === 'garrote' && !(behind || stealth)) { this.log('Garrote requires stealth, behind positioning, or Shadow Dance.'); return; }
        if (id === 'garrote' && stealth) dmg = Math.floor(dmg * 1.25);
        if (id === 'twin_fang' && poisonStacks > 0) dmg = Math.floor(dmg * (1 + Number(spell.poisonedTargetBonus || 0.25)));
        if (id === 'flurry_cut' && t.buffs?.some?.(buff => buff && buff.remaining > 0 && String(buff.id || '').includes('bleed'))) dmg = Math.floor(dmg * 1.12);
        if (id === 'killing_cut') {
          const hpPct = (t.hp || 0) / Math.max(1, t.maxHp || 1);
          if (hpPct > Number(spell.executeThresholdPct || 0.30)) { this.log('Killing Cut requires the target to be at or below 30% HP.'); return; }
          dmg = Math.floor(dmg * (1 + Math.min(Number(spell.missingHpDamageBonusMax || 0.60), 1 - hpPct)));
          if (poisonStacks > 0) dmg = Math.floor(dmg * (1 + Number(spell.poisonedTargetBonus || 0.15)));
        }
        if (id === 'deathdose') {
          if (poisonStacks <= 0) { this.log('Deathdose requires poison stacks.'); return; }
          const consumed = Math.min(5, poisonStacks);
          dmg = Number(spell.power || 35) + consumed * Number(spell.bonusPerPoisonStack || 28);
          poison.stacks = Math.max(0, poisonStacks - consumed);
          if (poison.stacks <= 0) poison.remaining = 0;
          if (consumed >= 5) this.restoreMana?.(p, Number(spell.fiveStackEnergyRefund || 20));
        }
        if (id === 'silent_execution') {
          if (behind) dmg = Math.floor(dmg * (1 + Number(spell.behindDamageBonus || 0.25)));
          if (stealth) dmg = Math.floor(dmg * (1 + Number(spell.stealthDamageBonus || 0.35)));
          if (poisonStacks > 0) dmg = Math.floor(dmg * (1 + Math.min(Number(spell.poisonedStackBonusMax || 0.60), poisonStacks * Number(spell.poisonedStackDamageBonus || 0.12))));
          if (poisonStacks >= 5) this.restoreMana?.(p, Number(spell.fiveStackEnergyRefund || 35));
        }
        const shadowstep = p.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === 'rogue_shadowstep_advantage');
        if (shadowstep) { dmg = Math.floor(dmg * (1 + Number(shadowstep.nextDaggerDamageBonus || 0.25))); shadowstep.remaining = 0; }
        const phantom = p.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === 'rogue_phantom_blades');
        const wasAlive = t.alive && t.hp > 0;
        // V0.20.20 (Roadmap Item 6): the Rogue swings a knife and nothing was ever drawn.
        //
        // This resolver put a ring on the ground and dealt damage - no melee animation at all, for
        // ELEVEN melee spells. It is the only melee class with none: the Fighter animates every swing,
        // and the Paladin and Warden fall through to the generic resolver which does. So Backstab,
        // Garrote and Silent Execution all landed on a target with no blade in sight.
        //
        // Authored per-spell via vfxStyle, same field and same styles as the Fighter, so a Rogue's
        // Twin Fang gets the twin-arc 'claw' its two daggers deserve and Backstab gets a 'thrust'
        // rather than a swing. Placed before the damage so the strike reads as causing it.
        this.playAttackAnimation?.(p, t, color, spell.vfxStyle || 'slash');
        const dealt = this.damageEntity?.(t, dmg, p, color, { damageType: spell.damageType || 'physical', spellName: spell.name });
        if (phantom && !['deathdose','silent_execution'].includes(id)) { this.damageEntity?.(t, Math.floor(dmg * Number(phantom.echoDamagePct || 0.30)), p, '#8e85ff', { damageType: 'shadow', spellName: 'Phantom Blades' }); this.consumePlayerBuffCharge?.('rogue_phantom_blades'); }
        if (Number(spell.tickDamage || 0) > 0) this.applyStatusEffect?.(t, this.decorateStatusEffectFromSpell(spell, { id: `${id}_bleed`, name: spell.name, type: 'dot', duration: Number(spell.tickDuration || spell.duration || 12), tickRate: Number(spell.tickRate || 2), periodicDamage: Number(spell.tickDamage || 0), damageType: spell.damageType || 'physical', color, hostile: true, tags: ['rogue', 'bleed'] }), p);
        if (spell.duration && (spell.mods && Object.keys(spell.mods).length)) this.applyStatusEffect?.(t, this.decorateStatusEffectFromSpell(spell, { id: `${id}_debuff`, name: spell.name, type: 'debuff', duration: Number(spell.duration || 6), mods: spell.mods || {}, moveSpeedMultiplier: Number(spell.moveSpeedMultiplier || 0), color, hostile: true, tags: ['rogue'] }), p);
        const venom = p.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === 'rogue_venom_edge');
        if ((Number(spell.poisonStacks || 0) > 0) || (venom && Math.random() < Number(venom.poisonChance || spell.poisonChanceFromVenom || 0.30))) {
          this.applyRoguePoisonStack?.(t, spell, Number(spell.poisonStacks || 1));
          if (venom) this.consumePlayerBuffCharge?.('rogue_venom_edge');
        }
        const toxin = p.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === 'rogue_crippling_toxin');
        if (toxin && Math.random() < Number(toxin.toxinChance || 0.30)) {
          this.applyStatusEffect?.(t, this.decorateStatusEffectFromSpell(spell, { id: 'rogue_crippling_toxin_debuff', name: 'Crippling Toxin', type: 'debuff', duration: 8, color, hostile: true, moveSpeedMultiplier: 0.65, mods: { speed: -0.35, attack: -2 }, tags: ['rogue', 'poison', 'slow'] }), p);
          this.consumePlayerBuffCharge?.('rogue_crippling_toxin');
        }
        if (stealth && ['backstab','garrote','quick_cut','bleeding_vein','silent_execution'].includes(id)) {
          for (const stealthId of ['rogue_smoke_veil', 'rogue_vanish']) { const buff = p.buffs?.find?.(entry => entry && entry.id === stealthId); if (buff) buff.remaining = 0; }
          if (p.buffs?.some?.(entry => entry && entry.id === 'rogue_shadow_dance')) this.consumePlayerBuffCharge?.('rogue_shadow_dance');
        }
        if (wasAlive && (!t.alive || t.hp <= 0) && Number(spell.killResourceRefund || 0) > 0) this.restoreMana?.(p, Number(spell.killResourceRefund));
        this.spawnStatusPulse?.(t, color, spell.name);
        this.log(`${spell.name} hits ${t.name || 'target'} for ${dealt || dmg}.`);
      };


      Game.prototype.shamanActiveStatus = function(id) {
        return this.getActiveStatusById?.(this.player, id) || null;
      };

      Game.prototype.consumeShamanCharge = function(statusId, count = 1) {
        const effect = this.shamanActiveStatus?.(statusId);
        if (!effect) return null;
        effect.stacks = Math.max(0, Number(effect.stacks || effect.charges || 1) - Math.max(1, Number(count || 1)));
        if (effect.stacks <= 0) effect.remaining = 0;
        return effect;
      };

      Game.prototype.isShamanBrandedTarget = function(target, source = this.player) {
        return Boolean(target?.buffs?.some?.(buff => buff && buff.remaining > 0 && buff.id === 'shaman_ancestors_brand' && (buff.sourceId == null || buff.sourceId === source?.id)));
      };

      Game.prototype.applyShamanDot = function(target, spell, amount, duration, tickRate, damageType = null) {
        if (!target || !target.alive) return;
        let tick = Math.max(1, Math.floor(Number(amount || spell.tickDamage || 0)));
        const avatar = this.shamanActiveStatus?.('shaman_tempest_avatar');
        if (avatar && String(spell.school || '').toLowerCase().includes('spirit')) tick = Math.floor(tick * Number(avatar.spiritDotDamageMultiplier || 1));
        if (this.isShamanBrandedTarget?.(target) && Number(spell.brandDamageBonus || 0) > 0) tick = Math.floor(tick * (1 + Number(spell.brandDamageBonus || 0)));
        this.applyStatusEffect?.(target, this.decorateStatusEffectFromSpell(spell, {
          id: `shaman_${spell.shamanSpellId || normalizeSpellIconKey(spell)}_dot`,
          name: spell.name,
          type: 'dot',
          duration: Number(duration || spell.tickDuration || spell.duration || 10),
          tickRate: Number(tickRate || spell.tickRate || 2),
          periodicDamage: tick,
          damageType: damageType || spell.damageType || 'magic',
          color: spell.color || '#70e6d3',
          hostile: true,
          tags: ['shaman', spell.school || 'spirit']
        }), this.player);
      };

      // V0.20.33 (Roadmap Item 19): the crowd-control tags that INTERRUPT a telegraphed enemy cast.
      // Stun/silence/freeze/sleep/knockback stop a cast; root and slow deliberately do NOT (a rooted
      // caster can still finish its spell). Matches the CONTROL_TAGS family in status-effect-system.
      Game.prototype.INTERRUPT_CC_TAGS = new Set(['stun', 'silence', 'freeze', 'frozen', 'sleep', 'knockback', 'knockdown', 'interrupt']);

      Game.prototype.queuePendingSpellImpact = function(impact) {
        this.pendingSpellImpacts = Array.isArray(this.pendingSpellImpacts) ? this.pendingSpellImpacts : [];
        this.pendingSpellImpacts.push({ ...impact, remaining: Math.max(0, Number(impact?.delay || 0)) });
      };

      Game.prototype.updatePendingSpellImpacts = function(dt = 0) {
        const queue = Array.isArray(this.pendingSpellImpacts) ? this.pendingSpellImpacts : [];
        if (!queue.length) return;
        const remaining = [];
        for (const impact of queue) {
          impact.remaining = Math.max(0, Number(impact.remaining || 0) - Math.max(0, Number(dt || 0)));
          if (impact.remaining > 0) { remaining.push(impact); continue; }
          if (impact.kind === 'shaman_cataclysm') {
            const source = this.player;
            const center = impact.center || source;
            const radius = Number(impact.radius || 10);
            const cap = Math.max(1, Number(impact.targetCap || 8));
            let hit = 0;
            for (const enemy of (this.queryEnemiesNearPoint?.(center.x, center.y, radius + 0.5) || this.enemies || [])) {
              if (!enemy?.alive || distFn(enemy, center) > radius || hit >= cap) continue;
              const dmg = Math.max(1, Math.floor(Number(impact.damage || 430)));
              this.damageEntity?.(enemy, dmg, source, impact.color || '#70e6d3', { damageType: 'primal', spellName: impact.name || 'Ancestral Cataclysm' });
              this.applyStatusEffect?.(enemy, this.decorateStatusEffectFromSpell(impact.spell, { id: 'shaman_cataclysm_quaked', name: 'Quaked / Shocked / Haunted', type: 'debuff', duration: 8, color: impact.color || '#70e6d3', hostile: true, moveSpeedMultiplier: 0.80, mods: { speed: -0.20 }, tags: ['shaman', 'primal'] }), source);
              hit++;
            }
            this.spawnRing?.(center.x, center.y, impact.color || '#70e6d3', 32);
            this.log(`Ancestral Cataclysm crashes into ${hit} enemies.`);
          }
          if (impact.kind === 'wizard_meteorfall' || impact.kind === 'wizard_cataclysm') {
            const source = this.player;
            const center = impact.center || source;
            const radius = Number(impact.radius || (impact.kind === 'wizard_cataclysm' ? 10 : 7));
            const cap = Math.max(1, Number(impact.targetCap || (impact.kind === 'wizard_cataclysm' ? 8 : 6)));
            let hit = 0;
            for (const enemy of (this.queryEnemiesNearPoint?.(center.x, center.y, radius + 0.5) || this.enemies || [])) {
              if (!enemy?.alive || distFn(enemy, center) > radius || hit >= cap) continue;
              const dmg = Math.max(1, Math.floor(Number(impact.damage || 120)));
              this.damageEntity?.(enemy, dmg, source, impact.color || '#6fa8ff', { damageType: impact.damageType || 'magic', spellName: impact.name || 'Wizard Impact' });
              if (impact.kind === 'wizard_meteorfall') this.applyStatusEffect?.(enemy, this.decorateStatusEffectFromSpell(impact.spell, { id: 'wizard_meteorfall_burn', name: 'Meteor Burn', type: 'dot', duration: 8, tickRate: 2, periodicDamage: Number(impact.tickDamage || 18), damageType: 'fire', color: impact.color || '#ff8a40', hostile: true, tags: ['wizard', 'fire', 'burn'] }), source);
              else this.applyStatusEffect?.(enemy, this.decorateStatusEffectFromSpell(impact.spell, { id: 'wizard_cataclysm_fracture', name: 'Burned / Chilled / Arcane Fracture', type: 'debuff', duration: 8, color: impact.color || '#6fa8ff', hostile: true, arcaneDamageTakenMultiplier: 1.08, moveSpeedMultiplier: 0.85, tags: ['wizard', 'fire', 'frost', 'arcane', 'shatter_setup'] }), source);
              hit++;
            }
            this.spawnRing?.(center.x, center.y, impact.color || '#6fa8ff', impact.kind === 'wizard_cataclysm' ? 34 : 24);
            this.log(`${impact.name || 'Wizard impact'} strikes ${hit} enemies.`);
          }
          // V0.20.31/V0.20.33 (Roadmap Item 19): a telegraphed ENEMY ground-AoE lands here, 0.5s after
          // its danger marker appeared - the player's window to step out. V0.20.33 makes it an INTERRUPT
          // opportunity too: if the caster is hard crowd-controlled (stunned/silenced/frozen/slept) when
          // the strike is due, it is INTERRUPTED and never lands. So a stun landed inside the window
          // stops the attack - the CC system (V0.20.27/30) and the telegraph now reward each other. A
          // caster that merely DIED still commits (the ground effect was already loosed, per V0.20.31);
          // only a deliberate interrupt cancels.
          if (impact.kind === 'enemy_aoe') {
            const center = impact.center || {};
            const src = impact.source && impact.source.alive !== false ? impact.source : (impact.source || null);
            const interrupted = src && Array.isArray(src.buffs) && src.buffs.some(b => b && Number(b.remaining) > 0 && Array.isArray(b.tags) && b.tags.some(t => this.INTERRUPT_CC_TAGS.has(String(t).toLowerCase())));
            if (interrupted) {
              this.log?.(`${src.name || 'The enemy'}'s ${impact.name || 'attack'} is interrupted!`);
            } else if (Number(impact.damage) > 0) {
              this.enemyAoeDamage?.(center.x, center.y, impact.radius, impact.damage, src, impact.color, impact.aoeOptions || {});
            } else if (impact.status) {
              this.enemyAoeStatus?.(center.x, center.y, impact.radius, impact.status, src);
            }
          }
        }
        this.pendingSpellImpacts = remaining;
      };



      Game.prototype.wardenThreatMultiplier = function(actor = this.player) {
        let mult = 1;
        for (const effect of actor?.buffs || []) {
          if (!effect || effect.remaining <= 0) continue;
          if (Number(effect.threatGenerationMultiplier || 0) > 0) mult *= Number(effect.threatGenerationMultiplier);
        }
        return mult;
      };

      Game.prototype.applyWardenThreat = function(enemy, baseDamage = 0, spell = {}) {
        if (!enemy || !this.player || !this.addThreat) return;
        const mult = Number(spell.threatMultiplier || 1) * (this.wardenThreatMultiplier?.(this.player) || 1);
        const extra = Math.max(0, Math.floor(Number(baseDamage || 0) * Math.max(0, mult - 1) + Number(spell.flatThreat || 0)));
        if (extra > 0) this.addThreat(enemy, this.player, extra, { reason: `${spell.name || 'warden'}-bonus-threat` });
        const leadPct = Number(spell.tauntLeadPct || spell.threatLeadPct || 0);
        if (leadPct > 0 && this.highestThreatValue) {
          const desired = (this.highestThreatValue(enemy) || 0) * leadPct;
          const table = enemy.threatTable || enemy.threat || null;
          const key = String(this.player.id || 'player');
          const entry = table instanceof Map ? (table.get(key) || { threat: 0 }) : (table?.[key] || { threat: 0 });
          if (entry && entry.threat < desired) this.addThreat(enemy, this.player, Math.floor(desired - entry.threat), { reason: `${spell.name || 'warden'}-threat-lead` });
        }
      };

      Game.prototype.resolveWardenRevampSpell = function(spell, options = {}) {
        const p = this.player;
        if (!p) return;
        const id = spell.wardenSpellId || normalizeSpellIconKey(spell);
        const color = spell.color || '#8fcf70';
        const selected = options.target || this.findSpellActorById?.(options.targetId) || this.getTarget?.();
        const hostile = (range = spell.range || 2) => {
          const resolved = this.resolveHostileSpellTarget?.(spell, selected, { range });
          if (!resolved?.ok) return null;
          const t = resolved.target; p.setFacingFromDelta?.(t.x - p.x, t.y - p.y); return t;
        };
        const allyTarget = (range = spell.range || 7) => this.getFriendlySpellTarget?.(range) || (selected && this.isFriendlyTarget?.(selected) ? selected : null) || p;
        const enemiesIn = (cx, cy, radius) => (this.queryEnemiesNearPoint?.(cx, cy, radius + 0.5) || this.enemies || []).filter(enemy => enemy && enemy.alive && this.isHostileTarget?.(enemy) && distFn(enemy, { x: cx, y: cy }) <= radius);
        const applyBuff = (target, data = {}) => this.applyStatusEffect?.(target, this.decorateStatusEffectFromSpell(spell, {
          id: data.id || `warden_${id}`, name: data.name || spell.buffName || spell.name, type: 'buff', duration: Number(data.duration ?? spell.duration ?? 300),
          stacks: Number(data.stacks ?? data.charges ?? spell.charges ?? 1), maxStacks: Number(data.maxStacks ?? data.stacks ?? data.charges ?? spell.charges ?? 1),
          mods: data.mods || spell.mods || {}, color, hostile: false, description: data.description || spell.description, ...data
        }), p);
        const hit = (enemy, amount = null) => {
          const dmg = Math.max(1, Math.floor(amount ?? (this.scaledSpellValue?.(spell) || Number(spell.power || 0))));
          const dealt = this.damageEntity?.(enemy, dmg, p, color, { damageType: spell.damageType || 'nature', spellName: spell.name, threatMultiplier: Number(spell.threatMultiplier || 1) }) || dmg;
          this.applyWardenThreat?.(enemy, dealt, spell);
          return dealt;
        };
        if (id === 'stonehand_strike') { const t = hostile(1.9); if (!t) return; hit(t, (spell.flatDamage || 12) + Math.max(1, Number(p.attack || 8)) * Number(spell.weaponDamageMultiplier || 1)); this.log(`Stonehand Strike locks ${t.name || 'target'} onto you.`); return; }
        if (id === 'barkskin') { applyBuff(p, { id: 'warden_barkskin', tags: ['warden','bark','physical'], consumeOnHit: true, physicalDamageTakenMultiplier: 0.86, stacks: 6, maxStacks: 6 }); this.applyWardenThreat?.(this.getTarget?.(), 0, spell); this.spawnRing?.(p.x, p.y, color, 14); this.log('Barkskin hardens your hide.'); return; }
        if (id === 'root_grasp') { let count = 0; for (const enemy of enemiesIn(p.x, p.y, Number(spell.radius || 7)).slice(0, spell.targetCap || 5)) { hit(enemy); this.applyStatusEffect?.(enemy, this.decorateStatusEffectFromSpell(spell, { id: 'warden_root_grasp', name: 'Root Grasp', type: 'debuff', duration: Number(spell.duration || 6), color, hostile: true, moveSpeedMultiplier: 0.65, mods: { speed: -0.35 }, tags: ['warden','root','snare'], description: spell.description }), p); count++; } this.spawnRing?.(p.x, p.y, color, 22); this.log(`Root Grasp controls ${count} enemies.`); return; }
        if (id === 'thorn_guard') { applyBuff(p, { id: 'warden_thorn_guard', duration: 1800, stacks: 1, retaliationDamage: spell.retaliationDamage || 5, retaliationThreatMultiplier: 3, tags: ['warden','thorn','retaliation'] }); this.spawnRing?.(p.x, p.y, color, 14); this.log('Thorn Guard bristles around you.'); return; }
        if (id === 'earthen_roar') { let count = 0; for (const enemy of enemiesIn(p.x, p.y, spell.radius || 10).slice(0, spell.targetCap || 6)) { this.tauntEnemy?.(enemy, p, Number(spell.tauntDuration || 6), Number(spell.flatThreat || 50)); this.applyWardenThreat?.(enemy, 0, spell); this.applyStatusEffect?.(enemy, this.decorateStatusEffectFromSpell(spell, { id: 'warden_earthen_roar_weakened', name: 'Earthen Roar', type: 'debuff', duration: 8, color, hostile: true, damageDoneMultiplier: 0.92, mods: { attack: -0.08 }, tags: ['warden','taunt','weaken'] }), p); count++; } this.spawnRing?.(p.x, p.y, color, 24); this.log(`Earthen Roar challenges ${count} enemies.`); return; }
        if (id === 'grove_mend') { applyBuff(p, { id: 'warden_grove_mend', name: 'Grove Mend', type: 'hot', duration: 300, tickRate: 5, periodicHealing: this.scaledSpellValue?.(spell, 'periodicHealing', 'periodicHealingScale') || 8, healingCapPct: 0.22, tags: ['warden','regen'] }); this.log('Grove Mend begins regenerating you.'); return; }
        if (id === 'stonehide') { applyBuff(p, { id: 'warden_stonehide', tags: ['warden','stone'], consumeOnHit: true, damageTakenMultiplier: 0.75, stacks: 4, maxStacks: 4 }); this.applyWardenThreat?.(this.getTarget?.(), 0, spell); this.spawnRing?.(p.x, p.y, color, 16); this.log('Stonehide plates your body.'); return; }
        if (id === 'briar_lash') { const t = hostile(spell.range || 5.5); if (!t) return; const dealt = hit(t); this.applyStatusEffect?.(t, this.decorateStatusEffectFromSpell(spell, { id: 'warden_briar_lash_slow', name: 'Briar Lash', type: 'debuff', duration: 5, color, hostile: true, moveSpeedMultiplier: 0.65, mods: { speed: -0.35 }, tags: ['warden','slow'] }), p); this.spawnBolt?.(p, t, color); this.log(`Briar Lash hits ${t.name || 'target'} for ${dealt}.`); return; }
        if (id === 'wild_fortitude') { const a = allyTarget(spell.range || 7); applyBuff(a, { id: 'warden_wild_fortitude', duration: 3600, stacks: 1, mods: spell.mods || { maxHpPct: 0.08, resist: 15 }, tags: ['warden','fortitude'] }); this.spawnRing?.(a.x, a.y, color, 12); this.log(`Wild Fortitude strengthens ${a.name || 'ally'}.`); return; }
        if (id === 'living_wall') { const allies = (this.friendlyTargetsForSpell?.(spell.radius || 6) || [p]).slice(0, 6); for (const a of allies) applyBuff(a, { id: 'warden_living_cover', name: 'Living Cover', duration: 300, stacks: 6, rangedDamageTakenMultiplier: 0.88, tags: ['warden','cover'] }); this.spawnRing?.(p.x, p.y, color, 20); this.log(`Living Wall shelters ${allies.length} allies.`); return; }
        if (id === 'quaking_challenge') { const center = selected && selected.x != null ? selected : p; let count = 0; for (const enemy of enemiesIn(center.x, center.y, spell.radius || 8).slice(0, spell.targetCap || 6)) { hit(enemy); this.applyStatusEffect?.(enemy, this.decorateStatusEffectFromSpell(spell, { id: 'warden_quaking_stagger', name: 'Quaking Challenge', type: 'debuff', duration: Number(spell.staggerDuration || 0.5), color, hostile: true, moveSpeedMultiplier: 0.2, tags: ['warden','stagger'] }), p); count++; } this.spawnRing?.(center.x, center.y, color, 24); this.log(`Quaking Challenge shakes ${count} enemies.`); return; }
        if (id === 'ancient_pulse') { const allies = (this.friendlyTargetsForSpell?.(spell.radius || 12) || [p]).slice(0, spell.targetCap || 6); for (const a of allies) applyBuff(a, { id: a === p ? 'warden_ancient_pulse_self' : 'warden_ancient_pulse_ally', name: 'Ancient Pulse', type: 'hot', duration: 300, tickRate: 5, periodicHealing: a === p ? Number(spell.heal || 12) : Number(spell.allyHeal || 5), healingCapPct: a === p ? 0.20 : 0.08, tags: ['warden','pulse','regen'] }); this.spawnRing?.(p.x, p.y, color, 20); this.log(`Ancient Pulse sustains ${allies.length} allies.`); return; }
        if (id === 'ironroot_stance') { applyBuff(p, { id: 'warden_ironroot_stance', duration: 3600, stacks: 1, threatGenerationMultiplier: 1.25, damageTakenMultiplier: 0.95, damageDoneMultiplier: 0.94, moveSpeedMultiplier: 0.90, knockbackResistance: 0.60, tags: ['warden','stance','tank'] }); this.spawnRing?.(p.x, p.y, color, 16); this.log('Ironroot Stance active.'); return; }
        if (id === 'thornsnare') { const t = hostile(spell.range || 5); if (!t) return; hit(t, this.scaledSpellValue?.(spell, 'triggerDamage', 'levelScale') || spell.power || 70); this.applyStatusEffect?.(t, this.decorateStatusEffectFromSpell(spell, { id: 'warden_thornsnare', name: 'Thornsnare', type: 'debuff', duration: 4, color, hostile: true, moveSpeedMultiplier: 0.1, mods: { speed: -0.9 }, tags: ['warden','trap','root'] }), p); this.log(`${t.name || 'Target'} is caught in Thornsnare.`); return; }
        if (id === 'mountain_s_patience') { applyBuff(p, { id: 'warden_mountains_patience', duration: 300, stacks: 5, maxStacks: 5, burstThresholdPct: 0.12, delayedDamagePct: 0.30, delayedDamageWindow: 10, tags: ['warden','smoothing'] }); this.spawnRing?.(p.x, p.y, color, 18); this.log("Mountain's Patience steadies incoming burst."); return; }
        if (id === 'grove_shelter') { const allies = (this.friendlyTargetsForSpell?.(spell.radius || 14) || [p]).slice(0, spell.targetCap || 6); for (const a of allies) applyBuff(a, { id: 'warden_grove_shelter', name: 'Grove Shelter', duration: 300, stacks: 8, damageTakenMultiplier: 0.85, tags: ['warden','grove','protection'] }); this.spawnRing?.(p.x, p.y, color, 28); this.log(`Grove Shelter protects ${allies.length} allies.`); return; }
        if (id === 'primal_guard') { const a = allyTarget(spell.range || 6.25); applyBuff(a, { id: 'warden_primal_guard', duration: 300, stacks: 6, damageRedirectPct: 0.30, redirectActorId: p.id, flatThreatPerRedirect: 65, tags: ['warden','guard','redirect'] }); this.spawnRing?.(a.x, a.y, color, 14); this.log(`Primal Guard redirects harm from ${a.name || 'ally'}.`); return; }
        if (id === 'heart_of_the_grove') { applyBuff(p, { id: 'warden_heart_of_the_grove', duration: 300, stacks: 1, regenHealingMultiplier: 1.20, lowHpRegenHealingMultiplier: 1.45, lowHpThornDamageMultiplier: 1.60, tags: ['warden','sustain'] }); this.spawnRing?.(p.x, p.y, color, 22); this.log('Heart of the Grove awakens.'); return; }
        if (id === 'titanroot') { applyBuff(p, { id: 'warden_titanroot', duration: 300, stacks: 8, damageTakenMultiplier: 0.65, moveSpeedMultiplier: 0.0, healingReceivedMultiplier: 1.15, threatGenerationMultiplier: 1.30, tags: ['warden','rooted','survival'] }); this.spawnRing?.(p.x, p.y, color, 22); this.log('Titanroot anchors you in place.'); return; }
        if (id === 'ancient_warden_form') { applyBuff(p, { id: 'warden_ancient_form', duration: 300, stacks: 1, maxHpMultiplier: 1.18, threatGenerationMultiplier: 1.75, regenHealingMultiplier: 1.40, controlDurationMultiplier: 1.30, thornTargetsPerSecond: 2, moveSpeedMultiplier: 0.92, tags: ['warden','form','capstone'] }); this.spawnRing?.(p.x, p.y, color, 30); this.log('Ancient Warden Form transforms you.'); return; }
        const fallback = hostile(spell.range || 7); if (fallback) hit(fallback);
      };

      Game.prototype.isWizardShatterSetup = function(target) {
        return Boolean(target?.buffs?.some?.(buff => buff && buff.remaining > 0 && /chill|frost|ice|nova|prison|root|shatter/i.test(`${buff.id || ''} ${buff.name || ''} ${buff.tags || ''}`)));
      };

      Game.prototype.resolveWizardRevampSpell = function(spell, options = {}) {
        const p = this.player;
        if (!p) return;
        const id = spell.wizardSpellId || normalizeSpellIconKey(spell);
        const color = spell.color || '#6fa8ff';
        // V0.20.28: the Wizard's element, so a Fireball burns and a Frost Nova freezes instead of all
        // sharing the wizard-blue rune. Derived from damageType + tags + id (buff.color lies - Ignite
        // ships blue - the same finding as the DoT plume, so we never key off color).
        const wizElement = (() => {
          const key = `${id} ${String(spell.damageType || '')} ${Array.isArray(spell.tags) ? spell.tags.join(' ') : ''}`.toLowerCase();
          if (/fire|flame|ignite|meteor|inferno|ember|burn/.test(key)) return 'fire';
          if (/frost|ice|chill|freeze|shatter|glacial|nova/.test(key)) return 'frost';
          if (/storm|lightning|shock|spark|thunder|tempest/.test(key)) return 'lightning';
          return 'arcane';
        })();
        const wizBurst = (x, y, radius) => this.spawnWizardElementEffect?.(x, y, wizElement, { radius: Math.max(14, Number(radius) || 26) });
        const selected = options.target || this.findSpellActorById?.(options.targetId) || this.getTarget?.();
        const hostile = (range = spell.range || 7.5) => { const r = this.resolveHostileSpellTarget?.(spell, selected, { range }); if (!r?.ok) return null; const t = r.target; p.setFacingFromDelta?.(t.x - p.x, t.y - p.y); return t; };
        const enemiesIn = (cx, cy, radius) => (this.queryEnemiesNearPoint?.(cx, cy, radius + 0.5) || this.enemies || []).filter(enemy => enemy && enemy.alive && this.isHostileTarget?.(enemy) && distFn(enemy, { x: cx, y: cy }) <= radius);
        const allyTarget = (range = spell.range || 7) => this.getFriendlySpellTarget?.(range) || (selected && this.isFriendlyTarget?.(selected) ? selected : null) || p;
        const consume = (statusId) => this.consumePlayerBuffCharge?.(statusId, 1);
        const spellMultiplier = (school) => {
          let mult = 1;
          for (const effect of p.buffs || []) {
            if (!effect || effect.remaining <= 0) continue;
            if (effect.id === 'wizard_overchannel') mult *= Number(effect.spellDamageMultiplier || 1.22);
            if (effect.id === 'wizard_prismatic_surge') {
              if (school === 'fire') mult *= 1.08;
              if (school === 'frost') mult *= 1.06;
              if (school === 'arcane') mult *= 1.06;
            }
          }
          return mult;
        };
        const damage = (enemy, amount = null, extra = {}) => {
          let dmg = Math.max(1, Math.floor(amount ?? (this.scaledSpellValue?.(spell) || Number(spell.power || 0))));
          if (extra.shatter && this.isWizardShatterSetup?.(enemy)) dmg = Math.floor(dmg * (1 + Number(extra.shatterBonus || spell.frozenBonus || 0.35)));
          if (enemy?.buffs?.some?.(b => b && b.remaining > 0 && b.id === 'wizard_ignite') && Number(spell.igniteBonus || 0) > 0) dmg = Math.floor(dmg * (1 + Number(spell.igniteBonus || 0)));
          dmg = Math.floor(dmg * spellMultiplier(spell.school || extra.school || 'arcane'));
          const dealt = this.damageEntity?.(enemy, dmg, p, color, { damageType: extra.damageType || spell.damageType || 'magic', spellName: spell.name, canCrit: true }) || dmg;
          if (p.buffs?.some?.(b => b?.id === 'wizard_overchannel' && b.remaining > 0)) consume('wizard_overchannel');
          if (p.buffs?.some?.(b => b?.id === 'wizard_time_slip' && b.remaining > 0)) consume('wizard_time_slip');
          if (p.buffs?.some?.(b => b?.id === 'wizard_prismatic_surge' && b.remaining > 0)) consume('wizard_prismatic_surge');
          return dealt;
        };
        const dot = (enemy, statusId, tick, duration, damageType = spell.damageType || 'magic') => this.applyStatusEffect?.(enemy, this.decorateStatusEffectFromSpell(spell, { id: statusId, name: spell.name, type: 'dot', duration, tickRate: Number(spell.tickRate || 2), periodicDamage: Math.max(1, Math.floor(tick)), damageType, color, hostile: true, tags: ['wizard', damageType], description: spell.description }), p);
        const buff = (target, data = {}) => this.applyStatusEffect?.(target, this.decorateStatusEffectFromSpell(spell, { id: data.id || `wizard_${id}`, name: data.name || spell.buffName || spell.name, type: 'buff', duration: Number(data.duration ?? spell.duration ?? 300), stacks: Number(data.stacks ?? data.charges ?? spell.charges ?? 1), maxStacks: Number(data.maxStacks ?? data.stacks ?? data.charges ?? spell.charges ?? 1), mods: data.mods || spell.mods || {}, color, hostile: false, description: data.description || spell.description, ...data }), p);

        if (id === 'mana_shield') { const absorb = Math.floor(Number(spell.absorbBase || 70) + Math.max(1, Number(p.maxMana || p.mana || 100)) * Number(spell.absorbManaPct || 0.20)); buff(p, { id: 'wizard_mana_shield', absorbRemaining: absorb, stacks: 1, tags: ['wizard','shield','arcane'] }); this.spawnRing?.(p.x, p.y, color, 16); this.log(`Mana Shield absorbs up to ${absorb} damage.`); return; }
        if (id === 'arcane_intellect') { const a = allyTarget(spell.range || 6.25); buff(a, { id: 'wizard_arcane_intellect', duration: 3600, stacks: 1, mods: spell.mods || { maxManaPct: 0.10, spellCrit: 0.04 }, tags: ['wizard','intellect'] }); this.spawnRing?.(a.x, a.y, color, 12); this.log(`Arcane Intellect empowers ${a.name || 'ally'}.`); return; }
        // V0.19.7: `Number(p.facingX || 1)` blinked a north/south-facing wizard 45 degrees off-course.
        if (id === 'blink') { const { x: fx, y: fy } = this.actorFacingVector(p); const len = Math.hypot(fx, fy) || 1; const d = Math.min(3, Number(spell.range || 3)); p.x += (fx / len) * d; p.y += (fy / len) * d; this.cleanseStatusEffects?.(p, { tags: ['root','snare','slow'] }); buff(p, { id: 'wizard_blink_residue', stacks: 1, controlResistancePct: 0.20, tags: ['wizard','blink'] }); this.spawnRing?.(p.x, p.y, color, 16); this.log('Blink shifts you through space.'); return; }
        if (id === 'overchannel') { buff(p, { id: 'wizard_overchannel', stacks: 10, spellDamageMultiplier: 1.22, manaCostMultiplier: 1.25, tags: ['wizard','overchannel'] }); this.spawnRing?.(p.x, p.y, color, 18); this.log('Overchannel floods your spellwork.'); return; }
        if (id === 'arcane_mirror') { const cap = Math.floor(Number(spell.spellAbsorbCap || 220) + Math.max(1, Number(p.maxMana || p.mana || 100)) * Number(spell.absorbManaPct || 0.25)); buff(p, { id: 'wizard_arcane_mirror', stacks: 1, spellAbsorbRemaining: cap, reflectPreventedPct: 0.25, tags: ['wizard','mirror'] }); this.spawnRing?.(p.x, p.y, color, 18); this.log('Arcane Mirror waits for the next hostile spell.'); return; }
        if (id === 'time_slip') { buff(p, { id: 'wizard_time_slip', stacks: 8, castSpeedMultiplier: 0.80, moveSpeedMultiplier: 1.15, gcdReduction: 0.2, tags: ['wizard','time'] }); this.spawnRing?.(p.x, p.y, color, 18); this.log('Time Slip accelerates your casting.'); return; }
        if (id === 'prismatic_surge') { buff(p, { id: 'wizard_prismatic_surge', stacks: 12, activeSurge: 'fire', tags: ['wizard','prismatic'] }); this.spawnRing?.(p.x, p.y, color, 22); this.log('Prismatic Surge begins rotating through your spell schools.'); return; }

        if (id === 'frost_nova') { let count = 0; for (const e of enemiesIn(p.x, p.y, spell.radius || 9).slice(0, spell.targetCap || 6)) { damage(e); this.applyStatusEffect?.(e, this.decorateStatusEffectFromSpell(spell, { id: 'wizard_frost_nova_chill', name: 'Frost Nova', type: 'debuff', duration: 5, color, hostile: true, moveSpeedMultiplier: 0.1, mods: { speed: -0.9 }, tags: ['wizard','frost','chilled','shatter_setup'] }), p); count++; } this.spawnRing?.(p.x, p.y, color, 24); wizBurst(p.x, p.y, 34); this.log(`Frost Nova chills ${count} enemies.`); return; }
        if (id === 'meteorfall' || id === 'archwizard_s_cataclysm') { const center = hostile(spell.range || 8.75) || selected || p; this.queuePendingSpellImpact?.({ kind: id === 'meteorfall' ? 'wizard_meteorfall' : 'wizard_cataclysm', delay: Number(spell.impactDelay || (id === 'meteorfall' ? 2 : 1)), center: { x: center.x, y: center.y }, radius: Number(spell.radius || (id === 'meteorfall' ? 7 : 10)), targetCap: Number(spell.targetCap || (id === 'meteorfall' ? 6 : 8)), damage: this.scaledSpellValue?.(spell) || Number(spell.power || 120), tickDamage: this.scaledSpellValue?.(spell, 'tickDamage', 'levelScale') || Number(spell.tickDamage || 18), color, name: spell.name, spell, damageType: spell.damageType || (id === 'meteorfall' ? 'fire' : 'mixed_magic') }); this.spawnRing?.(center.x, center.y, color, id === 'meteorfall' ? 22 : 32); this.log(`${spell.name} warning circle appears.`); return; }
        if (id === 'flame_wave' || id === 'spellstorm' || id === 'fireball') { const center = hostile(spell.range || 7.5) || selected || p; let count = 0; for (const e of enemiesIn(center.x, center.y, spell.radius || 4).slice(0, spell.targetCap || 5)) { const ticks = id === 'spellstorm' ? Number(spell.tickCount || 5) : 1; for (let i = 0; i < ticks; i++) damage(e); if (Number(spell.tickDamage || 0) > 0) dot(e, `wizard_${id}_dot`, this.scaledSpellValue?.(spell, 'tickDamage', 'levelScale') || spell.tickDamage, spell.tickDuration || 6, spell.damageType || 'fire'); count++; } this.spawnRing?.(center.x, center.y, color, 20); wizBurst(center.x, center.y, 30); this.log(`${spell.name} affects ${count} enemies.`); return; }
        const t = hostile(spell.range || 7.5); if (!t) return;
        if (id === 'ice_prison') { damage(t); this.applyStatusEffect?.(t, this.decorateStatusEffectFromSpell(spell, { id: 'wizard_ice_prison', name: 'Ice Prison', type: 'debuff', duration: 5, color, hostile: true, moveSpeedMultiplier: 0.1, mods: { speed: -0.9 }, tags: ['wizard','frost','ice','chilled','shatter_setup'], description: spell.description }), p); wizBurst(t.x, t.y, 22); this.log(`${t.name || 'Target'} is locked in ice.`); return; }
        if (id === 'ignite') { damage(t, spell.power || 18); dot(t, 'wizard_ignite', this.scaledSpellValue?.(spell, 'tickDamage', 'levelScale') || spell.tickDamage || 16, spell.tickDuration || 12, 'fire'); wizBurst(t.x, t.y, 20); this.log(`${t.name || 'Target'} ignites.`); return; }
        if (id === 'arcane_barrage') { let total = 0; for (let i = 0; i < Number(spell.missileCount || 4); i++) total += damage(t, this.scaledSpellValue?.(spell) || spell.power || 22); this.spawnBolt?.(p, t, color); wizBurst(t.x, t.y, 18); this.log(`Arcane Barrage hits ${t.name || 'target'} for ${total} total.`); return; }
        if (id === 'mana_spear') { const dealt = damage(t); this.spawnBolt?.(p, t, color); wizBurst(t.x, t.y, 18); const second = enemiesIn(t.x, t.y, 4).find(e => e !== t); if (second) damage(second, Math.floor(dealt * 0.50)); this.log(`Mana Spear pierces ${t.name || 'target'} for ${dealt}.`); return; }
        if (id === 'shatter') { const dealt = damage(t, null, { shatter: true, shatterBonus: this.isWizardShatterSetup?.(t) ? 0.80 : 0 }); this.spawnStatusPulse?.(t, color, 'Shatter'); wizBurst(t.x, t.y, 24); this.log(`Shatter hits ${t.name || 'target'} for ${dealt}.`); return; }
        if (id === 'frost_lance') { const dealt = damage(t); this.applyStatusEffect?.(t, this.decorateStatusEffectFromSpell(spell, { id: 'wizard_frost_lance_chill', name: 'Chilled', type: 'debuff', duration: 6, color, hostile: true, moveSpeedMultiplier: 0.65, mods: { speed: -0.35 }, tags: ['wizard','frost','chilled','shatter_setup'] }), p); this.spawnBolt?.(p, t, color); wizBurst(t.x, t.y, 18); this.log(`Frost Lance hits ${t.name || 'target'} for ${dealt}.`); return; }
        const dealt = damage(t); this.spawnBolt?.(p, t, color); wizBurst(t.x, t.y, 18); this.log(`${spell.name} hits ${t.name || 'target'} for ${dealt}.`);
      };
      Game.prototype.resolveShamanRevampSpell = function(spell, options = {}) {
        const p = this.player;
        const color = spell.color || '#70e6d3';
        const id = spell.shamanSpellId || normalizeSpellIconKey(spell);
        const selectedTarget = options.target || this.getTarget?.();
        const hostile = (range = spell.range || 7.5) => {
          const resolved = this.resolveHostileSpellTarget?.(spell, selectedTarget, { range });
          if (!resolved?.ok) return null;
          const target = resolved.target;
          p.setFacingFromDelta?.(target.x - p.x, target.y - p.y);
          return target;
        };
        const enemiesNear = (center, radius, cap = 99) => {
          const list = [];
          for (const enemy of (this.queryEnemiesNearPoint?.(center.x, center.y, radius + 0.5) || this.enemies || [])) {
            if (!enemy?.alive || distFn(enemy, center) > radius) continue;
            list.push(enemy);
            if (list.length >= cap) break;
          }
          return list;
        };
        const isStorm = String(spell.school || '').toLowerCase() === 'storm';
        const isEarth = String(spell.school || '').toLowerCase() === 'earth';
        const isSpirit = String(spell.school || '').toLowerCase().includes('spirit');
        // V0.20.29: Shaman bespoke motif from its own school - storm (teal arcs) / earth (amber shards)
        // / spirit (wisps). Derived from school+damageType+id, never buff.color. Default storm.
        const shamanMotif = (() => {
          const key = `${id} ${String(spell.school || '')} ${String(spell.damageType || '')}`.toLowerCase();
          if (isEarth || /earth|stone|rock|quake|mountain/.test(key)) return 'earth';
          if (isSpirit || /spirit|ancestor|ghost/.test(key)) return 'spirit';
          return 'storm';
        })();
        const stormcall = this.shamanActiveStatus?.('shaman_stormcall');
        const avatar = this.shamanActiveStatus?.('shaman_tempest_avatar');
        let base = this.scaledSpellValue?.(spell) || Number(spell.power || 0);
        const scaleDamage = (target) => {
          let dmg = Math.max(0, Math.floor(base));
          if (isStorm && stormcall) dmg = Math.floor(dmg * (1 + Number(stormcall.stormDamageBonus || spell.stormDamageBonus || 0.15)));
          if (avatar) {
            if (isStorm) dmg = Math.floor(dmg * (1 + Number(avatar.stormDamageBonus || 0.18)));
            if (isEarth) dmg = Math.floor(dmg * (1 + Number(avatar.earthDamageBonus || 0.12)));
          }
          if (target && this.isShamanBrandedTarget?.(target)) dmg = Math.floor(dmg * (1 + Number(spell.brandDamageBonus || spell.stormEarthBonus || 0)));
          if (target && target.buffs?.some?.(buff => buff && buff.remaining > 0 && buff.id === 'shaman_earthbind') && Number(spell.earthbindDamageBonus || 0) > 0) dmg = Math.floor(dmg * (1 + Number(spell.earthbindDamageBonus || 0)));
          if (target && target.buffs?.some?.(buff => buff && buff.remaining > 0 && buff.id === 'shaman_quaking_ground') && Number(spell.quakingGroundBonus || 0) > 0) dmg = Math.floor(dmg * (1 + Number(spell.quakingGroundBonus || 0)));
          return Math.max(0, dmg);
        };
        const consumeDamageCharge = () => {
          if (isStorm && stormcall) this.consumeShamanCharge?.('shaman_stormcall');
          if (avatar && (isStorm || isEarth || isSpirit || spell.school === 'primal')) this.consumeShamanCharge?.('shaman_tempest_avatar');
        };
        const hit = (target, amount = null) => {
          const dmg = amount == null ? scaleDamage(target) : amount;
          const dealt = this.damageEntity?.(target, dmg, p, color, { damageType: spell.damageType || 'magic', spellName: spell.name });
          this.spawnBolt?.(p, target, color, { projectile: spell.projectile });
          this.spawnCasterMotifEffect?.(target.x, target.y, shamanMotif, { radius: 20 });
          consumeDamageCharge();
          return dealt || dmg;
        };

        if (id === 'stormcall') {
          this.applyStatusEffect?.(p, this.decorateStatusEffectFromSpell(spell, { id: 'shaman_stormcall', name: 'Stormcall', type: 'buff', duration: 300, stacks: 8, maxStacks: 8, stormDamageBonus: 0.15, stormCritBonus: 0.06, color, hostile: false, tags: ['shaman', 'storm'], description: spell.description }), p);
          this.spawnRing?.(p.x, p.y, color, 18); this.log('Stormcall gathers around you.'); return;
        }
        if (id === 'spirit_walk') {
          this.applyStatusEffect?.(p, this.decorateStatusEffectFromSpell(spell, { id: 'shaman_spirit_walk', name: 'Spirit Walk', type: 'buff', duration: 300, stacks: 4, maxStacks: 4, moveSpeedMultiplier: 1.25, damageTakenMultiplier: 0.85, controlResistancePct: 0.30, color, hostile: false, tags: ['shaman', 'spirit', 'movement'], description: spell.description }), p);
          this.spawnRing?.(p.x, p.y, color, 18); this.log('You step partly into the spirit world.'); return;
        }
        if (id === 'tempest_avatar') {
          this.applyStatusEffect?.(p, this.decorateStatusEffectFromSpell(spell, { id: 'shaman_tempest_avatar', name: 'Tempest Avatar', type: 'buff', duration: 300, stacks: 12, maxStacks: 12, stormDamageBonus: 0.18, earthDamageBonus: 0.12, spiritDotDamageMultiplier: 1.20, manaCostMultiplier: 1.12, color, hostile: false, tags: ['shaman', 'primal'], description: spell.description }), p);
          this.spawnRing?.(p.x, p.y, color, 24); this.log('Tempest Avatar empowers your primal spells.'); return;
        }
        if (id === 'totem_of_sparks') {
          const target = hostile(spell.range || 5) || p;
          p.shamanTotemOfSparks = { x: target.x, y: target.y, remaining: 300, shocks: 10, radius: Number(spell.totemRadius || 8), damage: Number(spell.totemDamage || 16) };
          this.applyStatusEffect?.(p, this.decorateStatusEffectFromSpell(spell, { id: 'shaman_totem_of_sparks', name: 'Totem of Sparks', type: 'buff', duration: 300, stacks: 10, maxStacks: 10, color, hostile: false, tags: ['shaman','totem'], description: spell.description }), p);
          const candidates = enemiesNear(target, Number(spell.totemRadius || 8), 1);
          for (const enemy of candidates) hit(enemy, this.scaledSpellValue?.(spell, 'totemDamage', 'levelScale') || Number(spell.totemDamage || 16));
          this.spawnRing?.(target.x, target.y, color, 20); this.log('Totem of Sparks crackles to life.'); return;
        }
        if (id === 'ancestor_s_brand') {
          const target = hostile(spell.range || 7.5); if (!target) return;
          for (const enemy of this.enemies || []) if (Array.isArray(enemy.buffs)) enemy.buffs = enemy.buffs.filter(buff => !(buff.id === 'shaman_ancestors_brand' && (buff.sourceId == null || buff.sourceId === p.id)));
          this.applyStatusEffect?.(target, this.decorateStatusEffectFromSpell(spell, { id: 'shaman_ancestors_brand', name: 'Ancestor’s Brand', type: 'debuff', duration: 20, color, hostile: true, spiritDamageTakenBonus: 0.15, stormEarthBonus: 0.12, tags: ['shaman', 'brand', 'spirit'], description: spell.description }), p);
          this.spawnStatusPulse?.(target, color, 'Ancestor’s Brand'); this.log(`${target.name || 'Target'} is branded by ancestral wrath.`); return;
        }
        if (id === 'ancestral_cataclysm') {
          const center = hostile(spell.range || 8.75); if (!center) return;
          this.spawnRing?.(center.x, center.y, color, 32);
          this.queuePendingSpellImpact?.({ kind: 'shaman_cataclysm', delay: Number(spell.impactDelay || 1), center: { x: center.x, y: center.y }, radius: Number(spell.radius || 10), targetCap: Number(spell.targetCap || 8), damage: this.scaledSpellValue?.(spell) || 430, color, name: spell.name, spell });
          this.log('Ancestral Cataclysm gathers. Impact in 1 second.'); return;
        }
        if (id === 'chain_storm') {
          const first = hostile(spell.range || 7.5); if (!first) return;
          let current = first, mults = [1, Number(spell.chainSecondMultiplier || 0.70), Number(spell.chainThirdMultiplier || 0.45)], hitIds = new Set();
          for (let i = 0; i < Math.min(3, Number(spell.chainLimit || 3)); i++) {
            if (!current || hitIds.has(current.id)) break;
            hitIds.add(current.id);
            hit(current, Math.floor(scaleDamage(current) * mults[i]));
            current = (this.enemies || []).find(enemy => enemy?.alive && !hitIds.has(enemy.id) && distFn(enemy, current) <= Number(spell.chainRadius || 8));
          }
          this.log(`Chain Storm jumps through ${hitIds.size} enemies.`); return;
        }
        if (['quaking_ground','ritual_inferno','thunderclap','mountain_s_wrath'].includes(id)) {
          const center = hostile(spell.range || 7.5); if (!center) return;
          const targets = enemiesNear(center, Number(spell.radius || 8), Number(spell.targetCap || 6));
          for (const enemy of targets) {
            hit(enemy, scaleDamage(enemy));
            if (Number(spell.tickDamage || 0) > 0) this.applyShamanDot?.(enemy, spell, this.scaledSpellValue?.(spell, 'tickDamage', 'levelScale') || spell.tickDamage, spell.duration || spell.tickDuration || 8, spell.tickRate || 2, spell.damageType);
            if (id === 'quaking_ground') this.applyStatusEffect?.(enemy, this.decorateStatusEffectFromSpell(spell, { id: 'shaman_quaking_ground', name: 'Quaking Ground', type: 'debuff', duration: Number(spell.duration || 8), color, hostile: true, moveSpeedMultiplier: 0.70, mods: { speed: -0.30 }, tags: ['shaman','earth','slow'] }), p);
            if (Number(spell.staggerDuration || 0) > 0) this.applyStatusEffect?.(enemy, this.decorateStatusEffectFromSpell(spell, { id: `shaman_${id}_stagger`, name: 'Staggered', type: 'debuff', duration: Number(spell.staggerDuration || 0.5), color, hostile: true, mods: { speed: -999 }, tags: ['shaman','stagger'] }), p);
          }
          this.spawnRing?.(center.x, center.y, color, 24); this.log(`${spell.name} hits ${targets.length} enemies.`); return;
        }
        const target = hostile(spell.range || 7.5); if (!target) return;
        const dealt = hit(target);
        if (id === 'earthbind') this.applyStatusEffect?.(target, this.decorateStatusEffectFromSpell(spell, { id: 'shaman_earthbind', name: 'Earthbind', type: 'debuff', duration: 7, color, hostile: true, moveSpeedMultiplier: 0.60, mods: { speed: -0.40 }, tags: ['shaman','earth','slow'], description: spell.description }), p);
        if (Number(spell.staggerDuration || 0) > 0) this.applyStatusEffect?.(target, this.decorateStatusEffectFromSpell(spell, { id: `shaman_${id}_stagger`, name: 'Staggered', type: 'debuff', duration: Number(spell.staggerDuration || 0.5), color, hostile: true, mods: { speed: -999 }, tags: ['shaman','stagger'] }), p);
        if (Number(spell.tickDamage || 0) > 0) this.applyShamanDot?.(target, spell, this.scaledSpellValue?.(spell, 'tickDamage', 'levelScale') || spell.tickDamage, spell.tickDuration || spell.duration || 10, spell.tickRate || 2, spell.damageType);
        if (id === 'ghostfire') {
          const nearby = (this.enemies || []).find(enemy => enemy?.alive && enemy.id !== target.id && distFn(enemy, target) <= Number(spell.spreadRadius || 8) && (enemy.hp || 0) / Math.max(1, enemy.maxHp || 1) <= Number(spell.spreadBelowHpPct || 0.5));
          if (nearby) this.applyShamanDot?.(nearby, { ...spell, tickDamage: Math.floor(Number(spell.tickDamage || 18) * Number(spell.spreadMultiplier || 0.70)) }, Math.floor(Number(spell.tickDamage || 18) * Number(spell.spreadMultiplier || 0.70)), spell.tickDuration || 12, spell.tickRate || 2, spell.damageType);
        }
        this.log(`${spell.name} hits ${target.name || 'target'} for ${dealt}.`);
      };

      Game.prototype.summonerTemporarySummons = function() {
        const p = this.player;
        return (this.entities || []).filter(entity => entity && entity.alive !== false && entity.temporaryPet === true && String(entity.ownerId || '') === String(p?.id || p?.botId || p?.remoteId || ''));
      };

      Game.prototype.spawnSummonerTemporarySummons = function(spell, target = null, countOverride = null) {
        const p = this.player;
        const PetClass = DR.entities?.Pet || window.Pet;
        if (!PetClass) { this.log('No pet entity available.'); return []; }
        const count = Math.max(1, Math.floor(Number(countOverride ?? spell.tempMinionCount ?? 1)));
        const created = [];
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i / count) + 0.32;
          const minion = new PetClass(p.x + Math.cos(angle) * 0.85, p.y + Math.sin(angle) * 0.85, p, {
            name: spell.legionGate ? `Legion Ally ${i + 1}` : (spell.lesserSummon ? 'Lesser Planar Twin' : (spell.petType === 'elemental_servitor' ? 'Elemental Servitor' : `Minor Familiar ${i + 1}`)),
            petName: spell.legionGate ? `Legion Ally ${i + 1}` : (spell.lesserSummon ? 'Lesser Planar Twin' : (spell.petType === 'elemental_servitor' ? 'Elemental Servitor' : `Minor Familiar ${i + 1}`)),
            petType: spell.petType || 'shard', color: spell.color || '#9ff7ed', petColor: spell.color || '#9ff7ed',
            hp: spell.lesserSummon ? 90 : 65, maxHp: spell.lesserSummon ? 90 : 65,
            attack: 10, attackDamageMin: Number(spell.petAttackMin || 8), attackDamageMax: Number(spell.petAttackMax || 12),
            attackIntervalSeconds: Number(spell.petAttackSpeed || 1.8), temporaryPet: true, temporaryLife: Number(spell.tempMinionDuration || 300),
            level: p.level || 1, zone: this.currentZone || p.zone || 'dark_woods', command: target ? 'attack' : 'assist', commandState: target ? 'attack' : 'assist'
          });
          if (target) minion.forcedTargetId = target.id;
          minion.remainingAttacks = Number(spell.tempMinionAttackLimit || spell.charges || 6);
          this.entities = Array.isArray(this.entities) ? this.entities : [];
          this.entities.push(minion);
          created.push(minion);
        }
        return created;
      };

      Game.prototype.resolveSummonerRevampSpell = function(spell, options = {}) {
        const p = this.player;
        const color = spell.color || '#9ff7ed';
        const id = spell.summonerSpellId || normalizeSpellIconKey(spell);
        const selectedTarget = options.target || this.getTarget?.();
        const hostile = (range = spell.range || 7.5) => {
          const resolved = this.resolveHostileSpellTarget?.(spell, selectedTarget, { range });
          if (!resolved?.ok) return null;
          const target = resolved.target;
          p.setFacingFromDelta?.(target.x - p.x, target.y - p.y);
          return target;
        };
        const activeSummons = () => [this.pet, ...this.summonerTemporarySummons?.() || []].filter(actor => actor && actor.alive !== false);
        const targetHasBind = target => Boolean(target?.buffs?.some?.(buff => buff && buff.remaining > 0 && buff.id === 'summoner_bound_essence' && (buff.sourceId == null || buff.sourceId === p.id)));
        const petAttackingTarget = target => Boolean(this.pet?.alive && target && (String(this.pet.forcedTargetId || this.pet.targetId || '') === String(target.id) || distFn(this.pet, target) <= Math.max(2, Number(this.pet.autoAttackRangeTiles || 2) + 1)));
        const damage = (target, amount = null, options = {}) => {
          let dmg = amount == null ? (this.scaledSpellValue?.(spell) || Number(spell.power || 0)) : Number(amount || 0);
          if (petAttackingTarget(target) && Number(spell.petSynergyDamageBonus || 0) > 0) dmg = Math.floor(dmg * (1 + Number(spell.petSynergyDamageBonus || 0)));
          if (targetHasBind(target) && Number(spell.planarBoltDamageBonus || 0) > 0) dmg = Math.floor(dmg * (1 + Number(spell.planarBoltDamageBonus || 0)));
          const surge = this.getActiveStatusById?.(p, 'summoner_planar_surge');
          if (surge && Number(surge.manaCostMultiplier || 0) > 1 && ['arcane_spark','planar_bolt'].includes(id)) dmg = Math.floor(dmg * 1.02);
          if (dmg > 0) this.spawnCasterMotifEffect?.(target.x, target.y, 'planar', { radius: 20 }); // V0.20.29: Summoner planar rift
          return this.damageEntity?.(target, Math.max(0, Math.floor(dmg)), p, color, { damageType: options.damageType || spell.damageType || 'magic', spellName: spell.name }) || Math.floor(dmg);
        };
        const summonMain = () => {
          const PetClass = DR.entities?.Pet || window.Pet;
          if (!PetClass) { this.log('No pet entity available.'); return null; }
          if (this.pet && this.pet.alive) {
            this.applyStatusEffect?.(this.pet, this.decorateStatusEffectFromSpell(spell, { id: 'summoner_main_duration_refresh', name: 'Summon Familiar', type: 'buff', duration: 3600, color, hostile: false, tags: ['summoner','main_pet'], description: 'Main summon duration refreshed.' }), p);
            this.spawnRing?.(this.pet.x, this.pet.y, color, 12); this.log(`${this.pet.name || 'Familiar'} remains bound to you.`); return this.pet;
          }
          const hp = Math.floor(Number(spell.petHp || 60) + Math.max(1, Number(p.maxHp || p.maxHP || 100)) * Number(spell.petHpPct || 0.45));
          this.pet = new PetClass(p.x + 0.5, p.y + 0.5, p, { name: spell.petName || 'Planar Familiar', petName: spell.petName || 'Planar Familiar', petType: spell.petType || 'shard', color, petColor: color, hp, maxHp: hp, petAttackMin: Number(spell.petAttackMin || 6), petAttackMax: Number(spell.petAttackMax || 10), petAttackSpeed: Number(spell.petAttackSpeed || 2), level: p.level || 1, zone: this.currentZone || p.zone || 'dark_woods', command: 'assist', commandState: 'assist' });
          this.entities = Array.isArray(this.entities) ? this.entities : [];
          this.entities.push(this.pet);
          this.spawnRing?.(p.x, p.y, color, 16); this.playSfx?.('pet_summon', { x: p.x, y: p.y, volume: 0.42, rate: 1.08, cooldown: 0.18 }); this.log(`${this.pet.name} answers your call.`); return this.pet;
        };
        if (id === 'summon_familiar') { summonMain(); return; }
        if (id === 'command_attack') {
          const target = hostile(spell.range || 8.75); if (!target) return;
          const summons = activeSummons(); if (!summons.length) { this.log('No active summon to command.'); return; }
          for (const summon of summons) { summon.forcedTargetId = target.id; summon.command = 'attack'; summon.commandState = 'attack'; }
          this.spawnStatusPulse?.(target, color, 'Command'); this.log(`Your summons attack ${target.name || 'target'}.`); return;
        }
        if (id === 'mend_companion') {
          if (!this.pet || !this.pet.alive) { this.log('No active summon to mend.'); return; }
          const healed = this.healEntity?.(this.pet, Number(spell.petHealTick || 10), true, p) || 0;
          this.applyStatusEffect?.(this.pet, this.decorateStatusEffectFromSpell(spell, { id: 'summoner_mend_companion_hot', name: 'Mend Companion', type: 'hot', duration: Number(spell.petHealDuration || 300), tickRate: Number(spell.petHealTickRate || 3), periodicHealing: Number(spell.petHealTick || 10), healingCapPct: Number(spell.healingCapPct || 0.35), color, hostile: false, tags: ['summoner','pet_heal'], description: spell.description }), p);
          this.spawnRing?.(this.pet.x, this.pet.y, color, 12); this.log(`Mend Companion restores ${healed} health to your summon.`); return;
        }
        if (['empower_beast','elemental_rotation','grand_binding'].includes(id)) {
          if (!this.pet || !this.pet.alive) { this.log('No active summon to empower.'); return; }
          const statusId = id === 'empower_beast' ? 'summoner_empower_beast' : (id === 'grand_binding' ? 'summoner_grand_binding' : 'summoner_elemental_rotation');
          this.applyStatusEffect?.(this.pet, this.decorateStatusEffectFromSpell(spell, { id: statusId, name: spell.name, type: 'buff', duration: Number(spell.duration || 300), stacks: Number(spell.charges || 1), maxStacks: Number(spell.charges || 1), petDamageMultiplier: Number(spell.petDamageMultiplier || 1.0), petAttackSpeedMultiplier: Number(spell.petAttackSpeedMultiplier || 1.0), petMoveSpeedMultiplier: Number(spell.petMoveSpeedMultiplier || 1.0), color, hostile: false, tags: ['summoner','pet_buff'], description: spell.description }), p);
          if (id === 'grand_binding') {
            this.pet.maxHp = Math.floor(Math.max(this.pet.maxHp || this.pet.hp || 1, (this.pet.maxHp || this.pet.hp || 1) * Number(spell.petHpMultiplier || 1.25)));
            this.pet.hp = Math.min(this.pet.maxHp, Math.floor((this.pet.hp || this.pet.maxHp) * Number(spell.petHpMultiplier || 1.25)));
            this.applyStatusEffect?.(p, this.decorateStatusEffectFromSpell(spell, { id: 'summoner_grand_binding_shift', name: 'Grand Binding Shift', type: 'debuff', duration: 300, color: '#7b6ca8', hostile: true, directDamageMultiplier: Number(spell.summonerDirectDamageMultiplier || 0.92), tags: ['summoner','power_shift'], description: 'Direct spell damage reduced while power is shifted into the pet.' }), p);
          }
          this.spawnRing?.(this.pet.x, this.pet.y, color, 18); this.log(`${spell.name} empowers ${this.pet.name || 'your summon'}.`); return;
        }
        if (id === 'protective_bond') {
          this.applyStatusEffect?.(p, this.decorateStatusEffectFromSpell(spell, { id: 'summoner_protective_bond', name: 'Protective Bond', type: 'buff', duration: 300, stacks: 6, maxStacks: 6, damageTakenMultiplier: this.pet?.alive ? 1.0 : 0.92, petRedirectPct: 0.20, redirectDamageMultiplier: 0.85, color, hostile: false, tags: ['summoner','bond'], description: spell.description }), p);
          this.spawnRing?.(p.x, p.y, color, 16); this.log('Protective Bond links you and your summon.'); return;
        }
        if (id === 'soul_link') {
          if (!this.pet || !this.pet.alive) { this.log('Soul Link requires an active summon.'); return; }
          this.applyStatusEffect?.(p, this.decorateStatusEffectFromSpell(spell, { id: 'summoner_soul_link', name: 'Soul Link', type: 'buff', duration: 300, stacks: 8, maxStacks: 8, healingSharePct: 0.25, petHealingSharePct: 0.15, color, hostile: false, tags: ['summoner','bond'], description: spell.description }), p);
          this.applyStatusEffect?.(this.pet, this.decorateStatusEffectFromSpell(spell, { id: 'summoner_soul_link_pet', name: 'Soul Link', type: 'buff', duration: 300, stacks: 8, maxStacks: 8, color, hostile: false, tags: ['summoner','bond'], description: spell.description }), p);
          this.spawnRing?.(p.x, p.y, color, 18); this.log('Soul Link binds you to your summon.'); return;
        }
        if (id === 'planar_gate') {
          const center = hostile(spell.range || 5) || p;
          p.summonerPlanarGate = { x: center.x, y: center.y, remaining: 300, interactions: 8, radius: Number(spell.gateRadius || 12), summonDamageBonus: Number(spell.summonDamageBonus || 0.12) };
          this.applyStatusEffect?.(p, this.decorateStatusEffectFromSpell(spell, { id: 'summoner_planar_gate', name: 'Planar Gate', type: 'buff', duration: 300, stacks: 8, maxStacks: 8, color, hostile: false, tags: ['summoner','gate'], description: spell.description }), p);
          this.spawnRing?.(center.x, center.y, color, 24); this.log('A Planar Gate opens.'); return;
        }
        if (id === 'planar_surge') {
          this.applyStatusEffect?.(p, this.decorateStatusEffectFromSpell(spell, { id: 'summoner_planar_surge', name: 'Planar Surge', type: 'buff', duration: 300, stacks: 15, maxStacks: 15, manaCostMultiplier: 1.10, tempSummonDamageMultiplier: 1.15, color, hostile: false, tags: ['summoner','surge'], description: spell.description }), p);
          if (this.pet?.alive) this.applyStatusEffect?.(this.pet, this.decorateStatusEffectFromSpell(spell, { id: 'summoner_planar_surge_pet', name: 'Planar Surge', type: 'buff', duration: 300, stacks: 15, maxStacks: 15, petAttackSpeedMultiplier: 0.70, petSpecialDamageMultiplier: 1.20, color, hostile: false, tags: ['summoner','pet_buff'], description: spell.description }), p);
          this.spawnRing?.(p.x, p.y, color, 24); this.log('Planar Surge accelerates your summons.'); return;
        }
        if (id === 'bind_essence') {
          const target = hostile(spell.range || 7.5); if (!target) return;
          for (const enemy of this.enemies || []) if (Array.isArray(enemy.buffs)) enemy.buffs = enemy.buffs.filter(buff => !(buff.id === 'summoner_bound_essence' && (buff.sourceId == null || buff.sourceId === p.id)));
          this.applyStatusEffect?.(target, this.decorateStatusEffectFromSpell(spell, { id: 'summoner_bound_essence', name: 'Bound Essence', type: 'debuff', duration: 18, petDamageTakenBonus: Number(spell.petDamageTakenBonus || 0.18), planarBoltDamageBonus: Number(spell.planarBoltDamageBonus || 0.08), color, hostile: true, tags: ['summoner','bind'], description: spell.description }), p);
          this.spawnStatusPulse?.(target, color, 'Bound Essence'); this.log(`${target.name || 'Target'} is bound to planar force.`); return;
        }
        if (['summon_elemental_servitor','call_swarm','twin_summon','legion_gate'].includes(id)) {
          const target = hostile(spell.range || 7.5) || selectedTarget;
          const created = this.spawnSummonerTemporarySummons?.(spell, target, spell.legionGate ? 9 : null) || [];
          if (spell.legionGate && this.pet?.alive) this.applyStatusEffect?.(this.pet, this.decorateStatusEffectFromSpell(spell, { id: 'summoner_legion_gate_pet', name: 'Legion Gate Empowerment', type: 'buff', duration: 300, stacks: 24, maxStacks: 24, petDamageMultiplier: 1.25, petAttackSpeedMultiplier: 0.80, color, hostile: false, tags: ['summoner','capstone'], description: 'Main summon empowered by Legion Gate.' }), p);
          this.spawnRing?.(p.x, p.y, color, spell.legionGate ? 30 : 18); this.log(`${spell.name} calls ${created.length} temporary summon${created.length === 1 ? '' : 's'}.`); return;
        }
        if (id === 'mass_dismissal') {
          const temps = this.summonerTemporarySummons?.() || [];
          if (!temps.length) { this.log('No temporary summons to dismiss.'); return; }
          let hit = 0;
          for (const temp of temps) {
            for (const enemy of (this.queryEnemiesNearPoint?.(temp.x, temp.y, Number(spell.radius || 4) + 0.5) || this.enemies || [])) {
              if (!enemy?.alive || distFn(enemy, temp) > Number(spell.radius || 4) || hit >= Number(spell.targetCap || 6)) continue;
              damage(enemy, this.scaledSpellValue?.(spell) || Number(spell.power || 45), { damageType: 'planar' });
              hit++;
            }
            temp.alive = false; temp.hidden = true;
          }
          this.entities = (this.entities || []).filter(entity => !(entity && entity.temporaryPet && String(entity.ownerId || '') === String(p.id || '')));
          this.spawnRing?.(p.x, p.y, color, 20); this.log(`Mass Dismissal detonates ${temps.length} temporary summons.`); return;
        }
        if (id === 'familiar_rush') {
          const target = hostile(spell.range || 7.5); if (!target) return;
          if (!this.pet || !this.pet.alive) { this.log('Familiar Rush requires an active summon.'); return; }
          this.pet.forcedTargetId = target.id; this.pet.command = 'attack'; this.pet.commandState = 'attack';
          const dealt = damage(target, this.scaledSpellValue?.(spell) || Number(spell.power || 42), { damageType: 'physical' });
          if (target.casting) target.casting = null;
          this.applyStatusEffect?.(target, this.decorateStatusEffectFromSpell(spell, { id: 'summoner_familiar_rush_interrupt', name: 'Interrupted', type: 'debuff', duration: 2, color, hostile: true, tags: ['summoner','interrupt'], description: 'Interrupted by a familiar rush.' }), p);
          this.spawnBolt?.(this.pet, target, color); this.log(`Familiar Rush hits ${target.name || 'target'} for ${dealt}.`); return;
        }
        if (id === 'overrun') {
          const center = hostile(spell.range || 7.5); if (!center) return;
          const summons = activeSummons(); if (!summons.length) { this.log('Overrun requires active summons.'); return; }
          let strikes = 0;
          for (const enemy of (this.queryEnemiesNearPoint?.(center.x, center.y, Number(spell.radius || 8) + 0.5) || this.enemies || [])) {
            if (!enemy?.alive || distFn(enemy, center) > Number(spell.radius || 8) || strikes >= Number(spell.targetCap || 6)) continue;
            let per = this.scaledSpellValue?.(spell) || Number(spell.power || 38);
            per *= summons.length;
            if (targetHasBind(enemy)) per *= (1 + Number(spell.boundEssenceBonus || 0.20));
            damage(enemy, Math.floor(per), { damageType: 'planar' });
            strikes++;
          }
          this.spawnRing?.(center.x, center.y, color, 24); this.log(`Overrun directs ${summons.length} summons into the fray.`); return;
        }
        const target = hostile(spell.range || 7.5); if (!target) return;
        const dealt = damage(target);
        this.spawnBolt?.(p, target, color, { projectile: spell.projectile });
        this.log(`${spell.name} hits ${target.name || 'target'} for ${dealt}.`);
      };

      // V0.20.21: every class spell for all 13 classes passes through this dispatcher, so it is the
      // one place the caster's identity can be published to the VFX layer without touching the 99
      // spawnRing call sites individually (which would be the cascade the golden rules forbid, and
      // 99 chances to miss the 100th). Restores the previous value rather than clearing, so a spell
      // that resolves another spell cannot strip the outer cast's identity on the way out.
      // V0.20.23: spell.radius does NOT mean one thing. On an aoe kind it is the blast area; on a
      // buff it is the ALLY SEARCH range (Mana Shield authors radius 14 - a blanket conversion would
      // ring the caster in an 834px halo). So the area radius is published for ground-targeted kinds
      // ONLY, and everything else publishes 0 and keeps the stylised pixel ring.
      const SPELL_AREA_KINDS = new Set(['aoe', 'aoeDebuff', 'aoeHeal', 'aoeMelee']);

      // V0.20.35 (Roadmap Item 18): the cast SOUND, chosen from the existing SFX manifest by the
      // spell's element/kind. Wired at the one dispatcher every class spell passes through - the same
      // funnel that carries VFX identity - because before this only 3 spell sites (all pet summons)
      // played anything, so a Fireball, a Cleave and a Mesmerize cast in total silence. Assets that
      // exist limit the palette (no per-element casts), so this differentiates as far as the manifest
      // allows: thunder for storm, a blade for melee, a magic cast for everything else. The IMPACT
      // sounds (hit_thud on bolts, heal_chime on heals) are separate and untouched.
      Game.prototype.spellCastSfxId = function(spell = {}) {
        const key = `${spell.kind || ''} ${spell.damageType || ''} ${Array.isArray(spell.tags) ? spell.tags.join(' ') : ''} ${spell.school || ''}`.toLowerCase();
        if (/lightning|storm|shock|thunder|tempest/.test(key)) return 'thunder_roll';
        if (['melee', 'meleedebuff', 'aoemelee', 'dashstrike'].includes(String(spell.kind || '').toLowerCase()) || /\bphysical|slash|cleave|blade\b/.test(key)) return 'attack_slash';
        return 'magic_cast';
      };

      Game.prototype.resolveClassSpell = function(spell, options = {}) {
        const prevVfxSourceClass = this._spellVfxSourceClass;
        const prevVfxAreaRadius = this._spellVfxAreaRadius;
        this._spellVfxSourceClass = String(this.player?.className || '').toLowerCase();
        this._spellVfxAreaRadius = SPELL_AREA_KINDS.has(String(spell?.kind || '')) ? (Number(spell?.radius) || 0) : 0;
        // V0.20.36: the cast sound is played by spawnCastCue in the cast pipeline (kind-aware via
        // spellCastSfxId), NOT here - playing it here too doubled it. resolveClassSpell is also called
        // directly by item procs / bots that never showed a cast cue, so keeping it silent here is
        // correct: those paths were never meant to announce a player cast.
        try {
          return this.resolveClassSpellDispatch(spell, options);
        } finally {
          this._spellVfxSourceClass = prevVfxSourceClass;
          this._spellVfxAreaRadius = prevVfxAreaRadius;
        }
      };

      Game.prototype.resolveClassSpellDispatch = function(spell, options = {}) {
        const p = this.player;
        const level = p.level || 1;
        const color = spell.color || p.color;
        const power = spell.noLevelScaling ? Number(spell.power || 0) : ((spell.power || 0) + level * 4);
        const target = options.target || this.findSpellActorById?.(options.targetId) || this.getTarget();
        const physicalKinds = new Set(['melee', 'meleeDebuff', 'dashStrike', 'aoeMelee']);
        const damageOptions = { damageType: physicalKinds.has(spell.kind) ? 'physical' : 'magic' };
        const playerClassKey = String(p.className || '').toLowerCase();
        const isNecromancerSpell = playerClassKey === 'necromancer';
        const isBardSpell = playerClassKey === 'bard';
        if (playerClassKey === 'paladin' && spell.paladinSpellId) { this.resolvePaladinRevampSpell?.(spell, { ...options, target }); return; }
        if (playerClassKey === 'fighter' && spell.fighterSpellId) { this.resolveFighterRevampSpell?.(spell, { ...options, target }); return; }
        if (playerClassKey === 'assassin' && spell.assassinSpellId) { this.resolveAssassinRevampSpell?.(spell, { ...options, target }); return; }
        if (playerClassKey === 'bard' && spell.bardSpellId) { this.resolveBardRevampSpell?.(spell, { ...options, target }); return; }
        if (playerClassKey === 'cleric' && spell.clericSpellId) { this.resolveClericRevampSpell?.(spell, { ...options, target }); return; }
        if (playerClassKey === 'druid' && spell.druidSpellId) { this.resolveDruidRevampSpell?.(spell, { ...options, target }); return; }
        if (playerClassKey === 'enchanter' && spell.enchanterSpellId) { this.resolveEnchanterRevampSpell?.(spell, { ...options, target }); return; }
        if (playerClassKey === 'ranger' && spell.rangerSpellId) { this.resolveRangerRevampSpell?.(spell, { ...options, target }); return; }
        if (playerClassKey === 'rogue' && spell.rogueSpellId) { this.resolveRogueRevampSpell?.(spell, { ...options, target }); return; }
        if (playerClassKey === 'warden' && spell.wardenSpellId) { this.resolveWardenRevampSpell?.(spell, { ...options, target }); return; }
        if (playerClassKey === 'wizard' && spell.wizardSpellId) { this.resolveWizardRevampSpell?.(spell, { ...options, target }); return; }
        if (playerClassKey === 'shaman' && spell.shamanSpellId) { this.resolveShamanRevampSpell?.(spell, { ...options, target }); return; }
        if (playerClassKey === 'summoner' && spell.summonerSpellId) { this.resolveSummonerRevampSpell?.(spell, { ...options, target }); return; }
        if (isNecromancerSpell && spell.necroSpellId) {
          this.resolveNecromancerClassSpell?.(spell, { ...options, target });
          return;
        }
        const triggerNecromancerSpellEffect = (spellTarget = null, extra = {}) => {
          if (!isNecromancerSpell || typeof this.spawnNecromancerSpellEffect !== 'function') return;
          this.spawnNecromancerSpellEffect(spell.name, p, spellTarget || null, { spell, color, ...extra });
        };
        const triggerBardSpellEffect = (spellTarget = null, extra = {}) => {
          if (!isBardSpell || typeof this.spawnBardSpellEffect !== 'function') return;
          this.spawnBardSpellEffect(spell.name, p, spellTarget || null, { spell, color, ...extra });
        };

        const requireTarget = (range = 7) => {
          const selectedTarget = target || this.getTarget?.();
          const resolved = this.resolveHostileSpellTarget?.(spell, selectedTarget, { range });
          if (!resolved?.ok) return null;
          const hostileTarget = resolved.target;
          p.setFacingFromDelta(hostileTarget.x - p.x, hostileTarget.y - p.y);
          return hostileTarget;
        };

        const applyHostileStatus = (entity, defaultDuration = 4) => {
          if (!entity || !entity.alive) return;
          const tickDamage = Number(spell.tickDamage || spell.statusDamage || 0);
          const mods = spell.mods || {};
          if (tickDamage > 0 || Object.keys(mods).length) {
            this.applyStatusEffect?.(entity, this.decorateStatusEffectFromSpell(spell, {
              id: spell.statusId || spell.statusName || spell.name,
              name: spell.statusName || spell.name,
              type: tickDamage > 0 ? 'dot' : 'debuff',
              duration: spell.tickDuration || spell.duration || defaultDuration,
              tickRate: tickDamage > 0 ? 2.5 : 0,
              periodicDamage: tickDamage > 0 ? tickDamage + Math.floor(level * 0.5) : 0,
              damageType: physicalKinds.has(spell.kind) ? 'physical' : 'magic',
              mods,
              color,
              hostile: true,
              maxStacks: spell.maxStacks || 1,
              tags: spell.tags || (String(spell.name || '').toLowerCase().includes('snare') ? ['root', 'slow'] : undefined)
            }), p) || entity.addBuff(spell.statusName || spell.name, spell.tickDuration || spell.duration || defaultDuration, mods, { tickDamage: tickDamage + Math.floor(level * 0.5), tickRate: 2.5, color, sourceId: p.id, sourceKind: p.kind, sourceName: p.name, hostile: true });
            this.spawnStatusPulse?.(entity, color, spell.statusName || spell.name);
          }
        };

        const summonPet = () => {
          if (this.pet && this.pet.alive) {
            this.spawnRing(this.pet.x, this.pet.y, color, 12);
            this.log(`${spell.name} reinforces ${this.pet.name}.`);
            return this.pet;
          }
          const PetClass = DR.entities?.Pet || window.Pet;
          if (!PetClass) { this.log('No pet entity available.'); return null; }
          this.pet = new PetClass(p.x + 0.5, p.y + 0.5, p, {
            name: spell.petName || (p.className === 'Necromancer' ? 'Bone Servant' : 'Azure Shard Familiar'),
            petName: spell.petName,
            petType: spell.petType || (p.className === 'Necromancer' ? 'undead' : 'shard'),
            color: spell.petColor || color,
            petColor: spell.petColor || color,
            attack: spell.petAttack || (p.className === 'Necromancer' ? 11 + level : 12 + Math.floor(level * 0.5)),
            hp: spell.petHp || (p.className === 'Necromancer' ? 64 + level * 5 : 58 + level * 3),
            level,
            zone: this.currentZone || p.zone || 'dark_woods',
            command: 'assist',
            commandState: 'assist'
          });
          this.entities.push(this.pet);
          this.spawnRing(p.x, p.y, color, 16);
          this.playSfx?.('pet_summon', { x: p.x, y: p.y, volume: 0.42, rate: p.className === 'Necromancer' ? 0.82 : 1.08, cooldown: 0.18 });
          this.log(`${spell.petName || this.pet.name} answers your command.`);
          return this.pet;
        };

        if (spell.kind === 'summonPet') {
          triggerNecromancerSpellEffect({ x: p.x + 0.5, y: p.y + 0.5 });
          summonPet();
          return;
        }

        if (spell.kind === 'revive') {
          const ally = this.getReviveTarget?.(p);
          if (!this.reviveFriendlyActor?.(ally, {
            caster: p,
            range: spell.range || 6,
            hpPct: spell.reviveHpPct || 0.35,
            manaPct: spell.reviveManaPct || 0.25,
            color,
            label: spell.name
          })) {
            this.log(`${spell.name} failed: select a reachable dead party member.`);
            return;
          }
          this.log(`${spell.name} returns ${ally.name || 'an ally'} to life.`);
          return;
        }

        if (spell.kind === 'cleanse') {
          const ally = this.getFriendlySpellTarget?.(spell.range || 6) || p;
          const removed = this.cleanseStatusEffects?.(ally, { tags: spell.removesStatusTags || ['poison'] }) || [];
          if (!removed.length) {
            this.log(`${ally.name || 'Target'} has no curable poison effect.`);
            return;
          }
          this.spawnRing?.(ally.x, ally.y, color, 12);
          this.spawnStatusPulse?.(ally, color, 'Purified');
          this.log(`${spell.name} removes ${removed.length} poison effect${removed.length === 1 ? '' : 's'} from ${ally.name || 'ally'}.`);
          return;
        }

        if (spell.kind === 'buff') {
          const ally = spell.selfOnly ? p : (this.getFriendlySpellTarget?.(spell.range || 12) || p);
          this.applyStatusEffect?.(ally, this.decorateStatusEffectFromSpell(spell, { id: spell.buffName || spell.name, name: spell.buffName || spell.name, type: 'buff', duration: spell.duration || 8, mods: spell.mods || {}, color, hostile: false }), p) || ally.addBuff(spell.buffName || spell.name, spell.duration || 8, spell.mods || {});
          triggerNecromancerSpellEffect(ally, { duration: spell.duration || 8 });
          triggerBardSpellEffect(ally, { duration: spell.duration || 8, radius: spell.radius || 18, allies: [ally].filter(Boolean) });
          this.spawnRing(ally.x, ally.y, color, spell.radius || 14);
          this.spawnStatusPulse?.(ally, color, spell.name);
          this.log(`${spell.name} applied to ${ally.name || 'ally'}.`);
          return;
        }

        if (spell.kind === 'groupBuff') {
          const allies = this.friendlyTargetsForSpell?.(spell.radius || 18) || [p, this.merc, this.pet].filter(Boolean);
          for (const ally of allies) {
            if (ally && ally.alive) this.applyStatusEffect?.(ally, this.decorateStatusEffectFromSpell(spell, { id: spell.buffName || spell.name, name: spell.buffName || spell.name, type: 'buff', duration: spell.duration || 8, mods: spell.mods || {}, color, hostile: false }), p) || ally.addBuff(spell.buffName || spell.name, spell.duration || 8, spell.mods || {});
          }
          triggerBardSpellEffect(p, { duration: spell.duration || 9, radius: spell.radius || 20, allies });
          this.spawnRing(p.x, p.y, color, spell.radius || 16);
          for (const ally of allies) if (ally && ally.alive) this.spawnStatusPulse?.(ally, color, spell.name);
          this.log(`${spell.name} protects your group.`);
          return;
        }

        if (spell.kind === 'heal') {
          const ally = this.getFriendlySpellTarget?.(spell.range || 18) || this.lowestAlly() || p;
          const healed = this.healEntity(ally, spell.heal || power, true, p);
          triggerBardSpellEffect(ally, { heal: healed });
          this.spawnRing(ally.x, ally.y, color, 14);
          this.spawnStatusPulse?.(ally, color, spell.name);
          this.log(`${spell.name} restores ${healed} health to ${ally.name || 'ally'}.`);
          return;
        }

        if (spell.kind === 'mana') {
          const restored = this.restoreMana(p, power);
          this.spawnRing(p.x, p.y, color, 14);
          this.spawnStatusPulse?.(p, color, 'Mana');
          this.log(`${spell.name} restores ${restored} mana.`);
          return;
        }

        if (spell.kind === 'petHeal') {
          if (!this.pet || !this.pet.alive) return this.log('No active pet to heal.');
          const healed = this.healEntity(this.pet, spell.heal || power, true, p);
          this.spawnRing(this.pet.x, this.pet.y, color, 12);
          this.spawnStatusPulse?.(this.pet, color, spell.name);
          this.log(`${spell.name} restores ${healed} health to your pet.`);
          return;
        }

        if (spell.kind === 'petBuff') {
          if (!this.pet || !this.pet.alive) return this.log('No active pet to empower.');
          this.applyStatusEffect?.(this.pet, this.decorateStatusEffectFromSpell(spell, { id: spell.buffName || spell.name, name: spell.buffName || spell.name, type: 'buff', duration: spell.duration || 8, mods: spell.mods || {}, color, hostile: false }), p) || this.pet.addBuff(spell.buffName || spell.name, spell.duration || 8, spell.mods || {});
          this.spawnRing(this.pet.x, this.pet.y, color, 14);
          this.spawnStatusPulse?.(this.pet, color, spell.name);
          this.log(`${spell.name} empowers your pet.`);
          return;
        }

        if (spell.kind === 'aoeHeal') {
          const healed = this.healEntity(p, spell.heal || power, true, p);
          this.aoeDamage(p.x, p.y, spell.radius || 4, power, color, p, damageOptions);
          this.spawnRing(p.x, p.y, color, 20);
          this.log(`${spell.name} heals ${healed} and strikes nearby enemies.`);
          return;
        }

        if (spell.kind === 'aoe' || spell.kind === 'aoeMelee') {
          this.aoeDamage(p.x, p.y, spell.radius || 4, power, color, p, damageOptions);
          triggerBardSpellEffect(p, { center: p, radius: spell.radius || 4 });
          this.spawnRing(p.x, p.y, color, spell.kind === 'aoeMelee' ? 16 : 22);
          p.attackAnim = spell.kind === 'aoeMelee' ? 1 : p.attackAnim;
          this.log(`${spell.name} hits nearby enemies.`);
          return;
        }

        if (spell.kind === 'aoeDebuff') {
          let count = 0;
          const radius = spell.radius || 4.5;
          for (const enemy of (this.queryEnemiesNearPoint?.(p.x, p.y, radius + 0.5) || this.enemies || [])) {
            if (!enemy.alive || distFn(enemy, p) > radius) continue;
            this.damageEntity(enemy, power, p, color, damageOptions);
            applyHostileStatus(enemy, 4);
            count++;
          }
          triggerNecromancerSpellEffect(p, { center: p, radius: spell.radius || 4.4, duration: spell.duration || 4 });
          this.spawnRing(p.x, p.y, color, 22);
          this.log(`${spell.name} weakens ${count} enemies.`);
          return;
        }

        if (spell.kind === 'melee' || spell.kind === 'meleeDebuff') {
          const t = requireTarget(spell.range || 2);
          if (!t) return;
          // V0.20.20 (Roadmap Item 6): honour an authored vfxStyle here too.
          //
          // This is resolveClassSpell - the GENERIC fallback every class without a bespoke resolver
          // falls through to - and it hardcoded 'slash' for every melee spell in the game. So V0.20.1
          // made vfxStyle work for the Fighter, whose own resolver reads it, and it was silently inert
          // for everybody else: the exact `id === 'titan_chop' ? 'slam' : 'slash'` bug V0.20.0 fixed,
          // still alive one function away. Authoring a style on any non-Fighter spell would have been
          // dead data, which is the thing this whole pass exists to remove - so the mechanism has to
          // reach here BEFORE any class gets authored, not after.
          this.playAttackAnimation(p, t, color, spell.vfxStyle || 'slash');
          const executePct = Number(spell.executeBonusBelowPct || 0);
          const finalPower = executePct > 0 && t.hp / Math.max(1, t.maxHp) <= executePct ? Math.floor(power * 1.45) : power;
          this.damageEntity(t, finalPower, p, color, damageOptions);
          applyHostileStatus(t, 5);
          this.log(`${spell.name} hits ${t.name}.`);
          return;
        }

        if (spell.kind === 'dashStrike') {
          const t = requireTarget(spell.range || 5);
          if (!t) return;
          const dx = p.x - t.x;
          const dy = p.y - t.y;
          const len = Math.hypot(dx, dy) || 1;
          p.x = t.x + (dx / len) * 1.1;
          p.y = t.y + (dy / len) * 1.1;
          // V0.20.20: the charge/gap-closer arm of the same generic resolver - same hardcoded 'slash',
          // same fix. Both call sites, or a style would work on a class's normal melee and vanish on
          // its charge, which is the kind of seam that is worse than no feature at all.
          this.playAttackAnimation(p, t, color, spell.vfxStyle || 'slash');
          this.damageEntity(t, power, p, color, damageOptions);
          this.spawnRing(p.x, p.y, color, 10);
          this.log(`${spell.name} flashes behind ${t.name}.`);
          return;
        }

        if (spell.kind === 'drain') {
          const t = requireTarget(spell.range || 7);
          if (!t) return;
          this.damageEntity(t, power, p, color, damageOptions);
          const healed = this.healEntity(p, Math.floor(power * 0.55), true, p);
          triggerNecromancerSpellEffect(t);
          this.spawnBolt(p, t, color);
          this.log(`${spell.name} drains ${t.name}, healing ${healed}.`);
          return;
        }

        if (spell.kind === 'debuff' || spell.kind === 'boltDot') {
          const t = requireTarget(spell.range || 7);
          if (!t) return;
          const executePct = Number(spell.executeBonusBelowPct || 0);
          const finalPower = executePct > 0 && t.hp / Math.max(1, t.maxHp) <= executePct ? Math.floor(power * 1.45) : power;
          this.damageEntity(t, finalPower, p, color, damageOptions);
          applyHostileStatus(t, 5);
          triggerNecromancerSpellEffect(t);
          triggerBardSpellEffect(t, { duration: spell.duration || 4 });
          this.spawnBolt(p, t, color);
          this.log(`${spell.name} strikes ${t.name}.`);
          return;
        }

        if (spell.kind === 'boltSummon') {
          const t = requireTarget(spell.range || 7);
          if (!t) return;
          this.damageEntity(t, power, p, color, damageOptions);
          this.spawnBolt(p, t, color);
          if (!this.pet || !this.pet.alive) summonPet();
          else this.log(`${spell.name} detonates on ${t.name}.`);
          return;
        }

        const t = requireTarget(spell.range || 7);
        if (!t) return;
        this.damageEntity(t, power, p, color, damageOptions);
        triggerNecromancerSpellEffect(t);
        triggerBardSpellEffect(t);
        this.spawnBolt(p, t, color, { projectile: spell.projectile });
        this.log(`${spell.name} hits ${t.name}.`);
      };

      Game.prototype.toggleMeditate = function() {
        if (!this.player || !this.player.alive) return;
        const now = performance.now();
        const lastToggle = Number(this.lastMeditationToggleAt || 0);
        if (lastToggle && now - lastToggle < 420) return;
        this.lastMeditationToggleAt = now;

        if (this.player.meditating) {
          const startedAt = Number(this.player.meditationStartedAt || 0);
          // Pointer/touch/click stacks can fire duplicate meditate actions during the
          // first frame after starting. Absorb those duplicates instead of logging
          // "manual stop" and killing meditation immediately.
          if (startedAt && now - startedAt < 900) return;
          this.cancelMeditation?.(this.player, 'manual stop');
          return;
        }
        if (typeof this.startMeditation === 'function') this.startMeditation(this.player);
        else {
          this.clearClickMoveTarget?.();
          this.player.meditating = true;
          this.player.meditationStartedAt = now;
          this.player.castTimer = 0;
          this.log('You begin meditating.');
        }
      };
    }
  };
})();
