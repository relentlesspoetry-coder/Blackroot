// Dream Realms quest data
// V0.17.84 Dark Woods Quest Rebuild: the previous 11 Dark Woods quests (6
// overworld + the 5-quest Silk Web Cavern dungeon chain) were REMOVED and
// replaced with the authored 25-quest set from the design doc
// "Blackroot Dark Woods Quests.txt". This file also hosts two data registries
// the new objective verbs read: DR.DISCOVERY_POINTS (the `discover` verb) and
// DR.INTERACT_POINTS (the overworld `interact` verb). Both are consumed by
// systems/quest-system.js, which loads after this file.
(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};

  // ---------------------------------------------------------------------------
  // DISCOVERY POINTS  (the `discover` objective verb)
  // A zone-keyed registry of named landmarks, each with coords + a radius,
  // checked on the quest tick. Coordinates line up with the actual Phase-15
  // micro-landmark/story-scene props (systems/world-system.js) and the named
  // rare spawn anchors (systems/mob-spawn-system.js) already in the world.
  // ---------------------------------------------------------------------------
  DR.DISCOVERY_POINTS = [
    // Dead Lantern Outskirts (L1-3)
    { id: 'poi_old_forest_well',      zone: 'dark_woods', x: 110, y: 72,  radius: 5, name: 'The Old Forest Well' },
    { id: 'poi_lost_pilgrim_shrine',  zone: 'dark_woods', x: 84,  y: 102, radius: 5, name: "The Lost Pilgrim's Shrine" },
    // Bramblefen Thicket (L3-5)
    { id: 'poi_abandoned_hunter_camp', zone: 'dark_woods', x: 150, y: 155, radius: 6, name: "Aldric's Camp" },
    { id: 'poi_gore_pit',             zone: 'dark_woods', x: 128, y: 132, radius: 5, name: 'The Gore Pit' },
    // Bandit's Fall (L4-7) -- used by the V0.17.86 branch
    { id: 'poi_bandit_ambush_remains', zone: 'dark_woods', x: 195, y: 80, radius: 6, name: 'Bandit Ambush Remains' },
    { id: 'poi_collapsed_watch_post', zone: 'dark_woods', x: 260, y: 40,  radius: 6, name: 'The Collapsed Watch Post' },
    { id: 'poi_bandits_fall',        zone: 'dark_woods', x: 228, y: 58,  radius: 8, name: "Bandit's Fall" },
    // Stone Hedge Clearing (L5-8)
    { id: 'poi_stone_hedge_ring',     zone: 'dark_woods', x: 210, y: 250, radius: 7, name: 'The Stone Hedge Ring' },
    // Silk Web Approach (L6-10)
    { id: 'poi_silk_web_approach_camp', zone: 'dark_woods', x: 52, y: 145, radius: 7, name: 'The Expedition Camp' },
    // Gloamroot Depths (L7-10)
    { id: 'poi_root_shrine',          zone: 'dark_woods', x: 100, y: 220, radius: 6, name: 'The Root Shrine' },
    { id: 'poi_the_rot',              zone: 'dark_woods', x: 100, y: 226, radius: 5, name: 'The Rot Beneath Gloamroot' }
  ];

  // ---------------------------------------------------------------------------
  // INTERACT POINTS  (the overworld `interact` objective verb)
  // Quest-scoped world objects the player activates with E. Each point is only
  // actionable while an active quest has an incomplete interact task matching
  // its objId, so they never pre-consume. Optional behaviours:
  //   relightLantern: relight the nearest dark lanternPost prop (visible change)
  //   grantItem:      grant 1 of an item id on activation (drives collect/keep)
  // Multiple points may share an objId to express "interact with N instances".
  // ---------------------------------------------------------------------------
  DR.INTERACT_POINTS = [
    // [01] Light the Way -- 5 dark lanterns along the Dead Lantern Trail.
    { id: 'lantern_relit_1', zone: 'dark_woods', x: 88,  y: 109, radius: 2.8, objId: 'poi_lantern_relit', relightLantern: true, name: 'Dark Lantern', prompt: 'Relight the lantern' },
    { id: 'lantern_relit_2', zone: 'dark_woods', x: 83,  y: 114, radius: 2.8, objId: 'poi_lantern_relit', relightLantern: true, name: 'Dark Lantern', prompt: 'Relight the lantern' },
    { id: 'lantern_relit_3', zone: 'dark_woods', x: 84,  y: 82,  radius: 2.8, objId: 'poi_lantern_relit', relightLantern: true, name: 'Dark Lantern', prompt: 'Relight the lantern' },
    { id: 'lantern_relit_4', zone: 'dark_woods', x: 113, y: 91,  radius: 2.8, objId: 'poi_lantern_relit', relightLantern: true, name: 'Dark Lantern', prompt: 'Relight the lantern' },
    { id: 'lantern_relit_5', zone: 'dark_woods', x: 121, y: 111, radius: 2.8, objId: 'poi_lantern_relit', relightLantern: true, name: 'Dark Lantern', prompt: 'Relight the lantern' },

    // [02] What the Well Remembers -- recover 3 coins from the old forest well
    // (well prop is blocked; the player stands adjacent and pulls coins).
    { id: 'well_coin_1', zone: 'dark_woods', x: 110, y: 72, radius: 3.0, objId: 'poi_well_coin', grantItem: 'item_tarnished_coin', name: 'The Old Forest Well', prompt: 'Recover a coin from the well' },
    { id: 'well_coin_2', zone: 'dark_woods', x: 110, y: 72, radius: 3.0, objId: 'poi_well_coin', grantItem: 'item_tarnished_coin', name: 'The Old Forest Well', prompt: 'Recover a coin from the well' },
    { id: 'well_coin_3', zone: 'dark_woods', x: 110, y: 72, radius: 3.0, objId: 'poi_well_coin', grantItem: 'item_tarnished_coin', name: 'The Old Forest Well', prompt: 'Recover a coin from the well' },

    // [06] The Hunter Never Came Back -- recover Aldric's journal at his camp.
    // It is kept (never consumed) and becomes the ONLY guidance for [07].
    { id: 'hunter_journal_1', zone: 'dark_woods', x: 150, y: 155, radius: 4.0, objId: 'poi_hunter_journal', grantItem: 'item_hunters_journal', name: "Aldric's Journal", prompt: "Recover Aldric's journal" },

    // [12] Cut the Supply Lines -- 4 bandit supply caches at the ruin (230,60).
    { id: 'bandit_cache_1', zone: 'dark_woods', x: 228, y: 62, radius: 2.8, objId: 'bandit_supply_cache', name: 'Bandit Supply Cache', prompt: 'Destroy the cache' },
    { id: 'bandit_cache_2', zone: 'dark_woods', x: 233, y: 58, radius: 2.8, objId: 'bandit_supply_cache', name: 'Bandit Supply Cache', prompt: 'Destroy the cache' },
    { id: 'bandit_cache_3', zone: 'dark_woods', x: 234, y: 64, radius: 2.8, objId: 'bandit_supply_cache', name: 'Bandit Supply Cache', prompt: 'Destroy the cache' },
    { id: 'bandit_cache_4', zone: 'dark_woods', x: 226, y: 57, radius: 2.8, objId: 'bandit_supply_cache', name: 'Bandit Supply Cache', prompt: 'Destroy the cache' },

    // [13] The Lookout's Last Watch -- the torn ledger at the collapsed watch post.
    { id: 'lookout_ledger_1', zone: 'dark_woods', x: 260, y: 40, radius: 4.0, objId: 'poi_lookout_ledger', grantItem: 'item_torn_lookout_ledger', name: "The Lookout's Ledger", prompt: 'Recover the torn ledger' },

    // [17] The Order of Stones -- 8 standing stones around the ring (210,250).
    // A sequence puzzle: wake them sunwise from the north stone (seq 0..7). A
    // wrong stone flares and summons wisps. Stones are re-usable (not consumed).
    { id: 'stone_hedge_s0', zone: 'dark_woods', x: 210, y: 245, radius: 2.6, objId: 'stone_hedge_rune', sequenceId: 'stone_hedge', sequenceTotal: 8, seq: 0, name: 'North Stone', prompt: 'Wake the stone' },
    { id: 'stone_hedge_s1', zone: 'dark_woods', x: 214, y: 246, radius: 2.6, objId: 'stone_hedge_rune', sequenceId: 'stone_hedge', sequenceTotal: 8, seq: 1, name: 'Standing Stone', prompt: 'Wake the stone' },
    { id: 'stone_hedge_s2', zone: 'dark_woods', x: 215, y: 250, radius: 2.6, objId: 'stone_hedge_rune', sequenceId: 'stone_hedge', sequenceTotal: 8, seq: 2, name: 'Standing Stone', prompt: 'Wake the stone' },
    { id: 'stone_hedge_s3', zone: 'dark_woods', x: 214, y: 254, radius: 2.6, objId: 'stone_hedge_rune', sequenceId: 'stone_hedge', sequenceTotal: 8, seq: 3, name: 'Standing Stone', prompt: 'Wake the stone' },
    { id: 'stone_hedge_s4', zone: 'dark_woods', x: 210, y: 255, radius: 2.6, objId: 'stone_hedge_rune', sequenceId: 'stone_hedge', sequenceTotal: 8, seq: 4, name: 'South Stone', prompt: 'Wake the stone' },
    { id: 'stone_hedge_s5', zone: 'dark_woods', x: 206, y: 254, radius: 2.6, objId: 'stone_hedge_rune', sequenceId: 'stone_hedge', sequenceTotal: 8, seq: 5, name: 'Standing Stone', prompt: 'Wake the stone' },
    { id: 'stone_hedge_s6', zone: 'dark_woods', x: 205, y: 250, radius: 2.6, objId: 'stone_hedge_rune', sequenceId: 'stone_hedge', sequenceTotal: 8, seq: 6, name: 'Standing Stone', prompt: 'Wake the stone' },
    { id: 'stone_hedge_s7', zone: 'dark_woods', x: 206, y: 246, radius: 2.6, objId: 'stone_hedge_rune', sequenceId: 'stone_hedge', sequenceTotal: 8, seq: 7, name: 'Standing Stone', prompt: 'Wake the stone' },

    // [21] Cut Them Down -- 6 webbed cocoons at the expedition camp (52,145).
    // Prop coords match the ensureDarkWoodsMicroLandmarks camp scene. The 6th is
    // the survivor (still breathing) - revealing her opens [22].
    { id: 'approach_cocoon_1', zone: 'dark_woods', x: 50, y: 143, radius: 2.6, objId: 'approach_cocoon', name: 'Webbed Cocoon', prompt: 'Cut open the cocoon' },
    { id: 'approach_cocoon_2', zone: 'dark_woods', x: 54, y: 143, radius: 2.6, objId: 'approach_cocoon', name: 'Webbed Cocoon', prompt: 'Cut open the cocoon' },
    { id: 'approach_cocoon_3', zone: 'dark_woods', x: 49, y: 146, radius: 2.6, objId: 'approach_cocoon', name: 'Webbed Cocoon', prompt: 'Cut open the cocoon' },
    { id: 'approach_cocoon_4', zone: 'dark_woods', x: 55, y: 146, radius: 2.6, objId: 'approach_cocoon', name: 'Webbed Cocoon', prompt: 'Cut open the cocoon' },
    { id: 'approach_cocoon_5', zone: 'dark_woods', x: 51, y: 148, radius: 2.6, objId: 'approach_cocoon', name: 'Webbed Cocoon', prompt: 'Cut open the cocoon' },
    { id: 'approach_cocoon_6', zone: 'dark_woods', x: 53, y: 141, radius: 2.6, objId: 'approach_cocoon', name: 'Webbed Cocoon (breathing)', prompt: 'Cut open the breathing cocoon' }
  ];

  // ---------------------------------------------------------------------------
  // QUEST BRANCHES  (the `choose` verb)
  // A branch is triggered when the player discovers its `poi`. If its
  // requiredConditions pass, a choice modal is shown (each option starts a
  // sub-quest); otherwise the fallback sub-quest is offered. Resolved once.
  // ---------------------------------------------------------------------------
  DR.QUEST_BRANCHES = [
    {
      id: 'rurik',
      poi: 'poi_bandits_fall',
      requiredConditions: [{ type: 'variable', name: 'bandit_hostility', op: '<', value: 3 }],
      title: "Rurik's Offer",
      prompt: "Rurik the Fallen lowers his blade. \"You've seen what we run from. It came up out of the deep woods and it was made of the forest. Deal with me - or die a warden's death.\"",
      options: [
        { label: 'Hear his bargain', sub: "Ally with Rurik. Turn on Cael's wardens.", questId: 'quest_ruriks_bargain' },
        { label: 'Draw your blade', sub: 'Cut the bandit king down.', questId: 'quest_fall_of_rurik' }
      ],
      fallbackQuestId: 'quest_fall_of_rurik',
      fallbackLog: "Rurik will not deal with you now - there is too much bandit blood on your hands. Only his death remains."
    }
  ];

  // ---------------------------------------------------------------------------
  // QUESTS
  // ---------------------------------------------------------------------------
  const QUEST_DRAFTS = [

    // === DEAD LANTERN OUTSKIRTS (L1-3) ======================================

    {
      id: 'quest_light_the_way',
      name: 'Light the Way',
      folder: 'Dark Woods / Dead Lantern Outskirts',
      region: 'dead_lantern_outskirts',
      repeatable: false, canAbandon: true, minLevel: 1,
      giver: 'Road Warden Cael', turnIn: 'Road Warden Cael',
      color: '#ffd36a', label: 'Q',
      beforeOfferText: 'The road warden watches the dark lantern posts beyond camp.',
      offerText: 'The Dead Lantern Trail earned its name. Half those posts have been dark for years and the dark creeps in behind them. Take this oil. Walk the trail. Light what you can.',
      inProgressText: "The posts won't light themselves, and the dark isn't waiting on you. Walk the trail and coax back every lantern you can - each one is a step of road the woods don't own.",
      completedText: "Five more burning. It's not much. It's not nothing.",
      postCompletionText: "Carter came through after dark last night. First one in a year to try it. He said he followed your lanterns the whole way in.",
      tasks: [
        { type: 'interact', target: 'poi_lantern_relit', label: 'Relight lanterns on the trail', required: 5, progress: 0 }
      ],
      rewards: { xp: 90, gold: 12, items: [{ id: 'item_lantern_oil', qty: 3 }] },
      note: 'V0.17.84 [01] ONBOARDING/CULL. Teaches the interact verb; the first act of changing the world at L1.'
    },

    {
      id: 'quest_well_remembers',
      name: 'What the Well Remembers',
      folder: 'Dark Woods / Dead Lantern Outskirts',
      region: 'dead_lantern_outskirts',
      repeatable: false, canAbandon: true, minLevel: 2,
      giver: 'Sister Liora', turnIn: 'Sister Liora',
      color: '#bdf4de', label: 'Q',
      beforeOfferText: 'The camp healer keeps a small stack of very old coins.',
      offerText: "There's a well north of the pond. Someone's been throwing coins in it. Find it and bring me three.",
      inProgressText: 'The old well still holds what the faithful left it. Find it, and bring up three of those coins - gently. They were given in hope, and hope keeps.',
      completedText: '...These are two hundred years old. There is nobody in this camp that old. Somebody is still making wishes here.',
      postCompletionText: "I've had the coins on my table a week now. Every morning they're turned face-up. I stopped turning them back.",
      tasks: [
        { type: 'discover', target: 'poi_old_forest_well', label: 'Find the old well', required: 1, progress: 0 },
        { type: 'interact', target: 'poi_well_coin', label: 'Recover coins from the well', required: 3, progress: 0 }
      ],
      rewards: { xp: 160, gold: 20, items: [] },
      note: 'V0.17.84 [02] DISCOVERY/INVESTIGATION. The coins the player keeps become the key to the [17] rune puzzle five levels later.'
    },

    {
      id: 'quest_pilgrims_road',
      name: "The Pilgrim's Road",
      folder: 'Dark Woods / Dead Lantern Outskirts',
      region: 'dead_lantern_outskirts',
      repeatable: false, canAbandon: true, minLevel: 3,
      prerequisiteQuestIds: ['quest_well_remembers'],
      giver: 'Sister Maelle', turnIn: 'Sister Maelle',
      color: '#c9b8e8', label: 'Q',
      beforeOfferText: 'The cleric trainer studies one of the old coins.',
      offerText: 'Liora showed me the coin. There is a shrine on the old road - a pilgrim road, from before the camp. Put one of those coins back where it belongs. Some debts are older than we are.',
      inProgressText: "The shrine still stands where the old road bends. Lay a coin back where a pilgrim once knelt - the road remembers a debt repaid.",
      completedText: 'You carried the coin all that way to give it up. That is what a pilgrim is.',
      postCompletionText: 'Two more walked the road to the shrine this week, on their own feet. Word travels. So does courage, apparently.',
      tasks: [
        { type: 'discover', target: 'poi_lost_pilgrim_shrine', label: "Find the pilgrim's shrine", required: 1, progress: 0 },
        { type: 'deliver', target: 'item_tarnished_coin', to: 'poi_lost_pilgrim_shrine', label: 'Return a coin to the shrine', required: 1, progress: 0 }
      ],
      rewards: { xp: 280, gold: 30, items: [{ id: 'item_pilgrim_charm', qty: 1 }] },
      note: 'V0.17.84 [03] TRAINER/DISCOVERY/FETCH&DELIVER. First trainer quest (given to every class). Teaches the deliver verb.'
    },

    {
      id: 'quest_camp_supply_run',
      name: 'Camp Supply Run',
      folder: 'Dark Woods / Dead Lantern Outskirts',
      region: 'dead_lantern_outskirts',
      repeatable: true, canAbandon: true, minLevel: 2,
      giver: 'Camp Cook', turnIn: 'Camp Cook',
      color: '#d8ad57', label: 'D',
      beforeOfferText: 'The camp cook wipes down a cutting board and eyes the herb baskets.',
      offerText: "The pot's low and the wounded need salves. Bring me what I'm short on today.",
      inProgressText: "The pot's still short and the wounded still need salving. Bring me what I asked for and none of it goes to waste.",
      completedText: 'The campfire smells stronger with fresh herbs in the pot.',
      tasks: [
        { type: 'gather', target: 'herb_gloomleaf', rotateOptions: ['herb_gloomleaf', 'herb_lantern_moss', 'herb_mooncap'], label: 'Gather what the cook needs', required: 8, progress: 0 }
      ],
      rewards: { xp: 120, gold: 15, items: [{ id: 'item_gloomleaf_wraps', qty: 2 }] },
      note: 'V0.17.84 [04] HARVEST/DAILY. The requested herb rotates daily (rotateOptions) - the first rotating daily.'
    },

    {
      id: 'quest_guides_warning',
      name: "The Guide's Warning",
      folder: 'Dark Woods / Dead Lantern Outskirts',
      region: 'dead_lantern_outskirts',
      repeatable: false, canAbandon: true, minLevel: 3,
      giver: 'Road Warden Cael', turnIn: 'Road Warden Cael',
      color: '#9fb6c7', label: 'Q',
      beforeOfferText: 'The road warden braces a spear against the south fence.',
      offerText: "Something's pushing at the fence and it isn't stopping. Stand at the south gate. Don't let anything through. I'll be right behind you.",
      inProgressText: 'Hold the south gate through all three waves. Stand your ground.',
      completedText: "Held. Good. Remember how that felt - you'll do it again, and next time I won't be behind you.",
      failureText: "The line buckles and the dark pours through the south gate behind you - but Cael is already there, shield up, hauling you back off the ground by your collar. \"Not done. On your feet. We hold it again, and this time you hold.\"",
      postCompletionText: "You've held a line since then, and held it without me at your shoulder. That was the whole lesson. I've nothing left to teach you about standing still.",
      tasks: [
        {
          type: 'defend', target: 'camp_south_gate', x: 100, y: 113, radius: 12, spawnDx: 0, spawnDy: 8, mobLevel: 3,
          label: 'Hold the south gate', required: 3, progress: 0,
          waves: [
            [{ mob: 'mob_rotling', count: 3 }],
            [{ mob: 'mob_rotling', count: 4 }],
            [{ mob: 'mob_gloom_wolf', count: 5 }]
          ],
          ally: { name: 'Road Warden Cael', color: '#9fb6c7', hp: 160, attack: 14, attackMin: 10, attackMax: 16, petType: 'shard' }
        }
      ],
      rewards: { xp: 300, gold: 35, items: [{ id: 'item_ironbark_shield', qty: 1 }] },
      note: 'V0.17.85 [05] DEFEND/ONBOARDING. Cael fights alongside (temp ally) - defend with training wheels. 3 waves: 3x rotling, 4x rotling, 5x gloom wolf.'
    },

    // === BRAMBLEFEN THICKET (L3-5) ==========================================

    {
      id: 'quest_hunter_never_returned',
      name: 'The Hunter Never Came Back',
      folder: 'Dark Woods / Bramblefen Thicket',
      region: 'bramblefen_thicket',
      repeatable: false, canAbandon: true, minLevel: 3,
      giver: 'Marshal Corven', turnIn: 'Marshal Corven',
      color: '#d0b070', label: 'Q',
      beforeOfferText: 'The fighter trainer keeps a hunter\'s spare bowstring on his belt.',
      offerText: "Aldric went into the Bramblefen eight days ago after a boar. He was the best of us. He hasn't come back and I've stopped pretending he will. Find his camp. Bring me whatever's left.",
      inProgressText: "Aldric's camp lies deeper in the Bramblefen than any of us cared to walk. Find it, and bring back his journal - if the man kept writing, it will say what he could not.",
      completedText: 'Cold fire. Torn bedroll. Snapped bow. And a blood trail leading AWAY from the camp, not to it. Whatever took him, he ran first.',
      postCompletionText: "I had Aldric's camp struck and his kit carried in. His sister is coming up from the coast to collect it. I would rather tell her he ran than tell her he never woke.",
      tasks: [
        { type: 'discover', target: 'poi_abandoned_hunter_camp', label: "Find Aldric's camp", required: 1, progress: 0 },
        { type: 'interact', target: 'poi_hunter_journal', label: 'Recover his journal', required: 1, progress: 0 }
      ],
      rewards: { xp: 260, gold: 25, items: [] },
      note: 'V0.17.84 [06] DISCOVERY/INVESTIGATION. The journal is kept and becomes the ONLY guidance for the [07] breadcrumb.'
    },

    {
      id: 'quest_follow_the_blood',
      name: 'Follow the Blood',
      folder: 'Dark Woods / Bramblefen Thicket',
      region: 'bramblefen_thicket',
      repeatable: false, canAbandon: true, minLevel: 4,
      hidden: true, autoOffer: true, autoComplete: true,
      prerequisiteQuestIds: ['quest_hunter_never_returned'],
      requiredConditions: [{ type: 'itemOwned', itemId: 'item_hunters_journal' }],
      lockedText: 'There is blood on the bracken and a trail leading off into the dark, but nothing here to say whose it was or where they were headed.',
      giver: null, turnIn: null,
      color: '#8a1c1c', label: '!',
      offerText: "Aldric's journal leads north-east, into the thick. Follow the blood.",
      inProgressText: 'Follow the blood trail north-east from the hunter camp.',
      completedText: 'The trail ends at a pit where the kills were dragged. Something has been feeding here.',
      tasks: [
        { type: 'discover', target: 'poi_gore_pit', label: 'Follow the trail', required: 1, progress: 0 }
      ],
      rewards: { xp: 380, gold: 40, items: [] },
      note: 'V0.17.84 [07] BREADCRUMB/HIDDEN. No giver, no marker - auto-offers when you hold the journal, auto-completes at the pit.'
    },

    {
      id: 'quest_old_tusk',
      name: 'Old Tusk',
      folder: 'Dark Woods / Bramblefen Thicket',
      region: 'bramblefen_thicket',
      repeatable: false, canAbandon: true, minLevel: 5,
      prerequisiteQuestIds: ['quest_follow_the_blood'],
      giver: 'Marshal Corven', turnIn: 'Marshal Corven',
      color: '#7fae5a', label: 'Q',
      beforeOfferText: 'The marshal grips his blade when you mention the pit.',
      offerText: "So there is a thing in that pit. Aldric found it and it killed him. Go back and kill it.",
      inProgressText: "The thing is still down in that pit, grown fat on what it dragged there. Go back and finish what Aldric began - put it in the ground.",
      completedText: "That's Aldric's bow in the pit. Keep it, or don't. He'd want it used.",
      postCompletionText: "The pit's filled in and nothing has fed there since. Aldric would call that a fair trade - his bow for the beast that took him.",
      tasks: [
        { type: 'kill', target: 'Old Tusk Briarback', label: 'Kill the thing in the pit', required: 1, progress: 0 }
      ],
      rewards: {
        xp: 620, gold: 80, items: [], playerChoice: true,
        choiceItems: [
          { id: 'item_briarback_tusk_charm' },
          { id: 'item_aldrics_bow' },
          { id: 'item_thornberry_draught', qty: 3 }
        ]
      },
      note: 'V0.17.84 [08] BOUNTY/REWARD CHOICE. mob_old_tusk_briarback spawns at (128,132). V0.17.86 retrofit: playerChoice picker.'
    },

    {
      id: 'quest_thin_the_pack',
      name: 'Thin the Pack',
      folder: 'Dark Woods / Bramblefen Thicket',
      region: 'bramblefen_thicket',
      repeatable: true, canAbandon: true, minLevel: 4,
      giver: 'Road Warden Cael', turnIn: 'Road Warden Cael',
      color: '#9fb6c7', label: 'D',
      beforeOfferText: 'The warden marks fresh wolf sign on his map.',
      offerText: 'The gloom wolves are running thicker than they should. Thin the pack before they push the road.',
      inProgressText: "The gloom wolves are still running the Bramblefen thicker than the road can stand. Thin them down before they push at us again.",
      completedText: 'That will keep them off the road a while. They always come back.',
      tasks: [
        { type: 'kill', target: 'Gloom Wolf', label: 'Defeat Gloom Wolves', required: 8, progress: 0 }
      ],
      rewards: { xp: 340, gold: 30, items: [] },
      note: 'V0.17.84 [09] CULL/DAILY.'
    },

    {
      id: 'quest_thornberry_harvest',
      name: 'Thornberry Harvest',
      folder: 'Dark Woods / Bramblefen Thicket',
      region: 'bramblefen_thicket',
      repeatable: true, canAbandon: true, minLevel: 3,
      giver: 'Branna Ironhand', turnIn: 'Branna Ironhand',
      color: '#f0a15a', label: 'D',
      beforeOfferText: 'The camp smith needs thornberry for hardening quench.',
      offerText: 'Thornberry sap tempers a good edge. Bring me six from the bramble and the forge stays hot.',
      inProgressText: "The bramble's thick with thornberry if you've the patience to pick it. Bring the sap back and I'll keep the quench sharp.",
      completedText: 'Good and tart. The quench will hold now.',
      tasks: [
        { type: 'gather', target: 'herb_thornberry', label: 'Gather Thornberry', required: 6, progress: 0 }
      ],
      rewards: { xp: 250, gold: 22, items: [{ id: 'item_copper_bar', qty: 1 }] },
      note: 'V0.17.84 [10] HARVEST/DAILY. Points the Bramblefen region herb at a repeatable so the region identity is load-bearing.'
    },

    // === BANDIT'S FALL (L4-7) - "Men are worse than wolves" =================

    {
      id: 'quest_blood_on_the_road',
      name: 'Blood on the Road',
      folder: "Dark Woods / Bandit's Fall",
      region: 'bandits_fall',
      repeatable: false, canAbandon: true, minLevel: 4,
      giver: 'Road Warden Cael', turnIn: 'Road Warden Cael',
      color: '#9fb6c7', label: 'Q',
      beforeOfferText: 'The warden spreads a bloodstained map across his knee.',
      offerText: 'A wagon was hit on the north road - the third this month. Find the ambush site, then thin the bandits holding the ruin.',
      inProgressText: "Start where they hit the wagon - the wreck's still fouling the north road. Then push on to the ruin they're holding and make them pay the toll back.",
      completedText: "Raiders, we thought. But raiders take the road and leave. These ones are dug IN, like they've nowhere else to go.",
      postCompletionText: "I keep turning it over. Men don't dig in on a road they could simply walk away down. Whatever they're putting between themselves and the deep woods, they reckon it's worth having the wardens at their backs.",
      tasks: [
        { type: 'discover', target: 'poi_bandit_ambush_remains', label: 'Find the ambush site', required: 1, progress: 0 },
        { type: 'kill', target: 'Bandit', label: 'Defeat bandits', required: 6, progress: 0 }
      ],
      rewards: { xp: 420, gold: 45, items: [] },
      note: "V0.17.86 [11] DISCOVERY/INVESTIGATION. Uses the Phase-15 Bandit Ambush Remains scene."
    },

    {
      id: 'quest_cut_supply_lines',
      name: 'Cut the Supply Lines',
      folder: "Dark Woods / Bandit's Fall",
      region: 'bandits_fall',
      repeatable: false, canAbandon: true, minLevel: 5,
      prerequisiteQuestIds: ['quest_blood_on_the_road'],
      giver: 'Road Warden Cael', turnIn: 'Road Warden Cael',
      color: '#9fb6c7', label: 'Q',
      beforeOfferText: 'The warden wants the bandits starved out, not just bled.',
      offerText: "They're holding because they're supplied. Find their caches in the ruin and destroy them. Every one you break, they hate us a little more - good. Let them.",
      inProgressText: "Four caches in that ruin keep Rurik's men fed and armed. Break every one of them and the ruin stops being a fortress and starts being a bolt-hole.",
      completedText: 'Their stores are ash. They will not forget who did it. That was rather the point.',
      postCompletionText: "They've pulled back off the north road since the caches burned. Hungry men don't hold ground. Keep your hood up out there - they know your face now.",
      tasks: [
        { type: 'interact', target: 'bandit_supply_cache', label: 'Destroy bandit caches', required: 4, progress: 0 }
      ],
      rewards: { xp: 560, gold: 60, items: [] },
      onComplete: [{ type: 'setVariable', name: 'bandit_hostility', op: 'add', value: 4 }],
      note: "V0.17.86 [12] CULL/BRANCH-SETUP. QUIETLY raises bandit_hostility +4 -> at >=3 Rurik will not bargain, closing the [14a] path. The player is never told."
    },

    {
      id: 'quest_lookouts_last_watch',
      name: "The Lookout's Last Watch",
      folder: "Dark Woods / Bandit's Fall",
      region: 'bandits_fall',
      repeatable: false, canAbandon: true, minLevel: 5,
      hidden: true, autoOffer: true, autoComplete: true, foundAtPoi: 'poi_collapsed_watch_post',
      giver: null, turnIn: null,
      color: '#7a6a4a', label: '!',
      offerText: 'A collapsed watch post stands off the bandit road, its beams raked with claw marks nothing explained - until now.',
      inProgressText: 'Search the collapsed watch post and recover the torn ledger.',
      completedText: 'The bandits are not raiding for coin. They are RUNNING from something in the deep woods.',
      tasks: [
        { type: 'discover', target: 'poi_collapsed_watch_post', label: 'Find the watch post', required: 1, progress: 0 },
        { type: 'interact', target: 'poi_lookout_ledger', label: "Recover the torn ledger", required: 1, progress: 0 }
      ],
      rewards: { xp: 500, gold: 40, items: [] },
      note: "V0.17.86 [13] HIDDEN/DISCOVERY/INVESTIGATION. No giver. Seeds the Gloamroot zone arc; the watch post's claw marks finally explained."
    },

    // ---- [14] Rurik's Offer: BRANCH -> [14a] XOR [14b] (see DR.QUEST_BRANCHES) ----

    {
      id: 'quest_ruriks_bargain',
      name: 'The Bargain',
      folder: "Dark Woods / Bandit's Fall",
      region: 'bandits_fall',
      repeatable: false, canAbandon: true, minLevel: 6,
      autoComplete: true,
      requiredConditions: [{ type: 'variable', name: 'bandit_hostility', op: '<', value: 3 }],
      giver: 'Rurik the Fallen', turnIn: 'Rurik the Fallen',
      color: '#b08a4a', label: 'B',
      offerText: "Rurik's terms are simple: prove you're no warden's dog. Cael's patrol walks the north road tonight - three of them, men you've likely shared a fire with. End them and there is no road back to the wardens, but every door in this ruin opens. Refuse and you can walk out; just don't come back wearing his colours.",
      inProgressText: "Rurik hasn't moved from his chair. \"The north road. Three wardens. They're not going to walk into my ruin on their own, and I'm not going to ask you twice.\"",
      lockedText: "Rurik's men have your description and a grudge to go with it. There's no bargain on offer here now - only a fight you started.",
      completedText: 'It is done. The wardens are down and there is no road back to Cael now. Rurik nods once. You are one of his.',
      postCompletionText: "Rurik watches you cross his ruin the way he watches his own men now. \"The wardens keep your name in their black book, and I keep it in the other one. You picked the right ledger. Stay useful, and you'll stay fed.\"",
      tasks: [
        { type: 'kill', target: 'Warden Patrol', label: "Kill Cael's patrol", required: 3, progress: 0 }
      ],
      spawnOnAccept: [{ mob: 'mob_warden_patrol', count: 3, x: 222, y: 66 }],
      rewards: { xp: 1100, gold: 150, items: [{ id: 'item_bandit_lockpicks', qty: 1 }] },
      onComplete: [{ type: 'setVariable', name: 'rurik_allied', op: 'set', value: 1 }],
      note: "V0.17.86 [14a] BRANCH/FAILABLE(social). Locks Cael as a giver (rurik_allied); unlocks the Fence + [16]. Auto-completes on the kills (Rurik is not a turn-in NPC)."
    },

    {
      id: 'quest_fall_of_rurik',
      name: 'The Fall of Rurik',
      folder: "Dark Woods / Bandit's Fall",
      region: 'bandits_fall',
      repeatable: false, canAbandon: true, minLevel: 6,
      autoComplete: true,
      giver: 'Rurik the Fallen', turnIn: 'Rurik the Fallen',
      color: '#b777ff', label: 'B',
      offerText: "No bargains with bandit kings. Cut Rurik the Fallen down where he stands - and know that his people will remember your face for it, and no fence in that ruin will ever deal with you again. The wardens pay for a broken band. Rurik pays for a kept one. Choose which coin you want.",
      inProgressText: "He's still in the ruin, still holding court in a dead lord's chair. Nothing about that changes until someone walks in and ends it.",
      completedText: "Rurik's ledger spills from his coat as he falls - and it tells the same tale the lookout did. The deep woods. Always the deep woods.",
      tasks: [
        { type: 'kill', target: 'Rurik the Fallen', label: 'Kill Rurik the Fallen', required: 1, progress: 0 }
      ],
      rewards: {
        xp: 1100, gold: 150, items: [], playerChoice: true,
        choiceItems: [
          { id: 'item_ruriks_fallen_blade' },
          { id: 'item_fences_ledger' }
        ]
      },
      onComplete: [{ type: 'setVariable', name: 'rurik_dead', op: 'set', value: 1 }],
      note: "V0.17.86 [14b] BOUNTY/BRANCH/REWARD CHOICE. Sets rurik_dead; unlocks [15]. Auto-completes on the kill; reward-choice picker."
    },

    {
      id: 'quest_bandit_bounties',
      name: 'Bandit Bounties',
      folder: "Dark Woods / Bandit's Fall",
      region: 'bandits_fall',
      repeatable: true, canAbandon: true, minLevel: 6,
      requiredConditions: [{ type: 'variable', name: 'rurik_dead', op: '>=', value: 1 }],
      giver: 'Road Warden Cael', turnIn: 'Road Warden Cael',
      color: '#9fb6c7', label: 'D',
      beforeOfferText: "With Rurik dead, Cael posts open bounties on the leaderless bandits.",
      lockedText: "Bounties are for a broken band, and Rurik still has his hands on that ruin. Bring me his end and I'll open the purse - and if you've been drinking with him instead, don't come to me for warden coin.",
      offerText: 'Rurik is gone but his men still hold the ruin. Clear them out for the warden purse.',
      inProgressText: 'Hunt the leaderless bandits at the ruin.',
      completedText: "That's another handful the road won't miss.",
      tasks: [
        { type: 'kill', target: 'Bandit', label: 'Defeat bandits', required: 10, progress: 0 }
      ],
      rewards: { xp: 600, gold: 70, items: [] },
      note: "V0.17.86 [15] CULL/DAILY. Only exists if you killed Rurik (requiredConditions rurik_dead). Warden path."
    },

    {
      id: 'quest_fence_work',
      name: 'Fence Work',
      folder: "Dark Woods / Bandit's Fall",
      region: 'bandits_fall',
      repeatable: true, canAbandon: true, minLevel: 6,
      requiredConditions: [{ type: 'variable', name: 'rurik_allied', op: '>=', value: 1 }],
      giver: 'The Bandit Fence', turnIn: 'The Bandit Fence',
      color: '#b08a4a', label: 'D',
      beforeOfferText: 'The fence keeps his ledgers in the ruin shadows.',
      lockedText: "I trade with Rurik's people, and you are not one of them. Get his word on you and we'll talk. Come at me as a warden's errand-runner and the only ledger you'll be in is the one I keep for debts.",
      offerText: "Rurik vouches for you, so I've work. Bring me thornberry - good for the poisons we sell - and I'll pay better than any warden ever would.",
      inProgressText: 'Gather thornberry to move through the fence.',
      completedText: 'Clean goods, quiet hands. Crime pays, friend. Come back when you need coin.',
      tasks: [
        { type: 'gather', target: 'herb_thornberry', label: 'Gather thornberry for the fence', required: 6, progress: 0 }
      ],
      rewards: { xp: 700, gold: 110, items: [] },
      note: "V0.17.86 [16] FETCH/DAILY. Only exists if you spared Rurik (requiredConditions rurik_allied). Pays MORE gold than [15] - crime pays better; the two dailies are deliberately unequal."
    },

    // === STONE HEDGE CLEARING (L5-8) - "The stones remember" ================

    {
      id: 'quest_order_of_stones',
      name: 'The Order of Stones',
      folder: 'Dark Woods / Stone Hedge Clearing',
      region: 'stone_hedge_clearing',
      repeatable: false, canAbandon: true, minLevel: 7,
      requiredConditions: [{ type: 'itemOwned', itemId: 'item_tarnished_coin' }],
      giver: 'Selene Glasswhisper', turnIn: 'Selene Glasswhisper',
      color: '#c9b8e8', label: 'Q',
      beforeOfferText: 'The enchanter turns your old coin to the light.',
      lockedText: "There is nothing to read yet. Bring me something the woods have already written on - old metal, old marks, something somebody bothered to bury. Then we will talk about the ring.",
      offerText: "Show me the coin. ...There. The marks around the rim - that is not decoration, that is an ORDER. Eight stones stand in the clearing and seven of them are wrong. Wake them as the coin says: sunwise, from the north stone.",
      inProgressText: "Eight stones, and only one path through them: begin at the north and follow the sun's turning. Wake them out of order and the ring answers with wisps - it has done so before, and I have the scars to show for it.",
      completedText: 'You read the coin true. Whatever the ring guards, it knows your hand now.',
      postCompletionText: 'The ring has been quiet since you woke it. No wisps, no humming. I am not sure whether that means it is satisfied, or listening.',
      tasks: [
        { type: 'interact', target: 'stone_hedge_rune', label: 'Wake the 8 stones sunwise from the north stone', required: 1, progress: 0 }
      ],
      rewards: { xp: 1300, gold: 90, items: [{ id: 'item_wardstone_fragment', qty: 2 }, { id: 'item_duskwisp_charm', qty: 1 }] },
      note: "V0.17.87 [17] PUZZLE/INVESTIGATION. The level-2 coin from [02] keys a level-7 puzzle. Sequence-puzzle (8 stones); wrong order summons a wisp pack."
    },

    {
      id: 'quest_wispbloom_moonlight',
      name: 'Wispbloom Under Moonlight',
      folder: 'Dark Woods / Stone Hedge Clearing',
      region: 'stone_hedge_clearing',
      repeatable: true, canAbandon: true, minLevel: 6,
      giver: 'Selene Glasswhisper', turnIn: 'Selene Glasswhisper',
      color: '#9be7ff', label: 'D',
      beforeOfferText: 'The enchanter needs wispbloom, and it will not be rushed.',
      offerText: 'Wispbloom closes tight by day and only opens under moonlight. Bring me five - but you will have to wait for dark.',
      inProgressText: "Look for wispbloom by the stone ring, but wait for dark to do it - the bloom stays shut tight under the sun and gives up nothing until the moon is on it.",
      completedText: 'Five blooms, all open. You waited for the dark. Good.',
      tasks: [
        { type: 'gather', target: 'herb_wispbloom', label: 'Gather Wispbloom (night only)', required: 5, progress: 0, nightOnly: true }
      ],
      rewards: { xp: 800, gold: 55, items: [] },
      note: "V0.17.87 [18] HARVEST/DAILY. NIGHT ONLY (nightOnly gather) - first time the day/night cycle gates a quest."
    },

    {
      id: 'quest_lumen',
      name: 'Lumen',
      folder: 'Dark Woods / Stone Hedge Clearing',
      region: 'stone_hedge_clearing',
      repeatable: false, canAbandon: true, minLevel: 8,
      prerequisiteQuestIds: ['quest_wispbloom_moonlight'],
      giver: 'Selene Glasswhisper', turnIn: 'Selene Glasswhisper',
      color: '#d7f6ff', label: 'Q',
      beforeOfferText: 'The enchanter marks a bright point at the ring\'s heart.',
      offerText: 'There is a wisp at the centre of the ring brighter than all the rest - Lumen. It only burns at night. Put it out and bring me what glows in it.',
      inProgressText: "The bright one, Lumen, burns at the heart of the ring - but only once the sun is down. Put it out then, and bring me the light it leaves behind.",
      completedText: 'Its light is yours now. Carry it well.',
      postCompletionText: "The lumen still answers you. It does not do that for everyone - it has decided something about you that it has not seen fit to tell me.",
      tasks: [
        { type: 'kill', target: 'Lumen-Wisp', label: 'Defeat the Lumen-Wisp (night only)', required: 1, progress: 0, nightOnly: true }
      ],
      rewards: {
        xp: 1700, gold: 120, items: [], playerChoice: true,
        choiceItems: [
          { id: 'item_lumenshard' },
          { id: 'item_wispflame_focus' }
        ]
      },
      note: "V0.17.87 [19] BOUNTY/REWARD CHOICE. NIGHT ONLY. Lumenshard loops back to [01] (relights lanterns). mob_lumen_wisp spawns at (210,256)."
    },

    {
      id: 'quest_what_the_gap_lets_in',
      name: 'What the Gap Lets In',
      folder: 'Dark Woods / Stone Hedge Clearing',
      region: 'stone_hedge_clearing',
      repeatable: false, canAbandon: true, minLevel: 8,
      prerequisiteQuestIds: ['quest_order_of_stones'],
      giver: 'Selene Glasswhisper', turnIn: 'Selene Glasswhisper',
      color: '#8fb0d8', label: 'Q',
      beforeOfferText: 'The enchanter has stopped pretending the gap in the ring is an accident.',
      offerText: "The ring is not whole. There is a gap in the stones and it faces the road. Everyone assumes it fell. It did not fall. It was LEFT. Stand in the gap tonight and find out what it was for.",
      inProgressText: "Stand in the gap after dark and let it come to you - it will not open under the sun. Whatever the stones were raised to keep out, hold the ring until nothing more comes through.",
      completedText: 'They came from the deep woods. They always come from the deep woods.',
      failureText: "The last of them breaks over the stones before the hold can set, and the gap swallows the ring whole - shapes pouring through into the dark where you were standing. Nothing is sealed. The ring will have to be held again, from the very first of them.",
      postCompletionText: "The gap has been quiet this week. Do not take that for comfort. It means whatever was coming through has finished coming through, and is out here with us now.",
      tasks: [
        {
          type: 'defend', target: 'stone_hedge_ring', x: 210, y: 250, radius: 12, spawnDx: 0, spawnDy: -8, mobLevel: 8,
          nightOnly: true, holdSeconds: 180,
          label: 'Hold the ring (night only)', required: 5, progress: 0,
          waves: [
            [{ mob: 'mob_duskwisp', count: 3 }],
            [{ mob: 'mob_duskwisp', count: 4 }],
            [{ mob: 'mob_rotling', count: 4 }],
            [{ mob: 'mob_duskwisp', count: 5 }],
            [{ mob: 'mob_ashroot_horror', count: 2 }]
          ]
        }
      ],
      rewards: { xp: 2000, gold: 140, items: [{ id: 'item_wardstone_fragment', qty: 3 }] },
      note: "V0.17.87 [20] DEFEND/RACE/INVESTIGATION. NIGHT ONLY defend, holdSeconds 180 (race). Seeds the Gloamroot arc - the ring's gap explained."
    },

    // === SILK WEB APPROACH (L6-10) - "Nothing leaves the web" ================

    {
      id: 'quest_cut_them_down',
      name: 'Cut Them Down',
      folder: 'Dark Woods / Silk Web Approach',
      region: 'silk_web_approach',
      repeatable: false, canAbandon: true, minLevel: 6,
      giver: 'Deepwood Surveyor Iren', turnIn: 'Deepwood Surveyor Iren',
      color: '#83d873', label: 'Q',
      beforeOfferText: 'The surveyor has not heard from the spider expedition in days.',
      offerText: 'An expedition went up to the cave mouth and never came back. Find their camp and cut down the cocoons - some of them may still be alive.',
      inProgressText: "My people are at the cave mouth - six of them, wrapped and hanging. Cut every last cocoon down. I don't care what's still breathing inside. Just cut them down.",
      completedText: 'Five of them were already dead. The sixth one is BREATHING.',
      postCompletionText: "I buried the five at the treeline. Named every one of them out loud, because somebody had to. The sixth is why I can still stand here talking to you.",
      tasks: [
        { type: 'discover', target: 'poi_silk_web_approach_camp', label: 'Find the expedition camp', required: 1, progress: 0 },
        { type: 'interact', target: 'approach_cocoon', label: 'Cut open the cocoons', required: 6, progress: 0 }
      ],
      rewards: { xp: 900, gold: 70, items: [] },
      note: "V0.17.88 [21] DISCOVERY/CULL/ONBOARDING. Camp placed at the cave mouth (52,145). The 6th cocoon is the survivor -> opens [22]."
    },

    {
      id: 'quest_fourth_member',
      name: 'The Fourth Expedition Member',
      folder: 'Dark Woods / Silk Web Approach',
      region: 'silk_web_approach',
      repeatable: false, canAbandon: true, minLevel: 7,
      autoOffer: true, foundAtPoi: 'poi_silk_web_approach_camp',
      prerequisiteQuestIds: ['quest_cut_them_down'],
      requiredConditions: [{ type: 'variable', name: 'survivor_dead', op: '<', value: 1 }],
      lockedText: 'There is nothing left at the cave mouth but silk, and a shape in it that used to be somebody.',
      giver: 'The Survivor', turnIn: 'Deepwood Surveyor Iren',
      color: '#d8c8f2', label: '!',
      offerText: 'The breathing survivor clutches your arm. "Please - get me back to camp. They\'re still out here."',
      inProgressText: 'She leans hard on your shoulder, breathing shallow. "Don\'t stop. I can hear them moving out there. Just get me to the camp - I can walk, I can, just keep them off me."',
      completedText: "She's home. She'll live. She says her name is the Quartermaster now - and she means to make that cavern survivable.",
      failureText: "The silk takes her a stone's throw short of the firelight. Whatever the fourth expedition member knew about that cavern goes into the web with her, and Iren's last name stays unaccounted for. There will be no Quartermaster now.",
      postCompletionText: "The Quartermaster's up and working already - counting rope, counting antivenom, counting the ways in. She says she owes you a debt she intends to pay in supplies.",
      tasks: [
        { type: 'escort', target: 'npc_expedition_survivor', name: 'the survivor', color: '#d8c8f2', hp: 60, speed: 0.85,
          fromX: 52, fromY: 145, startRadius: 8, toX: 100, toY: 100, arriveRadius: 8,
          label: 'Get her home alive', required: 1, progress: 0 }
      ],
      rewards: { xp: 1500, gold: 100, items: [] },
      onComplete: [{ type: 'setVariable', name: 'survivor_saved', op: 'set', value: 1 }],
      onFail: [{ type: 'setVariable', name: 'survivor_dead', op: 'set', value: 1 }],
      note: "V0.17.88 [22] ESCORT/FAILABLE. The first PERMANENTLY losable quest. If she dies, onFail survivor_dead=1 so it never re-offers and the Quartermaster/[23] never come. Auto-offers at the camp after [21]; turn in to Iren."
    },

    {
      id: 'quest_antivenom_supply',
      name: 'Anti-Venom Supply',
      folder: 'Dark Woods / Silk Web Approach',
      region: 'silk_web_approach',
      repeatable: true, canAbandon: true, minLevel: 7,
      requiredConditions: [{ type: 'questCompleted', questId: 'quest_fourth_member' }],
      giver: 'Silk Web Quartermaster', turnIn: 'Silk Web Quartermaster',
      color: '#83d873', label: 'D',
      beforeOfferText: 'The Quartermaster grinds gloomcap for the anti-venom vats.',
      lockedText: 'The vats stand cold and nobody here knows what goes in them. The one who did never came out of the web.',
      offerText: 'If we\'re going back into that cavern, we go supplied. Bring me gloomcap mushrooms and spider silk and I\'ll keep the anti-venom flowing.',
      inProgressText: "The vats run dry faster than I'd like. Bring me gloomcap from the damp ground and clean silk thread, and I'll keep the anti-venom flowing.",
      completedText: 'Good. Another batch of anti-venom. Every vial keeps someone breathing down there.',
      tasks: [
        { type: 'gather', target: 'herb_gloomcap_mushroom', label: 'Gather Gloomcap Mushrooms', required: 4, progress: 0 },
        { type: 'deliver', target: 'item_spider_silk_thread', label: 'Deliver Spider Silk Thread', required: 3, progress: 0 }
      ],
      rewards: { xp: 1100, gold: 85, items: [{ id: 'item_antivenom', qty: 2 }] },
      note: "V0.17.88 [23] HARVEST/FETCH/DAILY. Only exists if you saved her (questCompleted quest_fourth_member)."
    },

    // === GLOAMROOT DEPTHS (L7-10) - "The forest was here first" =============

    {
      id: 'quest_offerings',
      name: 'Offerings',
      folder: 'Dark Woods / Gloamroot Depths',
      region: 'gloamroot_depths',
      repeatable: false, canAbandon: true, minLevel: 8,
      giver: 'Elder Thalen Mossroot', turnIn: 'Elder Thalen Mossroot',
      color: '#7fae5a', label: 'Q',
      beforeOfferText: 'The old druid keeps his eyes on the deep woods.',
      offerText: 'Someone still leaves offerings at the Root Shrine and it is not me and it is not anyone in this camp. Three gifts, from three parts of these woods - the bramble, the stones, the deep. Bring them to the shrine and we will see who is still listening.',
      inProgressText: 'Three gifts the Root asks, and it knows when you come short: blackroot from the deep, wispbloom from the stones, thornberry from the bramble. Carry all three to the shrine and lay them down.',
      completedText: 'The offerings are taken. Something down there knows your hand now. Whether that is a blessing or a mark, we will learn together.',
      postCompletionText: 'The shrine stones have gone warm to the touch since your offering. Warm, in this wood. Make of that what you will - I have stopped guessing.',
      tasks: [
        { type: 'discover', target: 'poi_root_shrine', label: 'Find the Root Shrine', required: 1, progress: 0 },
        { type: 'deliver', target: 'item_blackroot', to: 'poi_root_shrine', label: 'One root from the deep', required: 1, progress: 0 },
        { type: 'deliver', target: 'item_wispbloom', to: 'poi_root_shrine', label: 'One bloom from the stones', required: 1, progress: 0 },
        { type: 'deliver', target: 'item_thornberry', to: 'poi_root_shrine', label: 'One berry from the bramble', required: 1, progress: 0 }
      ],
      rewards: { xp: 1900, gold: 130, items: [{ id: 'item_grove_token', qty: 1 }] },
      note: "V0.17.89 [24] DISCOVERY/FETCH&DELIVER/TRAINER. One herb from three regions - a full lap of the zone at level 8."
    },

    {
      id: 'quest_the_long_root',
      name: 'The Long Root',
      folder: 'Dark Woods / Gloamroot Depths',
      region: 'gloamroot_depths',
      repeatable: false, canAbandon: true, minLevel: 10,
      prerequisiteQuestIds: ['quest_offerings'],
      requiredConditions: [{ type: 'level', min: 10 }],
      giver: 'Elder Thalen Mossroot', turnIn: 'Elder Thalen Mossroot',
      color: '#8fe06a', label: '★',
      beforeOfferText: 'Thalen has stopped pretending the Ashroot Horrors are monsters.',
      lockedText: "Thalen looks you over a long moment, then shakes his head. \"Not yet. What is down there would unmake you as you stand, and I will not spend you that cheaply. Let the woods teach you a while longer, then come back to me.\"",
      offerText: "The Ashroot Horrors are not monsters. They are an immune response. There is a rot under Gloamroot and the trees have been WALKING to contain it for years, losing. The bandits fled because they dug into it. The stones were raised to seal it. The wisps are the dead who tried. Now we finish it. Find the rot, kill the forest's oldest voice, and hold the shrine while I seal it.",
      inProgressText: "The rot lies beneath Gloamroot, and its oldest voice stands guard over it - the Ashroot Elder. Put that voice out, then hold the Root Shrine at my side while I bind the rot back down into the earth. Stand long enough and the seal takes. Break, and it does not.",
      completedText: 'The seal holds. The rot is contained, not gone. And under the roots you found what made it - and it did not come from these woods. There is a road.',
      failureText: "The seal cracks before it can set. The rot surges back up through the roots and throws Thalen clear of the shrine, ashen and shaking - but breathing, and not yet finished. Nothing is bound. The Root must be held again, from the first wave to the last.",
      postCompletionText: "The seal still holds. The trees have stopped walking - they are waiting now, the same as I am. And that road under the roots has not gone anywhere. Sooner or later somebody walks it, in one direction or the other.",
      tasks: [
        { type: 'discover', target: 'poi_the_rot', label: 'Find what is under Gloamroot', required: 1, progress: 0 },
        { type: 'kill', target: 'Ashroot Elder', label: "The forest's oldest voice", required: 1, progress: 0 },
        {
          type: 'defend', target: 'root_shrine', x: 100, y: 220, radius: 13, spawnDx: 0, spawnDy: 6, mobLevel: 10,
          holdSeconds: 300,
          label: 'Hold while Thalen seals it', required: 6, progress: 0,
          waves: [
            [{ mob: 'mob_ashroot_horror', count: 2 }],
            [{ mob: 'mob_duskwisp', count: 4 }],
            [{ mob: 'mob_hollow_stag', count: 3 }],
            [{ mob: 'mob_ashroot_horror', count: 3 }],
            [{ mob: 'mob_thorn_crowned_stag', count: 3 }],
            [{ mob: 'mob_ashroot_horror', count: 4 }]
          ]
        }
      ],
      spawnOnAccept: [{ mob: 'mob_ashroot_elder', count: 1, x: 100, y: 226 }],
      rewards: {
        xp: 3400, gold: 250, items: [], playerChoice: true,
        choiceItems: [
          { id: 'item_heart_of_the_long_root' },
          { id: 'item_thalens_seal' }
        ]
      },
      onComplete: [
        { type: 'setVariable', name: 'dark_woods_sealed', op: 'set', value: 1 },
        { type: 'worldEffect', effect: 'sealDarkWoods' }
      ],
      note: "V0.17.89 [25] CAPSTONE/DEFEND/INVESTIGATION. Level 10 gate. discover + kill Ashroot Elder (spawnOnAccept at the rot) + defend 6 waves/300s. onComplete permanently relights the whole Dead Lantern Trail (the [01] payoff) + sets dark_woods_sealed. Hands the question to the next zone - there is a road."
    }

  ];

  DR.QUEST_DRAFTS = QUEST_DRAFTS;
  DR.QUEST_BY_ID = Object.freeze(Object.fromEntries(QUEST_DRAFTS.map(quest => [quest.id, quest])));
  DR.DISCOVERY_POINT_BY_ID = Object.freeze(Object.fromEntries(DR.DISCOVERY_POINTS.map(p => [p.id, p])));
})();
