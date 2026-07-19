// Blackroot mount + beast-taming definitions (Roadmap Item 7).
//
// V0.20.64: OWNERSHIP RULE - this file does NOT redefine creatures. Every entry is keyed by
// `beastKey`, which is the `mobVisualKey` already authored in data/enemies.js, and the runtime
// resolves name/renderer/palette/scale from that mob record. This file adds only the taming and
// mount LAYER on top: eligibility, difficulty, temperament, bait, failure behaviour, and mount
// movement profile. Roadmap Item 7.J explicitly forbids duplicating creature data into a separate
// incompatible registry, and Item 9 forbids a second source of truth.
//
// V0.20.66 BAIT RULE: every bait MUST have a real acquisition source. The first pass picked
// item_thornberry (boars) and item_queens_silkroot (thorn-crowned stag) on theme alone - and neither
// is obtainable anywhere in the game. Thornberry appears only as a crafting INPUT and a quest
// delivery target; queens_silkroot is defined in data/items.js and referenced nowhere else at all.
// That silently made three of the ten beasts impossible to tame. Baits are now drawn only from items
// verified to drop or be sold. Roadmap Item 12 covers this class of bug.
//
// Eligibility follows Item 7.A: beasts only. Rotlings (plant), wisps (spirit), ashroot horrors
// (plant construct) and skeletons (undead) are deliberately absent - they are not beasts and must
// never become mounts.
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  // ---------------------------------------------------------------------------
  // Taming behaviour patterns (Roadmap Item 7.D).
  //
  // Each pattern is a set of BEAST STATES. A state telegraphs itself for `tellSec`, then resolves.
  // The player must answer with the matching action before it resolves:
  //
  //   soothe  - calm voice / slow hand. Answers fear and threat displays.
  //   hold    - stand absolutely still. Answers charges, lunges and testing bluffs.
  //   feed    - offer the bait. Answers hunger and curiosity.
  //   retreat - give ground. Answers territorial fury and overcrowding.
  //
  // `feint: true` marks a FALSE opening - the beast is baiting the player into acting. The correct
  // response to a feint is to do NOTHING; acting on it raises agitation. This is what makes the
  // minigame about reading the beast rather than mashing one key (Item 7.C).
  // ---------------------------------------------------------------------------
  const TAMING_PATTERNS = {
    // Wolves test with sudden lunges and intimidation - standing your ground is the answer.
    lunge: {
      label: 'Testing Predator',
      states: [
        { id: 'stare', tell: 'The wolf locks eyes and lowers its head.', answer: 'hold', tellSec: 1.5 },
        { id: 'lunge', tell: 'It coils - a lunge is coming.', answer: 'hold', tellSec: 1.1 },
        { id: 'circle', tell: 'It circles wide, hackles up.', answer: 'soothe', tellSec: 1.6 },
        { id: 'sniff', tell: 'Its nose lifts toward your hand.', answer: 'feed', tellSec: 1.8 },
        { id: 'bluff', tell: 'It snaps at the air, watching you.', answer: 'hold', tellSec: 1.2, feint: true }
      ]
    },
    // Boars charge. Control the charge and keep distance, then feed on the lull.
    charge: {
      label: 'Charging Bruiser',
      states: [
        { id: 'paw', tell: 'It rakes the ground and drops its shoulder.', answer: 'retreat', tellSec: 1.2 },
        { id: 'charge', tell: 'The boar breaks into a charge.', answer: 'retreat', tellSec: 0.9 },
        { id: 'huff', tell: 'It huffs, tusks lowered but still.', answer: 'feed', tellSec: 1.7 },
        { id: 'settle', tell: 'Its breathing slows.', answer: 'soothe', tellSec: 1.8 },
        { id: 'stamp', tell: 'It stamps once - then waits.', answer: 'hold', tellSec: 1.3, feint: true }
      ]
    },
    // Spiders move fast and offer false openings constantly.
    skitter: {
      label: 'Erratic Ambusher',
      states: [
        { id: 'dart', tell: 'It darts sideways, legs tapping.', answer: 'hold', tellSec: 0.9 },
        { id: 'rear', tell: 'The forelegs rise in threat.', answer: 'retreat', tellSec: 1.0 },
        { id: 'still', tell: 'It goes utterly still, watching.', answer: 'soothe', tellSec: 1.3 },
        { id: 'offer', tell: 'It edges toward the bait.', answer: 'feed', tellSec: 1.2 },
        { id: 'false', tell: 'It exposes its underside - too easily.', answer: 'hold', tellSec: 0.8, feint: true },
        { id: 'false2', tell: 'It lowers its legs invitingly.', answer: 'hold', tellSec: 0.8, feint: true }
      ]
    },
    // Stags are skittish - slow, precise, and easily lost.
    skittish: {
      label: 'Skittish Grazer',
      states: [
        { id: 'earflick', tell: 'Its ears swivel toward you.', answer: 'soothe', tellSec: 2.0 },
        { id: 'freeze', tell: 'The stag freezes mid-step.', answer: 'hold', tellSec: 1.8 },
        { id: 'graze', tell: 'It dips its head toward the herb.', answer: 'feed', tellSec: 2.0 },
        { id: 'startle', tell: 'It shies back, ready to bolt.', answer: 'retreat', tellSec: 1.4 },
        { id: 'watch', tell: 'It watches without moving at all.', answer: 'hold', tellSec: 1.6, feint: true }
      ]
    },
    // Small, erratic, hard to read but forgiving of mistakes.
    flit: {
      label: 'Erratic Flyer',
      states: [
        { id: 'wheel', tell: 'It wheels overhead in a tight loop.', answer: 'hold', tellSec: 1.0 },
        { id: 'hover', tell: 'It hovers, chittering.', answer: 'soothe', tellSec: 1.2 },
        { id: 'drop', tell: 'It drops toward the offered food.', answer: 'feed', tellSec: 1.1 },
        { id: 'swoop', tell: 'It swoops straight at your head.', answer: 'retreat', tellSec: 0.9 }
      ]
    },
    // Armoured and slow. Long tells, but heavy punishment for a wrong read.
    armored: {
      label: 'Armoured Crawler',
      states: [
        { id: 'plate', tell: 'Its plates grind shut.', answer: 'hold', tellSec: 2.2 },
        { id: 'scrape', tell: 'It scrapes forward, grinding stone.', answer: 'retreat', tellSec: 1.8 },
        { id: 'open', tell: 'The shell parts slightly.', answer: 'feed', tellSec: 2.0 },
        { id: 'hum', tell: 'A low resonance runs through its shell.', answer: 'soothe', tellSec: 2.2 }
      ]
    }
  };

  // ---------------------------------------------------------------------------
  // Mount traits (Roadmap Item 7.I). Deliberately traversal-only - none of these
  // touch combat power, and none may bypass collision, zones or scripted progression (Item 7.H).
  // ---------------------------------------------------------------------------
  const MOUNT_TRAITS = {
    forest_stride: { label: 'Forest Stride', description: 'Moves cleanly through dense woodland without slowing.' },
    mud_wading: { label: 'Mud Wading', description: 'Keeps its footing in mud and shallow water.' },
    sure_footed: { label: 'Sure-Footed', description: 'Harder to shake loose - resists forced dismount.' },
    swimmer: { label: 'Swimmer', description: 'Can carry a rider across deep water.' },
    wall_climb: { label: 'Wall Climber', description: 'Crosses short obstacles other mounts must go around.' },
    quiet_step: { label: 'Quiet Step', description: 'Related beasts notice you from a shorter distance.' },
    cave_sense: { label: 'Cave Sense', description: 'Unbothered by darkness underground.' }
  };

  // ---------------------------------------------------------------------------
  // Beast roster (Roadmap Item 7.A).
  // beastKey MUST match a mobVisualKey in data/enemies.js.
  // ---------------------------------------------------------------------------
  const MOUNT_DEFINITIONS = [
    {
      // V0.20.71: the STARTER mount, bought from the camp quartermaster rather than tamed. Every other
      // mount requires weakening a wild beast and winning the taming minigame; the easiest of those
      // needs level 3 and bait that drops in the woods, so a fresh character had no route to a mount.
      //
      // `acquisition: 'vendor'` and the absent `taming` block mark it as unearnable by taming, and it
      // is deliberately excluded from MOUNT_BY_BEAST_KEY so wild beasts still resolve to their own
      // tameable mounts. beastKey names a REAL authored visual (blackWolf, added to the mob visual
      // registry with its own coat in the wolf renderer) - not an invented creature (Item 7.J).
      //
      // Deliberately the SLOWEST mount in the game at 1.14x. Note the tamed range runs 1.18x (crystal
      // crawler - an armoured plodder) to 1.85x (thorn-crowned stag), so 1.20x would NOT have been the
      // slowest; a self-check caught that claim being false. 1.14x keeps it strictly under every tamed
      // mount, so buying it is a starting point rather than a shortcut past the taming system.
      id: 'mount_black_wolf',
      beastKey: 'blackWolf',
      family: 'wolf',
      name: 'Black Wolf',
      rarity: 'common',
      acquisition: 'vendor',
      description: 'Raised in the camp from a cub and broke to the saddle. Quiet, patient, and a good deal steadier than anything you would catch in the woods.',
      taming: null,
      mount: { speedMult: 1.40, visualScale: 1.04, traits: ['forest_stride'], dismountResist: 0.2 }
    },
    {
      id: 'mount_gloom_wolf',
      beastKey: 'gloomWolf',
      family: 'wolf',
      name: 'Gloom Wolf',
      rarity: 'common',
      description: 'A pack hunter of the Dark Woods. It respects a rider who does not flinch.',
      taming: {
        difficulty: 2,
        minPlayerLevel: 4,
        requiredTier: 0,
        temperament: 'Testing - it will bluff before it trusts.',
        bait: 'item_darkwater_fish',
        healthThreshold: 0.35,
        pattern: 'lunge',
        trustPerCorrect: 15,
        agitationPerMistake: 18,
        agitationDrift: 1.4,
        failure: 'enrage',
        retryCooldownSec: 45
      },
      mount: { speedMult: 1.70, visualScale: 1.12, traits: ['forest_stride', 'quiet_step'], dismountResist: 0.15 }
    },
    {
      id: 'mount_mossfang_alpha',
      beastKey: 'mossfangAlpha',
      family: 'wolf',
      name: 'Mossfang Alpha',
      rarity: 'rare',
      description: 'The pack leader. It has never been ridden, and does not intend to be.',
      taming: {
        difficulty: 4,
        minPlayerLevel: 8,
        requiredTier: 2,
        temperament: 'Dominant - it tests longer and forgives less.',
        bait: 'item_roasted_darkwater_fish',
        healthThreshold: 0.25,
        pattern: 'lunge',
        trustPerCorrect: 10,
        agitationPerMistake: 24,
        agitationDrift: 2.2,
        failure: 'enrage',
        retryCooldownSec: 120
      },
      mount: { speedMult: 1.76, visualScale: 1.24, traits: ['forest_stride', 'quiet_step', 'sure_footed'], dismountResist: 0.4 }
    },
    {
      id: 'mount_briar_boar',
      beastKey: 'briarBoar',
      family: 'boar',
      name: 'Briar Boar',
      rarity: 'common',
      description: 'Heavy, stubborn, and untroubled by mud that would swallow a horse.',
      taming: {
        difficulty: 2,
        minPlayerLevel: 5,
        requiredTier: 0,
        temperament: 'Territorial - it charges first and considers afterwards.',
        bait: 'item_gloomleaf',
        healthThreshold: 0.35,
        pattern: 'charge',
        trustPerCorrect: 14,
        agitationPerMistake: 19,
        agitationDrift: 1.5,
        failure: 'enrage',
        retryCooldownSec: 45
      },
      mount: { speedMult: 1.58, visualScale: 1.15, traits: ['mud_wading', 'sure_footed'], dismountResist: 0.45 }
    },
    {
      id: 'mount_old_tusk',
      beastKey: 'oldTuskBriarback',
      family: 'boar',
      name: 'Old Tusk Briarback',
      rarity: 'rare',
      description: 'Scarred, enormous, and far older than anything else in the wood.',
      taming: {
        difficulty: 4,
        minPlayerLevel: 9,
        requiredTier: 2,
        temperament: 'Immovable - patience is the only approach that works.',
        bait: 'item_gloomleaf',
        healthThreshold: 0.22,
        pattern: 'charge',
        trustPerCorrect: 9,
        agitationPerMistake: 25,
        agitationDrift: 2.0,
        failure: 'enrage',
        retryCooldownSec: 120
      },
      mount: { speedMult: 1.66, visualScale: 1.34, traits: ['mud_wading', 'sure_footed', 'forest_stride'], dismountResist: 0.7 }
    },
    {
      id: 'mount_hollow_stag',
      beastKey: 'hollowStag',
      family: 'stag',
      name: 'Hollow Stag',
      rarity: 'uncommon',
      description: 'Fast and desperately nervous. One wrong movement and it is gone.',
      taming: {
        difficulty: 3,
        minPlayerLevel: 6,
        requiredTier: 1,
        temperament: 'Skittish - it bolts at the first sudden motion.',
        bait: 'item_blackroot',
        healthThreshold: 0.45,
        pattern: 'skittish',
        trustPerCorrect: 13,
        agitationPerMistake: 26,
        agitationDrift: 1.1,
        failure: 'flee',
        retryCooldownSec: 90
      },
      mount: { speedMult: 1.80, visualScale: 1.10, traits: ['forest_stride', 'wall_climb'], dismountResist: 0.05 }
    },
    {
      id: 'mount_thorn_crowned_stag',
      beastKey: 'thornCrownedStag',
      family: 'stag',
      name: 'Thorn-Crowned Stag',
      rarity: 'rare',
      description: 'Antlers grown through with living briar. The wood parts for it.',
      taming: {
        difficulty: 5,
        minPlayerLevel: 10,
        requiredTier: 3,
        temperament: 'Sacred and wary - it has watched hunters die for less.',
        bait: 'item_mooncap',
        healthThreshold: 0.30,
        pattern: 'skittish',
        trustPerCorrect: 8,
        agitationPerMistake: 30,
        agitationDrift: 1.6,
        failure: 'flee',
        retryCooldownSec: 180
      },
      mount: { speedMult: 1.85, visualScale: 1.20, traits: ['forest_stride', 'wall_climb', 'quiet_step'], dismountResist: 0.1 }
    },
    {
      id: 'mount_thorn_widow',
      beastKey: 'thornWidow',
      family: 'spider',
      name: 'Thorn Widow',
      rarity: 'uncommon',
      description: 'It will climb anything. Whether it enjoys being ridden is unclear.',
      taming: {
        difficulty: 3,
        minPlayerLevel: 6,
        requiredTier: 1,
        temperament: 'Cunning - it offers openings that are not openings.',
        bait: 'item_cave_blindfish',
        healthThreshold: 0.35,
        pattern: 'skitter',
        trustPerCorrect: 12,
        agitationPerMistake: 21,
        agitationDrift: 1.8,
        failure: 'untameable',
        retryCooldownSec: 90
      },
      mount: { speedMult: 1.62, visualScale: 1.05, traits: ['wall_climb', 'cave_sense'], dismountResist: 0.3 }
    },
    {
      id: 'mount_webling_skitterer',
      beastKey: 'weblingSkitterer',
      family: 'spider',
      name: 'Webling Skitterer',
      rarity: 'common',
      description: 'Small enough to be manageable, quick enough to be worth it.',
      taming: {
        difficulty: 1,
        minPlayerLevel: 3,
        requiredTier: 0,
        temperament: 'Nervous but curious.',
        bait: 'item_cave_blindfish',
        healthThreshold: 0.45,
        pattern: 'skitter',
        trustPerCorrect: 18,
        agitationPerMistake: 15,
        agitationDrift: 1.2,
        failure: 'flee',
        retryCooldownSec: 30
      },
      mount: { speedMult: 1.50, visualScale: 0.95, traits: ['wall_climb'], dismountResist: 0.15 }
    },
    {
      id: 'mount_cave_bat',
      beastKey: 'caveBat',
      family: 'bat',
      name: 'Dusk Bat',
      rarity: 'common',
      description: 'Too small to ride comfortably. It insists anyway.',
      taming: {
        difficulty: 1,
        minPlayerLevel: 3,
        requiredTier: 0,
        temperament: 'Erratic but harmless.',
        bait: 'item_cave_blindfish',
        healthThreshold: 0.5,
        pattern: 'flit',
        trustPerCorrect: 20,
        agitationPerMistake: 13,
        agitationDrift: 1.0,
        failure: 'flee',
        retryCooldownSec: 30
      },
      mount: { speedMult: 1.55, visualScale: 0.9, traits: ['cave_sense', 'quiet_step'], dismountResist: 0.1 }
    },
    {
      id: 'mount_crystal_crawler',
      beastKey: 'crystalCrawler',
      family: 'crawler',
      name: 'Crystal Crawler',
      rarity: 'uncommon',
      description: 'Slow, armoured, and impossible to knock off course.',
      taming: {
        difficulty: 3,
        minPlayerLevel: 7,
        requiredTier: 1,
        temperament: 'Ponderous - it gives long warnings and expects them read.',
        bait: 'item_ashroot_moss',
        healthThreshold: 0.4,
        pattern: 'armored',
        trustPerCorrect: 14,
        agitationPerMistake: 22,
        agitationDrift: 0.9,
        failure: 'untameable',
        retryCooldownSec: 60
      },
      mount: { speedMult: 1.45, visualScale: 1.1, traits: ['sure_footed', 'cave_sense', 'mud_wading'], dismountResist: 0.85 }
    }
  ];

  const MOUNT_BY_ID = Object.create(null);
  const MOUNT_BY_BEAST_KEY = Object.create(null);
  for (const def of MOUNT_DEFINITIONS) {
    MOUNT_BY_ID[def.id] = def;
    // Only TAMEABLE mounts belong in the beast-key map - it answers "which mount does taming this
    // wild creature grant", and a vendor mount is not an answer to that. Without this guard the
    // vendor pack boar would shadow the wild Briar Boar and make that beast untameable.
    if (def.taming) MOUNT_BY_BEAST_KEY[String(def.beastKey).toLowerCase()] = def;
  }

  // Taming skill tiers (Roadmap Item 7.A "required taming skill or progression tier").
  // Tier is derived from how many distinct beasts the character has tamed, so progression comes
  // from doing the activity rather than from a separate currency.
  const TAMING_TIERS = [
    { tier: 0, label: 'Untrained', tamedRequired: 0 },
    { tier: 1, label: 'Novice Handler', tamedRequired: 1 },
    { tier: 2, label: 'Beast Handler', tamedRequired: 3 },
    { tier: 3, label: 'Master Handler', tamedRequired: 6 }
  ];

  function tamingTierFor(tamedCount) {
    let tier = 0;
    for (const t of TAMING_TIERS) if (Number(tamedCount) >= t.tamedRequired) tier = t.tier;
    return tier;
  }

  function tamingTierLabel(tier) {
    const found = TAMING_TIERS.find(t => t.tier === Number(tier));
    return found ? found.label : 'Untrained';
  }

  DR.MOUNT_DEFINITIONS = MOUNT_DEFINITIONS;
  DR.MOUNT_BY_ID = MOUNT_BY_ID;
  DR.MOUNT_BY_BEAST_KEY = MOUNT_BY_BEAST_KEY;
  DR.TAMING_PATTERNS = TAMING_PATTERNS;
  DR.MOUNT_TRAITS = MOUNT_TRAITS;
  DR.TAMING_TIERS = TAMING_TIERS;
  DR.tamingTierFor = tamingTierFor;
  DR.tamingTierLabel = tamingTierLabel;
})();
